import { RoomError } from "./room.ts";
import { discoverStudioConsequences, parseStudioRules, STUDIO_FLAGS, studioInteger, studioKeys, studioObject, studioText } from "./studio-engine.ts";
import type { StudioEditor, StudioRepairImpact, StudioRepairIntent, StudioRepairJob, StudioRepairProposal, StudioRoom, StudioRules, StudioText } from "./studio-types";

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function fail(message: string, code = "INVALID_REPAIR", status = 400): never { throw new RoomError(message, code, status); }
const changed = (room: StudioRoom, now: string) => { room.revision++; room.updatedAt = now; return room; };

export function parseStudioRepairIntent(value: unknown): StudioRepairIntent {
  const intent = studioObject(value, "repair intent"); studioKeys(intent, ["baselineCandidateId", "scopeFlag", "feeCents"], "repair intent");
  const baselineCandidateId = studioText(intent.baselineCandidateId, "baselineCandidateId", 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(baselineCandidateId)) fail("Invalid baseline candidate ID.");
  if (!STUDIO_FLAGS.includes(intent.scopeFlag as StudioRepairIntent["scopeFlag"])) fail("Choose a supported attendee group.");
  return { baselineCandidateId, scopeFlag: intent.scopeFlag as StudioRepairIntent["scopeFlag"], feeCents: studioInteger(intent.feeCents, "repair fee", 0, 1000000) };
}

export function parseStudioRepairProposal(value: unknown): StudioRepairProposal {
  const p = studioObject(value, "repair proposal"); studioKeys(p, ["en", "es", "rules", "issues"], "repair proposal");
  const en = studioText(p.en, "repair English", 8000), es = studioText(p.es, "repair Spanish", 8000);
  if (!Array.isArray(p.issues) || p.issues.length > 16) fail("Provide at most 16 repair clarification issues.");
  const issues = (p.issues as unknown[]).map(issue => studioText(issue, "repair issue", 1000));
  const rules = p.rules === null ? null : parseStudioRules(p.rules);
  if ((rules === null) !== (issues.length > 0)) fail("Unresolved repairs need null rules and issues; complete repairs must have no issues.");
  return { en, es, rules, issues };
}

/** The intent is a fee-only change. It never waives eligibility or time rules. */
export function buildExpectedRepairRules(baselineValue: StudioRules, intentValue: StudioRepairIntent): StudioRules {
  const baseline = parseStudioRules(baselineValue), intent = parseStudioRepairIntent(intentValue);
  return parseStudioRules({ eligibility: copy(baseline.eligibility), fee: { ...copy(baseline.fee), overrides: [
    { when: { op: "flag", field: intent.scopeFlag, value: true }, cents: intent.feeCents, label: `Agreed ${intent.scopeFlag} fee` },
    ...copy(baseline.fee.overrides),
  ] } });
}

export function repairJobIsCurrent(room: StudioRoom, job: StudioRepairJob): boolean {
  const review = room.review;
  return !!review && review.id === job.reviewId && room.published.version === job.basePolicyVersion
    && same(room.drafts, job.drafts)
    && same(review.candidates.find(candidate => candidate.id === job.baseline.id), job.baseline);
}

/** Call only from the server's request claim; this cannot publish or grant votes. */
export function startStudioRepair(before: StudioRoom, intentValue: StudioRepairIntent, now: string, jobId = `studio-repair-${before.revision + 1}`, proposalText?: StudioText): StudioRoom {
  const intent = parseStudioRepairIntent(intentValue), review = before.review;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(jobId)) fail("Invalid repair job ID.");
  if (!review || review.discovery.status === "unresolved") fail("Interpret and clarify both saved drafts before proposing a repair.", "REPAIR_BASELINE_UNRESOLVED", 409);
  if ((review.status === "open" && review.basePolicyVersion !== before.published.version)
    || (review.status === "published" && review.publishedVersion !== before.published.version)
    || review.candidates.some(candidate => candidate.sourceVersion !== before.drafts[candidate.editor].version)) fail("The baseline review is outdated. Review the current drafts first.", "STALE_REPAIR", 409);
  const baseline = review.candidates.find(candidate => candidate.id === intent.baselineCandidateId);
  if (!baseline?.rules || baseline.issues.length) fail("Choose a complete candidate from the current review.", "REPAIR_BASELINE_UNRESOLVED", 409);
  // Fail before consuming provider allowance if the desired rules cannot fit.
  buildExpectedRepairRules(baseline.rules, intent);
  let proposed: StudioText | undefined;
  if (proposalText !== undefined) {
    const text = studioObject(proposalText, "proposal text"); studioKeys(text, ["en", "es"], "proposal text");
    proposed = { en: studioText(text.en, "proposal English", 8000), es: studioText(text.es, "proposal Spanish", 8000) };
  }
  const room = copy(before);
  if (room.repair) room.repairHistory = [...(room.repairHistory ?? []), copy(room.repair)].slice(-6);
  const job: StudioRepairJob = { id: jobId, reviewId: review.id, basePolicyVersion: before.published.version, drafts: copy(before.drafts), baseline: copy(baseline), intent, ...(proposed ? { proposalText: proposed } : {}), createdAt: now };
  room.repair = { id: jobId, job, proposal: null, impact: null, votes: {}, status: "running", createdAt: now };
  // A proposal starts a new agreement. Existing original-policy approvals cannot
  // be carried into it or used to bypass its impact check.
  if (room.review) room.review.votes = {};
  return changed(room, now);
}

export function checkStudioRepairImpact(baselineValue: StudioRules, intent: StudioRepairIntent, proposalRules: StudioRules | null, maxCases = 500000): StudioRepairImpact {
  const baseline = parseStudioRules(baselineValue), expectedRules = buildExpectedRepairRules(baseline, intent);
  const verification = discoverStudioConsequences(expectedRules, proposalRules, maxCases);
  const changes = discoverStudioConsequences(baseline, proposalRules, maxCases);
  const status = verification.status === "unresolved" || changes.status === "unresolved" ? "unresolved" : verification.status === "equivalent" ? "pass" : "blocked";
  const issues = status === "unresolved" ? [...new Set([...verification.issues, ...changes.issues])]
    : status === "blocked" ? ["The proposal changes outcomes beyond the agreed fee-only intent or fails to make the requested fee change. It cannot be published."] : [];
  return { status, expectedRules, verification, changes, issues };
}

/** Applies a fully parsed proposal to the exact saved source/intent snapshot. */
export function completeStudioRepair(before: StudioRoom, jobId: string, proposalValue: StudioRepairProposal, now: string): StudioRoom {
  const repair = before.repair;
  if (!repair || repair.id !== jobId || repair.status !== "running" || !repairJobIsCurrent(before, repair.job)) fail("The repair is no longer current. No proposal was applied.", "STALE_REPAIR", 409);
  const proposal = parseStudioRepairProposal(proposalValue);
  if (repair.job.proposalText && !same(repair.job.proposalText, { en: proposal.en, es: proposal.es })) fail("The checked proposal text changed.", "REPAIR_SOURCE_CHANGED", 409);
  const impact = checkStudioRepairImpact(repair.job.baseline.rules!, repair.job.intent, proposal.rules);
  const room = copy(before);
  room.repair = { ...copy(repair), proposal, impact, votes: {}, status: impact.status === "pass" ? "ready" : "blocked", completedAt: now };
  return changed(room, now);
}

/** Rechecks the saved rules before either vote; an untrusted client cannot bypass impact. */
export function voteStudioRepair(before: StudioRoom, editor: StudioEditor, repairId: string, now: string): StudioRoom {
  if (editor !== "alice" && editor !== "bob") fail("Choose Alice or Bob.");
  const repair = before.repair;
  if (!repair || repair.id !== repairId) fail("This repair is no longer current.", "STALE_REPAIR", 409);
  if (repair.status === "published") {
    if (repair.votes[editor] && repair.publishedVersion === before.published.version && before.published.candidateId === repair.id) return before;
    fail("This repair has already been published.", "STALE_REPAIR", 409);
  }
  if (repair.status !== "ready" || !repair.proposal?.rules || repair.impact?.status !== "pass") fail("Only a complete repair that passes every impact check can be approved.", "REPAIR_BLOCKED", 409);
  if (!repairJobIsCurrent(before, repair.job)) fail("The drafts, baseline, or published policy changed. Review a fresh repair.", "STALE_REPAIR", 409);
  const impact = checkStudioRepairImpact(repair.job.baseline.rules!, repair.job.intent, repair.proposal.rules);
  if (impact.status !== "pass") fail("This proposal does not satisfy the agreed intent.", "REPAIR_BLOCKED", 409);
  if (repair.votes[editor]) return before;
  const room = copy(before), next = room.repair!;
  next.votes[editor] = true;
  if (next.votes.alice && next.votes.bob) {
    room.published = { version: before.published.version + 1, en: next.proposal!.en, es: next.proposal!.es, rules: copy(next.proposal!.rules!), publishedAt: now, reviewId: next.job.reviewId, candidateId: next.id };
    next.status = "published"; next.publishedVersion = room.published.version;
  }
  return changed(room, now);
}

/** Called after a real draft change; old approvals and provider work are invalid. */
export function supersedeStudioRepair(room: StudioRoom, now: string): void {
  if (room.repair) room.repair = { ...room.repair, status: "superseded", votes: {}, completedAt: now };
  if (room.automaticRepair) room.automaticRepair = { ...room.automaticRepair, status: "superseded", finishedAt: now, durationMs: Math.max(0, Date.parse(now) - Date.parse(room.automaticRepair.startedAt)) };
}
