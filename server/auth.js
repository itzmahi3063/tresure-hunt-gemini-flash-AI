import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_ID = process.env.ADMIN_ID ? String(process.env.ADMIN_ID) : '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// initData older than this is refused, even if the signature is valid, so a
// captured/leaked initData string can't be replayed forever (Telegram's own
// recommendation). 24 hours is generous for how long a Mini App session
// realistically stays open.
const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;

const hasRealBotToken = () => !!BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE';

/**
 * Validates Telegram Mini App initData according to Telegram's security spec:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 *
 * Returns the parsed Telegram user object ONLY if the HMAC signature (and
 * freshness) checks out. Never trusts unsigned data — that is handled
 * separately, and only outside production, by the caller.
 */
export function validateTelegramInitData(initData) {
  if (!initData || !hasRealBotToken()) return null;

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return null;

    urlParams.delete('hash');

    const dataCheckArr = [];
    urlParams.sort();
    for (const [key, value] of urlParams.entries()) {
      dataCheckArr.push(`${key}=${value}`);
    }
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Constant-time compare — a plain `!==` on hex strings leaks timing
    // information an attacker could use to guess the hash byte-by-byte.
    const hashBuf = Buffer.from(hash, 'hex');
    const calcBuf = Buffer.from(calculatedHash, 'hex');
    if (hashBuf.length !== calcBuf.length || !crypto.timingSafeEqual(hashBuf, calcBuf)) {
      console.warn('Tampered Telegram initData detected (signature mismatch)!');
      return null;
    }

    const authDate = Number(urlParams.get('auth_date') || 0);
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (!authDate || ageSeconds > MAX_INIT_DATA_AGE_SECONDS || ageSeconds < -60) {
      console.warn('Rejected stale/replayed Telegram initData (age:', ageSeconds, 'seconds)');
      return null;
    }

    const userParam = urlParams.get('user');
    return userParam ? JSON.parse(userParam) : null;
  } catch (err) {
    console.error('Error validating Telegram initData:', err);
    return null;
  }
}

// Dev-only convenience: when there is no real BOT_TOKEN configured yet
// (local preview), read the `user` field out of initData WITHOUT verifying
// its signature. This must never run in production — enforced by the caller.
function parseUnsignedUserForDevOnly(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const userParam = urlParams.get('user');
    return userParam ? JSON.parse(userParam) : null;
  } catch {
    return null;
  }
}

/**
 * Express Authentication Middleware.
 *
 * Security model:
 *  - In production, the ONLY way to authenticate is a fresh, correctly
 *    signed Telegram initData string. No test headers, no unsigned data,
 *    no "default user" fallback — a request with anything else is 401'd.
 *  - Outside production (local dev / preview), `x-test-user-id` and
 *    unsigned initData are still accepted for convenience.
 *  - There is no hardcoded fallback identity anymore. Previously any
 *    request with no headers at all silently became a hardcoded admin
 *    account — that is what let anyone with curl/devtools open the admin
 *    panel or mint unlimited accounts. Now: no valid identity => 401.
 */
export function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'] || req.headers['authorization'];
  const testUserId = req.headers['x-test-user-id'];
  const allowDevAuth = !IS_PRODUCTION;

  let telegramUser = null;

  if (initData) {
    if (hasRealBotToken()) {
      // Production (or dev with a real token configured): signature is
      // mandatory. A present-but-invalid initData is a red flag, not a
      // reason to fall through to a weaker check.
      telegramUser = validateTelegramInitData(initData);
    } else if (allowDevAuth) {
      telegramUser = parseUnsignedUserForDevOnly(initData);
    }
  }

  if (!telegramUser && allowDevAuth && testUserId) {
    telegramUser = {
      id: Number(testUserId),
      first_name: req.headers['x-test-first-name'] || 'Hunter',
      username: req.headers['x-test-username'] || 'hunter_user'
    };
  }

  if (!telegramUser || !telegramUser.id) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: a valid Telegram session is required.'
    });
  }

  req.user = telegramUser;
  req.isAdmin = !!ADMIN_ID && String(telegramUser.id) === ADMIN_ID;
  next();
}

/**
 * Strict Admin Middleware
 */
export function adminMiddleware(req, res, next) {
  if (!req.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Only Authorized Administrators can perform this action'
    });
  }
  next();
}
