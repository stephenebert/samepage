import type { StudioAttendee, StudioDecision, StudioRepair, StudioRoom, StudioText } from "./studio-types.ts";

export function studioEligibilityOnly(room: StudioRoom | null | undefined): boolean {
  return room?.liveDemo?.exampleId === "consent" || room?.liveDemo?.exampleId === "interaction";
}
export function studioAccessRoutes(room: StudioRoom | null | undefined): boolean { return room?.liveDemo?.exampleId === "interaction"; }
export function studioOutcomeLabel(decision: StudioDecision, eligibilityOnly = false): string {
  if (!decision.accepted) return "Not eligible";
  if (eligibilityOnly) return "Eligible";
  const cents = decision.feeCents;
  return `${cents === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)} registration`;
}

export type WordingExcerpt = { text: string; highlight: string; label: string; language: "en" | "es"; context?: string; summaryText?: string };
export type WordingFocus = { title: string; before: WordingExcerpt; after: WordingExcerpt };

/** Display the exact UTC instant without making subsecond boundaries disappear. */
export function readableStudioTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(date);
  const fraction = date.getUTCMilliseconds() ? `.${String(date.getUTCMilliseconds()).padStart(3, "0")}` : "";
  return `${day}, ${clock}${fraction} UTC`;
}
export function studioAttendeeTitle(attendee: StudioAttendee) {
  return `${attendee.age}-year-old ${attendee.student ? "student" : "nonstudent"}${attendee.member ? " member" : ""}`;
}
function sentence(text: string, phrase: string): string | null {
  if (!text.includes(phrase)) return null;
  // Whitespace is required after punctuation: ISO milliseconds are not sentences.
  return text.split(/(?<=[.!?])\s+/).find(item => item.includes(phrase)) ?? null;
}
function excerpt(text: string, phrase: string, label: string, language: "en" | "es"): WordingExcerpt | null {
  const selected = sentence(text, phrase);
  return selected ? { text: selected, highlight: phrase, label, language } : null;
}

/** A fee excerpt must keep its complete condition and verified currency units. */
function compactFeeExcerpt(part: WordingExcerpt): WordingExcerpt | null {
  if (!/\bUSD cents\b/.test(part.text)) return null;
  const clause = part.text.split(";").map(value => value.trim()).find(value => value === part.highlight);
  const memberFee = clause?.match(/^member (\d+)$/);
  if (!clause || !memberFee) return null;
  const cents = Number(memberFee[1]);
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  return { ...part, text: clause, context: part.text, summaryText: `Member fee: ${amount}` };
}

export function repairFocusContext(repair: StudioRepair, historical = false) {
  const groups = { student: "students", member: "members", resident: "residents", scholarship: "scholarship recipients", guardianConsent: "people with guardian consent" };
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: repair.job.intent.feeCents % 100 ? 2 : 0 }).format(repair.job.intent.feeCents / 100);
  const status = historical ? "Earlier rewrite blocked" : repair.status === "blocked" ? "Publication blocked" : repair.status === "published" ? `Published as v${repair.publishedVersion}` : repair.status === "ready" ? Object.keys(repair.votes).length === 1 ? "One approval received" : "Awaiting both approvals" : repair.status === "superseded" ? "Check outdated" : "Check incomplete";
  return { status, intent: repair.job.intent.mode === "preserve-outcomes" ? "Clarify the policy. Preserve all admission rules." : `Eligible ${groups[repair.job.intent.scopeFlag]} pay ${amount}. Admission and all other fees must stay unchanged.` };
}

/** These excerpts locate literal wording; they never supply an outcome or a rule. */
export function comparisonWording(room: StudioRoom): WordingFocus | null {
  const en = room.drafts.alice.text, es = room.drafts.bob.text;
  // Do not show stale source evidence after either saved draft was edited.
  if (!room.review || room.review.candidates.some(candidate => candidate.sourceVersion !== room.drafts[candidate.editor].version)) return null;
  const pairs = [
    ["Community route: the applicant must be a local resident", "Vía comunitaria: la persona solicitante debe ser residente local y estudiante", "a local resident", "residente local y estudiante"],
    ["applicants aged 16 or 17 must have guardian consent", "16, 17 o 18", "16 or 17", "16, 17 o 18"],
    ["Nonresidents must additionally submit at or before", "Quienes no sean residentes deben, además, presentar la solicitud estrictamente antes", "at or before", "estrictamente antes"],
    ["(a) the applicant is a member and is not a student", "(a) ser miembro y ser estudiante", "is not a student", "ser miembro y ser estudiante"],
  ];
  for (const [leftPhrase, rightPhrase, leftHighlight, rightHighlight] of pairs) {
    const left = excerpt(en, leftPhrase, "English draft", "en"), right = excerpt(es, rightPhrase, "Spanish draft", "es");
    if (left && right) return { title: "Wording to review", before: { ...left, highlight: leftHighlight }, after: { ...right, highlight: rightHighlight } };
  }
  return null;
}

/** Select a literal changed clause only when both texts contain its exact context.
 * Generic rewrites keep full text available instead of inventing a causal excerpt. */
export function repairWording(repair: StudioRepair, admissionChanged: boolean): WordingFocus | null {
  const original = repair.job.drafts[repair.job.baseline.editor];
  // These phrase matchers are English-only. A translated interpretation is not
  // evidence of the wording in the selected Spanish source.
  if (original.language !== "en") return null;
  const beforeText = original.text;
  const afterText = repair.job.proposalText?.en ?? repair.proposal?.en ?? "";
  const pairs = admissionChanged ? [
    ["Community route: the applicant must be a local resident", "Club members use the campus route and must be students", "a local resident", "must be students"],
    ["applicants aged 16 or 17 must have guardian consent", "everyone aged 16 or older is admitted without guardian consent", "must have guardian consent", "without guardian consent"],
    ["must either have a scholarship, or must both be a member and have guardian consent", "must either have a scholarship or be a member", "be a member and have guardian consent", "be a member"],
  ] : [
    ["member 2700", "member 3100", "member 2700", "member 3100"],
  ];
  for (const [leftPhrase, rightPhrase, leftHighlight, rightHighlight] of pairs) {
    const before = excerpt(beforeText, leftPhrase, "Original English draft", "en");
    const after = excerpt(afterText, rightPhrase, "Proposed wording", "en");
    if (before && after) {
      const left = { ...before, highlight: leftHighlight }, right = { ...after, highlight: rightHighlight };
      if (!admissionChanged) {
        const compactBefore = compactFeeExcerpt(left), compactAfter = compactFeeExcerpt(right);
        if (compactBefore && compactAfter) return { title: "Fee change summary", before: { ...compactBefore, label: "Baseline policy" }, after: { ...compactAfter, label: "Proposed rewrite" } };
        return null;
      }
      return { title: "Changed wording", before: left, after: right };
    }
  }
  return null;
}

export function repairSourceTexts(repair: StudioRepair): { before: StudioText; beforeLabel: string; after: StudioText } {
  const original = repair.job.drafts[repair.job.baseline.editor];
  return {
    before: { en: original.language === "en" ? original.text : "", es: original.language === "es" ? original.text : "" },
    beforeLabel: original.language === "en" ? "Original English draft" : "Original Spanish draft",
    after: repair.job.proposalText ?? { en: repair.proposal?.en ?? "", es: repair.proposal?.es ?? "" },
  };
}
