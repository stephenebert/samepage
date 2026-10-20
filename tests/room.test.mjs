import test from "node:test";
import assert from "node:assert/strict";
import { abandonJob, applyAction, buildPrompt, claimJob, completeJob, createRoom, parseModelResult } from "../lib/room.ts";

// Mechanical fixtures deliberately do not claim to evaluate model semantics.
const t0 = "2026-10-20T10:00:00.000Z", t1 = "2026-10-20T10:00:02.000Z", t2 = "2026-10-20T10:00:12.000Z";
const bi = (en, es = `ES ${en}`) => ({ en, es });
const fresh = () => createRoom("test", t0);
const segment = (room, id) => room.segments.find(s => s.id === id);
const propose = (room, id, section = "admission", clientId = "alice", proposalText = `${id} proposal`, baseVersion = 1, supersedesIssueId) =>
  applyAction(room, { type: "propose", id, clientId, segmentId: section, baseVersion, text: proposalText, ...(supersedesIssueId ? { supersedesIssueId } : {}) }, t0);
function processing(...proposals) {
  let room = fresh();
  for (const args of proposals) room = propose(room, ...args);
  return claimJob(room, "job1", t1);
}
function decision(job, section, status = "apply", canonical) {
  const proposals = job.proposals.filter(p => p.segmentId === section);
  const first = proposals[0];
  const pair = canonical ?? (first.text === "" ? bi("", "") : first.language === "en" ? bi(first.text) : bi(`EN ${first.text}`, first.text));
  return { segmentId: section, eventIds: proposals.map(p => p.id), status, canonical: ["conflict", "clarify"].includes(status) ? null : pair,
    candidates: status === "conflict" ? proposals.map(p => ({ eventId: p.id, ...(p.text === "" ? bi("", "") : p.language === "en" ? bi(p.text) : bi(`EN ${p.text}`, p.text)) })) : [],
    provenance: proposals.map(p => ({ eventId: p.id, operation: p.text === "" ? "delete" : "replace", sourceText: p.text,
      disposition: { apply: "applied", agree: "equivalent", merge: "combined", conflict: "candidate", clarify: "held" }[status], change: bi(`Change from ${p.clientId}`) })),
    explanation: bi("Reason"), witness: status === "conflict" ? { question: bi("Which rule applies at the boundary?"), answers: Object.fromEntries(proposals.map((p, i) => [p.id, bi(i ? "No" : "Yes")])) } : null,
    clarificationQuestion: status === "clarify" ? bi("Morning or evening?") : null };
}
const clear = (job) => ({ status: "clear", reviewedSegmentIds: job.segments.map(s => s.id), issues: [] });
const result = (job, decisions, documentCheck = clear(job)) => JSON.stringify({ jobId: job.id, decisions, documentCheck });
const complete = (state, decisions, documentCheck) => completeJob(state.room, state.job.id, result(state.job, decisions, documentCheck), t2);
function deadlineIssue(job, eventText, kind = "contradiction") {
  return { status: kind === "contradiction" ? "blocked" : "uncertain", reviewedSegmentIds: job.segments.map(s => s.id), issues: [{ kind,
    segmentIds: ["event", "deadline"], excerpts: [{ segmentId: "event", language: "en", text: eventText }, { segmentId: "deadline", language: "en", text: segment({ segments: job.segments }, "deadline").en }],
    explanation: bi("The event paragraph and registration paragraph disagree on the registration deadline."), question: bi("Should registration close on November 4 or November 5?") }] };
}
function conflictState(section = "admission", a = "Children under 10 enter free.", b = "La entrada es gratuita para menores de 11 años.") {
  const state = processing(["p1", section, "alice", a], ["p2", section, "bob", b]);
  const d = decision(state.job, section, "conflict");
  return { initial: state.room, raw: result(state.job, [d]), ...complete(state, [d]) };
}
const vote = (room, clientId, candidateEventId, issueId = room.issues.find(i => i.status === "open").id) => applyAction(room, { type: "vote", clientId, issueId, candidateEventId }, t2);
const select = (room, id = "p1") => vote(vote(room, "alice", id), "bob", id);

test("fresh room uses agent relay; duplicate proposal retries are idempotent", () => {
  const room = propose(fresh(), "p1");
  assert.equal(room.mode, "agent-manual-relay");
  assert.strictEqual(propose(room, "p1"), room);
  assert.throws(() => propose(room, "p1", "venue"), { code: "DUPLICATE_ID" });
});

test("every job snapshots all six sections; prompt requires simultaneous resultant-document review", () => {
  const { room, job } = processing(["p1", "admission"]);
  assert.deepEqual(job.segments, room.segments);
  assert.equal(job.segments.length, 6); assert.equal(job.protocolVersion, 2);
  assert.match(buildPrompt(job), /simultaneously/); assert.match(job.prompt, /deletion versus a concurrent modification/);
  assert.match(job.prompt, /5 November 2026/); assert.equal(job.mode, "edits");
});

test("consistent update commits both languages, preserves untouched versions, separates timing", () => {
  const state = processing(["p1", "admission"]), done = complete(state, [decision(state.job, "admission")]);
  assert.equal(segment(done.room, "admission").version, 2);
  assert.equal(segment(done.room, "admission").en, "p1 proposal");
  assert.deepEqual(done.room.segments.filter(s => s.id !== "admission"), state.room.segments.filter(s => s.id !== "admission"));
  assert.equal(done.job.queueMs, 2000); assert.equal(done.job.processingMs, 10000); assert.equal(done.room.activeJobId, null);
});

test("Nov 4 / Nov 5 cross-document contradiction holds EVERY proposed change atomically", () => {
  const en = "The gathering is on 7 November 2026. Registration closes on 4 November 2026 at 18:00 local time.";
  const state = processing(["p1", "event", "alice", en], ["p2", "venue", "bob", "Nos reunimos en 19 Oak Street."]);
  const decisions = [decision(state.job, "event"), decision(state.job, "venue")];
  const done = complete(state, decisions, deadlineIssue(state.job, en));
  assert.deepEqual(done.room.segments, state.room.segments);
  assert.equal(done.room.issues.length, 2); assert.ok(done.room.issues.every(i => i.kind === "document" && i.status === "open"));
  assert.ok(done.room.proposals.every(p => p.status === "clarify"));
  assert.equal(done.room.activeJobId, null); assert.equal(done.job.result.documentCheck.status, "blocked");
  assert.equal(done.room.issues[0].documentIssues[0].excerpts.length, 2);
});

test("cross-document uncertainty also holds the whole batch", () => {
  const en = "Registration closes Wednesday at six.";
  const state = processing(["p1", "event", "alice", en]);
  const done = complete(state, [decision(state.job, "event")], deadlineIssue(state.job, en, "uncertainty"));
  assert.deepEqual(done.room.segments, state.room.segments);
  assert.equal(done.job.result.documentCheck.status, "uncertain");
});

test("same-batch deadline repair is checked together and commits both sections", () => {
  const en = "Registration closes on 4 November 2026 at 18:00 local time.";
  const es = "La inscripción cierra el 4 de noviembre de 2026 a las 18:00, hora local.";
  const state = processing(["p1", "event", "alice", en], ["p2", "deadline", "bob", es]);
  const done = complete(state, [decision(state.job, "event", "apply", bi(en, es)), decision(state.job, "deadline", "apply", bi(en, es))]);
  assert.equal(segment(done.room, "event").en, en); assert.equal(segment(done.room, "deadline").es, es);
  assert.equal(segment(done.room, "event").version, 2); assert.equal(segment(done.room, "deadline").version, 2);
});

test("explicit merge keeps address and entrance changes and records each editor's provenance", () => {
  const state = processing(["p1", "venue", "alice", "Meet at 22 Oak Street. Use the south entrance."], ["p2", "venue", "bob", "Nos reunimos en 18 Oak Street. Usa la entrada este."]);
  const merged = bi("Meet at 22 Oak Street. Use the east entrance.", "Nos reunimos en 22 Oak Street. Usa la entrada este.");
  const done = complete(state, [decision(state.job, "venue", "merge", merged)]);
  assert.equal(segment(done.room, "venue").en, merged.en);
  assert.equal(done.job.result.decisions[0].status, "merge");
  assert.deepEqual(done.job.result.decisions[0].provenance.map(p => [p.eventId, p.disposition]), [["p1", "combined"], ["p2", "combined"]]);
  assert.match(done.room.activity.at(-1).text, /Compatible changes merged/);
  const equiv = processing(["a", "admission", "alice", "Children under 10 enter free."], ["b", "admission", "bob", "La entrada es gratuita para menores de 10 años."]);
  assert.equal(complete(equiv, [decision(equiv.job, "admission", "agree")]).job.result.decisions[0].status, "agree");
});

test("independent deletion preserves tombstone section ID and another editor's section edit", () => {
  const state = processing(["p1", "refund", "alice", ""], ["p2", "venue", "bob", "Nos reunimos en 22 Oak Street."]);
  const done = complete(state, [decision(state.job, "refund"), decision(state.job, "venue")]);
  assert.equal(done.room.segments.length, 6); assert.equal(segment(done.room, "refund").en, ""); assert.equal(segment(done.room, "refund").es, "");
  assert.equal(segment(done.room, "refund").version, 2); assert.match(segment(done.room, "venue").es, /22 Oak/);
  assert.equal(done.job.result.decisions[0].provenance[0].operation, "delete");
});

test("deletion versus modification cannot be silently merged; faithful empty conflict candidate allowed", () => {
  const state = processing(["p1", "refund", "alice", ""], ["p2", "refund", "bob", "El plazo de reembolso es de 48 horas."]);
  assert.throws(() => complete(state, [decision(state.job, "refund", "merge", bi("Refund within 48 hours."))]));
  assert.throws(() => complete(state, [decision(state.job, "refund", "agree", bi("Refund within 48 hours."))]));
  const done = complete(state, [decision(state.job, "refund", "conflict")]);
  assert.deepEqual(done.room.segments, state.room.segments);
  assert.deepEqual(done.room.issues[0].candidates[0], { eventId: "p1", en: "", es: "" });
});

test("equivalent deletions agree; partial-sentence removal can merge without resurrecting text", () => {
  const deletes = processing(["p1", "refund", "alice", ""], ["p2", "refund", "bob", ""]);
  assert.equal(segment(complete(deletes, [decision(deletes.job, "refund", "agree", bi("", ""))]).room, "refund").en, "");
  const edits = processing(["p1", "venue", "alice", "Meet in the library courtyard at 18 Oak Street."], ["p2", "venue", "bob", "Nos reunimos en el patio de la biblioteca de la calle Oak, número 22. La entrada sur dispone de acceso sin escalones."]);
  const pair = bi("Meet in the library courtyard at 22 Oak Street.", "Nos reunimos en el patio de la biblioteca de la calle Oak, número 22.");
  const done = complete(edits, [decision(edits.job, "venue", "merge", pair)]);
  assert.equal(segment(done.room, "venue").en, pair.en); assert.doesNotMatch(segment(done.room, "venue").en, /south/);
});

test("matching conflict votes queue review, never commit; exact selected pair commits only after clear review", () => {
  const c = conflictState(); let room = c.room; const issueId = room.issues[0].id;
  room = vote(room, "alice", "p1"); assert.deepEqual(room.segments, c.initial.segments);
  room = vote(room, "bob", "p2"); assert.equal(room.issues[0].resolutionStatus, undefined);
  room = vote(room, "bob", "p1"); assert.deepEqual(room.segments, c.initial.segments);
  assert.equal(room.issues[0].status, "open"); assert.equal(room.issues[0].resolutionStatus, "queued");
  assert.strictEqual(vote(room, "bob", "p1"), room);
  const review = claimJob(room, "resolution1", t2);
  assert.equal(review.job.mode, "resolution"); assert.equal(review.job.segments.length, 6);
  assert.equal(review.room.issues[0].resolutionStatus, "processing");
  assert.strictEqual(vote(review.room, "bob", "p1"), review.room);
  assert.throws(() => vote(review.room, "bob", "p2"), { code: "BUSY" });
  const candidate = review.job.resolution.candidate;
  const done = complete(review, [decision(review.job, "admission", "apply", bi(candidate.en, candidate.es))]);
  assert.equal(done.room.issues[0].status, "resolved"); assert.equal(segment(done.room, "admission").en, candidate.en);
  assert.equal(segment(done.room, "admission").version, 2);
  assert.strictEqual(vote(done.room, "bob", "p1", issueId), done.room);
  assert.throws(() => vote(done.room, "alice", "p2", issueId), { code: "STALE" });
});

test("jointly selected resolution can still be blocked by cross-document contradiction", () => {
  const en = "Registration closes on 4 November 2026 at 18:00 local time.";
  const c = conflictState("event", en, "La inscripción cierra el 6 de noviembre de 2026 a las 18:00, hora local.");
  const review = claimJob(select(c.room), "resolution1", t2);
  const candidate = review.job.resolution.candidate;
  const done = complete(review, [decision(review.job, "event", "apply", bi(candidate.en, candidate.es))], deadlineIssue(review.job, en));
  assert.deepEqual(done.room.segments, c.initial.segments);
  const held = done.room.issues.find(i => i.status === "open");
  assert.equal(held.kind, "document"); assert.deepEqual(held.eventIds, ["p1"]);
  assert.equal(done.room.proposals.find(p => p.id === "p2").status, "cancelled");
  const corrected = propose(done.room, "fixed", "event", "bob", "La inscripción cierra el 5 de noviembre de 2026 a las 18:00, hora local.", 1, held.id);
  assert.equal(corrected.proposals.at(-1).status, "pending");
  assert.ok(corrected.issues.every(i => i.status === "resolved"));
});

test("queued votes can change safely; processing votes/candidate drift cannot silently alter review", () => {
  const c = conflictState(), queued = select(c.room), changed = vote(queued, "bob", "p2");
  assert.equal(changed.issues[0].resolutionStatus, undefined); assert.equal(claimJob(changed, "empty", t2).job, null);
  const review = claimJob(select(c.room), "resolution1", t2);
  const wrong = decision(review.job, "admission"); wrong.canonical.es += " altered";
  assert.throws(() => complete(review, [wrong]), /exact jointly selected/);
  const tampered = structuredClone(review); tampered.room.issues[0].votes.bob = "p2";
  const candidate = review.job.resolution.candidate;
  assert.throws(() => complete(tampered, [decision(review.job, "admission", "apply", bi(candidate.en, candidate.es))]), { code: "STALE_JOB" });
});

test("untouched-context content/version changes invalidate entire job; presence changes do not", () => {
  const state = processing(["p1", "admission"]), raw = result(state.job, [decision(state.job, "admission")]);
  for (const mutate of [r => segment(r, "deadline").version++, r => segment(r, "deadline").en += " Changed.", r => r.segments.pop()]) {
    const changed = structuredClone(state.room); mutate(changed); const before = JSON.stringify(changed);
    assert.throws(() => completeJob(changed, state.job.id, raw, t2), { code: "STALE_JOB" }); assert.equal(JSON.stringify(changed), before);
  }
  const presence = applyAction(state.room, { type: "presence", clientId: "bob", editingSegmentId: "venue" }, t2);
  assert.ok(presence.revision > state.room.revision);
  assert.equal(segment(completeJob(presence, state.job.id, raw, t2).room, "admission").version, 2);
});

test("invalid provenance, report, grounded excerpt, or later decision rejects whole result without mutations", () => {
  const en = "Registration closes on 4 November 2026 at 18:00 local time.";
  const state = processing(["p1", "event", "alice", en], ["p2", "venue", "bob", "Nos reunimos en 22 Oak Street."]);
  const original = { jobId: state.job.id, decisions: [decision(state.job, "event"), decision(state.job, "venue")], documentCheck: deadlineIssue(state.job, en) };
  const mutations = [
    r => delete r.documentCheck,
    r => r.documentCheck.reviewedSegmentIds.pop(),
    r => r.documentCheck.reviewedSegmentIds[0] = r.documentCheck.reviewedSegmentIds[1],
    r => r.documentCheck.issues[0].segmentIds = ["event"],
    r => r.documentCheck.issues[0].excerpts[0].text = "Invented quote",
    r => r.documentCheck.issues[0].excerpts[1].segmentId = "event",
    r => r.documentCheck.status = "clear",
    r => r.documentCheck.issues = [],
    r => r.documentCheck.issues[0].kind = "invented",
    r => r.decisions[0].provenance = [],
    r => r.decisions[0].provenance[0].eventId = "p2",
    r => r.decisions[0].provenance[0].sourceText = "Different edit",
    r => r.decisions[0].provenance[0].operation = "delete",
    r => r.decisions[0].provenance[0].disposition = "combined",
    r => r.decisions[1].canonical.es = "",
    r => r.decisions[0].canonical.en += " added fact",
    r => r.extra = true,
  ];
  const before = JSON.stringify(state.room);
  for (const mutate of mutations) {
    const invalid = structuredClone(original); mutate(invalid);
    assert.throws(() => completeJob(state.room, state.job.id, JSON.stringify(invalid), t2));
    assert.equal(JSON.stringify(state.room), before);
  }
});

test("excerpts are grounded against simultaneous prospective document, not obsolete base", () => {
  const state = processing(["p1", "event", "alice", "Registration is due November 4."], ["p2", "deadline", "bob", "La inscripción vence el 6 de noviembre."]);
  const ds = [decision(state.job, "event"), decision(state.job, "deadline")];
  const check = deadlineIssue(state.job, ds[0].canonical.en);
  assert.throws(() => complete(state, ds, check), /prospective section/);
  check.issues[0].excerpts[1] = { segmentId: "deadline", language: "es", text: ds[1].canonical.es };
  assert.equal(complete(state, ds, check).job.result.documentCheck.status, "blocked");
});

test("missing/duplicate decisions, unexpected fields, Markdown, wrong jobs and incomplete witnesses reject", () => {
  const state = processing(["p1", "admission"], ["p2", "venue", "bob"]);
  const a = decision(state.job, "admission"), b = decision(state.job, "venue");
  for (const raw of [result(state.job, [a]), result(state.job, [a, a]), result({ ...state.job, id: "other" }, [a, b]), "```json\n{}\n```", JSON.stringify({ jobId: state.job.id, decisions: [a, b], documentCheck: clear(state.job), extra: true })]) assert.throws(() => parseModelResult(raw, state.job));
  const c = conflictState(), invalid = JSON.parse(c.raw); delete invalid.decisions[0].witness.answers.p2;
  assert.throws(() => completeJob(c.initial, "job1", JSON.stringify(invalid), t2));
  const altered = JSON.parse(c.raw); altered.decisions[0].candidates[0].en = "Modified proposal";
  assert.throws(() => completeJob(c.initial, "job1", JSON.stringify(altered), t2));
});

test("queued edits made stale during relay cannot overwrite committed content", () => {
  const state = processing(["p1", "admission"]);
  const withQueued = propose(state.room, "p2", "admission", "bob");
  const done = completeJob(withQueued, state.job.id, result(state.job, [decision(state.job, "admission")]), t2).room;
  const next = claimJob(done, "job2", t2);
  assert.equal(next.job, null); assert.equal(next.room.proposals.find(p => p.id === "p2").status, "stale");
  assert.equal(propose(next.room, "p3").proposals.at(-1).status, "stale");
});

test("out-of-order/duplicate completion does not mutate state", () => {
  const state = processing(["p1", "admission"]), raw = result(state.job, [decision(state.job, "admission")]);
  assert.throws(() => completeJob(state.room, "other", raw, t2), { code: "STALE_JOB" });
  const done = completeJob(state.room, state.job.id, raw, t2).room;
  assert.throws(() => completeJob(done, state.job.id, raw, t2), { code: "STALE_JOB" });
});

test("either editor can correct a held issue; clarification text persists until explicit supersession", () => {
  const state = processing(["p1", "deadline"]), done = complete(state, [decision(state.job, "deadline", "clarify")]).room;
  assert.deepEqual(done.segments, state.room.segments);
  assert.throws(() => propose(done, "p2", "deadline"), { code: "OPEN_ISSUE" });
  const updated = propose(done, "p2", "deadline", "bob", "A las 18:00, hora local.", 1, done.issues[0].id);
  assert.equal(updated.issues[0].status, "resolved"); assert.equal(updated.proposals[0].status, "pending"); assert.equal(updated.proposals.at(-1).status, "pending");
});

test("correcting a conflict cannot discard the other editor's unresolved intent", () => {
  const c = conflictState("venue", "Meet at 18 Oak Street.", "Nos reunimos en 18 Oak Street. Entrada accesible por el este.");
  const updated = propose(c.room, "corrected", "venue", "alice", "Meet at 20 Oak Street.", 1, c.room.issues[0].id);
  assert.equal(updated.proposals.find(p => p.id === "p1").status, "cancelled");
  assert.equal(updated.proposals.find(p => p.id === "p2").status, "pending");
  assert.deepEqual(updated.segments, c.room.segments);
  const next = claimJob(updated, "corrected-review", t2);
  assert.deepEqual(new Set(next.job.eventIds), new Set(["p2", "corrected"]));
  assert.throws(() => complete(next, [decision({ ...next.job, proposals: [next.job.proposals[1]] }, "venue")]), /proposal IDs/);
  const held = complete(next, [decision(next.job, "venue", "conflict")]);
  assert.deepEqual(held.room.segments, c.room.segments);
  assert.equal(held.room.issues.find(i => i.status === "open").candidates.length, 2);
});

test("legacy active jobs are rejected, abandon preserves and requeues drafts for new full-context protocol", () => {
  const state = processing(["p1", "admission"]), legacy = structuredClone(state.room);
  delete legacy.jobs[0].protocolVersion; delete legacy.jobs[0].mode; legacy.jobs[0].segments = [segment(legacy, "admission")];
  assert.throws(() => completeJob(legacy, state.job.id, "{}", t2), { code: "LEGACY_JOB" });
  const recovered = abandonJob(legacy, state.job.id, t2);
  assert.equal(recovered.room.activeJobId, null); assert.equal(recovered.job.status, "abandoned"); assert.equal(recovered.room.proposals[0].status, "pending");
  assert.strictEqual(abandonJob(recovered.room, state.job.id, t2).room, recovered.room);
  const retried = claimJob(recovered.room, "retry", t2);
  assert.equal(retried.job.protocolVersion, 2); assert.equal(retried.job.segments.length, 6);
  assert.deepEqual(retried.room.segments, legacy.segments);
});

test("stale context can be abandoned/retried; stale target drafts remain available as stale", () => {
  const state = processing(["p1", "admission"]), context = structuredClone(state.room);
  segment(context, "deadline").version++;
  const retry = claimJob(abandonJob(context, state.job.id, t2).room, "retry", t2);
  assert.equal(segment({ segments: retry.job.segments }, "deadline").version, 2);
  const changedTarget = structuredClone(state.room); segment(changedTarget, "admission").version++;
  const recovered = abandonJob(changedTarget, state.job.id, t2);
  assert.equal(recovered.room.proposals[0].status, "stale"); assert.equal(recovered.room.proposals[0].text, "p1 proposal");
});

test("abandoning a resolution unlocks votes and correction without losing candidates", () => {
  const c = conflictState(), review = claimJob(select(c.room), "resolution1", t2);
  assert.throws(() => propose(review.room, "fixed", "admission", "bob", "A new rule", 1, review.room.issues[0].id), { code: "BUSY" });
  const recovered = abandonJob(review.room, review.job.id, t2).room;
  assert.equal(recovered.issues[0].resolutionStatus, undefined); assert.deepEqual(recovered.issues[0].votes, {});
  assert.equal(recovered.issues[0].candidates.length, 2); assert.equal(recovered.proposals[0].status, "conflict");
  assert.equal(claimJob(select(recovered), "resolution2", t2).job.mode, "resolution");
});

test("claims freeze exact proposal set; pure reducers never mutate input on success", () => {
  const room = fresh(), before = JSON.stringify(room), next = propose(room, "p1");
  assert.equal(JSON.stringify(room), before); assert.equal(next.proposals.length, 1);
  const state = claimJob(next, "job1", t1), queued = propose(state.room, "p2", "venue", "bob");
  assert.deepEqual(state.job.eventIds, ["p1"]); assert.throws(() => claimJob(queued, "job2", t2), { code: "BUSY" });
  const done = completeJob(queued, state.job.id, result(state.job, [decision(state.job, "admission")]), t2).room;
  assert.deepEqual(claimJob(done, "job2", t2).job.eventIds, ["p2"]);
});
