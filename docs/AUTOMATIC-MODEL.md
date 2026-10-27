# Automatic policy interpretation with Meta

The consequences workspace has a **Find consequences** action that sends both saved drafts to the server. The server obtains a structured interpretation from Meta, validates it against the exact draft snapshot, and stores the proposed bilingual rules. Automatic counterexample discovery then runs over those rules. The model never casts votes or changes the published policy: two matching editor approvals remain necessary, and the working registration form continues to enforce the last published version.

## Activation

This runbook records the original consequences integration. Meta access was subsequently configured for a four-review hosted `/studio` evaluation on October 26, after which studio live calls were paused. See [that live evaluation and its limits](META-LIVE-EVALUATION.md). The dedicated consequences workflow was not evaluated live in that run. Its controlled tests use injected responses and do not measure model understanding.

1. Obtain Meta Model API access and an API key using the [official developer portal](https://dev.meta.ai/).
2. Open [SamePage settings](https://chatgpt.com/space/sites/appgprj_6acf326d0f9c81918e24863d7a25c308/settings), then **Environment variables**.
3. Add `MODEL_API_KEY` and enable **Secret**. Never enter it into a policy draft, chat, source file or client-side variable.
4. Redeploy the site so the new environment revision is applied, then use **Refresh connection** in the app.
5. Save both drafts and select **Find consequences**. Readiness means a key is configured; a successful review is the actual provider-access check.

The optional `SAMEPAGE_MODEL` setting defaults to `muse-spark-1.3`. The default is the Standard model; this implementation does not silently select a Contributor model. For local development, copy `.env.example` to ignored `.env`, add the key locally and restart the development server. Cloudflare supports local environment files; do not mix `.env` and `.dev.vars` sources. Neither local files nor production secrets belong in `.openai/hosting.json`.

## Request and failure behavior

The server calls the fixed endpoint `https://api.meta.ai/v1/chat/completions` with bearer authentication, `stream:false`, `reasoning_effort:"medium"`, an 8,192 completion-token limit and strict JSON-schema output. These limits bound one attempt; they are not measured quality or latency recommendations. The API key is read only from server bindings. The model-status endpoint returns configuration metadata without the key.

A durable room lease prevents duplicate clicks or simultaneous editor tabs from starting multiple requests for the same active review. Requests time out after 55 seconds; an abandoned lease can be explicitly reclaimed after 90 seconds. Failed requests are not retried automatically. Provider errors are mapped to safe messages, and oversized, truncated, malformed or semantically invalid responses are rejected.

Saving a new draft supersedes the pending review. A late answer cannot overwrite newer drafts, a manual fallback review, or votes. A valid response still passes the existing checks for the current job, exact source text, supported rule representation and clarification issues. Those checks do not prove the model understood the prose correctly.

The manual relay remains in collapsed **Advanced review tools** for development and recovery. Manual interpretations are labeled separately from automatic Meta interpretations. Previously saved demo rooms remain usable while the model is unconfigured.

## Verification scope

The mechanical suite covers provider-response handling and request coordination with controlled responses. Six additional bilingual policy pairs were frozen before any live provider call, including a quoted prompt injection and a repeated DST hour. They are reserved for real API evaluation after access is configured. Their expected outcomes are test specifications, not model results.

All **76 mechanical tests**, TypeScript checking and the production build passed. Local HTTP and Chrome checks verified the unconfigured state, missing-key rejection without room mutation, cross-origin rejection, preserved unsaved edits and available manual fallback. Independent code review found and helped repair an expired-lease edge case. See [implementation verification](../tests/semantic/2026-10-20-automatic/IMPLEMENTATION-VERIFICATION.md) and the [future automatic evaluation runner](../tests/semantic/2026-10-20-automatic/AUTOMATIC-RUNNER.md).

At the October 20 checkpoint, the integration was deployed owner-private from Sites commit `ba429294eb7a5c404255942f5b0442d5a2aacff1`. Its existing prepared demo remains usable and explicitly attributes its review to the manual relay; the deployed model connection was unconfigured.

Those October 20 checks did not verify provider access, live model quality, latency or charges. The later studio evaluation supplies four live reviews and recorded HTTP durations; actual token usage and billed charges remain unmeasured. Continue using synthetic policies for further authorized evaluation.

## Primary references

- [Meta Chat Completions API](https://dev.meta.ai/docs/api-reference/chat-completions/create-chat-completion)
- [Meta structured output](https://dev.meta.ai/docs/structured-output)
- [Meta error handling](https://dev.meta.ai/docs/error-handling)
- [Cloudflare local environment variables](https://developers.cloudflare.com/workers/local-development/environment-variables/)

Contract checked on 20 October 2026. No provider SDK or new application dependency was added.
