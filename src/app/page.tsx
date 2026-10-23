
"use client";
import IntelligencePanel from "./intelligence-panel";
import InvestigationsPanel from "./investigations-panel";

import { useState } from "react";

type Module =
  | "Command Center"
  | "Intelligence"
  | "Operations"
  | "Automation"
  | "Investigations"
  | "Reports"
  | "Guard"
  | "Settings";

const modules: { name: Module; icon: string; description: string }[] = [
  { name: "Command Center", icon: "⌂", description: "Unified operational overview" },
  { name: "Intelligence", icon: "◎", description: "Insights and analytics" },
  { name: "Operations", icon: "✳", description: "Live operational monitoring" },
  { name: "Automation", icon: "⌘", description: "Workflows and integrations" },
  { name: "Investigations", icon: "⌕", description: "Anomaly detection and diagnosis" },
  { name: "Reports", icon: "▤", description: "Performance and insights" },
  { name: "Guard", icon: "⬡", description: "Security and compliance" },
  { name: "Settings", icon: "⚙", description: "Workspace configuration" },
];

const initialAlerts = [
  { id: 1, level: "critical", title: "Sales performance deviation", detail: "Store 341 · Demo anomaly · −38% versus comparison period", time: "12 min ago" },
  { id: 2, level: "warning", title: "Zero-value order detected", detail: "Delivery integration · Demo event · KOT not confirmed", time: "26 min ago" },
  { id: 3, level: "warning", title: "Day-close reconciliation", detail: "POS report · Demo event · 10 records versus 15 expected", time: "42 min ago" },
  { id: 4, level: "normal", title: "System connectivity check", detail: "Sample integration · No live connection configured", time: "1 hour ago" },
  { id: 5, level: "warning", title: "Inventory records pending", detail: "Sample region · 40 stores remaining in demo dataset", time: "2 hours ago" },
];

const workspaces: Record<Module, { eyebrow: string; title: string; description: string; actions: string[] }> = {
  "Command Center": {
    eyebrow: "AEGIS / CORE",
    title: "Command Center",
    description: "A unified view of operational signals, system health, and decision support.",
    actions: ["Run Analysis", "Investigate Issue", "Check Stock", "Preview Automation", "View Reports", "Open Console"],
  },
  Intelligence: {
    eyebrow: "AEGIS / INTELLIGENCE",
    title: "Intelligence Matrix",
    description: "Explore sample business signals, compare performance, and identify patterns.",
    actions: ["Analyze Performance", "Detect Anomalies", "Compare Periods", "Summarize Signals"],
  },
  Operations: {
    eyebrow: "AEGIS / OPERATIONS",
    title: "Operations Monitor",
    description: "Inspect simulated operational indicators across stores and workflows.",
    actions: ["Run Health Check", "Inspect Orders", "Review Inventory", "Export Snapshot"],
  },
  Automation: {
    eyebrow: "AEGIS / AUTOMATE",
    title: "Workflow Engine",
    description: "Explore automation proposals before connecting any real systems.",
    actions: ["Preview Day-Close Workflow", "Preview Stock Alert", "Validate Workflow"],
  },
  Investigations: {
    eyebrow: "AEGIS / INVESTIGATIONS",
    title: "Investigation Lab",
    description: "Review a sample anomaly, examine its signals, and generate an investigation plan.",
    actions: ["Investigate Sales Deviation", "Investigate POS Reconciliation", "Generate Findings"],
  },
  Reports: {
    eyebrow: "AEGIS / REPORTS",
    title: "Intelligence Reports",
    description: "Generate local demonstration summaries from the current sample dataset.",
    actions: ["Daily Operations Summary", "Anomaly Report", "System Readiness Report"],
  },
  Guard: {
    eyebrow: "AEGIS / GUARD",
    title: "Governance & Guard",
    description: "Review the platform's safety model, access boundaries, and approval requirements.",
    actions: ["Review Safety Rules", "Check Connection Status", "Review Audit Preview"],
  },
  Settings: {
    eyebrow: "AEGIS / CONFIGURATION",
    title: "System Configuration",
    description: "This local prototype has no live integrations or production credentials configured.",
    actions: ["Inspect Environment", "Review Integration Readiness"],
  },
};

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="section-title">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState<Module>("Command Center");
  const alerts = initialAlerts;
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("AEGIS local demonstration environment initialized.");
  const [history, setHistory] = useState<string[]>(["Workspace initialized", "Sample dataset loaded", "Live integrations: not configured"]);
  const [showConsole, setShowConsole] = useState(false);

  const workspace = workspaces[active];
  const filteredAlerts = alerts.filter((alert) =>
    `${alert.title} ${alert.detail} ${alert.level}`.toLowerCase().includes(query.toLowerCase())
  );

  function runAction(action: string) {
    let result = "";

    if (action === "Run Analysis" || action === "Analyze Performance" || action === "Daily Operations Summary") {
      result = "Analysis complete: demonstration data inspected. Two areas are marked for review; no live systems were queried.";
    } else if (action.includes("Investigate") || action === "Detect Anomalies" || action === "Generate Findings" || action === "Anomaly Report") {
      result = "Investigation prepared: inspect source records, verify the time window, and compare expected versus actual values before taking action.";
    } else if (action.includes("Stock") || action.includes("Inventory")) {
      result = "Inventory inspection opened against sample data. No inventory records were changed.";
    } else if (action.includes("Automation") || action.includes("Workflow")) {
      result = "Workflow preview generated. Execution is disabled until a real integration, permissions, and human approval are configured.";
    } else if (action.includes("Report") || action.includes("Summary") || action.includes("Snapshot")) {
      result = "Report prepared from local demonstration data. No company systems were contacted.";
    } else if (action.includes("Console")) {
      setShowConsole(true);
      result = "Local event console opened.";
    } else if (action.includes("Safety") || action.includes("Audit")) {
      result = "Guard check: demo mode enabled; no production credentials; no destructive actions permitted by this prototype.";
    } else if (action.includes("Connection") || action.includes("Environment") || action.includes("Readiness") || action.includes("Health")) {
      result = "Environment check complete: local interface available; database, AI service, and external integrations are not connected.";
    } else {
      result = `${action} completed in demonstration mode. No external systems were changed.`;
    }

    setNotice(result);
    setHistory((previous) => [new Date().toLocaleTimeString() + " — " + action, ...previous].slice(0, 8));
  }

  return (
    <main className="aegis-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setActive("Command Center")} aria-label="AEGIS Command Center">
          <span className="brand-symbol">⬡</span>
          <span className="brand-name">AEGIS</span>
          <span className="brand-divider" />
          <span className="brand-subtitle">ENTERPRISE INTELLIGENCE</span>
        </button>

        <label className="global-search">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search alerts, signals, or ask AEGIS..." />
          <kbd>LOCAL</kbd>
        </label>

        <div className="system-online"><span className="pulse-dot" /> INTERFACE ONLINE</div>
        <div className="top-time">DEMO ENVIRONMENT</div>
        <button className="avatar" onClick={() => setActive("Settings")} aria-label="Open settings">A</button>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <div className="side-label">INTELLIGENCE SYSTEM</div>
          <nav className="navigation">
            {modules.map((item) => (
              <button key={item.name} className={`nav-item ${active === item.name ? "selected" : ""}`} onClick={() => setActive(item.name)}>
                <span className="nav-icon">{item.icon}</span>
                <span>{item.name}</span>
                {active === item.name && <span className="nav-arrow">›</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="status-ring"><span>✓</span></div>
            <div className="side-label">GUARD STATUS</div>
            <strong>DEMO MODE ACTIVE</strong>
            <p>External systems isolated</p>
            <div className="side-foot">SMARTER OPERATIONS.<br />SAFER DECISIONS.<br />GREATER TOMORROW.</div>
            <div className="side-brand">⬡ AEGIS <span>CORE v0.1</span></div>
          </div>
        </aside>

        <section className="main-stage">
          <div className="stage-heading">
            <SectionTitle eyebrow={workspace.eyebrow} title={active === "Command Center" ? "COMMAND CENTER" : workspace.title.toUpperCase()} description={workspace.description} />
            <div className="live-chip"><span className="pulse-dot" /> LOCAL SYSTEM READY</div>
          </div>

          {active === "Investigations" ? (
  <InvestigationsPanel onBack={() => setActive("Command Center")} />
) : active === "Intelligence" ? (
  <IntelligencePanel onBack={() => setActive("Command Center")} />
) : active === "Command Center" ? (
            <>
              <div className="core-stage">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="orbit orbit-three" />
                <div className="core-grid" />
                <div className="core-scan" />
                <div className="core-globe">
                  <div className="globe-latitudes" />
                  <div className="globe-longitudes" />
                  <div className="globe-mark">⬡</div>
                  <div className="globe-caption">AEGIS CORE</div>
                </div>
                <div className="connection connection-top" />
                <div className="connection connection-left" />
                <div className="connection connection-right" />
                <div className="connection connection-bottom-left" />
                <div className="connection connection-bottom-right" />

                <button className="module-node node-intelligence" onClick={() => setActive("Intelligence")}>
                  <span className="node-icon">◉</span><span><strong>INTELLIGENCE</strong><small>Insights & Analytics</small><em>OPEN MODULE ↗</em></span>
                </button>
                <button className="module-node node-automation" onClick={() => setActive("Automation")}>
                  <span className="node-icon">⌘</span><span><strong>AUTOMATION</strong><small>Workflows & Integrations</small><em>OPEN MODULE ↗</em></span>
                </button>
                <button className="module-node node-investigations" onClick={() => setActive("Investigations")}>
                  <span className="node-icon">⌕</span><span><strong>INVESTIGATIONS</strong><small>Anomaly Detection</small><em>OPEN MODULE ↗</em></span>
                </button>
                <button className="module-node node-guard" onClick={() => setActive("Guard")}>
                  <span className="node-icon">⬡</span><span><strong>GUARD</strong><small>Security & Compliance</small><em>OPEN MODULE ↗</em></span>
                </button>
                <button className="module-node node-reports" onClick={() => setActive("Reports")}>
                  <span className="node-icon">▤</span><span><strong>REPORTS</strong><small>Dashboards & Insights</small><em>OPEN MODULE ↗</em></span>
                </button>
                <button className="module-node node-operations" onClick={() => setActive("Operations")}>
                  <span className="node-icon">✳</span><span><strong>OPERATIONS</strong><small>Live Monitoring</small><em>OPEN MODULE ↗</em></span>
                </button>
              </div>

              <div className="core-status">
                <div className="status-emblem">✳</div>
                <div className="status-copy"><strong>AEGIS INTELLIGENCE</strong><p>{notice}</p></div>
                <div className="signal-bars" aria-label="Decorative signal visualization">{Array.from({ length: 24 }, (_, i) => <span key={i} style={{ height: `${8 + ((i * 17 + 13) % 29)}px` }} />)}</div>
              </div>
            </>
          ) : (
            <div className="workspace">
              <div className="workspace-banner">
                <div className="workspace-emblem">{modules.find((item) => item.name === active)?.icon}</div>
                <div><div className="eyebrow">MODULE INTERFACE</div><h2>{active}</h2><p>{workspace.description}</p></div>
                <span className="live-chip">● SIMULATED</span>
              </div>
              <div className="workspace-grid">
                {workspace.actions.map((action, index) => (
                  <button key={action} className="action-card" onClick={() => runAction(action)}>
                    <span className="action-index">0{index + 1}</span><strong>{action}</strong><span className="action-arrow">↗</span>
                    <small>EXECUTE DEMO ACTION</small>
                  </button>
                ))}
              </div>
              <div className="panel">
                <div className="panel-heading"><span>◈</span> MODULE OUTPUT <span className="panel-right">LOCAL PROCESSING</span></div>
                <div className="output-message">{notice}</div>
                <button className="green-button" onClick={() => setActive("Command Center")}>← RETURN TO COMMAND CENTER</button>
              </div>
            </div>
          )}
        </section>

        <aside className="right-rail">
          <section className="panel overview-panel">
            <div className="panel-heading"><span>⌁</span> SYSTEM OVERVIEW <span className="panel-right">DEMO</span></div>
            <div className="metric-grid">
              <div className="metric"><span>⌂</span><div><strong>145</strong><small>Sample Stores</small></div></div>
              <div className="metric"><span className="metric-dot">●</span><div><strong>98.6%</strong><small>Illustrative uptime</small></div></div>
              <div className="metric"><span>△</span><div><strong>{alerts.filter((alert) => alert.level !== "normal").length.toString().padStart(2, "0")}</strong><small>Sample Alerts</small></div></div>
              <div className="metric"><span>⚙</span><div><strong>06</strong><small>Workflow Templates</small></div></div>
            </div>
          </section>

          <section className="panel alerts-panel">
            <div className="panel-heading"><span>⌁</span> RECENT SIGNALS <button className="text-button" onClick={() => { setActive("Investigations"); setNotice("All sample signals are ready for review."); }}>VIEW ALL ↗</button></div>
            <div className="alerts-list">
              {filteredAlerts.length === 0 ? <div className="empty-state">No matching signals found.</div> : filteredAlerts.map((alert) => (
                <button className="alert-row" key={alert.id} onClick={() => { setNotice(`${alert.title}: ${alert.detail}. Verify source data before deciding on a response.`); setActive("Investigations"); }}>
                  <span className={`alert-dot ${alert.level}`} />
                  <span className="alert-content"><strong>{alert.title}</strong><small>{alert.detail}</small></span>
                  <span className="alert-time">{alert.time}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel quick-panel">
            <div className="panel-heading"><span>ϟ</span> QUICK ACTIONS <span className="panel-right">LOCAL</span></div>
            <div className="quick-grid">
              {["Run Analysis", "Investigate Issue", "Check Stock", "Preview Automation", "View Reports", "Open Console"].map((action, index) => (
                <button className="quick-action" key={action} onClick={() => runAction(action)}><span>{["⌁", "⌕", "⬡", "▷", "▥", ">_"][index]}</span>{action}</button>
              ))}
            </div>
            <div className="notice-box"><span className="pulse-dot" />{notice}</div>
          </section>

          <section className="panel guard-panel">
            <div className="panel-heading"><span>⬡</span> AEGIS GUARD <span className="panel-right">ACTIVE</span></div>
            <div className="guard-row"><span className="guard-check">✓</span> Demo environment isolated</div>
            <div className="guard-row"><span className="guard-check">✓</span> No external writes enabled</div>
            <div className="guard-row"><span className="guard-check">✓</span> Human approval required for live actions</div>
          </section>
        </aside>
      </div>

      {showConsole && (
        <div className="console-overlay" role="dialog" aria-modal="true" aria-label="AEGIS local event console">
          <div className="console-window">
            <div className="panel-heading"><span>›_</span> AEGIS EVENT CONSOLE <button className="text-button" onClick={() => setShowConsole(false)}>CLOSE ×</button></div>
            <p className="console-warning">LOCAL DEMO LOG · NOT A LIVE SYSTEM FEED</p>
            {history.map((entry, index) => <div className="console-line" key={`${entry}-${index}`}><span>[{String(index + 1).padStart(2, "0")}]</span> {entry}</div>)}
            <button className="green-button" onClick={() => { setHistory((previous) => ["Manual local check — no external calls made", ...previous].slice(0, 8)); setNotice("Manual local check completed."); }}>RUN LOCAL CHECK</button>
          </div>
        </div>
      )}

      <footer className="bottom-bar"><span>⬡ AEGIS CORE</span><span>LOCAL PROTOTYPE / v0.1</span><span><span className="pulse-dot" /> ALL EXTERNAL INTEGRATIONS DISCONNECTED</span><span>INTELLIGENCE WITH CONTROL</span></footer>
    </main>
  );
}
