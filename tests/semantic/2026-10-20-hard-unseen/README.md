# Frozen hard unseen-policy evaluation

See [the evaluation report](../../../docs/HARD-UNSEEN-EVALUATION.md) for scope, counts and limitations.

- `corpus/`: independently authored policies, expected rules/scenarios, and pre-interpretation hashes.
- `run/`: production prompts, first untouched interpreter responses, authoritative room snapshots, manual endpoint logs, browser evidence, and independent semantic audit.
- `original-driver.mjs`: the coordinator's original machine-specific driver, retained for provenance. Its absolute corpus/output paths refer to the original evaluation workspace; it is not a portable command to rerun in this archive. It refuses to overwrite an existing preparation/application. The final driver includes the later read-only browser snapshot phase and replaces the early console label `providerCalls:0` with the count of automatic-review endpoints requested. Neither label is provider telemetry.

No credentials are included. Keep all frozen inputs and first responses unchanged. A new evaluation must use a new output directory and newly prepared review jobs; do not replay an old response and call it a new semantic test. Browser replay of the exact same complementary-routes prompt is explicitly distinguished from its later fresh review.

The suite made 54 manual application requests, not provider requests. Browser operations used the manual fallback too. No Meta/provider API key was configured or used during this work. Codex agents authored, interpreted and audited the test; these are not independent human participants or live Meta measurements.
