# Independent review of the consequences prototype

The six saved responses match the intended bounded policy interpretations. I found no material translation drift in the English/Spanish pairs. The main remaining weaknesses are a wording assumption in one fixture and English-only clarification messages. A supplemental mechanical replay now covers publication of Alice's strict-cutoff candidate.

This review was performed by the agent that authored the frozen fixtures, independently of the responding agent. The reviewer was not blinded to the expected answers. The parent reports that one fresh agent, `consequences_blind_interpreter`, generated all six responses from the production prompts only. These are six paired inputs evaluated by one responder, not six independent responders or repeated reliability trials.

## Confirmed evidence

| Check | Result |
| --- | --- |
| Source-language text preserved | 12/12 candidates exactly preserve their editor's draft. |
| Supported extraction | 10 executable rule sets match the expected thresholds, connectives, UTC dates, and boundary inclusion. |
| Unsupported extraction | Both intended holds are correct: guarantor exception and unspecified local timezone. |
| Independent scenario oracle | 44 boolean outcomes and six unresolved null outcomes match the frozen expectations. |
| Persisted registration decisions | 25/25 decisions match an independent implementation of the rule semantics. |
| Fresh persistence reads | Fresh GET requests to all six live local API rooms return the same 25 complete registration records. |
| Translation meaning | AND/OR scope, negation, completed-year boundaries, exact cutoff inclusion, guarantor wording, and timezone uncertainty are retained. |

The independent arithmetic in `independent-audit.mjs` does not import application code. The original harness uses the production evaluator for its local scenario checks; the independent oracle therefore provides an additional check beyond that shared implementation. Records contain the expected age, residency, timestamp, policy version, and decision, and no duplicate request IDs.

The frozen fixture SHA-256 still matches `361d18ba33f8a9a5491445c59842213b1dd382ee37015a634783d77c586c28c7`. `independent-review.json` adds **post-run** source, prompt, response, and state hashes. Those hashes are integrity records from this review, not claims that source files were hashed before the model ran.

## Findings requiring qualification or improvement

**C-02's equivalence depends on a fixture assumption.** Alice says to *send* the application by the deadline; Bob explicitly specifies *receipt*. Their extracted rules are equal if the synthetic electronic form treats submission and receipt as one instant. They are not generally equivalent for a system with delivery delay. The translations preserve this wording, so it is not invented by the model. Preserve the frozen run; add a separate receipt-worded case before using C-02 as evidence of unrestricted semantic equivalence.

**Clarification is not fully bilingual.** C-05 and C-06 preserve the unsupported policy in both languages, but their issue explanations are English-only. A Spanish-speaking editor should receive a Spanish explanation of the missing guarantor concept or timezone. This is a visible usability defect in a bilingual demo, although it does not cause an unsafe rule to execute.

**The Bob-only publication gap is now covered by a supplemental replay.** The original 25 stored form checks still publish Bob's candidate. `run-01/alice-exclusive-replay.json` records a separate fresh room reusing the unchanged C-03 response: both editor votes select Alice, version 2 publishes her age ≥21 and exclusive 09:00 UTC cutoff, a resident aged 21 is rejected at exactly 09:00:00, and the same applicant is accepted at 08:59:59. I compared both saved candidate objects against the original C-03 raw response and checked the two saved decisions. This is additional mechanical publication coverage, **not a new semantic model call**. The parent reports that the replay prompt was byte-identical; this supplemental artifact stores the final room rather than the prompt bytes. Its two registration records are separate from the original 25-record count.

**The current run is not safely replayable in place.** `prepare` can overwrite the existing run directory, and `apply` expects still-active review jobs. Running it again against completed rooms fails rather than reproducing a fresh result. The original manifest lacks pre-run source hashes. Future runs should use new immutable run directories and save source/prompt hashes before generation. The post-run audit does not repair that historical limitation.

**Several assertions are narrower than their labels.** Duplicate registration checks assert unchanged record count; a buggy replacement could pass that assertion. Current source inspection shows exact retries return the unchanged room, and the independent audit confirms the saved record contents, but full before/after equality would be stronger. One-vote and mismatched-vote checks assert version 1, rather than full equality of the published policy. The harness does not verify generated witness soundness, formal equivalence detection, or browser synchronization.

The supplemental `concurrency-and-staleness.json` reports rejected stale votes/responses and five preserved concurrent registrations. I inspected that record; I did not rerun those mutations during this review. It should remain separately identified from the six semantic cases.

## Demo assessment

The useful progression is concrete: change a policy in one language, reveal a specific person whose eligibility changes, show the other editor the same meaning, jointly select the intended policy, and demonstrate the changed form decision. C-01 gives the clearest first reveal. C-03 shows the effect is not limited to a rehearsed AND/OR trick. C-05 demonstrates honest refusal when the representation cannot express a requested exception.

The remaining central risk is the language-to-rules step. Exact execution of the wrong extracted rule can look authoritative. Keep the source wording, translation, and extracted interpretation visible for review. Correctly handling these narrow examples does not establish arbitrary policy reasoning, general collaborative document merging, independent human usability, Meta API integration, or a first-place likelihood. The results support continuing with a controlled prototype and a judge-authored live edit; they do not justify those broader claims.

No response, fixture, or application file was changed during this review.
