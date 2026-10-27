// Independent source-of-truth oracle. No application imports or model calls.
export const SOURCE_BOUNDARIES = Object.freeze([
  '2026-11-01T00:00:00.000Z',
  '2026-11-20T00:00:00.000Z',
  '2026-11-25T00:00:00.000Z',
  '2026-12-01T00:00:00.000Z',
]);

const [OPEN, WAIVER_END, LOCAL_ONLY, CLOSE] = SOURCE_BOUNDARIES.map(Date.parse);
const TARGET_FEE = 1800;
const STAGES = new Set(['alice', 'bob', 'unsafe', 'repaired']);

export function expectedOutcome(stage, attendee) {
  if (!STAGES.has(stage)) throw new Error(`Unknown oracle stage: ${stage}`);
  const { age, resident, student, member, guardianConsent, scholarship, submittedAt } = attendee;
  const time = Date.parse(submittedAt);
  const lateWaiverException = stage === 'bob'
    ? (member || scholarship)
    : (member && scholarship);
  const minorConsentSatisfied = age >= 18 || guardianConsent || (
    resident && student && (time < WAIVER_END || lateWaiverException)
  );
  const lateNonresidentException = stage === 'unsafe'
    ? scholarship
    : (member && scholarship);
  const accepted = age >= 14
    && time >= OPEN && time < CLOSE
    && (resident || student || member || scholarship)
    && minorConsentSatisfied
    && (resident || time < LOCAL_ONLY || lateNonresidentException);
  if (!accepted) return { accepted: false, feeCents: null };

  let feeCents;
  if ((stage === 'unsafe' || stage === 'repaired') && member) feeCents = TARGET_FEE;
  else if (scholarship) feeCents = 0;
  else if (resident && student) feeCents = 1200;
  else if (age < 18) feeCents = 1600;
  else if (member) feeCents = 2600;
  else if (resident) feeCents = 3000;
  else feeCents = 4200;
  return { accepted: true, feeCents };
}

// Include timestamps embedded in natural-language strings and arbitrary AST keys/values.
function findTimestamps(value, instants, seen = new Set()) {
  if (typeof value === 'string') {
    const matches = value.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})/g) || [];
    for (const match of matches) {
      const instant = Date.parse(match);
      if (Number.isFinite(instant)) instants.add(instant);
    }
  } else if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      findTimestamps(key, instants, seen);
      findTimestamps(child, instants, seen);
    }
  }
}

export function verificationInstants(rules) {
  const boundaryInstants = new Set(SOURCE_BOUNDARIES.map(Date.parse));
  findTimestamps(rules, boundaryInstants);
  const instants = new Set([
    Date.parse('2026-01-01T12:00:00.000Z'),
    Date.parse('2026-11-10T12:34:56.789Z'),
    Date.parse('2026-11-22T12:34:56.789Z'),
    Date.parse('2026-11-28T12:34:56.789Z'),
    Date.parse('2027-01-01T12:00:00.000Z'),
  ]);
  for (const boundary of boundaryInstants) {
    for (const delta of [-1, 0, 1]) instants.add(boundary + delta);
  }
  return [...instants].sort((a, b) => a - b).map(t => new Date(t).toISOString());
}

export function verifyRules(rules, stage, evaluate) {
  if (!STAGES.has(stage)) throw new Error(`Unknown oracle stage: ${stage}`);
  const instants = verificationInstants(rules);
  const mismatches = [];
  let checkedCases = 0;
  let mismatchCount = 0;
  for (let age = 0; age <= 120; age++) {
    for (let flags = 0; flags < 32; flags++) {
      const base = {
        age,
        resident: Boolean(flags & 1),
        student: Boolean(flags & 2),
        member: Boolean(flags & 4),
        guardianConsent: Boolean(flags & 8),
        scholarship: Boolean(flags & 16),
      };
      for (const submittedAt of instants) {
        const attendee = { ...base, submittedAt };
        const expected = expectedOutcome(stage, attendee);
        let actual;
        let evaluationError;
        try {
          actual = evaluate(rules, attendee);
        } catch (error) {
          evaluationError = String(error?.message || error);
        }
        checkedCases++;
        if (evaluationError || actual?.accepted !== expected.accepted || actual?.feeCents !== expected.feeCents) {
          mismatchCount++;
          if (mismatches.length < 60) mismatches.push({ attendee, expected, actual: actual ?? null, ...(evaluationError ? { evaluationError } : {}) });
        }
      }
    }
  }
  return { ok: mismatchCount === 0, checkedCases, mismatchCount, mismatches };
}
