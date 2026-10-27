# Full demo and rule explanations

Open `/studio` and choose **Try the full demo**. Every start creates a new room; old takes and their receipts stay intact.

1. Inspect the blocked nonstudent fee increase: $27 should remain $27, while the supplied unsafe rewrite would charge $31.
2. Open **Why did this change?** to see the matched fee rules and the requested outcome in English and Spanish.
3. Choose **Load the recorded repair**. It uses the retained Meta correction and recomputes impact; it does not call a model, grant votes, or publish.
4. Open **Alice · EN** and **Bob · ES**. Review the exact grouped bilingual wording. Approve in Alice's tab: the student form remains policy v2 and $14.
5. Approve in Bob's tab: policy v3 and $19 become current.
6. Submit the test registration. Compare the same attendee's $14/v2 and $19/v3 receipts.
7. **Start a fresh demo** creates another untouched take.

## Evidence and limits

The replay retains minimal policy drafts, parsed candidates, and corrected/unsafe proposals from the October 27 Meta evaluation (`muse-spark-1.3`). The unsafe rewrite was deliberately supplied. The starting v2 agreement and baseline receipt are clearly labeled demo history; all new repair votes start empty. These are simulated editors and synthetic attendees, with no payments.

New checks and approvals run through the ordinary reducers and storage. Explanations are computed from the evaluated rules, including first-match priority, defaults, zero fees, and changed eligibility. They do not claim to prove faithful interpretation of the source language. Original wording remains available separately.

Both provider runners reject full-demo rooms even if a key is enabled. No new Meta requests are used by opening, explaining, loading the saved repair, approving, or registering. Custom policy interpretation belongs in a separate room.

Validation: 207 passing mechanical tests; TypeScript and production build passed. Separate local and hosted Chrome editor tabs exercised the full flow. Alice's vote survived a local reload without publication; Bob's vote published; receipts retained identical attendee facts. A fresh local restart preserved the previous completed room. See [verification.json](evidence/full-demo/verification.json).
