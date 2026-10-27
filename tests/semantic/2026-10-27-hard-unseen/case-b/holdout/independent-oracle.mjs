const OPEN_A = Date.parse('2026-11-03T08:00:00.000Z');
const CLOSE_A = Date.parse('2026-11-08T20:00:00.000Z');
const OPEN_B = Date.parse('2026-11-12T16:00:00.000Z');
const CLOSE_B = Date.parse('2026-11-17T23:59:59.999Z');
const STAGES = new Set(['alice', 'bob', 'unsafe', 'repaired']);
const FLAGS = ['resident', 'student', 'member', 'guardianConsent', 'scholarship'];

// Deliberately independent of any application parser, AST shape, or evaluator.
export function expectedOutcome(stage, attendee) {
  if (!STAGES.has(stage)) throw new Error(`Unknown stage: ${stage}`);
  const a = attendee;
  const t = Date.parse(a.submittedAt);
  const inFirstWindow = OPEN_A <= t && t < CLOSE_A;
  const inSecondWindow = (stage === 'bob' ? OPEN_B <= t : OPEN_B < t) && t <= CLOSE_B;
  const minorEligible = a.age >= 14 && a.age < 18 && a.guardianConsent &&
    (a.resident || (a.student && !a.member));
  const adultEligible = a.age >= 18 &&
    ((a.resident && !a.scholarship) || (a.student && (a.member || !a.scholarship)));
  const accepted = (inFirstWindow || inSecondWindow) && (minorEligible || adultEligible);
  if (!accepted) return {accepted: false, feeCents: null};
  if ((stage === 'unsafe' || stage === 'repaired') && a.resident)
    return {accepted: true, feeCents: 4200};
  const feeCents = a.scholarship ? 1800 : a.member ? 3600 : a.age < 18 ? 2900 :
    a.student ? (stage === 'unsafe' ? 5100 : 4800) : 6400;
  return {accepted: true, feeCents};
}

function timestampSamples(rules) {
  const boundaries = new Set([OPEN_A, CLOSE_A, OPEN_B, CLOSE_B]);
  const visited = new WeakSet();
  const isoUtc = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z/g;
  function scan(value) {
    if (typeof value === 'string') {
      for (const found of value.matchAll(isoUtc)) {
        const n = Date.parse(found[0]);
        if (Number.isFinite(n)) boundaries.add(n);
      }
    } else if (value && typeof value === 'object' && !visited.has(value)) {
      visited.add(value);
      for (const child of Object.values(value)) scan(child);
    }
  }
  scan(rules);
  const times = new Set([
    Date.parse('2026-11-01T12:00:00.000Z'),
    Date.parse('2026-11-05T12:00:00.000Z'),
    Date.parse('2026-11-10T12:00:00.000Z'),
    Date.parse('2026-11-15T12:00:00.000Z'),
    Date.parse('2026-11-20T12:00:00.000Z'),
  ]);
  const sorted = [...boundaries].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    for (const offset of [-1, 0, 1]) times.add(sorted[i] + offset);
    if (i) times.add(Math.floor((sorted[i - 1] + sorted[i]) / 2));
  }
  return [...times].sort((a, b) => a - b).map(n => new Date(n).toISOString());
}

// evaluate is the caller's synchronous adapter: evaluate(rules, attendee).
// Every tested time is crossed with every integer age 0..120 and all 32 flag sets.
export function verifyRules(rules, stage, evaluate) {
  if (!STAGES.has(stage)) throw new Error(`Unknown stage: ${stage}`);
  let checkedCases = 0;
  let mismatchCount = 0;
  const mismatches = [];
  const times = timestampSamples(rules);
  for (const submittedAt of times) for (let age = 0; age <= 120; age++) {
    for (let mask = 0; mask < 32; mask++) {
      const attendee = {age};
      FLAGS.forEach((flag, bit) => { attendee[flag] = Boolean(mask & (1 << bit)); });
      attendee.submittedAt = submittedAt;
      const expected = expectedOutcome(stage, attendee);
      let actual;
      try {
        actual = evaluate(rules, attendee);
      } catch (error) {
        actual = {error: String(error?.message ?? error)};
      }
      checkedCases++;
      if (actual?.accepted !== expected.accepted || actual?.feeCents !== expected.feeCents) {
        mismatchCount++;
        if (mismatches.length < 100) mismatches.push({attendee, expected, actual});
      }
    }
  }
  return {ok: mismatchCount === 0, checkedCases, mismatchCount, mismatches};
}
