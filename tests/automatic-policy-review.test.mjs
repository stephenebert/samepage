import test from "node:test";
import assert from "node:assert/strict";
import { createConsequencesRoom, applyConsequencesAction } from "../lib/consequences.ts";
import { interpretPolicyJob, policyModelConfig, publicPolicyModel, PolicyModelError } from "../lib/policy-model.ts";
import { runAutomaticPolicyReview, MODEL_LEASE_MS } from "../lib/automatic-policy-review.ts";
import { discoverCounterexamples } from "../lib/counterexamples.ts";

// These are controlled provider fixtures, not evidence of live Meta quality.
const start = "2026-10-20T12:00:00.000Z";
const config = { apiKey: "test-secret-must-not-leak", model: "muse-spark-1.3" };
const fresh = () => createConsequencesRoom("automatic-test", start);
const pending = () => applyConsequencesAction(fresh(), { type: "requestReview" }, start);
function valid(job) {
  const rules = { minAge: 16, residentRequired: true, join: "all", deadline: "2026-11-05T18:00:00.000Z", deadlineInclusive: true };
  return { jobId: job.id, candidates: [
    { editor: "alice", sourceVersion: job.drafts.alice.version, en: job.drafts.alice.text, es: "Traducción de prueba.", rules, issues: [] },
    { editor: "bob", sourceVersion: job.drafts.bob.version, en: "Fixture translation.", es: job.drafts.bob.text, rules: { ...rules, join: "any" }, issues: [] },
  ] };
}
const response = (job, changes = {}) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(valid(job)) }, ...changes }] });
function memory(initial = fresh()) {
  let room = initial, tail = Promise.resolve(), clock = start, serial = 0;
  return {
    get room() { return room; },
    setClock(value) { clock = value; },
    deps: {
      now: () => clock, requestId: () => `request-${++serial}`,
      mutate: async (_id, update) => {
        const next = tail.then(() => {
          const before = room, updated = update(before);
          if (updated !== before) assert.equal(updated.revision, before.revision + 1, "every persisted mutation is one CAS revision");
          room = updated; return room;
        });
        tail = next.catch(() => {}); return next;
      },
    },
    edit: async (editor = "bob") => {
      await tail;
      room = applyConsequencesAction(room, { type: "draft", editor, baseVersion: room.drafts[editor].version, text: `Changed ${editor} draft.` }, clock);
    },
    action: async action => { await tail; room = applyConsequencesAction(room, action, clock); },
  };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const run = (store, extra = {}, retry = false, configuration = config) => runAutomaticPolicyReview(store.room.id, configuration, retry, { ...store.deps, ...extra });

test("missing credentials report unconfigured and never mutate or invoke", async () => {
  assert.deepEqual(publicPolicyModel(policyModelConfig({})), { provider: "Meta", model: "muse-spark-1.3", ready: false, mode: "unconfigured" });
  const store = memory(), before = store.room;
  await assert.rejects(run(store, { interpret: () => assert.fail("not invoked") }, false, policyModelConfig({})), { code: "MODEL_NOT_CONFIGURED", status: 503 });
  assert.strictEqual(store.room, before);
  const metadata = JSON.stringify(publicPolicyModel(config));
  assert.doesNotMatch(metadata, /test-secret/);
});
test("Meta HTTP contract uses server secret, fixed endpoint, strict schema and validates exact sources", async () => {
  const job = pending().activeJob;
  let calls = 0;
  const actual = await interpretPolicyJob(job, config, { fetch: async (url, init) => {
    calls++;
    assert.equal(url, "https://api.meta.ai/v1/chat/completions"); assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, `Bearer ${config.apiKey}`); assert.ok(init.signal);
    const body = JSON.parse(init.body);
    assert.equal(body.model, config.model); assert.equal(body.stream, false);
    assert.equal(body.reasoning_effort, "medium"); assert.equal(body.max_completion_tokens, 8192);
    assert.equal(body.messages[1].content, job.prompt);
    assert.equal(body.response_format.type, "json_schema"); assert.equal(body.response_format.json_schema.strict, true);
    assert.deepEqual(body.response_format.json_schema.schema.properties.jobId.enum, [job.id]);
    return response(job);
  } });
  assert.equal(calls, 1); assert.deepEqual(actual, valid(job));
});
test("malformed JSON, truncated completions, refusals, markdown and schema changes are rejected", async () => {
  const job = pending().activeJob;
  const invalid = valid(job); invalid.candidates[0].en += " changed";
  for (const factory of [
    () => new Response("not JSON"),
    () => response(job, { finish_reason: "length" }),
    () => response(job, { message: { refusal: "No", content: JSON.stringify(valid(job)) } }),
    () => response(job, { message: { content: "```json\n{}\n```" } }),
    () => response(job, { message: { content: JSON.stringify(invalid) } }),
    () => Response.json({ choices: [] }),
  ]) await assert.rejects(interpretPolicyJob(job, config, { fetch: async () => factory() }), error => /^MODEL_(RESPONSE|REVIEW)_INVALID$/.test(error.code));
});
test("oversized provider bodies are rejected with and without content-length", async () => {
  const job = pending().activeJob;
  for (const headers of [{}, { "content-length": "160001" }]) {
    await assert.rejects(interpretPolicyJob(job, config, { fetch: async () => new Response("x".repeat(160001), { headers }) }), { code: "MODEL_RESPONSE_INVALID" });
  }
});
test("provider failures redact provider body and secrets without retrying", async () => {
  const job = pending().activeJob;
  for (const [status, code] of [[401, "MODEL_AUTH"], [403, "MODEL_AUTH"], [429, "MODEL_RATE_LIMIT"], [500, "MODEL_PROVIDER"]]) {
    let calls = 0;
    await assert.rejects(interpretPolicyJob(job, config, { fetch: async () => { calls++; return new Response(`sensitive upstream body ${config.apiKey}`, { status }); } }), error => {
      assert.equal(error.code, code); assert.doesNotMatch(error.message, /sensitive|test-secret/); return true;
    });
    assert.equal(calls, 1);
  }
  await assert.rejects(interpretPolicyJob(job, config, { fetch: async () => { throw new Error(config.apiKey); } }), error => error.code === "MODEL_NETWORK" && !error.message.includes(config.apiKey));
});
test("timeout bounds a stuck request even when an injected fetch ignores abort", async () => {
  const job = pending().activeJob;
  let signal;
  await assert.rejects(interpretPolicyJob(job, config, { timeoutMs: 5, fetch: async (_url, init) => { signal = init.signal; return new Promise(() => {}); } }), { code: "MODEL_TIMEOUT", status: 504 });
  assert.equal(signal.aborted, true);
});
test("timeout also covers stalled response body reads", async () => {
  const job = pending().activeJob;
  await assert.rejects(interpretPolicyJob(job, config, { timeoutMs: 5, fetch: async () => new Response(new ReadableStream({ start() {} })) }), { code: "MODEL_TIMEOUT" });
});
test("successful automatic interpretation creates proposals and no approvals or publication", async () => {
  const store = memory();
  const output = await run(store, { interpret: async job => valid(job) });
  assert.equal(output.automatic.status, "completed"); assert.equal(output.httpStatus, 200);
  assert.equal(store.room.mode, "automatic-model"); assert.equal(store.room.review.candidates.length, 2);
  assert.deepEqual(store.room.review.votes, {}); assert.equal(store.room.review.status, "open");
  assert.equal(store.room.published.version, 1); assert.equal(store.room.activeJob, null);
  assert.equal(store.room.automaticReview.status, "completed"); assert.equal(store.room.automaticReview.model, config.model);
  assert.doesNotMatch(JSON.stringify(output), /test-secret/);
});
test("double click and second tab reuse durable lease with one provider invocation", async () => {
  const store = memory(), gate = deferred(), entered = deferred(); let calls = 0;
  const interpret = async job => { calls++; entered.resolve(); await gate.promise; return valid(job); };
  const first = run(store, { interpret }); await entered.promise;
  const second = await run(store, { interpret }, true);
  assert.equal(second.automatic.status, "running"); assert.equal(second.httpStatus, 202);
  assert.equal(second.automatic.requestId, "request-1"); assert.equal(calls, 1);
  gate.resolve(); await first; assert.equal(calls, 1);
});
test("CAS updater replay does not accidentally invoke the provider twice", async () => {
  const store = memory(); let calls = 0;
  const mutate = (id, update) => store.deps.mutate(id, room => { update(structuredClone(room)); return update(room); });
  await run(store, { mutate, interpret: async job => { calls++; return valid(job); } });
  assert.equal(calls, 1); assert.equal(store.room.review.candidates.length, 2);
});
test("failed review keeps drafts, snapshot and publication; explicit retry reuses job only once", async () => {
  const store = memory(), originalDrafts = structuredClone(store.room.drafts); let calls = 0;
  const fail = async () => { calls++; throw new PolicyModelError("MODEL_PROVIDER", "Safe provider error"); };
  const first = await run(store, { interpret: fail });
  assert.equal(first.automatic.status, "failed"); assert.equal(first.httpStatus, 502);
  const jobId = store.room.activeJob.id;
  assert.deepEqual(store.room.drafts, originalDrafts); assert.equal(store.room.review, null); assert.equal(store.room.published.version, 1);
  const second = await run(store, { interpret: fail });
  assert.equal(second.automatic.status, "failed"); assert.equal(second.httpStatus, 409); assert.equal(calls, 1);
  const third = await run(store, { interpret: async job => { calls++; assert.equal(job.id, jobId); return valid(job); } }, true);
  assert.equal(third.automatic.status, "completed"); assert.equal(calls, 2);
});
test("expired lease requires explicit retry and prevents an abandoned result from replacing it", async () => {
  const store = memory(), old = deferred(), entered = deferred();
  const first = run(store, { interpret: async job => { entered.resolve(); await old.promise; return valid(job); } }); await entered.promise;
  store.setClock(new Date(Date.parse(start) + MODEL_LEASE_MS + 1).toISOString());
  const expired = await run(store, { interpret: () => assert.fail("not retried automatically") });
  assert.equal(expired.automatic.status, "failed"); assert.equal(expired.automatic.error.code, "MODEL_INTERRUPTED");
  const retry = await run(store, { interpret: async job => valid(job) }, true);
  assert.equal(retry.automatic.status, "completed"); const room = store.room;
  old.resolve(); const oldResult = await first;
  assert.equal(oldResult.automatic.status, "superseded"); assert.strictEqual(store.room, room);
});
test("explicit retry can reclaim an expired running lease directly", async () => {
  const store = memory(), old = deferred(), entered = deferred();
  const first = run(store, { interpret: async job => { entered.resolve(); await old.promise; return valid(job); } }); await entered.promise;
  store.setClock(new Date(Date.parse(start) + MODEL_LEASE_MS).toISOString());
  const second = await run(store, { interpret: async job => valid(job) }, true);
  assert.equal(second.automatic.status, "completed"); old.resolve(); assert.equal((await first).automatic.status, "superseded");
});
test("an answer arriving exactly at or after lease expiry cannot apply without a replacement request", async () => {
  for (const elapsed of [MODEL_LEASE_MS, MODEL_LEASE_MS + 1000]) {
    const store = memory(), originalDrafts = structuredClone(store.room.drafts), originalPolicy = structuredClone(store.room.published);
    const output = await run(store, { interpret: async job => {
      store.setClock(new Date(Date.parse(start) + elapsed).toISOString());
      return valid(job);
    } });
    assert.equal(output.automatic.status, "failed"); assert.equal(output.httpStatus, 409);
    assert.equal(output.automatic.error.code, "MODEL_INTERRUPTED");
    assert.equal(store.room.review, null); assert.ok(store.room.activeJob);
    assert.deepEqual(store.room.drafts, originalDrafts); assert.deepEqual(store.room.published, originalPolicy);
    assert.equal(store.room.automaticReview.durationMs, elapsed);
    await run(store, { interpret: () => assert.fail("late results require explicit retry") });
    assert.equal((await run(store, { interpret: async job => valid(job) }, true)).automatic.status, "completed");
  }
});
test("lease expiry is checked again when the final CAS application retries", async () => {
  const store = memory(); let applies = 0;
  const mutate = (id, update) => store.deps.mutate(id, room => {
    if (room.automaticReview?.status === "running") {
      applies++;
      update(structuredClone(room)); // Simulate a failed CAS before its retry.
      store.setClock(new Date(Date.parse(start) + MODEL_LEASE_MS).toISOString());
    }
    return update(room);
  });
  const output = await run(store, { mutate, interpret: async job => valid(job) });
  assert.equal(applies, 1); assert.equal(output.automatic.status, "failed");
  assert.equal(output.automatic.error.code, "MODEL_INTERRUPTED"); assert.equal(store.room.review, null);
});
test("editing during an in-flight request supersedes it without applying stale interpretations", async () => {
  const store = memory(), gate = deferred(), entered = deferred();
  const first = run(store, { interpret: async job => { entered.resolve(); await gate.promise; return valid(job); } }); await entered.promise;
  await store.edit(); const edited = store.room;
  assert.equal(edited.automaticReview.status, "superseded"); assert.equal(edited.activeJob, null);
  gate.resolve(); const output = await first;
  assert.equal(output.automatic.status, "superseded"); assert.strictEqual(store.room, edited);
  assert.equal(store.room.review, null); assert.equal(store.room.published.version, 1);
  assert.equal((await run(store, { interpret: async job => valid(job) })).automatic.status, "completed");
});
test("stale response cannot replace a newer review or matching votes", async () => {
  const store = memory(), gate = deferred(), entered = deferred();
  const first = run(store, { interpret: async job => { entered.resolve(); await gate.promise; return valid(job); } }); await entered.promise;
  await store.edit(); await run(store, { interpret: async job => valid(job) });
  const review = store.room.review, selected = review.candidates[1].id;
  for (const editor of ["alice", "bob"]) await store.action({ type: "vote", editor, reviewId: review.id, candidateId: selected });
  const published = store.room; gate.resolve(); await first;
  assert.strictEqual(store.room, published); assert.equal(store.room.published.version, 2);
  assert.deepEqual(store.room.review.votes, { alice: selected, bob: selected });
});
test("existing reviews including one vote are returned without new model request", async () => {
  const store = memory(); await run(store, { interpret: async job => valid(job) });
  await store.action({ type: "vote", editor: "alice", reviewId: store.room.review.id, candidateId: store.room.review.candidates[0].id });
  const before = store.room;
  const result = await run(store, { interpret: () => assert.fail("not invoked") }, true);
  assert.equal(result.automatic.status, "already-reviewed"); assert.strictEqual(store.room, before);
});
test("legacy manual pending jobs can be completed automatically", async () => {
  const store = memory(pending()), originalId = store.room.activeJob.id;
  await run(store, { interpret: async job => { assert.equal(job.id, originalId); return valid(job); } });
  assert.equal(store.room.review.id, originalId);
});
test("manual fallback during model request wins and preserves its subsequent approval", async () => {
  const store = memory(), gate = deferred(), entered = deferred();
  const first = run(store, { interpret: async job => { entered.resolve(); await gate.promise; return valid(job); } }); await entered.promise;
  await store.action({ type: "completeReview", response: valid(store.room.activeJob) });
  await store.action({ type: "vote", editor: "alice", reviewId: store.room.review.id, candidateId: store.room.review.candidates[0].id });
  const manual = store.room; gate.resolve(); assert.equal((await first).automatic.status, "superseded");
  assert.strictEqual(store.room, manual); assert.equal(Object.keys(store.room.review.votes).length, 1);
});
test("injected interpreter output is revalidated at durable apply boundary", async () => {
  const store = memory();
  const output = await run(store, { interpret: async job => { const bad = valid(job); bad.candidates[0].rules.maxAge = 30; return bad; } });
  assert.equal(output.automatic.status, "failed"); assert.equal(output.automatic.error.code, "MODEL_REVIEW_INVALID");
  assert.equal(store.room.review, null); assert.equal(store.room.published.version, 1);
});
test("unrepresentable model policies remain blocked and never become partially executable", async () => {
  const store = memory();
  await run(store, { interpret: async job => { const value = valid(job); value.candidates[0].rules = null; value.candidates[0].issues = ["Maximum age cannot be represented."]; return value; } });
  assert.equal(store.room.review.candidates[0].rules, null);
  await assert.rejects(store.action({ type: "vote", editor: "alice", reviewId: store.room.review.id, candidateId: store.room.review.candidates[0].id }), { code: "UNRESOLVED" });
  assert.equal(store.room.published.version, 1);
});
test("saved drafts flow through the provider adapter, discovery, two approvals and versioned registration", async () => {
  const store = memory();
  await store.action({ type: "draft", editor: "bob", baseVersion: 1, text: "Hay que tener al menos 16 años O residir en el barrio. La inscripción debe recibirse a más tardar el 5 de noviembre de 2026 a las 18:00 UTC." });
  let calls = 0;
  await run(store, { interpret: (job, cfg) => interpretPolicyJob(job, cfg, { fetch: async () => { calls++; return response(job); } }) });
  const candidates = store.room.review.candidates;
  const discovery = discoverCounterexamples(candidates[0].rules, candidates[1].rules);
  assert.equal(discovery.status, "different"); assert.equal(discovery.witnesses.length, 1);
  const witness = discovery.witnesses[0];
  assert.equal(witness.direction, "right-only");
  const register = requestId => store.action({ type: "register", requestId, policyVersion: store.room.published.version, label: "Controlled pipeline fixture", ...witness.attendee });
  await register("before-votes");
  assert.equal(store.room.registrations[0].decision.accepted, false);
  const vote = editor => store.action({ type: "vote", editor, reviewId: store.room.review.id, candidateId: candidates[1].id });
  await vote("alice"); assert.equal(store.room.published.version, 1);
  await vote("bob"); assert.equal(store.room.published.version, 2);
  await register("after-votes");
  assert.equal(store.room.registrations[1].decision.accepted, true);
  assert.deepEqual(store.room.registrations.map(item => item.policyVersion), [1, 2]);
  assert.equal(store.room.registrations[0].decision.accepted, false);
  assert.equal(calls, 1);
});
