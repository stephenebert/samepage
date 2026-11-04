import { RoomError } from './room.ts';
import { parseStudioAttendee, studioInteger, studioKeys, studioObject, studioText } from './studio-engine.ts';
import type { JudgeAction, JudgeLimits } from './judge-types';

export const JUDGE_COOKIE = '__Host-samepage-judge';
export const JUDGE_SESSION_SECONDS = 7 * 24 * 60 * 60;
export const JUDGE_HARD_LIMITS: JudgeLimits = { globalCalls: 30, sessionCalls: 10, sessions: 2000, resets: 20, registrations: 20 };
function lowerLimit(value: unknown, maximum: number): number {
  if (value === undefined || value === '') return maximum;
  if (typeof value !== 'string' || !/^\d{1,5}$/.test(value)) return 0;
  return Math.min(maximum, Number(value));
}
export function judgeLimits(env: { SAMEPAGE_JUDGE_MAX_CALLS?: unknown; SAMEPAGE_JUDGE_SESSION_CALLS?: unknown }): JudgeLimits {
  return { ...JUDGE_HARD_LIMITS, globalCalls: lowerLimit(env.SAMEPAGE_JUDGE_MAX_CALLS, JUDGE_HARD_LIMITS.globalCalls), sessionCalls: lowerLimit(env.SAMEPAGE_JUDGE_SESSION_CALLS, JUDGE_HARD_LIMITS.sessionCalls) };
}
export function newJudgeToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function hashJudgeToken(token: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new RoomError('Start a new judge session.', 'SESSION', 401);
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function judgeCookie(token: string): string {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid cookie token');
  return `${JUDGE_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${JUDGE_SESSION_SECONDS}`;
}
export function readJudgeToken(request: Request): string | null {
  const values = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(`${JUDGE_COOKIE}=`));
  if (values.length !== 1) return null;
  const value = values[0].slice(JUDGE_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function checkJudgeOrigin(request: Request): void {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new RoomError('This action must come from the SamePage judge demo.', 'ORIGIN', 403);
  }
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw new RoomError('Send application/json.', 'CONTENT_TYPE', 415);
}
export async function readJudgeAction(request: Request): Promise<JudgeAction> {
  checkJudgeOrigin(request);
  if (Number(request.headers.get('content-length')) > 4096) throw new RoomError('Request is too large.', 'LIMIT', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RoomError('Expected an action.', 'INVALID', 400);
  const decoder = new TextDecoder(); let raw = '', bytes = 0;
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 4096) { await reader.cancel(); throw new RoomError('Request is too large.', 'LIMIT', 413); }
    raw += decoder.decode(chunk.value, { stream: true });
  }
  raw += decoder.decode();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new RoomError('Invalid JSON action.', 'INVALID_JSON', 400); }
  return parseJudgeAction(value);
}
export function parseJudgeAction(value: unknown): JudgeAction {
  const a = studioObject(value, 'judge action');
  if (a.action === 'start' || a.action === 'reset') {
    studioKeys(a, a.action === 'start' ? ['action', 'mode'] : ['action', 'mode', 'roomId'], 'judge action');
    if (a.mode !== 'live' && a.mode !== 'recorded') throw new RoomError('Choose live or recorded mode.');
    return a.action === 'start' ? { action: 'start', mode: a.mode } : { action: 'reset', mode: a.mode, roomId: identifier(a.roomId) };
  }
  if (a.action === 'analyze' || a.action === 'checkRewrite' || a.action === 'repair') {
    studioKeys(a, ['action', 'roomId'], 'judge action'); return { action: a.action, roomId: identifier(a.roomId) };
  }
  if (a.action === 'chooseBaseline' || a.action === 'approve') {
    studioKeys(a, ['action', 'editor', 'roomId', a.action === 'chooseBaseline' ? 'reviewId' : 'repairId'], 'judge action');
    if (a.editor !== 'alice' && a.editor !== 'bob') throw new RoomError('Choose Alice or Bob.');
    return a.action === 'chooseBaseline' ? { action: a.action, editor: a.editor, roomId: identifier(a.roomId), reviewId: identifier(a.reviewId) }
      : { action: a.action, editor: a.editor, roomId: identifier(a.roomId), repairId: identifier(a.repairId) };
  }
  if (a.action === 'register') {
    studioKeys(a, ['action', 'attendee', 'label', 'roomId', 'policyVersion'], 'judge action');
    return { action: 'register', attendee: parseStudioAttendee(a.attendee), label: studioText(a.label, 'synthetic attendee label', 80), roomId: identifier(a.roomId), policyVersion: studioInteger(a.policyVersion, 'policyVersion', 1, 1000) };
  }
  throw new RoomError('This action is unavailable in the judge demo.', 'ACTION_NOT_ALLOWED', 400);
}
function identifier(value: unknown): string {
  const id = studioText(value, 'snapshot identifier', 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new RoomError('Invalid snapshot identifier.');
  return id;
}
