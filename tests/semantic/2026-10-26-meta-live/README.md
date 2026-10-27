# Archived four-request hosted Meta evaluation

See [the evaluation narrative](../../../docs/META-LIVE-EVALUATION.md) for results and limits. All four live reviews passed; Studio live calls were paused after the run. This is a frozen archive, not a new live-evaluation workspace.

Run `node tests/semantic/2026-10-26-meta-live/verify-evidence.mjs` from the repository root to verify file hashes and recompute the saved live-output checks offline. The verifier does not write files or contact services.

The unchanged live runner's completed ledger prevents another invocation. `RUNNER.md` and source snapshot metadata retain the original local workspace paths for provenance; the verifier uses only relative archive files. Credentials, authorization-header values, personal documents, runtime databases and provider billing records are absent. Request/response artifacts contain synthetic test policies and own-site API data. Raw Meta transport envelopes and usage were not exposed by the app.

The corpus/runner/evaluator and original evidence files are copied byte-for-byte. `evidence-manifest.json` lists archive hashes and sizes; it excludes itself. The preflight and offline harness are retained as separately labeled engineering checks. They are not counted as live model samples.
