import 'dotenv/config';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
import { defaultSettings } from '../src/utils/settings.js';

const email = (process.env.SEED_ADMIN_EMAIL || '').toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || '';
if (!/^[^\s@]+@diu\.edu\.bd$/.test(email)) throw new Error('SEED_ADMIN_EMAIL must be a @diu.edu.bd address');
if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters');

const db = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost', port: +(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'diulink', charset: 'utf8mb4',
});
const hash = await bcrypt.hash(password, 12);
await db.query(
  `INSERT INTO users (name,email,password_hash,role,status,email_verified,headline,settings)
   VALUES ('DIULink Admin',?,?, 'admin','active',1,'DIULink administrator',?)
   ON DUPLICATE KEY UPDATE role='admin', status='active', password_hash=VALUES(password_hash)`,
  [email, hash, JSON.stringify(defaultSettings)]);

const clubs = [
  ['DIU Robotics Club', 'Tech', 'Build robots, join workshops and compete in RoboSprint.'],
  ['CSE Society', 'Tech', 'Hackathons, tech talks and peer learning for CSE and SWE students.'],
  ['DIU Design Club', 'Creative', 'UI/UX critiques, Figma jams and portfolio nights.'],
  ['DIU Photography Club', 'Creative', 'Photo walks, exhibitions and editing workshops.'],
  ['Debating Society', 'Culture', 'Weekly practice rounds and inter-university tournaments.'],
  ['DIU Career Club', 'Career', 'CV clinics, mock interviews and alumni mentoring.'],
];
for (const [name, cat, desc] of clubs) {
  await db.query('INSERT IGNORE INTO clubs (name,category,description) VALUES (?,?,?)', [name, cat, desc]);
}
await db.end();
console.log(`Admin ready: ${email}. Sample clubs inserted.`);
