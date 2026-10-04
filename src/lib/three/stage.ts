import type * as THREE from "three";
import type { FlowId } from "./flows";

/** Everything a stage needs to know about this frame. One object, reused, never reallocated. */
export interface Frame {
  /** Timeline sample (index with `C`). */
  s: Float64Array;
  dt: number;
  time: number;
  cam: THREE.PerspectiveCamera;
  /** Where the camera looks this frame (stages may orbit the camera around it). */
  look: THREE.Vector3;
  vw: number;
  vh: number;
  mobile: boolean;
  reduced: boolean;
  /** Pointer in viewport space. */
  ptr: { x: number; y: number; ndcX: number; ndcY: number; inside: boolean; moved: boolean };
  /** Effective mixer flow (the Stop key only holds while the hero is on screen). */
  flow: FlowId;
  /** Camera speed in world units per second, smoothed. */
  speed: number;
  /** Current background in linear and sRGB-encoded floats. */
  bg: { lin: Float64Array; srgb: Float64Array };
}

export interface BuildCtx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  canvas: HTMLCanvasElement;
  /** Warm studio for the head (reflections of the vermilion room). */
  envHero: THREE.Texture;
  /** Cool studio for the basin. */
  envBasin: THREE.Texture;
  mobile: () => boolean;
  reduced: boolean;
}

/** A stage adds one group to the shared scene. The world only calls update while it is visible. */
export interface Stage {
  group: THREE.Group;
  update(f: Frame): void;
  /** Cheap DOM sync that must run even while the stage is out of range (e.g. hiding its captions). */
  always?(f: Frame): void;
  /** Viewport size changed (CSS px). */
  resize?(w: number, h: number, pr: number): void;
  dispose(): void;
}
