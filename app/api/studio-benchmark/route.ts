import { env } from "cloudflare:workers";
import frozenInputs from "@/lib/studio-benchmark-inputs.json";
import { BENCHMARK_CONFIG, BENCHMARK_RUN_ID, BENCHMARK_MAX_ATTEMPTS, BENCHMARK_MAX_NANO_USD, BENCHMARK_MAX_REQUEST_BYTES, BENCHMARK_FRAMING_TOKEN_RESERVE, parseBenchmarkDataset, prepareBenchmarkPlan, requireBenchmarkConfig, runBenchmarkAttempt } from "@/lib/studio-benchmark";
import { getBenchmarkLedger, mutateBenchmarkLedger } from "@/lib/studio-benchmark-store";
import { configuredStudioModel } from "@/lib/studio-model-env";
import { PolicyModelError } from "@/lib/policy-model";
import { errorResponse, json, readAction } from "@/lib/http";

export const dynamic = "force-dynamic";
const dataset = () => parseBenchmarkDataset(frozenInputs);
function gate() { return (env as unknown as { SAMEPAGE_BENCHMARK_ENABLED?: string }).SAMEPAGE_BENCHMARK_ENABLED; }
function error(error: unknown): Response {
  return error instanceof PolicyModelError ? json({ error: error.message, code: error.code }, error.status) : errorResponse(error);
}
// Read-only preflight/evidence stays available after the finite run is disabled.
export async function GET() {
  try {
    const data = await dataset(), config = configuredStudioModel();
    let configurationError: { code: string; message: string } | null = null;
    try { requireBenchmarkConfig(config, gate()); } catch (e) { configurationError = e instanceof PolicyModelError ? { code: e.code, message: e.message } : { code: "BENCHMARK_CONFIG", message: "Invalid configuration." }; }
    const plans = data.cases.flatMap(item => (["samepage", "plain-meta"] as const).map(arm => {
      const plan = prepareBenchmarkPlan(item, arm, { ...config, ...BENCHMARK_CONFIG }, "2026-10-27T00:00:00.000Z");
      return { caseId: item.id, arm, requestBytes: plan.requestBytes, conservativeEstimatedMaxUsd: plan.reservedNanoUsd / 1e9 };
    }));
    return json({ runId: BENCHMARK_RUN_ID, datasetHash: data.inputSha256, inputSha256: data.inputSha256, ready: configurationError === null, configurationError,
      config: BENCHMARK_CONFIG, ordinaryStudioEnabled: config.enabled, keyConfigured: Boolean(config.apiKey), maxAttempts: BENCHMARK_MAX_ATTEMPTS,
      maxEstimatedUsd: BENCHMARK_MAX_NANO_USD / 1e9, maxRequestBytes: BENCHMARK_MAX_REQUEST_BYTES, framingTokenReserve: BENCHMARK_FRAMING_TOKEN_RESERVE,
      ratesPerMillionTokens: { inputUsd: 1.25, outputUsd: 4.25 }, actualBilledCostUsd: null, plans,
      conservativeEstimatedMaxUsd: plans.reduce((sum, p) => sum + p.conservativeEstimatedMaxUsd, 0), ledger: await getBenchmarkLedger(data) });
  } catch (e) { return error(e); }
}
export async function POST(request: Request) {
  try {
    const data = await dataset(), action = await readAction(request);
    const { httpStatus, attempt, ledger, replayed } = await runBenchmarkAttempt(data, configuredStudioModel(), gate(), action, { mutate: update => mutateBenchmarkLedger(data, update) });
    return json({ runId: BENCHMARK_RUN_ID, caseId: attempt.caseId, arm: attempt.arm, slot: attempt, replayed, ledger }, httpStatus);
  } catch (e) { return error(e); }
}
