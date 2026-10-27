import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { simplifyStudioFees, readableStudioPolicy } from '../lib/studio-presentation.ts';
import { evaluateStudioPolicy, parseStudioRules } from '../lib/studio-engine.ts';

let originalFetch, networkCalls = 0;
before(() => { originalFetch = globalThis.fetch; globalThis.fetch = () => { networkCalls++; throw Error('No network authorized'); }; });
after(() => { globalThis.fetch = originalFetch; assert.equal(networkCalls, 0); });
const flag = (field, value = true) => ({ op: 'flag', field, value });
const age = (cmp, value) => ({ op: 'age', cmp, value });
const time = (cmp, value) => ({ op: 'time', cmp, value });
const all = (...args) => ({ op: 'all', args });
const any = (...args) => ({ op: 'any', args });
const fee = (when, cents, label = 'Untrusted English-only model label') => ({ when, cents, label });
const rules = (overrides = [], eligibility = { op: 'always' }, defaultCents = 3000) => ({ eligibility, fee: { currency: 'USD', defaultCents, overrides } });
const attendee = { age: 20, resident: false, student: false, member: false, guardianConsent: false, scholarship: false, submittedAt: '2032-11-04T18:00:00.000Z' };
function freeze(value) { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return value; }
const outcome = (r, a) => { const result = evaluateStudioPolicy(r, a); return { accepted: result.accepted, feeCents: result.feeCents }; };

test('removes shadowed scholarship clauses while preserving admission AST, inputs and remaining fee priority', () => {
  const admission = all(age('gte', 16), any(age('gte', 18), flag('guardianConsent')), time('lte', attendee.submittedAt));
  const source = freeze(rules([
    fee(flag('scholarship'), 0), fee(all(flag('scholarship'), age('lte', 19)), 600),
    fee(flag('member'), 800), fee(flag('student'), 1200), fee(all(flag('scholarship'), flag('resident')), 2100),
  ], admission));
  const snapshot = JSON.stringify(source), result = simplifyStudioFees(source);
  assert.equal(result.verified, true); assert.equal(result.removedCount, 2);
  assert.equal(result.rules.eligibility, source.eligibility, 'the entire original admission AST is retained');
  assert.equal(JSON.stringify(source), snapshot);
  assert.deepEqual(result.rules.fee.overrides.map(item => item.cents), [0, 800, 1200]);
  for (const years of [0, 15, 16, 17, 18, 19, 20, 120]) for (let bits = 0; bits < 32; bits++) {
    const a = { ...attendee, age: years, resident: !!(bits & 1), student: !!(bits & 2), member: !!(bits & 4), guardianConsent: !!(bits & 8), scholarship: !!(bits & 16) };
    assert.deepEqual(outcome(result.rules, a), outcome(source, a));
  }
  assert.deepEqual(outcome(result.rules, { ...attendee, age: 17, scholarship: true }), { accepted: false, feeCents: null });
});

test('partially overlapping lower-priority rules remain for people outside the new waiver', () => {
  const source = rules([fee(flag('scholarship'), 0), fee(any(flag('scholarship'), flag('resident')), 2100), fee(flag('student'), 1200)]);
  const result = simplifyStudioFees(source);
  assert.equal(result.verified, true); assert.equal(result.removedCount, 0);
  assert.equal(outcome(result.rules, { ...attendee, resident: true }).feeCents, 2100);
  assert.equal(outcome(result.rules, { ...attendee, resident: true, student: true }).feeCents, 2100);
  assert.equal(outcome(result.rules, { ...attendee, scholarship: true, resident: true }).feeCents, 0);
});

test('a live exact-millisecond fee and an inclusive age endpoint cannot be removed', () => {
  const deadline = attendee.submittedAt;
  const source = rules([
    fee(time('lt', deadline), 800), fee(time('lte', deadline), 900),
    fee(age('lte', 19), 1100), fee(age('lte', 20), 1200),
  ]);
  const result = simplifyStudioFees(source);
  assert.equal(result.verified, true); assert.equal(result.removedCount, 0);
  for (const [offset, expected] of [[-1, 800], [0, 900], [1, 1200]]) {
    const a = { ...attendee, submittedAt: new Date(Date.parse(deadline) + offset).toISOString() };
    assert.equal(outcome(result.rules, a).feeCents, expected);
  }
  assert.equal(outcome(result.rules, { ...attendee, age: 19, submittedAt: '2032-11-04T18:00:00.001Z' }).feeCents, 1100);
  assert.equal(outcome(result.rules, { ...attendee, age: 21, submittedAt: '2032-11-04T18:00:00.001Z' }).feeCents, 3000);
});

test('equivalent default fees and clauses that cannot apply after admission may be removed', () => {
  const source = rules([fee(age('lte', 17), 500), fee(flag('member'), 3000), fee(flag('member'), 500)], age('gte', 18));
  const result = simplifyStudioFees(source);
  assert.equal(result.verified, true); assert.equal(result.removedCount, 3);
  assert.deepEqual(result.rules.fee.overrides, []);
  assert.equal(outcome(result.rules, { ...attendee, age: 17, member: true }).accepted, false);
  assert.equal(outcome(result.rules, { ...attendee, member: true }).feeCents, 3000);
});

test('unknown exhaustive coverage and invalid input retain the original without a verification claim', () => {
  // Valid 127-node AST, but its cross-product exceeds the 500,000-case proof budget.
  const clauses = [];
  for (let group = 0; group < 6; group++) clauses.push(fee(all(...Array.from({ length: 8 }, (_, i) => age('gte', (group * 8 + i) * 2 + 2))), 1000 + group));
  for (let group = 0; group < 8; group++) clauses.push(fee(all(...Array.from({ length: 8 }, (_, i) => time('lte', new Date(Date.UTC(2032, 0, group * 8 + i + 1)).toISOString()))), 2000 + group));
  const source = freeze(rules(clauses));
  assert.doesNotThrow(() => parseStudioRules(source));
  assert.deepEqual(simplifyStudioFees(source), { rules: source, removedCount: 0, verified: false });
  const invalid = rules([fee({ op: 'unsupported' }, 0)]);
  assert.deepEqual(simplifyStudioFees(invalid), { rules: invalid, removedCount: 0, verified: false });
  assert.deepEqual(readableStudioPolicy(invalid, 'en').fees, []);
  assert.equal(readableStudioPolicy(invalid, 'en').verified, false);
});

test('readable policy keeps nested negation, inclusive/exclusive UTC instants and fee precedence in both languages', () => {
  const instant = '2032-11-04T18:00:00.001Z';
  const source = rules([fee(flag('scholarship'), 0), fee(flag('resident'), 2105)], all(
    age('gte', 16), any(age('gte', 18), flag('guardianConsent')),
    { op: 'not', arg: all(flag('member', false), flag('student', false)) },
    time('gte', '2032-11-01T00:00:00.000Z'), time('lt', instant),
  ));
  const english = readableStudioPolicy(source, 'en'), spanish = readableStudioPolicy(source, 'es');
  assert.equal(english.verified, true); assert.equal(spanish.verified, true);
  assert.match(english.admission, /\(\(the person is at least 18 years old\) or \(guardian consent is present\)\)/);
  assert.match(english.admission, /it is not the case that \(\(the person is not a member\) and \(the person is not a student\)\)/);
  assert.match(english.admission, /is at or after 2032-11-01 00:00:00.000 UTC/);
  assert.match(english.admission, /is strictly before 2032-11-04 18:00:00.001 UTC/);
  assert.match(spanish.admission, /\(\(la edad es de 18 años o más\) o \(hay consentimiento del tutor\)\)/);
  assert.match(spanish.admission, /no se cumple que/);
  assert.match(spanish.admission, /es igual o posterior a 2032-11-01 00:00:00.000 UTC/);
  assert.match(spanish.admission, /es estrictamente anterior a 2032-11-04 18:00:00.001 UTC/);
  assert.match(english.fees[0], /only to admitted attendees.*first matching/);
  assert.match(spanish.fees[0], /Solo se cobra a las personas admitidas.*primera regla/);
  assert.match(english.fees[1], /^1\. If the person has a scholarship: \$0.00 USD\.$/);
  assert.match(spanish.fees[2], /^2\. Si la persona es residente: 21,05 USD\.$/);
  assert.doesNotMatch(JSON.stringify(english) + JSON.stringify(spanish), /Untrusted English-only model label|guardianConsent|&&|\|\|/);
});

test('all supported flags and remaining time comparisons have localized wording without model labels', () => {
  const source = rules([], all(
    flag('resident', false), flag('student'), flag('member'), flag('scholarship', false), flag('guardianConsent', false),
    time('gt', '2032-01-01T00:00:00.000Z'), time('lte', '2032-12-31T23:59:59.999Z'), age('lte', 120),
  ));
  const en = readableStudioPolicy(source, 'en'), es = readableStudioPolicy(source, 'es');
  assert.match(en.admission, /is strictly after.*is at or before/);
  assert.match(es.admission, /es estrictamente posterior a.*es igual o anterior a/);
  for (const text of ['no es residente', 'es estudiante', 'es miembro', 'no tiene beca', 'no hay consentimiento del tutor', '120 años o menos']) assert.ok(es.admission.includes(text));
  assert.deepEqual(es.fees, ['Solo las personas admitidas pagan 30,00 USD.']);
  assert.equal(readableStudioPolicy(rules(), 'en').admission, 'Everyone meets the admission requirements.');
});
