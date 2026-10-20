// Shot 8, "just a browser": the real MeshCentral web UI (captured from a live server) on two cards,
// a browser window and a phone. The frames are drawn once; the phone's row highlight is redrawn per frame.
import * as G from '../lib/gl.js';
import * as M from '../lib/motion.js';

const { THREE } = G;
const { springU, springKeys, SPRING, E, clamp, lerp, rrect } = M;

const ACC = '#E1AF31';

export function screensSet(IMG) {
  const scene = new THREE.Scene();
  const cam = G.camera(34, 0.1, 200);
  scene.environment = G.ENV;
  G.keyLights(scene, { key: 1.8, rim: 1.6, fill: 0.5 });

  // ---- browser card: chrome bar + the desktop device list, 16:10.6
  const bw = 2048, bh = 1360;
  const btex = G.canvasTexture(bw, bh);
  btex.draw((c, w, h) => {
    rrect(c, 0, 0, w, h, 44); c.fillStyle = '#E9E6DF'; c.fill();
    c.save(); rrect(c, 0, 0, w, h, 44); c.clip();
    // chrome bar
    c.fillStyle = '#D9D5CC'; c.fillRect(0, 0, w, 96);
    ['#E36A5D', '#E1AF31', '#7BB661'].forEach((f, i) => { c.beginPath(); c.arc(56 + i * 46, 48, 15, 0, 7); c.fillStyle = f; c.fill(); });
    rrect(c, 230, 20, 1100, 56, 28); c.fillStyle = '#F7F5F0'; c.fill();
    // lock: a shackle and a body
    c.strokeStyle = '#3A4256'; c.lineWidth = 5; c.beginPath(); c.arc(276, 44, 9, Math.PI, 0); c.stroke();
    c.fillStyle = '#3A4256'; c.fillRect(263, 44, 26, 20);
    c.font = '700 30px UI'; c.fillStyle = '#3A4256'; c.textBaseline = 'middle'; c.fillText('https://your-server', 304, 49);
    c.drawImage(IMG.devicesDesktop, 0, 96, w, (w * IMG.devicesDesktop.height) / IMG.devicesDesktop.width);
    c.restore();
  });
  const browser = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4 * (bh / bw)), new THREE.MeshBasicMaterial({ map: btex, transparent: true, toneMapped: false }));
  const browserBack = new THREE.Mesh(new THREE.BoxGeometry(6.44, 6.44 * (bh / bw), 0.08), new THREE.MeshStandardMaterial({ color: 0x0e1424, roughness: 0.6 }));
  browserBack.position.z = -0.05;
  const bGroup = new THREE.Group();
  bGroup.add(browserBack, browser);
  scene.add(bGroup);

  // ---- phone: bezel + the mobile device list; a highlight walks down the device rows
  const pw = 900, ph = 1900;
  const ptex = G.canvasTexture(pw, ph);
  const shot = IMG.devicesMobile;                       // 824 x 1740 (412 x 870 css px @2x)
  const sx = 38, sy = 80, sw = 824, sh = 1740;
  const rows = [];                                     // device row tops in css px (from the capture)
  for (const y0 of [76, 130, 186, 240]) rows.push(y0);
  for (let i = 0; i < 8; i++) rows.push(321 + i * 55);
  const drawPhone = (hi) => ptex.draw((c, w, h) => {
    rrect(c, 4, 4, w - 8, h - 8, 110); c.fillStyle = '#0B0F18'; c.fill();
    rrect(c, 4, 4, w - 8, h - 8, 110); c.lineWidth = 6; c.strokeStyle = '#3A4256'; c.stroke();
    c.save(); rrect(c, sx, sy, sw, sh, 40); c.clip();
    c.drawImage(shot, sx, sy, sw, sh);
    if (hi >= 0) {
      const r = rows[Math.min(rows.length - 1, hi)];
      c.lineWidth = 8; c.strokeStyle = ACC;
      rrect(c, sx + 4, sy + r * 2 - 4, sw - 8, 104, 16); c.stroke();
      c.fillStyle = 'rgba(225,175,49,0.18)'; c.fill();
    }
    c.restore();
    rrect(c, w / 2 - 90, 34, 180, 26, 13); c.fillStyle = '#1C2333'; c.fill();
  });
  drawPhone(-1);
  let lastHi = -2;
  const phone = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2 * (ph / pw)), new THREE.MeshBasicMaterial({ map: ptex, transparent: true, toneMapped: false }));
  const phoneBody = new THREE.Mesh(new THREE.BoxGeometry(2.16, 2.16 * (ph / pw), 0.16), new THREE.MeshPhysicalMaterial({ color: 0x1a2030, metalness: 0.7, roughness: 0.3, clearcoat: 1 }));
  phoneBody.position.z = -0.09;
  const pGroup = new THREE.Group();
  pGroup.add(phoneBody, phone);
  scene.add(pGroup);

  return {
    scene, camera: cam,
    update(t, u, o = {}) {
      // browser swings in, drifts across the device grid
      const k = springU(u, 71.3, { stiffness: 140, damping: 16 });
      bGroup.position.set(lerp(-7, 0.3, k), lerp(-2.9, -0.75, k), 0);
      bGroup.rotation.set(lerp(0.5, 0.08, k), lerp(-1.3, -0.32, k) + (u - 72) * 0.012, lerp(0.2, 0.02, k));
      // "just a browser": push toward the address bar
      const pushK = springU(u, 78.3, SPRING.gentle);
      // phone slides in over the browser for "every company system"
      const pk = springU(u, 80.3, { stiffness: 150, damping: 17 });
      pGroup.position.set(lerp(6, 1.0, pk), lerp(-6, -2.2, pk), lerp(1, 1.6, pk));
      pGroup.rotation.set(lerp(0.4, 0.04, pk), lerp(0.9, -0.18, pk) + (o.turn || 0) * Math.PI, lerp(-0.3, 0.04, pk));
      pGroup.visible = pk > 0.001;
      // the highlight walks down the rows once the phone has landed
      const hi = u < 82 ? -1 : Math.floor((u - 82) * 2.2);
      if (hi !== lastHi) { drawPhone(hi); lastHi = hi; }
      // camera
      const pos = springKeys(u, [[71, [0, 0.9, 14.5]], [78.3, [-0.9, 1.5, 10.5]], [80.3, [0.4, 0.4, 13.0]]], SPRING.gentle);
      const tgt = springKeys(u, [[71, [0.2, 0.6, 0]], [78.3, [-1.3, 1.0, 0]], [80.3, [0.5, 0.2, 0]]], SPRING.gentle);
      G.lookFrom(cam, pos.map((v, i) => v + [0, 0, -0.6][i] * pushK * (1 - pk)), tgt, -0.02);
    },
  };
}
