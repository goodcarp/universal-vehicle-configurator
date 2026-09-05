import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ToolActivityStrip } from "../../../src/app/ToolActivityStrip";
import { resetToolActivityForTests, trackToolExecution } from "../../../src/webmcp/tool-activity";

afterEach(() => {
  resetToolActivityForTests();
  vi.useRealTimers();
});

it("announces the latest call politely for four seconds, resetting for a new call", () => {
  vi.useFakeTimers();
  render(<ToolActivityStrip />);
  const strip = screen.getByRole("status");
  expect(strip).toBeEmptyDOMElement();
  expect(strip).toHaveAttribute("aria-live", "polite");
  act(() => { trackToolExecution("present_vehicle_configuration", { bodyOpen: true }, () => ({ ok: true })); });
  expect(strip).toHaveTextContent("AGENT · present_vehicle_configuration · bodyOpen:true · ok · 0 ms");
  act(() => { vi.advanceTimersByTime(3_000); });
  act(() => {
    try { trackToolExecution("get_state", {}, () => { throw new Error("Twin unavailable"); }); } catch { /* Expected. */ }
  });
  expect(strip).toHaveTextContent("error: Twin unavailable");
  act(() => { vi.advanceTimersByTime(3_999); });
  expect(strip).not.toBeEmptyDOMElement();
  act(() => { vi.advanceTimersByTime(1); });
  expect(strip).toBeEmptyDOMElement();
  expect(strip).not.toHaveAttribute("data-active");
});
