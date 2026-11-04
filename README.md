# SamePage

SamePage helps teams review English and Spanish registration policies, find people affected by a difference, and approve checked wording before a registration form uses it.

[Live workspace](https://samepage-demo.stephenmebert.chatgpt.site/) · [Demo video](https://youtu.be/UmtQLiURgIM)

## What it does

1. Start with a blank workspace and paste both policy drafts. An optional sample fills the inputs only.
2. Request a live Meta review. SamePage compares the interpreted executable rules and finds an example applicant whose eligibility or fee differs.
3. Open the separate English and Spanish reviewer links. Both reviewers must approve the same interpretation before it becomes the baseline.
4. Check a rewrite against that baseline. An unsafe or unresolved rewrite cannot publish. Meta can propose a repair, which is checked again.
5. Both reviewers approve the checked wording. The registration checker then uses the published version and saves versioned decision receipts.

The video follows a free community workshop. A rewrite unexpectedly excludes a resident who belongs to a club; SamePage catches that consequence and keeps the approved policy active. After a checked repair and both approvals, the same applicant is eligible in the working form.

## Run locally

Use **Node.js 24 LTS** and npm. Tests were verified with Node 24.22.1. No Meta key or Cloudflare account is required to run the offline tests, build the application, or save local drafts.

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Open `http://localhost:5173`. The local D1 database is stored in ignored `.wrangler/state`; the committed migration contains schema only. `wrangler.json` uses a generic local database name and a placeholder ID, with no hosted database identity.

To enable fresh inference locally:

```sh
cp .env.example .dev.vars
```

Set your own `MODEL_API_KEY` in `.dev.vars`, change `SAMEPAGE_JUDGE_META_ENABLED` to `true`, and restart the server. This file is ignored by Git. Model requests use that provider account; loading a sample, approvals, and registration checks do not call Meta. The live flow has no saved-response fallback.

To check the production build locally:

```sh
npm run build
npm start
```

The preview uses the same local database and binds to `127.0.0.1:8787`. This repository does not include the hosted Site's deployment identity, credentials, or stored workspaces. Deploying a separate instance requires its own database, migration, and server-side secrets.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

The current **27 tests** cover publication gates, distinct reviewer roles, stale approvals, owner isolation, invitation revocation, durable request accounting, and versioned registration. They use synthetic model responses and in-memory SQLite; provider requests are blocked during these tests. Some retained judge fixtures exercise legacy state transitions; the public HTTP interface is `/api/workspace`, not a recorded demo endpoint.

## How Meta is used

The server calls Meta Model API using `muse-spark-1.3` to interpret submitted policy wording and propose bilingual repairs. SamePage validates the returned rules, searches their supported input space for changed outcomes, and enforces approval and publication rules. Model settings remain server-controlled; the API key never reaches the browser.

The current allowance is ten provider attempts per browser session and thirty across an instance, including failures. Environment settings can reduce those limits. Creating a new workspace does not replenish them. These are request limits, not a provider billing balance.

## Scope and limitations

Supported rules cover age, residency, student and membership status, guardian consent, scholarships, explicit application deadlines, and ordered USD admission fees, including free admission. Unsupported or ambiguous policies require clarification. Agreement between executable rules does not prove that natural-language interpretation is correct, so reviewers still inspect the wording.

Reviewer links grant access to one workspace and one role; they are not identity verification. The recording uses two simulated reviewer roles and synthetic attendees. Owner sessions expire after seven days, and replacing a workspace invalidates its reviewer links. The form is an **owner-operated registration decision checker**, not a public attendee intake portal.

The recorded flow made three real Meta requests. The video compresses waiting and navigation for a 2:45 demonstration; the original spoken narration is preserved. No claim is made that SamePage outperforms plain Meta on interpretation accuracy or that simulated editors establish real-user validation.

## Source and provenance

The application uses React, Vinext/Vite, a Cloudflare Worker and D1 storage. Start with `app/page.tsx`, `app/api/workspace/route.ts`, `lib/workspace-service.ts`, and `lib/studio-engine.ts`.

This release brings the November 3 live workspace into the existing repository, preserving earlier commits. Core policy reasoning originated in the earlier prototype; the editable workspace, separate reviewer capabilities, and current interface were added later. [Provenance and release verification](docs/RELEASE.md) distinguish that work from earlier experiments and describe the small portability changes made for this source release.
