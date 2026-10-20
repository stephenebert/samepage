import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStudioAction, createStudioRoom, createStudioDemoRoom, parseStudioReview } from '../lib/studio.ts';
const now='2026-10-20T12:00:00.000Z';
const rules={eligibility:{op:'age',cmp:'gte',value:18},fee:{currency:'USD',defaultCents:8000,overrides:[]}};
const person={age:24,resident:false,student:false,member:false,guardianConsent:false,scholarship:false,submittedAt:'2026-10-26T12:00:00.000Z'};
const act=(r,a)=>applyStudioAction(r,a,now);
function prepare(){let r=createStudioRoom('test',now);r=act(r,{type:'draft',editor:'alice',baseVersion:1,text:'Adults 18 and older. No deadline. Fee $80.'});r=act(r,{type:'draft',editor:'bob',baseVersion:1,text:'Personas de 18 años o más. Sin fecha límite. Tarifa de $80.'});return act(r,{type:'requestReview'});}
function response(r,patch={}){return {jobId:r.activeJob.id,candidates:['alice','bob'].map(editor=>({editor,sourceVersion:r.drafts[editor].version,en:r.drafts.alice.text,es:r.drafts.bob.text,rules,issues:[],...patch}))};}
const interpreted=()=>{const r=prepare();return act(r,{type:'completeReview',response:response(r)});};
const vote=(r,editor,candidateEditor='alice')=>act(r,{type:'vote',editor,reviewId:r.review.id,candidateId:r.review.candidates.find(c=>c.editor===candidateEditor).id});
const register=(r,requestId,patch={})=>act(r,{type:'register',requestId,policyVersion:r.published.version,label:'Synthetic attendee',...person,...patch});

test('one approval and split approvals hold; matching current approvals publish once',()=>{
 let r=interpreted();const old=r.published;r=vote(r,'alice');assert.deepEqual(r.published,old);r=vote(r,'bob','bob');assert.deepEqual(r.published,old);r=vote(r,'bob');assert.equal(r.published.version,2);assert.equal(r.review.status,'published');assert.equal(r.published.rules.fee.defaultCents,8000);assert.equal(vote(r,'bob'),r);
 assert.throws(()=>vote(r,'alice','bob'),e=>e.code==='STALE_REVIEW');
});
test('concurrent editor saves preserve both drafts; same-editor stale save cannot overwrite',()=>{
 const initial=createStudioRoom('same',now);
 let r=act(initial,{type:'draft',editor:'alice',baseVersion:1,text:'Alice new full policy'});
 r=act(r,{type:'draft',editor:'bob',baseVersion:1,text:'Bob new full policy'});assert.equal(r.drafts.alice.version,2);assert.equal(r.drafts.bob.version,2);
 assert.throws(()=>act(r,{type:'draft',editor:'alice',baseVersion:1,text:'Lost update'}),e=>e.code==='STALE_DRAFT');
});
test('editing either draft invalidates both approvals and rejects stale review completion',()=>{
 let r=interpreted();r=vote(r,'alice');const review=r.review;
 r=act(r,{type:'draft',editor:'bob',baseVersion:2,text:r.drafts.bob.text+' Cambio.'});assert.equal(r.review,null);
 assert.throws(()=>act(r,{type:'vote',editor:'bob',reviewId:review.id,candidateId:review.candidates[0].id}),e=>e.code==='STALE_REVIEW');
 const p=prepare(),oldResponse=response(p);let next=act(p,{type:'draft',editor:'alice',baseVersion:2,text:p.drafts.alice.text+' New.'});next=act(next,{type:'requestReview'});
 assert.throws(()=>act(next,{type:'completeReview',response:oldResponse}),e=>e.code==='STALE_REVIEW');
});
test('exact source and draft identity are required; unsupported candidate remains wholly null',()=>{
 const r=prepare();let bad=response(r);bad.candidates[0].en+=' ';assert.throws(()=>parseStudioReview(bad,r.activeJob),e=>e.code==='SOURCE_CHANGED');
 bad=response(r);bad.candidates[0].sourceVersion--;assert.throws(()=>parseStudioReview(bad,r.activeJob),e=>e.code==='STALE_REVIEW');
 bad=response(r,{rules:null,issues:['Unspecified priority for overlapping fee exceptions.']});let blocked=act(r,{type:'completeReview',response:bad});assert.equal(blocked.review.discovery.status,'unresolved');assert.throws(()=>vote(blocked,'alice'),e=>e.code==='UNRESOLVED');
 assert.throws(()=>parseStudioReview(response(r,{issues:['An ambiguity remains.']}),r.activeJob),/executable interpretations/);
 assert.throws(()=>parseStudioReview({...response(r),autoApprove:true},r.activeJob),/unexpected/);
});
test('registration receipts remain immutable across publication and duplicate retries',()=>{
 let r=interpreted();r=register(r,'before');const receipt=structuredClone(r.registrations[0]);assert.equal(receipt.decision.feeCents,0);
 r=vote(vote(r,'alice'),'bob');r=register(r,'after');assert.deepEqual(r.registrations[0],receipt);assert.equal(r.registrations[1].decision.feeCents,8000);assert.equal(r.registrations[1].policyVersion,2);
 assert.equal(register(r,'after'),r);
 const stale={type:'register',requestId:'stale',policyVersion:1,label:'Synthetic attendee',...person};assert.throws(()=>act(r,stale),e=>e.code==='STALE_POLICY');
 assert.throws(()=>register(r,'after',{age:25}),e=>e.code==='DUPLICATE_ID');
 assert.equal(act(r,{...stale,requestId:'before'}),r);
});
test('demo fixture is opt-in, parsed through exact-source validation, and does not fabricate votes',()=>{
 const p=prepare(),data=response(p);const fixture={en:p.drafts.alice.text,es:p.drafts.bob.text,candidates:data.candidates.map(({sourceVersion,...c})=>c)};
 const r=createStudioDemoRoom('fixture',now,fixture);assert.equal(r.review.provenance,'fixture-replay');assert.deepEqual(r.review.votes,{});assert.equal(r.published.version,1);assert.equal(r.registrations.length,0);
 fixture.candidates[0].en+=' silently changed';assert.throws(()=>createStudioDemoRoom('invalid',now,fixture),e=>e.code==='SOURCE_CHANGED');
});
test('manual workflow and consequence discovery never invoke a network/model provider',()=>{
 const oldFetch=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw new Error('No paid calls authorized');};
 try{let r=interpreted();r=vote(vote(r,'alice'),'bob');r=register(r,'free-test');assert.equal(r.registrations.length,1);assert.equal(calls,0);}finally{globalThis.fetch=oldFetch;}
});


test('one unresolved draft blocks approval of the other executable interpretation',()=>{
 const p=prepare(), data=response(p); data.candidates[1].rules=null; data.candidates[1].issues=['Overlapping fee priority is unspecified.'];
 const room=act(p,{type:'completeReview',response:data});
 assert.equal(room.review.discovery.status,'unresolved');assert.ok(room.review.candidates[0].rules);
 const snapshot=structuredClone(room);
 for(const editor of ['alice','bob']) assert.throws(()=>vote(room,editor,'alice'),e=>e.code==='UNRESOLVED');
 assert.deepEqual(room,snapshot);assert.equal(room.published.version,1);assert.deepEqual(room.review.votes,{});
});

test('search-limit uncertainty blocks every approval even when both candidates are executable',()=>{
 const base=Date.parse('2027-01-01T00:00:00.000Z');
 function largePolicy(offset){return {eligibility:{op:'any',args:Array.from({length:16},(_,i)=>({op:'age',cmp:'gte',value:i*3+offset}))},fee:{currency:'USD',defaultCents:8000,overrides:Array.from({length:10},(_,i)=>({when:{op:'all',args:Array.from({length:7},(_,j)=>({op:'time',cmp:'lt',value:new Date(base+(i*7+j)*1000+offset*200000).toISOString()}))},cents:i*100,label:'Explicit ordered fee tier'}))}};}
 const p=prepare(),data=response(p);data.candidates[0].rules=largePolicy(0);data.candidates[1].rules=largePolicy(1);
 const room=act(p,{type:'completeReview',response:data});
 assert.equal(room.review.discovery.status,'unresolved');assert.match(room.review.discovery.issues[0],/bounded search limit/);assert.ok(room.review.candidates.every(c=>c.rules&&c.issues.length===0));
 for(const editor of ['alice','bob']) for(const candidate of ['alice','bob']) assert.throws(()=>vote(room,editor,candidate),e=>e.code==='UNRESOLVED');
 assert.deepEqual(room.review.votes,{});assert.equal(room.published.version,1);
});
