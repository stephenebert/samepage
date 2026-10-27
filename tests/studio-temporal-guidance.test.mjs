import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {STUDIO_TEMPORAL_GUIDANCE} from '../lib/studio-temporal-guidance.ts';
import {applyStudioAction, buildStudioPrompt, createStudioRoom, parseStudioReview} from '../lib/studio.ts';
import {buildStudioWirePrompt, createStudioInterpretationCache, interpretStudioJob, prepareStudioRequest, STUDIO_INTERPRETER_VERSION} from '../lib/studio-model.ts';
import {buildStudioRepairPrompt, parseStudioRepairWire} from '../lib/studio-repair-model.ts';
import {discoverStudioConsequences, evaluateStudioPolicy} from '../lib/studio-engine.ts';

// These controlled tests check the contract, cache and publication boundaries.
// Only the separate fresh live evaluation can measure model interpretation.
let originalFetch, forbiddenCalls = 0;
before(() => {originalFetch = globalThis.fetch; globalThis.fetch = () => {forbiddenCalls++; throw Error('No network in temporal regression tests');};});
after(() => {globalThis.fetch = originalFetch; assert.equal(forbiddenCalls, 0);});

const now = '2026-10-27T21:30:00.000Z';
const instant = '2031-06-14T10:15:30.475Z';
const source = {
  en: `Everyone whose registration arrives before ${instant} is eligible. The fee is USD 14 for every admitted person. No other conditions apply.`,
  es: `Puede participar toda persona cuya inscripción llegue antes del ${instant}. La tarifa es de 14 USD para cada persona admitida. No se aplican otras condiciones.`,
};
const config = {apiKey:'offline-test-only', model:'muse-spark-1.3', enabled:true, protocol:'compact-v2', reasoningEffort:'medium', reuseUnchanged:true, maxCompletionTokens:8192};
const rule = (cmp = 'lt', value = instant) => ({eligibility:{op:'time',cmp,value},fee:{currency:'USD',defaultCents:1400,overrides:[]}});
const attendee = submittedAt => ({age:24,resident:false,student:false,member:false,guardianConsent:false,scholarship:false,submittedAt});
const atOffset = ms => new Date(Date.parse(instant) + ms).toISOString();
function pending() {
  let room = createStudioRoom('temporal-regression', now);
  for(const editor of ['alice','bob']) room = applyStudioAction(room,{type:'draft',editor,baseVersion:1,text:source[editor==='alice'?'en':'es']},now);
  return applyStudioAction(room,{type:'requestReview'},now);
}
function candidates(job) {
  return parseStudioReview({jobId:job.id,candidates:['alice','bob'].map(editor=>({editor,sourceVersion:job.drafts[editor].version,...source,rules:rule(),issues:[]}))},job);
}
function repairJob() {
  const room = pending(), job = room.activeJob;
  const baseline = candidates(job)[0];
  return {id:'temporal-repair',reviewId:job.id,basePolicyVersion:1,drafts:job.drafts,baseline,intent:{baselineCandidateId:baseline.id,scopeFlag:'student',feeCents:1800},createdAt:now};
}

test('all review protocols receive temporal semantics and retain the exact original source', () => {
  const job = pending().activeJob, original = structuredClone(job);
  assert.ok(job.prompt.includes(STUDIO_TEMPORAL_GUIDANCE));
  for(const protocol of ['full-v1','compact-v2','expression-v3']) {
    const prompt = buildStudioWirePrompt(job,protocol);
    assert.equal(prompt.split(STUDIO_TEMPORAL_GUIDANCE).length - 1,1,protocol+' gets exactly one shared contract');
    const snapshot = JSON.parse(prompt.split('Exact '+(protocol==='full-v1'?'job':'source')+' snapshot:\n')[1]);
    if(protocol==='full-v1') assert.deepEqual(snapshot.drafts,job.drafts);
    else assert.deepEqual(snapshot.drafts,{alice:source.en,bob:source.es});
  }
  assert.deepEqual(job,original,'prompt preparation cannot rewrite the source');
  const legacy = {...job,prompt:job.prompt.replace(STUDIO_TEMPORAL_GUIDANCE,'')};
  const full = buildStudioWirePrompt(legacy,'full-v1');
  assert.ok(full.includes(STUDIO_TEMPORAL_GUIDANCE),'a pending old full-v1 job also gets current temporal semantics');
  assert.deepEqual(JSON.parse(full.split('Exact job snapshot:\n')[1]).drafts,job.drafts);
});

test('generated and supplied repair prompts share semantics without silently editing the supplied rewrite', () => {
  const job = repairJob(), generated = buildStudioRepairPrompt(job);
  assert.ok(generated.includes(STUDIO_TEMPORAL_GUIDANCE));
  const proposalText = {en:source.en+' A member is not admitted before the stated opening instant.',es:source.es+' Un miembro no puede entrar antes del instante de apertura indicado.'};
  const supplied = {...job,proposalText}, prompt = buildStudioRepairPrompt(supplied);
  assert.ok(prompt.includes(STUDIO_TEMPORAL_GUIDANCE));
  assert.deepEqual(JSON.parse(prompt.split('Snapshot:\n')[1]).proposalText,proposalText);
  const response = {jobId:job.id,...proposalText,englishRules:null,spanishRules:null,issues:['The opening instant was not specified.']};
  assert.deepEqual(parseStudioRepairWire(response,supplied),{...proposalText,rules:null,issues:response.issues});
  assert.throws(()=>parseStudioRepairWire({...response,es:proposalText.es+' [guessed opening]'},supplied));
});

test('cached interpretations from before the temporal change cannot be reused', () => {
  const job = pending().activeJob, cache = createStudioInterpretationCache(job,config,candidates(job));
  assert.equal(cache.bob.interpreterVersion,STUDIO_INTERPRETER_VERSION);
  const changed = structuredClone(job);
  changed.drafts.alice.version++;
  changed.drafts.alice.text += ' Membership has no effect.';
  changed.prompt = buildStudioPrompt(changed);
  assert.deepEqual(prepareStudioRequest(changed,config,cache).reusedEditors,['bob']);
  const old = structuredClone(cache);old.bob.interpreterVersion='grouped-wording-2026-10-27';
  const plan = prepareStudioRequest(changed,config,old);
  assert.deepEqual(plan.reusedEditors,[]);
  assert.deepEqual(plan.requestedEditors,['alice','bob']);
});

test('exact UTC boundary distinctions and adjacent-millisecond equivalence remain executable', () => {
  const expected = {lt:[true,false,false],lte:[true,true,false],gt:[false,false,true],gte:[false,true,true]};
  for(const [cmp,values]of Object.entries(expected)) {
    assert.deepEqual([-1,0,1].map(offset=>evaluateStudioPolicy(rule(cmp),attendee(atOffset(offset))).accepted),values,cmp);
  }
  const difference = discoverStudioConsequences(rule('lt'),rule('lte'));
  assert.equal(difference.status,'different');
  assert.ok(difference.witnesses.some(w=>w.attendee.submittedAt===instant&&!w.left.accepted&&w.right.accepted));
  assert.equal(discoverStudioConsequences(rule('lte'),rule('lt',atOffset(1))).status,'equivalent');
});

test('negating before or after preserves the full phrase rather than matching a keyword', () => {
  for(const [cmp,opposite,expected]of [['lt','gte',[false,true,true]],['gt','lte',[true,true,false]]]) {
    const negated = rule(cmp);negated.eligibility={op:'not',arg:negated.eligibility};
    assert.deepEqual([-1,0,1].map(offset=>evaluateStudioPolicy(negated,attendee(atOffset(offset))).accepted),expected);
    assert.equal(discoverStudioConsequences(negated,rule(opposite)).status,'equivalent');
  }
});

test('a genuine missing-timezone clarification still blocks both approvals', async () => {
  let room = createStudioRoom('temporal-ambiguous',now);
  const ambiguous = {alice:'Everyone may attend if registered before June 14 at 10:15. Fee USD 14. No timezone is specified.',bob:'Todas las personas pueden asistir si se inscriben antes del 14 de junio a las 10:15. Tarifa de 14 USD. No se especifica la zona horaria.'};
  for(const editor of ['alice','bob']) room=applyStudioAction(room,{type:'draft',editor,baseVersion:1,text:ambiguous[editor]},now);
  room=applyStudioAction(room,{type:'requestReview'},now);
  const job=room.activeJob, published=structuredClone(room.published);
  const response=await interpretStudioJob(job,{...config,protocol:'expression-v3',reasoningEffort:'low',reuseUnchanged:false},{fetch:async(_url,init)=>{
    const prompt=JSON.parse(init.body).messages[1].content;
    assert.ok(prompt.includes(STUDIO_TEMPORAL_GUIDANCE));
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({jobId:job.id,candidates:['alice','bob'].map(editor=>({editor,translation:ambiguous[editor==='alice'?'bob':'alice'],rules:null,issues:['Specify the year and timezone before interpreting the deadline.']}))})}}]});
  }});
  room=applyStudioAction(room,{type:'completeReview',response},now);
  assert.equal(room.review.discovery.status,'unresolved');
  for(const editor of ['alice','bob']) assert.throws(()=>applyStudioAction(room,{type:'vote',editor,reviewId:room.review.id,candidateId:room.review.candidates[0].id},now),{code:'UNRESOLVED'});
  assert.deepEqual(room.published,published);
});
