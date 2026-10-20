# SamePage consequences: frozen independent expectations

These cases were written before any responder saw the app-generated prompts. They are evaluation material, not model responses. Do not send this file, fixture titles, expected rules, scenario expectations, or the frozen fixture as a whole to the responding agent.

Frozen `cases.json` SHA-256:

`361d18ba33f8a9a5491445c59842213b1dd382ee37015a634783d77c586c28c7`

The set contains **six independent paired cases, twelve full-policy drafts, and twenty-five scenarios with fifty editor outcomes**. Alice writes English; Bob writes Spanish. Every scenario expectation has been independently calculated from the stated expected rules. No model responses were generated during fixture preparation.

## Domain and comparison contract

Each draft replaces the entire baseline policy. The baseline is age **at least 16 AND neighborhood residency**, with a deadline of **2026-11-05T18:00:00Z inclusive**. It does not authorize inheriting unstated facts into a replacement.

Only five rule fields are available: `minAge`, `residentRequired`, `join`, `deadline`, and `deadlineInclusive`. `join` combines age and residency; the deadline is always a separate mandatory condition. Ages are completed whole years. Thus “older than 20” means a minimum age of 21 in this bounded domain. All scenario timestamps are UTC. Equivalent timestamp serializations such as `Z` and `.000Z` represent the same instant and should be compared as instants, not rejected for different formatting.

An unsupported clause or unresolved timezone requires **null rules** for that entire draft. Consequently its scenario predictions remain null rather than appearing as verified eligibility decisions. This is a deliberately conservative whole-policy contract; some individual outcomes could be inferred from a partial interpretation, but those are not validated policy predictions in this prototype. The other editor's fully supported draft may still be evaluated independently.

## Case expectations

| Case | Required extraction or hold | Most revealing evidence |
| --- | --- | --- |
| C-01 | Alice: age ≥18 **OR** resident. Bob: age ≥18 **AND** resident. Both deadlines are Nov 12, 17:00 UTC inclusive. | A resident aged 17 and a nonresident aged 18 qualify under Alice only. Everyone remains subject to the deadline, even when OR eligibility succeeds. |
| C-02 | Both drafts express the baseline exactly despite different phrasing. | A resident on their sixteenth birthday at the deadline qualifies under both; the same person one second later does not. No false difference or conflict should appear. |
| C-03 | Alice: age ≥21, deadline Nov 9 at 09:00 UTC **exclusive**. Bob: age ≥20, the same deadline **inclusive**. Residency mandatory for both. | One scenario isolates the age difference; a second isolates the cutoff difference. “Older than” and “at least” must not collapse together. |
| C-04 | Negated exclusion in Alice yields age ≥18 **AND** resident; Bob's negated conjunction yields age ≥18 **OR** resident. | A 17-year-old resident and an 18-year-old nonresident expose the De Morgan difference. A late submission fails both policies. |
| C-05 | Alice unresolved because guarantor status cannot be represented. Bob supported baseline. | The app must ask about the guarantor exception or explain the unsupported condition; it must not silently remove the exception or permit every nonresident. |
| C-06 | Alice unresolved because an explicit local calendar deadline has no timezone or location. Bob supported age ≥19 AND resident, Nov 13 at 18:00 UTC inclusive. | The app must ask which timezone applies. Assuming UTC, the browser's timezone, or the baseline's timezone is a failure. |

## What counts as a pass

1. Preserve each raw initial model reply, app parser response, and resulting policy state. Do not repair a model answer before reporting its initial result. Save retries separately.
2. Extract the expected supported rules or explicitly hold an unsupported draft. A valid JSON shape alone is insufficient.
3. Run every frozen scenario against both policies, matching all fifty true/false/null outcomes. Report unsupported outcomes separately from evaluated boolean outcomes.
4. For different supported rules, produce at least one **real** distinguishing scenario. Independently evaluate the witness under both extracted policies; the claimed outcomes must differ. Do not accept invented or contradictory examples.
5. For C-02, report equivalence within the supported domain rather than claiming no differences were sampled. If the app only samples scenarios, state that limitation.
6. For C-05 and C-06, avoid a definitive comparison until the unresolved policy is clarified. Preserve the user's actual draft and expose the exact missing concept or timezone.
7. Ensure visible English and Spanish explanations, policy labels, and witness outcomes remain consistent. A correct underlying boolean calculation with a misleading natural-language explanation is a semantic failure.

## Skeptical demo assessment

The strongest demonstration is a judge changing **AND to OR** in either language and immediately seeing a specific person gain or lose eligibility. C-03 is a stronger follow-up than repeating the same connective trick: it shows two independent boundary changes and distinguishes their effects. C-05 is necessary to establish that the product knows when its representation is insufficient.

This is a narrow policy-analysis prototype. Correctly evaluating extracted rules does **not** prove that the original natural language was extracted correctly. A deterministic scenario engine can make a wrong interpretation look unusually authoritative. The interface should expose the interpretation, show its source wording, and let the editors inspect or correct it before treating the comparison as settled.

Passing these cases supports a controlled demo of age, residency, and UTC deadlines. It does not establish general multilingual document merging, arbitrary policy reasoning, production reliability, or a first-place likelihood. A competitive presentation still needs a useful end-to-end editing story and a live judge-authored change outside the rehearsed examples. Model calls relayed manually through agents demonstrate reasoning quality; they do not demonstrate automated Meta API integration or model latency.
