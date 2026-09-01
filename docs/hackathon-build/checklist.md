# Hackathon build checklist

Updated: 2026-09-01

## Implemented in source

- [x] Original code-native procedural 3D vehicle retained as the resilient
  fallback.
- [x] Licensed OpenX Assets GLB shipped as the primary hero; exact
  source, attribution, license expression, and checksum recorded.
- [x] Audited GLB integrated under public assets and verified in the live
  showroom.
- [x] Live Angle, Profile, and Wheel showroom views.
- [x] Pointer/touch orbit and dolly plus keyboard orbit/reset.
- [x] Smooth camera presets, reduced-motion behavior, and paint, wheel,
  charge-port, and utility focus targets.
- [x] Live paint material, mapped wheel rim/inset treatment, and conditional
  tow-hitch geometry driven by configurator state.
- [x] Authored Blueprint and Interior presentations.
- [x] Automatic 2.5D fallback for loading, unsupported WebGL, render failure,
  and context loss.
- [x] Human controls and Site Tools connected to the same configuration and
  presentation state.

## Rights and representation

- [x] Both primary candidate and fallback are identified as representative
  compact-EV visuals, not a manufacturer-exact R2.
- [x] The only bundled third-party vehicle model is the audited OpenX Assets GLB
  recorded in the provenance document.
- [x] Ship the OpenX/artist attribution, MPL-2.0 and CC-BY-4.0 notices,
  source-form link, modification statement, and unofficial/unaffiliated caveat
  with the integrated GLB.
- [x] Rejected external candidates and their licenses are recorded in
  [`docs/asset-license.md`](../asset-license.md).
- [x] Authored 2.5D fallback provenance and integrity hashes are retained.

## Final demo verification

- [x] Complete final desktop and mobile visual QA after the shared live-3D
  integration settles.
- [ ] Confirm touch orbit, reduced motion, and WebGL-failure fallback on the
  deployed build.
- [ ] Capture the final demo using only claims supported by the implementation
  above.
