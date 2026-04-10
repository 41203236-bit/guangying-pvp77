這是「光影對決」前兩頁 + 第三頁預留的乾淨拆分版。

檔案結構：
- index.html：輸入名字頁
- character.html：正式選角頁
- room.html：第三頁房間預留頁（目前只檢查資料是否有成功保留）
- css/name.css：輸入名字頁樣式
- css/character.css：選角頁樣式
- css/room.css：房間預留頁樣式
- js/storage.js：本地儲存工具
- js/name.js：輸入名字頁功能
- js/character-data.js：角色資料設定
- js/character.js：選角頁功能
- js/room-placeholder.js：房間預留頁測試功能
- assets/characters/：法師、騎士、刺客角色圖

目前功能：
1. 第一頁輸入玩家名稱並保留
2. 第二頁一進頁面先選光 / 暗陣營
3. 第二頁顯示三張角色卡，點圖即可選角
4. 第二頁可查看三角色詳細資料（被動 / 技能 / 大招）
5. 第二頁依陣營顯示不同選中高亮
6. 點完成後進入第三頁預留頁，確認資料有保留

目前還沒做：
- 真正的房間功能
- Firebase 同步
- 真正的戰鬥功能
- 第三頁完整機制說明框


[新增]
- 新增 battle.html / css/battle.css / js/battle.js 作為第四頁戰鬥模板版。
- battle.html 目前為模板預覽，不含 Firebase 同步與正式 battle_v3 邏輯。


[同步新增]
- 第三頁已接入最小版 room 同步：使用 rooms_v3。
- 第四頁已接入 battle 初始畫面同步：使用 battle_v3。
- 目前只同步 roomId、O/X、名字、角色、陣營、初始 HP/SP/ULT、空棋盤、turnPlayer。
- 尚未接入完整戰鬥事件與結算邏輯。
- 若要實際連線，請先在 js/firebase-config.js 填入你的 Firebase Realtime Database 設定。
