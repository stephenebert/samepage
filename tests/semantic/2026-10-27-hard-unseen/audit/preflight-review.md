# Independent pre-live review

Status: **pass for freeze**. No open blockers. This is an offline review of test definitions and runners; it is not a live result. Reviewed file hashes are recorded in `preflight-review.json`. No provider/network calls, source edits, author-file edits, freezing, or activation were performed by this reviewer.

Both holdouts have consistent bilingual source meanings, intentional initial differences, intentional unsafe rewrites, and exact bounded repair targets. Each has30 explicit attendees. A separate reviewer implementation agreed with all240 stage outcomes and four receipt outcomes, and with402,688 additional all-age/all-flag outcomes across independently selected timestamps. Each oracle caught a deliberately injected error at a candidate-only one-millisecond instant.

| Case | Initial difference | Authored unsafe change | Correct target | Receipt |
| --- | --- | --- | --- | --- |
| A | Late resident-student minor waiver uses AND in English and OR in Spanish | Drops membership from the distinct late nonresident scholarship exception | Preserve Alice admission; every admitted member pays1800; all nonmember outcomes unchanged | 2600→1800 cents |
| B | Second window opening is exclusive in English and inclusive in Spanish | Changes qualifying nonresident student fee4800→5100 | Preserve Alice admission; every admitted resident pays4200; all nonresident outcomes unchanged | 4800→4200 cents |

A witnesses: A04/A05/A09/A10 for the initial difference; A18 for the unsafe admission change. B witnesses: B08 for the initial difference; B24/B28 for the unsafe fee change. A golden JSON was generated from its author's oracle and manually checked; this reviewer separately verified all of it. Do not describe those original golden values as independently authored from that oracle.

The ambiguity pair now explicitly rejects under18 applicants and states no submission deadline, leaving the reduced student fee amount as the intended missing detail. After the live call, check that the clarification actually identifies that amount. Null rules with an unrelated issue are insufficient evidence of detecting this ambiguity.

The case runners enforce at most three journaled provider attempts each, no automatic retry, a persistent no-rerun lock, 64KiB provider-body cap, and8192 output tokens. The ambiguity runner permits one attempt. The declared seven-call conservative estimate is $0.852992; actual billed cost is unknown. Root controls suite order A→B→ambiguity and stops at the first failure. Production request code has one fetch per invocation and no automatic fallback/retry.

Three pre-live findings were resolved: required golden/oracle files are now enforced in the freeze manifest; incidental ambiguity about deadline and under18 treatment was removed; and ambiguity replay binds fixed inputs and recorded request/response to before/after artifacts and metrics. Both case verifiers preserve failed stages, replay publication/receipt effects, and disable network.

Generated repairs intentionally receive server-derived target rules. Describe this as guided repair. The independent oracle verifies compiled-rule outcomes; it does not independently verify the wording of model-generated translations or repairs. A separate post-live bilingual review remains necessary. Provider request artifacts are reconstructed from frozen source and returned jobs, not intercepted transport. The unsafe rewrites were authored challenges, and editor identities are simulated.

Suggested evidence wording: “Independently authored holdouts with separately reviewed expected outcomes and application-independent semantic oracles; bounded first-attempt provider evaluation against frozen source, followed by independent bilingual output review.”

Keep this preflight review immutable after freezing. Save post-live review in new files.
