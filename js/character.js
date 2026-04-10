(function () {
  const storage = window.LightShadowStorage;
  const characters = window.LightShadowCharacterData || [];

  const playerNameTag = document.getElementById('player-name-tag');
  const cardsContainer = document.getElementById('character-cards');
  const completeButton = document.getElementById('complete-selection');
  const selectedCampText = document.getElementById('selected-camp-text');
  const selectedCharacterText = document.getElementById('selected-character-text');
  const modal = document.getElementById('camp-modal');
  const lightButton = document.getElementById('choose-light');
  const darkButton = document.getElementById('choose-dark');
  const changeCampButton = document.getElementById('change-camp-button');
  const pickHint = document.getElementById('pick-hint');

  let tempCamp = storage.getPlayerCamp();
  let tempCharacterId = storage.getSelectedCharacter();

  function ensurePlayerName() {
    const name = storage.getPlayerName();
    if (!name) {
      window.location.href = 'index.html';
      return '';
    }
    playerNameTag.textContent = `玩家名字：${name}`;
    return name;
  }

  function getCharacterById(characterId) {
    return characters.find((item) => item.id === characterId);
  }


  function updateSummary() {
    selectedCampText.textContent = tempCamp
      ? `目前陣營：${tempCamp === 'light' ? '光之陣營' : '暗之陣營'}`
      : '目前陣營：尚未選擇';

    const selectedCharacter = getCharacterById(tempCharacterId);
    selectedCharacterText.textContent = selectedCharacter
      ? `目前角色：${selectedCharacter.name}`
      : '目前角色：尚未選擇';

    completeButton.disabled = !(tempCamp && tempCharacterId);
    pickHint.classList.toggle('is-hidden', Boolean(tempCharacterId));
  }

  function syncCardSelection() {
    const cards = cardsContainer.querySelectorAll('.character-card');
    cards.forEach((card) => {
      const isSelected = card.dataset.characterId === tempCharacterId;
      card.classList.remove('is-selected-light', 'is-selected-dark', 'is-selected-pending');
      if (!isSelected) return;
      if (tempCamp === 'light') {
        card.classList.add('is-selected-light');
      } else if (tempCamp === 'dark') {
        card.classList.add('is-selected-dark');
      } else {
        card.classList.add('is-selected-pending');
      }
    });
  }

  function toggleSkillPanel(characterId, panelKey) {
    const fullKey = `${characterId}:${panelKey}`;
    const targetPanel = document.querySelector(`.skill-panel[data-detail-key="${fullKey}"]`);
    if (!targetPanel) return;
    const brief = targetPanel.querySelector('.skill-brief');
    const button = targetPanel.querySelector('.skill-detail-button');
    const isOpen = targetPanel.classList.toggle('is-open');
    if (brief) {
      brief.textContent = isOpen ? brief.dataset.detail : brief.dataset.summary;
    }
    if (button) {
      button.textContent = isOpen ? '收起' : '詳細資料';
    }
  }

  function selectCharacter(characterId) {
    tempCharacterId = characterId;
    syncCardSelection();
    updateSummary();
  }

  function createSkillPanel(character, type, detailKey) {
    const skill = character[type];
    const cooldownHtml = type === 'passive'
      ? `<span class="skill-cooldown">${skill.cooldown}</span>`
      : '';
    const metaHtml = type === 'passive'
      ? `<p class="meta">冷卻：${skill.cooldown}</p>`
      : '';

    return `
      <div class="skill-panel" data-detail-key="${character.id}:${detailKey}">
        <div class="skill-summary">
          <div class="skill-name-line">
            <span class="skill-name">${type === 'passive' ? '被動' : type === 'active' ? '技能' : '大招'}</span>
            ${cooldownHtml}
          </div>
          <div class="skill-main">
            <p class="skill-brief" data-summary="${skill.summary}" data-detail="${skill.detail.replace(/"/g, '&quot;')}">${skill.summary}</p>
          </div>
          <button type="button" class="skill-detail-button" data-open-key="${detailKey}" data-character-id="${character.id}">詳細資料</button>
        </div>
        <div class="skill-expanded">${metaHtml}</div>
      </div>
    `;
  }

  function createCard(character) {
    const article = document.createElement('article');
    article.className = 'character-card';
    article.dataset.characterId = character.id;
    article.tabIndex = 0;

    article.innerHTML = `
      <div class="card-selected-badge">已選擇</div>
      <div class="card-name-block">
        <p class="card-title">${character.name}</p>
        <p class="card-subtitle">${character.englishName} · ${character.role}</p>
      </div>
      <div class="card-image-shell">
        <img src="${character.image}" alt="${character.name}角色圖">
      </div>
      <div class="skill-pill-group">
        ${createSkillPanel(character, 'passive', 'passive')}
        ${createSkillPanel(character, 'active', 'active')}
        ${createSkillPanel(character, 'ultimate', 'ultimate')}
      </div>
    `;

    article.addEventListener('click', function (event) {
      if (event.target.closest('.skill-detail-button')) return;
      selectCharacter(character.id);
    });

    article.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectCharacter(character.id);
      }
    });

    article.querySelectorAll('.skill-detail-button').forEach((button) => {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        toggleSkillPanel(character.id, button.dataset.openKey);
      });
    });

    return article;
  }

  function renderCards() {
    cardsContainer.innerHTML = '';
    characters.forEach((character) => {
      cardsContainer.appendChild(createCard(character));
    });
    syncCardSelection();
  }

  function showCampModal() {
    modal.classList.remove('is-hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function hideCampModal() {
    modal.classList.add('is-hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function chooseCamp(camp) {
    tempCamp = camp;
    syncCardSelection();
    updateSummary();
    hideCampModal();
  }

  function bindEvents() {
    lightButton.addEventListener('click', function () {
      chooseCamp('light');
    });

    darkButton.addEventListener('click', function () {
      chooseCamp('dark');
    });

    changeCampButton.addEventListener('click', function () {
      showCampModal();
    });

    completeButton.addEventListener('click', function () {
      if (!(tempCamp && tempCharacterId)) return;
      storage.setPlayerCamp(tempCamp);
      storage.setSelectedCharacter(tempCharacterId);
      if (storage.clearRoomSession) storage.clearRoomSession();
      window.location.href = 'room.html';
    });
  }

  function init() {
    const playerName = ensurePlayerName();
    if (!playerName) return;

    renderCards();
    bindEvents();
    updateSummary();

    if (!tempCamp) {
      showCampModal();
    }
  }

  init();
})();
