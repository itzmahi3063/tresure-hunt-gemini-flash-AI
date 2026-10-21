const { getDb } = require("../lib/mongodb");
const { validateInitData } = require("../lib/telegramAuth");
const { findOrCreateUser } = require("../lib/userHelper");
const { mineIsReady, MINE_REWARD, getMultiplierForLevel, getMax24hMiningForLevel } = require("../lib/gameLogic");
const { verifyActionToken, createActionToken } = require("../lib/actionSigner");
const { checkVelocityLimit } = require("../lib/velocityLimiter");
const { checkDailyRequestQuota } = require("../lib/dailyQuotaLimiter");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    res.status(500).json({ error: "TELEGRAM_BOT_TOKEN is not set in Vercel settings" });
    return;
  }

  const initData = req.headers["x-telegram-init-data"];
  const tgUser = validateInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
  if (!tgUser) {
    res.status(401).json({ error: "Invalid session - reopen app from Telegram" });
    return;
  }
  const telegramId = String(tgUser.id);

  // Velocity Check: Max 6 mine collections per minute per user/IP
  if (!checkVelocityLimit(req, res, { endpoint: "collect", max: 6, windowMs: 60000, uid: telegramId })) {
    return;
  }

  try {
    const db = await getDb();
    const users = db.collection("users");

    if (!(await checkDailyRequestQuota(users, telegramId, res))) {
      return;
    }
    let user = await findOrCreateUser(users, tgUser);

    if (user && user.isBanned) {
      res.status(403).json({ error: "Your account has been suspended" });
      return;
    }

    // Cryptographic Action Signing Verification
    const actionToken = (req.body && req.body.actionToken) || req.headers["x-action-token"] || req.headers["x-action-signature"] || req.headers["x-action-secret"];
    if (!verifyActionToken(telegramId, "mine", actionToken)) {
      res.status(403).json({ error: "Security check failed: Invalid or missing action signature token." });
      return;
    }

    if (!mineIsReady(user.lastMineCollectedAt)) {
      res.status(400).json({ error: "Not ready yet", mineReady: false });
      return;
    }

    const { captchaToken } = req.body || {};
    if (!captchaToken) {
      res.status(400).json({ error: "Puzzle verification required! Please complete the captcha to start mining." });
      return;
    }

    const tokensCol = db.collection("captcha_tokens");
    const uid = String(tgUser.id);

    // Atomically burn single-use captcha token (impossible for concurrent requests to both succeed)
    const burnTokenRes = await tokensCol.updateOne(
      {
        token: String(captchaToken),
        userId: { $in: [uid, Number(uid), tgUser.id] },
        used: false
      },
      { $set: { used: true, usedAt: Date.now() } }
    );

    if (!burnTokenRes || burnTokenRes.modifiedCount === 0) {
      res.status(400).json({ error: "Invalid, expired, or already used verification token. Please verify again." });
      return;
    }

    const minerLevel = Math.max(1, Math.min(10, user.minerLevel || 1));
    const multiplier = getMultiplierForLevel(minerLevel);
    const reward = Math.round(MINE_REWARD * multiplier);

    const now = Date.now();
    const mineIntervalMs = 2 * 60 * 60 * 1000;
    const cutoffTime = now - mineIntervalMs;

    // 24-Hour Mining Cap Anti-Cheat Enforcement per Miner Level:
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    let dailyCycleStart = user.dailyMineCycleStartedAt ? Number(user.dailyMineCycleStartedAt) : 0;
    let dailyClaims = Number(user.dailyMinedClaims || 0);
    let dailyCoins = Number(user.dailyMinedCoins || 0);

    if (!dailyCycleStart || (now - dailyCycleStart >= TWENTY_FOUR_HOURS)) {
      dailyCycleStart = now;
      dailyClaims = 0;
      dailyCoins = 0;
    }

    const { maxClaims, maxCoins } = getMax24hMiningForLevel(minerLevel);

    if (dailyClaims >= maxClaims || (dailyCoins + reward) > (maxCoins + 5)) {
      const updateFlag = {
        isSuspicious: true,
        securityFlag: "RED_FLAG_EXCESSIVE_24H_MINING",
        suspiciousReason: `Exceeded 24h mining cap for Level ${minerLevel}: Attempted ${dailyClaims + 1} claims / ${dailyCoins + reward} coins in 24h (Max allowed: ${maxClaims} claims, ${maxCoins} coins). Timer bypass exploit.`,
        lastSuspiciousAt: now
      };
      await users.updateOne({ _id: user._id }, { $set: updateFlag });
      res.status(403).json({
        error: `🚨 Security Warning: 24-hour mining cap reached for Level ${minerLevel}! Maximum ${maxClaims} claims (${maxCoins} coins) allowed per 24 hours. Your account has been flagged as suspicious.`,
        isSuspicious: true
      });
      return;
    }

    // ATOMIC CONDITIONAL CLAIM:
    // Mathematically impossible for concurrent requests or double clicks to claim twice
    const collectRes = await users.updateOne(
      {
        _id: user._id,
        $or: [
          { lastMineCollectedAt: { $exists: false } },
          { lastMineCollectedAt: null },
          { lastMineCollectedAt: { $lte: cutoffTime } }
        ]
      },
      {
        $inc: {
          balance: reward,
          totalMinedCoins: reward,
          totalMinedClaims: 1
        },
        $set: {
          // $set (not $inc) so that when a new 24h cycle starts the counters truly restart from this claim
          dailyMinedClaims: dailyClaims + 1,
          dailyMinedCoins: dailyCoins + reward,
          dailyMineCycleStartedAt: dailyCycleStart,
          lastMineCollectedAt: now,
          mineReminderSent: false,
          lastActiveAt: new Date()
        }
      }
    );

    if (!collectRes || collectRes.modifiedCount === 0) {
      res.status(400).json({ error: "Mining is already active or was just collected! Please wait until 2 hours are up.", mineReady: false });
      return;
    }

    const updatedUser = await users.findOne({ _id: user._id });
    const newBalance = Number(updatedUser ? updatedUser.balance : ((Number(user.balance) || 0) + reward));

    res.status(200).json({
      balance: newBalance,
      lastMineCollectedAt: now,
      reward: reward,
      multiplier: multiplier,
      minerLevel: minerLevel,
      level: minerLevel,
      newActionToken: createActionToken(telegramId, "mine")
    });
  } catch (err) {
    console.error("collect.js error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
};
