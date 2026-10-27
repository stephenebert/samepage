import { applyStudioAction } from "./studio.ts";
import { encodeStudioExpressionRules } from "./studio-expression.ts";
import { studioDemoFixture } from "./studio-demo.ts";
import { PolicyModelError, type PolicyModelMetrics } from "./policy-model.ts";
import { createStudioInterpretationCache, encodeStudioRules, interpretStudioJob, MAX_STUDIO_MODEL_CALLS, prepareStudioRequest, requireStudioModel, type StudioModelConfig, type StudioModelRequestOptions } from "./studio-model.ts";
import type { AutomaticStudioReview, StudioJob, StudioRoom } from "./studio-types";

export const STUDIO_MODEL_LEASE_MS = 90_000;
export interface AutomaticStudioReviewDependencies {
  mutate: (id: string, update: (room: StudioRoom) => StudioRoom) => Promise<StudioRoom>;
  interpret?: (job: StudioJob, config: StudioModelConfig, options?: StudioModelRequestOptions) => Promise<unknown>;
  now?: () => string;
  requestId?: () => string;
}
export interface AutomaticStudioReviewResult {
  room: StudioRoom;
  automatic: { status: AutomaticStudioReview["status"] | "already-reviewed"; requestId: string | null; error?: { code: string; message: string } };
  httpStatus: number;
}
export interface AutomaticStudioReviewOptions { retry?: boolean; simulation?: boolean }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function finish(metadata: AutomaticStudioReview, now: string) {
  return { ...metadata, finishedAt: now, durationMs: Math.max(0, Date.parse(now) - Date.parse(metadata.startedAt)) };
}
function revise(room: StudioRoom, before: StudioRoom, now: string): StudioRoom {
  room.revision = before.revision + 1; room.updatedAt = now; return room;
}
function result(room: StudioRoom, status: AutomaticStudioReviewResult["automatic"]["status"], requestId: string | null, httpStatus = 200, error?: { code: string; message: string }): AutomaticStudioReviewResult {
  return { room, automatic: { status, requestId, ...(error ? { error } : {}) }, httpStatus };
}
function requireSimulation(room: StudioRoom) {
  if (room.simulation !== "studio-fee-v1" || room.drafts.alice.text !== studioDemoFixture.en || room.drafts.bob.text !== studioDemoFixture.es) {
    throw new PolicyModelError("MODEL_SIMULATION_UNAVAILABLE", "Offline simulation only supports the unchanged example policies. Start a new simulation or use manual review for your own edits.", 409);
  }
}
/** The only offline provider stub: exact known fixture, through the real wire adapter. */
async function simulate(job: StudioJob, config: StudioModelConfig): Promise<unknown> {
  if (job.drafts.alice.text !== studioDemoFixture.en || job.drafts.bob.text !== studioDemoFixture.es) throw new PolicyModelError("MODEL_SIMULATION_UNAVAILABLE", "The saved policies no longer match the controlled offline example.", 409);
  const protocol = config.protocol ?? "compact-v2";
  const response = { jobId: job.id, candidates: studioDemoFixture.candidates.map(c => ({ ...(protocol === "full-v1" ? { ...c, sourceVersion: job.drafts[c.editor].version } : { editor: c.editor, translation: c.editor === "alice" ? c.es : c.en, issues: c.issues }), rules: c.rules === null ? null : protocol === "expression-v3" ? encodeStudioExpressionRules(c.rules) : encodeStudioRules(c.rules) })) };
  return interpretStudioJob(job, { apiKey: "offline-simulation-not-a-credential", model: config.model, enabled: true, protocol, reasoningEffort: config.reasoningEffort ?? "medium" }, {
    fetch: async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(response) } }] }),
  });
}
/** Durable claim -> exactly one provider attempt -> compare-and-swap application. */
export async function runAutomaticStudioReview(id: string, config: StudioModelConfig, options: AutomaticStudioReviewOptions, dependencies: AutomaticStudioReviewDependencies): Promise<AutomaticStudioReviewResult> {
  const simulation = options.simulation === true, retry = options.retry === true;
  if (!simulation) requireStudioModel(config);
  const now = dependencies.now ?? (() => new Date().toISOString());
  const requestId = (dependencies.requestId ?? (() => crypto.randomUUID()))(), claimedAt = now();
  const claimed = await dependencies.mutate(id, before => {
    if (before.fullDemo) throw new PolicyModelError("MODEL_REPLAY_ONLY", "This recorded demo never makes model requests. Start a separate room for fresh policy interpretation.", 409);
    if (simulation) requireSimulation(before);
    if (before.review) return before;
    const previous = before.automaticReview;
    if (previous && before.activeJob && previous.jobId === before.activeJob.id) {
      if (previous.status === "running" && Date.parse(previous.leaseExpiresAt) > Date.parse(claimedAt)) return before;
      if (previous.status === "running" && !retry) {
        const room = clone(before);
        room.automaticReview = { ...finish(previous, claimedAt), status: "failed", error: { code: "MODEL_INTERRUPTED", message: "The previous review did not finish before its lease expired. Retry explicitly to start another request." } };
        return revise(room, before, claimedAt);
      }
      if (previous.status === "failed" && !retry) return before;
    }
    const count = before.modelCallCount ?? 0;
    if (!Number.isInteger(count) || count < 0) throw new PolicyModelError("MODEL_CALL_LIMIT", "This room's model attempt counter is invalid; no request was made.", 429);
    if (!simulation && count >= MAX_STUDIO_MODEL_CALLS) throw new PolicyModelError("MODEL_CALL_LIMIT", "This room has reached its five external model attempts. No further request was made. This is a per-room request limit, not an account spending cap.", 429);
    const room = clone(applyStudioAction(before, { type: "requestReview" }, claimedAt));
    if (!room.activeJob) return before;
    const plan = prepareStudioRequest(room.activeJob, config, simulation ? undefined : room.interpretationCache);
    room.mode = simulation ? "simulated-model" : "automatic-model";
    room.modelCallCount = count + (simulation ? 0 : 1);
    room.automaticReview = { requestId, jobId: room.activeJob.id, provider: "Meta", model: config.model, protocol: config.protocol ?? "compact-v2", reasoningEffort: config.reasoningEffort ?? "medium", requestedEditors: plan.requestedEditors, reusedEditors: plan.reusedEditors, source: simulation ? "simulation" : "meta", status: "running", startedAt: claimedAt, leaseExpiresAt: new Date(Date.parse(claimedAt) + STUDIO_MODEL_LEASE_MS).toISOString() };
    return revise(room, before, claimedAt);
  });
  if (claimed.review) return result(claimed, "already-reviewed", claimed.automaticReview?.requestId ?? null);
  const lease = claimed.automaticReview;
  if (lease?.requestId !== requestId || lease.status !== "running" || !claimed.activeJob) {
    const status = lease?.status ?? "superseded";
    return result(claimed, status, lease?.requestId ?? null, status === "running" ? 202 : status === "failed" ? 409 : 200, lease?.error);
  }
  const snapshot = claimed.activeJob;
  let response: unknown, failure: PolicyModelError | null = null, metrics: PolicyModelMetrics | undefined;
  try { response = await (simulation ? simulate(snapshot, config) : (dependencies.interpret ?? interpretStudioJob)(snapshot, config, { interpretationCache: claimed.interpretationCache, onMetrics: value => { metrics = value; } })); }
  catch (error) { failure = error instanceof PolicyModelError ? error : new PolicyModelError("MODEL_FAILED", "The model review failed. No policy was changed. Retry when ready."); }
  const finished = await dependencies.mutate(id, before => {
    const finishedAt = now(), current = before.automaticReview;
    if (current?.requestId !== requestId || current.status !== "running") return before;
    if (before.activeJob?.id !== snapshot.id || before.published.version !== snapshot.basePolicyVersion || JSON.stringify(before.drafts) !== JSON.stringify(snapshot.drafts)) {
      const room = clone(before); room.automaticReview = { ...finish(current, finishedAt), status: "superseded" };
      return revise(room, before, finishedAt);
    }
    if (Date.parse(finishedAt) >= Date.parse(current.leaseExpiresAt)) {
      failure = new PolicyModelError("MODEL_INTERRUPTED", "The review arrived after its lease expired. No rules were applied. Retry explicitly to start another request.", 409);
      const room = clone(before); room.automaticReview = { ...finish(current, finishedAt), status: "failed", error: { code: failure.code, message: failure.message } };
      return revise(room, before, finishedAt);
    }
    if (!failure) {
      try {
        const room = applyStudioAction(before, { type: "completeReview", response }, finishedAt);
        room.review!.provenance = simulation ? "simulated-model" : "meta-model";
        if (!simulation) room.interpretationCache = createStudioInterpretationCache(snapshot, config, room.review!.candidates);
        room.automaticReview = { ...finish(current, finishedAt), status: "completed", ...(metrics ? { metrics } : {}) };
        return room;
      } catch { failure = new PolicyModelError("MODEL_REVIEW_INVALID", "The model response failed policy validation. No rules were applied. Retry or clarify the drafts."); }
    }
    const room = clone(before); room.automaticReview = { ...finish(current, finishedAt), status: "failed", ...(metrics ? { metrics } : {}), error: { code: failure!.code, message: failure!.message } };
    return revise(room, before, finishedAt);
  });
  if (finished.automaticReview?.requestId !== requestId || finished.automaticReview.status === "superseded") return result(finished, "superseded", requestId);
  if (finished.automaticReview.status === "failed") return result(finished, "failed", requestId, failure?.status ?? 502, finished.automaticReview.error);
  return result(finished, "completed", requestId);
}
