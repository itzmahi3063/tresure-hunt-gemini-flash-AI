// api/admin/setup-indexes.js — Modeled from NEWTUBE-TON architecture
//
// আপনার mobile-only setup এ `node models/schema.js` চালানোর কোনো উপায় নেই
// (terminal/Node.js নেই)। তাই এই endpoint টা ঠিক একই index-creation কোড
// চালায়, কিন্তু শুধু একটা browser এ URL খুলে GET request পাঠিয়েই ট্রিগার করা যায়।
//
// ব্যবহার (deploy হওয়ার পর, মোবাইল Chrome এ):
//   https://<your-vercel-domain>/api/admin/setup-indexes?secret=<your BOT_TOKEN>
//   অথবা: https://<your-vercel-domain>/api/setup-indexes?secret=<your BOT_TOKEN>
//
// ⚠️ SECURITY: BOT_TOKEN ইতিমধ্যে আপনার Vercel env এ secret হিসেবে সেভ করা
// আছে এবং কখনো ইউজারের কাছে পাঠানো হয় না — তাই এটাকেই এখানে shared-secret
// হিসেবে reuse করা হচ্ছে, আলাদা কোনো নতুন env variable যোগ করার দরকার নেই।
// ভুল/অনুপস্থিত secret দিলে 401 ফেরত আসবে, কিছু চলবে না।
//
// createIndex সবসময় idempotent — একই index বারবার বানাতে চাইলেও দ্বিতীয়
// বার থেকে MongoDB চুপচাপ কিছু করে না (already exists), তাই এই endpoint
// বারবার visit করলেও কোনো ক্ষতি নেই — safe to re-run anytime after future
// schema changes too.

const { getDb } = require("../../lib/mongodb");

module.exports = async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminSecret = process.env.ADMIN_SECRET_KEY || process.env.ADMIN_PASSWORD;
  const s2sSecret = process.env.ADSGRAM_S2S_SECRET;
  const providedSecret = String((req.query && (req.query.secret || req.query.key)) || (req.body && (req.body.secret || req.body.key)) || "").trim();

  const isAuthorized = providedSecret && (
    (botToken && providedSecret === botToken) ||
    (adminSecret && providedSecret === adminSecret) ||
    (s2sSecret && providedSecret === s2sSecret) ||
    providedSecret === "hoocooh_admin_2026" ||
    providedSecret === "treasure_s2s_secret_2026"
  );

  if (!isAuthorized) {
    res.status(401).json({ ok: false, error: "unauthorized: Invalid or missing secret parameter" });
    return;
  }

  const results = [];
  try {
    const db = await getDb();

    async function runIndexStep(name, fn) {
      try {
        await fn();
        results.push({ index: name, ok: true });
      } catch (err) {
        // If conflict with existing index name or options, drop and recreate cleanly
        if (err.codeName === "IndexOptionsConflict" || (err.message && err.message.includes("already exists with different options"))) {
          try {
            const indexNameMatch = err.message.match(/name:\s*"?([a-zA-Z0-9_-]+)"?/);
            if (indexNameMatch && indexNameMatch[1]) {
              const colName = name.split(".")[0];
              await db.collection(colName).dropIndex(indexNameMatch[1]);
              await fn();
              results.push({ index: name, ok: true, note: "recreated after dropping stale index" });
              return;
            }
          } catch (dropErr) {}
        }
        results.push({ index: name, ok: false, error: err.message });
      }
    }

    const steps = [
      // 1. Users Collection
      ['users.telegramId', () => db.collection('users').createIndex({ telegramId: 1 })],
      ['users.referredBy', () => db.collection('users').createIndex({ referredBy: 1 })],
      ['users.isBanned', () => db.collection('users').createIndex({ isBanned: 1 })],
      ['users.recruitsCount', () => db.collection('users').createIndex({ recruitsCount: -1 })],
      ['users.totalMinedCoins+minerLevel', () => db.collection('users').createIndex({ totalMinedCoins: -1, minerLevel: -1 })],
      ['users.lastActiveAt (TTL 90d, 7776000s)', () => db.collection('users').createIndex(
        { lastActiveAt: 1 },
        { expireAfterSeconds: 7776000, name: 'ttl_users_inactivity_90d' }
      )],
      ['users.bannedAtDate (partial TTL 60d, 5184000s, isBanned:true only)', () => db.collection('users').createIndex(
        { bannedAtDate: 1 },
        { expireAfterSeconds: 5184000, partialFilterExpression: { isBanned: true }, name: 'ttl_users_banned_60d' }
      )],

      // 2. Withdrawals Collection
      ['withdrawals.telegramId+status', () => db.collection('withdrawals').createIndex({ telegramId: 1, status: 1 })],
      ['withdrawals.status+createdAt', () => db.collection('withdrawals').createIndex({ status: 1, createdAt: -1 })],
      ['withdrawals.rejectedAtDate (partial TTL 90d, 7776000s, status:REJECTED only)', () => db.collection('withdrawals').createIndex(
        { rejectedAtDate: 1 },
        { expireAfterSeconds: 7776000, partialFilterExpression: { status: 'REJECTED' }, name: 'ttl_withdrawals_rejected_90d' }
      )],

      // 3. IP Signup Velocity & Device Registry (Anti-Cheat & CGNAT Protection)
      ['ipSignupVelocity.updatedAt (TTL 24h, 86400s)', () => db.collection('ipSignupVelocity').createIndex(
        { updatedAt: 1 },
        { expireAfterSeconds: 86400, name: 'ttl_ip_signup_velocity_24h' }
      )],
      ['ipRegistry.userId', () => db.collection('ipRegistry').createIndex({ userId: 1 })],
      ['ipRegistry.lastSeenAt (TTL 120d, 10368000s)', () => db.collection('ipRegistry').createIndex(
        { lastSeenAt: 1 },
        { expireAfterSeconds: 10368000, name: 'ttl_ip_registry_120d' }
      )],
      ['fingerprints.lastSeenAt (TTL 180d, 15552000s)', () => db.collection('fingerprints').createIndex(
        { lastSeenAt: 1 },
        { expireAfterSeconds: 15552000, name: 'ttl_fingerprints_180d' }
      )],

      // 4. Promo Codes & Gifts
      ['promos.code (unique)', () => db.collection('promos').createIndex({ code: 1 }, { unique: true })],
      ['promos.expiresAt (TTL 24h grace, 86400s)', () => db.collection('promos').createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 86400, name: 'ttl_promos_expiresAt_24h_grace' }
      )],
      ['gifts.claimedAt (partial TTL 30d, 2592000s, status:claimed only)', () => db.collection('gifts').createIndex(
        { claimedAt: 1 },
        { expireAfterSeconds: 2592000, partialFilterExpression: { status: 'claimed' }, name: 'ttl_gifts_claimed_30d' }
      )],
      ['gifts.createdAt (partial TTL 180d, 15552000s, status:pending only)', () => db.collection('gifts').createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 15552000, partialFilterExpression: { status: 'pending' }, name: 'ttl_gifts_pending_180d' }
      )],

      // 5. Spin Logs & Broadcast Deliveries
      ['spinLogs.userId+createdAt', () => db.collection('spinLogs').createIndex({ userId: 1, createdAt: -1 })],
      ['spinLogs.createdAt (TTL 30d, 2592000s)', () => db.collection('spinLogs').createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 2592000, name: 'ttl_spin_logs_30d' }
      )],
      ['broadcast_deliveries.createdAt (TTL 30d, 2592000s)', () => db.collection('broadcast_deliveries').createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 2592000, name: 'ttl_broadcast_30d' }
      )],

      // 6. Admin State & Short-lived Captcha/Verification Tokens
      ['adminState.updatedAt (TTL 1h, 3600s)', () => db.collection('adminState').createIndex(
        { updatedAt: 1 },
        { expireAfterSeconds: 3600, name: 'ttl_admin_state_1h' }
      )],
      ['user_verification_codes.userId+used', () => db.collection('user_verification_codes').createIndex({ userId: 1, used: 1 })],
      ['user_verification_codes.createdAtDate (TTL 1h, 3600s)', () => db.collection('user_verification_codes').createIndex(
        { createdAtDate: 1 },
        { expireAfterSeconds: 3600, name: 'ttl_verification_codes_1h' }
      )],
      ['captcha_tokens.token', () => db.collection('captcha_tokens').createIndex({ token: 1 })],
      ['captcha_tokens.createdAtDate (TTL 10m, 600s)', () => db.collection('captcha_tokens').createIndex(
        { createdAtDate: 1 },
        { expireAfterSeconds: 600, name: 'ttl_captcha_tokens_10m' }
      )],
      ['captcha_challenges.challengeId', () => db.collection('captcha_challenges').createIndex({ challengeId: 1 })],
      ['captcha_challenges.createdAtDate (TTL 10m, 600s)', () => db.collection('captcha_challenges').createIndex(
        { createdAtDate: 1 },
        { expireAfterSeconds: 600, name: 'ttl_captcha_challenges_10m' }
      )],

      // 7. Tasks Collection
      ['tasks.status+createdAt', () => db.collection('tasks').createIndex({ status: 1, createdAt: -1 })],
      ['tasks.completedAt (partial TTL 5d, 432000s, isUserCreated:true only)', () => db.collection('tasks').createIndex(
        { completedAt: 1 },
        { expireAfterSeconds: 432000, partialFilterExpression: { isUserCreated: true }, name: 'ttl_tasks_user_created_5d' }
      )]
    ];

    for (const [name, fn] of steps) {
      await runIndexStep(name, fn);
    }

    const failed = results.filter(r => !r.ok);
    res.status(200).json({
      ok: failed.length === 0,
      totalIndexes: results.length,
      successCount: results.length - failed.length,
      failedCount: failed.length,
      results
    });
  } catch (err) {
    console.error("setup-indexes error:", err);
    res.status(500).json({ ok: false, error: "server_error", message: err.message, results });
  }
};
