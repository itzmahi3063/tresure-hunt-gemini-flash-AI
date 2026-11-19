const crypto = require("crypto");

let broadcastIndexesEnsured = false;

async function ensureBroadcastIndexes(db) {
  if (broadcastIndexesEnsured || !db) return;
  broadcastIndexesEnsured = true;
  try {
    await db.collection("users").createIndex({ lastBroadcastId: 1 }).catch(() => {});
    await db.collection("broadcast_jobs").createIndex({ status: 1, createdAt: 1 }).catch(() => {});
    await db.collection("broadcast_deliveries").createIndex(
      { broadcastId: 1, telegramId: 1 },
      { unique: true }
    ).catch(() => {});
  } catch (e) {}
}

// Telegram says the chat itself is unreachable (blocked / deleted / never started) -> retrying or re-sending never helps
function isChatGone(desc) {
  return /chat not found|user not found|user is deactivated|bot was blocked|bot can't initiate|peer_id_invalid|chat_id is empty|forbidden|kicked|not a member/i.test(String(desc || ""));
}

function getRetryAfter(data) {
  const ra = data && data.parameters && Number(data.parameters.retry_after);
  return ra > 0 ? ra : undefined;
}

async function sendBroadcastTelegramMsg(botToken, chatId, text, options = {}) {
  if (!botToken || !chatId) return { ok: false, error_code: 400 };
  const httpsBaseUrl = (process.env.WEBAPP_URL || process.env.APP_BASE_URL || "https://treasuremine.fun").trim().replace(/\/+$/, "");

  try {
    const basePayload = {
      chat_id: String(chatId),
      parse_mode: "HTML",
      disable_web_page_preview: false
    };

    let targetUrl = options.buttonUrl ? String(options.buttonUrl).trim() : `${httpsBaseUrl}/index.html`;
    if (targetUrl.startsWith("http://") || targetUrl.includes("localhost") || targetUrl.includes("64.205.112.34")) {
      targetUrl = `${httpsBaseUrl}/index.html`;
    }

    const btnText = options.buttonText ? String(options.buttonText).trim() : "🏹 Play Treasure Hunt";
    const isInternalWebApp = targetUrl.includes("/index.html") && !targetUrl.includes("t.me/");

    basePayload.reply_markup = {
      inline_keyboard: [
        [
          isInternalWebApp
            ? { text: btnText, web_app: { url: targetUrl } }
            : { text: btnText, url: targetUrl }
        ]
      ]
    };

    let lastError = null;

    if (options.photoUrl && String(options.photoUrl).startsWith("http")) {
      try {
        const photoPayload = Object.assign({}, basePayload, {
          photo: options.photoUrl,
          caption: text
        });
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(photoPayload)
        });
        const data = await res.json();
        if (data && data.ok) return { ok: true };
        lastError = data;
        if (data && (data.error_code === 403 || data.error_code === 429 || isChatGone(data.description))) {
          return { ok: false, error_code: data.error_code, description: data.description, retryAfter: getRetryAfter(data) };
        }
      } catch (e) {
        lastError = { error_code: 500, description: e.message };
      }
    }

    const textPayload = Object.assign({}, basePayload, { text });
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(textPayload)
    });
    const data = await res.json();
    if (data && data.ok) {
      return { ok: true };
    }

    lastError = data || lastError;

    // Critical Fallback: If rejected due to HTML entities or custom markup, send pure plain text with safe t.me button
    if (data && data.error_code !== 403 && data.error_code !== 429 && !isChatGone(data.description)) {
      console.warn(`[Broadcast] Delivery failed for ${chatId} (${data.description}), attempting safe plain-text fallback...`);
      const plainText = String(text || "").replace(/<[^>]*>/g, "");
      const safePayload = {
        chat_id: String(chatId),
        text: plainText,
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏹 Open Treasure Hunt", url: "https://t.me/treasure_hunt12_bot/mine" }]
          ]
        }
      };
      const fbRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(safePayload)
      });
      const fbData = await fbRes.json();
      if (fbData && fbData.ok) {
        return { ok: true };
      }
      lastError = fbData || lastError;
    }

    return {
      ok: false,
      error_code: lastError ? lastError.error_code : 400,
      description: lastError ? lastError.description : "Failed",
      retryAfter: getRetryAfter(lastError)
    };
  } catch (e) {
    return { ok: false, error_code: 500, description: e.message };
  }
}

/**
 * Starts a new broadcast job (or attaches to an identical running job)
 * and immediately processes as many recipients as fit within timeBudgetMs.
 * Any remaining users are automatically processed by cron-job.org in the background!
 */
async function startOrContinueBroadcast(db, botToken, payload, timeBudgetMs = 5500) {
  await ensureBroadcastIndexes(db);

  const usersCol = db.collection("users");
  const jobsCol = db.collection("broadcast_jobs");

  const cleanMsg = String(payload.message || "").trim();
  const cleanPhoto = String(payload.photoUrl || "").trim();
  const cleanBtnText = String(payload.buttonText || "").trim();
  const cleanBtnUrl = String(payload.buttonUrl || "").trim();

  const contentHash = crypto
    .createHash("sha1")
    .update([cleanMsg, cleanPhoto, cleanBtnText, cleanBtnUrl].join("\u0001"))
    .digest("hex");

  // Check if an identical broadcast is already running
  let job = await jobsCol.findOne({ contentHash, status: "running" });

  if (!job) {
    // Count distinct telegramId recipients
    const allUsers = await usersCol.find(
      { telegramId: { $exists: true, $ne: null } },
      { projection: { telegramId: 1 } }
    ).toArray();
    const recipientSet = new Set();
    for (const u of allUsers) {
      const tid = u && u.telegramId != null ? String(u.telegramId).trim() : "";
      if (tid) recipientSet.add(tid);
    }
    const totalUsers = recipientSet.size;
    const broadcastId = `${contentHash.slice(0, 16)}_${Date.now()}`;

    job = {
      broadcastId,
      contentHash,
      message: cleanMsg,
      photoUrl: cleanPhoto || null,
      buttonText: cleanBtnText || null,
      buttonUrl: cleanBtnUrl || null,
      status: "running",
      totalUsers,
      sentCount: 0,
      failCount: 0,
      skippedCount: 0,
      createdAt: Date.now(),
      createdAtDate: new Date(),
      updatedAt: Date.now()
    };

    const insertRes = await jobsCol.insertOne(job);
    job._id = insertRes.insertedId;
  }

  return await processSingleBroadcastJob(db, botToken, job, timeBudgetMs);
}

const MAX_SEND_ATTEMPTS = 3;          // temporary errors (5xx / network) are retried at most this many times per user
const LOCK_GRACE_MS = 15000;          // lock auto-expires (crash safety) this long after the time budget
const DEFAULT_PAUSE_MS = 5000;        // pause when Telegram gives 429 without retry_after
const MAX_PAUSE_MS = 120000;

function unwrapDoc(res) {
  return res && res.value !== undefined ? res.value : res;
}

function buildJobResult(job, extra = {}) {
  const completed = job.status === "completed";
  const totalUsers = Number(job.totalUsers) || 0;
  const sentCount = Number(job.sentCount) || 0;
  const failCount = Number(job.failCount) || 0;
  const skippedCount = Number(job.skippedCount) || 0;
  const remainingUsers = completed
    ? 0
    : (job.remainingUsers != null ? Number(job.remainingUsers) || 0 : Math.max(0, totalUsers - sentCount - failCount));
  return {
    ok: true,
    broadcastId: job.broadcastId,
    status: completed ? "completed" : "running",
    completed,
    queuedForCron: !completed,
    batchSent: 0,
    batchFail: 0,
    sentCount,
    failCount,
    skippedCount,
    remainingUsers,
    totalUsers,
    message: completed
      ? `Broadcast finished: ${sentCount} sent, ${failCount} failed, ${skippedCount} skipped.`
      : `Broadcast in progress (${sentCount + failCount}/${totalUsers} processed, ${remainingUsers} remaining queued for Cron-Job.org).`,
    ...extra
  };
}

/**
 * Atomic per-(broadcast,user) delivery claim.
 * - first time: inserts a "sending" doc
 * - retry of a temporary failure: flips "retry" -> "sending" (only one worker can win)
 */
async function claimDelivery(deliveriesCol, broadcastId, tid) {
  try {
    await deliveriesCol.insertOne({
      broadcastId,
      telegramId: tid,
      status: "sending",
      attempts: 0,
      createdAt: new Date()
    });
    return { claimed: true, attempts: 0 };
  } catch (claimErr) {
    if (claimErr && claimErr.code === 11000) {
      try {
        const doc = unwrapDoc(await deliveriesCol.findOneAndUpdate(
          { broadcastId, telegramId: tid, status: "retry", attempts: { $lt: MAX_SEND_ATTEMPTS } },
          { $set: { status: "sending" } },
          { returnDocument: "after" }
        ));
        if (doc) return { claimed: true, attempts: Number(doc.attempts) || 0 };
      } catch (e) {}
      return { claimed: false, dup: true };
    }
    return { claimed: false, dup: false };
  }
}

/**
 * Processes the active broadcast job for up to timeBudgetMs.
 * Called both by Admin Panel and automatically by cron-job.org / VPS worker!
 *
 * Safety guarantees:
 *  - Only ONE worker (Vercel cron, VPS worker, admin panel...) processes a job at a time (Mongo lock).
 *  - Permanent failures (blocked / deleted / invalid chat) are counted ONCE and never retried.
 *  - Temporary failures are retried at most MAX_SEND_ATTEMPTS times, on later runs (never spun in a tight loop).
 *  - On Telegram 429 the job pauses for retry_after seconds, so /start, /admin replies are not starved.
 */
async function processSingleBroadcastJob(db, botToken, job, timeBudgetMs = 5500) {
  if (!db || !botToken || !job) return null;
  await ensureBroadcastIndexes(db);

  const usersCol = db.collection("users");
  const jobsCol = db.collection("broadcast_jobs");
  const deliveriesCol = db.collection("broadcast_deliveries");

  const startTime = Date.now();

  // ---- Acquire exclusive lock (also respects Telegram rate-limit pause) ----
  const lockToken = crypto.randomBytes(8).toString("hex");
  const lockedJob = unwrapDoc(await jobsCol.findOneAndUpdate(
    {
      _id: job._id,
      status: "running",
      $and: [
        { $or: [{ lockUntil: { $exists: false } }, { lockUntil: { $lte: startTime } }] },
        { $or: [{ pausedUntil: { $exists: false } }, { pausedUntil: { $lte: startTime } }] }
      ]
    },
    { $set: { lockUntil: startTime + timeBudgetMs + LOCK_GRACE_MS, lockToken, updatedAt: startTime } },
    { returnDocument: "after" }
  ));

  if (!lockedJob) {
    // Another worker is already processing it, or it is paused / already finished
    const fresh = (await jobsCol.findOne({ _id: job._id })) || job;
    const nowTs = Date.now();
    return buildJobResult(fresh, {
      locked: fresh.status === "running" && Number(fresh.lockUntil) > nowTs,
      paused: fresh.status === "running" && Number(fresh.pausedUntil) > nowTs
    });
  }
  job = lockedJob;

  let batchSent = 0;
  let batchFail = 0;
  let batchSkipped = 0;
  let hitRateLimit = false;
  let pauseMs = 0;
  const transientSkip = []; // users that failed temporarily in THIS run: retried on the next run, not in a tight loop

  try {
    while (Date.now() - startTime < timeBudgetMs && !hitRateLimit) {
      const remainingTime = timeBudgetMs - (Date.now() - startTime);
      if (remainingTime < 700) break;

      const rawBatch = await usersCol
        .find({
          telegramId: { $exists: true, $ne: null, $nin: transientSkip },
          lastBroadcastId: { $ne: job.broadcastId }
        })
        .project({ _id: 1, telegramId: 1 })
        .limit(25)
        .toArray();

      if (!rawBatch || rawBatch.length === 0) {
        break;
      }

      // Deduplicate telegramIds within this batch
      const uniqueTids = [];
      const seenTids = new Set();
      for (const u of rawBatch) {
        const tid = String(u.telegramId || "").trim();
        if (tid && !seenTids.has(tid)) {
          seenTids.add(tid);
          uniqueTids.push(tid);
        }
      }

      if (uniqueTids.length === 0) {
        // Only blank ids in this page: mark them processed so the loop cannot spin on them
        await usersCol.updateMany(
          { _id: { $in: rawBatch.map((u) => u._id) } },
          { $set: { lastBroadcastId: job.broadcastId } }
        ).catch(() => {});
        continue;
      }

      // Process in parallel sub-chunks of 5 (~8-10 msgs/sec: leaves Telegram rate-limit headroom for /start & /admin replies)
      for (let i = 0; i < uniqueTids.length; i += 5) {
        if (Date.now() - startTime >= timeBudgetMs || hitRateLimit) break;

        const chunk = uniqueTids.slice(i, i + 5);
        await Promise.all(
          chunk.map(async (tid) => {
            const numId = Number(tid);
            const idQuery = !isNaN(numId)
              ? { $or: [{ telegramId: tid }, { telegramId: numId }] }
              : { telegramId: tid };

            // Mark user documents as processed for this broadcastId
            await usersCol.updateMany(idQuery, { $set: { lastBroadcastId: job.broadcastId } });

            // Atomic delivery claim per (broadcastId, telegramId)
            const claim = await claimDelivery(deliveriesCol, job.broadcastId, tid);
            if (!claim.claimed) {
              if (claim.dup) batchSkipped++;
              else batchFail++;
              return;
            }

            const sendRes = await sendBroadcastTelegramMsg(botToken, tid, job.message, {
              photoUrl: job.photoUrl,
              buttonText: job.buttonText,
              buttonUrl: job.buttonUrl
            });

            if (sendRes && sendRes.ok) {
              batchSent++;
              return;
            }

            const code = sendRes && Number(sendRes.error_code);

            if (code === 429) {
              // Telegram rate limit: release the user for the next run and PAUSE the whole job
              hitRateLimit = true;
              pauseMs = Math.max(pauseMs, Math.min(((sendRes && sendRes.retryAfter) || 0) * 1000 || DEFAULT_PAUSE_MS, MAX_PAUSE_MS));
              await usersCol.updateMany(idQuery, { $unset: { lastBroadcastId: "" } }).catch(() => {});
              await deliveriesCol.updateOne({ broadcastId: job.broadcastId, telegramId: tid }, { $set: { status: "retry" } }).catch(() => {});
              return;
            }

            const isTemporary = !code || code >= 500;
            if (!isTemporary) {
              // 403 blocked / 400 chat not found / other 4xx => permanent. Count once, NEVER retry.
              batchFail++;
              await deliveriesCol.updateOne(
                { broadcastId: job.broadcastId, telegramId: tid },
                { $set: { status: "failed", errorCode: code, error: String((sendRes && sendRes.description) || "").slice(0, 200) } }
              ).catch(() => {});
              return;
            }

            // Temporary error (5xx / network): bounded retries on later runs
            const attempts = (claim.attempts || 0) + 1;
            if (attempts >= MAX_SEND_ATTEMPTS) {
              batchFail++;
              await deliveriesCol.updateOne(
                { broadcastId: job.broadcastId, telegramId: tid },
                { $set: { status: "failed", attempts, errorCode: code || 500 } }
              ).catch(() => {});
            } else {
              transientSkip.push(tid);
              if (!isNaN(numId)) transientSkip.push(numId);
              await usersCol.updateMany(idQuery, { $unset: { lastBroadcastId: "" } }).catch(() => {});
              await deliveriesCol.updateOne(
                { broadcastId: job.broadcastId, telegramId: tid },
                { $set: { status: "retry", attempts } }
              ).catch(() => {});
            }
          })
        );

        // Polite 250ms pause between 5-message chunks
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    // Count how many users still haven't received this broadcast
    const remainingDocsCount = await usersCol.countDocuments({
      telegramId: { $exists: true, $ne: null },
      lastBroadcastId: { $ne: job.broadcastId }
    });

    const isCompleted = remainingDocsCount === 0 && !hitRateLimit;

    await jobsCol.updateOne(
      { _id: job._id },
      {
        $inc: { sentCount: batchSent, failCount: batchFail, skippedCount: batchSkipped },
        $set: {
          remainingUsers: remainingDocsCount,
          updatedAt: Date.now(),
          ...(pauseMs ? { pausedUntil: Date.now() + pauseMs } : {})
        }
      }
    );

    // Atomic running -> completed transition: exactly ONE caller ever gets justCompleted=true (=> exactly one admin notification)
    let justCompleted = false;
    if (isCompleted) {
      const doneRes = await jobsCol.updateOne(
        { _id: job._id, status: "running" },
        { $set: { status: "completed", completedAt: Date.now() } }
      );
      justCompleted = Boolean(doneRes && doneRes.modifiedCount === 1);
    }

    const finalJob = (await jobsCol.findOne({ _id: job._id })) || job;
    return buildJobResult(finalJob, {
      status: isCompleted ? "completed" : "running",
      completed: isCompleted,
      queuedForCron: !isCompleted,
      justCompleted,
      paused: Boolean(pauseMs),
      batchSent,
      batchFail,
      remainingUsers: remainingDocsCount
    });
  } finally {
    // Always release the lock (even on error) so the next cron tick can continue
    await jobsCol.updateOne({ _id: job._id, lockToken }, { $set: { lockUntil: 0 } }).catch(() => {});
  }
}

/**
 * Called automatically by cron-job.org (via webhook.js / tasks.js / miningReminder.js)
 * or by Admin Panel step polling to process any active "running" broadcast job.
 */
async function processBroadcastQueue(db, botToken, timeBudgetMs = 4500) {
  if (!db || !botToken) return { active: false, processed: 0 };
  try {
    const jobsCol = db.collection("broadcast_jobs");
    const activeJob = await jobsCol.findOne(
      { status: "running" },
      { sort: { createdAt: 1 } }
    );
    if (!activeJob) {
      return { active: false, processed: 0 };
    }

    const result = await processSingleBroadcastJob(db, botToken, activeJob, timeBudgetMs);

    // Notify Admin exactly once, only by the worker that really flipped the job to "completed"
    if (result && result.justCompleted && process.env.ADMIN_TELEGRAM_ID) {
      const adminIds = String(process.env.ADMIN_TELEGRAM_ID)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const summaryText =
        `📢 <b>Broadcast Delivery Completed (Cron-Job)</b>\n\n` +
        `👥 <b>Total Users:</b> ${result.totalUsers}\n` +
        `✅ <b>Successfully Sent:</b> ${result.sentCount}\n` +
        `❌ <b>Failed / Blocked:</b> ${result.failCount}\n` +
        `⏭️ <b>Skipped (Duplicate):</b> ${result.skippedCount}`;
      for (const admId of adminIds) {
        sendBroadcastTelegramMsg(botToken, admId, summaryText).catch(() => {});
      }
    }

    return {
      active: true,
      ...result
    };
  } catch (err) {
    console.warn("processBroadcastQueue error:", err.message);
    return { active: false, error: err.message };
  }
}

module.exports = {
  startOrContinueBroadcast,
  processBroadcastQueue,
  processSingleBroadcastJob
};
