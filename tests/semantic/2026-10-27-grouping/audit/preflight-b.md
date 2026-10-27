# Independent preflight review — Beacon Commons / Case B

**Pass: expected fidelity is correct.** I reviewed the English and Spanish source, authored unsafe rewrite, all 30 explicit attendees across four stages, canonical receipt facts, the independent oracle, and the separate Cobalt ambiguity input. No provider/model calls or application imports were used. No holdout inputs were edited.

Both languages explicitly make age 21+ apply to **both** adult alternatives. Youth ages 16–20 need consent, residence, student status, and absence of membership together. The sources differ only at the intended nonresident deadline: Alice includes `2026-11-24T10:15:30.250Z`; Bob excludes it. “Exactly one age pathway” in English and a complete age pathway in Spanish are equivalent here because the age ranges are disjoint.

The unsafe rewrite correctly preserves Alice's admission in both languages, gives students first-priority 1,900-cent fees, but deliberately changes a nonstudent member's fee from 2,700 to 3,100 cents. That must be blocked. The requested safe repair preserves nonstudent fees and applies student 1,900 above all original fee tiers; increases from 500 or 1,400 are therefore intentional.

The independent source transcription matched **120 explicit stage outcomes**, **two receipt outcomes**, and **201,344** source-versus-oracle comparisons over ages 0–120, all 32 flag combinations and 13 chosen UTC instants. The receipt attendee correctly changes **$14 → $19**. A mutation confined to a candidate-only timestamp was detected, confirming that returned thresholds add coverage rather than being checked only at source thresholds.

Grouping witness **B14** is correctly rejected: age 20, nonresident, student and member, guardian consent present, no scholarship. If age 21+ applied only to A1, the unguarded A2 could wrongly admit this person at 1,400 cents. The live wording review must ensure the age requirement still applies to A2.

The oracle's scanner handles the accepted rule timestamp domain confirmed by the parent: explicit UTC seconds ending in `Z`, optionally with milliseconds, nested as values under strict AST keys. It is not being certified for arbitrary alternate timestamp encodings such as offsets. The returned-rule schema rejects those encodings before this oracle is used.

The separate Cobalt policy is equivalent in English and Spanish. It fully specifies age-18 admission, no date restrictions, and a standard 5,800-cent fee; the reduced scholarship amount alone is unspecified. The proper result is clarification with no executable rule set, not an invented amount. This preflight is not evidence of live clarification behavior.

This is an independent AI review, not a human bilingual study. [Exact counts and evidence hashes](preflight-b.json) are preserved; [the audit script](preflight-b-audit.mjs) only reads files and performs offline checks.
