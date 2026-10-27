# SamePage demo: a focused change, checked consequences

Use the completed [Lumen Archive room](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-b44de4dc-a522-4f78-bc44-f9f0af96f9f6) for a 60–90 second walkthrough. This is saved evidence from the earlier live evaluation, with a newly polished presentation. Studio model calls are paused. Opening the room, reading its policy and changing preview facts do not call Meta.

## Suggested sequence

1. **0–10 seconds — State the promise.** “Make every eligible scholarship holder’s fee $0. Keep admission, deadlines and everyone else’s fee unchanged.” Point to the selected baseline and protected outcomes. The baseline is an explicit editor choice.
2. **10–30 seconds — Show the real mistake that was caught.** Open the earlier blocked generated proposal. It retained an age restriction on the waiver. SamePage recomputes a realistic example using the saved 20-year-old attendee: the requested fee is $0, but that rejected proposal still charges $21. The proposal could not publish, and its original v2 receipt remained intact. This was an actual model generation error; the separate guardian-consent challenge in history was an authored test input.
3. **30–50 seconds — Inspect the checked repair.** Show the corrected fee and the readable English/Spanish policy. One redundant old fee clause is omitted from the reading view after complete comparison proves identical supported outcomes. Expand the original wording if useful. The view does not alter the approved source text or silently rewrite the policy.
4. **50–70 seconds — Connect agreement to the working form.** Point to both saved editor approvals and form v3. The same saved attendee now previews $0. The existing v2 $21 and v3 $0 receipts preserve identical attendee facts and their respective policy versions. Do not narrate these saved approvals as events occurring during this walkthrough.
5. **70–90 seconds — Let someone try a consequence.** Change an attendee fact in the form and inspect its recomputed preview, or use “Try these facts again” to restore the receipt example. Editing never submits automatically. “Submit test registration” is a separate deliberate action that would save a synthetic receipt; no payment is taken. Stop on the promise: a requested change, its unintended effect caught, a checked agreement, and the resulting form.

The [Orbit Mapping room](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-f796aeb7-8f84-4d82-bd30-a0bf29337606) is a second saved example: its 16-year-old receipt attendee changes from $14 under v2 to $0 under v3. Both outcomes are recomputed from the actual rules before that attendee is used as the presentation example. Use one room for the short demo and keep the other available for questions.

## What this polish establishes

The updated source passes 169 mechanical tests and TypeScript checking. Fee simplification fails closed when complete verification cannot finish. It preserves the whole admission AST and live lower-priority clauses that still affect anyone. The renderer uses localized, explicit conditions and first-match USD fees without reusing model-supplied labels. The preferred-example selector preserves the discrepancy direction and repair scope, and retains necessary edge cases when a realistic substitute cannot reproduce the difference. Initial form seeding does not overwrite subsequent edits.

No additional Meta requests were made for this update. Future generation now receives equivalent simplified target rules and a prompt to avoid redundant fee wording, but that changed prompt has not been live retested. The production build passed and private deployment succeeded from Sites source commit `def141d7b93f12709db9b264d104584303ff4bf4`. Hosted browser verification confirmed the cleaned fee list, realistic attendee, $0 form preview and preserved $21/$0 receipts. A controlled local browser test also confirmed that an edited intent disables approval, one vote holds the old version, and two votes publish the new version. Studio calls remain paused at environment revision 19.

This demo checks supported parsed rules, not arbitrary natural-language truth. It supports integer ages, five independent attendee flags, explicit UTC times and ordered fixed USD fees. Alice and Bob are simulated editors, not independently authenticated accounts. It does not implement real payments, capacities or unrestricted policy repair, and these tests do not establish general bilingual accuracy or a competition result.

The [automatic repair report](AUTOMATIC-REPAIR.md) retains the original six-call results, including the failed generation, known-case retry, fresh Orbit continuation, cost estimates and frozen evidence. The presentation update does not replace or relabel that evidence.

## Verification records

- [Build, deployment and browser checks](evidence/demo-polish/verification.json)
- [169-test output](evidence/demo-polish/tests.txt)
- [Deployed demo screenshot](evidence/demo-polish/polished-live-demo.jpg)
