import test from 'node:test';
import assert from 'node:assert/strict';

import { correlateIncidents, generateHypotheses, type InvestigationRecord } from '../src/lib/investigation-engine.ts';

function incident(overrides: Partial<InvestigationRecord> = {}): InvestigationRecord {
  return {
    id: '1', reference: 'AEG-TEST-001', title: 'POS checkout failure',
    description: 'Transaction failed', category: 'POS', severity: 'High',
    status: 'Open', evidence: null, notes: null,
    createdAt: new Date('2026-10-22T10:00:00Z'),
    updatedAt: new Date('2026-10-22T10:00:00Z'),
    branch: { code: 'BR-001', name: 'Branch One', city: 'Test City' },
    ...overrides,
  };
}

test('an incident is never correlated with itself', () => {
  const target = incident();
  assert.deepEqual(correlateIncidents(target, [target]), []);
});

test('placeholder wording alone does not establish a relationship', () => {
  const target = incident({ description: 'for only the simulated example', category: 'Inventory' });
  const candidate = incident({
    id: '2', reference: 'AEG-TEST-002', title: 'Unrelated service notice',
    description: 'for only the simulated example', category: 'Facilities',
    createdAt: new Date('2026-10-25T10:00:00Z'),
    branch: { code: 'BR-002', name: 'Branch Two', city: 'Other City' },
  });
  assert.deepEqual(correlateIncidents(target, [candidate]), []);
});

test('no-match hypotheses acknowledge uncertainty', () => {
  const hypotheses = generateHypotheses(incident(), []);
  assert.equal(hypotheses.length, 1);
  assert.equal(hypotheses[0].confidence, 'Low');
  assert.match(hypotheses[0].limitations, /does not prove the issue is isolated/i);
});

test('identifies an exact shared error code in its reasons', () => {
  const target = incident({
    evidence: 'POS error code E-5031',
    createdAt: new Date('2026-10-22T10:00:00Z'),
  });
  const candidate = incident({
    id: '2',
    reference: 'AEG-TEST-002',
    title: 'Device log failure',
    description: 'Device reported a checkout fault',
    evidence: 'Device log reports error code E-5031',
    createdAt: new Date('2026-10-25T10:00:00Z'),
    branch: { code: 'BR-002', name: 'Branch Two', city: 'Other City' },
  });
  const results = correlateIncidents(target, [candidate]);
  assert.equal(results.length, 1);
  assert.ok(results[0].reasons.some(reason => reason.includes('E-5031')));
});
