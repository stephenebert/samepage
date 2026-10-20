import test from "node:test";
import assert from "node:assert/strict";
import { discoverCounterexamples } from "../lib/counterexamples.ts";
import { evaluatePolicy } from "../lib/consequences.ts";

const rules = (patch = {}) => ({ minAge: null, residentRequired: false, join: "all", deadline: null, deadlineInclusive: true, ...patch });
const utc = milliseconds => new Date(milliseconds).toISOString();
const instant = Date.parse("2026-11-05T18:00:00.000Z");
const directions = result => result.witnesses.map(witness => witness.direction).sort();
function verifyWitnesses(result, a, b) {
  for (const witness of result.witnesses) {
    assert.deepEqual(witness.left, evaluatePolicy(a, witness.attendee));
    assert.deepEqual(witness.right, evaluatePolicy(b, witness.attendee));
    assert.notEqual(witness.left.accepted, witness.right.accepted);
    assert.equal(witness.direction, witness.left.accepted ? "left-only" : "right-only");
    assert.match(witness.attendee.submittedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.ok(witness.attendee.age >= 0 && witness.attendee.age <= 120);
    assert.ok(witness.explanation.en.includes(witness.attendee.submittedAt));
    assert.ok(witness.explanation.es.includes(witness.attendee.submittedAt));
  }
}

test("AND/OR yields its own adult nonresident, without any supplied attendee", () => {
  const a = rules({ minAge: 16, residentRequired: true, deadline: utc(instant) });
  const b = { ...a, join: "any" };
  const result = discoverCounterexamples(a, b);
  assert.equal(result.status, "different");
  assert.deepEqual(directions(result), ["right-only"]);
  assert.deepEqual(result.witnesses[0].attendee, { age: 18, resident: false, submittedAt: utc(instant) });
  assert.match(result.witnesses[0].explanation.en, /Rule B accepts; Rule A rejects/);
  assert.match(result.coverage.scope, /does not prove the original language/);
  assert.equal(result.coverage.combinations, result.coverage.agePartitions * result.coverage.timePartitions * 2);
  verifyWitnesses(result, a, b);
});

test("crossed age and deadline restrictions find both directions even when changes mask each other", () => {
  const a = rules({ minAge: 18, deadline: utc(instant + 3600000) });
  const b = rules({ minAge: 16, deadline: utc(instant) });
  const result = discoverCounterexamples(a, b);
  assert.deepEqual(directions(result), ["left-only", "right-only"]);
  const younger = result.witnesses.find(w => w.direction === "right-only");
  assert.ok(younger.attendee.age >= 16 && younger.attendee.age < 18);
  const later = result.witnesses.find(w => w.direction === "left-only");
  assert.ok(Date.parse(later.attendee.submittedAt) > instant);
  verifyWitnesses(result, a, b);
});

test("inclusive versus strict finds exactly the deadline, not a nearby second", () => {
  const a = rules({ minAge: 33, residentRequired: true, deadline: utc(instant + 237) });
  const b = { ...a, deadlineInclusive: false };
  const result = discoverCounterexamples(a, b);
  assert.deepEqual(directions(result), ["left-only"]);
  assert.equal(result.witnesses[0].attendee.submittedAt, utc(instant + 237));
  assert.equal(result.witnesses[0].attendee.age, 33);
  assert.equal(result.witnesses[0].attendee.resident, true);
  verifyWitnesses(result, a, b);
});

test("millisecond-adjacent deadlines distinguish one instant or prove equality when inclusivity cancels", () => {
  const a = rules({ deadline: utc(instant), deadlineInclusive: true });
  const equivalent = rules({ deadline: utc(instant + 1), deadlineInclusive: false });
  assert.equal(discoverCounterexamples(a, equivalent).status, "equivalent");
  const b = { ...equivalent, deadlineInclusive: true };
  const result = discoverCounterexamples(a, b);
  assert.deepEqual(directions(result), ["right-only"]);
  assert.equal(result.witnesses[0].attendee.submittedAt, utc(instant + 1));
  verifyWitnesses(result, a, b);
});

test("inactive predicates, threshold zero, irrelevant join and absent deadline flags compare semantically", () => {
  const equivalentPairs = [
    [rules(), rules({ join: "any", deadlineInclusive: false })],
    [rules(), rules({ minAge: 0 })],
    [rules(), rules({ minAge: 0, residentRequired: true, join: "any" })],
    [rules({ minAge: 19 }), rules({ minAge: 19, join: "any" })],
    [rules({ residentRequired: true }), rules({ residentRequired: true, join: "any" })],
    [rules({ residentRequired: true }), rules({ minAge: 0, residentRequired: true })],
    [rules(), rules({ deadline: "9999-12-31T23:59:59.999Z" })],
  ];
  for (const [a, b] of equivalentPairs) {
    assert.equal(discoverCounterexamples(a, b).status, "equivalent", JSON.stringify([a, b]));
  }
  assert.equal(discoverCounterexamples(rules({ minAge: null, residentRequired: true }), rules()).status, "different");
});

test("minimum and maximum UTC domain boundaries clamp safely; unreachable eligibility differences vanish", () => {
  const min = "0000-01-01T00:00:00.000Z", max = "9999-12-31T23:59:59.999Z";
  const closedForever = rules({ deadline: min, deadlineInclusive: false });
  assert.equal(discoverCounterexamples(closedForever, { ...closedForever, minAge: 120, residentRequired: true }).status, "equivalent");
  for (const deadline of [min, max]) {
    const a = rules({ deadline }), b = { ...a, deadlineInclusive: false };
    const result = discoverCounterexamples(a, b);
    assert.equal(result.witnesses[0].attendee.submittedAt, deadline);
    assert.deepEqual(directions(result), ["left-only"]);
    verifyWitnesses(result, a, b);
  }
  assert.equal(discoverCounterexamples(rules({ deadline: max }), rules()).status, "equivalent");
});

test("every supported age threshold is covered, including zero and 120", () => {
  for (let age = 0; age <= 120; age++) {
    const a = rules({ minAge: age });
    const b = rules({ minAge: age < 120 ? age + 1 : 119 });
    const result = discoverCounterexamples(a, b);
    assert.equal(result.status, "different");
    assert.equal(result.witnesses[0].attendee.age, age < 120 ? age : 119);
    verifyWitnesses(result, a, b);
  }
});

test("unknown or invalid interpretations stay unresolved and cannot claim equivalence", () => {
  for (const [a, b] of [[null, null], [null, rules()], [rules(), null], [rules({ minAge: 121 }), rules()], [rules({ deadline: "2026-02-30T12:00:00Z" }), rules()]]) {
    const result = discoverCounterexamples(a, b);
    assert.equal(result.status, "unresolved");
    assert.deepEqual(result.witnesses, []);
    assert.equal(result.coverage.combinations, 0);
  }
});

test("results are deterministic, immutable, symmetric and bounded to at most 30 cells", () => {
  const a = Object.freeze(rules({ minAge: 41, residentRequired: true, deadline: utc(instant) }));
  const b = Object.freeze(rules({ minAge: 93, residentRequired: true, join: "any", deadline: utc(instant + 10) }));
  const result = discoverCounterexamples(a, b), reversed = discoverCounterexamples(b, a);
  assert.deepEqual(discoverCounterexamples(a, b), result);
  assert.deepEqual(directions(reversed), directions(result).map(direction => direction === "left-only" ? "right-only" : "left-only").sort());
  assert.ok(result.coverage.combinations <= 30);
  assert.ok(result.witnesses.length <= 2);
});

// Independent reference: truth-table logic, with neither production evaluator nor
// partition logic. Enumerate every age/time in a reduced domain that contains all
// randomly selected thresholds, plus a point before and after every possible cut.
function oracle(policy, age, resident, timestamp) {
  let eligible;
  if (policy.minAge === null && !policy.residentRequired) eligible = true;
  else if (policy.minAge === null) eligible = resident;
  else if (!policy.residentRequired) eligible = age >= policy.minAge;
  else if (policy.join === "all") eligible = age >= policy.minAge && resident;
  else eligible = age >= policy.minAge || resident;
  if (!eligible) return false;
  if (policy.deadline === null) return true;
  return policy.deadlineInclusive ? timestamp <= Date.parse(policy.deadline) : timestamp < Date.parse(policy.deadline);
}
test("seeded policies match an independent exhaustive reduced-domain oracle in both directions", t => {
  let state = 0x63a19;
  const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return Math.floor(state / 4294967296 * n); };
  const choose = values => values[random(values.length)];
  const randomPolicy = () => rules({
    minAge: choose([null, 0, 1, 2, 3, 4, 5, 6, 7]), residentRequired: Boolean(random(2)), join: choose(["all", "any"]),
    deadline: choose([null, ...Array.from({ length: 8 }, (_, i) => utc(instant + i + 1))]), deadlineInclusive: Boolean(random(2)),
  });
  let pairsWithBothDirections = 0, equivalentPairs = 0;
  for (let pair = 0; pair < 1500; pair++) {
    const a = randomPolicy(), b = randomPolicy(), expected = new Set();
    for (let age = 0; age <= 9; age++) for (const resident of [false, true]) for (let offset = 0; offset <= 10; offset++) {
      const l = oracle(a, age, resident, instant + offset), r = oracle(b, age, resident, instant + offset);
      if (l !== r) expected.add(l ? "left-only" : "right-only");
    }
    const result = discoverCounterexamples(a, b);
    assert.deepEqual(directions(result), [...expected].sort(), JSON.stringify({ a, b }));
    assert.equal(result.status, expected.size ? "different" : "equivalent");
    assert.ok(result.coverage.combinations <= 30);
    verifyWitnesses(result, a, b);
    if (expected.size === 2) pairsWithBothDirections++;
    if (!expected.size) equivalentPairs++;
  }
  assert.ok(pairsWithBothDirections > 30);
  assert.ok(equivalentPairs > 5);
  t.diagnostic(`1,500 seeded pairs: ${pairsWithBothDirections} differ in both directions; ${equivalentPairs} are equivalent. Each reference comparison enumerates all 220 age/residency/time combinations in the reduced domain.`);
});
