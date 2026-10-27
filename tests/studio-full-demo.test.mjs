import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createStudioFullDemoRoom } from '../lib/studio-full-demo.ts';
import { studioFullDemoFixture as fixture } from '../lib/studio-full-demo-fixture.ts';
import { applyStudioAction, createStudioRoom, parseStudioAction } from '../lib/studio.ts';
import { evaluateStudioPolicy } from '../lib/studio-engine.ts';
import { canonicalStudioPolicy } from '../lib/studio-presentation.ts';
import { runAutomaticStudioReview } from '../lib/automatic-studio-review.ts';
import { runAutomaticStudioRepair } from '../lib/automatic-studio-repair.ts';
import { studioModelConfig } from '../lib/studio-model.ts';

const now = '2026-10-27T20:00:00.000Z';
const create = id => createStudioFullDemoRoom(id ?? 'full-demo-test', now);
const load = room => applyStudioAction(room, { type: 'loadDemoRepair', repairId: room.fullDemo.unsafeRepairId }, now);
const vote = (room, editor) => applyStudioAction(room, { type: 'voteRepair', editor, repairId: room.repair.id }, now);
let originalFetch, requests = 0;
before(() => { originalFetch = globalThis.fetch; globalThis.fetch = () => { requests++; throw new Error('No network allowed in recorded demo tests'); }; });
after(() => { globalThis.fetch = originalFetch; assert.equal(requests, 0); });

test('fresh full demo recomputes the unsafe consequence without current repair approvals or model calls', () => {
  const room = create();
  assert.equal(room.published.version, 2);
  assert.equal(room.review.provenance, 'fixture-replay');
  assert.deepEqual(room.review.votes, {});
  assert.deepEqual(room.repair.votes, {});
  assert.equal(room.repair.status, 'blocked');
  assert.equal(room.modelCallCount, 0);
  assert.equal(room.automaticReview, undefined);
  assert.equal(room.automaticRepair, undefined);
  assert.equal(room.interpretationCache, undefined);
  assert.ok(room.repair.impact.verification.checkedCases > 0);
  const witness = room.repair.impact.verification.witnesses.find(w => !w.attendee.student && w.attendee.member && w.left.feeCents === 2700 && w.right.feeCents === 3100);
  assert.ok(witness, 'the nonstudent member pays $27 as requested but $31 under the supplied rewrite');
  for (const editor of ['alice', 'bob']) assert.throws(() => vote(room, editor), { code: 'REPAIR_BLOCKED' });
  assert.equal(room.registrations.length, 1);
  assert.deepEqual(room.registrations[0].decision, evaluateStudioPolicy(room.published.rules, fixture.attendee));
  assert.equal(room.registrations[0].decision.feeCents, 1400);
});

test('loading recorded correction is one atomic revision and preserves the blocked evidence', () => {
  const blocked = create(), serialized = JSON.stringify(blocked), room = load(blocked);
  assert.equal(JSON.stringify(blocked), serialized, 'loading never mutates the caller snapshot');
  assert.equal(room.revision, blocked.revision + 1);
  assert.equal(room.repair.status, 'ready');
  assert.equal(room.repair.impact.status, 'pass');
  assert.equal(room.repair.impact.verification.status, 'equivalent');
  assert.equal(room.repairHistory.length, 1);
  assert.deepEqual(room.repairHistory[0], blocked.repair);
  assert.deepEqual(room.repair.votes, {});
  assert.deepEqual(room.published, blocked.published);
  assert.equal(room.modelCallCount, 0);
});

test('two simulated editors must approve separately before the same attendee changes from $14 to $19', () => {
  let room = load(create());
  const before = structuredClone(room.registrations[0]), published = structuredClone(room.published);
  room = vote(room, 'alice');
  assert.deepEqual(room.repair.votes, { alice: true });
  assert.equal(room.repair.status, 'ready');
  assert.deepEqual(room.published, published);
  assert.equal(evaluateStudioPolicy(room.published.rules, fixture.attendee).feeCents, 1400);
  room = vote(room, 'bob');
  assert.deepEqual(room.repair.votes, { alice: true, bob: true });
  assert.equal(room.repair.status, 'published');
  assert.equal(room.published.version, 3);
  assert.equal(evaluateStudioPolicy(room.published.rules, fixture.attendee).feeCents, 1900);
  assert.deepEqual({ en: room.published.en, es: room.published.es }, canonicalStudioPolicy(room.repair.proposal.rules));
  room = applyStudioAction(room, { type: 'register', requestId: 'after-repair', policyVersion: 3, label: 'Same example attendee', ...fixture.attendee }, now);
  assert.equal(room.registrations.length, 2);
  assert.deepEqual(room.registrations[0], before, 'original receipt stays intact');
  assert.equal(room.registrations[1].decision.feeCents, 1900);
  assert.equal(room.registrations[1].policyVersion, 3);
  for (const k of Object.keys(fixture.attendee)) assert.equal(room.registrations[0][k], room.registrations[1][k]);
  assert.equal(room.modelCallCount, 0);
});

test('repeated load and approval requests preserve votes and publish only once', () => {
  const blocked = create();
  let room = load(blocked);
  assert.strictEqual(load(room), room);
  room = vote(room, 'alice');
  assert.strictEqual(load(room), room);
  assert.strictEqual(vote(room, 'alice'), room);
  room = vote(room, 'bob');
  assert.strictEqual(load(room), room);
  assert.strictEqual(vote(room, 'bob'), room);
  assert.equal(room.published.version, 3);
});

test('fresh demo reset creates independent room, jobs and votes', () => {
  const a = vote(load(create('rehearsal-a')), 'alice'), b = create('rehearsal-b');
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.fullDemo.unsafeRepairId, b.fullDemo.unsafeRepairId);
  assert.notEqual(a.repair.id, b.repair.id);
  assert.deepEqual(b.repair.votes, {});
  assert.equal(b.repair.status, 'blocked');
  assert.deepEqual(a.repair.votes, { alice: true });
  assert.throws(() => applyStudioAction(b, { type: 'loadDemoRepair', repairId: a.fullDemo.unsafeRepairId }, now), { code: 'STALE_REPAIR' });
});

test('draft changes invalidate saved correction before and after the first approval', () => {
  for (const setup of [create, () => vote(load(create()), 'alice')]) {
    const initial = setup(), oldRepairId = initial.repair.id;
    const room = applyStudioAction(initial, { type: 'draft', editor: 'bob', baseVersion: initial.drafts.bob.version, text: initial.drafts.bob.text + ' Cambio para revisar.' }, now);
    assert.equal(room.repair.status, 'superseded');
    assert.deepEqual(room.repair.votes, {});
    assert.throws(() => load(room), { code: 'STALE_REPAIR' });
    assert.throws(() => applyStudioAction(room, { type: 'voteRepair', editor: 'bob', repairId: oldRepairId }, now), { code: 'REPAIR_BLOCKED' });
    assert.equal(room.published.version, 2);
  }
});

test('recorded load action rejects arbitrary proposals and cannot operate in an ordinary room', () => {
  const r = create();
  for (const extra of [{ rules: {} }, { proposal: fixture.correctedProposal }, { votes: { alice: true, bob: true } }]) {
    assert.throws(() => parseStudioAction({ type: 'loadDemoRepair', repairId: r.repair.id, ...extra }));
  }
  assert.throws(() => applyStudioAction(createStudioRoom('ordinary', now), { type: 'loadDemoRepair', repairId: r.repair.id }, now), { code: 'DEMO_UNAVAILABLE' });
});

test('all provider routes remain blocked for full replay even when live Meta is configured and drafts change', async () => {
  const config = studioModelConfig({ MODEL_API_KEY: 'synthetic-only', SAMEPAGE_STUDIO_META_ENABLED: 'true' });
  for (const edit of [false, true]) {
    let room = create();
    const input = { intent: room.repair.job.intent };
    if (edit) room = applyStudioAction(room, { type: 'draft', editor: 'alice', baseVersion: room.drafts.alice.version, text: room.drafts.alice.text + ' More text.' }, now);
    const snapshot = JSON.stringify(room);
    const deps = { now: () => now, requestId: () => 'forbidden-request', mutate: async (_id, update) => { room = update(room); return room; }, interpret: () => assert.fail('recorded demo must never invoke the provider') };
    await assert.rejects(runAutomaticStudioReview(room.id, config, {}, deps), { code: 'MODEL_REPLAY_ONLY' });
    await assert.rejects(runAutomaticStudioReview(room.id, config, { simulation: true }, deps), { code: 'MODEL_REPLAY_ONLY' });
    await assert.rejects(runAutomaticStudioRepair(room.id, config, input, deps), { code: 'MODEL_REPLAY_ONLY' });
    assert.equal(JSON.stringify(room), snapshot);
    assert.equal(room.modelCallCount, 0);
  }
});
