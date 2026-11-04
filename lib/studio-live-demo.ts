import { applyStudioAction, createStudioRoom } from "./studio.ts";
import { getStudioExample } from "./studio-example-inputs.ts";
import type { StudioRoom } from "./studio-types.ts";

export { LIVE_DEMO_DRAFTS, LIVE_DEMO_UNSAFE_PROPOSAL, LIVE_DEMO_ATTENDEE } from "./studio-live-demo-inputs.ts";

/** Seed source text only: no recorded interpretations, approvals or receipts. */
export function createStudioLiveDemoRoom(id: string, now: string, exampleId: unknown = "beacon"): StudioRoom {
  const example = getStudioExample(exampleId);
  let room = createStudioRoom(id, now);
  room = applyStudioAction(room, { type: "draft", editor: "alice", baseVersion: 1, text: example.drafts.en }, now);
  room = applyStudioAction(room, { type: "draft", editor: "bob", baseVersion: 1, text: example.drafts.es }, now);
  room.liveDemo = { kind: `${example.id}-live-v1`, exampleId: example.id, maxCalls: example.maxCalls };
  room.modelCallCount = 0;
  return room;
}
