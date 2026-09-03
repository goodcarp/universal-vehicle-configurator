export type LiveVehicleViewPreset = "angle" | "profile" | "wheel" | "interior";
export type LiveVehicleFocus = "paint" | "charge-port" | "wheels" | "utility" | null;
export type LiveVehicleRenderMode = "showroom" | "blueprint";

export type LiveVehiclePaint = Readonly<{
  color: string;
}>;

export type LiveVehicleWheel = Readonly<{
  diameterInches: number;
  style: "aero" | "terrain" | "sport";
}>;

export type LiveVehicleAccessories = Readonly<{
  towHitch: boolean;
}>;

export type LiveVehicleInterior = Readonly<{
  color: string;
  accentColor?: string;
  material?: "textile" | "vegan-leather" | "leather";
  tone?: "light" | "dark";
}>;

export type LiveVehicleViewportProps = Readonly<{
  paint: LiveVehiclePaint;
  wheel: LiveVehicleWheel;
  accessories: LiveVehicleAccessories;
  interior: LiveVehicleInterior;
  mode: LiveVehicleRenderMode;
  viewPreset: LiveVehicleViewPreset;
  focus: LiveVehicleFocus;
  keyboardOrbit: Readonly<{ yaw: number; pitch: number }>;
  resetRevision: number;
  reducedMotion: boolean;
  onReady: () => void;
  onFailure: (reason: string) => void;
  onInteraction: () => void;
}>;
