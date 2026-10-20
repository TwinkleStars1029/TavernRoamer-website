# 介紹動畫（手機直式影片）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一支 31 秒、9:16 的 TavernRoamer 介紹動畫網頁 `/intro/`，並用腳本逐格輸出成 1080×1920、30fps 的 MP4。

**Architecture:** `src/pages/intro.astro` 是一個 540×960 的固定舞台，直接沿用網站的 `theme.css`、`global.css`、`CloudSky`，以及從首頁拆出來的素材（`luggage.ts`、`SceneArt.astro`）。所有動作寫成資料（`intro-scenes.ts`），由 `intro-timeline.ts` 用 Web Animations API 建成一組暫停中的動畫，對外提供 `seek(ms)`。由暗轉亮的方式是用 `CSS.registerProperty` 把主題變數註冊成可補間的型別，再對舞台根元素補間（`intro-theme.ts`）。`scripts/export-intro.mjs` 會 build、啟動 preview，用 Playwright 逐格 `seek` 加截圖，最後用 `ffmpeg-static` 合成影片。

**Tech Stack:** Astro 7.3.5、TypeScript strict、Vitest 5、Web Animations API、Playwright（Chromium）、ffmpeg-static、Node 24。

Spec：`docs/superpowers/specs/2026-10-18-intro-video-design.md`

## Global Constraints

- 舞台 540×960 CSS px；輸出時 `deviceScaleFactor: 2`，影片為 1080×1920、30fps、H.264、`yuv420p`、CRF 18、`+faststart`。
- 總長 `INTRO_DURATION = 31000` ms，必須在 30000–32000 之間。
- 每句字幕的停留時間（`out - in`）至少 `2500` ms。
- 最後 3 秒（28000 ms 之後）畫面完全靜止，不能有任何動作。
- 文案只取自首頁，只能刪減、斷行，不新增句子。分鏡文字以 spec 第 1 節為準。
- 「Google Drive」站點只用線條圖示加文字，不使用 Google 商標。
- 顏色只能來自 `src/styles/theme.css` 的變數，不在動畫程式裡另外寫色碼。唯一的例外是 `.intro-dawn` 的泛藍光暈和頁面外框的黑底。
- `/intro/` 要有 `<meta name="robots" content="noindex">`，網站其他頁面不放連結。
- 首頁改動後，畫面必須完全不變。
- 同一個元素同時有多個動作時，位移、縮放、旋轉分別用 CSS 的 `translate`、`scale`、`rotate` 個別屬性，不使用 `transform`，以免不同動畫互相覆蓋。
- 新增的套件只能是開發依賴：`playwright`、`ffmpeg-static`。
- 每個 commit 訊息結尾加上 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## 前置條件

- `src/pages/index.astro` 和 `src/styles/global.css` 目前有使用者還沒 commit 的改動。開始 Task 1 之前，必須先由使用者 commit 這些改動，或明確同意一起 commit。執行者先跑 `git status --short src/pages/index.astro`，有輸出就停下來回報，不要自己決定。
- 在 `feat/cloud-theme` 之上開新分支 `feat/intro-video`。

## 檔案結構

| 檔案 | 動作 | 職責 |
| --- | --- | --- |
| `src/data/luggage.ts` | 新增 | 6 個行囊項目的資料（首頁和動畫共用） |
| `src/data/luggage.test.ts` | 新增 | 檢查行囊資料的形狀 |
| `src/components/SceneArt.astro` | 新增 | 「在家」「出門」兩張場景插圖，連同插圖自己的填色樣式 |
| `src/pages/index.astro` | 修改 | 改成引用上面兩者，畫面不變 |
| `src/lib/intro-theme.ts` | 新增 | 解析 `theme.css`、產生換色 keyframes、註冊 `@property` |
| `src/lib/intro-theme.test.ts` | 新增 | |
| `src/lib/intro-timeline.ts` | 新增 | 型別、字幕淡入淡出、攤平並排序步驟、`createPlayer`（DOM） |
| `src/lib/intro-timeline.test.ts` | 新增 | |
| `src/lib/intro-scenes.ts` | 新增 | 5 幕的所有動作資料和版面座標 |
| `src/lib/intro-scenes.test.ts` | 新增 | 時間規則的測試（字幕停留、各幕相接、最後靜止） |
| `src/lib/intro-boot.ts` | 新增 | 頁面啟動：註冊變數、建立播放器、處理 `?t=`／`?export` |
| `src/pages/intro.astro` | 新增 | 舞台 markup |
| `src/styles/intro.css` | 新增 | 舞台版面與各元素的初始狀態 |
| `scripts/export-intro.mjs` | 新增 | 輸出 MP4 |
| `package.json`、`.gitignore` | 修改 | `export:intro` script、開發依賴、忽略 `exports/` |

---

### Task 1：把首頁的行囊資料和場景插圖拆成共用素材

**Files:**
- Create: `src/data/luggage.ts`
- Create: `src/data/luggage.test.ts`
- Create: `src/components/SceneArt.astro`
- Modify: `src/pages/index.astro`（frontmatter 的 `luggage` 常數、兩段場景 `<svg>`、`<style>` 裡的 `.scene-art svg`／`.scene-wash`／`.device-fill`／`.bubble-fill`）

**Interfaces:**
- Produces: `export interface LuggageItem { name: string; detail: string; side: 'left' | 'right'; row: 1 | 2 | 3; path: string }`、`export const luggage: LuggageItem[]`（順序不變：聊天紀錄、角色卡、玩家人設、世界書、預設提示詞、正則）
- Produces: `<SceneArt variant="home" | "mobile" />`，只輸出一個 `<svg>`，元素的 class 維持 `scene-wash`、`device-fill`、`bubble-fill`

- [ ] **Step 1：確認前置條件，並留一份改動前的首頁 HTML**

```bash
git status --short src/pages/index.astro src/styles/global.css
```
預期：沒有輸出。有輸出就停下來回報。

```bash
npm run build && cp dist/index.html "$TEMP/home-before.html"
```
預期：build 成功。

- [ ] **Step 2：寫會失敗的測試** `src/data/luggage.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { luggage } from './luggage';

describe('luggage', () => {
  it('has six items, three on each side', () => {
    expect(luggage).toHaveLength(6);
    expect(luggage.filter(item => item.side === 'left')).toHaveLength(3);
    expect(luggage.filter(item => item.side === 'right')).toHaveLength(3);
  });
  it('uses rows 1 to 3 once per side', () => {
    for (const side of ['left', 'right'] as const) {
      expect(luggage.filter(item => item.side === side).map(item => item.row).sort()).toEqual([1, 2, 3]);
    }
  });
  it('keeps the home page order', () => {
    expect(luggage.map(item => item.name)).toEqual(['聊天紀錄', '角色卡', '玩家人設', '世界書', '預設提示詞', '正則']);
  });
});
```

- [ ] **Step 3：跑測試，確認失敗**

Run: `npx vitest run src/data/luggage.test.ts`
預期：FAIL，找不到 `./luggage`。

- [ ] **Step 4：建立 `src/data/luggage.ts`**

`path` 字串從 `src/pages/index.astro` 第 7–12 行原樣搬過來，一個字都不改。

```ts
export interface LuggageItem {
  name: string;
  detail: string;
  side: 'left' | 'right';
  row: 1 | 2 | 3;
  path: string;
}

export const luggage: LuggageItem[] = [
  { name: '聊天紀錄', detail: '聊過的話，走過的篇章', side: 'left', row: 1, path: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z' },
  { name: '角色卡', detail: '陪伴你的角色與模樣', side: 'left', row: 2, path: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM9 9a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm-1 9v-1a4 4 0 0 1 8 0v1' },
  { name: '玩家人設', detail: '故事裡的你，連同頭像', side: 'left', row: 3, path: 'M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM4 21v-2a8 8 0 0 1 16 0v2' },
  { name: '世界書', detail: '這個世界的背景與細節', side: 'right', row: 1, path: 'M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3V3Z' },
  { name: '預設提示詞', detail: '為對話選好的設定', side: 'right', row: 2, path: 'M4 7h16M4 17h16M8 4v6M16 14v6' },
  { name: '正則', detail: '熟悉的文字處理規則', side: 'right', row: 3, path: 'm8 5-5 7 5 7m8-14 5 7-5 7m-3-15-2 16' }
];
```

- [ ] **Step 5：跑測試，確認通過**

Run: `npx vitest run src/data/luggage.test.ts`
預期：3 個測試 PASS。

- [ ] **Step 6：建立 `src/components/SceneArt.astro`**

兩段 `<svg>` 從 `index.astro` 第 47–54 行（home）和第 64–70 行（mobile）原樣搬過來。

```astro
---
interface Props {
  variant: 'home' | 'mobile';
}

const { variant } = Astro.props;
---
{variant === 'home' ? (
  <svg viewBox="0 0 320 160" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle class="scene-wash" cx="160" cy="80" r="70" />
    <circle cx="259" cy="39" r="14" /><path d="M259 16v-5m0 56v-5m23-23h5m-56 0h5m7-16-4-4m36 36 4 4m-4-36 4-4" />
    <rect class="device-fill" x="77" y="29" width="166" height="101" rx="7" /><path d="M77 47h166M142 130v18m36-18v18m-48 0h60" />
    <circle cx="88" cy="38" r="1" /><circle cx="95" cy="38" r="1" /><circle cx="102" cy="38" r="1" />
    <rect class="bubble-fill" x="94" y="63" width="88" height="16" rx="8" /><rect class="bubble-fill" x="141" y="89" width="84" height="16" rx="8" />
    <path d="M31 147h258m-234 0v-22m-7 7 7 6 7-12" />
  </svg>
) : (
  <svg viewBox="0 0 320 160" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle class="scene-wash" cx="160" cy="80" r="70" />
    <path d="M73 25a17 17 0 1 0 20 22 17 17 0 0 1-20-22ZM245 36v10m-5-5h10m-188 58v8m-4-4h8m193-34v6m-3-3h6" />
    <rect class="device-fill" x="120" y="10" width="80" height="140" rx="12" /><path d="M143 18h34M148 140h24" />
    <rect class="bubble-fill" x="132" y="42" width="48" height="18" rx="8" /><rect class="bubble-fill" x="145" y="72" width="43" height="18" rx="8" /><rect class="bubble-fill" x="132" y="102" width="37" height="12" rx="6" />
    <path d="M55 148h210m-181 0v-19m-7 5 7 5 7-11m137 20v-23m-7 8 7 5 7-12" />
  </svg>
)}

<style>
  svg {
    width: 100%;
    height: 100%;
  }

  .scene-wash {
    fill: var(--accent-soft);
    stroke: none;
    opacity: 0.65;
  }

  .device-fill {
    fill: var(--surface);
  }

  .bubble-fill {
    fill: var(--surface-2);
    stroke: none;
  }
</style>
```

- [ ] **Step 7：修改 `src/pages/index.astro`**

1. frontmatter：刪掉 `const luggage = [ ... ];`（第 6–13 行），在 import 區加上：
   ```astro
   import SceneArt from '../components/SceneArt.astro';
   import { luggage } from '../data/luggage';
   ```
2. 第一個 `<div class="scene-art" aria-hidden="true">` 裡的整段 `<svg>…</svg>` 換成 `<SceneArt variant="home" />`；第二個換成 `<SceneArt variant="mobile" />`。外層的 `<div class="scene-art" aria-hidden="true">` 保留。
3. `<style>` 裡刪掉這四條規則（它們已經搬進 `SceneArt.astro`，因為 Astro 的 scoped style 不會套用到子元件內部的元素）：
   ```css
   .scene-art svg { width: 100%; height: 100%; }
   .scene-wash { fill: var(--accent-soft); stroke: none; opacity: 0.65; }
   .device-fill { fill: var(--surface); }
   .bubble-fill { fill: var(--surface-2); stroke: none; }
   ```
   `.scene-art { height: 128px; margin-bottom: 16px; color: var(--accent); }` 和 media query 裡的 `.scene-art` 都保留。

- [ ] **Step 8：確認首頁輸出的 markup 沒有變**

```bash
npm run build
node -e "const fs=require('fs');const n=s=>s.replace(/<style[\s\S]*?<\/style>/g,'').replace(/<link[^>]*stylesheet[^>]*>/g,'').replace(/ data-astro-cid-[a-z0-9]+(=\"[^\"]*\")?/g,'');const a=n(fs.readFileSync(process.argv[1],'utf8')),b=n(fs.readFileSync(process.argv[2],'utf8'));console.log(a===b?'SAME':'DIFF');if(a!==b){let i=0;while(a[i]===b[i])i++;console.log(a.slice(i-200,i+200));console.log('---');console.log(b.slice(i-200,i+200));}" "$TEMP/home-before.html" dist/index.html
```
預期：`SAME`。如果是 `DIFF`，看印出來的差異位置；只有空白不同可以接受，其他差異就要修到一致。

- [ ] **Step 9：全部測試和型別檢查**

Run: `npm test && npm run typecheck`
預期：全部 PASS，`astro check` 沒有 error。

- [ ] **Step 10：Commit**

```bash
git add src/data/luggage.ts src/data/luggage.test.ts src/components/SceneArt.astro src/pages/index.astro
git commit -m "refactor: 首頁行囊資料與場景插圖拆成共用素材

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

> 給 orchestrator：這個 task 完成後，用瀏覽器在手機（375px）和桌機寬度、亮暗兩個主題下看一次首頁的「故事隨行」區塊，確認插圖顏色和大小都沒變。

---

### Task 2：主題換色工具 `intro-theme.ts`

**Files:**
- Create: `src/lib/intro-theme.ts`
- Test: `src/lib/intro-theme.test.ts`

**Interfaces:**
- Produces:
  - `export interface ThemeTokens { light: Record<string, string>; dark: Record<string, string> }`
  - `export function parseThemeTokens(css: string): ThemeTokens`
  - `export function themeShiftNames(tokens: ThemeTokens): string[]`：回傳暗色區塊的所有變數名稱；只要有任何一個在亮色區塊找不到，就 throw。
  - `export function propertySyntax(value: string): '<number>' | '<color>'`
  - `export function themeKeyframes(tokens: ThemeTokens): { dark: Keyframe; light: Keyframe }`
  - `export function registerThemeProperties(tokens: ThemeTokens, register?: (definition: PropertyDefinition) => void): void`

- [ ] **Step 1：寫會失敗的測試** `src/lib/intro-theme.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import themeCss from '../styles/theme.css?raw';
import { parseThemeTokens, propertySyntax, registerThemeProperties, themeKeyframes, themeShiftNames } from './intro-theme';

const SAMPLE = `:root {
  --font-sans: 'Noto Sans TC', sans-serif;
  --bg: #f3f1ec;
  --glow-opacity: 0.45;
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --bg: #10151d;
  --glow-opacity: 0.55;
}`;

describe('parseThemeTokens', () => {
  it('reads the light and dark blocks', () => {
    expect(parseThemeTokens(SAMPLE)).toEqual({
      light: { '--font-sans': "'Noto Sans TC', sans-serif", '--bg': '#f3f1ec', '--glow-opacity': '0.45' },
      dark: { '--bg': '#10151d', '--glow-opacity': '0.55' },
    });
  });
  it('throws when a block is missing', () => {
    expect(() => parseThemeTokens(':root { --bg: #fff; }')).toThrow(/data-theme/);
  });
});

describe('themeShiftNames', () => {
  it('shifts every dark token', () => {
    expect(themeShiftNames(parseThemeTokens(SAMPLE))).toEqual(['--bg', '--glow-opacity']);
  });
  it('throws when a dark token has no light value', () => {
    expect(() => themeShiftNames({ light: {}, dark: { '--bg': '#000000' } })).toThrow(/--bg/);
  });
});

describe('propertySyntax', () => {
  it('detects numbers and colors', () => {
    expect(propertySyntax('0.45')).toBe('<number>');
    expect(propertySyntax('0')).toBe('<number>');
    expect(propertySyntax('#10151d')).toBe('<color>');
    expect(propertySyntax('rgba(255, 255, 255, 0.28)')).toBe('<color>');
  });
});

describe('themeKeyframes', () => {
  it('pairs dark and light values for the same names', () => {
    expect(themeKeyframes(parseThemeTokens(SAMPLE))).toEqual({
      dark: { '--bg': '#10151d', '--glow-opacity': '0.55' },
      light: { '--bg': '#f3f1ec', '--glow-opacity': '0.45' },
    });
  });
});

describe('registerThemeProperties', () => {
  it('registers each token with its syntax and the dark value', () => {
    const seen: PropertyDefinition[] = [];
    registerThemeProperties(parseThemeTokens(SAMPLE), definition => { seen.push(definition); });
    expect(seen).toEqual([
      { name: '--bg', syntax: '<color>', inherits: true, initialValue: '#10151d' },
      { name: '--glow-opacity', syntax: '<number>', inherits: true, initialValue: '0.55' },
    ]);
  });
  it('ignores properties that are already registered', () => {
    const register = () => { throw new DOMException('already registered', 'InvalidModificationError'); };
    expect(() => registerThemeProperties(parseThemeTokens(SAMPLE), register)).not.toThrow();
  });
  it('rethrows other errors', () => {
    const register = () => { throw new DOMException('bad syntax', 'SyntaxError'); };
    expect(() => registerThemeProperties(parseThemeTokens(SAMPLE), register)).toThrow(/bad syntax/);
  });
});

describe('the real theme.css', () => {
  const tokens = parseThemeTokens(themeCss);
  it('has a light value for every dark token', () => {
    expect(() => themeShiftNames(tokens)).not.toThrow();
  });
  it('uses the same syntax in both themes', () => {
    for (const name of themeShiftNames(tokens)) {
      expect(propertySyntax(tokens.light[name]), name).toBe(propertySyntax(tokens.dark[name]));
    }
  });
  it('shifts the sky and cloud tokens but not the fonts', () => {
    const names = themeShiftNames(tokens);
    expect(names).toEqual(expect.arrayContaining(['--sky-1', '--bank-4', '--puff-1', '--glow', '--glow-opacity', '--star-opacity', '--sky-text']));
    expect(names).not.toContain('--font-sans');
  });
});
```

- [ ] **Step 2：跑測試，確認失敗**

Run: `npx vitest run src/lib/intro-theme.test.ts`
預期：FAIL，找不到 `./intro-theme`。

- [ ] **Step 3：實作 `src/lib/intro-theme.ts`**

```ts
export interface ThemeTokens {
  light: Record<string, string>;
  dark: Record<string, string>;
}

const LIGHT_SELECTOR = ':root';
const DARK_SELECTOR = ":root[data-theme='dark']";

function readBlock(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Theme block not found: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const tokens: Record<string, string> = {};
  for (const match of css.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

export function parseThemeTokens(css: string): ThemeTokens {
  return { light: readBlock(css, LIGHT_SELECTOR), dark: readBlock(css, DARK_SELECTOR) };
}

/** Every token the dark theme overrides is a color or a number, so all of them can be tweened. */
export function themeShiftNames(tokens: ThemeTokens): string[] {
  const names = Object.keys(tokens.dark);
  const missing = names.filter(name => !(name in tokens.light));
  if (missing.length > 0) throw new Error(`Missing light values for: ${missing.join(', ')}`);
  return names;
}

export function propertySyntax(value: string): '<number>' | '<color>' {
  return /^-?(\d+\.?\d*|\.\d+)$/.test(value) ? '<number>' : '<color>';
}

export function themeKeyframes(tokens: ThemeTokens): { dark: Keyframe; light: Keyframe } {
  const names = themeShiftNames(tokens);
  return {
    dark: Object.fromEntries(names.map(name => [name, tokens.dark[name]])),
    light: Object.fromEntries(names.map(name => [name, tokens.light[name]])),
  };
}

/** Unregistered custom properties swap at 50%; registering them lets the browser tween between themes. */
export function registerThemeProperties(
  tokens: ThemeTokens,
  register: (definition: PropertyDefinition) => void = definition => CSS.registerProperty(definition),
): void {
  for (const name of themeShiftNames(tokens)) {
    try {
      register({ name, syntax: propertySyntax(tokens.dark[name]), inherits: true, initialValue: tokens.dark[name] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'InvalidModificationError')) throw error;
    }
  }
}
```

- [ ] **Step 4：跑測試，確認通過**

Run: `npx vitest run src/lib/intro-theme.test.ts`
預期：全部 PASS。

- [ ] **Step 5：Commit**

```bash
git add src/lib/intro-theme.ts src/lib/intro-theme.test.ts
git commit -m "feat: 介紹動畫的主題換色工具

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3：時間軸核心 `intro-timeline.ts`

**Files:**
- Create: `src/lib/intro-timeline.ts`
- Test: `src/lib/intro-timeline.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface IntroStep {
    target: string;      // CSS selector inside the stage; ':scope' means the stage itself
    at: number;          // ms
    duration: number;    // ms
    keyframes: Keyframe[];
    easing?: string;     // default 'ease'
    stagger?: number;    // extra delay per matched element, in document order
    count?: number;      // expected number of matched elements; required when stagger is set
  }
  export interface IntroCaption { target: string; in: number; out: number }
  export interface IntroScene { id: string; start: number; end: number; steps: IntroStep[]; captions: IntroCaption[] }
  export interface IntroPlayer { duration: number; seek(ms: number): void; play(): void }
  export const CAPTION_FADE_IN = 500;
  export const CAPTION_FADE_OUT = 400;
  export const MIN_CAPTION_DWELL = 2500;
  export function stepEnd(step: IntroStep): number;
  export function captionSteps(caption: IntroCaption, duration: number): IntroStep[];
  export function flattenSteps(scenes: IntroScene[], ambient: IntroStep[], duration: number): IntroStep[];
  export function createPlayer(root: Element, steps: IntroStep[], duration: number): IntroPlayer;
  ```

- [ ] **Step 1：寫會失敗的測試** `src/lib/intro-timeline.test.ts`

`createPlayer` 需要 DOM，在 Task 5 用瀏覽器驗證；這裡只測純函式。

```ts
import { describe, expect, it } from 'vitest';
import { CAPTION_FADE_IN, CAPTION_FADE_OUT, captionSteps, flattenSteps, stepEnd, type IntroScene, type IntroStep } from './intro-timeline';

const step = (at: number, extra: Partial<IntroStep> = {}): IntroStep => ({ target: '.x', at, duration: 100, keyframes: [], ...extra });

describe('stepEnd', () => {
  it('adds the duration to the start', () => {
    expect(stepEnd(step(1000))).toBe(1100);
  });
  it('includes the stagger of the last element', () => {
    expect(stepEnd(step(1000, { stagger: 50, count: 4 }))).toBe(1000 + 150 + 100);
  });
});

describe('captionSteps', () => {
  it('fades in at `in` and finishes fading out at `out`', () => {
    const [fadeIn, fadeOut] = captionSteps({ target: '.c', in: 1000, out: 4000 }, 31000);
    expect(fadeIn).toMatchObject({ target: '.c', at: 1000, duration: CAPTION_FADE_IN });
    expect(fadeIn.keyframes[0]).toMatchObject({ opacity: 0 });
    expect(fadeIn.keyframes[1]).toMatchObject({ opacity: 1 });
    expect(fadeOut).toMatchObject({ target: '.c', at: 4000 - CAPTION_FADE_OUT, duration: CAPTION_FADE_OUT });
    expect(fadeOut.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
  });
  it('keeps the last captions on screen', () => {
    expect(captionSteps({ target: '.c', in: 26000, out: 31000 }, 31000)).toHaveLength(1);
  });
});

describe('flattenSteps', () => {
  it('merges ambient, scene and caption steps sorted by start time', () => {
    const scenes: IntroScene[] = [
      { id: 'a', start: 0, end: 5000, steps: [step(3000)], captions: [{ target: '.c', in: 1000, out: 4000 }] },
    ];
    const starts = flattenSteps(scenes, [step(0), step(2000)], 31000).map(s => s.at);
    expect(starts).toEqual([0, 1000, 2000, 3000, 3600]);
  });
  it('keeps the original order for steps that start together', () => {
    const scenes: IntroScene[] = [
      { id: 'a', start: 0, end: 5000, steps: [step(500, { target: '.first' }), step(500, { target: '.second' })], captions: [] },
    ];
    expect(flattenSteps(scenes, [], 31000).map(s => s.target)).toEqual(['.first', '.second']);
  });
});
```

- [ ] **Step 2：跑測試，確認失敗**

Run: `npx vitest run src/lib/intro-timeline.test.ts`
預期：FAIL，找不到 `./intro-timeline`。

- [ ] **Step 3：實作 `src/lib/intro-timeline.ts`**

```ts
export interface IntroStep {
  /** CSS selector inside the stage; ':scope' targets the stage itself. */
  target: string;
  at: number;
  duration: number;
  keyframes: Keyframe[];
  easing?: string;
  /** Extra delay per matched element, in document order. */
  stagger?: number;
  /** Expected number of matched elements; required with stagger so the end time is known. */
  count?: number;
}

export interface IntroCaption {
  target: string;
  in: number;
  out: number;
}

export interface IntroScene {
  id: string;
  start: number;
  end: number;
  steps: IntroStep[];
  captions: IntroCaption[];
}

export interface IntroPlayer {
  duration: number;
  seek(ms: number): void;
  play(): void;
}

export const CAPTION_FADE_IN = 500;
export const CAPTION_FADE_OUT = 400;
export const MIN_CAPTION_DWELL = 2500;

export function stepEnd(step: IntroStep): number {
  return step.at + (step.stagger ?? 0) * ((step.count ?? 1) - 1) + step.duration;
}

export function captionSteps(caption: IntroCaption, duration: number): IntroStep[] {
  const steps: IntroStep[] = [{
    target: caption.target,
    at: caption.in,
    duration: CAPTION_FADE_IN,
    easing: 'ease-out',
    keyframes: [{ opacity: 0, translate: '0 12px' }, { opacity: 1, translate: '0 0' }],
  }];
  if (caption.out < duration) {
    steps.push({ target: caption.target, at: caption.out - CAPTION_FADE_OUT, duration: CAPTION_FADE_OUT, easing: 'ease-in', keyframes: [{ opacity: 1 }, { opacity: 0 }] });
  }
  return steps;
}

/**
 * Animations created later win when they touch the same property, so steps are created in start order.
 * Array.prototype.sort is stable: steps that start together keep their written order.
 */
export function flattenSteps(scenes: IntroScene[], ambient: IntroStep[], duration: number): IntroStep[] {
  const steps = [
    ...ambient,
    ...scenes.flatMap(scene => [...scene.steps, ...scene.captions.flatMap(caption => captionSteps(caption, duration))]),
  ];
  return steps.sort((a, b) => a.at - b.at);
}

export function createPlayer(root: Element, steps: IntroStep[], duration: number): IntroPlayer {
  const animations: Animation[] = [];
  for (const step of steps) {
    const elements = step.target === ':scope' ? [root] : Array.from(root.querySelectorAll(step.target));
    if (elements.length === 0) throw new Error(`Intro step target not found: ${step.target}`);
    if (step.count !== undefined && elements.length !== step.count) {
      throw new Error(`Intro step ${step.target} expected ${step.count} elements, found ${elements.length}`);
    }
    elements.forEach((element, index) => {
      // fill 'forwards' only: a backwards fill would paint a step's first frame before it starts and hide earlier steps.
      const effect = new KeyframeEffect(element, step.keyframes, {
        delay: step.at + (step.stagger ?? 0) * index,
        duration: step.duration,
        easing: step.easing ?? 'ease',
        fill: 'forwards',
      });
      const animation = new Animation(effect, document.timeline);
      animation.pause();
      animation.currentTime = 0;
      animations.push(animation);
    });
  }
  return {
    duration,
    seek(ms) {
      const time = Math.min(Math.max(ms, 0), duration);
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = time;
      }
    },
    play() {
      for (const animation of animations) {
        animation.currentTime = 0;
        animation.play();
      }
    },
  };
}
```

- [ ] **Step 4：跑測試，確認通過**

Run: `npx vitest run src/lib/intro-timeline.test.ts`
預期：全部 PASS。

- [ ] **Step 5：Commit**

```bash
git add src/lib/intro-timeline.ts src/lib/intro-timeline.test.ts
git commit -m "feat: 介紹動畫的時間軸核心

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4：5 幕的動作資料 `intro-scenes.ts`

**Files:**
- Create: `src/lib/intro-scenes.ts`
- Test: `src/lib/intro-scenes.test.ts`

**Interfaces:**
- Consumes: `IntroScene`、`IntroStep`、`stepEnd`、`MIN_CAPTION_DWELL`、`CAPTION_FADE_IN`（Task 3）；`luggage`（Task 1）；`themeKeyframes` 的回傳型別 `{ dark: Keyframe; light: Keyframe }`（Task 2）
- Produces:
  - `export const INTRO_DURATION = 31000`
  - `export const FINAL_HOLD = 3000`
  - `export const STAGE_CENTER = { x: 270, y: 560 }`
  - `export const SCATTER: ReadonlyArray<readonly [number, number]>`：第 2 幕 6 個圖示散落的位置，相對於 `STAGE_CENTER`
  - `export const RING: ReadonlyArray<readonly [number, number]>`：第 4 幕圖示圍繞新視窗的位置
  - `export const ROUTE_OFFSETS: ReadonlyArray<readonly [number, number]>`：行囊在三個站點的位置
  - `export const AMBIENT_STEPS: IntroStep[]`
  - `export function buildScenes(theme: { dark: Keyframe; light: Keyframe }): IntroScene[]`
- Markup 需要的 `data-intro` 名稱（Task 5 必須全部提供）：`hero-eyebrow`、`hero-title`、`cap-elsewhere`、`cap-packing`、`cap-luggage`、`cap-route`、`cap-unpack`、`cap-farewell`、`brand`、`dawn`、`scene-home`、`scene-mobile`、`threads`、`window`、`window-next`、`route`、`stop-0`、`stop-1`、`stop-2`、`bundle`、`bundle-glow`、`bundle-cloud`、`items`、`item-0` 到 `item-5`。另外會用到這些 class：`.cloud-sky__stars circle`（7 個）、`.cloud-sky__bank`、`.cloud-sky__puff`、`.intro-scene__art`、`.bubble-fill`（home 2 個、mobile 3 個）、`.intro-item__icon`（6 個）、`.intro-item__name`（6 個）、`.intro-route__lit`。

- [ ] **Step 1：寫會失敗的測試** `src/lib/intro-scenes.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import themeCss from '../styles/theme.css?raw';
import { parseThemeTokens, themeKeyframes } from './intro-theme';
import { AMBIENT_STEPS, FINAL_HOLD, INTRO_DURATION, RING, ROUTE_OFFSETS, SCATTER, buildScenes } from './intro-scenes';
import { MIN_CAPTION_DWELL, stepEnd } from './intro-timeline';

const scenes = buildScenes(themeKeyframes(parseThemeTokens(themeCss)));

describe('intro scenes', () => {
  it('has the five storyboard scenes in order', () => {
    expect(scenes.map(scene => scene.id)).toEqual(['hero', 'elsewhere', 'luggage', 'route', 'farewell']);
  });
  it('runs between 30 and 32 seconds', () => {
    expect(INTRO_DURATION).toBeGreaterThanOrEqual(30000);
    expect(INTRO_DURATION).toBeLessThanOrEqual(32000);
  });
  it('places scenes back to back with no gaps', () => {
    expect(scenes[0].start).toBe(0);
    scenes.slice(1).forEach((scene, index) => expect(scene.start, scene.id).toBe(scenes[index].end));
    expect(scenes.at(-1)?.end).toBe(INTRO_DURATION);
  });
  it('keeps every caption on screen for at least 2.5 seconds', () => {
    for (const scene of scenes) {
      for (const caption of scene.captions) {
        expect(caption.out - caption.in, caption.target).toBeGreaterThanOrEqual(MIN_CAPTION_DWELL);
      }
    }
  });
  it('keeps captions inside their scene', () => {
    for (const scene of scenes) {
      for (const caption of scene.captions) {
        expect(caption.in, caption.target).toBeGreaterThanOrEqual(scene.start);
        expect(caption.out, caption.target).toBeLessThanOrEqual(scene.end);
      }
    }
  });
  it('keeps steps inside their scene', () => {
    for (const scene of scenes) {
      for (const step of scene.steps) {
        expect(step.at, `${scene.id} ${step.target}`).toBeGreaterThanOrEqual(scene.start);
        expect(stepEnd(step), `${scene.id} ${step.target}`).toBeLessThanOrEqual(scene.end);
      }
    }
  });
  it('declares a count on every staggered step', () => {
    for (const step of [...AMBIENT_STEPS, ...scenes.flatMap(scene => scene.steps)]) {
      if (step.stagger !== undefined) expect(step.count, step.target).toBeGreaterThan(0);
    }
  });
  it('holds still for the final three seconds', () => {
    const lastMotion = Math.max(
      ...AMBIENT_STEPS.map(stepEnd),
      ...scenes.flatMap(scene => scene.steps.map(stepEnd)),
      ...scenes.flatMap(scene => scene.captions.map(caption => (caption.out < INTRO_DURATION ? caption.out : caption.in + 500))),
    );
    expect(lastMotion).toBeLessThanOrEqual(INTRO_DURATION - FINAL_HOLD);
  });
  it('shifts the theme once, during the route scene', () => {
    const shifts = scenes.flatMap(scene => scene.steps.filter(step => step.target === ':scope').map(step => ({ scene: scene.id, step })));
    expect(shifts).toHaveLength(1);
    expect(shifts[0].scene).toBe('route');
    expect(shifts[0].step.keyframes[0]).toHaveProperty('--sky-1');
  });
  it('has a position for each luggage item', () => {
    expect(SCATTER).toHaveLength(6);
    expect(RING).toHaveLength(6);
    expect(ROUTE_OFFSETS).toHaveLength(3);
  });
});
```

- [ ] **Step 2：跑測試，確認失敗**

Run: `npx vitest run src/lib/intro-scenes.test.ts`
預期：FAIL，找不到 `./intro-scenes`。

- [ ] **Step 3：實作 `src/lib/intro-scenes.ts`**

座標都是相對於舞台中央偏下的 `STAGE_CENTER`（270, 560）。這個點同時是聊天視窗、行囊、圖示的中心。字幕區在 y 150–330，所以散落的圖示一律放在 y 360 以下。

```ts
import { luggage } from '../data/luggage';
import type { IntroScene, IntroStep } from './intro-timeline';

export const INTRO_DURATION = 31000;
export const FINAL_HOLD = 3000;
export const STAGE_CENTER = { x: 270, y: 560 } as const;

type Offset = readonly [number, number];

/** Scene 2: the six items lie around, waiting to be packed. */
export const SCATTER: ReadonlyArray<Offset> = [[-175, -140], [165, -150], [-195, 10], [190, -5], [-150, 150], [160, 140]];
/** Scene 4: the items unpack around the next chat window, in the home page's left/right rows. */
export const RING: ReadonlyArray<Offset> = luggage.map(item => [item.side === 'left' ? -190 : 190, (item.row - 2) * 95] as const);
/** Scene 4: the bundle rides from stop 01 (bottom) up to stop 03. */
export const ROUTE_OFFSETS: ReadonlyArray<Offset> = [[-150, 100], [-150, -20], [-150, -140]];

const px = ([x, y]: Offset) => `${x}px ${y}px`;
const ORIGIN = '0px 0px';
const item = (index: number) => `[data-intro="item-${index}"]`;
const intro = (name: string) => `[data-intro="${name}"]`;

export const AMBIENT_STEPS: IntroStep[] = [
  { target: '.cloud-sky__puff', at: 0, duration: 26000, easing: 'linear', keyframes: [{ translate: '30px 0' }, { translate: '-30px 0' }] },
];

export function buildScenes(theme: { dark: Keyframe; light: Keyframe }): IntroScene[] {
  return [
    {
      id: 'hero',
      start: 0,
      end: 5000,
      steps: [
        { target: '.cloud-sky__stars circle', at: 0, duration: 600, stagger: 250, count: 7, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: '.cloud-sky__bank', at: 300, duration: 1800, easing: 'cubic-bezier(.2,.7,.2,1)', keyframes: [{ translate: '0 100%' }, { translate: '0 0' }] },
        { target: '.cloud-sky__puff', at: 800, duration: 1200, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
      ],
      captions: [
        { target: intro('hero-eyebrow'), in: 1200, out: 4700 },
        { target: intro('hero-title'), in: 1800, out: 4700 },
      ],
    },
    {
      id: 'elsewhere',
      start: 5000,
      end: 12000,
      steps: [
        { target: intro('scene-home'), at: 5200, duration: 400, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: `${intro('scene-home')} .intro-scene__art`, at: 5200, duration: 1400, easing: 'ease-in-out', keyframes: [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }] },
        { target: `${intro('scene-home')} .bubble-fill`, at: 6400, duration: 300, stagger: 250, count: 2, keyframes: [{ opacity: 0, scale: '0.4' }, { opacity: 1, scale: '1' }] },
        { target: intro('scene-home'), at: 7600, duration: 600, easing: 'ease-in', keyframes: [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '-120px 0' }] },
        { target: intro('scene-mobile'), at: 7800, duration: 600, easing: 'ease-out', keyframes: [{ opacity: 0, translate: '120px 0' }, { opacity: 1, translate: '0 0' }] },
        { target: `${intro('scene-mobile')} .bubble-fill`, at: 8300, duration: 300, stagger: 200, count: 3, keyframes: [{ opacity: 0, scale: '0.4' }, { opacity: 1, scale: '1' }] },
        { target: intro('scene-mobile'), at: 9200, duration: 500, keyframes: [{ opacity: 1, scale: '1' }, { opacity: 0.25, scale: '0.85' }] },
        ...SCATTER.map((offset, index): IntroStep => ({
          target: item(index), at: 9300 + index * 120, duration: 500, easing: 'cubic-bezier(.2,.8,.3,1.2)',
          keyframes: [{ opacity: 0, scale: '0.6', translate: px(offset) }, { opacity: 1, scale: '1', translate: px(offset) }],
        })),
        { target: '.intro-item__icon', at: 9900, duration: 1500, stagger: 90, count: 6, keyframes: [{ rotate: '0deg' }, { rotate: '-7deg' }, { rotate: '6deg' }, { rotate: '-4deg' }, { rotate: '0deg' }] },
        { target: intro('scene-mobile'), at: 11400, duration: 500, keyframes: [{ opacity: 0.25 }, { opacity: 0 }] },
      ],
      captions: [
        { target: intro('cap-elsewhere'), in: 5400, out: 8600 },
        { target: intro('cap-packing'), in: 9100, out: 11900 },
      ],
    },
    {
      id: 'luggage',
      start: 12000,
      end: 19000,
      steps: [
        { target: intro('window'), at: 12300, duration: 600, easing: 'ease-out', keyframes: [{ opacity: 0, scale: '0.9' }, { opacity: 1, scale: '1' }] },
        { target: intro('threads'), at: 12800, duration: 400, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: '.intro-item__name', at: 13000, duration: 250, stagger: 450, count: 6, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        ...SCATTER.map((offset, index): IntroStep => ({
          target: item(index), at: 13500 + index * 450, duration: 650, easing: 'cubic-bezier(.5,0,.3,1)',
          keyframes: [{ opacity: 1, scale: '1', translate: px(offset) }, { opacity: 0, scale: '0.35', translate: ORIGIN }],
        })),
        { target: intro('dawn'), at: 14000, duration: 4500, easing: 'linear', keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('threads'), at: 16400, duration: 400, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
        { target: intro('window'), at: 16600, duration: 700, easing: 'ease-in', keyframes: [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.4' }] },
        { target: intro('bundle'), at: 17000, duration: 700, easing: 'cubic-bezier(.2,.8,.3,1.2)', keyframes: [{ opacity: 0, scale: '0.5', translate: ORIGIN }, { opacity: 1, scale: '1', translate: ORIGIN }] },
        { target: intro('bundle-glow'), at: 17400, duration: 1000, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
      ],
      captions: [
        { target: intro('cap-luggage'), in: 12500, out: 18800 },
      ],
    },
    {
      id: 'route',
      start: 19000,
      end: 26000,
      steps: [
        { target: intro('dawn'), at: 19000, duration: 2000, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
        { target: intro('route'), at: 19000, duration: 500, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('bundle-cloud'), at: 19200, duration: 400, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('bundle'), at: 19200, duration: 700, easing: 'ease-in-out', keyframes: [{ translate: ORIGIN }, { translate: px(ROUTE_OFFSETS[0]) }] },
        { target: ':scope', at: 19500, duration: 5000, easing: 'ease-in-out', keyframes: [theme.dark, theme.light] },
        { target: `${intro('stop-0')} .intro-route__lit`, at: 19900, duration: 300, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('bundle'), at: 20300, duration: 900, easing: 'ease-in-out', keyframes: [{ translate: px(ROUTE_OFFSETS[0]) }, { translate: px(ROUTE_OFFSETS[1]) }] },
        { target: `${intro('stop-1')} .intro-route__lit`, at: 21200, duration: 300, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('bundle'), at: 21600, duration: 900, easing: 'ease-in-out', keyframes: [{ translate: px(ROUTE_OFFSETS[1]) }, { translate: px(ROUTE_OFFSETS[2]) }] },
        { target: `${intro('stop-2')} .intro-route__lit`, at: 22500, duration: 300, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('route'), at: 22700, duration: 400, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
        { target: intro('bundle'), at: 22700, duration: 600, easing: 'ease-in-out', keyframes: [{ translate: px(ROUTE_OFFSETS[2]) }, { translate: ORIGIN }] },
        { target: intro('bundle-cloud'), at: 22900, duration: 400, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
        { target: intro('window-next'), at: 23200, duration: 600, easing: 'ease-out', keyframes: [{ opacity: 0, scale: '0.9' }, { opacity: 1, scale: '1' }] },
        { target: intro('bundle'), at: 23300, duration: 400, easing: 'ease-in', keyframes: [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.3' }] },
        ...RING.map((offset, index): IntroStep => ({
          target: item(index), at: 23500 + index * 120, duration: 600, easing: 'cubic-bezier(.2,.8,.3,1)',
          keyframes: [{ opacity: 0, scale: '0.35', translate: ORIGIN }, { opacity: 1, scale: '1', translate: px(offset) }],
        })),
        { target: intro('window-next'), at: 25400, duration: 500, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
        { target: intro('items'), at: 25400, duration: 500, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
      ],
      captions: [
        { target: intro('cap-route'), in: 19300, out: 22600 },
        { target: intro('cap-unpack'), in: 23000, out: 25800 },
      ],
    },
    {
      id: 'farewell',
      start: 26000,
      end: INTRO_DURATION,
      steps: [],
      captions: [
        { target: intro('cap-farewell'), in: 26300, out: INTRO_DURATION },
        { target: intro('brand'), in: 27000, out: INTRO_DURATION },
      ],
    },
  ];
}
```

- [ ] **Step 4：跑測試，確認通過**

Run: `npx vitest run src/lib/intro-scenes.test.ts`
預期：全部 PASS。如果「holds still」失敗，是某個動作結束得太晚，把它提早，不要改 `FINAL_HOLD`。

- [ ] **Step 5：Commit**

```bash
git add src/lib/intro-scenes.ts src/lib/intro-scenes.test.ts
git commit -m "feat: 介紹動畫五幕的動作資料

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5：動畫頁面 `/intro/`

**Files:**
- Create: `src/lib/intro-boot.ts`
- Create: `src/pages/intro.astro`
- Create: `src/styles/intro.css`

**Interfaces:**
- Consumes: Task 1–4 的全部輸出。
- Produces（給 Task 6 的輸出腳本）：
  - `window.__intro: IntroPlayer`
  - 啟動完成後 `document.documentElement.dataset.introReady === 'true'`；失敗時改為 `dataset.introError` 帶錯誤訊息
  - `?export` 會停在第 0 毫秒；`?t=<秒>` 會停在指定秒數；沒有參數時自動播放

- [ ] **Step 1：建立 `src/lib/intro-boot.ts`**

```ts
import themeCss from '../styles/theme.css?raw';
import { parseThemeTokens, registerThemeProperties, themeKeyframes } from './intro-theme';
import { AMBIENT_STEPS, INTRO_DURATION, buildScenes } from './intro-scenes';
import { createPlayer, flattenSteps, type IntroPlayer } from './intro-timeline';

declare global {
  interface Window {
    __intro?: IntroPlayer;
  }
}

async function boot() {
  const stage = document.querySelector('[data-intro-stage]');
  if (!stage) throw new Error('Intro stage not found');
  const tokens = parseThemeTokens(themeCss);
  registerThemeProperties(tokens);
  await document.fonts.ready;

  const steps = flattenSteps(buildScenes(themeKeyframes(tokens)), AMBIENT_STEPS, INTRO_DURATION);
  const player = createPlayer(stage, steps, INTRO_DURATION);
  window.__intro = player;

  const params = new URLSearchParams(location.search);
  const seconds = params.get('t');
  if (params.has('export')) player.seek(0);
  else if (seconds !== null) player.seek(Number(seconds) * 1000);
  else player.play();
  document.documentElement.dataset.introReady = 'true';
}

boot().catch(error => {
  document.documentElement.dataset.introError = String(error);
  console.error(error);
});
```

- [ ] **Step 2：建立 `src/pages/intro.astro`**

`<head>` 的字型連結跟 `src/layouts/SiteLayout.astro` 第 35–37 行相同。`<html>` 固定是 `data-theme="dark"`，也不放 `INIT_THEME_SCRIPT`，因為動畫一定從暗色開場。換色動畫加在舞台 `[data-intro-stage]` 上；`.sky-scope` 放在裡面一層，這樣 `.sky-scope` 對 `--text` 等變數的重新對應，才不會被舞台上的補間蓋掉。

```astro
---
import '../styles/theme.css';
import '../styles/global.css';
import '../styles/intro.css';
import CloudSky from '../components/CloudSky.astro';
import SceneArt from '../components/SceneArt.astro';
import { luggage } from '../data/luggage';
import { SCATTER, STAGE_CENTER } from '../lib/intro-scenes';

const routeStops = [
  { number: '01', tag: '目前的酒館', title: '收好這扇窗的行囊' },
  { number: '02', tag: '自己的 Google Drive', title: '故事在雲端陪你一起旅行' },
  { number: '03', tag: '另一座酒館', title: '展開行囊，接著聊下去' }
];
const driveIcon = 'M20 16.5A5 5 0 0 0 18 7a6 6 0 0 0-11.7 1A4.5 4.5 0 0 0 5 17h3m4 4V11m-4 4 4-4 4 4';
---
<!doctype html>
<html lang="zh-Hant" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=540" />
    <meta name="robots" content="noindex" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@700;900&display=swap" />
    <title>TavernRoamer 介紹動畫</title>
  </head>
  <body class="intro-body">
    <div class="intro-stage" data-intro-stage>
      <div class="intro-sky sky-scope">
        <CloudSky variant="full" />
        <div class="intro-dawn" data-intro="dawn"></div>

        <div class="intro-hero">
          <div class="eyebrow" data-intro="hero-eyebrow">TavernRoamer · 雲端漫遊</div>
          <h1 data-intro="hero-title">讓故事乘著雲，<br /><em>在各處酒館之間漫遊。</em></h1>
        </div>

        <div class="intro-captions">
          <h2 class="intro-caption" data-intro="cap-elsewhere">換個地方，<br />還想接著那句未完的話。</h2>
          <h2 class="intro-caption" data-intro="cap-packing">卻總得逐一搬好<br />聊天紀錄與搭配的素材。</h2>
          <h2 class="intro-caption" data-intro="cap-luggage">每一扇聊天視窗，<br />都有一份自己的故事行囊。</h2>
          <h2 class="intro-caption" data-intro="cap-route">在這座酒館收好，<br />到下一座酒館展開。</h2>
          <h2 class="intro-caption" data-intro="cap-unpack">展開行囊，<br />接著聊下去。</h2>
          <h2 class="intro-caption" data-intro="cap-farewell">故事在雲端漫遊，<br />陪你一起旅行</h2>
        </div>

        <figure class="intro-scene" data-intro="scene-home">
          <div class="intro-scene__art"><SceneArt variant="home" /></div>
          <figcaption class="tag">在家 · 本機酒館</figcaption>
        </figure>
        <figure class="intro-scene" data-intro="scene-mobile">
          <div class="intro-scene__art"><SceneArt variant="mobile" /></div>
          <figcaption class="tag">出門 · 雲端酒館</figcaption>
        </figure>

        <svg class="intro-threads" data-intro="threads" viewBox="0 0 540 960">
          {SCATTER.map(([x, y]) => <line x1={STAGE_CENTER.x + x} y1={STAGE_CENTER.y + y} x2={STAGE_CENTER.x} y2={STAGE_CENTER.y} />)}
        </svg>

        <div class="intro-window" data-intro="window">
          <div class="intro-window__bar"><span class="intro-window__dots"><i></i><i></i><i></i></span><span>一段未完的故事</span></div>
          <div class="intro-window__body"><h3>目前的聊天視窗</h3><p>這段故事與搭配的素材</p></div>
        </div>
        <div class="intro-window" data-intro="window-next">
          <div class="intro-window__bar"><span class="intro-window__dots"><i></i><i></i><i></i></span><span>一段未完的故事</span></div>
          <div class="intro-window__body"><h3>另一座酒館</h3><p>接著聊下去</p></div>
        </div>

        <ol class="intro-route" data-intro="route">
          {routeStops.map((stop, index) => (
            <li data-intro={`stop-${index}`}>
              <span class="intro-route__number">{stop.number}<span class="intro-route__lit">{index === 1
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d={driveIcon} /></svg>
                : stop.number}</span></span>
              <span class="intro-route__copy"><span class="tag">{stop.tag}</span><h3>{stop.title}</h3></span>
            </li>
          ))}
        </ol>

        <div class="intro-bundle" data-intro="bundle">
          <div class="intro-bundle__glow" data-intro="bundle-glow"></div>
          <svg class="intro-bundle__cloud" data-intro="bundle-cloud" viewBox="0 0 128 40"><path d="M14 36a12 12 0 0 1 4-23 18 18 0 0 1 33-7 16 16 0 0 1 28 4 14 14 0 0 1 24 8 11 11 0 0 1 11 18Z" /></svg>
          <svg class="intro-bundle__case" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm5 0v13m6-13v13" /></svg>
        </div>

        <div class="intro-items" data-intro="items">
          {luggage.map((entry, index) => (
            <div class="intro-item" data-intro={`item-${index}`}>
              <span class="intro-item__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d={entry.path} /></svg></span>
              <span class="intro-item__name">{entry.name}</span>
            </div>
          ))}
        </div>

        <div class="brand intro-brand" data-intro="brand"><span class="brand-mark">✳</span><span>Tavern<span class="brand-soft">Roamer</span><small>STORY, WHEREVER YOU GO</small></span></div>
      </div>
    </div>
    <script>
      import '../lib/intro-boot';
    </script>
  </body>
</html>
```

第 02 站亮起時顯示雲朵上傳圖示（就是首頁「聊過的，輕輕留存」那個圖示），代表 Google Drive；第 01、03 站亮起時顯示站號。

- [ ] **Step 3：建立 `src/styles/intro.css`**

所有會被動畫控制的元素，初始狀態都寫在這裡（大多是 `opacity: 0`）。覆寫 `CloudSky` 的規則要用三個 class，才會蓋過它的 scoped 樣式（包括 800px 以下隱藏小雲團的那條 media query）。

```css
/* Intro video stage: a fixed 540×960 canvas, captured at 2× for a 1080×1920 export. */
.intro-body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #000;
}

.intro-stage {
  --topbar-h: 40px;
  --cloud-bank-h: 220px;
  position: relative;
  width: 540px;
  height: 960px;
  overflow: hidden;
  background: var(--bg);
  font-family: var(--font-sans);
}

.intro-sky {
  position: absolute;
  inset: 0;
}

/* Three classes outrank CloudSky's scoped rules, including the one that hides the puff below 800px. */
.intro-stage .intro-sky .cloud-sky__puff {
  display: block;
  top: 70px;
  width: 260px;
  opacity: 0;
}

.intro-stage .intro-sky .cloud-sky__bank {
  translate: 0 100%;
}

.intro-stage .intro-sky .cloud-sky__stars circle {
  opacity: 0;
}

.intro-dawn {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 90% 60% at 50% 0%, rgba(150, 186, 232, 0.4), transparent 70%);
  opacity: 0;
  pointer-events: none;
}

/* Scene 1 */
.intro-hero {
  position: absolute;
  top: 250px;
  left: 36px;
  right: 36px;
  text-align: center;
}

.intro-hero .eyebrow {
  justify-content: center;
  font: 500 18px/1.6 var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: none;
  opacity: 0;
}

.intro-hero h1 {
  margin: 24px 0 0;
  font-size: 44px;
  line-height: 1.45;
  opacity: 0;
}

.intro-hero h1 em {
  font-style: normal;
  color: var(--accent);
}

/* Captions share one spot at the top and cross-fade. */
.intro-captions {
  position: absolute;
  top: 150px;
  left: 32px;
  right: 32px;
}

.intro-caption {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  margin: 0;
  text-align: center;
  font-size: 34px;
  line-height: 1.5;
  opacity: 0;
}

/* Scene 2 */
.intro-scene {
  position: absolute;
  top: 400px;
  left: 70px;
  right: 70px;
  margin: 0;
  text-align: center;
  color: var(--accent);
  opacity: 0;
}

.intro-scene__art {
  height: 220px;
}

.intro-scene .tag {
  display: block;
  margin-top: 16px;
  font: 500 18px/1.6 var(--font-sans);
  letter-spacing: 0.06em;
}

.intro-scene .bubble-fill {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
}

/* Scene 3 */
.intro-threads {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: var(--accent);
  stroke-opacity: 0.6;
  stroke-width: 1.5;
  stroke-dasharray: 4 7;
  opacity: 0;
}

.intro-window {
  position: absolute;
  left: 270px;
  top: 560px;
  width: 240px;
  translate: -50% -50%;
  border: 1px solid var(--accent);
  border-radius: 12px;
  background: var(--surface);
  opacity: 0;
}

.intro-window__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.intro-window__dots {
  display: flex;
  gap: 5px;
}

.intro-window__dots i {
  width: 6px;
  height: 6px;
  border: 1px solid var(--accent);
  border-radius: 50%;
}

.intro-window__body {
  padding: 22px 16px;
  text-align: center;
}

.intro-window__body h3 {
  margin: 0;
  color: var(--text);
  font-size: 20px;
  line-height: 1.5;
}

.intro-window__body p {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.6;
}

/* Items: the wrapper moves (translate) and pops (scale); the icon wobbles (rotate). */
.intro-item {
  position: absolute;
  left: 270px;
  top: 560px;
  width: 0;
  height: 0;
  opacity: 0;
}

.intro-item__icon {
  position: absolute;
  left: -28px;
  top: -28px;
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  color: var(--accent);
}

.intro-item__icon svg {
  width: 26px;
  height: 26px;
}

.intro-item__name {
  position: absolute;
  top: 36px;
  left: 0;
  translate: -50% 0;
  white-space: nowrap;
  color: var(--text);
  font-size: 15px;
  font-weight: 500;
  opacity: 0;
}

.intro-bundle {
  position: absolute;
  left: 230px;
  top: 520px;
  width: 80px;
  height: 80px;
  opacity: 0;
}

.intro-bundle__glow {
  position: absolute;
  inset: -30px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--glow), transparent 65%);
  opacity: 0;
}

.intro-bundle__cloud {
  position: absolute;
  left: -24px;
  right: -24px;
  bottom: -26px;
  width: calc(100% + 48px);
  height: 40px;
  fill: url(#cloud-puff);
  opacity: 0;
}

.intro-bundle__case {
  position: absolute;
  inset: 12px;
  width: 56px;
  height: 56px;
  color: var(--accent);
}

/* Scene 4: stops 01 (bottom) to 03 (top) on a vertical line at x = 120. */
.intro-route {
  position: absolute;
  left: 120px;
  top: 420px;
  height: 240px;
  margin: 0;
  padding: 0;
  list-style: none;
  opacity: 0;
}

.intro-route::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-left: 1px dashed var(--line);
}

.intro-route li {
  position: absolute;
  left: 0;
  display: flex;
  align-items: center;
  gap: 40px;
  translate: -16px -50%;
}

.intro-route li:nth-child(1) { top: 240px; }
.intro-route li:nth-child(2) { top: 120px; }
.intro-route li:nth-child(3) { top: 0; }

.intro-route__number {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--bg);
  color: var(--accent);
  font: 500 12px var(--mono);
}

.intro-route__lit {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--on-primary);
  opacity: 0;
}

.intro-route__lit svg {
  width: 18px;
  height: 18px;
}

.intro-route__copy {
  white-space: nowrap;
}

.intro-route .tag {
  display: block;
  color: var(--accent);
  font: 500 14px/1.6 var(--font-sans);
  letter-spacing: 0.06em;
}

.intro-route h3 {
  margin: 2px 0 0;
  color: var(--text);
  font-size: 18px;
  line-height: 1.5;
}

/* Scene 5 */
.intro-brand {
  position: absolute;
  top: 380px;
  left: 0;
  right: 0;
  justify-content: center;
  gap: 16px;
  font-size: 30px;
  opacity: 0;
}

.intro-brand .brand-mark {
  width: 56px;
  height: 56px;
  font-size: 28px;
}

.intro-brand small {
  margin-top: 6px;
  font-size: 12px;
  letter-spacing: 3px;
}
```

- [ ] **Step 4：build，並確認 noindex 和頁面有產生**

```bash
npm run build && grep -c 'name="robots" content="noindex"' dist/intro/index.html
```
預期：build 成功，輸出 `1`。

- [ ] **Step 5：全部測試和型別檢查**

Run: `npm test && npm run typecheck`
預期：全部 PASS，沒有 error。

- [ ] **Step 6：Commit**

```bash
git add src/lib/intro-boot.ts src/pages/intro.astro src/styles/intro.css
git commit -m "feat: 介紹動畫頁面 /intro/

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

> 給 orchestrator（瀏覽器驗收，必做）：用 `astro-dev` 啟動 preview，視窗設成 540×960，依序開 `/intro/?t=` 加上 `3.5`、`6.5`、`8.5`、`10.5`、`14.5`、`17.8`、`20.5`、`22`、`24.8`、`30`，每個時間點都截圖。檢查：（1）console 沒有 `Intro step target not found` 或其他錯誤，`document.documentElement.dataset.introReady === 'true'`；（2）文字沒有被裁切或互相重疊；（3）`20.5`／`22` 秒的天色介於暗色和亮色之間，`30` 秒是完整的亮色；（4）`30` 秒的收尾畫面跟網站 hero 的風格一致。版面要微調時只改 `intro.css` 或 `intro-scenes.ts` 的座標，改完重跑 `npm test`。

---

### Task 6：MP4 輸出腳本

**Files:**
- Create: `scripts/export-intro.mjs`
- Modify: `package.json`（加 `export:intro` script，以及 devDependencies：`playwright`、`ffmpeg-static`）
- Modify: `.gitignore`（加 `exports/`）

**Interfaces:**
- Consumes: `/intro/?export`、`window.__intro.seek(ms)`、`window.__intro.duration`、`document.documentElement.dataset.introReady` / `introError`（Task 5）
- Produces: `exports/tavernroamer-intro.mp4`、`exports/tavernroamer-intro-poster.png`

- [ ] **Step 1：安裝開發依賴和 Chromium**

```bash
npm install --save-dev playwright ffmpeg-static
npx playwright install chromium
```
預期：`package.json` 的 devDependencies 多了 `playwright` 和 `ffmpeg-static`；Chromium 下載完成。

- [ ] **Step 2：在 `package.json` 的 `scripts` 加一行**

```json
"export:intro": "node scripts/export-intro.mjs"
```

在 `.gitignore` 最後加一行：

```
exports/
```

- [ ] **Step 3：建立 `scripts/export-intro.mjs`**

```js
// Renders /intro/ frame by frame and encodes it as a 1080×1920, 30fps MP4.
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright';

const FPS = 30;
const WIDTH = 540;
const HEIGHT = 960;
const SCALE = 2;
const FONT_FAMILIES = ['Noto Sans TC', 'Noto Serif TC'];
const OUT_DIR = path.resolve('exports');
const OUT_VIDEO = path.join(OUT_DIR, 'tavernroamer-intro.mp4');
const OUT_POSTER = path.join(OUT_DIR, 'tavernroamer-intro-poster.png');
const ASTRO_BIN = path.resolve('node_modules/astro/bin/astro.mjs');

// Build and preview at the site root so /intro/ resolves the same way every time.
const childEnv = { ...process.env };
delete childEnv.SITE_BASE;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: childEnv });
    child.on('error', reject);
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${path.basename(command)} ${args[0]} exited with ${code}`))));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not up yet.
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Preview server did not answer at ${url} within ${timeoutMs / 1000}s`);
}

function probe(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-i', file]);
    let output = '';
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    // ffmpeg exits 1 when given no output file; the stream info is still printed.
    child.on('exit', () => resolve(output));
  });
}

async function main() {
  if (!ffmpegPath) throw new Error('ffmpeg-static has no binary for this platform');

  await run(process.execPath, [ASTRO_BIN, 'build']);

  const port = await freePort();
  const pageUrl = `http://127.0.0.1:${port}/intro/?export`;
  const preview = spawn(process.execPath, [ASTRO_BIN, 'preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore', env: childEnv });
  let browser;
  let framesDir;
  let keepFrames = false;

  try {
    await waitForServer(`http://127.0.0.1:${port}/intro/`);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE });
    await page.goto(pageUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.introReady === 'true' || document.documentElement.dataset.introError, null, { timeout: 30000 });

    const bootError = await page.evaluate(() => document.documentElement.dataset.introError);
    if (bootError) throw new Error(`Intro page failed to start: ${bootError}`);
    const hasPlayer = await page.evaluate(() => typeof window.__intro?.seek === 'function');
    if (!hasPlayer) throw new Error('window.__intro is missing; check that the build includes src/lib/intro-boot.ts');

    const missingFonts = await page.evaluate(async families => {
      await document.fonts.ready;
      const loaded = new Set([...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replace(/["']/g, '')));
      return families.filter(family => !loaded.has(family));
    }, FONT_FAMILIES);
    if (missingFonts.length > 0) throw new Error(`Fonts did not load (Google Fonts needs a network connection): ${missingFonts.join(', ')}`);

    const duration = await page.evaluate(() => window.__intro.duration);
    const total = Math.ceil((duration / 1000) * FPS);
    framesDir = await mkdtemp(path.join(tmpdir(), 'tavernroamer-intro-'));
    console.log(`Rendering ${total} frames to ${framesDir}`);

    for (let frame = 0; frame < total; frame++) {
      await page.evaluate(async time => {
        window.__intro.seek(time);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, (frame * 1000) / FPS);
      await page.screenshot({ path: path.join(framesDir, `frame-${String(frame).padStart(5, '0')}.png`) });
      if (frame % FPS === 0) console.log(`  ${frame / FPS}s`);
    }

    await mkdir(OUT_DIR, { recursive: true });
    keepFrames = true;
    await run(ffmpegPath, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-framerate', String(FPS),
      '-i', path.join(framesDir, 'frame-%05d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow',
      '-movflags', '+faststart',
      OUT_VIDEO,
    ]);
    const frames = (await readdir(framesDir)).sort();
    await copyFile(path.join(framesDir, frames.at(-1)), OUT_POSTER);
    keepFrames = false;

    const info = await probe(OUT_VIDEO);
    const size = /(\d{3,4})x(\d{3,4})/.exec(info);
    const fps = /(\d+(?:\.\d+)?) fps/.exec(info);
    const length = /Duration: (\d\d:\d\d:\d\d\.\d\d)/.exec(info);
    console.log(`Done: ${OUT_VIDEO}`);
    console.log(`  ${size?.[0]} · ${fps?.[1]} fps · ${length?.[1]}`);
    console.log(`  poster: ${OUT_POSTER}`);
    if (size?.[0] !== `${WIDTH * SCALE}x${HEIGHT * SCALE}`) throw new Error(`Unexpected video size: ${size?.[0]}`);
  } finally {
    await browser?.close();
    preview.kill();
    if (framesDir && !keepFrames) await rm(framesDir, { recursive: true, force: true });
    if (framesDir && keepFrames) console.error(`Frames kept for debugging: ${framesDir}`);
  }
}

main().catch(error => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
```

- [ ] **Step 4：執行輸出**

這一步大約要 3–8 分鐘，請在背景執行。

Run: `npm run export:intro`
預期：最後印出
```
Done: ...\exports\tavernroamer-intro.mp4
  1080x1920 · 30 fps · 00:00:31.00
  poster: ...\exports\tavernroamer-intro-poster.png
```
結束代碼為 0，系統暫存資料夾裡沒有留下 `tavernroamer-intro-*`。

- [ ] **Step 5：確認輸出檔沒有被 git 追蹤**

Run: `git status --short exports`
預期：沒有輸出。

- [ ] **Step 6：Commit**

```bash
git add scripts/export-intro.mjs package.json package-lock.json .gitignore
git commit -m "feat: 介紹動畫的 MP4 輸出腳本

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

> 給 orchestrator：打開 `exports/tavernroamer-intro.mp4` 完整看一遍，並把影片和封面圖用 SendUserFile 傳給使用者。

---

### Task 7：最終驗收

不寫新程式；由 `verifier` 用全新的 context 驗證。

- [ ] **Step 1：全部指令都要通過**

```bash
npm test && npm run typecheck && npm run build
```
預期：全部 PASS，沒有 error。

- [ ] **Step 2：首頁沒變**：重做 Task 1 Step 8 的 markup 比對（`$TEMP/home-before.html` 對 `dist/index.html`），預期結果是 `SAME`。

- [ ] **Step 3：`/intro/` 沒有被網站連到**

Run: `grep -rl 'intro/' dist --include=*.html | grep -v '^dist/intro/'`
預期：沒有輸出。

- [ ] **Step 4：影片規格**：`exports/tavernroamer-intro.mp4` 是 1080×1920、30fps、長度 31 秒（±0.1 秒）。
