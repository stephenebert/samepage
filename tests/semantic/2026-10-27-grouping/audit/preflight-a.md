# Independent preflight review — Harbor Archive (A)

**Pass.** The bilingual source, deliberate unsafe rewrite, 120 golden outcomes and two receipt expectations are faithful to the specified policy. No input edits or provider calls were made for this review.

The sole intentional source disagreement is adult alternative(a): Alice requires membership and **not** student status; Bob requires membership and student status. Both sources explicitly apply age20+ to both adult alternatives and residence to both nested conditions in adult alternative(b). The Spanish sentence that initially flattens alternative(b) is immediately followed by an explicit mandatory-residence clarification, so the full source is unambiguous.

The youth route requires age15–19, consent, and either resident/nonmember or student/scholarship. The late condition is separate and applies to both routes: strictly after the .500 boundary, scholarship or membership with consent is mandatory. The global opening excludes its .125 instant; the closing includes its .875 instant. The unsafe rewrite faithfully drops only the late membership consent requirement while adding the first-priority student2100 fee.

I independently implemented the literal source using a separate control-flow decision function and ordered fee predicates. All **120 explicit outcomes, two receipt assertions and201,344 oracle cross-checks** matched (four stages ×121 ages ×32flag sets ×13timestamps). This did not simply compare the oracle against its own output. The reviewer program is [preflight-a-reviewer.mjs](preflight-a-reviewer.mjs).

The counter-reading attendee A12 is correctly rejected: age19, resident/member, nonstudent, with consent and no scholarship. This attendee fails the youth route and cannot use either adult alternative. The canonical24-year-old resident student correctly changes from2300 to2100cents.

The oracle's timestamp scan handles candidate-only thresholds, minute/second precision, offsets, object keys and values; it tests exact instants and one-millisecond neighbors. This review validates the intended finite rule domain and source wording; it is not a human bilingual study or live-model result. Frozen file hashes are recorded in [preflight-a.json](preflight-a.json).
