/**
 * Daily 24-Hour User Request Quota Limiter
 * Enforces a maximum requests per 24 hours per individual user.
 * Generous default (2,500 requests/day) ensures legitimate human players
 * never get blocked, while still preventing runaway bot attacks.
 */

const DEFAULT_DAILY_LIMIT = 2500;
let cachedDbLimit = null;
let lastDbLimitFetch = 0;
const DB_LIMIT_CACHE_TTL = 30 * 1000; // 30s cache to avoid extra DB query per request

async function getDailyLimit(usersCol) {
  // 1. Env variable takes precedence if explicitly set
  if (process.env.DAILY_REQUEST_LIMIT) {
    const envLim = parseInt(process.env.DAILY_REQUEST_LIMIT, 10);
    if (!isNaN(envLim) && envLim > 0) return envLim;
  }

  // 2. Check cached setting from DB
  const now = Date.now();
  if (cachedDbLimit !== null && (now - lastDbLimitFetch < DB_LIMIT_CACHE_TTL)) {
    return cachedDbLimit;
  }

  try {
    const db = usersCol?.client?.db(usersCol.dbName);
    if (db) {
      const s = await db.collection("settings").findOne({ key: "app_settings" });
      if (s && typeof s.dailyRequestLimit === "number" && s.dailyRequestLimit > 0) {
        cachedDbLimit = s.dailyRequestLimit;
        lastDbLimitFetch = now;
        return cachedDbLimit;
      }
    }
  } catch (e) {
    // Silently continue to fallback
  }

  cachedDbLimit = DEFAULT_DAILY_LIMIT;
  lastDbLimitFetch = now;
  return DEFAULT_DAILY_LIMIT;
}

async function checkDailyRequestQuota(usersCol, telegramId, res) {
  if (!usersCol || !telegramId) return true;
  const tid = String(telegramId);
  const numId = Number(telegramId);
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  try {
    const maxLimit = await getDailyLimit(usersCol);

    const user = await usersCol.findOne({
      $or: [{ telegramId: tid }, ...(numId ? [{ telegramId: numId }] : [])]
    });

    if (!user) return true;

    // Support custom per-user limit or whitelist (e.g. VIP or QA user)
    const effectiveLimit = (typeof user.customDailyLimit === "number" && user.customDailyLimit > 0)
      ? user.customDailyLimit
      : maxLimit;

    const cycleStart = Number(user.dailyReqCycleStart || 0);
    const currentCount = Number(user.dailyReqCount || 0);

    // If 24 hours have passed since the cycle started, reset cycle to 1
    if (!cycleStart || (now - cycleStart) >= ONE_DAY_MS) {
      await usersCol.updateOne(
        { _id: user._id },
        { $set: { dailyReqCycleStart: now, dailyReqCount: 1 } }
      );
      return true;
    }

    // If already reached limit in current 24-hour cycle
    if (currentCount >= effectiveLimit) {
      const msLeft = (cycleStart + ONE_DAY_MS) - now;
      const hoursLeft = Math.max(1, Math.ceil(msLeft / (60 * 60 * 1000)));
      if (res) {
        res.setHeader("Retry-After", String(Math.ceil(msLeft / 1000)));
        res.status(429).json({
          error: `⚠️ 24-Hour Request Limit Reached: You have reached the maximum ${effectiveLimit.toLocaleString()} requests allowed in 24 hours. Please wait ~${hoursLeft} hour(s) for your daily quota to reset.`,
          dailyLimitExceeded: true,
          resetInHours: hoursLeft
        });
      }
      return false;
    }

    // Otherwise increment request count
    await usersCol.updateOne(
      { _id: user._id },
      { $inc: { dailyReqCount: 1 } }
    );

    return true;
  } catch (err) {
    console.error("checkDailyRequestQuota error:", err);
    return true; // Fail-open on transient database glitch so legitimate players are not blocked
  }
}

module.exports = {
  checkDailyRequestQuota,
  DEFAULT_DAILY_LIMIT
};
