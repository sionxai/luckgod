import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  ref,
  get,
  update
} from './firebase.js';
import {
  PART_DEFS,
  PART_ICONS,
  sanitizeEquipMap,
  sanitizeItems,
  sanitizeEnhanceConfig,
  sanitizeConfig,
  sanitizePetState,
  computePlayerStats as derivePlayerStats,
  combatPower,
  formatNum,
  simulateTurnBattle
} from './combat-core.js';

const qs = (selector) => document.querySelector(selector);

const els = {
  toGacha: qs('#toGacha'),
  toBattle: qs('#toBattle'),
  logout: qs('#logoutBtn'),
  whoami: qs('#whoamiPvp'),
  pvpRecord: qs('#pvpRecord'),
  playerEquipment: qs('#playerEquipment'),
  playerStats: qs('#playerStats'),
  personalHistory: qs('#personalHistory'),
  opponentList: qs('#opponentList'),
  battleLog: qs('#battleLog'),
  versusSummary: qs('#versusSummary'),
  challengeBtn: qs('#challengeBtn'),
  rankingTable: qs('#rankingTable tbody'),
  resetPvpBtn: qs('#resetPvpData')
};

const state = {
  user: null,
  profile: null,
  config: null,
  opponents: [],
  selectedOpponent: null,
  playerStats: null,
  scoreboard: [],
  rng: Math.random
};

function formatRatio(wins, losses) {
  const total = wins + losses;
  if (total === 0) return '0%';
  return `${((wins / total) * 100).toFixed(1)}%`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('ko-KR');
}

function renderEquipment(listEl, equipment) {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!equipment || !equipment.length) {
    const empty = document.createElement('div');
    empty.textContent = '장착된 장비가 없습니다.';
    empty.className = 'muted';
    listEl.appendChild(empty);
    return;
  }
  equipment.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'tier-badge';
    div.innerHTML = `${PART_ICONS[item.part] || '🎁'} ${item.tier} Lv.${item.lvl || 0} <span class="muted">(${formatNum(item.effective)})</span>`;
    listEl.appendChild(div);
  });
}

function renderStats(tableEl, stats) {
  if (!tableEl) return;
  tableEl.innerHTML = '';
  const entries = [
    ['공격력', stats.atk],
    ['방어력', stats.def],
    ['체력', stats.hp],
    ['속도', stats.speed],
    ['크리티컬', `${stats.critRate.toFixed(1)}%`],
    ['크리티컬 데미지', `${stats.critDmg.toFixed(1)}%`],
    ['회피', `${stats.dodge.toFixed(1)}%`]
  ];
  entries.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'row';
    const left = document.createElement('span');
    left.className = 'label';
    left.textContent = label;
    const right = document.createElement('span');
    right.textContent = typeof value === 'number' ? formatNum(value) : value;
    row.appendChild(left);
    row.appendChild(right);
    tableEl.appendChild(row);
  });
}

function renderHistory(listEl, history) {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!history || !history.length) {
    const empty = document.createElement('div');
    empty.textContent = '전투 기록이 없습니다.';
    empty.className = 'muted';
    listEl.appendChild(empty);
    return;
  }
  history.slice().reverse().forEach((entry) => {
    const div = document.createElement('div');
    const tone = entry.result === 'win' ? 'ok' : entry.result === 'loss' ? 'danger' : 'warn';
    div.className = `log-line ${tone === 'ok' ? 'win' : tone === 'danger' ? 'loss' : ''}`;
    div.innerHTML = `<strong>${entry.opponentName}</strong> ${entry.result === 'win' ? '승' : entry.result === 'loss' ? '패' : '무'} · ${formatTime(entry.timestamp)}`;
    listEl.appendChild(div);
  });
}

function renderOpponents(opponents) {
  if (!els.opponentList) return;
  els.opponentList.innerHTML = '';
  if (!opponents.length) {
    const empty = document.createElement('div');
    empty.textContent = '기록된 다른 플레이어가 없습니다.';
    empty.className = 'muted';
    els.opponentList.appendChild(empty);
    return;
  }
  opponents.forEach((opp) => {
    const item = document.createElement('div');
    item.className = 'opponent-item';
    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = opp.displayName;
    const rating = document.createElement('div');
    rating.className = 'rating';
    const wins = opp.rawStats.wins || 0;
    const losses = opp.rawStats.losses || 0;
    rating.textContent = `전투력 ${formatNum(opp.power || 0)} · ${wins}승 ${losses}패`;
    info.appendChild(name);
    info.appendChild(rating);
    const btn = document.createElement('button');
    btn.textContent = '도전';
    btn.addEventListener('click', () => selectOpponent(opp.uid));
    item.appendChild(info);
    item.appendChild(btn);
    els.opponentList.appendChild(item);
  });
}

function renderRanking(board) {
  if (!els.rankingTable) return;
  els.rankingTable.innerHTML = '';
  board.forEach((entry, idx) => {
    const tr = document.createElement('tr');
    const total = entry.wins + entry.losses;
    const winRate = total ? ((entry.wins / total) * 100).toFixed(1) : '0.0';
    tr.innerHTML = `<td>${idx + 1}</td><td>${entry.displayName}</td><td>${entry.wins}승 ${entry.losses}패</td><td>${winRate}%</td>`;
    els.rankingTable.appendChild(tr);
  });
}

function selectOpponent(uid) {
  const opponent = state.opponents.find((o) => o.uid === uid);
  state.selectedOpponent = opponent || null;
  if (!opponent) {
    els.challengeBtn.disabled = true;
    els.versusSummary.innerHTML = '';
    return;
  }
  const lines = [
    `<span>상대: <strong>${opponent.displayName}</strong></span>`,
    `<span>전투력 추정: ${formatNum(opponent.power || 0)}</span>`,
    `<span>전적: ${opponent.rawStats.wins || 0}승 ${opponent.rawStats.losses || 0}패</span>`
  ];
  els.versusSummary.innerHTML = lines.join(' ');
  renderEquipment(els.playerEquipment, state.playerStats.equipment);
  renderStats(els.playerStats, state.playerStats.stats);
  els.challengeBtn.disabled = false;
  els.battleLog.innerHTML = '';
}

async function recordPvPResult(result, opponent) {
  const now = Date.now();
  const myUid = state.user.uid;
  const oppUid = opponent.uid;
  const myStats = state.profile.pvpStats || { wins: 0, losses: 0, draws: 0, history: [] };
  const oppStats = opponent.rawStats || { wins: 0, losses: 0, draws: 0, history: [] };
  let myResult = 'draw';
  let oppResult = 'draw';
  if (result.winner && result.winner.uid === myUid) {
    myResult = 'win';
    oppResult = 'loss';
    myStats.wins = (myStats.wins || 0) + 1;
    oppStats.losses = (oppStats.losses || 0) + 1;
  } else if (result.winner && result.winner.uid === oppUid) {
    myResult = 'loss';
    oppResult = 'win';
    myStats.losses = (myStats.losses || 0) + 1;
    oppStats.wins = (oppStats.wins || 0) + 1;
  } else {
    myStats.draws = (myStats.draws || 0) + 1;
    oppStats.draws = (oppStats.draws || 0) + 1;
  }
  const historyEntryMe = {
    opponent: oppUid,
    opponentName: opponent.displayName,
    result: myResult,
    turns: result.turns,
    timestamp: now
  };
  const historyEntryOpp = {
    opponent: myUid,
    opponentName: state.user.username,
    result: oppResult,
    turns: result.turns,
    timestamp: now
  };
  myStats.history = [...(myStats.history || []), historyEntryMe].slice(-20);
  oppStats.history = [...(oppStats.history || []), historyEntryOpp].slice(-20);
  state.profile.pvpStats = myStats;
  const matchId = `match_${now}`;
  const updates = {};
  updates[`pvpMatches/${matchId}`] = {
    createdAt: now,
    playerA: myUid,
    playerB: oppUid,
    winner: result.winner ? result.winner.uid : null,
    turns: result.turns,
    log: result.logs
  };
  updates[`users/${myUid}/pvpStats`] = myStats;
  updates[`users/${oppUid}/pvpStats`] = oppStats;
  await update(ref(db), updates);
  opponent.rawStats = oppStats;
}

async function challengeSelectedOpponent() {
  if (!state.selectedOpponent || !state.playerStats) return;
  els.challengeBtn.disabled = true;
  const opponent = state.selectedOpponent;
  const playerCombatant = {
    uid: state.user.uid,
    displayName: state.user.username,
    stats: state.playerStats.stats,
    combat: state.playerStats.combat || {}
  };
  const opponentCombatant = {
    uid: opponent.uid,
    displayName: opponent.displayName,
    stats: opponent.stats,
    combat: opponent.combat || {}
  };
  const battleResult = simulateTurnBattle({
    player: playerCombatant,
    opponent: opponentCombatant,
    rng: state.rng
  });
  els.battleLog.innerHTML = '';
  battleResult.logs.forEach((line) => {
    const div = document.createElement('div');
    div.className = 'log-line';
    div.textContent = line;
    els.battleLog.appendChild(div);
  });
  await recordPvPResult(battleResult, opponent);
  const opponentId = opponent.uid;
  await loadOpponents();
  selectOpponent(opponentId);
  renderPersonalStats();
  els.challengeBtn.disabled = false;
}

function renderPersonalStats() {
  if (!state.profile) return;
  const stats = state.profile.pvpStats || { wins: 0, losses: 0, draws: 0, history: [] };
  if (els.pvpRecord) {
    const wins = stats.wins || 0;
    const losses = stats.losses || 0;
    const draws = stats.draws || 0;
    els.pvpRecord.textContent = `${wins}승 ${losses}패${draws ? ` ${draws}무` : ''}`;
  }
  renderHistory(els.personalHistory, stats.history || []);
}

async function resetPvpData() {
  if (state.user?.role !== 'admin') return;
  if (!window.confirm('모든 플레이어의 PVP 전적과 랭킹을 초기화하시겠습니까?')) return;
  els.resetPvpBtn.disabled = true;
  try {
    const snapshot = await get(ref(db, 'users'));
    const data = snapshot.exists() ? snapshot.val() : {};
    const updates = { pvpMatches: null };
    Object.keys(data).forEach((uid) => {
      updates[`users/${uid}/pvpStats`] = { wins: 0, losses: 0, draws: 0, history: [] };
    });
    await update(ref(db), updates);
    state.profile.pvpStats = { wins: 0, losses: 0, draws: 0, history: [] };
    state.selectedOpponent = null;
    if (els.versusSummary) els.versusSummary.innerHTML = '';
    if (els.battleLog) els.battleLog.innerHTML = '';
    if (els.challengeBtn) els.challengeBtn.disabled = true;
    renderPersonalStats();
    await loadOpponents();
    setLoadingState('랭킹과 전적이 초기화되었습니다.');
  } catch (error) {
    console.error('PVP 초기화 실패', error);
    setLoadingState('초기화 중 오류가 발생했습니다.');
  } finally {
    els.resetPvpBtn.disabled = false;
  }
}

async function loadOpponents() {
  const snapshot = await get(ref(db, 'users'));
  const data = snapshot.exists() ? snapshot.val() : {};
  const opponents = [];
  const scoreboard = [];
  Object.entries(data).forEach(([uid, profile]) => {
    if (!profile || uid === state.user.uid) return;
    const equip = sanitizeEquipMap(profile.equip);
    const enhance = sanitizeEnhanceConfig(profile.enhance);
    const pets = sanitizePetState(profile.pets);
    const derived = derivePlayerStats(equip, enhance, {}, pets.active);
    const displayName = profile.username || `user-${uid.slice(0, 4)}`;
    const pvpStats = profile.pvpStats || { wins: 0, losses: 0, draws: 0, history: [] };
    const combatPrefs = {
      autoPotion: profile.combat?.autoPotion === true,
      autoHyper: profile.combat?.autoHyper === true
    };
    const power = combatPower(derived.stats);
    opponents.push({
      uid,
      displayName,
      stats: derived.stats,
      equipment: derived.equipment,
      power,
      rawStats: pvpStats,
      combat: combatPrefs
    });
    scoreboard.push({
      uid,
      displayName,
      wins: pvpStats.wins || 0,
      losses: pvpStats.losses || 0
    });
  });
  const myStats = state.profile?.pvpStats || { wins: 0, losses: 0 };
  scoreboard.push({
    uid: state.user.uid,
    displayName: state.user.username,
    wins: myStats.wins || 0,
    losses: myStats.losses || 0
  });
  scoreboard.sort((a, b) => {
    const scoreA = a.wins - a.losses;
    const scoreB = b.wins - b.losses;
    if (scoreA === scoreB) return (b.wins || 0) - (a.wins || 0);
    return scoreB - scoreA;
  });
  state.opponents = opponents;
  state.scoreboard = scoreboard;
  renderOpponents(opponents);
  renderRanking(scoreboard);
}

async function hydrateProfile(firebaseUser) {
  const snapshot = await get(ref(db, `users/${firebaseUser.uid}`));
  const profile = snapshot.exists() ? snapshot.val() : null;
  if (!profile) throw new Error('사용자 프로필을 찾을 수 없습니다.');
  const equip = sanitizeEquipMap(profile.equip);
  const enhance = sanitizeEnhanceConfig(profile.enhance);
  const items = sanitizeItems(profile.items);
  const pets = sanitizePetState(profile.pets);
  const config = sanitizeConfig(profile.config);
  const combatPrefs = {
    ...profile.combat,
    autoPotion: profile.combat?.autoPotion === true,
    autoHyper: profile.combat?.autoHyper === true
  };
  const derived = derivePlayerStats(equip, enhance, {}, pets.active);
  const displayName = profile.username || firebaseUser.email || firebaseUser.uid;
  state.user = {
    uid: firebaseUser.uid,
    username: displayName,
    email: firebaseUser.email || '',
    role: profile.role || 'user'
  };
  state.profile = {
    ...profile,
    equip,
    enhance,
    items,
    pets,
    combat: combatPrefs,
    pvpStats: profile.pvpStats || { wins: 0, losses: 0, draws: 0, history: [] }
  };
  state.config = config;
  state.profile.config = config;
  state.playerStats = {
    stats: derived.stats,
    equipment: derived.equipment,
    displayName,
    combat: combatPrefs
  };
  renderEquipment(els.playerEquipment, state.playerStats.equipment);
  renderStats(els.playerStats, state.playerStats.stats);
  renderPersonalStats();
  if (els.whoami) els.whoami.textContent = `${displayName}`;
  if (els.resetPvpBtn) {
    els.resetPvpBtn.style.display = state.user.role === 'admin' ? 'inline-flex' : 'none';
  }
}

function initEventListeners() {
  els.toGacha?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  els.toBattle?.addEventListener('click', () => {
    window.location.href = 'battle.html';
  });
  els.logout?.addEventListener('click', async () => {
    await signOut(auth);
  });
  els.challengeBtn?.addEventListener('click', challengeSelectedOpponent);
  els.resetPvpBtn?.addEventListener('click', resetPvpData);
}

function setLoadingState(msg) {
  if (!els.battleLog) return;
  els.battleLog.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'muted';
  div.textContent = msg;
  els.battleLog.appendChild(div);
}

onAuthStateChanged(auth, async (firebaseUser) => {
  if (!firebaseUser) {
    window.location.href = 'login.html';
    return;
  }
  try {
    setLoadingState('데이터를 불러오는 중...');
    await hydrateProfile(firebaseUser);
    await loadOpponents();
    setLoadingState('도전할 상대를 선택하세요.');
  } catch (error) {
    console.error(error);
    setLoadingState('PVP 데이터를 불러오지 못했습니다.');
  }
});

initEventListeners();
