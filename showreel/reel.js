/*
 * SHOWREEL '26 — a 15 second motion design reel, written entirely in code.
 *
 * Every frame is a pure function of time: render(t) -> pixels. No keyframes,
 * no timeline, no state carried between frames. That is what lets the
 * offline renderer split the work across several browsers, and what lets
 * each frame be rendered several times per 1/60 s for true motion blur.
 *
 * Structure: 128 BPM, 8 bars of 4/4 = 15.0 s exactly. One scene per bar.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- constants
  const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
  const FPS = 60, DUR = 15;
  const BPM = 128, B = 60 / BPM, BAR = 4 * B; // beat .46875s, bar 1.875s

  const HEX = {
    ink: '#0A0A10', ink2: '#15151F', paper: '#F3EEE4', white: '#FFFFFF',
    hot: '#FF3B1F', ultra: '#4B2BFF', volt: '#D4FF3A', pink: '#FF4FC8', cyan: '#2DE2FF',
  };
  const RGB = {};
  for (const k in HEX) {
    const h = HEX[k];
    RGB[k] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const C = HEX;
  const rgba = (k, a) => `rgba(${RGB[k][0]},${RGB[k][1]},${RGB[k][2]},${a})`;

  const FAM = { display: '"Unbounded"', sans: '"Inter Tight"', mono: '"JetBrains Mono"' };
  const font = (ctx, weight, size, fam) => { ctx.font = `${weight} ${size}px ${fam}`; };

  const SCENES = [
    'PRINCIPLES', 'KINETIC TYPE', 'GEOMETRY', '3D / PARTICLES',
    'CRAFT / EASING', 'SIMULATION', 'RHYTHM / EDIT', 'IDENTITY',
  ];

  // ------------------------------------------------------------------ helpers
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mod = (a, n) => ((a % n) + n) % n;
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
  const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  const E = {
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
    outBounce: (t) => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    },
    // damped spring, t in seconds
    spring: (t, freq = 1.6, damp = 7) => (t <= 0 ? 0 : 1 - Math.exp(-damp * t) * Math.cos(TAU * freq * t)),
  };

  function cubicBezier(x1, y1, x2, y2) {
    const bx = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const by = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
    const f = (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 36; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; }
      return by(t);
    };
    f.bx = bx; f.by = by;
    return f;
  }
  const EZ = cubicBezier(0.83, 0, 0.17, 1);

  // impulse envelopes: sum of a * exp(-(t - t0) * k) after each hit
  const impulse = (t, list, k = 11) => {
    let v = 0;
    for (const [t0, a, kk] of list) if (t >= t0) v += a * Math.exp(-(t - t0) * (kk || k));
    return v;
  };

  function bg(ctx, color) { ctx.fillStyle = color; ctx.fillRect(-300, -300, W + 600, H + 600); }

  function fitSize(ctx, text, weight, fam, maxW, maxSize) {
    font(ctx, weight, 100, fam);
    return Math.min(maxSize, (100 * maxW) / ctx.measureText(text).width);
  }

  // per-letter layout (keeps kerning of prefixes)
  function layout(ctx, text) {
    const total = ctx.measureText(text).width;
    const out = [];
    for (let i = 0; i < text.length; i++) {
      const pre = ctx.measureText(text.slice(0, i)).width;
      const w = ctx.measureText(text[i]).width;
      out.push({ ch: text[i], x: pre + w / 2, w });
    }
    return { total, letters: out };
  }
  const capHeight = (ctx) => ctx.measureText('H').actualBoundingBoxAscent;

  // draws text letter-by-letter centred on (cx, cy = cap centre); fx(i) -> {dx,dy,rot,sc,alpha}
  function drawLetters(ctx, text, cx, cy, fx, style) {
    const L = layout(ctx, text);
    const ch = capHeight(ctx);
    const x0 = cx - L.total / 2, base = cy + ch / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    L.letters.forEach((l, i) => {
      const f = fx(i, L.letters.length);
      if (f.alpha !== undefined && f.alpha <= 0) return;
      ctx.save();
      ctx.translate(x0 + l.x + (f.dx || 0), base + (f.dy || 0));
      if (f.rot) ctx.rotate(f.rot);
      if (f.sc !== undefined) ctx.scale(f.sc, f.sc);
      if (f.alpha !== undefined) ctx.globalAlpha *= f.alpha;
      if (style === 'stroke') ctx.strokeText(l.ch, 0, 0); else ctx.fillText(l.ch, 0, 0);
      ctx.restore();
    });
    return { x0, base, ch, total: L.total };
  }

  function typeText(ctx, str, p) { return str.slice(0, Math.floor(str.length * clamp(p) + 1e-6)); }
  // typewriter that stays put while typing: lay out against the full string's width
  function typeCentered(ctx, str, p, cx, y) {
    const a = ctx.textAlign;
    ctx.textAlign = 'left';
    ctx.fillText(typeText(ctx, str, p), cx - ctx.measureText(str).width / 2, y);
    ctx.textAlign = a;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function dotGrid(ctx, step, color, r) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.fill();
  }

  // ===================================================================== 01
  // PRINCIPLES — bouncing ball: squash & stretch, arcs, anticipation, spacing.
  const S1 = (() => {
    const floorY = 800, R = 62, CT = 0.075;
    const xs = [300, 520, 740, 960], hs = [0, 340, 230];
    const imp = [B, 2 * B, 3 * B];
    function pos(tt) {
      if (tt <= 0) return { x: xs[0], y: -150, vx: 0, vy: 0 };
      if (tt < B) {
        const u = tt / B;
        return { x: lerp(xs[0], xs[1], u), y: lerp(-150, floorY - R, u * u), vx: (xs[1] - xs[0]) / B, vy: (2 * (floorY - R + 150) * u) / B };
      }
      if (tt < 3 * B) {
        const k = Math.floor(tt / B), t0 = k * B;
        if (tt < t0 + CT) return { x: xs[k], y: floorY - R, vx: 0, vy: 0, contact: (tt - t0) / CT };
        const u = (tt - t0 - CT) / (B - CT), h = hs[k], d = B - CT;
        return { x: lerp(xs[k], xs[k + 1], u), y: floorY - R - h * 4 * u * (1 - u), vx: (xs[k + 1] - xs[k]) / d, vy: (-h * 4 * (1 - 2 * u)) / d };
      }
      return { x: xs[3], y: floorY - R, vx: 0, vy: 0 };
    }
    const notes = ['SQUASH & STRETCH', 'ARCS + SPACING', 'ANTICIPATION'];

    return function (ctx, t) {
      bg(ctx, C.ink);
      dotGrid(ctx, 48, rgba('paper', 0.06), 1.6);
      const fade = 1 - prog(t, 3 * B + 0.2, 3 * B + 0.4);

      // floor
      const fl = E.outExpo(prog(t, 0, 0.7));
      ctx.strokeStyle = rgba('paper', 0.35 * fade);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(CX - 760 * fl, floorY); ctx.lineTo(CX + 760 * fl, floorY); ctx.stroke();
      // measuring ticks along floor
      ctx.fillStyle = rgba('paper', 0.3 * fade);
      for (let i = -19; i <= 19; i++) {
        const x = CX + i * 40;
        if (Math.abs(i * 40) > 760 * fl) continue;
        ctx.fillRect(x - 1, floorY + 8, 2, i % 5 === 0 ? 14 : 6);
      }

      // motion path (dashed), revealed as the ball travels
      ctx.save();
      ctx.setLineDash([1, 12]); ctx.lineCap = 'round'; ctx.lineWidth = 4;
      ctx.strokeStyle = rgba('paper', 0.4 * fade);
      ctx.beginPath();
      const end = Math.min(t, 3 * B);
      for (let s = 0.02; s <= end; s += 1 / 240) { const p = pos(s); if (s <= 0.021) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
      ctx.stroke();
      ctx.restore();

      // impact rings + keyframe diamonds + annotations
      imp.forEach((ti, k) => {
        if (t < ti) return;
        const x = xs[k + 1];
        const p = prog(t, ti, ti + 0.6);
        const rr = 60 + 300 * E.outExpo(p);
        ctx.strokeStyle = rgba(k === 2 ? 'volt' : 'paper', 0.7 * (1 - p));
        ctx.lineWidth = 1 + 5 * (1 - p);
        ctx.beginPath(); ctx.ellipse(x, floorY, rr, rr * 0.16, 0, 0, TAU); ctx.stroke();

        const dp = E.outBack(prog(t, ti, ti + 0.25), 3);
        ctx.save();
        ctx.translate(x, floorY); ctx.rotate(Math.PI / 4); ctx.scale(dp, dp);
        ctx.fillStyle = rgba('volt', fade); ctx.fillRect(-9, -9, 18, 18);
        ctx.restore();

        const ap = prog(t, ti + 0.02, ti + 0.3);
        ctx.strokeStyle = rgba('paper', 0.5 * fade);
        ctx.lineWidth = 1.5;
        const ly = floorY + (k === 1 ? 150 : 92);
        ctx.beginPath(); ctx.moveTo(x, floorY + 18); ctx.lineTo(x, floorY + 18 + (ly - floorY - 44) * E.outCubic(ap)); ctx.stroke();
        font(ctx, 500, 17, FAM.mono);
        ctx.letterSpacing = '3px';
        ctx.textAlign = 'center';
        ctx.fillStyle = rgba('paper', 0.85 * fade);
        typeCentered(ctx, notes[k], ap * 1.3, x, ly);
        font(ctx, 500, 13, FAM.mono);
        ctx.fillStyle = rgba('paper', 0.4 * fade);
        ctx.fillText(`KEY ${String(k + 1).padStart(2, '0')} · F${String(Math.round(ti * FPS)).padStart(3, '0')}`, x, ly + 24);
        ctx.letterSpacing = '0px';
      });

      // onion skin ghosts
      if (t < 3 * B + 0.3) {
        for (let k = 6; k >= 1; k--) {
          const tt = t - k * 0.035;
          if (tt <= 0.02) continue;
          const p = pos(Math.min(tt, 3 * B));
          ctx.strokeStyle = rgba('hot', 0.4 * (1 - k / 7) * fade);
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
        }
      }

      // the ball
      let p = pos(t), x = p.x, y = p.y, r = R, sx = 1, sy = 1, rot = 0;
      if (t < 3 * B) {
        if (p.contact !== undefined) {
          const q = Math.sin(Math.PI * p.contact);
          sy = 1 - 0.42 * q; sx = 1 / sy; y = floorY - R * sy;
        } else {
          const sp = Math.hypot(p.vx, p.vy);
          const st = 1 + clamp(sp / 3200, 0, 0.38);
          rot = Math.atan2(p.vy, p.vx); sx = st; sy = 1 / st;
        }
      } else {
        const a = prog(t, 3 * B, 3 * B + 0.07);
        const ant = prog(t, 3 * B + 0.07, 3 * B + 0.26);
        const b = prog(t, 3 * B + 0.26, 4 * B);
        if (b <= 0) {
          sy = lerp(1, 0.58, E.outCubic(a));
          sy = lerp(sy, 0.48, E.inOutSine(ant));
          sx = 1 / sy; y = floorY - R * sy;
        } else {
          sy = b < 0.22 ? lerp(0.48, 1.5, E.outCubic(b / 0.22)) : lerp(1.5, 1, E.inOutCubic((b - 0.22) / 0.78));
          sx = 1 / sy;
          r = lerp(R, 1260, E.inExpo(b));
          y = lerp(floorY - r * sy, CY, E.inCubic(b));
          sx = lerp(sx, 1, E.inExpo(b)); sy = lerp(sy, 1, E.inExpo(b));
        }
      }
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, sy);
      ctx.fillStyle = C.hot;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      if (r < 200) { // glossy highlight while it is still a ball
        ctx.fillStyle = rgba('white', 0.22);
        ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.36, r * 0.28, r * 0.17, -0.6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    };
  })();

  // ===================================================================== 02
  // KINETIC TYPE — words that demonstrate what they mean.
  function S2(ctx, lt) {
    if (lt < 2 * B) {
      bg(ctx, C.hot);
      // outlined marquee rows
      ctx.save();
      font(ctx, 900, 170, FAM.display);
      ctx.strokeStyle = rgba('ink', 0.3); ctx.lineWidth = 2;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const row = 'MOTION  MOTION  MOTION  MOTION  ';
      const tw = ctx.measureText(row).width;
      [[120, 1], [960, -1]].forEach(([y, dir]) => {
        const x0 = -mod(lt * 420 * dir + (dir < 0 ? 300 : 0), tw);
        ctx.strokeText(row, x0, y); ctx.strokeText(row, x0 + tw, y);
      });
      ctx.restore();

      const size = fitSize(ctx, 'MOTION', 900, FAM.display, 1560, 330);
      font(ctx, 900, size, FAM.display);
      const ch = capHeight(ctx);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, CY - ch / 2 - 40, W, ch + 80); ctx.clip();
      ctx.fillStyle = C.ink;
      drawLetters(ctx, 'MOTION', CX, CY - 30, (i) => {
        const d = 0.01 + i * 0.035;
        const p = E.outExpo(prog(lt, d, d + 0.5));
        const q = E.inExpo(prog(lt, 0.7 + i * 0.022, 0.7 + i * 0.022 + 0.2));
        return { dy: (1 - p) * size * 1.05 - q * size * 1.1, rot: (1 - p) * 0.28 };
      });
      ctx.restore();

      const sub = 'is my first language';
      const tp = prog(lt, 0.28, 0.62);
      font(ctx, 500, 38, FAM.mono);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const full = ctx.measureText(sub).width;
      const sx = CX - full / 2, sy = CY - 30 + ch / 2 + 100;
      const a = 1 - prog(lt, 0.78, 0.88);
      ctx.fillStyle = rgba('ink', a);
      const shown = typeText(ctx, sub, tp);
      ctx.fillText(shown, sx, sy);
      if (Math.floor(lt * 7) % 2 === 0 || (tp > 0 && tp < 1)) ctx.fillRect(sx + ctx.measureText(shown).width + 6, sy - 30, 20, 36);
      return;
    }

    const k = Math.min(3, Math.floor((lt - 2 * B) / (B / 2)));
    const wl = lt - 2 * B - k * (B / 2);
    const WORDS = [
      { w: 'EASE', bg: C.ultra, fg: C.paper, note: 'cubic-bezier(.16, 1, .3, 1)' },
      { w: 'SNAP', bg: C.volt, fg: C.ink, note: 'spring(stiffness: 900)' },
      { w: 'BOUNCE', bg: C.paper, fg: C.hot, note: 'gravity · restitution 0.6' },
      { w: 'FLOW', bg: C.ink, fg: C.volt, note: 'y = sin(2πft − φ)' },
    ];
    const Wd = WORDS[k];
    bg(ctx, Wd.bg);
    const size = fitSize(ctx, Wd.w, 900, FAM.display, 1400, 290);
    font(ctx, 900, size, FAM.display);
    ctx.fillStyle = Wd.fg;
    let fx;
    if (k === 0) {
      const p = E.outExpo(prog(wl, 0, 0.24));
      fx = (i) => { const q = E.outExpo(prog(wl, i * 0.012, 0.22 + i * 0.012)); return { dx: -620 * (1 - q) }; };
      // speed lines trailing the ease
      ctx.fillStyle = rgba('paper', 0.35 * (1 - p));
      for (let j = 0; j < 7; j++) ctx.fillRect(CX - 900 + j * 20, CY - 140 + j * 42, 700 * (1 - p), 5);
      ctx.fillStyle = Wd.fg;
    } else if (k === 1) {
      const s = E.spring(wl, 3.2, 16);
      fx = () => ({ sc: 0.25 + 0.75 * s, rot: 0.25 * (1 - s) });
      // pop burst
      const bp = prog(wl, 0, 0.18);
      ctx.save();
      ctx.strokeStyle = rgba('ink', 1 - bp); ctx.lineWidth = 8; ctx.lineCap = 'round';
      for (let j = 0; j < 12; j++) {
        const a = (j / 12) * TAU, r0 = 330 + 260 * E.outExpo(bp), r1 = r0 + 60 * (1 - bp);
        ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * r0, CY + Math.sin(a) * r0 * 0.6); ctx.lineTo(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1 * 0.6); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = Wd.fg;
    } else if (k === 2) {
      fx = (i) => { const u = prog(wl, i * 0.016, i * 0.016 + 0.19); return { dy: -(1 - E.outBounce(u)) * 460, sc: 1 + 0.08 * (1 - u) }; };
    } else {
      fx = (i) => {
        const ph = wl * 15 - i * 0.9, env = 1 - 0.4 * prog(wl, 0, 0.23);
        return { dy: Math.sin(ph) * 60 * env, rot: Math.cos(ph) * 0.16 * env, sc: 0.6 + 0.4 * E.outExpo(prog(wl, 0, 0.12)) };
      };
    }
    // the SNAP pivot is the letter centre, so offset the baseline pivot for scale
    drawLetters(ctx, Wd.w, CX, CY - 20, fx);
    font(ctx, 500, 28, FAM.mono);
    ctx.letterSpacing = '2px';
    ctx.textAlign = 'center';
    ctx.fillStyle = Wd.fg; ctx.globalAlpha = 0.75;
    typeCentered(ctx, Wd.note, prog(wl, 0.02, 0.16), CX, CY + size * 0.36 + 70);
    ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
  }

  // ===================================================================== 03
  // GEOMETRY — radial systems & polygon morphing.
  const S3 = (() => {
    const N = 240;
    const poly = (n, rOut, rIn, off) => {
      const v = [];
      const m = rIn ? n * 2 : n;
      for (let i = 0; i < m; i++) {
        const a = off + (i / m) * TAU, r = rIn && i % 2 ? rIn : rOut;
        v.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return v;
    };
    const rayPoly = (verts, th) => {
      const dx = Math.cos(th), dy = Math.sin(th);
      let best = Infinity;
      for (let i = 0; i < verts.length; i++) {
        const a = verts[i], b = verts[(i + 1) % verts.length];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const det = ex * dy - dx * ey;
        if (Math.abs(det) < 1e-9) continue;
        const tt = (ex * a[1] - a[0] * ey) / det;
        const s = (dx * a[1] - dy * a[0]) / det;
        if (tt > 0 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.min(best, tt);
      }
      return best;
    };
    const profile = (verts) => Array.from({ length: N }, (_, i) => (verts ? rayPoly(verts, (i / N) * TAU) : 1));
    const SH = [
      profile(null),
      profile(poly(3, 1.3, 0, -Math.PI / 2)),
      profile(poly(4, 1.22, 0, -Math.PI / 4)),
      profile(poly(5, 1.32, 0.56, -Math.PI / 2)),
    ];

    function shapeAt(lt) {
      let idx = 0, m = 0;
      for (let k = 1; k <= 3; k++) {
        const p = E.inOutExpo(prog(lt, k * B - 0.28, k * B));
        if (p > 0) { idx = k - 1; m = p; }
      }
      const a = SH[idx], b = SH[Math.min(3, idx + 1)];
      const r = new Float32Array(N);
      for (let i = 0; i < N; i++) r[i] = lerp(a[i], b[i], m);
      let rot = lt * 0.5;
      for (let k = 1; k <= 3; k++) rot += E.inOutExpo(prog(lt, k * B - 0.28, k * B)) * (Math.PI / 3);
      return { r, rot };
    }
    function pathShape(ctx, sh, R) {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const j = i % N, a = (j / N) * TAU + sh.rot;
        const x = Math.cos(a) * R * sh.r[j], y = Math.sin(a) * R * sh.r[j];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    return function (ctx, lt) {
      bg(ctx, C.ink);
      dotGrid(ctx, 48, rgba('paper', 0.05), 1.6);
      const inS = E.outBack(prog(lt, 0, 0.38), 2.2);
      const outP = prog(lt, 4 * B - 0.24, 4 * B);
      const sc = inS * (1 - E.inBack(outP, 2.6));
      ctx.save();
      ctx.translate(CX, CY);
      ctx.scale(sc, sc);

      // shock rings every beat
      for (let k = 0; k < 4; k++) {
        const tk = k * B; if (lt < tk) continue;
        const p = prog(lt, tk, tk + 1.1);
        const r = lerp(240, 1150, E.outCubic(p));
        ctx.strokeStyle = rgba('paper', 0.35 * (1 - p)); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      }

      // dashed guide circles counter-rotating
      ctx.save();
      ctx.setLineDash([4, 14]); ctx.lineWidth = 2;
      ctx.strokeStyle = rgba('paper', 0.18);
      ctx.rotate(-lt * 0.3); ctx.beginPath(); ctx.arc(0, 0, 440, 0, TAU); ctx.stroke();
      ctx.rotate(lt * 0.7); ctx.beginPath(); ctx.arc(0, 0, 250, 0, TAU); ctx.stroke();
      ctx.restore();

      // radial bars
      const bp = Math.exp(-mod(lt, B) * 7);
      ctx.lineCap = 'round'; ctx.lineWidth = 12;
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TAU + lt * 0.55;
        const wave = Math.max(0, Math.sin(lt * 7 - i * 0.7));
        const r0 = 300 + 22 * bp, len = 16 + 80 * wave + 55 * bp;
        ctx.strokeStyle = i % 3 === 0 ? C.volt : i % 3 === 1 ? C.ultra : rgba('paper', 0.5);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len));
        ctx.stroke();
      }

      // orbiters (drawn behind/in front of the shape by depth)
      const orb = (j, tt) => {
        const ph = tt * (2.4 + j * 0.55) + j * 2.1, tilt = j * 1.05 + 0.3;
        const ox = Math.cos(ph) * (470 - j * 55), oy = Math.sin(ph) * (140 + j * 45);
        return { x: ox * Math.cos(tilt) - oy * Math.sin(tilt), y: ox * Math.sin(tilt) + oy * Math.cos(tilt), z: Math.sin(ph) };
      };
      const cols = [C.hot, C.cyan, C.volt];
      const drawOrb = (front) => {
        for (let j = 0; j < 3; j++) {
          if ((orb(j, lt).z > 0) !== front) continue;
          for (let s = 16; s >= 0; s--) {
            const o = orb(j, lt - s * 0.016);
            ctx.globalAlpha = 1 - s / 17;
            ctx.fillStyle = cols[j];
            ctx.beginPath(); ctx.arc(o.x, o.y, 11 * (1 - s / 18) * (0.8 + 0.3 * o.z), 0, TAU); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      };
      drawOrb(false);

      // morphing shape with delayed echo outlines
      for (let e = 4; e >= 0; e--) {
        const sh = shapeAt(lt - e * 0.055);
        pathShape(ctx, sh, 190 * (1 + e * 0.14));
        if (e > 0) { ctx.strokeStyle = rgba('paper', 0.55 - e * 0.11); ctx.lineWidth = 3; ctx.stroke(); }
        else {
          const g = ctx.createLinearGradient(-200, -200, 200, 200);
          g.addColorStop(0, C.hot); g.addColorStop(1, C.pink);
          ctx.fillStyle = g; ctx.fill();
        }
      }
      // centre crosshair
      ctx.strokeStyle = rgba('ink', 0.7); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke();

      drawOrb(true);
      ctx.restore();
    };
  })();

  // ===================================================================== 04
  // 3D / PARTICLES — sphere -> torus knot, then fly through.
  const S4 = (() => {
    const PN = 1600;
    const P = [];
    const pal = [RGB.cyan, RGB.ultra, RGB.pink, RGB.hot];
    for (let i = 0; i < PN; i++) {
      const y = 1 - (i / (PN - 1)) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.399963;
      const sph = [Math.cos(th) * rr * 330, y * 330, Math.sin(th) * rr * 330];
      const u = (i / PN) * TAU, p = 2, q = 3;
      const kr = 2 + Math.cos(q * u);
      const base = [kr * Math.cos(p * u), kr * Math.sin(p * u), -Math.sin(q * u)];
      const j1 = (hash(i * 1.7) - 0.5) * 0.5, j2 = (hash(i * 3.3) - 0.5) * 0.5, j3 = (hash(i * 5.1) - 0.5) * 0.5;
      const knot = [(base[0] + j1) * 118, (base[1] + j2) * 118, (base[2] + j3) * 118];
      const g = (i / PN) * 3;
      const c = mixRGB(pal[Math.floor(g)], pal[Math.min(3, Math.floor(g) + 1)], g - Math.floor(g));
      P.push({ sph, knot, h1: hash(i * 9.1), h2: hash(i * 2.2), col: `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` });
    }
    const F = 1000;
    const camZAt = (lt) => lerp(1150, -250, E.inExpo(prog(lt, 3 * B + 0.02, 4 * B)));
    function world(pt, lt) {
      const burst = E.outExpo(prog(lt, pt.h1 * 0.12, 0.6 + pt.h1 * 0.12));
      const m = E.inOutCubic(prog(lt, 0.5 + pt.h2 * 0.2, 0.88 + pt.h2 * 0.2));
      const pulse = 1 + 0.1 * Math.exp(-mod(lt, B) * 9);
      const s = burst * pulse;
      let x = lerp(pt.sph[0], pt.knot[0], m) * s, y = lerp(pt.sph[1], pt.knot[1], m) * s, z = lerp(pt.sph[2], pt.knot[2], m) * s;
      const ry = lt * 1.15, rx = 0.35 + Math.sin(lt * 1.3) * 0.2;
      const cy = Math.cos(ry), sy = Math.sin(ry);
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      const cx = Math.cos(rx), sx = Math.sin(rx);
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      return [x, y, z + camZAt(lt)];
    }

    return function (ctx, lt) {
      bg(ctx, C.ink);
      const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 800);
      g.addColorStop(0, rgba('ultra', 0.35)); g.addColorStop(1, rgba('ultra', 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // perspective floor grid, speeding up during the fly-through
      const fly = 1150 - camZAt(lt);
      const off = mod(lt * 520 + fly * 1.6, 160);
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 26; k++) {
        const zv = 160 + k * 160 - off;
        if (zv < 60) continue;
        const y = CY + (420 * F) / zv;
        ctx.strokeStyle = rgba('ultra', 0.7 * (1 - zv / 4200));
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let x = -4000; x <= 4000; x += 250) {
        ctx.strokeStyle = rgba('ultra', 0.45);
        ctx.beginPath(); ctx.moveTo(CX + (x * F) / 60, CY + (420 * F) / 60); ctx.lineTo(CX + (x * F) / 4200, CY + (420 * F) / 4200); ctx.stroke();
      }
      // horizon fade
      const hg = ctx.createLinearGradient(0, CY + 10, 0, CY + 260);
      hg.addColorStop(0, rgba('ink', 0)); hg.addColorStop(0.35, rgba('ink', 0.95)); hg.addColorStop(1, rgba('ink', 0));
      ctx.fillStyle = hg; ctx.fillRect(0, CY + 10, W, 250);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const dt = 1.6 / FPS;
      for (let i = 0; i < PN; i++) {
        const pt = P[i];
        const a = world(pt, lt), b = world(pt, lt - dt);
        if (a[2] < 20 || b[2] < 20) continue;
        const ax = CX + (a[0] * F) / a[2], ay = CY + (a[1] * F) / a[2];
        const bx = CX + (b[0] * F) / b[2], by = CY + (b[1] * F) / b[2];
        const size = Math.min(40, (4.2 * F) / a[2]);
        ctx.globalAlpha = clamp(1.6 - a[2] / 1400, 0.25, 1);
        ctx.strokeStyle = pt.col; ctx.lineWidth = size;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ax + 0.01, ay); ctx.stroke();
      }
      ctx.restore();
    };
  })();

  // ===================================================================== 05
  // CRAFT — the graph editor. The curve drives the square; ghosts show spacing.
  function S5(ctx, lt) {
    bg(ctx, C.paper);
    dotGrid(ctx, 48, rgba('ink', 0.07), 1.6);
    const card = (i) => { const d = i * 0.07; const p = E.outBack(prog(lt, d, d + 0.55), 1.3); return { dy: (1 - p) * 160, a: prog(lt, d, d + 0.2) }; };

    // CSS line
    font(ctx, 500, 26, FAM.mono);
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink;
    const code = 'transition: transform .9s cubic-bezier(.83, 0, .17, 1);';
    ctx.fillText(typeText(ctx, code, prog(lt, 0.15, 0.6)), 150, 160);

    // -- graph editor
    let c = card(0);
    ctx.save(); ctx.translate(0, c.dy); ctx.globalAlpha = c.a;
    ctx.fillStyle = C.ink; roundRect(ctx, 150, 200, 780, 680, 28); ctx.fill();
    font(ctx, 500, 18, FAM.mono); ctx.letterSpacing = '3px';
    ctx.fillStyle = rgba('paper', 0.5); ctx.fillText('GRAPH EDITOR', 190, 250);
    ctx.textAlign = 'right'; ctx.fillText('VALUE / TIME', 890, 250); ctx.textAlign = 'left';
    ctx.letterSpacing = '0px';
    const gx = 230, gy = 300, gw = 620, gh = 500;
    const M = (u, v) => [gx + u * gw, gy + gh - v * gh];
    ctx.strokeStyle = rgba('paper', 0.07); ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath(); ctx.moveTo(gx + (i * gw) / 10, gy); ctx.lineTo(gx + (i * gw) / 10, gy + gh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx, gy + (i * gh) / 10); ctx.lineTo(gx + gw, gy + (i * gh) / 10); ctx.stroke();
    }
    ctx.strokeStyle = rgba('paper', 0.3); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();

    // curve (drawn on)
    const cr = E.inOutCubic(prog(lt, 0.25, 0.75));
    ctx.strokeStyle = C.hot; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 200 * cr; i++) { const s = i / 200; const [x, y] = M(EZ.bx(s), EZ.by(s)); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    // bezier handles
    [[0, 0, 0.83, 0, 0.55], [1, 1, 0.17, 1, 0.62]].forEach(([u0, v0, u1, v1, d]) => {
      const p = E.outBack(prog(lt, d, d + 0.3), 2.5);
      if (p <= 0) return;
      const [x0, y0] = M(u0, v0), [x1, y1] = M(lerp(u0, u1, p), lerp(v0, v1, p));
      ctx.strokeStyle = rgba('paper', 0.6); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.strokeStyle = C.volt; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x1, y1, 11, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.PI / 4); ctx.fillStyle = C.volt; ctx.fillRect(-10, -10, 20, 20); ctx.restore();
    });
    // playhead
    const s = prog(lt, 0.8, 0.8 + 2 * B);
    const v = EZ(s);
    if (lt > 0.76) {
      const [px, py] = M(s, v);
      ctx.strokeStyle = rgba('volt', 0.8); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, gy); ctx.lineTo(px, gy + gh); ctx.stroke();
      ctx.setLineDash([4, 8]); ctx.strokeStyle = rgba('paper', 0.5);
      ctx.beginPath(); ctx.moveTo(gx, py); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
      const gl = ctx.createRadialGradient(px, py, 0, px, py, 50);
      gl.addColorStop(0, rgba('volt', 0.6)); gl.addColorStop(1, rgba('volt', 0));
      ctx.fillStyle = gl; ctx.fillRect(px - 50, py - 50, 100, 100);
      ctx.fillStyle = C.volt; ctx.beginPath(); ctx.arc(px, py, 10, 0, TAU); ctx.fill();
      font(ctx, 700, 20, FAM.mono); ctx.fillStyle = C.paper; ctx.textAlign = 'right';
      ctx.fillText(`t ${s.toFixed(2)}   v ${v.toFixed(2)}`, 890, 850); ctx.textAlign = 'left';
    }
    ctx.restore();

    // -- motion card
    c = card(1);
    ctx.save(); ctx.translate(0, c.dy); ctx.globalAlpha = c.a;
    ctx.fillStyle = rgba('ink', 0.08); roundRect(ctx, 998, 212, 780, 380, 28); ctx.fill();
    ctx.fillStyle = C.white; roundRect(ctx, 990, 200, 780, 380, 28); ctx.fill();
    font(ctx, 500, 18, FAM.mono); ctx.letterSpacing = '3px';
    ctx.fillStyle = rgba('ink', 0.45); ctx.fillText('MOTION  ·  ONION SKIN', 1030, 250); ctx.letterSpacing = '0px';
    const tx0 = 1080, tx1 = 1680, ty = 420;
    ctx.strokeStyle = rgba('ink', 0.15); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx0, ty + 70); ctx.lineTo(tx1, ty + 70); ctx.stroke();
    for (let k = 0; k <= 12; k++) {
      const sk = k / 12;
      if (sk > s + 1e-6 || lt < 0.8) continue;
      const x = lerp(tx0, tx1, EZ(sk));
      ctx.strokeStyle = rgba('ink', 0.28); ctx.lineWidth = 2;
      roundRect(ctx, x - 40, ty - 40, 80, 80, 14); ctx.stroke();
    }
    const sqx = lerp(tx0, tx1, v);
    ctx.save(); ctx.translate(sqx, ty); ctx.rotate(v * Math.PI);
    ctx.fillStyle = C.hot; roundRect(ctx, -45, -45, 90, 90, 16); ctx.fill();
    ctx.restore();
    ctx.restore();

    // -- spacing chart card
    c = card(2);
    ctx.save(); ctx.translate(0, c.dy); ctx.globalAlpha = c.a;
    ctx.fillStyle = C.ultra; roundRect(ctx, 990, 620, 780, 260, 28); ctx.fill();
    font(ctx, 500, 18, FAM.mono); ctx.letterSpacing = '3px';
    ctx.fillStyle = rgba('paper', 0.7); ctx.fillText('SPACING CHART', 1030, 668);
    ctx.textAlign = 'right'; ctx.fillText('SLOW IN · SLOW OUT', 1730, 668); ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
    const ly = 780;
    ctx.strokeStyle = rgba('paper', 0.5); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx0 - 30, ly); ctx.lineTo(tx1 + 30, ly); ctx.stroke();
    for (let k = 0; k <= 24; k++) {
      const sk = k / 24;
      const ap = prog(s, sk - 0.04, sk);
      if (ap <= 0 || lt < 0.8) continue;
      const x = lerp(tx0, tx1, EZ(sk)), hh = (k % 6 === 0 ? 36 : 20) * E.outBack(ap, 3);
      ctx.fillStyle = k % 6 === 0 ? C.volt : C.paper;
      ctx.fillRect(x - 2, ly - hh, 4, hh * 2);
    }
    ctx.restore();
  }

  // ===================================================================== 06
  // SIMULATION — metaballs, rendered as a scalar field.
  const S6 = (() => {
    const MW = 960, MH = 540, SC = W / MW;
    let cv = null, cx2 = null, img = null, mk = null, mkx = null, mimg = null, tx = null, txx = null;
    const BL = Array.from({ length: 7 }, (_, i) => ({
      ax: 0.7 + hash(i * 3.1) * 1.1, ay: 0.6 + hash(i * 5.7) * 1.2, px: hash(i * 9.2) * TAU, py: hash(i * 1.3) * TAU, r: 80 + hash(i * 2.9) * 70,
    }));
    const H0 = RGB.hot, P0 = RGB.pink, U0 = RGB.ultra;
    function blobs(lt) {
      const bp = 1 + 0.16 * Math.exp(-mod(lt, B) * 8);
      const c = E.inExpo(prog(lt, 1.35, 1.875));
      return BL.map((b) => {
        const x = CX + 600 * Math.sin(lt * b.ax + b.px), y = CY + 250 * Math.sin(lt * b.ay * 1.3 + b.py);
        const r = b.r * bp * (1 + c * 7);
        return { x: lerp(x, CX, c), y: lerp(y, CY, c), r, r2: r * r };
      });
    }
    return function (ctx, lt) {
      if (!cv) {
        cv = document.createElement('canvas'); cv.width = MW; cv.height = MH;
        cx2 = cv.getContext('2d'); img = cx2.createImageData(MW, MH);
        mk = document.createElement('canvas'); mk.width = MW; mk.height = MH;
        mkx = mk.getContext('2d'); mimg = mkx.createImageData(MW, MH);
        const ink = RGB.ink;
        for (let i = 0; i < mimg.data.length; i += 4) { mimg.data[i] = ink[0]; mimg.data[i + 1] = ink[1]; mimg.data[i + 2] = ink[2]; }
        tx = document.createElement('canvas'); tx.width = W; tx.height = H; txx = tx.getContext('2d');
      }
      bg(ctx, C.ink);
      const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1000);
      g.addColorStop(0, rgba('ultra', 0.25)); g.addColorStop(1, rgba('ultra', 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      const bl = blobs(lt), n = bl.length, d = img.data, md = mimg.data;
      const bx = bl.map((b) => b.x), by = bl.map((b) => b.y), br = bl.map((b) => b.r2);
      for (let py = 0; py < MH; py++) {
        const y = (py + 0.5) * SC;
        const wob = 0.12 * Math.sin((y / H) * 5 + lt * 2.5);
        for (let px = 0; px < MW; px++) {
          const x = (px + 0.5) * SC;
          let f = 0;
          for (let k = 0; k < n; k++) { const dx = x - bx[k], dy = y - by[k]; f += br[k] / (dx * dx + dy * dy + 1); }
          const idx = (py * MW + px) * 4;
          if (f < 0.97) { d[idx + 3] = 0; md[idx + 3] = 0; continue; }
          const a = smooth(0.98, 1.02, f);
          md[idx + 3] = a * 255;
          const gg = clamp((x / W) * 1.1 - 0.05 + wob);
          let c0 = gg < 0.5 ? mixRGB(H0, P0, gg * 2) : mixRGB(P0, U0, (gg - 0.5) * 2);
          const rim = smooth(1.0, 1.07, f) * (1 - smooth(1.07, 1.45, f));
          const core = smooth(2.5, 9, f) * 0.35;
          const l = Math.min(1, rim * 0.55 + core);
          d[idx] = c0[0] + (255 - c0[0]) * l;
          d[idx + 1] = c0[1] + (245 - c0[1]) * l;
          d[idx + 2] = c0[2] + (235 - c0[2]) * l;
          d[idx + 3] = a * 255;
        }
      }
      cx2.putImageData(img, 0, 0);
      mkx.putImageData(mimg, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(cv, 0, 0, W, H);
      // specular highlights
      for (const b of bl) {
        if (b.r > 400) continue;
        const hx = b.x - b.r * 0.3, hy = b.y - b.r * 0.38;
        const sg = ctx.createRadialGradient(hx, hy, 0, hx, hy, b.r * 0.35);
        sg.addColorStop(0, 'rgba(255,255,255,0.45)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg; ctx.fillRect(hx - b.r, hy - b.r, b.r * 2, b.r * 2);
      }

      // title: paper on the void, knocked out to ink wherever the liquid passes
      const size = fitSize(ctx, 'FLUID', 900, FAM.display, 1250, 360);
      txx.setTransform(1, 0, 0, 1, 0, 0);
      txx.globalCompositeOperation = 'source-over';
      txx.clearRect(0, 0, W, H);
      font(txx, 900, size, FAM.display);
      txx.fillStyle = C.paper;
      const ch = capHeight(txx);
      txx.save();
      txx.beginPath(); txx.rect(0, CY - ch / 2 - 30, W, ch + 60); txx.clip();
      drawLetters(txx, 'FLUID', CX, CY, (i) => {
        const p = E.outExpo(prog(lt, 0.05 + i * 0.05, 0.6 + i * 0.05));
        const q = E.inExpo(prog(lt, 1.35 + i * 0.03, 1.6 + i * 0.03));
        return { dy: (1 - p) * size - q * size };
      });
      txx.restore();
      txx.globalCompositeOperation = 'source-atop';
      txx.imageSmoothingEnabled = true; txx.imageSmoothingQuality = 'high';
      txx.drawImage(mk, 0, 0, W, H);
      txx.globalCompositeOperation = 'source-over';
      ctx.drawImage(tx, 0, 0);
      font(ctx, 900, size, FAM.display);
      font(ctx, 500, 24, FAM.mono);
      ctx.letterSpacing = '3px'; ctx.textAlign = 'center';
      ctx.fillStyle = rgba('paper', 0.7 * (1 - prog(lt, 1.3, 1.5)));
      typeCentered(ctx, 'f(p) = Σ r² / |p − c|²   ·   7 BODIES   ·   ISO 1.0', prog(lt, 0.3, 0.9), CX, CY + ch / 2 + 110);
      ctx.letterSpacing = '0px';
    };
  })();

  // ===================================================================== 07
  // RHYTHM / EDIT — cuts on eighth notes, glitch on every cut.
  const S7 = (() => {
    const CUTS = [
      { w: 'DESIGN', pat: 'tiles', bg: C.ink, fg: C.paper, acc: C.hot },
      { w: 'ANIMATE', pat: 'halftone', bg: C.ultra, fg: C.volt, acc: C.ink },
      { w: 'SIMULATE', pat: 'stripes', bg: C.hot, fg: C.ink, acc: C.paper },
      { w: 'COMPOSITE', pat: 'sunburst', bg: C.paper, fg: C.ultra, acc: C.hot },
      { w: 'GRADE', pat: 'halftone', bg: C.ink, fg: C.hot, acc: C.ultra },
      { w: 'RENDER', pat: 'tiles', bg: C.volt, fg: C.ink, acc: C.ultra },
    ];
    const pats = {
      tiles(ctx, t, col) {
        ctx.fillStyle = col; ctx.globalAlpha = 0.55;
        for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) {
          const x = 120 + i * 240, y = 108 + j * 216, s = 36 + 26 * Math.sin(t * 16 + i * 0.7 + j * 0.9);
          ctx.save(); ctx.translate(x, y); ctx.rotate(t * 5 + (i + j) * 0.4);
          const ty = (i + j) % 3;
          ctx.beginPath();
          if (ty === 0) ctx.arc(0, 0, s, 0, TAU);
          else if (ty === 1) ctx.rect(-s, -s, s * 2, s * 2);
          else { ctx.moveTo(0, -s * 1.2); ctx.lineTo(s * 1.1, s * 0.8); ctx.lineTo(-s * 1.1, s * 0.8); ctx.closePath(); }
          ctx.fill(); ctx.restore();
        }
        ctx.globalAlpha = 1;
      },
      halftone(ctx, t, col) {
        ctx.fillStyle = col; ctx.beginPath();
        for (let y = 20; y < H + 40; y += 40) for (let x = 20; x < W + 40; x += 40) {
          const dd = Math.hypot(x - CX, y - CY);
          const r = 2 + 15 * (0.5 + 0.5 * Math.sin(dd / 60 - t * 22));
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
      },
      stripes(ctx, t, col) {
        ctx.save(); ctx.translate(CX, CY); ctx.rotate(-0.45); ctx.fillStyle = col; ctx.globalAlpha = 0.4;
        const o = mod(t * 1400, 140);
        for (let x = -1600; x < 1600; x += 140) ctx.fillRect(x + o, -1200, 60, 2400);
        ctx.restore();
      },
      sunburst(ctx, t, col) {
        ctx.save(); ctx.translate(CX, CY); ctx.rotate(t * 2.5); ctx.fillStyle = col; ctx.globalAlpha = 0.35;
        for (let i = 0; i < 24; i += 2) {
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1400, (i / 24) * TAU, ((i + 1) / 24) * TAU); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      },
    };
    function word(ctx, text, sc, fg, acc, maxW) {
      const size = fitSize(ctx, text, 900, FAM.display, maxW, 300);
      font(ctx, 900, size, FAM.display);
      ctx.save(); ctx.translate(CX, CY); ctx.scale(sc, sc); ctx.translate(-CX, -CY);
      ctx.fillStyle = acc; drawLetters(ctx, text, CX + 12, CY + 12, () => ({}));
      ctx.fillStyle = fg; drawLetters(ctx, text, CX, CY, () => ({}));
      ctx.restore();
    }
    return function (ctx, lt) {
      const k = Math.floor(lt / (B / 2));
      if (k < 6) {
        const c = CUTS[k], wl = lt - k * (B / 2);
        bg(ctx, c.bg);
        pats[c.pat](ctx, lt, c.acc);
        word(ctx, c.w, 1 + 0.14 * (1 - E.outExpo(prog(wl, 0, 0.22))), c.fg, c.acc, 1500);
        // cut counter
        font(ctx, 700, 22, FAM.mono); ctx.textAlign = 'center'; ctx.fillStyle = c.fg;
        ctx.fillText(`CUT ${String(k + 1).padStart(2, '0')} / 07`, CX, CY + 230);
        return;
      }
      // final beat: 16th-note strobe + zoom into the logo
      const s16 = Math.floor((lt - 3 * B) / (B / 4));
      const inv = s16 % 2 === 1;
      const zp = prog(lt, 3 * B, 4 * B);
      bg(ctx, inv ? C.paper : C.ink);
      pats.sunburst(ctx, lt * 2, inv ? C.hot : C.ultra);
      word(ctx, 'SHIP IT', 1 + 1.8 * E.inExpo(zp), inv ? C.ink : C.volt, inv ? C.hot : C.ultra, 1500);
      font(ctx, 700, 22, FAM.mono); ctx.textAlign = 'center'; ctx.fillStyle = inv ? C.ink : C.paper;
      ctx.globalAlpha = 1 - zp;
      ctx.fillText('CUT 07 / 07', CX, CY + 230);
      ctx.globalAlpha = 1;
    };
  })();

  // ===================================================================== 08
  // IDENTITY — modular mark assembles, name resolves.
  function S8(ctx, lt) {
    bg(ctx, C.ink);
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1100);
    g.addColorStop(0, rgba('ultra', 0.28)); g.addColorStop(1, rgba('ultra', 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // drifting dust
    for (let i = 0; i < 60; i++) {
      const x = hash(i * 7.7) * W, y = mod(hash(i * 3.3) * H - lt * (20 + hash(i) * 40), H);
      ctx.fillStyle = rgba('paper', 0.08 + 0.12 * hash(i * 1.9));
      ctx.beginPath(); ctx.arc(x, y, 1 + 2 * hash(i * 4.4), 0, TAU); ctx.fill();
    }

    const name = 'CLAUDE';
    font(ctx, 900, 164, FAM.display);
    const tw = ctx.measureText(name).width, ch = capHeight(ctx);
    const cell = 106, gap = 14, mk = cell * 2 + gap, gapT = 60;
    const x0 = CX - (mk + gapT + tw) / 2, mTop = CY - mk / 2 - 30;

    // big slow ring behind the mark
    ctx.save();
    ctx.translate(x0 + mk / 2, mTop + mk / 2); ctx.rotate(lt * 0.25);
    ctx.setLineDash([3, 16]); ctx.strokeStyle = rgba('paper', 0.18 * prog(lt, 0.2, 0.6)); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 250 + 30 * E.outExpo(prog(lt, 0.2, 1)), 0, TAU); ctx.stroke();
    ctx.restore();

    const cells = [
      { i: 0, j: 0, from: [-900, -700], draw: (s) => { ctx.fillStyle = C.hot; ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, TAU); ctx.fill(); } },
      { i: 1, j: 0, from: [1300, -800], draw: (s) => { ctx.fillStyle = C.ultra; roundRect(ctx, -s / 2, -s / 2, s, s, 8); ctx.fill(); } },
      { i: 0, j: 1, from: [-1100, 900], draw: (s) => { ctx.fillStyle = C.volt; ctx.beginPath(); ctx.moveTo(-s / 2, s / 2); ctx.lineTo(s / 2, s / 2); ctx.lineTo(-s / 2, -s / 2); ctx.closePath(); ctx.fill(); } },
      { i: 1, j: 1, from: [1200, 800], draw: (s) => { ctx.fillStyle = C.paper; ctx.beginPath(); ctx.moveTo(-s / 2, -s / 2); ctx.arc(-s / 2, -s / 2, s, 0, Math.PI / 2); ctx.closePath(); ctx.fill(); } },
    ];
    cells.forEach((c, k) => {
      const p = E.spring(lt - 0.02 - k * 0.05, 1.5, 7.5);
      const tx = x0 + c.i * (cell + gap) + cell / 2, ty = mTop + c.j * (cell + gap) + cell / 2;
      const x = lerp(tx + c.from[0], tx, p), y = lerp(ty + c.from[1], ty, p);
      let rot = (1 - p) * Math.PI * 1.5;
      // secondary animation on the beats: holds are never dead
      if (k === 3) rot += E.outBack(prog(lt, 2 * B, 2 * B + 0.35), 2) * (Math.PI / 2);
      if (k === 1) rot += E.outBack(prog(lt, 2.5 * B, 2.5 * B + 0.35), 2) * (Math.PI / 2);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      c.draw(cell);
      ctx.restore();
    });

    // name, revealed from behind the mark
    const nx = x0 + mk + gapT;
    ctx.save();
    ctx.beginPath(); ctx.rect(nx - 10, mTop - 60, W, mk + 120); ctx.clip();
    ctx.fillStyle = C.paper; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    font(ctx, 900, 164, FAM.display);
    const L = layout(ctx, name);
    const nb = mTop + ch + 2;
    L.letters.forEach((l, i) => {
      const p = E.outExpo(prog(lt, 0.3 + i * 0.045, 0.95 + i * 0.045));
      ctx.globalAlpha = p;
      ctx.textAlign = 'center';
      ctx.fillText(l.ch, nx + l.x - (1 - p) * 180, nb);
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    // underline + title
    const ul = E.inOutExpo(prog(lt, 0.55, 1.05));
    ctx.fillStyle = C.hot; ctx.fillRect(nx, nb + 30, tw * ul, 8);
    font(ctx, 500, 30, FAM.mono); ctx.letterSpacing = '6px'; ctx.textAlign = 'left';
    ctx.fillStyle = C.paper;
    ctx.fillText(typeText(ctx, 'MOTION DESIGNER', prog(lt, 0.65, 0.95)), nx, mTop + mk - 4);
    ctx.fillStyle = rgba('paper', 0.5);
    ctx.fillText(typeText(ctx, 'SHOWREEL 2026', prog(lt, 0.8, 1.05)), nx + 440, mTop + mk - 4);
    ctx.letterSpacing = '0px';

    // stats
    const stats = [['900', 'FRAMES', C.hot], ['0', 'KEYFRAMES', C.volt], ['100%', 'CODE', C.ultra]];
    font(ctx, 700, 22, FAM.mono);
    let sx = x0;
    const sy = mTop + mk + 120;
    stats.forEach(([n, l, col], i) => {
      const p = E.outCubic(prog(lt, 1.0 + i * 0.09, 1.35 + i * 0.09));
      ctx.globalAlpha = p;
      ctx.fillStyle = col; ctx.fillRect(sx, sy - 16 + (1 - p) * 20, 14, 14);
      ctx.fillStyle = C.paper; ctx.letterSpacing = '3px';
      const label = `${n} ${l}`;
      ctx.fillText(label, sx + 28, sy - 2 + (1 - p) * 20);
      sx += ctx.measureText(label).width + 90;
      ctx.letterSpacing = '0px';
    });
    ctx.globalAlpha = 1;
  }

  // ================================================================ timeline
  const WHIP_A = 5 * BAR - 0.16, WHIP_B = 5 * BAR + 0.16;
  const SHAKES = [[B, 5], [2 * B, 7], [3 * B, 12], [BAR, 20], [2 * BAR, 8], [3 * BAR, 14], [4 * BAR, 10], [6 * BAR, 14],
    [6 * BAR + 3 * B, 3, 1], [7 * BAR, 34, 7]];
  const CHROMA = [[BAR, 6], [3 * BAR, 6], [4 * BAR, 10], [5 * BAR, 9, 14], [7 * BAR, 16, 5]];
  for (let k = 0; k < 6; k++) CHROMA.push([6 * BAR + (k * B) / 2, 7, 16]);
  for (let k = 0; k < 4; k++) CHROMA.push([6 * BAR + 3 * B + (k * B) / 4, 5 + k * 3, 16]);
  const FLASH = [[BAR, 0.35, 14], [3 * BAR, 0.4, 12], [6 * BAR, 0.5, 18], [7 * BAR, 0.95, 9]];

  function renderScene(ctx, t) {
    ctx.save();
    const sh = impulse(t, SHAKES) + (t > 6 * BAR + 3 * B && t < 7 * BAR ? 10 * prog(t, 6 * BAR + 3 * B, 7 * BAR) : 0);
    if (sh > 0.05) ctx.translate((vnoise(t * 38) - 0.5) * 2 * sh, (vnoise(t * 38 + 71.3) - 0.5) * 2 * sh);
    if (t < BAR) S1(ctx, t);
    else if (t < 2 * BAR) S2(ctx, t - BAR);
    else if (t < 3 * BAR) S3(ctx, t - 2 * BAR);
    else if (t < 4 * BAR) S4(ctx, t - 3 * BAR);
    else if (t < WHIP_A) S5(ctx, t - 4 * BAR);
    else if (t < WHIP_B) {
      const p = E.inOutQuint(prog(t, WHIP_A, WHIP_B));
      ctx.save(); ctx.translate(-W * 1.05 * p, 0); S5(ctx, t - 4 * BAR); ctx.restore();
      ctx.save(); ctx.translate(W * 1.05 * (1 - p), 0); S6(ctx, t - 5 * BAR); ctx.restore();
    }
    else if (t < 6 * BAR) S6(ctx, t - 5 * BAR);
    else if (t < 7 * BAR) S7(ctx, t - 6 * BAR);
    else S8(ctx, t - 7 * BAR);
    ctx.restore();
  }

  // ------------------------------------------------------------------- post
  let buf = null;
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function buffers() {
    if (buf) return buf;
    buf = { scene: canvas(W, H), acc: canvas(W, H), tmp: canvas(W, H), tmp2: canvas(W, H), vig: canvas(W, H), grain: [] };
    for (const k of ['scene', 'acc', 'tmp', 'tmp2', 'vig']) buf[k + 'X'] = buf[k].getContext('2d');
    const v = buf.vigX;
    const vg = v.createRadialGradient(CX, CY, W * 0.3, CX, CY, W * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    v.fillStyle = vg; v.fillRect(0, 0, W, H);
    // deterministic film grain tiles
    let seed = 1337;
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let k = 0; k < 6; k++) {
      const c = canvas(512, 512), x = c.getContext('2d'), id = x.createImageData(512, 512);
      for (let i = 0; i < id.data.length; i += 4) {
        const n = (rnd() + rnd() + rnd()) / 3;
        const g = 128 + (n - 0.5) * 255;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = g; id.data[i + 3] = 255;
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

  function hud(ctx, t) {
    const a = E.outCubic(prog(t, 0.1, 0.6));
    const f = Math.min(DUR * FPS - 1, Math.floor(t * FPS + 1e-6));
    const si = Math.min(7, Math.floor(t / BAR)), lt = t - si * BAR;
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.globalAlpha = 0.85 * a;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    // crop marks
    const m = 44, l = 30;
    ctx.beginPath();
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.moveTo(x + dx * l, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * l);
    });
    ctx.stroke();
    font(ctx, 700, 17, FAM.mono); ctx.letterSpacing = '3px'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('CLAUDE  ✦  MOTION REEL ’26', 90, 76);
    ctx.textAlign = 'right';
    const ss = Math.floor(f / FPS), ff = f % FPS;
    ctx.fillText(`TC 00:00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`, W - 90, 76);
    // scene label with decode effect
    ctx.textAlign = 'left';
    const label = `${String(si + 1).padStart(2, '0')} — ${SCENES[si]}`;
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>';
    let out = '';
    for (let i = 0; i < label.length; i++) {
      const settled = lt > 0.04 + i * 0.012 || si === 0;
      out += settled || label[i] === ' ' ? label[i] : glyphs[Math.floor(hash(i * 13 + Math.floor(t * 40)) * glyphs.length)];
    }
    ctx.fillText(out, 90, H - 76);
    ctx.textAlign = 'right';
    ctx.fillText(`F ${String(f).padStart(4, '0')} / 0900`, W - 90, H - 76);
    // timeline strip
    const tx0 = 640, tx1 = 1280, ty = H - 76;
    for (let k = 0; k < 8; k++) {
      const x = lerp(tx0, tx1, k / 8) + 3, w = (tx1 - tx0) / 8 - 6;
      ctx.globalAlpha = 0.85 * a * (k === si ? 1 : 0.3);
      ctx.fillRect(x, ty - (k === si ? 3 : 1), w, k === si ? 6 : 2);
    }
    ctx.globalAlpha = 0.85 * a;
    const px = lerp(tx0, tx1, t / DUR);
    ctx.fillRect(px - 1, ty - 12, 2, 24);
    ctx.restore();
  }

  function render(out, t, opt = {}) {
    const b = buffers();
    const n = opt.subframes || 1, shutter = opt.shutter ?? 0.5;
    for (let s = 0; s < n; s++) {
      const ts = n > 1 ? t + ((s + 0.5) / n - 0.5) * (shutter / FPS) : t;
      const x = b.sceneX;
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      renderScene(x, clamp(ts, 0, DUR - 1e-6));
      b.accX.globalAlpha = 1 / (s + 1);
      b.accX.drawImage(b.scene, 0, 0);
    }
    b.accX.globalAlpha = 1;

    const ca = impulse(t, CHROMA);
    if (ca > 0.4) chroma(out, b.acc, ca); else out.drawImage(b.acc, 0, 0);

    // slice glitch right after each montage cut
    const cutT = [];
    for (let k = 0; k < 6; k++) cutT.push(6 * BAR + (k * B) / 2);
    cutT.push(5 * BAR, 7 * BAR);
    for (const c0 of cutT) {
      const d = t - c0;
      if (d >= 0 && d < 0.07) {
        b.tmp2X.drawImage(out.canvas, 0, 0);
        const amt = 160 * (1 - d / 0.07), seed = Math.floor(c0 * 100) + Math.floor(t * 60);
        for (let k = 0; k < 9; k++) {
          const y = hash(seed + k * 1.3) * H, h = 8 + hash(seed + k * 2.1) * 90, dx = (hash(seed + k * 3.7) - 0.5) * 2 * amt;
          out.drawImage(b.tmp2, 0, y, W, h, dx, y, W, h);
        }
      }
    }

    // flashes (the 7.5s one ramps up into the white of the next scene)
    let fl = impulse(t, FLASH);
    fl += E.inExpo(prog(t, 4 * BAR - 0.16, 4 * BAR)) * (t < 4 * BAR ? 1 : 0);
    fl += t >= 4 * BAR ? 0.9 * Math.exp(-(t - 4 * BAR) * 12) : 0;
    if (fl > 0.003) { out.fillStyle = `rgba(255,255,255,${Math.min(1, fl)})`; out.fillRect(0, 0, W, H); }

    out.drawImage(b.vig, 0, 0);
    hud(out, t);

    if (opt.grain !== false) {
      const f = Math.floor(t * FPS);
      out.save();
      out.globalCompositeOperation = 'overlay';
      out.globalAlpha = 0.09;
      const pat = out.createPattern(b.grain[f % 6], 'repeat');
      out.translate(-Math.floor(hash(f) * 512), -Math.floor(hash(f + 0.5) * 512));
      out.fillStyle = pat; out.fillRect(0, 0, W + 512, H + 512);
      out.restore();
    }
  }

  window.Reel = { W, H, FPS, DUR, BPM, B, BAR, render, SCENES };
})();
