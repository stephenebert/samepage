import { evaluateStudioPolicy, parseStudioAttendee, STUDIO_FLAGS } from "./studio-engine.ts";
import { realisticStudioWitness } from "./studio-witness.ts";
import type { StudioAttendee, StudioDecision, StudioRegistration, StudioRepair, StudioRoom, StudioRules, StudioWitness, StudioFlag } from "./studio-types";

export type StudioReceiptChange = { before: StudioRegistration; after: StudioRegistration };
const factKeys: (keyof StudioAttendee)[] = ["age", "resident", "student", "member", "guardianConsent", "scholarship", "submittedAt"];
const sameOutcome = (a: StudioDecision, b: StudioDecision) => a.accepted === b.accepted && a.feeCents === b.feeCents;

export function findStudioReceiptChange(receipts: StudioRegistration[], matches: (pair: StudioReceiptChange) => boolean = () => true): StudioReceiptChange | null {
  for (let i = receipts.length - 1; i > 0; i--) {
    const after = receipts[i];
    for (let j = i - 1; j >= 0; j--) {
      const before = receipts[j], pair = { before, after };
      if (before.policyVersion < after.policyVersion && factKeys.every(key => before[key] === after[key]) && !sameOutcome(before.decision, after.decision) && matches(pair)) return pair;
    }
  }
  return null;
}

/** One recomputed attendee for the intended effect, form and receipt comparison.
 * Unlike a blocked-change witness, the intended effect may be an increase OR a
 * decrease. It must still be an admitted person in the requested group, with
 * exactly the checked fee. Saved evidence is never rewritten to make it fit.
 */
export function studioRepairPresentation(repair: StudioRepair | null | undefined, receipts: StudioRegistration[]): { witness: StudioWitness | null; receiptChange: StudioReceiptChange | null } {
  const empty = { witness: null, receiptChange: null };
  if (!repair || repair.job.intent.mode === "preserve-outcomes" || !["ready", "published"].includes(repair.status) || repair.impact?.status !== "pass" || !repair.job.baseline.rules || !repair.proposal?.rules) return empty;
  const baseline = repair.job.baseline.rules, proposed = repair.proposal.rules;
  const at = (value: StudioAttendee): StudioWitness | null => {
    try {
      const attendee = parseStudioAttendee(Object.fromEntries(factKeys.map(key => [key, value[key]])));
      if (!attendee[repair.job.intent.scopeFlag]) return null;
      const left = evaluateStudioPolicy(baseline, attendee), right = evaluateStudioPolicy(proposed, attendee);
      if (!left.accepted || !right.accepted || right.feeCents !== repair.job.intent.feeCents || left.feeCents === right.feeCents) return null;
      return {
        id: left.feeCents! > right.feeCents! ? "price-left-higher" : "price-right-higher",
        kind: "price-only",
        attendee, left, right, feeDeltaCents: Math.abs(left.feeCents! - right.feeCents!),
        explanation: {
          en: `Both admit this person. The selected baseline charges $${(left.feeCents! / 100).toFixed(2)}; the checked repair charges $${(right.feeCents! / 100).toFixed(2)}.`,
          es: `Ambas admiten a esta persona. La interpretación de referencia cobra $${(left.feeCents! / 100).toFixed(2)}; la corrección comprobada cobra $${(right.feeCents! / 100).toFixed(2)}.`,
        },
      };
    } catch { return null; }
  };
  const receiptChange = repair.status === "published" ? findStudioReceiptChange(receipts, ({ before, after }) => {
    if (before.policyVersion !== repair.job.basePolicyVersion || after.policyVersion !== repair.publishedVersion) return false;
    const witness = at(before);
    // A selected alternative baseline need not equal the previously published
    // policy. Only claim matching receipt evidence when both outcomes agree.
    return Boolean(witness && sameOutcome(before.decision, witness.left) && sameOutcome(after.decision, witness.right));
  }) : null;
  if (receiptChange) return { witness: at(receiptChange.before), receiptChange };
  for (const receipt of [...receipts].reverse()) {
    if (receipt.policyVersion !== repair.job.basePolicyVersion) continue;
    const witness = at(receipt);
    if (witness && sameOutcome(receipt.decision, witness.left)) return { witness, receiptChange: null };
  }
  const original = repair.impact.changes.witnesses.find(item => item.left.accepted && item.right.accepted && item.attendee[repair.job.intent.scopeFlag]);
  if (!original) return empty;
  const realistic = realisticStudioWitness(baseline, proposed, original, undefined, repair.job.intent.scopeFlag);
  return { witness: at(realistic.attendee), receiptChange: null };
}


/** An equivalent rewrite has no change witness. Recompute one concrete attendee
 * to show the preserved decision without inventing a before/after change. */
export function studioPreservedAdmission(repair: StudioRepair | null | undefined, attendeeValue: StudioAttendee | undefined): { attendee: StudioAttendee; before: StudioDecision; after: StudioDecision } | null {
  if (!repair || repair.job.intent.mode !== "preserve-outcomes" || !["ready", "published"].includes(repair.status) || repair.impact?.status !== "pass" || !repair.job.baseline.rules || !repair.proposal?.rules || !attendeeValue) return null;
  try {
    const attendee = parseStudioAttendee(Object.fromEntries(factKeys.map(key => [key, attendeeValue[key]])));
    const before = evaluateStudioPolicy(repair.job.baseline.rules, attendee), after = evaluateStudioPolicy(repair.proposal.rules, attendee);
    return sameOutcome(before, after) ? { attendee, before, after } : null;
  } catch { return null; }
}

/** Carry a discovered counterexample through repair and registration. No fixed
 * attendee is injected: the saved check supplies the witness, and the current
 * baseline must still match the evidence before it can be reused. */
export function studioDiscoveredRepairAttendee(room: StudioRoom): StudioAttendee | undefined {
  const current = room.repair;
  if (!current || current.status === "superseded" || current.job.intent.mode !== "preserve-outcomes" || !current.job.baseline.rules) return undefined;
  const blocked = current.status === "blocked" ? current : [...(room.repairHistory ?? [])].reverse().find(item => item.status === "blocked"
    && item.job.reviewId === current.job.reviewId && item.job.basePolicyVersion === current.job.basePolicyVersion
    && item.job.intent.baselineCandidateId === current.job.intent.baselineCandidateId);
  if (!blocked?.impact || !blocked.proposal?.rules || !blocked.job.baseline.rules) return undefined;
  const found = blocked.impact.verification.witnesses[0];
  if (!found || JSON.stringify(blocked.job.baseline.rules) !== JSON.stringify(current.job.baseline.rules)) return undefined;
  const witness = realisticStudioWitness(blocked.impact.expectedRules, blocked.proposal.rules, found);
  const baseline = evaluateStudioPolicy(current.job.baseline.rules, witness.attendee);
  const proposed = evaluateStudioPolicy(blocked.proposal.rules, witness.attendee);
  return sameOutcome(baseline, witness.left) && sameOutcome(proposed, witness.right) && !sameOutcome(baseline, proposed) ? witness.attendee : undefined;
}

/** Search single-flag changes at the discovered attendee. Only explain a flip
 * introduced by the rewrite: the baseline outcome must stay unchanged. Prefer
 * losing access when a qualification is added, then any other new admission flip. */
export function studioIntroducedFlagEffect(baseline: StudioRules | null | undefined, proposed: StudioRules | null | undefined, attendee: StudioAttendee): { flag: StudioFlag; withoutFlag: StudioDecision; withFlag: StudioDecision; baselineDecision: StudioDecision; losesAccessOnAddition: boolean } | null {
  if (!baseline || !proposed) return null;
  const effects = STUDIO_FLAGS.flatMap(flag => {
    const without = { ...attendee, [flag]: false }, withFlag = { ...attendee, [flag]: true };
    const baselineWithout = evaluateStudioPolicy(baseline, without), baselineWith = evaluateStudioPolicy(baseline, withFlag);
    const proposedWithout = evaluateStudioPolicy(proposed, without), proposedWith = evaluateStudioPolicy(proposed, withFlag);
    if (!sameOutcome(baselineWithout, baselineWith) || proposedWithout.accepted === proposedWith.accepted) return [];
    return [{ flag, withoutFlag: proposedWithout, withFlag: proposedWith, baselineDecision: baselineWithout, losesAccessOnAddition: proposedWithout.accepted && !proposedWith.accepted }];
  });
  return effects.find(effect => effect.losesAccessOnAddition) ?? effects[0] ?? null;
}
