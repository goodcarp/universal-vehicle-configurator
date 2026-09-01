import { ArrowUpRight, Check, CircleDashed } from "lucide-react";
import { useEffect, useState } from "react";
import { RangeRealityPrototype } from "../features/range-reality/RangeRealityPrototype";
import {
  registerProbeSiteTool,
  type SiteToolsProbeStatus,
} from "../webmcp/register-probe";

const INITIAL_STATUS: SiteToolsProbeStatus = { state: "registering" };

function ToolStatus({ status }: { status: SiteToolsProbeStatus }) {
  const ready = status.state === "ready";
  const label = ready
    ? "Site Tools ready"
    : status.state === "unsupported"
      ? "Manual mode"
      : status.state === "degraded"
        ? "Site Tools unavailable"
        : "Checking Site Tools";

  return (
    <span className="tool-status" data-state={status.state}>
      {ready ? <Check aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
      {label}
    </span>
  );
}

export function App() {
  const [siteTools, setSiteTools] = useState<SiteToolsProbeStatus>(INITIAL_STATUS);

  useEffect(() => {
    void registerProbeSiteTool().then(setSiteTools);
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Universal Vehicle Configurator home">
          <span className="wordmark-mark" aria-hidden="true">U</span>
          <span>Universal</span>
        </a>
        <div className="topbar-meta">
          <span className="concept-label">Unofficial concept</span>
          <ToolStatus status={siteTools} />
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">R2 / Configuration 00</p>
          <h1 id="hero-title">Build desire.<br />Reveal consequence.</h1>
          <p className="lede">
            A shared vehicle canvas for you and your agent—engineered to make every
            choice visible, explainable, and portable.
          </p>
          <div className="summary-strip" aria-label="Preview configuration summary">
            <div><span>Build</span><strong>Performance</strong></div>
            <div><span>Est. range</span><strong>307 mi</strong></div>
            <div><span>Est. total</span><strong>$63,790</strong></div>
          </div>
        </div>

        <RangeRealityPrototype />
      </section>

      <footer className="release-rail">
        <span>Manufacturer-grade configurator</span>
        <span className="rail-line" aria-hidden="true" />
        <span>Buyer-grade intelligence</span>
        <a href="https://learn.chatgpt.com/docs/webmcp" target="_blank" rel="noreferrer">
          About Site Tools <ArrowUpRight aria-hidden="true" />
        </a>
      </footer>
    </main>
  );
}
