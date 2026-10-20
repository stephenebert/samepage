# Automatic model integration — 20 October 2026

## Status

Implementation deployed owner-private. **Live Meta evaluation is UNRUN:** the user confirmed that they do not yet have Meta API access. No model key was configured and no real Meta model request was made. The six frozen policy pairs describe future expected behavior, not achieved model results.

## Checks completed

- All 76 mechanical tests passed: 53 existing tests plus 23 controlled model-client and coordination tests. The new tests inject provider responses; they cover strict output validation, missing credentials, safe HTTP errors, bounded body reads, timeouts, duplicate calls, explicit retries, expired leases, stale drafts and manual supersession.
- One controlled test runs saved drafts through the actual Meta HTTP adapter with an injected fetch, then discovery, one-vote hold, joint publication and a changed registration result. It is not a real Meta end-to-end test.
- Independent code review found an expired-lease bug. It was fixed: answers arriving at or after expiry cannot apply, and time is checked on each CAS retry. Two regression tests cover expiry without a replacement and expiry during CAS replay. No remaining blocking issue was identified in that review.
- TypeScript checking, production build and diff whitespace checks passed.
- Actual local HTTP: model readiness false; automatic review returns 503/MODEL_NOT_CONFIGURED and leaves the entire room unchanged; cross-origin request returns 403; invalid retry body returns 400. See `http-checks.json`.
- Local Chrome: disabled automatic review and clear setup instructions; advanced manual fallback stays available. Alice's unsaved text survived Bob's saved edit in a second tab. Unsaved changes disabled manual prompt preparation; saving enabled it, and the prompt was prepared successfully without a model call.
- Future automatic evaluation runner syntax and no-key guard passed. That guard used a synthetic configuration server, made one GET, no POST, and no provider request. It created no result directory and exposed no credential. See `runner-guard-check.json`.

## Deployment and browser verification

Sites source commit: `ba429294eb7a5c404255942f5b0442d5a2aacff1`.

Deployment: `appgdep_6ad7eec2a5148191ac9b25278972ac26`, status succeeded, environment revision 0 (unconfigured).

Version: `appgprj_6acf326d0f9c81918e24863d7a25c308~appgver_95c5cbb57a38819184483999729b6937`.

Prepared existing demo: https://samepage-language-lab.ampleboar17.chatgpt.site/consequences?room=consequence-160b9695-6fb0-44fb-87f0-c5f8d7c035f4

The deployed browser showed “Model not configured” and the Secret → save → redeploy → refresh instructions. It explicitly attributed the existing review to the manual relay. Both existing automatically discovered consequence directions remained usable, with the agreed v2 policy and both historical receipts preserved. No new semantic result was generated during this deployment check.

The direct browser screenshot `automatic-ready.png` records this setup state. The prepared demo was left open in Chrome; extra test/settings tabs were closed.

## Remaining activation work

Obtain Meta access, configure `MODEL_API_KEY` as a Site secret, redeploy to apply it, then run the frozen automatic cases and a fresh two-editor browser demonstration. Until those complete, provider contract compatibility, real model quality, latency and account billing remain unverified. Schema validation and code tests cannot substitute for those checks.
