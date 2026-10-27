import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { applyStudioAction, createStudioRoom, createStudioSimulationRoom } from '../lib/studio.ts';
import { studioDemoFixture } from '../lib/studio-demo.ts';
import { evaluateStudioPolicy } from '../lib/studio-engine.ts';
import { PolicyModelError } from '../lib/policy-model.ts';
import { interpretStudioJob, studioModelConfig, publicStudioModel, MAX_STUDIO_MODEL_CALLS } from '../lib/studio-model.ts';
import { runAutomaticStudioReview, STUDIO_MODEL_LEASE_MS } from '../lib/automatic-studio-review.ts';

// Controlled provider fixtures exercise the real adapter, not a real Meta model.
// Any accidental use of the network fails this entire test process.
let originalFetch;
let forbiddenFetches = 0;
before(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { forbiddenFetches++; throw new Error('External API calls are not authorized in these tests'); };
});
after(() => { globalThis.fetch = originalFetch; assert.equal(forbiddenFetches, 0, 'No external provider calls'); });

const start = '2026-10-26T17:00:00.000Z';
const deadline = '2026-11-04T18:00:00.000Z';
const config = studioModelConfig({ MODEL_API_KEY: 'synthetic-secret-never-transmitted', SAMEPAGE_STUDIO_META_ENABLED: 'true' });
const a = 'For the optional ceramics workshop, participants must be at least 16 and either residents or members. Anyone under 18 also needs guardian consent. Registration must arrive strictly before 2026-11-04T18:00:00.000Z. These are the complete admission requirements. Admission costs US$85. Apply exactly the first matching fee rule in this order: a scholarship waives the fee only for nonmembers; otherwise members pay US$25; otherwise students pay US$40; otherwise charge US$85. A fee waiver never changes admission requirements. No other fees or discounts apply. Charge only admitted participants.';
const b = 'Para el taller optativo de cerámica, hay que tener al menos 16 años y ser residente o miembro. Toda persona menor de 18 años también necesita el consentimiento de su tutor. La inscripción debe llegar estrictamente antes de 2026-11-04T18:00:00.000Z. Estos son todos los requisitos de admisión. La entrada cuesta 85 dólares estadounidenses. Se aplica solo la primera regla coincidente, en este orden: cualquier persona con beca queda exenta; de lo contrario, los miembros pagan 25 dólares; de lo contrario, los estudiantes pagan 40 dólares; de lo contrario, se cobran 85 dólares. La exención no cambia los requisitos de admisión. No hay otros cargos ni descuentos. Solo se cobra a las personas admitidas.';
const fixedA = a.replace('a scholarship waives the fee only for nonmembers', 'a scholarship waives the fee for everyone with a scholarship');
const narrowB = b.replace('cualquier persona con beca queda exenta', 'una beca exime del pago solo a quienes no son miembros');
const flag = (field, value = true) => ({ op: 'flag', field, value });
const age = (cmp, value) => ({ op: 'age', cmp, value });
const rules = (allScholars = false, inclusive = false) => ({
  eligibility: { op: 'all', args: [age('gte', 16), { op: 'any', args: [flag('resident'), flag('member')] }, { op: 'any', args: [age('gte', 18), flag('guardianConsent')] }, { op: 'time', cmp: inclusive ? 'lte' : 'lt', value: deadline }] },
  fee: { currency: 'USD', defaultCents: 8500, overrides: [
    { when: allScholars ? flag('scholarship') : { op: 'all', args: [flag('scholarship'), { op: 'not', arg: flag('member') }] }, cents: 0, label: 'Scholarship waiver' },
    { when: flag('member'), cents: 2500, label: 'Member fee' },
    { when: flag('student'), cents: 4000, label: 'Student fee' },
  ] },
});
const person = { age: 24, resident: false, student: true, member: true, guardianConsent: false, scholarship: true, submittedAt: '2026-11-04T17:59:59.999Z' };
function interpreted(job, corrected = job.drafts.alice.text === fixedA) {
  return { jobId: job.id, candidates: [
    { editor: 'alice', sourceVersion: job.drafts.alice.version, en: job.drafts.alice.text, es: corrected ? b : narrowB, rules: rules(corrected), issues: [] },
    { editor: 'bob', sourceVersion: job.drafts.bob.version, en: fixedA, es: job.drafts.bob.text, rules: rules(true), issues: [] },
  ] };
}
// Deliberately independent of the adapter encoder: these are hand-authored
// provider wire fixtures, so hydration bugs cannot be hidden by a shared codec.
function wireRules(allScholars = false, inclusive = false) {
  const nodes = [age('gte', 16), flag('resident'), flag('member'), { op: 'any', args: [1, 2] }, age('gte', 18), flag('guardianConsent'), { op: 'any', args: [4, 5] }, { op: 'time', cmp: inclusive ? 'lte' : 'lt', value: deadline }, { op: 'all', args: [0, 3, 6, 7] }, flag('scholarship')];
  if (!allScholars) nodes.push({ op: 'not', arg: 2 }, { op: 'all', args: [9, 10] });
  nodes.push(flag('student'));
  return { nodes, eligibility: 8, fee: { currency: 'USD', defaultCents: 8500, overrides: [
    { when: allScholars ? 9 : 11, cents: 0, label: 'Scholarship waiver' },
    { when: 2, cents: 2500, label: 'Member fee' },
    { when: nodes.length - 1, cents: 4000, label: 'Student fee' },
  ] } };
}
function wireResponse(job) {
  const response = interpreted(job);
  response.candidates[0].rules = wireRules(job.drafts.alice.text === fixedA);
  response.candidates[1].rules = wireRules(true);
  return response;
}
const providerResponse = value => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
function mockedAdapter(onRequest = () => {}) {
  return (job, cfg) => interpretStudioJob(job, cfg, { fetch: async (url, init) => {
    assert.equal(url, 'https://api.meta.ai/v1/chat/completions');
    assert.equal(init.method, 'POST'); assert.equal(init.headers.Authorization, `Bearer ${cfg.apiKey}`);
    const body = JSON.parse(init.body);
    assert.ok(body.messages[1].content.includes(JSON.stringify(job.drafts.alice.text)), 'exact Alice source reaches the provider');
    assert.ok(body.messages[1].content.includes(JSON.stringify(job.drafts.bob.text)), 'exact Bob source reaches the provider');
    assert.match(body.messages[1].content, /flat condition nodes/);
    assert.equal(body.stream, false);
    assert.equal(body.response_format.type, 'json_schema'); assert.equal(body.response_format.json_schema.strict, true);
    assert.doesNotMatch(JSON.stringify(body.response_format.json_schema.schema), /\"\$ref\"/, 'provider schema must not require recursive references');
    onRequest(job, body);
    return providerResponse(wireResponse(job));
  } });
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function memory(initial = createStudioRoom('integration', start)) {
  let room = initial, tail = Promise.resolve(), now = start, serial = 0;
  const mutate = async (_id, update) => {
    const next = tail.then(() => {
      const previous = room, updated = update(previous);
      if (updated !== previous) assert.equal(updated.revision, previous.revision + 1, 'one durable revision per mutation');
      room = updated; return room;
    });
    tail = next.catch(() => {}); return next;
  };
  return {
    get room() { return room; }, setClock(value) { now = value; },
    deps: { mutate, now: () => now, requestId: () => `studio-request-${++serial}` },
    action: action => mutate(room.id, current => applyStudioAction(current, action, now)),
    save: (editor, text, baseVersion = room.drafts[editor].version) => mutate(room.id, current => applyStudioAction(current, { type: 'draft', editor, baseVersion, text }, now)),
  };
}
async function prepared() {
  const store = memory();
  await Promise.all([store.save('alice', a, 1), store.save('bob', b, 1)]);
  return store;
}
const run = (store, extra = {}, options = {}, cfg = config) => runAutomaticStudioReview(store.room.id, cfg, options, { ...store.deps, ...extra });
const vote = (store, editor, choice = 'alice') => store.action({ type: 'vote', editor, reviewId: store.room.review.id, candidateId: store.room.review.candidates.find(c => c.editor === choice).id });
const register = (store, requestId, details = person) => store.action({ type: 'register', requestId, policyVersion: store.room.published.version, label: 'Synthetic integration attendee', ...details });

test('live studio requests stay disabled by default, including when a key is present', async () => {
  for (const cfg of [studioModelConfig({}), studioModelConfig({ MODEL_API_KEY: config.apiKey })]) {
    const store = await prepared(), before = store.room;
    assert.equal(publicStudioModel(cfg).ready, false);
    assert.doesNotMatch(JSON.stringify(publicStudioModel(cfg)), /synthetic-secret/);
    await assert.rejects(run(store, { interpret: () => assert.fail('disabled review must never invoke') }, {}, cfg));
    assert.strictEqual(store.room, before);
  }
  const empty = studioModelConfig({ SAMEPAGE_STUDIO_META_ENABLED: 'true' });
  assert.equal(publicStudioModel(empty).ready, false);
  await assert.rejects(run(await prepared(), { interpret: () => assert.fail('missing key must never invoke') }, {}, empty));
  const store = await prepared(); await store.action({ type: 'requestReview' });
  await assert.rejects(interpretStudioJob(store.room.activeJob, studioModelConfig({ MODEL_API_KEY: config.apiKey }), { fetch: () => assert.fail('the transport must enforce the disabled switch too') }), { code: 'MODEL_DISABLED' });
});

test('two independent editors retain concurrent drafts; stale same-editor save cannot overwrite', async () => {
  const store = await prepared();
  assert.equal(store.room.drafts.alice.text, a); assert.equal(store.room.drafts.bob.text, b);
  assert.equal(store.room.drafts.alice.version, 2); assert.equal(store.room.drafts.bob.version, 2);
  const snapshot = store.room;
  await assert.rejects(store.save('alice', fixedA, 1), { code: 'STALE_DRAFT' });
  assert.strictEqual(store.room, snapshot);
});

test('a fresh rich policy finds a fee-only counterexample and preserves two-editor approval semantics', async () => {
  const store = await prepared(); let providerCalls = 0;
  const interpret = mockedAdapter(() => { providerCalls++; });
  const result = await run(store, { interpret });
  assert.equal(result.automatic.status, 'completed');
  assert.equal(store.room.review.provenance, 'meta-model');
  assert.equal(store.room.review.discovery.status, 'different');
  assert.equal(store.room.review.discovery.witnesses.length, 1);
  const witness = store.room.review.discovery.witnesses[0];
  assert.equal(witness.kind, 'price-only'); assert.equal(witness.feeDeltaCents, 2500);
  assert.equal(witness.attendee.member, true); assert.equal(witness.attendee.scholarship, true);
  assert.equal(witness.left.accepted, true); assert.equal(witness.right.accepted, true);
  assert.equal(witness.left.feeCents, 2500); assert.equal(witness.right.feeCents, 0);
  assert.deepEqual(store.room.review.votes, {}); assert.equal(store.room.published.version, 1);
  await vote(store, 'alice'); assert.equal(store.room.published.version, 1);
  await vote(store, 'bob', 'bob'); assert.equal(store.room.published.version, 1);
  await vote(store, 'bob'); assert.equal(store.room.published.version, 2);
  await register(store, 'before-correction');
  assert.equal(store.room.registrations[0].decision.feeCents, 2500);
  const receipt = structuredClone(store.room.registrations[0]);

  await store.save('alice', fixedA);
  assert.equal(store.room.review, null);
  await run(store, { interpret });
  assert.equal(store.room.review.discovery.status, 'equivalent');
  assert.deepEqual(store.room.review.votes, {});
  await vote(store, 'bob'); assert.equal(store.room.published.version, 2);
  await vote(store, 'alice'); assert.equal(store.room.published.version, 3);
  await register(store, 'after-correction');
  assert.equal(store.room.registrations[1].decision.feeCents, 0);
  assert.deepEqual(store.room.registrations[0], receipt);
  assert.deepEqual(store.room.registrations.map(r => r.policyVersion), [2, 3]);
  assert.equal(evaluateStudioPolicy(store.room.published.rules, { ...person, age: 17, guardianConsent: false }).accepted, false, 'waiver cannot waive youth consent');
  assert.equal(evaluateStudioPolicy(store.room.published.rules, { ...person, submittedAt: deadline }).accepted, false, 'waiver cannot change strict deadline');
  assert.equal(store.room.modelCallCount, 2);
  assert.equal(providerCalls, 2); assert.doesNotMatch(JSON.stringify(store.room), /synthetic-secret/);
});

test('the real adapter rejects cyclic, dangling, forward or unreachable condition references', async () => {
  const store = await prepared(); await store.action({ type: 'requestReview' });
  const job = store.room.activeJob;
  for (const damage of [
    response => { response.candidates[0].rules.nodes[0] = { op: 'not', arg: 0 }; },
    response => { response.candidates[0].rules.eligibility = 500; },
    response => { response.candidates[0].rules.nodes[0] = { op: 'not', arg: 1 }; },
    response => { response.candidates[0].rules.nodes.push({ op: 'always' }); },
    response => { response.candidates[0].rules.fee.overrides[0].when = -1; },
    response => { response.candidates[0].rules.nodes[1] = { op: 'flag', field: 'hiddenApproval', value: true }; },
    response => { response.candidates[0].rules = { nodes: [{ op: 'always' }, { op: 'all', args: Array(16).fill(0) }, { op: 'all', args: Array(16).fill(1) }], eligibility: 2, fee: { currency: 'USD', defaultCents: 0, overrides: [] } }; },
    response => { response.candidates[0].rules = { nodes: [{ op: 'always' }, ...Array.from({ length: 8 }, (_, i) => ({ op: 'not', arg: i }))], eligibility: 8, fee: { currency: 'USD', defaultCents: 0, overrides: [] } }; },
  ]) {
    const response = wireResponse(job); damage(response);
    await assert.rejects(interpretStudioJob(job, config, { fetch: async () => providerResponse(response) }), { code: 'MODEL_REVIEW_INVALID' });
  }
});

test('the real adapter preserves source identity and rejects incomplete provider envelopes', async () => {
  const store = await prepared(); await store.action({ type: 'requestReview' }); const job = store.room.activeJob;
  const wrong = wireResponse(job); wrong.candidates[0].en += ' '; 
  const factories = [
    () => providerResponse(wrong),
    () => new Response('not JSON'),
    () => Response.json({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(wireResponse(job)) } }] }),
    () => Response.json({ choices: [{ finish_reason: 'stop', message: { refusal: 'No', content: JSON.stringify(wireResponse(job)) } }] }),
  ];
  for (const factory of factories) await assert.rejects(interpretStudioJob(job, config, { fetch: async () => factory() }), error => /^MODEL_(RESPONSE|REVIEW)_INVALID$/.test(error.code));
});

test('one ambiguous interpretation blocks both editors from approving the executable candidate', async () => {
  const store = await prepared();
  await run(store, { interpret: async job => { const response = interpreted(job); response.candidates[1].rules = null; response.candidates[1].issues = ['Does “by” include the exact deadline instant?']; return response; } });
  assert.equal(store.room.review.discovery.status, 'unresolved');
  assert.match(store.room.review.candidates[1].issues[0], /deadline/);
  for (const editor of ['alice', 'bob']) await assert.rejects(vote(store, editor, 'alice'), { code: 'UNRESOLVED' });
  assert.deepEqual(store.room.review.votes, {}); assert.equal(store.room.published.version, 1);
});

test('deadline inclusivity disagreement produces an exact-boundary witness', async () => {
  const store = await prepared();
  await store.save('alice', fixedA);
  await store.save('bob', b.replace('estrictamente antes de', 'antes de o exactamente en'));
  await run(store, { interpret: async job => { const response = interpreted(job); response.candidates[0].rules = rules(true, false); response.candidates[1].rules = rules(true, true); response.candidates[1].en = fixedA.replace('strictly before', 'at or before (including the exact instant)'); return response; } });
  const witness = store.room.review.discovery.witnesses.find(w => w.kind === 'admission-right');
  assert.ok(witness); assert.equal(witness.attendee.submittedAt, deadline);
  assert.equal(witness.left.accepted, false); assert.equal(witness.right.accepted, true);
});

test('double clicks from two editors consume one provider attempt', async () => {
  const store = await prepared(), gate = deferred(), entered = deferred(); let calls = 0;
  const interpret = async job => { calls++; entered.resolve(); await gate.promise; return interpreted(job); };
  const first = run(store, { interpret }); await entered.promise;
  const second = await run(store, { interpret }, { retry: true });
  assert.equal(second.automatic.status, 'running'); assert.equal(second.httpStatus, 202);
  assert.equal(calls, 1); assert.equal(store.room.modelCallCount, 1);
  gate.resolve(); await first; assert.equal(calls, 1);
});

test('an edit during model review prevents stale output from replacing a newer jointly approved policy', async () => {
  const store = await prepared(), gate = deferred(), entered = deferred();
  const old = run(store, { interpret: async job => { entered.resolve(); await gate.promise; return interpreted(job); } }); await entered.promise;
  await store.save('alice', fixedA);
  await run(store, { interpret: async job => interpreted(job) });
  await vote(store, 'alice'); await vote(store, 'bob');
  const agreed = store.room;
  gate.resolve(); const obsolete = await old;
  assert.equal(obsolete.automatic.status, 'superseded'); assert.strictEqual(store.room, agreed);
  assert.equal(store.room.published.version, 2); assert.equal(store.room.published.en, fixedA);
});

test('a manual fallback completed during a model request keeps its approval when the old response arrives', async () => {
  const store = await prepared(), gate = deferred(), entered = deferred();
  const pending = run(store, { interpret: async job => { entered.resolve(); await gate.promise; return interpreted(job); } }); await entered.promise;
  await store.action({ type: 'completeReview', response: interpreted(store.room.activeJob) });
  await vote(store, 'alice'); const reviewed = store.room;
  gate.resolve(); const old = await pending;
  assert.equal(old.automatic.status, 'superseded'); assert.strictEqual(store.room, reviewed);
  assert.equal(store.room.review.provenance, 'manual-agent-review');
  assert.equal(Object.keys(store.room.review.votes).length, 1); assert.equal(store.room.published.version, 1);
});

test('a compare-and-swap replay reserves and invokes only one provider attempt', async () => {
  const store = await prepared(); let calls = 0;
  const mutate = (id, update) => store.deps.mutate(id, room => { update(structuredClone(room)); return update(room); });
  const result = await run(store, { mutate, interpret: async job => { calls++; return interpreted(job); } });
  assert.equal(result.automatic.status, 'completed'); assert.equal(calls, 1); assert.equal(store.room.modelCallCount, 1);
});

test('invalid model sources or unexpected rule fields cannot reach a review or approval', async () => {
  for (const damage of [response => { response.candidates[0].en += ' silently changed'; }, response => { response.candidates[0].rules.execute = 'arbitrary code'; }, response => { response.autoApprove = true; }, response => { response.candidates[0].rules = null; response.candidates[0].issues = []; }]) {
    const store = await prepared(), before = structuredClone(store.room.published);
    const result = await run(store, { interpret: async job => { const response = interpreted(job); damage(response); return response; } });
    assert.equal(result.automatic.status, 'failed'); assert.equal(result.automatic.error.code, 'MODEL_REVIEW_INVALID');
    assert.equal(store.room.review, null); assert.deepEqual(store.room.published, before);
  }
});

test('provider failure preserves drafts and only explicit retries consume another attempt', async () => {
  const store = await prepared(), before = structuredClone(store.room.drafts); let calls = 0;
  const interpret = async () => { calls++; throw new PolicyModelError('MODEL_PROVIDER', 'Safe test provider error'); };
  assert.equal((await run(store, { interpret })).automatic.status, 'failed');
  assert.equal((await run(store, { interpret })).automatic.status, 'failed'); assert.equal(calls, 1);
  assert.equal(store.room.modelCallCount, 1); assert.deepEqual(store.room.drafts, before);
  assert.equal((await run(store, { interpret: async job => { calls++; return interpreted(job); } }, { retry: true })).automatic.status, 'completed');
  assert.equal(calls, 2); assert.equal(store.room.modelCallCount, 2);
});

test('a result at the lease deadline is rejected and never changes published behavior', async () => {
  const store = await prepared();
  const result = await run(store, { interpret: async job => { store.setClock(new Date(Date.parse(start) + STUDIO_MODEL_LEASE_MS).toISOString()); return interpreted(job); } });
  assert.equal(result.automatic.status, 'failed'); assert.equal(result.automatic.error.code, 'MODEL_INTERRUPTED');
  assert.equal(store.room.review, null); assert.equal(store.room.published.version, 1);
});

test('lease expiry is rechecked after a failed final compare-and-swap attempt', async () => {
  const store = await prepared(); let applications = 0;
  const mutate = (id, update) => store.deps.mutate(id, room => {
    if (room.automaticReview?.status === 'running') {
      applications++; update(structuredClone(room));
      store.setClock(new Date(Date.parse(start) + STUDIO_MODEL_LEASE_MS).toISOString());
    }
    return update(room);
  });
  const result = await run(store, { mutate, interpret: async job => interpreted(job) });
  assert.equal(applications, 1); assert.equal(result.automatic.status, 'failed');
  assert.equal(result.automatic.error.code, 'MODEL_INTERRUPTED'); assert.equal(store.room.review, null);
  assert.equal(store.room.published.version, 1);
});

test('the per-room external attempt budget includes failed requests and stops a sixth attempt', async () => {
  const store = await prepared(); let calls = 0;
  const interpret = async () => { calls++; throw new PolicyModelError('MODEL_PROVIDER', 'Synthetic outage'); };
  for (let i = 0; i < MAX_STUDIO_MODEL_CALLS; i++) await run(store, { interpret }, { retry: true });
  assert.equal(MAX_STUDIO_MODEL_CALLS, 5); assert.equal(calls, 5); assert.equal(store.room.modelCallCount, 5);
  await assert.rejects(run(store, { interpret }, { retry: true }));
  assert.equal(calls, 5); assert.equal(store.room.modelCallCount, 5); assert.equal(store.room.published.version, 1);
});

test('controlled simulation exercises review and two approvals without credentials or external budget', async () => {
  const store = memory(createStudioSimulationRoom('offline', start, studioDemoFixture));
  assert.equal(store.room.review, null);
  const result = await run(store, { interpret: () => assert.fail('simulation must not use the real interpreter dependency') }, { simulation: true }, studioModelConfig({}));
  assert.equal(result.automatic.status, 'completed'); assert.equal(store.room.review.provenance, 'simulated-model');
  assert.equal(store.room.modelCallCount ?? 0, 0); assert.deepEqual(store.room.review.votes, {});
  await vote(store, 'alice'); assert.equal(store.room.published.version, 1);
  await vote(store, 'bob'); assert.equal(store.room.published.version, 2);
  await register(store, 'simulation-receipt'); assert.equal(store.room.registrations[0].decision.feeCents, 8000);
});

test('simulation rejects ordinary rooms and refuses to pretend it interpreted modified fixture wording', async () => {
  await assert.rejects(run(await prepared(), {}, { simulation: true }, studioModelConfig({})));
  const store = memory(createStudioSimulationRoom('modified', start, studioDemoFixture));
  await store.save('alice', store.room.drafts.alice.text + ' Extra policy clause.');
  await assert.rejects(run(store, {}, { simulation: true }, studioModelConfig({})));
  assert.equal(store.room.review, null); assert.equal(store.room.published.version, 1);
});
