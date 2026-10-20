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
