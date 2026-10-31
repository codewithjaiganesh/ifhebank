require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('./src/db');
const { signToken, requireAuth, adminOnly } = require('./src/auth');

const app = express();

const allowedOrigins = [
  'https://ifhebank.vercel.app'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = Number(process.env.PORT || 3000);
const RESOURCE_CONFIG = {
  banks: {
    table: 'banks', id: 'bank_id',
    fields: ['bank_name','head_office','established_year','contact_no','email'],
    required: ['bank_name','head_office'],
    select: 'SELECT * FROM banks ORDER BY bank_id DESC'
  },
  branches: {
    table: 'branches', id: 'branch_id',
    fields: ['bank_id','branch_name','ifsc_code','address_line1','city','state','pin_code','phone_no','email','manager_name'],
    required: ['bank_id','branch_name','ifsc_code','address_line1','city','state','pin_code'],
    select: `SELECT br.*, b.bank_name FROM branches br JOIN banks b ON b.bank_id=br.bank_id ORDER BY br.branch_id DESC`
  },
  employees: {
    table: 'employees', id: 'emp_id',
    fields: ['branch_id','name','designation','phone_no','email','join_date'],
    required: ['branch_id','name','designation','join_date'],
    select: `SELECT e.*, br.branch_name FROM employees e JOIN branches br ON br.branch_id=e.branch_id ORDER BY e.emp_id DESC`
  },
  accounts: {
    table: 'accounts', id: 'account_no',
    fields: ['account_no','branch_id','customer_id','account_type','balance','open_date','status'],
    updateFields: ['branch_id','customer_id','account_type','open_date','status'],
    required: ['account_no','branch_id','customer_id','account_type','open_date'],
    select: `SELECT a.*, br.branch_name FROM accounts a JOIN branches br ON br.branch_id=a.branch_id ORDER BY a.created_at DESC`
  },
  loans: {
    table: 'loans', id: 'loan_id',
    fields: ['branch_id','customer_id','loan_type','amount','interest_rate','start_date','status'],
    required: ['branch_id','customer_id','loan_type','amount','interest_rate','start_date'],
    select: `SELECT l.*, br.branch_name FROM loans l JOIN branches br ON br.branch_id=l.branch_id ORDER BY l.loan_id DESC`
  }
};

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
function cleanValue(value) {
  if (value === '') return null;
  if (typeof value === 'string') return value.trim();
  return value;
}
function pickFields(body, fields) {
  const result = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) result[field] = cleanValue(body[field]);
  }
  return result;
}
function validatePayload(data, required) {
  const missing = required.filter(field => data[field] === undefined || data[field] === null || data[field] === '');
  if (missing.length) return `Missing required field(s): ${missing.join(', ')}.`;
  return null;
}
function makeReference(prefix = 'BF') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', app: 'BranchFlow', database: 'connected' });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });
  const [rows] = await pool.execute('SELECT user_id,full_name,email,password_hash,role FROM app_users WHERE email=? LIMIT 1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  const token = signToken(user);
  res.json({ token, user: { id: user.user_id, name: user.full_name, email: user.email, role: user.role } });
}));

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT user_id,full_name,email,role FROM app_users WHERE user_id=? LIMIT 1', [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
  const u = rows[0];
  res.json({ user: { id: u.user_id, name: u.full_name, email: u.email, role: u.role } });
}));

app.patch('/api/auth/change-password', requireAuth, asyncRoute(async (req, res) => {
  const current = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '');
  if (next.length < 12) return res.status(400).json({ error: 'New password must be at least 12 characters.' });
  const [rows] = await pool.execute('SELECT password_hash FROM app_users WHERE user_id=?', [req.user.id]);
  if (!rows[0] || !(await bcrypt.compare(current, rows[0].password_hash))) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  const hash = await bcrypt.hash(next, 12);
  await pool.execute('UPDATE app_users SET password_hash=? WHERE user_id=?', [hash, req.user.id]);
  res.json({ message: 'Password updated. Sign in again with your new password.' });
}));

app.use('/api', requireAuth);

app.get('/api/dashboard', asyncRoute(async (_req, res) => {
  const [[banks]] = await pool.query('SELECT COUNT(*) AS total FROM banks');
  const [[branches]] = await pool.query('SELECT COUNT(*) AS total FROM branches');
  const [[employees]] = await pool.query('SELECT COUNT(*) AS total FROM employees');
  const [[accounts]] = await pool.query(`SELECT COUNT(*) AS total, COALESCE(SUM(balance),0) AS balance_total,
    SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) AS active_total FROM accounts`);
  const [[loans]] = await pool.query(`SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS amount_total,
    SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) AS pending_total FROM loans`);
  const [[transactions]] = await pool.query('SELECT COUNT(*) AS total FROM account_transactions');
  const [recent] = await pool.query(`SELECT transaction_id,reference,transaction_type,account_no,related_account,amount,description,created_at
    FROM account_transactions ORDER BY transaction_id DESC LIMIT 7`);
  const [branchStats] = await pool.query(`SELECT br.branch_name,
    (SELECT COUNT(*) FROM accounts a WHERE a.branch_id=br.branch_id) AS account_count,
    (SELECT COALESCE(SUM(a.balance),0) FROM accounts a WHERE a.branch_id=br.branch_id) AS balance_total,
    (SELECT COUNT(*) FROM employees e WHERE e.branch_id=br.branch_id) AS employee_count
    FROM branches br ORDER BY balance_total DESC LIMIT 5`);
  const [activity] = await pool.query(`SELECT DATE_FORMAT(created_at,'%b %y') AS month_label,
    COUNT(*) AS transaction_count, COALESCE(SUM(amount),0) AS volume
    FROM account_transactions WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 5 MONTH)
    GROUP BY YEAR(created_at),MONTH(created_at),DATE_FORMAT(created_at,'%b %y')
    ORDER BY YEAR(MIN(created_at)),MONTH(MIN(created_at))`);
  res.json({ metrics: {
    banks: Number(banks.total), branches: Number(branches.total), employees: Number(employees.total),
    accounts: Number(accounts.total), activeAccounts: Number(accounts.active_total || 0),
    totalBalance: Number(accounts.balance_total), loans: Number(loans.total),
    loanAmount: Number(loans.amount_total), pendingLoans: Number(loans.pending_total || 0),
    transactions: Number(transactions.total)
  }, recent, branchStats, activity });
}));

app.get('/api/resources/:resource', asyncRoute(async (req, res) => {
  const cfg = RESOURCE_CONFIG[req.params.resource];
  if (!cfg) return res.status(404).json({ error: 'Unknown resource.' });
  const [rows] = await pool.query(cfg.select);
  res.json({ data: rows });
}));

app.post('/api/resources/:resource', adminOnly, asyncRoute(async (req, res) => {
  const cfg = RESOURCE_CONFIG[req.params.resource];
  if (!cfg) return res.status(404).json({ error: 'Unknown resource.' });
  const data = pickFields(req.body, cfg.fields);
  const invalid = validatePayload(data, cfg.required);
  if (invalid) return res.status(400).json({ error: invalid });
  if (cfg.table === 'accounts' && Number(data.balance || 0) < 0) return res.status(400).json({ error: 'Account balance cannot be negative.' });
  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(',');
  const [result] = await pool.execute(`INSERT INTO ${cfg.table} (${columns.join(',')}) VALUES (${placeholders})`, columns.map(k => data[k]));
  res.status(201).json({ message: 'Record created.', id: result.insertId || data[cfg.id] });
}));

app.put('/api/resources/:resource/:id', adminOnly, asyncRoute(async (req, res) => {
  const cfg = RESOURCE_CONFIG[req.params.resource];
  if (!cfg) return res.status(404).json({ error: 'Unknown resource.' });
  const data = pickFields(req.body, cfg.updateFields || cfg.fields.filter(f => f !== cfg.id));
  const entries = Object.entries(data);
  if (!entries.length) return res.status(400).json({ error: 'No editable fields supplied.' });
  if (cfg.table === 'accounts' && data.balance !== undefined) return res.status(400).json({ error: 'Use the transaction screen to change balances.' });
  const [result] = await pool.execute(`UPDATE ${cfg.table} SET ${entries.map(([k]) => `${k}=?`).join(',')} WHERE ${cfg.id}=?`, [...entries.map(([,v]) => v), req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Record not found.' });
  res.json({ message: 'Record updated.' });
}));

app.delete('/api/resources/:resource/:id', adminOnly, asyncRoute(async (req, res) => {
  const cfg = RESOURCE_CONFIG[req.params.resource];
  if (!cfg) return res.status(404).json({ error: 'Unknown resource.' });
  const [result] = await pool.execute(`DELETE FROM ${cfg.table} WHERE ${cfg.id}=?`, [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Record not found.' });
  res.json({ message: 'Record deleted.' });
}));

app.get('/api/transactions', asyncRoute(async (_req, res) => {
  const [rows] = await pool.query(`SELECT t.*, a.account_type, br.branch_name
    FROM account_transactions t JOIN accounts a ON a.account_no=t.account_no
    JOIN branches br ON br.branch_id=a.branch_id ORDER BY t.transaction_id DESC LIMIT 250`);
  res.json({ data: rows });
}));

app.post('/api/transactions', adminOnly, asyncRoute(async (req, res) => {
  const type = String(req.body.type || '').toUpperCase();
  const accountNo = String(req.body.accountNo || '').trim();
  const toAccount = String(req.body.toAccount || '').trim();
  const amount = Number(req.body.amount);
  const description = String(req.body.description || '').trim().slice(0,180);
  if (!['DEPOSIT','WITHDRAWAL','TRANSFER'].includes(type)) return res.status(400).json({ error: 'Choose deposit, withdrawal, or transfer.' });
  if (!accountNo || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Enter a valid account and amount.' });
  if (type === 'TRANSFER' && (!toAccount || toAccount === accountNo)) return res.status(400).json({ error: 'Choose a different destination account.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const accountNos = type === 'TRANSFER' ? [accountNo,toAccount].sort() : [accountNo];
    const [locked] = await conn.query(`SELECT account_no,balance,status FROM accounts WHERE account_no IN (${accountNos.map(()=>'?').join(',')}) ORDER BY account_no FOR UPDATE`, accountNos);
    const source = locked.find(a => String(a.account_no) === accountNo);
    const destination = type === 'TRANSFER' ? locked.find(a => String(a.account_no) === toAccount) : null;
    if (!source || source.status !== 'Active') throw new Error('Source account was not found or is not active.');
    if (type === 'TRANSFER' && (!destination || destination.status !== 'Active')) throw new Error('Destination account was not found or is not active.');
    if (type !== 'DEPOSIT' && Number(source.balance) < amount) throw new Error('Insufficient balance for this operation.');
    const reference = makeReference('VLR');
    if (type === 'DEPOSIT') {
      await conn.execute('UPDATE accounts SET balance=balance+? WHERE account_no=?',[amount,accountNo]);
      await conn.execute(`INSERT INTO account_transactions (reference,transaction_type,account_no,amount,description,created_by)
        VALUES (?,'DEPOSIT',?,?,?,?)`,[reference,accountNo,amount,description || 'Demo deposit',req.user.id]);
    } else if (type === 'WITHDRAWAL') {
      await conn.execute('UPDATE accounts SET balance=balance-? WHERE account_no=?',[amount,accountNo]);
      await conn.execute(`INSERT INTO account_transactions (reference,transaction_type,account_no,amount,description,created_by)
        VALUES (?,'WITHDRAWAL',?,?,?,?)`,[reference,accountNo,amount,description || 'Demo withdrawal',req.user.id]);
    } else {
      await conn.execute('UPDATE accounts SET balance=balance-? WHERE account_no=?',[amount,accountNo]);
      await conn.execute('UPDATE accounts SET balance=balance+? WHERE account_no=?',[amount,toAccount]);
      await conn.execute(`INSERT INTO account_transactions (reference,transaction_type,account_no,related_account,amount,description,created_by)
        VALUES (?,'TRANSFER_OUT',?,?,?,?,?)`,[reference,accountNo,toAccount,amount,description || 'Internal demo transfer',req.user.id]);
      await conn.execute(`INSERT INTO account_transactions (reference,transaction_type,account_no,related_account,amount,description,created_by)
        VALUES (?,'TRANSFER_IN',?,?,?,?,?)`,[reference,toAccount,accountNo,amount,description || 'Internal demo transfer',req.user.id]);
    }
    await conn.commit();
    res.status(201).json({ message: 'Demo transaction completed.', reference });
  } catch (error) {
    await conn.rollback();
    res.status(400).json({ error: error.message || 'Transaction could not be completed.' });
  } finally {
    conn.release();
  }
}));

app.get('/api/reports/summary', asyncRoute(async (_req, res) => {
  const [byType] = await pool.query(`SELECT account_type,COUNT(*) AS accounts,COALESCE(SUM(balance),0) AS balance
    FROM accounts GROUP BY account_type ORDER BY balance DESC`);
  const [loanStatus] = await pool.query(`SELECT status,COUNT(*) AS total,COALESCE(SUM(amount),0) AS amount
    FROM loans GROUP BY status`);
  const [branchBalances] = await pool.query(`SELECT br.branch_name,COUNT(a.account_no) AS account_count,COALESCE(SUM(a.balance),0) AS total_balance
    FROM branches br LEFT JOIN accounts a ON a.branch_id=br.branch_id GROUP BY br.branch_id,br.branch_name ORDER BY total_balance DESC`);
  res.json({ byType, loanStatus, branchBalances });
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A record with that unique value already exists.' });
  if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Select a valid related bank, branch, or account.' });
  if (error.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'This record is linked to other records and cannot be deleted.' });
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Unexpected server error.' : error.message });
});

app.listen(PORT, () => console.log(`BranchFlow server listening on port ${PORT}`));
