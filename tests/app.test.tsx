import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/app/App";

describe("release shell", () => {
  it("keeps the vehicle proposition and manual experience visible", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /build desire/i })).toBeVisible();
    expect(screen.getByText("Performance")).toBeVisible();
    expect(await screen.findByText("Manual mode")).toBeVisible();
  });
});
