# Compact interpretation and demo flow — 26 October 2026

The Studio now asks Meta to generate only each policy's translation, executable rules and clarification issues. The server restores the immutable English and Spanish originals and draft versions from the claimed review snapshot. This avoids regenerating source text without removing either translation or either independent interpretation. Compact output alone did not reduce latency in the matched run below.

The default protocol is `compact-v2`; `SAMEPAGE_STUDIO_PROTOCOL=full-v1` retains the previous prompt and response contract for an explicitly authorized comparison. Both use `muse-spark-1.3`, medium reasoning, strict structured output and the same 8,192-token completion budget. The compact prompt keeps the complete-rule requirement, fee-priority and ambiguity rules, nested exception checks, exact UTC boundaries and supported-domain limits.

An opt-in experimental path can reuse exactly one unchanged interpretation from the same room and ask Meta to interpret only the changed editor's full policy. Reuse requires byte-identical source text, the same model, compact protocol, medium reasoning, the same interpreter revision, and a previous completed real Meta candidate with executable rules and no clarification issues. Cached sources and rule graphs are validated again, and cached draft versions are rebased only after exact source equality. A cache has at most one candidate per editor. If neither or both candidates qualify, the normal two-candidate request is used. There is no cross-room cache.

`SAMEPAGE_STUDIO_REUSE_UNCHANGED=true` explicitly enables experimental reuse; it is disabled by default and on the hosted site after the failed live experiment. `SAMEPAGE_STUDIO_REASONING_EFFORT=low` is retained only as an explicit experimental setting; medium is the default. The lower-effort experiment failed accuracy checks and was not selected for the final deployment.

Job identity, unique editors, complete translations, bounded rule graphs and clarification consistency are still validated. The existing durable lease and snapshot checks reject obsolete results. A response cannot approve itself; two matching editor votes are still required before the working form changes. One vote, split votes and unresolved interpretations all hold publication. Previously recorded rooms and receipts remain compatible.

## Demo changes

- A visible elapsed timer starts with the review and uses its recorded start time. The waiting state explains what is happening and keeps the current form version visible; it does not invent a completion percentage or claim intermediate model stages have finished.
- Consequence cards emphasize the same synthetic person and the concrete admission or price difference. Approval choices show those consequences while keeping the full bilingual interpretations available to inspect.
- Approval status makes the one-vote and disagreement holds explicit. Receipt evidence highlights a before/after change only when the complete attendee facts match across policy versions.
- Saved receipt facts can be loaded back into the form without submitting or requesting another model review.
- A current real review explicitly identifies the unchanged editor whose interpretation was reused and the edited policy being reviewed by Meta. This is shown only for a matching active or completed job; simulations retain their own labels.

The root browser check exercised one vote, split votes, matching votes and a saved registration with the controlled offline fixture. A live pending review was inspected with an elapsed timer and the original published version still in force. These are simulated editor roles, not separate authenticated users or a human usability study.

## Measurement boundary

Each automatic review now retains bounded numeric provider counters when Meta supplies a readable response envelope, including incomplete/refused responses: prompt, completion, total, reasoning and cached-input tokens. It also records the serialized request size, available generated content size, provider HTTP duration and a fixed finish-reason enum. This diagnostic extension was added after the final failed request, whose usage and exact finish reason remain unavailable. Unknown usage fields, credentials, headers, provider payloads and reasoning text are not retained. Missing counters remain null. Client-visible review duration includes the application's processing as well as the provider request; neither duration is a service-level guarantee.

The first test run compared two matched policy pairs through the old and compact contracts, then evaluated fresh held-out policies and a correction. After the unchanged effort did not improve speed, a separately frozen low-effort run stopped after its second request failed quality checks. A final two-request test evaluates the unchanged-editor reuse path at medium effort. These phases share a bounded credit-funded evaluation budget; there are no automatic retries. Actual billing requires the account's billing record; token-based estimates are not a charge receipt.

## Engineering validation

All 122 mechanical tests and TypeScript checking passed for the final source, privately deployed as Sites commit `772d63dca16bce7b5379cbfd4af4a7c02e863d90` after a successful production build. New checks cover identical hydrated interpretations under both contracts, rejection of stale jobs, duplicate editors and extra immutable-source fields, invalid translations, bounded numeric telemetry, and exact-source reuse. Reuse checks include changed Bob versus changed Alice, invalid or incompatible cache entries, source-version rebasing, stale results, unchanged receipt history and two-editor approval. The live runs are separate from these injected-response tests.

## Live result

The medium-effort run completed all eight requests successfully: 282 concrete candidate/outcome checks and eight unresolved-result checks passed. That establishes only this sample's accuracy, not arbitrary-policy reliability.

| Matched policy | Previous full response | Compact response | Result |
| --- | ---: | ---: | --- |
| Fee-priority pair | 15.124 s | 15.826 s | Compact was slower in this sample |
| Nested exception and UTC boundary | 22.360 s | 24.110 s | Compact was slower in this sample |

Generated content shrank from 6,164 to 4,133 bytes and from 6,574 to 4,214 bytes, but reasoning tokens rose from 4,186 to 4,554 and from 5,872 to 6,900. The two matched pairs were run sequentially rather than randomized or repeated; they do not establish a causal effect or a latency distribution.

The low-effort run reduced the first held-out request from 16.449 to 10.239 seconds and passed that case. Its second request took 13.165 seconds but lost the mosaic policy's age and guardian-consent restrictions in both interpretations. Eight concrete checks failed. The evaluation stopped without approving or publishing that review; the two remaining low-effort requests were not run. Faster incorrect interpretations were rejected.

The final medium-effort reuse experiment made two requests. The initial two-editor Mosaic review passed all 42 concrete checks in 18.271 seconds. Alice's correction then requested only Alice's interpretation and reused Bob's unchanged candidate, but returned HTTP 502 (`MODEL_RESPONSE_INVALID`) after 25.792 seconds. No completed candidate was available to evaluate, and the exact finish reason and usage were not captured by that version. The app rejected it; the prior published version and original $16 receipt remained unchanged. The correction was not approved, published or retried. This run does not establish a speedup or the live semantic quality of the reuse path.

Across all phases there were 12 review requests, 11 structured reviews and one incomplete-response failure. Of 400 concrete checks, 392 passed and eight failed; all eight unresolved-result checks passed. These counts include repeated policies. Independent AI review inspected all 22 available translations; the low-effort failure was in executable rules despite faithful prose. This is not a human bilingual usability study.

The token-rate estimate for the 11 responses with available counters is $0.29426525 using uncached input pricing; the final incomplete request's actual usage is unknown. The combined conservative preflight estimate was $0.60095325 for all 12 requests, within the selected $1 evaluation ceiling. Neither figure is confirmed billing or a credit-balance statement.

Studio live calls are paused again. The final private deployment uses medium effort, compact output and reuse disabled; a read-only runtime check confirmed `ready:false` and `mode:disabled`. Both editor tabs were left on the successful medium-effort room with its two preserved versioned receipts. The Studio pause does not globally revoke the shared key or disable the older consequences endpoint.

The demo is clearer, compact responses avoid redundant generation, and failure diagnostics are better. **The requested accuracy-preserving latency improvement has not been demonstrated.** Any further speed experiment should retain these held-out semantic checks and require fresh authorization for additional model calls.

## Archived evidence

The [frozen evaluation archive](../tests/semantic/2026-10-26-latency/) preserves all three phase reports, request ledgers, exact application responses, evaluator snapshots, independent audits and shutdown metadata. An offline verifier intentionally checks both successful and failed experiments, including unchanged publication after the final failure:

```sh
node tests/semantic/2026-10-26-latency/verify-evidence.mjs
```

It performs no network requests and writes no files. Hashes establish archive integrity, not independent remote attestation or billed cost.

## References

- [Meta reasoning controls](https://dev.meta.ai/docs/reasoning): medium remains the deployed default; the separately tested low setting failed semantic checks.
- [Meta structured output](https://dev.meta.ai/docs/structured-output): the compact response retains strict schema constraints and local validation.
- [Earlier four-review live evaluation](META-LIVE-EVALUATION.md): historical evidence, not the matched timing baseline for this run.
