import { applyStudioAction, createStudioDemoRoom } from "./studio.ts";
import { completeStudioRepair, repairJobIsCurrent, startStudioRepair } from "./studio-repair.ts";
import { studioFullDemoFixture as fixture } from "./studio-full-demo-fixture.ts";
import { RoomError } from "./room.ts";
import type { StudioRoom } from "./studio-types";

/** Fresh, isolated rehearsal of retained Meta outputs. All checks run again;
 * the previously agreed baseline is setup, never approval of the new repair. */
export function createStudioFullDemoRoom(id: string, now: string): StudioRoom {
  let room = createStudioDemoRoom(id, now, { ...fixture.drafts, candidates: fixture.candidates });
  const candidate = room.review!.candidates.find(c => c.editor === fixture.baselineEditor)!;
  // The replay begins with the recorded v2 agreement already in force.
  for (const editor of ["alice", "bob"] as const) {
    room = applyStudioAction(room, { type: "vote", editor, reviewId: room.review!.id, candidateId: candidate.id }, now);
  }
  room = applyStudioAction(room, { type: "register", requestId: "demo-baseline-receipt", policyVersion: room.published.version, label: "Example attendee · recorded starting policy", ...fixture.attendee }, now);
  const unsafeRepairId = `demo-unsafe-${room.id}`, correctedRepairId = `demo-corrected-${room.id}`;
  room = startStudioRepair(room, { baselineCandidateId: candidate.id, scopeFlag: "student", feeCents: 1900 }, now, unsafeRepairId, { en: fixture.unsafeProposal.en, es: fixture.unsafeProposal.es });
  room = completeStudioRepair(room, unsafeRepairId, fixture.unsafeProposal, now);
  if (room.repair?.status !== "blocked") throw new RoomError("The saved unsafe example no longer produces its expected block.", "DEMO_INVALID", 500);
  room.fullDemo = { kind: "beacon-repair-v1", recordedAt: fixture.recordedAt, model: fixture.model, unsafeRepairId, correctedRepairId };
  room.modelCallCount = 0;
  room.review!.provenance = "fixture-replay";
  return room;
}

/** One explicit step, no provider request: revalidate the saved corrected output.
 * Repeated clicks are idempotent; changed drafts cannot reuse the recorded check. */
export function loadStudioDemoRepair(before: StudioRoom, repairId: string, now: string): StudioRoom {
  const demo = before.fullDemo, repair = before.repair;
  if (demo?.kind !== "beacon-repair-v1") throw new RoomError("Start the full recorded demo before loading this saved repair.", "DEMO_UNAVAILABLE", 409);
  if (repairId !== demo.unsafeRepairId || !repair) throw new RoomError("This recorded repair is no longer current.", "STALE_REPAIR", 409);
  if (repair.id === demo.correctedRepairId) {
    if (repair.status === "ready" && repairJobIsCurrent(before, repair.job)) return before;
    if (repair.status === "published" && repair.publishedVersion === before.published.version && before.published.candidateId === repair.id) return before;
    throw new RoomError("The demo drafts changed. Start a fresh demo to replay the saved repair.", "STALE_REPAIR", 409);
  }
  if (repair.id !== demo.unsafeRepairId || repair.status !== "blocked" || !repairJobIsCurrent(before, repair.job)) {
    throw new RoomError("The demo drafts changed. Start a fresh demo to replay the saved repair.", "STALE_REPAIR", 409);
  }
  const started = startStudioRepair(before, repair.job.intent, now, demo.correctedRepairId);
  const room = completeStudioRepair(started, demo.correctedRepairId, fixture.correctedProposal, now);
  if (room.repair?.status !== "ready") throw new RoomError("The saved correction did not pass the current impact check. Nothing was published.", "DEMO_INVALID", 409);
  // This compound operation is one atomic storage transition.
  room.revision = before.revision + 1;
  room.modelCallCount = 0;
  return room;
}
