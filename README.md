# Universal Vehicle Configurator

An unofficial WebMCP Challenge concept: a manufacturer-grade R2-inspired
vehicle configurator with buyer-grade intelligence.

The same revisioned configuration state drives the human UI, shareable URL,
live 3D showroom, pricing/range/delivery consequences, buyer context, and eight
page-defined WebMCP tools. Agents can inspect, simulate, apply, interrupt, undo,
and present changes while the person remains in control of the configurator.

## Local development

```sh
pnpm install
pnpm dev
```

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

The manual configurator remains fully usable when `document.modelContext` is
unavailable. When WebMCP is available, the page registers eight real tools:

- read the current build;
- list valid options;
- simulate a change without mutating state;
- apply an interruptible multi-stage transaction;
- interrupt an active transaction;
- undo the latest eligible agent transaction;
- direct showroom, camera, Blueprint, and focus presentation;
- capture buyer context without guessing.

Angle, Profile, and Wheel use a licensed compact-crossover GLB with live paint
and wheel treatment. A code-native procedural SUV is the load/error fallback;
Blueprint and Interior are authored presentation modes. See
[`docs/asset-license.md`](docs/asset-license.md) for complete attribution,
license notices, checksums, and representation limits.

This is an unofficial, unaffiliated concept. The reference geometry is not a
Rivian R2 and must not be presented as manufacturer-accurate.
