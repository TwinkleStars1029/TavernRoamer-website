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
