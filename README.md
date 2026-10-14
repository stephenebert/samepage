# SamePage

A bilingual collaboration prototype: two people edit one shared document in English and Spanish, see when their meanings disagree, and resolve the disagreement together.

The central interaction is a concrete consequence, not only a translation diff. For example, “may approve” and “must approve” create different obligations; SamePage asks a question whose answer differs under the two proposals, explains it in each language, and preserves the agreed text until both simulated editors choose the same meaning.

[Project brief and build plan (private Google Doc)](https://docs.google.com/document/d/1SovcRW_BpJU2tisT57L3vq3POAh3rn0wzOC077BCYIY/edit)

## Current prototype

- Real shared rooms persisted in Cloudflare D1, with polling updates between editor tabs.
- English-speaking Alice and Spanish-speaking Bob are simulated personas. One person can operate both editors or use their separate links.
- Versioned proposals, strict JSON validation, atomic room updates, stale-draft protection, and joint conflict resolution.
- Fresh model reasoning through a **manual Fable relay**: a facilitator copies the generated prompt into Fable and pastes its JSON response back into the app.
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
3. Open **Facilitator controls**, claim the queued edits, and copy the exact generated prompt into Fable.
4. Paste its complete JSON response into the facilitator panel and select **Validate and apply response**.
5. For a conflict, inspect the concrete example and have both editors choose the same proposal. A single vote or differing choices leave the agreed text unchanged.

Fable responses must match the generated schema exactly. Invalid or outdated responses are rejected; schema validation does not establish that the model's semantic judgment is correct.

## Verification and known gaps

Run the existing reducer suite without installing application dependencies:

```sh
node --experimental-strip-types --test tests/room.test.mjs
```

The ten tests cover versioning, idempotency, conflict voting, atomic validation, stale results, and draft preservation. They passed for this snapshot. A separate harder evaluation used 14 synthetic cases, 24 proposals, and six fresh manually relayed Fable responses. See [evaluation notes](docs/EVALUATION.md) for results and limits.

The next build priorities are:

1. Check relevant unchanged sections before applying edits, so contradictory facts cannot silently coexist across the document.
2. Define a distinct compatible-merge outcome with provenance and clear deletion semantics. The current model sometimes performs a useful merge under the narrower `agree` status.
3. Integrate Meta Model API and measure automatic quality, latency, and failure recovery with frozen and unseen tests.
4. Add actual editor identity and room permissions, then test an unscripted session with independent bilingual people.

This is a feasibility prototype, not a validated production collaboration system. English and Spanish are the only implemented languages. The experiments do not establish a probability of winning a competition or general bilingual reliability.

## Source map

- `app/page.tsx`: editor views, conflict explanations, voting, and facilitator controls.
- `app/api/rooms/`: room creation, actions, and relay endpoints.
- `lib/room.ts`: pure proposal/reconciliation state machine, prompt construction, and response validation.
- `lib/store.ts`: D1 persistence with compare-and-swap revisions.
- `lib/types.ts`: shared types and model response contract.
- `tests/room.test.mjs`: reducer tests.
- `drizzle/`: database migration and schema metadata.
- `build/`, `scripts/`, and `.openai/hosting.json`: runtime and Sites deployment support.

## Snapshot provenance

This repository starts with the prototype source from Sites commit `92d804df209fd9c7cc90453a1a6934013a1d69ff`, captured on 14 October 2026. Application code, tests, dependency lockfile, and runtime configuration are retained exactly. The changes are this README, documentation, additional ignore rules, and exclusion of the generated `tsconfig.tsbuildinfo` cache. The original local checkout and history remain intact.

Only source and summarized technical evidence are included. Runtime databases, environment files, dependencies, build output, application/CV materials, and personal model-chat transcripts are excluded. Third-party license notices remain with their bundled files.
