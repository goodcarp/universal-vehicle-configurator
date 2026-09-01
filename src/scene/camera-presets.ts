import { Vector3 } from "three";
import type { LiveVehicleFocus, LiveVehicleViewPreset } from "./live-vehicle.types";

export type CameraPose = Readonly<{
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  maxDistance: number;
  minDistance: number;
}>;

const POSES: Record<Exclude<LiveVehicleViewPreset, "interior">, CameraPose> = {
  angle: {
    position: [4.65, 1.95, 5.85],
    target: [0, 0.84, 0],
    minDistance: 4.9,
    maxDistance: 9,
  },
  profile: {
    position: [0, 1.55, 6.85],
    target: [0, 0.82, 0],
    minDistance: 5.3,
    maxDistance: 9.5,
  },
  wheel: {
    position: [2.55, 1.05, 3.7],
    target: [1.47, 0.42, 0.80],
    minDistance: 2.3,
    maxDistance: 6.5,
  },
};

const FOCUS_POSES: Partial<Record<Exclude<LiveVehicleFocus, null>, CameraPose>> = {
  wheels: POSES.wheel,
  utility: {
    position: [-5.25, 1.62, 4.35],
    target: [-2.28, 0.43, 0],
    minDistance: 3.4,
    maxDistance: 8,
  },
  "charge-port": {
    position: [3.6, 1.72, 4.4],
    target: [1.03, 1.12, 0.88],
    minDistance: 3.1,
    maxDistance: 8,
  },
  paint: {
    position: [4.45, 1.8, 5.35],
    target: [0.15, 1.05, 0],
    minDistance: 4.8,
    maxDistance: 9.5,
  },
};

export function getCameraPose(
  preset: LiveVehicleViewPreset,
  focus: LiveVehicleFocus,
  orbit: Readonly<{ yaw: number; pitch: number }> = { yaw: 0, pitch: 0 },
): CameraPose {
  const base = preset === "profile"
    ? POSES.profile
    : preset === "wheel"
      ? POSES.wheel
      : focus
        ? FOCUS_POSES[focus] ?? POSES.angle
        : POSES.angle;
  if (orbit.yaw === 0 && orbit.pitch === 0) return base;

  const target = new Vector3(...base.target);
  const offset = new Vector3(...base.position).sub(target);
  offset.applyAxisAngle(new Vector3(0, 1, 0), orbit.yaw);
  const horizontalAxis = new Vector3().crossVectors(offset, new Vector3(0, 1, 0)).normalize();
  offset.applyAxisAngle(horizontalAxis, orbit.pitch);
  const position = target.add(offset);

  return {
    ...base,
    position: [position.x, position.y, position.z],
  };
}
