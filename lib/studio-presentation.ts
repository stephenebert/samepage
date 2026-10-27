import { discoverStudioConsequences, parseStudioRules } from "./studio-engine.ts";
import type { StudioCondition, StudioFlag, StudioLanguage, StudioRules, StudioText } from "./studio-types";

/** Presentation only: never changes saved policy text, approval state or receipts. */
export function simplifyStudioFees(rules: StudioRules): { rules: StudioRules; removedCount: number; verified: boolean } {
  const unchanged = { rules, removedCount: 0, verified: false };
  try {
    // Validate before using the AST, and require complete comparison coverage even
    // if it appears obvious that a fee clause is redundant.
    parseStudioRules(rules);
    if (discoverStudioConsequences(rules, rules).status !== "equivalent") return unchanged;
    let simplified = rules;
    for (let index = rules.fee.overrides.length - 1; index >= 0; index--) {
      const candidate: StudioRules = {
        ...simplified,
        fee: { ...simplified.fee, overrides: simplified.fee.overrides.filter((_, i) => i !== index) },
      };
      const comparison = discoverStudioConsequences(simplified, candidate);
      if (comparison.status === "unresolved") return unchanged;
      if (comparison.status === "equivalent") simplified = candidate;
    }
    if (discoverStudioConsequences(rules, simplified).status !== "equivalent") return unchanged;
    return { rules: simplified, removedCount: rules.fee.overrides.length - simplified.fee.overrides.length, verified: true };
  } catch {
    return unchanged;
  }
}

const flagText: Record<StudioLanguage, Record<StudioFlag, [string, string]>> = {
  en: {
    resident: ["the person is not a resident", "the person is a resident"],
    student: ["the person is not a student", "the person is a student"],
    member: ["the person is not a member", "the person is a member"],
    guardianConsent: ["guardian consent is absent", "guardian consent is present"],
    scholarship: ["the person does not have a scholarship", "the person has a scholarship"],
  },
  es: {
    resident: ["la persona no es residente", "la persona es residente"],
    student: ["la persona no es estudiante", "la persona es estudiante"],
    member: ["la persona no es miembro", "la persona es miembro"],
    guardianConsent: ["no hay consentimiento del tutor", "hay consentimiento del tutor"],
    scholarship: ["la persona no tiene beca", "la persona tiene beca"],
  },
};

function conditionText(condition: StudioCondition, language: StudioLanguage): string {
  const es = language === "es";
  switch (condition.op) {
    case "always": return es ? "la condición se cumple para cualquier persona" : "the condition holds for everyone";
    case "age": return es
      ? `la edad es de ${condition.value} años ${condition.cmp === "gte" ? "o más" : "o menos"}`
      : `the person is ${condition.cmp === "gte" ? "at least" : "at most"} ${condition.value} years old`;
    case "flag": return flagText[language][condition.field][condition.value ? 1 : 0];
    case "time": {
      const time = condition.value.replace("T", " ").replace("Z", " UTC");
      const comparison = es
        ? { lt: "es estrictamente anterior a", lte: "es igual o anterior a", gte: "es igual o posterior a", gt: "es estrictamente posterior a" }
        : { lt: "is strictly before", lte: "is at or before", gte: "is at or after", gt: "is strictly after" };
      return `${es ? "la fecha y hora de envío" : "the submission time"} ${comparison[condition.cmp]} ${time}`;
    }
    case "not": return `${es ? "no se cumple que" : "it is not the case that"} (${conditionText(condition.arg, language)})`;
    default: {
      // Keep explicit grouping: prose must not silently change AND/OR precedence.
      const join = condition.op === "all" ? (es ? " y " : " and ") : (es ? " o " : " or ");
      return condition.args.map(arg => `(${conditionText(arg, language)})`).join(join);
    }
  }
}

export function readableStudioPolicy(rules: StudioRules, language: StudioLanguage): { admission: string; fees: string[]; removedCount: number; verified: boolean } {
  const es = language === "es", simplified = simplifyStudioFees(rules);
  try {
    parseStudioRules(simplified.rules);
  } catch {
    return {
      admission: es ? "No se pueden mostrar estas reglas. Revisa el texto original guardado." : "These rules cannot be displayed. Review the original saved text.",
      fees: [], removedCount: 0, verified: false,
    };
  }
  const r = simplified.rules;
  const admission = r.eligibility.op === "always"
    ? (es ? "Todas las personas cumplen los requisitos de admisión." : "Everyone meets the admission requirements.")
    : `${es ? "La admisión se permite si y solo si" : "Admission is allowed if and only if"} ${conditionText(r.eligibility, language)}.`;
  const money = (cents: number) => es ? `${(cents / 100).toFixed(2).replace(".", ",")} USD` : `$${(cents / 100).toFixed(2)} USD`;
  const fees = r.fee.overrides.length ? [
    es ? "Solo se cobra a las personas admitidas. Se aplica la primera regla que se cumpla, en este orden:" : "Fees apply only to admitted attendees. Use the first matching rule, in this order:",
    ...r.fee.overrides.map((override, index) => `${index + 1}. ${es ? "Si" : "If"} ${conditionText(override.when, language)}: ${money(override.cents)}.`),
    `${es ? "Si no se cumple ninguna de las reglas anteriores" : "If none of the rules above matches"}: ${money(r.fee.defaultCents)}.`,
  ] : [`${es ? "Solo las personas admitidas pagan" : "Admitted attendees pay"} ${money(r.fee.defaultCents)}.`];
  return { admission, fees, removedCount: simplified.removedCount, verified: simplified.verified };
}

/**
 * The exact bounded wording displayed for new approvals and stored on publication.
 * This guarantees grouping relative to the interpreted AST, not faithful source
 * interpretation. Original prose is retained separately and must still be reviewed.
 */
export function canonicalStudioPolicy(rules: StudioRules): StudioText {
  parseStudioRules(rules);
  const render = (language: StudioLanguage) => {
    const view = readableStudioPolicy(rules, language);
    return [view.admission, ...view.fees].join("\n");
  };
  return { en: render("en"), es: render("es") };
}

export const STUDIO_GROUPING_GUIDANCE = "For generated translations or rewritten text, make every AND/OR scope explicit in BOTH languages. Use parentheses or numbered nested alternatives, or repeat each shared qualifier in every alternative. For example, age>=18 AND (resident OR student) means 'at least 18 AND (resident OR student)' / 'al menos 18 años Y (residente O estudiante)'; never flatten it to 'al menos 18 años y residente, o estudiante'. The age, consent, deadline and negation restrictions must visibly govern every intended alternative. Do not resolve ambiguity in a supplied source by guessing; return rules:null and a clarification issue instead.";
