import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/scene/webgl-support", () => ({
  detectWebGLSupport: () => "supported",
}));

vi.mock("../../../src/scene/LiveVehicleViewport", () => ({
  default: ({ resetRevision }: Readonly<{ resetRevision: number }>) => (
    <output data-testid="live-camera-reset-revision">{resetRevision}</output>
  ),
}));

import { VehicleCanvas } from "../../../src/features/vehicle-canvas";

afterEach(cleanup);

describe("VehicleCanvas live camera reset contract", () => {
  it("increments the live reset revision even when authored pan is already zero", async () => {
    render(<VehicleCanvas defaultViewPreset="angle" />);

    const revision = await screen.findByTestId("live-camera-reset-revision");
    expect(revision).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(revision).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(revision).toHaveTextContent("2");
  });
});
