
"use client";

import { useMemo, useState } from "react";

type Metric = {
  id: string;
  name: string;
  actual: number;
  expected: number;
  unit: string;
  lowerIsBetter?: boolean;
};

const sampleMetrics: Metric[] = [
  { id: "sales", name: "Sales performance", actual: 62000, expected: 100000, unit: "SAR" },
  { id: "food-cost", name: "Food cost ratio", actual: 37, expected: 32, unit: "%" },
  { id: "orders", name: "Order completion", actual: 91, expected: 98, unit: "%" },
  { id: "inventory", name: "Inventory variance", actual: 4.8, expected: 2, unit: "%", lowerIsBetter: true },
  { id: "day-close", name: "Day-close reconciliation", actual: 10, expected: 15, unit: "records" },
  { id: "uptime", name: "System availability", actual: 98.6, expected: 99.5, unit: "%" },
];

function formatValue(value: number, unit: string) {
  if (unit === "SAR") {
    return new Intl.NumberFormat("en-SA", {
      style: "currency",
      currency: "SAR",
      maximumFractionDigits: 0,
    }).format(value);
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)}${unit === "%" ? "%" : ` ${unit}`}`;
}

function analyzeMetric(metric: Metric) {
  const delta = metric.actual - metric.expected;
  const deviation = metric.expected === 0
    ? 0
    : Math.abs(delta / metric.expected) * 100;

  const adverse = metric.lowerIsBetter ? delta > 0 : delta < 0;
  const needsReview = adverse && deviation >= 5;

  return { delta, deviation, adverse, needsReview };
}

function explanation(metric: Metric) {
  switch (metric.id) {
    case "sales":
      return "Sales are below the reference value. Compare trading hours, transaction count, average order value, and like-for-like periods.";
    case "food-cost":
      return "Food cost is above the reference ratio. Review purchase prices, portion control, waste, stock counts, and recipe costing.";
    case "orders":
      return "Completion is below the reference rate. Check cancellations, payment failures, order acceptance, and fulfilment delays.";
    case "inventory":
      return "Inventory variance exceeds the reference level. Reconcile opening stock, receipts, transfers, waste, and physical counts.";
    case "day-close":
      return "Fewer records were reconciled than expected. Check source reports, date filters, synchronization, and missing transactions.";
    case "uptime":
      return "Availability is below the reference value. Verify monitoring coverage, connectivity, incident logs, and measurement windows.";
    default:
      return "Validate the source records and comparison period before deciding on a response.";
  }
}

export default function IntelligencePanel({
  onBack,
}: {
  onBack: () => void;
}) {
  const [threshold, setThreshold] = useState(5);
  const [selected, setSelected] = useState("all");
  const [inspected, setInspected] = useState<string | null>("sales");
  const [showAll, setShowAll] = useState(false);

  const results = useMemo(
    () => sampleMetrics.map((metric) => ({
      metric,
      ...analyzeMetric(metric),
    })),
    [],
  );

  const flagged = results.filter(
    (result) => result.adverse && result.deviation >= threshold,
  );

  const visibleResults = results.filter((result) => {
    if (selected === "flagged") {
      return result.adverse && result.deviation >= threshold;
    }
    if (selected === "healthy") {
      return !(result.adverse && result.deviation >= threshold);
    }
    return true;
  });

  const inspectedResult = results.find(
    (result) => result.metric.id === inspected,
  );

  return (
    <div className="intelligence-workspace">
      <div className="intelligence-hero">
        <div>
          <div className="eyebrow">AEGIS / INTELLIGENCE ENGINE</div>
          <h2>Operational Intelligence</h2>
          <p>
            Detect deviations, inspect evidence, and prioritize what needs
            human attention.
          </p>
          <div className="intel-demo-label">
            <span className="pulse-dot" />
            SYNTHETIC DATASET · LOCAL ANALYSIS · NO LIVE CONNECTION
          </div>
        </div>
        <div className="intel-core-symbol">◎</div>
      </div>

      <div className="intel-kpis">
        <div className="intel-kpi">
          <span>METRICS ANALYZED</span>
          <strong>{results.length.toString().padStart(2, "0")}</strong>
          <small>Sample indicators</small>
        </div>
        <div className="intel-kpi">
          <span>FLAGGED FOR REVIEW</span>
          <strong className={flagged.length ? "intel-warning-text" : ""}>
            {flagged.length.toString().padStart(2, "0")}
          </strong>
          <small>At current threshold</small>
        </div>
        <div className="intel-kpi">
          <span>DETECTION THRESHOLD</span>
          <strong>{threshold}%</strong>
          <small>Adverse deviation</small>
        </div>
      </div>

      <section className="intel-panel">
        <div className="intel-panel-heading">
          <div>
            <div className="eyebrow">01 / SIGNAL PROCESSING</div>
            <h3>Performance signals</h3>
          </div>
          <button className="intel-button" onClick={() => setShowAll(!showAll)}>
            {showAll ? "HIDE METHOD" : "ANALYSIS METHOD"}
          </button>
        </div>

        {showAll && (
          <div className="intel-method">
            A metric is flagged when its result moves in an adverse direction
            by at least the selected percentage relative to its reference.
            This is a simple rule-based demonstration, not a trained AI model.
            Reference values are illustrative, not validated business targets.
          </div>
        )}

        <div className="intel-threshold">
          <label htmlFor="intel-threshold">
            Minimum adverse deviation: <strong>{threshold}%</strong>
          </label>
          <input
            id="intel-threshold"
            type="range"
            min="1"
            max="25"
            step="1"
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
          />
          <div className="intel-range-labels">
            <span>1% · Sensitive</span>
            <span>25% · Strict</span>
          </div>
        </div>

        <div className="intel-filter-row">
          {[
            { id: "all", label: "ALL SIGNALS" },
            { id: "flagged", label: "FLAGGED" },
            { id: "healthy", label: "OTHER SIGNALS" },
          ].map((filter) => (
            <button
              key={filter.id}
              className={`intel-filter ${selected === filter.id ? "active" : ""}`}
              onClick={() => setSelected(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="intel-signal-list">
          {visibleResults.map((result) => {
            const { metric } = result;
            const isFlagged = result.adverse && result.deviation >= threshold;
            const isSelected = inspected === metric.id;

            return (
              <button
                key={metric.id}
                className={`intel-signal ${isSelected ? "inspected" : ""}`}
                onClick={() => setInspected(isSelected ? null : metric.id)}
              >
                <span className={`intel-signal-indicator ${isFlagged ? "flagged" : "normal"}`} />
                <span className="intel-signal-name">
                  <strong>{metric.name}</strong>
                  <small>
                    Reference: {formatValue(metric.expected, metric.unit)}
                  </small>
                </span>
                <span className="intel-signal-values">
                  <strong>{formatValue(metric.actual, metric.unit)}</strong>
                  <small className={result.adverse ? "intel-warning-text" : ""}>
                    {result.delta > 0 ? "+" : ""}
                    {result.deviation.toFixed(1)}% deviation
                  </small>
                </span>
                <span className="intel-signal-arrow">{isSelected ? "−" : "+"}</span>
              </button>
            );
          })}
          {visibleResults.length === 0 && (
            <div className="intel-empty">No signals match this filter and threshold.</div>
          )}
        </div>
      </section>

      <section className="intel-panel">
        <div className="eyebrow">02 / INVESTIGATION SUPPORT</div>
        <h3>Signal interpretation</h3>

        {inspectedResult ? (
          <>
            <div className="intel-inspected-title">
              <span className="intel-inspected-icon">⌕</span>
              <div>
                <strong>{inspectedResult.metric.name}</strong>
                <p>
                  {inspectedResult.adverse &&
                  inspectedResult.deviation >= threshold
                    ? "FLAGGED FOR HUMAN REVIEW"
                    : "NO CURRENT THRESHOLD BREACH"}
                </p>
              </div>
            </div>

            <div className="intel-comparison">
              <div>
                <span>OBSERVED</span>
                <strong>
                  {formatValue(
                    inspectedResult.metric.actual,
                    inspectedResult.metric.unit,
                  )}
                </strong>
              </div>
              <div>
                <span>REFERENCE</span>
                <strong>
                  {formatValue(
                    inspectedResult.metric.expected,
                    inspectedResult.metric.unit,
                  )}
                </strong>
              </div>
              <div>
                <span>ABSOLUTE GAP</span>
                <strong>
                  {formatValue(
                    Math.abs(inspectedResult.delta),
                    inspectedResult.metric.unit,
                  )}
                </strong>
              </div>
            </div>

            <div className="intel-explanation">
              <div className="eyebrow">POTENTIAL INVESTIGATION PATH</div>
              <p>{explanation(inspectedResult.metric)}</p>
              <small>
                These are hypotheses to check, not confirmed root causes.
              </small>
            </div>

            <button
              className="intel-primary-button"
              onClick={() => {
                const report = [
                  "AEGIS INTELLIGENCE — INVESTIGATION BRIEF",
                  `Signal: ${inspectedResult.metric.name}`,
                  `Observed: ${formatValue(inspectedResult.metric.actual, inspectedResult.metric.unit)}`,
                  `Reference: ${formatValue(inspectedResult.metric.expected, inspectedResult.metric.unit)}`,
                  `Deviation: ${inspectedResult.deviation.toFixed(1)}%`,
                  `Review status: ${inspectedResult.adverse && inspectedResult.deviation >= threshold ? "Flagged" : "Below configured threshold"}`,
                  `Investigation guidance: ${explanation(inspectedResult.metric)}`,
                  "Dataset: Synthetic demonstration data",
                  "Root cause: Not established",
                ].join("\n");

                const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `aegis-investigation-${inspectedResult.metric.id}.txt`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              EXPORT INVESTIGATION BRIEF ↗
            </button>
          </>
        ) : (
          <div className="intel-empty">
            Select a signal above to inspect its values and investigation guidance.
          </div>
        )}
      </section>

      <div className="intel-safety-note">
        <span>⬡</span>
        <p>
          <strong>Decision boundary:</strong> AEGIS identifies deviations and
          suggests checks. It does not establish causality or change business
          systems. Validate source data before acting.
        </p>
      </div>

      <button className="green-button" onClick={onBack}>
        ← RETURN TO COMMAND CENTER
      </button>
    </div>
  );
}
