# Fresh unseen policy: one unchanged full-flow run

SamePage completed one newly authored policy through three live Meta requests without changing the application, prompts, example or expected results after the run began. Alice and Bob saved separate language drafts, the system detected their meaning disagreement, an authored unsafe rewrite was blocked, and a generated repair was jointly approved and drove the working form.

[Open the completed Open Bench room](https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room=studio-6c297563-ae78-496c-95aa-05a39399f076#studio-repair).

## What was frozen

A separate author started without the earlier conversation and did not inspect the application, earlier cases or model outputs. The author received the supported policy domain: integer age, five independent flags, explicit UTC timestamps, boolean conditions and ordered USD fees. They produced the English and Spanish drafts, an authored unsafe rewrite, 30 explicit attendee cases with four expected outcomes each, and an independent source oracle. Another AI reviewer checked the policy and 120 expected outcomes before the freeze. This is independent AI-authored test material, not an unaffiliated human or a judge-submitted policy.

The holdout was frozen before the first live request. The runner pinned the clean deployed source `def141d7b93f12709db9b264d104584303ff4bf4`, copied its evaluator and prompt/schema modules, and froze its own scripts and budget. Expected outcomes and oracle logic were never included in provider inputs. No tuning, retries, source changes or second attempt occurred.

- Holdout manifest SHA256: `e9332b8c01b7f9e5cec4b1ab325e63018d007aad8418277ea7d1873ca6071034`
- Provider inputs SHA256: `0d4c2754dd4bee65ec2dc7cfa4d8b384467a504eca96d3cf2c52c324502b7530`
- Run plan SHA256: `766c51a1605c1b41d0fb679d0d1bef1a08a3ec55f3c1b2b407dd0361029223b9`

## The challenge and result

The fictitious Open Bench remote repair lab has a precise opening and closing instant, a minimum age of 16, a guardian-consent exception, and seven ordered fee outcomes. Alice's draft waives consent for 16–17-year-olds only when they are **both a resident and a member**. Bob's Spanish draft instead says **resident or member**. Meta interpreted the two meanings separately and the checker found their admission difference. Both simulated editors selected Alice's meaning as the baseline; one vote alone did not publish it.

The requested repair was an exact **$32.50 fee for every eligible student**, preserving all admission requirements, deadlines and every nonstudent's fee. This deliberately exercises fee priority: it can raise a student's fee as well as lower it. It is not a general discount or a requirement to preserve cheaper student exceptions.

A supplied bilingual rewrite correctly applied that fee but moved the registration close from **2027-02-20 02:15 UTC to 02:45 UTC**. Meta interpreted it literally; the impact check found that it would admit late applicants and blocked publication. Both simulated editors' approval attempts were rejected. The baseline and its saved receipt remained unchanged. This deadline change was deliberately authored challenge material, not a spontaneous mistake made during Meta's automatic generation.

Meta then generated a repair that preserved the original closing instant, the resident-and-member consent exception and all nonstudent fees. It satisfied the new exact student fee. Alice's approval alone held v2; Bob's matching approval published v3. The same 17-year-old resident/student/member without guardian consent retained admission under the existing exception. Their saved fee changed from **$18.50 at v2 to $32.50 at v3**, exactly as requested. Both receipts preserve their facts, policy versions and results.

| Live operation | HTTP wait | Result |
| --- | ---: | --- |
| Interpret the two fresh drafts | 10.887 s | Both meanings correct; admission disagreement discovered |
| Check the authored unsafe rewrite | 9.094 s | Deadline extension detected; both approvals blocked |
| Generate and check the repair | 7.263 s | Intent satisfied; two approvals published v3 |

All three replies ended naturally with `stop`. There were no incomplete replies, retries, cached candidate reuse or extra provider calls. These are three individual timing observations, not a repeated-run latency distribution.

## Verification and cost

All **120 concrete outcome comparisons** passed: 30 attendees against Alice's interpretation, Bob's interpretation, the unsafe rewrite and the generated repair. The independent oracle checked **185,856 outcomes**, covering all ages 0–120, all 32 independent flag combinations and timestamps around source and returned-rule boundaries, with zero mismatches. The verifier also replays the one-vote holds, blocked approvals, joint publication and receipt preservation against the frozen implementation.

Reported counters total **6,777 prompt tokens and 6,871 completion tokens**, giving an uncached token-rate estimate of **$0.037673**. The frozen conservative estimate was **$0.365568**, under the declared $0.40 bound. Actual billing and credit deductions remain unconfirmed. The local request limit is not an account-wide spending cap.

Studio model calls were paused again after this run. The same saved source/version was redeployed with environment revision 21; the key was not revoked, and this switch does not globally disable the earlier consequences endpoint. The saved room remains usable without another model call.

## Browser presentation follow-ups

The semantic run passed, but the hosted browser review exposed two presentation issues that were retained rather than fixed during this frozen test:

- An Alice view opened while the test was running showed an unselected baseline control inside “Inspect the saved repair request,” although the checked intent and persisted job correctly identified Alice’s baseline. After reload, it correctly selected Alice’s English interpretation, draft v2. The saved intent remained correct throughout; the browser record retains this transient live-update synchronization issue.
- The intended-effect card chooses the first fee-decrease witness, a 20-year-old nonresident student changing from $45.50 to $32.50. The preserved receipt pair uses a different, 17-year-old resident/member student changing from $18.50 to $32.50. Both outcomes are correct, but the two different attendees make the demonstration less cohesive. The card should select the receipt’s effect direction when possible, or clearly distinguish the two examples.

These are follow-ups for presentation before submission, not reasons to relabel the correct model interpretations or alter the frozen policy. No code, prompt or test-data changes were made to conceal them.

## Evidence and limits

The [frozen archive](../tests/semantic/2026-10-26-fresh-unseen/) retains the independently authored inputs, gold outcomes and oracle, frozen source and scripts, request ledger, full runtime responses, before/after states, quality comparisons, separate audit and shutdown record. The archive verifier performs no network requests or file writes:

```sh
node tests/semantic/2026-10-26-fresh-unseen/verify-archive.mjs
```

This is positive evidence for one new policy within the supported domain. It does not establish broad multilingual accuracy, production readiness or a competition result. The model still generates and interprets the repair within the same call; a consistent language-to-rules misunderstanding can escape the deterministic checker. Alice and Bob are simulated roles inside an owner-private site. The separate bilingual review is an AI audit, not a human study. It found no operative meaning defect and retained three low-severity text notes: the event name was translated from Open Bench to Banco Abierto, the Spanish closing language uses “exclusive” instead of the source’s plainer wording, and ancillary fee explanations retain English labels. None was changed during this run.

The earlier [six-call repair evaluation](AUTOMATIC-REPAIR.md), including its genuine model failure, remains unchanged. This run validates the later simplified-target prompt on one fresh policy; it does not retroactively turn earlier failures into successes or count the no-call UI polish as live evidence.
