# Grouped bilingual approval and fresh live retest

New approvals publish the exact explicitly grouped English/Spanish wording shown before both votes. It is rendered from the interpreted rules, with original user/model prose retained separately. The UI identifies this distinction: grouping is guaranteed relative to the rules, not the original interpretation. Prompts also require explicit scope; supplied rewrites remain verbatim. Legacy pending/published records and receipts remain unchanged.

The source passed 187 mechanical tests, TypeScript and production build. Two fresh harder policies passed the full flow with simulated Alice/Bob, including unsafe edit blocks, joint approvals and same-attendee receipts of $23 → $21 and $14 → $19. All 240 concrete outcomes and 402,688 compiled-rule oracle comparisons matched. Separate AI reviews found no operative raw or canonical bilingual wording defect. A third policy with a missing fee asked for clarification and blocked both votes.

Seven Meta calls, all natural stops, no retries or frozen-example tuning; estimated token cost $0.10448875, actual credit deduction unconfirmed. Studio calls paused at environment revision 25. Private Site version 18 uses source 212edcda2fc930f37910511d5805c2b317af8acf. These are bounded-domain synthetic tests, not a human study or a general language-reliability guarantee.

[Full report](../tests/semantic/2026-10-27-grouping/README.md) · [Machine summary](../tests/semantic/2026-10-27-grouping/suite-summary.json) · [Harbor audit](../tests/semantic/2026-10-27-grouping/audit/live-a.md) · [Beacon audit](../tests/semantic/2026-10-27-grouping/audit/live-b.md)

Offline replay: `node tests/semantic/2026-10-27-grouping/verify-archive.mjs`. No provider calls. The [previous ambiguity finding](HARD-UNSEEN-20261027.md) remains preserved as historical evidence.
