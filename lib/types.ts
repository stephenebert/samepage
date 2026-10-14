export type ClientId = "alice" | "bob";
export type Language = "en" | "es";
export interface Bilingual { en: string; es: string }
export interface Segment extends Bilingual { id: string; label: Bilingual; version: number }
export interface Presence { clientId: ClientId; seenAt: string; editingSegmentId: string | null }
export interface Proposal {
  id: string; clientId: ClientId; language: Language; segmentId: string;
  baseVersion: number; text: string; createdAt: string;
  status: "pending" | "processing" | "applied" | "conflict" | "clarify" | "stale" | "cancelled";
  jobId?: string; note?: string;
}
export interface Candidate extends Bilingual { eventId: string }
export interface Witness { question: Bilingual; answers: Record<string, Bilingual> }
export interface Decision {
  segmentId: string; eventIds: string[]; status: "apply" | "agree" | "conflict" | "clarify";
  canonical: Bilingual | null; candidates: Candidate[];
  explanation: Bilingual; witness: Witness | null; clarificationQuestion: Bilingual | null;
}
export interface ModelResult { jobId: string; decisions: Decision[] }
export interface Issue {
  id: string; kind: "conflict" | "clarify"; segmentId: string; baseVersion: number;
  eventIds: string[]; candidates: Candidate[]; explanation: Bilingual;
  witness: Witness | null; clarificationQuestion: Bilingual | null;
  votes: Partial<Record<ClientId, string>>; status: "open" | "resolved";
  createdAt: string; resolvedAt?: string; selectedEventId?: string;
}
export interface RelayJob {
  id: string; status: "processing" | "completed"; eventIds: string[];
  segments: Segment[]; proposals: Proposal[]; prompt: string;
  claimedAt: string; completedAt?: string; result?: ModelResult;
  // Queue time is measured from the first proposal; processing includes manual relay.
  queueMs: number; processingMs?: number;
}
export interface Activity { id: string; at: string; kind: string; text: string }
export interface Room {
  id: string; title: string; revision: number; createdAt: string; updatedAt: string;
  segments: Segment[]; presence: Partial<Record<ClientId, Presence>>;
  proposals: Proposal[]; jobs: RelayJob[]; activeJobId: string | null;
  issues: Issue[]; activity: Activity[];
  mode: "fable-manual-relay";
}
export type RoomAction =
  | { type: "presence"; clientId: ClientId; editingSegmentId: string | null }
  | { type: "propose"; id: string; clientId: ClientId; segmentId: string; baseVersion: number; text: string; supersedesIssueId?: string }
  | { type: "vote"; clientId: ClientId; issueId: string; candidateEventId: string }
  | { type: "cancel"; clientId: ClientId; proposalId: string };
export type RelayAction = { type: "claim" } | { type: "complete"; jobId: string; response: string };
export interface RoomResponse { room: Room }
export interface RelayResponse extends RoomResponse { job: RelayJob | null }

// POST /api/rooms {} => RoomResponse
// GET /api/rooms/:id => RoomResponse
// POST /api/rooms/:id RoomAction => RoomResponse
// POST /api/rooms/:id/relay RelayAction => RelayResponse
// Errors: { error: string, code: string }, HTTP 400/404/409/413/429.
// Each client must save the displayed SEGMENT version when its draft starts.
// The private Site simulates two personas; clientId is not an authentication identity.
