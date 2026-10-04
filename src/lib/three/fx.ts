import * as THREE from "three";
import { softTex } from "./common";
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
  const ang = new Float32Array(LINES);
  const rad = new Float32Array(LINES);
  const y0 = new Float32Array(LINES);
  for (let i = 0; i < LINES; i++) {
    ang[i] = Math.random() * Math.PI * 2;
    rad[i] = 0.35 + Math.pow(Math.random(), 1.6) * 3.2;
    y0[i] = Math.random() * H;
  }
  const pos = new Float32Array(LINES * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xfff6ee, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  group.add(lines);

  const soft = softTex();
  const blobMat = new THREE.SpriteMaterial({ map: soft, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const bA = new Float32Array(BLOBS);
  const bR = new Float32Array(BLOBS);
  const bY = new Float32Array(BLOBS);
  const blobs: THREE.Sprite[] = [];
  for (let i = 0; i < BLOBS; i++) {
    bA[i] = Math.random() * Math.PI * 2;
    bR[i] = 0.3 + Math.random() * 0.9;
    bY[i] = Math.random() * 10;
    const sp = new THREE.Sprite(blobMat);
    sp.scale.set(0.09 + Math.random() * 0.1, 0.8 + Math.random() * 0.9, 1);
    group.add(sp);
    blobs.push(sp);
  }

  return {
    group,
    update(f: Frame) {
      const fx = f.s[C.fx];
      const cam = f.cam.position;
      const sp = f.speed;
      mat.color.copy(CREAM).lerp(STEEL, f.s[C.tone]);
      blobMat.color.copy(mat.color);
      mat.opacity = fx * Math.min(0.75, 0.12 + sp * 0.14);
      blobMat.opacity = fx * 0.2;
      const len = 0.18 + Math.min(3.2, sp * 0.22);
      for (let i = 0; i < LINES; i++) {
        const o = i * 6;
        let dy = (y0[i] - cam.y + H / 2) % H;
        if (dy < 0) dy += H;
        const y = cam.y + dy - H / 2;
        const x = cam.x + Math.cos(ang[i]) * rad[i];
        const z = cam.z + Math.sin(ang[i]) * rad[i];
        pos[o] = pos[o + 3] = x;
        pos[o + 1] = y;
        pos[o + 4] = y + len;
        pos[o + 2] = pos[o + 5] = z;
      }
      geo.attributes.position.needsUpdate = true;
      for (let i = 0; i < BLOBS; i++) {
        let dy = (bY[i] - cam.y + 5) % 10;
        if (dy < 0) dy += 10;
        blobs[i].position.set(
          cam.x + Math.cos(bA[i]) * bR[i],
          cam.y + dy - 5,
          cam.z + Math.sin(bA[i]) * bR[i],
        );
      }
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      blobMat.dispose();
      soft.dispose();
    },
  };
}
