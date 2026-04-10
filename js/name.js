(function () {
  const storage = window.LightShadowStorage;

  const form = document.getElementById('name-form');
  const nameInput = document.getElementById('player-name');
  const countText = document.getElementById('name-count');
  const previewBox = document.getElementById('name-preview');
  const errorText = document.getElementById('name-error');
  const clearButton = document.getElementById('clear-name');

  const NAME_MAX_LENGTH = 12;
  const ALLOWED_NAME_PATTERN = /^[\u4e00-\u9fffA-Za-z0-9_-]+$/;

  function updateCount() {
    countText.textContent = `${nameInput.value.length}/${NAME_MAX_LENGTH}`;
  }

  function updatePreview(value) {
    previewBox.textContent = value
      ? `目前顯示名稱：${value}`
      : '目前顯示名稱：未設定';
  }

  function setError(message) {
    errorText.textContent = message;
  }

  function sanitizeName(value) {
    return value.trim();
  }

  function validateName(value) {
    if (!value) {
      return '請輸入玩家名稱。';
    }

    if (value.length > NAME_MAX_LENGTH) {
      return `玩家名稱不可超過 ${NAME_MAX_LENGTH} 個字元。`;
    }

    if (!ALLOWED_NAME_PATTERN.test(value)) {
      return '名稱只能使用中文、英文、數字、底線（_）、減號（-）。';
    }

    return '';
  }

  function fillSavedName() {
    const savedName = storage.getPlayerName();
    if (!savedName) {
      updateCount();
      updatePreview('');
      return;
    }

    nameInput.value = savedName;
    updateCount();
    updatePreview(savedName);
  }

  nameInput.addEventListener('input', function () {
    const currentValue = sanitizeName(nameInput.value);
    updateCount();
    updatePreview(currentValue);
    setError('');
  });

  clearButton.addEventListener('click', function () {
    nameInput.value = '';
    storage.clearPlayerName();
    updateCount();
    updatePreview('');
    setError('');
    nameInput.focus();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    const cleanName = sanitizeName(nameInput.value);
    const errorMessage = validateName(cleanName);

    if (errorMessage) {
      setError(errorMessage);
      updatePreview(cleanName);
      nameInput.focus();
      return;
    }

    storage.setPlayerName(cleanName);
    updatePreview(cleanName);
    setError('');
    window.location.href = 'character.html';
  });

  fillSavedName();
})();
