#!/usr/bin/env node
// Saved-evidence verification only: no provider calls, network requests or writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyFrozenInputs,preflightReport,planRequest,providerBody,checkMetadata,qualityFor,read} from './run-repair.mjs';
globalThis.fetch=()=>{throw Error('Evidence verification forbids network access');};
const dir=path.dirname(fileURLToPath(import.meta.url));
const inputs=await verifyFrozenInputs(),preflight=preflightReport(inputs);
const report=await read('report.json'),ledger=await read('live-ledger.json');
assert.equal(report.planSha256,inputs.freeze.sha256);assert.equal(ledger.planSha256,inputs.freeze.sha256);
assert.ok(['passed','stopped-fail-closed'].includes(report.status),'Run is incomplete');
assert.equal(ledger.status,report.status==='passed'?'completed':'stopped-fail-closed');
assert.ok(ledger.modelPostAttempts.length<=6);assert.equal(report.modelPostAttempts,ledger.modelPostAttempts.length);
assert.deepEqual(report.preflight,preflight);
const responses=await fs.readdir(path.join(dir,'responses')),requests=await fs.readdir(path.join(dir,'requests'));
const responseFor=async tag=>{const names=responses.filter(n=>n.endsWith('-'+tag+'.json'));assert.equal(names.length,1,'Missing/duplicate response '+tag);const r=await read('responses/'+names[0]);assert.deepEqual(JSON.parse(r.rawText),r.json);return r;};
const requestFor=async tag=>{const names=requests.filter(n=>n.endsWith('-'+tag+'.json'));assert.equal(names.length,1,'Missing/duplicate request '+tag);return read('requests/'+names[0]);};
const engine=await import('./evaluator/studio.ts');
async function replay(before,tag){const req=await requestFor(tag),res=await responseFor(tag);assert.equal(req.method,'POST');assert.equal(req.url,inputs.plan.origin+'/api/studio/'+before.id);assert.equal(res.ok,true);const after=res.json.room;assert.deepEqual(engine.applyStudioAction(before,req.body,after.updatedAt),after,tag+': state transition replay');return after;}
let concreteChecks=0,sourceOracleChecks=0,passedStages=0,blockedRepairs=0,publishedRepairs=0,receiptCount=0,promptTokens=0,completionTokens=0;
const stageOrder=inputs.providerInputs.cases.flatMap(c=>inputs.plan.stages.map(stage=>c.id+'-'+stage));
for(const [index,attempt] of ledger.modelPostAttempts.entries()){
 assert.equal(attempt.sequence,index+1);assert.equal(attempt.tag,stageOrder[index]);
 const evidence=report.stages.find(s=>s.tag===attempt.tag);assert.ok(evidence,'Missing stage report');
 const input=inputs.providerInputs.cases.find(c=>c.id===evidence.caseId),gold=inputs.goldens.cases.find(c=>c.id===evidence.caseId);assert.ok(input&&gold);
 const before=await read('stages/'+attempt.tag+'/before.json'),estimate=await read('stages/'+attempt.tag+'/request-estimate.json');
 const intent={baselineCandidateId:before.review?.candidates.find(c=>c.editor==='alice')?.id,...input.intent},text=evidence.stage==='check-rewrite'?input.proposalText:undefined;
 assert.deepEqual(estimate,planRequest(evidence.stage,before,intent,text));assert.ok(estimate.inputWireBytes<=65536);
 const request=await requestFor(attempt.tag);assert.equal(request.method,'POST');assert.equal(request.url,inputs.plan.origin+attempt.route);
 assert.deepEqual(request.body,evidence.stage==='baseline'?{}:{intent,...(text?{proposalText:text}:{})});
 const res=await read(attempt.responseEvidence);assert.deepEqual(JSON.parse(res.rawText),res.json);assert.equal(attempt.httpStatus,res.status);
 if(!res.ok){assert.equal(report.status,'stopped-fail-closed');assert.equal(index,ledger.modelPostAttempts.length-1);continue;}
 const after=await read('stages/'+attempt.tag+'/after.json');assert.deepEqual(after,res.json.room);const metrics=checkMetadata(evidence.stage,before,after,estimate);assert.deepEqual(metrics,evidence.metrics);
 const exactBody=await read('stages/'+attempt.tag+'/provider-request-exact.json');
 const body=providerBody(evidence.stage,evidence.stage==='baseline'?estimate.job:after.repair.job);assert.deepEqual(exactBody.providerRequestBody,body);assert.equal(exactBody.bodySha256,createHash('sha256').update(JSON.stringify(body)).digest('hex'));assert.equal(Buffer.byteLength(JSON.stringify(body)),estimate.inputWireBytes);
 const quality=qualityFor(input,gold,evidence.stage,before,after);assert.deepEqual(quality,await read('stages/'+attempt.tag+'/quality.json'));assert.deepEqual(quality,evidence.quality);assert.equal(evidence.status,'passed');
 concreteChecks+=quality.concreteChecks;sourceOracleChecks+=quality.oracleChecks.reduce((n,c)=>n+c.checkedCases,0);passedStages++;
 assert.ok(Number.isInteger(metrics.promptTokens)&&metrics.promptTokens>=0);assert.ok(Number.isInteger(metrics.completionTokens)&&metrics.completionTokens>=0);promptTokens+=metrics.promptTokens;completionTokens+=metrics.completionTokens;
}
for(const summary of report.cases){
 if(summary.status!=='passed'){assert.equal(report.status,'stopped-fail-closed');continue;}
 const id=summary.caseId,input=inputs.providerInputs.cases.find(c=>c.id===id),gold=inputs.goldens.cases.find(c=>c.id===id);
 const baseline=await read('stages/'+id+'-baseline/after.json'),candidate=baseline.review.candidates.find(c=>c.editor==='alice');
 let room=await replay(baseline,id+'-baseline-one-vote');assert.deepEqual(room.published,baseline.published);assert.deepEqual(room.review.votes,{alice:candidate.id});
 room=await replay(room,id+'-baseline-two-votes');assert.equal(room.published.version,2);assert.equal(room.review.status,'published');assert.deepEqual(room.review.votes,{alice:candidate.id,bob:candidate.id});
 room=await replay(room,id+'-before-receipt');assert.equal(room.registrations.length,1);const receipt=room.registrations[0],target=gold.testAttendees.find(c=>c.id===gold.intendedWitnessId);assert.deepEqual({accepted:receipt.decision.accepted,feeCents:receipt.decision.feeCents},target.expected.baseline);
 assert.deepEqual(room,await read('stages/'+id+'-check-rewrite/before.json'));
 const blocked=await read('stages/'+id+'-check-rewrite/after.json');assert.equal(blocked.repair.status,'blocked');assert.deepEqual(blocked.published,room.published);assert.deepEqual(blocked.registrations,[receipt]);
 for(const editor of ['alice','bob']){const req=await requestFor(id+'-blocked-vote-'+editor);assert.deepEqual(req.body,{type:'voteRepair',editor,repairId:blocked.repair.id});const res=await responseFor(id+'-blocked-vote-'+editor);assert.equal(res.ok,false);assert.equal(res.status,409);assert.equal(res.json.code,'REPAIR_BLOCKED');}
 assert.deepEqual((await responseFor(id+'-blocked-held')).json.room,blocked);blockedRepairs++;
 assert.deepEqual(blocked,await read('stages/'+id+'-generate-repair/before.json'));const safe=await read('stages/'+id+'-generate-repair/after.json');assert.equal(safe.repair.status,'ready');assert.equal(safe.repair.impact.status,'pass');assert.ok(safe.repairHistory.some(h=>h.id===blocked.repair.id&&h.status==='blocked'));
 room=await replay(safe,id+'-repair-one-vote');assert.deepEqual(room.published,safe.published);assert.equal(room.repair.status,'ready');assert.deepEqual(room.repair.votes,{alice:true});
 room=await replay(room,id+'-repair-two-votes');assert.equal(room.published.version,3);assert.equal(room.repair.status,'published');assert.deepEqual(room.repair.votes,{alice:true,bob:true});assert.deepEqual(room.registrations,[receipt]);publishedRepairs++;
 room=await replay(room,id+'-after-receipt');assert.deepEqual(room.registrations[0],receipt);assert.equal(room.registrations[1].policyVersion,3);assert.deepEqual({accepted:room.registrations[1].decision.accepted,feeCents:room.registrations[1].decision.feeCents},target.expected.repaired);assert.deepEqual(room,await read('cases/'+id+'/final.json'));assert.equal(room.modelCallCount,3);receiptCount+=room.registrations.length;
}
if(report.status==='passed'){assert.equal(ledger.modelPostAttempts.length,6);assert.equal(passedStages,6);assert.equal(concreteChecks,224);assert.ok(sourceOracleChecks>=201344);assert.equal(blockedRepairs,2);assert.equal(publishedRepairs,2);assert.equal(receiptCount,4);}
console.log(JSON.stringify({status:'evidence-verified',runStatus:report.status,modelRequests:ledger.modelPostAttempts.length,passedStages,concreteChecks,sourceOracleChecks,blockedRepairs,publishedRepairs,receipts:receiptCount,promptTokens,completionTokens,uncachedTokenRateEstimateUsd:(promptTokens*1.25+completionTokens*4.25)/1e6,conservativeEstimatedMaxUsd:preflight.estimatedMaxUsd,actualBilledCostUsd:null,networkCalls:0,filesWritten:0},null,2));
