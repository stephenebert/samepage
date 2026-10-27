import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverStudioConsequences, evaluateStudioPolicy } from '../lib/studio-engine.ts';
import { studioRepairPresentation } from '../lib/studio-repair-presentation.ts';

const flag = field => ({ op: 'flag', field, value: true });
const baseline = {
  eligibility: { op: 'age', cmp: 'gte', value: 16 },
  fee: { currency: 'USD', defaultCents: 6350, overrides: [
    { when: { op: 'all', args: [flag('resident'), flag('member')] }, cents: 1850, label: 'Resident member' },
    { when: flag('student'), cents: 4550, label: 'Student' },
  ] },
};
const proposed = structuredClone(baseline);
proposed.fee.overrides.unshift({ when: flag('student'), cents: 3250, label: 'Student exact fee' });
const repair = {
  status: 'published', publishedVersion: 3,
  job: { basePolicyVersion: 2, baseline: { rules: baseline }, intent: { scopeFlag: 'student', feeCents: 3250 } },
  proposal: { rules: proposed }, impact: { status: 'pass', changes: discoverStudioConsequences(baseline, proposed) },
};
const facts = { age: 17, resident: true, member: true, student: true, scholarship: false, guardianConsent: false, submittedAt: '2027-02-16T12:00:00.000Z' };
const receipt = (id, policyVersion, attendee, rules) => ({ ...attendee, id, policyVersion, decision: evaluateStudioPolicy(rules, attendee) });
const receipts = [receipt('before', 2, facts, baseline), receipt('after', 3, facts, proposed)];

test('same saved attendee drives impact and receipt comparison even when the first witness decreases fees', () => {
  assert.equal(repair.impact.changes.witnesses[0].id, 'price-left-higher');
  const snapshot = structuredClone({ repair, receipts });
  const result = studioRepairPresentation(repair, receipts);
  assert.deepEqual(result.witness.attendee, facts);
  assert.equal(result.witness.id, 'price-right-higher');
  assert.equal(result.witness.left.feeCents, 1850);
  assert.equal(result.witness.right.feeCents, 3250);
  assert.equal(result.witness.feeDeltaCents, 1400);
  assert.equal(result.receiptChange.before.id, 'before');
  assert.equal(result.receiptChange.after.id, 'after');
  assert.deepEqual({ repair, receipts }, snapshot, 'presentation never changes saved evidence');
});

test('unrelated versions and outside-group receipts do not replace the current repair story', () => {
  const outside = { ...facts, student: false }, later = structuredClone(baseline);
  later.fee.defaultCents = 9900;
  const noisy = [...receipts, receipt('outside-before', 2, outside, baseline), receipt('outside-after', 3, outside, later), receipt('old-before', 4, { ...facts, age: 28 }, baseline), receipt('old-after', 5, { ...facts, age: 28 }, proposed)];
  assert.deepEqual(studioRepairPresentation(repair, noisy), studioRepairPresentation(repair, receipts));
});

test('a newer valid pair coherently updates both panels, regardless of fee direction', () => {
  const other = { ...facts, age: 24, resident: false, member: false };
  const result = studioRepairPresentation(repair, [...receipts, receipt('new-before', 2, other, baseline), receipt('new-after', 3, other, proposed)]);
  assert.deepEqual(result.witness.attendee, other);
  assert.equal(result.witness.id, 'price-left-higher');
  assert.equal(result.receiptChange.before.id, 'new-before');
  assert.equal(result.receiptChange.after.id, 'new-after');
});

test('receipts from a different selected baseline or inconsistent after outcome cannot claim matching evidence', () => {
  for (const index of [0, 1]) {
    const bad = structuredClone(receipts);
    bad[index].decision.feeCents = 7777;
    assert.equal(studioRepairPresentation(repair, bad).receiptChange, null);
  }
});

test('different facts, denied attendees and unchanged outcomes cannot become a receipt proof', () => {
  const different = structuredClone(receipts); different[1].guardianConsent = true;
  assert.equal(studioRepairPresentation(repair, different).receiptChange, null);
  for (const attendee of [{ ...facts, age: 15 }, { ...facts, student: false }]) {
    const result = studioRepairPresentation(repair, [receipt('before', 2, attendee, baseline), receipt('after', 3, attendee, proposed)]);
    assert.equal(result.receiptChange, null);
    assert.equal(result.witness.attendee.student, true);
    assert.equal(result.witness.left.accepted, true);
  }
});

test('before publication the saved baseline attendee is reused without inventing an after receipt', () => {
  const result = studioRepairPresentation({ ...repair, status: 'ready', publishedVersion: undefined }, receipts.slice(0, 1));
  assert.deepEqual(result.witness.attendee, facts);
  assert.equal(result.receiptChange, null);
});

test('blocked and superseded repairs never display a successful intended effect', () => {
  for (const status of ['blocked', 'superseded', 'running']) {
    assert.deepEqual(studioRepairPresentation({ ...repair, status }, receipts), { witness: null, receiptChange: null });
  }
});
