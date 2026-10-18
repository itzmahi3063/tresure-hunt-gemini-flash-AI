const { ObjectId } = require("mongodb");
const { recordSignupAndCheckVelocity, claimDevice } = require("./ipRegistry");
const {
  IP_SIGNUP_VELOCITY_WINDOW_MS,
  IP_SIGNUP_VELOCITY_THRESHOLD,
  TASK_COMPLETION_PURGE_MS
} = require("./constants");

async function findOrCreateUser(usersCol, tgUser, meta = {}) {
  if (!tgUser || !tgUser.id) return null;
  const telegramId = String(tgUser.id);
  const numId = Number(tgUser.id);
  const clientIp = meta.clientIp || "";
  const clientDeviceId = meta.clientDeviceId || "";
  const prevUid = meta.prevUid || "";
  const isLocalIp = !clientIp || clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "localhost";

  const query = {
    $or: [
      { telegramId: telegramId },
      { telegramId: numId }
    ]
  };

  const matchingUsers = await usersCol.find(query).sort({ balance: -1, createdAt: 1 }).toArray();

  if (matchingUsers.length === 0) {
    // ----------------------------------------------------
    // CHECK MULTIPLE ACCOUNT DETECTION (Same IP or Same Device)
    // ----------------------------------------------------
    const checkOrList = [];
    if (clientDeviceId) {
      checkOrList.push({ registeredDeviceId: clientDeviceId });
      checkOrList.push({ lastDeviceId: clientDeviceId });
    }
    if (prevUid && String(prevUid) !== telegramId) {
      checkOrList.push({ telegramId: String(prevUid) });
      checkOrList.push({ telegramId: Number(prevUid) });
    }
    if (!isLocalIp) {
      checkOrList.push({ registeredIp: clientIp });
      checkOrList.push({ lastIp: clientIp });
    }

    let existingOldAccount = null;
    if (checkOrList.length > 0) {
      existingOldAccount = await usersCol.findOne(
        {
          telegramId: { $nin: [telegramId, numId] },
          $or: checkOrList
        },
        { sort: { createdAt: 1 } }
      );
    }

    if (existingOldAccount) {
      const isSameDevice = Boolean(
        (clientDeviceId && (existingOldAccount.registeredDeviceId === clientDeviceId || existingOldAccount.lastDeviceId === clientDeviceId)) ||
        (prevUid && (String(prevUid) === String(existingOldAccount.telegramId) || Number(prevUid) === Number(existingOldAccount.telegramId)))
      );

      // PENALTY ON OLD ACCOUNT (When multi-account is created on SAME DEVICE):
      // Only apply device penalty & suspension if genuinely on the SAME physical device.
      // Shared dynamic IPs under Bangladeshi carrier CGNAT are protected from false-positive bans
      // and are instead governed by the IP Signup Velocity gate below.
      if (isSameDevice) {
        const currentViolations = Number(existingOldAccount.deviceViolationsCount || 0);
        if (currentViolations === 0) {
          await usersCol.updateOne(
            { _id: existingOldAccount._id },
            {
              $set: {
                balance: 0,
                deviceViolationsCount: 1,
                penaltyNotice: "Warning: Multiple accounts detected on your device! Your balance has been reset to 0.",
                lastPenaltyAt: Date.now()
              }
            }
          );
        } else {
          await usersCol.updateOne(
            { _id: existingOldAccount._id },
            {
              $set: {
                balance: -999999999,
                deviceViolationsCount: currentViolations + 1,
                penaltyNotice: "Severe Penalty: You created multiple accounts on this device after your balance was reset. Your balance has been penalized to -999,999,999 Coins.",
                lastPenaltyAt: Date.now()
              }
            }
          );
        }

        // Create new secondary account as SUSPENDED
        const newUser = {
          telegramId: telegramId,
          firstName: tgUser.first_name || "",
          username: tgUser.username || "",
          photoUrl: tgUser.photo_url || "",
          balance: 0,
          minerLevel: 1,
          lastMineCollectedAt: null,
          mineReminderSent: false,
          dailyCycle: 1,
          dailyDayIndex: 0,
          lastCheckinAt: null,
          totalDailyEarned: 0,
          recruitsCount: 0,
          refEarnings: 0,
          referredBy: null,
          referralRewarded: false,
          claimedMilestones: [],
          completedTasks: [],
          language: "en",
          languageSelected: false,
          registeredIp: clientIp || "",
          lastIp: clientIp || "",
          registeredDeviceId: clientDeviceId || "",
          lastDeviceId: clientDeviceId || "",
          isBanned: true,
          bannedAt: Date.now(),
          bannedAtDate: new Date(),
          dataPurged: false,
          isSuspendedMultipleAccount: true,
          detectionType: "device",
          banReason: "Multiple accounts detected on the same device",
          primaryTelegramId: existingOldAccount.telegramId,
          createdAt: Date.now()
        };
        const res = await usersCol.insertOne(newUser);
        newUser._id = res.insertedId;
        newUser.isMultipleAccountBlocked = true;
        newUser.primaryAccount = {
          telegramId: existingOldAccount.telegramId,
          name: existingOldAccount.firstName || existingOldAccount.name || "Original User",
          username: existingOldAccount.username || "N/A",
          photoUrl: existingOldAccount.photoUrl || ""
        };
        return newUser;
      }
    }

    // ----------------------------------------------------
    // NEWTUBE-TON ARCHITECTURE: IP SIGNUP VELOCITY GATE
    // ----------------------------------------------------
    const db = usersCol.s?.db || global._hoocoohMongoDb || null;
    let ipSignupCount = 1;
    if (db && !isLocalIp) {
      const velRes = await recordSignupAndCheckVelocity(db, clientIp);
      ipSignupCount = velRes.count || 1;
    }

    const isVelocityLocked = (ipSignupCount >= IP_SIGNUP_VELOCITY_THRESHOLD);

    let initialReferredBy = null;
    const rawRef = String(meta.startParam || meta.referredBy || "").trim();
    if (rawRef) {
      const invId = rawRef.replace(/^ref_/, "").trim();
      if (invId && /^\d+$/.test(invId) && String(invId) !== telegramId) {
        initialReferredBy = invId;
      }
    }

    // Normal clean new user (or auto-locked if farm script exceeded IP signup velocity)
    const newUser = {
      telegramId: telegramId,
      firstName: tgUser.first_name || "",
      username: tgUser.username || "",
      photoUrl: tgUser.photo_url || "",
      balance: 0,
      minerLevel: 1,
      totalMinedCoins: 0,
      totalMinedClaims: 0,
      lastMineCollectedAt: null,
      mineReminderSent: false,
      dailyCycle: 1,
      dailyDayIndex: 0,
      lastCheckinAt: null,
      totalDailyEarned: 0,
      recruitsCount: 0,
      refEarnings: 0,
      referredBy: initialReferredBy,
      referralRewarded: false,
      claimedMilestones: [],
      completedTasks: [],
      language: "en",
      languageSelected: false,
      registeredIp: clientIp || "",
      lastIp: clientIp || "",
      registeredDeviceId: clientDeviceId || "",
      lastDeviceId: clientDeviceId || "",
      accountLocked: isVelocityLocked,
      isSuspicious: isVelocityLocked,
      velocityFlaggedAt: isVelocityLocked ? new Date() : null,
      velocityFlaggedReason: isVelocityLocked ? "ip_signup_velocity" : null,
      createdAt: Date.now(),
      lastActiveAt: new Date()
    };
    const res = await usersCol.insertOne(newUser);
    newUser._id = res.insertedId;

    if (db) {
      claimDevice(db, clientDeviceId || clientIp, telegramId).catch(() => {});
    }

    // Admin Telegram alert if IP Signup Velocity threshold is reached (NEWTUBE-TON pattern)
    const adminId = process.env.ADMIN_TELEGRAM_ID;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (isVelocityLocked && (ipSignupCount === IP_SIGNUP_VELOCITY_THRESHOLD || ipSignupCount % 10 === 0) && adminId && botToken) {
      const minutes = Math.round(IP_SIGNUP_VELOCITY_WINDOW_MS / 60000);
      const alertMsg =
        `🔒 <b>IP signup velocity — accounts auto-locked</b>\n\n` +
        `<b>${ipSignupCount}+</b> new accounts have signed up from IP <code>${clientIp}</code> within <b>${minutes} minutes</b> — potential farming script.\n\n` +
        `Latest account (locked, withdrawal blocked): <code>${telegramId}</code>\n\n` +
        `Review and unlock manually in admin panel if legitimate.`;
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: String(adminId), text: alertMsg, parse_mode: "HTML" })
      }).catch(() => {});
    }

    return newUser;
  }

  let primaryUser = matchingUsers[0];

  // If duplicate documents exist, merge all progression fields
  if (matchingUsers.length > 1) {
    let maxBalance = Number(primaryUser.balance) || 0;
    let maxLevel = Number(primaryUser.minerLevel) || 1;
    let maxMinedCoins = Number(primaryUser.totalMinedCoins) || 0;
    let maxMinedClaims = Number(primaryUser.totalMinedClaims) || 0;
    let maxRecruits = Number(primaryUser.recruitsCount) || 0;
    let maxRefEarnings = Number(primaryUser.refEarnings) || 0;
    let maxDailyEarned = Number(primaryUser.totalDailyEarned) || 0;
    let dailyCycle = Number(primaryUser.dailyCycle) || 1;
    let dailyDayIndex = Number(primaryUser.dailyDayIndex) || 0;
    let claimedMilestones = Array.isArray(primaryUser.claimedMilestones) ? [...primaryUser.claimedMilestones] : [];
    let completedTasks = Array.isArray(primaryUser.completedTasks) ? [...primaryUser.completedTasks] : [];
    let referredBy = primaryUser.referredBy || null;
    let lastMine = primaryUser.lastMineCollectedAt;
    let lastCheckin = primaryUser.lastCheckinAt;

    for (let i = 1; i < matchingUsers.length; i++) {
      const other = matchingUsers[i];
      if ((Number(other.balance) || 0) > maxBalance) maxBalance = Number(other.balance);
      if ((Number(other.minerLevel) || 1) > maxLevel) maxLevel = Number(other.minerLevel);
      if ((Number(other.totalMinedCoins) || 0) > maxMinedCoins) maxMinedCoins = Number(other.totalMinedCoins);
      if ((Number(other.totalMinedClaims) || 0) > maxMinedClaims) maxMinedClaims = Number(other.totalMinedClaims);
      if ((Number(other.recruitsCount) || 0) > maxRecruits) maxRecruits = Number(other.recruitsCount);
      if ((Number(other.refEarnings) || 0) > maxRefEarnings) maxRefEarnings = Number(other.refEarnings);
      if ((Number(other.totalDailyEarned) || 0) > maxDailyEarned) maxDailyEarned = Number(other.totalDailyEarned);
      if ((Number(other.dailyCycle) || 1) > dailyCycle) {
        dailyCycle = Number(other.dailyCycle);
        dailyDayIndex = Number(other.dailyDayIndex) || 0;
      }
      if (!referredBy && other.referredBy) referredBy = other.referredBy;
      if (Array.isArray(other.claimedMilestones)) {
        other.claimedMilestones.forEach(m => {
          if (!claimedMilestones.includes(m)) claimedMilestones.push(m);
        });
      }
      if (Array.isArray(other.completedTasks)) {
        other.completedTasks.forEach(t => {
          if (!completedTasks.includes(t)) completedTasks.push(t);
        });
      }
      if (other.lastMineCollectedAt && (!lastMine || other.lastMineCollectedAt > lastMine)) {
        lastMine = other.lastMineCollectedAt;
      }
      if (other.lastCheckinAt && (!lastCheckin || other.lastCheckinAt > lastCheckin)) {
        lastCheckin = other.lastCheckinAt;
      }
      if (other.languageSelected) primaryUser.languageSelected = true;
      if (other.termsAccepted) primaryUser.termsAccepted = true;
      if (other.isIdentityVerified) primaryUser.isIdentityVerified = true;
      if (other.referralRewarded) primaryUser.referralRewarded = true;
      if (other.isSuspicious) primaryUser.isSuspicious = true;
      if (other.isHighRiskHacker) primaryUser.isHighRiskHacker = true;
      if (other.suspiciousReason && !primaryUser.suspiciousReason) primaryUser.suspiciousReason = other.suspiciousReason;
      if (other.securityFlag && !primaryUser.securityFlag) primaryUser.securityFlag = other.securityFlag;
      if (other.lastSuspiciousAt && (!primaryUser.lastSuspiciousAt || other.lastSuspiciousAt > primaryUser.lastSuspiciousAt)) {
        primaryUser.lastSuspiciousAt = other.lastSuspiciousAt;
      }
      if (other.identityVerifiedAt && (!primaryUser.identityVerifiedAt || other.identityVerifiedAt > primaryUser.identityVerifiedAt)) {
        primaryUser.identityVerifiedAt = other.identityVerifiedAt;
      }
      if (other.boundWalletAddress && !primaryUser.boundWalletAddress) {
        primaryUser.boundWalletAddress = other.boundWalletAddress;
      }
      try {
        await usersCol.deleteOne({ _id: other._id });
      } catch (e) {
        console.error("Duplicate cleanup error:", e);
      }
    }

    primaryUser.balance = maxBalance;
    primaryUser.minerLevel = maxLevel;
    primaryUser.totalMinedCoins = maxMinedCoins;
    primaryUser.totalMinedClaims = maxMinedClaims;
    primaryUser.recruitsCount = maxRecruits;
    primaryUser.refEarnings = maxRefEarnings;
    primaryUser.totalDailyEarned = maxDailyEarned;
    primaryUser.dailyCycle = dailyCycle;
    primaryUser.dailyDayIndex = dailyDayIndex;
    primaryUser.claimedMilestones = claimedMilestones;
    primaryUser.completedTasks = completedTasks;
    primaryUser.referredBy = referredBy;
    if (lastMine) primaryUser.lastMineCollectedAt = lastMine;
    if (lastCheckin) primaryUser.lastCheckinAt = lastCheckin;
  }

  // Optimize DB writes: only write progression fields if duplicate docs were merged
  const updateFields = {};
  if (matchingUsers.length > 1) {
    updateFields.telegramId = telegramId;
    if (primaryUser.balance !== undefined) updateFields.balance = primaryUser.balance;
    if (primaryUser.minerLevel !== undefined) updateFields.minerLevel = primaryUser.minerLevel;
    if (primaryUser.totalMinedCoins !== undefined) updateFields.totalMinedCoins = primaryUser.totalMinedCoins;
    if (primaryUser.totalMinedClaims !== undefined) updateFields.totalMinedClaims = primaryUser.totalMinedClaims;
    if (primaryUser.lastMineCollectedAt !== undefined) updateFields.lastMineCollectedAt = primaryUser.lastMineCollectedAt;
    if (primaryUser.lastCheckinAt !== undefined) updateFields.lastCheckinAt = primaryUser.lastCheckinAt;
    if (primaryUser.recruitsCount !== undefined) updateFields.recruitsCount = primaryUser.recruitsCount;
    if (primaryUser.refEarnings !== undefined) updateFields.refEarnings = primaryUser.refEarnings;
    if (primaryUser.totalDailyEarned !== undefined) updateFields.totalDailyEarned = primaryUser.totalDailyEarned;
    if (primaryUser.dailyCycle !== undefined) updateFields.dailyCycle = primaryUser.dailyCycle;
    if (primaryUser.dailyDayIndex !== undefined) updateFields.dailyDayIndex = primaryUser.dailyDayIndex;
    if (primaryUser.claimedMilestones !== undefined) updateFields.claimedMilestones = primaryUser.claimedMilestones;
    if (primaryUser.completedTasks !== undefined) updateFields.completedTasks = primaryUser.completedTasks;
    if (primaryUser.referredBy !== undefined) updateFields.referredBy = primaryUser.referredBy;
    if (primaryUser.referralRewarded !== undefined) updateFields.referralRewarded = primaryUser.referralRewarded;
    if (primaryUser.languageSelected !== undefined) updateFields.languageSelected = primaryUser.languageSelected;
    if (primaryUser.termsAccepted !== undefined) updateFields.termsAccepted = primaryUser.termsAccepted;
    if (primaryUser.isIdentityVerified !== undefined) updateFields.isIdentityVerified = primaryUser.isIdentityVerified;
    if (primaryUser.identityVerifiedAt !== undefined) updateFields.identityVerifiedAt = primaryUser.identityVerifiedAt;
    if (primaryUser.boundWalletAddress !== undefined) updateFields.boundWalletAddress = primaryUser.boundWalletAddress;
  } else if (typeof primaryUser.telegramId !== "string" || primaryUser.telegramId !== telegramId) {
    updateFields.telegramId = telegramId;
  }

  // Throttle lastActiveAt update to once every 30 mins to avoid continuous DB writes
  const lastActiveTime = primaryUser.lastActiveAt ? new Date(primaryUser.lastActiveAt).getTime() : 0;
  if (!primaryUser.isBanned && (!lastActiveTime || (Date.now() - lastActiveTime > 30 * 60 * 1000))) {
    updateFields.lastActiveAt = new Date();
    primaryUser.lastActiveAt = updateFields.lastActiveAt;
  }

  if (primaryUser.isSuspicious) {
    updateFields.isSuspicious = true;
    if (primaryUser.suspiciousReason) updateFields.suspiciousReason = primaryUser.suspiciousReason;
    if (primaryUser.lastSuspiciousAt) updateFields.lastSuspiciousAt = primaryUser.lastSuspiciousAt;
  }
  if (primaryUser.isHighRiskHacker) {
    updateFields.isHighRiskHacker = true;
    if (primaryUser.securityFlag) updateFields.securityFlag = primaryUser.securityFlag;
  }

  if (tgUser.first_name && primaryUser.firstName !== tgUser.first_name) {
    updateFields.firstName = tgUser.first_name;
    primaryUser.firstName = tgUser.first_name;
  }
  if (tgUser.username && primaryUser.username !== tgUser.username) {
    updateFields.username = tgUser.username;
    primaryUser.username = tgUser.username;
  }
  if (tgUser.photo_url && primaryUser.photoUrl !== tgUser.photo_url) {
    updateFields.photoUrl = tgUser.photo_url;
    primaryUser.photoUrl = tgUser.photo_url;
  }

  // Update IP & device metadata only if changed/missing
  if (clientIp && primaryUser.lastIp !== clientIp) {
    updateFields.lastIp = clientIp;
    primaryUser.lastIp = clientIp;
    if (!primaryUser.registeredIp) {
      updateFields.registeredIp = clientIp;
      primaryUser.registeredIp = clientIp;
    }
  }
  if (clientDeviceId && primaryUser.lastDeviceId !== clientDeviceId) {
    updateFields.lastDeviceId = clientDeviceId;
    primaryUser.lastDeviceId = clientDeviceId;
    if (!primaryUser.registeredDeviceId) {
      updateFields.registeredDeviceId = clientDeviceId;
      primaryUser.registeredDeviceId = clientDeviceId;
    }
  }

  // Check if primaryUser is a secondary account on the same device switching in:
  if (prevUid && String(prevUid) !== telegramId && !primaryUser.isSuspendedMultipleAccount) {
    const prevUser = await usersCol.findOne({
      $or: [{ telegramId: String(prevUid) }, { telegramId: Number(prevUid) }]
    });
    if (prevUser && prevUser.createdAt < primaryUser.createdAt) {
      const currentViolations = Number(prevUser.deviceViolationsCount || 0);
      if (currentViolations === 0) {
        await usersCol.updateOne(
          { _id: prevUser._id },
          {
            $set: {
              balance: 0,
              deviceViolationsCount: 1,
              penaltyNotice: "Warning: Multiple accounts detected on your device! Your balance has been reset to 0.",
              lastPenaltyAt: Date.now()
            }
          }
        );
      } else {
        await usersCol.updateOne(
          { _id: prevUser._id },
          {
            $set: {
              balance: -999999999,
              deviceViolationsCount: currentViolations + 1,
              penaltyNotice: "Severe Penalty: You created multiple accounts on this device after your balance was reset. Your balance has been penalized to -999,999,999 Coins.",
              lastPenaltyAt: Date.now()
            }
          }
        );
      }

      primaryUser.isBanned = true;
      primaryUser.isSuspendedMultipleAccount = true;
      primaryUser.isMultipleAccountBlocked = true;
      primaryUser.detectionType = "device";
      primaryUser.primaryTelegramId = prevUser.telegramId;
      primaryUser.primaryAccount = {
        telegramId: prevUser.telegramId,
        name: prevUser.firstName || prevUser.name || "Original User",
        username: prevUser.username || "N/A",
        photoUrl: prevUser.photoUrl || ""
      };
      updateFields.isBanned = true;
      updateFields.isSuspendedMultipleAccount = true;
      updateFields.detectionType = "device";
      updateFields.banReason = "Multiple accounts detected on the same device";
      updateFields.primaryTelegramId = prevUser.telegramId;
    }
  }

  if (primaryUser.isSuspendedMultipleAccount && !primaryUser.primaryAccount && primaryUser.primaryTelegramId) {
    const orig = await usersCol.findOne({
      $or: [{ telegramId: String(primaryUser.primaryTelegramId) }, { telegramId: Number(primaryUser.primaryTelegramId) }]
    });
    if (orig) {
      primaryUser.primaryAccount = {
        telegramId: orig.telegramId,
        name: orig.firstName || orig.name || "Original User",
        username: orig.username || "N/A",
        photoUrl: orig.photoUrl || ""
      };
    }
    primaryUser.isMultipleAccountBlocked = true;
  }

  if (primaryUser.isBanned) {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const banTime = Number(primaryUser.bannedAt) || (primaryUser.bannedAtDate ? new Date(primaryUser.bannedAtDate).getTime() : 0);
    if (!banTime) {
      primaryUser.bannedAt = Date.now();
      primaryUser.bannedAtDate = new Date();
      updateFields.bannedAt = primaryUser.bannedAt;
      updateFields.bannedAtDate = primaryUser.bannedAtDate;
    } else if ((Date.now() - banTime) >= SEVEN_DAYS_MS && !primaryUser.dataPurged) {
      const db = usersCol.client?.db(usersCol.dbName) || usersCol.s?.db || global._hoocoohMongoDb || null;
      await purgeSingleBannedUser(usersCol, db, primaryUser);
      primaryUser.dataPurged = true;
      primaryUser.balance = 0;
      primaryUser.minerLevel = 1;
    }
  }

  const updateOp = {};
  if (Object.keys(updateFields).length > 0) {
    updateOp.$set = updateFields;
  }
  if (primaryUser.isBanned) {
    // Crucial: remove lastActiveAt so 60-day inactivity TTL never deletes the banned record
    delete updateFields.lastActiveAt;
    updateOp.$unset = { lastActiveAt: "" };
  }

  if ((updateOp.$set && Object.keys(updateOp.$set).length > 0) || (updateOp.$unset && Object.keys(updateOp.$unset).length > 0)) {
    await usersCol.updateOne({ _id: primaryUser._id }, updateOp);
  }
  return primaryUser;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 604,800,000 ms

async function purgeSingleBannedUser(usersCol, db, user) {
  if (!user || !user._id) return;
  const sId = String(user.telegramId);
  const nId = Number(user.telegramId);
  const idOr = [{ telegramId: sId }];
  if (!isNaN(nId)) idOr.push({ telegramId: nId });

  if (db) {
    try {
      await db.collection("withdrawals").deleteMany({ $or: idOr });
      await db.collection("captcha_tokens").deleteMany({ $or: idOr });
      await db.collection("captcha_challenges").deleteMany({ $or: idOr });
      await db.collection("user_verification_codes").deleteMany({ userId: { $in: [sId, nId] } });
    } catch (e) {
      console.warn("Purge auxiliary collection cleanup warning:", sId, e.message);
    }
  }

  const purgeReason = user.banReason
    ? `${user.banReason} (Data permanently erased: not unbanned within 7 days)`
    : "Violation of rules - Data permanently erased after 7 days suspension";

  await usersCol.updateOne(
    { _id: user._id },
    {
      $set: {
        isBanned: true,
        dataPurged: true,
        permanentBan: true,
        purgedAt: Date.now(),
        purgedAtDate: new Date(),
        balance: 0,
        minerLevel: 1,
        totalMinedCoins: 0,
        totalMinedClaims: 0,
        recruitsCount: 0,
        refEarnings: 0,
        claimedMilestones: [],
        completedTasks: [],
        claimedRefs: [],
        referredBy: null,
        referralRewarded: false,
        totalDailyEarned: 0,
        dailyCycle: 1,
        dailyDayIndex: 0,
        lastMineCollectedAt: null,
        lastCheckinAt: null,
        registeredIp: "",
        lastIp: "",
        registeredDeviceId: "",
        lastDeviceId: "",
        photoUrl: "",
        walletAddress: "",
        walletType: "",
        boundWalletAddress: null,
        deviceViolationsCount: 0,
        penaltyNotice: "",
        banReason: "Permanently suspended (Account suspended permanently; data & security details purged after 7-day unban grace expired)"
      },
      $unset: {
        lastActiveAt: "",
        bannedAtDate: "",
        codeHash: "",
        codeExpiresAt: "",
        isSuspicious: "",
        suspiciousReason: "",
        isHighRiskHacker: "",
        securityFlag: "",
        lastSuspiciousAt: "",
        spinUnder5sStrikes: ""
      }
    }
  );
}

async function purgeExpiredBannedUsers(db) {
  if (!db) return 0;
  try {
    const usersCol = db.collection("users");
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const cutoffDate = new Date(cutoff);

    // Backfill any legacy banned accounts lacking bannedAt
    await usersCol.updateMany(
      { isBanned: true, bannedAt: { $exists: false } },
      { $set: { bannedAt: Date.now(), bannedAtDate: new Date() } }
    ).catch(() => {});

    const query = {
      isBanned: true,
      dataPurged: { $ne: true },
      $or: [
        { bannedAt: { $lte: cutoff } },
        { bannedAtDate: { $lte: cutoffDate } }
      ]
    };

    const expired = await usersCol.find(query).toArray();
    if (!expired || expired.length === 0) return 0;

    for (const u of expired) {
      await purgeSingleBannedUser(usersCol, db, u);
    }
    return expired.length;
  } catch (err) {
    console.error("Error in purgeExpiredBannedUsers:", err.message);
    return 0;
  }
}

async function findUserById(usersCol, tgId) {
  if (!tgId) return null;
  const sId = String(tgId);
  const nId = Number(tgId);
  const orList = [{ telegramId: sId }];
  if (!isNaN(nId)) {
    orList.push({ telegramId: nId });
  }
  return await usersCol.findOne({ $or: orList }, { sort: { balance: -1 } });
}

async function sendTelegramMsg(botToken, chatId, text, options = {}) {
  if (!botToken || !chatId) return null;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    disable_web_page_preview: false
  };
  if (options.reply_markup) {
    payload.reply_markup = options.reply_markup;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) {
    console.error("sendTelegramMsg in userHelper error:", e.message);
    return null;
  }
}

/**
 * Automatically credits 5% referral commission to the referrer when a recruit's withdrawal is approved.
 * @param {object} db - MongoDB database instance
 * @param {string} botToken - Telegram bot token (for notification)
 * @param {object} withdrawal - The withdrawal document
 * @param {object} [userDoc] - The withdrawing user's document
 * @returns {Promise<{ ok: boolean, credited: boolean, commissionCoins?: number, referrerId?: string }>}
 */
async function creditReferralWithdrawalCommission(db, botToken, withdrawal, userDoc = null) {
  try {
    if (!db || !withdrawal) return { ok: false, credited: false, reason: "Missing db or withdrawal" };

    const usersCol = db.collection("users");
    const withdrawalsCol = db.collection("withdrawals");

    // 1. Resolve withdrawing user
    const withdrawingUser = userDoc || await findUserById(usersCol, withdrawal.telegramId);
    if (!withdrawingUser) {
      return { ok: false, credited: false, reason: "Withdrawing user not found" };
    }

    const referrerId = withdrawingUser.referredBy ? String(withdrawingUser.referredBy).trim() : "";
    if (!referrerId || referrerId === String(withdrawingUser.telegramId)) {
      return { ok: true, credited: false, reason: "No valid referrer" };
    }

    // 2. Calculate 5% commission in TREASURE Coins
    const withdrawAmount = Number(withdrawal.amount || 0);
    if (withdrawAmount <= 0) {
      return { ok: true, credited: false, reason: "Zero withdrawal amount" };
    }
    const commissionCoins = Math.max(1, Math.round(withdrawAmount * 0.05));

    // 3. Idempotently claim commission crediting on withdrawal record
    // Only succeeds if referralCommissionPaid is not already true
    let widQuery;
    try {
      widQuery = withdrawal._id ? (typeof withdrawal._id === "string" ? { _id: new ObjectId(withdrawal._id) } : { _id: withdrawal._id }) : null;
    } catch (e) {
      widQuery = { _id: withdrawal._id };
    }
    if (!widQuery) return { ok: false, credited: false, reason: "Invalid withdrawal ID" };

    const claimRes = await withdrawalsCol.updateOne(
      {
        ...widQuery,
        referralCommissionPaid: { $ne: true }
      },
      {
        $set: {
          referralCommissionPaid: true,
          referralCommissionCoins: commissionCoins,
          referralCommissionAt: Date.now(),
          referrerTelegramId: referrerId
        }
      }
    );

    if (!claimRes || claimRes.modifiedCount === 0) {
      // Already credited or locked
      return { ok: true, credited: false, reason: "Commission already credited" };
    }

    // 4. Atomically credit the referrer:
    // - balance += commissionCoins (spendable/withdrawable coins)
    // - refEarnings += commissionCoins (lifetime referral coins on Invite page)
    // - refCommissionEarned += commissionCoins (dedicated 5% commission tracking)
    const numReferrerId = Number(referrerId);
    const referrerQuery = {
      $or: [
        { telegramId: referrerId },
        ...(numReferrerId ? [{ telegramId: numReferrerId }] : [])
      ]
    };

    const now = Date.now();
    await usersCol.updateOne(
      referrerQuery,
      {
        $inc: {
          balance: commissionCoins,
          refEarnings: commissionCoins,
          refCommissionEarned: commissionCoins
        },
        $set: {
          lastCommissionAt: now,
          lastActiveAt: new Date()
        }
      }
    );

    // 5. Send Telegram notification to referrer
    if (botToken && referrerId) {
      try {
        const rawRecruitName = withdrawingUser.firstName 
          ? withdrawingUser.firstName 
          : (withdrawingUser.username ? `@${withdrawingUser.username}` : `Friend_${String(withdrawingUser.telegramId).slice(-4)}`);
        const recruitName = String(rawRecruitName || "Your recruit")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        const refMsg = 
          `🎁 <b>5% Referral Commission Received!</b>\n\n` +
          `Your recruit <b>${recruitName}</b> just had a withdrawal approved for <b>${withdrawAmount.toLocaleString()} TREASURE Coins</b>.\n\n` +
          `💰 <b>Your 5% Commission:</b> <code>+${commissionCoins.toLocaleString()} TREASURE Coins</code>\n` +
          `✨ The coins have been credited to your balance and referral earnings!`;

        await sendTelegramMsg(botToken, referrerId, refMsg);
      } catch (tgErr) {
        console.warn("Referral commission Telegram notification failed:", tgErr && tgErr.message);
      }
    }

    return {
      ok: true,
      credited: true,
      commissionCoins,
      referrerId
    };
  } catch (err) {
    console.error("creditReferralWithdrawalCommission error:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Automatically purges tasks that reached 100% completion 24 hours ago.
 * Permanently removes the task documents from MongoDB so they disappear from both
 * the Admin Panel and the task creator's "My History" modal, retaining no details after 24h.
 */
async function purgeExpiredCompletedTasks(tasksCol) {
  if (!tasksCol) return { purged: 0 };
  const now = Date.now();
  const purgeWindowMs = TASK_COMPLETION_PURGE_MS || (24 * 60 * 60 * 1000);

  try {
    // 1. Immediate purge of any task where purgeAt date has arrived/expired
    const directRes = await tasksCol.deleteMany({
      purgeAt: { $exists: true, $ne: null, $lte: new Date(now) }
    }).catch(() => ({ deletedCount: 0 }));

    // 2. Scan tasks to ensure:
    //    a) Tasks already 100% completed have completedAt and purgeAt stamped
    //    b) If 24 hours have already passed since completedAt, mark for deletion
    const cappedTasks = await tasksCol.find({
      isUnlimited: { $ne: true },
      targetCount: { $exists: true, $ne: null, $lt: 99999999 }
    }).toArray();

    const idsToDelete = [];
    for (const t of cappedTasks) {
      const completedCount = (t.completedBy || []).length;
      const target = Number(t.targetCount) || 0;
      if (target > 0 && completedCount >= target) {
        // Task has reached 100% completion
        if (t.completedAt) {
          const completedTimestamp = typeof t.completedAt === "number" ? t.completedAt : new Date(t.completedAt).getTime();
          if (now - completedTimestamp >= purgeWindowMs) {
            idsToDelete.push(t._id);
          }
        } else {
          // Stamp completedAt and purgeAt (countdown 24h from now)
          const purgeDate = new Date(now + purgeWindowMs);
          await tasksCol.updateOne(
            { _id: t._id },
            {
              $set: {
                status: "completed",
                completedAt: now,
                purgeAt: purgeDate
              }
            }
          ).catch(() => {});
        }
      }
    }

    let scannedDeleted = 0;
    if (idsToDelete.length > 0) {
      const delRes = await tasksCol.deleteMany({ _id: { $in: idsToDelete } }).catch(() => ({ deletedCount: 0 }));
      scannedDeleted = delRes.deletedCount || 0;
    }

    const totalPurged = (directRes.deletedCount || 0) + scannedDeleted;
    return { purged: totalPurged };
  } catch (err) {
    console.error("purgeExpiredCompletedTasks error:", err);
    return { purged: 0, error: err.message };
  }
}

module.exports = {
  findOrCreateUser,
  findUserById,
  purgeSingleBannedUser,
  purgeExpiredBannedUsers,
  creditReferralWithdrawalCommission,
  purgeExpiredCompletedTasks,
  SEVEN_DAYS_MS
};

