import {
  CameraControls,
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
} from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
} from "three";
import { getCameraPose } from "./camera-presets";
import { CabinInterior } from "./CabinInterior";
import { resolveVehicleModelSource } from "./vehicle-model-source";
import type {
  LiveVehicleRenderMode,
  LiveVehicleViewportProps,
} from "./live-vehicle.types";
import "./live-vehicle.css";

class LicensedModelBoundary extends Component<
  Readonly<{
    children: ReactNode;
    fallback: ReactNode;
    onFailure: (reason: string) => void;
  }>,
  Readonly<{ failed: boolean }>
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onFailure(error instanceof Error ? error.message : "Licensed model failed to load");
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function CameraDirector({
  viewPreset,
  focus,
  keyboardOrbit,
  resetRevision,
  onInteraction,
  reducedMotion,
}: Pick<
  LiveVehicleViewportProps,
  "viewPreset" | "focus" | "keyboardOrbit" | "resetRevision" | "onInteraction"
  | "reducedMotion"
>) {
  const controls = useRef<CameraControls>(null);
  const invalidate = useThree((state) => state.invalidate);
  const pose = useMemo(
    () => getCameraPose(viewPreset, focus, keyboardOrbit),
    [focus, keyboardOrbit, viewPreset],
  );

  useEffect(() => {
    const controller = controls.current;
    if (!controller) return;
    controller.minDistance = pose.minDistance;
    controller.maxDistance = pose.maxDistance;
    void controller.setLookAt(
      ...pose.position,
      ...pose.target,
      !reducedMotion,
    );
    invalidate();
  }, [invalidate, pose, reducedMotion, resetRevision]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={0.42}
      draggingSmoothTime={0.12}
      dollySpeed={0.55}
      truckSpeed={0.7}
      minPolarAngle={Math.PI * 0.17}
      maxPolarAngle={Math.PI * 0.52}
      azimuthRotateSpeed={0.72}
      polarRotateSpeed={0.62}
      dollyToCursor
      onStart={onInteraction}
    />
  );
}

function ContextLossMonitor({
  onFailure,
}: Pick<LiveVehicleViewportProps, "onFailure">) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const contextLost = (event: Event) => {
      event.preventDefault();
      onFailure("WebGL context lost");
    };
    canvas.addEventListener("webglcontextlost", contextLost);
    return () => canvas.removeEventListener("webglcontextlost", contextLost);
  }, [gl, onFailure]);

  return null;
}

function Studio({
  mode,
  grounded = true,
}: Readonly<{ mode: LiveVehicleRenderMode; grounded?: boolean }>) {
  // Nothing here casts shadows, so the exterior rig shines straight through the
  // cabin's headliner and flattens it. Inside, drop it to a rim contribution
  // and let CabinInterior's own lights model the room.
  const rig = grounded ? 1 : 0.16;
  const blueprint = mode === "blueprint";
  return (
    <>
      <ambientLight intensity={(blueprint ? 0.48 : 0.34) * rig} color={blueprint ? "#a7efff" : "#eef4ef"} />
      <directionalLight
        position={[4.5, 7.5, 5.5]}
        intensity={(blueprint ? 0.72 : 1.5) * rig}
        color={blueprint ? "#b8f4ff" : "#fff4dd"}
      />
      <directionalLight
        position={[-5.5, 3.2, -3.8]}
        intensity={(blueprint ? 1.05 : 0.82) * rig}
        color={blueprint ? "#43bed9" : "#b9dfd8"}
      />
      <spotLight
        position={[0, 7, -2.5]}
        intensity={(blueprint ? 8 : 18) * rig}
        angle={0.62}
        penumbra={0.9}
        distance={16}
        color={blueprint ? "#9eeeff" : "#eef9f3"}
      />
      <Environment resolution={128} background={false}>
        <Lightformer
          form="rect"
          intensity={3.5}
          color="#fff8e8"
          position={[0, 5.5, 4]}
          rotation-x={Math.PI / 2}
          scale={[7, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#b7dcd5"
          position={[-4, 2.5, -4]}
          rotation-y={Math.PI / 3}
          scale={[5, 2.5, 1]}
        />
        <Lightformer
          form="ring"
          intensity={1.6}
          color="#ffffff"
          position={[4, 1.4, -2]}
          scale={2.3}
        />
      </Environment>
      {blueprint && (
        <Grid
          args={[12, 12]}
          position={[0, 0.03, 0]}
          cellColor="#1c7088"
          cellSize={0.25}
          cellThickness={0.55}
          sectionColor="#67ddf5"
          sectionSize={1}
          sectionThickness={0.85}
          fadeDistance={9}
          fadeStrength={1.6}
          infiniteGrid={false}
        />
      )}
      {grounded && (
      <mesh rotation-x={-Math.PI / 2} position-y={0.015} receiveShadow>
        <circleGeometry args={[7.5, 64]} />
        <meshStandardMaterial
          color={blueprint ? "#0c4053" : "#d8d5ca"}
          roughness={0.82}
          metalness={0.02}
          transparent
          opacity={blueprint ? 0.18 : 0.3}
        />
      </mesh>
      )}
      {grounded && (
      <ContactShadows
        position={[0, 0.025, 0]}
        scale={8.5}
        opacity={blueprint ? 0.2 : 0.47}
        blur={1.75}
        far={2.8}
        resolution={256}
        frames={1}
        color="#1b2620"
      />
      )}
    </>
  );
}

function VehicleScene(props: LiveVehicleViewportProps) {
  // Whichever body is registered for this source draws the vehicle; camera,
  // lighting, blueprint mode, focus and the cabin are all source-agnostic.
  const { Component: VehicleBody } = resolveVehicleModelSource(props.modelSource);
  // Interior swaps the exterior shell for the cabin rather than drawing one
  // inside the other: from a camera in the driver's seat the body's front
  // faces are culled anyway, so keeping it would just leak the studio in.
  const insideCabin = props.viewPreset === "interior" && props.mode === "showroom";

  return (
    <>
      <Studio mode={props.mode} grounded={!insideCabin} />
      <group visible={!insideCabin}>
        <LicensedModelBoundary fallback={null} onFailure={props.onFailure}>
          <Suspense fallback={null}>
            <VehicleBody
              paint={props.paint}
              wheel={props.wheel}
              accessories={props.accessories}
              focus={props.focus}
              mode={props.mode}
              onReady={props.onReady}
            />
          </Suspense>
        </LicensedModelBoundary>
      </group>
      <CabinInterior interior={props.interior} visible={insideCabin} />
      <CameraDirector
        viewPreset={props.viewPreset}
        focus={props.focus}
        keyboardOrbit={props.keyboardOrbit}
        resetRevision={props.resetRevision}
        reducedMotion={props.reducedMotion}
        onInteraction={props.onInteraction}
      />
      <ContextLossMonitor onFailure={props.onFailure} />
    </>
  );
}

export function LiveVehicleViewport(props: LiveVehicleViewportProps) {
  return (
    <div
      className="live-vehicle-viewport"
      data-render-mode={props.mode}
      data-reduced-motion={props.reducedMotion || undefined}
      aria-hidden="true"
    >
      <Canvas
        className="live-vehicle-canvas"
        camera={{
          position: [4.65, 1.95, 5.85],
          fov: 32,
          near: 0.1,
          far: 60,
        }}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{
          alpha: true,
          antialias: true,
          depth: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.16;
          gl.setClearColor(0x000000, 0);
        }}
      >
        <Suspense fallback={null}>
          <VehicleScene {...props} />
        </Suspense>
      </Canvas>
      <div className="live-vehicle-blueprint-overlay">
        <span className="live-vehicle-blueprint-overlay__reticle" />
        <span className="live-vehicle-blueprint-overlay__scan" />
      </div>
    </div>
  );
}

export default LiveVehicleViewport;
