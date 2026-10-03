import * as THREE from "three";

/** Raw sRGB hex into a Color without colour-space conversion (for manual output-space mixing). */
export function rawColor(hex: number) {
  return new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
}

export function baseRenderer(el: HTMLElement) {
  const r = new THREE.WebGLRenderer({ antialias: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  Object.assign(r.domElement.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    display: "block",
    opacity: "0",
    transition: "opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
  });
  el.appendChild(r.domElement);
  return r;
}

/** A tiny studio: dark room, four softboxes, baked into a PMREM env map. */
export function makeEnv(
  renderer: THREE.WebGLRenderer,
  k = 1,
  room = 0x0c0b0a,
) {
  const pm = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  s.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(24, 24, 24),
      new THREE.MeshBasicMaterial({ color: room, side: THREE.BackSide }),
    ),
  );
  const add = (
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    c: number,
    i: number,
  ) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(c).multiplyScalar(i * k),
        side: THREE.DoubleSide,
      }),
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  add(16, 2.5, 0, 10, 0.01, 0xffffff, 3.2);
  add(2.5, 14, -10, 2, 1, 0xffe8d0, 2.2);
  add(2.5, 14, 10, 2, -2, 0xd8e6ff, 1.6);
  add(12, 1.6, 0, 0.5, 10, 0xffffff, 1.0);
  add(6, 6, 3, -2, -10, 0x6a625a, 0.6);
  const tex = pm.fromScene(s, 0.035).texture;
  pm.dispose();
  s.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return tex;
}

export function softTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.4, "rgba(255,255,255,0.35)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function nozzlePositions(R: number) {
  const out: [number, number][] = [];
  for (let ring = 1; ring <= 9; ring++) {
    const rr = ring * R * 0.1;
    const cnt = Math.round(ring * 7);
    for (let k = 0; k < cnt; k++) {
      const a = (k / cnt) * Math.PI * 2 + ring;
      out.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
  }
  return out;
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type Dispose = () => void;

/** Frame-rate independent exponential approach: 1 - exp(-dt * k). */
export const damp = (dt: number, k: number) => 1 - Math.exp(-dt * k);
