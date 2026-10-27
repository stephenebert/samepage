# SamePage harder unseen evaluation — 27 October 2026

**Finding present.** Two fresh policies completed the full workflow with two simulated editor roles. All executable-rule checks passed, but independent review found ambiguous Spanish wording in the second policy. This is not an unqualified bilingual-reliability pass.

| Frozen challenge | Compiled-rule results | Same-attendee receipts | Separate prose review |
| --- | --- | --- | --- |
| Lantern Lab: nested consent exceptions and overlapping discounts | 120 concrete outcomes; 263,296 oracle comparisons passed | $26 → $18 | Passed AI review |
| Two registration windows: nested adult/minor alternatives, precise UTC boundaries, resident override | 120 concrete outcomes; 309,760 oracle comparisons passed | $48 → $42 | Spanish age-scope ambiguity |
| Unspecified student discount | **Not run** after the wording finding | — | No live result |

In each completed flow, the app detected the original bilingual rule difference, held publication until both simulated roles agreed, blocked an authored rewrite that changed outcomes outside the requested scope, and published the generated repair only after both approvals. Both original receipts remained intact. The unsafe rewrite in A loosened admission; B changed an unrelated student's fee from $48 to $51.

The six calls ended naturally with no incomplete responses or retries. HTTP durations were 22.793 / 12.399 / 14.428 seconds for A and 18.410 / 15.091 / 8.255 seconds for B (interpret, check unsafe rewrite, generate repair). This is not a latency benchmark or proof of a speed improvement.

## What needs fixing

The second policy's generated Spanish baseline and repair say:

> (2) tiene al menos 18 años, y es residente sin beca, o es estudiante que cumple al menos una de estas dos condiciones: ser miembro, o no tener beca.

The intended age-18 requirement applies to **both** adult alternatives. This sentence permits a plausible reading where the student alternative escapes that restriction. For the frozen B18 attendee (17, nonresident student/member, guardian consent, no scholarship), the intended and executable rules reject; the loose prose reading could admit at $36.

The returned rules and the app's derived reading view preserve the correct grouping. The original generated Spanish remains stored and published, so the rule checker did **not** catch this wording issue. Two independent AI reviewers found it after the second synthetic flow had published. This is a scope ambiguity, not a demonstrated wrong executable decision or a human bilingual study. See the [full audit](audit/post-live-bilingual.md).

Before submission, require explicit grouping in both generated languages, preserve the original text for review, and rerun fresh nested-alternative policies. Do not silently change this frozen result into a pass.

## Cost, scope and evidence

- Six Meta requests using `muse-spark-1.3`, `expression-v3`, low reasoning, 8,192 maximum completion tokens. No unchanged-output reuse.
- 12,938 input and 17,676 completion tokens: **$0.09129550 estimated** at the [published standard token rates](https://dev.meta.ai/docs/pricing-rate-limits). Actual billing/credit deduction is unconfirmed. The pre-run dashboard showed $149.23 in free credits and $0 outstanding, with delayed usage reporting.
- The frozen plan allowed at most seven requests and estimated at most $0.852992 under a $1 test budget. The final clarification call was skipped.
- Source remained `b17059557a4ea6321dd91f66ff38943755f4e519`; all 47 frozen suite files remained unchanged. No prompt or example tuning occurred after freeze.
- Studio Meta calls were paused again at environment revision 23; deployment succeeded. The secret key remains stored; this is a Studio gate, not account-wide key revocation. The Site remains private.
- The 573,056 comparisons test these compiled rule sets across integer ages 0–120, all 32 boolean combinations and boundary-derived UTC intervals, including one-millisecond neighbors. They are not 573,056 independently sampled natural-language policies.
- Repairs were guided by server-derived target rules. Unsafe rewrites were deliberately authored challenges. The editors were simulated roles, not two human participants.

[Machine-readable summary](suite-summary.json) · [Frozen plan](suite-plan.json) · [Preflight review](audit/preflight-review.md) · [Post-live bilingual review](audit/post-live-bilingual.md)

Live private rooms: [Lantern Lab](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-2c516632-dc7c-438e-8c67-f2a4b8a539d6#studio-repair) · [Two-window policy](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-cf6521c8-b24b-4752-b420-8934f7551e61#studio-repair)
