import * as THREE from "three";
import { billboards, release, sharedSoftTex } from "./common";
import { C } from "./timeline";
import type { Frame, Stage } from "./stage";

const LINES = 260;
const BLOBS = 10;
const H = 16;
const CREAM = new THREE.Color(0xfff6ee);
const STEEL = new THREE.Color(0x3d4852);

/**
 * What falling feels like: vertical speed lines that stretch with the camera's speed, and a few
 * large soft drops that pass close to the lens. World-fixed in height, so they really are passed.
 */
export function buildFx(): Stage {
  const group = new THREE.Group();
  // Each line's fixed offset from the camera axis, worked out once.
  const offX = new Float32Array(LINES);
  const offZ = new Float32Array(LINES);
  const y0 = new Float32Array(LINES);
  for (let i = 0; i < LINES; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.35 + Math.pow(Math.random(), 1.6) * 3.2;
    offX[i] = Math.cos(a) * r;
    offZ[i] = Math.sin(a) * r;
    y0[i] = Math.random() * H;
  }
  const pos = new Float32Array(LINES * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xfff6ee, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  group.add(lines);

  const soft = sharedSoftTex();
  const blobs = billboards(BLOBS, soft);
  const bX = new Float32Array(BLOBS);
  const bZ = new Float32Array(BLOBS);
  const bY = new Float32Array(BLOBS);
  for (let i = 0; i < BLOBS; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.3 + Math.random() * 0.9;
    bX[i] = Math.cos(a) * r;
    bZ[i] = Math.sin(a) * r;
    bY[i] = Math.random() * 10;
    blobs.size[i * 2] = 0.09 + Math.random() * 0.1;
    blobs.size[i * 2 + 1] = 0.8 + Math.random() * 0.9;
    blobs.alpha[i] = 1;
  }
  blobs.commit(true);
  group.add(blobs.mesh);

  return {
    group,
    update(f: Frame) {
      const fx = f.s[C.fx];
      const cam = f.cam.position;
      const sp = f.speed;
      mat.color.copy(CREAM).lerp(STEEL, f.s[C.tone]);
      blobs.uniforms.uColor.value.copy(mat.color);
      mat.opacity = fx * Math.min(0.75, 0.12 + sp * 0.14);
      blobs.uniforms.uOpacity.value = fx * 0.2;
      const len = 0.18 + Math.min(3.2, sp * 0.22);
      for (let i = 0; i < LINES; i++) {
        const o = i * 6;
        let dy = (y0[i] - cam.y + H / 2) % H;
        if (dy < 0) dy += H;
        const y = cam.y + dy - H / 2;
        const x = cam.x + offX[i];
        const z = cam.z + offZ[i];
        pos[o] = pos[o + 3] = x;
        pos[o + 1] = y;
        pos[o + 4] = y + len;
        pos[o + 2] = pos[o + 5] = z;
      }
      geo.attributes.position.needsUpdate = true;
      for (let i = 0; i < BLOBS; i++) {
        let dy = (bY[i] - cam.y + 5) % 10;
        if (dy < 0) dy += 10;
        blobs.pos[i * 3] = cam.x + bX[i];
        blobs.pos[i * 3 + 1] = cam.y + dy - 5;
        blobs.pos[i * 3 + 2] = cam.z + bZ[i];
      }
      blobs.commit();
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      blobs.dispose();
      release("soft");
    },
  };
}
