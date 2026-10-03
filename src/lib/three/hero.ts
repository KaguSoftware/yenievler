import * as THREE from "three";
import {
  baseRenderer,
  makeEnv,
  nozzlePositions,
  rawColor,
  reducedMotion,
  softTex,
  type Dispose,
} from "./common";
import { FLOWS, type Flow, type FlowId } from "./flows";

export interface HeroOptions {
  getFlow: () => FlowId;
  density?: number;
  steam?: boolean;
}

// Output-space hexes, kept in step with --color-signal / --color-signal-deep in globals.css.
const SIGNAL = 0xf15214;
const SIGNAL_DEEP = 0xc83f0a;

/** Rain shower head over a wetting floor: drop sim, splashes, ripple heightfield, planar reflection. */
export function initHero(el: HTMLElement, opts: HeroOptions): Dispose {
  const renderer = baseRenderer(el);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SIGNAL);
  scene.environment = makeEnv(renderer, 0.85, 0xa8431f);
  const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const rig = new THREE.Group();
  scene.add(rig);
  const HEAD_Y = 4.3;
  const R = 1.25;

  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xdedede,
    metalness: 1,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.07, 160), chrome);
  head.position.y = HEAD_Y;
  rig.add(head);
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.965, 160),
    new THREE.MeshStandardMaterial({ color: 0x1b1b1b, metalness: 0.7, roughness: 0.5 }),
  );
  face.rotation.x = Math.PI / 2;
  face.position.y = HEAD_Y - 0.0365;
  rig.add(face);
  const nozzles = nozzlePositions(R);
  const nz = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.012, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.2, roughness: 0.4 }),
    nozzles.length,
  );
  const m4 = new THREE.Matrix4();
  nozzles.forEach(([x, z], i) => {
    m4.makeTranslation(x, HEAD_Y - 0.042, z);
    nz.setMatrixAt(i, m4);
  });
  rig.add(nz);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 5, 32), chrome);
  arm.position.y = HEAD_Y + 2.5;
  rig.add(arm);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 48), chrome);
  collar.position.y = HEAD_Y + 0.1;
  rig.add(collar);

  // water: heightfield sim + planar reflection
  const G = 140;
  const S = 16;
  const step = S / (G - 1);
  const geo = new THREE.PlaneGeometry(S, S, G - 1, G - 1);
  geo.rotateX(-Math.PI / 2);
  const rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType });
  const waterMat = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      tR: { value: rt.texture },
      texM: { value: new THREE.Matrix4() },
      camPos: { value: new THREE.Vector3() },
      uWet: { value: 0 },
      uDry: { value: new THREE.Color(SIGNAL) },
      uTint: { value: new THREE.Color(SIGNAL_DEEP) },
      uFog: { value: rawColor(SIGNAL) },
      uRad: { value: 0 },
      uTime: { value: 0 },
      uOff: { value: new THREE.Vector2() },
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
      uniform float uRad; uniform float uTime; uniform vec2 uOff;
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
        float spec = pow(max(dot(n, h), 0.0), 140.0) * 2.4 * wet;
        vec3 col = mix(base, refl * vec3(0.9, 0.86, 0.84), (0.32 + 0.6 * f) * wet + 0.03) + spec;
        col = mix(col, col * 0.78, smoothstep(edge * 0.95, edge * 0.82, d) * (1.0 - smoothstep(edge * 0.82, edge * 0.6, d)) * uWet);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        // fade the floor into the backdrop so the plane has no visible edge
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFog, smoothstep(4.2, 7.6, length(vL)));
      }`,
  });
  const water = new THREE.Mesh(geo, waterMat);
  rig.add(water);
  const mcam = new THREE.PerspectiveCamera();
  let cur = new Float32Array(G * G);
  let prev = new Float32Array(G * G);
  const pa = geo.attributes.position.array as Float32Array;
  const impulse = (x: number, z: number, a: number) => {
    const ix = Math.round((x + S / 2) / step);
    const iz = Math.round((z + S / 2) / step);
    if (ix < 2 || iz < 2 || ix > G - 3 || iz > G - 3) return;
    const i = iz * G + ix;
    cur[i] += a;
    cur[i - 1] += a * 0.25;
    cur[i + 1] += a * 0.25;
    cur[i - G] += a * 0.25;
    cur[i + G] += a * 0.25;
  };

  const soft = softTex();
  const spot = new THREE.SpotLight(0xffffff, 80, 14, 0.6, 1, 1.4);
  spot.position.set(0, HEAD_Y - 0.1, 0);
  spot.target.position.set(0, 0, 0);
  rig.add(spot);
  rig.add(spot.target);

  // drops
  let lastF: Flow = FLOWS.rain;
  const N = 1900;
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
  rig.add(lines);
  const spawn = (i: number) => {
    const sh = lastF.shape;
    const a = Math.random() * Math.PI * 2;
    const r =
      sh === "ring"
        ? R * (0.7 + Math.random() * 0.18)
        : sh === "core"
          ? Math.sqrt(Math.random()) * R * 0.3
          : Math.sqrt(Math.random()) * R * 0.9;
    dp[i * 3] = Math.cos(a) * r;
    dp[i * 3 + 2] = Math.sin(a) * r;
    dp[i * 3 + 1] = HEAD_Y - 0.05;
    dv[i] = -(2.6 + Math.random() * 1.2);
    alive[i] = 1;
  };

  // splashes
  const SP = 2600;
  const sp = new Float32Array(SP * 3);
  const sv = new Float32Array(SP * 3);
  const sl = new Uint8Array(SP);
  let spi = 0;
  for (let i = 0; i < SP; i++) sp[i * 3 + 1] = -50;
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
  rig.add(splashes);
  const splash = (x: number, y: number, z: number, up: number, spread: number) => {
    const j = (spi = (spi + 1) % SP);
    sp[j * 3] = x;
    sp[j * 3 + 1] = y;
    sp[j * 3 + 2] = z;
    const ang = Math.random() * Math.PI * 2;
    const h = spread * (0.4 + Math.random() * 0.8);
    sv[j * 3] = Math.cos(ang) * h;
    sv[j * 3 + 1] = up * (0.6 + Math.random());
    sv[j * 3 + 2] = Math.sin(ang) * h;
    sl[j] = 1;
  };
  const splashDir = (x: number, z: number, ang: number, up: number, h: number) => {
    const j = (spi = (spi + 1) % SP);
    sp[j * 3] = x;
    sp[j * 3 + 1] = 0.01;
    sp[j * 3 + 2] = z;
    sv[j * 3] = Math.cos(ang) * h;
    sv[j * 3 + 1] = up;
    sv[j * 3 + 2] = Math.sin(ang) * h;
    sl[j] = 1;
  };

  // hand glow
  const handSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: soft, transparent: true, opacity: 0, depthWrite: false, color: 0xfff6ee }),
  );
  handSprite.scale.set(1.1, 0.5, 1);
  rig.add(handSprite);

  // steam
  const steam: THREE.Sprite[] = [];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: soft, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff }),
    );
    const s = 1.5 + Math.random() * 2.5;
    m.scale.set(s, s, 1);
    m.userData = {
      a: Math.random() * Math.PI * 2,
      r: Math.random() * 2.2,
      y: Math.random() * 4.5,
      sp: 0.15 + Math.random() * 0.25,
    };
    rig.add(m);
    steam.push(m);
  }

  let baseCam = [0, 2.4, 10.5];
  const look = new THREE.Vector3();
  const layout = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    const wide = w / h > 1.1;
    cam.fov = wide ? 36 : 42;
    cam.updateProjectionMatrix();
    baseCam = wide ? [0, 2.4, 10.5] : [0, 2.7, 14];
    // Portrait: aim lower so the head rides high, clear of the bottom-anchored headline.
    // Shorter screens have less room above the text, so they aim lower still.
    const short = Math.max(0, Math.min(1, (800 - h) / 200));
    look.set(wide ? 0.8 : 0, wide ? 2.25 : 1.2 - 0.65 * short, 0);
    if (wide) {
      const halfW = Math.tan((cam.fov * Math.PI) / 360) * baseCam[2] * cam.aspect;
      const maxX = look.x + halfW - R - 0.15;
      rig.position.x = Math.min(maxX, 1.9);
    } else rig.position.x = 0;
    const pr = renderer.getPixelRatio();
    rt.setSize(Math.max(2, Math.round(w * pr * 0.5)), Math.max(2, Math.round(h * pr * 0.5)));
  };
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(el);

  const calm = reducedMotion();
  const ndc = new THREE.Vector2();
  let mx = 0;
  let my = 0;
  let inside = false;
  let moved = false;
  const onMove = (e: PointerEvent) => {
    mx = (e.clientX / window.innerWidth) * 2 - 1;
    my = (e.clientY / window.innerHeight) * 2 - 1;
    const r = el.getBoundingClientRect();
    inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    moved = true;
  };
  const onLeave = () => {
    inside = false;
  };
  window.addEventListener("pointermove", onMove);
  document.addEventListener("pointerleave", onLeave);
  let visible = true;
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
  });
  io.observe(el);

  const ray = new THREE.Raycaster();
  const hand = { on: false, x: 0, y: 0, z: 0 };
  let raf = 0;
  let first = true;
  let revive = 0;
  let elapsed = 0;
  let lastT = performance.now();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 1 / 30);
    lastT = now;
    if (!visible) return;
    elapsed += dt;
    const flow = opts.getFlow();
    const Fcur = FLOWS[flow] || FLOWS.rain;
    if (Fcur.n) lastF = Fcur;
    const F = lastF;
    const dens = opts.density ?? 1;
    const target = Math.min(N, Math.round(Fcur.n * dens));
    spot.intensity += ((target ? 80 : 0) - spot.intensity) * 0.05;

    // hand
    hand.on = false;
    if (inside) {
      ray.setFromCamera(ndc, cam);
      const o = ray.ray.origin;
      const d = ray.ray.direction;
      if (Math.abs(d.z) > 1e-4) {
        const k = -o.z / d.z;
        const hx = o.x + d.x * k - rig.position.x;
        const hy = o.y + d.y * k;
        if (k > 0 && Math.abs(hx) < R * 0.95 && hy > 0.3 && hy < HEAD_Y - 0.35) {
          hand.on = true;
          hand.x = hx;
          hand.y = hy;
          hand.z = 0;
        }
      }
      if (!hand.on && moved && d.y < 0) {
        const k = -o.y / d.y;
        impulse(o.x + d.x * k - rig.position.x, o.z + d.z * k, -0.45);
      }
    }
    moved = false;
    handSprite.position.set(hand.x, hand.y, 0.05);
    handSprite.material.opacity += ((hand.on && target ? 0.28 : 0) - handSprite.material.opacity) * 0.15;

    // revive drops at a rate (turn-on effect)
    const gate = F.pulse && target ? (Math.sin(elapsed * 7) > -0.2 ? 1 : 0) : 1;
    revive += target * dt * 1.6 * gate;
    for (let i = 0; i < target && revive >= 1; i++) {
      if (!alive[i]) {
        spawn(i);
        revive -= 1;
      }
    }
    if (revive > target) revive = target;

    for (let i = 0; i < N; i++) {
      const k = i * 3;
      const o = i * 6;
      if (!alive[i]) {
        lp[o + 1] = lp[o + 4] = -100;
        continue;
      }
      const py = dp[k + 1];
      dv[i] -= 9.8 * dt * F.s;
      dp[k + 1] += dv[i] * dt * F.s;
      let ended = false;
      if (
        hand.on &&
        py > hand.y &&
        dp[k + 1] <= hand.y &&
        Math.abs(dp[k] - hand.x) < 0.32 &&
        Math.abs(dp[k + 2] - hand.z) < 0.34
      ) {
        if (Math.random() < 0.35) splash(dp[k], hand.y + 0.02, dp[k + 2], 0.8, 1.1);
        ended = true;
      } else if (dp[k + 1] <= 0) {
        impulse(dp[k], dp[k + 2], F.a);
        const rr = Math.random();
        if (rr < 0.04) {
          const cn = 6 + ((Math.random() * 3) | 0);
          const a0 = Math.random() * 6.283;
          for (let c = 0; c < cn; c++)
            splashDir(dp[k], dp[k + 2], a0 + (c / cn) * 6.283, 0.9 + Math.random() * 0.3, 0.5);
          if (Math.random() < 0.3) splashDir(dp[k], dp[k + 2], 0, 1.8 + Math.random() * 0.4, 0.02);
        } else if (rr < 0.6) {
          const sn = 2 + ((Math.random() * 3) | 0);
          for (let c = 0; c < sn; c++) splash(dp[k], 0.01, dp[k + 2], 1.35, 0.75);
        }
        ended = true;
      }
      if (ended) {
        if (i < target && gate) spawn(i);
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
      lp[o + 4] = dp[k + 1] - dv[i] * 0.02 * F.s;
      lp[o + 5] = dp[k + 2];
    }
    lineGeo.attributes.position.needsUpdate = true;

    for (let j = 0; j < SP; j++) {
      if (!sl[j]) continue;
      const k = j * 3;
      sv[k + 1] -= 9.8 * dt;
      sp[k] += sv[k] * dt;
      sp[k + 1] += sv[k + 1] * dt;
      sp[k + 2] += sv[k + 2] * dt;
      if (sp[k + 1] < 0) {
        impulse(sp[k], sp[k + 2], -0.03);
        if (sl[j] === 1 && sv[k + 1] < -1.4 && Math.random() < 0.3) {
          sp[k + 1] = 0.002;
          sv[k + 1] = -sv[k + 1] * (0.22 + Math.random() * 0.1);
          sv[k] *= 0.6;
          sv[k + 2] *= 0.6;
          sl[j] = 2;
        } else {
          sl[j] = 0;
          sp[k + 1] = -50;
        }
      }
    }
    spGeo.attributes.position.needsUpdate = true;

    for (let z = 1; z < G - 1; z++)
      for (let x = 1; x < G - 1; x++) {
        const i = z * G + x;
        prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - G] + cur[i + G]) * 0.5 - prev[i]) * 0.981;
        if (prev[i] > 2.5) prev[i] = 2.5;
        else if (prev[i] < -2.5) prev[i] = -2.5;
      }
    const tmp = cur;
    cur = prev;
    prev = tmp;
    for (let i = 0; i < G * G; i++) pa[i * 3 + 1] = cur[i] * 0.06;
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();

    const steamAmt = (opts.steam ?? true) && target && flow === "mist" ? 0.9 : 0;
    for (const m of steam) {
      const u = m.userData;
      u.y += u.sp * dt;
      u.a += dt * 0.05;
      if (u.y > 5) {
        u.y = 0;
        u.r = Math.random() * 2.2;
      }
      m.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r);
      m.material.opacity += (steamAmt * 0.07 * Math.sin((Math.PI * u.y) / 5) - m.material.opacity) * 0.05;
    }

    const px = calm ? 0 : mx;
    const py2 = calm ? 0 : my;
    cam.position.x += (baseCam[0] + px * 0.6 - cam.position.x) * 0.035;
    cam.position.y += (baseCam[1] - py2 * 0.3 - cam.position.y) * 0.035;
    cam.position.z += (baseCam[2] - cam.position.z) * 0.035;
    cam.lookAt(look);
    cam.updateMatrixWorld();

    // mirror pass
    mcam.projectionMatrix.copy(cam.projectionMatrix);
    mcam.position.set(cam.position.x, -cam.position.y, cam.position.z);
    mcam.up.set(0, -1, 0);
    mcam.lookAt(look.x, -look.y, look.z);
    mcam.updateMatrixWorld();
    const tm = waterMat.uniforms.texM.value as THREE.Matrix4;
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(mcam.projectionMatrix).multiply(mcam.matrixWorldInverse).multiply(water.matrixWorld);
    waterMat.uniforms.camPos.value.copy(cam.position);
    {
      const U = waterMat.uniforms;
      U.uTime.value += dt;
      if (target) {
        U.uWet.value += (1 - U.uWet.value) * Math.min(1, dt * 1.5);
        U.uRad.value = Math.min(8.5, U.uRad.value + dt * (U.uRad.value < 2.5 ? 0.9 : 0.35));
        (U.uOff.value as THREE.Vector2).multiplyScalar(1 - Math.min(1, dt * 0.8));
      } else {
        U.uOff.value.x += dt * 0.35;
        U.uOff.value.y += dt * 0.22;
        U.uRad.value = Math.max(0, U.uRad.value - dt * (U.uRad.value > 3 ? 0.7 : 0.3));
        if (U.uRad.value < 1.2) U.uWet.value = Math.max(0, U.uWet.value - dt * 0.25);
      }
      if (!U.uWet.value) U.uOff.value.set(0, 0);
    }
    water.visible = false;
    renderer.setRenderTarget(rt);
    renderer.render(scene, mcam);
    renderer.setRenderTarget(null);
    water.visible = true;
    renderer.render(scene, cam);
    if (first) {
      first = false;
      renderer.domElement.style.opacity = "1";
    }
  };
  cam.position.set(baseCam[0], baseCam[1] + 1.2, baseCam[2] + 2.5);
  loop();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerleave", onLeave);
    rt.dispose();
    geo.dispose();
    lineGeo.dispose();
    spGeo.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
