# Independent frozen bilingual registration holdouts

This directory contains two freshly authored policies for fictional, entirely online creative events. The author read only the supported types and engine in `samepage-live/lib/studio-types.ts` and `samepage-live/lib/studio-engine.ts` to understand the domain. No earlier holdout corpora, compiler responses, deployment state, API credentials, or external provider calls were used.

## Files and separation

- `provider-inputs.json`: the only file to supply to the interpretation provider. Each `pairs[]` entry has an opaque event `id`, English `en`, and Spanish `es`. Map `en` to editor `alice` and `es` to editor `bob`. Do not include any other file in a provider request.
- `goldens.json`: independent expected rules and unresolved results, with the domain and explicit reasons for the expected differences. These are private evaluator answers.
- `boundary-cases.json`: 38 hand-specified applicant cases for the executable pair, with two expected decisions per applicant. Expectations were not generated from the golden AST.
- `independent-oracle.mjs`: a direct source-level admission/fee implementation, a separate generic AST evaluator, exhaustive partition checks, and an exported `checkCandidate(editor, rules)` for evaluating future compiler results.
- `oracle-verification.json`: the successful pre-freeze oracle verification report.
- `SHA256SUMS`: SHA-256 hashes for all six data, code, and documentation files in this directory. This manifest is the freeze marker and deliberately does not hash itself.

The provider text contains only the event policies. It does not state expected equivalence, expected executable structures, ambiguity diagnoses, example outcomes, or evaluator instructions.

## Policy expectations

`nightjar-online-sound-jam` is executable and non-equivalent. It combines nested negation, a limited exception to a resident/member gate, integer age thresholds, an exact registration window, an exact early-rate cutoff, and ordered overlapping fee overrides. The English exception negates a conjunction; the Spanish exception negates a disjunction. English excludes the closing instant while Spanish includes it. Member and early-student fee priority also differs. The source explicitly specifies that the exception does not waive the other eligibility requirements and that fee rules run only after admission.

`pixel-loom-online-mini-course` requires clarification in both languages. The fee paragraphs specify member and student rates, allow only one rate, and provide no tie-breaking rule when both statuses apply. Both expected `rules` values are `null`. An admitted overlap witness and its two supported prices are stored only in the private golden file. An interpreter must not infer ordered first-match semantics merely from prose order where the source did not establish it.

## Coverage and use

Run `node independent-oracle.mjs` to check the hand-specified cases and frozen ASTs. On this host, the bundled Node executable is `/Users/steph/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`. The script writes JSON to stdout and does not modify any file. To verify the freeze, run `shasum -a 256 -c SHA256SUMS` from this directory.

The independent executable oracle enumerates all 121 integer ages, all 32 independent assignments of the five flags, and 11 representative UTC millisecond instants. The temporal representatives include the exact opening, early-rate, and closing boundaries, each adjacent millisecond, and both endpoints of the supported year range. Together these represent every interval on which the source predicates are constant: 42,592 applicants and 85,184 policy decisions. `checkCandidate` additionally includes boundaries introduced by a candidate AST, so a compiler-added time condition cannot hide between source boundaries. All ages are enumerated, so compiler-added age thresholds are likewise covered.

Fee values are integer USD cents. Rejection always has `feeCents: null`. Different AST syntax with the same complete behavior is acceptable; label wording is not a semantic failure. The ambiguous pair must remain unresolved until fee precedence is clarified.

All files were finalized and verified before creation of `SHA256SUMS`. Treat this directory as read-only after the freeze; place provider outputs and evaluation results elsewhere.
