import * as THREE from "three";
import {
  baseRenderer,
  makeEnv,
  nozzlePositions,
  reducedMotion,
  smooth,
  type Dispose,
} from "./common";

export interface ExplodedOptions {
  section: HTMLElement;
  labels: () => HTMLElement | null;
  bar: () => HTMLElement | null;
}

const GUN = 0x202328;
/** Below this stage width the labels sit on the parts instead of beside them. */
const COMPACT_W = 640;

/** Five-layer shower head that pulls apart as the pinned section scrolls. */
export function initExploded(el: HTMLElement, o: ExplodedOptions): Dispose {
  const sec = o.section;
  const renderer = baseRenderer(el);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(GUN);
  scene.environment = makeEnv(renderer, 1.05, 0x1a1c20);
  const dl = new THREE.DirectionalLight(0xfff2e4, 1.4);
  dl.position.set(2, 4, 5);
  scene.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const root = new THREE.Group();
  scene.add(root);
  const stack = new THREE.Group();
  stack.rotation.x = -0.42;
  root.add(stack);
  const R = 1.25;
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe2e2e2, metalness: 1, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd4a964, metalness: 1, roughness: 0.3, side: THREE.DoubleSide });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xbfc3c7, metalness: 1, roughness: 0.38 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.6 });
  const silicone = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.85 });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.5 });
  const V = (x: number, y: number) => new THREE.Vector2(x, y);
  const parts: THREE.Group[] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3(1, 1, 1);
  const ps = new THREE.Vector3();

  const body = new THREE.Group();
  body.add(
    new THREE.Mesh(
      new THREE.LatheGeometry(
        [V(0.001, 0.075), V(0.9, 0.07), V(1.18, 0.052), V(1.25, 0.02), V(1.25, -0.03), V(1.21, -0.03), V(1.2, 0.02), V(1.15, 0.04), V(0.001, 0.045)],
        160,
      ),
      chrome,
    ),
  );
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 48), chrome);
  col.position.y = 0.14;
  body.add(col);
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.7, 32), chrome);
  stub.position.y = 0.55;
  body.add(stub);
  parts.push(body);

  const chamber = new THREE.Group();
  chamber.add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.05, 128, 1, true), brass));
  chamber.add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.008, 128), brass));
  chamber.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 48), brass));
  const vanes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.045, 0.022), brass, 24);
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
  diff.add(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.02, 128), steel));
  const holePos: [number, number][] = [];
  [6, 10, 14, 18, 22, 26].forEach((cnt, r) => {
    const rr = 0.16 + r * 0.17;
    for (let k = 0; k < cnt; k++) {
      const a = (k / cnt) * Math.PI * 2 + r * 0.3;
      holePos.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
  });
  const holes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.024, 12), dark, holePos.length);
  holePos.forEach(([x, z], i) => {
    m4.makeTranslation(x, 0, z);
    holes.setMatrixAt(i, m4);
  });
  diff.add(holes);
  parts.push(diff);

  const memb = new THREE.Group();
  memb.add(new THREE.Mesh(new THREE.CylinderGeometry(1.19, 1.19, 0.016, 128), silicone));
  const nzp = nozzlePositions(R);
  const nz = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.014, 0.035, 10), nozzleMat, nzp.length);
  nzp.forEach(([x, z], i) => {
    m4.makeTranslation(x, -0.022, z);
    nz.setMatrixAt(i, m4);
  });
  memb.add(nz);
  parts.push(memb);

  const ring = new THREE.Group();
  const tor = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.032, 24, 200), chrome);
  tor.rotation.x = Math.PI / 2;
  ring.add(tor);
  parts.push(ring);

  const ASM = [0, -0.03, -0.055, -0.075, -0.09];
  const OFF = [1.3, 0.65, 0, -0.65, -1.3];
  parts.forEach((p, i) => {
    p.position.y = ASM[i];
    stack.add(p);
  });

  let colX = 0;
  let wide = true;
  let compact = false;
  const layout = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    compact = w < COMPACT_W;
    wide = !compact && w / h > 1;
    cam.fov = wide ? 30 : 46;
    cam.updateProjectionMatrix();
    const halfW = Math.tan((cam.fov * Math.PI) / 360) * 9.6 * cam.aspect;
    if (compact) {
      // Labels sit on the parts, so the stack is centred and fills ~80% of the width.
      root.position.x = 0;
      root.scale.setScalar(Math.max(0.5, Math.min(1.1, (halfW * 0.8) / (R + 0.03))));
    } else {
      root.position.x = wide ? -halfW * 0.34 : -halfW * 0.5;
      root.scale.setScalar(wide ? 0.86 : 0.56);
    }
    colX = wide ? w * 0.56 : w * 0.4;
  };
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(el);
  let visible = false;
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
  });
  io.observe(sec);

  const calm = reducedMotion();
  const v = new THREE.Vector3();
  const right = new THREE.Vector3();
  let pS = 0;
  let raf = 0;
  let time = 0;
  let first = true;
  let lastT = performance.now();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 1 / 30);
    lastT = now;
    if (!visible) return;
    time += dt;
    const r = sec.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const p = total > 0 ? Math.max(0, Math.min(1, -r.top / total)) : 0;
    pS += (p - pS) * 0.1;
    const e = smooth(0.04, 0.55, pS);
    parts.forEach((g, i) => {
      g.position.y = ASM[i] + e * OFF[i];
    });
    stack.rotation.y = pS * 1.6 + (calm ? 0 : time * 0.04);
    root.position.y = wide ? -0.45 : compact ? -0.6 : 0.1;
    cam.position.set(0, 0.25, 9.6 - pS * 0.6);
    cam.lookAt(0, 0, 0);
    renderer.render(scene, cam);
    if (first) {
      first = false;
      renderer.domElement.style.opacity = "1";
    }

    const lab = o.labels();
    if (!lab) return;
    if (lab.hasAttribute("data-compact") !== compact) lab.toggleAttribute("data-compact", compact);
    const nodes = lab.querySelectorAll<HTMLElement>("[data-part]");
    const w = el.clientWidth;
    const h = el.clientHeight;
    right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    nodes.forEach((node, i) => {
      const g = parts[i];
      if (!g) return;
      v.setFromMatrixPosition(g.matrixWorld);
      // Beside the part on larger screens; on phones, tucked onto its right side.
      v.addScaledVector(right, (compact ? 1.05 : 1.28) * root.scale.x);
      v.project(cam);
      const sx = ((v.x + 1) / 2) * w;
      const sy = ((1 - v.y) / 2) * h;
      const op = smooth(0.32 + i * 0.07, 0.42 + i * 0.07, pS);
      node.style.opacity = op.toFixed(3);
      node.style.transform = compact
        ? `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-100%, -50%) translateY(${((1 - op) * 10).toFixed(1)}px)`
        : `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translateY(-50%) translateX(${((1 - op) * 16).toFixed(1)}px)`;
      if (!compact) {
        const line = node.querySelector<HTMLElement>("[data-line]");
        if (line) line.style.width = Math.max(28, colX - sx) + "px";
      }
    });
    const bar = o.bar();
    if (bar) bar.style.transform = `scaleX(${pS.toFixed(4)})`;
  };
  loop();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
