// Persian kinetic type on the film canvas. Lines are laid out right to left, word by word (Persian
// letters join inside a word, so a word is the smallest unit that can move on its own). Each word rises
// out of a mask at its spoken time; the whole super leaves together.
//
//   const S = phrase(['هنوز برای وصل شدن', 'به سیستم کارمندات'], 0.6, 6.4, { accent: ['کارمندات'] });
//   supers(ctx, u, S, { x: 930, y: 420, size: 84, out: 6.6 });
import * as M from './motion.js';

const { font, springU, SPRING, clamp, E } = M;
const cache = new Map();

function measure(ctx, str, f) {
  const k = `${f}|${str}`;
  if (cache.has(k)) return cache.get(k);
  ctx.font = f;
  const m = ctx.measureText(str);
  const r = { w: m.width, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
  cache.set(k, r);
  return r;
}
const latin = (w) => /^[\x20-\x7E\u00A0-\u00FF]+$/.test(w);

// A phrase spoken between beats u0..u1: word times spread by character count (the eye leads by 0.1 beat).
export function phrase(lines, u0, u1, { accent = [], lead = 0.12 } = {}) {
  const words = lines.map((l) => l.split(' '));
  const total = words.flat().reduce((a, w) => a + w.length + 1, 0);
  let acc = 0;
  return words.map((ws) => ws.map((w) => {
    const at = u0 + ((u1 - u0) * acc) / total - lead;
    acc += w.length + 1;
    return { w, at, accent: accent.includes(w) };
  }));
}

// Draw a phrase. opts: x (right edge), y (first baseline), size, weight, lineH, out (beat it leaves),
// color, accentColor, align ('right' | 'center'), shadow (soft dark halo for busy grounds), style:
//   'rise'    each word rises from below its line's mask (default)
//   'stamp'   each word lands scaled up, no mask
//   'flicker' the words drop out wherever opts.gate(u, i) says the connection is down
export function supers(ctx, u, lines, o = {}) {
  const size = o.size ?? 84, weight = o.weight ?? 800;
  const f = font(size, weight, 'Display');
  const lineH = o.lineH ?? size * 1.32;
  const color = o.color ?? '#F3EFE6', accentColor = o.accentColor ?? '#E1AF31';
  const style = o.style ?? 'rise';
  const out = o.out ?? Infinity;
  const exitK = u > out ? E.inCubic(clamp((u - out) / (o.exitDur ?? 0.42))) : 0;
  if (exitK >= 1) return;
  const space = measure(ctx, ' ', f).w;
  lines.forEach((ws, li) => {
    const widths = ws.map((w) => measure(ctx, w.w, f).w);
    const lineW = widths.reduce((a, b) => a + b, 0) + space * (ws.length - 1);
    const right = o.align === 'center' ? (o.x ?? M.W / 2) + lineW / 2 : (o.x ?? 930);
    const base = (o.y ?? 400) + li * lineH;
    const top = base - size * 1.05, bot = base + size * 0.62;
    let x = right;
    ws.forEach((wd, wi) => {
      const ww = widths[wi];
      const k = style === 'stamp' ? springU(u, wd.at, SPRING.bouncy) : springU(u, wd.at, { stiffness: 260, damping: 22 });
      x -= 0;
      const xr = x;
      x -= ww + space;
      if (k <= 0.001) return;
      if (style === 'flicker' && o.gate && o.gate(u, li * 10 + wi)) return;
      ctx.save();
      if (style === 'rise' || style === 'flicker') {
        ctx.beginPath(); ctx.rect(xr - ww - 40, top - 30, ww + 80, bot - top + 30); ctx.clip();
        ctx.translate(0, (1 - k) * size * 1.25 - exitK * size * 1.5);
      } else {
        const s = 1 + (1 - k) * 0.6;
        ctx.translate(xr - ww / 2, base - size * 0.3); ctx.scale(s, s); ctx.translate(-(xr - ww / 2), -(base - size * 0.3));
        ctx.globalAlpha = clamp(k * 3) * (1 - exitK);
        ctx.translate(0, -exitK * size * 0.6);
      }
      ctx.font = f;
      ctx.direction = latin(wd.w) ? 'ltr' : 'rtl';
      ctx.textAlign = 'right';
      if (latin(wd.w)) { ctx.direction = 'ltr'; ctx.textAlign = 'right'; }
      if (o.shadow) { ctx.shadowColor = 'rgba(5,8,16,0.85)'; ctx.shadowBlur = size * 0.45; }
      ctx.fillStyle = wd.accent ? accentColor : color;
      ctx.fillText(wd.w, xr, base);
      ctx.restore();
    });
  });
  ctx.direction = 'ltr';
}

// One line, drawn plainly (labels, end card). Persian unless it is all Latin.
export function line(ctx, str, x, y, size, weight, color, align = 'right', family = 'Display', track = 0) {
  ctx.save();
  ctx.font = font(size, weight, family);
  ctx.direction = latin(str) ? 'ltr' : 'rtl';
  ctx.textAlign = align;
  ctx.letterSpacing = `${track}px`;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}
export const width = (ctx, str, size, weight, family = 'Display') => measure(ctx, str, font(size, weight, family)).w;
