import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/app/App";

describe("vehicle configurator app", () => {
  it("renders the interactive vehicle and every configuration family in manual mode", async () => {
    render(<App />);
    expect(screen.getByRole("region", { name: "Interactive vehicle configurator" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Build" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Paint" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Wheels" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Interior" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Towing" })).toBeVisible();
    expect(await screen.findByText("Manual mode")).toBeVisible();
  });
});
