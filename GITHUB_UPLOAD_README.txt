GitHub 上傳方式：
1. 先解壓縮這個壓縮檔。
2. 進到解壓後的資料夾。
3. 全選裡面的所有檔案與資料夾（battle.html、assets、css、js、sounds...）。
4. 直接拖到 GitHub repository 的 upload files 頁面。
5. 不要再把 zip 檔一起丟上去。

如果要開 GitHub Pages：
- Repository 建好後，上傳這些原始檔
- 到 Settings > Pages
- Source 選 Deploy from a branch
- Branch 選 main / root

注意：
- js/firebase-config.js 已包含 Firebase 設定，公開 repo 前請先確認是否要公開這組設定。
- Realtime Database rules 目前若是測試開放，之後記得收緊。
