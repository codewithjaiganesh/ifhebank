require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db');

async function upsertByCode(conn, sql, params) { await conn.execute(sql, params); }

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const email = (process.env.ADMIN_EMAIL || 'admin@branchflow.demo').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'DemoAdmin@12345';
    if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
    const hash = await bcrypt.hash(password, 12);
    await conn.execute(
      `INSERT INTO app_users (full_name,email,password_hash,role) VALUES (?,?,?,'admin')
       ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash), role='admin'`,
      [process.env.ADMIN_NAME || 'BranchFlow Administrator', email, hash]
    );

    await upsertByCode(conn,
      `INSERT INTO banks (bank_id,bank_name,head_office,established_year,contact_no,email)
       VALUES (1,'Velora Bank','Mumbai, Maharashtra',1998,'1800-120-5500','hello@velorabank.demo')
       ON DUPLICATE KEY UPDATE bank_name=VALUES(bank_name)`, []);

    const branches = [
      [101,1,'Hitech City Branch','VLRB0000101','Madhapur Main Road','Hyderabad','Telangana','500081','040-40112233','hitech@velorabank.demo','Ananya Rao'],
      [102,1,'Banjara Hills Branch','VLRB0000102','Road No. 12, Banjara Hills','Hyderabad','Telangana','500034','040-40112244','banjara@velorabank.demo','Kabir Mehta'],
      [103,1,'Secunderabad Branch','VLRB0000103','S D Road, Secunderabad','Hyderabad','Telangana','500003','040-40112255','secunderabad@velorabank.demo','Isha Reddy'],
      [104,1,'Vijayawada Central','VLRB0000104','MG Road, Labbipet','Vijayawada','Andhra Pradesh','520010','0866-2211334','vijayawada@velorabank.demo','Arjun Varma']
    ];
    for (const row of branches) {
      await conn.execute(
        `INSERT INTO branches (branch_id,bank_id,branch_name,ifsc_code,address_line1,city,state,pin_code,phone_no,email,manager_name)
         VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE branch_name=VALUES(branch_name), manager_name=VALUES(manager_name)`, row);
    }

    const employees = [
      [1001,101,'Ananya Rao','Branch Manager','9876501001','ananya.rao@velorabank.demo','2021-04-12'],
      [1002,101,'Rohan Das','Relationship Manager','9876501002','rohan.das@velorabank.demo','2022-06-20'],
      [1003,102,'Kabir Mehta','Branch Manager','9876501003','kabir.mehta@velorabank.demo','2020-09-15'],
      [1004,103,'Isha Reddy','Branch Manager','9876501004','isha.reddy@velorabank.demo','2021-11-08'],
      [1005,104,'Arjun Varma','Branch Manager','9876501005','arjun.varma@velorabank.demo','2023-01-16']
    ];
    for (const row of employees) {
      await conn.execute(`INSERT INTO employees (emp_id,branch_id,name,designation,phone_no,email,join_date)
        VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), designation=VALUES(designation)`, row);
    }

    const accounts = [
      ['100000000101',101,5001,'Savings',72500,'2024-05-10','Active'],
      ['100000000102',101,5002,'Current',248000,'2023-11-22','Active'],
      ['100000000103',102,5003,'Savings',98450,'2025-01-05','Active'],
      ['100000000104',102,5004,'Premium',425000,'2022-08-14','Active'],
      ['100000000105',103,5005,'Savings',36500,'2024-02-19','Active'],
      ['100000000106',104,5006,'Current',186000,'2023-07-09','Active'],
      ['100000000107',104,5007,'Savings',128900,'2025-03-12','Frozen']
    ];
    for (const row of accounts) {
      await conn.execute(`INSERT IGNORE INTO accounts (account_no,branch_id,customer_id,account_type,balance,open_date,status)
        VALUES (?,?,?,?,?,?,?)`, row);
    }

    const loans = [
      [7001,101,5002,'Home loan',1850000,8.25,'2024-03-01','Active'],
      [7002,102,5004,'Vehicle loan',640000,9.10,'2025-02-10','Active'],
      [7003,103,5005,'Personal loan',180000,11.50,'2025-05-21','Pending'],
      [7004,104,5006,'Education loan',420000,7.75,'2024-08-16','Active']
    ];
    for (const row of loans) {
      await conn.execute(`INSERT IGNORE INTO loans (loan_id,branch_id,customer_id,loan_type,amount,interest_rate,start_date,status)
        VALUES (?,?,?,?,?,?,?,?)`, row);
    }

    await conn.commit();
    console.log('BranchFlow demo data is ready.');
    console.log(`Administrator: ${email}`);
    console.log('Sample bank, 4 branches, 5 employees, 7 accounts and 4 loans are available.');
    console.log('All sample account and loan balances are illustrative demo data.');
    if (!process.env.ADMIN_PASSWORD) console.warn('Using local demo password from seed defaults. Change it before deployment.');
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(async error => {
  console.error('Seeding failed:', error.message);
  await pool.end();
  process.exit(1);
});
