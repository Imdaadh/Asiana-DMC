# Travel Itinerary Costing — Proof of Concept

## Status: Proof of Concept. Not the real product.

This repo exists for one reason: to let the team **click through the actual costing
workflow** and confirm it behaves the way it's supposed to, before any real
engineering decisions (database, framework, hosting, auth) get made. Treat
everything in here as disposable scaffolding, not a foundation to build on top of.

If you (Claude Code) are picking this up: **do not** start "productionizing" this —
adding a real backend, a database, auth, etc. — unless explicitly asked. The point
right now is to iterate on the *flow and calculations*, cheaply, in plain HTML.
The one exception, explicitly asked for and already built, is `server.js` — see
"Local server" below; don't take that as license to add anything further backend-y
without being asked the same way.

Background: this POC follows an earlier requirements/user-flow proposal document
(a Word doc with flowcharts and wireframes) that isn't in this repo. If you need
context on the full intended product (Config Admin role, database design, etc.)
and don't have it, ask rather than assuming.

This file is the single source of truth. It has already absorbed two rounds of
requirements (the original build, plus a "Round 2" pass covering mixed room
occupancy, validation, LKR-based driver bata/guide fees, a global per-person/
whole-group display mode, and a fully editable itinerary preview). If another
`NEW_REQUIREMENTS.md`-style file shows up in the repo root, treat it the same
way: implement it, then fold the relevant parts back into this file and delete it.

---

## What this POC actually does

A 5-stage costing wizard, in plain HTML/CSS/vanilla JS, no build step:

1. **Trip Basics** (`trip-basics.html`) — client name, dates, pax count, and a
   **Per Person / Whole Group** toggle ("Cost this itinerary") that controls
   how every dollar total in the rest of the flow is displayed. This is the
   same setting Stage 4 also exposes — either screen can change it.
2. **Hotel Costing** (`hotel-costing.html`) — pick City → Hotel → Nights →
   Meal Plan, then build a **room mix** for that city: one or more room rows,
   each with its own Occupancy (Single/Double/Triple) → Category (Standard/
   Superior/Luxury) → Room Count (required, never silently defaulted to 0) →
   Rate (auto-fills from Config, editable) → an optional **per-room meal plan
   override** (defaults to the hotel-level meal plan unless overridden). Rows
   stage in a pending list before being committed to the itinerary as one
   hotel entry. **There is deliberately no validation tying room count to pax**
   — an earlier revision blocked adding rooms whose combined capacity didn't
   exactly match trip pax (e.g. "covers 5, but this trip has 7"), which turned
   out to be wrong for how this business actually books: children commonly
   share a room with adults rather than requiring their own capacity, and
   operators sometimes deliberately book more rooms than the strict headcount
   implies (e.g. 2 Double rooms for a party of 3). The room mix is purely
   informational now — enter whatever room counts the booking actually needs.
   Nights are the one thing still checked, and checked **preemptively**: a
   live hint shows how many trip nights are still unallocated, and "+ Add to
   Itinerary" is blocked outright (not just flagged afterward) if the Nights
   entered for this city would push the total past the trip's length. "Save &
   Continue" is separately gated on total nights across all hotel entries
   summing to the trip's total nights, checked continuously, with the button
   disabled (not just an alert) until it passes.

   A **Self Booking** checkbox sits above the City/Hotel fields for the case
   where the client arranges their own hotel for a leg of the trip (e.g. they
   book Nuwara Eliya themselves). Checking it collapses the form to just
   City + Nights — no hotel, meal plan, or room mix — and commits a hotel
   entry with `$0` accommodation cost that still counts toward the trip's
   night total (so nights-coverage validation still balances) and still
   implies mileage between cities on the Transportation stage, since that's
   computed independently from distance segments, not from hotel entries.
3. **Transportation** (`transportation.html`) — add distance segments one at a
   time (they sum live); vehicle auto-suggested from pax count (overridable,
   now including **Mini Coach** and **Maxi Coach** tiers above the original
   30-seater). Vehicle rate (LKR/km), driver bata rate (LKR/day), and — only
   for vehicles that carry one — guide fee rate (LKR/day) are each shown as
   their own auto-filled-but-editable LKR→exchange-rate→USD chain, mirroring
   the mileage cost pattern. The Guide Fee block only exists in the DOM when
   the selected vehicle has one (Mini/Maxi Coach) — it's absent, not just
   zeroed, for vehicles without it. Misc expenses are a repeatable
   description+amount list (not a single field), added the same way mileage
   segments are.
4. **Pricing Summary** (`pricing-summary.html`) — sequential receipt-style
   build-up (Accommodation + Transportation → Subtotal → Markup% → Grand Total),
   editable markup override, and the same **Per Person Rate / Total Breakdown**
   toggle as Stage 1 (same stored value, editable from either screen).
5. **Itinerary Preview** (`itinerary-preview.html`) — the client-facing output
   the whole flow exists to produce, reached via "Generate Itinerary Preview"
   on the Pricing Summary screen. Assembles a print-ready document: trip
   title, a day-by-day breakdown, the hotel table, the cost line, cost
   includes/excludes, an entrance-fee reference table (**priced by the
   client's nationality** from Stage 1), check-in/out times, cancellation
   policy, important notes, and a complimentary list, with a "Print / Save as
   PDF" button (`window.print()` — no PDF library). **Every field on this page
   is editable in place** (`contenteditable`, styled with a dashed-outline
   hover/focus affordance that's hidden when printed) so an operator can tweak
   wording or fix a typo for one specific client without touching the
   underlying Config JSON — edits persist to `itinerary.previewOverrides` in
   `localStorage`, seeded once from the computed defaults on first visit. Each
   day also carries a **route dropdown** offering alternate pre-configured
   templates for that city/day-type (e.g. "Kandy City Tour" vs. "Kandy →
   Sigiriya Day Trip") — swapping it updates the description, which stays
   further hand-editable afterward. Company branding is a placeholder
   (`[ Your Company Name / Logo ]`) — deliberately not a real logo, since
   that wasn't finalized when this was built.

State for the itinerary currently being built is carried between these five
pages via `localStorage` (key `poc_current_itinerary`) — no server involved.
Clicking "Save Itinerary" on the Pricing Summary page persists a snapshot via
the local server (see "Local server" below) into `db/savedItineraries.json`
and clears the working itinerary.

`index.html` is the dashboard. It has two entry points into the flow:
- **Start New Inquiry (Blank)** — empty itinerary.
- **Load Sample Inquiry — Priyanshu Aggarwal** — pre-fills Stage 1 with a real
  example inquiry (adapted from an actual Sri Lanka itinerary the client sent
  over), and Stage 2/3 auto-resolve into full line items using this POC's
  3-city sample dataset. Use this to demo the whole flow quickly without
  clicking through empty forms. Note: the sample's hotel entries intentionally
  cover only 4 of the trip's 6 nights (the original itinerary's Nuwara Eliya
  and Yala legs aren't in this POC's 3-city dataset) — the Stage 2 nights
  validation will flag this exactly as it would for a real under-allocated
  itinerary; that's expected, not a bug, given the sample's documented scope.

`existing-itineraries.html` shows one seeded read-only reference row plus
every saved itinerary, with a **text search** box (matches client name or
city, filters the saved list live) and two actions per row: **View** reopens
`itinerary-preview.html?savedId=<id>` in a dedicated **read-only mode** — no
`contenteditable`, no day-route dropdowns, nothing writes back to
`poc_current_itinerary` or the saved record itself — and **Use This** is the
"reuse an existing itinerary" flow from the original proposal: it deep-clones
that record's `itinerarySnapshot` (minus `previewOverrides`, so the preview
regenerates fresh) into `poc_current_itinerary` and sends the operator to
Stage 1 to update client name/dates and continue from there with hotels/
transport already filled in. It still does **not** implement the city/nights-combo
structured search described in the original proposal (this is a plain
substring filter) — that's real future work, not part of this POC's scope.

---

## What's hardcoded / mocked right now (intentionally)

All of this is meant to be thrown away or replaced once the real build starts:

- **All master data lives in flat JSON files** under `/data/` — 3 cities, 3
  hotels per city, room rates for Single/Double/Triple × Standard/Superior/
  Luxury, 4 meal plans, 6 vehicle types (Sedan → Maxi Coach, two of which
  carry a guide fee), one pricing-settings file (markup %, exchange rate),
  multi-option tour route templates per city (`tourTemplates.json`), and
  static commercial boilerplate for the preview document
  (`inclusionsExclusions.json`, `entranceFees.json` — the latter priced per
  nationality). There is no admin UI to edit any of this — you'd hand-edit
  the JSON.
- **No authentication / SSO.** The page just loads straight into the
  dashboard. There's a cosmetic "Operator" badge in the sidebar and nothing
  else.
- **No real backend or database** beyond the one narrow exception below.
  All calculation happens client-side in `assets/app.js`. The itinerary
  *currently being built* persists only via browser `localStorage`, only in
  the browser that created it.
- **Itinerary Preview boilerplate is generic**, not the real agency's actual
  legal/commercial text, entrance-fee prices, or tour descriptions — it's
  illustrative content shaped like the real reference document, not a copy
  of any specific company's terms. Vehicle rates, hotel rates, and the
  Mini/Maxi Coach capacities/rates are similarly illustrative sample figures.
- **Hosting is GitHub Pages** (static files only) — fine for a click-through
  demo, meaningless as a signal for what the real product's hosting should be.

## Local server (server.js) — the one deliberate exception to "no backend"

Saved itineraries were originally localStorage-only (like everything else),
which meant "Existing Itineraries" only ever showed what one specific browser
had saved. That was explicitly asked to change to a real file on disk that
updates whenever an itinerary is saved — the only way to do that for real is
a server, so `server.js` exists: a minimal Express app with exactly two
routes (`GET /api/itineraries`, `POST /api/itineraries`), reading and writing
`db/savedItineraries.json`, and serving the rest of the site as static files
(`express.static`) so `npm start` is the one command that runs everything.

This is a narrow, deliberate exception — it exists **only** to persist saved
itineraries. It does not calculate anything, does not touch the working
itinerary in `localStorage`, and shouldn't be extended to cover other
POC state without being asked, the same way this was. `assets/app.js`'s
`getSavedItineraries()`/`pushSavedItinerary()` are the only functions that
talk to it (both `async`, calling `fetch('/api/itineraries')`); every page
that calls them (`index.html`, `existing-itineraries.html`,
`pricing-summary.html`, `itinerary-preview.html`) awaits them and shows a
toast if the server isn't reachable, rather than failing silently.

**Consequence for deployment:** GitHub Pages (static-file-only hosting) can
serve every page and JSON file in this repo, but it cannot run `server.js` —
so on the live GitHub Pages URL, "Save Itinerary" and "Existing Itineraries"
will show a "could not reach the itinerary server" toast and an empty list.
Everything else (Stages 1–4, itinerary preview for the itinerary currently
being built) still works fine there, since none of that touches the server.
Running this for real in production would need a host that runs Node
(Render, Railway, a small VPS, etc.) — not decided, not this POC's job to
decide, consistent with everything else in "What happens later" below.

## Documented but explicitly NOT implemented: Google Maps distance auto-calc

The Transportation screen requires manually typing each distance segment. The
eventual goal is to auto-calculate distance between selected cities via a
Google Maps API (Distance Matrix or Routes API), pre-filling the segment while
still leaving it editable/overridable — same pattern as every other
Config-sourced value in this app. **This has been deliberately deferred, not
built, for two reasons:**

- **Security/cost:** this POC is a static site with no backend. A Google Maps
  API key called directly from client-side JS is visible to anyone who views
  page source — restrictable by HTTP referrer, but still exposed to
  quota-draining abuse, with no server to hide it behind.
- **Billing/ownership:** Google Maps API is metered past a free tier, and
  there's no decision yet on who owns that key or where it's stored.

When this is picked up for real: add a small backend endpoint (even a single
serverless function) that takes an origin/destination pair, calls Google's API
server-side with a restricted key, and returns the distance — the frontend
never talks to Google directly. Until then, manual entry stays as-is.

## What happens later (explicitly NOT decided here)

None of the following has been chosen yet, and this POC should not be read as
an implicit vote for any of them:

- Real database (a relational DB — e.g. Postgres — was recommended in the
  earlier proposal doc, given how relational the City → Hotel → Room Type →
  Itinerary Leg data is, but nothing is final)
- Real backend framework / API layer
- Real authentication (company SSO)
- A proper Config Admin panel to manage cities/hotels/rates/vehicles/pricing
  instead of hand-edited JSON
- Production hosting platform
- Whatever frontend framework the real build uses (this POC deliberately
  avoids that decision by using zero framework)
- Whether child rates should differ from adult rates for hotel costing (still
  pax-count only), whether Operators should see other Operators' saved
  itineraries, whether a senior-staff approval step is needed before an
  itinerary is finalized, and whether a hotel rate change in Config should
  update or leave alone already-built itineraries — all open questions from
  the original proposal doc, still unresolved.

When the team is ready to make those calls, this repo's job is done — its
only output should be "yes, the flow and calculations work the way we want,"
or a list of things to change before building for real.

---

## Core calculation model (assets/app.js)

Everything is computed and stored in whole-group USD internally, regardless of
display mode. **Stages 2 and 3 (Hotel Costing, Transportation) always show
whole-group totals** — Line Total, room-mix rollups, the Hotels Added table,
every Transportation calc-row, and both pages' ledgers are cost-*building*
views for the operator, not the client quote, so dividing them by pax was
tried (per an earlier revision of this doc) and reverted after real usage
showed it made the on-screen math look wrong (e.g. a "$80 × 2 nights × 3
rooms" calculation showing a divided "Line Total" that didn't match).

The Per Person / Whole Group choice (`itinerary.pricing.displayMode`, set on
Stage 1 or Stage 4) only changes **Stage 4's receipt and final display, and
Stage 5's cost line** — the two places an actual client-facing price is being
decided, both of which have a visible toggle right on the page. Use
`displayAmount(usdWholeGroupAmount, itinerary)` (divides by pax when
`displayMode === 'perPerson'`, otherwise identity) only in those two places —
don't reintroduce it to Stage 2/3's cost-building figures.

- `itinerary.hotels[]` — one entry per city stay: `{ cityId, cityName, hotelId,
  hotelName, star, nights, mealPlanId, mealPlanName, roomMix: [{ occupancy,
  category, rooms, rate, mealPlanId, mealPlanName, total }], total }`. Each
  `roomMix` row's `mealPlanId`/`mealPlanName` defaults to the hotel-level meal
  plan unless explicitly overridden per row. A self-booked entry instead has
  `selfBooking: true`, `hotelId/hotelName/star/mealPlanId/mealPlanName: null`,
  `roomMix: []`, `total: 0` — `nights` is still set and still counts toward
  the trip's night total.
- `itinerary.transport` — `{ mileageSegments: [{km,label}], vehicleId,
  miscExpenses: [{description, amountUsd}], rateOverrideLkrPerKm,
  driverBataOverrideLkrPerDay, guideFeeOverrideLkrPerDay }`. The three
  overrides are `null` until the operator edits that field, falling back to
  the selected vehicle's config values; they're cleared automatically when
  the vehicle selection changes.
- `itinerary.pricing.displayMode` — `'perPerson'` or `'totalBreakdown'`,
  settable from Stage 1 or Stage 4.
- `itinerary.previewOverrides` — seeded once by `itinerary-preview.html` from
  computed defaults, then the source of truth for everything rendered there.
- Exchange rate stays the one Config value that is **never** operator-editable
  anywhere in the app (Admin-only, locked badge) — everything else
  Config-sourced (hotel rate, vehicle rate/km, driver bata rate, guide fee
  rate) auto-fills but is always overridable at the point of use.

---

## Repo structure

```
/index.html                 Dashboard — start new / load sample / existing itineraries
/trip-basics.html           Stage 1 — trip basics + Per Person/Whole Group toggle
/hotel-costing.html         Stage 2 — room-mix builder + live validation + self-booking
/transportation.html        Stage 3 — mileage, vehicle, driver bata, guide fee, misc expenses
/pricing-summary.html       Stage 4 — receipt build-up + final display toggle
/itinerary-preview.html     Stage 5 — fully editable print-ready client document,
                             also a read-only viewer via ?savedId=<id>
/existing-itineraries.html  Search + reopen saved itineraries
/assets/styles.css          Shared design system (single file, plain CSS) —
                             used by the console pages; itinerary-preview.html
                             layers its own document-specific <style> on top
/assets/app.js              Shared logic: data loading, localStorage state,
                             all cost/markup calculations, display-mode
                             helper, day-by-day plan generation, shared page
                             chrome (sidebar + topbar + stepper), and the
                             fetch() calls to the local server (below)
/data/*.json                Static seed/config data + pricing settings + the
                             pre-fillable sample inquiry + itinerary preview
                             content (tourTemplates.json — multiple route
                             options per city, inclusionsExclusions.json,
                             entranceFees.json — priced by nationality) —
                             all read-only, hand-edited, never written by the app
/server.js                  Local server — see "Local server" above
/package.json               Declares the one dependency (express) + `npm start`
/db/savedItineraries.json   Written by server.js, gitignored — the real,
                             on-disk saved-itineraries store
```

Every page is still a plain `.html` file loading `assets/styles.css` and
`assets/app.js` directly — no build step, no bundler, no framework, no JSX/TS
to compile. `package.json` exists solely to install `express` and run
`server.js`; it isn't a build tool here.

## How to run locally

```bash
npm install   # first time only
npm start
```

Then open `http://localhost:8000`. This serves every page **and** the
`/api/itineraries` routes `server.js` needs for Save/Existing Itineraries —
opening `index.html` directly via `file://`, or serving the folder with a
plain static server (`python3 -m http.server`, `npx serve .`), will load the
pages fine but Save Itinerary / Existing Itineraries will fail with a
"could not reach the itinerary server" toast, since there's no `/api/*`
backend behind them in that case.

## Deployment

Static pages are deployed via **GitHub Pages**, using the GitHub Actions
workflow at `.github/workflows/deploy.yml` (Pages source set to "GitHub
Actions" in repo settings) — it uploads the repo root as-is on every push to
`main`. **This does not run `server.js`** — GitHub Pages can't run Node — so
on the live GitHub Pages URL, Save Itinerary / Existing Itineraries behave as
described in "Local server" above (toast + empty list) while every other
stage works normally. Running the server in production needs a host that
runs Node; not decided yet, see "What happens later."
