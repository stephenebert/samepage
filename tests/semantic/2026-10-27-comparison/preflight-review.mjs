/** Independent AI preflight audit; no provider calls or SamePage imports. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {expectedOutcome,boundaryInstants} from './holdout/independent-oracle.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const inputs=JSON.parse(await fs.readFile(path.join(dir,'holdout/provider-inputs.json'),'utf8'));
const gold=JSON.parse(await fs.readFile(path.join(dir,'holdout/goldens.json'),'utf8'));
const same=(a,b)=>a.accepted===b.accepted&&a.feeCents===b.feeCents;
const reject=()=>({accepted:false,feeCents:null});
const accept=feeCents=>({accepted:true,feeCents});
function reviewer(id,side,a){
 const spanish=side==='bob';
 let eligible=true,fee=0;
 switch(id){
 case 'c01':
  if(spanish){ if(!a.member&&(a.age<18||!a.resident)) return reject(); }
  else if(a.age<18||!(a.resident||a.member))return reject();
  return accept(a.member?1500:2500);
 case 'c02':
  if(a.age<16||(a.age<18&&!a.guardianConsent))return reject();
  if(spanish){if(a.student)return accept(1100);if(a.scholarship)return accept(0);}
  else {if(a.scholarship)return accept(0);if(a.student)return accept(1100);}
  return accept(2400);
 case 'c03': {
  const cutoff=Date.parse('2026-12-04T18:00:00.000Z'),t=Date.parse(a.submittedAt);
  if(spanish?t>cutoff:t>=cutoff)return reject();
  if(a.age<18||a.age<21&&!a.resident)return reject();
  if(a.student)return accept(1000);if(a.member)return accept(1800);return accept(2600);
 }
 case 'c04':
  if(a.age<16)return reject();
  if(!a.member){
   if(!a.resident)return reject();
   if(spanish){if(a.student||a.scholarship)return reject();}
   else if(a.student&&!a.scholarship)return reject();
  }
  if(a.scholarship)return accept(700);if(a.member)return accept(900);return accept(1800);
 case 'c05':
  if(a.age<16||a.age<18&&!a.guardianConsent)return reject();
  if(spanish){if(a.resident&&a.student)return accept(1200);if(a.member&&!a.scholarship)return accept(1200);}
  else if(a.resident&&!a.scholarship){if(a.student)return accept(1200);if(a.member)return accept(1200);}
  return accept(2400);
 case 'c06': {
  if(a.age<18||a.age>70||!a.resident&&!a.member)return reject();
  const early=Date.parse(a.submittedAt)<Date.parse('2026-12-12T09:00:00.000Z');
  if(early&&(spanish?(!a.student||!a.member):!a.student))return accept(1700);
  if(a.student&&a.member)return accept(800);if(a.scholarship)return accept(0);return accept(2800);
 }
 case 'c07':
  if(a.age<18||a.age>65||!a.resident&&!a.member)return reject();
  if(a.scholarship)return accept(0);if(a.student)return accept(1100);return accept(2300);
 case 'c08':
  if(a.age<16||a.age<18&&!a.guardianConsent)return reject();
  if(a.scholarship)return accept(0);if(a.student)return accept(900);if(a.member)return accept(1300);return accept(2200);
 case 'c09': {
  if(a.age<16||a.age>24||a.age<18&&!a.guardianConsent)return reject();
  const ms=Date.parse(a.submittedAt);
  if(ms>Date.parse('2026-12-20T19:30:00.000Z'))return reject();
  if(a.student&&ms<Date.parse('2026-12-19T19:30:00.000Z'))return accept(1000);return accept(3000);
 }
 case 'c10':
  if(a.age<18)return reject();
  if(a.member)return accept(1800);
  if(a.resident&&a.student)return accept(1200);
  return reject();
 default:throw Error('Reviewer function is only defined for supported complete policies');
 }
}
const cases=[];let checks=0,examples=0;
for(const g of gold.cases){
 assert.ok(inputs.cases.some(c=>c.id===g.id));
 if(g.status==='unresolved'){
  assert.ok(['c11','c12'].includes(g.id));assert.equal(g.examples.length,0);
  cases.push({caseId:g.id,status:g.status,review:'Unresolved for executable-domain reasons, even though the two languages agree.',checks:0});continue;
 }
 const times=new Set(['0000-01-01T00:00:00.000Z','2026-12-10T12:00:00.000Z','9999-12-31T23:59:59.999Z']);
 for(const x of boundaryInstants[g.id])for(const d of [-1,0,1])times.add(new Date(Date.parse(x)+d).toISOString());
 let differences=0,caseChecks=0;
 for(let age=0;age<=120;age++)for(let flags=0;flags<32;flags++)for(const submittedAt of times){
  const a={age,resident:!!(flags&1),student:!!(flags&2),member:!!(flags&4),guardianConsent:!!(flags&8),scholarship:!!(flags&16),submittedAt};
  const left=reviewer(g.id,'alice',a),right=reviewer(g.id,'bob',a);
  for(const [side,outcome] of [['alice',left],['bob',right]]){
   assert.deepEqual(expectedOutcome(g.id,side,a),outcome,`${g.id}/${side} reference mismatch at ${JSON.stringify(a)}`);checks++;caseChecks++;
  }
  if(!same(left,right))differences++;
 }
 assert.equal(differences===0,g.status==='equivalent',g.id+' expected label mismatch');
 for(const e of g.examples){assert.deepEqual(reviewer(g.id,'alice',e.attendee),e.left);assert.deepEqual(reviewer(g.id,'bob',e.attendee),e.right);examples+=2;}
 cases.push({caseId:g.id,status:g.status,checks:caseChecks,sourcePartitionAttendeeDifferences:differences,review:'English and Spanish source semantics agree with both independently written reference functions.'});
}
assert.equal(inputs.cases.length,12);assert.equal(new Set(inputs.cases.map(c=>c.id)).size,12);
assert.deepEqual(Object.fromEntries(['different','equivalent','unresolved'].map(k=>[k,gold.cases.filter(c=>c.status===k).length])),{different:6,equivalent:4,unresolved:2});
const hashes={};for(const name of ['provider-inputs.json','goldens.json','independent-oracle.mjs'])hashes[name]=createHash('sha256').update(await fs.readFile(path.join(dir,'holdout',name))).digest('hex');
const result={status:'passed',reviewer:'independent assistant agent; not human bilingual validation',reviewedAt:new Date().toISOString(),cases:12,labels:{different:6,equivalent:4,unresolved:2},independentReferenceChecks:checks,handpickedOutcomeChecks:examples,discrepancies:0,providerCalls:0,modelOutputsViewed:false,inputHashes:hashes,caseReviews:cases,limitations:['Twelve synthetic cases and one sample per arm cannot establish general superiority.','Primary classification, concrete-witness validity, and compiled-policy fidelity must be reported separately.','Unresolved means not completely executable within the shared domain, not merely that the two texts differ.','Reference cross-check uses all integer ages and boolean flags, source timestamp boundaries, adjacent milliseconds, and extreme timestamps; it is not human validation or a proof of all natural-language interpretations.']};
await fs.writeFile(path.join(dir,'preflight-audit.json'),JSON.stringify(result,null,2)+'\n');
await fs.writeFile(path.join(dir,'preflight-audit.txt'),`Independent AI preflight review: PASS\n\nReviewed all12 English/Spanish policy pairs against their frozen expected statuses and direct reference functions. No source/golden discrepancy or resolved-case ambiguity was found. No cases were changed.\n\n${checks} independent reference outcome checks and${examples} handpicked outcome checks passed. The reviewer reference uses ordinary conditionals, no SamePage imports or model calls. The reviewed source hashes are recorded in preflight-audit.json.\n\nThis is independent AI review, not human bilingual validation. Results must be described as a small synthetic benchmark. Keep classification, concrete witness validity, and SamePage interpretation fidelity separate. The unresolved labels require complete executability under the same supported-domain contract in both arms.\n`);
console.log(JSON.stringify({status:result.status,checks,examples,discrepancies:0,providerCalls:0}));
