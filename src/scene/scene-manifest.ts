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
 * Asset-specific rendering facts for the R2-first concept experience.
 *
 * Item 3 did not bundle a live model: the best timeboxed CC BY candidate
 * required an authenticated official download before topology could be
 * inspected. The authored 2.5D pack is therefore the only approved runtime
 * source until a licensed GLB clears the same gate.
 */
export const SCENE_MANIFEST = {
  id: "uvc-original-compact-suv-v1",
  displayName: "Original compact electric SUV concept",
  unofficialConcept: true,
  mode: "authored_2_5d" as SceneAssetMode,
  aspectRatio: 16 / 9,
  model: {
    src: null,
    status: "blocked_pending_authorized_download_and_topology_audit",
    candidateUrl:
      "https://sketchfab.com/3d-models/lowpoly-generic-suv-edc994ad28ed438cb365c0e0389ac177",
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
    presentation: "masked_2d",
    sourceColor: "#143d2f",
    label: "Representative paint visualization",
  },
  wheelPresentation: "representative_inset" as WheelPresentation,
  labels: {
    visualAccuracy: "Original concept visualization",
    wheelAccuracy: "Representative wheel visualization",
    affiliation: "Unofficial concept — not affiliated with a manufacturer",
  },
} as const;

export type SceneManifest = typeof SCENE_MANIFEST;
