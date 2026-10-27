# Bounded policy expressions — 26 October 2026

The new `expression-v3` interpretation protocol lets Meta describe a policy using ordinary boolean expressions instead of maintaining a numbered condition graph. The server parses those expressions into the existing validated rule representation. It preserves complete translations and independent interpretation of both drafts. Medium reasoning alone did not produce a consistent speedup; a separate low-reasoning expression test passed the same frozen semantic checks and reduced total wait across its four matched requests by approximately 40%. The private deployment selects that tested combination explicitly, with the limits below.

For example, eligibility can be expressed as `age >= 16 && (age >= 18 || guardianConsent) && (resident || member)`. The grammar supports boolean literals, the existing five independent flags, bounded integer-age comparisons, explicit UTC time comparisons, negation, conjunction, disjunction and parentheses. Ordered fee overrides retain first-match semantics, including zero-dollar fees. Eligibility is still evaluated before fees.

## Parser and state boundaries

The expression is data, never JavaScript. A dedicated tokenizer and recursive-descent parser consume the complete input; they do not use `eval`, generated functions or model-supplied code. Unknown identifiers, function calls, property access, comments, unsupported operators, malformed dates, trailing input and unsupported numeric forms are rejected. Each expression is bounded to 4,096 characters, 1,024 tokens and 32 syntactic nesting levels. The existing rule validator additionally enforces a combined 128-node budget, depth eight, at most 16 operands per boolean group and at most 16 fee overrides.

The surrounding response remains strict JSON. Original source text and draft versions are restored from the exact server-side review snapshot; Meta supplies only each translation, rules and clarification issues. Both complete candidates pass the existing review parser before discovery is accepted. Ambiguous or unsupported policies must remain unresolved. Expression mode does not reuse another editor's cached candidate.

The durable request lease, one-attempt claim and snapshot comparison remain in force. A changed draft discards an outdated review. A model response cannot approve itself: one vote, split votes, invalid output and unresolved policies cannot publish. Both simulated editors must approve the same candidate, and previous registration receipts keep their original policy version and outcome.

## Incomplete responses

The transport now distinguishes a confirmed output-token limit (`finish_reason: length`) from provider refusal and other incomplete responses. It retains only bounded numeric usage, the requested token limit and a fixed finish-reason enum; provider reasoning text, arbitrary metadata and credentials are excluded. Partial JSON and partially compiled rules are never accepted, even if they look usable. There is no automatic retry.

The server defaults to 8,192 completion tokens, including provider reasoning. An explicit server-only setting can select 12,288; client review requests cannot change this limit. The evaluation permits that headroom only after a baseline response actually reports `length`. A higher limit is not itself evidence of lower latency. The previous failed response lacked finish-reason telemetry, so its exact cause is unknown.

## Engineering validation

All 133 mechanical tests and TypeScript checking passed for the evaluated Sites source `e89b7f8651b32a951fed3c343cb8a2575bb9797d`. The production build passed separately. New parser tests cover precedence, negation, every supported UTC comparator at adjacent milliseconds, inclusive age endpoints, zero-fee priority, invalid syntax and bounded parsing. Two recorded demo policies preserved all 7,744 tested attendee outcomes through expression encoding and decoding. Six earlier frozen golden policies also round-tripped equivalently over 15,104 deterministic comparison cases.

Controlled integration tests exercise the full two-editor correction, preserved original receipt, malformed-expression rejection, explicit token-headroom setting and offline expression demonstration. They inject provider fixtures and make no real model requests. Independent inspection also verified that the compact/full baseline prompts and schemas, and the default provider request body, remained unchanged from Sites commit `772d63dca16bce7b5379cbfd4af4a7c02e863d90`.

## Live evaluation

The initial evaluation reserved at most six model requests and a conservative maximum estimate of $0.399719. It used two baseline calls on the existing Mosaic policy and correction, two matched expression calls, one independently authored difficult policy pair and one independently authored ambiguous-fee pair. Expected rules and boundary cases are frozen separately and never sent to Meta. The durable ledger consumes allowance before each request; there are no automatic retries.

All six requests completed with a natural `stop`. The earlier incomplete response was not reproduced. The expression phase therefore kept the same 8,192-token cap and medium reasoning. All 244 concrete outcome checks and two unresolved-result checks passed.

| Policy | Compact baseline | Expression protocol | Observation |
| --- | ---: | ---: | --- |
| Mosaic initial pair | 31.361 s | 24.884 s | Faster in this one sample |
| Mosaic correction | 27.645 s | 39.885 s | Slower; baseline reused Bob, expression interpreted both drafts |
| Fresh Nightjar pair | — | 35.203 s | Frozen admission, time and fee outcomes passed |
| Fresh Pixel Loom ambiguity | — | 12.372 s | Both candidates remained unresolved |

The medium-effort expression run did not demonstrate a consistent speedup. These were sequential single observations, not a randomized latency distribution, and the correction requests differed in whether Bob was freshly interpreted. Lower reasoning on the old graph protocol previously lost admission conditions; that failed result remains in the earlier report.

A separate four-request extension tested low reasoning with the new expression protocol against the exact four frozen expression stages. The total limit for this work was ten requests within the original $1 conservative budget. Its quality gate checked every result before approval and would have stopped at the first failed semantic check without retrying.

| Expression policy | Medium reasoning | Low reasoning |
| --- | ---: | ---: |
| Mosaic initial pair | 24.884 s | 10.038 s |
| Mosaic correction | 39.885 s | 27.707 s |
| Fresh Nightjar pair | 35.203 s | 18.010 s |
| Fresh Pixel Loom ambiguity | 12.372 s | 11.663 s |

All four extension responses finished naturally. All 160 concrete checks and two unresolved-result checks passed. The same model, expression protocol, source policies and 8,192-token cap were used; neither run reused cached candidates. Across these four sequential observations, total HTTP time fell from 112.344 to 67.418 seconds, approximately 40%. The correction still took 27.707 seconds. This is a measured improvement on this sample, not a general latency guarantee or proof that the low setting preserves accuracy on arbitrary policies.

Across both phases, all ten requests completed, all 404 concrete outcomes and four unresolved-result checks passed, and the two-editor approval and versioned receipt flow held. The conservative combined estimate was $0.59577925. Returned counters total 15,090 prompt tokens and 45,758 completion tokens, corresponding to $0.213334 at the uncached token rates used for the estimate. That is not a measured bill or credit-balance statement.

Independent AI review found all 20 rendered translation instances substantively faithful, including repeated and reused instances. Across the medium and low fresh-policy runs, an independent source oracle checked 170,368 admission/fee outcomes. All eight saved registrations used the jointly approved version; earlier receipts were preserved. These checks do not turn model interpretation into a proof of natural-language meaning. The audit retained minor presentation findings: some Spanish fee explanations append English labels; one medium-run label omitted the precise deadline time although its executable rule and full translation were correct. The low-run ambiguity clarification also offered mutually exclusive categories as an alternative, although this domain treats those flags as independent. It correctly returned unresolved rules; the clearer question is which fee takes precedence when both flags are true.

The private runtime now explicitly selects `expression-v3`, low reasoning, 8,192 completion tokens and no cached-interpretation reuse. Source defaults remain medium reasoning with `compact-v2` unless environment settings opt in. Studio live calls were paused after the tenth request; the read-only runtime check returned `ready:false` and `mode:disabled`. Both successful editor views and the preserved $16-to-$0 receipts are available in the [completed demo room](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-61fe6463-d49c-4afe-a6f8-fa3d59a4325f). The pause does not revoke the shared key or globally disable the older consequences endpoint.

The earlier incomplete response remains unexplained. This run establishes ten complete responses and better diagnostic handling, not a claim that every possible incomplete-response cause has been eliminated. A confirmed length stop is now distinguishable from refusal or another incomplete response; no token-limit increase was needed in this evaluation.

The editor personas and attendees are synthetic. This evaluation is not a human bilingual usability study, a production reliability guarantee or evidence of a probability of winning a competition. Token estimates are not billed charges.

## Archived evidence

The [frozen evaluation archive](../tests/semantic/2026-10-26-expression/) retains both phases' exact source policies, golden outcomes, request ledgers, application responses, source snapshots, independent audits and shutdown metadata. The earlier failed graph/low experiment is retained separately; it is not overwritten or counted as a successful expression test.

```sh
node tests/semantic/2026-10-26-expression/verify-archive.mjs
```

The verifier rechecks hashes, model and effort metadata, frozen outcomes, joint-vote holds, stale approvals and versioned receipts. It performs no network requests and writes no files. Archive hashes establish local integrity, not independent remote attestation or confirmed billing.

## References

- [Previous latency evaluation, including failed experiments](LATENCY-DEMO.md)
- [Meta structured output](https://dev.meta.ai/docs/structured-output)
- [Meta reasoning controls](https://dev.meta.ai/docs/reasoning)
- [Meta Chat Completions](https://dev.meta.ai/docs/protocols/chat-completions)
