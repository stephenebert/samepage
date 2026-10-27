# Hosted Meta evaluation — 26 October 2026

Four fresh hosted studio reviews using Meta `muse-spark-1.3` passed the frozen evaluation. The run checked three synthetic bilingual policy pairs, including one correction of the first pair. All **120 concrete candidate/outcome checks** and **four unresolved-result checks** matched expectations. Studio live calls were disabled again after the evaluation, and the deployed browser showed **Meta calls paused**.

This closes the earlier studio integration's no-live-call verification gap for these four reviews. It does not establish general bilingual reliability, independent human usability, or measured billing cost. Earlier manual-relay and simulated-response results remain separate historical evidence.

## Inputs and observed results

An independent agent authored and froze source policies, expected rules and expected outcomes before the live run. A second audit checked those expectations. Only the English and Spanish source policies were sent through the production prompt; expected rules and scenarios stayed local. The corpus SHA-256 is `4202af1610de58a958241c187200f5c740e95b9b70d8868c3eb6fbd0b5d75ecb`.

| Stage | Expected and observed result | Concrete checks | Own-site review HTTP duration |
| --- | --- | ---: | ---: |
| Cyanotype workshop, initial | Scholarship/member fee priority differs; both admit the witness, but Alice charges $17.25 and Bob $0 | 38 | 20.083 s |
| Same workshop, correction | New source drafts give scholarship priority; interpretations are equivalent | 38 | 16.201 s |
| Stop-motion workshop | Nested nonresident/student scholarship exception and exact deadline inclusivity create opposite admission witnesses | 44 | 23.752 s |
| Paper-sculpture workshop | Overlapping fixed fees lack a priority; both candidates return null rules and targeted clarification | Four unresolved checks | 12.705 s |

There were **four review POSTs**, four successful HTTP responses, and four observed application model attempts, with no retry. Thirty-four total requests to the owned site also saved drafts, read state, exercised votes and recorded synthetic registrations; those were not 34 model calls. The two drafts were saved concurrently in each stage. The initial and correction stages reused one room; the other pairs used fresh rooms.

The deterministic engine recomputed the returned candidates, all expected witness categories and the initial $17.25 maximum price difference. An independent AI auditor then checked all eight exact original sources and eight translations, reproduced the 120 concrete decisions, and performed **185,856 independent rule comparisons** across all integer ages 0–120, all 32 flag combinations and representative time regions. Six executable candidates matched the frozen rules; both ambiguous candidates correctly remained blocked. The full bilingual prose review found no substantive mistranslation. These are checks of four saved live outputs, not additional provider samples.

## Approval, correction and receipts

Each of the three executable stages held publication after one vote and after two split votes. Two votes for the same candidate published exactly one new policy version, with the expected review ID, candidate ID and rules.

In the correction stage, saving fresh drafts removed the old review and its approvals. A deliberate attempt to reuse the old vote returned `STALE_REVIEW`. New joint approval published version 3. The same synthetic attendee was charged **$17.25 under version 2 and $0 under version 3**; the original receipt remained unchanged. Separate Alice and Bob browser views were inspected after the run and displayed version 3 and the preserved receipts.

For the ambiguous pair, the ordinary vote API returned `UNRESOLVED`; the entire saved state, empty votes and original publication remained unchanged. That vote route does not request a model review.

The correction was supplied as new editor drafts. This run did not test automatic generation of a repair proposal.

## Timing, cost and shutdown

The recorded client-visible own-site review requests took **12.705–23.752 seconds**. The application's internal review durations were 12.448–23.556 seconds. Both include application processing around the provider request; neither is an isolated provider latency measurement or a service-level guarantee.

The four-request conservative cost estimate was **$0.20911025**, below the authorized $1 ceiling. The estimate charged each UTF-8 byte in the complete adapter-shaped prompt/schema JSON as an input token, added 4,096 framing tokens per request, and charged the maximum 8,192 output tokens per request at $1.25/M input and $4.25/M output. No search or tool usage was requested. **Actual token usage and billed cost were not measured.**

The account initially showed **$150 in credits and a $0 outstanding balance**. A later billing refresh remained on “Loading billing,” so no post-run balance or exact charge is claimed. The saved deployment receipt records studio enablement at environment revision 3 and successful disabling at revision 4, followed by browser confirmation that Meta calls were paused. The server key stayed a secret and is absent from this archive. The `SAMEPAGE_STUDIO_META_ENABLED` switch pauses Studio reviews only. The legacy `/consequences` route shares `MODEL_API_KEY` and does not use that switch; no requests were made through that route in this evaluation.

## Evidence and offline reproduction

The [preserved evidence directory](../tests/semantic/2026-10-26-meta-live/) contains:

- The frozen corpus, its independent audit and canonical hashes; the unchanged runner and exact local evaluator source snapshots.
- The durable four-request ledger, bounded own-site API requests/responses, structured candidates, scenario comparisons, discovered witnesses and room states.
- The [live report](../tests/semantic/2026-10-26-meta-live/report.json), [independent semantic audit](../tests/semantic/2026-10-26-meta-live/live-semantic-audit.json), [activation/shutdown record](../tests/semantic/2026-10-26-meta-live/activation-and-shutdown.json), and file-integrity manifest.

From the repository root, verify the archive and recompute quality checks without writing files or contacting any service:

```sh
node tests/semantic/2026-10-26-meta-live/verify-evidence.mjs
```

The archived `run-live.mjs` is the exact runner used. Its existing completed ledger prevents another live invocation. Do not remove the ledger or repurpose this frozen archive for another run. The offline preflight and fabricated-oracle harness are retained as engineering evidence and are clearly labeled; they are not substitutes for the live outputs.

The response artifacts preserve the hosted application's HTTP bodies containing parsed Meta candidates. They do not contain raw Meta response envelopes, usage telemetry, authorization headers or API credentials. Source snapshot hashes identify the local evaluator; they are not a remote attestation of deployed source. An English generated fee label can still appear inside a Spanish receipt-reason prefix, a presentation issue separate from the policy translations reviewed here.

Alice and Bob were simulated editor roles operated by one facilitator. The site remains owner-private and does not yet provide independent editor authentication or room membership. This small held-out sample supports the demonstrated behavior only.
