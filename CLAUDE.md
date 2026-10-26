# Claude Instructions

**Refer to [AGENTS.md](AGENTS.md) for the canonical constraints and rules.**

This file is for Claude-specific context only. All tool-agnostic rules (testing, migrations, theming, etc.) are documented in AGENTS.md.

## Context Loading

Claude loads the first 200 lines of memory files automatically. AGENTS.md is designed to fit within that budget to ensure all critical rules are loaded on session start.

## Task Tracking

Claude has access to the `manage_todo_list` tool for tracking multi-step work. Use it to:
- Break complex work into actionable steps
- Mark tasks in-progress before starting
- Mark tasks completed immediately after finishing (not in batches)
- Provide visibility into progress for users

**Scheduled jobs** (`docs/SCHEDULED_JOBS.md`): Pages has no Cron Triggers, so `cron-worker/` is a separate Worker (own `wrangler.toml`/`tsconfig.json`, outside the app build and `svelte-check`) that POSTs to `/api/cron/*`. Jobs are registered in `src/lib/server/scheduler/registry.ts`; every cron route is `handleCronRequest(event, id)`, which authorizes with `authorizeCronRequest` (constant-time, 503 when `CRON_SECRET` is unset) and claims `(job, trigger, scheduled minute)` in `scheduled_job_runs` (migration `0019`) before running. `tests/unit/scheduler-registry.test.ts` fails if the registry, `cron-worker/wrangler.toml` `[triggers]` and `CRON_PATHS` in `cron-worker/src/index.ts` drift. Retention deletes go through `deleteInBatches` (`src/lib/server/bounded-delete.ts`): never an unbounded `DELETE`.

---

For all development constraints, coverage rules, migration policies, and theming requirements, see [AGENTS.md](AGENTS.md).
