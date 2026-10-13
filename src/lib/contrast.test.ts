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
