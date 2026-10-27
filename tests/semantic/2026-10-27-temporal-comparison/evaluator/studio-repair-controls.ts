import type { StudioRepair } from "./studio-types";

/** Reconcile a remote check and review change in one decision, preserving local edits. */
export function reconcileRepairBaseline(
  baselineId: string,
  editedSinceCheck: boolean,
  repair: StudioRepair | undefined,
  reviewId: string | undefined,
  availableBaselineIds: readonly string[],
): { baselineId: string; restoreSavedRequest: boolean } {
  const savedBaselineId = repair?.job.intent.baselineCandidateId;
  const restoreSavedRequest = Boolean(
    !editedSinceCheck && repair && repair.status !== "superseded"
    && repair.job.reviewId === reviewId && savedBaselineId
    && availableBaselineIds.includes(savedBaselineId),
  );
  return {
    baselineId: restoreSavedRequest ? savedBaselineId! : availableBaselineIds.includes(baselineId) ? baselineId : "",
    restoreSavedRequest,
  };
}
