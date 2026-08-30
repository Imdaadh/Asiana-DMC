# Travel Itinerary Costing — Proof of Concept

## Status: Proof of Concept. Not the real product.

This repo exists for one reason: to let the team **click through the actual costing
workflow** and confirm it behaves the way it's supposed to, before any real
engineering decisions (database, framework, hosting, auth) get made. Treat
everything in here as disposable scaffolding, not a foundation to build on top of.

If you (Claude Code) are picking this up: **do not** start "productionizing" this —
adding a real backend, a database, auth, etc. — unless explicitly asked. The point
right now is to iterate on the *flow and calculations*, cheaply, in plain HTML.

Background: this POC follows an earlier requirements/user-flow proposal document
(a Word doc with flowcharts and wireframes) that isn't in this repo. If you need
context on the full intended product (Config Admin role, database design, etc.)
and don't have it, ask rather than assuming.

---

## What this POC actually does

A 5-stage costing wizard, in plain HTML/CSS/vanilla JS, no build step:

1. **Trip Basics** (`trip-basics.html`) — client name, dates, pax count.
2. **Hotel Costing** (`hotel-costing.html`) — pick city → hotel → occupancy →
   room category → meal plan; rate auto-fills from the JSON data but is editable;
   add multiple cities; running accommodation subtotal.
3. **Transportation** (`transportation.html`) — add distance segments one at a
   time (they sum live), vehicle auto-suggested from pax count (overridable),
   LKR→USD conversion, driver bata, misc expenses.
4. **Pricing Summary** (`pricing-summary.html`) — sequential receipt-style
   build-up (Accommodation + Transportation → Subtotal → Markup% → Grand Total),
   editable markup override, and a **Per Person Rate / Total Breakdown** toggle
   for the final client-facing number.
5. **Itinerary Preview** (`itinerary-preview.html`) — the client-facing output
   the whole flow exists to produce. Assembles trip title, a generated
   day-by-day breakdown (from `data/tourTemplates.json`, keyed by city), the
   hotel table, the cost line (respecting whichever display mode was chosen
   on Pricing Summary), cost includes/excludes, an entrance-fee reference
   table, check-in/out times, cancellation policy, important notes, and a
   complimentary list — all rendered as a print-ready document with its own
   `@media print` stylesheet. A "Print / Save as PDF" button calls
   `window.print()`; there's no PDF-generation library, the browser's native
   print-to-PDF is the output mechanism. Reached via "Generate Itinerary
   Preview" on the Pricing Summary screen. Company branding is a placeholder
   (`[ Your Company Name / Logo ]`) — deliberately not a real logo, since
   that wasn't finalized when this was built.

State for the itinerary currently being built is carried between these five
pages via `localStorage` (key `poc_current_itinerary`) — there is no backend.
Clicking "Save Itinerary" on the Pricing Summary page pushes a snapshot into
`localStorage` under `poc_saved_itineraries` and clears the working itinerary.

`index.html` is the dashboard. It has two entry points into the flow:
- **Start New Inquiry (Blank)** — empty itinerary.
- **Load Sample Inquiry — Priyanshu Aggarwal** — pre-fills Stage 1 with a real
  example inquiry (adapted from an actual Sri Lanka itinerary the client sent
  over), and Stage 2/3 auto-resolve into full line items using this POC's
  3-city sample dataset. Use this to demo the whole flow quickly without
  clicking through empty forms.

`existing-itineraries.html` is an intentional **stub** — it shows one seeded
read-only reference row plus whatever's been saved this browser session. It
does **not** implement the city/nights-combo filtered search described in the
original proposal. That's real future work, not part of this POC's scope.

---

## What's hardcoded / mocked right now (intentionally)

All of this is meant to be thrown away or replaced once the real build starts:

- **All master data lives in flat JSON files** under `/data/` — 3 cities, 3
  hotels per city, room rates for Single/Double × Standard/Superior/Luxury,
  4 meal plans, 4 vehicle types, one pricing-settings file (markup %,
  exchange rate), per-city tour route text for the itinerary preview
  (`tourTemplates.json`), and static commercial boilerplate for the preview
  document (`inclusionsExclusions.json`, `entranceFees.json`). There is no
  admin UI to edit any of this — you'd hand-edit the JSON.
- **No authentication / SSO.** The page just loads straight into the
  dashboard. There's a cosmetic "Operator" badge in the sidebar and nothing
  else.
- **No backend, no database.** All calculation happens client-side in
  `assets/app.js`. State persists only via browser `localStorage`, only in
  the browser that created it — nothing is shared across users or devices.
- **"Existing Itineraries" is a static stub**, not a real searchable list.
- **Itinerary Preview boilerplate is generic**, not the real agency's actual
  legal/commercial text, entrance-fee prices, or tour descriptions — it's
  illustrative content shaped like the real reference document, not a copy
  of any specific company's terms.
- **Hosting is GitHub Pages** (static files only) — fine for a click-through
  demo, meaningless as a signal for what the real product's hosting should be.

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

When the team is ready to make those calls, this repo's job is done — its
only output should be "yes, the flow and calculations work the way we want,"
or a list of things to change before building for real.

---

## Repo structure

```
/index.html                 Dashboard — start new / load sample / existing itineraries
/trip-basics.html           Stage 1
/hotel-costing.html         Stage 2
/transportation.html        Stage 3
/pricing-summary.html       Stage 4
/itinerary-preview.html     Stage 5 — print-ready client-facing document
/existing-itineraries.html  Stub list page
/assets/styles.css          Shared design system (single file, plain CSS) —
                             used by the console pages; itinerary-preview.html
                             layers its own document-specific <style> on top
/assets/app.js              Shared logic: data loading, localStorage state,
                             all cost/markup calculations, day-by-day plan
                             generation, shared page chrome (sidebar + topbar
                             + stepper)
/data/*.json                All sample master data + pricing settings +
                             the pre-fillable sample inquiry + itinerary
                             preview content (tourTemplates.json,
                             inclusionsExclusions.json, entranceFees.json)
```

There is no build step, no bundler, no package.json. Every page is a plain
`.html` file that loads `assets/styles.css` and `assets/app.js` directly.

## How to run locally

Because pages `fetch()` the JSON files in `/data/`, opening `index.html`
directly via `file://` will fail (browsers block `fetch` on `file://` origins).
Serve the folder over HTTP instead, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed localhost URL.

## Deployment

This is deployed as a static site via **GitHub Pages**, serving directly from
this branch. No build step is needed — GitHub Pages can serve the repo root
as-is.
