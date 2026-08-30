/* ==========================================================================
   Costing Console — POC shared utilities
   NOTE: This is a proof-of-concept. All "backend" logic below is fake —
   it reads static JSON files and writes to browser localStorage only.
   See CLAUDE.md at the repo root before extending this.
   ========================================================================== */

const STORAGE_KEY = 'poc_current_itinerary';
const SAVED_KEY = 'poc_saved_itineraries';

/* ---------- data loading ---------- */
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed to load ' + path);
  return res.json();
}

async function loadAllConfig() {
  const [cities, hotels, roomRates, mealPlans, vehicles, pricingSettings] = await Promise.all([
    loadJSON('data/cities.json'),
    loadJSON('data/hotels.json'),
    loadJSON('data/roomRates.json'),
    loadJSON('data/mealPlans.json'),
    loadJSON('data/vehicles.json'),
    loadJSON('data/pricingSettings.json'),
  ]);
  return { cities, hotels, roomRates, mealPlans, vehicles, pricingSettings };
}

function findRate(roomRates, hotelId, occupancy, category) {
  const row = roomRates.find(r => r.hotelId === hotelId && r.occupancy === occupancy && r.category === category);
  return row ? row.ratePerNight : null;
}

/* ---------- itinerary state (localStorage) ---------- */
function blankItinerary() {
  return {
    tripBasics: { clientName: '', nationality: 'Indian', arrivalDate: '', departureDate: '', adults: 2, children: 0, notes: '' },
    hotels: [],
    transport: { mileageSegments: [], vehicleId: null, vehicleOverridden: false, miscUsd: 0 },
    pricing: { markupPercentOverride: null, displayMode: 'perPerson' },
  };
}

function getItinerary() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function saveItinerary(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

function ensureItinerary() {
  let it = getItinerary();
  if (!it) { it = blankItinerary(); saveItinerary(it); }
  return it;
}

function clearItinerary() {
  localStorage.removeItem(STORAGE_KEY);
}

function getSavedItineraries() {
  const raw = localStorage.getItem(SAVED_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function pushSavedItinerary(record) {
  const list = getSavedItineraries();
  list.unshift(record);
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
}

/* ---------- calculations ---------- */
function nightsDaysBetween(arrivalISO, departureISO) {
  if (!arrivalISO || !departureISO) return { nights: 0, days: 0 };
  const a = new Date(arrivalISO), d = new Date(departureISO);
  const nights = Math.max(0, Math.round((d - a) / (1000 * 60 * 60 * 24)));
  return { nights, days: nights + 1 };
}

function roomsNeeded(pax, occupancy) {
  if (occupancy === 'Single') return pax;
  if (occupancy === 'Double') return Math.ceil(pax / 2);
  return Math.ceil(pax / 2);
}

function computeHotelLineTotal(line) {
  return line.rate * line.nights * line.rooms;
}

function computeAccommodationSubtotal(itinerary) {
  return itinerary.hotels.reduce((sum, h) => sum + h.total, 0);
}

function computeTotalMileage(itinerary) {
  return itinerary.transport.mileageSegments.reduce((sum, s) => sum + s.km, 0);
}

function computeTransportBreakdown(itinerary, vehicles, pricingSettings) {
  const totalKm = computeTotalMileage(itinerary);
  const vehicle = vehicles.find(v => v.id === itinerary.transport.vehicleId) || vehicles[0];
  const { days } = nightsDaysBetween(itinerary.tripBasics.arrivalDate, itinerary.tripBasics.departureDate);
  const transportLkr = totalKm * (vehicle ? vehicle.ratePerKmLkr : 0);
  const transportUsd = transportLkr / pricingSettings.exchangeRateLkrPerUsd;
  const driverBata = (vehicle ? vehicle.driverBataPerDayUsd : 0) * days;
  const misc = Number(itinerary.transport.miscUsd) || 0;
  const subtotal = transportUsd + driverBata + misc;
  return { totalKm, vehicle, days, transportLkr, transportUsd, driverBata, misc, subtotal };
}

function suggestVehicle(vehicles, pax) {
  const sorted = [...vehicles].sort((a, b) => a.capacity - b.capacity);
  return sorted.find(v => v.capacity >= pax) || sorted[sorted.length - 1];
}

function computePricing(itinerary, vehicles, pricingSettings) {
  const accommodation = computeAccommodationSubtotal(itinerary);
  const transport = computeTransportBreakdown(itinerary, vehicles, pricingSettings);
  const subtotal = accommodation + transport.subtotal;
  const markupPercent = itinerary.pricing.markupPercentOverride != null
    ? itinerary.pricing.markupPercentOverride
    : pricingSettings.markupPercent;
  const markupAmount = subtotal * (markupPercent / 100);
  const grandTotal = subtotal + markupAmount;
  const pax = (Number(itinerary.tripBasics.adults) || 0) + (Number(itinerary.tripBasics.children) || 0);
  const perPerson = pax > 0 ? grandTotal / pax : 0;
  return { accommodation, transport, subtotal, markupPercent, markupAmount, grandTotal, pax, perPerson };
}

/* ---------- itinerary preview (day-by-day) ---------- */
function buildItineraryDays(itinerary, tourTemplates) {
  const days = [];
  const cursor = itinerary.tripBasics.arrivalDate ? new Date(itinerary.tripBasics.arrivalDate) : new Date();
  const blocks = itinerary.hotels;
  let dayNum = 1;

  blocks.forEach((block, blockIdx) => {
    const tpl = tourTemplates[block.cityId] || {};
    for (let n = 0; n < block.nights; n++) {
      let route, description;
      if (blockIdx === 0 && n === 0) {
        route = `Arrival – ${block.cityName}`;
        description = tpl.arrival || `Arrive and transfer to ${block.cityName}.`;
      } else if (n === 0) {
        const prevCity = blocks[blockIdx - 1].cityName;
        route = `${prevCity} – ${block.cityName}`;
        description = tpl.transitIn || `Travel to ${block.cityName}.`;
      } else {
        route = block.cityName;
        const extras = tpl.extra || [];
        description = extras.length ? extras[(n - 1) % extras.length] : `Day at leisure in ${block.cityName}.`;
      }
      days.push({ dayNum, date: new Date(cursor), route, description, overnightCity: block.cityName });
      dayNum++;
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const lastBlock = blocks[blocks.length - 1];
  const lastTpl = (lastBlock && tourTemplates[lastBlock.cityId]) || {};
  days.push({
    dayNum,
    date: new Date(cursor),
    route: `${lastBlock ? lastBlock.cityName : ''} – Departure`,
    description: lastTpl.departure || 'Breakfast at the hotel. Later, transfer to the airport in time for your departure flight.',
    overnightCity: null,
  });
  return days;
}

function fmtDayDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

/* ---------- formatting ---------- */
function fmtUsd(n) {
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function fmtLkr(n) {
  return 'LKR ' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/* ---------- toast ---------- */
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ---------- chrome (sidebar + topbar + stepper) ---------- */
function renderChrome(mountId, opts) {
  const { activeStep, breadcrumbSub } = opts; // activeStep: 1-4, or 0 for dashboard/stub pages
  const steps = [
    { n: 1, label: 'Trip Basics', href: 'trip-basics.html' },
    { n: 2, label: 'Hotel Costing', href: 'hotel-costing.html' },
    { n: 3, label: 'Transportation', href: 'transportation.html' },
    { n: 4, label: 'Pricing Summary', href: 'pricing-summary.html' },
  ];

  const stepperHtml = activeStep > 0 ? `
    <div class="stepper">
      ${steps.map((s, i) => {
        const cls = s.n < activeStep ? 'done' : (s.n === activeStep ? 'active' : '');
        const num = s.n < activeStep ? '&#10003;' : s.n;
        const bar = s.n === activeStep ? '<div class="step-bar"></div>' : '';
        const line = i < steps.length - 1 ? `<div class="step-line ${s.n < activeStep ? 'done' : ''}"></div>` : '';
        return `<div class="step ${cls}"><div class="step-num">${num}</div><div class="step-label">${s.label}</div>${bar}</div>${line}`;
      }).join('')}
    </div>` : '';

  const html = `
    <div class="sidebar">
      <div class="brand">
        <div class="brand-mark">C</div>
        <div>
          <div class="brand-name">Costing Console</div>
          <div class="brand-sub">Operator Workspace &middot; POC</div>
        </div>
      </div>
      <div class="nav-section-label">Workspace</div>
      <a href="index.html"><div class="nav-item ${activeStep === 0 ? 'active' : ''}"><span class="dot"></span>Dashboard</div></a>
      <a href="trip-basics.html"><div class="nav-item ${activeStep >= 1 ? 'active' : ''}"><span class="dot"></span>New Inquiry / Costing</div></a>
      <a href="existing-itineraries.html"><div class="nav-item"><span class="dot"></span>Existing Itineraries</div></a>
      <div class="nav-section-label">Admin</div>
      <div class="nav-item admin-only"><span class="dot"></span>Cities &amp; Hotels</div>
      <div class="nav-item admin-only"><span class="dot"></span>Vehicles &amp; Rates</div>
      <div class="nav-item admin-only"><span class="dot"></span>Pricing Settings</div>
      <div class="sidebar-footer">
        <div class="avatar">RN</div>
        <div>
          <div class="who">Operator</div>
          <div class="role">Sales &amp; Costing</div>
        </div>
      </div>
    </div>
    <div class="main">
      <div class="topbar">
        <div class="breadcrumb">New Inquiry &nbsp;&rsaquo;&nbsp; <b>${breadcrumbSub || 'Untitled Inquiry'}</b></div>
        ${stepperHtml}
      </div>
      <div class="content" id="page-content"></div>
    </div>
  `;
  document.getElementById(mountId).innerHTML = html;
}

function breadcrumbFor(itinerary) {
  if (!itinerary || !itinerary.tripBasics || !itinerary.tripBasics.clientName) return 'Untitled Inquiry';
  const { clientName, arrivalDate, departureDate } = itinerary.tripBasics;
  const { nights, days } = nightsDaysBetween(arrivalDate, departureDate);
  const dur = nights ? `${nights}N / ${days}D` : '';
  return [clientName, dur, 'Sri Lanka'].filter(Boolean).join(' &middot; ');
}
