import { completeStudioRepair, parseStudioRepairIntent, repairJobIsCurrent, startStudioRepair } from "./studio-repair.ts";
import { interpretStudioRepair } from "./studio-repair-model.ts";
import { studioKeys, studioObject, studioText } from "./studio-engine.ts";
import { PolicyModelError, type PolicyModelMetrics, type PolicyModelRequestOptions } from "./policy-model.ts";
import { MAX_STUDIO_MODEL_CALLS, requireStudioModel, type StudioModelConfig } from "./studio-model.ts";
import { STUDIO_MODEL_LEASE_MS } from "./automatic-studio-review.ts";
import type { AutomaticStudioReview, StudioRepairIntent, StudioRepairJob, StudioRepairProposal, StudioRoom, StudioText } from "./studio-types";

export interface StudioRepairRequest { intent: StudioRepairIntent; proposalText?: StudioText; retry?: boolean }
export function parseStudioRepairRequest(value: unknown): StudioRepairRequest {
  const r = studioObject(value, "repair request");
  if (Object.keys(r).some(k => !["intent", "proposalText", "retry"].includes(k)) || !r.intent || (r.retry !== undefined && typeof r.retry !== "boolean")) throw new PolicyModelError("INVALID_REPAIR", "Provide a fee intent, optional bilingual rewrite, and optional boolean retry only.", 400);
  let proposalText: StudioText | undefined;
  if (r.proposalText !== undefined) {
    const p = studioObject(r.proposalText, "rewrite"); studioKeys(p, ["en", "es"], "rewrite");
    proposalText = { en: studioText(p.en, "English rewrite", 8000), es: studioText(p.es, "Spanish rewrite", 8000) };
  }
  return { intent: parseStudioRepairIntent(r.intent), ...(proposalText ? { proposalText } : {}), ...(r.retry === true ? { retry: true } : {}) };
}
export interface AutomaticStudioRepairDependencies {
  mutate: (id: string, update: (room: StudioRoom) => StudioRoom) => Promise<StudioRoom>;
  interpret?: (job: StudioRepairJob, config: StudioModelConfig, options?: PolicyModelRequestOptions) => Promise<StudioRepairProposal>;
  now?: () => string; requestId?: () => string;
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function finish(meta: AutomaticStudioReview, now: string) { return { ...meta, finishedAt: now, durationMs: Math.max(0, Date.parse(now) - Date.parse(meta.startedAt)) }; }
function revise(room: StudioRoom, now: string) { room.revision++; room.updatedAt = now; return room; }
function result(room: StudioRoom, status: AutomaticStudioReview["status"] | "already-reviewed", httpStatus = 200) {
  const meta = room.automaticRepair;
  return { room, automatic: { status, requestId: meta?.requestId ?? null, ...(meta?.error ? { error: meta.error } : {}) }, httpStatus };
}

/** Same durable one-attempt claim and shared quota as interpretation; never auto-retries. */
export async function runAutomaticStudioRepair(id: string, config: StudioModelConfig, value: StudioRepairRequest, deps: AutomaticStudioRepairDependencies) {
  requireStudioModel(config);
  const input = parseStudioRepairRequest(value), now = deps.now ?? (() => new Date().toISOString());
  const requestId = (deps.requestId ?? (() => crypto.randomUUID()))(), at = now();
  const claimed = await deps.mutate(id, before => {
    if (before.fullDemo) throw new PolicyModelError("MODEL_REPLAY_ONLY", "This recorded demo never makes model requests. Load its recorded repair or start a separate room for fresh policies.", 409);
    const previous = before.automaticRepair, repair = before.repair;
    if (previous?.status === "running" && repair?.status === "running" && repairJobIsCurrent(before, repair.job)) {
      if (Date.parse(previous.leaseExpiresAt) > Date.parse(at)) return before;
      if (!input.retry) {
        const room = copy(before);
        room.automaticRepair = { ...finish(previous, at), status: "failed", error: { code: "MODEL_INTERRUPTED", message: "The previous repair did not finish before its lease expired. Retry explicitly to start a new request." } };
        room.repair!.status = "failed"; return revise(room, at);
      }
    }
    const sameInput = repair && repairJobIsCurrent(before, repair.job) && same(repair.job.intent, input.intent) && same(repair.job.proposalText, input.proposalText);
    if (sameInput && !input.retry && ["ready", "blocked", "failed"].includes(repair.status)) return before;
    const count = before.modelCallCount ?? 0;
    if (!Number.isInteger(count) || count < 0 || count >= MAX_STUDIO_MODEL_CALLS) throw new PolicyModelError("MODEL_CALL_LIMIT", "This room has reached its shared five interpretation/repair attempts. No request was made.", 429);
    const room = startStudioRepair(before, input.intent, at, `repair-${requestId}`, input.proposalText);
    room.mode = "automatic-model"; room.modelCallCount = count + 1;
    room.automaticRepair = { requestId, jobId: room.repair!.id, provider: "Meta", model: config.model, protocol: "expression-v3", reasoningEffort: config.reasoningEffort ?? "medium", requestedEditors: ["alice", "bob"], reusedEditors: [], source: "meta", status: "running", startedAt: at, leaseExpiresAt: new Date(Date.parse(at) + STUDIO_MODEL_LEASE_MS).toISOString() };
    return room;
  });
  const lease = claimed.automaticRepair;
  if (lease?.requestId !== requestId || lease.status !== "running" || !claimed.repair) return result(claimed, lease?.status === "completed" ? "already-reviewed" : lease?.status ?? "superseded", lease?.status === "running" ? 202 : lease?.status === "failed" ? 409 : 200);
  const job = claimed.repair.job;
  let proposal: StudioRepairProposal | undefined, metrics: PolicyModelMetrics | undefined, failure: PolicyModelError | undefined;
  try { proposal = await (deps.interpret ?? interpretStudioRepair)(job, config, { onMetrics: m => { metrics = m; } }); }
  catch (error) { failure = error instanceof PolicyModelError ? error : new PolicyModelError("MODEL_FAILED", "The repair could not be completed. No policy was changed."); }
  const finished = await deps.mutate(id, before => {
    const current = before.automaticRepair, at = now();
    if (current?.requestId !== requestId || current.status !== "running") return before;
    if (before.repair?.id !== job.id || !repairJobIsCurrent(before, job)) {
      const room = copy(before); room.automaticRepair = { ...finish(current, at), status: "superseded" };
      if (room.repair?.id === job.id) room.repair = { ...room.repair, status: "superseded", votes: {} };
      return revise(room, at);
    }
    if (Date.parse(at) >= Date.parse(current.leaseExpiresAt)) failure = new PolicyModelError("MODEL_INTERRUPTED", "The repair arrived after its lease expired. No proposal was applied. Retry explicitly when ready.", 409);
    if (!failure && proposal) {
      try {
        const room = completeStudioRepair(before, job.id, proposal, at);
        room.automaticRepair = { ...finish(current, at), status: "completed", ...(metrics ? { metrics } : {}) };
        return room;
      } catch { failure = new PolicyModelError("MODEL_REVIEW_INVALID", "The repair failed validation. No policy was changed."); }
    }
    failure ??= new PolicyModelError("MODEL_REVIEW_INVALID", "No complete repair was returned.");
    const room = copy(before); room.repair!.status = "failed";
    room.automaticRepair = { ...finish(current, at), status: "failed", ...(metrics ? { metrics } : {}), error: { code: failure.code, message: failure.message } };
    return revise(room, at);
  });
  if (finished.automaticRepair?.requestId !== requestId || finished.automaticRepair?.status === "superseded") return result(finished, "superseded");
  return result(finished, finished.automaticRepair.status, finished.automaticRepair.status === "failed" ? failure?.status ?? 502 : 200);
}
