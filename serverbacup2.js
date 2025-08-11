const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const dayjs = require('dayjs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Connect to SQLite DB
const db = new sqlite3.Database('./reservations.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

// Create table if not exists
db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        date TEXT NOT NULL,
        slot TEXT NOT NULL,
        table_no INTEGER NOT NULL
    )
`);

// Config
const TOTAL_TABLES = 30;
const LUNCH_SLOTS = ['11:30', '12:00', '12:30', '13:00', '13:30', '14:00'];
const DINNER_ROUNDS = [
    { id: 'D1', label: '19:30-21:00' },
    { id: 'D2', label: '21:00-22:30' },
    { id: 'D3', label: '22:30-24:00' }
];

// Get configuration
app.get('/config', (req, res) => {
    res.json({
        status: 'ok',
        tables: TOTAL_TABLES,
        dinnerRounds: DINNER_ROUNDS,
        lunchSlots: LUNCH_SLOTS
    });
});

// Get reservations for a date
app.get('/reservations', (req, res) => {
    const { date, slot } = req.query;
    if (!date || !slot) {
        return res.status(400).json({ error: 'Missing date or slot' });
    }
    db.all(
        'SELECT * FROM reservations WHERE date = ? AND slot = ?',
        [date, slot],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// Make a reservation
app.post('/reserve', (req, res) => {
    const { name, phone, date, slot } = req.body;
    if (!name || !phone || !date || !slot) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.all(
        'SELECT table_no FROM reservations WHERE date = ? AND slot = ?',
        [date, slot],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const reservedTables = rows.map(r => r.table_no);
            const availableTable = Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1)
                .find(t => !reservedTables.includes(t));

            if (!availableTable) {
                return res.status(400).json({ error: 'No tables available' });
            }

            db.run(
                'INSERT INTO reservations (name, phone, date, slot, table_no) VALUES (?, ?, ?, ?, ?)',
                [name, phone, date, slot, availableTable],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({
                        status: 'success',
                        reservationId: this.lastID,
                        table: availableTable
                    });
                }
            );
        }
    );
});

// Cancel reservation
app.delete('/cancel/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM reservations WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }
        res.json({ status: 'deleted' });
    });
});

app.listen(PORT, () => {
    console.log(`Reservation server running on port ${PORT}`);
});

