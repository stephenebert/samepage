# SamePage consequences prototype

The `/consequences` experiment connects a bilingual policy disagreement to a working synthetic registration form. The earlier six-section document lab remains at `/`.

## The demonstration

1. Create a room and open Alice and Bob in separate tabs. The published policy starts with age 16 or older **and** neighborhood residency, with an inclusive deadline of 5 November 2026, 18:00 UTC.
2. Submit two complete policies. Alice keeps both eligibility requirements; Bob proposes that either age or residency is sufficient. Both retain the explicit UTC deadline.
3. Request an interpretation. Give the exact generated prompt to an independent agent and import its untouched JSON. This is a manual relay, not an automatic Meta API connection.
4. Compare the same 17-year-old nonresident under both drafts. Alice's interpretation rejects the attendee; Bob's accepts them. Change the age, residency, or synthetic submission time to explore further consequences.
5. Submit the attendee through the registration form before agreement: the server still uses the published AND policy and saves a rejection with policy version 1.
6. Alice approves Bob's exact interpretation. The form must still use version 1. Bob then approves that same interpretation: both language views and the form move to version 2.
7. Submit the same attendee again. The saved result should now be accepted under version 2. The prior rejection stays attached to version 1.
8. Try a guarantor exception or an unspecified local time. An interpretation that cannot represent the full policy must remain unresolved, with approval disabled.

## Execution and limitations

The model proposes translations and a small structured rule object. Deterministic code evaluates the approved object. Approval is tied to the exact review and draft versions; new drafts invalidate existing interpretations and votes. Registration is evaluated again by the server, checks the current policy version, and supports idempotent request retries.

Supported rules are a minimum age in completed whole years, neighborhood residency, AND/OR between those active eligibility predicates, and a UTC registration deadline with explicit inclusivity. The deadline always applies in addition to eligibility. This cannot represent arbitrary policy language, age maxima, fees, quotas, parental consent, guarantors, or other exceptions. Unsupported or ambiguous drafts must not be partially compiled.

All attendees, editors and registrations are simulated. The form stores synthetic test outcomes; it does not register anyone for the Meta hackathon or a real event. Personas are not independent authentication identities. Keep the deployment owner-private.

Schema validation and deterministic execution cannot prove that a language model extracted the right policy. The executable summary is displayed for human inspection, and tests must check language interpretation separately from code execution. Current tests do not establish general language reliability or competition placement.
