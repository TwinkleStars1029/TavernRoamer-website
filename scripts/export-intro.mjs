// Renders /intro/ frame by frame and encodes it as a 1080×1920, 30fps MP4.
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright';

const FPS = 30;
const WIDTH = 540;
const HEIGHT = 960;
const SCALE = 2;
const FONT_FAMILIES = ['Noto Sans TC', 'Noto Serif TC'];
const OUT_DIR = path.resolve('exports');
const OUT_VIDEO = path.join(OUT_DIR, 'tavernroamer-intro.mp4');
const OUT_POSTER = path.join(OUT_DIR, 'tavernroamer-intro-poster.png');
const ASTRO_BIN = path.resolve('node_modules/astro/bin/astro.mjs');

// Build and preview at the site root so /intro/ resolves the same way every time.
const childEnv = { ...process.env };
delete childEnv.SITE_BASE;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: childEnv });
    child.on('error', reject);
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${path.basename(command)} ${args[0]} exited with ${code}`))));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not up yet.
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Preview server did not answer at ${url} within ${timeoutMs / 1000}s`);
}

function probe(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-i', file]);
    let output = '';
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    // ffmpeg exits 1 when given no output file; the stream info is still printed.
    child.on('exit', () => resolve(output));
  });
}

async function main() {
  if (!ffmpegPath) throw new Error('ffmpeg-static has no binary for this platform');

  await run(process.execPath, [ASTRO_BIN, 'build']);

  const port = await freePort();
  const pageUrl = `http://127.0.0.1:${port}/intro/?export`;
  const preview = spawn(process.execPath, [ASTRO_BIN, 'preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore', env: childEnv });
  let browser;
  let framesDir;
  let keepFrames = false;

  try {
    await waitForServer(`http://127.0.0.1:${port}/intro/`);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE });
    await page.goto(pageUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.introReady === 'true' || document.documentElement.dataset.introError, null, { timeout: 30000 });

    const bootError = await page.evaluate(() => document.documentElement.dataset.introError);
    if (bootError) throw new Error(`Intro page failed to start: ${bootError}`);
    const hasPlayer = await page.evaluate(() => typeof window.__intro?.seek === 'function');
    if (!hasPlayer) throw new Error('window.__intro is missing; check that the build includes src/lib/intro-boot.ts');

    const missingFonts = await page.evaluate(async families => {
      await document.fonts.ready;
      const loaded = new Set([...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replace(/["']/g, '')));
      return families.filter(family => !loaded.has(family));
    }, FONT_FAMILIES);
    if (missingFonts.length > 0) throw new Error(`Fonts did not load (Google Fonts needs a network connection): ${missingFonts.join(', ')}`);

    const duration = await page.evaluate(() => window.__intro.duration);
    const total = Math.ceil((duration / 1000) * FPS);
    framesDir = await mkdtemp(path.join(tmpdir(), 'tavernroamer-intro-'));
    console.log(`Rendering ${total} frames to ${framesDir}`);

    for (let frame = 0; frame < total; frame++) {
      await page.evaluate(async time => {
        window.__intro.seek(time);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, (frame * 1000) / FPS);
      await page.screenshot({ path: path.join(framesDir, `frame-${String(frame).padStart(5, '0')}.png`) });
      if (frame % FPS === 0) console.log(`  ${frame / FPS}s`);
    }

    await mkdir(OUT_DIR, { recursive: true });
    keepFrames = true;
    await run(ffmpegPath, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-framerate', String(FPS),
      '-i', path.join(framesDir, 'frame-%05d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow',
      '-movflags', '+faststart',
      OUT_VIDEO,
    ]);
    const frames = (await readdir(framesDir)).sort();
    await copyFile(path.join(framesDir, frames.at(-1)), OUT_POSTER);
    keepFrames = false;

    const info = await probe(OUT_VIDEO);
    const size = /(\d{3,4})x(\d{3,4})/.exec(info);
    const fps = /(\d+(?:\.\d+)?) fps/.exec(info);
    const length = /Duration: (\d\d:\d\d:\d\d\.\d\d)/.exec(info);
    console.log(`Done: ${OUT_VIDEO}`);
    console.log(`  ${size?.[0]} · ${fps?.[1]} fps · ${length?.[1]}`);
    console.log(`  poster: ${OUT_POSTER}`);
    if (size?.[0] !== `${WIDTH * SCALE}x${HEIGHT * SCALE}`) throw new Error(`Unexpected video size: ${size?.[0]}`);
  } finally {
    await browser?.close();
    preview.kill();
    if (framesDir && !keepFrames) await rm(framesDir, { recursive: true, force: true });
    if (framesDir && keepFrames) console.error(`Frames kept for debugging: ${framesDir}`);
  }
}

main().catch(error => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
