
import test from "node:test";
import assert from "node:assert/strict";

import { investigateEvidence } from "../src/lib/evidence-investigation.ts";

import {
  benchmarkRecords,
  benchmarkGroundTruth,
  benchmarkMetadata,
} from "./fixtures/northstar-benchmark.ts";

test("Northstar fixture has the planned organization scale", () => {
  assert.equal(benchmarkMetadata.branchCount, 12);
  assert.equal(benchmarkMetadata.days, 90);
  assert.equal(benchmarkMetadata.expectedScenarioCount, 20);
  assert.equal(benchmarkGroundTruth.length, 20);
  assert.ok(benchmarkRecords.length > 2_000);
});

test("benchmark detects all planted POS synchronization patterns", () => {
  const scenarios = benchmarkGroundTruth.filter(
    (scenario) => scenario.expectedFindingPrefix === "POS-CLOSE-",
  );

  for (const scenario of scenarios) {
    const report = investigateEvidence({
      targetReference: scenario.scenarioId,
      records: benchmarkRecords.filter(
        (record) => record.branchCode === scenario.branchCode,
      ),
    });

    const finding = report.findings.find((item) =>
      item.id.startsWith(scenario.expectedFindingPrefix),
    );

    assert.ok(
      finding,
      `No POS finding for ${scenario.scenarioId}`,
    );

    for (const evidenceId of scenario.expectedEvidenceIds) {
      assert.ok(
        finding.supportingEvidenceIds.includes(evidenceId),
        `${scenario.scenarioId} is missing evidence ${evidenceId}`,
      );
    }
  }
});

test("benchmark detects all planted duplicate inventory patterns", () => {
  const scenarios = benchmarkGroundTruth.filter(
    (scenario) => scenario.expectedFindingPrefix === "INV-DUPLICATE-",
  );

  for (const scenario of scenarios) {
    const report = investigateEvidence({
      targetReference: scenario.scenarioId,
      records: benchmarkRecords.filter(
        (record) => record.branchCode === scenario.branchCode,
      ),
    });

    const finding = report.findings.find((item) =>
      item.id.startsWith(scenario.expectedFindingPrefix),
    );

    assert.ok(
      finding,
      `No duplicate-posting finding for ${scenario.scenarioId}`,
    );

    for (const evidenceId of scenario.expectedEvidenceIds) {
      assert.ok(
        finding.supportingEvidenceIds.includes(evidenceId),
        `${scenario.scenarioId} is missing evidence ${evidenceId}`,
      );
    }
  }
});

test("normal baseline records do not create findings by themselves", () => {
  const plantedEvidenceIds = new Set(
    benchmarkGroundTruth.flatMap(
      (scenario) => scenario.expectedEvidenceIds,
    ),
  );

  const baselineRecords = benchmarkRecords.filter(
    (record) => !plantedEvidenceIds.has(record.id),
  );

  const report = investigateEvidence({
    targetReference: "NS-BASELINE-ONLY",
    records: baselineRecords,
  });

  assert.equal(
    report.findings.length,
    0,
    "Baseline-only evidence should not trigger planted anomaly rules",
  );
});

test("benchmark finding references always point to supplied evidence", () => {
  const suppliedIds = new Set(
    benchmarkRecords.map((record) => record.id),
  );

  const report = investigateEvidence({
    targetReference: "NS-FULL-BENCHMARK",
    records: benchmarkRecords,
  });

  for (const finding of report.findings) {
    for (const evidenceId of finding.supportingEvidenceIds) {
      assert.ok(
        suppliedIds.has(evidenceId),
        `Unknown evidence reference: ${evidenceId}`,
      );
    }
  }
});
