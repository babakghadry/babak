// Shot 1: a nine-digit remote-access ID in extruded digits, three rows of three, that never settles:
// every slot flips to a new digit each half beat (a split-flap), faster once the line turns impatient.
import * as G from '../lib/gl.js';
import * as M from '../lib/motion.js';

const { THREE } = G;
const { springU, SPRING, hash01, E, clamp } = M;

export function codeSet() {
  const scene = new THREE.Scene();
  const cam = G.camera(30, 0.1, 200);
  scene.environment = G.ENV;
  G.keyLights(scene, { key: 2.4, rim: 3.2, fill: 0.2, keyPos: [-5, 6, 8], rimPos: [6, 2, -6], keyColor: 0xfff3e2, rimColor: 0xe1af31 });
  const paper = new THREE.MeshPhysicalMaterial({ color: 0xf3efe6, roughness: 0.34, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.8 });
  const digits = [...'0123456789'].map((d) => G.text3D(d, 1.12, 0.4, 0.05, 5));
  const root = new THREE.Group();
  scene.add(root);
  const slots = [];
  for (let i = 0; i < 9; i++) {
    const pivot = new THREE.Group();
    const r = Math.floor(i / 3), c = i % 3;
    pivot.userData.home = new THREE.Vector3((c - 1) * 1.02, (1 - r) * 1.52, 0);
    const mesh = new THREE.Mesh(digits[0], paper);
    pivot.add(mesh);
    root.add(pivot);
    slots.push({ pivot, mesh });
  }
  // a ring of 36 ticks behind the block: the "waiting" spinner, swept by a comet of light
  const tickGeo = new THREE.BoxGeometry(0.07, 0.34, 0.07);
  const ticks = new THREE.InstancedMesh(tickGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false }), 36);
  ticks.position.set(0, 0, -3.2);
  scene.add(ticks);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1);
  const col = new THREE.Color();

  return {
    scene, camera: cam,
    // o.k: 0..1 exit (the block falls away)
    update(t, u, o = {}) {
      const rate = u < 9.8 ? 2 : 4;                         // flips per beat
      slots.forEach(({ pivot, mesh }, i) => {
        const k = springU(u, -0.35 + i * 0.045, SPRING.bouncy);
        const h = pivot.userData.home;
        pivot.position.set(h.x * (0.6 + 0.4 * k), h.y * (0.6 + 0.4 * k), h.z + (1 - k) * 9);
        pivot.rotation.set((1 - k) * -1.2, (1 - k) * 0.5 * (i % 2 ? 1 : -1), 0);
        // split-flap: a new digit each step, the incoming one flips down from the top
        const off = hash01(i, 11);
        const step = Math.floor(u * rate + off);
        const ph = u * rate + off - step;
        mesh.geometry = digits[Math.floor(hash01(i * 977 + step, 5) * 10)];
        mesh.rotation.x = -(1 - E.outBack(clamp(ph * 3.2), 2.2)) * 1.4;
        const exit = o.exit || 0;
        if (exit > 0) { pivot.position.y -= exit * exit * (8 + i); pivot.rotation.x += exit * (1 + (i % 3)); }
      });
      // camera: a slow push and yaw; the block sits in the frame's middle third
      const push = 1 - Math.exp(-u / 9);
      const yaw = Math.sin(u * 0.21) * 0.16 + (u > 9.8 ? Math.sin((u - 9.8) * 3.1) * 0.02 : 0);
      const d = 17.2 - push * 1.6;
      G.lookFrom(cam, [Math.sin(yaw) * d, 1.0 + Math.sin(u * 0.17) * 0.25, Math.cos(yaw) * d], [0, 0.8, 0], Math.sin(u * 0.13) * 0.03);
      // spinner: 36 ticks on a circle of radius 4.1, lit by a comet that circles once per 2 beats
      const head = (u / 2) % 1;
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        p.set(Math.sin(a) * 3.05, Math.cos(a) * 3.05, 0);
        q.setFromAxisAngle(z, -a);
        const trail = ((head - i / 36) % 1 + 1) % 1;
        const lit = Math.exp(-trail * 6);
        const born = springU(u, 0.2 + i * 0.02, SPRING.snappy);
        s.set(1, 0.6 + 0.6 * lit, 1).multiplyScalar(born);
        ticks.setMatrixAt(i, m4.compose(p, q, s));
        col.setRGB(0.12 + 0.76 * lit, 0.13 + 0.56 * lit, 0.2 + 0.0 * lit);
        if (lit > 0.35) col.setRGB(0.88, 0.69, 0.19);
        ticks.setColorAt(i, col);
      }
      ticks.instanceMatrix.needsUpdate = true;
      ticks.instanceColor.needsUpdate = true;
    },
  };
}
