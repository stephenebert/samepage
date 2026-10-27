import test from 'node:test';
import assert from 'node:assert/strict';
import { explainStudioChange, studioRuleProof } from '../lib/studio-change-explanation.ts';

const flag = (field, value = true) => ({ op: 'flag', field, value });
const all = (...args) => ({ op: 'all', args });
const fee = (when, cents, label = 'An arbitrary model label') => ({ when, cents, label });
const policy = (overrides = [], defaultCents = 4600, eligibility = { op: 'always' }) => ({ eligibility, fee: { currency: 'USD', defaultCents, overrides } });
const person = { age: 29, resident: true, student: false, member: true, guardianConsent: false, scholarship: false, submittedAt: '2026-11-23T12:00:00.000Z' };
const baseline = policy([fee(flag('scholarship'), 500), fee(all(flag('student'), flag('member')), 1400), fee(flag('member'), 2700), fee(flag('student'), 3300)]);
const expected = policy([fee(flag('student'), 1900), ...baseline.fee.overrides]);
const unsafe = policy([fee(flag('student'), 1900), fee(flag('scholarship'), 500), fee(flag('member'), 3100)]);
function explain(proposedRules, attendee = person, baselineRules = baseline, expectedRules = expected) {
  return explainStudioChange({ baselineRules, expectedRules, proposedRules, attendee, scopeFlag: 'student' });
}

test('nonstudent member proof isolates the unauthorized $27 to $31 fee and actual matching positions', () => {
  const e = explain(unsafe);
  assert.equal(e.status, 'unintended'); assert.equal(e.inRequestedGroup, false);
  assert.equal(e.expected.ruleNumber, 4); assert.equal(e.proposed.ruleNumber, 3);
  assert.equal(e.expected.condition.en, 'member'); assert.equal(e.proposed.condition.es, 'miembro');
  assert.match(e.scope.en, /not a student/); assert.match(e.scope.es, /no es estudiante/);
  assert.match(e.summary.en, /keeps.*\$27.*\$31/); assert.match(e.summary.es, /mantiene.*27 USD.*31 USD/);
  assert.doesNotMatch(JSON.stringify(e), /An arbitrary model label.*charges/);
});

test('student member intentional $14 to $19 compares baseline to requested repair', () => {
  const e = explain(expected, { ...person, student: true });
  assert.equal(e.status, 'intended'); assert.equal(e.compare, 'baseline');
  assert.equal(e.baseline.decision.feeCents, 1400); assert.equal(e.proposed.decision.feeCents, 1900);
  assert.equal(e.baseline.ruleNumber, 2); assert.equal(e.proposed.ruleNumber, 1);
  assert.match(e.summary.en, /\$14.*\$19/); assert.match(e.title.es, /coincide/);
});

test('a matching child inside a failed AND is never mistaken for the matching fee rule', () => {
  const p = policy([fee(all(flag('member'), flag('student')), 100), fee(flag('resident'), 2300)]);
  const proof = studioRuleProof(p, person);
  assert.equal(proof.ruleNumber, 2); assert.equal(proof.condition.en, 'resident'); assert.equal(proof.decision.feeCents, 2300);
  assert.match(proof.detail.en, /1 earlier fee rule does not match/);
});

test('reordering competing true rules changes the winner even if all labels are identical', () => {
  const a = policy([fee(flag('member'), 2700, 'same'), fee(flag('resident'), 4000, 'same')]);
  const b = policy([fee(flag('resident'), 4000, 'same'), fee(flag('member'), 2700, 'same')]);
  const e = explain(b, person, a, a);
  assert.equal(e.status, 'unintended'); assert.equal(e.expected.ruleNumber, 1); assert.equal(e.proposed.ruleNumber, 1);
  assert.equal(e.expected.condition.en, 'member'); assert.equal(e.proposed.condition.en, 'resident');
  assert.equal(e.proposed.decision.feeCents, 4000);
});

test('zero fee remains a matched exception instead of falling through to the standard fee', () => {
  const e = explain(policy([fee(flag('member'), 0)]));
  assert.equal(e.proposed.kind, 'override'); assert.equal(e.proposed.result.en, '$0 fee');
  assert.equal(e.proposed.result.es, 'Tarifa de 0 USD'); assert.match(e.summary.en, /charges \$0/);
});

test('standard fee explains no match, including policies with no exceptions', () => {
  const e = explain(policy([fee(flag('scholarship'), 0)], 3900));
  assert.equal(e.proposed.kind, 'default'); assert.equal(e.proposed.ruleNumber, null);
  assert.match(e.summary.en, /standard fee charges \$39/); assert.match(e.proposed.detail.en, /None.*matches/);
  const proof = studioRuleProof(policy([], 0), person);
  assert.equal(proof.result.en, '$0 fee'); assert.match(proof.detail.en, /no fee exceptions/);
});

test('a rewrite denying admission explains the complete failed admission condition and no fee', () => {
  const e = explain(policy([], 9900, flag('student')));
  assert.equal(e.status, 'unintended'); assert.equal(e.proposed.kind, 'admission');
  assert.equal(e.proposed.decision.feeCents, null); assert.equal(e.proposed.condition.es, 'estudiante');
  assert.match(e.summary.en, /rejects.*before any fee/); assert.doesNotMatch(e.summary.en, /\$99|\$0/);
});

test('a rewrite granting admission cannot be presented as a fee-only correction', () => {
  const denied = policy([], 2700, flag('student'));
  const e = explain(baseline, person, denied, denied);
  assert.equal(e.status, 'unintended'); assert.equal(e.expected.kind, 'admission');
  assert.match(e.summary.en, /rewrite admits/); assert.match(e.title.es, /admisión/);
});

test('identical outcomes do not claim a change even if fee rules differ', () => {
  const e = explain(policy([fee(flag('member'), 2700)]));
  assert.equal(e.status, 'unchanged'); assert.match(e.summary.en, /agree for these attendee facts/);
});

test('expected and proposed amounts retain exact cents in both languages', () => {
  const before = policy([], 2735), after = policy([], 3199);
  const e = explain(after, person, before, before);
  assert.match(e.summary.en, /\$27.35.*\$31.99/); assert.match(e.summary.es, /27,35 USD.*31,99 USD/);
});

test('invalid rule input fails instead of inventing an explanation', () => {
  assert.throws(() => explain({ ...baseline, fee: { ...baseline.fee, currency: 'EUR' } }), /USD/);
});


test('a supplied expected admission change never invents a zero-dollar baseline fee', () => {
  const denied = policy([], 2700, flag('student'));
  const admitted = policy([], 2700);
  const e = explain(admitted, person, denied, admitted);
  assert.equal(e.status, 'intended'); assert.match(e.summary.en, /Not eligible.*\$27/);
  assert.doesNotMatch(e.summary.en, /from \$0/);
});
