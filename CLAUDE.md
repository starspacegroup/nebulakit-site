# Claude Instructions

**Refer to [AGENTS.md](AGENTS.md) for the canonical constraints and rules.**

This file is for Claude-specific context only. All tool-agnostic rules (testing, migrations, theming, etc.) are documented in AGENTS.md.

## Builder and site API

**The builder and the site API live in `packages/`** (`@nebulakit/builder`, `@nebulakit/security`), aliased in `svelte.config.js` and added to the generated tsconfig there; each exports a `*_VERSION` that `tests/unit/site-api-openapi.test.ts` keeps equal to its `package.json`, and `security` is marked the forced update channel. Builder pages are a validated JSON document rendered by `PageRenderer.svelte` with no `{@html}` — keep it that way; they are served at `/p/[slug]`, so the site's own routes always keep priority. Every `/api/v1/*` handler is wrapped in `siteApi(scope, …)` from `src/lib/server/site-api.ts`: callers are owner-issued keys (hashed, scoped, logged), the orchestrator key matched against `ORCHESTRATOR_KEY_SHA256`, or an admin session (JSON-only writes are the CSRF guard; only owners get `site:admin`). A bad bearer key is refused, never downgraded to anonymous. The OpenAPI document (`src/lib/server/site-openapi.ts`) is checked against the exported route methods, so adding a method means describing it. Tests use `tests/helpers/sqlite-d1.ts`, which runs the real migrations on `node:sqlite`. Migrations `0020`–`0022` own these tables.

## Context Loading

Claude loads the first 200 lines of memory files automatically. AGENTS.md is designed to fit within that budget to ensure all critical rules are loaded on session start.

## Task Tracking

Claude has access to the `manage_todo_list` tool for tracking multi-step work. Use it to:
- Break complex work into actionable steps
- Mark tasks in-progress before starting
- Mark tasks completed immediately after finishing (not in batches)
- Provide visibility into progress for users

**Scheduled jobs** (`docs/SCHEDULED_JOBS.md`): Pages has no Cron Triggers, so `cron-worker/` is a separate Worker (own `wrangler.toml`/`tsconfig.json`, outside the app build and `svelte-check`) that POSTs to `/api/cron/*`. Jobs are registered in `src/lib/server/scheduler/registry.ts`; every cron route is `handleCronRequest(event, id)`, which authorizes with `authorizeCronRequest` (constant-time, 503 when `CRON_SECRET` is unset) and claims `(job, trigger, scheduled minute)` in `scheduled_job_runs` (migration `0019`) before running. `tests/unit/scheduler-registry.test.ts` fails if the registry, `cron-worker/wrangler.toml` `[triggers]` and `CRON_PATHS` in `cron-worker/src/index.ts` drift. Retention deletes go through `deleteInBatches` (`src/lib/server/bounded-delete.ts`): never an unbounded `DELETE`.

**Landing pages** (`docs/SEO_LANDING_PAGES.md`): the who/where/what/when/why machinery is in place but this site ships NO landing content: `PAGES` is empty, `example` is `false`, the routes 404 and the sitemap lists none. The Example Co. pages are test fixtures in `tests/fixtures/landing/`; never move them into `src/`. Landing pages rely on `SharingMeta`'s graph, so they add no second Organization/WebSite/WebPage node.

---

For all development constraints, coverage rules, migration policies, and theming requirements, see [AGENTS.md](AGENTS.md).
