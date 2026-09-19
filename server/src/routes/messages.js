import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function toPublicMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.display_name,
    senderAvatarColor: row.avatar_color,
    content: row.content,
    createdAt: row.created_at,
  };
}

function assertMember(conversationId, userId, res) {
  const membership = db
    .prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .get(conversationId, userId);
  if (!membership) {
    res.status(403).json({ error: 'Not a member of this conversation' });
    return false;
  }
  return true;
}

// Paginated message history, oldest-to-newest, using `before` message id as cursor
router.get('/:conversationId', requireAuth, (req, res) => {
  const conversationId = Number(req.params.conversationId);
  if (!assertMember(conversationId, req.user.id, res)) return;

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;

  const rows = db
    .prepare(
      `SELECT m.*, u.display_name, u.avatar_color FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? AND m.id < ?
       ORDER BY m.id DESC LIMIT ?`
    )
    .all(conversationId, before, limit);

  res.json({ messages: rows.map(toPublicMessage).reverse() });
});

export { toPublicMessage, assertMember };
export default router;
