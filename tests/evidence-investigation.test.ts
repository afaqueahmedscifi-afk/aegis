
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
    investigationReference:
      overrides.investigationReference ?? "UNASSIGNED",
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
for (const scenario of Object.values(scenarios)) {
  scenario.records = scenario.records.map((item) => ({
    ...item,
    investigationReference: scenario.targetReference,
  }));
}
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
  assert.equal(finding.confidence, "Medium");

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
test("accepted POS transaction missing from a completed batch is flagged without a sync failure", () => {
  const records = scenarios.posSyncFailure.records
    .filter((item) => item.type !== "sync_event")
    .map((item) => ({
      ...item,
      investigationReference: "NS-POS-MISSING-FROM-BATCH",
    }));

  const report = investigateEvidence({
    targetReference: "NS-POS-MISSING-FROM-BATCH",
    records,
  });

  const finding = report.findings.find((item) =>
    item.id.startsWith("POS-CLOSE-"),
  );

  assert.ok(
    finding,
    "Expected a finding when the completed batch omits the transaction",
  );

  assert.equal(finding.confidence, "Medium");
  assert.ok(finding.supportingEvidenceIds.includes("EV-POS-001"));
  assert.ok(finding.supportingEvidenceIds.includes("EV-POS-003"));
  assert.match(finding.explanation, /accepted/i);
  assert.ok(finding.limitations.length > 0);
});

test("POS close reconciliation reports a supported settlement difference", () => {
  const targetReference = "AEGIS-SIM-POS-CLOSE-001";

  const records = [
    record({
      id: "POS-001-01",
      domain: "POS",
      type: "pos_close_summary",
      investigationReference: targetReference,
      fields: {
        batchId: "BATCH-001",
        salesTotal: 5000,
        voidTotal: 0,
        refundTotal: 0,
        currency: "SAR",
      },
    }),
    record({
      id: "POS-001-02",
      domain: "PAYMENTS",
      type: "settlement_summary",
      investigationReference: targetReference,
      fields: {
        batchId: "BATCH-001",
        settledTotal: 4600,
        currency: "SAR",
      },
    }),
    record({
      id: "POS-001-03",
      domain: "POS",
      type: "pos_transaction",
      investigationReference: targetReference,
      fields: {
        transactionId: "TX-101",
        status: "accepted",
        amount: 400,
        batchId: "BATCH-001",
      },
    }),
    record({
      id: "POS-001-05",
      domain: "PAYMENTS",
      type: "payment_event",
      investigationReference: targetReference,
      fields: {
        transactionId: "TX-101",
        authorizationStatus: "approved",
        captureStatus: "pending",
        amount: 400,
        currency: "SAR",
      },
    }),
  ];

  const report = investigateEvidence({ targetReference, records });
  const finding = report.findings.find((item) =>
    item.id.startsWith("POS-RECON-"),
  );

  assert.ok(finding, "Expected a numerical settlement discrepancy finding");
  assert.match(finding.explanation, /400/);
  assert.match(finding.explanation, /SAR/);

  for (const id of ["POS-001-01", "POS-001-02"]) {
    assert.ok(finding.supportingEvidenceIds.includes(id));
  }

  assert.ok(
    finding.limitations.length > 0,
    "The finding must explain what remains unverified",
  );
});

test("POS settlement difference does not claim a confirmed loss when refunds and voids exist", () => {
  const targetReference = "AEGIS-POS-REFUNDS-TEST";

  const records = [
    record({
      id: "POS-REFUND-CLOSE",
      domain: "POS",
      type: "pos_close_summary",
      investigationReference: targetReference,
      fields: {
        batchId: "BATCH-REFUND-001",
        salesTotal: 5000,
        voidTotal: 200,
        refundTotal: 300,
        currency: "SAR",
      },
    }),
    record({
      id: "POS-REFUND-SETTLEMENT",
      domain: "PAYMENTS",
      type: "settlement_summary",
      investigationReference: targetReference,
      fields: {
        batchId: "BATCH-REFUND-001",
        settledTotal: 4500,
        currency: "SAR",
      },
    }),
  ];

  const report = investigateEvidence({ targetReference, records });
  const finding = report.findings.find((item) =>
    item.id.startsWith("POS-RECON-"),
  );

  assert.ok(finding, "Expected a reconciliation difference finding");
  assert.match(finding.explanation, /5000\.00/);
  assert.match(finding.explanation, /4500\.00/);
  assert.ok(
    finding.limitations.some((limitation) =>
      /accounting scopes|refund|void|timing/i.test(limitation),
    ),
    "The finding should acknowledge accounting-scope or timing uncertainty",
  );
  assert.doesNotMatch(finding.title, /lost money|confirmed loss/i);
});

test("POS settlement reconciliation skips summaries with missing currency", () => {
  const targetReference = "AEGIS-POS-MISSING-CURRENCY";

  const records = [
    record({
      id: "POS-MISSING-CURRENCY-CLOSE",
      domain: "POS",
      type: "pos_close_summary",
      investigationReference: targetReference,
      fields: {
        batchId: "BATCH-MISSING-CURRENCY",
        salesTotal: 5000,
        currency: "SAR",
      },
    }),
    record({
      id: "POS-MISSING-CURRENCY-SETTLEMENT",
      domain: "PAYMENTS",
      type: "settlement_summary",
      investigationReference: targetReference,
      fields: {
        batchId: "BATCH-MISSING-CURRENCY",
        settledTotal: 4600,
      },
    }),
  ];

  const report = investigateEvidence({ targetReference, records });

  assert.equal(
    report.findings.some((item) => item.id.startsWith("POS-RECON-")),
    false,
    "A settlement without currency must not be compared to a currency-specific POS total",
  );
});

test("duplicate pending payment events are not double-counted in the diagnostic lead", () => {
  const targetReference = "AEGIS-POS-DUPLICATE-PAYMENT-TEST";

  const records = [
    record({
      id: "DUP-POS-CLOSE",
      domain: "POS",
      type: "pos_close_summary",
      investigationReference: targetReference,
      fields: {
        batchId: "DUP-BATCH-001",
        salesTotal: 5000,
        currency: "SAR",
      },
    }),
    record({
      id: "DUP-SETTLEMENT",
      domain: "PAYMENTS",
      type: "settlement_summary",
      investigationReference: targetReference,
      fields: {
        batchId: "DUP-BATCH-001",
        settledTotal: 4600,
        currency: "SAR",
      },
    }),
    record({
      id: "DUP-POS-TX",
      domain: "POS",
      type: "pos_transaction",
      investigationReference: targetReference,
      fields: {
        transactionId: "TX-DUP-001",
        status: "accepted",
        amount: 400,
        batchId: "DUP-BATCH-001",
      },
    }),
    ...["DUP-PAYMENT-EVENT-1", "DUP-PAYMENT-EVENT-2"].map((id) =>
      record({
        id,
        domain: "PAYMENTS",
        type: "payment_event",
        investigationReference: targetReference,
        fields: {
          transactionId: "TX-DUP-001",
          captureStatus: "pending",
          amount: 400,
          currency: "SAR",
        },
      }),
    ),
  ];

  const report = investigateEvidence({ targetReference, records });
  const finding = report.findings.find((item) =>
    item.id.startsWith("POS-RECON-"),
  );

  assert.ok(finding, "Expected a POS reconciliation finding");
  assert.match(
    finding.explanation,
    /pending payment captures total SAR 400\.00/,
    "Repeated events for one transaction should not inflate its pending amount",
  );
  assert.ok(
    finding.limitations.some((limitation) =>
      /overlap|discrepanc/i.test(limitation),
    ),
    "The finding should retain its uncertainty limitation",
  );
});
