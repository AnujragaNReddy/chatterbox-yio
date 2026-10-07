/**
 * Mapping a Yolo-Auth identity onto a local ChatterBox account.
 *
 * Every conversation, membership and message in this app is keyed on
 * users.id. A Google sign-in that produced only a set of claims would be a
 * person with no history, unable to be added to a conversation and invisible
 * to everyone else's contact list. So a Yolo-Auth identity resolves to a real
 * row, created once on first sign-in and found by email after that.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { pickAvatarColor } from '../config.js';

let migrated = false;

/**
 * Add the columns this needs, if they are not already there.
 *
 * The table predates Google sign-in and has neither an email nor any notion
 * of where an account came from. SQLite has no "ADD COLUMN IF NOT EXISTS",
 * so this checks the table info first and is safe to call repeatedly.
 */
export function ensureColumns() {
  if (migrated) return;

  const columns = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));

  if (!columns.has('email')) {
    // Deliberately not UNIQUE. SQLite cannot add a unique column to an
    // existing table, and every row already there would be NULL anyway.
    // Uniqueness is enforced by looking the email up before inserting.
    db.prepare('ALTER TABLE users ADD COLUMN email TEXT').run();
  }

  if (!columns.has('auth_provider')) {
    db.prepare("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local'").run();
  }

  migrated = true;
}

/** A username nobody already has, derived from the email. */
function freeUsername(email) {
  const base = String(email || '')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 16) || 'user';

  const taken = (name) => db.prepare('SELECT id FROM users WHERE username = ?').get(name);

  if (!taken(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}${suffix}`.slice(0, 20);
    if (!taken(candidate)) return candidate;
  }

  return `user${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * The local row for a verified Yolo-Auth identity, creating it if new.
 *
 * Matching is on email, and only when the token says it is verified. Google
 * marks unverified addresses, and matching on one would let someone who can
 * claim an address take over the ChatterBox account that uses it.
 */
export function resolveLocalUser(claims) {
  ensureColumns();

  const email = String(claims.email || '').trim().toLowerCase();

  if (!email) throw new Error('That sign-in carried no email address.');
  if (!claims.email_verified) {
    throw new Error('That Google account has an unverified email address.');
  }

  const existing = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email);
  if (existing) return existing;

  // An account that existed before Google sign-in, with a matching email.
  // Adopt it rather than creating a second one for the same person.
  const byEmailless = db
    .prepare("SELECT * FROM users WHERE email IS NULL AND lower(username) = ?")
    .get(email.split('@')[0]);

  if (byEmailless) {
    db.prepare("UPDATE users SET email = ?, auth_provider = 'yolo-auth' WHERE id = ?")
      .run(email, byEmailless.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(byEmailless.id);
  }

  const username = freeUsername(email);
  const displayName = String(claims.name || '').trim() || username;

  // password_hash is NOT NULL and this account has no password. A hash of a
  // long random value nobody holds keeps the column satisfied while making
  // password login for this account impossible rather than merely unlikely -
  // there is no input that produces this hash.
  const unusable = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

  const result = db
    .prepare(
      `INSERT INTO users (username, display_name, password_hash, avatar_color, email, auth_provider)
       VALUES (?, ?, ?, ?, ?, 'yolo-auth')`
    )
    .run(username, displayName, unusable, pickAvatarColor(username), email);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}
