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

export function getCanonicalBodyString(data) {
  if (data === undefined || data === null) return '';
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed || trimmed === '{}') return '';
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) return '';
      return JSON.stringify(parsed, Object.keys(parsed).sort());
    } catch {
      return trimmed;
    }
  }
  if (typeof data === 'object') {
    if (Object.keys(data).length === 0) return '';
    return JSON.stringify(data, Object.keys(data).sort());
  }
  return String(data);
}

function computeHmac(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
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

  const userId = String(req.user?.id || '');
  const method = req.method.toUpperCase();

  // Candidate paths: matched route path, baseUrl+route, originalUrl, or path
  const paths = [
    normalizeActionPath(req.route?.path),
    normalizeActionPath(req.baseUrl ? req.baseUrl + (req.route?.path || req.path) : ''),
    normalizeActionPath(req.originalUrl),
    normalizeActionPath(req.url),
    normalizeActionPath(req.path)
  ].filter(Boolean);
  const uniquePaths = Array.from(new Set(paths));

  // Determine possible body string representations
  const rawBodyCanonical = getCanonicalBodyString(req.rawBody);
  const parsedBodyCanonical = getCanonicalBodyString(req.body);
  const bodyCandidates = Array.from(new Set([
    rawBodyCanonical,
    parsedBodyCanonical,
    '',
    '{}'
  ]));

  let signatureValid = false;

  let clientBuf;
  try {
    clientBuf = Buffer.from(clientSignature, 'hex');
  } catch {
    return res.status(403).json({
      success: false,
      error: 'Security verification failed: malformed action signature.',
      actionBlocked: true
    });
  }

  for (const cleanPath of uniquePaths) {
    for (const bodyStr of bodyCandidates) {
      // Candidate messages (with userId and without userId to be resilient against client-state race conditions)
      const candidateMessages = [
        `${userId}:${method}:${cleanPath}:${bodyStr}:${timestamp}:${nonce}`,
        `${method}:${cleanPath}:${bodyStr}:${timestamp}:${nonce}`
      ];

      for (const msg of candidateMessages) {
        const expected = computeHmac(ACTION_SIGNING_SECRET, msg);
        try {
          const expectedBuf = Buffer.from(expected, 'hex');
          if (
            clientBuf.length === expectedBuf.length &&
            crypto.timingSafeEqual(clientBuf, expectedBuf)
          ) {
            signatureValid = true;
            break;
          }
        } catch {
          // Continue checking
        }
      }

      if (signatureValid) break;
    }
    if (signatureValid) break;
  }

  if (!signatureValid) {
    console.warn(`[Security] Action signature mismatch for user ${userId} on ${req.originalUrl || req.path}`);
    return res.status(403).json({
      success: false,
      error: 'Security verification failed: invalid action signature.',
      actionBlocked: true
    });
  }

  // Record nonce so it cannot be reused
  usedNonces.set(nonce, timestamp);

  next();
}
