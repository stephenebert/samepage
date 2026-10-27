export type StudioEditor = "alice" | "bob";
export type StudioLanguage = "en" | "es";
export type StudioFlag = "resident" | "student" | "member" | "guardianConsent" | "scholarship";
export type StudioCondition =
  | { op: "always" }
  | { op: "all" | "any"; args: StudioCondition[] }
  | { op: "not"; arg: StudioCondition }
  | { op: "age"; cmp: "gte" | "lte"; value: number }
  | { op: "flag"; field: StudioFlag; value: boolean }
  | { op: "time"; cmp: "lt" | "lte" | "gte" | "gt"; value: string };
export interface StudioRules {
  eligibility: StudioCondition;
  fee: { currency: "USD"; defaultCents: number; overrides: { when: StudioCondition; cents: number; label: string }[] };
}
export interface StudioAttendee {
  age: number; resident: boolean; student: boolean; member: boolean;
  guardianConsent: boolean; scholarship: boolean; submittedAt: string;
}
export interface StudioText { en: string; es: string }
export interface StudioTrace extends StudioText { path: string; passed: boolean }
export interface StudioDecision {
  accepted: boolean; feeCents: number | null; feeReason: StudioText;
  reasons: StudioText[]; trace: StudioTrace[];
}
export interface StudioWitness {
  id: "admission-left" | "admission-right" | "price-left-higher" | "price-right-higher";
  kind: "admission-left" | "admission-right" | "price-only";
  attendee: StudioAttendee; left: StudioDecision; right: StudioDecision;
  feeDeltaCents: number | null; explanation: StudioText;
}
export interface StudioDiscovery {
  status: "different" | "equivalent" | "unresolved";
  witnesses: StudioWitness[]; checkedCases: number; issues: string[];
  coverage: { ageValues: number; agePartitions: number; flagCombinations: number; timePartitions: number; scope: string };
}
export interface StudioDraft { editor: StudioEditor; language: StudioLanguage; version: number; text: string }
export interface StudioPublished {
  version: number; en: string; es: string; rules: StudioRules;
  publishedAt: string; reviewId: string | null; candidateId: string | null;
}
export interface StudioJob {
  id: string; basePolicyVersion: number; drafts: Record<StudioEditor, StudioDraft>;
  prompt: string; createdAt: string;
}
export interface StudioCandidate {
  id: string; editor: StudioEditor; sourceVersion: number;
  en: string; es: string; rules: StudioRules | null; issues: string[];
}
export interface StudioInterpretationCacheEntry {
  source: "meta"; model: string; protocol: "compact-v2"; reasoningEffort: "medium";
  interpreterVersion: string; sourceText: string; candidate: StudioCandidate;
}
export type StudioInterpretationCache = Partial<Record<StudioEditor, StudioInterpretationCacheEntry>>;
export interface StudioReview {
  id: string; basePolicyVersion: number; candidates: StudioCandidate[];
  votes: Partial<Record<StudioEditor, string>>; status: "open" | "published";
  discovery: StudioDiscovery; provenance: "manual-agent-review" | "fixture-replay" | "meta-model" | "simulated-model";
  publishedVersion?: number; createdAt: string;
}
export interface StudioRegistration extends StudioAttendee {
  id: string; requestId: string; policyVersion: number; label: string;
  recordedAt: string; decision: StudioDecision;
}
export interface AutomaticStudioReview {
  requestId: string; jobId: string; provider: "Meta"; model: string;
  protocol?: "compact-v2" | "full-v1" | "expression-v3";
  reasoningEffort?: "low" | "medium";
  requestedEditors?: StudioEditor[]; reusedEditors?: StudioEditor[];
  metrics?: {
    providerDurationMs: number; requestBytes: number; responseContentBytes: number;
    promptTokens: number | null; completionTokens: number | null; totalTokens: number | null;
    reasoningTokens: number | null; cachedInputTokens: number | null;
    maxCompletionTokens?: 8192 | 12288;
    finishReason?: "stop" | "length" | "content_filter" | "tool_calls" | "function_call" | null;
  };
  source: "meta" | "simulation";
  status: "running" | "completed" | "failed" | "superseded";
  startedAt: string; leaseExpiresAt: string; finishedAt?: string; durationMs?: number;
  error?: { code: string; message: string };
}
export interface StudioRoom {
  kind: "samepage-studio-v1"; id: string; revision: number; createdAt: string; updatedAt: string;
  mode: "manual-agent-review" | "automatic-model" | "simulated-model";
  automaticReview?: AutomaticStudioReview;
  modelCallCount?: number;
  interpretationCache?: StudioInterpretationCache;
  simulation?: "studio-fee-v1";
  published: StudioPublished; drafts: Record<StudioEditor, StudioDraft>;
  activeJob: StudioJob | null; review: StudioReview | null;
  registrations: StudioRegistration[];
}
export type StudioAction =
  | { type: "draft"; editor: StudioEditor; baseVersion: number; text: string }
  | { type: "requestReview" }
  | { type: "completeReview"; response: unknown }
  | { type: "vote"; editor: StudioEditor; reviewId: string; candidateId: string }
  | ({ type: "register"; requestId: string; policyVersion: number; label: string } & StudioAttendee);
export interface StudioDemoFixture {
  en: string; es: string;
  candidates: { editor: StudioEditor; en: string; es: string; rules: StudioRules | null; issues: string[] }[];
}
