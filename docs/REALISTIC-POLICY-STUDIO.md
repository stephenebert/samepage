# Realistic policy studio — 20 October 2026

The private `/studio` workspace turns bilingual workshop policies into visible admission and fee consequences. Its recorded opening case admits the same 24-year-old scholar under both drafts, but charges $80 under a youth-only waiver and $0 under a waiver for every scholarship recipient.

## What ships

- Nested AND/OR/NOT conditions, integer ages 0–120, resident/student/member/guardian-consent/scholarship flags, and explicit UTC millisecond boundaries.
- Fixed USD fees with ordered first-match exceptions. Denied admission has no applicable fee; a zero fee is distinguished from denial.
- Deterministic witness discovery for both admission directions and both price directions; maximum fee delta per price direction. Search partitions cover the supported parsed-rule domain, not every possible policy or the correctness of a natural-language interpretation. Oversized searches return unresolved.
- Exact source and version validation, compare-and-swap persistence, stale review protection, matching editor approvals, and immutable receipt inputs/outcome/version. All unresolved comparisons block approval. Receipts retain their decision trace, but are not a complete archive of every historical bilingual policy and AST.
- A compact consequence/approval/form layout. Drafts, interpreter JSON, and detailed search traces are expandable. Initial v1 is explicitly an example policy, not a fabricated prior agreement.
- Explicit recorded-demo provenance. Fresh drafts require a fresh manual Codex-agent response. No provider code is imported by the studio server; no model API calls were made. The older `/consequences` adapter has not yet been extended to this richer contract or tested against live Meta.

## Suggested demonstration

1. Open `/studio` and choose **Try the guided demo**. Explain that interpretation is recorded and consequence search runs now.
2. Inspect the automatically selected adult scholar: eligible in both drafts, $80 versus $0. Read the policy clauses to see the scope difference.
3. Open Alice and Bob views, or operate both in the combined view. A single approval or different choices holds the form. Both must choose the same meaning.
4. Choose **Use this person**, then **Submit test registration**. The server saves an outcome against the agreed policy version. All people and fees are synthetic; no payments are collected.
5. For fresh wording, save drafts and prepare the exact review prompt. Relay it to a separate agent, import its untouched JSON, inspect the findings, and jointly approve. Never describe replay as live interpretation.

## Evidence and limits

Evidence is retained in `tests/semantic/2026-10-20-studio/`, including hashes, first responses, clarification rounds, API records, and an independent audit.

The original five pairs were frozen by one author agent before another received only production prompts. Central scholarship and complex age/consent/negation/time-window cases executed correctly: 24 admission/fee decisions. Live capacity wholly abstained. Guardian-exception and discount-priority cases also abstained because their authors omitted the required deadline wording. Those two pairs are **not** scored as first-attempt execution successes.

In a separate recorded clarification round, each omitted deadline was explicitly stated as absent. Both pairs then executed, and all 24 additional scenario decisions matched the original expected outcomes. Total: **48 executable admission/fee checks**, two whole-policy capacity abstentions, and four preserved initial deadline clarifications. Discovered consequences included $80 versus $0, a guardian-consent exception, and $20 versus $0 from discount priority. The equivalent case generated no false conflict.

An independent agent audit checked 85,184 direct-formula outcomes for the central and equivalent cases, plus recomputation of witnesses. Review found two workflow bugs that were fixed: unresolved comparisons could permit one valid candidate to publish, and a lost-response receipt retry could accidentally use a newer policy version. Added regression tests cover unresolved approval; the UI now retains the exact pending registration payload. Browser response-loss fault injection was not performed.

Two Chrome tabs exercised single-vote and conflicting-vote holds, joint publication, edits that preserved the other editor’s unsaved typing, fresh manual review, and a second joint publication. The **same exact attendee and timestamp** yielded $80 at v2 and $0 at v3; both server receipts remained intact. Five fresh rooms also passed local and deployed private HTTP checks, including concurrent saves, equivalent rules, unsupported holds, and idempotent receipt retries.

All **95 mechanical tests**, TypeScript checking, and the production build passed. This remains synthetic agent evaluation, not independent bilingual human research or a measured probability of winning. Capacity, arbitrary arithmetic, external data, payments, and general policy language remain unsupported. Editor roles are simulated; keep the deployment owner-private until identity and room authorization are implemented.

Source deployed through Sites: `70e3232b7d4816b4df4f637fb64523163da03fbb`. The private GitHub mirror retains prior evidence and history.

## Reproduce

```sh
node --test tests/*.test.mjs
node tests/semantic/2026-10-20-studio/evaluate.mjs
node tests/semantic/2026-10-20-studio/evaluate.mjs --clarified
```

The semantic scripts replay frozen responses rather than call a model. The HTTP script creates synthetic rooms against a running loopback server; its explicit remote mode takes the private Site service credential through hidden stdin and never stores it. No credential is included in evidence.
