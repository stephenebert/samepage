#!/usr/bin/env node
// Read-only verification of saved successes AND failures. No provider requests.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as medium from './run-evaluation.mjs';
import * as low from './low-effort/run-low.mjs';
import * as reuse from './unchanged-reuse/run-reuse.mjs';
globalThis.fetch = () => { throw new Error('Archived verification forbids network access.'); };
const dir = path.dirname(fileURLToPath(import.meta.url));
const read = async name => JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
const manifest = await read('evidence-manifest.json');
for (const file of manifest.files) {
  assert.ok(!file.path.startsWith('/') && !file.path.split('/').includes('..'));
  const bytes = await fs.readFile(path.join(dir, file.path));
  assert.equal(bytes.length, file.bytes, file.path + ': byte count');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path + ': hash');
}
let attempts = 0, structuredReviews = 0, concreteChecks = 0, concreteFailures = 0, unresolvedChecks = 0, passedReviews = 0;
for (const [prefix, runner, expectedAttempts, expectedStatus] of [
  ['', medium, 8, 'passed'], ['low-effort/', low, 2, 'stopped-fail-closed'], ['unchanged-reuse/', reuse, 2, 'stopped-fail-closed'],
]) {
  const { corpus } = await runner.verifyFrozenInputs();
  const ledger = await read(prefix + 'live-ledger.json'), report = await read(prefix + 'report.json');
  assert.equal(report.status, expectedStatus); assert.equal(report.actualReviewPostAttempts, expectedAttempts);
  assert.equal(ledger.reviewPostAttempts.length, expectedAttempts);
  assert.equal(ledger.status, expectedStatus === 'passed' ? 'completed' : expectedStatus);
  const responseFiles = await fs.readdir(path.join(dir, prefix, 'responses'));
  const responseFor = async suffix => {
    const filename = responseFiles.find(name => name.endsWith('-' + suffix + '.json'));
    assert.ok(filename, prefix + suffix); return read(prefix + 'responses/' + filename);
  };
  for (const attempt of ledger.reviewPostAttempts) {
    attempts++;
    const id = attempt.tag.replace(/-review$/, ''), stage = corpus.stages.find(s => s.id === id);
    assert.ok(stage, id);
    const before = (await responseFor(id + '-saved-state')).json.room;
    const response = await read(prefix + attempt.responseEvidence), after = response.json.room;
    assert.equal(response.status, attempt.httpStatus); assert.deepEqual(JSON.parse(response.rawText), response.json);
    assert.deepEqual(after.published, before.published); assert.deepEqual(after.registrations, before.registrations);
    assert.equal(after.modelCallCount, (before.modelCallCount ?? 0) + 1);
    if (attempt.httpStatus !== 200) {
      assert.equal(prefix, 'unchanged-reuse/'); assert.equal(id, 'mosaic-corrected'); assert.equal(attempt.httpStatus, 502);
      assert.equal(after.review, null); assert.equal(after.automaticReview.status, 'failed');
      assert.equal(after.automaticReview.error.code, 'MODEL_RESPONSE_INVALID');
      assert.deepEqual(after.automaticReview.requestedEditors, ['alice']); assert.deepEqual(after.automaticReview.reusedEditors, ['bob']);
      assert.equal(after.published.version, 2); assert.equal(after.registrations.length, 1);
      assert.equal(after.registrations[0].decision.feeCents, 1600);
      assert.equal(after.automaticReview.metrics, undefined, 'Historical failed response had no retained numeric counters');
      assert.ok(!responseFiles.some(name => name.includes(id + '-matching-votes') || name.includes(id + '-register')));
      continue;
    }
    structuredReviews++;
    assert.deepEqual(after, await read(prefix + `stages/${id}/review-state.json`));
    const quality = runner.checkQuality(stage, before, after);
    assert.deepEqual(quality, await read(prefix + `stages/${id}/quality.json`));
    for (const scenario of quality.scenarioResults) {
      if (scenario.expected === null) unresolvedChecks++;
      else { concreteChecks++; if (!scenario.passed) concreteFailures++; }
    }
    const expectedFailure = prefix === 'low-effort/' && id === 'mosaic-priority';
    assert.equal(quality.passed, !expectedFailure, prefix + id);
    if (expectedFailure) {
      assert.equal(quality.scenarioResults.filter(s => !s.passed).length, 8);
      assert.deepEqual(after.review.votes, {}); assert.equal(after.published.version, 1);
      assert.ok(!responseFiles.some(name => name.includes(id + '-one-vote') || name.includes(id + '-matching-votes') || name.includes(id + '-register')));
      continue;
    }
    passedReviews++;
    if (after.review.discovery.status === 'unresolved') {
      assert.deepEqual((await responseFor(id + '-after-blocked-vote')).json.room.published, before.published);
    } else {
      for (const tag of ['one-vote', 'split-votes']) assert.deepEqual((await responseFor(id + '-' + tag)).json.room.published, before.published);
      assert.equal((await responseFor(id + '-matching-votes')).json.room.published.version, before.published.version + 1);
    }
  }
}
assert.equal(attempts, 12); assert.equal(structuredReviews, 11); assert.equal(passedReviews, 10);
assert.equal(concreteChecks, 400); assert.equal(concreteFailures, 8); assert.equal(unresolvedChecks, 8);
assert.equal((await read('live-output-audit.json')).status, 'pass');
assert.equal((await read('low-effort/live-output-audit.json')).status, 'failed');
assert.equal((await read('unchanged-reuse/live-output-audit.json')).status, 'stopped-fail-closed');
const shutdown = await read('activation-and-shutdown.json');
assert.equal(shutdown.liveEnabledAfterTest, false); assert.equal(shutdown.reasoningEffort, 'medium'); assert.equal(shutdown.reuseUnchanged, false);
assert.equal(shutdown.runtimeMetadata.ready, false); assert.equal(shutdown.runtimeMetadata.mode, 'disabled');
console.log(JSON.stringify({ status: 'verified-including-expected-experiment-failures', verifiedFiles: manifest.files.length,
  reviewAttempts: attempts, structuredReviews, passedReviews, concreteChecks, concreteFailures, unresolvedChecks,
  speedupDemonstrated: false, networkCalls: 0, filesWritten: 0, actualBilledCostUsd: null }, null, 2));
