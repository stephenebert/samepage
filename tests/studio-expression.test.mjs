import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeStudioExpressionRules, encodeStudioExpressionRules, STUDIO_EXPRESSION_GRAMMAR } from '../lib/studio-expression.ts';
import { evaluateStudioPolicy } from '../lib/studio-engine.ts';
import { studioDemoFixture } from '../lib/studio-demo.ts';

const wire = (eligibility, overrides = []) => ({ eligibility, fee: { currency: 'USD', defaultCents: 3100, overrides } });
const base = { age: 24, resident: false, student: false, member: false, guardianConsent: false, scholarship: false, submittedAt: '2032-02-29T09:00:00.000Z' };
const outcome = (rules, facts = {}) => {
  const { accepted, feeCents } = evaluateStudioPolicy(rules, { ...base, ...facts });
  return { accepted, feeCents };
};
const flags = ['resident', 'student', 'member', 'guardianConsent', 'scholarship'];
const facts = bits => Object.fromEntries(flags.map((flag, i) => [flag, !!(bits & (1 << i))]));

test('expression grammar preserves NOT then AND then OR precedence and explicit scope', () => {
  const ungrouped = decodeStudioExpressionRules(wire('!resident && student || member'));
  const grouped = decodeStudioExpressionRules(wire('!(resident && (student || member))'));
  const nested = decodeStudioExpressionRules(wire('!(!resident && !student) && (age >= 18 || guardianConsent)'));
  for (let bits = 0; bits < 32; bits++) for (const age of [17, 18]) {
    const a = { ...facts(bits), age };
    assert.equal(outcome(ungrouped, a).accepted, (!a.resident && a.student) || a.member);
    assert.equal(outcome(grouped, a).accepted, !(a.resident && (a.student || a.member)));
    assert.equal(outcome(nested, a).accepted, (a.resident || a.student) && (age >= 18 || a.guardianConsent));
  }
  assert.equal(outcome(decodeStudioExpressionRules(wire('true'))).accepted, true);
  assert.equal(outcome(decodeStudioExpressionRules(wire('false'))).accepted, false);
});

test('age endpoints and all four UTC comparisons preserve exact millisecond boundaries', () => {
  const ageRule = decodeStudioExpressionRules(wire('age >= 16 && age <= 80'));
  for (const [age, accepted] of [[0, false], [15, false], [16, true], [17, true], [80, true], [81, false], [120, false]]) assert.equal(outcome(ageRule, { age }).accepted, accepted);
  const instant = '2032-02-29T09:00:00.000Z', ms = Date.parse(instant);
  const expectations = { '<': [true, false, false], '<=': [true, true, false], '>=': [false, true, true], '>': [false, false, true] };
  for (const [op, expected] of Object.entries(expectations)) {
    const rule = decodeStudioExpressionRules(wire(`submittedAt ${op} "${instant}"`));
    for (const [i, delta] of [-1, 0, 1].entries()) assert.equal(outcome(rule, { submittedAt: new Date(ms + delta).toISOString() }).accepted, expected[i]);
  }
  assert.equal(decodeStudioExpressionRules(wire('submittedAt >= "2032-02-29T09:00:00Z"')).eligibility.value, instant);
});

test('ordered fee exceptions keep zero fees and never waive admission', () => {
  const rules = decodeStudioExpressionRules(wire('age >= 16 && (age >= 18 || guardianConsent)', [
    { when: 'scholarship && !member', cents: 0, label: 'Scholarship' },
    { when: 'member', cents: 900, label: 'Member' },
    { when: 'student || resident', cents: 1400, label: 'Student or resident' },
  ]));
  assert.deepEqual(outcome(rules, { scholarship: true, member: true, student: true }), { accepted: true, feeCents: 900 });
  assert.deepEqual(outcome(rules, { scholarship: true, student: true }), { accepted: true, feeCents: 0 });
  assert.deepEqual(outcome(rules, { resident: true }), { accepted: true, feeCents: 1400 });
  assert.deepEqual(outcome(rules), { accepted: true, feeCents: 3100 });
  assert.deepEqual(outcome(rules, { age: 15, scholarship: true, guardianConsent: true }), { accepted: false, feeCents: null });
  assert.deepEqual(outcome(rules, { age: 17, scholarship: true }), { accepted: false, feeCents: null });
  assert.deepEqual(outcome(rules, { age: 17, scholarship: true, guardianConsent: true }), { accepted: true, feeCents: 0 });
});

test('strict parser rejects executable code, unsupported syntax and partial expressions', () => {
  const bad = [
    '', ' ', 'TRUE', 'unknown', 'resident()', 'resident.value', 'globalThis.fetch("https://example.com")', 'constructor.constructor("return true")()',
    'resident = true', 'resident == true', 'resident === true', 'resident ? true : false', 'resident & member', 'resident | member', 'resident + member',
    'resident; true', 'resident /* comment */', 'resident // comment', 'resident, member', 'resident member', 'resident &&', '|| member', '()', '(resident', 'resident)',
    'age', 'age > 18', 'age < 18', 'age >= -1', 'age >= 121', 'age >= 01', 'age >= 1.5', 'age >= 1e2', 'age >= "18"',
    'submittedAt >= 0', 'submittedAt == "2032-02-29T09:00:00Z"', 'submittedAt >= "2031-02-29T09:00:00Z"', 'submittedAt >= "2032-02-29"',
    'submittedAt >= "2032-02-29T09:00:00+00:00"', 'submittedAt >= "2032-02-29T09:00:00.0001Z"', 'submittedAt >= "2032-02-29T09:00:00Z',
    'submittedAt >= "2032-02-29T09:00:00\\u005a"', 'resident\u200b', '"resident"',
  ];
  for (const expression of bad) assert.throws(() => decodeStudioExpressionRules(wire(expression)), undefined, expression);
});

test('expression parser rejects oversized inputs before execution and preserves shared AST bounds', () => {
  const sixteen = Array(16).fill('resident').join(' && ');
  assert.doesNotThrow(() => decodeStudioExpressionRules(wire(sixteen)));
  assert.throws(() => decodeStudioExpressionRules(wire(sixteen + ' && resident')), /16 operands/);
  assert.doesNotThrow(() => decodeStudioExpressionRules(wire('!'.repeat(7) + 'true')));
  assert.throws(() => decodeStudioExpressionRules(wire('!'.repeat(8) + 'true')), /8-level/);
  assert.throws(() => decodeStudioExpressionRules(wire('('.repeat(40) + 'true' + ')'.repeat(40))), /nesting/);
  assert.throws(() => decodeStudioExpressionRules(wire('('.repeat(513) + 'true' + ')'.repeat(513))), /tokens/);
  assert.throws(() => decodeStudioExpressionRules(wire(' '.repeat(4096) + 'true')), /4096/);
  const nine = Array(9).fill('resident').join(' && ');
  assert.throws(() => decodeStudioExpressionRules(wire('true', Array.from({ length: 13 }, (_, i) => ({ when: nine, cents: i, label: 'bounded rule' })))), /128-node/);
  assert.throws(() => decodeStudioExpressionRules(wire('true', Array.from({ length: 17 }, () => ({ when: 'true', cents: 0, label: 'too many' })))), /16 fee/);
});

test('wire object validation preserves exact keys, currency, cents and label limits', () => {
  for (const mutate of [
    r => { r.extra = 'ignored?'; }, r => { r.fee.extra = true; }, r => { r.fee.currency = 'EUR'; }, r => { r.fee.defaultCents = -1; },
    r => { r.fee.defaultCents = 1.5; }, r => { r.fee.overrides[0].cents = 1000001; }, r => { r.fee.overrides[0].label = ''; },
    r => { r.fee.overrides[0].unexpected = false; }, r => { r.eligibility = { op: 'always' }; }, r => { r.fee.overrides[0].when = null; },
  ]) {
    const r = wire('true', [{ when: 'student', cents: 100, label: 'student' }]); mutate(r);
    assert.throws(() => decodeStudioExpressionRules(r));
  }
});

test('encoding recorded bilingual interpretations preserves all supported attendee outcomes', () => {
  for (const candidate of studioDemoFixture.candidates) {
    const original = candidate.rules, roundtrip = decodeStudioExpressionRules(encodeStudioExpressionRules(original));
    for (let age = 0; age <= 120; age++) for (let bits = 0; bits < 32; bits++) assert.deepEqual(outcome(roundtrip, { age, ...facts(bits) }), outcome(original, { age, ...facts(bits) }));
  }
  const original = {
    eligibility: { op: 'all', args: [{ op: 'flag', field: 'resident', value: false }, { op: 'not', arg: { op: 'any', args: [{ op: 'age', cmp: 'lte', value: 16 }, { op: 'flag', field: 'member', value: false }] } }, { op: 'time', cmp: 'gte', value: base.submittedAt }] },
    fee: { currency: 'USD', defaultCents: 99, overrides: [{ when: { op: 'flag', field: 'scholarship', value: false }, cents: 0, label: 'negative flag' }] },
  };
  const roundtrip = decodeStudioExpressionRules(encodeStudioExpressionRules(original));
  for (const age of [0, 16, 17, 120]) for (let bits = 0; bits < 32; bits++) for (const delta of [-1, 0, 1]) {
    const attendee = { age, ...facts(bits), submittedAt: new Date(Date.parse(base.submittedAt) + delta).toISOString() };
    assert.deepEqual(outcome(roundtrip, attendee), outcome(original, attendee));
  }
  assert.match(STUDIO_EXPRESSION_GRAMMAR, /first-match fee order/);
});
