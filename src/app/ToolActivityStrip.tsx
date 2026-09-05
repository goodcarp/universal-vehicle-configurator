import { useEffect, useState } from "react";
import { getToolActivity, observeToolActivity, type ToolActivity } from "../webmcp/tool-activity";

const DISPLAY_MS = 4_000;

export function ToolActivityStrip() {
  const [latest, setLatest] = useState<ToolActivity | null>(() => getToolActivity().at(-1) ?? null);
  const [expired, setExpired] = useState<ToolActivity | null>(null);
  useEffect(() => observeToolActivity(setLatest), []);
  useEffect(() => {
    if (!latest) return;
    const remaining = Math.max(0, DISPLAY_MS - (Date.now() - Date.parse(latest.at)));
    const timer = window.setTimeout(() => setExpired(latest), remaining);
    return () => window.clearTimeout(timer);
  }, [latest]);
  const text = latest && latest !== expired
    ? ["AGENT", latest.tool, latest.argsSummary, latest.ok ? "ok" : `error: ${latest.error}`, `${latest.ms} ms`].filter(Boolean).join(" · ")
    : "";
  return (
    <div className="tool-activity-strip" role="status" aria-live="polite" aria-atomic="true"
      data-active={Boolean(text) || undefined} data-ok={latest?.ok} title={text || undefined}>
      {text}
    </div>
  );
}
