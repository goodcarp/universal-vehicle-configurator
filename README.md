# Universal Vehicle Configurator

An unofficial WebMCP Challenge concept: a buyer-side R2-inspired vehicle
configurator where a person and an agent write to one revisioned state, and the
person always outranks the agent.

The same revisioned configuration state drives the human UI, shareable URL,
live 3D showroom, pricing/range/delivery consequences, buyer context, a sourced
incentive engine, and ten page-defined WebMCP tools. Agents can inspect,
simulate, apply, interrupt, undo, price, compare, and present changes while the
person remains in control of the configurator.

Every claim an agent can make is citable: incentive outcomes carry resolved
source records with titles, URLs and retrieval dates, and `get_vehicle_configuration`
returns a shareable permalink for the build it just described.

## For judges: running the agent experience

The page publishes its tools on `document.modelContext`, falling back to
`navigator.modelContext`. If the API appears after page load, the page picks it
up on its own and the header chip switches from **Manual mode** to
**10 agent tools** without a reload.

**Option A, ChatGPT desktop.** Update to the latest version, then open this
URL in the app's built-in browser. Ask it to read the current build.

**Option B, Chrome.** Enable the flag, restart Chrome, then load this URL:

```text
chrome://flags/#enable-webmcp-testing
```

Either way, click the header chip to see every registered tool and three
copyable starter prompts. Good ones to try:

- `Configure the cheapest R2 that can tow, then tell me what changed.`
- `I'm in Colorado, I'll finance, and I can install a home charger. What do I actually qualify for?`
- `Switch to the all-terrain wheels and show me the wheel close-up.`

While a multi-stage agent transaction is running, **click any control in the
right-hand rail**. The agent is interrupted after its last committed stage, and
the receipt panel shows exactly which stages landed and which were killed.

Without a WebMCP-capable browser the configurator remains fully usable by hand.

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

## The ten tools

- read the current build, price, incentives, and revision;
- list valid options;
- simulate a change without mutating state;
- apply an interruptible multi-stage transaction;
- interrupt an active transaction;
- undo the latest eligible agent transaction;
- direct showroom, camera, Blueprint, and focus presentation;
- capture buyer context without guessing;
- estimate financed payment, energy, and multi-year ownership cost;
- compare the current build against up to three alternatives.

Every mutating tool takes an `expectedRevision` and rejects on conflict, so an
agent cannot silently overwrite a change the person just made.

## Incentives

The incentive engine sorts every program into four buckets: matched, could
apply, expired, and does not apply. It never reports eligibility, only which
encoded predicates matched, and it names the buyer facts it refuses to guess.
Set your state, utility, home charging, and payment method in the rail and the
Review sheet recalculates with dated sources for each program.

## Rendering

Angle, Profile, and Wheel use a licensed compact-crossover GLB with live paint
and wheel treatment. Authored same-model captures cover the window before the
GLB finishes loading and the unsupported-WebGL and context-loss paths; the
licensed GLB is the only vehicle identity that ever appears. Blueprint and
Interior are presentation treatments of that same geometry. See
[`docs/asset-license.md`](docs/asset-license.md) for complete attribution,
license notices, checksums, and representation limits.

This is an unofficial, unaffiliated concept, not associated with or endorsed by
Rivian, Volvo, OpenX Assets, or the model's authors. The reference geometry is
not a Rivian R2 and must not be presented as manufacturer-accurate.
