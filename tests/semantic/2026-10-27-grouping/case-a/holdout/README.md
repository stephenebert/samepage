# Harbor Archive Open Studio — fresh grouping challenge

This policy was authored for the Spanish-grouping retest without reading any prior holdout provider inputs. Only the previous runner and oracle interface were consulted for compatibility. No application source, model output or provider call was used to choose the new policy.

The English and Spanish source policies intentionally disagree in one place: the adult membership alternative requires **not being a student** in Alice's English, versus **being a student** in Bob's Spanish. All other requirements match. The source explicitly makes the age-20 restriction apply to both adult alternatives and separately groups the resident requirement over its nested alternatives.

The policy also has a 15–19 youth route with mandatory guardian consent, an exclusive opening at a millisecond-precision timestamp, an inclusive closing, a late scholarship-or-member-with-consent requirement, and six first-match fee outcomes. The requested repair makes all admitted students pay 2,100 cents while preserving Alice's admission and all nonstudent fees. This can raise a scholarship fee as well as lower an ordinary fee.

The authored unsafe rewrite applies the requested fee but drops guardian consent from the late member exception. Both languages express that unsafe change faithfully, so the checker should block an admission change even for attendees outside the student fee group.

## Frozen checks

- `A12` is the grouping-specific counter-reading witness: a 19-year-old resident/member, not a student, no scholarship, with guardian consent. Both source policies reject. Removing the age-20 restriction from the adult resident alternative would wrongly admit this attendee at the youth fee.
- `A01` and `A02` exercise both directions of the initial student-negation disagreement.
- `A26` and `A27` expose the unsafe late-consent removal outside and inside the requested student group.
- `A21`–`A28` exercise exact UTC boundaries and one-millisecond neighbors.
- The canonical receipt is a 24-year-old resident student submitted at `2026-12-10T11:22:33.444Z`: **$23 before → $21 after**.

`goldens.json` contains 30 manually specified attendees and all four expected outcomes per attendee (Alice, Bob, unsafe rewrite, repaired policy). These were cross-checked against the separately implemented JavaScript oracle: 120 outcome matches and two receipt matches. Expected answers remain in the offline evaluator and are not part of `provider-inputs.json`.

The independent oracle imports no application code. It checks every integer age 0–120 and all 32 combinations of the five boolean fields at source-boundary neighbors, interior/exterior instants, and any additional boundaries found recursively in returned rules. With only source boundaries this is 13 timestamps, or 50,336 comparisons per rule set. Candidate-only timestamp discovery was checked offline.

This is one synthetic policy, not a statistical estimate of general reliability or a human bilingual study. The deliberately unsafe rewrite is a challenge authored in advance, not a spontaneous model error. No network or model calls were made while preparing these files.
