# Hackathon build notes

Updated: 2026-09-01

## Hero rendering decision

The selected primary hero is the licensed OpenX Assets Volvo EX30 GLB: an
unbadged, 59,354-triangle modern crossover with separate wheel and light nodes
and configurable PBR materials. Its recorded license expression is MPL-2.0 AND
CC-BY-4.0. The exact audited GLB is shipped under `public/models/` and has passed
runtime and visual verification.

The original code-native procedural 3D compact-EV concept now remains as the
resilient load/error fallback behind the licensed GLB. Both presentations are
representative rather than a manufacturer-exact Rivian R2, and the external
mesh must be presented as an unofficial, unaffiliated visualization.

The authored 2.5D safety pack remains valuable rather than discarded: it gives
the page an immediate first frame, supplies the Blueprint and Interior views,
and keeps every configurator control usable if WebGL is unavailable or fails.

## Implemented live experience

- Dynamically loaded WebGL showroom for Angle, Profile, and Wheel views.
- Pointer/touch orbit and dolly, keyboard orbit/reset, smooth camera presets,
  reduced-motion cuts, and targeted paint, wheel, charge-port, and utility
  focus states.
- Real-time body paint material changes.
- Wheel selections that adjust mapped stock rim/inset materials and
  representative rim scale without rewriting the source GLB.
- Tow selection that adds or removes hitch geometry.
- Studio lighting, environment reflections, ground/contact shadows, and a
  bounded device-pixel ratio for a polished but performance-aware presentation.
- Automatic procedural 3D fallback while the GLB loads or fails, plus authored
  fallback after unsupported, failed, or lost WebGL contexts.

Human UI changes and the configurator Site Tools use the same central mutation
and presentation state. An agent can therefore change the build and direct the
camera or Blueprint presentation while the user sees the result in the same
canvas.

## Honest scope boundary

Blueprint and Interior are authored presentations, not explorable live vehicle
geometry. The primary live model is an unbadged EX30-derived mesh; the original
compact-EV concept is its fallback. Neither should be described
as a manufacturer-accurate R2 clone or as endorsed by Rivian, Volvo, the model
artists, or OpenX Assets.

Final local production QA passed at desktop and 390 px / 430 px phone widths:
the licensed model loaded, the page exposed all eight WebMCP tools, there was
no horizontal overflow or runtime error, and the complete configuration flow
remained readable. The only console notice is an upstream Three.js `Clock`
deprecation warning. Hosting and recorded-demo verification remain separate
submission tasks.

The complete asset decision and rejected-candidate record is in
[`docs/asset-license.md`](../asset-license.md).
