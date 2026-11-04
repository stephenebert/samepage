import data from './judge-recorded-data.json' with { type: 'json' };
import { RoomError } from './room.ts';
import type { StudioJob, StudioRepairJob, StudioRepairProposal } from './studio-types';

/** Retained successful Meta outputs from 2026-10-30. No provider request.
 * Only the matching synthetic Northstar inputs may use these results.
 * The engine discovers consequences and verifies repairs afresh each time.
 */
export const JUDGE_RECORDING = { recordedAt: data.recordedAt, model: data.model };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function recordedJudgeReview(job: StudioJob): unknown {
  if (job.drafts.alice.text !== data.drafts.alice || job.drafts.bob.text !== data.drafts.bob) {
    throw new RoomError('Saved results only support the unchanged Northstar example.', 'RECORDING_MISMATCH', 409);
  }
  return {
    jobId: job.id,
    candidates: data.candidates.map(candidate => ({ ...clone(candidate), sourceVersion: job.drafts[candidate.editor as 'alice' | 'bob'].version })),
  };
}
export function recordedJudgeRepair(job: StudioRepairJob): StudioRepairProposal {
  const baseline = data.candidates.find(candidate => candidate.editor === 'alice')!;
  if (job.intent.mode !== 'preserve-outcomes' || !same(job.baseline.rules, baseline.rules)) {
    throw new RoomError('Saved repair results do not match this agreed policy.', 'RECORDING_MISMATCH', 409);
  }
  if (job.proposalText && !same(job.proposalText, data.unsafeText)) {
    throw new RoomError('Saved results only support the example rewrite.', 'RECORDING_MISMATCH', 409);
  }
  return clone(job.proposalText ? data.unsafe : data.repair) as StudioRepairProposal;
}
