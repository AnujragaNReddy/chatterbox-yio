import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { JWT_SECRET, pickAvatarColor } from '../config.js';
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

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

router.post('/register', (req, res) => {
  const { username, password, displayName } = req.body || {};

  if (!username || !password || !displayName) {
    return res.status(400).json({ error: 'username, password and displayName are required' });
  }
  const cleanUsername = String(username).trim().toLowerCase();
  if (!/^[a-z0-9_.]{3,20}$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'Username must be 3-20 chars: letters, numbers, dot, underscore' });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const passwordHash = bcrypt.hashSync(String(password), 10);
  const avatarColor = pickAvatarColor(cleanUsername);

  const result = db
    .prepare('INSERT INTO users (username, display_name, password_hash, avatar_color) VALUES (?, ?, ?, ?)')
    .run(cleanUsername, String(displayName).trim(), passwordHash, avatarColor);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: toPublicUser(user) });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  const cleanUsername = String(username).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  res.json({ token: signToken(user), user: toPublicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: toPublicUser(user) });
});

export { toPublicUser };
export default router;
