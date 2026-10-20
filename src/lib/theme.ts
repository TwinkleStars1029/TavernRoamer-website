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
