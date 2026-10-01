# Travel Itinerary Costing — Proof of Concept

A click-through demo of the 5-stage costing flow (Trip Basics → Hotel Costing
→ Transportation → Pricing Summary → Itinerary Preview) described in the
project proposal — built in plain HTML/CSS/JS with JSON sample data, no backend.

**This is a proof of concept, not the real product.** See [`CLAUDE.md`](./CLAUDE.md)
for exactly what's real, what's mocked, and what's intentionally undecided
(database, framework, hosting, auth all come later).

## Try it

Open the site and click **"Load Sample Inquiry — Priyanshu Aggarwal"** on the
dashboard to see the whole flow pre-filled with a real example, or **"Start
New Inquiry"** to try it from a blank form.

## Run locally

```bash
npm install   # first time only
npm start
```
Then open `http://localhost:8000`.

(Opening `index.html` directly by double-clicking it won't work — the pages
fetch JSON data files, which browsers block over `file://`. A plain static
server works for most of the app too, but Save Itinerary / Existing
Itineraries specifically need `npm start`, since those are backed by a small
local server — see [`CLAUDE.md`](./CLAUDE.md) for why.)
