# Production readiness

An honest assessment of what has to change before Maker Network can take real
users, real files and real money.

**Current state:** a complete, well-tested product (417 unit/integration/security
tests, 48 end-to-end tests) running on SQLite and local disk. Nothing below is a
rewrite — but several items are genuine blockers.

Severity: 🔴 blocker · 🟠 needed before public launch · 🟡 should do soon

---

## 1. Data layer

### 🔴 Move off SQLite to PostgreSQL

SQLite is a single file with a single writer. It cannot serve a multi-instance
deployment and has no managed backup story.

The schema was written for this migration — no native enums, no scalar lists — so
only the datasource block changes:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then regenerate the migration history against Postgres (the existing SQLite
migrations will not replay) and run `prisma migrate deploy`.

### 🔴 Search silently becomes case-sensitive on PostgreSQL

This is the one migration trap that will not announce itself.
`src/lib/services/search.ts` uses Prisma `contains`, which compiles to
`LIKE '%term%'`. **SQLite's `LIKE` is case-insensitive for ASCII; PostgreSQL's is
not.** Verified against the current database: searching `ada's` and `ADA'S` both
match "Ada's Print Bench" today. On Postgres, only the exact case would.

Every `contains` in `searchProfiles` (six in the `q` branch, plus the `city`
filter) needs the PostgreSQL-only `mode` option:

```ts
{ displayName: { contains: q, mode: "insensitive" } }
```

It is absent today precisely because SQLite rejects it. There is a test —
`tests/integration/search.test.ts` — that will keep passing on SQLite either way,
so this must be caught by review, not by CI, until the provider changes.

### 🟠 Replace `LIKE` search with real full-text search

Even case-corrected, `%term%` cannot use an index and will table-scan. Fine at a
few thousand profiles; beyond that use Postgres `tsvector` + a GIN index, or an
external index (Meilisearch/Typesense) for typo tolerance and facets.

### 🟠 Connection pooling

Serverless platforms exhaust Postgres connections quickly. Use PgBouncer, Prisma
Accelerate, or a pooling driver adapter, and set `connection_limit` explicitly.

### 🟡 Backups and point-in-time recovery

Nothing exists today because the database is a local file. Whichever managed
Postgres you pick, confirm PITR is enabled and **rehearse a restore** before
launch.

---

## 2. File storage

### 🔴 Move uploads off local disk

`src/lib/services/uploads.ts` writes to `UPLOAD_DIR` on the local filesystem.
Files written by one instance are invisible to the others, and most container
filesystems are ephemeral — a redeploy loses every customer's design file.

Move to S3/R2/GCS. The service layer already treats storage as an implementation
detail, so the change is contained:

| Function | Change |
| --- | --- |
| `storeUpload` | Presigned `PUT` from the browser, or stream through the server |
| `getAccessibleFile` | Keep the authorisation check, then return a short-lived presigned `GET` |
| `deleteUpload` | Delete the object alongside the row |
| `resolveStoragePath` | Delete it — this function exists only because of local disk |

Keep the authorisation check server-side. Do **not** hand out permanent public
object URLs: the entire point of `getAccessibleFile` is that only the uploader
and the receiving maker can read a file.

### 🟠 Virus and content scanning

We accept arbitrary binaries (STL, 3MF, STEP, ZIP) and hand them to another human
who opens them in a slicer. Run uploads through ClamAV or a hosted scanner before
they become downloadable. Today the only defences are an extension allow-list, a
size cap, and forced-attachment downloads.

### 🟡 Sweep abandoned uploads

`RequestFile` rows with a null `requestId` are staged files that were never
submitted. Nothing deletes them. Add a scheduled job removing rows (and objects)
older than ~24 hours.

### 🟡 Enforce the size cap while streaming

`POST /api/uploads` buffers the whole file via `await file.arrayBuffer()` before
checking its size. The `content-length` pre-check helps but is client-supplied, so
a hostile client can still make the server allocate up to the body limit.
Presigned uploads make this moot.

---

## 3. Authentication and accounts

### 🔴 Configure Google OAuth

`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` are empty. The app degrades gracefully —
the sign-in page says Google is not configured — but there is no real sign-in
path in production. Create the OAuth client, add the production callback
`https://<domain>/api/auth/callback/google`, and set a strong `AUTH_SECRET`.

### 🔴 Verify the development login is absent in production

`devLoginEnabled()` returns false whenever `NODE_ENV === "production"`, whatever
`ENABLE_DEV_LOGIN` says, and there are tests for it. **Still check the deployed
`/api/auth/providers` lists only Google** — this is the single
highest-consequence misconfiguration available in this codebase.

### 🟠 Account deletion and data export

Users can neither delete their account nor download their data. Schema cascades
already exist, so this is mostly UI and confirmation flow — plus a policy
decision about reviews they wrote, which currently cascade-delete and silently
change makers' ratings.

### 🟡 A second sign-in option

Google is the only real provider. If it breaks, nobody can log in. Email magic
links are the natural addition.

---

## 4. Security hardening

Already in place: ownership re-derived from the session in every mutating
service, `.strict()` Zod schemas, `http(s)`-only URL validation, no
`dangerouslySetInnerHTML`, forced-attachment downloads with `nosniff`,
open-redirect protection, and 404-not-403 on cross-tenant access.

### 🟠 Security headers

No CSP, HSTS, `X-Frame-Options` or `Referrer-Policy` for the app itself (only on
file downloads). Add them via `headers()` in `next.config.ts`. A CSP needs care
with Next's inline scripts — use nonces.

### 🟠 Shared rate limiting

`assertMessageRateLimit` counts `Message` rows in a time window. It works and is
now shared by messaging and the request builder, but it costs a query per write
and is per-user only. There is **no rate limiting on sign-in, uploads, reviews or
profile writes**. Put a shared limiter (Upstash Redis or the platform's own) in
front of mutating routes, keyed by IP *and* user.

### 🟠 Reporting and moderation

Anyone can publish a profile, a gallery image and reviews. There is no report
button, no moderation queue, no admin role, and no way to unpublish a bad actor.
This is a launch requirement for a marketplace connecting strangers.

### 🟡 Audit logging

Nothing records who changed what. At minimum log publish/unpublish, request
decisions and account deletions.

### 🟡 Gallery images are hot-linked

`PortfolioItem.imageUrl` renders a third-party URL in an `<img>`. The URL is
protocol-validated and deliberately not proxied through the Next image optimizer,
but a maker can point it anywhere, it leaks visitor IPs to that host, and it
breaks when the host disappears. Ingest images into our own storage.

---

## 5. Operations

### 🔴 No observability

No error tracking, no metrics, no structured logging. `jsonError` writes
unhandled errors to `console.error` and nothing collects them. Add Sentry or
equivalent plus request logging — you cannot debug production from
`console.error`.

### 🟠 Health check and migrations in the pipeline

Add `/api/health` for platform probes, and run `prisma migrate deploy` as a
release step that blocks the rollout on failure.

### 🟠 Validate environment variables at boot

A missing `AUTH_SECRET` or `DATABASE_URL` currently fails at the first request in
a confusing way. Validate with Zod at startup and fail fast.

### 🟡 A job runner

Needs are accumulating with nowhere to run: abandoned-upload sweeps, email,
virus scanning, search reindexing. Choose one early.

---

## 6. Product gaps that block a real launch

### 🔴 Nobody is notified of anything

There is no email or push. A maker discovers a request only by logging in and
looking. For a marketplace where response time *is* the product, this is the most
damaging gap on this list. Wire transactional email (Resend/Postmark) for: new
request, accepted/declined, new message, new review.

### 🟠 No payments

Money is arranged off-platform. A take rate — or customers feeling safe paying
strangers — requires Stripe Connect with escrow-style holds.

### 🟠 Availability slots cannot be booked from the UI

`POST /api/availability/[id]/book` and `bookAvailabilitySlot` are complete and
tested, but the public profile renders the calendar **read-only** — there is no
button. Smallest gap here, largest perceived-completeness payoff.

### 🟡 Location is just a text field

`city` is matched with a substring `LIKE`. No geocoding, no radius search, no
map; "Austin" does not match differently-typed variants. `Profile.latitude` and
`longitude` columns already exist and are unused. "Makers near me" is the single
most requested feature a directory like this will get.

---

## 7. Compliance

- **Terms of service and privacy policy** — neither exists. Required before
  taking users and before Google OAuth verification.
- **GDPR/CCPA** — depends on account deletion and export above.
- **Cookie consent** — the session cookie is strictly necessary, so this only
  matters once analytics are added.
- **Marketplace liability** — `/safety` gives sensible advice, but a platform
  connecting strangers around laser cutters and 300 °C hot ends needs real terms
  reviewed by a lawyer.

---

## Suggested order

1. Postgres + the `mode: "insensitive"` search fix + backups
2. Object storage for uploads + virus scanning
3. Google OAuth configured; verify the dev login is absent in production
4. Sentry, health check, env validation
5. Transactional email
6. Security headers, shared rate limiting, reporting/moderation
7. Terms, privacy, account deletion
8. Then the growth work in [`ROADMAP.md`](./ROADMAP.md)

Steps 1–4 are roughly a week for one engineer. Steps 5–7 are the difference
between a demo and a business.
