import { RoomError } from './room.ts';
import { checkJudgeOrigin } from './judge-security.ts';
import { parseStudioAttendee, studioInteger, studioKeys, studioObject, studioText } from './studio-engine.ts';
import type { WorkspaceAction } from './workspace-types';
import type { StudioText } from './studio-types';

export const WORKSPACE_TEXT_LIMIT = 4000;
export function workspaceIdentifier(value: unknown): string {
  const id = studioText(value, 'snapshot identifier', 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new RoomError('Invalid snapshot identifier.');
  return id;
}
function text(value: unknown, name: string, maximum: number, empty = false): string {
  if (typeof value !== 'string' || value.length > maximum || (!empty && !value.trim()) || /\u0000/.test(value)) throw new RoomError(`${name} must be ${empty ? 'at most' : 'between 1 and'} ${maximum} characters.`, 'INVALID', 400);
  return value;
}
function drafts(value: unknown, empty: boolean): StudioText {
  const item = studioObject(value, 'policy drafts'); studioKeys(item, ['en', 'es'], 'policy drafts');
  return { en: text(item.en, 'English policy', WORKSPACE_TEXT_LIMIT, empty), es: text(item.es, 'Spanish policy', WORKSPACE_TEXT_LIMIT, empty) };
}
function retry(a: Record<string, unknown>): { retry?: boolean } {
  if (a.retry !== undefined && typeof a.retry !== 'boolean') throw new RoomError('Retry must be a boolean.');
  return a.retry === true ? { retry: true } : {};
}
export function parseWorkspaceAction(value: unknown): WorkspaceAction {
  const a = studioObject(value, 'workspace action');
  const room = () => workspaceIdentifier(a.roomId), revision = () => studioInteger(a.revision, 'workspace revision', 0, 1000000);
  if (a.action === 'create') {
    const optional = ['roomId', 'revision'].filter(k => Object.hasOwn(a, k));
    studioKeys(a, ['action', 'title', 'drafts', ...optional], 'workspace action');
    if (optional.length !== 0 && optional.length !== 2) throw new RoomError('Provide both the current workspace and revision.');
    return { action: a.action, title: text(a.title, 'Title', 120), drafts: drafts(a.drafts, true), ...(optional.length ? { roomId: room(), revision: revision() } : {}) };
  }
  if (a.action === 'saveDrafts') {
    studioKeys(a, ['action', 'roomId', 'revision', 'title', 'drafts'], 'workspace action');
    return { action: a.action, roomId: room(), revision: revision(), title: text(a.title, 'Title', 120), drafts: drafts(a.drafts, true) };
  }
  if (a.action === 'analyze' || a.action === 'repair' || a.action === 'checkRewrite') {
    studioKeys(a, ['action', 'roomId', 'revision', ...(a.action === 'checkRewrite' ? ['proposalText'] : []), ...(Object.hasOwn(a, 'retry') ? ['retry'] : [])], 'workspace action');
    return a.action === 'checkRewrite' ? { action: a.action, roomId: room(), revision: revision(), proposalText: drafts(a.proposalText, false), ...retry(a) } : { action: a.action, roomId: room(), revision: revision(), ...retry(a) };
  }
  if (a.action === 'invite') {
    studioKeys(a, ['action', 'roomId', 'revision', 'editor'], 'workspace action');
    if (a.editor !== 'alice' && a.editor !== 'bob') throw new RoomError('Choose the English or Spanish reviewer.');
    return { action: a.action, roomId: room(), revision: revision(), editor: a.editor };
  }
  if (a.action === 'approveBaseline') {
    studioKeys(a, ['action', 'roomId', 'reviewId', 'candidateId'], 'workspace action');
    return { action: a.action, roomId: room(), reviewId: workspaceIdentifier(a.reviewId), candidateId: workspaceIdentifier(a.candidateId) };
  }
  if (a.action === 'approveRepair') {
    studioKeys(a, ['action', 'roomId', 'repairId'], 'workspace action');
    return { action: a.action, roomId: room(), repairId: workspaceIdentifier(a.repairId) };
  }
  if (a.action === 'register') {
    studioKeys(a, ['action', 'roomId', 'policyVersion', 'attendee', 'label'], 'workspace action');
    return { action: a.action, roomId: room(), policyVersion: studioInteger(a.policyVersion, 'policy version', 1, 1000000), attendee: parseStudioAttendee(a.attendee), label: text(a.label, 'Attendee label', 80) };
  }
  throw new RoomError('This action is unavailable.', 'ACTION_NOT_ALLOWED', 400);
}
export async function readWorkspaceAction(request: Request): Promise<WorkspaceAction> {
  try { checkJudgeOrigin(request); }
  catch (error) { if (error instanceof RoomError && error.code === 'ORIGIN') throw new RoomError('This action must come from SamePage.', 'ORIGIN', 403); throw error; }
  if (Number(request.headers.get('content-length')) > 40000) throw new RoomError('Request is too large.', 'LIMIT', 413);
  const reader = request.body?.getReader(); if (!reader) throw new RoomError('Expected an action.');
  const decoder = new TextDecoder(); let raw = '', bytes = 0;
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 40000) { await reader.cancel(); throw new RoomError('Request is too large.', 'LIMIT', 413); }
    raw += decoder.decode(chunk.value, { stream: true });
  }
  raw += decoder.decode();
  let value: unknown; try { value = JSON.parse(raw); } catch { throw new RoomError('Invalid JSON action.', 'INVALID_JSON', 400); }
  return parseWorkspaceAction(value);
}
