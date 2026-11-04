import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { D1WorkspaceStore } from '../lib/workspace-store.ts';
import { D1JudgeStore } from '../lib/judge-store.ts';
import { actWorkspace, getWorkspaceView } from '../lib/workspace-service.ts';
import { parseWorkspaceAction, readWorkspaceAction } from '../lib/workspace-security.ts';
import { judgeModelConfig } from '../lib/judge-service.ts';
import { JUDGE_HARD_LIMITS } from '../lib/judge-security.ts';
import { PolicyModelError } from '../lib/policy-model.ts';

const at = '2026-11-04T03:00:00.000Z';
const owner = { ownerHash: 'a'.repeat(64), actor: 'owner' };
const other = { ownerHash: 'b'.repeat(64), actor: 'owner' };
const config = judgeModelConfig({ MODEL_API_KEY: 'unit-test-placeholder', SAMEPAGE_JUDGE_META_ENABLED: 'true' });
const drafts = {
  en: 'Cedar Makerspace admits local residents or student members. There is no application deadline. Admission is free.',
  es: 'Cedar Makerspace admite a residentes locales que sean estudiantes, o a estudiantes miembros. No hay fecha límite. La entrada es gratuita.',
};
const rewrite = {
  en: 'Cedar Makerspace admits student members or resident nonmembers. There is no application deadline. Admission is free.',
  es: 'Cedar Makerspace admite a miembros estudiantes o a residentes que no sean miembros. No hay fecha límite. La entrada es gratuita.',
};
const flag = (field, value = true) => ({ op: 'flag', field, value });
const rule = eligibility => ({ eligibility, fee: { currency: 'USD', defaultCents: 0, overrides: [] } });
const englishRules = rule({ op: 'any', args: [flag('resident'), { op: 'all', args: [flag('student'), flag('member')] }] });
const spanishRules = rule({ op: 'all', args: [flag('student'), { op: 'any', args: [flag('resident'), flag('member')] }] });
const unsafeRules = rule({ op: 'any', args: [{ op: 'all', args: [flag('student'), flag('member')] }, { op: 'all', args: [flag('resident'), flag('member', false)] }] });
const attendee = { age: 30, resident: true, student: false, member: true, guardianConsent: false, scholarship: true, submittedAt: at };
let oldFetch;
before(() => { oldFetch = globalThis.fetch; globalThis.fetch = () => { throw new Error('Unit tests must not call a provider'); }; });
after(() => { globalThis.fetch = oldFetch; });
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../drizzle/0000_dazzling_betty_ross.sql', import.meta.url), 'utf8'));
  return { prepare(sql) { return { bind(...values) { return { async first() { return db.prepare(sql).get(...values) ?? null; }, async run() { const result = db.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; } }; } }; } };
}
function review(job, rules = [englishRules, spanishRules]) {
  return { jobId: job.id, candidates: ['alice', 'bob'].map((editor, i) => ({ editor, sourceVersion: job.drafts[editor].version,
    en: editor === 'alice' ? job.drafts.alice.text : 'Faithful English interpretation of the Spanish source.',
    es: editor === 'bob' ? job.drafts.bob.text : 'Interpretación fiel del texto en inglés.',
    rules: rules[i], issues: rules[i] ? [] : ['Clarify the admission condition.'] })) };
}
function setup(overrides = {}) {
  const db = database(), limits = { ...JUDGE_HARD_LIMITS, ...overrides }, store = new D1WorkspaceStore(db, limits, () => at);
  let calls = 0;
  const deps = { store, limits, config, now: () => at,
    interpretReview: async job => { calls++; return review(job); },
    interpretRepair: async job => { calls++; return { ...(job.proposalText ?? { en: 'A checked English repair.', es: 'Una reparación revisada.' }), rules: job.proposalText ? unsafeRules : job.baseline.rules, issues: [] }; },
  };
  return { db, store, deps, get calls() { return calls; } };
}
async function send(state, action, access = owner) {
  const current = await getWorkspaceView(access, state.deps), room = current.room;
  return actWorkspace(access, { ...action,
    ...(action.action === 'create' ? room ? { roomId: room.id, revision: room.revision } : {} : { roomId: room.id }),
    ...(['saveDrafts', 'analyze', 'repair', 'checkRewrite', 'invite'].includes(action.action) ? { revision: room.revision } : {}),
    ...(action.action === 'approveBaseline' ? { reviewId: room.review.id, candidateId: action.candidateId ?? room.review.candidates[0].id } : {}),
    ...(action.action === 'approveRepair' ? { repairId: room.repair.id } : {}),
    ...(action.action === 'register' ? { policyVersion: room.published.version } : {}),
  }, state.deps);
}
async function create(state, access = owner) { return send(state, { action: 'create', title: 'Cedar policy', drafts }, access); }
async function reviewer(state, editor) {
  const result = await send(state, { action: 'invite', editor });
  return { access: await state.store.resolveReviewer(result.room.id, result.invitation.token), invitation: result.invitation };
}
async function baseline(state, pick = 'alice') {
  await create(state); const a = await reviewer(state, 'alice'), b = await reviewer(state, 'bob');
  let result = await send(state, { action: 'analyze' });
  const candidateId = result.room.review.candidates.find(c => c.editor === pick).id;
  result = await send(state, { action: 'approveBaseline', candidateId }, a.access);
  assert.equal(result.hasPublished, false);
  result = await send(state, { action: 'approveBaseline', candidateId }, b.access);
  assert.equal(result.hasPublished, true); assert.equal(result.room.published.version, 1);
  return { a, b, result };
}

test('blank drafts persist without Meta availability or an unused allowance; nothing is published', async () => {
  const state = setup({ globalCalls: 0, sessionCalls: 0 }); state.deps.config = { ...config, enabled: false, apiKey: '' };
  const result = await send(state, { action: 'create', title: 'My review', drafts: { en: '', es: '' } });
  assert.equal(result.room.published.version, 0); assert.equal(result.hasPublished, false); assert.equal(result.liveAvailable, false);
  assert.equal(result.room.drafts.alice.text, ''); assert.equal(result.room.liveDemo, undefined); assert.equal(result.room.fullDemo, undefined);
  await assert.rejects(send(state, { action: 'register', attendee, label: 'Attendee' }), { code: 'INVALID' });
  await send(state, { action: 'saveDrafts', title: 'Cedar policy', drafts });
  await assert.rejects(send(state, { action: 'analyze' }), { code: 'LIVE_UNAVAILABLE' });
  assert.equal(state.calls, 0);
});

test('custom live flow uses three provider calls, blocks unintended outcomes and requires distinct role links', async () => {
  const state = setup(); const { a, b } = await baseline(state);
  await assert.rejects(send(state, { action: 'approveBaseline' }), { code: 'ROLE_REQUIRED' });
  let result = await send(state, { action: 'checkRewrite', proposalText: rewrite });
  assert.equal(result.room.repair.status, 'blocked');
  await assert.rejects(send(state, { action: 'approveRepair' }, a.access), { code: 'REPAIR_BLOCKED' });
  result = await send(state, { action: 'repair' }); assert.equal(result.room.repair.status, 'ready');
  result = await send(state, { action: 'approveRepair' }, a.access); assert.equal(result.room.published.version, 1);
  result = await send(state, { action: 'approveRepair' }, b.access); assert.equal(result.room.published.version, 2);
  result = await send(state, { action: 'register', attendee, label: 'Cedar applicant' });
  assert.equal(result.room.registrations[0].decision.accepted, true);
  assert.equal(result.room.registrations[0].scholarship, true);
  assert.equal(result.room.modelCallCount, 3); assert.equal(state.calls, 3);
  assert.equal(result.budget.sessionRemaining, 7); assert.equal(result.budget.globalRemaining, 27);
  assert.equal(result.room.review.provenance, 'meta-model');
  assert.equal(result.room.workspace.reviewerHashes, undefined);
});

test('reviewers can choose Spanish baseline; disagreement does not publish', async () => {
  const state = setup(); await create(state); const a = await reviewer(state, 'alice'), b = await reviewer(state, 'bob');
  const result = await send(state, { action: 'analyze' });
  const en = result.room.review.candidates[0].id, es = result.room.review.candidates[1].id;
  await send(state, { action: 'approveBaseline', candidateId: en }, a.access);
  let current = await send(state, { action: 'approveBaseline', candidateId: es }, b.access);
  assert.equal(current.hasPublished, false);
  current = await send(state, { action: 'approveBaseline', candidateId: es }, a.access);
  assert.equal(current.hasPublished, true); assert.deepEqual(current.room.published.rules, spanishRules);
});

test('draft edits invalidate checks and pending approvals; stale snapshots are rejected', async () => {
  const state = setup(); await create(state); const a = await reviewer(state, 'alice');
  const result = await send(state, { action: 'analyze' });
  await send(state, { action: 'approveBaseline' }, a.access);
  const old = result.room;
  const current = await send(state, { action: 'saveDrafts', title: 'Updated Cedar', drafts: { ...drafts, en: `${drafts.en} Local residents are not required to be students.` } });
  assert.equal(current.room.review, null); assert.equal(current.hasPublished, false);
  await assert.rejects(actWorkspace(a.access, { action: 'approveBaseline', roomId: old.id, reviewId: old.review.id, candidateId: old.review.candidates[0].id }, state.deps), { code: 'STALE_REVIEW' });
  await assert.rejects(actWorkspace(owner, { action: 'saveDrafts', roomId: old.id, revision: old.revision, title: 'Stale title', drafts }, state.deps), { code: 'STALE_WORKSPACE' });
});

test('invitation rotation revokes old resolved access and removes pending votes without changing other roles', async () => {
  const state = setup(); await create(state); const a = await reviewer(state, 'alice'), b = await reviewer(state, 'bob');
  await send(state, { action: 'analyze' }); await send(state, { action: 'approveBaseline' }, a.access);
  const replacement = await reviewer(state, 'alice');
  const result = await getWorkspaceView(owner, state.deps);
  assert.deepEqual(result.room.review.votes, {});
  await assert.rejects(state.store.resolveReviewer(a.invitation.roomId, a.invitation.token), { code: 'REVIEWER_ACCESS' });
  await assert.rejects(actWorkspace(a.access, { action: 'approveBaseline', roomId: result.room.id, reviewId: result.room.review.id, candidateId: result.room.review.candidates[0].id }, state.deps), { code: 'REVIEWER_ACCESS' });
  await send(state, { action: 'approveBaseline' }, b.access);
  const done = await send(state, { action: 'approveBaseline' }, replacement.access); assert.equal(done.hasPublished, true);
});

test('owner isolation, role permissions, and reviewer link scope are enforced', async () => {
  const state = setup(); const result = await create(state), a = await reviewer(state, 'alice');
  assert.equal((await getWorkspaceView(other, state.deps)).room, null);
  await assert.rejects(actWorkspace(other, { action: 'analyze', roomId: result.room.id, revision: result.room.revision }, state.deps), { code: 'STALE_WORKSPACE' });
  await assert.rejects(send(state, { action: 'analyze' }, a.access), { code: 'ROLE_REQUIRED' });
  await assert.rejects(send(state, { action: 'invite', editor: 'bob' }, a.access), { code: 'ROLE_REQUIRED' });
  assert.throws(() => parseWorkspaceAction({ action: 'approveBaseline', editor: 'bob', roomId: 'studio-x', reviewId: 'review-x', candidateId: 'candidate-x' }));
  assert.equal(state.calls, 0);
});

test('legacy recorded sessions migrate without fixture reuse or budget replenishment', async () => {
  const state = setup(); const legacy = new D1JudgeStore(state.db, state.deps.limits, () => at);
  await legacy.open(owner.ownerHash, 'live', false); const old = await legacy.getSession(owner.ownerHash);
  await legacy.reserveCall(owner.ownerHash, old.roomId);
  await legacy.open(owner.ownerHash, 'recorded', true, old.roomId);
  assert.equal((await getWorkspaceView(owner, state.deps)).room, null);
  const result = await create(state);
  assert.equal(result.budget.sessionRemaining, 9); assert.equal(result.budget.globalRemaining, 29);
  assert.equal(result.room.drafts.alice.text, drafts.en); assert.equal(result.room.liveDemo, undefined);
  assert.equal(result.room.review, null); assert.equal(result.hasPublished, false);
});

test('new review does not refill credits and expires old reviewer links', async () => {
  const state = setup({ sessionCalls: 1 }); await create(state); const a = await reviewer(state, 'alice');
  await send(state, { action: 'analyze' });
  const result = await create(state);
  assert.equal(result.budget.sessionRemaining, 0); assert.equal(result.liveAvailable, false);
  assert.equal(result.room.review, null); assert.equal(result.hasPublished, false);
  await assert.rejects(state.store.resolveReviewer(a.invitation.roomId, a.invitation.token), { code: 'REVIEWER_ACCESS' });
  await assert.rejects(send(state, { action: 'analyze' }), { code: 'JUDGE_CALL_LIMIT' });
  assert.equal(state.calls, 1);
  assert.equal((await getWorkspaceView(owner, state.deps)).room.modelCallCount, 0);
});

test('raising the session allowance retains prior usage and still enforces ten per session and thirty site-wide', async () => {
  const state = setup({ sessionCalls: 3 }); await create(state);
  const original = await send(state, { action: 'analyze' });
  assert.equal(original.budget.sessionRemaining, 2);
  const before = await state.store.getLedger();
  const limits = { ...JUDGE_HARD_LIMITS };
  const store = new D1WorkspaceStore(state.db, limits, () => at);
  const upgraded = { ...state.deps, store, limits };
  const current = await getWorkspaceView(owner, upgraded);
  assert.equal(current.room.id, original.room.id);
  assert.equal(current.room.review.id, original.room.review.id);
  assert.equal(current.budget.sessionRemaining, 9);
  assert.equal(current.budget.globalRemaining, 29);
  assert.deepEqual(await store.getLedger(), before);

  for (let i = 0; i < 9; i++) await store.reserveCall(owner.ownerHash, current.room.id);
  await assert.rejects(store.reserveCall(owner.ownerHash, current.room.id), { code: 'JUDGE_CALL_LIMIT' });
  assert.equal((await store.getSession(owner.ownerHash)).calls, 10);
  for (const ownerHash of ['b'.repeat(64), 'c'.repeat(64)]) {
    const session = await store.open(ownerHash, 'live', false);
    for (let i = 0; i < 10; i++) await store.reserveCall(ownerHash, session.roomId);
  }
  const freshOwner = 'd'.repeat(64), fresh = await store.open(freshOwner, 'live', false);
  await assert.rejects(store.reserveCall(freshOwner, fresh.roomId), { code: 'JUDGE_CALL_LIMIT' });
  assert.equal((await store.getLedger()).calls, 30);
  assert.equal((await store.getSession(freshOwner)).calls, 0);
  assert.equal((await getWorkspaceView({ ownerHash: freshOwner, actor: 'owner' }, upgraded)).liveAvailable, false);
});

test('provider failure has no replay fallback or automatic retry', async () => {
  const state = setup(); await create(state); let attempts = 0;
  state.deps.interpretReview = async job => { attempts++; if (attempts === 1) throw new PolicyModelError('UPSTREAM', 'Synthetic unit-test failure.', 502); return review(job); };
  await assert.rejects(send(state, { action: 'analyze' }), { code: 'UPSTREAM' });
  assert.equal((await getWorkspaceView(owner, state.deps)).room.review, null);
  await assert.rejects(send(state, { action: 'analyze' }), { code: 'UPSTREAM' });
  assert.equal(attempts, 1);
  const result = await send(state, { action: 'analyze', retry: true });
  assert.equal(attempts, 2); assert.equal(result.budget.sessionRemaining, 8);
});

test('editing while Meta is pending prevents a stale completion from applying', async () => {
  const state = setup(); await create(state); let finish, started;
  const ready = new Promise(resolve => { started = resolve; });
  state.deps.interpretReview = job => new Promise(resolve => { finish = () => resolve(review(job)); started(); });
  const pending = send(state, { action: 'analyze' }); await ready;
  await send(state, { action: 'saveDrafts', title: 'New text', drafts: { ...drafts, es: `${drafts.es} El requisito ha cambiado.` } });
  finish(); const result = await pending;
  assert.equal(result.room.review, null); assert.equal(result.room.automaticReview.status, 'superseded');
  assert.equal(result.hasPublished, false); assert.equal(result.budget.sessionRemaining, 9);
});

test('unresolved policy interpretation cannot be approved or registered', async () => {
  const state = setup(); await create(state); const a = await reviewer(state, 'alice');
  state.deps.interpretReview = async job => review(job, [null, spanishRules]);
  const result = await send(state, { action: 'analyze' }); assert.equal(result.room.review.discovery.status, 'unresolved');
  await assert.rejects(send(state, { action: 'approveBaseline' }, a.access), { code: 'UNRESOLVED' });
  await assert.rejects(actWorkspace(owner, { action: 'register', roomId: result.room.id, policyVersion: 1, attendee, label: 'Applicant' }, state.deps), { code: 'APPROVAL_REQUIRED' });
});

test('request schema, text bounds, and same-origin boundaries reject unauthorized inputs', async () => {
  for (const value of [
    { action: 'create', title: 'x', drafts: { en: 'x'.repeat(4001), es: '' } },
    { action: 'analyze', roomId: 'studio-x', revision: 0, model: 'other' },
    { action: 'completeReview', response: {} },
    { action: 'create', title: 'x', drafts, mode: 'recorded' },
  ]) assert.throws(() => parseWorkspaceAction(value));
  const body = JSON.stringify({ action: 'create', title: 'x', drafts });
  const valid = new Request('https://samepage.example/api/workspace', { method: 'POST', headers: { origin: 'https://samepage.example', 'content-type': 'application/json' }, body });
  assert.equal((await readWorkspaceAction(valid)).action, 'create');
  await assert.rejects(readWorkspaceAction(new Request('https://samepage.example/api/workspace', { method: 'POST', headers: { origin: 'https://other.example', 'content-type': 'application/json' }, body })), { code: 'ORIGIN' });
});
