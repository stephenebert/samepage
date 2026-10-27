# Independent repair holdout — 26 October 2026

This synthetic corpus was authored independently by the `repair_holdout` agent before seeing the repair implementation or any live repair output. It contains no real people or registrations. No external model calls were made to create it. It is an engineering test, not human bilingual validation or evidence of a probability of winning a competition.

`provider-inputs.json` contains exactly two equivalent English/Spanish baseline policies, a bounded fee-change intent, and a supplied bilingual rewrite to check. It contains no golden rules or expected verdict. Only the selected case's source text, intent and appropriate rewrite should be sent to the model. Do not send the goldens, manual outcomes, oracle, failure descriptions or README as prompt context.

`goldens.json` is evaluation-only. Each case has independently authored baseline rules, desired repaired rules, and the rules matching its supplied rewrite. There are 28 hand-specified attendees per case, each with literal baseline/repaired/rewrite decisions, for 168 concrete phase checks. The expected repair prepends the requested fee override; redundant older overrides may be removed by a proposed repair as long as all outcomes remain equivalent.

- **Lumen Archive:** scholarship registration should become free at every eligible age. The supplied rewrite also excuses scholarship minors from guardian consent. The checker must reject that unrelated admission expansion. Case `a02` is a concrete witness; `a07` demonstrates the intended fee repair.
- **Orbit Atlas:** member registration should become free. The supplied rewrite also lowers the early nonmember student rate from $12 to $9. The checker must reject that unrelated fee change. Case `b08` is a concrete witness; `b03` demonstrates the intended fee repair.

The supplied rewrites are authored challenge inputs, not claims that Meta spontaneously made these mistakes. The provider should faithfully interpret them and the impact checker should block publication. Automatic repair requests should independently generate a proposal from the original baseline and intent; they must not receive the supplied rewrite or expected rules as a suggested answer.

`independent-oracle.mjs` directly implements each source policy with ordinary branching. It imports no application modules. A separate generic AST evaluator compares returned rules against this source oracle. It exhausts ages 0–120 and all 32 boolean combinations over exact/adjacent milliseconds at every source and returned-rule time boundary, including the extreme supported years. Unexpected returned time thresholds are added to the oracle grid. It fails rather than reporting success above its bounded case limit.

Run the read-only local check with:

```sh
node verify-oracle.mjs
```

The frozen gold rules agree with all 168 manual outcomes and 151,008 independent oracle decisions. `author-corpus.mjs` records corpus construction; it uses exclusive file creation and is not a live runner. `SHA256SUMS` freezes all inputs and checker code after those internal checks passed. Freeze the root evaluation plan separately before the first live request.

Suggested live budget: two cases × (one baseline interpretation, one supplied rewrite check, one generated repair) = at most six Meta requests, no automatic retries, within the parent's separately checked conservative estimate. Stop on failed baseline fidelity or unexpected publication. Keep rejected proposals unapproved; only a fully passing fresh proposal may receive both simulated editor votes. Old receipts must survive publication.
