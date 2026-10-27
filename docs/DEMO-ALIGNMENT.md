# Demo alignment: one saved request, one attendee

This presentation update fixes the two issues found during the [fresh unseen policy evaluation](FRESH-UNSEEN.md). The baseline selector follows a remotely received repair without clearing its restored selection. The intended-effect card and receipt comparison now choose the same attendee and recompute that person's exact outcomes, including fee increases.

## What changed

- **Baseline synchronization:** restoration and stale-selection invalidation are reconciled in one decision. An untouched editor follows the saved repair's baseline. Deliberate local changes remain intact and prevent approval until the editor restores the checked request or obtains a new check. An obsolete review cannot restore an older baseline.
- **Shared attendee:** the impact card, initial form example and receipt comparison use one presentation selector. A receipt pair must match the repair's exact policy versions and attendee facts, and its stored outcomes must match the recomputed selected baseline and repair. This matters when the selected baseline differs from the previously published interpretation. Unrelated receipts cannot replace the current repair's story. Blocked-consequence examples retain their existing direction and scope safeguards.

In the Open Bench case, both panels now show the same **17-year-old resident, member and student**, without guardian consent, applying at **2027-02-16 12:00 UTC**. The requested exact student fee changes this attendee's charge from **$18.50 to $32.50**. This is an intentional increase, not a discount. The prior impact card showed a different student's valid fee decrease, which made the story harder to follow.

## Checks completed

The updated source passes **180 mechanical tests**, TypeScript checking and the production build. New regression coverage includes a remotely arriving baseline, preserved local choices, stale reviews, opposite fee-change directions, unrelated receipt versions, mismatched outcomes and facts, and preservation of the saved evidence.

Two separate Chrome editor views exercised an isolated local database using frozen pre-review and ready-repair states from the prior evaluation:

1. Alice started with an empty baseline selector; the incoming checked repair selected Alice's saved baseline without a reload.
2. Bob's unsaved choice of Bob's baseline, **$12.34** fee and locally edited form age **29** survived the same incoming state. Bob could not approve until restoring the checked request.
3. Clicking Alice's approval held the working form at **v2**. Clicking Bob's matching approval published **v3**.
4. The shared 17-year-old attendee loaded into the form. A deliberate local submission saved a **$32.50 v3** receipt while the original **$18.50 v2** receipt remained intact. The impact card and receipt comparison agreed on the same attendee and amounts.

This was a presentation regression replay with controlled saved responses, not another live interpretation run. **No new Meta or other model-provider calls were made.** Polling does not overwrite locally edited form facts; the attendee-transfer button is an explicit action.

## Deployment and hosted verification

Deployed source `b17059557a4ea6321dd91f66ff38943755f4e519` as Site version 17. Deployment `appgdep_6ae043d97b0881919915d679a6f3f668` succeeded with environment revision 21; Studio model calls remain paused and the audience remains owner-private.

Both hosted Chrome editor views show Alice’s saved baseline, the same 17-year-old attendee in the intended-effect card and initial form, and matching **$18.50 → $32.50** receipts. The live room still has exactly two receipts and published policy v3; no hosted policy or receipt was changed during browser verification. [Open the demo](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-6c297563-ae78-496c-95aa-05a39399f076#studio-repair).

[Verification metadata and browser evidence](../tests/presentation/2026-10-26-demo-alignment/) include the local sync observations and hosted screenshot. The source helper packaged the successful declared build; its npm wrapper was unavailable in this environment, so the same build script ran directly with the bundled Node runtime.

The original [fresh live archive](../tests/semantic/2026-10-26-fresh-unseen/) remains unchanged, including its three Meta calls, exact outputs, initial UI findings, audit and cost estimate. This update does not reclassify that run or establish new model-accuracy evidence. The supported policy domain and simulated-editor limitations still apply.
