# 阿卡貓 HakkaNeko Live2D

阿卡貓 HakkaNeko 的靜態作品與委託資訊網站，使用原生 HTML、CSS 和 JavaScript，部署於 GitHub Pages。

## 網站頁面

- `/`：首頁與服務簡介
- `/collab/`：合作夥伴
- `/contact/`：聯絡方式
- `/pricing/`：委託價目與報價工具
- `/process/`：委託流程與規範
- `/schedule/`：排單查詢
- `/works/`：作品展示
- `/recommend/`：推薦頻道與粉絲二創

各路徑由對應資料夾中的 `index.html` 提供。`CNAME` 設定 GitHub Pages 使用的自訂網域。

## 專案結構

- `index.html`、各頁面資料夾中的 `index.html`：頁面結構與內容
- `styles.css`：全站版面、主題與元件樣式
- `script.js`：共用互動、偏好設定及頁面載入行為
- `theme-init.js`：載入頁面樣式前初始化主題
- `assets/images/`：網站共用圖片
- `works/config.js`、`works/gallery.js`：作品資料與作品展示功能
- `recommend/channels-config.js`、`recommend/channels.js`：推薦頻道資料與直播狀態
- `recommend/fanart-config.js`、`recommend/fanart.js`：二創資料與展示功能
- `workers/twitch-status/`：Cloudflare Worker、部署設定與測試
- `locales/manifest.json`：語系規劃清單；目前尚未包含翻譯檔或語言切換器

推薦頻道的資料維護於 `recommend/channels-config.js`；作品及素材連結維護於 `works/config.js` 和 `recommend/fanart-config.js`。Worker 所需的 API 憑證應設定為 Cloudflare secrets，不要放入前端設定或提交至版本庫。Worker 部署方式與環境變數詳見 [workers/twitch-status/README.md](./workers/twitch-status/README.md)。

## 本機檢查

使用 Node.js 檢查 Worker：

```powershell
node --test .\workers\twitch-status\test.mjs
```

網站沒有套件安裝或建置步驟。建議透過本機靜態 HTTP 伺服器預覽；直接以 `file://` 開啟時，資料夾路徑不會自動解析成 `index.html`。

## 部署

網站根目錄可直接部署至 GitHub Pages 或其他靜態網站代管服務。Cloudflare Worker 需另外依照 `workers/twitch-status/README.md` 部署。
