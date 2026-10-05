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

/**
 * GPU resources more than one stage draws with (the soft dot, a pipe both heads hang from) are made
 * once and counted. Each stage releases what it took; the last release frees it.
 */
const shared = new Map<string, { v: { dispose(): void }; n: number }>();
export function acquire<T extends { dispose(): void }>(key: string, make: () => T): T {
  let e = shared.get(key);
  if (!e) shared.set(key, (e = { v: make(), n: 0 }));
  e.n++;
  return e.v as T;
}
export function release(key: string) {
  const e = shared.get(key);
  if (!e || --e.n > 0) return;
  e.v.dispose();
  shared.delete(key);
}

/** The radial soft dot, shared by every stage that wants one. Pair with `release("soft")`. */
export const sharedSoftTex = () => acquire("soft", softTex);

export interface Billboards {
  mesh: THREE.Mesh;
  /** Per instance: centre xyz, size xy (world units, camera-facing), alpha 0..1. Call commit() after writing. */
  pos: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  uniforms: { uMap: { value: THREE.Texture }; uColor: { value: THREE.Color }; uOpacity: { value: number } };
  commit(sizes?: boolean): void;
  dispose(): void;
}

/**
 * Many camera-facing soft sprites in one draw call. Same look as THREE.Sprite with a shared map
 * (all instances share one colour, so their blend order does not matter), without an object, a
 * material and a draw call per sprite.
 */
export function billboards(n: number, map: THREE.Texture, color = 0xffffff): Billboards {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  geo.setAttribute("uv", base.getAttribute("uv"));
  geo.instanceCount = n;
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n * 2).fill(1);
  const alpha = new Float32Array(n);
  const aPos = new THREE.InstancedBufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const aSize = new THREE.InstancedBufferAttribute(size, 2);
  const aAlpha = new THREE.InstancedBufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aPos", aPos);
  geo.setAttribute("aSize", aSize);
  geo.setAttribute("aAlpha", aAlpha);
  const uniforms = { uMap: { value: map }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec3 aPos; attribute vec2 aSize; attribute float aAlpha;
      varying vec2 vUv; varying float vA;
      void main(){
        vUv = uv; vA = aAlpha;
        vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
        mv.xy += position.xy * aSize;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity;
      varying vec2 vUv; varying float vA;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        float a = t.a * vA * uOpacity;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor * t.rgb, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    pos,
    size,
    alpha,
    uniforms,
    commit(sizes = false) {
      aPos.needsUpdate = true;
      aAlpha.needsUpdate = true;
      if (sizes) aSize.needsUpdate = true;
    },
    dispose() {
      base.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
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

/** Lazy, self-healing lookup for an element that React owns (it may remount). */
export function domRef<T extends HTMLElement = HTMLElement>(selector: string) {
  let el: T | null = null;
  return () => {
    if (!el || !el.isConnected) el = document.querySelector<T>(selector);
    return el;
  };
}
