import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverStudioConsequences, evaluateStudioPolicy } from '../lib/studio-engine.ts';
import { realisticStudioWitness } from '../lib/studio-witness.ts';

const flag = (field, value = true) => ({ op: 'flag', field, value });
const age = (cmp, value) => ({ op: 'age', cmp, value });
const start = '2033-05-12T09:00:00.000Z', end = '2033-05-14T19:00:00.000Z';
const baseline = { eligibility: { op: 'all', args: [age('gte', 16), { op: 'any', args: [age('gte', 18), flag('guardianConsent')] }, { op: 'time', cmp: 'gte', value: start }, { op: 'time', cmp: 'lt', value: end }] }, fee: { currency: 'USD', defaultCents: 2900, overrides: [{ when: flag('resident'), cents: 2100, label: 'Resident fee' }] } };
const repaired = structuredClone(baseline);
repaired.fee.overrides.unshift({ when: flag('scholarship'), cents: 0, label: 'Scholarship fee' });
const facts = { age: 20, resident: true, student: false, member: false, guardianConsent: false, scholarship: true, submittedAt: '2033-05-13T12:00:00.000Z' };

test('a saved receipt becomes a recomputed example with its own exact fee and explanation', () => {
  const witness = discoverStudioConsequences(baseline, repaired).witnesses[0], snapshot = structuredClone(witness);
  assert.equal(witness.left.feeCents, 2900);
  const result = realisticStudioWitness(baseline, repaired, witness, { ...facts, id: 'receipt-extra-data' }, 'scholarship');
  assert.deepEqual(result.attendee, facts);
  assert.equal(result.left.feeCents, 2100); assert.equal(result.right.feeCents, 0); assert.equal(result.feeDeltaCents, 2100);
  assert.match(result.explanation.en, /21\.00/); assert.doesNotMatch(result.explanation.en, /29\.00/);
  assert.deepEqual(result.left, evaluateStudioPolicy(baseline, facts));
  assert.deepEqual(witness, snapshot, 'saved discovery is never changed');
});

test('an admission bypass remains a minor without consent when the preferred adult cannot witness it', () => {
  const unsafe = structuredClone(repaired);
  unsafe.eligibility.args[1].args.push(flag('scholarship'));
  const original = discoverStudioConsequences(repaired, unsafe).witnesses.find(w => w.id === 'admission-right');
  const result = realisticStudioWitness(repaired, unsafe, original, facts, 'scholarship');
  assert.equal(result.id, original.id); assert.equal(result.attendee.age, 17);
  assert.equal(result.attendee.guardianConsent, false); assert.equal(result.attendee.scholarship, true);
  assert.equal(result.left.accepted, false); assert.equal(result.right.accepted, true);
  assert.equal(result.feeDeltaCents, null);
});

test('an exact deadline counterexample keeps its essential millisecond boundary', () => {
  const inclusive = structuredClone(baseline); inclusive.eligibility.args[3].cmp = 'lte';
  const original = discoverStudioConsequences(baseline, inclusive).witnesses[0];
  const result = realisticStudioWitness(baseline, inclusive, original, facts);
  assert.equal(result.attendee.submittedAt, end);
  assert.equal(result.left.accepted, false); assert.equal(result.right.accepted, true);
});

test('an age-120-only consequence stays an edge case instead of being hidden by presentation', () => {
  const rare = structuredClone(baseline);
  rare.fee.overrides.unshift({ when: age('gte', 120), cents: 0, label: 'Rare age' });
  const original = discoverStudioConsequences(baseline, rare).witnesses[0];
  const result = realisticStudioWitness(baseline, rare, original, facts);
  assert.equal(result.attendee.age, 120); assert.equal(result.left.feeCents > result.right.feeCents, true);
});

test('presentation cannot switch outside-group drift into the requested group', () => {
  const changed = structuredClone(baseline); changed.fee.defaultCents = 3000;
  const original = discoverStudioConsequences(baseline, changed).witnesses[0];
  const preferred = { ...facts, resident: false, scholarship: !original.attendee.scholarship };
  const result = realisticStudioWitness(baseline, changed, original, preferred, 'scholarship');
  assert.equal(result.attendee.scholarship, original.attendee.scholarship);
  assert.equal(result.id, original.id); assert.equal(result.left.feeCents, 2900); assert.equal(result.right.feeCents, 3000);
});

test('missing rules retain the original unresolved-context witness', () => {
  const original = discoverStudioConsequences(baseline, repaired).witnesses[0];
  assert.strictEqual(realisticStudioWitness(null, repaired, original, facts), original);
});
