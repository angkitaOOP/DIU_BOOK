import 'dotenv/config';
import mysql from 'mysql2/promise';

// Run:  npm run db:check     -> tells you exactly what is wrong with the database connection / tables / users.
const cfg = { host: process.env.DB_HOST || 'localhost', port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'diulink' };
console.log(`Connecting to MySQL ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database} ...`);
let db;
try { db = await mysql.createConnection(cfg); }
catch (e) {
  console.error('\nX Cannot connect:', e.code, '-', e.message);
  if (e.code === 'ER_ACCESS_DENIED_ERROR') console.error('  -> DB_USER / DB_PASSWORD in .env is wrong.');
  if (e.code === 'ER_BAD_DB_ERROR') console.error('  -> Database does not exist yet. Run: npm run db:migrate');
  if (e.code === 'ECONNREFUSED') console.error('  -> MySQL server is not running (start MySQL / XAMPP / MySQL Service) or DB_HOST/DB_PORT is wrong.');
  process.exit(1);
}
console.log('OK connected.');
const [tables] = await db.query('SHOW TABLES');
console.log(`OK ${tables.length} tables/views found.` + (tables.length < 20 ? '  (expected ~24: run  npm run db:migrate)' : ''));
const [[c]] = await db.query('SELECT COUNT(*) AS n FROM users');
console.log(`OK users table has ${c.n} account(s):`);
const [rows] = await db.query('SELECT id, name, email, role, status, email_verified, created_at FROM users ORDER BY id DESC LIMIT 20');
console.table(rows);
console.log('status meanings: active = can log in | pending_email = registered but OTP not verified yet | pending_review = alumni waiting for admin');
await db.end();
