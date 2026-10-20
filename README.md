# SamePage

A bilingual collaboration prototype: two people edit one shared document in English and Spanish, see when their meanings disagree, and resolve the disagreement together.

The central interaction is a concrete consequence, not only a translation diff. For example, “may approve” and “must approve” create different obligations; SamePage asks a question whose answer differs under the two proposals, explains it in each language, and preserves the agreed text until both simulated editors choose the same meaning and a fresh whole-document review passes.

[Project brief and build plan (private Google Doc)](https://docs.google.com/document/d/1SovcRW_BpJU2tisT57L3vq3POAh3rn0wzOC077BCYIY/edit)

## Current prototype

- **Consequences experiment at `/consequences`:** bilingual policy drafts become proposed executable rules. Compare the same attendee under both interpretations, obtain two matching approvals, and submit a working synthetic registration form. Saved results retain the policy version used. See the [consequences runbook](docs/CONSEQUENCES-DEMO.md).
- The consequences experiment supports only minimum age, neighborhood residency, AND/OR eligibility, and an explicit UTC deadline. Unsupported or ambiguous clauses must remain unresolved. The original document lab remains available at `/`.
- Real shared rooms persisted in Cloudflare D1, with polling updates between editor tabs.
- English-speaking Alice and Spanish-speaking Bob are simulated personas. One person can operate both editors or use their separate links.
- Versioned proposals, strict JSON validation, atomic room updates, stale-draft protection, and joint conflict resolution.
- Explicit compatible merges with per-editor provenance and deliberate deletion handling.
- Every review snapshots all six sections; contradictions or cross-section uncertainty hold the whole batch. Matching votes queue a new review of the exact selected bilingual candidate.
- Corrections preserve the other editor’s unresolved proposal. Held drafts remain recoverable; pending edits can be withdrawn without losing newer local typing.
- Fresh reasoning through a **manual agent relay**: a facilitator gives the exact generated prompt to an independent AI agent and pastes its untouched JSON response back into the app.
- No automatic model connection and no Meta Model API integration yet. Reported relay duration includes operator time.

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
node --experimental-strip-types --test tests/room.test.mjs tests/consequences.test.mjs
```

The 25 reducer tests cover full-document snapshots, atomic holds, exact selected-candidate review, provenance, deletions, stale context, concurrent corrections, legacy job recovery, and draft preservation. They pass for this iteration. TypeScript checking and the production build are separate checks.

The consequences iteration adds 18 passing mechanical tests (43 total). Six frozen bilingual draft pairs received fresh interpretations from one isolated agent: 10 executable interpretations and two unresolved holds matched expectations. An independent evaluator recomputed all 50 outcomes (44 boolean and six unresolved) and verified 25 persisted registrations. Separate Chrome editor tabs demonstrated a version-1 rejection, one-vote and mismatched-vote holds, joint approval, and a version-2 acceptance for the same attendee. These are simulated tests, not real-user research. See [consequences evaluation](docs/CONSEQUENCES-EVALUATION.md).

On 20 October, eight fresh independent-agent responses covered seven frozen cases and their joint-vote continuation. All raw responses passed the production parser unchanged, and the tested semantic outcomes matched the expected facts. A separate browser session operated two editor tabs through a compatible merge, a concrete disagreement, matching votes, and a correctly blocked cross-document contradiction. See [evaluation notes](docs/EVALUATION.md) and the [demo runbook](docs/DEMO.md).

Next build priorities:

1. Integrate Meta Model API server-side, then measure quality, latency, cost, retries, and failure recovery on frozen and unseen inputs.
2. Shorten the interaction into a reliable judge-operated demonstration; preserve the visible explanations and both editors’ agency.
3. Test with independent bilingual people; improve confusing explanations and translations using their feedback.
4. Add actual editor identity, room membership and permissions before expanding access.

This is a feasibility prototype, not a validated production collaboration system. English and Spanish are the only implemented languages. The experiments do not establish a probability of winning a competition or general bilingual reliability.

## Source map

- `app/consequences/`, `app/api/consequences/`, `lib/consequences*.ts`: policy interpretation, consequence comparison, joint approval and versioned registration.
- `tests/consequences.test.mjs`, `tests/semantic/2026-10-20-consequences/`: mechanical tests and synthetic semantic evidence.
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
