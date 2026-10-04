import * as THREE from "three";
import { domRef, nozzlePositions, smooth } from "./common";
import { C, HEAD_R, HEAD_Y } from "./timeline";
import type { BuildCtx, Frame, Stage } from "./stage";

/** Below this viewport width the labels sit on the parts instead of beside them. */
const COMPACT_W = 640;

/** Assembled and exploded offsets of the five layers, body first. */
const ASM = [0, -0.03, -0.055, -0.075, -0.09];
const OFF = [1.3, 0.65, 0, -0.65, -1.3];

/**
 * Five-layer shower head that pulls apart, then lets the camera through. Same geometry as the
 * old exploded view; the labels are tracked from the shared camera.
 */
export function buildExploded(ctx: BuildCtx): Stage {
  const group = new THREE.Group();
  group.position.y = HEAD_Y;
  const dl = new THREE.DirectionalLight(0xfff2e4, 1.4);
  dl.position.set(2, 4, 5);
  group.add(dl, dl.target);
  const stack = new THREE.Group();
  group.add(stack);

  const env = ctx.envHero;
  const R = HEAD_R;
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe2e2e2, metalness: 1, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, envMap: env });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd4a964, metalness: 1, roughness: 0.3, side: THREE.DoubleSide, envMap: env });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xbfc3c7, metalness: 1, roughness: 0.38, envMap: env });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.6, envMap: env });
  const silicone = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.85, envMap: env });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.5, envMap: env });
  const mats = [chrome, brass, steel, dark, silicone, nozzleMat];
  const geos: THREE.BufferGeometry[] = [];
  const G = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);
  const V = (x: number, y: number) => new THREE.Vector2(x, y);
  const parts: THREE.Group[] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3(1, 1, 1);
  const ps = new THREE.Vector3();

  const body = new THREE.Group();
  body.add(
    new THREE.Mesh(
      G(new THREE.LatheGeometry(
        [V(0.001, 0.075), V(0.9, 0.07), V(1.18, 0.052), V(1.25, 0.02), V(1.25, -0.03), V(1.21, -0.03), V(1.2, 0.02), V(1.15, 0.04), V(0.001, 0.045)],
        160,
      )),
      chrome,
    ),
  );
  const col = new THREE.Mesh(G(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 48)), chrome);
  col.position.y = 0.14;
  body.add(col);
  const stub = new THREE.Mesh(G(new THREE.CylinderGeometry(0.045, 0.045, 0.7, 32)), chrome);
  stub.position.y = 0.55;
  body.add(stub);
  // The pipe the head hangs from, so the camera comes down along it.
  const arm = new THREE.Mesh(G(new THREE.CylinderGeometry(0.045, 0.045, 5, 32)), chrome);
  arm.position.y = 2.5;
  body.add(arm);
  parts.push(body);

  const chamber = new THREE.Group();
  chamber.add(new THREE.Mesh(G(new THREE.CylinderGeometry(1.1, 1.1, 0.05, 128, 1, true)), brass));
  chamber.add(new THREE.Mesh(G(new THREE.CylinderGeometry(1.1, 1.1, 0.008, 128)), brass));
  chamber.add(new THREE.Mesh(G(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 48)), brass));
  const vanes = new THREE.InstancedMesh(G(new THREE.BoxGeometry(0.6, 0.045, 0.022)), brass, 24);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    q.setFromEuler(new THREE.Euler(0.35, -a, 0, "YXZ"));
    ps.set(Math.cos(a) * 0.62, 0.02, Math.sin(a) * 0.62);
    m4.compose(ps, q, sc);
    vanes.setMatrixAt(i, m4);
  }
  chamber.add(vanes);
  parts.push(chamber);

  const diff = new THREE.Group();
  diff.add(new THREE.Mesh(G(new THREE.CylinderGeometry(1.15, 1.15, 0.02, 128)), steel));
  const holePos: [number, number][] = [];
  [6, 10, 14, 18, 22, 26].forEach((cnt, r) => {
    const rr = 0.16 + r * 0.17;
    for (let k = 0; k < cnt; k++) {
      const a = (k / cnt) * Math.PI * 2 + r * 0.3;
      holePos.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
  });
  const holes = new THREE.InstancedMesh(G(new THREE.CylinderGeometry(0.022, 0.022, 0.024, 12)), dark, holePos.length);
  holePos.forEach(([x, z], i) => {
    m4.makeTranslation(x, 0, z);
    holes.setMatrixAt(i, m4);
  });
  diff.add(holes);
  parts.push(diff);

  const memb = new THREE.Group();
  memb.add(new THREE.Mesh(G(new THREE.CylinderGeometry(1.19, 1.19, 0.016, 128)), silicone));
  const nzp = nozzlePositions(R);
  const nz = new THREE.InstancedMesh(G(new THREE.CylinderGeometry(0.022, 0.014, 0.035, 10)), nozzleMat, nzp.length);
  nzp.forEach(([x, z], i) => {
    m4.makeTranslation(x, -0.022, z);
    nz.setMatrixAt(i, m4);
  });
  memb.add(nz);
  parts.push(memb);

  const ring = new THREE.Group();
  const tor = new THREE.Mesh(G(new THREE.TorusGeometry(1.22, 0.032, 24, 200)), chrome);
  tor.rotation.x = Math.PI / 2;
  ring.add(tor);
  parts.push(ring);

  parts.forEach((p, i) => {
    p.position.y = ASM[i];
    stack.add(p);
  });

  const labelsEl = domRef("[data-world-labels]");
  const barEl = domRef("[data-world-bar]");
  const captionEls = () => document.querySelectorAll<HTMLElement>("[data-world-caption]");
  let nodes: HTMLElement[] = [];
  let nodesFor: HTMLElement | null = null;
  let lastCaption = -1;
  let lastBar = -1;
  const v = new THREE.Vector3();
  const right = new THREE.Vector3();

  return {
    group,
    always(f: Frame) {
      const c = Math.round(f.s[C.caption] * 100) / 100;
      if (c !== lastCaption) {
        lastCaption = c;
        captionEls().forEach((cap) => {
          cap.style.opacity = String(c);
          cap.style.visibility = c < 0.02 ? "hidden" : "visible";
        });
      }
    },
    update(f: Frame) {
      const s = f.s;
      const e = s[C.explode];
      parts.forEach((g, i) => {
        g.position.y = ASM[i] + e * OFF[i];
      });
      stack.rotation.set(s[C.tilt], s[C.spin] + (f.reduced ? 0 : f.time * 0.04), 0);
      group.updateMatrixWorld(true);

      const bar = barEl();
      if (bar) {
        const b = Math.round(e * 1000) / 1000;
        if (b !== lastBar) {
          lastBar = b;
          bar.style.transform = `scaleX(${b})`;
        }
      }

      const lab = labelsEl();
      if (!lab) return;
      const compact = f.vw < COMPACT_W;
      if (lab.hasAttribute("data-compact") !== compact) lab.toggleAttribute("data-compact", compact);
      if (nodesFor !== lab) {
        nodesFor = lab;
        nodes = Array.from(lab.querySelectorAll<HTMLElement>("[data-part]"));
      }
      const colX = compact ? f.vw * 0.4 : f.vw * 0.56;
      right.set(1, 0, 0).applyQuaternion(f.cam.quaternion);
      const lw = s[C.labels];
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const g = parts[i];
        if (!g) continue;
        const op = smooth(i * 0.09, 0.5 + i * 0.09, lw);
        const prev = node.dataset.op;
        const opS = op.toFixed(3);
        if (op < 0.01 && prev === "0.000") continue;
        node.dataset.op = opS;
        v.setFromMatrixPosition(g.matrixWorld);
        v.addScaledVector(right, compact ? 1.05 : 1.28);
        v.project(f.cam);
        const sx = ((v.x + 1) / 2) * f.vw;
        const sy = ((1 - v.y) / 2) * f.vh;
        node.style.opacity = opS;
        node.style.transform = compact
          ? `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-100%, -50%) translateY(${((1 - op) * 10).toFixed(1)}px)`
          : `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translateY(-50%) translateX(${((1 - op) * 16).toFixed(1)}px)`;
        if (!compact) {
          const line = node.querySelector<HTMLElement>("[data-line]");
          if (line) line.style.width = Math.max(28, colX - sx) + "px";
        }
      }
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      vanes.dispose();
      holes.dispose();
      nz.dispose();
      dl.dispose();
    },
  };
}
