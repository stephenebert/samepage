# Fresh hosted SamePage evaluation runner

Prepared locally only. No network or provider request was made by the runner-preparation agent. The independent corpus is frozen; never edit it after a live result. Live execution awaits root/operator authorization and server readiness.

## Offline verification

From this directory:

```sh
/Users/steph/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node run-live.mjs --dry-run
/Users/steph/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node test-offline.mjs
```

The dry run has no network path. It checks exact corpus bytes and all three embedded canonical hashes, checks evaluator snapshots, validates the four stages, and writes `preflight.json`. The whole conservative estimate is **USD 0.20911025**, under the USD 1 limit. Each provider-shaped JSON body includes the actual wire prompt and schema; every UTF-8 byte is charged as an input token, plus 4096 framing tokens per request, and all 8192 maximum output tokens at USD 1.25/M input and USD 4.25/M output. This estimate is not measured billing.

The offline harness fabricates expected rules locally to exercise evaluator rejection, identity, provenance, model readiness, origin/header, vote, correction and receipt checks. Its report is explicitly offline and establishes no live model performance.

## Operator-only live invocation

Run this interactively after explicitly authorizing the four-request evaluation:

```sh
/Users/steph/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node run-live.mjs --live
```

The program requests hidden stdin JSON. Its shape is:

```json
{"ownSiteServiceBearer":"<short-lived own-site service bearer, NOT a Meta API key>","authorizeLive":true}
```

Paste the raw token without a `Bearer ` prefix. Do not put credentials in command arguments, environment variables, scripts, files, shell history, or evidence. Interactive TTY input is hidden; a trusted parent can also supply JSON directly over stdin without echoing it. The runner never reads Meta credentials.

Only the exact origin `https://samepage-language-lab.ampleboar17.chatgpt.site` is allowed. `OAI-Sites-Authorization` carries the ephemeral service bearer. `Origin` is set to that exact origin because the application requires it. Redirects are rejected. Allowed routes are room creation, room reads/actions, and the room review route. There is no direct Meta/provider request, provider key handling, search, or automatic retry in this runner.

## Run guarantees and evidence

- Four review POSTs globally at most, each body exactly `{}`, across three fresh rooms. Initial and correction share the first room. Alice and Bob save concurrent drafts; only frozen `providerInput.en/es` text is sent as drafts. Expected rules, cases and labels stay local.
- The server must report ready automatic Meta `muse-spark-1.3` before any review. A non-ready or unexpected model aborts the run.
- `live-ledger.json` consumes a review allowance **before** dispatch. A crash or timeout has unknown delivery status and is never retried. An existing ledger forbids a second invocation; a lock prevents concurrency. Inspect saved evidence manually after interruption; do not delete the ledger or resume automatically.
- Every structured candidate is parsed locally, bound to its exact source/version/ID, evaluated on frozen cases, and compared semantically with frozen expected rules over the deterministic engine domain. Hosted witnesses are recomputed. A wrong, unsupported or unknown result stops the entire run before approval.
- Valid executable results exercise one vote, split votes and matching votes, checking exact votes and publication identity. The correction rejects the old approval, publishes a new version, changes the targeted receipt from 1725 cents to zero, and preserves the original receipt.
- The ambiguity stage requires null rules and a fee-priority clarification, then asserts the ordinary vote API returns `UNRESOLVED` and leaves the complete state unchanged. That vote endpoint does not invoke the provider.
- `responses/` saves bounded raw **own-site API** responses. The API does not expose the raw Meta transport response or usage. `stages/` saves hydrated rules, locally reconstructed request estimates, scenario comparisons, witnesses and room states. `report.json` and `live-ledger.json` record dispatched review POST counts and honest failures.

A dispatched review POST is not proof that Meta received or billed a request. App `modelCallCount` is reported separately from unmeasured actual provider usage/cost. Full generated translation quality is not automatically scored. Local source hashes identify the evaluator snapshot, not a remote attestation of deployment.
