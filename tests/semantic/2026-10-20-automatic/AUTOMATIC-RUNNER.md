# Automatic model evaluation: UNRUN pending Meta access

The six-pair frozen corpus has not been sent to a live Meta model. No live-model accuracy or latency result exists for this corpus. The runner is prepared for use after the server has a working `MODEL_API_KEY`; current validation is limited to JavaScript syntax and the missing-key guard.

Run with Node that supports TypeScript type stripping. Set an explicit, fresh absolute output directory outside the corpus and source checkout. The runner refuses existing directories and never resumes or overwrites an earlier run. The default target is `http://127.0.0.1:5173`.

```sh
SAMEPAGE_EVAL_RUN_DIR=/tmp/samepage-automatic-run-001 \
node --experimental-strip-types tests/semantic/2026-10-20-automatic/run-automatic-evaluation.mjs --run < /dev/null
```

For a private deployed Site, set `SAMEPAGE_TEST_URL` to its HTTPS origin and supply optional stdin JSON with one field, `siteAuthorization`, containing the raw Site service token. Supply it through a trusted in-memory launcher or hidden stdin entry; never put it in shell arguments, a tracked file, or console output. This is a Site access token, not the Meta provider API key. The Meta key belongs only in server-side Site secret settings. The runner keeps the token in memory, does not log request headers, redacts its exact value from saved text, and refuses redirects. No token is required for a local development server.

The runner first verifies the corpus hashes and checks `GET /api/consequences/model`. If `model.ready` is not true, it exits with code 2 before creating rooms, review jobs, or the output directory. Readiness only indicates configuration presence; successful inference still has to be tested.

When configured, one run can make **up to six paid model requests**, one per pair. For each pair it saves both fresh drafts into a new room, prepares the exact immutable job prompt through `requestReview`, and calls `POST /api/consequences/:id/review` once. It never uses manual `completeReview`, never substitutes expected answers, never sends a direct provider request, and never automatically retries. It stops at the first failure; remaining pairs are marked not run. Restarting requires a fresh directory and constitutes a new run with new possible charges.

The comparison oracle is implemented independently of the production policy evaluator. It compares compiled and expected meanings over all integer ages 0–120, both residency values, and every time region induced by either policy's deadline. It checks all frozen attendee outcomes, possible disagreement directions, and each discovered counterexample. Production counterexample discovery is imported only as the component under test. The repository copy imports `../../../lib/counterexamples.ts` relative to this runner. Run the command above from the repository root. The archived syntax/guard check used the original adjacent-checkout import; the repository copy changes only that import location.

For supported pairs, the runner simulates Alice and Bob through actual HTTP actions: one vote cannot publish; conflicting votes cannot publish; matching votes publish exactly one new version. Registration receipts before agreement follow the previous policy, and receipts after agreement are checked against the approved policy with the independent oracle. Every unresolved pair remains unpublished; attempts to approve its null candidate must return `UNRESOLVED` without recording a vote. The fake instruction in the volunteer-case footer must not manufacture a supported policy or approvals.

Evidence includes frozen hashes, the runner hash, public model configuration, exact prepared prompts, application-parsed candidates, automatic-request status and metadata, round-trip duration, deterministic discovery duration, joint-approval checks, and actual saved registration receipts. The application does not expose the raw provider body, so **the saved candidate evidence is not a raw Meta response**. Round-trip timing includes the app request; discovery timing is local deterministic code. Neither is a token-throughput measurement.

Exit status is 0 only for help/no-run mode or a passing live run, 2 for the unconfigured preflight, and 1 for failure. Use the `results.json` status to distinguish a completed evaluation from an incomplete one. Synthetic corpus success would remain narrow evidence; translation quality and real-user usefulness still need separate review.
