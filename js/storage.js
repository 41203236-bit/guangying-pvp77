(function () {
  const STORAGE_KEYS = Object.freeze({
    playerName: 'lightShadow.playerName',
    playerCamp: 'lightShadow.playerCamp',
    selectedCharacter: 'lightShadow.selectedCharacter',
    clientId: 'lightShadow.clientId',
    currentRoomId: 'lightShadow.currentRoomId',
    currentRoomMark: 'lightShadow.currentRoomMark',
    pendingBattleRoomId: 'lightShadow.pendingBattleRoomId',
    pendingBattleMark: 'lightShadow.pendingBattleMark'
  });

  function getItem(key) {
    return localStorage.getItem(key) || '';
  }

  function setItem(key, value) {
    localStorage.setItem(key, value);
  }

  function removeItem(key) {
    localStorage.removeItem(key);
  }

  function getPlayerName() { return getItem(STORAGE_KEYS.playerName); }
  function setPlayerName(name) { setItem(STORAGE_KEYS.playerName, name); }
  function clearPlayerName() { removeItem(STORAGE_KEYS.playerName); }

  function getPlayerCamp() { return getItem(STORAGE_KEYS.playerCamp); }
  function setPlayerCamp(camp) { setItem(STORAGE_KEYS.playerCamp, camp); }
  function clearPlayerCamp() { removeItem(STORAGE_KEYS.playerCamp); }

  function getSelectedCharacter() { return getItem(STORAGE_KEYS.selectedCharacter); }
  function setSelectedCharacter(characterId) { setItem(STORAGE_KEYS.selectedCharacter, characterId); }
  function clearSelectedCharacter() { removeItem(STORAGE_KEYS.selectedCharacter); }

  function getClientId() {
    let clientId = getItem(STORAGE_KEYS.clientId);
    if (!clientId) {
      clientId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      setItem(STORAGE_KEYS.clientId, clientId);
    }
    return clientId;
  }

  function getCurrentRoomId() { return getItem(STORAGE_KEYS.currentRoomId); }
  function setCurrentRoomId(roomId) { setItem(STORAGE_KEYS.currentRoomId, roomId); }
  function clearCurrentRoomId() { removeItem(STORAGE_KEYS.currentRoomId); }

  function getCurrentRoomMark() { return getItem(STORAGE_KEYS.currentRoomMark); }
  function setCurrentRoomMark(mark) { setItem(STORAGE_KEYS.currentRoomMark, mark); }
  function clearCurrentRoomMark() { removeItem(STORAGE_KEYS.currentRoomMark); }


  function getPendingBattleRoomId() { return getItem(STORAGE_KEYS.pendingBattleRoomId); }
  function setPendingBattleRoomId(roomId) { setItem(STORAGE_KEYS.pendingBattleRoomId, roomId); }
  function clearPendingBattleRoomId() { removeItem(STORAGE_KEYS.pendingBattleRoomId); }

  function getPendingBattleMark() { return getItem(STORAGE_KEYS.pendingBattleMark); }
  function setPendingBattleMark(mark) { setItem(STORAGE_KEYS.pendingBattleMark, mark); }
  function clearPendingBattleMark() { removeItem(STORAGE_KEYS.pendingBattleMark); }

  function setPendingBattleEntry(roomId, mark) {
    setPendingBattleRoomId(roomId);
    setPendingBattleMark(mark);
  }

  function clearPendingBattleEntry() {
    clearPendingBattleRoomId();
    clearPendingBattleMark();
  }

  function clearRoomSession() {
    clearCurrentRoomId();
    clearCurrentRoomMark();
    clearPendingBattleEntry();
  }

  window.LightShadowStorage = {
    keys: STORAGE_KEYS,
    getPlayerName,
    setPlayerName,
    clearPlayerName,
    getPlayerCamp,
    setPlayerCamp,
    clearPlayerCamp,
    getSelectedCharacter,
    setSelectedCharacter,
    clearSelectedCharacter,
    getClientId,
    getCurrentRoomId,
    setCurrentRoomId,
    clearCurrentRoomId,
    getCurrentRoomMark,
    setCurrentRoomMark,
    clearCurrentRoomMark,
    getPendingBattleRoomId,
    setPendingBattleRoomId,
    clearPendingBattleRoomId,
    getPendingBattleMark,
    setPendingBattleMark,
    clearPendingBattleMark,
    setPendingBattleEntry,
    clearPendingBattleEntry,
    clearRoomSession
  };
})();
