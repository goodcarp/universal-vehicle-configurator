import { Check, CircleDashed, Copy, Share2, Sparkles, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { VehicleConfigurator } from "../features/configurator";
import {
  VehicleCanvas,
  type VehicleCanvasMode,
  type VehicleHotspot,
  type VehicleHotspotId,
  type VehicleViewPreset,
} from "../features/vehicle-canvas";
import { SCENE_MANIFEST } from "../scene/scene-manifest";
import {
  applyShareStateToHistory,
  bindShareStatePopstate,
  configuratorMutations,
  configuratorStore,
  restoreShareStateFromSearch,
  r2Catalog,
  selectCanUndo,
  selectResolved,
  selectRevision,
  useConfiguratorStore,
} from "../state";
import {
  configuratorPresentation,
  registerConfiguratorSiteTools,
  type ConfiguratorSiteToolsStatus,
} from "../webmcp/configurator-tools";
import "./configurator-shell.css";
import {
  formatCurrency,
  selectedOption,
  shortBuildLabel,
  vehicleInterior,
  vehiclePaint,
  vehicleWheel,
} from "./presentation";

const INITIAL_TOOL_STATUS: ConfiguratorSiteToolsStatus = {
  state: "registering",
  toolNames: [],
};

type ChangeNotice = {
  title: string;
  detail: string;
};

function ToolStatus({ status }: { status: ConfiguratorSiteToolsStatus }) {
  const ready = status.state === "ready";
  const label = ready
    ? `${status.toolNames.length} agent tools`
    : status.state === "unsupported"
      ? "Manual mode"
      : status.state === "degraded"
        ? "Agent unavailable"
        : "Connecting agent";

  return (
    <span className="header-action" data-state={status.state} aria-live="polite">
      {ready ? <Check aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}

export function App() {
  const catalog = useConfiguratorStore((state) => state.catalog);
  const domain = useConfiguratorStore((state) => state.domain);
  const resolved = useConfiguratorStore(selectResolved);
  const revision = useConfiguratorStore(selectRevision);
  const canUndo = useConfiguratorStore(selectCanUndo);
  const activeAgentTransaction = useConfiguratorStore(
    (state) => state.session.activeAgentTransaction,
  );
  const [siteTools, setSiteTools] = useState<ConfiguratorSiteToolsStatus>(INITIAL_TOOL_STATUS);
  const [presentation, setPresentation] = useState(() => configuratorPresentation.getState());
  const [changeNotice, setChangeNotice] = useState<ChangeNotice | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    void registerConfiguratorSiteTools().then(setSiteTools);
  }, []);

  useEffect(() => configuratorPresentation.subscribe(setPresentation), []);

  useEffect(() => {
    if (window.location.search) {
      restoreShareStateFromSearch(
        r2Catalog,
        configuratorStore,
        configuratorMutations,
        window.location.search,
      );
    }
    const unbind = bindShareStatePopstate(
      r2Catalog,
      configuratorStore,
      configuratorMutations,
    );
    return unbind;
  }, []);

  useEffect(() => {
    applyShareStateToHistory(catalog, configuratorStore.getState().domain, {
      mode: "replace",
    });
  }, [catalog, domain]);

  useEffect(() => {
    if (!changeNotice) return;
    const timer = window.setTimeout(() => setChangeNotice(null), 2_800);
    return () => window.clearTimeout(timer);
  }, [changeNotice]);

  const buildOption = selectedOption(catalog, resolved, "build");
  const paintOption = selectedOption(catalog, resolved, "paint");
  const wheelOption = selectedOption(catalog, resolved, "wheels");
  const interiorOption = selectedOption(catalog, resolved, "interior");
  const towingOption = selectedOption(catalog, resolved, "towing");
  const paint = vehiclePaint(paintOption);
  const wheel = vehicleWheel(wheelOption);
  const interior = vehicleInterior(interiorOption);
  const canvasMode: VehicleCanvasMode = presentation.mode;
  const viewPreset: VehicleViewPreset = presentation.viewPreset;
  const activeHotspot: VehicleHotspotId | null =
    presentation.focus === "none" ? null : presentation.focus;

  const hotspots: VehicleHotspot[] = [
    {
      id: "paint",
      label: "Exterior finish",
      detail: `${paintOption?.label ?? "Representative finish"} · selection rendered on the authored concept`,
      anchor: SCENE_MANIFEST.anchors.bodyPaint,
      accuracy: "representative",
    },
    {
      id: "charge-port",
      label: "Charging setup",
      detail: "Home-charging setup is tracked outside vehicle MSRP.",
      anchor: SCENE_MANIFEST.anchors.chargePort,
      accuracy: "representative",
    },
    {
      id: "wheels",
      label: "Wheel package",
      detail: `${wheelOption?.label ?? "Representative wheel"} · ${wheel.diameterInches} in`,
      anchor: SCENE_MANIFEST.anchors.frontWheel,
      accuracy: "representative",
    },
    {
      id: "utility",
      label: "Rear utility",
      detail: towingOption?.label ?? "No tow package selected",
      anchor: SCENE_MANIFEST.anchors.rearHitch,
      accuracy: "representative",
    },
  ];

  const handleShare = async () => {
    const url = applyShareStateToHistory(catalog, configuratorStore.getState().domain, {
      mode: "replace",
    });
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
      window.setTimeout(() => setShareStatus("idle"), 1_800);
    } catch {
      window.history.replaceState(null, "", url);
    }
  };

  const handleUndo = () => {
    const result = configuratorMutations.undoLastAgentTransaction({
      expectedRevision: configuratorStore.getState().domain.revision,
    });
    if (result.ok) {
      setChangeNotice({
        title: "Agent changes undone",
        detail: `Restored configuration · revision ${result.revision}`,
      });
    }
  };

  return (
    <main className="configurator-shell">
      <header className="configurator-header">
        <a className="configurator-header__brand" href="/" aria-label="Universal home">
          <span className="configurator-header__mark" aria-hidden="true">U</span>
          <span>Universal</span>
        </a>

        <div className="configurator-header__model">
          <span>R2 / Build</span>
          <strong>{shortBuildLabel(buildOption)}</strong>
          <span>Rev {revision}</span>
        </div>

        <div className="configurator-header__actions">
          {activeAgentTransaction && (
            <span className="header-action" data-state="ready">
              <Sparkles aria-hidden="true" />
              <span>
                Agent configuring {activeAgentTransaction.completedCount}/{activeAgentTransaction.stageCount}
              </span>
            </span>
          )}
          {canUndo && (
            <button className="header-action" type="button" onClick={handleUndo}>
              <Undo2 aria-hidden="true" /> <span>Undo agent</span>
            </button>
          )}
          <button className="header-action" type="button" onClick={() => void handleShare()}>
            {shareStatus === "copied" ? <Copy aria-hidden="true" /> : <Share2 aria-hidden="true" />}
            <span>{shareStatus === "copied" ? "Link copied" : "Share"}</span>
          </button>
          <ToolStatus status={siteTools} />
        </div>
      </header>

      <section className="configurator-workspace" aria-label="Vehicle configuration workspace">
        <div className="configurator-viewport">
          <VehicleCanvas
            paint={paint}
            wheel={wheel}
            interior={interior}
            accessories={{ towHitch: Boolean(resolved.specs.tow_hitch) }}
            mode={canvasMode}
            viewPreset={viewPreset}
            activeHotspotId={activeHotspot}
            hotspots={hotspots}
            onModeChange={(mode) => configuratorPresentation.setFromUser({ mode })}
            onViewPresetChange={(nextViewPreset) =>
              configuratorPresentation.setFromUser({ viewPreset: nextViewPreset })
            }
            onHotspotChange={(hotspot) =>
              configuratorPresentation.setFromUser({ focus: hotspot ?? "none" })
            }
          />

          {changeNotice && (
            <aside className="configuration-change" aria-live="polite">
              <Sparkles aria-hidden="true" />
              <div>
                <strong>{changeNotice.title}</strong>
                <span>{changeNotice.detail}</span>
              </div>
              <button type="button" onClick={() => setChangeNotice(null)} aria-label="Dismiss change summary">
                <X aria-hidden="true" />
              </button>
            </aside>
          )}

          <div className="configuration-facts" aria-label="Current configuration quick facts">
            <span><small>Vehicle total</small><strong>{formatCurrency(resolved.price.vehicleTotal)}</strong></span>
            <span><small>Range</small><strong>{String(resolved.specs.range_mi ?? "—")} mi</strong></span>
            <span><small>Interior</small><strong>{interiorOption?.label ?? "—"}</strong></span>
          </div>
        </div>

        <aside className="configurator-rail" aria-label="Configuration choices">
          <div className="configurator-rail__inner">
            <VehicleConfigurator
              catalog={catalog}
              selections={domain.selections}
              buyerContext={domain.buyerContext}
              onSelectionPatch={(patch, meta) => {
                const before = configuratorStore.getState().resolved;
                const result = configuratorMutations.applyHumanPatch({
                  expectedRevision: configuratorStore.getState().domain.revision,
                  patch,
                });
                if (!result.ok) return;

                const changedGroup = meta.primaryGroup;
                const nextId = patch.set[changedGroup]?.[0];
                const nextOption = catalog.options.find((option) => option.id === nextId);
                const beforeRange = typeof before.specs.range_mi === "number" ? before.specs.range_mi : null;
                const nextRange = typeof meta.candidate.specs.range_mi === "number"
                  ? meta.candidate.specs.range_mi
                  : null;
                const priceDelta = meta.candidate.price.vehicleTotal - before.price.vehicleTotal;
                const detail = [
                  priceDelta === 0 ? null : `${priceDelta > 0 ? "+" : "−"}${formatCurrency(Math.abs(priceDelta))}`,
                  beforeRange !== null && nextRange !== null && beforeRange !== nextRange
                    ? `${nextRange - beforeRange > 0 ? "+" : ""}${nextRange - beforeRange} mi`
                    : null,
                  meta.candidate.delivery?.window ?? null,
                ].filter(Boolean).join(" · ");

                setChangeNotice({
                  title: nextOption?.label ?? "Configuration updated",
                  detail: detail || "Applied to the current build",
                });
                if (changedGroup === "wheels") {
                  configuratorPresentation.setFromUser({
                    viewPreset: "profile",
                    focus: "wheels",
                  });
                } else if (changedGroup === "paint") {
                  configuratorPresentation.setFromUser({ focus: "paint" });
                } else if (changedGroup === "interior") {
                  configuratorPresentation.setFromUser({
                    mode: "showroom",
                    viewPreset: "interior",
                    focus: "none",
                  });
                } else if (changedGroup === "towing") {
                  configuratorPresentation.setFromUser({ focus: "utility" });
                }
              }}
              onBuyerContextChange={(patch) => {
                configuratorMutations.setBuyerContext({
                  expectedRevision: configuratorStore.getState().domain.revision,
                  patch,
                  source: "human",
                });
              }}
              onReviewBuild={() => setReviewOpen(true)}
            />
          </div>
        </aside>
      </section>

      {reviewOpen && (
        <div className="review-layer">
          <button
            className="review-layer__scrim"
            type="button"
            aria-label="Close build review"
            onClick={() => setReviewOpen(false)}
          />
          <aside className="review-sheet" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <header>
              <div>
                <span>Configuration / Rev {revision}</span>
                <h2 id="review-title">Review your R2</h2>
              </div>
              <button type="button" onClick={() => setReviewOpen(false)} aria-label="Close build review">
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="review-sheet__specs">
              <span><strong>{String(resolved.specs.range_mi ?? "—")} mi</strong><small>Est. range</small></span>
              <span><strong>{resolved.delivery?.window ?? "TBD"}</strong><small>Delivery</small></span>
              <span><strong>{formatCurrency(resolved.price.vehicleTotal)}</strong><small>Vehicle total</small></span>
            </div>

            <div className="review-sheet__choices">
              {catalog.groups.map((group) => {
                const options = catalog.options.filter(
                  (option) => option.group === group.id && resolved.selectedOptionIds.includes(option.id),
                );
                return (
                  <div key={group.id}>
                    <span>{group.label}</span>
                    <strong>{options.length > 0 ? options.map((option) => option.label).join(", ") : "None"}</strong>
                  </div>
                );
              })}
            </div>

            <div className="review-sheet__math">
              <span><small>Base MSRP</small><strong>{formatCurrency(resolved.price.baseMSRP)}</strong></span>
              <span><small>Vehicle options</small><strong>{formatCurrency(resolved.price.vehicleOptions)}</strong></span>
              <span><small>Destination</small><strong>{formatCurrency(resolved.price.destination)}</strong></span>
              <span className="review-sheet__total"><small>Vehicle total</small><strong>{formatCurrency(resolved.price.vehicleTotal)}</strong></span>
              {resolved.price.ownershipSetup > 0 && (
                <span><small>Separate home setup</small><strong>{formatCurrency(resolved.price.ownershipSetup)}</strong></span>
              )}
            </div>

            <footer>
              <p>Independent buyer-side estimate. Verify pricing, availability, taxes, and eligibility with the seller.</p>
              <button type="button" onClick={() => void handleShare()}>
                <Share2 aria-hidden="true" /> {shareStatus === "copied" ? "Build link copied" : "Copy build link"}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </main>
  );
}
