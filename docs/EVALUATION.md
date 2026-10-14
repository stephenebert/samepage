# SamePage evaluation notes

Snapshot date: 14 October 2026. This summary records completed feasibility work; it is not a new evaluation or a claim of human validation.

## Live prototype exercise

A private hosted room was operated with simulated English-speaking Alice and Spanish-speaking Bob in separate browser clients. Three manually relayed jobs exercised equivalent times, a refund-boundary conflict, shared voting, and preservation of stale drafts. Shared persistence and the voting/version flow were exercised live. Two simulated personas are not two independent human participants. The observed 68–101 second relay intervals included operator work and do not measure direct API latency.

## Harder unseen cases

Six fresh Fable 5.1 High responses covered 14 synthetic cases and 24 proposals: 12 main cases plus two architecture diagnostics. Inputs, prompts, and private expectations were fixed before model responses; the 33 recorded artifact hashes were unchanged afterward. Raw responses were accepted without repair or regeneration by the production parser and reducer in a local fixture evaluation.

All 122 exercised boolean mechanical checks passed. They checked state transitions, joint voting, stale drafts, atomic validation, exact preservation of unaffected sections, and duplicate/outdated completion. Mechanical success is separate from semantic correctness.

An independent AI review found the expected status in all 11 clear-contract cases. Ten had clean reviewed bilingual facts and explanations. One refund example correctly found a policy difference but overstated an implication: “refundable upon request” does not strictly entail that no unsolicited refund can ever occur. This is a narrow observed result, not a general accuracy rate. The evaluator also authored the expectations, so this was not blinded human bilingual review.

Two additional cases produced useful compatible merges: vegetarian lunches plus live captions, and a changed street number plus a separately changed accessible entrance. Both changes survived in both languages. However, these were combined under `agree`, whose current prompt contract describes equivalent whole replacements. The product needs an explicit merge operation and provenance rather than treating independent additions as if both writers proposed the same meaning.

## Demonstrated document-wide failure

One architecture diagnostic added a 4 November registration deadline to the event paragraph while an unchanged section still specified 5 November. The actual local reducer committed the result with no open conflict, leaving contradictory deadlines in both languages. The prompt omitted the unchanged deadline section, so the model could not inspect that contradiction.

Version guards and structural validation worked, but they did not preserve document-wide coherence. Relevant unchanged context and cross-section consistency checks are a required next step.

## What remains untested

- Automatic Meta Model API integration, model quality, latency, cost, and error recovery.
- Independent bilingual human usability and demand.
- Robust deletion semantics and compatible-merge provenance.
- General document-wide consistency, broad language coverage, and production access controls.

The results support a focused next iteration. They do not establish novelty relative to all alternatives, audience excitement, production reliability, or likelihood of winning. Original detailed fixtures and review artifacts remain in the local evaluation archive; personal chat transcripts and chat URLs are intentionally not copied into this repository.
