import {
  type Group,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";
import type { LiveVehicleFocus, LiveVehiclePaint, LiveVehicleWheel } from "./live-vehicle.types";

export const LICENSED_VEHICLE_NODE_MAP = {
  body: "Body",
  wheels: ["Wheel_0_0", "Wheel_0_1", "Wheel_1_0", "Wheel_1_1"],
  frontLights: ["Light_Low_Beam_Left_0", "Light_Low_Beam_Right_0"],
  rearLights: [
    "Light_Brake_Center_0",
    "Light_Brake_Left_0",
    "Light_Brake_Left_1",
    "Light_Brake_Right_0",
    "Light_Brake_Right_1",
    "Light_Tail_Left_0",
    "Light_Tail_Right_0",
  ],
  licensePlate: "License_Plate_0",
} as const;

export const LICENSED_VEHICLE_MATERIAL_MAP = {
  paint: "Body",
  glass: "BodyGlass",
  plastic: "BodyPlastic",
  mirror: "BodyMirror",
  frontLights: "Material.009",
  rearLights: "Material.007",
  tire: "MA_tire_003.001",
  rim: "Material.011",
  rimInset: "Material.012",
} as const;

const cloneMaterial = (material: Material, clones: Map<Material, Material>) => {
  const existing = clones.get(material);
  if (existing) return existing;
  const cloned = material.clone();
  clones.set(material, cloned);
  return cloned;
};

export function cloneLicensedVehicleScene(source: Group) {
  const clone = source.clone(true);
  const materialClones = new Map<Material, Material>();

  clone.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => cloneMaterial(material, materialClones))
      : cloneMaterial(object.material, materialClones);
    object.castShadow = true;
    object.receiveShadow = true;
  });

  clone.getObjectByName(LICENSED_VEHICLE_NODE_MAP.licensePlate)?.removeFromParent();
  return clone;
}

const forEachMaterial = (root: Group, callback: (material: Material) => void) => {
  const visited = new Set<Material>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (visited.has(material)) continue;
      visited.add(material);
      callback(material);
    }
  });
};

export function getLicensedWheelRimScale(diameterInches: number) {
  return Math.min(Math.max(diameterInches / 20, 0.94), 1.06);
}

export function getLicensedWheelColors(style: LiveVehicleWheel["style"]) {
  if (style === "terrain") return { rim: "#48504b", inset: "#141a17", roughness: 0.46 } as const;
  if (style === "sport") return { rim: "#c5cdc8", inset: "#4e5853", roughness: 0.18 } as const;
  return { rim: "#959e99", inset: "#252d29", roughness: 0.3 } as const;
}

export function applyLicensedVehicleConfiguration(
  root: Group,
  paint: LiveVehiclePaint,
  wheel: LiveVehicleWheel,
  focus: LiveVehicleFocus,
) {
  const rimScale = getLicensedWheelRimScale(wheel.diameterInches);
  const wheelColors = getLicensedWheelColors(wheel.style);

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const isRimPart = materials.some(({ name }) => (
      name === LICENSED_VEHICLE_MATERIAL_MAP.rim
      || name === LICENSED_VEHICLE_MATERIAL_MAP.rimInset
    ));
    if (isRimPart) object.scale.setScalar(rimScale);
  });

  forEachMaterial(root, (material) => {
    if (!(material instanceof MeshStandardMaterial)) return;

    if (material.name === LICENSED_VEHICLE_MATERIAL_MAP.paint) {
      material.color.set(paint.color);
      material.metalness = 0.08;
      material.roughness = 0.22;
      material.emissive.set(focus === "paint" ? paint.color : "#000000");
      material.emissiveIntensity = focus === "paint" ? 0.06 : 0;
      if (material instanceof MeshPhysicalMaterial) {
        material.clearcoat = 1;
        material.clearcoatRoughness = 0.1;
      }
    }

    if (material.name === LICENSED_VEHICLE_MATERIAL_MAP.glass) {
      material.color.set("#263d43");
      material.metalness = 0.14;
      material.roughness = 0.08;
    }

    if (material.name === LICENSED_VEHICLE_MATERIAL_MAP.rim) {
      material.color.set(wheelColors.rim);
      material.metalness = 0.84;
      material.roughness = wheelColors.roughness;
    }

    if (material.name === LICENSED_VEHICLE_MATERIAL_MAP.rimInset) {
      material.color.set(wheelColors.inset);
      material.metalness = 0.72;
      material.roughness = Math.min(wheelColors.roughness + 0.08, 1);
    }

    if (material.name === LICENSED_VEHICLE_MATERIAL_MAP.frontLights) {
      material.color.set("#effff7");
      material.emissive.set("#d7fff0");
      material.emissiveIntensity = 1.45;
    }

    if (material.name === LICENSED_VEHICLE_MATERIAL_MAP.rearLights) {
      material.color.set("#d83a31");
      material.emissive.set("#ff3429");
      material.emissiveIntensity = 1.25;
    }

    material.needsUpdate = true;
  });
}

export function disposeLicensedVehicleMaterials(root: Group) {
  forEachMaterial(root, (material) => material.dispose());
}
