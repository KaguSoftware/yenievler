import * as THREE from "three";
import type { Frame, Stage } from "./stage";

/**
 * Water that looks like the shower's: thousands of thin streaking drops with glints, splash
 * bursts and crowns where they land, and expanding rings on the surface. Any stage that has a
 * tap, a spout or a waterfall adds a Jet here instead of drawing a glass tube.
 *
 *   const jet = jets.add({ n: 200, x0, y, z0, vy: -1.4, landY, ringR: 0.1 });
 *   jet.on = 1;            // every frame: 0 off .. 1 full
 *   jet.x0 = ...           // outlets can move (a pull-out tap)
 *
 * One shared set of buffers, one LineSegments, one Points, one instanced ring mesh: a handful of
 * draw calls however many jets exist. No per-frame allocation. With every outlet closed and the
 * last drop landed, the update costs nothing and nothing is drawn.
 */

const MAX_DROPS = 3200;
const MAX_SPLASH = 900;
const MAX_RINGS = 56;
const G = 9.8;

export interface JetOpts {
  /** Most drops alive at once for this jet. */
  n: number;
  /** Outlet: a point, or a segment (x0,z0) to (x1,z1) for a sheet. */
  x0: number;
  y: number;
  z0: number;
  x1?: number;
  z1?: number;
  /** Random radius around the outlet (a round stream is about 0.01 at basin scale). */
  spread?: number;
  /** Initial velocity. vy is negative for down. */
  vx?: number;
  vy?: number;
  vz?: number;
  vJitter?: number;
  /** Height of the water (or floor) the drops land on. */
  landY: number;
  /** Seconds of tail on each streak. */
  tail?: number;
  /** Largest ring radius on landing; 0 for none. */
  ringR?: number;
  /** Splash size multiplier. */
  splash?: number;
}

export interface Jet extends Required<Omit<JetOpts, "x1" | "z1">> {
  x1: number;
  z1: number;
  /** 0 off .. 1 full flow. Set every frame. */
  on: number;
  /** Internal: first drop slot and spawn accumulator. */
  readonly i0: number;
  rev: number;
}

export interface Jets extends Stage {
  add(o: JetOpts): Jet;
  /**
   * Drop everything in the air at once: drops, splashes, rings. For the moment a stage leaves the
   * shot (it is hidden, or the veil is down), so its water is not left hanging where it stood, to
   * play out over whatever the camera looks at next. Safe to call on any frame, updated or not.
   */
  clear(): void;
}

const PALE = new THREE.Color(0xf4fbff);
const MID = new THREE.Color(0x4f7185);

export function buildJets(): Jets {
  const group = new THREE.Group();
  const jets: Jet[] = [];
  let used = 0;

  // Drops: position, velocity, which jet. Line colours are fixed per drop (pale glints and darker edges).
  const dp = new Float32Array(MAX_DROPS * 3);
  const dv = new Float32Array(MAX_DROPS * 3);
  const owner = new Int16Array(MAX_DROPS).fill(-1);
  const alive = new Uint8Array(MAX_DROPS);
  const lp = new Float32Array(MAX_DROPS * 6).fill(-1e4);
  const lc = new Float32Array(MAX_DROPS * 6);
  for (let i = 0; i < MAX_DROPS; i++) {
    const c = Math.random() < 0.38 ? PALE : MID;
    const k = 0.8 + Math.random() * 0.2;
    for (let v = 0; v < 2; v++) {
      lc[i * 6 + v * 3] = c.r * k;
      lc[i * 6 + v * 3 + 1] = c.g * k;
      lc[i * 6 + v * 3 + 2] = c.b * k;
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(lp, 3));
  lineGeo.setAttribute("color", new THREE.BufferAttribute(lc, 3));
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  // Drawn after every transparent surface (the basin wall writes depth), or the wall paints over the stream.
  lines.renderOrder = 10;
  group.add(lines);

  // Splash droplets.
  const sp = new Float32Array(MAX_SPLASH * 3).fill(-1e4);
  const sv = new Float32Array(MAX_SPLASH * 3);
  const sg = new Float32Array(MAX_SPLASH);
  const sl = new Uint8Array(MAX_SPLASH);
  let spi = 0;
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const spMat = new THREE.PointsMaterial({ size: 0.012, color: 0xeef7fc, transparent: true, opacity: 0.9, depthWrite: false });
  const splashes = new THREE.Points(spGeo, spMat);
  splashes.frustumCulled = false;
  splashes.renderOrder = 10;
  group.add(splashes);
  const splash = (x: number, y: number, z: number, gy: number, up: number, spread: number) => {
    const j = (spi = (spi + 1) % MAX_SPLASH);
    sp[j * 3] = x;
    sp[j * 3 + 1] = y;
    sp[j * 3 + 2] = z;
    sg[j] = gy;
    const a = Math.random() * 6.283;
    const h = spread * (0.4 + Math.random() * 0.8);
    sv[j * 3] = Math.cos(a) * h;
    sv[j * 3 + 1] = up * (0.6 + Math.random());
    sv[j * 3 + 2] = Math.sin(a) * h;
    if (!sl[j]) splashLive++;
    sl[j] = 1;
  };

  // Rings on the water: one instanced quad each, the ring itself is drawn in the fragment shader.
  const rx = new Float32Array(MAX_RINGS);
  const ry = new Float32Array(MAX_RINGS);
  const rz = new Float32Array(MAX_RINGS);
  const rmax = new Float32Array(MAX_RINGS);
  const rage = new Float32Array(MAX_RINGS).fill(1);
  const rlive = new Uint8Array(MAX_RINGS);
  let ri = 0;
  let ringsLive = 0;
  const ringGeo = new THREE.PlaneGeometry(1, 1);
  ringGeo.rotateX(-Math.PI / 2);
  const ageAttr = new THREE.InstancedBufferAttribute(rage, 1);
  ageAttr.setUsage(THREE.DynamicDrawUsage);
  ringGeo.setAttribute("aAge", ageAttr);
  const ringMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    uniforms: { uLight: { value: new THREE.Color(0xffffff) }, uDark: { value: new THREE.Color(0x5f7a8a) } },
    vertexShader: /* glsl */ `
      attribute float aAge; varying vec2 vUv; varying float vAge;
      void main(){ vUv = uv; vAge = aAge; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight; uniform vec3 uDark; varying vec2 vUv; varying float vAge;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        if (r > 1.0 || vAge >= 1.0) discard;
        float w = mix(0.07, 0.15, vAge);
        float lit = exp(-pow((r - vAge) / w, 2.0));
        float shade = exp(-pow((r - vAge + 0.09) / (w * 1.2), 2.0));
        float fade = pow(1.0 - vAge, 1.6);
        float a = max(lit * 0.85, shade * 0.5) * fade;
        vec3 col = (uLight * lit + uDark * shade * 0.8) / (lit + shade * 0.8 + 1e-4);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  });
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, MAX_RINGS);
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rings.frustumCulled = false;
  rings.renderOrder = 9;
  group.add(rings);
  const m4 = new THREE.Matrix4();
  const sc = new THREE.Vector3();
  const ps = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const ring = (x: number, y: number, z: number, r: number) => {
    const j = (ri = (ri + 1) % MAX_RINGS);
    rx[j] = x;
    ry[j] = y;
    rz[j] = z;
    rmax[j] = r * (0.7 + Math.random() * 0.5);
    rage[j] = 0;
    if (!rlive[j]) ringsLive++;
    rlive[j] = 1;
  };

  const spawn = (i: number, j: Jet) => {
    const k = i * 3;
    const t = Math.random();
    const a = Math.random() * 6.283;
    const r = Math.sqrt(Math.random()) * j.spread;
    dp[k] = j.x0 + (j.x1 - j.x0) * t + Math.cos(a) * r;
    dp[k + 1] = j.y + (Math.random() - 0.5) * 0.01;
    dp[k + 2] = j.z0 + (j.z1 - j.z0) * t + Math.sin(a) * r;
    const jit = j.vJitter;
    dv[k] = j.vx + (Math.random() - 0.5) * jit;
    dv[k + 1] = j.vy * (0.85 + Math.random() * 0.3);
    dv[k + 2] = j.vz + (Math.random() - 0.5) * jit;
    alive[i] = 1;
  };

  const writeLine = (i: number, tail: number) => {
    const o = i * 6;
    const k = i * 3;
    lp[o] = dp[k];
    lp[o + 1] = dp[k + 1];
    lp[o + 2] = dp[k + 2];
    lp[o + 3] = dp[k] - dv[k] * tail;
    lp[o + 4] = dp[k + 1] - dv[k + 1] * tail;
    lp[o + 5] = dp[k + 2] - dv[k + 2] * tail;
  };
  const hide = (i: number) => {
    lp[i * 6 + 1] = lp[i * 6 + 4] = -1e4;
  };

  let frozenKey = "";
  /** Live counts from the last frame: when all three are zero and no outlet is open there is nothing to do. */
  let dropsLive = 0;
  let splashLive = 0;
  let idle = false;
  const linePos = lineGeo.attributes.position as THREE.BufferAttribute;
  // Park every ring once; afterwards only rings that change are rewritten.
  sc.set(0, 0, 0);
  m4.compose(ps.set(0, -1e4, 0), q, sc);
  for (let r = 0; r < MAX_RINGS; r++) rings.setMatrixAt(r, m4);

  return {
    group,
    add(o) {
      const n = Math.min(o.n, MAX_DROPS - used);
      const j: Jet = {
        n,
        x0: o.x0,
        y: o.y,
        z0: o.z0,
        x1: o.x1 ?? o.x0,
        z1: o.z1 ?? o.z0,
        spread: o.spread ?? 0.01,
        vx: o.vx ?? 0,
        vy: o.vy ?? -1.2,
        vz: o.vz ?? 0,
        vJitter: o.vJitter ?? 0.04,
        landY: o.landY,
        tail: o.tail ?? 0.03,
        ringR: o.ringR ?? 0.1,
        splash: o.splash ?? 1,
        on: 0,
        i0: used,
        rev: 0,
      };
      for (let i = j.i0; i < j.i0 + n; i++) owner[i] = jets.length;
      used += n;
      jets.push(j);
      return j;
    },
    update(f: Frame) {
      const dt = f.dt;
      const reduced = f.reduced;
      // Light water over a light page needs its darker edge; on a dark page the glints carry it.
      spMat.opacity = 0.9;

      if (reduced) {
        // Still water: drops hang as short streaks along their fall, no flying, no rings.
        let key = "";
        for (const j of jets) key += Math.round(j.on * j.n) + ":" + j.x0.toFixed(2) + j.y.toFixed(2) + j.landY.toFixed(2) + ";";
        if (key !== frozenKey) {
          frozenKey = key;
          for (const j of jets) {
            const target = Math.round(j.on * j.n);
            for (let i = j.i0; i < j.i0 + j.n; i++) {
              if (i - j.i0 < target) {
                spawn(i, j);
                const k = i * 3;
                dp[k + 1] = j.landY + Math.random() * Math.max(0.02, j.y - j.landY);
                writeLine(i, j.tail);
              } else {
                alive[i] = 0;
                hide(i);
              }
            }
          }
          lineGeo.attributes.position.needsUpdate = true;
        }
        rings.count = 0;
        return;
      }

      // Revive drops at a rate, so a tap that opens fills in instead of popping.
      let open = false;
      for (const j of jets) {
        const target = Math.round(Math.max(0, Math.min(1, j.on)) * j.n);
        if (target) open = true;
        j.rev += target * dt * 3;
        for (let i = j.i0; i < j.i0 + target && j.rev >= 1; i++)
          if (!alive[i]) {
            spawn(i, j);
            j.rev -= 1;
            dropsLive++;
          }
        if (j.rev > target) j.rev = target;
      }

      // Everything closed and settled: skip the simulation and the draw calls until an outlet opens.
      const settled = !open && dropsLive === 0 && splashLive === 0 && ringsLive === 0;
      if (settled !== idle) {
        idle = settled;
        lines.visible = splashes.visible = !settled;
        if (settled) rings.visible = false;
      }
      if (settled) return;

      if (dropsLive) {
        let n = 0;
        for (let i = 0; i < used; i++) {
          if (!alive[i]) continue;
          const j = jets[owner[i]];
          const k = i * 3;
          const prevY = dp[k + 1];
          dv[k + 1] -= G * dt;
          dp[k] += dv[k] * dt;
          dp[k + 1] += dv[k + 1] * dt;
          dp[k + 2] += dv[k + 2] * dt;
          if (dp[k + 1] <= j.landY && prevY <= j.landY && dv[k + 1] < 0) {
            // Already under the surface and still falling: the surface rose past it between frames (a
            // bowl filling, a basin lifting as the page scrolls back). It will never cross it now, so
            // it goes quietly; left alone it would fall for ever and its slot would never be reused.
            if (i - j.i0 < Math.round(Math.max(0, Math.min(1, j.on)) * j.n)) spawn(i, j);
            else {
              alive[i] = 0;
              hide(i);
              continue;
            }
          } else if (dp[k + 1] <= j.landY && prevY > j.landY) {
            const x = dp[k];
            const z = dp[k + 2];
            const rr = Math.random();
            const s = j.splash;
            if (rr < 0.05) {
              // a crown: a ring of droplets thrown up and out
              const cn = 6 + ((Math.random() * 3) | 0);
              const a0 = Math.random() * 6.283;
              for (let c = 0; c < cn; c++) {
                const jj = (spi = (spi + 1) % MAX_SPLASH);
                sp[jj * 3] = x;
                sp[jj * 3 + 1] = j.landY + 0.002;
                sp[jj * 3 + 2] = z;
                sg[jj] = j.landY;
                const a = a0 + (c / cn) * 6.283;
                sv[jj * 3] = Math.cos(a) * 0.32 * s;
                sv[jj * 3 + 1] = (0.55 + Math.random() * 0.25) * s;
                sv[jj * 3 + 2] = Math.sin(a) * 0.32 * s;
                if (!sl[jj]) splashLive++;
                sl[jj] = 1;
              }
            } else if (rr < 0.6) {
              const sn = 1 + ((Math.random() * 3) | 0);
              for (let c = 0; c < sn; c++) splash(x, j.landY + 0.002, z, j.landY, 0.8 * s, 0.4 * s);
            }
            if (j.ringR > 0 && Math.random() < 0.22) ring(x, j.landY, z, j.ringR);
            if (i - j.i0 < Math.round(Math.max(0, Math.min(1, j.on)) * j.n)) spawn(i, j);
            else {
              alive[i] = 0;
              hide(i);
              continue;
            }
          }
          n++;
          writeLine(i, j.tail);
        }
        dropsLive = n;
        // Only the slots jets own are ever written.
        linePos.addUpdateRange(0, used * 6);
        linePos.needsUpdate = true;
      }

      if (splashLive) {
        let n = 0;
        for (let s = 0; s < MAX_SPLASH; s++) {
          if (!sl[s]) continue;
          const k = s * 3;
          sv[k + 1] -= G * dt;
          sp[k] += sv[k] * dt;
          sp[k + 1] += sv[k + 1] * dt;
          sp[k + 2] += sv[k + 2] * dt;
          if (sp[k + 1] < sg[s]) {
            if (sl[s] === 1 && sv[k + 1] < -0.5 && Math.random() < 0.25) {
              sp[k + 1] = sg[s] + 0.001;
              sv[k + 1] = -sv[k + 1] * 0.3;
              sv[k] *= 0.6;
              sv[k + 2] *= 0.6;
              sl[s] = 2;
            } else {
              sl[s] = 0;
              sp[k + 1] = -1e4;
              continue;
            }
          }
          n++;
        }
        splashLive = n;
        spGeo.attributes.position.needsUpdate = true;
      }

      if (ringsLive) {
        let live = 0;
        for (let r = 0; r < MAX_RINGS; r++) {
          if (!rlive[r]) continue;
          rage[r] += dt / 1.1;
          if (rage[r] >= 1) {
            // park a finished ring out of sight at zero scale, once
            rlive[r] = 0;
            rage[r] = 1;
            sc.set(0, 0, 0);
            m4.compose(ps.set(0, -1e4, 0), q, sc);
          } else {
            live++;
            const d = rmax[r] * 2;
            sc.set(d, 1, d);
            m4.compose(ps.set(rx[r], ry[r] + 0.0015, rz[r]), q, sc);
          }
          rings.setMatrixAt(r, m4);
        }
        ringsLive = live;
        rings.count = MAX_RINGS;
        rings.instanceMatrix.needsUpdate = true;
        ageAttr.needsUpdate = true;
      }
      rings.visible = ringsLive > 0;
    },
    clear() {
      if (!dropsLive && !splashLive && !ringsLive) return;
      for (let i = 0; i < used; i++)
        if (alive[i]) {
          alive[i] = 0;
          hide(i);
        }
      for (const j of jets) j.rev = 0;
      frozenKey = "";
      dropsLive = 0;
      linePos.addUpdateRange(0, used * 6);
      linePos.needsUpdate = true;
      for (let s = 0; s < MAX_SPLASH; s++)
        if (sl[s]) {
          sl[s] = 0;
          sp[s * 3 + 1] = -1e4;
        }
      splashLive = 0;
      spGeo.attributes.position.needsUpdate = true;
      sc.set(0, 0, 0);
      m4.compose(ps.set(0, -1e4, 0), q, sc);
      for (let r = 0; r < MAX_RINGS; r++)
        if (rlive[r]) {
          rlive[r] = 0;
          rage[r] = 1;
          rings.setMatrixAt(r, m4);
        }
      ringsLive = 0;
      rings.instanceMatrix.needsUpdate = true;
      ageAttr.needsUpdate = true;
      // Nothing left to draw; the next update() sees it settled, or an outlet opening.
      rings.visible = false;
      lines.visible = splashes.visible = false;
      idle = true;
    },
    dispose() {
      lineGeo.dispose();
      lineMat.dispose();
      spGeo.dispose();
      spMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      rings.dispose();
    },
  };
}
