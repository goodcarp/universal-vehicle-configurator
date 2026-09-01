import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import catalogData from "../../../src/data/catalogs/r2.catalog.json";
import type {
  BuyerContextInput,
  Catalog,
  SelectionInput,
  SelectionPatch,
} from "../../../src/domain/catalog.types";
import { resolve } from "../../../src/domain/resolve";
import {
  VehicleConfigurator,
  type SelectionChangeMeta,
} from "../../../src/features/configurator/VehicleConfigurator";

const catalog = catalogData as unknown as Catalog;

afterEach(cleanup);

function ConfiguratorHarness() {
  const [selections, setSelections] = useState<SelectionInput>(() => resolve(catalog).selections);
  const [buyer, setBuyer] = useState<BuyerContextInput>({});

  const applySelection = (_patch: SelectionPatch, meta: SelectionChangeMeta) => {
    setSelections(meta.candidate.selections);
  };

  return (
    <VehicleConfigurator
      catalog={catalog}
      selections={selections}
      buyerContext={buyer}
      onSelectionPatch={applySelection}
      onBuyerContextChange={(patch) => setBuyer((current) => ({ ...current, ...patch }))}
    />
  );
}

describe("VehicleConfigurator", () => {
  it("renders every catalog family and every option as an operable input", () => {
    render(<ConfiguratorHarness />);

    for (const group of catalog.groups) {
      expect(screen.getByRole("group", { name: group.label })).toBeVisible();
    }

    const oneChoiceOptions = catalog.options.filter((option) =>
      catalog.groups.find((group) => group.id === option.group)?.select === "one"
    );
    const manyChoiceOptions = catalog.options.filter((option) =>
      catalog.groups.find((group) => group.id === option.group)?.select === "many"
    );
    expect(screen.getAllByRole("radio")).toHaveLength(oneChoiceOptions.length + 3);
    expect(screen.getAllByRole("checkbox")).toHaveLength(manyChoiceOptions.length + 2);
    expect(screen.getByRole("radio", { name: /Performance/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Esker Silver/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /21.*Liquid Tungsten/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Black Crater/i })).toBeChecked();

    const summary = screen.getByRole("contentinfo", { name: "Current build summary" });
    expect(summary.previousElementSibling).toHaveClass("configurator-scroll");
  });

  it("previews price, range, timing, and compatibility before committing a choice", () => {
    render(<ConfiguratorHarness />);

    const allTerrain = screen.getByRole("radio", { name: /20.*Black Sand All-Terrain/i });
    const allTerrainCard = allTerrain.closest("label");
    expect(allTerrainCard).not.toBeNull();
    expect(within(allTerrainCard as HTMLElement).getByText("−23 mi")).toBeVisible();

    const forestGreen = screen.getByRole("radio", { name: /Forest Green/i });
    const forestGreenCard = forestGreen.closest("label");
    expect(forestGreenCard).not.toBeNull();
    expect(within(forestGreenCard as HTMLElement).getByText("Late 2026")).toBeVisible();

    const standardRwd = screen.getByRole("radio", { name: /R2 Standard RWD, From/i });
    const standardRwdCard = standardRwd.closest("label");
    expect(standardRwdCard).not.toBeNull();
    expect(within(standardRwdCard as HTMLElement).getByText("Needs a paired change")).toBeVisible();
  });

  it("lets the buyer configure all five vehicle families and keeps the total coherent", () => {
    render(<ConfiguratorHarness />);

    fireEvent.click(screen.getByRole("radio", { name: /R2 Premium/i }));
    fireEvent.click(screen.getByRole("radio", { name: /Glacier White/i }));
    fireEvent.click(screen.getByRole("radio", { name: /20.*Black Sand All-Terrain/i }));
    fireEvent.click(screen.getByRole("radio", { name: /Coastal Cloud/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /hitch \+ tow software/i }));

    expect(screen.getByRole("radio", { name: /R2 Premium/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Glacier White/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /20.*Black Sand All-Terrain/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Coastal Cloud/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /hitch \+ tow software/i })).toBeChecked();

    const summary = screen.getByRole("contentinfo", { name: "Current build summary" });
    expect(within(summary).getByText("$62,240")).toBeVisible();
    expect(within(summary).getByText("307 mi estimated range")).toBeVisible();
    expect(within(summary).getByText("Late 2026")).toBeVisible();
  });

  it("updates price, range, and delivery consequences as the buyer configures", () => {
    render(<ConfiguratorHarness />);

    const summary = screen.getByRole("contentinfo", { name: "Current build summary" });
    expect(within(summary).getByText("$59,790")).toBeVisible();
    expect(within(summary).getByText("330 mi estimated range")).toBeVisible();
    expect(within(summary).getByText("Available now")).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: /20.*Black Sand All-Terrain/i }));
    expect(within(summary).getByText("$60,790")).toBeVisible();
    expect(within(summary).getByText("307 mi estimated range")).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: /Forest Green/i }));
    expect(within(summary).getByText("$61,790")).toBeVisible();
    expect(within(summary).getByText("Late 2026")).toBeVisible();
    expect(screen.getByText("Timing changed")).toBeVisible();
  });

  it("keeps an incompatible choice atomic, explains it, and offers valid paired paths", () => {
    const onInvalidSelection = vi.fn();
    const onSelectionPatch = vi.fn();

    function InvalidHarness() {
      const [selections, setSelections] = useState<SelectionInput>(() => resolve(catalog).selections);
      return (
        <VehicleConfigurator
          catalog={catalog}
          selections={selections}
          onSelectionPatch={(patch, meta) => {
            onSelectionPatch(patch, meta);
            setSelections(meta.candidate.selections);
          }}
          onBuyerContextChange={() => undefined}
          onInvalidSelection={onInvalidSelection}
        />
      );
    }

    render(<InvalidHarness />);
    fireEvent.click(screen.getByRole("radio", { name: /R2 Standard RWD, From/i }));

    const guide = screen.getByRole("alert", { name: "Compatibility guidance" });
    expect(within(guide).getByText(/needs a companion change/i)).toBeVisible();
    expect(within(guide).getByText(/not available with this build/i)).toBeVisible();
    expect(screen.getByRole("radio", { name: /Performance/i })).toBeChecked();
    expect(onInvalidSelection).toHaveBeenCalledOnce();

    fireEvent.click(within(guide).getByRole("button", { name: /19.*Machined Graphite/i }));
    expect(screen.getByRole("radio", { name: /R2 Standard RWD, From/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /19.*Machined Graphite/i })).toBeChecked();
    expect(screen.getByText("275 mi estimated range")).toBeVisible();
    expect(screen.queryByRole("alert", { name: "Compatibility guidance" })).not.toBeInTheDocument();
    expect(onSelectionPatch).toHaveBeenCalledWith(
      {
        set: {
          build: ["build.standard_rwd"],
          wheels: ["wheels.mg19_as"],
        },
      },
      expect.objectContaining({
        source: "compatible-alternative",
        changedGroups: ["build", "wheels"],
        primaryGroup: "build",
      }),
    );
  });

  it("retires stale compatibility advice after an external agent changes the build", () => {
    const defaults = resolve(catalog).selections;
    const props = {
      catalog,
      buyerContext: {},
      onSelectionPatch: vi.fn(),
      onBuyerContextChange: vi.fn(),
    };
    const view = render(<VehicleConfigurator {...props} selections={defaults} />);

    fireEvent.click(screen.getByRole("radio", { name: /R2 Standard RWD, From/i }));
    expect(screen.getByRole("alert", { name: "Compatibility guidance" })).toBeVisible();

    const agentSelections = resolve(catalog, { wheels: "wheels.bs20_at" }).selections;
    view.rerender(<VehicleConfigurator {...props} selections={agentSelections} />);
    expect(screen.queryByRole("alert", { name: "Compatibility guidance" })).not.toBeInTheDocument();
  });

  it("emits resolved selection metadata and buyer-context patches", () => {
    const onSelectionPatch = vi.fn();
    const onBuyerContextChange = vi.fn();
    const onReviewBuild = vi.fn();
    render(
      <VehicleConfigurator
        catalog={catalog}
        selections={resolve(catalog).selections}
        onSelectionPatch={onSelectionPatch}
        onBuyerContextChange={onBuyerContextChange}
        onReviewBuild={onReviewBuild}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Glacier White/i }));
    expect(onSelectionPatch).toHaveBeenCalledWith(
      { set: { paint: ["paint.glacier_white"] } },
      expect.objectContaining({
        source: "option",
        candidate: expect.objectContaining({ valid: true }),
        changedGroups: ["paint"],
        primaryGroup: "paint",
      }),
    );

    fireEvent.click(screen.getByRole("radio", { name: /EV curious/i }));
    expect(onBuyerContextChange).toHaveBeenCalledWith({ evExperience: "new" });

    fireEvent.click(screen.getByRole("checkbox", { name: /Tesla Model Y/i }));
    expect(onBuyerContextChange).toHaveBeenCalledWith({ crossShopIds: ["model_y"] });

    fireEvent.click(screen.getByRole("button", { name: /Review \$59,790 R2 build/i }));
    expect(onReviewBuild).toHaveBeenCalledWith(expect.objectContaining({
      valid: true,
      price: expect.objectContaining({ vehicleTotal: 59_790 }),
    }));
  });
});
