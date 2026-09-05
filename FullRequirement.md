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

**There is a second file, `NEW_REQUIREMENTS.md`, in this same repo root.** It
describes a round of changes to this POC that came after the version described
below. Read both files before making changes — `NEW_REQUIREMENTS.md` takes
precedence wherever it conflicts with what's described here, since it's the
more recent instruction. Once those changes are implemented, fold them into
this file and retire `NEW_REQUIREMENTS.md` so there's a single source of truth
again.

---

## What this POC actually does

A 4-stage costing wizard, in plain HTML/CSS/vanilla JS, no build step:

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
5. **Generate Itinerary PDF** — ⚠️ **not built yet, see below.** This is the
   actual final output the whole flow exists to produce, and it's missing.

State for the itinerary currently being built is carried between these four
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
  4 meal plans, 4 vehicle types, and one pricing-settings file (markup %,
  exchange rate). There is no admin UI to edit this data — you'd hand-edit
  the JSON.
- **No authentication / SSO.** The page just loads straight into the
  dashboard. There's a cosmetic "Operator" badge in the sidebar and nothing
  else.
- **No backend, no database.** All calculation happens client-side in
  `assets/app.js`. State persists only via browser `localStorage`, only in
  the browser that created it — nothing is shared across users or devices.
- **"Existing Itineraries" is a static stub**, not a real searchable list.
- **There is no final PDF output yet** — see "Missing piece" section below.
  This is the most important gap: the costing flow currently ends at a price
  on screen, not the client-facing document it's supposed to produce.
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

## Missing piece: Generate Itinerary PDF (needs to be built)

The whole point of the costing flow is to end in a client-facing document —
the client never sees the Costing Console, they see a PDF. A real example of
that target document was shared during requirements gathering (a Travel
Triangle-branded Sri Lanka itinerary quote). This POC does not yet produce
that PDF. It should.

**Add a step after Pricing Summary** — a "Generate Itinerary Preview" or
similar button that assembles everything entered in Stages 1–4 into a
print-ready HTML page matching this structure (taken directly from the real
reference document):

1. **Title** — built from trip params, e.g. "SRI LANKA ITINERARY 6N–7D".
2. **Day-by-day breakdown** — one block per day:
   `Day N – [date] | [Route, e.g. "Kandy – Nuwara Eliya"]`, a short
   description paragraph of what happens that day, ending with
   `Overnight Stay: [City]`. In the real proposal doc for this project, this
   was meant to pull from admin-configured "Tour Route Templates" per city
   (with the operator able to override text per day) — that data doesn't
   exist yet in this POC's `/data/` folder and would need to be added
   (e.g. a `tourTemplates.json` keyed by city, with a default description
   Claude Code can seed from the hotels already in the sample dataset).
3. **Hotel table** — City | Nights | Hotel | Room (occupancy + category) —
   this data already exists in the itinerary object (`itinerary.hotels`),
   just needs to be rendered as a table matching the reference doc's layout.
4. **Cost line** — e.g. "Cost: 6 Adults – Indian Nationals" /
   "$X per person sharing a Double Room × 6 pax (3 Double Rooms)" — should
   reflect whichever display mode (Per Person Rate vs. Total Breakdown) was
   chosen on the Pricing Summary screen. All the numbers for this already
   exist in `computePricing()` in `assets/app.js`.
5. **Cost Includes / Cost Excludes** — bulleted boilerplate (meet & greet,
   accommodation, meals per selected board basis, transport, guide, taxes,
   SIM card, etc. / entry visa, entrance fees, tips, travel insurance, etc.).
   This is static legal/commercial boilerplate, not derived from the costing
   data — store it as its own JSON (e.g. `data/inclusionsExclusions.json`) so
   it's at least centralized and editable without touching HTML.
6. **Entrance Fees (per person)** — a reference price list (Pinnawala
   Elephant Orphanage, Botanical Gardens, Temple of the Tooth, Yala Jeep
   Safari, etc.) — again static reference data, not part of the cost
   calculation itself. Store as `data/entranceFees.json`.
7. **Check-in / Check-out timings** — fixed boilerplate (e.g. 14:00 / 12:00).
8. **Cancellation Policy** — fixed boilerplate tiers (e.g. 30+ days: no
   cancellation fee; 29–15 days: 50%; 14–1 days: 100%).
9. **Important Note** — fixed boilerplate (dress code for temples, pricing
   is net and non-commissionable, no refunds for unused services, etc.).
10. **Complimentary** — fixed boilerplate list (mineral water, gem museum
    visit, spice garden, etc.).
11. **Company branding footer** — logo/name. Needs a placeholder here since
    the real agency's branding isn't finalized; don't hardcode a specific
    company's logo without checking first.

**Suggested approach for this POC** (keep it cheap, no new dependencies):
render this as its own HTML page (e.g. `itinerary-preview.html`), styled with
a `@media print` stylesheet, and let the user use the browser's native
"Print → Save as PDF" — that's a real, working PDF output without adding a
PDF-generation library. If a one-click "Download PDF" button is wanted
instead of the browser print dialog, a client-side library like
`html2pdf.js` could be added later, but that's an enhancement, not required
for this to function.

Items 5, 6, 8, 9, 10 above are static reference/legal content, not calculated
from the itinerary — don't try to derive them from the costing logic, just
store and render them as-is.

---

## Repo structure

```
/index.html                 Dashboard — start new / load sample / existing itineraries
/trip-basics.html           Stage 1
/hotel-costing.html         Stage 2
/transportation.html        Stage 3
/pricing-summary.html       Stage 4
/itinerary-preview.html     Stage 5 — NOT YET BUILT, see "Missing piece" above
/existing-itineraries.html  Stub list page
/assets/styles.css          Shared design system (single file, plain CSS)
/assets/app.js              Shared logic: data loading, localStorage state,
                             all cost/markup calculations, shared page chrome
                             (sidebar + topbar + stepper)
/data/*.json                All sample master data + pricing settings +
                             the pre-fillable sample inquiry
                             (tourTemplates.json, inclusionsExclusions.json,
                             entranceFees.json still need to be added — see
                             "Missing piece" above)
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
