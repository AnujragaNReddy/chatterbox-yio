/**
 * Accepting Yolo-Auth tokens alongside this app's own.
 *
 * Unlike the other apps in this folder, ChatterBox already had a complete
 * auth system — its own accounts, its own JWTs, its own socket handshake, and
 * people already signed in. So this does not replace any of it. A request may
 * carry either kind of token, and both resolve to the same local user row,
 * because every message, conversation and membership is keyed on that row's
 * id. A Google identity that did not map onto one would be a person who
 * cannot see their own history.
 *
 * No new dependency: Node imports a JWK directly into a public key, so the
 * JWKS is verified with the crypto module and the jsonwebtoken already here.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const ISSUER = (process.env.AUTH_ISSUER || '').trim().replace(/\/$/, '');
const AUDIENCE = (process.env.AUTH_AUDIENCE || '').trim();

// Keys change about never, and a token signed by one we have not seen
// refetches immediately regardless, so a rotation is picked up at once rather
// than after this elapses.
const JWKS_TTL_MS = 60 * 60 * 1000;
const JWKS_TIMEOUT_MS = 15000;

let cache = new Map();
let fetchedAt = 0;
let inFlight = null;

export function yoloAuthEnabled() {
  return Boolean(ISSUER);
}

export function jwksUrl() {
  return `${ISSUER}/.well-known/jwks.json`;
}

async function loadKeys(force = false) {
  if (cache.size && !force && Date.now() - fetchedAt < JWKS_TTL_MS) {
    return cache;
  }

  // One fetch at a time. A burst of requests arriving with an unknown key id
  // would otherwise each start their own.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), JWKS_TIMEOUT_MS);

      let document;
      try {
        const response = await fetch(jwksUrl(), { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        document = await response.json();
      } finally {
        clearTimeout(timer);
      }

      const loaded = new Map();
      for (const jwk of document.keys || []) {
        if (!jwk.kid) continue;
        // Node turns a JWK into a usable key directly, so there is no PEM
        // juggling and no extra package to keep current.
        loaded.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
      }

      if (!loaded.size) throw new Error('no usable keys published');

      cache = loaded;
      fetchedAt = Date.now();
      return cache;
    } catch (error) {
      // Keep serving with a cached key if there is one. The auth service
      // being briefly unreachable should not sign everybody out.
      if (cache.size) return cache;
      throw new Error(`Could not fetch signing keys from ${jwksUrl()}: ${error.message}`);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Verify a Yolo-Auth access token. Returns its claims, or throws. */
export async function verifyYoloToken(token) {
  if (!yoloAuthEnabled()) throw new Error('Yolo-Auth is not configured.');
  if (!token) throw new Error('No token supplied.');

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid) throw new Error('Token carries no key id.');

  let keys = await loadKeys();
  let key = keys.get(decoded.header.kid);

  if (!key) {
    keys = await loadKeys(true);
    key = keys.get(decoded.header.kid);
  }

  if (!key) throw new Error(`Token signed by an unknown key (${decoded.header.kid}).`);

  return jwt.verify(token, key, {
    // Pinned. Leaving this open is how "alg: none" and
    // HMAC-with-the-public-key attacks get in — and this app also verifies
    // HS256 tokens of its own, so an unpinned verifier here would happily
    // accept one signed with a public key anybody can fetch.
    algorithms: ['RS256'],
    issuer: ISSUER,
    ...(AUDIENCE ? { audience: AUDIENCE } : {}),
  });
}

export function describe() {
  return {
    enabled: yoloAuthEnabled(),
    issuer: ISSUER || null,
    audience: AUDIENCE || null,
    keysCached: cache.size,
  };
}
