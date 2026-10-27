export type EditorId = "alice" | "bob";
export type PolicyLanguage = "en" | "es";
export interface PolicyRules {
  minAge: number | null;
  residentRequired: boolean;
  join: "all" | "any";
  deadline: string | null;
  deadlineInclusive: boolean;
}
export interface PolicyAttendee { age: number; resident: boolean; submittedAt: string }
export interface PolicyDecision {
  accepted: boolean;
  reasons: string[];
  checks: { age: boolean | null; residency: boolean | null; deadline: boolean | null; eligibility: boolean };
}
export interface PolicyDraft { editor: EditorId; language: PolicyLanguage; version: number; text: string }
export interface PublishedPolicy {
  version: number; en: string; es: string; rules: PolicyRules;
  publishedAt: string; reviewId: string | null; candidateId: string | null;
}
export interface PolicyReviewJob {
  id: string; basePolicyVersion: number; drafts: Record<EditorId, PolicyDraft>;
  prompt: string; createdAt: string;
}
export interface PolicyCandidate {
  id: string; editor: EditorId; sourceVersion: number;
  en: string; es: string; rules: PolicyRules | null; issues: string[];
}
export interface PolicyReview {
  id: string; basePolicyVersion: number; candidates: PolicyCandidate[];
  votes: Partial<Record<EditorId, string>>; status: "open" | "published";
  publishedVersion?: number; createdAt: string;
}
export interface PolicyRegistration extends PolicyAttendee {
  id: string; requestId: string; policyVersion: number; label: string;
  recordedAt: string; decision: PolicyDecision;
}
export interface AutomaticPolicyReview {
  requestId: string; jobId: string; provider: "Meta"; model: string;
  status: "running" | "completed" | "failed" | "superseded";
  startedAt: string; leaseExpiresAt: string;
  finishedAt?: string; durationMs?: number;
  error?: { code: string; message: string };
}
export interface ConsequencesRoom {
  kind: "samepage-consequences-v1";
  id: string; revision: number; createdAt: string; updatedAt: string;
  mode: "agent-manual-relay" | "automatic-model";
  published: PublishedPolicy;
  drafts: Record<EditorId, PolicyDraft>;
  activeJob: PolicyReviewJob | null;
  review: PolicyReview | null;
  registrations: PolicyRegistration[];
  automaticReview?: AutomaticPolicyReview | null;
}
export type ConsequencesAction =
  | { type: "draft"; editor: EditorId; baseVersion: number; text: string }
  | { type: "requestReview" }
  | { type: "completeReview"; response: unknown }
  | { type: "vote"; editor: EditorId; reviewId: string; candidateId: string }
  | { type: "register"; requestId: string; policyVersion: number; label: string; age: number; resident: boolean; submittedAt: string };
