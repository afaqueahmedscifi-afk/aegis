
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type Status = "Open" | "Investigating" | "Resolved";
type Severity = "Critical" | "High" | "Medium" | "Low";

type Incident = {
  id: string;
  title: string;
  branch: string;
  category: string;
  severity: Severity;
  status: Status;
  owner: string;
  evidence: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
type ApiIncident = {
  reference: string;
  title: string;
  branch?: { name: string } | null;
  category: string;
  severity: Severity;
  status: Status;
  owner: string | null;
  evidence: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type EvidenceFinding = {
  id: string;
  title: string;
  explanation: string;
  confidence: "High" | "Medium" | "Low";
  supportingEvidenceIds: string[];
  limitations: string[];
};

type EvidenceReport = {
  targetReference: string;
  findings: EvidenceFinding[];
  observedFacts: string[];
  missingInformation: string[];
  conclusion: string;
};

const severityRank: Record<Severity, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function InvestigationsPanel({
  onBack,
}: {
  onBack: () => void;
}) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [branch, setBranch] = useState("");
  const [category, setCategory] = useState("Operations");
  const [severity, setSeverity] = useState<Severity>("Medium");
  const [owner, setOwner] = useState("");
  const [evidence, setEvidence] = useState("");
  const [notes, setNotes] = useState("");

  const [evidenceRecordsJson, setEvidenceRecordsJson] = useState("");
  const [evidenceReport, setEvidenceReport] = useState<EvidenceReport | null>(null);
  const [analyzingEvidence, setAnalyzingEvidence] = useState(false);
  const [evidenceAnalysisError, setEvidenceAnalysisError] = useState("");

  useEffect(() => {
  let cancelled = false;

  async function loadIncidents() {
    setLoaded(false);
    setApiError("");

    try {
      const response = await fetch("/api/investigations");
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error("Unable to load investigations from the database.");
      }

      if (
        !payload ||
        typeof payload !== "object" ||
        !("incidents" in payload) ||
        !Array.isArray(payload.incidents)
      ) {
        throw new Error("The investigations API returned an unexpected response.");
      }

      const items = payload.incidents as ApiIncident[];

      const records: Incident[] = items.map((item) => ({
        id: item.reference,
        title: item.title,
        branch: item.branch?.name ?? "Unknown branch",
        category: item.category,
        severity: item.severity,
        status: item.status,
        owner: item.owner ?? "Unassigned",
        evidence: item.evidence ?? "",
        notes: item.notes ?? "",
        createdAt: String(item.createdAt).slice(0, 10),
        updatedAt: String(item.updatedAt).slice(0, 10),
      }));

      if (!cancelled) {
        setIncidents(records);
        setSelectedId(records[0]?.id ?? "");
      }
    } catch (error) {
      if (!cancelled) {
        setApiError(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while loading cases.",
        );
      }
    } finally {
      if (!cancelled) setLoaded(true);
    }
  }

  void loadIncidents();

  return () => {
    cancelled = true;
  };
}, []);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    return incidents
      .filter((item) => statusFilter === "All" || item.status === statusFilter)
      .filter((item) =>
        `${item.id} ${item.title} ${item.branch} ${item.category} ${item.owner} ${item.severity} ${item.status}`
          .toLowerCase()
          .includes(term),
      )
      .sort(
        (a, b) =>
          severityRank[b.severity] - severityRank[a.severity] ||
          b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [incidents, query, statusFilter]);

  const selected = incidents.find((item) => item.id === selectedId);
  const openCount = incidents.filter((item) => item.status === "Open").length;
  const investigatingCount = incidents.filter(
    (item) => item.status === "Investigating",
  ).length;
  const criticalCount = incidents.filter(
    (item) => item.severity === "Critical" && item.status !== "Resolved",
  ).length;


function updateIncident(id: string, changes: Partial<Incident>) {
  setIncidents((current) =>
    current.map((item) =>
      item.id === id
        ? { ...item, ...changes, updatedAt: today() }
        : item,
    ),
  );

  setSaveMessage("Unsaved changes — select SAVE CHANGES to persist.");
  setApiError("");
}

async function saveIncidentChanges(id: string) {
  if (savingUpdate) return;

  const draft = incidents.find((item) => item.id === id);
  if (!draft) return;

  setSavingUpdate(true);
  setApiError("");
  setSaveMessage("");

  try {
    const response = await fetch("/api/investigations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: draft.id,
        status: draft.status,
        owner: draft.owner,
        evidence: draft.evidence,
        notes: draft.notes,
      }),
    });

    const payload: unknown = await response.json();

    if (
      !response.ok ||
      !payload ||
      typeof payload !== "object" ||
      !("incident" in payload)
    ) {
      const message =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "Unable to save changes to the database.";

      throw new Error(message);
    }

    const item = (
      payload as {
        incident: {
          reference: string;
          title: string;
          branch?: { name: string } | null;
          category: string;
          severity: Severity;
          status: Status;
          owner: string | null;
          evidence: string | null;
          notes: string | null;
          createdAt: string;
          updatedAt: string;
        };
      }
    ).incident;

    const saved: Incident = {
      id: item.reference,
      title: item.title,
      branch: item.branch?.name ?? draft.branch,
      category: item.category,
      severity: item.severity,
      status: item.status,
      owner: item.owner ?? "Unassigned",
      evidence: item.evidence ?? "",
      notes: item.notes ?? "",
      createdAt: String(item.createdAt).slice(0, 10),
      updatedAt: String(item.updatedAt).slice(0, 10),
    };

    setIncidents((current) =>
      current.map((existing) =>
        existing.id === saved.id ? saved : existing,
      ),
    );

    setSaveMessage("Changes saved successfully to the database.");
  } catch (error) {
    setApiError(
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while saving changes.",
    );
  } finally {
    setSavingUpdate(false);
  }
}


  async function createIncident(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (saving) return;

  setSaving(true);
  setApiError("");

  try {
    const response = await fetch("/api/investigations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        branch: branch.trim(),
        category,
        severity,
        owner: owner.trim(),
        evidence: evidence.trim(),
        notes: notes.trim(),
      }),
    });

    const payload: unknown = await response.json();

    if (
      !response.ok ||
      !payload ||
      typeof payload !== "object" ||
      !("incident" in payload)
    ) {
      const message =
        payload && typeof payload === "object" && "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "Unable to save the incident to the database.";

      throw new Error(message);
    }

    const item = (payload as { incident: ApiIncident }).incident;

    const record: Incident = {
      id: item.reference,
      title: item.title,
      branch: item.branch?.name ?? branch.trim(),
      category: item.category,
      severity: item.severity,
      status: item.status,
      owner: item.owner ?? "Unassigned",
      evidence: item.evidence ?? "",
      notes: item.notes ?? "",
      createdAt: String(item.createdAt).slice(0, 10),
      updatedAt: String(item.updatedAt).slice(0, 10),
    };

    setIncidents((current) => [
      record,
      ...current.filter((existing) => existing.id !== record.id),
    ]);
    setSelectedId(record.id);
    setTitle("");
    setBranch("");
    setCategory("Operations");
    setSeverity("Medium");
    setOwner("");
    setEvidence("");
    setNotes("");
    setShowForm(false);
  } catch (error) {
    setApiError(
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while saving the incident.",
    );
  } finally {
    setSaving(false);
  }
}

async function analyzeSelectedEvidence() {
  if (!selected || analyzingEvidence) return;

  setAnalyzingEvidence(true);
  setEvidenceAnalysisError("");
  setEvidenceReport(null);

  try {
    let parsed: unknown;

    try {
      parsed = JSON.parse(evidenceRecordsJson);
    } catch {
      throw new Error("Enter valid JSON containing an array of evidence records.");
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Provide at least one structured evidence record.");
    }

    const response = await fetch("/api/investigations/evidence-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetReference: selected.id,
        records: parsed,
      }),
    });

    const payload: unknown = await response.json();

    if (!response.ok || !payload || typeof payload !== "object") {
      throw new Error("Evidence analysis request failed.");
    }

    const result = payload as {
      success?: boolean;
      error?: string;
      report?: EvidenceReport;
    };

    if (!result.success || !result.report) {
      throw new Error(result.error ?? "The API returned no evidence report.");
    }

    setEvidenceReport(result.report);
  } catch (error) {
    setEvidenceAnalysisError(
      error instanceof Error
        ? error.message
        : "An unexpected error occurred during evidence analysis.",
    );
  } finally {
    setAnalyzingEvidence(false);
  }
}

  function exportIncident(item: Incident) {
    const blob = new Blob([JSON.stringify(item, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.id.toLowerCase()}-investigation.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportRegister() {
    const blob = new Blob([JSON.stringify(incidents, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aegis-incident-register.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="investigation-workspace">
      <div className="investigation-hero">
        <div>
          <div className="eyebrow">AEGIS / CASE MANAGEMENT / LOCAL</div>
          <h2>Investigation Control</h2>
          <p>
            Register incidents, preserve evidence, document findings and track
            resolution. Sample records are illustrative, not live company data.
          </p>
        </div>
        <div className="investigation-hero-actions">
          <button className="green-button" onClick={() => setShowForm(!showForm)}>
            {showForm ? "CANCEL" : "+ NEW INCIDENT"}
          </button>
          <button className="investigation-secondary" onClick={exportRegister}>
            EXPORT REGISTER
          </button>
        </div>
      </div>
    {!loaded && (
  <p role="status">Loading investigations from the database…</p>
)}

{apiError && (
  <p role="alert" style={{ color: "#e07070" }}>
    {apiError}
  </p>
)}

{loaded && !apiError && (
  <p role="status">
    Database connected · {incidents.length} registered incident(s)
  </p>
)}
      <div className="investigation-metrics">
        <div className="investigation-metric">
          <span>OPEN CASES</span><strong>{openCount}</strong>
        </div>
        <div className="investigation-metric">
          <span>UNDER INVESTIGATION</span><strong>{investigatingCount}</strong>
        </div>
        <div className="investigation-metric">
          <span>UNRESOLVED CRITICAL</span><strong>{criticalCount}</strong>
        </div>
        <div className="investigation-metric">
          <span>TOTAL REGISTERED</span><strong>{incidents.length}</strong>
        </div>
      </div>

      {showForm && (
        <form className="investigation-form" onSubmit={createIncident}>
          <div className="eyebrow">NEW CASE / INCIDENT INTAKE</div>
          <div className="investigation-form-grid">
            <label>
              Incident title *
              <input required maxLength={120} value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Describe the problem" />
            </label>
            <label>
              Branch / location *
              <input required maxLength={100} value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Branch or department" />
            </label>
            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Operations</option>
                <option>Finance / POS</option>
                <option>Inventory</option>
                <option>Orders / Integration</option>
                <option>IT / Systems</option>
                <option>People / Compliance</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Severity
              <select value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}>
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </label>
            <label>
              Assigned owner
              <input maxLength={100} value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Person or team" />
            </label>
            <label className="investigation-wide">
              Evidence / source references
              <textarea maxLength={3000} value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Report IDs, timestamps, observed facts (do not paste passwords or secrets)" />
            </label>
            <label className="investigation-wide">
              Initial notes
              <textarea maxLength={5000} value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What needs to be checked? Separate facts from assumptions." />
            </label>
          </div>
          <button className="green-button" type="submit" disabled={saving}>
  {saving ? "SAVING TO DATABASE…" : "CREATE CASE"}
</button>
        </form>
      )}

      <div className="investigation-layout">
        <div className="investigation-register">
          <div className="investigation-section-head">
            <div>
              <div className="eyebrow">CASE REGISTER</div>
              <h3>Operational incidents</h3>
            </div>
            <span>{filtered.length} RECORDS</span>
          </div>
          <input
            className="investigation-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ID, branch, owner, category..."
            aria-label="Search incidents"
          />
          <div className="investigation-filters">
            {["All", "Open", "Investigating", "Resolved"].map((status) => (
              <button
                key={status}
                className={statusFilter === status ? "active-filter" : ""}
                onClick={() => setStatusFilter(status)}
                type="button"
              >
                {status}
              </button>
            ))}
          </div>
          <div className="investigation-list">
            {filtered.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`investigation-case ${selectedId === item.id ? "selected-case" : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="investigation-case-top">
                  <span>{item.id}</span>
                  <span className={`severity-${item.severity.toLowerCase()}`}>
                    {item.severity}
                  </span>
                </div>
                <strong>{item.title}</strong>
                <small>{item.branch} · {item.category}</small>
                <div className="investigation-case-bottom">
                  <span>{item.status}</span><span>Updated {item.updatedAt}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="investigation-empty">No incidents match these filters.</p>
            )}
          </div>
        </div>

        <div className="investigation-detail">
          {!selected ? (
            <div className="investigation-empty">Select a case to inspect its record.</div>
          ) : (
            <>
              <div className="investigation-section-head">
                <div>
                  <div className="eyebrow">CASE DETAIL / {selected.id}</div>
                  <h3>{selected.title}</h3>
                </div>
                <span className={`severity-${selected.severity.toLowerCase()}`}>
                  {selected.severity}
                </span>
              </div>
              <div className="investigation-detail-meta">
                <div><span>BRANCH</span><strong>{selected.branch}</strong></div>
                <div><span>CATEGORY</span><strong>{selected.category}</strong></div>
                <div><span>CREATED</span><strong>{selected.createdAt}</strong></div>
                <div><span>UPDATED</span><strong>{selected.updatedAt}</strong></div>
              </div>

              <label className="investigation-field">
                Workflow status
                <select value={selected.status}
                  onChange={(e) => updateIncident(selected.id, {
                    status: e.target.value as Status,
                  })}>
                  <option>Open</option>
                  <option>Investigating</option>
                  <option>Resolved</option>
                </select>
              </label>

              <label className="investigation-field">
                Assigned owner
                <input value={selected.owner}
                  onChange={(e) => updateIncident(selected.id, {
                    owner: e.target.value,
                  })} />
              </label>

              <label className="investigation-field">
                Evidence / source references
                <textarea maxLength={3000} value={selected.evidence}
                  onChange={(e) => updateIncident(selected.id, {
                    evidence: e.target.value,
                  })} />
              </label>

              <label className="investigation-field">
                Findings and investigation notes
                <textarea maxLength={5000} value={selected.notes}
                  onChange={(e) => updateIncident(selected.id, {
                    notes: e.target.value,
                  })} />
              </label>

<div className="investigation-field">
  <strong>STRUCTURED EVIDENCE ANALYSIS</strong>
  <p>
    Supply structured POS, synchronization, close-batch or inventory records.
    Existing free-text notes are not automatically converted into evidence.
  </p>
  <textarea
    value={evidenceRecordsJson}
    onChange={(event) => setEvidenceRecordsJson(event.target.value)}
    placeholder={'Paste a JSON array of evidence records, for example:\n[\n  {\n    "id": "TX-001",\n    "domain": "POS",\n    "type": "pos_transaction",\n    "branchCode": "BR-001",\n    "occurredAt": "2026-10-22T10:00:00Z",\n    "fields": {\n      "status": "accepted",\n      "closeBatchId": "BATCH-001"\n    }\n  }\n]'}
    rows={10}
    aria-label="Structured evidence records in JSON format"
  />
  <button
    type="button"
    className="green-button"
    disabled={analyzingEvidence || !evidenceRecordsJson.trim()}
    onClick={analyzeSelectedEvidence}
  >
    {analyzingEvidence ? "ANALYZING EVIDENCE..." : "ANALYZE EVIDENCE"}
  </button>
</div>

{evidenceAnalysisError && (
  <p role="alert" style={{ color: "#e07070" }}>
    {evidenceAnalysisError}
  </p>
)}

{evidenceReport && evidenceReport.targetReference === selected.id && (
  <div className="investigation-evidence-report">
    <div className="eyebrow">EVIDENCE REPORT / {evidenceReport.targetReference}</div>
    <h3>Analysis results</h3>
    <p>{evidenceReport.conclusion}</p>

    <h4>Findings ({evidenceReport.findings.length})</h4>
    {evidenceReport.findings.length === 0 ? (
      <p>No supported pattern was detected by the current rules.</p>
    ) : (
      evidenceReport.findings.map((finding) => (
        <article key={finding.id}>
          <h4>{finding.title}</h4>
          <p>{finding.explanation}</p>
          <p>
            <strong>Confidence:</strong> {finding.confidence}
          </p>
          <p>
            <strong>Supporting evidence:</strong>{" "}
            {finding.supportingEvidenceIds.join(", ")}
          </p>
          <strong>Limitations</strong>
          <ul>
            {finding.limitations.map((limitation, index) => (
              <li key={`${finding.id}-limitation-${index}`}>{limitation}</li>
            ))}
          </ul>
        </article>
      ))
    )}

    <h4>Observed record facts</h4>
    <ul>
      {evidenceReport.observedFacts.map((fact, index) => (
        <li key={`fact-${index}`}>{fact}</li>
      ))}
    </ul>

    <h4>Missing information</h4>
    <ul>
      {evidenceReport.missingInformation.map((item, index) => (
        <li key={`missing-${index}`}>{item}</li>
      ))}
    </ul>
    <p>Findings are investigative leads, not confirmed root causes.</p>
  </div>
)}
{saveMessage && (
  <p role="status" className="investigation-save-message">
    {saveMessage}
  </p>
)}

<div className="investigation-detail-actions">
  <button
    className="green-button"
    disabled={savingUpdate}
    onClick={() => saveIncidentChanges(selected.id)}
  >
    {savingUpdate ? "SAVING..." : "SAVE CHANGES"}
  </button>

  <button
    className="green-button"
    onClick={() => exportIncident(selected)}
  >
    EXPORT CASE JSON
  </button>
                <button className="investigation-secondary"
                  onClick={() => {
                    if (window.confirm(`Delete local case ${selected.id}?`)) {
                      setIncidents((current) =>
                        current.filter((item) => item.id !== selected.id),
                      );
                      setSelectedId("");
                    }
                  }}>
                  DELETE LOCAL CASE
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="investigation-safety">
  <strong>DATABASE-BACKED INCIDENT REGISTER</strong>
  <span>
    Incidents are loaded from the AEGIS database. New incidents are saved
    through the investigations API. Editing existing fields and deleting
    cases are not database-backed yet. Verify source evidence before acting.
  </span>
</div>

      <button className="green-button" onClick={onBack}>
        ← RETURN TO COMMAND CENTER
      </button>
    </section>
  );
}
