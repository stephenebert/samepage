import { env } from "cloudflare:workers";
import { PolicyModelError } from "./policy-model";
import { INTERACTION_COMPARISON_ID, createInteractionComparisonLedger, validateInteractionComparisonLedger, type InteractionComparisonPlan, type InteractionComparisonLedger } from "./studio-interaction-comparison";

function database(): D1Database {
  if (!env.DB) throw new PolicyModelError("STORAGE_UNAVAILABLE", "Comparison storage is unavailable.", 503);
  return env.DB;
}
export async function getInteractionComparison(plan: InteractionComparisonPlan): Promise<InteractionComparisonLedger | null> {
  const row = await database().prepare("SELECT state FROM samepage_rooms WHERE id = ?").bind(INTERACTION_COMPARISON_ID).first<{ state: string }>();
  if (!row) return null;
  const ledger = JSON.parse(row.state) as InteractionComparisonLedger;
  validateInteractionComparisonLedger(ledger, plan); return ledger;
}
export async function mutateInteractionComparison(plan: InteractionComparisonPlan, update: (before: InteractionComparisonLedger) => InteractionComparisonLedger): Promise<InteractionComparisonLedger> {
  const initial = createInteractionComparisonLedger(plan, new Date().toISOString());
  await database().prepare("INSERT OR IGNORE INTO samepage_rooms (id, revision, state, updated_at) VALUES (?, ?, ?, ?)").bind(initial.id, initial.revision, JSON.stringify(initial), initial.updatedAt).run();
  for (let n = 0; n < 6; n++) {
    const before = await getInteractionComparison(plan);
    if (!before) throw new PolicyModelError("COMPARISON_STATE", "The comparison ledger is missing.");
    const next = update(before);
    if (next === before) return before;
    validateInteractionComparisonLedger(next, plan);
    if (next.revision !== before.revision + 1) throw new PolicyModelError("COMPARISON_STATE", "Invalid comparison revision.");
    const state = JSON.stringify(next);
    if (state.length > 100000) throw new PolicyModelError("COMPARISON_STATE", "Comparison evidence exceeds its supported size.");
    const saved = await database().prepare("UPDATE samepage_rooms SET revision = ?, state = ?, updated_at = ? WHERE id = ? AND revision = ?").bind(next.revision, state, next.updatedAt, next.id, before.revision).run();
    if (saved.meta.changes === 1) return next;
  }
  throw new PolicyModelError("COMPARISON_BUSY", "The comparison ledger changed repeatedly; no provider call was authorized.", 409);
}
