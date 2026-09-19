import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toPublicUser } from './users.js';

const router = Router();

function getMembers(conversationId) {
  return db
    .prepare(
      `SELECT u.* FROM users u
       JOIN conversation_members cm ON cm.user_id = u.id
       WHERE cm.conversation_id = ?`
    )
    .all(conversationId)
    .map(toPublicUser);
}

function buildSummary(conversation, currentUserId) {
  const members = getMembers(conversation.id);
  const otherMembers = members.filter((m) => m.id !== currentUserId);

  const lastMessage = db
    .prepare(
      `SELECT m.*, u.display_name AS sender_name FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? ORDER BY m.id DESC LIMIT 1`
    )
    .get(conversation.id);

  const membership = db
    .prepare('SELECT last_read_message_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .get(conversation.id, currentUserId);
  const lastRead = membership?.last_read_message_id || 0;

  const unreadCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM messages
       WHERE conversation_id = ? AND id > ? AND sender_id != ?`
    )
    .get(conversation.id, lastRead, currentUserId).count;

  const isDirect = conversation.type === 'direct';
  const displayName = isDirect ? otherMembers[0]?.displayName ?? 'Unknown' : conversation.name;
  const avatarColor = isDirect ? otherMembers[0]?.avatarColor ?? '#999' : '#546E7A';

  return {
    id: conversation.id,
    type: conversation.type,
    name: displayName,
    avatarColor,
    members,
    otherUser: isDirect ? otherMembers[0] ?? null : null,
    lastMessage: lastMessage
      ? { id: lastMessage.id, content: lastMessage.content, senderId: lastMessage.sender_id, senderName: lastMessage.sender_name, createdAt: lastMessage.created_at }
      : null,
    unreadCount,
    createdAt: conversation.created_at,
  };
}

// List all conversations for current user, most recently active first
router.get('/', requireAuth, (req, res) => {
  const conversations = db
    .prepare(
      `SELECT c.* FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       WHERE cm.user_id = ?`
    )
    .all(req.user.id);

  const summaries = conversations
    .map((c) => buildSummary(c, req.user.id))
    .sort((a, b) => {
      const at = a.lastMessage?.createdAt || a.createdAt;
      const bt = b.lastMessage?.createdAt || b.createdAt;
      return bt.localeCompare(at);
    });

  res.json({ conversations: summaries });
});

// Get or create a direct conversation with another user
router.post('/direct', requireAuth, (req, res) => {
  const { userId } = req.body || {};
  const otherId = Number(userId);
  if (!otherId || otherId === req.user.id) return res.status(400).json({ error: 'Valid userId is required' });

  const otherUser = db.prepare('SELECT * FROM users WHERE id = ?').get(otherId);
  if (!otherUser) return res.status(404).json({ error: 'User not found' });

  const existing = db
    .prepare(
      `SELECT c.* FROM conversations c
       WHERE c.type = 'direct'
       AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ?)
       AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ?)`
    )
    .get(req.user.id, otherId);

  if (existing) return res.json({ conversation: buildSummary(existing, req.user.id) });

  const result = db.prepare(`INSERT INTO conversations (type, created_by) VALUES ('direct', ?)`).run(req.user.id);
  const conversationId = result.lastInsertRowid;
  const addMember = db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)');
  addMember.run(conversationId, req.user.id);
  addMember.run(conversationId, otherId);

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  const io = req.app.get('io');
  io?.to(`user:${otherId}`).emit('conversation:new', buildSummary(conversation, otherId));

  res.status(201).json({ conversation: buildSummary(conversation, req.user.id) });
});

// Create a group conversation
router.post('/group', requireAuth, (req, res) => {
  const { name, memberIds } = req.body || {};
  const cleanName = String(name || '').trim();
  const ids = Array.isArray(memberIds) ? [...new Set(memberIds.map(Number).filter(Boolean))] : [];

  if (!cleanName) return res.status(400).json({ error: 'Group name is required' });
  if (ids.length < 1) return res.status(400).json({ error: 'Select at least one other member' });

  const result = db
    .prepare(`INSERT INTO conversations (type, name, created_by) VALUES ('group', ?, ?)`)
    .run(cleanName, req.user.id);
  const conversationId = result.lastInsertRowid;

  const addMember = db.prepare('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)');
  addMember.run(conversationId, req.user.id);
  for (const id of ids) {
    if (id !== req.user.id) addMember.run(conversationId, id);
  }

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  const io = req.app.get('io');
  for (const id of ids) {
    if (id !== req.user.id) io?.to(`user:${id}`).emit('conversation:new', buildSummary(conversation, id));
  }

  res.status(201).json({ conversation: buildSummary(conversation, req.user.id) });
});

router.get('/:id', requireAuth, (req, res) => {
  const conversationId = Number(req.params.id);
  const membership = db
    .prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .get(conversationId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a member of this conversation' });

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  res.json({ conversation: buildSummary(conversation, req.user.id) });
});

router.patch('/:id/read', requireAuth, (req, res) => {
  const conversationId = Number(req.params.id);
  const latest = db.prepare('SELECT MAX(id) AS maxId FROM messages WHERE conversation_id = ?').get(conversationId);
  db.prepare('UPDATE conversation_members SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ?').run(
    latest?.maxId || 0,
    conversationId,
    req.user.id
  );
  res.json({ ok: true });
});

export { buildSummary, getMembers };
export default router;
