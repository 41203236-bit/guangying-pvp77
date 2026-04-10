(function () {
  const storage = window.LightShadowStorage;
  const characters = window.LightShadowCharacterData || [];
  const firebaseApi = window.LightShadowFirebase;

  const ROOMS_PATH = 'rooms_v3';
  const BATTLE_PATH = 'battle_v3';
  const EMPTY_PLAYER = Object.freeze({
    clientId: '',
    name: '',
    faction: '',
    role: '',
    joined: false,
    ready: false
  });

  const els = {
    myCampMarkPill: document.getElementById('my-camp-mark-pill'),
    myCharacterName: document.getElementById('my-character-name'),
    myCharacterRole: document.getElementById('my-character-role'),
    myCharacterImage: document.getElementById('my-character-image'),
    myPassiveName: document.getElementById('my-passive-name'),
    myPassiveDetail: document.getElementById('my-passive-detail'),
    myActiveName: document.getElementById('my-active-name'),
    myActiveDetail: document.getElementById('my-active-detail'),

    enemyCampPill: document.getElementById('enemy-camp-pill'),
    enemyCharacterName: document.getElementById('enemy-character-name'),
    enemyCharacterRole: document.getElementById('enemy-character-role'),
    enemyPassiveName: document.getElementById('enemy-passive-name'),
    enemyPassiveDetail: document.getElementById('enemy-passive-detail'),
    enemyActiveName: document.getElementById('enemy-active-name'),
    enemyActiveDetail: document.getElementById('enemy-active-detail'),
    enemyPortraitShell: document.querySelector('.enemy-panel .portrait-shell'),

    currentPlayerName: document.getElementById('current-player-name'),
    roomCode: document.getElementById('room-code'),
    roomRoleSummary: document.getElementById('room-role-summary'),
    slotOName: document.getElementById('slot-o-name'),
    slotOMeta: document.getElementById('slot-o-meta'),
    slotOReady: document.getElementById('slot-o-ready'),
    slotXName: document.getElementById('slot-x-name'),
    slotXMeta: document.getElementById('slot-x-meta'),
    slotXReady: document.getElementById('slot-x-ready'),
    toggleReadyBtn: document.getElementById('toggle-ready-btn'),
    leaveRoomBtn: document.getElementById('leave-room-btn'),
    startBattleBtn: document.getElementById('start-battle-btn'),
    statusMessage: document.getElementById('status-message'),
    createRoomBtn: document.getElementById('create-room-btn'),
    copyRoomBtn: document.getElementById('copy-room-btn'),
    joinRoomInput: document.getElementById('join-room-input'),
    joinRoomBtn: document.getElementById('join-room-btn'),
    toast: document.getElementById('room-toast')
  };

  const state = {
    basic: null,
    roomId: '',
    myMark: '',
    unsubscribeRoom: null,
    roomData: null,
    navigatingToBattle: false,
    disconnectTasks: [],
    exitCleanupSent: false,
    isResetting: false
  };

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove('is-visible'), 2400);
  }

  function campLabel(camp) {
    if (camp === 'light') return '光';
    if (camp === 'dark') return '暗';
    return '--';
  }

  function markLabel(mark) {
    return mark || '--';
  }

  function getCharacter(id) {
    return characters.find((item) => item.id === id) || null;
  }

  function randomRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function clearLocalRoomEntry() {
    if (storage.clearRoomSession) storage.clearRoomSession();
    else {
      storage.clearCurrentRoomId();
      storage.clearCurrentRoomMark();
    }
  }

  function cancelDisconnectTasks() {
    if (!state.disconnectTasks.length) return;
    state.disconnectTasks.forEach((task) => {
      try { task.cancel(); } catch (error) {}
    });
    state.disconnectTasks = [];
  }

  function registerDisconnectTasks() {
    if (!ensureFirebaseReady() || !state.roomId || !state.myMark) return;
    cancelDisconnectTasks();
    const roomRef = firebaseApi.db.ref(`${ROOMS_PATH}/${state.roomId}`);
    const battleRef = firebaseApi.db.ref(`${BATTLE_PATH}/${state.roomId}`);
    if (state.myMark === 'O') {
      const roomDisconnect = roomRef.onDisconnect();
      roomDisconnect.remove();
      const battleDisconnect = battleRef.onDisconnect();
      battleDisconnect.remove();
      state.disconnectTasks = [roomDisconnect, battleDisconnect];
      return;
    }

    const guestDisconnect = roomRef.child('players/X').onDisconnect();
    guestDisconnect.set(cloneEmptyPlayer());
    const phaseDisconnect = roomRef.child('phase').onDisconnect();
    phaseDisconnect.set('lobby');
    const battleDisconnect = battleRef.onDisconnect();
    battleDisconnect.remove();
    state.disconnectTasks = [guestDisconnect, phaseDisconnect, battleDisconnect];
  }

  function cloneEmptyPlayer() {
    return JSON.parse(JSON.stringify(EMPTY_PLAYER));
  }

  function sendExitCleanupKeepalive() {
    if (state.exitCleanupSent || !firebaseApi || !firebaseApi.isReady || !state.roomId || !state.myMark) return;
    if (state.navigatingToBattle || state.isResetting) return;
    state.exitCleanupSent = true;
    try {
      if (state.myMark === 'O') {
        firebaseApi.restDelete(`${ROOMS_PATH}/${state.roomId}`, { keepalive: true }).catch(() => {});
        firebaseApi.restDelete(`${BATTLE_PATH}/${state.roomId}`, { keepalive: true }).catch(() => {});
        return;
      }
      firebaseApi.restPut(`${ROOMS_PATH}/${state.roomId}/players/X`, cloneEmptyPlayer(), { keepalive: true }).catch(() => {});
      firebaseApi.restPut(`${ROOMS_PATH}/${state.roomId}/phase`, 'lobby', { keepalive: true }).catch(() => {});
      firebaseApi.restDelete(`${BATTLE_PATH}/${state.roomId}`, { keepalive: true }).catch(() => {});
    } catch (error) {}
  }

  function ensureBasics() {
    const playerName = storage.getPlayerName();
    const playerCamp = storage.getPlayerCamp();
    const selectedCharacter = storage.getSelectedCharacter();
    const clientId = storage.getClientId();

    if (!playerName || !playerCamp || !selectedCharacter) {
      window.location.href = 'character.html';
      return null;
    }

    return {
      playerName,
      playerCamp,
      selectedCharacter,
      clientId,
      character: getCharacter(selectedCharacter)
    };
  }

  function getMyPlayerPayload() {
    return {
      clientId: state.basic.clientId,
      name: state.basic.playerName,
      faction: state.basic.playerCamp,
      role: state.basic.selectedCharacter,
      joined: true,
      ready: false
    };
  }

  function fillMyPanel() {
    const basic = state.basic;
    const mark = state.myMark || '--';
    els.myCampMarkPill.textContent = `我的陣營：${campLabel(basic.playerCamp)} / ${mark}`;
    els.currentPlayerName.textContent = `玩家名稱：${basic.playerName}`;

    if (!basic.character) {
      els.myCharacterName.textContent = '尚未同步角色';
      return;
    }

    els.myCharacterName.textContent = `${basic.character.name}・${basic.character.englishName}`;
    els.myCharacterRole.textContent = basic.character.role;
    els.myCharacterImage.src = basic.character.image;
    els.myCharacterImage.alt = `${basic.character.name}角色圖`;
    els.myPassiveName.textContent = `${basic.character.passive.name}（${basic.character.passive.cooldown}）`;
    els.myPassiveDetail.textContent = basic.character.passive.detail;
    els.myActiveName.textContent = basic.character.active.name;
    els.myActiveDetail.textContent = basic.character.active.detail;
  }

  function fillEnemyPlaceholder() {
    els.enemyCampPill.textContent = '對手陣營：未顯示';
    els.enemyCharacterName.textContent = '尚未同步角色';
    els.enemyCharacterRole.textContent = '對手尚未加入或尚未完成選角。';
    els.enemyPassiveName.textContent = '等待對手同步';
    els.enemyPassiveDetail.textContent = '等待對手角色後顯示。';
    els.enemyActiveName.textContent = '等待對手同步';
    els.enemyActiveDetail.textContent = '等待對手角色後顯示。';
    if (els.enemyPortraitShell) {
      els.enemyPortraitShell.classList.add('placeholder');
      els.enemyPortraitShell.innerHTML = '<div class="portrait-placeholder-copy">對手尚未選角<br>或尚未加入房間</div>';
    }
  }

  function fillEnemyPanel(enemyPlayer) {
    if (!enemyPlayer || !enemyPlayer.joined || !enemyPlayer.role) {
      fillEnemyPlaceholder();
      return;
    }

    const character = getCharacter(enemyPlayer.role);
    els.enemyCampPill.textContent = `對手陣營：${campLabel(enemyPlayer.faction)} / ${state.myMark === 'O' ? 'X' : 'O'}`;
    els.enemyCharacterName.textContent = character ? `${character.name}・${character.englishName}` : '尚未同步角色';
    els.enemyCharacterRole.textContent = character ? character.role : '對手角色資料異常';
    els.enemyPassiveName.textContent = character ? `${character.passive.name}（${character.passive.cooldown}）` : '等待對手同步';
    els.enemyPassiveDetail.textContent = character ? character.passive.detail : '等待對手角色後顯示。';
    els.enemyActiveName.textContent = character ? character.active.name : '等待對手同步';
    els.enemyActiveDetail.textContent = character ? character.active.detail : '等待對手角色後顯示。';
    if (els.enemyPortraitShell) {
      els.enemyPortraitShell.classList.remove('placeholder');
      els.enemyPortraitShell.innerHTML = `<img src="${character ? character.image : 'assets/characters/knight.png'}" alt="對手角色圖">`;
    }
  }

  function setReadyPill(el, joined, ready) {
    if (!joined) {
      el.textContent = '未加入';
      el.className = 'status-ready idle';
      return;
    }
    el.textContent = ready ? '已準備' : '未準備';
    el.className = `status-ready ${ready ? 'ready' : 'idle'}`;
  }

  function updateStatusPanel() {
    const room = state.roomData;
    els.roomCode.textContent = state.roomId || '-- ----';
    fillMyPanel();

    if (!room) {
      els.roomRoleSummary.textContent = '你的身分：尚未建立或加入房間';
      els.slotOName.textContent = '等待中';
      els.slotOMeta.textContent = '-- / --';
      setReadyPill(els.slotOReady, false, false);
      els.slotXName.textContent = '等待中';
      els.slotXMeta.textContent = '-- / --';
      setReadyPill(els.slotXReady, false, false);
      els.toggleReadyBtn.disabled = true;
      els.leaveRoomBtn.disabled = true;
      els.startBattleBtn.disabled = true;
      els.statusMessage.textContent = '請先建立房間或輸入房號加入房間。';
      fillEnemyPlaceholder();
      return;
    }

    const players = room.players || { O: cloneEmptyPlayer(), X: cloneEmptyPlayer() };
    const hostPlayer = players.O || cloneEmptyPlayer();
    const guestPlayer = players.X || cloneEmptyPlayer();

    els.slotOName.textContent = hostPlayer.joined ? hostPlayer.name : '等待中';
    els.slotOMeta.textContent = hostPlayer.joined ? `${campLabel(hostPlayer.faction)} / O | ${getCharacter(hostPlayer.role)?.name || '--'}` : '-- / --';
    setReadyPill(els.slotOReady, !!hostPlayer.joined, !!hostPlayer.ready);

    els.slotXName.textContent = guestPlayer.joined ? guestPlayer.name : '等待中';
    els.slotXMeta.textContent = guestPlayer.joined ? `${campLabel(guestPlayer.faction)} / X | ${getCharacter(guestPlayer.role)?.name || '--'}` : '-- / --';
    setReadyPill(els.slotXReady, !!guestPlayer.joined, !!guestPlayer.ready);

    const isHost = state.myMark === 'O';
    els.roomRoleSummary.textContent = isHost ? '你的身分：房主 / O' : '你的身分：房客 / X';
    els.toggleReadyBtn.disabled = false;
    els.leaveRoomBtn.disabled = false;

    const bothJoined = !!hostPlayer.joined && !!guestPlayer.joined;
    const bothReady = !!hostPlayer.ready && !!guestPlayer.ready;
    els.startBattleBtn.disabled = !(isHost && bothJoined && bothReady && room.phase === 'lobby');

    if (room.phase === 'starting') {
      els.statusMessage.textContent = '房間同步完成，正在進入 battle 初始畫面。';
    } else if (!bothJoined) {
      els.statusMessage.textContent = isHost
        ? '房間已建立，等待另一位玩家加入。'
        : '你已加入房間，等待房主確認。';
    } else if (!bothReady) {
      els.statusMessage.textContent = isHost
        ? '雙方已在房間內，等待雙方都按下準備。'
        : '雙方已在房間內，請先按準備，等待房主開始。';
    } else {
      els.statusMessage.textContent = isHost
        ? '雙方已準備，房主可以開始。'
        : '雙方已準備，等待房主開始。';
    }

    const enemyPlayer = state.myMark === 'O' ? guestPlayer : hostPlayer;
    fillEnemyPanel(enemyPlayer);
    els.toggleReadyBtn.textContent = (players[state.myMark] && players[state.myMark].ready) ? '取消準備' : '準備';
  }

  function detachRoomListener() {
    if (state.unsubscribeRoom) {
      state.unsubscribeRoom();
      state.unsubscribeRoom = null;
    }
  }

  function resetRoomState(message) {
    detachRoomListener();
    state.roomId = '';
    state.myMark = '';
    state.roomData = null;
    state.navigatingToBattle = false;
    clearLocalRoomEntry();
    cancelDisconnectTasks();
    updateStatusPanel();
    if (message) showToast(message);
  }

  function navigateToBattleIfReady(room) {
    if (state.navigatingToBattle) return;
    if (!room || room.phase !== 'starting') return;
    state.navigatingToBattle = true;
    cancelDisconnectTasks();
    if (storage.setPendingBattleEntry) storage.setPendingBattleEntry(state.roomId, state.myMark);
    window.location.href = `battle.html?room=${encodeURIComponent(state.roomId)}`;
  }

  function subscribeRoom(roomId) {
    detachRoomListener();
    const ref = firebaseApi.db.ref(`${ROOMS_PATH}/${roomId}`);
    const handler = ref.on('value', (snapshot) => {
      const room = snapshot.val();
      if (!room) {
        resetRoomState('房間已不存在或已被關閉。');
        return;
      }
      state.roomData = room;
      updateStatusPanel();
      navigateToBattleIfReady(room);
    });
    state.unsubscribeRoom = function () {
      ref.off('value', handler);
    };
  }

  function ensureFirebaseReady() {
    if (!firebaseApi || !firebaseApi.isReady) {
      showToast('Firebase 設定尚未完成，請先補上 js/firebase-config.js。');
      return false;
    }
    return true;
  }

  async function createRoom() {
    if (!ensureFirebaseReady()) return;
    const roomId = randomRoomId();
    const roomRef = firebaseApi.db.ref(`${ROOMS_PATH}/${roomId}`);
    const payload = {
      createdAt: Date.now(),
      hostSlot: 'O',
      phase: 'lobby',
      players: {
        O: getMyPlayerPayload(),
        X: cloneEmptyPlayer()
      }
    };
    await roomRef.set(payload);
    state.roomId = roomId;
    state.myMark = 'O';
    state.exitCleanupSent = false;
    storage.setCurrentRoomId(roomId);
    storage.setCurrentRoomMark('O');
    registerDisconnectTasks();
    subscribeRoom(roomId);
    showToast(`已建立房間：${roomId}`);
  }

  async function joinRoom() {
    if (!ensureFirebaseReady()) return;
    const value = els.joinRoomInput.value.trim().toUpperCase();
    if (!value) {
      showToast('請輸入房號後再加入房間。');
      return;
    }
    const roomRef = firebaseApi.db.ref(`${ROOMS_PATH}/${value}`);
    const snapshot = await roomRef.once('value');
    const room = snapshot.val();
    if (!room) {
      showToast('找不到這個房間。');
      return;
    }
    if (room.phase !== 'lobby') {
      showToast('這個房間已不在可加入狀態。');
      return;
    }
    if (room.players?.X?.joined) {
      showToast('房間已滿，無法再加入。');
      return;
    }
    await roomRef.child('players/X').set(getMyPlayerPayload());
    state.roomId = value;
    state.myMark = 'X';
    state.exitCleanupSent = false;
    storage.setCurrentRoomId(value);
    storage.setCurrentRoomMark('X');
    registerDisconnectTasks();
    subscribeRoom(value);
    showToast(`已加入房間：${value}`);
  }

  async function toggleReady() {
    if (!ensureFirebaseReady() || !state.roomId || !state.myMark) return;
    const playerRef = firebaseApi.db.ref(`${ROOMS_PATH}/${state.roomId}/players/${state.myMark}/ready`);
    const current = !!(state.roomData && state.roomData.players && state.roomData.players[state.myMark] && state.roomData.players[state.myMark].ready);
    await playerRef.set(!current);
  }

  async function leaveRoom() {
    if (!ensureFirebaseReady() || !state.roomId || !state.myMark) return;
    const roomRef = firebaseApi.db.ref(`${ROOMS_PATH}/${state.roomId}`);
    cancelDisconnectTasks();
    if (state.myMark === 'O') {
      await roomRef.remove();
      await firebaseApi.db.ref(`${BATTLE_PATH}/${state.roomId}`).remove();
      resetRoomState('已關閉房間。');
      return;
    }

    await roomRef.child('players/X').set(cloneEmptyPlayer());
    await roomRef.child('phase').set('lobby');
    resetRoomState('已離開房間。');
  }

  function buildInitialBattlePayload(roomId, roomData) {
    const players = roomData.players || {};
    return {
      roomId,
      createdAt: Date.now(),
      phase: 'in_game',
      board: Array(9).fill(null),
      players: {
        O: {
          hp: 100,
          sp: 0,
          ult: 0,
          camp: players.O?.faction || 'light',
          role: players.O?.role || 'mage',
          name: players.O?.name || '玩家一',
          shieldStacks: 0,
          darkStacks: 0,
          pieceOrder: [],
          online: true,
          mark: 'O'
        },
        X: {
          hp: 100,
          sp: 0,
          ult: 0,
          camp: players.X?.faction || 'dark',
          role: players.X?.role || 'knight',
          name: players.X?.name || '玩家二',
          shieldStacks: 0,
          darkStacks: 0,
          pieceOrder: [],
          online: true,
          mark: 'X'
        }
      },
      turn: {
        turnPlayer: 'O',
        turnNumber: 1,
        turnEndsAt: Date.now() + 20000,
        piecePlacedThisTurn: false,
        skillUsedCount: 0,
        isResolving: false
      },
      result: { winner: null, loser: null, reason: null },
      rematch: { status: 'idle', expiresAt: 0, OChoice: 'none', XChoice: 'none' }
    };
  }

  async function startBattle() {
    if (!ensureFirebaseReady() || state.myMark !== 'O' || !state.roomId || !state.roomData) return;
    const room = state.roomData;
    const hostReady = !!room.players?.O?.ready;
    const guestReady = !!room.players?.X?.ready;
    if (!hostReady || !guestReady) {
      showToast('雙方都準備完成後才能開始。');
      return;
    }

    const battlePayload = buildInitialBattlePayload(state.roomId, room);
    const updates = {};
    updates[`${BATTLE_PATH}/${state.roomId}`] = battlePayload;
    updates[`${ROOMS_PATH}/${state.roomId}/phase`] = 'starting';
    updates[`${ROOMS_PATH}/${state.roomId}/startedAt`] = Date.now();
    await firebaseApi.db.ref().update(updates);
  }

  function restoreExistingRoom() {
    const existingRoomId = storage.getCurrentRoomId();
    const existingMark = storage.getCurrentRoomMark();
    if (existingRoomId || existingMark) {
      clearLocalRoomEntry();
      showToast('已清除上一局房間入口，請重新建立或加入房間。');
    }
    updateStatusPanel();
  }

  function bindLifecycleCleanup() {
    const handleExit = () => {
      if (state.navigatingToBattle || state.isResetting) return;
      sendExitCleanupKeepalive();
      clearLocalRoomEntry();
      detachRoomListener();
      cancelDisconnectTasks();
    };
    window.addEventListener('pagehide', handleExit);
    window.addEventListener('beforeunload', handleExit);
  }

  function bindEvents() {
    els.createRoomBtn.addEventListener('click', () => createRoom().catch(() => showToast('建立房間失敗，請稍後再試。')));
    els.copyRoomBtn.addEventListener('click', async function () {
      if (!state.roomId) {
        showToast('請先建立或加入房間。');
        return;
      }
      try {
        await navigator.clipboard.writeText(state.roomId);
        showToast('房號已複製。');
      } catch (error) {
        showToast('目前無法複製房號。');
      }
    });
    els.joinRoomBtn.addEventListener('click', () => joinRoom().catch(() => showToast('加入房間失敗，請檢查房號。')));
    els.toggleReadyBtn.addEventListener('click', () => toggleReady().catch(() => showToast('更新準備狀態失敗。')));
    els.leaveRoomBtn.addEventListener('click', () => leaveRoom().catch(() => showToast('離開房間失敗。')));
    els.startBattleBtn.addEventListener('click', () => startBattle().catch(() => showToast('建立 battle 初始資料失敗。')));
  }

  function init() {
    state.basic = ensureBasics();
    if (!state.basic) return;
    fillMyPanel();
    fillEnemyPlaceholder();
    bindEvents();
    bindLifecycleCleanup();
    restoreExistingRoom();
  }

  init();
})();
