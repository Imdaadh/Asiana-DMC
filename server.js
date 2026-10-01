/* ==========================================================================
   Costing Console — minimal local backend
   The ONLY thing this server exists for is persisting saved itineraries to
   a real JSON file on disk (db/savedItineraries.json), so "Existing
   Itineraries" isn't limited to one browser's localStorage. Everything else
   about this POC is still plain static HTML/CSS/JS — see CLAUDE.md.
   ========================================================================== */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;
const DB_FILE = path.join(__dirname, 'db', 'savedItineraries.json');

function readSaved() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeSaved(list) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2));
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

app.get('/api/itineraries', (req, res) => {
  res.json(readSaved());
});

app.post('/api/itineraries', (req, res) => {
  const record = req.body;
  if (!record || !record.id) {
    res.status(400).json({ error: 'Missing itinerary record' });
    return;
  }
  const list = readSaved();
  list.unshift(record);
  writeSaved(list);
  res.json(list);
});

app.listen(PORT, () => {
  console.log(`Costing Console running at http://localhost:${PORT}`);
});
