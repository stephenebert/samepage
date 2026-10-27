# Six-request automatic repair evaluation

This archive retains a failed initial generation and a separately frozen successful continuation. It is **not** an all-pass run.

- Original source: `a2192649eca69594b25052e780ccba346ee7aa56`.
- Revised source: `d5c94fdc0fe17b95cbc88691a6b98db45a6ec9e8`.
- Original three requests: baseline interpretation, an authored unsafe rewrite, and a fresh generated repair. The generated repair incorrectly kept an age restriction on the target waiver. The app blocked it; the published policy and old receipt did not change.
- Continuation's three requests: one explicit retry of the known Lumen failure after a prompt change, then a fresh Orbit baseline and generated repair. Both valid repairs needed both simulated editors' approvals.
- Total six natural completions, 224 concrete checks with six intent failures confined to the blocked original generation, and four preserved/new receipts. The failure is retained as `originalRunPassed:false`.

The generated-prompt revision includes an executable target derived by production code from the chosen baseline and explicit fee intent. It does not include evaluation goldens. Authored-rewrite check mode is unchanged and receives no target. Expected outcomes remain separate from provider inputs. The baseline, supplied rewrite and generated repair are distinct evaluation stages.

Run the combined offline verifier from the repository root:

```sh
node tests/semantic/2026-10-26-repair/verify-archive.mjs
```

It hashes the archive and replays `audit/audit-stopped-run.mjs` plus `extension/verify-evidence.mjs`. Both are read-only and prohibit network calls. The original top-level `verify-evidence.mjs` is a success-only verifier and intentionally rejects the retained failed generation; it must not be presented as a passing check. The old failed stage's `running` label is untouched historical output: the ledger stopped, the response completed, and the application saved a blocked proposal. No live request remains running.

`holdout/` holds separately frozen synthetic sources, expected outcomes and an independent source oracle. `responses/` and `extension/responses/` preserve application HTTP responses; provider bodies are reconstructions from the evaluated source and returned job, not intercepted transport. `audit/` includes separate bilingual AI review, the original failure audit and combined analysis. `ui-fixtures/` contains clearly labeled offline browser fixtures, not provider evidence. `activation-and-shutdown.json` records native deployment confirmation and browser observations. The pause applies to Studio, not the shared API key or older consequences endpoint.

The archived runners are retained for reproducibility; do not run their `--live` modes as verification. Credential-bearing headers and bearer values are absent. Token-rate estimates are not measured billing. File hashes establish local integrity, not remote attestation, human usability or general natural-language accuracy.

See [the full report](../../../docs/AUTOMATIC-REPAIR.md) for results, limits and the two completed rooms.
