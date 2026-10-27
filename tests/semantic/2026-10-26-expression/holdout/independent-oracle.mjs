import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Independent source-level oracle. This module never imports the application,
// its interpreter, its engine, or provider output. The direct oracle does not
// inspect the golden AST. A separate generic evaluator below checks ASTs.
const FLAGS = ['resident', 'student', 'member', 'guardianConsent', 'scholarship'];
const OPEN = Date.parse('2027-04-08T16:00:00.000Z');
const EARLY = Date.parse('2027-04-09T16:00:00.000Z');
const CLOSE = Date.parse('2027-04-10T16:00:00.000Z');
const MIN_TIME = Date.parse('0000-01-01T00:00:00.000Z');
const MAX_TIME = Date.parse('9999-12-31T23:59:59.999Z');
const denied = () => ({ accepted: false, feeCents: null });
const admitted = feeCents => ({ accepted: true, feeCents });

function validateAttendee(a) {
  assert(Number.isInteger(a.age) && a.age >= 0 && a.age <= 120, 'age outside domain');
  for (const flag of FLAGS) assert.equal(typeof a[flag], 'boolean', `invalid ${flag}`);
  assert.match(a.submittedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const ms = Date.parse(a.submittedAt);
  assert(Number.isFinite(ms) && ms >= MIN_TIME && ms <= MAX_TIME, 'time outside domain');
  assert.equal(new Date(ms).toISOString(), a.submittedAt, 'invalid calendar instant');
  return ms;
}

export function evaluateIndependent(editor, attendee) {
  assert(editor === 'alice' || editor === 'bob', 'unknown policy editor');
  const a = attendee;
  const submitted = validateAttendee(a);
  if (a.age < 14) return denied();
  if (a.age < 18 && !a.guardianConsent) return denied();
  if (submitted < OPEN) return denied();
  if (editor === 'alice' ? submitted >= CLOSE : submitted > CLOSE) return denied();

  if (!a.resident && !a.member) {
    const exception = editor === 'alice'
      ? a.student && !(!a.scholarship && a.age < 21)
      : a.student && !(!a.scholarship || a.age < 21);
    if (!exception) return denied();
  }

  if (a.scholarship) return admitted(0);
  if (editor === 'alice') {
    if (a.member) return admitted(750);
    if (a.student && submitted < EARLY) return admitted(1200);
  } else {
    if (a.student && submitted < EARLY) return admitted(1200);
    if (a.member) return admitted(750);
  }
  if (a.resident) return admitted(1700);
  return admitted(2800);
}

// A small independent AST evaluator, used only to compare a submitted or
// frozen AST to the source-level oracle. It does not derive the oracle.
export function evaluateRules(rules, attendee) {
  const submitted = validateAttendee(attendee);
  function matches(c) {
    switch (c.op) {
      case 'always': return true;
      case 'all': return c.args.every(matches);
      case 'any': return c.args.some(matches);
      case 'not': return !matches(c.arg);
      case 'flag': return attendee[c.field] === c.value;
      case 'age': {
        assert(c.cmp === 'gte' || c.cmp === 'lte', 'unknown age comparison');
        return c.cmp === 'gte' ? attendee.age >= c.value : attendee.age <= c.value;
      }
      case 'time': {
        const boundary = Date.parse(c.value);
        assert(Number.isFinite(boundary), 'invalid AST boundary');
        if (c.cmp === 'lt') return submitted < boundary;
        if (c.cmp === 'lte') return submitted <= boundary;
        if (c.cmp === 'gte') return submitted >= boundary;
        if (c.cmp === 'gt') return submitted > boundary;
        throw new Error('unknown time comparison');
      }
      default: throw new Error(`unknown condition ${c.op}`);
    }
  }
  assert(rules && rules.fee.currency === 'USD', 'non-executable or non-USD rules');
  if (!matches(rules.eligibility)) return denied();
  for (const override of rules.fee.overrides) {
    if (matches(override.when)) return admitted(override.cents);
  }
  return admitted(rules.fee.defaultCents);
}

function collectRuleTimes(rules, output) {
  function visit(condition) {
    if (condition.op === 'time') {
      const ms = Date.parse(condition.value);
      assert(Number.isFinite(ms), 'invalid additional time boundary');
      for (const t of [ms - 1, ms, ms + 1]) {
        if (t >= MIN_TIME && t <= MAX_TIME) output.add(t);
      }
    } else if (condition.op === 'all' || condition.op === 'any') {
      condition.args.forEach(visit);
    } else if (condition.op === 'not') visit(condition.arg);
  }
  visit(rules.eligibility);
  rules.fee.overrides.forEach(override => visit(override.when));
}

export function* domainCases(extraRules = []) {
  // Every integer age and every independent flag assignment is enumerated.
  // Every temporal predicate is constant between the listed boundaries.
  // Candidate boundaries are also included when checking a new candidate.
  const times = new Set([MIN_TIME, MAX_TIME]);
  for (const boundary of [OPEN, EARLY, CLOSE]) {
    for (const t of [boundary - 1, boundary, boundary + 1]) times.add(t);
  }
  for (const rules of extraRules) collectRuleTimes(rules, times);
  const orderedTimes = [...times].sort((a, b) => a - b);
  for (let age = 0; age <= 120; age++) {
    for (let bits = 0; bits < 32; bits++) {
      const flags = Object.fromEntries(FLAGS.map((flag, index) => [flag, !!(bits & (1 << index))]));
      for (const ms of orderedTimes) yield { age, ...flags, submittedAt: new Date(ms).toISOString() };
    }
  }
}

export function checkCandidate(editor, candidateRules) {
  if (candidateRules === null) return { pass: false, checkedCases: 0, issue: 'Executable source unexpectedly returned null rules.' };
  let checkedCases = 0;
  let mismatches = 0;
  const firstMismatches = [];
  for (const attendee of domainCases([candidateRules])) {
    const expected = evaluateIndependent(editor, attendee);
    const actual = evaluateRules(candidateRules, attendee);
    checkedCases++;
    if (expected.accepted !== actual.accepted || expected.feeCents !== actual.feeCents) {
      mismatches++;
      if (firstMismatches.length < 8) firstMismatches.push({ attendee, expected, actual });
    }
  }
  return { pass: mismatches === 0, checkedCases, mismatches, firstMismatches };
}

export function verifyFrozenHoldout() {
  const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
  const goldens = read('goldens.json');
  const fixtures = read('boundary-cases.json');
  const executable = goldens.pairs.find(pair => pair.id === fixtures.pairId);
  const goldenRules = Object.fromEntries(executable.candidates.map(candidate => [candidate.editor, candidate.rules]));
  let boundaryChecks = 0;
  for (const fixture of fixtures.cases) {
    for (const editor of ['alice', 'bob']) {
      assert.deepEqual(evaluateIndependent(editor, fixture.attendee), fixture.expected[editor], `${fixture.id}: independent ${editor}`);
      assert.deepEqual(evaluateRules(goldenRules[editor], fixture.attendee), fixture.expected[editor], `${fixture.id}: golden AST ${editor}`);
      boundaryChecks++;
    }
  }
  const astChecks = Object.fromEntries(['alice', 'bob'].map(editor => [editor, checkCandidate(editor, goldenRules[editor])]));
  assert(astChecks.alice.pass && astChecks.bob.pass, 'golden AST disagrees with direct oracle');
  const outcomes = { bothDenied: 0, bothAdmittedSameFee: 0, admissionAliceOnly: 0, admissionBobOnly: 0, aliceFeeHigher: 0, bobFeeHigher: 0 };
  let comparedCases = 0;
  for (const attendee of domainCases()) {
    const a = evaluateIndependent('alice', attendee);
    const b = evaluateIndependent('bob', attendee);
    comparedCases++;
    if (!a.accepted && !b.accepted) outcomes.bothDenied++;
    else if (a.accepted && !b.accepted) outcomes.admissionAliceOnly++;
    else if (!a.accepted && b.accepted) outcomes.admissionBobOnly++;
    else if (a.feeCents === b.feeCents) outcomes.bothAdmittedSameFee++;
    else if (a.feeCents > b.feeCents) outcomes.aliceFeeHigher++;
    else outcomes.bobFeeHigher++;
  }
  assert(outcomes.admissionAliceOnly > 0 && outcomes.admissionBobOnly > 0 && outcomes.bobFeeHigher > 0, 'missing intended semantic differences');
  const ambiguous = goldens.pairs.find(pair => pair.id === 'pixel-loom-online-mini-course');
  assert.equal(ambiguous.expectedDiscoveryStatus, 'unresolved');
  assert(ambiguous.candidates.every(candidate => candidate.rules === null && candidate.issues.length > 0));
  const witness = ambiguous.ambiguityWitness.attendee;
  assert(witness.age >= 18 && witness.member && witness.student);
  assert(Date.parse(witness.submittedAt) >= Date.parse('2027-08-01T09:00:00.000Z'));
  assert(Date.parse(witness.submittedAt) <= Date.parse('2027-08-03T09:00:00.000Z'));
  assert.deepEqual(ambiguous.ambiguityWitness.possibleFeeCents, [900, 1300]);
  return {
    pass: true,
    independentOracle: 'Source-level control flow, with no application imports or provider output',
    handSpecifiedCases: fixtures.cases.length,
    boundaryPolicyChecks: boundaryChecks,
    goldenASTChecks: astChecks,
    pairComparison: { expectedStatus: 'different', comparedCases, ageValues: 121, flagAssignments: 32, timeRepresentatives: comparedCases / (121 * 32), outcomes },
    ambiguity: { expectedStatus: 'unresolved', bothRulesNull: true, overlappingFeeCents: [900, 1300] }
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.stdout.write(JSON.stringify(verifyFrozenHoldout(), null, 2) + '\n');
}
