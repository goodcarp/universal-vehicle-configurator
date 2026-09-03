import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type {
  LiveVehicleAccessories,
  LiveVehicleFocus,
  LiveVehiclePaint,
  LiveVehicleRenderMode,
  LiveVehicleWheel,
} from "./live-vehicle.types";

/**
 * The seam between the viewport and whatever is actually drawing the vehicle.
 *
 * The licensed GLB is exterior-only geometry of a different car, which caps
 * what the configurator can honestly show: no doors, no frunk, no liftgate, and
 * a shape that is not the vehicle the catalog describes. A code-native
 * procedural body removes all three limits and costs nothing to ship, so the
 * viewport takes the model as a plug rather than hard-wiring one.
 *
 * To add a source: implement a component with these props, register it below,
 * and pass its id as `modelSource`. Everything else — camera, lighting,
 * blueprint mode, focus hotspots, the cabin — is source-agnostic.
 */

export interface VehicleModelProps {
  paint: LiveVehiclePaint;
  wheel: LiveVehicleWheel;
  accessories: LiveVehicleAccessories;
  focus: LiveVehicleFocus;
  mode: LiveVehicleRenderMode;
  /** Call once the model is on screen; the viewport gates its crossfade on it. */
  onReady: () => void;
}

export type VehicleModelComponent =
  | ComponentType<VehicleModelProps>
  | LazyExoticComponent<ComponentType<VehicleModelProps>>;

export type VehicleModelSourceId = "licensed-glb" | "procedural";

export interface VehicleModelSource {
  id: VehicleModelSourceId;
  label: string;
  /** Shown in the canvas HUD, so it must stay truthful about what is drawn. */
  attribution: string;
  /** Whether this source can open doors, frunk and liftgate. */
  hasOpenableBody: boolean;
  Component: VehicleModelComponent;
}

/**
 * Both are lazy so neither ships in the entry chunk; the viewport is already
 * behind its own dynamic import.
 */
export const VEHICLE_MODEL_SOURCES: Record<VehicleModelSourceId, VehicleModelSource> = {
  "licensed-glb": {
    id: "licensed-glb",
    label: "Licensed EX30 reference",
    attribution: "Licensed EX30 reference · not an R2",
    hasOpenableBody: false,
    Component: lazy(async () => ({
      default: (await import("./LicensedVehicleModel")).LicensedVehicleModel,
    })),
  },
  procedural: {
    id: "procedural",
    label: "Code-native body",
    attribution: "Code-native procedural body",
    hasOpenableBody: true,
    Component: lazy(async () => ({
      default: (await import("./ProceduralVehicleModel")).ProceduralVehicleModel,
    })),
  },
};

export const DEFAULT_VEHICLE_MODEL_SOURCE: VehicleModelSourceId = "licensed-glb";

export function resolveVehicleModelSource(
  id: VehicleModelSourceId = DEFAULT_VEHICLE_MODEL_SOURCE,
): VehicleModelSource {
  return VEHICLE_MODEL_SOURCES[id] ?? VEHICLE_MODEL_SOURCES[DEFAULT_VEHICLE_MODEL_SOURCE];
}
