// Local UI fixtures only. No provider calls, fetches, or deployed storage writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createStudioDemoRoom, applyStudioAction } from '../../samepage-live/lib/studio.ts';
import { studioDemoFixture } from '../../samepage-live/lib/studio-demo.ts';
import { startStudioRepair, completeStudioRepair, buildExpectedRepairRules } from '../../samepage-live/lib/studio-repair.ts';

const dir = path.dirname(fileURLToPath(import.meta.url));
const now = '2026-10-27T05:00:00.000Z';
const clone = value => JSON.parse(JSON.stringify(value));
globalThis.fetch = () => { throw new Error('Local UI fixtures prohibit network requests.'); };
const unsafeText = {
  en: 'Scholarship recipients of any age can participate in the optional screen-printing workshop free of charge, without guardian consent. All other participants must be at least 16 years old; those under 18 must also have guardian consent. There are no other admission requirements and no registration deadline. The fee for everyone without a scholarship is US$80. There are no other discounts. Charge a fee only if the participant is admitted.',
  es: 'Las personas con beca de cualquier edad pueden participar gratis en el taller optativo de serigrafía, sin consentimiento del tutor. Las demás personas deben tener al menos 16 años; quienes sean menores de 18 años también necesitan el consentimiento del tutor. No hay otros requisitos de admisión ni fecha límite de inscripción. La tarifa para las personas sin beca es de 80 dólares estadounidenses. No hay otros descuentos. Solo se cobra si la persona es admitida.',
};
function metadata(room) {
  room.mode = 'simulated-model'; room.modelCallCount = 0;
  room.automaticRepair = {
    requestId: `offline-${room.repair.id}`, jobId: room.repair.id, provider: 'Meta', model: 'offline-ui-fixture',
    protocol: 'expression-v3', reasoningEffort: 'low', source: 'simulation', status: 'completed',
    startedAt: now, leaseExpiresAt: '2026-10-27T05:01:30.000Z', finishedAt: now, durationMs: 0,
  };
  return room;
}
function blocked(id) {
  let room = createStudioDemoRoom(id, now, studioDemoFixture);
  const candidate = room.review.candidates.find(item => item.editor === 'alice');
  for (const editor of ['alice', 'bob']) room = applyStudioAction(room, { type: 'vote', editor, reviewId: room.review.id, candidateId: candidate.id }, now);
  room = applyStudioAction(room, {
    type: 'register', requestId: 'ui-before-scholarship', policyVersion: room.published.version,
    label: 'Offline QA adult scholarship attendee', age: 24, resident: false, student: false, member: false,
    guardianConsent: false, scholarship: true, submittedAt: '2030-06-01T12:00:00.000Z',
  }, now);
  const intent = { baselineCandidateId: candidate.id, scopeFlag: 'scholarship', feeCents: 0 };
  const unsafeRules = buildExpectedRepairRules(candidate.rules, intent);
  unsafeRules.eligibility = { op: 'any', args: [clone(candidate.rules.eligibility), { op: 'flag', field: 'scholarship', value: true }] };
  room = startStudioRepair(room, intent, now, 'repair-qa-unintended-admission', unsafeText);
  room = completeStudioRepair(room, room.repair.id, { ...unsafeText, rules: unsafeRules, issues: [] }, now);
  room = metadata(room);
  assert.equal(room.repair.status, 'blocked');
  assert.ok(room.repair.impact.verification.witnesses.some(item => !item.left.accepted && item.right.accepted));
  assert.equal(room.published.version, 2); assert.equal(room.registrations[0].decision.feeCents, 8000);
  assert.equal(room.modelCallCount, 0);
  return room;
}
const blockedRoom = blocked('studio-repair-qa-blocked');
let readyRoom = blocked('studio-repair-qa-ready');
const intent = clone(readyRoom.repair.job.intent);
const baseline = readyRoom.repair.job.baseline;
readyRoom = startStudioRepair(readyRoom, intent, now, 'repair-qa-focused-scholarship');
readyRoom = completeStudioRepair(readyRoom, readyRoom.repair.id, {
  en: studioDemoFixture.candidates[1].en, es: studioDemoFixture.candidates[1].es,
  rules: buildExpectedRepairRules(baseline.rules, intent), issues: [],
}, now);
readyRoom = metadata(readyRoom);
assert.equal(readyRoom.repair.status, 'ready'); assert.equal(readyRoom.repair.impact.status, 'pass');
assert.equal(readyRoom.repairHistory[0].status, 'blocked'); assert.deepEqual(readyRoom.repair.votes, {});
assert.equal(readyRoom.published.version, 2); assert.equal(readyRoom.registrations[0].decision.feeCents, 8000);
for (const room of [blockedRoom, readyRoom]) await fs.writeFile(path.join(dir, `${room.id}.json`), JSON.stringify(room, null, 2) + '\n');
console.log(JSON.stringify({ fixtureOnly: true, providerCalls: 0, rooms: [blockedRoom, readyRoom].map(room => ({ id: room.id, status: room.repair.status, publishedVersion: room.published.version, receipts: room.registrations.length, history: room.repairHistory?.length ?? 0 })) }, null, 2));
