#!/usr/bin/env node
// Saved-evidence verification only: no fetches, provider calls, retries or writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {verifyFrozenInputs,checkQuality,preflightReport,providerBody} from './run-low-expression.mjs';
globalThis.fetch=()=>{throw Error('Archived verification forbids network access.');};
const D=path.dirname(fileURLToPath(import.meta.url));
const read=async name=>JSON.parse(await fs.readFile(path.join(D,name),'utf8'));
const inputs=await verifyFrozenInputs(),preflight=preflightReport(inputs);
const report=await read('report.json'),ledger=await read('live-ledger.json');
assert.equal(report.corpusSha256,inputs.freeze.sha256);assert.equal(ledger.corpusSha256,inputs.freeze.sha256);
assert.ok(ledger.reviewPostAttempts.length<=4);assert.equal(report.actualReviewPostAttempts,ledger.reviewPostAttempts.length);
assert.ok(['passed','stopped-fail-closed'].includes(report.status),'Run still in progress.');
assert.equal(ledger.status,report.status==='passed'?'completed':report.status);
assert.ok(preflight.estimatedMaxUsd<=1);
const names=await fs.readdir(path.join(D,'responses'));
async function responseFor(suffix){const name=names.find(n=>n.endsWith('-'+suffix+'.json'));assert.ok(name,suffix);const r=await read('responses/'+name);assert.deepEqual(JSON.parse(r.rawText),r.json);return r;}
let passedReviews=0,qualityFailures=0,incompleteResponses=0,concreteChecks=0,concreteFailures=0,unresolvedChecks=0,independentSourceChecks=0,receipts=0;
const summaries=[];
const seen=new Set();
for(const [i,attempt] of ledger.reviewPostAttempts.entries()){
 assert.equal(attempt.sequence,i+1);assert.ok(!seen.has(attempt.tag));seen.add(attempt.tag);
 const id=attempt.tag.replace(/-review$/,''),stage=inputs.corpus.stages.find(s=>s.id===id);assert.ok(stage);
 assert.equal(stage.id,inputs.corpus.stages[i].id,'Attempt order changed.');
 const before=(await responseFor(id+'-saved-state')).json.room,response=await read(attempt.responseEvidence);
 assert.equal(response.status,attempt.httpStatus);assert.deepEqual(JSON.parse(response.rawText),response.json);
 const after=response.json.room;assert.ok(after);assert.equal(after.modelCallCount,(before.modelCallCount??0)+1);
 assert.deepEqual(after.published,before.published);assert.deepEqual(after.registrations,before.registrations);
 const auto=after.automaticReview;assert.equal(auto.source,'meta');assert.equal(auto.protocol,stage.protocol);assert.equal(auto.reasoningEffort,'low');
 assert.deepEqual(auto.requestedEditors,stage.expectedRequestedEditors);assert.deepEqual(auto.reusedEditors,stage.expectedReusedEditors);
 const estimate=await read(`stages/${id}/request-estimate.json`),maxTokens=estimate.providerRequestBody.max_completion_tokens;
 assert.equal(maxTokens,8192);
 const engine=await import('./evaluator/studio.ts');const job=engine.applyStudioAction(before,{type:'requestReview'},'2026-10-26T12:00:00.000Z').activeJob;
 assert.deepEqual(estimate.providerRequestBody,providerBody(job,stage.protocol,before.interpretationCache,maxTokens));
 if(auto.metrics){assert.equal(auto.metrics.requestBytes,estimate.inputWireBytes);assert.equal(auto.metrics.maxCompletionTokens,maxTokens);}
 const summary={stageId:id,httpStatus:response.status,httpDurationMs:response.durationMs,metrics:auto.metrics??null,status:null};
 if(!response.ok){
  incompleteResponses++;assert.equal(auto.status,'failed');assert.equal(after.review,null);
  assert.ok(!names.some(n=>n.includes(id+'-one-vote')||n.includes(id+'-matching-votes')||n.includes(id+'-register')));
  assert.deepEqual(after.interpretationCache,before.interpretationCache);
  assert.equal(report.status,'stopped-fail-closed');assert.equal(i,ledger.reviewPostAttempts.length-1);summary.status='failed-closed';
  summaries.push(summary);continue;
 }
 assert.equal(auto.status,'completed');assert.equal(auto.metrics?.finishReason,'stop');
 const quality=checkQuality(stage,before,after);assert.deepEqual(quality,await read(`stages/${id}/quality.json`));
 for(const c of quality.scenarioResults){if(c.expected===null)unresolvedChecks++;else{concreteChecks++;if(!c.passed)concreteFailures++;}}
 independentSourceChecks+=quality.semanticOracleChecks.filter(c=>c.kind==='independent-source-oracle').reduce((n,c)=>n+c.checkedCases,0);
 if(!quality.passed){qualityFailures++;assert.equal(report.status,'stopped-fail-closed');assert.equal(i,ledger.reviewPostAttempts.length-1);assert.ok(!names.some(n=>n.includes(id+'-one-vote')||n.includes(id+'-matching-votes')||n.includes(id+'-register')));summary.status='quality-failed';summaries.push(summary);continue;}
 passedReviews++;summary.status='passed';
 if(stage.workflow.publishEditor===null){const rejected=await responseFor(id+'-blocked-vote');assert.equal(rejected.status,400);assert.equal(rejected.json.code,'UNRESOLVED');assert.deepEqual((await responseFor(id+'-after-blocked-vote')).json.room,after);}
 else{
  const target=after.review.candidates.find(c=>c.editor===stage.workflow.publishEditor),other=after.review.candidates.find(c=>c.editor!==stage.workflow.publishEditor);
  const one=(await responseFor(id+'-one-vote')).json.room,split=(await responseFor(id+'-split-votes')).json.room,published=(await responseFor(id+'-matching-votes')).json.room;
  assert.deepEqual(one.published,before.published);assert.deepEqual(split.published,before.published);
  assert.deepEqual(one.review.votes,{alice:target.id});assert.deepEqual(split.review.votes,{alice:target.id,bob:other.id});assert.deepEqual(published.review.votes,{alice:target.id,bob:target.id});
  assert.equal(published.published.version,before.published.version+1);assert.deepEqual(published.published.rules,target.rules);assert.deepEqual(published.registrations,before.registrations);
  if(stage.workflow.receiptScenarioId){const registered=(await responseFor(id+'-register')).json.room,receipt=registered.registrations.at(-1),scenario=stage.scenarios.find(s=>s.id===stage.workflow.receiptScenarioId);receipts++;
   assert.equal(receipt.policyVersion,published.published.version);assert.deepEqual({accepted:receipt.decision.accepted,feeCents:receipt.decision.feeCents},scenario.expected[stage.workflow.publishEditor]);assert.deepEqual(registered.registrations.slice(0,-1),before.registrations);}
 }
 if(stage.reusePreviousRoom){const stale=await responseFor(id+'-stale-vote');assert.equal(stale.status,409);assert.equal(stale.json.code,'STALE_REVIEW');assert.deepEqual((await responseFor(id+'-after-stale-vote')).json.room,before);}
 summaries.push(summary);
}
if(report.status==='passed'){assert.equal(ledger.reviewPostAttempts.length,4);assert.equal(passedReviews,4);assert.equal(qualityFailures,0);assert.equal(concreteFailures,0);assert.equal(concreteChecks,160);assert.equal(unresolvedChecks,2);assert.ok(independentSourceChecks>=85184);}
console.log(JSON.stringify({status:'saved-evidence-verified',runStatus:report.status,reviewAttempts:ledger.reviewPostAttempts.length,passedReviews,qualityFailures,incompleteResponses,concreteChecks,concreteFailures,unresolvedChecks,independentSourceChecks,receipts,conservativePreflightUsd:preflight.estimatedMaxUsd,combinedRequestAttempts:6+ledger.reviewPostAttempts.length,combinedConservativePreflightUsd:preflight.combinedConservativeEstimatedMaxUsd,actualBilledCostUsd:null,networkCalls:0,filesWritten:0,stages:summaries},null,2));
