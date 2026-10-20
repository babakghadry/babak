// MeshCentral — Babak Ghadri: an Instagram Reel (9x16) cut to Babak's own narration. A pure function of
// time: window.seek(t) paints frame t. Timing is in beats (u) on the score's grid (beats.json, 124.8 bpm,
// the drop on beat 52 = the word "MeshCentral"); docs/shotlist.md is the plan, docs/script.md the words.
import * as M from './lib/motion.js';
import * as G from './lib/gl.js';
import { phrase, supers, line, width } from './lib/type.js';
import { codeSet } from './sets/code.js';
import { worldSet } from './sets/world.js';
import { markSet } from './sets/mark.js';
import { screensSet } from './sets/screens.js';
import { backstageSet } from './sets/backstage.js';

const { W, H, E, prog, lerp, clamp, springU, SPRING, font, fill, rrect, hash01, shake, bump, mulberry32 } = M;

// Brand tokens: ink + paper, one accent (the portrait's own mustard), MeshCentral's blue for the product.
const C = { ink: '#0A0F1C', ink2: '#121B30', paper: '#F3EFE6', acc: '#E1AF31', blue: '#0E4A94', blue2: '#062552', mute: '#8C95AA' };
const RX = 930;                                       // Persian lines align right, at the safe edge

// The outage: is the connection down at beat u? (quarter-beat cells, beats 14-24; audio/score.py gate_off)
const gateOff = (u) => u >= 14 && u < 24 && hash01(Math.floor((u - 14) * 4), 7) < 0.32;

// ---------------------------------------------------------------- hits: [beat, label, sfx, opts]
const HITS = [
  [0, 'code slams in', 'impact', { gain: 0.8 }],
  ...[2, 4, 6, 8].map((b) => [b, 'digits flip', 'tick', { gain: 0.9 }]),
  ...[9.8, 10.3, 10.8, 11.3].map((b) => [b, 'impatient flips', 'tick', { gain: 1.0, pan: 0.2 }]),
  [12, 'یا بدتر stamp', 'thud', { pitch: 70, to: 40 }],
  [13.75, 'push through the ؟', 'whoosh', { len: 0.5, from: 500, to: 3000 }],
  [19.6, 'screens die', 'sub', { gain: 0.5, len: 0.8 }],
  [25, 'out along the link', 'whoosh', { len: 0.8, from: 300, to: 1800 }],
  [33.3, 'look back from the relay', 'whoosh', { len: 0.6, from: 1800, to: 500, gain: 0.2 }],
  [39.9, 'speed tied', 'click', { gain: 0.6 }],
  [44, 'lights out', 'sub', { gain: 0.4, len: 1.2 }],
  [52, 'MeshCentral', 'impact'],
  [53.2, 'icon lands', 'bell', { pitch: 'F6', gain: 0.25 }],
  [56, 'into the room', 'whoosh', { len: 0.5, from: 2400, to: 600 }],
  [57.3, 'own server lands', 'thud', { pitch: 90, to: 45 }],
  [62.1, 'chip: open source', 'pop', { pitch: 'C6', gain: 0.5 }],
  [64.2, 'chip: private', 'pop', { pitch: 'E6', gain: 0.5 }],
  [67.2, 'chip: own server', 'pop', { pitch: 'G6', gain: 0.5 }],
  [71.5, 'browser card', 'whoosh', { len: 0.5, from: 600, to: 2600 }],
  [73.2, 'no extra app: strike', 'click', { gain: 0.5 }],
  [78.5, 'just a browser', 'click', { gain: 0.5 }],
  [80.6, 'phone lands', 'pop', { pitch: 'A5', gain: 0.4 }],
  ...[82, 82.9, 83.8, 84.7, 85.6, 86.5].map((b, i) => [b, 'device row', 'blip', { pitch: ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'][i], gain: 0.35 }]),
  [87.5, 'whip to backstage', 'whoosh', { len: 0.45, from: 2400, to: 400 }],
  [94.4, 'orbit behind the screen', 'whoosh', { len: 1.2, from: 300, to: 1500, gain: 0.22 }],
  [95.2, 'typing', 'type', { len: 1.4, n: 14, gain: 0.5 }],
  [99.4, 'typing', 'type', { len: 1.3, n: 12, gain: 0.5 }],
  [101.5, 'fixed', 'bell', { pitch: 'C7', gain: 0.35 }],
  [104, 'no limits', 'thud', { pitch: 80, to: 40, gain: 0.5 }],
  [106.9, 'strike: sanctions', 'click'],
  [108.2, 'strike: licence', 'click'],
  [111.0, 'strike: outages', 'click'],
  [111.7, 'into the dome', 'whoosh', { len: 0.6, from: 400, to: 2000 }],
  [114.6, 'dome closes', 'crash', { len: 1.6, gain: 0.18 }],
  [119.75, 'yellow: Babak', 'impact', { gain: 0.45 }],
  [122.8, 'send', 'whoosh', { len: 0.7, from: 800, to: 4000 }],
  [132, 'end card', 'bell', { pitch: 'F6', gain: 0.3 }],
];

// ---------------------------------------------------------------- words (times from docs/script.md)
const T1a = phrase(['هنوز برای وصل شدن', 'به سیستم کارمندات'], 0.7, 6.7);
const T1b = phrase(['منتظری کد AnyDesk', 'بفرستن؟'], 6.8, 11.3, { accent: ['AnyDesk'] });
const T3a = phrase(['اینترنت بین‌الملل', 'قطع و وصل…'], 14.6, 19.3, { accent: ['قطع', 'وصل…'] });
const T3b = phrase(['کل پشتیبانی شرکتت', 'فلج می‌شه؟'], 19.6, 24.6, { accent: ['فلج'] });
const T4a = phrase(['شبکه‌ت وابسته به', 'ریموت‌های عمومی؟'], 26.2, 32.6, { accent: ['عمومی؟'] });
const T4b = phrase(['امنیت اطلاعاتت', 'دست سرورهای خارجیه'], 33.3, 39.5, { accent: ['خارجیه'] });
const T4c = phrase(['سرعتت', 'به اینترنت گره خورده'], 39.9, 44.0, { accent: ['گره', 'خورده'] });
const T5 = phrase(['اما یه راه‌حل خیلی', 'حرفه‌ای‌تر وجود داره.'], 44.9, 51.2, { accent: ['حرفه‌ای‌تر'] });
const T7 = phrase(['مدیریت و کنترل', 'از راه دور'], 56.6, 61.4);
const T8a = phrase(['بدون هیچ', 'برنامهٔ جانبی'], 72.0, 77.4);
const T8b = phrase(['فقط با یه مرورگر'], 78.5, 80.2, { accent: ['مرورگر'] });
const T8c = phrase(['هر لحظه، به تمام', 'سیستم‌های شرکت'], 80.6, 87.0, { accent: ['تمام'] });
const T9a = phrase(['بدون مزاحمت', 'برای کارِ کارمند'], 87.8, 94.1);
const T9b = phrase(['پشت صحنه:', 'فایل‌ها و ترمینال'], 94.4, 99.8, { accent: ['فایل‌ها', 'ترمینال'] });
const T9c = phrase(['مشکل، درجا حل.'], 100.1, 103.0, { accent: ['حل.'] });
const T10a = phrase(['نه محدودیت…'], 104.5, 106.0);
const T10c = phrase(['تمام اطلاعاتت'], 111.7, 114.4);
const T10d = phrase(['داخل شبکهٔ خودت', 'امن می‌مونه.'], 114.6, 118.8, { accent: ['امن'] });
const T11 = phrase(['من بابک هستم.'], 119.7, 121.9);
const T12a = phrase(['این پست رو بفرست برای', 'کسی که شبکه‌ت دستشه'], 122.6, 127.2, { accent: ['بفرست'] });
const T12b = phrase(['و این کارا رو', 'برات نمی‌کنه.'], 127.3, 131.6);

// ---------------------------------------------------------------- 2-D pieces
function ground(ctx, top = C.ink2, bot = C.ink) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function mono(ctx, str, x, y, size = 34, color = C.mute, align = 'left', track = 2) {
  line(ctx, str, x, y, size, 700, color, align, 'UI', track);
}
// a pill tag; right-aligned at x
function chip(ctx, str, x, y, k, { size = 64, bg = C.acc, fg = C.ink } = {}) {
  if (k <= 0.001) return;
  const w = width(ctx, str, size, 800) + size * 0.9, h = size * 1.45;
  ctx.save();
  ctx.translate(x - w / 2, y);
  ctx.scale(k, k);
  ctx.translate(-(x - w / 2), -y);
  rrect(ctx, x - w, y - h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  line(ctx, str, x - size * 0.45, y + size * 0.36, size, 800, fg);
  ctx.restore();
}
function check(ctx, x, y, s, k, color) {
  if (k <= 0) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.16; ctx.strokeStyle = color;
  const pts = [[-0.45, 0.02], [-0.12, 0.34], [0.5, -0.36]];
  const L1 = Math.hypot(0.33, 0.32), L2 = Math.hypot(0.62, 0.7), tot = L1 + L2;
  const d = k * tot;
  ctx.beginPath(); ctx.moveTo(x + pts[0][0] * s, y + pts[0][1] * s);
  const a = Math.min(1, d / L1);
  ctx.lineTo(x + lerp(pts[0][0], pts[1][0], a) * s, y + lerp(pts[0][1], pts[1][1], a) * s);
  if (d > L1) {
    const b = Math.min(1, (d - L1) / L2);
    ctx.lineTo(x + lerp(pts[1][0], pts[2][0], b) * s, y + lerp(pts[1][1], pts[2][1], b) * s);
  }
  ctx.stroke();
  ctx.restore();
}
function plane(ctx, x, y, s, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-1, -0.15); ctx.lineTo(1, -0.9); ctx.lineTo(0.25, 0.95); ctx.lineTo(-0.05, 0.12); ctx.closePath();
  ctx.lineJoin = 'round'; ctx.lineWidth = 0.13; ctx.strokeStyle = color; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.05, 0.12); ctx.lineTo(1, -0.9); ctx.stroke();
  ctx.restore();
}
// a leader label pointing at a projected 3-D anchor
function tag3D(ctx, set, anchor, str, k, side = 1, color = C.paper) {
  if (k <= 0.01) return;
  const [x, y, front] = set.toScreen(anchor);
  if (!front) return;
  const lx = x + side * 70 * k, ly = y - 90 * k;
  ctx.save();
  ctx.globalAlpha = clamp(k * 2);
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly); ctx.lineTo(lx + side * 40, ly); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fillStyle = color; ctx.fill();
  mono(ctx, str, lx + side * 52, ly + 14, 40, color, side > 0 ? 'left' : 'right');
  ctx.restore();
}

// ink fading down from the top: the supers' band stays readable over busy 3-D
function scrim(ctx, a = 0.72) {
  const g = ctx.createLinearGradient(0, 120, 0, 760);
  g.addColorStop(0, `rgba(10,15,28,${a})`); g.addColorStop(1, 'rgba(10,15,28,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 760);
}

// ---------------------------------------------------------------- scenes
// Each shot has a picture (ground + 3-D + graphics: drawn per sub-frame, so it carries motion blur) and,
// where it has words, an overlay (type and labels: drawn once per frame in post(), crisp).
const S = {};

function sCode(ctx, u, t) {
  ground(ctx, '#141E36', C.ink);
  // dot grid behind the code
  ctx.fillStyle = 'rgba(243,239,230,0.07)';
  for (let y = 300; y < H - 300; y += 54) for (let x = 54; x < W; x += 54) ctx.fillRect(x - 2, y - 2, 4, 4);
  ctx.save(); shake(ctx, u, 0, 18, 3, 0.18);
  G.renderSet(ctx, S.code, t, u, { exit: E.inCubic(prog(u, 11.55, 12)) });
  ctx.restore();
}
function oCode(ctx, u) {
  const dots = '.'.repeat(1 + (Math.floor(u * 2) % 3));
  const k = springU(u, 0.4, SPRING.snappy) * (1 - prog(u, 11.5, 11.9));
  ctx.save(); ctx.globalAlpha = clamp(k);
  mono(ctx, `REMOTE ID  ·  waiting${dots}`, W / 2 - 262, 640, 40, C.mute, 'left', 3);
  ctx.restore();
  supers(ctx, u, T1a, { y: 330, size: 84, weight: 800, out: 6.15, shadow: true });
  supers(ctx, u, T1b, { y: 330, size: 96, out: 11.6, shadow: true, lineH: 122 });
}

function sStamp(ctx, u) {
  fill(ctx, C.ink);
  // push through: from 13.55 the stamp zooms in log space toward its question mark
  const z = prog(u, 13.55, 14);
  const s = 34 ** E.inCubic(z);
  ctx.save();
  shake(ctx, u, 12, 22, 5, 0.2);
  const k = springU(u, 11.95, SPRING.bouncy);
  const cx = W / 2 - 262, cy = H / 2 + 20;               // the ؟ sits at the line's left end
  ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
  const st = 1 + (1 - k) * 0.35;
  ctx.translate(W / 2, H / 2); ctx.scale(st, st); ctx.translate(-W / 2, -H / 2);
  line(ctx, 'یا بدتر؟', W / 2, H / 2 + 80, 240, 900, C.paper, 'center');
  ctx.restore();
}

function sWorld(ctx, u, t, mode, extra = {}) {
  ground(ctx, '#101A30', C.ink);
  G.renderSet(ctx, S.world, t, u, { mode, ...extra });
}

const sOutage = (ctx, u, t) => sWorld(ctx, u, t, 'outage', { gate: gateOff(u) });
function oOutage(ctx, u) {
  scrim(ctx);
  const g = gateOff(u);
  // status chip, bottom left: the uplink flips with the gate
  const k = springU(u, 14.4, SPRING.snappy);
  if (k > 0) {
    const down = g || u >= 19.6;
    ctx.save(); ctx.globalAlpha = clamp(k);
    mono(ctx, 'INTERNATIONAL UPLINK', 72, 1360, 38, C.mute, 'left', 3);
    ctx.beginPath(); ctx.arc(88, 1416, 13, 0, 7);
    if (down) { ctx.lineWidth = 4; ctx.strokeStyle = C.paper; ctx.stroke(); } else { ctx.fillStyle = C.acc; ctx.fill(); }
    mono(ctx, down ? 'DOWN' : 'UP', 116, 1430, 48, down ? C.paper : C.acc, 'left', 4);
    ctx.restore();
  }
  supers(ctx, u, T3a, { y: 390, size: 92, out: 19.0, style: 'flicker', gate: (uu, i) => gateOff(uu) && i % 2 === 0, shadow: true });
  supers(ctx, u, T3b, { y: 390, size: 96, out: 24.7, shadow: true });
}

const sForeign = (ctx, u, t, dim = 0) => sWorld(ctx, u, t, 'foreign', { dim });
function oForeign(ctx, u, dim = 0) {
  scrim(ctx);
  const w = S.world;
  tag3D(ctx, w, w.anchors.tower, 'RELAY SERVER · ABROAD', springU(u, 29.6, SPRING.snappy) * (1 - dim) * (1 - prog(u, 32.0, 32.5)), 1);
  tag3D(ctx, w, w.anchors.border, 'BORDER', springU(u, 27.3, SPRING.snappy) * (1 - prog(u, 30.4, 31)) * (1 - dim), 1, C.mute);
  supers(ctx, u, T4a, { y: 390, size: 90, out: 32.6, shadow: true });
  supers(ctx, u, T4b, { y: 390, size: 90, out: 39.25, shadow: true });
  supers(ctx, u, T4c, { y: 390, size: 94, out: 43.6, shadow: true });
}

const turnDim = (u) => E.inOutCubic(prog(u, 43.6, 46));
function sTurn(ctx, u, t) {
  const dim = turnDim(u);
  if (dim < 1) sForeign(ctx, u, t, dim);
  else ground(ctx, '#0E1626', C.ink);
  ctx.save(); ctx.globalAlpha = dim * 0.75; fill(ctx, C.ink); ctx.restore();
}
function oTurn(ctx, u) {
  const dim = turnDim(u);
  if (dim < 1) oForeign(ctx, u, dim);
  supers(ctx, u, T5, { y: 900, size: 104, align: 'center', x: W / 2, lineH: 146, out: 51.75 });
  // a hairline of light grows across the frame into the drop
  const r = E.inCubic(prog(u, 46, 52));
  if (r > 0) { ctx.fillStyle = C.acc; ctx.fillRect(W / 2 - (W / 2) * r, 1150, W * r, 5); }
}

function sMark(ctx, u, t, IMG) {
  // MeshCentral's own blue, with the faint scanlines of the real UI's title banner
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.blue); g.addColorStop(1, C.blue2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
  const exit = E.inCubic(prog(u, 55.4, 56));
  ctx.save(); shake(ctx, u, 52, 26, 7, 0.16);
  // the real icon (its black ground screened away), landing above the word
  const ik = springU(u, 52.8, { stiffness: 220, damping: 15 });
  if (ik > 0 && IMG.icon) {
    const s = 520 * (0.6 + 0.4 * ik);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = clamp(ik * 1.5);
    ctx.drawImage(IMG.icon, W / 2 - s / 2, 330 + (1 - ik) * 120 - exit * 900, s, s);
    ctx.restore();
  }
  G.renderSet(ctx, S.mark, t, u, { exit });
  ctx.restore();
  // the drop's one flash
  const fl = u >= 52 ? 0.28 * Math.exp(-(u - 52) / 0.12) : 0;
  if (fl > 0.01) { ctx.fillStyle = `rgba(255,255,255,${fl})`; ctx.fillRect(0, 0, W, H); }
}
function oMark(ctx, u) {
  const exit = E.inCubic(prog(u, 55.4, 56));
  const pk = springU(u, 52.3, SPRING.snappy);
  if (pk <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(pk) * (1 - exit);
  line(ctx, 'مش‌سنترال', W / 2, 1245 + (1 - pk) * 40, 96, 800, C.acc, 'center');
  mono(ctx, 'OPEN SOURCE  ·  SELF-HOSTED', W / 2, 1335 + (1 - pk) * 40, 40, 'rgba(243,239,230,0.85)', 'center', 4);
  ctx.restore();
}

function sOwn(ctx, u, t) {
  sWorld(ctx, u, t, 'own', { u0: 56 });
  // the push into the tower's face ends in its blue
  const f = E.inCubic(prog(u, 70.6, 71.5));
  if (f > 0) { ctx.fillStyle = C.blue2; ctx.globalAlpha = f; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
function oOwn(ctx, u) {
  scrim(ctx);
  const w = S.world;
  tag3D(ctx, w, w.anchors.home, 'YOUR SERVER', springU(u, 58.2, SPRING.snappy) * (1 - prog(u, 61.4, 62)), 1, C.acc);
  supers(ctx, u, T7, { y: 390, size: 90, out: 70.6, shadow: true });
  // three chips stack on their words
  chip(ctx, 'متن‌باز', RX, 1150, springU(u, 61.9, SPRING.bouncy) * (1 - E.inCubic(prog(u, 70.8, 71.4))));
  chip(ctx, 'کاملاً خصوصی', RX, 1265, springU(u, 64.0, SPRING.bouncy) * (1 - E.inCubic(prog(u, 70.9, 71.45))));
  chip(ctx, 'روی سرور خودت', RX, 1380, springU(u, 67.0, SPRING.bouncy) * (1 - E.inCubic(prog(u, 71.0, 71.5))));
}

function appStruck(ctx, u, x, y) {
  const k = springU(u, 72.4, SPRING.bouncy) * (1 - E.inCubic(prog(u, 77.8, 78.3)));
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  rrect(ctx, -70, -70, 140, 140, 32); ctx.lineWidth = 8; ctx.strokeStyle = C.paper; ctx.stroke();
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, 26); ctx.moveTo(-26, 2); ctx.lineTo(0, 28); ctx.lineTo(26, 2); ctx.stroke();
  const s = E.outCubic(prog(u, 73.1, 73.6));
  if (s > 0) {
    ctx.strokeStyle = C.acc; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(-95, 95); ctx.lineTo(-95 + 190 * s, 95 - 190 * s); ctx.stroke();
  }
  ctx.restore();
}

function sScreens(ctx, u, t, dx = 0) {
  ctx.save(); ctx.translate(dx, 0);
  ground(ctx, '#0C2147', '#071531');
  G.renderSet(ctx, S.screens, t, u, {});
  ctx.restore();
}
function oScreens(ctx, u, dx = 0) {
  ctx.save(); ctx.translate(dx, 0);
  scrim(ctx, 0.6);
  appStruck(ctx, u, 180, 400);
  supers(ctx, u, T8a, { y: 390, size: 92, out: 77.85, shadow: true });
  supers(ctx, u, T8b, { y: 390, size: 100, out: 80.0, shadow: true });
  supers(ctx, u, T8c, { y: 390, size: 90, out: 87.2, shadow: true });
  ctx.restore();
}

function sBackstage(ctx, u, t, dx = 0) {
  ctx.save(); ctx.translate(dx, 0);
  ground(ctx, '#131C31', C.ink);
  G.renderSet(ctx, S.backstage, t, u, {});
  ctx.restore();
}
function oBackstage(ctx, u, dx = 0) {
  ctx.save(); ctx.translate(dx, 0);
  scrim(ctx, 0.6);
  supers(ctx, u, T9a, { y: 390, size: 92, out: 93.75, shadow: true });
  supers(ctx, u, T9b, { y: 390, size: 92, out: 99.5, shadow: true });
  supers(ctx, u, T9c, { y: 390, size: 108, out: 103.7, shadow: true });
  const ck = E.outCubic(prog(u, 101.4, 102.1));
  if (ck > 0) {
    const pop = springU(u, 101.4, SPRING.bouncy) * (1 - E.inCubic(prog(u, 103.4, 103.9)));
    const cx = RX - width(ctx, 'مشکل، درجا حل.', 108, 800) - 115;
    ctx.save(); ctx.translate(cx, 352); ctx.scale(pop, pop);
    ctx.beginPath(); ctx.arc(0, 0, 76, 0, 7); ctx.fillStyle = C.acc; ctx.fill();
    ctx.restore();
    check(ctx, cx, 352, 106 * pop, ck, C.ink);
  }
  ctx.restore();
}

// three things it doesn't have: each word lands, then an accent bar strikes it right to left
function sLimits(ctx, u) {
  ground(ctx, '#121B30', C.ink);
  supers(ctx, u, T10a, { y: 520, size: 84, weight: 700, out: 111.2, color: C.mute });
  const items = [['تحریم', 106.1, 106.9], ['لایسنس', 107.4, 108.2], ['قطعی', 110.2, 111.0]];
  items.forEach(([w, at, strike], i) => {
    const k = springU(u, at, SPRING.bouncy);
    if (k <= 0) return;
    const y = 800 + i * 250;
    const ex = E.inCubic(prog(u, 111.2 + i * 0.08, 111.7 + i * 0.08));
    ctx.save();
    ctx.globalAlpha = clamp(k * 2) * (1 - ex);
    const s = 1 + (1 - k) * 0.5;
    ctx.translate(W / 2, y - 60); ctx.scale(s, s); ctx.translate(-W / 2, -(y - 60));
    ctx.translate(-ex * 400, 0);
    line(ctx, w, W / 2, y, 176, 900, C.paper, 'center');
    const sw = width(ctx, w, 176, 900) + 60;
    const sk = E.outCubic(prog(u, strike, strike + 0.35));
    if (sk > 0) { ctx.fillStyle = C.acc; ctx.fillRect(W / 2 + sw / 2 - sw * sk, y - 66, sw * sk, 24); }
    ctx.restore();
  });
}

const sSecure = (ctx, u, t) => sWorld(ctx, u, t, 'secure', { u0: 56, cu0: 111.2, dome: E.inOutCubic(prog(u, 112.4, 116.8)) });
function oSecure(ctx, u) {
  scrim(ctx);
  supers(ctx, u, T10c, { y: 390, size: 94, out: 114.0, shadow: true });
  supers(ctx, u, T10d, { y: 390, size: 96, out: 118.85, shadow: true });
}

// Babak: the portrait on its own yellow, then the call to action, then the end card (2-D only)
function sBabak(ctx, u, IMG) {
  fill(ctx, C.acc);
  const rise = springU(u, 119.25, { stiffness: 150, damping: 18 });
  const push = 1 + 0.035 * E.inOutSine(prog(u, 120, 136));
  const s = 960 * push;
  const py = 170 + (1 - rise) * 420 - (s - 960) * 0.3;
  if (IMG.portrait) ctx.drawImage(IMG.portrait, W / 2 - s / 2, py, s, s);
  // the artwork is cropped at the jacket: melt that edge into the ground
  const fg = ctx.createLinearGradient(0, py + s - 190, 0, py + s + 2);
  fg.addColorStop(0, 'rgba(225,175,49,0)'); fg.addColorStop(1, 'rgba(225,175,49,1)');
  ctx.fillStyle = fg; ctx.fillRect(0, py + s - 190, W, 192);
  const lx = W / 2 - s / 2, lg = ctx.createLinearGradient(lx - 2, 0, lx + 150, 0);
  lg.addColorStop(0, 'rgba(225,175,49,1)'); lg.addColorStop(1, 'rgba(225,175,49,0)');
  ctx.fillStyle = lg; ctx.fillRect(lx - 2, py, 152, s);
  const ink = C.ink;
  supers(ctx, u, T11, { y: 1300, size: 108, color: ink, accentColor: C.blue, out: 122.0 });
  const hk = springU(u, 120.6, SPRING.snappy) * (1 - E.inCubic(prog(u, 121.9, 122.3)));
  if (hk > 0) { ctx.save(); ctx.globalAlpha = clamp(hk); mono(ctx, '@babak.ghadri', RX, 1400 + (1 - hk) * 30, 52, ink, 'right', 2); ctx.restore(); }
  supers(ctx, u, T12a, { y: 1270, size: 82, color: ink, accentColor: C.blue, out: 126.7, lineH: 106 });
  supers(ctx, u, T12b, { y: 1270, size: 82, color: ink, accentColor: C.blue, out: 131.25, lineH: 106 });
  // the paper plane leaves on "بفرست", trailing dashes up and out of frame
  const pk = prog(u, 122.6, 125.2);
  if (pk > 0 && pk < 1) {
    const p = E.inOutCubic(pk);
    const path = (q) => [lerp(380, 1230, q), lerp(1215, 1000, q) - Math.sin(q * Math.PI) * 70];   // under his chin, out right
    ctx.save(); ctx.setLineDash([18, 22]); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,15,28,0.55)';
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const [xx, yy] = path(Math.max(0, p - 0.35) + (p - Math.max(0, p - 0.35)) * (i / 30));
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke(); ctx.restore();
    const [x, y] = path(p);
    plane(ctx, x, y, 62, -0.5 + p * 0.3, ink);
  }
  // end card
  const ek = springU(u, 131.8, SPRING.gentle);
  if (ek > 0) {
    ctx.save(); ctx.globalAlpha = clamp(ek * 1.5);
    const y0 = 1285 + (1 - ek) * 50;
    line(ctx, 'بابک', RX, y0, 124, 900, ink, 'right');
    mono(ctx, '@babak.ghadri', 72, y0 - 8, 52, ink, 'left', 2);
    ctx.restore();
    const tags = ['MeshCentral', 'روی سرور خودت', 'امن و خصوصی'];
    let x = RX;
    tags.forEach((tg, i) => {
      const k = springU(u, 132.2 + i * 0.18, SPRING.bouncy);
      const sz = 38, w = width(ctx, tg, sz, 700) + sz * 1.1;
      if (k > 0) {
        ctx.save(); ctx.translate(x - w / 2, 1410); ctx.scale(k, k); ctx.translate(-(x - w / 2), -1410);
        rrect(ctx, x - w, 1410 - 33, w, 66, 33); ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.stroke();
        line(ctx, tg, x - sz * 0.55, 1410 + 13, sz, 700, ink, 'right');
        ctx.restore();
      }
      x -= w + 14;
    });
  }
}

function overlay(ctx, u) {
  if (u < 12) oCode(ctx, u);
  else if (u < 14) return;
  else if (u < 25) oOutage(ctx, u);
  else if (u < 43.6) oForeign(ctx, u);
  else if (u < 52) oTurn(ctx, u);
  else if (u < 56) oMark(ctx, u);
  else if (u < 71.5) oOwn(ctx, u);
  else if (u < 87.3) oScreens(ctx, u);
  else if (u < 88.2) {
    const p = E.inOutCubic(prog(u, 87.3, 88.2));
    oScreens(ctx, u, -p * W); oBackstage(ctx, u, (1 - p) * W);
  } else if (u < 104) oBackstage(ctx, u);
  else if (u < 111.5) return;
  else if (u < 119.75) oSecure(ctx, u);
}

// the yellow floods up from the bottom with a soft wave edge over the dome shot, carrying the portrait
function wave(ctx, u) {
  const k = E.inOutCubic(prog(u, 119.1, 119.75));
  const top = H - k * (H + 200);
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 30) ctx.lineTo(x, top + Math.sin(x / 140 + u * 3) * 40 * (1 - k));
  ctx.lineTo(W, H); ctx.closePath();
  return k;
}

// ---------------------------------------------------------------- post: grain + vignette
let GRAIN = null, VIG = null;
function makeGrain() {
  GRAIN = [0, 1, 2, 3].map((s) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d'); const im = c.createImageData(256, 256); const r = mulberry32(900 + s);
    for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (r() - 0.5) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    c.putImageData(im, 0, 0);
    return cv;
  });
}

M.film({
  fonts: [font(100, 800, 'Display'), font(100, 900, 'Display'), font(100, 700, 'Display'), font(40, 700, 'UI')],
  images: {
    portrait: 'assets/portrait.jpg', icon: 'assets/brand/mc_icon.png',
    devicesDesktop: 'assets/shots/devices_desktop.png', devicesMobile: 'assets/shots/devices_mobile.png',
  },
  hits: HITS,
  // fewer sub-frames where a 3-D set renders (software WebGL), more where the frame is 2-D only
  samples: (t) => {
    const u = M.U(t);
    if ((u >= 12 && u < 13.5) || (u >= 104 && u < 111.5) || u >= 119.8) return 8;
    if (u >= 87.3 && u < 88.2) return 3;
    return 4;
  },
  async init(ctx, IMG) {
    await G.initGL({ font: 'fonts/display-black.ttf' });
    S.code = codeSet();
    S.world = worldSet();
    S.mark = markSet();
    S.screens = screensSet(IMG);
    S.backstage = backstageSet();
    makeGrain();
  },
  draw(ctx, u, t, IMG) {
    if (u < 12) sCode(ctx, u, t);
    else if (u < 14) sStamp(ctx, u);
    else if (u < 25) sOutage(ctx, u, t);
    else if (u < 43.6) sForeign(ctx, u, t);
    else if (u < 52) sTurn(ctx, u, t);
    else if (u < 56) sMark(ctx, u, t, IMG);
    else if (u < 71.5) sOwn(ctx, u, t);
    else if (u < 87.3) sScreens(ctx, u, t);
    else if (u < 88.2) {
      // whip: both shots on screen, the browser slides out left as the backstage slides in
      const p = E.inOutCubic(prog(u, 87.3, 88.2));
      sScreens(ctx, u, t, -p * W);
      sBackstage(ctx, u, t, (1 - p) * W);
    } else if (u < 104) sBackstage(ctx, u, t);
    else if (u < 111.5) sLimits(ctx, u);
    else if (u < 119.75) {
      sSecure(ctx, u, t);
      if (u >= 119.1) { ctx.save(); wave(ctx, u); ctx.clip(); sBabak(ctx, u, IMG); ctx.restore(); }
    }
    else sBabak(ctx, u, IMG);
  },
  post(ctx, u, t) {
    overlay(ctx, u);
    if (!VIG) {
      VIG = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.75);
      VIG.addColorStop(0, 'rgba(0,0,0,0)'); VIG.addColorStop(1, 'rgba(0,0,0,0.38)');
    }
    const yellow = u >= 119.75;
    ctx.fillStyle = VIG; ctx.globalAlpha = yellow ? 0.35 : 1; ctx.fillRect(0, 0, W, H);
    const f = Math.floor(t * 60);
    const pat = ctx.createPattern(GRAIN[f % 4], 'repeat');
    ctx.save();
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = yellow ? 0.05 : 0.07;
    ctx.translate((f * 37) % 256, (f * 91) % 256);
    ctx.fillStyle = pat; ctx.fillRect(-256, -256, W + 512, H + 512);
    ctx.restore();
  },
});
