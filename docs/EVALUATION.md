# SamePage evaluation notes

## 20 October 2026: document consistency and merge iteration

The current build uses independent Codex-agent responses through a manual relay. No Fable or Claude was used for this iteration. The operator copied exact production prompts and applied untouched raw JSON. Model-generated semantics remain fallible; these are synthetic tests with AI review, not independent human bilingual validation.

### Fixed contract

Each review snapshots all six sections and their content versions. The model classifies equivalent proposals separately from compatible merges, attributes each submitted edit, and treats blank replacement text as a deliberate deletion. The parser validates coverage, source text, IDs, grounded quotations and response structure. It cannot prove that a model's semantic judgment is true.

A blocked or uncertain whole-document review holds every potential commit in the batch. Matching conflict votes queue a new review of the exact selected candidate; they do not commit directly. Corrections replace only the correcting editor's unresolved intent and preserve the other editor's proposal for review. A jointly rejected alternative is not resurrected after the selected candidate fails document review.

### Frozen semantic cases

Seven cases, thirteen proposals, and eight fresh responses (including the post-vote review) were exercised:

| Case | Observed outcome |
| --- | --- |
| Event summary says Nov 4, unchanged deadline says Nov 5 | Whole batch held with grounded contradictory passages |
| Alice changes address; Bob changes entrance | Explicit merge preserves 20 Oak Street and east entrance, with both contributors |
| Alice removes accessibility statement; Bob changes address | Explicit merge preserves new address and deliberate removal |
| Removal versus concurrent modification of accessibility statement | Conflict; removal is not misrepresented as lack of access |
| Event summary and deadline both move to Nov 4 | Both sections commit together in both languages |
| Conflicting Nov 4/Nov 6 proposals, then both choose Nov 4 | Initial conflict; matching votes preserve text; fresh review blocks Nov 4 against unchanged Nov 5 |
| Event start shifts to 17:00, refund cutoff remains Nov 6 at 16:00 | Whole batch held; 16:30 on Nov 6 is 24.5 hours before the event yet excluded by the stated cutoff |

All seven cases and the additional selected-candidate review passed the exercised checks. After the correction-flow fix, all eight original raw responses were replayed unchanged against the updated reducer and passed again; this replay is not eight additional model samples. Frozen prompts stayed byte-identical. Inputs and expected outcomes were written before the fresh responses; response-generating agents were given only production prompts.

### Browser exercise and mechanics

Two separate browser tabs operated fictional Alice and Bob against a real locally persisted room. Three fresh responses exercised the 20/east merge, conflicting registration dates with a concrete witness, and a fresh review that blocked the jointly selected date. Both clients displayed the same committed merge and preserved the original event paragraph after the contradiction. Saved-proposal recovery and withdrawal preserving a newer unsent draft were also exercised through the UI.

The 25 reducer tests pass. They include stale context rejection, atomic parser rejection, deletion semantics, legacy review recovery, matching-vote locking, and a regression proving one editor cannot discard the other's unresolved proposal by correcting a conflict. The live relay times include operator time and are not API performance measurements.

An independent AI code/semantic review identified correction-flow and in-flight-draft preservation defects during this iteration. Both were fixed before publication. The semantic cases support this narrow implementation; they do not establish general reliability, product novelty, or a probability of winning a competition.

Detailed frozen fixtures, raw responses, hashes, and reviewer notes remain in the local `samepage-v2-evidence` archive. The repository includes summarized technical evidence, not personal model-chat transcripts or runtime databases.

### Still untested / unfinished

- Automatic Meta Model API integration, provider-specific model quality, latency, cost and failure recovery.
- Independent bilingual human usability, demand and unscripted collaboration.
- Broad document types, more than six sections, additional languages, and general semantic correctness.
- Independent editor authentication and room authorization. The hosted Site remains owner-private; Alice and Bob are simulated roles.


## Historical evaluation — 14 October 2026

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
