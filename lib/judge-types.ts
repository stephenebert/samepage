import type { StudioAttendee, StudioEditor, StudioRoom } from './studio-types';

export type JudgeMode = 'live' | 'recorded';
export type JudgeAction =
  | { action: 'start'; mode: JudgeMode }
  | { action: 'reset'; mode: JudgeMode; roomId: string }
  | { action: 'analyze' | 'checkRewrite' | 'repair'; roomId: string }
  | { action: 'chooseBaseline'; editor: StudioEditor; roomId: string; reviewId: string }
  | { action: 'approve'; editor: StudioEditor; roomId: string; repairId: string }
  | { action: 'register'; attendee: StudioAttendee; label: string; roomId: string; policyVersion: number };
export interface JudgeResponse {
  room: StudioRoom | null;
  mode: JudgeMode | null;
  liveAvailable: boolean;
  budget: { sessionRemaining: number; globalRemaining: number };
  error?: string;
  code?: string;
}
export interface JudgeSession {
  ownerHash: string;
  roomId: string;
  mode: JudgeMode;
  calls: number;
  resets: number;
  createdAt: string;
  expiresAt: string;
}
export interface JudgeLedger {
  version: 1;
  revision: number;
  calls: number;
  sessions: Record<string, JudgeSession>;
}
export interface JudgeLimits { globalCalls: number; sessionCalls: number; sessions: number; resets: number; registrations: number }
export interface JudgeStorage {
  getLedger(): Promise<JudgeLedger>;
  getSession(ownerHash: string): Promise<JudgeSession | null>;
  open(ownerHash: string, mode: JudgeMode, reset: boolean, expectedRoomId?: string): Promise<JudgeSession>;
  getRoom(ownerHash: string, roomId: string): Promise<StudioRoom>;
  mutateRoom(ownerHash: string, roomId: string, update: (before: StudioRoom) => StudioRoom): Promise<StudioRoom>;
  reserveCall(ownerHash: string, roomId: string): Promise<void>;
}
