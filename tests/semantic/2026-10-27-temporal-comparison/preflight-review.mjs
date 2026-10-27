// Independent reviewer reference functions written from the source policies.
// No SamePage imports, model outputs or provider calls.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {expectedOutcome,boundaryInstants} from './holdout/independent-oracle.mjs';
globalThis.fetch=()=>{throw Error('Preflight is offline');};
const DIR=path.dirname(fileURLToPath(import.meta.url));
const read=async n=>JSON.parse(await fs.readFile(path.join(DIR,n),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const outcome=(accepted,fee)=>({accepted:!!accepted,feeCents:accepted?fee:null});
const t=x=>Date.parse(x);
const apr='2031-04-09T18:30:00.000Z';
const leapOpen='2028-02-28T23:59:59.999Z',leapStart='2028-02-29T00:00:00.000Z',leapEnd='2028-02-29T23:59:59.999Z',leapClose='2028-03-01T00:00:00.000Z';
const decOpen='2026-12-06T09:00:00.000Z',decClose='2026-12-06T10:00:00.000Z';
const common02=a=>a.age>=12&&a.age<=17&&(a.resident||a.student)&&(a.member||a.guardianConsent);
const fee02=a=>a.scholarship?0:a.member?900:a.student?1400:1800;
const common03=a=>a.age>=16&&(a.age>=18||a.guardianConsent);
const fee03=a=>a.scholarship?0:a.member?1500:2500;
const common05=a=>a.age>=8&&(a.resident||a.member)&&(a.age>=18||a.guardianConsent);
const common07=a=>a.age>=14&&(a.resident||a.scholarship)&&(a.age>=18||a.guardianConsent);
const common10=a=>a.member||(a.resident&&a.guardianConsent);
const common12=a=>a.age>=18&&(a.resident||a.member);
const refs={
 v2c01:{alice:a=>outcome(a.age>=18&&(a.resident||a.member)&&t(a.submittedAt)<t(apr),a.scholarship?0:2400),bob:a=>outcome(a.age>=18&&(a.resident||a.member)&&t(a.submittedAt)<=t(apr),a.scholarship?0:2400)},
 v2c02:{alice:a=>outcome(common02(a),fee02(a)),bob:a=>outcome(a.age>=12&&a.age<=17&&!(!a.resident&&!a.student)&&!( !a.member&&!a.guardianConsent),fee02(a))},
 v2c03:{alice:a=>outcome(common03(a),fee03(a)),bob:a=>outcome(a.age>=18||((a.age===16||a.age===17)&&a.guardianConsent),fee03(a))},
 v2c04:{alice:a=>outcome(a.age>=18&&!(a.resident&&a.student),a.member?1100:1900),bob:a=>outcome(a.age>=18&&!a.resident&&!a.student,a.member?1100:1900)},
 v2c05:{alice:a=>outcome(common05(a),a.member?1200:a.scholarship?400:a.student?2000:2800),bob:a=>outcome(common05(a),a.scholarship?400:a.member?1200:a.student?2000:2800)},
 v2c07:{alice:a=>outcome(common07(a)&&t(a.submittedAt)>t(leapOpen)&&t(a.submittedAt)<t(leapClose),a.student?800:1600),bob:a=>outcome(common07(a)&&t(a.submittedAt)>=t(leapStart)&&t(a.submittedAt)<=t(leapEnd),a.student?800:1600)},
 v2c08:{alice:a=>outcome(a.age>=10&&a.age<=17&&a.guardianConsent&&(a.student||a.member),a.scholarship?300:1300),bob:a=>outcome(a.age>=10&&a.age<=17&&(a.student||(a.member&&a.guardianConsent)),a.scholarship?300:1300)},
 v2c10:{alice:a=>outcome(common10(a)&&t(a.submittedAt)>t(decOpen)&&t(a.submittedAt)<t(decClose),a.scholarship?0:700),bob:a=>outcome(common10(a)&&t(a.submittedAt)>=t(decOpen)&&t(a.submittedAt)<t(decClose),a.scholarship?0:700)},
 v2c11:{alice:a=>outcome(a.resident&&a.age>=21&&!a.student,a.student?500:a.member?1000:2000),bob:a=>outcome(a.resident&&a.age>=21&&!a.student,a.member?1000:2000)},
 v2c12:{alice:a=>outcome(common12(a)&&(!a.scholarship||a.student),a.student?1100:2400),bob:a=>outcome(common12(a)&&(a.student||a.scholarship),a.student?1100:2400)},
};
const reviewerBoundaries={v2c01:[apr],v2c07:[leapOpen,leapStart,leapEnd,leapClose],v2c10:[decOpen,decClose]};
const labels={v2c01:'different',v2c02:'equivalent',v2c03:'equivalent',v2c04:'different',v2c05:'different',v2c06:'unresolved',v2c07:'equivalent',v2c08:'different',v2c09:'unresolved',v2c10:'different',v2c11:'equivalent',v2c12:'different'};
const notes={v2c01:'Strict before versus inclusive UTC deadline.',v2c02:'Age, membership/consent requirement and ordered fee branches match despite negated exclusions.',v2c03:'Scholarship explicitly overrides membership fee; youth consent and age branches match.',v2c04:'English excludes the intersection of residency/student; Spanish excludes either group.',v2c05:'Explicit first-match scholarship/member order changes overlapping applicants.',v2c06:'English local time has no timezone or locality; whole comparison correctly unresolved despite a precise Spanish timestamp.',v2c07:'The open English interval spans exactly leap day2028 at millisecond precision, matching both inclusive Spanish endpoints.',v2c08:'Spanish student branch waives the guardian consent required in English.',v2c09:'English overlapping membership/student fees have no stated precedence; Spanish ordering cannot supply it for English.',v2c10:'Exclusive versus inclusive opening instant, with shared exclusive closing time.',v2c11:'The extra English student fee is unreachable because admission excludes students.',v2c12:'English scholarship implies student; Spanish requires student or scholarship. These constraints differ.'};
const inputs=await read('holdout/provider-inputs.json'),gold=await read('holdout/goldens.json');
assert.equal(inputs.cases.length,12);assert.equal(gold.cases.length,12);assert.equal(new Set(inputs.cases.map(x=>x.id)).size,12);
let checks=0,examples=0;const cases=[];
for(const item of inputs.cases){
 assert.deepEqual(Object.keys(item).sort(),['id','title','alice','bob'].sort());
 const g=gold.cases.find(x=>x.id===item.id);assert.ok(g);assert.equal(g.status,labels[item.id]);
 if(g.status==='unresolved'){
  assert.deepEqual(g.examples,[]);
  for(const editor of ['alice','bob'])assert.throws(()=>expectedOutcome(item.id,editor,{age:25,resident:true,student:true,member:true,guardianConsent:true,scholarship:false,submittedAt:'2029-01-01T00:00:00.000Z'}));
  cases.push({caseId:item.id,status:g.status,checks:0,sourceReview:notes[item.id]});continue;
 }
 const times=new Set([Date.parse('0000-01-01T00:00:00.000Z'),Date.parse('9999-12-31T23:59:59.999Z'),Date.parse('2029-01-01T00:00:00.000Z')]);
 for(const b of [...(reviewerBoundaries[item.id]??[]),...(boundaryInstants[item.id]??[])])for(const offset of [-1,0,1]){const ms=Date.parse(b)+offset;if(ms>=Date.parse('0000-01-01T00:00:00.000Z')&&ms<=Date.parse('9999-12-31T23:59:59.999Z'))times.add(ms);}
 let c=0,differences=0;
 for(let age=0;age<=120;age++)for(let bits=0;bits<32;bits++)for(const ms of times){
  const a={age,resident:!!(bits&1),student:!!(bits&2),member:!!(bits&4),guardianConsent:!!(bits&8),scholarship:!!(bits&16),submittedAt:new Date(ms).toISOString()};
  const left=refs[item.id].alice(a),right=refs[item.id].bob(a);
  assert.deepEqual(expectedOutcome(item.id,'alice',a),left,item.id+' alice '+JSON.stringify(a));assert.deepEqual(expectedOutcome(item.id,'bob',a),right,item.id+' bob '+JSON.stringify(a));c+=2;
  if(JSON.stringify(left)!==JSON.stringify(right))differences++;
 }
 assert.equal(differences>0,g.status==='different');checks+=c;
 for(const e of g.examples){assert.deepEqual(e.left,refs[item.id].alice(e.attendee),item.id+' literal left');assert.deepEqual(e.right,refs[item.id].bob(e.attendee),item.id+' literal right');examples+=2;}
 cases.push({caseId:item.id,status:g.status,checks:c,sourcePartitionAttendeeDifferences:differences,sourceReview:notes[item.id]});
}
const inputHashes={};for(const name of ['provider-inputs.json','goldens.json','independent-oracle.mjs'])inputHashes[name]=hash(await fs.readFile(path.join(DIR,'holdout',name)));
const result={status:'passed',reviewer:'Independent assistant agent, not human bilingual validation',reviewedAt:new Date().toISOString(),cases:12,labels:{different:6,equivalent:4,unresolved:2},independentReferenceChecks:checks,handpickedOutcomeChecks:examples,discrepancies:0,providerCalls:0,modelOutputsViewed:false,inputHashes,caseReviews:cases,limitations:['Twelve synthetic cases and one sample per arm do not establish general superiority.','Independent AI-authored reference functions are not human bilingual validation.','Classification, witness validity, compiled-rule fidelity and workflow success must be reported separately.','Author and reviewer functions compare all integer ages/flags and source time partitions; these counts are outcomes, not independent policies.']};
await fs.writeFile(path.join(DIR,'preflight-audit.json'),JSON.stringify(result,null,2)+'\n');
await fs.writeFile(path.join(DIR,'preflight-audit.txt'),`Preflight passed for12 fresh policy pairs (6 different,4 equivalent,2 unresolved).\nIndependent reviewer checked ${checks} reference outcomes and ${examples} literal outcome assertions. No discrepancies or source corrections.\nAI review, not human validation. No provider calls or live outputs.\n`);
console.log(JSON.stringify({status:result.status,cases:12,independentReferenceChecks:checks,handpickedOutcomeChecks:examples,discrepancies:0,providerCalls:0},null,2));
