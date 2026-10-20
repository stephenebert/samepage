import { applyConsequencesAction } from "./consequences.ts";
import { interpretPolicyJob, PolicyModelError, type PolicyModelConfig } from "./policy-model.ts";
import type { AutomaticPolicyReview, ConsequencesRoom, PolicyReviewJob } from "./consequences-types";

export const MODEL_LEASE_MS = 90_000;
type Mutate = (id: string, update: (room: ConsequencesRoom) => ConsequencesRoom) => Promise<ConsequencesRoom>;
export interface AutomaticReviewDependencies {
  mutate: Mutate;
  interpret?: (job: PolicyReviewJob, config: PolicyModelConfig) => Promise<unknown>;
  now?: () => string;
  requestId?: () => string;
}
export interface AutomaticReviewResult {
  room: ConsequencesRoom;
  automatic: { status: AutomaticPolicyReview["status"] | "already-reviewed"; requestId: string | null; error?: { code: string; message: string } };
  httpStatus: number;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function finishMetadata(metadata: AutomaticPolicyReview, now: string) {
  return { ...metadata, finishedAt: now, durationMs: Math.max(0, Date.parse(now) - Date.parse(metadata.startedAt)) };
}
function revise(room: ConsequencesRoom, before: ConsequencesRoom, now: string): ConsequencesRoom {
  room.revision = before.revision + 1; room.updatedAt = now; return room;
}
function result(room: ConsequencesRoom, status: AutomaticReviewResult["automatic"]["status"], requestId: string | null, httpStatus = 200, error?: { code: string; message: string }): AutomaticReviewResult {
  return { room, automatic: { status, requestId, ...(error ? { error } : {}) }, httpStatus };
}
/** Claim, invoke once, then CAS-apply only if the exact lease and snapshot survive. */
export async function runAutomaticPolicyReview(id: string, config: PolicyModelConfig, retry: boolean, dependencies: AutomaticReviewDependencies): Promise<AutomaticReviewResult> {
  if (!config.apiKey) throw new PolicyModelError("MODEL_NOT_CONFIGURED", "Automatic review needs a server-side MODEL_API_KEY. Use the manual relay or configure the secret.", 503);
  const now = dependencies.now ?? (() => new Date().toISOString());
  const requestId = (dependencies.requestId ?? (() => crypto.randomUUID()))();
  const claimedAt = now();
  const claimed = await dependencies.mutate(id, before => {
    if (before.review) return before;
    const previous = before.automaticReview;
    if (previous && before.activeJob && previous.jobId === before.activeJob.id) {
      if (previous.status === "running" && Date.parse(previous.leaseExpiresAt) > Date.parse(claimedAt)) return before;
      if (previous.status === "running" && !retry) {
        const room = clone(before);
        room.automaticReview = { ...finishMetadata(previous, claimedAt), status: "failed", error: { code: "MODEL_INTERRUPTED", message: "The previous review did not finish before its lease expired. Retry explicitly to start another model request." } };
        return revise(room, before, claimedAt);
      }
      if (previous.status === "failed" && !retry) return before;
    }
    // Reuse an existing manual job, or capture freshly saved drafts atomically.
    const room = clone(applyConsequencesAction(before, { type: "requestReview" }, claimedAt));
    if (!room.activeJob) return before;
    room.mode = "automatic-model";
    room.automaticReview = { requestId, jobId: room.activeJob.id, provider: "Meta", model: config.model, status: "running", startedAt: claimedAt, leaseExpiresAt: new Date(Date.parse(claimedAt) + MODEL_LEASE_MS).toISOString() };
    return revise(room, before, claimedAt);
  });
  if (claimed.review) return result(claimed, "already-reviewed", claimed.automaticReview?.requestId ?? null);
  const lease = claimed.automaticReview;
  if (lease?.requestId !== requestId || lease.status !== "running" || !claimed.activeJob) {
    const status = lease?.status ?? "superseded";
    return result(claimed, status, lease?.requestId ?? null, status === "running" ? 202 : status === "failed" ? 409 : 200, lease?.error);
  }
  const snapshot = claimed.activeJob;
  let response: unknown, failure: PolicyModelError | null = null;
  try { response = await (dependencies.interpret ?? interpretPolicyJob)(snapshot, config); }
  catch (error) {
    failure = error instanceof PolicyModelError ? error : new PolicyModelError("MODEL_FAILED", "The model review failed. No policy was changed. Retry when ready.");
  }
  const finished = await dependencies.mutate(id, before => {
    // A CAS retry may run later than the initial result delivery. Check the
    // lease against the time of each attempted application, not a captured time.
    const finishedAt = now();
    const current = before.automaticReview;
    if (current?.requestId !== requestId || current.status !== "running") return before;
    if (before.activeJob?.id !== snapshot.id || before.published.version !== snapshot.basePolicyVersion || JSON.stringify(before.drafts) !== JSON.stringify(snapshot.drafts)) {
      const room = clone(before); room.automaticReview = { ...finishMetadata(current, finishedAt), status: "superseded" };
      return revise(room, before, finishedAt);
    }
    if (Date.parse(finishedAt) >= Date.parse(current.leaseExpiresAt)) {
      failure = new PolicyModelError("MODEL_INTERRUPTED", "The review arrived after its lease expired. No rules were applied. Retry explicitly to start another model request.", 409);
      const room = clone(before);
      room.automaticReview = { ...finishMetadata(current, finishedAt), status: "failed", error: { code: failure.code, message: failure.message } };
      return revise(room, before, finishedAt);
    }
    if (!failure) {
      try {
        const room = applyConsequencesAction(before, { type: "completeReview", response }, finishedAt);
        room.automaticReview = { ...finishMetadata(current, finishedAt), status: "completed" };
        return room;
      } catch {
        failure = new PolicyModelError("MODEL_REVIEW_INVALID", "The model response failed policy validation. No rules were applied. Retry or clarify the drafts.");
      }
    }
    const room = clone(before);
    room.automaticReview = { ...finishMetadata(current, finishedAt), status: "failed", error: { code: failure!.code, message: failure!.message } };
    return revise(room, before, finishedAt);
  });
  // If another tab edited/retried/imported while Meta was running, report only
  // this request as superseded; never overwrite that tab's metadata or votes.
  if (finished.automaticReview?.requestId !== requestId || finished.automaticReview.status === "superseded") return result(finished, "superseded", requestId);
  if (finished.automaticReview.status === "failed") return result(finished, "failed", requestId, failure?.status ?? 502, finished.automaticReview.error);
  return result(finished, "completed", requestId);
}
