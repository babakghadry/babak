// Shot 6, the drop: "MeshCentral" in silver extruded letters (the real web UI's title is a chrome
// bevel on blue), slamming in from behind the camera one letter after another, then settling.
import * as G from '../lib/gl.js';
import * as M from '../lib/motion.js';

const { THREE } = G;
const { springU, SPRING, E, clamp } = M;

export function markSet() {
  const scene = new THREE.Scene();
  const cam = G.camera(30, 0.1, 200);
  scene.environment = G.ENV;
  G.keyLights(scene, { key: 2.6, rim: 2.6, fill: 0.3, keyPos: [-4, 5, 9], rimPos: [6, 3, -5], keyColor: 0xffffff, rimColor: 0xe1af31 });
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xdfe6ef, metalness: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.25 });
  const { group, glyphs, width } = G.glyphs3D('MeshCentral', 1, 0.38, silver, 0.04);
  scene.add(group);
  return {
    scene, camera: cam, width,
    // o.exit 0..1 lifts the word out of frame
    update(t, u, o = {}) {
      glyphs.forEach((g, i) => {
        const k = springU(u, 51.15 + i * 0.075, { stiffness: 300, damping: 17 });
        const h = g.userData.home;
        g.position.set(h.x, h.y + (1 - k) * 0.8, h.z + (1 - k) * 26);
        g.rotation.set((1 - k) * -0.9, (1 - k) * 0.6, 0);
        const ex = o.exit || 0;
        if (ex > 0) { g.position.y += E.inCubic(clamp(ex * 1.4 - i * 0.04)) * 12; g.rotation.x -= ex * 0.8; }
      });
      const settle = 1 - Math.exp(-Math.max(0, u - 52) / 1.8);
      const d = M.lerp(32.5, 31.0, settle);
      G.lookFrom(cam, [Math.sin(0.1 - settle * 0.12) * d, 0.35 - settle * 0.2, Math.cos(0.1 - settle * 0.12) * d], [0, -0.05, 0], -0.02 + settle * 0.02);
    },
  };
}
