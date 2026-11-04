import { evaluateStudioPolicy, parseStudioRules } from "./studio-engine.ts";
import type { StudioAttendee, StudioDecision, StudioFlag, StudioRules, StudioText } from "./studio-types";

export interface StudioRuleProof {
  decision: StudioDecision;
  kind: "admission" | "override" | "default";
  /** One-based position in the actual ordered rules; never inferred from labels. */
  ruleNumber: number | null;
  condition: StudioText;
  detail: StudioText;
  result: StudioText;
}
export interface StudioChangeExplanationInput {
  baselineRules: StudioRules;
  expectedRules: StudioRules;
  proposedRules: StudioRules;
  attendee: StudioAttendee;
  scopeFlag: StudioFlag;
}
export interface StudioChangeExplanation {
  status: "unintended" | "intended" | "unchanged";
  inRequestedGroup: boolean;
  title: StudioText;
  summary: StudioText;
  scope: StudioText;
  baseline: StudioRuleProof;
  expected: StudioRuleProof;
  proposed: StudioRuleProof;
  compare: "expected" | "baseline";
}
const scopeText: Record<StudioFlag, [StudioText, StudioText]> = {
  student: [{ en: "This attendee is not a student.", es: "Esta persona no es estudiante." }, { en: "This attendee is a student.", es: "Esta persona es estudiante." }],
  member: [{ en: "This attendee is not a member.", es: "Esta persona no es miembro." }, { en: "This attendee is a member.", es: "Esta persona es miembro." }],
  resident: [{ en: "This attendee is not a resident.", es: "Esta persona no es residente." }, { en: "This attendee is a resident.", es: "Esta persona es residente." }],
  scholarship: [{ en: "This attendee does not have a scholarship.", es: "Esta persona no tiene beca." }, { en: "This attendee has a scholarship.", es: "Esta persona tiene beca." }],
  guardianConsent: [{ en: "This attendee does not have guardian consent.", es: "Esta persona no tiene el consentimiento de su tutor." }, { en: "This attendee has guardian consent.", es: "Esta persona tiene el consentimiento de su tutor." }],
};
const money = (cents: number, es = false) => es ? `${(cents / 100).toFixed(cents % 100 ? 2 : 0).replace(".", ",")} USD` : `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
function resultText(decision: StudioDecision): StudioText {
  return decision.accepted ? { en: `${money(decision.feeCents!)} fee`, es: `Tarifa de ${money(decision.feeCents!, true)}` } : { en: "Not eligible, no fee", es: "No cumple los requisitos, sin tarifa" };
}
function sameOutcome(a: StudioDecision, b: StudioDecision): boolean { return a.accepted === b.accepted && a.feeCents === b.feeCents; }

/** The evaluator provides the complete admission trace and stops fee evaluation
 * at the first matching override. Use only top-level fee paths: a nested TRUE
 * branch does not mean its containing AND/OR rule matched. */
export function studioRuleProof(rulesValue: StudioRules, attendee: StudioAttendee): StudioRuleProof {
  const rules = parseStudioRules(rulesValue), decision = evaluateStudioPolicy(rules, attendee);
  if (!decision.accepted) {
    const root = decision.trace.find(item => item.path === "eligibility")!;
    return { decision, kind: "admission", ruleNumber: null, condition: { en: root.en, es: root.es }, result: resultText(decision),
      detail: { en: "The complete admission condition is not satisfied. Fee rules do not apply.", es: "No se cumple la condición completa de admisión. No se aplican las reglas de tarifa." } };
  }
  const match = decision.trace.find(item => /^fee\.\d+$/.test(item.path) && item.passed);
  if (!match) return { decision, kind: "default", ruleNumber: null,
    condition: { en: "Standard fee", es: "Tarifa estándar" }, result: resultText(decision),
    detail: rules.fee.overrides.length ? { en: "None of the ordered fee exceptions matches this attendee.", es: "Ninguna de las excepciones de tarifa ordenadas coincide con esta persona." } : { en: "There are no fee exceptions; the standard fee applies.", es: "No hay excepciones de tarifa; se aplica la tarifa estándar." } };
  const ruleNumber = Number(match.path.slice(4)) + 1;
  return { decision, kind: "override", ruleNumber, condition: { en: match.en, es: match.es }, result: resultText(decision),
    detail: ruleNumber === 1
      ? { en: "This is the first fee rule and it matches. Later rules cannot override it.", es: "Esta es la primera regla de tarifa y se cumple. Las reglas posteriores no pueden reemplazarla." }
      : { en: `The ${ruleNumber - 1} earlier fee ${ruleNumber === 2 ? "rule does" : "rules do"} not match. This is the first match; later rules cannot override it.`, es: `${ruleNumber === 2 ? "La regla anterior no se cumple" : `Las ${ruleNumber - 1} reglas anteriores no se cumplen`}. Esta es la primera coincidencia; las reglas posteriores no pueden reemplazarla.` } };
}

/** Explains this concrete attendee's evaluated outcomes, not the original prose
 * or the correctness of the model's interpretation. No provider call or mutation. */
export function explainStudioChange(input: StudioChangeExplanationInput): StudioChangeExplanation {
  const { attendee, scopeFlag } = input;
  const baseline = studioRuleProof(input.baselineRules, attendee), expected = studioRuleProof(input.expectedRules, attendee), proposed = studioRuleProof(input.proposedRules, attendee);
  const inRequestedGroup = attendee[scopeFlag], scope = scopeText[scopeFlag][inRequestedGroup ? 1 : 0];
  const unintended = !sameOutcome(expected.decision, proposed.decision), changed = !sameOutcome(baseline.decision, proposed.decision);
  const status = unintended ? "unintended" : changed ? "intended" : "unchanged";
  let title: StudioText, summary: StudioText;
  if (unintended && expected.decision.accepted !== proposed.decision.accepted) {
    title = { en: "The rewrite changes admission.", es: "La reescritura cambia la admisión." };
    summary = expected.decision.accepted
      ? { en: "The requested change keeps this attendee eligible. The rewrite rejects them before any fee rule can apply.", es: "El cambio solicitado mantiene la admisión de esta persona. La reescritura la rechaza antes de aplicar cualquier regla de tarifa." }
      : { en: "The requested change keeps this attendee ineligible. The rewrite admits them, even though only the fee was meant to change.", es: "El cambio solicitado mantiene a esta persona fuera de los requisitos de admisión. La reescritura la admite, aunque solo debía cambiar la tarifa." };
  } else if (unintended) {
    title = { en: inRequestedGroup ? "The fee does not match the request." : "Someone outside the selected group pays a different fee.", es: inRequestedGroup ? "La tarifa no coincide con lo solicitado." : "Alguien fuera del grupo seleccionado paga una tarifa distinta." };
    summary = {
      en: `The request ${inRequestedGroup ? "sets" : "keeps"} this attendee’s fee at ${money(expected.decision.feeCents!)}. The rewrite’s ${proposed.kind === "default" ? "standard fee" : "first matching fee rule"} charges ${money(proposed.decision.feeCents!)}.`,
      es: `La solicitud ${inRequestedGroup ? "fija" : "mantiene"} la tarifa de esta persona en ${money(expected.decision.feeCents!, true)}. ${proposed.kind === "default" ? "La tarifa estándar de la reescritura es de" : "La primera regla de tarifa que se cumple en la reescritura cobra"} ${money(proposed.decision.feeCents!, true)}.`,
    };
  } else if (changed) {
    title = { en: "This change matches the request.", es: "Este cambio coincide con lo solicitado." };
    summary = baseline.decision.accepted !== proposed.decision.accepted
      ? { en: `The evaluated outcome changes from “${baseline.result.en}” to “${proposed.result.en}”. It matches the supplied expected rules for this attendee.`, es: `El resultado evaluado cambia de «${baseline.result.es}» a «${proposed.result.es}». Coincide con las reglas esperadas proporcionadas para esta persona.` }
      : { en: `For this attendee, the fee changes from ${money(baseline.decision.feeCents!)} to ${money(proposed.decision.feeCents!)}. That matches the requested outcome.`, es: `Para esta persona, la tarifa cambia de ${money(baseline.decision.feeCents!, true)} a ${money(proposed.decision.feeCents!, true)}. Esto coincide con el resultado solicitado.` };
  } else {
    title = { en: "This attendee’s outcome stays the same.", es: "El resultado de esta persona sigue igual." };
    summary = { en: "The baseline, requested outcome, and rewrite agree for these attendee facts.", es: "La política de referencia, el resultado solicitado y la reescritura coinciden para estos datos." };
  }
  return { status, inRequestedGroup, title, summary, scope, baseline, expected, proposed, compare: unintended ? "expected" : "baseline" };
}
