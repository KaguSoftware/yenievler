import * as THREE from "three";
import { baseRenderer, makeEnv, type Dispose } from "./common";
import { FINISHES, STONES, stoneTex } from "./stone";

export interface BasinState {
  stone: number;
  finish: number;
  water: boolean;
}

export interface BasinHandle {
  apply: () => void;
  dispose: Dispose;
}

const BG = 0xdee2e5;

/** Wall-hung stone basin with a wall spout; drag to orbit. */
export function initBasin(el: HTMLElement, getState: () => BasinState): BasinHandle {
  const renderer = baseRenderer(el);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.environment = makeEnv(renderer, 1.3, 0xb7bcc2);
  scene.fog = new THREE.Fog(BG, 7, 14);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);

  const dl = new THREE.DirectionalLight(0xfff4e6, 2.6);
  dl.position.set(2.5, 5, 3);
  dl.castShadow = true;
  dl.shadow.mapSize.set(2048, 2048);
  Object.assign(dl.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 15 });
  dl.shadow.bias = -0.0004;
  scene.add(dl);
  const fill = new THREE.DirectionalLight(0xd8e4ff, 0.5);
  fill.position.set(-3, 2, 2);
  scene.add(fill);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcdd1d6, roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), wallMat);
  wall.position.set(0, 1, -1.05);
  wall.receiveShadow = true;
  scene.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), wallMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  floor.receiveShadow = true;
  scene.add(floor);

  const oak = stoneTex({ name: "oak-slab", base: "#5b412f", vein: "#3b2a1e", pore: "#2e2118", kind: "band" });
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.12, 1.15),
    new THREE.MeshStandardMaterial({ map: oak, roughness: 0.5 }),
  );
  slab.position.set(0, 0, -0.475);
  slab.castShadow = slab.receiveShadow = true;
  scene.add(slab);

  const prof = [
    [0.001, 0], [0.42, 0], [0.48, 0.015], [0.5, 0.05], [0.5, 0.28], [0.494, 0.3],
    [0.47, 0.3], [0.464, 0.285], [0.44, 0.12], [0.39, 0.065], [0.001, 0.055],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const stoneMat = new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.2, side: THREE.DoubleSide });
  const basin = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), stoneMat);
  basin.position.set(0, 0.06, -0.4);
  basin.castShadow = basin.receiveShadow = true;
  scene.add(basin);

  const metal = new THREE.MeshPhysicalMaterial({ clearcoat: 0.6, clearcoatRoughness: 0.1 });
  const mk = (geo: THREE.BufferGeometry, x: number, y: number, z: number, rx?: number) => {
    const m = new THREE.Mesh(geo, metal);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    m.castShadow = true;
    scene.add(m);
    return m;
  };
  mk(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 64), 0, 0.68, -1.04, Math.PI / 2);
  mk(new THREE.CylinderGeometry(0.026, 0.026, 0.46, 48), 0, 0.68, -0.82, Math.PI / 2);
  mk(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 64), 0.42, 0.68, -1.04, Math.PI / 2);
  mk(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 32), 0.42, 0.68, -1.0, Math.PI / 2);
  const lever = mk(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 24), 0.42, 0.68, -0.9, Math.PI / 2 - 0.25);

  const streamMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, emissive: 0x7f98a6, emissiveIntensity: 0.25, roughness: 0, metalness: 0,
    transparent: true, opacity: 0.55, clearcoat: 1,
  });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.53, 24, 1, true), streamMat);
  stream.position.set(0, 0.665 - 0.53 / 2 - 0.02, -0.6);
  scene.add(stream);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(0.39, 64),
    new THREE.MeshPhysicalMaterial({ color: 0xbfd6e0, roughness: 0.02, transparent: true, opacity: 0.25, clearcoat: 1 }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.13, -0.4);
  scene.add(pool);

  const texCache: Record<string, THREE.CanvasTexture> = {};
  let lastStone = -1;
  const apply = () => {
    const s = getState();
    const st = STONES[s.stone];
    const fi = FINISHES[s.finish];
    if (lastStone !== s.stone) {
      lastStone = s.stone;
      stoneMat.map = texCache[st.name] || (texCache[st.name] = stoneTex(st));
      stoneMat.roughness = st.rough;
      stoneMat.needsUpdate = true;
    }
    metal.color.setHex(fi.color);
    metal.metalness = fi.metal;
    metal.roughness = fi.rough;
    stream.visible = pool.visible = s.water;
    lever.rotation.z = s.water ? 0.5 : 0;
  };
  apply();

  const focus = new THREE.Vector3(0, 0.3, -0.45);
  let az = 0.55;
  let azT = 0.55;
  let drag: { x: number; az: number } | null = null;
  let idle = 0;
  let rad = 3.9;
  const layout = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.fov = w / h < 1 ? 38 : 26;
    rad = w / h < 1 ? 4.4 : 3.9;
    cam.updateProjectionMatrix();
  };
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(el);
  const cv = renderer.domElement;
  const down = (e: PointerEvent) => {
    drag = { x: e.clientX, az: azT };
    cv.setPointerCapture(e.pointerId);
    el.style.cursor = "grabbing";
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    azT = Math.max(-0.95, Math.min(0.95, drag.az - (e.clientX - drag.x) * 0.005));
    idle = 0;
  };
  const up = () => {
    drag = null;
    el.style.cursor = "grab";
  };
  cv.addEventListener("pointerdown", down);
  cv.addEventListener("pointermove", move);
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  let visible = true;
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
  });
  io.observe(el);
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
    idle += dt;
    if (!drag && idle > 3) azT += (Math.sin(time * 0.18) * 0.6 - azT) * 0.01;
    az += (azT - az) * 0.08;
    cam.position.set(focus.x + Math.sin(az) * rad, focus.y + 1.35, focus.z + Math.cos(az) * rad);
    cam.lookAt(focus);
    if (stream.visible) stream.scale.x = stream.scale.z = 1 + Math.sin(time * 40) * 0.08;
    renderer.render(scene, cam);
    if (first) {
      first = false;
      cv.style.opacity = "1";
    }
  };
  loop();

  return {
    apply,
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.dispose();
      cv.remove();
    },
  };
}
