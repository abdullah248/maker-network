# Feature status

Every feature in Maker Network, how finished it actually is, and what is missing.

Stage definitions:

| Stage | Meaning |
| --- | --- |
| ✅ **Complete** | Built, tested, and I would ship it as-is |
| 🟢 **Solid** | Works end to end and is tested; has known rough edges listed below |
| 🟡 **Partial** | Core works but a visible piece is missing |
| 🟠 **Backend only** | Service + API + tests exist, no user interface |
| ⚪ **Not started** | Named here because its absence is felt |

---

## Accounts and authentication

| Feature | Stage | Notes |
| --- | --- | --- |
| Google OAuth sign-in | 🟡 Partial | Fully implemented via Auth.js v5, but no credentials are configured, so it cannot actually be used yet. The UI degrades gracefully and explains why. |
| Development email login | ✅ Complete | Email-only, no password. Hard-disabled when `NODE_ENV=production`; covered by tests. |
| Onboarding account-type picker | ✅ Complete | Customer / makerspace / individual. Routes new accounts correctly from every entry point. |
| Session handling | 🟢 Solid | JWT strategy with a Prisma adapter. Session callback hits the database on every call — fine now, worth caching later. |
| Account deletion / data export | ⚪ Not started | Schema cascades exist; no UI, no policy for reviews the user wrote. |
| Email verification, magic links | ⚪ Not started | Google is the only real provider. |

---

## Maker profiles

| Feature | Stage | Notes |
| --- | --- | --- |
| Makerspace / library profiles | ✅ Complete | Access rules (appointment, membership, library card), membership details, access notes, hours. |
| Individual maker profiles | ✅ Complete | Shipping vs local pickup, custom-order materials with lead time, city-level location. |
| Profile editor | ✅ Complete | Live handle availability, type switching, field-level validation. |
| Machine inventory | ✅ Complete | Catalog of ~65 common machines across 9 categories, plus custom entry; build volume, quantity, hourly/per-job rates. |
| Material inventory | ✅ Complete | Category presets, per-unit pricing in 9 units, colours, specs, stock, custom-order lead days. |
| Operating hours | ✅ Complete | Seven-day editor, closed days, copy-Monday-to-weekdays. |
| Publish / unpublish | ✅ Complete | Drafts are visible only to their owner. |
| Avatar / cover images | ⚪ Not started | `avatarUrl` accepts a URL; there is no upload and the field is unused in the UI. |
| Verification badges | ⚪ Not started | No way to prove a makerspace is real. |

---

## Discovery

| Feature | Stage | Notes |
| --- | --- | --- |
| Landing page | ✅ Complete | Live stats, working search, featured makers, category browse. |
| Directory with filters | 🟢 Solid | Type, machine category, material category, city, shipping, accepting-requests, minimum rating, sort. Tolerates hostile query strings. **Will become case-sensitive on PostgreSQL** — see production readiness doc. |
| Public profile pages | ✅ Complete | Machines, priced materials, access rules, hours, availability calendar, gallery, reviews. |
| Search quality | 🟡 Partial | Substring `LIKE` across name, headline, bio, city, machines and materials. No relevance ranking, no typo tolerance, no index. |
| Location / "near me" | ⚪ Not started | `city` is a text match. `latitude`/`longitude` columns exist but are unused. No geocoding, radius search or map. |

---

## Fabrication requests

| Feature | Stage | Notes |
| --- | --- | --- |
| Request builder | ✅ Complete | Seven sections: files → process → machine & material → dimensions → settings → job details → review. Opens on a process the maker actually owns machines for. |
| Design file uploads | 🟢 Solid | Real multipart upload, drag-and-drop with progress, extension allow-list, 50 MB / 10 file caps. **Stored on local disk** — must move to object storage. |
| FDM specifications | ✅ Complete | Layer height, nozzle, infill % and pattern, walls, top/bottom layers, supports and overhang, bed adhesion, temperature overrides, ironing, watertightness. Draft/Standard/Fine/Strong presets. |
| Resin specifications | ✅ Complete | Layer height, normal and bottom exposure, bottom layers, anti-aliasing, hollowing, drain holes, supports, post-cure. |
| Laser specifications | ✅ Complete | Operation, thickness, passes, power, speed, frequency, engrave DPI, kerf compensation, air assist, focus offset. |
| CNC specifications | ✅ Complete | Stock and thickness, bit diameter, spindle rpm, feed rate, depth per pass, stepover, tabs, tolerance. |
| Physical-limit validation | ✅ Complete | Layer height ≤ 80% of nozzle diameter; part must fit the machine's build volume allowing rotation. |
| Safety guidance | 🟢 Solid | Enclosure-required filaments; materials that must never be lasered. Advisory text only — nothing blocks a dangerous combination. |
| Quick "just send a message" | ✅ Complete | Preserved alongside the full builder. |
| Cost estimation | ⚪ Not started | Makers quote manually. No weight/time estimate from the model. |

---

## Maker review workflow

| Feature | Stage | Notes |
| --- | --- | --- |
| Request queue | ✅ Complete | Status tabs with counts, deadline highlighting, file counts, open requests surfaced first. |
| Request detail + spec sheet | ✅ Complete | Full specification, material temperature guidance, downloadable files. |
| Accept with a quote | 🟢 Solid | Optional price and lead time. Not binding and not enforced anywhere downstream. |
| Decline with a reason | ✅ Complete | Reason is required and quick-picks are offered. |
| Mark complete | ✅ Complete | Only available after acceptance. |
| Decisions posted to chat | ✅ Complete | Every status change writes a message, so the thread is a full record. |
| Counter-offers / negotiation | ⚪ Not started | A quote cannot be revised or formally accepted by the customer. |

---

## Messaging

| Feature | Stage | Notes |
| --- | --- | --- |
| Conversations | ✅ Complete | Participant-only access; non-participants get 404, not 403. |
| Thread view | ✅ Complete | Chat bubbles, spec sheet, files, request actions. |
| New-message polling | 🟢 Solid | 10s polling, visibility-gated. Not realtime; websockets/SSE would be better. |
| Unread counts | ✅ Complete | Header badge and per-conversation counts. |
| Rate limiting | 🟢 Solid | 20 messages/minute per user, shared across messaging and requests. Database-backed, per-user only — no IP limiting. |
| Attachments in chat | ⚪ Not started | Files can only be attached to the original request, not to later messages. |
| Email notifications | ⚪ Not started | **The biggest gap in the product.** Nothing tells a maker a request arrived. |

---

## Galleries and reputation

| Feature | Stage | Notes |
| --- | --- | --- |
| Project gallery | 🟢 Solid | Up to 48 projects with machine/material attribution and featured ordering. Images are **hot-linked URLs**, not uploads. |
| Reviews | ✅ Complete | 1–5 stars, one per customer per maker, verified-project badge when a request was completed, aggregates recomputed transactionally. |
| Maker replies | ✅ Complete | One public reply per review. Makers can respond to criticism but never edit or delete it. |
| Ratings in discovery | ✅ Complete | Shown on cards; minimum-rating filter and rating sort. |
| Review moderation | ⚪ Not started | No reporting, no admin removal of abusive reviews. |

---

## Availability and booking

| Feature | Stage | Notes |
| --- | --- | --- |
| Availability management | ✅ Complete | Slot creation with overlap detection, machine-specific slots, month calendar. |
| Public availability calendar | 🟡 Partial | Renders correctly but is **read-only**. |
| Slot booking | 🟠 Backend only | `bookAvailabilitySlot`, `releaseAvailabilitySlot` and `POST /api/availability/[id]/book` are complete and tested — including double-booking races — but **no button exists**. Roughly a day of UI work. |
| Calendar sync (iCal/Google) | ⚪ Not started | |

---

## Platform and infrastructure

| Feature | Stage | Notes |
| --- | --- | --- |
| Test suite | ✅ Complete | 417 unit/integration/security tests, 48 end-to-end tests. |
| CI/CD | ✅ Complete | Lint, typecheck, test, build, E2E, dependency audit, migration-drift detection. |
| Seed data | ✅ Complete | Five profiles, machines, materials, projects, reviews, a specified request, and sample design files. |
| Database | 🟡 Partial | Works, but SQLite. Schema is Postgres-ready. |
| File storage | 🟡 Partial | Works, but local disk. |
| Observability | ⚪ Not started | No error tracking, metrics or structured logging. |
| Payments | ⚪ Not started | |
| Admin / moderation tools | ⚪ Not started | No admin role exists. |
| Accessibility | 🟢 Solid | Semantic landmarks, labelled controls, keyboard-operable, skip link, accessible star ratings. Never audited with a screen reader or automated tooling. |
| Mobile | 🟢 Solid | Responsive throughout; never tested on a real device. |
| Internationalisation | ⚪ Not started | English and USD only. Currency is stored per material but never converted. |

---

## Honest summary

**What is genuinely done:** the core two-sided marketplace. A maker can describe
their shop in real detail, a customer can find them and send a rigorously
specified job with files attached, and the maker can review, question and decide.
That loop is complete, tested and pleasant to use.

**What is missing to be a product:** notifications, payments, moderation, and
somewhere durable to put the data. The first is the most urgent — without email,
the marketplace only works if both parties happen to be logged in at the same
time.

**Cheapest high-value work:** wire up slot booking (the backend is already
finished), then transactional email.
