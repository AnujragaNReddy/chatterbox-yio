import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    statusText: row.status_text,
    isOnline: !!row.is_online,
    lastSeen: row.last_seen,
  };
}

// List/search all other users (the "contacts directory")
router.get('/', requireAuth, (req, res) => {
  const q = (req.query.q || '').toString().trim().toLowerCase();
  let rows;
  if (q) {
    rows = db
      .prepare(
        `SELECT * FROM users WHERE id != ? AND (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ?) ORDER BY display_name`
      )
      .all(req.user.id, `%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM users WHERE id != ? ORDER BY display_name').all(req.user.id);
  }
  res.json({ users: rows.map(toPublicUser) });
});

router.patch('/me', requireAuth, (req, res) => {
  const { displayName, statusText } = req.body || {};
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!current) return res.status(404).json({ error: 'User not found' });

  const nextDisplayName = displayName?.trim() || current.display_name;
  const nextStatusText = statusText?.trim() ?? current.status_text;

  db.prepare('UPDATE users SET display_name = ?, status_text = ? WHERE id = ?').run(
    nextDisplayName,
    nextStatusText,
    req.user.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: toPublicUser(updated) });
});

export { toPublicUser };
export default router;
