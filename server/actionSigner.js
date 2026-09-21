import crypto from 'crypto';

const ACTION_SIGNING_SECRET =
  process.env.ACTION_SIGNING_SECRET || 'th_act_sec_99x_treasure_hunt_2026_salt_z9q';

// Nonce cache to prevent replay attacks.
// Stores nonces with timestamp.
const usedNonces = new Map();
const NONCE_TTL_MS = 180 * 1000; // 3 minutes

// Periodic cleanup of expired nonces every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [nonce, ts] of usedNonces.entries()) {
    if (now - ts > NONCE_TTL_MS) {
      usedNonces.delete(nonce);
    }
  }
}, 60 * 1000).unref();

export function normalizeActionPath(url) {
  if (!url) return '';
  const pathOnly = url.split('?')[0];
  return '/' + pathOnly.replace(/^(\/api\/|\/)/, '');
}

/**
 * Middleware: verifyActionSignature
 * Validates HMAC-SHA256 signature, timestamp freshness, and nonce uniqueness.
 * Rejects requests from curl/Termux/Postman that lack valid signatures.
 */
export function verifyActionSignature(req, res, next) {
  const timestampHeader = req.headers['x-action-timestamp'];
  const nonce = req.headers['x-action-nonce'];
  const clientSignature = req.headers['x-action-signature'];

  if (!timestampHeader || !nonce || !clientSignature) {
    return res.status(403).json({
      success: false,
      error: 'Security verification failed: missing action signature.',
      actionBlocked: true
    });
  }

  const timestamp = Number(timestampHeader);
  const now = Date.now();

  // Freshness check: must be within +/- 90 seconds (allows slight client clock skew)
  if (isNaN(timestamp) || Math.abs(now - timestamp) > 90 * 1000) {
    return res.status(403).json({
      success: false,
      error: 'Security verification failed: action request expired.',
      actionBlocked: true
    });
  }

  // Nonce replay check: ensure this nonce hasn't been used yet
  if (usedNonces.has(nonce)) {
    return res.status(403).json({
      success: false,
      error: 'Security verification failed: action replay detected.',
      actionBlocked: true
    });
  }

  // User check: user id must be present from authMiddleware
  const userId = String(req.user?.id || '');
  const method = req.method.toUpperCase();
  const cleanPath = normalizeActionPath(req.originalUrl || req.url || req.path);

  const bodyStr = req.rawBody
    ? req.rawBody
    : req.body
      ? typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body)
      : '';

  const message = `${userId}:${method}:${cleanPath}:${bodyStr}:${timestamp}:${nonce}`;

  const expectedSignature = crypto
    .createHmac('sha256', ACTION_SIGNING_SECRET)
    .update(message)
    .digest('hex');

  // Constant-time compare to prevent timing attacks
  try {
    const clientBuf = Buffer.from(clientSignature, 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');

    if (
      clientBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(clientBuf, expectedBuf)
    ) {
      console.warn(`[Security] Action signature mismatch for user ${userId} on ${cleanPath}`);
      return res.status(403).json({
        success: false,
        error: 'Security verification failed: invalid action signature.',
        actionBlocked: true
      });
    }
  } catch (e) {
    return res.status(403).json({
      success: false,
      error: 'Security verification failed: malformed action signature.',
      actionBlocked: true
    });
  }

  // Record nonce so it cannot be reused
  usedNonces.set(nonce, timestamp);

  next();
}
