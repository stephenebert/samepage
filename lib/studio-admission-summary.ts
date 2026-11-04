import { evaluateStudioPolicy } from "./studio-engine.ts";
import type { StudioAttendee, StudioCondition, StudioDecision, StudioFlag, StudioRules } from "./studio-types.ts";

const FALLBACK = "This attendee does not meet this interpretation’s eligibility requirements.";
type Leaf = Extract<StudioCondition, { op: "age" | "flag" | "time" }>;
type Fact = { condition: Leaf; passed: boolean };
type Comparison = "lt" | "lte" | "gte" | "gt";
const opposite: Record<Comparison, Comparison> = { lt: "gte", lte: "gt", gte: "lt", gt: "lte" };

/** Display only. Saved decisions, exact rule text and publication checks stay unchanged. */
export function summarizeAdmissionFailure(rules: StudioRules | null, attendee: StudioAttendee, decision: StudioDecision): string {
  if (decision.accepted) return "";
  if (!rules) return FALLBACK;
  try {
    // Reuse the authoritative evaluator rather than infer a cause from prose or stale traces.
    const checked = evaluateStudioPolicy(rules, attendee);
    if (checked.accepted) return FALLBACK;
    const passed = new Map(checked.trace.map(item => [item.path, item.passed]));
    function proof(condition: StudioCondition, path: string, value: boolean): Fact[] | null {
      if (passed.get(path) !== value) return null;
      if (condition.op === "always") return [];
      if (condition.op === "not") return proof(condition.arg, `${path}.not`, !value);
      if (condition.op === "age" || condition.op === "flag" || condition.op === "time") return [{ condition, passed: value }];
      const oneChildSuffices = (condition.op === "all" && !value) || (condition.op === "any" && value);
      const children = condition.args.map((child, index) => proof(child, `${path}.${index}`, value));
      if (oneChildSuffices) return children.filter((item): item is Fact[] => item !== null).sort((a, b) => a.length - b.length)[0] ?? null;
      if (children.some(item => item === null)) return null;
      const facts = [...new Map(children.flatMap(item => item ?? []).map(item => [JSON.stringify(item), item])).values()];
      return facts.length <= 2 ? facts : null;
    }
    // A failed ALL needs one failing branch; a failed OR needs every alternative.
    // Larger or mixed explanations use the safe fallback instead of oversimplifying.
    const facts = proof(rules.eligibility, "eligibility", false);
    if (!facts?.length) return FALLBACK;
    if (facts.length === 1) return describe(facts[0], attendee);
    const residency = facts.find(item => item.condition.op === "flag" && item.condition.field === "resident");
    const timing = facts.find(item => item.condition.op === "time");
    if (residency && timing) return describe(timing, attendee, attendee.resident ? "This resident" : "This nonresident");
    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}

function describe({ condition, passed }: Fact, attendee: StudioAttendee, subject = "This attendee"): string {
  if (condition.op === "time") {
    const required = passed ? opposite[condition.cmp] : condition.cmp;
    const actual = Date.parse(attendee.submittedAt), boundary = Date.parse(condition.value);
    const at = actual === boundary;
    if (required === "lt" || required === "lte") {
      return `${subject} applied ${at ? "exactly at" : "after"} the cutoff. For this attendee, this interpretation requires applying ${required === "lt" ? "before" : "at or before"} it.`;
    }
    return `${subject} applied ${at ? "exactly at" : "before"} the start time. For this attendee, this interpretation requires applying ${required === "gt" ? "after" : "at or after"} it.`;
  }
  if (condition.op === "age") {
    const required = passed ? opposite[condition.cmp] : condition.cmp;
    const words: Record<Comparison, string> = { lt: "younger than", lte: "no older than", gte: "at least", gt: "older than" };
    return `This attendee is ${attendee.age}. This interpretation requires attendees to be ${words[required]} ${condition.value} years old.`;
  }
  const required = passed ? !condition.value : condition.value;
  const requirements: Record<StudioFlag, [string, string]> = {
    resident: ["nonresident status", "resident status"],
    student: ["nonstudent status", "student status"],
    member: ["no membership", "membership"],
    guardianConsent: ["no guardian consent", "guardian consent"],
    scholarship: ["no scholarship", "a scholarship"],
  };
  return `This interpretation requires ${requirements[condition.field][required ? 1 : 0]}; this attendee does not meet that condition.`;
}
