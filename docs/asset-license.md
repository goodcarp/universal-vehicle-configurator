# Vehicle asset gate and provenance

Audit date: 2026-08-31 (America/New_York)

## Gate result

The approved runtime source is an **original authored 2.5D safety pack**. No
third-party GLB, manufacturer model, manufacturer photography, logo, badge, or
manufacturer texture is bundled in this repository.

The live-3D branch is **not approved yet**. The best timeboxed candidate has a
clear CC BY 4.0 listing, but its official download requires an authenticated
Sketchfab session, so the actual file could not be acquired and its paint
material, removable branding, wheel hierarchy, normals, and first-frame load
could not be verified. Scraping viewer payloads or bypassing the official
download was explicitly rejected.

Approved facts:

- first-frame fallback: `public/images/showroom-fallback.webp`
- strict side layer and blueprint layer: registered 1600×900 canvases; the
  blueprint matte is intersected with the reviewed side silhouette and retains
  at least 96% silhouette coverage without extending beyond it
- body paint: dedicated representative 2D mask, not a claimed live material
- wheel treatment: a representative inset with stable normalized wheel anchors,
  not a claimed mesh swap
- wheel centers: all six visible shipped hubs have deliberately plain concentric
  discs; generator-made pseudo-lettering is covered during the deterministic
  build
- identity: original compact electric SUV concept, always described as
  unofficial and not affiliated with a manufacturer

`src/scene/scene-manifest.ts` is the runtime source of truth for those claims.

## Timeboxed live-model candidate

| Field | Recorded value |
| --- | --- |
| Title | Lowpoly Generic SUV |
| Creator | mk2design |
| Primary page | <https://sketchfab.com/3d-models/lowpoly-generic-suv-edc994ad28ed438cb365c0e0389ac177> |
| Official metadata | <https://api.sketchfab.com/v3/models/edc994ad28ed438cb365c0e0389ac177> |
| Listed license | Creative Commons Attribution 4.0 |
| License text | <https://creativecommons.org/licenses/by/4.0/> |
| Listing metadata | downloadable, 8,024 faces, 5,230 vertices, 5 materials, 5 textures |
| Runtime decision | not bundled; blocked pending authorized download plus topology/material audit |

Two clearly licensed fallbacks were also considered but intentionally not used:
Quaternius' CC0 Cars Pack and Kenney's CC0 Car Kit. Both have usable separate
vehicle parts, but their low-poly/toy presentation does not clear the PRD's
premium hero-quality gate. Khronos' CC BY 4.0 CarConcept is technically clean but
is a branded low sports concept rather than a compact SUV. No files from any of
those sources are present here.

## Rights status of the shipped art

The three source renders below were created for this project with OpenAI's
built-in image-generation tool. They are not copied from a manufacturer and are
not released under CC0 or CC BY. Their use is governed by the applicable OpenAI
terms; as between the user and OpenAI, output ownership is addressed in the
[OpenAI Terms of Use](https://openai.com/policies/terms-of-use/). The prompts
explicitly required an original generic design and prohibited manufacturer marks.

The generator nevertheless placed tiny invented glyph-like details on wheel
hubs. The shipped assets replace those pixels with plain, unbranded concentric
hub discs in `scripts/asset-audit/build-fallbacks.py`. A built-in image edit was
also attempted, but rejected because it baked a checkerboard and did not clean
the hubs reliably; that rejected output was never copied into the project.

## Source-to-project mapping

| Asset | Creation mode | Original tool output | Reviewed project master | Shipped derivatives |
| --- | --- | --- | --- | --- |
| side profile | new generation | `/Users/spaceman/.codex/generated_images/01a05a07-2cb9-7eb3-9d33-93c85eaecda8/exec-40404ed6-b9e0-4806-b34c-21dd365925a9.png` | `scripts/asset-audit/source/vehicle-side-master.png` | `vehicle-side.webp`, `vehicle-scan-mask.webp`, `vehicle-paint-mask.webp` |
| blueprint | image edit / style transfer using the reviewed side master | `/Users/spaceman/.codex/generated_images/01a05a07-2cb9-7eb3-9d33-93c85eaecda8/exec-2a35eaaa-6ed1-47bd-bc1f-7c64a465b4d9.png` | `scripts/asset-audit/source/vehicle-side-blueprint-master.png` | `vehicle-side-blueprint.webp`, `representative-wheel-inset.webp` |
| showroom | reference-conditioned generation using the reviewed side master | `/Users/spaceman/.codex/generated_images/01a05a07-2cb9-7eb3-9d33-93c85eaecda8/exec-9aaa4152-f518-4b75-b101-33d588d37752.png` | `scripts/asset-audit/source/showroom-master.png` | `showroom-fallback.webp` |

All final derivative paths in that table are under `public/images/`.

Rejected edit (not used):

- original output:
  `/Users/spaceman/.codex/generated_images/01a05a07-2cb9-7eb3-9d33-93c85eaecda8/exec-5017ace9-eb5e-4044-939a-a364a59b09da.png`
- project copy: none
- reason: RGB checkerboard was baked into the background and wheel-center cleanup
  was incomplete

## Exact image-generation prompts

### Side-profile master — new generation

```text
Use case: product-mockup
Asset type: vehicle configurator 2.5D side-profile master asset
Primary request: an original, unbranded premium compact electric SUV shown in a perfectly orthographic driver-side profile, designed as a plausible modern production vehicle but not resembling any specific manufacturer model
Scene/backdrop: genuinely transparent background; no floor, no shadow outside the vehicle cutout
Subject: one complete five-door compact electric SUV, entire vehicle visible, wheels perfectly circular and aligned, short overhangs, confident planted stance, subtly adventurous proportions, elegant glasshouse, precise panel seams, no roof rack
Style/medium: exceptionally polished photorealistic CGI automotive configurator render
Composition/framing: strict side elevation, vehicle centered horizontally with generous transparent padding, no perspective distortion, wheels and bumpers fully inside frame
Lighting/mood: broad premium studio softboxes producing crisp restrained highlights and readable body surfacing
Color palette: deep mineral forest green body, near-black roof and glass, graphite wheels, neutral realistic tires
Materials/textures: refined metallic paint, clearcoat, dark glass, satin trim, realistic tire rubber; body paint must read as one coherent recolorable region
Constraints: original generic design only; no logos, badges, emblems, letters, numbers, text, license plate markings, charging-network marks, watermark, people, scenery, reflections of buildings, or manufacturer-identifiable signatures; clean transparent alpha edges
Avoid: Rivian, Tesla, Hyundai, Kia, Mercedes, BMW, Audi, Land Rover, Volvo, or any recognizable existing vehicle; cartoon styling; toy proportions; exaggerated concept-car details; motion blur
```

### Blueprint master — image edit / style transfer

Referenced image:
`/Users/spaceman/Documents/Design and Viz/Universal Vehicle Configurator/scripts/asset-audit/source/vehicle-side-master.png`

```text
Use case: style-transfer
Asset type: vehicle configurator Blueprint Mode side-profile derivative
Input images: Image 1 is the exact vehicle and edit target
Primary request: transform only the rendering treatment into a premium automotive engineering blueprint while preserving Image 1's exact vehicle silhouette, wheel locations, panel layout, strict side elevation, scale, framing, and transparent background
Style/medium: elegant dark-navy technical illustration with precise luminous cyan-white contour lines, selective fine construction lines, subtle semi-transparent body planes, restrained cross-section hatching around the front wheel and battery-floor area, sophisticated industrial-design drawing rather than generic wireframe
Composition/framing: exact same side-profile placement and full-vehicle crop as Image 1
Lighting/mood: crisp emissive drafting linework with controlled hierarchy; strongest silhouette and wheel geometry, quieter secondary panel seams
Color palette: midnight navy, icy cyan, blueprint white, one very small amber technical accent near the front wheel
Constraints: change only visual treatment; preserve all geometry and alignment from Image 1; genuinely transparent background outside the vehicle; no logos, badges, letters, numbers, words, labels, watermark, scenery, floor, or shadow; no extra vehicle parts outside the silhouette
Avoid: neon cyberpunk glow, Tron styling, noisy triangle wireframe, sketchiness, fantasy symbols, unrelated diagrams, perspective change, altered wheels, altered body proportions
```

### Showroom master — reference-conditioned generation

Referenced image:
`/Users/spaceman/Documents/Design and Viz/Universal Vehicle Configurator/scripts/asset-audit/source/vehicle-side-master.png`

```text
Use case: product-mockup
Asset type: premium vehicle configurator showroom fallback
Input images: Image 1 defines the exact original unbranded SUV design, paint, trim, wheels, and proportions
Primary request: render the same vehicle from a restrained front three-quarter driver-side view in a high-end automotive configurator studio
Scene/backdrop: seamless warm ivory cyclorama with an extremely subtle matte floor and soft contact shadow; no architecture or props
Subject: the same complete compact electric SUV from Image 1, unchanged design and deep mineral forest-green paint, near-black roof and glass, graphite wheels
Style/medium: exceptionally polished photorealistic CGI product render
Composition/framing: wide landscape hero composition, vehicle dominant and fully visible, centered slightly low with generous breathing room above and around, approximately 32-degree lens feel, no dramatic distortion
Lighting/mood: one broad soft key, restrained fill and rim, clean premium highlights, calm and tactile
Materials/textures: metallic clearcoat paint, dark glass, satin trim, realistic tire rubber, subtle floor reflection
Constraints: preserve vehicle identity and every recognizable design feature from Image 1; no logos, badges, emblems, letters, numbers, license plate markings, text, watermark, people, props, dealership, or manufacturer-identifiable marks
Avoid: outdoor scenery, roads, motion blur, extreme wide angle, advertising copy, toy look, cyberpunk lighting, excessive reflections
```

### Rejected wheel-hub edit — not shipped

Referenced image:
`/Users/spaceman/Documents/Design and Viz/Universal Vehicle Configurator/scripts/asset-audit/source/vehicle-side-master.png`

```text
Edit only the two wheel-center hub caps in this exact transparent-background side-profile vehicle render. Remove every pseudo-letter, emblem, monogram, badge, symbol, or manufacturer-like mark from both wheel centers and replace each with a completely plain, unbranded circular dark graphite hub cap with a subtle neutral concentric highlight. Preserve the exact vehicle design, body shape, proportions, paint, wheels and spokes, tires, reflections, lighting, camera, cropping, resolution, transparency, and all other pixels as closely as possible. Do not add any text, logos, emblems, watermarks, symbols, or new details anywhere.
```

## Integrity record

### Reviewed masters

| Path | Dimensions/mode | SHA-256 |
| --- | --- | --- |
| `scripts/asset-audit/source/vehicle-side-master.png` | 1672×941 RGBA | `b87deeb666f33a3191d483c0b313318ca42ae8498b0c64ef5f8aaab9f8ea13da` |
| `scripts/asset-audit/source/vehicle-side-blueprint-master.png` | 1672×941 RGB | `1c9264166416a543f802e0bf72a6c5cc9479fc69a0cfc05d50f78c9b292ff497` |
| `scripts/asset-audit/source/showroom-master.png` | 1672×941 RGB | `108c97a730c610d57d696510e6010e7e2addb0073b44078a36b972460018feeb` |

The blueprint master is RGB because the generation response baked a preview
checkerboard. It is never shipped directly. The build derives a conservative
blueprint foreground matte and intersects it with the reviewed side silhouette;
the pixel audit verifies transparent corners, at least 96% registered coverage,
and that no blueprint alpha extends beyond the side layer.

### Shipped derivatives

| Path | Dimensions | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `public/images/showroom-fallback.webp` | 1600×900 | 92,128 | `05c73904dcca2354819f33f21fa775c1763047bae2ef44ddcedf3695db89f520` |
| `public/images/vehicle-side.webp` | 1600×900 | 122,378 | `477295f238b4c5c657276ae7ded9d0e02465d4184006930d27489763b3fa70f9` |
| `public/images/vehicle-side-blueprint.webp` | 1600×900 | 273,998 | `057c09e9fa39cfbea07d3894136e7469dd13800fce103e4df3dcd144b8583c80` |
| `public/images/vehicle-scan-mask.webp` | 1600×900 | 10,224 | `4f9cabec2f1f1ad9c5ab6d473b4f8b96114484b88aa112398023f9cea44aa1d0` |
| `public/images/vehicle-paint-mask.webp` | 1600×900 | 23,140 | `f1c57ed4f573af14f17ef7b60641a2afcf99af52c995f5644809a86b0b599057` |
| `public/images/representative-wheel-inset.webp` | 512×512 | 90,934 | `392b1cbfc2659665bd0a53067110e41a34f98eb7c06abd43fb142cd6eb9828d5` |

Total shipped safety-pack payload: **612,802 bytes**.

Rebuild and verify with:

```sh
python scripts/asset-audit/build-fallbacks.py
python scripts/asset-audit/verify-pixels.py
node scripts/asset-audit/verify-assets.mjs
```

The project uses the bundled workspace Python for Pillow. These commands do not
add a project dependency.
