import { Server } from 'socket.io';
import { config } from './config.js';
import { q, one } from './db.js';
import { verifyToken, loadUser } from './middleware/auth.js';
import { setIO, emitToUser, markConnected, markDisconnected } from './realtime.js';
import { mergeSettings } from './utils/settings.js';
import { assertParticipant, markRead, participantIds, sendMessage } from './services/messages.js';

async function broadcastPresence(user, online) {
  if (!mergeSettings(user.settings).privacy.showActive) return;
  const friends = await q('SELECT friend_id FROM connection_edges WHERE user_id = ?', [user.id]);
  for (const f of friends) emitToUser(f.friend_id, 'presence:update', { userId: user.id, online });
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: config.clientUrls, credentials: true }, maxHttpBufferSize: 1e5 });
  setIO(io);

  // Client connects with: io(API_URL, { auth: { token } })
  io.use(async (socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token || '');
      const user = await loadUser(payload.sub);
      if (!user || user.status !== 'active') return next(new Error('ACCOUNT_INACTIVE'));
      socket.data.user = user;
      next();
    } catch { next(new Error('UNAUTHENTICATED')); }
  });

  io.on('connection', socket => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    if (markConnected(user.id)) broadcastPresence(user, true).catch(console.error);

    // Tiny per-socket limiter: max 20 sends per 10s
    let sent = 0;
    const reset = setInterval(() => { sent = 0; }, 10_000);

    // emit('message:send', { conversationId, content }, ack)  ->  ack({ ok, message | error })
    socket.on('message:send', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (++sent > 20) return reply({ ok: false, error: 'You are sending messages too fast.' });
        const message = await sendMessage({ conversationId: Number(payload?.conversationId), sender: user, content: payload?.content });
        reply({ ok: true, message });
      } catch (e) { reply({ ok: false, error: e.message }); }
    });

    socket.on('typing', async ({ conversationId, isTyping } = {}) => {
      try {
        const id = Number(conversationId);
        await assertParticipant(id, user.id);
        for (const uid of await participantIds(id)) if (uid !== user.id) emitToUser(uid, 'typing', { conversationId: id, userId: user.id, isTyping: !!isTyping });
      } catch { /* ignore */ }
    });

    socket.on('message:read', async ({ conversationId, upTo } = {}) => {
      try { await markRead(Number(conversationId), user.id, upTo ? Number(upTo) : undefined); } catch { /* ignore */ }
    });

    socket.on('disconnect', () => {
      clearInterval(reset);
      if (markDisconnected(user.id)) {
        q('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [user.id]).catch(() => {});
        broadcastPresence(user, false).catch(console.error);
      }
    });
  });
  return io;
}
