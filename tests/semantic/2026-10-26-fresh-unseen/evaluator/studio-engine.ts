import { RoomError } from "./room.ts";
import type { StudioAttendee, StudioCondition, StudioDecision, StudioDiscovery, StudioFlag, StudioLanguage, StudioRules, StudioText, StudioTrace, StudioWitness } from "./studio-types";

export const STUDIO_FLAGS: StudioFlag[] = ["resident", "student", "member", "guardianConsent", "scholarship"];
const labels: Record<StudioFlag, StudioText> = {
  resident: { en: "resident", es: "residente" }, student: { en: "student", es: "estudiante" },
  member: { en: "member", es: "miembro" }, guardianConsent: { en: "guardian consent", es: "consentimiento del tutor" },
  scholarship: { en: "scholarship", es: "beca" },
};
const fail = (message: string): never => { throw new RoomError(message); };
export function studioObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(`${name} must be an object.`);
  return value as Record<string, unknown>;
}
export function studioKeys(value: Record<string, unknown>, expected: string[], name: string) {
  if (Object.keys(value).sort().join("|") !== [...expected].sort().join("|")) fail(`${name} has missing or unexpected fields.`);
}
export function studioInteger(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return fail(`${name} must be an integer from ${min} to ${max}.`);
  return value;
}
export function studioText(value: unknown, name: string, max = 6000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) return fail(`${name} must be nonempty text of at most ${max} characters.`);
  return value;
}
export function studioBool(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") return fail(`${name} must be true or false.`);
  return value;
}
export function studioUTC(value: unknown, name: string): string {
  const result = studioText(value, name, 30);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(result)) fail(`${name} must be an explicit ISO UTC instant ending in Z.`);
  const ms = Date.parse(result), normalized = result.includes(".") ? result : result.replace("Z", ".000Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== normalized) fail(`${name} is not a valid UTC date.`);
  return normalized;
}
export function parseStudioRules(value: unknown): StudioRules {
  const root = studioObject(value, "rules"); studioKeys(root, ["eligibility", "fee"], "rules");
  let nodes = 0;
  function condition(input: unknown, depth: number): StudioCondition {
    if (++nodes > 128 || depth > 8) fail("Policy exceeds the 128-node or 8-level limit.");
    const c = studioObject(input, "condition");
    if (c.op === "always") { studioKeys(c, ["op"], "always condition"); return { op: "always" }; }
    if (c.op === "all" || c.op === "any") {
      studioKeys(c, ["op", "args"], "group condition");
      if (!Array.isArray(c.args) || c.args.length < 1 || c.args.length > 16) fail("A condition group needs 1..16 conditions.");
      return { op: c.op, args: (c.args as unknown[]).map(a => condition(a, depth + 1)) };
    }
    if (c.op === "not") { studioKeys(c, ["op", "arg"], "not condition"); return { op: "not", arg: condition(c.arg, depth + 1) }; }
    if (c.op === "age") {
      studioKeys(c, ["op", "cmp", "value"], "age condition");
      if (c.cmp !== "gte" && c.cmp !== "lte") fail("Age comparison must be gte or lte.");
      return { op: "age", cmp: c.cmp as "gte" | "lte", value: studioInteger(c.value, "age boundary", 0, 120) };
    }
    if (c.op === "flag") {
      studioKeys(c, ["op", "field", "value"], "flag condition");
      if (!STUDIO_FLAGS.includes(c.field as StudioFlag)) fail("Unsupported policy flag.");
      return { op: "flag", field: c.field as StudioFlag, value: studioBool(c.value, "flag value") };
    }
    if (c.op === "time") {
      studioKeys(c, ["op", "cmp", "value"], "time condition");
      if (!["lt", "lte", "gte", "gt"].includes(c.cmp as string)) fail("Unsupported time comparison.");
      return { op: "time", cmp: c.cmp as "lt" | "lte" | "gte" | "gt", value: studioUTC(c.value, "time boundary") };
    }
    return fail("Unsupported condition; do not partially interpret it.");
  }
  const eligibility = condition(root.eligibility, 1), fee = studioObject(root.fee, "fee");
  studioKeys(fee, ["currency", "defaultCents", "overrides"], "fee");
  if (fee.currency !== "USD") fail("Only USD integer-cent fees are supported.");
  if (!Array.isArray(fee.overrides) || fee.overrides.length > 16) fail("At most 16 ordered fee overrides are supported.");
  return { eligibility, fee: { currency: "USD", defaultCents: studioInteger(fee.defaultCents, "defaultCents", 0, 1000000),
    overrides: (fee.overrides as unknown[]).map(input => {
      const override = studioObject(input, "fee override"); studioKeys(override, ["when", "cents", "label"], "fee override");
      return { when: condition(override.when, 1), cents: studioInteger(override.cents, "override cents", 0, 1000000), label: studioText(override.label, "override label", 160) };
    }) } };
}
export function parseStudioAttendee(value: unknown): StudioAttendee {
  const a = studioObject(value, "attendee"); studioKeys(a, ["age", ...STUDIO_FLAGS, "submittedAt"], "attendee");
  return { age: studioInteger(a.age, "age", 0, 120), resident: studioBool(a.resident, "resident"), student: studioBool(a.student, "student"), member: studioBool(a.member, "member"), guardianConsent: studioBool(a.guardianConsent, "guardianConsent"), scholarship: studioBool(a.scholarship, "scholarship"), submittedAt: studioUTC(a.submittedAt, "submittedAt") };
}
function conditionText(c: StudioCondition, lang: StudioLanguage): string {
  const es = lang === "es", comparison = { gte: "≥", lte: "≤", lt: "<", gt: ">" };
  switch (c.op) {
    case "always": return es ? "todas las personas" : "everyone";
    case "age": return `${es ? "edad" : "age"} ${comparison[c.cmp]} ${c.value}`;
    case "flag": return `${c.value ? "" : (es ? "NO " : "NOT ")}${labels[c.field][lang]}`;
    case "time": return `${es ? "inscripción" : "submitted"} ${comparison[c.cmp]} ${c.value}`;
    case "not": return `${es ? "NO" : "NOT"} (${conditionText(c.arg, lang)})`;
    default: return `(${c.args.map(a => conditionText(a, lang)).join(c.op === "all" ? (es ? " Y " : " AND ") : (es ? " O " : " OR "))})`;
  }
}
function matches(c: StudioCondition, a: StudioAttendee, ms: number): boolean {
  switch (c.op) {
    case "always": return true;
    case "all": return c.args.every(arg => matches(arg, a, ms));
    case "any": return c.args.some(arg => matches(arg, a, ms));
    case "not": return !matches(c.arg, a, ms);
    case "age": return c.cmp === "gte" ? a.age >= c.value : a.age <= c.value;
    case "flag": return a[c.field] === c.value;
    case "time": { const boundary = Date.parse(c.value); return c.cmp === "lt" ? ms < boundary : c.cmp === "lte" ? ms <= boundary : c.cmp === "gte" ? ms >= boundary : ms > boundary; }
  }
}
function outcome(r: StudioRules, a: StudioAttendee, ms: number): { accepted: boolean; feeCents: number | null; override: number } {
  if (!matches(r.eligibility, a, ms)) return { accepted: false, feeCents: null, override: -1 };
  const override = r.fee.overrides.findIndex(o => matches(o.when, a, ms));
  return { accepted: true, feeCents: override < 0 ? r.fee.defaultCents : r.fee.overrides[override].cents, override };
}
export function evaluateStudioPolicy(rulesValue: StudioRules, attendeeValue: StudioAttendee): StudioDecision {
  const rules = parseStudioRules(rulesValue), attendee = parseStudioAttendee(attendeeValue), ms = Date.parse(attendee.submittedAt);
  const result = outcome(rules, attendee, ms), trace: StudioTrace[] = [];
  function record(c: StudioCondition, path: string) {
    trace.push({ path, passed: matches(c, attendee, ms), en: conditionText(c, "en"), es: conditionText(c, "es") });
    if (c.op === "all" || c.op === "any") c.args.forEach((arg, i) => record(arg, `${path}.${i}`));
    else if (c.op === "not") record(c.arg, `${path}.not`);
  }
  record(rules.eligibility, "eligibility");
  if (result.accepted) rules.fee.overrides.slice(0, result.override < 0 ? undefined : result.override + 1).forEach((o, i) => record(o.when, `fee.${i}`));
  const feeReason = !result.accepted ? { en: "No fee: admission denied.", es: "Sin tarifa: admisión denegada." }
    : result.override < 0 ? { en: "Standard fee; no earlier override matched.", es: "Tarifa estándar; no coincidió ninguna excepción anterior." }
    : { en: `First matching fee rule: ${rules.fee.overrides[result.override].label}`, es: `Primera regla de tarifa aplicable: ${rules.fee.overrides[result.override].label}` };
  const reasons = result.accepted ? [{ en: "Meets the complete admission rule.", es: "Cumple la regla completa de admisión." }, feeReason]
    : [{ en: `Admission requires ${conditionText(rules.eligibility, "en")}.`, es: `La admisión requiere ${conditionText(rules.eligibility, "es")}.` }];
  return { accepted: result.accepted, feeCents: result.feeCents, feeReason, trace, reasons };
}
export function summarizeStudioPolicy(value: StudioRules, language: StudioLanguage = "en"): string {
  const r = parseStudioRules(value), es = language === "es";
  const fees = r.fee.overrides.map((o, i) => `${i + 1}. ${conditionText(o.when, language)} → $${(o.cents / 100).toFixed(2)}`).join("; ");
  return `${es ? "Admisión" : "Admission"}: ${conditionText(r.eligibility, language)}. ${es ? "Tarifa (primera coincidencia)" : "Fee (first match)"}: ${fees ? fees + "; " : ""}${es ? "por defecto" : "otherwise"} $${(r.fee.defaultCents / 100).toFixed(2)} USD.`;
}
const MIN_TIME = Date.parse("0000-01-01T00:00:00.000Z"), MAX_TIME = Date.parse("9999-12-31T23:59:59.999Z");
export function discoverStudioConsequences(leftValue: StudioRules | null, rightValue: StudioRules | null, maxCases = 500000): StudioDiscovery {
  const coverage = { ageValues: 121, agePartitions: 0, flagCombinations: 32, timePartitions: 0, scope: "Complete over integer ages 0–120, five independent boolean flags, and explicit UTC millisecond instants in years 0000–9999, for these parsed rules only. This does not prove faithful interpretation of the original language." };
  const unresolved = (issue: string): StudioDiscovery => ({ status: "unresolved", witnesses: [], checkedCases: 0, issues: [issue], coverage });
  if (leftValue === null || rightValue === null) return unresolved("At least one draft needs clarification; no complete comparison is possible.");
  let left: StudioRules, right: StudioRules;
  try { left = parseStudioRules(leftValue); right = parseStudioRules(rightValue); } catch (error) { return unresolved(error instanceof Error ? error.message : "Invalid rules."); }
  const boundaries = new Set<number>(), ageBoundaries = new Set<number>();
  function collect(c: StudioCondition) { if (c.op === "age") ageBoundaries.add(c.value); else if (c.op === "time") boundaries.add(Date.parse(c.value)); else if (c.op === "all" || c.op === "any") c.args.forEach(collect); else if (c.op === "not") collect(c.arg); }
  for (const r of [left, right]) { collect(r.eligibility); r.fee.overrides.forEach(o => collect(o.when)); }
  const times = new Set<number>();
  // Each predicate changes only at its boundary. A boundary and adjacent ms
  // represent every open interval as well as every isolated exact instant.
  for (const b of [...boundaries].sort((a, b) => a - b)) for (const t of [b, b - 1, b + 1]) if (t >= MIN_TIME && t <= MAX_TIME) times.add(t);
  if (!times.size) times.add(Date.parse("2026-10-26T12:00:00.000Z"));
  times.add(MIN_TIME); times.add(MAX_TIME); coverage.timePartitions = times.size;
  const ages = new Set([24, 17, 18, 0, 120]);
  for (const boundary of ageBoundaries) for (const age of [boundary, boundary - 1, boundary + 1]) if (age >= 0 && age <= 120) ages.add(age);
  coverage.agePartitions = ages.size;
  const count = ages.size * 32 * times.size;
  if (!Number.isInteger(maxCases) || maxCases < 1 || count > Math.min(maxCases, 500000)) return unresolved(`Comparison requires ${count} cases, beyond the bounded search limit. Simplify the policy; equivalence is unknown.`);
  // Compile once: avoid reparsing ISO timestamps inside the bounded search.
  type Predicate = (a: StudioAttendee, time: number) => boolean;
  function compile(c: StudioCondition): Predicate {
    if (c.op === "always") return () => true;
    if (c.op === "age") return c.cmp === "gte" ? a => a.age >= c.value : a => a.age <= c.value;
    if (c.op === "flag") return a => a[c.field] === c.value;
    if (c.op === "not") { const child = compile(c.arg); return (a, t) => !child(a, t); }
    if (c.op === "all" || c.op === "any") { const children = c.args.map(compile); return c.op === "all" ? (a, t) => children.every(f => f(a, t)) : (a, t) => children.some(f => f(a, t)); }
    if (c.op === "time") {
      const boundary = Date.parse(c.value);
      return c.cmp === "lt" ? (_a, t) => t < boundary : c.cmp === "lte" ? (_a, t) => t <= boundary : c.cmp === "gte" ? (_a, t) => t >= boundary : (_a, t) => t > boundary;
    }
    return fail("Unsupported condition.");
  }
  function compiledPolicy(r: StudioRules) {
    const eligible = compile(r.eligibility), overrides = r.fee.overrides.map(o => ({ predicate: compile(o.when), cents: o.cents }));
    return (a: StudioAttendee, t: number) => !eligible(a, t) ? null : (overrides.find(o => o.predicate(a, t))?.cents ?? r.fee.defaultCents);
  }
  const leftFee = compiledPolicy(left), rightFee = compiledPolicy(right);
  const selected = new Map<StudioWitness["id"], { attendee: StudioAttendee; delta: number | null }>();
  let checkedCases = 0;
  for (const age of ages) for (let bits = 0; bits < 32; bits++) {
    const attendee: StudioAttendee = { age, resident: !!(bits & 1), student: !!(bits & 2), member: !!(bits & 4), guardianConsent: !!(bits & 8), scholarship: !!(bits & 16), submittedAt: "" };
    for (const ms of times) {
      const a = leftFee(attendee, ms), b = rightFee(attendee, ms); checkedCases++;
      const id = a !== null && b === null ? "admission-left" : a === null && b !== null ? "admission-right" : a !== null && b !== null && a !== b ? (a > b ? "price-left-higher" : "price-right-higher") : null;
      if (!id) continue;
      const delta = a !== null && b !== null ? Math.abs(a - b) : null, previous = selected.get(id);
      if (!previous || (delta !== null && delta > previous.delta!)) selected.set(id, { attendee: { ...attendee, submittedAt: new Date(ms).toISOString() }, delta });
    }
  }
  const witnesses = [...selected].map(([id, { attendee, delta }]): StudioWitness => {
    const kind = id.startsWith("price-") ? "price-only" : id as "admission-left" | "admission-right";
    const a = evaluateStudioPolicy(left, attendee), b = evaluateStudioPolicy(right, attendee);
    const explanation = kind === "price-only" ? { en: `Both admit this person, but A charges $${(a.feeCents! / 100).toFixed(2)} and B charges $${(b.feeCents! / 100).toFixed(2)}.`, es: `Ambas admiten a esta persona, pero A cobra $${(a.feeCents! / 100).toFixed(2)} y B cobra $${(b.feeCents! / 100).toFixed(2)}.` }
      : kind === "admission-left" ? { en: "A admits this person; B refuses them.", es: "A admite a esta persona; B la rechaza." } : { en: "B admits this person; A refuses them.", es: "B admite a esta persona; A la rechaza." };
    return { id, kind, attendee, left: a, right: b, feeDeltaCents: delta, explanation };
  });
  return { status: witnesses.length ? "different" : "equivalent", witnesses, checkedCases, issues: [], coverage };
}
