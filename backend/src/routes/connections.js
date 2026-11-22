import { Router } from 'express';
import { z } from 'zod';
import { q, one } from '../db.js';
import { AppError, asyncHandler, notFound } from '../utils/errors.js';
import { brief, userCols } from '../utils/helpers.js';
import { notify } from '../utils/notify.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(auth);
const idParam = z.object({ id: z.coerce.number().int().positive() });
const pairKey = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;

// My accepted connections
router.get('/', asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT ${userCols('u', '')}, c.responded_at FROM connection_edges e
     JOIN users u ON u.id = e.friend_id AND u.status = 'active'
     JOIN connections c ON c.pair_key = CONCAT(LEAST(e.user_id, e.friend_id), '-', GREATEST(e.user_id, e.friend_id))
     WHERE e.user_id = ? ORDER BY c.responded_at DESC`, [req.user.id]);
  res.json({ items: rows.map(r => ({ ...brief(r), connectedAt: r.responded_at })) });
}));

// Incoming requests (My Network > Requests)
router.get('/requests', asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT c.id AS request_id, c.created_at, ${userCols('u', '')},
       (SELECT COUNT(*) FROM connection_edges a JOIN connection_edges b ON a.friend_id = b.friend_id WHERE a.user_id = u.id AND b.user_id = ?) AS mutual
     FROM connections c JOIN users u ON u.id = c.requester_id
     WHERE c.addressee_id = ? AND c.status = 'pending' ORDER BY c.id DESC`, [req.user.id, req.user.id]);
  res.json({ items: rows.map(r => ({ requestId: r.request_id, sentAt: r.created_at, mutualConnections: r.mutual, user: brief(r) })) });
}));

// Requests I sent that are still pending
router.get('/sent', asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT c.id AS request_id, c.created_at, ${userCols('u', '')} FROM connections c JOIN users u ON u.id = c.addressee_id
     WHERE c.requester_id = ? AND c.status = 'pending' ORDER BY c.id DESC`, [req.user.id]);
  res.json({ items: rows.map(r => ({ requestId: r.request_id, sentAt: r.created_at, user: brief(r) })) });
}));

// Send a request. If they already requested me, this accepts it.
router.post('/request', validate(z.object({ userId: z.coerce.number().int().positive() })), asyncHandler(async (req, res) => {
  const me = req.user.id, target = req.body.userId;
  if (target === me) throw new AppError(400, 'You cannot connect with yourself.', 'SELF_CONNECT');
  const other = await one("SELECT id, name FROM users WHERE id = ? AND status = 'active'", [target]);
  if (!other) throw notFound('Member');
  const existing = await one('SELECT * FROM connections WHERE pair_key = ?', [pairKey(me, target)]);
  if (existing) {
    if (existing.status === 'accepted') throw new AppError(409, 'You are already connected.', 'ALREADY_CONNECTED');
    if (existing.requester_id === me) throw new AppError(409, 'Request already sent.', 'ALREADY_REQUESTED');
    await q("UPDATE connections SET status = 'accepted', responded_at = NOW() WHERE id = ?", [existing.id]);
    await notify({ userId: target, actorId: me, type: 'connection_accepted', entityType: 'user', entityId: me, message: `${req.user.name} accepted your connection request` });
    return res.json({ status: 'connected' });
  }
  await q('INSERT INTO connections (requester_id, addressee_id) VALUES (?, ?)', [me, target]);
  await notify({ userId: target, actorId: me, type: 'connection_request', entityType: 'user', entityId: me, message: `${req.user.name} sent you a connection request` });
  res.status(201).json({ status: 'pending_sent' });
}));

router.post('/:id/accept', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const row = await one("SELECT * FROM connections WHERE id = ? AND addressee_id = ? AND status = 'pending'", [req.params.id, req.user.id]);
  if (!row) throw notFound('Request');
  await q("UPDATE connections SET status = 'accepted', responded_at = NOW() WHERE id = ?", [row.id]);
  await notify({ userId: row.requester_id, actorId: req.user.id, type: 'connection_accepted', entityType: 'user', entityId: req.user.id, message: `${req.user.name} accepted your connection request` });
  res.json({ status: 'connected' });
}));

// Ignore an incoming request, or cancel one I sent
router.delete('/:id', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const r = await q("DELETE FROM connections WHERE id = ? AND status = 'pending' AND (addressee_id = ? OR requester_id = ?)", [req.params.id, req.user.id, req.user.id]);
  if (!r.affectedRows) throw notFound('Request');
  res.status(204).end();
}));

// Remove an existing connection by the other member's user id
router.delete('/user/:id', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const r = await q('DELETE FROM connections WHERE pair_key = ?', [pairKey(req.user.id, req.params.id)]);
  if (!r.affectedRows) throw notFound('Connection');
  res.status(204).end();
}));

export default router;
