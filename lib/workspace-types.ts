import type { StudioAttendee, StudioEditor, StudioRoom, StudioText } from './studio-types';
import type { JudgeStorage } from './judge-types';

export type WorkspaceActor = 'owner' | StudioEditor;
export interface WorkspaceMetadata {
  kind: 'samepage-workspace-v1';
  title: string;
  reviewerHashes?: Partial<Record<StudioEditor, string>>;
}
export type WorkspaceRoom = StudioRoom & { workspace: WorkspaceMetadata };
export interface WorkspaceAccess { ownerHash: string; actor: WorkspaceActor; roomId?: string; reviewerHash?: string }
export type WorkspaceAction =
  | { action: 'create'; title: string; drafts: StudioText; roomId?: string; revision?: number }
  | { action: 'saveDrafts'; roomId: string; revision: number; title: string; drafts: StudioText }
  | { action: 'analyze' | 'repair'; roomId: string; revision: number; retry?: boolean }
  | { action: 'checkRewrite'; roomId: string; revision: number; proposalText: StudioText; retry?: boolean }
  | { action: 'invite'; roomId: string; revision: number; editor: StudioEditor }
  | { action: 'approveBaseline'; roomId: string; reviewId: string; candidateId: string }
  | { action: 'approveRepair'; roomId: string; repairId: string }
  | { action: 'register'; roomId: string; policyVersion: number; attendee: StudioAttendee; label: string };
export interface WorkspaceResponse {
  room: WorkspaceRoom | null;
  actor: WorkspaceActor;
  hasPublished: boolean;
  liveAvailable: boolean;
  budget: { sessionRemaining: number; globalRemaining: number };
  invitation?: { editor: StudioEditor; token: string; roomId: string };
  error?: string;
  code?: string;
}
export interface WorkspaceStorage extends JudgeStorage {
  openWorkspace(ownerHash: string, title: string, drafts: StudioText, expectedRoomId?: string, expectedRevision?: number): Promise<void>;
  resolveReviewer(roomId: string, token: string): Promise<WorkspaceAccess>;
}
