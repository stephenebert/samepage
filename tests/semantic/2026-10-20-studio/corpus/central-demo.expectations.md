# Central demo: same admission, different price

Frozen independent agent-derived expectations. Give a blind interpreter only the two policy texts from `central-demo.json`, never this file or the expectation JSON. These are agent-derived fixtures, not an interpreter result.

Both policies require age 16 or older and guardian consent for anyone under 18. `guardianConsent: true` means consent is given; `false` means it is not. An adult does not need consent. Neither policy has another admission requirement or a registration deadline. A scholarship cannot admit anyone under 16 or a minor without consent.

Alice grants a fee waiver only to scholarship recipients under 18. Bob grants it to every scholarship recipient. Thus a 24-year-old with a scholarship and no guardian consent is admitted by both: **Alice charges $80; Bob charges $0**.

| Scenario | Alice eligible | Alice fee | Bob eligible | Bob fee |
|---|---|---|---|---|
| Age 24, no scholarship, no consent | Yes | $80 | Yes | $80 |
| Age 24, scholarship, no consent | Yes | $80 | Yes | $0 |
| Age 17, scholarship, consent | Yes | $0 | Yes | $0 |
| Age 17, no scholarship, consent | Yes | $80 | Yes | $80 |
| Age 17, scholarship, no consent | No | Not applicable | No | Not applicable |
| Age 15, scholarship, consent | No | Not applicable | No | Not applicable |

In the JSON expectations, a denied applicant has `feeCents: null`; this does not mean a free admitted place. The policies deliberately disagree about scholarship scope; Bob's text is not presented as a faithful translation of Alice's.

A 90-second demo can show the two scholarship sentences, select the adult scholarship scenario, show identical admission but $80 versus $0, and explain that a shared age limit did not imply a shared fee policy.
