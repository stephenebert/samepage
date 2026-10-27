#!/usr/bin/env node
// Read-only integrity and combined replay; the archived phase verifiers forbid fetch.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
globalThis.fetch = () => { throw new Error('Archive verification forbids network access.'); };
const dir = path.dirname(fileURLToPath(import.meta.url));
const read = async name => JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
const manifest = await read('evidence-manifest.json');
const seen = new Set();
for (const file of manifest.files) {
  assert.ok(!file.path.startsWith('/') && !file.path.split('/').includes('..'));
  assert.ok(!seen.has(file.path), 'Duplicate manifest path'); seen.add(file.path);
  const bytes = await fs.readFile(path.join(dir, file.path));
  assert.equal(bytes.length, file.bytes, file.path + ': bytes');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path + ': hash');
}
const replay = script => {
  const result = spawnSync(process.execPath, [path.join(dir, script)], { encoding: 'utf8', maxBuffer: 2_000_000 });
  assert.equal(result.status, 0, script + ': ' + result.stderr);
  return JSON.parse(result.stdout);
};
const medium = replay('verify-evidence.mjs');
const low = replay('low-expression/verify-evidence.mjs');
for (const [phase, expectedAttempts, expectedConcrete, expectedReceipts] of [[medium, 6, 244, 5], [low, 4, 160, 3]]) {
  assert.equal(phase.runStatus, 'passed');
  assert.equal(phase.reviewAttempts, expectedAttempts);
  assert.equal(phase.passedReviews, expectedAttempts);
  assert.equal(phase.qualityFailures, 0);
  assert.equal(phase.incompleteResponses, 0);
  assert.equal(phase.concreteChecks, expectedConcrete);
  assert.equal(phase.concreteFailures, 0);
  assert.equal(phase.unresolvedChecks, 2);
  assert.equal(phase.independentSourceChecks, 85184);
  assert.equal(phase.receipts, expectedReceipts);
  assert.equal(phase.networkCalls, 0); assert.equal(phase.filesWritten, 0);
  for (const stage of phase.stages) {
    assert.equal(stage.metrics.finishReason, 'stop');
    assert.equal(stage.metrics.maxCompletionTokens, 8192);
  }
}
assert.equal(low.combinedRequestAttempts, 10);
assert.ok(low.combinedConservativePreflightUsd < 1);
for (const prefix of ['', 'low-expression/']) {
  const report = await read(prefix + 'report.json');
  for (const stage of report.stages) {
    const review = await read(prefix + 'stages/' + stage.stageId + '/review-state.json');
    const final = await read(prefix + 'stages/' + stage.stageId + '/final-state.json');
    if (stage.stageId === 'fresh-pixel-loom-online-mini-course') assert.deepEqual(final, review);
    if (stage.stageId === 'expression-mosaic-corrected') {
      assert.deepEqual(final.registrations.map(x => [x.policyVersion, x.decision.feeCents]), [[2, 1600], [3, 0]]);
    }
  }
}
const shutdown = await read('activation-and-shutdown.json');
assert.equal(shutdown.liveEnabledAfterTest, false);
assert.equal(shutdown.runtimeMetadata.ready, false);
assert.equal(shutdown.runtimeMetadata.mode, 'disabled');
assert.equal(shutdown.runtimeMetadata.reasoningEffort, 'low');
assert.equal(shutdown.runtimeMetadata.protocol, 'expression-v3');
assert.equal(shutdown.runtimeMetadata.reuseUnchanged, false);
assert.equal(shutdown.runtimeMetadata.maxCompletionTokens, 8192);
let translations = 0;
for (const audit of ['audit/first-six-bilingual-audit.json', 'audit/low-expression-bilingual-audit.json']) {
  const result = await read(audit);
  assert.equal(result.substantiveFidelityPass, true); assert.equal(result.sourceCopiesExact, true);
  translations += result.translatedCandidateInstancesReviewed;
}
assert.equal(translations, 20);
const stages = [...medium.stages, ...low.stages];
const promptTokens = stages.reduce((n, stage) => n + stage.metrics.promptTokens, 0);
const completionTokens = stages.reduce((n, stage) => n + stage.metrics.completionTokens, 0);
assert.equal(promptTokens, 15090); assert.equal(completionTokens, 45758);
console.log(JSON.stringify({ status: 'archive-verified', verifiedFiles: manifest.files.length,
  reviewAttempts: 10, concreteChecks: 404, unresolvedChecks: 4, independentSourceChecks: 170368,
  savedRegistrations: 8, translatedInstancesReviewed: translations, promptTokens, completionTokens,
  uncachedTokenRateEstimateUsd: (promptTokens * 1.25 + completionTokens * 4.25) / 1e6,
  conservativeEstimatedMaxUsd: low.combinedConservativePreflightUsd,
  networkCalls: 0, filesWritten: 0, actualBilledCostUsd: null }, null, 2));
