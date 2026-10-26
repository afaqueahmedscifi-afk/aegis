
import { NextResponse } from "next/server";
import { validateEvidenceInvestigationReport } from "@/lib/finding-validation";
import {
  investigateEvidence,
  type EvidenceRecord,
  type EvidenceValue,
} from "@/lib/evidence-investigation";

const MAX_RECORDS = 500;
const MAX_STRING_LENGTH = 2000;
const MAX_BODY_BYTES = 1_000_000;

class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body is too large.");
    this.name = "RequestBodyTooLargeError";
  }
}

async function readLimitedBody(request: Request): Promise<string> {
  const contentLengthHeader = request.headers.get("content-length");

  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);

    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bodyBytes);
}

function isEvidenceValue(value: unknown): value is EvidenceValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "string" || value.length <= MAX_STRING_LENGTH;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return (
    Array.isArray(value) &&
    value.length <= 200 &&
    value.every(
      (item) =>
        typeof item === "string" &&
        item.length <= MAX_STRING_LENGTH,
    )
  );
}

function isEvidenceRecord(value: unknown): value is EvidenceRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.id !== "string" ||
    record.id.length < 1 ||
    record.id.length > 100 ||
    typeof record.domain !== "string" ||
    record.domain.length < 1 ||
    record.domain.length > 100 ||
    typeof record.type !== "string" ||
    record.type.length < 1 ||
    record.type.length > 100 ||
    typeof record.branchCode !== "string" ||
    record.branchCode.length < 1 ||
    record.branchCode.length > 100 ||
    typeof record.occurredAt !== "string" ||
    record.occurredAt.length > 50 ||
    !Number.isFinite(Date.parse(record.occurredAt)) ||
    (record.reference !== undefined &&
      (typeof record.reference !== "string" ||
        record.reference.length > 200)) ||
        !record.fields ||
    typeof record.fields !== "object" ||
    Array.isArray(record.fields) ||
    typeof record.investigationReference !== "string" ||
    record.investigationReference.trim().length === 0 ||
    record.investigationReference.length > 100
  ) {
    return false;
  }

  const fields = record.fields as Record<string, unknown>;
  const entries = Object.entries(fields);

  return (
    entries.length <= 100 &&
    entries.every(
      ([key, fieldValue]) =>
        key.length > 0 &&
        key.length <= 100 &&
        isEvidenceValue(fieldValue),
    )
  );
}

export async function POST(request: Request) {
  try {
    const rawBody = await readLimitedBody(request);
    const payload: unknown = JSON.parse(rawBody);

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json(
        { success: false, error: "A JSON object is required." },
        { status: 400 },
      );
    }

    const body = payload as Record<string, unknown>;

    if (
      typeof body.targetReference !== "string" ||
      body.targetReference.trim().length === 0 ||
      body.targetReference.length > 100 ||
      !Array.isArray(body.records) ||
      body.records.length === 0 ||
      body.records.length > MAX_RECORDS
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Provide a targetReference and between 1 and ${MAX_RECORDS} evidence records.`,
        },
        { status: 400 },
      );
    }

    if (!body.records.every(isEvidenceRecord)) {
      return NextResponse.json(
        {
          success: false,
          error: "One or more evidence records have an invalid structure.",
        },
        { status: 400 },
      );
    }

    const records = body.records as EvidenceRecord[];
    const targetReference = body.targetReference.trim();

if (
  records.some(
    (record) =>
      record.investigationReference !== targetReference,
  )
) {
  return NextResponse.json(
    {
      success: false,
      error:
        "Every evidence record must be explicitly associated with the selected investigation.",
    },
    { status: 400 },
  );
}
    const ids = records.map((record) => record.id);

    if (new Set(ids).size !== ids.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Evidence record IDs must be unique within a request.",
        },
        { status: 400 },
      );
    }

    const report = investigateEvidence({
      targetReference,
      records,
    });

    if (
      !validateEvidenceInvestigationReport(
        report,
        targetReference,
        records,
      )
    ) {
      console.error("AEGIS generated an invalid evidence investigation report.");

      return NextResponse.json(
        {
          success: false,
          error: "The generated report failed evidence validation.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      success: true,
      engine: "AEGIS Evidence Investigation Engine",
      engineVersion: "0.1.0",
      report,
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { success: false, error: "Request body is too large." },
        { status: 413 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "Request body must contain valid JSON." },
        { status: 400 },
      );
    }

    console.error("AEGIS evidence analysis error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to analyze the supplied evidence." },
      { status: 500 },
    );
  }
}
