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
export interface ChangeProvenance {
  eventId: string; operation: "replace" | "delete"; sourceText: string;
  disposition: "applied" | "equivalent" | "combined" | "candidate" | "held";
  change: Bilingual;
}
export interface Decision {
  segmentId: string; eventIds: string[]; status: "apply" | "agree" | "merge" | "conflict" | "clarify";
  canonical: Bilingual | null; candidates: Candidate[]; provenance: ChangeProvenance[];
  explanation: Bilingual; witness: Witness | null; clarificationQuestion: Bilingual | null;
}
export interface DocumentIssue {
  kind: "contradiction" | "uncertainty"; segmentIds: string[];
  excerpts: Array<{ segmentId: string; language: Language; text: string }>;
  explanation: Bilingual; question: Bilingual;
}
export interface DocumentCheck {
  status: "clear" | "blocked" | "uncertain"; reviewedSegmentIds: string[]; issues: DocumentIssue[];
}
export interface ModelResult { jobId: string; decisions: Decision[]; documentCheck: DocumentCheck }
export interface Issue {
  id: string; kind: "conflict" | "clarify" | "document"; segmentId: string; baseVersion: number;
  eventIds: string[]; candidates: Candidate[]; explanation: Bilingual;
  witness: Witness | null; clarificationQuestion: Bilingual | null; documentIssues?: DocumentIssue[];
  votes: Partial<Record<ClientId, string>>; status: "open" | "resolved";
  resolutionStatus?: "queued" | "processing"; resolutionJobId?: string;
  createdAt: string; resolvedAt?: string; selectedEventId?: string;
}
export interface RelayJob {
  id: string; status: "processing" | "completed" | "abandoned"; eventIds: string[];
  // Optional fields keep legacy rooms readable; old jobs cannot be completed.
  protocolVersion?: 2; mode?: "edits" | "resolution";
  resolution?: { issueId: string; selectedEventId: string; candidate: Candidate };
  segments: Segment[]; proposals: Proposal[]; prompt: string;
  claimedAt: string; completedAt?: string; result?: ModelResult;
  queueMs: number; processingMs?: number; note?: string;
}
export interface Activity { id: string; at: string; kind: string; text: string }
export interface Room {
  id: string; title: string; revision: number; createdAt: string; updatedAt: string;
  segments: Segment[]; presence: Partial<Record<ClientId, Presence>>;
  proposals: Proposal[]; jobs: RelayJob[]; activeJobId: string | null;
  issues: Issue[]; activity: Activity[]; mode: "agent-manual-relay" | "fable-manual-relay";
}
export type RoomAction =
  | { type: "presence"; clientId: ClientId; editingSegmentId: string | null }
  | { type: "propose"; id: string; clientId: ClientId; segmentId: string; baseVersion: number; text: string; supersedesIssueId?: string }
  | { type: "vote"; clientId: ClientId; issueId: string; candidateEventId: string }
  | { type: "cancel"; clientId: ClientId; proposalId: string };
export type RelayAction = { type: "claim" } | { type: "complete"; jobId: string; response: string } | { type: "abandon"; jobId: string };
export interface RoomResponse { room: Room }
export interface RelayResponse extends RoomResponse { job: RelayJob | null }

// Empty proposal text is an explicit whole-section deletion. Keep the section ID.
// Every job snapshots ALL section content/versions, independently of presence.
// Matching votes queue a fresh consistency check; they never directly commit.
// The private Site simulates two personas; clientId is not an authentication identity.
