/**
 * Action Signer (Client-side)
 * Generates cryptographic HMAC-SHA256 signatures for sensitive reward & task actions.
 * Protects against Termux, curl, postman, and automation scripts.
 */

export const ACTION_SIGNING_SECRET =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ACTION_SIGNING_SECRET) ||
  'th_act_sec_99x_treasure_hunt_2026_salt_z9q';

// Endpoints that require cryptographic action signatures
const SENSITIVE_ACTION_PATHS = [
  '/tasks/complete',
  '/ads/watch',
  '/chest/open',
  '/daily-rewards/claim',
  '/game/tictactoe/finish',
  '/game/luckydraw/play',
  '/promo/redeem',
  '/gift/claim',
  '/tasks/exclusive/pay',
  '/wallet/convert',
  '/wallet/withdraw',
  '/store/buy-crystal'
];

export function normalizeActionPath(url) {
  if (!url) return '';
  const pathOnly = url.split('?')[0];
  return '/' + pathOnly.replace(/^(\/api\/|\/)/, '');
}

export function isActionEndpoint(url) {
  if (!url) return false;
  const clean = normalizeActionPath(url);
  return SENSITIVE_ACTION_PATHS.some((p) => clean.startsWith(p));
}

/**
 * Pure JS SHA-256 implementation (Fallback)
 */
function pureSha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var lengthProperty = 'length';
  var i, j;
  var result = '';
  var words = [];
  var asciiBitLength = ascii[lengthProperty] * 8;
  var hash = (pureSha256.h = pureSha256.h || []);
  var k = (pureSha256.k = pureSha256.k || []);
  var primeCounter = k[lengthProperty];
  var isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty]; ) {
    var w = words.slice(j, (j += 16));
    var oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var i2 = i + j;
      var w15 = w[i - 15],
        w2 = w[i - 2];
      var a = hash[0],
        e = hash[4];
      var temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      var temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Pure JS HMAC-SHA256 (Fallback)
 */
function pureHmacSha256(key, message) {
  var blockSize = 64;
  if (key.length > blockSize) {
    var hex = pureSha256(key);
    key = '';
    for (var i = 0; i < hex.length; i += 2) {
      key += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
  }
  while (key.length < blockSize) key += '\x00';
  var oKeyPad = '',
    iKeyPad = '';
  for (var i = 0; i < blockSize; i++) {
    oKeyPad += String.fromCharCode(key.charCodeAt(i) ^ 0x5c);
    iKeyPad += String.fromCharCode(key.charCodeAt(i) ^ 0x36);
  }
  var innerHashHex = pureSha256(iKeyPad + message);
  var innerHashStr = '';
  for (var i = 0; i < innerHashHex.length; i += 2) {
    innerHashStr += String.fromCharCode(parseInt(innerHashHex.substr(i, 2), 16));
  }
  return pureSha256(oKeyPad + innerHashStr);
}

/**
 * Generate HMAC-SHA256 hex string using Web Crypto API or pure JS fallback
 */
export async function computeHmacSha256(keyStr, messageStr) {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const enc = new TextEncoder();
      const key = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(keyStr),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await window.crypto.subtle.sign('HMAC', key, enc.encode(messageStr));
      return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (err) {
    // Fall back to pure JS
  }

  return pureHmacSha256(keyStr, messageStr);
}

/**
 * Attaches cryptographic timestamp, nonce, and HMAC-SHA256 signature to Axios request config
 */
export async function signActionRequest(config, userId) {
  try {
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const method = (config.method || 'POST').toUpperCase();
    const cleanPath = normalizeActionPath(config.url);

    let bodyStr = '';
    if (config.data !== undefined && config.data !== null) {
      if (typeof config.data === 'string') {
        bodyStr = config.data;
      } else {
        bodyStr = JSON.stringify(config.data);
        config.data = bodyStr;
        config.headers = config.headers || {};
        config.headers['Content-Type'] = 'application/json';
      }
    }

    const message = `${userId}:${method}:${cleanPath}:${bodyStr}:${timestamp}:${nonce}`;
    const signature = await computeHmacSha256(ACTION_SIGNING_SECRET, message);

    config.headers = config.headers || {};
    config.headers['x-action-timestamp'] = String(timestamp);
    config.headers['x-action-nonce'] = nonce;
    config.headers['x-action-signature'] = signature;
  } catch (err) {
    console.error('Failed to sign action request:', err);
  }
}
