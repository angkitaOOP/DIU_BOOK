import { Router } from 'express';
import { z } from 'zod';
import { q, one } from '../db.js';
import { AppError, asyncHandler, notFound } from '../utils/errors.js';
import { brief, likeEscape, userCols } from '../utils/helpers.js';
import { isOurAsset } from '../utils/cloudinary.js';
import { notify } from '../utils/notify.js';
import { auth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { isClubAdmin } from '../services/posts.js';

const router = Router();
router.use(auth);
const idParam = z.object({ id: z.coerce.number().int().positive() });
const asset = z.string().refine(isOurAsset, 'Upload the file through /api/upload first.').nullable();

const SELECT = (viewerParam = '?') => `
  c.id, c.name, c.category, c.description, c.image_url, c.cover_url, c.join_policy, c.created_at,
  (SELECT COUNT(*) FROM club_members m WHERE m.club_id = c.id AND m.status = 'active') AS member_count,
  (SELECT CONCAT(m.status, ':', m.role) FROM club_members m WHERE m.club_id = c.id AND m.user_id = ${viewerParam}) AS my_membership`;
const shape = r => {
  const [status, role] = (r.my_membership || '').split(':');
  return { id: r.id, name: r.name, category: r.category, description: r.description, imageUrl: r.image_url, coverUrl: r.cover_url,
    joinPolicy: r.join_policy, memberCount: r.member_count, joined: status === 'active', pending: status === 'pending', isAdmin: role === 'admin' && status === 'active' };
};

// GET /api/clubs?category=Tech&q=&mine=1
router.get('/', asyncHandler(async (req, res) => {
  const where = ['1=1'], params = [req.user.id];
  if (req.query.category && req.query.category !== 'All') { where.push('c.category = ?'); params.push(String(req.query.category)); }
  if (req.query.q) { const l = `%${likeEscape(String(req.query.q).slice(0, 80))}%`; where.push('(c.name LIKE ? OR c.description LIKE ?)'); params.push(l, l); }
  if (req.query.mine === '1') { where.push("EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = ? AND m.status = 'active')"); params.push(req.user.id); }
  const rows = await q(`SELECT ${SELECT()} FROM clubs c WHERE ${where.join(' AND ')} ORDER BY member_count DESC, c.name`, params);
  res.json({ items: rows.map(shape) });
}));

router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  const row = await one(`SELECT ${SELECT()} FROM clubs c WHERE c.id = ?`, [req.user.id, req.params.id]);
  if (!row) throw notFound('Club');
  res.json({ club: shape(row) });
}));

router.get('/:id(\\d+)/members', asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT ${userCols('u', '')}, m.role, m.joined_at FROM club_members m JOIN users u ON u.id = m.user_id AND u.status = 'active'
     WHERE m.club_id = ? AND m.status = 'active' ORDER BY (m.role = 'admin') DESC, m.joined_at LIMIT 200`, [req.params.id]);
  res.json({ items: rows.map(r => ({ ...brief(r), clubRole: r.role, joinedAt: r.joined_at })) });
}));

// Join (open clubs: instant; approval clubs: becomes a pending request)
router.post('/:id(\\d+)/join', asyncHandler(async (req, res) => {
  const club = await one('SELECT id, name, join_policy FROM clubs WHERE id = ?', [req.params.id]);
  if (!club) throw notFound('Club');
  const existing = await one('SELECT status FROM club_members WHERE club_id = ? AND user_id = ?', [club.id, req.user.id]);
  if (existing) return res.json({ joined: existing.status === 'active', pending: existing.status === 'pending' });
  const status = club.join_policy === 'open' ? 'active' : 'pending';
  await q('INSERT INTO club_members (club_id, user_id, status) VALUES (?,?,?)', [club.id, req.user.id, status]);
  if (status === 'pending') {
    const admins = await q("SELECT user_id FROM club_members WHERE club_id = ? AND role = 'admin' AND status = 'active'", [club.id]);
    for (const a of admins) await notify({ userId: a.user_id, actorId: req.user.id, type: 'club_join', entityType: 'club', entityId: club.id, message: `${req.user.name} asked to join ${club.name}` });
  }
  res.status(201).json({ joined: status === 'active', pending: status === 'pending' });
}));

router.delete('/:id(\\d+)/leave', asyncHandler(async (req, res) => {
  await q('DELETE FROM club_members WHERE club_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ joined: false, pending: false });
}));

// Club admins review pending requests
router.get('/:id(\\d+)/requests', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && !(await isClubAdmin(req.user.id, req.params.id))) throw new AppError(403, 'Only club admins can see requests.', 'FORBIDDEN');
  const rows = await q(`SELECT ${userCols('u', '')}, m.joined_at FROM club_members m JOIN users u ON u.id = m.user_id WHERE m.club_id = ? AND m.status = 'pending'`, [req.params.id]);
  res.json({ items: rows.map(r => ({ ...brief(r), requestedAt: r.joined_at })) });
}));
router.post('/:id(\\d+)/requests/:userId(\\d+)/:action(approve|reject)', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && !(await isClubAdmin(req.user.id, req.params.id))) throw new AppError(403, 'Only club admins can review requests.', 'FORBIDDEN');
  const club = await one('SELECT name FROM clubs WHERE id = ?', [req.params.id]);
  if (req.params.action === 'approve') {
    const r = await q("UPDATE club_members SET status = 'active' WHERE club_id = ? AND user_id = ? AND status = 'pending'", [req.params.id, req.params.userId]);
    if (!r.affectedRows) throw notFound('Request');
    await notify({ userId: Number(req.params.userId), actorId: req.user.id, type: 'club_join', entityType: 'club', entityId: Number(req.params.id), message: `Your request to join ${club.name} was approved` });
  } else {
    await q("DELETE FROM club_members WHERE club_id = ? AND user_id = ? AND status = 'pending'", [req.params.id, req.params.userId]);
  }
  res.json({ ok: true });
}));

/* ---- Create / edit (platform admins create; club admins edit) ---- */
const clubBody = z.object({
  name: z.string().trim().min(2).max(120), category: z.string().trim().min(2).max(40).default('General'),
  description: z.string().trim().max(2000).optional(), imageUrl: asset.optional(), coverUrl: asset.optional(),
  joinPolicy: z.enum(['open', 'approval']).default('open'),
});
router.post('/', requireRole('admin'), validate(clubBody.extend({ adminUserId: z.coerce.number().int().positive().optional() })), asyncHandler(async (req, res) => {
  const b = req.body;
  const r = await q('INSERT INTO clubs (name, category, description, image_url, cover_url, join_policy, created_by) VALUES (?,?,?,?,?,?,?)',
    [b.name, b.category, b.description || null, b.imageUrl || null, b.coverUrl || null, b.joinPolicy, req.user.id]);
  await q("INSERT INTO club_members (club_id, user_id, role, status) VALUES (?,?, 'admin', 'active') ON DUPLICATE KEY UPDATE role='admin', status='active'", [r.insertId, b.adminUserId || req.user.id]);
  res.status(201).json({ club: shape(await one(`SELECT ${SELECT()} FROM clubs c WHERE c.id = ?`, [req.user.id, r.insertId])) });
}));
router.patch('/:id(\\d+)', validate(clubBody.partial()), asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && !(await isClubAdmin(req.user.id, req.params.id))) throw new AppError(403, 'Only club admins can edit this club.', 'FORBIDDEN');
  const map = { name: 'name', category: 'category', description: 'description', imageUrl: 'image_url', coverUrl: 'cover_url', joinPolicy: 'join_policy' };
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(req.body)) if (map[k]) { sets.push(`${map[k]} = ?`); vals.push(v); }
  if (!sets.length) throw new AppError(400, 'Nothing to update.', 'EMPTY_UPDATE');
  await q(`UPDATE clubs SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
  res.json({ club: shape(await one(`SELECT ${SELECT()} FROM clubs c WHERE c.id = ?`, [req.user.id, req.params.id])) });
}));
router.post('/:id(\\d+)/admins/:userId(\\d+)', requireRole('admin'), asyncHandler(async (req, res) => {
  await q("INSERT INTO club_members (club_id, user_id, role, status) VALUES (?,?, 'admin', 'active') ON DUPLICATE KEY UPDATE role='admin', status='active'", [req.params.id, req.params.userId]);
  res.json({ ok: true });
}));

export default router;
