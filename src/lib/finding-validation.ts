import type {
  EvidenceInvestigationReport,
  EvidenceRecord,
  InvestigationFinding,
} from "./evidence-investigation";

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  );
}

function isFinding(value: unknown): value is InvestigationFinding {
  if (!isObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.explanation) &&
    (value.confidence === "High" ||
      value.confidence === "Medium" ||
      value.confidence === "Low") &&
    Array.isArray(value.supportingEvidenceIds) &&
    value.supportingEvidenceIds.length > 0 &&
    value.supportingEvidenceIds.every(isNonEmptyString) &&
    isStringArray(value.limitations) &&
    value.limitations.length > 0 &&
    value.limitations.every(isNonEmptyString)
  );
}

export function validateEvidenceInvestigationReport(
  value: unknown,
  expectedTargetReference: string,
  records: EvidenceRecord[],
): value is EvidenceInvestigationReport {
  if (!isObject(value)) {
    return false;
  }

  if (
    !isNonEmptyString(expectedTargetReference) ||
    value.targetReference !== expectedTargetReference ||
    !Array.isArray(value.findings) ||
    !isStringArray(value.observedFacts) ||
    !isStringArray(value.missingInformation) ||
    !isNonEmptyString(value.conclusion)
  ) {
    return false;
  }

  if (
    !value.observedFacts.every(isNonEmptyString) ||
    !value.missingInformation.every(isNonEmptyString) ||
    !value.findings.every(isFinding)
  ) {
    return false;
  }

  if (
    records.some(
      (record) =>
        record.investigationReference !== expectedTargetReference,
    )
  ) {
    return false;
  }

  const recordIds = records.map((record) => record.id);

  // Duplicate record IDs make evidence references ambiguous.
  if (new Set(recordIds).size !== recordIds.length) {
    return false;
  }

  const suppliedEvidenceIds = new Set(recordIds);
  const findings = value.findings as InvestigationFinding[];
  const findingIds = findings.map((finding) => finding.id);

  if (new Set(findingIds).size !== findingIds.length) {
    return false;
  }

  return findings.every((finding) => {
    const evidenceIds = finding.supportingEvidenceIds;

    // Each finding must refer only to evidence supplied for this request.
    return (
      new Set(evidenceIds).size === evidenceIds.length &&
      evidenceIds.every((id) => suppliedEvidenceIds.has(id))
    );
  });
}
