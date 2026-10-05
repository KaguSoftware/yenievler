import * as THREE from "three";
import { billboards, nozzlePositions, release, sharedSoftTex } from "./common";
import { C, HEAD_R, HEAD_Y } from "./timeline";
import type { BuildCtx, Frame, Stage } from "./stage";
import type { Water } from "./water";

/**
 * Hero stage: the round chrome rain head on its arm, the hand glow that blocks the rain, and
 * steam for the Mist key. The floor and the rain themselves belong to the shared water system.
 */
export function buildHero(ctx: BuildCtx, water: Water): Stage {
  const group = new THREE.Group();
  const R = HEAD_R;

  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xdedede,
    metalness: 1,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMap: ctx.envHero,
  });
  // Head, arm and nozzles pivot about the head centre so they tilt with the stack they swap into.
  const rig = new THREE.Group();
  rig.position.y = HEAD_Y;
  group.add(rig);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.07, 160), chrome);
  rig.add(head);
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, metalness: 0.7, roughness: 0.5, envMap: ctx.envHero });
  const face = new THREE.Mesh(new THREE.CircleGeometry(R * 0.965, 160), faceMat);
  face.rotation.x = Math.PI / 2;
  face.position.y = -0.0365;
  rig.add(face);
  const nozzles = nozzlePositions(R);
  const nzMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.2, roughness: 0.4, envMap: ctx.envHero });
  const nz = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 8), nzMat, nozzles.length);
  const m4 = new THREE.Matrix4();
  nozzles.forEach(([x, z], i) => {
    m4.makeTranslation(x, -0.042, z);
    nz.setMatrixAt(i, m4);
  });
  rig.add(nz);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 5, 32), chrome);
  arm.position.y = 2.5;
  rig.add(arm);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 48), chrome);
  collar.position.y = 0.1;
  rig.add(collar);

  const spot = new THREE.SpotLight(0xffffff, 80, 14, 0.6, 1, 1.4);
  spot.position.set(0, HEAD_Y - 0.1, 0);
  spot.target.position.set(0, 0, 0);
  group.add(spot, spot.target);

  const soft = sharedSoftTex();
  const handSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: soft, transparent: true, opacity: 0, depthWrite: false, color: 0xfff6ee }),
  );
  handSprite.scale.set(1.1, 0.5, 1);
  group.add(handSprite);

  // Steam for the Mist key: one instanced draw for every puff, skipped entirely while it is clear.
  const STEAM = 26;
  const steam = billboards(STEAM, soft);
  const sA = new Float32Array(STEAM);
  const sR = new Float32Array(STEAM);
  const sY = new Float32Array(STEAM);
  const sSp = new Float32Array(STEAM);
  for (let i = 0; i < STEAM; i++) {
    const sz = 1.5 + Math.random() * 2.5;
    steam.size[i * 2] = steam.size[i * 2 + 1] = sz;
    sA[i] = Math.random() * Math.PI * 2;
    sR[i] = Math.random() * 2.2;
    sY[i] = Math.random() * 4.5;
    sSp[i] = 0.15 + Math.random() * 0.25;
  }
  // Left visible (at zero alpha) until the first update, so the start-up compile covers its shader.
  steam.commit(true);
  group.add(steam.mesh);
  let steamMax = 0;

  const ray = new THREE.Raycaster();

  return {
    group,
    update(f: Frame) {
      const s = f.s;
      const ground = s[C.ground];
      rig.rotation.x = s[C.tilt];
      const on = f.flow !== "off";
      spot.intensity += ((on ? 80 : 0) - spot.intensity) * Math.min(1, f.dt * 3);

      // The pointer is a hand in the rain, only while the hero is the shot.
      water.hand.on = false;
      if (f.ptr.inside && s[C.para] > 0.5 && !f.reduced) {
        ray.setFromCamera(ndcOf(f), f.cam);
        const o = ray.ray.origin;
        const d = ray.ray.direction;
        if (Math.abs(d.z) > 1e-4) {
          const k = -o.z / d.z;
          const hx = o.x + d.x * k;
          const hy = o.y + d.y * k;
          if (k > 0 && Math.abs(hx) < R * 0.95 && hy > ground + 0.3 && hy < HEAD_Y - 0.35) {
            water.hand.on = true;
            water.hand.x = hx;
            water.hand.y = hy;
            water.hand.z = 0;
          }
        }
        if (!water.hand.on && f.ptr.moved && d.y < 0) {
          const k = (ground - o.y) / d.y;
          water.poke(o.x + d.x * k, o.z + d.z * k, -0.45);
        }
      }
      handSprite.position.set(water.hand.x, water.hand.y, 0.05);
      const mt = handSprite.material;
      mt.opacity += ((water.hand.on && on ? 0.28 : 0) - mt.opacity) * Math.min(1, f.dt * 9);

      const steamAmt = on && f.flow === "mist" && !f.reduced ? 0.9 : 0;
      // Puffs keep drifting only while some are showing or about to.
      if (steamAmt > 0 || steamMax > 0.0005) {
        const k = Math.min(1, f.dt * 3);
        steamMax = 0;
        for (let i = 0; i < STEAM; i++) {
          sY[i] += sSp[i] * f.dt;
          sA[i] += f.dt * 0.05;
          if (sY[i] > 5) {
            sY[i] = 0;
            sR[i] = Math.random() * 2.2;
          }
          steam.pos[i * 3] = Math.cos(sA[i]) * sR[i];
          steam.pos[i * 3 + 1] = ground + sY[i];
          steam.pos[i * 3 + 2] = Math.sin(sA[i]) * sR[i];
          const a = steam.alpha[i] + (steamAmt * 0.07 * Math.sin((Math.PI * sY[i]) / 5) - steam.alpha[i]) * k;
          steam.alpha[i] = a;
          if (a > steamMax) steamMax = a;
        }
        steam.commit();
      }
      steam.mesh.visible = steamMax > 0.0005;
      handSprite.visible = mt.opacity > 0.002;
    },
    dispose() {
      chrome.dispose();
      faceMat.dispose();
      nzMat.dispose();
      head.geometry.dispose();
      face.geometry.dispose();
      nz.geometry.dispose();
      nz.dispose();
      arm.geometry.dispose();
      collar.geometry.dispose();
      handSprite.material.dispose();
      steam.dispose();
      spot.dispose();
      release("soft");
    },
  };
}

const ndc = new THREE.Vector2();
function ndcOf(f: Frame) {
  return ndc.set(f.ptr.ndcX, f.ptr.ndcY);
}
