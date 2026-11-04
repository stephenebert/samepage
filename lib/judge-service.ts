import { RoomError } from './room.ts';
import { PolicyModelError } from './policy-model.ts';
import { applyStudioAction } from './studio.ts';
import { runAutomaticStudioReview, type AutomaticStudioReviewDependencies } from './automatic-studio-review.ts';
import { runAutomaticStudioRepair, type AutomaticStudioRepairDependencies } from './automatic-studio-repair.ts';
import { interpretStudioJob, type StudioModelConfig } from './studio-model.ts';
import { interpretStudioRepair } from './studio-repair-model.ts';
import { startStudioRepair, completeStudioRepair } from './studio-repair.ts';
import { recordedJudgeReview, recordedJudgeRepair } from './judge-recorded.ts';
import { parseJudgeAction } from './judge-security.ts';
import { getStudioExample } from './studio-example-inputs.ts';
import type { JudgeAction, JudgeLimits, JudgeResponse, JudgeStorage } from './judge-types';
import type { StudioRoom, StudioRepairIntent } from './studio-types';

export interface JudgeDependencies {
  store: JudgeStorage;
  limits: JudgeLimits;
  config: StudioModelConfig;
  now?: () => string;
  interpretReview?: AutomaticStudioReviewDependencies['interpret'];
  interpretRepair?: AutomaticStudioRepairDependencies['interpret'];
}
export function judgeModelConfig(values: { MODEL_API_KEY?: unknown; SAMEPAGE_JUDGE_META_ENABLED?: unknown }): StudioModelConfig {
  return { apiKey: typeof values.MODEL_API_KEY === 'string' ? values.MODEL_API_KEY.trim() : '', model: 'muse-spark-1.3', enabled: values.SAMEPAGE_JUDGE_META_ENABLED === 'true', protocol: 'expression-v3', reasoningEffort: 'low', reuseUnchanged: false, maxCompletionTokens: 8192 };
}
const example = getStudioExample('interaction');
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function assertNorthstar(room: StudioRoom): void {
  if (room.liveDemo?.exampleId !== 'interaction' || room.drafts.alice.text !== example.drafts.en || room.drafts.bob.text !== example.drafts.es || room.fullDemo) throw new RoomError('Only the fixed Northstar example is supported.', 'EXAMPLE', 409);
}
function agreedBaseline(room: StudioRoom): StudioRepairIntent {
  const baseline = room.review?.candidates.find(c => c.editor === 'alice');
  if (!baseline?.rules || baseline.issues.length || room.review?.status !== 'published' || room.review.publishedVersion !== 2 || room.published.version !== 2 || room.published.candidateId !== baseline.id) throw new RoomError('Both editors must first approve the original English policy.', 'BASELINE_REQUIRED', 409);
  return { baselineCandidateId: baseline.id, mode: 'preserve-outcomes', scopeFlag: 'student', feeCents: 0 };
}
function stage(room: StudioRoom, action: JudgeAction['action']): void {
  assertNorthstar(room);
  if (action === 'analyze' && room.repair) throw new RoomError('This example has already been analyzed.', 'STAGE', 409);
  if (action === 'chooseBaseline' && (!room.review || room.repair)) throw new RoomError('Analyze the drafts before choosing the baseline.', 'STAGE', 409);
  if (action === 'checkRewrite') {
    agreedBaseline(room);
    if (room.repair && !same(room.repair.job.proposalText, example.unsafeProposal)) throw new RoomError('The correction is already in progress. Continue to approval.', 'STAGE', 409);
  }
  if (action === 'repair') {
    agreedBaseline(room);
    if (!room.repair || (room.repair.job.proposalText && (room.repair.status !== 'blocked' || !same(room.repair.job.proposalText, example.unsafeProposal)))) throw new RoomError('Check the example rewrite and inspect its blocked result first.', 'STAGE', 409);
  }
  if (action === 'register' && (room.repair?.status !== 'published' || room.published.version !== 3)) throw new RoomError('Both editors must approve the checked repair before submitting a test registration.', 'APPROVAL_REQUIRED', 409);
}
export async function getJudgeView(ownerHash: string | null, deps: JudgeDependencies): Promise<JudgeResponse> {
  const ledger = await deps.store.getLedger();
  const session = ownerHash ? await deps.store.getSession(ownerHash) : null;
  const budget = { sessionRemaining: Math.max(0, deps.limits.sessionCalls - (session?.calls ?? 0)), globalRemaining: Math.max(0, deps.limits.globalCalls - ledger.calls) };
  return { room: session ? await deps.store.getRoom(ownerHash!, session.roomId) : null, mode: session?.mode ?? null, budget, liveAvailable: deps.config.enabled && !!deps.config.apiKey && budget.sessionRemaining > 0 && budget.globalRemaining > 0 };
}
export async function actJudge(ownerHash: string, value: unknown, deps: JudgeDependencies): Promise<JudgeResponse> {
  const input = parseJudgeAction(value);
  const now = deps.now ?? (() => new Date().toISOString());
  if (input.action === 'start' || input.action === 'reset') {
    if (input.mode === 'live' && (!deps.config.enabled || !deps.config.apiKey)) throw new RoomError('Live Meta access is not enabled here. The recorded demo runs the same checks without API calls.', 'LIVE_UNAVAILABLE', 503);
    await deps.store.open(ownerHash, input.mode, input.action === 'reset', input.action === 'reset' ? input.roomId : undefined);
    return getJudgeView(ownerHash, deps);
  }
  const session = await deps.store.getSession(ownerHash);
  if (!session) throw new RoomError('Start the demo first.', 'SESSION', 401);
  const roomId = session.roomId;
  if (roomId !== input.roomId) throw new RoomError('This demo was reset in another tab. Refresh before acting.', 'STALE_ROOM', 409);
  const before = await deps.store.getRoom(ownerHash, roomId);
  stage(before, input.action);
  const mutate = (_id: string, fn: (r: StudioRoom) => StudioRoom) => deps.store.mutateRoom(ownerHash, roomId, r => { assertNorthstar(r); return fn(r); });
  const reserve = async () => {
    try { await deps.store.reserveCall(ownerHash, roomId); }
    catch (error) { if (error instanceof RoomError) throw new PolicyModelError(error.code, error.message, error.status); throw error; }
  };
  if (input.action === 'analyze' && session.mode === 'live') {
    const output = await runAutomaticStudioReview(roomId, deps.config, {}, {
      mutate, now,
      interpret: async (job, config, options) => {
        await reserve();
        return (deps.interpretReview ?? interpretStudioJob)(job, config, options);
      },
    });
    if (output.httpStatus >= 400) throw new PolicyModelError(output.automatic.error?.code ?? 'REVIEW_FAILED', output.automatic.error?.message ?? 'The live review did not complete. Reset in recorded mode to continue.', output.httpStatus);
  } else if ((input.action === 'checkRewrite' || input.action === 'repair') && session.mode === 'live') {
    const output = await runAutomaticStudioRepair(roomId, deps.config, { intent: agreedBaseline(before), ...(input.action === 'checkRewrite' ? { proposalText: example.unsafeProposal } : {}) }, {
      mutate, now,
      interpret: async (job, config, options) => {
        await reserve();
        return (deps.interpretRepair ?? interpretStudioRepair)(job, config, options);
      },
    });
    if (output.httpStatus >= 400) throw new PolicyModelError(output.automatic.error?.code ?? 'REPAIR_FAILED', output.automatic.error?.message ?? 'The live repair did not complete. Reset in recorded mode to continue.', output.httpStatus);
  } else {
    await mutate(roomId, current => {
      stage(current, input.action);
      const at = now();
      if (input.action === 'analyze') {
        if (current.review) return current;
        const started = applyStudioAction(current, { type: 'requestReview' }, at);
        const next = applyStudioAction(started, { type: 'completeReview', response: recordedJudgeReview(started.activeJob!) }, at);
        next.review!.provenance = 'fixture-replay'; next.mode = 'manual-agent-review'; next.revision = current.revision + 1;
        return next;
      }
      if (input.action === 'chooseBaseline') {
        if (current.review!.id !== input.reviewId) throw new RoomError('The review changed. Inspect the current result before approving.', 'STALE_REVIEW', 409);
        const baseline = current.review!.candidates.find(c => c.editor === 'alice')!;
        return applyStudioAction(current, { type: 'vote', editor: input.editor, reviewId: current.review!.id, candidateId: baseline.id }, at);
      }
      if (input.action === 'checkRewrite' || input.action === 'repair') {
        const proposalText = input.action === 'checkRewrite' ? example.unsafeProposal : undefined;
        if (current.repair && same(current.repair.job.proposalText, proposalText) && ['ready', 'blocked', 'published'].includes(current.repair.status)) return current;
        const started = startStudioRepair(current, agreedBaseline(current), at, `judge-repair-${current.revision + 1}`, proposalText);
        const next = completeStudioRepair(started, started.repair!.id, recordedJudgeRepair(started.repair!.job), at);
        next.revision = current.revision + 1; return next;
      }
      if (input.action === 'approve') {
        if (!current.repair) throw new RoomError('Generate a checked repair first.', 'REPAIR_REQUIRED', 409);
        if (current.repair.id !== input.repairId) throw new RoomError('The repair changed. Inspect the current result before approving.', 'STALE_REPAIR', 409);
        return applyStudioAction(current, { type: 'voteRepair', editor: input.editor, repairId: current.repair.id }, at);
      }
      if (input.action === 'register') {
        if (current.published.version !== input.policyVersion) throw new RoomError('The approved form changed. Inspect the current form before submitting.', 'STALE_POLICY', 409);
        if (current.registrations.length >= deps.limits.registrations) throw new RoomError('This demo has reached 20 test receipts. Reset to explore again.', 'REGISTRATION_LIMIT', 429);
        return applyStudioAction(current, { type: 'register', requestId: crypto.randomUUID(), policyVersion: input.policyVersion, label: input.label, ...input.attendee }, at);
      }
      throw new RoomError('Unsupported action.', 'ACTION_NOT_ALLOWED', 400);
    });
  }
  return getJudgeView(ownerHash, deps);
}
