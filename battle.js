import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  ref,
  get,
  set,
  update
} from './firebase.js';

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  whoami: qs('#whoamiBattle'),
  points: qs('#pointsBattle'),
  gold: qs('#goldBattle'),
  toGacha: qs('#toGacha'),
  logout: qs('#logoutBtn'),
  playerEquipment: qs('#playerEquipment'),
  playerTotalStats: qs('#playerTotalStats'),
  playerPower: qs('#playerPower'),
  enemyPower: qs('#enemyPower'),
  winProbability: qs('#winProbability'),
  winProbIndicator: qs('#winProbIndicator'),
  playerHpBar: qs('#playerHpBar'),
  playerHpText: qs('#playerHpText'),
  enemyHpBar: qs('#enemyHpBar'),
  enemyHpText: qs('#enemyHpText'),
  playerAtk: qs('#playerAtk'),
  playerDef: qs('#playerDef'),
  playerCrit: qs('#playerCrit'),
  playerDodge: qs('#playerDodge'),
  enemyLevel: qs('#enemyLevel'),
  enemyAtk: qs('#enemyAtk'),
  enemyDef: qs('#enemyDef'),
  enemySpeed: qs('#enemySpeed'),
  playerSprite: qs('#playerSprite'),
  monsterSprite: qs('#monsterSprite'),
  monsterSvg: qs('#monsterSvg'),
  battleLog: qs('#battleLog'),
  attackBtn: qs('#attackBtn'),
  defendBtn: qs('#defendBtn'),
  skillBtn: qs('#skillBtn'),
  potionBtn: qs('#potionBtn'),
  newBattleBtn: qs('#newBattleBtn'),
  generateEquipBtn: qs('#generateEquipBtn'),
  autoPlayBtn: qs('#autoPlayBtn'),
  monsterLevel: qs('#monsterLevel'),
  levelDisplay: qs('#levelDisplay'),
  skillCooldownView: qs('#skillCooldownView'),
  potionStock: qs('#potionStock'),
  hyperPotionStock: qs('#hyperPotionStock'),
  hyperPotionBtn: qs('#hyperPotionBtn'),
  battleResToggle: qs('#battleResToggle'),
  battleResCount: qs('#battleResCount'),
  battleResInline: qs('#battleResInline'),
  speedStatus: qs('#speedStatus')
};

const TIERS = ['SSS+', 'SS+', 'S+', 'S', 'A', 'B', 'C', 'D'];
const TIER_INDEX = Object.fromEntries(TIERS.map((t, i) => [t, i]));
const PART_DEFS = [
  { key: 'head', name: '투구', type: 'def' },
  { key: 'body', name: '갑옷', type: 'def' },
  { key: 'main', name: '주무기', type: 'atk' },
  { key: 'off', name: '보조무기', type: 'atk' },
  { key: 'boots', name: '신발', type: 'def' }
];
const PART_KEYS = PART_DEFS.map((p) => p.key);
const PART_ICONS = { head: '🪖', body: '🛡️', main: '⚔️', off: '🗡️', boots: '🥾' };

const MAX_LEVEL = 999;
const GLOBAL_CONFIG_PATH = 'config/global';

const DEFAULT_DROP_RATES = {
  potion: { base: 0.04, perLevel: 0.000045, max: 0.25 },
  hyperPotion: { base: 0.01, perLevel: 0.00005, max: 0.12 },
  protect: { base: 0.02, perLevel: 0.00003, max: 0.18 },
  enhance: { base: 0.75, perLevel: 0.0002, max: 1.0 },
  battleRes: { base: 0.01, perLevel: 0.00002, max: 0.08 }
};
const DEFAULT_GOLD_SCALING = { minLow: 120, maxLow: 250, minHigh: 900, maxHigh: 1400 };
const DEFAULT_POTION_SETTINGS = { durationMs: 60000, manualCdMs: 1000, autoCdMs: 2000, speedMultiplier: 2 };
const DEFAULT_HYPER_POTION_SETTINGS = { durationMs: 60000, manualCdMs: 200, autoCdMs: 200, speedMultiplier: 4 };
const DEFAULT_MONSTER_SCALING = {
  basePower: 500,
  maxPower: 50000000,
  curve: 1.6,
  difficultyMultiplier: 1,
  attackShare: 0.32,
  defenseShare: 0.22,
  hpMultiplier: 6.5,
  speedBase: 100,
  speedMax: 260,
  critRateBase: 5,
  critRateMax: 55,
  critDmgBase: 160,
  critDmgMax: 420,
  dodgeBase: 3,
  dodgeMax: 40
};

const USERNAME_NAMESPACE = '@gacha.local';

const state = {
  user: null,
  profile: null,
  config: null,
  items: null,
  equip: null,
  enhance: null,
  wallet: 0,
  gold: 0,
  combat: { useBattleRes: true, prefBattleRes: true },
  saveTimer: null,
  pendingUpdates: {},
  buffs: { accelUntil: 0, accelMultiplier: 1, hyperUntil: 0, hyperMultiplier: 1 },
  autoNextTimer: null,
  autoPlayerTimer: null,
  buffTicker: null
};

const gameState = {
  player: {
    hp: 0,
    maxHp: 0,
    equipment: [],
    totalStats: {},
    defending: false,
    skillCooldown: 0
  },
  enemy: {
    level: 1,
    hp: 0,
    maxHp: 0,
    stats: {},
    defending: false
  },
  battle: {
    turn: 0,
    isPlayerTurn: true,
    ongoing: false,
    autoPlay: false
  }
};

function clampNumber(value, min, max, fallback) {
  if (typeof value !== 'number' || !isFinite(value)) return fallback;
  let n = Math.floor(value);
  if (typeof min === 'number' && n < min) n = min;
  if (typeof max === 'number' && n > max) n = max;
  return n;
}

function defaultEnhance() {
  const multipliers = Array(21).fill(1);
  for (let lv = 1; lv <= 20; lv++) {
    multipliers[lv] = lv < 20 ? 1 + 0.1 * lv : 21;
  }
  const probs = Array(21).fill(0);
  for (let lv = 1; lv <= 20; lv++) {
    probs[lv] = 0.99 - ((lv - 1) * (0.99 - 0.001)) / 19;
    if (probs[lv] < 0) probs[lv] = 0;
  }
  return { multipliers, probs };
}

function sanitizeUsername(raw, fallback) {
  if (typeof raw === 'string' && raw.trim().length) {
    return raw.trim();
  }
  return fallback || '';
}

function deriveUsernameFromUser(firebaseUser) {
  if (!firebaseUser) return '';
  const email = firebaseUser.email || '';
  if (email.endsWith(USERNAME_NAMESPACE)) {
    return email.slice(0, -USERNAME_NAMESPACE.length);
  }
  const at = email.indexOf('@');
  if (at > 0) {
    return email.slice(0, at);
  }
  return email || firebaseUser.displayName || '';
}

function sanitizeEquipItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tier = TIERS.includes(raw.tier) ? raw.tier : null;
  const part = PART_KEYS.includes(raw.part) ? raw.part : null;
  if (!tier || !part) return null;
  const type = raw.type === 'def' ? 'def' : 'atk';
  return {
    id: clampNumber(raw.id, 0, Number.MAX_SAFE_INTEGER, Date.now()),
    tier,
    part,
    base: clampNumber(raw.base ?? raw.stat, 0, Number.MAX_SAFE_INTEGER, 0),
    lvl: clampNumber(raw.lvl, 0, 20, 0),
    type
  };
}

function sanitizeEquipMap(raw) {
  const result = { head: null, body: null, main: null, off: null, boots: null };
  if (raw && typeof raw === 'object') {
    PART_KEYS.forEach((key) => {
      result[key] = sanitizeEquipItem(raw[key]);
    });
  }
  return result;
}

function sanitizeItems(raw) {
  const template = { potion: 0, hyperPotion: 0, protect: 0, enhance: 0, revive: 0, battleRes: 0 };
  const result = { ...template };
  if (raw && typeof raw === 'object') {
    Object.keys(template).forEach((key) => {
      result[key] = clampNumber(raw[key], 0, Number.MAX_SAFE_INTEGER, 0);
    });
  }
  return result;
}

function sanitizeEnhanceConfig(raw) {
  const base = defaultEnhance();
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.multipliers)) {
      base.multipliers = base.multipliers.map((def, idx) => {
        const val = raw.multipliers[idx];
        return typeof val === 'number' && isFinite(val) && val > 0 ? val : def;
      });
    }
    if (Array.isArray(raw.probs)) {
      base.probs = base.probs.map((def, idx) => {
        const val = raw.probs[idx];
        if (typeof val === 'number' && isFinite(val) && val >= 0) {
          return Math.max(0, Math.min(1, val));
        }
        return def;
      });
    }
  }
  return base;
}

function cloneDropRates(src) {
  return JSON.parse(JSON.stringify(src || DEFAULT_DROP_RATES));
}

function normalizeDropRates(raw) {
  const base = cloneDropRates(DEFAULT_DROP_RATES);
  if (!raw) return base;
  const out = cloneDropRates(base);
  Object.keys(base).forEach((key) => {
    const item = raw[key];
    if (item && typeof item === 'object') {
      if (typeof item.base === 'number') out[key].base = item.base;
      if (typeof item.perLevel === 'number') out[key].perLevel = item.perLevel;
      if (typeof item.max === 'number') out[key].max = item.max;
    } else if (typeof item === 'number') {
      out[key].base = item;
      out[key].perLevel = 0;
      out[key].max = item;
    }
    out[key].base = Math.max(0, Math.min(1, out[key].base));
    out[key].perLevel = Math.max(0, out[key].perLevel);
    out[key].max = Math.max(out[key].base, Math.min(1, out[key].max));
  });
  return out;
}

function normalizeGoldScaling(raw) {
  const base = { ...DEFAULT_GOLD_SCALING };
  const coerce = (val) => (typeof val === 'number' && isFinite(val) ? val : null);
  if (raw) {
    const a = coerce(raw.minLow);
    const b = coerce(raw.maxLow);
    const c = coerce(raw.minHigh);
    const d = coerce(raw.maxHigh);
    if (a !== null) base.minLow = a;
    if (b !== null) base.maxLow = b;
    if (c !== null) base.minHigh = c;
    if (d !== null) base.maxHigh = d;
  }
  if (base.maxLow < base.minLow) base.maxLow = base.minLow;
  if (base.minHigh < base.minLow) base.minHigh = base.minLow;
  if (base.maxHigh < base.minHigh) base.maxHigh = base.minHigh;
  return base;
}

function normalizePotionSettings(raw, defaults) {
  const base = { ...defaults };
  if (raw && typeof raw === 'object') {
    const coerce = (val, fallback) => (typeof val === 'number' && isFinite(val) && val >= 0 ? Math.round(val) : fallback);
    const coerceMult = (val, fallback) => (typeof val === 'number' && isFinite(val) && val > 0 ? val : fallback);
    base.durationMs = coerce(raw.durationMs, base.durationMs);
    base.manualCdMs = coerce(raw.manualCdMs, base.manualCdMs);
    base.autoCdMs = coerce(raw.autoCdMs, base.autoCdMs);
    base.speedMultiplier = coerceMult(raw.speedMultiplier, base.speedMultiplier ?? 1);
  }
  return base;
}

function normalizeMonsterScaling(raw) {
  const base = { ...DEFAULT_MONSTER_SCALING };
  const num = (val, fallback, min, max) => {
    if (typeof val === 'number' && isFinite(val)) {
      let v = val;
      if (typeof min === 'number' && v < min) v = min;
      if (typeof max === 'number' && v > max) v = max;
      return v;
    }
    return fallback;
  };
  if (raw && typeof raw === 'object') {
    base.basePower = num(raw.basePower, base.basePower, 1, 1e12);
    base.maxPower = num(raw.maxPower, base.maxPower, base.basePower, 1e15);
    base.curve = num(raw.curve, base.curve, 0.1, 10);
    base.difficultyMultiplier = num(raw.difficultyMultiplier, base.difficultyMultiplier, 0.1, 10);
    base.attackShare = num(raw.attackShare, base.attackShare, 0.05, 0.9);
    base.defenseShare = num(raw.defenseShare, base.defenseShare, 0.05, 0.9);
    base.hpMultiplier = num(raw.hpMultiplier, base.hpMultiplier, 0.1, 100);
    base.speedBase = num(raw.speedBase, base.speedBase, 1, 1000);
    base.speedMax = num(raw.speedMax, base.speedMax, base.speedBase, 2000);
    base.critRateBase = num(raw.critRateBase, base.critRateBase, 0, 100);
    base.critRateMax = num(raw.critRateMax, base.critRateMax, base.critRateBase, 100);
    base.critDmgBase = num(raw.critDmgBase, base.critDmgBase, 100, 1000);
    base.critDmgMax = num(raw.critDmgMax, base.critDmgMax, base.critDmgBase, 1000);
    base.dodgeBase = num(raw.dodgeBase, base.dodgeBase, 0, 100);
    base.dodgeMax = num(raw.dodgeMax, base.dodgeMax, base.dodgeBase, 95);
  }
  const share = base.attackShare + base.defenseShare;
  if (share >= 0.95) {
    base.attackShare = (base.attackShare / share) * 0.9;
    base.defenseShare = (base.defenseShare / share) * 0.9;
  }
  return base;
}

function sanitizeConfig(raw) {
  const weights = TIERS.reduce((acc, tier) => {
    acc[tier] = 0;
    return acc;
  }, {});
  const baseWeights = { ...weights, ...(raw && raw.weights ? raw.weights : {}) };
  const cfgWeights = TIERS.reduce((acc, tier) => {
    const val = baseWeights[tier];
    acc[tier] = typeof val === 'number' && isFinite(val) && val >= 0 ? val : 0;
    return acc;
  }, {});
  return {
    weights: cfgWeights,
    probs: normalizeWeights(cfgWeights),
    seed: raw && typeof raw.seed === 'string' ? raw.seed : '',
    locked: !!(raw && raw.locked),
    version: raw && typeof raw.version === 'string' ? raw.version : 'v1',
    pity: {
      enabled: !!(raw && raw.pity && raw.pity.enabled),
      floorTier: raw && raw.pity && TIERS.includes(raw.pity.floorTier) ? raw.pity.floorTier : 'S',
      span: clampNumber(raw && raw.pity && raw.pity.span, 1, 9999, 90)
    },
    minGuarantee10: {
      enabled: !!(raw && raw.minGuarantee10 && raw.minGuarantee10.enabled),
      tier: raw && raw.minGuarantee10 && TIERS.includes(raw.minGuarantee10.tier) ? raw.minGuarantee10.tier : 'A'
    },
    dropRates: normalizeDropRates(raw && raw.dropRates),
    goldScaling: normalizeGoldScaling(raw && raw.goldScaling),
    shopPrices: raw && raw.shopPrices ? { ...DEFAULT_SHOP_PRICES, ...raw.shopPrices } : { ...DEFAULT_SHOP_PRICES },
    potionSettings: normalizePotionSettings(raw && raw.potionSettings, DEFAULT_POTION_SETTINGS),
    hyperPotionSettings: normalizePotionSettings(raw && raw.hyperPotionSettings, DEFAULT_HYPER_POTION_SETTINGS),
    monsterScaling: normalizeMonsterScaling(raw && raw.monsterScaling)
  };
}

function normalizeWeights(weights) {
  const total = Object.values(weights).reduce((sum, val) => sum + val, 0);
  if (!(total > 0)) {
    return TIERS.reduce((acc, tier) => {
      acc[tier] = 0;
      return acc;
    }, {});
  }
  return TIERS.reduce((acc, tier) => {
    acc[tier] = weights[tier] / total;
    return acc;
  }, {});
}

const DEFAULT_SHOP_PRICES = { potion: 500, hyperPotion: 2000, protect: 1200, enhance: 800, battleRes: 2000, starterPack: 5000 };

function formatNum(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatMultiplier(value) {
  const rounded = Math.round((value ?? 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
}

function effectiveStat(item, enhance) {
  if (!item) return 0;
  const multipliers = enhance?.multipliers || defaultEnhance().multipliers;
  const lvl = item.lvl || 0;
  const mul = multipliers[lvl] || 1;
  return Math.floor((item.base || 0) * mul);
}

const TIER_VALUE = {
  'SSS+': 6,
  'SS+': 5,
  'S+': 4,
  S: 3,
  A: 2,
  B: 1.2,
  C: 0.8,
  D: 0.4
};

function tierScore(tier) {
  return TIER_VALUE[tier] || 1;
}

function computePlayerStats() {
  const stats = {
    atk: 0,
    def: 0,
    hp: 5000,
    critRate: 5,
    critDmg: 150,
    dodge: 5,
    speed: 100
  };
  const equipment = [];
  PART_DEFS.forEach((def) => {
    const item = state.equip[def.key];
    if (!item) return;
    const eff = effectiveStat(item, state.enhance);
    const score = tierScore(item.tier);
    equipment.push({
      ...item,
      effective: eff
    });
    if (item.type === 'atk') {
      stats.atk += eff;
      stats.critRate += 2 + score;
      stats.critDmg += 10 + score * 6;
      stats.speed += score * 1.5;
    } else {
      stats.def += eff;
      stats.hp += eff * (4 + score);
      stats.dodge += 1 + score;
      if (item.part === 'boots') {
        stats.speed += 5 + score * 2;
      }
    }
  });
  stats.critRate = Math.min(90, stats.critRate);
  stats.critDmg = Math.min(400, stats.critDmg);
  stats.dodge = Math.min(60, stats.dodge);
  gameState.player.equipment = equipment;
  gameState.player.totalStats = stats;
  gameState.player.maxHp = stats.hp;
  if (!gameState.player.hp) {
    gameState.player.hp = stats.hp;
  } else {
    gameState.player.hp = Math.min(gameState.player.hp, stats.hp);
  }
}

function combatPower(stats) {
  const critFactor = ((stats.critRate || 0) * (stats.critDmg || 100)) / 100;
  const dodgeFactor = (stats.dodge || 0) * 20;
  const speedFactor = (stats.speed || 100) * 2;
  return Math.floor((stats.atk || 0) + (stats.def || 0) * 2 + (stats.hp || 0) / 10 + critFactor + dodgeFactor + speedFactor);
}

function dropRateForLevel(type, level) {
  const cfg = state.config?.dropRates || DEFAULT_DROP_RATES;
  const item = cfg[type] || DEFAULT_DROP_RATES[type];
  if (!item) return 0;
  const lvl = Math.max(1, Math.min(MAX_LEVEL, level || 1));
  let rate = item.base + item.perLevel * (lvl - 1);
  if (rate > item.max) rate = item.max;
  if (rate < 0) rate = 0;
  return rate;
}

function calcGoldReward(level, rng) {
  const cfg = normalizeGoldScaling(state.config?.goldScaling);
  const lvl = Math.max(1, Math.min(MAX_LEVEL, level || 1));
  const ratio = (lvl - 1) / (MAX_LEVEL - 1 || 1);
  const minVal = Math.round(cfg.minLow + ratio * (cfg.minHigh - cfg.minLow));
  const maxVal = Math.round(cfg.maxLow + ratio * (cfg.maxHigh - cfg.maxLow));
  const low = Math.min(minVal, maxVal);
  const high = Math.max(minVal, maxVal);
  const span = Math.max(0, high - low);
  const rand = Math.floor((rng ? rng() : Math.random()) * (span + 1));
  return Math.max(1, low + rand);
}

function levelReward(level) {
  return Math.max(1, 2 * level - 1);
}

function queueProfileUpdate(partial) {
  if (!state.user) return;
  state.pendingUpdates = { ...state.pendingUpdates, ...partial };
  if (state.saveTimer) return;
  state.saveTimer = setTimeout(async () => {
    state.saveTimer = null;
    const payload = { ...state.pendingUpdates };
    state.pendingUpdates = {};
    try {
      await update(ref(db, `users/${state.user.uid}`), payload);
    } catch (error) {
      console.error('프로필 저장 실패', error);
    }
  }, 800);
}

function updateResourceSummary() {
  if (els.points) els.points.textContent = state.user?.role === 'admin' ? '∞' : formatNum(state.wallet);
  if (els.gold) els.gold.textContent = state.user?.role === 'admin' ? '∞' : formatNum(state.gold);
  if (els.potionStock) els.potionStock.textContent = formatNum(state.items?.potion || 0);
  if (els.hyperPotionStock) els.hyperPotionStock.textContent = formatNum(state.items?.hyperPotion || 0);
  updateBattleResUi();
  updateSpeedStatus();
}

function updateBattleResUi() {
  const brCount = state.items?.battleRes || 0;
  const display = state.user?.role === 'admin' ? '∞' : formatNum(brCount);
  if (els.battleResCount) els.battleResCount.textContent = display;
  if (els.battleResInline) els.battleResInline.textContent = display;
  if (els.battleResToggle) {
    const hasStock = state.user?.role === 'admin' || brCount > 0;
    els.battleResToggle.checked = !!state.combat.useBattleRes && hasStock;
    els.battleResToggle.disabled = !hasStock;
  }
}

function snapshotItems() {
  return {
    potion: state.items?.potion || 0,
    hyperPotion: state.items?.hyperPotion || 0,
    protect: state.items?.protect || 0,
    enhance: state.items?.enhance || 0,
    revive: state.items?.revive || 0,
    battleRes: state.items?.battleRes || 0
  };
}

function persistItems() {
  const itemsPayload = snapshotItems();
  state.profile.items = { ...itemsPayload };
  queueProfileUpdate({ items: itemsPayload });
}

function persistCombatPreferences() {
  const combatPayload = {
    useBattleRes: !!state.combat.useBattleRes,
    prefBattleRes: state.combat.prefBattleRes !== false
  };
  state.profile.combat = { ...combatPayload };
  queueProfileUpdate({ combat: combatPayload });
}

function buildEquipmentList() {
  if (!els.playerEquipment) return;
  els.playerEquipment.innerHTML = '';
  gameState.player.equipment.forEach((item) => {
    const slot = document.createElement('div');
    slot.className = 'equipment-slot';
    const tierClass = `tier-${item.tier.replace('+', '')}`;
    slot.innerHTML = `
      <div class="equipment-name">
        <span>${PART_ICONS[item.part] || '🎁'} <span class="${tierClass}">${item.tier}</span></span>
        <span>Lv.${item.lvl || 0}</span>
      </div>
      <div class="equipment-stats">
        ${item.type === 'atk' ? 'ATK' : 'DEF'} ${formatNum(item.effective)} · 기본 ${formatNum(item.base || 0)}
      </div>
    `;
    els.playerEquipment.appendChild(slot);
  });
}

function renderTotalStats() {
  if (!els.playerTotalStats) return;
  els.playerTotalStats.innerHTML = '';
  const stats = gameState.player.totalStats;
  const entries = [
    ['atk', '공격력'],
    ['def', '방어력'],
    ['hp', '체력'],
    ['critRate', '크리티컬'],
    ['critDmg', '크리티컬 데미지'],
    ['dodge', '회피'],
    ['speed', '속도']
  ];
  entries.forEach(([key, label]) => {
    const value = stats[key] || 0;
    const formatted = key === 'critRate' || key === 'dodge' ? `${Math.round(value)}%` : formatNum(Math.round(value));
    const item = document.createElement('div');
    item.className = 'stat-item';
    item.innerHTML = `<span class="stat-name">${label}</span><span class="stat-value">${formatted}</span>`;
    els.playerTotalStats.appendChild(item);
  });
}

function updateCombatPowerUI() {
  const playerPower = combatPower({ ...gameState.player.totalStats, hp: gameState.player.maxHp });
  const enemyPower = combatPower({ ...gameState.enemy.stats, hp: gameState.enemy.maxHp });
  if (els.playerPower) els.playerPower.textContent = formatNum(playerPower);
  if (els.enemyPower) els.enemyPower.textContent = formatNum(enemyPower);
  const probability = calculateWinProbability();
  const percent = Math.round(probability * 100);
  if (els.winProbability) {
    els.winProbability.textContent = `${percent}%`;
    if (percent >= 70) els.winProbability.style.color = 'var(--ok)';
    else if (percent >= 40) els.winProbability.style.color = 'var(--warn)';
    else els.winProbability.style.color = 'var(--danger)';
  }
  if (els.winProbIndicator) {
    els.winProbIndicator.style.left = `${percent}%`;
  }
}

function updateHpBars() {
  if (els.playerHpBar) {
    const pct = Math.max(0, Math.min(100, (gameState.player.hp / gameState.player.maxHp) * 100));
    els.playerHpBar.style.width = `${pct}%`;
  }
  if (els.playerHpText) {
    els.playerHpText.textContent = `${Math.max(0, Math.round(gameState.player.hp))} / ${Math.round(gameState.player.maxHp)}`;
  }
  if (els.enemyHpBar) {
    const pct = Math.max(0, Math.min(100, (gameState.enemy.hp / gameState.enemy.maxHp) * 100));
    els.enemyHpBar.style.width = `${pct}%`;
  }
  if (els.enemyHpText) {
    els.enemyHpText.textContent = `${Math.max(0, Math.round(gameState.enemy.hp))} / ${Math.round(gameState.enemy.maxHp)}`;
  }
  if (els.skillCooldownView) {
    els.skillCooldownView.textContent = gameState.player.skillCooldown;
  }
  updateSpeedStatus();
}

function currentSpeedMultiplier(now = Date.now()) {
  let multiplier = 1;
  if (state.buffs.hyperUntil > now) {
    multiplier = Math.max(multiplier, state.buffs.hyperMultiplier || DEFAULT_HYPER_POTION_SETTINGS.speedMultiplier || 4);
  }
  if (state.buffs.accelUntil > now) {
    multiplier = Math.max(multiplier, state.buffs.accelMultiplier || DEFAULT_POTION_SETTINGS.speedMultiplier || 2);
  }
  return multiplier;
}

function updateSpeedStatus() {
  if (!els.speedStatus) return;
  const now = Date.now();
  const multiplier = currentSpeedMultiplier(now);
  let remain = 0;
  let labelMultiplier = multiplier;
  if (state.buffs.hyperUntil > now && multiplier === (state.buffs.hyperMultiplier || DEFAULT_HYPER_POTION_SETTINGS.speedMultiplier || 4)) {
    remain = state.buffs.hyperUntil - now;
    labelMultiplier = state.buffs.hyperMultiplier || multiplier;
  } else if (state.buffs.accelUntil > now && multiplier > 1) {
    remain = state.buffs.accelUntil - now;
    labelMultiplier = Math.max(multiplier, state.buffs.accelMultiplier || multiplier);
  }
  const displayMultiplier = formatMultiplier(labelMultiplier);
  let text = `배속 ${displayMultiplier}×`;
  if (remain > 0) {
    text += ` (${Math.ceil(remain / 1000)}s)`;
  }
  els.speedStatus.textContent = text;
  document.documentElement.style.setProperty('--speed-scale', multiplier.toString());
}

function startBuffTicker() {
  if (state.buffTicker) clearInterval(state.buffTicker);
  updateSpeedStatus();
  state.buffTicker = setInterval(updateSpeedStatus, 500);
}

function clearAutoPlayerTimer() {
  if (state.autoPlayerTimer) {
    clearTimeout(state.autoPlayerTimer);
    state.autoPlayerTimer = null;
  }
}

function clearAutoNextTimer() {
  if (state.autoNextTimer) {
    clearTimeout(state.autoNextTimer);
    state.autoNextTimer = null;
  }
}

function clearAutoSchedules() {
  clearAutoPlayerTimer();
  clearAutoNextTimer();
}

function queueAutoPlayerAction(delayMs = 500) {
  clearAutoPlayerTimer();
  if (!gameState.battle.autoPlay || !gameState.battle.ongoing || !gameState.battle.isPlayerTurn) return;
  const delay = Math.max(150, Math.round(delayMs / currentSpeedMultiplier()));
  state.autoPlayerTimer = setTimeout(() => {
    state.autoPlayerTimer = null;
    if (!gameState.battle.autoPlay || !gameState.battle.ongoing || !gameState.battle.isPlayerTurn) return;
    const actions = ['attack', 'attack', 'attack', 'defend', 'skill'];
    const pick = actions[Math.floor(Math.random() * actions.length)];
    playerAction(pick);
  }, delay);
}

function scheduleNextAutoBattle(result = 'victory') {
  clearAutoNextTimer();
  if (!gameState.battle.autoPlay) return;
  let baseDelay = 1700;
  if (result === 'manual') baseDelay = 600;
  else if (result !== 'victory') baseDelay = 2200;
  const delay = Math.max(400, Math.round(baseDelay / currentSpeedMultiplier()));
  state.autoNextTimer = setTimeout(() => {
    state.autoNextTimer = null;
    if (!gameState.battle.autoPlay) return;
    startNewBattle();
  }, delay);
}

function updateAutoPlayUi() {
  if (!els.autoPlayBtn) return;
  els.autoPlayBtn.textContent = gameState.battle.autoPlay ? '자동 전투 ON' : '자동 전투 OFF';
  els.autoPlayBtn.classList.toggle('ok', gameState.battle.autoPlay);
}

function addBattleLog(message, type = '') {
  if (!els.battleLog) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  if (type === 'damage') {
    entry.innerHTML = `<span class="log-damage">${message}</span>`;
  } else if (type === 'critical') {
    entry.innerHTML = `<span class="log-critical">💥 ${message}</span>`;
  } else if (type === 'miss') {
    entry.innerHTML = `<span class="log-miss">${message}</span>`;
  } else if (type === 'heal') {
    entry.innerHTML = `<span class="log-heal">${message}</span>`;
  } else if (type === 'warn') {
    entry.innerHTML = `<span class="log-warn">${message}</span>`;
  } else {
    entry.textContent = message;
  }
  els.battleLog.prepend(entry);
  while (els.battleLog.childElementCount > 80) {
    els.battleLog.removeChild(els.battleLog.lastElementChild);
  }
}

function triggerAnimation(elementId, className) {
  const el = qs(`#${elementId}`);
  if (!el) return;
  el.classList.remove('attacking', 'defending', 'hurt', 'death-animation');
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), 600);
}

function createExplosionEffect(container) {
  const explosion = document.createElement('div');
  explosion.className = 'explosion-effect';
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement('div');
    ring.className = 'explosion-ring';
    ring.style.animationDelay = `${i * 0.1}s`;
    explosion.appendChild(ring);
  }
  container.appendChild(explosion);
  setTimeout(() => explosion.remove(), 1000);
}

function createDeathParticles(container) {
  const particlesDiv = document.createElement('div');
  particlesDiv.className = 'death-particles';
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'death-particle';
    const angle = (Math.PI * 2 * i) / 20;
    const distance = 50 + Math.random() * 100;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    particle.style.left = '50%';
    particle.style.top = '50%';
    particle.style.setProperty('--x', `${x}px`);
    particle.style.setProperty('--y', `${y}px`);
    particle.style.animationDelay = `${Math.random() * 0.3}s`;
    const colors = ['#ff6b6b', '#ff9966', '#ffb366', '#fff'];
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particlesDiv.appendChild(particle);
  }
  container.appendChild(particlesDiv);
  setTimeout(() => particlesDiv.remove(), 2000);
}

function createSoulEffect(container) {
  const soul = document.createElement('div');
  soul.className = 'soul-effect';
  soul.innerHTML = `
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r="25" fill="rgba(255,255,255,0.3)" />
      <circle cx="30" cy="30" r="15" fill="rgba(135,206,250,0.5)" />
      <circle cx="30" cy="30" r="8" fill="rgba(255,255,255,0.8)" />
    </svg>
  `;
  container.appendChild(soul);
  setTimeout(() => soul.classList.add('show'), 200);
  setTimeout(() => soul.remove(), 2500);
}

function showBattleResultBanner(victory) {
  const arena = qs('.battle-arena');
  if (!arena) return;
  const banner = document.createElement('div');
  banner.className = 'battle-result-banner';
  banner.classList.add(victory ? 'victory' : 'defeat');
  banner.textContent = victory ? 'VICTORY!' : 'DEFEAT';
  arena.appendChild(banner);
  setTimeout(() => {
    banner.style.transition = 'opacity 1s';
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 1000);
  }, 2000);
}

function triggerDeathAnimation(type) {
  const spriteId = type === 'player' ? 'playerSprite' : 'monsterSprite';
  const sprite = qs(`#${spriteId}`);
  if (!sprite) return;
  const container = sprite.parentElement;
  sprite.classList.add('death-animation');
  createExplosionEffect(container);
  createDeathParticles(container);
  if (type === 'player') {
    createSoulEffect(container);
  }
  setTimeout(() => showBattleResultBanner(type !== 'player'), 800);
}

function calculateWinProbability() {
  const playerPower = combatPower({ ...gameState.player.totalStats, hp: gameState.player.maxHp });
  const enemyPower = combatPower({ ...gameState.enemy.stats, hp: gameState.enemy.maxHp });
  const powerRatio = playerPower / Math.max(1, playerPower + enemyPower);
  const levelPenalty = Math.max(0, gameState.enemy.level - 100) * 0.0001;
  let prob = powerRatio - levelPenalty;
  prob = Math.max(0.01, Math.min(0.99, prob));
  return prob;
}

function calculateDamage(attacker, defender, isSkill = false) {
  let baseDamage = attacker.atk || attacker.stats?.atk || 100;
  if (isSkill) baseDamage *= 2;
  let isCritical = false;
  const critRate = attacker.critRate || attacker.stats?.critRate || 5;
  if (Math.random() * 100 < critRate) {
    isCritical = true;
    const critDmg = attacker.critDmg || attacker.stats?.critDmg || 150;
    baseDamage *= critDmg / 100;
  }
  const dodgeRate = defender.dodge || defender.stats?.dodge || 5;
  if (Math.random() * 100 < dodgeRate) {
    return { damage: 0, type: 'MISS' };
  }
  const defense = defender.def || defender.stats?.def || 0;
  let finalDamage = Math.max(1, baseDamage - defense * 0.5);
  if (defender.defending) {
    finalDamage *= 0.35;
    defender.defending = false;
  }
  return {
    damage: Math.floor(finalDamage),
    type: isCritical ? 'CRITICAL' : 'NORMAL'
  };
}

function updateEnemyStats(level) {
  gameState.enemy.level = level;
  const scaling = normalizeMonsterScaling(state.config?.monsterScaling);
  const difficulty = scaling.difficultyMultiplier || 1;
  const norm = Math.min(1, Math.max(0, (level - 1) / (MAX_LEVEL - 1 || 1)));
  const power = ((scaling.maxPower - scaling.basePower) * Math.pow(norm, scaling.curve || 1) + scaling.basePower) * difficulty;
  const atk = Math.max(1, Math.round(power * scaling.attackShare));
  const def = Math.max(1, Math.round(power * scaling.defenseShare));
  const hp = Math.max(level * 150, Math.round(power * scaling.hpMultiplier));
  const speed = Math.round(scaling.speedBase + (scaling.speedMax - scaling.speedBase) * Math.pow(norm, 0.7));
  const critRate = Math.min(
    scaling.critRateMax,
    scaling.critRateBase + (scaling.critRateMax - scaling.critRateBase) * Math.pow(norm, 0.9)
  );
  const critDmg = Math.min(
    scaling.critDmgMax,
    scaling.critDmgBase + (scaling.critDmgMax - scaling.critDmgBase) * Math.pow(norm, 1.05)
  );
  const dodge = Math.min(
    scaling.dodgeMax,
    scaling.dodgeBase + (scaling.dodgeMax - scaling.dodgeBase) * Math.pow(norm, 0.95)
  );
  gameState.enemy.maxHp = hp;
  gameState.enemy.hp = gameState.enemy.maxHp;
  gameState.enemy.stats = {
    atk,
    def,
    speed,
    critRate,
    critDmg,
    dodge
  };
  gameState.enemy.power = power;
  gameState.enemy.defending = false;
  if (els.enemyLevel) els.enemyLevel.textContent = String(level);
  if (els.enemyAtk) els.enemyAtk.textContent = formatNum(gameState.enemy.stats.atk);
  if (els.enemyDef) els.enemyDef.textContent = formatNum(gameState.enemy.stats.def);
  if (els.enemySpeed) els.enemySpeed.textContent = Math.round(gameState.enemy.stats.speed);
  updateMonsterImage(level);
  updateCombatPowerUI();
  updateHpBars();
}

function updateMonsterImage(level) {
  if (!els.monsterSvg) return;
  let content = '';
  if (level < 100) {
    content = `
      <ellipse cx="60" cy="60" rx="25" ry="30" fill="#7cb342" stroke="#000" />
      <circle cx="60" cy="35" r="20" fill="#8bc34a" stroke="#000" />
      <circle cx="50" cy="35" r="5" fill="#ff0000" />
      <circle cx="70" cy="35" r="5" fill="#ff0000" />
      <path d="M45 45 Q 60 50 75 45" stroke="#000" stroke-width="2" fill="none" />
      <rect x="30" y="50" width="8" height="20" fill="#7cb342" stroke="#000" />
      <rect x="82" y="50" width="8" height="20" fill="#7cb342" stroke="#000" />
    `;
  } else if (level < 300) {
    content = `
      <ellipse cx="60" cy="65" rx="30" ry="35" fill="#4a5d23" stroke="#000" stroke-width="2" />
      <ellipse cx="60" cy="35" rx="25" ry="22" fill="#5d7c2f" stroke="#000" stroke-width="2" />
      <polygon points="40,25 38,15 43,22" fill="#f5f5dc" stroke="#000" />
      <polygon points="80,25 82,15 77,22" fill="#f5f5dc" stroke="#000" />
      <ellipse cx="48" cy="35" rx="6" ry="4" fill="#ff6b6b" />
      <ellipse cx="72" cy="35" rx="6" ry="4" fill="#ff6b6b" />
    `;
  } else {
    content = `
      <ellipse cx="60" cy="70" rx="40" ry="30" fill="#8b0000" stroke="#000" stroke-width="2" />
      <polygon points="40,30 60,20 80,30 75,45 45,45" fill="#a52a2a" stroke="#000" stroke-width="2" />
      <path d="M25 60 L5 40 L10 65 L15 50 L20 70 L25 60" fill="#4b0000" stroke="#000" stroke-width="2" />
      <path d="M95 60 L115 40 L110 65 L105 50 L100 70 L95 60" fill="#4b0000" stroke="#000" stroke-width="2" />
    `;
  }
  els.monsterSvg.innerHTML = content;
}

function ensurePlayerReady() {
  computePlayerStats();
  buildEquipmentList();
  renderTotalStats();
  if (els.playerAtk) els.playerAtk.textContent = formatNum(gameState.player.totalStats.atk || 0);
  if (els.playerDef) els.playerDef.textContent = formatNum(gameState.player.totalStats.def || 0);
  if (els.playerCrit) els.playerCrit.textContent = `${Math.round(gameState.player.totalStats.critRate || 0)}%`;
  if (els.playerDodge) els.playerDodge.textContent = `${Math.round(gameState.player.totalStats.dodge || 0)}%`;
  updateResourceSummary();
  updateCombatPowerUI();
  updateHpBars();
}

function startNewBattle() {
  clearAutoNextTimer();
  clearAutoPlayerTimer();
  const level = parseInt(els.monsterLevel?.value || '1', 10) || 1;
  if (els.levelDisplay) els.levelDisplay.textContent = level;
  gameState.player.defending = false;
  gameState.player.skillCooldown = 0;
  gameState.player.hp = gameState.player.maxHp;
  gameState.enemy.defending = false;
  updateEnemyStats(level);
  gameState.battle.turn = 0;
  gameState.battle.isPlayerTurn = true;
  gameState.battle.ongoing = true;
  if (els.battleLog) els.battleLog.innerHTML = '';
  addBattleLog(`=== 레벨 ${level} 몬스터와 전투 시작! ===`);
  updateHpBars();
  updateCombatPowerUI();
  const enemyPower = combatPower({ ...gameState.enemy.stats, hp: gameState.enemy.maxHp });
  addBattleLog(`몬스터 전투력: ${formatNum(enemyPower)}`, 'warn');
  updateAutoPlayUi();
  if (gameState.battle.autoPlay && gameState.battle.isPlayerTurn) {
    queueAutoPlayerAction(500);
  }
}

function applyRewards(level, rng = Math.random) {
  if (state.user?.role === 'admin') return;
  const points = levelReward(level);
  const gold = calcGoldReward(level, rng);
  state.wallet += points;
  state.gold += gold;
  const drops = [];
  if (maybeDropItem('enhance', level)) drops.push('강화권 +1');
  if (maybeDropItem('potion', level)) drops.push('가속 물약 +1');
  if (maybeDropItem('hyperPotion', level)) drops.push('초 가속 물약 +1');
  if (maybeDropItem('protect', level)) drops.push('보호권 +1');
  if (maybeDropItem('battleRes', level)) drops.push('전투부활권 +1');
  state.profile.wallet = state.wallet;
  state.profile.gold = state.gold;
  persistItems();
  updateResourceSummary();
  queueProfileUpdate({ wallet: state.wallet, gold: state.gold });
  return { points, gold, drops };
}

function maybeDropItem(type, level) {
  const rate = dropRateForLevel(type, level);
  if (Math.random() < rate) {
    state.items[type] = (state.items[type] || 0) + 1;
    return true;
  }
  return false;
}

function consumePotion() {
  if (state.user?.role !== 'admin' && !(state.items.potion > 0)) return false;
  if (state.user?.role !== 'admin') {
    state.items.potion -= 1;
    if (state.items.potion < 0) state.items.potion = 0;
  }
  const duration = state.config?.potionSettings?.durationMs ?? DEFAULT_POTION_SETTINGS.durationMs;
  const now = Date.now();
  state.buffs.accelUntil = Math.max(state.buffs.accelUntil, now + duration);
  const potionMult = state.config?.potionSettings?.speedMultiplier ?? DEFAULT_POTION_SETTINGS.speedMultiplier ?? 2;
  state.buffs.accelMultiplier = Math.max(1, potionMult);
  addBattleLog(`가속 물약 사용! ${formatMultiplier(potionMult)}배 속도가 발동했습니다.`, 'heal');
  updateHpBars();
  updateResourceSummary();
  updateCombatPowerUI();
  persistItems();
  startBuffTicker();
  return true;
}

function consumeHyperPotion() {
  if (state.user?.role !== 'admin' && !(state.items.hyperPotion > 0)) return false;
  if (state.user?.role !== 'admin') {
    state.items.hyperPotion -= 1;
    if (state.items.hyperPotion < 0) state.items.hyperPotion = 0;
  }
  const duration = state.config?.hyperPotionSettings?.durationMs ?? DEFAULT_HYPER_POTION_SETTINGS.durationMs;
  const now = Date.now();
  state.buffs.hyperUntil = Math.max(state.buffs.hyperUntil, now + duration);
  const hyperMult = state.config?.hyperPotionSettings?.speedMultiplier ?? DEFAULT_HYPER_POTION_SETTINGS.speedMultiplier ?? 4;
  state.buffs.hyperMultiplier = Math.max(1, hyperMult);
  state.buffs.accelUntil = Math.max(state.buffs.accelUntil, state.buffs.hyperUntil);
  state.buffs.accelMultiplier = Math.max(state.buffs.accelMultiplier || 1, state.buffs.hyperMultiplier);
  addBattleLog(`초 가속 물약 사용! ${formatMultiplier(hyperMult)}배 속도가 발동했습니다.`, 'heal');
  updateCombatPowerUI();
  updateResourceSummary();
  persistItems();
  startBuffTicker();
  return true;
}

function useBattleResTicket(level, context) {
  if (!state.combat.useBattleRes) return false;
  const isAdmin = state.user?.role === 'admin';
  const current = state.items?.battleRes || 0;
  if (!isAdmin && current <= 0) return false;
  if (!isAdmin) {
    state.items.battleRes = Math.max(0, current - 1);
  }
  addBattleLog(`전투부활권이 발동되어 패배 페널티가 면제되었습니다. (${context})`, 'heal');
  if (!isAdmin && state.items.battleRes <= 0) {
    state.combat.useBattleRes = false;
    state.combat.prefBattleRes = false;
    persistCombatPreferences();
  }
  updateResourceSummary();
  persistItems();
  return true;
}

function handleVictory(level) {
  const rewards = applyRewards(level, Math.random);
  triggerDeathAnimation('monster');
  addBattleLog('=== 승리! ===', 'heal');
  if (rewards) {
    addBattleLog(`보상: +${formatNum(rewards.points)} 포인트, +${formatNum(rewards.gold)} 골드`);
    if (rewards.drops.length) {
      addBattleLog(rewards.drops.join(', '));
    }
  }
  if (gameState.battle.autoPlay) {
    scheduleNextAutoBattle('victory');
  }
}

function handleDefeat(level, context) {
  const resurrected = useBattleResTicket(level, context);
  triggerDeathAnimation('player');
  if (resurrected) {
    if (gameState.battle.autoPlay) scheduleNextAutoBattle('defeat');
    return;
  }
  addBattleLog('=== 패배... ===', 'damage');
  if (state.user?.role !== 'admin') {
    if (state.wallet > 0) {
      const loss = Math.max(1, Math.floor(state.wallet * 0.2));
      state.wallet = Math.max(0, state.wallet - loss);
      state.profile.wallet = state.wallet;
      addBattleLog(`패배 페널티: 포인트 ${formatNum(loss)} 감소`, 'damage');
    }
    queueProfileUpdate({ wallet: state.wallet });
    updateResourceSummary();
  }
  if (gameState.battle.autoPlay) {
    gameState.battle.autoPlay = false;
    clearAutoSchedules();
    updateAutoPlayUi();
    addBattleLog('자동 전투가 중지되었습니다.', 'warn');
  }
}

function concludeTurn() {
  updateHpBars();
  updateCombatPowerUI();
  if (gameState.player.hp <= 0) {
    gameState.battle.ongoing = false;
    handleDefeat(gameState.enemy.level, 'manual');
    return true;
  }
  if (gameState.enemy.hp <= 0) {
    gameState.battle.ongoing = false;
    handleVictory(gameState.enemy.level);
    return true;
  }
  return false;
}

function playerAction(action) {
  if (!gameState.battle.ongoing || !gameState.battle.isPlayerTurn) return;
  clearAutoPlayerTimer();
  gameState.player.defending = false;
  const speedMul = currentSpeedMultiplier();
  const delay = (ms) => Math.max(120, Math.round(ms / speedMul));

  const postPlayerAction = () => {
    if (gameState.player.skillCooldown > 0) {
      gameState.player.skillCooldown -= 1;
      if (gameState.player.skillCooldown < 0) gameState.player.skillCooldown = 0;
    }
    if (concludeTurn()) return;
    gameState.battle.isPlayerTurn = false;
    setTimeout(enemyAction, delay(900));
  };

  switch (action) {
    case 'attack': {
      gameState.battle.turn += 1;
      triggerAnimation('playerSprite', 'attacking');
      setTimeout(() => {
        const result = calculateDamage(gameState.player.totalStats, gameState.enemy, false);
        if (result.type === 'MISS') {
          addBattleLog('플레이어의 공격이 빗나갔습니다!', 'miss');
        } else {
          triggerAnimation('monsterSprite', 'hurt');
          gameState.enemy.hp -= result.damage;
          addBattleLog(`몬스터에게 ${formatNum(result.damage)} 피해!`, result.type === 'CRITICAL' ? 'critical' : 'damage');
        }
        postPlayerAction();
      }, delay(320));
      break;
    }
    case 'defend': {
      gameState.battle.turn += 1;
      gameState.player.defending = true;
      addBattleLog('플레이어가 방어 자세를 취했습니다.');
      setTimeout(postPlayerAction, delay(200));
      break;
    }
    case 'skill': {
      if (gameState.player.skillCooldown > 0) {
        addBattleLog(`스킬 쿨다운 ${gameState.player.skillCooldown}턴 남음`, 'warn');
        if (gameState.battle.autoPlay) {
          queueAutoPlayerAction(350);
        }
        return;
      }
      gameState.battle.turn += 1;
      triggerAnimation('playerSprite', 'attacking');
      setTimeout(() => {
        const result = calculateDamage(gameState.player.totalStats, gameState.enemy, true);
        triggerAnimation('monsterSprite', 'hurt');
        gameState.enemy.hp -= result.damage;
        addBattleLog(`필살기! ${formatNum(result.damage)} 피해!`, 'critical');
        gameState.player.skillCooldown = 3;
        postPlayerAction();
      }, delay(320));
      break;
    }
    case 'potion': {
      if (!consumePotion()) {
        addBattleLog('가속 물약이 부족합니다.', 'warn');
        return;
      }
      gameState.battle.turn += 1;
      setTimeout(postPlayerAction, delay(200));
      break;
    }
    case 'hyperPotion': {
      if (!consumeHyperPotion()) {
        addBattleLog('초 가속 물약이 부족합니다.', 'warn');
        return;
      }
      gameState.battle.turn += 1;
      setTimeout(postPlayerAction, delay(200));
      break;
    }
    default:
      break;
  }
}

function enemyAction() {
  if (!gameState.battle.ongoing) return;
  const choice = Math.random();
  gameState.enemy.defending = false;
  const speedMul = currentSpeedMultiplier();
  const delay = (ms) => Math.max(120, Math.round(ms / speedMul));
  if (choice < 0.7) {
    triggerAnimation('monsterSprite', 'attacking');
    setTimeout(() => {
      const result = calculateDamage(gameState.enemy.stats, gameState.player.totalStats, false);
      if (result.type === 'MISS') {
        addBattleLog('몬스터의 공격이 빗나갔습니다!', 'miss');
      } else {
        triggerAnimation('playerSprite', 'hurt');
        gameState.player.hp -= result.damage;
        addBattleLog(`몬스터의 공격! ${formatNum(result.damage)} 피해!`, result.type === 'CRITICAL' ? 'critical' : 'damage');
      }
      postEnemyAction();
    }, delay(320));
  } else if (choice < 0.9) {
    triggerAnimation('monsterSprite', 'attacking');
    setTimeout(() => {
      const result = calculateDamage(gameState.enemy.stats, gameState.player.totalStats, true);
      triggerAnimation('playerSprite', 'hurt');
      gameState.player.hp -= result.damage;
      addBattleLog(`몬스터의 강력한 일격! ${formatNum(result.damage)} 피해!`, 'critical');
      postEnemyAction();
    }, delay(360));
  } else {
    gameState.enemy.defending = true;
    addBattleLog('몬스터가 방어 자세를 취했습니다.');
    setTimeout(postEnemyAction, delay(220));
  }

  function postEnemyAction() {
    if (concludeTurn()) return;
    gameState.battle.isPlayerTurn = true;
    queueAutoPlayerAction(500);
  }
}

function initEventListeners() {
  els.attackBtn?.addEventListener('click', () => playerAction('attack'));
  els.defendBtn?.addEventListener('click', () => playerAction('defend'));
  els.skillBtn?.addEventListener('click', () => playerAction('skill'));
  els.potionBtn?.addEventListener('click', () => playerAction('potion'));
  els.hyperPotionBtn?.addEventListener('click', () => playerAction('hyperPotion'));
  els.newBattleBtn?.addEventListener('click', startNewBattle);
  els.generateEquipBtn?.addEventListener('click', () => {
    ensurePlayerReady();
    addBattleLog('장비 정보를 갱신했습니다.');
  });
  els.autoPlayBtn?.addEventListener('click', () => {
    gameState.battle.autoPlay = !gameState.battle.autoPlay;
    updateAutoPlayUi();
    if (gameState.battle.autoPlay) {
      if (gameState.battle.ongoing && gameState.battle.isPlayerTurn) {
        queueAutoPlayerAction(450);
      } else if (!gameState.battle.ongoing) {
        scheduleNextAutoBattle('manual');
      }
    } else {
      clearAutoSchedules();
    }
  });
  els.battleResToggle?.addEventListener('change', (e) => {
    const enabled = !!e.target.checked;
    state.combat.useBattleRes = enabled;
    state.combat.prefBattleRes = enabled;
    persistCombatPreferences();
    updateBattleResUi();
  });
  els.monsterLevel?.addEventListener('input', (e) => {
    const level = parseInt(e.target.value, 10) || 1;
    if (els.levelDisplay) els.levelDisplay.textContent = level;
    updateEnemyStats(level);
  });
  els.toGacha?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  els.logout?.addEventListener('click', async () => {
    await signOut(auth);
  });
}

function maybeApplyAutoPlayPreference() {
  gameState.battle.autoPlay = false;
  clearAutoSchedules();
  updateAutoPlayUi();
}

async function loadGlobalConfig() {
  try {
    const snapshot = await get(ref(db, GLOBAL_CONFIG_PATH));
    if (!snapshot.exists()) return null;
    const raw = snapshot.val();
    if (raw && typeof raw === 'object') {
      if (raw.config) {
        return sanitizeConfig(raw.config);
      }
      return sanitizeConfig(raw);
    }
  } catch (error) {
    console.error('전역 설정을 불러오지 못했습니다.', error);
  }
  return null;
}

async function loadOrInitializeProfile(firebaseUser) {
  const uid = firebaseUser.uid;
  const profileRef = ref(db, `users/${uid}`);
  let snapshot;
  try {
    snapshot = await get(profileRef);
  } catch (error) {
    console.error('프로필 로드 실패', error);
    throw error;
  }
  let data = snapshot.exists() ? snapshot.val() : null;
  const fallbackName = sanitizeUsername(deriveUsernameFromUser(firebaseUser), `user-${uid.slice(0, 6)}`);
  if (!data) {
    const role = fallbackName === 'admin' ? 'admin' : 'user';
    data = {
      username: fallbackName,
      role,
      wallet: role === 'admin' ? null : 1000,
      gold: role === 'admin' ? null : 10000,
      diamonds: role === 'admin' ? null : 0,
      config: null,
      globalStats: null,
      equip: null,
      spares: null,
      items: null,
      enhance: null,
      combat: { useBattleRes: true, prefBattleRes: true },
      presets: null,
      selectedPreset: null,
      pitySince: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    try {
      await set(profileRef, data);
      await set(ref(db, `usernameIndex/${fallbackName}`), uid);
    } catch (error) {
      console.error('프로필 초기화 실패', error);
      throw error;
    }
  }
  if (!data.username) {
    data.username = fallbackName;
    await update(profileRef, { username: fallbackName, updatedAt: Date.now() });
  }
  return data;
}

async function hydrateProfile(firebaseUser) {
  const rawProfile = await loadOrInitializeProfile(firebaseUser);
  const globalConfig = await loadGlobalConfig();
  const fallbackName = sanitizeUsername(rawProfile.username, deriveUsernameFromUser(firebaseUser));
  const role = rawProfile.role === 'admin' || fallbackName === 'admin' ? 'admin' : 'user';
  state.user = {
    uid: firebaseUser.uid,
    username: fallbackName,
    role,
    email: firebaseUser.email || ''
  };
  state.items = sanitizeItems(rawProfile.items);
  state.equip = sanitizeEquipMap(rawProfile.equip);
  state.enhance = sanitizeEnhanceConfig(rawProfile.enhance);
  state.wallet = role === 'admin' ? Number.POSITIVE_INFINITY : clampNumber(rawProfile.wallet, 0, Number.MAX_SAFE_INTEGER, 1000);
  state.gold = role === 'admin' ? Number.POSITIVE_INFINITY : clampNumber(rawProfile.gold, 0, Number.MAX_SAFE_INTEGER, 10000);
  state.combat = {
    useBattleRes: rawProfile.combat?.useBattleRes !== false,
    prefBattleRes: rawProfile.combat?.prefBattleRes !== false
  };
  if (role !== 'admin' && (state.items?.battleRes || 0) <= 0) {
    state.combat.useBattleRes = false;
  }
  state.buffs = { accelUntil: 0, accelMultiplier: 1, hyperUntil: 0, hyperMultiplier: 1 };
  state.profile = {
    ...rawProfile,
    username: fallbackName,
    role,
    items: state.items,
    equip: state.equip,
    enhance: state.enhance,
    wallet: state.wallet,
    gold: state.gold,
    combat: { ...state.combat }
  };
  const personalConfig = sanitizeConfig(rawProfile.config);
  state.config = role === 'admin' && globalConfig ? globalConfig : personalConfig;
  ensurePlayerReady();
  updateEnemyStats(parseInt(els.monsterLevel?.value || '1', 10) || 1);
  updateResourceSummary();
  updateBattleResUi();
  updateAutoPlayUi();
  startBuffTicker();
  if (els.whoami) els.whoami.textContent = `${fallbackName} (${role === 'admin' ? '관리자' : '회원'})`;
}

function attachAuthListener() {
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      window.location.href = 'login.html';
      return;
    }
    try {
      await hydrateProfile(firebaseUser);
      maybeApplyAutoPlayPreference();
      startNewBattle();
    } catch (error) {
      console.error('전투 페이지 초기화 실패', error);
      addBattleLog('프로필을 불러오는 중 오류가 발생했습니다.', 'damage');
    }
  });
}

(function init() {
  initEventListeners();
  attachAuthListener();
})();
