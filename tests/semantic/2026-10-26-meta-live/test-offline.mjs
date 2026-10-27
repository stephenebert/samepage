#!/usr/bin/env node
// Pure local oracle replay and guard checks. No provider or own-site request is made.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyFrozenInputs, preflightReport, checkQuality, assertModel, allowedPath, costForJob, siteHeaders } from './run-live.mjs';
globalThis.fetch = () => { throw new Error('OFFLINE TEST: NETWORK IS FORBIDDEN'); };
const DIR = path.dirname(fileURLToPath(import.meta.url));
const engine = await import('./evaluator/studio.ts');
const now = '2026-10-26T12:00:00.000Z';
const { corpus } = await verifyFrozenInputs();
const inputs = await verifyFrozenInputs();
const preflight = preflightReport(inputs);
let assertions = 0;
function check(condition, message) { assertions++; assert.ok(condition, message); }
function equal(actual, expected, message) { assertions++; assert.deepEqual(actual, expected, message); }
const report = { kind: 'offline-harness-only', liveExecuted: false, networkCalls: 0, actualReviewPostAttempts: 0, fabricatedResponses: true, testedAt: new Date().toISOString(), stages: [] };
let room;
for (const stage of corpus.stages) {
  if (!stage.reusePreviousRoom) room = engine.createStudioRoom(stage.id, now);
  const originalReceipts = structuredClone(room.registrations), originalPublished = structuredClone(room.published), originalReview = structuredClone(room.review);
  for (const editor of ['alice','bob']) room = engine.applyStudioAction(room, { type: 'draft', editor, baseVersion: room.drafts[editor].version, text: stage.drafts[editor] }, now);
  check(room.review === null && room.activeJob === null, `${stage.id}: drafts invalidate review`);
  equal(room.published, originalPublished, 'Draft save preserves publication');
  if (stage.reusePreviousRoom) {
    assertions++; assert.throws(() => engine.applyStudioAction(room, { type: 'vote', editor: 'alice', reviewId: originalReview.id, candidateId: originalReview.votes.alice }, now), error => error.code === 'STALE_REVIEW');
  }
  const before = structuredClone(room);
  room = engine.applyStudioAction(room, { type: 'requestReview' }, now);
  const job = room.activeJob;
  check(costForJob(job).estimatedMaxUsd <= preflight.stages.find(s => s.stageId === stage.id).estimatedMaxUsd, 'Runtime reconstruction fits padded budget');
  const candidates = ['alice','bob'].map(editor => ({ editor, sourceVersion: job.drafts[editor].version, en: stage.drafts.alice, es: stage.drafts.bob, rules: stage.evaluation.expectedRulesByEditor[editor], issues: stage.expected.candidateBlocked[editor] ? ['Clarify explicit fee priority for overlapping member, scholarship and student prices.'] : [] }));
  room = engine.applyStudioAction(room, { type: 'completeReview', response: { jobId: job.id, candidates } }, now);
  room.review.provenance = 'meta-model'; room.mode = 'automatic-model'; room.modelCallCount = (before.modelCallCount ?? 0) + 1;
  room.automaticReview = { source: 'meta', status: 'completed', provider: 'Meta', model: 'muse-spark-1.3' };
  const quality = checkQuality(stage, before, room);
  check(quality.passed, `${stage.id}: locally constructed oracle review passes its frozen expectations`);
  const spoofed = structuredClone(room); spoofed.review.candidates[0].id = spoofed.review.candidates[1].id;
  check(!checkQuality(stage, before, spoofed).passed, 'Mismapped candidate IDs fail closed');
  const simulation = structuredClone(room); simulation.review.provenance = 'simulated-model';
  check(!checkQuality(stage, before, simulation).passed, 'Simulation provenance fails live checks');
  if (stage.workflow.publishEditor === null) {
    const vague = structuredClone(room); vague.review.candidates[0].issues = ['Please clarify.'];
    check(!checkQuality(stage, before, vague).passed, 'Vague ambiguity question fails targeted topic check');
    assertions++; assert.throws(() => engine.applyStudioAction(room, { type: 'vote', editor: 'alice', reviewId: room.review.id, candidateId: room.review.candidates[0].id }, now), error => error.code === 'UNRESOLVED');
    equal(room.published, originalPublished, 'Ambiguity leaves publication unchanged');
    equal(room.review.votes, {}, 'Ambiguity leaves votes empty');
  } else {
    const incorrect = structuredClone(room); incorrect.review.candidates[0].rules.fee.defaultCents += 1;
    check(!checkQuality(stage, before, incorrect).passed, 'Wrong fee fails semantic oracle comparison before consent');
    const review = room.review, selected = review.candidates.find(c => c.editor === stage.workflow.publishEditor), other = review.candidates.find(c => c.editor !== stage.workflow.publishEditor);
    const vote = (editor, candidateId) => { room = engine.applyStudioAction(room, { type: 'vote', editor, reviewId: review.id, candidateId }, now); };
    vote('alice', selected.id); equal(room.published, originalPublished, 'One vote holds'); equal(room.review.votes, { alice: selected.id }, 'One vote recorded');
    vote('bob', other.id); equal(room.published, originalPublished, 'Split votes hold'); equal(room.review.votes, { alice: selected.id, bob: other.id }, 'Split votes recorded');
    vote('bob', selected.id); check(room.published.version === originalPublished.version + 1, 'Matching votes publish once'); equal(room.review.votes, { alice: selected.id, bob: selected.id }, 'Matching votes recorded');
    check(room.published.reviewId === review.id && room.published.candidateId === selected.id, 'Published identity binds approved candidate');
    if (stage.workflow.receiptScenarioId) {
      const scenario = stage.scenarios.find(s => s.id === stage.workflow.receiptScenarioId);
      room = engine.applyStudioAction(room, { type: 'register', requestId: `offline-${stage.id}`, policyVersion: room.published.version, label: 'Offline synthetic fixture receipt', ...scenario.attendee }, now);
      const receipt = room.registrations.at(-1);
      equal({ accepted: receipt.decision.accepted, feeCents: receipt.decision.feeCents }, scenario.expected[stage.workflow.publishEditor], 'Published receipt obeys frozen expected outcome');
      equal(room.registrations.slice(0, originalReceipts.length), originalReceipts, 'Original receipt immutable');
      if (stage.reusePreviousRoom) check(originalReceipts.at(-1).decision.feeCents === 1725 && receipt.decision.feeCents === 0 && receipt.policyVersion > originalReceipts.at(-1).policyVersion, 'Correction changes price only in new receipt version');
    }
  }
  report.stages.push({ id: stage.id, offlineOracleReplayPassed: quality.passed, frozenScenarioComparisons: quality.scenarioResults.length, semanticOracleChecks: quality.semanticOracleChecks.length, discoveredWitnessIds: quality.discovery.witnesses.map(w => w.id) });
}
assertModel({ provider: 'Meta', model: 'muse-spark-1.3', ready: true, mode: 'automatic' }); assertions++;
for (const patch of [{ model: 'wrong-model' }, { mode: 'unconfigured' }, { ready: false }, { provider: 'Other' }]) { assertions++; assert.throws(() => assertModel({ provider: 'Meta', model: 'muse-spark-1.3', ready: true, mode: 'automatic', ...patch })); }
check(allowedPath('/api/studio', 'POST'), 'Own-site room creation allowed');
check(allowedPath('/api/studio/studio-valid-id/review', 'POST'), 'Own-site review allowed');
for (const route of ['https://api.meta.ai/v1/chat/completions','/api/studio?x=1','//evil.example/api/studio','/api/studio/../provider','/api/consequences']) check(!allowedPath(route, 'POST'), 'Other paths rejected');
const headers = siteHeaders('offline-placeholder', true);
equal(headers, { Origin: 'https://samepage-language-lab.ampleboar17.chatgpt.site', 'OAI-Sites-Authorization': 'Bearer offline-placeholder', 'Content-Type': 'application/json' }, 'Mutations carry required own-site Origin and service-only auth header');
check(!('Authorization' in headers), 'No provider Authorization header exists');
report.assertions = assertions; report.status = 'passed'; report.conservativeEstimatedMaxUsd = preflight.estimatedMaxUsd;
report.limitations = ['Oracle responses in this test were locally fabricated and prove no model performance.', 'The test exercises local evaluation and state-machine guards. It does not prove hosted runtime or billing behavior.', 'No network dispatch occurred.'];
await fs.writeFile(path.join(DIR, 'offline-test-report.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
