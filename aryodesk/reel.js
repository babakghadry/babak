/*
 * آریودسک — a 15 second product film, written entirely in code.
 *
 * One ticket's journey: the tray icon next to the Windows clock, the ticket,
 * the live chat, the outbound-only Go agent, remote desktop / terminal / file
 * transfer, multi-tenant access with SLA, the immutable audit log, and the
 * identity. Persian, right-to-left, Jalali dates.
 *
 * Every frame is a pure function of time: render(t) -> pixels. No state is
 * carried between frames, so the renderer can split the film across several
 * browsers and draw each frame several times inside the shutter for real
 * motion blur.
 *
 * 128 BPM, 8 bars of 4/4 = 15.0 s. Every cut and every pop lands on the grid.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- constants
  const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
  const FPS = 60, DUR = 15;
  const BPM = 128, B = 60 / BPM, BAR = 4 * B; // beat .46875 s, bar 1.875 s

  const HEX = {
    night: '#060913', night2: '#0B1120', panel: '#101A2E', panel2: '#16223A', line: '#24324F',
    paper: '#EEF3FB', mute: '#8894B0', signal: '#35F2C4', azure: '#4F7BFF', amber: '#FFB547', rose: '#FF5C7A',
  };
  const RGB = {};
  for (const k in HEX) RGB[k] = [1, 3, 5].map((i) => parseInt(HEX[k].slice(i, i + 2), 16));
  const C = HEX;
  const rgba = (k, a) => `rgba(${RGB[k][0]},${RGB[k][1]},${RGB[k][2]},${a})`;

  const FAM = { fa: 'Vazirmatn', mono: '"JetBrains Mono"' };
  const ZW = '\u200c'; // zero-width non-joiner (نیم‌فاصله)

  // Persian digits
  const FA_DIG = '۰۱۲۳۴۵۶۷۸۹';
  const fa = (s) => String(s).replace(/[0-9]/g, (d) => FA_DIG[+d]);
  const pad2 = (n) => String(n).padStart(2, '0');

  // ------------------------------------------------------------------ helpers
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };

  const E = {
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    // damped spring, t in seconds -> 0..1 with overshoot
    spring: (t, freq = 1.8, damp = 8) => (t <= 0 ? 0 : 1 - Math.exp(-damp * t) * Math.cos(TAU * freq * t)),
  };
  const spr = (t, t0, freq = 2.2, damp = 9) => E.spring(t - t0, freq, damp);
  // a click: quick press, slower release
  const press = (t, t0) => (t < t0 - 0.05 || t > t0 + 0.16 ? 0 : t < t0 ? (t - t0 + 0.05) / 0.05 : 1 - (t - t0) / 0.16);
  // impulse envelopes: sum of a * exp(-(t - t0) * k) after each hit
  const impulse = (t, list, k = 11) => {
    let v = 0;
    for (const [t0, a, kk] of list) if (t >= t0) v += a * Math.exp(-(t - t0) * (kk || k));
    return v;
  };
  const qbez = (a, c, b, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;

  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function box(ctx, x, y, w, h, r, fill, stroke, lw = 2) {
    rr(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  // text: Persian by default (rtl, right aligned)
  function T(ctx, s, x, y, size, o = {}) {
    const w = o.w || 500, fam = o.mono ? FAM.mono : FAM.fa;
    ctx.font = `${w} ${size}px ${fam}`;
    ctx.fillStyle = o.color || C.paper;
    ctx.textAlign = o.align || (o.mono ? 'left' : 'right');
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.direction = o.mono || o.ltr ? 'ltr' : 'rtl';
    if (o.alpha !== undefined && o.alpha < 1) {
      if (o.alpha <= 0) return;
      ctx.save(); ctx.globalAlpha *= o.alpha; ctx.fillText(s, x, y); ctx.restore();
    } else ctx.fillText(s, x, y);
  }
  function measure(ctx, s, size, w = 500, mono = false) {
    ctx.font = `${w} ${size}px ${mono ? FAM.mono : FAM.fa}`;
    ctx.direction = mono ? 'ltr' : 'rtl';
    return ctx.measureText(s).width;
  }

  // ---------------------------------------------------------------- glyphs
  // the AryoDesk mark: a screen that is also a speech bubble, with a cursor in it
  function markPath(ctx, u) {
    const r = 0.22 * u, L = -0.5 * u, R = 0.5 * u, Tp = -0.4 * u, Bt = 0.3 * u;
    ctx.beginPath();
    ctx.moveTo(L + r, Tp);
    ctx.lineTo(R - r, Tp); ctx.arcTo(R, Tp, R, Tp + r, r);
    ctx.lineTo(R, Bt - r); ctx.arcTo(R, Bt, R - r, Bt, r);
    ctx.lineTo(-0.02 * u, Bt);
    ctx.lineTo(-0.31 * u, 0.53 * u);
    ctx.lineTo(-0.25 * u, Bt);
    ctx.lineTo(L + r, Bt); ctx.arcTo(L, Bt, L, Bt - r, r);
    ctx.lineTo(L, Tp + r); ctx.arcTo(L, Tp, L + r, Tp, r);
    ctx.closePath();
  }
  const ARROW = [[0, 0], [0, 1], [0.27, 0.76], [0.45, 1.13], [0.61, 1.05], [0.43, 0.69], [0.76, 0.69]];
  function arrowPath(ctx, x, y, s) {
    ctx.beginPath();
    ARROW.forEach(([a, b], i) => (i ? ctx.lineTo(x + a * s, y + b * s) : ctx.moveTo(x + a * s, y + b * s)));
    ctx.closePath();
  }
  function markGrad(ctx, u) {
    const g = ctx.createLinearGradient(0.5 * u, -0.45 * u, -0.5 * u, 0.5 * u);
    g.addColorStop(0, C.signal); g.addColorStop(1, C.azure);
    return g;
  }
  // o: { draw: stroke draw-on 0..1, fill: 0..1, cur: cursor 0..1 (flies in), curPress, glow }
  function mark(ctx, x, y, u, o = {}) {
    const draw = o.draw ?? 1, fill = o.fill ?? 1, cur = o.cur ?? 1;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    const g = markGrad(ctx, u);
    if (o.glow) { ctx.shadowColor = rgba('signal', 0.55 * o.glow); ctx.shadowBlur = 60 * o.glow * (u / 200); }
    if (fill > 0) {
      markPath(ctx, u);
      ctx.globalAlpha = fill;
      ctx.fillStyle = g; ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;
    if (draw < 1 || fill < 1) {
      const len = 3.7 * u;
      markPath(ctx, u);
      ctx.setLineDash([len * draw, len]);
      ctx.lineWidth = Math.max(1.5, 0.045 * u);
      ctx.strokeStyle = g; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (cur > 0) {
      const s = 0.4 * u * (1 - 0.12 * (o.curPress || 0));
      const e = E.outCubic(cur);
      const cx = -0.16 * u + (1 - e) * 0.9 * u, cy = -0.22 * u + (1 - e) * 0.7 * u - Math.sin(Math.PI * e) * 0.25 * u;
      ctx.globalAlpha = clamp(cur * 3);
      arrowPath(ctx, cx, cy, s);
      ctx.fillStyle = o.curColor || C.night; ctx.fill();
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // mouse pointer
  function pointer(ctx, x, y, o = {}) {
    const s = (o.s || 30) * (1 - 0.14 * (o.press || 0));
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    arrowPath(ctx, x, y, s);
    ctx.fillStyle = o.color || C.paper; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2; ctx.strokeStyle = C.night; ctx.lineJoin = 'round'; ctx.stroke();
    if (o.label) {
      const lw = measure(ctx, o.label, 17, 700) + 22;
      box(ctx, x + s * 0.55, y + s * 1.05, lw, 30, 15, o.color || C.paper);
      T(ctx, o.label, x + s * 0.55 + lw - 11, y + s * 1.05 + 21, 17, { w: 700, color: C.night });
    }
    ctx.restore();
  }
  function clickRing(ctx, x, y, t, t0, col = C.paper, r1 = 46) {
    const p = prog(t, t0, t0 + 0.45);
    if (p <= 0 || p >= 1) return;
    ctx.save();
    ctx.strokeStyle = col; ctx.globalAlpha = 1 - p; ctx.lineWidth = 3 * (1 - p) + 0.5;
    ctx.beginPath(); ctx.arc(x, y, 8 + r1 * E.outCubic(p), 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function check(ctx, x, y, s, p, col = C.signal, lw = 4) {
    if (p <= 0) return;
    const pts = [[-0.42, 0.02], [-0.12, 0.3], [0.44, -0.32]];
    const l1 = Math.hypot(0.3, 0.28), l2 = Math.hypot(0.56, 0.62), L = (l1 + l2) * p;
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x + pts[0][0] * s, y + pts[0][1] * s);
    if (L <= l1) { const u = L / l1; ctx.lineTo(x + lerp(pts[0][0], pts[1][0], u) * s, y + lerp(pts[0][1], pts[1][1], u) * s); }
    else {
      ctx.lineTo(x + pts[1][0] * s, y + pts[1][1] * s);
      const u = (L - l1) / l2;
      ctx.lineTo(x + lerp(pts[1][0], pts[2][0], u) * s, y + lerp(pts[1][1], pts[2][1], u) * s);
    }
    ctx.stroke();
    ctx.restore();
  }
  function cross(ctx, x, y, s, col, lw = 4) {
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
    ctx.stroke();
    ctx.restore();
  }
  function lock(ctx, x, y, s, col, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw || s * 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -0.1 * s, 0.3 * s, Math.PI, 0); ctx.lineTo(0.3 * s, 0.05 * s); ctx.moveTo(-0.3 * s, -0.1 * s); ctx.lineTo(-0.3 * s, 0.05 * s); ctx.stroke();
    rr(ctx, -0.46 * s, 0.02 * s, 0.92 * s, 0.66 * s, 0.12 * s); ctx.fill();
    ctx.fillStyle = C.night;
    ctx.beginPath(); ctx.arc(0, 0.3 * s, 0.08 * s, 0, TAU); ctx.fill();
    ctx.fillRect(-0.03 * s, 0.3 * s, 0.06 * s, 0.18 * s);
    ctx.restore();
  }
  function avatar(ctx, x, y, r, letter, col = C.azure) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    T(ctx, letter, x, y + r * 0.38, r * 1.05, { w: 700, color: C.night, align: 'center' });
  }
  function dot(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

  // ------------------------------------------------------------ typography
  // Persian headline, word-by-word mask reveal. Words are laid out right to
  // left; each word rises out of its own clipped line box.
  function headline(ctx, lt, o) {
    const { lines, xr, y, tIn, tOut = 99, weight = 900, color = C.paper, maxW = 820 } = o;
    let size = o.size;
    const widest = Math.max(...lines.map((l) => measure(ctx, l, size, weight)));
    if (widest > maxW) size *= maxW / widest;
    const lh = size * (o.lh || 1.28);
    ctx.font = `${weight} ${size}px ${FAM.fa}`;
    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    const sp = ctx.measureText(' ').width;
    let k = 0;
    lines.forEach((line, li) => {
      let x = xr;
      const by = y + li * lh;
      line.split(' ').forEach((wd) => {
        const ww = ctx.measureText(wd).width;
        const a = tIn + k * 0.05, pin = E.outQuint(prog(lt, a, a + 0.55));
        const b = tOut + k * 0.022, pout = E.inCubic(prog(lt, b, b + 0.26));
        if (pin > 0 && pout < 1) {
          ctx.save();
          ctx.beginPath(); ctx.rect(x - ww - size * 0.3, by - size * 1.2, ww + size * 0.6, size * 1.75); ctx.clip();
          const dy = (1 - pin) * size * 1.3 - pout * size * 1.3;
          ctx.fillStyle = (o.accent && o.accent[wd]) || color;
          ctx.translate(x, by + dy);
          ctx.rotate((1 - pin) * 0.06);
          ctx.fillText(wd, 0, 0);
          ctx.restore();
        }
        x -= ww + sp; k++;
      });
    });
    return { size, lh, bottom: y + (lines.length - 1) * lh };
  }
  // small label above headlines: "۰۴ ——— ایجنت سبک Go"
  function kicker(ctx, lt, { xr, y, num, label, tIn, tOut = 99 }) {
    const p = E.outQuint(prog(lt, tIn, tIn + 0.5)), q = E.inCubic(prog(lt, tOut, tOut + 0.25));
    const a = p * (1 - q);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    T(ctx, fa(num), xr - (1 - p) * -20, y, 26, { w: 700, color: C.signal });
    const nw = measure(ctx, fa(num), 26, 700);
    const lx = xr - nw - 16;
    ctx.fillStyle = C.signal;
    ctx.fillRect(lx - 56 * p, y - 10, 56 * p, 2);
    T(ctx, label, lx - 56 - 16 - (1 - p) * 30, y, 26, { w: 500, color: rgba('paper', 0.75) });
    ctx.restore();
  }

  // ------------------------------------------------------------- background
  let dots = null;
  function dotLayer() {
    if (dots) return dots;
    dots = document.createElement('canvas'); dots.width = W + 88; dots.height = H + 88;
    const x = dots.getContext('2d');
    x.fillStyle = 'rgba(238,243,251,0.075)';
    for (let yy = 0; yy < dots.height; yy += 44) for (let xx = 0; xx < dots.width; xx += 44) { x.beginPath(); x.arc(xx, yy, 1.4, 0, TAU); x.fill(); }
    return dots;
  }
  function glow(ctx, x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  function backdrop(ctx, t, g1, g2) {
    ctx.fillStyle = C.night; ctx.fillRect(-400, -400, W + 800, H + 800);
    if (g1) glow(ctx, g1[0] + Math.sin(t * 0.7) * 60, g1[1] + Math.cos(t * 0.5) * 40, g1[2], g1[3], g1[4]);
    if (g2) glow(ctx, g2[0] + Math.cos(t * 0.6) * 70, g2[1] + Math.sin(t * 0.8) * 50, g2[2], g2[3], g2[4]);
    const o = (t * 14) % 44;
    ctx.drawImage(dotLayer(), -44 + o, -44 + (o * 0.5) % 44);
  }

  // ===================================================================== ACT A
  // 0 – 5.625  The user's side: tray icon -> ticket -> chat.
  const A = {
    ICON: B, CLICK1: 3 * B - 0.045, OPEN: 3 * B,
    TYPE0: BAR + 0.1, TYPE1: BAR + 0.66, CHIP: BAR + 1.5 * B, SUBMIT: BAR + 2 * B, SENT: BAR + 3 * B,
    CHAT: 2 * BAR, M1: 2 * BAR + 0.5 * B, TYPING: 2 * BAR + B, M2: 2 * BAR + 1.5 * B, M3: 2 * BAR + 2 * B,
    ASK: 2 * BAR + 2.5 * B, OK: 2 * BAR + 3 * B, EXIT: 3 * BAR - 0.33,
  };
  const ICON = { x: 210, y: 1008, w: 44, h: 44 };
  const P1 = { x: 48, y: 352, w: 600, h: 610 };
  const P2 = { x: 48, y: 232, w: 600, h: 730 };
  const TICKET = 'پرینتر وصل نمی' + ZW + 'شود';

  function taskbar(ctx, t, o = {}) {
    const up = E.outExpo(prog(t, 0.02, 0.5)) * (1 - E.inCubic(prog(t, A.EXIT - 0.1, A.EXIT + 0.2)));
    const y = 980 + (1 - up) * 120;
    ctx.save();
    ctx.translate(0, y - 980);
    ctx.fillStyle = 'rgba(11,17,32,0.94)'; ctx.fillRect(-400, 980, W + 800, 140);
    ctx.fillStyle = rgba('paper', 0.08); ctx.fillRect(-400, 980, W + 800, 1.5);
    // centred app icons (RTL: start button is the rightmost)
    const cols = ['azure', 'amber', 'signal', 'rose', 'azure'];
    for (let i = 0; i < 5; i++) {
      const s = E.outBack(prog(t, 0.12 + (4 - i) * 0.04, 0.42 + (4 - i) * 0.04), 2.2);
      if (s <= 0) continue;
      const x = CX + (i - 2) * 76, yy = 1030;
      ctx.save(); ctx.translate(x, yy); ctx.scale(s, s);
      if (i === 4) {
        ctx.fillStyle = C.azure;
        for (let a = 0; a < 4; a++) ctx.fillRect(-19 + (a % 2) * 20, -19 + Math.floor(a / 2) * 20, 18, 18);
      } else {
        box(ctx, -24, -24, 48, 48, 12, C.panel2);
        box(ctx, -12, -12, 24, 24, i === 1 ? 12 : 6, C[cols[i]]);
      }
      ctx.restore();
    }
    // tray (RTL Windows mirrors it to the left): clock + date, then icons
    const ct = E.outCubic(prog(t, 0.2, 0.5));
    ctx.globalAlpha = ct;
    const minute = t < 1.1 ? 41 : 42;
    T(ctx, fa(`۹:${minute}`), 104, 1024, 22, { w: 500, align: 'center' });
    T(ctx, fa('1405/07/05'), 104, 1052, 17, { w: 400, color: C.mute, align: 'center' });
    // wifi + volume
    ctx.strokeStyle = rgba('paper', 0.8); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(290, 1042, 6 + k * 7, -Math.PI * 0.75, -Math.PI * 0.25); ctx.stroke(); }
    dot(ctx, 290, 1041, 3, rgba('paper', 0.8));
    ctx.fillStyle = rgba('paper', 0.8);
    ctx.beginPath(); ctx.moveTo(322, 1024); ctx.lineTo(330, 1024); ctx.lineTo(340, 1016); ctx.lineTo(340, 1044); ctx.lineTo(330, 1036); ctx.lineTo(322, 1036); ctx.fill();
    ctx.beginPath(); ctx.arc(342, 1030, 9, -0.9, 0.9); ctx.stroke();
    ctx.globalAlpha = 1;
    // AryoDesk tray icon
    const ip = spr(t, A.ICON, 2.4, 8);
    if (ip > 0 && !o.hideIcon) {
      const hover = prog(t, 1.0, 1.25) * (1 - prog(t, 1.5, 1.7));
      if (hover > 0) box(ctx, ICON.x - 4, ICON.y - 4, ICON.w + 8, ICON.h + 8, 12, rgba('paper', 0.08 * hover));
      mark(ctx, ICON.x + 22, ICON.y + 23, 36 * ip * (1 - 0.1 * press(t, A.CLICK1)), {});
      // notification pip
      const np = spr(t, A.ICON + 0.18, 3, 10);
      if (np > 0) { dot(ctx, ICON.x + 40, ICON.y + 6, 7 * np, C.rose); }
    }
    ctx.restore();
    return y;
  }

  function cursorA(t) {
    // piecewise quadratic arcs between targets, [t0, t1, from, ctrl, to]
    const segs = [
      [0.62, 1.30, [1260, 640], [520, 560], [226, 1026]],
      [1.55, 2.50, [226, 1026], [300, 720], [446, 834]],
      [2.64, 2.78, [446, 834], [420, 860], [352, 904]],
      [2.98, 3.60, [352, 904], [520, 820], [600, 700]],
      [4.72, 5.10, [600, 700], [600, 760], [520, 750]],
    ];
    let x = segs[0][2][0], y = segs[0][2][1];
    for (const [t0, t1, a, c, b] of segs) {
      if (t < t0) break;
      const u = E.inOutCubic(prog(t, t0, t1));
      x = qbez(a[0], c[0], b[0], u); y = qbez(a[1], c[1], b[1], u);
    }
    const alpha = prog(t, 0.62, 0.8) * (1 - prog(t, A.EXIT, A.EXIT + 0.1));
    const pr = Math.max(press(t, A.CLICK1), press(t, A.CHIP), press(t, A.SUBMIT), press(t, A.OK));
    return { x, y, alpha, press: pr };
  }

  function panelRect(t) {
    const m = t < A.OPEN ? 0 : E.spring(t - A.OPEN, 1.5, 7.5);
    const g = t < A.CHAT ? 0 : E.spring(t - A.CHAT, 1.4, 8);
    const tgt = { x: lerp(P1.x, P2.x, g), y: lerp(P1.y, P2.y, g), w: lerp(P1.w, P2.w, g), h: lerp(P1.h, P2.h, g) };
    // grow from the tray icon, anchored bottom-left
    const w = lerp(ICON.w, tgt.w, m), h = lerp(ICON.h, tgt.h, m);
    const x = lerp(ICON.x, tgt.x, clamp(m, 0, 1.05));
    const bottom = lerp(ICON.y + ICON.h, tgt.y + tgt.h, clamp(m, 0, 1.02));
    return { x, y: bottom - h, w, h, r: lerp(12, 30, clamp(m)), m };
  }

  function chip(ctx, x, y, w, label, on, col) {
    box(ctx, x, y, w, 48, 24, on > 0 ? rgba(col, on) : null, on > 0.5 ? null : rgba('paper', 0.18), 2);
    T(ctx, label, x + w / 2, y + 32, 21, { w: 700, align: 'center', color: on > 0.5 ? C.night : rgba('paper', 0.8) });
  }
  function skeleton(ctx, x1, y, widths, a) {
    ctx.fillStyle = rgba('paper', 0.09 * a);
    widths.forEach((w, i) => { rr(ctx, x1 - w, y + i * 26, w, 12, 6); ctx.fill(); });
  }

  function bubble(ctx, t, t0, text, side, y, w0, col) {
    const p = spr(t, t0, 2.6, 10);
    if (p <= 0) return;
    const bw = measure(ctx, text, 24, 500) + 44, bh = 58;
    const x = side === 'me' ? w0 - 28 - bw : 28;
    const ax = side === 'me' ? x + bw : x, ay = y + bh;
    ctx.save();
    ctx.translate(ax, ay); ctx.scale(lerp(0.4, 1, p), lerp(0.4, 1, p)); ctx.translate(-ax, -ay);
    ctx.globalAlpha *= clamp(p * 2);
    const fill = side === 'me' ? C.signal : C.panel2;
    box(ctx, x, y, bw, bh, 22, fill);
    // tail
    ctx.fillStyle = fill;
    ctx.beginPath();
    if (side === 'me') { ctx.moveTo(x + bw - 16, y + bh - 2); ctx.lineTo(x + bw + 8, y + bh + 6); ctx.lineTo(x + bw - 4, y + bh - 20); }
    else { ctx.moveTo(x + 16, y + bh - 2); ctx.lineTo(x - 8, y + bh + 6); ctx.lineTo(x + 4, y + bh - 20); }
    ctx.fill();
    T(ctx, text, x + bw - 22, y + 38, 24, { w: 500, color: side === 'me' ? C.night : C.paper });
    ctx.restore();
  }

  function panelContent(ctx, t, P) {
    const w = P.w, h = P.h;
    const formIn = (k) => E.outCubic(prog(t, 1.62 + k * 0.045, 1.95 + k * 0.045));
    const formOut = E.inCubic(prog(t, A.SUBMIT + 0.03, A.SUBMIT + 0.15));
    const succ = E.outCubic(prog(t, A.SUBMIT + 0.1, A.SUBMIT + 0.35)) * (1 - prog(t, A.CHAT - 0.05, A.CHAT + 0.08));
    const chat = prog(t, A.CHAT + 0.02, A.CHAT + 0.2);

    // header
    const hIn = formIn(0);
    ctx.globalAlpha = hIn * (1 - chat);
    mark(ctx, w - 46, 42, 34, {});
    T(ctx, 'آریودسک', w - 76, 50, 26, { w: 700 });
    dot(ctx, 40, 40, 6, C.signal);
    T(ctx, 'آنلاین', 54, 48, 20, { w: 500, color: C.signal, align: 'left' });
    ctx.globalAlpha = chat;
    avatar(ctx, w - 50, 42, 22, 'ر', C.azure);
    dot(ctx, w - 34, 58, 6, C.signal);
    T(ctx, 'رضا · کارشناس پشتیبانی', w - 86, 40, 23, { w: 700 });
    T(ctx, t > A.TYPING && t < A.M2 ? 'در حال نوشتن…' : 'آنلاین · تیکت #' + fa(1042), w - 86, 66, 17, { w: 500, color: C.signal });
    ctx.globalAlpha = hIn;
    ctx.fillStyle = rgba('paper', 0.08); ctx.fillRect(0, 82, w, 1.5);
    ctx.globalAlpha = 1;

    // ---- form
    if (formOut < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - formOut;
      ctx.translate(0, -formOut * 30);
      const f = formIn;
      const fy = (k) => (1 - f(k)) * 24;
      ctx.globalAlpha = (1 - formOut) * f(1);
      T(ctx, 'درخواست پشتیبانی جدید', w - 32, 140 + fy(1), 32, { w: 800 });
      ctx.globalAlpha = (1 - formOut) * f(2);
      T(ctx, 'موضوع', w - 32, 186 + fy(2), 19, { color: C.mute });
      const typing = t > A.TYPE0 - 0.05 && t < A.CHIP;
      box(ctx, 32, 200 + fy(2), w - 64, 62, 14, rgba('paper', 0.04), typing ? C.signal : rgba('paper', 0.16), 2);
      const n = Math.floor(TICKET.length * prog(t, A.TYPE0, A.TYPE1) + 1e-6);
      const typed = TICKET.slice(0, n);
      T(ctx, typed, w - 52, 241 + fy(2), 25, { w: 500 });
      if (typing && Math.floor(t * 4) % 2 === 0 || (t > A.TYPE0 - 0.05 && t < A.TYPE1)) {
        const cw = measure(ctx, typed, 25, 500);
        ctx.fillStyle = C.signal; ctx.fillRect(w - 56 - cw, 214 + fy(2), 2.5, 34);
      }
      ctx.globalAlpha = (1 - formOut) * f(3);
      T(ctx, 'توضیحات', w - 32, 298 + fy(3), 19, { color: C.mute });
      box(ctx, 32, 312 + fy(3), w - 64, 92, 14, rgba('paper', 0.04), rgba('paper', 0.12), 2);
      skeleton(ctx, w - 52, 334 + fy(3), [380, 250], 1);
      ctx.globalAlpha = (1 - formOut) * f(4);
      T(ctx, 'اولویت', w - 32, 440 + fy(4), 19, { color: C.mute });
      const sel = E.outBack(prog(t, A.CHIP, A.CHIP + 0.2), 3);
      chip(ctx, w - 32 - 110, 452 + fy(4), 110, 'عادی', 0, 'paper');
      ctx.save();
      const cx0 = w - 32 - 232 + 55, cy0 = 476 + fy(4), cs = 1 + 0.08 * Math.sin(Math.PI * clamp(sel)) - 0.06 * press(t, A.CHIP);
      ctx.translate(cx0, cy0); ctx.scale(cs, cs); ctx.translate(-cx0, -cy0);
      chip(ctx, w - 32 - 232, 452 + fy(4), 110, 'فوری', clamp(sel), 'amber');
      ctx.restore();
      chip(ctx, w - 32 - 354, 452 + fy(4), 110, 'بحرانی', 0, 'paper');
      ctx.globalAlpha = (1 - formOut) * f(5);
      const bp = press(t, A.SUBMIT);
      ctx.save();
      ctx.translate(w / 2, 546); ctx.scale(1 - 0.05 * bp, 1 - 0.08 * bp); ctx.translate(-w / 2, -546);
      box(ctx, 32, 516 + fy(5), w - 64, 60, 16, C.signal);
      T(ctx, 'ارسال درخواست', w / 2, 555 + fy(5), 24, { w: 800, color: C.night, align: 'center' });
      ctx.restore();
      ctx.restore();
    }

    // ---- success
    if (succ > 0) {
      ctx.save();
      ctx.globalAlpha = succ;
      const cp = spr(t, A.SUBMIT + 0.08, 2, 9);
      ctx.save(); ctx.translate(w / 2, 190); ctx.scale(cp, cp);
      dot(ctx, 0, 0, 62, rgba('signal', 0.14));
      ctx.strokeStyle = C.signal; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 58, -Math.PI / 2, -Math.PI / 2 + TAU * E.outCubic(prog(t, A.SUBMIT + 0.1, A.SUBMIT + 0.45))); ctx.stroke();
      ctx.restore();
      check(ctx, w / 2, 192, 58, E.outCubic(prog(t, A.SUBMIT + 0.25, A.SUBMIT + 0.5)), C.signal, 7);
      const ty = (1 - E.outCubic(prog(t, A.SUBMIT + 0.15, A.SUBMIT + 0.45))) * 20;
      T(ctx, 'درخواست شما ثبت شد', w / 2, 305 + ty, 34, { w: 800, align: 'center' });
      // the ticket card
      const kp = spr(t, A.SUBMIT + 0.22, 2, 9);
      ctx.save();
      ctx.translate(w / 2, 400); ctx.scale(lerp(0.85, 1, kp), lerp(0.85, 1, kp)); ctx.translate(-w / 2, -400);
      ctx.globalAlpha *= clamp(kp * 2);
      box(ctx, 44, 338, w - 88, 124, 22, C.night2, rgba('paper', 0.1));
      const sent = prog(t, A.SENT, A.SENT + 0.4);
      if (sent > 0 && sent < 1) box(ctx, 44 - 10 * sent, 338 - 10 * sent, w - 88 + 20 * sent, 124 + 20 * sent, 26, null, rgba('signal', 1 - sent), 3);
      T(ctx, 'تیکت #' + fa(1042), w - 72, 388, 30, { w: 800 });
      T(ctx, TICKET, w - 72, 428, 21, { color: C.mute });
      box(ctx, 72, 368, 92, 40, 20, C.amber);
      T(ctx, 'فوری', 118, 396, 20, { w: 800, color: C.night, align: 'center' });
      ctx.restore();
      // SLA line
      const sp = E.outCubic(prog(t, A.SUBMIT + 0.35, A.SUBMIT + 0.6));
      ctx.globalAlpha = succ * sp;
      T(ctx, 'SLA پاسخ‌گویی: ۱۵ دقیقه'.replace('پاسخ‌گویی', 'پاسخ' + ZW + 'گویی'), w - 48, 512, 21, { w: 500, color: C.paper });
      box(ctx, 48, 530, w - 96, 8, 4, rgba('paper', 0.1));
      box(ctx, w - 48 - (w - 96) * 0.08 * sp, 530, (w - 96) * 0.08 * sp, 8, 4, C.signal);
      ctx.restore();
    }

    // ---- chat
    if (chat > 0) {
      ctx.save();
      ctx.globalAlpha = chat;
      const pill = (y, txt, t0, col = 'paper') => {
        const p = spr(t, t0, 2.4, 10);
        if (p <= 0) return;
        const pw = measure(ctx, txt, 18, 700) + 36;
        ctx.save(); ctx.globalAlpha *= clamp(p * 2);
        ctx.translate(w / 2, y + 17); ctx.scale(p, p);
        box(ctx, -pw / 2, -17, pw, 34, 17, rgba(col, 0.12));
        T(ctx, txt, pw / 2 - 18, 7, 18, { w: 700, color: C[col] });
        ctx.restore();
      };
      pill(106, 'تیکت #' + fa(1042) + ' · فوری · ' + fa('۹:۴۲'), A.CHAT + 0.06, 'amber');
      bubble(ctx, t, A.M1, 'سلام! درخواست‌تان رسید.'.replace('درخواست‌تان', 'درخواست' + ZW + 'تان'), 'them', 160, w);
      // typing indicator
      if (t > A.TYPING && t < A.M2 + 0.02) {
        const tp = spr(t, A.TYPING, 3, 12);
        ctx.save();
        ctx.translate(28, 240); ctx.scale(tp, tp);
        box(ctx, 0, 0, 96, 50, 25, C.panel2);
        for (let k = 0; k < 3; k++) dot(ctx, 28 + k * 20, 25 - 5 * Math.max(0, Math.sin(t * 16 - k * 0.9)), 6, rgba('paper', 0.7));
        ctx.restore();
      }
      bubble(ctx, t, A.M2, 'اجازه می' + ZW + 'دهید از راه دور وصل شوم؟', 'them', 240, w);
      bubble(ctx, t, A.M3, 'بله، حتماً.', 'me', 320, w);
      // consent card
      const cp = spr(t, A.ASK, 2.2, 9);
      if (cp > 0) {
        const ok = prog(t, A.OK + 0.02, A.OK + 0.14);
        ctx.save();
        ctx.translate(w / 2, 470); ctx.scale(lerp(0.7, 1, cp), lerp(0.7, 1, cp)); ctx.translate(-w / 2, -470);
        ctx.globalAlpha *= clamp(cp * 2);
        box(ctx, 44, 404, w - 88, 144, 24, ok > 0.5 ? rgba('signal', 0.14) : C.night2, ok > 0.5 ? C.signal : rgba('paper', 0.14), 2);
        if (ok < 0.5) {
          lock(ctx, w - 88, 440, 30, C.signal);
          T(ctx, 'درخواست دسترسی از راه دور', w - 118, 450, 23, { w: 800 });
          const bpr = press(t, A.OK);
          box(ctx, w - 72 - 170, 478, 170, 50, 16, C.signal);
          ctx.save();
          T(ctx, 'تأیید', w - 72 - 85, 512, 21, { w: 800, color: C.night, align: 'center' });
          ctx.restore();
          if (bpr > 0) box(ctx, w - 72 - 170, 478, 170, 50, 16, rgba('night', 0.25 * bpr));
          box(ctx, w - 72 - 350, 478, 160, 50, 16, null, rgba('paper', 0.2), 2);
          T(ctx, 'رد', w - 72 - 270, 512, 21, { w: 700, color: rgba('paper', 0.7), align: 'center' });
        } else {
          check(ctx, w - 96, 468, 40, E.outCubic(prog(t, A.OK + 0.05, A.OK + 0.25)), C.signal, 5);
          T(ctx, 'اتصال امن برقرار شد', w - 136, 466, 27, { w: 800, color: C.signal });
          T(ctx, 'رمزنگاری سرتاسری · جلسه ضبط می' + ZW + 'شود', w - 136, 504, 19, { w: 500, color: rgba('paper', 0.65) });
        }
        ctx.restore();
      }
      // composer
      box(ctx, 24, h - 82, w - 48, 58, 29, rgba('paper', 0.05), rgba('paper', 0.1));
      T(ctx, 'پیام خود را بنویسید…', w - 52, h - 44, 20, { color: rgba('paper', 0.35) });
      dot(ctx, 56, h - 53, 20, C.signal);
      ctx.fillStyle = C.night;
      ctx.beginPath(); ctx.moveTo(48, h - 53); ctx.lineTo(64, h - 62); ctx.lineTo(64, h - 44); ctx.fill();
      ctx.restore();
    }
  }

  function actA(ctx, t) {
    backdrop(ctx, t, [1500, 300, 900, 'azure', 0.14], [300, 700, 800, 'signal', 0.07]);
    // exit: everything but the panel falls away, the panel zooms out into a node
    const ex = E.inExpo(prog(t, A.EXIT, 3 * BAR));
    const push = E.inOutSine(prog(t, 0, 3 * BAR));
    ctx.save();
    // camera: slow push towards the panel
    const z = lerp(1, 1.05, push);
    ctx.translate(348, 597); ctx.scale(z, z); ctx.translate(-348, -597);

    taskbar(ctx, t);

    // the panel
    const P = panelRect(t);
    if (t >= A.OPEN) {
      ctx.save();
      const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
      const s = lerp(1, 0.22, ex);
      ctx.translate(pcx, pcy); ctx.scale(s, s); ctx.translate(-pcx, -pcy);
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20;
      box(ctx, P.x, P.y, P.w, P.h, P.r, C.panel);
      ctx.shadowColor = 'transparent';
      box(ctx, P.x, P.y, P.w, P.h, P.r, null, lerp(0, 1, ex) > 0.1 ? C.signal : rgba('paper', 0.1), 2 + 6 * ex);
      if (P.m > 0.35) {
        rr(ctx, P.x, P.y, P.w, P.h, P.r); ctx.clip();
        ctx.translate(P.x, P.y);
        ctx.globalAlpha = prog(P.m, 0.35, 0.7);
        panelContent(ctx, t, P);
      }
      ctx.restore();
    }
    // the "sent" comet: the ticket leaves for the technician
    const cm = prog(t, A.SENT + 0.02, A.SENT + 0.42);
    if (cm > 0 && cm < 1) {
      const e = E.inOutCubic(cm);
      for (let k = 0; k < 14; k++) {
        const u = clamp(e - k * 0.018);
        const x = qbez(560, 820, 980, u), y = qbez(750, 200, -160, u);
        dot(ctx, x, y, 9 * (1 - k / 14), rgba('signal', (1 - k / 14) * 0.9));
      }
    }
    // pointer
    const cu = cursorA(t);
    if (cu.alpha > 0) {
      pointer(ctx, cu.x, cu.y, { alpha: cu.alpha, press: cu.press });
      [A.CLICK1, A.CHIP, A.SUBMIT, A.OK].forEach((c) => clickRing(ctx, cu.x, cu.y, t, c));
    }
    ctx.restore();

    // headlines (screen space, right side)
    const xr = W - 150;
    kicker(ctx, t, { xr, y: 330, num: '01', label: 'برنامه' + ZW + 'ی کنار ساعت ویندوز', tIn: 0.15, tOut: BAR - 0.18 });
    headline(ctx, t, { lines: ['پشتیبانی،', 'یک کلیک فاصله دارد.'], xr, y: 460, size: 104, tIn: 0.25, tOut: BAR - 0.2, accent: { 'پشتیبانی،': C.signal } });
    kicker(ctx, t, { xr, y: 330, num: '02', label: 'ثبت تیکت', tIn: BAR + 0.05, tOut: 2 * BAR - 0.18 });
    headline(ctx, t, { lines: ['مشکل را بنویسید؛', 'بقیه با ما.'], xr, y: 460, size: 104, tIn: BAR + 0.08, tOut: 2 * BAR - 0.2, accent: { 'ما.': C.signal, 'با': C.signal } });
    kicker(ctx, t, { xr, y: 330, num: '03', label: 'چت زنده', tIn: 2 * BAR + 0.05, tOut: A.EXIT - 0.1 });
    headline(ctx, t, { lines: ['با کارشناس', 'همان' + ZW + 'جا گفت' + ZW + 'وگو کنید.'], xr, y: 460, size: 104, tIn: 2 * BAR + 0.08, tOut: A.EXIT - 0.12, accent: { 'کارشناس': C.signal } });
  }

  // ===================================================================== ACT B
  // 5.625 – 9.375  The agent network, then the technician's console.
  const B1 = 3 * BAR, B2 = 4 * BAR;
  const HUB = { x: 700, y: 560 };
  const OS = ['ویندوز ۷', 'ویندوز ۸٫۱', 'ویندوز ۱۰', 'ویندوز ۱۱'];
  function netNodes(lt) {
    const out = [];
    const rings = [{ n: 8, r: 262, ry: 0.78, rot: 0.1 * lt, off: 0 }, { n: 14, r: 460, ry: 0.72, rot: -0.055 * lt, off: 0.22 }];
    rings.forEach((rg, ri) => {
      for (let i = 0; i < rg.n; i++) {
        const a = Math.PI + rg.off + (i / rg.n) * TAU + rg.rot;
        out.push({ id: out.length, ri, x: HUB.x + Math.cos(a) * rg.r, y: HUB.y + Math.sin(a) * rg.r * rg.ry, os: OS[Math.floor(hash(out.length * 3.1) * 4)] });
      }
    });
    return out;
  }
  const NODES0 = netNodes(0);
  const N0 = NODES0[0];
  // the attack target: the outer node closest to the lower-left
  const ATK = NODES0.filter((n) => n.ri === 1).reduce((a, b) => (b.y - b.x > a.y - a.x ? b : a)).id;

  // a Windows desktop as seen through the remote session (base size 772 x 596)
  function miniDesktop(ctx, lt, fixed = 0) {
    const w = 772, h = 596;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#1B2C5C'); g.addColorStop(1, '#0B1430');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    glow(ctx, w * 0.75, h * 0.2, 380, 'signal', 0.1);
    ctx.fillStyle = 'rgba(8,12,24,0.9)'; ctx.fillRect(0, h - 46, w, 46);
    T(ctx, fa('۹:۴۲'), 40, h - 17, 16, { align: 'center' });
    mark(ctx, 84, h - 23, 22, {});
    for (let i = 0; i < 4; i++) box(ctx, w / 2 - 70 + i * 40, h - 37, 28, 28, 7, i === 3 ? C.azure : rgba('paper', 0.14));
    // print queue window
    const x = 150, y = 120, ww = 470, wh = 250;
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30;
    box(ctx, x, y, ww, wh, 14, '#F1F4FA');
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#DDE3EE'; rr(ctx, x, y, ww, 44, 14); ctx.fill(); ctx.fillRect(x, y + 30, ww, 14);
    T(ctx, 'صف چاپ — HP LaserJet', x + ww - 20, y + 29, 17, { w: 700, color: '#1A2340' });
    cross(ctx, x + 24, y + 22, 6, '#1A2340', 2);
    T(ctx, 'گزارش_ماهانه.pdf', x + ww - 20, y + 88, 18, { w: 500, color: '#1A2340' });
    const ok = fixed;
    box(ctx, x + 24, y + 66, 130, 32, 16, ok > 0.5 ? '#1BC99A' : C.rose);
    T(ctx, ok > 0.5 ? 'در حال چاپ' : 'خطا', x + 89, y + 88, 16, { w: 800, color: '#fff', align: 'center' });
    T(ctx, 'فاکتور_مهر.xlsx', x + ww - 20, y + 138, 18, { w: 500, color: '#1A2340' });
    T(ctx, 'در صف', x + 89, y + 138, 16, { w: 500, color: '#6B7690', align: 'center' });
    ctx.fillStyle = '#E3E8F1'; ctx.fillRect(x + 20, y + 162, ww - 40, 1.5);
    box(ctx, x + ww - 200, y + 186, 180, 44, 12, '#2B5BFF');
    T(ctx, 'راه' + ZW + 'اندازی مجدد', x + ww - 110, y + 215, 17, { w: 800, color: '#fff', align: 'center' });
    if (ok > 0 && ok < 1) {
      ctx.strokeStyle = rgba('signal', 1 - ok); ctx.lineWidth = 4;
      rr(ctx, x - 12 * ok, y - 12 * ok, ww + 24 * ok, wh + 24 * ok, 18); ctx.stroke();
    }
  }

  function node(ctx, n, lt, sc, hl, flash) {
    ctx.save();
    ctx.translate(n.x, n.y); ctx.scale(sc, sc);
    const w = 88, h = 70; // inner screen 82 x 64 ~ the remote view aspect
    if (flash > 0.01) { ctx.shadowColor = rgba('signal', flash); ctx.shadowBlur = 30 * flash; }
    box(ctx, -w / 2, -h / 2 - 8, w, h, 9, C.panel2, hl ? C.signal : lerp(0, 1, flash) > 0.3 ? C.signal : rgba('paper', 0.22), hl ? 3 : 2);
    ctx.shadowColor = 'transparent';
    if (hl) {
      ctx.save(); rr(ctx, -w / 2 + 3, -h / 2 - 5, w - 6, h - 6, 7); ctx.clip();
      ctx.translate(-w / 2 + 3, -h / 2 - 5); ctx.scale((w - 6) / 772, (h - 6) / 596);
      miniDesktop(ctx, lt, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = rgba('paper', 0.07); ctx.fillRect(-w / 2 + 8, -h / 2, w - 16, h - 22);
      ctx.fillStyle = rgba('paper', 0.14); ctx.fillRect(-w / 2 + 8, h / 2 - 20, w - 16, 3);
    }
    ctx.fillStyle = rgba('paper', 0.3); ctx.fillRect(-10, h / 2 - 8, 20, 8); ctx.fillRect(-18, h / 2, 36, 3);
    // Go agent badge
    box(ctx, w / 2 - 22, -h / 2 - 16, 30, 18, 9, flash > 0.3 ? C.paper : C.signal);
    T(ctx, 'Go', w / 2 - 7, -h / 2 - 3, 11, { mono: true, w: 700, color: C.night, align: 'center' });
    T(ctx, hl ? 'PC-ACC-07' : n.os, 0, h / 2 + 30, hl ? 15 : 15, { w: 500, color: hl ? C.signal : rgba('paper', 0.5), align: 'center', mono: hl });
    ctx.restore();
  }

  function actB1(ctx, t) {
    const lt = t - B1;
    backdrop(ctx, t, [HUB.x, HUB.y, 800, 'azure', 0.16], [1500, 900, 700, 'signal', 0.06]);
    const nodes = netNodes(lt);
    const n0 = nodes[0];
    // camera: pulled out of the tray panel, then pushed into PC-ACC-07's screen
    const e = E.outExpo(prog(lt, 0, 0.75));
    // the exit lands PC-ACC-07's screen exactly where act B2's remote view starts (full frame)
    const zp = prog(lt, BAR - 0.45, BAR), zin = zp * zp; // constant-ish speed in log space
    const pan = E.inOutCubic(prog(lt, BAR - 0.55, BAR - 0.08));
    const zEnd = (W * 1.02) / 82;
    const z = lerp(1.9, 1, e) * Math.exp(Math.log(zEnd) * zin);
    const ax = n0.x, ay = n0.y - 8; // centre of the node's screen
    const px = lerp(lerp(348, ax, e), CX, pan), py = lerp(lerp(597, ay, e), CY, pan);
    ctx.save();
    ctx.translate(px, py); ctx.scale(z, z); ctx.translate(-ax, -ay);

    const appear = (n) => 0.02 + Math.hypot(n.x - n0.x, n.y - n0.y) / 2600;
    // update wave
    const W0 = 1.3, wave = 1000 * E.outCubic(prog(lt, W0, W0 + 0.55));
    const waveOn = lt > W0 && lt < W0 + 0.6;
    // links: agents dial out to the hub; packets travel outbound only
    nodes.forEach((n) => {
      const a = prog(lt, appear(n) + 0.08, appear(n) + 0.4);
      if (a <= 0) return;
      const dx = HUB.x - n.x, dy = HUB.y - n.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      const x0 = n.x + ux * 48, y0 = n.y + uy * 40, x1 = HUB.x - ux * 104, y1 = HUB.y - uy * 104;
      const xe = lerp(x0, x1, E.outCubic(a)), ye = lerp(y0, y1, E.outCubic(a));
      ctx.strokeStyle = rgba('signal', n.id === 0 ? 0.55 : 0.2); ctx.lineWidth = n.id === 0 ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xe, ye); ctx.stroke();
      if (a >= 1) {
        for (let k = 0; k < 2; k++) {
          const u = (lt * 0.9 + hash(n.id * 7.7) + k * 0.5) % 1;
          const px2 = lerp(x0, x1, u), py2 = lerp(y0, y1, u);
          dot(ctx, px2, py2, n.id === 0 ? 4.5 : 3.2, rgba('signal', 0.95 * Math.sin(Math.PI * u)));
        }
        // arrowhead at the hub end: outbound
        ctx.save(); ctx.translate(x1, y1); ctx.rotate(Math.atan2(uy, ux));
        ctx.fillStyle = rgba('signal', 0.6);
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-8, -6); ctx.lineTo(-8, 6); ctx.fill();
        ctx.restore();
      }
    });
    // hub
    const hp = spr(lt, 0.12, 1.8, 8);
    if (hp > 0) {
      ctx.save(); ctx.translate(HUB.x, HUB.y); ctx.scale(hp, hp);
      for (let k = 0; k < 3; k++) {
        const u = (lt * 0.8 + k / 3) % 1;
        ctx.strokeStyle = rgba('signal', 0.35 * (1 - u)); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 96 + u * 90, 0, TAU); ctx.stroke();
      }
      dot(ctx, 0, 0, 96, C.night2);
      ctx.strokeStyle = markGrad(ctx, 190); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 96, 0, TAU); ctx.stroke();
      mark(ctx, 0, -12, 82, { glow: 0.6 });
      T(ctx, 'سرور آریودسک', 0, 58, 19, { w: 700, align: 'center', color: rgba('paper', 0.9) });
      ctx.restore();
    }
    // wave ring
    if (waveOn) {
      const u = prog(lt, W0, W0 + 0.6);
      ctx.strokeStyle = rgba('signal', 0.7 * (1 - u)); ctx.lineWidth = 3 + 10 * (1 - u);
      ctx.beginPath(); ctx.ellipse(HUB.x, HUB.y, wave, wave * 0.75, 0, 0, TAU); ctx.stroke();
    }
    // nodes
    nodes.forEach((n) => {
      const s = spr(lt, appear(n), 2.4, 9);
      if (s <= 0) return;
      const d = Math.hypot(n.x - HUB.x, (n.y - HUB.y) / 0.75);
      const fl = waveOn ? Math.exp(-Math.pow((d - wave) / 60, 2)) : 0;
      node(ctx, n, lt, s * (1 + 0.12 * fl), n.id === 0, fl);
    });
    // inbound attempt: blocked, no open ports
    const at = nodes[ATK];
    const hitT = 2 * B;
    const ax0 = at.x - 520, ay0 = at.y + 260;
    const dxa = at.x - ax0, dya = at.y - ay0, da = Math.hypot(dxa, dya), ux = dxa / da, uy = dya / da;
    const sx = at.x - ux * 78, sy = at.y - uy * 78;
    const hp2 = E.inCubic(prog(lt, hitT - 0.42, hitT));
    if (lt < hitT + 0.3 && hp2 > 0) {
      const hx = lerp(ax0, sx, hp2), hy = lerp(ay0, sy, hp2);
      const fade = 1 - prog(lt, hitT, hitT + 0.2);
      const tailU = clamp(hp2 - 0.35);
      ctx.strokeStyle = rgba('rose', fade); ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.moveTo(lerp(ax0, sx, tailU), lerp(ay0, sy, tailU)); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.atan2(uy, ux)); ctx.fillStyle = rgba('rose', fade);
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-12, -10); ctx.lineTo(-12, 10); ctx.fill(); ctx.restore();
    }
    const sh = prog(lt, hitT - 0.2, hitT - 0.05);
    if (sh > 0) {
      const hit = lt > hitT ? Math.exp(-(lt - hitT) * 6) : 0;
      ctx.save(); ctx.translate(at.x, at.y);
      ctx.strokeStyle = hit > 0.3 ? C.rose : rgba('signal', 0.8 * sh); ctx.lineWidth = 3 + 6 * hit;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) { const a = (k / 6) * TAU + Math.PI / 6; const r = (78 + 10 * hit) * E.outBack(sh); k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.stroke();
      ctx.restore();
      if (lt > hitT) {
        const u = prog(lt, hitT, hitT + 0.5);
        for (let k = 0; k < 12; k++) {
          const a = Math.atan2(-uy, -ux) + (hash(k * 5.3) - 0.5) * 2.2, sp = 60 + 160 * hash(k * 9.1);
          dot(ctx, sx + Math.cos(a) * sp * E.outCubic(u), sy + Math.sin(a) * sp * E.outCubic(u), 4 * (1 - u), rgba('rose', 1 - u));
        }
        // label
        const lp = spr(lt, hitT + 0.02, 2.4, 9);
        const lx = at.x + 40, ly = at.y + 88;
        ctx.save(); ctx.translate(lx, ly); ctx.scale(lp, lp); ctx.globalAlpha *= clamp(lp * 2);
        const lbl = 'اتصال ورودی مسدود · ۰ پورت باز';
        const lw = measure(ctx, lbl, 18, 700) + 58;
        box(ctx, -lw / 2, -20, lw, 40, 20, C.rose);
        cross(ctx, lw / 2 - 22, 0, 6, C.night, 3);
        T(ctx, lbl, lw / 2 - 40, 7, 18, { w: 800, color: C.night });
        ctx.restore();
      }
    }
    // inventory card rising from PC-ACC-07
    const ip = spr(lt, 0.62, 2, 9) * (1 - E.inCubic(prog(lt, BAR - 0.5, BAR - 0.3)));
    if (ip > 0.001) {
      const cx = n0.x - 110, cy = n0.y - 260;
      ctx.save(); ctx.translate(cx + 150, cy + 170); ctx.scale(ip, ip); ctx.translate(-150, -170);
      ctx.globalAlpha *= clamp(ip * 2);
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30;
      box(ctx, 0, 0, 300, 172, 18, C.panel, rgba('signal', 0.5), 2);
      ctx.shadowColor = 'transparent';
      T(ctx, 'گزارش سخت' + ZW + 'افزار و نرم' + ZW + 'افزار', 280, 34, 17, { w: 800, color: C.signal });
      const rows = [['CPU', 'Core i5-10400', 0.34], ['RAM', '۱۶ گیگابایت', 0.62], ['SSD', '۵۱۲ گیگابایت', 0.48], ['APP', '۱۴۲ نرم' + ZW + 'افزار', 0.8]];
      rows.forEach(([k, v, f], i) => {
        const yy = 64 + i * 28, rp = E.outCubic(prog(lt, 0.75 + i * 0.07, 1.15 + i * 0.07));
        T(ctx, k, 20, yy, 14, { mono: true, w: 700, color: rgba('paper', 0.55) });
        T(ctx, v, 280, yy, 15, { w: 500 });
        box(ctx, 64, yy - 9, 90, 6, 3, rgba('paper', 0.1));
        box(ctx, 64, yy - 9, 90 * f * rp, 6, 3, i === 3 ? C.azure : C.signal);
      });
      ctx.restore();
    }
    // signed update badge at the hub
    const up = spr(lt, W0 - 0.05, 2.4, 9) * (1 - prog(lt, BAR - 0.4, BAR - 0.25));
    if (up > 0.001) {
      ctx.save(); ctx.translate(HUB.x, HUB.y - 150); ctx.scale(up, up); ctx.globalAlpha *= clamp(up * 2);
      const lbl = 'به' + ZW + 'روزرسانی امضاشده';
      const lw = measure(ctx, lbl, 18, 800) + measure(ctx, 'v2.4.1', 16, 700, true) + 92;
      box(ctx, -lw / 2, -22, lw, 44, 22, C.signal);
      check(ctx, lw / 2 - 24, 0, 18, E.outCubic(prog(lt, W0 + 0.05, W0 + 0.25)), C.night, 3.5);
      T(ctx, lbl, lw / 2 - 42, 7, 18, { w: 800, color: C.night });
      T(ctx, 'v2.4.1', -lw / 2 + 18, 6, 16, { mono: true, w: 700, color: C.night });
      ctx.restore();
    }
    ctx.restore();


    // headline
    const xr = W - 130;
    kicker(ctx, lt, { xr, y: 300, num: '04', label: 'ایجنت سبک Go', tIn: 0.25, tOut: BAR - 0.62 });
    headline(ctx, lt, { lines: ['فقط به بیرون', 'وصل می' + ZW + 'شود.'], xr, y: 420, size: 96, maxW: 560, tIn: 0.3, tOut: BAR - 0.64, accent: { 'بیرون': C.signal } });
    const bullets = [['هیچ پورتی باز نمی' + ZW + 'کند', 2 * B + 0.02], ['ویندوز ۷ تا ۱۱', 0.72], ['به' + ZW + 'روزرسانی خودکار و امضاشده', W0 + 0.02]].sort((a, b) => a[1] - b[1]);
    bullets.forEach(([s, t0], i) => {
      const p = E.outQuint(prog(lt, t0, t0 + 0.4)) * (1 - E.inCubic(prog(lt, BAR - 0.62, BAR - 0.45)));
      if (p <= 0) return;
      const y = 640 + i * 60;
      ctx.save(); ctx.globalAlpha *= p;
      dot(ctx, xr - 14, y - 10, 14, rgba('signal', 0.16));
      check(ctx, xr - 14, y - 10, 14, E.outCubic(prog(lt, t0 + 0.05, t0 + 0.3)), C.signal, 3);
      T(ctx, s, xr - 42 + (1 - p) * -24, y, 29, { w: 500 });
      ctx.restore();
    });
  }

  // console geometry
  const WIN = { x: 100, y: 196, w: 1090, h: 748 };
  const VIEW = { x: WIN.x + 24, y: WIN.y + 56 + 66, w: 772, h: 596 };
  const TABS = ['دسکتاپ راه دور', 'ترمینال', 'انتقال فایل', 'اسکریپت' + ZW + 'ها'];
  const TAB_T = [0, B, 2 * B];
  function actB2(ctx, t) {
    const lt = t - B2;
    backdrop(ctx, t, [700, 500, 900, 'azure', 0.13], [1600, 300, 700, 'signal', 0.06]);
    const e = E.outExpo(prog(lt, 0, 0.7));
    const z = lerp(W / VIEW.w * 1.02, 1, e);
    const vcx = VIEW.x + VIEW.w / 2, vcy = VIEW.y + VIEW.h / 2;
    ctx.save();
    ctx.translate(lerp(CX, vcx, e), lerp(CY, vcy, e)); ctx.scale(z, z); ctx.translate(-vcx, -vcy);

    const tab = lt < TAB_T[1] ? 0 : lt < TAB_T[2] ? 1 : 2;
    // window
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
    box(ctx, WIN.x, WIN.y, WIN.w, WIN.h, 24, C.panel);
    ctx.shadowColor = 'transparent';
    box(ctx, WIN.x, WIN.y, WIN.w, WIN.h, 24, null, rgba('paper', 0.1), 2);
    const R = WIN.x + WIN.w;
    mark(ctx, R - 40, WIN.y + 29, 26, {});
    T(ctx, 'کنسول کارشناس', R - 64, WIN.y + 36, 20, { w: 800 });
    ['rose', 'amber', 'signal'].forEach((c, i) => dot(ctx, WIN.x + 30 + i * 22, WIN.y + 29, 6.5, rgba(c, 0.8)));
    // recording badge
    const rb = 0.6 + 0.4 * Math.sin(lt * 9);
    box(ctx, WIN.x + 110, WIN.y + 13, 250, 32, 16, rgba('rose', 0.14));
    dot(ctx, WIN.x + 340, WIN.y + 29, 6, rgba('rose', rb));
    T(ctx, 'جلسه در حال ضبط · ۰۰:۴۷'.replace('۰۰:۴۷', fa(`00:${pad2(47 + Math.floor(lt))}`)), WIN.x + 326, WIN.y + 36, 16, { w: 700, color: C.rose });
    ctx.fillStyle = rgba('paper', 0.08); ctx.fillRect(WIN.x, WIN.y + 56, WIN.w, 1.5);
    // sidebar: devices (right, RTL)
    const SB = { x: R - 262, y: WIN.y + 57, w: 262, h: WIN.h - 57 };
    ctx.fillStyle = rgba('paper', 0.025); ctx.fillRect(SB.x, SB.y, SB.w, SB.h - 24);
    ctx.fillStyle = rgba('paper', 0.08); ctx.fillRect(SB.x, SB.y, 1.5, SB.h);
    T(ctx, 'دستگاه' + ZW + 'ها', R - 24, SB.y + 44, 17, { w: 700, color: C.mute });
    const devs = [['PC-ACC-07', 'مشتری الف · حسابداری', 'signal'], ['PC-ACC-02', 'مشتری الف · حسابداری', 'signal'], ['LT-SALES-11', 'مشتری الف · فروش', 'amber'], ['SRV-FILE-01', 'مشتری ج · سرور', 'signal'], ['PC-HR-04', 'مشتری ج · منابع انسانی', 'mute']];
    devs.forEach(([nm, sub, st], i) => {
      const y = SB.y + 70 + i * 74;
      const a = E.outCubic(prog(lt, 0.25 + i * 0.05, 0.55 + i * 0.05));
      ctx.save(); ctx.globalAlpha *= a; ctx.translate((1 - a) * 30, 0);
      if (i === 0) { box(ctx, SB.x + 10, y, SB.w - 20, 64, 14, rgba('signal', 0.1)); ctx.fillStyle = C.signal; ctx.fillRect(R - 12, y + 14, 3, 36); }
      dot(ctx, R - 34, y + 24, 5, C[st]);
      T(ctx, nm, R - 48, y + 30, 16, { mono: true, w: 700, align: 'right', color: i === 0 ? C.paper : rgba('paper', 0.75) });
      T(ctx, sub, R - 48, y + 52, 14, { w: 500, color: C.mute });
      ctx.restore();
    });
    // tabs
    const ty = WIN.y + 56 + 44;
    let tx = VIEW.x + VIEW.w;
    const tabX = [];
    TABS.forEach((s, i) => {
      const tw = measure(ctx, s, 19, 700);
      tabX.push([tx - tw, tw]);
      T(ctx, s, tx, ty, 19, { w: 700, color: i === tab ? C.paper : rgba('paper', 0.4) });
      tx -= tw + 40;
    });
    // sliding indicator
    let ix = tabX[0][0], iw = tabX[0][1];
    for (let k = 1; k < 3; k++) {
      const p = E.spring(lt - TAB_T[k], 2.4, 11);
      if (lt > TAB_T[k]) { ix = lerp(ix, tabX[k][0], p); iw = lerp(iw, tabX[k][1], p); }
    }
    box(ctx, ix, ty + 12, iw, 4, 2, C.signal);
    // view
    ctx.save();
    rr(ctx, VIEW.x, VIEW.y, VIEW.w, VIEW.h, 16); ctx.clip();
    ctx.fillStyle = '#070B15'; ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    const sw = (k) => E.outQuint(prog(lt, TAB_T[k], TAB_T[k] + 0.35)); // RTL: next tab slides in from the left
    // desktop
    if (lt < TAB_T[1] + 0.35) {
      ctx.save();
      ctx.translate(VIEW.x + sw(1) * VIEW.w, VIEW.y);
      const fixed = prog(lt, 0.34, 0.5);
      miniDesktop(ctx, lt, fixed);
      // technician's remote pointer
      const u = E.inOutCubic(prog(lt, 0.05, 0.32));
      const px = qbez(560, 520, 560, u), py = qbez(480, 330, 330, u);
      pointer(ctx, px, py, { color: C.signal, label: 'رضا', press: press(lt, 0.34), s: 28 });
      clickRing(ctx, px, py, lt, 0.34, C.signal);
      ctx.restore();
    }
    // terminal
    if (lt > TAB_T[1] && lt < TAB_T[2] + 0.35) {
      ctx.save();
      ctx.translate(VIEW.x - (1 - sw(1)) * VIEW.w + sw(2) * VIEW.w, VIEW.y);
      ctx.fillStyle = '#060A14'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      ctx.fillStyle = rgba('paper', 0.05); ctx.fillRect(0, 0, VIEW.w, 44);
      T(ctx, 'PowerShell — PC-ACC-07 (SYSTEM)', 22, 29, 15, { mono: true, w: 700, color: rgba('paper', 0.6) });
      const L0 = TAB_T[1] + 0.06;
      const lines = [
        [0.0, 0.16, 'PS C:\\> ', 'Restart-Service -Name Spooler', C.paper],
        [0.2, 0.2, '', 'Status   Name      DisplayName', C.mute],
        [0.22, 0.22, '', 'Running  Spooler   Print Spooler', C.signal],
        [0.27, 0.4, 'PS C:\\> ', 'Test-NetConnection 10.0.4.21 -Port 9100', C.paper],
        [0.42, 0.42, '', 'TcpTestSucceeded : True', C.signal],
      ];
      lines.forEach(([a, b, pr, s, col], i) => {
        if (lt < L0 + a) return;
        const y = 104 + i * 50;
        const n = b > a ? Math.floor(s.length * prog(lt, L0 + a, L0 + b)) : s.length;
        T(ctx, pr, 22, y, 23, { mono: true, w: 700, color: C.signal });
        T(ctx, s.slice(0, n), 22 + measure(ctx, pr, 23, 700, true), y, 23, { mono: true, w: 500, color: col });
      });
      if (Math.floor(lt * 5) % 2 === 0) { ctx.fillStyle = C.signal; ctx.fillRect(22, 104 + 5 * 50 - 20, 12, 25); }
      ctx.restore();
    }
    // file transfer
    if (lt > TAB_T[2]) {
      ctx.save();
      ctx.translate(VIEW.x - (1 - sw(2)) * VIEW.w, VIEW.y);
      ctx.fillStyle = '#070B15'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      const pr = E.inOutCubic(prog(lt, TAB_T[2] + 0.08, 3 * B - 0.02));
      // two endpoints
      const ep = (x, lbl, sub) => {
        box(ctx, x - 90, 150, 180, 120, 18, C.panel2, rgba('paper', 0.12));
        box(ctx, x - 40, 176, 80, 50, 6, null, rgba('paper', 0.5), 2.5);
        ctx.fillStyle = rgba('paper', 0.5); ctx.fillRect(x - 14, 228, 28, 10);
        T(ctx, lbl, x, 300, 17, { mono: true, w: 700, align: 'center' });
        T(ctx, sub, x, 326, 14, { w: 500, color: C.mute, align: 'center' });
      };
      ep(640, 'CONSOLE', 'کنسول کارشناس');
      ep(132, 'PC-ACC-07', 'مشتری الف');
      ctx.strokeStyle = rgba('paper', 0.14); ctx.setLineDash([6, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(540, 210); ctx.lineTo(232, 210); ctx.stroke(); ctx.setLineDash([]);
      // the file flies right -> left
      const fx = lerp(560, 212, pr), fy = 210 - Math.sin(Math.PI * pr) * 60;
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.sin(Math.PI * pr) * -0.2);
      box(ctx, -26, -32, 52, 64, 8, C.azure);
      ctx.fillStyle = rgba('paper', 0.9); ctx.beginPath(); ctx.moveTo(10, -32); ctx.lineTo(26, -16); ctx.lineTo(10, -16); ctx.fill();
      T(ctx, 'EXE', 0, 16, 13, { mono: true, w: 700, align: 'center', color: C.paper });
      ctx.restore();
      // progress
      T(ctx, 'HP_UPD_7.0.1.exe', 60, 430, 20, { mono: true, w: 700, color: C.paper });
      T(ctx, fa(Math.round(pr * 100)) + '٪', VIEW.w - 60, 432, 30, { w: 900, color: pr >= 1 ? C.signal : C.paper });
      box(ctx, 60, 456, VIEW.w - 120, 12, 6, rgba('paper', 0.1));
      box(ctx, VIEW.w - 60 - (VIEW.w - 120) * pr, 456, (VIEW.w - 120) * pr, 12, 6, C.signal);
      T(ctx, pr >= 1 ? 'ارسال شد · ۴۸ مگابایت' : fa(`${(12 + 4 * Math.sin(lt * 7)).toFixed(1)}`).replace('.', '٫') + ' مگابایت بر ثانیه', VIEW.w - 60, 506, 17, { w: 500, color: pr >= 1 ? C.signal : C.mute });
      ctx.restore();
    }
    ctx.restore();
    ctx.strokeStyle = rgba('paper', 0.08); ctx.lineWidth = 2; rr(ctx, VIEW.x, VIEW.y, VIEW.w, VIEW.h, 16); ctx.stroke();

    // resolved stamp
    const rs = spr(lt, 3 * B, 2.2, 8);
    if (rs > 0) {
      ctx.save();
      ctx.translate(VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2 + 20);
      ctx.rotate(lerp(-0.2, -0.05, rs)); const s = lerp(1.8, 1, rs); ctx.scale(s, s);
      ctx.globalAlpha *= clamp(rs * 3);
      const lbl = 'تیکت #' + fa(1042) + ' حل شد';
      const lw = measure(ctx, lbl, 44, 900) + 120;
      ctx.shadowColor = rgba('signal', 0.6); ctx.shadowBlur = 50;
      box(ctx, -lw / 2, -50, lw, 100, 50, C.signal);
      ctx.shadowColor = 'transparent';
      dot(ctx, lw / 2 - 50, 0, 26, C.night);
      check(ctx, lw / 2 - 50, 1, 26, E.outCubic(prog(lt, 3 * B + 0.05, 3 * B + 0.25)), C.signal, 5);
      T(ctx, lbl, lw / 2 - 92, 16, 44, { w: 900, color: C.night });
      ctx.restore();
    }
    ctx.restore();

    // headline: the three tools, the active one lit
    const xr = W - 120, hin = E.outQuint(prog(lt, 0.35, 0.8));
    kicker(ctx, lt, { xr, y: 330, num: '05', label: 'کنترل کامل از راه دور', tIn: 0.3 });
    const items = ['دسکتاپ راه دور', 'ترمینال و اسکریپت', 'انتقال فایل'];
    items.forEach((s, i) => {
      const a = E.outQuint(prog(lt, 0.35 + i * 0.06, 0.8 + i * 0.06));
      if (a <= 0) return;
      const on = lt > 3 * B ? 0.9 : i === tab ? 1 : 0.22;
      const y = 450 + i * 104;
      ctx.save();
      ctx.beginPath(); ctx.rect(1180, y - 90, 700, 120); ctx.clip();
      T(ctx, s, xr - (i === tab && lt < 3 * B ? 26 : 0) * 1, y + (1 - a) * 90, 70, { w: 900, color: rgba(i === tab || lt > 3 * B ? 'paper' : 'paper', on) });
      ctx.restore();
    });
    // active marker
    let my = 450, mk = 0;
    for (let k = 1; k < 3; k++) if (lt > TAB_T[k]) { mk = E.spring(lt - TAB_T[k], 2.4, 11); my = lerp(450 + (k - 1) * 104, 450 + k * 104, mk); }
    ctx.globalAlpha = hin * (1 - prog(lt, 3 * B, 3 * B + 0.1));
    box(ctx, xr - 8, my - 52, 8, 56, 4, C.signal);
    ctx.globalAlpha = 1;
    T(ctx, 'بر پایه' + ZW + 'ی MeshCentral · اجرای اسکریپت روی همان سیستم', xr, 790, 22, { w: 500, color: C.mute, alpha: E.outCubic(prog(lt, 0.7, 1.1)) });
  }

  // ===================================================================== ACT C
  // 9.375 – 13.125  Multi-tenant + SLA, then the immutable audit log.
  const C1 = 5 * BAR, C2 = 6 * BAR;
  const TEN = [
    ['مشتری الف', 24, true, 'azure', 14 * 60 + 52], ['مشتری ب', 18, false, 'amber', 0], ['مشتری ج', 31, true, 'signal', 2 * 60 + 10],
    ['مشتری د', 9, false, 'rose', 0], ['مشتری ه', 42, true, 'amber', 38 * 60 + 5], ['مشتری و', 15, false, 'azure', 0],
  ];
  function tenantCard(ctx, lt, i) {
    const [name, count, ok, col, sla] = TEN[i];
    const colI = i % 3, rowI = Math.floor(i / 3);
    const cw = 330, ch = 300, x = 120 + (2 - colI) * (cw + 32), y = 214 + rowI * (ch + 32);
    const d = spr(lt, -0.16 + i * 0.035, 2, 9);
    if (d <= 0) return;
    const lockT = 2 * B + [0, 0, 0, 1, 0, 2][i] * (B / 4);
    const lk = ok ? 0 : E.outCubic(prog(lt, lockT, lockT + 0.15));
    const s = lerp(0.9, 1, d) * (1 - 0.05 * lk);
    ctx.save();
    ctx.translate(x + cw / 2, y + ch / 2 + (1 - d) * 60); ctx.scale(s, s); ctx.translate(-cw / 2, -ch / 2);
    ctx.globalAlpha *= clamp(d * 2);
    box(ctx, 0, 0, cw, ch, 26, C.panel, rgba('paper', 0.09), 2);
    // allowed: signal outline draws on
    if (ok) {
      const op = E.inOutCubic(prog(lt, B + i * 0.04, B + 0.35 + i * 0.04));
      if (op > 0) {
        rr(ctx, 0, 0, cw, ch, 26);
        ctx.setLineDash([1180 * op, 1200]); ctx.strokeStyle = C.signal; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
      }
      const ap = spr(lt, B + 0.1 + i * 0.04, 2.6, 10);
      if (ap > 0) {
        ctx.save(); ctx.translate(34, 40); ctx.scale(ap, ap);
        avatar(ctx, 0, 0, 20, 'ر', C.azure);
        ctx.restore();
      }
    }
    box(ctx, cw - 46, 26, 20, 20, 6, C[col]);
    T(ctx, name, cw - 58, 46, 27, { w: 800 });
    T(ctx, fa(count) + ' دستگاه', cw - 26, 80, 17, { color: C.mute });
    // device matrix
    for (let k = 0; k < 24; k++) {
      const cx = cw - 36 - (k % 8) * 36, cy = 118 + Math.floor(k / 8) * 30;
      const on = k < count;
      const st = hash(i * 31 + k) < 0.12 ? 'amber' : 'signal';
      dot(ctx, cx, cy, 7, on ? rgba(st, 0.85) : rgba('paper', 0.08));
    }
    ctx.fillStyle = rgba('paper', 0.08); ctx.fillRect(22, 204, cw - 44, 1.5);
    // SLA
    if (ok) {
      const warn = i === 2;
      const done = warn ? prog(lt, 3 * B, 3 * B + 0.12) : 0;
      const left = Math.max(0, sla - Math.floor(lt * 60));
      const frac = clamp(left / (40 * 60));
      const ringCol = warn ? (done > 0.5 ? C.signal : C.amber) : C.signal;
      ctx.strokeStyle = rgba('paper', 0.1); ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(62, 252, 28, 0, TAU); ctx.stroke();
      ctx.strokeStyle = ringCol; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(62, 252, 28, -Math.PI / 2, -Math.PI / 2 + TAU * (done > 0.5 ? 1 : Math.max(0.04, frac) * E.outCubic(prog(lt, 0.3, 0.8)))); ctx.stroke();
      ctx.lineCap = 'butt';
      if (done > 0.5) check(ctx, 62, 253, 22, E.outCubic(prog(lt, 3 * B + 0.05, 3 * B + 0.25)), C.signal, 4);
      T(ctx, done > 0.5 ? 'پاسخ داده شد' : fa(`${pad2(Math.floor(left / 60))}:${pad2(left % 60)}`), cw - 26, 256, done > 0.5 ? 24 : 30, { w: 800, color: warn && done < 0.5 ? C.amber : C.paper });
      T(ctx, done > 0.5 ? 'در مهلت SLA' : 'تا پایان مهلت SLA', cw - 26, 282, 15, { color: C.mute });
    } else {
      ctx.fillStyle = rgba('paper', 0.1);
      rr(ctx, cw - 186, 238, 160, 14, 7); ctx.fill();
      rr(ctx, cw - 126, 262, 100, 12, 6); ctx.fill();
    }
    // locked overlay
    if (lk > 0) {
      box(ctx, 0, 0, cw, ch, 26, rgba('night', 0.72 * lk));
      const ls = spr(lt, lockT, 2.6, 9);
      ctx.save(); ctx.translate(cw / 2, ch / 2 - 10); ctx.scale(lerp(1.8, 1, clamp(ls)) * ls, lerp(1.8, 1, clamp(ls)) * ls);
      lock(ctx, 0, -18, 56, rgba('paper', 0.9));
      T(ctx, 'بدون دسترسی', 0, 52, 19, { w: 700, align: 'center', color: rgba('paper', 0.7) });
      ctx.restore();
    }
    ctx.restore();
  }
  function actC1(ctx, t) {
    const lt = t - C1;
    backdrop(ctx, t, [600, 540, 900, 'azure', 0.12], [1500, 200, 700, 'signal', 0.07]);
    // filter bar
    const fb = E.outQuint(prog(lt, -0.1, 0.3));
    ctx.save(); ctx.globalAlpha *= fb; ctx.translate(0, (1 - fb) * -20);
    const R = 120 + 3 * 330 + 2 * 32;
    box(ctx, R - 470, 140, 470, 50, 25, rgba('paper', 0.05), rgba('paper', 0.12));
    avatar(ctx, R - 28, 165, 16, 'ر', C.azure);
    T(ctx, 'نمایش برای: رضا (کارشناس سطح ۲)', R - 54, 172, 19, { w: 700 });
    T(ctx, fa('3') + ' از ' + fa('6') + ' مشتری', 120, 172, 18, { color: C.mute, align: 'left' });
    ctx.restore();
    for (let i = 0; i < 6; i++) tenantCard(ctx, lt, i);

    const xr = W - 120;
    kicker(ctx, lt, { xr, y: 330, num: '06', label: 'چندمشتری و SLA', tIn: 0.2, tOut: BAR - 0.2 });
    headline(ctx, lt, { lines: ['هر کارشناس،', 'فقط مشتری' + ZW + 'های', 'خودش را می' + ZW + 'بیند.'], xr, y: 450, size: 84, maxW: 560, tIn: 0.25, tOut: BAR - 0.22, accent: { 'فقط': C.signal } });
  }

  const LOG = [
    ['۰۹:۴۲:۰۸', 'رضا', 'شروع جلسه' + ZW + 'ی ریموت', 'PC-ACC-07', '9f2c…a1e0', 'azure'],
    ['۰۹:۴۲:۳۱', 'رضا', 'اجرای دستور', 'Restart-Service Spooler', '51be…77c2', 'signal'],
    ['۰۹:۴۳:۰۲', 'رضا', 'انتقال فایل', 'HP_UPD_7.0.1.exe', 'c08d…3f19', 'azure'],
    ['۰۹:۴۳:۴۰', 'سیستم', 'بستن تیکت', '#' + fa(1042), '7a41…e2b8', 'signal'],
    ['۰۹:۴۴:۱۵', 'مدیر', 'تغییر تنظیمات SLA', 'مشتری الف', 'e3f7…0c5d', 'amber'],
    ['۰۹:۴۵:۰۰', 'سیستم', 'به' + ZW + 'روزرسانی امضاشده', 'v2.4.1', '0b9e…d4a6', 'signal'],
  ];
  const ROW_T = LOG.map((_, i) => i * (B / 2));
  const STAMP = 3 * B;
  function actC2(ctx, t) {
    const lt = t - C2;
    backdrop(ctx, t, [1400, 300, 900, 'signal', 0.07], [400, 900, 800, 'azure', 0.12]);
    const pre = E.inExpo(prog(lt, BAR - 0.28, BAR));
    ctx.save();
    ctx.translate(CX, CY); ctx.scale(1 - 0.85 * pre, 1 - 0.85 * pre); ctx.translate(-CX, -CY);
    const top = 360, rh = 80, gap = 12, xL = 110, xR = W - 110;
    // header row
    const hp = E.outCubic(prog(lt, 0, 0.25));
    ctx.globalAlpha = hp;
    [['زمان', xR - 30], ['کاربر', xR - 280], ['رویداد', xR - 520], ['هدف', xR - 1000]].forEach(([s, x]) => T(ctx, s, x, top - 22, 17, { w: 700, color: C.mute }));
    T(ctx, 'HASH', xL + 70, top - 22, 14, { mono: true, w: 700, color: C.mute });
    ctx.fillStyle = rgba('paper', 0.1); ctx.fillRect(xL, top - 8, xR - xL, 1.5);
    ctx.globalAlpha = 1;
    // rows: newest on top, older rows get pushed down
    for (let i = 0; i < LOG.length; i++) {
      const t0 = ROW_T[i];
      const inp = E.outQuint(prog(lt, t0, t0 + 0.3));
      if (inp <= 0) continue;
      let slot = 0;
      for (let j = i + 1; j < LOG.length; j++) slot += E.outBack(prog(lt, ROW_T[j], ROW_T[j] + 0.25), 1.4);
      const y = top + slot * (rh + gap);
      const [tm, who, what, target, h, col] = LOG[i];
      const flash = Math.exp(-Math.max(0, lt - t0) * 7);
      // tamper attempt shakes row "اجرای دستور"
      const tamper = i === 1 ? Math.exp(-Math.max(0, lt - (STAMP - 0.12)) * 8) * (lt > STAMP - 0.12 ? 1 : 0) : 0;
      ctx.save();
      ctx.translate((1 - inp) * 160 + Math.sin(lt * 90) * 10 * tamper, 0);
      ctx.globalAlpha *= inp;
      box(ctx, xL, y, xR - xL, rh, 18, tamper > 0.1 ? rgba('rose', 0.18 * tamper + 0.05) : rgba('paper', 0.035 + 0.14 * flash), tamper > 0.1 ? rgba('rose', tamper) : rgba('signal', 0.6 * flash), 2);
      ctx.fillStyle = C[col]; rr(ctx, xR - 8, y + 18, 4, rh - 36, 2); ctx.fill();
      T(ctx, fa(tm), xR - 30, y + 38, 25, { w: 700 });
      T(ctx, fa('1405/07/05'), xR - 30, y + 64, 15, { color: C.mute });
      avatar(ctx, xR - 300, y + rh / 2, 17, who[0], who === 'سیستم' ? C.signal : who === 'مدیر' ? C.amber : C.azure);
      T(ctx, who, xR - 328, y + 48, 21, { w: 500 });
      T(ctx, what, xR - 520, y + 49, 26, { w: 800 });
      const latin = /[A-Za-z]/.test(target);
      T(ctx, target, xR - 1000, y + 48, 21, { w: 500, color: rgba('paper', 0.7), mono: latin && !/[آ-ی]/.test(target), align: 'right' });
      // hash + chain link to the previous entry
      T(ctx, h, xL + 70, y + 48, 18, { mono: true, w: 500, color: rgba('signal', 0.85) });
      ctx.strokeStyle = rgba('signal', 0.8); ctx.lineWidth = 3;
      rr(ctx, xL + 24, y + rh / 2 - 12, 30, 24, 12); ctx.stroke();
      ctx.restore();
      if (i > 0 && slot < LOG.length) {
        // chain link between this row and the next one down (its predecessor)
        const lp = E.outCubic(prog(lt, t0 + 0.08, t0 + 0.3));
        ctx.strokeStyle = rgba('signal', 0.8 * lp); ctx.lineWidth = 3;
        rr(ctx, xL + 30, y + rh - 14, 18, gap + 28, 9); ctx.stroke();
      }
    }
    // tamper cursor + stamp
    const tc = prog(lt, STAMP - 0.5, STAMP - 0.12);
    if (tc > 0 && lt < STAMP + 0.25) {
      const u = E.inOutCubic(tc);
      pointer(ctx, lerp(1300, 1180, u), lerp(980, 575, u), { color: C.rose, press: press(lt, STAMP - 0.12), alpha: 1 - prog(lt, STAMP + 0.05, STAMP + 0.25) });
    }
    const sp = spr(lt, STAMP, 2, 7);
    if (sp > 0) {
      ctx.fillStyle = rgba('night', 0.5 * clamp(sp)); ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(CX, 640); ctx.rotate(-0.07); const s = lerp(2.2, 1, sp); ctx.scale(s, s);
      ctx.globalAlpha *= clamp(sp * 4);
      const lbl = 'غیرقابل' + ZW + 'تغییر';
      const lw = measure(ctx, lbl, 130, 900) + 260;
      box(ctx, -lw / 2, -110, lw, 220, 40, rgba('night', 0.85), C.signal, 8);
      lock(ctx, lw / 2 - 110, -12, 110, C.signal);
      T(ctx, lbl, lw / 2 - 200, 48, 130, { w: 900, color: C.signal });
      ctx.restore();
    }
    ctx.restore();

    const xr = W - 120;
    kicker(ctx, lt, { xr, y: 150, num: '07', label: 'لاگ ممیزی', tIn: 0.05, tOut: BAR - 0.3 });
    headline(ctx, lt, { lines: ['هر دستور، هر جلسه، هر تغییر؛ ثبت می' + ZW + 'شود.'], xr, y: 250, size: 70, maxW: 1500, tIn: 0.08, tOut: BAR - 0.32, accent: { 'ثبت': C.signal, 'می\u200cشود.': C.signal } });
  }

  // ===================================================================== ACT D
  // 13.125 – 15  Identity.
  const D0 = 7 * BAR;
  const FEATURES = ['تیکت', 'چت', 'دسکتاپ راه دور', 'اسکریپت', 'SLA', 'لاگ ممیزی'];
  function actD(ctx, t, bufs) {
    const lt = t - D0;
    backdrop(ctx, t, [CX, 470, 1000, 'azure', 0.2 + 0.2 * Math.exp(-lt * 3)], [CX, 470, 600, 'signal', 0.08 + 0.25 * Math.exp(-lt * 4)]);
    // shockwave from the drop
    for (let k = 0; k < 3; k++) {
      const u = prog(lt, k * 0.07, 0.9 + k * 0.07);
      if (u > 0 && u < 1) {
        ctx.strokeStyle = rgba(k === 1 ? 'azure' : 'signal', 0.6 * (1 - u)); ctx.lineWidth = 3 + 20 * (1 - u);
        ctx.beginPath(); ctx.arc(CX, 470, 140 + 1100 * E.outCubic(u), 0, TAU); ctx.stroke();
      }
    }
    // lockup: mark first, then it slides right and the wordmark wipes in right->left
    const word = 'آریودسک', WS = 190;
    const ww = measure(ctx, word, WS, 900);
    const markU = lerp(300, 210, E.inOutCubic(prog(lt, 0.62, 1.05)));
    const total = 210 + 64 + ww;
    const lock_ = E.inOutQuint(prog(lt, 0.62, 1.1));
    const mx = lerp(CX, CX + total / 2 - 105, lock_), my = lerp(470, 430, lock_);
    const draw = E.outCubic(prog(lt, 0.0, 0.32)), fill = E.outCubic(prog(lt, 0.18, 0.4));
    const land = spr(lt, 0.02, 1.6, 7);
    const cur = prog(lt, 0.14, B);
    mark(ctx, mx, my, markU * lerp(0.6, 1, clamp(land, 0, 1.2)), { draw, fill, cur, curPress: press(lt, B), glow: 0.8 + 0.4 * Math.exp(-(lt - B) * 4) * (lt > B ? 1 : 0), curColor: C.night });
    clickRing(ctx, mx - 0.02 * markU, my + 0.02 * markU, lt, B, C.paper, 160);
    // wordmark
    const wr = E.inOutCubic(prog(lt, 0.72, 1.18));
    if (wr > 0) {
      const xr = CX + total / 2 - 210 - 64, by = my + 64;
      const b = bufs.wordX;
      b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H);
      T(b, word, xr, by, WS, { w: 900, color: C.paper });
      // light sweep, clipped to the letters
      const sw = prog(lt, 1.3, 1.75);
      if (sw > 0 && sw < 1) {
        b.globalCompositeOperation = 'source-atop';
        const sx = lerp(xr + 100, xr - ww - 200, E.inOutCubic(sw));
        const g = b.createLinearGradient(sx - 120, 0, sx + 120, 0);
        g.addColorStop(0, 'rgba(53,242,196,0)'); g.addColorStop(0.5, 'rgba(53,242,196,0.9)'); g.addColorStop(1, 'rgba(53,242,196,0)');
        b.fillStyle = g; b.fillRect(0, 0, W, H);
        b.globalCompositeOperation = 'source-over';
      }
      const clipL = lerp(xr + 10, xr - ww - 30, wr);
      ctx.save();
      ctx.beginPath(); ctx.rect(clipL, 0, W - clipL, H); ctx.clip();
      ctx.drawImage(bufs.word, (1 - wr) * 40, 0);
      ctx.restore();
      if (wr < 1) {
        ctx.fillStyle = C.signal;
        ctx.shadowColor = C.signal; ctx.shadowBlur = 30;
        ctx.fillRect(clipL - 3, by - WS * 0.95, 5, WS * 1.3);
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      }
      T(ctx, 'A R Y O D E S K', xr - ww, by + 48, 20, { mono: true, w: 700, color: rgba('paper', 0.45 * E.outCubic(prog(lt, 1.0, 1.3))), align: 'left' });
    }
    // tagline + features
    headline(ctx, lt, { lines: ['هلپ' + ZW + 'دسک و پشتیبانی از راه دور'], xr: CX + measure(ctx, 'هلپ' + ZW + 'دسک و پشتیبانی از راه دور', 50, 700) / 2, y: 690, size: 50, weight: 700, color: rgba('paper', 0.92), tIn: 0.95, maxW: 1400 });
    let x = 0;
    const fw = FEATURES.map((s) => measure(ctx, s, 21, 700) + 44);
    const totalF = fw.reduce((a, b) => a + b, 0) + (FEATURES.length - 1) * 14;
    x = CX + totalF / 2;
    FEATURES.forEach((s, i) => {
      const p = spr(lt, 1.12 + i * 0.045, 2.6, 10);
      if (p > 0) {
        ctx.save();
        ctx.translate(x - fw[i] / 2, 780); ctx.scale(p, p); ctx.globalAlpha *= clamp(p * 2);
        box(ctx, -fw[i] / 2, -22, fw[i], 44, 22, rgba('paper', 0.04), rgba(i % 2 ? 'azure' : 'signal', 0.6), 2);
        T(ctx, s, 0, 8, 21, { w: 700, align: 'center', color: rgba('paper', 0.9) });
        ctx.restore();
      }
      x -= fw[i] + 14;
    });
    T(ctx, 'سامانه' + ZW + 'ی داخلی MSP ساعد · فارسی، راست' + ZW + 'به' + ZW + 'چپ، تقویم شمسی', CX, 900, 20, { w: 500, color: C.mute, align: 'center', alpha: E.outCubic(prog(lt, 1.35, 1.65)) });
  }

  // ================================================================ timeline
  const WHIP_A = C1 - 0.16, WHIP_B = C1 + 0.16;
  const SHAKES = [[B, 3], [BAR, 7], [BAR + 2 * B, 5], [2 * BAR, 6], [3 * BAR, 12], [3 * BAR + 2 * B, 10], [4 * BAR, 12], [4 * BAR + 3 * B, 10],
    [5 * BAR, 6], [5 * BAR + 2 * B, 4], [6 * BAR, 12], [6 * BAR + STAMP, 26, 8], [7 * BAR, 34, 6]];
  for (let k = 1; k < 6; k++) SHAKES.push([6 * BAR + ROW_T[k], 4]);
  const CHROMA = [[3 * BAR, 9], [3 * BAR + 2 * B, 7], [4 * BAR, 11], [5 * BAR, 9, 14], [6 * BAR, 10], [6 * BAR + STAMP, 16], [7 * BAR, 18, 5]];
  for (let k = 1; k < 6; k++) CHROMA.push([6 * BAR + ROW_T[k], 5, 16]);
  const FLASH = [[3 * BAR, 0.25, 12], [4 * BAR, 0.3, 12], [6 * BAR, 0.25, 16], [6 * BAR + STAMP, 0.3, 14], [7 * BAR, 1, 7]];

  function renderScene(ctx, t, bufs) {
    ctx.save();
    const sh = impulse(t, SHAKES);
    if (sh > 0.05) ctx.translate((vnoise(t * 38) - 0.5) * 2 * sh, (vnoise(t * 38 + 71.3) - 0.5) * 2 * sh);
    if (t < 3 * BAR) actA(ctx, t);
    else if (t < 4 * BAR) actB1(ctx, t);
    else if (t < WHIP_A) actB2(ctx, t);
    else if (t < WHIP_B) {
      // RTL whip: the story moves on to the left, so the frame travels right
      const p = E.inOutQuint(prog(t, WHIP_A, WHIP_B));
      ctx.save(); ctx.translate(W * 1.05 * p, 0); actB2(ctx, t); ctx.restore();
      ctx.save(); ctx.translate(-W * 1.05 * (1 - p), 0); actC1(ctx, t); ctx.restore();
    }
    else if (t < 6 * BAR) actC1(ctx, t);
    else if (t < 7 * BAR) actC2(ctx, t);
    else actD(ctx, t, bufs);
    ctx.restore();
  }

  // ------------------------------------------------------------------- post
  let buf = null;
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function buffers() {
    if (buf) return buf;
    buf = { scene: canvas(W, H), acc: canvas(W, H), tmp: canvas(W, H), tmp2: canvas(W, H), vig: canvas(W, H), word: canvas(W, H), grain: [] };
    for (const k of ['scene', 'acc', 'tmp', 'tmp2', 'vig', 'word']) buf[k + 'X'] = buf[k].getContext('2d');
    const v = buf.vigX;
    const vg = v.createRadialGradient(CX, CY, W * 0.3, CX, CY, W * 0.64);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    v.fillStyle = vg; v.fillRect(0, 0, W, H);
    let seed = 1405;
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let k = 0; k < 6; k++) {
      const c = canvas(512, 512), x = c.getContext('2d'), id = x.createImageData(512, 512);
      for (let i = 0; i < id.data.length; i += 4) {
        const n = (rnd() + rnd() + rnd()) / 3;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = 128 + (n - 0.5) * 255; id.data[i + 3] = 255;
      }
      x.putImageData(id, 0, 0); buf.grain.push(c);
    }
    return buf;
  }

  function chroma(out, src, amt) {
    const b = buf, s = amt / 1000;
    out.fillStyle = '#000'; out.fillRect(0, 0, W, H);
    out.globalCompositeOperation = 'lighter';
    [[255, 0, 0, s * 1.6], [0, 255, 0, 0], [0, 0, 255, s * 3.2]].forEach(([r, g, bb, k]) => {
      const x = b.tmpX;
      x.globalCompositeOperation = 'source-over'; x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${r},${g},${bb})`; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'source-over';
      const w = W * (1 + k), h = H * (1 + k);
      out.drawImage(b.tmp, CX - w / 2, CY - h / 2, w, h);
    });
    out.globalCompositeOperation = 'source-over';
  }

  const ACTS = ['تیکت', 'تیکت', 'چت', 'ایجنت', 'ریموت', 'چندمشتری', 'ممیزی', 'آریودسک'];
  // opt.frame: the playback frame index, which differs from t * FPS when rendering at another speed
  function hud(ctx, t, opt = {}) {
    const a = E.outCubic(prog(t, 0.1, 0.6)) * (1 - E.outCubic(prog(t, 7 * BAR - 0.1, 7 * BAR + 0.3)));
    if (a <= 0) return;
    const f = opt.frame ?? Math.min(DUR * FPS - 1, Math.floor(t * FPS + 1e-6));
    const si = Math.min(7, Math.floor(t / BAR));
    ctx.save();
    ctx.globalAlpha = 0.7 * a;
    ctx.strokeStyle = C.paper; ctx.fillStyle = C.paper; ctx.lineWidth = 2;
    const m = 44, l = 26;
    // the bottom row makes way for the taskbar in act A
    const ab = a * prog(t, 3 * BAR - 0.25, 3 * BAR + 0.1);
    ctx.beginPath();
    [[m, m, 1, 1], [W - m, m, -1, 1]].forEach(([x, y, dx, dy]) => {
      ctx.moveTo(x + dx * l, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * l);
    });
    ctx.stroke();
    ctx.globalAlpha = 0.7 * ab;
    ctx.beginPath();
    [[m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.moveTo(x + dx * l, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * l);
    });
    ctx.stroke();
    ctx.globalAlpha = 0.7 * a;
    ctx.letterSpacing = '3px';
    T(ctx, 'ARYODESK · PRODUCT FILM', 88, 82, 15, { mono: true, w: 700, color: rgba('paper', 0.8) });
    ctx.letterSpacing = '0px';
    const ss = Math.floor(f / FPS), ff = f % FPS;
    T(ctx, fa(`00:${pad2(ss)}:${pad2(ff)}`) + '  ·  ' + fa('1405/07/05'), W - 88, 86, 18, { w: 500, color: rgba('paper', 0.8) });
    // progress, right to left
    const x1 = W - 88, x0 = W - 88 - 8 * 60;
    for (let k = 0; k < 8; k++) {
      const x = x1 - (k + 1) * 60 + 4;
      ctx.globalAlpha = 0.7 * ab * (k === si ? 1 : k < si ? 0.5 : 0.18);
      ctx.fillRect(x, H - 84 - (k === si ? 2 : 1), 52, k === si ? 4 : 2);
    }
    ctx.globalAlpha = 0.7 * ab;
    T(ctx, fa(pad2(si + 1)) + ' / ' + fa('08') + '   ' + ACTS[si], x0 - 24, H - 76, 17, { w: 700, color: rgba('paper', 0.85) });
    ctx.restore();
  }

  function render(out, t, opt = {}) {
    const b = buffers();
    const n = opt.subframes || 1, shutter = opt.shutter ?? 0.5;
    for (let s = 0; s < n; s++) {
      const ts = n > 1 ? t + ((s + 0.5) / n - 0.5) * (shutter / FPS) : t;
      const x = b.sceneX;
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      renderScene(x, clamp(ts, 0, DUR - 1e-6), b);
      b.accX.globalAlpha = 1 / (s + 1);
      b.accX.drawImage(b.scene, 0, 0);
    }
    b.accX.globalAlpha = 1;

    const ca = impulse(t, CHROMA);
    if (ca > 0.4) chroma(out, b.acc, ca); else out.drawImage(b.acc, 0, 0);

    // slice glitch on the hard cuts of the audit section
    const cutT = [6 * BAR, 6 * BAR + STAMP, 7 * BAR];
    for (const c0 of cutT) {
      const d = t - c0;
      if (d >= 0 && d < 0.08) {
        b.tmp2X.drawImage(out.canvas, 0, 0);
        const amt = 150 * (1 - d / 0.08), seed = Math.floor(c0 * 100) + Math.floor(t * 60);
        for (let k = 0; k < 9; k++) {
          const y = hash(seed + k * 1.3) * H, h = 8 + hash(seed + k * 2.1) * 90, dx = (hash(seed + k * 3.7) - 0.5) * 2 * amt;
          out.drawImage(b.tmp2, 0, y, W, h, dx, y, W, h);
        }
      }
    }

    // flashes; the drop into the identity ramps in from the stamp
    let fl = impulse(t, FLASH);
    fl += E.inExpo(prog(t, 7 * BAR - 0.12, 7 * BAR)) * (t < 7 * BAR ? 0.9 : 0);
    if (fl > 0.003) { out.fillStyle = `rgba(225,255,246,${Math.min(1, fl)})`; out.fillRect(0, 0, W, H); }
    // fade in from black / out at the very end
    const fb = 1 - prog(t, 0, 0.2) + prog(t, DUR - 0.12, DUR);
    if (fb > 0.001) { out.fillStyle = `rgba(0,0,0,${clamp(fb)})`; out.fillRect(0, 0, W, H); }

    out.drawImage(b.vig, 0, 0);
    hud(out, t, opt);

    if (opt.grain !== false) {
      const f = opt.frame ?? Math.floor(t * FPS);
      out.save();
      out.globalCompositeOperation = 'overlay';
      out.globalAlpha = 0.07;
      const pat = out.createPattern(b.grain[f % 6], 'repeat');
      out.translate(-Math.floor(hash(f) * 512), -Math.floor(hash(f + 0.5) * 512));
      out.fillStyle = pat; out.fillRect(0, 0, W + 512, H + 512);
      out.restore();
    }
  }

  window.Reel = { W, H, FPS, DUR, BPM, B, BAR, render };
})();
