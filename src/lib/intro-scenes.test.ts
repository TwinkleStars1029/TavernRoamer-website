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
