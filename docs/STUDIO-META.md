# Meta integration in the policy studio

The studio separates three responsibilities:

- Meta interprets each editor's saved policy independently and translates it. Ambiguous, missing or unsupported requirements must return clarification issues and no executable rules.
- The deterministic engine compares the interpreted rules and finds concrete differences in admission or USD fees within its supported domain. It does not prove that the model understood the source correctly.
- Two simulated editor roles review the interpretations and must approve the same one before the registration form changes. Model output cannot cast votes.

## Current verification boundary

Four fresh hosted Meta `muse-spark-1.3` reviews completed on October 26: all 120 concrete candidate/outcome checks and four unresolved checks matched the frozen expectations. The correction changed a synthetic receipt from $17.25 to $0 in a new policy version while preserving its original receipt. Studio live calls were then paused again. See [the live evaluation, independent audit and billing limits](META-LIVE-EVALUATION.md). The controlled fixtures below remain separate historical engineering evidence.

The integration can be exercised without contacting Meta. **Test with simulated editors** creates an explicitly marked scenario with recorded policy interpretations. **Run simulated review** sends that controlled response through the same request transport, parsing, validation and durable review path used by the live adapter. It does not interpret arbitrary new language, use an API key, or measure Meta quality, latency or cost.

The simulated scenario compares a scholarship waiver for under-18s with a waiver for all scholarship recipients. Both interpretations preserve the minimum age and guardian-consent requirements. Consequences are computed by the rule engine rather than supplied as a model answer.

Automated integration tests additionally inject responses for separate policy scenarios, failures and concurrent edits. These are engineering checks, not a blind semantic evaluation of Meta. They do not contribute additional provider samples to the four-review live evaluation.

Earlier October 26 controlled validation: all 113 mechanical tests passed, including 18 new integration tests, and TypeScript checking passed. Local HTTP tests exercised concurrent editor saves and two reviews, with a scholarship attendee charged $80 under v2 and $0 under v3. One approval and split approvals held v2; the original receipt remained unchanged. Separate Chrome editor tabs exercised simulation, split approvals, matching approval, witness transfer and a saved registration. An independently authored controlled fixture tested a $25-to-$0 correction while preserving guardian consent and a strict deadline. No live Meta calls were made in those controlled checks. The corrections in these tests are editor choices or new drafts; automatic repair synthesis is separate work.

## Provider contract

The adapter uses the existing server-side Meta transport with `muse-spark-1.3` by default, a fixed Chat Completions endpoint, strict structured output, a bounded completion and response size, and a request timeout. It does not retry automatically.

Meta's structured-output documentation rejects recursive JSON schemas. The studio therefore uses a flat, bounded condition representation on the wire and validates its conversion into the nested rules used by the application. Exact source text, draft versions, job identity, rule limits and clarification consistency remain server-side checks.

An in-flight result is applied only while its durable lease and source snapshot remain current. Editing either draft invalidates the review and approvals. A stale result cannot replace a newer review, publication or manual interpretation. Receipts retain the policy version and outcome used at submission.

## Activation after authorization

Live calls are disabled by default, even if a key already exists. Do not put credentials in policy text, source, logs or chat.

1. The owner configures the Meta account and payment method in Meta's portal.
2. Store `MODEL_API_KEY` as a **Secret** in the private Site's environment variables.
3. Only after authorizing credit use, set the nonsecret server switch `SAMEPAGE_STUDIO_META_ENABLED=true` and redeploy. `SAMEPAGE_MODEL` is optional.
4. Start a new room, save both policies, and explicitly select **Analyze with Meta**.

Readiness means configuration is present, not that account access has been tested. No calls occur merely from opening a room, editing, polling, approving or registering. External attempts, including explicit retries, are limited to five per room and reserved before invocation. This is a request limit, **not an account-wide dollar cap**; new rooms and other API clients have separate usage. Meta's billing Spend Limit is an alert rather than a hard cap.

Keep this deployment owner-private. Alice and Bob are simulated roles, not separate authenticated users; public multi-user access needs its own authorization design.

## Primary references

- [Meta structured output and schema limits](https://dev.meta.ai/docs/structured-output)
- [Meta Chat Completions](https://dev.meta.ai/docs/protocols/chat-completions)
- [Meta model catalog](https://dev.meta.ai/docs/models)
- [Meta spend-limit alerts](https://dev.meta.ai/help/billing/spend-limit-alert)

Contract checked on October 26, 2026. The later live result is documented separately in [META-LIVE-EVALUATION.md](META-LIVE-EVALUATION.md).
