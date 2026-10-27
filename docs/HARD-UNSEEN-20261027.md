# Harder unseen evaluation — 27 October 2026

**Finding present:** both fresh full flows passed compiled-rule and approval checks, but generated Spanish in the second policy has an age-scope ambiguity. Fix and retest that wording issue before claiming bilingual reliability.

- Six Meta requests, no incomplete responses, retries, or prompt/example tuning.
- 240 concrete outcomes and 573,056 compiled-rule comparisons passed; both authored unsafe rewrites were blocked.
- Joint approvals published the intended repairs; same-attendee receipts preserved $26 → $18 and $48 → $42.
- Two independent AI reviewers found the Spanish ambiguity after the second synthetic flow published. The app did not catch it; executable rules and the derived reading view are correct. This was not a human bilingual study.
- The final clarification test was not run. Studio calls are paused again at environment revision 23.
- Estimated token cost: $0.09129550, with actual credit deduction unconfirmed. Source unchanged at b17059557a4ea6321dd91f66ff38943755f4e519.

[Full report and limits](../tests/semantic/2026-10-27-hard-unseen/README.md) · [Bilingual finding and counter-reading witness](../tests/semantic/2026-10-27-hard-unseen/audit/post-live-bilingual.md) · [Machine-readable summary](../tests/semantic/2026-10-27-hard-unseen/suite-summary.json)

Run the offline evidence replay with `node tests/semantic/2026-10-27-hard-unseen/verify-archive.mjs`. It checks archive hashes and replays both frozen rule evaluations without provider calls.
