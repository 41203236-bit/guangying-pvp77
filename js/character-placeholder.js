(function () {
  const storage = window.LightShadowStorage;
  const display = document.getElementById('player-name-display');

  const playerName = storage.getPlayerName();

  if (playerName) {
    display.textContent = `目前保留的玩家名稱：${playerName}`;
    return;
  }

  display.textContent = '目前沒有讀到玩家名稱，表示前一頁尚未完成輸入流程。';
})();
