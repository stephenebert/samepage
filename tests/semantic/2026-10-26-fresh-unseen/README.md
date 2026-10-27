# Fresh unseen SamePage full-flow evaluation

This run evaluates the unchanged production source at `def141d7b93f12709db9b264d104584303ff4bf4` on one independently authored policy. The author did not read the application, existing cases or previous model results. Its policy, expected outcomes and independent executable oracle are frozen under `holdout/` before any live attempt.

The run has three Meta operations at most:

1. Interpret Alice's English and Bob's Spanish drafts, including their deliberate initial difference.
2. Interpret a supplied unsafe bilingual rewrite. The rewrite is an authored challenge, not a spontaneous Meta generation error. Check that the application blocks it and rejects both simulated approvals.
3. Generate a fresh fee-only repair, check it against the frozen source oracle and intent, then exercise one-vote hold, two-vote publication and versioned receipts.

The runner stops at the first semantic, transport, provenance or workflow failure. It never changes policies or prompts after a result, automatically retries, or resumes a started run. The application remains unmodified. A lock and request ledger are written before provider dispatch. Requests are limited to the selected owner-private SamePage origin. Root supplies its own-site service credential through hidden stdin; the model API key is never accessed by this runner.

The preflight reserves three requests of at most65,536 provider-JSON UTF-8 bytes plus4,096 framing tokens and8,192 output tokens each. Counting bytes as input tokens gives a conservative token-rate estimate of **$0.365568**, below the declared$0.40 ceiling. This is a local request/estimate bound, not an account-wide billing limit. Actual charges or credit deductions are not confirmed.

## Commands

Use the bundled Node runtime (or Node with TypeScript stripping). Root alone runs live mode.

```sh
node prepare-evidence.mjs
node run-unseen.mjs --dry-run
node run-unseen.mjs --live
node verify-evidence.mjs
```

Preparation requires the clean exact production commit and refuses if a live ledger or lock exists. It captures the application evaluator and prompt/schema code, hashes runner/preparation/verifier files, and records the holdout manifest. `--dry-run` performs no network operations. `--live` asks for a newline-terminated JSON object on hidden stdin with exactly `authorizeLive:true` and `ownSiteServiceBearer`. Never put credentials in shell arguments, environment files or chat.

The verifier is read-only and refuses network calls. It checks file hashes, reconstructs provider payloads from frozen production code, independently evaluates returned rules against all30 manual attendee cases and the exhaustive oracle, and replays completed state transitions. A stopped run remains stopped; it is not relabeled as a pass. The complete runtime responses and failed checks remain available for diagnosis. Provider bodies are reconstructed from actual job snapshots, not intercepted network payloads.

Structured rule agreement does not prove natural-language fidelity. A separate bilingual read-only audit should compare returned wording with the frozen source. Alice and Bob are simulated roles, and this is one fresh challenge rather than broad generalization evidence. The current model call generates and interprets both languages; this run does not add a separate target-blind model pass.
