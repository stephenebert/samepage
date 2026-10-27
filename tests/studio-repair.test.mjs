import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStudioAction, createStudioRoom, parseStudioAction } from '../lib/studio.ts';
import { evaluateStudioPolicy } from '../lib/studio-engine.ts';
import { buildExpectedRepairRules, checkStudioRepairImpact, completeStudioRepair, parseStudioRepairIntent, parseStudioRepairProposal, repairJobIsCurrent, startStudioRepair, voteStudioRepair } from '../lib/studio-repair.ts';

const now = '2026-10-27T12:00:00.000Z';
const deadline = '2032-11-04T18:00:00.000Z';
const copy = value => structuredClone(value);
const flag = field => ({ op: 'flag', field, value: true });
const age = (cmp, value) => ({ op: 'age', cmp, value });
const source = {
  en: 'Participants must be at least 16; under-18s need guardian consent. Registration must arrive strictly before 2032-11-04T18:00:00.000Z. First matching fee: members pay $8, students pay $12, otherwise $30. No other eligibility or fee rules.',
  es: 'Las personas deben tener al menos 16 años; los menores de 18 necesitan consentimiento del tutor. La inscripción debe llegar estrictamente antes de 2032-11-04T18:00:00.000Z. Primera tarifa coincidente: miembros $8, estudiantes $12, de lo contrario $30. No hay otras reglas de admisión ni de tarifas.',
};
const baselineRules = () => ({ eligibility: { op: 'all', args: [age('gte', 16), { op: 'any', args: [age('gte', 18), flag('guardianConsent')] }, { op: 'time', cmp: 'lt', value: deadline }] },
  fee: { currency: 'USD', defaultCents: 3000, overrides: [{ when: flag('member'), cents: 800, label: 'Members' }, { when: flag('student'), cents: 1200, label: 'Students' }] } });
const attendee = { age: 24, resident: false, student: false, member: true, guardianConsent: false, scholarship: true, submittedAt: '2032-11-04T17:59:59.999Z' };
function reviewed(publish = false) {
  let room = createStudioRoom('repair-test', now);
  for (const editor of ['alice', 'bob']) room = applyStudioAction(room, { type: 'draft', editor, baseVersion: 1, text: source[editor === 'alice' ? 'en' : 'es'] }, now);
  room = applyStudioAction(room, { type: 'requestReview' }, now);
  const job = room.activeJob;
  room = applyStudioAction(room, { type: 'completeReview', response: { jobId: job.id, candidates: ['alice', 'bob'].map(editor => ({ editor, sourceVersion: job.drafts[editor].version, ...source, rules: baselineRules(), issues: [] })) } }, now);
  if (publish) for (const editor of ['alice', 'bob']) room = applyStudioAction(room, { type: 'vote', editor, reviewId: room.review.id, candidateId: room.review.candidates[0].id }, now);
  return room;
}
const intentFor = room => ({ baselineCandidateId: room.review.candidates[0].id, scopeFlag: 'scholarship', feeCents: 0 });
const proposalFor = room => ({ en: 'Fee-only corrected policy in English.', es: 'Política corregida solo en la tarifa.', rules: buildExpectedRepairRules(room.repair.job.baseline.rules, room.repair.job.intent), issues: [] });
function ready(room = reviewed()) { const started = startStudioRepair(room, intentFor(room), now); return completeStudioRepair(started, started.repair.id, proposalFor(started), now); }

test('fee-only intent overrides prior fee priority without changing admission or anyone outside the group', () => {
  const room = reviewed(), intent = intentFor(room), desired = buildExpectedRepairRules(baselineRules(), intent);
  assert.equal(evaluateStudioPolicy(desired, attendee).feeCents, 0, 'scholarship takes priority over member fee');
  assert.equal(evaluateStudioPolicy(desired, { ...attendee, scholarship: false }).feeCents, 800);
  assert.equal(evaluateStudioPolicy(desired, { ...attendee, age: 17 }).accepted, false, 'fee waiver does not grant guardian consent');
  assert.equal(evaluateStudioPolicy(desired, { ...attendee, submittedAt: deadline }).accepted, false, 'strict deadline is preserved');
  const impact = checkStudioRepairImpact(baselineRules(), intent, desired);
  assert.equal(impact.status, 'pass'); assert.equal(impact.verification.status, 'equivalent');
  assert.equal(impact.changes.status, 'different'); assert.ok(impact.verification.checkedCases > 0);
});

test('an attractive free-scholarship rewrite that admits a minor without consent is blocked with a concrete counterexample', () => {
  const room = reviewed(), unsafe = buildExpectedRepairRules(baselineRules(), intentFor(room));
  unsafe.eligibility.args[1] = { op: 'any', args: [age('gte', 18), flag('guardianConsent'), flag('scholarship')] };
  const impact = checkStudioRepairImpact(baselineRules(), intentFor(room), unsafe);
  assert.equal(impact.status, 'blocked');
  const witness = impact.verification.witnesses.find(item => item.kind === 'admission-right');
  assert.ok(witness); assert.equal(witness.attendee.age, 17); assert.equal(witness.attendee.guardianConsent, false);
  assert.equal(witness.attendee.scholarship, true); assert.equal(witness.left.accepted, false); assert.equal(witness.right.accepted, true);
});

test('changing a deadline by one millisecond is detected even when the requested waiver is correct', () => {
  const room = reviewed(), unsafe = buildExpectedRepairRules(baselineRules(), intentFor(room));
  unsafe.eligibility.args[2].cmp = 'lte';
  const impact = checkStudioRepairImpact(baselineRules(), intentFor(room), unsafe);
  assert.equal(impact.status, 'blocked');
  assert.ok(impact.verification.witnesses.some(w => w.attendee.submittedAt === deadline && !w.left.accepted && w.right.accepted));
});

test('outside-group fee drift and an incomplete requested repair are rejected', () => {
  const room = reviewed(), intent = intentFor(room), unsafe = buildExpectedRepairRules(baselineRules(), intent);
  unsafe.fee.defaultCents = 2500;
  const drift = checkStudioRepairImpact(baselineRules(), intent, unsafe);
  assert.equal(drift.status, 'blocked'); assert.ok(drift.verification.witnesses.some(w => !w.attendee.scholarship && w.kind === 'price-only'));
  const missing = checkStudioRepairImpact(baselineRules(), intent, baselineRules());
  assert.equal(missing.status, 'blocked'); assert.ok(missing.verification.witnesses.some(w => w.attendee.scholarship && w.left.feeCents === 0 && w.right.feeCents > 0));
});

test('unknown comparison and unresolved proposal fail closed; no partial policy is accepted', () => {
  const room = reviewed(), intent = intentFor(room), desired = buildExpectedRepairRules(baselineRules(), intent);
  assert.equal(checkStudioRepairImpact(baselineRules(), intent, desired, 1).status, 'unresolved');
  const started = startStudioRepair(room, intent, now);
  const blocked = completeStudioRepair(started, started.repair.id, { ...source, rules: null, issues: ['The two rewrite texts disagree on the deadline.'] }, now);
  assert.equal(blocked.repair.status, 'blocked'); assert.equal(blocked.repair.impact.status, 'unresolved');
  for (const editor of ['alice', 'bob']) assert.throws(() => voteStudioRepair(blocked, editor, blocked.repair.id, now), { code: 'REPAIR_BLOCKED' });
  assert.deepEqual(blocked.published, room.published);
});

test('two distinct simulated editors must approve the exact passed repair; prior receipts retain their version', () => {
  let room = reviewed(true);
  room = applyStudioAction(room, { type: 'register', requestId: 'before', policyVersion: room.published.version, label: 'Synthetic before', ...attendee }, now);
  const receipt = copy(room.registrations[0]), version = room.published.version;
  room = ready(room); assert.deepEqual(room.repair.votes, {});
  room = applyStudioAction(room, { type: 'voteRepair', editor: 'alice', repairId: room.repair.id }, now);
  assert.equal(room.published.version, version);
  const oneVote = room;
  assert.strictEqual(applyStudioAction(room, { type: 'voteRepair', editor: 'alice', repairId: room.repair.id }, now), oneVote);
  room = applyStudioAction(room, { type: 'voteRepair', editor: 'bob', repairId: room.repair.id }, now);
  assert.equal(room.published.version, version + 1); assert.equal(room.repair.status, 'published');
  assert.strictEqual(applyStudioAction(room, { type: 'voteRepair', editor: 'bob', repairId: room.repair.id }, now), room);
  room = applyStudioAction(room, { type: 'register', requestId: 'after', policyVersion: room.published.version, label: 'Synthetic after', ...attendee }, now);
  assert.deepEqual(room.registrations[0], receipt); assert.equal(receipt.decision.feeCents, 800); assert.equal(room.registrations[1].decision.feeCents, 0);
});

test('starting a repair clears old votes and original-policy approval cannot bypass a blocked or pending repair', () => {
  let room = reviewed();
  const originalVote = editor => ({ type: 'vote', editor, reviewId: room.review.id, candidateId: room.review.candidates[0].id });
  room = applyStudioAction(room, originalVote('alice'), now);
  room = startStudioRepair(room, intentFor(room), now);
  assert.deepEqual(room.review.votes, {});
  assert.throws(() => applyStudioAction(room, originalVote('bob'), now), { code: 'REPAIR_ACTIVE' });
  const bad = proposalFor(room); bad.rules.eligibility = { op: 'always' };
  room = completeStudioRepair(room, room.repair.id, bad, now);
  assert.equal(room.repair.status, 'blocked');
  assert.throws(() => applyStudioAction(room, originalVote('alice'), now), { code: 'REPAIR_ACTIVE' });
  assert.equal(room.published.version, 1);
});

test('even a forged pass flag cannot approve an unsafe stored proposal', () => {
  const room = ready();
  room.repair.proposal.rules.eligibility = { op: 'always' };
  assert.equal(room.repair.impact.status, 'pass', 'stale or forged cached result remains insufficient');
  assert.throws(() => voteStudioRepair(room, 'alice', room.repair.id, now), { code: 'REPAIR_BLOCKED' });
  assert.equal(room.published.version, 1);
});

test('a saved draft edit supersedes running repair and prior approvals; stale completion cannot land', () => {
  let room = startStudioRepair(reviewed(), intentFor(reviewed()), now);
  const job = copy(room.repair.job), proposed = proposalFor(room);
  room.automaticRepair = { requestId: 'test-request', jobId: job.id, provider: 'Meta', model: 'synthetic', source: 'simulation', status: 'running', startedAt: now, leaseExpiresAt: '2026-10-27T12:01:30.000Z' };
  room = applyStudioAction(room, { type: 'draft', editor: 'bob', baseVersion: room.drafts.bob.version, text: source.es + ' Cambio.' }, now);
  assert.equal(room.repair.status, 'superseded'); assert.equal(room.automaticRepair.status, 'superseded'); assert.deepEqual(room.repair.votes, {});
  assert.equal(repairJobIsCurrent(room, job), false);
  assert.throws(() => completeStudioRepair(room, job.id, proposed, now), { code: 'STALE_REPAIR' });
  assert.throws(() => voteStudioRepair(room, 'alice', job.id, now), { code: 'REPAIR_BLOCKED' });
});

test('a different published version or altered baseline invalidates the proposal snapshot', () => {
  const room = ready();
  const newVersion = copy(room); newVersion.published.version++;
  assert.throws(() => voteStudioRepair(newVersion, 'bob', room.repair.id, now), { code: 'STALE_REPAIR' });
  const changedBaseline = copy(room); changedBaseline.review.candidates[0].rules.fee.defaultCents++;
  assert.throws(() => voteStudioRepair(changedBaseline, 'alice', room.repair.id, now), { code: 'STALE_REPAIR' });
});

test('replacement repair keeps the blocked evidence and starts with no carried votes', () => {
  let room = ready(), oldId = room.repair.id;
  room = voteStudioRepair(room, 'alice', oldId, now);
  room = startStudioRepair(room, { ...intentFor(room), scopeFlag: 'student', feeCents: 500 }, now);
  assert.equal(room.repairHistory.at(-1).id, oldId); assert.deepEqual(room.repair.votes, {});
  assert.throws(() => voteStudioRepair(room, 'bob', oldId, now), { code: 'STALE_REPAIR' });
  room = completeStudioRepair(room, room.repair.id, proposalFor(room), now);
  room = voteStudioRepair(room, 'bob', room.repair.id, now);
  assert.equal(room.published.version, 1, 'Alice’s earlier vote cannot combine with Bob’s new vote');
  for (let i = 0; i < 8; i++) room = startStudioRepair(room, intentFor(room), now);
  assert.equal(room.repairHistory.length, 6);
});

test('check-my-rewrite mode preserves both exact source strings and rejects source substitutions', () => {
  const room = reviewed(), submitted = { en: ' My exact English rewrite. ', es: ' Mi propuesta exacta. ' };
  const started = startStudioRepair(room, intentFor(room), now, 'repair-check', submitted);
  const p = { ...proposalFor(started), ...submitted };
  assert.equal(completeStudioRepair(started, started.repair.id, p, now).repair.status, 'ready');
  assert.throws(() => completeStudioRepair(started, started.repair.id, { ...p, en: p.en.trim() }, now), { code: 'REPAIR_SOURCE_CHANGED' });
});

test('invalid intents, unsupported proposals, old baselines and parser budget overflow are rejected before review', () => {
  const room = reviewed(), intent = intentFor(room);
  assert.throws(() => parseStudioRepairIntent({ ...intent, scopeFlag: 'income' }));
  assert.throws(() => parseStudioRepairIntent({ ...intent, feeCents: -1 }));
  assert.throws(() => parseStudioRepairIntent({ ...intent, preserveEligibility: false }));
  assert.throws(() => parseStudioRepairProposal({ ...source, rules: baselineRules(), issues: ['Still uncertain.'] }));
  assert.throws(() => parseStudioRepairProposal({ ...source, rules: null, issues: [] }));
  assert.throws(() => startStudioRepair(createStudioRoom('blank', now), intent, now), { code: 'REPAIR_BASELINE_UNRESOLVED' });
  assert.throws(() => startStudioRepair(room, { ...intent, baselineCandidateId: 'other' }, now), { code: 'REPAIR_BASELINE_UNRESOLVED' });
  const atLimit = baselineRules(); atLimit.fee.overrides = Array.from({ length: 16 }, () => ({ when: flag('member'), cents: 800, label: 'At limit' }));
  assert.throws(() => buildExpectedRepairRules(atLimit, intent), /16 ordered fee overrides/);
  let published = ready(); for (const editor of ['alice', 'bob']) published = voteStudioRepair(published, editor, published.repair.id, now);
  assert.throws(() => startStudioRepair(published, intentFor(published), now), { code: 'STALE_REPAIR' });
  assert.throws(() => parseStudioAction({ type: 'voteRepair', editor: 'alice', repairId: 'id', bypassImpact: true }));
});
