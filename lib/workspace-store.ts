import { D1JudgeStore } from './judge-store.ts';
import { hashJudgeToken } from './judge-security.ts';
import { createStudioRoom } from './studio.ts';
import { RoomError } from './room.ts';
import type { JudgeLimits, JudgeMode } from './judge-types';
import type { StudioRoom, StudioText } from './studio-types';
import type { WorkspaceAccess, WorkspaceRoom, WorkspaceStorage } from './workspace-types';

export function isWorkspaceRoom(room: StudioRoom | null): room is WorkspaceRoom {
  return Boolean(room && (room as WorkspaceRoom).workspace?.kind === 'samepage-workspace-v1');
}
export function createWorkspaceRoom(id: string, now: string, title: string, drafts: StudioText): WorkspaceRoom {
  const room = createStudioRoom(id, now) as WorkspaceRoom;
  room.workspace = { kind: 'samepage-workspace-v1', title, reviewerHashes: {} };
  room.mode = 'automatic-model'; room.modelCallCount = 0;
  // Version zero is an unpublished placeholder; the service forbids its use.
  room.published.version = 0; room.published.en = ''; room.published.es = '';
  room.drafts.alice.text = drafts.en; room.drafts.bob.text = drafts.es;
  return room;
}
function equalHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export class D1WorkspaceStore implements WorkspaceStorage {
  private inner: D1JudgeStore;
  constructor(private db: D1Database, private limits: JudgeLimits, private now = () => new Date().toISOString()) {
    this.inner = new D1JudgeStore(db, limits, now, (id, at) => createWorkspaceRoom(id, at, 'Untitled review', { en: '', es: '' }), true);
  }
  getLedger() { return this.inner.getLedger(); }
  getSession(owner: string) { return this.inner.getSession(owner); }
  open(owner: string, mode: JudgeMode, reset: boolean, roomId?: string) { return this.inner.open(owner, mode, reset, roomId); }
  getRoom(owner: string, roomId: string) { return this.inner.getRoom(owner, roomId); }
  mutateRoom(owner: string, roomId: string, update: (room: StudioRoom) => StudioRoom) { return this.inner.mutateRoom(owner, roomId, update); }
  reserveCall(owner: string, roomId: string) { return this.inner.reserveCall(owner, roomId); }
  async openWorkspace(owner: string, title: string, drafts: StudioText, expectedRoomId?: string, expectedRevision?: number): Promise<void> {
    const session = await this.inner.getSession(owner);
    if (session) {
      const room = await this.inner.getRoom(owner, session.roomId);
      if (isWorkspaceRoom(room) && (expectedRoomId !== room.id || expectedRevision !== room.revision)) throw new RoomError('The current workspace changed. Refresh before starting a new review.', 'STALE_WORKSPACE', 409);
    } else if (expectedRoomId !== undefined) throw new RoomError('This workspace is no longer available.', 'STALE_WORKSPACE', 409);
    const writer = new D1JudgeStore(this.db, this.limits, this.now, (id, at) => createWorkspaceRoom(id, at, title, drafts), true);
    await writer.open(owner, 'live', Boolean(session), session?.roomId);
  }
  async resolveReviewer(roomId: string, token: string): Promise<WorkspaceAccess> {
    if (!/^studio-[a-zA-Z0-9_-]{1,90}$/.test(roomId) || !/^[a-f0-9]{64}$/.test(token)) throw new RoomError('This reviewer link is invalid or has expired.', 'REVIEWER_ACCESS', 403);
    const row = await this.db.prepare('SELECT owner_hash FROM judge_rooms WHERE id = ?').bind(roomId).first<{ owner_hash: string }>();
    if (!row) throw new RoomError('This reviewer link is invalid or has expired.', 'REVIEWER_ACCESS', 403);
    let room: StudioRoom;
    try { room = await this.inner.getRoom(row.owner_hash, roomId); } catch { throw new RoomError('This reviewer link is invalid or has expired.', 'REVIEWER_ACCESS', 403); }
    if (!isWorkspaceRoom(room)) throw new RoomError('This reviewer link is invalid or has expired.', 'REVIEWER_ACCESS', 403);
    const hash = await hashJudgeToken(token);
    const actor = (['alice', 'bob'] as const).find(editor => equalHash(room.workspace.reviewerHashes?.[editor] ?? '', hash));
    if (!actor) throw new RoomError('This reviewer link is invalid or has expired.', 'REVIEWER_ACCESS', 403);
    return { ownerHash: row.owner_hash, actor, roomId, reviewerHash: hash };
  }
}
