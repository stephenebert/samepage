# Independent audit of SamePage witness run 01

**Scoped pass.** All eight pairs match the frozen expectations. I found no incorrect extraction, translation, witness acceptance decision, missing acceptance direction, or timestamp precision loss. There are no blocking findings.

The correct count is **16 source drafts processed: 13 executable interpretations and 3 whole-policy abstentions**. The **62 scenario checks consist of 53 Boolean decisions and 9 expected null outcomes**; these are independent-oracle checks, not 62 live form submissions. The run produced five different pairs, one equivalent pair, two unresolved pairs and six automatic witnesses.

I reviewed the raw bilingual responses and derived outcomes directly from the original prose without importing the production evaluator or reading application source. A separate Python check compared those formulas with the interpreted rules for every integer age from 0 through 120, both residency values, each exact cutoff and its adjacent milliseconds, and the supported time-domain endpoints. For these rule shapes, decisions can only change at those cutoffs; these checks establish the complete direction sets for these cases. Unsupported policies were kept unresolved, not evaluated through a supported subset.

All 16 original-language fields match the frozen source exactly, including punctuation and whitespace. All 16 generated translations preserve the constraints and scope on manual review. The three null policies retain their unsupported or ambiguous wording and provide specific, correct issues. All 16 server candidate objects preserve the raw response fields unchanged, apart from their server-assigned candidate IDs.

## Cases and discovered witnesses

| Case | Independently verified outcome | Witness or semantic check |
| --- | --- | --- |
| Crossed age/deadline | Different, both directions | A 23-year-old nonresident at `2027-04-12T18:30:00.000Z` is Alice-only. A 25-year-old nonresident at `2027-04-14T18:30:00.000Z` is Bob-only. |
| Negated disqualification | Different, Alice-only | An 18-year-old resident at `2027-05-23T08:45:00.000Z` qualifies for Alice’s complement of a conjunction, but fails Bob’s age-25 AND residency rule. Every Bob acceptance also satisfies Alice, so Bob-only is impossible. |
| Subsecond cutoff | Different, Bob-only | Age 31, nonresident, at exactly `2027-07-09T12:00:00.375Z`: Alice’s strict cutoff rejects, Bob’s inclusive cutoff accepts. Both languages, rule objects, witness explanation and registration retain `.375Z`. |
| De Morgan/redundancy | Equivalent | Bob’s denial rule reduces to age at least 27 AND residence. The additional age-23 condition adds no restriction. No spurious witness appears. |
| Optional residency versus bypass | Different, Bob-only | An 18-year-old resident at `2027-09-02T23:00:00.000Z` is Bob-only. Optional residency does not waive Alice’s age requirement; Bob’s residency alternative does. Both still require timeliness. |
| Unsupported exceptions | Unresolved | Alice needs upper bounds and residency-dependent age ranges. Bob needs an age-dependent deadline exemption. Both correctly return whole-policy null; no partial rule or equivalence claim appears. |
| Ambiguous date/zone | Unresolved | Alice leaves both numeric date order and local zone unspecified. Bob’s explicit April 6 UTC policy compiles independently. Alice is not silently repaired from Bob. |
| Unrestricted versus cutoff | Different, Alice-only | An 18-year-old nonresident at `2027-10-18T16:00:00.001Z` is Alice-only. No age/residency predicate means eligible; Alice has no deadline and Bob’s deadline expired one millisecond earlier. |

Every witness’s accepted/rejected results and individual age, residency, deadline and eligibility checks are correct. All six bilingual explanations include the full witness timestamp. Canonical `.000Z` additions are formatting changes, not changes to the represented instant. Witness ages need not match the hand-written scenarios; the discovered age-18 witnesses are valid independent examples.

## Live result and artifact checks

The harness registered all six witnesses under one selected published policy each, across five rooms: **one accepted and five rejected records**. I independently verified the selected candidate, matching approvals, published version 2, witness inputs, record decisions and predicate checks. I then fetched all eight rooms with read-only GET requests; every full room object matched its saved after snapshot. This verifies present server retrieval, but not persistence through a server restart.

Both frozen corpus hashes remain unchanged:

- `cases.json`: `7a1fdebd60bb1516253cd4e09ac0df6b5bac9b54edfbb9183353d6af67002276`
- `EXPECTATIONS.md`: `fed58c4359d53358ca060d5efb1e48b1c5436e529c1230835f7378b81df31556`

All eight saved prompt hashes and response hashes match their manifests/results. The prompt snapshots contain the exact drafts and a common interpreter/schema instruction; they do not contain the frozen expected answers. The example schema still uses the old age-16/November-5 values, but none of the new interpretations inherit those example constraints. The audit changed no response, fixture, source-policy or application file.

## Harness limits and meaning of “harder”

This is evidence for one controlled synthetic batch. The root reports one fresh `fork:none` responder saw only the eight prompt files and generated all eight responses. That is **one isolated agent context, not eight independent model trials**. The artifacts do not themselves record model configuration or an invocation trace proving the full generation history. Their hashes establish consistency of the files now present.

The cases are harder than a single AND/OR demonstration: they require two acceptance directions from crossed edits, negation, equivalence despite redundant wording, exact subsecond inclusivity, absence of predicates and safe abstention. They remain short, explicit policies aligned to the five supported fields. The ambiguous case announces its missing locale/zone, and the unsupported conditions resemble classes already identified in the interpreter prompt. Success does not establish performance on lengthy real policies, informal or mixed-language drafting, implied exceptions, relative dates, broader legal concepts, or actual applicant impact. The corpus author also performed this independent audit; independence is from implementation and responder access, not from the frozen ground truth.

The harness’s 62 scenario checks use its independent oracle. Only six selected-policy decisions go through the live registration endpoint; it does not submit every witness under both competing policies. The equivalent and unresolved pairs receive no publication attempt. This run does not cover malformed imports, stale versions, disagreement, retries, null-policy publication refusal, browser form behavior or concurrent users. It also does not prove the production discovery partition-count algorithm for all possible rule pairs. This audit independently establishes complete directions for these eight cases and verifies current live state; it is not a general verification of the implementation.

The harness’s apply stage rechecks the frozen cases hash, but does not recheck prompt hashes or the expectations-file hash itself. This audit supplies those checks. Translation quality and issue quality also require semantic review beyond the harness’s assertions.

## Nonblocking presentation observations

Generated deadline reasons say “arrive” or “no llegó,” while these policies define the application system’s recorded submission timestamp. Their full instants and boundary decisions are correct; using “recorded submission timestamp” would track the source event more precisely. Both unresolved results also retain generic coverage text beginning “Complete comparison,” even though their status, zero combinations and bilingual summary correctly say comparison is unavailable. If displayed separately, that scope text should be conditional. The witness descriptions use the neighborhood/barrio terminology explicitly defined by the interpreter prompt.

A defensible report is: **In one blinded synthetic batch of eight bilingual policy pairs, all 16 source drafts were preserved exactly; 13 compiled faithfully and three correctly abstained. All expected comparison outcomes and six automatic witnesses were independently verified, and six selected-policy registration records were retrieved from the live server.**
