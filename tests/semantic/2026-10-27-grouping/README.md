# Grouping fix and fresh live evaluation — 27 October 2026

**All three fresh tests passed within the supported policy domain.** The change fixes how newly approved policies express grouping. Two harder policies completed the full workflow with simulated Alice/Bob roles; a third, incomplete policy correctly required clarification. No source changes, retries, or example tuning occurred after the run was frozen.

## What changed

New reviews and repairs show the exact explicitly grouped English and Spanish text that will be published after both approvals. That text is rendered deterministically from the interpreted rules. Exact user/model prose remains available as `originalWording`; the UI explains that correct grouping does not prove faithful interpretation of the source.

Model prompts also require explicit scope through parentheses, nested alternatives or repeated shared qualifiers. Supplied editor rewrites remain verbatim so a dangerous change cannot be silently repaired before checking. Previously saved pending/published records and receipts are not retroactively rewritten.

The source passed **187 mechanical tests**, TypeScript checking and a production build. Seven new regression tests cover the previously observed Spanish ambiguity, exact publication, original-text preservation, blocked unsafe changes, unresolved policies and legacy behavior. Local UI verification confirmed that one approval holds the form and two publish the grouped text.

## Fresh live results

| Challenge | Result | Same-attendee receipts |
| --- | --- | --- |
| Harbor Archive: youth/adult routes, nested negation, late consent exception, millisecond boundaries and overlapping fees | Detected the original disagreement; blocked dropped consent; generated repair passed; both editors approved | $23 → $21 |
| Beacon Commons: age 21 across alternatives, narrower youth route, nonresident cutoff, priority fee increase | Detected the deadline disagreement; blocked an unrelated $27 → $31 fee change; generated repair passed; both editors approved | $14 → $19 |
| Cobalt Reading Room: scholarship fee amount unspecified | Both interpretations asked for the exact amount and returned no rules; both publication attempts blocked | Existing form unchanged |

All **240 concrete expected outcomes and 402,688 independent-oracle comparisons passed**, with zero recorded mismatches. These comparisons cover the two policies' compiled rules across ages 0–120, 32 boolean combinations and source/returned UTC boundary partitions, including one-millisecond neighbors. They are not independent natural-language policy samples.

Separate AI reviews found no operative defect in either raw bilingual translation, generated repair, or canonical publication. The age-scope witnesses A12 and B14 remain rejected by both the actual wording and the rules. Published v2/v3 text matches the exact grouped preview, original wording is retained, and all four versioned receipts remain intact. These were AI reviews, not human bilingual testing.

## Credits and limits

Seven Meta calls used 15,455 prompt tokens and 20,040 completion tokens. Estimated token cost is **$0.10448875** at the [standard pricing rates](https://dev.meta.ai/docs/pricing-rate-limits); actual credit deduction is unconfirmed. The last successful billing observation showed $149.23 in credits and $0 outstanding; the later refresh stayed on its loading state. The frozen plan allowed seven calls with a conservative maximum estimate of $0.852992, below the $1 test budget.

All seven responses ended naturally, with no incomplete replies or retries. HTTP waits were 24.366 / 13.671 / 14.248 seconds for Harbor, 19.384 / 8.715 / 9.548 for Beacon, and 6.480 for clarification. This run makes no latency improvement claim.

Private Site version 18 contains source commit `212edcda2fc930f37910511d5805c2b317af8acf`. Studio Meta calls were paused again at environment revision 25, with deployment confirmed successful. The secret key remains stored; the gate is specific to Studio.

This supports using the repaired version for the bounded demo. It does not establish general natural-language reliability: Meta still interprets the original source, repairs are guided by server-derived target rules, and the editors were simulated roles. The previous failure archive remains unchanged.

[Machine-readable summary](suite-summary.json) · [Frozen plan](suite-plan.json) · [Harbor bilingual audit](audit/live-a.md) · [Beacon bilingual audit](audit/live-b.md)

Private live rooms: [Harbor Archive](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-7c79c128-c2f8-4878-b5b4-5497eb5bbfc8#studio-repair) · [Beacon Commons](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-571e0bcf-4279-4d1a-bae6-ed98834e77d9#studio-repair) · [Clarification](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-4a09ba63-51bd-4a19-8ff7-8141e002c8a3)
