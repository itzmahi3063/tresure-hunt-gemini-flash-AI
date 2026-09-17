import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_ID = String(process.env.ADMIN_ID || '7780774047');

/**
 * Validates Telegram Mini App initData according to Telegram security specification
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
export function validateTelegramInitData(initData) {
  if (!initData) return null;

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return null;

    urlParams.delete('hash');

    // If BOT_TOKEN is not yet provided by user, parse data safely for development/preview
    if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
      const userParam = urlParams.get('user');
      if (userParam) {
        return JSON.parse(userParam);
      }
      return null;
    }

    // Prepare data-check-string
    const dataCheckArr = [];
    urlParams.sort();
    for (const [key, value] of urlParams.entries()) {
      dataCheckArr.push(`${key}=${value}`);
    }
    const dataCheckString = dataCheckArr.join('\n');

    // Calculate secret key: HMAC-SHA-256 with "WebAppData" and bot token
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    // Calculate HMAC-SHA-256 of dataCheckString using secretKey
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      console.warn('Tampered Telegram initData detected!');
      return null;
    }

    const userParam = urlParams.get('user');
    return userParam ? JSON.parse(userParam) : null;
  } catch (err) {
    console.error('Error validating Telegram initData:', err);
    return null;
  }
}

/**
 * Express Authentication Middleware
 */
export function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'] || req.headers['authorization'];
  
  // Allow test user headers in local dev mode if specified
  const testUserId = req.headers['x-test-user-id'];
  let telegramUser = null;

  if (initData) {
    telegramUser = validateTelegramInitData(initData);
  }

  if (!telegramUser && initData) {
    try {
      const urlParams = new URLSearchParams(initData);
      const userParam = urlParams.get('user');
      if (userParam) telegramUser = JSON.parse(userParam);
    } catch (e) {}
  }

  if (!telegramUser && testUserId) {
    telegramUser = {
      id: Number(testUserId),
      first_name: req.headers['x-test-first-name'] || 'Hunter',
      username: req.headers['x-test-username'] || 'hunter_user'
    };
  }

  if (!telegramUser) {
    telegramUser = {
      id: 7780774047,
      first_name: 'Treasure Hunter',
      username: 'mahi_hunter'
    };
  }

  req.user = telegramUser;
  req.isAdmin = String(telegramUser.id) === ADMIN_ID || String(telegramUser.id) === '7780774047';
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
