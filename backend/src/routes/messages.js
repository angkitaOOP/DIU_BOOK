import { Router } from 'express';
import { z } from 'zod';
import { q, one } from '../db.js';
import { asyncHandler } from '../utils/errors.js';
import { brief, userCols } from '../utils/helpers.js';
import { mergeSettings } from '../utils/settings.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assertParticipant, getOrCreateDirect, markRead, sendMessage, shapeMessage } from '../services/messages.js';
import { isOnline } from '../realtime.js';

const router = Router();
router.use(auth);
const idParam = z.object({ id: z.coerce.number().int().positive() });

// Conversation list (left column of the Messages page)
router.get('/conversations', asyncHandler(async (req, res) => {
  const me = req.user.id;
  const rows = await q(
    `SELECT cv.id, cv.last_message_at, mine.last_read_message_id, ${userCols('o', 'o_')}, o.settings AS o_settings,
       lm.id AS lm_id, lm.content AS lm_content, lm.sender_id AS lm_sender, lm.created_at AS lm_at,
       (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = cv.id AND m.sender_id <> ? AND m.id > COALESCE(mine.last_read_message_id, 0)) AS unread
     FROM conversation_participants mine
     JOIN conversations cv ON cv.id = mine.conversation_id AND cv.type = 'direct'
     JOIN conversation_participants op ON op.conversation_id = cv.id AND op.user_id <> mine.user_id
     JOIN users o ON o.id = op.user_id
     LEFT JOIN messages lm ON lm.id = (SELECT MAX(id) FROM messages WHERE conversation_id = cv.id)
     WHERE mine.user_id = ? AND lm.id IS NOT NULL
     ORDER BY cv.last_message_at DESC LIMIT 100`, [me, me]);
  res.json({ items: rows.map(r => ({
    id: r.id, user: brief(r, 'o_'), unread: r.unread,
    online: mergeSettings(r.o_settings).privacy.showActive && isOnline(r.o_id),
    lastMessage: { id: r.lm_id, content: r.lm_content, senderId: r.lm_sender, createdAt: r.lm_at },
  })) });
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  const r = await one(
    `SELECT COUNT(DISTINCT m.conversation_id) AS conversations FROM messages m
     JOIN conversation_participants p ON p.conversation_id = m.conversation_id AND p.user_id = ?
     WHERE m.sender_id <> ? AND m.id > COALESCE(p.last_read_message_id, 0)`, [req.user.id, req.user.id]);
  res.json({ count: r.conversations });
}));

// Start (or reopen) a 1:1 chat -> { conversationId }
router.post('/conversations', validate(z.object({ userId: z.coerce.number().int().positive() })), asyncHandler(async (req, res) => {
  res.status(201).json({ conversationId: await getOrCreateDirect(req.user, req.body.userId) });
}));

// Message history, newest page first. Use ?before=<messageId> for older ones.
router.get('/conversations/:id/messages', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  await assertParticipant(req.params.id, req.user.id);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100), before = Number(req.query.before) || 0;
  const rows = await q(`SELECT * FROM messages WHERE conversation_id = ? ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`,
    before ? [req.params.id, before, limit] : [req.params.id, limit]);
  const other = await one(
    `SELECT ${userCols('u', '')}, u.settings, p.last_read_message_id FROM conversation_participants p JOIN users u ON u.id = p.user_id
     WHERE p.conversation_id = ? AND p.user_id <> ?`, [req.params.id, req.user.id]);
  res.json({
    items: rows.reverse().map(shapeMessage), nextBefore: rows.length === limit ? rows[0].id : null,
    otherUser: other && { ...brief(other), online: mergeSettings(other.settings).privacy.showActive && isOnline(other.id), lastReadMessageId: other.last_read_message_id },
  });
}));

// REST fallback for sending (the frontend normally uses the socket event "message:send")
router.post('/conversations/:id/messages', validate(idParam, 'params'), validate(z.object({ content: z.string() })), asyncHandler(async (req, res) => {
  res.status(201).json({ message: await sendMessage({ conversationId: req.params.id, sender: req.user, content: req.body.content }) });
}));

router.post('/conversations/:id/read', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  res.json({ lastReadMessageId: await markRead(req.params.id, req.user.id) });
}));

export default router;
