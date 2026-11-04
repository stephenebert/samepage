import { RoomError } from './room.ts';
import { createStudioLiveDemoRoom } from './studio-live-demo.ts';
import { JUDGE_SESSION_SECONDS } from './judge-security.ts';
import type { JudgeLedger, JudgeLimits, JudgeMode, JudgeSession, JudgeStorage } from './judge-types';
import type { StudioRoom } from './studio-types';

const LEDGER_ID = 'judge-budget-v1';
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function emptyJudgeLedger(): JudgeLedger { return { version: 1, revision: 0, calls: 0, sessions: {} }; }
export function requireJudgeSession(ledger: JudgeLedger, owner: string, now: string, roomId?: string): JudgeSession {
  const session = ledger.sessions[owner];
  if (!session || session.ownerHash !== owner || Date.parse(session.expiresAt) <= Date.parse(now) || (roomId && session.roomId !== roomId)) {
    throw new RoomError('This demo session is unavailable. Start a new session.', 'SESSION', 401);
  }
  return session;
}
/** One atomic ledger transition owns both counters; a reset never replenishes them. */
export function reserveJudgeCall(ledger: JudgeLedger, owner: string, roomId: string, limits: JudgeLimits, now: string): JudgeLedger {
  const session = requireJudgeSession(ledger, owner, now, roomId);
  if (session.mode !== 'live') throw new RoomError('Recorded sessions cannot make live requests.', 'MODE', 403);
  if (ledger.calls >= limits.globalCalls || session.calls >= limits.sessionCalls) throw new RoomError('The live demo request allowance is used. Reset in recorded mode to keep exploring.', 'JUDGE_CALL_LIMIT', 429);
  const next = copy(ledger); next.calls++; next.sessions[owner].calls++; next.revision++; return next;
}
export function openJudgeSession(ledger: JudgeLedger, owner: string, mode: JudgeMode, reset: boolean, roomId: string, limits: JudgeLimits, now: string, expectedRoomId?: string, allowUnfundedLiveSession = false): { ledger: JudgeLedger; session: JudgeSession } {
  if (!/^[a-f0-9]{64}$/.test(owner)) throw new RoomError('Invalid session.', 'SESSION', 401);
  const existing = ledger.sessions[owner];
  if (existing && Date.parse(existing.expiresAt) <= Date.parse(now)) throw new RoomError('This demo session has expired.', 'SESSION_EXPIRED', 401);
  if (existing && !reset) {
    if (existing.mode !== mode) throw new RoomError('Reset the demo to change mode.', 'RESET_REQUIRED', 409);
    return { ledger, session: existing };
  }
  if (!existing && reset) throw new RoomError('Start the demo before resetting it.', 'SESSION', 401);
  if (reset && existing?.roomId !== expectedRoomId) throw new RoomError('This demo was reset in another tab. Refresh before acting.', 'STALE_ROOM', 409);
  if (!existing && Object.keys(ledger.sessions).length >= limits.sessions) throw new RoomError('The judge demo has reached its session allowance.', 'JUDGE_SESSION_LIMIT', 429);
  if (existing && existing.resets >= limits.resets) throw new RoomError('This session has reached its reset allowance.', 'JUDGE_RESET_LIMIT', 429);
  if (!allowUnfundedLiveSession && mode === 'live' && (ledger.calls >= limits.globalCalls || (existing?.calls ?? 0) >= limits.sessionCalls)) throw new RoomError('The live request allowance is used. Choose recorded mode.', 'JUDGE_CALL_LIMIT', 429);
  const next = copy(ledger);
  const session: JudgeSession = { ownerHash: owner, roomId, mode, calls: existing?.calls ?? 0, resets: existing ? existing.resets + 1 : 0, createdAt: existing?.createdAt ?? now, expiresAt: existing?.expiresAt ?? new Date(Date.parse(now) + JUDGE_SESSION_SECONDS * 1000).toISOString() };
  next.sessions[owner] = session; next.revision++; return { ledger: next, session };
}
export class D1JudgeStore implements JudgeStorage {
  constructor(private db: D1Database, private limits: JudgeLimits, private now = () => new Date().toISOString(), private roomFactory = createStudioLiveDemoRoom, private allowUnfundedLiveSession = false) {}
  async getLedger(): Promise<JudgeLedger> {
    const row = await this.db.prepare('SELECT state FROM judge_ledger WHERE id = ?').bind(LEDGER_ID).first<{ state: string }>();
    if (!row) return emptyJudgeLedger();
    const ledger = JSON.parse(row.state) as JudgeLedger;
    if (ledger.version !== 1 || !Number.isInteger(ledger.calls) || ledger.calls < 0 || !ledger.sessions) throw new RoomError('Demo budget storage is invalid; live requests are disabled.', 'STORAGE_INVALID', 503);
    return ledger;
  }
  private async mutateLedger(update: (ledger: JudgeLedger) => JudgeLedger): Promise<JudgeLedger> {
    const empty = emptyJudgeLedger();
    await this.db.prepare('INSERT OR IGNORE INTO judge_ledger (id, revision, state) VALUES (?, ?, ?)').bind(LEDGER_ID, 0, JSON.stringify(empty)).run();
    for (let attempt = 0; attempt < 12; attempt++) {
      const before = await this.getLedger(), next = update(before);
      if (next === before) return before;
      if (next.revision !== before.revision + 1) throw new Error('Invalid ledger transition');
      const state = JSON.stringify(next);
      if (state.length > 900000) throw new RoomError('Demo session storage is full.', 'LIMIT', 429);
      const result = await this.db.prepare('UPDATE judge_ledger SET revision = ?, state = ? WHERE id = ? AND revision = ?').bind(next.revision, state, LEDGER_ID, before.revision).run();
      if (result.meta.changes === 1) return next;
    }
    throw new RoomError('The demo is busy. Try again shortly.', 'RETRY', 409);
  }
  async getSession(ownerHash: string): Promise<JudgeSession | null> {
    const ledger = await this.getLedger();
    if (!ledger.sessions[ownerHash]) return null;
    return requireJudgeSession(ledger, ownerHash, this.now());
  }
  async open(ownerHash: string, mode: JudgeMode, reset: boolean, expectedRoomId?: string): Promise<JudgeSession> {
    const now = this.now(), roomId = `studio-${crypto.randomUUID()}`;
    const ledger = await this.mutateLedger(before => openJudgeSession(before, ownerHash, mode, reset, roomId, this.limits, now, expectedRoomId, this.allowUnfundedLiveSession).ledger);
    const session = requireJudgeSession(ledger, ownerHash, now);
    if (session.roomId === roomId) {
      const room = this.roomFactory(roomId, now, 'interaction');
      if (mode === 'recorded') room.mode = 'manual-agent-review';
      await this.db.prepare('INSERT INTO judge_rooms (id, owner_hash, revision, state, updated_at) VALUES (?, ?, ?, ?, ?)').bind(room.id, ownerHash, room.revision, JSON.stringify(room), now).run();
    }
    return session;
  }
  async getRoom(ownerHash: string, roomId: string): Promise<StudioRoom> {
    requireJudgeSession(await this.getLedger(), ownerHash, this.now(), roomId);
    const row = await this.db.prepare('SELECT state FROM judge_rooms WHERE id = ? AND owner_hash = ?').bind(roomId, ownerHash).first<{ state: string }>();
    if (!row) throw new RoomError('The demo workspace is unavailable. Reset to start again.', 'NOT_FOUND', 404);
    const room = JSON.parse(row.state) as StudioRoom;
    if (room.id !== roomId || room.kind !== 'samepage-studio-v1') throw new RoomError('Demo workspace is invalid.', 'STORAGE_INVALID', 503);
    return room;
  }
  async mutateRoom(ownerHash: string, roomId: string, update: (before: StudioRoom) => StudioRoom): Promise<StudioRoom> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const before = await this.getRoom(ownerHash, roomId), next = update(before);
      if (next === before) return before;
      if (next.id !== roomId || next.revision !== before.revision + 1) throw new Error('Invalid room transition');
      const state = JSON.stringify(next);
      if (state.length > 500000) throw new RoomError('This demo workspace is full.', 'LIMIT', 429);
      const result = await this.db.prepare('UPDATE judge_rooms SET revision = ?, state = ?, updated_at = ? WHERE id = ? AND owner_hash = ? AND revision = ?').bind(next.revision, state, next.updatedAt, roomId, ownerHash, before.revision).run();
      if (result.meta.changes === 1) return next;
    }
    throw new RoomError('The workspace changed. Refresh and try again.', 'RETRY', 409);
  }
  async reserveCall(ownerHash: string, roomId: string): Promise<void> {
    await this.mutateLedger(before => reserveJudgeCall(before, ownerHash, roomId, this.limits, this.now()));
  }
}
