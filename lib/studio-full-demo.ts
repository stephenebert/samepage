import { applyStudioAction, createStudioDemoRoom } from "./studio.ts";
import { completeStudioRepair, repairJobIsCurrent, startStudioRepair } from "./studio-repair.ts";
import { getStudioExample } from "./studio-example-inputs.ts";
import { STUDIO_EXAMPLE_FIXTURES } from "./studio-example-fixtures.ts";
import { RoomError } from "./room.ts";
import type { StudioRoom } from "./studio-types";

/** Fresh, isolated rehearsal of retained Meta outputs. All checks run again;
 * the previously agreed baseline is setup, never approval of the new repair. */
export function createStudioFullDemoRoom(id: string, now: string, exampleId: unknown = "beacon"): StudioRoom {
  const example = getStudioExample(exampleId);
  if (example.id === "consent" || example.id === "interaction") throw new RoomError(`${example.title} uses fresh Meta requests. Open its live demo.`, "DEMO_UNAVAILABLE", 409);
  const fixture = STUDIO_EXAMPLE_FIXTURES[example.id];
  let room = createStudioDemoRoom(id, now, { ...example.drafts, candidates: fixture.candidates });
  room.modelCallCount = 0;
  if (example.id === "cobalt") {
    if (room.review?.discovery.status !== "unresolved") throw new RoomError("The saved clarification example no longer produces its expected block.", "DEMO_INVALID", 500);
    room.fullDemo = { kind: "cobalt-clarification-v1", exampleId: example.id, recordedAt: fixture.recordedAt, model: fixture.model };
    return room;
  }
  if (!fixture.baselineEditor || !fixture.unsafeProposal || !example.attendee || !example.intent) throw new RoomError("This repair example is incomplete.", "DEMO_INVALID", 500);
  const candidate = room.review!.candidates.find(c => c.editor === fixture.baselineEditor)!;
  // The replay begins with the recorded v2 agreement already in force.
  for (const editor of ["alice", "bob"] as const) {
    room = applyStudioAction(room, { type: "vote", editor, reviewId: room.review!.id, candidateId: candidate.id }, now);
  }
  room = applyStudioAction(room, { type: "register", requestId: "demo-baseline-receipt", policyVersion: room.published.version, label: "Example attendee, recorded starting policy", ...example.attendee }, now);
  const unsafeRepairId = `demo-unsafe-${room.id}`, correctedRepairId = `demo-corrected-${room.id}`;
  room = startStudioRepair(room, { baselineCandidateId: candidate.id, ...example.intent }, now, unsafeRepairId, { en: fixture.unsafeProposal.en, es: fixture.unsafeProposal.es });
  room = completeStudioRepair(room, unsafeRepairId, fixture.unsafeProposal, now);
  if (room.repair?.status !== "blocked") throw new RoomError("The saved unsafe example no longer produces its expected block.", "DEMO_INVALID", 500);
  room.fullDemo = { kind: `${example.id}-repair-v1`, exampleId: example.id, recordedAt: fixture.recordedAt, model: fixture.model, unsafeRepairId, correctedRepairId };
  room.modelCallCount = 0;
  room.review!.provenance = "fixture-replay";
  return room;
}

/** One explicit step, no provider request: revalidate the saved corrected output.
 * Repeated clicks are idempotent; changed drafts cannot reuse the recorded check. */
export function loadStudioDemoRepair(before: StudioRoom, repairId: string, now: string): StudioRoom {
  const demo = before.fullDemo, repair = before.repair;
  if (!demo || !["beacon-repair-v1", "harbor-repair-v1"].includes(demo.kind) || !demo.unsafeRepairId || !demo.correctedRepairId) throw new RoomError("Start a recorded repair example before loading its saved repair.", "DEMO_UNAVAILABLE", 409);
  const exampleId = demo.exampleId ?? (demo.kind === "harbor-repair-v1" ? "harbor" : "beacon");
  const fixture = STUDIO_EXAMPLE_FIXTURES[exampleId];
  if (!fixture.correctedProposal) throw new RoomError("This example has no recorded repair.", "DEMO_UNAVAILABLE", 409);
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
