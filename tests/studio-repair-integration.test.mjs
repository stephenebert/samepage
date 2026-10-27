import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createStudioDemoRoom, applyStudioAction } from '../lib/studio.ts';
import { startStudioRepair } from '../lib/studio-repair.ts';
import { studioModelConfig } from '../lib/studio-model.ts';
import { interpretStudioRepair, parseStudioRepairWire, buildStudioRepairPrompt } from '../lib/studio-repair-model.ts';
import { runAutomaticStudioRepair, parseStudioRepairRequest } from '../lib/automatic-studio-repair.ts';
import { PolicyModelError } from '../lib/policy-model.ts';
let originalFetch, forbidden = 0;
before(() => { originalFetch = globalThis.fetch; globalThis.fetch = () => { forbidden++; throw Error('No network authorized in tests'); }; });
after(() => { globalThis.fetch = originalFetch; assert.equal(forbidden, 0); });
const now = '2026-10-27T04:00:00.000Z';
const config = studioModelConfig({MODEL_API_KEY:'synthetic-only', SAMEPAGE_STUDIO_META_ENABLED:'true', SAMEPAGE_STUDIO_PROTOCOL:'expression-v3', SAMEPAGE_STUDIO_REASONING_EFFORT:'low'});
const eligibility = {op:'all',args:[{op:'age',cmp:'gte',value:16},{op:'any',args:[{op:'age',cmp:'gte',value:18},{op:'flag',field:'guardianConsent',value:true}]}]};
const baselineRules = {eligibility,fee:{currency:'USD',defaultCents:2000,overrides:[]}};
const baselineText = {en:'Ages 16 and above may join. Under-18s need guardian consent. No deadline. Every admitted attendee pays $20 USD.',es:'Pueden participar personas de 16 años o más. Los menores de 18 necesitan consentimiento del tutor. Sin fecha límite. Cada participante admitido paga 20 dólares estadounidenses.'};
const fixedText = {en:baselineText.en+' Admitted scholarship holders instead pay $0; admission requirements are unchanged.',es:baselineText.es+' Los participantes admitidos con beca pagan 0 dólares; los requisitos de admisión no cambian.'};
function initial(){return createStudioDemoRoom('repair-wire',now,{...baselineText,candidates:['alice','bob'].map(editor=>({editor,...baselineText,rules:baselineRules,issues:[]}))});}
function intent(room){return {baselineCandidateId:room.review.candidates[0].id,scopeFlag:'scholarship',feeCents:0};}
const rawRules=()=>({eligibility:'age >= 16 && (age >= 18 || guardianConsent)',fee:{currency:'USD',defaultCents:2000,overrides:[{when:'scholarship',cents:0,label:'Scholarship'}]}});
const response=job=>({jobId:job.id,...(job.proposalText??fixedText),englishRules:rawRules(),spanishRules:rawRules(),issues:[]});
const modelResponse=value=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}],usage:{prompt_tokens:100,completion_tokens:200,total_tokens:300}});
function memory(){let room=initial(),tail=Promise.resolve(),time=now,n=0;return {get room(){return room;},setClock(t){time=t;},deps:{now:()=>time,requestId:()=>`request-${++n}`,mutate:(_id,fn)=>{const p=tail.then(()=>{const next=fn(room);if(next!==room)assert.equal(next.revision,room.revision+1);room=next;return room;});tail=p.catch(()=>{});return p;}},action(action){return this.deps.mutate(room.id,r=>applyStudioAction(r,action,time));}};}
const adapter=(observe=()=>{})=>(job,cfg,options)=>interpretStudioRepair(job,cfg,{...options,fetch:async(url,init)=>{const body=JSON.parse(init.body);observe(body);assert.equal(url,'https://api.meta.ai/v1/chat/completions');return modelResponse(response(job));}});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {resolve,promise};};

test('repair request rejects arbitrary rules, client token budgets and malformed intent before any provider call',()=>{
 const i=intent(initial());
 for(const input of [{intent:i,maxCompletionTokens:12288},{intent:i,rules:{}},{intent:i,retry:'true'},{intent:{...i,scopeFlag:'citizenship'}},{intent:i,proposalText:{en:'x'}}])assert.throws(()=>parseStudioRepairRequest(input));
 assert.deepEqual(parseStudioRepairRequest({intent:i}),{intent:i});
});
test('wire decoder checks job/source identity, expression syntax, whole-policy status and both language outcomes',()=>{
 const room=initial(),job=startStudioRepair(room,intent(room),now,'repair-job',fixedText).repair.job;
 assert.equal(parseStudioRepairWire(response(job),job).rules.fee.overrides[0].cents,0);
 assert.throws(()=>parseStudioRepairWire({...response(job),jobId:'wrong'},job));
 assert.throws(()=>parseStudioRepairWire({...response(job),en:'rewritten without authorization'},job));
 const mismatch=response(job);mismatch.spanishRules.eligibility='age >= 16';
 assert.equal(parseStudioRepairWire(mismatch,job).rules,null);
 const invalid=response(job);invalid.englishRules.eligibility='process.exit()';assert.throws(()=>parseStudioRepairWire(invalid,job));
 assert.throws(()=>parseStudioRepairWire({...response(job),englishRules:null},job));
 assert.equal(parseStudioRepairWire({...response(job),englishRules:null,issues:['Clarify admission.']},job).rules,null);
 assert.match(buildStudioRepairPrompt(job),/Do NOT fix or align/);
 assert.doesNotMatch(buildStudioRepairPrompt(job),/"targetRules":/,'custom rewrite must be interpreted as written, not repaired toward the target');
});
test('generated repair receives an unconditional target-group override derived from the chosen baseline',()=>{
 const room=initial();
 room.review.candidates[0].rules.fee.overrides=[{when:{op:'all',args:[{op:'flag',field:'scholarship',value:true},{op:'age',cmp:'lte',value:19}]},cents:600,label:'Youth scholarship'}];
 const job=startStudioRepair(room,intent(room),now,'repair-scope').repair.job;
 const prompt=buildStudioRepairPrompt(job),snapshot=JSON.parse(prompt.split('Snapshot:\n')[1]);
 assert.deepEqual(snapshot.targetRules.fee.overrides[0],{when:'scholarship',cents:0,label:'Agreed scholarship fee'});
 assert.match(snapshot.targetRules.fee.overrides[1].when,/age <= 19/);
 assert.equal(snapshot.targetRules.eligibility,snapshot.baseline.rules.eligibility);
 assert.match(prompt,/EVERY eligible attendee/);
});
test('actual structured adapter is bounded, does not retry, and keeps model output out of publication',async()=>{
 const store=memory();let count=0;
 const result=await runAutomaticStudioRepair(store.room.id,config,{intent:intent(store.room)},{...store.deps,interpret:adapter(body=>{count++;assert.equal(body.reasoning_effort,'low');assert.equal(body.max_completion_tokens,8192);assert.equal(body.response_format.json_schema.strict,true);assert.doesNotMatch(JSON.stringify(body.response_format),/"\$ref"/);})});
 assert.equal(count,1);assert.equal(result.room.repair.status,'ready');assert.equal(result.room.published.version,1);assert.deepEqual(result.room.repair.votes,{});assert.equal(result.room.modelCallCount,1);assert.equal(result.room.automaticRepair.metrics.finishReason,'stop');
 const repeat=await runAutomaticStudioRepair(store.room.id,config,{intent:intent(store.room)},{...store.deps,interpret:()=>assert.fail('idempotent repeat cannot spend')});assert.equal(repeat.automatic.status,'already-reviewed');
});
test('concurrent requests claim one provider attempt and a draft edit discards its eventual result',async()=>{
 const store=memory(),gate=deferred(),started=deferred();let calls=0;
 const run=runAutomaticStudioRepair(store.room.id,config,{intent:intent(store.room)},{...store.deps,interpret:async(job)=>{calls++;started.resolve();await gate.promise;return parseStudioRepairWire(response(job),job);}});
 await started.promise;
 const second=await runAutomaticStudioRepair(store.room.id,config,{intent:{...intent(store.room),scopeFlag:'member',feeCents:700}},{...store.deps,interpret:()=>assert.fail('different concurrent intent cannot claim a second request')});assert.equal(second.httpStatus,202);
 await store.action({type:'draft',editor:'bob',baseVersion:store.room.drafts.bob.version,text:baselineText.es+' Texto adicional.'});
 gate.resolve();const result=await run;assert.equal(calls,1);assert.equal(result.automatic.status,'superseded');assert.equal(store.room.published.version,1);assert.equal(store.room.repair.proposal,null);
});
test('incomplete repair fails closed, retains safe diagnostics, and requires explicit retry',async()=>{
 const store=memory(),input={intent:intent(store.room)};
 const incomplete=(job,cfg,opts)=>interpretStudioRepair(job,cfg,{...opts,fetch:async()=>Response.json({choices:[{finish_reason:'length',message:{content:'{"jobId":'}}],usage:{prompt_tokens:99,completion_tokens:8192}})});
 const failed=await runAutomaticStudioRepair(store.room.id,config,input,{...store.deps,interpret:incomplete});
 assert.equal(failed.automatic.error.code,'MODEL_OUTPUT_LIMIT');assert.equal(store.room.repair.status,'failed');assert.equal(store.room.repair.proposal,null);assert.equal(store.room.automaticRepair.metrics.finishReason,'length');
 const repeat=await runAutomaticStudioRepair(store.room.id,config,input,{...store.deps,interpret:()=>assert.fail('automatic retry')});assert.equal(repeat.httpStatus,409);assert.equal(store.room.modelCallCount,1);
 await runAutomaticStudioRepair(store.room.id,config,{...input,retry:true},{...store.deps,interpret:adapter()});assert.equal(store.room.modelCallCount,2);assert.equal(store.room.repair.status,'ready');
});
test('disabled mode and shared attempt cap never invoke provider',async()=>{
 const store=memory();
 await assert.rejects(runAutomaticStudioRepair(store.room.id,{...config,enabled:false},{intent:intent(store.room)},{...store.deps,interpret:()=>assert.fail('disabled')}),{code:'MODEL_DISABLED'});
 await store.deps.mutate(store.room.id,r=>({...r,revision:r.revision+1,modelCallCount:5}));
 await assert.rejects(runAutomaticStudioRepair(store.room.id,config,{intent:intent(store.room)},{...store.deps,interpret:()=>assert.fail('quota')}),{code:'MODEL_CALL_LIMIT'});
});
test('late result cannot pass a lease or publish',async()=>{
 const store=memory();
 const result=await runAutomaticStudioRepair(store.room.id,config,{intent:intent(store.room)},{...store.deps,interpret:async job=>{store.setClock('2026-10-27T04:02:00.000Z');return parseStudioRepairWire(response(job),job);}});
 assert.equal(result.automatic.error.code,'MODEL_INTERRUPTED');assert.equal(store.room.repair.status,'failed');assert.equal(store.room.published.version,1);
});
test('expired request returning after explicit retry cannot replace the new repair or approval',async()=>{
 const store=memory(),gate=deferred(),started=deferred(),input={intent:intent(store.room)};
 const first=runAutomaticStudioRepair(store.room.id,config,input,{...store.deps,interpret:async job=>{started.resolve();await gate.promise;return parseStudioRepairWire(response(job),job);}});
 await started.promise;store.setClock('2026-10-27T04:02:00.000Z');
 const second=await runAutomaticStudioRepair(store.room.id,config,{...input,retry:true},{...store.deps,interpret:adapter()});
 assert.equal(second.room.repair.status,'ready');assert.equal(second.room.modelCallCount,2);
 await store.action({type:'voteRepair',editor:'alice',repairId:store.room.repair.id});
 const snapshot=JSON.stringify(store.room);gate.resolve();const late=await first;
 assert.equal(late.automatic.status,'superseded');assert.equal(JSON.stringify(store.room),snapshot);assert.deepEqual(store.room.repair.votes,{alice:true});
});
test('a real interpreted overbroad rewrite remains visible but both editors are blocked from publishing',async()=>{
 const store=memory(),proposalText={en:'Anyone age 16 or over may join, even without consent. No deadline. Admission costs $20 except scholarships pay $0.',es:'Cualquier persona de 16 años o más puede participar, incluso sin consentimiento. Sin fecha límite. La entrada cuesta 20 dólares, salvo que las becas pagan 0.'};
 const result=await runAutomaticStudioRepair(store.room.id,config,{intent:intent(store.room),proposalText},{...store.deps,interpret:(job,cfg,opts)=>interpretStudioRepair(job,cfg,{...opts,fetch:async()=>{const v=response(job);v.englishRules.eligibility='age >= 16';v.spanishRules.eligibility='age >= 16';return modelResponse(v);}})});
 assert.equal(result.room.repair.status,'blocked');assert.ok(result.room.repair.impact.verification.witnesses.some(w=>!w.left.accepted&&w.right.accepted));
 for(const editor of ['alice','bob'])await assert.rejects(store.action({type:'voteRepair',editor,repairId:store.room.repair.id}),{code:'REPAIR_BLOCKED'});
 assert.equal(store.room.published.version,1);assert.deepEqual(store.room.registrations,[]);
});
