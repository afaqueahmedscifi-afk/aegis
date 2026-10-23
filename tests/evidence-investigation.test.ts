
import test from "node:test";
import assert from "node:assert/strict";

import {
  investigateEvidence,
  type EvidenceRecord,
} from "../src/lib/evidence-investigation.ts";

function record(
  overrides: Partial<EvidenceRecord> &
    Pick<EvidenceRecord, "id" | "domain" | "type" | "fields">,
): EvidenceRecord {
  return {
    branchCode: "BR-001",
    occurredAt: "2026-10-20T10:00:00.000Z",
    ...overrides,
  };
}

const scenarios = {
  posSyncFailure: {
    targetReference: "NS-POS-001",
    records: [
      record({
        id: "EV-POS-001",
        domain: "POS",
        type: "pos_transaction",
        reference: "TX-9001",
        fields: {
          status: "accepted",
          closeBatchId: "BATCH-20",
          amount: 250,
        },
      }),
      record({
        id: "EV-POS-002",
        domain: "Technology",
        type: "sync_event",
        fields: {
          status: "failed",
          transactionId: "EV-POS-001",
          errorCode: "SYNC_TIMEOUT",
        },
      }),
      record({
        id: "EV-POS-003",
        domain: "Finance",
        type: "close_batch",
        fields: {
          status: "completed",
          batchId: "BATCH-20",
          transactionIds: [],
        },
      }),
    ],
  },

  duplicateInventoryPosting: {
    targetReference: "NS-INV-001",
    records: [
      record({
        id: "EV-INV-001",
        domain: "Inventory",
        type: "inventory_posting",
        fields: {
          receiptId: "GRN-778",
          sku: "OIL-5L",
          quantity: 20,
        },
      }),
      record({
        id: "EV-INV-002",
        domain: "Inventory",
        type: "inventory_posting",
        fields: {
          receiptId: "GRN-778",
          sku: "OIL-5L",
          quantity: 20,
        },
      }),
      record({
        id: "EV-INV-003",
        domain: "Inventory",
        type: "physical_count",
        fields: {
          sku: "OIL-5L",
          quantity: 40,
        },
      }),
    ],
  },

  unrelatedEvidence: {
    targetReference: "NS-OPS-001",
    records: [
      record({
        id: "EV-OPS-001",
        domain: "Facilities",
        type: "maintenance_note",
        fields: {
          message: "Scheduled air-conditioning inspection",
        },
      }),
      record({
        id: "EV-OPS-002",
        domain: "HR",
        type: "staff_schedule",
        fields: {
          shift: "Morning",
          status: "Published",
        },
      }),
    ],
  },
};

// Benchmark expectations are separate from engine input.
const expectedOutcomes = {
  posSyncFailure: {
    expectedFindingPrefix: "POS-CLOSE-",
    requiredEvidenceIds: ["EV-POS-001", "EV-POS-002"],
  },
  duplicateInventoryPosting: {
    expectedFindingPrefix: "INV-DUPLICATE-",
    requiredEvidenceIds: ["EV-INV-001", "EV-INV-002"],
  },
  unrelatedEvidence: {
    expectedFindingCount: 0,
  },
};

test("POS synchronization failure produces a traceable reconciliation finding", () => {
  const report = investigateEvidence(scenarios.posSyncFailure);
  const expected = expectedOutcomes.posSyncFailure;

  const finding = report.findings.find((item) =>
    item.id.startsWith(expected.expectedFindingPrefix),
  );

  assert.ok(finding, "Expected a POS reconciliation finding");
  assert.equal(finding.confidence, "High");

  for (const evidenceId of expected.requiredEvidenceIds) {
    assert.ok(
      finding.supportingEvidenceIds.includes(evidenceId),
      `Finding should reference ${evidenceId}`,
    );
  }

  assert.match(finding.explanation, /synchronization/i);
  assert.ok(finding.limitations.length > 0);
});

test("repeated inventory postings are flagged without claiming confirmed fraud or root cause", () => {
  const report = investigateEvidence(
    scenarios.duplicateInventoryPosting,
  );
  const expected = expectedOutcomes.duplicateInventoryPosting;

  const finding = report.findings.find((item) =>
    item.id.startsWith(expected.expectedFindingPrefix),
  );

  assert.ok(finding, "Expected a possible duplicate-posting finding");
  assert.equal(finding.confidence, "Medium");

  for (const evidenceId of expected.requiredEvidenceIds) {
    assert.ok(
      finding.supportingEvidenceIds.includes(evidenceId),
      `Finding should reference ${evidenceId}`,
    );
  }

  assert.match(finding.title, /possible duplicate/i);
  assert.ok(
    finding.limitations.some((limitation) =>
      /do not alone prove duplication/i.test(limitation),
    ),
  );
});

test("unrelated operational records do not create unsupported findings", () => {
  const report = investigateEvidence(scenarios.unrelatedEvidence);
  const expected = expectedOutcomes.unrelatedEvidence;

  assert.equal(report.findings.length, expected.expectedFindingCount);
  assert.match(report.conclusion, /no supported pattern/i);
});

test("every reported evidence reference exists in the supplied dataset", () => {
  for (const scenario of Object.values(scenarios)) {
    const report = investigateEvidence(scenario);
    const suppliedIds = new Set(
      scenario.records.map((item) => item.id),
    );

    for (const finding of report.findings) {
      for (const evidenceId of finding.supportingEvidenceIds) {
        assert.ok(
          suppliedIds.has(evidenceId),
          `Finding references unknown evidence: ${evidenceId}`,
        );
      }
    }
  }
});

test("investigation report preserves its target reference", () => {
  for (const scenario of Object.values(scenarios)) {
    const report = investigateEvidence(scenario);
    assert.equal(report.targetReference, scenario.targetReference);
  }
});
