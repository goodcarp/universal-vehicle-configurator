import type {
  BuyerContext,
  CanonicalSelections,
  Catalog,
  CatalogGroup,
  SelectionPatch,
} from "../domain/catalog.types";
import {
  configuratorMutations,
  configuratorStore,
  type ConfiguratorStore,
  type ConfiguratorStoreState,
  type ConfigurationStage,
  type MutationService,
} from "../state";

export const CONFIGURATOR_TOOL_NAMES = [
  "get_vehicle_configuration",
  "list_vehicle_configuration_options",
  "simulate_vehicle_configuration_change",
  "apply_vehicle_configuration_transaction",
  "interrupt_vehicle_configuration_transaction",
  "undo_vehicle_configuration_transaction",
  "present_vehicle_configuration",
] as const;

export type ConfiguratorToolName = (typeof CONFIGURATOR_TOOL_NAMES)[number];

export type ConfiguratorPresentationMode = "showroom" | "blueprint";
export type ConfiguratorViewPreset = "angle" | "profile" | "wheel" | "interior";
export type ConfiguratorFocus =
  | "none"
  | "paint"
  | "charge-port"
  | "wheels"
  | "utility";

export interface ConfiguratorPresentationState {
  revision: number;
  mode: ConfiguratorPresentationMode;
  viewPreset: ConfiguratorViewPreset;
  focus: ConfiguratorFocus;
}

export interface ConfiguratorPresentationPatch {
  mode?: ConfiguratorPresentationMode;
  viewPreset?: ConfiguratorViewPreset;
  focus?: ConfiguratorFocus;
}

export interface ConfiguratorPresentationController {
  getState(): ConfiguratorPresentationState;
  present(
    patch: ConfiguratorPresentationPatch,
    options?: { signal?: AbortSignal },
  ): ConfiguratorPresentationState;
  setFromUser(patch: ConfiguratorPresentationPatch): ConfiguratorPresentationState;
  subscribe(listener: (state: ConfiguratorPresentationState) => void): () => void;
}

export interface ConfiguratorToolsDependencies {
  store: ConfiguratorStore;
  mutations: MutationService;
  presentation: ConfiguratorPresentationController;
}

export type ConfiguratorSiteToolsStatus =
  | { state: "unsupported"; toolNames: readonly [] }
  | { state: "registering"; toolNames: readonly [] }
  | { state: "ready"; toolNames: readonly ConfiguratorToolName[] }
  | {
      state: "degraded";
      toolNames: readonly ConfiguratorToolName[];
      message: string;
    };

type ToolDefinition = ModelContextTool<Record<string, unknown>>;

const EMPTY_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

const PRESENTATION_MODES = ["showroom", "blueprint"] as const;
const VIEW_PRESETS = ["angle", "profile", "wheel", "interior"] as const;
const FOCUS_TARGETS = [
  "none",
  "paint",
  "charge-port",
  "wheels",
  "utility",
] as const;

const defaultDependencies: ConfiguratorToolsDependencies = {
  store: configuratorStore,
  mutations: configuratorMutations,
  presentation: createConfiguratorPresentationController(),
};

export const configuratorPresentation = defaultDependencies.presentation;

let registration: Promise<ConfiguratorSiteToolsStatus> | undefined;
let registrationController: AbortController | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, toolName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${toolName} expects a JSON object.`);
  }
  return value;
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  toolName: string,
) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new TypeError(
      `${toolName} received unsupported field${unexpected.length === 1 ? "" : "s"}: ${unexpected.join(", ")}.`,
    );
  }
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Tool execution was aborted.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortReason(signal);
}

function parseExpectedRevision(value: unknown, toolName: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new TypeError(`${toolName} requires expectedRevision as a positive safe integer.`);
  }
  return value as number;
}

function groupMap(catalog: Catalog): Map<string, CatalogGroup> {
  return new Map(catalog.groups.map((group) => [group.id, group]));
}

function parsePatch(
  value: unknown,
  catalog: Catalog,
  toolName: string,
): SelectionPatch {
  const patch = assertRecord(value, toolName);
  assertOnlyKeys(patch, ["set"], toolName);
  const set = assertRecord(patch.set, toolName);
  if (Object.keys(set).length < 1) {
    throw new TypeError(`${toolName} requires at least one group in patch.set.`);
  }

  const groups = groupMap(catalog);
  const parsedSet: Record<string, string[]> = {};
  for (const [groupId, optionIds] of Object.entries(set)) {
    const group = groups.get(groupId);
    if (!group) {
      throw new TypeError(`${toolName} does not recognize configuration group ${groupId}.`);
    }
    if (!Array.isArray(optionIds) || optionIds.some((id) => typeof id !== "string")) {
      throw new TypeError(`${toolName} requires ${groupId} to be an array of option IDs.`);
    }
    if (group.required && optionIds.length < 1) {
      throw new TypeError(`${toolName} cannot clear required group ${groupId}.`);
    }
    if (group.select === "one" && optionIds.length > 1) {
      throw new TypeError(`${toolName} accepts at most one option for ${groupId}.`);
    }
    if (new Set(optionIds).size !== optionIds.length) {
      throw new TypeError(`${toolName} received duplicate options for ${groupId}.`);
    }

    const validOptions = new Set(
      catalog.options
        .filter((option) => option.group === groupId)
        .map((option) => option.id),
    );
    const invalidOption = optionIds.find((id) => !validOptions.has(id));
    if (invalidOption) {
      throw new TypeError(
        `${toolName} cannot assign option ${invalidOption} to group ${groupId}.`,
      );
    }
    parsedSet[groupId] = [...optionIds];
  }

  return { set: parsedSet };
}

function cloneSelections(selections: CanonicalSelections): CanonicalSelections {
  return Object.fromEntries(
    Object.entries(selections).map(([groupId, optionIds]) => [groupId, [...optionIds]]),
  );
}

function cloneBuyerContext(context: BuyerContext): BuyerContext {
  return {
    ...context,
    useCases: [...context.useCases],
    priorities: [...context.priorities],
    crossShopIds: [...context.crossShopIds],
  };
}

function compactConfiguration(state: ConfiguratorStoreState) {
  const selected = new Set(state.resolved.selectedOptionIds);
  return {
    revision: state.domain.revision,
    catalog: {
      id: state.catalog.product.id,
      make: state.catalog.product.make,
      model: state.catalog.product.model,
      year: state.catalog.product.year,
      market: state.catalog.product.market,
      currency: state.catalog.product.currency ?? "USD",
      dataAsOf: state.catalog.product.data_as_of,
    },
    configuration: {
      valid: state.resolved.valid,
      selections: cloneSelections(state.domain.selections),
      selectedOptions: state.catalog.options
        .filter((option) => selected.has(option.id))
        .map((option) => ({
          id: option.id,
          groupId: option.group,
          label: option.label,
          orderability: option.orderability,
        })),
      price: state.resolved.price,
      specs: { ...state.resolved.specs },
      delivery: state.resolved.delivery,
      incentives: state.resolved.incentives,
      violations: [...state.resolved.violations],
    },
    buyerContext: cloneBuyerContext(state.domain.buyerContext),
  };
}

function transactionState(state: ConfiguratorStoreState) {
  const canUndo =
    state.session.undo !== null &&
    state.session.undo.afterRevision === state.domain.revision;
  return {
    active: state.session.activeAgentTransaction,
    last: state.session.lastTransaction,
    canUndo,
  };
}

function patchSchema(catalog: Catalog): Record<string, unknown> {
  const properties = Object.fromEntries(
    catalog.groups.map((group) => {
      const optionIds = catalog.options
        .filter((option) => option.group === group.id)
        .map((option) => option.id);
      return [
        group.id,
        {
          type: "array",
          items: { type: "string", enum: optionIds },
          minItems: group.required ? 1 : 0,
          maxItems: group.select === "one" ? 1 : optionIds.length,
          uniqueItems: true,
        },
      ];
    }),
  );

  return {
    type: "object",
    properties: {
      set: {
        type: "object",
        properties,
        minProperties: 1,
        additionalProperties: false,
      },
    },
    required: ["set"],
    additionalProperties: false,
  };
}

function errorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Configurator Site Tools registration failed.";
}

function setDocumentStatus(status: ConfiguratorSiteToolsStatus) {
  document.documentElement.dataset.siteTools = status.state;
}

export function createConfiguratorPresentationController(
  initial: Partial<ConfiguratorPresentationState> = {},
): ConfiguratorPresentationController {
  const initialMode = initial.mode ?? "showroom";
  const initialViewPreset = initial.viewPreset ?? "angle";
  let state: ConfiguratorPresentationState = {
    revision: initial.revision ?? 1,
    mode: initialMode,
    viewPreset:
      initialMode === "blueprint" && ["angle", "interior"].includes(initialViewPreset)
        ? "profile"
        : initialViewPreset,
    focus: initial.focus ?? "none",
  };
  const listeners = new Set<(state: ConfiguratorPresentationState) => void>();

  const update = (patch: ConfiguratorPresentationPatch) => {
    const mode = patch.mode ?? state.mode;
    let viewPreset = patch.viewPreset ?? state.viewPreset;
    if (mode === "blueprint" && (viewPreset === "angle" || viewPreset === "interior")) {
      viewPreset = "profile";
    }
    if (mode === "showroom" && patch.viewPreset === "angle") viewPreset = "angle";
    const focus = patch.focus ?? state.focus;
    if (mode === state.mode && viewPreset === state.viewPreset && focus === state.focus) {
      return state;
    }
    state = { revision: state.revision + 1, mode, viewPreset, focus };
    listeners.forEach((listener) => listener(state));
    return state;
  };

  return {
    getState: () => state,
    present: (patch, options) => {
      throwIfAborted(options?.signal);
      return update(patch);
    },
    setFromUser: update,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createConfiguratorToolDefinitions(
  dependencies: ConfiguratorToolsDependencies,
): readonly ToolDefinition[] {
  const { store, mutations, presentation } = dependencies;
  const catalog = store.getState().catalog;
  const selectionPatchSchema = patchSchema(catalog);
  const expectedRevisionSchema = { type: "integer", minimum: 1 } as const;

  const getConfiguration: ToolDefinition = {
    name: CONFIGURATOR_TOOL_NAMES[0],
    title: "Get current vehicle configuration",
    description:
      "Read the current vehicle build, buyer context, price, range, delivery status, revision, transaction status, and presentation state. Call this before making a change so expectedRevision is current.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: (input, options) => {
      throwIfAborted(options?.signal);
      const record = assertRecord(input, CONFIGURATOR_TOOL_NAMES[0]);
      assertOnlyKeys(record, [], CONFIGURATOR_TOOL_NAMES[0]);
      const state = store.getState();
      return {
        ok: true,
        ...compactConfiguration(state),
        transaction: transactionState(state),
        presentation: presentation.getState(),
      };
    },
  };

  const listOptions: ToolDefinition = {
    name: CONFIGURATOR_TOOL_NAMES[1],
    title: "List vehicle configuration options",
    description:
      "List real options for one configuration group or all groups, including the current selection and whether each candidate resolves into a valid build.",
    inputSchema: {
      type: "object",
      properties: {
        groupId: {
          type: "string",
          enum: catalog.groups.map((group) => group.id),
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: (input, options) => {
      throwIfAborted(options?.signal);
      const record = assertRecord(input, CONFIGURATOR_TOOL_NAMES[1]);
      assertOnlyKeys(record, ["groupId"], CONFIGURATOR_TOOL_NAMES[1]);
      if (record.groupId !== undefined && typeof record.groupId !== "string") {
        throw new TypeError(`${CONFIGURATOR_TOOL_NAMES[1]} requires groupId as a string.`);
      }
      const groupId = record.groupId as string | undefined;
      if (groupId && !catalog.groups.some((group) => group.id === groupId)) {
        throw new TypeError(`${CONFIGURATOR_TOOL_NAMES[1]} does not recognize group ${groupId}.`);
      }

      const state = store.getState();
      const groups = catalog.groups.filter((group) => !groupId || group.id === groupId);
      return {
        ok: true,
        revision: state.domain.revision,
        groups: groups.map((group) => ({
          id: group.id,
          label: group.label,
          select: group.select,
          required: group.required ?? false,
          selectedOptionIds: [...(state.domain.selections[group.id] ?? [])],
          options: catalog.options
            .filter((option) => option.group === group.id)
            .map((option) => {
              const simulation = mutations.simulateConfiguration({
                expectedRevision: state.domain.revision,
                patch: { set: { [group.id]: [option.id] } },
              });
              return {
                id: option.id,
                label: option.label,
                selected: state.domain.selections[group.id]?.includes(option.id) ?? false,
                orderability: option.orderability,
                visualStatus: option.visualStatus,
                price: option.price,
                copy: option.copy,
                validWithCurrentBuild:
                  simulation.ok && simulation.candidate.valid,
                ...(simulation.ok
                  ? {
                      delta: simulation.delta,
                      violations: simulation.candidate.violations,
                    }
                  : { error: simulation.error }),
              };
            }),
        })),
      };
    },
  };

  const simulateChange: ToolDefinition = {
    name: CONFIGURATOR_TOOL_NAMES[2],
    title: "Simulate vehicle configuration change",
    description:
      "Preview an atomic option change without altering the build. Returns exact price, range, delivery, validity, and compatible-alternative consequences at expectedRevision.",
    inputSchema: {
      type: "object",
      properties: {
        expectedRevision: expectedRevisionSchema,
        patch: selectionPatchSchema,
      },
      required: ["expectedRevision", "patch"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: (input, options) => {
      throwIfAborted(options?.signal);
      const record = assertRecord(input, CONFIGURATOR_TOOL_NAMES[2]);
      assertOnlyKeys(record, ["expectedRevision", "patch"], CONFIGURATOR_TOOL_NAMES[2]);
      const expectedRevision = parseExpectedRevision(
        record.expectedRevision,
        CONFIGURATOR_TOOL_NAMES[2],
      );
      const patch = parsePatch(record.patch, catalog, CONFIGURATOR_TOOL_NAMES[2]);
      return mutations.simulateConfiguration({ expectedRevision, patch });
    },
  };

  const applyTransaction: ToolDefinition = {
    name: CONFIGURATOR_TOOL_NAMES[3],
    title: "Apply vehicle configuration transaction",
    description:
      "Apply one to four validated configuration stages through the live mutation service. Each visible stage is revision-safe, interruptible, and captured in one undoable receipt.",
    inputSchema: {
      type: "object",
      properties: {
        expectedRevision: expectedRevisionSchema,
        stages: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              label: { type: "string", minLength: 1, maxLength: 60 },
              patch: selectionPatchSchema,
            },
            required: ["label", "patch"],
            additionalProperties: false,
          },
        },
      },
      required: ["expectedRevision", "stages"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input, options) => {
      throwIfAborted(options?.signal);
      const record = assertRecord(input, CONFIGURATOR_TOOL_NAMES[3]);
      assertOnlyKeys(record, ["expectedRevision", "stages"], CONFIGURATOR_TOOL_NAMES[3]);
      const expectedRevision = parseExpectedRevision(
        record.expectedRevision,
        CONFIGURATOR_TOOL_NAMES[3],
      );
      if (!Array.isArray(record.stages) || record.stages.length < 1 || record.stages.length > 4) {
        throw new TypeError(`${CONFIGURATOR_TOOL_NAMES[3]} requires one to four stages.`);
      }
      const stages: ConfigurationStage[] = record.stages.map((value, index) => {
        const stage = assertRecord(value, CONFIGURATOR_TOOL_NAMES[3]);
        assertOnlyKeys(stage, ["label", "patch"], CONFIGURATOR_TOOL_NAMES[3]);
        if (
          typeof stage.label !== "string" ||
          stage.label.length < 1 ||
          stage.label.length > 60
        ) {
          throw new TypeError(
            `${CONFIGURATOR_TOOL_NAMES[3]} stage ${index + 1} requires a 1–60 character label.`,
          );
        }
        return {
          label: stage.label,
          patch: parsePatch(stage.patch, catalog, CONFIGURATOR_TOOL_NAMES[3]),
        };
      });
      return mutations.applyAgentTransaction({
        expectedRevision,
        stages,
        signal: options?.signal,
      });
    },
  };

  const interruptTransaction: ToolDefinition = {
    name: CONFIGURATOR_TOOL_NAMES[4],
    title: "Interrupt vehicle configuration transaction",
    description:
      "Stop any currently active agent configuration transaction after its latest committed stage. Completed stages remain visible and may be undone from the returned current revision.",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string", minLength: 1, maxLength: 80 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (input, options) => {
      throwIfAborted(options?.signal);
      const record = assertRecord(input, CONFIGURATOR_TOOL_NAMES[4]);
      assertOnlyKeys(record, ["reason"], CONFIGURATOR_TOOL_NAMES[4]);
      if (
        record.reason !== undefined &&
        (typeof record.reason !== "string" ||
          record.reason.length < 1 ||
          record.reason.length > 80)
      ) {
        throw new TypeError(`${CONFIGURATOR_TOOL_NAMES[4]} reason must be 1–80 characters.`);
      }
      const before = store.getState().session.activeAgentTransaction;
      const interrupted = mutations.interruptAgentTransaction(
        (record.reason as string | undefined) ?? "agent_requested_stop",
      );
      const state = store.getState();
      return {
        ok: true,
        interrupted,
        transactionId: before?.id ?? null,
        revision: state.domain.revision,
        activeTransaction: state.session.activeAgentTransaction,
      };
    },
  };

  const undoTransaction: ToolDefinition = {
    name: CONFIGURATOR_TOOL_NAMES[5],
    title: "Undo last vehicle configuration transaction",
    description:
      "Undo the latest eligible agent configuration transaction atomically. Requires the current expectedRevision and never undoes a human change.",
    inputSchema: {
      type: "object",
      properties: { expectedRevision: expectedRevisionSchema },
      required: ["expectedRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (input, options) => {
      throwIfAborted(options?.signal);
      const record = assertRecord(input, CONFIGURATOR_TOOL_NAMES[5]);
      assertOnlyKeys(record, ["expectedRevision"], CONFIGURATOR_TOOL_NAMES[5]);
      return mutations.undoLastAgentTransaction({
        expectedRevision: parseExpectedRevision(
          record.expectedRevision,
          CONFIGURATOR_TOOL_NAMES[5],
        ),
      });
    },
  };

  const presentConfiguration: ToolDefinition = {
    name: CONFIGURATOR_TOOL_NAMES[6],
    title: "Present vehicle configuration",
    description:
      "Move the shared vehicle canvas to showroom or blueprint mode, choose an angle/profile/wheel/interior view, and optionally focus a truthful vehicle hotspot. This changes presentation only, never the selected build.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: PRESENTATION_MODES },
        viewPreset: { type: "string", enum: VIEW_PRESETS },
        focus: { type: "string", enum: FOCUS_TARGETS },
      },
      minProperties: 1,
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (input, options) => {
      throwIfAborted(options?.signal);
      const record = assertRecord(input, CONFIGURATOR_TOOL_NAMES[6]);
      assertOnlyKeys(record, ["mode", "viewPreset", "focus"], CONFIGURATOR_TOOL_NAMES[6]);
      if (Object.keys(record).length < 1) {
        throw new TypeError(`${CONFIGURATOR_TOOL_NAMES[6]} requires a presentation change.`);
      }
      if (
        record.mode !== undefined &&
        !PRESENTATION_MODES.includes(record.mode as ConfiguratorPresentationMode)
      ) {
        throw new TypeError(`${CONFIGURATOR_TOOL_NAMES[6]} received an unsupported mode.`);
      }
      if (
        record.viewPreset !== undefined &&
        !VIEW_PRESETS.includes(record.viewPreset as ConfiguratorViewPreset)
      ) {
        throw new TypeError(`${CONFIGURATOR_TOOL_NAMES[6]} received an unsupported viewPreset.`);
      }
      if (
        record.focus !== undefined &&
        !FOCUS_TARGETS.includes(record.focus as ConfiguratorFocus)
      ) {
        throw new TypeError(`${CONFIGURATOR_TOOL_NAMES[6]} received an unsupported focus.`);
      }
      const previous = presentation.getState();
      const next = presentation.present(
        {
          mode: record.mode as ConfiguratorPresentationMode | undefined,
          viewPreset: record.viewPreset as ConfiguratorViewPreset | undefined,
          focus: record.focus as ConfiguratorFocus | undefined,
        },
        { signal: options?.signal },
      );
      return { ok: true, changed: next !== previous, presentation: next };
    },
  };

  return [
    getConfiguration,
    listOptions,
    simulateChange,
    applyTransaction,
    interruptTransaction,
    undoTransaction,
    presentConfiguration,
  ];
}

async function register(
  dependencies: ConfiguratorToolsDependencies,
): Promise<ConfiguratorSiteToolsStatus> {
  const modelContext = document.modelContext;
  if (window.top !== window || typeof modelContext?.registerTool !== "function") {
    const status = { state: "unsupported", toolNames: [] } as const;
    setDocumentStatus(status);
    return status;
  }

  const registering = { state: "registering", toolNames: [] } as const;
  setDocumentStatus(registering);
  const controller = new AbortController();
  registrationController = controller;
  const registeredToolNames: ConfiguratorToolName[] = [];

  try {
    for (const tool of createConfiguratorToolDefinitions(dependencies)) {
      await modelContext.registerTool(tool, { signal: controller.signal });
      registeredToolNames.push(tool.name as ConfiguratorToolName);
    }
    const status = {
      state: "ready",
      toolNames: [...registeredToolNames],
    } as const;
    setDocumentStatus(status);
    return status;
  } catch (error) {
    controller.abort();
    if (registrationController === controller) registrationController = undefined;
    const status = {
      state: "degraded",
      toolNames: [...registeredToolNames],
      message: errorMessage(error),
    } as const;
    setDocumentStatus(status);
    return status;
  }
}

export function registerConfiguratorSiteTools(
  dependencies: ConfiguratorToolsDependencies = defaultDependencies,
): Promise<ConfiguratorSiteToolsStatus> {
  registration ??= register(dependencies);
  return registration;
}

export function unregisterConfiguratorSiteTools() {
  registrationController?.abort();
  registrationController = undefined;
  registration = undefined;
}

export function resetConfiguratorSiteToolsForTests() {
  unregisterConfiguratorSiteTools();
}

if (import.meta.hot) {
  import.meta.hot.dispose(unregisterConfiguratorSiteTools);
}
