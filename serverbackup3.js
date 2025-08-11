// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// -------------------
// SQLite Setup
// -------------------
const dbPath = path.join(__dirname, 'restaurant.db');
const db = new sqlite3.Database(dbPath);

// Create tables if not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY,
      lunch_start TEXT,
      lunch_end TEXT,
      dinner_start TEXT,
      dinner_end TEXT,
      total_tables INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tables (
      table_id INTEGER PRIMARY KEY,
      capacity INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER,
      customer_name TEXT,
      date TEXT,
      time TEXT,
      party_size INTEGER,
      FOREIGN KEY(table_id) REFERENCES tables(table_id)
    )
  `);

  // Insert default config if not exists
  db.get(`SELECT COUNT(*) as count FROM config`, (err, row) => {
    if (row.count === 0) {
      db.run(`
        INSERT INTO config (lunch_start, lunch_end, dinner_start, dinner_end, total_tables)
        VALUES ('12:00', '15:00', '18:00', '22:00', 30)
      `);
    }
  });

  // Insert tables if not exists
  db.get(`SELECT COUNT(*) as count FROM tables`, (err, row) => {
    if (row.count === 0) {
      const stmt = db.prepare(`INSERT INTO tables (table_id, capacity) VALUES (?, ?)`);
      for (let i = 1; i <= 30; i++) {
        stmt.run(i, 4); // default capacity = 4
      }
      stmt.finalize();
    }
  });
});

// -------------------
// API Endpoints
// -------------------

// 1. Config endpoint
app.get('/config', (req, res) => {
  db.get(`SELECT * FROM config LIMIT 1`, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// 2. List all reservations
app.get('/reservations', (req, res) => {
  db.all(`SELECT * FROM reservations`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 3. Create reservation
app.post('/reservations', (req, res) => {
  const { table_id, customer_name, date, time, party_size } = req.body;
  if (!table_id || !customer_name || !date || !time || !party_size) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Check if table already booked at that date/time
  db.get(
    `SELECT * FROM reservations WHERE table_id = ? AND date = ? AND time = ?`,
    [table_id, date, time],
    (err, row) => {
      if (row) {
        return res.status(400).json({ error: 'Table already booked' });
      }

      db.run(
        `INSERT INTO reservations (table_id, customer_name, date, time, party_size)
         VALUES (?, ?, ?, ?, ?)`,
        [table_id, customer_name, date, time, party_size],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, reservation_id: this.lastID });
        }
      );
    }
  );
});

// 4. Cancel reservation
app.delete('/reservations/:id', (req, res) => {
  db.run(`DELETE FROM reservations WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Reservation not found' });
    res.json({ success: true });
  });
});

// -------------------
// Start server
// -------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

