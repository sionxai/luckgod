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
  updatePassword
} from './firebase.js';

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
      const DEFAULT_SHOP_PRICES = { potion: 500, hyperPotion: 2000, protect: 1200, enhance: 800, battleRes: 2000, starterPack: 5000 };
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

      const $ = (q)=>document.querySelector(q);
      const $$ = (q)=>Array.from(document.querySelectorAll(q));

      const els = {
        appWrap: $('#appWrap'), logoutBtn: $('#logoutBtn'), whoami: $('#whoami'), toAdmin: $('#toAdmin'), toUser: $('#toUser'), toBattle: $('#toBattle'), goBattle: $('#goBattle'), toPvp: $('#toPvp'), adminPanel: $('#adminPanel'), adminOldPass: $('#adminOldPass'), adminNewPass: $('#adminNewPass'), adminChangePw: $('#adminChangePw'), adminMsg: $('#adminMsg'),
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
        mode: $('#mode'), seed: $('#seed'), lock: $('#lock'),
        weightsTable: $('#weightsTable tbody'),
        pityEnabled: $('#pityEnabled'), pityFloor: $('#pityFloor'), pitySpan: $('#pitySpan'),
        g10Enabled: $('#g10Enabled'), g10Tier: $('#g10Tier'),
        draw1: $('#draw1'), draw10: $('#draw10'), draw100: $('#draw100'), draw1k: $('#draw1k'), draw10k: $('#draw10k'), cancel: $('#cancel'), speed: $('#speed'), bar: $('#bar'),
        scope: $('#scope'), nDraws: $('#nDraws'), pval: $('#pval'), statsTable: $('#statsTable tbody'),
        chart: $('#chart'), log: $('#log'),
        atkTotal: $('#atkTotal'), defTotal: $('#defTotal'), nextMonster: $('#nextMonster'), monLevel: $('#monLevel'), monLevelVal: $('#monLevelVal'), winProb: $('#winProb'), fightBtn: $('#fightBtn'), fightResult: $('#fightResult'), autoHuntBtn: $('#autoHuntBtn'), manualCd: $('#manualCd'), autoCd: $('#autoCd'), lvlDec: $('#lvlDec'), lvlInc: $('#lvlInc'), potionCount: $('#potionCount'), usePotion: $('#usePotion'), hyperPotionCount: $('#hyperPotionCount'), useHyperPotion: $('#useHyperPotion'), buffInfo: $('#buffInfo'), claimRevive: $('#claimRevive'), battleResUse: $('#battleResUse'), battleResRemain: $('#battleResRemain'), battleWinProb: $('#battleWinProb'), playerHealthBar: $('#playerHealthBar'), enemyHealthBar: $('#enemyHealthBar'), playerAtkStat: $('#playerAtkStat'), playerDefStat: $('#playerDefStat'), battleEnemyLevel: $('#battleEnemyLevel'), battleEnemyReward: $('#battleEnemyReward'),
        invCount: $('#invCount'), equipGrid: $('#equipGrid'), spareList: $('#spareList'),
        forgeTarget: $('#forgeTarget'), forgeLv: $('#forgeLv'), forgeMul: $('#forgeMul'), forgeP: $('#forgeP'), forgePreview: $('#forgePreview'), forgeOnce: $('#forgeOnce'), forgeAuto: $('#forgeAuto'), forgeTableBody: $('#forgeTableBody'), forgeReset: $('#forgeReset'), forgeMsg: $('#forgeMsg'), forgeEffect: $('#forgeEffect'), forgeProtectUse: $('#forgeProtectUse'), protectCount: $('#protectCount'), enhanceCount: $('#enhanceCount'), reviveCount: $('#reviveCount'),
        pricePotion: $('#pricePotion'), priceHyper: $('#priceHyper'), priceProtect: $('#priceProtect'), priceEnhance: $('#priceEnhance'), priceBattleRes: $('#priceBattleRes'), priceStarter: $('#priceStarter'),
        invPotion: $('#invPotion'), invHyper: $('#invHyper'), invProtect: $('#invProtect'), invEnhance: $('#invEnhance'), invBattleRes: $('#invBattleRes'), shopPanel: $('#shopPanel'),
        saveCfg: $('#saveCfg'), loadCfg: $('#loadCfg'), cfgFile: $('#cfgFile'), shareLink: $('#shareLink'), points: $('#points'), gold: $('#gold'), diamonds: $('#diamonds'), drawResults: $('#drawResults'), shopMsg: $('#shopMsg'),
        adminPresetSelect: $('#adminPresetSelect'), adminPresetApply: $('#adminPresetApply'), adminPresetLoad: $('#adminPresetLoad'), adminPresetDelete: $('#adminPresetDelete'), adminPresetName: $('#adminPresetName'), adminPresetSave: $('#adminPresetSave'), presetAdminMsg: $('#presetAdminMsg'),
        adminUserSelect: $('#adminUserSelect'), adminUserStats: $('#adminUserStats'), adminGrantPoints: $('#adminGrantPoints'), adminGrantGold: $('#adminGrantGold'), adminGrantDiamonds: $('#adminGrantDiamonds'), adminGrantSubmit: $('#adminGrantSubmit'),
        globalPresetSelect: $('#globalPresetSelect'), personalPresetSelect: $('#personalPresetSelect'), applyGlobalPreset: $('#applyGlobalPreset'), applyPersonalPreset: $('#applyPersonalPreset'), personalPresetName: $('#personalPresetName'), savePersonalPreset: $('#savePersonalPreset'), presetMsg: $('#presetMsg'), toggleUserEdit: $('#toggleUserEdit'),
      };

      // Config and state
      const defaultWeights = {"SSS+":0.5, "SS+":1.5, "S+":8, "S":30, "A":60, "B":150, "C":300, "D":450};
      const cfgVersion = 'v1';

      let currentFirebaseUser = null;
      let userProfile = null;
      let profileSaveTimer = null;
      let forgeEffectTimer = null;
      const PROFILE_SAVE_DELAY = 1500;
      const USERNAME_NAMESPACE = '@gacha.local';

      const state = {
        config: {
          weights: {...defaultWeights},
          probs: {},
          pity: { enabled:false, floorTier:'S', span:90 },
          minGuarantee10: { enabled:false, tier:'A' },
          seed: '', locked: false, version: cfgVersion,
          dropRates: cloneDropRates(DEFAULT_DROP_RATES),
          goldScaling: normalizeGoldScaling(DEFAULT_GOLD_SCALING),
          shopPrices: { ...DEFAULT_SHOP_PRICES },
          potionSettings: { ...DEFAULT_POTION_SETTINGS },
          hyperPotionSettings: { ...DEFAULT_HYPER_POTION_SETTINGS },
          monsterScaling: { ...DEFAULT_MONSTER_SCALING },
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
        ui: { adminView: false, userEditEnabled: false },
        wallet: 0,
        gold: 0,
        diamonds: 0,
        presets: { global: [], personal: [], activeGlobalId: null, activeGlobalName: null },
        selectedPreset: { scope: null, id: null },
        adminUsers: [],
        timers: { manualLast: 0, autoLast: 0, uiTimer: null, autoTimer: null, autoOn: false },
        inRun: false,
        items: { potion: 0, hyperPotion: 0, protect: 0, enhance: 0, revive: 0, battleRes: 0 },
        buffs: { accelUntil: 0, accelMultiplier: 1, hyperUntil: 0, hyperMultiplier: 1 },
        combat: { useBattleRes: true, prefBattleRes: true },
      };
      state.config.shopPrices = normalizeShopPrices(state.config.shopPrices);
      state.config.potionSettings = normalizePotionSettings(state.config.potionSettings, DEFAULT_POTION_SETTINGS);
      state.config.hyperPotionSettings = normalizePotionSettings(state.config.hyperPotionSettings, DEFAULT_HYPER_POTION_SETTINGS);

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
        const counts = Object.fromEntries(TIERS.map(t=>[t,0]));
        const result = { draws: 0, counts };
        if(raw && typeof raw === 'object'){
          result.draws = clampNumber(raw.draws, 0, Number.MAX_SAFE_INTEGER, 0);
          if(raw.counts && typeof raw.counts === 'object'){
            TIERS.forEach(function(tier){
              counts[tier] = clampNumber(raw.counts[tier], 0, Number.MAX_SAFE_INTEGER, 0);
            });
          }
        }
        return result;
      }

      function sanitizeConfig(raw){
        const weights = sanitizeWeights(raw && raw.weights);
        const pityRaw = raw && raw.pity ? raw.pity : {};
        const min10Raw = raw && raw.minGuarantee10 ? raw.minGuarantee10 : {};
        const pityFloor = TIERS.includes(pityRaw.floorTier) ? pityRaw.floorTier : 'S';
        const min10Tier = TIERS.includes(min10Raw.tier) ? min10Raw.tier : 'A';
        const pitySpan = clampNumber(pityRaw.span, 1, 9999, 90);
        return {
          weights,
          probs: normalize(weights),
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
          monsterScaling: normalizeMonsterScaling(raw && raw.monsterScaling)
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

      function sanitizeItems(raw){
        const template = { potion:0, hyperPotion:0, protect:0, enhance:0, revive:0, battleRes:0 };
        const result = {...template};
        if(raw && typeof raw === 'object'){
          Object.keys(template).forEach(function(key){
            result[key] = clampNumber(raw[key], 0, Number.MAX_SAFE_INTEGER, 0);
          });
        }
        return result;
      }

      function sanitizeEnhanceConfig(raw){
        const base = defaultEnhance();
        if(raw && typeof raw === 'object'){
          if(Array.isArray(raw.multipliers)){
            base.multipliers = base.multipliers.map(function(def, idx){
              const val = raw.multipliers[idx];
              return (typeof val === 'number' && isFinite(val) && val > 0) ? val : def;
            });
          }
          if(Array.isArray(raw.probs)){
            base.probs = base.probs.map(function(def, idx){
              const val = raw.probs[idx];
              if(typeof val === 'number' && isFinite(val) && val >= 0){
                return Math.max(0, Math.min(1, val));
              }
              return def;
            });
          }
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
            Object.keys(raw).forEach(function(uid){ const info = raw[uid] || {}; const role = info.role || 'user'; const wallet = typeof info.wallet === 'number' ? info.wallet : null; const gold = typeof info.gold === 'number' ? info.gold : null; const diamonds = clampNumber(info.diamonds, 0, Number.MAX_SAFE_INTEGER, 0); const username = sanitizeUsername(info.username, uid); list.push({ uid, username, role, wallet, gold, diamonds }); });
          }
          list.sort(function(a,b){ return a.username.localeCompare(b.username, 'ko-KR', { sensitivity:'base', numeric:true }); });
          state.adminUsers = list;
          populateAdminUserSelect();
        } catch (error) {
          console.error('사용자 목록을 불러오지 못했습니다.', error);
          setAdminMsg('사용자 목록을 불러오지 못했습니다.', 'error');
        }
      }

      function populateAdminUserSelect(){ const select = els.adminUserSelect; if(!select) return; const prev = select.value; select.innerHTML=''; const placeholder = document.createElement('option'); placeholder.value=''; placeholder.textContent = state.adminUsers.length ? '사용자를 선택하세요' : '사용자 없음'; select.appendChild(placeholder); state.adminUsers.forEach(function(user){ const opt = document.createElement('option'); opt.value = user.uid; opt.textContent = `${user.username}${user.role==='admin'?' (관리자)':''}`; select.appendChild(opt); }); if(state.adminUsers.some(function(u){ return u.uid === prev; })){ select.value = prev; } updateAdminUserStats(); }

      function updateAdminUserStats(){ const select = els.adminUserSelect; const statsEl = els.adminUserStats; if(!select || !statsEl) return; const uid = select.value; if(!uid){ statsEl.textContent = ''; return; } const info = state.adminUsers.find(function(u){ return u.uid === uid; }); if(!info){ statsEl.textContent = ''; return; } const walletText = info.wallet === null ? '∞' : formatNum(info.wallet||0); const goldText = info.gold === null ? '∞' : formatNum(info.gold||0); statsEl.textContent = `포인트 ${walletText} / 골드 ${goldText} / 다이아 ${formatNum(info.diamonds||0)}`; }

      async function handleAdminGrantResources(){ if(!isAdmin()) return; const uid = els.adminUserSelect?.value || ''; if(!uid){ setAdminMsg('지급할 사용자를 선택하세요.', 'warn'); return; } const points = parseInt(els.adminGrantPoints?.value||'0', 10) || 0; const gold = parseInt(els.adminGrantGold?.value||'0', 10) || 0; const diamonds = parseInt(els.adminGrantDiamonds?.value||'0', 10) || 0; if(points===0 && gold===0 && diamonds===0){ setAdminMsg('지급할 수치를 입력하세요.', 'warn'); return; }
        try {
          const updated = await grantResourcesToUser(uid, { points, gold, diamonds });
          if(!updated){ setAdminMsg('지급할 수치를 적용할 수 없습니다.', 'warn'); return; }
          if(els.adminGrantPoints) els.adminGrantPoints.value = '0';
          if(els.adminGrantGold) els.adminGrantGold.value = '0';
          if(els.adminGrantDiamonds) els.adminGrantDiamonds.value = '0';
          await loadAdminUsers();
          setAdminMsg('지급이 완료되었습니다.', 'ok');
        } catch (error) {
          console.error('지급 처리 실패', error);
          setAdminMsg('지급 처리에 실패했습니다.', 'error');
        }
      }

      async function grantResourcesToUser(uid, deltas){ const userRef = ref(db, `users/${uid}`); const snapshot = await get(userRef); if(!snapshot.exists()) throw new Error('사용자를 찾을 수 없습니다.'); const data = snapshot.val() || {}; const updates = {}; const walletFixed = typeof data.wallet === 'number'; const goldFixed = typeof data.gold === 'number'; const diamondsFixed = typeof data.diamonds === 'number'; if(typeof deltas.points === 'number' && deltas.points !== 0 && walletFixed){ updates.wallet = Math.max(0, data.wallet + deltas.points); }
        if(typeof deltas.gold === 'number' && deltas.gold !== 0 && goldFixed){ updates.gold = Math.max(0, data.gold + deltas.gold); }
        if(typeof deltas.diamonds === 'number' && deltas.diamonds !== 0 && (diamondsFixed || data.diamonds === undefined)){ const currentDiamonds = diamondsFixed ? data.diamonds : 0; updates.diamonds = Math.max(0, currentDiamonds + deltas.diamonds); }
        if(Object.keys(updates).length === 0) return false;
        await update(userRef, updates);
        if(currentFirebaseUser && uid === currentFirebaseUser.uid){ if(Object.prototype.hasOwnProperty.call(updates, 'wallet')){ state.wallet = updates.wallet; if(userProfile) userProfile.wallet = updates.wallet; updatePointsView(); }
          if(Object.prototype.hasOwnProperty.call(updates, 'gold')){ state.gold = updates.gold; if(userProfile) userProfile.gold = updates.gold; updateGoldView(); }
          if(Object.prototype.hasOwnProperty.call(updates, 'diamonds')){ state.diamonds = updates.diamonds; if(userProfile) userProfile.diamonds = updates.diamonds; updateDiamondsView(); }
          markProfileDirty();
        }
        return true;
      }

      async function fetchGlobalConfig(){ try {
          const snapshot = await get(ref(db, GLOBAL_CONFIG_PATH));
          if(snapshot.exists()){
            const raw = snapshot.val();
            if(raw && typeof raw === 'object' && raw.config){
              return {
                config: sanitizeConfig(raw.config),
                activePresetId: typeof raw.activePresetId === 'string' ? raw.activePresetId : null,
                activePresetName: typeof raw.activePresetName === 'string' ? raw.activePresetName : null
              };
            }
            return {
              config: sanitizeConfig(raw),
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
        const m = Array(21).fill(1); // m[0]=1
        for(let lv=1; lv<=20; lv++){
          m[lv] = (lv<20)? (1 + 0.1*lv) : (1 + 20); // 요청값 반영
        }
        const p = Array(21).fill(0);
        for(let lv=1; lv<=20; lv++){
          // 1레벨 0.99 → 20레벨 0.001 선형 보간 기본값
          p[lv] = 0.99 - (lv-1) * (0.99 - 0.001) / 19;
          if(p[lv] < 0) p[lv] = 0;
        }
        return { multipliers: m, probs: p };
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
      function normalizeGoldScaling(raw){ const base = {...DEFAULT_GOLD_SCALING}; const coerce = (val)=> (typeof val==='number' && isFinite(val)) ? val : null; if(raw){ const a = coerce(raw.minLow); const b = coerce(raw.maxLow); const c = coerce(raw.minHigh); const d = coerce(raw.maxHigh); if(a!==null) base.minLow = a; if(b!==null) base.maxLow = b; if(c!==null) base.minHigh = c; if(d!==null) base.maxHigh = d; }
        if(base.maxLow < base.minLow) base.maxLow = base.minLow;
        if(base.minHigh < base.minLow) base.minHigh = base.minLow;
        if(base.maxHigh < base.minHigh) base.maxHigh = base.minHigh;
        return base;
      }
      function refreshInventoryCache(){ state.inventory = [...Object.values(state.equip).filter(Boolean), ...PART_KEYS.map(function(part){ return state.spares[part]; }).filter(Boolean)]; }
      function spareItem(part){ return state.spares[part] || null; }
      function storeSpare(item){ if(!item || !item.part) return; const part = item.part; const existing = spareItem(part); if(!existing){ state.spares[part] = item; refreshInventoryCache(); markProfileDirty(); return; }
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

      function updateWeightsInputs(){ const mode = els.mode.value; const cfg = state.config; const weights = cfg.weights; cfg.probs = normalize(weights);
        const dis = cfg.locked || !isAdmin();
        $$('.winput').forEach(inp=>{ const t = inp.dataset.tier; inp.disabled = dis; inp.value = mode==='weight' ? weights[t] : (cfg.probs[t]*100).toFixed(5); });
        for(const t of TIERS){ const td = els.weightsTable.querySelector(`[data-prob="${t}"]`); td.textContent = formatPct(cfg.probs[t]); }
        syncStats(); drawChart(); }

      function applyInputsToConfig(){ const mode = els.mode.value; const weights = {...state.config.weights}; $$('.winput').forEach(inp=>{ const t=inp.dataset.tier; const raw = (inp.value||'').replace(',', '.'); let v=parseFloat(raw); if(!(v>=0)) v=0; if(mode==='weight'){ weights[t]=v; } else { weights[t]=v/100 || 0; } }); if(mode==='percent'){ // convert percents to comparable weights (just keep as probs, re-normalize below)
          const sum = TIERS.reduce((s,t)=>s+weights[t],0); if(sum>0){ for(const t of TIERS){ weights[t] = weights[t]/sum; } } }
        state.config.weights = weights; state.config.probs = normalize(weights); if(isAdmin()) clearActivePreset(); }

      function refreshProbsAndStats(){ // update only probability cells and stats, do not overwrite input fields
        const probs = state.config.probs;
        for(const t of TIERS){ const td = els.weightsTable.querySelector(`[data-prob="${t}"]`); if(td) td.textContent = formatPct(probs[t]); }
        syncStats(); drawChart();
      }

      // UI bindings
      function bind(){ els.mode.addEventListener('change', ()=>{ updateWeightsInputs(); });
        // On typing, update config and probs without overwriting the user's current text
        els.weightsTable.addEventListener('input', (e)=>{ if(!(e.target instanceof HTMLInputElement)) return; if(state.config.locked || !isAdmin()) return; applyInputsToConfig(); refreshProbsAndStats(); markProfileDirty(); });
        // On commit (change/blur), format inputs from config
        els.weightsTable.addEventListener('change', (e)=>{ if(!(e.target instanceof HTMLInputElement)) return; if(state.config.locked || !isAdmin()) return; updateWeightsInputs(); });
        els.seed.addEventListener('input', ()=>{ state.config.seed = els.seed.value.trim(); markProfileDirty(); });
        els.lock.addEventListener('change', ()=>{ state.config.locked = els.lock.checked; updateWeightsInputs(); toggleConfigDisabled(); markProfileDirty(); });
        els.pityEnabled.addEventListener('change', ()=>{ state.config.pity.enabled = els.pityEnabled.checked; markProfileDirty(); });
        els.pityFloor.addEventListener('change', ()=>{ state.config.pity.floorTier = els.pityFloor.value; markProfileDirty(); });
        els.pitySpan.addEventListener('input', ()=>{ state.config.pity.span = Math.max(1, parseInt(els.pitySpan.value||'1')); markProfileDirty(); });
        els.g10Enabled.addEventListener('change', ()=>{ state.config.minGuarantee10.enabled = els.g10Enabled.checked; markProfileDirty(); });
        els.g10Tier.addEventListener('change', ()=>{ state.config.minGuarantee10.tier = els.g10Tier.value; markProfileDirty(); });
        els.draw1.addEventListener('click', ()=> runDraws(1));
        els.draw10.addEventListener('click', ()=> runDraws(10));
        els.draw100.addEventListener('click', ()=> runDraws(100));
        els.draw1k.addEventListener('click', ()=> runDraws(1000));
        els.draw10k.addEventListener('click', ()=> runDraws(10000));
        els.cancel.addEventListener('click', ()=>{ state.cancelFlag = true; });
        els.scope.addEventListener('change', ()=>{ syncStats(); drawChart(); });
        els.saveCfg.addEventListener('click', saveConfigFile);
        els.loadCfg.addEventListener('click', ()=> els.cfgFile.click());
        els.cfgFile.addEventListener('change', loadConfigFile);
        els.shareLink.addEventListener('click', shareLink);
        $('#exportCsv').addEventListener('click', exportCsv);
        $('#resetSession').addEventListener('click', resetSession);
        $('#resetGlobal').addEventListener('click', resetGlobal);
        // combat
        if(els.monLevel){ els.monLevel.addEventListener('input', ()=>{ setLevel(parseInt(els.monLevel.value||'1',10)); }); }
        if(els.nextMonster){ els.nextMonster.addEventListener('click', ()=>{ const rng = getRng(); const lvl = 1 + Math.floor(rng()*999); setLevel(lvl); }); }
        if(els.lvlDec){ els.lvlDec.addEventListener('click', ()=>{ const cur = parseInt(els.monLevel?.value||'1',10); setLevel(cur-1); }); }
        if(els.lvlInc){ els.lvlInc.addEventListener('click', ()=>{ const cur = parseInt(els.monLevel?.value||'1',10); setLevel(cur+1); }); }
        if(els.fightBtn){ els.fightBtn.addEventListener('click', doFight); }
        els.forgeTarget.addEventListener('change', updateForgeInfo);
        // forge
        els.forgeOnce.addEventListener('click', doForgeOnce);
        if(els.forgeAuto){ els.forgeAuto.addEventListener('click', toggleAutoForge); }
        els.forgeTableBody.addEventListener('input', onForgeTableInput);
        els.forgeReset.addEventListener('click', ()=>{ state.enhance = defaultEnhance(); buildForgeTable(); updateInventoryView(); markProfileDirty(); });
        els.forgeProtectUse.addEventListener('change', ()=>{ state.forge.protectEnabled = els.forgeProtectUse.checked; markProfileDirty(); });
        els.logoutBtn.addEventListener('click', logout);
        els.toAdmin.addEventListener('click', ()=>{ if(!isAdmin()) { alert('관리자만 접근 가능합니다.'); return; } state.ui.adminView = true; updateViewMode(); });
        els.toUser.addEventListener('click', ()=>{ state.ui.adminView = false; updateViewMode(); });
        if(els.toBattle){ els.toBattle.addEventListener('click', ()=>{ window.location.href = 'battle.html'; }); }
        if(els.toPvp){ els.toPvp.addEventListener('click', ()=>{ window.location.href = 'pvp.html'; }); }
        if(els.goBattle){ els.goBattle.addEventListener('click', ()=>{ window.location.href = 'battle.html'; }); }
        els.adminChangePw.addEventListener('click', changeAdminPassword);
        els.saveDrops.addEventListener('click', ()=>{
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
        if(els.adminUserSelect) els.adminUserSelect.addEventListener('change', updateAdminUserStats);
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

      function toggleConfigDisabled(){ const admin = isAdmin(); const disabled = state.config.locked || (!admin && !state.ui.userEditEnabled); const fields = [els.mode, els.seed, els.pityEnabled, els.pityFloor, els.pitySpan, els.g10Enabled, els.g10Tier]; fields.forEach(x=>{ if(x){ x.disabled = disabled; } }); $$('.winput').forEach(i=> i.disabled = disabled); [els.potionDuration, els.potionManualCd, els.potionAutoCd, els.potionSpeedMult, els.hyperDuration, els.hyperManualCd, els.hyperAutoCd, els.hyperSpeedMult, els.monsterBasePower, els.monsterMaxPower, els.monsterCurve, els.monsterDifficultyInput].forEach(function(el){ if(el) el.disabled = disabled; }); if(els.monsterDifficultyMinus) els.monsterDifficultyMinus.disabled = disabled; if(els.monsterDifficultyPlus) els.monsterDifficultyPlus.disabled = disabled; if(els.globalPresetSelect) els.globalPresetSelect.disabled = admin ? false : state.ui.userEditEnabled; if(els.personalPresetSelect) els.personalPresetSelect.disabled = admin ? false : state.ui.userEditEnabled; }

      // Draw engine with pity
      function drawOne(rng){ const cfg = state.config; const probs = cfg.probs; const t = chooseTier(probs, rng); applyPityCounter(t); return t; }
      function applyPityCounter(tier){ const floor = state.config.pity.floorTier; if(isAtLeast(tier, floor)){ state.pitySince = 0; } else { state.pitySince++; } }
      function drawOneWithPity(rng){ const {pity} = state.config; const probs = state.config.probs; const floor = pity.floorTier; if(pity.enabled && state.pitySince >= pity.span-1){ const allowed = TIERS.filter(t=> isAtLeast(t, floor)); const t = rescaledPick(allowed, probs, rng); state.pitySince = 0; return t; } const t = chooseTier(probs, rng); applyPityCounter(t); return t; }

      async function runDraws(n){ const rng = getRng(); state.inRun = true; state.cancelFlag = false; els.cancel.disabled = false; els.draw1.disabled = els.draw10.disabled = els.draw100.disabled = els.draw1k.disabled = els.draw10k.disabled = true; const speed = parseInt(els.speed.value||'0'); let results = []; const cfgHash = await sha256Hex(JSON.stringify(compactConfig())); const runId = state.runId++;
        const shouldRender = (n===1 || n===10 || n===100);
        const collected = [];
        const collectFn = shouldRender ? function(payload){ if(!payload) return; const partName = getPartNameByKey(payload.part) || ''; collected.push({ tier: payload.tier, part: payload.part, icon: iconForPart(payload.part), partName }); } : null;
        const batch = n >= 200; const updateEvery = n>=10000? 200 : n>=1000? 50 : n>=200? 10 : 1;
        if(n===10 && state.config.minGuarantee10.enabled){ // 10-pull with minimum guarantee
          for(let i=0;i<9;i++){ if(state.cancelFlag) break; if(!spendPoints(100)) { if(els.fightResult) els.fightResult.textContent='포인트가 부족합니다.'; break; } const t = drawOneWithPity(rng); results.push(t); applyResult(t, runId, cfgHash, {deferUI: batch, skipLog: batch, rng, onCollect: collectFn}); if(batch && ((i+1)%updateEvery===0)) { syncStats(); drawChart(); const h = latestHistory(); if(h) appendLog(h); } await maybeDelay(speed); updateProgress(results.length, n); }
          if(!state.cancelFlag){ const floor = state.config.minGuarantee10.tier; const ok = results.some(t=> isAtLeast(t, floor)); if(!ok){ const allowed = TIERS.filter(t=> isAtLeast(t, floor)); const forced = rescaledPick(allowed, state.config.probs, rng); // force one
              if(!spendPoints(100)) { if(els.fightResult) els.fightResult.textContent='포인트가 부족합니다.'; }
              else { applyResult(forced, runId, cfgHash, {deferUI: batch, skipLog: batch, rng, onCollect: collectFn}); results.push(forced); if(batch){ syncStats(); drawChart(); const h = latestHistory(); if(h) appendLog(h); } await maybeDelay(speed); updateProgress(results.length, n); }
            } else { if(!spendPoints(100)) { if(els.fightResult) els.fightResult.textContent='포인트가 부족합니다.'; }
              else { const t = drawOneWithPity(rng); results.push(t); applyResult(t, runId, cfgHash, {deferUI: batch, skipLog: batch, rng, onCollect: collectFn}); if(batch){ syncStats(); drawChart(); const h = latestHistory(); if(h) appendLog(h); } await maybeDelay(speed); updateProgress(results.length, n); } }
          }
        } else {
          for(let i=0;i<n;i++){ if(state.cancelFlag) break; if(!spendPoints(100)) { if(els.fightResult) els.fightResult.textContent='포인트가 부족합니다.'; break; } const t = drawOneWithPity(rng); results.push(t); applyResult(t, runId, cfgHash, {deferUI: batch, skipLog: batch, rng, onCollect: collectFn}); if(batch && ((i+1)%updateEvery===0)) { syncStats(); drawChart(); const h = latestHistory(); if(h) appendLog(h); } await maybeDelay(speed); updateProgress(i+1, n); }
        }
        if(batch){ syncStats(); drawChart(); updateInventoryView(); const h = latestHistory(); if(h) appendLog(h); }
        els.cancel.disabled = true; els.draw1.disabled = els.draw10.disabled = els.draw100.disabled = els.draw1k.disabled = els.draw10k.disabled = false; state.inRun = false; updateDrawButtons(); if(state.cancelFlag){ state.cancelFlag=false; }
        updateProgress(0, 100);
        if(shouldRender){ renderDrawResults(collected, n); } else { renderDrawResults([], 0); }
        markProfileDirty();
      }

      function applyResult(tier, runId, cfgHash, opts){ opts = opts||{}; const rng = opts.rng || getRng(); state.session.draws++; state.session.counts[tier]++; const now=Date.now(); const id = state.session.history.length + 1; const part = choosePart(rng); const stat = rollStatFor(tier, part, rng); const rec = {id, tier, ts: now, runId, cfgHash, part, stat}; state.session.history.push(rec);
        const item = { id: state.itemSeq++, tier, part, base: stat, lvl: 0, type: PARTS.find(p=>p.key===part).type };
        if(typeof opts.onCollect === 'function'){ opts.onCollect({ tier, part, item }); }
        applyEquipAndInventory(item);
        // global
        state.global.draws++; state.global.counts[tier]++; saveGlobal(); if(!opts.skipLog) appendLog(rec); if(!opts.deferUI){ syncStats(); drawChart(); updateInventoryView(); }
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

      function renderDrawResults(items, count){ if(!els.drawResults) return; const wrap = els.drawResults; const grid = wrap.querySelector('.draw-result-grid'); const title = wrap.querySelector('h3'); if(!items || !items.length){ wrap.style.display = 'none'; if(grid) grid.innerHTML=''; return; }
        if(title){ title.textContent = `${count}회 뽑기 결과`; }
        if(grid){ const frag = document.createDocumentFragment(); items.forEach(function(entry){ const card = document.createElement('div'); card.className = 'draw-card'; card.innerHTML = `
              <div class="tier-label tier ${entry.tier}">${entry.tier}</div>
              <div class="draw-icon">${entry.icon}</div>
              <div class="draw-part">${entry.partName}</div>`; frag.appendChild(card); }); grid.innerHTML=''; grid.appendChild(frag); }
        wrap.style.display = '';
      }

      function resetSession(){ if(!confirm('세션 통계와 로그를 초기화할까요?')) return; state.session = { draws:0, counts:Object.fromEntries(TIERS.map(t=>[t,0])), history: [] }; state.pitySince = 0; state.inventory = []; state.equip = {head:null, body:null, main:null, off:null, boots:null}; state.spares = { head:null, body:null, main:null, off:null, boots:null }; state.buffs = { accelUntil:0, accelMultiplier:1, hyperUntil:0, hyperMultiplier:1 }; els.log.innerHTML = ''; updateCombatView(); updateInventoryView(); buildForgeTargetOptions(); updateForgeInfo(); syncStats(); drawChart(); updateProgress(0, 100); markProfileDirty(); }
      function resetGlobal(){ if(!confirm('전체(전역) 통계를 초기화할까요? 이 작업은 취소할 수 없습니다.')) return; state.global = { draws:0, counts:Object.fromEntries(TIERS.map(t=>[t,0])) }; saveGlobal(); if(els.scope.value==='global'){ syncStats(); drawChart(); } }

      // Save/Load/Share
      function compactConfig(){ const {weights, probs, pity, minGuarantee10, seed, locked, version, dropRates, shopPrices, goldScaling, potionSettings, hyperPotionSettings, monsterScaling} = state.config; return {weights, probs, pity, minGuarantee10, seed, locked, version, dropRates, shopPrices, goldScaling, potionSettings, hyperPotionSettings, monsterScaling}; }
      function saveConfigFile(){ const data = JSON.stringify(compactConfig(), null, 2); const blob = new Blob([data], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gacha-config.json'; a.click(); URL.revokeObjectURL(a.href); }
      function loadConfigFile(e){ const f = e.target.files[0]; if(!f) return; const rd = new FileReader(); rd.onload = ()=>{ try{ const cfg = JSON.parse(rd.result); applyLoadedConfig(cfg); } catch(err){ alert('불러오기 실패: '+err); } }; rd.readAsText(f); e.target.value=''; }
      function applyLoadedConfig(cfg){ if(!cfg || !cfg.weights) { alert('형식이 올바르지 않습니다.'); return; } state.config.weights = {...defaultWeights, ...cfg.weights}; state.config.probs = normalize(state.config.weights); state.config.seed = cfg.seed||''; state.config.locked = !!cfg.locked; state.config.pity = cfg.pity||{enabled:false,floorTier:'S',span:90}; state.config.minGuarantee10 = cfg.minGuarantee10||{enabled:false,tier:'A'}; state.config.dropRates = migrateLegacyDropRates(cfg.dropRates); state.config.goldScaling = normalizeGoldScaling(cfg.goldScaling); state.config.shopPrices = normalizeShopPrices(cfg.shopPrices); state.config.potionSettings = normalizePotionSettings(cfg.potionSettings, DEFAULT_POTION_SETTINGS); state.config.hyperPotionSettings = normalizePotionSettings(cfg.hyperPotionSettings, DEFAULT_HYPER_POTION_SETTINGS); state.config.monsterScaling = normalizeMonsterScaling(cfg.monsterScaling); reflectConfig(); if(isAdmin()) clearActivePreset(); else clearSelectedPreset(); markProfileDirty(); }
      function shareLink(){ const cfg = compactConfig(); const json = JSON.stringify(cfg); const b = btoa(unescape(encodeURIComponent(json))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); const url = location.origin + location.pathname + '?cfg='+b; if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(function(){ alert('링크가 클립보드에 복사되었습니다.'); }).catch(function(){ prompt('아래 링크를 복사하세요', url); }); } else { prompt('아래 링크를 복사하세요', url); } }
      function readLink(){ const m = location.search.match(/[?&]cfg=([^&]+)/); if(!m) return; try{ const b = m[1].replace(/-/g,'+').replace(/_/g,'/'); const json = decodeURIComponent(escape(atob(b))); const cfg = JSON.parse(json); applyLoadedConfig(cfg); } catch(e){ console.warn('링크 파싱 실패', e); }
      }

      // Points (wallet)
      function loadWallet(){ if(isAdmin()){ state.wallet = Number.POSITIVE_INFINITY; } else { const stored = userProfile?.wallet; state.wallet = typeof stored === 'number' ? stored : 1000; } updatePointsView(); }
      function saveWallet(){ if(isAdmin()) return; if(!userProfile) return; userProfile.wallet = state.wallet; updatePointsView(); markProfileDirty(); }
      function updatePointsView(){ els.points.textContent = isAdmin()? '∞' : formatNum(state.wallet); updateDrawButtons(); updateReviveButton(); }
      function updateDrawButtons(){ if(state.inRun){ return; } const enough = isAdmin() || state.wallet >= 100; els.draw1.disabled = !enough; els.draw10.disabled = !enough; els.draw100.disabled = !enough; els.draw1k.disabled = !enough; els.draw10k.disabled = !enough; }
      function canSpend(amt){ if(isAdmin()) return true; return state.wallet >= amt; }
      function spendPoints(amt){ if(isAdmin()) return true; if(state.wallet < amt) return false; state.wallet -= amt; saveWallet(); return true; }
      function addPoints(amt){ if(isAdmin()) return; state.wallet += amt; saveWallet(); }
      function loadGold(){ if(isAdmin()){ state.gold = Number.POSITIVE_INFINITY; } else { const stored = userProfile?.gold; state.gold = (typeof stored === 'number' && isFinite(stored)) ? stored : 10000; } updateGoldView(); }
      function saveGold(){ if(isAdmin()) return; if(!userProfile) return; userProfile.gold = state.gold; updateGoldView(); markProfileDirty(); }
      function updateGoldView(){ if(els.gold){ if(isAdmin()){ els.gold.textContent = '∞'; } else { els.gold.textContent = formatNum(state.gold||0); } } updateShopButtons(); }
      function addGold(amount){ if(!(amount>0)) return; state.gold = (state.gold||0) + Math.floor(amount); saveGold(); }
      function spendGold(amount){ amount = Math.floor(amount); if(!(amount>0)) return false; if((state.gold||0) < amount) return false; state.gold -= amount; saveGold(); return true; }
      function loadDiamonds(){ if(isAdmin()){ state.diamonds = Number.POSITIVE_INFINITY; } else { const stored = userProfile?.diamonds; state.diamonds = clampNumber(stored, 0, Number.MAX_SAFE_INTEGER, 0); userProfile.diamonds = state.diamonds; } updateDiamondsView(); }
      function saveDiamonds(){ if(isAdmin()) return; if(!userProfile) return; userProfile.diamonds = state.diamonds; updateDiamondsView(); markProfileDirty(); }
      function updateDiamondsView(){ if(els.diamonds){ els.diamonds.textContent = isAdmin()? '∞' : formatNum(state.diamonds||0); } }
      function addDiamonds(amount){ amount = Math.floor(amount); if(!(amount>0)) return; if(isAdmin()) return; state.diamonds += amount; saveDiamonds(); }
      function spendDiamonds(amount){ amount = Math.floor(amount); if(!(amount>0)) return false; if(isAdmin()) return true; if((state.diamonds||0) < amount) return false; state.diamonds -= amount; saveDiamonds(); return true; }

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
      function reflectConfig(){ els.seed.value = state.config.seed||''; els.lock.checked = state.config.locked; els.pityEnabled.checked = !!(state.config.pity && state.config.pity.enabled); els.pityFloor.value = (state.config.pity && state.config.pity.floorTier) || 'S'; els.pitySpan.value = (state.config.pity && state.config.pity.span) || 90; els.g10Enabled.checked = !!(state.config.minGuarantee10 && state.config.minGuarantee10.enabled); els.g10Tier.value = (state.config.minGuarantee10 && state.config.minGuarantee10.tier) || 'A';
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
        updateWeightsInputs(); toggleConfigDisabled(); updateCombatView(); updateInventoryView(); updateShopButtons(); setShopMessage('', null); }
      function updateViewMode(){ const admin = isAdmin(); if(els.whoami){ els.whoami.textContent = state.user? `${state.user.username} (${admin? '관리자':'회원'})` : ''; }
        if(els.adminPanel){ els.adminPanel.style.display = (admin && state.ui.adminView) ? '' : 'none'; if(!admin){ state.ui.adminView = false; } }
        const configPanel = document.querySelector('#configPanel'); if(configPanel){ configPanel.style.opacity = admin? '1' : '0.92'; }
        if(els.toAdmin){ els.toAdmin.disabled = !admin; }
        document.querySelectorAll('.preset-user-row').forEach(function(node){ node.style.display = admin ? 'none' : ''; });
        if(admin){ state.ui.userEditEnabled = true; }
        updateUserEditModeView();
        toggleConfigDisabled();
        updateShopButtons();
      }
      function hydrateSession(){ loadWallet(); loadGold(); loadDiamonds(); startUiTimer(); updateItemCountsView(); updateBuffInfo(); updateReviveButton(); updateShopButtons(); setShopMessage('', null); updateViewMode(); }

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
        let data = snapshot.exists() ? (snapshot.val() || {}) : null;
        if(!data){
          const role = (fallbackName === 'admin') ? 'admin' : 'user';
          data = {
            username: fallbackName,
            role,
            wallet: role === 'admin' ? null : 1000,
            gold: role === 'admin' ? null : 10000,
            config: null,
            globalStats: null,
            equip: null,
            spares: null,
            items: null,
            enhance: null,
            session: null,
            pitySince: 0,
            combat: { useBattleRes: true, prefBattleRes: true },
            forge: { protectEnabled: false },
            presets: null,
            selectedPreset: null,
            diamonds: role === 'admin' ? null : 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          try {
            await set(profileRef, data);
            if(fallbackName){
              await set(ref(db, `usernameIndex/${fallbackName}`), uid);
            }
          } catch (error) {
            console.error('프로필 초기화에 실패했습니다.', error);
            throw error;
          }
        } else {
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
        const uid = currentFirebaseUser.uid;
        const fallbackBase = `user-${uid.slice(0, 6)}`;
        const derivedName = sanitizeUsername(userProfile.username, deriveUsernameFromUser(currentFirebaseUser) || fallbackBase) || fallbackBase;
        userProfile.username = derivedName;
        const role = userProfile.role === 'admin' || derivedName === 'admin' ? 'admin' : 'user';
        userProfile.role = role;
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
        userProfile.config = state.config;

        state.global = sanitizeGlobalStats(userProfile.globalStats);
        userProfile.globalStats = state.global;

        state.items = sanitizeItems(userProfile.items);
        userProfile.items = state.items;

        state.enhance = sanitizeEnhanceConfig(userProfile.enhance);
        userProfile.enhance = state.enhance;

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
        buildForgeTargetOptions();
        updateForgeControlsView();
        updateForgeInfo();
        updateBattleResControls();
        syncStats();
        drawChart();
      }

      function buildProfilePayload(){
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
          enhance: sanitizeEnhanceConfig(state.enhance),
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
          createdAt: userProfile?.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        if(role !== 'admin'){
          payload.wallet = clampNumber(state.wallet, 0, Number.MAX_SAFE_INTEGER, 1000);
          payload.gold = clampNumber(state.gold, 0, Number.MAX_SAFE_INTEGER, 10000);
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
        const payload = buildProfilePayload();
        if(!payload) return;
        const uid = currentFirebaseUser.uid;
        const profileRef = ref(db, `users/${uid}`);
        try {
          if(profileSaveTimer){
            clearTimeout(profileSaveTimer);
            profileSaveTimer = null;
          }
          await update(profileRef, payload);
          if(typeof payload.username === 'string'){ userProfile.username = payload.username; }
          userProfile.role = payload.role;
          if(Object.prototype.hasOwnProperty.call(payload, 'wallet')){ userProfile.wallet = payload.wallet; }
          if(Object.prototype.hasOwnProperty.call(payload, 'gold')){ userProfile.gold = payload.gold; }
          userProfile.pitySince = payload.pitySince;
          userProfile.updatedAt = payload.updatedAt;
          if(payload.createdAt && !userProfile.createdAt){ userProfile.createdAt = payload.createdAt; }
          userProfile.config = state.config;
          userProfile.globalStats = state.global;
          userProfile.items = state.items;
          userProfile.enhance = state.enhance;
          userProfile.equip = state.equip;
          userProfile.spares = state.spares;
          userProfile.session = state.session;
          userProfile.combat = { useBattleRes: state.combat.useBattleRes, prefBattleRes: state.combat.prefBattleRes };
          userProfile.forge = { protectEnabled: state.forge.protectEnabled };
          if(isAdmin()){
            await persistGlobalConfig(state.config, { activePresetId: state.presets.activeGlobalId, activePresetName: state.presets.activeGlobalName });
          }
        } catch (error) {
          console.error('프로필 저장 실패', error);
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
          await saveProfileSnapshot();
          await signOut(auth);
        } catch (error) {
          console.error('로그아웃 중 오류가 발생했습니다.', error);
        } finally {
          state.user = null;
          try { localStorage.removeItem('gachaCurrentUser_v1'); } catch(e){}
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
        refreshInventoryCache();
      }
      function totalKept(){ return Object.values(state.equip).filter(Boolean).length + PART_KEYS.reduce(function(acc, part){ return acc + (state.spares[part]?1:0); }, 0); }
      function getTotals(){ let atk=0, def=0; for(const k of ['head','body','main','off','boots']){ const it = state.equip[k]; if(!it) continue; const eff = effectiveStat(it); if(it.type==='atk') atk += eff; else def += eff; } return {atk, def}; }
      function updateWinProbView(){ const lvl = els.monLevel ? parseInt(els.monLevel.value||'1',10) : (state.combat.lastLevel || 1); state.combat.lastLevel = lvl; const {atk, def} = getTotals(); const p = winProbability(atk, def, lvl); const percentText = (p*100).toFixed(2)+'%'; if(els.winProb) els.winProb.textContent = percentText; if(els.battleWinProb) els.battleWinProb.textContent = percentText; if(els.playerHealthBar){ const playerWidth = Math.max(8, Math.min(100, p*100)); els.playerHealthBar.style.width = playerWidth + '%'; }
        if(els.enemyHealthBar){ const enemyWidth = Math.max(8, Math.min(100, 100 - (p*100))); els.enemyHealthBar.style.width = enemyWidth + '%'; }
        if(els.battleEnemyLevel) els.battleEnemyLevel.textContent = String(lvl);
        if(els.battleEnemyReward){ const estimated = calcGoldReward(lvl, ()=>0.5); els.battleEnemyReward.textContent = formatNum(estimated) + ' G'; }
      }
      function setLevel(lvl){ if(!(lvl>=1)) lvl=1; if(lvl>999) lvl=999; state.combat.lastLevel = lvl; if(els.monLevel) els.monLevel.value = String(lvl); if(els.monLevelVal) els.monLevelVal.textContent = String(lvl); if(els.battleEnemyLevel) els.battleEnemyLevel.textContent = String(lvl); if(els.battleEnemyReward){ const estimated = calcGoldReward(lvl, ()=>0.5); els.battleEnemyReward.textContent = formatNum(estimated) + ' G'; } updateWinProbView(); }
      function doFight(){ if(!els.monLevel || !els.fightResult) return; const now=Date.now(); const remain = manualCooldownRemain(now); if(remain>0){ els.fightResult.textContent = `쿨다운 ${Math.ceil(remain/1000)}초 남음`; return; } state.timers.manualLast = now; const rng = getRng(); const lvl = parseInt(els.monLevel.value||'1',10); const {atk, def} = getTotals(); const p = winProbability(atk, def, lvl); const u = rng(); const win = u < p; if(win){ const reward = levelReward(lvl); addPoints(reward); const goldGain = calcGoldReward(lvl, rng); addGold(goldGain); const gains=[]; if(maybeDropEnhance(rng, lvl)) gains.push('강화권 +1'); if(maybeDropPotion(rng, lvl)) gains.push('가속 물약 +1'); if(maybeDropHyperPotion(rng, lvl)) gains.push('초 가속 물약 +1'); if(maybeDropProtect(rng, lvl)) gains.push('보호권 +1'); if(maybeDropBattleRes(rng, lvl)) gains.push('전투부활권 +1'); updateItemCountsView(); const msg = `Lv.${lvl} 전투 승리! (+${formatNum(reward)} 포인트, +${formatNum(goldGain)} 골드` + (gains.length? ', '+gains.join(', '):'') + `, p=${(p*100).toFixed(2)}%)`; els.fightResult.textContent = msg; } else { if(consumeBattleResToken(lvl,'manual')) return; els.fightResult.textContent = `Lv.${lvl} 전투 패배... (p=${(p*100).toFixed(2)}%)`; } }

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
      function autoHuntOnce(){ if(!els.monLevel) return; const rng = getRng(); const lvl = parseInt(els.monLevel.value||'1',10); const {atk, def} = getTotals(); const p = winProbability(atk, def, lvl); const u = rng(); const win = u < p; if(win){ const reward = levelReward(lvl); addPoints(reward); const goldGain = calcGoldReward(lvl, rng); addGold(goldGain); const gains=[]; if(maybeDropEnhance(rng, lvl)) gains.push('강화권 +1'); if(maybeDropPotion(rng, lvl)) gains.push('가속 물약 +1'); if(maybeDropHyperPotion(rng, lvl)) gains.push('초 가속 물약 +1'); if(maybeDropProtect(rng, lvl)) gains.push('보호권 +1'); if(maybeDropBattleRes(rng, lvl)) gains.push('전투부활권 +1'); updateItemCountsView(); if(els.fightResult){ const msg = `자동사냥: Lv.${lvl} 승리! (+${formatNum(reward)} 포인트, +${formatNum(goldGain)} 골드` + (gains.length? ', '+gains.join(', '):'') + `, p=${(p*100).toFixed(2)}%)`; els.fightResult.textContent = msg; } } else { // penalty
          if(consumeBattleResToken(lvl, 'auto')){ return; }
          const choosePoints = rng() < 0.5; if(choosePoints && !isAdmin() && state.wallet>0){ const lost = Math.floor(state.wallet * 0.5); state.wallet -= lost; saveWallet(); updatePointsView(); if(els.fightResult) els.fightResult.textContent = `자동사냥: Lv.${lvl} 패배... 포인트 ${formatNum(lost)} 손실`; } else { const n = Math.max(1, Math.min(3, (1 + Math.floor(rng()*3)))); const removed = removeRandomItems(n, rng); const removedTxt = removed.map(itemLabel).join(', '); if(els.fightResult) els.fightResult.textContent = `자동사냥: Lv.${lvl} 패배... 장비 ${removed.length}개 손실 (${removedTxt})`; updateInventoryView(); }
          maybeAwardRevive();
        }
      }
      function maybeAwardRevive(){ if(isAdmin()) return false; var emptyEquip = totalKept()===0; var noPoints = (state.wallet||0) <= 0; if(emptyEquip && noPoints){ state.items.revive = (state.items.revive||0) + 1; addPoints(1000); updateItemCountsView(); updateReviveButton(); markProfileDirty(); if(els.fightResult) els.fightResult.textContent += ' [부활권 +1, +1000포인트 지급]'; return true; } return false; }
      function itemLabel(it){ const name = getPartNameByKey(it.part) || ''; return `${name} ${it.tier}`; }
      function removeRandomItems(k, rng){ const pool = []; PART_DEFS.forEach(function(p){ const eq = state.equip[p.key]; if(eq) pool.push({type:'equip', part:p.key, item:eq}); const spare = state.spares[p.key]; if(spare) pool.push({type:'spare', part:p.key, item:spare}); }); if(pool.length===0) return []; shuffle(pool, rng); const selected = pool.slice(0, Math.min(k, pool.length)); selected.forEach(function(entry){ if(entry.type==='equip'){ state.equip[entry.part] = null; } else if(entry.type==='spare'){ state.spares[entry.part] = null; } }); updateInventoryView(); markProfileDirty(); return selected.map(function(e){ return e.item; }); }
      function applyEquipAndInventory(item){ const part = item.part; const current = state.equip[part]; const better = !current || (effectiveStat(item)>effectiveStat(current)) || (effectiveStat(item)===effectiveStat(current) && TIER_RANK[item.tier] > TIER_RANK[current.tier]);
        if(better){ if(current){ storeSpare(current); } state.equip[part] = item; }
        else { storeSpare(item); }
        if(state.spares[part] === state.equip[part]){ state.spares[part] = null; }
        refreshInventoryCache();
        markProfileDirty(); }

      // Forge UI/model
      function showForgeEffect(kind){ const eff = els.forgeEffect; if(!eff) return; const textMap = { success:'강화 성공!', fail:'강화 실패...', protected:'보호권 발동!', destroyed:'장비 파괴...' }; if(forgeEffectTimer){ clearTimeout(forgeEffectTimer); forgeEffectTimer = null; } eff.classList.remove('success','fail','protected','destroyed','show'); // restart animation
        void eff.offsetWidth;
        if(kind === 'success'){ eff.classList.add('success'); }
        else if(kind === 'protected'){ eff.classList.add('protected'); }
        else if(kind === 'destroyed'){ eff.classList.add('destroyed'); }
        else { eff.classList.add('fail'); }
        eff.textContent = textMap[kind] || '';
        eff.classList.add('show');
        forgeEffectTimer = setTimeout(()=>{ eff.classList.remove('show','success','fail','protected','destroyed'); eff.textContent=''; forgeEffectTimer=null; }, 720);
      }

      function setAutoForgeRunning(running){ running = !!running; state.forge.autoRunning = running; if(els.forgeAuto){ els.forgeAuto.textContent = running ? '자동 강화 중지' : '자동 강화'; els.forgeAuto.classList.toggle('forge-auto-running', running); }
        if(els.forgeOnce){ els.forgeOnce.disabled = running; }
      }

      function buildForgeTable(){ const tb = els.forgeTableBody; tb.innerHTML=''; const admin = isAdmin(); for(let lv=1; lv<=20; lv++){ const tr = document.createElement('tr'); const mul = state.enhance.multipliers[lv]||1; const p = state.enhance.probs[lv]||0; tr.innerHTML = `<td>${lv}</td><td><input data-kind="mul" data-lv="${lv}" type="number" step="any" value="${mul}" style="width:100px" ${admin?'':'disabled'} /></td><td><input data-kind="p" data-lv="${lv}" type="number" step="any" min="0" max="1" value="${p}" style="width:100px" ${admin?'':'disabled'} /></td>`; tb.appendChild(tr); }
      }
      function onForgeTableInput(e){ const t = e.target; if(!(t instanceof HTMLInputElement)) return; if(!isAdmin()) return; const lv = parseInt(t.dataset.lv||'0',10); if(!lv) return; if(t.dataset.kind==='mul'){ let v = parseFloat(t.value); if(!(v>0)) v=1; state.enhance.multipliers[lv] = v; } else if(t.dataset.kind==='p'){ let v = parseFloat(t.value); if(!(v>=0)) v=0; if(v>1) v=1; state.enhance.probs[lv] = v; } updateInventoryView(); updateForgeInfo(); markProfileDirty(); }

      function performForgeAttempt(opts){ const auto = !!(opts && opts.auto); const item = currentForgeItem(); if(!item){ if(!auto) setForgeMsg('강화할 장비를 선택하세요.', 'warn'); showForgeEffect('fail'); return {status:'no-item'}; }
        const lv = item.lvl || 0; if(lv >= 20){ if(!auto) setForgeMsg('이미 최대 강화 레벨입니다.', 'warn'); showForgeEffect('fail'); return {status:'max'}; }
        const admin = isAdmin(); if(!auto){ const willProtect = state.forge.protectEnabled && (admin || (state.items.protect||0) > 0); if(!willProtect){ const ok = confirm('강화 실패 시 장비가 파괴될 수 있습니다. 계속하시겠습니까?'); if(!ok){ setForgeMsg('강화를 취소했습니다.', 'warn'); return {status:'cancelled'}; } } }
        if(!admin && !(state.items.enhance > 0)){ if(!auto) setForgeMsg('강화권이 부족합니다.', 'warn'); showForgeEffect('fail'); return {status:'no-enhance'}; }
        if(!admin){ state.items.enhance = Math.max(0, (state.items.enhance||0) - 1); updateItemCountsView(); }
        const nextLv = lv + 1; const successProb = state.enhance.probs[nextLv] || 0; const rng = getRng(); const success = rng() < successProb;
        if(success){ item.lvl = nextLv; updateInventoryView(); updateForgeInfo(); setForgeMsg(`강화 성공! Lv.${lv} → Lv.${nextLv}`, 'ok'); showForgeEffect('success'); markProfileDirty(); return {status:'success', level: nextLv}; }
        const canProtect = state.forge.protectEnabled && (admin || (state.items.protect||0) > 0);
        if(canProtect){ if(!admin){ state.items.protect = Math.max(0, (state.items.protect||0) - 1); updateItemCountsView(); }
          updateInventoryView(); updateForgeInfo(); setForgeMsg('강화 실패! 보호권이 소모되어 장비가 보호되었습니다.', 'warn'); showForgeEffect('protected'); markProfileDirty(); return {status:'protected'}; }
        removeItem(item); updateInventoryView(); updateForgeInfo(); setForgeMsg('강화 실패! 장비가 파괴되었습니다.', 'danger'); showForgeEffect('destroyed'); return {status:'destroyed'}; }

      async function runAutoForgeLoop(){ setAutoForgeRunning(true); setForgeMsg('자동 강화를 시작합니다.', 'ok'); try {
          while(state.forge.autoRunning){ const target = currentForgeItem(); if(!target){ setForgeMsg('강화할 장비가 없습니다. 자동 강화를 종료합니다.', 'warn'); break; }
            if((target.lvl||0) >= 20){ setForgeMsg('이미 최대 강화 레벨입니다.', 'warn'); break; }
            if(!isAdmin()){
              if((state.items.enhance||0) <= 0){ setForgeMsg('강화권이 더 이상 없습니다. 자동 강화를 종료합니다.', 'warn'); break; }
              if(state.forge.protectEnabled && (state.items.protect||0) <= 0){ setForgeMsg('보호권이 더 이상 없습니다. 자동 강화를 종료합니다.', 'warn'); break; }
            }
            const result = performForgeAttempt({auto:true});
            if(result.status === 'no-item' || result.status === 'no-enhance' || result.status === 'max' || result.status === 'destroyed'){ break; }
            if(!state.forge.autoRunning) break;
            await maybeDelay(600);
          }
        } finally { setAutoForgeRunning(false); }
      }

      function toggleAutoForge(){ if(state.forge.autoRunning){ setAutoForgeRunning(false); setForgeMsg('자동 강화를 중지합니다.', 'warn'); return; }
        if(!currentForgeItem()){ setForgeMsg('강화할 장비를 선택하세요.', 'warn'); showForgeEffect('fail'); return; }
        runAutoForgeLoop(); }
      function buildForgeTargetOptions(){ const sel = els.forgeTarget; const options = []; // equipped first
        PART_DEFS.forEach(function(p){ const it = state.equip[p.key]; if(it) options.push({key:`equip:${p.key}`, label:`장착-${p.name} ${it.tier} ${formatNum(effectiveStat(it))} (Lv.${it.lvl||0})`, ref: it}); });
        PART_DEFS.forEach(function(p){ const spare = state.spares[p.key]; if(spare) options.push({key:`spare:${p.key}`, label:`예비-${p.name} ${spare.tier} ${formatNum(effectiveStat(spare))} (Lv.${spare.lvl||0})`, ref: spare}); });
        const prev = sel.value; sel.innerHTML=''; options.forEach(function(o){ const opt = document.createElement('option'); opt.value = o.key; opt.textContent = o.label; sel.appendChild(opt); });
        if(options.length===0){ const opt = document.createElement('option'); opt.value=''; opt.textContent='보강할 장비 없음'; sel.appendChild(opt); }
        sel.value = options.some(function(o){ return o.key===prev; }) ? prev : sel.value;
        if(options.length===0 && state.forge.autoRunning){ setAutoForgeRunning(false); }
        updateForgeInfo(); updateForgeControlsView(); updateItemCountsView();
      }
      function updateForgeControlsView(){ els.forgeProtectUse.checked = !!state.forge.protectEnabled; }
      function updateItemCountsView(){ const potions = state.items.potion||0; const hyper = state.items.hyperPotion||0; const protects = state.items.protect||0; const enhances = state.items.enhance||0; const revive = state.items.revive||0; const br = state.items.battleRes||0;
        if(els.potionCount) els.potionCount.textContent = String(potions); if(els.usePotion) els.usePotion.disabled = !isAdmin() && !(potions>0);
        if(els.hyperPotionCount){ els.hyperPotionCount.textContent = String(hyper); }
        if(els.useHyperPotion){ els.useHyperPotion.disabled = !isAdmin() && !(hyper>0); }
        if(els.protectCount) els.protectCount.textContent = isAdmin()? '∞' : String(protects);
        if(els.enhanceCount) els.enhanceCount.textContent = String(enhances);
        if(els.reviveCount){ els.reviveCount.textContent = String(revive); }
        if(els.invPotion) els.invPotion.textContent = String(potions);
        if(els.invHyper) els.invHyper.textContent = String(hyper);
        if(els.invProtect) els.invProtect.textContent = isAdmin()? '∞' : String(protects);
        if(els.invEnhance) els.invEnhance.textContent = String(enhances);
        if(els.invBattleRes) els.invBattleRes.textContent = String(br);
        updateReviveButton(); updateShopButtons(); updateBattleResControls(); }
      function usePotion(){ if(!(state.items.potion>0) && !isAdmin()) return; if(!isAdmin()) state.items.potion--; const cfg = getPotionSettings(); const now = Date.now(); const duration = (cfg.durationMs ?? DEFAULT_POTION_SETTINGS.durationMs); const mult = cfg.speedMultiplier ?? DEFAULT_POTION_SETTINGS.speedMultiplier ?? 2; state.buffs.accelUntil = now + duration; state.buffs.accelMultiplier = Math.max(1, mult); if(state.buffs.hyperUntil > state.buffs.accelUntil){ state.buffs.accelUntil = state.buffs.hyperUntil; } updateItemCountsView(); updateBuffInfo(); markProfileDirty(); }
      function useHyperPotion(){ if(!(state.items.hyperPotion>0) && !isAdmin()) return; if(!isAdmin()) state.items.hyperPotion--; const cfg = getHyperPotionSettings(); const now = Date.now(); const duration = (cfg.durationMs ?? DEFAULT_HYPER_POTION_SETTINGS.durationMs); const mult = cfg.speedMultiplier ?? DEFAULT_HYPER_POTION_SETTINGS.speedMultiplier ?? 4; state.buffs.hyperUntil = now + duration; state.buffs.hyperMultiplier = Math.max(1, mult); state.buffs.accelUntil = Math.max(state.buffs.accelUntil, state.buffs.hyperUntil); state.buffs.accelMultiplier = Math.max(state.buffs.accelMultiplier || 1, state.buffs.hyperMultiplier); updateItemCountsView(); updateBuffInfo(); markProfileDirty(); }
      function maybeDropPotion(rng, lvl){ if(rng() < dropRateForLevel('potion', lvl)){ state.items.potion++; updateItemCountsView(); markProfileDirty(); return true; } return false; }
      function maybeDropHyperPotion(rng, lvl){ if(rng() < dropRateForLevel('hyperPotion', lvl)){ state.items.hyperPotion = (state.items.hyperPotion||0) + 1; updateItemCountsView(); markProfileDirty(); return true; } return false; }
      function maybeDropProtect(rng, lvl){ if(rng() < dropRateForLevel('protect', lvl)){ state.items.protect = (state.items.protect||0) + 1; updateItemCountsView(); markProfileDirty(); return true; } return false; }
      function maybeDropEnhance(rng, lvl){ if(rng() < dropRateForLevel('enhance', lvl)){ state.items.enhance = (state.items.enhance||0) + 1; updateItemCountsView(); markProfileDirty(); return true; } return false; }
      function maybeDropBattleRes(rng, lvl){ if(rng() < dropRateForLevel('battleRes', lvl)){ state.items.battleRes = (state.items.battleRes||0) + 1; updateItemCountsView(); markProfileDirty(); return true; } return false; }
      function calcGoldReward(level, rng){ const cfg = normalizeGoldScaling(state.config.goldScaling); const lvl = Math.max(1, Math.min(MAX_LEVEL, level||1)); const ratio = (lvl - 1) / (MAX_LEVEL - 1 || 1); const minVal = Math.round(cfg.minLow + ratio * (cfg.minHigh - cfg.minLow)); const maxVal = Math.round(cfg.maxLow + ratio * (cfg.maxHigh - cfg.maxLow)); const low = Math.min(minVal, maxVal); const high = Math.max(minVal, maxVal); const span = Math.max(0, high - low); const rand = Math.floor((rng ? rng() : Math.random()) * (span + 1)); return Math.max(1, low + rand); }
      function normalizeShopPrices(sp){ const base = {...DEFAULT_SHOP_PRICES}; const raw = {...base, ...(sp||{})}; Object.keys(base).forEach(function(k){ const v = raw[k]; raw[k] = (typeof v==='number' && v>=0) ? Math.floor(v) : base[k]; }); return raw; }
      function normalizePotionSettings(raw, defaults){
        const base = {...defaults};
        if(raw && typeof raw==='object'){
          const coerce = (val, fallback)=>{ if(typeof val==='number' && isFinite(val) && val>=0){ return Math.round(val); } return fallback; };
          const coerceMult = (val, fallback)=>{ if(typeof val==='number' && isFinite(val) && val>0){ return val; } return fallback; };
          base.durationMs = coerce(raw.durationMs, base.durationMs);
          base.manualCdMs = coerce(raw.manualCdMs, base.manualCdMs);
          base.autoCdMs = coerce(raw.autoCdMs, base.autoCdMs);
          base.speedMultiplier = coerceMult(raw.speedMultiplier, base.speedMultiplier ?? 1);
        }
        return base;
      }
      function normalizeMonsterScaling(raw){
        const base = {...DEFAULT_MONSTER_SCALING};
        const num = (val, fallback, min, max)=>{
          if(typeof val === 'number' && isFinite(val)){
            let v = val;
            if(typeof min === 'number' && v < min) v = min;
            if(typeof max === 'number' && v > max) v = max;
            return v;
          }
          return fallback;
        };
        if(raw && typeof raw === 'object'){
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
        if(share >= 0.95){
          base.attackShare = (base.attackShare / share) * 0.9;
          base.defenseShare = (base.defenseShare / share) * 0.9;
        }
        return base;
      }
      function getPotionSettings(){ const cfg = normalizePotionSettings(state.config.potionSettings, DEFAULT_POTION_SETTINGS); state.config.potionSettings = cfg; return cfg; }
      function getHyperPotionSettings(){ const cfg = normalizePotionSettings(state.config.hyperPotionSettings, DEFAULT_HYPER_POTION_SETTINGS); state.config.hyperPotionSettings = cfg; return cfg; }
      function consumeBattleResToken(lvl, context){ if(!state.combat.useBattleRes) return false; if(state.items.battleRes && state.items.battleRes > 0){ state.items.battleRes--; if(state.items.battleRes < 0) state.items.battleRes = 0; updateItemCountsView(); updateShopButtons(); if(els.fightResult){ const label = context==='auto' ? '자동사냥' : '전투'; els.fightResult.textContent = label+`: Lv.${lvl} 패배... 전투부활권이 발동되어 손실이 없습니다.`; }
        if(state.items.battleRes<=0){ state.combat.useBattleRes = false; if(state.timers.autoOn){ stopAutoTimer(); state.timers.autoOn=false; if(els.autoHuntBtn) els.autoHuntBtn.textContent='자동사냥: OFF'; if(els.fightResult){ els.fightResult.textContent += ' (전투부활권 소진으로 자동사냥이 중단되었습니다.)'; } }
        }
        updateBattleResControls();
        markProfileDirty();
        return true; }
        return false; }
      function shopPrice(type){ const prices = state.config.shopPrices || DEFAULT_SHOP_PRICES; const val = prices.hasOwnProperty(type) ? prices[type] : DEFAULT_SHOP_PRICES[type]; return Math.max(0, Math.floor(val)); }
      function onShopClick(e){ const target = e.target; if(!(target instanceof HTMLButtonElement)) return; if(!target.classList.contains('shop-buy')) return; const item = target.dataset.item; const count = parseInt(target.dataset.count||'1',10) || 1; if(item) buyShopItem(item, count); }
      function setShopMessage(msg, status){ if(!els.shopMsg) return; els.shopMsg.textContent = msg || ''; els.shopMsg.classList.remove('ok','warn','error'); if(status){ els.shopMsg.classList.add(status); } }
      function updateShopButtons(){ if(!els.shopPanel) return; if(els.pricePotion) els.pricePotion.textContent = formatNum(shopPrice('potion')); if(els.priceHyper) els.priceHyper.textContent = formatNum(shopPrice('hyperPotion')); if(els.priceProtect) els.priceProtect.textContent = formatNum(shopPrice('protect')); if(els.priceEnhance) els.priceEnhance.textContent = formatNum(shopPrice('enhance')); if(els.priceBattleRes) els.priceBattleRes.textContent = formatNum(shopPrice('battleRes')); if(els.priceStarter) els.priceStarter.textContent = formatNum(shopPrice('starterPack')); const gold = state.gold===Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : (state.gold||0); const buttons = els.shopPanel.querySelectorAll('.shop-buy'); buttons.forEach(function(btn){ const type = btn.dataset.item; const cnt = parseInt(btn.dataset.count||'1',10) || 1; const cost = shopPrice(type) * cnt; btn.disabled = gold !== Number.POSITIVE_INFINITY && cost > gold; }); }
      function grantStarterPack(count){ count = Math.max(1, parseInt(count,10)||1); const rng = getRng(); for(let n=0;n<count;n++){ PART_DEFS.forEach(function(part){ const item = { id: state.itemSeq++, tier: 'B', part: part.key, base: rollStatFor('B', part.key, rng), lvl: 0, type: part.type }; applyEquipAndInventory(item); }); } updateInventoryView(); }
      function buyShopItem(type, count){ count = Math.max(1, parseInt(count,10)||1); const totalCost = shopPrice(type) * count; if(state.gold !== Number.POSITIVE_INFINITY && (state.gold||0) < totalCost){ setShopMessage('골드가 부족합니다.', 'error'); return; } if(!spendGold(totalCost)){ setShopMessage('골드 차감에 실패했습니다.', 'error'); return; } switch(type){ case 'potion': state.items.potion = (state.items.potion||0)+count; setShopMessage(`가속 물약 ${count}개를 구매했습니다.`, 'ok'); break; case 'hyperPotion': state.items.hyperPotion = (state.items.hyperPotion||0)+count; setShopMessage(`초 가속 물약 ${count}개를 구매했습니다.`, 'ok'); break; case 'protect': state.items.protect = (state.items.protect||0)+count; setShopMessage(`보호권 ${count}개를 구매했습니다.`, 'ok'); break; case 'enhance': state.items.enhance = (state.items.enhance||0)+count; setShopMessage(`강화권 ${count}개를 구매했습니다.`, 'ok'); break; case 'battleRes': state.items.battleRes = (state.items.battleRes||0)+count; setShopMessage(`전투부활권 ${count}개를 구매했습니다.`, 'ok'); break; case 'starterPack': grantStarterPack(count); setShopMessage(`초보자 패키지를 구매했습니다! B 등급 장비 ${count*PART_KEYS.length}개를 획득했습니다.`, 'ok'); break; default: setShopMessage('알 수 없는 아이템입니다.', 'warn'); addGold(totalCost); return; }
        updateItemCountsView(); updateShopButtons(); markProfileDirty(); }
      function canClaimRevive(){ if(isAdmin()) return false; if(totalKept() !== 0) return false; if((state.wallet||0) > 100) return false; return true; }
      function updateReviveButton(){ if(!els.claimRevive) return; const show = canClaimRevive(); els.claimRevive.style.display = show ? '' : 'none'; els.claimRevive.disabled = !show; }
      function updateBattleResControls(){ if(!els.battleResUse) return; const count = state.items.battleRes||0; if(typeof state.combat.prefBattleRes === 'undefined'){ state.combat.prefBattleRes = true; }
        if(els.battleResRemain) els.battleResRemain.textContent = formatNum(count);
        if(count > 0){ state.combat.useBattleRes = !!state.combat.prefBattleRes; els.battleResUse.checked = state.combat.useBattleRes; els.battleResUse.disabled = false; }
        else { state.combat.useBattleRes = false; els.battleResUse.checked = false; els.battleResUse.disabled = true; }
      }
      function claimRevive(){ if(!canClaimRevive()){ alert('부활권을 받을 조건이 아닙니다. (장비 0개, 포인트 100 이하 필요)'); return; } state.items.revive = (state.items.revive||0) + 1; addPoints(1000); updateItemCountsView(); updateReviveButton(); markProfileDirty(); alert('부활권을 획득하고 1,000 포인트를 받았습니다!'); }
      function onSpareListClick(e){ const target = e.target; if(!(target instanceof HTMLButtonElement)) return; if(!target.classList.contains('equip-btn')) return; const part = target.dataset.part; if(!part) return; equipSpare(part); }
      function equipSpare(part){ const item = state.spares[part]; if(!item){ alert('예비 장비가 없습니다.'); return; } if(state.equip[part]){ alert('해당 부위에 이미 장비가 있습니다. 먼저 해제하거나 다른 부위를 선택하세요.'); return; } state.equip[part] = item; state.spares[part] = null; updateInventoryView(); buildForgeTargetOptions(); updateItemCountsView(); setForgeMsg('장비를 착용했습니다.', 'ok'); markProfileDirty(); }
      function currentForgeItem(){ const v = els.forgeTarget.value||''; if(!v) return null; const [kind, id] = v.split(':'); if(kind==='equip'){ return state.equip[id] || null; } if(kind==='spare'){ return state.spares[id] || null; } return null; }
      function updateForgeInfo(){ const it = currentForgeItem(); if(!it){ els.forgeLv.textContent = '0'; els.forgeMul.textContent = '1.00×'; els.forgeP.textContent = '-'; els.forgePreview.textContent='-'; els.forgeOnce.disabled = true; return; } const lv = it.lvl||0; const next = Math.min(20, lv+1); const mul = state.enhance.multipliers[lv]||1; const p = state.enhance.probs[next]||0; els.forgeLv.textContent = String(lv); els.forgeMul.textContent = mul.toFixed(2)+'×'; els.forgeP.textContent = (p*100).toFixed(2)+'%'; const cur = effectiveStat(it); const nextMul = state.enhance.multipliers[next]||mul; const after = Math.floor((it.base||0) * nextMul); els.forgePreview.textContent = `${formatNum(cur)} → ${formatNum(after)} (Lv.${next})`; els.forgeOnce.disabled = (lv>=20);
      }
      function doForgeOnce(){ if(state.forge.autoRunning){ setForgeMsg('자동 강화 중에는 수동 강화를 사용할 수 없습니다.', 'warn'); return; }
        performForgeAttempt({auto:false});
      }
      function setForgeMsg(text, kind){ els.forgeMsg.textContent = text; els.forgeMsg.classList.remove('msg-ok','msg-warn','msg-danger','muted'); if(kind==='ok'){ els.forgeMsg.classList.add('msg-ok'); } else if(kind==='warn'){ els.forgeMsg.classList.add('msg-warn'); } else if(kind==='danger'){ els.forgeMsg.classList.add('msg-danger'); } else { els.forgeMsg.classList.add('muted'); } }
      function setAdminMsg(text, tone){ if(!els.adminMsg) return; els.adminMsg.textContent = text || ''; els.adminMsg.classList.remove('msg-ok','msg-warn','msg-danger'); if(tone){ if(tone==='ok') els.adminMsg.classList.add('msg-ok'); else if(tone==='warn') els.adminMsg.classList.add('msg-warn'); else if(tone==='error') els.adminMsg.classList.add('msg-danger'); }
        setTimeout(()=>{ if(els.adminMsg.textContent===text){ els.adminMsg.textContent=''; els.adminMsg.classList.remove('msg-ok','msg-warn','msg-danger'); } }, 3000);
      }
      function setAdminPresetMsg(text, tone){ if(!els.presetAdminMsg) return; els.presetAdminMsg.textContent = text || ''; els.presetAdminMsg.classList.remove('msg-ok','msg-warn','msg-danger'); if(tone){ if(tone==='ok') els.presetAdminMsg.classList.add('msg-ok'); else if(tone==='warn') els.presetAdminMsg.classList.add('msg-warn'); else if(tone==='error') els.presetAdminMsg.classList.add('msg-danger'); }
        setTimeout(()=>{ if(els.presetAdminMsg.textContent===text){ els.presetAdminMsg.textContent=''; els.presetAdminMsg.classList.remove('msg-ok','msg-warn','msg-danger'); } }, 3000);
      }
      function setPresetMsg(text, tone){ if(!els.presetMsg) return; els.presetMsg.textContent = text || ''; els.presetMsg.classList.remove('msg-ok','msg-warn','msg-danger'); if(tone){ if(tone==='ok') els.presetMsg.classList.add('msg-ok'); else if(tone==='warn') els.presetMsg.classList.add('msg-warn'); else if(tone==='error') els.presetMsg.classList.add('msg-danger'); }
        setTimeout(()=>{ if(els.presetMsg.textContent===text){ els.presetMsg.textContent=''; els.presetMsg.classList.remove('msg-ok','msg-warn','msg-danger'); } }, 3000);
      }
      function removeItem(item){ // remove from equip or spares by reference
        PART_KEYS.forEach(function(part){ if(state.equip[part] === item){ state.equip[part] = null; }
          if(state.spares[part] === item){ state.spares[part] = null; }
        });
        refreshInventoryCache();
        buildForgeTargetOptions();
        markProfileDirty();
      }

      // Bootstrap DOM
      buildWeightsTable(); bind(); readLink(); reflectConfig(); buildForgeTable(); buildForgeTargetOptions(); updateForgeInfo();

      onAuthStateChanged(auth, async (firebaseUser)=>{
        if(profileSaveTimer){ clearTimeout(profileSaveTimer); profileSaveTimer = null; }
        if(!firebaseUser){
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
