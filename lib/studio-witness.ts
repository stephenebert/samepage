import { evaluateStudioPolicy, parseStudioAttendee, parseStudioRules, STUDIO_FLAGS } from "./studio-engine.ts";
import type { StudioAttendee, StudioCondition, StudioFlag, StudioRules, StudioWitness } from "./studio-types";

type Predicate = (attendee: StudioAttendee, time: number) => boolean;
function compile(condition: StudioCondition): Predicate {
  switch (condition.op) {
    case "always": return () => true;
    case "age": return condition.cmp === "gte" ? a => a.age >= condition.value : a => a.age <= condition.value;
    case "flag": return a => a[condition.field] === condition.value;
    case "not": { const child = compile(condition.arg); return (a, t) => !child(a, t); }
    case "all": { const children = condition.args.map(compile); return (a, t) => children.every(child => child(a, t)); }
    case "any": { const children = condition.args.map(compile); return (a, t) => children.some(child => child(a, t)); }
    case "time": {
      const boundary = Date.parse(condition.value);
      return condition.cmp === "lt" ? (_a, t) => t < boundary : condition.cmp === "lte" ? (_a, t) => t <= boundary : condition.cmp === "gt" ? (_a, t) => t > boundary : (_a, t) => t >= boundary;
    }
  }
}
function policy(rules: StudioRules) {
  const eligible = compile(rules.eligibility), overrides = rules.fee.overrides.map(item => ({ matches: compile(item.when), cents: item.cents }));
  return (attendee: StudioAttendee, time: number) => eligible(attendee, time) ? overrides.find(item => item.matches(attendee, time))?.cents ?? rules.fee.defaultCents : null;
}
function difference(left: number | null, right: number | null): StudioWitness["id"] | null {
  if (left !== null && right === null) return "admission-left";
  if (left === null && right !== null) return "admission-right";
  if (left !== null && right !== null && left !== right) return left > right ? "price-left-higher" : "price-right-higher";
  return null;
}
function facts(value: StudioAttendee): StudioAttendee {
  return parseStudioAttendee({ age: value.age, resident: value.resident, student: value.student, member: value.member, guardianConsent: value.guardianConsent, scholarship: value.scholarship, submittedAt: value.submittedAt });
}
function explain(left: ReturnType<typeof evaluateStudioPolicy>, right: ReturnType<typeof evaluateStudioPolicy>) {
  return left.accepted && right.accepted ? {
    en: `Both admit this person, but A charges $${(left.feeCents! / 100).toFixed(2)} and B charges $${(right.feeCents! / 100).toFixed(2)}.`,
    es: `Ambas admiten a esta persona, pero A cobra $${(left.feeCents! / 100).toFixed(2)} y B cobra $${(right.feeCents! / 100).toFixed(2)}.`,
  } : left.accepted ? { en: "A admits this person; B refuses them.", es: "A admite a esta persona; B la rechaza." }
    : { en: "B admits this person; A refuses them.", es: "B admite a esta persona; A la rechaza." };
}

/** A presentation example, not a replacement for the exhaustive discovery.
 * Every replacement is evaluated against the actual rules. It retains the
 * discrepancy's direction and, for repairs, in/out-of-scope classification.
 * Prefer saved receipt facts so the story and working form concern one person.
 * If a real edge case is necessary, retain it rather than invent a nicer one.
 */
export function realisticStudioWitness(leftValue: StudioRules | null, rightValue: StudioRules | null, witness: StudioWitness, preferredAttendee?: StudioAttendee, preserveFlag?: StudioFlag): StudioWitness {
  if (!leftValue || !rightValue) return witness;
  let left: StudioRules, right: StudioRules;
  try { left = parseStudioRules(leftValue); right = parseStudioRules(rightValue); } catch { return witness; }
  const leftFee = policy(left), rightFee = policy(right);
  const valid = (attendee: StudioAttendee) => (!preserveFlag || attendee[preserveFlag] === witness.attendee[preserveFlag])
    && difference(leftFee(attendee, Date.parse(attendee.submittedAt)), rightFee(attendee, Date.parse(attendee.submittedAt))) === witness.id;
  const result = (attendee: StudioAttendee): StudioWitness => {
    const a = evaluateStudioPolicy(left, attendee), b = evaluateStudioPolicy(right, attendee);
    return { ...witness, attendee, left: a, right: b, feeDeltaCents: a.accepted && b.accepted ? Math.abs(a.feeCents! - b.feeCents!) : null, explanation: explain(a, b) };
  };
  if (preferredAttendee) {
    try { const preferred = facts(preferredAttendee); if (valid(preferred)) return result(preferred); } catch { /* Invalid receipt facts cannot become a presentation witness. */ }
  }
  const ageBounds = new Set<number>(), timeBounds = new Set<number>();
  const collect = (c: StudioCondition) => {
    if (c.op === "age") ageBounds.add(c.value);
    else if (c.op === "time") timeBounds.add(Date.parse(c.value));
    else if (c.op === "not") collect(c.arg);
    else if (c.op === "all" || c.op === "any") c.args.forEach(collect);
  };
  for (const rules of [left, right]) { collect(rules.eligibility); rules.fee.overrides.forEach(item => collect(item.when)); }
  const ages = new Set([20, 24, 27, 17, 18, 16, 35, 40, 65, 75, 12, 8]);
  for (const boundary of ageBounds) for (const age of [boundary, boundary - 1, boundary + 1]) if (age >= 0 && age <= 120) ages.add(age);
  ages.add(witness.attendee.age);
  const times = new Set<number>(), bounds = [...timeBounds].sort((a, b) => a - b), day = 86400000;
  const addTime = (ms: number) => { if (Number.isFinite(ms) && ms >= Date.parse("0000-01-01T00:00:00.000Z") && ms <= Date.parse("9999-12-31T23:59:59.999Z")) times.add(ms); };
  // Noon inside an interval is easier to read than an arbitrary millisecond.
  for (let index = 1; index < bounds.length; index++) {
    const low = bounds[index - 1], high = bounds[index], middle = Math.floor((low + high) / 2), noon = Math.floor(middle / day) * day + day / 2;
    if (noon > low && noon < high) addTime(noon);
    if (middle > low && middle < high) addTime(middle);
  }
  const witnessTime = Date.parse(witness.attendee.submittedAt);
  if (!bounds.length) addTime(Date.parse("2026-10-26T12:00:00.000Z"));
  for (const boundary of bounds) { addTime(Math.floor(boundary / day) * day - day / 2); addTime(Math.floor(boundary / day) * day + day * 1.5); }
  addTime(Math.floor(witnessTime / day) * day + day / 2);
  for (const boundary of bounds) for (const ms of [boundary, boundary - 1, boundary + 1]) addTime(ms);
  addTime(witnessTime);
  const originalBits = STUDIO_FLAGS.reduce((bits, flag, index) => bits | (witness.attendee[flag] ? 1 << index : 0), 0);
  const flagSets = [originalBits, ...Array.from({ length: 32 }, (_, bits) => bits).filter(bits => bits !== originalBits)];
  let checked = 0;
  for (const age of ages) for (const ms of times) for (const bits of flagSets) {
    if (++checked > 30000) return witness;
    const attendee: StudioAttendee = { age, resident: Boolean(bits & 1), student: Boolean(bits & 2), member: Boolean(bits & 4), guardianConsent: Boolean(bits & 8), scholarship: Boolean(bits & 16), submittedAt: new Date(ms).toISOString() };
    if (valid(attendee)) return result(attendee);
  }
  return witness;
}
