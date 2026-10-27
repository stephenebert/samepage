#!/usr/bin/env node
// Read-only verification of this archived run. Never dispatches a network request.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { verifyFrozenInputs, checkQuality } from './run-live.mjs';
globalThis.fetch = () => { throw new Error('Archived evidence verification forbids network access.'); };
const dir = path.dirname(fileURLToPath(import.meta.url));
const read = async name => JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
const manifest = await read('evidence-manifest.json');
for (const file of manifest.files) {
  assert.ok(!file.path.startsWith('/') && !file.path.split('/').includes('..'));
  const bytes = await fs.readFile(path.join(dir, file.path));
  assert.equal(bytes.length, file.bytes, file.path + ': byte count');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path + ': hash');
}
const { corpus } = await verifyFrozenInputs();
const ledger = await read('live-ledger.json'), report = await read('report.json');
assert.equal(ledger.status, 'completed'); assert.equal(ledger.reviewPostAttempts.length, 4);
assert.equal(report.status, 'passed'); assert.equal(report.actualReviewPostAttempts, 4);
const responseFiles = await fs.readdir(path.join(dir, 'responses'));
let concreteChecks = 0, unresolvedChecks = 0;
for (const stage of corpus.stages) {
  const before = (await read('responses/' + responseFiles.find(name => name.endsWith(`-${stage.id}-saved-state.json`)))).json.room;
  const after = await read(`stages/${stage.id}/review-state.json`);
  const attempt = ledger.reviewPostAttempts.find(item => item.tag === stage.id + '-review');
  assert.equal(attempt.httpStatus, 200);
  const response = await read(attempt.responseEvidence);
  assert.deepEqual(response.json.room, after);
  assert.deepEqual(JSON.parse(response.rawText), response.json);
  const quality = checkQuality(stage, before, after);
  assert.ok(quality.passed, stage.id + ': ' + quality.failures.join('; '));
  for (const result of quality.scenarioResults) result.expected === null ? unresolvedChecks++ : concreteChecks++;
}
assert.equal(concreteChecks, 120); assert.equal(unresolvedChecks, 4);
assert.equal((await read('live-semantic-audit.json')).status, 'pass');
assert.equal((await read('activation-and-shutdown.json')).liveEnabledAfterTest, false);
console.log(JSON.stringify({ status: 'passed', mode: 'read-only-offline-verification-of-saved-live-outputs', verifiedFiles: manifest.files.length, archivedReviewRequests: 4, concreteChecks, unresolvedChecks, networkCalls: 0, filesWritten: 0, actualCostUsd: null }, null, 2));
