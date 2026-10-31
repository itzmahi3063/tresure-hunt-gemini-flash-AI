const { getDb } = require("../lib/mongodb");
const { validateInitData } = require("../lib/telegramAuth");
const { findOrCreateUser, purgeExcessUserWithdrawals } = require("../lib/userHelper");
const { MAX_USER_WITHDRAWAL_HISTORY } = require("../lib/constants");
const { getMax24hMiningForLevel } = require("../lib/gameLogic");
const crypto = require("crypto");
const { checkVelocityLimit } = require("../lib/velocityLimiter");
const { checkDailyRequestQuota } = require("../lib/dailyQuotaLimiter");
const { Address } = require("@ton/ton");

// Base rate fallback: 1 TREASURE Coin = $0.00003 USD
const COIN_RATE = 0.00003;

async function detectRhythmicWithdrawalCluster(withdrawalsCol, usersCol, newTxId, newCreatedAt, currentTelegramId) {
  try {
    const recent = await withdrawalsCol.find({}).sort({ createdAt: -1 }).limit(25).toArray();
    if (recent.length < 10) return false;

    let streakCount = 0;
    const clusterIds = [];
    const clusterUids = [];

    for (let i = 0; i < recent.length - 1; i++) {
      const diffMs = Number(recent[i].createdAt) - Number(recent[i + 1].createdAt);
      // Rhythmic bot distance check: 8s to 25s distance (e.g. 10s, 13s, 20s)
      if (diffMs >= 8000 && diffMs <= 25000) {
        streakCount++;
        clusterIds.push(recent[i]._id, recent[i + 1]._id);
        clusterUids.push(String(recent[i].telegramId), String(recent[i + 1].telegramId));
      } else {
        if (streakCount >= 9) break; // 9 consecutive intervals = 10 consecutive withdrawals
        streakCount = 0;
        clusterIds.length = 0;
        clusterUids.length = 0;
      }
    }

    if (streakCount >= 9) {
      const uniqueIds = [...new Set(clusterIds)];
      const uniqueUids = [...new Set(clusterUids)];

      await withdrawalsCol.updateMany(
        { _id: { $in: uniqueIds } },
        {
          $set: {
            isSuspicious: true,
            isSuspiciousWithdrawalDistance: true,
            suspiciousReason: "Automated rhythmic cluster withdrawal detected (consecutive 10s-20s interval across 10+ requests)"
          }
        }
      );

      await usersCol.updateMany(
        {
          $or: [
            { telegramId: { $in: uniqueUids } },
            { telegramId: { $in: uniqueUids.map(Number).filter(Boolean) } }
          ]
        },
        {
          $set: {
            isSuspicious: true,
            securityFlag: "FLAG_RHYTHMIC_WITHDRAW_CLUSTER",
            suspiciousReason: "Automated rhythmic cluster withdrawal detected (spaced by 10s-20s distance across 10+ requests)",
            lastSuspiciousAt: Date.now()
          }
        }
      );

      return true;
    }
  } catch (err) {
    console.error("detectRhythmicWithdrawalCluster error:", err);
  }
  return false;
}

async function getCoinRate(db) {
  try {
    const s = await db.collection("settings").findOne({ key: "app_settings" });
    if (s && typeof s.coinPriceUsd === "number" && s.coinPriceUsd > 0) {
      return s.coinPriceUsd;
    }
  } catch (e) {}
  return COIN_RATE;
}

function calculateCoinsUsdt(coins, rate = COIN_RATE) {
  const c = Math.max(0, Number(coins) || 0);
  return c * rate;
}

// Conversion rate: 3 cents ($0.03 USD) = 0.019 TON
// TON per USD = 0.019 / 0.03 = 19 / 30 (~0.63333333 TON per $1 USDT)
const TON_PER_USD = 0.019 / 0.03;

module.exports = async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    res.status(500).json({ error: "TELEGRAM_BOT_TOKEN is not configured" });
    return;
  }

  const initData = req.headers["x-telegram-init-data"];
  const tgUser = validateInitData(initData, botToken);
  if (!tgUser) {
    res.status(401).json({ error: "Invalid session - reopen app from Telegram" });
    return;
  }
  const telegramId = String(tgUser.id);

  // Velocity Check: Max 12 wallet requests per minute per user/IP
  if (!checkVelocityLimit(req, res, { endpoint: "wallet", max: 12, windowMs: 60000, uid: telegramId })) {
    return;
  }

  try {
    const db = await getDb();
    const usersCol = db.collection("users");
    const withdrawalsCol = db.collection("withdrawals");

    if (!(await checkDailyRequestQuota(usersCol, telegramId, res))) {
      return;
    }

    let user = await findOrCreateUser(usersCol, tgUser);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({ error: "Your account has been suspended" });
      return;
    }

    if (user.accountLocked) {
      res.status(403).json({ error: "Your account is temporarily locked for security review. Please contact support." });
      return;
    }

    // 1. GET: Fetch wallet summary and transaction history
    if (req.method === "GET") {
      // Auto-purge any excess withdrawal history older than the 5 latest
      await purgeExcessUserWithdrawals(withdrawalsCol, telegramId);

      const numId = Number(telegramId);
      const txs = await withdrawalsCol
        .find({
          $or: [
            { telegramId: telegramId },
            ...(numId ? [{ telegramId: numId }] : [])
          ]
        })
        .sort({ createdAt: -1 })
        .limit(MAX_USER_WITHDRAWAL_HISTORY || 5)
        .toArray();

      const mappedTxs = txs.map(t => ({
        id: String(t._id),
        amount: t.amount,
        usdtAmount: t.usdtAmount,
        walletAddress: t.walletAddress,
        network: t.network || "USDT",
        status: t.status || "PENDING",
        txHash: t.txHash || "",
        createdAt: t.createdAt
      }));

      // Check and retrieve locked/bound wallet address
      let boundWallet = user.boundWalletAddress || null;
      if (!boundWallet && !user.walletUnlockedOnce) {
        const prevTx = await withdrawalsCol.findOne({ telegramId }, { sort: { createdAt: -1 } });
        if (prevTx && prevTx.walletAddress) {
          boundWallet = prevTx.walletAddress;
          await usersCol.updateOne({ _id: user._id }, { $set: { boundWalletAddress: boundWallet, walletBoundAt: Date.now() } });
          user.boundWalletAddress = boundWallet;
        }
      }

      const activeCoinRate = await getCoinRate(db);
      const recruits = Number(user.recruitsCount || 0);
      const balance = Number(user.balance || 0);
      const usdtEquivalent = Number(calculateCoinsUsdt(balance, activeCoinRate).toFixed(2));

      res.status(200).json({
        ok: true,
        balance,
        usdtEquivalent,
        coinRate: activeCoinRate,
        recruitsCount: recruits,
        totalMined: Math.round(balance + (Number(user.totalDailyEarned) || 0) + (Number(user.refEarnings) || 0)),
        boundWalletAddress: boundWallet,
        walletUnlockedOnce: Boolean(user.walletUnlockedOnce),
        transactions: mappedTxs
      });
      return;
    }

    // 2. POST: Process withdrawal
    if (req.method === "POST") {
      const { action, amount, walletAddress, network } = req.body || {};

      if (action === "withdraw") {
        const { captchaToken } = req.body || {};
        const cleanCaptchaToken = String(captchaToken || "").trim();

        if (!cleanCaptchaToken) {
          res.status(403).json({ error: "Security verification required! Please complete the verification puzzle." });
          return;
        }

        const numAmount = parseInt(amount, 10);
        if (isNaN(numAmount) || numAmount < 1000) {
          res.status(400).json({ error: "Minimum withdrawal amount is 1,000 TREASURE Coins" });
          return;
        }

        const now = Date.now();
        const tokensCol = db.collection("captcha_tokens");

        // Atomically invalidate captcha token to prevent concurrent replay
        const tokenResult = await tokensCol.findOneAndUpdate(
          {
            token: cleanCaptchaToken,
            userId: { $in: [telegramId, Number(telegramId)] },
            used: false,
            createdAt: { $gte: now - 180000 } // Valid for 3 minutes
          },
          {
            $set: { used: true, usedAt: now }
          },
          { returnDocument: "before" }
        );

        const validToken = tokenResult && (tokenResult.value || tokenResult);
        if (!validToken) {
          res.status(403).json({ error: "Security verification invalid, already used, or expired. Please complete verification again." });
          return;
        }

        let cleanAddress = "";

        // Wallet Lock Logic:
        // Once a wallet address is used, it is permanently locked to the account.
        // If an admin unlocked the wallet for 1-time change (walletUnlockedOnce === true),
        // the user is allowed to submit a new TON address. Once submitted, it automatically locks again!
        if (user.boundWalletAddress && !user.walletUnlockedOnce) {
          cleanAddress = user.boundWalletAddress;
          const inputAddr = (walletAddress || "").trim();
          if (inputAddr && inputAddr !== user.boundWalletAddress) {
            res.status(400).json({
              error: `Your account is permanently locked to TON address: ${user.boundWalletAddress}. All withdrawals are sent to this address.`
            });
            return;
          }
        } else {
          // First withdrawal OR 1-time unlocked by admin:
          cleanAddress = (walletAddress || "").trim();
          let isAddressValid = false;
          try {
            Address.parse(cleanAddress);
            isAddressValid = true;
          } catch (_) {
            isAddressValid = false;
          }
          const isTon = /^(UQ|EQ|kQ|0Q)[A-Za-z0-9_-]{46}$/.test(cleanAddress) || /^(-1|0):[0-9a-fA-F]{64}$/.test(cleanAddress);
          if (!isTon || !isAddressValid) {
            res.status(400).json({ error: "Invalid TON address! Please enter a valid TON wallet address (with correct checksum starting with UQ or EQ)." });
            return;
          }

          // Atomically bind new address and re-lock wallet for THIS user ONLY
          await usersCol.updateOne(
            { _id: user._id },
            {
              $set: {
                boundWalletAddress: cleanAddress,
                walletBoundAt: now,
                walletUnlockedOnce: false
              },
              $unset: {
                walletUnlockedAt: ""
              }
            }
          );
          user.boundWalletAddress = cleanAddress;
          user.walletUnlockedOnce = false;
        }

        // Atomically verify balance and deduct Coins in a single atomic operation
        // This prevents race condition double-spending via simultaneous requests
        const deductResult = await usersCol.findOneAndUpdate(
          {
            _id: user._id,
            balance: { $gte: numAmount }
          },
          {
            $inc: { balance: -numAmount },
            $set: { lastActiveAt: new Date() }
          },
          { returnDocument: "after" }
        );

        const updatedUser = deductResult && (deductResult.value || deductResult);
        if (!updatedUser) {
          const freshUser = await usersCol.findOne({ _id: user._id });
          const freshBal = Number(freshUser ? freshUser.balance : 0);
          res.status(400).json({
            error: `Insufficient balance! Current: ${freshBal.toLocaleString()} Coins. Requested: ${numAmount.toLocaleString()} Coins.`
          });
          return;
        }

        const newBal = Number(updatedUser.balance || 0);
        const activeCoinRate = await getCoinRate(db);
        const usdtVal = Number(calculateCoinsUsdt(numAmount, activeCoinRate).toFixed(4));
        const tonVal = Number((usdtVal * TON_PER_USD).toFixed(6));

        // Dynamic checks for 24h limits & S2S violations:
        const minerLevel = Math.max(1, Math.min(10, user.minerLevel || 1));
        const { maxClaims, maxCoins } = getMax24hMiningForLevel(minerLevel);
        const dailyMineCycle = Number(user.dailyMineCycleStartedAt || 0);
        const isMineCycleActive = (now - dailyMineCycle < 24 * 60 * 60 * 1000);
        const dailyMinedCoins = isMineCycleActive ? Number(user.dailyMinedCoins || 0) : 0;
        const dailyMinedClaims = isMineCycleActive ? Number(user.dailyMinedClaims || 0) : 0;

        let dynamicSuspicious = false;
        let dynamicReason = "";

        if (dailyMinedClaims > maxClaims || dailyMinedCoins > (maxCoins + 5)) {
          dynamicSuspicious = true;
          dynamicReason = `Exceeded 24h mining cap for Level ${minerLevel} (${dailyMinedClaims} claims / ${dailyMinedCoins} coins in 24h, max allowed ${maxClaims} claims / ${maxCoins} coins). Timer bypass exploit.`;
        }

        const appSettings = await db.collection("settings").findOne({ key: "app_settings" }).catch(() => null);
        const currentAdReward = (appSettings && typeof appSettings.watchAdReward === "number" && appSettings.watchAdReward > 0) ? appSettings.watchAdReward : 10;
        const maxDailyEarnCoins = 10 * currentAdReward;
        const adsCycleStart = Number(user.adsCycleStartedAt || 0);
        const isAdsCycleActive = (now - adsCycleStart < 24 * 60 * 60 * 1000);
        const adsWatchedToday = isAdsCycleActive ? Number(user.adsWatchedToday || 0) : 0;
        const adsEarnedToday = isAdsCycleActive ? Number(user.adsEarnedToday || 0) : 0;

        if (adsWatchedToday > 10 || adsEarnedToday > (maxDailyEarnCoins + 5)) {
          dynamicSuspicious = true;
          dynamicReason = (dynamicReason ? dynamicReason + " | " : "") + `Watch & Earn 24h limit exceeded (${adsWatchedToday} ads, ${adsEarnedToday} coins in 24h, limit: 10 ads / ${maxDailyEarnCoins} coins). Over-claim exploit.`;
        }

        // Auto-clean legacy false-positive Ad Mission S2S flag for innocent users
        if (user.securityFlag === "RED_FLAG_AD_MISSION_S2S_BYPASS" || (user.suspiciousReason && user.suspiciousReason.includes("Ad Mission S2S violation"))) {
          usersCol.updateOne(
            { _id: user._id },
            { $unset: { securityFlag: "", suspiciousReason: "", isSuspicious: "" } }
          ).catch(() => {});
          user.securityFlag = null;
          user.suspiciousReason = null;
          user.isSuspicious = false;
        }

        const isUserSuspicious = Boolean(
          user.isSuspicious ||
          dynamicSuspicious ||
          user.isHighRiskHacker ||
          user.isFakeAdBypasser ||
          user.permanentWarning ||
          user.isBanned ||
          (user.balance < 0) ||
          user.isSuspendedMultipleAccount ||
          (user.deviceViolationsCount > 0) ||
          (user.adSkipUnder9sStrikes > 0) ||
          (user.spinUnder5sStrikes >= 3) ||
          user.securityFlag ||
          user.suspiciousReason ||
          user.penaltyNotice
        );

        const finalReason = dynamicReason || user.suspiciousReason || (isUserSuspicious ? "Security flagged account" : "");

        if (dynamicSuspicious && !user.isSuspicious) {
          await usersCol.updateOne(
            { _id: user._id },
            { $set: { isSuspicious: true, suspiciousReason: finalReason, lastSuspiciousAt: now } }
          );
        }

        // Record withdrawal transaction in MongoDB with PENDING status
        const txDoc = {
          telegramId,
          amount: numAmount,
          usdtAmount: usdtVal,
          tonAmount: tonVal,
          walletAddress: cleanAddress,
          network: "TON",
          status: "PENDING",
          txHash: "",
          isSuspicious: isUserSuspicious,
          suspiciousReason: isUserSuspicious ? finalReason : "",
          createdAt: now
        };

        const insertRes = await withdrawalsCol.insertOne(txDoc);

        // Auto-purge any excess withdrawal history older than the 5 latest for this user
        await purgeExcessUserWithdrawals(withdrawalsCol, telegramId);

        // Check if this withdrawal is part of a rhythmic cluster attack (10+ requests spaced 10s-20s apart)
        await detectRhythmicWithdrawalCluster(withdrawalsCol, usersCol, insertRes.insertedId, now, telegramId);

        res.status(200).json({
          ok: true,
          message: `⏳ Withdrawal request of ${numAmount.toLocaleString()} Coins ($${usdtVal.toFixed(2)} USDT) submitted for review!`,
          newBalance: newBal,
          boundWalletAddress: cleanAddress,
          transaction: {
            id: String(insertRes.insertedId),
            ...txDoc
          }
        });
        return;
      }

      res.status(400).json({ error: "Unknown action" });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("wallet.js error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
};
