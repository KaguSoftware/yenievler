import * as THREE from "three";
import { damp, domRef, smooth, softTex } from "./common";
import { stoneTex } from "./stone";
import { C } from "./timeline";
import {
  BOWL_DEPTH,
  DRAIN_LOCAL,
  SINK_SCALE,
  SINK_T_MAX,
  SINK_T_MIN,
  SINK_X,
  SINK_Y,
  SINK_Z,
  sinkUi,
  type SinkMode,
  type SinkOutlet,
} from "./sinkState";
import type { BuildCtx, Frame, Stage } from "./stage";

/**
 * Timeline channel indices the stage reads. Passed in by world.ts so this file compiles on its own:
 *   on     0..1  visibility (gated by the world, read here for the shadow light and the captions)
 *   seq    0..5  the four keys press themselves in order at 0.35, 1.35, 2.35, 3.35; 4..5 fades the captions
 *   drain  0..1  plug lifts, outlets stop, the bowl empties in a vortex (the camera dives meanwhile)
 *   live   0..1  above 0.5 the outlets follow the console in the DOM (sinkUi) instead of `seq`
 */
export interface SinkChannels {
  on: number;
  seq: number;
  drain: number;
  live: number;
}

export interface SinkStage extends Stage {
  /** Switch the shadow light on once so its shader variants compile before the first frame. */
  prewarm(): void;
}

/* ------------------------------------------------------------- dimensions */
// Real metres. The model group is scaled by SINK_SCALE.

const X0 = -0.375;
const X1 = 0.375;
const Z0 = -0.225;
const Z1 = 0.225;
/** Front face of the raised deck along the back. */
const DECK_Z = -0.13;
const DECK_H = 0.032;
const OPEN = { x0: -0.35, x1: 0.35, z0: -0.122, z1: 0.205, r: 0.028 };
const FLOOR_Y = -BOWL_DEPTH;
const [DX, DZ] = DRAIN_LOCAL;
/** Water can rise this far above the floor with the plug in. */
const LEVEL_MAX = 0.06;

const OUTLETS: SinkOutlet[] = ["tap", "falls", "cups", "ro"];
const KEY_X = (i: number) => -0.026 + i * 0.03;
const KEY_Z = -0.152;

/** Where water leaves each outlet. */
const TAP_OUT = new THREE.Vector3(0.115, 0.235, -0.04);
const RO_OUT = new THREE.Vector3(0.322, 0.212, -0.11);
const RINSER = new THREE.Vector3(-0.315, DECK_H, -0.178);
const SLOT = { x0: -0.17, x1: -0.05, y: 0.016, z: DECK_Z + 0.002, vz: 0.55, vy: 0 };
const GRILLE = { x0: 0.256, x1: 0.334, y: DECK_H + 0.003, z: -0.138, vz: 0.3, vy: 0.06 };

/** Caption anchors, in OUTLETS order. */
const ANCHORS = [
  new THREE.Vector3(0.115, 0.3, -0.04),
  new THREE.Vector3(-0.11, 0.016, DECK_Z),
  new THREE.Vector3(-0.315, 0.09, -0.178),
  new THREE.Vector3(0.335, 0.27, -0.15),
];

const FINISH = [
  { steel: 0x3a3c41, rough: 0.44, metal: 0x5a5d63, metalRough: 0.24, rim: 0x404247 },
  { steel: 0xc9ccd0, rough: 0.34, metal: 0xdadcdf, metalRough: 0.16, rim: 0xd6d9dc },
];
const COLD = new THREE.Color(0xd2e8f4);
const HOT = new THREE.Color(0xf7dcc4);

/** Below this viewport width the captions sit on the parts instead of beside them. */
const COMPACT_W = 640;

/* ---------------------------------------------------------------- shapes */

/** Rounded rectangle on the floor plane. Shape y is -z, so a -PI/2 turn about X lays it flat, face up. */
function rrect<T extends THREE.Path>(p: T, x0: number, x1: number, z0: number, z1: number, r: number): T {
  const y0 = -z1;
  const y1 = -z0;
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.quadraticCurveTo(x1, y0, x1, y0 + r);
  p.lineTo(x1, y1 - r);
  p.quadraticCurveTo(x1, y1, x1 - r, y1);
  p.lineTo(x0 + r, y1);
  p.quadraticCurveTo(x0, y1, x0, y1 - r);
  p.lineTo(x0, y0 + r);
  p.quadraticCurveTo(x0, y0, x0 + r, y0);
  return p;
}

const circle = (x: number, z: number, r: number) => new THREE.Path().absarc(x, -z, r, 0, Math.PI * 2, true);

/** Inner walls of the bowl: a ribbon round the opening, normals facing in. */
function wallGeometry(): THREE.BufferGeometry {
  const pts = rrect(new THREE.Path(), OPEN.x0, OPEN.x1, OPEN.z0, OPEN.z1, OPEN.r).getSpacedPoints(220);
  const n = pts.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const cx = (OPEN.x0 + OPEN.x1) / 2;
  const cz = (OPEN.z0 + OPEN.z1) / 2;
  let len = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const o = pts[(i - 1 + n) % n];
    const x = p.x;
    const z = -p.y;
    let tx = q.x - o.x;
    let tz = -(q.y - o.y);
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    // Of the two horizontal normals, take the one pointing at the middle of the bowl.
    let nx = tz;
    let nz = -tx;
    if (nx * (cx - x) + nz * (cz - z) < 0) {
      nx = -nx;
      nz = -nz;
    }
    if (i > 0) len += Math.hypot(p.x - o.x, p.y - o.y);
    pos.push(x, 0, z, x, FLOOR_Y, z);
    nor.push(nx, 0, nz, nx, 0, nz);
    uv.push(len * 4, 1, len * 4, 0);
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 3;
    const d = a + 2;
    // Wind each quad so its face normal agrees with the inward normal.
    const ex = pos[d * 3] - pos[a * 3];
    const ez = pos[d * 3 + 2] - pos[a * 3 + 2];
    const fx = -BOWL_DEPTH * ez;
    const fz = BOWL_DEPTH * ex;
    if (fx * nor[a * 3] + fz * nor[a * 3 + 2] > 0) idx.push(a, b, d, b, c, d);
    else idx.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A waterfall: a ribbon that leaves an outlet at speed `vz` and falls under gravity to `yEnd`. */
function sheetGeometry(s: typeof SLOT, yEnd: number): { geo: THREE.BufferGeometry; landZ: number } {
  const g = 9.8;
  const T = (s.vy + Math.sqrt(s.vy * s.vy + 2 * g * (s.y - yEnd))) / g;
  const SEG = 32;
  const pos: number[] = [];
  const uv: number[] = [];
  for (let j = 0; j <= SEG; j++) {
    const t = (T * j) / SEG;
    const y = s.y + s.vy * t - 0.5 * g * t * t;
    const z = s.z + s.vz * t;
    // The sheet narrows a touch as it falls, like a real one.
    const pinch = 0.004 * (j / SEG);
    pos.push(s.x0 + pinch, y, z, s.x1 - pinch, y, z);
    uv.push(0, j / SEG, 1, j / SEG);
  }
  const idx: number[] = [];
  for (let j = 0; j < SEG; j++) {
    const a = j * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, landZ: s.z + s.vz * T };
}

/** Flat fan for the blade mode, 1 unit long, hanging from y = 0. */
function fanGeometry(): THREE.BufferGeometry {
  const pos = [-0.005, 0, 0, 0.005, 0, 0, -0.065, -1, 0, 0.065, -1, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  return g;
}

/* ---------------------------------------------------------------- shaders */

/**
 * Running water: streaks that travel along v (0 at the outlet, 1 where it lands). uHead is the
 * pouring front, uTail the end of the water once an outlet stops, so turning on pours and
 * turning off lets the last of it fall away.
 */
const FLOW_VS = /* glsl */ `
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FLOW_FS = /* glsl */ `
uniform float uTime;
uniform float uHead;
uniform float uTail;
uniform float uAlpha;
uniform float uCols;
uniform float uRows;
uniform float uSpeed;
uniform float uFlip;
uniform float uEdge;
uniform vec3 uColor;
varying vec2 vUv;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float v = mix(vUv.y, 1.0 - vUv.y, uFlip);
  float front = 1.0 - smoothstep(uHead - 0.08, uHead, v);
  float back = smoothstep(uTail - 0.08, uTail, v);
  float n = noise(vec2(vUv.x * uCols, v * uRows - uTime * uSpeed));
  float m = noise(vec2(vUv.x * uCols * 2.3 + 7.0, v * uRows * 0.45 - uTime * uSpeed * 1.4));
  float streak = 0.3 + 0.7 * n * n + 0.3 * m;
  float edge = smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
  float a = uAlpha * streak * mix(1.0, edge, uEdge) * front * back;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * (0.78 + 0.55 * n), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** Spiral arms turning into the drain. */
const VORTEX_FS = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
uniform vec3 uColor;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float arms = sin(a * 4.0 + log(r + 0.04) * 9.0 + uTime * 9.0);
  float ring = smoothstep(1.0, 0.55, r) * smoothstep(0.08, 0.3, r);
  float al = uAlpha * ring * (0.25 + 0.75 * smoothstep(0.2, 1.0, arms));
  if (al < 0.004) discard;
  gl_FragColor = vec4(uColor, al);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

type FlowMat = THREE.ShaderMaterial & {
  uniforms: Record<
    "uTime" | "uHead" | "uTail" | "uAlpha" | "uCols" | "uRows" | "uSpeed" | "uFlip" | "uEdge",
    { value: number }
  > & { uColor: { value: THREE.Color } };
};

function flowMat(o: { cols: number; rows: number; speed: number; alpha: number; flip: number; edge: number }): FlowMat {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uHead: { value: 0 },
        uTail: { value: 0 },
        uAlpha: { value: o.alpha },
        uCols: { value: o.cols },
        uRows: { value: o.rows },
        uSpeed: { value: o.speed },
        uFlip: { value: o.flip },
        uEdge: { value: o.edge },
        uColor: { value: new THREE.Color(0xd2e8f4) },
      },
    ]),
    vertexShader: FLOW_VS,
    fragmentShader: FLOW_FS,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  }) as FlowMat;
}

/* --------------------------------------------------------------- textures */

/** X-grooves cut from the corners to the drain, as a bump map over the floor's UV box. */
function grooveTex(): THREE.CanvasTexture {
  const W = 1024;
  const H = Math.round((W * (OPEN.z1 - OPEN.z0)) / (OPEN.x1 - OPEN.x0));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, W, H);
  // Fine brushing across the floor.
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) {
    g.globalAlpha = 0.06;
    g.fillStyle = rnd() > 0.5 ? "#9a9a9a" : "#6a6a6a";
    g.fillRect(0, rnd() * H, W, 1);
  }
  g.globalAlpha = 1;
  const u = (x: number) => ((x - OPEN.x0) / (OPEN.x1 - OPEN.x0)) * W;
  const v = (z: number) => ((z - OPEN.z0) / (OPEN.z1 - OPEN.z0)) * H;
  const corners: [number, number][] = [
    [OPEN.x0 + 0.03, OPEN.z0 + 0.03],
    [OPEN.x1 - 0.03, OPEN.z0 + 0.03],
    [OPEN.x0 + 0.03, OPEN.z1 - 0.03],
    [OPEN.x1 - 0.03, OPEN.z1 - 0.03],
  ];
  g.lineCap = "round";
  for (const [x, z] of corners) {
    g.strokeStyle = "#2a2a2a";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(u(x), v(z));
    g.lineTo(u(DX), v(DZ));
    g.stroke();
    g.strokeStyle = "#555";
    g.lineWidth = 15;
    g.globalAlpha = 0.4;
    g.stroke();
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  // ShapeGeometry UVs are shape coordinates (x, -z) in metres: map the opening's box onto 0..1.
  t.repeat.set(1 / (OPEN.x1 - OPEN.x0), 1 / (OPEN.z1 - OPEN.z0));
  t.offset.set(-OPEN.x0 / (OPEN.x1 - OPEN.x0), OPEN.z1 / (OPEN.z1 - OPEN.z0));
  // Canvas rows run with +z, shape v runs with -z: flip so the grooves meet at the drain.
  t.flipY = false;
  return t;
}

function holesTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c9cbce";
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = "#16171a";
  for (let y = 8; y < 96; y += 11)
    for (let x = 6 + ((y / 11) % 2) * 5; x < 256; x += 10) {
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft elliptical fade so the counter dissolves into the paper instead of ending on an edge. */
function fadeTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "#fff");
  gr.addColorStop(0.42, "#fff");
  gr.addColorStop(1, "#000");
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** Tileable ripple normals for the water surface. */
function rippleTex(): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  const h = (x: number, y: number) =>
    Math.sin(((x + y * 0.3) / S) * Math.PI * 2 * 3) * 0.5 +
    Math.sin(((y - x * 0.4) / S) * Math.PI * 2 * 5) * 0.3 +
    Math.sin(((x * 0.7 + y) / S) * Math.PI * 2 * 7) * 0.2;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const i = (y * S + x) * 4;
      img.data[i] = 128 + dx * 60;
      img.data[i + 1] = 128 + dy * 60;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  return t;
}

/* ------------------------------------------------------------------ stage */

/**
 * Piano: the kitchen sink, on a marble counter that dissolves into the paper. Four white keys on
 * a black glass deck run the tap, two waterfalls, the glass rinser and the drinking-water tap.
 * The scroll presses the keys in order (seq); in the console section the DOM drives them (live);
 * at the end the plug lifts and the bowl drains while the camera follows the water down.
 */
export function buildSink(ctx: BuildCtx, ch: SinkChannels): SinkStage {
  const group = new THREE.Group();
  group.position.set(SINK_X, SINK_Y, SINK_Z);
  const model = new THREE.Group();
  model.scale.setScalar(SINK_SCALE);
  group.add(model);
  // Read-only window into the model for tests in development, like window.__nimbo.
  if (process.env.NODE_ENV !== "production") (window as unknown as { __nimboSink: THREE.Group }).__nimboSink = model;
  const env = ctx.envBasin;

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const G = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);
  const M = <T extends THREE.Material>(m: T) => (mats.push(m), m);
  const T = <T extends THREE.Texture>(t: T) => (texs.push(t), t);
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = false, receive = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    model.add(m);
    return m;
  };
  const flat = (m: THREE.Object3D) => {
    m.rotation.x = -Math.PI / 2;
    return m;
  };

  /* lights: one key with a shadow, a cool fill, and a rim behind to draw the taps */
  const key = new THREE.DirectionalLight(0xfff1e2, 2.4);
  key.position.set(-1.1, 2.6, 1.6);
  key.castShadow = false;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: 0.5, far: 8 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.01;
  const fill = new THREE.DirectionalLight(0xd4e2ff, 0.7);
  fill.position.set(2, 1.2, 1.4);
  const rim = new THREE.DirectionalLight(0xffe2c8, 1.6);
  rim.position.set(0.4, 1.4, -2.4);
  // Under-cabinet light: a soft warm pool down into the bowl, so its floor and the water read.
  const bowlLight = new THREE.SpotLight(0xfff0e0, 9, 4, 0.75, 1, 1.2);
  bowlLight.position.set(-0.1, 1.5, 0.35);
  bowlLight.target.position.set(0, -0.45, 0);
  group.add(key, key.target, fill, fill.target, rim, rim.target, bowlLight, bowlLight.target);

  /* materials */
  const steel = M(
    new THREE.MeshPhysicalMaterial({
      color: FINISH[0].steel,
      metalness: 0.88,
      roughness: FINISH[0].rough,
      anisotropy: 0.6,
      envMap: env,
      envMapIntensity: 1.7,
    }),
  );
  const rimMat = M(steel.clone());
  rimMat.color.setHex(FINISH[0].rim);
  const grooves = T(grooveTex());
  const floorMat = M(steel.clone());
  floorMat.bumpMap = grooves;
  floorMat.bumpScale = 1.4;
  const tapMetal = M(
    new THREE.MeshPhysicalMaterial({
      color: FINISH[0].metal,
      metalness: 1,
      roughness: FINISH[0].metalRough,
      clearcoat: 0.5,
      clearcoatRoughness: 0.15,
      envMap: env,
    }),
  );
  const glassBlack = M(
    new THREE.MeshPhysicalMaterial({ color: 0x08090b, metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, envMap: env }),
  );
  const keyMat = M(
    new THREE.MeshPhysicalMaterial({ color: 0xf4f2ee, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.1, envMap: env }),
  );
  const black = M(new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.7 }));
  const brass = M(new THREE.MeshPhysicalMaterial({ color: 0xd2a650, metalness: 1, roughness: 0.25, envMap: env }));
  const holes = T(holesTex());
  const grilleMat = M(new THREE.MeshStandardMaterial({ map: holes, metalness: 0.8, roughness: 0.35, envMap: env }));
  const led = M(new THREE.MeshBasicMaterial({ color: 0x6f86ff, toneMapped: false }));

  /* counter */
  const marble = T(stoneTex({ name: "calacatta-counter", base: "#ece8e1", vein: "#a39d93", kind: "vein" }));
  marble.repeat.set(1 / 1.4, 1 / 1.4);
  const fade = T(fadeTex());
  fade.repeat.set(1 / 3.4, 1 / 2.2);
  fade.offset.set(0.5, 1.1 / 2.2);
  const counterMat = M(
    new THREE.MeshPhysicalMaterial({
      map: marble,
      alphaMap: fade,
      transparent: true,
      roughness: 0.3,
      clearcoat: 0.35,
      clearcoatRoughness: 0.2,
      envMap: env,
      envMapIntensity: 0.6,
    }),
  );
  const counterShape = rrect(new THREE.Shape(), -1.7, 1.7, -1.1, 1.1, 0.06);
  counterShape.holes.push(rrect(new THREE.Path(), X0 + 0.008, X1 - 0.008, Z0 + 0.008, Z1 - 0.008, 0.014));
  const counter = flat(mesh(G(new THREE.ExtrudeGeometry(counterShape, { depth: 0.04, bevelEnabled: false, curveSegments: 6 })), counterMat));
  counter.position.y = -0.046;

  /* the sink itself */
  const rimShape = rrect(new THREE.Shape(), X0, X1, Z0, Z1, 0.02);
  rimShape.holes.push(rrect(new THREE.Path(), OPEN.x0, OPEN.x1, OPEN.z0, OPEN.z1, OPEN.r));
  const rimMesh = flat(
    mesh(
      G(new THREE.ExtrudeGeometry(rimShape, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 3, curveSegments: 10 })),
      rimMat,
    ),
  );
  rimMesh.position.y = -0.004;
  mesh(G(wallGeometry()), steel);
  const floorShape = rrect(new THREE.Shape(), OPEN.x0, OPEN.x1, OPEN.z0, OPEN.z1, OPEN.r);
  floorShape.holes.push(circle(DX, DZ, 0.042));
  flat(mesh(G(new THREE.ShapeGeometry(floorShape, 12)), floorMat)).position.y = FLOOR_Y;

  // Drain: steel ring, the blue light, a pop-up plug, and the dark pipe the camera falls into.
  const drainRing = flat(mesh(G(new THREE.TorusGeometry(0.043, 0.004, 12, 64)), tapMetal));
  drainRing.position.set(DX, FLOOR_Y + 0.001, DZ);
  const ledRing = flat(new THREE.Mesh(G(new THREE.TorusGeometry(0.036, 0.0019, 8, 64)), led));
  ledRing.position.set(DX, FLOOR_Y + 0.0015, DZ);
  model.add(ledRing);
  const pipeMat = M(new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.5, metalness: 0.6, side: THREE.BackSide, envMap: env }));
  const pipe = mesh(G(new THREE.CylinderGeometry(0.034, 0.034, 0.8, 32, 1, true)), pipeMat, false, false);
  pipe.position.set(DX, FLOOR_Y - 0.4, DZ);
  const plug = mesh(G(new THREE.CylinderGeometry(0.031, 0.031, 0.006, 40)), tapMetal, true);
  plug.position.set(DX, FLOOR_Y + 0.002, DZ);

  // Raised deck along the back, black glass on top.
  const deckShape = rrect(new THREE.Shape(), X0 + 0.004, X1 - 0.004, Z0 + 0.004, DECK_Z, 0.012);
  const deck = flat(
    mesh(
      G(new THREE.ExtrudeGeometry(deckShape, { depth: DECK_H - 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 })),
      rimMat,
    ),
  );
  deck.position.y = 0.002;
  const panel = flat(mesh(G(new THREE.ShapeGeometry(rrect(new THREE.Shape(), -0.262, 0.348, -0.214, -0.136, 0.006), 4)), glassBlack));
  panel.position.y = DECK_H + 0.0006;
  const slot = mesh(G(new THREE.BoxGeometry(SLOT.x1 - SLOT.x0, 0.005, 0.004)), black);
  slot.position.set((SLOT.x0 + SLOT.x1) / 2, SLOT.y, DECK_Z + 0.0012);

  // Four keys, their lights, and the display.
  const keyGeo = G(
    new THREE.ExtrudeGeometry(rrect(new THREE.Shape(), -0.0125, 0.0125, -0.017, 0.017, 0.0035), {
      depth: 0.005,
      bevelEnabled: true,
      bevelThickness: 0.0015,
      bevelSize: 0.0012,
      bevelSegments: 3,
      curveSegments: 4,
    }),
  );
  const keys = OUTLETS.map((_, i) => {
    const k = flat(mesh(keyGeo, keyMat, true));
    k.position.set(KEY_X(i), DECK_H + 0.0016, KEY_Z);
    return k;
  });
  const lightMat = M(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const lights = new THREE.InstancedMesh(G(new THREE.BoxGeometry(0.013, 0.0012, 0.0024)), lightMat, 4);
  const LIGHT_OFF = new THREE.Color(0x9a9a98);
  const LIGHT_ON = new THREE.Color().setRGB(1.0, 0.36, 0.16);
  for (let i = 0; i < 4; i++) lights.setColorAt(i, LIGHT_OFF);
  model.add(lights);

  const dispCanvas = document.createElement("canvas");
  dispCanvas.width = 256;
  dispCanvas.height = 112;
  const dispCtx = dispCanvas.getContext("2d")!;
  const dispTex = T(new THREE.CanvasTexture(dispCanvas));
  dispTex.colorSpace = THREE.SRGBColorSpace;
  const dispMat = M(new THREE.MeshBasicMaterial({ map: dispTex, toneMapped: false }));
  const display = flat(mesh(G(new THREE.PlaneGeometry(0.058, 0.0254)), dispMat, false, false));
  display.position.set(0.172, DECK_H + 0.0009, -0.172);
  let dispShown = "";
  const font = () => getComputedStyle(document.body).fontFamily || "sans-serif";
  const drawDisplay = (text: string) => {
    if (text === dispShown) return;
    dispShown = text;
    const g = dispCtx;
    g.fillStyle = "#050506";
    g.fillRect(0, 0, 256, 112);
    g.fillStyle = "#ff6a3d";
    g.shadowColor = "#ff5a2a";
    g.shadowBlur = 14;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `600 78px ${font()}`;
    g.fillText(text, 128, 60);
    g.shadowBlur = 0;
    dispTex.needsUpdate = true;
  };

  // Knobs: temperature on the left, drain on the right. Each has a vermilion mark that turns.
  const knobGeo = G(new THREE.CylinderGeometry(0.0165, 0.0175, 0.03, 48));
  const markGeo = G(new THREE.BoxGeometry(0.0026, 0.0016, 0.011));
  const markMat = M(new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.0, 0.36, 0.16), toneMapped: false }));
  const knob = (x: number) => {
    const k = new THREE.Group();
    k.position.set(x, DECK_H, -0.18);
    const body = new THREE.Mesh(knobGeo, tapMetal);
    body.position.y = 0.015;
    body.castShadow = true;
    const mark = new THREE.Mesh(markGeo, markMat);
    mark.position.set(0, 0.0305, -0.007);
    k.add(body, mark);
    model.add(k);
    return k;
  };
  const tempKnob = knob(-0.195);
  const drainKnob = knob(0.235);

  // Soap pump.
  const soap = new THREE.Group();
  soap.position.set(-0.24, DECK_H, -0.18);
  const soapBody = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0125, 0.014, 0.05, 32)), tapMetal);
  soapBody.position.y = 0.025;
  const soapHead = new THREE.Mesh(G(new THREE.BoxGeometry(0.02, 0.012, 0.018)), tapMetal);
  soapHead.position.y = 0.056;
  const soapSpout = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0034, 0.0034, 0.032, 12)), tapMetal);
  soapSpout.rotation.x = Math.PI / 2;
  soapSpout.position.set(0, 0.058, 0.022);
  [soapBody, soapHead, soapSpout].forEach((m) => (m.castShadow = true));
  soap.add(soapBody, soapHead, soapSpout);
  model.add(soap);

  // Glass rinser: ribbed plate and a brass nozzle.
  const plate = mesh(G(new THREE.BoxGeometry(0.086, 0.004, 0.062)), grilleMat);
  plate.position.set(RINSER.x, DECK_H + 0.002, RINSER.z);
  const ribs = new THREE.InstancedMesh(G(new THREE.BoxGeometry(0.003, 0.003, 0.058)), tapMetal, 8);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 8; i++) {
    const x = RINSER.x - 0.038 + i * 0.0109;
    if (Math.abs(x - RINSER.x) < 0.008) m4.makeTranslation(0, -10, 0);
    else m4.makeTranslation(x, DECK_H + 0.005, RINSER.z);
    ribs.setMatrixAt(i, m4);
  }
  model.add(ribs);
  const nozzle = mesh(G(new THREE.CylinderGeometry(0.0055, 0.0065, 0.014, 24)), brass, true);
  nozzle.position.set(RINSER.x, DECK_H + 0.007, RINSER.z);

  // Waterfall grille on the deck.
  const grille = mesh(G(new THREE.BoxGeometry(GRILLE.x1 - GRILLE.x0, 0.003, 0.03)), grilleMat);
  grille.position.set((GRILLE.x0 + GRILLE.x1) / 2, DECK_H + 0.0015, -0.152);

  // Pull-out tap: a goose neck from the deck, a hanging head.
  const neck = new THREE.CurvePath<THREE.Vector3>();
  neck.add(new THREE.LineCurve3(new THREE.Vector3(0.115, DECK_H, -0.178), new THREE.Vector3(0.115, 0.3, -0.178)));
  neck.add(
    new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.115, 0.3, -0.178),
      new THREE.Vector3(0.115, 0.43, -0.178),
      new THREE.Vector3(0.115, 0.43, -0.04),
      new THREE.Vector3(0.115, 0.335, -0.04),
    ),
  );
  mesh(G(new THREE.TubeGeometry(neck, 160, 0.0105, 24, false)), tapMetal, true);
  const collar = mesh(G(new THREE.CylinderGeometry(0.019, 0.021, 0.014, 48)), tapMetal, true);
  collar.position.set(0.115, DECK_H + 0.007, -0.178);
  const head = mesh(G(new THREE.CylinderGeometry(0.0165, 0.0155, 0.1, 48)), tapMetal, true);
  head.position.set(TAP_OUT.x, TAP_OUT.y + 0.05, TAP_OUT.z);
  const face = flat(mesh(G(new THREE.CircleGeometry(0.0135, 32)), black, false, false));
  face.rotation.x = Math.PI / 2;
  face.position.set(TAP_OUT.x, TAP_OUT.y - 0.0005, TAP_OUT.z);

  // Drinking-water tap with its quarter-turn lever.
  const roNeck = new THREE.CurvePath<THREE.Vector3>();
  roNeck.add(new THREE.LineCurve3(new THREE.Vector3(0.352, DECK_H, -0.19), new THREE.Vector3(0.352, 0.2, -0.19)));
  roNeck.add(
    new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.352, 0.2, -0.19),
      new THREE.Vector3(0.352, 0.3, -0.19),
      new THREE.Vector3(RO_OUT.x, 0.3, RO_OUT.z),
      new THREE.Vector3(RO_OUT.x, RO_OUT.y, RO_OUT.z),
    ),
  );
  mesh(G(new THREE.TubeGeometry(roNeck, 120, 0.0055, 16, false)), tapMetal, true);
  const roCollar = mesh(G(new THREE.CylinderGeometry(0.011, 0.012, 0.01, 32)), tapMetal, true);
  roCollar.position.set(0.352, DECK_H + 0.005, -0.19);
  const roLever = mesh(G(new THREE.CylinderGeometry(0.0028, 0.0028, 0.036, 12)), tapMetal, true);
  roLever.position.set(0.352, 0.15, -0.19);
  roLever.rotation.z = Math.PI / 2;

  // An upturned glass that comes down onto the rinser when its key is pressed.
  const glassProf = [
    [0.031, 0], [0.0325, 0.002], [0.029, 0.1], [0.0, 0.1], [0.0, 0.096], [0.026, 0.096], [0.0295, 0.004], [0.0285, 0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glassMat = M(
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0, clearcoat: 1, envMap: env, side: THREE.DoubleSide, depthWrite: false }),
  );
  const glass = mesh(G(new THREE.LatheGeometry(glassProf, 48)), glassMat, false, false);
  glass.position.set(RINSER.x, DECK_H + 0.004, RINSER.z);

  /* water */
  const tapStream = flowMat({ cols: 3, rows: 14, speed: 6, alpha: 0.85, flip: 1, edge: 0 });
  const tapSpray = flowMat({ cols: 26, rows: 30, speed: 7, alpha: 0.6, flip: 1, edge: 0 });
  const tapBlade = flowMat({ cols: 18, rows: 16, speed: 6, alpha: 0.6, flip: 0, edge: 1 });
  const fallsA = flowMat({ cols: 30, rows: 9, speed: 3.2, alpha: 0.7, flip: 0, edge: 1 });
  const fallsB = flowMat({ cols: 22, rows: 9, speed: 3.2, alpha: 0.7, flip: 0, edge: 1 });
  const roMat = flowMat({ cols: 2, rows: 18, speed: 5, alpha: 0.85, flip: 1, edge: 0 });
  const jetMat = flowMat({ cols: 14, rows: 6, speed: 5, alpha: 0.75, flip: 0, edge: 0 });
  const flows = [tapStream, tapSpray, tapBlade, fallsA, fallsB, roMat, jetMat];
  flows.forEach((m) => mats.push(m));

  const unitTube = (r0: number, r1: number) => {
    const g = G(new THREE.CylinderGeometry(r0, r1, 1, 20, 1, true));
    g.translate(0, -0.5, 0);
    return g;
  };
  const streamMesh = mesh(unitTube(0.0058, 0.0052), tapStream, false, false);
  const sprayMesh = mesh(unitTube(0.011, 0.05), tapSpray, false, false);
  const bladeMesh = mesh(G(fanGeometry()), tapBlade, false, false);
  [streamMesh, sprayMesh, bladeMesh].forEach((m) => m.position.copy(TAP_OUT));
  const roStream = mesh(unitTube(0.0026, 0.0024), roMat, false, false);
  roStream.position.copy(RO_OUT);
  const sheetA = sheetGeometry(SLOT, FLOOR_Y);
  const sheetB = sheetGeometry(GRILLE, FLOOR_Y);
  const sheetMeshA = mesh(G(sheetA.geo), fallsA, false, false);
  const sheetMeshB = mesh(G(sheetB.geo), fallsB, false, false);
  const jetGeo = G(new THREE.CylinderGeometry(0.02, 0.003, 0.075, 20, 1, true));
  jetGeo.translate(0, 0.0375, 0);
  const jets = mesh(jetGeo, jetMat, false, false);
  jets.position.set(RINSER.x, DECK_H + 0.014, RINSER.z);

  const ripple = T(rippleTex());
  const surfMat = M(
    new THREE.MeshPhysicalMaterial({
      color: 0x6f8a97,
      metalness: 0,
      roughness: 0.02,
      transparent: true,
      opacity: 0.36,
      envMapIntensity: 0.9,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      normalMap: ripple,
      normalScale: new THREE.Vector2(0.35, 0.35),
      envMap: env,
      depthWrite: false,
    }),
  );
  const surfShape = rrect(new THREE.Shape(), OPEN.x0 + 0.002, OPEN.x1 - 0.002, OPEN.z0 + 0.002, OPEN.z1 - 0.002, OPEN.r);
  const surface = flat(mesh(G(new THREE.ShapeGeometry(surfShape, 10)), surfMat, false, false));
  surface.position.y = FLOOR_Y;
  surface.visible = false;

  const vortexMat = M(
    new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(0xf2f8fb) } }]),
      vertexShader: FLOW_VS,
      fragmentShader: VORTEX_FS,
      transparent: true,
      depthWrite: false,
      fog: true,
    }),
  );
  const vortex = flat(mesh(G(new THREE.PlaneGeometry(0.17, 0.17)), vortexMat, false, false));
  vortex.position.set(DX, FLOOR_Y + 0.003, DZ);

  // Splashes where the water lands. A small set of our own, recycled.
  const NS = 280;
  const sp = new Float32Array(NS * 3);
  const sv = new Float32Array(NS * 3);
  const sl = new Float32Array(NS);
  for (let i = 0; i < NS; i++) sp[i * 3 + 1] = -50;
  const spGeo = G(new THREE.BufferGeometry());
  spGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const dot = T(softTex());
  const spMat = M(new THREE.PointsMaterial({ size: 0.014, map: dot, color: 0xeaf4f8, transparent: true, opacity: 0.9, depthWrite: false }));
  const splashes = new THREE.Points(spGeo, spMat);
  splashes.frustumCulled = false;
  model.add(splashes);
  let spi = 0;
  const splash = (x: number, y: number, z: number, spread: number, up: number) => {
    const j = (spi = (spi + 1) % NS);
    const a = Math.random() * Math.PI * 2;
    const h = spread * (0.3 + Math.random() * 0.7);
    sp[j * 3] = x;
    sp[j * 3 + 1] = y;
    sp[j * 3 + 2] = z;
    sv[j * 3] = Math.cos(a) * h;
    sv[j * 3 + 1] = up * (0.5 + Math.random() * 0.7);
    sv[j * 3 + 2] = Math.sin(a) * h;
    sl[j] = 1;
  };

  /* -------------------------------------------------------------- state */
  // Per outlet: the pouring front and the falling tail, 0..1.2 (shader units), and the key travel.
  const headP = new Float64Array(4);
  const tailP = new Float64Array(4);
  const press = new Float64Array(4);
  const wantOn = [false, false, false, false];
  let modeW = [1, 0, 0];
  let level = 0;
  let heat = 0;
  let finishT = 0;
  let finishShown = -1;
  let glassIn = 0;
  let plugLift = 0;
  let time = 0;
  let acc = 0;
  let lastLights = -1;
  const col = new THREE.Color();
  const v = new THREE.Vector3();
  const right = new THREE.Vector3();

  const applyFinish = (t: number) => {
    const a = FINISH[0];
    const b = FINISH[1];
    steel.color.setHex(a.steel).lerp(col.setHex(b.steel), t);
    floorMat.color.copy(steel.color);
    rimMat.color.setHex(a.rim).lerp(col.setHex(b.rim), t);
    steel.roughness = floorMat.roughness = rimMat.roughness = a.rough + (b.rough - a.rough) * t;
    tapMetal.color.setHex(a.metal).lerp(col.setHex(b.metal), t);
    tapMetal.roughness = a.metalRough + (b.metalRough - a.metalRough) * t;
  };
  applyFinish(0);

  /* ------------------------------------------------------------ captions */
  const labelsEl = domRef("[data-sink-labels]");
  const barEl = domRef("[data-sink-bar]");
  let nodes: HTMLElement[] = [];
  let pips: HTMLElement[] = [];
  let nodesFor: HTMLElement | null = null;
  let labelsHidden = false;
  let lastBar = -1;

  const hideLabels = () => {
    if (labelsHidden) return;
    labelsHidden = true;
    nodes.forEach((n) => {
      n.style.opacity = "0";
      n.dataset.op = "0.000";
    });
  };

  const placeLabels = (f: Frame, seq: number) => {
    const lab = labelsEl();
    if (!lab) return;
    const compact = f.vw < COMPACT_W;
    if (lab.hasAttribute("data-compact") !== compact) lab.toggleAttribute("data-compact", compact);
    if (nodesFor !== lab) {
      nodesFor = lab;
      nodes = Array.from(lab.querySelectorAll<HTMLElement>("[data-sink-part]"));
      pips = Array.from(document.querySelectorAll<HTMLElement>("[data-sink-pip]"));
    }
    labelsHidden = false;
    const out = 1 - smooth(4.15, 4.6, seq);
    right.set(1, 0, 0).applyQuaternion(f.cam.quaternion);
    for (let i = 0; i < nodes.length && i < 4; i++) {
      const node = nodes[i];
      // Each caption hands over to the next; the pips below keep the count.
      const next = i < 3 ? 1 - smooth(i + 1.25, i + 1.55, seq) : 1;
      const op = smooth(i + 0.3, i + 0.75, seq) * next * out;
      const opS = op.toFixed(3);
      if (op < 0.01 && node.dataset.op === "0.000") continue;
      node.dataset.op = op < 0.01 ? "0.000" : opS;
      v.copy(ANCHORS[i]);
      model.localToWorld(v);
      v.project(f.cam);
      const sx = ((v.x + 1) / 2) * f.vw;
      const sy = ((1 - v.y) / 2) * f.vh;
      node.style.opacity = op < 0.01 ? "0" : opS;
      node.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translateY(${((1 - op) * 10).toFixed(1)}px)`;
      // Captions read to the right of their dot, or to the left near the right edge.
      const side = sx > f.vw * 0.7 ? "l" : "r";
      if (node.dataset.side !== side) node.dataset.side = side;
    }
    for (let i = 0; i < pips.length && i < 4; i++) {
      const on = seq >= i + 0.35 ? "1" : "";
      if ((pips[i].dataset.on ?? "") !== on) pips[i].dataset.on = on;
    }
    const bar = barEl();
    if (bar) {
      const b = Math.round(Math.min(1, Math.max(0, seq / 4)) * 1000) / 1000;
      if (b !== lastBar) {
        lastBar = b;
        bar.style.transform = `scaleX(${b})`;
      }
    }
  };

  /* -------------------------------------------------------------- update */
  return {
    group,
    prewarm() {
      key.castShadow = true;
    },
    always(f: Frame) {
      if (f.s[ch.on] < 0.01) hideLabels();
    },
    update(f: Frame) {
      const s = f.s;
      const dt = f.dt;
      const reduced = f.reduced;
      time += dt;
      const seq = s[ch.seq];
      const drain = s[ch.drain];
      const live = s[ch.live] > 0.5;

      // One shadow light at a time: the basin's owns the shadows once it is in.
      key.castShadow = s[ch.on] > 0.5 && s[C.basin] < 0.05;

      // What each outlet should do: the scroll's sequence, or the console once it is live.
      const flowing = 1 - smooth(0.05, 0.25, drain);
      for (let i = 0; i < 4; i++) {
        const o = OUTLETS[i];
        const want = (live ? sinkUi[o] : seq >= i + 0.35) && flowing > 0.5;
        wantOn[i] = want;
        if (reduced) {
          press[i] = want ? 1 : 0;
          headP[i] = want ? 1.2 : 0;
          tailP[i] = 0;
          continue;
        }
        press[i] += ((want ? 1 : 0) - press[i]) * damp(dt, 22);
        if (want) {
          if (tailP[i] > 0) tailP[i] = Math.max(0, tailP[i] - dt * 3);
          else headP[i] = Math.min(1.2, headP[i] + dt * 2.6);
        } else if (headP[i] > 0) {
          tailP[i] = Math.min(1.2, tailP[i] + dt * 2.6);
          if (tailP[i] >= 1.2) headP[i] = tailP[i] = 0;
        }
      }
      for (let i = 0; i < 4; i++) keys[i].position.y = DECK_H + 0.0016 - press[i] * 0.0042;

      const lightsKey = wantOn.reduce((k, w, i) => k | ((w ? 1 : 0) << i), 0);
      for (let i = 0; i < 4; i++) {
        m4.makeTranslation(KEY_X(i), DECK_H + 0.0095 - press[i] * 0.0042, KEY_Z + 0.0135);
        lights.setMatrixAt(i, m4);
      }
      lights.instanceMatrix.needsUpdate = true;
      if (lightsKey !== lastLights) {
        lastLights = lightsKey;
        for (let i = 0; i < 4; i++) lights.setColorAt(i, wantOn[i] ? LIGHT_ON : LIGHT_OFF);
        if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
      }

      // Finish: black for the show, whatever the console picked once it is live.
      const fWant = live ? sinkUi.finish : 0;
      finishT = reduced ? fWant : finishT + (fWant - finishT) * damp(dt, 6);
      const fq = Math.round(finishT * 200) / 200;
      if (fq !== finishShown) {
        finishShown = fq;
        applyFinish(finishT);
      }

      // Temperature: the display counts up while hot water runs.
      const temp = live ? sinkUi.temp : 38;
      const hot = wantOn[0] || wantOn[1];
      heat = reduced ? (hot ? 1 : 0) : heat + ((hot ? 1 : 0) - heat) * damp(dt, 1.6);
      drawDisplay(heat > 0.02 ? `${Math.round(SINK_T_MIN + (temp - SINK_T_MIN) * heat)}°` : "--");
      tempKnob.rotation.y = -((temp - SINK_T_MIN) / (SINK_T_MAX - SINK_T_MIN) - 0.5) * Math.PI * 1.5;
      col.copy(COLD).lerp(HOT, ((temp - SINK_T_MIN) / (SINK_T_MAX - SINK_T_MIN)) * heat);
      for (const m of flows) {
        m.uniforms.uTime.value = time;
        m.uniforms.uColor.value.copy(col);
      }

      // The plug: in during the show (the bowl fills), the console's choice once live, out to drain.
      const plugIn = drain > 0.12 ? false : live ? sinkUi.plug : true;
      plugLift += ((plugIn ? 0 : 1) - plugLift) * (reduced ? 1 : damp(dt, 8));
      plug.position.y = FLOOR_Y + 0.002 + plugLift * 0.014;
      // The pipe under the drain is only for the dive; otherwise it shows through the counter's fade.
      pipe.visible = drain > 0.05;
      drainKnob.rotation.y = plugLift * (Math.PI / 2);
      led.color.setRGB(0.44, 0.53, 1).multiplyScalar(0.55 + plugLift * 0.65);

      const anyWater = wantOn[0] || wantOn[1] || wantOn[3];
      const goal = plugIn && anyWater ? LEVEL_MAX : plugIn ? level : 0;
      if (reduced) level = goal;
      else if (goal > level) level = Math.min(goal, level + dt * 0.012);
      else level = Math.max(goal, level - dt * (drain > 0.12 ? 0.05 : 0.03));
      const shownLevel = level * (1 - smooth(0.15, 0.75, drain));
      surface.visible = shownLevel > 0.002;
      surface.position.y = FLOOR_Y + shownLevel;
      if (!reduced) ripple.offset.set(time * 0.02, time * 0.013);
      const waterY = FLOOR_Y + shownLevel;

      // Vortex while the bowl empties.
      const swirl = Math.max(smooth(0.1, 0.3, drain) * (1 - smooth(0.75, 0.95, drain)), !plugIn && level > 0.004 ? 0.8 : 0);
      vortexMat.uniforms.uAlpha.value = swirl * 0.7;
      vortexMat.uniforms.uTime.value = time;
      vortex.visible = swirl > 0.01;
      vortex.position.y = Math.max(waterY, FLOOR_Y) + 0.002;

      // Tap: three heads, cross-faded, all landing on the water.
      const mode: SinkMode = live ? sinkUi.mode : "stream";
      const mw = [mode === "stream" ? 1 : 0, mode === "spray" ? 1 : 0, mode === "blade" ? 1 : 0];
      modeW = reduced ? mw : modeW.map((w, i) => w + (mw[i] - w) * damp(dt, 8));
      const tapLen = TAP_OUT.y - waterY;
      const tapMeshes = [streamMesh, sprayMesh, bladeMesh];
      const tapMats = [tapStream, tapSpray, tapBlade];
      const base = [0.85, 0.6, 0.6];
      for (let k = 0; k < 3; k++) {
        tapMeshes[k].scale.y = tapLen;
        tapMats[k].uniforms.uHead.value = headP[0];
        tapMats[k].uniforms.uTail.value = tailP[0];
        tapMats[k].uniforms.uAlpha.value = base[k] * modeW[k];
        tapMats[k].uniforms.uRows.value = (k === 1 ? 30 : 14) * (tapLen / 0.45);
        tapMeshes[k].visible = headP[0] > 0 && modeW[k] > 0.01;
      }
      // The fan faces the camera's side of the bowl.
      bladeMesh.rotation.y = Math.atan2(f.cam.position.x - group.position.x, f.cam.position.z - group.position.z) * 0.3;

      roStream.scale.y = RO_OUT.y - waterY;
      roMat.uniforms.uHead.value = headP[3];
      roMat.uniforms.uTail.value = tailP[3];
      roStream.visible = headP[3] > 0;
      roLever.rotation.y = press[3] * (Math.PI / 2);

      fallsA.uniforms.uHead.value = fallsB.uniforms.uHead.value = headP[1];
      fallsA.uniforms.uTail.value = fallsB.uniforms.uTail.value = tailP[1];
      sheetMeshA.visible = sheetMeshB.visible = headP[1] > 0;

      jetMat.uniforms.uHead.value = headP[2];
      jetMat.uniforms.uTail.value = tailP[2];
      jets.visible = headP[2] > 0;
      glassIn = reduced ? (wantOn[2] ? 1 : 0) : glassIn + ((wantOn[2] ? 1 : 0) - glassIn) * damp(dt, 5);
      glass.visible = glassIn > 0.01;
      glass.position.y = DECK_H + 0.004 + (1 - glassIn) * 0.12;
      glassMat.opacity = 0.28 * glassIn;

      // Splashes where each stream lands (time-based: none under reduced motion).
      if (!reduced && dt > 0) {
        acc += dt * 90;
        while (acc >= 1) {
          acc -= 1;
          if (headP[0] >= 1.05 && tailP[0] < 0.9) splash(TAP_OUT.x, waterY + 0.002, TAP_OUT.z, 0.35 + modeW[2] * 0.3, 0.9);
          if (headP[1] >= 1.05 && tailP[1] < 0.9) {
            splash(SLOT.x0 + Math.random() * (SLOT.x1 - SLOT.x0), waterY + 0.002, sheetA.landZ, 0.18, 0.55);
            if (Math.random() < 0.6) splash(GRILLE.x0 + Math.random() * (GRILLE.x1 - GRILLE.x0), waterY + 0.002, sheetB.landZ, 0.18, 0.5);
          }
          if (headP[3] >= 1.05 && tailP[3] < 0.9 && Math.random() < 0.4) splash(RO_OUT.x, waterY + 0.002, RO_OUT.z, 0.15, 0.45);
        }
        for (let i = 0; i < NS; i++) {
          if (!sl[i]) continue;
          const k = i * 3;
          sv[k + 1] -= 6 * dt;
          sp[k] += sv[k] * dt;
          sp[k + 1] += sv[k + 1] * dt;
          sp[k + 2] += sv[k + 2] * dt;
          if (sp[k + 1] < waterY) {
            sl[i] = 0;
            sp[k + 1] = -50;
          }
        }
        spGeo.attributes.position.needsUpdate = true;
      }
      splashes.visible = !reduced;

      model.updateMatrixWorld(true);
      placeLabels(f, seq);
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
      lights.dispose();
      ribs.dispose();
      key.dispose();
      fill.dispose();
      rim.dispose();
      bowlLight.dispose();
    },
  };
}
