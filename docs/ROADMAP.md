# Roadmap and product ideas

Suggestions for making Maker Network better, ordered by how much value they
deliver relative to effort. This is opinion, informed by what the codebase can
already support — see [`FEATURE_STATUS.md`](./FEATURE_STATUS.md) for what exists
and [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) for what blocks launch.

---

## The one-line version

The product's hardest problem is not features — it is **liquidity and trust**.
A directory with ten makers is useless; a directory where a request goes
unanswered for a week is worse than useless. Almost everything below is aimed at
those two problems.

---

## Tier 1 — Do these next

### 1. Transactional email

**Effort: small. Impact: enormous.**

Right now the marketplace only works if both people happen to be logged in.
Notify on: new request, accepted/declined, new message, new review, deadline
approaching. Include a magic link straight to the thread.

This is the single highest-leverage change available.

### 2. Finish slot booking

**Effort: ~1 day. Impact: high.**

`bookAvailabilitySlot` is written, tested and exposed over HTTP; the public
calendar just has no button. For makerspaces — where the product is *time on a
machine* rather than a finished part — this is the core transaction, and it is
95% built.

### 3. Response-time signals

**Effort: small. Impact: high.**

Show "usually replies within a day" on profile cards, computed from the gap
between request creation and first maker reply. Two effects: customers pick
responsive makers, and makers see their own number and improve it. Sort the
directory by it.

Also auto-expire requests left untouched for 7 days so customers are not left
hanging, and show makers a "needs your reply" count.

### 4. Save a machine profile as a reusable preset

**Effort: small. Impact: medium-high.**

Customers who order repeatedly re-enter the same settings every time. Let them
save "my usual PETG functional print" and apply it in one click. Let makers
publish *their* recommended presets ("my tuned PETG profile") — which is also a
differentiator between makers.

---

## Tier 2 — Build the business

### 5. Payments with escrow

**Effort: large. Impact: high.**

Stripe Connect: customer pays when a quote is accepted, funds are held, released
on completion. Enables a take rate, and removes the "will this stranger actually
pay me / actually deliver?" anxiety on both sides. Needs a dispute process, which
is as much policy as code.

### 6. Automatic quoting from the uploaded model

**Effort: large. Impact: high.**

Parse the STL server-side for bounding box and volume, estimate material grams
and print time, then multiply by the maker's own material price and hourly rate
to produce an instant estimate the maker can adjust.

This turns a multi-hour back-and-forth into an instant number. It also feeds
build-volume validation from the real model instead of hand-typed dimensions.
Start with bounding box and volume — even that is a large improvement.

### 7. Reviews with photos, and a completion loop

**Effort: medium. Impact: medium-high.**

When a request is marked complete, prompt the customer to review *and* upload a
photo of the result. Those photos, with permission, become the maker's gallery —
which today they must populate manually. Real customer photos are far more
persuasive than self-published ones.

### 8. Moderation and trust tooling

**Effort: medium. Impact: high, and a launch requirement.**

Report buttons, a moderation queue, an admin role, the ability to unpublish. Plus
verification: confirm a makerspace is a real organisation, and badge it.

---

## Tier 3 — Growth and depth

### 9. Location and maps

Geocode `city` into the unused `latitude`/`longitude` columns, add radius search
and a map view. "Makers near me" is the most obvious missing affordance in a
local-fabrication directory.

### 10. Public request board

Let customers post a job openly and have makers bid, instead of picking one maker
blind. Fixes the cold-start problem from the other direction: a customer with no
idea who to ask gets several quotes. This is a significant shift in marketplace
dynamics — worth prototyping before committing.

### 11. Materials marketplace

Makerspaces already list materials at cost. Let people buy material without
buying a print — filament, sheet stock, a laser-cutting blank. Low effort given
the inventory model already exists.

### 12. Classes and workshops

Libraries and makerspaces run these constantly and have nowhere good to list
them. `AvailabilitySlot` is most of the model already: add a capacity > 1 event
with a description and a signup list. Strong community hook and a genuine
acquisition channel for makerspaces.

### 13. Machine-time subscriptions for makerspaces

Membership handling today is a text field. Real membership tiers, with booking
allowances attached, would make the product genuinely operational for a
makerspace rather than just a listing.

---

## Technical improvements worth doing

### Realtime instead of polling
The thread polls every 10 seconds. Server-Sent Events or a websocket would be
cheaper and feel instant. SSE is the smaller change and fits the read-mostly
pattern.

### Optimistic UI on the dashboard
Every dashboard mutation does a full `router.refresh()`. Fine, but a visible
pause. Optimistic updates would make the app feel much faster for the same
correctness.

### Extract a design-system package
`src/components/ui.tsx` is doing a lot in one file. As the surface grows, split
it and add Storybook or similar so components can be reviewed in isolation.

### Visual regression testing
The Playwright suite tests behaviour, not appearance. Screenshot diffing would
catch layout regressions — several bugs I hit during development were visual and
only found by looking.

### Accessibility audit
The markup is careful — semantic landmarks, labelled controls, accessible star
ratings — but has never been through axe or a screen reader. Add `@axe-core/playwright`
to the E2E suite and do one manual VoiceOver pass.

### Structured logging and analytics
Beyond error tracking, instrument the funnel: profile views → request started →
request sent → accepted → completed. You cannot improve conversion you cannot
see. Where do customers abandon the request builder? That form is long.

---

## Things I would deliberately *not* build yet

- **A mobile app.** The web app is responsive; a native app solves nothing you
  have today and doubles the surface area.
- **AI-generated 3D models.** Tempting and fashionable, but it does not serve the
  core loop, and the quality bar for printable geometry is high.
- **Social features** (following, feeds, likes). Directories that chase
  engagement usually dilute the transaction. Reviews and galleries already cover
  the trust need.
- **Multi-language support.** Not before you know which second market you want.

---

## If I could only pick three

1. **Email notifications** — without them the marketplace does not really function.
2. **Slot booking UI** — a day's work to finish something already built and tested.
3. **Automatic quoting from the model** — the genuinely differentiating feature,
   and the reason someone would choose this over a Facebook group.
