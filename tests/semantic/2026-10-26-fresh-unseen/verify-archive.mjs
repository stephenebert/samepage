#!/usr/bin/env node
// Read-only archive integrity and semantic replay; no network or file writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
globalThis.fetch=()=>{throw Error('Archive verification forbids network access');};
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=async name=>JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=await read('evidence-manifest.json'),seen=new Set();
assert.equal(manifest.schemaVersion,1);
assert.deepEqual(manifest.excludedFiles,['evidence-manifest.json','archive-verification-result.json']);
async function listFiles(relative=''){
 const files=[];
 for(const item of await fs.readdir(path.join(dir,relative),{withFileTypes:true})){
  const child=path.posix.join(relative,item.name);assert.equal(item.isSymbolicLink(),false,'Archive symlink '+child);
  if(item.isDirectory())files.push(...await listFiles(child));else {assert.equal(item.isFile(),true,'Unsupported archive entry '+child);files.push(child);}
 }
 return files;
}
for(const file of manifest.files){
 assert.ok(!file.path.startsWith('/')&&!file.path.split('/').includes('..'));
 assert.ok(!seen.has(file.path),'Duplicate archive path');seen.add(file.path);
 const bytes=await fs.readFile(path.join(dir,file.path));
 assert.equal(bytes.length,file.bytes,file.path+': byte count');assert.equal(hash(bytes),file.sha256,file.path+': hash');
}
assert.deepEqual((await listFiles()).filter(name=>!manifest.excludedFiles.includes(name)).sort(),[...seen].sort(),'Unmanifested or absent evidence');
assert.equal(manifest.sourceCommit,'def141d7b93f12709db9b264d104584303ff4bf4');
assert.ok(seen.has('run-unseen.mjs')&&seen.has('verify-evidence.mjs')&&seen.has('verify-archive.mjs'));
assert.ok(seen.has('holdout/SHA256SUMS')&&seen.has('plan.freeze.json')&&seen.has('report.json'));
const result=spawnSync(process.execPath,[path.join(dir,'verify-evidence.mjs')],{encoding:'utf8',maxBuffer:2_000_000});
assert.equal(result.status,0,result.stderr);const verified=JSON.parse(result.stdout);
assert.deepEqual(verified,await read('evidence-verification-result.json'));
assert.equal(verified.runStatus,'passed');assert.equal(verified.modelRequests,3);
assert.equal(verified.passedStages,3);assert.equal(verified.failedStages,0);assert.equal(verified.naturalStops,3);
assert.equal(verified.concreteChecks,120);assert.equal(verified.concreteFailures,0);
assert.equal(verified.independentOracleChecks,185856);assert.equal(verified.independentOracleMismatches,0);
assert.equal(verified.blockedAuthoredRepairs,1);assert.equal(verified.publishedGeneratedRepairs,1);assert.equal(verified.receipts,2);
assert.equal(verified.promptTokens,6777);assert.equal(verified.completionTokens,6871);assert.equal(verified.usageComplete,true);
assert.ok(Math.abs(verified.uncachedTokenRateEstimateUsd-0.037673)<1e-12);assert.equal(verified.conservativeEstimatedMaxUsd,0.365568);
assert.equal(verified.actualBilledCostUsd,null);assert.equal(verified.networkCalls,0);assert.equal(verified.filesWritten,0);
const report=await read('report.json');assert.deepEqual(report.stages.map(s=>s.httpDurationMs),[10887,9094,7263]);
const audit=await read('audit/bilingual-review.json');assert.equal(audit.status,'pass-with-text-notes');assert.equal(audit.semanticFidelityPassed,true);
for(const [name,expected] of Object.entries(audit.evidenceSha256)){
 assert.ok(seen.has(name),'Audit references absent evidence '+name);
 assert.equal(hash(await fs.readFile(path.join(dir,name))),expected,'Audit evidence '+name);
}
assert.equal(audit.preflight.sourceCheckedOutcomes,120);assert.equal(audit.preflight.mismatches,0);
assert.equal(audit.liveEvidence.recordedConcreteChecks,120);assert.equal(audit.liveEvidence.recordedOracleChecks,185856);assert.equal(audit.liveEvidence.recordedOracleMismatches,0);
const shutdown=await read('activation-and-shutdown.json');
assert.equal(shutdown.sourceCommit,manifest.sourceCommit);assert.equal(shutdown.externalModelRequests,3);assert.equal(shutdown.studioMetaEnabled,false);
assert.equal(shutdown.deployment.status,'succeeded');assert.equal(shutdown.deployment.env_set_revision,21);
assert.equal(shutdown.deployment.id,'appgdep_6ae03f021b3c81919b42ec2796bacc90');
assert.equal(shutdown.sourceOrPromptChangesDuringRun,false);assert.equal(shutdown.modelRetries,0);
assert.equal(shutdown.verification.hostedBrowser.aliceTabVerified,true);assert.equal(shutdown.verification.hostedBrowser.bobTabVerified,true);
assert.equal(shutdown.verification.hostedBrowser.publishedVersion,3);assert.equal(shutdown.verification.hostedBrowser.bothApprovalsVisible,true);
assert.equal(shutdown.verification.hostedBrowser.preservedReceiptCount,2);assert.equal(shutdown.verification.hostedBrowser.beforeFeeCents,1850);assert.equal(shutdown.verification.hostedBrowser.afterFeeCents,3250);
for(const name of shutdown.verification.hostedBrowser.evidenceFiles)assert.ok(seen.has(name),'Browser evidence absent '+name);
console.log(JSON.stringify({status:'fresh-archive-verified',verifiedFiles:manifest.files.length,sourceCommit:manifest.sourceCommit,runStatus:verified.runStatus,modelRequests:3,concreteChecks:120,independentOracleChecks:185856,semanticMismatches:0,bilingualAudit:audit.status,blockedAuthoredRepairs:1,publishedGeneratedRepairs:1,receipts:2,beforeFeeCents:1850,afterFeeCents:3250,tokenRateEstimateUsd:verified.uncachedTokenRateEstimateUsd,conservativeEstimatedMaxUsd:0.365568,actualBilledCostUsd:null,studioLiveCallsPaused:true,networkCalls:0,filesWritten:0},null,2));
