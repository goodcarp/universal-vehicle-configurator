# AutoLab build notes

Updated: 2026-09-03

## Product decision

AutoLab is now one lifecycle experience rather than two adjacent prototypes.
**Configure** is the sales and buyer-intelligence surface. **Garage** is the
owner and service surface. Both use the code-native R2 engineering body carried
from the original drawing project, and both refer to one synchronized build
revision.

The top-level agent API is intentionally curated: 16 tools describe useful
customer outcomes instead of exposing every rendering primitive. The Garage
page still publishes 14 lower-level tools when opened directly, which makes the
framework legible to technical judges without making the shared experience
noisy.

## Implemented integration

- AutoLab identity, favicon, metadata, README, Configure/Garage navigation, and
  responsive shell.
- The full R2 digital-twin webapp embedded under `public/garage/`.
- A same-origin message bridge with origin/source/id validation and bounded
  response timeouts.
- State synchronization for build, paint, wheels, interior, range, total, and
  revision.
- Curated tools for twin state, component listing, part inspection, authored
  views, motion, and component measurement.
- Manual Garage shortcuts for the structural battery, vehicle openings, and
  exploded assembly.
- On-demand Garage loading: showroom 3D wins first paint, then the owner twin
  prewarms in the background.
- Local Three.js/add-on bundle, 1.35 DPR ceiling, 1024 px shadow map, 30 Hz
  technical render cadence, and hidden-tab suspension.

## Verified choreography

In the in-app browser, `get_vehicle_configuration` reported the code-native R2
Performance build at revision 1. `get_vehicle_twin_state` returned the same
build, Esker Silver, 21-inch wheels, Black Crater, 330-mile range, and $59,485
vehicle total. `inspect_vehicle_part` then switched the shared page to Garage,
dissolved the shell, framed the structural battery bounds, and highlighted the
part. The host exposed all 16 AutoLab tools; the direct Garage page exposed all
14 drawing tools.

## Honest boundary

The geometry is an independent procedural reconstruction fitted to Rivian's
published dimensions and independently authored visual references. It is not
Rivian CAD, a scan, or an official service model, and the site does not imply
manufacturer endorsement. The optional licensed EX30 reference remains in the
repository as an attributable alternate source but is not the default AutoLab
vehicle identity.

## Remaining submission work

Deployment, deployed-device fallback checks, the recorded demo, and Devpost
submission assets remain separate final-mile tasks.
