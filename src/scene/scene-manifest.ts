export type NormalizedAnchor = Readonly<{
  x: number;
  y: number;
}>;

export type WheelPresentation =
  | "mesh_swap"
  | "material_only"
  | "representative_inset";

export type SceneAssetMode = "live_3d" | "authored_2_5d";

/**
 * Asset-specific rendering facts for the R2-first experience. The primary live
 * geometry is a licensed Volvo EX30 reference asset and is explicitly not
 * represented as R2 geometry. Original authored views remain the safety pack.
 */
export const SCENE_MANIFEST = {
  id: "openx-volvo-ex30-2024-reference",
  displayName: "Licensed compact-SUV reference model",
  unofficialConcept: false,
  mode: "live_3d" as SceneAssetMode,
  aspectRatio: 16 / 9,
  model: {
    src: "/models/openx-volvo-ex30-2024.glb",
    status: "licensed_primary_with_procedural_fallback",
    assetName: "2024 Volvo EX30 low-poly",
    representsConfiguredVehicle: false,
    license: "MPL-2.0 AND CC-BY-4.0",
    attribution: "Mehdi Lagzouli / LagzDesign; OpenX adaptation © 2025 Dogan Ulus",
    sourceUrl:
      "https://github.com/vevalabs/openx-assets/tree/main/src/vehicles/main/m1_volvo_ex30_2024",
  },
  fallback: {
    showroomSrc: "/images/showroom-fallback.webp",
    sideSrc: "/images/vehicle-side.webp",
    blueprintSrc: "/images/vehicle-side-blueprint.webp",
    scanMaskSrc: "/images/vehicle-scan-mask.webp",
    paintMaskSrc: "/images/vehicle-paint-mask.webp",
    wheelInsetSrc: "/images/representative-wheel-inset.webp",
  },
  anchors: {
    frontWheel: { x: 0.19, y: 0.66 },
    rearWheel: { x: 0.79, y: 0.66 },
    bodyPaint: { x: 0.55, y: 0.48 },
    chargePort: { x: 0.27, y: 0.44 },
    rearHitch: { x: 0.96, y: 0.67 },
    rangeRulerOrigin: { x: 0.19, y: 0.82 },
  } satisfies Record<string, NormalizedAnchor>,
  bodyPaint: {
    presentation: "mapped_live_material_with_masked_2d_fallback",
    sourceColor: "#143d2f",
    label: "Representative paint visualization",
  },
  wheelPresentation: "material_only" as WheelPresentation,
  labels: {
    visualAccuracy: "Licensed reference geometry — not R2 geometry",
    wheelAccuracy: "Representative wheel treatment",
    affiliation: "Licensed EX30 reference · not an R2",
  },
} as const;

export type SceneManifest = typeof SCENE_MANIFEST;
