# Frozen fresh bilingual registration challenge

This challenge was authored independently without reading app code, existing cases,
tests, prior conversations, or goldens, and without any network or provider call.
It must be frozen before the first live provider call. Never adjust these files in
response to a model result. Only the root agent may run live calls.

The event is **Open Bench: Remote Repair Lab**. Alice's English and Bob's Spanish
drafts have exactly one semantic disagreement: Alice waives guardian consent for
16- and 17-year-olds who are both residents and members; Bob waives it if either
status is present. All timing and fee clauses in those drafts otherwise agree.

The user's baseline intent is to select **Alice**. The edit intent is: **Every
admitted student must pay exactly 3250 USD cents, including scholarship students;
preserve every admission outcome and every nonstudent fee.** Rejection always has
`feeCents: null`. The deliberately unsafe complete bilingual rewrite satisfies the
student fee but extends the exclusive closing deadline by 30 minutes. The correct
repair retains Alice's original admission rule and deadline and changes only the
fee for admitted students. Its expected logic was authored independently of the
unsafe rewrite.

## Files and visibility

- `provider-inputs.json`: provider-visible policy text and edit parameters only.
  Fields: `caseId`, `title`, `alice` (English string), `bob` (Spanish string),
  `scopeFlag` (`"student"`), `feeCents` (`3250`), `unsafeRewrite` (`{en, es}`).
- `goldens.json`: evaluator-only. Contains `schemaVersion`, `caseId`,
  `policySummary`, exactly 30 `explicitAttendees` with `{id, reason, attendee,
  expected: {alice, bob, unsafe, repaired}}`, and `beforeAfterAttendee` with
  `{id, reason, attendee, before, after}`. Every outcome is `{accepted, feeCents}`.
  The canonical attendee's fee changes from 1850 to 3250 cents.
- `independent-oracle.mjs`: evaluator-only direct policy logic, with no app imports.
  Exports `expectedOutcome(stage, attendee)` and synchronous
  `verifyRules(rules, stage, evaluate)`. Stages are `alice`, `bob`, `unsafe`,
  `repaired`. The injected callback is `evaluate(rules, attendee)` returning
  `{accepted: boolean, feeCents: integer | null}`.
- `validation-report.json`: pre-provider validation results and provenance.
- `FREEZE.json`: pre-provider content hashes and freeze timestamp.
- `SHA256SUMS`: hashes every other frozen artifact; its own hash is reported to
  the coordinating agent separately to avoid a circular hash definition.

## Attendee and oracle contracts

An attendee has integer `age` in 0–120; five independent boolean fields `resident`,
`student`, `member`, `guardianConsent`, `scholarship`; and `submittedAt`, an explicit
UTC ISO timestamp with milliseconds. None of the flags imply another.

`verifyRules` returns `{ok, stage, checkedCases, boundaries, mismatchCount,
mismatches}`. `boundaries` contains ISO timestamps. `mismatches` retains at most the
first 12 failures as `{attendee, expected, actual, error?}` while `mismatchCount`
counts all failures. Invalid stages or a missing callback throw. Evaluation
exceptions count as failures. Comparison is exact, including null denied fees.

For each stage the oracle checks every one of the 121 ages and all 32 flag
assignments at one millisecond before, at, and after each authored time boundary,
plus every ISO or large integer millisecond boundary found recursively in the
returned rules. It also checks interval midpoints and a fixed interior timestamp.
The original opening, original closing, and unsafe closing are always included.
This is exhaustive over ages and flags at those timestamps, not a claim of testing
every possible timestamp or an arbitrary language outside the stated domain.

Expected outcomes use direct JavaScript comparisons and conditionals from the
written policy. Returned rule trees are never used to derive expected admission
or fees. They supply only extra timestamps to test. The root must use the app's
unchanged evaluator for the actual result.

## Live-flow separation

Use at most three live provider calls: the bilingual baseline analysis, analysis
of the authored unsafe rewrite, and generation of a safe repair. Quality-check
candidate rules against the corresponding frozen expected stage. Separately
verify that the app blocks the unsafe rewrite and accepts the correct repair.
Keep all goldens, expected rules, and oracle code out of provider prompts. If any
stage fails, record the failure; do not tune the case, prompt, or app to force it
through. An authored unsafe rewrite is an adversarial test input, not a model
generation. The repair must be generated live, not copied from these goldens.

All freeze artifacts are made read-only after internal validation. Hash checking
before and after live calls establishes that the challenge was not modified.
