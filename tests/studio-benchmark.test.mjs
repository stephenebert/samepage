import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BENCHMARK_CONFIG, BENCHMARK_RUN_ID, BENCHMARK_MAX_REQUEST_BYTES, BENCHMARK_MAX_NANO_USD, BENCHMARK_MAX_ATTEMPTS, createBenchmarkLedger, estimateBenchmarkReservation, parseBenchmarkDataset, parsePlainBenchmarkReview, prepareBenchmarkPlan, requireBenchmarkConfig, runBenchmarkAttempt, validateBenchmarkLedger } from '../lib/studio-benchmark.ts';
import { applyStudioAction } from '../lib/studio.ts';

let originalFetch, forbidden = 0;
before(() => { originalFetch = globalThis.fetch; globalThis.fetch = async () => { forbidden++; throw new Error('Benchmark tests cannot call a provider'); }; });
after(() => { globalThis.fetch = originalFetch; assert.equal(forbidden, 0); });
const now = '2026-10-27T22:00:00.000Z';
const config = { ...BENCHMARK_CONFIG, enabled: false, apiKey: 'offline-test-key-never-transmitted' };
const inputs = { cases: Array.from({length:12}, (_, i) => ({ id:`case${i+1}`, title:`Synthetic transport test ${i+1}`, alice:'Everyone is eligible. No deadline applies. All admitted people pay US$10.', bob:'Todas las personas pueden participar. No hay fecha límite. Cada persona admitida paga 10 dólares estadounidenses.' })) };
const dataset = await parseBenchmarkDataset(inputs);
function memory(initial = createBenchmarkLedger(dataset, now)) {
  let ledger = structuredClone(initial), tail = Promise.resolve();
  return { read: () => structuredClone(ledger), mutate: update => {
    const operation = tail.then(() => { const before = ledger, next = update(before); if(next !== before) assert.equal(next.revision, before.revision+1); ledger = structuredClone(next); return structuredClone(next); });
    tail = operation.catch(() => {}); return operation;
  } };
}
const provider = value => Response.json({ choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}], usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180,completion_tokens_details:{reasoning_tokens:20},prompt_tokens_details:{cached_tokens:0}} });
const equivalent = {status:'equivalent',explanation:'Both policies admit everyone without a deadline and charge US$10.',witness:null,issues:[]};
function call(action, store, fetch, overrides = {}) { return runBenchmarkAttempt(dataset,config,BENCHMARK_RUN_ID,action,{mutate:store.mutate,fetch,now:()=>now,...overrides}); }
const plain = caseId => ({caseId,arm:'plain-meta'});
function expressionResponse(body, different=false) {
  return {jobId:body.response_format.json_schema.schema.properties.jobId.enum[0],candidates:['alice','bob'].map(editor=>({editor,translation:editor==='alice'?inputs.cases[0].bob:inputs.cases[0].alice,rules:{eligibility:'true',fee:{currency:'USD',defaultCents:different&&editor==='bob'?1200:1000,overrides:[]}},issues:[]}))};
}
const attendee={age:30,resident:false,student:false,member:false,guardianConsent:false,scholarship:false,submittedAt:'2026-10-27T12:00:00.000Z'};

test('separate exact-run gate keeps ordinary Studio calls paused and pins all provider settings',()=>{
  assert.doesNotThrow(()=>requireBenchmarkConfig(config,BENCHMARK_RUN_ID));
  for(const gate of [undefined,'true','comparison-20261027-v2']) assert.throws(()=>requireBenchmarkConfig(config,gate),{code:'BENCHMARK_DISABLED'});
  for(const drift of [{enabled:true},{model:'different-model'},{reasoningEffort:'medium'},{protocol:'compact-v2'},{reuseUnchanged:true},{maxCompletionTokens:12288}]) assert.throws(()=>requireBenchmarkConfig({...config,...drift},BENCHMARK_RUN_ID),{code:'BENCHMARK_CONFIG'});
});

test('only twelve provider-input cases are accepted; hidden labels and duplicates fail before execution',async()=>{
  await assert.rejects(()=>parseBenchmarkDataset({...inputs,goldens:{}}),{code:'BENCHMARK_INPUT'});
  await assert.rejects(()=>parseBenchmarkDataset({cases:inputs.cases.map((x,i)=>i===0?{...x,expected:'equivalent'}:x)}),{code:'BENCHMARK_INPUT'});
  await assert.rejects(()=>parseBenchmarkDataset({cases:inputs.cases.slice(0,11)}),{code:'BENCHMARK_INPUT'});
  await assert.rejects(()=>parseBenchmarkDataset({cases:inputs.cases.map((x,i)=>i===1?{...x,id:'case1'}:x)}),{code:'BENCHMARK_INPUT'});
  const store=memory(); let calls=0;
  for(const action of [{caseId:'unknown',arm:'plain-meta'},{caseId:'case1',arm:'plain-meta',prompt:'override'},{caseId:'case1',arm:'other'}]) await assert.rejects(()=>call(action,store,async()=>{calls++;return provider(equivalent);}));
  assert.equal(calls,0); assert.equal(Object.keys(store.read().attempts).length,0);
});

test('32 KiB requests plus 4096-token framing and full output reserve keep all24 attempts below $2',()=>{
  assert.equal(estimateBenchmarkReservation(32768)*24/1e9,1.941504);
  assert.ok(estimateBenchmarkReservation(BENCHMARK_MAX_REQUEST_BYTES)*BENCHMARK_MAX_ATTEMPTS<BENCHMARK_MAX_NANO_USD);
  assert.throws(()=>estimateBenchmarkReservation(32769),{code:'BENCHMARK_SIZE'});
  assert.throws(()=>prepareBenchmarkPlan({...inputs.cases[0],alice:'界'.repeat(5900),bob:'界'.repeat(5900)},'plain-meta',config,now),{code:'BENCHMARK_SIZE'});
});

test('plain review uses the frozen strong prompt, same model and effort, and returns durable cached results',async()=>{
  const store=memory();let calls=0;
  const mock=async(url,init)=>{calls++; assert.equal(String(url),'https://api.meta.ai/v1/chat/completions');const body=JSON.parse(init.body);assert.equal(body.model,'muse-spark-1.3');assert.equal(body.reasoning_effort,'low');assert.equal(body.max_completion_tokens,8192);assert.equal(body.response_format.type,'json_schema');assert.match(body.messages[1].content,/intersections of flags/);assert.ok(body.messages[1].content.includes(JSON.stringify(inputs.cases[0].bob)));return provider(equivalent);};
  const first=await call(plain('case1'),store,mock,{claimId:()=> 'repeat-safe-test-claim'});
  assert.equal(first.attempt.status,'completed');assert.deepEqual(first.attempt.result,equivalent);assert.equal(first.attempt.metrics.totalTokens,180);
  // Even a hypothetical duplicate generated claim ID cannot authorize a second call.
  const second=await call(plain('case1'),store,mock,{claimId:()=> 'repeat-safe-test-claim'});
  assert.equal(second.replayed,true);assert.deepEqual(second.attempt,first.attempt);assert.equal(calls,1);assert.equal(store.read().inFlight,null);
  assert.ok(!JSON.stringify(store.read()).includes(config.apiKey));
});

test('samepage arm uses real interpretation/validation/discovery and leaves two approvals pending',async()=>{
  const store=memory();let calls=0;
  const out=await call({caseId:'case1',arm:'samepage'},store,async(_url,init)=>{calls++;const body=JSON.parse(init.body);assert.equal(body.response_format.json_schema.name,'samepage_studio_expression');return provider(expressionResponse(body,true));});
  assert.equal(calls,1);assert.equal(out.attempt.result.status,'different');assert.ok(out.attempt.result.witnesses.length);
  let room=out.attempt.result.room;assert.equal(room.review.provenance,'meta-model');assert.equal(room.modelCallCount,1);assert.deepEqual(room.review.votes,{});assert.equal(room.published.version,1);
  assert.equal(room.drafts.alice.text,inputs.cases[0].alice);assert.equal(room.drafts.bob.text,inputs.cases[0].bob);
  const candidate=room.review.candidates[0];
  room=applyStudioAction(room,{type:'vote',editor:'alice',reviewId:room.review.id,candidateId:candidate.id},now);assert.equal(room.published.version,1);
  room=applyStudioAction(room,{type:'vote',editor:'bob',reviewId:room.review.id,candidateId:candidate.id},now);assert.equal(room.published.version,2);
  room=applyStudioAction(room,{type:'register',requestId:'test-registration',policyVersion:2,label:'Synthetic benchmark attendee',...attendee},now);assert.equal(room.registrations[0].decision.feeCents,1000);
});

test('invalid/partial provider output is terminal and consumes its reservation without retry',async()=>{
  for(const response of [()=>provider({...equivalent,unexpected:'field'}),()=>Response.json({choices:[{finish_reason:'length',message:{content:'{"status"'}}],usage:{prompt_tokens:100,completion_tokens:8192,total_tokens:8292}})]){
    const store=memory();let calls=0;const mock=async()=>{calls++;return response();};
    const first=await call(plain('case1'),store,mock);assert.equal(first.attempt.status,'failed');assert.equal(first.httpStatus,502);assert.ok(first.attempt.error);assert.equal(first.attempt.result,undefined);assert.ok(first.ledger.reservedNanoUsd>0);
    const again=await call(plain('case1'),store,mock);assert.equal(again.replayed,true);assert.equal(again.httpStatus,409);assert.equal(calls,1);
  }
});

test('a network failure never causes a hidden retry or retains credentials in evidence',async()=>{
  const store=memory();let calls=0;
  const out=await call(plain('case1'),store,async()=>{calls++;throw new Error('Transport failed');});
  assert.equal(calls,1);assert.equal(out.attempt.error.code,'MODEL_NETWORK');assert.equal(out.attempt.status,'failed');assert.equal(out.attempt.result,undefined);assert.equal(out.ledger.inFlight,null);
  assert.ok(!JSON.stringify(out).includes(config.apiKey));
});

test('concurrent duplicate requests share one claim; another slot cannot start while it is running',async()=>{
  const store=memory();let calls=0,release,started;
  const waiting=new Promise(resolve=>{release=resolve;}),began=new Promise(resolve=>{started=resolve;});
  const mock=async()=>{calls++;started();await waiting;return provider(equivalent);};
  const first=call(plain('case1'),store,mock);await began;
  const duplicate=await call(plain('case1'),store,mock);assert.equal(duplicate.httpStatus,202);assert.equal(duplicate.replayed,true);
  await assert.rejects(()=>call(plain('case2'),store,mock),{code:'BENCHMARK_BUSY'});assert.equal(calls,1);assert.equal(Object.keys(store.read().attempts).length,1);
  release();const complete=await first;assert.equal(complete.attempt.status,'completed');
});

test('a stranded durable claim never expires into a duplicate provider attempt',async()=>{
  const initial=createBenchmarkLedger(dataset,now),plan=prepareBenchmarkPlan(inputs.cases[0],'plain-meta',config,now),key='case1:plain-meta';
  initial.attempts[key]={caseId:'case1',arm:'plain-meta',claimId:'lost-client',status:'running',startedAt:'2020-01-01T00:00:00.000Z',requestBytes:plan.requestBytes,requestSha256:'recorded-plan-hash',reservedNanoUsd:plan.reservedNanoUsd};initial.reservedNanoUsd=plan.reservedNanoUsd;initial.inFlight=key;
  const store=memory(initial);let calls=0;const mock=async()=>{calls++;return provider(equivalent);};
  const out=await call(plain('case1'),store,mock);assert.equal(out.httpStatus,202);await assert.rejects(()=>call(plain('case2'),store,mock),{code:'BENCHMARK_BUSY'});assert.equal(calls,0);assert.equal(store.read().reservedNanoUsd,plan.reservedNanoUsd);
});

test('changing frozen inputs cannot reuse the ledger and corrupt reservation totals fail closed',async()=>{
  const changed=await parseBenchmarkDataset({cases:inputs.cases.map((x,i)=>i===0?{...x,title:'Changed inputs'}:x)}),store=memory();let calls=0;
  await assert.rejects(()=>runBenchmarkAttempt(changed,config,BENCHMARK_RUN_ID,plain('case1'),{mutate:store.mutate,fetch:async()=>{calls++;return provider(equivalent);},now:()=>now}),{code:'BENCHMARK_STATE'});
  const corrupt=createBenchmarkLedger(dataset,now);corrupt.reservedNanoUsd=1;assert.throws(()=>validateBenchmarkLedger(corrupt,dataset),{code:'BENCHMARK_STATE'});assert.equal(calls,0);
});

test('plain output rejects inconsistent witness outcomes and preserves genuine clarification',()=>{
  assert.deepEqual(parsePlainBenchmarkReview({status:'unresolved',explanation:'A fee is missing.',witness:null,issues:['What is the fee?']}),{status:'unresolved',explanation:'A fee is missing.',witness:null,issues:['What is the fee?']});
  assert.throws(()=>parsePlainBenchmarkReview({...equivalent,witness:{attendee,left:{accepted:true,feeCents:1000},right:{accepted:false,feeCents:null}}}));
  assert.throws(()=>parsePlainBenchmarkReview({status:'different',explanation:'Difference',witness:{attendee,left:{accepted:true,feeCents:1000},right:{accepted:true,feeCents:1000}},issues:[]}));
  assert.throws(()=>parsePlainBenchmarkReview({status:'different',explanation:'Difference',witness:{attendee,left:{accepted:true,feeCents:null},right:{accepted:false,feeCents:null}},issues:[]}));
});

test('all24 fixed slots run once and repeated POSTs cannot expand the finite spending allowance',async()=>{
  const store=memory();let calls=0;
  const mock=async(_url,init)=>{calls++;const body=JSON.parse(init.body);return provider(body.response_format.json_schema.name==='samepage_plain_comparison'?equivalent:expressionResponse(body));};
  for(const item of dataset.cases)for(const arm of ['samepage','plain-meta']){const out=await call({caseId:item.id,arm},store,mock);assert.equal(out.attempt.status,'completed');}
  assert.equal(calls,24);const full=store.read();assert.equal(Object.keys(full.attempts).length,24);assert.ok(full.reservedNanoUsd<BENCHMARK_MAX_NANO_USD);validateBenchmarkLedger(full,dataset);
  for(const item of dataset.cases)for(const arm of ['samepage','plain-meta'])assert.equal((await call({caseId:item.id,arm},store,mock)).replayed,true);
  assert.equal(calls,24);assert.equal(store.read().reservedNanoUsd,full.reservedNanoUsd);
});
