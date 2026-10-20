# Frozen bilingual workshop policy corpus

Five independently agent-authored, synthetic English (Alice) / Spanish (Bob) pairs, with 29 concrete scenarios. All concern optional hobby workshop registration. Policy text and expected facts were frozen before any independent interpreter output was seen. No provider, Fable, Claude, or browser calls were made to author these fixtures.

## Files and blind interpretation

For each case, the main `.json` contains source policies and scenarios. The corresponding `.expectations.json` records agent-derived facts and human-readable formulas. A blind interpreter should receive only `policies.alice.text` and `policies.bob.text` from the case file, together with the actual supported contract; it should never receive the expectations or scenario descriptions.

The field names in the scenario fixtures describe human facts and are deliberately independent of a particular implementation schema. Adapt them to the contract without changing their meanings. Ages are integer years from 0 through 120. Flags are booleans, with true meaning present and false meaning absent. `guardianConsent: false` means consent has not been given. Every supplied timestamp explicitly uses UTC.

`feeCents: null` for a denied applicant means no applicable fee, not free admission. All amounts are USD. Unsupported seat-inventory policies require a null complete interpretation; their separate human outcomes use the explicitly supplied external observations and are not executable supported-policy results.

| Case | Scenarios | Intended finding |
|---|---:|---|
| `central-demo` | 6 | Both admit a 24-year-old scholar; Alice charges $80 and Bob $0. |
| `guardian-exception-scope` | 6 | Scholarship bypasses only age for Alice, but age and consent for Bob. |
| `discount-priority` | 6 | Same discounts with explicit first-match priorities: member + scholar pays $20 vs $0. |
| `equivalent-window-and-negation` | 6 | Inclusion versus rejection wording yields equivalent age bands, negative membership, consent, UTC window, and fees. |
| `unsupported-seat-capacity` | 5 | Live confirmed-seat inventory is unrepresentable; both complete interpretations must be null. |

The source pair in each disagreement case intentionally describes different policies. The Spanish text is not claimed to be a faithful translation. The equivalent case is designed to test semantics despite different wording.

`SHA256SUMS` records all frozen corpus files except the checksum file itself. `central-demo.sha256` additionally records the central case's earlier freeze. No interpreter outputs belong in this corpus directory.

Before any interpretation began, provenance was clarified to accurately identify the author as an AI agent, and the central source pair explicitly stated that there are no other admission requirements or registration deadline. All checksum files reflect that pre-interpretation freeze.
