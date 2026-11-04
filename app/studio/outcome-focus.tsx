"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { summarizeAdmissionFailure } from "../../lib/studio-admission-summary";
import { comparisonWording, readableStudioTime, repairFocusContext, studioAttendeeTitle, studioEligibilityOnly, studioAccessRoutes } from "../../lib/studio-outcome-focus";
import type { WordingFocus } from "../../lib/studio-outcome-focus";
import type { StudioAttendee, StudioDecision, StudioRepair, StudioRoom, StudioText, StudioWitness } from "../../lib/studio-types";
import "./outcome-focus.css";

const money = (cents: number | null) => cents === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
function Highlight({ text, phrase }: { text: string; phrase: string }) {
  const index = text.indexOf(phrase);
  return index < 0 ? <>{text}</> : <>{text.slice(0, index)}<mark>{phrase}</mark>{text.slice(index + phrase.length)}</>;
}
export function WordingComparison({ focus }: { focus: WordingFocus }) {
  return <section className="sp-focus-wording" aria-label={focus.title}><h4>{focus.title}</h4><div>{[focus.before, focus.after].map((part, index) => <article key={index} lang={part.language}><strong>{part.label}</strong><p>{part.summaryText ?? <Highlight text={part.text} phrase={part.highlight} />}</p></article>)}</div></section>;
}
export function RepairFocusContext({ repair, historical = false }: { repair: StudioRepair; historical?: boolean }) {
  const context = repairFocusContext(repair, historical);
  return <div className={`sp-focus-context${repair.status === "blocked" ? " is-blocked" : ""}`}><strong>{context.status}</strong><p>{historical ? "Earlier request: " : ""}{context.intent}</p></div>;
}
export function FocusAttendee({ attendee, eligibilityOnly = false, accessRoutes = false }: { attendee: StudioAttendee; eligibilityOnly?: boolean; accessRoutes?: boolean }) {
  return <div className="sp-focus-person"><span className="sp-focus-label">Example attendee</span><h3>{eligibilityOnly ? `${attendee.age}-year-old applicant` : studioAttendeeTitle(attendee)}</h3><p>{accessRoutes ? `${attendee.resident ? "Resident" : "Nonresident"}, ${attendee.student ? "student" : "not a student"}, ${attendee.member ? "member" : "not a member"}` : eligibilityOnly ? attendee.guardianConsent ? "Guardian consent provided" : "No guardian consent" : <>{attendee.resident ? "Resident" : "Nonresident"}{!attendee.member ? ", not a member" : ""}, {attendee.guardianConsent ? "guardian consent" : "no guardian consent"}, {attendee.scholarship ? "scholarship" : "no scholarship"}</>}</p><details><summary>Application time <ChevronDown size={14} /></summary><time dateTime={attendee.submittedAt}>{readableStudioTime(attendee.submittedAt)}</time></details></div>;
}
type Side = { label: string; decision: StudioDecision; description?: string };
export function FocusOutcomes({ left, right, warning = false, eligibilityOnly = false }: { left: Side; right: Side; warning?: boolean; eligibilityOnly?: boolean }) {
  return <div className={`sp-focus-results${warning ? " has-warning" : ""}`}>
    {[left, right].map((side, index) => <div key={index} className={index ? "sp-focus-after" : "sp-focus-before"}><span>{side.label}</span><strong>{eligibilityOnly ? side.decision.accepted ? "Eligible" : "Not eligible" : side.decision.accepted ? money(side.decision.feeCents) : "No admission"}</strong><p>{side.description ?? (eligibilityOnly ? side.decision.accepted ? "Meets the admission rules" : "Does not meet the admission rules" : side.decision.accepted ? "Eligible, registration fee" : "Not eligible")}</p></div>)}
  </div>;
}
export function SourceDetails({ before, after, beforeLabel = "English source", afterLabel = "Spanish source", focus }: { before: StudioText; after: StudioText; beforeLabel?: string; afterLabel?: string; focus?: WordingFocus | null }) {
  return <details className="sp-focus-source"><summary>Full wording <ChevronDown size={14} /></summary>{focus?.before.context && focus.after.context && <div><article><strong>Original fee paragraph</strong><p>{focus.before.context}</p></article><article><strong>Proposed fee paragraph</strong><p>{focus.after.context}</p></article></div>}<div><article><strong>{beforeLabel}</strong>{before.en && <p lang="en">{before.en}</p>}{before.es && <p lang="es">{before.es}</p>}</article><article><strong>{afterLabel}</strong>{after.en && <p lang="en">{after.en}</p>}{after.es && <p lang="es">{after.es}</p>}</article></div></details>;
}
export default function OutcomeFocus({ room, witness, onUseAttendee }: { room: StudioRoom; witness: StudioWitness; onUseAttendee?: (attendee: StudioAttendee) => void }) {
  const candidates = room.review?.candidates;
  if (!candidates?.length) return null;
  const source = comparisonWording(room);
  const eligibilityOnly = studioEligibilityOnly(room);
  const description = (index: number, decision: StudioDecision) => decision.accepted ? eligibilityOnly ? "Meets the admission rules" : "Eligible, registration fee" : summarizeAdmissionFailure(candidates[index]?.rules ?? null, witness.attendee, decision);
  return <section className="sp-outcome-focus" aria-label="Affected attendee and policy outcomes">
    <FocusAttendee attendee={witness.attendee} eligibilityOnly={eligibilityOnly} accessRoutes={studioAccessRoutes(room)} />
    <FocusOutcomes eligibilityOnly={eligibilityOnly} left={{ label: "English interpretation", decision: witness.left, description: description(0, witness.left) }} right={{ label: "Spanish interpretation", decision: witness.right, description: description(1, witness.right) }} />
    {source && <WordingComparison focus={source} />}
    <SourceDetails before={{ en: room.drafts.alice.text, es: "" }} after={{ en: "", es: room.drafts.bob.text }} />
    {onUseAttendee && <button type="button" className="sps-textbutton" onClick={() => onUseAttendee(witness.attendee)}>Use this attendee in the form <ArrowRight size={14} /></button>}
  </section>;
}
