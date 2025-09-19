// Shared combat utilities used by battle and PVP pages.
export const TIERS = ['SSS+', 'SS+', 'S+', 'S', 'A', 'B', 'C', 'D'];
export const TIER_INDEX = Object.fromEntries(TIERS.map((tier, idx) => [tier, idx]));

export const PART_DEFS = [
  { key: 'head', name: '투구', type: 'def' },
  { key: 'body', name: '갑옷', type: 'def' },
  { key: 'main', name: '주무기', type: 'atk' },
  { key: 'off', name: '보조무기', type: 'atk' },
  { key: 'boots', name: '신발', type: 'def' }
];
export const PART_KEYS = PART_DEFS.map((part) => part.key);
export const PART_ICONS = { head: '🪖', body: '🛡️', main: '⚔️', off: '🗡️', boots: '🥾' };

export const DEFAULT_DROP_RATES = {
  potion: { base: 0.04, perLevel: 0.000045, max: 0.25 },
  hyperPotion: { base: 0.01, perLevel: 0.00005, max: 0.12 },
  protect: { base: 0.02, perLevel: 0.00003, max: 0.18 },
  enhance: { base: 0.75, perLevel: 0.0002, max: 1.0 },
  battleRes: { base: 0.01, perLevel: 0.00002, max: 0.08 }
};
export const DEFAULT_GOLD_SCALING = { minLow: 120, maxLow: 250, minHigh: 900, maxHigh: 1400 };
export const DEFAULT_POTION_SETTINGS = { durationMs: 60000, manualCdMs: 1000, autoCdMs: 2000, speedMultiplier: 2 };
export const DEFAULT_HYPER_POTION_SETTINGS = { durationMs: 60000, manualCdMs: 200, autoCdMs: 200, speedMultiplier: 4 };
export const DEFAULT_MONSTER_SCALING = {
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
export const DEFAULT_SHOP_PRICES = {
  potion: 500,
  hyperPotion: 2000,
  protect: 1200,
  enhance: 800,
  battleRes: 2000,
  starterPack: 5000
};

export function clampNumber(value, min, max, fallback) {
  if (typeof value !== 'number' || !isFinite(value)) return fallback;
  let n = Math.floor(value);
  if (typeof min === 'number' && n < min) n = min;
  if (typeof max === 'number' && n > max) n = max;
  return n;
}

export function defaultEnhance() {
  const multipliers = [
    1,
    1.1,
    1.1990,
    1.2949,
    1.3856,
    1.4687,
    1.5421,
    1.6192,
    1.6840,
    1.7514,
    1.8039,
    1.8580,
    1.9138,
    1.9616,
    2.0107,
    2.0609,
    2.1021,
    2.1442,
    3.0,
    5.0,
    12.0
  ];
  const probs = [
    0,
    0.99,
    0.97,
    0.95,
    0.92,
    0.9,
    0.8,
    0.7,
    0.6,
    0.5,
    0.45,
    0.35,
    0.3,
    0.25,
    0.2,
    0.15,
    0.05,
    0.04,
    0.03,
    0.02,
    0.01
  ];
  return { multipliers, probs };
}

export function sanitizeEquipItem(raw) {
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

export function sanitizeEquipMap(raw) {
  const result = { head: null, body: null, main: null, off: null, boots: null };
  if (raw && typeof raw === 'object') {
    PART_KEYS.forEach((key) => {
      result[key] = sanitizeEquipItem(raw[key]);
    });
  }
  return result;
}

export const PET_IDS = ['pet_ant', 'pet_deer', 'pet_goat', 'pet_tiger', 'pet_horang'];

export const PET_DEFS = {
  pet_ant: {
    id: 'pet_ant',
    name: '사막 개미 수호병',
    icon: '🐜',
    passive: {
      flat: { def: 320, hp: 900 },
      pct: { def: 0.08 }
    },
    active: {
      type: 'shield',
      chance: 0.32,
      amountPct: 0.12,
      maxPct: 0.3,
      message: '보호막을 전개해 피해를 흡수합니다.'
    }
  },
  pet_deer: {
    id: 'pet_deer',
    name: '서리 숲 순록',
    icon: '🦌',
    passive: {
      flat: { hp: 700, dodge: 4 },
      pct: { hp: 0.05 }
    },
    active: {
      type: 'heal',
      chance: 0.28,
      amountPct: 0.09,
      message: '자연의 힘으로 체력을 회복합니다.'
    }
  },
  pet_goat: {
    id: 'pet_goat',
    name: '화염 산양왕',
    icon: '🐐',
    passive: {
      flat: { atk: 220, critDmg: 12 }
    },
    active: {
      type: 'attackBuff',
      chance: 0.22,
      attackPct: 0.18,
      critRateBonus: 5,
      message: '염화의 격노로 공격력이 상승합니다.'
    }
  },
  pet_tiger: {
    id: 'pet_tiger',
    name: '호령의 그림자',
    icon: '🐅',
    passive: {
      flat: { atk: 260, speed: 10, critRate: 4 }
    },
    active: {
      type: 'strike',
      chance: 0.18,
      ratio: 0.28,
      minDamage: 150,
      message: '그림자 일격으로 선제 피해를 가합니다.'
    }
  },
  pet_horang: {
    id: 'pet_horang',
    name: '호랭찡',
    icon: '🐯',
    passive: {
      flat: { atk: 420, def: 320, hp: 2400 },
      pct: { atk: 0.08, def: 0.08 }
    },
    active: {
      type: 'tigerLegend',
      killChance: 0.05,
      blockChance: 0.15,
      reflectChance: 0.05,
      message: '5% 즉사, 15% 전방위 방어, 5% 피해 반사'
    }
  }
};

export function getPetDefinition(petId) {
  if (!petId) return null;
  return PET_DEFS[petId] || null;
}

export function createDefaultPetState() {
  const owned = {};
  PET_IDS.forEach((id) => {
    owned[id] = 0;
  });
  return { owned, active: null, pity: 0 };
}

export function sanitizePetState(raw) {
  const state = createDefaultPetState();
  if (raw && typeof raw === 'object') {
    if (raw.owned && typeof raw.owned === 'object') {
      PET_IDS.forEach((petId) => {
        state.owned[petId] = clampNumber(raw.owned[petId], 0, Number.MAX_SAFE_INTEGER, 0);
      });
    }
    if (typeof raw.active === 'string' && PET_IDS.includes(raw.active)) {
      state.active = raw.active;
    }
    state.pity = clampNumber(raw.pity, 0, Number.MAX_SAFE_INTEGER, 0);
  }
  return state;
}

export function sanitizePetWeights(raw) {
  const defaults = {};
  PET_IDS.forEach((petId) => {
    defaults[petId] = 1;
  });
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }
  const weights = { ...defaults };
  PET_IDS.forEach((petId) => {
    const value = raw[petId];
    if (typeof value === 'number' && isFinite(value) && value >= 0) {
      weights[petId] = value;
    }
  });
  return weights;
}

const PET_STAT_LABELS = {
  atk: '공격력',
  def: '방어력',
  hp: '체력',
  critRate: '크리티컬 확률',
  critDmg: '크리티컬 피해',
  dodge: '회피',
  speed: '속도'
};

export function sanitizeItems(raw) {
  const template = { potion: 0, hyperPotion: 0, protect: 0, enhance: 0, revive: 0, battleRes: 0, petTicket: 0 };
  const result = { ...template };
  if (raw && typeof raw === 'object') {
    Object.keys(template).forEach((key) => {
      result[key] = clampNumber(raw[key], 0, Number.MAX_SAFE_INTEGER, 0);
    });
  }
  return result;
}

export function sanitizeEnhanceConfig(raw) {
  const base = defaultEnhance();
  if (!raw || typeof raw !== 'object') return base;

  const validMultipliers = Array.isArray(raw.multipliers) && raw.multipliers.length >= 21 && typeof raw.multipliers[20] === 'number' && raw.multipliers[20] <= 12.0001;
  if (validMultipliers) {
    base.multipliers = base.multipliers.map((def, idx) => {
      const val = raw.multipliers[idx];
      return typeof val === 'number' && isFinite(val) && val > 0 ? val : def;
    });
  }

  const validProbs = Array.isArray(raw.probs) && raw.probs.length >= 21;
  if (validProbs) {
    base.probs = base.probs.map((def, idx) => {
      const val = raw.probs[idx];
      if (typeof val === 'number' && isFinite(val) && val >= 0 && val <= 1) {
        return val;
      }
      return def;
    });
  }

  return base;
}

function cloneDropRates(src) {
  return JSON.parse(JSON.stringify(src || DEFAULT_DROP_RATES));
}

export function normalizeDropRates(raw) {
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

export function normalizeGoldScaling(raw) {
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

export function normalizePotionSettings(raw, defaults) {
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

export function normalizeMonsterScaling(raw) {
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

export function sanitizeConfig(raw) {
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
  const config = {
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
  config.petWeights = sanitizePetWeights(raw && raw.petWeights);
  return config;
}

export function formatNum(value, locale = 'ko-KR') {
  return Number(value || 0).toLocaleString(locale);
}

export function formatMultiplier(value) {
  const rounded = Math.round((value ?? 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
}

function formatPassiveSegments(passive = {}) {
  const segments = [];
  const flat = passive.flat || {};
  Object.entries(flat).forEach(([key, value]) => {
    if (!(typeof value === 'number' && isFinite(value) && value !== 0)) return;
    const label = PET_STAT_LABELS[key] || key.toUpperCase();
    segments.push(`${label} +${formatNum(value)}`);
  });
  const pct = passive.pct || {};
  Object.entries(pct).forEach(([key, value]) => {
    if (!(typeof value === 'number' && isFinite(value) && value !== 0)) return;
    const label = PET_STAT_LABELS[key] || key.toUpperCase();
    const percent = Math.round(value * 1000) / 10;
    segments.push(`${label} +${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`);
  });
  return segments;
}

export function describePetAbilities(pet) {
  if (!pet) return { passive: '', active: '' };
  const passiveSegments = formatPassiveSegments(pet.passive);
  const passive = passiveSegments.length ? `패시브: ${passiveSegments.join(', ')}` : '';
  let active = '';
  if (pet.active) {
    const chance = typeof pet.active.chance === 'number' && pet.active.chance > 0 ? `${(Math.round(pet.active.chance * 1000) / 10).toFixed(pet.active.chance * 100 % 1 === 0 ? 0 : 1)}%` : '';
    const message = pet.active.message || '';
    if (message && chance) {
      active = `발동(${chance}): ${message}`;
    } else if (message) {
      active = `발동: ${message}`;
    } else if (chance) {
      active = `발동 확률 ${chance}`;
    }
  }
  return { passive, active };
}

export const TIER_VALUE = {
  'SSS+': 6,
  'SS+': 5,
  'S+': 4,
  S: 3,
  A: 2,
  B: 1.2,
  C: 0.8,
  D: 0.4
};

export function tierScore(tier) {
  return TIER_VALUE[tier] || 1;
}

export function effectiveStat(item, enhance = defaultEnhance()) {
  if (!item) return 0;
  const multipliers = enhance?.multipliers || defaultEnhance().multipliers;
  const lvl = item.lvl || 0;
  const mul = multipliers[lvl] || 1;
  return Math.floor((item.base || 0) * mul);
}

function applyPetPassive(stats, passive) {
  if (!passive) return;
  const flat = passive.flat || {};
  Object.entries(flat).forEach(([key, value]) => {
    if (typeof value !== 'number' || !isFinite(value)) return;
    if (typeof stats[key] !== 'number') stats[key] = 0;
    stats[key] += value;
  });
  const pct = passive.pct || {};
  Object.entries(pct).forEach(([key, value]) => {
    if (typeof value !== 'number' || !isFinite(value)) return;
    if (typeof stats[key] !== 'number') stats[key] = 0;
    stats[key] += stats[key] * value;
  });
}

export function computePlayerStats(equipMap, enhanceConfig, baseStats = {}, activePet = null) {
  const stats = {
    atk: 0,
    def: 0,
    hp: 5000,
    critRate: 5,
    critDmg: 150,
    dodge: 5,
    speed: 100,
    ...baseStats
  };
  const equipment = [];
  const enhance = enhanceConfig || defaultEnhance();
  PART_DEFS.forEach((def) => {
    const item = equipMap ? equipMap[def.key] : null;
    if (!item) return;
    const eff = effectiveStat(item, enhance);
    const score = tierScore(item.tier);
    equipment.push({ ...item, effective: eff });
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
  const petDef = typeof activePet === 'string' ? getPetDefinition(activePet) : activePet || null;
  if (petDef?.passive) {
    applyPetPassive(stats, petDef.passive);
  }
  stats.critRate = Math.min(90, stats.critRate);
  stats.critDmg = Math.min(400, stats.critDmg);
  stats.dodge = Math.min(60, stats.dodge);
  stats.hp = Math.max(1, stats.hp);
  stats.speed = Math.max(1, stats.speed);
  stats.atk = Math.max(1, stats.atk);
  stats.def = Math.max(0, stats.def);
  return { stats, equipment, pet: petDef || null };
}

export function combatPower(stats) {
  const critFactor = ((stats.critRate || 0) * (stats.critDmg || 100)) / 100;
  const dodgeFactor = (stats.dodge || 0) * 20;
  const speedFactor = (stats.speed || 100) * 2;
  return Math.floor((stats.atk || 0) + (stats.def || 0) * 2 + (stats.hp || 0) / 10 + critFactor + dodgeFactor + speedFactor);
}

export function calculateDamage(attacker, defender, isSkill = false, rng = Math.random) {
  let baseDamage = attacker.atk || attacker.stats?.atk || 100;
  if (isSkill) baseDamage *= 2;
  let isCritical = false;
  const critRate = attacker.critRate || attacker.stats?.critRate || 5;
  if (rng() * 100 < critRate) {
    isCritical = true;
    const critDmg = attacker.critDmg || attacker.stats?.critDmg || 150;
    baseDamage *= critDmg / 100;
  }
  const dodgeRate = defender.dodge || defender.stats?.dodge || 5;
  if (rng() * 100 < dodgeRate) {
    return { damage: 0, type: 'MISS' };
  }
  const defense = defender.def || defender.stats?.def || 0;
  let finalDamage = Math.max(1, baseDamage - defense * 0.5);
  if (defender.defending) {
    finalDamage *= 0.35;
    defender.defending = false;
  }
  return { damage: Math.floor(finalDamage), type: isCritical ? 'CRITICAL' : 'NORMAL' };
}

function createCombatant(config) {
  const name = config.displayName || config.name || 'Unknown';
  const stats = { ...config.stats };
  const maxHp = Math.max(1, stats.hp || 1);
  return {
    uid: config.uid || null,
    name,
    stats,
    maxHp,
    hp: maxHp,
    defending: false,
    skillCooldown: 0,
    combat: config.combat || { autoPotion: false, autoHyper: false }
  };
}

function decideAutoAction(combatant, rng) {
  if (combatant.skillCooldown <= 0 && rng() < 0.32) return 'skill';
  if (rng() < 0.18) return 'defend';
  return 'attack';
}

export function simulateTurnBattle({ player, opponent, rng = Math.random, maxTurns = 200 } = {}) {
  const actorA = createCombatant(player);
  const actorB = createCombatant(opponent);
  const logs = [];
  let attacker = actorA;
  let defender = actorB;
  let turn = 1;

  const runAction = (actor, target, action) => {
    switch (action) {
      case 'defend':
        actor.defending = true;
        logs.push(`[턴 ${turn}] ${actor.name}이(가) 방어 자세를 취했습니다.`);
        break;
      case 'skill':
      case 'attack': {
        const isSkill = action === 'skill';
        const result = calculateDamage(actor.stats, target, isSkill, rng);
        if (result.type === 'MISS') {
          logs.push(`[턴 ${turn}] ${actor.name}의 공격이 빗나갔습니다.`);
        } else {
          target.hp -= result.damage;
          const label = isSkill ? '필살기! ' : '';
          const critLabel = result.type === 'CRITICAL' ? ' 크리티컬!' : '';
          logs.push(
            `[턴 ${turn}] ${actor.name} ${label}-> ${target.name}: ${formatNum(result.damage)} 피해${critLabel}`
          );
        }
        if (isSkill) {
          actor.skillCooldown = 3;
        }
        break;
      }
      default:
        break;
    }
    if (actor.skillCooldown > 0) {
      actor.skillCooldown -= 1;
    }
  };

  while (attacker.hp > 0 && defender.hp > 0 && turn <= maxTurns) {
    const action = decideAutoAction(attacker, rng);
    runAction(attacker, defender, action);
    if (defender.hp <= 0) break;
    [attacker, defender] = [defender, attacker];
    turn += 1;
  }

  let winner = null;
  let loser = null;
  if (actorA.hp <= 0 && actorB.hp <= 0) {
    logs.push('전투가 무승부로 종료되었습니다.');
  } else if (actorA.hp <= 0) {
    winner = actorB;
    loser = actorA;
    logs.push(`${winner.name} 승리!`);
  } else if (actorB.hp <= 0) {
    winner = actorA;
    loser = actorB;
    logs.push(`${winner.name} 승리!`);
  } else {
    logs.push('턴 제한으로 전투가 무승부로 종료되었습니다.');
  }

  return {
    logs,
    winner: winner
      ? { uid: winner.uid, name: winner.name, stats: { ...winner.stats }, remainingHp: Math.max(0, Math.floor(winner.hp)) }
      : null,
    loser: loser
      ? { uid: loser.uid, name: loser.name, stats: { ...loser.stats }, remainingHp: Math.max(0, Math.floor(loser.hp)) }
      : null,
    turns: turn,
    remaining: { A: Math.max(0, Math.floor(actorA.hp)), B: Math.max(0, Math.floor(actorB.hp)) }
  };
}
