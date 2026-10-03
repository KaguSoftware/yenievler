import * as THREE from "three";

export interface StoneDef {
  name: string;
  swatch: string;
  base: string;
  vein: string;
  kind: "vein" | "band";
  price: number;
  rough: number;
  pore?: string;
}

export const STONES: StoneDef[] = [
  { name: "Carrara", swatch: "linear-gradient(135deg,#ece9e4,#c9c8c6)", base: "#e6e3de", vein: "#8d8f96", kind: "vein", price: 2400, rough: 0.28 },
  { name: "Nero Marquina", swatch: "linear-gradient(135deg,#222,#0c0c0c)", base: "#141414", vein: "#d6d1c7", kind: "vein", price: 2850, rough: 0.22 },
  { name: "Travertine", swatch: "linear-gradient(135deg,#d7c3a4,#b59d7b)", base: "#cbb594", vein: "#a48a66", kind: "band", price: 2100, rough: 0.55 },
  { name: "Verde Alpi", swatch: "linear-gradient(135deg,#2c4a40,#14271f)", base: "#1d362d", vein: "#9cc0ad", kind: "vein", price: 3200, rough: 0.2 },
];

export interface FinishDef {
  name: string;
  swatch: string;
  color: number;
  metal: number;
  rough: number;
  price: number;
}

export const FINISHES: FinishDef[] = [
  { name: "Gunmetal", swatch: "linear-gradient(135deg,#8b8f93,#3f4245)", color: 0x6a6d72, metal: 1, rough: 0.2, price: 820 },
  { name: "Polished chrome", swatch: "linear-gradient(135deg,#f4f4f4,#8a8a8a)", color: 0xf0f0f0, metal: 1, rough: 0.05, price: 640 },
  { name: "Brushed brass", swatch: "linear-gradient(135deg,#e2c38a,#9d7a42)", color: 0xe0b572, metal: 1, rough: 0.28, price: 890 },
  { name: "Matte black", swatch: "linear-gradient(135deg,#3a3a3a,#111)", color: 0x1c1c1c, metal: 0.4, rough: 0.55, price: 760 },
];

/** Procedural stone: seeded, so a given stone always has the same veining. */
export function stoneTex(st: Pick<StoneDef, "name" | "base" | "vein" | "kind" | "pore">) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!;
  let seed = st.name.length * 9301 + 49297;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = st.base;
  g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = 0.035;
    g.fillStyle = rnd() > 0.5 ? st.vein : "#ffffff";
    g.beginPath();
    g.arc(rnd() * 1024, rnd() * 512, 20 + rnd() * 90, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = st.vein;
  g.lineCap = "round";
  if (st.kind === "vein") {
    for (let v = 0; v < 22; v++) {
      let x = rnd() * 1024;
      let y = rnd() * 512;
      let a = rnd() * Math.PI * 2;
      g.globalAlpha = 0.25 + rnd() * 0.5;
      g.lineWidth = 0.6 + rnd() * (v < 5 ? 3.5 : 1.4);
      g.filter = rnd() > 0.5 ? "blur(1px)" : "none";
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 60; s++) {
        a += (rnd() - 0.5) * 0.6;
        x += Math.cos(a) * 14;
        y += Math.sin(a) * 8;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  } else {
    for (let b = 0; b < 140; b++) {
      const y = rnd() * 512;
      g.globalAlpha = 0.08 + rnd() * 0.25;
      g.lineWidth = 0.5 + rnd() * 3;
      g.filter = "blur(0.6px)";
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + b) * 3);
      g.stroke();
    }
    g.filter = "none";
    g.fillStyle = st.pore || "#6e5a40";
    for (let p = 0; p < 500; p++) {
      g.globalAlpha = 0.2 + rnd() * 0.3;
      g.beginPath();
      g.ellipse(rnd() * 1024, rnd() * 512, 1 + rnd() * 4, 0.5 + rnd(), 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  g.filter = "none";
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
