import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color } from "three";
import type { VehicleModelProps } from "./vehicle-model-source";

/**
 * Code-native vehicle body — the drop-in point for the r2-blueprint model.
 *
 * This is deliberately a massing stand-in, not a finished body. It exists so the
 * viewport seam is real and exercised: paint, wheel diameter, the tow hitch,
 * focus highlighting and blueprint mode all flow through here exactly as they
 * will for the real geometry, and the proportions match the licensed GLB's
 * footprint so every camera preset stays framed.
 *
 * Replacing it means porting r2-blueprint's `src/vehicle.js` lofts into this
 * component and keeping the same props contract. That model already carries the
 * things a GLB cannot: hinged doors, frunk, liftgate and charge-port door, an
 * exploded view, and a body-dissolve to the skateboard chassis.
 *
 * Measurements below are read off the licensed GLB so the swap is like for like:
 * length 4.22 m along +X, width 1.88 m across Z, roof at 1.34 m, wheels at
 * x +/-1.38, z +/-0.81, radius 0.37.
 */

const BODY_LENGTH = 4.22;
const BODY_WIDTH = 1.83;
const SILL_Y = 0.42;
const BELT_Y = 1.02;
const ROOF_Y = 1.34;
const WHEEL_X = 1.38;
const WHEEL_Z = 0.81;

const HIGHLIGHT = "#c7ff39";

export function ProceduralVehicleModel({
  paint,
  wheel,
  accessories,
  focus,
  mode,
  onReady,
}: VehicleModelProps) {
  const invalidate = useThree((state) => state.invalidate);
  const blueprint = mode === "blueprint";

  const palette = useMemo(() => {
    const body = new Color(paint.color);
    return {
      body: `#${body.getHexString()}`,
      lower: `#${body.clone().lerp(new Color("#000000"), 0.55).getHexString()}`,
    };
  }, [paint.color]);

  // Wheel diameter is a real configurable consequence, so it drives geometry.
  const tyreRadius = (wheel.diameterInches / 21) * 0.37;

  useEffect(() => {
    onReady();
    invalidate();
  }, [invalidate, onReady]);

  useEffect(() => {
    invalidate();
  }, [invalidate, palette, tyreRadius, focus, blueprint]);

  const bodyColor = blueprint ? "#8fdcf0" : palette.body;
  const paintFocused = focus === "paint";

  return (
    <group name="ProceduralVehicleModel">
      {/* Lower body */}
      <mesh position={[0, (SILL_Y + BELT_Y) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BODY_LENGTH, BELT_Y - SILL_Y, BODY_WIDTH]} />
        <meshStandardMaterial
          color={paintFocused ? HIGHLIGHT : bodyColor}
          emissive={paintFocused ? "#6f9418" : "#000000"}
          emissiveIntensity={paintFocused ? 0.5 : 0}
          metalness={blueprint ? 0.1 : 0.55}
          roughness={blueprint ? 0.8 : 0.36}
          wireframe={blueprint}
        />
      </mesh>

      {/* Greenhouse, inset and shortened so the silhouette reads as a cabin */}
      <mesh position={[-0.16, (BELT_Y + ROOF_Y) / 2, 0]} castShadow>
        <boxGeometry args={[BODY_LENGTH * 0.56, ROOF_Y - BELT_Y, BODY_WIDTH * 0.88]} />
        <meshStandardMaterial
          color={blueprint ? "#5fc6e6" : "#11201d"}
          metalness={blueprint ? 0.1 : 0.2}
          roughness={blueprint ? 0.8 : 0.12}
          wireframe={blueprint}
        />
      </mesh>

      {/* Rocker */}
      <mesh position={[0, SILL_Y - 0.06, 0]}>
        <boxGeometry args={[BODY_LENGTH * 0.86, 0.12, BODY_WIDTH * 0.96]} />
        <meshStandardMaterial color={palette.lower} metalness={0.3} roughness={0.7} wireframe={blueprint} />
      </mesh>

      {[WHEEL_X, -WHEEL_X].map((x) =>
        [WHEEL_Z, -WHEEL_Z].map((z) => (
          <mesh
            key={`${x}:${z}`}
            position={[x, tyreRadius, z]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[tyreRadius, tyreRadius, 0.24, 24]} />
            <meshStandardMaterial
              color={focus === "wheels" ? HIGHLIGHT : "#14181a"}
              emissive={focus === "wheels" ? "#6f9418" : "#000000"}
              emissiveIntensity={focus === "wheels" ? 0.55 : 0}
              metalness={0.35}
              roughness={0.62}
              wireframe={blueprint}
            />
          </mesh>
        )),
      )}

      {accessories.towHitch && (
        <mesh position={[-BODY_LENGTH / 2 - 0.12, 0.3, 0]} castShadow>
          <boxGeometry args={[0.26, 0.1, 0.14]} />
          <meshStandardMaterial
            color={focus === "utility" ? HIGHLIGHT : "#242a26"}
            emissive={focus === "utility" ? "#789d18" : "#000000"}
            emissiveIntensity={focus === "utility" ? 1.1 : 0}
            metalness={0.74}
            roughness={0.34}
          />
        </mesh>
      )}
    </group>
  );
}

export default ProceduralVehicleModel;
