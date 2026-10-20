import themeCss from '../styles/theme.css?raw';
import { parseThemeTokens, registerThemeProperties, themeKeyframes } from './intro-theme';
import { AMBIENT_STEPS, INTRO_DURATION, buildScenes } from './intro-scenes';
import { createPlayer, flattenSteps, type IntroPlayer } from './intro-timeline';

declare global {
  interface Window {
    __intro?: IntroPlayer;
  }
}

async function boot() {
  const stage = document.querySelector('[data-intro-stage]');
  if (!stage) throw new Error('Intro stage not found');
  const tokens = parseThemeTokens(themeCss);
  registerThemeProperties(tokens);
  await document.fonts.ready;

  const steps = flattenSteps(buildScenes(themeKeyframes(tokens)), AMBIENT_STEPS, INTRO_DURATION);
  const player = createPlayer(stage, steps, INTRO_DURATION);
  window.__intro = player;

  const params = new URLSearchParams(location.search);
  const seconds = params.get('t');
  if (params.has('export')) player.seek(0);
  else if (seconds !== null) player.seek(Number(seconds) * 1000);
  else player.play();
  document.documentElement.dataset.introReady = 'true';
}

boot().catch(error => {
  document.documentElement.dataset.introError = String(error);
  console.error(error);
});
