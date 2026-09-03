import {
  Color,
  DoubleSide,
  LatheGeometry,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector2,
} from "three";
import { buildDetailGroup } from "./detail";
import { cutGLSL } from "./geom.js";
import { CUT, SPEC, type R2Vehicle } from "./vehicle.js";

/**
 * Showroom dressing for the engineering body.
 *
 * The body arrives from the drawing in flat white with its door, window and
 * frunk apertures cut in the fragment shader rather than booleaned out of the
 * mesh. That cut is the reason the panel gaps are real geometry edges instead
 * of painted-on lines, and it is carried by the material — so re-materialising
 * for a showroom means rebuilding the cut on top of automotive shaders, not
 * replacing the materials outright. Swapping them wholesale (which is what a
 * naive PBR pass does) silently fills every aperture back in.
 *
 * Assignment is by part name and sub-id, which is how the drawing already
 * identifies its own components. That is what makes the lamp lens separable
 * from its emitter, and the rim, tyre, disc and caliper distinct parts rather
 * than one wheel-shaped lump.
 */

export type RimFinish = "bicolor" | "dark" | "bright";

export interface ShowroomOptions {
  paintColor: string;
  /** Second body colour for the roof on two-tone paints; null keeps it single. */
  roofColor?: string | null;
  rimFinish: RimFinish;
  caliperColor: string;
  cabinColor: string;
  lampsOn: boolean;
}

/** Blueprint-only structure. Real, but not what a showroom is showing. */
const CUTAWAY_ONLY = new Set([
  "battery",
  "batterySeams",
  "subframeF",
  "subframeR",
  "driveUnitF",
  "driveUnitR",
  "suspension",
  "springs",
  "steering",
  "halfshafts",
  "antiRoll",
]);

type Role =
  | "paint"
  | "roof"
  | "gloss"
  | "trim"
  | "cladding"
  | "skid"
  | "chrome"
  | "glass"
  | "lampLens"
  | "lampEmitter"
  | "tailEmitter"
  | "reflector"
  | "tyre"
  | "rim"
  | "rimPocket"
  | "lug"
  | "disc"
  | "discVent"
  | "caliper"
  | "carrier"
  | "cabin"
  | "cabinDark"
  | "sensor";

/**
 * Which shader each mesh gets.
 *
 * Keys are `part` or `part#sub`, matching the ids the drawing already assigns,
 * so this table reads against the build code rather than guessing from shape.
 */
const ROLE_BY_MESH: Record<string, Role> = {
  // painted skin
  body: "paint",
  hood: "paint",
  "hood#2": "chrome",
  tailgate: "paint",
  "tailgate#6": "trim",
  // Each door carries its own glazing and trim, so a door is not one material.
  // Sub 1 is the window panel: leaving it on paint puts a body-coloured
  // rectangle over every window, sitting proud of the greenhouse behind it.
  doorFL: "paint",
  "doorFL#1": "glass",
  "doorFL#3": "cabin",
  "doorFL#4": "cabinDark",
  "doorFL#5": "chrome",
  "doorFL#6": "gloss",
  doorFR: "paint",
  "doorFR#1": "glass",
  "doorFR#3": "cabin",
  "doorFR#4": "cabinDark",
  "doorFR#5": "chrome",
  "doorFR#6": "gloss",
  doorRL: "paint",
  "doorRL#1": "glass",
  "doorRL#3": "cabin",
  "doorRL#4": "cabinDark",
  "doorRL#5": "chrome",
  doorRR: "paint",
  "doorRR#1": "glass",
  "doorRR#3": "cabin",
  "doorRR#4": "cabinDark",
  "doorRR#5": "chrome",
  chargePort: "paint",

  // glasshouse
  greenhouse: "glass",
  roofGlass: "roof",
  "roofGlass#1": "trim",
  "roofGlass#2": "tailEmitter",
  "roofGlass#3": "paint",
  pillars: "gloss",
  "pillars#5": "glass",

  // lower body
  cladding: "cladding",
  fasciaFront: "trim",
  "fasciaFront#1": "gloss",
  "fasciaFront#2": "skid",
  "fasciaFront#3": "sensor",
  "fasciaFront#4": "sensor",
  fasciaRear: "trim",
  "fasciaRear#1": "skid",
  "fasciaRear#3": "reflector",

  // lamps — the lens is a separate part from what lights it
  headlamps: "lampLens",
  "headlamps#1": "lampEmitter",
  lightBar: "lampEmitter",
  "lightBar#1": "lampEmitter",
  tailPills: "tailEmitter",
  "tailPills#1": "gloss",
  "tailPills#2": "paint",
  "tailPills#3": "trim",

  // cabin
  dash: "cabin",
  seats: "cabin",
  steeringWheel: "cabinDark",
  cargo: "cabinDark",
  frunk: "cabinDark",
  floor: "cabinDark",
  cargoFloor: "cabinDark",
  frunkFloor: "cabinDark",
  inlet: "trim",

  // brakes
  brakes: "disc",
  "brakes#1": "caliper",
  "brakes#2": "discVent",
  "brakes#3": "disc",
  "brakes#4": "carrier",
};

/** Wheels share one part per corner, so the rim/tyre split is by sub-id. */
const WHEEL_ROLE: Record<number, Role> = {
  0: "tyre",
  1: "rim",
  2: "rim",
  3: "rim",
  4: "rim",
  5: "rimPocket",
  6: "lug",
};

const RIM_FINISH: Record<RimFinish, { color: string; metalness: number; roughness: number }> = {
  bicolor: { color: "#b9bfc2", metalness: 0.95, roughness: 0.24 },
  dark: { color: "#3a3f42", metalness: 0.9, roughness: 0.36 },
  bright: { color: "#e3e8ea", metalness: 1.0, roughness: 0.11 },
};

/**
 * Shade every surface as what it is: an outside and an inside.
 *
 * Two things have to happen in the fragment shader, and they have to happen in
 * the same patch because a material only gets one `onBeforeCompile`.
 *
 * The aperture cut is the panel gaps. The drawing does not boolean holes for
 * the doors, windows and frunk; it discards those fragments, which is why the
 * shut lines are true edges in the surface rather than lines painted on it.
 * Re-materialising for a showroom therefore has to rebuild that cut on the new
 * shaders, or every opening silently fills back in.
 *
 * Cavity shading is the other half, and it rides on the same patch. Every
 * surface here is an open shell lit double-sided, so the inside of the body is
 * lit exactly as brightly as the outside — and you see it, through the wheel
 * arches, as bare white plastic where there should be a dark cavity. Darkening
 * back faces costs one line and no geometry, and it is closer to the truth than
 * any liner you could model: the inside of a body really is a hole light does
 * not reach.
 *
 * It applies only to the cut shells. Winding is not consistent across the
 * drawing — several bolt-on panels are built inside-out, which is invisible
 * under double-sided lighting but makes `gl_FrontFacing` report backwards — so
 * a blanket rule paints the hood and doors black. The lofted shells are both
 * correctly wound and the only parts you ever see the inside of.
 */
function patchShell<T extends Material>(material: T, aperture: boolean): T {
  material.onBeforeCompile = (shader) => {
    if (aperture) {
      shader.vertexShader = `varying vec3 vObjPos;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n\tvObjPos = position;",
      );
      shader.fragmentShader =
        `varying vec3 vObjPos;\n${cutGLSL(CUT)}\n${shader.fragmentShader}`.replace(
          "#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\n\tif (inAperture(vObjPos)) discard;",
        )
        .replace(
          "#include <dithering_fragment>",
          "#include <dithering_fragment>\n\tif (!gl_FrontFacing) gl_FragColor.rgb *= 0.085;",
        );
    }
  };
  // The cut and uncut variants must not share a compiled program, or whichever
  // compiles first decides whether the apertures exist.
  material.customProgramCacheKey = () => (aperture ? "r2-shell-cut" : "r2-shell");
  return material;
}

/**
 * Every surface in the drawing is an open shell.
 *
 * The tyre is a lathe with no inner wall, the body is a loft with no back face,
 * and the drawing lights all of it double-sided. Rendering any of it front-face
 * only means looking straight through the surface into the inside of the part —
 * on a tyre that shows as a torn ring of the wheel's own interior.
 */
function doubleSided<T extends Material>(materials: Record<string, T>): Record<string, T> {
  for (const material of Object.values(materials)) {
    material.side = DoubleSide;
    patchShell(material, false);
  }
  return materials;
}

function buildMaterials(options: ShowroomOptions): Record<Role, Material> {
  const rim = RIM_FINISH[options.rimFinish] ?? RIM_FINISH.bicolor;
  const lamp = options.lampsOn ? 1 : 0;

  // Automotive paint is a metallic basecoat under a smooth dielectric layer.
  // The clearcoat is what separates it from coloured plastic: a second, much
  // tighter specular lobe that survives at grazing angles.
  const paint = new MeshPhysicalMaterial({
    color: new Color(options.paintColor),
    metalness: 0.42,
    roughness: 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.85,
    side: DoubleSide,
  });

  const roofPaint = new MeshPhysicalMaterial({
    color: new Color(options.roofColor ?? "#0e1215"),
    metalness: 0.08,
    roughness: 0.055,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 2.4,
    side: DoubleSide,
  });

  return doubleSided({
    paint,
    roof: roofPaint,
    // Gloss black for the pillars and recesses: same coat, no flake.
    gloss: new MeshPhysicalMaterial({
      color: new Color("#0b0d0e"),
      metalness: 0.1,
      roughness: 0.075,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.7,
      side: DoubleSide,
    }),
    trim: new MeshStandardMaterial({
      color: new Color("#171a1b"),
      metalness: 0.15,
      roughness: 0.62,
      envMapIntensity: 0.85,
      side: DoubleSide,
    }),
    // Structural-grain composite: rougher and flatter than the bumper skin, so
    // the two-tone break reads even in a single-colour environment.
    cladding: new MeshStandardMaterial({
      color: new Color("#101314"),
      metalness: 0.05,
      roughness: 0.88,
      envMapIntensity: 0.55,
      side: DoubleSide,
    }),
    skid: new MeshStandardMaterial({
      color: new Color("#6b7175"),
      metalness: 0.55,
      roughness: 0.5,
      envMapIntensity: 1,
      side: DoubleSide,
    }),
    chrome: new MeshStandardMaterial({
      color: new Color("#cfd6d8"),
      metalness: 1,
      roughness: 0.14,
      envMapIntensity: 1.6,
    }),
    // Privacy glass: dark, near-mirror, and thin. Transmission is deliberately
    // low — a fully transmissive windscreen costs a render pass and reads worse
    // than a tinted reflector at showroom distance.
    glass: new MeshPhysicalMaterial({
      color: new Color("#141c21"),
      metalness: 0.02,
      roughness: 0.045,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      ior: 1.52,
      envMapIntensity: 2.1,
      side: DoubleSide,
    }),
    // Lamp lens: clear, thick, and refracting, with the emitter behind it.
    lampLens: new MeshPhysicalMaterial({
      color: new Color("#e8f2f6"),
      metalness: 0,
      roughness: 0.02,
      transmission: 0.92,
      thickness: 0.05,
      ior: 1.49,
      envMapIntensity: 2.2,
    }),
    lampEmitter: new MeshStandardMaterial({
      color: new Color("#dceaf5"),
      emissive: new Color("#bcdcff"),
      emissiveIntensity: 0.35 + lamp * 3.1,
      metalness: 0.1,
      roughness: 0.2,
      toneMapped: false,
    }),
    tailEmitter: new MeshStandardMaterial({
      color: new Color("#7a0f0c"),
      emissive: new Color("#ff2a18"),
      emissiveIntensity: 0.5 + lamp * 2.6,
      metalness: 0.1,
      roughness: 0.25,
      toneMapped: false,
      side: DoubleSide,
    }),
    reflector: new MeshStandardMaterial({
      color: new Color("#8e1410"),
      emissive: new Color("#5c0a06"),
      emissiveIntensity: 0.4,
      roughness: 0.3,
    }),
    // Rubber: no reflection to speak of, and darker on the sidewall than the
    // tread. One roughness value across both is what makes tyres read as vinyl.
    tyre: new MeshStandardMaterial({
      color: new Color("#0c0e0f"),
      metalness: 0,
      roughness: 0.95,
      envMapIntensity: 0.3,
    }),
    rim: new MeshStandardMaterial({
      color: new Color(rim.color),
      metalness: rim.metalness,
      roughness: rim.roughness,
      envMapIntensity: 1.5,
      side: DoubleSide,
    }),
    rimPocket: new MeshStandardMaterial({
      color: new Color("#26292b"),
      metalness: 0.6,
      roughness: 0.55,
      envMapIntensity: 0.8,
    }),
    lug: new MeshStandardMaterial({
      color: new Color("#8d9498"),
      metalness: 1,
      roughness: 0.3,
    }),
    // Cast iron with a machined face: bright, streaky, and never a mirror.
    disc: new MeshStandardMaterial({
      color: new Color("#9aa1a4"),
      metalness: 0.95,
      roughness: 0.42,
      envMapIntensity: 1.1,
    }),
    discVent: new MeshStandardMaterial({
      color: new Color("#3d4245"),
      metalness: 0.8,
      roughness: 0.62,
    }),
    caliper: new MeshPhysicalMaterial({
      color: new Color(options.caliperColor),
      metalness: 0.35,
      roughness: 0.3,
      clearcoat: 0.7,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.2,
    }),
    carrier: new MeshStandardMaterial({
      color: new Color("#4a4f52"),
      metalness: 0.85,
      roughness: 0.55,
    }),
    cabin: new MeshStandardMaterial({
      color: new Color(options.cabinColor),
      metalness: 0.02,
      roughness: 0.78,
      envMapIntensity: 0.7,
      side: DoubleSide,
    }),
    cabinDark: new MeshStandardMaterial({
      color: new Color("#14171a"),
      metalness: 0.05,
      roughness: 0.85,
      envMapIntensity: 0.5,
      side: DoubleSide,
    }),
    sensor: new MeshStandardMaterial({
      color: new Color("#05070a"),
      metalness: 0.2,
      roughness: 0.15,
    }),
  }) as Record<Role, Material>;
}

export interface ShowroomHandle {
  materials: Record<Role, Material>;
  paint: MeshPhysicalMaterial;
  caliper: MeshPhysicalMaterial;
  cabin: MeshStandardMaterial;
  dispose(): void;
}

/**
 * Dress a freshly built vehicle for the showroom.
 *
 * Returns the live paint and caliper materials so colour changes are a uniform
 * write rather than a rebuild — swapping a body colour must not cost a
 * recompile, or every click in the paint picker stutters.
 */
export function dressForShowroom(vehicle: R2Vehicle, options: ShowroomOptions): ShowroomHandle {
  const base = buildMaterials(options);
  // Every material needs a cut twin, because the same paint appears on both cut
  // shells and uncut panels.
  const cutTwins = new Map<Material, Material>();
  const cutVariant = (material: Material) => {
    const existing = cutTwins.get(material);
    if (existing) return existing;
    const twin = patchShell(material.clone(), true);
    // The twin has to keep sharing its colour with the original, not a copy of
    // it: the body shell is the cut variant of the paint, so a cloned colour
    // means changing the paint repaints the doors and leaves the shell behind.
    const source = material as unknown as { color?: Color; emissive?: Color };
    const target = twin as unknown as { color?: Color; emissive?: Color };
    if (source.color) target.color = source.color;
    if (source.emissive) target.emissive = source.emissive;
    cutTwins.set(material, twin);
    return twin;
  };

  for (const part of vehicle.order) {
    if (CUTAWAY_ONLY.has(part.name)) {
      // Go through the builder's own hide set as well, so its per-frame update
      // keeps them hidden instead of switching them back on.
      vehicle.hidden.add(part.name);
      part.group.visible = false;
      continue;
    }
    for (const object of part.meshes) {
      const mesh = object as Mesh;
      const sub = (mesh.userData.subId as number) ?? 0;
      const role: Role = part.category === "running"
        ? WHEEL_ROLE[sub] ?? "rim"
        : ROLE_BY_MESH[`${part.name}#${sub}`] ?? ROLE_BY_MESH[part.name] ?? "trim";
      const material = base[role];
      mesh.material = mesh.userData.cut ? cutVariant(material) : material;
      mesh.castShadow = part.category !== "interior";
      mesh.receiveShadow = false;
    }
  }

  // Lamp internals are a showroom concern, so they are built here and parented
  // to the body rather than pushed back into the engineering source.
  const detail = buildDetailGroup({
    reflector: base.chrome,
    emitter: base.lampEmitter,
    bezel: base.gloss,
  });
  vehicle.body.add(detail);

  return {
    materials: base,
    paint: base.paint as MeshPhysicalMaterial,
    caliper: base.caliper as MeshPhysicalMaterial,
    cabin: base.cabin as MeshStandardMaterial,
    dispose() {
      detail.removeFromParent();
      (detail.userData.dispose as (() => void) | undefined)?.();
      for (const material of Object.values(base)) material.dispose();
      for (const material of cutTwins.values()) material.dispose();
    },
  };
}

/**
 * Refit the wheels to a different rim diameter.
 *
 * A bigger wheel on a road car keeps the same rolling radius and trades
 * sidewall for rim, so the tyre profile is rebuilt around the new bead rather
 * than the whole assembly being scaled — scaling would move the contact patch
 * off the ground and change the ride height with the wheel option.
 */
export function fitWheelDiameter(vehicle: R2Vehicle, diameterInches: number): () => void {
  const rimRadius = (diameterInches * 0.0254) / 2;
  const k = rimRadius / SPEC.rimR;
  const bead = rimRadius + 0.014;
  const r = SPEC.tireR;
  const hw = SPEC.tireW / 2;
  const profile = [
    [bead, hw - 0.025],
    [bead + 0.062, hw],
    [bead + 0.107, hw],
    [r - 0.008, hw - 0.012],
    [r, hw - 0.03],
    [r, -(hw - 0.03)],
    [r - 0.008, -(hw - 0.012)],
    [bead + 0.107, -hw],
    [bead + 0.062, -hw],
    [bead, -(hw - 0.025)],
  ].map(([a, b]) => new Vector2(a, b));
  const tyre = new LatheGeometry(profile, 60);

  const previous: { mesh: Mesh; scale: [number, number, number]; position: [number, number, number] }[] = [];
  const tyreMeshes: { mesh: Mesh; geometry: Mesh["geometry"] }[] = [];
  for (const wheel of vehicle.wheels) {
    for (const object of wheel.part.meshes) {
      const mesh = object as Mesh;
      const sub = (mesh.userData.subId as number) ?? 0;
      if (sub === 0) {
        tyreMeshes.push({ mesh, geometry: mesh.geometry });
        mesh.geometry = tyre;
        continue;
      }
      previous.push({
        mesh,
        scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
        position: [mesh.position.x, mesh.position.y, mesh.position.z],
      });
      if (sub === 1) {
        // The barrel is a cylinder lying on its side: radius is in local X/Z,
        // width in local Y, so the width must not follow the diameter.
        mesh.scale.set(k, 1, k);
      } else if (sub === 4 || sub === 5) {
        // Spokes and pockets sit in the wheel face plane on a polar layout.
        mesh.scale.set(k, k, 1);
        mesh.position.set(mesh.position.x * k, mesh.position.y * k, mesh.position.z);
      }
    }
  }

  return () => {
    // Put the drawing's own tyre back before dropping the refitted one, or the
    // wheels end up pointing at disposed geometry.
    for (const entry of tyreMeshes) entry.mesh.geometry = entry.geometry;
    tyre.dispose();
    for (const entry of previous) {
      entry.mesh.scale.set(...entry.scale);
      entry.mesh.position.set(...entry.position);
    }
  };
}
