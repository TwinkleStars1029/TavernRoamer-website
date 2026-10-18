# 介紹動畫（手機直式影片）設計

日期：2026-10-18
狀態：待使用者審閱

## 目標

做一支約 31 秒的 TavernRoamer 介紹動畫，輸出成 9:16 的 MP4，用在 Threads、Discord 等社群宣傳。

- 動畫用網頁做，再由腳本逐格截圖、合成影片。
- 內容、文案、素材都取自首頁；色調、素材和樣式跟網站一致，不另外設計新風格。
- **靜音也能看懂**：文字是主角，每句字幕至少停留 2.5 秒。不配旁白，也不對齊音樂節拍；之後如果要加背景音樂，由使用者自己後製。
- 天色**由暗轉亮**：用暗色主題（雲上夜燈）開場，第 4 幕轉成亮色主題（霧藍石板），最後停在亮色。
- 結尾只放品牌名稱，不放網址，連結放在貼文內文。

不做的事：首頁「安心漫遊」的 3 個優點、面板截圖、旁白、音樂。

## 1. 分鏡

舞台大小 540×960 CSS px，輸出時像素比設為 2，得到 1080×1920。文案都取自首頁，只做刪減、斷行，不新增句子。

| # | 時間 | 天色 | 畫面 | 文字 |
| --- | --- | --- | --- | --- |
| 1 開場 | 0–5s | 暗色 | 星星依序亮起，雲海從底部升起，小雲團緩緩飄動 | 先出現「TavernRoamer · 雲端漫遊」，接著是「讓故事乘著雲，／在各處酒館之間漫遊。」 |
| 2 換個地方 | 5–12s | 暗色 | 電腦插圖以描線方式畫出，對話泡泡依序冒出；接著換成手機插圖。最後 6 個行囊圖示散落在畫面四周，輕微晃動 | 「換個地方，／還想接著那句未完的話。」→「卻總得逐一搬好／聊天紀錄與搭配的素材。」 |
| 3 收好行囊 | 12–19s | 暗色，開始泛藍 | 畫面中央出現「目前的聊天視窗」，6 個圖示沿虛線依序飛入，名稱短暫浮現，最後收成一個發光的行囊 | 「每一扇聊天視窗，／都有一份自己的故事行囊。」 |
| 4 漫遊路線 | 19–26s | 暗 → 亮 | 行囊乘著雲往上飄，依序經過三站：01 目前的酒館 → 02 自己的 Google Drive → 03 另一座酒館。到站後行囊展開，6 個圖示回到新的聊天視窗 | 「在這座酒館收好，／到下一座酒館展開。」→「展開行囊，接著聊下去。」 |
| 5 收尾 | 26–31s | 亮色 | 雲海安定下來，品牌標誌淡入，最後靜止至少 3 秒 | 「故事在雲端漫遊，／陪你一起旅行」，以及品牌標誌「✳ TavernRoamer」加「STORY, WHEREVER YOU GO」 |

細節：

- 「Google Drive」站點只用雲朵線條圖示加上文字，不使用 Google 商標。
- 天色只在第 4 幕轉換，對應「到另一座酒館」；第 3 幕的「開始泛藍」只是微調雲底光暈，不切換主題。
- 收尾的品牌標誌沿用網站導覽列的樣式（`brand-mark` ✳ 加 Tavern／Roamer 雙色字），不使用 favicon。

## 2. 檔案架構

### 動畫頁面

- `src/pages/intro.astro`：不套用 `SiteLayout`，畫面上沒有導覽列和頁尾，只有一個 540×960 的舞台和 5 幕的元素。引用 `theme.css`、`<CloudSky variant="full" />`，以及跟 `SiteLayout` 同一組 Google Fonts。加上 `<meta name="robots" content="noindex">`，網站上也不放連結。
- `src/styles/intro.css`：舞台和各幕的版面。
- `src/lib/intro-timeline.ts`：整支動畫的時間軸資料和控制。
  - 資料：每一幕列出開始、結束時間，以及其中每個動作的目標元素、開始時間（毫秒）、持續時間、keyframes 和 easing；字幕另外記錄出現與消失時間，供測試檢查。
  - 控制：用 Web Animations API 建立所有動畫，一開始全部暫停。對外提供 `duration`（總長，毫秒）和 `seek(ms)`（把每個動畫的 `currentTime` 設到指定時間）。頁面上會掛 `window.__intro = { duration, seek }`。

### 由暗轉亮

- 用 `@property` 把需要補間的顏色變數註冊為 `<color>`，例如天空、雲朵、光暈，以及畫在天空上的文字與線條（`--sky-*`、`--puff-*`、`--bank-*`、`--glow`、`--bg`、`--text`、`--muted`、`--accent`、`--line`、`--surface` 等）。實作時以畫面上實際用到的變數為準。
- 非顏色的變數（`--glow-opacity`、`--star-opacity`）註冊為 `<number>`，一起補間。
- 暗色和亮色的值在 build 時從 `theme.css` 讀出，產生時間軸的 keyframes，不在動畫程式裡再寫一份色碼。網站之後改色，動畫也會跟著改。
- 舞台根元素一開始套暗色值，第 4 幕由時間軸把這些變數補間到亮色值。

### 和首頁共用的素材（小幅改動首頁）

- `src/data/luggage.ts`：6 個行囊項目（名稱、說明、左右位置、列數、SVG path）從 `index.astro` 搬過來；首頁和動畫頁都從這裡引用。
- `src/components/SceneArt.astro`：從 `index.astro` 拆出兩張場景插圖，用 `variant: 'home' | 'mobile'` 切換。首頁改成引用這個元件。
- 首頁改完後畫面必須完全不變（見第 4 節）。

### 播放模式

| 網址 | 行為 |
| --- | --- |
| `/intro/` | 自動從頭播一次，最後停在收尾畫面 |
| `/intro/?t=20` | 直接停在第 20 秒的畫面，用來檢查單一幕 |
| `/intro/?export` | 不自動播放，由輸出腳本呼叫 `seek` 控制 |

## 3. 輸出流程

執行 `npm run export:intro`（`scripts/export-intro.mjs`）：

1. 執行 `astro build`，再啟動 `astro preview`（固定 host 127.0.0.1，port 從空閒的連接埠中挑選）。
2. 用 Playwright Chromium 打開 `/intro/?export`，視窗 540×960、`deviceScaleFactor: 2`。
3. 等 `document.fonts.ready`，並用 `document.fonts.check` 確認 Noto Sans TC 和 Noto Serif TC 都已載入。
4. 逐格處理，30fps，共 `ceil(duration / 1000 × 30)` 格：呼叫 `seek(i × 1000 / 30)`，等兩次 `requestAnimationFrame`，再截圖存成 PNG，放在系統暫存資料夾。
5. 用 `ffmpeg-static` 合成：H.264、`yuv420p`、30fps、CRF 18、`+faststart`。
6. 輸出 `exports/tavernroamer-intro.mp4`，另外輸出最後一格當封面圖 `exports/tavernroamer-intro-poster.png`。
7. 刪除暫存截圖，關閉 preview 伺服器。

新增的開發套件：`playwright`（加 Chromium）、`ffmpeg-static`。網站執行時不會多任何依賴。`exports/` 加進 `.gitignore`。

### 錯誤處理

- 字型沒載入（Google Fonts 要連網）：中止，並說明是哪個字型沒載入。
- 頁面上沒有 `window.__intro`：中止，並提示確認 build 是否成功。
- ffmpeg 失敗：保留截圖資料夾並印出路徑，結束代碼不為 0。
- 不管成功或失敗，都會關閉 preview 伺服器和瀏覽器（`try/finally`）。

## 4. 測試與驗收

自動測試（Vitest）：

- 時間軸：各幕首尾相接、沒有空檔；總長在 30–32 秒之間；**每句字幕的停留時間至少 2500ms**；每個動作都落在所屬那一幕的時間範圍內。
- 換色清單：每個要補間的變數，在 `theme.css` 的亮色和暗色兩組裡都有定義。
- `luggage.ts`：剛好 6 項，左右各 3 項，列數 1–3 不重複。

手動驗收：

- 跑一次 `npm run export:intro`，確認 MP4 是 1080×1920、30fps，長度約 31 秒，用手機播放正常。
- 用瀏覽器開 `/intro/?t=` 檢查每一幕的關鍵畫面，包括第 4 幕換色中途的畫面。
- 首頁改動前後，各在手機（375px）和桌機寬度截圖比對，畫面一致。
- `npm run build`、`npm run typecheck`、`npm test` 都通過。
