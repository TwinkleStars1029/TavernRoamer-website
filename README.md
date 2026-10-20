# TavernRoamer 說明網站

這是 **TavernRoamer 的繁體中文說明網站**，使用 Astro 製作成靜態網頁。TavernRoamer 是供 SillyTavern 酒館助手（JS-Slash-Runner）使用的腳本，讓使用者將聊天及選定的酒館環境素材備份到自己的 Google Drive，再於其他裝置讀取。本專案提供產品介紹、安裝、設定與操作指南；**網站原始碼不包含 TavernRoamer 腳本**。

> **安裝來源**：目前可在酒館助手全域腳本庫中使用 `import 'https://cdn.jsdelivr.net/gh/TwinkleStars1029/TavernRoamer@main/dist/tavern-roamer.js';` 載入 main 分支腳本。main 會變動，尚非固定版本；網站本身仍供本機預覽，正式網址尚未選定。

## 本機預覽

建議使用 Node.js 22.12 以上的版本及 npm。專案已有 `package-lock.json`，請使用 `npm ci` 安裝鎖定的依賴版本。

在 Windows 可直接雙擊 `start-website.bat`；首次執行會自動安裝依賴、啟動本機服務並開啟瀏覽器。保持命令視窗開啟即可持續預覽，按 `Ctrl+C` 停止。

```sh
npm ci
npm run dev
```

瀏覽器開啟 <http://127.0.0.1:4321/>。如要檢查正式建置的結果，執行：

```sh
npm run build
npm run preview
```

建置結果位於 `dist/`。`dev` 和 `preview` 都只監聽本機 `127.0.0.1`。

## 網站內容

| 頁面 | 路徑 | 內容 |
| --- | --- | --- |
| 首頁 | `/` | TavernRoamer 的用途、跨裝置備份流程與使用前提 |
| 介面介紹 | `/interface/` | 面板、操作按鈕與設定畫面 |
| 安裝指南 | `/install/` | 前置準備、酒館助手腳本庫安裝、首次連線與測試 |
| Google OAuth 設定 | `/setup/google-oauth/` | 建立 Cloud 專案、設定 Drive 權限與 Web Client；附酒館網址格式助手 |
| 使用教學 | `/how-to-use/` | 上傳、在另一台裝置建立或更新聊天，以及環境備份與還原 |
| 資料與權限 | `/data-and-permissions/` | Drive 中的資料、版本保留、還原點與授權範圍 |
| 常見問題 | `/faq/` | 安裝、授權及備份問題排查 |
| 版本與來源 | `/changelog/` | main 分支安裝來源、網站紀錄與相容性狀態 |

OAuth 頁面的網址助手只在瀏覽器中將輸入整理成 Google 所需的 JavaScript origins；它不會上傳或保存輸入內容。這個網站沒有後端，也不負責執行聊天備份。

## 專案結構

```text
src/pages/       各頁內容與路由
src/layouts/     共用版型與導覽
src/styles/      主題色彩變數（亮色／暗色）與全域樣式
src/components/  雲朵主視覺、主題切換鈕、頁內目錄及 OAuth 步驟截圖
src/lib/         網址格式助手、主題切換與對比度工具，以及它們的測試
public/          圖片與 favicon
```

修改頁面或導覽時，請檢查頁面之間的連結。新增站內連結時可使用 Astro 的 `import.meta.env.BASE_URL`，以支援網站部署在網域根目錄或子路徑。

## 檢查與部署

```sh
npm run typecheck
npm test
npm run build
```

推送至 `main` 後，GitHub Actions 會透過 `.github/workflows/deploy.yml` 自動建置並部署到 [https://twinklestars1029.github.io/TavernRoamer-website/](https://twinklestars1029.github.io/TavernRoamer-website/)。第一次部署前，需先在儲存庫的 Settings → Pages → Source 選擇「GitHub Actions」。

預設建置使用 `/` 作為網站根路徑。若其他靜態主機將網站放在 `/TavernRoamer/`，建置前設定 `SITE_BASE=TavernRoamer`。例如在 PowerShell：

```powershell
$env:SITE_BASE = 'TavernRoamer'
npm run build
Remove-Item Env:SITE_BASE
```

部署到其他靜態主機時，將 `dist/` 的內容部署到對應路徑即可。目前尚未設定 canonical URL；正式網址確定後，應一併核對部署路徑、站內連結及搜尋引擎中繼資料。

## 更新內容時

- 腳本安裝來源指向 main 分支；更新網址、匯入方式或相容版本時，先核對公開檔案與實際酒館操作。不要將本網站的本機建置檔當成 TavernRoamer 腳本發行檔。
- Google Cloud 的介面和授權規則可能改變。修改 OAuth 指南時，請核對頁面所連結的 Google 官方文件。
- 網站中的面板主圖是示意圖；在採用正式產品截圖前，保留清楚的圖片說明。
