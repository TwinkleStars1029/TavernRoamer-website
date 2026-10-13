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
