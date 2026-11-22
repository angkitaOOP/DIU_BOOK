import { q, one } from '../db.js';
import { emitToUser } from '../realtime.js';
import { mergeSettings } from './settings.js';

// Which settings toggle controls which notification type.
const SETTING_KEY = { reaction: 'reactions', comment: 'reactions', share: 'reactions', job: 'jobs', event: 'events', message: 'messages' };

export async function notify({ userId, actorId = null, type, entityType = null, entityId = null, message }) {
  if (!userId || userId === actorId) return;
  const target = await one("SELECT settings FROM users WHERE id = ? AND status = 'active'", [userId]);
  if (!target) return;
  const key = SETTING_KEY[type];
  if (key && mergeSettings(target.settings).notifications[key] === false) return;

  // Same actor + type + entity within 24h only notifies once.
  if (actorId && entityId) {
    const dup = await one(
      `SELECT id FROM notifications WHERE user_id=? AND actor_id=? AND type=? AND entity_type <=> ? AND entity_id <=> ?
       AND created_at > (NOW() - INTERVAL 1 DAY) LIMIT 1`, [userId, actorId, type, entityType, entityId]);
    if (dup) return;
  }
  const res = await q(
    'INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, message) VALUES (?,?,?,?,?,?)',
    [userId, actorId, type, entityType, entityId, message.slice(0, 255)]);
  const actor = actorId ? await one('SELECT id, name, avatar_url FROM users WHERE id = ?', [actorId]) : null;
  emitToUser(userId, 'notification:new', {
    id: res.insertId, type, entityType, entityId, message, isRead: false, createdAt: new Date().toISOString(),
    actor: actor && { id: actor.id, name: actor.name, avatarUrl: actor.avatar_url },
  });
}

export async function notifyMany(userIds, payload) {
  for (const userId of userIds) await notify({ ...payload, userId });
}
