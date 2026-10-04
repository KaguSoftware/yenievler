import { useSyncExternalStore } from "react";
import { worldStatus } from "./three/state";

export function useWorldStatus() {
  return useSyncExternalStore(worldStatus.subscribe, worldStatus.get, () => "idle" as const);
}
