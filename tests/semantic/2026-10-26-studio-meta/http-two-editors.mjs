import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

// Local application integration only. No Meta requests or credentials.
const base = 'http://127.0.0.1:5173';
const checks = [];
async function api(path, body) {
  assert.ok(path.startsWith('/api/studio'));
  const response = await fetch(base + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
const created = await api('/api/studio', { simulation: true });
assert.equal(created.status, 201);
assert.equal(created.data.model.mode, 'disabled');
assert.equal(created.data.model.ready, false);
let room = created.data.room;
const path = '/api/studio/' + room.id;
const initial = structuredClone(room);
async function action(body) {
  const result = await api(path, body);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  room = result.data.room; return room;
}
async function review() {
  const result = await api(path + '/review', { simulation: true });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  room = result.data.room;
  assert.equal(room.review.provenance, 'simulated-model');
  assert.equal(room.modelCallCount, 0);
  assert.equal(result.data.automatic.status, 'completed');
}
async function vote(editor, target) {
  await action({ type: 'vote', editor, reviewId: room.review.id, candidateId: room.review.candidates.find(c => c.editor === target).id });
}
const disabled = await api(path + '/review', {});
assert.equal(disabled.status, 403);
assert.equal(disabled.data.code, 'MODEL_DISABLED');
assert.deepEqual((await api(path)).data.room, initial);
checks.push('Live review disabled: rejected without changing room');

await review();
assert.equal(room.review.discovery.status, 'different');
assert.ok(room.review.discovery.witnesses.some(w => w.kind === 'price-only' && Math.abs(w.feeDeltaCents) === 8000));
assert.deepEqual(room.review.votes, {});
await vote('alice', 'alice'); assert.equal(room.published.version, 1);
await vote('bob', 'alice'); assert.equal(room.published.version, 2);
const attendee = { age: 24, resident: false, student: false, member: false, guardianConsent: false, scholarship: true, submittedAt: '2026-10-30T12:00:00.000Z' };
async function register(requestId) {
  await action({ type: 'register', requestId, policyVersion: room.published.version, label: 'Synthetic adult scholarship attendee', ...attendee });
}
await register('before-correction');
const firstReceipt = structuredClone(room.registrations.at(-1));
assert.equal(firstReceipt.decision.feeCents, 8000);
checks.push('Simulated adapter → discovered $80 fee difference → two approvals → v2 receipt at $80');

// Independent editor clients save concurrently, using their own observed draft versions.
const aliceSnapshot = structuredClone(room.drafts.alice), bobSnapshot = structuredClone(room.drafts.bob);
const saves = await Promise.all([
  api(path, { type: 'draft', editor: 'alice', baseVersion: aliceSnapshot.version, text: aliceSnapshot.text + '\nClarification requested.' }),
  api(path, { type: 'draft', editor: 'bob', baseVersion: bobSnapshot.version, text: bobSnapshot.text + '\nSe solicita una aclaración.' }),
]);
assert.ok(saves.every(r => r.status === 200));
room = (await api(path)).data.room;
assert.equal(room.drafts.alice.version, aliceSnapshot.version + 1);
assert.equal(room.drafts.bob.version, bobSnapshot.version + 1);
assert.equal(room.review, null);
assert.equal(room.published.version, 2);
const altered = structuredClone(room);
const unsupported = await api(path + '/review', { simulation: true });
assert.equal(unsupported.status, 409);
assert.equal(unsupported.data.code, 'MODEL_SIMULATION_UNAVAILABLE');
assert.deepEqual((await api(path)).data.room, altered);
checks.push('Concurrent editor saves preserved; simulation refused unfamiliar wording without pretending to interpret it');

// Restore the known fixture to exercise a second review; this is not a semantic evaluation.
await Promise.all(['alice', 'bob'].map(editor => api(path, { type: 'draft', editor, baseVersion: altered.drafts[editor].version, text: initial.drafts[editor].text })));
room = (await api(path)).data.room;
await review();
await vote('alice', 'bob'); assert.equal(room.published.version, 2);
await register('one-approval'); assert.equal(room.registrations.at(-1).decision.feeCents, 8000);
await vote('bob', 'alice'); assert.equal(room.published.version, 2);
assert.notEqual(room.review.votes.alice, room.review.votes.bob);
await vote('bob', 'bob'); assert.equal(room.published.version, 3);
await register('after-correction');
assert.equal(room.registrations.at(-1).decision.feeCents, 0);
assert.deepEqual(room.registrations[0], firstReceipt);
assert.equal(room.modelCallCount, 0);
checks.push('One approval and split approvals held v2/$80; joint agreement published v3/$0; old receipts unchanged');

const report = { date: '2026-10-26', scope: 'Local HTTP integration with two simulated editor clients; controlled model responses, not a live Meta evaluation', roomId: room.id, modelCalls: 0, finalVersion: room.published.version, fees: room.registrations.map(r => ({ policyVersion: r.policyVersion, feeCents: r.decision.feeCents })), checks };
await writeFile(new URL('./http-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
