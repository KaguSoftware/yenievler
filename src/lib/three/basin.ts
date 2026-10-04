import * as THREE from "three";
import { damp, smooth } from "./common";
import { FINISHES, STONES, stoneTex } from "./stone";
import { BASIN_Z, C } from "./timeline";
import { ui } from "./state";
import type { BuildCtx, Frame, Stage } from "./stage";
import type { Water } from "./water";

/** Azimuth the timeline's basin pose was authored at. Dragging orbits around it. */
const AZ0 = 0.55;
/** The cluster is the old basin scene, slid so its local floor (-1.2) sits on the world ground. */
const FLOOR = 1.2;

export interface BasinStage extends Stage {
  /** Text for the canvas while this station is live. */
  label(): string;
  /** Switch shadows on once so every shader variant compiles before the first frame. */
  prewarm(): void;
}

/** Wall-hung stone basin with a wall spout, as in the old builder. Drag to orbit. */
export function buildBasin(ctx: BuildCtx, water: Water): BasinStage {
  const group = new THREE.Group();
  group.position.z = BASIN_Z;
  const env = ctx.envBasin;

  const dl = new THREE.DirectionalLight(0xfff4e6, 2.6);
  dl.position.set(2.5, 5, 3);
  dl.castShadow = true;
  dl.shadow.mapSize.set(2048, 2048);
  Object.assign(dl.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 15 });
  dl.shadow.bias = -0.0004;
  const fill = new THREE.DirectionalLight(0xd8e4ff, 0.5);
  fill.position.set(-3, 2, 2);
  group.add(dl, dl.target, fill, fill.target);

  // A wall that dissolves toward its top so no hard edge shows while the camera falls past it.
  const wallAlpha = (() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const g = c.getContext("2d")!;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "#000");
    gr.addColorStop(0.28, "#fff");
    gr.addColorStop(1, "#fff");
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 256);
    return new THREE.CanvasTexture(c);
  })();
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xcdd1d6,
    roughness: 0.95,
    envMap: env,
    transparent: true,
    alphaMap: wallAlpha,
    depthWrite: true,
  });
  const WALL_H = 5;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, WALL_H), wallMat);
  wall.position.set(0, -FLOOR + WALL_H / 2 - 0.3, -1.05);
  wall.receiveShadow = true;
  group.add(wall);
  // Catches the basin's shadow on the ground without hiding the ripple floor.
  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.ShadowMaterial({ opacity: 0.22, depthWrite: false }),
  );
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = -FLOOR + 0.004;
  catcher.receiveShadow = true;
  group.add(catcher);

  const oak = stoneTex({ name: "oak-slab", base: "#5b412f", vein: "#3b2a1e", pore: "#2e2118", kind: "band" });
  const slabMat = new THREE.MeshStandardMaterial({ map: oak, roughness: 0.5, envMap: env });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.15), slabMat);
  slab.position.set(0, 0, -0.475);
  slab.castShadow = slab.receiveShadow = true;
  group.add(slab);

  const prof = [
    [0.001, 0], [0.42, 0], [0.48, 0.015], [0.5, 0.05], [0.5, 0.28], [0.494, 0.3],
    [0.47, 0.3], [0.464, 0.285], [0.44, 0.12], [0.39, 0.065], [0.001, 0.055],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const stoneMat = new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.2, side: THREE.DoubleSide, envMap: env });
  const basin = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), stoneMat);
  basin.position.set(0, 0.06, -0.4);
  basin.castShadow = basin.receiveShadow = true;
  group.add(basin);

  const metal = new THREE.MeshPhysicalMaterial({ clearcoat: 0.6, clearcoatRoughness: 0.1, envMap: env });
  const geos: THREE.BufferGeometry[] = [];
  const mk = (geo: THREE.BufferGeometry, x: number, y: number, z: number, rx?: number) => {
    geos.push(geo);
    const m = new THREE.Mesh(geo, metal);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    m.castShadow = true;
    group.add(m);
    return m;
  };
  mk(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 64), 0, 0.68, -1.04, Math.PI / 2);
  mk(new THREE.CylinderGeometry(0.026, 0.026, 0.46, 48), 0, 0.68, -0.82, Math.PI / 2);
  mk(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 64), 0.42, 0.68, -1.04, Math.PI / 2);
  mk(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 32), 0.42, 0.68, -1.0, Math.PI / 2);
  const lever = mk(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 24), 0.42, 0.68, -0.9, Math.PI / 2 - 0.25);

  const streamMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, emissive: 0x7f98a6, emissiveIntensity: 0.25, roughness: 0, metalness: 0,
    transparent: true, opacity: 0, clearcoat: 1, depthWrite: false,
  });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.53, 24, 1, true), streamMat);
  stream.position.set(0, 0.665 - 0.53 / 2 - 0.02, -0.6);
  group.add(stream);
  const poolMat = new THREE.MeshPhysicalMaterial({ color: 0xbfd6e0, roughness: 0.02, transparent: true, opacity: 0.25, clearcoat: 1, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.39, 64), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.13, -0.4);
  group.add(pool);

  const texCache: Record<string, THREE.CanvasTexture> = {};
  let lastStone = -1;
  let lastFinish = -1;
  let lastWater: boolean | null = null;
  const apply = () => {
    const st = STONES[ui.stone];
    const fi = FINISHES[ui.finish];
    if (lastStone !== ui.stone) {
      lastStone = ui.stone;
      stoneMat.map = texCache[st.name] || (texCache[st.name] = stoneTex(st));
      stoneMat.roughness = st.rough;
      stoneMat.needsUpdate = true;
    }
    if (lastFinish !== ui.finish) {
      lastFinish = ui.finish;
      metal.color.setHex(fi.color);
      metal.metalness = fi.metal;
      metal.roughness = fi.rough;
    }
    if (lastWater !== ui.water) {
      lastWater = ui.water;
      lever.rotation.z = ui.water ? 0.5 : 0;
    }
  };
  apply();

  // Orbit: drag on the canvas (which only takes pointer events while this station is live).
  const cv = ctx.canvas;
  let az = AZ0;
  let azT = AZ0;
  let drag: { x: number; az: number } | null = null;
  let idle = 0;
  let live = false;
  const down = (e: PointerEvent) => {
    if (!live) return;
    drag = { x: e.clientX, az: azT };
    cv.setPointerCapture(e.pointerId);
    cv.style.cursor = "grabbing";
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    azT = Math.max(-0.95, Math.min(0.95, drag.az - (e.clientX - drag.x) * 0.005));
    idle = 0;
  };
  const up = () => {
    drag = null;
    if (live) cv.style.cursor = "grab";
  };
  cv.addEventListener("pointerdown", down);
  cv.addEventListener("pointermove", move);
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);

  let time = 0;
  const off = new THREE.Vector3();

  return {
    group,
    label: () =>
      `3D basin in ${STONES[ui.stone].name} with ${FINISHES[ui.finish].name.toLowerCase()} fittings. Drag to orbit.`,
    prewarm() {
      dl.castShadow = true;
    },
    update(f: Frame) {
      const s = f.s;
      apply();
      const ground = s[C.ground];
      const sink = s[C.sink];
      const over = s[C.overflow];
      const cfg = s[C.cfg];
      time += f.dt;
      group.position.y = ground + FLOOR - sink * 5.6;
      const w = smooth(0.02, 0.6, s[C.basin]);
      dl.intensity = 2.6 * w;
      fill.intensity = 0.5 * w;
      dl.castShadow = w > 0.05 && sink < 0.9;

      // The pool brims as the basin overflows.
      const poolY = 0.13 + over * 0.155;
      pool.position.y = poolY;
      const poolR = 0.39 + over * 0.075;
      pool.scale.set(poolR / 0.39, poolR / 0.39, 1);

      // One stream. The drop system draws it; the glass tube only adds body once the curtain has narrowed.
      const narrow = 1 - smooth(0.02, 0.6, s[C.emitR]);
      const flowing = ui.water ? 1 : 0;
      streamMat.opacity = 0.5 * narrow * flowing * (1 - smooth(0.2, 0.7, over));
      stream.visible = streamMat.opacity > 0.01;
      pool.visible = ui.water || over > 0.05;
      if (stream.visible && !f.reduced) stream.scale.x = stream.scale.z = 1 + Math.sin(time * 40) * 0.08;

      water.pool.on = (ui.water || over > 0.05) && w > 0.3;
      water.pool.x = 0;
      water.pool.z = group.position.z - 0.4;
      water.pool.y = group.position.y + poolY;
      water.pool.r = poolR;
      water.spill.y = group.position.y + 0.06;
      water.spill.z = group.position.z + 0.12;
      water.spill.x0 = -1.15;
      water.spill.x1 = 1.15;

      // Orbit the camera about the look target, only while the configurator is live.
      live = cfg > 0.6;
      idle += f.dt;
      if (!drag && idle > 3) azT += (AZ0 + Math.sin(time * 0.18) * 0.6 - azT) * damp(f.dt, 0.6);
      az += (azT - az) * damp(f.dt, 5);
      if (cfg > 0.001) {
        const da = (az - AZ0) * cfg;
        off.copy(f.cam.position).sub(f.look);
        const c = Math.cos(da);
        const sn = Math.sin(da);
        const x = off.x * c + off.z * sn;
        const z = -off.x * sn + off.z * c;
        f.cam.position.set(f.look.x + x, f.cam.position.y, f.look.z + z);
        f.cam.lookAt(f.look);
      }
    },
    dispose() {
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
      geos.forEach((g) => g.dispose());
      [wall, catcher, slab, basin, stream, pool].forEach((m) => {
        m.geometry.dispose();
      });
      [wallMat, slabMat, stoneMat, metal, streamMat, poolMat, catcher.material as THREE.Material].forEach((m) => m.dispose());
      [wallAlpha, oak, ...Object.values(texCache)].forEach((t) => t.dispose());
      dl.dispose();
      fill.dispose();
    },
  };
}
