import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'Z',
  supportBigNumbers: true,
  bigNumberStrings: false,
});

// Keep every session in UTC so DATETIME values round-trip correctly regardless of server timezone.
pool.pool.on('connection', c => c.query("SET time_zone = '+00:00'"));

/** Run a query and return the rows (or the result header for INSERT/UPDATE/DELETE). */
export const q = async (sql, params = []) => (await pool.query(sql, params))[0];
/** Return the first row or null. */
export const one = async (sql, params = []) => (await q(sql, params))[0] ?? null;

/** Run fn(conn) inside a transaction. */
export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
