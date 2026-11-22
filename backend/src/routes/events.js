import { Router } from 'express';
import { z } from 'zod';
import { q, one } from '../db.js';
import { AppError, asyncHandler, notFound } from '../utils/errors.js';
import { likeEscape } from '../utils/helpers.js';
import { isOurAsset } from '../utils/cloudinary.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { isClubAdmin } from '../services/posts.js';

const router = Router();
router.use(auth);

const SELECT = `e.id, e.title, e.description, e.category, e.location, e.starts_at, e.ends_at, e.image_url, e.club_id, e.host_id,
  COALESCE(cl.name, hu.name) AS host_name,
  (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id = e.id) AS going_count,
  EXISTS(SELECT 1 FROM event_attendees a WHERE a.event_id = e.id AND a.user_id = ?) AS is_going
  FROM events e LEFT JOIN clubs cl ON cl.id = e.club_id JOIN users hu ON hu.id = e.host_id`;
const shape = r => ({ id: r.id, title: r.title, description: r.description, category: r.category, location: r.location,
  startsAt: r.starts_at, endsAt: r.ends_at, imageUrl: r.image_url, clubId: r.club_id, hostId: r.host_id, hostName: r.host_name,
  goingCount: r.going_count, going: !!r.is_going });

// GET /api/events?category=Tech&q=&past=1&limit=
router.get('/', asyncHandler(async (req, res) => {
  const where = [req.query.past === '1' ? 'e.starts_at < NOW()' : 'e.starts_at >= (NOW() - INTERVAL 3 HOUR)'], params = [req.user.id];
  if (req.query.category && req.query.category !== 'All') { where.push('e.category = ?'); params.push(String(req.query.category)); }
  if (req.query.q) { const l = `%${likeEscape(String(req.query.q).slice(0, 80))}%`; where.push('(e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)'); params.push(l, l, l); }
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const rows = await q(`SELECT ${SELECT} WHERE ${where.join(' AND ')} ORDER BY e.starts_at ${req.query.past === '1' ? 'DESC' : 'ASC'} LIMIT ?`, [...params, limit]);
  res.json({ items: rows.map(shape) });
}));

router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  const row = await one(`SELECT ${SELECT} WHERE e.id = ?`, [req.user.id, req.params.id]);
  if (!row) throw notFound('Event');
  res.json({ event: shape(row) });
}));

const body = z.object({
  title: z.string().trim().min(3).max(160), description: z.string().trim().max(4000).optional(),
  category: z.string().trim().min(2).max(40).default('General'), location: z.string().trim().max(160).optional(),
  startsAt: z.coerce.date(), endsAt: z.coerce.date().optional(), clubId: z.coerce.number().int().positive().optional(),
  imageUrl: z.string().refine(isOurAsset, 'Upload the file through /api/upload first.').optional(),
}).refine(v => !v.endsAt || v.endsAt > v.startsAt, { message: 'End time must be after the start.', path: ['endsAt'] });

// Platform admins, or admins of the hosting club, can create events.
router.post('/', validate(body), asyncHandler(async (req, res) => {
  const b = req.body;
  if (req.user.role !== 'admin' && !(b.clubId && await isClubAdmin(req.user.id, b.clubId)))
    throw new AppError(403, 'Only club admins or DIU staff can create events.', 'FORBIDDEN');
  const r = await q('INSERT INTO events (title, description, category, location, starts_at, ends_at, club_id, host_id, image_url) VALUES (?,?,?,?,?,?,?,?,?)',
    [b.title, b.description || null, b.category, b.location || null, b.startsAt, b.endsAt || null, b.clubId || null, req.user.id, b.imageUrl || null]);
  res.status(201).json({ event: shape(await one(`SELECT ${SELECT} WHERE e.id = ?`, [req.user.id, r.insertId])) });
}));

router.delete('/:id(\\d+)', asyncHandler(async (req, res) => {
  const ev = await one('SELECT host_id, club_id FROM events WHERE id = ?', [req.params.id]);
  if (!ev) throw notFound('Event');
  if (req.user.role !== 'admin' && ev.host_id !== req.user.id && !(ev.club_id && await isClubAdmin(req.user.id, ev.club_id))) throw new AppError(403, 'You cannot delete this event.', 'FORBIDDEN');
  await q('DELETE FROM events WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

router.put('/:id(\\d+)/going', asyncHandler(async (req, res) => {
  if (!(await one('SELECT id FROM events WHERE id = ?', [req.params.id]))) throw notFound('Event');
  await q('INSERT IGNORE INTO event_attendees (event_id, user_id) VALUES (?,?)', [req.params.id, req.user.id]);
  res.json({ going: true, goingCount: (await one('SELECT COUNT(*) AS n FROM event_attendees WHERE event_id = ?', [req.params.id])).n });
}));
router.delete('/:id(\\d+)/going', asyncHandler(async (req, res) => {
  await q('DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ going: false, goingCount: (await one('SELECT COUNT(*) AS n FROM event_attendees WHERE event_id = ?', [req.params.id])).n });
}));

export default router;
