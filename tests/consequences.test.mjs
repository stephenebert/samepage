import test from "node:test";
import assert from "node:assert/strict";
import { createConsequencesRoom, applyConsequencesAction, parseConsequencesAction, parsePolicyRules, evaluatePolicy, summarizePolicy } from "../lib/consequences.ts";

// These fixtures test mechanics. They are not evidence of model interpretation.
const now = "2026-10-20T10:00:00.000Z";
const fresh = () => createConsequencesRoom("test", now);
const act = (room, action) => applyConsequencesAction(room, action, now);
const draft = (room, editor, text) => act(room, { type: "draft", editor, text, baseVersion: room.drafts[editor].version });
const request = room => act(room, { type: "requestReview" });
const attendee = (age = 17, resident = false, submittedAt = "2026-11-05T17:00:00.000Z") => ({ age, resident, submittedAt });
function response(room, aliceRules = room.published.rules, bobRules = { ...room.published.rules, join: "any" }) {
  return { jobId: room.activeJob.id, candidates: [
    { editor: "alice", sourceVersion: room.drafts.alice.version, en: room.drafts.alice.text, es: "Traducción de prueba.", rules: aliceRules, issues: aliceRules ? [] : ["Parental consent is outside the supported rules."] },
    { editor: "bob", sourceVersion: room.drafts.bob.version, en: "Fixture translation.", es: room.drafts.bob.text, rules: bobRules, issues: bobRules ? [] : ["Eligibility needs clarification."] },
  ] };
}
const reviewed = () => { const room = request(fresh()); return act(room, { type: "completeReview", response: response(room) }); };
const vote = (room, editor, owner = "bob") => act(room, { type: "vote", editor, reviewId: room.review.id, candidateId: room.review.candidates.find(c => c.editor === owner).id });
const register = (room, requestId = "r1", input = attendee()) => act(room, { type: "register", requestId, policyVersion: room.published.version, label: "Synthetic attendee", ...input });

test("AND and OR change the actual decision for the same 17-year-old nonresident", () => {
  const rules = fresh().published.rules;
  assert.equal(evaluatePolicy(rules, attendee()).accepted, false);
  assert.equal(evaluatePolicy({ ...rules, join: "any" }, attendee()).accepted, true);
  for (const join of ["all", "any"]) {
    const actual = [[15, false], [15, true], [16, false], [16, true]].map(([age, resident]) => evaluatePolicy({ ...rules, join }, attendee(age, resident)).accepted);
    assert.deepEqual(actual, join === "all" ? [false, false, false, true] : [false, true, true, true]);
  }
});
test("inactive predicates do not turn an OR into unconditional acceptance", () => {
  const rules = fresh().published.rules;
  assert.equal(evaluatePolicy({ ...rules, residentRequired: false, join: "any" }, attendee(15)).accepted, false);
  assert.equal(evaluatePolicy({ ...rules, minAge: null, join: "any" }, attendee(99, false)).accepted, false);
  assert.equal(evaluatePolicy({ ...rules, minAge: null, residentRequired: false }, attendee(0, false)).accepted, true);
});
test("deadline is always AND, including OR eligibility; exact boundary respects inclusivity", () => {
  const rules = { ...fresh().published.rules, join: "any" };
  assert.equal(evaluatePolicy(rules, attendee(17, false, "2026-11-05T18:00:00.000Z")).accepted, true);
  assert.equal(evaluatePolicy({ ...rules, deadlineInclusive: false }, attendee(17, false, "2026-11-05T18:00:00.000Z")).accepted, false);
  assert.equal(evaluatePolicy(rules, attendee(17, true, "2026-11-05T18:00:00.001Z")).accepted, false);
  assert.equal(evaluatePolicy({ ...rules, deadline: null }, attendee(17, true, "2029-01-01T00:00:00.000Z")).accepted, true);
});
test("rule parser rejects unsupported keys, invalid numbers, impossible dates and implicit timezones", () => {
  const rules = fresh().published.rules;
  for (const invalid of [{ ...rules, maxAge: 30 }, { ...rules, minAge: -1 }, { ...rules, minAge: 16.5 }, { ...rules, minAge: 121 }, { ...rules, residentRequired: "true" }, { ...rules, join: "xor" }, { ...rules, deadline: "2026-02-30T18:00:00Z" }, { ...rules, deadline: "2026-11-05T18:00:00" }]) assert.throws(() => parsePolicyRules(invalid));
  assert.equal(parsePolicyRules({ ...rules, deadline: "2026-11-05T18:00:00Z" }).deadline, rules.deadline);
});
test("invalid attendee values cannot bypass the evaluator", () => {
  const rules = fresh().published.rules;
  for (const invalid of [{ ...attendee(), age: NaN }, { ...attendee(), age: 16.5 }, { ...attendee(), age: 121 }, { ...attendee(), resident: "false" }, { ...attendee(), submittedAt: "tomorrow" }]) assert.throws(() => evaluatePolicy(rules, invalid));
});
test("fresh room has an explicit UTC baseline and truthful relay mode", () => {
  const room = fresh();
  assert.equal(room.kind, "samepage-consequences-v1"); assert.equal(room.id, "consequence-test");
  assert.equal(room.mode, "agent-manual-relay"); assert.equal(room.published.version, 1);
  assert.match(room.published.en, /UTC/); assert.match(room.published.es, /UTC/);
  assert.match(summarizePolicy(room.published.rules), /AND/); assert.match(summarizePolicy({ ...room.published.rules, join: "any" }, "es"), / O /);
});
test("two simultaneous editor saves preserve both drafts with independent versions", () => {
  const baseline = fresh();
  let room = act(baseline, { type: "draft", editor: "alice", baseVersion: 1, text: "Alice changed policy." });
  room = act(room, { type: "draft", editor: "bob", baseVersion: 1, text: "Política de Bob." });
  assert.equal(room.drafts.alice.text, "Alice changed policy."); assert.equal(room.drafts.bob.text, "Política de Bob.");
  assert.equal(room.drafts.alice.version, 2); assert.equal(room.drafts.bob.version, 2);
  assert.equal(baseline.revision, 0); assert.equal(room.revision, 2);
});
test("same-editor stale saves reject and exact retries are idempotent", () => {
  const action = { type: "draft", editor: "alice", baseVersion: 1, text: "Alice changed policy." };
  const room = act(fresh(), action);
  assert.strictEqual(act(room, action), room);
  assert.throws(() => act(room, { ...action, text: "Overwriting stale draft." }), { code: "STALE_DRAFT" });
});
test("review snapshots exact drafts and retry does not replace pending job", () => {
  const room = request(fresh());
  assert.deepEqual(room.activeJob.drafts, room.drafts); assert.strictEqual(request(room), room);
  assert.match(room.activeJob.prompt, /preserve the editor's source-language text EXACTLY/);
  assert.match(room.activeJob.prompt, /Never partially compile an unsupported policy/);
  assert.match(room.activeJob.prompt, /Deadline is ALWAYS ANDed/);
});
test("review source text must be byte-identical; duplicate editors, stale versions and extra fields reject", () => {
  const room = request(fresh()), valid = response(room);
  for (const mutate of [v => { v.candidates[0].en += " "; }, v => { v.candidates[1] = v.candidates[0]; }, v => { v.candidates[0].sourceVersion++; }, v => { v.jobId = "old-job"; }, v => { v.candidates[0].extra = true; }]) {
    const bad = structuredClone(valid); mutate(bad);
    assert.throws(() => act(room, { type: "completeReview", response: bad }));
  }
  const done = act(room, { type: "completeReview", response: JSON.stringify(valid) });
  assert.equal(done.review.candidates.length, 2); assert.equal(done.activeJob, null); assert.equal(done.published.version, 1);
});
test("an unresolved model interpretation cannot be approved or partly executed", () => {
  const room = request(fresh()), invalid = response(room, null);
  const done = act(room, { type: "completeReview", response: invalid });
  assert.equal(done.review.candidates[0].rules, null);
  assert.throws(() => vote(done, "alice", "alice"), { code: "UNRESOLVED" });
  assert.equal(done.published.version, 1);
  invalid.candidates[0].rules = room.published.rules;
  assert.throws(() => act(room, { type: "completeReview", response: invalid }));
  invalid.candidates[0].rules = null; invalid.candidates[0].issues = [];
  assert.throws(() => act(room, { type: "completeReview", response: invalid }));
});
test("one approval and opposing approvals leave working form unchanged", () => {
  let room = vote(reviewed(), "alice", "bob");
  assert.equal(room.published.version, 1); assert.equal(evaluatePolicy(room.published.rules, attendee()).accepted, false);
  room = vote(room, "bob", "alice");
  assert.equal(room.published.version, 1); assert.equal(room.review.status, "open");
});
test("both editors approving the exact candidate publish text and rules atomically", () => {
  let room = reviewed(); const selected = room.review.candidates[1];
  room = vote(vote(room, "alice"), "bob");
  assert.equal(room.published.version, 2); assert.equal(room.review.status, "published");
  assert.equal(room.published.en, selected.en); assert.equal(room.published.es, selected.es);
  assert.deepEqual(room.published.rules, selected.rules); assert.equal(room.published.candidateId, selected.id);
  assert.equal(evaluatePolicy(room.published.rules, attendee()).accepted, true);
  assert.strictEqual(vote(room, "bob"), room); assert.strictEqual(request(room), room);
});
test("any genuine draft change invalidates both pending review and approvals", () => {
  const pending = request(fresh()), oldResponse = response(pending);
  const changedPending = draft(pending, "bob", "Nueva propuesta.");
  assert.equal(changedPending.activeJob, null);
  assert.throws(() => act(changedPending, { type: "completeReview", response: oldResponse }), { code: "STALE_REVIEW" });
  const voted = vote(reviewed(), "alice"), changedVote = draft(voted, "bob", "Nueva propuesta.");
  assert.equal(changedVote.review, null); assert.equal(changedVote.published.version, 1);
  assert.throws(() => act(changedVote, { type: "vote", editor: "bob", reviewId: voted.review.id, candidateId: voted.review.candidates[1].id }), { code: "STALE_REVIEW" });
  const newer = request(changedVote);
  assert.notEqual(newer.activeJob.id, voted.review.id);
});
test("registration records server decision and original policy version across later publications", () => {
  let room = register(reviewed());
  assert.equal(room.registrations[0].decision.accepted, false); assert.equal(room.registrations[0].policyVersion, 1);
  room = vote(vote(room, "alice"), "bob"); room = register(room, "r2");
  assert.equal(room.registrations[0].decision.accepted, false); assert.equal(room.registrations[0].policyVersion, 1);
  assert.equal(room.registrations[1].decision.accepted, true); assert.equal(room.registrations[1].policyVersion, 2);
});
test("stale form cannot register under a different approved policy", () => {
  const room = vote(vote(reviewed(), "alice"), "bob");
  assert.throws(() => act(room, { type: "register", requestId: "stale", policyVersion: 1, label: "Synthetic", ...attendee() }), { code: "STALE_POLICY" });
  assert.equal(room.registrations.length, 0);
});
test("registration retries are idempotent even after policy update; reused ID with changed details rejects", () => {
  const action = { type: "register", requestId: "retry", policyVersion: 1, label: "Synthetic", ...attendee() };
  let room = act(reviewed(), action); assert.strictEqual(act(room, action), room);
  room = vote(vote(room, "alice"), "bob"); assert.strictEqual(act(room, action), room);
  assert.throws(() => act(room, { ...action, resident: true }), { code: "DUPLICATE_ID" });
  assert.equal(room.registrations.length, 1);
});
test("action parser rejects forged decisions and unknown approval or registration fields", () => {
  for (const action of [{ type: "requestReview", publish: true }, { type: "draft", editor: "alice", baseVersion: 1, text: "" }, { type: "vote", editor: "carol", reviewId: "a", candidateId: "b" }, { type: "register", requestId: "a", policyVersion: 1, label: "Synthetic", ...attendee(), decision: { accepted: true } }]) assert.throws(() => parseConsequencesAction(action));
});
