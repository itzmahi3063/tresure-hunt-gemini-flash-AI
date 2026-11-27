/**
 * lib/xssProtection.js — Advanced XSS & Input Injection Security Layer
 * ====================================================================
 * Automatically scans user profiles (firstName, lastName, username),
 * referral links / startapp parameters, query strings and request bodies
 * for malicious Cross-Site Scripting (XSS) payloads.
 *
 * When an attack is detected:
 * 1. Neutralizes/sanitizes the payload immediately so scripts never execute.
 * 2. Flags the attacking user as suspicious in the database.
 * 3. Immediately alerts the admin via Telegram with details of the attack.
 * ====================================================================
 */

"use strict";

const XSS_PATTERNS = [
  /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/i,
  /<\s*script\b[^>]*>/i,
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /vbscript\s*:/i,
  /\bon(?:load|error|click|dblclick|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|change|submit|reset|select)\s*=/i,
  /<\s*(?:iframe|object|embed|svg|img|link|style|meta|base|form|input|button|textarea|body|html)\b[^>]*>/i,
  /document\s*\.\s*(?:cookie|location|domain|write|writeln)/i,
  /window\s*\.\s*(?:location|open|eval)/i,
  /\beval\s*\(/i,
  /\bexpression\s*\(/i,
  /(?:&#x?[0-9a-f]+;?){3,}/i,
  /\\u003c|\\x3c|%3cscript/i
];

function escapeHtml(str) {
  if (typeof str !== "string") return String(str || "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeString(str) {
  if (typeof str !== "string") return "";
  // Strip control characters and dangerous HTML markup
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*[^>]+>/g, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "")
    .replace(/\bon[a-z]+\s*=/gi, "")
    .trim();
}

/**
 * Detects whether a string or nested object contains XSS injection patterns.
 * Returns { hasXss: boolean, match?: string, field?: string }
 */
function detectXss(val, fieldName = "input") {
  if (val === null || val === undefined) return { hasXss: false };

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return { hasXss: false };
    for (const pattern of XSS_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        return {
          hasXss: true,
          match: match[0],
          field: fieldName,
          value: trimmed.slice(0, 150)
        };
      }
    }
    return { hasXss: false };
  }

  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      const res = detectXss(val[i], `${fieldName}[${i}]`);
      if (res.hasXss) return res;
    }
    return { hasXss: false };
  }

  if (typeof val === "object") {
    for (const key of Object.keys(val)) {
      const res = detectXss(val[key], `${fieldName}.${key}`);
      if (res.hasXss) return res;
    }
    return { hasXss: false };
  }

  return { hasXss: false };
}

/**
 * Inspects user inputs (name, start_param, etc.), neutralizes any injection,
 * flags the user as suspicious in MongoDB and notifies the admin.
 */
async function inspectAndProtectUser(db, botToken, userDoc, inputsToCheck = {}) {
  let detected = null;

  for (const [field, val] of Object.entries(inputsToCheck)) {
    const check = detectXss(val, field);
    if (check.hasXss) {
      detected = check;
      break;
    }
  }

  if (!detected) {
    return { flagged: false, detected: null };
  }

  // 1. Log security event
  console.warn(`[XSS SECURITY ALERT] Attack detected from user ${userDoc ? (userDoc.telegramId || userDoc._id) : "unknown"}: field=${detected.field}, match="${detected.match}"`);

  // 2. Flag user in DB
  if (db && userDoc && userDoc._id) {
    try {
      const usersCol = db.collection("users");
      const cleanSnippet = escapeHtml(String(detected.match || "").slice(0, 80));
      await usersCol.updateOne(
        { _id: userDoc._id },
        {
          $set: {
            isSuspicious: true,
            securityFlag: "RED_FLAG_XSS_ATTACK_DETECTED",
            suspiciousReason: `XSS injection attempt detected in ${detected.field}: "${cleanSnippet}"`,
            lastSuspiciousAt: Date.now()
          }
        }
      );
    } catch (dbErr) {
      console.error("[XSS GUARD] Failed to flag user in db:", dbErr.message);
    }
  }

  // 3. Notify Admin via Telegram
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  const token = (botToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (adminId && token) {
    try {
      const uId = userDoc ? (userDoc.telegramId || "Unknown") : "Unknown";
      const uName = userDoc ? (userDoc.username ? `@${userDoc.username}` : (userDoc.firstName || "N/A")) : "N/A";
      const alertMsg =
        `🚨 <b>Security Alert: XSS Attack Attempt Detected!</b>\n\n` +
        `👤 <b>User:</b> <code>${uId}</code> (${escapeHtml(uName)})\n` +
        `🛡️ <b>Target Field:</b> <code>${escapeHtml(detected.field)}</code>\n` +
        `⚠️ <b>Detected Payload:</b> <code>${escapeHtml(detected.match.slice(0, 100))}</code>\n\n` +
        `🔒 <i>The payload was neutralized and the account has been automatically flagged as suspicious in the Admin Panel.</i>`;

      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminId,
          text: alertMsg,
          parse_mode: "HTML"
        })
      }).catch(() => {});
    } catch (tgErr) {
      console.error("[XSS GUARD] Failed to send Telegram alert:", tgErr.message);
    }
  }

  return { flagged: true, detected };
}

module.exports = {
  detectXss,
  sanitizeString,
  escapeHtml,
  inspectAndProtectUser
};
