import { q, one, tx } from '../db.js';
import { AppError } from '../utils/errors.js';
import { mergeSettings } from '../utils/settings.js';
import { emitToUser } from '../realtime.js';

const key = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;

export const shapeMessage = r => ({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, content: r.content, createdAt: r.created_at });

/** Can `sender` start/continue a chat with `targetId`? */
export async function assertCanMessage(sender, targetId) {
  if (sender.id === targetId) throw new AppError(400, 'You cannot message yourself.', 'SELF_MESSAGE');
  const t = await one("SELECT id, role, settings FROM users WHERE id = ? AND status = 'active'", [targetId]);
  if (!t) throw new AppError(404, 'Member not found', 'NOT_FOUND');
  if (sender.role === 'alumni' && t.role === 'student' && mergeSettings(t.settings).privacy.alumniMessages === false) {
    const connected = await one('SELECT 1 AS x FROM connection_edges WHERE user_id = ? AND friend_id = ?', [sender.id, targetId]);
    if (!connected) throw new AppError(403, 'This student only accepts messages from alumni they are connected with.', 'MESSAGING_RESTRICTED');
  }
}

export async function getOrCreateDirect(sender, targetId) {
  await assertCanMessage(sender, targetId);
  const k = key(sender.id, targetId);
  const existing = await one('SELECT id FROM conversations WHERE direct_key = ?', [k]);
  if (existing) return existing.id;
  try {
    return await tx(async c => {
      const [r] = await c.query("INSERT INTO conversations (type, direct_key) VALUES ('direct', ?)", [k]);
      await c.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?,?), (?,?)', [r.insertId, sender.id, r.insertId, targetId]);
      return r.insertId;
    });
  } catch (e) { // two people started the chat at the same moment
    if (e.code === 'ER_DUP_ENTRY') return (await one('SELECT id FROM conversations WHERE direct_key = ?', [k])).id;
    throw e;
  }
}

export const participantIds = async conversationId =>
  (await q('SELECT user_id FROM conversation_participants WHERE conversation_id = ?', [conversationId])).map(r => r.user_id);

export async function assertParticipant(conversationId, userId) {
  const ok = await one('SELECT 1 AS x FROM conversation_participants WHERE conversation_id = ? AND user_id = ?', [conversationId, userId]);
  if (!ok) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
}

export async function sendMessage({ conversationId, sender, content }) {
  const text = String(content ?? '').trim();
  if (!text) throw new AppError(400, 'Write a message first.', 'EMPTY_MESSAGE');
  if (text.length > 4000) throw new AppError(400, 'Message is too long (max 4000 characters).', 'MESSAGE_TOO_LONG');
  await assertParticipant(conversationId, sender.id);
  const message = await tx(async c => {
    const [r] = await c.query('INSERT INTO messages (conversation_id, sender_id, content) VALUES (?,?,?)', [conversationId, sender.id, text]);
    await c.query('UPDATE conversations SET last_message_at = NOW(3) WHERE id = ?', [conversationId]);
    await c.query('UPDATE conversation_participants SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ?', [r.insertId, conversationId, sender.id]);
    const [[row]] = await c.query('SELECT * FROM messages WHERE id = ?', [r.insertId]);
    return shapeMessage(row);
  });
  for (const uid of await participantIds(conversationId)) emitToUser(uid, 'message:new', message);
  return message;
}

export async function markRead(conversationId, userId, upTo) {
  await assertParticipant(conversationId, userId);
  const last = upTo || (await one('SELECT MAX(id) AS id FROM messages WHERE conversation_id = ?', [conversationId]))?.id;
  if (!last) return null;
  await q('UPDATE conversation_participants SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ?) WHERE conversation_id = ? AND user_id = ?', [last, conversationId, userId]);
  for (const uid of await participantIds(conversationId)) if (uid !== userId) emitToUser(uid, 'message:read', { conversationId, userId, lastReadMessageId: last });
  return last;
}
