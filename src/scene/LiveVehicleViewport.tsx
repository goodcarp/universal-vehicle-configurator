import {
  CameraControls,
  ContactShadows,
  Environment,
  Lightformer,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
import { LicensedVehicleModel } from "./LicensedVehicleModel";
import type { LiveVehicleViewportProps } from "./live-vehicle.types";
import { VehicleModel } from "./VehicleModel";
import "./live-vehicle.css";

class LicensedModelBoundary extends Component<
  Readonly<{ children: ReactNode; fallback: ReactNode }>,
  Readonly<{ failed: boolean }>
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
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

function ReadyAndContextMonitor({
  onReady,
  onFailure,
}: Pick<LiveVehicleViewportProps, "onReady" | "onFailure">) {
  const gl = useThree((state) => state.gl);
  const reported = useRef(false);

  useFrame(() => {
    if (reported.current) return;
    reported.current = true;
    onReady();
  });

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

function Studio() {
  return (
    <>
      <ambientLight intensity={0.34} color="#eef4ef" />
      <directionalLight
        position={[4.5, 7.5, 5.5]}
        intensity={1.5}
        color="#fff4dd"
      />
      <directionalLight
        position={[-5.5, 3.2, -3.8]}
        intensity={0.82}
        color="#b9dfd8"
      />
      <spotLight
        position={[0, 7, -2.5]}
        intensity={18}
        angle={0.62}
        penumbra={0.9}
        distance={16}
        color="#eef9f3"
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
      <mesh rotation-x={-Math.PI / 2} position-y={0.015} receiveShadow>
        <circleGeometry args={[7.5, 64]} />
        <meshStandardMaterial
          color="#d8d5ca"
          roughness={0.82}
          metalness={0.02}
          transparent
          opacity={0.3}
        />
      </mesh>
      <ContactShadows
        position={[0, 0.025, 0]}
        scale={8.5}
        opacity={0.47}
        blur={1.75}
        far={2.8}
        resolution={256}
        frames={1}
        color="#1b2620"
      />
    </>
  );
}

function VehicleScene(props: LiveVehicleViewportProps) {
  const proceduralFallback = (
    <VehicleModel
      paint={props.paint}
      wheel={props.wheel}
      accessories={props.accessories}
      focus={props.focus}
    />
  );

  return (
    <>
      <Studio />
      <LicensedModelBoundary fallback={proceduralFallback}>
        <Suspense fallback={proceduralFallback}>
          <LicensedVehicleModel
            paint={props.paint}
            wheel={props.wheel}
            accessories={props.accessories}
            focus={props.focus}
          />
        </Suspense>
      </LicensedModelBoundary>
      <CameraDirector
        viewPreset={props.viewPreset}
        focus={props.focus}
        keyboardOrbit={props.keyboardOrbit}
        resetRevision={props.resetRevision}
        reducedMotion={props.reducedMotion}
        onInteraction={props.onInteraction}
      />
      <ReadyAndContextMonitor onReady={props.onReady} onFailure={props.onFailure} />
    </>
  );
}

export function LiveVehicleViewport(props: LiveVehicleViewportProps) {
  return (
    <div className="live-vehicle-viewport" aria-hidden="true">
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
    </div>
  );
}

export default LiveVehicleViewport;
