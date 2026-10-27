// Read-only independent audit; no application code or network.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async n=>JSON.parse(await fs.readFile(path.join(root,n),'utf8'));
const input=await read('case-b/holdout/provider-inputs.json'),gold=await read('case-b/holdout/goldens.json');
const oracle=await import('../case-b/holdout/independent-oracle.mjs');
const O=Date.parse('2026-11-22T17:30:00.000Z'),R=Date.parse('2026-11-24T10:15:30.250Z'),C=Date.parse('2026-11-25T21:00:00.000Z');
// Independent transcription from literal source, using full pathways and ordered fee table.
function sourceDecision(stage,a){
 const t=Date.parse(a.submittedAt);
 const windows=t>=O&&t<C&&(a.resident||(stage==='bob'?t<R:t<=R));
 const pathways=[
   a.age>=16&&a.age<=20&&a.guardianConsent&&a.resident&&a.student&&!a.member,
   a.age>=21&&((a.resident&&!a.member)||(a.member&&(a.student||!a.scholarship))),
 ];
 const accepted=windows&&pathways.filter(Boolean).length===1;
 if(!accepted)return {accepted:false,feeCents:null};
 const tiers=[
  [(stage==='unsafe'||stage==='repaired')&&a.student,1900],
  [a.scholarship,500],
  [a.student&&a.member,1400],
  [a.member,stage==='unsafe'?3100:2700],
  [a.student,3300],
  [true,4600],
 ];
 return {accepted:true,feeCents:tiers.find(([matches])=>matches)[1]};
}
let concrete=0;
assert.equal(gold.explicitAttendees.length,30);
assert.equal(input.caseId,gold.caseId);
for(const item of gold.explicitAttendees)for(const stage of ['alice','bob','unsafe','repaired']){
 assert.deepEqual(sourceDecision(stage,item.attendee),item.expected[stage],item.id+'/'+stage+' independent source vs golden');
 assert.deepEqual(oracle.expectedOutcome(stage,item.attendee),item.expected[stage],item.id+'/'+stage+' oracle vs golden');
 concrete++;
}
for(const [stage,key] of [['alice','before'],['repaired','after']])assert.deepEqual(sourceDecision(stage,gold.beforeAfterAttendee.attendee),gold.beforeAfterAttendee[key]);
const times=[...new Set([O-1,O,O+1,Math.floor((O+R)/2),R-1,R,R+1,Math.floor((R+C)/2),C-1,C,C+1,Date.parse('2026-11-23T12:00:00.000Z'),Date.parse('2026-11-25T12:00:00.000Z')])];
let independentChecks=0;
for(let age=0;age<=120;age++)for(let flags=0;flags<32;flags++)for(const time of times){
 const a={age,resident:!!(flags&1),student:!!(flags&2),member:!!(flags&4),guardianConsent:!!(flags&8),scholarship:!!(flags&16),submittedAt:new Date(time).toISOString()};
 for(const stage of ['alice','bob','unsafe','repaired']){assert.deepEqual(oracle.expectedOutcome(stage,a),sourceDecision(stage,a));independentChecks++;}
}
const replay=oracle.verifyRules({},'alice',(_r,a)=>sourceDecision('alice',a));
assert.equal(replay.mismatchCount,0);assert.equal(replay.checkedCases,121*32*times.length);
const candidateTime='2026-11-23T01:02:03.456Z';
let candidateSeen=false;
const mutation=oracle.verifyRules({nested:{at:candidateTime}},'alice',(_r,a)=>{
 const expected=sourceDecision('alice',a);
 if(a.submittedAt===candidateTime){candidateSeen=true;return {accepted:!expected.accepted,feeCents:expected.accepted?null:4600};}
 return expected;
});
assert.ok(candidateSeen&&mutation.mismatchCount>0,'Candidate-only threshold not sampled');
const evidenceSha256={};
for(const name of ['case-b/holdout/provider-inputs.json','case-b/holdout/goldens.json','case-b/holdout/independent-oracle.mjs','case-b/holdout/README.md','case-b/holdout/FREEZE.json','case-b/holdout/SHA256SUMS','case-b/ambiguous-policy.json'])evidenceSha256[name]=createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex');
console.log(JSON.stringify({status:'pass',expectedFidelityPassed:true,concreteOutcomesReviewed:concrete,receiptOutcomesReviewed:2,independentOracleCrossChecks:independentChecks,independentMismatches:0,sourceTimeSamples:times.length,acceptedTimestampDomain:'Explicit UTC seconds-Z timestamps with optional milliseconds; parent confirmed production rule validator constrains this domain.',candidateOnlyBoundaryMutationDetected:mutation.mismatchCount,groupingWitness:{id:'B14',expected:{accepted:false,feeCents:null},plausibleLooseReading:{accepted:true,feeCents:1400}},sourceJudgments:{aliceBob:'Faithful except intended inclusive-vs-exclusive nonresident cutoff; both explicitly apply age21+ to adult A1 and A2.',unsafe:'English and Spanish agree with Alice admission and student1900 priority; member3100 leaks outside requested student scope.',requestedRepair:'Preserve Alice admission and nonstudent fees; admitted student1900 takes priority over all original tiers.',ambiguous:'English and Spanish agree. Admission is fully specified and time-independent; only reduced scholarship fee amount is missing. Must clarify rather than invent fee.'},evidenceSha256,networkCalls:0,modelCalls:0,humanBilingualStudy:false},null,2));
