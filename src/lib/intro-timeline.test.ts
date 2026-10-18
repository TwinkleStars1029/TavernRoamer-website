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
