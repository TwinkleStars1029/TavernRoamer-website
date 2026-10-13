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

describe('legacy palette', () => {
  it('no longer defines the old variable names', () => {
    const legacy = ['cream', 'green', 'gold', 'rust', 'panel', 'panel2', 'ink'];
    expect(legacy.filter(name => name in light)).toEqual([]);
  });
});
