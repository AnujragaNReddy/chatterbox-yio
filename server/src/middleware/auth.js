import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { verifyYoloToken, yoloAuthEnabled } from '../lib/yoloAuth.js';
import { resolveLocalUser } from '../lib/yoloUser.js';

/**
 * Accept this app's own token, or a Yolo-Auth one.
 *
 * Both kinds end up as the same req.user shape, so every route downstream is
 * unchanged and does not need to know which was presented.
 *
 * The native check runs first on purpose: it is synchronous, needs no
 * network, and covers everyone already signed in. Only a token it rejects is
 * worth a JWKS lookup, so adding Google sign-in costs existing users nothing.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  try {
    // Algorithm pinned. This verifier now sits beside an RS256 one, and an
    // unpinned verify is how a token signed with the wrong kind of key gets
    // accepted by the wrong check.
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.authProvider = 'local';
    return next();
  } catch {
    // Not one of ours. It may still be a Yolo-Auth token.
  }

  if (!yoloAuthEnabled()) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const claims = await verifyYoloToken(token);
    const user = resolveLocalUser(claims);

    req.user = { id: user.id, username: user.username };
    req.authProvider = 'yolo-auth';
    return next();
  } catch (error) {
    return res.status(401).json({ error: error.message || 'Invalid or expired token' });
  }
}
