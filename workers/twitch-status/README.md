# 直播狀態 Worker

這個 Cloudflare Worker 使用 Twitch Helix API 與 YouTube Data API 查詢首頁及推薦頻道的直播狀態。API 憑證只儲存在 Worker 環境，不放進靜態網站。

## 部署

1. 在 [Twitch Developer Console](https://dev.twitch.tv/console/apps) 建立應用程式，取得 Client ID 和 Client Secret。
2. 在 Google Cloud 建立 API Key，啟用 [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com)，並限制該 Key 僅能呼叫 YouTube Data API。
3. 安裝或使用 `npx wrangler`，登入 Cloudflare，並在此資料夾設定 secrets、部署 Worker：

   ```powershell
   npx wrangler login
   npx wrangler secret put TWITCH_CLIENT_ID
   npx wrangler secret put TWITCH_CLIENT_SECRET
   npx wrangler secret put YOUTUBE_API_KEY
   npx wrangler deploy
   ```

   每個指令會逐一提示輸入憑證；不要把憑證貼進網站程式碼或提交到版本庫。
4. 複製部署成功後顯示的 Worker URL（通常是 `https://hakkaneko-twitch-status.<你的 Cloudflare 子網域>.workers.dev`），並設定：
   - 根目錄 `index.html` 的 `data-twitch-status` 區塊 `data-endpoint`：`<Worker URL>/api/twitch-status`
   - `recommend/channels-config.js` 的 `statusEndpoint`：`<Worker URL>/api/channels-status`
5. 如果網站使用其他網域，將該網站的完整 origin（例如 `https://example.com`）加入 `wrangler.jsonc` 的 `ALLOWED_ORIGINS`，再重新部署 Worker。

推薦頻道及平台帳號由 `recommend/channels-config.js` 維護。未設定 `statusEndpoint` 時，頁面會使用 IVR／Decapi 公開端點查詢 Twitch；YouTube 會先透過 `youtubeProxyEndpoint` 指定的 Cloudflare Worker 讀取頻道 `/@handle/live` 頁面，並以 `liveBroadcastDetails.isLiveNow` 判定狀態。Worker 失敗或頁面無法辨識時，會依序嘗試 AllOrigins，以及（若有設定 key）Corsproxy.io。查詢失敗時會標示狀態未知，不會誤列為離線。YouTube 頁面 HTML 較大，網站目前每 60 分鐘更新一次，降低不必要的抓取量。

### Corsproxy.io 備援限制

控制台目前顯示免費帳號僅供 localhost／開發隧道使用；要登記正式網站網域則需選擇付費方案。因此，若不打算付費，請勿在 Corsproxy.io 加入 `hakkanekolive2d.cc`，也不要把 API key 填入預計公開部署的 `channels-config.js`。保留 `corsproxyApiKey` 空白即可；網站會繼續使用 AllOrigins，失敗時顯示狀態未知。若只想在本機預覽測試，可使用免費 key，但不要提交含有該 key 的變更。

官方方案頁另列免費方案每月 10,000 次請求與 1 GB 流量；實際可用網域以帳號控制台顯示為準。免費服務採 best-effort、沒有 SLA。詳情以 [官方方案頁](https://corsproxy.io/pricing/) 為準。

## 本機檢查

```powershell
node --test .\test.mjs
```
