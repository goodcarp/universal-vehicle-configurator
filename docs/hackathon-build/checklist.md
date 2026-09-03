# AutoLab hackathon build checklist

Updated: 2026-09-03

## Combined experience

- [x] Unify the sales configurator and R2 owner drawing under **AutoLab by
  AutoMoto**, with one Configure/Garage lifecycle switch.
- [x] Make the code-native R2 the default body in every configurator view.
- [x] Carry build, paint, wheels, interior, range, price, and revision into the
  Garage digital twin.
- [x] Load Garage after showroom first paint, then keep it warm for instant
  agent choreography.
- [x] Bundle Garage's Three.js runtime locally; no rendering dependency on a
  CDN or remote font.
- [x] Keep direct human controls available on both surfaces.

## Agent surface

- [x] Expose 16 curated AutoLab WebMCP tools for configuration, buyer context,
  ownership math, comparisons, presentations, parts, motion, and measurement.
- [x] Expose the 14 lower-level drawing tools when Garage is opened directly.
- [x] Let an agent switch lifecycle surfaces, dissolve the body, frame and
  highlight a component, open the vehicle, or explode the assembly.
- [x] Preserve revision-safe configuration transactions, interruption, undo,
  and shareable URL state.
- [x] Keep claim provenance and incentive sources in tool responses.

## Verification

- [x] TypeScript passes.
- [x] ESLint passes; the embedded Garage runtime is treated as a self-contained
  browser artifact and excluded from the host TypeScript lint target.
- [x] Full suite passes: 108 tests.
- [x] Focused integration suite passes: 26 tests.
- [x] Production build completes.
- [x] Browser-confirm 16 host tools and 14 direct Garage tools.
- [x] Browser-confirm the configured Performance R2 context reaches Garage and
  the agent can reveal/frame the structural battery.
- [ ] Confirm touch orbit, reduced motion, and WebGL fallback on the deployed
  URL.
- [ ] Record the final demo and capture submission screenshots.

## Rights and representation

- [x] Default hero and Garage vehicle are the same independent procedural R2
  reconstruction fitted to published dimensions—not manufacturer CAD or a
  scan.
- [x] AutoLab is labeled independent, unofficial, and unaffiliated.
- [x] The optional licensed EX30 reference remains documented and attributed,
  but is not the default demo identity.
- [x] Bundled Three.js runtime retains its upstream MIT license header.
