// The network as a place: a grid floor, the company's 24 monitors, and what they connect through.
// One set, four states, chosen by opts.mode, so the problem and the answer happen in the same room:
//   'outage'  links out to the world flicker with the outage gate (the same pattern chops the music)
//   'foreign' one long link over a border to a relay rack far away; packets crawl along it
//   'own'     the far link is gone; a server drops into the middle and the monitors form a ring around it
//   'secure'  a dome of hex tiles closes over the ring
// No bloom pass (software WebGL): glow is additive halo cards. update() sets everything from (u, opts).
import * as G from '../lib/gl.js';
import * as M from '../lib/motion.js';

const { THREE } = G;
const { springU, springKeys, SPRING, hash01, clamp, E, lerp, kf } = M;

const INK = 0x0a0f1c, ACC = 0xe1af31;
const N_MON = 24;

// a soft radial falloff, white in the middle: tinted by material / instance colour, added on top
function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// a monitor's screen: a generic desktop (title bar, a window, lines); instance colour tints it
function screenTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const c = cv.getContext('2d');
  c.fillStyle = '#DDE6F5'; c.fillRect(0, 0, 256, 160);
  c.fillStyle = '#9FB3D6'; c.fillRect(0, 0, 256, 18);
  c.fillStyle = '#FFFFFF'; c.fillRect(30, 30, 196, 112);
  c.fillStyle = '#B9C6DD'; c.fillRect(30, 30, 196, 12);
  c.fillStyle = '#C7D2E6';
  for (let i = 0; i < 6; i++) c.fillRect(44, 54 + i * 13, 60 + ((i * 53) % 110), 6);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function worldSet() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(INK, 22, 150);
  const cam = G.camera(38, 0.1, 400);
  scene.environment = G.ENV;
  G.keyLights(scene, { key: 1.4, rim: 2.6, fill: 0.3, keyPos: [-6, 10, 8], rimPos: [8, 5, -10], keyColor: 0xdfe9ff, rimColor: 0xe1af31 });
  const GLOW = glowTexture();
  const additive = (color, opacity = 1) => new THREE.MeshBasicMaterial({ map: GLOW, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });

  // ---- floor: a grid that fades into the fog, and a pool of light under the company
  const grid = new THREE.GridHelper(400, 200, 0x34486e, 0x1d2a45);
  grid.material.transparent = true;
  scene.add(grid);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), additive(0x29406e, 0.9));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.02;
  scene.add(pool);

  // ---- monitors: instanced bodies + screens + halos (screens and halos carry per-instance colour)
  const bodyGeo = new THREE.BoxGeometry(1.25, 0.82, 0.1);
  bodyGeo.translate(0, 0.95, 0);
  const standGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12);
  standGeo.translate(0, 0.27, 0);
  const screenGeo = new THREE.PlaneGeometry(1.12, 0.7);
  screenGeo.translate(0, 0.95, 0.052);
  const haloGeo = new THREE.PlaneGeometry(3.2, 2.4);
  haloGeo.translate(0, 0.95, 0.06);
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x1a2130, roughness: 0.35, metalness: 0.7, clearcoat: 0.6 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, N_MON);
  const stands = new THREE.InstancedMesh(standGeo, bodyMat, N_MON);
  const screens = new THREE.InstancedMesh(screenGeo, new THREE.MeshBasicMaterial({ map: screenTexture(), toneMapped: false }), N_MON);
  const halos = new THREE.InstancedMesh(haloGeo, additive(0xffffff, 0.22), N_MON);
  scene.add(bodies, stands, screens, halos);
  const gridPos = [], ringPos = [];
  for (let i = 0; i < N_MON; i++) {
    const c = i % 6, r = Math.floor(i / 6);
    gridPos.push([(c - 2.5) * 1.9, 0, (r - 1.5) * 1.9 + 1.0]);
    const a = (i / N_MON) * Math.PI * 2;
    ringPos.push([Math.sin(a) * 6.2, 0, Math.cos(a) * 6.2]);
  }

  // ---- links out to the world (outage): 10 arcs from the cluster to points around the horizon
  const outLinks = [];
  for (let i = 0; i < 10; i++) {
    const a = -1.25 + (i / 9) * 2.5;
    const far = new THREE.Vector3(Math.sin(a) * 70, 0, -Math.cos(a) * 70 - 10);
    const from = new THREE.Vector3((hash01(i, 2) - 0.5) * 8, 1.2, (hash01(i, 3) - 0.5) * 4);
    const mid = from.clone().lerp(far, 0.5).add(new THREE.Vector3(0, 14 + hash01(i, 4) * 10, 0));
    const curve = new THREE.QuadraticBezierCurve3(from, mid, far);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.07, 5, false), new THREE.MeshBasicMaterial({ color: 0xf3efe6, toneMapped: false })));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.32, 6, false), new THREE.MeshBasicMaterial({ color: 0x3a5a9a, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    scene.add(g);
    outLinks.push(g);
  }

  // ---- the foreign relay: a border of dashes, a rack far beyond it, one long link
  const border = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.08, 0.22),
    new THREE.MeshBasicMaterial({ color: 0xf3efe6, transparent: true, opacity: 0.8, toneMapped: false }), 80);
  {
    const m = new THREE.Matrix4();
    for (let i = 0; i < 80; i++) border.setMatrixAt(i, m.makeTranslation((i - 40) * 2.4, 0.06, -46));
  }
  scene.add(border);
  const tower = new THREE.Group();
  const rackMat = new THREE.MeshPhysicalMaterial({ color: 0x161c2a, roughness: 0.35, metalness: 0.75, clearcoat: 0.5, fog: false });
  const rack = new THREE.Mesh(new THREE.BoxGeometry(6, 20, 4.5), rackMat);
  rack.position.y = 10;
  tower.add(rack);
  // LED rows on three faces (front toward home, the +x side and the back: the camera sees all three),
  // 3 x 30 lights per face, blinking (instanced)
  const N_LED = 270;
  const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.16, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false }), N_LED);
  {
    const m = new THREE.Matrix4(), r = new THREE.Matrix4();
    for (let i = 0; i < N_LED; i++) {
      const face = Math.floor(i / 90), j = i % 90;
      const a = (j % 3) - 1, y = 1.4 + Math.floor(j / 3) * 0.6;
      if (face === 0) m.makeTranslation(a * 1.6, y, 2.28);
      else if (face === 1) m.makeTranslation(3.03, y, a * 1.3).multiply(r.makeRotationY(Math.PI / 2));
      else m.makeTranslation(-a * 1.6, y, -2.28);
      leds.setMatrixAt(i, m);
    }
  }
  tower.add(leds);
  const bayMat = new THREE.MeshBasicMaterial({ color: 0x3b4660, fog: false });
  for (let i = 0; i < 15; i++) {
    const y = 1.1 + i * 1.2;
    const front = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.08, 0.05), bayMat); front.position.set(0, y, 2.27);
    const back = front.clone(); back.position.z = -2.27;
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 4.0), bayMat); side.position.set(3.02, y, 0);
    tower.add(front, back, side);
  }
  const towerHalo = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), additive(0x3a5a9a, 0.55));
  towerHalo.material.fog = false;
  towerHalo.position.set(0, 12, -2.5);
  tower.add(towerHalo);
  tower.position.set(16, 0, -112);
  scene.add(tower);
  const fFrom = new THREE.Vector3(0, 1.4, 0), fTo = new THREE.Vector3(16, 20.2, -112);
  const fCurve = new THREE.QuadraticBezierCurve3(fFrom, new THREE.Vector3(7, 36, -52), fTo);
  const fLink = new THREE.Mesh(new THREE.TubeGeometry(fCurve, 200, 0.12, 6, false), new THREE.MeshBasicMaterial({ color: 0xf3efe6, toneMapped: false, fog: false }));
  const fGlow = new THREE.Mesh(new THREE.TubeGeometry(fCurve, 200, 0.55, 8, false), new THREE.MeshBasicMaterial({ color: 0x3a5a9a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  scene.add(fLink, fGlow);
  const fIndex = fLink.geometry.index.count, gIndex = fGlow.geometry.index.count;
  const packets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.7, 0.7),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false }), 18);
  scene.add(packets);

  // ---- own server: a tower that drops into the centre, spokes to every monitor, a ring of light
  const own = new THREE.Group();
  const ownBody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.6, 1.7), new THREE.MeshPhysicalMaterial({ color: 0x1b2232, roughness: 0.3, metalness: 0.75, clearcoat: 0.8 }));
  ownBody.position.y = 1.8;
  own.add(ownBody);
  const ownSlit = new THREE.MeshBasicMaterial({ color: ACC, toneMapped: false });
  for (let i = 0; i < 6; i++) {
    for (const side of [0, 1, 2, 3]) {
      const sl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.09, 0.04), ownSlit);
      const a = (side * Math.PI) / 2;
      sl.position.set(Math.sin(a) * 0.86, 0.8 + i * 0.48, Math.cos(a) * 0.86);
      sl.rotation.y = a;
      own.add(sl);
    }
  }
  const ownHalo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), additive(ACC, 0.32));
  ownHalo.position.set(0, 1.9, 0);
  own.add(ownHalo);
  scene.add(own);
  const ringCurve = new THREE.CatmullRomCurve3(Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return new THREE.Vector3(Math.sin(a) * 8.4, 0.05, Math.cos(a) * 8.4);
  }), true);
  const ring = new THREE.Mesh(new THREE.TubeGeometry(ringCurve, 256, 0.08, 6, true), new THREE.MeshBasicMaterial({ color: ACC, toneMapped: false }));
  const ringGlow = new THREE.Mesh(new THREE.TubeGeometry(ringCurve, 256, 0.45, 6, true), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  scene.add(ring, ringGlow);
  const ringIndex = ring.geometry.index.count, ringGIndex = ringGlow.geometry.index.count;
  const spokes = [];
  for (let i = 0; i < N_MON; i++) {
    const a = (i / N_MON) * Math.PI * 2;
    const c = new THREE.LineCurve3(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(Math.sin(a) * 5.6, 0.6, Math.cos(a) * 5.6));
    const sp = new THREE.Mesh(new THREE.TubeGeometry(c, 8, 0.04, 4, false), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, toneMapped: false }));
    scene.add(sp);
    spokes.push(sp);
  }
  // ---- dome of hex tiles (secure)
  const tiles = [];
  for (let el = 0; el < 9; el++) {
    const phi = (el / 9) * (Math.PI / 2) * 0.98;
    const n = Math.max(1, Math.round(28 * Math.cos(phi)));
    for (let k = 0; k < n; k++) tiles.push({ phi, th: (k / n) * Math.PI * 2 + el * 0.3 });
  }
  const dome = new THREE.InstancedMesh(new THREE.CircleGeometry(0.62, 6),
    new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.16, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }), tiles.length);
  const domeEdge = new THREE.InstancedMesh(new THREE.RingGeometry(0.55, 0.64, 6),
    new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.95, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }), tiles.length);
  scene.add(dome, domeEdge);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0), out = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);
  const R = 10.2;

  const set = {
    scene, camera: cam,
    // world positions the film labels in 2-D (projected with set.toScreen)
    anchors: { tower: new THREE.Vector3(16, 21, -112), home: new THREE.Vector3(0, 3.8, 0), border: new THREE.Vector3(-14, 0.4, -46) },
    toScreen(v) { pv.copy(v).project(cam); return [(pv.x * 0.5 + 0.5) * M.W, (-pv.y * 0.5 + 0.5) * M.H, pv.z < 1]; },
    update(t, u, o = {}) {
      const mode = o.mode;
      const answer = mode === 'own' || mode === 'secure';
      const dim = o.dim ?? 0;                         // 0..1 lights out (the turn)
      const u0 = o.u0 ?? 56;
      grid.material.opacity = 0.95 * (1 - dim * 0.85);
      pool.material.opacity = 0.9 * (1 - dim);
      pool.material.color.set(answer ? 0x5a4a20 : 0x29406e);

      // monitors: grid in the problem, a ring around the server in the answer
      for (let i = 0; i < N_MON; i++) {
        const g = gridPos[i], r = ringPos[i];
        const lag = answer ? springU(u, u0 + 1.5 + i * 0.05, SPRING.gentle) : 0;
        pv.set(lerp(g[0], r[0], lag), 0, lerp(g[2], r[2], lag));
        const face = answer ? Math.atan2(-r[0], -r[2]) * lag : 0;   // ring monitors face the server
        q.setFromAxisAngle(up, face);
        sc.set(1, 1, 1);
        m4.compose(pv, q, sc);
        bodies.setMatrixAt(i, m4); stands.setMatrixAt(i, m4); screens.setMatrixAt(i, m4); halos.setMatrixAt(i, m4);
        let on = 1;
        if (mode === 'outage') {
          const dead = u >= 19.6 ? springU(u, 19.6 + hash01(i, 8) * 1.4, SPRING.snappy) : 0;  // "paralysed": screens die
          on = (1 - dead) * (o.gate ? 0.3 + 0.4 * hash01(i, Math.floor(u * 4)) : 1);
        } else if (mode === 'foreign') on = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(u * 1.3 + i));
        on *= 1 - dim;
        if (answer) col.setRGB(1.0, 0.97, 0.9);
        else col.setRGB(0.62, 0.74, 1.0).multiplyScalar(0.06 + 0.94 * on);
        screens.setColorAt(i, col);
        halos.setColorAt(i, answer ? col.setRGB(0.9, 0.7, 0.25) : col.setRGB(0.3, 0.45, 0.9).multiplyScalar(on));
      }
      bodies.instanceMatrix.needsUpdate = stands.instanceMatrix.needsUpdate = screens.instanceMatrix.needsUpdate = halos.instanceMatrix.needsUpdate = true;
      screens.instanceColor.needsUpdate = halos.instanceColor.needsUpdate = true;

      // outage links: up when the gate is open, gone when it's shut; after "paralysed" they go for good
      outLinks.forEach((g, i) => { g.visible = mode === 'outage' && !(o.gate && hash01(i, 21) < 0.8) && !(u > 19.6 + i * 0.12); });
      // foreign link + border + rack
      const showF = mode === 'foreign';
      border.visible = showF || mode === 'outage';
      border.material.opacity = (mode === 'outage' ? 0.35 : 0.85) * (1 - dim);
      tower.visible = showF;
      fLink.visible = fGlow.visible = packets.visible = showF;
      if (showF) {
        const draw = clamp(springU(u, 25, SPRING.gentle) * 1.02);
        fLink.geometry.setDrawRange(0, Math.floor((fIndex / 3) * draw) * 3);
        fGlow.geometry.setDrawRange(0, Math.floor((gIndex / 3) * draw) * 3);
        fLink.material.color.setScalar(1 - dim);
        fGlow.material.opacity = 0.3 * (1 - dim);
        towerHalo.material.opacity = 0.55 * (1 - dim);
        for (let i = 0; i < N_LED; i++) {
          const blink = hash01(i * 31 + Math.floor(u * 3 + hash01(i, 4) * 3), 9) < 0.55;
          leds.setColorAt(i, col.setRGB(0.95, 0.93, 0.88).multiplyScalar((blink ? 1 : 0.15) * (1 - dim)));
        }
        leds.instanceColor.needsUpdate = true;
        for (let i = 0; i < 18; i++) {
          // slow packets: one round trip every 6 beats, half outbound half inbound
          const ph = ((u - 26) / 6 + i / 18) % 1;
          const there = ph < 0.5 ? ph * 2 : 2 - ph * 2;
          const show = u > 26 && there <= draw;
          fCurve.getPoint(clamp(there), pv);
          sc.setScalar(show ? 1 - dim : 0.0001);
          packets.setMatrixAt(i, m4.compose(pv, q.identity(), sc));
          packets.setColorAt(i, col.set(i % 3 === 0 ? 0xe1af31 : 0xf3efe6));
        }
        packets.instanceMatrix.needsUpdate = true;
        packets.instanceColor.needsUpdate = true;
      }

      // own server + ring + spokes
      own.visible = ring.visible = ringGlow.visible = answer;
      spokes.forEach((s) => { s.visible = answer; });
      if (answer) {
        const drop = springU(u, u0 + 0.2, { stiffness: 240, damping: 16 });
        own.position.y = (1 - drop) * 14;
        const sq = 0.08 * M.wobble(u - u0 - 1.1, 2.2, 4.5);
        own.scale.set(1 + sq, 1 - sq, 1 + sq);
        ownHalo.lookAt(cam.position);
        const rk = clamp(springU(u, u0 + 1.0, SPRING.gentle));
        ring.geometry.setDrawRange(0, Math.floor((ringIndex / 3) * rk) * 3);
        ringGlow.geometry.setDrawRange(0, Math.floor((ringGIndex / 3) * rk) * 3);
        spokes.forEach((s, i) => {
          const k = springU(u, u0 + 3 + i * 0.08, SPRING.snappy);
          s.scale.setScalar(Math.max(1e-3, k));
          s.material.opacity = 0.8 * clamp(k);
        });
      }
      // dome
      const domeK = mode === 'secure' ? (o.dome ?? 0) : 0;
      dome.visible = domeEdge.visible = domeK > 0;
      if (domeK > 0) {
        tiles.forEach((tl, i) => {
          const order = tl.phi / (Math.PI / 2);                 // bottom rows first
          const k = clamp((domeK * 1.25 - order) * 4);
          const e = E.outBack(k, 1.6);
          out.set(Math.cos(tl.phi) * Math.sin(tl.th), Math.sin(tl.phi), Math.cos(tl.phi) * Math.cos(tl.th));
          pv.copy(out).multiplyScalar(R);
          q.setFromUnitVectors(zAxis, out);
          sc.setScalar(Math.max(1e-3, e));
          m4.compose(pv, q, sc);
          dome.setMatrixAt(i, m4); domeEdge.setMatrixAt(i, m4);
        });
        dome.instanceMatrix.needsUpdate = domeEdge.instanceMatrix.needsUpdate = true;
      }

      // camera per mode
      if (mode === 'outage') {
        const k = springU(u, 13.6, SPRING.gentle);
        const drift = (u - 14) * 0.05;
        G.lookFrom(cam, [lerp(-6, 0, k) + Math.sin(drift) * 2.2, lerp(26, 8.5, k), lerp(30, 16.5, k)], [0, lerp(-2, 0.6, k), lerp(-10, -3.5, k)]);
      } else if (mode === 'foreign') {
        // fly out along the link (eased keys: no whip), arrive at the relay, then look back home
        // ... then swing round behind the rack: it towers in the foreground, home is a speck down the link
        // (portrait sees only +-11 deg across: the camera sits just behind and beside the rack, so the
        // rack fills the right of frame and home sits small on the left, down the line of the link)
        const pos = kf(u, [[24.6, [0, 8.5, 16.5]], [27.0, [5, 14, -6]], [31.0, [10, 22, -60]], [32.8, [34, 18, -98]], [34.6, [27, 6, -139.7]], [43.6, [31, 9.5, -147]]], E.inOutSine);
        const tgt = kf(u, [[24.6, [0, 0.6, -3.5]], [27.0, [10, 16, -70]], [31.0, [16, 16, -112]], [32.8, [16, 12, -112]], [34.6, [14.1, 7, -91.4]], [43.6, [16, 6.5, -96]]], E.inOutSine);
        G.lookFrom(cam, pos, tgt, Math.sin(u * 0.4) * 0.03);
      } else if (mode === 'own') {
        const a = 0.35 + (u - u0) * 0.035;
        const r = lerp(19, 15.5, clamp((u - u0) / 15));
        const h = lerp(11, 7.2, E.outCubic(clamp((u - u0) / 6)));
        const push = E.inCubic(clamp((u - 69.6) / 1.9));    // the shot ends pushing into the tower's face
        const pos = [Math.sin(a) * r, h, Math.cos(a) * r];
        const end = [Math.sin(a) * 1.7, 2.4, Math.cos(a) * 1.7];
        G.lookFrom(cam, pos.map((v, i) => lerp(v, end[i], push)), [0, lerp(1.9, 2.4, push), 0]);
      } else if (mode === 'secure') {
        const c0 = o.cu0 ?? u0;
        const a = -0.5 + (u - c0) * 0.05;
        const r = lerp(31, 25, E.outCubic(clamp((u - c0) / 8)));
        G.lookFrom(cam, [Math.sin(a) * r, lerp(21, 15, clamp((u - c0) / 8)), Math.cos(a) * r], [0, 6.2, 0]);
      }
    },
  };
  return set;
}
