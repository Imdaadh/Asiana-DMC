# Travel Itinerary & Costing System — Requirements for Real Build

## Status of this document

This is a requirements spec, not a description of an existing codebase. It
consolidates: (1) the original requirements/proposal document (Config Admin +
Operator roles, full user flow, entity relationships), and (2) everything
validated, corrected, or newly discovered while building a click-through POC
against that proposal. Where the POC's actual behavior diverged from the
original proposal — because real usage exposed the proposal's assumptions as
wrong — this document states the **corrected** behavior and explains why, so
those mistakes aren't repeated in the real build.

This is meant to be dropped into a new project (rename to `CLAUDE.md` or
whatever your tooling expects) as the starting brief for the real
implementation — real backend, real database, real auth, all now in scope
(none of that was in scope for the POC).

---

## 1. System overview

Two distinct user roles:

- **Config Admin** — sets up all underlying master data (cities, hotels, room
  types, meal plans, vehicles, tour route content, pricing settings) through a
  back-office configuration screen. This only needs occasional maintenance —
  not part of the day-to-day costing flow.
- **Operator** — the day-to-day user who receives client inquiries, costs an
  itinerary using only Config-sourced dropdowns (never typing raw hotel names
  or rates from scratch), and produces a client-facing itinerary document.

The Operator's costing flow has five stages: Trip Basics → Hotel Costing →
Transportation → Pricing Summary → Itinerary Preview (the actual deliverable
— a print/PDF-ready document, not a screen the client ever sees).

---

## 2. Config Admin — master data

| Setting | What it controls | Notes from building the POC |
|---|---|---|
| Cities | Destination cities available for itinerary building | — |
| Hotels | Hotels per city, with star category | — |
| Room Types | Occupancy × Category × base rate/night, per hotel | **Occupancy must include Triple, not just Single/Double** — needed once mixed room-type bookings were modeled (see §4.2). Category tiers: Standard/Superior/Luxury. |
| Meal Plans | Full Board / Half Board / BB / Room Only | Needs to be settable **per room within a booking**, not just once per hotel stay — see §4.2. |
| Vehicle Types | Seating capacity, rate/km (LKR), driver bata rate/day (LKR) | **Add a `guideFeePerDayLkr` field, nullable** — larger vehicles (Mini Coach, Maxi Coach tiers, above the original largest "Coach") require a dedicated guide in addition to the driver; smaller vehicles don't. The UI must only show/charge a guide fee when the selected vehicle has one — not just zero it out, omit it. |
| Tour Route Templates | Pre-written day-activity descriptions per city | **Needs to support multiple named alternatives per city, per day-type** (e.g. arrival day / transit-in day / extra leisure day / departure day), not one fixed description — the Operator needs to pick among pre-configured alternatives per day when finalizing the itinerary document (e.g. "Kandy City Tour" vs "Kandy → Sigiriya Day Trip"), not free-type over it. |
| Entrance Fees | Reference price list for sightseeing attractions | **Must be priced per nationality tier** (e.g. Indian / Sri Lankan / British / American / Other), not a flat per-site price — Sri Lankan entrance fees are commonly tiered this way in practice. |
| Cost Includes / Excludes | Boilerplate bullet lists for the client document | Static commercial/legal boilerplate, centrally managed, not derived from costing data. |
| Cancellation Policy | Tiered refund rules by days-before-arrival | Static boilerplate. |
| Important Notes / Complimentary list | Static boilerplate bullet lists | Static boilerplate. |
| Markup % | Default profit margin applied on top of calculated cost | Operator can override per itinerary. |
| Exchange Rate (LKR → USD) | Conversion used for transport costs | **This one field must stay Admin-only, never Operator-editable**, even though everything else Config-sourced becomes Operator-overridable per itinerary (see §4.3) — this was explicitly reconfirmed while building the POC. |

Entity relationships (why a relational database, not document-based, was the
right call in the original proposal):

| Entity | Depends on |
|---|---|
| Hotel | City |
| Room Type | Hotel |
| Meal Plan | Selected independently, applied per Room Type selection (and per individual room within a mixed booking — see §4.2) |
| Itinerary Leg | City + Hotel + Room Type(s) + Meal Plan(s) + Nights |
| Vehicle Assignment | Pax count (auto-suggested, overridable) + total mileage across all legs |
| Tour Route Template | City + day-type (arrival/transit/extra/departure), each with multiple selectable options |
| Itinerary | One or more Itinerary Legs + one Vehicle Assignment + Pricing settings |

---

## 3. Operator flow

### 3.1 Entry point

- **New Itinerary**: blank costing screen.
- **Existing Itinerary**: search/filter saved itineraries (by client name,
  city, or ideally the city+nights-combo style search from the original
  proposal — the POC only ever got as far as a plain text substring match on
  client name/city; the real product should do better). Two distinct actions
  once found:
  - **View** — open the finished client document read-only, to reprint or
    reference an old quote without any risk of it being edited by mistake.
  - **Use as template** — clone that itinerary into a new working draft
    (client name, dates, pax editable; hotels/transport/pricing carried over
    as a starting point) so the Operator doesn't rebuild a similar trip from
    scratch. This was a late but important addition — build it in from day
    one rather than bolting it on.

### 3.2 Trip Basics

Client Name, Nationality, Travel Dates (Nights/Days auto-computed), Adults,
Children.

**Pricing display mode** ("Per Person" vs "Whole Group") is chosen here, up
front — not only at the end. See §4.4 for exactly what this does and does
not affect; getting this scope right matters more than it first appears.

### 3.3 Hotel Costing

For each city on the route: City → Hotel → Nights → Meal Plan (a per-stay
default), then build a **room mix** for that city/hotel — one or more rows,
each independently specifying:

- Occupancy (Single / Double / Triple)
- Category (Standard / Superior / Luxury)
- Room Count — **a required, explicitly-entered number. Never auto-derive
  this from pax ÷ occupancy capacity and lock it.** (See §4.2 for why —
  auto-suggesting a sensible starting value is fine and expected, silently
  computing it and disallowing override is not.)
- Rate — auto-fills from Config, always overridable for negotiated prices.
- Meal Plan override — defaults to the stay-level meal plan, but each room
  row can independently override it (e.g. one room on Half Board, another on
  Full Board within the same hotel stay).

Repeat per city; a running accommodation total builds up as rows are added.

**A "Self Booking" option** must exist per city leg, for the case where the
client independently books their own hotel for part of the trip (a common
real scenario — e.g. a group splits off and books 2 nights themselves).
Checking it for a city collapses that leg's cost to City + Nights only — no
hotel, no room mix, $0 accommodation cost — while still (a) counting toward
the trip's total night allocation, and (b) still implying whatever
transportation/mileage is needed to and from that city, since transport is
priced independently of accommodation.

#### 4.2 Room count vs. pax — the corrected rule

**Do not validate that a room mix "covers" the trip's pax count, and do not
block adding rooms that don't exactly match a capacity formula.** An earlier
version of the POC did this ("covers 5 pax, but this trip has 7 — add
another room") and it was wrong for how this business actually books:

- Children commonly share a room with adults rather than requiring their own
  capacity — a family of 2 adults + 2 children might book exactly one Double
  room, "under" any strict headcount formula.
- Operators sometimes deliberately book *more* capacity than the headcount
  implies (e.g. 2 Double rooms for a party of 3, for comfort/negotiation
  reasons).

The room mix is informational, not a constraint to enforce. Room Count is
still a required field (an empty/zero room count is a data-entry mistake,
not a legitimate booking), but there is no "does this add up to pax" check.

#### 4.3 What stays Admin-only vs. what's Operator-overridable

Every Config-sourced numeric value the Operator's screen surfaces should
auto-fill from Config but remain an editable input at the point of use — not
a read-only computed row — so the Operator can negotiate/override *for this
itinerary* without touching the global Config default. This applies to:
hotel room rate, vehicle rate/km, driver bata rate/day, guide fee rate/day.

**Exception: exchange rate.** That one stays locked, Admin-only, everywhere
in the app, deliberately re-confirmed during POC development.

### 3.4 Transportation

Distance segments entered one at a time (sum live) — Google Maps
auto-calculation of distance was considered and explicitly deferred (see
§6). Vehicle auto-suggested from pax count, overridable via dropdown,
including the larger Mini Coach / Maxi Coach tiers.

The calculation chain, each step its own visible line (not collapsed into
one number), auto-filled from Config but individually overridable per §4.3:

```
Transport Cost (LKR) = Total Mileage × Vehicle Rate (LKR/km)
Transport Cost (USD) = Transport Cost (LKR) ÷ Exchange Rate      [rate locked]
Driver Bata (LKR)    = Driver Bata Rate (LKR/day) × Total Days
Driver Bata (USD)    = Driver Bata (LKR) ÷ Exchange Rate
Guide Fee (LKR)      = Guide Fee Rate (LKR/day) × Total Days     [only when the
Guide Fee (USD)      = Guide Fee (LKR) ÷ Exchange Rate            vehicle has one]
```

Misc expenses are a **repeatable list** of description + amount (not a single
flat field) — things like bottled water, cultural show tickets, entrance
tickets bought in bulk, etc., each its own line item.

### 3.5 Pricing Summary

```
Subtotal (Cost Price) = Accommodation Total + Transportation Total
Markup Amount         = Subtotal × Markup % (default from Config, overridable)
Grand Total (Client Price) = Subtotal + Markup Amount
Per Person Rate       = Grand Total ÷ Pax
```

A receipt-style build-up, top to bottom, in the order calculated — nothing
collapsed into a single opaque formula. The Per Person / Whole Group toggle
(also settable on Trip Basics, §4.4) determines the final display.

### 3.6 Itinerary Preview — the actual deliverable

The client never sees the costing console — they see this document. It must
assemble, print-ready:

1. **Title** built from trip params (e.g. "SRI LANKA ITINERARY 6N–7D").
2. **Day-by-day breakdown** — one block per day, auto-populated from Tour
   Route Templates by city and day-type (arrival / transit-in / extra
   leisure day / departure), with **a per-day dropdown of the alternate
   pre-configured options** for that city/day-type so the Operator can swap
   the default without free-typing (e.g. swap a leisure day for a day-trip
   option). Ends each day with "Overnight Stay: [City]" except the
   departure day.
3. **Hotel table** — City | Nights | Hotel | Room (mix summary).
4. **Cost line** — pax breakdown + nationality, and the price exactly as
   chosen on Pricing Summary (Per Person or Total Breakdown).
5. **Cost Includes / Excludes** — from Config boilerplate.
6. **Entrance Fees** reference table — **priced by the client's nationality**
   (from Trip Basics), looked up from Config.
7. **Check-in/out times, Cancellation Policy, Important Notes,
   Complimentary list** — all from Config boilerplate.
8. **Company branding footer** — real logo/name once finalized; don't
   hardcode a specific company's branding without confirming it first.

**Every field on this page must be editable in place** before the document
is finalized/printed — day descriptions, the hotel table, the cost line,
every boilerplate list item, entrance fee names and prices, policy text —
without those edits mutating the underlying Config data. Auto-populate
everything as the starting point; nothing should be read-only. Edits are
specific to that one itinerary/document, not a global override.

Output mechanism: the original POC used the browser's native print-to-PDF
(no PDF-generation library) — fine as a cheap starting point, but the real
product should decide deliberately whether that's sufficient or whether a
proper generated-PDF pipeline (e.g. server-side PDF rendering) is worth it,
given this is the actual deliverable handed to clients.

---

## 4. The display-mode scope correction (important — got this wrong once)

"Per Person" vs "Whole Group" is a **single setting** (`displayMode`),
choosable from Trip Basics or from Pricing Summary — same value either way.

**What it should affect: only the final client-facing price** — Pricing
Summary's receipt and final display card, and the Itinerary Preview's cost
line. **What it should NOT affect: any of the cost-*building* screens**
(Hotel Costing, Transportation) — their line items, subtotals, and running
totals should always show the real, whole-group dollar amount.

This was tried the other way once (dividing every subtotal on every screen
by pax) per an interpretation of the original requirement that "every cost
total surfaced anywhere should show ÷ pax." It was reverted after real usage
showed it made the on-screen math look broken — e.g. a room costed as
"$80/night × 2 nights × 3 rooms" showing a "Line Total" that had silently
been divided by pax and no longer matched the visible arithmetic right next
to it. The lesson: a cost-building screen's numbers need to match the
formula shown beside them; only the screens whose entire purpose is
presenting a final price to the client should apply a per-person view, and
only where there's a visible toggle making that transformation obvious.

---

## 5. Explicitly deferred: Google Maps distance auto-calculation

The eventual goal is auto-calculating distance between selected cities via
the Google Maps Distance Matrix or Routes API, pre-filling the segment while
still leaving it editable. **Do not call Google's API directly from
client-side JavaScript** — an API key embedded in frontend code is visible
to anyone who views page source; even referrer-restricted, it's exposed to
quota-draining abuse, and a purely static/serverless-free frontend has no
place to hide it. The real implementation needs a backend endpoint that
takes an origin/destination pair, calls Google's API server-side with a
restricted key, and returns the distance — the frontend never talks to
Google directly. This also needs an explicit decision on who owns the API
key/billing before it's wired up.

---

## 6. Data persistence — decide this properly, don't inherit the POC's stopgap

The POC's throwaway version of this used browser `localStorage` for the
itinerary being built, and — once asked to make saved itineraries real
rather than per-browser — a minimal local Node/Express server writing a flat
JSON file to disk. **Neither of those is a recommendation for the real
build.** They were sized for a zero-infrastructure demo, not a real,
multi-operator product. The real build needs:

- A real database — the entity relationships in §2 are relational (City →
  Hotel → Room Type → Itinerary Leg), which argues for something like
  Postgres over a document store, per the original proposal's own reasoning.
- A real backend/API layer, real authentication (company SSO), and a
  decision on production hosting — all still open, all still the team's
  call to make, not something to infer from how the POC happened to be
  wired.

---

## 7. Non-functional / open questions still needing answers

These were flagged in the original proposal and never resolved — decide
them before or during the real build, they affect the data model and flow:

- Should Operators see/search itineraries created by other Operators, or
  only their own?
- When a hotel's rate changes in Config, should already-built itineraries
  keep their original locked-in price, or update automatically?
- Should there be a senior-staff approval step before an itinerary is
  finalized and sent to a client, or can any Operator send directly?
- Do child rates differ from adult rates for hotel costing, or is it
  pax-count only (as modeled so far)?
- What does the real Config Admin panel's UI look like, concretely — the
  POC never built one (all Config data was hand-edited JSON).
- Real authentication (company SSO) — not evaluated at all yet.
- Production hosting platform, and whether the eventual backend/database
  choice changes based on that hosting decision.

---

## 8. UX lessons worth not re-learning

- **Don't reset a focused input's value on re-render.** A pattern where a
  shared "recompute everything and re-render" function runs on every
  keystroke will reset `input.value` (or, worse, recreate the input element
  entirely if it's rebuilt via `innerHTML`) — this visibly breaks typing
  multi-digit numbers, since the cursor jumps to the end (or the whole field
  loses focus) after every character. Guard any such re-render: skip
  overwriting an input's value when it's the currently-focused element, and
  never rebuild an input element that might currently hold focus — update
  its derived/adjacent display values instead, in place.
- **Validation should block *before* a bad state is created, not flag it
  after.** E.g. don't let an Operator add a hotel entry whose Nights would
  push the total past the trip's length and only mention it later near a
  "Continue" button — check live, at the point of the action that would
  cause it, and disable/prevent that specific action with a clear reason
  shown right there.
- **A disabled action needs an always-visible reason**, not just a toast
  that appears once — an inline hint that persists near the disabled control
  (e.g. "3 nights left unallocated for this trip") lets the Operator
  understand and fix the problem without needing to attempt the action to
  discover why it's blocked.
- **Read-only "view history" views must never share state with an in-progress
  draft.** Viewing an old saved itinerary should never risk overwriting or
  seeding the itinerary someone is actively building — keep the two
  completely separate in whatever state/storage model the real app uses.
