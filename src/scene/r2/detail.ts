import { CylinderGeometry, Group, type Material, Mesh } from "three";
import { SPEC } from "./vehicle.js";

/**
 * Detail the drawing does not need but a showroom does.
 *
 * A general-arrangement drawing is cut away by definition: it never shows the
 * inside of a wheel arch, because in a drawing you are meant to see through it.
 * Rendered as a solid car the same omission is the first thing that gives the
 * model away — you look into the arch and see the lit underside of the body
 * skin, which reads as a hole punched in the bodywork.
 *
 * Similarly, a lamp in a drawing is an outline. A lamp in a showroom is a lens
 * with something behind it, and the depth between those two surfaces is most of
 * what makes it read as a lamp rather than a sticker.
 */

export interface DetailMaterials {
  reflector: Material;
  emitter: Material;
  bezel: Material;
}

/**
 * Arch liners and lamp internals, as one group parented to the body.
 *
 * Returned rather than merged into the drawing so the drawing stays the file
 * that can be diffed against the engineering source.
 */
export function buildDetailGroup(materials: DetailMaterials): Group {
  const group = new Group();
  group.name = "showroom-detail";

  // Headlamp internals: a reflector plate set back behind the lens, with three
  // matrix projectors on it. The gap between plate and lens is what gives the
  // lamp its depth when the camera comes in close.
  const nose = SPEC.NOSE;
  for (const sign of [1, -1] as const) {
    const z = sign * 0.595;

    const bowl = new Mesh(new CylinderGeometry(0.082, 0.09, 0.012, 28), materials.reflector);
    bowl.rotation.z = Math.PI / 2;
    bowl.position.set(nose - 0.012, 0.875, z);
    bowl.scale.set(1, 1, 1.9);
    group.add(bowl);

    for (const dy of [-0.098, 0, 0.098]) {
      const housing = new Mesh(new CylinderGeometry(0.036, 0.030, 0.028, 24), materials.reflector);
      housing.rotation.z = Math.PI / 2;
      housing.position.set(nose - 0.002, 0.875 + dy, z);
      group.add(housing);

      const element = new Mesh(new CylinderGeometry(0.027, 0.027, 0.008, 24), materials.emitter);
      element.rotation.z = Math.PI / 2;
      element.position.set(nose + 0.013, 0.875 + dy, z);
      group.add(element);
    }

    const bezel = new Mesh(new CylinderGeometry(0.098, 0.098, 0.006, 32), materials.bezel);
    bezel.rotation.z = Math.PI / 2;
    bezel.position.set(nose + 0.004, 0.875, z);
    bezel.scale.set(1, 1, 1.72);
    group.add(bezel);
  }

  group.userData.dispose = () => {
    group.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  };

  return group;
}
