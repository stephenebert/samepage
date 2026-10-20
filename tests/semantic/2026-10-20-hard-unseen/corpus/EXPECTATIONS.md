# Hard unseen bilingual policy corpus — frozen author expectations

This corpus contains six new synthetic policy pairs, twelve complete drafts, ten supported expected rule objects, two expected null rule objects, and thirty-two hand-authored scenario rows. Alice writes English; Bob writes Spanish. There are three different pairs, one equivalent pair, and two unresolved pairs. Every draft is under 3,000 characters.

The author consulted only the schema, policy engine, and discovery corpus specified by the coordinator, plus the coordinator's list of reserved automatic cases. No interpreter outputs, model endpoints, browser sessions, paid API requests, Claude, or Fable were used to author these files. The scenario outcomes below and in `cases.json` were authored directly from the intended complete policies, without calling the product evaluator. This author does not serve as the blind interpreter or final auditor.

## Domain and scoring contract

Ages are integer completed years from 0 through 120. Residency is Boolean. An active age predicate means age >= minAge; an active residency predicate means resident, never nonresident. Active eligibility predicates use AND (`all`) or OR (`any`). With no active eligibility predicates, eligibility is true. A deadline is a global AND condition. Recorded UTC timestamps have millisecond precision.

The exact primary expected rule objects and each scenario's expected outcome are frozen in `cases.json`, using the discovery corpus's shape. Inactive fields conventionally use `join: "all"` and, without a deadline, `deadlineInclusive: true`. A different inactive value does not change acceptance and must not be reported as a semantic conflict. Likewise, equivalent representations of millisecond deadlines are valid: `< D` and `<= D - 1 millisecond` denote the same set in this domain. Report any structural differences separately from semantic errors. A supported expected candidate must be completely and faithfully representable with no unresolved issues; an unsupported or ambiguous candidate must have `rules: null` and a specific clarification issue. Do not substitute a guessed interpretation for a null expectation.

`directions` gives the complete set of possible strict acceptance differences for supported pairs. For unresolved pairs, `directions: []` means no executable comparison is authorized; it does not assert that the source policies agree. A null scenario outcome means execution is blocked, even when the underlying unsupported prose has an intelligible human answer. Scenario rows supplement the complete rule expectations; sampled agreement alone is not a proof of equivalence.

## Fixed expectations

| Case | Expected comparison | Rationale and required interpretation |
| --- | --- | --- |
| `eligibility-credentials-cross` | Different; Alice-only and Bob-only. | Alice makes age 52 both necessary and sufficient and removes residency. Bob makes residency both necessary and sufficient and removes age. Both explicitly remove the deadline. An older nonresident qualifies only for Alice; a younger resident qualifies only for Bob. Neither is globally stricter. |
| `complementary-residence-routes` | Different; Alice-only. | Alice's resident and nonresident routes exhaust the population and impose the same minimum age 22. Their union is simply age >= 22. Bob requires both age and residency. The explicit nonresident branch in Alice can be eliminated faithfully; it does not justify rejecting a policy whose whole acceptance set is representable. |
| `whole-day-versus-start` | Different; Alice-only. | Alice includes all of 30 April 2028 UTC, so her last accepted timestamp is 2028-04-30T23:59:59.999Z. Bob closes strictly before that date begins, at 2028-04-30T00:00:00.000Z. They disagree for that entire UTC calendar day. Neither has an opening time or any eligibility restriction. |
| `subsumed-route-and-adjacent-cutoff` | Equivalent; no directions. | Bob's resident age-72 route adds no applicant beyond his unrestricted age-58 route. Both thus require only age >= 58. Alice accepts through .624 and Bob rejects starting at .625 in the same second: these are identical deadlines on a millisecond timestamp domain. The expected rule objects intentionally differ in deadline and inclusivity while agreeing on every possible accepted registration. |
| `reverse-conditional-age` | Unresolved; Alice null, Bob supported. | Alice requires age >= 36 only for residents and accepts all nonresidents, yielding `(age >= 36) OR (NOT resident)`. There is no negative residency predicate in the schema. Bob's opposite conditional yields `(age >= 36) OR resident` and is supported. Alice's supported age and deadline fragments must not be extracted as a misleading complete policy. |
| `not-both-is-not-a-complete-rule` | Unresolved; Alice null, Bob supported. | Alice says the conjunction is unnecessary; she does not identify what is sufficient. This does not establish that either qualification alone suffices, that everyone qualifies, or that meeting both is forbidden. Bob explicitly states inclusive OR and excludes applicants with neither qualification. Bob's clarity cannot repair Alice's missing intent. |

## Independent scenario oracle notes

The thirty-two exact rows are in `cases.json`. They deliberately include accepted-by-both, rejected-by-both, boundary, extreme-age, and distant-future cases where relevant, as well as every predicted conflict direction. These concise cross-checks explain the decisive rows without treating an unsupported policy as executable:

| Case | Decisive scenario | Alice | Bob |
| --- | --- | --- | --- |
| `eligibility-credentials-cross` | Age 52, nonresident; any recorded UTC time | Accept | Reject |
| `eligibility-credentials-cross` | Age 51, resident; any recorded UTC time | Reject | Accept |
| `complementary-residence-routes` | Age 22, nonresident; exactly at the global cutoff | Accept | Reject |
| `complementary-residence-routes` | Age 21, resident; before cutoff | Reject | Reject |
| `whole-day-versus-start` | Age 0, nonresident; exactly 2028-04-30T00:00:00.000Z | Accept | Reject |
| `whole-day-versus-start` | Any applicant; exactly 2028-05-01T00:00:00.000Z | Reject | Reject |
| `subsumed-route-and-adjacent-cutoff` | Age 58, nonresident; at .624 | Accept | Accept |
| `subsumed-route-and-adjacent-cutoff` | Age 72, nonresident; at .625 | Reject | Reject |
| `reverse-conditional-age` | Age 35, nonresident; at cutoff | Blocked (prose would accept) | Reject |
| `reverse-conditional-age` | Age 35, resident; at cutoff | Blocked (prose would reject) | Accept |
| `not-both-is-not-a-complete-rule` | Age 45, nonresident; any UTC time | Clarification required | Reject |
| `not-both-is-not-a-complete-rule` | Age 46, resident; any UTC time | Clarification required | Accept |

For the unsupported case, the two prose outcomes in parentheses demonstrate why a tempting partial extraction is unsafe. Setting `residentRequired: false` does not express a nonresident qualification; requiring age 36 for everyone would incorrectly reject the first example, and using ordinary positive-residency OR would incorrectly accept the second. The product must block the whole Alice candidate.

For the ambiguous case, a useful clarification is whether either criterion alone is sufficient and applicants with neither are excluded, or whether some other relationship was intended. No specific interpretation may be selected merely because Bob's version is executable. Even if an interpreter considers one conversational reading likely, likelihood is insufficient to execute it.

## Freeze protocol

The author writes `cases.json` and this document, then records both SHA-256 hashes in `SHA256SUMS` before sending the corpus to the coordinator for blind interpretation. Neither file is revised using interpreter feedback. Any later wording repair would be a separately versioned corpus with new hashes and a fresh interpretation run. The manifest is outside the files it hashes.
