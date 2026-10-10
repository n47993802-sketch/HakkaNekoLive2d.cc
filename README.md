# HakkaNeko Live2D

靜態網站專案，用於展示阿卡貓 HakkaNeko 的 VTuber Live2D 委託服務、作品展示、合作繪師與推薦頻道。

## 專案概覽

此專案採用純 HTML / CSS / JavaScript 靜態網站架構，支援多語系（繁中 / 簡中 / 英文 / 日文），並以 `site-config.js`、`nav-config.js`、`common.js` 驅動全站設定與導覽。

- `index.html`：網站首頁
- `common.css` / `tailwind.min.css`：全站樣式
- `common.js`：全站共用行為與動畫效果
- `site-config.js`：全站設定與資料來源（表單網址、作品素材前綴、接案開關）
- `nav-config.js`：導覽列設定與頁面路由
- `LICENSE`：MIT 授權與版權聲明

## 主要頁面與功能

網站內容分成三大主題：首頁、委託資訊、創作空間。

### 首頁
- `index.html`
- 介紹品牌、服務、最新公告與捷徑導覽。

### 合作與委託
- `artists/`：合作繪師介紹頁
- `commission/rules/`：委託流程與注意事項
- `commission/core/`：V皮設計（Live2D 模型製作）
- `commission/anim/`：動畫設計與演出規劃
- `commission/template/`：聯名模板（目前導覽列預設關閉）

### 創作空間
- `creative/model/`：模型展示
- `creative/portfolio/`：作品展示
- `creative/channels/`：推薦頻道
- `creative/fanart/`：二創展示

## 資料夾說明

- `artists/`：合作繪師頁面與相關渲染程式
- `commission/`：委託服務細節與方案說明
- `creative/`：創作展示相關頁面
- `effects/`：視覺特效程式（如背景粒子效果）
- `images/`：網站圖片素材
- `locales/`：多語系翻譯檔

### 特殊資料夾
- `creative/model/model/`：Live2D 模型相關資源與設定檔案，例如 `.model3.json`、`.moc3`、`physics3.json`。

## 多語系支援

`locales/` 目錄包含：
- `zh-TW.js`
- `zh-CN.js`
- `en.js`
- `ja.js`

翻譯文字由 `common.js` 和各頁面中的 i18n 標記轉換，用以顯示不同語言版本內容。

## 修改與維護

- 若要更改網站導覽內容，可編輯 `nav-config.js`。
- 若要更新全站設定（表單連結、素材前綴、是否開放接案），請編輯 `site-config.js`。
- 靜態頁面內容直接編輯對應 `index.html` 或各子資料夾中的 `index.html`。
- 作品資料與展示內容會由各頁面自己的 `*-render.js` 動態渲染。

## 部署

此專案為純靜態網站，可部署於 GitHub Pages、Netlify、Vercel 或任何靜態網站主機。根目錄即為網站根。

## 授權

依照專案中的 `LICENSE` 檔案，採用 MIT 授權，並附帶版權與智慧財產權聲明。請仔細閱讀 `LICENSE` 中的使用限制與免責聲明。

## 聯絡與說明

專案內容以阿卡貓 HakkaNeko 的 Live2D 委託網站為主，包含模型設計、動畫設計、合作繪師與作品展示。若要更進一步調整文案或頁面內容，可直接編輯對應 HTML / JS 檔案。 
