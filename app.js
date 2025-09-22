import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  ref,
  get,
  set,
  update,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  functions,
  httpsCallable
} from './firebase.js';
import { onValue } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js';
import { enqueueMail } from './mail-service.js';
import { sendSystemMessage } from './chat.js';
import {
  sanitizePetState,
  createDefaultPetState,
  PET_IDS,
  PET_DEFS,
  sanitizePetWeights,
  describePetAbilities,
  computePlayerStats as deriveCombatStats,
  CHARACTER_IDS,
  CHARACTER_IDS_BY_TIER,
  createDefaultCharacterState,
  sanitizeCharacterState,
  getCharacterDefinition,
  getCharacterImageVariants,
  characterBaseStats,
  sanitizeUserSettings,
  sanitizeCharacterBalance,
  DEFAULT_CHARACTER_BALANCE,
  CHARACTER_CLASS_IDS
} from './combat-core.js';
import {
  QUEST_DEFINITIONS,
  QUEST_LOOKUP,
  createDefaultQuestState,
  sanitizeQuestState,
  questRewardSummary
} from './quest-core.js';

const state = {};
const els = {};

function initializeState(initialState) {
  if (!initialState || typeof initialState !== 'object') {
    throw new Error('initializeState requires an object');
  }
  Object.assign(state, initialState);
}

function initializeElements(initialElements) {
  if (!initialElements || typeof initialElements !== 'object') {
    throw new Error('initializeElements requires an object');
  }
  Object.assign(els, initialElements);
}

function addListener(target, type, handler) {
  if (!target || typeof target.addEventListener !== 'function') {
    return false;
  }
  target.addEventListener(type, handler);
  return true;
}

function setInputValue(target, value) {
  if (!target) return;
  target.value = value;
}

function setCheckboxState(target, checked) {
  if (!target) return;
  target.checked = !!checked;
}

function setTextContent(target, value) {
  if (!target) return;
  target.textContent = value;
}

const TIERS = ["SSS+","SS+","S+","S","A","B","C","D"];
      const TIER_INDEX = Object.fromEntries(TIERS.map((t,i)=>[t,i]));
      // Drop defaults (admin editable)
      const MAX_LEVEL = 999;
      const DEFAULT_DROP_RATES = {
        potion: { base: 0.04, perLevel: 0.000045, max: 0.25 },
        hyperPotion: { base: 0.01, perLevel: 0.00005, max: 0.12 },
        protect: { base: 0.02, perLevel: 0.00003, max: 0.18 },
        enhance: { base: 0.75, perLevel: 0.0002, max: 1.0 },
        battleRes: { base: 0.01, perLevel: 0.00002, max: 0.08 }
      };
      const DEFAULT_POTION_P = DEFAULT_DROP_RATES.potion.base;
      const DEFAULT_HYPER_P = DEFAULT_DROP_RATES.hyperPotion.base;
      const DEFAULT_PROTECT_P = DEFAULT_DROP_RATES.protect.base;
      const DEFAULT_ENHANCE_P = DEFAULT_DROP_RATES.enhance.base;
      const DEFAULT_BATTLERES_P = DEFAULT_DROP_RATES.battleRes.base;
      const DEFAULT_GOLD_SCALING = { minLow: 120, maxLow: 250, minHigh: 900, maxHigh: 1400 };
      const DEFAULT_POTION_SETTINGS = { durationMs: 60000, manualCdMs: 1000, autoCdMs: 2000, speedMultiplier: 2 };
const DEFAULT_HYPER_POTION_SETTINGS = { durationMs: 60000, manualCdMs: 200, autoCdMs: 200, speedMultiplier: 4 };
const RARE_ANIMATION_DURATION_MS = 3600;
const RARE_ANIMATION_FADE_MS = 220;
const DEFAULT_SHOP_PRICES = { potion: 500, hyperPotion: 2000, protect: 1200, enhance: 800, battleRes: 2000, holyWater: 1000000, starterPack: 5000 };
const DIAMOND_SHOP_PACKS = Object.freeze([
  { id: 'diamondPack100', label: '소형 충전팩', bonus: '기본 제공', diamonds: 100, points: 1_000_000, gold: 1_000_000 },
  { id: 'diamondPack250', label: '가성비 충전팩', bonus: '+10% 보너스', diamonds: 250, points: 2_800_000, gold: 2_800_000 },
  { id: 'diamondPack500', label: '고급 충전팩', bonus: '+20% 보너스', diamonds: 500, points: 6_000_000, gold: 6_000_000 },
  { id: 'diamondPack1000', label: '에픽 충전팩', bonus: '+35% 보너스', diamonds: 1_000, points: 13_500_000, gold: 13_500_000 },
  { id: 'diamondPack2000', label: '전설 충전팩', bonus: '+50% 보너스', diamonds: 2_000, points: 30_000_000, gold: 30_000_000 }
]);
const DIAMOND_PACK_LOOKUP = Object.freeze(Object.fromEntries(DIAMOND_SHOP_PACKS.map((pack) => [pack.id, pack])));

const ENHANCE_TICKET_COST = Object.freeze([
  0, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 20, 20, 29, 60, 118
]);

const ENHANCE_PROTECT_COST = Object.freeze([
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 4, 4
]);

const ENHANCE_EXPECTED_GOLD = Object.freeze([
  0,
  2828,
  2887,
  2947,
  3043,
  3111,
  3500,
  5143,
  6000,
  8800,
  9778,
  14857,
  17333,
  24000,
  34000,
  50667,
  400000,
  500000,
  906667,
  2800000,
  10240000
]);

const GEAR_SSPLUS_GIF = 'https://firebasestorage.googleapis.com/v0/b/gacha-870fa.firebasestorage.app/o/SS%2B%20item.gif?alt=media&token=d614c7c7-eff3-4509-b1d6-a732b75936c4';
const GEAR_SSSPLUS_GIF = 'https://firebasestorage.googleapis.com/v0/b/gacha-870fa.firebasestorage.app/o/SSS%2B%20item.gif?alt=media&token=e8ae9b0c-5891-4653-8c4c-fe2155d6473d';
const LEGACY_GEAR_RARE_GIF = 'https://firebasestorage.googleapis.com/v0/b/gacha-870fa.firebasestorage.app/o/Carss%2B.gif?alt=media&token=d668d79b-7740-4986-b32e-11027a0453ac';
const CHARACTER_SSPLUS_GIF = GEAR_SSPLUS_GIF;
const CHARACTER_SSSPLUS_GIF = GEAR_SSSPLUS_GIF;
const LEGACY_CHARACTER_RARE_GIF = LEGACY_GEAR_RARE_GIF;
// 기본 희귀 연출 매핑. 관리자가 전역 설정(config.rareAnimations)을 수정하면 이 값을 덮어쓴다.
const DEFAULT_RARE_ANIMATIONS = {
  gear: [
    {
      tier: 'SS+',
      src: GEAR_SSPLUS_GIF,
      label: 'SS+ 장비 획득!',
      duration: RARE_ANIMATION_DURATION_MS
    },
    {
      tier: 'SSS+',
      src: GEAR_SSSPLUS_GIF,
      label: 'SSS+ 장비 획득!',
      duration: RARE_ANIMATION_DURATION_MS
    }
  ],
  character: [
    {
      tier: 'SS+',
      src: CHARACTER_SSPLUS_GIF,
      label: 'SS+ 캐릭터 획득!',
      duration: RARE_ANIMATION_DURATION_MS
    },
    {
      tier: 'SSS+',
      src: CHARACTER_SSSPLUS_GIF,
      label: 'SSS+ 캐릭터 획득!',
      duration: RARE_ANIMATION_DURATION_MS
    }
  ]
};
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
const CHARACTER_IMAGE_PLACEHOLDER = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http://www.w3.org/2000/svg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2210%22%20ry%3D%2210%22%20fill%3D%22%23d0d0d0%22/%3E%3Cpath%20d%3D%22M32%2018a10%2010%200%201%201%200%2020a10%2010%200%200%201%200-20zm0%2024c10.5%200%2019%206.3%2019%2014v4H13v-4c0-7.7%208.5-14%2019-14z%22%20fill%3D%22%23808080%22/%3E%3C/svg%3E';
const GLOBAL_CONFIG_PATH = 'config/global';
const PART_DEFS = [
  {key:'head', name:'투구', type:'def'},
  {key:'body', name:'갑옷', type:'def'},
  {key:'main', name:'주무기', type:'atk'},
  {key:'off',  name:'보조무기', type:'atk'},
  {key:'boots', name:'신발', type:'def'},
];
const PART_KEYS = PART_DEFS.map(function(p){ return p.key; });
const PART_ICONS = { head:'🪖', body:'🛡️', main:'⚔️', off:'🗡️', boots:'🥾' };

// 강화 상수는 forge 모듈로 이동했습니다.

      const $ = (q)=>document.querySelector(q);
      const $$ = (q)=>Array.from(document.querySelectorAll(q));

      initializeElements({
        appWrap: $('#appWrap'), logoutBtn: $('#logoutBtn'), whoami: $('#whoami'), toAdmin: $('#toAdmin'), toUser: $('#toUser'), toBattle: $('#toBattle'), goBattle: $('#goBattle'), toPvp: $('#toPvp'),
        questBtn: $('#questBtn'), questBadge: $('#questBadge'), questOverlay: $('#questOverlay'), questPanel: $('#questPanel'), questClose: $('#questClose'), questList: $('#questList'), questEmpty: $('#questEmpty'), questToast: $('#questToast'),
        adminPanel: $('#adminPanel'), adminOldPass: $('#adminOldPass'), adminNewPass: $('#adminNewPass'), adminChangePw: $('#adminChangePw'), adminMsg: $('#adminMsg'),
        dropPotionBase: $('#dropPotionBase'), dropPotionPer: $('#dropPotionPer'), dropPotionMax: $('#dropPotionMax'),
        dropHyperBase: $('#dropHyperBase'), dropHyperPer: $('#dropHyperPer'), dropHyperMax: $('#dropHyperMax'),
        dropProtectBase: $('#dropProtectBase'), dropProtectPer: $('#dropProtectPer'), dropProtectMax: $('#dropProtectMax'),
        dropEnhanceBase: $('#dropEnhanceBase'), dropEnhancePer: $('#dropEnhancePer'), dropEnhanceMax: $('#dropEnhanceMax'),
        dropBattleResBase: $('#dropBattleResBase'), dropBattleResPer: $('#dropBattleResPer'), dropBattleResMax: $('#dropBattleResMax'),
        goldMinLow: $('#goldMinLow'), goldMaxLow: $('#goldMaxLow'), goldMinHigh: $('#goldMinHigh'), goldMaxHigh: $('#goldMaxHigh'),
        priceInputPotion: $('#priceInputPotion'), priceInputHyper: $('#priceInputHyper'), priceInputProtect: $('#priceInputProtect'), priceInputEnhance: $('#priceInputEnhance'), priceInputBattleRes: $('#priceInputBattleRes'), priceInputStarter: $('#priceInputStarter'),
        potionDuration: $('#potionDuration'), potionManualCd: $('#potionManualCd'), potionAutoCd: $('#potionAutoCd'), potionSpeedMult: $('#potionSpeedMult'),
        hyperDuration: $('#hyperDuration'), hyperManualCd: $('#hyperManualCd'), hyperAutoCd: $('#hyperAutoCd'), hyperSpeedMult: $('#hyperSpeedMult'),
        monsterBasePower: $('#monsterBasePower'), monsterMaxPower: $('#monsterMaxPower'), monsterCurve: $('#monsterCurve'), monsterDifficultyInput: $('#monsterDifficulty'), monsterDifficultyMinus: $('#monsterDifficultyMinus'), monsterDifficultyPlus: $('#monsterDifficultyPlus'),
        saveDrops: $('#saveDrops'),
        mode: $('#mode'), seed: $('#seed'), lock: $('#lock'), petTickets: $('#petTicketCount'),
        weightsTable: $('#weightsTable tbody'),
        characterWeightsTable: $('#characterWeightsTable'),
        characterWeightsBody: $('#characterWeightsBody'),
        gearConfigWrap: $('#gearConfigWrap'),
        petConfigWrap: $('#petConfigWrap'),
        characterConfigWrap: $('#characterConfigWrap'),
        petWeightTableBody: $('#petWeightTableBody'),
        gachaModeGearConfig: $('#gachaModeGearConfig'),
        gachaModePetConfig: $('#gachaModePetConfig'),
        gachaModeCharacterConfig: $('#gachaModeCharacterConfig'),
        pityEnabled: $('#pityEnabled'), pityFloor: $('#pityFloor'), pitySpan: $('#pitySpan'),
        g10Enabled: $('#g10Enabled'), g10Tier: $('#g10Tier'),
        draw1: $('#draw1'), draw10: $('#draw10'), draw100: $('#draw100'), draw1k: $('#draw1k'), draw10k: $('#draw10k'),
        drawPet1: $('#drawPet1'), drawPet10: $('#drawPet10'),
        drawChar1: $('#drawChar1'), drawChar10: $('#drawChar10'),
        cancel: $('#cancel'), speed: $('#speed'), bar: $('#bar'),
        gearDrawControls: $('#gearDrawControls'), petDrawControls: $('#petDrawControls'), characterDrawControls: $('#characterDrawControls'),
        gachaModeGearDraw: $('#gachaModeGearDraw'), gachaModePetDraw: $('#gachaModePetDraw'), gachaModeCharacterDraw: $('#gachaModeCharacterDraw'),
        scope: $('#scope'), statsMode: $('#statsMode'), nDraws: $('#nDraws'), pval: $('#pval'), statsTable: $('#statsTable tbody'), petStatsTable: $('#petStatsTable tbody'), characterStatsTable: $('#characterStatsTable tbody'), resetSession: $('#resetSession'), resetGlobal: $('#resetGlobal'),
        gearStatsWrap: $('#gearStatsWrap'), petStatsWrap: $('#petStatsWrap'), characterStatsWrap: $('#characterStatsWrap'),
        chart: $('#chart'), log: $('#log'),
        atkTotal: $('#atkTotal'), defTotal: $('#defTotal'), nextMonster: $('#nextMonster'), monLevel: $('#monLevel'), monLevelVal: $('#monLevelVal'), winProb: $('#winProb'), fightBtn: $('#fightBtn'), fightResult: $('#fightResult'), autoHuntBtn: $('#autoHuntBtn'), manualCd: $('#manualCd'), autoCd: $('#autoCd'), lvlDec: $('#lvlDec'), lvlInc: $('#lvlInc'), potionCount: $('#potionCount'), usePotion: $('#usePotion'), hyperPotionCount: $('#hyperPotionCount'), useHyperPotion: $('#useHyperPotion'), buffInfo: $('#buffInfo'), claimRevive: $('#claimRevive'), battleResUse: $('#battleResUse'), battleResRemain: $('#battleResRemain'), battleWinProb: $('#battleWinProb'), playerHealthBar: $('#playerHealthBar'), enemyHealthBar: $('#enemyHealthBar'), playerAtkStat: $('#playerAtkStat'), playerDefStat: $('#playerDefStat'), battleEnemyLevel: $('#battleEnemyLevel'), battleEnemyReward: $('#battleEnemyReward'),
        invCount: $('#invCount'), equipGrid: $('#equipGrid'), spareList: $('#spareList'),
        forgeTarget: $('#forgeTarget'), forgeLv: $('#forgeLv'), forgeMul: $('#forgeMul'), forgeStageMul: $('#forgeStageMul'), forgeP: $('#forgeP'), forgePreview: $('#forgePreview'), forgeCostEnh: $('#forgeCostEnh'), forgeCostProtect: $('#forgeCostProtect'), forgeCostGold: $('#forgeCostGold'), forgeOnce: $('#forgeOnce'), forgeAuto: $('#forgeAuto'), forgeTableBody: $('#forgeTableBody'), forgeReset: $('#forgeReset'), forgeMsg: $('#forgeMsg'), forgeEffect: $('#forgeEffect'), forgeProtectUse: $('#forgeProtectUse'), protectCount: $('#protectCount'), enhanceCount: $('#enhanceCount'), reviveCount: $('#reviveCount'),
        pricePotion: $('#pricePotion'), priceHyper: $('#priceHyper'), priceProtect: $('#priceProtect'), priceEnhance: $('#priceEnhance'), priceBattleRes: $('#priceBattleRes'), priceStarter: $('#priceStarter'),
        invPotion: $('#invPotion'), invHyper: $('#invHyper'), invProtect: $('#invProtect'), invEnhance: $('#invEnhance'), invBattleRes: $('#invBattleRes'), invHolyWater: $('#invHolyWater'), shopPanel: $('#shop'), diamondShop: $('#diamondShop'), diamondShopGrid: $('#diamondShopGrid'),
        petList: $('#petList'),
        characterList: $('#characterList'),
        characterDetailHint: $('#characterDetailHint'),
        characterDetailModal: $('#characterDetailModal'),
        characterDetailBody: $('#characterDetailBody'),
        characterDetailClose: $('#characterDetailClose'),
        saveCfg: $('#saveCfg'), loadCfg: $('#loadCfg'), cfgFile: $('#cfgFile'), shareLink: $('#shareLink'), points: $('#points'), gold: $('#gold'), diamonds: $('#diamonds'), drawResults: $('#drawResults'), shopMsg: $('#shopMsg'),
        userOptionsBtn: $('#userOptionsBtn'), userOptionsModal: $('#userOptionsModal'), userOptionsSave: $('#userOptionsSave'), userOptionsClose: $('#userOptionsClose'), userOptionsCharacterGif: $('#userOptionsCharacterGif'), userOptionsPetGif: $('#userOptionsPetGif'),
        adminPresetSelect: $('#adminPresetSelect'), adminPresetApply: $('#adminPresetApply'), adminPresetLoad: $('#adminPresetLoad'), adminPresetDelete: $('#adminPresetDelete'), adminPresetName: $('#adminPresetName'), adminPresetSave: $('#adminPresetSave'), presetAdminMsg: $('#presetAdminMsg'),
        adminUserSelect: $('#adminUserSelect'), adminUserStats: $('#adminUserStats'), adminGrantPoints: $('#adminGrantPoints'), adminGrantGold: $('#adminGrantGold'), adminGrantDiamonds: $('#adminGrantDiamonds'), adminGrantPetTickets: $('#adminGrantPetTickets'), adminGrantSubmit: $('#adminGrantSubmit'),
        adminBackupRefresh: $('#adminBackupRefresh'), adminRestoreFromMirror: $('#adminRestoreFromMirror'), adminRestoreFromSnapshot: $('#adminRestoreFromSnapshot'), adminSnapshotSelect: $('#adminSnapshotSelect'), adminBackupStatus: $('#adminBackupStatus'), adminSnapshotTableBody: $('#adminSnapshotTableBody'),
        globalPresetSelect: $('#globalPresetSelect'), personalPresetSelect: $('#personalPresetSelect'), applyGlobalPreset: $('#applyGlobalPreset'), applyPersonalPreset: $('#applyPersonalPreset'), personalPresetName: $('#personalPresetName'), savePersonalPreset: $('#savePersonalPreset'), presetMsg: $('#presetMsg'), toggleUserEdit: $('#toggleUserEdit'),
        petTicketInline: $('#petTicketInline'),
        holyWaterCount: $('#holyWaterCount'),
        priceHolyWater: $('#priceHolyWater'),
        rareAnimationOverlay: $('#rareAnimationOverlay'),
        rareAnimationImage: $('#rareAnimationImage'),
        rareAnimationMessage: $('#rareAnimationMessage'),
        rareAnimationTier: $('#rareAnimationTier'),
        rareAnimationSkip: $('#rareAnimationSkip'),
        legendaryOverlay: $('#legendaryOverlay'),
        gearLegendaryModal: $('#gearLegendaryModal'),
        characterLegendaryModal: $('#characterLegendaryModal'),
        gearLegendaryTitle: $('#gearLegendaryTitle'),
        gearNewTier: $('#gearNewTier'),
        gearNewPart: $('#gearNewPart'),
        gearNewBase: $('#gearNewBase'),
        gearNewEffective: $('#gearNewEffective'),
        gearCurrentTier: $('#gearCurrentTier'),
        gearCurrentPart: $('#gearCurrentPart'),
        gearCurrentBase: $('#gearCurrentBase'),
        gearCurrentEffective: $('#gearCurrentEffective'),
        gearComparisonDelta: $('#gearComparisonDelta'),
        gearEquipBtn: $('#gearEquipBtn'),
        gearSpareBtn: $('#gearSpareBtn'),
        gearDiscardBtn: $('#gearDiscardBtn'),
        characterLegendaryTitle: $('#characterLegendaryTitle'),
        characterNewImage: $('#characterNewImage'),
        characterNewName: $('#characterNewName'),
        characterNewTier: $('#characterNewTier'),
        characterNewClass: $('#characterNewClass'),
        characterNewCount: $('#characterNewCount'),
        characterNewStats: $('#characterNewStats'),
        characterCurrentImage: $('#characterCurrentImage'),
        characterCurrentName: $('#characterCurrentName'),
        characterCurrentTier: $('#characterCurrentTier'),
        characterCurrentClass: $('#characterCurrentClass'),
        characterCurrentCount: $('#characterCurrentCount'),
        characterCurrentStats: $('#characterCurrentStats'),
        characterLegendaryClose: $('#characterLegendaryClose'),
        characterBalanceTable: $('#characterBalanceTable'),
        characterBalanceOffsetTable: $('#characterBalanceOffsetTable'),
        characterBalanceMsg: $('#characterBalanceMsg'),
        characterBalanceSnapshot: $('#characterBalanceSnapshot')
      });

      const ALL_USERS_OPTION = '__ALL_USERS__';

      // Config and state
      const defaultWeights = {"SSS+":0.5, "SS+":1.5, "S+":8, "S":30, "A":60, "B":150, "C":300, "D":450};
      const cfgVersion = 'v1';
      const CLASS_LABELS = {
        warrior: '전사',
        mage: '마법사',
        archer: '궁수',
        rogue: '도적',
        goddess: '여신'
      };
      const CHARACTER_BALANCE_FIELDS = [
        { key: 'skill', label: '스킬 배율' },
        { key: 'hp', label: 'HP' },
        { key: 'atk', label: 'ATK' },
        { key: 'def', label: 'DEF' },
        { key: 'speed', label: '속도' },
        { key: 'critRate', label: '치명타율' },
        { key: 'critDmg', label: '치명 피해' },
        { key: 'dodge', label: '회피율' }
      ];

      let currentFirebaseUser = null;
      let userProfile = null;
      let profileSaveTimer = null;
      let forgeEffectTimer = null;
      const PROFILE_SAVE_DELAY = 1500;
      const PROFILE_SAVE_RETRY_DELAYS = [1000, 2000, 4000];
      const USERNAME_NAMESPACE = '@gacha.local';

      initializeState({
        config: {
          weights: {...defaultWeights},
          probs: {},
          characterWeights: {...defaultWeights},
          characterProbs: {},
          pity: { enabled:false, floorTier:'S', span:90 },
          minGuarantee10: { enabled:false, tier:'A' },
          seed: '', locked: false, version: cfgVersion,
          dropRates: cloneDropRates(DEFAULT_DROP_RATES),
          goldScaling: normalizeGoldScaling(DEFAULT_GOLD_SCALING),
          shopPrices: { ...DEFAULT_SHOP_PRICES },
          potionSettings: { ...DEFAULT_POTION_SETTINGS },
          hyperPotionSettings: { ...DEFAULT_HYPER_POTION_SETTINGS },
          monsterScaling: { ...DEFAULT_MONSTER_SCALING },
          petWeights: sanitizePetWeights(null),
          rareAnimations: normalizeRareAnimations(DEFAULT_RARE_ANIMATIONS),
          characterBalance: sanitizeCharacterBalance(null)
        },
        session: { draws:0, counts: Object.fromEntries(TIERS.map(t=>[t,0])), history: [] },
        global: loadGlobal(),
        runId: 1,
        cancelFlag: false,
        pitySince: 0,
        inventory: [],
        equip: { head:null, body:null, main:null, off:null, boots:null },
        spares: { head:null, body:null, main:null, off:null, boots:null },
        itemSeq: 1,
        enhance: defaultEnhance(),
        forge: { protectEnabled: false, protectStock: 0, autoRunning: false },
        user: null,
        ui: { adminView: false, userEditEnabled: false, statsMode: 'gear', gachaMode: 'gear', selectedCharacterDetail: null, characterDetailOpen: false, userOptionsOpen: false, questOpen: false, rareAnimationBlocking: false },
        wallet: 0,
        gold: 0,
        diamonds: 0,
        presets: { global: [], personal: [], activeGlobalId: null, activeGlobalName: null },
        selectedPreset: { scope: null, id: null },
        profile: null,
        adminUsers: [],
        backups: { mirror: null, snapshots: [] },
        timers: { manualLast: 0, autoLast: 0, uiTimer: null, autoTimer: null, autoOn: false },
        inRun: false,
        items: { potion: 0, hyperPotion: 0, protect: 0, enhance: 0, revive: 0, battleRes: 0, holyWater: 0, petTicket: 0 },
        pets: createDefaultPetState(),
        characters: createDefaultCharacterState(),
        characterStats: sanitizeCharacterDrawStats(null),
        quests: createDefaultQuestState(),
        settings: sanitizeUserSettings(null),
        petGachaWeights: sanitizePetWeights(null),
        buffs: { accelUntil: 0, accelMultiplier: 1, hyperUntil: 0, hyperMultiplier: 1 },
        combat: { useBattleRes: true, prefBattleRes: true },
        profileListener: null,
        globalConfigListener: null,
        rareAnimations: { queue: [], playing: false, timer: null, hideTimer: null, current: null, skippable: true },
        pendingProfileExtras: {},
        profileSaveStats: { recent: [], lastWarnAt: 0, lastErrorAt: 0 }
      });
      state.config.petWeights = sanitizePetWeights(state.config.petWeights);
      state.petGachaWeights = sanitizePetWeights(state.config.petWeights);
      state.config.characterWeights = sanitizeWeights(state.config.characterWeights);
      state.config.characterProbs = normalize(state.config.characterWeights);
      state.config.shopPrices = normalizeShopPrices(state.config.shopPrices);
      state.config.potionSettings = normalizePotionSettings(state.config.potionSettings, DEFAULT_POTION_SETTINGS);
      state.config.hyperPotionSettings = normalizePotionSettings(state.config.hyperPotionSettings, DEFAULT_HYPER_POTION_SETTINGS);
      state.config.rareAnimations = normalizeRareAnimations(state.config.rareAnimations);
      state.config.characterBalance = sanitizeCharacterBalance(state.config.characterBalance);

      function deriveUsernameFromUser(firebaseUser){
        if(!firebaseUser) return '';
        const email = firebaseUser.email || '';
        if(email.endsWith(USERNAME_NAMESPACE)){
          return email.slice(0, -USERNAME_NAMESPACE.length);
        }
        const at = email.indexOf('@');
        if(at > 0){
          return email.slice(0, at);
        }
        return email || (firebaseUser.displayName || '');
      }

      function sanitizeUsername(raw, fallback){
        if(typeof raw === 'string' && raw.trim().length){
          return raw.trim();
        }
        return fallback || '';
      }

      function clampNumber(value, min, max, fallback){
        if(typeof value !== 'number' || !isFinite(value)){
          return fallback;
        }
        let n = Math.floor(value);
        if(typeof min === 'number' && n < min){
          n = min;
        }
        if(typeof max === 'number' && n > max){
          n = max;
        }
        return n;
      }

      function sleep(ms){ return new Promise((resolve)=> setTimeout(resolve, ms)); }

      function clonePlain(value){
        if(!value || typeof value !== 'object') return value;
        try {
          if(typeof structuredClone === 'function'){
            return structuredClone(value);
          }
        } catch (err) {
          // ignore and fallback to JSON clone
        }
        return JSON.parse(JSON.stringify(value));
      }

      function mergePlainObjects(target, source){
        if(!target || typeof target !== 'object') target = {};
        if(!source || typeof source !== 'object') return target;
        Object.keys(source).forEach((key)=>{
          const value = source[key];
          if(value && typeof value === 'object' && !Array.isArray(value)){
            if(!target[key] || typeof target[key] !== 'object'){
              target[key] = {};
            }
            mergePlainObjects(target[key], value);
          } else {
            target[key] = clonePlain(value);
          }
        });
        return target;
      }

      function expandExtraUpdates(updates){
        if(!updates || typeof updates !== 'object') return {};
        const result = {};
        Object.keys(updates).forEach((key)=>{
          const value = updates[key];
          if(!key) return;
          if(key.includes('/')){
            const parts = key.split('/');
            let node = result;
            for(let i=0;i<parts.length;i++){
              const part = parts[i];
              if(i === parts.length-1){
                node[part] = clonePlain(value);
              } else {
                if(!node[part] || typeof node[part] !== 'object') node[part] = {};
                node = node[part];
              }
            }
          } else {
            if(value && typeof value === 'object' && !Array.isArray(value)){
              if(!result[key] || typeof result[key] !== 'object') result[key] = {};
              mergePlainObjects(result[key], value);
            } else {
              result[key] = clonePlain(value);
            }
          }
        });
        return result;
      }

      function queueProfileExtras(updates){
        if(!updates || typeof updates !== 'object') return;
        const normalized = expandExtraUpdates(updates);
        if(!Object.keys(normalized).length) return;
        if(!state.pendingProfileExtras || typeof state.pendingProfileExtras !== 'object'){
          state.pendingProfileExtras = {};
        }
        state.pendingProfileExtras = mergePlainObjects(state.pendingProfileExtras, normalized);
      }

      function collectPendingProfileExtras(){
        if(!state.pendingProfileExtras || !Object.keys(state.pendingProfileExtras).length) return null;
        const snapshot = clonePlain(state.pendingProfileExtras);
        state.pendingProfileExtras = {};
        return snapshot;
      }

      function recordProfileSaveSuccess(){
        const stats = state.profileSaveStats || (state.profileSaveStats = { recent: [], lastWarnAt: 0, lastErrorAt: 0 });
        const now = Date.now();
        stats.recent = (stats.recent || []).filter((ts)=> now - ts < 60000);
        stats.recent.push(now);
        const threshold = 20;
        if(stats.recent.length > threshold && (now - (stats.lastWarnAt || 0) > 60000)){
          stats.lastWarnAt = now;
          console.warn(`최근 60초 동안 프로필 저장이 ${stats.recent.length}회 발생했습니다. 쓰기 최적화를 검토하세요.`);
        }
      }

      function sanitizeWeights(rawWeights){
        const weights = {...defaultWeights};
        if(rawWeights && typeof rawWeights === 'object'){
          TIERS.forEach(function(tier){
            const val = rawWeights[tier];
            if(typeof val === 'number' && isFinite(val) && val >= 0){
              weights[tier] = val;
            }
          });
        }
        return weights;
      }

      function sanitizeGlobalStats(raw){
        const counts = Object.fromEntries(TIERS.map((tier)=> [tier, 0]));
        const result = { draws: 0, counts };
        if(raw && typeof raw === 'object'){
          result.draws = clampNumber(raw.draws, 0, Number.MAX_SAFE_INTEGER, 0);
          if(raw.counts && typeof raw.counts === 'object'){
            TIERS.forEach((tier)=>{
              counts[tier] = clampNumber(raw.counts[tier], 0, Number.MAX_SAFE_INTEGER, 0);
            });
          }
        }
        return result;
      }

      function sanitizeCharacterDrawStats(raw){
        const counts = Object.fromEntries(TIERS.map((tier)=> [tier, 0]));
        let draws = 0;
        if(raw && typeof raw === 'object'){
          draws = clampNumber(raw.draws, 0, Number.MAX_SAFE_INTEGER, 0);
          if(raw.counts && typeof raw.counts === 'object'){
            TIERS.forEach((tier)=>{
              counts[tier] = clampNumber(raw.counts[tier], 0, Number.MAX_SAFE_INTEGER, 0);
            });
          }
        }
        return { draws, counts };
      }

      function normalizeRareAnimationList(list, defaults){
        const result = [];
        const source = Array.isArray(list) ? list : [];
        source.forEach((item)=>{
          if(!item || typeof item !== 'object') return;
          const tier = TIERS.includes(item.tier) ? item.tier : null;
          const src = typeof item.src === 'string' && item.src.trim().length ? item.src.trim() : null;
          if(!tier || !src) return;
          const label = typeof item.label === 'string' && item.label.trim().length ? item.label.trim() : `${tier} 획득!`;
          const duration = clampNumber(item.duration, 600, 20000, RARE_ANIMATION_DURATION_MS);
          const id = typeof item.id === 'string' && item.id.trim().length ? item.id.trim() : null;
          const entry = { tier, src, label, duration };
          if(id) entry.id = id;
          result.push(entry);
        });
        if(result.length === 0 && Array.isArray(defaults)){
          defaults.forEach((item)=>{
            if(!item || typeof item !== 'object') return;
            const tier = TIERS.includes(item.tier) ? item.tier : null;
            const src = typeof item.src === 'string' && item.src.trim().length ? item.src.trim() : null;
            if(!tier || !src) return;
            const label = typeof item.label === 'string' && item.label.trim().length ? item.label.trim() : `${tier} 획득!`;
            const duration = clampNumber(item.duration, 600, 20000, RARE_ANIMATION_DURATION_MS);
            const id = typeof item.id === 'string' && item.id.trim().length ? item.id.trim() : null;
            const entry = { tier, src, label, duration };
            if(id) entry.id = id;
            result.push(entry);
          });
        }
        return result;
      }

      function normalizeRareAnimations(raw){
        const result = {};
        const kinds = new Set(Object.keys(DEFAULT_RARE_ANIMATIONS));
        if(raw && typeof raw === 'object'){
          Object.keys(raw).forEach((kind)=> kinds.add(kind));
        }
        kinds.forEach((kind)=>{
          const defaults = DEFAULT_RARE_ANIMATIONS[kind] || [];
          const list = normalizeRareAnimationList(raw && raw[kind], defaults);
          const ensureEntry = (tier, gif, label, legacySrc)=>{
            const idx = list.findIndex((entry)=> entry && entry.tier === tier && !entry.id);
            if(idx === -1){
              list.push({ tier, src: gif, label, duration: RARE_ANIMATION_DURATION_MS });
              return;
            }
            const current = list[idx];
            if(current.src === legacySrc){
              current.src = gif;
            }
            if(!current.label || !current.label.trim()){
              current.label = label;
            }
            current.duration = clampNumber(current.duration, 600, 20000, RARE_ANIMATION_DURATION_MS);
          };
          if(kind === 'gear'){
            ensureEntry('SS+', GEAR_SSPLUS_GIF, 'SS+ 장비 획득!', LEGACY_GEAR_RARE_GIF);
            ensureEntry('SSS+', GEAR_SSSPLUS_GIF, 'SSS+ 장비 획득!', LEGACY_GEAR_RARE_GIF);
          } else if(kind === 'character'){
            ensureEntry('SS+', CHARACTER_SSPLUS_GIF, 'SS+ 캐릭터 획득!', LEGACY_CHARACTER_RARE_GIF);
            ensureEntry('SSS+', CHARACTER_SSSPLUS_GIF, 'SSS+ 캐릭터 획득!', LEGACY_CHARACTER_RARE_GIF);
          }
          if(kind === 'gear' || kind === 'character'){
            list.sort((a,b)=>{
              const ai = TIER_INDEX[a.tier] ?? Number.POSITIVE_INFINITY;
              const bi = TIER_INDEX[b.tier] ?? Number.POSITIVE_INFINITY;
              return ai - bi;
            });
          }
          result[kind] = list;
        });
        return result;
      }

      function sanitizeConfig(raw){
        const weights = sanitizeWeights(raw && raw.weights);
        const characterWeights = sanitizeWeights(raw && (raw.characterWeights || raw.characterGachaWeights));
        const pityRaw = raw && raw.pity ? raw.pity : {};
        const min10Raw = raw && raw.minGuarantee10 ? raw.minGuarantee10 : {};
        const pityFloor = TIERS.includes(pityRaw.floorTier) ? pityRaw.floorTier : 'S';
        const min10Tier = TIERS.includes(min10Raw.tier) ? min10Raw.tier : 'A';
        const pitySpan = clampNumber(pityRaw.span, 1, 9999, 90);
        const petWeights = sanitizePetWeights(raw && (raw.petWeights || raw.petGachaWeights));
        return {
          weights,
          probs: normalize(weights),
          characterWeights,
          characterProbs: normalize(characterWeights),
          seed: (raw && typeof raw.seed === 'string') ? raw.seed : '',
          locked: !!(raw && raw.locked),
          pity: {
            enabled: !!pityRaw.enabled,
            floorTier: pityFloor,
            span: pitySpan || 90
          },
          minGuarantee10: {
            enabled: !!min10Raw.enabled,
            tier: min10Tier
          },
          version: (raw && typeof raw.version === 'string') ? raw.version : cfgVersion,
          dropRates: normalizeDropRates(raw && raw.dropRates),
          goldScaling: normalizeGoldScaling(raw && raw.goldScaling),
          shopPrices: normalizeShopPrices(raw && raw.shopPrices),
          potionSettings: normalizePotionSettings(raw && raw.potionSettings, DEFAULT_POTION_SETTINGS),
          hyperPotionSettings: normalizePotionSettings(raw && raw.hyperPotionSettings, DEFAULT_HYPER_POTION_SETTINGS),
          monsterScaling: normalizeMonsterScaling(raw && raw.monsterScaling),
          petWeights,
          rareAnimations: normalizeRareAnimations(raw && raw.rareAnimations),
          characterBalance: sanitizeCharacterBalance(raw && raw.characterBalance)
        };
      }

      function sanitizeGearItem(raw){
        if(!raw || typeof raw !== 'object') return null;
        const tier = TIERS.includes(raw.tier) ? raw.tier : null;
        const part = PART_KEYS.includes(raw.part) ? raw.part : null;
        if(!tier || !part) return null;
        const defType = PART_DEFS.find(p=>p.key===part)?.type || 'atk';
        return {
          id: clampNumber(raw.id, 0, Number.MAX_SAFE_INTEGER, Date.now()),
          tier,
          part,
          base: clampNumber(raw.base ?? raw.stat, 0, Number.MAX_SAFE_INTEGER, 0),
          lvl: clampNumber(raw.lvl, 0, 20, 0),
          type: (raw.type === 'atk' || raw.type === 'def') ? raw.type : defType
        };
      }

      function sanitizeEquipMap(raw){
        const result = { head:null, body:null, main:null, off:null, boots:null };
        if(raw && typeof raw === 'object'){
          PART_KEYS.forEach(function(key){
            result[key] = sanitizeGearItem(raw[key]);
          });
        }
        return result;
      }

      function ensureCharacterBalanceConfig(){
        const sanitized = sanitizeCharacterBalance(state.config.characterBalance);
        state.config.characterBalance = sanitized;
        if(userProfile?.config){
          userProfile.config.characterBalance = sanitized;
        }
        return sanitized;
      }

      function setCharacterBalanceMsg(message, tone){
        if(!els.characterBalanceMsg) return;
        els.characterBalanceMsg.textContent = message || '';
        els.characterBalanceMsg.classList.remove('ok','warn','danger');
        if(tone === 'ok') els.characterBalanceMsg.classList.add('ok');
        else if(tone === 'warn') els.characterBalanceMsg.classList.add('warn');
        else if(tone === 'danger') els.characterBalanceMsg.classList.add('danger');
      }

      function updateCharacterBalanceInputs(){
        if(!els.characterBalanceTable) return;
        const balance = ensureCharacterBalanceConfig();
        els.characterBalanceTable.querySelectorAll('input[data-class][data-field]').forEach((input)=>{
          const classId = input.dataset.class;
          const field = input.dataset.field;
          const entry = balance[classId] || DEFAULT_CHARACTER_BALANCE[classId] || DEFAULT_CHARACTER_BALANCE.warrior;
          let value = 1;
          if(field === 'skill'){
            value = entry.skill ?? 1;
          } else if(entry.stats && field in entry.stats){
            value = entry.stats[field];
          }
          input.value = formatMultiplier(value ?? 1);
          input.placeholder = formatMultiplier(value ?? 1);
        });
        if(els.characterBalanceOffsetTable){
          els.characterBalanceOffsetTable.querySelectorAll('input[data-class][data-field]').forEach((input)=>{
            const classId = input.dataset.class;
            const field = input.dataset.field;
            const entry = balance[classId] || DEFAULT_CHARACTER_BALANCE[classId] || DEFAULT_CHARACTER_BALANCE.warrior;
            const offsets = entry.offsets || {};
            let value = offsets[field];
            if(!Number.isFinite(value)) value = 0;
            input.value = value;
            input.placeholder = formatOffsetDisplay(field, value);
          });
        }
        renderCharacterBalanceSnapshot();
      }

      function renderCharacterBalanceSnapshot(){
        if(!els.characterBalanceSnapshot) return;
        const balance = ensureCharacterBalanceConfig();
        const content = CHARACTER_CLASS_IDS.map((classId) => {
          const entry = balance[classId] || DEFAULT_CHARACTER_BALANCE[classId] || DEFAULT_CHARACTER_BALANCE.warrior;
          const skillMultiplier = formatMultiplier(entry.skill ?? 1);
          const statMultipliers = entry.stats || {};
          const statOffsets = entry.offsets || {};
          const rows = TIERS.map((tier) => {
            const def = findCharacterDefinitionForSnapshot(classId, tier);
            if(!def) return '';
            const baseStats = def.stats || {};
            return `<tr>
              <td>${tier}</td>
              ${CHARACTER_SNAPSHOT_FIELDS.map((field) => `<td>${formatSnapshotCell(baseStats[field.key], Number(statMultipliers[field.key] ?? 1), Number(statOffsets[field.key] ?? 0), field.type)}</td>`).join('')}
            </tr>`;
          }).filter(Boolean).join('');
          if(!rows) return '';
          const classLabel = CLASS_LABELS[classId] || classId;
          return `
            <div class="balance-snapshot-class">
              <div class="balance-snapshot-header"><strong>${classLabel}</strong><span>스킬 배율 ${skillMultiplier}×</span></div>
              <table class="stats balance-snapshot-table">
                <thead>
                  <tr><th>티어</th>${CHARACTER_SNAPSHOT_FIELDS.map((field) => `<th>${field.label}</th>`).join('')}</tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          `;
        }).filter(Boolean).join('');
        els.characterBalanceSnapshot.innerHTML = content || '<p class="muted">표시할 캐릭터 정보가 없습니다.</p>';
      }

      const CHARACTER_SNAPSHOT_FIELDS = [
        { key: 'hp', label: 'HP', type: 'flat' },
        { key: 'atk', label: 'ATK', type: 'flat' },
        { key: 'def', label: 'DEF', type: 'flat' },
        { key: 'speed', label: 'SPD', type: 'flat' },
        { key: 'critRate', label: 'CRI', type: 'percent' },
        { key: 'critDmg', label: 'CRIT DMG', type: 'percent' },
        { key: 'dodge', label: 'DODGE', type: 'percent' }
      ];

      function formatOffsetDisplay(field, value){
        if(!Number.isFinite(value)) return '0';
        if(value === 0){
          if(field === 'critRate' || field === 'critDmg' || field === 'dodge') return '0%p';
          return '0';
        }
        const sign = value > 0 ? '+' : '-';
        const absValue = Math.abs(value);
        if(field === 'critRate' || field === 'critDmg' || field === 'dodge'){
          const rounded = Math.round(absValue * 10) / 10;
          return `${sign}${rounded}%p`;
        }
        const absText = absValue.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
        return `${sign}${absText}`;
      }

      function findCharacterDefinitionForSnapshot(classId, tier){
        const ids = CHARACTER_IDS_BY_TIER[tier] || [];
        for(const id of ids){
          const def = getCharacterDefinition(id);
          if(def?.classId === classId){
            return def;
          }
        }
        return null;
      }

      function formatSnapshotCell(baseValue, multiplier, offset, type, showDetails = true){
        if(!(typeof baseValue === 'number' && isFinite(baseValue))) return '-';
        const safeMultiplier = typeof multiplier === 'number' && isFinite(multiplier) && multiplier >= 0 ? multiplier : 1;
        const safeOffset = typeof offset === 'number' && isFinite(offset) ? offset : 0;
        const adjusted = baseValue * safeMultiplier + safeOffset;
        if(type === 'percent'){
          const baseRounded = Math.round(baseValue * 10) / 10;
          const adjustedRounded = Math.round(adjusted * 10) / 10;
          const baseText = `${baseRounded}%`;
          const adjustedText = `${adjustedRounded}%`;
          if(!showDetails || Math.abs(adjusted - baseValue) < 0.001){
            return adjustedText;
          }
          const delta = adjustedRounded - baseRounded;
          const deltaText = delta === 0 ? '' : ` (${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10}%p)`;
          return `${adjustedText} <span class="muted">(기본 ${baseText}${deltaText})</span>`;
        }
        const baseText = baseValue.toLocaleString('ko-KR');
        const adjustedText = adjusted.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
        if(!showDetails || Math.abs(adjusted - baseValue) < 0.001){
          return adjustedText;
        }
        const delta = adjusted - baseValue;
        const deltaAbs = Math.abs(delta).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
        const deltaText = delta === 0 ? '' : ` (${delta > 0 ? '+' : ''}${deltaAbs})`;
        return `${adjustedText} <span class="muted">(기본 ${baseText}${deltaText})</span>`;
      }

      function refreshCharacterBalanceEffects(){
        updateInventoryView();
        updateCharacterList();
        renderCharacterStats();
        syncStats();
        drawChart();
        updateWinProbView();
      }

      function handleCharacterBalanceInput(event){
        const target = event.target;
        if(!(target instanceof HTMLInputElement)) return;
        const classId = target.dataset.class;
        const field = target.dataset.field;
        if(!classId || !field) return;
        if(state.config.locked || !isAdmin()){
          updateCharacterBalanceInputs();
          setCharacterBalanceMsg('설정이 잠겨 있어 수정할 수 없습니다.', 'warn');
          return;
        }
        let value = parseFloat(target.value);
        if(!Number.isFinite(value)) value = 1;
        if(value < 0) value = 0;
        const balance = ensureCharacterBalanceConfig();
        const entry = balance[classId] || (balance[classId] = JSON.parse(JSON.stringify(DEFAULT_CHARACTER_BALANCE[classId] || DEFAULT_CHARACTER_BALANCE.warrior)));
        if(field === 'skill'){
          entry.skill = value;
        } else if(entry.stats && field in entry.stats){
          entry.stats[field] = value;
        }
        state.config.characterBalance = balance;
        if(userProfile?.config){
          userProfile.config.characterBalance = balance;
        }
        if(isAdmin()){
          persistGlobalConfig(state.config, { activePresetId: state.presets.activeGlobalId, activePresetName: state.presets.activeGlobalName });
        }
        updateCharacterBalanceInputs();
        const label = CLASS_LABELS[classId] || classId;
        const fieldLabel = (CHARACTER_BALANCE_FIELDS.find((f)=>f.key === field)?.label) || field.toUpperCase();
        setCharacterBalanceMsg(`${label} ${fieldLabel} 배율을 ${formatMultiplier(value)}로 설정했습니다.`, 'ok');
        markProfileDirty();
        refreshCharacterBalanceEffects();
      }

      function handleCharacterBalanceOffsetInput(event){
        const target = event.target;
        if(!(target instanceof HTMLInputElement)) return;
        const classId = target.dataset.class;
        const field = target.dataset.field;
        if(!classId || !field) return;
        if(state.config.locked || !isAdmin()){
          updateCharacterBalanceInputs();
          setCharacterBalanceMsg('설정이 잠겨 있어 수정할 수 없습니다.', 'warn');
          return;
        }
        let value = parseFloat(target.value);
        if(!Number.isFinite(value)) value = 0;
        const balance = ensureCharacterBalanceConfig();
        const entry = balance[classId] || (balance[classId] = JSON.parse(JSON.stringify(DEFAULT_CHARACTER_BALANCE[classId] || DEFAULT_CHARACTER_BALANCE.warrior)));
        if(!entry.offsets) entry.offsets = JSON.parse(JSON.stringify(DEFAULT_CHARACTER_BALANCE[classId].offsets));
        entry.offsets[field] = value;
        state.config.characterBalance = balance;
        if(userProfile?.config){
          userProfile.config.characterBalance = balance;
        }
        if(isAdmin()){
          persistGlobalConfig(state.config, { activePresetId: state.presets.activeGlobalId, activePresetName: state.presets.activeGlobalName });
        }
        updateCharacterBalanceInputs();
        const label = CLASS_LABELS[classId] || classId;
        const fieldLabel = (CHARACTER_BALANCE_FIELDS.find((f)=>f.key === field)?.label) || field.toUpperCase();
        setCharacterBalanceMsg(`${label} ${fieldLabel} 보정을 ${formatOffsetDisplay(field, value)}로 설정했습니다.`, 'ok');
        markProfileDirty();
        refreshCharacterBalanceEffects();
      }

      function sanitizeItems(raw){
        const template = { potion:0, hyperPotion:0, protect:0, enhance:0, revive:0, battleRes:0, holyWater:0, petTicket:0 };
        const result = {...template};
        if(raw && typeof raw === 'object'){
          Object.keys(template).forEach(function(key){
            result[key] = clampNumber(raw[key], 0, Number.MAX_SAFE_INTEGER, 0);
          });
        }
        return result;
      }

      function isLegacyMultipliers(arr){
        if(!Array.isArray(arr) || arr.length !== 21) return false;
        for(let lv=1; lv<=19; lv++){
          const expected = 1 + 0.1 * lv;
          if(Math.abs((arr[lv] || 0) - expected) > 1e-4) return false;
        }
        return Math.abs((arr[20] || 0) - 21) <= 1e-3;
      }

      function isLegacyProbs(arr){
        if(!Array.isArray(arr) || arr.length !== 21) return false;
        for(let lv=1; lv<=20; lv++){
          const expected = 0.99 - ((lv - 1) * (0.99 - 0.001)) / 19;
          if(Math.abs((arr[lv] || 0) - expected) > 1e-4) return false;
        }
        return true;
      }

      function sanitizeEnhanceConfig(raw){
        const base = defaultEnhance();
        if(!raw || typeof raw !== 'object') return base;

        const useLegacyMultipliers = isLegacyMultipliers(raw.multipliers);
        const useLegacyProbs = isLegacyProbs(raw.probs);

        if(!useLegacyMultipliers && Array.isArray(raw.multipliers) && raw.multipliers.length === base.multipliers.length){
          base.multipliers = base.multipliers.map(function(def, idx){
            const val = raw.multipliers[idx];
            return (typeof val === 'number' && isFinite(val) && val > 0) ? val : def;
          });
        }

        if(!useLegacyProbs && Array.isArray(raw.probs) && raw.probs.length === base.probs.length){
          base.probs = base.probs.map(function(def, idx){
            const val = raw.probs[idx];
            if(typeof val === 'number' && isFinite(val) && val >= 0 && val <= 1){
              return val;
            }
            return def;
          });
        }

        return base;
      }

      function sanitizeSession(raw){
        const counts = Object.fromEntries(TIERS.map(t=>[t,0]));
        const result = { draws: 0, counts, history: [] };
        if(raw && typeof raw === 'object'){
          result.draws = clampNumber(raw.draws, 0, Number.MAX_SAFE_INTEGER, 0);
          if(raw.counts && typeof raw.counts === 'object'){
            TIERS.forEach(function(tier){
              counts[tier] = clampNumber(raw.counts[tier], 0, Number.MAX_SAFE_INTEGER, 0);
            });
          }
          if(Array.isArray(raw.history)){
            result.history = raw.history.slice(-500).map(function(entry, idx){
              if(!entry || typeof entry !== 'object') return null;
              const tier = TIERS.includes(entry.tier) ? entry.tier : 'D';
              const part = PART_KEYS.includes(entry.part) ? entry.part : 'head';
              return {
                id: clampNumber(entry.id, 0, Number.MAX_SAFE_INTEGER, idx+1),
                tier,
                ts: clampNumber(entry.ts, 0, Number.MAX_SAFE_INTEGER, Date.now()),
                runId: clampNumber(entry.runId, 0, Number.MAX_SAFE_INTEGER, 0),
                cfgHash: typeof entry.cfgHash === 'string' ? entry.cfgHash : '',
                part,
                stat: clampNumber(entry.stat, 0, Number.MAX_SAFE_INTEGER, 0)
              };
            }).filter(Boolean);
          }
        }
        return result;
      }

      function sanitizePresetName(raw, fallback){
        if(typeof raw === 'string' && raw.trim().length){
          const name = raw.trim();
          return name.length > 60 ? name.slice(0, 60) : name;
        }
        return fallback || '프리셋';
      }

      function sanitizePresetRecord(id, raw, fallbackName){
        if(!raw || typeof raw !== 'object') return null;
        const config = sanitizeConfig(raw.config || raw);
        const name = sanitizePresetName(raw.name, fallbackName);
        const createdAt = clampNumber(raw.createdAt, 0, Number.MAX_SAFE_INTEGER, Date.now());
        const updatedAt = clampNumber(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER, createdAt);
        const createdBy = typeof raw.createdBy === 'string' ? raw.createdBy : null;
        return { id, name, config, createdAt, updatedAt, createdBy };
      }

      function sanitizePresetList(raw){
        const list = [];
        if(raw && typeof raw === 'object'){
          Object.keys(raw).forEach(function(id){
            const preset = sanitizePresetRecord(id, raw[id]);
            if(preset) list.push(preset);
          });
        }
        list.sort(function(a,b){ return (b.updatedAt||0) - (a.updatedAt||0); });
        return list;
      }

      function sanitizeUserPresets(raw){
        return sanitizePresetList(raw);
      }

      function personalPresetsToMap(list){
        const out = {};
        list.forEach(function(preset){
          out[preset.id] = {
            name: preset.name,
            config: sanitizeConfig(preset.config),
            createdAt: preset.createdAt,
            updatedAt: preset.updatedAt,
            createdBy: preset.createdBy || null
          };
        });
        return out;
      }

      function sanitizeSelectedPreset(raw){
        if(!raw || typeof raw !== 'object') return { scope: null, id: null };
        const scope = raw.scope === 'global' || raw.scope === 'personal' ? raw.scope : null;
        const id = typeof raw.id === 'string' && raw.id.trim().length ? raw.id.trim() : null;
        return { scope, id };
      }

      function generatePresetId(prefix){
        const base = typeof prefix === 'string' && prefix.length ? prefix : 'preset';
        if(typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'){
          return `${base}-${crypto.randomUUID()}`;
        }
        return `${base}-${Date.now().toString(36)}-${Math.floor(Math.random()*1e6).toString(36)}`;
      }

      async function loadGlobalPresets(){ try {
          const snapshot = await get(ref(db, 'config/presets'));
          const list = snapshot.exists() ? sanitizePresetList(snapshot.val()) : [];
          state.presets.global = list;
          refreshPresetSelectors();
        } catch (error) {
          console.error('프리셋 목록을 불러오지 못했습니다.', error);
          setAdminPresetMsg('프리셋 목록을 불러오지 못했습니다.', 'error');
        }
      }

      function refreshPresetSelectors(){
        updateAdminPresetSelector();
        updateUserPresetSelectors();
      }

      function updateAdminPresetSelector(){ const select = els.adminPresetSelect; if(!select) return; const activeId = state.presets.activeGlobalId; const currentValue = select.value; select.innerHTML=''; const placeholder = document.createElement('option'); placeholder.value=''; placeholder.textContent = state.presets.global.length? '프리셋 선택':'프리셋 없음'; select.appendChild(placeholder); state.presets.global.forEach(function(preset){ const opt = document.createElement('option'); opt.value = preset.id; opt.textContent = preset.name + (preset.id === activeId ? ' (적용중)' : ''); select.appendChild(opt); }); if(state.presets.global.some(function(p){ return p.id === currentValue; })){ select.value = currentValue; } else if(activeId && state.presets.global.some(function(p){ return p.id === activeId; })){ select.value = activeId; }
      }

      function updateUserPresetSelectors(){ const globalSelect = els.globalPresetSelect; if(globalSelect){ const prev = globalSelect.value; globalSelect.innerHTML=''; const none = document.createElement('option'); none.value=''; none.textContent='선택 안함'; globalSelect.appendChild(none); state.presets.global.forEach(function(preset){ const opt = document.createElement('option'); opt.value = preset.id; opt.textContent = preset.name; globalSelect.appendChild(opt); }); const preferred = state.selectedPreset.scope==='global'? state.selectedPreset.id : (state.presets.activeGlobalId||''); if(preferred && state.presets.global.some(function(p){ return p.id===preferred; })){ globalSelect.value = preferred; } else if(state.presets.global.some(function(p){ return p.id===prev; })){ globalSelect.value = prev; } else { globalSelect.value=''; }
        }
        const personalSelect = els.personalPresetSelect; if(personalSelect){ const prev = personalSelect.value; personalSelect.innerHTML=''; const none = document.createElement('option'); none.value=''; none.textContent='선택 안함'; personalSelect.appendChild(none); state.presets.personal.forEach(function(preset){ const opt = document.createElement('option'); opt.value = preset.id; opt.textContent = preset.name; personalSelect.appendChild(opt); }); if(state.selectedPreset.scope==='personal' && state.presets.personal.some(function(p){ return p.id===state.selectedPreset.id; })){ personalSelect.value = state.selectedPreset.id; } else if(state.presets.personal.some(function(p){ return p.id===prev; })){ personalSelect.value = prev; } else { personalSelect.value=''; }
        }
        updateDiamondsView();
      }

      function clearActivePreset(){ state.presets.activeGlobalId = null; state.presets.activeGlobalName = null; updateAdminPresetSelector(); }

      function clearSelectedPreset(){ state.selectedPreset = { scope:null, id:null }; if(userProfile){ userProfile.selectedPreset = null; if(!isAdmin()) markProfileDirty(); }
        if(!isAdmin()) state.ui.userEditEnabled = false;
        updateUserPresetSelectors();
        updateUserEditModeView();
        toggleConfigDisabled(); }

      function findGlobalPreset(id){ if(!id) return null; return state.presets.global.find(function(p){ return p.id === id; }) || null; }

      function findPersonalPreset(id){ if(!id) return null; return state.presets.personal.find(function(p){ return p.id === id; }) || null; }

      function setConfigFromPreset(preset){ if(!preset) return; state.config = sanitizeConfig(preset.config); userProfile.config = state.config; reflectConfig(); updateWeightsInputs(); refreshProbsAndStats(); if(!isAdmin()) state.ui.userEditEnabled = false; updateUserEditModeView(); toggleConfigDisabled(); markProfileDirty(); }

      function updateUserEditModeView(){ if(isAdmin()){ state.ui.userEditEnabled = true; if(els.toggleUserEdit) els.toggleUserEdit.style.display = 'none'; return; }
        if(els.toggleUserEdit){ els.toggleUserEdit.style.display=''; els.toggleUserEdit.textContent = state.ui.userEditEnabled ? '설정 편집 모드 해제' : '설정 편집 모드'; }
      }

      async function applyAdminPreset(preset){ if(!isAdmin() || !preset) return; setConfigFromPreset(preset); state.presets.activeGlobalId = preset.id; state.presets.activeGlobalName = preset.name; await persistGlobalConfig(state.config, { activePresetId: preset.id, activePresetName: preset.name }); updateAdminPresetSelector(); updateUserPresetSelectors(); markProfileDirty(); setAdminPresetMsg(`'${preset.name}' 프리셋을 전역 설정으로 적용했습니다.`, 'ok'); }

      function loadAdminPresetForEditing(preset){ if(!isAdmin() || !preset) return; setConfigFromPreset(preset); clearActivePreset(); setAdminPresetMsg(`'${preset.name}' 프리셋을 불러왔습니다. 적용하려면 저장 또는 프리셋 적용을 실행하세요.`, 'warn'); }

      function applyGlobalPresetForUser(preset, options){ if(!preset) return false; const silent = !!(options && options.silent); setConfigFromPreset(preset); state.selectedPreset = { scope:'global', id: preset.id }; if(userProfile){ userProfile.selectedPreset = { scope:'global', id: preset.id }; } updateUserPresetSelectors(); if(!silent){ setPresetMsg(`'${preset.name}' 프리셋을 적용했습니다.`, 'ok'); markProfileDirty(); } return true; }

      function applyPersonalPresetForUser(preset, options){ if(!preset) return false; const silent = !!(options && options.silent); setConfigFromPreset(preset); state.selectedPreset = { scope:'personal', id: preset.id }; if(userProfile){ userProfile.selectedPreset = { scope:'personal', id: preset.id }; } updateUserPresetSelectors(); if(!silent){ setPresetMsg(`나의 프리셋 '${preset.name}'을 적용했습니다.`, 'ok'); markProfileDirty(); } return true; }

      function applySelectedPresetIfAvailable(isAdminRole){ if(isAdminRole) { updateUserPresetSelectors(); return; } if(state.selectedPreset.scope === 'personal'){ const preset = findPersonalPreset(state.selectedPreset.id); if(preset){ applyPersonalPresetForUser(preset, {silent:true}); return; } clearSelectedPreset(); return; } if(state.selectedPreset.scope === 'global'){ const preset = findGlobalPreset(state.selectedPreset.id); if(preset){ applyGlobalPresetForUser(preset, {silent:true}); return; } clearSelectedPreset(); return; } updateUserPresetSelectors(); }

      async function handleAdminPresetSave(){ if(!isAdmin()) return; const nameRaw = els.adminPresetName?.value || ''; const name = sanitizePresetName(nameRaw, '새 프리셋'); if(!name.trim()){ setAdminPresetMsg('프리셋 이름을 입력하세요.', 'warn'); return; } const id = generatePresetId('preset'); const now = Date.now(); const payload = { name, config: sanitizeConfig(state.config), createdAt: now, updatedAt: now, createdBy: state.user ? state.user.uid : null }; try {
          await set(ref(db, `config/presets/${id}`), payload);
          if(els.adminPresetName) els.adminPresetName.value = '';
          setAdminPresetMsg('프리셋을 저장했습니다.', 'ok');
          await loadGlobalPresets();
        } catch (error) {
          console.error('프리셋 저장 실패', error);
          setAdminPresetMsg('프리셋 저장에 실패했습니다.', 'error');
        }
      }

      async function handleAdminPresetDelete(){ if(!isAdmin()) return; const id = els.adminPresetSelect?.value || ''; if(!id){ setAdminPresetMsg('삭제할 프리셋을 선택하세요.', 'warn'); return; } try {
          await set(ref(db, `config/presets/${id}`), null);
          if(state.selectedPreset.scope === 'global' && state.selectedPreset.id === id){
            clearSelectedPreset();
          }
          if(state.presets.activeGlobalId === id){
            clearActivePreset();
            await persistGlobalConfig(state.config, { activePresetId: null, activePresetName: null });
          }
          setAdminPresetMsg('프리셋을 삭제했습니다.', 'ok');
          await loadGlobalPresets();
        } catch (error) {
          console.error('프리셋 삭제 실패', error);
          setAdminPresetMsg('프리셋 삭제에 실패했습니다.', 'error');
        }
      }

      async function handleSavePersonalPreset(){ if(isAdmin()){ setPresetMsg('관리자는 개인 프리셋을 만들 필요가 없습니다.', 'warn'); return; }
        if(!userProfile){ setPresetMsg('사용자 정보를 불러오지 못했습니다.', 'error'); return; }
        if(!spendDiamonds(1)){ setPresetMsg('다이아가 부족합니다.', 'error'); return; }
        const nameRaw = els.personalPresetName?.value || ''; const name = sanitizePresetName(nameRaw, '나의 프리셋'); const id = generatePresetId('my'); const now = Date.now(); const record = { id, name, config: sanitizeConfig(state.config), createdAt: now, updatedAt: now, createdBy: state.user ? state.user.uid : null };
        state.presets.personal.push(record);
        state.presets.personal.sort(function(a,b){ return (b.updatedAt||0) - (a.updatedAt||0); });
        state.selectedPreset = { scope:'personal', id };
        userProfile.presets = personalPresetsToMap(state.presets.personal);
        userProfile.selectedPreset = { scope:'personal', id };
        updateUserPresetSelectors();
        if(els.personalPresetName) els.personalPresetName.value = '';
        setPresetMsg(`나의 프리셋 '${record.name}'을 저장했습니다.`, 'ok');
        markProfileDirty();
      }

      async function loadAdminUsers(){ if(!isAdmin()) return; try {
          const snapshot = await get(ref(db, 'users'));
          const list = [];
          if(snapshot.exists()){
            const raw = snapshot.val();
            Object.keys(raw).forEach(function(uid){
              const info = raw[uid] || {};
              const role = info.role || 'user';
              const wallet = typeof info.wallet === 'number' ? info.wallet : null;
              const gold = typeof info.gold === 'number' ? info.gold : null;
              const diamonds = clampNumber(info.diamonds, 0, Number.MAX_SAFE_INTEGER, 0);
              const username = sanitizeUsername(info.username, uid);
              const items = sanitizeItems(info.items);
              const petTickets = items.petTicket || 0;
              list.push({ uid, username, role, wallet, gold, diamonds, petTickets });
            });
          }
          list.sort(function(a,b){ return a.username.localeCompare(b.username, 'ko-KR', { sensitivity:'base', numeric:true }); });
          state.adminUsers = list;
          populateAdminUserSelect();
          await refreshAdminBackups({ silent: true });
        } catch (error) {
          console.error('사용자 목록을 불러오지 못했습니다.', error);
          setAdminMsg('사용자 목록을 불러오지 못했습니다.', 'error');
        }
      }

      function populateAdminUserSelect(){ const select = els.adminUserSelect; if(!select) return; const prev = select.value; const users = Array.isArray(state.adminUsers) ? state.adminUsers : []; const wasAllSelection = prev === ALL_USERS_OPTION; const hasPrevUser = users.some(function(u){ return u.uid === prev; }); select.innerHTML=''; const placeholder = document.createElement('option'); placeholder.value=''; placeholder.textContent = users.length ? '사용자를 선택하세요' : '사용자 없음'; select.appendChild(placeholder); const allOption = document.createElement('option'); allOption.value = ALL_USERS_OPTION; allOption.textContent = '전체 사용자 (우편 발송)'; select.appendChild(allOption); users.forEach(function(user){ const opt = document.createElement('option'); opt.value = user.uid; opt.textContent = `${user.username}${user.role==='admin'?' (관리자)':''}`; select.appendChild(opt); }); if(wasAllSelection){ select.value = ALL_USERS_OPTION; } else if(hasPrevUser){ select.value = prev; } updateAdminUserStats(); }

      function updateAdminUserStats(){
        const select = els.adminUserSelect;
        const statsEl = els.adminUserStats;
        if(!select || !statsEl) return;
        const uid = select.value;
        if(!uid){ statsEl.textContent = ''; return; }
        if(uid === ALL_USERS_OPTION){
          const users = Array.isArray(state.adminUsers) ? state.adminUsers : [];
          if(!users.length){ statsEl.textContent = '지급 대상 사용자가 없습니다.'; return; }
          const eligible = users.filter(function(user){ return user && user.role !== 'admin'; }).length;
          const adminCount = users.length - eligible;
          let line = `전체 지급 대상: 일반 ${formatNum(eligible)}명`;
          if(adminCount > 0){ line += `, 관리자 ${formatNum(adminCount)}명`; }
          line += '. 골드/포인트/펫 뽑기권은 일반 유저에게만 지급됩니다.';
          statsEl.textContent = line;
          return;
        }
        const info = state.adminUsers.find(function(u){ return u.uid === uid; });
        if(!info){ statsEl.textContent = ''; return; }
        const walletText = info.wallet === null ? '∞' : formatNum(info.wallet||0);
        const goldText = info.gold === null ? '∞' : formatNum(info.gold||0);
        const petTicketText = info.role === 'admin' ? '∞' : formatNum(info.petTickets || 0);
        statsEl.textContent = `포인트 ${walletText} / 골드 ${goldText} / 다이아 ${formatNum(info.diamonds||0)} / 펫 뽑기권 ${petTicketText}`;
      }

      function setBackupMsg(text, tone){
        if(!els.adminBackupStatus) return;
        els.adminBackupStatus.textContent = text || '';
        els.adminBackupStatus.classList.remove('msg-ok','msg-warn','msg-danger');
        if(!tone) return;
        if(tone === 'ok') els.adminBackupStatus.classList.add('msg-ok');
        else if(tone === 'warn') els.adminBackupStatus.classList.add('msg-warn');
        else if(tone === 'error') els.adminBackupStatus.classList.add('msg-danger');
      }

      function resetSnapshotSelect(label){
        if(!els.adminSnapshotSelect) return;
        els.adminSnapshotSelect.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = label;
        els.adminSnapshotSelect.appendChild(opt);
      }

      function clearBackupUi(){
        resetSnapshotSelect('스냅샷 없음');
        if(els.adminSnapshotTableBody) els.adminSnapshotTableBody.innerHTML = '';
      }

      function renderAdminSnapshotList(){
        const snapshots = Array.isArray(state.backups.snapshots) ? state.backups.snapshots : [];
        if(!els.adminSnapshotTableBody) return;
        resetSnapshotSelect(snapshots.length ? '스냅샷 선택' : '스냅샷 없음');
        if(snapshots.length && els.adminSnapshotSelect){
          snapshots.forEach(function(entry){
            const opt = document.createElement('option');
            opt.value = entry.key;
            opt.textContent = entry.label;
            els.adminSnapshotSelect.appendChild(opt);
          });
        }
        els.adminSnapshotTableBody.innerHTML = '';
        if(!snapshots.length) return;
        const frag = document.createDocumentFragment();
        snapshots.forEach(function(entry){
          const tr = document.createElement('tr');
          const keyTd = document.createElement('td');
          keyTd.textContent = entry.key;
          const timeTd = document.createElement('td');
          timeTd.textContent = entry.snapshotAt ? formatDateTime(entry.snapshotAt) : '-';
          const noteTd = document.createElement('td');
          const extras = [];
          if(typeof entry.equipCount === 'number'){ extras.push(`장비 ${formatNum(entry.equipCount)}개`); }
          if(typeof entry.spareCount === 'number'){ extras.push(`예비 ${formatNum(entry.spareCount)}개`); }
          if(entry.walletInfinite){ extras.push('포인트 ∞'); }
          else if(typeof entry.walletValue === 'number'){ extras.push(`포인트 ${formatNum(entry.walletValue)}`); }
          if(entry.goldInfinite){ extras.push('골드 ∞'); }
          else if(typeof entry.goldValue === 'number'){ extras.push(`골드 ${formatNum(entry.goldValue)}`); }
          if(entry.diamondsInfinite){ extras.push('다이아 ∞'); }
          else if(typeof entry.diamondsValue === 'number'){ extras.push(`다이아 ${formatNum(entry.diamondsValue)}`); }
          noteTd.textContent = [entry.note || '', extras.join(' · ')].filter(Boolean).join(' / ');
          tr.appendChild(keyTd);
          tr.appendChild(timeTd);
          tr.appendChild(noteTd);
          frag.appendChild(tr);
        });
        els.adminSnapshotTableBody.appendChild(frag);
      }

      const callRestoreUserProfile = httpsCallable(functions, 'restoreUserProfile');

      async function refreshAdminBackups(options){
        if(!isAdmin()) return;
        const uid = els.adminUserSelect?.value || '';
        if(!uid){
          state.backups = { mirror: null, snapshots: [] };
          clearBackupUi();
          setBackupMsg('사용자를 선택하세요.', 'warn');
          return;
        }
        if(uid === ALL_USERS_OPTION){
          state.backups = { mirror: null, snapshots: [] };
          clearBackupUi();
          setBackupMsg('전체 사용자 선택 시 백업 기능을 사용할 수 없습니다.', 'warn');
          return;
        }
        if(!options || !options.silent){
          resetSnapshotSelect('로딩 중...');
          setBackupMsg('백업 정보를 불러오는 중입니다...', null);
        }
        try {
          const [mirrorSnap, snapshotsSnap] = await Promise.all([
            get(ref(db, `mirrors/${uid}`)),
            get(ref(db, `snapshots/${uid}`))
          ]);
          const mirror = mirrorSnap.exists() ? mirrorSnap.val() : null;
          const snapshotEntries = [];
          if(snapshotsSnap.exists()){
            const raw = snapshotsSnap.val() || {};
            Object.keys(raw).forEach(function(key){
              const entry = raw[key] || {};
              const snapshotAt = typeof entry.snapshotAt === 'number' ? entry.snapshotAt : 0;
              const note = typeof entry.note === 'string' ? entry.note : '';
              const labelTime = snapshotAt ? formatDateTime(snapshotAt) : '시간 정보 없음';
              const equipCount = (entry.equip && typeof entry.equip === 'object')
                ? Object.values(entry.equip).filter(Boolean).length
                : 0;
              const spareCount = (entry.spares && typeof entry.spares === 'object')
                ? Object.values(entry.spares).filter(Boolean).length
                : 0;
              const walletValue = (typeof entry.wallet === 'number' && isFinite(entry.wallet)) ? entry.wallet : null;
              const walletInfinite = entry.wallet === null;
              const goldValue = (typeof entry.gold === 'number' && isFinite(entry.gold)) ? entry.gold : null;
              const goldInfinite = entry.gold === null;
              const diamondsValue = (typeof entry.diamonds === 'number' && isFinite(entry.diamonds)) ? entry.diamonds : null;
              const diamondsInfinite = entry.diamonds === null;
              snapshotEntries.push({
                key,
                snapshotAt,
                note,
                equipCount,
                spareCount,
                walletValue,
                walletInfinite,
                goldValue,
                goldInfinite,
                diamondsValue,
                diamondsInfinite,
                label: `${key} · ${labelTime}`
              });
            });
          }
          snapshotEntries.sort(function(a,b){ return (b.snapshotAt||0) - (a.snapshotAt||0); });
          state.backups.mirror = mirror;
          state.backups.snapshots = snapshotEntries;
          renderAdminSnapshotList();
          if(mirror && mirror.mirroredAt){
            const equipCount = (mirror.equip && typeof mirror.equip === 'object')
              ? Object.values(mirror.equip).filter(Boolean).length
              : 0;
            const spareCount = (mirror.spares && typeof mirror.spares === 'object')
              ? Object.values(mirror.spares).filter(Boolean).length
              : 0;
            const walletText = mirror.wallet === null ? '∞' : (typeof mirror.wallet === 'number' && isFinite(mirror.wallet) ? formatNum(mirror.wallet) : null);
            const goldText = mirror.gold === null ? '∞' : (typeof mirror.gold === 'number' && isFinite(mirror.gold) ? formatNum(mirror.gold) : null);
            const diamondsText = mirror.diamonds === null ? '∞' : (typeof mirror.diamonds === 'number' && isFinite(mirror.diamonds) ? formatNum(mirror.diamonds) : null);
            const resourceParts = [];
            if(walletText) resourceParts.push(`포인트 ${walletText}`);
            if(goldText) resourceParts.push(`골드 ${goldText}`);
            if(diamondsText) resourceParts.push(`다이아 ${diamondsText}`);
            const baseMsg = `미러 복제본 기준 ${formatDateTime(mirror.mirroredAt)} 저장됨 · 장비 ${formatNum(equipCount)}개 / 예비 ${formatNum(spareCount)}개`;
            setBackupMsg(resourceParts.length ? `${baseMsg} / ${resourceParts.join(' · ')}` : baseMsg, 'ok');
          } else {
            setBackupMsg('미러 데이터가 없습니다.', 'warn');
          }
        } catch (error) {
          console.error('백업 정보를 불러오지 못했습니다.', error);
          state.backups.mirror = null;
          state.backups.snapshots = [];
          clearBackupUi();
          setBackupMsg('백업 정보를 불러오지 못했습니다.', 'error');
        }
      }

      async function restoreFromMirror(){
        if(!isAdmin()) return;
        const uid = els.adminUserSelect?.value || '';
        if(!uid){ setBackupMsg('복원할 사용자를 선택하세요.', 'warn'); return; }
        if(!window.confirm('미러 백업으로 즉시 복원합니다. 계속할까요?')) return;
        setBackupMsg('미러 복원을 진행 중입니다...', null);
        try {
          await callRestoreUserProfile({ targetUid: uid, source: 'mirror' });
          setBackupMsg('미러 데이터로 복원했습니다.', 'ok');
          await refreshAdminBackups({ silent: true });
        } catch (error) {
          console.error('미러 복원 실패', error);
          const message = error?.message || '미러 복원 중 오류가 발생했습니다.';
          setBackupMsg(message, 'error');
        }
      }

      async function restoreFromSnapshot(){
        if(!isAdmin()) return;
        const uid = els.adminUserSelect?.value || '';
        if(!uid){ setBackupMsg('복원할 사용자를 선택하세요.', 'warn'); return; }
        const snapshotId = els.adminSnapshotSelect?.value || '';
        if(!snapshotId){ setBackupMsg('복원할 스냅샷을 선택하세요.', 'warn'); return; }
        if(!window.confirm(`스냅샷 '${snapshotId}'로 복원합니다. 계속할까요?`)) return;
        setBackupMsg('스냅샷 복원을 진행 중입니다...', null);
        try {
          await callRestoreUserProfile({ targetUid: uid, source: 'snapshot', snapshotId });
          setBackupMsg('스냅샷 복원이 완료되었습니다.', 'ok');
          await refreshAdminBackups({ silent: true });
        } catch (error) {
          console.error('스냅샷 복원 실패', error);
          const message = error?.message || '스냅샷 복원 중 오류가 발생했습니다.';
          setBackupMsg(message, 'error');
        }
      }

      async function handleAdminGrantResources(){ if(!isAdmin()) return; const uid = els.adminUserSelect?.value || ''; if(!uid){ setAdminMsg('지급할 대상을 선택하세요.', 'warn'); return; } const points = parseInt(els.adminGrantPoints?.value||'0', 10) || 0; const gold = parseInt(els.adminGrantGold?.value||'0', 10) || 0; const diamonds = parseInt(els.adminGrantDiamonds?.value||'0', 10) || 0; const petTickets = parseInt(els.adminGrantPetTickets?.value||'0', 10) || 0; if(points===0 && gold===0 && diamonds===0 && petTickets===0){ setAdminMsg('지급할 수치를 입력하세요.', 'warn'); return; }
        const deltas = { points, gold, diamonds, petTickets };
        const targetAll = uid === ALL_USERS_OPTION;
        try {
          if(targetAll){
            if(!Array.isArray(state.adminUsers) || !state.adminUsers.length){ await loadAdminUsers(); }
            const users = Array.isArray(state.adminUsers) ? state.adminUsers : [];
            const eligibleCount = users.filter(function(user){ return user && user.role !== 'admin'; }).length;
            if(eligibleCount === 0){ setAdminMsg('지급 대상 일반 사용자가 없습니다.', 'warn'); return; }
            if(!window.confirm(`일반 사용자 ${formatNum(eligibleCount)}명에게 보상을 지급합니다. 계속할까요?`)) return;
            const delivered = await grantResourcesToAllUsers(deltas);
            if(delivered <= 0){ setAdminMsg('지급 가능한 사용자가 없습니다.', 'warn'); return; }
            resetAdminGrantInputs();
            await loadAdminUsers();
            if(els.adminUserSelect){ els.adminUserSelect.value = ALL_USERS_OPTION; }
            updateAdminUserStats();
            refreshAdminBackups({ silent: true });
            setAdminMsg(`전체 ${formatNum(delivered)}명에게 지급 우편을 발송했습니다. 우편함에서 수령하세요.`, 'ok');
          } else {
            const updated = await grantResourcesToUser(uid, deltas);
            if(!updated){ setAdminMsg('지급할 수치를 적용할 수 없습니다.', 'warn'); return; }
            resetAdminGrantInputs();
            await loadAdminUsers();
            if(els.adminUserSelect){ els.adminUserSelect.value = uid; }
            updateAdminUserStats();
            refreshAdminBackups({ silent: true });
            setAdminMsg('지급 우편을 발송했습니다. 우편함에서 수령하세요.', 'ok');
          }
        } catch (error) {
          console.error('지급 처리 실패', error);
          setAdminMsg('지급 처리에 실패했습니다.', 'error');
        }
      }

      async function grantResourcesToAllUsers(deltas){
        if(!isAdmin()) return 0;
        if(!Array.isArray(state.adminUsers) || !state.adminUsers.length){
          await loadAdminUsers();
        }
        const users = Array.isArray(state.adminUsers) ? state.adminUsers : [];
        const targets = users.filter(function(user){ return user && user.uid && user.role !== 'admin'; });
        if(!targets.length) return 0;
        let success = 0;
        for(const user of targets){
          try {
            const updated = await grantResourcesToUser(user.uid, deltas);
            if(updated){ success += 1; }
          } catch (error) {
            console.error('지급 처리 실패', error);
          }
        }
        return success;
      }

      function resetAdminGrantInputs(){
        if(els.adminGrantPoints) els.adminGrantPoints.value = '0';
        if(els.adminGrantGold) els.adminGrantGold.value = '0';
        if(els.adminGrantDiamonds) els.adminGrantDiamonds.value = '0';
        if(els.adminGrantPetTickets) els.adminGrantPetTickets.value = '0';
      }

      async function grantResourcesToUser(uid, deltas){
        const userRef = ref(db, `users/${uid}`);
        const snapshot = await get(userRef);
        if(!snapshot.exists()) throw new Error('사용자를 찾을 수 없습니다.');
        const data = snapshot.val() || {};
        const role = data.role === 'admin' ? 'admin' : 'user';
        const canModifyEconomy = role !== 'admin';
        const rewards = {};
        if(typeof deltas.points === 'number' && deltas.points > 0 && canModifyEconomy){ rewards.points = Math.trunc(deltas.points); }
        if(typeof deltas.gold === 'number' && deltas.gold > 0 && canModifyEconomy){ rewards.gold = Math.trunc(deltas.gold); }
        if(typeof deltas.diamonds === 'number' && deltas.diamonds > 0){ rewards.diamonds = Math.trunc(deltas.diamonds); }
        if(typeof deltas.petTickets === 'number' && deltas.petTickets > 0 && canModifyEconomy){ rewards.petTickets = Math.trunc(deltas.petTickets); }
        if(Object.keys(rewards).length === 0) return false;
        const parts = [];
        if(rewards.points) parts.push(`포인트 ${formatNum(rewards.points)}`);
        if(rewards.gold) parts.push(`골드 ${formatNum(rewards.gold)}`);
        if(rewards.diamonds) parts.push(`다이아 ${formatNum(rewards.diamonds)}`);
        if(rewards.petTickets) parts.push(`펫 뽑기권 ${formatNum(rewards.petTickets)}`);
        const message = `관리자가 다음 보상을 지급했습니다.
${parts.join(', ')}`;
        await enqueueMail(uid, {
          title: '관리자 지급 보상',
          message,
          rewards,
          type: 'admin_grant',
          metadata: {
            grantedBy: currentFirebaseUser?.uid || null,
            grantedAt: Date.now()
          }
        });
        return true;
      }

      function detachProfileListener(){ if(state.profileListener){ try { state.profileListener(); } catch (err) { console.warn('프로필 리스너 해제 실패', err); } state.profileListener = null; } }

      function detachGlobalConfigListener(){
        if(state.globalConfigListener){
          try {
            state.globalConfigListener();
          } catch (err) {
            console.warn('전역 설정 리스너 해제 실패', err);
          }
          state.globalConfigListener = null;
        }
      }

      function sameEquipMap(a, b){
        return JSON.stringify(a) === JSON.stringify(b);
      }

      function attachProfileListener(uid){ if(!uid) return; detachProfileListener(); const userRef = ref(db, `users/${uid}`); state.profileListener = onValue(userRef, (snapshot)=>{
          if(!snapshot.exists()) return;
          if(!state.user || state.user.uid !== uid) return;
          const data = snapshot.val() || {};
          const role = data.role === 'admin' ? 'admin' : 'user';
          if(state.user.role !== role){ state.user.role = role; }
          const nextEquip = sanitizeEquipMap(data.equip);
          const nextSpares = sanitizeEquipMap(data.spares);
          if(!sameEquipMap(nextEquip, state.equip) || !sameEquipMap(nextSpares, state.spares)){
            state.equip = nextEquip;
            state.spares = nextSpares;
            if(userProfile){
              userProfile.equip = nextEquip;
              userProfile.spares = nextSpares;
            }
            refreshInventoryCache();
            updateInventoryView();
            buildForgeTargetOptions();
            updateForgeInfo();
          }
          const incomingSettings = sanitizeUserSettings(data.settings);
          const currentEffects = state.settings?.effects || {};
          const nextEffects = incomingSettings.effects || {};
          if(currentEffects.characterUltimateGif !== nextEffects.characterUltimateGif || currentEffects.petUltimateGif !== nextEffects.petUltimateGif){
            state.settings = incomingSettings;
            if(userProfile){ userProfile.settings = incomingSettings; }
            if(isUserOptionsOpen()){ syncUserOptionsInputs(); }
          }
          const incomingCharacterStats = sanitizeCharacterDrawStats(data.characterStats);
          const prevCharacterStats = sanitizeCharacterDrawStats(state.characterStats);
          let statsChanged = incomingCharacterStats.draws !== prevCharacterStats.draws;
          if(!statsChanged){
            statsChanged = TIERS.some((tier)=> incomingCharacterStats.counts[tier] !== prevCharacterStats.counts[tier]);
          }
          const isOlderSnapshot =
            incomingCharacterStats.draws < prevCharacterStats.draws ||
            TIERS.some((tier) => incomingCharacterStats.counts[tier] < prevCharacterStats.counts[tier]);
          if(statsChanged && !isOlderSnapshot){
            state.characterStats = incomingCharacterStats;
            if(userProfile){ userProfile.characterStats = incomingCharacterStats; }
            if(state.ui.statsMode === 'character'){
              renderCharacterStats();
            }
          }
          const items = sanitizeItems(data.items);
          const prevItems = state.items || {};
          let itemsChanged = false;
          Object.keys(items).forEach(function(key){ const next = items[key]; if((prevItems[key] || 0) !== next){ itemsChanged = true; } });
          if(itemsChanged){ state.items = { ...prevItems, ...items }; if(userProfile){ if(!userProfile.items || typeof userProfile.items !== 'object'){ userProfile.items = {}; } Object.assign(userProfile.items, items); }
            if(state.profile){ if(!state.profile.items || typeof state.profile.items !== 'object'){ state.profile.items = {}; } Object.assign(state.profile.items, items); }
            updateItemCountsView();
            updateBattleResControls();
          }

          const nextPets = sanitizePetState(data.pets);
          if(JSON.stringify(nextPets) !== JSON.stringify(state.pets)){
            state.pets = nextPets;
            if(userProfile) userProfile.pets = nextPets;
            updatePetList();
          }

          const nextCharacters = sanitizeCharacterState(data.characters);
          if(JSON.stringify(nextCharacters) !== JSON.stringify(state.characters)){
            state.characters = nextCharacters;
            if(userProfile) userProfile.characters = nextCharacters;
            updateCharacterList();
          }

          const nextQuests = sanitizeQuestState(data.quests);
          if(JSON.stringify(nextQuests) !== JSON.stringify(state.quests)){
            state.quests = nextQuests;
            if(userProfile) userProfile.quests = nextQuests;
            if(state.profile) state.profile.quests = nextQuests;
            refreshQuestView();
            recoverPendingQuestRewards();
          }

          if(role === 'admin'){ return; }
          if(typeof data.wallet === 'number' && isFinite(data.wallet)){
            const walletVal = clampNumber(data.wallet, 0, Number.MAX_SAFE_INTEGER, data.wallet);
            if(walletVal !== state.wallet){ state.wallet = walletVal; if(userProfile) userProfile.wallet = walletVal; if(state.profile) state.profile.wallet = walletVal; updatePointsView(); }
          }
          if(typeof data.gold === 'number' && isFinite(data.gold)){
            const goldVal = clampNumber(data.gold, 0, Number.MAX_SAFE_INTEGER, data.gold);
            if(goldVal !== state.gold){ state.gold = goldVal; if(userProfile) userProfile.gold = goldVal; if(state.profile) state.profile.gold = goldVal; updateGoldView(); }
          }
          if(typeof data.diamonds === 'number' && isFinite(data.diamonds)){
            const diamondsVal = clampNumber(data.diamonds, 0, Number.MAX_SAFE_INTEGER, data.diamonds);
            if(diamondsVal !== state.diamonds){ state.diamonds = diamondsVal; if(userProfile) userProfile.diamonds = diamondsVal; if(state.profile) state.profile.diamonds = diamondsVal; updateDiamondsView(); }
          }
        }, (error)=>{
          console.error('프로필 실시간 수신 실패', error);
        }); }

      function applyGlobalConfigUpdate(raw){
        if(!state.user) return;
        const payload = (raw && typeof raw === 'object') ? raw : {};
        const configSource = (payload.config && typeof payload.config === 'object') ? payload.config : payload;
        state.config = sanitizeConfig(configSource);
        state.enhance = sanitizeEnhanceConfig(payload.enhance);
        const activePresetId = typeof payload.activePresetId === 'string' ? payload.activePresetId : null;
        const activePresetName = typeof payload.activePresetName === 'string' ? payload.activePresetName : null;
        state.presets.activeGlobalId = activePresetId;
        state.presets.activeGlobalName = activePresetName;

        buildForgeTable();
        updateForgeInfo();
        reflectConfig();

        if(userProfile){
          userProfile.config = state.config;
          userProfile.petGachaWeights = state.petGachaWeights;
          if(userProfile.enhance){
            delete userProfile.enhance;
          }
        }

        updateAdminPresetSelector();
        updateUserPresetSelectors();
      }

      function attachGlobalConfigListener(){
        if(!state.user) return;
        detachGlobalConfigListener();
        const globalRef = ref(db, GLOBAL_CONFIG_PATH);
        state.globalConfigListener = onValue(globalRef, (snapshot)=>{
          if(!snapshot.exists()){
            applyGlobalConfigUpdate(null);
            return;
          }
          applyGlobalConfigUpdate(snapshot.val());
        }, (error)=>{
          console.error('전역 설정 실시간 수신 실패', error);
        });
      }

      async function fetchGlobalConfig(){ try {
          const snapshot = await get(ref(db, GLOBAL_CONFIG_PATH));
          if(snapshot.exists()){
            const raw = snapshot.val();
            if(raw && typeof raw === 'object' && raw.config){
              return {
                config: sanitizeConfig(raw.config),
                enhance: sanitizeEnhanceConfig(raw.enhance),
                activePresetId: typeof raw.activePresetId === 'string' ? raw.activePresetId : null,
                activePresetName: typeof raw.activePresetName === 'string' ? raw.activePresetName : null
              };
            }
            return {
              config: sanitizeConfig(raw),
              enhance: sanitizeEnhanceConfig(raw.enhance),
              activePresetId: null,
              activePresetName: null
            };
          }
        } catch (error) {
          console.error('전역 설정을 불러오지 못했습니다.', error);
        }
        return null;
      }

      async function persistGlobalConfig(config, meta){ try {
          const sanitized = sanitizeConfig(config);
          const payload = {
            config: sanitized,
            enhance: sanitizeEnhanceConfig(state.enhance),
            updatedAt: Date.now()
          };
          if(meta && typeof meta.activePresetId === 'string'){
            payload.activePresetId = meta.activePresetId;
          } else {
            payload.activePresetId = null;
          }
          if(meta && typeof meta.activePresetName === 'string'){
            payload.activePresetName = meta.activePresetName;
          } else {
            payload.activePresetName = null;
          }
          await set(ref(db, GLOBAL_CONFIG_PATH), payload);
        } catch (error) {
          console.error('전역 설정 저장에 실패했습니다.', error);
        }
      }

      function defaultEnhance(){
        const multipliers = [
          1,
          1.10,
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
          0.90,
          0.80,
          0.70,
          0.60,
          0.50,
          0.45,
          0.35,
          0.30,
          0.25,
          0.20,
          0.15,
          0.05,
          0.04,
          0.03,
          0.02,
          0.01
        ];
        return { multipliers, probs };
      }

      // RNG
      function djb2(str){ let h=5381; for(let i=0;i<str.length;i++){ h=((h<<5)+h) + str.charCodeAt(i); h|=0; } return h>>>0; }
      function mulberry32(a){ return function(){ let t = a += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
      function cryptoRand(){ const arr = new Uint32Array(1); crypto.getRandomValues(arr); return (arr[0] + 1) / 4294967297; }
      function getRng(){ if(state.config.seed && state.config.seed.length){ return mulberry32(djb2(state.config.seed)); } return cryptoRand; }
      function cloneDropRates(src){ return JSON.parse(JSON.stringify(src||DEFAULT_DROP_RATES)); }
      function normalizeDropRates(raw){ const base = cloneDropRates(DEFAULT_DROP_RATES); if(!raw) return base; const out = cloneDropRates(base); Object.keys(base).forEach(function(k){ const item = raw[k]; if(item && typeof item==='object'){ if(typeof item.base==='number') out[k].base = item.base; if(typeof item.perLevel==='number') out[k].perLevel = item.perLevel; if(typeof item.max==='number') out[k].max = item.max; } else if(typeof item==='number'){ out[k].base = item; out[k].perLevel = 0; out[k].max = item; }
        out[k].base = isFinite(out[k].base) ? out[k].base : base[k].base;
        out[k].perLevel = isFinite(out[k].perLevel) ? out[k].perLevel : base[k].perLevel;
        out[k].max = isFinite(out[k].max) ? out[k].max : base[k].max;
        out[k].base = Math.max(0, Math.min(1, out[k].base));
        out[k].perLevel = Math.max(0, out[k].perLevel);
        out[k].max = Math.max(out[k].base, Math.min(1, out[k].max));
      });
        return out;
      }
      function normalizeShopPrices(raw){ const defaults = { ...DEFAULT_SHOP_PRICES }; const result = { ...defaults }; if(raw && typeof raw === 'object'){ Object.keys(defaults).forEach(function(key){ const value = raw[key]; if(value === undefined || value === null) return; const num = Number(value); if(Number.isFinite(num) && num >= 0){ result[key] = Math.floor(num); } }); }
        return result;
      }
      function normalizePotionSettings(raw, defaults){ const base = { ...(defaults || DEFAULT_POTION_SETTINGS) }; if(raw && typeof raw === 'object'){ const duration = Number(raw.durationMs ?? raw.duration ?? base.durationMs); const manual = Number(raw.manualCdMs ?? raw.manualCd ?? base.manualCdMs); const auto = Number(raw.autoCdMs ?? raw.autoCd ?? base.autoCdMs); const speed = Number(raw.speedMultiplier ?? raw.speed ?? base.speedMultiplier); if(Number.isFinite(duration) && duration >= 0) base.durationMs = Math.round(duration); if(Number.isFinite(manual) && manual >= 0) base.manualCdMs = Math.round(manual); if(Number.isFinite(auto) && auto >= 0) base.autoCdMs = Math.round(auto); if(Number.isFinite(speed) && speed > 0) base.speedMultiplier = speed; }
        base.durationMs = Math.max(0, base.durationMs);
        base.manualCdMs = Math.max(0, base.manualCdMs);
        base.autoCdMs = Math.max(0, base.autoCdMs);
        base.speedMultiplier = Math.max(0.1, base.speedMultiplier || (defaults?.speedMultiplier ?? 1));
        return base;
      }
      function normalizeMonsterScaling(raw){ const base = { ...DEFAULT_MONSTER_SCALING }; if(raw && typeof raw === 'object'){ const coerce = (key, min, max)=>{ const value = Number(raw[key]); if(Number.isFinite(value)){ if(min !== undefined && value < min) return min; if(max !== undefined && value > max) return max; return value; } return base[key]; }; base.basePower = coerce('basePower', 1); base.maxPower = coerce('maxPower', base.basePower); base.curve = coerce('curve', 0.1); base.difficultyMultiplier = coerce('difficultyMultiplier', 0.01); base.attackShare = coerce('attackShare', 0); base.defenseShare = coerce('defenseShare', 0); base.hpMultiplier = coerce('hpMultiplier', 0.1); base.speedBase = coerce('speedBase', 1); base.speedMax = coerce('speedMax', base.speedBase); base.critRateBase = coerce('critRateBase', 0); base.critRateMax = coerce('critRateMax', base.critRateBase); base.critDmgBase = coerce('critDmgBase', 0); base.critDmgMax = coerce('critDmgMax', base.critDmgBase); base.dodgeBase = coerce('dodgeBase', 0); base.dodgeMax = coerce('dodgeMax', base.dodgeBase); }
        if(base.maxPower < base.basePower) base.maxPower = base.basePower;
        if(base.speedMax < base.speedBase) base.speedMax = base.speedBase;
        if(base.critRateMax < base.critRateBase) base.critRateMax = base.critRateBase;
        if(base.critDmgMax < base.critDmgBase) base.critDmgMax = base.critDmgBase;
        if(base.dodgeMax < base.dodgeBase) base.dodgeMax = base.dodgeBase;
        return base;
      }
      function normalizeGoldScaling(raw){ const base = {...DEFAULT_GOLD_SCALING}; const coerce = (val)=> (typeof val==='number' && isFinite(val)) ? val : null; if(raw){ const a = coerce(raw.minLow); const b = coerce(raw.maxLow); const c = coerce(raw.minHigh); const d = coerce(raw.maxHigh); if(a!==null) base.minLow = a; if(b!==null) base.maxLow = b; if(c!==null) base.minHigh = c; if(d!==null) base.maxHigh = d; }
        if(base.maxLow < base.minLow) base.maxLow = base.minLow;
        if(base.minHigh < base.minLow) base.minHigh = base.minLow;
        if(base.maxHigh < base.minHigh) base.maxHigh = base.minHigh;
        return base;
      }
      function refreshInventoryCache(){ state.inventory = [...Object.values(state.equip).filter(Boolean), ...PART_KEYS.map(function(part){ return state.spares[part]; }).filter(Boolean)]; }
      function spareItem(part){ return state.spares[part] || null; }
      function storeSpare(item, force){ if(!item || !item.part) return; const part = item.part; const existing = spareItem(part); if(force){ state.spares[part] = item; refreshInventoryCache(); markProfileDirty(); return; }
        if(!existing){ state.spares[part] = item; refreshInventoryCache(); markProfileDirty(); return; }
        const better = effectiveStat(item) > effectiveStat(existing) || (effectiveStat(item) === effectiveStat(existing) && TIER_RANK[item.tier] > TIER_RANK[existing.tier]);
        if(better){ state.spares[part] = item; refreshInventoryCache(); markProfileDirty(); }
      }
      function dropRateForLevel(type, level){ const cfg = state.config.dropRates || DEFAULT_DROP_RATES; const item = cfg[type] || DEFAULT_DROP_RATES[type]; if(!item) return 0; const base = typeof item.base==='number' ? item.base : 0; const per = typeof item.perLevel==='number' ? item.perLevel : 0; const max = typeof item.max==='number' ? item.max : 1; const lvl = Math.max(1, Math.min(MAX_LEVEL, level||1)); let rate = base + per * (lvl-1); if(rate > max) rate = max; if(rate < 0) rate = 0; return rate; }
      function migrateLegacyDropRates(raw){ if(!raw) return cloneDropRates(DEFAULT_DROP_RATES); const result = {}; Object.keys(DEFAULT_DROP_RATES).forEach(function(k){ const def = DEFAULT_DROP_RATES[k]; const item = raw[k]; if(item && typeof item==='object' && (item.base!==undefined || item.perLevel!==undefined || item.max!==undefined)){ result[k] = { base: Number(item.base), perLevel: Number(item.perLevel), max: Number(item.max) }; } else if(typeof item==='number'){ result[k] = { base: item, perLevel: 0, max: Math.min(1, Math.max(item, 0)) }; } else { result[k] = { ...def }; } }); return normalizeDropRates(result); }

      // Math helpers
      function normalize(weights){ const total = Object.values(weights).reduce((a,b)=>a+b,0); if(!(total>0)) return Object.fromEntries(TIERS.map(t=>[t,0])); return Object.fromEntries(TIERS.map(t=>[t, weights[t]/total])); }
      function formatPct(x){ return (x*100).toFixed(5)+'%'; }
      function formatNum(x){ return x.toLocaleString('ko-KR'); }
      function formatMultiplier(mult){ const rounded = Math.round(( (mult ?? 0) )*100)/100; return Number.isInteger(rounded)? String(rounded) : rounded.toString(); }
      function formatDateTime(ts){ if(typeof ts !== 'number') return '-'; const date = new Date(ts); if(Number.isNaN(date.getTime())) return '-'; return date.toLocaleString('ko-KR', { hour12:false }); }
      function escapeHtml(value){ return String(value ?? '').replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]); }); }
      async function sha256Hex(str){ try {
        if(typeof crypto!=='undefined' && crypto.subtle && typeof TextEncoder!=='undefined'){
          const enc = new TextEncoder().encode(str);
          const buf = await crypto.subtle.digest('SHA-256', enc);
          const b = new Uint8Array(buf);
          return Array.from(b).map(v=>v.toString(16).padStart(2,'0')).join('');
        }
      } catch(e) { /* fall through to simple hash */ }
        // Fallback: simple deterministic hash (not secure, demo only)
        let h = 5381;
        for(let i=0;i<str.length;i++){ h = ((h<<5)+h) ^ str.charCodeAt(i); h|=0; }
        const hex = (h>>>0).toString(16).padStart(8,'0');
        return hex.repeat(8).slice(0,64);
      }
      function chooseTier(probs, rng){ let u = rng(); let acc=0; for(const t of TIERS){ acc += probs[t]; if(u < acc) return t; } return 'D'; }
      const TIER_ATK = {"SSS+":"1000000-2500000","SS+":"200000-650000","S+":"80000-200000","S":"30000-80000","A":"8000-30000","B":"1500-8000","C":"400-1500","D":"50-400"};
      const TIER_DEF = {"SSS+":"400000-900000","SS+":"100000-350000","S+":"40000-100000","S":"15000-40000","A":"4000-15000","B":"800-4000","C":"200-800","D":"20-200"};
      const PARTS = [
        {key:'head',  name:'투구',    type:'def'},
        {key:'body',  name:'갑옷',    type:'def'},
        {key:'main',  name:'주무기',  type:'atk'},
        {key:'off',   name:'보조무기', type:'atk'},
        {key:'boots', name:'신발',    type:'def'},
      ];
      const TIER_RANK = Object.fromEntries(TIERS.map((t,i)=>[t, TIERS.length - i])); // higher is better
      function rollRange(str, rng){ const [lo, hi] = str.split('-').map(n=>parseInt(n,10)); const u=rng(); return Math.floor(lo + u*(hi-lo+1)); }
      function rollStatFor(tier, partKey, rng){ const part = PARTS.find(p=>p.key===partKey); if(!part) return 0; return part.type==='atk' ? rollRange(TIER_ATK[tier], rng) : rollRange(TIER_DEF[tier], rng); }
      function effectiveStat(item){ if(!item) return 0; const lv = item.lvl||0; const mul = (state.enhance.multipliers[lv]||1); return Math.floor((item.base||item.stat) * mul); }
      function choosePart(rng){ const i = Math.floor(rng()*5); return PARTS[i].key; }
      // Monster difficulty and win probability using Atk/Def
      function threshold(level){ return 100 * Math.pow(level, 1.3); }
      function winProbability(atk, def, level){ const th = threshold(level); const pAtk = atk / (atk + th); const pDef = def / (def + th*0.8); const p = 0.5*pAtk + 0.5*pDef; return Math.max(0.01, Math.min(0.99, p)); }
      function levelReward(level){ return Math.max(1, 2*level - 1); }
      function shuffle(arr, rng){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(rng()* (i+1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
      const CD_MANUAL_MS = 10000, CD_AUTO_MS = 20000;
      function isAtLeast(tier, floor){ return TIER_INDEX[tier] <= TIER_INDEX[floor]; }
      const LEGENDARY_GEAR_FLOOR = 'SS+';
      const LEGENDARY_CHARACTER_FLOOR = 'S+';
      function isLegendaryGearTier(tier){ return !!tier && isAtLeast(tier, LEGENDARY_GEAR_FLOOR); }
      function isLegendaryCharacterTier(tier){ return !!tier && isAtLeast(tier, LEGENDARY_CHARACTER_FLOOR); }
      function announceRareDrop(kind, tier, itemName){
        if (!tier || !isAtLeast(tier, 'SS+')) return;
        const user = state.user;
        if (!user || !user.username) return;
        const label = (itemName || '').trim();
        if (!label) return;
        const payload = {
          kind,
          tier,
          item: label,
          username: user.username
        };
        const message = `${user.username}님이 ${tier} ${label}를 뽑는데 성공했습니다!`;
        sendSystemMessage(message, payload).catch((error) => {
          console.warn('Rare drop chat broadcast failed', error);
        });
      }
      function rescaledPick(allowed, probs, rng){ const total = allowed.reduce((s,t)=>s+probs[t],0); let u = rng() * total, acc=0; for(const t of allowed){ acc += probs[t]; if(u < acc) return t; } return allowed[allowed.length-1]; }

      function expectedCounts(n, probs){ return Object.fromEntries(TIERS.map(t=>[t, n*probs[t]])); }
      // Chi-square p-value via regularized gamma Q(k/2, x/2)
      function gammaln(z){ const c=[57.1562356658629235,-59.5979603554754912,14.1360979747417471,-0.491913816097620199,0.339946499848118887e-4,0.465236289270485756e-4,-0.983744753048795646e-4,0.158088703224912494e-3,-0.210264441724104883e-3,0.217439618115212643e-3,-0.164318106536763890e-3,0.844182239838527433e-4,-0.261908384015814087e-4,0.368991826595316234e-5]; let x=0.999999999999997092; for(let i=0;i<c.length;i++){ x += c[i]/(z+i+1); } const t=z+ c.length-0.5; return 0.9189385332046727 + Math.log(x) + (z+0.5)*Math.log(t) - t; }
      function lowerGamma(s,x){ // series expansion
        let sum=1/s, term=sum; for(let k=1;k<200;k++){ term *= x/(s+k); sum += term; if(term<1e-12) break; } return Math.pow(x,s)*Math.exp(-x)*sum;
      }
      function gammaincP(s,x){ if(x<=0) return 0; if(x<s+1){ return lowerGamma(s,x)/Math.exp(gammaln(s)); } // use Q via continued fraction
        // Lentz's algorithm for continued fraction
        const eps=1e-12; let f=0, C=1/1e-30, D=0, a=0, b=0; let gold=0; let c0=1; let d0=1- x + s; if(Math.abs(d0)<1e-30) d0=1e-30; d0=1/d0; c0=1; let h=d0; for(let i=1;i<200;i++){ a = -i*(i-s); b = b + 2; d0 = a*d0 + b; if(Math.abs(d0)<1e-30) d0=1e-30; c0 = b + a/c0; if(Math.abs(c0)<1e-30) c0=1e-30; d0 = 1/d0; const delta = d0*c0; h *= delta; if(Math.abs(delta-1)<eps) break; }
        const Q = Math.exp(s*Math.log(x) - x - gammaln(s)) * h; return 1 - Q; }
      function chiSquarePValue(chi2, k){ if(k<=0) return NaN; const x = chi2/2; const s = k/2; const P = gammaincP(s, x); return 1 - P; }

      // Build weights table
      function buildWeightsTable(){ els.weightsTable.innerHTML=''; for(const tier of TIERS){ const tr = document.createElement('tr'); tr.innerHTML = `
            <td class="tier ${tier}">${tier}</td>
            <td><input type="number" step="any" min="0" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" data-tier="${tier}" class="winput" style="width:120px" /></td>
            <td class="prob" data-prob="${tier}">-</td>`; els.weightsTable.appendChild(tr); }
        updateWeightsInputs(); }

      function buildCharacterWeightsTable(){ if(!els.characterWeightsBody) return; els.characterWeightsBody.innerHTML=''; for(const tier of TIERS){ const tr = document.createElement('tr'); tr.innerHTML = `
            <td class="tier ${tier}">${tier}</td>
            <td><input type="number" step="any" min="0" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" data-char-tier="${tier}" class="cwinput" style="width:120px" /></td>
            <td class="prob" data-char-prob="${tier}">-</td>`; els.characterWeightsBody.appendChild(tr); }
        updateCharacterWeightsInputs(); }

      function updateWeightsInputs(){ if(!els.mode || !els.weightsTable) return; const mode = els.mode.value; const cfg = state.config; const weights = cfg.weights; cfg.probs = normalize(weights);
        const dis = cfg.locked || !isAdmin();
        $$('.winput').forEach(inp=>{ const t = inp.dataset.tier; inp.disabled = dis; inp.value = mode==='weight' ? weights[t] : (cfg.probs[t]*100).toFixed(5); });
        for(const t of TIERS){ const td = els.weightsTable.querySelector(`[data-prob="${t}"]`); if(td) td.textContent = formatPct(cfg.probs[t]); }
        updateCharacterWeightsInputs();
        syncStats(); drawChart(); }

      function updateCharacterWeightsInputs(){ if(!els.characterWeightsBody || !els.mode) return; const mode = els.mode.value; const cfg = state.config; const weights = cfg.characterWeights || sanitizeWeights(null); cfg.characterWeights = weights; cfg.characterProbs = normalize(weights); const disabled = cfg.locked || !isAdmin();
        els.characterWeightsBody.querySelectorAll('input[data-char-tier]').forEach((input)=>{ const tier = input.dataset.charTier; const weight = weights[tier]; input.disabled = disabled; if(mode === 'weight'){ input.value = weight; } else { input.value = (cfg.characterProbs[tier] * 100).toFixed(5); } });
        for(const tier of TIERS){ const cell = els.characterWeightsBody.querySelector(`[data-char-prob="${tier}"]`); if(cell) cell.textContent = formatPct(cfg.characterProbs[tier] || 0); }
      }

      function applyInputsToConfig(){ if(!els.mode) return; const mode = els.mode.value; const weights = {...state.config.weights}; $$('.winput').forEach(inp=>{ const t=inp.dataset.tier; const raw = (inp.value||'').replace(',', '.'); let v=parseFloat(raw); if(!(v>=0)) v=0; if(mode==='weight'){ weights[t]=v; } else { weights[t]=v/100 || 0; } }); if(mode==='percent'){ const sum = TIERS.reduce((s,t)=>s+weights[t],0); if(sum>0){ for(const t of TIERS){ weights[t] = weights[t]/sum; } } }
        state.config.weights = weights; state.config.probs = normalize(weights); if(isAdmin()) clearActivePreset(); }

      function applyCharacterInputsToConfig(){ if(!els.characterWeightsBody || !els.mode) return; const mode = els.mode.value; const weights = {...state.config.characterWeights}; els.characterWeightsBody.querySelectorAll('input[data-char-tier]').forEach((input)=>{ const tier = input.dataset.charTier; const raw = (input.value||'').replace(',', '.'); let value = parseFloat(raw); if(!(value>=0)) value = 0; if(mode === 'weight'){ weights[tier] = value; } else { weights[tier] = value/100 || 0; } }); if(mode === 'percent'){ const sum = TIERS.reduce((acc, tier)=> acc + weights[tier], 0); if(sum>0){ TIERS.forEach((tier)=>{ weights[tier] = weights[tier]/sum; }); } }
        state.config.characterWeights = weights; state.config.characterProbs = normalize(weights); if(isAdmin()) clearActivePreset(); }

      function refreshCharacterProbCells(){ if(!els.characterWeightsBody) return; const probs = state.config.characterProbs || {}; for(const tier of TIERS){ const cell = els.characterWeightsBody.querySelector(`[data-char-prob="${tier}"]`); if(cell) cell.textContent = formatPct(probs[tier] || 0); } }

      function refreshProbsAndStats(){ // update only probability cells and stats, do not overwrite input fields
        const probs = state.config.probs;
        for(const t of TIERS){ const td = els.weightsTable.querySelector(`[data-prob="${t}"]`); if(td) td.textContent = formatPct(probs[t]); }
        syncStats(); drawChart();
      }

      // UI bindings
      function bind(){ addListener(els.mode, 'change', ()=>{ updateWeightsInputs(); });
        // On typing, update config and probs without overwriting the user's current text
        if(els.weightsTable){
          addListener(els.weightsTable, 'input', (e)=>{ if(!(e.target instanceof HTMLInputElement)) return; if(state.config.locked || !isAdmin()) return; applyInputsToConfig(); refreshProbsAndStats(); markProfileDirty(); });
          // On commit (change/blur), format inputs from config
          addListener(els.weightsTable, 'change', (e)=>{ if(!(e.target instanceof HTMLInputElement)) return; if(state.config.locked || !isAdmin()) return; updateWeightsInputs(); });
        }
        if(els.characterWeightsTable){ els.characterWeightsTable.addEventListener('input', (e)=>{ if(!(e.target instanceof HTMLInputElement)) return; if(!e.target.dataset.charTier) return; if(state.config.locked || !isAdmin()) return; applyCharacterInputsToConfig(); refreshCharacterProbCells(); markProfileDirty(); });
          els.characterWeightsTable.addEventListener('change', (e)=>{ if(!(e.target instanceof HTMLInputElement)) return; if(!e.target.dataset.charTier) return; if(state.config.locked || !isAdmin()) return; updateCharacterWeightsInputs(); }); }
        if(els.characterBalanceTable){
          els.characterBalanceTable.addEventListener('input', handleCharacterBalanceInput);
          els.characterBalanceTable.addEventListener('change', ()=> updateCharacterBalanceInputs());
        }
        if(els.characterBalanceOffsetTable){
          els.characterBalanceOffsetTable.addEventListener('input', handleCharacterBalanceOffsetInput);
          els.characterBalanceOffsetTable.addEventListener('change', ()=> updateCharacterBalanceInputs());
        }
        addListener(els.seed, 'input', ()=>{ state.config.seed = els.seed.value.trim(); markProfileDirty(); });
        if(els.gachaModeGearConfig) els.gachaModeGearConfig.addEventListener('click', ()=> updateGachaModeView('gear'));
        if(els.gachaModePetConfig) els.gachaModePetConfig.addEventListener('click', ()=> updateGachaModeView('pet'));
        if(els.gachaModeCharacterConfig) els.gachaModeCharacterConfig.addEventListener('click', ()=> updateGachaModeView('character'));
        if(els.gachaModeGearDraw) els.gachaModeGearDraw.addEventListener('click', ()=> updateGachaModeView('gear'));
        if(els.gachaModePetDraw) els.gachaModePetDraw.addEventListener('click', ()=> updateGachaModeView('pet'));
        if(els.gachaModeCharacterDraw) els.gachaModeCharacterDraw.addEventListener('click', ()=> updateGachaModeView('character'));
        if(els.rareAnimationSkip){ els.rareAnimationSkip.addEventListener('click', (event)=>{
          event.preventDefault();
          event.stopPropagation();
          skipRareAnimation();
        }); setRareAnimationSkippable(true); }
        if(els.rareAnimationOverlay){
          els.rareAnimationOverlay.addEventListener('click', (event)=>{
            if(event.target === els.rareAnimationOverlay){
              event.preventDefault();
              event.stopPropagation();
            }
          });
        }
        addListener(els.lock, 'change', ()=>{ state.config.locked = els.lock.checked; updateWeightsInputs(); toggleConfigDisabled(); markProfileDirty(); });
        addListener(els.pityEnabled, 'change', ()=>{ state.config.pity.enabled = els.pityEnabled.checked; markProfileDirty(); });
        addListener(els.pityFloor, 'change', ()=>{ state.config.pity.floorTier = els.pityFloor.value; markProfileDirty(); });
        addListener(els.pitySpan, 'input', ()=>{ state.config.pity.span = Math.max(1, parseInt(els.pitySpan?.value||'1')); markProfileDirty(); });
        addListener(els.g10Enabled, 'change', ()=>{ state.config.minGuarantee10.enabled = els.g10Enabled.checked; markProfileDirty(); });
        addListener(els.g10Tier, 'change', ()=>{ state.config.minGuarantee10.tier = els.g10Tier.value; markProfileDirty(); });
        addListener(els.draw1, 'click', ()=> runDraws(1));
        addListener(els.draw10, 'click', ()=> runDraws(10));
        addListener(els.draw100, 'click', ()=> runDraws(100));
        addListener(els.draw1k, 'click', ()=> runDraws(1000));
        addListener(els.draw10k, 'click', ()=> runDraws(10000));
        if (els.drawPet1) els.drawPet1.addEventListener('click', ()=> runPetDraws(1));
        if (els.drawPet10) els.drawPet10.addEventListener('click', ()=> runPetDraws(10));
        if (els.drawChar1) els.drawChar1.addEventListener('click', ()=> runCharacterDraws(1));
        if (els.drawChar10) els.drawChar10.addEventListener('click', ()=> runCharacterDraws(10));
        addListener(els.cancel, 'click', ()=>{ state.cancelFlag = true; });
        addListener(els.scope, 'change', ()=>{ syncStats(); drawChart(); });
        if (els.petWeightTableBody) {
          els.petWeightTableBody.addEventListener('input', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLInputElement)) return;
            const petId = target.dataset.pet;
            if (!petId || !PET_IDS.includes(petId)) return;
            if (!isAdmin() || state.config.locked) {
              updatePetWeightInputs();
              return;
            }
            let value = parseFloat(target.value);
            if (!Number.isFinite(value) || value < 0) value = 0;
            state.petGachaWeights[petId] = value;
            state.config.petWeights = { ...state.petGachaWeights };
            markProfileDirty();
            renderPetStats();
            updatePetWeightInputs();
          });
        }
        if (els.statsMode) els.statsMode.addEventListener('change', ()=>{
          const value = els.statsMode.value;
          if(value === 'pet'){
            updateGachaModeView('pet');
          } else if(value === 'character'){
            updateGachaModeView('character');
          } else {
            updateGachaModeView('gear');
          }
        });
        if(els.userOptionsBtn) els.userOptionsBtn.addEventListener('click', openUserOptionsModal);
        if(els.userOptionsClose) els.userOptionsClose.addEventListener('click', ()=> closeUserOptionsModal());
        if(els.userOptionsSave) els.userOptionsSave.addEventListener('click', saveUserOptions);
        if(els.userOptionsModal){ els.userOptionsModal.addEventListener('click', (event)=>{ if(event.target === els.userOptionsModal){ closeUserOptionsModal(); } }); }
        if(els.questBtn) els.questBtn.addEventListener('click', ()=> openQuestModal());
        if(els.questClose) els.questClose.addEventListener('click', ()=> closeQuestModal());
        if(els.questOverlay){ els.questOverlay.addEventListener('click', (event)=>{ if(event.target === els.questOverlay){ closeQuestModal(); } }); }
        if(els.questList){
          els.questList.addEventListener('click', (event)=>{
            const rawTarget = event.target;
            const target = rawTarget instanceof HTMLButtonElement
              ? rawTarget
              : rawTarget instanceof Element
                ? rawTarget.closest('.quest-claim')
                : null;
            if(!(target instanceof HTMLButtonElement)) return;
            if(target.disabled) return;
            const questId = target.dataset.questId;
            if(!questId) return;
            target.disabled = true;
            claimQuestReward(questId).then((ok)=>{
              if(!ok){
                target.disabled = false;
              }
            });
          });
        }
        if(els.saveCfg) els.saveCfg.addEventListener('click', saveConfigFile);
        if(els.loadCfg && els.cfgFile){
          els.loadCfg.addEventListener('click', ()=> els.cfgFile.click());
          els.cfgFile.addEventListener('change', loadConfigFile);
        }
        if(els.shareLink) els.shareLink.addEventListener('click', shareLink);
        const exportCsvBtn = $('#exportCsv');
        if(exportCsvBtn) addListener(exportCsvBtn, 'click', exportCsv);
        if (els.resetSession) els.resetSession.addEventListener('click', resetSession);
        if (els.resetGlobal) els.resetGlobal.addEventListener('click', resetGlobal);
        if (els.characterDetailClose) els.characterDetailClose.addEventListener('click', closeCharacterDetail);
        if (els.characterDetailModal) {
          els.characterDetailModal.addEventListener('click', (event) => {
            if (event.target === els.characterDetailModal || event.target.classList.contains('character-modal__backdrop')) {
              closeCharacterDetail();
            }
          });
        }
        // combat
        if(els.monLevel){ els.monLevel.addEventListener('input', ()=>{ setLevel(parseInt(els.monLevel.value||'1',10)); }); }
        if(els.nextMonster){ els.nextMonster.addEventListener('click', ()=>{ const rng = getRng(); const lvl = 1 + Math.floor(rng()*999); setLevel(lvl); }); }
        if(els.lvlDec){ els.lvlDec.addEventListener('click', ()=>{ const cur = parseInt(els.monLevel?.value||'1',10); setLevel(cur-1); }); }
        if(els.lvlInc){ els.lvlInc.addEventListener('click', ()=>{ const cur = parseInt(els.monLevel?.value||'1',10); setLevel(cur+1); }); }
        if(els.fightBtn){ els.fightBtn.addEventListener('click', doFight); }
        addListener(els.forgeTarget, 'change', updateForgeInfo);
        // forge
        addListener(els.forgeOnce, 'click', doForgeOnce);
        if(els.forgeAuto){ els.forgeAuto.addEventListener('click', toggleAutoForge); }
        addListener(els.forgeTableBody, 'input', onForgeTableInput);
        addListener(els.forgeReset, 'click', ()=>{ state.enhance = defaultEnhance(); buildForgeTable(); updateInventoryView(); markProfileDirty(); });
        addListener(els.forgeProtectUse, 'change', ()=>{ state.forge.protectEnabled = els.forgeProtectUse.checked; updateForgeControlsView(); updateForgeInfo(); markProfileDirty(); });
        addListener(els.logoutBtn, 'click', logout);
        addListener(els.toAdmin, 'click', ()=>{ if(!isAdmin()) { alert('관리자만 접근 가능합니다.'); return; } state.ui.adminView = true; updateViewMode(); });
        addListener(els.toUser, 'click', ()=>{ state.ui.adminView = false; updateViewMode(); });
        if(els.toBattle){ els.toBattle.addEventListener('click', ()=>{ window.location.href = 'battle.html'; }); }
        if(els.toPvp){ els.toPvp.addEventListener('click', ()=>{ window.location.href = 'pvp.html'; }); }
        if(els.goBattle){ els.goBattle.addEventListener('click', ()=>{ window.location.href = 'battle.html'; }); }
        addListener(els.adminChangePw, 'click', changeAdminPassword);
        if(els.legendaryOverlay){ els.legendaryOverlay.addEventListener('click', (event)=>{ if(!isLegendaryVisible()) return; if(event.target === els.legendaryOverlay && activeLegendaryType === 'gear'){ if(els.gearDiscardBtn) els.gearDiscardBtn.click(); } else if(event.target === els.legendaryOverlay && activeLegendaryType === 'character'){ if(els.characterLegendaryClose) els.characterLegendaryClose.click(); } }); }
        document.addEventListener('keydown', (event)=>{
          if(event.key === 'Escape'){
            if(isUserOptionsOpen()){
              event.preventDefault();
              closeUserOptionsModal();
              return;
            }
            if(els.rareAnimationOverlay && !els.rareAnimationOverlay.hidden && els.rareAnimationOverlay.classList.contains('visible')){
              event.preventDefault();
              skipRareAnimation();
              return;
            }
            if(isLegendaryVisible()){
              event.preventDefault();
              if(activeLegendaryType === 'gear'){ if(els.gearDiscardBtn) els.gearDiscardBtn.click(); }
              else if(activeLegendaryType === 'character'){ if(els.characterLegendaryClose) els.characterLegendaryClose.click(); }
              return;
            }
            if(state.ui.questOpen){
              event.preventDefault();
              closeQuestModal();
              return;
            }
            if(state.ui.characterDetailOpen){
              event.preventDefault();
              closeCharacterDetail();
            }
          }
        });
        if(els.saveDrops) els.saveDrops.addEventListener('click', ()=>{
          if(!isAdmin()) return;
          const parseDrop = (baseEl, perEl, maxEl, defaults)=>{
            const base = parseFloat(baseEl?.value);
            const per = parseFloat(perEl?.value);
            const max = parseFloat(maxEl?.value);
            return {
              base: (isFinite(base) && base>=0 && base<=1) ? base : defaults.base,
              perLevel: (isFinite(per) && per>=0) ? per : (defaults.perLevel||0),
              max: (isFinite(max) && max>=0 && max<=1) ? max : (defaults.max||1)
            };
          };
          const drops = {
            potion: parseDrop(els.dropPotionBase, els.dropPotionPer, els.dropPotionMax, DEFAULT_DROP_RATES.potion),
            hyperPotion: parseDrop(els.dropHyperBase, els.dropHyperPer, els.dropHyperMax, DEFAULT_DROP_RATES.hyperPotion),
            protect: parseDrop(els.dropProtectBase, els.dropProtectPer, els.dropProtectMax, DEFAULT_DROP_RATES.protect),
            enhance: parseDrop(els.dropEnhanceBase, els.dropEnhancePer, els.dropEnhanceMax, DEFAULT_DROP_RATES.enhance),
            battleRes: parseDrop(els.dropBattleResBase, els.dropBattleResPer, els.dropBattleResMax, DEFAULT_DROP_RATES.battleRes)
          };
          state.config.dropRates = normalizeDropRates(drops);

          const gold = normalizeGoldScaling({
            minLow: parseInt(els.goldMinLow?.value,10),
            maxLow: parseInt(els.goldMaxLow?.value,10),
            minHigh: parseInt(els.goldMinHigh?.value,10),
            maxHigh: parseInt(els.goldMaxHigh?.value,10)
          });
          state.config.goldScaling = gold;

          const parsePrice = (el, def)=>{ const v = parseInt(el?.value,10); return (isNaN(v)||v<0)? def : v; };
          const parseTimeSeconds = (el, fallbackSec)=>{
            const v = parseFloat(el?.value);
            return (isFinite(v) && v>=0) ? v : fallbackSec;
          };
          const parseMultiplier = (el, fallback)=>{
            const v = parseFloat(el?.value);
            return (isFinite(v) && v>0) ? v : fallback;
          };
          const sp = {
            potion: parsePrice(els.priceInputPotion, DEFAULT_SHOP_PRICES.potion),
            hyperPotion: parsePrice(els.priceInputHyper, DEFAULT_SHOP_PRICES.hyperPotion),
            protect: parsePrice(els.priceInputProtect, DEFAULT_SHOP_PRICES.protect),
            enhance: parsePrice(els.priceInputEnhance, DEFAULT_SHOP_PRICES.enhance),
            battleRes: parsePrice(els.priceInputBattleRes, DEFAULT_SHOP_PRICES.battleRes),
            starterPack: parsePrice(els.priceInputStarter, DEFAULT_SHOP_PRICES.starterPack)
          };
          state.config.shopPrices = normalizeShopPrices(sp);

          if(isAdmin()) clearActivePreset();
          const potionSettings = normalizePotionSettings({
            durationMs: Math.round(parseTimeSeconds(els.potionDuration, DEFAULT_POTION_SETTINGS.durationMs/1000)*1000),
            manualCdMs: Math.round(parseTimeSeconds(els.potionManualCd, DEFAULT_POTION_SETTINGS.manualCdMs/1000)*1000),
            autoCdMs: Math.round(parseTimeSeconds(els.potionAutoCd, DEFAULT_POTION_SETTINGS.autoCdMs/1000)*1000),
            speedMultiplier: parseMultiplier(els.potionSpeedMult, DEFAULT_POTION_SETTINGS.speedMultiplier)
          }, DEFAULT_POTION_SETTINGS);
          const hyperSettings = normalizePotionSettings({
            durationMs: Math.round(parseTimeSeconds(els.hyperDuration, DEFAULT_HYPER_POTION_SETTINGS.durationMs/1000)*1000),
            manualCdMs: Math.round(parseTimeSeconds(els.hyperManualCd, DEFAULT_HYPER_POTION_SETTINGS.manualCdMs/1000)*1000),
            autoCdMs: Math.round(parseTimeSeconds(els.hyperAutoCd, DEFAULT_HYPER_POTION_SETTINGS.autoCdMs/1000)*1000),
            speedMultiplier: parseMultiplier(els.hyperSpeedMult, DEFAULT_HYPER_POTION_SETTINGS.speedMultiplier)
          }, DEFAULT_HYPER_POTION_SETTINGS);
          state.config.potionSettings = potionSettings;
          state.config.hyperPotionSettings = hyperSettings;
          const monsterRaw = {
            basePower: parseFloat(els.monsterBasePower?.value),
            maxPower: parseFloat(els.monsterMaxPower?.value),
            curve: parseFloat(els.monsterCurve?.value),
            difficultyMultiplier: parseFloat(els.monsterDifficultyInput?.value)
          };
          state.config.monsterScaling = normalizeMonsterScaling({ ...state.config.monsterScaling, ...monsterRaw });
          if(isAdmin()) clearActivePreset(); else clearSelectedPreset();
          markProfileDirty();
          reflectConfig();
          setAdminMsg('드랍 확률, 골드 보상, 상점 가격, 물약, 몬스터 난이도 설정이 저장되었습니다.', 'ok');
        });
        if(els.adminPresetSave) els.adminPresetSave.addEventListener('click', handleAdminPresetSave);
        if(els.adminPresetApply) els.adminPresetApply.addEventListener('click', ()=>{
          if(!isAdmin()) return; const id = els.adminPresetSelect?.value || ''; const preset = findGlobalPreset(id); if(!preset){ setAdminPresetMsg('적용할 프리셋을 선택하세요.', 'warn'); return; } applyAdminPreset(preset); });
        if(els.adminPresetLoad) els.adminPresetLoad.addEventListener('click', ()=>{
          if(!isAdmin()) return; const id = els.adminPresetSelect?.value || ''; const preset = findGlobalPreset(id); if(!preset){ setAdminPresetMsg('불러올 프리셋을 선택하세요.', 'warn'); return; } loadAdminPresetForEditing(preset); });
        if(els.adminPresetDelete) els.adminPresetDelete.addEventListener('click', handleAdminPresetDelete);
        if(els.adminUserSelect) els.adminUserSelect.addEventListener('change', ()=>{
          updateAdminUserStats();
          refreshAdminBackups({ silent: true });
        });
        if(els.adminBackupRefresh) els.adminBackupRefresh.addEventListener('click', ()=> refreshAdminBackups());
        if(els.adminRestoreFromMirror) els.adminRestoreFromMirror.addEventListener('click', restoreFromMirror);
        if(els.adminRestoreFromSnapshot) els.adminRestoreFromSnapshot.addEventListener('click', restoreFromSnapshot);
        if(els.adminGrantSubmit) els.adminGrantSubmit.addEventListener('click', handleAdminGrantResources);
        if(els.applyGlobalPreset) els.applyGlobalPreset.addEventListener('click', ()=>{ const id = els.globalPresetSelect?.value || ''; if(!id){ clearSelectedPreset(); setPresetMsg('프리셋 선택을 해제했습니다.', 'warn'); return; } const preset = findGlobalPreset(id); if(!preset){ setPresetMsg('선택한 프리셋을 찾을 수 없습니다.', 'error'); return; } applyGlobalPresetForUser(preset); });
        if(els.applyPersonalPreset) els.applyPersonalPreset.addEventListener('click', ()=>{ const id = els.personalPresetSelect?.value || ''; if(!id){ clearSelectedPreset(); setPresetMsg('프리셋 선택을 해제했습니다.', 'warn'); return; } const preset = findPersonalPreset(id); if(!preset){ setPresetMsg('선택한 프리셋을 찾을 수 없습니다.', 'error'); return; } applyPersonalPresetForUser(preset); });
        if(els.savePersonalPreset) els.savePersonalPreset.addEventListener('click', handleSavePersonalPreset);
        if(els.toggleUserEdit) els.toggleUserEdit.addEventListener('click', ()=>{ if(isAdmin()) return; state.ui.userEditEnabled = !state.ui.userEditEnabled; updateUserEditModeView(); toggleConfigDisabled(); updateWeightsInputs(); setPresetMsg(state.ui.userEditEnabled ? '설정 편집 모드를 켰습니다.' : '설정 편집 모드를 껐습니다.', 'warn'); });
        const adjustMonsterDifficulty = (delta)=>{
          if(!els.monsterDifficultyInput) return;
          const current = parseFloat(els.monsterDifficultyInput.value) || (state.config.monsterScaling?.difficultyMultiplier ?? 1);
          let next = current + delta;
          if(next < 0.1) next = 0.1;
          if(next > 10) next = 10;
          next = Math.round(next * 100) / 100;
          els.monsterDifficultyInput.value = formatMultiplier(next);
        };
        if(els.monsterDifficultyMinus){ els.monsterDifficultyMinus.addEventListener('click', ()=> adjustMonsterDifficulty(-0.1)); }
        if(els.monsterDifficultyPlus){ els.monsterDifficultyPlus.addEventListener('click', ()=> adjustMonsterDifficulty(0.1)); }
        // auto hunt
        if(els.autoHuntBtn){ els.autoHuntBtn.addEventListener('click', toggleAutoHunt); }
        // potion
        if(els.usePotion){ els.usePotion.addEventListener('click', usePotion); }
        if(els.useHyperPotion){ els.useHyperPotion.addEventListener('click', useHyperPotion); }
        if(els.claimRevive){ els.claimRevive.addEventListener('click', claimRevive); }
        if(els.shopPanel){ els.shopPanel.addEventListener('click', onShopClick); }
        if(els.battleResUse){ els.battleResUse.addEventListener('change', ()=>{ state.combat.useBattleRes = !!els.battleResUse.checked; state.combat.prefBattleRes = state.combat.useBattleRes; updateBattleResControls(); markProfileDirty(); }); }
        if(els.spareList){ els.spareList.addEventListener('click', onSpareListClick); }
      }

      function toggleConfigDisabled(){ const admin = isAdmin(); const disabled = state.config.locked || (!admin && !state.ui.userEditEnabled); const fields = [els.mode, els.seed, els.pityEnabled, els.pityFloor, els.pitySpan, els.g10Enabled, els.g10Tier]; fields.forEach(x=>{ if(x){ x.disabled = disabled; } }); $$('.winput').forEach(i=> i.disabled = disabled); if(els.characterWeightsBody){ els.characterWeightsBody.querySelectorAll('input[data-char-tier]').forEach((input)=>{ input.disabled = disabled; }); } if(els.characterBalanceTable){ els.characterBalanceTable.querySelectorAll('input[data-class][data-field]').forEach((input)=>{ input.disabled = disabled; }); } if(els.characterBalanceOffsetTable){ els.characterBalanceOffsetTable.querySelectorAll('input[data-class][data-field]').forEach((input)=>{ input.disabled = disabled; }); }
        [els.potionDuration, els.potionManualCd, els.potionAutoCd, els.potionSpeedMult, els.hyperDuration, els.hyperManualCd, els.hyperAutoCd, els.hyperSpeedMult, els.monsterBasePower, els.monsterMaxPower, els.monsterCurve, els.monsterDifficultyInput].forEach(function(el){ if(el) el.disabled = disabled; }); if(els.monsterDifficultyMinus) els.monsterDifficultyMinus.disabled = disabled; if(els.monsterDifficultyPlus) els.monsterDifficultyPlus.disabled = disabled; if(els.globalPresetSelect) els.globalPresetSelect.disabled = admin ? false : state.ui.userEditEnabled; if(els.personalPresetSelect) els.personalPresetSelect.disabled = admin ? false : state.ui.userEditEnabled; updatePetWeightInputs(); updateCharacterWeightsInputs(); }

      // Draw engine with pity
      function drawOne(rng){ const cfg = state.config; const probs = cfg.probs; const t = chooseTier(probs, rng); applyPityCounter(t); return t; }
      function applyPityCounter(tier){ const floor = state.config.pity.floorTier; if(isAtLeast(tier, floor)){ state.pitySince = 0; } else { state.pitySince++; } }
      function drawOneWithPity(rng){ const {pity} = state.config; const probs = state.config.probs; const floor = pity.floorTier; if(pity.enabled && state.pitySince >= pity.span-1){ const allowed = TIERS.filter(t=> isAtLeast(t, floor)); const t = rescaledPick(allowed, probs, rng); state.pitySince = 0; return t; } const t = chooseTier(probs, rng); applyPityCounter(t); return t; }

      async function runDraws(n){ if((state.ui.gachaMode || 'gear') !== 'gear'){ updateGachaModeView('gear'); }
        const rng = getRng(); state.inRun = true; state.cancelFlag = false; els.cancel.disabled = false; els.draw1.disabled = els.draw10.disabled = els.draw100.disabled = els.draw1k.disabled = els.draw10k.disabled = true; const speed = parseInt(els.speed.value||'0'); let results = []; const cfgHash = await sha256Hex(JSON.stringify(compactConfig())); const runId = state.runId++;
        const shouldRender = (n===1 || n===10 || n===100);
        const collected = [];
        const collectFn = shouldRender ? function(payload){
          if(!payload) return;
          const partName = getPartNameByKey(payload.part) || '';
          collected.push({
            type: 'gear',
            tier: payload.tier,
            part: payload.part,
            icon: iconForPart(payload.part),
            partName,
            item: payload.item || null
          });
        } : null;
        const batch = n >= 200; const updateEvery = n>=10000? 200 : n>=1000? 50 : n>=200? 10 : 1;
        if(n===10 && state.config.minGuarantee10.enabled){ // 10-pull with minimum guarantee
          for(let i=0;i<9;i++){ if(state.cancelFlag) break; if(!spendPoints(100)) { if(els.fightResult) els.fightResult.textContent='포인트가 부족합니다.'; break; } const t = drawOneWithPity(rng); results.push(t); await applyResult(t, runId, cfgHash, {deferUI: batch, skipLog: batch, rng, onCollect: collectFn}); if(batch && ((i+1)%updateEvery===0)) { syncStats(); drawChart(); const h = latestHistory(); if(h) appendLog(h); } await maybeDelay(speed); updateProgress(results.length, n); }
          if(!state.cancelFlag){ const floor = state.config.minGuarantee10.tier; const ok = results.some(t=> isAtLeast(t, floor)); if(!ok){ const allowed = TIERS.filter(t=> isAtLeast(t, floor)); const forced = rescaledPick(allowed, state.config.probs, rng); // force one
              if(!spendPoints(100)) { if(els.fightResult) els.fightResult.textContent='포인트가 부족합니다.'; }
              else { await applyResult(forced, runId, cfgHash, {deferUI: batch, skipLog: batch, rng, onCollect: collectFn}); results.push(forced); if(batch){ syncStats(); drawChart(); const h = latestHistory(); if(h) appendLog(h); } await maybeDelay(speed); updateProgress(results.length, n); }
            } else { if(!spendPoints(100)) { if(els.fightResult) els.fightResult.textContent='포인트가 부족합니다.'; }
              else { const t = drawOneWithPity(rng); results.push(t); await applyResult(t, runId, cfgHash, {deferUI: batch, skipLog: batch, rng, onCollect: collectFn}); if(batch){ syncStats(); drawChart(); const h = latestHistory(); if(h) appendLog(h); } await maybeDelay(speed); updateProgress(results.length, n); } }
          }
        } else {
          for(let i=0;i<n;i++){ if(state.cancelFlag) break; if(!spendPoints(100)) { if(els.fightResult) els.fightResult.textContent='포인트가 부족합니다.'; break; } const t = drawOneWithPity(rng); results.push(t); await applyResult(t, runId, cfgHash, {deferUI: batch, skipLog: batch, rng, onCollect: collectFn}); if(batch && ((i+1)%updateEvery===0)) { syncStats(); drawChart(); const h = latestHistory(); if(h) appendLog(h); } await maybeDelay(speed); updateProgress(i+1, n); }
        }
        if(batch){ syncStats(); drawChart(); updateInventoryView(); const h = latestHistory(); if(h) appendLog(h); }
        els.cancel.disabled = true; els.draw1.disabled = els.draw10.disabled = els.draw100.disabled = els.draw1k.disabled = els.draw10k.disabled = false; state.inRun = false; updateDrawButtons(); if(state.cancelFlag){ state.cancelFlag=false; }
        updateProgress(0, 100);
        if(shouldRender){ renderDrawResults(collected, n); } else { renderDrawResults([], 0); }
        markProfileDirty();
      }

      async function applyResult(tier, runId, cfgHash, opts){ opts = opts||{}; const rng = opts.rng || getRng(); state.session.draws++; state.session.counts[tier]++; const now=Date.now(); const id = state.session.history.length + 1; const part = choosePart(rng); const stat = rollStatFor(tier, part, rng); const rec = {id, tier, ts: now, runId, cfgHash, part, stat}; state.session.history.push(rec);
        const item = { id: state.itemSeq++, tier, part, base: stat, lvl: 0, type: PARTS.find(p=>p.key===part).type };
        item.__animationPlayed = false;
        if(typeof opts.onCollect === 'function'){ opts.onCollect({ tier, part, item }); }
        let decision = opts.decision || null;
        if(!opts.skipPrompt && isLegendaryGearTier(tier)){
          if(!opts.deferUI){
            try {
              await playLegendaryGearAnimation(tier, part);
              item.__animationPlayed = true;
            } catch (error) {
              console.warn('전설 장비 이펙트 실행 실패', error);
            }
          }
          const current = state.equip[part] || null;
          decision = await showGearLegendaryModal(item, current);
        }
        applyEquipAndInventory(item, { decision });
        if(isLegendaryGearTier(tier)){
          const partName = getPartNameByKey(part) || part || '장비';
          announceRareDrop('gear', tier, partName);
        }
        // global
        state.global.draws++; state.global.counts[tier]++; saveGlobal(); if(!opts.skipLog) appendLog(rec); if(!opts.deferUI){ syncStats(); drawChart(); updateInventoryView(); }
        return item;
      }

      function latestHistory(){ const h = state.session.history; return h.length? h[h.length-1] : null; }

      function updateProgress(now, total){ const p = total? Math.max(0, Math.min(100, (now/total)*100)) : 0; els.bar.style.width = p.toFixed(1)+'%'; }
      function maybeDelay(ms){ return new Promise(r=> setTimeout(r, ms)); }

      // Stats and chart
      function activeStats(){ return els.scope.value==='global' ? state.global : state.session; }
      function syncStats(){ const s = activeStats(); els.nDraws.textContent = formatNum(s.draws); const probs = state.config.probs; const exp = expectedCounts(s.draws, probs); els.statsTable.innerHTML=''; let chi2=0, k=0; for(const t of TIERS){ const o = s.counts[t]; const e = exp[t]; const tr = document.createElement('tr'); const ratio = s.draws? (o/s.draws):0; const delta = o - e; const rel = e>0? (delta/e):0; tr.innerHTML = `<td class="tier ${t}">${t}</td><td>${formatNum(o)}</td><td>${(ratio*100).toFixed(3)}%</td><td>${e.toFixed(2)}</td><td>${delta>=0?'+':''}${delta.toFixed(2)}</td><td>${(rel*100).toFixed(2)}%</td>`; els.statsTable.appendChild(tr); if(e>=5){ chi2 += (o-e)*(o-e)/e; k++; } }
        const dof = Math.max(0, k-1); if(dof>0){ const p = chiSquarePValue(chi2, dof); els.pval.textContent = isNaN(p)? '-' : p.toFixed(4); } else { els.pval.textContent = '-'; } }

      function drawChart(){ const s = activeStats(); const ctx = els.chart.getContext('2d'); const W = els.chart.width, H = els.chart.height; ctx.clearRect(0,0,W,H); // grid
        ctx.fillStyle = '#1a2231'; ctx.fillRect(0,0,W,H); ctx.strokeStyle = '#2a3140'; ctx.lineWidth = 1; for(let y=H-0.5; y>0; y-=44){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
        const counts = TIERS.map(t=> s.counts[t]); const max = Math.max(1, ...counts); const bw = (W-40)/TIERS.length; const gap = Math.min(16, bw*0.2); const barw = bw - gap; ctx.textAlign='center'; ctx.fillStyle = '#aeb7c6'; ctx.font = '12px system-ui'; const colors = {"SSS+":"#ffd166","SS+":"#ffb366","S+":"#ff9966","S":"#ff7f66","A":"#6ecb9b","B":"#6aa9ff","C":"#9aa5b1","D":"#738091"};
        for(let i=0;i<TIERS.length;i++){ const x = 20 + i*bw + gap/2; const h = (counts[i]/max)*(H-40); const y = H-20 - h; ctx.fillStyle = colors[TIERS[i]] || '#8ef'; ctx.fillRect(x, y, barw, h); ctx.fillStyle = '#aeb7c6'; ctx.fillText(TIERS[i], x+barw/2, H-6); }
      }

      // Log
      function getPartNameByKey(key){ const p = PARTS.find(function(pp){ return pp.key===key; }); return p ? p.name : ''; }
      function iconForPart(part){ return PART_ICONS[part] || '🎁'; }
      let activeLegendaryType = null;
      function isLegendaryVisible(){ return !!(els.legendaryOverlay && !els.legendaryOverlay.hidden && els.legendaryOverlay.classList.contains('visible')); }
      function openLegendaryModal(type){ if(!els.legendaryOverlay) return; activeLegendaryType = type; els.legendaryOverlay.hidden = false; requestAnimationFrame(()=> els.legendaryOverlay.classList.add('visible')); if(els.gearLegendaryModal) els.gearLegendaryModal.classList.toggle('active', type === 'gear'); if(els.characterLegendaryModal) els.characterLegendaryModal.classList.toggle('active', type === 'character'); document.body.classList.add('modal-open'); }
      function closeLegendaryModal(){ if(!els.legendaryOverlay) return; els.legendaryOverlay.classList.remove('visible'); els.legendaryOverlay.hidden = true; if(els.gearLegendaryModal) els.gearLegendaryModal.classList.remove('active'); if(els.characterLegendaryModal) els.characterLegendaryModal.classList.remove('active'); activeLegendaryType = null; if(!isUserOptionsOpen() && !state.ui.characterDetailOpen){ document.body.classList.remove('modal-open'); } }

      // Rare animation overlay
      function resolveRareAnimationAsset(kind, tier, targetId){
        if(!kind || !tier) return null;
        const config = state.config?.rareAnimations || {};
        const entries = Array.isArray(config[kind]) && config[kind].length ? config[kind] : (DEFAULT_RARE_ANIMATIONS[kind] || []);
        let best = null;
        let bestPriority = -1;
        let bestTierIndex = Number.POSITIVE_INFINITY;
        entries.forEach((asset)=>{
          if(!asset || typeof asset !== 'object') return;
          const assetTier = TIERS.includes(asset.tier) ? asset.tier : null;
          if(assetTier && !isAtLeast(tier, assetTier)) return;
          if(asset.id){
            if(!targetId || asset.id !== targetId) return;
          }
          const priority = asset.id ? 2 : 1;
          const tierIndex = assetTier ? TIER_INDEX[assetTier] : Number.POSITIVE_INFINITY;
          if(priority > bestPriority || (priority === bestPriority && tierIndex < bestTierIndex)){
            best = asset;
            bestPriority = priority;
            bestTierIndex = tierIndex;
          }
        });
        return best;
      }

      function hideRareAnimationOverlay(callback, options){
        const overlay = els.rareAnimationOverlay;
        if(!overlay){ if(typeof callback === 'function') callback(); return; }
        const anim = state.rareAnimations || {};
        const immediate = options && options.immediate;
        overlay.classList.remove('visible');
        overlay.classList.remove('preface-active');
        if(els.rareAnimationMessage){ els.rareAnimationMessage.style.display = 'none'; }
        setRareAnimationSkippable(true);
        if(immediate){
          overlay.hidden = true;
          if(typeof callback === 'function') callback();
          return;
        }
        if(anim.hideTimer){
          clearTimeout(anim.hideTimer);
          anim.hideTimer = null;
        }
        anim.hideTimer = setTimeout(()=>{
          overlay.hidden = true;
          anim.hideTimer = null;
          if(typeof callback === 'function') callback();
        }, RARE_ANIMATION_FADE_MS);
        state.rareAnimations = anim;
      }

      function showRareAnimationOverlay(asset, payload){
        const overlay = els.rareAnimationOverlay;
        if(!overlay) return;
        const img = els.rareAnimationImage;
        const labelEl = els.rareAnimationTier;
        const messageEl = els.rareAnimationMessage;
        const messageText = payload && typeof payload.message === 'string' ? payload.message : '';
        const sticky = !!(payload && payload.sticky === true);
        if(img){
          img.src = '';
          void img.offsetWidth;
          img.src = asset.src;
          img.alt = asset.alt || (payload && payload.label) || (payload && payload.tier ? `${payload.tier} 등급 획득 애니메이션` : '희귀 장비 애니메이션');
        }
        if(messageEl){
          messageEl.textContent = messageText;
          messageEl.style.display = messageText ? '' : 'none';
        }
        if(labelEl){
          const text = (payload && payload.label) || asset.label || (payload && payload.tier ? `${payload.tier} 획득!` : '희귀 장비 획득!');
          labelEl.textContent = text;
        }
        const prefaceMs = clampNumber(payload && payload.prefaceDuration, 0, 10000, messageText ? 1200 : 0);
        overlay.hidden = false;
        if(prefaceMs > 0 && messageText){
          overlay.classList.add('preface-active');
          setRareAnimationSkippable(false);
        } else {
          overlay.classList.remove('preface-active');
          if(messageEl){ messageEl.style.display = messageText ? '' : 'none'; }
          setRareAnimationSkippable(!sticky);
        }
        requestAnimationFrame(()=> overlay.classList.add('visible'));
        if(prefaceMs > 0 && messageText){
          let fallbackTimer = null;
          const endPreface = ()=>{
            overlay.classList.remove('preface-active');
            if(messageEl){ messageEl.style.display = 'none'; }
            if(sticky){
              setTimeout(()=> setRareAnimationSkippable(true), 800);
            } else {
              setRareAnimationSkippable(true);
            }
          };
          const schedule = (delay)=>{
            if(fallbackTimer){ clearTimeout(fallbackTimer); }
            const ms = typeof delay === 'number' ? delay : prefaceMs;
            fallbackTimer = setTimeout(endPreface, ms);
          };
          if(img){
            if(img.complete && img.naturalWidth > 0){
              schedule();
            } else {
              const onLoad = ()=>{
                img.removeEventListener('load', onLoad);
                schedule();
              };
              img.addEventListener('load', onLoad, { once: true });
              const fallbackDelay = Math.max(prefaceMs, ((payload && payload.duration) || RARE_ANIMATION_DURATION_MS) - 500);
              schedule(fallbackDelay);
            }
          } else {
            schedule();
          }
        } else if(sticky){
          setRareAnimationSkippable(false);
          setTimeout(()=> setRareAnimationSkippable(true), 800);
        } else {
          setRareAnimationSkippable(true);
        }
      }

      function clearRareAnimations(options){
        const anim = state.rareAnimations;
        if(!anim) return;
        if(anim.timer){
          clearTimeout(anim.timer);
          anim.timer = null;
        }
        if(anim.hideTimer){
          clearTimeout(anim.hideTimer);
          anim.hideTimer = null;
        }
        const current = anim.current;
        const queued = anim.queue.splice(0);
        anim.playing = false;
        anim.current = null;
        hideRareAnimationOverlay(()=>{
          if(current && typeof current.resolve === 'function') current.resolve();
          queued.forEach((entry)=>{ if(entry && typeof entry.resolve === 'function') entry.resolve(); });
        }, options);
        if(els.rareAnimationImage){ els.rareAnimationImage.src = ''; }
        if(els.rareAnimationTier){ els.rareAnimationTier.textContent = ''; }
        if(els.rareAnimationMessage){ els.rareAnimationMessage.textContent = ''; els.rareAnimationMessage.style.display = 'none'; }
      }

      function playNextRareAnimation(){
        const anim = state.rareAnimations;
        if(!anim) return;
        if(anim.timer){
          clearTimeout(anim.timer);
          anim.timer = null;
        }
        if(anim.queue.length === 0){
          anim.playing = false;
          anim.current = null;
          hideRareAnimationOverlay(undefined);
          return;
        }
        const next = anim.queue.shift();
        if(!next || !next.asset){
          if(next && typeof next.resolve === 'function') next.resolve();
          playNextRareAnimation();
          return;
        }
        anim.playing = true;
        anim.current = next;
        const payload = next.payload || {};
        const duration = payload.duration || 0;
        const sticky = payload.sticky === true;
        showRareAnimationOverlay(next.asset, payload);
        if(!sticky){
          anim.timer = setTimeout(()=> finishCurrentRareAnimation(), duration || RARE_ANIMATION_DURATION_MS);
        }
      }

      function finishCurrentRareAnimation(options){
        const anim = state.rareAnimations;
        if(!anim) return;
        if(anim.timer){
          clearTimeout(anim.timer);
          anim.timer = null;
        }
        const current = anim.current;
        hideRareAnimationOverlay(()=>{
          anim.playing = false;
          anim.current = null;
          if(current && typeof current.resolve === 'function') current.resolve();
          playNextRareAnimation();
        }, options);
      }

      function enqueueRareAnimation(payload){
        if(!payload || !payload.tier) return Promise.resolve();
        if(!els.rareAnimationOverlay) return Promise.resolve();
        const kind = payload.kind || 'gear';
        const asset = resolveRareAnimationAsset(kind, payload.tier, payload.targetId || null);
        if(!asset) return Promise.resolve();
        const anim = state.rareAnimations;
        if(!anim) return Promise.resolve();
        const labelSource = typeof payload.label === 'string' && payload.label.trim().length ? payload.label.trim() : (asset.label || `${payload.tier} 획득!`);
        const sticky = payload.sticky === true;
        const baseDuration = payload.duration ?? asset.duration;
        const duration = sticky ? 0 : clampNumber(baseDuration, 600, 20000, RARE_ANIMATION_DURATION_MS);
        const prefaceDuration = clampNumber(payload.prefaceDuration, 0, 10000, payload.message ? 1200 : 0);
        const entry = {
          payload: {
            kind,
            tier: payload.tier,
            label: labelSource,
            duration: sticky ? 0 : Math.max(duration, prefaceDuration ? prefaceDuration + 1500 : duration),
            targetId: payload.targetId || null,
            message: payload.message || '',
            prefaceDuration,
            sticky
          },
          asset,
          resolve: null,
          reject: null
        };
        const promise = new Promise((resolve)=>{
          entry.resolve = resolve;
        });
        anim.queue.push(entry);
        if(!anim.playing){
          playNextRareAnimation();
        }
        return promise;
      }

      function setRareAnimationSkippable(value){
        if(state.rareAnimations){
          state.rareAnimations.skippable = !!value;
        }
        if(els.rareAnimationSkip){
          els.rareAnimationSkip.disabled = !value;
        }
      }

      function skipRareAnimation(){
        if(!state.rareAnimations?.skippable) return;
        const anim = state.rareAnimations;
        if(!anim) return;
        const pending = anim.queue.splice(0);
        pending.forEach((entry)=>{ if(entry && typeof entry.resolve === 'function') entry.resolve(); });
        if(anim.playing){
          finishCurrentRareAnimation({ immediate: true });
        } else {
          clearRareAnimations({ immediate: true });
        }
      }

      function resetRareAnimationState(options){
        clearRareAnimations({ immediate: !!(options && options.immediate) });
      }

      function playRareAnimation(payload){
        try {
          return enqueueRareAnimation(payload);
        } catch (error) {
          console.warn('희귀 연출 실행 실패', error);
          return Promise.resolve();
        }
      }

      async function withRareAnimationBlock(operation){
        const alreadyBlocked = !!state.ui.rareAnimationBlocking;
        if(!alreadyBlocked){
          state.ui.rareAnimationBlocking = true;
          updateDrawButtons();
        }
        try {
          await operation();
        } finally {
          if(!alreadyBlocked){
            state.ui.rareAnimationBlocking = false;
            updateDrawButtons();
          }
        }
      }

      async function playCharacterDrawAnimation(entry){
        if(!entry || !entry.tier) return;
        const labelParts = [entry.tier];
        if(entry.name){ labelParts.push(entry.name); }
        const label = labelParts.join(' ');
        const targetId = entry.characterId || entry.id || null;
        resetRareAnimationState({ immediate: true });
        await withRareAnimationBlock(()=> playRareAnimation({
          kind: 'character',
          tier: entry.tier,
          label,
          targetId,
          duration: 0,
          message: '강력한 힘이 느껴집니다',
          prefaceDuration: 1500,
          sticky: true
        }));
      }

      async function playLegendaryGearAnimation(tier, part){
        const partName = getPartNameByKey(part) || part || '장비';
        const label = `${tier} ${partName}`.trim();
        resetRareAnimationState({ immediate: true });
        await withRareAnimationBlock(()=> playRareAnimation({
          kind: 'gear',
          tier,
          label,
          targetId: part || null,
          message: '전설 장비가 나타났습니다',
          prefaceDuration: 1200
        }));
      }

      function fillCharacterStats(target, stats, classId){ if(!target) return; const rows = [
          ['hp', 'HP', false],
          ['atk', 'ATK', false],
          ['def', 'DEF', false],
          ['critRate', '치명타율', true],
          ['critDmg', '치명타피해', true],
          ['dodge', '회피', true],
          ['speed', '속도', false]
        ];
        const showDetails = isAdmin();
        let statMultipliers = null;
        let statOffsets = null;
        if(classId){
          const balance = ensureCharacterBalanceConfig()[classId] || DEFAULT_CHARACTER_BALANCE[classId] || DEFAULT_CHARACTER_BALANCE.warrior;
          statMultipliers = balance.stats || {};
          statOffsets = balance.offsets || {};
        }
        const html = rows.map(([key, label, percent]) => {
          const value = stats && typeof stats[key] === 'number' ? stats[key] : null;
          if(value === null){
            return `<div>${label}: <b>-</b></div>`;
          }
          const multiplier = Number(statMultipliers?.[key] ?? 1);
          const offset = Number(statOffsets?.[key] ?? 0);
          const type = percent ? 'percent' : 'flat';
          const text = formatSnapshotCell(value, multiplier, offset, type, showDetails);
          const display = showDetails ? text : `<b>${text}</b>`;
          return `<div>${label}: ${display}</div>`;
        }).join('');
        target.innerHTML = html;
      }
      function buildGearComparison(item, current){ const partName = getPartNameByKey(item.part) || ''; const partIcon = iconForPart(item.part); const newEffectiveVal = effectiveStat(item); const currentEffectiveVal = current ? effectiveStat(current) : 0; const diff = newEffectiveVal - currentEffectiveVal; let deltaText; let deltaClass;
        if(current){ if(diff === 0){ deltaText = '전투력 변화 없음'; deltaClass = 'neutral'; } else if(diff > 0){ deltaText = `전투력 변화: +${formatNum(diff)}`; deltaClass = 'positive'; } else { deltaText = `전투력 변화: ${formatNum(diff)}`; deltaClass = 'negative'; } }
        else { deltaText = `전투력 변화: +${formatNum(newEffectiveVal)}`; deltaClass = 'positive'; }
        return {
          title: `${item.tier} ${partName} 획득!`,
          partName,
          partIcon,
          newTier: item.tier,
          newPartLabel: `${partIcon} ${partName}`,
          newBase: formatNum(item.base || 0),
          newEffective: formatNum(newEffectiveVal),
          newEffectiveValue: newEffectiveVal,
          currentTier: current ? current.tier : '없음',
          currentPartLabel: current ? `${iconForPart(current.part)} ${getPartNameByKey(current.part) || ''}` : '장착 장비 없음',
          currentBase: current ? formatNum(current.base || 0) : '-',
          currentEffective: current ? formatNum(currentEffectiveVal) : '-',
          currentEffectiveValue: currentEffectiveVal,
          deltaText,
          deltaClass,
          diff
        };
      }

      function showGearLegendaryModal(item, current){ const comparison = buildGearComparison(item, current); const token = `legendary-${Date.now()}-${Math.random().toString(36).slice(2)}`; let popup = null;
        try {
          popup = window.open('', `legendaryGear_${token}`, 'width=520,height=640,resizable=yes,scrollbars=yes');
        } catch (error) {
          popup = null;
        }
        if(popup){ const data = {
            token,
            title: comparison.title,
            newTier: comparison.newTier,
            newPartLabel: comparison.newPartLabel,
            newBase: comparison.newBase,
            newEffective: comparison.newEffective,
            currentTier: comparison.currentTier,
            currentPartLabel: comparison.currentPartLabel,
            currentBase: comparison.currentBase,
            currentEffective: comparison.currentEffective,
            deltaText: comparison.deltaText,
            deltaClass: comparison.deltaClass
          };
          const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><title>${escapeHtml(comparison.title)}</title><style>
              body{margin:0;padding:18px 20px;background:#111826;color:#e7ecf3;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Noto Sans KR,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji;}
              h2{margin:0 0 14px;font-size:18px;color:#6aa9ff;}
              .section{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:12px;}
              .card{background:rgba(255,255,255,0.04);border:1px solid rgba(142,238,255,0.25);border-radius:10px;padding:12px;}
              .label{font-size:12px;color:#aeb7c6;margin-bottom:4px;}
              .tier{font-weight:600;margin-bottom:4px;}
              .part{font-size:13px;margin-bottom:8px;}
              .stat{font-size:13px;margin:2px 0;}
              .delta{margin:12px 0;font-weight:600;}
              .delta.positive{color:#6aa9ff;}
              .delta.negative{color:#ff6b6b;}
              .delta.neutral{color:#aeb7c6;}
              .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;}
              button{background:rgba(142,238,255,0.15);color:#e7ecf3;border:1px solid rgba(142,238,255,0.35);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:14px;}
              button.primary{background:#6aa9ff;color:#06122a;border:none;}
              button.danger{background:rgba(255,107,107,0.18);border-color:rgba(255,107,107,0.45);}
            </style></head><body>
            <h2>${escapeHtml(comparison.title)}</h2>
            <div class="section">
              <div class="card">
                <div class="label">새 장비</div>
                <div class="tier">${escapeHtml(comparison.newTier)}</div>
                <div class="part">${escapeHtml(comparison.newPartLabel)}</div>
                <div class="stat">기본 수치: <b>${escapeHtml(comparison.newBase)}</b></div>
                <div class="stat">강화 포함: <b>${escapeHtml(comparison.newEffective)}</b></div>
              </div>
              <div class="card">
                <div class="label">현재 장비</div>
                <div class="tier">${escapeHtml(comparison.currentTier)}</div>
                <div class="part">${escapeHtml(comparison.currentPartLabel)}</div>
                <div class="stat">기본 수치: <b>${escapeHtml(comparison.currentBase)}</b></div>
                <div class="stat">강화 포함: <b>${escapeHtml(comparison.currentEffective)}</b></div>
              </div>
            </div>
            <div class="delta ${escapeHtml(comparison.deltaClass || 'neutral')}">${escapeHtml(comparison.deltaText || '')}</div>
            <div class="actions">
              <button data-choice="discard" class="danger">버리기</button>
              <button data-choice="spare">예비 보관</button>
              <button data-choice="equip" class="primary">즉시 착용</button>
            </div>
            <script>(function(){
              var token=${JSON.stringify(token)};
              var sent=false;
              function choose(choice){
                if(sent) return;
                sent=true;
                if(window.opener && !window.opener.closed){
                  window.opener.postMessage({type:'legendaryGearChoice', token: token, choice: choice}, '*');
                }
                window.close();
              }
              document.querySelectorAll('[data-choice]').forEach(function(btn){
                btn.addEventListener('click', function(){ choose(btn.getAttribute('data-choice')); });
              });
              window.addEventListener('beforeunload', function(){
                if(!sent && window.opener && !window.opener.closed){
                  window.opener.postMessage({type:'legendaryGearChoice', token: token, choice: 'discard'}, '*');
                }
              });
            })();</script></body></html>`;
          popup.document.write(html);
          popup.document.close();
          try { popup.focus(); } catch (e) {}
          return new Promise((resolve) => {
            const listener = (event) => {
              if(!event.data || event.data.type !== 'legendaryGearChoice' || event.data.token !== token) return;
              window.removeEventListener('message', listener);
              clearInterval(checkTimer);
              resolve(event.data.choice || 'discard');
            };
            window.addEventListener('message', listener);
            const checkTimer = setInterval(() => {
              if(popup.closed){
                clearInterval(checkTimer);
                window.removeEventListener('message', listener);
                resolve('discard');
              }
            }, 400);
          });
        }
        return showGearLegendaryOverlay(comparison, current);
      }

      function showGearLegendaryOverlay(comparison, current){ if(!els.legendaryOverlay) return Promise.resolve('spare'); openLegendaryModal('gear'); if(els.gearLegendaryTitle) els.gearLegendaryTitle.textContent = comparison.title; if(els.gearNewTier){ els.gearNewTier.className = `tier ${comparison.newTier}`; els.gearNewTier.textContent = comparison.newTier; } if(els.gearNewPart) els.gearNewPart.textContent = comparison.newPartLabel; if(els.gearNewBase) els.gearNewBase.textContent = comparison.newBase; if(els.gearNewEffective) els.gearNewEffective.textContent = comparison.newEffective; if(els.gearCurrentTier){ els.gearCurrentTier.className = current ? `tier ${comparison.currentTier}` : 'tier'; els.gearCurrentTier.textContent = comparison.currentTier; }
        if(els.gearCurrentPart) els.gearCurrentPart.textContent = comparison.currentPartLabel; if(els.gearCurrentBase) els.gearCurrentBase.textContent = comparison.currentBase; if(els.gearCurrentEffective) els.gearCurrentEffective.textContent = comparison.currentEffective; if(els.gearComparisonDelta){ els.gearComparisonDelta.textContent = comparison.deltaText; if(comparison.deltaClass === 'positive'){ els.gearComparisonDelta.style.color = 'var(--accent)'; } else if(comparison.deltaClass === 'negative'){ els.gearComparisonDelta.style.color = 'var(--danger)'; } else { els.gearComparisonDelta.style.color = 'var(--muted)'; } }
        return new Promise((resolve) => {
          const cleanup = (choice) => { if(els.gearEquipBtn) els.gearEquipBtn.onclick = null; if(els.gearSpareBtn) els.gearSpareBtn.onclick = null; if(els.gearDiscardBtn) els.gearDiscardBtn.onclick = null; closeLegendaryModal(); resolve(choice); };
          if(els.gearEquipBtn) els.gearEquipBtn.onclick = () => cleanup('equip');
          if(els.gearSpareBtn) els.gearSpareBtn.onclick = () => cleanup('spare');
          if(els.gearDiscardBtn) els.gearDiscardBtn.onclick = () => cleanup('discard');
        });
      }
      function showCharacterLegendaryModal(payload){ if(!els.legendaryOverlay) return Promise.resolve(); const { name, tier, className, classId, stats, count, image, imageSources, activeName, activeTier, activeClass, activeClassId, activeStats, activeCount, activeImage } = payload;
        openLegendaryModal('character');
        if(els.characterLegendaryTitle) els.characterLegendaryTitle.textContent = `${tier} ${name} 획득!`;
        if(els.characterNewName) els.characterNewName.textContent = name;
        if(els.characterNewTier){ els.characterNewTier.className = `char-tier tier ${tier}`; els.characterNewTier.textContent = tier; }
        if(els.characterNewClass) els.characterNewClass.textContent = className || '-';
        if(els.characterNewCount) els.characterNewCount.textContent = `보유: ${formatNum(count || 0)}`;
        const newImageSrc = image || (imageSources && imageSources[0]) || CHARACTER_IMAGE_PLACEHOLDER;
        if(els.characterNewImage){ els.characterNewImage.src = newImageSrc; els.characterNewImage.alt = name || '새 캐릭터'; }
        fillCharacterStats(els.characterNewStats, stats || {}, classId || null);
        if(els.characterCurrentName) els.characterCurrentName.textContent = activeName || '-';
        if(els.characterCurrentTier){ const tierLabel = activeTier || '-'; els.characterCurrentTier.className = `char-tier tier ${activeTier || ''}`; els.characterCurrentTier.textContent = tierLabel; }
        if(els.characterCurrentClass) els.characterCurrentClass.textContent = activeClass || '-';
        if(els.characterCurrentCount) els.characterCurrentCount.textContent = `보유: ${formatNum(activeCount || 0)}`;
        const activeImageSrc = activeImage || CHARACTER_IMAGE_PLACEHOLDER;
        if(els.characterCurrentImage){ els.characterCurrentImage.src = activeImageSrc; els.characterCurrentImage.alt = activeName || '현재 캐릭터'; }
        fillCharacterStats(els.characterCurrentStats, activeStats || {}, activeClassId || null);
        return new Promise((resolve) => {
          const cleanup = () => { if(els.characterLegendaryClose) els.characterLegendaryClose.onclick = null; closeLegendaryModal(); resolve(); };
          if(els.characterLegendaryClose) els.characterLegendaryClose.onclick = cleanup;
        });
      }
      function createGearCard(partDef, item, opts){ opts = opts || {}; const card = document.createElement('div'); card.className = 'gear-card'; if(opts.kind) card.classList.add(opts.kind); card.dataset.slot = partDef.key; const icon = iconForPart(partDef.key); if(item){ card.dataset.tier = item.tier||'NONE'; const isEquip = opts.kind === 'gear-equip'; const isSpare = opts.kind === 'gear-spare'; if(isEquip) card.classList.add('equipped'); const label = `${item.tier}${item.lvl ? ' +' + item.lvl : ''}`; const statLabel = item.type === 'atk' ? 'ATK' : 'DEF'; const eff = formatNum(effectiveStat(item)); const base = formatNum(item.base||0); card.innerHTML = `
          <div class="gear-slot">${partDef.name}</div>
          <div class="gear-icon">${icon}</div>
          <div class="gear-tier-text">${label}</div>
          <div class="gear-stat">${statLabel} ${eff}<span class="gear-sub">기본 ${base}</span></div>`; if(opts.button){ const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'equip-btn'; btn.dataset.part = partDef.key; btn.textContent = opts.button; card.appendChild(btn); } if(isEquip){ const badge = document.createElement('div'); badge.className = 'gear-badge'; badge.textContent = '장착중'; card.appendChild(badge); } else if(isSpare){ const badge = document.createElement('div'); badge.className = 'gear-badge spare'; badge.textContent = '예비'; card.appendChild(badge); } }
        else {
          card.dataset.tier = 'NONE'; card.classList.add('empty'); const emptyText = opts.emptyText || '장비 없음'; card.innerHTML = `
          <div class="gear-slot">${partDef.name}</div>
          <div class="gear-icon">${icon}</div>
          <div class="gear-tier-text muted">${emptyText}</div>`; }
        return card; }
      function appendLog(rec){ const div = document.createElement('div'); div.className='item'; const dt = new Date(rec.ts); const time = dt.toLocaleTimeString('ko-KR'); const partName = getPartNameByKey(rec.part) || '-'; div.innerHTML = `<span class="small muted">#${rec.id}</span>
        <span class="pill tier ${rec.tier}">${rec.tier}</span>
        <span class="small">${partName}</span>
        <span class="small">${formatNum(rec.stat||0)}</span>
        <span class="muted small">${time}</span>
        <span class="sep"></span>
        <span class="small muted">run:${rec.runId}</span>
        <span class="small muted">cfg:${rec.cfgHash.slice(0,8)}</span>`; els.log.prepend(div); const maxItems = 200; while(els.log.children.length>maxItems){ els.log.removeChild(els.log.lastChild); } }

      function applyCharacterImageFallback(img, sources){ if(!(img instanceof HTMLImageElement)) return; const list = Array.isArray(sources) ? sources.filter(Boolean) : []; const unique = Array.from(new Set(list)); let index = 0; const handleFallback = ()=>{ while(index < unique.length){ const candidate = unique[index++]; if(candidate){ img.src = candidate; return; } }
          img.removeEventListener('error', handleError);
          img.src = CHARACTER_IMAGE_PLACEHOLDER;
        };
        const handleError = ()=>{ handleFallback(); };
        img.addEventListener('error', handleError);
        if(unique.length === 0){ img.src = CHARACTER_IMAGE_PLACEHOLDER; return; }
        handleFallback(); }

      function createCharacterImageElement(name, sources){ const img = document.createElement('img'); img.alt = name || '캐릭터'; img.decoding = 'async'; img.loading = 'lazy'; applyCharacterImageFallback(img, sources); return img; }

      function renderDrawResults(items, count){ if(!els.drawResults) return; const wrap = els.drawResults; const grid = wrap.querySelector('.draw-result-grid'); const title = wrap.querySelector('h3'); if(!items || !items.length){ wrap.style.display = 'none'; if(grid) grid.innerHTML=''; resetRareAnimationState({ immediate: true }); return; }
        if(title){ title.textContent = `${count}회 뽑기 결과`; }
        if(grid){ const frag = document.createDocumentFragment(); items.forEach(function(entry){ const card = document.createElement('div'); card.className = 'draw-card'; if(entry.type === 'pet'){ card.classList.add('pet'); const icon = entry.icon || '🐾'; const name = entry.name || entry.petId || '펫'; card.innerHTML = `
                <div class="draw-icon">${icon}</div>
                <div class="draw-part">${name}</div>`;
          } else if(entry.type === 'character'){ card.classList.add('character'); const tierLabel = document.createElement('div'); tierLabel.className = `tier-label tier ${entry.tier || ''}`; tierLabel.textContent = entry.tier || ''; const iconWrap = document.createElement('div'); iconWrap.className = 'draw-icon'; const imgEl = createCharacterImageElement(entry.name || entry.characterId || '캐릭터', entry.imageSources || (entry.image ? [entry.image] : [])); iconWrap.appendChild(imgEl); const nameEl = document.createElement('div'); nameEl.className = 'draw-part'; nameEl.textContent = entry.name || entry.characterId || '캐릭터'; const subEl = document.createElement('div'); subEl.className = 'draw-sub muted small'; subEl.textContent = entry.className || ''; card.appendChild(tierLabel); card.appendChild(iconWrap); card.appendChild(nameEl); card.appendChild(subEl);
          } else {
            card.innerHTML = `
                <div class="tier-label tier ${entry.tier}">${entry.tier}</div>
                <div class="draw-icon">${entry.icon}</div>
                <div class="draw-part">${entry.partName}</div>`;
          }
          frag.appendChild(card);
        }); grid.innerHTML=''; grid.appendChild(frag); }
        wrap.style.display = '';
        items.filter(function(entry){ const kind = entry.type || 'gear'; return kind === 'gear' && entry.tier; }).forEach(function(entry){
          const kind = entry.type || 'gear';
          const parts = [];
          if(entry.tier) parts.push(entry.tier);
          if(entry.partName) parts.push(entry.partName);
          const label = parts.length ? `${parts.join(' ')} 획득!` : '희귀 획득!';
          const targetId = entry.part || entry.partName || null;
          if(entry.item && entry.item.__animationPlayed){
            return;
          }
          playRareAnimation({ kind, tier: entry.tier, label, targetId });
        });
        items.filter(function(entry){ return entry.type === 'character' && entry.tier && isAtLeast(entry.tier, 'SS+'); }).forEach(function(entry){
          if(entry.__animationPlayed){
            return;
          }
          const labelParts = [entry.tier];
          if(entry.name){ labelParts.push(entry.name); }
          const label = labelParts.join(' ');
          playRareAnimation({ kind: 'character', tier: entry.tier, label, targetId: entry.characterId || null });
        });
      }

      function petWeightEntries(){
        const entries = PET_IDS.map((id) => {
          const raw = state.petGachaWeights?.[id];
          const weight = (typeof raw === 'number' && isFinite(raw) && raw >= 0) ? raw : 1;
          return { id, weight };
        });
        const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
        if (!(total > 0)) {
          entries.forEach((entry) => { entry.weight = 1; });
        }
        return entries;
      }

      function renderPetStats(){ if(!els.petStatsTable) return; const tbody = els.petStatsTable; tbody.innerHTML=''; const pets = ensurePetState(); const entries = petWeightEntries(); const total = entries.reduce((sum, e)=> sum + e.weight, 0) || entries.length; entries.forEach((entry) => {
          const def = PET_DEFS[entry.id] || { name: entry.id, icon: '🐾' };
          const percent = total > 0 ? (entry.weight / total) * 100 : (100 / entries.length);
          const owned = pets.owned?.[entry.id] || 0;
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${def.icon || '🐾'} ${def.name}</td><td>${percent.toFixed(2)}%</td><td>${formatNum(owned)}</td>`;
          tbody.appendChild(tr);
        }); }

      function updateCharacterStatsSummary(stats){
        if(state.ui.statsMode !== 'character') return;
        const snapshot = stats ? sanitizeCharacterDrawStats(stats) : sanitizeCharacterDrawStats(state.characterStats);
        const observedTotal = Object.values(snapshot.counts || {}).reduce((sum, val)=> sum + (val || 0), 0);
        const totalDraws = Math.max(0, snapshot.draws || 0, observedTotal);
        if(els.nDraws){ els.nDraws.textContent = formatNum(totalDraws); }
        if(els.pval){ els.pval.textContent = '–'; }
      }

      function renderCharacterStats(){ if(!els.characterStatsTable) return; const tbody = els.characterStatsTable; tbody.innerHTML=''; const stats = sanitizeCharacterDrawStats(state.characterStats); state.characterStats = stats; const observedTotal = Object.values(stats.counts || {}).reduce((sum, val)=> sum + (val || 0), 0); const totalDraws = Math.max(0, stats.draws || 0, observedTotal); const probs = state.config.characterProbs || state.config.probs || {}; const tiers = [...TIERS];
        if(totalDraws === 0){ const tr = document.createElement('tr'); tr.innerHTML = `<td colspan="6" class="muted small">캐릭터 뽑기 기록이 없습니다.</td>`; tbody.appendChild(tr); updateCharacterStatsSummary(stats); return; }
        tiers.sort((a,b)=> TIER_INDEX[a]-TIER_INDEX[b]);
        tiers.forEach((tier)=>{
          const prob = Math.max(0, probs[tier] || 0);
          const count = Math.max(0, stats.counts?.[tier] || 0);
          const expected = totalDraws * prob;
          const ratio = totalDraws > 0 ? count / totalDraws : 0;
          const delta = count - expected;
          const relErrorText = expected > 0 ? `${((delta / expected) * 100).toFixed(2)}%` : (count > 0 ? '∞' : '–');
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="tier ${tier}">${tier}</td>
            <td>${(ratio * 100).toFixed(3)}%</td>
            <td>${expected.toFixed(2)}</td>
            <td>${formatNum(count)}</td>
            <td>${delta >= 0 ? '+' : ''}${delta.toFixed(2)}</td>
            <td>${relErrorText}</td>`;
          tbody.appendChild(tr);
        });
        updateCharacterStatsSummary(stats);
      }

      function renderPetWeightTable(){ if(!els.petWeightTableBody) return; const tbody = els.petWeightTableBody; tbody.innerHTML = ''; PET_IDS.forEach((id) => {
          const def = PET_DEFS[id] || { name: id, icon: '🐾' };
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${def.icon || '🐾'} ${def.name}</td><td><input type="number" step="any" min="0" data-pet="${id}" class="pet-weight-input" style="width:100px" /></td>`;
          tbody.appendChild(tr);
        });
        updatePetWeightInputs();
      }

      function updatePetWeightInputs(){ if(!els.petWeightTableBody) return; const canEdit = isAdmin() && !state.config.locked; const inputs = els.petWeightTableBody.querySelectorAll('input[data-pet]'); inputs.forEach((input) => {
          const petId = input.dataset.pet;
          const value = state.petGachaWeights?.[petId];
          input.value = typeof value === 'number' && isFinite(value) ? String(value) : '1';
          input.disabled = !canEdit;
          input.title = canEdit ? '' : '관리자만 수정 가능하며, 잠겨 있지 않아야 합니다.';
        });
        renderPetStats();
      }

      function updateGachaModeView(mode){ if(mode){ state.ui.gachaMode = mode === 'pet' ? 'pet' : (mode === 'character' ? 'character' : 'gear'); }
        const current = state.ui.gachaMode || 'gear';
        const isGear = current === 'gear';
        const isPet = current === 'pet';
        const isCharacter = current === 'character';
        const configButtons = {
          gear: els.gachaModeGearConfig,
          pet: els.gachaModePetConfig,
          character: els.gachaModeCharacterConfig
        };
        const drawButtons = {
          gear: els.gachaModeGearDraw,
          pet: els.gachaModePetDraw,
          character: els.gachaModeCharacterDraw
        };
        Object.entries(configButtons).forEach(([key, btn]) => {
          if(btn) btn.classList.toggle('active', key === current);
        });
        Object.entries(drawButtons).forEach(([key, btn]) => {
          if(btn) btn.classList.toggle('active', key === current);
        });
        if(els.gearConfigWrap) els.gearConfigWrap.style.display = isGear ? '' : 'none';
        if(els.petConfigWrap) els.petConfigWrap.style.display = isPet ? '' : 'none';
        if(els.characterConfigWrap) els.characterConfigWrap.style.display = isCharacter ? '' : 'none';
        if(isPet){ updatePetWeightInputs(); }
        if(els.gearDrawControls) els.gearDrawControls.style.display = isGear ? '' : 'none';
        if(els.petDrawControls) els.petDrawControls.style.display = isPet ? '' : 'none';
        if(els.characterDrawControls) els.characterDrawControls.style.display = isCharacter ? '' : 'none';
        const desiredStats = isGear ? 'gear' : (isPet ? 'pet' : 'character');
        state.ui.statsMode = desiredStats;
        if(els.statsMode && els.statsMode.value !== desiredStats){ els.statsMode.value = desiredStats; }
        updateStatsModeView();
        updateDrawButtons();
      }

      function updatePetList(){ if(!els.petList) return; const pets = ensurePetState(); const container = els.petList; container.innerHTML=''; PET_IDS.forEach((id) => {
          const def = PET_DEFS[id] || { name: id, icon: '🐾' };
          const owned = pets.owned?.[id] || 0;
          const card = document.createElement('div');
          card.className = 'pet-card';
          if (pets.active === id) card.classList.add('active');
          const info = document.createElement('div');
          info.className = 'info';
          const status = pets.active === id ? ' · 장착중' : '';
          info.innerHTML = `<div class="name">${def.icon || '🐾'} ${def.name}</div><div class="count">보유: ${formatNum(owned)}${status}</div>`;
          const ability = describePetAbilities(def);
          const abilityText = [ability.passive, ability.active].filter(Boolean).join(' · ');
          if (abilityText) {
            const desc = document.createElement('div');
            desc.className = 'desc';
            desc.textContent = abilityText;
            info.appendChild(desc);
          }
          const btnWrap = document.createElement('div');
          btnWrap.className = 'actions';
          const equipBtn = document.createElement('button');
          equipBtn.type = 'button';
          if (pets.active === id) {
            equipBtn.textContent = '장착중';
            equipBtn.disabled = true;
          } else {
            equipBtn.textContent = '장착';
            equipBtn.disabled = !isAdmin() && owned <= 0;
            equipBtn.addEventListener('click', () => setActivePet(id));
          }
          btnWrap.appendChild(equipBtn);
          card.appendChild(info);
          card.appendChild(btnWrap);
          container.appendChild(card);
        });
        renderPetStats();
      }

      function setActivePet(petId){ if(!PET_IDS.includes(petId)) return; const pets = ensurePetState(); if(!isAdmin() && (pets.owned?.[petId] || 0) <= 0){ alert('해당 펫을 보유하고 있지 않습니다.'); return; } if(pets.active === petId) return; pets.active = petId; if(userProfile) userProfile.pets = pets; updateInventoryView(); updatePetList(); markProfileDirty(); }

      function rollPet(randomValue){ const value = (typeof randomValue === 'number' && isFinite(randomValue) && randomValue >= 0) ? randomValue : Math.random(); const entries = petWeightEntries(); const total = entries.reduce((sum, entry) => sum + entry.weight, 0) || entries.length; let ticket = value * total; for(const entry of entries){ const weight = entry.weight > 0 ? entry.weight : 0; ticket -= weight; if(ticket <= 0){ return entry.id; } }
        return entries.length ? entries[entries.length - 1].id : PET_IDS[0]; }

      function runPetDraws(count){ if((state.ui.gachaMode || 'gear') !== 'pet'){ updateGachaModeView('pet'); }
        const n = Math.max(1, parseInt(count, 10) || 1); const pets = ensurePetState(); const admin = isAdmin(); const available = admin ? Number.POSITIVE_INFINITY : (state.items.petTicket || 0); if(!admin && available < n){ alert('펫 뽑기권이 부족합니다.'); return; }
        state.inRun = true; updateDrawButtons(); const rng = getRng(); const results = []; for(let i=0; i<n; i+=1){ const petId = rollPet(rng()); pets.owned[petId] = (pets.owned[petId] || 0) + 1; const def = PET_DEFS[petId] || { name: petId, icon: '🐾' }; results.push({ type:'pet', petId, name: def.name, icon: def.icon }); }
        if(!admin){ state.items.petTicket = Math.max(0, (state.items.petTicket || 0) - n); }
        if(userProfile){ userProfile.pets = pets; userProfile.items = state.items; }
        state.inRun = false;
        updateItemCountsView();
        updateInventoryView();
        updateDrawButtons();
        renderDrawResults(results, n);
        renderPetStats();
        markProfileDirty();
      }

      async function runCharacterDraws(count){ if((state.ui.gachaMode || 'gear') !== 'character'){ updateGachaModeView('character'); }
        const n = Math.max(1, parseInt(count, 10) || 1);
        const admin = isAdmin();
        if(!admin && state.wallet < CHARACTER_DRAW_COST){ alert('포인트가 부족합니다.'); return; }
        ensureCharacterState();
        const characters = state.characters;
        const charStats = sanitizeCharacterDrawStats(state.characterStats);
        state.characterStats = charStats;
        state.inRun = true;
        updateDrawButtons();
        const rng = getRng();
        const results = [];
        const characterProbs = (()=>{ const probs = state.config.characterProbs || {}; if(Object.values(probs).some((v)=> v > 0)){ return probs; } return state.config.probs; })();
        for(let i = 0; i < n; i += 1){
          if(!admin && !canSpend(CHARACTER_DRAW_COST)){ alert('포인트가 부족합니다.'); break; }
          if(!admin && !spendPoints(CHARACTER_DRAW_COST)){ break; }
          const tier = chooseTier(characterProbs, rng);
          const charId = randomCharacterIdForTier(tier, rng) || DEFAULT_CHARACTER_ID;
          if(!charId) continue;
          characters.owned[charId] = (characters.owned[charId] || 0) + 1;
          charStats.draws = clampNumber((charStats.draws || 0) + 1, 0, Number.MAX_SAFE_INTEGER, 0);
          if(!Object.prototype.hasOwnProperty.call(charStats.counts, tier)){
            charStats.counts[tier] = 0;
          }
          charStats.counts[tier] = clampNumber((charStats.counts[tier] || 0) + 1, 0, Number.MAX_SAFE_INTEGER, 0);
          const def = getCharacterDefinition(charId) || { name: charId, image: '', className: '' };
          const imageSources = getCharacterImageVariants(charId);
          if(def.image && !imageSources.includes(def.image)){ imageSources.unshift(def.image); }
          const cardPayload = { type: 'character', characterId: charId, tier, name: def.name || charId, image: imageSources[0] || '', imageSources, className: def.className || '' };
          results.push(cardPayload);
          announceRareDrop('character', tier, cardPayload.name || cardPayload.characterId || '캐릭터');
          if(isLegendaryCharacterTier(tier)){
            const activeId = getActiveCharacterId();
            const activeDef = getCharacterDefinition(activeId) || getActiveCharacterDefinition();
            const activeSources = getCharacterImageVariants(activeId);
            if(activeDef?.image && !activeSources.includes(activeDef.image)){ activeSources.unshift(activeDef.image); }
            if(isAtLeast(tier, 'SS+')){
              await playCharacterDrawAnimation({
                tier,
                name: cardPayload.name,
                characterId: cardPayload.characterId
              });
            }
            await showCharacterLegendaryModal({
              name: def.name || charId,
              tier,
              className: def.className || '',
              classId: def.classId || null,
              stats: def.stats || {},
              count: characters.owned[charId] || 0,
              image: cardPayload.image,
              imageSources,
              activeName: activeDef?.name || activeId,
              activeTier: activeDef?.tier || '-',
              activeClass: activeDef?.className || '-',
              activeClassId: activeDef?.classId || null,
              activeStats: activeDef?.stats || {},
              activeCount: characters.owned?.[activeId] || 0,
              activeImage: activeSources[0] || CHARACTER_IMAGE_PLACEHOLDER
            });
          }
        }
        ensureCharacterState();
        state.characters = characters;
        if(userProfile) userProfile.characters = characters;
        userProfile.characterStats = charStats;
        state.inRun = false;
        updateInventoryView();
        updateDrawButtons();
        renderDrawResults(results, results.length);
        renderCharacterStats();
        updateProgress(0, 100);
        markProfileDirty();
      }

      function updateStatsModeView(){ let mode = state.ui.statsMode || 'gear'; if(els.statsMode){ mode = els.statsMode.value || mode; state.ui.statsMode = mode; } if(els.statsMode && els.statsMode.value !== mode){ els.statsMode.value = mode; }
        if(els.gearStatsWrap) els.gearStatsWrap.style.display = mode === 'gear' ? '' : 'none';
        if(els.petStatsWrap) els.petStatsWrap.style.display = mode === 'pet' ? '' : 'none';
        if(els.characterStatsWrap) els.characterStatsWrap.style.display = mode === 'character' ? '' : 'none';
        if(els.resetSession) els.resetSession.style.display = mode === 'gear' ? '' : 'none';
        if(els.resetGlobal) els.resetGlobal.style.display = mode === 'gear' ? '' : 'none';
        if(mode === 'pet'){
          renderPetStats();
        } else if(mode === 'character'){
          renderCharacterStats();
        } else {
          syncStats();
          drawChart();
        }
      }

      function resetSession(){ if(!confirm('세션 통계와 로그를 초기화할까요?')) return; state.session = { draws:0, counts:Object.fromEntries(TIERS.map(t=>[t,0])), history: [] }; state.pitySince = 0; state.inventory = []; state.equip = {head:null, body:null, main:null, off:null, boots:null}; state.spares = { head:null, body:null, main:null, off:null, boots:null }; state.buffs = { accelUntil:0, accelMultiplier:1, hyperUntil:0, hyperMultiplier:1 }; els.log.innerHTML = ''; updateCombatView(); updateInventoryView(); buildForgeTargetOptions(); updateForgeInfo(); syncStats(); drawChart(); updateProgress(0, 100); markProfileDirty(); }
      function resetGlobal(){ if(!confirm('전체(전역) 통계를 초기화할까요? 이 작업은 취소할 수 없습니다.')) return; state.global = { draws:0, counts:Object.fromEntries(TIERS.map(t=>[t,0])) }; saveGlobal(); if(els.scope.value==='global'){ syncStats(); drawChart(); } }

      // Save/Load/Share
      function compactConfig(){ const {weights, probs, characterWeights, characterProbs, pity, minGuarantee10, seed, locked, version, dropRates, shopPrices, goldScaling, potionSettings, hyperPotionSettings, monsterScaling, petWeights, rareAnimations} = state.config; return {weights, probs, characterWeights, characterProbs, pity, minGuarantee10, seed, locked, version, dropRates, shopPrices, goldScaling, potionSettings, hyperPotionSettings, monsterScaling, petWeights, rareAnimations}; }
      function saveConfigFile(){ const data = JSON.stringify(compactConfig(), null, 2); const blob = new Blob([data], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gacha-config.json'; a.click(); URL.revokeObjectURL(a.href); }
      function loadConfigFile(e){ const f = e.target.files[0]; if(!f) return; const rd = new FileReader(); rd.onload = ()=>{ try{ const cfg = JSON.parse(rd.result); applyLoadedConfig(cfg); } catch(err){ alert('불러오기 실패: '+err); } }; rd.readAsText(f); e.target.value=''; }
      function applyLoadedConfig(cfg){ if(!cfg || !cfg.weights) { alert('형식이 올바르지 않습니다.'); return; } state.config.weights = {...defaultWeights, ...cfg.weights}; state.config.probs = normalize(state.config.weights); state.config.characterWeights = sanitizeWeights(cfg.characterWeights || cfg.characterGachaWeights || state.config.characterWeights); state.config.characterProbs = normalize(state.config.characterWeights); state.config.seed = cfg.seed||''; state.config.locked = !!cfg.locked; state.config.pity = cfg.pity||{enabled:false,floorTier:'S',span:90}; state.config.minGuarantee10 = cfg.minGuarantee10||{enabled:false,tier:'A'}; state.config.dropRates = migrateLegacyDropRates(cfg.dropRates); state.config.goldScaling = normalizeGoldScaling(cfg.goldScaling); state.config.shopPrices = normalizeShopPrices(cfg.shopPrices); state.config.potionSettings = normalizePotionSettings(cfg.potionSettings, DEFAULT_POTION_SETTINGS); state.config.hyperPotionSettings = normalizePotionSettings(cfg.hyperPotionSettings, DEFAULT_HYPER_POTION_SETTINGS); state.config.monsterScaling = normalizeMonsterScaling(cfg.monsterScaling); state.config.petWeights = sanitizePetWeights(cfg.petWeights || cfg.petGachaWeights || state.config.petWeights); state.config.rareAnimations = normalizeRareAnimations(cfg.rareAnimations); reflectConfig(); if(isAdmin()) clearActivePreset(); else clearSelectedPreset(); markProfileDirty(); }
      function shareLink(){ const cfg = compactConfig(); const json = JSON.stringify(cfg); const b = btoa(unescape(encodeURIComponent(json))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); const url = location.origin + location.pathname + '?cfg='+b; if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(function(){ alert('링크가 클립보드에 복사되었습니다.'); }).catch(function(){ prompt('아래 링크를 복사하세요', url); }); } else { prompt('아래 링크를 복사하세요', url); } }
      function readLink(){ const m = location.search.match(/[?&]cfg=([^&]+)/); if(!m) return; try{ const b = m[1].replace(/-/g,'+').replace(/_/g,'/'); const json = decodeURIComponent(escape(atob(b))); const cfg = JSON.parse(json); applyLoadedConfig(cfg); } catch(e){ console.warn('링크 파싱 실패', e); }
      }

      function ensurePetState(){
        if(!state.pets || typeof state.pets !== 'object'){
          state.pets = createDefaultPetState();
        }
        if(!state.pets.owned || typeof state.pets.owned !== 'object'){
          state.pets.owned = createDefaultPetState().owned;
        }
        return state.pets;
      }

      const DEFAULT_CHARACTER_ID = CHARACTER_IDS.includes('waD') ? 'waD' : (CHARACTER_IDS[0] || null);
      const CHARACTER_DRAW_COST = 10000;
      const CHARACTER_SKILL_INFO = Object.freeze({
        warrior: {
          title: '강철의 격타',
          summary: '강력한 일격으로 큰 피해를 주고 두꺼운 보호막을 전개합니다.',
          detail: '필살기 피해가 150%로 강화되며, 방어력의 240%만큼 피해를 흡수하는 보호막을 전개합니다.'
        },
        mage: {
          title: '마나 폭발',
          summary: '마법 폭발로 높은 피해를 주고 흡혈하며, 적의 방어를 크게 약화시킵니다.',
          detail: '공격력과 치명 피해에 비례한 강력한 피해를 주고, 피해의 35%만큼 체력을 회복하며 2턴 동안 적의 방어력을 35% 낮춥니다.'
        },
        archer: {
          title: '연속 사격',
          summary: '최대 3연타로 적을 사격하여 폭발적인 연속 피해를 노립니다.',
          detail: '1회당 75% 피해로 최대 3번 공격하며, 명중 시 누적 피해를 줍니다. 빗나간 횟수도 전투 로그에 표시됩니다.'
        },
        rogue: {
          title: '그림자 일격',
          summary: '출혈을 유발하는 암살 검으로 적을 지속적으로 괴롭힙니다.',
          detail: '피해를 주고 3턴 동안 매턴 공격력의 50%에 해당하는 출혈 피해를 부여합니다.'
        },
        goddess: {
          title: '여신의 심판',
          summary: '신성한 심판으로 피해와 함께 회복·보호막을 동시에 제공합니다.',
          detail: '공격력과 방어력에 비례한 피해를 준 뒤, 최대 체력의 28%를 회복하고 방어력의 200%만큼 보호막을 생성합니다.'
        }
      });

      const PLAYER_ULTIMATE_DEFAULT_CHANCE = 0.05;

      const CHARACTER_ULTIMATE_DATA = Object.freeze({
        warrior: [
          { minTier: 'SS+', name: '천룡 파쇄격', variant: 'warrior-ssplus' },
          { minTier: 'SSS+', name: '파멸의 낙뢰도', variant: 'warrior-sssplus' }
        ],
        mage: [
          { minTier: 'SS+', name: '마나 초신성', variant: 'mage-ssplus' },
          { minTier: 'SSS+', name: '라그나로크 오브', variant: 'mage-sssplus' }
        ],
        archer: [
          { minTier: 'SS+', name: '섬광의 연사', variant: 'archer-ssplus' },
          { minTier: 'SSS+', name: '운석 낙하 사격', variant: 'archer-sssplus' }
        ],
        rogue: [
          { minTier: 'SS+', name: '그림자 찌르기', variant: 'rogue-ssplus' },
          { minTier: 'SSS+', name: '혈월 난무', variant: 'rogue-sssplus' }
        ],
        goddess: [
          { minTier: 'S+', name: '천상의 축복', variant: 'goddess-splus' },
          { minTier: 'SS+', name: '시간의 기도', variant: 'goddess-ssplus' },
          { minTier: 'SSS+', name: '창세의 빛', variant: 'goddess-sssplus' }
        ]
      });

      const CHARACTER_ULTIMATE_INFO = Object.freeze({
        'warrior-ssplus': {
          summary: '공격력의 420% 피해를 입히고 2턴 동안 적 방어력을 35% 낮추며, 자신은 2턴 동안 피해 20% 감소.',
          detail: '천룡 파쇄격은 방어력 감소와 생존 버프를 동시에 제공하여 후속 딜을 강화합니다.'
        },
        'warrior-sssplus': {
          summary: '공격력의 550% 피해 + 적 현재 체력 15% 진실 피해, 방어력 45% 감소(2턴), 자신 피해 감소 30%(2턴).',
          detail: '파멸의 낙뢰도는 거대한 폭발 피해로 전투 흐름을 뒤집고, 강력한 방어 디버프와 생존 버프를 제공합니다.'
        },
        'mage-ssplus': {
          summary: '공격력의 380% 피해 후 3턴 동안 적이 받는 마법 피해 +25%, 자신 체력 25% 회복.',
          detail: '마나 초신성은 마법 취약을 부여해 동료의 마법 피해를 강화하고, 안정적인 회복을 제공합니다.'
        },
        'mage-sssplus': {
          summary: '공격력의 520% 피해 + 적 현재 체력 12% 진실 피해, 마법 피해 +40%(3턴), 스킬 쿨다운 1턴 감소.',
          detail: '라그나로크 오브는 폭발적인 피해와 함께 적을 취약하게 만들고, 자신의 다음 스킬 사용을 앞당깁니다.'
        },
        'archer-ssplus': {
          summary: '5연속 사격(각 80% 피해). 치명 시 적 명중률 10% 감소(1턴).',
          detail: '섬광의 연사는 빠른 연속 공격으로 적을 무력화하고 명중률을 떨어뜨립니다.'
        },
        'archer-sssplus': {
          summary: '7연속 사격(각 90% 피해). 치명 시 명중률 15% 감소(2턴), 모두 명중 시 스킬 쿨다운 1턴 감소.',
          detail: '운석 낙하 사격은 다단히트로 피해를 누적시키고, 모든 화살을 적중시키면 추가 행동 기회를 제공합니다.'
        },
        'rogue-ssplus': {
          summary: '공격력의 300% 피해 + 3턴 출혈(공격력 90%), 자신 회피 20%(1턴).',
          detail: '그림자 찌르기는 빠른 공격과 출혈로 적을 괴롭히고, 회피 버프로 반격을 피합니다.'
        },
        'rogue-sssplus': {
          summary: '2연속 240% 피해(치명률 +30%) 후 4턴 출혈(공격력 120%), 회피 25%·속도 +15 (2턴).',
          detail: '혈월 난무는 암살자의 진수를 보여 주며, 전투 템포를 장악합니다.'
        },
        'goddess-splus': {
          summary: '체력 40% 회복, 2턴 동안 공격·방어 +25%, 성속성 피해 280%.',
          detail: '천상의 축복은 파티를 회복하고 강화하며, 신성한 낙뢰로 적을 공격합니다.'
        },
        'goddess-ssplus': {
          summary: '체력 50% 회복 + 보호막 생성, 적 1턴 시간정지, 스킬 쿨다운 초기화, 성속성 피해 320%.',
          detail: '시간의 기도는 적을 멈추고 아군을 완벽히 지켜 주며, 다시 공격할 준비를 갖춥니다.'
        },
        'goddess-sssplus': {
          summary: '체력 완전 회복 + 아군 전원 부활/회복, 공격·방어·속도 +35%(3턴), 성속성 피해 650% + 진실 피해 20%, 적 받는 피해 +30%(2턴).',
          detail: '창세의 빛은 전투당 한 번 모든 것을 되돌리는 궁극기입니다. 전열을 재정비하고 적을 말 그대로 태워 버립니다.'
        }
      });

      function ensureCharacterState(){
        if(!state.characters || typeof state.characters !== 'object'){
          state.characters = createDefaultCharacterState();
        }
        if(!state.characters.owned || typeof state.characters.owned !== 'object'){
          state.characters.owned = createDefaultCharacterState().owned;
        }
        CHARACTER_IDS.forEach((id) => {
          if(typeof state.characters.owned[id] !== 'number' || !isFinite(state.characters.owned[id])){
            state.characters.owned[id] = 0;
          }
        });
        if(DEFAULT_CHARACTER_ID && (state.characters.owned[DEFAULT_CHARACTER_ID] || 0) <= 0){
          state.characters.owned[DEFAULT_CHARACTER_ID] = 1;
        }
        if(!state.characters.active || !CHARACTER_IDS.includes(state.characters.active) || (state.characters.owned[state.characters.active] || 0) <= 0){
          state.characters.active = DEFAULT_CHARACTER_ID || CHARACTER_IDS[0];
        }
        return state.characters;
      }

      function getActiveCharacterId(){
        const chars = ensureCharacterState();
        return chars.active || DEFAULT_CHARACTER_ID;
      }

      function getActiveCharacterDefinition(){
        const id = getActiveCharacterId();
        return id ? getCharacterDefinition(id) : null;
      }

      function getActiveCharacterBaseStats(){
        const def = getActiveCharacterDefinition();
        if(def && def.stats){
          return { ...def.stats };
        }
        return { atk: 0, def: 0, hp: 5000, critRate: 5, critDmg: 150, dodge: 5, speed: 100 };
      }

      function characterTierAtLeast(tier, minTier){
        const current = TIER_INDEX[tier];
        const required = TIER_INDEX[minTier];
        if(current === undefined || required === undefined) return false;
        return current <= required;
      }

      function randomCharacterIdForTier(tier, rng){
        const pool = (CHARACTER_IDS_BY_TIER[tier] || []).slice();
        if(pool.length === 0){
          return DEFAULT_CHARACTER_ID || CHARACTER_IDS[0];
        }
        const index = Math.floor(rng() * pool.length);
        return pool[Math.max(0, Math.min(pool.length - 1, index))];
      }

      function getCharacterSkillInfo(def){ if(!def) return null; return CHARACTER_SKILL_INFO[def.classId] || null; }
      function getCharacterSkillDescription(def){ const info = getCharacterSkillInfo(def); return info ? `${info.title}: ${info.summary}` : ''; }
      function getCharacterUltimateDefinition(def){
        if(!def) return null;
        const entries = CHARACTER_ULTIMATE_DATA[def.classId];
        if(!entries) return null;
        let matched = null;
        entries.forEach((entry) => {
          if(characterTierAtLeast(def.tier, entry.minTier)){
            matched = entry;
          }
        });
        if(!matched) return null;
        return {
          name: matched.name,
          variant: matched.variant,
          chance: PLAYER_ULTIMATE_DEFAULT_CHANCE,
          oncePerBattle: true
        };
      }
      function getCharacterUltimateInfo(ultimateDef){ if(!ultimateDef) return null; return CHARACTER_ULTIMATE_INFO[ultimateDef.variant] || null; }

      function formatUltimateChance(ultimateDef){ const chance = typeof ultimateDef?.chance === 'number' ? ultimateDef.chance : PLAYER_ULTIMATE_DEFAULT_CHANCE; const pct = (chance * 100).toFixed(1); return pct.endsWith('.0') ? `${pct.slice(0, -2)}%` : `${pct}%`; }

      function buildCharacterDetailContent(def){ if(!def){ return '<p class="muted">캐릭터를 선택하면 상세 정보를 확인할 수 있습니다.</p>'; }
        const characters = ensureCharacterState();
        const owned = characters.owned?.[def.id] || 0;
        const stats = def.stats || {};
        const balance = ensureCharacterBalanceConfig()[def.classId] || DEFAULT_CHARACTER_BALANCE[def.classId] || DEFAULT_CHARACTER_BALANCE.warrior;
        const statMultipliers = balance.stats || {};
        const statOffsets = balance.offsets || {};
        const showDetails = isAdmin();
        const skillInfo = getCharacterSkillInfo(def);
        const ultimateDef = getCharacterUltimateDefinition(def);
        const ultimateInfo = getCharacterUltimateInfo(ultimateDef);
        const statEntries = [
          { key:'hp', label:'HP', type:'flat' },
          { key:'atk', label:'공격력', type:'flat' },
          { key:'def', label:'방어력', type:'flat' },
          { key:'critRate', label:'치명타율', type:'percent' },
          { key:'critDmg', label:'치명타 피해', type:'percent' },
          { key:'dodge', label:'회피율', type:'percent' },
          { key:'speed', label:'속도', type:'flat' }
        ];
        const statHtml = statEntries.map(({ key, label, type }) => {
          const baseValue = stats[key] || 0;
          const multiplier = Number(statMultipliers[key] ?? 1);
          const offset = Number(statOffsets[key] ?? 0);
          const text = formatSnapshotCell(baseValue, multiplier, offset, type, showDetails);
          return `<span><span class="stat-label">${label}</span>${text}</span>`;
        }).join('');
        const ownedText = isAdmin() ? '∞' : formatNum(owned);
        const sections = [];
        sections.push(`
          <div class="detail-header">
            <div>
              <div class="detail-title" id="characterDetailTitle">${def.name || def.id}</div>
              <div class="detail-tier">${def.tier || '-'} · ${def.className || def.classId || ''}</div>
            </div>
            <div class="detail-owned muted">보유: <b>${ownedText}</b></div>
          </div>
        `);
        sections.push(`
          <div class="detail-section">
            <h4>기본 능력치</h4>
            <div class="stat-list">${statHtml}</div>
          </div>
        `);
        if(skillInfo){
          sections.push(`
            <div class="detail-section">
              <h4>직업 스킬 — ${skillInfo.title}</h4>
              <p>${skillInfo.summary}</p>
              ${skillInfo.detail ? `<p class="muted">${skillInfo.detail}</p>` : ''}
            </div>
          `);
        }
        if(ultimateDef){
          const chanceText = formatUltimateChance(ultimateDef);
          const ultimateSummary = ultimateInfo?.summary || '발동 시 강력한 필살기가 전개됩니다.';
          const ultimateDetail = ultimateInfo?.detail ? `<p class="muted">${ultimateInfo.detail}</p>` : '';
          const onceText = ultimateDef.oncePerBattle === false ? '' : ' · 전투당 1회';
          sections.push(`
            <div class="detail-section">
              <h4>필살기 — ${ultimateDef.name}</h4>
              <p>발동 확률 ${chanceText}${onceText}</p>
              <p>${ultimateSummary}</p>
              ${ultimateDetail}
            </div>
          `);
        }
        return sections.join('');
      }

      function openCharacterDetail(def){ if(!els.characterDetailModal || !els.characterDetailBody) return; const content = buildCharacterDetailContent(def); els.characterDetailBody.innerHTML = content; els.characterDetailBody.scrollTop = 0; els.characterDetailModal.hidden = false; requestAnimationFrame(()=>{ els.characterDetailModal.classList.add('show'); }); state.ui.characterDetailOpen = true; }

      function closeCharacterDetail(){ if(!els.characterDetailModal) return; els.characterDetailModal.classList.remove('show'); state.ui.characterDetailOpen = false; setTimeout(()=>{ if(!state.ui.characterDetailOpen && els.characterDetailModal) els.characterDetailModal.hidden = true; }, 200); }

      function selectCharacterDetail(characterId){ if(!CHARACTER_IDS.includes(characterId)) return; state.ui.selectedCharacterDetail = characterId; updateCharacterDetailSelection(); openCharacterDetail(getCharacterDefinition(characterId)); }

      function updateCharacterDetailSelection(){ if(!els.characterList) return; const selectedId = state.ui.selectedCharacterDetail || getActiveCharacterId(); const cards = els.characterList.querySelectorAll('.character-card'); cards.forEach((card) => { card.classList.toggle('selected', card.dataset.character === selectedId); }); if(state.ui.characterDetailOpen && els.characterDetailBody){ els.characterDetailBody.innerHTML = buildCharacterDetailContent(getCharacterDefinition(selectedId)); } }

      function clampCurrencyValue(value){ return clampNumber(value, 0, Number.MAX_SAFE_INTEGER, 0); }

      function loadWallet(){
        if(isAdmin()){
          state.wallet = Number.POSITIVE_INFINITY;
          updatePointsView();
          return;
        }
        const stored = (userProfile && typeof userProfile.wallet === 'number' && isFinite(userProfile.wallet)) ? userProfile.wallet : null;
        if(stored !== null){
          state.wallet = clampCurrencyValue(stored);
          userProfile.wallet = state.wallet;
          if(state.profile) state.profile.wallet = state.wallet;
        } else {
          state.wallet = 1000;
          saveWallet({ force: true, silent: true });
        }
        updatePointsView();
      }
      function saveWallet(opts){
        if(isAdmin()) return;
        if(!userProfile) return;
        const coerced = clampCurrencyValue(state.wallet);
        state.wallet = coerced;
        const prev = typeof userProfile.wallet === 'number' && isFinite(userProfile.wallet) ? userProfile.wallet : null;
        userProfile.wallet = coerced;
        if(state.profile) state.profile.wallet = coerced;
        if(opts?.force || prev !== coerced){
          markProfileDirty();
        }
        if(!opts || !opts.silent) updatePointsView();
      }
      function updatePointsView(){ if(els.points) els.points.textContent = isAdmin()? '∞' : formatNum(state.wallet||0); updateDrawButtons(); updateReviveButton(); }
      function updateDrawButtons(){ const running = !!state.inRun; const blocked = !!state.ui.rareAnimationBlocking; const mode = state.ui.gachaMode || 'gear'; const wallet = isAdmin() ? Number.POSITIVE_INFINITY : (state.wallet || 0); const petTickets = state.items.petTicket || 0; const enoughGear = isAdmin() || wallet >= 100; const enoughChar1 = isAdmin() || wallet >= CHARACTER_DRAW_COST; const enoughChar10 = isAdmin() || wallet >= CHARACTER_DRAW_COST * 10; if(els.draw1) els.draw1.disabled = mode !== 'gear' || running || blocked || !enoughGear; if(els.draw10) els.draw10.disabled = mode !== 'gear' || running || blocked || !enoughGear; if(els.draw100) els.draw100.disabled = mode !== 'gear' || running || blocked || !enoughGear; if(els.draw1k) els.draw1k.disabled = mode !== 'gear' || running || blocked || !enoughGear; if(els.draw10k) els.draw10k.disabled = mode !== 'gear' || running || blocked || !enoughGear; if(els.drawPet1) els.drawPet1.disabled = mode !== 'pet' || running || blocked || (!isAdmin() && petTickets < 1); if(els.drawPet10) els.drawPet10.disabled = mode !== 'pet' || running || blocked || (!isAdmin() && petTickets < 10); if(els.drawChar1) els.drawChar1.disabled = mode !== 'character' || running || blocked || !enoughChar1; if(els.drawChar10) els.drawChar10.disabled = mode !== 'character' || running || blocked || !enoughChar10; }
      function canSpend(amt){ if(isAdmin()) return true; return state.wallet >= amt; }
      function spendPoints(amt){ if(isAdmin()) return true; if(state.wallet < amt) return false; state.wallet -= amt; saveWallet(); return true; }
      function addPoints(amt){ if(isAdmin()) return; state.wallet += amt; saveWallet(); }

      function loadGold(){
        if(isAdmin()){
          state.gold = Number.POSITIVE_INFINITY;
          updateGoldView();
          return;
        }
        const stored = (userProfile && typeof userProfile.gold === 'number' && isFinite(userProfile.gold)) ? userProfile.gold : null;
        if(stored !== null){
          state.gold = clampCurrencyValue(stored);
          userProfile.gold = state.gold;
          if(state.profile) state.profile.gold = state.gold;
        } else {
          state.gold = 10000;
          saveGold({ force: true, silent: true });
        }
        updateGoldView();
      }
      function saveGold(opts){
        if(isAdmin()) return;
        if(!userProfile) return;
        const coerced = clampCurrencyValue(state.gold);
        state.gold = coerced;
        const prev = typeof userProfile.gold === 'number' && isFinite(userProfile.gold) ? userProfile.gold : null;
        userProfile.gold = coerced;
        if(state.profile) state.profile.gold = coerced;
        const hasExtraUpdates = !!(opts?.extraUpdates && Object.keys(opts.extraUpdates).length);
        if(hasExtraUpdates){
          queueProfileExtras(opts.extraUpdates);
        }
        if(opts?.force || prev !== coerced || hasExtraUpdates){
          markProfileDirty();
        }
        if(!opts || !opts.silent) updateGoldView();
      }
      function updateGoldView(){ if(els.gold){ if(isAdmin()){ els.gold.textContent = '∞'; } else { els.gold.textContent = formatNum(state.gold||0); } } updateShopButtons(); }
      function addGold(amount){ if(!(amount>0)) return; state.gold = (state.gold||0) + Math.floor(amount); saveGold(); }
      function spendGold(amount, opts){ amount = Math.floor(amount); if(!(amount>0)) return false; if((state.gold||0) < amount) return false; state.gold -= amount; if(opts?.deferSave) return true; saveGold(opts); return true; }

      function loadDiamonds(){
        if(isAdmin()){
          state.diamonds = Number.POSITIVE_INFINITY;
          updateDiamondsView();
          return;
        }
        const stored = (userProfile && typeof userProfile.diamonds === 'number' && isFinite(userProfile.diamonds)) ? userProfile.diamonds : null;
        if(stored !== null){
          state.diamonds = clampCurrencyValue(stored);
          userProfile.diamonds = state.diamonds;
          if(state.profile) state.profile.diamonds = state.diamonds;
        } else {
          state.diamonds = 0;
          saveDiamonds({ force: true, silent: true });
        }
        updateDiamondsView();
      }
      function saveDiamonds(opts){
        if(isAdmin()) return;
        if(!userProfile) return;
        const coerced = clampCurrencyValue(state.diamonds);
        state.diamonds = coerced;
        const prev = typeof userProfile.diamonds === 'number' && isFinite(userProfile.diamonds) ? userProfile.diamonds : null;
        userProfile.diamonds = coerced;
        if(state.profile) state.profile.diamonds = coerced;
        if(opts?.force || prev !== coerced){
          markProfileDirty();
        }
        if(!opts || !opts.silent) updateDiamondsView();
      }
      function updateDiamondsView(){ if(els.diamonds){ els.diamonds.textContent = isAdmin()? '∞' : formatNum(state.diamonds||0); } updateShopButtons(); }
      function addDiamonds(amount){ amount = Math.floor(amount); if(!amount || isNaN(amount)) return; if(isAdmin()) return; state.diamonds = Math.max(0, (state.diamonds || 0) + amount); saveDiamonds(); }
      function spendDiamonds(amount){ amount = Math.floor(amount); if(!(amount>0)) return false; if(isAdmin()) return true; if((state.diamonds||0) < amount) return false; state.diamonds -= amount; saveDiamonds(); return true; }

      function updateItemCountsView(){ const items = state.items || {}; const f = (value)=> formatNum(value || 0);
        setTextContent(els.petTicketCount, f(items.petTicket));
        setTextContent(els.petTicketInline, f(items.petTicket));
        setTextContent(els.holyWaterCount, f(items.holyWater));
        setTextContent(els.potionCount, f(items.potion));
        setTextContent(els.hyperPotionCount, f(items.hyperPotion));
        setTextContent(els.protectCount, f(items.protect));
        setTextContent(els.enhanceCount, f(items.enhance));
        setTextContent(els.battleResCount, f(items.battleRes));
        setTextContent(els.battleResRemain, f(items.battleRes));
        setTextContent(els.battleResInline, f(items.battleRes));
        setTextContent(els.invPotion, f(items.potion));
        setTextContent(els.invHyper, f(items.hyperPotion));
        setTextContent(els.invProtect, f(items.protect));
        setTextContent(els.invEnhance, f(items.enhance));
        setTextContent(els.invBattleRes, f(items.battleRes));
        setTextContent(els.invHolyWater, f(items.holyWater));
        setTextContent(els.reviveCount, f(items.revive));
      }

      function updateBattleResControls(){ if(!els.battleResUse) return; const admin = isAdmin(); const items = state.items || {}; const available = admin ? Number.POSITIVE_INFINITY : (items.battleRes || 0); const enabled = admin || (state.combat.useBattleRes && available > 0);
        els.battleResUse.checked = state.combat.useBattleRes && available > 0;
        if(els.battleResInline) els.battleResInline.textContent = formatNum(available);
        if(els.battleResCount) els.battleResCount.textContent = formatNum(available);
        els.battleResUse.disabled = !admin && available <= 0;
        if(els.battleResToggle) els.battleResToggle.classList.toggle('disabled', !enabled);
      }

      function shopPrice(type){ const prices = state.config.shopPrices || DEFAULT_SHOP_PRICES; const val = Object.prototype.hasOwnProperty.call(prices, type) ? prices[type] : DEFAULT_SHOP_PRICES[type]; return Math.max(0, Math.floor(val)); }
      function updateShopButtons(){ if(!els.shopPanel) return; if(els.pricePotion) els.pricePotion.textContent = formatNum(shopPrice('potion')); if(els.priceHyper) els.priceHyper.textContent = formatNum(shopPrice('hyperPotion')); if(els.priceProtect) els.priceProtect.textContent = formatNum(shopPrice('protect')); if(els.priceEnhance) els.priceEnhance.textContent = formatNum(shopPrice('enhance')); if(els.priceBattleRes) els.priceBattleRes.textContent = formatNum(shopPrice('battleRes')); if(els.priceHolyWater) els.priceHolyWater.textContent = formatNum(shopPrice('holyWater')); if(els.priceStarter) els.priceStarter.textContent = formatNum(shopPrice('starterPack'));
        const gold = state.gold===Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : (state.gold||0);
        const buttons = els.shopPanel.querySelectorAll('.shop-buy');
        buttons.forEach(function(btn){ const type = btn.dataset.item; if(!type) return; const cnt = parseInt(btn.dataset.count||'1',10) || 1; const cost = shopPrice(type) * cnt; btn.disabled = gold !== Number.POSITIVE_INFINITY && cost > gold; });
        const diamonds = state.diamonds === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : (state.diamonds || 0);
        const diamondButtons = els.shopPanel.querySelectorAll('.diamond-pack-buy');
        diamondButtons.forEach((btn)=>{ const packId = btn.dataset.pack || btn.closest('[data-pack-id]')?.dataset.packId; const pack = findDiamondPack(packId); if(!pack){ btn.disabled = true; return; } btn.disabled = diamonds !== Number.POSITIVE_INFINITY && pack.diamonds > diamonds; });
      }
      function setShopMessage(msg, status){ if(!els.shopMsg) return; els.shopMsg.textContent = msg || ''; els.shopMsg.classList.remove('ok','warn','error'); if(status){ els.shopMsg.classList.add(status); } }
      function renderDiamondShop(){ if(!els.diamondShopGrid) return; const grid = els.diamondShopGrid; grid.textContent = ''; const frag = document.createDocumentFragment(); DIAMOND_SHOP_PACKS.forEach((pack)=>{ const card = document.createElement('div'); card.className = 'diamond-pack'; card.dataset.packId = pack.id; card.innerHTML = `
          <div class="diamond-pack__title">${pack.label}</div>
          <div class="diamond-pack__cost">💎 ${formatNum(pack.diamonds)}</div>
          <div class="diamond-pack__reward">포인트 ${formatNum(pack.points)}</div>
          <div class="diamond-pack__reward">골드 ${formatNum(pack.gold)}</div>
          ${pack.bonus ? `<div class="diamond-pack__bonus">${pack.bonus}</div>` : ''}
          <button type="button" class="diamond-pack__buy diamond-pack-buy" data-pack="${pack.id}">구매</button>`; frag.appendChild(card); }); grid.appendChild(frag); if(els.diamondShop){ els.diamondShop.hidden = DIAMOND_SHOP_PACKS.length === 0; } updateShopButtons(); }
      function findDiamondPack(id){ return id ? (DIAMOND_PACK_LOOKUP[id] || null) : null; }
      function buyDiamondPack(packId){ const pack = findDiamondPack(packId); if(!pack){ setShopMessage('알 수 없는 다이아 상품입니다.', 'warn'); return; } if(!spendDiamonds(pack.diamonds)){ setShopMessage('다이아가 부족합니다.', 'error'); updateShopButtons(); return; } if(pack.points > 0){ addPoints(pack.points); }
        if(pack.gold > 0){ addGold(pack.gold); }
        setShopMessage(`💎 ${formatNum(pack.diamonds)} 다이아 사용! 포인트 ${formatNum(pack.points)}, 골드 ${formatNum(pack.gold)}를 획득했습니다.`, 'ok');
        updateShopButtons();
        markProfileDirty();
      }
      function onShopClick(e){ const target = e.target; if(!(target instanceof HTMLButtonElement)) return; if(target.classList.contains('diamond-pack-buy')){ const packId = target.dataset.pack || target.closest('[data-pack-id]')?.dataset.packId; if(packId){ buyDiamondPack(packId); } return; } if(!target.classList.contains('shop-buy')) return; const item = target.dataset.item; const count = parseInt(target.dataset.count||'1',10) || 1; if(item) buyShopItem(item, count); }
      function grantStarterPack(count){ count = Math.max(1, parseInt(count,10)||1); const rng = getRng(); for(let n=0;n<count;n++){ PART_DEFS.forEach(function(part){ const item = { id: state.itemSeq++, tier: 'B', part: part.key, base: rollStatFor('B', part.key, rng), lvl: 0, type: part.type }; applyEquipAndInventory(item); }); } updateInventoryView(); }
      function buyShopItem(type, count){
        count = Math.max(1, parseInt(count,10)||1);
        const totalCost = shopPrice(type) * count;
        if(state.gold !== Number.POSITIVE_INFINITY && (state.gold||0) < totalCost){ setShopMessage('골드가 부족합니다.', 'error'); return; }
        if(!spendGold(totalCost, { deferSave:true })){ setShopMessage('골드 차감에 실패했습니다.', 'error'); return; }
        switch(type){
          case 'potion':
            state.items.potion = (state.items.potion||0) + count;
            setShopMessage(`가속 물약 ${count}개를 구매했습니다.`, 'ok');
            break;
          case 'hyperPotion':
            state.items.hyperPotion = (state.items.hyperPotion||0) + count;
            setShopMessage(`초 가속 물약 ${count}개를 구매했습니다.`, 'ok');
            break;
          case 'protect':
            state.items.protect = (state.items.protect||0) + count;
            setShopMessage(`보호권 ${count}개를 구매했습니다.`, 'ok');
            break;
          case 'enhance':
            state.items.enhance = (state.items.enhance||0) + count;
            setShopMessage(`강화권 ${count}개를 구매했습니다.`, 'ok');
            break;
          case 'battleRes':
            state.items.battleRes = (state.items.battleRes||0) + count;
            setShopMessage(`전투부활권 ${count}개를 구매했습니다.`, 'ok');
            break;
          case 'holyWater':
            state.items.holyWater = (state.items.holyWater||0) + count;
            setShopMessage(`성수 ${count}개를 구매했습니다.`, 'ok');
            break;
          case 'starterPack':
            grantStarterPack(count);
            setShopMessage(`초보자 패키지를 구매했습니다! B 등급 장비 ${count*PART_KEYS.length}개를 획득했습니다.`, 'ok');
            markQuestCompleted('starterPackPurchase');
            break;
          default:
            setShopMessage('알 수 없는 아이템입니다.', 'warn');
            addGold(totalCost);
            return;
        }
        const itemsPayload = sanitizeItems(state.items);
        state.items = itemsPayload;
        if(userProfile){ userProfile.items = { ...itemsPayload }; }
        if(state.profile){ state.profile.items = { ...itemsPayload }; }
        if(!isAdmin()){
          saveGold({ extraUpdates: { items: itemsPayload } });
        }
        updateItemCountsView();
        markProfileDirty();
      }
      function canClaimRevive(){ if(isAdmin()) return false; if(totalKept() !== 0) return false; if((state.wallet||0) > 100) return false; return true; }
      function updateReviveButton(){ if(!els.claimRevive) return; const show = canClaimRevive(); els.claimRevive.style.display = show ? '' : 'none'; els.claimRevive.disabled = !show; }
      function claimRevive(){ if(!canClaimRevive()){ alert('부활권을 받을 조건이 아닙니다. (장비 0개, 포인트 100 이하 필요)'); return; } state.items.revive = (state.items.revive||0) + 1; addPoints(1000); updateItemCountsView(); updateReviveButton(); markProfileDirty(); alert('부활권을 획득하고 1,000 포인트를 받았습니다!'); }

      // Quest helpers
      let questToastTimer = null;

      function ensureQuestState(){
        state.quests = sanitizeQuestState(state.quests);
        return state.quests;
      }

      function ensureQuestStatus(questId){
        const quests = ensureQuestState();
        if(!quests.statuses[questId]){
          quests.statuses[questId] = {
            completed: false,
            rewardGranted: false,
            completedAt: null,
            rewardAt: null
          };
        }
        return quests.statuses[questId];
      }

      function showQuestToast(message){
        if(!els.questToast || !message) return;
        els.questToast.textContent = message;
        els.questToast.classList.add('show');
        if(questToastTimer){
          clearTimeout(questToastTimer);
        }
        questToastTimer = setTimeout(()=>{
          if(els.questToast){
            els.questToast.classList.remove('show');
          }
          questToastTimer = null;
        }, 3200);
      }

      function refreshQuestBadge(){
        if(!els.questBadge) return;
        const quests = ensureQuestState();
        let readyToClaim = 0;
        QUEST_DEFINITIONS.forEach((quest)=>{
          const status = quests.statuses[quest.id];
          if(status && status.completed && !status.rewardGranted){
            readyToClaim++;
          }
        });
        if(readyToClaim > 0){
          els.questBadge.textContent = String(readyToClaim);
          els.questBadge.hidden = false;
        } else {
          els.questBadge.hidden = true;
        }
      }

      function renderQuestItem(quest, status){
        const container = document.createElement('div');
        container.className = 'quest-item';
        container.setAttribute('role', 'listitem');

        const header = document.createElement('div');
        header.className = 'quest-item__header';
        const title = document.createElement('div');
        title.className = 'quest-item__title';
        title.textContent = quest.title;
        const badge = document.createElement('span');
        badge.className = 'quest-item__status';
        if(status.rewardGranted){
          badge.textContent = '완료';
          badge.dataset.status = 'done';
        } else if(status.completed){
          badge.textContent = '보상 지급 대기';
          badge.dataset.status = 'pending';
        } else {
          badge.textContent = '진행 중';
          badge.dataset.status = 'active';
        }
        header.appendChild(title);
        header.appendChild(badge);

        const desc = document.createElement('p');
        desc.className = 'quest-item__desc';
        desc.textContent = quest.description;

        const reward = document.createElement('div');
        reward.className = 'quest-item__reward';
        reward.textContent = `보상: ${quest.rewardLabel || questRewardSummary(quest)}`;

        const actions = document.createElement('div');
        actions.className = 'quest-item__actions';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quest-claim';
        button.dataset.questId = quest.id;
        if(status.rewardGranted){
          button.textContent = '보상 수령 완료';
          button.disabled = true;
        } else if(status.completed){
          button.textContent = '보상 받기';
          button.disabled = false;
        } else {
          button.textContent = '미완료';
          button.disabled = true;
        }
        actions.appendChild(button);

        container.appendChild(header);
        container.appendChild(desc);
        container.appendChild(reward);
        container.appendChild(actions);
        return container;
      }

      function refreshQuestView(){
        refreshQuestBadge();
        if(!els.questList) return;
        const quests = ensureQuestState();
        els.questList.innerHTML='';
        let pendingClaims = 0;
        QUEST_DEFINITIONS.forEach((quest)=>{
          const status = ensureQuestStatus(quest.id);
          const node = renderQuestItem(quest, status);
          els.questList.appendChild(node);
          if(status.completed && !status.rewardGranted){ pendingClaims++; }
        });
        if(els.questEmpty){
          els.questEmpty.hidden = pendingClaims !== 0;
        }
      }

      function commitQuestState(options){
        const sanitized = sanitizeQuestState(state.quests);
        state.quests = sanitized;
        if(userProfile){ userProfile.quests = sanitized; }
        if(state.profile){ state.profile.quests = sanitized; }
        if(options?.skipDirty !== true){
          markProfileDirty();
        }
        if(options?.refreshList === false){
          refreshQuestBadge();
        } else {
          refreshQuestView();
        }
      }

      async function grantQuestReward(quest){
        if(!quest) return null;
        if(isAdmin()) return null;
        if(quest.delivery === 'mail'){
          const uid = currentFirebaseUser?.uid;
          if(!uid){
            throw new Error('사용자 정보가 없습니다.');
          }
          const mailPayload = {
            title: quest.mail?.title || `퀘스트 보상 — ${quest.title}`,
            message: quest.mail?.message || `${quest.title} 퀘스트 달성 보상입니다.`,
            rewards: (quest.mail && quest.mail.rewards) ? quest.mail.rewards : (quest.rewards || {})
          };
          await enqueueMail(uid, mailPayload);
          return questRewardSummary(quest);
        }
        const rewards = quest.rewards || {};
        if(rewards.points){ addPoints(rewards.points); }
        if(rewards.gold){ addGold(rewards.gold); }
        if(rewards.diamonds){ addDiamonds(rewards.diamonds); }
        return questRewardSummary(quest);
      }

      function markQuestCompleted(questId, options){
        if(isAdmin()) return;
        const quest = QUEST_LOOKUP[questId];
        if(!quest) return;
        const status = ensureQuestStatus(questId);
        if(status.completed){
          return;
        }
        status.completed = true;
        status.completedAt = Date.now();
        commitQuestState({});
        if(options?.notify !== false){
          showQuestToast(`${quest.title} 완료! 퀘스트 창에서 보상을 받아가세요.`);
        }
      }

      async function claimQuestReward(questId){
        if(isAdmin()) return false;
        const quest = QUEST_LOOKUP[questId];
        if(!quest) return false;
        const status = ensureQuestStatus(questId);
        if(!status.completed){ showQuestToast('먼저 퀘스트 조건을 달성하세요.'); return false; }
        if(status.rewardGranted){ showQuestToast('이미 보상을 수령했습니다.'); return false; }
        try {
          const summary = await grantQuestReward(quest);
          status.rewardGranted = true;
          status.rewardAt = Date.now();
          commitQuestState({});
          const message = summary ? `${quest.title} 보상 지급! ${summary}` : `${quest.title} 보상을 받았습니다!`;
          showQuestToast(message);
          return true;
        } catch (error) {
          console.error('퀘스트 보상 지급 실패', error);
          showQuestToast('퀘스트 보상 지급에 실패했습니다. 잠시 후 다시 시도해주세요.');
          return false;
        }
      }

      function openQuestModal(opts){ if(!els.questOverlay || !els.questPanel) return; refreshQuestView(); els.questOverlay.hidden = false; requestAnimationFrame(()=>{ els.questOverlay.classList.add('open'); }); document.body.classList.add('modal-open'); state.ui.questOpen = true; if(!opts || !opts.silent){ const quests = ensureQuestState(); if(!quests.seenIntro){ quests.seenIntro = true; commitQuestState({ refreshList: false }); } } }

      function closeQuestModal(){ if(!els.questOverlay) return; state.ui.questOpen = false; els.questOverlay.classList.remove('open'); setTimeout(()=>{ if(!state.ui.questOpen && els.questOverlay){ els.questOverlay.hidden = true; } }, 180); if(!isLegendaryVisible() && !state.ui.characterDetailOpen && !state.ui.userOptionsOpen){ document.body.classList.remove('modal-open'); } }

      function recoverPendingQuestRewards(){ if(isAdmin()) return; const quests = ensureQuestState(); let changed = false; QUEST_DEFINITIONS.forEach((quest)=>{ const status = ensureQuestStatus(quest.id); if(status.completed && !status.completedAt){ status.completedAt = Date.now(); changed = true; } }); if(changed){ commitQuestState({ refreshList: false }); refreshQuestBadge(); } else { refreshQuestBadge(); } }

      function maybeShowQuestIntro(){ if(isAdmin()) return; const quests = ensureQuestState(); if(quests.seenIntro || !els.questOverlay){ return; } openQuestModal({ silent: true }); showQuestToast('새로운 퀘스트가 준비되었습니다!'); setTimeout(()=>{ closeQuestModal(); }, 2200); quests.seenIntro = true; commitQuestState({ refreshList: false }); }


      // CSV export
      async function exportCsv(){ const rows = [['draw_id','tier','part','stat','run_id','timestamp','config_hash']]; for(const h of state.session.history){ const partName = getPartNameByKey(h.part) || ''; rows.push([h.id, h.tier, partName, h.stat||0, h.runId, new Date(h.ts).toISOString(), h.cfgHash]); } const csv = rows.map(function(r){ return r.map(function(v){ return String(v); }).join(','); }).join('\n'); const blob = new Blob([csv], {type:'text/csv'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gacha_session.csv'; a.click(); URL.revokeObjectURL(a.href); }

      // Global persistence
      function defaultGlobalStats(){ return {draws:0, counts:Object.fromEntries(TIERS.map(function(t){ return [t,0]; }))}; }
      function loadGlobal(){ const raw = userProfile?.globalStats; if(!raw || typeof raw !== 'object'){ return defaultGlobalStats(); }
        const stats = defaultGlobalStats();
        if(typeof raw.draws === 'number') stats.draws = raw.draws;
        if(raw.counts && typeof raw.counts === 'object'){
          for(const tier of TIERS){ if(typeof raw.counts[tier] === 'number') stats.counts[tier] = raw.counts[tier]; }
        }
        return stats;
      }
      function saveGlobal(){ if(!userProfile) return; userProfile.globalStats = state.global; markProfileDirty(); }

      // Init
      function reflectConfig(){ setInputValue(els.seed, state.config.seed||''); setCheckboxState(els.lock, state.config.locked); setCheckboxState(els.pityEnabled, !!(state.config.pity && state.config.pity.enabled)); setInputValue(els.pityFloor, (state.config.pity && state.config.pity.floorTier) || 'S'); setInputValue(els.pitySpan, (state.config.pity && state.config.pity.span) || 90); setCheckboxState(els.g10Enabled, !!(state.config.minGuarantee10 && state.config.minGuarantee10.enabled)); setInputValue(els.g10Tier, (state.config.minGuarantee10 && state.config.minGuarantee10.tier) || 'A');
        state.petGachaWeights = sanitizePetWeights(state.config.petWeights);
        state.config.petWeights = { ...state.petGachaWeights };
        updatePetWeightInputs();
        renderPetStats();
        state.config.characterWeights = sanitizeWeights(state.config.characterWeights);
        state.config.characterProbs = normalize(state.config.characterWeights);
        updateCharacterWeightsInputs();
        var dr = state.config.dropRates || DEFAULT_DROP_RATES;
        function setDropInputs(prefix, cfg, defaults){ if(!cfg) cfg = defaults; if(!defaults) defaults = {base:0, perLevel:0, max:1};
          if(els[prefix+'Base']) els[prefix+'Base'].value = (cfg.base ?? defaults.base);
          if(els[prefix+'Per']) els[prefix+'Per'].value = (cfg.perLevel ?? defaults.perLevel);
          if(els[prefix+'Max']) els[prefix+'Max'].value = (cfg.max ?? defaults.max);
        }
        setDropInputs('dropPotion', dr.potion, DEFAULT_DROP_RATES.potion);
        setDropInputs('dropHyper', dr.hyperPotion, DEFAULT_DROP_RATES.hyperPotion);
        setDropInputs('dropProtect', dr.protect, DEFAULT_DROP_RATES.protect);
        setDropInputs('dropEnhance', dr.enhance, DEFAULT_DROP_RATES.enhance);
        setDropInputs('dropBattleRes', dr.battleRes, DEFAULT_DROP_RATES.battleRes);
        var goldCfg = normalizeGoldScaling(state.config.goldScaling);
        if(els.goldMinLow) els.goldMinLow.value = goldCfg.minLow;
        if(els.goldMaxLow) els.goldMaxLow.value = goldCfg.maxLow;
        if(els.goldMinHigh) els.goldMinHigh.value = goldCfg.minHigh;
        if(els.goldMaxHigh) els.goldMaxHigh.value = goldCfg.maxHigh;
        var sp = state.config.shopPrices || DEFAULT_SHOP_PRICES;
        if(els.priceInputPotion) els.priceInputPotion.value = sp.potion ?? DEFAULT_SHOP_PRICES.potion;
        if(els.priceInputHyper) els.priceInputHyper.value = sp.hyperPotion ?? DEFAULT_SHOP_PRICES.hyperPotion;
        if(els.priceInputProtect) els.priceInputProtect.value = sp.protect ?? DEFAULT_SHOP_PRICES.protect;
        if(els.priceInputEnhance) els.priceInputEnhance.value = sp.enhance ?? DEFAULT_SHOP_PRICES.enhance;
        if(els.priceInputBattleRes) els.priceInputBattleRes.value = sp.battleRes ?? DEFAULT_SHOP_PRICES.battleRes;
        if(els.priceInputStarter) els.priceInputStarter.value = sp.starterPack ?? DEFAULT_SHOP_PRICES.starterPack;
        const potCfg = normalizePotionSettings(state.config.potionSettings, DEFAULT_POTION_SETTINGS);
        const hyperCfg = normalizePotionSettings(state.config.hyperPotionSettings, DEFAULT_HYPER_POTION_SETTINGS);
        if(els.potionDuration) els.potionDuration.value = (potCfg.durationMs/1000);
        if(els.potionManualCd) els.potionManualCd.value = (potCfg.manualCdMs/1000);
        if(els.potionAutoCd) els.potionAutoCd.value = (potCfg.autoCdMs/1000);
        if(els.potionSpeedMult) els.potionSpeedMult.value = potCfg.speedMultiplier ?? DEFAULT_POTION_SETTINGS.speedMultiplier ?? 2;
        if(els.hyperDuration) els.hyperDuration.value = (hyperCfg.durationMs/1000);
        if(els.hyperManualCd) els.hyperManualCd.value = (hyperCfg.manualCdMs/1000);
        if(els.hyperAutoCd) els.hyperAutoCd.value = (hyperCfg.autoCdMs/1000);
        if(els.hyperSpeedMult) els.hyperSpeedMult.value = hyperCfg.speedMultiplier ?? DEFAULT_HYPER_POTION_SETTINGS.speedMultiplier ?? 4;
        const monsterCfg = normalizeMonsterScaling(state.config.monsterScaling);
        if(els.monsterBasePower) els.monsterBasePower.value = monsterCfg.basePower;
        if(els.monsterMaxPower) els.monsterMaxPower.value = monsterCfg.maxPower;
        if(els.monsterCurve) els.monsterCurve.value = monsterCfg.curve;
        if(els.monsterDifficultyInput) els.monsterDifficultyInput.value = formatMultiplier(monsterCfg.difficultyMultiplier ?? 1);
        updateWeightsInputs();
        updateCharacterBalanceInputs();
        toggleConfigDisabled();
        updateCombatView(); updateInventoryView(); updateShopButtons(); setShopMessage('', null); updateGachaModeView(); }
      function updateViewMode(){ const admin = isAdmin(); if(els.whoami){ els.whoami.textContent = state.user? `${state.user.username} (${admin? '관리자':'회원'})` : ''; }
        if(els.adminPanel){ els.adminPanel.style.display = (admin && state.ui.adminView) ? '' : 'none'; if(!admin){ state.ui.adminView = false; } }
        const configPanel = document.querySelector('#configPanel'); if(configPanel){ configPanel.style.opacity = admin? '1' : '0.92'; }
        if(els.toAdmin){ els.toAdmin.disabled = !admin; }
        document.querySelectorAll('.preset-user-row').forEach(function(node){ node.style.display = admin ? 'none' : ''; });
        if(admin){ state.ui.userEditEnabled = true; }
        updateUserEditModeView();
        toggleConfigDisabled();
        updateShopButtons();
        updatePetWeightInputs();
        updateGachaModeView();
      }

      function isUserOptionsOpen(){ return !!state.ui.userOptionsOpen; }

      function syncUserOptionsInputs(){
        if(!els.userOptionsCharacterGif || !els.userOptionsPetGif) return;
        const effects = state.settings?.effects || {};
        els.userOptionsCharacterGif.checked = effects.characterUltimateGif !== false;
        els.userOptionsPetGif.checked = effects.petUltimateGif !== false;
      }

      function openUserOptionsModal(){
        if(!els.userOptionsModal) return;
        syncUserOptionsInputs();
        state.ui.userOptionsOpen = true;
        els.userOptionsModal.hidden = false;
        requestAnimationFrame(()=> els.userOptionsModal.classList.add('show'));
        document.body.classList.add('modal-open');
      }

      function closeUserOptionsModal(options){
        if(!els.userOptionsModal) return;
        state.ui.userOptionsOpen = false;
        els.userOptionsModal.classList.remove('show');
        const delay = options && options.immediate ? 0 : 180;
        setTimeout(()=>{
          if(!state.ui.userOptionsOpen){ els.userOptionsModal.hidden = true; }
        }, delay);
        if(!isLegendaryVisible() && !state.ui.characterDetailOpen){ document.body.classList.remove('modal-open'); }
      }

      function saveUserOptions(){
        if(!els.userOptionsCharacterGif || !els.userOptionsPetGif) return;
        const next = sanitizeUserSettings({
          effects: {
            characterUltimateGif: !!els.userOptionsCharacterGif.checked,
            petUltimateGif: !!els.userOptionsPetGif.checked
          }
        });
        const current = state.settings || sanitizeUserSettings(null);
        const changed = current.effects.characterUltimateGif !== next.effects.characterUltimateGif
          || current.effects.petUltimateGif !== next.effects.petUltimateGif;
        if(changed){
          state.settings = next;
          if(userProfile){ userProfile.settings = next; }
          markProfileDirty();
        }
        closeUserOptionsModal();
      }
      function hydrateSession(){ loadWallet(); loadGold(); loadDiamonds(); startUiTimer(); updateItemCountsView(); updateBuffInfo(); updateReviveButton(); updateShopButtons(); setShopMessage('', null); updatePetList(); updateGachaModeView(); updateViewMode(); }

      async function loadOrInitializeProfile(firebaseUser){
        if(!firebaseUser) return null;
        const uid = firebaseUser.uid;
        const profileRef = ref(db, `users/${uid}`);
        const fallbackBase = `user-${uid.slice(0, 6)}`;
        let fallbackName = deriveUsernameFromUser(firebaseUser) || fallbackBase;
        fallbackName = sanitizeUsername(fallbackName, fallbackBase) || fallbackBase;
        let snapshot;
        try {
          snapshot = await get(profileRef);
        } catch (error) {
          console.error('프로필을 불러오지 못했습니다.', error);
          throw error;
        }
        if(!snapshot.exists()){
          const missingError = new Error('Profile not found');
          missingError.code = 'PROFILE_NOT_FOUND';
          throw missingError;
        }
        let data = snapshot.val() || {};
        {
          const updates = {};
          if(!data.username){
            data.username = fallbackName;
            updates.username = fallbackName;
          }
          if(!data.role){
            data.role = (data.username === 'admin') ? 'admin' : 'user';
            updates.role = data.role;
          }
          if(data.role !== 'admin' && (typeof data.gold !== 'number' || !isFinite(data.gold))){
            data.gold = 10000;
            updates.gold = 10000;
          }
          if(Object.keys(updates).length){
            updates.updatedAt = Date.now();
            try {
              await update(profileRef, updates);
            } catch (error) {
              console.error('프로필 보정 중 오류가 발생했습니다.', error);
            }
          }
        }
        return data;
      }

      async function applyProfileState(){
        if(!currentFirebaseUser || !userProfile) return;
        detachGlobalConfigListener();
        resetRareAnimationState({ immediate: true });
        const uid = currentFirebaseUser.uid;
        const fallbackBase = `user-${uid.slice(0, 6)}`;
        const derivedName = sanitizeUsername(userProfile.username, deriveUsernameFromUser(currentFirebaseUser) || fallbackBase) || fallbackBase;
        userProfile.username = derivedName;
        const role = userProfile.role === 'admin' || derivedName === 'admin' ? 'admin' : 'user';
        userProfile.role = role;
        document.body.dataset.role = role;
        if(role === 'admin'){
          userProfile.wallet = null;
          userProfile.gold = null;
        } else {
          userProfile.wallet = clampNumber(userProfile.wallet, 0, Number.MAX_SAFE_INTEGER, 1000);
          userProfile.gold = clampNumber(userProfile.gold, 0, Number.MAX_SAFE_INTEGER, 10000);
        }

        state.user = {
          uid,
          username: userProfile.username,
          role,
          email: currentFirebaseUser.email || ''
        };
        state.profile = userProfile;

        const questState = sanitizeQuestState(userProfile.quests);
        state.quests = questState;
        userProfile.quests = questState;
        if(state.profile){ state.profile.quests = questState; }

        attachProfileListener(uid);

        const configFromProfile = sanitizeConfig(userProfile.config);
        const globalData = await fetchGlobalConfig();
        if(globalData){
          state.presets.activeGlobalId = globalData.activePresetId || null;
          state.presets.activeGlobalName = globalData.activePresetName || null;
        } else {
          state.presets.activeGlobalId = null;
          state.presets.activeGlobalName = null;
        }

        const globalConfig = globalData ? sanitizeConfig(globalData.config) : null;
        const globalEnhance = globalData && globalData.enhance ? sanitizeEnhanceConfig(globalData.enhance) : null;

        if(role === 'admin'){
          if(globalConfig){
            state.config = globalConfig;
          } else {
            state.config = configFromProfile;
            await persistGlobalConfig(state.config, { activePresetId: state.presets.activeGlobalId, activePresetName: state.presets.activeGlobalName });
          }
        } else {
          state.config = globalConfig ? globalConfig : configFromProfile;
        }
        if(globalEnhance){
          state.enhance = globalEnhance;
        } else {
          state.enhance = defaultEnhance();
          if(role === 'admin'){
            await persistGlobalConfig(state.config, { activePresetId: state.presets.activeGlobalId, activePresetName: state.presets.activeGlobalName });
          }
        }
        if(userProfile.enhance){
          delete userProfile.enhance;
        }
        buildForgeTable();
        updateForgeInfo();
        const profilePetWeights = sanitizePetWeights(userProfile.petGachaWeights);
        const configPetWeights = sanitizePetWeights(state.config.petWeights);
        const configHasCustom = PET_IDS.some((id) => configPetWeights[id] !== 1);
        const profileHasCustom = PET_IDS.some((id) => profilePetWeights[id] !== 1);
        const finalPetWeights = configHasCustom ? configPetWeights : (profileHasCustom ? profilePetWeights : configPetWeights);

        state.petGachaWeights = finalPetWeights;
        state.config.petWeights = { ...finalPetWeights };
        userProfile.petGachaWeights = finalPetWeights;
        userProfile.config = state.config;

        state.global = sanitizeGlobalStats(userProfile.globalStats);
        userProfile.globalStats = state.global;

        state.items = sanitizeItems(userProfile.items);
        userProfile.items = state.items;
        state.pets = sanitizePetState(userProfile.pets);
        userProfile.pets = state.pets;
        state.characters = sanitizeCharacterState(userProfile.characters);
        userProfile.characters = state.characters;
        ensureCharacterState();

        state.characterStats = sanitizeCharacterDrawStats(userProfile.characterStats);
        userProfile.characterStats = state.characterStats;

        state.settings = sanitizeUserSettings(userProfile.settings);
        userProfile.settings = state.settings;

        state.equip = sanitizeEquipMap(userProfile.equip);
        userProfile.equip = state.equip;

        state.spares = sanitizeEquipMap(userProfile.spares);
        userProfile.spares = state.spares;

        state.session = sanitizeSession(userProfile.session);
        if(!Array.isArray(state.session.history)){
          state.session.history = [];
        }
        userProfile.session = state.session;

        state.pitySince = clampNumber(userProfile.pitySince, 0, Number.MAX_SAFE_INTEGER, 0);
        userProfile.pitySince = state.pitySince;

        if(userProfile.combat && typeof userProfile.combat === 'object'){
          state.combat.useBattleRes = !!userProfile.combat.useBattleRes;
          state.combat.prefBattleRes = userProfile.combat.prefBattleRes !== false;
        } else {
          state.combat.useBattleRes = true;
          state.combat.prefBattleRes = true;
        }
        userProfile.combat = { useBattleRes: state.combat.useBattleRes, prefBattleRes: state.combat.prefBattleRes };

        if(userProfile.forge && typeof userProfile.forge === 'object'){
          state.forge.protectEnabled = !!userProfile.forge.protectEnabled;
        } else {
          state.forge.protectEnabled = false;
        }
        state.forge.autoRunning = false;
        userProfile.forge = { protectEnabled: state.forge.protectEnabled };
        setAutoForgeRunning(false);

        if(role === 'admin'){
          state.diamonds = Number.POSITIVE_INFINITY;
        } else {
          state.diamonds = clampNumber(userProfile.diamonds, 0, Number.MAX_SAFE_INTEGER, 0);
          userProfile.diamonds = state.diamonds;
        }
        updateDiamondsView();

        state.presets.personal = sanitizeUserPresets(userProfile.presets);
        userProfile.presets = personalPresetsToMap(state.presets.personal);
        state.selectedPreset = sanitizeSelectedPreset(userProfile.selectedPreset);
        if(!state.selectedPreset.scope || !state.selectedPreset.id){ state.selectedPreset = { scope:null, id:null }; userProfile.selectedPreset = null; }

        await loadGlobalPresets();
        if(role === 'admin'){
          await loadAdminUsers();
        } else {
          state.adminUsers = [];
          populateAdminUserSelect();
        }
        applySelectedPresetIfAvailable(role === 'admin');
        refreshPresetSelectors();

        attachGlobalConfigListener();

        refreshInventoryCache();
        const equipIds = PART_KEYS.map(k=> (state.equip[k]?.id)||0);
        const spareIds = PART_KEYS.map(k=> (state.spares[k]?.id)||0);
        const maxId = Math.max(0, ...equipIds, ...spareIds);
        state.itemSeq = Math.max(state.itemSeq, maxId + 1);
        if(!userProfile.createdAt){ userProfile.createdAt = Date.now(); }
        if(!userProfile.updatedAt){ userProfile.updatedAt = Date.now(); }
      }

      function hydrateSessionFromProfile(){
        hydrateSession();
        reflectConfig();
        updateWeightsInputs();
        updateInventoryView();
        updateCharacterList();
        buildForgeTargetOptions();
        updateForgeControlsView();
        updateForgeInfo();
        updateBattleResControls();
        syncStats();
        drawChart();
        renderCharacterStats();
        syncUserOptionsInputs();
        refreshQuestView();
        recoverPendingQuestRewards();
        maybeShowQuestIntro();
      }

      function buildProfilePayload(extra){
        if(!state.user){
          return null;
        }
        const role = state.user.role === 'admin' ? 'admin' : 'user';
        const payload = {
          username: state.user.username,
          role,
          config: sanitizeConfig(state.config),
          globalStats: sanitizeGlobalStats(state.global),
          equip: sanitizeEquipMap(state.equip),
          spares: sanitizeEquipMap(state.spares),
          items: sanitizeItems(state.items),
          pets: sanitizePetState(state.pets),
          characters: sanitizeCharacterState(state.characters),
          quests: sanitizeQuestState(state.quests),
          characterStats: sanitizeCharacterDrawStats(state.characterStats),
          settings: sanitizeUserSettings(state.settings),
          petGachaWeights: sanitizePetWeights(state.petGachaWeights),
          session: (()=>{
            const snapshot = sanitizeSession(state.session);
            snapshot.history = Array.isArray(state.session?.history)
              ? state.session.history.slice(-200)
              : [];
            return snapshot;
          })(),
          pitySince: clampNumber(state.pitySince, 0, Number.MAX_SAFE_INTEGER, 0),
          combat: {
            useBattleRes: !!state.combat.useBattleRes,
            prefBattleRes: state.combat.prefBattleRes !== false
          },
          forge: {
            protectEnabled: !!state.forge.protectEnabled
          },
          enhance: null,
          createdAt: userProfile?.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        if(extra && typeof extra === 'object'){ mergePlainObjects(payload, extra); }

        if(role !== 'admin'){
          payload.wallet = clampNumber(state.wallet, 0, Number.MAX_SAFE_INTEGER, 0);
          payload.gold = clampNumber(state.gold, 0, Number.MAX_SAFE_INTEGER, 0);
          payload.diamonds = clampNumber(state.diamonds, 0, Number.MAX_SAFE_INTEGER, 0);
          payload.presets = personalPresetsToMap(state.presets.personal);
          payload.selectedPreset = state.selectedPreset && state.selectedPreset.scope ? { scope: state.selectedPreset.scope, id: state.selectedPreset.id } : null;
        } else {
          payload.wallet = null;
          payload.gold = null;
          payload.diamonds = null;
          payload.presets = null;
          payload.selectedPreset = null;
        }
        return payload;
      }

      function markProfileDirty(){
        if(!currentFirebaseUser || !userProfile) return;
        if(profileSaveTimer){
          clearTimeout(profileSaveTimer);
        }
        profileSaveTimer = setTimeout(()=>{
          profileSaveTimer = null;
          saveProfileSnapshot().catch((error)=>{
            console.error('프로필 저장 중 오류가 발생했습니다.', error);
          });
        }, PROFILE_SAVE_DELAY);
      }

      async function saveProfileSnapshot(){
        if(!currentFirebaseUser || !userProfile) return;
        const extraSnapshot = collectPendingProfileExtras();
        const payload = buildProfilePayload(extraSnapshot);
        if(!payload) return;
        if(profileSaveTimer){
          clearTimeout(profileSaveTimer);
          profileSaveTimer = null;
        }
        const uid = currentFirebaseUser.uid;
        const profileRef = ref(db, `users/${uid}`);
        let attempt = 0;
        while(true){
          try {
            await update(profileRef, payload);
            if(typeof payload.username === 'string'){ userProfile.username = payload.username; }
            userProfile.role = payload.role;
            if(Object.prototype.hasOwnProperty.call(payload, 'wallet')){ userProfile.wallet = payload.wallet; }
            if(Object.prototype.hasOwnProperty.call(payload, 'gold')){ userProfile.gold = payload.gold; }
            if(Object.prototype.hasOwnProperty.call(payload, 'diamonds')){ userProfile.diamonds = payload.diamonds; }
            userProfile.pitySince = payload.pitySince;
            userProfile.updatedAt = payload.updatedAt;
            if(payload.createdAt && !userProfile.createdAt){ userProfile.createdAt = payload.createdAt; }
            userProfile.config = state.config;
            userProfile.globalStats = state.global;
            userProfile.items = payload.items || state.items;
            userProfile.pets = state.pets;
            userProfile.characters = state.characters;
            userProfile.characterStats = state.characterStats;
            userProfile.settings = state.settings;
            userProfile.petGachaWeights = state.petGachaWeights;
            if('enhance' in userProfile){ delete userProfile.enhance; }
            userProfile.equip = state.equip;
            userProfile.spares = state.spares;
            userProfile.session = state.session;
            userProfile.combat = { useBattleRes: state.combat.useBattleRes, prefBattleRes: state.combat.prefBattleRes };
            userProfile.forge = { protectEnabled: state.forge.protectEnabled };
            recordProfileSaveSuccess();
            if(isAdmin()){
              await persistGlobalConfig(state.config, { activePresetId: state.presets.activeGlobalId, activePresetName: state.presets.activeGlobalName });
            }
            return;
          } catch (error) {
            console.error(`프로필 저장 실패 (시도 ${attempt + 1})`, error);
            const delay = PROFILE_SAVE_RETRY_DELAYS[attempt];
            if(delay === undefined){
              if(extraSnapshot){
                state.pendingProfileExtras = mergePlainObjects(state.pendingProfileExtras || {}, extraSnapshot);
              }
              const stats = state.profileSaveStats || (state.profileSaveStats = { recent: [], lastWarnAt: 0, lastErrorAt: 0 });
              stats.lastErrorAt = Date.now();
              if(typeof setShopMessage === 'function'){
                setShopMessage('프로필 저장에 실패했습니다. 잠시 후 다시 시도합니다.', 'warn');
              }
              markProfileDirty();
              return;
            }
            await sleep(delay);
            attempt += 1;
          }
        }
      }

      function isAdmin(){ return !!(state.user && state.user.role === 'admin'); }
      async function hash(s){ return sha256Hex(s); }
      async function logout(){
        try {
          if(profileSaveTimer){
            clearTimeout(profileSaveTimer);
            profileSaveTimer = null;
          }
          detachProfileListener();
          await saveProfileSnapshot();
          await signOut(auth);
        } catch (error) {
          console.error('로그아웃 중 오류가 발생했습니다.', error);
        } finally {
          state.user = null;
          try { localStorage.removeItem('gachaCurrentUser_v1'); } catch(e){}
          document.body.removeAttribute('data-role');
          setAutoForgeRunning(false);
          stopAutoTimer();
          stopUiTimer();
          setShopMessage('', null);
          window.location.href = 'login.html';
        }
      }
      async function changeAdminPassword(){ if(!isAdmin()) { setAdminMsg('관리자만 변경할 수 있습니다.', 'warn'); return; }
        const user = auth.currentUser;
        if(!user){ setAdminMsg('인증 정보를 확인할 수 없습니다. 다시 로그인해주세요.', 'warn'); return; }
        const oldPassword = els.adminOldPass.value || '';
        const newPassword = els.adminNewPass.value || '';
        if(newPassword.length < 6){ setAdminMsg('새 비밀번호는 6자 이상이어야 합니다.', 'warn'); return; }
        try {
          const email = user.email;
          if(!email){ throw new Error('관리자 이메일을 확인할 수 없습니다.'); }
          const credential = EmailAuthProvider.credential(email, oldPassword);
          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, newPassword);
          els.adminOldPass.value = '';
          els.adminNewPass.value = '';
          setAdminMsg('비밀번호가 변경되었습니다.', 'ok');
        } catch (error) {
          console.error(error);
          if(error.code === 'auth/wrong-password'){
            setAdminMsg('현재 비밀번호가 올바르지 않습니다.', 'warn');
          } else if(error.code === 'auth/weak-password'){
            setAdminMsg('새 비밀번호가 너무 약합니다.', 'warn');
          } else {
            setAdminMsg('비밀번호 변경 중 오류가 발생했습니다.', 'error');
          }
        }
      }

      function updateCombatView(){ const {atk, def} = getTotals(); if(els.atkTotal) els.atkTotal.textContent = formatNum(atk); if(els.defTotal) els.defTotal.textContent = formatNum(def); if(els.playerAtkStat) els.playerAtkStat.textContent = formatNum(atk); if(els.playerDefStat) els.playerDefStat.textContent = formatNum(def); updateWinProbView(); }
      function updateInventoryView(){ els.invCount.textContent = String(totalKept());
        const grid = els.equipGrid; grid.innerHTML='';
        PART_DEFS.forEach(function(part){ const item = state.equip[part.key]; const card = createGearCard(part, item, { kind:'gear-equip' }); grid.appendChild(card); });
        els.spareList.innerHTML='';
        PART_DEFS.forEach(function(part){ const spare = state.spares[part.key]; const card = createGearCard(part, spare, { kind:'gear-spare', button:'착용', emptyText:'예비 없음' }); els.spareList.appendChild(card); });
        updateCombatView();
        buildForgeTargetOptions();
        updateReviveButton();
        updateCharacterList();
        updatePetList();
        refreshInventoryCache();
      }
      function totalKept(){ return Object.values(state.equip).filter(Boolean).length + PART_KEYS.reduce(function(acc, part){ return acc + (state.spares[part]?1:0); }, 0); }

      function updateCharacterList(){ if(!els.characterList) return; const container = els.characterList; const characters = ensureCharacterState(); const activeId = getActiveCharacterId(); container.innerHTML=''; const fragment = document.createDocumentFragment();
        const entries = CHARACTER_IDS.map((id) => {
          const def = getCharacterDefinition(id) || { name: id, className: '', image: '', stats: {}, tier: 'D' };
          const count = characters.owned?.[id] || 0;
          return {
            id,
            def,
            count,
            isActive: id === activeId,
            tierIndex: TIER_INDEX[def.tier] ?? TIERS.length
          };
        }).filter((entry) => entry.count > 0 || entry.isActive);
        entries.sort((a, b) => {
          if(a.isActive && !b.isActive) return -1;
          if(!a.isActive && b.isActive) return 1;
          if(a.tierIndex !== b.tierIndex) return a.tierIndex - b.tierIndex;
          if(a.count !== b.count) return b.count - a.count;
          return a.id.localeCompare(b.id);
        });
        if(!state.ui.selectedCharacterDetail || !entries.some((entry) => entry.id === state.ui.selectedCharacterDetail)){
          state.ui.selectedCharacterDetail = activeId;
        }
        const balanceConfig = ensureCharacterBalanceConfig();
        const showDetails = isAdmin();
        let appended = 0;
        entries.forEach(({ id, def, count, isActive }) => {
          const card = document.createElement('div');
          card.className = 'pet-card character-card';
          card.dataset.character = id;
          card.dataset.tier = def.tier || 'NONE';
          if(isActive) card.classList.add('active');
          const infoWrap = document.createElement('div');
          infoWrap.className = 'character-info';
          const imageSources = getCharacterImageVariants(id);
          if(def.image && !imageSources.includes(def.image)){ imageSources.unshift(def.image); }
          const thumb = createCharacterImageElement(def.name || id, imageSources);
          thumb.alt = def.name || id;
          infoWrap.appendChild(thumb);
          const textWrap = document.createElement('div');
          textWrap.className = 'info';
          const nameEl = document.createElement('div');
          nameEl.className = 'name';
          nameEl.textContent = def.name || id;
          textWrap.appendChild(nameEl);
          if(def.className){ const classEl = document.createElement('div'); classEl.className = 'class muted'; classEl.textContent = def.className; textWrap.appendChild(classEl); }
          const countEl = document.createElement('div');
          countEl.className = 'count';
          countEl.textContent = `보유: ${formatNum(count)}`;
          textWrap.appendChild(countEl);
          const stats = def.stats || {};
          const balance = balanceConfig[def.classId] || DEFAULT_CHARACTER_BALANCE[def.classId] || DEFAULT_CHARACTER_BALANCE.warrior;
          const statMultipliers = balance.stats || {};
          const statOffsets = balance.offsets || {};
          const statsEl = document.createElement('div');
          statsEl.className = 'stats muted small';
          const hpText = formatSnapshotCell(stats.hp || 0, Number(statMultipliers.hp ?? 1), Number(statOffsets.hp ?? 0), 'flat', showDetails);
          const atkText = formatSnapshotCell(stats.atk || 0, Number(statMultipliers.atk ?? 1), Number(statOffsets.atk ?? 0), 'flat', showDetails);
          const defText = formatSnapshotCell(stats.def || 0, Number(statMultipliers.def ?? 1), Number(statOffsets.def ?? 0), 'flat', showDetails);
          statsEl.innerHTML = `HP ${hpText} · ATK ${atkText} · DEF ${defText}`;
          textWrap.appendChild(statsEl);
          const skillDesc = getCharacterSkillDescription(def);
          if(skillDesc){
            const skillEl = document.createElement('div');
            skillEl.className = 'skill muted small';
            skillEl.textContent = skillDesc;
            textWrap.appendChild(skillEl);
          }
          infoWrap.appendChild(textWrap);
          card.appendChild(infoWrap);
          const actions = document.createElement('div');
          actions.className = 'actions';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.dataset.character = id;
          btn.textContent = isActive ? '사용중' : '선택';
          if(isActive){
            btn.disabled = true;
          } else {
            btn.addEventListener('click', (event) => {
              event.stopPropagation();
              setActiveCharacter(id);
            });
          }
          actions.appendChild(btn);
          card.appendChild(actions);
          card.addEventListener('click', (event) => {
            if(event.target instanceof HTMLElement && event.target.closest('button')) return;
            selectCharacterDetail(id);
          });
          fragment.appendChild(card);
          appended += 1;
        });
        if(els.characterDetailHint){
          els.characterDetailHint.textContent = appended === 0
            ? '보유한 캐릭터가 없습니다.'
            : '캐릭터 카드를 눌러 상세 정보를 확인하세요.';
        }
        if(appended === 0){
          const empty = document.createElement('div');
          empty.className = 'muted small';
          empty.textContent = '보유한 캐릭터가 없습니다.';
          container.appendChild(empty);
        } else {
          container.appendChild(fragment);
        }
        updateCharacterDetailSelection();
        renderCharacterStats();
      }

      function setActiveCharacter(characterId){ if(!CHARACTER_IDS.includes(characterId)) return; const characters = ensureCharacterState(); if(!isAdmin() && (characters.owned?.[characterId] || 0) <= 0){ alert('해당 캐릭터를 보유하고 있지 않습니다.'); return; } if(characters.active === characterId) return; characters.active = characterId; state.characters = characters; if(userProfile) userProfile.characters = characters; state.ui.selectedCharacterDetail = characterId; updateInventoryView(); markProfileDirty(); }
      function getTotals(){
        const baseStats = getActiveCharacterBaseStats();
        const activeId = getActiveCharacterId();
        const activeDef = getCharacterDefinition(activeId);
        const derived = deriveCombatStats(
          state.equip,
          state.enhance,
          baseStats,
          state.pets?.active || null,
          {
            balance: state.config?.characterBalance,
            characterId: activeId,
            classId: activeDef?.classId,
            character: activeDef || null
          }
        );
        const stats = derived.stats || { atk: 0, def: 0 };
        return { atk: Math.round(stats.atk || 0), def: Math.round(stats.def || 0), raw: stats };
      }
      function updateWinProbView(){ const lvl = els.monLevel ? parseInt(els.monLevel.value||'1',10) : (state.combat.lastLevel || 1); state.combat.lastLevel = lvl; const {atk, def} = getTotals(); const p = winProbability(atk, def, lvl); const percentText = (p*100).toFixed(2)+'%'; if(els.winProb) els.winProb.textContent = percentText; if(els.battleWinProb) els.battleWinProb.textContent = percentText; if(els.playerHealthBar){ const playerWidth = Math.max(8, Math.min(100, p*100)); els.playerHealthBar.style.width = playerWidth + '%'; }
        if(els.enemyHealthBar){ const enemyWidth = Math.max(8, Math.min(100, 100 - (p*100))); els.enemyHealthBar.style.width = enemyWidth + '%'; }
        if(els.battleEnemyLevel) els.battleEnemyLevel.textContent = String(lvl);
        if(els.battleEnemyReward){ const estimated = calcGoldReward(lvl, ()=>0.5); els.battleEnemyReward.textContent = formatNum(estimated) + ' G'; }
      }
      function setLevel(lvl){ if(!(lvl>=1)) lvl=1; if(lvl>999) lvl=999; state.combat.lastLevel = lvl; if(els.monLevel) els.monLevel.value = String(lvl); if(els.monLevelVal) els.monLevelVal.textContent = String(lvl); if(els.battleEnemyLevel) els.battleEnemyLevel.textContent = String(lvl); if(els.battleEnemyReward){ const estimated = calcGoldReward(lvl, ()=>0.5); els.battleEnemyReward.textContent = formatNum(estimated) + ' G'; } updateWinProbView(); }
      function doFight(){
        if(!els.monLevel || !els.fightResult) return;
        const now = Date.now();
        const remain = manualCooldownRemain(now);
        if(remain > 0){
          els.fightResult.textContent = `쿨다운 ${Math.ceil(remain/1000)}초 남음`;
          return;
        }
        state.timers.manualLast = now;
        const rng = getRng();
        const lvl = parseInt(els.monLevel.value || '1', 10);
        const { atk, def } = getTotals();
        const p = winProbability(atk, def, lvl);
        const win = rng() < p;
        if(win){
          const reward = levelReward(lvl);
          addPoints(reward);
          const goldGain = calcGoldReward(lvl, rng);
          addGold(goldGain);
          const gains = [];
          if(maybeDropEnhance(rng, lvl)) gains.push('강화권 +1');
          if(maybeDropPotion(rng, lvl)) gains.push('가속 물약 +1');
          if(maybeDropHyperPotion(rng, lvl)) gains.push('초 가속 물약 +1');
          if(maybeDropProtect(rng, lvl)) gains.push('보호권 +1');
          if(maybeDropBattleRes(rng, lvl)) gains.push('전투부활권 +1');
          updateItemCountsView();
          const msg = `Lv.${lvl} 전투 승리! (+${formatNum(reward)} 포인트, +${formatNum(goldGain)} 골드${gains.length ? ', ' + gains.join(', ') : ''}, p=${(p*100).toFixed(2)}%)`;
          els.fightResult.textContent = msg;
          markQuestCompleted('firstBattleWin');
          if(lvl >= 100){
            markQuestCompleted('slayLevel100');
          }
        } else {
          if(consumeBattleResToken(lvl, 'manual')) return;
          els.fightResult.textContent = `Lv.${lvl} 전투 패배... (p=${(p*100).toFixed(2)}%)`;
        }
      }

      function isAccelActive(now){ now = now || Date.now(); return (state.buffs.hyperUntil||0) > now || (state.buffs.accelUntil||0) > now; }
      function currentManualCooldown(now){ if(typeof now!=='number') now = Date.now(); if((state.buffs.hyperUntil||0) > now){ const hyperCfg = getHyperPotionSettings(); return Math.max(0, hyperCfg.manualCdMs ?? DEFAULT_HYPER_POTION_SETTINGS.manualCdMs ?? CD_MANUAL_MS); } if((state.buffs.accelUntil||0) > now){ const potCfg = getPotionSettings(); return Math.max(0, potCfg.manualCdMs ?? DEFAULT_POTION_SETTINGS.manualCdMs ?? CD_MANUAL_MS); } return CD_MANUAL_MS; }
      function currentAutoCooldown(now){ if(typeof now!=='number') now = Date.now(); if((state.buffs.hyperUntil||0) > now){ const hyperCfg = getHyperPotionSettings(); return Math.max(0, hyperCfg.autoCdMs ?? DEFAULT_HYPER_POTION_SETTINGS.autoCdMs ?? CD_AUTO_MS); } if((state.buffs.accelUntil||0) > now){ const potCfg = getPotionSettings(); return Math.max(0, potCfg.autoCdMs ?? DEFAULT_POTION_SETTINGS.autoCdMs ?? CD_AUTO_MS); } return CD_AUTO_MS; }
      function manualCooldownRemain(now){ const last = state.timers.manualLast||0; const cd = currentManualCooldown(now); const elapsed = now - last; return Math.max(0, cd - elapsed);
      }
      function autoCooldownRemain(now){ const last = state.timers.autoLast||0; const cd = currentAutoCooldown(now); const elapsed = now - last; return Math.max(0, cd - elapsed);
      }
      function startUiTimer(){ if(state.timers.uiTimer) return; state.timers.uiTimer = setInterval(()=>{ const now=Date.now(); if(els.manualCd) els.manualCd.textContent = Math.ceil(manualCooldownRemain(now)/1000)+'s'; if(els.autoCd) els.autoCd.textContent = Math.ceil(autoCooldownRemain(now)/1000)+'s'; updateBuffInfo(now); }, 500); }
      function updateBuffInfo(now){ now = now || Date.now(); if(!els.buffInfo) return; if((state.buffs.hyperUntil||0) > now){ const remain = Math.ceil((state.buffs.hyperUntil - now)/1000); const mult = formatMultiplier(state.buffs.hyperMultiplier||DEFAULT_HYPER_POTION_SETTINGS.speedMultiplier||4); els.buffInfo.textContent = `초 가속 ${mult}× ${remain}s`; }
        else if((state.buffs.accelUntil||0) > now){ const remain = Math.ceil((state.buffs.accelUntil - now)/1000); const mult = formatMultiplier(state.buffs.accelMultiplier||DEFAULT_POTION_SETTINGS.speedMultiplier||2); els.buffInfo.textContent = `가속 ${mult}× ${remain}s`; }
        else { els.buffInfo.textContent = '버프 없음'; } }
      function stopUiTimer(){ if(state.timers.uiTimer){ clearInterval(state.timers.uiTimer); state.timers.uiTimer=null; } }
      function toggleAutoHunt(){ if(!els.autoHuntBtn) return; state.timers.autoOn = !state.timers.autoOn; els.autoHuntBtn.textContent = '자동사냥: ' + (state.timers.autoOn? 'ON':'OFF'); if(state.timers.autoOn){ startAutoTimer(); } else { stopAutoTimer(); } }
      function startAutoTimer(){ if(state.timers.autoTimer) return; state.timers.autoTimer = setInterval(()=>{ const now=Date.now(); if(autoCooldownRemain(now)>0) return; state.timers.autoLast = now; autoHuntOnce(); }, 1000); }
      function stopAutoTimer(){ if(state.timers.autoTimer){ clearInterval(state.timers.autoTimer); state.timers.autoTimer=null; }
        state.timers.autoLast = 0;
      }
      function autoHuntOnce(){
        if(!els.monLevel) return;
        const rng = getRng();
        const lvl = parseInt(els.monLevel.value || '1', 10);
        const { atk, def } = getTotals();
        const p = winProbability(atk, def, lvl);
        const win = rng() < p;
        if(win){
          const reward = levelReward(lvl);
          addPoints(reward);
          const goldGain = calcGoldReward(lvl, rng);
          addGold(goldGain);
          const gains = [];
          if(maybeDropEnhance(rng, lvl)) gains.push('강화권 +1');
          if(maybeDropPotion(rng, lvl)) gains.push('가속 물약 +1');
          if(maybeDropHyperPotion(rng, lvl)) gains.push('초 가속 물약 +1');
          if(maybeDropProtect(rng, lvl)) gains.push('보호권 +1');
          if(maybeDropBattleRes(rng, lvl)) gains.push('전투부활권 +1');
          updateItemCountsView();
          if(els.fightResult){
            const msg = `자동사냥: Lv.${lvl} 승리! (+${formatNum(reward)} 포인트, +${formatNum(goldGain)} 골드${gains.length ? ', ' + gains.join(', ') : ''}, p=${(p*100).toFixed(2)}%)`;
            els.fightResult.textContent = msg;
          }
          markQuestCompleted('firstBattleWin');
          if(lvl >= 100){
            markQuestCompleted('slayLevel100');
          }
        } else {
          if(consumeBattleResToken(lvl, 'auto')){ return; }
          const choosePoints = rng() < 0.5;
          if(choosePoints && !isAdmin() && state.wallet > 0){
            const lost = Math.floor(state.wallet * 0.5);
            state.wallet -= lost;
            saveWallet();
            updatePointsView();
            if(els.fightResult) els.fightResult.textContent = `자동사냥: Lv.${lvl} 패배... 포인트 ${formatNum(lost)} 손실`;
          } else {
            const n = Math.max(1, Math.min(3, (1 + Math.floor(rng() * 3))));
            const removed = removeRandomItems(n, rng);
            const removedTxt = removed.map(itemLabel).join(', ');
            if(els.fightResult) els.fightResult.textContent = `자동사냥: Lv.${lvl} 패배... 장비 ${removed.length}개 손실 (${removedTxt})`;
            updateInventoryView();
          }
          maybeAwardRevive();
        }
      }
      function maybeAwardRevive(){ if(isAdmin()) return false; var emptyEquip = totalKept()===0; var noPoints = (state.wallet||0) <= 0; if(emptyEquip && noPoints){ state.items.revive = (state.items.revive||0) + 1; addPoints(1000); updateItemCountsView(); updateReviveButton(); markProfileDirty(); if(els.fightResult) els.fightResult.textContent += ' [부활권 +1, +1000포인트 지급]'; return true; } return false; }
      function itemLabel(it){ const name = getPartNameByKey(it.part) || ''; return `${name} ${it.tier}`; }
      function removeRandomItems(k, rng){ const pool = []; PART_DEFS.forEach(function(p){ const eq = state.equip[p.key]; if(eq) pool.push({type:'equip', part:p.key, item:eq}); const spare = state.spares[p.key]; if(spare) pool.push({type:'spare', part:p.key, item:spare}); }); if(pool.length===0) return []; shuffle(pool, rng); const selected = pool.slice(0, Math.min(k, pool.length)); selected.forEach(function(entry){ if(entry.type==='equip'){ state.equip[entry.part] = null; } else if(entry.type==='spare'){ state.spares[entry.part] = null; } }); updateInventoryView(); markProfileDirty(); return selected.map(function(e){ return e.item; }); }
      function applyEquipAndInventory(item, opts){ opts = opts || {}; const decision = opts.decision || null; const part = item.part; const current = state.equip[part];
        if(decision === 'discard'){ markProfileDirty(); return; }
        if(decision === 'equip'){
          if(current){ storeSpare(current); }
          state.equip[part] = item;
        } else if(decision === 'spare'){
          storeSpare(item, true);
        } else {
          const better = !current || (effectiveStat(item) > effectiveStat(current)) || (effectiveStat(item) === effectiveStat(current) && TIER_RANK[item.tier] > TIER_RANK[current.tier]);
          if(better){
            if(current){ storeSpare(current); }
            state.equip[part] = item;
          } else {
            storeSpare(item);
          }
        }
        if(state.spares[part] === state.equip[part]){ state.spares[part] = null; }
        refreshInventoryCache();
        markProfileDirty();
      }

      // Forge UI/model
      function onSpareListClick(e){ const target = e.target; if(!(target instanceof HTMLButtonElement)) return; if(!target.classList.contains('equip-btn')) return; const part = target.dataset.part; if(!part) return; equipSpare(part); }
      function equipSpare(part){
        const spareItem = state.spares[part];
        if(!spareItem){ alert('예비 장비가 없습니다.'); return; }
        const equipped = state.equip[part];
        const partName = (PART_DEFS.find((p) => p.key === part)?.name) || '장비';
        if(equipped){
          const ok = confirm(`${partName} 부위에 장착된 장비를 예비로 이동하고 선택한 장비로 교체할까요?`);
          if(!ok) return;
          state.spares[part] = equipped;
        } else {
          state.spares[part] = null;
        }
        state.equip[part] = spareItem;
        updateInventoryView();
        buildForgeTargetOptions();
        updateItemCountsView();
        setForgeMsg('장비를 교체했습니다.', 'ok');
        markProfileDirty();
      }

      function setAutoForgeRunning(running){ running = !!running; state.forge.autoRunning = running; if(els.forgeAuto){ els.forgeAuto.textContent = running ? '자동 강화 중지' : '자동 강화'; els.forgeAuto.classList.toggle('forge-auto-running', running); }
        if(els.forgeOnce){ els.forgeOnce.disabled = running; } }

      function buildForgeTable(){ const tb = els.forgeTableBody; if(!tb) return; tb.innerHTML=''; const admin = isAdmin(); for(let lv=1; lv<=20; lv++){ const tr = document.createElement('tr'); const mul = state.enhance.multipliers[lv]||1; const p = state.enhance.probs[lv]||0; tr.innerHTML = `<td>${lv}</td><td><input data-kind="mul" data-lv="${lv}" type="number" step="any" value="${mul}" style="width:100px" ${admin?'':'disabled'} /></td><td><input data-kind="p" data-lv="${lv}" type="number" step="any" min="0" max="1" value="${p}" style="width:100px" ${admin?'':'disabled'} /></td>`; tb.appendChild(tr); } }

      function onForgeTableInput(e){ const t = e.target; if(!(t instanceof HTMLInputElement)) return; if(!isAdmin()) return; const lv = parseInt(t.dataset.lv||'0',10); if(!lv) return; let changed = false; if(t.dataset.kind==='mul'){ let v = parseFloat(t.value); if(!(v>0)) v = 1; state.enhance.multipliers[lv] = v; t.value = String(v); changed = true; } else if(t.dataset.kind==='p'){ let v = parseFloat(t.value); if(!(v>=0)) v = 0; if(v>1) v = 1; state.enhance.probs[lv] = v; t.value = String(v); changed = true; } if(!changed) return; updateForgeInfo(); markProfileDirty(); if(isAdmin()){ persistGlobalConfig(state.config, { activePresetId: state.presets.activeGlobalId, activePresetName: state.presets.activeGlobalName }); } }

      function currentForgeItem(){ const v = els.forgeTarget?.value||''; if(!v) return null; const [kind, id] = v.split(':'); if(kind==='equip'){ return state.equip[id] || null; } if(kind==='spare'){ return state.spares[id] || null; } return null; }

      function buildForgeTargetOptions(){ const sel = els.forgeTarget; if(!sel) return; const options = []; PART_DEFS.forEach(function(p){ const it = state.equip[p.key]; if(it) options.push({key:`equip:${p.key}`, label:`장착-${p.name} ${it.tier} ${formatNum(effectiveStat(it))} (Lv.${it.lvl||0})`, ref: it}); }); PART_DEFS.forEach(function(p){ const spare = state.spares[p.key]; if(spare) options.push({key:`spare:${p.key}`, label:`예비-${p.name} ${spare.tier} ${formatNum(effectiveStat(spare))} (Lv.${spare.lvl||0})`, ref: spare}); }); const prev = sel.value; sel.innerHTML=''; options.forEach(function(o){ const opt = document.createElement('option'); opt.value = o.key; opt.textContent = o.label; sel.appendChild(opt); }); if(options.length===0){ const opt = document.createElement('option'); opt.value=''; opt.textContent='보강할 장비 없음'; sel.appendChild(opt); } sel.value = options.some(function(o){ return o.key===prev; }) ? prev : sel.value; if(options.length===0 && state.forge.autoRunning){ setAutoForgeRunning(false); } updateForgeInfo(); updateForgeControlsView(); updateItemCountsView(); }

      function updateForgeControlsView(){ if(!els.forgeProtectUse) return; els.forgeProtectUse.checked = !!state.forge.protectEnabled; }

      function updateForgeInfo(){ const it = currentForgeItem(); if(!it){ if(els.forgeLv) els.forgeLv.textContent = '0'; if(els.forgeMul) els.forgeMul.textContent = '1.00×'; if(els.forgeP) els.forgeP.textContent = '-'; if(els.forgePreview) els.forgePreview.textContent = '-'; if(els.forgeStageMul) els.forgeStageMul.textContent = '1.00×'; if(els.forgeNextMul) els.forgeNextMul.textContent = '-'; if(els.forgeCostEnh) els.forgeCostEnh.textContent = '0'; if(els.forgeCostProtect) els.forgeCostProtect.textContent = '0'; if(els.forgeCostGold) els.forgeCostGold.textContent = '0'; if(els.forgeOnce) els.forgeOnce.disabled = true; return; }
        const lv = it.lvl || 0;
        const next = Math.min(20, lv + 1);
        const currentMul = state.enhance.multipliers[lv] || 1;
        const nextMul = (next <= 20 ? state.enhance.multipliers[next] : currentMul);
        const successProb = lv >= 20 ? null : (state.enhance.probs[next] || 0);
        const stepMultiplier = lv >= 20 ? null : (nextMul / (currentMul || 1));
        const nextTotalMul = lv >= 20 ? null : nextMul;
        const enhanceCost = ENHANCE_TICKET_COST[next] || 0;
        const protectCost = ENHANCE_PROTECT_COST[next] || 0;
        const expectedGold = ENHANCE_EXPECTED_GOLD[next] || 0;

        if(els.forgeLv) els.forgeLv.textContent = String(lv);
        if(els.forgeMul) els.forgeMul.textContent = `${currentMul.toFixed(2)}×`;
        if(els.forgeP) els.forgeP.textContent = successProb === null ? '-' : `${(successProb * 100).toFixed(2)}%`;
        if(els.forgeStageMul) els.forgeStageMul.textContent = stepMultiplier === null ? '-' : `${stepMultiplier.toFixed(stepMultiplier >= 10 ? 1 : 3)}×`;
        if(els.forgeNextMul) els.forgeNextMul.textContent = nextTotalMul === null ? '-' : `${nextTotalMul.toFixed(nextTotalMul >= 10 ? 1 : 3)}×`;
        if(els.forgeCostEnh) els.forgeCostEnh.textContent = lv >= 20 ? '-' : String(enhanceCost);
        if(els.forgeCostProtect) els.forgeCostProtect.textContent = lv >= 20 ? '-' : String(protectCost);
        if(els.forgeCostGold) els.forgeCostGold.textContent = lv >= 20 ? '-' : formatNum(expectedGold);

        const cur = effectiveStat(it);
        const after = Math.floor((it.base || 0) * nextMul);
        if(els.forgePreview){
          if(lv >= 20){ els.forgePreview.textContent = '-'; }
          else {
            const curMulText = currentMul.toFixed(currentMul >= 10 ? 1 : 3);
            const nextMulText = nextMul.toFixed(nextMul >= 10 ? 1 : 3);
            els.forgePreview.textContent = `${formatNum(cur)} (×${curMulText}) → ${formatNum(after)} (×${nextMulText})`;
          }
        }
        if(els.forgeOnce) els.forgeOnce.disabled = lv >= 20;
      }

      function setForgeMsg(text, tone){ if(!els.forgeMsg) return; els.forgeMsg.textContent = text || ''; els.forgeMsg.classList.remove('msg-ok','msg-warn','msg-danger','muted'); if(tone==='ok'){ els.forgeMsg.classList.add('msg-ok'); } else if(tone==='warn'){ els.forgeMsg.classList.add('msg-warn'); } else if(tone==='danger'){ els.forgeMsg.classList.add('msg-danger'); } else { els.forgeMsg.classList.add('muted'); } }

      function showForgeEffect(kind){ const eff = els.forgeEffect; if(!eff) return; const textMap = { success:'강화 성공!', fail:'강화 실패...', protected:'보호권 발동!', destroyed:'장비 파괴...' }; if(forgeEffectTimer){ clearTimeout(forgeEffectTimer); forgeEffectTimer = null; } eff.classList.remove('success','fail','protected','destroyed','show');
        void eff.offsetWidth;
        if(kind === 'success'){ eff.classList.add('success'); }
        else if(kind === 'protected'){ eff.classList.add('protected'); }
        else if(kind === 'destroyed'){ eff.classList.add('destroyed'); }
        else { eff.classList.add('fail'); }
        eff.textContent = textMap[kind] || '';
        eff.classList.add('show');
        forgeEffectTimer = setTimeout(()=>{ if(!els.forgeEffect) return; eff.classList.remove('show','success','fail','protected','destroyed'); eff.textContent=''; forgeEffectTimer=null; }, 720);
      }

      function performForgeAttempt(opts){ opts = opts||{}; const auto = !!opts.auto; const item = currentForgeItem(); if(!item){ if(!auto) setForgeMsg('강화할 장비를 선택하세요.', 'warn'); showForgeEffect('fail'); return {status:'no-item'}; } const lv = item.lvl || 0; if(lv >= 20){ if(!auto) setForgeMsg('이미 최대 강화 레벨입니다.', 'warn'); showForgeEffect('fail'); return {status:'max'}; } const admin = isAdmin(); const nextLv = lv + 1; const enhanceCost = ENHANCE_TICKET_COST[nextLv] || 0; const protectCost = ENHANCE_PROTECT_COST[nextLv] || 0; const expectedGold = ENHANCE_EXPECTED_GOLD[nextLv] || 0; const wantProtect = !!state.forge.protectEnabled;
        if(!auto){ const willProtect = wantProtect && (admin || (state.items.protect || 0) >= protectCost); if(!willProtect){ const ok = confirm('강화 실패 시 장비가 파괴될 수 있습니다. 계속하시겠습니까?'); if(!ok){ setForgeMsg('강화를 취소했습니다.', 'warn'); return {status:'cancelled'}; } } }
        if(!admin && (state.items.enhance || 0) < enhanceCost){ if(!auto) setForgeMsg('강화권이 부족합니다.', 'warn'); showForgeEffect('fail'); return {status:'no-enhance'}; }
        if(wantProtect && !admin && protectCost > 0 && (state.items.protect || 0) < protectCost){ if(!auto) setForgeMsg('보호권이 부족합니다.', 'warn'); showForgeEffect('fail'); return {status:'no-protect'}; }
        if(!admin && (state.gold || 0) < expectedGold){ if(!auto) setForgeMsg('골드가 부족합니다.', 'warn'); showForgeEffect('fail'); return {status:'no-gold'}; }
        if(!admin){ state.items.enhance = Math.max(0, (state.items.enhance || 0) - enhanceCost); state.gold = Math.max(0, (state.gold || 0) - expectedGold); }
        updateItemCountsView();
        const commitConsumables = ()=>{ if(admin) return; const itemsSnapshot = sanitizeItems(state.items); state.items = itemsSnapshot; if(userProfile) userProfile.items = itemsSnapshot; if(state.profile) state.profile.items = { ...itemsSnapshot }; saveGold({ extraUpdates: { items: itemsSnapshot } }); updateItemCountsView(); };
        const successProb = state.enhance.probs[nextLv] || 0; const rng = getRng(); const success = rng() < successProb;
        if(success){ item.lvl = nextLv; updateInventoryView(); updateForgeInfo(); setForgeMsg(`강화 성공! Lv.${lv} → Lv.${nextLv}`, 'ok'); showForgeEffect('success'); commitConsumables(); markProfileDirty(); return {status:'success', level: nextLv}; }
        const protectActive = wantProtect && (admin || (protectCost > 0 ? (state.items.protect || 0) >= protectCost : true));
        if(protectActive){ if(!admin && protectCost > 0){ state.items.protect = Math.max(0, (state.items.protect || 0) - protectCost); updateItemCountsView(); }
          updateInventoryView(); updateForgeInfo(); setForgeMsg('강화 실패! 보호권이 소모되어 장비가 보호되었습니다.', 'warn'); showForgeEffect('protected'); commitConsumables(); markProfileDirty(); return {status:'protected'}; }
        removeItem(item);
        updateInventoryView();
        updateForgeInfo();
        setForgeMsg('강화 실패! 장비가 파괴되었습니다.', 'danger');
        showForgeEffect('destroyed');
        commitConsumables();
        markProfileDirty();
        return {status:'destroyed'};
      }

      async function runAutoForgeLoop(){ setAutoForgeRunning(true); setForgeMsg('자동 강화를 시작합니다.', 'ok'); try {
          while(state.forge.autoRunning){ const target = currentForgeItem(); if(!target){ setForgeMsg('강화할 장비가 없습니다. 자동 강화를 종료합니다.', 'warn'); break; }
            const lv = target.lvl || 0;
            if(lv >= 20){ setForgeMsg('이미 최대 강화 레벨입니다.', 'warn'); break; }
            const nextLv = lv + 1;
            const enhanceCost = ENHANCE_TICKET_COST[nextLv] || 0;
            const protectCost = ENHANCE_PROTECT_COST[nextLv] || 0;
            const expectedGold = ENHANCE_EXPECTED_GOLD[nextLv] || 0;
            if(!isAdmin()){
              if((state.items.enhance || 0) < enhanceCost){ setForgeMsg('강화권이 부족합니다. 자동 강화를 종료합니다.', 'warn'); break; }
              if(state.forge.protectEnabled && protectCost > 0 && (state.items.protect || 0) < protectCost){ setForgeMsg('보호권이 부족합니다. 자동 강화를 종료합니다.', 'warn'); break; }
              if((state.gold || 0) < expectedGold){ setForgeMsg('골드가 부족합니다. 자동 강화를 종료합니다.', 'warn'); break; }
            }
            const result = performForgeAttempt({auto:true});
            if(result.status === 'no-item' || result.status === 'no-enhance' || result.status === 'no-protect' || result.status === 'no-gold' || result.status === 'max' || result.status === 'destroyed'){ break; }
            if(!state.forge.autoRunning) break;
            await maybeDelay(600);
          }
        } finally { setAutoForgeRunning(false); }
      }

      function toggleAutoForge(){ if(state.forge.autoRunning){ setAutoForgeRunning(false); setForgeMsg('자동 강화를 중지합니다.', 'warn'); return; }
        if(!currentForgeItem()){ setForgeMsg('강화할 장비를 선택하세요.', 'warn'); showForgeEffect('fail'); return; }
        runAutoForgeLoop(); }
      function doForgeOnce(){ if(state.forge.autoRunning){ setForgeMsg('자동 강화 중에는 수동 강화를 사용할 수 없습니다.', 'warn'); return; }
        performForgeAttempt({auto:false}); }

      function removeItem(item){ if(!item) return; PART_KEYS.forEach(function(part){ if(state.equip[part] === item){ state.equip[part] = null; } if(state.spares[part] === item){ state.spares[part] = null; } }); refreshInventoryCache(); buildForgeTargetOptions(); markProfileDirty(); }
      // 강화 관련 로직은 forge 모듈로 이동했습니다.


      // Bootstrap DOM
      renderDiamondShop();
      buildWeightsTable(); buildCharacterWeightsTable(); renderPetWeightTable(); bind(); readLink(); reflectConfig(); buildForgeTable(); buildForgeTargetOptions(); updateForgeInfo();

      onAuthStateChanged(auth, async (firebaseUser)=>{
        if(profileSaveTimer){ clearTimeout(profileSaveTimer); profileSaveTimer = null; }
        if(!firebaseUser){
          detachProfileListener();
          detachGlobalConfigListener();
          resetRareAnimationState({ immediate: true });
          window.location.href = 'login.html';
          return;
        }
        currentFirebaseUser = firebaseUser;
        try {
          userProfile = await loadOrInitializeProfile(firebaseUser);
          await applyProfileState();
          hydrateSessionFromProfile();
          if(els.appWrap){ els.appWrap.style.display = ''; }
        } catch(err){
          console.error('프로필을 불러오지 못했습니다.', err);
          if(err && err.code === 'PROFILE_NOT_FOUND'){
            setShopMessage('프로필 정보를 찾을 수 없습니다. 다시 로그인하세요.', 'error');
            await signOut(auth);
            window.location.href = 'login.html';
            return;
          }
          setShopMessage('프로필을 불러오지 못했습니다.', 'error');
        }
      });

      window.addEventListener('beforeunload', ()=>{
        if(profileSaveTimer){ clearTimeout(profileSaveTimer); profileSaveTimer = null; }
        saveProfileSnapshot();
      });
      // Global error popups for visibility
      (function(){
        let lastMsg = '';
        function show(msg){ if(msg && msg!==lastMsg){ lastMsg = msg; alert('오류가 발생했습니다: '+msg); setTimeout(()=>{ lastMsg=''; }, 500); } }
        window.addEventListener('error', function(e){ show(e && e.message ? e.message : String(e)); });
        window.addEventListener('unhandledrejection', function(e){ var m = (e && e.reason && e.reason.message) ? e.reason.message : String(e && e.reason || e); show(m); });
      })();
