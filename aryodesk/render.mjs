// Offline renderer: drives index.html in several headless Chromium instances,
// renders each frame with motion-blur subframes and pipes PNGs into ffmpeg.
//
//   node render.mjs                         full 1080p60 render -> aryodesk.mp4
//   node render.mjs --stills 0.5,3.2,7.9    individual frames -> build/stills/
//   node render.mjs --sheet                 contact sheet of the whole reel
//
//   node render.mjs --speed 0.5             the same film at half speed (30 s) -> aryodesk-half-speed.mp4
//
// Options: --workers N  --subframes N  --out file  --from S --to S (playback seconds)  --speed X
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(ROOT, 'build');
fs.mkdirSync(BUILD, { recursive: true });

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i < 0 ? def : args[i + 1] ?? true; };
const has = (name) => args.includes(`--${name}`);

async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const g = execSync('npm root -g').toString().trim();
    return createRequire(path.join(g, 'noop.js'))('playwright');
  }
}
function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { execSync('ffmpeg -version', { stdio: 'ignore' }); return 'ffmpeg'; } catch {}
  return execSync('python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"').toString().trim();
}

// tiny static server (fonts don't load over file://)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html?render`;

const { chromium } = await loadPlaywright();
async function openPage() {
  const browser = await chromium.launch({ args: ['--disable-web-security'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(URL_);
  await page.evaluate(() => window.reelReady);
  return { browser, page };
}

const FPS = 60, DUR = 15;
const speed = +opt('speed', 1);
const LEN = DUR / speed; // playback length in seconds
const subframes = +opt('subframes', 8);
const workers = +opt('workers', 4);

if (has('stills') || has('sheet')) {
  const times = has('sheet')
    ? Array.from({ length: 60 }, (_, i) => (i + 0.5) * 0.25)
    : String(opt('stills')).split(',').map(Number);
  const dir = path.join(BUILD, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  const { browser, page } = await openPage();
  const files = [];
  for (const t of times) {
    const i = Math.round(t * FPS);
    const b64 = await page.evaluate(([i, s]) => window.renderFrame(i, { subframes: s }), [i, subframes]);
    const f = path.join(dir, `f${String(i).padStart(4, '0')}.png`);
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    files.push(f);
    console.log(f);
  }
  await browser.close();
  if (has('sheet')) {
    const ff = ffmpegPath();
    execSync(`${ff} -y -loglevel error -framerate 1 -pattern_type glob -i '${dir}/f*.png' -vf "scale=384:216,tile=6x10:padding=4:color=white" -frames:v 1 ${path.join(BUILD, 'sheet.png')}`);
    console.log(path.join(BUILD, 'sheet.png'));
  }
  server.close();
  process.exit(0);
}

// ---- full render
const from = Math.round(+opt('from', 0) * FPS), to = Math.round(+opt('to', LEN) * FPS);
const outName = speed === 1 ? 'aryodesk.mp4' : speed === 0.5 ? 'aryodesk-half-speed.mp4' : `aryodesk-speed${speed}.mp4`;
const out = path.resolve(opt('out', path.join(ROOT, outName)));
const wav = path.join(BUILD, speed === 1 ? 'aryodesk.wav' : `aryodesk-speed${speed}.wav`);
const ff = ffmpegPath();
const ffArgs = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-'];
const withAudio = fs.existsSync(wav) && !has('no-audio');
if (withAudio) ffArgs.push('-ss', String(from / FPS), '-i', wav);
// default: web delivery (~18 MB). --master: near-lossless, grain-preserving (~70 MB)
const vq = has('master') ? ['-crf', '14', '-tune', 'grain'] : ['-crf', '18'];
ffArgs.push('-c:v', 'libx264', '-preset', 'slow', ...vq, '-pix_fmt', 'yuv420p',
  '-x264-params', 'keyint=60', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709');
if (withAudio) ffArgs.push('-c:a', 'aac', '-b:a', '320k', '-shortest');
ffArgs.push('-movflags', '+faststart', out);
const enc = spawn(ff, ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
const encDone = new Promise((r, j) => enc.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))));

const frames = new Map();
let next = from, flushing = Promise.resolve();
const t0 = Date.now();
function flush() {
  flushing = flushing.then(async () => {
    while (frames.has(next)) {
      const buf = frames.get(next); frames.delete(next);
      if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
      next++;
      if (next % 30 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`frame ${next}/${to}  ${(el).toFixed(0)}s  eta ${(((to - next) * el) / (next - from)).toFixed(0)}s`);
      }
    }
  });
}
let cursor = from;
await Promise.all(Array.from({ length: workers }, async () => {
  const { browser, page } = await openPage();
  while (true) {
    while (frames.size > workers * 6) await new Promise((r) => setTimeout(r, 20));
    const i = cursor++;
    if (i >= to) break;
    const b64 = await page.evaluate(([i, s, sp]) => window.renderFrame(i, { subframes: s, speed: sp }), [i, subframes, speed]);
    frames.set(i, Buffer.from(b64, 'base64'));
    flush();
  }
  await browser.close();
}));
await flushing;
enc.stdin.end();
await encDone;
server.close();
console.log(`wrote ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
