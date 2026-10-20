# Browser and deployment verification — 20 October 2026

These checks used Chrome UI controls through the computer-use tool. They are additional smoke checks, not additional fresh model responses. Synthetic attendees only.

## Local browser checks

- Crossed age/deadline room `consequence-9d0436cc-cd20-45d5-bf51-5cf9f9ce7b22`: selected Bob-only discovery (25, nonresident, 2027-04-14T18:30:00.000Z), transferred to the form, and saved a rejection under published Alice policy v2 (`registration-9`). Switched to Alice-only discovery (23, nonresident, 2027-04-12T18:30:00.000Z), transferred and saved acceptance under the same policy (`registration-10`). Loading the discovered attendee did not itself save a registration.
- Subsecond room `consequence-cd0274a9-104f-4e4a-a86e-21c7589a9e6d`: automatic witness was age 31 at 2027-07-09T12:00:00.375Z. The form's raw DOM value after transfer retained `.375`. Submission saved the exact timestamp and correct rejection under the strictly-before Alice policy v2 (`registration-8`).
- Equivalent case showed “Same outcomes within supported rules” and explained that this does not prove the source language means the same thing. No counterexample was invented.
- Unsupported exceptions showed paused discovery and disabled all four approval buttons. It did not label the policies equivalent.
- Separate Alice and Bob tabs shared the crossed case. Alice changed her local preview age to 99. Bob selected the later-deadline witness and submitted a registration (`registration-11`). Alice received room revision 11 and the new Bob receipt while her custom age remained 99. This checks that polling does not overwrite independent exploration.

## Private deployment

- Production build passed.
- Sites source commit: `6f170d65286f585a8092183d6d8715d5bf13d546`.
- Deployment: `appgdep_6ad7ebd232788191a2402c0e2764d2db`, terminal status `succeeded`.
- Version: `appgprj_6acf326d0f9c81918e24863d7a25c308~appgver_4d1c52c135148191826dcbb771a83056`.
- Owner-private publication preserved the existing access policy.
- Prepared live demo: https://samepage-language-lab.ampleboar17.chatgpt.site/consequences?room=consequence-160b9695-6fb0-44fb-87f0-c5f8d7c035f4

The frozen crossed-age/deadline drafts were entered through the live UI. Its generated prompt matched the frozen evaluation prompt byte-for-byte. The original raw response was replayed unchanged. This is deployment verification using an audited response, not another fresh interpretation test. Both consequence directions appeared automatically.

The Alice-only witness was transferred to the live form and saved as a baseline v1 rejection (`registration-5`). Alice's vote alone left v1 published. Bob then confirmed Alice's interpretation in a separate Chrome tab; the main tab received published v2 through polling. Submitting the unchanged discovered attendee saved acceptance (`registration-8`) under v2. The prepared live room now has the agreed policy, both discovered directions, and both historical receipts. Its main form displays the successful v2 result. Old receipts retain the original policy and outcome.

Screenshots `discovery-live-full.png` and `discovery-live.png` were captured from the deployed page. The latter is a direct browser screenshot of the discovery panel. A single Chrome tab was left open to the prepared live demo; the extra test tab was closed.

## Interpretation of the result

Automatic discovery makes the interaction stronger: neither draft is simply more permissive, and the two discovered attendees make that tradeoff visible without a facilitator guessing test inputs. This remains a narrow, synthetic feasibility demonstration. Model interpretation still uses a manual relay; independent human usefulness, live model latency and competition performance have not been established.
