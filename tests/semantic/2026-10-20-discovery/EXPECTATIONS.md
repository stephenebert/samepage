# Independent bilingual policy corpus

This corpus was authored without viewing the SamePage implementation, model responses, or responder prompts. All rule fields and scenario outcomes were fixed before responders receive these drafts. Alice's complete policy is in English; Bob's complete policy is in Spanish. Each draft is standalone and shorter than 3,000 characters.

The executable model has only `minAge`, `residentRequired`, `join`, `deadline`, and `deadlineInclusive`. Ages are completed whole years and residency is Boolean. Active eligibility predicates are combined with `join`; zero active predicates mean eligible. A deadline, when present, is always an additional AND requirement. UTC timestamps must retain millisecond precision. An unsupported or ambiguous policy must yield `rules: null` as a whole, rather than a misleading supported subset.

The expected rule objects use `join: "all"` when zero or one eligibility predicate is active and `deadlineInclusive: true` when no deadline exists. These are fixed canonical values. Other values for semantically inactive fields do not create a policy conflict; any separate structural normalization check should state whether it requires this convention.

`directions` is the complete set of possible strict acceptance differences for supported pairs. An independent witness finder may return different valid scenarios. It must not claim equivalence from a bounded sample. Known scenarios include boundary checks and agreed outcomes, not only conflict witnesses. For unresolved pairs, `directions: []` means that no executable comparison is authorized; it does not assert semantic equivalence. A null scenario outcome denotes unavailable execution under the supported rule model, even where a human could evaluate the underlying prose.

| Case | Fixed expectation | Why it matters |
| --- | --- | --- |
| `crossed-age-deadline` | Different; both Alice-only and Bob-only exist. | Alice lowers the age threshold but closes earlier. Neither policy contains the other's acceptance set. |
| `negated-disqualification` | Different; Alice-only exists, Bob-only does not. | Negating a conjunction yields age OR residence, while negating a disjunction yields age AND residence. The differing numeric thresholds must also be preserved. |
| `subsecond-cutoff` | Different; Bob-only exists solely at the cutoff for otherwise eligible applicants. | The deadline is the same UTC instant down to milliseconds; only inclusivity changes. Before and after it, the policies agree. |
| `demorgan-redundancy` | Equivalent; no acceptance difference exists. | Bob's denial rule is the complement of Alice's eligibility rule, and the additional age-23 requirement is implied by age 27. Rephrasing and redundancy must not invent a conflict. |
| `residency-optional-vs-bypass` | Different; Bob-only exists, Alice-only does not. | Optional residency contributes no predicate. Residency as an alternative qualification allows applicants below the age threshold. Neither interpretation waives the deadline. |
| `unsupported-exceptions` | Both rule objects null; comparison unresolved. | Alice needs upper age bounds and different age ranges conditional on residency. Bob waives the deadline for an age-defined resident subgroup, which cannot be expressed when every deadline is ANDed with eligibility. Neither policy permits partial extraction. |
| `ambiguous-date-zone` | Alice null, Bob supported; comparison unresolved. | Alice leaves both day/month ordering and the local time zone unidentified. Bob explicitly specifies April 6 in UTC. A supported counterpart cannot repair the missing facts in Alice's independent policy. |
| `unrestricted-vs-cutoff` | Different; Alice-only exists, Bob-only does not. | No active eligibility predicates means everyone is eligible. Alice explicitly has no deadline, while Bob has an ordinary inclusive UTC cutoff. |

The corpus has eight pairs, sixteen complete drafts, thirteen supported expected rule objects, three expected null rule objects, and thirty-one scenario checks. It includes five different pairs, one equivalent pair, and two unresolved pairs. The source is immutable for the first responder run: record SHA-256 digests of this file and `cases.json` before exposing any policy text, and preserve those digests with the run artifacts. No responder feedback should be used to revise this version.
