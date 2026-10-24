const { ObjectId } = require("mongodb");
const { dispatchTonPayout } = require("./tonAutoPay");
const { creditReferralWithdrawalCommission } = require("./userHelper");

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "hoocooh_admin_2026";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendTelegramMsg(botToken, chatId, text, options = {}) {
  if (!botToken || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: String(chatId),
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
      ...options
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return Boolean(data && data.ok);
  } catch (e) {
    return false;
  }
}

/**
 * Triggers the next autonomous worker step by calling /api/admin
 * Completely decoupled and non-blocking.
 */
function triggerNextAutopayStep(baseUrl, delayMs = 0) {
  if (!baseUrl) return;
  const targetUrl = `${baseUrl.replace(/\/+$/, "")}/api/admin`;
  const doFetch = () => {
    fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": ADMIN_SECRET
      },
      body: JSON.stringify({ action: "autopay_worker_step" })
    }).catch(err => {
      console.warn("[AutoPay Worker] Chain trigger fetch error:", err.message);
    });
  };

  if (delayMs > 0) {
    setTimeout(doFetch, delayMs);
  } else {
    doFetch();
  }
}

/**
 * Starts a new server-side auto-pay job in MongoDB.
 * Accepts explicit withdrawalIds array from admin UI or queries all matching from DB.
 */
async function startAutopayJob(db, filter = "PENDING", baseUrl = "", withdrawalIds = null, totalCountInput = 0) {
  const withdrawalsCol = db.collection("withdrawals");
  const settingsCol = db.collection("settings");

  let queueIds = [];
  if (Array.isArray(withdrawalIds) && withdrawalIds.length > 0) {
    queueIds = withdrawalIds.map(id => String(id)).filter(Boolean);
  }

  // If no explicit list passed, fetch all pending matching withdrawals from DB
  if (queueIds.length === 0) {
    const filterQuery = { status: "PENDING" };
    if (filter === "SUSPICIOUS") {
      filterQuery.$or = [
        { isSuspicious: true },
        { isSuspiciousWithdrawalDistance: true },
        { securityFlag: { $exists: true, $ne: "" } }
      ];
    } else {
      filterQuery.isSuspicious = { $ne: true };
      filterQuery.isSuspiciousWithdrawalDistance = { $ne: true };
    }

    const pendingDocs = await withdrawalsCol
      .find(filterQuery)
      .project({ _id: 1 })
      .sort({ createdAt: 1 })
      .toArray();

    queueIds = pendingDocs.map(d => String(d._id));
  }

  const totalCount = queueIds.length;
  if (totalCount === 0) {
    return { ok: false, error: "No pending withdrawals found to approve!" };
  }

  const jobData = {
    key: "ton_autopay_job",
    status: "RUNNING",
    filter: filter === "SUSPICIOUS" ? "SUSPICIOUS" : "PENDING",
    stopRequested: false,
    withdrawalIds: queueIds,
    totalCount: totalCount,
    currentIndex: 0,
    completedCount: 0,
    successCount: 0,
    failCount: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    baseUrl: baseUrl || "",
    currentDetail: `Server queue started for ${totalCount} requests...`
  };

  await settingsCol.updateOne(
    { key: "ton_autopay_job" },
    { $set: jobData },
    { upsert: true }
  );

  // Immediately kick off the server-side autonomous worker chain!
  triggerNextAutopayStep(baseUrl, 0);

  return { ok: true, job: jobData };
}

/**
 * Stops any active auto-pay job in MongoDB.
 */
async function stopAutopayJob(db) {
  const settingsCol = db.collection("settings");
  await settingsCol.updateOne(
    { key: "ton_autopay_job" },
    {
      $set: {
        status: "STOPPED",
        stopRequested: true,
        updatedAt: Date.now(),
        currentDetail: "Stopped by admin"
      }
    }
  );
  return { ok: true, message: "Auto-pay stopped successfully." };
}

/**
 * Retrieves the current auto-pay job state from MongoDB.
 */
async function getAutopayJobStatus(db) {
  const settingsCol = db.collection("settings");
  const job = await settingsCol.findOne({ key: "ton_autopay_job" });
  return { ok: true, job: job || null };
}

/**
 * Executes a single step of the auto-pay queue on the server.
 * Iterates strictly sequentially through withdrawalIds index by index.
 * Increments completedCount strictly one by one (1/N, 2/N, ... N/N).
 * Real on-chain TON payouts with 8s confirmation delay.
 */
async function processAutopayStep(db, botToken, reqBaseUrl = "") {
  const settingsCol = db.collection("settings");
  const withdrawalsCol = db.collection("withdrawals");
  const usersCol = db.collection("users");

  const job = await settingsCol.findOne({ key: "ton_autopay_job" });
  if (!job || job.status !== "RUNNING" || job.stopRequested) {
    return { ok: true, stopped: true };
  }

  const baseUrl = job.baseUrl || reqBaseUrl || "";
  const queueIds = Array.isArray(job.withdrawalIds) ? job.withdrawalIds : [];
  const totalCount = Number(job.totalCount || queueIds.length || 0);
  let currentIndex = Number(job.currentIndex || 0);

  // If already at or beyond total queue length, mark COMPLETED
  if (currentIndex >= queueIds.length || currentIndex >= totalCount) {
    await settingsCol.updateOne(
      { key: "ton_autopay_job" },
      {
        $set: {
          status: "COMPLETED",
          updatedAt: Date.now(),
          currentDetail: `Queue completed! All ${totalCount} requests processed.`
        }
      }
    );
    return { ok: true, finished: true };
  }

  const targetId = queueIds[currentIndex];
  let objId = null;
  try { objId = new ObjectId(targetId); } catch (_) { objId = null; }
  const idQuery = objId ? { $or: [{ _id: objId }, { _id: String(targetId) }] } : { _id: String(targetId) };

  const nextW = await withdrawalsCol.findOne(idQuery);

  // If withdrawal record not found, advance index and continue
  if (!nextW) {
    const newIndex = currentIndex + 1;
    const newCompleted = Number(job.completedCount || 0) + 1;
    const isFinished = newIndex >= totalCount;
    await settingsCol.updateOne(
      { key: "ton_autopay_job" },
      {
        $set: {
          currentIndex: newIndex,
          completedCount: newCompleted,
          status: isFinished ? "COMPLETED" : "RUNNING",
          updatedAt: Date.now(),
          currentDetail: isFinished ? "Queue completed!" : `Skipped missing request (${newCompleted} of ${totalCount})`
        }
      }
    );
    if (!isFinished && !job.stopRequested) {
      triggerNextAutopayStep(baseUrl, 200);
    }
    return { ok: true, skipped: true };
  }

  // If already APPROVED or REJECTED:
  if (nextW.status === "APPROVED" || nextW.status === "REJECTED") {
    const newIndex = currentIndex + 1;
    const newCompleted = Number(job.completedCount || 0) + 1;
    const isFinished = newIndex >= totalCount;
    await settingsCol.updateOne(
      { key: "ton_autopay_job" },
      {
        $set: {
          currentIndex: newIndex,
          completedCount: newCompleted,
          status: isFinished ? "COMPLETED" : "RUNNING",
          updatedAt: Date.now(),
          currentDetail: isFinished ? "Queue completed!" : `Already ${nextW.status.toLowerCase()} (${newCompleted} of ${totalCount})`
        }
      }
    );
    if (!isFinished && !job.stopRequested) {
      triggerNextAutopayStep(baseUrl, 200);
    }
    return { ok: true, skipped: true };
  }

  // Check user ban status
  let userDoc = null;
  try {
    userDoc = await usersCol.findOne({
      $or: [{ telegramId: String(nextW.telegramId) }, { telegramId: Number(nextW.telegramId) }]
    });
  } catch (_) {}

  if (userDoc && userDoc.isBanned) {
    const newIndex = currentIndex + 1;
    const newCompleted = Number(job.completedCount || 0) + 1;
    const isFinished = newIndex >= totalCount;
    await settingsCol.updateOne(
      { key: "ton_autopay_job" },
      {
        $set: {
          currentIndex: newIndex,
          completedCount: newCompleted,
          status: isFinished ? "COMPLETED" : "RUNNING",
          updatedAt: Date.now(),
          currentDetail: isFinished ? "Queue completed!" : `Skipped banned account UID ${nextW.telegramId} (${newCompleted} of ${totalCount})`
        }
      }
    );
    if (!isFinished && !job.stopRequested) {
      triggerNextAutopayStep(baseUrl, 200);
    }
    return { ok: true, skippedBanned: true };
  }

  const now = Date.now();
  const tonVal = nextW.tonAmount !== undefined ? Number(nextW.tonAmount) : Number(((nextW.usdtAmount || 0) * (0.019 / 0.03)).toFixed(4));

  // Atomic claim: PENDING (or stale PROCESSING > 60s) -> PROCESSING
  const claimRes = await withdrawalsCol.updateOne(
    { 
      _id: nextW._id, 
      $or: [
        { status: "PENDING" },
        { status: "PROCESSING", processingAt: { $lt: now - 60000 } }
      ]
    },
    { $set: { status: "PROCESSING", processingAt: now } }
  );

  if (!claimRes || claimRes.modifiedCount === 0) {
    // Another worker currently handling this item or fresh lock, wait 3s and retry
    triggerNextAutopayStep(baseUrl, 3000);
    return { ok: true, retrying: true };
  }

  // Dispatch real on-chain TON payout
  let autoPayRes;
  try {
    autoPayRes = await dispatchTonPayout(nextW.walletAddress, tonVal, `TREASURE Payout UID ${nextW.telegramId}`, db);
  } catch (payErr) {
    autoPayRes = { success: false, error: payErr && payErr.message ? payErr.message : payErr };
  }

  let itemSuccess = false;
  let finalTx = "";
  let haltError = "";

  if (autoPayRes && autoPayRes.isConfigured && autoPayRes.success) {
    itemSuccess = true;
    finalTx = autoPayRes.txHash;
  } else {
    haltError = (autoPayRes && (autoPayRes.message || autoPayRes.error)) || "Auto-pay failed";
  }

  if (itemSuccess) {
    await withdrawalsCol.updateOne(
      { _id: nextW._id, status: "PROCESSING" },
      {
        $set: {
          status: "APPROVED",
          tonAmount: tonVal,
          txHash: finalTx,
          approvedAt: now
        },
        $unset: { processingAt: "" }
      }
    );

    // 5% Referral Commission Crediting
    try {
      if (!userDoc) {
        userDoc = await usersCol.findOne({
          $or: [{ telegramId: String(nextW.telegramId) }, { telegramId: Number(nextW.telegramId) }]
        });
      }
      await creditReferralWithdrawalCommission(db, botToken, nextW, userDoc);
    } catch (_) {}

    // Send Telegram Notifications (Payout channel & User)
    if (botToken) {
      try {
        if (!userDoc) {
          userDoc = await usersCol.findOne({
            $or: [{ telegramId: String(nextW.telegramId) }, { telegramId: Number(nextW.telegramId) }]
          });
        }
        const rawName = userDoc?.username 
          ? `@${userDoc.username}` 
          : (userDoc?.firstName ? `${userDoc.firstName}${userDoc.lastName ? ' ' + userDoc.lastName : ''}` : `Miner_${String(nextW.telegramId).slice(-4)}`);
        const displayName = escapeHtml(rawName);
        const txUrl = `https://tonviewer.com/transaction/${encodeURIComponent(finalTx)}`;
        const txLinkHtml = `<a href="${txUrl}">View Transaction</a>`;

        const channelId = process.env.PAYOUT_CHANNEL_ID || "@hoocoohpaylogs";
        const channelMsg = 
`🎉 <b>New payout paid</b> 🎉\n\n` +
`👤 <b>User:</b> ${displayName}\n` +
`🔘 <b>Amount:</b> ${Number(nextW.amount).toLocaleString()} TREASURE (${Number(nextW.usdtAmount).toFixed(2)} USDT)\n` +
`💳 <b>Wallet address:</b>\n` +
`<code>${nextW.walletAddress}</code>\n` +
`🔗 <b>Transaction id:</b> ${txLinkHtml}\n\n` +
`BOT ---> @treasure_hunt12_bot`;

        await sendTelegramMsg(botToken, channelId, channelMsg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🚀 Open @treasure_hunt12_bot", url: "https://t.me/treasure_hunt12_bot" }]
            ]
          }
        });

        if (nextW.telegramId) {
          const userMsg = 
`✅ <b>Withdrawal Approved!</b>\n\n` +
`🪙 <b>${Number(nextW.amount).toLocaleString()} TREASURE Coins ($${Number(nextW.usdtAmount).toFixed(2)} USDT) sent!</b>\n` +
`💎 <b>TON Amount:</b> ${tonVal.toFixed(4)} TON\n` +
`💳 <b>Wallet:</b> <code>${nextW.walletAddress}</code>\n` +
`🔗 <b>Transaction:</b> ${txLinkHtml}\n\n` +
`<i>Thank you for mining with TREASURE HUNT!</i>`;

          await sendTelegramMsg(botToken, nextW.telegramId, userMsg);
        }
      } catch (_) {}
    }
  } else {
    // Release claim back to PENDING so it remains in DB safely
    await withdrawalsCol.updateOne(
      { _id: nextW._id, status: "PROCESSING" },
      { $set: { status: "PENDING" }, $unset: { processingAt: "" } }
    );

    // Halt immediately only if hot wallet balance is low or credentials missing:
    if (haltError.includes("INSUFFICIENT_HOT_WALLET_BALANCE") || haltError.includes("not configured") || haltError.includes("missing") || haltError.includes("INVALID_MNEMONIC")) {
      await settingsCol.updateOne(
        { key: "ton_autopay_job" },
        {
          $set: {
            status: "STOPPED",
            stopRequested: true,
            updatedAt: Date.now(),
            currentDetail: `Halted: ${haltError}`
          }
        }
      );
      return { ok: false, halted: true, error: haltError };
    }
  }

  const newIndex = currentIndex + 1;
  const newCompleted = Number(job.completedCount || 0) + 1;
  const newSuccess = Number(job.successCount || 0) + (itemSuccess ? 1 : 0);
  const newFail = Number(job.failCount || 0) + (itemSuccess ? 0 : 1);
  const userIdentifier = nextW.telegramId ? `UID ${nextW.telegramId}` : `ID ${nextW._id}`;
  const isFinished = newIndex >= totalCount;

  await settingsCol.updateOne(
    { key: "ton_autopay_job" },
    {
      $set: {
        currentIndex: newIndex,
        completedCount: newCompleted,
        successCount: newSuccess,
        failCount: newFail,
        status: isFinished ? "COMPLETED" : "RUNNING",
        updatedAt: Date.now(),
        currentDetail: isFinished 
          ? `Queue completed! All ${totalCount} requests processed.` 
          : (itemSuccess 
              ? `Paid ${userIdentifier} (${newCompleted} of ${totalCount})` 
              : `Payout issue for ${userIdentifier} (${haltError}). Moving to next... (${newCompleted} of ${totalCount})`)
      }
    }
  );

  // If there are more items to process and stop wasn't requested, chain next step
  if (!isFinished && !job.stopRequested) {
    const delay = itemSuccess ? 8000 : 3000;
    triggerNextAutopayStep(baseUrl, delay);
  }

  return {
    ok: true,
    completedCount: newCompleted,
    totalCount: totalCount,
    isFinished
  };
}

module.exports = {
  startAutopayJob,
  stopAutopayJob,
  getAutopayJobStatus,
  processAutopayStep,
  triggerNextAutopayStep
};
