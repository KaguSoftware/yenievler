import * as THREE from "three";
import { pinScreenHeight, smallScreenHeight } from "../screenHeight";
import { damp, domRef, makeEnv, reducedMotion, smooth } from "./common";
import { buildBasin } from "./basin";
import { buildExploded } from "./exploded";
import { buildFx } from "./fx";
import { buildJets } from "./jets";
import { buildHero } from "./hero";
import { buildSink } from "./sink";
import { buildWater } from "./water";
import { ui, probe, worldStatus } from "./state";
import {
  C,
  N_CH,
  buildTimeline,
  keyAt,
  labToLinear,
  resolveTimeline,
  restIndex,
  sampleRest,
  sampleTimeline,
  toSRGB8,
  type Geometry,
  type Timeline,
} from "./timeline";
import type { BuildCtx, Frame, Stage } from "./stage";

export interface WorldOptions {
  /** Drop density multiplier (1 by default). */
  density?: number;
  /** Master progress smoothing rate, per second. Higher is snappier. */
  follow?: number;
}

export interface World {
  dispose(): void;
}

const root = () => document.documentElement;

/**
 * Phones and portrait screens get their own keyframe set. The same media query as the `stack` and
 * `stage` variants in globals.css, so the camera keys and the layout they are framed for never
 * disagree (a scrollbar's width, or a window that is exactly square, would split a size test).
 */
const MOBILE_QUERY = "(max-width: 639.98px), (max-aspect-ratio: 1/1)";

/**
 * The mobile keys are framed on a 390 x 844 phone. A narrower screen widens the lens until the
 * same width of world fits across it; a wider one keeps the keyed lens and simply sees more.
 */
const MOBILE_ASPECT = 390 / 844;

/** Touch screens: no hover parallax, a lighter pixel budget, and the toolbar's resizes ignored. */
const coarse = () => window.matchMedia("(pointer: coarse)").matches;

/**
 * One renderer, one scene, one loop. The camera descends a single vertical axis while the
 * document scrolls over the canvas; everything the camera passes is a stage on that axis.
 */
export function initWorld(el: HTMLElement, options: WorldOptions = {}): World {
  probe.follow = options.follow ?? 7;
  const reduced = reducedMotion();
  // Read-only window into the loop for tests and the console.
  (window as unknown as { __yeniEvlerYapi: typeof probe }).__yeniEvlerYapi = probe;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    console.error(e);
    fail();
    return { dispose() {} };
  }
  const touch = coarse();
  // Phones have 3x screens and a fraction of the GPU. Start lower there; the loop steps down further
  // if frames run long (see `budget` below).
  const maxPR = Math.min(window.devicePixelRatio, touch ? 1.75 : 2);
  let pixelRatio = maxPR;
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    display: "block",
    opacity: "0",
    touchAction: "pan-y",
    pointerEvents: "none",
    transition: reduced ? "none" : "opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
  } satisfies Partial<CSSStyleDeclaration>);
  canvas.setAttribute("aria-hidden", "true");
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 60, 120);
  const envHero = makeEnv(renderer, 0.85, 0xa8431f);
  const envBasin = makeEnv(renderer, 1.3, 0xb7bcc2);
  const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 140);
  scene.add(cam);
  const look = new THREE.Vector3();

  const ctx: BuildCtx = {
    renderer,
    scene,
    canvas,
    envHero,
    envBasin,
    mobile: () => mobile,
    reduced,
  };

  /* ----------------------------------------------------------------- stages */
  const water = buildWater(options.density ?? 1);
  const exploded = buildExploded(ctx);
  const hero = buildHero(ctx, water);
  const jets = buildJets();
  const basin = buildBasin(ctx, water, jets);
  const sink = buildSink(ctx, { on: C.sinkOn, seq: C.sinkSeq, drain: C.sinkDrain, live: C.sinkLive }, jets);
  const fx = buildFx();
  const stages: Stage[] = [water, exploded, hero, basin, sink, jets, fx];
  for (const st of stages) scene.add(st.group);

  /* ---------------------------------------------------------------- timeline */
  const tls: Record<"desktop" | "mobile", Timeline> = {
    desktop: buildTimeline("desktop"),
    mobile: buildTimeline("mobile"),
  };
  const mobileMq = window.matchMedia(MOBILE_QUERY);
  let mobile = false;
  let tl = tls.desktop;
  const S = new Float64Array(N_CH);
  const geom: Geometry = { rects: {}, vh: 1, maxScroll: 1 };
  let vw = 1;
  let vh = 1;
  /**
   * The height the shot is framed for: the screen with a phone's toolbar out. The canvas is as tall as
   * the screen can get (vh), and the strip below this only shows more of the scene, so the shot keeps
   * the roomy framing whether the toolbar is out or tucked away. Equal to vh on desktop.
   */
  let fh = 1;
  let layoutDirty = true;

  const measure = () => {
    layoutDirty = false;
    vw = el.clientWidth || window.innerWidth;
    vh = el.clientHeight || window.innerHeight;
    fh = Math.min(vh, frameH || vh);
    const pr = renderer.getPixelRatio();
    renderer.setSize(vw, vh, false);
    cam.aspect = vw / vh;
    water.resize?.(vw, vh, pr);
    mobile = mobileMq.matches;
    tl = mobile ? tls.mobile : tls.desktop;
    const sy = window.scrollY;
    // The host is pinned to the large viewport (World.tsx), so this does not move when a phone's
    // toolbar slides in and out, and neither do the keys anchored in viewport heights.
    geom.vh = fh;
    geom.maxScroll = Math.max(1, root().scrollHeight - window.innerHeight);
    const rects: Geometry["rects"] = {};
    document.querySelectorAll<HTMLElement>("[data-station]").forEach((n) => {
      const r = n.getBoundingClientRect();
      rects[n.dataset.station as string] = { top: r.top + sy, bottom: r.bottom + sy };
    });
    geom.rects = rects;
    resolveTimeline(tl, geom);
    probe.keyP = Object.fromEntries(tl.names.map((n, i) => [n, tl.p[i]]));
  };
  const markDirty = () => {
    layoutDirty = true;
  };
  // On a phone, scrolling shows and hides the browser toolbar, which resizes the window by its height
  // alone. Resizing the canvas or re-resolving the timeline then would reframe the shot mid-scroll, so
  // the host is pinned in px and only a real change (rotation, split screen, a window drag) counts.
  let frameH = 0;
  const unpin = pinScreenHeight(el, {
    grow: true,
    onChange: (screen) => {
      if (screen) frameH = smallScreenHeight();
      markDirty();
    },
  });
  const ro = new ResizeObserver(markDirty);
  ro.observe(el);
  ro.observe(document.body);
  window.addEventListener("load", markDirty);
  document.fonts?.ready.then(markDirty);

  /* ----------------------------------------------------------------- pointer */
  const ptr = { x: 0, y: 0, ndcX: 0, ndcY: 0, inside: false, moved: false };
  let mx = 0;
  let my = 0;
  const onMove = (e: PointerEvent) => {
    // A finger is not a cursor: a tap on the mixer must not swing the hero camera to that corner.
    if (e.pointerType === "mouse") {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    }
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    ptr.ndcX = (e.clientX / vw) * 2 - 1;
    ptr.ndcY = -(e.clientY / vh) * 2 + 1;
    ptr.inside = true;
    ptr.moved = true;
  };
  const onLeave = () => {
    ptr.inside = false;
  };
  window.addEventListener("pointermove", onMove);
  document.addEventListener("pointerleave", onLeave);

  let hidden = document.visibilityState === "hidden";
  let lastT = performance.now();
  const onVis = () => {
    hidden = document.visibilityState === "hidden";
    lastT = performance.now();
  };
  document.addEventListener("visibilitychange", onVis);

  /* -------------------------------------------------------------------- loop */
  const frame: Frame = {
    s: S,
    dt: 0,
    time: 0,
    cam,
    look,
    vw: 1,
    vh: 1,
    mobile: false,
    reduced,
    ptr,
    flow: "rain",
    speed: 0,
    bg: { lin: new Float64Array(3), srgb: new Float64Array(3) },
  };
  const bgColor = new THREE.Color();
  // Two framed windows: the basin builder's, and the sink console's while the sink is in.
  const pinEl = domRef('[data-world-pin=""]');
  const pinSinkEl = domRef('[data-world-pin="sink"]');
  const prevCam = new THREE.Vector3();
  let Ps = -1;
  let parX = 0;
  let parY = 0;
  let speed = 0;
  let lastRGB = -1;
  let interactive = false;
  let lastLabel = "";
  let veil = 0;
  /** Last canvas opacity written for the timeline's veil channel. */
  let veilShown = "";
  let restShown = -1;
  let restWanted = -1;
  let first = true;
  let raf = 0;
  let time = 0;

  const setBackground = () => {
    labToLinear(S[C.bgL], S[C.bgA], S[C.bgB], frame.bg.lin);
    const r8 = toSRGB8(frame.bg.lin[0]);
    const g8 = toSRGB8(frame.bg.lin[1]);
    const b8 = toSRGB8(frame.bg.lin[2]);
    frame.bg.srgb[0] = r8 / 255;
    frame.bg.srgb[1] = g8 / 255;
    frame.bg.srgb[2] = b8 / 255;
    // Clear colour and the CSS variable come from the same 8-bit value, so they cannot drift apart.
    bgColor.setRGB(r8 / 255, g8 / 255, b8 / 255, THREE.SRGBColorSpace);
    renderer.setClearColor(bgColor, 1);
    (scene.fog as THREE.Fog).color.copy(bgColor);
    const packed = (r8 << 16) | (g8 << 8) | b8;
    if (packed !== lastRGB) {
      lastRGB = packed;
      document.body.style.setProperty("--bg", `rgb(${r8} ${g8} ${b8})`);
    }
  };

  // Frame budget: if the last two seconds averaged under ~45 fps, render fewer pixels (down to 1x).
  // It only ever steps down, so the resolution never pumps up and down while someone scrolls.
  let slowT = 0;
  let slowN = 0;
  let slowSum = 0;
  const budget = (dt: number) => {
    // The first seconds compile shaders and decode textures; they say nothing about the device.
    if (first || time < 3 || pixelRatio <= 1) return;
    slowT += dt;
    slowSum += dt;
    slowN++;
    if (slowT < 2) return;
    const avg = slowSum / slowN;
    slowT = slowSum = slowN = 0;
    if (avg < 1 / 45) return;
    pixelRatio = Math.max(1, Math.round((pixelRatio - 0.25) * 4) / 4);
    renderer.setPixelRatio(pixelRatio);
    layoutDirty = true;
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - lastT) / 1000, 1 / 30);
    lastT = now;
    if (hidden) return;
    if (layoutDirty) measure();
    time += dt;

    // Master scroll progress, 0 to 1 over the whole document, eased with a frame-rate independent lerp.
    const y = window.scrollY;
    const target = Math.min(1, Math.max(0, y / geom.maxScroll));
    if (Ps < 0 || reduced) Ps = target;
    else Ps += (target - Ps) * damp(dt, probe.follow);

    if (reduced) {
      const idx = restIndex(tl, geom, y);
      if (restShown < 0) restShown = restWanted = idx;
      if (idx !== restWanted) restWanted = idx;
      // Cross-fade between rest poses: dip the canvas, swap the pose at the bottom, bring it back.
      const goal = restWanted !== restShown ? 1 : 0;
      veil += (goal - veil) * damp(dt, 14);
      if (goal && veil > 0.97) {
        restShown = restWanted;
        veil = 1;
      }
      canvas.style.opacity = String(first ? 0 : (1 - veil).toFixed(3));
      sampleRest(tl, restShown, S);
    } else sampleTimeline(tl, Ps, S);

    // Water you can turn off at the basin; the Stop key only holds while the hero is the shot.
    S[C.water] *= ui.water ? 1 : 1 - S[C.cfg];
    const heroOn = S[C.para] > 0.5;
    frame.flow = ui.flow === "off" && !heroOn ? "rain" : ui.flow;

    setBackground();

    // Camera from the table, plus a little pointer parallax while the hero is the shot.
    const para = reduced ? 0 : S[C.para];
    parX += (mx * 0.6 - parX) * damp(dt, 2.2);
    parY += (my * 0.3 - parY) * damp(dt, 2.2);
    cam.position.set(S[C.camX] + parX * para, S[C.camY] - parY * para, S[C.camZ]);
    look.set(S[C.lookX], S[C.lookY], S[C.lookZ]);

    // The basin is framed to its DOM window (desktop column, phone block): same world height as the
    // window is tall, and the principal point sits on the window's centre. See the end of the frame.
    const pin = S[C.pin];
    const pe = pin > 0.001 ? (S[C.sinkOn] > 0.5 ? pinSinkEl() : pinEl()) : null;
    const pr = pe ? pe.getBoundingClientRect() : null;
    let fovNow = S[C.fov];
    // Phones narrower than the one the mobile keys were framed on: keep the same width of world in
    // shot. A pinned window has its own shape, so this hands over to the pin as it takes hold.
    const fit = mobile ? Math.max(1, MOBILE_ASPECT / (vw / fh)) : 1;
    if (fit > 1) {
      const t = Math.tan((fovNow * Math.PI) / 360) * (1 + (fit - 1) * (1 - pin));
      fovNow = (2 * Math.atan(t) * 180) / Math.PI;
    }
    if (pr && pr.height > 1) {
      const k = 1 + (pr.height / fh - 1) * pin;
      fovNow = (2 * Math.atan(Math.tan((fovNow * Math.PI) / 360) * k) * 180) / Math.PI;
    }
    cam.fov = fovNow;
    cam.aspect = vw / fh;
    cam.updateProjectionMatrix();
    // Extend the frame down over the rest of the canvas: the top fh px keep exactly the framed shot.
    const ext = fh / vh;
    if (ext < 1) {
      const e = cam.projectionMatrix.elements;
      e[5] *= ext;
      e[9] = ext - 1;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }
    cam.lookAt(look);
    cam.updateMatrixWorld();

    const sd = prevCam.distanceTo(cam.position) / Math.max(dt, 1e-3);
    prevCam.copy(cam.position);
    speed += (Math.min(sd, 40) - speed) * damp(dt, 6);
    if (first || reduced) speed = 0;

    frame.dt = reduced ? 0 : dt;
    frame.time = time;
    frame.vw = vw;
    frame.vh = vh;
    frame.mobile = mobile;
    frame.speed = speed;

    // While the veil hides the canvas completely there is nothing to see: no stage steps, nothing is
    // drawn. The water picks up where it stopped when the veil lifts.
    const blind = !reduced && !first && S[C.veil] > 0.999;

    // Skip every stage the camera cannot see: hidden groups are neither updated nor drawn.
    hero.group.visible = S[C.head] > 0.5;
    exploded.group.visible = S[C.stack] > 0.5;
    basin.group.visible = S[C.basin] > 0.01;
    sink.group.visible = S[C.sinkOn] > 0.01;
    fx.group.visible = S[C.fx] > 0.01 && !reduced;
    exploded.always?.(frame);
    sink.always?.(frame);
    basin.always?.(frame);
    if (!hero.group.visible || blind) water.hand.on = false;
    if (!blind) {
      if (exploded.group.visible) exploded.update(frame);
      if (hero.group.visible) hero.update(frame);
      if (basin.group.visible) basin.update(frame);
      if (sink.group.visible) sink.update(frame);
      jets.update(frame);
      water.update(frame);
      if (fx.group.visible) fx.update(frame);
    }
    ptr.moved = false;

    // Off-axis framing: shift the principal point so the look target lands on the window's centre.
    // A free shot can also be framed off-centre (a shifted lens), fading out as a pin takes over.
    let shiftX = S[C.shiftX] * (1 - pin);
    let shiftY = S[C.shiftY] * (1 - pin);
    if (pr) {
      shiftX += (((pr.left + pr.width / 2) / vw) * 2 - 1) * pin;
      shiftY += (1 - ((pr.top + pr.height / 2) / fh) * 2) * pin;
    }
    if (shiftX || shiftY) {
      const e = cam.projectionMatrix.elements;
      e[8] = -shiftX;
      e[9] = -shiftY * ext + ext - 1;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }

    // Pointer events and the accessible name belong to the basin station only.
    const live = S[C.cfg] > 0.6;
    if (live !== interactive) {
      interactive = live;
      canvas.style.pointerEvents = live ? "auto" : "none";
      canvas.style.cursor = live ? "grab" : "";
      if (live) canvas.setAttribute("role", "img");
      else canvas.removeAttribute("role");
      canvas.setAttribute("aria-hidden", live ? "false" : "true");
      if (!live) {
        canvas.removeAttribute("aria-label");
        lastLabel = "";
      }
    }
    if (live) {
      const label = basin.label();
      if (label !== lastLabel) {
        lastLabel = label;
        canvas.setAttribute("aria-label", label);
      }
    }

    if (!blind) {
      if (water.floorShown()) {
        const fxOn = fx.group.visible;
        fx.group.visible = false;
        water.reflect(renderer, scene, cam, look);
        fx.group.visible = fxOn;
      }
      renderer.render(scene, cam);
      budget(dt);
    }

    probe.p = Ps;
    probe.target = target;
    probe.key = keyAt(tl, Ps);
    probe.w = vw;
    probe.frames++;

    // The timeline's veil fades the whole world into the page colour (the sink arriving out of the
    // paper, the dive down its drain into the dark). The first frame keeps its CSS fade-in.
    if (!reduced && !first) {
      const vo = (1 - S[C.veil]).toFixed(3);
      if (vo !== veilShown) {
        if (veilShown !== "") canvas.style.transition = "none";
        veilShown = vo;
        canvas.style.opacity = vo;
      }
    }

    if (first) {
      first = false;
      if (!reduced) canvas.style.opacity = "1";
      root().dataset.world = "on";
      worldStatus.set("on");
    }
  };

  /* ------------------------------------------------------- shader warm-up */
  // three.js builds one program per material for each set of lamps (and shadow-casting lamps) it is
  // drawn under, and every stretch of the fall has its own set: the hero's spot, the sink's lamps and
  // shadow, the basin's. Left alone, the first frame of each stretch stalls on those compiles. So find
  // every set the timeline passes through and compile it ahead of time: the one on screen before the
  // first frame, the others while the page is idle, nearest first. The floor's reflection pass draws
  // into a render target with a clip plane, which is another variant, so that is warmed as well.
  interface LightSet {
    hero: boolean;
    stack: boolean;
    basin: boolean;
    sink: boolean;
    basinCast: boolean;
    sinkCast: boolean;
    fx: boolean;
    floor: boolean;
    p: number;
  }
  const lightSet = (T: Float64Array, p: number): LightSet => {
    const basinOn = T[C.basin] > 0.01;
    const sinkOn = T[C.sinkOn] > 0.01;
    return {
      hero: T[C.head] > 0.5,
      stack: T[C.stack] > 0.5,
      basin: basinOn,
      sink: sinkOn,
      // The same rules basin.ts and sink.ts use to switch their shadow lamps.
      basinCast: basinOn && smooth(0.02, 0.6, T[C.basin]) > 0.05 && T[C.sink] < 0.9,
      sinkCast: sinkOn && T[C.sinkOn] > 0.5 && T[C.basin] < 0.05,
      fx: T[C.fx] > 0.01 && !reduced,
      floor: T[C.floor] > 0.01,
      p,
    };
  };
  const setKey = (l: LightSet) =>
    [l.hero, l.stack, l.basin, l.sink, l.basinCast, l.sinkCast, l.fx, l.floor].map(Number).join("");
  const warmRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const warmClip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];
  /** Compile one set. Stages outside it are detached for the call so their materials are skipped. */
  const warm = (l: LightSet, sync: boolean): Promise<unknown> => {
    const on = [true, l.stack, l.hero, l.basin, l.sink, true, l.fx];
    const vis = stages.map((st) => st.group.visible);
    stages.forEach((st, i) => {
      st.group.visible = on[i];
      if (!on[i]) scene.remove(st.group);
    });
    basin.prewarm(l.basinCast);
    sink.prewarm(l.sinkCast);
    const jobs: Promise<unknown>[] = [];
    const run = () => {
      if (sync) renderer.compile(scene, cam);
      else jobs.push(renderer.compileAsync(scene, cam));
    };
    try {
      run();
      if (l.floor) {
        renderer.setRenderTarget(warmRT);
        renderer.clippingPlanes = warmClip;
        try {
          run();
        } finally {
          renderer.clippingPlanes = [];
          renderer.setRenderTarget(null);
        }
      }
    } finally {
      // Back exactly as it was, in the original order; the next update() puts the shadow lamps back.
      stages.forEach((st) => scene.remove(st.group));
      stages.forEach((st, i) => {
        scene.add(st.group);
        st.group.visible = vis[i];
      });
    }
    return Promise.all(jobs);
  };
  let warmDead = false;
  // Safari has no requestIdleCallback.
  const whenIdle = (f: () => void) =>
    typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 120);
  const warmAll = () => {
    const T = new Float64Array(N_CH);
    const p0 = Math.min(1, Math.max(0, window.scrollY / geom.maxScroll));
    sampleTimeline(tl, p0, T);
    const now = lightSet(T, p0);
    const seen = new Set([setKey(now)]);
    const rest: LightSet[] = [];
    for (let i = 0; i <= 800; i++) {
      sampleTimeline(tl, i / 800, T);
      const l = lightSet(T, i / 800);
      const k = setKey(l);
      if (!seen.has(k)) {
        seen.add(k);
        rest.push(l);
      }
    }
    rest.sort((a, b) => Math.abs(a.p - p0) - Math.abs(b.p - p0));
    warm(now, true);
    const next = () => {
      const l = rest.shift();
      if (warmDead || !l) {
        if (!warmDead) warmRT.dispose();
        return;
      }
      whenIdle(() => {
        if (warmDead) return;
        warm(l, false).then(next, (e) => console.error(e));
      });
    };
    next();
  };

  /* ------------------------------------------------------------------- start */
  measure();
  try {
    warmAll();
  } catch (e) {
    console.error(e);
  }
  lastT = performance.now();
  raf = requestAnimationFrame(loop);

  function fail() {
    root().dataset.world = "off";
    worldStatus.set("failed");
  }

  return {
    dispose() {
      cancelAnimationFrame(raf);
      warmDead = true;
      warmRT.dispose();
      ro.disconnect();
      unpin();
      window.removeEventListener("load", markDirty);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      stages.forEach((st) => st.dispose());
      envHero.dispose();
      envBasin.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      if (root().dataset.world === "on") root().dataset.world = "pending";
      worldStatus.set("idle");
    },
  };
}
