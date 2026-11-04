import { realisticStudioWitness } from "../lib/studio-witness.ts";
import { studioDiscoveredRepairAttendee } from "../lib/studio-repair-presentation.ts";
import type { StudioRoom, StudioRepair, StudioWitness } from "../lib/studio-types";

export type JudgeStage = "compare" | "baseline" | "rewrite" | "blocked" | "approve" | "form" | "unresolved";
export function judgeStage(room: StudioRoom): JudgeStage {
  const repair = room.repair;
  if (repair?.status === "published") return "form";
  if (repair?.status === "ready") return "approve";
  if (repair?.status === "blocked") return repair.impact?.status === "blocked" ? "blocked" : "unresolved";
  if (repair?.status === "failed") return "unresolved";
  if (!room.review) return "compare";
  if (room.review.discovery.status === "unresolved") return "unresolved";
  return room.review.status === "published" ? "rewrite" : "baseline";
}
export function judgeInitialWitness(room: StudioRoom): StudioWitness | undefined {
  const review = room.review, witness = review?.discovery.witnesses[0];
  return review && witness ? realisticStudioWitness(review.candidates[0]?.rules ?? null, review.candidates[1]?.rules ?? null, witness) : undefined;
}
export function judgeBlockedRepair(room: StudioRoom): StudioRepair | undefined {
  return room.repair?.status === "blocked" ? room.repair : [...(room.repairHistory ?? [])].reverse().find(repair => repair.status === "blocked");
}
export function judgeRepairWitness(repair: StudioRepair | undefined): StudioWitness | undefined {
  const witness = repair?.impact?.verification.witnesses[0];
  return repair && witness ? realisticStudioWitness(repair.impact!.expectedRules, repair.proposal?.rules ?? null, witness) : undefined;
}
export function judgeFormAttendee(room: StudioRoom) {
  return studioDiscoveredRepairAttendee(room) ?? judgeRepairWitness(judgeBlockedRepair(room))?.attendee ?? judgeInitialWitness(room)?.attendee;
}
