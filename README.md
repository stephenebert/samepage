# SamePage

A bilingual collaboration prototype: two people edit one shared document in English and Spanish, see when their meanings disagree, and resolve the disagreement together.

The current `/studio` demo finds realistic admission and fee differences between bilingual workshop policies, including scholarship scope, guardian exceptions, and ordered discounts. It leads from a discovered attendee to joint approval and a working form. The earlier `/consequences` experiment automatically finds an attendee or deadline instant where two simpler policy interpretations disagree. It can find both directions of an age/deadline tradeoff: a younger person accepted only by one rule, and a later applicant accepted only by the other. The user can transfer either discovered attendee into a working registration form, while the published rule stays unchanged until both simulated editors approve the same interpretation.

[Project brief and build plan (private Google Doc)](https://docs.google.com/document/d/1SovcRW_BpJU2tisT57L3vq3POAh3rn0wzOC077BCYIY/edit)

Latest October 26 update: the demo now has honest elapsed timing, clearer approval consequences and receipt comparison. A 12-request latency evaluation did **not** demonstrate a safe speedup: compact output was smaller, low reasoning lost admission conditions, and experimental unchanged-editor reuse returned an incomplete response. Medium reasoning remains selected, reuse is disabled, and live Studio calls are paused. The final source passes 122 mechanical tests, TypeScript and production build. See [the latency results, failures and frozen evidence](docs/LATENCY-DEMO.md); the four-review results below are the earlier historical baseline.

## Current prototype

- **Realistic policy studio at `/studio`:** nested boolean conditions, age ranges, five attendee flags, explicit UTC boundaries, and ordered USD fee overrides. The richer studio now connects to the server-side Meta adapter with a nonrecursive wire schema, exact-source validation, durable request leases and joint approval. Four authorized live Meta reviews have now completed successfully; studio live requests were paused again after the evaluation. **Test with simulated editors** exercises the adapter with a clearly labeled fixed response and no external calls. Manual review and the earlier recorded demo remain available. See [studio Meta integration and activation](docs/STUDIO-META.md).
- **Earlier verification:** 113 mechanical tests, TypeScript and production build pass. Eighteen new integration tests use independent HTTP fixtures, including a $25-to-$0 policy correction. Local HTTP clients verified concurrent editor saves, split-vote holds, and $80-to-$0 registrations with preserved receipts. Separate Chrome editor tabs verified simulation, voting and registration. A separate hosted run made four fresh Meta `muse-spark-1.3` review requests: all 120 concrete checks and four unresolved checks matched frozen expectations, with $17.25-to-$0 versioned receipts preserved. An independent AI audit reviewed all eight translations and 185,856 rule comparisons. Review HTTP durations were 12.705–23.752 seconds; the conservative cost estimate was $0.20911025, not measured billing. See [live evidence and limits](docs/META-LIVE-EVALUATION.md). Historical studio results remain in [the earlier studio runbook](docs/REALISTIC-POLICY-STUDIO.md).

- **Automatic model integration at `/consequences`:** **Find consequences** sends both saved policy drafts to a server-side Meta integration, validates the returned bilingual rules, and starts counterexample discovery. This earlier workspace shares the server-side Meta transport, but its own live workflow was not part of the four-review studio evaluation. See [activation, failure handling and verification scope](docs/AUTOMATIC-MODEL.md).
- **Automatic counterexample discovery at `/consequences`:** bilingual policy drafts become proposed executable rules. SamePage automatically finds a concrete attendee with different outcomes, including exact millisecond deadline boundaries. It exposes both acceptance directions when they exist, and distinguishes equivalent supported rules from unresolved interpretations. See [discovery design, evidence and demo flow](docs/COUNTEREXAMPLE-DISCOVERY.md).
- **Working registration form:** transfer a found attendee without submitting, obtain two matching approvals, then save a synthetic registration. The server evaluates the published rule; receipts retain the exact timestamp and policy version. The [original consequences runbook](docs/CONSEQUENCES-DEMO.md) remains available.
- The consequences experiment supports only minimum age, neighborhood residency, AND/OR eligibility, and an explicit UTC deadline. Unsupported or ambiguous clauses must remain unresolved. The original document lab remains available at `/`.
- Real shared rooms persisted in Cloudflare D1, with polling updates between editor tabs.
- English-speaking Alice and Spanish-speaking Bob are simulated personas. One person can operate both editors or use their separate links.
- Versioned proposals, strict JSON validation, atomic room updates, stale-draft protection, and joint conflict resolution.
- Explicit compatible merges with per-editor provenance and deliberate deletion handling.
- Every review snapshots all six sections; contradictions or cross-section uncertainty hold the whole batch. Matching votes queue a new review of the exact selected bilingual candidate.
- Corrections preserve the other editor’s unresolved proposal. Held drafts remain recoverable; pending edits can be withdrawn without losing newer local typing.
- **Manual agent relay** remains available in collapsed **Advanced review tools** for the consequences workspace and in the original document lab. A facilitator gives the exact generated prompt to an independent AI agent and pastes its untouched JSON response back into the app.
- Counterexample discovery is deterministic and automatic after either interpretation path is validated. Existing demo reviews were manually relayed and are labeled accordingly. Automatic review metadata reports the model request duration; historical relay duration includes operator time.

The hosted prototype uses an owner-private Sites access boundary. The simulated editor IDs are not authentication identities; the app does not yet implement independent user authorization or room membership. Keep local development on loopback and deployments private while that remains true.

## Run locally

Prerequisites: Git and Node.js 22.13 or later with npm. Node.js 24 was used for the current reducer tests. No model API key is required for the manual relay. Automatic interpretation requires server-side Meta access; follow [the activation instructions](docs/AUTOMATIC-MODEL.md).

```sh
git clone https://github.com/stephenebert/samepage.git
cd samepage
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_graceful_amazoness.sql
npm run dev
```

Open the local URL printed by the server (normally `http://127.0.0.1:5173`). Apply the SQL migration once to a fresh local database; do not replay it against a database that already has the table. Development and built previews share the ignored `.wrangler/state` directory. To preview the built Worker instead of the development server, run `npm start` and use its printed loopback URL.

The repository includes the nonsecret Sites binding configuration and build tooling. See [Sites runtime details](docs/SITES-RUNTIME.md) for profiles, local sign-in simulation, and deployment integration. The existing hosting project ID identifies the original private deployment; it is not an API credential. Publishing is a separate step and requires access to that hosting project or configuration for a new one.

## Try the consequences workflow

For the current studio, open `/studio`, choose **Test with simulated editors**, and select **Run simulated review**. Inspect the discovered attendee, make matching choices from both editor roles, then use the attendee in the working form. The fixed simulation cannot interpret arbitrary edits. Fresh policies require manual review or explicitly enabled Meta access; see [activation and limits](docs/STUDIO-META.md).

1. Open `/consequences`, create a room and use the combined view or separate Alice/Bob editor links.
2. Save both full policy drafts. Local unsaved text is preserved and excluded from review.
3. Once Meta access is configured, select **Find consequences**. While unconfigured, this action is disabled and the advanced manual fallback remains available.
4. Inspect any automatically discovered attendee, both language versions and the structured rules. Unsupported or ambiguous policies must remain unresolved.
5. Transfer the attendee to the registration form if useful. The form continues to enforce the previously published rule until both editors confirm the same interpretation.
6. Submit the synthetic registration to save the outcome against that published policy version.

Model configuration is checked on the server. A missing key returns HTTP 503 without mutating the room or attempting a provider call. Failed model requests require an explicit retry; editing either draft invalidates the pending interpretation. Configured readiness means a key exists, not that Meta access has been verified.

## Try the original document lab

1. Create a shared room and open Alice’s and Bob’s editor links in separate tabs, or use the combined view.
2. Propose an English edit and a Spanish edit to the same section before processing them.
3. Open **Facilitator controls**, claim the queued edits, and give the exact generated prompt to an independent AI agent.
4. Paste its complete JSON response into the facilitator panel and select **Validate and apply response**.
5. For a conflict, inspect the concrete example and have both editors choose the same proposal. A single vote, differing choices, and matching votes all leave the agreed text unchanged initially.
6. Select **Review shared choice**, relay the new prompt, and apply the fresh response. Only a clear whole-document review commits the exact selected candidate. If held, inspect the quoted passages and use **Edit saved proposal** to correct the draft; another editor’s unresolved intent remains in the next review.

Agent responses must match the generated schema exactly. Invalid or outdated responses are rejected; schema validation does not establish that the model's semantic judgment is correct.

## Verification and known gaps

Run the existing reducer suite without installing application dependencies:

```sh
node --experimental-strip-types --test tests/*.test.mjs
```

The 25 reducer tests cover full-document snapshots, atomic holds, exact selected-candidate review, provenance, deletions, stale context, concurrent corrections, legacy job recovery, and draft preservation. They pass for this iteration. TypeScript checking and the production build are separate checks.

The preceding consequences iteration added 18 passing mechanical tests (43 total at that point). Six frozen bilingual draft pairs received fresh interpretations from one isolated agent: 10 executable interpretations and two unresolved holds matched expectations. An independent evaluator recomputed all 50 outcomes (44 boolean and six unresolved) and verified 25 persisted registrations. Separate Chrome editor tabs demonstrated a version-1 rejection, one-vote and mismatched-vote holds, joint approval, and a version-2 acceptance for the same attendee. These are simulated tests, not real-user research. See [consequences evaluation](docs/CONSEQUENCES-EVALUATION.md).

The preceding automatic discovery iteration added 10 tests, bringing the mechanical total to **53 passing tests at that point**. The discovery suite includes every integer age threshold, strict/inclusive and adjacent millisecond boundaries, null/invalid rules, deterministic output, and 1,500 seeded rule-pair comparisons against an independent oracle. TypeScript checking also passed.

A separate agent authored eight frozen bilingual policy pairs before interpretation. One isolated interpreter received only the eight production prompts and returned eight untouched responses: 13 executable drafts and three unresolved drafts matched expected semantics. All **62 scenario outcomes** matched (53 boolean results and nine abstentions). The search found six witnesses across five differing pairs, correctly treated one pair as equivalent within the supported rules, and held two pairs unresolved. Each witness also produced a verified server registration under one selected interpretation: **six persisted receipts**. Two simulated browser editors additionally exercised both directions of the age/deadline tradeoff, and an exact `.375`-second witness survived transfer into the form and its saved receipt. See [discovery evidence and limitations](docs/COUNTEREXAMPLE-DISCOVERY.md); these counts do not measure real-user benefit or broad semantic accuracy.

On 20 October, eight fresh independent-agent responses covered seven frozen cases and their joint-vote continuation. All raw responses passed the production parser unchanged, and the tested semantic outcomes matched the expected facts. A separate browser session operated two editor tabs through a compatible merge, a concrete disagreement, matching votes, and a correctly blocked cross-document contradiction. See [evaluation notes](docs/EVALUATION.md) and the [demo runbook](docs/DEMO.md).

The automatic model integration adds **23 passing tests**, bringing that iteration’s mechanical total to **76 passing tests**. Controlled provider fixtures cover the HTTP contract, exact source validation, malformed or oversized output, provider errors, timeouts, duplicate requests, CAS retries, expired leases, late responses, draft supersession and manual fallback. Missing credentials return HTTP 503 without room mutation or a provider call. No actual Meta API calls were made in that earlier integration test iteration; those tests established request handling and state transitions. The later [four-review hosted studio evaluation](docs/META-LIVE-EVALUATION.md) supplies a separate, narrowly scoped live result. See [automatic model integration](docs/AUTOMATIC-MODEL.md).

A subsequent six-pair hard unseen-policy evaluation passed **64 scenario checks**, found four witnesses, correctly recognized a non-obvious equivalent pair, and held two unsupported/ambiguous candidates. Separate author, blind interpreter and auditor agents were used, with no paid provider API calls. Two browser editors then jointly published each side of one disagreement: an identical attendee and timestamp changed from accepted to rejected solely because residency became required. See [the hard-policy evaluation and its limits](docs/HARD-UNSEEN-EVALUATION.md). This used the manual relay; its results are distinct from the later hosted Meta evaluation.

Next build priorities:

1. Keep studio live calls paused after the completed four-review evaluation. Extend the sample only with fresh authorization, and obtain measured provider usage/cost; the billing refresh did not expose the exact charge.
2. Add automatic correction proposals and verify their effects against the intended change; current corrections are editor choices or fresh drafts.
3. Evaluate the `/studio` demo with independent bilingual people and improve confusing explanations using their feedback.
4. Add actual editor identity, room membership and permissions before expanding access.

This is a feasibility prototype, not a validated production collaboration system. English and Spanish are the only implemented languages. The experiments do not establish a probability of winning a competition or general bilingual reliability.

## Source map

- `app/studio/`, `app/api/studio/`, `lib/studio*.ts`, `lib/automatic-studio-review.ts`: rich policy interpretation, flat provider schema, explicitly enabled Meta adapter, controlled simulation, bounded comparison, joint approval, and receipts.
- `tests/studio-integration.test.mjs`, `tests/semantic/2026-10-26-studio-meta/`: historical controlled transport, concurrency, clarification, quota and full-flow evidence.
- `tests/semantic/2026-10-26-meta-live/`, `docs/META-LIVE-EVALUATION.md`: four actual hosted Meta reviews, frozen expectations, sanitized responses, independent audit, cost limits and pause verification.
- `tests/studio*.test.mjs`, `tests/semantic/2026-10-20-studio/`: mechanics, original frozen source/expectations, untouched agent outputs, separate clarification rounds, audit, HTTP checks, and two-browser evidence.

- `app/consequences/`, `app/api/consequences/`, `lib/consequences*.ts`: policy interpretation, consequence comparison, joint approval and versioned registration.
- `lib/automatic-policy-review.ts`: durable model-request leases, explicit retries, stale-response rejection and atomic proposal application.
- `lib/policy-model.ts`, `lib/policy-model-env.ts`: fixed Meta endpoint, strict output schema, bounded response handling and server-only configuration.
- `app/api/consequences/model/route.ts`, `app/api/consequences/[id]/review/route.ts`: safe readiness metadata and automatic review endpoints.
- `tests/automatic-policy-review.test.mjs`: controlled provider and concurrency fixtures; no live model claims.
- `docs/AUTOMATIC-MODEL.md`, `.env.example`: activation instructions and nonsecret configuration names.
- `lib/counterexamples.ts`: bounded complete comparison of the two executable policy interpretations and selection of concrete witnesses.
- `tests/counterexamples.test.mjs`, `tests/semantic/2026-10-20-discovery/`: discovery mechanics, frozen unseen policies, raw prompts/responses and recorded outcomes.
- `tests/consequences.test.mjs`, `tests/semantic/2026-10-20-consequences/`: earlier consequences mechanics and synthetic semantic evidence.
- `app/page.tsx`: editor views, conflict explanations, voting, and facilitator controls.
- `app/api/rooms/`: room creation, actions, and relay endpoints.
- `lib/room.ts`: pure proposal/reconciliation state machine, prompt construction, and response validation.
- `lib/store.ts`: D1 persistence with compare-and-swap revisions.
- `lib/types.ts`: shared types and model response contract.
- `tests/room.test.mjs`: reducer tests.
- `drizzle/`: database migration and schema metadata.
- `build/`, `scripts/`, and `.openai/hosting.json`: runtime and Sites deployment support.

## Snapshot provenance

This repository starts with the prototype source from Sites commit `92d804df209fd9c7cc90453a1a6934013a1d69ff`, captured on 14 October 2026. That initial snapshot is retained in Git history. The 20 October iteration updates application code and tests for document consistency, explicit merging, and safer correction flows. Dependency inputs and runtime configuration are preserved. Generated `tsconfig.tsbuildinfo` caches remain excluded. The original local checkout and history remain intact.

Source, summarized technical evidence and sanitized synthetic evaluation artifacts are included. Runtime databases, secret environment files, dependencies, build output, application/CV materials, and personal model-chat transcripts are excluded. The tracked `.env.example` contains only nonsecret configuration placeholders. Third-party license notices remain with their bundled files.
