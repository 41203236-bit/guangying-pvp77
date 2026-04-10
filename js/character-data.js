window.LightShadowCharacterData = [
  {
    id: 'mage',
    name: '法師',
    englishName: 'Mage',
    role: '控場 / 封鎖 / 節奏限制',
    image: 'assets/characters/mage.png',
    passive: {
      name: '殘影禁制',
      summary: '離場位置留下殘影格，限制對手主動技節奏。',
      detail: '當法師落下第 4 顆棋並移除最舊棋後，該格會留下 1 回合殘影。對手若落在該格，下回合主動技能消耗會額外 +1。',
      cooldown: '2 回合'
    },
    active: {
      name: '封格',
      summary: '封鎖 1 個空格，限制對手下回合落子位置。',
      detail: '指定 1 個空格，對手下回合不能落子在該格。只能封鎖空格，不能封已有棋子的格子。'
    },
    ultimate: {
      name: '虛空法庭',
      summary: '用禁域與規則壓制切掉對手行動空間。',
      detail: '大招定位偏向規則型壓制與封鎖，不是單純爆發輸出。重點是逼迫對手走進劣勢節奏，詳細數值與最終效果將以後續戰鬥頁實裝版本為準。'
    }
  },
  {
    id: 'knight',
    name: '騎士',
    englishName: 'Knight',
    role: '穩定推進 / 保持盤面壓力',
    image: 'assets/characters/knight.png',
    passive: {
      name: '堅守陣線',
      summary: '第 4 顆棋落下時，保留最舊棋一次維持盤面。',
      detail: '當騎士落下第 4 顆棋時，會自動保留最舊棋一次，不立即移除。這能降低斷線風險，讓騎士持續維持盤面壓力。',
      cooldown: '2 回合'
    },
    active: {
      name: '推進',
      summary: '移動己方棋子修正布局，補線或壓場。',
      detail: '將自己場上一顆棋移動到相鄰空格，只能上下左右 1 格，不能斜移，且目標格必須為空。'
    },
    ultimate: {
      name: '王城鐵律',
      summary: '偏向護場、續戰與穩住局勢的大招。',
      detail: '大招定位偏向守成與壓場，核心是提高存活、保住關鍵棋與延長優勢。詳細數值與最終效果將以後續戰鬥頁實裝版本為準。'
    }
  },
  {
    id: 'assassin',
    name: '刺客',
    englishName: 'Assassin',
    role: '擾亂節奏 / 打斷布局',
    image: 'assets/characters/assassin.png',
    passive: {
      name: '弱點標記',
      summary: '讓敵方最舊棋進入脆弱，暫時無法參與連線。',
      detail: '當刺客落下第 4 顆棋時，會使對手最舊的一顆棋進入脆弱狀態 1 回合。脆弱棋仍存在，但該回合不能參與連線判定。',
      cooldown: '3 回合'
    },
    active: {
      name: '突襲換位',
      summary: '與相鄰敵棋交換位置，拆線與破局。',
      detail: '將自己的一顆棋與相鄰的一顆敵棋交換位置，只能交換相鄰格，不能跨格交換。'
    },
    ultimate: {
      name: '影獄斷界',
      summary: '短時間切斷對手盤面，接續爆發破局。',
      detail: '大招定位偏向拆線、封鎖與爆發斷節奏，不是純數值硬灌。詳細數值與最終效果將以後續戰鬥頁實裝版本為準。'
    }
  }
];
