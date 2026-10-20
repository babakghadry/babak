// Shot 9, "behind the scenes": an employee's monitor, working and untouched, and behind it the admin's
// side: a terminal and a file browser. The camera orbits from the front of the monitor to its back.
// The panels are graphics (mono type on dark), not MeshCentral screens: no product chrome is drawn.
import * as G from '../lib/gl.js';
import * as M from '../lib/motion.js';

const { THREE } = G;
const { springU, SPRING, E, clamp, lerp, rrect, hash01 } = M;

const ACC = '#E1AF31', PAPER = '#F3EFE6';

// the fix: a stopped print spooler on Accounting-01, restarted from the terminal
const TERM = [
  ['PS C:\\> ', 'Get-Service Spooler', 0],
  ['', 'Status   Name', 1],
  ['', 'Stopped  Spooler', 1],
  ['PS C:\\> ', 'Restart-Service Spooler', 0],
  ['PS C:\\> ', 'Get-Service Spooler', 0],
  ['', 'Status   Name', 1],
  ['', 'Running  Spooler', 2],
];
const FILES = ['Desktop', 'Documents', 'Downloads', 'invoice-0721.pdf', 'payroll.xlsx', 'printer-log.txt'];

export function backstageSet() {
  const scene = new THREE.Scene();
  const cam = G.camera(34, 0.1, 200);
  scene.environment = G.ENV;
  G.keyLights(scene, { key: 2.0, rim: 2.4, fill: 0.35, rimColor: 0xe1af31 });

  // ---- the employee's monitor (front): a document being written, a cursor, nothing else
  const mon = new THREE.Group();
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.8, 0.22), new THREE.MeshPhysicalMaterial({ color: 0x1a2030, metalness: 0.6, roughness: 0.35, clearcoat: 0.8 }));
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 0.3), bezel.material);
  stand.position.set(0, -1.9, -0.1);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.9), bezel.material);
  foot.position.set(0, -2.5, 0);
  const ftex = G.canvasTexture(1024, 640);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 2.56), new THREE.MeshBasicMaterial({ map: ftex, toneMapped: false }));
  front.position.z = 0.115;
  mon.add(bezel, stand, foot, front);
  scene.add(mon);

  // ---- the admin's panels, floating behind the monitor and facing backwards
  const ttex = G.canvasTexture(1100, 760);
  const term = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.28), new THREE.MeshBasicMaterial({ map: ttex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  const xtex = G.canvasTexture(760, 760);
  const files = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshBasicMaterial({ map: xtex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  term.rotation.y = Math.PI; files.rotation.y = Math.PI;
  scene.add(term, files);

  const drawFront = (u) => ftex.draw((c, w, h) => {
    c.fillStyle = '#E9ECF2'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#C9D1DE'; c.fillRect(0, 0, w, 44);
    c.fillStyle = '#FFFFFF'; c.fillRect(150, 70, w - 300, h - 70);
    // lines of text being typed: grey bars that grow
    const typed = (u - 86) * 9;                          // bar-units typed so far
    let left = typed;
    for (let i = 0; i < 12; i++) {
      const len = 0.5 + 0.45 * hash01(i, 31);
      const full = (w - 380) * len;
      const k = clamp(left / 8);
      left -= 8;
      if (k <= 0) break;
      c.fillStyle = '#AEB7C6';
      rrect(c, w - 190 - full * k, 110 + i * 40, full * k, 14, 7); c.fill();
      if (k < 1 && Math.floor(u * 4) % 2 === 0) { c.fillStyle = '#2B3448'; c.fillRect(w - 194 - full * k, 104 + i * 40, 4, 26); }
    }
  });
  const drawTerm = (u) => ttex.draw((c, w, h) => {
    rrect(c, 0, 0, w, h, 26); c.fillStyle = 'rgba(8,12,22,0.94)'; c.fill();
    rrect(c, 0, 0, w, h, 26); c.lineWidth = 3; c.strokeStyle = 'rgba(243,239,230,0.25)'; c.stroke();
    c.font = '700 26px UI'; c.fillStyle = 'rgba(243,239,230,0.55)'; c.fillText('terminal · Accounting-01', 30, 46);
    c.fillStyle = 'rgba(243,239,230,0.12)'; c.fillRect(0, 66, w, 2);
    // lines arrive on the grid: a typed command takes 1.4 beats, output lines pop
    let at = 95.2;
    c.font = '700 42px UI';
    TERM.forEach(([pr, txt, kind], i) => {
      const y = 132 + i * 84;
      if (u < at) { at += kind === 0 ? 1.6 : 0.5; return; }
      const n = kind === 0 ? Math.floor(clamp((u - at) / 1.4) * txt.length) : txt.length;
      c.fillStyle = ACC; c.fillText(pr, 30, y);
      const px = 30 + c.measureText(pr).width;
      c.fillStyle = kind === 2 ? ACC : kind === 1 ? 'rgba(243,239,230,0.7)' : PAPER;
      c.fillText(txt.slice(0, n), px, y);
      if (kind === 0 && n < txt.length && Math.floor(u * 4) % 2 === 0) c.fillRect(px + c.measureText(txt.slice(0, n)).width + 2, y - 34, 22, 42);
      at += kind === 0 ? 1.6 : 0.5;
    });
  });
  const drawFiles = (u) => xtex.draw((c, w, h) => {
    rrect(c, 0, 0, w, h, 26); c.fillStyle = 'rgba(8,12,22,0.94)'; c.fill();
    rrect(c, 0, 0, w, h, 26); c.lineWidth = 3; c.strokeStyle = 'rgba(243,239,230,0.25)'; c.stroke();
    c.font = '700 26px UI'; c.fillStyle = 'rgba(243,239,230,0.55)'; c.fillText('files · C:\\Users\\accounting', 30, 46);
    c.fillStyle = 'rgba(243,239,230,0.12)'; c.fillRect(0, 66, w, 2);
    c.font = '700 32px UI';
    FILES.forEach((f, i) => {
      const k = springU(u, 94.6 + i * 0.25, SPRING.snappy);
      if (k <= 0) return;
      const y = 120 + i * 96;
      c.save(); c.globalAlpha = clamp(k); c.translate((1 - k) * 60, 0);
      const folder = i < 3;
      // folder: a tab and a body; file: a page with a folded corner
      c.fillStyle = folder ? ACC : 'rgba(243,239,230,0.8)';
      if (folder) { c.fillRect(34, y - 30, 22, 8); rrect(c, 34, y - 24, 52, 36, 5); c.fill(); }
      else { c.beginPath(); c.moveTo(40, y - 34); c.lineTo(66, y - 34); c.lineTo(80, y - 20); c.lineTo(80, y + 14); c.lineTo(40, y + 14); c.closePath(); c.fill(); }
      c.fillStyle = PAPER; c.fillText(f, 108, y);
      c.restore();
    });
  });

  return {
    scene, camera: cam,
    update(t, u, o = {}) {
      drawFront(u); drawTerm(u); drawFiles(u);
      // panels sit behind the monitor, slightly apart, facing -z
      const pk = springU(u, 94.2, SPRING.gentle);
      term.position.set(lerp(0.1, 0.05, pk), lerp(0.2, 0.62, pk), lerp(-0.6, -2.3, pk));
      files.position.set(lerp(-0.2, -0.55, pk), lerp(-0.3, -1.72, pk), lerp(-0.7, -1.85, pk));
      files.rotation.y = Math.PI + 0.12 * pk;
      term.rotation.y = Math.PI - 0.06 * pk;
      // orbit: front (a = 0) to back (a = pi), a gentle spring from beat 94.4
      const ok = springU(u, 94.0, { stiffness: 70, damping: 15 });
      const a = 0.25 + ok * (Math.PI - 0.45) + (u - 88) * 0.008;
      const r = lerp(12.8, 14.5, Math.sin(ok * Math.PI)) - ok * 0.6;
      const y = 0.2 + Math.sin(ok * Math.PI) * 2.4;
      const tgt = [lerp(0, 0.05, ok), lerp(-0.9, 0.2, ok), lerp(0, -2.0, ok)];
      G.lookFrom(cam, [Math.sin(a) * r + tgt[0], y, Math.cos(a) * r + tgt[2]], tgt, 0.02 * Math.sin(u * 0.3));
    },
  };
}
