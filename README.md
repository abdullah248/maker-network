# Maker Network

A directory and request platform that connects people who need something fabricated with the machines — and machine owners — who can make it.

Three audiences share one product:

| Who | What they do |
| --- | --- |
| **Makerspaces, libraries and organizations** | List machines open to the public, materials sold at cost, hours of operation, access rules (appointment / membership / library card), and an availability calendar people can book. |
| **Individual makers** | List the printers and cutters they own (picked from a catalog of common machines or entered custom), materials they stock, whether they can custom-order material, their general location, and whether they ship or do local pickup only. |
| **Customers** | Browse and filter maker profiles, view project galleries and reviews, send structured print requests, and message makers directly. |

## Feature overview

- **Google OAuth sign-in** via Auth.js v5, with a development-only credentials provider that is hard-disabled in production builds.
- **Onboarding** that routes each account type to the right setup flow.
- **Provider dashboard** — profile editor with live handle availability, machine catalog with custom entry, priced material inventory, weekly hours editor, availability calendar, project gallery and a reviews inbox.
- **Public directory** with search plus filters for profile type, machine category, material category, city, shipping, availability and minimum rating.
- **Public profiles** showing machines, priced materials, access requirements, weekly hours, a bookable availability calendar, a project gallery and customer reviews.
- **Project gallery** — makers post photos of things they have actually made, optionally attributed to the machine and material used.
- **Reviews** — 1-5 star ratings with written feedback, one review per customer per maker, a "verified project" badge when the reviewer completed a request, and a single public reply from the maker. Makers can respond to criticism but can never edit or delete it.
- **Messaging and print requests** — structured requests (machine, material, quantity, fulfilment, budget, deadline, file link) that open a conversation, with unread counts, polling for new messages and accept/decline/complete/cancel status transitions.

## Stack

- **Next.js 16** (App Router, React 19, server components by default)
- **TypeScript** in strict mode
- **Tailwind CSS v4** with a small hand-rolled component kit (`src/components/ui.tsx`)
- **Prisma 6** against SQLite for local development and CI. The schema deliberately avoids SQLite-only constructs (no native enums, no scalar lists), so switching the `datasource` block to PostgreSQL is the only change needed for production.
- **Auth.js v5** (`next-auth@5`) with the Prisma adapter
- **Zod 4** for every piece of input validation
- **Vitest** for unit, integration and adversarial tests; **Playwright** for end-to-end tests

## Getting started

```bash
npm install
cp .env.example .env      # then fill in the Google OAuth values
npm run db:migrate        # create the SQLite database
npm run db:seed           # load demo makerspaces, makers, projects and reviews
npm run dev
```

Visit http://localhost:3000.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma connection string, e.g. `file:./dev.db` |
| `AUTH_SECRET` | Auth.js signing secret. Generate with `npx auth secret`. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client credentials. When unset, the sign-in page explains that Google is not configured instead of failing. |
| `AUTH_TRUST_HOST` | Set to `true` when running behind a proxy. |
| `ENABLE_DEV_LOGIN` | Enables the email-only test login. Ignored entirely when `NODE_ENV=production`. |

To set up Google OAuth, create an OAuth 2.0 client in the Google Cloud console and add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Generate the Prisma client and build for production |
| `npm run lint` | ESLint across the repo |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit, integration and security suites |
| `npm run test:e2e` | Playwright end-to-end suite (boots its own seeded database and dev server) |
| `npm run db:migrate` / `db:deploy` / `db:reset` / `db:seed` / `db:studio` | Prisma workflows |

## Architecture

```
src/
  app/
    page.tsx browse/ p/[slug]/    public landing, directory and maker profiles
    how-it-works/ safety/         informational pages
    signin/ onboarding/           authentication and account-type selection
    dashboard/                    provider-only: profile, machines, materials,
                                  gallery, reviews, hours, availability
    messages/                     inbox and conversation threads
    requests/new/                 structured print request + direct message form
    api/                          thin route handlers over the service layer
  components/                     shared UI kit, public, dashboard and messaging
  lib/
    validation.ts                 every Zod schema in the app
    services/                     all business logic and authorization
    auth.ts db.ts                 Auth.js and Prisma singletons
```

**The service layer is the security boundary.** Route handlers and server actions do three things: resolve the caller's id from the session, parse the body, and delegate. Every mutating service re-derives the caller's profile from their session user id, so a `profileId` or `userId` supplied by a client is never trusted.

## Security model

The design decisions that the adversarial test suite locks in:

- **Ownership is always re-derived server-side.** `requireOwnedProfile(userId)` looks the profile up by session user id; client-supplied ids are ignored. Cross-tenant writes to machines, materials, slots, gallery items and reviews are rejected.
- **Conversations 404 rather than 403** for non-participants, so ids cannot be probed for existence.
- **Strict schemas.** Input objects use `.strict()`, so mass-assignment attempts (`profileId`, `verified`, `providerResponse`, `status`) are rejected outright rather than silently dropped.
- **URLs are protocol-checked.** Websites, file links and gallery images accept `http(s)` only — `javascript:`, `data:`, `vbscript:`, `file:` and protocol-relative URLs are rejected.
- **No raw HTML rendering.** User content is escaped by React; `dangerouslySetInnerHTML` is not used anywhere.
- **Third-party images are not proxied.** Gallery images render through a plain `<img>` rather than the Next image optimizer, so the server never fetches arbitrary user-supplied URLs.
- **Open redirects are blocked.** `safeCallbackUrl` accepts only single-slash relative paths, rejecting `//host`, `/\host`, absolute URLs and control characters.
- **Rate limiting** on message sends, and per-profile caps on gallery items.
- **Reputation integrity.** Makers cannot review themselves, cannot edit or delete reviews of their shop, and one account can leave at most one review per maker. Rating aggregates are recomputed inside the same transaction as the review write.
- **The test login cannot ship.** `devLoginEnabled()` returns false whenever `NODE_ENV === "production"`, regardless of environment configuration.

## Testing

```bash
npm run test        # 272 unit, integration and adversarial tests
npm run test:e2e    # 33 Playwright end-to-end tests
```

- `tests/unit` — validation schema behaviour
- `tests/integration` — service layer against a real migrated SQLite database
- `tests/security` — adversarial cases: IDOR, mass assignment, injection, prototype pollution, XSS payload handling, rate limits, race conditions, review manipulation
- `tests/e2e` — full journeys: provider onboarding through to being discoverable, customer request through to a two-sided conversation, gallery and review flows, and access-control probes

Each Vitest worker copies a pre-migrated template database, so suites run in parallel without contending on SQLite. Playwright builds its own seeded database and boots a dev server (the production build intentionally cannot use the test login).

## CI/CD

`.github/workflows/ci.yml` runs on every pull request:

| Job | What it checks |
| --- | --- |
| `quality` | lint, typecheck, unit + integration + security tests |
| `build` | production build |
| `e2e` | Playwright suite with cached browsers and an uploaded HTML report |
| `security` | `npm audit` on production dependencies (dev advisories are informational) |
| `migrations` | fails if `schema.prisma` has drifted from the committed migration history |

Dependabot keeps dependencies current in grouped weekly PRs, and `.github/pull_request_template.md` includes a security checklist.

## Production notes

- Point the Prisma `datasource` at PostgreSQL and run `npm run db:deploy`. No model changes are required.
- Image and file handling is URL-based today. Adding real uploads means introducing object storage and swapping the `imageUrl` / `fileUrl` fields for signed upload flows.
- The message rate limit is database-backed and per-user; a multi-instance deployment would benefit from moving it to a shared cache.
