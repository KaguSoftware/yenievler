import * as THREE from "three";
import { pinScreenHeight } from "../screenHeight";
import {
  baseRenderer,
  makeEnv,
  nozzlePositions,
  softTex,
  type Dispose,
} from "./common";
import {
  CAPACITY,
  RATE_YENI_EVLER_YAPI,
  RATE_STANDARD,
  arrive,
  fill,
  flowAt,
} from "../minute";

export interface MinuteOptions {
  section: HTMLElement;
  /** Smoothed 0..1 progress through the pinned section (a framer-motion value). */
  getProgress: () => number;
  /** Receives --ax --bx --jw --jb --jh --jbase in px so the DOM labels sit on the jugs. */
  host: HTMLElement;
}

// Output-space hex, kept in step with --color-signal in globals.css (same as hero.ts).
const SIGNAL = 0xf15214;
const CREAM = 0xfff6ee;

// World units. One litre is W_H / CAPACITY tall.
const R_OUT = 0.86;
const R_IN = 0.79;
const JUG_H = 3.4;
const W_BOT = 0.1;
const W_H = 3.2;
const STREAM_R = 0.6;
const JOINT_Y = 5.2;
const FACE_Y = 4.85;
const TILT = -0.45;
const FOV = 22;

type Kind = "standard" | "yeni-evler-yapi";

const GLASS_VS = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() {
    vP = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const GLASS_FS = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    float ndv = abs(dot(n, normalize(vV)));
    float fr = pow(1.0 - ndv, 2.4);
    float ang = atan(vP.z, vP.x);
    float h = vP.y / ${JUG_H.toFixed(2)};
    float key = smoothstep(0.16, 0.0, abs(ang - 2.15)) * smoothstep(0.06, 0.3, h) * smoothstep(1.0, 0.85, h);
    float rim = smoothstep(0.1, 0.0, abs(ang - 0.62)) * smoothstep(0.06, 0.3, h) * smoothstep(1.0, 0.85, h);
    float lip = smoothstep(0.93, 0.99, h) * 0.5;
    float a = 0.04 + fr * 0.5 + key * 0.55 + rim * 0.22 + lip;
    gl_FragColor = vec4(vec3(0.96, 0.9, 0.84), clamp(a, 0.0, 0.95));
    #include <colorspace_fragment>
  }
`;
const WATER_VS = /* glsl */ `
  uniform float uBase; uniform float uCap;
  varying vec3 vN; varying vec3 vV; varying float vH;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vH = (wp.y - uBase) / uCap;
    vec4 mv = viewMatrix * wp;
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const WATER_FS = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying float vH;
  void main() {
    vec3 n = normalize(vN);
    float ndv = abs(dot(n, normalize(vV)));
    vec3 top = vec3(0.94, 0.88, 0.82);
    vec3 deep = vec3(0.93, 0.5, 0.27);
    vec3 col = mix(deep, top, 0.25 + 0.75 * smoothstep(0.0, 1.0, vH));
    float fr = pow(1.0 - ndv, 1.5);
    col = mix(col, deep * 0.8, fr * 0.5);
    col += smoothstep(0.9, 1.0, dot(n, normalize(vec3(-0.55, 0.1, 0.83)))) * 0.16;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;
const SURF_VS = /* glsl */ `
  varying vec2 vXZ;
  void main() { vXZ = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SURF_FS = /* glsl */ `
  uniform float uTime; uniform float uFlow;
  varying vec2 vXZ;
  void main() {
    float r = length(vXZ);
    float rip = sin(r * 34.0 - uTime * 8.0) * exp(-r * 2.6) * uFlow;
    vec3 col = vec3(0.97, 0.93, 0.89) + rip * 0.07;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function streakTexture() {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, "rgba(255,255,255,0)");
  gr.addColorStop(0.55, "rgba(255,255,255,0.75)");
  gr.addColorStop(1, "rgba(255,255,255,1)");
  g.fillStyle = gr;
  g.beginPath();
  g.roundRect(3, 0, 10, 64, 5);
  g.fill();
  return new THREE.CanvasTexture(c);
}

/** Two glass jugs under two shower heads. Scroll progress is the clock: levels follow litres run. */
export function initMinute(el: HTMLElement, o: MinuteOptions): Dispose {
  const renderer = baseRenderer(el);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SIGNAL);
  scene.environment = makeEnv(renderer, 0.9, 0xa8431f);
  const key = new THREE.DirectionalLight(0xfff2e4, 1.3);
  key.position.set(-3, 5, 7);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);
  const world = new THREE.Group();
  scene.add(world);

  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xe2e2e2,
    metalness: 1,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
  });
  const plastic = new THREE.MeshStandardMaterial({
    color: 0xd8d4cc,
    roughness: 0.42,
    metalness: 0.05,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x55524d,
    roughness: 0.7,
  });
  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x8e8e8e,
    roughness: 0.45,
  });
  const V = (x: number, y: number) => new THREE.Vector2(x, y);

  const glassGeo = new THREE.LatheGeometry(
    [
      V(0.001, 0),
      V(0.74, 0),
      V(0.82, 0.03),
      V(R_OUT, 0.13),
      V(R_OUT, JUG_H - 0.04),
      V(R_OUT - 0.02, JUG_H),
      V(R_IN + 0.02, JUG_H),
      V(R_IN, JUG_H - 0.03),
      V(R_IN, 0.13),
      V(0.7, W_BOT),
      V(0.001, W_BOT),
    ],
    96,
  );
  const glassMat = new THREE.ShaderMaterial({
    vertexShader: GLASS_VS,
    fragmentShader: GLASS_FS,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const waterGeo = new THREE.CylinderGeometry(
    R_IN - 0.015,
    R_IN - 0.015,
    1,
    72,
    1,
    false,
  ).translate(0, 0.5, 0);
  const surfGeo = new THREE.CircleGeometry(R_IN - 0.015, 72);
  const ringGeo = new THREE.TorusGeometry(R_IN - 0.015, 0.012, 8, 96);
  const shadowTex = softTex();
  const streak = streakTexture();
  const soft = softTex();
  const dropMat = (alpha: number) =>
    new THREE.MeshBasicMaterial({
      map: streak,
      color: CREAM,
      transparent: true,
      opacity: alpha,
      depthWrite: false,
      toneMapped: false,
    });
  const noz = nozzlePositions(STREAM_R);

  const m4 = new THREE.Matrix4();
  const qi = new THREE.Quaternion();
  const ps = new THREE.Vector3();
  const sc = new THREE.Vector3();

  function makeRig(kind: Kind) {
    const isStd = kind === "standard";
    const rate = isStd ? RATE_STANDARD : RATE_YENI_EVLER_YAPI;
    const g = new THREE.Group();
    world.add(g);

    // Contact shadow: a soft ellipse facing the camera. A floor plane would collapse to a
    // hairline whenever the camera sits near floor level (phones, tablets).
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.7),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        color: 0x6b1f00,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    shadow.position.set(0, 0.03, -0.2);
    g.add(shadow);

    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.renderOrder = 4;
    g.add(glass);

    const water = new THREE.Mesh(
      waterGeo,
      new THREE.ShaderMaterial({
        vertexShader: WATER_VS,
        fragmentShader: WATER_FS,
        uniforms: { uBase: { value: W_BOT }, uCap: { value: W_H } },
        toneMapped: false,
      }),
    );
    water.position.y = W_BOT;
    g.add(water);
    const surfMat = new THREE.ShaderMaterial({
      vertexShader: SURF_VS,
      fragmentShader: SURF_FS,
      uniforms: { uTime: { value: 0 }, uFlow: { value: 0 } },
      toneMapped: false,
    });
    const surf = new THREE.Mesh(surfGeo, surfMat);
    surf.rotation.x = -Math.PI / 2;
    g.add(surf);
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: CREAM, toneMapped: false }),
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);

    // Fixture: fixed pipe, ball joint, and a tilted head that lowers into place.
    const lift = new THREE.Group();
    lift.position.y = JOINT_Y;
    g.add(lift);
    // The pipe rides with the head so nothing pokes through it while it lowers.
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 22, 24),
      isStd ? plastic : chrome,
    );
    pipe.position.y = 11;
    lift.add(pipe);
    const tilt = new THREE.Group();
    tilt.rotation.x = TILT;
    lift.add(tilt);
    const joint = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 24, 16),
      isStd ? plastic : chrome,
    );
    tilt.add(joint);
    const head = new THREE.Group();
    head.position.y = -0.26;
    tilt.add(head);

    if (isStd) {
      head.add(
        new THREE.Mesh(
          new THREE.LatheGeometry(
            [
              V(0.001, 0.07),
              V(0.58, 0.075),
              V(0.73, 0.05),
              V(0.76, 0),
              V(0.71, -0.05),
              V(0.001, -0.055),
            ],
            64,
          ),
          plastic,
        ),
      );
      const pts = noz.filter((_, i) => i % 3 === 0);
      const holes = new THREE.InstancedMesh(
        new THREE.CircleGeometry(0.026, 10),
        darkMat,
        pts.length,
      );
      pts.forEach(([x, z], i) => {
        m4.makeRotationX(Math.PI / 2);
        m4.setPosition(x * 1.08, -0.058, z * 1.08);
        holes.setMatrixAt(i, m4);
      });
      head.add(holes);
    } else {
      const s = 0.61;
      const shell = new THREE.Mesh(
        new THREE.LatheGeometry(
          [
            V(0.001, 0.075),
            V(0.9, 0.07),
            V(1.18, 0.052),
            V(1.25, 0.02),
            V(1.25, -0.03),
            V(1.21, -0.03),
            V(1.2, 0.02),
            V(1.15, 0.04),
            V(0.001, 0.045),
          ].map((v) => V(v.x * s, v.y * s * 1.1)),
          128,
        ),
        chrome,
      );
      head.add(shell);
      const faceDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.72, 0.012, 96),
        new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.85 }),
      );
      faceDisc.position.y = -0.026;
      head.add(faceDisc);
      const nozzles = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.013, 0.008, 0.02, 8),
        nozzleMat,
        noz.length,
      );
      noz.forEach(([x, z], i) => {
        m4.makeTranslation(x * 1.16, -0.038, z * 1.16);
        nozzles.setMatrixAt(i, m4);
      });
      head.add(nozzles);
      const ringT = new THREE.Mesh(
        new THREE.TorusGeometry(0.74, 0.018, 16, 128),
        chrome,
      );
      ringT.rotation.x = Math.PI / 2;
      ringT.position.y = -0.016;
      head.add(ringT);
    }

    // Falling water: one streak per drop, billboarded because the camera never pitches.
    const N = isStd ? 640 : 330;
    const drops = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      dropMat(isStd ? 0.8 : 0.92),
      N,
    );
    drops.frustumCulled = false;
    drops.renderOrder = 3;
    g.add(drops);
    const dx = new Float32Array(N);
    const dz = new Float32Array(N);
    const dy = new Float32Array(N);
    const dv = new Float32Array(N);
    const dl = new Float32Array(N);
    const dw = new Float32Array(N);
    const alive = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const [x, z] = noz[(Math.random() * noz.length) | 0];
      dx[i] = x + (Math.random() - 0.5) * 0.04;
      dz[i] = z + (Math.random() - 0.5) * 0.04;
      // Standard: thin, quick streaks. R-360: fewer, fatter, air-filled drops.
      dv[i] = isStd ? 8.5 + Math.random() * 3 : 6.5 + Math.random() * 2.5;
      dl[i] = isStd ? 0.28 + Math.random() * 0.22 : 0.16 + Math.random() * 0.12;
      dw[i] = isStd
        ? 0.014 + Math.random() * 0.006
        : 0.03 + Math.random() * 0.012;
    }

    // Splashes where drops land.
    const SP = 90;
    const spGeo = new THREE.BufferGeometry();
    const spPos = new Float32Array(SP * 3).fill(-99);
    spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
    const sp = new THREE.Points(
      spGeo,
      new THREE.PointsMaterial({
        size: isStd ? 0.07 : 0.09,
        map: soft,
        color: CREAM,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
        toneMapped: false,
      }),
    );
    sp.frustumCulled = false;
    sp.renderOrder = 3;
    g.add(sp);
    const spv = new Float32Array(SP * 3);
    const spl = new Float32Array(SP);
    let spi = 0;

    let splashing = false;
    const update = (p: number, dt: number, t: number) => {
      const f = fill(p, rate);
      const flow = flowAt(p);
      const surfaceY = W_BOT + f * W_H;
      const has = f > 0.002;
      water.visible = surf.visible = ring.visible = has;
      water.scale.y = Math.max(1e-4, f * W_H);
      surf.position.y = ring.position.y = surfaceY;
      surfMat.uniforms.uTime.value = t;
      surfMat.uniforms.uFlow.value = flow;
      lift.position.y = JOINT_Y + (1 - arrive(p)) * 1.5;

      const topY = FACE_Y + (1 - arrive(p)) * 1.5;
      const active = Math.floor(N * flow);
      for (let i = 0; i < N; i++) {
        if (i >= active) {
          alive[i] = 0;
          m4.makeScale(0, 0, 0);
          drops.setMatrixAt(i, m4);
          continue;
        }
        const startY = topY - dz[i] * 0.48;
        if (!alive[i]) {
          alive[i] = 1;
          dy[i] = startY - Math.random() * 0.6;
        }
        dy[i] -= dv[i] * dt;
        if (dy[i] < surfaceY) {
          const sprob = isStd ? 0.2 : 0.3;
          if (Math.random() < sprob) {
            const k = spi;
            spi = (spi + 1) % SP;
            spPos[k * 3] = dx[i];
            spPos[k * 3 + 1] = surfaceY + 0.02;
            spPos[k * 3 + 2] = dz[i];
            spv[k * 3] = (Math.random() - 0.5) * 1.3;
            spv[k * 3 + 1] = 1.5 + Math.random() * 1.6;
            spv[k * 3 + 2] = (Math.random() - 0.5) * 0.8;
            spl[k] = 1;
          }
          dy[i] = startY - Math.random() * 0.25;
        }
        ps.set(dx[i], dy[i] + dl[i] / 2, dz[i]);
        sc.set(dw[i], dl[i], 1);
        m4.compose(ps, qi, sc);
        drops.setMatrixAt(i, m4);
      }
      drops.instanceMatrix.needsUpdate = true;

      splashing = false;
      for (let k = 0; k < SP; k++) {
        if (spl[k] <= 0) continue;
        splashing = true;
        spl[k] -= dt * 2.4;
        spv[k * 3 + 1] -= 9 * dt;
        spPos[k * 3] += spv[k * 3] * dt;
        spPos[k * 3 + 1] += spv[k * 3 + 1] * dt;
        spPos[k * 3 + 2] += spv[k * 3 + 2] * dt;
        if (spl[k] <= 0 || spPos[k * 3 + 1] < surfaceY) {
          spl[k] = 0;
          spPos[k * 3 + 1] = -99;
        }
      }
      spGeo.attributes.position.needsUpdate = true;
      return flow > 0.001 || splashing;
    };
    return { g, update };
  }

  const rigA = makeRig("standard");
  const rigB = makeRig("yeni-evler-yapi");

  let dirty = true;
  const compactMq = window.matchMedia(
    "(max-width: 639.98px), (max-aspect-ratio: 1/1)",
  );
  const layout = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.fov = FOV;
    cam.updateProjectionMatrix();
    const compact = compactMq.matches;
    let S: number;
    let headTop: number;
    let cx: number;
    let gapU: number;
    if (compact) {
      headTop = Math.max(20, h * 0.06);
      // Reserve the text block under the jugs (sizes mirror the stack: classes in Minute.tsx).
      const titlePx = Math.max(40, Math.min(w * 0.09, 92));
      const clockPx = Math.max(56, Math.min(w * 0.13, 150));
      const textH =
        titlePx * 0.88 * 2 +
        12 +
        Math.max(clockPx * 1.15 + 28, 70) +
        Math.max(24, Math.min(h * 0.05, 56));
      const reserve = headTop + 110 + textH + 36;
      S = Math.max(48, Math.min(w * 0.195, (h - reserve) / 5.3, 140));
      cx = w / 2;
      gapU = 2.85;
    } else {
      S = Math.min(h * 0.137, w * 0.095);
      headTop = h * 0.09;
      cx = w * 0.7;
      gapU = 3.15;
    }
    const base = headTop + 5.3 * S; // py of the jug's outer foot (y = 0)
    const yc = (base - h / 2) / S;
    const D = h / (2 * Math.tan((FOV * Math.PI) / 360) * S);
    cam.position.set(0, yc, D);
    cam.lookAt(0, yc, 0);
    const ax = cx - (gapU * S) / 2;
    const bx = cx + (gapU * S) / 2;
    rigA.g.position.x = (ax - w / 2) / S;
    rigB.g.position.x = (bx - w / 2) / S;
    const st = o.host.style;
    st.setProperty("--ax", ax.toFixed(1) + "px");
    st.setProperty("--bx", bx.toFixed(1) + "px");
    st.setProperty("--jw", (2 * R_OUT * S).toFixed(1) + "px");
    st.setProperty("--jb", (base - W_BOT * S).toFixed(1) + "px");
    st.setProperty("--jh", (W_H * S).toFixed(1) + "px");
    st.setProperty("--jbase", base.toFixed(1) + "px");
    st.setProperty("--cap", String(CAPACITY));
    dirty = true;
  };
  // The panel is 100svh: pinned, so a phone's toolbar on the move cannot resize the jugs mid-pour.
  const unpin = pinScreenHeight(o.host);
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(el);

  let visible = false;
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) dirty = true;
  });
  io.observe(o.section);

  let raf = 0;
  let time = 0;
  let lastP = -1;
  let first = true;
  let lastT = performance.now();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 1 / 30);
    lastT = now;
    if (!visible) return;
    const p = o.getProgress();
    const moved = Math.abs(p - lastP) > 1e-5;
    lastP = p;
    time += dt;
    // Always step the sims; they report whether anything is still moving so a settled
    // frame (reduced motion, or the tap closed) stops costing GPU time.
    const a = rigA.update(p, dt, time);
    const b = rigB.update(p, dt, time);
    if (!(dirty || moved || a || b)) return;
    dirty = false;
    renderer.render(scene, cam);
    if (first) {
      first = false;
      renderer.domElement.style.opacity = "1";
    }
  };
  loop();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    unpin();
    io.disconnect();
    scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    [shadowTex, streak, soft].forEach((t) => t.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  };
}
