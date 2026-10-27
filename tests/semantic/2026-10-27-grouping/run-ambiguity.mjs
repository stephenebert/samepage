#!/usr/bin/env node
// One independently authored ambiguous policy. Root-only live execution; no retries.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyFrozenInputs,providerBody,CONTRACT as C} from './case-a/run-unseen.mjs';
const DIR=path.dirname(fileURLToPath(import.meta.url)), OUT=path.join(DIR,'ambiguity');
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(path.join(DIR,p),'utf8'));
const exact=assert.deepEqual;
let bearer='', report={status:'not-started',modelRequests:0,networkRequests:0,actualBilledCostUsd:null}, count=0;
async function save(name,data){const text=JSON.stringify(data,null,2)+'\n';assert.ok(!bearer||!text.includes(bearer),'Credential must never be saved');await fs.mkdir(OUT,{recursive:true});await fs.writeFile(path.join(OUT,name),text,{mode:0o600});}
async function hidden(){
 assert.ok(process.stdin.isTTY,'Hidden TTY input required');process.stdin.setRawMode(true);process.stderr.write('Ready for own-site service bearer JSON on hidden stdin.\n');
 const input=await new Promise((resolve,reject)=>{let s='';const timer=setTimeout(()=>done(Error('Input timeout')),60000);function done(e){clearTimeout(timer);process.stdin.off('data',data);process.stdin.setRawMode(false);process.stdin.pause();e?reject(e):resolve(s);}function data(b){for(const c of b.toString()){if(c==='\r'||c==='\n')return done();if(c==='\u0003')return done(Error('Cancelled'));s+=c;if(s.length>16384)return done(Error('Input too large'));}}process.stdin.on('data',data);process.stdin.resume();});
 const j=JSON.parse(input);exact(Object.keys(j).sort(),['authorizeLive','ownSiteServiceBearer']);assert.equal(j.authorizeLive,true);assert.match(j.ownSiteServiceBearer,/^[A-Za-z0-9._~+/=-]{20,8192}$/);bearer=j.ownSiteServiceBearer;
}
function modelConfig(m){assert.equal(m?.ready,true);assert.equal(m?.mode,'automatic');assert.equal(m?.model,C.model);assert.equal(m?.protocol,C.protocol);assert.equal(m?.reasoningEffort,C.reasoningEffort);assert.equal(m?.maxCompletionTokens,C.maxCompletionTokens);assert.equal(m?.reuseUnchanged,false);}
async function request(route,body,tag){
 assert.ok(route==='/api/studio'||/^\/api\/studio\/studio-[A-Za-z0-9_-]+(?:\/review)?$/.test(route));
 if(route.endsWith('/review')){assert.equal(report.modelRequests,0);report.modelRequests=1;await save('report.json',report);}
 const seq=++count;report.networkRequests=count;await save(`${seq}-${tag}-request.json`,{route,body:body??null,credentialHeaderPresent:true});
 const start=Date.now(),r=await fetch(C.origin+route,{method:body===undefined?'GET':'POST',headers:{Origin:C.origin,'OAI-Sites-Authorization':'Bearer '+bearer,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(70000)});
 const reader=r.body.getReader(),chunks=[];let size=0;for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;assert.ok(size<=2000000,'Response size cap');chunks.push(part.value);}const rawText=Buffer.concat(chunks).toString(),json=JSON.parse(rawText),response={status:r.status,ok:r.ok,durationMs:Date.now()-start,rawText,json};await save(`${seq}-${tag}-response.json`,response);await save('report.json',report);if(r.ok)modelConfig(json.model);return response;
}
async function main(){
 const args=process.argv.slice(2);assert.ok(args.length===1&&['--live','--dry-run'].includes(args[0]));
 const plan=await read('suite-plan.json'),frozen=await read('suite-plan.freeze.json');assert.equal(hash(await fs.readFile(path.join(DIR,'suite-plan.json'))),frozen.sha256);for(const [name,sha] of Object.entries(plan.files))assert.equal(hash(await fs.readFile(path.join(DIR,name))),sha,name+' changed');
 await verifyFrozenInputs();const engine=await import('./case-a/evaluator/studio.ts');const input=await read('case-b/ambiguous-policy.json');assert.equal(input.expected,'clarification-no-rules');
 assert.equal(plan.maxRequests,7);assert.equal(plan.conservativeEstimatedMaxUsd,7*((65536+4096)*1.25+8192*4.25)/1e6);assert.ok(plan.conservativeEstimatedMaxUsd<1);
 if(args[0]==='--dry-run'){console.log(JSON.stringify({status:'ambiguity-preflight-pass',modelRequests:0,maxLiveRequests:1,caseId:input.caseId}));return;}
 for(const name of ['.live-run.lock','report.json'])try{await fs.access(path.join(OUT,name));throw Error('Existing ambiguity run; retry forbidden');}catch(e){if(e.code!=='ENOENT')throw e;}
 await hidden();await fs.mkdir(OUT,{recursive:true});await fs.writeFile(path.join(OUT,'.live-run.lock'),'reserved',{flag:'wx',mode:0o600});report={...report,status:'running',caseId:input.caseId,planSha256:frozen.sha256};await save('report.json',report);
 try{
  let res=await request('/api/studio',{},'create');assert.ok(res.ok);let room=res.json.room;report.roomId=room.id;assert.equal(room.published.version,1);assert.equal(room.modelCallCount??0,0);assert.equal(room.registrations.length,0);const original=structuredClone(room);
  for(const editor of ['alice','bob']){res=await request('/api/studio/'+room.id,{type:'draft',editor,baseVersion:room.drafts[editor].version,text:input[editor]},'draft-'+editor);assert.ok(res.ok);room=res.json.room;}
  const before=structuredClone(room);await save('before.json',before);const job=engine.applyStudioAction(room,{type:'requestReview'},'2026-10-27T12:00:00.000Z').activeJob;const body=providerBody('baseline',job),bytes=Buffer.byteLength(JSON.stringify(body));assert.ok(bytes<=65536);await save('provider-request-exact.json',{body,inputWireBytes:bytes,sha256:hash(JSON.stringify(body)),note:'Reconstructed from frozen production source; no gold answers in provider input.'});
  res=await request('/api/studio/'+room.id+'/review',{},'review');assert.ok(res.ok,'Review HTTP failure; no retry');room=res.json.room;await save('after.json',room);report.metrics=room.automaticReview?.metrics;report.httpDurationMs=res.durationMs;await save('report.json',report);
  assert.equal(res.json.automatic?.status,'completed');assert.equal(room.automaticReview?.source,'meta');assert.equal(room.automaticReview?.model,C.model);assert.equal(report.metrics?.finishReason,'stop');assert.equal(report.metrics?.requestBytes,bytes);assert.equal(room.modelCallCount,1);assert.equal(room.review?.provenance,'meta-model');exact(room.published,original.published);exact(room.registrations,[]);exact(room.review.votes,{});assert.equal(room.review.discovery.status,'unresolved');assert.equal(room.review.candidates.length,2);exact(room.automaticReview.requestedEditors,['alice','bob']);exact(room.automaticReview.reusedEditors,[]);assert.equal(room.review.id,job.id);engine.parseStudioReview({jobId:job.id,candidates:room.review.candidates.map(({id,...c})=>c)},job);
  for(const candidate of room.review.candidates){assert.equal(candidate.rules,null);assert.ok(candidate.issues.length>0,'Missing clarification');}
  for(const editor of ['alice','bob']){const vote=await request('/api/studio/'+room.id,{type:'vote',editor,reviewId:room.review.id,candidateId:room.review.candidates.find(c=>c.editor===editor).id},'blocked-vote-'+editor);assert.equal(vote.ok,false);assert.equal(vote.json.code,'UNRESOLVED');}
  res=await request('/api/studio/'+room.id,undefined,'held');assert.ok(res.ok);exact(res.json.room,room,'Rejected votes mutated room');await save('case-final.json',room);report.status='passed';report.clarifications=room.review.candidates.map(c=>({editor:c.editor,issues:c.issues}));report.approvalsBlocked=2;report.publicationUnchanged=true;report.completedAt=new Date().toISOString();await save('report.json',report);console.log(JSON.stringify(report));
 }catch(e){report.status='stopped-fail-closed';report.failure=e.message;await save('report.json',report);throw e;}finally{bearer='';}
}
main().catch(e=>{bearer='';console.error(e.message);process.exitCode=1;});
