# Lantern Lab independent holdout

Status: authored and locally sanity-checked; **not frozen**. Await independent review before live use.

This case was created without reading application code, existing tests, prior cases, or model outputs. No network or model calls were made. Only `provider-inputs.json` is provider-facing. Keep this README, the oracle, and the goldens out of model inputs.

## Intended semantics

All flags are independent. Inputs use integer ages 0–120, five Boolean flags, and an ISO UTC registration timestamp. Alice admits only applicants aged at least 14 during the half-open registration window, with at least one qualifying flag. A minor without consent needs the resident-student waiver. At the November 20 cutoff that waiver survives only with **member AND scholarship**. Bob differs in exactly that nested condition: **member OR scholarship**, inclusive of both. All other admission conditions, timestamp comparisons, and fee priorities agree between Alice and Bob.

From November 25 inclusive, nonresidents need both member and scholarship. Both unsafe language versions mistakenly relax this separate condition to scholarship alone. They otherwise preserve Alice's admission rules and implement the requested fee edit. This is one collateral admission change, separate from the bilingual disagreement.

The intended repair preserves Alice's complete admission behavior. Every admitted member pays 1,800 US cents at the highest fee priority; every admitted nonmember keeps the original first-match fee. Rejected applicants always have `feeCents: null`. The member override raises scholarship (0), resident-student (1,200), and minor (1,600) fees while lowering the original member fee (2,600).

The receipt is a 32-year-old nonresident member submitting before the late cutoff, with a fee changing from 2,600 to 1,800 cents. No special minor or scholarship exception is needed for this receipt.

## Files and verification contract

- `provider-inputs.json`: the exact seven requested top-level fields; total length of Alice, Bob, and both unsafe policy texts is 4,526 characters.
- `goldens.json`: exactly 30 attendees, their four expected outcomes, and the adult before/after receipt. Expectations were generated from `expectedOutcome` and then checked against the hand-derived table below.
- `independent-oracle.mjs`: no application imports. Exports `expectedOutcome(stage, attendee)` and `verifyRules(rules, stage, evaluate)`. Stages are `alice`, `bob`, `unsafe`, and `repaired`. The callback is synchronous `evaluate(rules, attendee)` and must return `{ accepted, feeCents }`.

`verifyRules` visits every age 0–120 and every one of the 32 flag assignments. It crosses these with each of the four source boundaries at minus one millisecond, exactly, and plus one millisecond, plus five representative instants before, within, and after the window. Base coverage is **65,824 cases per stage** (121 × 32 × 17). It recursively scans candidate rules' string keys and values for ISO timestamps, adding each candidate boundary and its adjacent milliseconds too. Thus a fresh candidate timestamp expands coverage rather than escaping source-only tests. It returns the full mismatch count and at most the first 60 mismatch details. Rejected fees are checked as strictly null.

Local harness checks exercised all four stages across the full base grid and confirmed that an invented candidate timestamp adds exactly three instants. These harness checks establish enumeration mechanics, not independent semantic correctness; independent review remains required before freezing.

## Manual golden sanity check

`R` means rejected with a null fee. Every number means accepted at that US-cent fee. This table was derived by reading the policy clauses and checking each fixture, independently of calling the oracle again.

| ID | Alice | Bob | Unsafe | Repaired |
| --- | ---: | ---: | ---: | ---: |
| A01 | 2600 | 2600 | 1800 | 1800 |
| A02 | 0 | 0 | 1800 | 1800 |
| A03 | 1200 | 1200 | 1800 | 1800 |
| A04 | R | 1200 | R | R |
| A05 | R | 0 | R | R |
| A06 | 0 | 0 | 1800 | 1800 |
| A07 | R | R | R | R |
| A08 | 1200 | 1200 | 1800 | 1800 |
| A09 | R | 1200 | R | R |
| A10 | R | 1200 | R | R |
| A11 | R | R | R | R |
| A12 | R | R | R | R |
| A13 | 1600 | 1600 | 1600 | 1600 |
| A14 | 1600 | 1600 | 1800 | 1800 |
| A15 | 4200 | 4200 | 4200 | 4200 |
| A16 | 3000 | 3000 | 3000 | 3000 |
| A17 | 1200 | 1200 | 1200 | 1200 |
| A18 | R | R | 0 | R |
| A19 | R | R | R | R |
| A20 | 0 | 0 | 1800 | 1800 |
| A21 | 0 | 0 | 0 | 0 |
| A22 | R | R | R | R |
| A23 | 2600 | 2600 | 1800 | 1800 |
| A24 | R | R | R | R |
| A25 | 1200 | 1200 | 1800 | 1800 |
| A26 | R | R | R | R |
| A27 | 1200 | 1200 | 1800 | 1800 |
| A28 | 4200 | 4200 | 4200 | 4200 |
| A29 | 2600 | 2600 | 1800 | 1800 |
| A30 | R | R | R | R |

The explicit witnesses cover all six original fee branches, both directions of target fee movement, unchanged nonmember fees, both arms of the nested OR disagreement, the unsafe-only acceptance, minimum/adult/maximum ages, and exact opening, waiver, nonresident, and closing boundaries. Exhaustive enumeration additionally covers age zero, all flag overlaps, and each source boundary's adjacent milliseconds.
