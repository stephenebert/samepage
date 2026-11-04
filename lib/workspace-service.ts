import { RoomError } from './room.ts';
import { PolicyModelError } from './policy-model.ts';
import { applyStudioAction } from './studio.ts';
import { runAutomaticStudioReview, type AutomaticStudioReviewDependencies } from './automatic-studio-review.ts';
import { runAutomaticStudioRepair, type AutomaticStudioRepairDependencies } from './automatic-studio-repair.ts';
import { interpretStudioJob, type StudioModelConfig } from './studio-model.ts';
import { interpretStudioRepair } from './studio-repair-model.ts';
import { supersedeStudioRepair } from './studio-repair.ts';
import { newJudgeToken, hashJudgeToken } from './judge-security.ts';
import { parseWorkspaceAction } from './workspace-security.ts';
import { isWorkspaceRoom } from './workspace-store.ts';
import type { JudgeLimits } from './judge-types';
import type { StudioRoom, StudioRepairIntent } from './studio-types';
import type { WorkspaceAccess, WorkspaceAction, WorkspaceResponse, WorkspaceRoom, WorkspaceStorage } from './workspace-types';

export interface WorkspaceDependencies {
  store: WorkspaceStorage;
  limits: JudgeLimits;
  config: StudioModelConfig;
  now?: () => string;
  interpretReview?: AutomaticStudioReviewDependencies['interpret'];
  interpretRepair?: AutomaticStudioRepairDependencies['interpret'];
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function workspace(room: StudioRoom): WorkspaceRoom {
  if (!isWorkspaceRoom(room)) throw new RoomError('Create a policy workspace to continue.', 'WORKSPACE_REQUIRED', 409);
  return room;
}
function current(room: StudioRoom, input: { roomId: string; revision?: number }): WorkspaceRoom {
  const result = workspace(room);
  if (room.id !== input.roomId || input.revision !== undefined && room.revision !== input.revision) throw new RoomError('The workspace changed. Review the latest version before continuing.', 'STALE_WORKSPACE', 409);
  return result;
}
function hasPublished(room: StudioRoom): boolean { return room.published.version > 0 && room.published.reviewId !== null && room.published.candidateId !== null; }
function verifyAccess(room: WorkspaceRoom, access: WorkspaceAccess): void {
  if (access.actor !== 'owner' && (!access.reviewerHash || room.workspace.reviewerHashes?.[access.actor] !== access.reviewerHash || access.roomId !== room.id)) throw new RoomError('This reviewer link is no longer current.', 'REVIEWER_ACCESS', 403);
}
function agreedBaseline(room: StudioRoom): StudioRepairIntent {
  const review = room.review;
  const baseline = review?.candidates.find(candidate => candidate.id === room.published.candidateId);
  if (!hasPublished(room) || review?.status !== 'published' || review.publishedVersion !== room.published.version || !baseline?.rules || baseline.issues.length) throw new RoomError('Both reviewers must approve the same checked policy before reviewing a rewrite.', 'BASELINE_REQUIRED', 409);
  return { baselineCandidateId: baseline.id, mode: 'preserve-outcomes', scopeFlag: 'student', feeCents: 0 };
}
function publicRoom(room: WorkspaceRoom): WorkspaceRoom {
  const result = copy(room); delete result.workspace.reviewerHashes; return result;
}
export async function getWorkspaceView(access: WorkspaceAccess | null, deps: WorkspaceDependencies): Promise<WorkspaceResponse> {
  const ledger = await deps.store.getLedger(), session = access ? await deps.store.getSession(access.ownerHash) : null;
  const budget = { sessionRemaining: Math.max(0, deps.limits.sessionCalls - (session?.calls ?? 0)), globalRemaining: Math.max(0, deps.limits.globalCalls - ledger.calls) };
  const found = session ? await deps.store.getRoom(access!.ownerHash, session.roomId) : null;
  if (access?.roomId && session?.roomId !== access.roomId) throw new RoomError('This reviewer link is no longer current.', 'REVIEWER_ACCESS', 403);
  if (isWorkspaceRoom(found) && access) verifyAccess(found, access);
  const room = isWorkspaceRoom(found) ? publicRoom(found) : null;
  return { room, actor: access?.actor ?? 'owner', hasPublished: Boolean(room && hasPublished(room)), budget, liveAvailable: deps.config.enabled && Boolean(deps.config.apiKey) && budget.sessionRemaining > 0 && budget.globalRemaining > 0 };
}
export async function actWorkspace(access: WorkspaceAccess, value: unknown, deps: WorkspaceDependencies): Promise<WorkspaceResponse> {
  const input = parseWorkspaceAction(value), now = deps.now ?? (() => new Date().toISOString());
  const approval = input.action === 'approveBaseline' || input.action === 'approveRepair';
  if (approval ? access.actor === 'owner' : access.actor !== 'owner') throw new RoomError(approval ? 'Use the appropriate reviewer link to approve this version.' : 'Only the workspace owner can make this change.', 'ROLE_REQUIRED', 403);
  if (input.action === 'create') {
    await deps.store.openWorkspace(access.ownerHash, input.title, input.drafts, input.roomId, input.revision);
    return getWorkspaceView(access, deps);
  }
  const session = await deps.store.getSession(access.ownerHash);
  if (!session || session.roomId !== input.roomId || access.roomId && access.roomId !== input.roomId) throw new RoomError('This workspace is no longer current. Refresh before continuing.', 'STALE_WORKSPACE', 409);
  const before = current(await deps.store.getRoom(access.ownerHash, input.roomId), input); verifyAccess(before, access);
  const mutate = (update: (room: WorkspaceRoom) => StudioRoom) => deps.store.mutateRoom(access.ownerHash, input.roomId, room => { const latest = current(room, input); verifyAccess(latest, access); return update(latest); });
  if (input.action === 'invite') {
    const token = newJudgeToken(), hash = await hashJudgeToken(token);
    await mutate(room => {
      const next = copy(room); next.workspace.reviewerHashes = { ...next.workspace.reviewerHashes, [input.editor]: hash };
      // A replacement holder must review independently; published history is immutable.
      if (next.review?.status === 'open') delete next.review.votes[input.editor];
      if (next.repair && next.repair.status !== 'published') delete next.repair.votes[input.editor];
      next.revision++; next.updatedAt = now(); return next;
    });
    return { ...await getWorkspaceView(access, deps), invitation: { editor: input.editor, token, roomId: input.roomId } };
  }
  if (input.action === 'saveDrafts') {
    await mutate(room => {
      if (room.workspace.title === input.title && room.drafts.alice.text === input.drafts.en && room.drafts.bob.text === input.drafts.es) return room;
      const next = copy(room), at = now(); next.workspace.title = input.title;
      const changedDraft = next.drafts.alice.text !== input.drafts.en || next.drafts.bob.text !== input.drafts.es;
      for (const editor of ['alice', 'bob'] as const) {
        const text = input.drafts[editor === 'alice' ? 'en' : 'es'];
        if (next.drafts[editor].text !== text) next.drafts[editor] = { ...next.drafts[editor], text, version: next.drafts[editor].version + 1 };
      }
      if (changedDraft) {
        next.activeJob = null; next.review = null; supersedeStudioRepair(next, at);
        if (next.automaticReview) next.automaticReview = { ...next.automaticReview, status: 'superseded', finishedAt: at, durationMs: Math.max(0, Date.parse(at) - Date.parse(next.automaticReview.startedAt)) };
      }
      next.revision++; next.updatedAt = at; return next;
    });
  } else if (input.action === 'analyze' || input.action === 'checkRewrite' || input.action === 'repair') {
    if (!deps.config.enabled || !deps.config.apiKey) throw new RoomError('Live Meta interpretation is unavailable. Your drafts are saved.', 'LIVE_UNAVAILABLE', 503);
    if (!before.drafts.alice.text.trim() || !before.drafts.bob.text.trim()) throw new RoomError('Enter both policy drafts before comparing them.', 'DRAFTS_REQUIRED', 400);
    // Keep a rejected credit action from looking like a provider attempt in the UI.
    // The atomic reservation below remains authoritative under concurrent calls.
    if (session.calls >= deps.limits.sessionCalls || (await deps.store.getLedger()).calls >= deps.limits.globalCalls) throw new RoomError('The available Meta request allowance has been used. Drafts and approved policies remain available.', 'JUDGE_CALL_LIMIT', 429);
    const intent = input.action === 'analyze' ? null : agreedBaseline(before);
    let claimFinished = false;
    const automaticMutate = async (_id: string, fn: (room: StudioRoom) => StudioRoom) => {
      const result = await deps.store.mutateRoom(access.ownerHash, input.roomId, room => {
        workspace(room); if (!claimFinished) current(room, input);
        return fn(room);
      });
      claimFinished = true; return result;
    };
    const reserve = async () => {
      try { await deps.store.reserveCall(access.ownerHash, input.roomId); }
      catch (error) { if (error instanceof RoomError) throw new PolicyModelError(error.code, error.code === 'JUDGE_CALL_LIMIT' ? 'The available Meta request allowance has been used. Drafts and approved policies remain available.' : error.message, error.status); throw error; }
    };
    const result = input.action === 'analyze'
      ? await runAutomaticStudioReview(input.roomId, deps.config, { retry: input.retry }, { mutate: automaticMutate, now, interpret: async (job, config, options) => { await reserve(); return (deps.interpretReview ?? interpretStudioJob)(job, config, options); } })
      : await runAutomaticStudioRepair(input.roomId, deps.config, { intent: intent!, ...(input.action === 'checkRewrite' ? { proposalText: input.proposalText } : {}), retry: input.retry }, { mutate: automaticMutate, now, interpret: async (job, config, options) => { await reserve(); return (deps.interpretRepair ?? interpretStudioRepair)(job, config, options); } });
    if (result.httpStatus >= 400) throw new PolicyModelError(result.automatic.error?.code ?? 'MODEL_FAILED', result.automatic.error?.message ?? 'Meta could not complete the request. No policy was published.', result.httpStatus);
  } else {
    await mutate(room => {
      if (input.action === 'approveBaseline') return applyStudioAction(room, { type: 'vote', editor: access.actor as 'alice' | 'bob', reviewId: input.reviewId, candidateId: input.candidateId }, now());
      if (input.action === 'approveRepair') return applyStudioAction(room, { type: 'voteRepair', editor: access.actor as 'alice' | 'bob', repairId: input.repairId }, now());
      if (input.action === 'register') {
        if (!hasPublished(room)) throw new RoomError('Both reviewers must approve a policy before the form can accept registrations.', 'APPROVAL_REQUIRED', 409);
        if (room.registrations.length >= deps.limits.registrations) throw new RoomError('This workspace has reached its registration record limit.', 'REGISTRATION_LIMIT', 429);
        return applyStudioAction(room, { type: 'register', requestId: crypto.randomUUID(), policyVersion: input.policyVersion, label: input.label, ...input.attendee }, now());
      }
      throw new RoomError('This action is unavailable.', 'ACTION_NOT_ALLOWED', 400);
    });
  }
  return getWorkspaceView(access, deps);
}
