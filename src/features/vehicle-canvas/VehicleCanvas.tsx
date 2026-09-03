import {
  Aperture,
  Armchair,
  CircleDot,
  Crosshair,
  ImageOff,
  LoaderCircle,
  Move,
  Palette,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import {
  Component,
  lazy,
  Suspense,
  type CSSProperties,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SCENE_MANIFEST, type NormalizedAnchor } from "../../scene/scene-manifest";
import { detectWebGLSupport, type WebGLSupport } from "../../scene/webgl-support";
import "./vehicle-canvas.css";

const LiveVehicleViewport = lazy(() => import("../../scene/LiveVehicleViewport"));

export type VehicleCanvasMode = "showroom" | "blueprint";
export type VehicleViewPreset = "angle" | "profile" | "wheel" | "interior";
export type VehicleVisualAccuracy = "exact" | "representative";
export type VehicleAssetStatus = "loading" | "ready" | "fallback";
export type VehicleHotspotId = "paint" | "charge-port" | "wheels" | "utility";

export type VehiclePaintSelection = Readonly<{
  id: string;
  label: string;
  color: string;
  accuracy?: VehicleVisualAccuracy;
}>;

export type VehicleWheelSelection = Readonly<{
  id: string;
  label: string;
  diameterInches: number;
  style?: "aero" | "terrain" | "sport";
  accuracy?: VehicleVisualAccuracy;
}>;

export type VehicleInteriorSelection = Readonly<{
  id: string;
  label: string;
  color: string;
  accentColor?: string;
  material?: "textile" | "vegan-leather" | "leather";
  tone?: "light" | "dark";
  accuracy?: VehicleVisualAccuracy;
}>;

export type VehicleAccessorySelection = Readonly<{
  towHitch: boolean;
}>;

export type VehicleHotspot = Readonly<{
  id: VehicleHotspotId;
  label: string;
  detail: string;
  anchor: NormalizedAnchor;
  accuracy?: VehicleVisualAccuracy;
}>;

export type VehicleViewportState = Readonly<{
  panX: number;
  panY: number;
  viewPreset: VehicleViewPreset;
  mode: VehicleCanvasMode;
}>;

export type VehicleCanvasProps = Readonly<{
  paint?: VehiclePaintSelection;
  wheel?: VehicleWheelSelection;
  interior?: VehicleInteriorSelection;
  accessories?: VehicleAccessorySelection;
  mode?: VehicleCanvasMode;
  defaultMode?: VehicleCanvasMode;
  viewPreset?: VehicleViewPreset;
  defaultViewPreset?: VehicleViewPreset;
  activeHotspotId?: VehicleHotspotId | null;
  hotspots?: readonly VehicleHotspot[];
  className?: string;
  onModeChange?: (mode: VehicleCanvasMode) => void;
  onViewPresetChange?: (preset: VehicleViewPreset) => void;
  onHotspotChange?: (hotspotId: VehicleHotspotId | null) => void;
  onAssetStatusChange?: (status: VehicleAssetStatus) => void;
  onViewportChange?: (state: VehicleViewportState) => void;
}>;

type LiveRendererStatus = "loading" | "ready" | "failed";

class LiveSceneBoundary extends Component<
  Readonly<{ children: ReactNode; onFailure: (reason: string) => void }>,
  Readonly<{ failed: boolean }>
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onFailure(error instanceof Error ? error.message : "3D renderer failed");
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const DEFAULT_PAINT: VehiclePaintSelection = {
  id: "forest",
  label: "Forest",
  color: "#1d4b3c",
  accuracy: "representative",
};

const DEFAULT_WHEEL: VehicleWheelSelection = {
  id: "range-21",
  label: "21-inch range wheel",
  diameterInches: 21,
  style: "aero",
  accuracy: "representative",
};

const DEFAULT_INTERIOR: VehicleInteriorSelection = {
  id: "black-crater",
  label: "Black Crater",
  color: "#292b28",
  accentColor: "#a59c87",
  material: "textile",
  tone: "dark",
  accuracy: "representative",
};

const DEFAULT_ACCESSORIES: VehicleAccessorySelection = {
  towHitch: false,
};

const PRESETS: readonly Readonly<{
  id: VehicleViewPreset;
  label: string;
  image?: string;
}>[] = [
  { id: "angle", label: "Angle", image: SCENE_MANIFEST.fallback.showroomSrc },
  { id: "profile", label: "Profile", image: SCENE_MANIFEST.fallback.sideSrc },
  { id: "wheel", label: "Wheel", image: SCENE_MANIFEST.fallback.wheelInsetSrc },
  { id: "interior", label: "Interior" },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const assetUrl = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const accuracyLabel = (accuracy: VehicleVisualAccuracy | undefined) =>
  accuracy === "exact" ? "Exact selection" : "Representative visualization";

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reducedMotion;
}

function WheelFace({
  wheel,
  position,
}: Readonly<{
  wheel: VehicleWheelSelection;
  position: "front" | "rear";
}>) {
  return (
    <span
      className={`vc-wheel vc-wheel--${position}`}
      data-wheel-style={wheel.style ?? "aero"}
      aria-hidden="true"
      style={{ "--wheel-scale": clamp(wheel.diameterInches / 21, 0.9, 1.12) } as CSSProperties}
    >
      <span className="vc-wheel__tire">
        <span className="vc-wheel__face">
          <img src={assetUrl(SCENE_MANIFEST.fallback.wheelInsetSrc)} alt="" />
          <span className="vc-wheel__aero" />
        </span>
      </span>
    </span>
  );
}

function InteriorView({ interior }: Readonly<{ interior: VehicleInteriorSelection }>) {
  return (
    <div
      className="vc-interior-view"
      data-interior-material={interior.material ?? "textile"}
      data-interior-tone={interior.tone ?? "dark"}
      aria-label={`${interior.label} representative interior material preview`}
    >
      <img
        className="vc-interior-view__fallback-vehicle"
        src={assetUrl(SCENE_MANIFEST.fallback.showroomSrc)}
        alt=""
        aria-hidden="true"
      />

      <div className="vc-material-sample" aria-hidden="true">
        <span className="vc-material-sample__surface" />
        <span className="vc-material-sample__stitch" />
      </div>
      <div className="vc-interior-view__caption">
        <span><Armchair aria-hidden="true" /> Interior palette</span>
        <strong>{interior.label}</strong>
        <small>Representative cabin · not a manufacturer interior</small>
      </div>
    </div>
  );
}

function AssetFallback() {
  return (
    <div className="vc-asset-fallback" role="status">
      <div className="vc-asset-fallback__outline" aria-hidden="true">
        <span />
        <span />
      </div>
      <ImageOff aria-hidden="true" />
      <strong>Vehicle view unavailable</strong>
      <span>Configuration controls remain active.</span>
    </div>
  );
}

export function VehicleCanvas({
  paint = DEFAULT_PAINT,
  wheel = DEFAULT_WHEEL,
  interior = DEFAULT_INTERIOR,
  accessories = DEFAULT_ACCESSORIES,
  mode,
  defaultMode = "showroom",
  viewPreset,
  defaultViewPreset = "angle",
  activeHotspotId,
  hotspots,
  className = "",
  onModeChange,
  onViewPresetChange,
  onHotspotChange,
  onAssetStatusChange,
  onViewportChange,
}: VehicleCanvasProps) {
  const [internalMode, setInternalMode] = useState(defaultMode);
  const [internalPreset, setInternalPreset] = useState(defaultViewPreset);
  const [internalHotspot, setInternalHotspot] = useState<VehicleHotspotId | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [liveCameraResetRevision, setLiveCameraResetRevision] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [webglSupport] = useState<WebGLSupport>(() => detectWebGLSupport());
  const [liveStatus, setLiveStatus] = useState<LiveRendererStatus>(
    webglSupport === "supported" ? "loading" : "failed",
  );
  const [assetStates, setAssetStates] = useState({
    angle: "loading" as const as VehicleAssetStatus,
    profile: "loading" as const as VehicleAssetStatus,
    blueprint: "loading" as const as VehicleAssetStatus,
  });
  const pointer = useRef({ id: -1, clientX: 0, clientY: 0, panX: 0, panY: 0 });
  const reducedMotion = usePrefersReducedMotion();

  const currentMode = mode ?? internalMode;
  const currentPreset = viewPreset ?? internalPreset;
  const currentHotspot = activeHotspotId === undefined ? internalHotspot : activeHotspotId;
  const authoredAsset = currentMode === "blueprint"
    ? assetStates.blueprint
    : currentPreset === "interior"
      ? "ready"
      : currentPreset === "angle"
        ? assetStates.angle
        : assetStates.profile;
  const liveViewRequested = true;
  const liveRendererPending = liveViewRequested
    && webglSupport === "supported"
    && liveStatus === "loading";
  const liveRendererActive = liveViewRequested
    && webglSupport === "supported"
    && liveStatus === "ready";
  const activeAsset = liveRendererActive ? "ready" : authoredAsset;

  const resolvedHotspots = useMemo<readonly VehicleHotspot[]>(() => hotspots ?? [
    {
      id: "paint",
      label: "Exterior finish",
      detail: paint.label,
      anchor: SCENE_MANIFEST.anchors.bodyPaint,
      accuracy: paint.accuracy ?? "representative",
    },
    {
      id: "charge-port",
      label: "Charge port",
      detail: "Representative feature location on the licensed reference vehicle",
      anchor: SCENE_MANIFEST.anchors.chargePort,
      accuracy: "representative",
    },
    {
      id: "wheels",
      label: "Wheel package",
      detail: `${wheel.label} · ${wheel.diameterInches} in`,
      anchor: SCENE_MANIFEST.anchors.frontWheel,
      accuracy: wheel.accuracy ?? "representative",
    },
    {
      id: "utility",
      label: "Rear utility",
      detail: "Context hotspot · capability not asserted",
      anchor: SCENE_MANIFEST.anchors.rearHitch,
      accuracy: "representative",
    },
  ], [hotspots, paint.accuracy, paint.label, wheel.accuracy, wheel.diameterInches, wheel.label]);

  const activeHotspot = resolvedHotspots.find(({ id }) => id === currentHotspot) ?? null;
  const canvasStyle = {
    "--paint-color": paint.color,
    "--interior-color": interior.color,
    "--interior-accent": interior.accentColor ?? "#a59c87",
    "--pan-x": `${pan.x}%`,
    "--pan-y": `${pan.y}%`,
    "--parallax-x": `${parallax.x}px`,
    "--parallax-y": `${parallax.y}px`,
  } as CSSProperties;

  useEffect(() => {
    onAssetStatusChange?.(activeAsset);
  }, [activeAsset, onAssetStatusChange]);

  useEffect(() => {
    onViewportChange?.({
      panX: pan.x,
      panY: pan.y,
      viewPreset: currentPreset,
      mode: currentMode,
    });
  }, [currentMode, currentPreset, onViewportChange, pan.x, pan.y]);

  const haptic = useCallback(() => {
    if (typeof navigator.vibrate === "function") navigator.vibrate(7);
  }, []);

  const handleLiveReady = useCallback(() => {
    setLiveStatus("ready");
  }, []);

  const handleLiveFailure = useCallback(() => {
    setLiveStatus("failed");
  }, []);

  const handleLiveInteraction = useCallback(() => {
    haptic();
  }, [haptic]);

  const selectPreset = useCallback((nextPreset: VehicleViewPreset) => {
    if (viewPreset === undefined) setInternalPreset(nextPreset);
    if ((nextPreset === "angle" || nextPreset === "interior") && currentMode === "blueprint") {
      if (mode === undefined) setInternalMode("showroom");
      onModeChange?.("showroom");
    }
    setPan({ x: 0, y: 0 });
    onViewPresetChange?.(nextPreset);
    haptic();
  }, [currentMode, haptic, mode, onModeChange, onViewPresetChange, viewPreset]);

  const selectMode = useCallback((nextMode: VehicleCanvasMode) => {
    if (mode === undefined) setInternalMode(nextMode);
    if (nextMode === "blueprint" && (currentPreset === "angle" || currentPreset === "interior")) {
      if (viewPreset === undefined) setInternalPreset("profile");
      onViewPresetChange?.("profile");
    }
    onModeChange?.(nextMode);
    haptic();
  }, [currentPreset, haptic, mode, onModeChange, onViewPresetChange, viewPreset]);

  const selectHotspot = useCallback((hotspotId: VehicleHotspotId) => {
    const next = currentHotspot === hotspotId ? null : hotspotId;
    if (activeHotspotId === undefined) setInternalHotspot(next);
    onHotspotChange?.(next);
    haptic();
  }, [activeHotspotId, currentHotspot, haptic, onHotspotChange]);

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setParallax({ x: 0, y: 0 });
    setLiveCameraResetRevision((revision) => revision + 1);
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (liveRendererActive) return;
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointer.current = {
      id: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setDragging(true);
  }, [liveRendererActive, pan.x, pan.y]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (liveRendererActive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!dragging || pointer.current.id !== event.pointerId) {
      if (event.pointerType === "mouse" && !reducedMotion) {
        const normalizedX = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1;
        const normalizedY = ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 - 1;
        setParallax({ x: normalizedX * 7, y: normalizedY * 4 });
      }
      return;
    }

    const nextX = pointer.current.panX
      + ((event.clientX - pointer.current.clientX) / Math.max(bounds.width, 1)) * 18;
    const nextY = pointer.current.panY
      + ((event.clientY - pointer.current.clientY) / Math.max(bounds.height, 1)) * 12;
    setPan({ x: clamp(nextX, -8, 8), y: clamp(nextY, -5, 5) });
  }, [dragging, liveRendererActive, reducedMotion]);

  const finishPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (liveRendererActive) return;
    if (pointer.current.id !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    pointer.current.id = -1;
    setDragging(false);
    haptic();
  }, [haptic, liveRendererActive]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const increments: Partial<Record<string, { x: number; y: number }>> = {
      ArrowLeft: { x: -1.5, y: 0 },
      ArrowRight: { x: 1.5, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const increment = increments[event.key];
    if (increment) {
      event.preventDefault();
      setPan((current) => ({
        x: clamp(current.x + increment.x, -8, 8),
        y: clamp(current.y + increment.y, -5, 5),
      }));
      return;
    }
    if (event.key === "Home" || event.key === "0") {
      event.preventDefault();
      resetView();
    }
    if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      selectMode(currentMode === "blueprint" ? "showroom" : "blueprint");
    }
  }, [currentMode, resetView, selectMode]);

  const setAssetState = useCallback((
    key: "angle" | "profile" | "blueprint",
    state: VehicleAssetStatus,
  ) => {
    setAssetStates((current) => current[key] === state ? current : { ...current, [key]: state });
  }, []);

  const accuracy = currentPreset === "wheel"
    ? wheel.accuracy ?? "representative"
    : currentPreset === "interior"
      ? interior.accuracy ?? "representative"
      : paint.accuracy ?? "representative";

  return (
    <section
      className={`vehicle-canvas ${className}`.trim()}
      data-mode={currentMode}
      data-preset={currentPreset}
      data-paint={paint.id}
      data-wheel={wheel.id}
      data-interior={interior.id}
      data-tow-hitch={accessories.towHitch || undefined}
      data-asset-status={activeAsset}
      data-renderer={liveRendererActive ? "live_3d" : "authored_2_5d"}
      data-live-status={liveStatus}
      data-reduced-motion={reducedMotion || undefined}
      style={canvasStyle}
      aria-label="Interactive vehicle configurator"
    >
      <div
        className="vc-stage"
        role="application"
        aria-roledescription="interactive vehicle viewport"
        aria-label={`${SCENE_MANIFEST.displayName}. ${paint.label}. ${wheel.label}. ${interior.label}.`}
        aria-describedby="vehicle-canvas-instructions"
        tabIndex={0}
        data-dragging={dragging || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onPointerLeave={() => !dragging && setParallax({ x: 0, y: 0 })}
        onDoubleClick={resetView}
        onKeyDown={onKeyDown}
      >
        <p id="vehicle-canvas-instructions" className="vc-sr-only">
          Drag to orbit the vehicle in live views. Use arrow keys to adjust the view, B to toggle blueprint,
          and Home or zero to reset the view.
        </p>

        <div className="vc-environment" aria-hidden="true">
          <span className="vc-environment__light" />
          <span className="vc-environment__grid" />
          <span className="vc-environment__orbit vc-environment__orbit--one" />
          <span className="vc-environment__orbit vc-environment__orbit--two" />
          <span className="vc-environment__ground" />
        </div>

        {webglSupport === "supported" && liveStatus !== "failed" && (
          <div className="vc-live-layer" aria-hidden="true">
            <LiveSceneBoundary onFailure={handleLiveFailure}>
              <Suspense fallback={null}>
                <LiveVehicleViewport
                  paint={{ color: paint.color }}
                  wheel={{
                    diameterInches: wheel.diameterInches,
                    style: wheel.style ?? "aero",
                  }}
                  accessories={accessories}
                  interior={{
                    color: interior.color,
                    accentColor: interior.accentColor,
                    material: interior.material,
                    tone: interior.tone,
                  }}
                  mode={currentMode}
                  viewPreset={currentPreset}
                  focus={currentHotspot}
                  keyboardOrbit={{ yaw: pan.x * 0.035, pitch: pan.y * 0.025 }}
                  resetRevision={liveCameraResetRevision}
                  reducedMotion={reducedMotion}
                  onReady={handleLiveReady}
                  onFailure={handleLiveFailure}
                  onInteraction={handleLiveInteraction}
                />
              </Suspense>
            </LiveSceneBoundary>
          </div>
        )}

        <header className="vc-hud">
          <div className="vc-hud__identity">
            <span className="vc-hud__index">UVC / 01</span>
            <strong>Licensed compact-SUV reference</strong>
            <span>{SCENE_MANIFEST.labels.affiliation}</span>
          </div>
          <div className="vc-mode-switch" aria-label="Vehicle rendering mode">
            <button
              type="button"
              aria-pressed={currentMode === "showroom"}
              onClick={() => selectMode("showroom")}
            >
              <Aperture aria-hidden="true" /> Showroom
            </button>
            <button
              type="button"
              aria-pressed={currentMode === "blueprint"}
              onClick={() => selectMode("blueprint")}
            >
              <ScanLine aria-hidden="true" /> Blueprint
            </button>
          </div>
        </header>

        <div className="vc-status" aria-live="polite">
          <span className="vc-status__dot" aria-hidden="true" />
          {liveViewRequested && webglSupport !== "unsupported" && liveStatus !== "ready" && liveStatus !== "failed" && (
            <><LoaderCircle aria-hidden="true" /> Preparing real-time vehicle</>
          )}
          {liveRendererActive && <>Live 3D · representative vehicle</>}
          {liveViewRequested && (webglSupport === "unsupported" || liveStatus === "failed") && (
            <>Same-model fallback · controls still active</>
          )}
          {!liveViewRequested && activeAsset === "loading" && <><LoaderCircle aria-hidden="true" /> Loading authored view</>}
          {!liveViewRequested && activeAsset === "ready" && <>{accuracyLabel(accuracy)}</>}
          {!liveViewRequested && activeAsset === "fallback" && <>Fallback view · controls still active</>}
        </div>

        {liveRendererActive && (
          <a
            className="vc-model-attribution"
            href={SCENE_MANIFEST.model.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Model: Mehdi Lagzouli / LagzDesign + OpenX · CC BY 4.0
          </a>
        )}

        <div className="vc-object" aria-live="polite">
          <div
            className="vc-angle-view"
            aria-hidden={liveRendererPending || liveRendererActive || currentPreset !== "angle" || currentMode === "blueprint"}
          >
            <img
              className="vc-angle-view__image"
              src={assetUrl(SCENE_MANIFEST.fallback.showroomSrc)}
              alt="Licensed compact electric SUV reference from a front three-quarter angle"
              onLoad={() => setAssetState("angle", "ready")}
              onError={() => setAssetState("angle", "fallback")}
            />
          </div>

          <div
            className="vc-profile-view"
            aria-hidden={liveRendererPending || liveRendererActive || (currentPreset === "angle" && currentMode !== "blueprint")}
          >
            <img
              className="vc-profile-view__base"
              src={assetUrl(SCENE_MANIFEST.fallback.sideSrc)}
              alt="Licensed compact electric SUV reference in side profile"
              onLoad={() => setAssetState("profile", "ready")}
              onError={() => setAssetState("profile", "fallback")}
            />
            <img
              className="vc-profile-view__blueprint"
              src={assetUrl(SCENE_MANIFEST.fallback.blueprintSrc)}
              alt=""
              aria-hidden="true"
              onLoad={() => setAssetState("blueprint", "ready")}
              onError={() => setAssetState("blueprint", "fallback")}
            />
            <WheelFace wheel={wheel} position="front" />
            <WheelFace wheel={wheel} position="rear" />
          </div>

          {currentPreset === "interior" && <InteriorView interior={interior} />}

          {authoredAsset === "fallback" && !liveRendererActive && <AssetFallback />}

          <div className="vc-hotspots" aria-label="Vehicle focus points">
            {resolvedHotspots.map((hotspot) => (
              <button
                key={hotspot.id}
                type="button"
                className="vc-hotspot"
                style={{
                  "--anchor-x": `${hotspot.anchor.x * 100}%`,
                  "--anchor-y": `${hotspot.anchor.y * 100}%`,
                } as CSSProperties}
                data-hotspot={hotspot.id}
                data-active={currentHotspot === hotspot.id || undefined}
                aria-label={`Focus ${hotspot.label}`}
                aria-pressed={currentHotspot === hotspot.id}
                onClick={() => selectHotspot(hotspot.id)}
              >
                <span aria-hidden="true"><Crosshair /></span>
              </button>
            ))}
          </div>
        </div>

        {activeHotspot && currentPreset !== "interior" && (
          <aside className="vc-focus-card" data-hotspot={activeHotspot.id} aria-live="polite">
            <div className="vc-focus-card__kind">
              {activeHotspot.id === "paint" && <Palette aria-hidden="true" />}
              {activeHotspot.id === "wheels" && <CircleDot aria-hidden="true" />}
              {!(["paint", "wheels"] as string[]).includes(activeHotspot.id) && <Crosshair aria-hidden="true" />}
              {accuracyLabel(activeHotspot.accuracy)}
            </div>
            <strong>{activeHotspot.label}</strong>
            <p>{activeHotspot.detail}</p>
            <button type="button" onClick={() => selectHotspot(activeHotspot.id)}>Close</button>
          </aside>
        )}

        <div className="vc-view-picker" aria-label="Vehicle view presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={currentPreset === preset.id}
              onClick={() => selectPreset(preset.id)}
            >
              <span className="vc-view-picker__thumbnail">
                {preset.image
                  ? <img src={assetUrl(preset.image)} alt="" />
                  : <span className="vc-view-picker__cabin" aria-hidden="true"><i /><i /><i /></span>}
              </span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>

        <footer className="vc-footer">
          <span className="vc-drag-hint"><Move aria-hidden="true" /> {liveRendererActive ? "Drag to orbit" : "Drag to explore"}</span>
          <span className="vc-selection-readout">
            <span
              style={{ backgroundColor: currentPreset === "interior" ? interior.color : paint.color }}
              aria-hidden="true"
            />
            {currentPreset === "interior"
              ? `${interior.label} · ${interior.material ?? "textile"}`
              : `${paint.label} · ${wheel.diameterInches} in`}
          </span>
          <button type="button" className="vc-reset" onClick={resetView}>
            <RotateCcw aria-hidden="true" /> Reset view
          </button>
        </footer>
      </div>
    </section>
  );
}
