# Security

What the site does to protect sign-in, stored secrets and responses, and what an
operator has to set. Source of truth for the code is named beside each item.

## Secrets you set (Worker secrets, never in KV or D1)

| Secret                    | Purpose                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `SESSION_SECRET`          | Signs the OAuth state cookie. OAuth sign-in fails closed without it.     |
| `SETUP_SECRET`            | Bearer password for the first-time `/setup` call. Use a different value. |
| `ENCRYPTION_KEY`          | Encrypts AI keys and OAuth client secrets in KV (optional, see below).   |
| `ENCRYPTION_KEY_PREVIOUS` | Retired key(s), comma separated, accepted while rotating.                |

Generate each with `openssl rand -base64 32`, or `bun run generate:encryption-key` for the
encryption key. Set them with `bunx wrangler pages secret put NAME`; locally put them in
`.dev.vars`. `SESSION_SECRET` has a fixed insecure fallback only under `vite dev`.

## Sign-in

- **Sessions.** The cookie is an opaque 256-bit token. D1 stores only its SHA-256 digest
  (`src/lib/utils/db.ts`), so a leaked `sessions` table gives no cookie that works. Identity
  is read from `sessions.data` on every request; nothing in the cookie is trusted.
  `tests/unit/no-forgeable-cookie.test.ts` keeps the old base64-user cookie from coming back.
- **OAuth.** Each GitHub or Discord attempt is a one-time row in `oauth_transactions`
  (migration 0013). The browser holds the raw state in a signed cookie, D1 holds its digest,
  and the row is consumed after the provider answers, so a copied cookie cannot be replayed.
  The link flow is also bound to the signed-in session. Provider access and refresh tokens are
  not stored (migration 0014 clears ones saved earlier). Code: `src/lib/utils/oauth-state.ts`,
  `src/lib/server/oauth-account.ts`, `src/lib/server/oauth-finalization.ts`.
- **Discord email.** An existing account is matched by email only when Discord reports the
  address verified.
- **Owner.** `GITHUB_OWNER_ID` (a numeric id) decides ownership. A GitHub username can be
  released and claimed by someone else, so a stored username counts only when no id is set.
- **Merging accounts** deletes the source's sessions (a browser signed in as the source must not
  inherit the target's rights), moves authored content to the target and keeps stats access.
- **Passwords** use PBKDF2 at 100,000 iterations, the most Workers allows. A stored hash above
  that cannot be checked on Workers and is refused (the user resets the password).
- **Throttle.** `/api/auth/login` counts failures per address and per email in KV
  (`src/lib/server/login-throttle.ts`): 8 failures in 15 minutes returns 429. It fails open if
  KV is missing.
- **`?next=`.** `/auth/login?next=/cart` returns to a same-site path after any sign-in
  (`src/lib/utils/after-login.ts`). `//host`, backslashes, control characters and other origins
  are refused.

## Responses

- `src/lib/server/security-headers.ts` sets HSTS (no `includeSubDomains`, no `preload`),
  `nosniff`, `X-Frame-Options: SAMEORIGIN` and a referrer policy on every Worker response; it
  is the outermost hook. Static files are served without the Worker, so the root `_headers`
  repeats them (it must live in the project root; the Cloudflare adapter refuses it in
  `static/`). A test keeps the two identical.
- `kit.csp` in `svelte.config.js` sets `object-src 'none'`, `base-uri 'self'` and
  `frame-ancestors 'self'`. `script-src` is left open on purpose: the allowlist depends on the
  analytics and embeds a page uses, so add it once they are listed.
- The Markdown variant of a page is `Cache-Control: private, no-store`, because Cloudflare's
  cache ignores `Vary: Accept` and would hand Markdown to browsers.
- `/media/*` honours single `Range` requests with 206 (and 416 past the end); Safari will not
  play video otherwise.

## Secrets at rest

Before this, the docs said secrets in KV were encrypted; they were plain JSON. Now AI provider
keys (`ai_key:<id>.apiKey`) and OAuth client secrets (`auth_config:<provider>.clientSecret`)
are sealed with AES-256-GCM before they are written. The admin UI and API return only whether a
secret is configured, its last four characters (omitted for secrets under 12 characters) and a
status (`ok`, `legacy`, `undecryptable`). Client ids, names and flags stay plaintext. Site API
keys and the stats token were already one-way hashes.

**The key.** With `ENCRYPTION_KEY` set the key lives in Cloudflare's secret store, so a KV leak
shows only ciphertext. Without it a random key is generated on the first save and kept in KV as
`encryption_key:auto`: values are still never plaintext, but anyone who can read the whole
namespace reads the key beside them. Set `ENCRYPTION_KEY` for production. Upgrading later needs
no migration: the KV key keeps working as an accepted old key and each value is re-encrypted on
its next read. A malformed `ENCRYPTION_KEY` is an error, never a quiet fallback. `/api/reset`
does not delete `encryption_key:auto`; deleting it would make saved keys unreadable.

**Format.** `v1.<iv>.<ciphertext>`, a fresh 96-bit IV per value, one HKDF-SHA-256 subkey per
purpose (`ai-key`, `auth-config`), and `purpose:record id` as authenticated data, so a value
copied to another record or purpose fails to open. Code: `src/lib/server/secret-box.ts`
(crypto) and `src/lib/server/secret-store.ts` (key resolution, KV records). Read and write these
records only through `readRecordWithSecret`, `sealRecordSecret` and `ensureRecordSealed`.

**Rotating.** Generate a new key and set it as `ENCRYPTION_KEY`, set the old one as
`ENCRYPTION_KEY_PREVIOUS`, deploy, open `/admin/ai-keys` and `/admin/auth-keys` once so every
record is read, then remove `ENCRYPTION_KEY_PREVIOUS`.

**Existing plaintext** is returned as before and rewritten encrypted on first read. A value that
cannot be decrypted keeps its record, counts as absent (the AI key is skipped, the provider is
unconfigured) and is never overwritten; enter the secret again.

**Limits.** KV has no compare-and-set, so two simultaneous first saves with no `ENCRYPTION_KEY`
converge on whichever key write won. A rewrite on read can overwrite a metadata edit made in the
same instant. The decrypted secret is in Worker memory while a request uses it. Credentials set as
Worker secrets (`GITHUB_CLIENT_SECRET`, ...) take precedence over KV and are not copied into it.
When copying KV between projects, copy `encryption_key:auto` too, or set the source's key as
`ENCRYPTION_KEY_PREVIOUS`.

## Development

The dev server, `vite preview` and the tunnel script bind to `127.0.0.1`. cloudflared connects to
loopback, and listening on every interface exposed the dev server (and its dev sign-in) to the
network. `/api/auth/dev-simulate` creates the `users` row its session points at.

## Migrations

`bun run check:migrations` (a CI step) fails on a badly named file, a duplicate or skipped
number, and, given `--base <ref>` or `GITHUB_BASE_REF`, any migration already on the base branch
that was edited, renamed or deleted. Migrations 0013 and 0014 are the OAuth ones above; 0014 is
a data migration (it nulls `oauth_accounts.access_token` and `refresh_token`).
