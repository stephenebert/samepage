#!/usr/bin/env node
// Read-only archive replay. The original generated repair remains a failure.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
globalThis.fetch = () => { throw Error('Archive verification forbids network access'); };
const dir = path.dirname(fileURLToPath(import.meta.url));
const read = async name => JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
const manifest = await read('evidence-manifest.json'), paths = new Set();
for (const item of manifest.files) {
  assert.ok(!item.path.startsWith('/') && !item.path.split('/').includes('..'));
  assert.ok(!paths.has(item.path), 'Duplicate manifest path'); paths.add(item.path);
  const bytes = await fs.readFile(path.join(dir, item.path));
  assert.equal(bytes.length, item.bytes, item.path + ': byte count');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path + ': hash');
}
function replay(script) {
  const result = spawnSync(process.execPath, [path.join(dir, script)], {encoding:'utf8',maxBuffer:2_000_000});
  assert.equal(result.status, 0, script + ': ' + result.stderr);
  return JSON.parse(result.stdout);
}
// Do not use the original success-only verifier: the retained run is not a pass.
const original = replay('audit/audit-stopped-run.mjs');
assert.deepEqual(original, await read('audit/stopped-run-rule-audit.json'));
assert.equal(original.runPassed, false);
assert.equal(original.modelRequests, 3);
assert.equal(original.completedNaturalStop, 3);
assert.equal(original.concreteChecks, 112);
assert.equal(original.concreteFailures, 6);
assert.equal(original.oracleChecks, 77440);
assert.equal(original.oracleMismatches, 3212);
assert.equal(original.generatedRepairCorrect, false);
assert.equal(original.generatedRepairSafelyBlocked, true);
assert.equal(original.publishedVersion, 2);
assert.equal(original.originalReceiptCents, 2100);
assert.equal(original.networkCalls, 0); assert.equal(original.filesWritten, 0);

const extension = replay('extension/verify-evidence.mjs');
assert.deepEqual(extension, await read('audit/extension-verification-result.json'));
assert.equal(extension.runStatus, 'passed');
assert.equal(extension.extensionRequests, 3);
assert.equal(extension.combinedRequests, 6);
assert.equal(extension.passedStages, 3);
assert.equal(extension.concreteChecks, 112);
assert.equal(extension.oracleChecks, 112288);
assert.equal(extension.publishedRepairs, 2);
assert.equal(extension.receipts, 4);
assert.equal(extension.originalRunPassed, false);
assert.equal(extension.knownFailureRetested, true);
assert.equal(extension.freshOrbitSuppliedRewriteNotTested, true);
assert.equal(extension.networkCalls, 0); assert.equal(extension.filesWritten, 0);

const oldAudit = await read('audit/stopped-run-bilingual-audit.json');
const newAudit = await read('audit/extension-bilingual-audit.json');
assert.equal(oldAudit.sourceCopiesExact, true);
assert.equal(oldAudit.bilingualMeaningAligned, true);
assert.equal(oldAudit.generatedRepairIntentSatisfied, false);
assert.equal(oldAudit.publicationGateHeld, true);
assert.equal(newAudit.sourceCopiesExact, true);
assert.equal(newAudit.substantiveFidelityPass, true);
assert.equal(newAudit.generatedIntentSatisfied, true);
const languageInstances = oldAudit.reviewedGeneratedLanguageInstances + newAudit.generatedLanguageInstancesReviewed;
assert.equal(languageInstances, 10);
assert.equal(oldAudit.reviewedCopiedRewriteLanguageInstances, 2);
const combined = await read('audit/combined-analysis.json');
assert.equal(combined.originalRunPassed, false);
assert.equal(combined.extensionPassed, true);
assert.equal(combined.modelRequests, 6);
assert.equal(combined.concreteChecks, original.concreteChecks + extension.concreteChecks);
assert.equal(combined.concreteIntentFailures, original.concreteFailures);
assert.equal(combined.concreteMatches, 218);
assert.equal(combined.independentOracleChecks, original.oracleChecks + extension.oracleChecks);
assert.equal(combined.independentOracleIntentMismatches, original.oracleMismatches);
const promptTokens = original.promptTokens + extension.promptTokens;
const completionTokens = original.completionTokens + extension.completionTokens;
assert.equal(promptTokens, 10114); assert.equal(completionTokens, 12649);
for (const stage of combined.stages) assert.equal(stage.finishReason, 'stop');
const estimate = (promptTokens * 1.25 + completionTokens * 4.25) / 1e6;
assert.ok(Math.abs(estimate - 0.06640075) < 1e-12);
assert.equal(extension.combinedConservativeEstimatedMaxUsd, 0.731136);
assert.ok(extension.combinedConservativeEstimatedMaxUsd < 1);

const shutdown = await read('activation-and-shutdown.json');
assert.equal(shutdown.sourceCommit, 'd5c94fdc0fe17b95cbc88691a6b98db45a6ec9e8');
assert.equal(shutdown.deployment.status, 'succeeded');
assert.equal(shutdown.deployment.env_set_revision, 19);
assert.equal(shutdown.studioMetaEnabled, false);
assert.equal(shutdown.configuration.protocol, 'expression-v3');
assert.equal(shutdown.configuration.reasoningEffort, 'low');
assert.equal(shutdown.configuration.reuseUnchanged, false);
assert.equal(shutdown.configuration.maxCompletionTokens, 8192);
assert.equal(shutdown.externalModelRequests, 6);
assert.equal(shutdown.verification.localTests, 156);
assert.equal(shutdown.verification.hostedBrowser.publishedVersion, 3);
assert.equal(shutdown.verification.hostedBrowser.blockedPriorGeneratedRepairVisible, true);
console.log(JSON.stringify({status:'repair-archive-verified',verifiedFiles:manifest.files.length,
  modelRequests:6,originalRunPassed:false,originalGeneratedRepairCorrect:false,originalGeneratedRepairSafelyBlocked:true,
  extensionPassed:true,knownFailureRetested:true,freshOrbitSuppliedRewriteNotTested:true,
  concreteChecks:224,concreteMatches:218,originalIntentFailures:6,independentOracleChecks:189728,originalOracleIntentMismatches:3212,
  safeRepairsPublished:2,preservedAndNewReceipts:4,generatedLanguageInstancesReviewed:languageInstances,copiedRewriteLanguageInstancesReviewed:2,
  promptTokens,completionTokens,tokenRateEstimateUsd:estimate,conservativeEstimatedMaxUsd:0.731136,
  studioLiveCallsPaused:true,actualBilledCostUsd:null,networkCalls:0,filesWritten:0},null,2));
