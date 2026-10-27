"""Offline aggregation only. Does not call a model or alter frozen inputs."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(path):
    return json.loads((ROOT / path).read_text())

def write(path, value):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")

plan = read("suite-plan.json")
assert hashlib.sha256((ROOT / "suite-plan.json").read_bytes()).hexdigest() == read("suite-plan.freeze.json")["sha256"]
for path, expected in plan["files"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, path

activation = read("activation-and-shutdown.json")
activation["shutdown"] = read("shutdown-confirmation.json")
write("activation-and-shutdown.json", activation)
write("ambiguity/not-run.json", {
    "caseId": "ambiguous-b-unspecified-student-fee",
    "status": "not-run",
    "modelRequests": 0,
    "reason": "Stopped after independent post-live review found B-ES-AGE-SCOPE. The two full synthetic flows had already published before this prose finding arrived. No result is claimed for the remaining clarification test."
})

verifications = [read(f"case-{c}/evidence-verification-result.json") for c in "ab"]
reports = [read(f"case-{c}/report.json") for c in "ab"]
totals = {key: sum(v[key] for v in verifications) for key in [
    "modelRequests", "passedStages", "failedStages", "naturalStops", "concreteChecks",
    "concreteFailures", "independentOracleChecks", "independentOracleMismatches",
    "blockedAuthoredRepairs", "publishedGeneratedRepairs", "receipts", "promptTokens", "completionTokens"
]}
stages = [{"case": c, "stage": s["stage"], "httpDurationMs": s["httpDurationMs"], **s["metrics"]}
          for c, report in zip("ab", reports) for s in report["stages"]]
write("suite-summary.json", {
    "status": "findings-present",
    "sourceCommit": plan["sourceCommit"], "siteVersion": plan["siteVersion"],
    "model": plan["model"], "protocol": plan["protocol"],
    "frozenCoreFilesVerified": len(plan["files"]),
    "applicationChanged": False, "automaticRetries": 0, "exampleTuningAfterFreeze": False,
    "totals": totals, "stages": stages,
    "uncachedTokenRateEstimateUsd": round(sum(v["uncachedTokenRateEstimateUsd"] for v in verifications), 8),
    "actualBilledCostUsd": None, "pricingSource": plan["pricingSource"],
    "preRunCreditObservation": "billing-observation.json",
    "cases": [{"directory": f"case-{c}", **report["case"],
               "statusScope": "Compiled-rule workflow only; see separate bilingual review",
               "bilingualReview": "passed" if c == "a" else "scope-ambiguity",
               "url": "https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=" + report["case"]["roomId"] + "#studio-repair"}
              for c, report in zip("ab", reports)],
    "finding": {
        "id": "B-ES-AGE-SCOPE", "status": "open",
        "description": "Generated Spanish baseline and repair make the age-18 restriction ambiguous across alternatives; executable rules remain correct.",
        "witness": "B18: 17-year-old nonresident student/member, consent=true, scholarship=false; intended and executable result reject, plausible loose prose reading could admit at 3600 cents.",
        "discoveredBy": "Two independent AI reviewers after live synthetic publication, not SamePage's runtime checker or human reviewers.",
        "mitigation": "The AST-derived reading view explicitly groups alternatives, but original generated prose remains in stored/published fields.",
        "audit": "audit/post-live-bilingual.md"
    },
    "remainingClarificationTest": read("ambiguity/not-run.json"),
    "shutdown": read("shutdown-confirmation.json"),
    "limits": [
        "Two synthetic policies and simulated editor roles, not real-user or broad reliability measurement.",
        "Unsafe rewrites were authored challenges, not spontaneous model mistakes.",
        "Generated repairs received server-derived target rules; this was guided repair, not blind prose-only generation.",
        "Oracle checks cover these compiled rule sets, not faithful interpretation of all natural-language policies.",
        "Same model generates wording and its rule interpretation; separate prose audit found a gap despite rule agreement.",
        "Token-rate estimate is not a confirmed credit deduction. Studio paused, existing API key retained."
    ]
})
print(json.dumps({"status": "aggregated-with-finding", "frozenFiles": len(plan["files"]), **totals}))
