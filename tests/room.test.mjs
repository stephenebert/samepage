import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, claimJob, completeJob, createRoom, parseModelResult } from "../lib/room.ts";

const t0 = "2026-10-14T10:00:00.000Z";
const t1 = "2026-10-14T10:00:02.000Z";
const t2 = "2026-10-14T10:00:12.000Z";
const bi = (s) => ({ en: s, es: `ES ${s}` });
const propose = (room, id, segmentId = "admission", clientId = "alice", baseVersion = 1) =>
  applyAction(room, { type: "propose", id, clientId, segmentId, baseVersion, text: `${id} proposal` }, t0);
const decision = (segmentId, ids, status = "apply") => ({ segmentId, eventIds: ids, status, canonical: bi(`${segmentId} accepted`), candidates: [], explanation: bi("Reason"), witness: null, clarificationQuestion: null });
const result = (job, decisions) => JSON.stringify({ jobId: job.id, decisions });
function processing(...proposals) {
  let room = createRoom("test", t0);
  for (const [id, segment, client] of proposals) room = propose(room, id, segment, client);
  return claimJob(room, "job1", t1);
}
function conflictState() {
  const { room, job } = processing(["p1", "admission", "alice"], ["p2", "admission", "bob"]);
  const d = { ...decision("admission", ["p1", "p2"], "conflict"), canonical: null,
    candidates: [{ eventId: "p1", ...bi("A") }, { eventId: "p2", ...bi("B") }],
    witness: { question: bi("Boundary?"), answers: { p1: bi("Yes"), p2: bi("No") } } };
  return { initial: room, raw: result(job, [d]), ...completeJob(room, job.id, result(job, [d]), t2) };
}

test("duplicate retries are idempotent and reused IDs cannot change content", () => {
  const room = propose(createRoom("test", t0), "p1");
  assert.strictEqual(propose(room, "p1"), room);
  assert.throws(() => propose(room, "p1", "venue"), { code: "DUPLICATE_ID" });
});
test("safe update commits both languages, untouched segments retain exact versions, timing separated", () => {
  const { room, job } = processing(["p1", "admission"]);
  const done = completeJob(room, job.id, result(job, [decision("admission", ["p1"])]), t2);
  assert.equal(done.room.segments.find(s => s.id === "admission").version, 2);
  assert.deepEqual(done.room.segments.filter(s => s.id !== "admission"), room.segments.filter(s => s.id !== "admission"));
  assert.equal(done.job.queueMs, 2000); assert.equal(done.job.processingMs, 10000);
  assert.equal(done.room.activeJobId, null);
});
test("invalid later decision rolls back entire batch, preserving active job for retry", () => {
  const { room, job } = processing(["p1", "admission"], ["p2", "venue", "bob"]);
  const before = JSON.stringify(room);
  const bad = decision("venue", ["p2"]); bad.canonical.es = "";
  assert.throws(() => completeJob(room, job.id, result(job, [decision("admission", ["p1"]), bad]), t2));
  assert.equal(JSON.stringify(room), before);
  assert.equal(room.activeJobId, job.id);
});
test("missing or duplicate results, unexpected fields, Markdown, wrong job, and invalid witnesses are rejected", () => {
  const { room, job } = processing(["p1", "admission"], ["p2", "venue", "bob"]);
  const a = decision("admission", ["p1"]), b = decision("venue", ["p2"]);
  for (const raw of [result(job, [a]), result(job, [a, a]), JSON.stringify({ jobId: "other", decisions: [a, b] }), "```json\n{}\n```", JSON.stringify({ jobId: job.id, decisions: [a, b], extra: true })]) {
    assert.throws(() => parseModelResult(raw, job));
  }
  const c = conflictState(); const invalid = JSON.parse(c.raw); delete invalid.decisions[0].witness.answers.p2;
  assert.throws(() => completeJob(c.initial, "job1", JSON.stringify(invalid), t2));
  assert.equal(room.proposals[0].status, "processing");
});
test("conflict keeps agreed state; one vote and conflicting votes cannot commit; matching votes commit once", () => {
  const c = conflictState(); let room = c.room;
  assert.deepEqual(room.segments, c.initial.segments);
  const issueId = room.issues[0].id;
  room = applyAction(room, { type: "vote", clientId: "alice", issueId, candidateEventId: "p1" }, t2);
  assert.deepEqual(room.segments, c.initial.segments);
  room = applyAction(room, { type: "vote", clientId: "bob", issueId, candidateEventId: "p2" }, t2);
  assert.deepEqual(room.segments, c.initial.segments); assert.equal(room.issues[0].status, "open");
  room = applyAction(room, { type: "vote", clientId: "bob", issueId, candidateEventId: "p1" }, t2);
  assert.equal(room.issues[0].status, "resolved"); assert.equal(room.segments.find(s => s.id === "admission").en, "A");
  assert.equal(room.segments.find(s => s.id === "admission").version, 2);
  assert.strictEqual(applyAction(room, { type: "vote", clientId: "bob", issueId, candidateEventId: "p1" }, t2), room);
  assert.throws(() => applyAction(room, { type: "vote", clientId: "alice", issueId, candidateEventId: "p2" }, t2), { code: "STALE" });
});
test("an edit based on old version is held; queued edit made stale during relay cannot overwrite", () => {
  const { room, job } = processing(["p1", "admission"]);
  const withQueued = propose(room, "p2", "admission", "bob");
  const done = completeJob(withQueued, job.id, result(job, [decision("admission", ["p1"])]), t2).room;
  const next = claimJob(done, "job2", t2);
  assert.equal(next.job, null); assert.equal(next.room.proposals.find(p => p.id === "p2").status, "stale");
  const old = propose(next.room, "p3", "admission", "alice", 1);
  assert.equal(old.proposals.find(p => p.id === "p3").status, "stale");
  assert.equal(old.segments.find(s => s.id === "admission").version, 2);
});
test("out-of-order or duplicate completion cannot mutate state; segment snapshot mismatch rejects full batch", () => {
  const { room, job } = processing(["p1", "admission"]), raw = result(job, [decision("admission", ["p1"])]);
  assert.throws(() => completeJob(room, "other", raw, t2), { code: "STALE_JOB" });
  const tampered = structuredClone(room); tampered.segments.find(s => s.id === "admission").version++;
  const before = JSON.stringify(tampered); assert.throws(() => completeJob(tampered, job.id, raw, t2), { code: "STALE_JOB" }); assert.equal(JSON.stringify(tampered), before);
  const done = completeJob(room, job.id, raw, t2).room;
  assert.throws(() => completeJob(done, job.id, raw, t2), { code: "STALE_JOB" });
});
test("clarification preserves agreed text and a new explicit proposal can supersede it", () => {
  const { room, job } = processing(["p1", "deadline"]);
  const d = { ...decision("deadline", ["p1"], "clarify"), canonical: null, clarificationQuestion: bi("Morning or evening?") };
  const done = completeJob(room, job.id, result(job, [d]), t2).room;
  assert.deepEqual(done.segments, room.segments);
  assert.throws(() => propose(done, "p2", "deadline"), { code: "OPEN_ISSUE" });
  const updated = applyAction(done, { type: "propose", id: "p2", clientId: "alice", segmentId: "deadline", baseVersion: 1, text: "6pm local", supersedesIssueId: done.issues[0].id }, t2);
  assert.equal(updated.issues[0].status, "resolved"); assert.equal(updated.proposals.at(-1).status, "pending");
});
test("claimed jobs freeze exact proposal set and exclude later pending proposals", () => {
  const { room, job } = processing(["p1", "admission"]);
  const next = propose(room, "p2", "venue", "bob");
  assert.deepEqual(job.eventIds, ["p1"]); assert.deepEqual(next.jobs[0].eventIds, ["p1"]);
  assert.throws(() => claimJob(next, "job2", t2), { code: "BUSY" });
  const done = completeJob(next, job.id, result(job, [decision("admission", ["p1"])]), t2).room;
  assert.deepEqual(claimJob(done, "job2", t2).job.eventIds, ["p2"]);
});
test("pure reducers never mutate their caller's room on success", () => {
  const room = createRoom("test", t0), before = JSON.stringify(room);
  const next = propose(room, "p1");
  assert.equal(JSON.stringify(room), before); assert.equal(next.proposals.length, 1);
});
