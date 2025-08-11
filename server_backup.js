// server.js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- Config: table capacities (30 tables) ---
const TABLES = (() => {
  // example capacities — tweak as needed
  const caps = [2,2,2,2,4,4,4,4,4,4,10,4,4,4,4,6,6,4,4,2,2,4,4,4,4,4,6,6,4,4];
  return caps.map((max, i) => ({ id: i+1, max }));
})();

const DINNER_ROUNDS = [
  { id: 'D1', label: '19:30-21:00' },
  { id: 'D2', label: '21:00-22:30' },
  { id: 'D3', label: '22:30-24:00' }
];

const LUNCH_SLOTS = ['11:30','12:00','12:30','13:00','13:30','14:00'];

// In-memory reservations
let reservations = [];
let nextResId = 1;

function freeTablesFor(date, mealType, timeSlot) {
  const occupied = new Set(
    reservations
      .filter(r => r.date === date && r.mealType === mealType && r.timeSlot === timeSlot)
      .map(r => r.tableId)
  );
  return TABLES.filter(t => !occupied.has(t.id));
}

function findBestTable(freeTables, partySize) {
  const suitable = freeTables.filter(t => t.max >= partySize);
  if (suitable.length === 0) return null;
  suitable.sort((a,b) => a.max - b.max);
  return suitable[0];
}

// Root info
app.get('/', (req, res) => {
  res.json({ status: 'ok', tables: TABLES.length, dinnerRounds: DINNER_ROUNDS, lunchSlots: LUNCH_SLOTS });
});

// GET availability
app.get('/availability', (req, res) => {
  const { date, meal, timeSlot, partySize } = req.query;
  if (!date || !meal || !timeSlot) return res.status(400).json({ error: 'date, meal and timeSlot required' });
  const free = freeTablesFor(date, meal, timeSlot);
  res.json({ freeTables: free, count: free.length });
});

// POST reserve
app.post('/reserve', (req, res) => {
  const { name, email, phone, partySize, date, mealType, timeSlot } = req.body;
  if (!name || !partySize || !date || !mealType || !timeSlot) return res.status(400).json({ error: 'Missing fields' });
  const ps = Number(partySize);
  const free = freeTablesFor(date, mealType, timeSlot);
  const table = findBestTable(free, ps);
  if (!table) return res.status(409).json({ error: 'No table available for this party' });

  const reservation = {
    id: nextResId++,
    name, email, phone,
    partySize: ps,
    date, mealType, timeSlot,
    tableId: table.id,
    createdAt: new Date().toISOString()
  };
  reservations.push(reservation);
  res.json({ success: true, reservation });
});

// GET reservations (filter by date)
app.get('/reservations', (req, res) => {
  const { date } = req.query;
  if (!date) return res.json({ reservations });
  res.json({ reservations: reservations.filter(r => r.date === date) });
});

// DELETE reservation
app.delete('/reservations/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = reservations.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const removed = reservations.splice(idx, 1)[0];
  res.json({ success: true, removed });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Reservation server running on port', PORT));

