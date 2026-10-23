import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL =
  process.env.AEGIS_TEST_BASE_URL ?? "http://127.0.0.1:3000";

const ENDPOINT = `${BASE_URL}/api/investigations/evidence-analyze`;

function validRecord(overrides = {}) {
  return {
    id: "API-TX-001",
    domain: "POS",
    type: "pos_transaction",
    branchCode: "BR-001",
    occurredAt: "2026-10-22T10:00:00Z",
    fields: {
      status: "accepted",
      closeBatchId: "BATCH-001",
    },
    ...overrides,
  };
}

function validBody(overrides = {}) {
  return {
    targetReference: "API-VALIDATION-TEST",
    records: [validRecord()],
    ...overrides,
  };
}

async function postRaw(
  body: string,
  headers: Record<string, string> = {},
) {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });
}

async function postJson(body: unknown) {
  return postRaw(JSON.stringify(body));
}

test("valid evidence request returns a report", async () => {
  const response = await postJson(validBody());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.engineVersion, "0.1.0");
  assert.equal(
    payload.report.targetReference,
    "API-VALIDATION-TEST",
  );
  assert.ok(Array.isArray(payload.report.findings));
});

test("malformed JSON returns HTTP 400", async () => {
  const response = await postRaw('{"targetReference":');
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.error, /valid JSON/i);
});

test("a JSON array instead of an object returns HTTP 400", async () => {
  const response = await postJson([]);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.error, /JSON object/i);
});

test("missing target reference is rejected", async () => {
  const response = await postJson({
    records: [validRecord()],
  });

  assert.equal(response.status, 400);
});

test("empty evidence array is rejected", async () => {
  const response = await postJson(validBody({ records: [] }));

  assert.equal(response.status, 400);
});

test("more than 500 evidence records are rejected", async () => {
  const records = Array.from(
    { length: 501 },
    (_, index) => validRecord({ id: `API-TX-${index}` }),
  );

  const response = await postJson(validBody({ records }));

  assert.equal(response.status, 400);
});

test("duplicate evidence IDs are rejected", async () => {
  const response = await postJson(
    validBody({
      records: [
        validRecord({ id: "DUPLICATE-ID" }),
        validRecord({ id: "DUPLICATE-ID" }),
      ],
    }),
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error, /IDs must be unique/i);
});

test("invalid timestamps are rejected", async () => {
  const response = await postJson(
    validBody({
      records: [
        validRecord({ occurredAt: "not-a-date" }),
      ],
    }),
  );

  assert.equal(response.status, 400);
});

test("unsupported nested object field values are rejected", async () => {
  const response = await postJson(
    validBody({
      records: [
        validRecord({
          fields: {
            unexpected: { nested: "object" },
          },
        }),
      ],
    }),
  );

  assert.equal(response.status, 400);
});

test("request bodies over one megabyte are rejected", async () => {
  const oversizedBody = JSON.stringify({
    targetReference: "API-OVERSIZE-TEST",
    records: [],
    padding: "x".repeat(1_000_100),
  });

  const response = await postRaw(oversizedBody);
  const payload = await response.json();

  assert.equal(response.status, 413);
  assert.equal(payload.success, false);
  assert.match(payload.error, /too large/i);
});

test("streamed request bodies over one megabyte are rejected without Content-Length", async () => {
  const oversizedBody = JSON.stringify({
    targetReference: "STREAM-LIMIT-TEST",
    records: [validRecord()],
    padding: "x".repeat(1_000_001),
  });

  const bytes = new TextEncoder().encode(oversizedBody);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  assert.equal(response.status, 413);
});
