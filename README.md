# SamePage

A bilingual collaboration prototype: two people edit one shared document in English and Spanish, see when their meanings disagree, and resolve the disagreement together.

The current consequences experiment automatically finds an attendee or deadline instant where two policy interpretations disagree. It can find both directions of an age/deadline tradeoff: a younger person accepted only by one rule, and a later applicant accepted only by the other. The user can transfer either discovered attendee into a working registration form, while the published rule stays unchanged until both simulated editors approve the same interpretation.

[Project brief and build plan (private Google Doc)](https://docs.google.com/document/d/1SovcRW_BpJU2tisT57L3vq3POAh3rn0wzOC077BCYIY/edit)

## Current prototype

- **Automatic counterexample discovery at `/consequences`:** bilingual policy drafts become proposed executable rules. SamePage automatically finds a concrete attendee with different outcomes, including exact millisecond deadline boundaries. It exposes both acceptance directions when they exist, and distinguishes equivalent supported rules from unresolved interpretations. See [discovery design, evidence and demo flow](docs/COUNTEREXAMPLE-DISCOVERY.md).
- **Working registration form:** transfer a found attendee without submitting, obtain two matching approvals, then save a synthetic registration. The server evaluates the published rule; receipts retain the exact timestamp and policy version. The [original consequences runbook](docs/CONSEQUENCES-DEMO.md) remains available.
- The consequences experiment supports only minimum age, neighborhood residency, AND/OR eligibility, and an explicit UTC deadline. Unsupported or ambiguous clauses must remain unresolved. The original document lab remains available at `/`.
- Real shared rooms persisted in Cloudflare D1, with polling updates between editor tabs.
- English-speaking Alice and Spanish-speaking Bob are simulated personas. One person can operate both editors or use their separate links.
- Versioned proposals, strict JSON validation, atomic room updates, stale-draft protection, and joint conflict resolution.
- Explicit compatible merges with per-editor provenance and deliberate deletion handling.
- Every review snapshots all six sections; contradictions or cross-section uncertainty hold the whole batch. Matching votes queue a new review of the exact selected bilingual candidate.
- Corrections preserve the other editor’s unresolved proposal. Held drafts remain recoverable; pending edits can be withdrawn without losing newer local typing.
- Fresh reasoning through a **manual agent relay**: a facilitator gives the exact generated prompt to an independent AI agent and pastes its untouched JSON response back into the app.
- Counterexample discovery is deterministic and automatic after the manually relayed interpretation is validated. There is no automatic model connection or Meta Model API integration yet. Reported relay duration includes operator time.

The hosted prototype uses an owner-private Sites access boundary. The simulated editor IDs are not authentication identities; the app does not yet implement independent user authorization or room membership. Keep local development on loopback and deployments private while that remains true.

## Run locally

Prerequisites: Git and Node.js 22.13 or later with npm. Node.js 24 was used for the current reducer tests. No model API key is required for the manual relay.

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

## Try the two-editor workflow

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
node --experimental-strip-types --test tests/room.test.mjs tests/consequences.test.mjs tests/counterexamples.test.mjs
```

The 25 reducer tests cover full-document snapshots, atomic holds, exact selected-candidate review, provenance, deletions, stale context, concurrent corrections, legacy job recovery, and draft preservation. They pass for this iteration. TypeScript checking and the production build are separate checks.

The preceding consequences iteration added 18 passing mechanical tests (43 total at that point). Six frozen bilingual draft pairs received fresh interpretations from one isolated agent: 10 executable interpretations and two unresolved holds matched expectations. An independent evaluator recomputed all 50 outcomes (44 boolean and six unresolved) and verified 25 persisted registrations. Separate Chrome editor tabs demonstrated a version-1 rejection, one-vote and mismatched-vote holds, joint approval, and a version-2 acceptance for the same attendee. These are simulated tests, not real-user research. See [consequences evaluation](docs/CONSEQUENCES-EVALUATION.md).

The automatic discovery iteration adds 10 tests, bringing the mechanical total to **53 passing tests**. The discovery suite includes every integer age threshold, strict/inclusive and adjacent millisecond boundaries, null/invalid rules, deterministic output, and 1,500 seeded rule-pair comparisons against an independent oracle. TypeScript checking also passed.

A separate agent authored eight frozen bilingual policy pairs before interpretation. One isolated interpreter received only the eight production prompts and returned eight untouched responses: 13 executable drafts and three unresolved drafts matched expected semantics. All **62 scenario outcomes** matched (53 boolean results and nine abstentions). The search found six witnesses across five differing pairs, correctly treated one pair as equivalent within the supported rules, and held two pairs unresolved. Each witness also produced a verified server registration under one selected interpretation: **six persisted receipts**. Two simulated browser editors additionally exercised both directions of the age/deadline tradeoff, and an exact `.375`-second witness survived transfer into the form and its saved receipt. See [discovery evidence and limitations](docs/COUNTEREXAMPLE-DISCOVERY.md); these counts do not measure real-user benefit or broad semantic accuracy.

On 20 October, eight fresh independent-agent responses covered seven frozen cases and their joint-vote continuation. All raw responses passed the production parser unchanged, and the tested semantic outcomes matched the expected facts. A separate browser session operated two editor tabs through a compatible merge, a concrete disagreement, matching votes, and a correctly blocked cross-document contradiction. See [evaluation notes](docs/EVALUATION.md) and the [demo runbook](docs/DEMO.md).

Next build priorities:

1. Integrate Meta Model API server-side, then measure quality, latency, cost, retries, and failure recovery on frozen and unseen inputs.
2. Shorten the interaction into a reliable judge-operated demonstration; preserve the visible explanations and both editors’ agency.
3. Test with independent bilingual people; improve confusing explanations and translations using their feedback.
4. Add actual editor identity, room membership and permissions before expanding access.

This is a feasibility prototype, not a validated production collaboration system. English and Spanish are the only implemented languages. The experiments do not establish a probability of winning a competition or general bilingual reliability.

## Source map

- `app/consequences/`, `app/api/consequences/`, `lib/consequences*.ts`: policy interpretation, consequence comparison, joint approval and versioned registration.
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

Only source and summarized technical evidence are included. Runtime databases, environment files, dependencies, build output, application/CV materials, and personal model-chat transcripts are excluded. Third-party license notices remain with their bundled files.
