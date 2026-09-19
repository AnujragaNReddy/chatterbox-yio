import jwt from 'jsonwebtoken';
import db from '../db.js';
import { JWT_SECRET } from '../config.js';
import { toPublicMessage, assertMember } from '../routes/messages.js';

function roomName(conversationId) {
  return `conversation:${conversationId}`;
}

function getUserConversationIds(userId) {
  return db
    .prepare('SELECT conversation_id FROM conversation_members WHERE user_id = ?')
    .all(userId)
    .map((r) => r.conversation_id);
}

function setPresence(userId, isOnline) {
  db.prepare("UPDATE users SET is_online = ?, last_seen = datetime('now') WHERE id = ?").run(isOnline ? 1 : 0, userId);
}

export function attachSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing auth token'));
      const payload = jwt.verify(token, JWT_SECRET);
      socket.userId = payload.id;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid auth token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    const conversationIds = getUserConversationIds(socket.userId);
    conversationIds.forEach((id) => socket.join(roomName(id)));

    setPresence(socket.userId, true);
    conversationIds.forEach((id) =>
      socket.to(roomName(id)).emit('presence:update', { userId: socket.userId, isOnline: true })
    );

    socket.on('message:send', ({ conversationId, content }, ack) => {
      const text = String(content || '').trim();
      if (!text || !conversationId) return ack?.({ error: 'Invalid message' });

      const fakeRes = { status: () => ({ json: () => {} }) };
      if (!assertMember(conversationId, socket.userId, fakeRes)) {
        return ack?.({ error: 'Not a member of this conversation' });
      }

      const result = db
        .prepare('INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)')
        .run(conversationId, socket.userId, text);

      const row = db
        .prepare(
          `SELECT m.*, u.display_name, u.avatar_color FROM messages m
           JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
        )
        .get(result.lastInsertRowid);

      const message = toPublicMessage(row);
      io.to(roomName(conversationId)).emit('message:new', message);
      ack?.({ message });
    });

    socket.on('typing', ({ conversationId, isTyping }) => {
      if (!conversationId) return;
      socket.to(roomName(conversationId)).emit('typing', {
        conversationId,
        userId: socket.userId,
        isTyping: !!isTyping,
      });
    });

    socket.on('conversation:read', ({ conversationId }) => {
      if (!conversationId) return;
      const latest = db.prepare('SELECT MAX(id) AS maxId FROM messages WHERE conversation_id = ?').get(conversationId);
      db.prepare(
        'UPDATE conversation_members SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ?'
      ).run(latest?.maxId || 0, conversationId, socket.userId);

      socket.to(roomName(conversationId)).emit('message:read', {
        conversationId,
        readerId: socket.userId,
        upToMessageId: latest?.maxId || 0,
      });
    });

    socket.on('conversation:join', ({ conversationId }) => {
      if (conversationId && assertMember(conversationId, socket.userId, { status: () => ({ json: () => {} }) })) {
        socket.join(roomName(conversationId));
      }
    });

    socket.on('disconnect', () => {
      setPresence(socket.userId, false);
      const lastSeen = db.prepare('SELECT last_seen FROM users WHERE id = ?').get(socket.userId)?.last_seen;
      conversationIds.forEach((id) =>
        socket.to(roomName(id)).emit('presence:update', { userId: socket.userId, isOnline: false, lastSeen })
      );
    });
  });
}
