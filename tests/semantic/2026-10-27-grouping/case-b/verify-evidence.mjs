#!/usr/bin/env node
// Read-only replay. Preserves failures as failures; never calls a provider or writes files.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DIR,CONTRACT,verifyFrozenInputs,preflightReport,planRequest,providerBody,checkMetadata,qualityFor,read,intentFor,hash,decision} from './run-unseen.mjs';
globalThis.fetch=()=>{throw Error('Offline verification forbids network access');};
const inputs=await verifyFrozenInputs(),preflight=preflightReport(inputs),{input,gold}=inputs;
const report=await read('report.json'),ledger=await read('live-ledger.json');
assert.equal(report.planSha256,inputs.freeze.sha256);assert.equal(ledger.planSha256,inputs.freeze.sha256);assert.deepEqual(report.preflight,preflight);assert.ok(['passed','stopped-fail-closed'].includes(report.status));assert.equal(ledger.status,report.status==='passed'?'completed':'stopped-fail-closed');assert.ok(ledger.modelPostAttempts.length<=3);assert.equal(report.modelPostAttempts,ledger.modelPostAttempts.length);
const responses=await fs.readdir(path.join(DIR,'responses')),requests=await fs.readdir(path.join(DIR,'requests'));
const requestFor=async tag=>{const names=requests.filter(name=>name.endsWith('-'+tag+'.json'));assert.equal(names.length,1,'Missing/duplicate request '+tag);return read('requests/'+names[0]);};
const responseFor=async tag=>{const names=responses.filter(name=>name.endsWith('-'+tag+'.json'));assert.equal(names.length,1,'Missing/duplicate response '+tag);const r=await read('responses/'+names[0]);assert.deepEqual(JSON.parse(r.rawText),r.json);return r;};
const allRequests=await Promise.all(requests.map(name=>read('requests/'+name)));
assert.equal(allRequests.length,report.networkCalls);
const modelRequests=allRequests.filter(req=>req.url.endsWith('/review')||req.url.endsWith('/repair'));
assert.equal(modelRequests.length,ledger.modelPostAttempts.length);
for(const req of allRequests){assert.equal(req.credentialHeaderPresent,true);assert.equal(req.headerName,'OAI-Sites-Authorization');assert.ok(req.url.startsWith(CONTRACT.origin+'/api/studio'));assert.equal(req.body?.retry,undefined);assert.equal(req.body?.simulation,undefined);}
const engine=await import('./evaluator/studio.ts');
const {canonicalStudioPolicy}=await import('./evaluator/studio-presentation.ts');
function checkPublishedWording(room,original){assert.deepEqual({en:room.published.en,es:room.published.es},canonicalStudioPolicy(room.published.rules));assert.deepEqual(room.published.originalWording,{en:original.en,es:original.es});assert.equal(room.published.wordingSource,'checked-rules-v1');}
async function replay(before,tag){const req=await requestFor(tag),res=await responseFor(tag);assert.equal(req.method,'POST');assert.equal(req.url,CONTRACT.origin+'/api/studio/'+before.id);assert.equal(res.ok,true);const after=res.json.room;assert.deepEqual(engine.applyStudioAction(before,req.body,after.updatedAt),after,tag+': transition mismatch');return after;}
let concreteChecks=0,concreteFailures=0,oracleChecks=0,oracleMismatches=0,passedStages=0,failedStages=0,promptTokens=0,completionTokens=0,naturalStops=0;
for(const [index,attempt] of ledger.modelPostAttempts.entries()){
 const kind=CONTRACT.stages[index],tag=input.caseId+'-'+kind;
 assert.equal(attempt.sequence,index+1);assert.equal(attempt.tag,tag);assert.equal(attempt.route,'/api/studio/'+report.case.roomId+(kind==='baseline'?'/review':'/repair'));
 const stage=report.stages.find(s=>s.tag===tag);assert.ok(stage);assert.equal(stage.stage,kind);assert.ok(['passed','failed'].includes(stage.status));
 const before=await read('stages/'+tag+'/before.json'),estimate=await read('stages/'+tag+'/request-estimate.json'),intent=intentFor(input,before),text=kind==='check-rewrite'?input.unsafeRewrite:undefined;
 assert.deepEqual(estimate,planRequest(kind,before,intent,text));assert.ok(estimate.inputWireBytes<=65536);
 const req=await requestFor(tag);assert.equal(req.url,CONTRACT.origin+attempt.route);assert.deepEqual(req.body,kind==='baseline'?{}:{intent,...(text?{proposalText:text}:{})});
 if(!attempt.responseEvidence){assert.equal(report.status,'stopped-fail-closed');assert.equal(index,ledger.modelPostAttempts.length-1);assert.equal(stage.status,'failed');failedStages++;continue;}
 const res=await read(attempt.responseEvidence);assert.deepEqual(JSON.parse(res.rawText),res.json);assert.equal(attempt.httpStatus,res.status);
 if(stage.metrics){promptTokens+=stage.metrics.promptTokens??0;completionTokens+=stage.metrics.completionTokens??0;if(stage.metrics.finishReason==='stop')naturalStops++;}
 if(!res.ok||res.json.automatic?.status!=='completed'){assert.equal(report.status,'stopped-fail-closed');assert.equal(index,ledger.modelPostAttempts.length-1);assert.equal(stage.status,'failed');if(res.json.room){const after=await read('stages/'+tag+'/after.json');assert.deepEqual(after,res.json.room);assert.deepEqual(after.published,before.published);assert.deepEqual(after.registrations,before.registrations);}failedStages++;continue;}
 const after=await read('stages/'+tag+'/after.json');assert.deepEqual(after,res.json.room);
 let metrics;try{metrics=checkMetadata(kind,before,after,estimate);}catch(error){assert.equal(stage.status,'failed');assert.equal(report.status,'stopped-fail-closed');assert.equal(index,ledger.modelPostAttempts.length-1);assert.equal(stage.failure,error.message);assert.deepEqual(after.published,before.published);assert.deepEqual(after.registrations,before.registrations);failedStages++;continue;}assert.deepEqual(stage.metrics,metrics);
 const exactBody=await read('stages/'+tag+'/provider-request-exact.json'),body=providerBody(kind,kind==='baseline'?estimate.job:after.repair.job);assert.deepEqual(exactBody.providerRequestBody,body);assert.equal(exactBody.bodySha256,hash(JSON.stringify(body)));assert.equal(Buffer.byteLength(JSON.stringify(body)),estimate.inputWireBytes);
 const quality=qualityFor(input,gold,kind,before,after);assert.deepEqual(quality,await read('stages/'+tag+'/quality.json'));assert.deepEqual(stage.quality,quality);
 concreteChecks+=quality.concreteChecks;concreteFailures+=quality.concreteFailures;oracleChecks+=quality.oracleChecks.reduce((n,c)=>n+c.checkedCases,0);oracleMismatches+=quality.oracleChecks.reduce((n,c)=>n+c.mismatchCount,0);
 if(quality.passed){assert.equal(stage.status,'passed');passedStages++;}else{assert.equal(stage.status,'failed');assert.equal(report.status,'stopped-fail-closed');assert.equal(index,ledger.modelPostAttempts.length-1);failedStages++;}
}
const id=input.caseId;
// The two editors must have saved their independently authored texts before review.
if(ledger.modelPostAttempts.length){
 const saved=(await responseFor(id+'-saved')).json.room;
 for(const editor of ['alice','bob']){const req=await requestFor(id+'-draft-'+editor);assert.equal(req.body.type,'draft');assert.equal(req.body.editor,editor);assert.equal(req.body.text,input[editor]);assert.equal(saved.drafts[editor].text,input[editor]);}
 assert.deepEqual(saved,await read('stages/'+id+'-baseline/before.json'));
}
let blockedRepairs=0,publishedRepairs=0,receipts=0;
if(report.status==='passed'){
 assert.equal(ledger.modelPostAttempts.length,3);assert.equal(passedStages,3);assert.equal(failedStages,0);assert.equal(concreteChecks,120);assert.equal(concreteFailures,0);assert.equal(oracleMismatches,0);
 const baseline=await read('stages/'+id+'-baseline/after.json'),candidate=baseline.review.candidates.find(c=>c.editor==='alice');
 let room=await replay(baseline,id+'-baseline-one-vote');assert.deepEqual(room.published,baseline.published);assert.deepEqual(room.review.votes,{alice:candidate.id});
 room=await replay(room,id+'-baseline-two-votes');assert.equal(room.published.version,2);assert.equal(room.review.status,'published');assert.deepEqual(room.review.votes,{alice:candidate.id,bob:candidate.id});checkPublishedWording(room,candidate);
 room=await replay(room,id+'-before-receipt');assert.equal(room.registrations.length,1);const receipt=room.registrations[0];assert.deepEqual(decision(receipt.decision),gold.beforeAfterAttendee.before);assert.deepEqual(room,await read('stages/'+id+'-check-rewrite/before.json'));
 const blocked=await read('stages/'+id+'-check-rewrite/after.json');assert.equal(blocked.repair.status,'blocked');assert.deepEqual(blocked.published,room.published);assert.deepEqual(blocked.registrations,[receipt]);
 for(const editor of ['alice','bob']){const req=await requestFor(id+'-blocked-vote-'+editor),res=await responseFor(id+'-blocked-vote-'+editor);assert.deepEqual(req.body,{type:'voteRepair',editor,repairId:blocked.repair.id});assert.equal(res.status,409);assert.equal(res.ok,false);assert.equal(res.json.code,'REPAIR_BLOCKED');}
 assert.deepEqual((await responseFor(id+'-blocked-held')).json.room,blocked);blockedRepairs++;
 assert.deepEqual(blocked,await read('stages/'+id+'-generate-repair/before.json'));const safe=await read('stages/'+id+'-generate-repair/after.json');assert.equal(safe.repair.status,'ready');
 room=await replay(safe,id+'-repair-one-vote');assert.deepEqual(room.published,safe.published);assert.equal(room.repair.status,'ready');assert.deepEqual(room.repair.votes,{alice:true});
 room=await replay(room,id+'-repair-two-votes');assert.equal(room.published.version,3);assert.equal(room.repair.status,'published');assert.deepEqual(room.repair.votes,{alice:true,bob:true});checkPublishedWording(room,safe.repair.proposal);assert.deepEqual(room.registrations,[receipt]);publishedRepairs++;
 room=await replay(room,id+'-after-receipt');assert.deepEqual(room.registrations[0],receipt);assert.deepEqual(decision(room.registrations[1].decision),gold.beforeAfterAttendee.after);assert.equal(room.registrations[1].policyVersion,3);assert.deepEqual(room,await read('case-final.json'));assert.equal(room.modelCallCount,3);receipts=2;
}else{
 // No later stage was attempted after an error and no automatic retry is hidden.
 assert.ok(failedStages===1||ledger.modelPostAttempts.length===0||report.failure);
 assert.ok(report.failure);assert.ok(report.stages.length<=3);
 const failed=report.stages.find(s=>s.status==='failed');if(failed)assert.equal(failed,report.stages.at(-1));
}
const usageComplete=ledger.modelPostAttempts.length>0&&ledger.modelPostAttempts.every(attempt=>{const m=report.stages.find(stage=>stage.tag===attempt.tag)?.metrics;return Number.isInteger(m?.promptTokens)&&m.promptTokens>=0&&Number.isInteger(m?.completionTokens)&&m.completionTokens>=0;});
console.log(JSON.stringify({status:'fresh-evidence-verified',runStatus:report.status,sourceCommit:CONTRACT.sourceCommit,caseId:input.caseId,roomId:report.case?.roomId??null,modelRequests:ledger.modelPostAttempts.length,passedStages,failedStages,naturalStops,concreteChecks,concreteFailures,independentOracleChecks:oracleChecks,independentOracleMismatches:oracleMismatches,blockedAuthoredRepairs:blockedRepairs,publishedGeneratedRepairs:publishedRepairs,receipts,promptTokens,completionTokens,usageComplete,uncachedTokenRateEstimateUsd:usageComplete?(promptTokens*1.25+completionTokens*4.25)/1e6:null,reportedUsageTokenRateEstimateUsd:(promptTokens*1.25+completionTokens*4.25)/1e6,conservativeEstimatedMaxUsd:preflight.conservativeEstimatedMaxUsd,actualBilledCostUsd:null,networkCalls:0,filesWritten:0},null,2));
