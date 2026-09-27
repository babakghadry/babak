// Soundtrack for the AryoDesk film, synthesised from scratch (no samples).
// 128 BPM, D minor, 8 bars = 15.0 s. Every hit lines up with an event in reel.js.
//   node synth.mjs  ->  build/aryodesk.wav (48 kHz, 16-bit stereo)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000, DUR = 15, N = SR * DUR;
const BPM = 128, B = 60 / BPM, BAR = 4 * B;
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ plumbing
let seed = 1405;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const drums = bus(), music = bus(), fx = bus(), send = bus();
function put(b, i, v, pan = 0) {
  if (i < 0 || i >= N) return;
  const a = ((pan + 1) * Math.PI) / 4;
  b.L[i] += v * Math.cos(a); b.R[i] += v * Math.sin(a);
}
// write to a bus with an optional reverb send
function out(b, i, v, pan, wet = 0) { put(b, i, v, pan); if (wet) put(send, i, v * wet, pan); }

class Biquad {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  set(type, f, q = 0.707) {
    f = Math.min(f, SR * 0.45);
    const w = (TAU * f) / SR, cs = Math.cos(w), sn = Math.sin(w), a = sn / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
    else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * cs) / a0; this.a2 = (1 - a) / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
const at = (t) => Math.round(t * SR);
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));

// -------------------------------------------------------------------- voices
const KICKS = [];
function kick(t0, amp = 1, long = false) {
  KICKS.push(t0);
  const len = long ? 1.6 : 0.42, s0 = at(t0);
  let ph = 0;
  for (let i = 0; i < len * SR; i++) {
    const t = i / SR;
    const f = 44 + (long ? 170 : 140) * Math.exp(-t * (long ? 16 : 30));
    ph += f / SR;
    const env = Math.exp(-t * (long ? 2.6 : 7.5)) * Math.min(1, t * 3000);
    let v = Math.tanh(Math.sin(TAU * ph) * env * 1.6) * 0.95;
    if (t < 0.004) v += noise() * 0.35 * (1 - t / 0.004);
    out(drums, s0 + i, v * amp, 0, long ? 0.15 : 0);
  }
}
function clap(t0, amp = 0.5) {
  const s0 = at(t0), bp = new Biquad().set('bp', 1500, 0.9), len = 0.35 * SR;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let env = 0;
    for (const o of [0, 0.011, 0.022]) if (t >= o) env += Math.exp(-(t - o) * (o < 0.02 ? 320 : 16));
    const body = Math.sin(TAU * 190 * t) * Math.exp(-t * 30) * 0.4;
    out(drums, s0 + i, (bp.run(noise()) * 2.2 * env + body) * amp, 0.05, 0.35);
  }
}
function hat(t0, amp = 0.12, open = false, pan = 0.25) {
  const s0 = at(t0), hp = new Biquad().set('hp', 7500, 0.8), len = (open ? 0.3 : 0.06) * SR;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    out(drums, s0 + i, hp.run(noise()) * Math.exp(-t * (open ? 12 : 75)) * amp, pan, 0.05);
  }
}
function bass(t0, dur, m, amp = 0.3) {
  const s0 = at(t0), lp = new Biquad(), f = mtof(m), len = (dur + 0.02) * SR;
  let ph = rnd(), ph2 = rnd();
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += f / SR; ph2 += (f * 0.5) / SR;
    if (i % 16 === 0) lp.set('lp', 160 + 1500 * Math.exp(-t * 16), 1.4);
    const env = Math.min(1, t * 400) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.02) : 1);
    const v = lp.run(saw(ph)) * 0.8 + Math.sin(TAU * ph2) * 0.55;
    out(music, s0 + i, v * env * amp, 0);
  }
}
function pad(t0, dur, notes, amp = 0.05, atk = 0.12, rel = 0.5, cutoff = 1300) {
  const s0 = at(t0), len = (dur + rel) * SR;
  notes.forEach((m) => {
    [-0.09, 0, 0.09].forEach((det, k) => {
      const f = mtof(m + det), lp = new Biquad().set('lp', cutoff, 0.6);
      let ph = rnd();
      const pan = (k - 1) * 0.7;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        ph += f / SR;
        const env = Math.min(1, t / atk) * (t > dur ? Math.exp(-(t - dur) / (rel / 4)) : 1);
        out(music, s0 + i, lp.run(saw(ph)) * env * amp, pan, 0.4);
      }
    });
  });
}
function pluck(t0, m, amp = 0.09, pan = 0, decay = 16, bright = 3500) {
  const s0 = at(t0), lp = new Biquad(), f = mtof(m), len = 0.35 * SR;
  let ph = rnd();
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += f / SR;
    if (i % 16 === 0) lp.set('lp', 300 + bright * Math.exp(-t * 28), 2);
    const sq = (ph % 1) < 0.35 ? 1 : -1;
    out(music, s0 + i, lp.run(sq * 0.6 + saw(ph) * 0.4) * Math.exp(-t * decay) * amp, pan, 0.3);
  }
}
function stab(t0, notes, amp = 0.07) { notes.forEach((m, k) => pluck(t0, m, amp, (k - 1.5) * 0.4, 9, 5000)); }
function blip(t0, f, amp = 0.12, pan = 0, dec = 70) {
  const s0 = at(t0), len = 0.08 * SR;
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += (f * (1 + 0.6 * Math.exp(-t * 90))) / SR;
    out(fx, s0 + i, Math.sin(TAU * ph) * Math.exp(-t * dec) * amp, pan, 0.25);
  }
}
function tick(t0, amp = 0.05, pan = 0) {
  const s0 = at(t0), hp = new Biquad().set('bp', 4200, 3);
  for (let i = 0; i < 0.012 * SR; i++) out(fx, s0 + i, hp.run(noise()) * Math.exp(-(i / SR) * 500) * amp * 3, pan);
}
// noise sweep that peaks at tc (dur before it), e.g. transitions
function whoosh(tc, dur, amp = 0.25, f0 = 300, f1 = 6000, pan0 = -0.7, pan1 = 0.7, tail = 0.12) {
  const s0 = at(tc - dur), len = (dur + tail) * SR, bp = new Biquad();
  for (let i = 0; i < len; i++) {
    const t = i / SR, u = Math.min(1, t / dur);
    if (i % 16 === 0) bp.set('bp', f0 * Math.pow(f1 / f0, u), 1.2);
    const env = t < dur ? Math.pow(u, 2.5) : Math.exp(-((t - dur) / tail) * 5);
    out(fx, s0 + i, bp.run(noise()) * env * amp * 2, lerp(pan0, pan1, u), 0.3);
  }
}
function riser(t0, t1, amp = 0.2) {
  const s0 = at(t0), len = (t1 - t0) * SR, hp = new Biquad();
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    if (i % 16 === 0) hp.set('hp', 400 * Math.pow(20, u), 1.1);
    ph += (220 * Math.pow(6, u)) / SR;
    const v = hp.run(noise()) * 0.8 + saw(ph) * 0.12 * u;
    out(fx, s0 + i, v * u * u * amp, Math.sin(u * 20) * 0.3 * u, 0.3);
  }
}
function crash(t0, amp = 0.3, dec = 2.4) {
  const s0 = at(t0), hp = new Biquad().set('hp', 3500, 0.7), len = 2.5 * SR;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const v = hp.run(noise()) * Math.exp(-t * dec);
    put(fx, s0 + i, v * amp * (0.8 + 0.2 * Math.sin(t * 13)), -0.3);
    put(fx, s0 + i, hp.run(noise()) * Math.exp(-t * dec) * amp * 0.8, 0.3);
    put(send, s0 + i, v * amp * 0.3, 0);
  }
}
function subDrop(t0, amp = 0.5, len = 1.6) {
  const s0 = at(t0);
  let ph = 0;
  for (let i = 0; i < len * SR; i++) {
    const t = i / SR;
    ph += (30 + 45 * Math.exp(-t * 2.2)) / SR;
    out(fx, s0 + i, Math.sin(TAU * ph) * Math.exp(-t * 1.8) * Math.min(1, t * 200) * amp, 0);
  }
}
function tock(t0, f, amp = 0.25) {
  blip(t0, f, amp, 0, 26);
  const s0 = at(t0), bp = new Biquad().set('bp', f * 2, 2);
  for (let i = 0; i < 0.03 * SR; i++) out(fx, s0 + i, bp.run(noise()) * Math.exp(-(i / SR) * 200) * amp, 0, 0.3);
}
function glitch(t0, dur, amp = 0.18) {
  const s0 = at(t0), len = dur * SR, hold = Math.floor(SR / (800 + rnd() * 3000));
  let v = 0;
  const f = 200 + rnd() * 1800;
  for (let i = 0; i < len; i++) {
    if (i % hold === 0) v = Math.round(noise() * 3) / 3;
    const sq = Math.sin(TAU * f * (i / SR)) > 0 ? 0.5 : -0.5;
    const env = 1 - i / len;
    out(fx, s0 + i, (v * 0.7 + sq * 0.3) * env * amp, (rnd() - 0.5) * 0.2);
  }
}
function glide(t0, dur, f0, f1, amp = 0.08, pan = 0) {
  const s0 = at(t0);
  let ph = 0;
  for (let i = 0; i < dur * SR; i++) {
    const u = i / (dur * SR);
    ph += (f0 * Math.pow(f1 / f0, u)) / SR;
    out(fx, s0 + i, Math.sin(TAU * ph) * Math.sin(Math.PI * u) * amp, pan, 0.4);
  }
}
function lerp(a, b, t) { return a + (b - a) * t; }

// ----------------------------------------------------------------- the score
// times mirror the constants in reel.js
const CH = {
  Dm: [50, 53, 57, 60], Bb: [46, 50, 53, 57], F: [48, 53, 57, 60], C: [48, 52, 55, 60], Dm9: [50, 53, 57, 60, 64, 69],
};
const ROOT_ = { Dm: 38, Bb: 34, F: 41, C: 36 };
const BASSPAT = [0, 0, 12, 0, 0, 12, 0, 7];
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const PENTA = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84]; // D minor pentatonic, for UI pops
function bassBar(bar, chord, from = 0, to = 8, amp = 0.3) {
  for (let s = from; s < to; s++) bass(bar * BAR + (s * B) / 2, B / 2 - 0.03, ROOT_[chord] + BASSPAT[s], amp);
}
function arpBar(bar, chord, amp = 0.07, bright = 3500, from = 0, to = 16) {
  const n = CH[chord].map((m) => m + 12);
  const seq = [0, 1, 2, 3, -1, 3, 2, 1];
  for (let s = from; s < to; s++) {
    const idx = seq[s % 8];
    const m = idx < 0 ? n[0] + 12 : n[idx];
    pluck(bar * BAR + (s * B) / 4, m, amp * (s % 4 === 0 ? 1 : 0.7), s % 2 ? 0.45 : -0.45, 16, bright);
  }
}
function beatDrums(bar, { kicks = [0, 1, 2, 3], claps = [1, 3], hats = 'eighths', open = true } = {}) {
  const t = bar * BAR;
  kicks.forEach((k) => kick(t + k * B));
  claps.forEach((c) => clap(t + c * B, 0.42));
  if (hats === 'eighths') for (let e = 0; e < 4; e++) hat(t + e * B + B / 2, 0.12, open && e === 3);
  if (hats === 'sixteenths') for (let s = 0; s < 16; s++) if (s % 4) hat(t + (s * B) / 4, s % 2 ? 0.06 : 0.11, false, s % 2 ? 0.35 : -0.2);
}
const pop = (t, k, amp = 0.1, pan = 0) => { blip(t, mtof(PENTA[k % PENTA.length]), amp, pan, 45); tick(t, 0.03, pan); };
const click = (t, amp = 0.12) => { tick(t, amp * 0.9, -0.2); blip(t, 2600, amp * 0.5, -0.2, 160); };
const chime = (t0, notes, gap = 0.05, amp = 0.09) => notes.forEach((m, k) => pluck(t0 + k * gap, m, amp, (k - notes.length / 2) * 0.3, 7, 5200));

// bar 1 — the tray (sparse, anticipation)
pad(0.05, BAR - 0.05, [38, 50, 53, 57], 0.022, 1.2, 0.3, 800);
whoosh(0.34, 0.34, 0.12, 250, 3200, 0, 0, 0.1);                               // taskbar slides up
for (let i = 0; i < 5; i++) tick(0.12 + i * 0.04, 0.035, (i - 2) * 0.3);        // taskbar icons
for (let k = 0; k < 4; k++) tick(k * B, 0.05, 0.5);                             // clock ticks
kick(B, 0.35); pluck(B, 81, 0.11, -0.4, 10, 4200); blip(B + 0.18, 1760, 0.07, -0.5); // tray icon + pip
glide(0.64, 0.62, 260, 420, 0.03, 0.4);                                          // pointer travels
click(3 * B - 0.045, 0.16);
chime(3 * B, [62, 65, 69, 74], 0.035, 0.08);                                     // panel opens
whoosh(3 * B + 0.12, 0.18, 0.12, 600, 5000, -0.6, 0.2, 0.08);
riser(1.0, BAR, 0.3);

// bar 2 — ticket
kick(BAR, 1); crash(BAR, 0.2);
beatDrums(1, { kicks: [0, 1, 2, 3] });
bassBar(1, 'Dm');
pad(BAR, BAR, CH.Dm, 0.03);
for (let i = 0; i < 18; i++) tick(BAR + 0.1 + (i * 0.56) / 18 + (hash(i) - 0.5) * 0.008, 0.045 + 0.02 * hash(i + 9), -0.35);   // typing
click(BAR + 1.5 * B); tock(BAR + 1.5 * B + 0.01, 700, 0.12);                      // priority: فوری
click(BAR + 2 * B, 0.18);
stab(BAR + 2 * B, CH.Dm.map((m) => m + 12), 0.05);
chime(BAR + 2 * B + 0.08, [74, 77, 81, 86], 0.05, 0.1);                           // ticket registered
whoosh(BAR + 3 * B + 0.4, 0.4, 0.2, 400, 8000, -0.3, 0.9, 0.1);                   // the comet leaves

// bar 3 — chat
kick(2 * BAR, 0.9);
beatDrums(2, { hats: 'sixteenths' });
bassBar(2, 'Bb');
pad(2 * BAR, BAR, CH.Bb, 0.028);
arpBar(2, 'Bb', 0.05, 2500);
pop(2 * BAR + 0.06, 3, 0.07, 0);                                                   // pill
pop(2 * BAR + 0.5 * B, 4, 0.11, -0.4);                                             // tech bubble
for (let k = 0; k < 3; k++) tick(2 * BAR + B + 0.04 + k * 0.07, 0.03, -0.4);      // typing dots
pop(2 * BAR + 1.5 * B, 5, 0.11, -0.4);                                             // tech bubble 2
pop(2 * BAR + 2 * B, 7, 0.12, 0.4);                                                // user: بله، حتماً
tock(2 * BAR + 2.5 * B, 520, 0.14);                                                // consent card
click(2 * BAR + 3 * B, 0.18); chime(2 * BAR + 3 * B + 0.05, [69, 74, 78], 0.04, 0.08);
whoosh(3 * BAR, 0.34, 0.3, 7000, 180, 0.4, -0.2, 0.02);                            // zoom out through the panel

// bar 4 — the network
kick(3 * BAR, 1); crash(3 * BAR, 0.2); subDrop(3 * BAR, 0.25, 0.8);
beatDrums(3, { hats: 'sixteenths' });
bassBar(3, 'F');
pad(3 * BAR, BAR, CH.F, 0.03);
arpBar(3, 'F', 0.07, 4500);
for (let i = 0; i < 22; i++) blip(3 * BAR + 0.03 + i * 0.022, mtof(PENTA[(i * 3) % 10] + 12), 0.035, Math.sin(i * 1.7) * 0.8, 90);   // nodes ripple in
glide(3 * BAR + 2 * B - 0.42, 0.42, 180, 520, 0.05, -0.7);                           // inbound attempt
glitch(3 * BAR + 2 * B, 0.12, 0.2); tock(3 * BAR + 2 * B, 220, 0.3); clap(3 * BAR + 2 * B, 0.3);  // blocked
glide(3 * BAR + 1.3, 0.5, 400, 1600, 0.05, 0.2);                                   // signed update wave
chime(3 * BAR + 1.33, [81, 86], 0.06, 0.07);
riser(3 * BAR + 1.0, 4 * BAR, 0.45);
whoosh(4 * BAR, 0.45, 0.3, 200, 9000, 0, 0, 0.05);                                 // zoom into PC-ACC-07

// bar 5 — console
kick(4 * BAR, 1); crash(4 * BAR, 0.22);
beatDrums(4, { hats: 'eighths' });
bassBar(4, 'C');
pad(4 * BAR, BAR, CH.C, 0.03);
arpBar(4, 'C', 0.05, 3000, 0, 12);
click(4 * BAR + 0.34, 0.14);                                                        // remote click
[1, 2].forEach((k) => { tick(4 * BAR + k * B, 0.08, 0.3); whoosh(4 * BAR + k * B + 0.1, 0.12, 0.1, 1200, 6000, -0.6, 0.6, 0.04); });  // tab switches
for (let i = 0; i < 10; i++) tick(4 * BAR + B + 0.06 + i * 0.016, 0.03, 0.4);      // terminal typing
for (let i = 0; i < 8; i++) tick(4 * BAR + B + 0.33 + i * 0.016, 0.03, 0.4);
blip(4 * BAR + B + 0.28, 1320, 0.06, 0.3); blip(4 * BAR + B + 0.48, 1480, 0.06, 0.3);     // results
glide(4 * BAR + 2 * B + 0.08, 3 * B - 2 * B - 0.1, 330, 990, 0.05, -0.2);               // transfer progress
kick(4 * BAR + 3 * B, 0.8); clap(4 * BAR + 3 * B, 0.5);
stab(4 * BAR + 3 * B, CH.C.map((m) => m + 12), 0.06); chime(4 * BAR + 3 * B + 0.06, [72, 76, 79, 84], 0.045, 0.1);  // resolved
whoosh(5 * BAR + 0.02, 0.3, 0.4, 250, 7000, 0.9, -0.9, 0.18);                          // whip pan (RTL: travels right)

// bar 6 — tenants
beatDrums(5, { hats: 'eighths' });
bassBar(5, 'Dm');
pad(5 * BAR, BAR, CH.Dm, 0.032, 0.1, 0.4, 1000);
arpBar(5, 'Dm', 0.06, 2000);
for (let i = 0; i < 3; i++) glide(5 * BAR + B + i * 0.04, 0.35, 500, 1000, 0.025, 0.3 - i * 0.3);   // allowed outlines draw
for (let i = 0; i < 3; i++) pop(5 * BAR + B + 0.1 + i * 0.08, 5 + i, 0.07, 0.3 - i * 0.3);
[0, 1, 2].forEach((k) => { const t = 5 * BAR + 2 * B + k * B / 4; tock(t, 170, 0.28); glitch(t, 0.03, 0.08); });  // locks
chime(5 * BAR + 3 * B, [74, 78, 81], 0.04, 0.08);                                    // SLA answered
whoosh(6 * BAR, 0.3, 0.2, 5000, 300, 0.5, -0.5, 0.02);

// bar 7 — the audit log: stabs on the eighths, then the stamp
kick(6 * BAR, 1); crash(6 * BAR, 0.2);
beatDrums(6, { kicks: [0, 1, 2], claps: [1], hats: 'sixteenths', open: false });
bassBar(6, 'Bb', 0, 4); bassBar(6, 'C', 4, 6);
for (let k = 0; k < 6; k++) { const t = 6 * BAR + (k * B) / 2; glitch(t, 0.05, 0.1); stab(t, CH[k < 4 ? 'Bb' : 'C'].map((m) => m + 12), 0.045); }
glide(6 * BAR + 3 * B - 0.5, 0.38, 900, 600, 0.03, 0.4);                             // tamper attempt
blip(6 * BAR + 3 * B - 0.12, 300, 0.12, 0.3, 30);
kick(6 * BAR + 3 * B, 1.1); clap(6 * BAR + 3 * B, 0.7); crash(6 * BAR + 3 * B, 0.28, 3); subDrop(6 * BAR + 3 * B, 0.3, 0.6);  // غیرقابل‌تغییر
pad(6 * BAR + 3 * B, B, CH.C, 0.035, 0.03, 0.1, 1800);
riser(6 * BAR + 1.0, 7 * BAR, 0.55);
whoosh(7 * BAR, 0.28, 0.35, 6000, 150, 0, 0, 0.01);                                 // suck in before the drop

// bar 8 — identity: the drop
kick(7 * BAR, 1.2, true); subDrop(7 * BAR, 0.55); crash(7 * BAR, 0.35, 1.3);
pad(7 * BAR, BAR, [38, 50, 53, 57, 60, 64, 69], 0.034, 0.02, 0.6, 2400);
glide(7 * BAR + 0.14, 0.33, 700, 1400, 0.04, 0.5);                                  // cursor flies into the mark
click(7 * BAR + B, 0.2); chime(7 * BAR + B + 0.02, [74, 77, 81, 86, 89], 0.045, 0.1); // lands
glide(7 * BAR + 0.72, 0.46, 1800, 600, 0.035, 0.6);                                  // wordmark wipes right -> left
for (let i = 0; i < 6; i++) pop(7 * BAR + 1.12 + i * 0.045, 4 + i, 0.05, 0.6 - i * 0.24);   // feature pills
whoosh(7 * BAR + 1.6, 0.3, 0.06, 3000, 9000, 0.6, -0.6, 0.2);                       // light sweep
for (let s = 0; s < 6; s++) hat(7 * BAR + B + (s * B) / 2, 0.03, false, 0.5);

// ---------------------------------------------------------------- mixdown
// sidechain: music ducks under every kick
const duck = new Float32Array(N).fill(1);
for (const k of KICKS) {
  const s0 = at(k);
  for (let i = 0; i < 0.35 * SR && s0 + i < N; i++) duck[s0 + i] = Math.min(duck[s0 + i], 1 - 0.65 * Math.exp(-(i / SR) / 0.07));
}
// Schroeder reverb on the send bus
function reverb(inp, offs) {
  const outp = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({ d: d + offs, buf: new Float32Array(d + offs), i: 0, lp: 0 }));
  const aps = [556, 441, 341].map((d) => ({ d: d + offs, buf: new Float32Array(d + offs), i: 0 }));
  for (let n = 0; n < N; n++) {
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.lp = y * 0.7 + c.lp * 0.3;
      c.buf[c.i] = inp[n] + c.lp * 0.84;
      c.i = (c.i + 1) % c.d;
      s += y;
    }
    s /= combs.length;
    for (const a of aps) {
      const bo = a.buf[a.i], y = -s + bo;
      a.buf[a.i] = s + bo * 0.5;
      a.i = (a.i + 1) % a.d;
      s = y;
    }
    outp[n] = s;
  }
  return outp;
}
const vL = reverb(send.L, 0), vR = reverb(send.R, 23);
const L = new Float32Array(N), R = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = drums.L[i] + music.L[i] * duck[i] + fx.L[i] + vL[i] * 0.9;
  R[i] = drums.R[i] + music.R[i] * duck[i] + fx.R[i] + vR[i] * 0.9;
  L[i] = Math.tanh(L[i] * 0.9); R[i] = Math.tanh(R[i] * 0.9);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const g = 0.93 / peak;
const fadeIn = at(0.005), fadeOut = at(0.5);
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8);
pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  let f = 1;
  if (i < fadeIn) f = i / fadeIn;
  if (i > N - fadeOut) f = (N - i) / fadeOut;
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g * f)) * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g * f)) * 32767), 46 + i * 4);
}
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'build', 'aryodesk.wav'), pcm);
console.log(`build/aryodesk.wav  peak ${peak.toFixed(2)} -> normalised`);
