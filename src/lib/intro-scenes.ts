import { luggage } from '../data/luggage';
import type { IntroScene, IntroStep } from './intro-timeline';

export const INTRO_DURATION = 31000;
export const FINAL_HOLD = 3000;
export const STAGE_CENTER = { x: 270, y: 560 } as const;

type Offset = readonly [number, number];

/** Scene 2: the six items lie around, waiting to be packed. */
export const SCATTER: ReadonlyArray<Offset> = [[-175, -140], [165, -150], [-195, 10], [190, -5], [-150, 150], [160, 140]];
/** Scene 4: the items unpack around the next chat window, in the home page's left/right rows. */
export const RING: ReadonlyArray<Offset> = luggage.map(item => [item.side === 'left' ? -190 : 190, (item.row - 2) * 95] as const);
/** Scene 4: the bundle rides from stop 01 (bottom) up to stop 03. */
export const ROUTE_OFFSETS: ReadonlyArray<Offset> = [[-206, 100], [-206, -20], [-206, -140]];

const px = ([x, y]: Offset) => `${x}px ${y}px`;
const ORIGIN = '0px 0px';
const item = (index: number) => `[data-intro="item-${index}"]`;
const intro = (name: string) => `[data-intro="${name}"]`;

export const AMBIENT_STEPS: IntroStep[] = [
  { target: '.cloud-sky__puff', at: 0, duration: 26000, easing: 'linear', keyframes: [{ translate: '30px 0' }, { translate: '-30px 0' }] },
];

export function buildScenes(theme: { dark: Keyframe; light: Keyframe }): IntroScene[] {
  return [
    {
      id: 'hero',
      start: 0,
      end: 5000,
      steps: [
        { target: '.cloud-sky__stars circle', at: 0, duration: 600, stagger: 250, count: 7, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: '.cloud-sky__bank', at: 300, duration: 1800, easing: 'cubic-bezier(.2,.7,.2,1)', keyframes: [{ translate: '0 100%' }, { translate: '0 0' }] },
        { target: '.cloud-sky__puff', at: 800, duration: 1200, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
      ],
      captions: [
        { target: intro('hero-eyebrow'), in: 1200, out: 4700 },
        { target: intro('hero-title'), in: 1800, out: 4700 },
      ],
    },
    {
      id: 'elsewhere',
      start: 5000,
      end: 12000,
      steps: [
        { target: intro('scene-home'), at: 5200, duration: 400, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: `${intro('scene-home')} .intro-scene__art`, at: 5200, duration: 1400, easing: 'ease-in-out', keyframes: [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }] },
        { target: `${intro('scene-home')} .bubble-fill`, at: 6400, duration: 300, stagger: 250, count: 2, keyframes: [{ opacity: 0, scale: '0.4' }, { opacity: 1, scale: '1' }] },
        { target: intro('scene-home'), at: 7600, duration: 600, easing: 'ease-in', keyframes: [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '-120px 0' }] },
        { target: intro('scene-mobile'), at: 7800, duration: 600, easing: 'ease-out', keyframes: [{ opacity: 0, translate: '120px 0' }, { opacity: 1, translate: '0 0' }] },
        { target: `${intro('scene-mobile')} .bubble-fill`, at: 8300, duration: 300, stagger: 200, count: 3, keyframes: [{ opacity: 0, scale: '0.4' }, { opacity: 1, scale: '1' }] },
        { target: intro('scene-mobile'), at: 9200, duration: 500, keyframes: [{ opacity: 1, scale: '1' }, { opacity: 0.25, scale: '0.85' }] },
        ...SCATTER.map((offset, index): IntroStep => ({
          target: item(index), at: 9300 + index * 120, duration: 500, easing: 'cubic-bezier(.2,.8,.3,1.2)',
          keyframes: [{ opacity: 0, scale: '0.6', translate: px(offset) }, { opacity: 1, scale: '1', translate: px(offset) }],
        })),
        { target: '.intro-item__icon', at: 9900, duration: 1500, stagger: 90, count: 6, keyframes: [{ rotate: '0deg' }, { rotate: '-7deg' }, { rotate: '6deg' }, { rotate: '-4deg' }, { rotate: '0deg' }] },
        { target: intro('scene-mobile'), at: 11400, duration: 500, keyframes: [{ opacity: 0.25 }, { opacity: 0 }] },
      ],
      captions: [
        { target: intro('cap-elsewhere'), in: 5400, out: 8600 },
        { target: intro('cap-packing'), in: 9100, out: 11900 },
      ],
    },
    {
      id: 'luggage',
      start: 12000,
      end: 19000,
      steps: [
        { target: intro('window'), at: 12300, duration: 600, easing: 'ease-out', keyframes: [{ opacity: 0, scale: '0.9' }, { opacity: 1, scale: '1' }] },
        { target: intro('threads'), at: 12800, duration: 400, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: '.intro-item__name', at: 13000, duration: 250, stagger: 450, count: 6, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        ...SCATTER.map((offset, index): IntroStep => ({
          target: item(index), at: 13500 + index * 450, duration: 650, easing: 'cubic-bezier(.5,0,.3,1)',
          keyframes: [{ opacity: 1, scale: '1', translate: px(offset) }, { opacity: 0, scale: '0.35', translate: ORIGIN }],
        })),
        { target: intro('dawn'), at: 14000, duration: 4500, easing: 'linear', keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('threads'), at: 16400, duration: 400, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
        { target: intro('window'), at: 16600, duration: 700, easing: 'ease-in', keyframes: [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.4' }] },
        { target: intro('bundle'), at: 17000, duration: 700, easing: 'cubic-bezier(.2,.8,.3,1.2)', keyframes: [{ opacity: 0, scale: '0.5', translate: ORIGIN }, { opacity: 1, scale: '1', translate: ORIGIN }] },
        { target: intro('bundle-glow'), at: 17400, duration: 1000, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
      ],
      captions: [
        { target: intro('cap-luggage'), in: 12500, out: 18800 },
      ],
    },
    {
      id: 'route',
      start: 19000,
      end: 26000,
      steps: [
        { target: intro('dawn'), at: 19000, duration: 2000, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
        { target: intro('route'), at: 19000, duration: 500, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('bundle-cloud'), at: 19200, duration: 400, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('bundle'), at: 19200, duration: 700, easing: 'ease-in-out', keyframes: [{ translate: ORIGIN }, { translate: px(ROUTE_OFFSETS[0]) }] },
        { target: ':scope', at: 19500, duration: 5000, easing: 'ease-in-out', keyframes: [theme.dark, theme.light] },
        { target: `${intro('stop-0')} .intro-route__lit`, at: 19900, duration: 300, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('bundle'), at: 20300, duration: 900, easing: 'ease-in-out', keyframes: [{ translate: px(ROUTE_OFFSETS[0]) }, { translate: px(ROUTE_OFFSETS[1]) }] },
        { target: `${intro('stop-1')} .intro-route__lit`, at: 21200, duration: 300, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('bundle'), at: 21600, duration: 900, easing: 'ease-in-out', keyframes: [{ translate: px(ROUTE_OFFSETS[1]) }, { translate: px(ROUTE_OFFSETS[2]) }] },
        { target: `${intro('stop-2')} .intro-route__lit`, at: 22500, duration: 300, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
        { target: intro('route'), at: 22700, duration: 400, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
        { target: intro('bundle'), at: 22700, duration: 600, easing: 'ease-in-out', keyframes: [{ translate: px(ROUTE_OFFSETS[2]) }, { translate: ORIGIN }] },
        { target: intro('bundle-cloud'), at: 22900, duration: 400, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
        { target: intro('window-next'), at: 23200, duration: 600, easing: 'ease-out', keyframes: [{ opacity: 0, scale: '0.9' }, { opacity: 1, scale: '1' }] },
        { target: intro('bundle'), at: 23300, duration: 400, easing: 'ease-in', keyframes: [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.3' }] },
        ...RING.map((offset, index): IntroStep => ({
          target: item(index), at: 23500 + index * 120, duration: 600, easing: 'cubic-bezier(.2,.8,.3,1)',
          keyframes: [{ opacity: 0, scale: '0.35', translate: ORIGIN }, { opacity: 1, scale: '1', translate: px(offset) }],
        })),
        { target: intro('window-next'), at: 25400, duration: 500, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
        { target: intro('items'), at: 25400, duration: 500, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
      ],
      captions: [
        { target: intro('cap-route'), in: 19300, out: 22600 },
        { target: intro('cap-unpack'), in: 23000, out: 25800 },
      ],
    },
    {
      id: 'farewell',
      start: 26000,
      end: INTRO_DURATION,
      steps: [],
      captions: [
        { target: intro('cap-farewell'), in: 26300, out: INTRO_DURATION },
        { target: intro('brand'), in: 27000, out: INTRO_DURATION },
      ],
    },
  ];
}
