import { evaluatePolicy, parsePolicyRules } from "./consequences.ts";
import type { PolicyAttendee, PolicyDecision, PolicyRules } from "./consequences-types";

export interface CounterexampleWitness {
  id: string;
  direction: "left-only" | "right-only";
  attendee: PolicyAttendee;
  left: PolicyDecision;
  right: PolicyDecision;
  explanation: { en: string; es: string };
}
export interface CounterexampleCoverage {
  agePartitions: number;
  timePartitions: number;
  residencyValues: 2;
  combinations: number;
  domain: { ageMin: 0; ageMax: 120; timeMin: string; timeMax: string };
  scope: string;
}
export interface CounterexampleDiscovery {
  status: "different" | "equivalent" | "unresolved";
  witnesses: CounterexampleWitness[];
  summary: { en: string; es: string };
  coverage: CounterexampleCoverage;
}

const TIME_MIN = Date.parse("0000-01-01T00:00:00.000Z");
const TIME_MAX = Date.parse("9999-12-31T23:59:59.999Z");
const DEFAULT_TIME = Date.parse("2030-01-01T12:00:00.000Z");
const DOMAIN: CounterexampleCoverage["domain"] = {
  ageMin: 0, ageMax: 120,
  timeMin: "0000-01-01T00:00:00.000Z", timeMax: "9999-12-31T23:59:59.999Z",
};
const SCOPE = "Complete comparison of the two executable interpretations for integer ages 0–120, resident or nonresident, and valid four-digit-year UTC instants at millisecond precision. This does not prove the original language was interpreted correctly, or that real people are affected.";
interface Partition { lo: number; hi: number; representative: number }
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

function partition(min: number, max: number, cuts: number[], choose: (lo: number, hi: number) => number): Partition[] {
  const starts = [...new Set([min, ...cuts.filter(cut => cut > min && cut <= max), max + 1])].sort((a, b) => a - b);
  return starts.slice(0, -1).map((lo, index) => {
    const hi = starts[index + 1] - 1;
    return { lo, hi, representative: choose(lo, hi) };
  });
}

function rejection(rules: PolicyRules, decision: PolicyDecision, es: boolean): string {
  const reasons: string[] = [];
  if (!decision.checks.eligibility) {
    if (rules.join === "any" && rules.minAge !== null && rules.residentRequired) {
      reasons.push(es ? `no tiene al menos ${rules.minAge} años ni reside en el barrio` : `the attendee neither reaches age ${rules.minAge} nor lives in the neighborhood`);
    } else {
      if (decision.checks.age === false) reasons.push(es ? `no tiene al menos ${rules.minAge} años` : `the attendee is under age ${rules.minAge}`);
      if (decision.checks.residency === false) reasons.push(es ? "no reside en el barrio" : "the attendee is not a neighborhood resident");
    }
  }
  if (decision.checks.deadline === false) {
    reasons.push(es
      ? `la inscripción no llegó ${rules.deadlineInclusive ? "a más tardar el" : "antes del"} ${rules.deadline}`
      : `registration did not arrive ${rules.deadlineInclusive ? "on or before" : "before"} ${rules.deadline}`);
  }
  return reasons.join(es ? " y " : " and ");
}

function describe(attendee: PolicyAttendee, left: PolicyRules, right: PolicyRules, a: PolicyDecision, b: PolicyDecision): CounterexampleWitness["explanation"] {
  const accepting = a.accepted ? "A" : "B", rejecting = a.accepted ? "B" : "A";
  const rejectedRules = a.accepted ? right : left, rejectedDecision = a.accepted ? b : a;
  return {
    en: `A ${attendee.age}-year-old ${attendee.resident ? "neighborhood resident" : "nonresident"} registers at ${attendee.submittedAt}. Rule ${accepting} accepts; Rule ${rejecting} rejects because ${rejection(rejectedRules, rejectedDecision, false)}.`,
    es: `Una persona de ${attendee.age} años que ${attendee.resident ? "reside" : "no reside"} en el barrio se inscribe el ${attendee.submittedAt}. La regla ${accepting} acepta; la regla ${rejecting} rechaza porque ${rejection(rejectedRules, rejectedDecision, true)}.`,
  };
}

function unresolved(message: string, spanish: string): CounterexampleDiscovery {
  return { status: "unresolved", witnesses: [], summary: { en: message, es: spanish },
    coverage: { agePartitions: 0, timePartitions: 0, residencyValues: 2, combinations: 0, domain: { ...DOMAIN }, scope: SCOPE } };
}

/**
 * Enumerate one representative of every decision-equivalence cell, not a sample.
 * Age predicates change only at their integer minimum ages. Time predicates change
 * only at a deadline (strict) or one millisecond later (inclusive). Splitting at
 * both instants also makes exact-deadline examples legible. Residency has two values.
 * Every evaluator predicate is constant in each resulting Cartesian-product cell,
 * so checking one member per cell covers the complete declared input domain.
 */
export function discoverCounterexamples(leftValue: PolicyRules | null, rightValue: PolicyRules | null): CounterexampleDiscovery {
  if (!leftValue || !rightValue) return unresolved("Cannot compare until both policies have executable interpretations. No equivalence claim is possible.", "No se pueden comparar hasta que ambas políticas tengan interpretaciones ejecutables. No se puede afirmar que sean equivalentes.");
  let left: PolicyRules, right: PolicyRules;
  try { left = parsePolicyRules(leftValue); right = parsePolicyRules(rightValue); }
  catch { return unresolved("A structured policy is invalid; comparison is unresolved.", "Una política estructurada no es válida; la comparación queda sin resolver."); }

  const deadlines = [left.deadline, right.deadline].filter((value): value is string => value !== null).map(value => Date.parse(value)).sort((a, b) => a - b);
  const ageCuts = [left.minAge, right.minAge].filter((value): value is number => value !== null);
  const ages = partition(0, 120, ageCuts, (lo, hi) => clamp(18, lo, hi));
  const times = partition(TIME_MIN, TIME_MAX, deadlines.flatMap(value => [value, value + 1]), (lo, hi) => {
    // Prefer a named deadline, then a normal instant before it, over the domain's
    // year-zero boundary. A one-millisecond interval necessarily keeps that detail.
    const exact = deadlines.find(deadline => deadline >= lo && deadline <= hi);
    if (exact !== undefined) return exact;
    return clamp(deadlines.length ? deadlines[0] - 3600000 : DEFAULT_TIME, lo, hi);
  });
  const coverage: CounterexampleCoverage = { agePartitions: ages.length, timePartitions: times.length, residencyValues: 2, combinations: ages.length * times.length * 2, domain: { ...DOMAIN }, scope: SCOPE };
  const best = new Map<CounterexampleWitness["direction"], { witness: CounterexampleWitness; rank: number[] }>();
  const isEarlierRank = (rank: number[], previous: number[]) => {
    for (let index = 0; index < rank.length; index++) {
      if (rank[index] !== previous[index]) return rank[index] < previous[index];
    }
    return false;
  };

  for (const age of ages) for (const time of times) for (const resident of [false, true]) {
    const attendee = { age: age.representative, resident, submittedAt: new Date(time.representative).toISOString() };
    const a = evaluatePolicy(left, attendee), b = evaluatePolicy(right, attendee);
    if (a.accepted === b.accepted) continue;
    const direction = a.accepted ? "left-only" : "right-only";
    // The ranking picks readable witnesses only; it never changes search coverage.
    const rank = [Math.abs(attendee.age - 18), Number(resident), time.representative % 60000 === 0 ? 0 : 1, Math.abs(time.representative - (deadlines[0] ?? DEFAULT_TIME)), time.representative];
    const previous = best.get(direction);
    if (!previous || isEarlierRank(rank, previous.rank)) {
      best.set(direction, { rank, witness: {
        id: `${direction}-${attendee.age}-${resident ? "resident" : "nonresident"}-${time.representative}`,
        direction, attendee, left: a, right: b, explanation: describe(attendee, left, right, a, b),
      } });
    }
  }
  const witnesses = (["left-only", "right-only"] as const).flatMap(direction => best.has(direction) ? [best.get(direction)!.witness] : []);
  return { status: witnesses.length ? "different" : "equivalent", witnesses, coverage,
    summary: witnesses.length ? {
      en: witnesses.length === 2 ? "Each interpretation accepts someone the other rejects." : "Found an attendee accepted by one interpretation and rejected by the other.",
      es: witnesses.length === 2 ? "Cada interpretación acepta a alguien que la otra rechaza." : "Se encontró una persona aceptada por una interpretación y rechazada por la otra.",
    } : {
      en: "The executable interpretations make the same acceptance decision throughout the supported input domain. This is not a claim that the original texts mean the same thing.",
      es: "Las interpretaciones ejecutables toman la misma decisión de aceptación en todo el dominio admitido. Esto no afirma que los textos originales signifiquen lo mismo.",
    } };
}
