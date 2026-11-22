import { Router } from 'express';
import { q, one } from '../db.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { pageParams } from '../utils/helpers.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

const shape = r => ({
  id: r.id, type: r.type, entityType: r.entity_type, entityId: r.entity_id, message: r.message,
  isRead: !!r.is_read, createdAt: r.created_at,
  actor: r.actor_id ? { id: r.actor_id, name: r.actor_name, avatarUrl: r.actor_avatar } : null,
});

// GET /api/notifications?unread=1&limit=20&before=<id>
router.get('/', asyncHandler(async (req, res) => {
  const { limit } = pageParams(req.query, 20, 50);
  const where = ['n.user_id = ?'], params = [req.user.id];
  if (req.query.unread === '1') where.push('n.is_read = 0');
  if (req.query.before) { where.push('n.id < ?'); params.push(Number(req.query.before) || 0); }
  const rows = await q(
    `SELECT n.*, a.name AS actor_name, a.avatar_url AS actor_avatar FROM notifications n LEFT JOIN users a ON a.id = n.actor_id
     WHERE ${where.join(' AND ')} ORDER BY n.id DESC LIMIT ?`, [...params, limit]);
  const unread = await one('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
  res.json({ items: rows.map(shape), unreadCount: unread.c, nextCursor: rows.length === limit ? rows[rows.length - 1].id : null });
}));

router.get('/unread-count', asyncHandler(async (req, res) =>
  res.json({ count: (await one('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id])).c })));

router.post('/read-all', asyncHandler(async (req, res) => {
  await q('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
  res.json({ ok: true });
}));

router.post('/:id(\\d+)/read', asyncHandler(async (req, res) => {
  const r = await q('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!r.affectedRows) throw notFound('Notification');
  res.json({ ok: true });
}));

export default router;
