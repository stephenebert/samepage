# Automatic fee repair and impact checking

SamePage can propose a bilingual fee correction, check its effects against a declared intent, and hold publication until both simulated editors approve the exact checked proposal. It can also interpret a complete rewrite supplied by an editor and expose a concrete attendee whose outcome violates that intent. This is a bounded registration-policy workflow, not unrestricted document repair.

## What the editor authorizes

The editor explicitly selects one complete interpretation from the current English/Spanish review as the baseline. SamePage does not decide which person's policy is correct. The supported intent specifies one of the five existing boolean attendee flags and a fixed USD fee from $0 to $10,000 for eligible people with that flag.

For example: eligible scholarship holders pay $0; keep the selected baseline's admission outcomes, deadlines and fees for everyone without a scholarship unchanged. The flags are independent. A scholarship fee waiver does not waive guardian consent, minimum age or a registration deadline.

The baseline is the selected candidate, which can differ from the policy currently driving the published form. The impact comparison is therefore **selected baseline → proposed repair**, not necessarily **current form → proposed repair**. The form continues to use its published version until both approvals are saved.

The server constructs the authorized result directly from the intent: preserve the baseline eligibility expression and existing ordered fees, then prepend the requested group fee as the first override. Existing parser limits remain in force. A baseline already using all 16 fee overrides, or a rule tree that cannot accommodate the added predicate, is rejected before a provider attempt. This version does not repair admission requirements, free-form categories, capacities, household conditions, percentage discounts, payments or external-data rules.

## Two model operations

**Propose repair with Meta** asks Meta to write complete English and Spanish policies that implement the selected fee-only intent. After the initial live scope failure described below, its prompt was strengthened to include the server-derived authorized `targetRules` and state that the selected group's fee has highest priority regardless of age or other fee categories. Those rules come from the actual selected baseline and declared intent, not evaluation answers. Generation is therefore constrained wording generation for an explicit executable target. The model must still interpret what its returned wording actually says, rather than copy the target if the wording differs. This is a complete wording proposal, not a guaranteed minimum textual patch.

**Check my rewrite** accepts complete proposed English and Spanish text. The exact supplied strings must survive the provider response unchanged. The prompt explicitly asks the model to interpret the rewrite as written, including any unwanted change; it must not silently repair the supplied wording to make the check pass.

Each operation uses one structured-output Meta request. That request produces separate `englishRules` and `spanishRules`, interpreting each complete language version. They are separate interpretations within the same model call, not two independent models or a human translation review. The server parses both bounded expression representations and compares their admission/fee outcomes. If either version is incomplete, unsupported or ambiguous, or if the parsed language versions disagree, the proposal remains unresolved. It cannot reach approval.

The expression language is data, never executable model-generated code. The existing tokenizer, parser and rule validator reject unsupported syntax, malformed boundaries, extra fields and excessive complexity. Partial responses are never accepted. Safe completion/usage metadata distinguishes an output-limit stop, refusal and other invalid responses; no automatic retry follows.

## What the impact check establishes

The checker compares the authorized result with the parsed proposed rules. A pass establishes all of the following for those rules:

- Every supported attendee has the same admission outcome as in the selected baseline.
- Eligible attendees with the selected flag receive exactly the requested fee.
- Every fee outside that group is unchanged.

The search covers integer ages 0–120, all 32 combinations of the five independent flags, and explicit UTC millisecond instants in years 0000–9999. It uses representative age and time partitions at every predicate boundary and adjacent value. These partitions cover every distinct outcome of the supported predicates. If the bounded search cannot complete, the result is unresolved rather than an equivalence claim.

Two comparisons are retained. `verification` compares the authorized result with the proposal and supplies unintended-effect witnesses. `changes` compares the selected baseline with the proposal and supplies the visible intended effect. A witness can distinguish the baseline outcome, requested outcome and proposed outcome for the same synthetic person. A proposal that simply omits the requested repair also fails, even if it introduces no additional change.

These checks establish properties of the **parsed rules**, not faithful understanding of arbitrary natural language. Both languages could be misinterpreted consistently in the same model call. Editors must review the complete wording, and separate source-based evaluations are needed to assess model fidelity. Passing a supported-rule check is not proof of translation accuracy or real-world policy correctness.

## Agreement and stale work

Each repair snapshots its intent, selected candidate, exact drafts, review ID and published version. A durable request claim reserves one shared model attempt before invocation. The repair and ordinary interpretation endpoints share the five-attempt room limit; new rooms and other clients are outside that limit, so it is not an account-wide spending cap.

A repair starts with no approvals and clears prior original-candidate votes. Original-policy approval is blocked while a repair is active, ready, blocked or failed. A failed impact check has no publication path. The server recomputes the impact check before accepting either repair vote; a cached pass flag alone is insufficient.

One editor's vote holds the current form unchanged. Both simulated editors must approve the same current repair ID to publish once. A changed saved draft supersedes the repair and clears approvals. A changed baseline, review, published version, expired request lease or replaced request prevents old results from being applied. Replacing a proposal starts a fresh vote set and retains up to six earlier repair snapshots, including blocked checks.

Publication creates a new policy version. Earlier registration receipts preserve their original version, facts and result; loading a witness into the form does not submit a registration. Alice and Bob remain simulated editor roles inside an owner-private prototype, not independently authenticated users.

## Demonstration and evaluation provenance

The demonstration includes an authored rewrite that looks like a convenient fee waiver but also relaxes another requirement. The model interprets that supplied rewrite; the deterministic checker should find the concrete collateral effect and block publication. These challenge rewrites are deliberately authored test inputs. A successful challenge check must not be described as catching a spontaneous mistake made by the model during automatic repair generation. The separate generated failure recorded below is an actual model mistake and must remain distinguished from that authored challenge.

A separate generated-repair step asks Meta to satisfy the same intent. Its output is checked through the same language-equivalence, impact and joint-approval gates. This distinguishes the ability to detect a bad supplied edit from the ability to generate a valid repair.

Mechanical tests cover fee priority, unwanted admission changes, a strict deadline becoming inclusive, fees outside the target group, an omitted requested change, unresolved/search-limit holds, exact rewrite sources, stale work, duplicate approvals, replacement proposals and preserved receipts. Transport fixtures exercise structured output, source/job identity, bilingual disagreement, malformed expressions, incomplete provider replies, shared quotas, disabled mode and durable requests. Fixtures do not constitute live model evidence.

The initial source at Sites commit `a2192649eca69594b25052e780ccba346ee7aa56` passed 155 mechanical tests, TypeScript checking and the production build. After the prompt revision, the final source at `d5c94fdc0fe17b95cbc88691a6b98db45a6ec9e8` passes 156 mechanical tests, TypeScript checking and the production build. The private mirror retains the final source. These build results are separate from the live evaluation below.

## Live evaluation result

The initial run stopped after its third model request. In Lumen Archive, the declared intent was a $0 fee for every eligible scholarship holder. Meta's automatically generated English text, Spanish text and parsed rules instead retained the old restriction to scholarship holders aged 19 or younger. The server's impact check blocked the generated proposal. The published form remained on policy v2, and its existing $21 receipt was unchanged. This was a complete response with a semantic scope mistake, not a truncated response.

The original stopped run is retained unchanged. It had 112 concrete outcome checks: 106 matched and six failed the requested repair intent. Its independent source oracle found 3,212 mismatching outcomes among 77,440 checked cases, all in that incorrectly restricted generated repair. The original run remains `originalRunPassed:false`; correct blocking does not turn an incorrect generation into a successful one. Its first two requests correctly interpreted the baseline and an authored rewrite that waived guardian consent for scholarship holders. The authored unsafe rewrite was also blocked.

The generated-repair prompt was then strengthened with the production-derived target described above; the authored-rewrite interpretation path was left unchanged. A separately frozen continuation used the remaining three requests within the original six-request limit: an explicit retry of the known Lumen failure, then a fresh Orbit Mapping baseline and generated repair. Orbit's authored unsafe rewrite was skipped to preserve the original cap. The Lumen correction is therefore a known-case retest, not fresh unseen evidence.

| Request | HTTP wait | Result |
| --- | ---: | --- |
| Original Lumen baseline | 9.751 s | Correct interpretation |
| Original Lumen authored rewrite | 8.113 s | Consent exception detected; publication blocked |
| Original Lumen generated repair | 5.743 s | Incorrect age-limited waiver; publication blocked |
| Revised Lumen generated repair | 7.641 s | Intent satisfied; jointly published |
| Fresh Orbit baseline | 10.277 s | Correct interpretation |
| Fresh Orbit generated repair | 7.850 s | Intent satisfied; jointly published |

All three continuation requests passed 112 concrete outcome checks and 112,288 independent source-oracle comparisons. Both corrected proposals required two separate simulated-editor approvals. Lumen's same attendee changed from a $21 v2 receipt to a $0 v3 receipt; Orbit's changed from $14 at v2 to $0 at v3. Both original receipts were retained. The generated failure remained in Lumen's repair history, and both attempted approvals of that failed proposal were rejected before the retry.

An independent AI reviewer checked ten generated language instances and the two copied authored-rewrite instances across both phases. The original failed proposal's languages agreed with one another and with its returned rules, but failed the requested intent. The revised proposals preserved admission, deadlines, independent-flag overlaps and fees outside the selected group. This was not a human bilingual study. Minor presentation issues remain: both successful rewrites retain unreachable older fee clauses after the new highest-priority waiver, and some Spanish fee traces append English labels. Explicit first-match ordering makes those redundant clauses semantically harmless, but clearer wording would improve the demo.

All six responses ended with a natural `stop`; none was incomplete. Returned counters total 10,114 prompt tokens and 12,649 completion tokens, giving an uncached token-rate estimate of **$0.06640075**. The conservative combined preflight estimate was **$0.731136**, below the original $1 estimate. Actual billed cost and credit usage are unconfirmed. Each latency is one observation; there is no repeated-run latency distribution or general accuracy claim.

Studio live interpretation and repair calls were paused again after this evaluation. The final source remains `d5c94fdc0fe17b95cbc88691a6b98db45a6ec9e8`; the private deployment retains low reasoning, expression mode, 8,192 completion tokens and disabled candidate reuse. Pausing Studio does not revoke the shared API key or globally disable the older consequences endpoint.

The native deployment confirmed environment revision 19 succeeded with Studio model calls disabled. No extra provider request was used to verify the pause. Hosted Chrome checks inspected both Alice and Bob views of the published Lumen repair, its two receipts and retained failed-proposal history. Separate local controlled browser checks verified that an unsent fee-intent edit disables approval, restoring the checked request reenables it, one approval holds v2, two approvals publish v3, and a blocked rewrite has no approval buttons. The local browser fixtures are not additional live model samples.

Saved completed rooms: [Lumen Archive](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-b44de4dc-a522-4f78-bc44-f9f0af96f9f6) and [Orbit Mapping](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-f796aeb7-8f84-4d82-bd30-a0bf29337606).

## Frozen evidence

The [repair archive](../tests/semantic/2026-10-26-repair/) retains the original stopped run, revised continuation, both evaluator snapshots, frozen source policies and expected outcomes, request ledgers, untouched application responses, independent audits and final shutdown metadata. Expected outcomes were kept separate from provider inputs. The production-derived target included in the revised generation prompt is explicitly recorded.

```sh
node tests/semantic/2026-10-26-repair/verify-archive.mjs
```

The combined verifier checks file hashes, runs the original **failure audit** and the continuation verifier, and requires the failed generation to remain failed and safely blocked. It does not run the original success-only verifier as though that run passed. The original failed stage retains its initial `running` label because the quality check threw; the overall stopped ledger, completed-response metadata and saved blocked state record the actual outcome. No provider request remains running. The verifier performs no network requests or file writes. Local hashes establish archive integrity, not independent remote attestation or billing confirmation.

## Implementation map

- `lib/studio-repair.ts`: strict intent/proposal parsing, authorized result, impact comparisons, snapshots and two-editor publication.
- `lib/studio-repair-model.ts`: bounded model prompt/schema, separate English/Spanish rule parsing and language-outcome equivalence.
- `lib/automatic-studio-repair.ts`: durable provider claim, shared allowance, explicit retry and stale/expired-result protection.
- `app/api/studio/[id]/repair/route.ts`: server repair endpoint; clients cannot provide rules or change model budgets.
- `app/studio/repair-panel.tsx`: intent selection, authored-rewrite check, witnesses, complete wording and approvals.
- `tests/studio-repair.test.mjs`, `tests/studio-repair-integration.test.mjs`: mechanical and controlled-provider verification.

The earlier [expression evaluation](EXPRESSION-INTERPRETATION.md) and [failed latency experiments](LATENCY-DEMO.md) remain separate historical evidence. Their request counts are not counted as repair tests.
