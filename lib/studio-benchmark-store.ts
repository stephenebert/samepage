import { env } from "cloudflare:workers";
import { PolicyModelError } from "./policy-model";
import { BENCHMARK_LEDGER_ID, createBenchmarkLedger, validateBenchmarkLedger, type BenchmarkDataset, type BenchmarkLedger } from "./studio-benchmark";

function database(): D1Database {
  if (!env.DB) throw new PolicyModelError("STORAGE_UNAVAILABLE", "Benchmark storage is unavailable.", 503);
  return env.DB;
}
export async function getBenchmarkLedger(dataset: BenchmarkDataset): Promise<BenchmarkLedger | null> {
  const row = await database().prepare("SELECT state FROM samepage_rooms WHERE id = ?").bind(BENCHMARK_LEDGER_ID).first<{ state: string }>();
  if (!row) return null;
  const ledger = JSON.parse(row.state) as BenchmarkLedger;
  validateBenchmarkLedger(ledger, dataset); return ledger;
}
export async function mutateBenchmarkLedger(dataset: BenchmarkDataset, update: (before: BenchmarkLedger) => BenchmarkLedger): Promise<BenchmarkLedger> {
  const initial = createBenchmarkLedger(dataset, new Date().toISOString());
  await database().prepare("INSERT OR IGNORE INTO samepage_rooms (id, revision, state, updated_at) VALUES (?, ?, ?, ?)").bind(initial.id, initial.revision, JSON.stringify(initial), initial.updatedAt).run();
  for (let attempt = 0; attempt < 6; attempt++) {
    const before = await getBenchmarkLedger(dataset);
    if (!before) throw new PolicyModelError("BENCHMARK_STATE", "The benchmark ledger is missing.");
    const next = update(before);
    if (next === before) return before;
    validateBenchmarkLedger(next, dataset);
    if (next.revision !== before.revision + 1) throw new PolicyModelError("BENCHMARK_STATE", "Invalid benchmark revision.");
    const state = JSON.stringify(next);
    if (state.length > 900000) throw new PolicyModelError("BENCHMARK_LIMIT", "The benchmark evidence ledger has reached its size limit.", 429);
    const saved = await database().prepare("UPDATE samepage_rooms SET revision = ?, state = ?, updated_at = ? WHERE id = ? AND revision = ?").bind(next.revision, state, next.updatedAt, next.id, before.revision).run();
    if (saved.meta.changes === 1) return next;
  }
  throw new PolicyModelError("BENCHMARK_BUSY", "The benchmark ledger changed repeatedly; no additional provider request was authorized.", 409);
}
