import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { D1JudgeStore } from '../lib/judge-store.ts';
import { actJudge, getJudgeView, judgeModelConfig } from '../lib/judge-service.ts';
import { recordedJudgeReview, recordedJudgeRepair } from '../lib/judge-recorded.ts';
import { JUDGE_HARD_LIMITS, JUDGE_COOKIE, newJudgeToken, hashJudgeToken, judgeCookie, readJudgeToken, readJudgeAction, parseJudgeAction, judgeLimits } from '../lib/judge-security.ts';

const at = '2026-10-30T23:00:00.000Z';
const owner = 'a'.repeat(64), other = 'b'.repeat(64);
const config = judgeModelConfig({ MODEL_API_KEY: 'synthetic-test-only', SAMEPAGE_JUDGE_META_ENABLED: 'true' });
let originalFetch;
before(() => { originalFetch = globalThis.fetch; globalThis.fetch = () => { throw new Error('Unexpected network request in judge tests'); }; });
after(() => { globalThis.fetch = originalFetch; });
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../drizzle/0000_dazzling_betty_ross.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql) {
      return { bind(...values) { return {
        async first() { return db.prepare(sql).get(...values) ?? null; },
        async run() { const result = db.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
      }; } };
    },
  };
}
function setup(overrides = {}) {
  let time = at, calls = 0;
  const limits = { ...JUDGE_HARD_LIMITS, ...overrides };
  const db = database(), store = new D1JudgeStore(db, limits, () => time);
  const deps = { store, limits, config, now: () => time,
    interpretReview: async job => { calls++; return recordedJudgeReview(job); },
    interpretRepair: async job => { calls++; return recordedJudgeRepair(job); },
  };
  return { db, store, deps, get calls() { return calls; }, setTime(t) { time = t; } };
}
function request(action, current) {
  if (action.action === 'start') return action;
  return { ...action, roomId: current.room.id,
    ...(action.action === 'chooseBaseline' ? { reviewId: current.room.review.id } : {}),
    ...(action.action === 'approve' ? { repairId: current.room.repair.id } : {}),
    ...(action.action === 'register' ? { policyVersion: current.room.published.version } : {}),
  };
}
async function send(state, action, user = owner) {
  const current = await getJudgeView(user, state.deps);
  return actJudge(user, request(action, current), state.deps);
}
async function baseline(state, mode = 'recorded') {
  await send(state, { action: 'start', mode });
  await send(state, { action: 'analyze' });
  let result = await send(state, { action: 'chooseBaseline', editor: 'alice' });
  assert.equal(result.room.published.version, 1);
  result = await send(state, { action: 'chooseBaseline', editor: 'bob' });
  assert.equal(result.room.published.version, 2); return result;
}

test('session token is 256-bit, cookie is protected, hash is one-way, duplicate cookies rejected', async () => {
  const token = newJudgeToken(); assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(token, newJudgeToken());
  const hashed = await hashJudgeToken(token); assert.notEqual(hashed, token); assert.equal(hashed.length, 64);
  assert.match(judgeCookie(token), /^__Host-samepage-judge=/);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(judgeCookie(token).includes(attr));
  assert.equal(readJudgeToken(new Request('https://example.test', { headers: { cookie: `${JUDGE_COOKIE}=${token}` } })), token);
  assert.equal(readJudgeToken(new Request('https://example.test', { headers: { cookie: `${JUDGE_COOKIE}=${token}; ${JUDGE_COOKIE}=${token}` } })), null);
});

test('actions reject arbitrary prompts, imported review data, custom models and missing snapshot identity', async () => {
  for (const action of [{ action: 'draft', text: 'x' }, { action: 'completeReview', response: {} }, { action: 'analyze', roomId: 'studio-x', retry: true }, { action: 'start', mode: 'live', model: 'x' }, { action: 'chooseBaseline', editor: 'alice' }, { action: 'approve', editor: 'alice', roomId: 'studio-x' }, { action: 'repair', roomId: 'studio-x', proposalText: { en: 'x', es: 'x' } }]) assert.throws(() => parseJudgeAction(action));
  const good = { action: 'start', mode: 'recorded' };
  assert.deepEqual(await readJudgeAction(new Request('https://judge.example/api/judge', { method: 'POST', headers: { origin: 'https://judge.example', 'content-type': 'application/json' }, body: JSON.stringify(good) })), good);
  for (const headers of [{ origin: 'https://other.example', 'content-type': 'application/json' }, { 'content-type': 'application/json' }, { origin: 'https://judge.example', 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }]) await assert.rejects(readJudgeAction(new Request('https://judge.example/api/judge', { method: 'POST', headers, body: JSON.stringify(good) })), { code: 'ORIGIN' });
  await assert.rejects(readJudgeAction(new Request('https://judge.example/api/judge', { method: 'POST', headers: { origin: 'https://judge.example', 'content-type': 'application/json' }, body: JSON.stringify({ ...good, text: 'a'.repeat(5000) }) })), { code: 'LIMIT' });
});

test('server model settings are fixed and environment can only reduce 30/10 limits', () => {
  assert.equal(config.model, 'muse-spark-1.3'); assert.equal(config.reasoningEffort, 'low'); assert.equal(config.maxCompletionTokens, 8192);
  assert.equal(judgeModelConfig({ MODEL_API_KEY: 'x' }).enabled, false);
  assert.equal(judgeLimits({}).sessionCalls, 10);
  assert.equal(judgeLimits({ SAMEPAGE_JUDGE_MAX_CALLS: '999', SAMEPAGE_JUDGE_SESSION_CALLS: '999' }).globalCalls, 30);
  assert.equal(judgeLimits({ SAMEPAGE_JUDGE_SESSION_CALLS: '999' }).sessionCalls, 10);
  assert.equal(judgeLimits({ SAMEPAGE_JUDGE_MAX_CALLS: '4', SAMEPAGE_JUDGE_SESSION_CALLS: '1' }).sessionCalls, 1);
  assert.equal(judgeLimits({ SAMEPAGE_JUDGE_MAX_CALLS: 'bad' }).globalCalls, 0);
  assert.equal(judgeLimits({ SAMEPAGE_JUDGE_SESSION_CALLS: 'bad' }).sessionCalls, 0);
});

test('recorded full flow requires both approvals, blocks unsafe rewrite and enforces published form', async () => {
  const state = setup();
  let result = await send(state, { action: 'start', mode: 'recorded' });
  assert.equal(result.room.review, null); assert.equal(result.room.modelCallCount, 0);
  assert.deepEqual(result.room.registrations, []); assert.equal(result.room.fullDemo, undefined);
  await assert.rejects(send(state, { action: 'checkRewrite' }), { code: 'BASELINE_REQUIRED' });
  await baseline(state);
  result = await send(state, { action: 'checkRewrite' });
  assert.equal(result.room.repair.status, 'blocked');
  const witness = result.room.repair.impact.verification.witnesses.find(w => w.kind === 'admission-left');
  assert.ok(witness); assert.equal(witness.attendee.resident, true); assert.equal(witness.attendee.member, true); assert.equal(witness.attendee.student, false);
  await assert.rejects(send(state, { action: 'approve', editor: 'alice' }), { code: 'REPAIR_BLOCKED' });
  await assert.rejects(send(state, { action: 'approve', editor: 'bob' }), { code: 'REPAIR_BLOCKED' });
  result = await send(state, { action: 'repair' }); assert.equal(result.room.repair.status, 'ready');
  await assert.rejects(actJudge(owner, { action: 'approve', roomId: result.room.id, repairId: 'old-repair', editor: 'alice' }, state.deps), { code: 'STALE_REPAIR' });
  result = await send(state, { action: 'approve', editor: 'alice' }); assert.equal(result.room.published.version, 2);
  result = await send(state, { action: 'approve', editor: 'bob' }); assert.equal(result.room.published.version, 3);
  await assert.rejects(actJudge(owner, { action: 'register', roomId: result.room.id, policyVersion: 2, attendee: witness.attendee, label: 'Stale form' }, state.deps), { code: 'STALE_POLICY' });
  for (const [change, accepted] of [[{}, true], [{ member: false }, true], [{ member: false, resident: false }, false]]) {
    result = await send(state, { action: 'register', attendee: { ...witness.attendee, ...change }, label: 'Synthetic attendee' });
    assert.equal(result.room.registrations.at(-1).decision.accepted, accepted);
  }
  assert.equal(state.calls, 0); assert.equal((await state.store.getLedger()).calls, 0);
  assert.equal(result.room.review.provenance, 'fixture-replay'); assert.equal(result.mode, 'recorded');
});

test('live full flow makes exactly three attempts and reset does not replenish session or global budget', async () => {
  const state = setup({ sessionCalls: 3 }); await baseline(state, 'live');
  await send(state, { action: 'checkRewrite' }); await send(state, { action: 'repair' });
  let result = await send(state, { action: 'approve', editor: 'alice' });
  result = await send(state, { action: 'approve', editor: 'bob' });
  assert.equal(state.calls, 3); assert.equal(result.budget.sessionRemaining, 0); assert.equal(result.budget.globalRemaining, 27);
  const oldId = result.room.id;
  await assert.rejects(send(state, { action: 'reset', mode: 'live' }), { code: 'JUDGE_CALL_LIMIT' });
  result = await send(state, { action: 'reset', mode: 'recorded' });
  assert.notEqual(result.room.id, oldId); assert.equal(result.room.review, null); assert.equal(result.budget.sessionRemaining, 0);
  await assert.rejects(state.store.getRoom(owner, oldId), { code: 'SESSION' });
  assert.equal((await state.store.getLedger()).calls, 3);
});

test('another cookie cannot read or mutate owned rooms; stale tabs cannot approve or reset new sessions', async () => {
  const state = setup(); const old = await baseline(state);
  await send(state, { action: 'start', mode: 'recorded' }, other);
  await assert.rejects(state.store.getRoom(other, old.room.id), { code: 'SESSION' });
  await assert.rejects(state.store.mutateRoom(other, old.room.id, r => r), { code: 'SESSION' });
  const staleVote = request({ action: 'chooseBaseline', editor: 'alice' }, old);
  await send(state, { action: 'reset', mode: 'recorded' });
  await baseline(state);
  await assert.rejects(actJudge(owner, staleVote, state.deps), { code: 'STALE_ROOM' });
  await assert.rejects(actJudge(owner, { action: 'reset', mode: 'recorded', roomId: old.room.id }, state.deps), { code: 'STALE_ROOM' });
  const current = await getJudgeView(owner, state.deps);
  await assert.rejects(actJudge(owner, { action: 'chooseBaseline', roomId: current.room.id, reviewId: 'not-this-review', editor: 'alice' }, state.deps), { code: 'STALE_REVIEW' });
});

test('concurrent analysis clicks make only one provider attempt', async () => {
  const state = setup(); const current = await send(state, { action: 'start', mode: 'live' });
  let release; const pending = new Promise(r => { release = r; }); let entered;
  const enteredPromise = new Promise(r => { entered = r; });
  let calls = 0;
  state.deps.interpretReview = async job => { calls++; entered(); await pending; return recordedJudgeReview(job); };
  const first = actJudge(owner, request({ action: 'analyze' }, current), state.deps);
  await enteredPromise;
  const second = await actJudge(owner, request({ action: 'analyze' }, current), state.deps);
  assert.equal(second.room.automaticReview.status, 'running'); assert.equal(calls, 1);
  release(); await first;
  assert.equal((await state.store.getLedger()).calls, 1);
});

test('failed provider attempt is charged and cannot auto-retry', async () => {
  const state = setup(); await send(state, { action: 'start', mode: 'live' });
  let attempts = 0;
  state.deps.interpretReview = async () => { attempts++; throw new Error('Synthetic failure'); };
  await assert.rejects(send(state, { action: 'analyze' }));
  await assert.rejects(send(state, { action: 'analyze' }));
  assert.equal(attempts, 1); assert.equal((await state.store.getLedger()).calls, 1);
  const result = await send(state, { action: 'reset', mode: 'recorded' }); assert.equal(result.budget.sessionRemaining, 9);
});

test('durable global reservations stay below cap under contention and survive new store instances', async () => {
  const state = setup({ globalCalls: 7 });
  const sessions = [];
  for (let i = 1; i <= 8; i++) { const id = i.toString(16).padStart(64, '0'); sessions.push([id, await state.store.open(id, 'live', false)]); }
  const results = await Promise.allSettled(sessions.flatMap(([id, s]) => [state.store.reserveCall(id, s.roomId), state.store.reserveCall(id, s.roomId)]));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 7);
  assert.equal((await state.store.getLedger()).calls, 7);
  const freshStore = new D1JudgeStore(state.db, state.deps.limits, () => at);
  assert.equal((await freshStore.getLedger()).calls, 7);
  const [id, session] = sessions[7];
  await assert.rejects(state.store.reserveCall(id, session.roomId), { code: 'JUDGE_CALL_LIMIT' });
  await assert.rejects(state.store.open('f'.repeat(64), 'live', false), { code: 'JUDGE_CALL_LIMIT' });
});

test('session expiration revokes room access without refunding global reservations', async () => {
  const state = setup(); await send(state, { action: 'start', mode: 'live' }); await send(state, { action: 'analyze' });
  state.setTime('2026-11-08T23:00:00.000Z');
  await assert.rejects(state.store.getSession(owner), { code: 'SESSION' });
  assert.equal((await state.store.getLedger()).calls, 1);
});

test('session, reset and receipt limits bound anonymous storage growth', async () => {
  const state = setup({ sessions: 1, resets: 1, registrations: 1 });
  await baseline(state);
  await assert.rejects(send(state, { action: 'start', mode: 'recorded' }, other), { code: 'JUDGE_SESSION_LIMIT' });
  const unsafe = await send(state, { action: 'checkRewrite' });
  const attendee = unsafe.room.repair.impact.verification.witnesses[0].attendee;
  await send(state, { action: 'repair' });
  await send(state, { action: 'approve', editor: 'alice' });
  await send(state, { action: 'approve', editor: 'bob' });
  await send(state, { action: 'register', attendee, label: 'Synthetic person' });
  await assert.rejects(send(state, { action: 'register', attendee, label: 'Another synthetic person' }), { code: 'REGISTRATION_LIMIT' });
  await send(state, { action: 'reset', mode: 'recorded' });
  await assert.rejects(send(state, { action: 'reset', mode: 'recorded' }), { code: 'JUDGE_RESET_LIMIT' });
});
