import { evaluateStudioPolicy, parseStudioAttendee } from "./studio-engine.ts";
import { realisticStudioWitness } from "./studio-witness.ts";
import type { StudioAttendee, StudioDecision, StudioRegistration, StudioRepair, StudioWitness } from "./studio-types";

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
  if (!repair || !["ready", "published"].includes(repair.status) || repair.impact?.status !== "pass" || !repair.job.baseline.rules || !repair.proposal?.rules) return empty;
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
