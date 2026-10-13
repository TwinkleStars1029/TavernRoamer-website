# 雲端主題改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 TavernRoamer 說明網站改成「雲端為主、帶一點酒館元素」的視覺風格，提供亮色（霧藍石板）與暗色（雲上夜燈）兩個可切換的主題。

**Architecture:** 所有顏色集中在 `src/styles/theme.css` 的 CSS 變數，亮色寫在 `:root`、暗色寫在 `:root[data-theme='dark']`。共用元件樣式從 `SiteLayout.astro` 搬到 `src/styles/global.css`。`<head>` 裡的 inline 腳本在繪製前決定主題；`ThemeToggle.astro` 負責切換與記憶。`CloudSky.astro` 是兩個主題共用的雲朵圖形，壓在雲上的區塊加 `.sky-scope` class，把一般變數換成淺色版。

**Tech Stack:** Astro 7（靜態輸出）、TypeScript strict、Vitest 5、純 CSS（無 CSS 框架）、Google Fonts。

**Spec:** `docs/superpowers/specs/2026-10-13-cloud-theme-redesign-design.md`

## Global Constraints

- 只改視覺：不改版面結構、導覽項目、段落順序與任何文字內容（`<SiteLayout>` 的 props、頁面文案、`href` 全部不動）。
- 主題儲存鍵：`localStorage` 的 `tr-theme`，值只能是 `light` 或 `dark`。
- 主題判斷順序：`tr-theme` → `prefers-color-scheme` → `light`。
- `theme-color`：亮色 `#f3f1ec`、暗色 `#10151d`。
- 字體：Noto Serif TC 700/900（`h1`、`h2`、品牌名稱）、Noto Sans TC 400/500/700（內文）、DM Mono 400/500（小標、編號、程式碼）。不再載入 DM Sans。
- 對比度：一般文字 ≥ 4.5:1，大標題 ≥ 3:1。
- 外部資源只能來自 Google Fonts（`fonts.googleapis.com`、`fonts.gstatic.com`）。
- 站內連結維持使用 `import.meta.env.BASE_URL`。
- `localStorage` 的讀寫一律包在 `try/catch`，被封鎖時頁面仍能顯示和切換。
- 指令都在專案根目錄執行（`TavernRoamer-website/`）。dev server：`npm run dev`，網址 `http://127.0.0.1:4321/`。
- 每個 commit 訊息結尾加上：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## File Structure

| 檔案 | 動作 | 職責 |
| --- | --- | --- |
| `src/lib/theme.ts` | 新增 | 主題常數、`<head>` 初始化腳本字串、切換用的小函式 |
| `src/lib/theme.test.ts` | 新增 | 測試初始化腳本與切換函式 |
| `src/lib/contrast.ts` | 新增 | WCAG 相對亮度與對比度計算 |
| `src/lib/contrast.test.ts` | 新增 | 對比度計算測試 |
| `src/styles/theme.css` | 新增 | 亮色／暗色所有色彩變數、字體變數 |
| `src/styles/theme.test.ts` | 新增 | 讀 `theme.css`，檢查色彩組合的對比度與暗色是否補齊 |
| `src/styles/global.css` | 新增 | 原本 `SiteLayout.astro` 裡的全域元件樣式，改用變數 |
| `src/components/ThemeToggle.astro` | 新增 | 主題切換按鈕與它的 client 腳本 |
| `src/components/CloudSky.astro` | 新增 | 共用雲朵圖形（`full`／`compact`） |
| `src/layouts/SiteLayout.astro` | 修改 | 載入樣式與字體、初始化腳本、切換鈕、導覽列實底切換 |
| `src/pages/*.astro`、`src/pages/setup/google-oauth.astro` | 修改 | 頁面樣式改用變數、標題區加雲朵 |
| `src/components/PageChapters.astro`、`src/components/OAuthScreenshots.astro` | 修改 | 樣式改用變數 |
| `README.md` | 修改 | 專案結構補上 `src/styles/` |

---

### Task 1: 主題邏輯模組

**Files:**
- Create: `src/lib/theme.ts`
- Test: `src/lib/theme.test.ts`

**Interfaces:**
- Consumes: 無
- Produces（後續任務會用到，名稱不可改）：
  - `type Theme = 'light' | 'dark'`
  - `const THEME_STORAGE_KEY = 'tr-theme'`
  - `const THEME_COLORS: Record<Theme, string>`（`{ light: '#f3f1ec', dark: '#10151d' }`）
  - `const INIT_THEME_SCRIPT: string`：自執行的 JS 原始碼，只用到全域的 `window` 與 `document`
  - `function nextTheme(current: string | null | undefined): Theme`
  - `function toggleLabel(theme: Theme): string`
  - `function saveTheme(storage: Pick<Storage, 'setItem'> | undefined, theme: Theme): void`

- [ ] **Step 1: 寫會失敗的測試**

建立 `src/lib/theme.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { INIT_THEME_SCRIPT, THEME_COLORS, THEME_STORAGE_KEY, nextTheme, saveTheme, toggleLabel } from './theme';

interface InitOptions {
  stored?: string | null;
  prefersDark?: boolean;
  storageThrows?: boolean;
  matchMediaThrows?: boolean;
}

function runInit({ stored = null, prefersDark = false, storageThrows = false, matchMediaThrows = false }: InitOptions = {}) {
  const attributes: Record<string, string> = {};
  const meta = { content: '', setAttribute(_name: string, value: string) { this.content = value; } };
  const fakeDocument = {
    documentElement: { setAttribute: (name: string, value: string) => { attributes[name] = value; } },
    querySelector: () => meta,
  };
  const fakeWindow = {
    matchMedia: () => {
      if (matchMediaThrows) throw new Error('unsupported');
      return { matches: prefersDark };
    },
    localStorage: {
      getItem: (key: string) => {
        if (storageThrows) throw new Error('blocked');
        return key === THEME_STORAGE_KEY ? stored : null;
      },
    },
  };
  new Function('window', 'document', INIT_THEME_SCRIPT)(fakeWindow, fakeDocument);
  return { theme: attributes['data-theme'], themeColor: meta.content };
}

describe('INIT_THEME_SCRIPT', () => {
  it('uses the stored theme over the system preference', () => {
    expect(runInit({ stored: 'light', prefersDark: true }).theme).toBe('light');
    expect(runInit({ stored: 'dark', prefersDark: false }).theme).toBe('dark');
  });
  it('falls back to the system preference when nothing valid is stored', () => {
    expect(runInit({ stored: null, prefersDark: true }).theme).toBe('dark');
    expect(runInit({ stored: 'blue', prefersDark: true }).theme).toBe('dark');
    expect(runInit({ stored: null, prefersDark: false }).theme).toBe('light');
  });
  it('still follows the system preference when storage is blocked', () => {
    expect(runInit({ storageThrows: true, prefersDark: true }).theme).toBe('dark');
  });
  it('defaults to light when matchMedia is unavailable', () => {
    expect(runInit({ matchMediaThrows: true }).theme).toBe('light');
  });
  it('updates the theme-color meta tag', () => {
    expect(runInit({ stored: 'dark' }).themeColor).toBe(THEME_COLORS.dark);
    expect(runInit({ stored: 'light' }).themeColor).toBe(THEME_COLORS.light);
  });
});

describe('theme helpers', () => {
  it('flips between light and dark', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme(null)).toBe('dark');
    expect(nextTheme(undefined)).toBe('dark');
  });
  it('labels the toggle with the action it performs', () => {
    expect(toggleLabel('light')).toBe('切換為暗色主題');
    expect(toggleLabel('dark')).toBe('切換為亮色主題');
  });
  it('saves the theme under the storage key', () => {
    const saved: Record<string, string> = {};
    saveTheme({ setItem: (key, value) => { saved[key] = value; } }, 'dark');
    expect(saved).toEqual({ [THEME_STORAGE_KEY]: 'dark' });
  });
  it('ignores storage that is missing or throws', () => {
    expect(() => saveTheme(undefined, 'dark')).not.toThrow();
    expect(() => saveTheme({ setItem: () => { throw new Error('blocked'); } }, 'dark')).not.toThrow();
  });
});
```

- [ ] **Step 2: 執行測試，確認失敗**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: FAIL，錯誤訊息包含 `Failed to resolve import "./theme"` 或 `Cannot find module`。

- [ ] **Step 3: 寫最小實作**

建立 `src/lib/theme.ts`：

```ts
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tr-theme';

export const THEME_COLORS: Record<Theme, string> = {
  light: '#f3f1ec',
  dark: '#10151d',
};

/**
 * Runs inline in <head> before first paint, so it must stay plain ES5 and only
 * touch the global window and document.
 */
export const INIT_THEME_SCRIPT = `(function () {
  var prefersDark = false;
  try { prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
  var theme = prefersDark ? 'dark' : 'light';
  try {
    var stored = window.localStorage.getItem('${THEME_STORAGE_KEY}');
    if (stored === 'light' || stored === 'dark') theme = stored;
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '${THEME_COLORS.dark}' : '${THEME_COLORS.light}');
})();`;

export function nextTheme(current: string | null | undefined): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

export function toggleLabel(theme: Theme): string {
  return theme === 'dark' ? '切換為亮色主題' : '切換為暗色主題';
}

export function saveTheme(storage: Pick<Storage, 'setItem'> | undefined, theme: Theme): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private mode, site data disabled); the theme still applies for this page view.
  }
}
```

- [ ] **Step 4: 執行測試，確認通過**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: PASS（9 個測試）。

- [ ] **Step 5: 型別檢查**

Run: `npm run typecheck`
Expected: `0 errors`。

- [ ] **Step 6: Commit**

```bash
git add src/lib/theme.ts src/lib/theme.test.ts
git commit -m "feat: 主題初始化腳本與切換工具函式

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 對比度工具與主題色彩變數

**Files:**
- Create: `src/lib/contrast.ts`
- Test: `src/lib/contrast.test.ts`
- Create: `src/styles/theme.css`
- Test: `src/styles/theme.test.ts`

**Interfaces:**
- Consumes: 無
- Produces：
  - `function relativeLuminance(hex: string): number`（只接受 `#rrggbb`，其他格式丟出 `Error`）
  - `function contrastRatio(a: string, b: string): number`
  - `src/styles/theme.css`：之後所有樣式只用這裡定義的變數。名稱：`--font-sans --font-serif --mono --bg --surface --surface-2 --line --text --muted --primary --on-primary --accent --accent-soft --success --success-soft --warning --warning-soft --code-bg --code-text --shadow --topbar-bg --sky-text --sky-muted --sky-accent --sky-line --sky-surface --sky-surface-2 --sky-primary --sky-on-primary --sky-1 --sky-2 --sky-3 --glow --glow-opacity --star-opacity --puff-1 --puff-2 --bank-1 --bank-2 --bank-3 --bank-4`
  - 過渡期的舊名稱別名（Task 6 移除）：`--cream --green --gold --rust --panel --panel2 --ink`

- [ ] **Step 1: 寫對比度工具的失敗測試**

建立 `src/lib/contrast.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';

describe('contrast', () => {
  it('computes relative luminance of black and white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
  it('returns 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#3f5266', '#3f5266')).toBeCloseTo(1, 5);
  });
  it('is symmetric', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#777777'), 10);
  });
  it('matches the known WCAG value for #777777 on white', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
  it('rejects formats other than #rrggbb', () => {
    expect(() => relativeLuminance('red')).toThrow();
    expect(() => relativeLuminance('#fff')).toThrow();
    expect(() => relativeLuminance('rgba(0,0,0,.5)')).toThrow();
  });
});
```

- [ ] **Step 2: 執行測試，確認失敗**

Run: `npx vitest run src/lib/contrast.test.ts`
Expected: FAIL，無法解析 `./contrast`。

- [ ] **Step 3: 實作對比度工具**

建立 `src/lib/contrast.ts`：

```ts
/** WCAG 2.x relative luminance of a #rrggbb color. */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Unsupported color format: ${hex}`);
  const value = parseInt(match[1], 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(channel => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two #rrggbb colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
```

- [ ] **Step 4: 執行測試，確認通過**

Run: `npx vitest run src/lib/contrast.test.ts`
Expected: PASS（5 個測試）。

- [ ] **Step 5: 寫主題變數的失敗測試**

建立 `src/styles/theme.test.ts`。`?raw` 讓 Vite 以字串讀入 CSS 檔，不需要 Node 的 `fs`（專案沒有 `@types/node`）。

```ts
import { describe, expect, it } from 'vitest';
import themeCss from './theme.css?raw';
import { contrastRatio } from '../lib/contrast';

const LIGHT_SELECTOR = ':root';
const DARK_SELECTOR = ":root[data-theme='dark']";

function readBlock(selector: string): Record<string, string> {
  const start = themeCss.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`theme.css is missing the "${selector} {" block`);
  const end = themeCss.indexOf('}', start);
  const body = themeCss.slice(start, end);
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}

const light = readBlock(LIGHT_SELECTOR);
const dark = { ...light, ...readBlock(DARK_SELECTOR) };
const themes = { light, dark };

// [foreground, background, minimum ratio]
const PAIRS: [string, string, number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surface-2', 4.5],
  ['text', 'accent-soft', 4.5],
  ['text', 'success-soft', 4.5],
  ['text', 'warning-soft', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'surface', 4.5],
  ['muted', 'surface-2', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'surface', 4.5],
  ['accent', 'accent-soft', 4.5],
  ['success', 'surface', 4.5],
  ['success', 'success-soft', 4.5],
  ['warning', 'surface', 4.5],
  ['on-primary', 'primary', 4.5],
  ['code-text', 'code-bg', 4.5],
  ['sky-text', 'sky-1', 4.5],
  ['sky-text', 'sky-2', 4.5],
  ['sky-muted', 'sky-1', 4.5],
  ['sky-muted', 'sky-2', 4.5],
  ['sky-accent', 'sky-1', 4.5],
  ['sky-accent', 'sky-2', 4.5],
  ['sky-on-primary', 'sky-primary', 4.5],
];

describe.each(Object.entries(themes))('%s theme tokens', (_name, tokens) => {
  it.each(PAIRS)('--%s on --%s meets %s:1', (fg, bg, min) => {
    expect(tokens[fg], `--${fg} is not defined`).toBeDefined();
    expect(tokens[bg], `--${bg} is not defined`).toBeDefined();
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
  });
});

describe('dark theme', () => {
  it('overrides every color token defined for light', () => {
    const colorKeys = Object.keys(light).filter(key => /^(#|rgba?\()/.test(light[key]) || key.endsWith('-opacity'));
    const darkOwn = readBlock(DARK_SELECTOR);
    const missing = colorKeys.filter(key => !(key in darkOwn));
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 6: 執行測試，確認失敗**

Run: `npx vitest run src/styles/theme.test.ts`
Expected: FAIL，無法解析 `./theme.css?raw`（檔案還不存在）。

- [ ] **Step 7: 建立主題變數**

建立 `src/styles/theme.css`（兩個區塊的選擇器字串必須和測試裡的 `LIGHT_SELECTOR`、`DARK_SELECTOR` 完全一致）：

```css
/* Theme tokens. Light = 霧藍石板, dark = 雲上夜燈. Components only use these variables. */
:root {
  color-scheme: light;
  --font-sans: 'Noto Sans TC', sans-serif;
  --font-serif: 'Noto Serif TC', 'Noto Sans TC', serif;
  --mono: 'DM Mono', ui-monospace, monospace;

  --bg: #f3f1ec;
  --surface: #fbfaf7;
  --surface-2: #e8ecef;
  --line: #d8dce1;
  --text: #26303a;
  --muted: #5d6874;
  --primary: #3f5266;
  --on-primary: #f7f4ee;
  --accent: #8a5520;
  --accent-soft: #f3e4cf;
  --success: #3f6b3a;
  --success-soft: #e3ecdf;
  --warning: #a4482a;
  --warning-soft: #f5e1d8;
  --code-bg: #e9edf0;
  --code-text: #34495e;
  --shadow: rgba(38, 48, 58, 0.16);
  --topbar-bg: rgba(243, 241, 236, 0.9);

  /* Text and controls painted on top of the cloud sky (.sky-scope) */
  --sky-text: #fbf8f2;
  --sky-muted: #f0f2f5;
  --sky-accent: #ffe7c7;
  --sky-line: rgba(255, 255, 255, 0.28);
  --sky-surface: rgba(30, 40, 52, 0.38);
  --sky-surface-2: rgba(30, 40, 52, 0.5);
  --sky-primary: #f7f4ee;
  --sky-on-primary: #2c3540;

  /* Cloud artwork (CloudSky.astro) */
  --sky-1: #44556a;
  --sky-2: #56677a;
  --sky-3: #bdb3a2;
  --glow: #f0b47a;
  --glow-opacity: 0.45;
  --star-opacity: 0;
  --puff-1: #f1ece4;
  --puff-2: #b5a593;
  --bank-1: #f7f3ec;
  --bank-2: #cbbdab;
  --bank-3: #ecc79c;
  --bank-4: #f3f1ec;

  /* Legacy names still used by page styles; removed once pages are migrated. */
  --cream: var(--text);
  --green: var(--accent);
  --gold: var(--accent);
  --rust: var(--warning);
  --panel: var(--surface);
  --panel2: var(--surface-2);
  --ink: var(--on-primary);
}

:root[data-theme='dark'] {
  color-scheme: dark;

  --bg: #10151d;
  --surface: #161d28;
  --surface-2: #1c2431;
  --line: #2a3445;
  --text: #ece8e0;
  --muted: #a3abb9;
  --primary: #d9a35c;
  --on-primary: #1a130a;
  --accent: #e8b878;
  --accent-soft: #3a2f22;
  --success: #9fc889;
  --success-soft: #1f2b22;
  --warning: #e08a6a;
  --warning-soft: #33231e;
  --code-bg: #0c1016;
  --code-text: #e3c99b;
  --shadow: rgba(0, 0, 0, 0.45);
  --topbar-bg: rgba(16, 21, 29, 0.88);

  --sky-text: #ece8e0;
  --sky-muted: #b3b9c6;
  --sky-accent: #e8b878;
  --sky-line: rgba(255, 255, 255, 0.14);
  --sky-surface: rgba(22, 29, 40, 0.6);
  --sky-surface-2: rgba(28, 36, 49, 0.7);
  --sky-primary: #d9a35c;
  --sky-on-primary: #1a130a;

  --sky-1: #0d121a;
  --sky-2: #172030;
  --sky-3: #2a2a33;
  --glow: #e09a4c;
  --glow-opacity: 0.55;
  --star-opacity: 0.6;
  --puff-1: #2e3a52;
  --puff-2: #6e5a44;
  --bank-1: #3a4760;
  --bank-2: #5b5550;
  --bank-3: #b8803f;
  --bank-4: #10151d;
}
```

- [ ] **Step 8: 執行測試，確認通過**

Run: `npx vitest run src/styles/theme.test.ts`
Expected: PASS（2 × 24 組對比度 + 1 個暗色補齊測試）。

如果某一組對比度沒過：只調整那個前景色（亮色往深、暗色往亮），每次調整 RGB 各約 8～12，直到通過。不要動 `--bg`、`--bank-4`、`THEME_COLORS`，它們必須保持 `#f3f1ec`／`#10151d`。把調整後的值同步寫回 spec 的色票表。

- [ ] **Step 9: 執行全部測試與型別檢查**

Run: `npm test && npm run typecheck`
Expected: 全部 PASS，typecheck `0 errors`。如果 typecheck 回報 `Cannot find module './theme.css?raw'`，在 `src/env.d.ts` 加上 `/// <reference types="astro/client" />`（檔案不存在就建立）後重跑。

- [ ] **Step 10: Commit**

```bash
git add src/lib/contrast.ts src/lib/contrast.test.ts src/styles/theme.css src/styles/theme.test.ts
git commit -m "feat: 亮色與暗色主題變數，並以測試檢查對比度

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

（如果 Step 9 建立了 `src/env.d.ts`，一併 `git add`。）

---

### Task 3: 全域樣式、版型與主題切換鈕

**Files:**
- Create: `src/styles/global.css`
- Create: `src/components/ThemeToggle.astro`
- Modify: `src/layouts/SiteLayout.astro`（整個檔案改寫）

**Interfaces:**
- Consumes: Task 1 的 `INIT_THEME_SCRIPT`、`THEME_COLORS`、`nextTheme`、`saveTheme`、`toggleLabel`、`Theme`；Task 2 的 `theme.css` 變數。
- Produces：
  - `global.css` 裡的 `.sky-scope` class（Task 5 會用）
  - `--topbar-h` 變數（Task 5 會用）
  - `<ThemeToggle />` 元件：按鈕帶 `data-theme-toggle` 屬性
  - `.topbar` 在這個任務**一律是實底**；Task 5 才改成疊在雲上

- [ ] **Step 1: 建立全域樣式**

建立 `src/styles/global.css`。類別名稱全部沿用舊的，頁面 HTML 不用改。原本只在舊首頁使用、現在沒有任何頁面引用的 `.visual`、`.mock-*` 樣式不搬過來。

```css
:root {
  --topbar-h: 76px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  scroll-padding-top: 100px;
  background: var(--bg);
}

body {
  margin: 0;
  min-width: 320px;
  font-family: var(--font-sans);
  color: var(--text);
  background: var(--bg);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

/* Added for ~400ms by ThemeToggle so a theme switch fades instead of snapping. */
.theme-transition,
.theme-transition *,
.theme-transition *::before,
.theme-transition *::after {
  transition: background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, fill 0.35s ease, stop-color 0.35s ease !important;
}

/* Areas painted on top of the cloud sky swap to the light-on-sky palette. */
.sky-scope {
  --text: var(--sky-text);
  --muted: var(--sky-muted);
  --accent: var(--sky-accent);
  --line: var(--sky-line);
  --surface: var(--sky-surface);
  --surface-2: var(--sky-surface-2);
  --primary: var(--sky-primary);
  --on-primary: var(--sky-on-primary);
  color: var(--text);
}

.skip-link {
  position: fixed;
  left: 12px;
  top: -60px;
  z-index: 20;
  padding: 12px;
  background: var(--primary);
  color: var(--on-primary);
}

.skip-link:focus {
  top: 12px;
}

/* ---------- Top bar ---------- */
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: var(--topbar-h);
  padding: 0 clamp(22px, 6vw, 96px);
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--topbar-bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  color: var(--text);
  font-family: var(--font-serif);
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.2px;
  text-decoration: none;
}

.brand-mark {
  width: 32px;
  height: 32px;
  border: 1px solid var(--line);
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: 17px;
}

.brand-soft {
  color: var(--accent);
}

.brand small {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font: 500 8px var(--mono);
  letter-spacing: 1.5px;
}

.topbar nav {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 24px;
}

.topbar nav a,
.footer-links a {
  color: var(--muted);
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s;
}

.topbar nav a:hover,
.topbar nav a.active,
.footer-links a:hover {
  color: var(--accent);
}

.topbar nav a.nav-cta {
  background: var(--primary);
  color: var(--on-primary);
  padding: 10px 16px;
  border-radius: 3px;
  font-weight: 700;
}

.nav-cta span {
  margin-left: 8px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.menu-toggle {
  display: none;
}

/* ---------- Footer ---------- */
.footer {
  margin-top: 100px;
  border-top: 1px solid var(--line);
  background: var(--surface);
}

.footer-inner {
  max-width: 1160px;
  margin: auto;
  padding: 45px 24px 28px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 18px;
}

.footer-brand {
  font-size: 16px;
}

.footer p {
  color: var(--muted);
  font-size: 13px;
}

.footer-links {
  display: flex;
  gap: 22px;
  align-items: center;
  color: var(--muted);
  font-size: 13px;
}

.footer-note {
  grid-column: 1 / -1;
  color: var(--muted);
  font-size: 11px;
  border-top: 1px solid var(--line);
  padding-top: 16px;
}

/* ---------- Typography ---------- */
.wrap {
  max-width: 1120px;
  margin: auto;
  padding: 0 28px;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1,
h2 {
  font-family: var(--font-serif);
  color: var(--text);
}

h1 {
  font-size: clamp(36px, 5.6vw, 62px);
  font-weight: 900;
  line-height: 1.25;
  letter-spacing: 0.5px;
  margin: 16px 0 20px;
}

h2 {
  font-size: clamp(25px, 3.2vw, 36px);
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.3px;
  margin-bottom: 13px;
}

h3 {
  font-size: 17px;
  color: var(--text);
  margin-bottom: 10px;
}

.eyebrow,
.page-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
  font: 500 10px var(--mono);
  letter-spacing: 2.5px;
  text-transform: uppercase;
}

.eyebrow::before,
.page-kicker::before {
  content: '';
  width: 24px;
  height: 1px;
  background: currentColor;
}

.lead {
  font-size: 16px;
  line-height: 1.95;
  color: var(--muted);
  max-width: 700px;
}

.muted {
  color: var(--muted);
}

.text-link {
  color: var(--accent);
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

/* ---------- Sections and building blocks ---------- */
.section {
  padding: 82px 0;
  border-top: 1px solid var(--line);
}

.section-heading {
  max-width: 650px;
  margin-bottom: 36px;
}

.section-heading p {
  line-height: 1.8;
  color: var(--muted);
}

.button-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 30px;
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 13px 19px;
  background: var(--primary);
  color: var(--on-primary);
  border: 1px solid transparent;
  border-radius: 3px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.3px;
  text-decoration: none;
}

.button.secondary {
  background: transparent;
  border-color: var(--line);
  color: var(--text);
}

.sky-scope .button.secondary {
  background: var(--sky-surface);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.button:hover {
  filter: brightness(1.06);
}

.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 24px;
}

.card p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.8;
  margin-bottom: 0;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.grid-2 > *,
.grid-3 > * {
  min-width: 0;
  overflow-wrap: anywhere;
}

.tag {
  color: var(--accent);
  font: 500 10px var(--mono);
  letter-spacing: 1.3px;
}

.callout {
  margin: 24px 0;
  padding: 17px 19px;
  background: var(--accent-soft);
  border-left: 3px solid var(--accent);
  border-radius: 0 6px 6px 0;
  color: var(--text);
  font-size: 13px;
  line-height: 1.8;
}

.callout.warning {
  background: var(--warning-soft);
  border-left-color: var(--warning);
}

/* ---------- Page heroes (cloud sky is added in Task 5) ---------- */
.hero,
.page-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

.hero > .wrap,
.page-hero > .wrap {
  position: relative;
  z-index: 2;
}

.hero {
  padding: 76px 0 74px;
}

.page-hero {
  padding: 78px 0 60px;
  border-bottom: 1px solid var(--line);
}

.page-hero h1 {
  font-size: clamp(34px, 5vw, 54px);
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.02fr 0.98fr;
  align-items: center;
  gap: 52px;
}

.hero h1 em {
  font-style: normal;
  color: var(--accent);
}

.hero .lead {
  max-width: 500px;
}

/* ---------- Steps, code, tools ---------- */
.steps {
  counter-reset: steps;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.step {
  position: relative;
  min-width: 0;
  overflow-wrap: anywhere;
  padding: 23px 24px 23px 74px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.step::before {
  counter-increment: steps;
  content: counter(steps, decimal-leading-zero);
  position: absolute;
  left: 23px;
  top: 24px;
  color: var(--accent);
  font: 500 13px var(--mono);
}

.step p,
.step li {
  font-size: 13px;
  line-height: 1.85;
  color: var(--muted);
}

.step p:last-child {
  margin-bottom: 0;
}

.step strong {
  color: var(--text);
}

.step .evidence {
  color: var(--success);
  font-size: 12px;
}

.code {
  display: block;
  padding: 12px 15px;
  font: 12px var(--mono);
  color: var(--code-text);
  background: var(--code-bg);
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.inline-code {
  padding: 3px 5px;
  font: 11px var(--mono);
  color: var(--code-text);
  background: var(--code-bg);
  border-radius: 3px;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.toolbox {
  margin-top: 30px;
}

.toolbox textarea {
  width: 100%;
  min-height: 115px;
  resize: vertical;
  padding: 14px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text);
  font: 13px/1.8 var(--mono);
}

.toolbox button {
  cursor: pointer;
  border: 0;
  font: 600 12px var(--font-sans);
}

.toolbox button.copy {
  margin-top: 10px;
  padding: 10px 14px;
  background: var(--surface-2);
  color: var(--accent);
  border-radius: 3px;
}

.tool-output {
  margin-top: 15px;
  white-space: pre-wrap;
  line-height: 1.8;
  font-size: 12px;
}

.tool-output .error {
  color: var(--warning);
}

.tool-output .warning-text {
  color: var(--accent);
}

.tool-output .origin {
  color: var(--success);
}

.tool-note {
  margin-top: 12px;
  font-size: 11px;
  color: var(--muted);
}

.toolbox textarea:focus,
.button:focus-visible,
a:focus-visible,
button:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* ---------- FAQ, tables, badges, timeline ---------- */
.faq-list {
  display: grid;
  gap: 9px;
}

.faq-list details {
  padding: 17px 20px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.faq-list summary {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  cursor: pointer;
  list-style: none;
  color: var(--text);
  font-weight: 600;
  font-size: 14px;
}

.faq-list summary::after {
  content: '+';
  color: var(--accent);
  font: 19px var(--mono);
}

.faq-list details[open] summary::after {
  content: '−';
}

.faq-list details p {
  margin: 15px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.9;
}

.table-wrap {
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  padding: 13px 14px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--line);
}

.data-table th {
  color: var(--accent);
  font: 500 10px var(--mono);
  letter-spacing: 0.7px;
}

.data-table td {
  color: var(--text);
  line-height: 1.75;
}

.badge {
  display: inline-block;
  padding: 4px 7px;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.4px;
}

.timeline {
  margin-left: 9px;
  padding-left: 26px;
  border-left: 1px solid var(--line);
}

.timeline-item {
  position: relative;
  padding: 0 0 30px;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: -31px;
  top: 4px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent);
}

.timeline-item p {
  color: var(--muted);
  line-height: 1.8;
  font-size: 13px;
}

/* ---------- Route diagram and lists ---------- */
.route {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 26px;
}

.route-node {
  width: 148px;
  padding: 19px 12px;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.route-node .icon {
  display: block;
  margin-bottom: 7px;
  color: var(--accent);
  font-size: 22px;
}

.route-node strong {
  font-size: 12px;
}

.route-node small {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
}

.route-arrow {
  color: var(--accent);
}

.list-clean {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 12px;
}

.list-clean li {
  position: relative;
  padding-left: 24px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.8;
}

.list-clean li::before {
  content: '↗';
  position: absolute;
  left: 0;
  color: var(--accent);
}

/* ---------- Responsive ---------- */
@media (min-width: 801px) and (max-width: 1000px) {
  .topbar {
    padding: 0 22px;
  }

  .topbar nav {
    gap: 12px;
  }

  .topbar nav a {
    white-space: nowrap;
    font-size: 12px;
  }

  .brand {
    font-size: 16px;
  }
}

@media (max-width: 800px) {
  :root {
    --topbar-h: 68px;
  }

  .topbar {
    padding: 0 20px;
  }

  .topbar-actions {
    margin-left: auto;
  }

  .menu-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 11px;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 3px;
    color: var(--text);
    font: 500 13px var(--font-sans);
    cursor: pointer;
  }

  .topbar nav {
    display: none;
    position: absolute;
    top: calc(var(--topbar-h) - 1px);
    left: 0;
    right: 0;
    margin-left: 0;
    padding: 14px 20px 22px;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
  }

  .topbar nav.open {
    display: flex;
  }

  .topbar nav a {
    padding: 13px 3px;
    border-bottom: 1px solid var(--line);
  }

  .topbar nav a.nav-cta {
    margin-top: 12px;
    padding: 13px;
    text-align: center;
  }

  .wrap {
    padding: 0 22px;
  }

  .hero {
    padding: 56px 0;
  }

  .hero-grid,
  .grid-2,
  .grid-3 {
    grid-template-columns: 1fr;
  }

  .hero-grid {
    gap: 28px;
  }

  .section {
    padding: 62px 0;
  }

  .page-hero {
    padding: 58px 0 42px;
  }

  .footer-inner {
    grid-template-columns: 1fr;
  }

  .footer-links {
    flex-wrap: wrap;
    gap: 15px;
  }

  .footer-note {
    grid-column: auto;
  }
}

@media (max-width: 440px) {
  .route {
    gap: 7px;
  }

  .route-node {
    width: 117px;
    padding: 14px 7px;
  }

  .route-arrow {
    font-size: 12px;
  }

  .step {
    padding: 19px 17px 19px 59px;
  }

  .step::before {
    left: 17px;
    top: 20px;
  }
}
```

- [ ] **Step 2: 建立主題切換鈕元件**

建立 `src/components/ThemeToggle.astro`：

```astro
<button class="theme-toggle" type="button" data-theme-toggle aria-label="切換為暗色主題">
  <span class="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true">☾</span>
  <span class="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true">☀</span>
</button>

<script>
  import { THEME_COLORS, nextTheme, saveTheme, toggleLabel, type Theme } from '../lib/theme';

  const root = document.documentElement;
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function currentTheme(): Theme {
    return root.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function sync(theme: Theme) {
    buttons.forEach(button => button.setAttribute('aria-label', toggleLabel(theme)));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  }

  function storage(): Storage | undefined {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  }

  sync(currentTheme());

  buttons.forEach(button =>
    button.addEventListener('click', () => {
      const theme = nextTheme(currentTheme());
      if (!reduceMotion.matches) {
        root.classList.add('theme-transition');
        window.setTimeout(() => root.classList.remove('theme-transition'), 400);
      }
      root.dataset.theme = theme;
      sync(theme);
      saveTheme(storage(), theme);
    }),
  );
</script>

<style>
  .theme-toggle {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: transparent;
    color: var(--text);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
  }

  .theme-toggle:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  :global(:root[data-theme='dark']) .theme-toggle__icon--moon,
  :global(:root:not([data-theme='dark'])) .theme-toggle__icon--sun {
    display: none;
  }
</style>
```

- [ ] **Step 3: 改寫 SiteLayout**

把 `src/layouts/SiteLayout.astro` 整個換成下面內容。和舊版的差異：加上 `Props` 型別、載入 `theme.css` 與 `global.css`、字體改用 `<link>`、`<head>` 的初始化腳本、`<ThemeToggle />` 與 `.topbar-actions`、`menu-toggle` 加 `type="button"`，並刪掉兩段 `<style is:global>`。導覽項目、品牌文字、頁尾文字一字不改。

```astro
---
import '../styles/theme.css';
import '../styles/global.css';
import ThemeToggle from '../components/ThemeToggle.astro';
import { INIT_THEME_SCRIPT, THEME_COLORS } from '../lib/theme';

interface Props {
  title: string;
  description: string;
  active?: string;
}

const { title, description, active = '' } = Astro.props;
const base = import.meta.env.BASE_URL;
const nav = [
  { href: base, label: '認識 Roamer', key: 'home' },
  { href: `${base}interface/`, label: '介面介紹', key: 'interface' },
  { href: `${base}install/`, label: '安裝指南', key: 'install' },
  { href: `${base}setup/google-oauth/`, label: 'Google 設定', key: 'oauth' },
  { href: `${base}how-to-use/`, label: '使用教學', key: 'how-to-use' },
  { href: `${base}data-and-permissions/`, label: '資料與權限', key: 'data-and-permissions' },
  { href: `${base}faq/`, label: '常見問題', key: 'faq' }
];
---
<!doctype html>
<html lang="zh-Hant" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content={THEME_COLORS.light} />
    <script is:inline set:html={INIT_THEME_SCRIPT}></script>
    <link rel="icon" type="image/svg+xml" href={`${base}favicon.svg`} />
    <meta name="description" content={description} />
    <meta property="og:title" content={`${title}｜TavernRoamer`} />
    <meta property="og:description" content={description} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@700;900&display=swap" />
    <title>{`${title}｜TavernRoamer`}</title>
  </head>
  <body>
    <a class="skip-link" href="#main-content">跳到主要內容</a>
    <header class="topbar">
      <a class="brand" href={base} aria-label="TavernRoamer 首頁"><span class="brand-mark">✳</span><span>Tavern<span class="brand-soft">Roamer</span><small>STORY, WHEREVER YOU GO</small></span></a>
      <nav id="main-nav" aria-label="主要導覽">
        {nav.map(item => <a href={item.href} aria-current={active === item.key ? 'page' : undefined} class:list={[active === item.key && 'active']}>{item.label}</a>)}
        <a class="nav-cta" href={`${base}install/`}>開始安裝 <span aria-hidden="true">↗</span></a>
      </nav>
      <div class="topbar-actions">
        <ThemeToggle />
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav">選單 <span aria-hidden="true">☰</span></button>
      </div>
    </header>
    <main id="main-content" tabindex="-1"><slot /></main>
    <footer class="footer">
      <div class="footer-inner">
        <div><a class="brand footer-brand" href={base}><span class="brand-mark">✳</span><span>Tavern<span class="brand-soft">Roamer</span></span></a><p>把故事收好，下一段旅程再接著走。</p></div>
        <div class="footer-links"><a href={`${base}changelog/`}>版本與來源</a><span>提供 main 分支腳本</span><a href={`${base}faq/#回報問題`}>排錯與回報準備</a></div>
        <small class="footer-note">腳本安裝方式見安裝指南 · 本網站不會要求你的 Client Secret、token 或聊天資料。</small>
      </div>
    </footer>
    <script>
      const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
      const nav = document.querySelector<HTMLElement>('#main-nav');
      toggle?.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        nav?.classList.toggle('open', !expanded);
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && nav?.classList.contains('open')) {
          nav.classList.remove('open');
          toggle?.setAttribute('aria-expanded', 'false');
          toggle?.focus();
        }
      });
    </script>
  </body>
</html>
```

- [ ] **Step 4: 型別檢查、測試、建置**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck `0 errors`；測試全部 PASS；build 完成，沒有錯誤。

- [ ] **Step 5: 確認初始化腳本在 `<head>` 裡、字體已換**

Run: `grep -c "tr-theme" dist/index.html && grep -c "DM+Sans" dist/index.html`
Expected: 第一個輸出 `1`（或更大）；第二個輸出 `0`（grep 找不到時回傳碼為 1，屬正常）。

- [ ] **Step 6: 瀏覽器檢查**

執行 `npm run dev`，打開 `http://127.0.0.1:4321/`：

1. 導覽列右側有圓形切換鈕，亮色時顯示 ☾。按下後整站變暗色、圖示變 ☀，顏色有約 0.35 秒的漸變。
2. 重新整理後維持暗色，載入時不會先閃一下亮色。
3. 在 DevTools Console 執行 `localStorage.removeItem('tr-theme')`，在 Rendering 面板模擬 `prefers-color-scheme: dark` 後重新整理，應該是暗色。
4. 視窗縮到 375px 寬：切換鈕在「選單」按鈕左邊，選單可以打開、按 Esc 可以關閉。
5. 舊配色（綠色）還會出現在頁面專屬樣式裡，例如使用教學頁，這是預期的，Task 4 處理。標題區還沒有雲，Task 5 處理。

- [ ] **Step 7: Commit**

```bash
git add src/styles/global.css src/components/ThemeToggle.astro src/layouts/SiteLayout.astro
git commit -m "feat: 全域樣式改用主題變數並加入亮暗切換鈕

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 頁面與元件樣式改用主題變數

**Files:**
- Modify: `src/components/PageChapters.astro`（`<style>`）
- Modify: `src/components/OAuthScreenshots.astro`（`<style>`）
- Modify: `src/pages/install.astro:79-115`
- Modify: `src/pages/how-to-use.astro:160-234`
- Modify: `src/pages/data-and-permissions.astro:92-102`
- Modify: `src/pages/interface.astro:154-209`

**Interfaces:**
- Consumes: Task 2 的變數（不再使用 `--cream --green --gold --rust --panel --panel2 --ink`）。
- Produces: 除了 `index.astro`（Task 5 處理）和 `OAuthScreenshots.astro` 裡刻意保留的截圖底色 `#e9ebed`、`#fff`，頁面與元件樣式裡沒有寫死的顏色，也沒有舊變數名稱。

只動 `<style>` 區塊，不動 HTML 標記與文字。

- [ ] **Step 1: 一次換掉意思明確的舊變數名稱**

Run:

```bash
sed -i -e 's/var(--cream)/var(--text)/g' -e 's/var(--gold)/var(--accent)/g' -e 's/var(--panel2)/var(--surface-2)/g' -e 's/var(--panel)/var(--surface)/g' -e 's/var(--rust)/var(--warning)/g' -e 's/var(--ink)/var(--on-primary)/g' src/pages/*.astro src/pages/setup/*.astro src/components/PageChapters.astro src/components/OAuthScreenshots.astro
```

Expected: 沒有輸出。

- [ ] **Step 2: 逐條替換 `--green` 與寫死的顏色**

`--green` 的規則：連結、hover、強調改 `--accent`；表示「完成、確認」改 `--success`。用 Edit 工具做下列精確替換（左欄字串必須完全相符，Step 1 之後的內容）。

`src/components/PageChapters.astro`

| 原字串 | 替換為 |
| --- | --- |
| `color:#c5c9b9;` | `color:var(--muted);` |
| `color:var(--green);border-left-color:var(--green);background:#222a22;` | `color:var(--accent);border-left-color:var(--accent);background:var(--surface-2);` |

`src/components/OAuthScreenshots.astro`

| 原字串 | 替換為 |
| --- | --- |
| `border: 1px solid #465046; border-radius: 4px; background: #242b26;` | `border: 1px solid var(--line); border-radius: 8px; background: var(--surface);` |
| `color: #d2d6c8;` | `color: var(--text);` |

（`.oauth-shot a` 的 `#e9ebed` 與 hover 的 `#fff` 是截圖的淺色襯底，兩個主題都保留。）

`src/pages/install.astro`

| 原字串 | 替換為 |
| --- | --- |
| `border: 1px solid #606a5a;` | `border: 1px solid var(--line);` |
| `margin: 8px 0 18px; color: var(--green);` | `margin: 8px 0 18px; color: var(--success);` |

`src/pages/data-and-permissions.astro`

| 原字串 | 替換為 |
| --- | --- |
| `.page-jump a{border:1px solid #52604b;color:var(--green);` | `.page-jump a{border:1px solid var(--line);color:var(--accent);` |
| `.page-jump a:hover{background:#293326}` | `.page-jump a:hover{background:var(--surface-2)}` |
| `.tree-panel{border:1px solid #52604b;background:#131815;` | `.tree-panel{border:1px solid var(--line);background:var(--code-bg);` |
| `color:#d6ddc7;display:flex` | `color:var(--code-text);display:flex` |
| `.tree-dot{width:8px;height:8px;border-radius:50%;background:var(--green);` | `.tree-dot{width:8px;height:8px;border-radius:50%;background:var(--success);` |
| `.tree-top-note{margin-left:auto;color:#7f8c7c}` | `.tree-top-note{margin-left:auto;color:var(--muted)}` |
| `overflow-x:auto;color:#c3d1ae;` | `overflow-x:auto;color:var(--code-text);` |
| `.tree-notes p{margin:0;color:#b9bdb1;` | `.tree-notes p{margin:0;color:var(--muted);` |
| `.chat-identity{border:1px solid #667456;background:#283225;` | `.chat-identity{border:1px solid var(--accent);background:var(--accent-soft);border-radius:8px;` |
| `.chat-identity p{color:#cbd5c1;` | `.chat-identity p{color:var(--text);` |
| `.process-card li{padding:0 0 12px 5px;color:#c0c5b8;` | `.process-card li{padding:0 0 12px 5px;color:var(--text);` |
| `.choice strong{font-size:13px;color:var(--green)}` | `.choice strong{font-size:13px;color:var(--accent)}` |
| `.choice p{font-size:12px;color:#b7bdb0;` | `.choice p{font-size:12px;color:var(--muted);` |
| `border:1px solid var(--line);background:#1b211d;` | `border:1px solid var(--line);background:var(--surface);border-radius:8px;` |
| `.small-panel{border-left:2px solid var(--accent);background:#20251f;` | `.small-panel{border-left:2px solid var(--accent);background:var(--surface);` |

另外把 `.process-card{min-width:0;border:1px solid var(--line);background:var(--surface);padding:26px}` 改成 `.process-card{min-width:0;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:26px}`。

`src/pages/how-to-use.astro`

| 原字串 | 替換為 |
| --- | --- |
| `  .tutorial-hero { background:radial-gradient(ellipse at 82% 35%,#3f49335c,transparent 42%),linear-gradient(115deg,#171b19,#202721); }` 整行 | 刪除整行（標題區背景改由 Task 5 的雲朵提供） |
| `.tutorial-hero h1 span { color:var(--green); }` | `.tutorial-hero h1 span { color:var(--accent); }` |
| `.journey-card { border:1px solid #69765e;background:#202823;box-shadow:18px 18px 0 #101512;` | `.journey-card { border:1px solid var(--line);border-radius:12px;background:var(--surface);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 24px 50px var(--shadow);` |
| `.journey-card a:hover { color:var(--green);` | `.journey-card a:hover { color:var(--accent);` |
| `padding:13px 0;border-bottom:1px solid #ffffff13; }` | `padding:13px 0;border-bottom:1px solid var(--line); }` |
| `border-bottom:1px solid #ffffff17;scroll-margin-top:78px;` | `border-bottom:1px solid var(--line);scroll-margin-top:78px;` |
| `.chapter-intro { color:#c0c5b8;` | `.chapter-intro { color:var(--muted);` |
| `.prep-item { background:var(--surface);border:1px solid var(--line);` | `.prep-item { background:var(--surface);border:1px solid var(--line);border-radius:8px;` |
| `.inline-note { color:#c4c8b8;font-size:13px;line-height:1.85;padding:16px 19px;border-left:2px solid var(--green);background:#242d25;` | `.inline-note { color:var(--text);font-size:13px;line-height:1.85;padding:16px 19px;border-left:3px solid var(--accent);border-radius:0 6px 6px 0;background:var(--accent-soft);` |
| `border:1px solid #6a795c;border-radius:50%;color:var(--green);` | `border:1px solid var(--accent);border-radius:50%;color:var(--accent);` |
| `.instruction-list p { color:#c5c9bc;` | `.instruction-list p { color:var(--text);` |
| `.result-box { background:#252f27;border-left:2px solid var(--green);` | `.result-box { background:var(--success-soft);border-left:3px solid var(--success);border-radius:0 6px 6px 0;` |
| `.result-box>span { display:block;color:var(--green);` | `.result-box>span { display:block;color:var(--success);` |
| `.result-box p { color:#d3d9ca;` | `.result-box p { color:var(--text);` |
| `border:1px solid #5b665d;background:#1c211f; }` | `border:1px solid var(--line);border-radius:8px;background:var(--surface-2); }` |
| `.tip-row { display:grid;grid-template-columns:190px minmax(0,1fr);gap:18px;margin-top:23px;padding:18px 20px;background:var(--surface);border:1px solid var(--line); }` | `.tip-row { display:grid;grid-template-columns:190px minmax(0,1fr);gap:18px;margin-top:23px;padding:18px 20px;background:var(--surface);border:1px solid var(--line);border-radius:8px; }` |
| `border:1px solid var(--line);color:#c8ccbe;` | `border:1px solid var(--line);border-radius:8px;color:var(--text);` |
| `.finish-list li:before { content:"✓";position:absolute;left:15px;color:var(--green);` | `.finish-list li:before { content:"✓";position:absolute;left:15px;color:var(--success);` |
| `padding-left:20px;color:#c2c6b9;` | `padding-left:20px;color:var(--text);` |
| `.environment-grid .checkline { color:var(--green);` | `.environment-grid .checkline { color:var(--success);` |
| `.status-grid>div { position:relative;padding:18px 20px 18px 44px;border:1px solid var(--line);background:var(--surface);` | `.status-grid>div { position:relative;padding:18px 20px 18px 44px;border:1px solid var(--line);border-radius:8px;background:var(--surface);` |
| `.status-dot.green { background:#9fc889; }.status-dot.gold { background:#d4b16b; }.status-dot.rust { background:#c98262; }.status-dot.grey { background:#9ba299; }` | `.status-dot.green { background:var(--success); }.status-dot.gold { background:var(--accent); }.status-dot.rust { background:var(--warning); }.status-dot.grey { background:var(--muted); }` |
| `.plain-list { color:#c4c8bb;` | `.plain-list { color:var(--text);` |
| `.journey-card { max-width:520px;box-shadow:8px 8px 0 #101512; }` | `.journey-card { max-width:520px; }` |

`src/pages/interface.astro`

| 原字串 | 替換為 |
| --- | --- |
| `.tour-jumps a { border:1px solid var(--line); padding:9px 13px;` | `.tour-jumps a { border:1px solid var(--line); border-radius:3px; padding:9px 13px;` |
| `.tour-jumps a:hover { border-color:var(--green); color:var(--green); }` | `.tour-jumps a:hover { border-color:var(--accent); color:var(--accent); }` |
| `border:1px solid #65725b; background:#303532; box-shadow:0 20px 45px #0006;` | `border:1px solid var(--line); border-radius:10px; background:var(--surface-2); box-shadow:0 20px 45px var(--shadow);` |
| `border:1px solid var(--line); background:#1a1d25; }` | `border:1px solid var(--line); border-radius:8px; background:var(--surface-2); }` |
| `.sync-flow-node { min-width:0; padding:22px; border:1px solid var(--line); background:var(--surface); }` | `.sync-flow-node { min-width:0; padding:22px; border:1px solid var(--line); border-radius:8px; background:var(--surface); }` |
| `.sync-flow-source { border-top:2px solid var(--green); }` | `.sync-flow-source { border-top:2px solid var(--success); }` |
| `border-left:2px solid var(--green); background:var(--surface); }` | `border-left:2px solid var(--success); border-radius:0 8px 8px 0; background:var(--surface); }` |
| `border-top:1px solid var(--line); color:var(--green); font-size:11px;` | `border-top:1px solid var(--line); color:var(--success); font-size:11px;` |
| `.action-card.important { border-color:#725b41; }` | `.action-card.important { border-color:var(--accent); }` |
| `.flow-list li { min-width:0; padding:19px; border:1px solid var(--line); background:var(--surface); }` | `.flow-list li { min-width:0; padding:19px; border:1px solid var(--line); border-radius:8px; background:var(--surface); }` |

- [ ] **Step 3: 確認沒有殘留的舊顏色**

Run:

```bash
grep -rnE "var\(--(cream|green|gold|panel2?|rust|ink)\)" src/pages src/components; grep -rnoE "(background|color|border[a-z-]*|box-shadow|outline)\s*:[^;}]*#[0-9a-fA-F]{3,8}\b" src/pages src/components
```

Expected：
- 第一個 grep 沒有輸出。
- 第二個 grep 只剩這幾行：`src/pages/index.astro` 裡 `.product-shot` 的顏色（Task 5 處理），以及 `src/components/OAuthScreenshots.astro` 的 `background: #e9ebed` 與 `background: #fff`。出現其他行就依 Step 2 的規則補上替換。

- [ ] **Step 4: 型別檢查、測試、建置**

Run: `npm run typecheck && npm test && npm run build`
Expected: 全部通過。

- [ ] **Step 5: 瀏覽器檢查**

`npm run dev`，在亮色與暗色下各看一次：`/how-to-use/`、`/data-and-permissions/`、`/interface/`、`/install/`、`/setup/google-oauth/`。

- 卡片、提示框、結果框、程式碼區塊、截圖外框都跟著主題變色，沒有綠色殘留。
- 使用教學頁左側章節目錄 hover 時是黃銅色。
- 打勾、結果框、狀態綠點是成功色（亮色深綠、暗色淺綠）。

- [ ] **Step 6: Commit**

```bash
git add src/pages src/components/PageChapters.astro src/components/OAuthScreenshots.astro
git commit -m "refactor: 頁面與元件樣式改用主題變數

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 共用雲朵元件與所有標題區

**Files:**
- Create: `src/components/CloudSky.astro`
- Modify: `src/styles/global.css`（topbar、sky-scope、hero 區段）
- Modify: `src/layouts/SiteLayout.astro`（底部 `<script>`）
- Modify: `src/pages/index.astro`（hero 標記與 `<style>`）
- Modify: `src/pages/changelog.astro`、`faq.astro`、`install.astro`、`how-to-use.astro`、`data-and-permissions.astro`、`interface.astro`、`setup/google-oauth.astro`（frontmatter import 與 `<header class="page-hero">`）

**Interfaces:**
- Consumes: Task 2 的雲朵變數；Task 3 的 `.sky-scope`、`--topbar-h`。
- Produces: `<CloudSky variant="full" | "compact" />`；`.topbar[data-solid]` 屬性代表實底導覽列。

- [ ] **Step 1: 建立雲朵元件**

建立 `src/components/CloudSky.astro`。漸層與濾鏡定義在第一個 SVG，其他 SVG 用 `url(#cloud-…)` 共用；同一頁只放一個 `CloudSky`，所以 id 不會重複。

```astro
---
interface Props {
  variant?: 'full' | 'compact';
}

const { variant = 'full' } = Astro.props;
---
<div class:list={['cloud-sky', `cloud-sky--${variant}`]} aria-hidden="true">
  <svg class="cloud-sky__defs" width="0" height="0" focusable="false">
    <defs>
      <linearGradient id="cloud-puff" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color: var(--puff-1)" />
        <stop offset="1" style="stop-color: var(--puff-2)" />
      </linearGradient>
      <linearGradient id="cloud-bank" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color: var(--bank-1)" />
        <stop offset="0.5" style="stop-color: var(--bank-2)" />
        <stop offset="0.8" style="stop-color: var(--bank-3)" />
        <stop offset="1" style="stop-color: var(--bank-4)" />
      </linearGradient>
      <filter id="cloud-billow" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="5" seed="9" />
        <feDisplacementMap in="SourceGraphic" scale="75" />
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <filter id="cloud-soft" x="-50%" y="-100%" width="200%" height="300%">
        <feGaussianBlur stdDeviation="34" />
      </filter>
    </defs>
  </svg>

  <svg class="cloud-sky__stars" viewBox="300 0 500 140" preserveAspectRatio="xMaxYMin slice">
    <g fill="#fff">
      <circle cx="430" cy="40" r="0.9" />
      <circle cx="540" cy="70" r="1.1" />
      <circle cx="740" cy="34" r="0.8" />
      <circle cx="330" cy="90" r="0.7" />
      <circle cx="620" cy="20" r="1" />
      <circle cx="480" cy="130" r="0.7" />
      <circle cx="780" cy="110" r="0.9" />
    </g>
  </svg>

  {variant === 'full' && (
    <svg class="cloud-sky__puff" viewBox="470 30 380 180">
      <g filter="url(#cloud-billow)" opacity="0.92" fill="url(#cloud-puff)">
        <circle cx="600" cy="128" r="44" />
        <circle cx="656" cy="110" r="56" />
        <circle cx="716" cy="130" r="42" />
        <ellipse cx="660" cy="150" rx="106" ry="26" />
      </g>
    </svg>
  )}

  <svg class="cloud-sky__bank" viewBox="0 250 1600 200" preserveAspectRatio="xMidYMax slice">
    <ellipse class="cloud-sky__glow" cx="960" cy="420" rx="360" ry="100" filter="url(#cloud-soft)" />
    <g filter="url(#cloud-billow)" fill="url(#cloud-bank)">
      <circle cx="40" cy="410" r="80" />
      <circle cx="160" cy="400" r="72" />
      <circle cx="290" cy="412" r="78" />
      <circle cx="420" cy="388" r="90" />
      <circle cx="560" cy="374" r="100" />
      <circle cx="700" cy="380" r="96" />
      <circle cx="810" cy="392" r="82" />
      <circle cx="920" cy="404" r="76" />
      <circle cx="1050" cy="396" r="84" />
      <circle cx="1180" cy="410" r="74" />
      <circle cx="1300" cy="386" r="92" />
      <circle cx="1440" cy="378" r="98" />
      <circle cx="1560" cy="400" r="80" />
      <circle cx="1640" cy="392" r="82" />
    </g>
  </svg>

  <div class="cloud-sky__grain"></div>
</div>

<style>
  .cloud-sky {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    background: linear-gradient(180deg, var(--sky-1) 0%, var(--sky-2) 70%, var(--sky-3) 100%);
  }

  /* Fade the bottom edge into the page so the cloud bank has no seam. */
  .cloud-sky::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 56px;
    background: linear-gradient(to bottom, transparent, var(--bg));
  }

  .cloud-sky__defs {
    position: absolute;
  }

  .cloud-sky__stars {
    position: absolute;
    top: 0;
    right: 0;
    width: min(70%, 900px);
    height: 220px;
    opacity: var(--star-opacity);
  }

  .cloud-sky__puff {
    position: absolute;
    top: calc(var(--topbar-h) + 10px);
    right: -2%;
    width: min(44vw, 540px);
    height: auto;
  }

  .cloud-sky__bank {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 280px;
  }

  .cloud-sky--compact .cloud-sky__bank {
    height: 190px;
  }

  .cloud-sky__glow {
    fill: var(--glow);
    opacity: var(--glow-opacity);
  }

  .cloud-sky__grain {
    position: absolute;
    inset: 0;
    opacity: 0.15;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  @media (max-width: 800px) {
    .cloud-sky__puff {
      display: none;
    }

    .cloud-sky__bank {
      height: 170px;
    }

    .cloud-sky--compact .cloud-sky__bank {
      height: 130px;
    }
  }
</style>
```

- [ ] **Step 2: 導覽列改成疊在雲上**

在 `src/styles/global.css`：

(a) 把 `.sky-scope {` 這個選擇器改成同時套用到未捲動的導覽列：

原字串：
```css
/* Areas painted on top of the cloud sky swap to the light-on-sky palette. */
.sky-scope {
```
替換為：
```css
/* Areas painted on top of the cloud sky swap to the light-on-sky palette. */
.sky-scope,
.topbar:not([data-solid]) {
```

(b) 把 `.topbar { … }` 整個規則換成：

```css
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: var(--topbar-h);
  padding: 0 clamp(22px, 6vw, 96px);
  display: flex;
  align-items: center;
  gap: 20px;
  border-bottom: 1px solid transparent;
  transition: background-color 0.25s ease, border-color 0.25s ease;
}

.topbar[data-solid] {
  background: var(--topbar-bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom-color: var(--line);
}
```

- [ ] **Step 3: 標題區改成雲朵天空**

在 `src/styles/global.css`，把 `/* ---------- Page heroes (cloud sky is added in Task 5) ---------- */` 到 `.page-hero h1 { … }` 為止的整段，換成：

```css
/* ---------- Page heroes: the cloud sky sits under the transparent top bar ---------- */
.hero,
.page-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin-top: calc(-1 * var(--topbar-h));
}

.hero > .wrap,
.page-hero > .wrap {
  position: relative;
  z-index: 2;
}

/* Bottom padding keeps copy above the pale cloud bank. */
.hero {
  padding: calc(var(--topbar-h) + 70px) 0 230px;
}

.page-hero {
  padding: calc(var(--topbar-h) + 64px) 0 150px;
}

.page-hero h1 {
  font-size: clamp(34px, 5vw, 54px);
}
```

並把 `@media (max-width: 800px)` 裡的這兩條：

```css
  .hero {
    padding: 56px 0;
  }
```
```css
  .page-hero {
    padding: 58px 0 42px;
  }
```

分別換成：

```css
  .hero {
    padding: calc(var(--topbar-h) + 48px) 0 170px;
  }
```
```css
  .page-hero {
    padding: calc(var(--topbar-h) + 44px) 0 120px;
  }
```

- [ ] **Step 4: 捲動或打開選單時，導覽列變實底**

在 `src/layouts/SiteLayout.astro` 底部的 `<script>`，把整段換成：

```ts
      const topbar = document.querySelector<HTMLElement>('.topbar');
      const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
      const nav = document.querySelector<HTMLElement>('#main-nav');
      const updateSolid = () => {
        const menuOpen = nav?.classList.contains('open') === true;
        topbar?.toggleAttribute('data-solid', window.scrollY > 8 || menuOpen);
      };
      toggle?.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        nav?.classList.toggle('open', !expanded);
        updateSolid();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && nav?.classList.contains('open')) {
          nav.classList.remove('open');
          toggle?.setAttribute('aria-expanded', 'false');
          toggle?.focus();
          updateSolid();
        }
      });
      window.addEventListener('scroll', updateSolid, { passive: true });
      updateSolid();
```

（保留外層的 `<script>` 與 `</script>` 標籤。）

- [ ] **Step 5: 首頁主視覺**

在 `src/pages/index.astro`：

(a) frontmatter 的 `import SiteLayout from '../layouts/SiteLayout.astro';` 下一行加入：

```ts
import CloudSky from '../components/CloudSky.astro';
```

(b) 原字串：
```astro
  <section class="hero">
    <div class="wrap hero-grid">
```
替換為：
```astro
  <section class="hero sky-scope">
    <CloudSky variant="full" />
    <div class="wrap hero-grid">
```

(c) 把檔案底部的 `<style> … </style>` 整段換成：

```astro
<style>
  .product-shot {
    margin: 0;
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 26px 60px var(--shadow);
  }

  .product-shot img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 6px;
  }

  .product-shot figcaption {
    margin-top: 11px;
    color: var(--muted);
    font-size: 11px;
    text-align: right;
  }

  .product-shot-link {
    display: block;
    margin-top: 9px;
    font-size: 12px;
    text-align: right;
  }
</style>
```

（`.product-shot` 在 `.sky-scope` 裡，所以 `--surface`、`--line`、`--muted` 會自動是毛玻璃與淺色字的版本。舊的 `rotate(1deg)` 拿掉。）

- [ ] **Step 6: 其他 7 頁的標題區**

每一頁做兩件事：

1. frontmatter 的 SiteLayout import 下一行加入 CloudSky import：
   - `src/pages/*.astro`：`import CloudSky from '../components/CloudSky.astro';`
   - `src/pages/setup/google-oauth.astro`：`import CloudSky from '../../components/CloudSky.astro';`
2. 依下表替換 `<header>` 開頭（每個檔案只出現一次）：

| 檔案 | 原字串 | 替換為 |
| --- | --- | --- |
| `changelog.astro` | `<header class="page-hero"><div class="wrap">` | `<header class="page-hero sky-scope"><CloudSky variant="compact" /><div class="wrap">` |
| `faq.astro` | `<header class="page-hero"><div class="wrap">` | `<header class="page-hero sky-scope"><CloudSky variant="compact" /><div class="wrap">` |
| `install.astro` | `<header class="page-hero"><div class="wrap">` | `<header class="page-hero sky-scope"><CloudSky variant="compact" /><div class="wrap">` |
| `setup/google-oauth.astro` | `<header class="page-hero"><div class="wrap">` | `<header class="page-hero sky-scope"><CloudSky variant="compact" /><div class="wrap">` |
| `data-and-permissions.astro` | `<header class="page-hero"><div class="wrap">` | `<header class="page-hero sky-scope"><CloudSky variant="compact" /><div class="wrap">` |
| `interface.astro` | `<header class="page-hero">` | `<header class="page-hero sky-scope"><CloudSky variant="compact" />` |
| `how-to-use.astro` | `<header class="page-hero tutorial-hero">` | `<header class="page-hero tutorial-hero sky-scope"><CloudSky variant="compact" />` |

完成後確認每頁剛好一個：

Run: `grep -c "<CloudSky" src/pages/*.astro src/pages/setup/*.astro`
Expected: 8 個檔案都是 `1`。

- [ ] **Step 7: 型別檢查、測試、建置**

Run: `npm run typecheck && npm test && npm run build`
Expected: 全部通過。

- [ ] **Step 8: 瀏覽器檢查**

`npm run dev`，8 個頁面在亮色／暗色、1280px／375px 寬度下各看一次（共 32 個組合）：

1. 頁面最上方是天空與雲海，雲海底部和內文區無縫接合，沒有水平硬邊。
2. 標題、說明文字、小標、按鈕都清楚，沒有壓在淺色雲上。如果有，增加該斷點 `.hero` 或 `.page-hero` 的 `padding-bottom`（每次 +20px），不要縮小雲海。
3. 首頁：右上有一朵飄雲（1280px），手機寬度隱藏；面板示意圖是毛玻璃外框。
4. 切換主題時，雲的形狀與位置完全不動，只有顏色改變；暗色有星點與琥珀色雲底。
5. 導覽列在頁面頂端是透明、淺色字；往下捲動後變成實底並出現下邊線；手機版打開選單時也是實底，選單文字清楚。
6. 使用教學頁的「QUICK ROUTE」卡片是毛玻璃，文字清楚。
7. 1920px 寬時雲海沒有被拉扁或切掉頂部。

- [ ] **Step 9: Commit**

```bash
git add src/components/CloudSky.astro src/styles/global.css src/layouts/SiteLayout.astro src/pages
git commit -m "feat: 共用雲朵主視覺與疊在雲上的導覽列

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 移除舊變數名稱、更新文件、完整驗收

**Files:**
- Modify: `src/styles/theme.css`（刪除 legacy 區段）
- Modify: `src/styles/theme.test.ts`（新增一個測試）
- Modify: `README.md`（專案結構）

**Interfaces:**
- Consumes: Task 4 之後已經沒有任何地方用舊名稱。
- Produces: 最終版本。

- [ ] **Step 1: 寫會失敗的測試**

在 `src/styles/theme.test.ts` 的 `describe('dark theme', …)` 後面加上：

```ts
describe('legacy palette', () => {
  it('no longer defines the old variable names', () => {
    const legacy = ['cream', 'green', 'gold', 'rust', 'panel', 'panel2', 'ink'];
    expect(legacy.filter(name => name in light)).toEqual([]);
  });
});
```

- [ ] **Step 2: 執行測試，確認失敗**

Run: `npx vitest run src/styles/theme.test.ts`
Expected: FAIL，`expected [ 'cream', 'green', 'gold', 'rust', 'panel', 'panel2', 'ink' ] to deeply equal []`。

- [ ] **Step 3: 刪除舊名稱**

在 `src/styles/theme.css` 刪掉這一段（含註解）：

```css

  /* Legacy names still used by page styles; removed once pages are migrated. */
  --cream: var(--text);
  --green: var(--accent);
  --gold: var(--accent);
  --rust: var(--warning);
  --panel: var(--surface);
  --panel2: var(--surface-2);
  --ink: var(--on-primary);
```

- [ ] **Step 4: 執行測試，確認通過**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 5: 確認整個 src 沒有舊名稱與舊配色**

Run:

```bash
grep -rnE "var\(--(cream|green|gold|panel2?|rust|ink)\)" src; grep -rniE "#(171b19|202623|252c27|38413a|eee8d7|a7aa9e|b5c592|dfb878|c27d5b|1a201c)\b" src
```

Expected: 兩個 grep 都沒有輸出。

- [ ] **Step 6: 更新 README 的專案結構**

在 `README.md` 原字串：

```text
src/layouts/     共用版型、導覽與樣式
```
替換為：
```text
src/layouts/     共用版型與導覽
src/styles/      主題色彩變數（亮色／暗色）與全域樣式
```

並把：

```text
src/components/  頁內目錄及 OAuth 步驟截圖
src/lib/         網址格式助手及其測試
```
替換為：
```text
src/components/  雲朵主視覺、主題切換鈕、頁內目錄及 OAuth 步驟截圖
src/lib/         網址格式助手、主題切換與對比度工具，以及它們的測試
```

- [ ] **Step 7: 完整驗收**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck `0 errors`；所有測試 PASS；build 成功。

`npm run dev` 後，在瀏覽器確認：

1. 8 個頁面在亮色／暗色、1280px／375px 下都正常（同 Task 5 Step 8 的檢查項目）。
2. 切到暗色後重新整理：維持暗色、不閃爍。
3. DevTools → Application → 清除網站資料後，模擬系統暗色並重新整理：預設是暗色。
4. 在 Console 執行 `Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } })` 後點切換鈕：主題照常切換，Console 沒有未捕捉的錯誤。
5. 用鍵盤 Tab 可以移到切換鈕，focus 外框清楚；按 Enter 會切換；讀到的名稱是「切換為暗色主題」或「切換為亮色主題」。
6. 系統開啟「減少動態效果」（DevTools Rendering → `prefers-reduced-motion: reduce`）時，切換沒有漸變。
7. OAuth 頁的「酒館網址格式助手」：貼入網址後，✓／✕／提醒三種輸出顏色在兩個主題下都清楚。

- [ ] **Step 8: Commit**

```bash
git add src/styles/theme.css src/styles/theme.test.ts README.md
git commit -m "chore: 移除舊配色變數並更新專案結構說明

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
