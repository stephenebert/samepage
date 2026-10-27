#!/usr/bin/env node
// Offline replay of one clarification test. No provider, network, or file writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyFrozenInputs,providerBody} from './case-a/run-unseen.mjs';
globalThis.fetch=()=>{throw Error('Offline verifier forbids network');};
const DIR=path.dirname(fileURLToPath(import.meta.url)), read=async n=>JSON.parse(await fs.readFile(path.join(DIR,n),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const plan=await read('suite-plan.json'),freeze=await read('suite-plan.freeze.json');assert.equal(hash(await fs.readFile(path.join(DIR,'suite-plan.json'))),freeze.sha256);
for(const [name,sha] of Object.entries(plan.files))assert.equal(hash(await fs.readFile(path.join(DIR,name))),sha,name+' changed');
await verifyFrozenInputs();const engine=await import('./case-a/evaluator/studio.ts');
const report=await read('ambiguity/report.json');assert.equal(report.planSha256,freeze.sha256);assert.equal(report.modelRequests,1);assert.ok(['passed','stopped-fail-closed'].includes(report.status));
const names=await fs.readdir(path.join(DIR,'ambiguity')), reqs=await Promise.all(names.filter(n=>n.endsWith('-request.json')&&!n.startsWith('provider')).map(n=>read('ambiguity/'+n)));
assert.equal(reqs.filter(r=>r.route.endsWith('/review')).length,1);assert.equal(report.networkRequests,reqs.length);
for(const req of reqs){assert.equal(req.credentialHeaderPresent,true);assert.equal(req.body?.retry,undefined);assert.equal(req.body?.simulation,undefined);}
const responses=await Promise.all(names.filter(n=>n.endsWith('-response.json')).map(async n=>({name:n,...await read('ambiguity/'+n)})));
for(const res of responses)assert.deepEqual(JSON.parse(res.rawText),res.json);
if(report.status==='passed'){
 const before=await read('ambiguity/before.json'),after=await read('ambiguity/after.json'),final=await read('ambiguity/case-final.json');const input=await read('case-b/ambiguous-policy.json');for(const editor of ['alice','bob'])assert.equal(before.drafts[editor].text,input[editor]);const reviewRequests=reqs.filter(r=>r.route.endsWith('/review'));assert.equal(reviewRequests.length,1);assert.equal(reviewRequests[0].route,'/api/studio/'+before.id+'/review');assert.deepEqual(reviewRequests[0].body,{});const reviewResponses=responses.filter(r=>r.name.endsWith('-review-response.json'));assert.equal(reviewResponses.length,1);assert.ok(reviewResponses[0].ok);assert.equal(reviewResponses[0].json.automatic?.status,'completed');assert.deepEqual(after,reviewResponses[0].json.room);assert.deepEqual(report.metrics,after.automaticReview.metrics);assert.equal(report.roomId,before.id);assert.deepEqual(after,final);assert.deepEqual(after.published,before.published);assert.deepEqual(after.registrations,[]);assert.equal(after.modelCallCount,1);assert.equal(after.review.discovery.status,'unresolved');assert.deepEqual(after.review.votes,{});
 const job=engine.applyStudioAction(before,{type:'requestReview'},'2026-10-27T12:00:00.000Z').activeJob,body=providerBody('baseline',job),saved=await read('ambiguity/provider-request-exact.json');assert.deepEqual(saved.body,body);assert.equal(saved.sha256,hash(JSON.stringify(body)));assert.equal(after.automaticReview.metrics.requestBytes,saved.inputWireBytes);assert.equal(after.automaticReview.source,'meta');assert.equal(after.automaticReview.metrics.finishReason,'stop');assert.deepEqual(after.automaticReview.requestedEditors,['alice','bob']);assert.deepEqual(after.automaticReview.reusedEditors,[]);engine.parseStudioReview({jobId:job.id,candidates:after.review.candidates.map(({id,...c})=>c)},job);
 for(const editor of ['alice','bob']){const c=after.review.candidates.find(c=>c.editor===editor);assert.equal(c.rules,null);assert.ok(c.issues.length);const res=responses.find(r=>r.name.endsWith('-blocked-vote-'+editor+'-response.json'));assert.ok(res&&!res.ok);assert.equal(res.json.code,'UNRESOLVED');assert.throws(()=>engine.applyStudioAction(after,{type:'vote',editor,reviewId:after.review.id,candidateId:c.id},after.updatedAt),e=>e.code==='UNRESOLVED');}
 const held=responses.find(r=>r.name.endsWith('-held-response.json'));assert.ok(held?.ok);assert.deepEqual(held.json.room,after);
}
const m=report.metrics??{};console.log(JSON.stringify({runStatus:report.status,modelRequests:1,unresolvedCandidates:report.status==='passed'?2:null,blockedVotes:report.approvalsBlocked??0,promptTokens:m.promptTokens??null,completionTokens:m.completionTokens??null,uncachedTokenRateEstimateUsd:Number.isInteger(m.promptTokens)&&Number.isInteger(m.completionTokens)?(m.promptTokens*1.25+m.completionTokens*4.25)/1e6:null,actualBilledCostUsd:null,networkCalls:0,filesWritten:0},null,2));
