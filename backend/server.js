// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const dayjs = require('dayjs');
const path = require('path');

const app = express();

/**
 * CORS configuration:
 * - In production: allow only live domains
 * - In development: also allow localhost for testing
 */
const allowedOrigins = [
  'https://prenotazionimarisqueria.it',
  'https://www.prenotazionimarisqueria.it'
];

if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:5173'); // Vite dev server
}

const corsOptions = {
  origin: allowedOrigins,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// --- Database setup ---
const DB_FILE = path.join(__dirname, 'reservations.db');
const db = new sqlite3.Database(DB_FILE);

// --- Table capacities ---
const TABLES = (() => {
  const caps = [2,2,2,2,4,4,4,4,4,4,10,4,4,4,4,6,6,4,4,2,2,4,4,4,4,4,6,6,4,4];
  return caps.map((max, i) => ({ id: i + 1, max }));
})();

// --- Time slots ---
const LUNCH_SLOTS = ['11:30-12:30', '12:30-13:30', '13:30-14:30'];
const DINNER_ROUNDS = [
  { id: 'D1', label: '19:30-21:00' },
  { id: 'D2', label: '21:00-22:30' },
  { id: 'D3', label: '22:30-24:00' }
];

// --- Initialize DB ---
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

  db.run(`CREATE INDEX IF NOT EXISTS idx_res_date_meal_time 
          ON reservations (date, mealType, timeSlot);`);
});

// Helper functions
function getOccupiedTables(date, mealType, timeSlot) {
  return new Promise((resolve, reject) => {
    const q = `SELECT tableId FROM reservations WHERE date = ? AND mealType = ? AND timeSlot = ?`;
    db.all(q, [date, mealType, timeSlot], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(r => r.tableId));
    });
  });
}

function chooseBestTable(freeTables, partySize) {
  const suitable = freeTables.filter(t => t.max >= partySize);
  if (suitable.length === 0) return null;
  suitable.sort((a, b) => a.max - b.max);
  return suitable[0];
}

// Routes
app.get('/config', (req, res) => {
  res.json({
    status: 'ok',
    totalTables: TABLES.length,
    tables: TABLES,
    lunchSlots: LUNCH_SLOTS,
    dinnerRounds: DINNER_ROUNDS
  });
});

app.get('/availability', async (req, res) => {
  try {
    const { date, meal, timeSlot, partySize } = req.query;
    if (!date || !meal || !timeSlot) {
      return res.status(400).json({ error: 'date, meal and timeSlot are required' });
    }

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

    res.json({
      freeTables: filtered,
      count: filtered.length,
      totalTables: TABLES.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/reserve', (req, res) => {
  const { name, email, phone, partySize, date, mealType, timeSlot, tableId } = req.body;

  if (!name || !partySize || !date || !mealType || !timeSlot) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const ps = Number(partySize);
  const largest = Math.max(...TABLES.map(t => t.max));
  if (ps > largest) {
    return res.status(409).json({ error: `Party size too large. Largest table is ${largest}` });
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
          const tableInfo = TABLES.find(t => t.id === Number(tableId));
          if (!tableInfo) {
            db.run("ROLLBACK", () => {});
            return res.status(400).json({ error: 'Invalid tableId' });
          }
          if (tableInfo.max < ps) {
            db.run("ROLLBACK", () => {});
            return res.status(409).json({ error: `Party exceeds capacity of table ${tableId}` });
          }
          if (occupied.includes(Number(tableId))) {
            db.run("ROLLBACK", () => {});
            return res.status(409).json({ error: `Table ${tableId} already reserved for this slot` });
          }
          chosen = tableInfo;
        } else {
          const free = TABLES.filter(t => !occupied.includes(t.id));
          chosen = chooseBestTable(free, ps);
          if (!chosen) {
            db.run("ROLLBACK", () => {});
            return res.status(409).json({ error: 'No table available for this size at chosen time' });
          }
        }

        const insertQ = `INSERT INTO reservations
          (name, email, phone, partySize, date, mealType, timeSlot, tableId, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const createdAt = dayjs().toISOString();

        db.run(insertQ, [name, email || '', phone || '', ps, date, mealType, timeSlot, chosen.id, createdAt], function (err) {
          if (err) {
            db.run("ROLLBACK", () => {});
            return res.status(500).json({ error: 'Could not save reservation' });
          }
          db.run("COMMIT", (err) => {
            if (err) return res.status(500).json({ error: 'Commit failed' });
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
        });
      });
    });
  });
});

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
    if (err) return res.status(500).json({ error: 'DB error' });

    const reservationsByTable = {};
    rows.forEach(row => {
      reservationsByTable[row.tableId] = row.totalPartySize;
    });

    const tablesStatus = TABLES.map(table => ({
      tableId: table.id,
      max: table.max,
      reservedSeats: reservationsByTable[table.id] || 0
    }));

    res.json({ tables: tablesStatus });
  });
});

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

app.delete('/reservations/:id', (req, res) => {
  const id = Number(req.params.id);
  db.run(`DELETE FROM reservations WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, deletedId: id });
  });
});

app.get('/tables', (req, res) => {
  res.json({ tables: TABLES });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  db.close(() => process.exit(0));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Reservation server running on port ${PORT}`));
