// backend/server.js
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const dayjs = require('dayjs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, 'reservations.db');
const db = new sqlite3.Database(DB_FILE);

// --- Table capacities (per-table maximums). Edit this array if you want 
//custom capacities.
const TABLES = (() => {
  // Example capacities array (30 entries). Change to your exact 
//capacities as needed.
  const caps = 
[2,2,2,2,4,4,4,4,4,4,10,4,4,4,4,6,6,4,4,2,2,4,4,4,4,4,6,6,4,4];
  return caps.map((max, i) => ({ id: i+1, max }));
})();

// Lunch slots and dinner rounds
const LUNCH_SLOTS = ['11:30-12:30','12:30-13:30','13:30-14:30'];
const DINNER_ROUNDS = [
  { id: 'D1', label: '19:30-21:00' },
  { id: 'D2', label: '21:00-22:30' },
  { id: 'D3', label: '22:30-24:00' }
];

// Initialize DB
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    partySize INTEGER NOT NULL,
    date TEXT NOT NULL,
    mealType TEXT NOT NULL,
    timeSlot TEXT NOT NULL,
    tableId INTEGER NOT NULL,
    createdAt TEXT NOT NULL
  );`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_res_date_meal_time ON 
reservations (date, mealType, timeSlot);`);
});

// Helpers
function getOccupiedTables(date, mealType, timeSlot) {
  return new Promise((resolve, reject) => {
    const q = `SELECT tableId FROM reservations WHERE date = ? AND 
mealType = ? AND timeSlot = ?`;
    db.all(q, [date, mealType, timeSlot], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(r => r.tableId));
    });
  });
}

function chooseBestTable(freeTables, partySize) {
  const suitable = freeTables.filter(t => t.max >= partySize);
  if (suitable.length === 0) return null;
  suitable.sort((a,b) => a.max - b.max);
  return suitable[0];
}

// Routes

// GET /config
app.get('/config', (req, res) => {
  res.json({
    status: 'ok',
    totalTables: TABLES.length,
    tables: TABLES,            // includes per-table max if frontend wants it
    lunchSlots: LUNCH_SLOTS,
    dinnerRounds: DINNER_ROUNDS
  });
});

// GET /availability?date=YYYY-MM-DD&meal=lunch|dinner&timeSlot=<slot>&partySize=4
app.get('/availability', async (req, res) => {
  try {
    const { date, meal, timeSlot, partySize } = req.query;
    if (!date || !meal || !timeSlot) return res.status(400).json({ error: 'date, meal and timeSlot are required' });

    // Validate input
    if (meal === 'lunch' && !LUNCH_SLOTS.includes(timeSlot)) {
      return res.status(400).json({ error: 'Invalid lunch timeSlot' });
    }
    if (meal === 'dinner' && !DINNER_ROUNDS.map(r => r.id).includes(timeSlot)) {
      return res.status(400).json({ error: 'Invalid dinner timeSlot' });
    }

    const occupied = await getOccupiedTables(date, meal, timeSlot);
    const free = TABLES.filter(t => !occupied.includes(t.id));
    let filtered = free;
    if (partySize) {
      const ps = Number(partySize);
      filtered = free.filter(t => t.max >= ps);
    }
    res.json({ freeTables: filtered, count: filtered.length, totalTables: TABLES.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /reserve  (auto-assigns table - best fit)
app.post('/reserve', (req, res) => {
  const { name, email, phone, partySize, date, mealType, timeSlot, tableId } = req.body;

  // Validation for required fields
  if (!name || !partySize || !date || !mealType || !timeSlot) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const ps = Number(partySize);

  // Maximum size check
  const largest = Math.max(...TABLES.map(t => t.max));
  if (ps > largest) {
    return res.status(409).json({ error: `Party size too large. Largest table capacity is ${largest}` });
  }

  db.serialize(() => {
    db.run("BEGIN IMMEDIATE TRANSACTION", (err) => {
      if (err) return res.status(500).json({ error: 'Could not start transaction' });

      const q = `SELECT tableId FROM reservations WHERE date = ? AND mealType = ? AND timeSlot = ?`;
      db.all(q, [date, mealType, timeSlot], (err, rows) => {
        if (err) {
          db.run("ROLLBACK", () => {});
          return res.status(500).json({ error: 'DB error' });
        }

        const occupied = rows.map(r => r.tableId);
        let chosen;

        if (tableId) {
          // User requested a specific table
          const tableInfo = TABLES.find(t => t.id === Number(tableId));

          // Validate table
          if (!tableInfo) {
            db.run("ROLLBACK", () => {});
            return res.status(400).json({ error: 'Invalid tableId' });
          }

          if (tableInfo.max < ps) {
            db.run("ROLLBACK", () => {});
            return res.status(409).json({ error: `Party size exceeds capacity of table ${tableId}` });
          }

          if (occupied.includes(Number(tableId))) {
            db.run("ROLLBACK", () => {});
            return res.status(409).json({ error: `Table ${tableId} is already reserved for this time slot` });
          }

          chosen = tableInfo; // Reserve the one the user picked
        } else {
          // Auto‑assign as before
          const free = TABLES.filter(t => !occupied.includes(t.id));
          chosen = chooseBestTable(free, ps);
          if (!chosen) {
            db.run("ROLLBACK", () => {});
            return res.status(409).json({ error: 'No table available for this party size at chosen time' });
          }
        }

        // Insert reservation
        const insertQ = `INSERT INTO reservations 
          (name, email, phone, partySize, date, mealType, timeSlot, tableId, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const createdAt = dayjs().toISOString();

        db.run(
          insertQ,
          [name, email || '', phone || '', ps, date, mealType, timeSlot, chosen.id, createdAt],
          function (err) {
            if (err) {
              db.run("ROLLBACK", () => {});
              return res.status(500).json({ error: 'Could not save reservation' });
            }

            db.run("COMMIT", (err) => {
              if (err) {
                return res.status(500).json({ error: 'Commit failed' });
              }
              return res.json({
                success: true,
                reservation: {
                  id: this.lastID,
                  name,
                  email,
                  phone,
                  partySize: ps,
                  date,
                  mealType,
                  timeSlot,
                  tableId: chosen.id,
                  createdAt
                }
              });
            });
          }
        );
      });
    });
  });
});

// GET /tableReservations?date=YYYY-MM-DD&mealType=lunch|dinner&timeSlot=<slot>
// Returns details about reservations per table for the given slot
app.get('/tableReservations', (req, res) => {
  const { date, mealType, timeSlot } = req.query;
  if (!date || !mealType || !timeSlot) {
    return res.status(400).json({ error: 'date, mealType and timeSlot are required' });
  }

  const q = `SELECT tableId, SUM(partySize) AS totalPartySize
             FROM reservations
             WHERE date = ? AND mealType = ? AND timeSlot = ?
             GROUP BY tableId`;

  db.all(q, [date, mealType, timeSlot], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'DB error' });
    }

    // Map results to an object keyed by tableId for easy lookup
    const reservationsByTable = {};
    rows.forEach(row => {
      reservationsByTable[row.tableId] = row.totalPartySize;
    });

    // Prepare response array with all tables and their reserved counts (0 if none)
    const tablesStatus = TABLES.map(table => ({
      tableId: table.id,
      max: table.max,
      reservedSeats: reservationsByTable[table.id] || 0
    }));

    res.json({ tables: tablesStatus });
  });
});


// GET /reservations?date=YYYY-MM-DD
app.get('/reservations', (req, res) => {
  const { date } = req.query;
  let q = `SELECT * FROM reservations`;
  const params = [];
  if (date) {
    q += ` WHERE date = ? ORDER BY timeSlot, tableId`;
    params.push(date);
  } else {
    q += ` ORDER BY date, timeSlot, tableId`;
  }
  db.all(q, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ reservations: rows });
  });
});

// DELETE /reservations/:id
app.delete('/reservations/:id', (req, res) => {
  const id = Number(req.params.id);
  db.run(`DELETE FROM reservations WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, deletedId: id });
  });
});

// GET /tables
app.get('/tables', (req, res) => {
  res.json({ tables: TABLES });
});

// graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  db.close(() => process.exit(0));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Reservation server running on port ${PORT}`));

