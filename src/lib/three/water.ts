import * as THREE from "three";
import { rawColor } from "./common";
import { FLOWS, type Flow } from "./flows";
import { C, HEAD_R, labToLinear } from "./timeline";
import type { Frame, Stage } from "./stage";

/**
 * The thread of the whole page. One heightfield floor with a planar reflection, one drop system,
 * one splash system. Three kinds of drop share it:
 *   0 column: the rain curtain, which narrows into the basin stream (emitter height and radius come from the timeline)
 *   1 spill:  the sheet that goes over the slab edge when the basin overflows
 *   2 field:  rain over the whole pool, for the footer
 */

const SIZE = 16;
const N_COL = 1900;
const N_SPILL = 400;
const N_FIELD = 500;
const N = N_COL + N_SPILL + N_FIELD;
const SPLASHES = 2600;

const CREAM = new THREE.Color(0xfff6ee);
const STEEL = new THREE.Color(0x3d4852);

export interface Pool {
  on: boolean;
  x: number;
  z: number;
  y: number;
  r: number;
}
export interface Hand {
  on: boolean;
  x: number;
  y: number;
  z: number;
}
export interface Spill {
  y: number;
  z: number;
  x0: number;
  x1: number;
}

export interface Water extends Stage {
  hand: Hand;
  pool: Pool;
  spill: Spill;
  /** Render the planar reflection into the target. Call before the main pass, only if the floor shows. */
  reflect(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    cam: THREE.PerspectiveCamera,
    look: THREE.Vector3,
  ): void;
  /**
   * In place of reflect() on a frame where the mirror would show nothing worth a second pass over the
   * scene: the target is wiped to the backdrop, once per backdrop colour (`backdrop` is any number
   * that changes with it), and the floor keeps its view-dependent sheen.
   */
  plain(renderer: THREE.WebGLRenderer, cam: THREE.PerspectiveCamera, backdrop: number): void;
  /** How much of the mirror the floor shows right now, 0..1 (wetness and gloss together). */
  mirror(): number;
  floorShown(): boolean;
  /** Push the surface at a world point (a hand passing over the floor). */
  poke(x: number, z: number, a: number): void;
}

export function buildWater(density = 1, lite = false): Water {
  const group = new THREE.Group();
  const scratch = new Float64Array(3);
  // The ripple grid: stepped, re-normalled and uploaded on every frame the surface moves, so a phone
  // gets about half the cells. At its screen size the ripples read the same.
  const GRID = lite ? 104 : 140;
  const STEP = SIZE / (GRID - 1);
  /** The mirror's share of the screen's pixels, per axis. */
  const RT_SCALE = lite ? 0.36 : 0.5;

  /* ------------------------------------------------------------- the floor */
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, GRID - 1, GRID - 1);
  geo.rotateX(-Math.PI / 2);
  const rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType });
  const mat = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      tR: { value: rt.texture },
      texM: { value: new THREE.Matrix4() },
      camPos: { value: new THREE.Vector3() },
      uWet: { value: 0 },
      uDry: { value: new THREE.Color() },
      uTint: { value: new THREE.Color() },
      uFog: { value: rawColor(0) },
      uRad: { value: 0 },
      uTime: { value: 0 },
      uOff: { value: new THREE.Vector2() },
      uVis: { value: 1 },
      uGloss: { value: 1 },
      uFade: { value: new THREE.Vector2(4.2, 7.6) },
    },
    vertexShader: /* glsl */ `
      uniform mat4 texM; varying vec4 vR; varying vec3 vN; varying vec3 vW; varying vec2 vL;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vL = position.xz;
        vN = normalize(mat3(modelMatrix) * normal);
        vR = texM * vec4(position,1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tR; uniform vec3 camPos; uniform float uWet; uniform vec3 uTint; uniform vec3 uDry; uniform vec3 uFog;
      uniform float uRad; uniform float uTime; uniform vec2 uOff; uniform float uVis; uniform vec2 uFade; uniform float uGloss;
      varying vec4 vR; varying vec3 vN; varying vec3 vW; varying vec2 vL;
      #include <common>
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(camPos - vW);
        float f = 0.04 + 0.96 * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 5.0);
        vec4 c = vR; c.xy += n.xz * 0.22 * c.w;
        vec3 refl = texture2DProj(tR, c).rgb;
        vec2 p = vL - uOff;
        float d = length(p);
        float ang = atan(p.y, p.x);
        float edge = uRad * (1.0 + 0.13 * sin(ang * 5.0 + 1.3) + 0.07 * sin(ang * 11.0 - uTime * 0.2) + 0.05 * sin(ang * 3.0 + uTime * 0.1));
        float wet = (1.0 - smoothstep(edge * 0.82, edge, d)) * uWet;
        float slope = clamp(1.0 - n.y, 0.0, 1.0);
        vec3 base = mix(uDry, mix(uDry * 0.9, uTint, 0.5), wet);
        base *= 1.0 - slope * 10.0 * wet;
        vec3 h = normalize(normalize(vec3(-0.3, 1.0, 0.6)) + v);
        float spec = pow(max(dot(n, h), 0.0), 140.0) * 2.4 * wet * uGloss;
        vec3 col = mix(base, refl * vec3(0.9, 0.86, 0.84), ((0.32 + 0.6 * f) * wet + 0.03) * uGloss) + spec;
        col = mix(col, col * 0.78, smoothstep(edge * 0.95, edge * 0.82, d) * (1.0 - smoothstep(edge * 0.82, edge * 0.6, d)) * uWet);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        // the plane has no visible edge: it dissolves into the backdrop, and so does a hidden floor
        float away = max(smoothstep(uFade.x, uFade.y, length(vL)), 1.0 - uVis);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFog, away);
      }`,
  });
  const floor = new THREE.Mesh(geo, mat);
  floor.frustumCulled = false;
  group.add(floor);
  const mcam = new THREE.PerspectiveCamera();
  let cur = new Float32Array(GRID * GRID);
  let prev = new Float32Array(GRID * GRID);
  const pa = geo.attributes.position.array as Float32Array;
  const na = geo.attributes.normal.array as Float32Array;
  /** The surface has settled flat: nothing to step or upload until something touches it. */
  let calm = true;
  const impulse = (x: number, z: number, a: number) => {
    const ix = Math.round((x + SIZE / 2) / STEP);
    const iz = Math.round((z + SIZE / 2) / STEP);
    if (ix < 2 || iz < 2 || ix > GRID - 3 || iz > GRID - 3) return;
    calm = false;
    const i = iz * GRID + ix;
    cur[i] += a;
    cur[i - 1] += a * 0.25;
    cur[i + 1] += a * 0.25;
    cur[i - GRID] += a * 0.25;
    cur[i + GRID] += a * 0.25;
  };
  const stepField = () => {
    for (let z = 1; z < GRID - 1; z++)
      for (let x = 1; x < GRID - 1; x++) {
        const i = z * GRID + x;
        prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - GRID] + cur[i + GRID]) * 0.5 - prev[i]) * 0.981;
        if (prev[i] > 2.5) prev[i] = 2.5;
        else if (prev[i] < -2.5) prev[i] = -2.5;
      }
    const t = cur;
    cur = prev;
    prev = t;
  };
  /**
   * Heights into the mesh, normals straight from the grid by central differences (a heightfield's
   * normal is (-dh/dx, 1, -dh/dz)), far cheaper than computeVertexNormals over every triangle.
   * The border rows never move, so their normals stay straight up. Returns the largest height.
   */
  const writeSurface = (amp: number) => {
    let peak = 0;
    for (let i = 0; i < GRID * GRID; i++) {
      const h = cur[i];
      pa[i * 3 + 1] = h * amp;
      if (h > peak) peak = h;
      else if (-h > peak) peak = -h;
    }
    const k = 2 * STEP;
    for (let z = 1; z < GRID - 1; z++)
      for (let x = 1; x < GRID - 1; x++) {
        const i = z * GRID + x;
        const nx = -(pa[(i + 1) * 3 + 1] - pa[(i - 1) * 3 + 1]);
        const nz = -(pa[(i + GRID) * 3 + 1] - pa[(i - GRID) * 3 + 1]);
        const inv = 1 / Math.sqrt(nx * nx + k * k + nz * nz);
        na[i * 3] = nx * inv;
        na[i * 3 + 1] = k * inv;
        na[i * 3 + 2] = nz * inv;
      }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    return peak;
  };

  /* ----------------------------------------------------------------- drops */
  let lastF: Flow = FLOWS.rain;
  const dp = new Float32Array(N * 3);
  const dv = new Float32Array(N);
  const alive = new Uint8Array(N);
  const lp = new Float32Array(N * 6).fill(-100);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(lp, 3));
  const dropMat = new THREE.LineBasicMaterial({
    color: 0xfff6ee,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(lineGeo, dropMat);
  lines.frustumCulled = false;
  group.add(lines);

  const hand: Hand = { on: false, x: 0, y: 0, z: 0 };
  const pool: Pool = { on: false, x: 0, z: 0.2, y: 0, r: 0.39 };
  const spillSrc: Spill = { y: 0, z: 0.72, x0: -1.1, x1: 1.1 };

  // Emitter state for the frame (set in update, read by spawn).
  let emitY = 4.25;
  let emitK = 1;
  let ground = 0;
  let fieldY = 9;

  const spawn = (i: number) => {
    const k3 = i * 3;
    if (i < N_COL) {
      const sh = lastF.shape;
      const a = Math.random() * Math.PI * 2;
      const r =
        sh === "ring"
          ? HEAD_R * (0.7 + Math.random() * 0.18)
          : sh === "core"
            ? Math.sqrt(Math.random()) * HEAD_R * 0.3
            : Math.sqrt(Math.random()) * HEAD_R * 0.9;
      dp[k3] = Math.cos(a) * r * emitK;
      dp[k3 + 2] = Math.sin(a) * r * emitK;
      dp[k3 + 1] = emitY;
      dv[i] = -(2.6 + Math.random() * 1.2);
    } else if (i < N_COL + N_SPILL) {
      dp[k3] = spillSrc.x0 + Math.random() * (spillSrc.x1 - spillSrc.x0);
      dp[k3 + 2] = spillSrc.z + Math.random() * 0.05;
      dp[k3 + 1] = spillSrc.y;
      dv[i] = -(0.4 + Math.random() * 0.6);
    } else {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 5.5;
      dp[k3] = Math.cos(a) * r;
      dp[k3 + 2] = Math.sin(a) * r;
      dp[k3 + 1] = fieldY - Math.random() * 0.6;
      dv[i] = -(1.6 + Math.random() * 1.4);
    }
    alive[i] = 1;
  };

  /* --------------------------------------------------------------- splashes */
  const sp = new Float32Array(SPLASHES * 3);
  const sv = new Float32Array(SPLASHES * 3);
  const sg = new Float32Array(SPLASHES);
  const sl = new Uint8Array(SPLASHES);
  let spi = 0;
  for (let i = 0; i < SPLASHES; i++) sp[i * 3 + 1] = -500;
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const spMat = new THREE.PointsMaterial({
    size: 0.028,
    color: 0xfff6ee,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const splashes = new THREE.Points(spGeo, spMat);
  splashes.frustumCulled = false;
  group.add(splashes);
  /** Burst of drops thrown up from height `y`, to fall back onto height `gy`. */
  const splash = (x: number, y: number, z: number, gy: number, up: number, spread: number) => {
    const j = (spi = (spi + 1) % SPLASHES);
    sp[j * 3] = x;
    sp[j * 3 + 1] = y;
    sp[j * 3 + 2] = z;
    sg[j] = gy;
    const ang = Math.random() * Math.PI * 2;
    const h = spread * (0.4 + Math.random() * 0.8);
    sv[j * 3] = Math.cos(ang) * h;
    sv[j * 3 + 1] = up * (0.6 + Math.random());
    sv[j * 3 + 2] = Math.sin(ang) * h;
    if (!sl[j]) splashLive++;
    sl[j] = 1;
  };
  const splashDir = (x: number, z: number, gy: number, ang: number, up: number, h: number) => {
    const j = (spi = (spi + 1) % SPLASHES);
    sp[j * 3] = x;
    sp[j * 3 + 1] = gy + 0.01;
    sp[j * 3 + 2] = z;
    sg[j] = gy;
    sv[j * 3] = Math.cos(ang) * h;
    sv[j * 3 + 1] = up;
    sv[j * 3 + 2] = Math.sin(ang) * h;
    if (!sl[j]) splashLive++;
    sl[j] = 1;
  };

  /* ------------------------------------------------------------------ state */
  let revive0 = 0;
  let reviveS = 0;
  let reviveF = 0;
  let uWet = 0;
  let uRad = 0;
  let frozenFor = -1;
  let shown = false;
  let seeded = false;
  let fieldAcc = 0;
  let churn = 0;
  /** The hero floor's own drift of its wet patch, put back when the camera returns to it. */
  const heroOff = new THREE.Vector2();
  let wasTemporal = true;
  /** The mirror target holds the plain backdrop (see plain()). */
  let blank = false;
  let blankFor = -1;
  const nothing = new THREE.Scene();
  /** Drops and splashes in the air after the last frame (0 means their loops are skipped). */
  let dropsLive = 0;
  let splashLive = 0;
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const scatter = (colTarget: number, spillTarget: number, fieldTarget: number) => {
    // Reduced motion: the drops hang in the air as short streaks, spread along their fall.
    for (let i = 0; i < N; i++) alive[i] = 0;
    const put = (from: number, count: number, y0: number, y1: number) => {
      for (let i = from; i < from + count; i++) {
        spawn(i);
        dp[i * 3 + 1] = y1 + Math.random() * (y0 - y1);
        dv[i] = -(2 + Math.random() * 2);
      }
    };
    put(0, colTarget, emitY, ground + 0.2);
    put(N_COL, spillTarget, spillSrc.y, ground + 0.2);
    put(N_COL + N_SPILL, fieldTarget, fieldY, ground + 0.2);
  };

  const update = (f: Frame) => {
    const s = f.s;
    const dt = f.dt;
    ground = s[C.ground];
    floor.position.y = ground;
    shown = s[C.floor] > 0.01;
    floor.visible = shown;
    emitY = s[C.emitY];
    emitK = s[C.emitR] / 1.125;
    fieldY = ground + 9;

    // Mixer flow and how much of it the timeline lets through.
    const Fcur = FLOWS[f.flow] || FLOWS.rain;
    if (Fcur.n) lastF = Fcur;
    const F = lastF;
    const wScale = s[C.water];
    const colTarget = Math.min(N_COL, Math.round(Fcur.n * density * wScale));
    // Once the slab's edge is under the water the sheet has nowhere to fall: see the churn below.
    const under = spillSrc.y <= ground + 0.01;
    const spillTarget = under ? 0 : Math.round(s[C.overflow] * N_SPILL);
    const fieldTarget = Math.round(s[C.field] * N_FIELD * (f.mobile ? 0.7 : 1));

    // Colour of the drops follows the background so they stay visible.
    dropMat.color.copy(CREAM).lerp(STEEL, s[C.tone]);
    spMat.color.copy(dropMat.color);
    dropMat.opacity = 0.4 + 0.2 * s[C.tone];
    mat.uniforms.uFade.value.set(s[C.fadeA], s[C.fadeB]);

    if (f.reduced) {
      // Still water: lay the drops out once per change, no integration, no flying.
      const key = colTarget * 1e6 + spillTarget * 1e3 + fieldTarget + Math.round(emitY * 10) * 0.001;
      // Only rewritten when the layout changes.
      if (key !== frozenFor) {
        frozenFor = key;
        scatter(colTarget, spillTarget, fieldTarget);
        for (let i = 0; i < N; i++) {
          const o = i * 6;
          const k = i * 3;
          if (!alive[i]) {
            lp[o + 1] = lp[o + 4] = -100;
            continue;
          }
          lp[o] = lp[o + 3] = dp[k];
          lp[o + 1] = dp[k + 1];
          lp[o + 2] = lp[o + 5] = dp[k + 2];
          lp[o + 4] = dp[k + 1] - dv[i] * 0.02;
        }
        lineGeo.attributes.position.needsUpdate = true;
      }
      if (!seeded && shown) {
        seeded = true;
        for (let n = 0; n < 14; n++)
          impulse((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, -0.5);
        for (let n = 0; n < 60; n++) stepField();
        writeSurface(s[C.amp]);
      }
      driveFloor(f, 0);
      return;
    }

    const gate = F.pulse && colTarget ? (Math.sin(f.time * 7) > -0.2 ? 1 : 0) : 1;

    // Revive drops at a rate (the turn-on effect), per kind.
    revive0 += colTarget * dt * 1.6 * gate;
    for (let i = 0; i < colTarget && revive0 >= 1; i++)
      if (!alive[i]) {
        spawn(i);
        revive0 -= 1;
        dropsLive++;
      }
    if (revive0 > colTarget) revive0 = colTarget;
    reviveS += spillTarget * dt * 1.6;
    for (let i = N_COL; i < N_COL + spillTarget && reviveS >= 1; i++)
      if (!alive[i]) {
        spawn(i);
        reviveS -= 1;
        dropsLive++;
      }
    if (reviveS > spillTarget) reviveS = spillTarget;
    reviveF += fieldTarget * dt * 1.6;
    for (let i = N_COL + N_SPILL; i < N_COL + N_SPILL + fieldTarget && reviveF >= 1; i++)
      if (!alive[i]) {
        spawn(i);
        reviveF -= 1;
        dropsLive++;
      }
    if (reviveF > fieldTarget) reviveF = fieldTarget;

    const sim = shown;
    const gMul = F.s;

    // The sheet's edge under water: a line of churn where it went down. It used to be the sheet's own
    // drops, each born under the surface and "landing" again on every frame, a few hundred impulses
    // and splashes per frame, more on a faster screen. Now it is a rate per second, lighter on a phone.
    if (under && sim && s[C.overflow] > 0.01) {
      const rate = f.mobile ? 6000 : 9000;
      churn += s[C.overflow] * rate * dt;
      let n = Math.min(churn | 0, 240);
      churn = Math.min(churn - n, 1);
      const amp = F.a * 0.05 * (48000 / rate);
      while (n-- > 0) {
        const x = spillSrc.x0 + Math.random() * (spillSrc.x1 - spillSrc.x0);
        const z = spillSrc.z + Math.random() * 0.05;
        splash(x, ground + 0.01, z, ground, 1.0, 0.75);
        if ((n & 3) === 0) impulse(x, z, amp);
      }
    } else churn = 0;
    // No drop in the air: dead ones were parked as they landed, so there is nothing to integrate or upload.
    let live = 0;
    for (let i = 0; dropsLive && i < N; i++) {
      const k = i * 3;
      const o = i * 6;
      if (!alive[i]) continue;
      const py = dp[k + 1];
      dv[i] -= 9.8 * dt * gMul;
      dp[k + 1] += dv[i] * dt * gMul;
      let ended = false;
      const y = dp[k + 1];
      if (i < N_COL && hand.on && py > hand.y && y <= hand.y && Math.abs(dp[k] - hand.x) < 0.32 && Math.abs(dp[k + 2] - hand.z) < 0.34) {
        if (Math.random() < 0.35) splash(dp[k], hand.y + 0.02, dp[k + 2], ground, 0.8, 1.1);
        ended = true;
      } else if (
        i < N_COL &&
        pool.on &&
        py > pool.y &&
        y <= pool.y &&
        (dp[k] - pool.x) * (dp[k] - pool.x) + (dp[k + 2] - pool.z) * (dp[k + 2] - pool.z) < pool.r * pool.r
      ) {
        if (Math.random() < 0.5) splash(dp[k], pool.y + 0.005, dp[k + 2], pool.y, 0.7, 0.35);
        ended = true;
      } else if (y <= ground) {
        if (sim) {
          // The overflow sheet and the field land on few cells or many drops: keep their ripples gentle.
          impulse(dp[k], dp[k + 2], F.a * (i < N_COL ? 1 : i < N_COL + N_SPILL ? 0.05 : 1));
          const rr = Math.random();
          if (rr < 0.04) {
            const cn = 6 + ((Math.random() * 3) | 0);
            const a0 = Math.random() * 6.283;
            for (let c = 0; c < cn; c++)
              splashDir(dp[k], dp[k + 2], ground, a0 + (c / cn) * 6.283, 0.9 + Math.random() * 0.3, 0.5);
            if (Math.random() < 0.3) splashDir(dp[k], dp[k + 2], ground, 0, 1.8 + Math.random() * 0.4, 0.02);
          } else if (rr < 0.6) {
            const sn = 2 + ((Math.random() * 3) | 0);
            for (let c = 0; c < sn; c++) splash(dp[k], ground + 0.01, dp[k + 2], ground, 1.35, 0.75);
          }
        }
        ended = true;
      }
      if (ended) {
        const limit = i < N_COL ? colTarget : i < N_COL + N_SPILL ? N_COL + spillTarget : N_COL + N_SPILL + fieldTarget;
        if (i < limit && (i >= N_COL || gate)) spawn(i);
        else {
          alive[i] = 0;
          lp[o + 1] = lp[o + 4] = -100;
          continue;
        }
      }
      lp[o] = dp[k];
      lp[o + 1] = dp[k + 1];
      lp[o + 2] = dp[k + 2];
      lp[o + 3] = dp[k];
      lp[o + 4] = dp[k + 1] - dv[i] * 0.02 * gMul;
      lp[o + 5] = dp[k + 2];
      live++;
    }
    if (dropsLive) lineGeo.attributes.position.needsUpdate = true;
    dropsLive = live;
    lines.visible = live > 0;

    let sLive = 0;
    for (let j = 0; splashLive && j < SPLASHES; j++) {
      if (!sl[j]) continue;
      const k = j * 3;
      sv[k + 1] -= 9.8 * dt;
      sp[k] += sv[k] * dt;
      sp[k + 1] += sv[k + 1] * dt;
      sp[k + 2] += sv[k + 2] * dt;
      if (sp[k + 1] < sg[j]) {
        if (sim && sg[j] === ground) impulse(sp[k], sp[k + 2], -0.03);
        if (sl[j] === 1 && sv[k + 1] < -1.4 && Math.random() < 0.3) {
          sp[k + 1] = sg[j] + 0.002;
          sv[k + 1] = -sv[k + 1] * (0.22 + Math.random() * 0.1);
          sv[k] *= 0.6;
          sv[k + 2] *= 0.6;
          sl[j] = 2;
        } else {
          sl[j] = 0;
          sp[k + 1] = -500;
          continue;
        }
      }
      sLive++;
    }
    if (splashLive) spGeo.attributes.position.needsUpdate = true;
    splashLive = sLive;
    splashes.visible = sLive > 0;

    if (sim && !calm) {
      // The surface runs at a fixed 60 Hz whatever the frame rate, so ripples look the same everywhere.
      fieldAcc += dt;
      let steps = 0;
      while (fieldAcc >= 1 / 60 && steps < 3) {
        stepField();
        fieldAcc -= 1 / 60;
        steps++;
      }
      if (fieldAcc > 1 / 60) fieldAcc = 0;
      if (steps && writeSurface(s[C.amp]) < 1e-5) {
        // Every ripple has died out: settle the surface exactly flat and stop stepping it.
        cur.fill(0);
        prev.fill(0);
        writeSurface(s[C.amp]);
        calm = true;
      }
    } else if (!sim && !calm) {
      // The floor has gone out of sight mid-ripple. Lay it flat now, or the same ripples would be
      // waiting, frozen, at the next place a floor appears (the footer's rain on the hero's floor).
      cur.fill(0);
      prev.fill(0);
      writeSurface(s[C.amp]);
      calm = true;
    }
    driveFloor(f, colTarget);
  };

  /** Uniforms that give the floor its wetness, colour and fade. */
  const driveFloor = (f: Frame, colTarget: number) => {
    const s = f.s;
    const U = mat.uniforms;
    const dt = f.dt;
    U.uTime.value += dt;
    U.uVis.value = s[C.floor];
    U.uGloss.value = s[C.gloss];
    // The hero floor wets out over time while the rain runs; below it the timeline decides. The hero's
    // own patch is kept while the camera is away (wetV, radV), so the floor it comes back to is the
    // floor it left, not a dry one that has to spread again.
    const temporal = s[C.ground] > -0.5;
    if (temporal) {
      if (!wasTemporal) (U.uOff.value as THREE.Vector2).copy(heroOff);
      if (colTarget) {
        uWet += (1 - uWet) * Math.min(1, dt * 1.5);
        uRad = Math.min(8.5, uRad + dt * (uRad < 2.5 ? 0.9 : 0.35));
        (U.uOff.value as THREE.Vector2).multiplyScalar(1 - Math.min(1, dt * 0.8));
      } else {
        U.uOff.value.x += dt * 0.35;
        U.uOff.value.y += dt * 0.22;
        uRad = Math.max(0, uRad - dt * (uRad > 3 ? 0.7 : 0.3));
        if (uRad < 1.2) uWet = Math.max(0, uWet - dt * 0.25);
      }
      if (!uWet) U.uOff.value.set(0, 0);
      heroOff.copy(U.uOff.value as THREE.Vector2);
      U.uWet.value = uWet;
      U.uRad.value = uRad;
      wasTemporal = true;
    } else {
      U.uWet.value = s[C.wet];
      U.uRad.value = s[C.spread] * 9.5;
      U.uOff.value.set(0, 0.55);
      wasTemporal = false;
    }
    // Colours: dry floor is the backdrop itself; the wet tint comes from the table.
    U.uDry.value.setRGB(f.bg.lin[0], f.bg.lin[1], f.bg.lin[2], THREE.LinearSRGBColorSpace);
    labToLinear(s[C.tintL], s[C.tintA], s[C.tintB], scratch);
    U.uTint.value.setRGB(
      Math.max(0, Math.min(1, scratch[0])),
      Math.max(0, Math.min(1, scratch[1])),
      Math.max(0, Math.min(1, scratch[2])),
      THREE.LinearSRGBColorSpace,
    );
    U.uFog.value.setRGB(f.bg.srgb[0], f.bg.srgb[1], f.bg.srgb[2], THREE.LinearSRGBColorSpace);
  };

  return {
    group,
    hand,
    pool,
    spill: spillSrc,
    floorShown: () => shown,
    mirror: () => {
      const U = mat.uniforms;
      return shown ? (U.uGloss.value as number) * (0.92 * (U.uWet.value as number) + 0.03) : 0;
    },
    plain(renderer, cam, backdrop) {
      mat.uniforms.camPos.value.copy(cam.position);
      if (blank && backdrop === blankFor) return;
      blank = true;
      blankFor = backdrop;
      // An empty scene through the renderer's own pass, not a bare clear(): the pass converts the
      // backdrop for a linear target, and a bare clear would leave the canvas's encoding in it, a
      // paler mirror than the real one.
      renderer.setRenderTarget(rt);
      renderer.render(nothing, cam);
      renderer.setRenderTarget(null);
    },
    poke: impulse,
    update,
    resize(w, h, pr) {
      rt.setSize(Math.max(2, Math.round(w * pr * RT_SCALE)), Math.max(2, Math.round(h * pr * RT_SCALE)));
      blank = false;
    },
    reflect(renderer, scene, cam, look) {
      blank = false;
      const gy = floor.position.y;
      mcam.projectionMatrix.copy(cam.projectionMatrix);
      mcam.position.set(cam.position.x, 2 * gy - cam.position.y, cam.position.z);
      mcam.up.set(0, -1, 0);
      mcam.lookAt(look.x, 2 * gy - look.y, look.z);
      mcam.updateMatrixWorld();
      floor.updateMatrixWorld();
      const tm = mat.uniforms.texM.value as THREE.Matrix4;
      tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      tm.multiply(mcam.projectionMatrix).multiply(mcam.matrixWorldInverse).multiply(floor.matrixWorld);
      mat.uniforms.camPos.value.copy(cam.position);
      floor.visible = false;
      // Only what stands above the water may be reflected in it.
      clip.constant = -(gy + 0.005);
      renderer.clippingPlanes = [clip];
      renderer.setRenderTarget(rt);
      renderer.render(scene, mcam);
      renderer.setRenderTarget(null);
      renderer.clippingPlanes = [];
      floor.visible = true;
    },
    dispose() {
      rt.dispose();
      geo.dispose();
      mat.dispose();
      lineGeo.dispose();
      dropMat.dispose();
      spGeo.dispose();
      spMat.dispose();
    },
  };
}
