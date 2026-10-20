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
