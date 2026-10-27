// Independently authored semantic oracle. No app imports, provider calls, or AST construction.
const STAGES = new Set(['alice', 'bob', 'unsafe', 'repaired']);
const OPEN = Date.parse('2027-02-12T17:30:00.000Z');
const CLOSE = Date.parse('2027-02-20T02:15:00.000Z');
const UNSAFE_CLOSE = Date.parse('2027-02-20T02:45:00.000Z');
const FLAGS = ['resident', 'student', 'member', 'guardianConsent', 'scholarship'];

function assertStage(stage) {
  if (!STAGES.has(stage)) throw new TypeError(`Unknown policy stage: ${stage}`);
}

/** Evaluate directly from the independently authored policy, not a returned rule tree. */
export function expectedOutcome(stage, attendee) {
  assertStage(stage);
  const t = Date.parse(attendee.submittedAt);
  const close = stage === 'unsafe' ? UNSAFE_CLOSE : CLOSE;
  const hasTeenException = stage === 'bob'
    ? attendee.resident || attendee.member
    : attendee.resident && attendee.member;
  const accepted = t >= OPEN && t < close && attendee.age >= 16
    && (attendee.age >= 18 || attendee.guardianConsent || hasTeenException);
  if (!accepted) return { accepted: false, feeCents: null };

  // The exact student fee supersedes every original tier, including scholarships.
  if ((stage === 'unsafe' || stage === 'repaired') && attendee.student) {
    return { accepted: true, feeCents: 3250 };
  }
  let feeCents;
  if (attendee.scholarship) feeCents = 0;
  else if (attendee.resident && attendee.member) feeCents = 1850;
  else if (attendee.student && attendee.member) feeCents = 2650;
  else if (attendee.resident) feeCents = 3450;
  else if (attendee.student) feeCents = 4550;
  else if (attendee.member) feeCents = 4950;
  else feeCents = 6350;
  return { accepted: true, feeCents };
}

function returnedTimeBoundaries(rules) {
  const boundaries = new Set();
  const seen = new Set();
  function visit(value) {
    if (value == null) return;
    if (typeof value === 'string') {
      // Walk every rule value, without assuming any app-specific AST field names.
      // Full ISO timestamps with UTC or an explicit offset are accepted.
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
        const n = Date.parse(value);
        if (Number.isFinite(n)) boundaries.add(n);
      } else if (/^\d{12,16}$/.test(value)) {
        const n = Number(value);
        if (Number.isSafeInteger(n) && Math.abs(n) < 8640000000000000) boundaries.add(n);
      }
      return;
    }
    if (typeof value === 'number') {
      // Ages and cents are small; these values represent millisecond timestamps.
      if (Number.isSafeInteger(value) && Math.abs(value) >= 100000000000
          && Math.abs(value) < 8640000000000000) boundaries.add(value);
      return;
    }
    if (typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const item of Object.values(value)) visit(item);
  }
  visit(rules);
  return boundaries;
}

/**
 * Synchronous exhaustive finite-domain check at authored and returned boundaries.
 * evaluate(rules, attendee) must synchronously return {accepted, feeCents}.
 * Samples every integer age 0..120 and all 32 independent boolean assignments.
 */
export function verifyRules(rules, stage, evaluate) {
  assertStage(stage);
  if (typeof evaluate !== 'function') throw new TypeError('evaluate must be a function');
  const boundaries = new Set([OPEN, CLOSE, UNSAFE_CLOSE, ...returnedTimeBoundaries(rules)]);
  const timestamps = new Set();
  const ordered = [...boundaries].sort((a, b) => a - b);
  for (let index = 0; index < ordered.length; index++) {
    const boundary = ordered[index];
    for (const delta of [-1, 0, 1]) {
      const value = boundary + delta;
      if (Math.abs(value) <= 8640000000000000) timestamps.add(value);
    }
    // Midpoints also exercise the interiors of every induced time interval.
    if (index > 0 && boundary - ordered[index - 1] > 1) {
      timestamps.add(ordered[index - 1] + Math.floor((boundary - ordered[index - 1]) / 2));
    }
  }
  timestamps.add(Date.parse('2027-02-16T12:00:00.000Z'));
  let checkedCases = 0;
  let mismatchCount = 0;
  const mismatches = [];
  for (const instant of [...timestamps].sort((a, b) => a - b)) {
    const submittedAt = new Date(instant).toISOString();
    for (let age = 0; age <= 120; age++) {
      for (let mask = 0; mask < 32; mask++) {
        const attendee = { age, submittedAt };
        FLAGS.forEach((flag, index) => { attendee[flag] = Boolean(mask & (1 << index)); });
        const expected = expectedOutcome(stage, attendee);
        let actual;
        let error;
        try {
          actual = evaluate(rules, { ...attendee });
          if (actual && typeof actual.then === 'function') {
            throw new TypeError('evaluate must return synchronously, not a Promise');
          }
        } catch (caught) {
          error = String(caught && caught.message || caught);
        }
        checkedCases++;
        if (error || !actual || actual.accepted !== expected.accepted
            || actual.feeCents !== expected.feeCents) {
          mismatchCount++;
          if (mismatches.length < 12) {
            mismatches.push({ attendee, expected, actual: actual ?? null, ...(error ? { error } : {}) });
          }
        }
      }
    }
  }
  return {
    ok: mismatchCount === 0,
    stage,
    checkedCases,
    boundaries: ordered.map(value => new Date(value).toISOString()),
    mismatchCount,
    mismatches,
  };
}
