// Read-only audit of the original stopped three-request evaluation.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyFrozenInputs,preflightReport,checkMetadata,qualityFor,read} from '../run-repair.mjs';
import {checkRulesAgainstSource,independentRuleOutcome} from '../holdout/independent-oracle.mjs';
globalThis.fetch=()=>{throw Error('Audit forbids network calls');};
const inputs=await verifyFrozenInputs(),report=await read('report.json'),ledger=await read('live-ledger.json');
assert.equal(report.status,'stopped-fail-closed');assert.equal(ledger.status,'stopped-fail-closed');assert.equal(ledger.modelPostAttempts.length,3);assert.equal(report.failure,'Returned interpretation differs from frozen gold');
const input=inputs.providerInputs.cases[0],gold=inputs.goldens.cases[0];
let concreteChecks=0,concreteFailures=0,oracleChecks=0,oracleMismatches=0;
const stages=[];
for(const [index,kind] of ['baseline','check-rewrite','generate-repair'].entries()){
 const tag=input.id+'-'+kind,before=await read('stages/'+tag+'/before.json'),after=await read('stages/'+tag+'/after.json'),estimate=await read('stages/'+tag+'/request-estimate.json');
 const response=await read(ledger.modelPostAttempts[index].responseEvidence);assert.equal(response.ok,true);assert.deepEqual(JSON.parse(response.rawText),response.json);assert.deepEqual(response.json.room,after);
 const metrics=checkMetadata(kind,before,after,estimate);assert.equal(metrics.finishReason,'stop');
 const candidates=kind==='baseline'?after.review.candidates:[{editor:'repair',...after.repair.proposal}],phase=kind==='baseline'?'baseline':kind==='check-rewrite'?'unsafe':'repaired';
 const semantic=[],manual=[];
 for(const c of candidates){const oracle=checkRulesAgainstSource(input.id,phase,c.rules);semantic.push({editor:c.editor,...oracle});oracleChecks+=oracle.checkedCases;oracleMismatches+=oracle.mismatchCount;for(const s of gold.testAttendees){const actual=independentRuleOutcome(c.rules,s.attendee),expected=s.expected[phase],passed=JSON.stringify(actual)===JSON.stringify(expected);manual.push({id:s.id,editor:c.editor,actual,expected,passed});concreteChecks++;if(!passed)concreteFailures++;}}
 if(kind!=='generate-repair'){const q=qualityFor(input,gold,kind,before,after);assert.equal(q.passed,true);assert.deepEqual(q,await read('stages/'+tag+'/quality.json'));}
 else{assert.throws(()=>qualityFor(input,gold,kind,before,after),/Returned interpretation differs from frozen gold/);assert.equal(after.repair.status,'blocked');assert.equal(after.repair.impact.status,'blocked');assert.equal(after.repair.impact.verification.status,'different');assert.deepEqual(after.repair.votes,{});assert.deepEqual(after.published,before.published);assert.deepEqual(after.registrations,before.registrations);assert.equal(after.published.version,2);assert.equal(after.registrations.length,1);assert.equal(after.registrations[0].decision.feeCents,2100);}
 stages.push({stage:kind,metrics,httpDurationMs:response.durationMs,semantic,manual,repairStatus:after.repair?.status??null});
}
assert.equal(concreteChecks,112);assert.equal(concreteFailures,6);assert.equal(oracleChecks,77440);assert.equal(oracleMismatches,3212);
const promptTokens=stages.reduce((n,s)=>n+s.metrics.promptTokens,0),completionTokens=stages.reduce((n,s)=>n+s.metrics.completionTokens,0);
console.log(JSON.stringify({status:'stopped-run-audit-verified',runPassed:false,modelRequests:3,completedNaturalStop:3,concreteChecks,concreteFailures,oracleChecks,oracleMismatches,generatedRepairCorrect:false,generatedRepairSafelyBlocked:true,publishedVersion:2,originalReceiptCents:2100,promptTokens,completionTokens,uncachedTokenRateEstimateUsd:(promptTokens*1.25+completionTokens*4.25)/1e6,conservativeOriginalSixCallEstimateUsd:preflightReport(inputs).estimatedMaxUsd,actualBilledCostUsd:null,networkCalls:0,filesWritten:0,stages},null,2));
