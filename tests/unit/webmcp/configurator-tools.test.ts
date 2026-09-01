import { afterEach, describe, expect, it, vi } from "vitest";
import catalogData from "../../../src/data/catalogs/r2.catalog.json";
import type { Catalog } from "../../../src/domain/catalog.types";
import { createConfiguratorStore } from "../../../src/state/configurator.store";
import { createMutationService } from "../../../src/state/mutation.service";
import {
  CONFIGURATOR_TOOL_NAMES,
  createConfiguratorPresentationController,
  createConfiguratorToolDefinitions,
  registerConfiguratorSiteTools,
  resetConfiguratorSiteToolsForTests,
  unregisterConfiguratorSiteTools,
  type ConfiguratorToolsDependencies,
} from "../../../src/webmcp/configurator-tools";

const catalog = catalogData as unknown as Catalog;

function setup(defaultStageDelayMs = 0): ConfiguratorToolsDependencies {
  const store = createConfiguratorStore(catalog);
  return {
    store,
    mutations: createMutationService(store, catalog, { defaultStageDelayMs }),
    presentation: createConfiguratorPresentationController(),
  };
}

function toolsByName(dependencies = setup()) {
  return new Map(
    createConfiguratorToolDefinitions(dependencies).map((tool) => [tool.name, tool]),
  );
}

describe("real configurator Site Tools", () => {
  afterEach(() => {
    delete document.modelContext;
    delete document.documentElement.dataset.siteTools;
    resetConfiguratorSiteToolsForTests();
  });

  it("registers the full Tier-1 surface once with one shared lifecycle signal", async () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    document.modelContext = { registerTool };
    const dependencies = setup();

    const first = registerConfiguratorSiteTools(dependencies);
    const second = registerConfiguratorSiteTools(dependencies);
    expect(first).toBe(second);
    await expect(first).resolves.toEqual({
      state: "ready",
      toolNames: CONFIGURATOR_TOOL_NAMES,
    });

    expect(registerTool).toHaveBeenCalledTimes(CONFIGURATOR_TOOL_NAMES.length);
    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual(
      CONFIGURATOR_TOOL_NAMES,
    );
    const signals = registerTool.mock.calls.map(([, options]) => options.signal);
    expect(new Set(signals).size).toBe(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[0].aborted).toBe(false);
    expect(document.documentElement.dataset.siteTools).toBe("ready");

    unregisterConfiguratorSiteTools();
    expect(signals[0].aborted).toBe(true);
  });

  it("keeps the manual configurator available when Site Tools are unsupported", async () => {
    await expect(registerConfiguratorSiteTools(setup())).resolves.toEqual({
      state: "unsupported",
      toolNames: [],
    });
    expect(document.documentElement.dataset.siteTools).toBe("unsupported");
  });

  it("aborts the shared registration if any tool is rejected", async () => {
    const registerTool = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new DOMException("Site Tools disabled", "NotAllowedError"));
    document.modelContext = { registerTool };

    await expect(registerConfiguratorSiteTools(setup())).resolves.toEqual({
      state: "degraded",
      toolNames: CONFIGURATOR_TOOL_NAMES.slice(0, 2),
      message: "Site Tools disabled",
    });
    const signal = registerTool.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(true);
    expect(document.documentElement.dataset.siteTools).toBe("degraded");
  });

  it("exposes closed schemas and truthful read tools against the live store", async () => {
    const definitions = createConfiguratorToolDefinitions(setup());
    expect(definitions.map((tool) => tool.name)).toEqual(CONFIGURATOR_TOOL_NAMES);
    expect(
      definitions.every(
        (tool) => tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);

    const tools = new Map(definitions.map((tool) => [tool.name, tool]));
    const current = await tools.get("get_vehicle_configuration")?.execute({});
    expect(current).toEqual(
      expect.objectContaining({
        ok: true,
        revision: 1,
        catalog: expect.objectContaining({ id: "rivian-r2-2026", model: "R2" }),
        configuration: expect.objectContaining({
          valid: true,
          selections: expect.objectContaining({
            build: ["build.performance"],
            wheels: ["wheels.lt21_as"],
          }),
          specs: expect.objectContaining({ range_mi: 330 }),
        }),
        transaction: { active: null, last: null, canUndo: false },
        presentation: {
          revision: 1,
          mode: "showroom",
          viewPreset: "angle",
          focus: "none",
        },
      }),
    );

    const options = await tools
      .get("list_vehicle_configuration_options")
      ?.execute({ groupId: "wheels" });
    expect(options).toEqual(
      expect.objectContaining({
        ok: true,
        revision: 1,
        groups: [
          expect.objectContaining({
            id: "wheels",
            selectedOptionIds: ["wheels.lt21_as"],
            options: expect.arrayContaining([
              expect.objectContaining({
                id: "wheels.bs20_at",
                validWithCurrentBuild: true,
                delta: expect.objectContaining({ rangeMiles: -23 }),
              }),
            ]),
          }),
        ],
      }),
    );
  });

  it("simulates without mutation, then applies and undoes one revisioned transaction", async () => {
    const dependencies = setup();
    const tools = toolsByName(dependencies);
    const simulation = await tools
      .get("simulate_vehicle_configuration_change")
      ?.execute({
        expectedRevision: 1,
        patch: { set: { wheels: ["wheels.bs20_at"] } },
      });
    expect(simulation).toEqual(
      expect.objectContaining({
        ok: true,
        currentRevision: 1,
        delta: expect.objectContaining({ rangeMiles: -23 }),
        candidate: expect.objectContaining({
          valid: true,
          specs: expect.objectContaining({ range_mi: 307 }),
        }),
      }),
    );
    expect(dependencies.store.getState().domain.revision).toBe(1);

    const applied = await tools
      .get("apply_vehicle_configuration_transaction")
      ?.execute({
        expectedRevision: 1,
        stages: [
          {
            label: "Choose Glacier White",
            patch: { set: { paint: ["paint.glacier_white"] } },
          },
          {
            label: "Fit all-terrain wheels",
            patch: { set: { wheels: ["wheels.bs20_at"] } },
          },
        ],
      });
    expect(applied).toEqual(
      expect.objectContaining({
        ok: true,
        receipt: expect.objectContaining({
          status: "completed",
          undoEligible: true,
          completedStages: [
            expect.objectContaining({ label: "Choose Glacier White", revision: 2 }),
            expect.objectContaining({ label: "Fit all-terrain wheels", revision: 3 }),
          ],
        }),
      }),
    );
    expect(dependencies.store.getState().resolved.specs.range_mi).toBe(307);

    const stale = await tools
      .get("simulate_vehicle_configuration_change")
      ?.execute({
        expectedRevision: 1,
        patch: { set: { paint: ["paint.esker_silver"] } },
      });
    expect(stale).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: "REVISION_CONFLICT", currentRevision: 3 }),
      }),
    );

    const undone = await tools
      .get("undo_vehicle_configuration_transaction")
      ?.execute({ expectedRevision: 3 });
    expect(undone).toEqual(
      expect.objectContaining({
        ok: true,
        revision: 4,
        transactionId: "tx-1-1",
      }),
    );
    expect(dependencies.store.getState().domain.selections.paint).toEqual([
      "paint.esker_silver",
    ]);
    expect(dependencies.store.getState().resolved.specs.range_mi).toBe(330);
  });

  it("sets explicit buyer context without inferring private facts", async () => {
    const dependencies = setup();
    const tool = toolsByName(dependencies).get("set_vehicle_buyer_context");

    const changed = await tool?.execute({
      expectedRevision: 1,
      patch: {
        evExperience: "new",
        state: "CO",
        utility: "xcel",
        chargingSituation: "home_l2_possible",
        useCases: ["road_trip", "snow"],
        priorities: ["range", "price"],
        financing: true,
        crossShopIds: ["model_y", "ioniq_5"],
      },
    });

    expect(changed).toEqual(
      expect.objectContaining({
        ok: true,
        revision: 2,
        buyerContext: {
          evExperience: "new",
          state: "CO",
          utility: "xcel",
          chargingSituation: "home_l2_possible",
          useCases: ["road_trip", "snow"],
          priorities: ["range", "price"],
          financing: true,
          crossShopIds: ["model_y", "ioniq_5"],
        },
        incentives: expect.objectContaining({ potentiallyApplicable: expect.any(Array) }),
      }),
    );
    expect(dependencies.store.getState().domain.buyerContext.state).toBe("CO");

    expect(() => tool?.execute({
      expectedRevision: 2,
      patch: { state: "Colorado" },
    })).toThrow("uppercase US postal code or unknown");
  });

  it("interrupts an in-flight staged transaction after the latest committed stage", async () => {
    const dependencies = setup(10_000);
    const tools = toolsByName(dependencies);
    const pending = tools.get("apply_vehicle_configuration_transaction")?.execute({
      expectedRevision: 1,
      stages: [
        {
          label: "Choose Glacier White",
          patch: { set: { paint: ["paint.glacier_white"] } },
        },
        {
          label: "Fit all-terrain wheels",
          patch: { set: { wheels: ["wheels.bs20_at"] } },
        },
        {
          label: "Switch the interior",
          patch: { set: { interior: ["interior.coastal_cloud"] } },
        },
      ],
    });

    expect(dependencies.store.getState().domain.revision).toBe(2);
    const interruption = await tools
      .get("interrupt_vehicle_configuration_transaction")
      ?.execute({ reason: "agent reconsidered recommendation" });
    expect(interruption).toEqual(
      expect.objectContaining({
        ok: true,
        interrupted: true,
        transactionId: "tx-1-1",
        revision: 2,
      }),
    );

    await expect(pending).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        receipt: expect.objectContaining({
          status: "interrupted",
          interruptionReason: "agent reconsidered recommendation",
          completedStages: [expect.objectContaining({ label: "Choose Glacier White" })],
          skippedStages: [
            expect.objectContaining({ label: "Fit all-terrain wheels" }),
            expect.objectContaining({ label: "Switch the interior" }),
          ],
        }),
      }),
    );
  });

  it("uses AbortSignal for execution cancellation before any state change", async () => {
    const dependencies = setup();
    const tools = toolsByName(dependencies);
    const controller = new AbortController();
    const reason = new Error("Agent stopped");
    controller.abort(reason);

    await expect(
      tools.get("apply_vehicle_configuration_transaction")?.execute(
        {
          expectedRevision: 1,
          stages: [
            {
              label: "Choose Glacier White",
              patch: { set: { paint: ["paint.glacier_white"] } },
            },
          ],
        },
        { signal: controller.signal },
      ),
    ).rejects.toBe(reason);
    expect(dependencies.store.getState().domain.revision).toBe(1);
  });

  it("bridges agent and manual presentation through one subscribable state", async () => {
    const dependencies = setup();
    const listener = vi.fn();
    const unsubscribe = dependencies.presentation.subscribe(listener);
    const tool = toolsByName(dependencies).get("present_vehicle_configuration");

    expect(
      tool?.execute({ mode: "blueprint", viewPreset: "angle", focus: "wheels" }),
    ).toEqual({
      ok: true,
      changed: true,
      presentation: {
        revision: 2,
        mode: "blueprint",
        viewPreset: "profile",
        focus: "wheels",
      },
    });
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "blueprint", viewPreset: "profile" }),
    );

    dependencies.presentation.setFromUser({
      mode: "showroom",
      viewPreset: "angle",
      focus: "none",
    });
    expect(dependencies.presentation.getState()).toEqual({
      revision: 3,
      mode: "showroom",
      viewPreset: "angle",
      focus: "none",
    });
    unsubscribe();
  });

  it("preserves one stable snapshot and the blueprint/profile invariant", () => {
    const controller = createConfiguratorPresentationController({
      mode: "blueprint",
      viewPreset: "angle",
    });
    const initial = controller.getState();
    expect(initial).toEqual({
      revision: 1,
      mode: "blueprint",
      viewPreset: "profile",
      focus: "none",
    });

    expect(controller.present({ mode: "blueprint" })).toBe(initial);
    expect(controller.getState()).toBe(initial);
  });

  it("rejects malformed direct invocations even if a host skips schema validation", async () => {
    const tools = toolsByName();
    expect(() =>
      tools.get("simulate_vehicle_configuration_change")?.execute({
        expectedRevision: 1,
        patch: { set: { wheels: ["paint.glacier_white"] } },
      }),
    ).toThrow("cannot assign option paint.glacier_white to group wheels");
    expect(() =>
      tools.get("present_vehicle_configuration")?.execute({}),
    ).toThrow("requires a presentation change");
    expect(() =>
      tools.get("get_vehicle_configuration")?.execute({ extra: true }),
    ).toThrow("unsupported field: extra");
  });
});
