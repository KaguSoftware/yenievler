export type FlowId =
  | "mist"
  | "rain"
  | "halo"
  | "cascade"
  | "pulse"
  | "torrent"
  | "off";

export interface Flow {
  n: number;
  s: number;
  a: number;
  rate: number;
  shape?: "ring" | "core";
  pulse?: boolean;
}

export const FLOWS: Record<FlowId, Flow> = {
  mist: { n: 600, s: 0.72, a: -0.18, rate: 4.2 },
  rain: { n: 1200, s: 1, a: -0.26, rate: 7.6 },
  halo: { n: 1000, s: 1.05, a: -0.26, shape: "ring", rate: 6.8 },
  cascade: { n: 900, s: 1.25, a: -0.3, shape: "core", rate: 9.4 },
  pulse: { n: 1300, s: 1.15, a: -0.3, pulse: true, rate: 7.2 },
  torrent: { n: 1900, s: 1.3, a: -0.31, rate: 12.0 },
  off: { n: 0, s: 1, a: 0, rate: 0 },
};

export interface KeyDef {
  id: FlowId;
  short: string;
  label: string;
  /** glyph bars drawn above the key */
  icon: { w: number; h: number; r: string }[];
}

export const KEYS: KeyDef[] = [
  { id: "mist", short: "Mist", label: "Mist", icon: [0, 1, 2].map(() => ({ w: 3, h: 3, r: "50%" })) },
  { id: "rain", short: "Rain", label: "Rain", icon: [0, 1, 2].map(() => ({ w: 2, h: 10, r: "1px" })) },
  { id: "halo", short: "Halo", label: "Halo", icon: [{ w: 9, h: 9, r: "50%" }] },
  { id: "cascade", short: "Fall", label: "Cascade", icon: [{ w: 6, h: 12, r: "2px" }] },
  { id: "pulse", short: "Pulse", label: "Pulse", icon: [6, 11, 6].map((h) => ({ w: 2, h, r: "1px" })) },
  { id: "torrent", short: "Flood", label: "Torrent", icon: [0, 1, 2, 3, 4].map(() => ({ w: 2, h: 12, r: "1px" })) },
  { id: "off", short: "Stop", label: "Stop", icon: [{ w: 9, h: 9, r: "2px" }] },
];

export const FLOW_NAME: Record<FlowId, string> = {
  mist: "Mist",
  rain: "Rain",
  halo: "Halo",
  cascade: "Cascade",
  pulse: "Pulse",
  torrent: "Flood",
  off: "Paused",
};
