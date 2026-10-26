import test from "node:test";
import assert from "node:assert/strict";

import type {
  EvidenceRecord,
  EvidenceInvestigationReport,
} from "../src/lib/evidence-investigation.ts";

import {
  validateEvidenceInvestigationReport,
} from "../src/lib/finding-validation.ts";

const targetReference = "TEST-INV-001";

const records: EvidenceRecord[] = [
  {
    id: "EV-001",
    domain: "POS",
    type: "pos_transaction",
    branchCode: "BR-001",
    occurredAt: "2026-10-20T10:00:00.000Z",
    investigationReference: targetReference,
    fields: { status: "accepted", amount: 250 },
  },
];

function validReport(): EvidenceInvestigationReport {
  return {
    targetReference,
    findings: [
      {
        id: "FINDING-001",
        title: "Example reconciliation finding",
        explanation: "The supplied transaction requires reconciliation.",
        confidence: "Medium",
        supportingEvidenceIds: ["EV-001"],
        limitations: ["Verify against the original POS record."],
      },
    ],
    observedFacts: ["EV-001: POS transaction supplied."],
    missingInformation: ["The matching close batch was not supplied."],
    conclusion: "One finding requires verification.",
  };
}

test("accepts a well-formed report with supplied evidence", () => {
  assert.equal(
    validateEvidenceInvestigationReport(
      validReport(),
      targetReference,
      records,
    ),
    true,
  );
});

test("rejects a finding that references unknown evidence", () => {
  const report = validReport();
  report.findings[0].supportingEvidenceIds = ["EV-UNKNOWN"];

  assert.equal(
    validateEvidenceInvestigationReport(report, targetReference, records),
    false,
  );
});

test("rejects duplicate finding IDs", () => {
  const report = validReport();
  report.findings.push({ ...report.findings[0] });

  assert.equal(
    validateEvidenceInvestigationReport(report, targetReference, records),
    false,
  );
});

test("rejects a mismatched investigation target", () => {
  assert.equal(
    validateEvidenceInvestigationReport(
      validReport(),
      "A-DIFFERENT-TARGET",
      records,
    ),
    false,
  );
});

test("rejects malformed findings", () => {
  const report = validReport();
  (report.findings[0] as { confidence: string }).confidence = "Certain";

  assert.equal(
    validateEvidenceInvestigationReport(report, targetReference, records),
    false,
  );
});

test("rejects duplicate evidence record IDs", () => {
  assert.equal(
    validateEvidenceInvestigationReport(
      validReport(),
      targetReference,
      [...records, { ...records[0] }],
    ),
    false,
  );
});

test("rejects findings without supporting evidence", () => {
  const report = validReport();
  report.findings[0].supportingEvidenceIds = [];

  assert.equal(
    validateEvidenceInvestigationReport(report, targetReference, records),
    false,
  );
});
test("rejects evidence records from another investigation", () => {
  const unrelatedRecord: EvidenceRecord = {
    ...records[0],
    id: "EV-OTHER",
    investigationReference: "UNRELATED-INV-999",
  };

  assert.equal(
    validateEvidenceInvestigationReport(
      validReport(),
      targetReference,
      [records[0], unrelatedRecord],
    ),
    false,
  );
});
test("rejects duplicate evidence IDs within a finding", () => {
  const report = validReport();
  report.findings[0].supportingEvidenceIds = ["EV-001", "EV-001"];

  assert.equal(
    validateEvidenceInvestigationReport(
      report,
      targetReference,
      records,
    ),
    false,
  );
});