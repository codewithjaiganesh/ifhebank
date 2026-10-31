const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function sslOptions() {
  if (String(process.env.DB_SSL).toLowerCase() !== 'true') return undefined;
  const caPath = process.env.DB_SSL_CA;
  if (caPath) {
    const resolved = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);
    return { ca: fs.readFileSync(resolved, 'utf8'), rejectUnauthorized: true };
  }
  // Convenience fallback for providers such as Aiven. Configure DB_SSL_CA for
  // certificate validation in production.
  return { rejectUnauthorized: false };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: true,
  decimalNumbers: true,
  ssl: sslOptions()
});

module.exports = pool;
