
export type EvidenceValue =
  | string
  | number
  | boolean
  | null
  | string[];

export interface EvidenceRecord {
  id: string;
  domain: string;
  type: string;
  branchCode: string;
  occurredAt: string;
  reference?: string;
  fields: Record<string, EvidenceValue>;
}

export interface InvestigationFinding {
  id: string;
  title: string;
  explanation: string;
  confidence: "High" | "Medium" | "Low";
  supportingEvidenceIds: string[];
  limitations: string[];
}

export interface EvidenceInvestigationReport {
  targetReference: string;
  findings: InvestigationFinding[];
  observedFacts: string[];
  missingInformation: string[];
  conclusion: string;
}

export interface EvidenceInvestigationInput {
  targetReference: string;
  records: EvidenceRecord[];
}

function field(
  record: EvidenceRecord,
  name: string,
): EvidenceValue | undefined {
  return record.fields[name];
}

function textField(
  record: EvidenceRecord,
  name: string,
): string | undefined {
  const value = field(record, name);
  return typeof value === "string" ? value : undefined;
}

function numberField(
  record: EvidenceRecord,
  name: string,
): number | undefined {
  const value = field(record, name);
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function findingId(
  prefix: string,
  evidenceIds: string[],
): string {
  return `${prefix}-${unique(evidenceIds).sort().join("-")}`;
}

function detectPosCloseIssues(
  records: EvidenceRecord[],
): InvestigationFinding[] {
  const findings: InvestigationFinding[] = [];

  const transactions = records.filter(
    (record) => record.type === "pos_transaction",
  );

  const completedBatches = records.filter(
    (record) =>
      record.type === "close_batch" &&
      textField(record, "status")?.toLowerCase() === "completed",
  );

  const failedSyncEvents = records.filter(
    (record) =>
      record.type === "sync_event" &&
      textField(record, "status")?.toLowerCase() === "failed",
  );

  for (const transaction of transactions) {
    if (
      textField(transaction, "status")?.toLowerCase() !== "accepted"
    ) {
      continue;
    }

    const batchId = textField(transaction, "closeBatchId");

    const relevantBatch = completedBatches.find(
      (batch) =>
        batch.branchCode === transaction.branchCode &&
        textField(batch, "batchId") === batchId,
    );

    if (batchId && relevantBatch) {
      const includedIds = field(relevantBatch, "transactionIds");
      const included =
        Array.isArray(includedIds) &&
        includedIds.includes(transaction.id);

      if (included) {
        continue;
      }
    }

    const failedSync = failedSyncEvents.find(
      (event) =>
        event.branchCode === transaction.branchCode &&
        textField(event, "transactionId") === transaction.id,
    );

    if (!batchId || !relevantBatch || failedSync) {
      const evidenceIds = unique([
        transaction.id,
        ...(relevantBatch ? [relevantBatch.id] : []),
        ...(failedSync ? [failedSync.id] : []),
      ]);

      findings.push({
        id: findingId("POS-CLOSE", evidenceIds),
        title: failedSync
          ? "POS transaction and failed synchronization event"
          : "Accepted POS transaction may be missing from close reconciliation",
        explanation: failedSync
          ? `Transaction ${transaction.id} was accepted, and a failed synchronization event references that transaction. The available records warrant checking whether the failure affected day-close reconciliation.`
          : `Transaction ${transaction.id} was accepted, but the available records do not establish its inclusion in a completed close batch.`,
        confidence: failedSync ? "High" : "Medium",
        supportingEvidenceIds: evidenceIds,

limitations: [
  "The records identify a reconciliation concern but do not establish its financial impact.",
  "Confirm transaction amounts, batch membership, and the final settlement or close totals.",
  ...(failedSync
    ? [
        "The synchronization failure may be associated with the discrepancy, but its causal impact still requires verification.",
      ]
    : [
        "Missing batch information may reflect incomplete evidence rather than an actual system failure.",
      ]),
],

      });
    }
  }

  return findings;
}

function detectPossibleDuplicateInventoryPostings(
  records: EvidenceRecord[],
): InvestigationFinding[] {
  const findings: InvestigationFinding[] = [];

  const postings = records.filter(
    (record) => record.type === "inventory_posting",
  );

  const groups = new Map<string, EvidenceRecord[]>();

  for (const posting of postings) {
    const receiptId = textField(posting, "receiptId");
    const sku = textField(posting, "sku");
    const quantity = numberField(posting, "quantity");

    if (
      !receiptId ||
      !sku ||
      quantity === undefined ||
      quantity <= 0
    ) {
      continue;
    }

    const key = [
      posting.branchCode,
      receiptId,
      sku,
      String(quantity),
    ].join("|");

    const group = groups.get(key) ?? [];
    group.push(posting);
    groups.set(key, group);
  }

  for (const [key, group] of groups) {
    const distinctPostingIds = unique(
      group.map((posting) => posting.id),
    );

    if (distinctPostingIds.length < 2) {
      continue;
    }

    const [branchCode, receiptId, sku, quantity] = key.split("|");
    const evidenceIds = unique(group.map((posting) => posting.id));

    findings.push({
      id: findingId("INV-DUPLICATE", evidenceIds),
      title: "Possible duplicate inventory receipt posting",
      explanation:
        `Receipt ${receiptId} has multiple inventory postings with the same branch, SKU, and quantity (${quantity}). This pattern may indicate duplicate posting and should be reconciled against the original receipt.`,
      confidence: "Medium",
      supportingEvidenceIds: evidenceIds,
      limitations: [
        `Branch: ${branchCode}; SKU: ${sku}.`,
        "Repeated quantities do not alone prove duplication; legitimate split or reversal-and-repost workflows must be ruled out.",
        "Verify the supplier document, posting timestamps, reversal records, and physical stock count before assigning root cause.",
      ],
    });
  }

  return findings;
}

export function investigateEvidence(
  input: EvidenceInvestigationInput,
): EvidenceInvestigationReport {
  const records = input.records;
  const findings = [
    ...detectPosCloseIssues(records),
    ...detectPossibleDuplicateInventoryPostings(records),
  ];

  const observedFacts = records.map(
    (record) =>
      `${record.id}: ${record.domain}/${record.type} recorded for branch ${record.branchCode} at ${record.occurredAt}.`,
  );

  const missingInformation: string[] = [];

  if (
    records.some((record) => record.type === "pos_transaction") &&
    !records.some((record) => record.type === "close_batch")
  ) {
    missingInformation.push(
      "Close-batch records and transaction-to-batch reconciliation details.",
    );
  }

  if (
    records.some((record) => record.type === "inventory_posting") &&
    !records.some((record) => record.type === "physical_count")
  ) {
    missingInformation.push(
      "Physical inventory counts for the relevant SKUs and period.",
    );
  }

  if (findings.length === 0) {
    missingInformation.push(
      "Additional system-specific evidence is needed to identify a supported operational explanation.",
    );
  }

  const conclusion =
    findings.length > 0
      ? `${findings.length} evidence-based finding(s) require verification. No finding should be treated as a confirmed root cause until its limitations have been addressed.`
      : "No supported pattern was detected by the current rules. This does not prove that the operation is healthy or that no underlying issue exists.";

  return {
    targetReference: input.targetReference,
    findings,
    observedFacts,
    missingInformation: unique(missingInformation),
    conclusion,
  };
}
