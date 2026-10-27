# Case B — two windows and a resident fee

Fresh authoring: no application code, previous tests, model outputs, network, or model calls were used. Independent review is required before freezing.

Domain: integer age 0–120, five independent Boolean flags (`resident`, `student`, `member`, `guardianConsent`, `scholarship`), and ISO UTC `submittedAt`.

Alice admits only inside `[2026-11-03T08:00:00.000Z, 2026-11-08T20:00:00.000Z)` or `(2026-11-12T16:00:00.000Z, 2026-11-17T23:59:59.999Z]`, and only if either:

- `14 <= age < 18 AND guardianConsent AND (resident OR (student AND NOT member))`
- `age >= 18 AND ((resident AND NOT scholarship) OR (student AND (member OR NOT scholarship)))`

Bob's Spanish means exactly the same thing except his second opening is inclusive. Thus disagreement is confined to otherwise eligible people at precisely `2026-11-12T16:00:00.000Z`. Both versions include the second closing and exclude the first closing.

Original fees, for admitted applicants only, take the first matching entry: scholarship 1800, member 3600, age under 18 2900, student 4800, default 6400, all in USD cents. Rejection always yields `feeCents: null`.

The requested amendment prepends resident 4200 to that priority list and preserves Alice's admission. It raises some resident fees (including scholarship and member cases) while lowering others (student or default cases). A minimum-price interpretation is incorrect.

The bilingual unsafe rewrite preserves Alice's admission and adds the resident override, but changes student 4800 to 5100. This affects admitted nonresident adult students without membership or scholarship. It is distinct from the original timestamp disagreement. Repair must leave their fee at 4800.

`goldens.json` contains exactly 30 explicit cases plus a realistic before/after receipt attendee. The oracle exports `expectedOutcome(stage, attendee)` and `verifyRules(rules, stage, evaluate)`, for stages `alice`, `bob`, `unsafe`, `repaired`. Supply a synchronous `evaluate(rules, attendee)` adapter returning `{accepted, feeCents}`. Verification crosses all 121 ages and all 32 flag combinations with source and recursively discovered candidate AST timestamps, adjacent milliseconds, interval midpoints, and representative dates. It counts every mismatch and retains the first 100 details.

`../ambiguous-policy.json` has the same missing student fee amount in both languages and explicitly has no deadline. The only expected response is clarification without rules; no repair is supplied.
