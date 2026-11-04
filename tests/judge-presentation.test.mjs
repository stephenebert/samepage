import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioLiveDemoRoom } from '../lib/studio-live-demo.ts';
import { applyStudioAction } from '../lib/studio.ts';
import { startStudioRepair, completeStudioRepair } from '../lib/studio-repair.ts';
import { recordedJudgeReview, recordedJudgeRepair } from '../lib/judge-recorded.ts';
import { getStudioExample } from '../lib/studio-example-inputs.ts';
import { evaluateStudioPolicy } from '../lib/studio-engine.ts';
import { judgeStage, judgeInitialWitness, judgeRepairWitness, judgeFormAttendee } from '../app/judge-presentation.ts';

const now = '2026-10-30T22:00:00.000Z';
const example = getStudioExample('interaction');
function reviewedRoom() {
  let room = createStudioLiveDemoRoom('judge-presentation', now, 'interaction');
  room = applyStudioAction(room, { type: 'requestReview' }, now);
  return applyStudioAction(room, { type: 'completeReview', response: recordedJudgeReview(room.activeJob) }, now);
}
function agreedRoom() {
  let room = reviewedRoom();
  const candidateId = room.review.candidates.find(c => c.editor === 'alice').id;
  for (const editor of ['alice', 'bob']) room = applyStudioAction(room, { type: 'vote', editor, reviewId: room.review.id, candidateId }, now);
  return room;
}
function checkedRoom() {
  const room = agreedRoom();
  const intent = { ...example.intent, baselineCandidateId: room.review.candidates.find(c => c.editor === 'alice').id };
  const started = startStudioRepair(room, intent, now, 'unsafe', example.unsafeProposal);
  return completeStudioRepair(started, 'unsafe', recordedJudgeRepair(started.repair.job), now);
}

test('judge stages require the complete review, both baseline votes, checked repair, and both repair votes', () => {
  assert.equal(judgeStage(createStudioLiveDemoRoom('fresh', now, 'interaction')), 'compare');
  let room = reviewedRoom();
  assert.equal(judgeStage(room), 'baseline');
  assert.ok(judgeInitialWitness(room));
  const candidateId = room.review.candidates.find(c => c.editor === 'alice').id;
  room = applyStudioAction(room, { type: 'vote', editor: 'alice', reviewId: room.review.id, candidateId }, now);
  assert.equal(judgeStage(room), 'baseline');
  room = applyStudioAction(room, { type: 'vote', editor: 'bob', reviewId: room.review.id, candidateId }, now);
  assert.equal(judgeStage(room), 'rewrite');
  room = checkedRoom(); assert.equal(judgeStage(room), 'blocked');
  const prepared = startStudioRepair(room, room.repair.job.intent, now, 'corrected');
  room = completeStudioRepair(prepared, 'corrected', recordedJudgeRepair(prepared.repair.job), now);
  assert.equal(judgeStage(room), 'approve');
  room = applyStudioAction(room, { type: 'voteRepair', editor: 'alice', repairId: room.repair.id }, now);
  assert.equal(judgeStage(room), 'approve'); assert.equal(room.published.version, 2);
  room = applyStudioAction(room, { type: 'voteRepair', editor: 'bob', repairId: room.repair.id }, now);
  assert.equal(judgeStage(room), 'form'); assert.equal(room.published.version, 3);
});

test('the actual discovered blocked attendee stays identical through repair and the form', () => {
  let room = checkedRoom();
  const found = judgeRepairWitness(room.repair), initial = judgeFormAttendee(room);
  assert.deepEqual(initial, found.attendee);
  assert.equal(found.left.accepted, true); assert.equal(found.right.accepted, false);
  assert.equal(initial.resident, true); assert.equal(initial.member, true); assert.equal(initial.student, false);
  const prepared = startStudioRepair(room, room.repair.job.intent, now, 'corrected');
  room = completeStudioRepair(prepared, 'corrected', recordedJudgeRepair(prepared.repair.job), now);
  assert.deepEqual(judgeFormAttendee(room), initial);
  for (const editor of ['alice', 'bob']) room = applyStudioAction(room, { type: 'voteRepair', editor, repairId: room.repair.id }, now);
  assert.deepEqual(judgeFormAttendee(room), initial);
  assert.equal(evaluateStudioPolicy(room.published.rules, initial).accepted, true);
  assert.equal(evaluateStudioPolicy(room.published.rules, { ...initial, member: false }).accepted, true);
  assert.equal(evaluateStudioPolicy(room.published.rules, { ...initial, resident: false, member: false }).accepted, false);
});

test('an unresolved or failed result never presents the approval stage', () => {
  const room = reviewedRoom();
  room.review.discovery.status = 'unresolved';
  assert.equal(judgeStage(room), 'unresolved');
  const blocked = checkedRoom(); blocked.repair.impact.status = 'unresolved';
  assert.equal(judgeStage(blocked), 'unresolved');
  blocked.repair.status = 'failed';
  assert.equal(judgeStage(blocked), 'unresolved');
});
