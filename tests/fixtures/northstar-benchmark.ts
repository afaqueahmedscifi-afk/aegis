
import type { EvidenceRecord } from "../../src/lib/evidence-investigation.ts";

const BRANCHES = Array.from(
  { length: 12 },
  (_, index) => `NS-${String(index + 1).padStart(3, "0")}`,
);

const DAYS = 90;
const START = Date.parse("2026-07-01T00:00:00.000Z");

export interface BenchmarkTruth {
  scenarioId: string;
  expectedFindingPrefix: "POS-CLOSE-" | "INV-DUPLICATE-";
  expectedEvidenceIds: string[];
  branchCode: string;
}

const records: EvidenceRecord[] = [];
const groundTruth: BenchmarkTruth[] = [];

function timestamp(day: number, hour = 10): string {
  return new Date(
    START + day * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000,
  ).toISOString();
}

function add(record: EvidenceRecord): void {
  records.push(record);
}

// Baseline: 12 branches x 90 days.
// Each accepted POS transaction is included in its completed close batch.
for (let branchIndex = 0; branchIndex < BRANCHES.length; branchIndex++) {
  const branchCode = BRANCHES[branchIndex];

  for (let day = 0; day < DAYS; day++) {
    const transactionId = `NS-POS-${branchIndex}-${day}`;
    const batchId = `NS-BATCH-${branchIndex}-${day}`;

    add({
      id: transactionId,
      domain: "POS",
      type: "pos_transaction",
      branchCode,
      occurredAt: timestamp(day),
      reference: `TX-${branchIndex}-${day}`,
      fields: {
        status: "accepted",
        closeBatchId: batchId,
        amount: 100 + ((branchIndex * 17 + day * 13) % 900),
      },
    });

    add({
      id: `NS-CLOSE-${branchIndex}-${day}`,
      domain: "Finance",
      type: "close_batch",
      branchCode,
      occurredAt: timestamp(day, 23),
      fields: {
        status: "completed",
        batchId,
        transactionIds: [transactionId],
      },
    });
  }
}

// Ten planted POS reconciliation scenarios.
// Each has an accepted transaction, an empty completed batch,
// and a failed synchronization event referencing that transaction.
for (let index = 0; index < 10; index++) {
  const branchCode = BRANCHES[index % BRANCHES.length];
  const day = 5 + index * 7;
  const transactionId = `NS-ANOM-POS-TX-${index + 1}`;
  const batchId = `NS-ANOM-POS-BATCH-${index + 1}`;
  const batchRecordId = `NS-ANOM-POS-CLOSE-${index + 1}`;
  const syncId = `NS-ANOM-POS-SYNC-${index + 1}`;

  add({
    id: transactionId,
    domain: "POS",
    type: "pos_transaction",
    branchCode,
    occurredAt: timestamp(day),
    fields: {
      status: "accepted",
      closeBatchId: batchId,
      amount: 450 + index * 10,
    },
  });

  add({
    id: batchRecordId,
    domain: "Finance",
    type: "close_batch",
    branchCode,
    occurredAt: timestamp(day, 23),
    fields: {
      status: "completed",
      batchId,
      transactionIds: [],
    },
  });

  add({
    id: syncId,
    domain: "Technology",
    type: "sync_event",
    branchCode,
    occurredAt: timestamp(day, 11),
    fields: {
      status: "failed",
      transactionId,
      errorCode: "SYNC_TIMEOUT",
    },
  });

  groundTruth.push({
    scenarioId: `NS-SCENARIO-POS-${index + 1}`,
    expectedFindingPrefix: "POS-CLOSE-",
    expectedEvidenceIds: [transactionId, syncId],
    branchCode,
  });
}

// Ten planted duplicate-posting scenarios.
// Two separate posting records use the same branch, receipt, SKU and quantity.
for (let index = 0; index < 10; index++) {
  const branchCode = BRANCHES[(index + 2) % BRANCHES.length];
  const receiptId = `NS-GRN-${index + 1}`;
  const sku = `SKU-${String(index + 1).padStart(3, "0")}`;
  const firstId = `NS-ANOM-INV-A-${index + 1}`;
  const secondId = `NS-ANOM-INV-B-${index + 1}`;
  const day = 8 + index * 6;
  const quantity = 10 + index;

  for (const id of [firstId, secondId]) {
    add({
      id,
      domain: "Inventory",
      type: "inventory_posting",
      branchCode,
      occurredAt: timestamp(day, 12),
      fields: {
        receiptId,
        sku,
        quantity,
      },
    });
  }

  groundTruth.push({
    scenarioId: `NS-SCENARIO-INV-${index + 1}`,
    expectedFindingPrefix: "INV-DUPLICATE-",
    expectedEvidenceIds: [firstId, secondId],
    branchCode,
  });
}

// Export evidence separately from the hidden expected outcomes.
// Pass only benchmarkRecords to the investigation engine.
export const benchmarkRecords: EvidenceRecord[] = records;
export const benchmarkGroundTruth: BenchmarkTruth[] = groundTruth;
export const benchmarkMetadata = {
  organization: "Northstar Hospitality Group",
  branchCount: BRANCHES.length,
  days: DAYS,
  expectedScenarioCount: groundTruth.length,
  evidenceRecordCount: records.length,
};
