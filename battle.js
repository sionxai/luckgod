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
import {
  PART_DEFS,
  PART_ICONS,
  DEFAULT_DROP_RATES,
  DEFAULT_POTION_SETTINGS,
  DEFAULT_HYPER_POTION_SETTINGS,
  DEFAULT_MONSTER_SCALING,
  clampNumber,
  sanitizeEquipMap,
  sanitizeItems,
  sanitizeEnhanceConfig,
  normalizeGoldScaling,
  normalizeMonsterScaling,
  sanitizeConfig,
  formatNum,
  formatMultiplier,
  computePlayerStats as derivePlayerStats,
  combatPower,
  calculateDamage,
  PET_IDS,
  createDefaultPetState,
  sanitizePetState,
  getPetDefinition,
  describePetAbilities
} from './combat-core.js';

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  whoami: qs('#whoamiBattle'),
  points: qs('#pointsBattle'),
  gold: qs('#goldBattle'),
  petTickets: qs('#petTicketBattle'),
  toGacha: qs('#toGacha'),
  toPvp: qs('#toPvp'),
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
  hyperPotionBtn: qs('#hyperPotionBtn'),
  newBattleBtn: qs('#newBattleBtn'),
  generateEquipBtn: qs('#generateEquipBtn'),
  autoPlayBtn: qs('#autoPlayBtn'),
  monsterLevel: qs('#monsterLevel'),
  levelDisplay: qs('#levelDisplay'),
  monsterLevelMinus: qs('#monsterLevelMinus'),
  monsterLevelPlus: qs('#monsterLevelPlus'),
  monsterLevelInput: qs('#monsterLevelInput'),
  skillCooldownView: qs('#skillCooldownView'),
  potionStock: qs('#potionStock'),
  hyperPotionStock: qs('#hyperPotionStock'),
  battleResToggle: qs('#battleResToggle'),
  autoPotionToggle: qs('#autoPotionToggle'),
  autoHyperToggle: qs('#autoHyperToggle'),
  battleResCount: qs('#battleResCount'),
  battleResInline: qs('#battleResInline'),
  speedStatus: qs('#speedStatus'),
  autoStatsPanel: qs('#autoStatsPanel'),
  autoStatsBattles: qs('#autoStatsBattles'),
  autoStatsPoints: qs('#autoStatsPoints'),
  autoStatsGold: qs('#autoStatsGold'),
  autoStatsEnhance: qs('#autoStatsEnhance'),
  autoStatsPotion: qs('#autoStatsPotion'),
  autoStatsHyperPotion: qs('#autoStatsHyperPotion'),
  autoStatsProtect: qs('#autoStatsProtect'),
  autoStatsBattleRes: qs('#autoStatsBattleRes'),
  bossList: qs('#bossList'),
  startBossBtn: qs('#startBossBtn'),
  resetBossSelection: qs('#resetBossSelection'),
  bossInfo: qs('#bossInfo')
};

const MAX_LEVEL = 999;
const GLOBAL_CONFIG_PATH = 'config/global';
const AUTO_DROP_KEYS = ['enhance', 'potion', 'hyperPotion', 'protect', 'battleRes'];
const AUTO_DROP_LABELS = {
  enhance: '강화권',
  potion: '가속 물약',
  hyperPotion: '초 가속 물약',
  protect: '보호권',
  battleRes: '전투부활권'
};
const AUTO_STOP_REASON_LABELS = {
  manual: '사용자 중지',
  defeat: '패배',
  boss: '보스 도전',
  other: '중지'
};
const BOSS_IDS = ['boss150', 'boss300', 'boss450', 'boss550', 'boss800'];

const BOSS_UNLOCK_LEVELS = {
  boss150: 200,
  boss300: 400,
  boss450: 600,
  boss550: 800,
  boss800: 900
};

const BOSS_CONFIG = {
  boss150: {
    id: 'boss150',
    level: 150,
    title: 'Lv.150 — 「해무의 도깨비 장수」',
    name: '해무의 도깨비 장수',
    stats: { hpScale: 6.5, atkScale: 1.2, defScale: 1.1 },
    drop: { firstTicket: 1, chance: 0.2 },
    summary: '연속 회피와 긴급 회복 패턴 대응'
  },
  boss300: {
    id: 'boss300',
    level: 300,
    title: 'Lv.300 — 「녹우 수호자」',
    name: '녹우 수호자',
    stats: { hpScale: 8, atkScale: 1.25, defScale: 1.2 },
    drop: { firstTicket: 1, chance: 0.28 },
    summary: '청동피갑 반사와 우레각인을 주의'
  },
  boss450: {
    id: 'boss450',
    level: 450,
    title: 'Lv.450 — 「염풍 산양왕」',
    name: '염풍 산양왕',
    stats: { hpScale: 9, atkScale: 1.35, defScale: 1.25 },
    drop: { firstTicket: 1, chance: 0.35 },
    summary: '모래눈보라와 갑옷파쇄에 대비'
  },
  boss550: {
    id: 'boss550',
    level: 550,
    title: 'Lv.550 — 「사막의 여왕 개미」',
    name: '사막의 여왕 개미',
    stats: { hpScale: 10, atkScale: 1.4, defScale: 1.3 },
    drop: { firstTicket: 1, chance: 0.42 },
    summary: '병정 소환과 왕실 코쿤으로 장기전 양상'
  },
  boss800: {
    id: 'boss800',
    level: 800,
    title: 'Lv.800 — 「호랑의 그림자」',
    name: '호랑의 그림자',
    stats: { hpScale: 12, atkScale: 1.55, defScale: 1.35 },
    drop: { firstTicket: 1, chance: 0.55 },
    summary: '무적과 반격 스택을 관리해야 합니다'
  }
};

const BOSS_BEHAVIORS = {
  boss150: {
    name: '해무 회복',
    chance: 0.35,
    cooldown: 2,
    execute: ({ state }) => {
      const healAmount = Math.max(1, Math.round(gameState.enemy.maxHp * 0.12));
      return {
        animation: 'attacking',
        delay: 320,
        pre() {
          addBattleLog('[보스] 해무의 장수가 안개를 두르고 기력을 회복합니다.', 'warn');
        },
        post() {
          const before = gameState.enemy.hp;
          gameState.enemy.hp = Math.min(gameState.enemy.maxHp, gameState.enemy.hp + healAmount);
          const healed = Math.max(0, gameState.enemy.hp - before);
          if (healed > 0) {
            addBattleLog(`[보스 스킬] 해무 회복! ${formatNum(healed)} 체력 회복`, 'heal');
          }
          applyBossDodgeBuff(state, 18, 2);
        }
      };
    }
  },
  boss300: {
    name: '우레각인',
    chance: 0.3,
    cooldown: 3,
    execute: ({ state }) => {
      return {
        animation: 'attacking',
        delay: 360,
        pre() {
          addBattleLog('[보스] 청동피갑이 번쩍이며 우레각인이 발동됩니다!', 'warn');
        },
        post() {
          const result = calculateDamage(gameState.enemy.stats, gameState.player.totalStats, true);
          let damage = result.damage;
          if (!damage || result.type === 'MISS') {
            damage = Math.max(1, Math.round(gameState.enemy.stats.atk * 1.6));
          }
          triggerAnimation('playerSprite', 'hurt');
          const dealt = applyDamageToPlayer(damage, { source: 'bossSkill', critical: true });
          addBattleLog(`[보스 스킬] 우레각인! ${formatNum(dealt)} 피해`, 'critical');
          state.reflectHits = Math.max(state.reflectHits || 0, 2);
          state.reflectRatio = Math.max(state.reflectRatio || 0.25, 0.25);
          addBattleLog('[보스] 청동피갑 반격이 활성화됐습니다. (2회)', 'warn');
        }
      };
    }
  },
  boss450: {
    name: '모래눈보라',
    chance: 0.28,
    cooldown: 3,
    execute: ({ state }) => {
      return {
        animation: 'attacking',
        delay: 360,
        pre() {
          addBattleLog('[보스] 모래눈보라가 몰아치며 갑옷 파쇄를 준비합니다!', 'warn');
        },
        post() {
          const result = calculateDamage(gameState.enemy.stats, gameState.player.totalStats, true);
          let damage = result.damage;
          const crit = result.type === 'CRITICAL';
          if (!damage || result.type === 'MISS') {
            damage = Math.max(1, Math.round(gameState.enemy.stats.atk * 1.45));
          }
          triggerAnimation('playerSprite', 'hurt');
          const dealt = applyDamageToPlayer(damage, { source: 'bossSkill', critical: crit });
          addBattleLog(`[보스 스킬] 모래눈보라! ${formatNum(dealt)} 피해`, 'critical');
          applyPlayerArmorBreak(state, 0.2, 2);
        }
      };
    }
  },
  boss550: {
    name: '왕실 코쿤',
    chance: 0.26,
    cooldown: 4,
    execute: ({ state }) => {
      return {
        animation: 'attacking',
        delay: 300,
        pre() {
          addBattleLog('[보스] 여왕 개미가 왕실 코쿤을 전개합니다!', 'warn');
        },
        post() {
          const shieldValue = Math.max(1, Math.round(gameState.enemy.maxHp * 0.18));
          applyBossShield(state, shieldValue, 3);
        }
      };
    }
  },
  boss800: {
    name: '그림자 포효',
    chance: 0.24,
    cooldown: 4,
    execute: ({ state }) => {
      return {
        animation: 'attacking',
        delay: 380,
        pre() {
          addBattleLog('[보스] 호랑의 그림자가 응축되어 폭발합니다!', 'warn');
        },
        post() {
          const baseDamage = Math.max(1, Math.round(gameState.enemy.stats.atk * 2.2));
          triggerAnimation('playerSprite', 'hurt');
          const dealt = applyDamageToPlayer(baseDamage, { source: 'bossSkill', critical: true });
          addBattleLog(`[보스 스킬] 그림자 포효! ${formatNum(dealt)} 피해`, 'critical');
          applyBossEnrage(state, { atkBonusPct: 0.3, speedBonus: 12, turns: 2 });
          state.reflectHits = Math.max(state.reflectHits || 0, 1);
          state.reflectRatio = Math.max(state.reflectRatio || 0.35, 0.35);
          addBattleLog('[보스] 반격 자세! 다음 공격 시 강력한 반격이 가해집니다.', 'warn');
        }
      };
    }
  }
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
  combat: { useBattleRes: true, prefBattleRes: true, autoPotion: false, autoHyper: false },
  saveTimer: null,
  pendingUpdates: {},
  buffs: { accelUntil: 0, accelMultiplier: 1, hyperUntil: 0, hyperMultiplier: 1 },
  autoNextTimer: null,
  autoPlayerTimer: null,
  buffTicker: null,
  autoStats: {
    active: false,
    battles: 0,
    points: 0,
    gold: 0,
    drops: { enhance: 0, potion: 0, hyperPotion: 0, protect: 0, battleRes: 0 },
    startTime: 0
  },
  bossProgress: sanitizeBossProgress(null),
  battleProgress: sanitizeBattleProgress(null),
  pets: createDefaultPetState(),
  selectedBossId: null,
  lastNormalLevel: 1
};

const gameState = {
  player: {
    hp: 0,
    maxHp: 0,
    equipment: [],
    totalStats: {},
    defending: false,
    skillCooldown: 0,
    activePet: null,
    petShield: 0,
    petAttackBonus: 0,
    petAttackMultiplier: 1,
    petCritBonus: 0
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
    autoPlay: false,
    lastLevel: 1,
    actionLock: false,
    bossFight: null
  }
};
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

function sanitizeBossProgress(raw) {
  const progress = {};
  BOSS_IDS.forEach((id) => {
    const entry = raw && typeof raw === 'object' ? raw[id] : null;
    progress[id] = {
      clears: clampNumber(entry?.clears, 0, Number.MAX_SAFE_INTEGER, 0),
      firstRewardClaimed: !!(entry && entry.firstRewardClaimed)
    };
  });
  return progress;
}

function sanitizeBattleProgress(raw) {
  const progress = { highestLevel: 1 };
  if (raw && typeof raw === 'object') {
    progress.highestLevel = clampNumber(raw.highestLevel, 1, MAX_LEVEL, 1);
  }
  return progress;
}

function getHighestClearedLevel() {
  if (state.user?.role === 'admin') return MAX_LEVEL;
  return clampNumber(state.battleProgress?.highestLevel, 1, MAX_LEVEL, 1);
}

function registerLevelClear(level) {
  const lvl = clampMonsterLevel(level);
  if (!state.battleProgress) state.battleProgress = sanitizeBattleProgress(null);
  if (lvl <= (state.battleProgress.highestLevel || 1)) return;
  state.battleProgress.highestLevel = lvl;
  if (state.profile) {
    state.profile.battleProgress = { ...state.battleProgress };
  }
  queueProfileUpdate({ battleProgress: { ...state.battleProgress } });
  updateBossUi();
}

function bossUnlockRequirement(bossId) {
  if (!bossId) return null;
  return typeof BOSS_UNLOCK_LEVELS[bossId] === 'number' ? BOSS_UNLOCK_LEVELS[bossId] : null;
}

function isBossUnlocked(bossId) {
  if (!bossId || !BOSS_IDS.includes(bossId)) return false;
  if (state.user?.role === 'admin') return true;
  const required = bossUnlockRequirement(bossId);
  if (!required) return true;
  return getHighestClearedLevel() >= required;
}

function getBossConfig(bossId) {
  if (!bossId) return null;
  return BOSS_CONFIG[bossId] || null;
}

function getBossProgress(bossId) {
  if (!bossId) return null;
  const entry = state.bossProgress?.[bossId];
  if (entry) return entry;
  state.bossProgress[bossId] = { clears: 0, firstRewardClaimed: false };
  return state.bossProgress[bossId];
}

function ensureBossState(bossContext) {
  if (!bossContext) return null;
  if (!bossContext.state) {
    bossContext.state = {
      skillCooldown: 0,
      dodgeBuffTurns: 0,
      dodgeBonusApplied: 0,
      armorBreakTurns: 0,
      armorBreakPenalty: 0,
      shieldHp: 0,
      shieldTurns: 0,
      reflectHits: 0,
      reflectRatio: 0,
      enrageTurns: 0,
      enrageAtkBonus: 0,
      enrageSpeedBonus: 0
    };
  }
  return bossContext.state;
}

function applyBossDodgeBuff(state, bonus, turns) {
  if (!state) return;
  removeBossDodgeBuff(state, true);
  const amount = Math.max(0, Math.round(bonus || 0));
  const duration = Math.max(0, Math.floor(turns || 0));
  if (amount <= 0 || duration <= 0) return;
  state.dodgeBuffTurns = duration;
  state.dodgeBonusApplied = amount;
  gameState.enemy.stats.dodge = Math.max(0, (gameState.enemy.stats.dodge || 0) + amount);
  addBattleLog(`[보스] 회피율이 ${formatNum(amount)}% 상승했습니다. (${duration}턴)`, 'warn');
  updateCombatPowerUI();
}

function removeBossDodgeBuff(state, silent = false) {
  if (!state) return;
  if (state.dodgeBonusApplied) {
    gameState.enemy.stats.dodge = Math.max(0, (gameState.enemy.stats.dodge || 0) - state.dodgeBonusApplied);
    state.dodgeBonusApplied = 0;
    if (!silent) addBattleLog('[보스] 회피 버프가 사라졌습니다.', 'warn');
    updateCombatPowerUI();
  }
  state.dodgeBuffTurns = 0;
}

function applyPlayerArmorBreak(state, percent, turns) {
  if (!state) return;
  removePlayerArmorBreak(state, true);
  const baseDef = gameState.player.totalStats.def || 0;
  const ratio = Math.max(0, Math.min(1, percent || 0));
  const penalty = Math.max(0, Math.round(baseDef * ratio));
  const duration = Math.max(0, Math.floor(turns || 0));
  if (penalty <= 0 || duration <= 0) return;
  state.armorBreakTurns = duration;
  state.armorBreakPenalty = penalty;
  gameState.player.totalStats.def = Math.max(0, baseDef - penalty);
  addBattleLog(`[보스] 방어력이 ${formatNum(penalty)} 감소했습니다. (${duration}턴)`, 'damage');
  renderTotalStats();
  updateCombatPowerUI();
}

function removePlayerArmorBreak(state, silent = false) {
  if (!state) return;
  if (state.armorBreakPenalty) {
    gameState.player.totalStats.def = Math.max(0, gameState.player.totalStats.def + state.armorBreakPenalty);
    state.armorBreakPenalty = 0;
    renderTotalStats();
    updateCombatPowerUI();
    if (!silent) addBattleLog('플레이어의 방어력 저하 효과가 해제되었습니다.', 'heal');
  }
  state.armorBreakTurns = 0;
}

function applyBossShield(state, shieldValue, turns) {
  if (!state) return;
  const amount = Math.max(0, Math.round(shieldValue || 0));
  const duration = Math.max(0, Math.floor(turns || 0));
  if (amount <= 0 || duration <= 0) return;
  state.shieldHp = Math.min(gameState.enemy.maxHp, (state.shieldHp || 0) + amount);
  state.shieldTurns = duration;
  addBattleLog(`[보스] 보호막 ${formatNum(amount)} 생성! (총 ${formatNum(state.shieldHp)} 유지)`, 'warn');
}

function applyBossEnrage(state, { atkBonusPct = 0, speedBonus = 0, turns = 0 } = {}) {
  if (!state) return;
  removeBossEnrage(state, true);
  const baseAtk = gameState.enemy.stats.atk || 0;
  const atkBonus = Math.max(0, Math.round(baseAtk * Math.max(0, atkBonusPct)));
  const speedAdd = Math.max(0, Math.round(speedBonus || 0));
  const duration = Math.max(0, Math.floor(turns || 0));
  if ((atkBonus <= 0 && speedAdd <= 0) || duration <= 0) return;
  state.enrageTurns = duration;
  state.enrageAtkBonus = atkBonus;
  state.enrageSpeedBonus = speedAdd;
  if (atkBonus > 0) gameState.enemy.stats.atk += atkBonus;
  if (speedAdd > 0) gameState.enemy.stats.speed = (gameState.enemy.stats.speed || 0) + speedAdd;
  addBattleLog(`[보스] 공격력 +${formatNum(atkBonus)} / 속도 +${formatNum(speedAdd)} 증가! (${duration}턴)`, 'warn');
  updateCombatPowerUI();
}

function removeBossEnrage(state, silent = false) {
  if (!state) return;
  let changed = false;
  if (state.enrageAtkBonus) {
    gameState.enemy.stats.atk = Math.max(1, gameState.enemy.stats.atk - state.enrageAtkBonus);
    state.enrageAtkBonus = 0;
    changed = true;
  }
  if (state.enrageSpeedBonus) {
    gameState.enemy.stats.speed = Math.max(1, (gameState.enemy.stats.speed || 0) - state.enrageSpeedBonus);
    state.enrageSpeedBonus = 0;
    changed = true;
  }
  state.enrageTurns = 0;
  if (changed) {
    if (!silent) addBattleLog('[보스] 분노 효과가 사라졌습니다.', 'warn');
    updateCombatPowerUI();
  }
}

function tickBossStateBeforeAction(bossContext) {
  if (!bossContext) return null;
  const state = ensureBossState(bossContext);
  if (state.skillCooldown > 0) {
    state.skillCooldown -= 1;
    if (state.skillCooldown < 0) state.skillCooldown = 0;
  }
  if (state.dodgeBuffTurns > 0) {
    state.dodgeBuffTurns -= 1;
    if (state.dodgeBuffTurns <= 0 && state.dodgeBonusApplied) {
      removeBossDodgeBuff(state);
    }
  }
  if (state.armorBreakTurns > 0) {
    state.armorBreakTurns -= 1;
    if (state.armorBreakTurns <= 0) {
      removePlayerArmorBreak(state);
    }
  }
  if (state.enrageTurns > 0) {
    state.enrageTurns -= 1;
    if (state.enrageTurns <= 0) {
      removeBossEnrage(state);
    }
  }
  if (state.shieldTurns > 0) {
    state.shieldTurns -= 1;
    if (state.shieldTurns <= 0 && state.shieldHp > 0) {
      state.shieldHp = 0;
      addBattleLog('[보스] 보호막이 사라졌습니다.', 'warn');
    }
  }
  return state;
}

function maybeExecuteBossSkill(bossContext, delayFn, postAction) {
  if (!bossContext) return false;
  const behavior = BOSS_BEHAVIORS[bossContext.id];
  if (!behavior) return false;
  const state = ensureBossState(bossContext);
  if (state.skillCooldown > 0) {
    return false;
  }
  const chance = Math.max(0, Math.min(1, behavior.chance ?? 0));
  if (Math.random() > chance) return false;
  const action = behavior.execute({ state, boss: bossContext });
  if (!action) return false;
  state.skillCooldown = Math.max(1, behavior.cooldown || 1);
  if (typeof action.pre === 'function') action.pre();
  const animation = action.animation === null ? null : action.animation || 'attacking';
  if (animation) {
    triggerAnimation('monsterSprite', animation);
  }
  const delayMs = typeof action.delay === 'number' ? action.delay : 360;
  setTimeout(() => {
    if (typeof action.post === 'function') action.post();
    updateHpBars();
    updateCombatPowerUI();
    postAction();
  }, delayFn(delayMs));
  return true;
}

function clearBossStateEffects(bossContext) {
  if (!bossContext?.state) return;
  const state = bossContext.state;
  removeBossDodgeBuff(state, true);
  removePlayerArmorBreak(state, true);
  removeBossEnrage(state, true);
  state.reflectHits = 0;
  state.reflectRatio = 0;
  state.shieldHp = 0;
  state.shieldTurns = 0;
  state.skillCooldown = 0;
}

function setBossControlsDisabled(disabled) {
  const controls = [
    els.monsterLevel,
    els.monsterLevelInput,
    els.monsterLevelMinus,
    els.monsterLevelPlus,
    els.newBattleBtn
  ].filter(Boolean);
  controls.forEach((control) => {
    control.disabled = !!disabled;
  });
}

function updateBossUi() {
  if (state.selectedBossId && !isBossUnlocked(state.selectedBossId)) {
    state.selectedBossId = null;
  }

  if (els.bossList) {
    const buttons = Array.from(els.bossList.querySelectorAll('.boss-btn'));
    buttons.forEach((btn) => {
      const bossId = btn?.dataset?.boss;
      if (!bossId) return;
      const progress = getBossProgress(bossId);
      const unlocked = isBossUnlocked(bossId);
      const requirement = bossUnlockRequirement(bossId);
      btn.classList.toggle('active', unlocked && bossId === state.selectedBossId);
      btn.classList.toggle('locked', !unlocked);
      btn.dataset.clears = String(progress?.clears || 0);
      btn.dataset.first = progress?.firstRewardClaimed ? '1' : '0';
      btn.dataset.locked = unlocked ? '0' : '1';
      btn.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      if (requirement) {
        btn.setAttribute(
          'title',
          unlocked
            ? `레벨 ${formatNum(requirement)} 몬스터 처치로 해금 완료`
            : `레벨 ${formatNum(requirement)} 몬스터 처치 시 해금`
        );
      } else {
        btn.removeAttribute('title');
      }
    });
  }

  const boss = getBossConfig(state.selectedBossId);
  const bossInBattle = !!(gameState.battle.bossFight && gameState.battle.ongoing);
  if (els.startBossBtn) {
    if (!boss) {
      els.startBossBtn.disabled = true;
      els.startBossBtn.textContent = '보스 도전';
      els.startBossBtn.removeAttribute('title');
    } else if (!isBossUnlocked(boss.id) && state.user?.role !== 'admin') {
      const requirement = bossUnlockRequirement(boss.id);
      const requiredLabel = requirement ? `레벨 ${formatNum(requirement)} 클리어 필요` : '해금 필요';
      els.startBossBtn.disabled = true;
      els.startBossBtn.textContent = requiredLabel;
      els.startBossBtn.title = requiredLabel;
    } else if (bossInBattle) {
      els.startBossBtn.disabled = true;
      els.startBossBtn.textContent = '전투 진행중...';
      els.startBossBtn.removeAttribute('title');
    } else {
      const firstRewardPending = !getBossProgress(boss.id)?.firstRewardClaimed;
      els.startBossBtn.disabled = false;
      els.startBossBtn.textContent = firstRewardPending ? '보스 도전 (첫 보상 보장)' : '보스 도전';
      const requirement = bossUnlockRequirement(boss.id);
      if (requirement) {
        els.startBossBtn.title = `레벨 ${formatNum(requirement)} 몬스터 처치로 해금됨`;
      } else {
        els.startBossBtn.removeAttribute('title');
      }
    }
  }
  if (els.resetBossSelection) {
    els.resetBossSelection.disabled = !boss || bossInBattle;
  }
  if (els.bossInfo) {
    if (!boss) {
      els.bossInfo.textContent = '도전할 보스를 선택하세요.';
    } else {
      const progress = getBossProgress(boss.id) || { clears: 0, firstRewardClaimed: false };
      const drop = boss.drop || {};
      const chance = Math.max(0, Math.min(1, drop.chance || 0));
      const chancePercent = Math.round(chance * 1000) / 10;
      const firstRewardCount = drop.firstTicket || 0;
      const requirement = bossUnlockRequirement(boss.id);
      const unlocked = isBossUnlocked(boss.id) || state.user?.role === 'admin';
      const highest = getHighestClearedLevel();
      const firstRewardLabel = progress.firstRewardClaimed
        ? '첫 보상 수령 완료'
        : `첫 처치 ${firstRewardCount}장 보장`;
      const clearsLabel = progress.clears ? `${formatNum(progress.clears)}회 클리어` : '클리어 기록 없음';
      const requirementLabel = requirement
        ? state.user?.role === 'admin'
          ? `해금 조건: 레벨 ${formatNum(requirement)} (관리자 해금)`
          : unlocked
            ? `해금 조건: 레벨 ${formatNum(requirement)} (달성)`
            : `해금 조건: 레벨 ${formatNum(requirement)} (현재 ${formatNum(highest)})`
        : '';
      const parts = [boss.title, requirementLabel, firstRewardLabel, `일반 드랍 ${chancePercent}%`, clearsLabel];
      els.bossInfo.textContent = parts.filter(Boolean).join(' · ');
      if (!unlocked && requirement) {
        const remaining = Math.max(0, requirement - highest);
        if (remaining > 0) {
          els.bossInfo.textContent += ` · ${formatNum(remaining)}레벨 더 필요`;
        }
      }
    }
  }
}

function setBossSelection(bossId) {
  if (!bossId || !BOSS_IDS.includes(bossId)) {
    state.selectedBossId = null;
    updateBossUi();
    return;
  }
  if (!isBossUnlocked(bossId) && state.user?.role !== 'admin') {
    const requirement = bossUnlockRequirement(bossId);
    const highest = getHighestClearedLevel();
    const boss = getBossConfig(bossId);
    if (els.bossInfo) {
      const title = boss?.title || '보스';
      const reqLabel = requirement
        ? `해금 조건: 레벨 ${formatNum(requirement)} (현재 ${formatNum(highest)})`
        : '해금 조건 미지정';
      els.bossInfo.textContent = `${title} · ${reqLabel}`;
    }
    addBattleLog(
      requirement
        ? `[보스] 레벨 ${formatNum(requirement)} 몬스터를 처치해야 도전 가능합니다.`
        : '[보스] 아직 도전할 수 없습니다.',
      'warn'
    );
    updateBossUi();
    return;
  }
  state.selectedBossId = bossId;
  updateBossUi();
}

function resetBossSelection() {
  if (gameState.battle.ongoing && gameState.battle.bossFight) return;
  state.selectedBossId = null;
  updateBossUi();
}

function applyBossScaling(boss) {
  if (!boss) return;
  const { stats } = boss;
  if (stats?.hpScale && stats.hpScale !== 1) {
    gameState.enemy.maxHp = Math.round(gameState.enemy.maxHp * stats.hpScale);
    gameState.enemy.hp = gameState.enemy.maxHp;
  }
  if (stats?.atkScale && stats.atkScale !== 1) {
    gameState.enemy.stats.atk = Math.round(gameState.enemy.stats.atk * stats.atkScale);
  }
  if (stats?.defScale && stats.defScale !== 1) {
    gameState.enemy.stats.def = Math.round(gameState.enemy.stats.def * stats.defScale);
  }
  if (els.enemyAtk) els.enemyAtk.textContent = formatNum(gameState.enemy.stats.atk);
  if (els.enemyDef) els.enemyDef.textContent = formatNum(gameState.enemy.stats.def);
  updateCombatPowerUI();
  updateHpBars();
}

function endBossEncounter(result = 'neutral') {
  const bossContext = gameState.battle.bossFight;
  if (!bossContext) {
    updateBossUi();
    return;
  }
  clearBossStateEffects(bossContext);
  gameState.battle.bossFight = null;
  setBossControlsDisabled(false);
  updateBossUi();
  const restoreLevel = clampMonsterLevel(state.lastNormalLevel || 1);
  updateMonsterLevelUI(restoreLevel);
  updateEnemyStats(restoreLevel);
}

function applyBossRewards(bossContext, rng = Math.random) {
  if (!bossContext) return null;
  const boss = bossContext.config || getBossConfig(bossContext.id);
  if (!boss) return null;
  const progress = getBossProgress(boss.id);
  progress.clears += 1;
  const isAdmin = state.user?.role === 'admin';
  const drop = boss.drop || {};
  const result = {
    bossId: boss.id,
    clears: progress.clears,
    firstRewardGranted: false,
    extraRewardGranted: false,
    tickets: 0
  };
  if (!progress.firstRewardClaimed) {
    progress.firstRewardClaimed = true;
    if (!isAdmin && (drop.firstTicket || 0) > 0) {
      result.firstRewardGranted = true;
      result.tickets += drop.firstTicket;
    }
  }
  const chance = Math.max(0, Math.min(1, drop.chance || 0));
  if (!isAdmin && chance > 0 && rng() < chance) {
    result.extraRewardGranted = true;
    result.tickets += 1;
  }
  if (!isAdmin && result.tickets > 0) {
    state.items.petTicket = (state.items.petTicket || 0) + result.tickets;
    persistItems();
    updateResourceSummary();
  }
  state.profile.bossProgress = JSON.parse(JSON.stringify(state.bossProgress));
  queueProfileUpdate({ bossProgress: state.bossProgress });
  updateBossUi();
  return result;
}

function startBossBattle() {
  const boss = getBossConfig(state.selectedBossId);
  if (!boss) return;
  if (!isBossUnlocked(boss.id) && state.user?.role !== 'admin') {
    const requirement = bossUnlockRequirement(boss.id);
    addBattleLog(
      requirement
        ? `[보스] 레벨 ${formatNum(requirement)} 몬스터를 처치해야 합니다.`
        : '[보스] 아직 도전할 수 없습니다.',
      'warn'
    );
    updateBossUi();
    return;
  }
  if (gameState.battle.bossFight) {
    addBattleLog('이미 보스 전투가 진행 중입니다.', 'warn');
    return;
  }
  if (gameState.battle.ongoing) {
    forceEndCurrentBattle('boss');
  }
  const currentLevel = clampMonsterLevel(els.monsterLevelInput?.value || els.monsterLevel?.value || state.lastNormalLevel || 1);
  state.lastNormalLevel = currentLevel;
  clearAutoSchedules();
  if (els.battleLog) els.battleLog.innerHTML = '';
  setBossControlsDisabled(true);
  updateBossUi();
  resetPetCombatState();
  updateMonsterLevelUI(boss.level);
  updateEnemyStats(boss.level);
  applyBossScaling(boss);
  gameState.battle.bossFight = { id: boss.id, level: boss.level, config: boss };
  ensureBossState(gameState.battle.bossFight);
  updateBossUi();
  gameState.battle.ongoing = true;
  gameState.battle.actionLock = false;
  gameState.player.defending = false;
  gameState.player.skillCooldown = 0;
  gameState.player.hp = gameState.player.maxHp;
  gameState.enemy.defending = false;
  gameState.battle.turn = 0;
  addBattleLog(`=== 보스 ${boss.name}과의 전투 시작! ===`, 'warn');
  const drop = boss.drop || {};
  if (drop.firstTicket) {
    addBattleLog(`첫 처치 보상: 펫 뽑기권 ${formatNum(drop.firstTicket)}장 보장`, 'warn');
  }
  if (drop.chance) {
    addBattleLog(`추가 드랍 확률: ${(Math.round(drop.chance * 1000) / 10).toFixed(1)}%`, 'warn');
  }
  updateHpBars();
  updateCombatPowerUI();
  beginPlayerTurn('battleStart');
}

function activePetDefinition() {
  if (!state.pets || !state.pets.active) return null;
  return getPetDefinition(state.pets.active);
}

function resetPetCombatState() {
  gameState.player.petShield = 0;
  gameState.player.petAttackBonus = 0;
  gameState.player.petAttackMultiplier = 1;
  gameState.player.petCritBonus = 0;
}

function getPlayerOffensiveStats() {
  const base = { ...gameState.player.totalStats };
  if (gameState.player.petAttackMultiplier && gameState.player.petAttackMultiplier !== 1) {
    base.atk = Math.max(1, Math.round(base.atk * gameState.player.petAttackMultiplier));
  }
  if (gameState.player.petAttackBonus) {
    base.atk = Math.max(1, base.atk + Math.round(gameState.player.petAttackBonus));
  }
  if (gameState.player.petCritBonus) {
    base.critRate = Math.min(100, (base.critRate || 0) + gameState.player.petCritBonus);
  }
  return base;
}

function applyDamageToPlayer(amount, options = {}) {
  let remaining = Math.max(0, Math.round(amount || 0));
  if (remaining <= 0) return 0;
  if (gameState.player.petShield > 0) {
    const absorbed = Math.min(gameState.player.petShield, remaining);
    gameState.player.petShield -= absorbed;
    remaining -= absorbed;
    if (absorbed > 0) {
      addBattleLog(`[펫] 보호막이 ${formatNum(absorbed)} 피해를 흡수했습니다.`, 'heal');
    }
  }
  if (remaining <= 0) return 0;
  gameState.player.hp -= remaining;
  return remaining;
}

function applyDamageToEnemy(amount, message = '') {
  let incoming = Math.max(0, Math.round(amount || 0));
  if (incoming <= 0) return 0;
  const bossContext = gameState.battle.bossFight;
  const state = bossContext ? ensureBossState(bossContext) : null;
  if (state?.shieldHp > 0) {
    const absorbed = Math.min(incoming, state.shieldHp);
    if (absorbed > 0) {
      state.shieldHp -= absorbed;
      incoming -= absorbed;
      addBattleLog(`[보스] 보호막이 ${formatNum(absorbed)} 피해를 흡수했습니다.`, 'warn');
      if (state.shieldHp <= 0) {
        state.shieldHp = 0;
        addBattleLog('[보스] 보호막이 붕괴되었습니다!', 'damage');
      }
    }
  }
  const actual = Math.min(incoming, Math.max(0, Math.round(gameState.enemy.hp)));
  gameState.enemy.hp = Math.max(0, gameState.enemy.hp - actual);
  triggerAnimation('monsterSprite', 'hurt');
  const damageLabel = actual > 0 ? formatNum(actual) : '0';
  if (message !== null) {
    if (message) {
      addBattleLog(message.replace('{dmg}', damageLabel), actual > 0 ? 'damage' : 'warn');
    } else if (actual > 0) {
      addBattleLog(`펫의 공격이 ${formatNum(actual)} 피해를 입혔습니다.`, 'damage');
    } else {
      addBattleLog('펫의 공격이 보호막에 모두 흡수되었습니다.', 'warn');
    }
  }
  if (state && state.reflectHits > 0 && actual > 0) {
    const ratio = Math.max(0.05, Math.min(1, state.reflectRatio || 0));
    const reflected = Math.max(1, Math.round(actual * ratio));
    state.reflectHits -= 1;
    if (state.reflectHits < 0) state.reflectHits = 0;
    const tag = bossContext.id === 'boss800' ? '그림자 반격' : '청동피갑 반격';
    addBattleLog(`[보스] ${tag}! ${formatNum(reflected)} 피해 반사`, 'damage');
    applyDamageToPlayer(reflected, { source: 'reflect', critical: false });
    if (state.reflectHits <= 0) {
      addBattleLog('[보스] 반격 효과가 종료되었습니다.', 'warn');
    } else {
      addBattleLog(`[보스] 반격 ${formatNum(state.reflectHits)}회 남음`, 'warn');
    }
  }
  updateHpBars();
  return actual;
}

function handlePetTurnStart() {
  const pet = activePetDefinition();
  gameState.player.petAttackMultiplier = 1;
  gameState.player.petAttackBonus = 0;
  gameState.player.petCritBonus = 0;
  if (!pet || !pet.active) return;
  const { active } = pet;
  const chance = typeof active.chance === 'number' ? active.chance : 0;
  if (!(chance > 0) || Math.random() > chance) return;
  switch (active.type) {
    case 'shield': {
      const maxHp = Math.max(1, gameState.player.maxHp || 1);
      const amountPct = Math.max(0, active.amountPct || 0);
      const gained = Math.round(maxHp * amountPct);
      if (gained <= 0) break;
      const capPct = Math.max(0.1, Math.min(1, active.maxPct || 0.4));
      const maxShield = Math.round(maxHp * capPct);
      gameState.player.petShield = Math.min(maxShield, gameState.player.petShield + gained);
      const total = gameState.player.petShield;
      addBattleLog(`[펫] ${pet.name} 보호막 발동! +${formatNum(gained)} (총 ${formatNum(total)})`, 'heal');
      break;
    }
    case 'heal': {
      const maxHp = Math.max(1, gameState.player.maxHp || 1);
      const amountPct = Math.max(0, active.amountPct || 0);
      const heal = Math.max(1, Math.round(maxHp * amountPct));
      const before = gameState.player.hp;
      gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + heal);
      const actual = Math.max(0, Math.round(gameState.player.hp - before));
      if (actual > 0) {
        addBattleLog(`[펫] ${pet.name}이(가) ${formatNum(actual)} 체력을 회복시켰습니다.`, 'heal');
      }
      break;
    }
    case 'attackBuff': {
      const atkPct = Math.max(0, active.attackPct || 0);
      const critBonus = Math.max(0, active.critRateBonus || 0);
      const atkBonus = Math.max(0, active.attackFlat || 0);
      gameState.player.petAttackMultiplier = 1 + atkPct;
      gameState.player.petAttackBonus = atkBonus;
      gameState.player.petCritBonus = critBonus;
      addBattleLog(`[펫] ${pet.name}의 격노! 공격력이 상승했습니다.`, 'heal');
      break;
    }
    case 'strike': {
      const ratio = Math.max(0, active.ratio || 0);
      const baseAtk = gameState.player.totalStats.atk || 0;
      const minDamage = Math.max(0, active.minDamage || 0);
      const damage = Math.max(minDamage, Math.round(baseAtk * ratio));
      if (damage > 0) {
        applyDamageToEnemy(damage, `[펫] ${pet.name}의 그림자 일격! {dmg} 피해`);
      }
      break;
    }
    default:
      break;
  }
}

function computePlayerStats() {
  const petDef = activePetDefinition();
  const { stats, equipment } = derivePlayerStats(state.equip || {}, state.enhance, {}, petDef);
  const previousHp = gameState.player.hp;
  gameState.player.equipment = equipment;
  const prevPetId = gameState.player.activePet?.id || null;
  gameState.player.totalStats = stats;
  if ((petDef?.id || null) !== prevPetId) {
    resetPetCombatState();
  }
  gameState.player.activePet = petDef || null;
  gameState.player.maxHp = stats.hp;
  if (!previousHp) {
    gameState.player.hp = stats.hp;
  } else {
    gameState.player.hp = Math.min(previousHp, stats.hp);
  }
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
  if (els.petTickets) els.petTickets.textContent = state.user?.role === 'admin' ? '∞' : formatNum(state.items?.petTicket || 0);
  if (els.potionStock) els.potionStock.textContent = formatNum(state.items?.potion || 0);
  if (els.hyperPotionStock) els.hyperPotionStock.textContent = formatNum(state.items?.hyperPotion || 0);
  updateBattleResUi();
  updateAutoConsumableUi();
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

function updateAutoConsumableUi() {
  const isAdmin = state.user?.role === 'admin';
  const potionStock = state.items?.potion || 0;
  const hyperStock = state.items?.hyperPotion || 0;
  if (els.autoPotionToggle) {
    const disabled = !isAdmin && potionStock <= 0;
    els.autoPotionToggle.checked = !!state.combat.autoPotion;
    els.autoPotionToggle.disabled = disabled;
    els.autoPotionToggle.title = disabled ? '가속 물약이 부족합니다.' : '';
  }
  if (els.autoHyperToggle) {
    const disabled = !isAdmin && hyperStock <= 0;
    els.autoHyperToggle.checked = !!state.combat.autoHyper;
    els.autoHyperToggle.disabled = disabled;
    els.autoHyperToggle.title = disabled ? '초 가속 물약이 부족합니다.' : '';
  }
}

function snapshotItems() {
  return {
    potion: state.items?.potion || 0,
    hyperPotion: state.items?.hyperPotion || 0,
    protect: state.items?.protect || 0,
    enhance: state.items?.enhance || 0,
    revive: state.items?.revive || 0,
    battleRes: state.items?.battleRes || 0,
    petTicket: state.items?.petTicket || 0
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
    prefBattleRes: state.combat.prefBattleRes !== false,
    autoPotion: !!state.combat.autoPotion,
    autoHyper: !!state.combat.autoHyper
  };
  state.profile.combat = { ...combatPayload };
  queueProfileUpdate({ combat: combatPayload });
}

function buildEquipmentList() {
  if (!els.playerEquipment) return;
  els.playerEquipment.innerHTML = '';
  const pet = gameState.player.activePet || activePetDefinition();
  if (pet) {
    const slot = document.createElement('div');
    slot.className = 'equipment-slot pet-slot';
    const header = document.createElement('div');
    header.className = 'equipment-name';
    header.innerHTML = `<span>${pet.icon || '🐾'} <span class="tier-S">펫</span></span><span>${pet.name}</span>`;
    slot.appendChild(header);
    const ability = describePetAbilities(pet);
    const abilityText = [ability.passive, ability.active].filter(Boolean).join('<br />');
    if (abilityText) {
      const abilityEl = document.createElement('div');
      abilityEl.className = 'equipment-stats pet-ability';
      abilityEl.innerHTML = abilityText;
      slot.appendChild(abilityEl);
    }
    els.playerEquipment.appendChild(slot);
  }
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

function forceEndCurrentBattle(reason = 'manual') {
  if (!gameState.battle.ongoing) return;
  gameState.battle.ongoing = false;
  gameState.battle.actionLock = false;
  clearAutoSchedules();
  if (gameState.battle.autoPlay) {
    gameState.battle.autoPlay = false;
    updateAutoPlayUi();
    if (state.autoStats.active) {
      endAutoStatsSession(reason === 'boss' ? 'boss' : 'manual');
    }
  }
  gameState.player.defending = false;
  gameState.enemy.defending = false;
  gameState.player.skillCooldown = 0;
  if (gameState.battle.bossFight) {
    clearBossStateEffects(gameState.battle.bossFight);
    if (reason !== 'boss') {
      gameState.battle.bossFight = null;
      updateBossUi();
    }
  }
  updateHpBars();
  if (reason === 'boss') {
    addBattleLog('보스 전에 기존 전투를 종료했습니다.', 'warn');
  }
}

function resetAutoStatsValues() {
  state.autoStats.battles = 0;
  state.autoStats.points = 0;
  state.autoStats.gold = 0;
  state.autoStats.startTime = 0;
  const drops = {};
  AUTO_DROP_KEYS.forEach((key) => {
    drops[key] = 0;
  });
  state.autoStats.drops = drops;
}

function updateAutoStatsUi() {
  if (!els.autoStatsPanel) return;
  const stats = state.autoStats;
  els.autoStatsPanel.style.display = stats.active ? 'block' : 'none';
  if (els.autoStatsBattles) els.autoStatsBattles.textContent = formatNum(stats.battles || 0);
  if (els.autoStatsPoints) els.autoStatsPoints.textContent = formatNum(stats.points || 0);
  if (els.autoStatsGold) els.autoStatsGold.textContent = formatNum(stats.gold || 0);
  const dropElements = {
    enhance: els.autoStatsEnhance,
    potion: els.autoStatsPotion,
    hyperPotion: els.autoStatsHyperPotion,
    protect: els.autoStatsProtect,
    battleRes: els.autoStatsBattleRes
  };
  AUTO_DROP_KEYS.forEach((key) => {
    const el = dropElements[key];
    if (el) el.textContent = formatNum(stats.drops?.[key] || 0);
  });
}

function startAutoStatsSession() {
  if (state.autoStats.active) return;
  resetAutoStatsValues();
  state.autoStats.active = true;
  state.autoStats.startTime = Date.now();
  updateAutoStatsUi();
}

function recordAutoStats(rewards = {}) {
  if (!state.autoStats.active) return;
  state.autoStats.battles += 1;
  state.autoStats.points += rewards.points || 0;
  state.autoStats.gold += rewards.gold || 0;
  const dropCounts = rewards.dropCounts || {};
  AUTO_DROP_KEYS.forEach((key) => {
    const gain = dropCounts[key] || 0;
    if (!state.autoStats.drops[key]) state.autoStats.drops[key] = 0;
    state.autoStats.drops[key] += gain;
  });
  updateAutoStatsUi();
}

function endAutoStatsSession(reason = 'manual') {
  if (!state.autoStats.active) return;
  const summary = {
    battles: state.autoStats.battles,
    points: state.autoStats.points,
    gold: state.autoStats.gold,
    drops: { ...state.autoStats.drops },
    startTime: state.autoStats.startTime
  };
  state.autoStats.active = false;
  const durationMs = summary.startTime ? Date.now() - summary.startTime : 0;
  const durationSec = durationMs > 0 ? Math.round(durationMs / 1000) : 0;
  const reasonLabel = AUTO_STOP_REASON_LABELS[reason] || AUTO_STOP_REASON_LABELS.other;
  const hasDrops = AUTO_DROP_KEYS.some((key) => summary.drops[key] > 0);
  if (summary.battles > 0 || summary.points > 0 || summary.gold > 0 || hasDrops) {
    let line = `[자동전투 종료] ${reasonLabel} · 전투 ${formatNum(summary.battles)}회`;
    if (durationSec > 0) {
      const minutes = Math.floor(durationSec / 60);
      const seconds = durationSec % 60;
      const durationText = minutes ? `${minutes}분 ${seconds}초` : `${seconds}초`;
      line += ` · ${durationText}`;
    }
    addBattleLog(line, 'warn');
    addBattleLog(`획득 포인트: +${formatNum(summary.points)}, 골드: +${formatNum(summary.gold)}`);
    if (hasDrops) {
      const dropDetails = AUTO_DROP_KEYS.filter((key) => summary.drops[key] > 0).map(
        (key) => `${AUTO_DROP_LABELS[key]} ${formatNum(summary.drops[key])}개`
      );
      addBattleLog(`획득 아이템: ${dropDetails.join(', ')}`, 'ok');
    }
  } else {
    addBattleLog(`자동 전투가 종료되었습니다 (${reasonLabel}). 획득한 보상이 없습니다.`, 'warn');
  }
  resetAutoStatsValues();
  updateAutoStatsUi();
}

function hasItemStock(type) {
  if (state.user?.role === 'admin') return true;
  return (state.items?.[type] || 0) > 0;
}

function isHyperActive(now = Date.now()) {
  return state.buffs.hyperUntil > now;
}

function isAccelActive(now = Date.now()) {
  return state.buffs.accelUntil > now;
}

function shouldAutoUseHyper(now = Date.now()) {
  if (!state.combat.autoHyper) return false;
  if (isHyperActive(now)) return false;
  return hasItemStock('hyperPotion');
}

function shouldAutoUsePotion(now = Date.now()) {
  if (!state.combat.autoPotion) return false;
  if (isHyperActive(now)) return false;
  if (isAccelActive(now)) return false;
  return hasItemStock('potion');
}

function pickAutoAction() {
  const now = Date.now();
  if (shouldAutoUseHyper(now)) return 'hyperPotion';
  if (shouldAutoUsePotion(now)) return 'potion';
  if (gameState.player.skillCooldown <= 0 && Math.random() < 0.32) return 'skill';
  if (Math.random() < 0.18) return 'defend';
  return 'attack';
}

function queueAutoPlayerAction(delayMs = 500) {
  clearAutoPlayerTimer();
  if (!gameState.battle.autoPlay || !gameState.battle.ongoing || !gameState.battle.isPlayerTurn) return;
  const delay = Math.max(150, Math.round(delayMs / currentSpeedMultiplier()));
  state.autoPlayerTimer = setTimeout(() => {
    state.autoPlayerTimer = null;
    if (!gameState.battle.autoPlay || !gameState.battle.ongoing || !gameState.battle.isPlayerTurn) return;
    const action = pickAutoAction();
    playerAction(action);
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

function beginPlayerTurn(context = 'default') {
  if (!gameState.battle.ongoing) return;
  gameState.battle.isPlayerTurn = true;
  gameState.battle.actionLock = false;
  gameState.player.defending = false;
  handlePetTurnStart();
  updateHpBars();
  updateCombatPowerUI();
  if (gameState.player.hp <= 0 || gameState.enemy.hp <= 0) {
    if (concludeTurn()) return;
  }
  if (gameState.battle.autoPlay) {
    const initialDelay = context === 'battleStart' ? 500 : 350;
    queueAutoPlayerAction(initialDelay);
  }
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

function clampMonsterLevel(value) {
  let lvl = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(lvl)) lvl = 1;
  lvl = Math.floor(lvl);
  if (lvl < 1) lvl = 1;
  if (lvl > MAX_LEVEL) lvl = MAX_LEVEL;
  return lvl;
}

function updateMonsterLevelUI(level) {
  const lvl = clampMonsterLevel(level);
  if (els.monsterLevel) els.monsterLevel.value = String(lvl);
  if (els.monsterLevelInput) els.monsterLevelInput.value = String(lvl);
  if (els.levelDisplay) els.levelDisplay.textContent = lvl;
  return lvl;
}

function updateEnemyStats(level) {
  const lvl = updateMonsterLevelUI(level);
  gameState.enemy.level = lvl;
  const scaling = normalizeMonsterScaling(state.config?.monsterScaling);
  const difficulty = scaling.difficultyMultiplier || 1;
  const norm = Math.min(1, Math.max(0, (lvl - 1) / (MAX_LEVEL - 1 || 1)));
  const basePower = Math.max(1, scaling.basePower || DEFAULT_MONSTER_SCALING.basePower);
  const maxPower = Math.max(basePower, scaling.maxPower || DEFAULT_MONSTER_SCALING.maxPower);
  const power = ((maxPower - basePower) * Math.pow(norm, scaling.curve || 1) + basePower) * difficulty;
  const atkShare = scaling.attackShare || DEFAULT_MONSTER_SCALING.attackShare;
  const defShare = scaling.defenseShare || DEFAULT_MONSTER_SCALING.defenseShare;
  const atk = Math.max(1, Math.round(power * atkShare));
  const def = Math.max(1, Math.round(power * defShare));
  const hp = Math.max(lvl * 150, Math.round(power * (scaling.hpMultiplier || DEFAULT_MONSTER_SCALING.hpMultiplier)));
  const speedBase = scaling.speedBase || DEFAULT_MONSTER_SCALING.speedBase;
  const speedMax = Math.max(speedBase, scaling.speedMax || DEFAULT_MONSTER_SCALING.speedMax);
  const speed = Math.round(speedBase + (speedMax - speedBase) * Math.pow(norm, 0.7));
  const critRateBase = scaling.critRateBase || DEFAULT_MONSTER_SCALING.critRateBase;
  const critRateMax = Math.max(critRateBase, scaling.critRateMax || DEFAULT_MONSTER_SCALING.critRateMax);
  const critRate = Math.min(critRateMax, critRateBase + (critRateMax - critRateBase) * Math.pow(norm, 0.9));
  const critDmgBase = scaling.critDmgBase || DEFAULT_MONSTER_SCALING.critDmgBase;
  const critDmgMax = Math.max(critDmgBase, scaling.critDmgMax || DEFAULT_MONSTER_SCALING.critDmgMax);
  const critDmg = Math.min(critDmgMax, critDmgBase + (critDmgMax - critDmgBase) * Math.pow(norm, 1.05));
  const dodgeBase = scaling.dodgeBase || DEFAULT_MONSTER_SCALING.dodgeBase;
  const dodgeMax = Math.max(dodgeBase, scaling.dodgeMax || DEFAULT_MONSTER_SCALING.dodgeMax);
  const dodge = Math.min(dodgeMax, dodgeBase + (dodgeMax - dodgeBase) * Math.pow(norm, 0.95));
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
  gameState.battle.lastLevel = lvl;
  gameState.enemy.defending = false;
  if (els.enemyLevel) els.enemyLevel.textContent = String(lvl);
  if (els.enemyAtk) els.enemyAtk.textContent = formatNum(gameState.enemy.stats.atk);
  if (els.enemyDef) els.enemyDef.textContent = formatNum(gameState.enemy.stats.def);
  if (els.enemySpeed) els.enemySpeed.textContent = Math.round(gameState.enemy.stats.speed);
  updateMonsterImage(lvl);
  updateCombatPowerUI();
  updateHpBars();
}

function damageEquipmentAfterDefeat() {
  const candidates = PART_DEFS.map((def) => ({ def, item: state.equip[def.key] })).filter((entry) => entry.item);
  if (candidates.length === 0) {
    addBattleLog('손상될 장비가 없어 피해를 면했습니다.', 'warn');
    return;
  }
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  const item = selected.item;
  let message = '';
  if (item.lvl && item.lvl > 0) {
    const before = item.lvl;
    item.lvl = Math.max(0, item.lvl - 1);
    if (item.lvl <= 0) {
      state.equip[selected.def.key] = null;
      message = `${selected.def.name} 장비가 심하게 손상되어 파괴되었습니다. (Lv.${before})`;
    } else {
      message = `${selected.def.name}의 강화 레벨이 감소했습니다. (Lv.${before} → Lv.${item.lvl})`;
    }
  } else if ((item.base || 0) > 1) {
    const before = item.base || 1;
    const reduction = Math.max(1, Math.floor(before * 0.2));
    const after = Math.max(1, before - reduction);
    item.base = after;
    message = `${selected.def.name}이(가) 손상되어 기본 수치가 감소했습니다. (${formatNum(before)} → ${formatNum(after)})`;
  } else {
    state.equip[selected.def.key] = null;
    message = `${selected.def.name} 장비가 파괴되었습니다.`;
  }
  addBattleLog(message, 'damage');
  ensurePlayerReady();
  const sanitizedEquip = sanitizeEquipMap(state.equip);
  const sanitizedSpares = sanitizeEquipMap(state.spares);
  queueProfileUpdate({
    equip: sanitizedEquip,
    spares: sanitizedSpares
  });
  if (state.profile) {
    state.profile.equip = sanitizedEquip;
    state.profile.spares = sanitizedSpares;
  }
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
  if (gameState.battle.bossFight) {
    clearBossStateEffects(gameState.battle.bossFight);
    gameState.battle.bossFight = null;
    setBossControlsDisabled(false);
    updateBossUi();
  }
  resetPetCombatState();
  const level = clampMonsterLevel(els.monsterLevel?.value || gameState.battle.lastLevel || 1);
  state.lastNormalLevel = level;
  updateMonsterLevelUI(level);
  if (gameState.battle.ongoing) return;
  gameState.battle.ongoing = true;
  gameState.battle.actionLock = false;
  gameState.player.defending = false;
  gameState.player.skillCooldown = 0;
  gameState.player.hp = gameState.player.maxHp;
  gameState.enemy.defending = false;
  updateEnemyStats(level);
  gameState.battle.turn = 0;
  if (els.battleLog) els.battleLog.innerHTML = '';
  addBattleLog(`=== 레벨 ${level} 몬스터와 전투 시작! ===`);
  updateHpBars();
  updateCombatPowerUI();
  const enemyPower = combatPower({ ...gameState.enemy.stats, hp: gameState.enemy.maxHp });
  addBattleLog(`몬스터 전투력: ${formatNum(enemyPower)}`, 'warn');
  updateAutoPlayUi();
  beginPlayerTurn('battleStart');
}

function applyRewards(level, rng = Math.random) {
  if (state.user?.role === 'admin') return;
  const points = levelReward(level);
  const gold = calcGoldReward(level, rng);
  state.wallet += points;
  state.gold += gold;
  const drops = [];
  const dropCounts = { enhance: 0, potion: 0, hyperPotion: 0, protect: 0, battleRes: 0 };
  if (maybeDropItem('enhance', level)) {
    drops.push('강화권 +1');
    dropCounts.enhance += 1;
  }
  if (maybeDropItem('potion', level)) {
    drops.push('가속 물약 +1');
    dropCounts.potion += 1;
  }
  if (maybeDropItem('hyperPotion', level)) {
    drops.push('초 가속 물약 +1');
    dropCounts.hyperPotion += 1;
  }
  if (maybeDropItem('protect', level)) {
    drops.push('보호권 +1');
    dropCounts.protect += 1;
  }
  if (maybeDropItem('battleRes', level)) {
    drops.push('전투부활권 +1');
    dropCounts.battleRes += 1;
  }
  state.profile.wallet = state.wallet;
  state.profile.gold = state.gold;
  persistItems();
  updateResourceSummary();
  queueProfileUpdate({ wallet: state.wallet, gold: state.gold });
  return { points, gold, drops, dropCounts };
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
  const bossContext = gameState.battle.bossFight;
  const rng = Math.random;
  const rewards = applyRewards(level, rng);
  const bossRewards = bossContext ? applyBossRewards(bossContext, rng) : null;
  registerLevelClear(level);
  triggerDeathAnimation('monster');
  addBattleLog('=== 승리! ===', 'heal');
  if (rewards) {
    addBattleLog(`보상: +${formatNum(rewards.points)} 포인트, +${formatNum(rewards.gold)} 골드`);
    if (rewards.drops.length) {
      addBattleLog(rewards.drops.join(', '));
    }
  }
  if (bossRewards) {
    const tags = [];
    if (bossRewards.firstRewardGranted) tags.push('첫 보상');
    if (bossRewards.extraRewardGranted) tags.push('추가 드랍');
    if (bossRewards.tickets > 0) {
      const label = tags.length ? ` (${tags.join(', ')})` : '';
      addBattleLog(`[보스 보상] 펫 뽑기권 +${formatNum(bossRewards.tickets)}${label}`, 'heal');
    } else {
      addBattleLog('[보스 보상] 펫 뽑기권 획득 실패', 'warn');
    }
    addBattleLog(`[보스 현황] 누적 클리어 ${formatNum(bossRewards.clears)}회`, 'warn');
  }
  if (state.autoStats.active && !bossContext) {
    recordAutoStats(rewards);
  }
  if (bossContext) {
    endBossEncounter('victory');
  }
  if (gameState.battle.autoPlay && !bossContext) {
    scheduleNextAutoBattle('victory');
  }
}

function handleDefeat(level, context) {
  const bossContext = gameState.battle.bossFight;
  const resurrected = useBattleResTicket(level, context);
  triggerDeathAnimation('player');
  gameState.battle.actionLock = false;
  if (resurrected) {
    if (bossContext) endBossEncounter('defeat');
    if (gameState.battle.autoPlay) scheduleNextAutoBattle('defeat');
    return;
  }
  addBattleLog('=== 패배... ===', 'damage');
  if (state.user?.role !== 'admin') {
    damageEquipmentAfterDefeat();
    if (state.wallet > 0) {
      const loss = Math.max(1, Math.floor(state.wallet * 0.2));
      state.wallet = Math.max(0, state.wallet - loss);
      state.profile.wallet = state.wallet;
      addBattleLog(`패배 페널티: 포인트 ${formatNum(loss)} 감소`, 'damage');
    }
    queueProfileUpdate({ wallet: state.wallet });
    updateResourceSummary();
  }
  if (bossContext) {
    endBossEncounter('defeat');
  }
  if (gameState.battle.autoPlay) {
    gameState.battle.autoPlay = false;
    clearAutoSchedules();
    updateAutoPlayUi();
    endAutoStatsSession('defeat');
  }
}

function concludeTurn() {
  updateHpBars();
  updateCombatPowerUI();
  if (gameState.player.hp <= 0) {
    gameState.battle.ongoing = false;
    gameState.battle.actionLock = false;
    handleDefeat(gameState.enemy.level, 'manual');
    return true;
  }
  if (gameState.enemy.hp <= 0) {
    gameState.battle.ongoing = false;
    gameState.battle.actionLock = false;
    handleVictory(gameState.enemy.level);
    return true;
  }
  return false;
}

function playerAction(action) {
  if (!gameState.battle.ongoing || !gameState.battle.isPlayerTurn) return;
  if (gameState.battle.actionLock) return;
  gameState.battle.actionLock = true;
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
        const result = calculateDamage(getPlayerOffensiveStats(), gameState.enemy, false);
        if (result.type === 'MISS') {
          addBattleLog('플레이어의 공격이 빗나갔습니다!', 'miss');
        } else {
          const dealt = applyDamageToEnemy(result.damage, null);
          if (dealt > 0) {
            addBattleLog(`몬스터에게 ${formatNum(dealt)} 피해!`, result.type === 'CRITICAL' ? 'critical' : 'damage');
          } else {
            addBattleLog('몬스터가 피해를 받지 않았습니다.', 'warn');
          }
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
        gameState.battle.actionLock = false;
        if (gameState.battle.autoPlay) {
          queueAutoPlayerAction(350);
        }
        return;
      }
      gameState.battle.turn += 1;
      triggerAnimation('playerSprite', 'attacking');
      setTimeout(() => {
        const result = calculateDamage(getPlayerOffensiveStats(), gameState.enemy, true);
        const dealt = applyDamageToEnemy(result.damage, null);
        if (dealt > 0) {
          addBattleLog(`필살기! ${formatNum(dealt)} 피해!`, 'critical');
        } else {
          addBattleLog('필살기가 보호막에 막혔습니다.', 'warn');
        }
        gameState.player.skillCooldown = 3;
        postPlayerAction();
      }, delay(320));
      break;
    }
    case 'potion': {
      if (!consumePotion()) {
        addBattleLog('가속 물약이 부족합니다.', 'warn');
        gameState.battle.actionLock = false;
        if (gameState.battle.autoPlay) {
          queueAutoPlayerAction(350);
        }
        return;
      }
      gameState.battle.turn += 1;
      setTimeout(postPlayerAction, delay(200));
      break;
    }
    case 'hyperPotion': {
      if (!consumeHyperPotion()) {
        addBattleLog('초 가속 물약이 부족합니다.', 'warn');
        gameState.battle.actionLock = false;
        if (gameState.battle.autoPlay) {
          queueAutoPlayerAction(350);
        }
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
  const bossContext = gameState.battle.bossFight;
  if (bossContext) {
    tickBossStateBeforeAction(bossContext);
  }
  const choice = Math.random();
  gameState.enemy.defending = false;
  const speedMul = currentSpeedMultiplier();
  const delay = (ms) => Math.max(120, Math.round(ms / speedMul));
  const postEnemyAction = () => {
    if (concludeTurn()) return;
    beginPlayerTurn('afterEnemy');
  };

  if (bossContext && maybeExecuteBossSkill(bossContext, delay, postEnemyAction)) {
    return;
  }
  if (choice < 0.7) {
    triggerAnimation('monsterSprite', 'attacking');
    setTimeout(() => {
      const result = calculateDamage(gameState.enemy.stats, gameState.player.totalStats, false);
      if (result.type === 'MISS') {
        addBattleLog('몬스터의 공격이 빗나갔습니다!', 'miss');
      } else {
        triggerAnimation('playerSprite', 'hurt');
        const dealt = applyDamageToPlayer(result.damage, { source: 'attack', critical: result.type === 'CRITICAL' });
        if (dealt > 0) {
          addBattleLog(`몬스터의 공격! ${formatNum(dealt)} 피해!`, result.type === 'CRITICAL' ? 'critical' : 'damage');
        } else {
          addBattleLog('몬스터의 공격! 보호막이 피해를 모두 막았습니다.', 'heal');
        }
      }
      updateHpBars();
      postEnemyAction();
    }, delay(320));
  } else if (choice < 0.9) {
    triggerAnimation('monsterSprite', 'attacking');
    setTimeout(() => {
      const result = calculateDamage(gameState.enemy.stats, gameState.player.totalStats, true);
      triggerAnimation('playerSprite', 'hurt');
      const dealt = applyDamageToPlayer(result.damage, { source: 'skill', critical: true });
      if (dealt > 0) {
        addBattleLog(`몬스터의 강력한 일격! ${formatNum(dealt)} 피해!`, 'critical');
      } else {
        addBattleLog('몬스터의 강력한 일격! 보호막이 피해를 흡수했습니다.', 'heal');
      }
      updateHpBars();
      postEnemyAction();
    }, delay(360));
  } else {
    gameState.enemy.defending = true;
    addBattleLog('몬스터가 방어 자세를 취했습니다.');
    setTimeout(postEnemyAction, delay(220));
  }
}

function initEventListeners() {
  updateBossUi();
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
      startAutoStatsSession();
      if (gameState.battle.ongoing && gameState.battle.isPlayerTurn) {
        queueAutoPlayerAction(450);
      } else if (!gameState.battle.ongoing) {
        scheduleNextAutoBattle('manual');
      }
    } else {
      endAutoStatsSession('manual');
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
  els.autoPotionToggle?.addEventListener('change', (e) => {
    state.combat.autoPotion = !!e.target.checked;
    persistCombatPreferences();
    updateAutoConsumableUi();
  });
  els.autoHyperToggle?.addEventListener('change', (e) => {
    state.combat.autoHyper = !!e.target.checked;
    persistCombatPreferences();
    updateAutoConsumableUi();
  });
  els.bossList?.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest('.boss-btn') : null;
    if (!target) return;
    const bossId = target.dataset.boss;
    if (!bossId) return;
    if (gameState.battle.ongoing && gameState.battle.bossFight) return;
    setBossSelection(bossId);
  });
  els.startBossBtn?.addEventListener('click', () => {
    if (!state.selectedBossId) return;
    startBossBattle();
  });
  els.resetBossSelection?.addEventListener('click', () => {
    resetBossSelection();
  });
  els.monsterLevel?.addEventListener('input', (e) => {
    const level = clampMonsterLevel(e.target.value);
    updateMonsterLevelUI(level);
    state.lastNormalLevel = level;
    updateEnemyStats(level);
  });
  els.monsterLevelInput?.addEventListener('change', (e) => {
    const level = clampMonsterLevel(e.target.value);
    updateMonsterLevelUI(level);
    state.lastNormalLevel = level;
    updateEnemyStats(level);
  });
  els.monsterLevelInput?.addEventListener('input', (e) => {
    const level = clampMonsterLevel(e.target.value);
    updateMonsterLevelUI(level);
    state.lastNormalLevel = level;
  });
  els.monsterLevelMinus?.addEventListener('click', () => {
    const current = clampMonsterLevel(els.monsterLevelInput?.value || els.monsterLevel?.value || 1);
    const next = clampMonsterLevel(current - 1);
    updateMonsterLevelUI(next);
    state.lastNormalLevel = next;
    updateEnemyStats(next);
  });
  els.monsterLevelPlus?.addEventListener('click', () => {
    const current = clampMonsterLevel(els.monsterLevelInput?.value || els.monsterLevel?.value || 1);
    const next = clampMonsterLevel(current + 1);
    updateMonsterLevelUI(next);
    state.lastNormalLevel = next;
    updateEnemyStats(next);
  });
  els.toGacha?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  els.toPvp?.addEventListener('click', () => {
    window.location.href = 'pvp.html';
  });
  els.logout?.addEventListener('click', async () => {
    await signOut(auth);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'n' && event.key !== 'N') return;
    const tag = (event.target && event.target.tagName) || '';
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    event.preventDefault();
    startNewBattle();
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
      combat: { useBattleRes: true, prefBattleRes: true, autoPotion: false, autoHyper: false },
      pets: null,
      bossProgress: null,
      battleProgress: null,
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
  state.bossProgress = sanitizeBossProgress(rawProfile.bossProgress);
  state.battleProgress = sanitizeBattleProgress(rawProfile.battleProgress);
  state.pets = sanitizePetState(rawProfile.pets);
  state.wallet = role === 'admin' ? Number.POSITIVE_INFINITY : clampNumber(rawProfile.wallet, 0, Number.MAX_SAFE_INTEGER, 1000);
  state.gold = role === 'admin' ? Number.POSITIVE_INFINITY : clampNumber(rawProfile.gold, 0, Number.MAX_SAFE_INTEGER, 10000);
  state.combat = {
    useBattleRes: rawProfile.combat?.useBattleRes !== false,
    prefBattleRes: rawProfile.combat?.prefBattleRes !== false,
    autoPotion: rawProfile.combat?.autoPotion === true,
    autoHyper: rawProfile.combat?.autoHyper === true
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
    combat: { ...state.combat },
    pets: state.pets,
    bossProgress: state.bossProgress,
    battleProgress: state.battleProgress
  };
  const personalConfig = sanitizeConfig(rawProfile.config);
  state.config = role === 'admin' && globalConfig ? globalConfig : personalConfig;
  state.config.monsterScaling = normalizeMonsterScaling(state.config.monsterScaling);
  ensurePlayerReady();
  updateEnemyStats(parseInt(els.monsterLevel?.value || '1', 10) || 1);
  state.lastNormalLevel = clampMonsterLevel(els.monsterLevel?.value || 1);
  updateResourceSummary();
  updateBattleResUi();
  updateAutoPlayUi();
  startBuffTicker();
  if (els.whoami) els.whoami.textContent = `${fallbackName} (${role === 'admin' ? '관리자' : '회원'})`;
  updateBossUi();
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
