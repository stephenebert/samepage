import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { applyStudioAction, createStudioRoom } from '../lib/studio.ts';
import { canonicalStudioPolicy } from '../lib/studio-presentation.ts';
import { evaluateStudioPolicy } from '../lib/studio-engine.ts';
import { startStudioRepair, completeStudioRepair, voteStudioRepair, buildExpectedRepairRules } from '../lib/studio-repair.ts';
import { buildStudioWirePrompt } from '../lib/studio-model.ts';
import { buildStudioRepairPrompt, parseStudioRepairWire } from '../lib/studio-repair-model.ts';
import { encodeStudioExpressionRules } from '../lib/studio-expression.ts';

let savedFetch, networkCalls=0;
before(()=>{savedFetch=globalThis.fetch;globalThis.fetch=()=>{networkCalls++;throw Error('Network forbidden');};});
after(()=>{globalThis.fetch=savedFetch;assert.equal(networkCalls,0);});
const now='2026-10-27T12:00:00.000Z', copy=x=>JSON.parse(JSON.stringify(x));
const all=(...args)=>({op:'all',args}), any=(...args)=>({op:'any',args});
const age=(cmp,value)=>({op:'age',cmp,value}),flag=(field,value=true)=>({op:'flag',field,value});
const sourceEn='No deadline. Applicants aged 14–17 need guardian consent and must be either residents or students who are not members. Applicants aged 18 or older must be either residents without scholarships or students who are members or lack scholarships. Everyone else is rejected. Admitted attendees pay USD 64, except members pay USD 36 first.';
const sourceEs='Sin fecha límite. Entre los 14 y los 17 años se exige consentimiento del tutor Y (residencia O (ser estudiante Y no ser miembro)). A partir de los 18 años se exige ((residencia Y no tener beca) O (ser estudiante Y (ser miembro O no tener beca))). Las demás personas se rechazan. Solo se cobra a las personas admitidas: primero, miembros 36 USD; en otro caso 64 USD.';
// Exact adult-branch wording retained from the observed prior model ambiguity.
const ambiguousEs='(2) tiene al menos 18 años, y es residente sin beca, o es estudiante que cumple al menos una de estas dos condiciones: ser miembro, o no tener beca.';
function rules(){return {eligibility:any(
  all(age('gte',14),age('lte',17),flag('guardianConsent'),any(flag('resident'),all(flag('student'),flag('member',false)))),
  all(age('gte',18),any(all(flag('resident'),flag('scholarship',false)),all(flag('student'),any(flag('member'),flag('scholarship',false)))))
),fee:{currency:'USD',defaultCents:6400,overrides:[{when:flag('member'),cents:3600,label:'member'}]}};}
const witness={age:17,resident:false,student:true,member:true,guardianConsent:true,scholarship:false,submittedAt:now};
function reviewed(){
 let r=createStudioRoom('grouping-regression',now);
 for(const [editor,text] of [['alice',sourceEn],['bob',sourceEs]])r=applyStudioAction(r,{type:'draft',editor,baseVersion:r.drafts[editor].version,text},now);
 r=applyStudioAction(r,{type:'requestReview'},now);
 const job=r.activeJob;
 return applyStudioAction(r,{type:'completeReview',response:{jobId:job.id,candidates:[
  {editor:'alice',sourceVersion:job.drafts.alice.version,en:sourceEn,es:ambiguousEs,rules:rules(),issues:[]},
  {editor:'bob',sourceVersion:job.drafts.bob.version,en:sourceEn,es:sourceEs,rules:rules(),issues:[]}
 ]}},now);
}
function vote(r,editor){return applyStudioAction(r,{type:'vote',editor,reviewId:r.review.id,candidateId:r.review.candidates[0].id},now);}
const intent=r=>({baselineCandidateId:r.review.candidates[0].id,scopeFlag:'resident',feeCents:4200});
function ready(r=reviewed()){
 r=startStudioRepair(r,intent(r),now);
 return completeStudioRepair(r,r.repair.id,{en:sourceEn,es:ambiguousEs,rules:buildExpectedRepairRules(r.repair.job.baseline.rules,r.repair.job.intent),issues:[]},now);
}

test('known Spanish scope ambiguity is preserved as evidence but cannot become new authoritative wording',()=>{
 const r=reviewed(), candidate=r.review.candidates[0], original=copy(candidate);
 const shown=canonicalStudioPolicy(candidate.rules), old=copy(r.published);
 assert.match(shown.es,/\(la edad es de 18 años o más\) y \(\(\(la persona es residente\) y \(la persona no tiene beca\)\) o \(\(la persona es estudiante\) y \(\(la persona es miembro\) o \(la persona no tiene beca\)\)\)\)/);
 assert.match(shown.en,/\(the person is at least 18 years old\) and \(\(\(the person is a resident\)/);
 assert.equal(evaluateStudioPolicy(candidate.rules,witness).accepted,false);
 const one=vote(r,'alice');assert.deepEqual(one.published,old);
 const both=vote(one,'bob');assert.deepEqual({en:both.published.en,es:both.published.es},shown);
 assert.deepEqual(both.published.originalWording,{en:sourceEn,es:ambiguousEs});
 assert.equal(both.published.wordingSource,'checked-rules-v1');
 assert.deepEqual(both.review.candidates[0],original);
 assert.equal(evaluateStudioPolicy(both.published.rules,witness).accepted,false);
 assert.notEqual(both.published.es,ambiguousEs);
});

test('repair approval publishes the exact grouped preview and retains both raw proposal strings',()=>{
 let r=ready(),old=copy(r.published),raw={en:r.repair.proposal.en,es:r.repair.proposal.es};
 const shown=canonicalStudioPolicy(r.repair.proposal.rules),id=r.repair.id;
 r=voteStudioRepair(r,'alice',id,now);assert.deepEqual(r.published,old);
 r=voteStudioRepair(r,'bob',id,now);
 assert.deepEqual({en:r.published.en,es:r.published.es},shown);
 assert.deepEqual(r.published.originalWording,raw);
 assert.equal(r.published.wordingSource,'checked-rules-v1');
 assert.equal(r.repair.proposal.es,ambiguousEs);
 assert.match(r.published.es,/residente: 42,00 USD/);
 assert.equal(evaluateStudioPolicy(r.published.rules,witness).accepted,false);
});

test('an actual age-scope broadening in the interpreted rules remains blocked',()=>{
 let r=reviewed();r=startStudioRepair(r,intent(r),now);
 const unsafe=buildExpectedRepairRules(r.repair.job.baseline.rules,r.repair.job.intent);
 unsafe.eligibility=any(all(age('gte',18),flag('resident')),all(flag('student'),flag('member')));
 assert.equal(evaluateStudioPolicy(unsafe,witness).accepted,true);
 r=completeStudioRepair(r,r.repair.id,{en:sourceEn,es:ambiguousEs,rules:unsafe,issues:[]},now);
 assert.equal(r.repair.status,'blocked');
 for(const editor of ['alice','bob'])assert.throws(()=>voteStudioRepair(r,editor,r.repair.id,now),{code:'REPAIR_BLOCKED'});
 assert.equal(r.published.version,1);
});

test('a supplied rewrite is interpreted verbatim and canonical publication cannot conceal an unsafe change',()=>{
 let r=reviewed();const supplied={en:' Unsafe editor rewrite. ',es:' Reescritura insegura. '};
 r=startStudioRepair(r,intent(r),now,'repair-verbatim',supplied);
 const unsafe=buildExpectedRepairRules(r.repair.job.baseline.rules,r.repair.job.intent);unsafe.eligibility={op:'always'};
 const wire={jobId:r.repair.id,...supplied,englishRules:encodeStudioExpressionRules(unsafe),spanishRules:encodeStudioExpressionRules(unsafe),issues:[]};
 const proposal=parseStudioRepairWire(wire,r.repair.job);assert.deepEqual({en:proposal.en,es:proposal.es},supplied);
 assert.throws(()=>parseStudioRepairWire({...wire,es:wire.es.trim()},r.repair.job));
 r=completeStudioRepair(r,r.repair.id,proposal,now);assert.equal(r.repair.status,'blocked');
 assert.deepEqual({en:r.repair.proposal.en,es:r.repair.proposal.es},supplied);
 assert.throws(()=>voteStudioRepair(r,'alice',r.repair.id,now),{code:'REPAIR_BLOCKED'});
});

test('legacy pending votes and legacy published records are not migrated beneath their approvals',()=>{
 let r=reviewed();delete r.review.wordingSource;r=vote(r,'alice');
 const pending=copy(r);r=vote(r,'bob');
 assert.equal(r.published.es,ambiguousEs);assert.equal(r.published.wordingSource,undefined);
 assert.equal(pending.review.votes.alice,r.review.candidates[0].id);
 const legacy=copy(r.published);
 r=applyStudioAction(r,{type:'draft',editor:'alice',baseVersion:r.drafts.alice.version,text:sourceEn+' Revised.'},now);
 assert.deepEqual(r.published,legacy);
 let repair=ready();delete repair.repair.wordingSource;const id=repair.repair.id;
 repair=voteStudioRepair(repair,'alice',id,now);repair=voteStudioRepair(repair,'bob',id,now);
 assert.equal(repair.published.es,ambiguousEs);assert.equal(repair.published.wordingSource,undefined);
});

test('unresolved language remains unresolved instead of being replaced with canonical rules',()=>{
 let r=reviewed();r=startStudioRepair(r,intent(r),now);
 r=completeStudioRepair(r,r.repair.id,{en:sourceEn,es:ambiguousEs,rules:null,issues:['Clarify which alternatives require age 18.']},now);
 assert.equal(r.repair.status,'blocked');assert.equal(r.repair.proposal.rules,null);
 assert.throws(()=>voteStudioRepair(r,'bob',r.repair.id,now),{code:'REPAIR_BLOCKED'});
 assert.throws(()=>canonicalStudioPolicy(null));
});

test('generation prompts explicitly require visible scope but checking a supplied rewrite forbids rewriting it',()=>{
 const r=reviewed();const job={id:r.review.id,basePolicyVersion:1,drafts:r.drafts,prompt:'',createdAt:now};
 assert.match(buildStudioWirePrompt(job,'expression-v3'),/make every AND\/OR scope explicit in BOTH languages/);
 const repair=ready(),generated=buildStudioRepairPrompt(repair.repair.job);
 assert.match(generated,/repeat each shared qualifier in every alternative/);
 const supplied=buildStudioRepairPrompt({...repair.repair.job,proposalText:{en:'text',es:'texto'}});
 assert.match(supplied,/byte-for-byte unchanged/);assert.match(supplied,/never silently add grouping/);
 assert.doesNotMatch(supplied,/make every AND\/OR scope explicit in BOTH languages/);
});
