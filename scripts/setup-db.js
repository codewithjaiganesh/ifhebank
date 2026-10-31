require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

async function main() {
  // Strip SQL line comments before splitting statements. This ensures the
  // supplementary ledger table following a comment is not skipped.
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8')
    .replace(/^\s*--.*$/gm, '');
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
  const conn = await pool.getConnection();
  try {
    for (const statement of statements) await conn.query(statement);
    console.log(`BranchFlow schema setup completed (${statements.length} tables). Existing records were preserved.`);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(async error => {
  console.error('Database setup failed:', error.message);
  await pool.end();
  process.exit(1);
});
