# Consequences experiment — 20 October 2026

The tested source was deployed privately from Sites commit `6b319b677c8f4bb0e272048b3f0146a77cce90a5`. TypeScript and the production build passed, as did 43 reducer tests: 25 existing document tests and 18 new policy/registration tests.

## Fresh semantic evaluation

An independent agent wrote six paired English/Spanish full-policy drafts and expected results before the interpreter saw them. The frozen case file SHA-256 is `361d18ba33f8a9a5491445c59842213b1dd382ee37015a634783d77c586c28c7`.

One fresh agent, with no inherited conversation, read only the six app-generated prompt files and produced six JSON responses. It did not see expectations, application source, or evaluation results. This was six responses from one interpreter, not six independent interpreters. Responses were imported unchanged through the production parser and live local D1 API.

- 12 source-preserving candidate interpretations: 10 executable rule sets and two unresolved policies.
- 50 matched scenario outcomes: 44 boolean decisions and six unresolved outcomes.
- 25 saved registration decisions matched the expected outcomes. Retries preserved one record per request ID.
- Guarantor exceptions and an unspecified local time zone were correctly held.
- Tests included changed age thresholds and dates, AND/OR, De Morgan negation, and inclusive/exclusive boundaries.

The initial harness used the production evaluator. A separate reviewer then recomputed outcomes without importing that evaluator and verified all 25 persisted records by fresh GET requests. Raw responses and the independent review are in `tests/semantic/2026-10-20-consequences/`.

## Supplemental mechanics and browser test

Five simultaneous registration requests retained five unique records. Stale approvals and a stale interpretation were rejected after an edit; the published policy remained unchanged. The original document API rejected the new room schema.

The six-case form harness selected Bob's candidate in each case. A supplemental replay selected Alice's C-03 candidate using the unchanged raw response and a byte-identical prompt: both editors approved her exclusive cutoff; exactly 09:00 was rejected, while 08:59:59 was accepted. These two extra records are mechanical replay evidence, not another fresh interpretation.

For the visual test, a seventh fresh response interpreted drafts entered through separate Alice and Bob Chrome tabs. A 17-year-old nonresident was rejected by the published AND policy at version 1. One vote and then mismatched votes held version 1. Two matching approvals published the OR policy at version 2; the same attendee was then accepted. Both language views updated and the old receipt stayed at version 1. Changing the comparison attendee to a 15-year-old resident preserved the AND/OR distinction; a 15-year-old nonresident was rejected by both.

## Limits and next decision

This is a narrow feasibility demonstration. The model still runs through manual relay, so the test does not establish Meta model quality, end-to-end model latency, cost, or reliability. Two simulated personas are not a study with independent bilingual users. The app is owner-private and does not implement separate user identity or room membership.

Clarification explanations currently use English strings, although candidate policy text is bilingual. Case C-02's send/receipt wording assumes one electronic submission timestamp; it does not prove equivalence when transit delay matters. Browser automation could not fill the native datetime-local field; exact deadline boundaries were verified through the live HTTP registration endpoint and an independent oracle. No mobile browser test was performed.

The strongest moment is the same attendee moving from a saved rejection to a saved acceptance only after shared agreement. This provides a concrete reason to understand the wording. It does not establish first-place potential by itself. The next useful test is an automatic Meta API connection followed by independent bilingual participants attempting unseen policy changes, compared with ordinary translated text and explicit form settings.
