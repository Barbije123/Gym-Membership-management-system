// ============================================================
//  IronForge Gym — Backend Server (Node.js + Express + MySQL)
//
//  Setup:
//    1. npm install express mysql2 cors dotenv
//    2. Create a .env file (see bottom of this file)
//    3. Run: node server.js
//
//  API runs on http://localhost:3000
// ============================================================

require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serves index.html

// ─── MySQL Connection Pool ────────────────────────────────────
const pool = mysql.createPool({
  host     : process.env.DB_HOST     || 'localhost',
  port     : process.env.DB_PORT     || 3306,
  user     : process.env.DB_USER     || 'root',
  password : process.env.DB_PASSWORD || '',
  database : process.env.DB_NAME     || 'ironforge_gym',
  waitForConnections : true,
  connectionLimit    : 10,
  queueLimit         : 0,
});

// Quick helper — run a query and return rows
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    const [summary] = await query('SELECT * FROM vw_dashboard');
    const recent_members  = await query(
      `SELECT m.id, m.name, m.plan, m.status, t.name AS trainer_name
       FROM members m LEFT JOIN trainers t ON m.trainer_id = t.id
       ORDER BY m.created_at DESC LIMIT 5`
    );
    const recent_trainers = await query(
      `SELECT id, name, speciality, status FROM trainers ORDER BY created_at DESC LIMIT 5`
    );
    const monthly_revenue = await query(
      `SELECT MONTH(paid_on) AS month, SUM(amount) AS total
       FROM payments WHERE status='Paid' AND YEAR(paid_on) = YEAR(CURDATE())
       GROUP BY MONTH(paid_on) ORDER BY month`
    );
    res.json({ summary, recent_members, recent_trainers, monthly_revenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  TRAINERS
// ─────────────────────────────────────────────────────────────

// GET all trainers
app.get('/api/trainers', async (req, res) => {
  try {
    const { status, speciality, search } = req.query;
    let sql    = 'SELECT * FROM trainers WHERE 1=1';
    const params = [];

    if (status)     { sql += ' AND status = ?';                     params.push(status); }
    if (speciality) { sql += ' AND speciality = ?';                 params.push(speciality); }
    if (search)     { sql += ' AND name LIKE ?';                    params.push(`%${search}%`); }

    sql += ' ORDER BY created_at DESC';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single trainer
app.get('/api/trainers/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM trainers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Trainer not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create trainer
app.post('/api/trainers', async (req, res) => {
  try {
    const { name, phone, email, speciality, experience, salary, status, joined_on } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await query(
      `INSERT INTO trainers (name, phone, email, speciality, experience, salary, status, joined_on)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone||null, email||null, speciality||'Strength',
       experience||0, salary||0, status||'Active', joined_on||null]
    );
    const newRow = await query('SELECT * FROM trainers WHERE id = ?', [result.insertId]);
    res.status(201).json(newRow[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update trainer
app.put('/api/trainers/:id', async (req, res) => {
  try {
    const { name, phone, email, speciality, experience, salary, status, joined_on } = req.body;
    await query(
      `UPDATE trainers SET name=?, phone=?, email=?, speciality=?, experience=?,
       salary=?, status=?, joined_on=? WHERE id=?`,
      [name, phone||null, email||null, speciality, experience||0,
       salary||0, status, joined_on||null, req.params.id]
    );
    const updated = await query('SELECT * FROM trainers WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE trainer
app.delete('/api/trainers/:id', async (req, res) => {
  try {
    await query('DELETE FROM trainers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Trainer deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  MEMBERS
// ─────────────────────────────────────────────────────────────

// GET all members
app.get('/api/members', async (req, res) => {
  try {
    const { status, plan, search } = req.query;
    let sql    = 'SELECT * FROM vw_members WHERE 1=1';
    const params = [];

    if (status) { sql += ' AND status = ?';   params.push(status); }
    if (plan)   { sql += ' AND plan = ?';     params.push(plan); }
    if (search) { sql += ' AND name LIKE ?';  params.push(`%${search}%`); }

    sql += ' ORDER BY id DESC';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single member
app.get('/api/members/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM vw_members WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create member
app.post('/api/members', async (req, res) => {
  try {
    const { name, phone, email, plan, trainer_id, status, joined_on } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await query(
      `INSERT INTO members (name, phone, email, plan, trainer_id, status, joined_on)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, phone||null, email||null, plan||'Monthly',
       trainer_id||null, status||'Active', joined_on||null]
    );
    const newRow = await query('SELECT * FROM vw_members WHERE id = ?', [result.insertId]);
    res.status(201).json(newRow[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update member
app.put('/api/members/:id', async (req, res) => {
  try {
    const { name, phone, email, plan, trainer_id, status, joined_on } = req.body;
    await query(
      `UPDATE members SET name=?, phone=?, email=?, plan=?,
       trainer_id=?, status=?, joined_on=? WHERE id=?`,
      [name, phone||null, email||null, plan,
       trainer_id||null, status, joined_on||null, req.params.id]
    );
    const updated = await query('SELECT * FROM vw_members WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE member
app.delete('/api/members/:id', async (req, res) => {
  try {
    await query('DELETE FROM members WHERE id = ?', [req.params.id]);
    res.json({ message: 'Member deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  PAYMENTS
// ─────────────────────────────────────────────────────────────

// GET all payments
app.get('/api/payments', async (req, res) => {
  try {
    const { status, member_id, search } = req.query;
    let sql    = 'SELECT * FROM vw_payments WHERE 1=1';
    const params = [];

    if (status)    { sql += ' AND status = ?';          params.push(status); }
    if (member_id) { sql += ' AND member_id = ?';       params.push(member_id); }
    if (search)    { sql += ' AND member_name LIKE ?';  params.push(`%${search}%`); }

    sql += ' ORDER BY created_at DESC';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET payment summary (totals)
app.get('/api/payments/summary', async (req, res) => {
  try {
    const rows = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN status='Paid'    THEN amount ELSE 0 END), 0) AS total_paid,
         COALESCE(SUM(CASE WHEN status='Pending' THEN amount ELSE 0 END), 0) AS total_pending,
         COUNT(*) AS total_transactions
       FROM payments`
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST record payment
app.post('/api/payments', async (req, res) => {
  try {
    const { member_id, plan, amount, method, status, paid_on, notes } = req.body;
    if (!member_id || !amount) return res.status(400).json({ error: 'member_id and amount are required' });

    const result = await query(
      `INSERT INTO payments (member_id, plan, amount, method, status, paid_on, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [member_id, plan||'Monthly', amount, method||'Cash',
       status||'Paid', paid_on||null, notes||null]
    );
    const newRow = await query('SELECT * FROM vw_payments WHERE id = ?', [result.insertId]);
    res.status(201).json(newRow[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update payment status
app.put('/api/payments/:id', async (req, res) => {
  try {
    const { plan, amount, method, status, paid_on, notes } = req.body;
    await query(
      `UPDATE payments SET plan=?, amount=?, method=?, status=?, paid_on=?, notes=? WHERE id=?`,
      [plan, amount, method, status, paid_on||null, notes||null, req.params.id]
    );
    const updated = await query('SELECT * FROM vw_payments WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE payment
app.delete('/api/payments/:id', async (req, res) => {
  try {
    await query('DELETE FROM payments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  EQUIPMENT
// ─────────────────────────────────────────────────────────────

// GET all equipment
app.get('/api/equipment', async (req, res) => {
  try {
    const { condition, category, search } = req.query;
    let sql    = 'SELECT * FROM equipment WHERE 1=1';
    const params = [];

    if (condition) { sql += ' AND `condition` = ?'; params.push(condition); }
    if (category)  { sql += ' AND category = ?';    params.push(category); }
    if (search)    { sql += ' AND name LIKE ?';     params.push(`%${search}%`); }

    sql += ' ORDER BY created_at DESC';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add equipment
app.post('/api/equipment', async (req, res) => {
  try {
    const { name, category, quantity, cost, condition, purchased_on, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await query(
      `INSERT INTO equipment (name, category, quantity, cost, \`condition\`, purchased_on, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, category||'Strength', quantity||1, cost||0,
       condition||'good', purchased_on||null, notes||null]
    );
    const newRow = await query('SELECT * FROM equipment WHERE id = ?', [result.insertId]);
    res.status(201).json(newRow[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update equipment
app.put('/api/equipment/:id', async (req, res) => {
  try {
    const { name, category, quantity, cost, condition, purchased_on, notes } = req.body;
    await query(
      `UPDATE equipment SET name=?, category=?, quantity=?, cost=?,
       \`condition\`=?, purchased_on=?, notes=? WHERE id=?`,
      [name, category, quantity||1, cost||0,
       condition||'good', purchased_on||null, notes||null, req.params.id]
    );
    const updated = await query('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE equipment
app.delete('/api/equipment/:id', async (req, res) => {
  try {
    await query('DELETE FROM equipment WHERE id = ?', [req.params.id]);
    res.json({ message: 'Equipment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ⚡ IronForge Gym API running → http://localhost:${PORT}`);
  console.log(`  📋 Health check             → http://localhost:${PORT}/api/health\n`);
});

// ─────────────────────────────────────────────────────────────
//  .env  (create this file in the same directory as server.js)
// ─────────────────────────────────────────────────────────────
/*
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=ironforge_gym
PORT=3000
*/
