# Automatic consequence discovery

SamePage now searches the two executable policy interpretations for an attendee whose acceptance outcome differs. The operator does not supply an attendee to the search. A fresh review automatically loads a discovered example into the comparison. When each policy accepts someone the other rejects, both directions are shown.

The model still proposes the structured interpretation through the manual agent relay. Discovery itself is deterministic and immediate after that response is validated. It does not call a model or generate a hypothetical outcome in prose. Every displayed witness is evaluated under both rule objects, and the working registration form evaluates the selected attendee again on the server against the published policy.

## Complete comparison within a bounded domain

The supported domain is whole-year ages 0 through 120, resident/nonresident, and valid four-digit-year UTC timestamps at millisecond precision. The rule model remains minimum age, optional residency predicate, AND/OR between active eligibility predicates, and a deadline that always applies in addition to eligibility.

An age predicate changes only at its minimum-age threshold. A time predicate changes only at its deadline or one millisecond after it, depending on inclusivity. The search divides age and time into regions where every predicate is constant, combines those regions with the two residency values, and checks one representative per region. With two policies this requires at most 30 combinations. This is a complete comparison of that rule model, not a claim based on randomly sampled attendees.

Ranking chooses readable examples from those regions. It does not reduce the regions checked. The result contains at most two witnesses: one accepted only by Alice's interpretation, and one accepted only by Bob's interpretation. These are illustrative directions, not a count of affected people.

If no counterexample exists, the interface reports the same outcomes **within the supported executable rules**. It does not claim that the original language is equivalent or was interpreted correctly. Missing, invalid, unsupported, or unresolved interpretations cannot produce an equivalence result.

## Demo flow

1. Submit two complete policies with an age/deadline tradeoff: one lowers the age requirement but closes registration sooner; the other raises the age requirement but leaves registration open longer.
2. Import the fresh, untouched interpretation. SamePage immediately identifies a younger attendee who qualifies only under the first policy.
3. Select the other discovered direction. SamePage identifies an older attendee submitting later who qualifies only under the second policy. Neither policy is simply more permissive overall.
4. Use **Test this attendee in the form**. This transfers the exact age, residency and UTC timestamp without submitting a registration or changing the published policy.
5. Both simulated editors approve the same interpretation, then submit. Inspect the saved result and its policy version.
6. Try equivalent negated/redundant phrasing, and unsupported exceptions. The former should not invent a conflict; the latter should remain unresolved.

The interface preserves millisecond timestamps through discovery, comparison, transfer and saved receipts. A custom comparison attendee remains stable during ordinary polling and votes. A new review invalidates the previous discovery selection.

## 20 October 2026 evaluation

The [frozen archive](../tests/semantic/2026-10-20-discovery/) contains cases, expectations, exact production prompts, untouched model responses, before/after room snapshots, hashes, recorded results, and the mechanical-test log. The cases SHA-256 is `7a1fdebd60bb1516253cd4e09ac0df6b5bac9b54edfbb9183353d6af67002276`.

A separate agent authored eight pairs and their expectations before interpretation. One isolated Codex interpreter received all eight production prompts without implementation, expected outputs, previous responses, or discovery results. It produced one raw response per pair; the production parser accepted each unchanged. No Fable or Claude was used. The corpus author was separate from the interpreter and implementation. The corpus author also performed the semantic audit, so that review was not independent of the frozen ground truth. This remains an AI-assisted synthetic evaluation, not independent bilingual human review or eight independent model runs.

| Frozen case | Observed result |
| --- | --- |
| Crossed age and deadline | Two witnesses: age 23 at the earlier cutoff qualifies only under Alice; age 25 at the later cutoff qualifies only under Bob. |
| Negated disqualification | Correctly distinguishes age OR residency from age AND residency, with the different age thresholds preserved. |
| Subsecond cutoff | Finds the exact `2027-07-09T12:00:00.375Z` instant separating strict and inclusive deadlines. |
| De Morgan phrasing with redundant condition | Same decisions throughout the supported rules; no invented conflict. |
| Optional residency versus residency as a bypass | Finds a younger resident accepted only by the interpretation where residency is an alternative qualification. |
| Unsupported conditional exceptions | Both drafts remain unresolved, with no partial extraction or equivalence claim. |
| Ambiguous date and unspecified time zone | The ambiguous draft remains unresolved even though the other draft is explicit. |
| No deadline versus a cutoff | Finds an attendee one millisecond after the cutoff; the unrestricted interpretation still accepts. |

Across 16 drafts, 13 executable interpretations and three null interpretations matched expected semantics. The 31 fixed scenario rows produced **62 per-interpretation checks: 53 boolean decisions and nine abstentions**, all matching. Discovery found **six witnesses across five differing pairs**, reported one equivalent pair within the supported rule model, and held two unresolved pairs. The evaluation oracle separately verified each discovered witness against both interpreted rules. The server then evaluated each witness under one jointly selected interpretation, saving **six verified registration receipts**; this does not mean both policies were published for every witness.

The [independent audit](../tests/semantic/2026-10-20-discovery/independent-review.md) found no blocking extraction, translation, witness-direction or precision errors. The reviewer derived formulas directly from the source prose without importing application code, checked all 16 source-language fields and translations, verified the six selected-policy receipts (one accepted and five rejected), and retrieved all eight server rooms to compare with the after snapshots. The reviewer did not restart the server. The audit distinguishes these observations from general correctness and notes that its author also wrote the frozen corpus.

All **53 mechanical tests passed**: 25 document-state tests, 18 registration-policy tests, and 10 discovery tests. The discovery suite covers every age threshold, millisecond boundaries, inactive predicates, domain limits, null/invalid inputs, output determinism and symmetry, and **1,500 seeded rule-pair checks** against a separately implemented oracle. TypeScript checking passed. These are code checks, not 1,500 natural-language policy trials.

The local browser exercise used two simulated editors in separate Chrome tabs. It exercised both discovered directions of the age/deadline tradeoff and saved the resulting registrations. A separate subsecond case preserved `.375` precision through the displayed witness, transfer into the working form, and saved receipt. Bob's activity synchronized into Alice's tab without resetting her custom preview.

The production build passed and Sites commit `6f170d65286f585a8092183d6d8715d5bf13d546` was deployed with owner-only access preserved. The [prepared private demo](https://samepage-language-lab.ampleboar17.chatgpt.site/consequences?room=consequence-160b9695-6fb0-44fb-87f0-c5f8d7c035f4) replays the audited crossed-age/deadline response against an exactly matching prompt. This is deployment verification, not an additional fresh semantic test. Two Chrome tabs confirmed the same policy; the discovered attendee changed from a saved v1 rejection to a saved v2 acceptance, while historical receipts retained their versions. See [browser and deployment verification](../tests/semantic/2026-10-20-discovery/browser-verification.md).

The strongest demonstration is the second discovered direction: neither policy is simply stricter. The remaining presentation gap is the manual model relay and the amount of interface between fresh prose and a visible result. The next priority is one seamless model-connected loop from fresh drafts to discovered consequences, joint approval and the working form. This assessment does not predict a competition placement.

The archive retains raw discovery durations as diagnostic observations only. They are single local calls, not a controlled performance benchmark or model/API latency measurement.

## Repeat without overwriting the archive

From the repository root, start the local app and choose a new absolute directory whose parent already exists. The harness refuses directories inside this frozen archive, existing directories in `prepare` mode, and already-applied directories in `apply` mode.

```sh
SAMEPAGE_EVAL_RUN_DIR=/tmp/samepage-discovery-new-run \
  node --experimental-strip-types tests/semantic/2026-10-20-discovery/run-evaluation.mjs prepare
```

Give only each new `.prompt.txt` to an isolated interpreter and save the untouched responses as the corresponding `.response.json` files in that new run directory. Then:

```sh
SAMEPAGE_EVAL_RUN_DIR=/tmp/samepage-discovery-new-run \
  node --experimental-strip-types tests/semantic/2026-10-20-discovery/run-evaluation.mjs apply
```

Set `SAMEPAGE_TEST_URL` only when the app runs on a different local URL. Preparation creates synthetic test rooms; application publishes selected interpretations and saves synthetic registrations in those rooms. The repository copy of the harness checks frozen-case, expectation-file and prepared-prompt hashes, imports the current discovery engine from this repository, and writes new evidence exclusively to the explicit run directory. Replaying existing model responses would be a regression replay, not fresh semantic evidence. The original archived run used the earlier harness; its independent audit supplied the expectation-file and prompt-hash checks that the runnable repository copy now performs itself.

## Limits

The quality of the extracted rules remains a model-dependent step. An exhaustive search of incorrectly extracted rules can be confidently wrong about the original policy. The UI exposes both source-language versions and executable rules for inspection, and publication still requires two matching approvals.

No model-provider latency or cost, real population impact, independent bilingual-user benefit, or competition-placement claim follows from these tests. The private simulated-editor access model remains unchanged.
