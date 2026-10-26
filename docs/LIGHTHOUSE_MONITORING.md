# Lighthouse monitoring

Scores for this app's own public pages, refreshed on a schedule and shown at
`/admin/lighthouse` with the specific audits that failed.

## Why PageSpeed Insights, not Lighthouse

Lighthouse drives a real Chrome. A Cloudflare Worker has no browser and could
not afford the CPU if it did — and this project deploys to Cloudflare **Pages**,
which, unlike Workers, has **no Cron Triggers** to run one on.

Google's PageSpeed Insights API runs Lighthouse on Google's infrastructure and
returns the whole report over plain HTTP, so the audit becomes a `fetch`. No
browser, no CI, no build step, and it works on the day the
site is first deployed.

**The cost, stated plainly:** PSI can only reach a public URL. It cannot audit
`localhost`, a preview behind Cloudflare Access, or anything before the first
deploy. `site.url` has to be real. Until it is, `/admin/lighthouse` says so
rather than showing an empty table.

## Two Lighthouse paths on this site

This site already had one: `bun run lighthouse` (`scripts/lighthouse.mjs`) runs
Lighthouse locally against the template and the site, commits the HTML reports
under `static/lighthouse/` and writes `src/lib/lighthouse-results.json`, which
the home page's "Measured, not claimed" section and the badge render. That is
the published, dated claim.

`/admin/lighthouse` is the live counterpart for the operator: PageSpeed
Insights against the deployed pages, latest result per page and form factor,
with the failing audits. It neither reads nor writes the committed JSON, and
the committed reports do not feed it, so the two cannot disagree about which
is authoritative: the JSON is what we publish, the admin page is what is true
right now.

## Scheduling

There is no cron in a Pages deployment, so this repo ships a small Worker
that provides one: `cron-worker/` fires `/api/cron/lighthouse` daily (04:43 UTC)
with the shared `CRON_SECRET`. Deploy it as described in
[SCHEDULED_JOBS.md](./SCHEDULED_JOBS.md): `wrangler deploy` in `cron-worker/`,
and set `CRON_SECRET` on both the Worker and the Pages project.

The endpoint is still a plain authenticated POST, so a GitHub Actions
`schedule:` or any other host works if you prefer it:

```bash
curl -X POST https://your-app.example/api/cron/lighthouse \
  -H "Authorization: Bearer $CRON_SECRET"
```

Runs are claimed once per scheduled minute, recorded, and listed at
`/admin/scheduled-jobs`.

**Daily is plenty.** PSI's keyless rate limit will not tolerate much more, and
these scores do not move hourly. `?strategy=desktop` audits the desktop form
factor; the default is mobile, which is what Google ranks on. The two are
stored separately because PSI scores them very differently.

`PAGESPEED_API_KEY` is optional and only raises the rate limit.

## What is stored

Two tables (`migrations/0018_lighthouse_audits.sql`):

- `lighthouse_audits` — one row per `(path, strategy)`: the four category
  scores, when it ran, and an `error` when the run failed.
- `lighthouse_findings` — the audits that scored below Lighthouse's own 0.9
  "good" boundary, with the title, description and display value.

**Latest only, not history.** Both tables are keyed on `(path, strategy)` and
each run replaces its own rows, so the table size is bounded by the number of
public pages forever. The trade is deliberate: no trend chart, and in exchange
no retention cron to forget and no table that grows with time. Add history by
dropping the unique constraint and stamping a run id.

A failed run stores `NULL` scores and a reason, never zeros — a zero is a real
score and would read as a catastrophic page.

## What is audited

`auditablePaths()` returns whatever `SITEMAP_ROUTES` in
`src/lib/agent-discovery.ts` already calls public. Derived rather than listed,
so a new public page is audited without anyone remembering — and a page
deliberately kept out of the sitemap is not quietly sent to Google either.

## Two doors, on purpose

| Route                        | Authenticates               | Caller                      |
| ---------------------------- | --------------------------- | --------------------------- |
| `POST /api/cron/lighthouse`  | `CRON_SECRET` bearer        | a scheduler                 |
| `POST /api/admin/lighthouse` | the session, `requireAdmin` | a person pressing "Run now" |

They do not accept each other's credential, and a test pins that. A bearer
secret that works from a browser is a secret in a browser.

## Gotchas

- The sweep is **sequential**. PSI rate limits hard without a key, and a burst
  of parallel requests is the reliable way to get 429s on all of them. On a
  schedule, finishing slowly beats failing quickly.
- `auditPath` **never throws**. One unreachable page must not abandon the rest
  of the sweep, and "PSI could not reach /contact" is something the admin page
  has to be able to show.
- An audit scored `null` is Lighthouse's marker for informative, manual and
  not-applicable checks. It is neither a pass nor a failure, and listing them
  would bury the real findings.
