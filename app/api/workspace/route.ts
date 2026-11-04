import { env } from 'cloudflare:workers';
import { D1WorkspaceStore } from '@/lib/workspace-store';
import { actWorkspace, getWorkspaceView, type WorkspaceDependencies } from '@/lib/workspace-service';
import { readWorkspaceAction, workspaceIdentifier } from '@/lib/workspace-security';
import { judgeModelConfig } from '@/lib/judge-service';
import { hashJudgeToken, judgeCookie, judgeLimits, newJudgeToken, readJudgeToken } from '@/lib/judge-security';
import { RoomError } from '@/lib/room';
import { PolicyModelError } from '@/lib/policy-model';
import type { WorkspaceAccess, WorkspaceResponse } from '@/lib/workspace-types';

export const dynamic = 'force-dynamic';
function dependencies(): WorkspaceDependencies {
  const values = env as { DB?: D1Database; MODEL_API_KEY?: string; SAMEPAGE_JUDGE_META_ENABLED?: string; SAMEPAGE_JUDGE_MAX_CALLS?: string; SAMEPAGE_JUDGE_SESSION_CALLS?: string };
  if (!values.DB) throw new RoomError('Workspace storage is unavailable.', 'STORAGE_UNAVAILABLE', 503);
  const limits = judgeLimits(values);
  return { limits, store: new D1WorkspaceStore(values.DB, limits), config: judgeModelConfig(values) };
}
function json(data: WorkspaceResponse, status = 200, cookie?: string): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
}
async function accessFor(request: Request, deps: WorkspaceDependencies): Promise<WorkspaceAccess | null> {
  const reviewer = request.headers.get('X-SamePage-Reviewer'), roomId = request.headers.get('X-SamePage-Room');
  // A role link deliberately takes precedence over an owner's browser cookie.
  if (reviewer !== null || roomId !== null) {
    if (!reviewer || !roomId) throw new RoomError('This reviewer link is incomplete.', 'REVIEWER_ACCESS', 403);
    return deps.store.resolveReviewer(workspaceIdentifier(roomId), reviewer);
  }
  const token = readJudgeToken(request);
  return token ? { ownerHash: await hashJudgeToken(token), actor: 'owner' } : null;
}
async function failure(error: unknown, access: WorkspaceAccess | null, deps?: WorkspaceDependencies): Promise<Response> {
  const known = error instanceof RoomError || error instanceof PolicyModelError;
  let view: WorkspaceResponse = { room: null, actor: access?.actor ?? 'owner', hasPublished: false, liveAvailable: false, budget: { sessionRemaining: 0, globalRemaining: 0 } };
  if (deps && access) { try { view = await getWorkspaceView(access, deps); } catch { /* Do not expose a room after authorization fails. */ } }
  return json({ ...view, error: known ? error.message : 'The action could not be completed. Refresh to check the current workspace.', code: known ? error.code : 'SERVER_ERROR' }, known ? error.status : 500);
}
export async function GET(request: Request): Promise<Response> {
  let deps: WorkspaceDependencies | undefined, access: WorkspaceAccess | null = null;
  try { deps = dependencies(); access = await accessFor(request, deps); return json(await getWorkspaceView(access, deps)); }
  catch (error) { return failure(error, access, deps); }
}
export async function POST(request: Request): Promise<Response> {
  let deps: WorkspaceDependencies | undefined, access: WorkspaceAccess | null = null;
  try {
    const input = await readWorkspaceAction(request); deps = dependencies(); access = await accessFor(request, deps);
    let token: string | undefined;
    if (!access) {
      if (input.action !== 'create') throw new RoomError('Create a workspace first.', 'SESSION', 401);
      token = newJudgeToken(); access = { ownerHash: await hashJudgeToken(token), actor: 'owner' };
    }
    return json(await actWorkspace(access, input, deps), 200, token ? judgeCookie(token) : undefined);
  } catch (error) { return failure(error, access, deps); }
}
