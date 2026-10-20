# Independent review of the frozen SamePage hard corpus

Audit date: 20 October 2026. Verdict: **six of six cases pass independent semantic review; no semantic false pass or unfair expected answer was found.** This verdict covers the six frozen pairs and the saved execution evidence described below.

The run contains 12 drafts, 10 executable interpretations, two correctly blocked interpretations, 32 scenario rows, and 64 candidate-level scenario checks. Ten of those checks expect a blocked/null result; the other 54 check Boolean acceptance. The three different pairs yield four valid directional witnesses. Four witnesses were registered before approval and again after approval, producing eight receipts. Four executable pairs publish version 2; the two unresolved pairs retain version 1.

## Independence and evidence

I first reviewed the runner and its local manual endpoint dependencies without opening the corpus. After the coordinator declared the corpus frozen, I derived acceptance formulas directly from both languages and checked the expectations before seeing interpreter results. I did not contact the corpus author or interpreter. I then reviewed all six untouched response files, all before/interpreted/after snapshots, results, manifest, and prepare/apply HTTP logs. I used small local, in-memory checks independent of the product evaluator. I made no browser, server, live Meta, paid-provider, or other network requests, and changed no source or evidence file. This report is the only file I wrote.

The corpus and expectation hashes match the prepared manifest:

- `cases.json`: `ca4d69c32a08faf056a4b83a8a3df9daded1e138ad5470598b40053f0bda26e8`
- `EXPECTATIONS.md`: `715050cf70a0cecc240bb4945103691d93afc1a490cdfc0c3db7b51b83846e27`

Each saved prompt matches its manifest hash and pending job snapshot. Each response matches its result hash. Raw response candidates match the interpreted and final candidates, apart from server-assigned candidate IDs. All 12 source-language texts are preserved exactly. I found no meaning-changing omission, addition, negation error, scope error, or boundary error in the 12 translated texts.

## Independent semantic findings

Let `A_n` mean completed age at least `n`, `R` mean neighborhood resident, and `t` mean the recorded UTC timestamp. The domain is integer ages 0–120, Boolean residency, and valid four-digit-year UTC timestamps at millisecond precision.

| Case | Derived meaning and audit finding |
| --- | --- |
| `eligibility-credentials-cross` | Alice is exactly `A_52`; Bob is exactly `R`; neither has a deadline. Necessary-and-sufficient wording removes any ambiguity. Both difference directions exist. The generated 52-year-old nonresident and 18-year-old resident correctly demonstrate them. |
| `complementary-residence-routes` | Alice's `(R AND A_22) OR (NOT R AND A_22)` simplifies to `A_22`. Bob requires `A_22 AND R`. Both globally require `t <= 2028-02-29T12:15:00.050Z`. The nonresident wording is removable by complete logical simplification, so blocking Alice merely for mentioning nonresidents would be unfair. The 22-year-old nonresident at the exact cutoff is a valid Alice-only witness. |
| `whole-day-versus-start` | Alice accepts every timestamp before 1 May 2028 UTC; Bob accepts only timestamps before 30 April 2028 UTC. Neither has an opening time or eligibility restriction. Alice's inclusive final millisecond and Bob's exclusive start-of-day timestamp are correct. The generated midnight witness is Alice-only. |
| `subsumed-route-and-adjacent-cutoff` | Bob's `A_58 OR (R AND A_72)` simplifies to `A_58`. Alice's `t <= .624` and Bob's `t < .625` in the same second are equivalent at millisecond precision. Both complete acceptance sets are identical despite different rule fields and prose. No witness should exist. |
| `reverse-conditional-age` | Alice means `(A_36 OR NOT R) AND deadline`; Bob means `(A_36 OR R) AND deadline`, with the same inclusive cutoff. Alice is unsupported: every available eligibility expression is nondecreasing in residency, while Alice accepts a younger nonresident and rejects the same younger resident. Her issue correctly explains why `residentRequired:false` cannot represent nonresidency. Bob is executable. |
| `not-both-is-not-a-complete-rule` | Alice denies the necessity of the conjunction without specifying a sufficient eligibility rule. Age alone, residency alone, inclusive OR, and unrestricted eligibility are compatible readings; “no other eligibility conditions” does not choose among them. The issue specifically requests the missing cases and preserves the uncertainty in Spanish. Bob explicitly states inclusive OR, allows both, excludes neither, and removes the deadline. |

All 10 executable rule objects exactly match the frozen primary expectations. Both null results have specific, correct issues, and all executable candidates have empty issues. My independently derived formulas agree with all 64 recorded scenario outcomes. Null here means that execution of the proposal is blocked; it is not an acceptance decision for an attendee.

## Approval, receipt, and request evidence

Every interpreted snapshot retains the complete original published policy from its before snapshot. The runner asserts complete published-object equality after the first vote and after mismatched votes in each of the four executable cases. Its saved result flags report those assertions passing. Each final executable snapshot contains both simulated votes for the exact Alice candidate, version 2, the correct review/candidate IDs, and exactly that candidate's bilingual text and rules.

Both unresolved final snapshots retain the complete version-1 published object, an open review, and no votes. Their vote requests returned HTTP 400; the runner checked the `UNRESOLVED` code. It does not attempt to publish the executable Bob candidate in these two rooms.

All eight receipts have the expected request ID, attendee age/residency/timestamp, and policy version. Independently computed acceptance and individual age/residency/deadline/eligibility checks match the stored decisions. The four version-1 receipts remain unchanged in the final snapshots. The version-2 decisions under the approved Alice policies are, respectively: accept/reject for the two credential witnesses, accept for the complementary-routes witness, and accept for the whole-day witness. The receipt explanations correctly describe these decisions.

The logs contain 54 manual application requests: six HTTP 201 room creations, 46 HTTP 200 responses, and two expected HTTP 400 unresolved-vote rejections. Every logged path is `/api/consequences` or a room directly below it; none is an automatic-review endpoint. Inspected runner allowlisting, redirect rejection, and local route dependencies support the conclusion that this runner does not call provider code. The hardened authorization parser now uses a generic malformed-JSON error. HTTP evidence omits authorization headers.

## Strongest surprise and candid weakness

The strongest result is the equivalent pair: an apparently additional resident age-72 route changes nothing, and a numerically later exclusive timestamp changes nothing at millisecond precision. The system correctly avoids manufacturing a conflict from those differences.

The most concrete weakness in the receipt demonstration is that **all four version-1 registrations are already late under the old 2026 deadline**. Three also fail its residency requirement. The receipts demonstrate that the selected version governs execution and historical receipts stay fixed, but their before/after flips do not isolate the candidate disagreement from the deadline extension. A future demonstration using an otherwise eligible timestamp within the old deadline would make that causal point clearer.

## Limits of the verdict

- This is six deliberately challenging synthetic pairs in a small rule language, with one blind interpretation per pair. It is not a general accuracy estimate, adversarial-security proof, or proof that arbitrary bilingual prose is safe to execute.
- Formal equivalence is complete only for the declared structured domain. Correct language interpretation still requires semantic review; formal comparison alone cannot establish it.
- Alice and Bob are simulated editor roles, not independently authenticated people. The run demonstrates the two-vote state machine, not real-world identity separation or human consent.
- Intermediate single-vote and mismatched-vote responses are represented by passing runner assertions and HTTP metadata, not separately persisted full snapshots. This audit did not capture traffic or query the live server.
- Receipt coverage comes from the three executable-different pairs. The equivalent and unresolved pairs produce no witness receipts. This run does not test receipt idempotency, conflicting reuse of request IDs, or stale-policy rejection.
- The run used the manual independent-agent relay. It does not measure live Meta model quality, provider latency, billing, or server egress. The runner's literal `providerCalls: 0` is not provider telemetry; “zero model API calls” in the manifest must be read as no extra live provider API calls in this manual relay, not absence of model interpretation in Codex.
- The coordinator's separate two-editor browser demonstration reuses the complementary-routes case and response. It is not an additional unseen case, and browser behavior is outside this file-based audit.

## Addendum: subsequent browser demonstration isolates residency

I subsequently inspected the saved `browser-isolation.prompt.txt`, `browser-isolation.response.json`, `browser-final.json`, accessibility captures, and `same-attendee-two-policies.png`, without making network requests or operating a browser. This extends the evidence review to those captured browser artifacts; it does not change the frozen six-case results or the caveat about their eight receipts.

The fresh `review-11` response preserves both source drafts exactly, translates them faithfully, and retains the correct rules with empty issues. Alice's added “exactly” does not change the acceptance set. The original Alice rule and the newly published Bob rule have identical minimum age, logical join, deadline, and inclusivity; their only executable-field difference is `residentRequired`. The final state records both simulated editors voting for `review-11-bob`, publishing his exact bilingual policy and rules as version 3 from base version 2.

The final JSON, accessibility text, and screenshot agree on the same synthetic attendee: age 22, nonresident, recorded at `2028-02-29T12:15:00.050Z`.

| Saved receipt | Version | Age check | Deadline check | Residency check | Decision |
| --- | --- | --- | --- | --- | --- |
| `registration-9` | 2 | Pass | Pass | Inactive | Accepted |
| `registration-15` | 3 | Pass | Pass | Fail | Rejected; sole reason is “Must be a neighborhood resident.” |

**These saved decisions isolate residency for this attendee.** The deadline confound from version 1 is absent in this version-2-to-version-3 comparison, and the version-2 acceptance remains in the final receipt history. A complete version-2 published-policy snapshot was not retained: its full rule object is reconstructed from the original Alice response and reported publication sequence, whereas the version-2 receipt directly establishes its recorded checks and outcome. The mismatched-votes capture is from the first round at revision 7/version 1; it should not be described as a captured second-round mismatch.

This is a follow-up demonstration of an existing corpus case with a semantically neutral wording change, not a seventh unseen case or evidence of independent human identities. The reviewed fresh response SHA-256 is `6bc8e5842371253dba2cd79ca11201028c1d26a37aa47869bca0c1f63309e835`; the final-state SHA-256 is `13cd0dff2435aa38a3c6327c934df80deee8838460ff2deaa6946442c3879aff`.
