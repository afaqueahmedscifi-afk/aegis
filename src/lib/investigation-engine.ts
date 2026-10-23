export type InvestigationRecord = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  category: string;
  severity: string;
  status: string;
  evidence: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  branch: {
    code: string;
    name: string;
    city: string | null;
  };
};

export type RelatedIncident = {
  reference: string;
  title: string;
  branch: string;
  category: string;
  status: string;
  severity: string;
  correlationScore: number;
  associationStrength: "Strong" | "Moderate" | "Weak";
  reasons: string[];
};

const STOP_WORDS = new Set([
  "for", "only", "the", "simulated",
  "about", "after", "again", "also", "and", "are", "been", "before",
  "between", "branch", "could", "from", "have", "into", "issue",
  "issues", "incident", "just", "more", "most", "other", "same",
  "some", "than", "that", "their", "there", "these", "they", "this",
  "through", "under", "very", "was", "were", "when", "where", "which",
  "while", "with", "would", "your",
  "demo", "fictional", "record", "records",
  "sample", "example", "test", "testing",
  "data", "general", "unknown", "none",
  "null", "undefined", "placeholder"
]);

function terms(record: InvestigationRecord): Set<string> {
  const content = [
    record.title,
    record.description ?? "",
    record.category,
    record.evidence ?? "",
    record.notes ?? ""
  ].join(" ").toLowerCase();

  return new Set(
    content
      .split(/[^a-z0-9]+/)
      .filter(word =>
        word.length >= 3 &&
        !STOP_WORDS.has(word) &&
        !/^\d+$/.test(word)
      )
  );
}
function errorCodes(record: InvestigationRecord): Set<string> {
  const content = [
    record.title,
    record.description ?? "",
    record.evidence ?? "",
    record.notes ?? "",
  ].join(" ");

  const matches = content.match(/\b[A-Z][A-Z0-9]*-\d+[A-Z0-9-]*\b/gi) ?? [];

  return new Set(matches.map((code) => code.toUpperCase()));
}
export function correlateIncidents(
  target: InvestigationRecord,
  candidates: InvestigationRecord[]
): RelatedIncident[] {
  const targetTerms = terms(target);
  const targetErrorCodes = errorCodes(target);

  return candidates
    .filter(candidate => candidate.id !== target.id)
    .map(candidate => {
      let score = 0;
const reasons: string[] = [];

const sharedErrorCodes = [...errorCodes(candidate)].filter(
  (code) => targetErrorCodes.has(code),
);

if (sharedErrorCodes.length > 0) {
  score += 40;
  reasons.push(
    `Exact shared error code(s): ${sharedErrorCodes.slice(0, 3).join(", ")}`,
  );
}

      if (candidate.branch.code === target.branch.code) {
        score += 35;
        reasons.push("Same branch");
      }

      if (
        candidate.category.trim().toLowerCase() ===
        target.category.trim().toLowerCase()
      ) {
        score += 25;
        reasons.push("Same category");
      }

      const overlap = [...terms(candidate)].filter(
        word => targetTerms.has(word)
      );

      if (overlap.length > 0) {
        score += Math.min(20, overlap.length * 5);
        reasons.push(`Shared terms: ${overlap.slice(0, 4).join(", ")}`);
      }

      const hoursApart = Math.abs(
        candidate.createdAt.getTime() - target.createdAt.getTime()
      ) / 3600000;

      if (hoursApart <= 24) {
        score += 15;
        reasons.push("Created within 24 hours");
      } else if (hoursApart <= 72) {
        score += 8;
        reasons.push("Created within 72 hours");
      }

      if (candidate.severity === target.severity) {
        score += 5;
        reasons.push("Same severity");
      }

      const correlationScore = Math.min(score, 100);

      return {
        reference: candidate.reference,
        title: candidate.title,
        branch: candidate.branch.name,
        category: candidate.category,
        status: candidate.status,
        severity: candidate.severity,
        correlationScore,
        associationStrength:
          correlationScore >= 65
            ? "Strong" as const
            : correlationScore >= 40
              ? "Moderate" as const
              : "Weak" as const,
        reasons
      };
    })
    .filter(item => item.correlationScore >= 25)
    .sort((a, b) => b.correlationScore - a.correlationScore)
    .slice(0, 8);
}

export type InvestigationHypothesis = {
  title: string;
  explanation: string;
  confidence: "Low" | "Moderate";
  supportingReferences: string[];
  limitations: string;
};

export function generateHypotheses(
  target: InvestigationRecord,
  related: RelatedIncident[]
): InvestigationHypothesis[] {
  const hypotheses: InvestigationHypothesis[] = [];

  const sameBranchAndCategory = related.filter(
    item =>
      item.branch === target.branch.name &&
      item.category.trim().toLowerCase() ===
        target.category.trim().toLowerCase()
  );

  if (sameBranchAndCategory.length > 0) {
    hypotheses.push({
      title: "Possible recurring branch-level issue",
      explanation:
        `Found ${sameBranchAndCategory.length} related incident(s) ` +
        "at the same branch and in the same category. " +
        "Investigate whether a shared process, device, or system is involved.",
      confidence: "Moderate",
      supportingReferences: sameBranchAndCategory.map(
        item => item.reference
      ),
      limitations:
        "A shared branch and category do not prove a common root cause. " +
        "Verify the timeline and inspect supporting logs."
    });
  }

  const textMatches = related.filter(item =>
    item.reasons.some(reason => reason.startsWith("Shared terms:"))
  );

  if (textMatches.length > 0) {
    hypotheses.push({
      title: "Possible shared operational symptom",
      explanation:
        "Some incidents contain overlapping descriptive terms. " +
        "Compare the original evidence to determine whether the symptoms share a cause.",
      confidence: "Low",
      supportingReferences: textMatches.map(item => item.reference),
      limitations:
        "Text similarity may be coincidental. Confirm with timestamps, system logs, " +
        "transaction identifiers, or other independent evidence."
    });
  }

  if (hypotheses.length === 0) {
    hypotheses.push({
      title: "Insufficient correlated evidence",
      explanation:
        "The available incidents do not yet establish a meaningful relationship " +
        "under the current correlation rules.",
      confidence: "Low",
      supportingReferences: [],
      limitations:
        "This does not prove the issue is isolated. More reliable evidence " +
        "may reveal a connection."
    });
  }

  return hypotheses;
}
