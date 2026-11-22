import crypto from 'node:crypto';
import { parseJson } from './settings.js';

export const DIU_EMAIL = /^[^\s@]+@diu\.edu\.bd$/i;
export const STUDENT_ID = /^\d{3}-\d{2}-\d{3,5}$/;

export const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
export const sixDigitCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

const camelKey = k => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
/** snake_case row -> camelCase object (parses JSON columns named tags). */
export const camel = row => {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[camelKey(k)] = k === 'tags' ? (parseJson(v) || []) : v;
  return out;
};

export const extractTags = (text = '') =>
  [...new Set((String(text).match(/#[\p{L}\p{N}_]{2,50}/gu) || []).map(t => t.slice(1).toLowerCase()))].slice(0, 10);

/** Select list for a compact "user card". */
export const userCols = (alias, prefix) =>
  `${alias}.id AS ${prefix}id, ${alias}.name AS ${prefix}name, ${alias}.role AS ${prefix}role, ` +
  `${alias}.avatar_url AS ${prefix}avatar, ${alias}.headline AS ${prefix}headline, ${alias}.department AS ${prefix}department`;

export const brief = (row, p = '') => row[`${p}id`] == null ? null : ({
  id: row[`${p}id`], name: row[`${p}name`], role: row[`${p}role`],
  avatarUrl: row[`${p}avatar`] ?? null, headline: row[`${p}headline`] ?? null,
  department: row[`${p}department`] ?? null, verified: true,
});

/** Connection status between the viewer and alias.id. Needs the viewer id passed 3 times. */
export const connStatusSql = (alias = 'u') =>
  `(SELECT CASE WHEN c.status = 'accepted' THEN 'connected' WHEN c.requester_id = ? THEN 'pending_sent' ELSE 'pending_received' END
    FROM connections c WHERE c.pair_key = CONCAT(LEAST(?, ${alias}.id), '-', GREATEST(?, ${alias}.id))) AS conn_status`;

export const pageParams = (query, def = 20, max = 50) => {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || def, 1), max);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
};

export const likeEscape = s => String(s).replace(/[\\%_]/g, m => '\\' + m);
