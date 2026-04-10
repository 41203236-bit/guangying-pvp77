(function () {
  const storage = window.LightShadowStorage;
  const characters = window.LightShadowCharacterData || [];
  const firebaseApi = window.LightShadowFirebase;
  const BATTLE_PATH = 'battle_v3';
  const ROOMS_PATH = 'rooms_v3';
  const TURN_DURATION_MS = 20000;
  const TIMEOUT_POLL_MS = 500;


  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  const BASE_LINE_SP = 20;
  const CENTER_LINE_BONUS = 20;

  const els = {
    roomCode: document.getElementById('battle-room-code'),
    turnIndicator: document.getElementById('turn-indicator'),
    roundNumber: document.getElementById('battle-round-number'),
    timerValue: document.getElementById('battle-timer-value'),
    grid: document.getElementById('battle-grid'),
    boardTurnOverlay: document.getElementById('board-turn-overlay'),
    page: document.querySelector('.battle-page'),

    myIdentityBadge: document.getElementById('my-identity-badge'),
    myPortrait: document.getElementById('my-battle-portrait'),
    myName: document.getElementById('my-battle-name'),
    myRole: document.getElementById('my-battle-role'),
    myCampEffect: document.getElementById('my-camp-effect'),
    myHpPercent: document.getElementById('my-hp-percent'),
    mySpStars: document.getElementById('my-sp-stars'),
    mySpValue: document.getElementById('my-sp-value'),
    myUltStars: document.getElementById('my-ult-stars'),
    myUltValue: document.getElementById('my-ult-value'),

    enemyIdentityBadge: document.getElementById('enemy-identity-badge'),
    enemyPortrait: document.getElementById('enemy-battle-portrait'),
    enemyName: document.getElementById('enemy-battle-name'),
    enemyRole: document.getElementById('enemy-battle-role'),
    enemyCampEffect: document.getElementById('enemy-camp-effect'),
    enemyHpPercent: document.getElementById('enemy-hp-percent'),
    myFighterSide: document.getElementById('my-fighter-side'),
    enemyFighterSide: document.getElementById('enemy-fighter-side'),
    myHpBarLoss: document.getElementById('my-hp-bar-loss'),
    enemyHpBarLoss: document.getElementById('enemy-hp-bar-loss'),
    enemySpStars: document.getElementById('enemy-sp-stars'),
    enemySpValue: document.getElementById('enemy-sp-value'),
    enemyUltStars: document.getElementById('enemy-ult-stars'),
    enemyUltValue: document.getElementById('enemy-ult-value'),

    skillUsageDots: document.getElementById('skill-usage-dots'),
    endTurnButton: document.querySelector('.end-turn-button'),
    skillButtons: Array.from(document.querySelectorAll('.skill-button')),
    resultOverlay: document.getElementById('result-overlay'),
    resultTitle: document.getElementById('result-title'),
    resultQuote: document.getElementById('result-quote'),
    resultSubtitle: document.getElementById('result-subtitle'),
    resultCountdown: document.getElementById('result-countdown'),
    resultRoomButton: document.getElementById('result-room-button'),
    resultRematchButton: document.getElementById('result-rematch-button'),
    resultChoiceHint: document.getElementById('result-choice-hint')
  };

  const state = {
    roomId: '',
    unsubscribeBattle: null,
    unsubscribeRoom: null,
    selfMark: storage.getCurrentRoomMark() || storage.getPendingBattleMark() || 'O',
    disconnectTasks: [],
    battleLoaded: false,
    currentBattle: null,
    actionInFlight: false,
    timerTicker: null,
    timeoutChecker: null,
    missingBattleTimer: null,
    entryStable: false,
    entryStableTimer: null,
    opponentLeftHandled: false,
    isRedirecting: false,
    exitCleanupSent: false,
    timeoutInFlight: false,
    lineEffectTimer: null,
    shownFeedbackIds: new Set(),
    resultTimer: null
  };


  const SKILL_CONFIG = {
    atk: { cost: 20, ultGain: 25, damage: 10, sound: 'atk' },
    def: { cost: 40, ultGain: 20, sound: 'def' },
    hel: { cost: 40, ultGain: 20, heal: 8, sound: 'hel' }
  };

  const sounds = {
    tap: new Audio('sounds/tap.mp3'),
    atk: new Audio('sounds/atk.mp3'),
    def: new Audio('sounds/def.mp3'),
    hel: new Audio('sounds/hel.mp3')
  };

  function playSound(name) {
    const audio = sounds[name];
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (error) {}
  }

  function getCharacter(id) {
    return characters.find((item) => item.id === id) || null;
  }

  function campLabel(camp) {
    return camp === 'dark' ? '暗' : '光';
  }

  function identityLabel(prefix, camp, mark) {
    return `${prefix}・${campLabel(camp)} / ${mark}`;
  }

  function clearLocalRoomEntry() {
    if (storage.clearRoomSession) storage.clearRoomSession();
    else {
      storage.clearCurrentRoomId();
      storage.clearCurrentRoomMark();
    }
  }

  function clearPendingEntryOnly() {
    if (storage.clearPendingBattleEntry) storage.clearPendingBattleEntry();
  }

  function redirectToRoom() {
    if (state.isRedirecting) return;
    state.isRedirecting = true;
    stopTurnLoops();
    clearLocalRoomEntry();
    window.location.replace('room.html');
  }

  function safeAlert(message) {
    try { window.alert(message); } catch (error) {}
  }

  function handleOpponentLeft(message) {
    if (state.opponentLeftHandled || state.isRedirecting) return;
    state.opponentLeftHandled = true;
    safeAlert(message || '對手已離開，請重回菜單。');
    redirectToRoom();
  }

  function cancelDisconnectTasks() {
    if (!state.disconnectTasks.length) return;
    state.disconnectTasks.forEach((task) => {
      try { task.cancel(); } catch (error) {}
    });
    state.disconnectTasks = [];
  }

  function sendExitCleanupKeepalive() {
    if (state.exitCleanupSent || state.isRedirecting || !firebaseApi || !firebaseApi.isReady || !state.roomId || !state.selfMark) return;
    state.exitCleanupSent = true;
    try {
      if (state.selfMark === 'O') {
        firebaseApi.restDelete(`${ROOMS_PATH}/${state.roomId}`, { keepalive: true }).catch(() => {});
        firebaseApi.restDelete(`${BATTLE_PATH}/${state.roomId}`, { keepalive: true }).catch(() => {});
        return;
      }
      firebaseApi.restPut(`${ROOMS_PATH}/${state.roomId}/players/X`, { clientId: '', name: '', faction: '', role: '', joined: false, ready: false }, { keepalive: true }).catch(() => {});
      firebaseApi.restPut(`${ROOMS_PATH}/${state.roomId}/phase`, 'lobby', { keepalive: true }).catch(() => {});
      firebaseApi.restDelete(`${BATTLE_PATH}/${state.roomId}`, { keepalive: true }).catch(() => {});
    } catch (error) {}
  }

  function registerDisconnectTasks() {
    if (!firebaseApi || !firebaseApi.isReady || !state.roomId || !state.selfMark) return;
    cancelDisconnectTasks();
    const roomRef = firebaseApi.db.ref(`${ROOMS_PATH}/${state.roomId}`);
    const battleRef = firebaseApi.db.ref(`${BATTLE_PATH}/${state.roomId}`);
    if (state.selfMark === 'O') {
      const roomDisconnect = roomRef.onDisconnect();
      roomDisconnect.remove();
      const battleDisconnect = battleRef.onDisconnect();
      battleDisconnect.remove();
      state.disconnectTasks = [roomDisconnect, battleDisconnect];
      return;
    }
    const guestDisconnect = roomRef.child('players/X').onDisconnect();
    guestDisconnect.set({ clientId: '', name: '', faction: '', role: '', joined: false, ready: false });
    const phaseDisconnect = roomRef.child('phase').onDisconnect();
    phaseDisconnect.set('lobby');
    const battleDisconnect = battleRef.onDisconnect();
    battleDisconnect.remove();
    state.disconnectTasks = [guestDisconnect, phaseDisconnect, battleDisconnect];
  }

  function getCampEffect(camp, stacks) {
    if (camp === 'light') return '直排連線 +8HP';
    return `目前增傷層數：${Math.max(0, Math.min(2, stacks || 0))}`;
  }


  function getDisplayAccents(battle) {
    const oCamp = battle?.players?.O?.camp || 'light';
    const xCamp = battle?.players?.X?.camp || 'dark';
    if (oCamp === xCamp) return { O: 'gold', X: 'violet' };
    return {
      O: oCamp === 'dark' ? 'violet' : 'gold',
      X: xCamp === 'dark' ? 'violet' : 'gold'
    };
  }

  function getAccentClass(accent) {
    return accent === 'violet' ? 'accent-violet' : 'accent-gold';
  }

  function buildEnergyStars(container, value, onSrc, offSrc, className) {
    if (!container) return;
    const lit = Math.floor((value || 0) / 20);
    const remainder = (value || 0) % 20;
    container.innerHTML = '';
    for (let index = 0; index < 5; index += 1) {
      const image = document.createElement('img');
      image.className = className;
      const reversedIndex = 4 - index;
      const isOn = reversedIndex < lit;
      image.src = isOn ? onSrc : offSrc;
      if (!isOn && reversedIndex === lit && remainder > 0) image.classList.add('preview-next');
      container.appendChild(image);
    }
  }

  function buildUsageDots(container, used, total) {
    if (!container) return;
    container.innerHTML = '';
    const remaining = Math.max(0, total - used);
    for (let index = 0; index < total; index += 1) {
      const dot = document.createElement('span');
      dot.className = 'usage-dot';
      if (index < remaining) dot.classList.add('is-active');
      container.appendChild(dot);
    }
  }

  function getMyBattle() {
    return state.currentBattle || null;
  }

  function isMyTurn(battle) {
    return battle && battle.turn && battle.turn.turnPlayer === state.selfMark;
  }

  function canUseSkillWindow(battle) {
    if (!battle || !battle.turn) return false;
    if (!isMyTurn(battle)) return false;
    if (battle.turn.isResolving) return false;
    return !!battle.turn.piecePlacedThisTurn;
  }

  function updateTimerDisplay() {
    const battle = getMyBattle();
    if (!battle || !battle.turn) return;
    const endsAt = Number(battle.turn.turnEndsAt || 0);
    const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : Math.ceil(TURN_DURATION_MS / 1000);
    if (els.timerValue) els.timerValue.textContent = String(remaining);
  }

  function stopTurnLoops() {
    if (state.timerTicker) window.clearInterval(state.timerTicker);
    if (state.timeoutChecker) window.clearInterval(state.timeoutChecker);
    if (state.lineEffectTimer) window.clearTimeout(state.lineEffectTimer);
    state.timerTicker = null;
    state.timeoutChecker = null;
    state.lineEffectTimer = null;
  }

  function beginTurnLoops() {
    stopTurnLoops();
    state.timerTicker = window.setInterval(updateTimerDisplay, 250);
    state.timeoutChecker = window.setInterval(checkTimeoutAndResolve, TIMEOUT_POLL_MS);
    updateTimerDisplay();
  }

  function normalizeBoard(board) {
    if (Array.isArray(board)) {
      return Array.from({ length: 9 }, (_, index) => {
        const value = board[index];
        return value === 'O' || value === 'X' ? value : null;
      });
    }
    if (board && typeof board === 'object') {
      return Array.from({ length: 9 }, (_, index) => {
        const value = board[index] ?? board[String(index)] ?? null;
        return value === 'O' || value === 'X' ? value : null;
      });
    }
    return Array(9).fill(null);
  }
  function normalizePieceOrder(pieceOrder) {
    const raw = Array.isArray(pieceOrder)
      ? pieceOrder
      : pieceOrder && typeof pieceOrder === 'object'
        ? Object.values(pieceOrder)
        : [];
    return raw
      .map((item, index) => {
        if (typeof item === 'number') return { index: item, placedOrder: index + 1 };
        if (item && typeof item === 'object') {
          const normalizedIndex = Number(item.index);
          if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0 || normalizedIndex > 8) return null;
          return {
            index: normalizedIndex,
            placedOrder: Number(item.placedOrder || index + 1)
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.placedOrder - b.placedOrder);
  }

  function getOldestPieceIndex(battle, mark, cells) {
    const order = normalizePieceOrder(battle?.players?.[mark]?.pieceOrder);
    if (order.length !== 3) return null;
    const oldestIndex = Number(order[0]?.index);
    if (!Number.isFinite(oldestIndex) || oldestIndex < 0 || oldestIndex > 8) return null;
    return cells && cells[oldestIndex] === mark ? oldestIndex : null;
  }

  function normalizeNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function findCompletedLines(board, mark) {
    return WIN_LINES.filter((line) => line.every((index) => board[index] === mark));
  }

  function getLineSpReward(line) {
    return BASE_LINE_SP + (line.includes(4) ? CENTER_LINE_BONUS : 0);
  }

  function isVerticalLine(line) {
    const sorted = line.slice().sort((a, b) => a - b);
    return (sorted[0] === 0 && sorted[1] === 3 && sorted[2] === 6) ||
      (sorted[0] === 1 && sorted[1] === 4 && sorted[2] === 7) ||
      (sorted[0] === 2 && sorted[1] === 5 && sorted[2] === 8);
  }

  function createFeedbackEvent(targetMark, type, amount) {
    return {
      id: `${type}-${targetMark}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      targetMark,
      type,
      amount: Number(amount || 0)
    };
  }

  function getLineEffectPayload(lines, ownerMark) {
    if (!lines.length) return null;
    const firstLine = lines[0];
    if (!firstLine || firstLine.length !== 3) return null;
    return {
      indexes: firstLine.slice(),
      ownerMark: ownerMark === 'X' ? 'X' : 'O',
      expiresAt: Date.now() + 900
    };
  }

  function normalizeLineEffect(effect) {
    if (!effect || typeof effect !== 'object') return null;
    const indexes = Array.isArray(effect.indexes) ? effect.indexes.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0 && v <= 8) : [];
    if (indexes.length !== 3) return null;
    const expiresAt = Number(effect.expiresAt || 0);
    return {
      indexes,
      ownerMark: effect.ownerMark === 'X' ? 'X' : 'O',
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0
    };
  }

  function lineEffectClass(indexes) {
    const sorted = indexes.slice().sort((a, b) => a - b).join('-');
    switch (sorted) {
      case '0-1-2': return 'line-top';
      case '3-4-5': return 'line-middle';
      case '6-7-8': return 'line-bottom';
      case '0-3-6': return 'line-left';
      case '1-4-7': return 'line-center';
      case '2-5-8': return 'line-right';
      case '0-4-8': return 'line-diag-main';
      case '2-4-6': return 'line-diag-anti';
      default: return '';
    }
  }

  function removeIndexesFromPieceOrder(pieceOrder, indexesToRemove) {
    const removeSet = new Set(indexesToRemove);
    const kept = normalizePieceOrder(pieceOrder).filter((item) => !removeSet.has(Number(item.index)));
    return kept.map((item, index) => ({ index: Number(item.index), placedOrder: index + 1 }));
  }

  function applyLineResolutionToCurrent(current, board, lineOwner, lines) {
    if (!lines.length) return board;
    const clearIndexes = Array.from(new Set(lines.flat())).sort((a, b) => a - b);
    const nextBoard = board.slice();
    clearIndexes.forEach((index) => {
      nextBoard[index] = null;
    });

    const reward = lines.reduce((sum, line) => sum + getLineSpReward(line), 0);
    current.players = current.players || {};
    current.players[lineOwner] = current.players[lineOwner] || {};
    const actingPlayer = current.players[lineOwner];
    actingPlayer.sp = Math.min(100, normalizeNumber(actingPlayer.sp, 0) + reward);

    const feedbackEvents = [];
    if (reward > 0) feedbackEvents.push(createFeedbackEvent(lineOwner, 'sp', reward));
    const actingCamp = actingPlayer.camp || 'light';
    const hasVerticalLine = lines.some(isVerticalLine);
    if (hasVerticalLine) {
      if (actingCamp === 'light') {
        actingPlayer.hp = Math.min(100, normalizeNumber(actingPlayer.hp, 100) + 8);
        feedbackEvents.push(createFeedbackEvent(lineOwner, 'heal', 8));
      } else {
        actingPlayer.darkStacks = Math.min(2, normalizeNumber(actingPlayer.darkStacks, 0) + 1);
      }
    }

    ['O', 'X'].forEach((mark) => {
      if (!current.players[mark]) return;
      current.players[mark].pieceOrder = removeIndexesFromPieceOrder(current.players[mark].pieceOrder, clearIndexes);
    });

    current.lineEffect = getLineEffectPayload(lines, lineOwner);
    current.feedback = feedbackEvents.length ? {
      id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      events: feedbackEvents,
      expiresAt: Date.now() + 2200
    } : null;
    return nextBoard;
  }




  function renderLineEffect(effect, battle) {
    const shell = document.getElementById('board-shell');
    if (!shell) return;
    const previous = shell.querySelector('.board-line-effect');
    if (previous) previous.remove();
    if (state.lineEffectTimer) {
      window.clearTimeout(state.lineEffectTimer);
      state.lineEffectTimer = null;
    }
    const normalized = normalizeLineEffect(effect);
    if (!normalized) return;
    const remaining = normalized.expiresAt ? normalized.expiresAt - Date.now() : 0;
    if (remaining <= 0) return;
    const cls = lineEffectClass(normalized.indexes);
    if (!cls) return;
    const accents = getDisplayAccents(battle || getMyBattle());
    const accent = getAccentClass(accents[normalized.ownerMark] || 'gold');
    const line = document.createElement('div');
    line.className = `board-line-effect ${accent} ${cls}`;
    shell.appendChild(line);
    state.lineEffectTimer = window.setTimeout(() => {
      line.remove();
      state.lineEffectTimer = null;
    }, remaining);
  }


  function showTopFloat(targetMark, amount, kind) {
    const type = kind === 'sp' ? 'sp' : kind === 'ult' ? 'ult' : kind === 'damage' ? 'damage' : kind === 'block' ? 'block' : 'hp';
    const isSelf = targetMark === state.selfMark;
    const host = type === 'sp'
      ? (isSelf ? els.mySpStars : els.enemySpStars)
      : type === 'ult'
        ? (isSelf ? els.myUltStars : els.enemyUltStars)
        : (isSelf ? els.myHpPercent?.parentElement : els.enemyHpPercent?.parentElement);
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const float = document.createElement('div');
    float.className = `top-float-text ${type}`;
    const safeAmount = Math.abs(Number(amount || 0));
    if (type === 'damage') float.textContent = `-${safeAmount} HP`;
    else if (type === 'block') float.textContent = 'BLOCK';
    else float.textContent = `+${safeAmount} ${type.toUpperCase()}`;
    let x = rect.left + rect.width / 2;
    let y = rect.top + 10;
    if (type === 'hp') {
      x = isSelf ? rect.left + rect.width * 0.58 : rect.left + rect.width * 0.42;
      y = rect.top + 24;
    } else {
      y = rect.top - 8;
    }
    float.style.left = `${Math.round(x)}px`;
    float.style.top = `${Math.round(y)}px`;
    document.body.appendChild(float);
    window.setTimeout(() => float.remove(), 2100);
  }



  function updateHpLossOverlay(targetMark, hpValue) {
    const isSelf = targetMark === state.selfMark;
    const overlay = isSelf ? els.myHpBarLoss : els.enemyHpBarLoss;
    if (!overlay) return;
    const hp = Math.max(0, Math.min(100, normalizeNumber(hpValue, 100)));
    overlay.style.height = `${100 - hp}%`;
  }

  function pickSlashVariant(seedSource) {
    const seed = String(seedSource || '');
    let total = 0;
    for (let i = 0; i < seed.length; i += 1) total += seed.charCodeAt(i);
    return total % 3;
  }

  function triggerAttackHitEffect(targetMark, seedSource) {
    const isSelf = targetMark === state.selfMark;
    const fighterSide = isSelf ? els.myFighterSide : els.enemyFighterSide;
    const hpColumn = (isSelf ? els.myHpPercent : els.enemyHpPercent)?.closest('.hp-column');
    [fighterSide, hpColumn].forEach((node) => {
      if (!node) return;
      node.classList.remove('hit-shake');
      void node.offsetWidth;
      node.classList.add('hit-shake');
    });
    const targetRect = (fighterSide || hpColumn)?.getBoundingClientRect();
    if (!targetRect) return;
    const slash = document.createElement('div');
    const variant = pickSlashVariant(seedSource || `${targetMark}:${Date.now()}`);
    slash.className = `attack-slash-effect slash-variant-${variant}`;
    slash.style.left = `${Math.round(targetRect.left + targetRect.width * 0.5)}px`;
    slash.style.top = `${Math.round(targetRect.top + targetRect.height * 0.42)}px`;
    for (let i = 0; i < 7; i += 1) {
      const particle = document.createElement('span');
      particle.className = 'slash-particle';
      particle.style.setProperty('--p-x', `${-18 + (i * 6)}px`);
      particle.style.setProperty('--p-y', `${-6 + ((i % 3) * 5)}px`);
      particle.style.setProperty('--p-r', `${(i - 3) * 8}deg`);
      particle.style.animationDelay = `${i * 18}ms`;
      slash.appendChild(particle);
    }
    document.body.appendChild(slash);
    window.setTimeout(() => slash.remove(), 560);
  }

  function renderFeedback(feedback) {
    if (!feedback || !feedback.id || state.shownFeedbackIds.has(feedback.id)) return;
    state.shownFeedbackIds.add(feedback.id);
    const events = Array.isArray(feedback.events) ? feedback.events : [];
    events.forEach((event) => {
      if (!event) return;
      if (event.type === 'heal') showTopFloat(event.targetMark, event.amount, 'hp');
      if (event.type === 'sp') showTopFloat(event.targetMark, event.amount, 'sp');
      if (event.type === 'ult') showTopFloat(event.targetMark, event.amount, 'ult');
      if (event.type === 'damage') { showTopFloat(event.targetMark, event.amount, 'damage'); triggerAttackHitEffect(event.targetMark, `${feedback.id}:damage:${event.targetMark}`); }
      if (event.type === 'block') { showTopFloat(event.targetMark, event.amount, 'block'); triggerAttackHitEffect(event.targetMark, `${feedback.id}:damage:${event.targetMark}`); }
    });
    if (state.shownFeedbackIds.size > 20) {
      state.shownFeedbackIds = new Set(Array.from(state.shownFeedbackIds).slice(-10));
    }
  }

  function renderBoard(board, battle) {
    if (!els.grid) return;
    const currentBattle = battle || getMyBattle();
    const cells = normalizeBoard(board);
    const allowPlace = !!currentBattle && isMyTurn(currentBattle) && !currentBattle.turn.piecePlacedThisTurn && !currentBattle.turn.isResolving;
    const warningIndex = allowPlace ? getOldestPieceIndex(currentBattle, state.selfMark, cells) : null;
    const accents = getDisplayAccents(currentBattle);
    els.grid.innerHTML = '';
    for (let index = 0; index < 9; index += 1) {
      const mark = cells[index];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'grid-cell';
      if (mark === 'O') button.classList.add('mark-o', getAccentClass(accents.O));
      if (mark === 'X') button.classList.add('mark-x', getAccentClass(accents.X));
      if (!mark && allowPlace) button.classList.add('is-clickable');
      button.dataset.cellIndex = String(index);
      const glyph = document.createElement('span');
      glyph.className = 'grid-mark';
      if (warningIndex === index) glyph.classList.add('is-oldest-warning');
      glyph.textContent = mark === 'O' ? '○' : mark === 'X' ? '✕' : '';
      button.appendChild(glyph);
      const disabled = !!mark || !allowPlace;
      button.disabled = disabled;
      if (disabled) button.classList.add('is-disabled');
      els.grid.appendChild(button);
    }
  }

  function fillSide(prefix, mark, player, accent) {
    const safePlayer = player || { hp: 100, sp: 0, ult: 0, camp: 'light', role: 'mage', name: prefix === 'my' ? '你' : '對手', darkStacks: 0 };
    const character = getCharacter(safePlayer.role);
    const refs = prefix === 'my' ? {
      identityBadge: els.myIdentityBadge,
      portrait: els.myPortrait,
      name: els.myName,
      role: els.myRole,
      campEffect: els.myCampEffect,
      hpPercent: els.myHpPercent,
      spStars: els.mySpStars,
      spValue: els.mySpValue,
      ultStars: els.myUltStars,
      ultValue: els.myUltValue,
      label: '你'
    } : {
      identityBadge: els.enemyIdentityBadge,
      portrait: els.enemyPortrait,
      name: els.enemyName,
      role: els.enemyRole,
      campEffect: els.enemyCampEffect,
      hpPercent: els.enemyHpPercent,
      spStars: els.enemySpStars,
      spValue: els.enemySpValue,
      ultStars: els.enemyUltStars,
      ultValue: els.enemyUltValue,
      label: '對手'
    };

    refs.identityBadge.textContent = identityLabel(refs.label, safePlayer.camp, mark);
    refs.identityBadge.classList.remove('accent-gold', 'accent-violet');
    refs.identityBadge.classList.add(getAccentClass(accent));
    refs.portrait.closest('.portrait-frame')?.classList.remove('accent-gold', 'accent-violet');
    refs.portrait.closest('.portrait-frame')?.classList.add(getAccentClass(accent));
    refs.campEffect.closest('.info-strip')?.classList.remove('accent-gold', 'accent-violet', 'shield-one', 'shield-two');
    refs.campEffect.closest('.info-strip')?.classList.add(getAccentClass(accent));
    const hpColumn = refs.hpPercent?.closest('.hp-column');
    hpColumn?.classList.remove('shield-one', 'shield-two');
    refs.campEffect.classList.remove('shield-one', 'shield-two');
    refs.portrait.src = character ? character.image : 'assets/characters/knight.png';
    refs.name.textContent = safePlayer.name || (character ? `${character.name}・${character.englishName}` : '--');
    refs.role.textContent = character ? character.role : '等待同步角色資料';
    refs.campEffect.textContent = getCampEffect(safePlayer.camp, safePlayer.darkStacks);
    refs.hpPercent.textContent = `${safePlayer.hp}%`;
    updateHpLossOverlay(mark, safePlayer.hp);
    const shieldStacks = normalizeNumber(safePlayer.shieldStacks, 0);
    if (shieldStacks >= 2) {
      hpColumn?.classList.add('shield-two');
      refs.campEffect.classList.add('shield-two');
    } else if (shieldStacks === 1) {
      hpColumn?.classList.add('shield-one');
      refs.campEffect.classList.add('shield-one');
    }
    buildEnergyStars(refs.spStars, safePlayer.sp || 0, 'assets/ui/sp_on.png', 'assets/ui/sp_off.png', 'energy-star');
    if (refs.spValue) refs.spValue.textContent = `SP ${normalizeNumber(safePlayer.sp, 0)} / 100`;
    buildEnergyStars(refs.ultStars, safePlayer.ult || 0, 'assets/ui/ult_on.png', 'assets/ui/ult_off.png', 'ult-star');
    if (refs.ultValue) refs.ultValue.textContent = `ULT ${normalizeNumber(safePlayer.ult, 0)} / 100`;
  }

  function updateActionStates(battle) {
    const phase = battle?.phase || '';
    const locked = phase === 'GAME_OVER' || phase === 'RESULT_CHOICE';
    const myTurn = isMyTurn(battle);
    const placed = !!battle?.turn?.piecePlacedThisTurn;
    const resolving = !!battle?.turn?.isResolving;
    const canEndTurn = myTurn && placed && !resolving;
    const myPlayer = battle?.players?.[state.selfMark] || {};
    if (els.endTurnButton) {
      const disabled = locked || !canEndTurn || state.actionInFlight;
      els.endTurnButton.disabled = disabled;
      els.endTurnButton.classList.toggle('is-clickable', !disabled);
    }
    els.skillButtons.forEach((button) => {
      const skill = button.dataset.skill || '';
      let disabled = true;
      if (skill === 'atk' || skill === 'def' || skill === 'hel') {
        const cfg = SKILL_CONFIG[skill];
        disabled = locked || state.actionInFlight || !canUseSkillWindow(battle) || normalizeNumber(battle?.turn?.skillUsedCount,0) >= 3 || normalizeNumber(myPlayer.sp,0) < cfg.cost;
      } else {
        disabled = true;
      }
      button.disabled = disabled;
      button.classList.toggle('is-clickable', !disabled);
    });
  }



  function stopResultTimer() {
    if (state.resultTimer) window.clearInterval(state.resultTimer);
    state.resultTimer = null;
  }

  function winnerTextForSelf(battle) {
    const result = battle?.result || {};
    if (!result.winner || !result.loser) return null;
    return result.winner === state.selfMark ? '勝利' : '失敗';
  }


  const VICTORY_QUOTES = [
    '凡夫終究是凡夫。',
    '菜就多練，輸不起就別玩。',
    '終究只是沒有活在我那個年代的凡夫而已。'
  ];

  const DEFEAT_QUOTES = [
    '活該，輸一輩子。',
    '很抱歉，沒有讓勝利的那一方盡興。',
    '哇操，有外掛。'
  ];

  function pickResultQuote(battle, resultText) {
    const pool = resultText === '勝利' ? VICTORY_QUOTES : DEFEAT_QUOTES;
    const key = `${state.roomId || ''}:${battle?.result?.winner || ''}:${battle?.result?.loser || ''}:${resultText}`;
    let hash = 0;
    for (let index = 0; index < key.length; index += 1) hash = ((hash << 5) - hash) + key.charCodeAt(index);
    const selected = Math.abs(hash) % pool.length;
    return pool[selected];
  }

  function updateResultOverlay(battle) {
    const phase = battle?.phase || '';
    const isVisible = phase === 'GAME_OVER' || phase === 'RESULT_CHOICE';
    if (!els.resultOverlay) return;
    els.resultOverlay.classList.toggle('is-visible', isVisible);
    els.resultOverlay.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    if (els.page) els.page.classList.toggle('is-game-over', isVisible);
    if (!isVisible) {
      stopResultTimer();
      return;
    }
    const resultText = winnerTextForSelf(battle) || '本局結束';
    if (els.resultTitle) {
      els.resultTitle.textContent = resultText;
      els.resultTitle.classList.toggle('is-loss', resultText === '失敗');
    }
    if (els.resultOverlay) els.resultOverlay.classList.toggle('is-loss', resultText === '失敗');
    const resultCard = els.resultOverlay ? els.resultOverlay.querySelector('.result-card') : null;
    if (resultCard) resultCard.classList.toggle('is-loss', resultText === '失敗');
    if (els.resultQuote) els.resultQuote.textContent = pickResultQuote(battle, resultText);
    if (els.resultSubtitle) els.resultSubtitle.textContent = battle?.result?.reason ? `結束原因：${battle.result.reason}` : '本局已結束';
    const rematch = battle?.rematch || {};
    const expiresAt = Number(rematch.expiresAt || 0);
    const updateCountdown = () => {
      const seconds = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0;
      if (els.resultCountdown) els.resultCountdown.textContent = `${seconds} 秒後返回房間`;
      const myChoice = state.selfMark === 'O' ? rematch.OChoice : rematch.XChoice;
      const enemyChoice = state.selfMark === 'O' ? rematch.XChoice : rematch.OChoice;
      if (els.resultChoiceHint) {
        const myLabel = myChoice === 'rematch' ? '你已選擇重新戰鬥' : myChoice === 'room' ? '你已選擇回菜單' : '等待你的選擇';
        const enemyLabel = enemyChoice === 'rematch' ? '對手選擇重新戰鬥' : enemyChoice === 'room' ? '對手選擇回菜單' : '等待對手選擇';
        els.resultChoiceHint.textContent = `${myLabel}｜${enemyLabel}`;
      }
      const disableSelf = myChoice === 'rematch' || myChoice === 'room' || seconds <= 0;
      if (els.resultRoomButton) els.resultRoomButton.disabled = disableSelf || state.actionInFlight;
      if (els.resultRematchButton) els.resultRematchButton.disabled = disableSelf || state.actionInFlight;
    };
    stopResultTimer();
    updateCountdown();
    state.resultTimer = window.setInterval(updateCountdown, 250);
  }

  function normalizeRematch(rematch) {
    return {
      status: rematch?.status || 'idle',
      expiresAt: Number(rematch?.expiresAt || 0),
      OChoice: rematch?.OChoice || 'none',
      XChoice: rematch?.XChoice || 'none'
    };
  }

  function buildFreshBattleState(current) {
    const players = current?.players || {};
    return {
      roomId: state.roomId,
      createdAt: Date.now(),
      phase: 'IN_GAME',
      board: Array(9).fill(null),
      players: {
        O: {
          hp: 100, sp: 0, ult: 0, camp: players.O?.camp || 'light', role: players.O?.role || 'mage', name: players.O?.name || '玩家一',
          shieldStacks: 0, darkStacks: 0, pieceOrder: [], online: true, mark: 'O'
        },
        X: {
          hp: 100, sp: 0, ult: 0, camp: players.X?.camp || 'dark', role: players.X?.role || 'knight', name: players.X?.name || '玩家二',
          shieldStacks: 0, darkStacks: 0, pieceOrder: [], online: true, mark: 'X'
        }
      },
      turn: { turnPlayer: 'O', turnNumber: 1, turnEndsAt: Date.now() + TURN_DURATION_MS, piecePlacedThisTurn: false, skillUsedCount: 0, isResolving: false },
      result: { winner: null, loser: null, reason: null },
      rematch: { status: 'idle', expiresAt: 0, OChoice: 'none', XChoice: 'none' },
      feedback: null,
      lineEffect: null
    };
  }

  function applyGameOverIfNeeded(current, reason) {
    if (!current || !current.players) return;
    const oHp = normalizeNumber(current.players.O?.hp, 100);
    const xHp = normalizeNumber(current.players.X?.hp, 100);
    if (oHp > 0 && xHp > 0) return;
    let winner = null;
    let loser = null;
    if (oHp <= 0 && xHp <= 0) { winner = state.selfMark === 'O' ? 'X' : 'O'; loser = state.selfMark; }
    else if (oHp <= 0) { winner = 'X'; loser = 'O'; }
    else { winner = 'O'; loser = 'X'; }
    current.phase = 'RESULT_CHOICE';
    current.result = { winner, loser, reason: reason || 'HP歸零' };
    current.rematch = { status: 'waiting', expiresAt: Date.now() + 10000, OChoice: 'none', XChoice: 'none' };
    if (current.turn) current.turn.isResolving = false;
  }

  async function chooseResultAction(choice) {
    const battle = getMyBattle();
    if (!battle || state.actionInFlight) return;
    if (!(battle.phase === 'GAME_OVER' || battle.phase === 'RESULT_CHOICE')) return;
    state.actionInFlight = true;
    updateResultOverlay(battle);
    try {
      await transactionBattle((current) => {
        if (!current || !(current.phase === 'GAME_OVER' || current.phase === 'RESULT_CHOICE')) return current;
        const rematch = normalizeRematch(current.rematch);
        if (rematch.expiresAt && Date.now() > rematch.expiresAt) return current;
        const key = state.selfMark === 'O' ? 'OChoice' : 'XChoice';
        if (rematch[key] === choice) return current;
        rematch[key] = choice;
        current.phase = 'RESULT_CHOICE';
        if (choice === 'room' || rematch.OChoice === 'room' || rematch.XChoice === 'room') {
          rematch.status = 'return_room';
          current.rematch = rematch;
          return current;
        }
        if (rematch.OChoice === 'rematch' && rematch.XChoice === 'rematch') {
          const fresh = buildFreshBattleState(current);
          fresh.rematch = { status: 'idle', expiresAt: 0, OChoice: 'none', XChoice: 'none' };
          return fresh;
        }
        rematch.status = 'waiting';
        current.rematch = rematch;
        return current;
      });
    } catch (error) { console.error('chooseResultAction failed', error); }
    finally { state.actionInFlight = false; updateResultOverlay(getMyBattle()); }
  }

  function renderBattle(snapshotValue) {
    if (!snapshotValue) return;
    state.currentBattle = snapshotValue;
    els.roomCode.textContent = snapshotValue.roomId || state.roomId || '--';
    els.roundNumber.textContent = String(snapshotValue.turn?.turnNumber || 1);
    const turnPlayer = snapshotValue.turn?.turnPlayer || 'O';
    const myTurn = turnPlayer === state.selfMark;
    const turnCamp = snapshotValue.players?.[turnPlayer]?.camp || 'light';
    if (els.page) {
      els.page.classList.toggle('is-my-turn', myTurn);
      els.page.classList.toggle('is-waiting-turn', !myTurn);
    }
    if (els.boardTurnOverlay) {
      els.boardTurnOverlay.textContent = myTurn ? '' : '對方操作中';
      els.boardTurnOverlay.setAttribute('aria-hidden', myTurn ? 'true' : 'false');
    }
    els.turnIndicator.textContent = myTurn
      ? `目前回合：${campLabel(turnCamp)} / ${turnPlayer}（輪到你）`
      : `目前回合：${campLabel(turnCamp)} / ${turnPlayer}（輪到對手）`;

    const myMark = state.selfMark || 'O';
    const enemyMark = myMark === 'O' ? 'X' : 'O';
    const accents = getDisplayAccents(snapshotValue);
    fillSide('my', myMark, snapshotValue.players?.[myMark], accents[myMark]);
    fillSide('enemy', enemyMark, snapshotValue.players?.[enemyMark], accents[enemyMark]);
    buildUsageDots(els.skillUsageDots, snapshotValue.turn?.skillUsedCount || 0, 3);
    updateActionStates(snapshotValue);
    renderLineEffect(snapshotValue.lineEffect, snapshotValue);
    renderFeedback(snapshotValue.feedback);
    renderBoard(snapshotValue.board, snapshotValue);
    updateResultOverlay(snapshotValue);
    updateTimerDisplay();
  }

  function subscribeRoomGuard() {
    const ref = firebaseApi.db.ref(`${ROOMS_PATH}/${state.roomId}`);
    const handler = ref.on('value', (snapshot) => {
      const room = snapshot.val();
      const enemyMark = state.selfMark === 'O' ? 'X' : 'O';
      if (!room) {
        if (state.entryStable) handleOpponentLeft('對手已離開，請重回菜單。');
        else redirectToRoom();
        return;
      }
      const player = room.players?.[state.selfMark];
      if (!player || !player.joined) {
        redirectToRoom();
        return;
      }
      const enemy = room.players?.[enemyMark];
      if (state.entryStable && (!enemy || !enemy.joined)) {
        handleOpponentLeft('對手已離開，請重回菜單。');
      }
    });
    state.unsubscribeRoom = () => ref.off('value', handler);
  }

  function bindLifecycleCleanup() {
    const handleExit = () => {
      if (state.unsubscribeBattle) state.unsubscribeBattle();
      if (state.unsubscribeRoom) state.unsubscribeRoom();
      if (state.entryStableTimer) window.clearTimeout(state.entryStableTimer);
      if (state.missingBattleTimer) window.clearTimeout(state.missingBattleTimer);
      stopTurnLoops();
      sendExitCleanupKeepalive();
      cancelDisconnectTasks();
      clearLocalRoomEntry();
    };
    window.addEventListener('pagehide', handleExit);
    window.addEventListener('beforeunload', handleExit);
  }

  function transactionBattle(mutator) {
    const ref = firebaseApi.db.ref(`${BATTLE_PATH}/${state.roomId}`);
    return new Promise((resolve, reject) => {
      ref.transaction((current) => mutator(current), (error, committed, snapshot) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ committed, snapshot: snapshot ? snapshot.val() : null });
      }, false);
    });
  }

  function createNextTurnState(previousTurn, currentBattle) {
    const nextPlayer = previousTurn.turnPlayer === 'O' ? 'X' : 'O';
    if (currentBattle && currentBattle.players && currentBattle.players[nextPlayer]) {
      currentBattle.players[nextPlayer].shieldStacks = 0;
    }
    return {
      turnPlayer: nextPlayer,
      turnNumber: Number(previousTurn.turnNumber || 1) + 1,
      turnEndsAt: Date.now() + TURN_DURATION_MS,
      piecePlacedThisTurn: false,
      skillUsedCount: 0,
      isResolving: false
    };
  }

  function createSkillFeedback(targetMark, kind, amount) {
    const events = [createFeedbackEvent(targetMark, kind, amount)];
    return {
      id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      events,
      expiresAt: Date.now() + 2200
    };
  }

  function spendUltGain(player, amount) {
    player.ult = Math.min(100, normalizeNumber(player.ult, 0) + amount);
  }


  function canUseUltimateNow(player, battleTurn) {
    if (!player || !battleTurn) return false;
    if (!battleTurn.piecePlacedThisTurn) return false;
    if (battleTurn.isResolving) return false;
    return normalizeNumber(player.ult, 0) >= 100;
  }

  function canUseAnyPostPlaceAction(current, actorMark) {
    if (!current || !current.turn || !current.players) return false;
    const actor = current.players[actorMark];
    if (!actor) return false;
    if (current.turn.turnPlayer !== actorMark) return false;
    if (!current.turn.piecePlacedThisTurn) return false;
    if (current.turn.isResolving) return false;
    const used = normalizeNumber(current.turn.skillUsedCount, 0);
    const sp = normalizeNumber(actor.sp, 0);
    const canUseCommon = used < 3 && (
      sp >= SKILL_CONFIG.atk.cost ||
      sp >= SKILL_CONFIG.def.cost ||
      sp >= SKILL_CONFIG.hel.cost
    );
    if (canUseCommon) return true;
    return canUseUltimateNow(actor, current.turn);
  }


  function resolveDarkStackAttackBonus(current, actor, target) {
    const stacks = Math.max(0, Math.min(2, normalizeNumber(actor?.darkStacks, 0)));
    if (stacks <= 0) return 0;
    if (stacks === 1) return 4;
    const seedParts = [
      state.roomId || '',
      current?.turn?.turnNumber || 0,
      current?.turn?.skillUsedCount || 0,
      actor?.hp || 0,
      actor?.sp || 0,
      target?.hp || 0
    ].join(':');
    let hash = 0;
    for (let i = 0; i < seedParts.length; i += 1) hash = (hash * 33 + seedParts.charCodeAt(i)) % 1000;
    const roll = hash % 100;
    if (roll < 40) return 6;
    if (roll < 80) return 8;
    return 4;
  }

  async function useCommonSkill(skill) {
    const battle = getMyBattle();
    const cfg = SKILL_CONFIG[skill];
    if (!battle || !cfg || state.actionInFlight) return;
    state.actionInFlight = true;
    updateActionStates(battle);
    try {
      const result = await transactionBattle((current) => {
        if (!current || !current.turn || !current.players) return current;
        if (current.turn.turnPlayer !== state.selfMark) return;
        if (current.turn.isResolving) return;
        if (!current.turn.piecePlacedThisTurn) return;
        if (normalizeNumber(current.turn.skillUsedCount, 0) >= 3) return;
        const actor = current.players[state.selfMark];
        const enemyMark = state.selfMark === 'O' ? 'X' : 'O';
        const target = current.players[enemyMark];
        if (!actor || !target) return;
        if (normalizeNumber(actor.sp, 0) < cfg.cost) return;
        actor.sp = Math.max(0, normalizeNumber(actor.sp, 0) - cfg.cost);
        current.turn.skillUsedCount = normalizeNumber(current.turn.skillUsedCount, 0) + 1;
        let events = [];
        if (skill === 'def') {
          actor.shieldStacks = Math.min(2, normalizeNumber(actor.shieldStacks, 0) + 1);
          spendUltGain(actor, cfg.ultGain);
          events.push(createFeedbackEvent(state.selfMark, 'ult', cfg.ultGain));
        }
        if (skill === 'hel') {
          actor.hp = Math.min(100, normalizeNumber(actor.hp, 100) + cfg.heal);
          spendUltGain(actor, cfg.ultGain);
          events.push(createFeedbackEvent(state.selfMark, 'heal', cfg.heal));
          events.push(createFeedbackEvent(state.selfMark, 'ult', cfg.ultGain));
        }
        if (skill === 'atk') {
          const shields = normalizeNumber(target.shieldStacks, 0);
          const darkBonus = (actor.camp === 'dark') ? resolveDarkStackAttackBonus(current, actor, target) : 0;
          const finalDamage = cfg.damage + darkBonus;
          if (shields > 0) {
            target.shieldStacks = Math.max(0, shields - 1);
            events.push(createFeedbackEvent(enemyMark, 'block', 0));
          } else {
            target.hp = Math.max(0, normalizeNumber(target.hp, 100) - finalDamage);
            events.push(createFeedbackEvent(enemyMark, 'damage', finalDamage));
          }
          if (actor.camp === 'dark' && normalizeNumber(actor.darkStacks, 0) > 0) actor.darkStacks = 0;
          spendUltGain(actor, cfg.ultGain);
          events.push(createFeedbackEvent(state.selfMark, 'ult', cfg.ultGain));
        }
        applyGameOverIfNeeded(current, skill === 'atk' ? '攻擊擊倒' : null);
        current.feedback = events.length ? {
          id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          events,
          expiresAt: Date.now() + 2200
        } : null;
        return current;
      });
      if (result && result.committed) playSound(cfg.sound);
    } catch (error) {
      console.error(`useCommonSkill(${skill}) failed`, error);
    } finally {
      state.actionInFlight = false;
      updateActionStates(getMyBattle());
    }
  }

  async function placePiece(cellIndex) {
    const battle = getMyBattle();
    if (!battle || state.actionInFlight) return;
    state.actionInFlight = true;
    updateActionStates(battle);
    try {
      const result = await transactionBattle((current) => {
        if (!current || !current.turn) return current;
        if (current.phase === 'GAME_OVER' || current.phase === 'RESULT_CHOICE') return current;
        if (current.turn.isResolving) return current;
        if (current.turn.turnPlayer !== state.selfMark) return current;
        if (current.turn.piecePlacedThisTurn) return current;
        const board = normalizeBoard(current.board);
        if (board[cellIndex]) return current;

        current.players = current.players || {};
        current.players[state.selfMark] = current.players[state.selfMark] || { pieceOrder: [] };
        current.tileEffects = current.tileEffects || {};

        let nextOrder = normalizePieceOrder(current.players[state.selfMark].pieceOrder);
        if (nextOrder.length >= 3) {
          const oldest = nextOrder[0];
          if (oldest && board[oldest.index] === state.selfMark) {
            board[oldest.index] = null;
          }
          nextOrder = nextOrder.slice(1);
        }

        board[cellIndex] = state.selfMark;
        const maxPlacedOrder = nextOrder.reduce((maxValue, item) => Math.max(maxValue, Number(item.placedOrder || 0)), 0);
        nextOrder.push({ index: cellIndex, placedOrder: maxPlacedOrder + 1 });

        let nextBoard = board;
        current.players[state.selfMark].pieceOrder = nextOrder;
        const completedLines = findCompletedLines(nextBoard, state.selfMark);
        if (completedLines.length) {
          current.turn.isResolving = true;
          nextBoard = applyLineResolutionToCurrent(current, nextBoard, state.selfMark, completedLines);
        }

        current.board = nextBoard;
        current.turn.piecePlacedThisTurn = true;
        current.turn.isResolving = false;
        if (!canUseAnyPostPlaceAction(current, state.selfMark)) {
          current.turn = createNextTurnState(current.turn, current);
        }
        return current;
      });
      if (result && result.committed) playSound('tap');
    } catch (error) {
      console.error('placePiece failed', error);
    } finally {
      state.actionInFlight = false;
      updateActionStates(getMyBattle());
    }
  }

  async function endTurn() {
    const battle = getMyBattle();
    if (!battle || state.actionInFlight) return;
    state.actionInFlight = true;
    updateActionStates(battle);
    try {
      const result = await transactionBattle((current) => {
        if (!current || !current.turn) return current;
        if (current.turn.turnPlayer !== state.selfMark) return;
        if (current.turn.isResolving) return;
        if (!current.turn.piecePlacedThisTurn) return;
        current.turn = createNextTurnState(current.turn, current);
        return current;
      });
    } catch (error) {
      console.error('endTurn failed', error);
    } finally {
      state.actionInFlight = false;
      updateActionStates(getMyBattle());
    }
  }

  async function checkTimeoutAndResolve() {
    const battle = getMyBattle();
    if (!battle || state.timeoutInFlight || state.actionInFlight) return;
    if (battle.phase === 'RESULT_CHOICE') {
      const expiresAt = Number(battle.rematch?.expiresAt || 0);
      if (expiresAt && Date.now() >= expiresAt) {
        state.timeoutInFlight = true;
        try {
          await transactionBattle((current) => {
            if (!current || current.phase !== 'RESULT_CHOICE') return current;
            const rematch = normalizeRematch(current.rematch);
            if (rematch.expiresAt && Date.now() < rematch.expiresAt) return current;
            rematch.status = 'return_room';
            current.rematch = rematch;
            return current;
          });
        } catch (error) { console.error('result timeout failed', error); } finally { state.timeoutInFlight = false; }
      }
      return;
    }
    if (!battle.turn) return;
    if (battle.turn.turnPlayer !== state.selfMark) return;
    const endsAt = Number(battle.turn.turnEndsAt || 0);
    if (!endsAt || Date.now() < endsAt) return;
    state.timeoutInFlight = true;
    try {
      const result = await transactionBattle((current) => {
        if (!current || !current.turn) return current;
        if (current.turn.turnPlayer !== state.selfMark) return;
        if (current.turn.isResolving) return current;
        const currentEndsAt = Number(current.turn.turnEndsAt || 0);
        if (currentEndsAt && Date.now() < currentEndsAt) return current;
        current.turn = createNextTurnState(current.turn, current);
        return current;
      });
    } catch (error) {
      console.error('timeout failed', error);
    } finally {
      state.timeoutInFlight = false;
    }
  }

  function bindUiActions() {
    if (els.grid) {
      els.grid.addEventListener('click', (event) => {
        const cell = event.target.closest('.grid-cell');
        if (!cell) return;
        const index = Number(cell.dataset.cellIndex || '-1');
        if (index < 0) return;
        placePiece(index);
      });
    }
    if (els.endTurnButton) {
      els.endTurnButton.addEventListener('click', () => endTurn());
    }
    if (els.resultRoomButton) els.resultRoomButton.addEventListener('click', () => chooseResultAction('room'));
    if (els.resultRematchButton) els.resultRematchButton.addEventListener('click', () => chooseResultAction('rematch'));
    els.skillButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const skill = button.dataset.skill || '';
        if (skill === 'atk' || skill === 'def' || skill === 'hel') useCommonSkill(skill);
      });
    });
  }

  function subscribeBattle() {
    const ref = firebaseApi.db.ref(`${BATTLE_PATH}/${state.roomId}`);
    const handler = ref.on('value', (snapshot) => {
      const battle = snapshot.val();
      if (!battle) {
        if (!state.missingBattleTimer) {
          state.missingBattleTimer = window.setTimeout(() => {
            if (!state.battleLoaded) redirectToRoom();
            else handleOpponentLeft('對手已離開，請重回菜單。');
          }, state.battleLoaded ? 700 : 3000);
        }
        return;
      }
      state.battleLoaded = true;
      if (state.missingBattleTimer) {
        window.clearTimeout(state.missingBattleTimer);
        state.missingBattleTimer = null;
      }
      if (!state.entryStable) {
        if (state.entryStableTimer) window.clearTimeout(state.entryStableTimer);
        state.entryStableTimer = window.setTimeout(() => {
          state.entryStable = true;
        }, 900);
      }
      clearPendingEntryOnly();
      renderBattle(battle);
      beginTurnLoops();
      if (battle.phase === 'RESULT_CHOICE' && battle.rematch?.status === 'return_room' && !state.isRedirecting) {
        window.setTimeout(() => redirectToRoom(), 250);
      }
    });
    state.unsubscribeBattle = () => ref.off('value', handler);
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    state.roomId = params.get('room') || storage.getPendingBattleRoomId() || storage.getCurrentRoomId() || '';

    if (!firebaseApi || !firebaseApi.isReady || !state.roomId || !state.selfMark) {
      redirectToRoom();
      return;
    }

    storage.setCurrentRoomId(state.roomId);
    storage.setCurrentRoomMark(state.selfMark);
    bindUiActions();
    bindLifecycleCleanup();
    registerDisconnectTasks();
    subscribeRoomGuard();
    subscribeBattle();
  }

  init();
})();
