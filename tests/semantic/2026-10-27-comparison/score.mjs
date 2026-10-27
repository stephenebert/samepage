#!/usr/bin/env node
/** Offline only. No provider calls; evaluate all saved failures, never exclude cases. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {isDeepStrictEqual as equal} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {expectedOutcome,boundaryInstants} from './holdout/independent-oracle.mjs';
import {applyStudioAction} from './evaluator/studio.ts';
import {evaluateStudioPolicy,parseStudioAttendee} from './evaluator/studio-engine.ts';
globalThis.fetch=()=>{throw Error('Scoring is strictly offline');};
const DIR=path.dirname(fileURLToPath(import.meta.url)),read=async n=>JSON.parse(await fs.readFile(path.join(DIR,n),'utf8'));
const decision=d=>({accepted:d.accepted,feeCents:d.feeCents});
const hash=b=>createHash('sha256').update(b).digest('hex');
const FLAGS=['resident','student','member','guardianConsent','scholarship'];
const MIN=Date.parse('0000-01-01T00:00:00.000Z'),MAX=Date.parse('9999-12-31T23:59:59.999Z');
function timesFor(id,rules){
 const points=new Set((boundaryInstants[id]??[]).map(Date.parse));
 const visit=c=>{if(c.op==='time')points.add(Date.parse(c.value));else if(c.op==='not')visit(c.arg);else if(c.args)c.args.forEach(visit);};
 for(const r of rules.filter(Boolean)){visit(r.eligibility);r.fee.overrides.forEach(o=>visit(o.when));}
 const samples=new Set([MIN,MAX,Date.parse('2026-12-10T12:00:00.000Z')]);
 for(const t of points)for(const x of [t-1,t,t+1])if(x>=MIN&&x<=MAX)samples.add(x);
 return [...samples].sort((a,b)=>a-b);
}
function compileRule(r){
 const p=c=>{switch(c.op){case'always':return()=>true;case'all':{const a=c.args.map(p);return(x,t)=>a.every(f=>f(x,t));}case'any':{const a=c.args.map(p);return(x,t)=>a.some(f=>f(x,t));}case'not':{const a=p(c.arg);return(x,t)=>!a(x,t);}case'age':return c.cmp==='gte'?a=>a.age>=c.value:a=>a.age<=c.value;case'flag':return a=>a[c.field]===c.value;case'time':{const b=Date.parse(c.value);return c.cmp==='lt'?(_,t)=>t<b:c.cmp==='lte'?(_,t)=>t<=b:c.cmp==='gt'?(_,t)=>t>b:(_,t)=>t>=b;}default:throw Error('Unknown condition');}};
 const eligible=p(r.eligibility),fees=r.fee.overrides.map(o=>({f:p(o.when),cents:o.cents}));
 return(a,t)=>{if(!eligible(a,t))return{accepted:false,feeCents:null};const m=fees.find(o=>o.f(a,t));return{accepted:true,feeCents:m?m.cents:r.fee.defaultCents};};
}
function fidelity(gold,room){
 if(gold.status==='unresolved')return {applicable:false};
 const candidates=room.review?.candidates??[],times=timesFor(gold.id,candidates.map(c=>c.rules)),results=[];
 for(const editor of ['alice','bob']){
  const candidate=candidates.find(c=>c.editor===editor);if(!candidate?.rules){results.push({editor,compiled:false,checks:0,mismatches:null,examples:[]});continue;}
  const evalRule=compileRule(candidate.rules);let checks=0,mismatches=0;const examples=[];
  for(let age=0;age<=120;age++)for(let mask=0;mask<32;mask++)for(const time of times){
   const attendee={age,...Object.fromEntries(FLAGS.map((f,i)=>[f,!!(mask&(1<<i))])),submittedAt:new Date(time).toISOString()},want=expectedOutcome(gold.id,editor,attendee),got=evalRule(attendee,time);checks++;
   if(!equal(want,got)){mismatches++;if(examples.length<5)examples.push({attendee,expected:want,actual:got});}
  }
  for(const e of gold.examples)assert.deepEqual(decision(evaluateStudioPolicy(candidate.rules,e.attendee)),evalRule(e.attendee,Date.parse(e.attendee.submittedAt)),'Scorer differs from production evaluator');
  results.push({editor,compiled:true,checks,mismatches,examples});
 }
 return {applicable:true,allFaithful:results.every(x=>x.compiled&&x.mismatches===0),timePartitions:times.length,policies:results};
}
function witnessScore(gold,witnesses){
 const results=witnesses.map(w=>{
  try{const attendee=parseStudioAttendee(w.attendee);if(gold.status==='unresolved')return{valid:false,reason:'Witness asserted for unresolved policy'};
   const left=expectedOutcome(gold.id,'alice',attendee),right=expectedOutcome(gold.id,'bob',attendee);
   const valid=!equal(left,right)&&equal(left,decision(w.left))&&equal(right,decision(w.right));
   return{valid,attendee,expected:{left,right},reported:{left:decision(w.left),right:decision(w.right)}};
  }catch(error){return{valid:false,reason:error.message};}
 });
 return {count:results.length,valid:results.filter(x=>x.valid).length,invalid:results.filter(x=>!x.valid).length,atLeastOneValid:results.some(x=>x.valid),results};
}
function workflow(gold,input){
 let room=structuredClone(input),now='2026-10-27T23:00:00.000Z';
 try{
  assert.ok(room.review);assert.deepEqual(room.review.votes,{});const original=structuredClone(room.published),left=room.review.candidates.find(c=>c.editor==='alice'),right=room.review.candidates.find(c=>c.editor==='bob');
  const vote=(r,editor,candidateId)=>applyStudioAction(r,{type:'vote',editor,reviewId:r.review.id,candidateId},now);
  if(gold.status==='unresolved'){
   assert.equal(room.review.discovery.status,'unresolved','Unsupported/ambiguous source was incorrectly made executable');
   for(const editor of ['alice','bob'])assert.throws(()=>vote(room,editor,left.id));
   return{passed:true,clarificationBlocksBothApprovals:true};
  }
  assert.notEqual(room.review.discovery.status,'unresolved','Resolved source was unnecessarily blocked');
  room=vote(room,'alice',left.id);assert.deepEqual(room.published,original);
  room=vote(room,'bob',right.id);assert.deepEqual(room.published,original);
  room=vote(room,'bob',left.id);assert.equal(room.published.version,original.version+1);assert.deepEqual(room.published.rules,left.rules);
  let receiptsCorrect=0;
  for(const [i,e] of (gold.examples??[]).slice(0,3).entries()){
   room=applyStudioAction(room,{type:'register',requestId:gold.id+'-receipt-'+i,policyVersion:room.published.version,label:'Synthetic benchmark '+gold.id,...e.attendee},now);
   assert.deepEqual(decision(room.registrations.at(-1).decision),expectedOutcome(gold.id,'alice',e.attendee));receiptsCorrect++;
  }
  return{passed:true,oneVoteHeld:true,divergentVotesHeld:true,jointSelectionPublished:true,receiptsCorrect};
 }catch(error){return{passed:false,error:error.message};}
}
const median=xs=>{if(!xs.length)return null;const a=[...xs].sort((a,b)=>a-b),mid=Math.floor(a.length/2);return a.length%2?a[mid]:(a[mid-1]+a[mid])/2;};
async function main(){
 const freeze=await read('FREEZE.json');for(const [file,sha]of Object.entries(freeze.files))assert.equal(hash(await fs.readFile(path.join(DIR,file))),sha,'Freeze changed: '+file);
 const plan=await read('plan.json'),goldens=await read('holdout/goldens.json'),ledger=await read('live-ledger.json'),rows=[];
 for(const gold of goldens.cases)for(const arm of ['samepage','plain-meta']){
  const attempt=ledger.attempts.find(a=>a.caseId===gold.id&&a.arm===arm),row={caseId:gold.id,arm,expected:gold.status,status:'unexecuted',correct:false};
  if(attempt?.responseFile){const evidence=await read(attempt.responseFile),slot=evidence.json.slot;row.status=slot?.status??'server-error';row.metrics=slot?.metrics??null;row.httpDurationMs=evidence.durationMs;row.operationDurationMs=slot?.durationMs??(slot?.finishedAt&&slot?.startedAt?Date.parse(slot.finishedAt)-Date.parse(slot.startedAt):null);row.error=slot?.error??null;
   if(slot?.status==='completed'){
    const result=slot.result;row.predicted=result.status;row.correct=result.status===gold.status;
    const witnesses=arm==='samepage'?(result.room?.review?.discovery?.witnesses??result.witnesses??[]):result.witness?[result.witness]:[];
    row.witness=witnessScore(gold,witnesses);
    if(arm==='samepage'&&result.room){row.fidelity=fidelity(gold,result.room);row.workflow=workflow(gold,result.room);}
    if(arm==='plain-meta'){row.explanation=result.explanation;row.issues=result.issues;}
   }
  }
  rows.push(row);
 }
 const summary={};
 for(const arm of ['samepage','plain-meta']){
  const r=rows.filter(x=>x.arm===arm),m=r.filter(x=>x.metrics).map(x=>x.metrics),known=m.every(x=>Number.isInteger(x.promptTokens)&&Number.isInteger(x.completionTokens))&&m.length===r.filter(x=>x.status!=='unexecuted').length;
  const prompt=m.reduce((s,x)=>s+(x.promptTokens??0),0),completion=m.reduce((s,x)=>s+(x.completionTokens??0),0),different=r.filter(x=>x.expected==='different'),equivalent=r.filter(x=>x.expected==='equivalent'),unresolved=r.filter(x=>x.expected==='unresolved');
  summary[arm]={correct:r.filter(x=>x.correct).length,total:r.length,completed:r.filter(x=>x.status==='completed').length,failures:r.filter(x=>!['completed','unexecuted'].includes(x.status)).length,unexecuted:r.filter(x=>x.status==='unexecuted').length,differencesDetected:different.filter(x=>x.predicted==='different').length,differentTotal:different.length,equivalentCorrect:equivalent.filter(x=>x.correct).length,equivalentTotal:equivalent.length,falseAlarms:equivalent.filter(x=>x.predicted==='different').length,unnecessaryAbstentions:equivalent.filter(x=>x.predicted==='unresolved').length,clarificationCorrect:unresolved.filter(x=>x.correct).length,clarificationTotal:unresolved.length,differentCasesWithValidWitness:different.filter(x=>x.witness?.atLeastOneValid).length,invalidWitnesses:r.reduce((s,x)=>s+(x.witness?.invalid??0),0),medianProviderMs:median(m.map(x=>x.providerDurationMs)),medianHttpMs:median(r.filter(x=>Number.isFinite(x.httpDurationMs)).map(x=>x.httpDurationMs)),promptTokens:prompt,completionTokens:completion,usageComplete:known,uncachedRateEstimateUsd:(prompt*1.25+completion*4.25)/1e6,actualBilledCostUsd:null};
 }
 for(const arm of Object.keys(summary)){summary[arm].reportedUsageEstimateUsd=summary[arm].uncachedRateEstimateUsd;if(!summary[arm].usageComplete)summary[arm].uncachedRateEstimateUsd=null;}
 const paired=goldens.cases.map(g=>{const a=rows.find(r=>r.caseId===g.id&&r.arm==='samepage'),b=rows.find(r=>r.caseId===g.id&&r.arm==='plain-meta');return{caseId:g.id,samepage:a.correct,plain:b.correct,result:[a.status,b.status].includes('unexecuted')?'not-compared':a.correct&&!b.correct?'samepage-win':!a.correct&&b.correct?'plain-win':a.correct?'both-correct':'both-wrong'};});
 const report={scope:'12 fresh synthetic bilingual policy-pair reviews, one independent request per arm per pair; no human study, not a full repair-workflow comparison.',runStatus:ledger.status,model:plan.model,reasoningEffort:plan.reasoningEffort,maxCompletionTokens:plan.maxCompletionTokens,summary,paired,rows,limitations:['One small synthetic sample and one generation per condition; no statistical superiority claim.','AI-authored goldens and independent AI review, not human bilingual validation.','Source-language fidelity remains a separate metric from deterministic agreement over compiled rules.','Dollar figures estimate usage at published uncached token rates; provider billing may lag.'],actualBilledCostUsd:null};
 await fs.writeFile(path.join(DIR,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({runStatus:report.runStatus,summary,paired},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
