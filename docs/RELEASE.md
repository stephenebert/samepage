# Live workspace release

## Provenance

This commit preserves the repository's existing history through `62a3344` (October 27, 2026) and updates its default application to the live workspace source checkpoint `aa1865f` (November 3, 2026). Earlier document collaboration, policy-engine development, fee-change experiments, evaluations, and their original records remain available in Git history. Their old submission bundles are not the current release.

The isolated public workspace and request ledger were introduced October 30. November 3 added editable bilingual drafts, separate reviewer capabilities, invitation revocation, owner-operated registration, and the current interface. Policy interpretation and counterexample checking build on the earlier prototype; this is not a claim that all code was first written during the hackathon.

The public source release keeps the live application, model adapter, engine, and tests unchanged. Portability changes are limited to a generic `wrangler.json`, omission of private Sites hosting configuration, skipping deployment-manifest copying when that configuration is absent, environment placeholders, test/setup scripts, and documentation. The dependency lockfile is retained unchanged.

## Current demonstration

The demonstrated community workshop is free. The first English/Spanish disagreement affects a 20-year-old resident who is not a student. An unsafe rewrite then excludes that resident when they are a member. Publication is blocked. Meta proposes a repair, the outcome check passes within the supported rule model, the first approval keeps version 1 active, and the second approval publishes version 2. Member and nonmember checks remain eligible, and the saved receipt names version 2.

The final video contains three real Meta requests and two simulated reviewer roles. Waiting and navigation are shortened in the recording. No additional inference was run to prepare this source release. The human narration is preserved; the recording is not a claim of unedited wall-clock latency.

Historical comparisons did not establish an accuracy advantage over plain Meta review. Earlier large rule-comparison counts and mechanical-test totals belong to their recorded source checkpoints; they are not presented as the test count for this release.

## Release verification

- Current source test suite: 27 passed, 0 failed; network provider calls blocked by the test harness.
- TypeScript check: passed.
- Production build: passed.
- Generic local D1 migration: verified against a new local database.
- Production preview: root and workspace API returned HTTP 200; a blank local workspace persisted with version 0, nothing published, and live inference disabled.

A successful build or simulated model test does not validate fresh model interpretation. Separate live evidence and the demonstration cover the observed live flow, within the limitations above.

The source includes no hosted D1 data, API keys, owner cookies, reviewer capability values, or `.openai` deployment identity. The vendored Sites build plugin retains its upstream license in `build/sites-vite-plugin.LICENSE`.
