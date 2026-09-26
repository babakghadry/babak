// Soundtrack for the reel, synthesised from scratch (no samples).
// 128 BPM, F minor, 8 bars = 15.0 s. Every hit lines up with an event in reel.js.
//   node synth.mjs  ->  build/reel.wav (48 kHz, 16-bit stereo)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000, DUR = 15, N = SR * DUR;
const BPM = 128, B = 60 / BPM, BAR = 4 * B;
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ plumbing
let seed = 99;
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
const CH = {
  Fm: [53, 56, 60, 63], Db: [49, 53, 56, 60], Ab: [56, 60, 63, 67], Eb: [51, 55, 58, 63], C: [48, 52, 55, 58],
};
const ROOT_ = { Fm: 41, Db: 37, Ab: 44, Eb: 39, C: 36 };
const BASSPAT = [0, 0, 12, 0, 0, 12, 0, 7];
function bassBar(bar, chord, from = 0, to = 8, amp = 0.3) {
  for (let s = from; s < to; s++) bass(bar * BAR + (s * B) / 2, B / 2 - 0.03, ROOT_[chord] + BASSPAT[s], amp);
}
function arpBar(bar, chord, amp = 0.075, bright = 3500) {
  const n = CH[chord].map((m) => m + 12);
  const seq = [0, 1, 2, 3, -1, 3, 2, 1]; // -1: root an octave up
  for (let s = 0; s < 16; s++) {
    const idx = seq[s % 8];
    const m = idx < 0 ? n[0] + 12 : n[idx];
    pluck(bar * BAR + (s * B) / 4, m, amp * (s % 4 === 0 ? 1 : 0.7), s % 2 ? 0.45 : -0.45, 16, bright);
  }
}
function beatDrums(bar, { kicks = [0, 1, 2, 3], claps = [1, 3], hats = 'eighths', open = true } = {}) {
  const t = bar * BAR;
  kicks.forEach((k) => kick(t + k * B));
  claps.forEach((c) => clap(t + c * B));
  if (hats === 'eighths') for (let e = 0; e < 4; e++) hat(t + e * B + B / 2, 0.13, open && e === 3);
  if (hats === 'sixteenths') for (let s = 0; s < 16; s++) if (s % 4) hat(t + (s * B) / 4, s % 2 ? 0.07 : 0.12, false, s % 2 ? 0.35 : -0.2);
}

// bar 1 — the bouncing ball
pad(0.05, BAR - 0.1, [41, 53, 56, 60], 0.02, 1.4, 0.3, 700);
tock(B, 520, 0.3); kick(B, 0.45);
tock(2 * B, 620, 0.3); kick(2 * B, 0.5);
tock(3 * B, 740, 0.34); kick(3 * B, 0.6);
glide(3 * B + 0.07, 0.2, 180, 110, 0.12);         // anticipation: pulling back
riser(3 * B + 0.2, BAR, 0.35);
whoosh(BAR, 0.45, 0.25, 200, 5000);

// bar 2 — kinetic type
crash(BAR, 0.22); kick(BAR, 1);
beatDrums(1, { kicks: [0, 1, 2, 3] });
bassBar(1, 'Fm');
pad(BAR, BAR, CH.Fm, 0.035);
for (let i = 0; i < 6; i++) blip(BAR + 0.06 + i * 0.035, 900 + i * 110, 0.07, (i - 2.5) * 0.25);
for (let i = 0; i < 20; i++) tick(BAR + 0.28 + (i * 0.34) / 20, 0.03, 0.2);
whoosh(BAR + 0.84, 0.12, 0.12, 2000, 8000, 0, 0);
[0, 1, 2, 3].forEach((k) => stab(BAR + 2 * B + (k * B) / 2, CH.Fm.map((m) => m + 12), 0.05));
whoosh(BAR + 2 * B + 0.12, 0.14, 0.2, 400, 3000, -0.8, 0.2);                       // EASE
blip(BAR + 2.5 * B, 2400, 0.14, 0, 120); tick(BAR + 2.5 * B, 0.1);                   // SNAP
[0, 0.08, 0.13, 0.16].forEach((d, i) => tock(BAR + 3 * B + 0.03 + d, 330 + i * 60, 0.14 - i * 0.025)); // BOUNCE
glide(BAR + 3.5 * B, 0.3, 300, 900, 0.07, 0.3);                                      // FLOW

// bar 3 — geometry
beatDrums(2, { hats: 'sixteenths' });
bassBar(2, 'Db');
pad(2 * BAR, BAR, CH.Db, 0.03);
arpBar(2, 'Db', 0.08);
for (let k = 1; k <= 3; k++) whoosh(2 * BAR + k * B, 0.26, 0.12, 800, 7000, -0.4, 0.4, 0.05);
whoosh(3 * BAR, 0.24, 0.2, 6000, 200, 0.5, -0.5, 0.02);                             // collapse (suck in)

// bar 4 — 3D particles
kick(3 * BAR, 1); crash(3 * BAR, 0.18);
beatDrums(3, { kicks: [0, 1, 2], claps: [1], hats: 'sixteenths' });
bassBar(3, 'Ab', 0, 6);
pad(3 * BAR, BAR, CH.Ab, 0.03);
arpBar(3, 'Ab', 0.085, 5000);
riser(3 * BAR + 2 * B, 4 * BAR, 0.65);
whoosh(4 * BAR, 0.5, 0.35, 150, 9000, 0, 0, 0.05);

// bar 5 — the graph editor (half-time, airy)
kick(4 * BAR, 1); crash(4 * BAR, 0.25);
kick(4 * BAR + 2.5 * B, 0.7); clap(4 * BAR + 2 * B, 0.45);
for (let e = 0; e < 8; e++) hat(4 * BAR + (e * B) / 2 + B / 4, 0.06, false, 0.4);
bassBar(4, 'Eb', 0, 8, 0.2);
pad(4 * BAR, BAR, CH.Eb, 0.04, 0.2);
[0, 0.07, 0.14].forEach((d, i) => blip(4 * BAR + d + 0.12, 600 + i * 150, 0.1, (i - 1) * 0.5, 40));
for (let i = 0; i < 27; i++) tick(4 * BAR + 0.15 + (i * 0.45) / 27, 0.025, -0.3);
blip(4 * BAR + 0.62, 1500, 0.08, -0.3); blip(4 * BAR + 0.69, 1800, 0.08, 0.3);
{ // the playhead, sonified: pitch follows the eased value
  const s0 = at(4 * BAR + 0.8), len = 2 * B * SR;
  const ez = (x) => { const bx = (t) => 3 * (1 - t) ** 2 * t * 0.83 + 3 * (1 - t) * t * t * 0.17 + t ** 3; const by = (t) => 3 * (1 - t) * t * t + t ** 3; let lo = 0, hi = 1, t = x; for (let i = 0; i < 30; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; } return by(t); };
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len, v = ez(u);
    ph += (330 * Math.pow(2, v * 1.5)) / SR;
    out(fx, s0 + i, Math.sin(TAU * ph) * 0.05 * Math.sin(Math.PI * Math.min(1, u * 1.1)), lerp(-0.6, 0.6, v), 0.4);
  }
  for (let k = 0; k <= 12; k++) tick(4 * BAR + 0.8 + (k / 12) * 2 * B, 0.04, lerp(-0.6, 0.6, ez(k / 12)));
}
whoosh(5 * BAR + 0.02, 0.3, 0.4, 250, 7000, -0.9, 0.9, 0.18);                         // whip pan

// bar 6 — fluid
beatDrums(5, { hats: 'eighths' });
bassBar(5, 'Fm');
pad(5 * BAR, BAR, CH.Fm, 0.035, 0.1, 0.4, 900);
arpBar(5, 'Fm', 0.08, 1800);
for (let k = 0; k < 4; k++) glide(5 * BAR + k * B + 0.01, 0.16, 520 - k * 40, 180, 0.09, (k % 2 ? 0.4 : -0.4));   // drips
whoosh(6 * BAR, 0.5, 0.25, 4000, 150, 0.6, -0.6, 0.02);

// bar 7 — the edit: cuts on eighths, then the strobe
kick(6 * BAR, 1); crash(6 * BAR, 0.2);
beatDrums(6, { kicks: [0, 1, 2], claps: [1], hats: 'sixteenths', open: false });
bassBar(6, 'Db', 0, 6);
const cutChords = ['Db', 'Db', 'Db', 'Db', 'Eb', 'Eb'];
for (let k = 0; k < 6; k++) { glitch(6 * BAR + (k * B) / 2, 0.07); stab(6 * BAR + (k * B) / 2, CH[cutChords[k]].map((m) => m + 12), 0.045); }
for (let s = 0; s < 4; s++) { clap(6 * BAR + 3 * B + (s * B) / 4, 0.25 + s * 0.1); glitch(6 * BAR + 3 * B + (s * B) / 4, 0.05, 0.1); }
for (let s = 0; s < 4; s++) bass(6 * BAR + 3 * B + (s * B) / 4, B / 4 - 0.02, ROOT_.C + (s % 2) * 12, 0.3);
pad(6 * BAR + 3 * B, B, CH.C, 0.04, 0.05, 0.1);
riser(6 * BAR + 2 * B, 7 * BAR, 0.6);

// bar 8 — identity: the drop
kick(7 * BAR, 1.2, true); subDrop(7 * BAR, 0.55); crash(7 * BAR, 0.35, 1.3);
pad(7 * BAR, BAR, [41, 53, 56, 60, 63, 67], 0.035, 0.02, 0.6, 2200);
[65, 68, 72, 75].forEach((m, k) => pluck(7 * BAR + 0.2 + k * 0.05, m + 12, 0.1, (k - 1.5) * 0.4, 5, 4500));  // mark lands
for (let i = 0; i < 6; i++) tick(7 * BAR + 0.36 + i * 0.045, 0.035, 0.3);
blip(7 * BAR + 2 * B + 0.05, 1200, 0.06, 0.4); blip(7 * BAR + 2.5 * B + 0.05, 1500, 0.06, 0.4);
for (let s = 0; s < 8; s++) hat(7 * BAR + B / 2 + (s * B) / 2, 0.035, false, 0.5);

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
fs.writeFileSync(path.join(ROOT, 'build', 'reel.wav'), pcm);
console.log(`build/reel.wav  peak ${peak.toFixed(2)} -> normalised`);
