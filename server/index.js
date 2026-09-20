import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { authMiddleware, adminMiddleware } from './auth.js';

// Blocks reward-granting actions (chest opens, task/ad rewards, wallet
// moves, game payouts, promo redemption, gifts...) for an account flagged
// as sharing a device OR sharing an IP beyond the allowed threshold with
// another existing account (see db.getOrCreateUser's lock checks). This
// runs on the server, on every request to these routes — so it can't be
// skipped by calling the API directly instead of going through the app's UI.
function blockIfDeviceConflict(req, res, next) {
  const user = db.getUser(req.user.id);
  if (user && user.device_conflict) {
    return res.status(403).json({
      success: false,
      error: 'Your account has been suspended',
      deviceConflict: true,
      linkedUser: user.device_conflict_linked || null
    });
  }
  if (user && user.ip_conflict) {
    return res.status(403).json({
      success: false,
      error: 'alada Network / Vpn use kore account ta calaite hobe',
      ipConflict: true,
      linkedUsers: user.ip_conflict_linked || []
    });
  }
  next();
}
import {
  bot,
  postWithdrawalProofToChannel,
  postPromoCodeToChannel,
  processBroadcastQueue,
  verifyUserChannelMembership,
  verifyBotIsAdminInChat,
  broadcastToUsers
} from './bot.js';
import axios from 'axios';
import {
  getTonConfig,
  handleWebhookPayload,
  verifyPendingTonPayments,
  fetchRecentTransactions
} from './ton.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Keep every request's view of the data fresh from MongoDB — not just on
// cold start, but on every single request. A warm serverless instance
// that stays alive across many requests would otherwise only ever have
// the snapshot it saw at its own startup, which is why balances/game
// state/admin visibility could look inconsistent between requests handled
// by different instances. This is the fix for that.
app.use(async (req, res, next) => {
  try {
    await db.mongoReady; // cold start: wait for the very first connection
    await db.ensureFresh(); // every request: pull the latest state
  } catch (e) {
    // Never block a request forever over this.
  }

  // Hard requirement in production: MongoDB must be the source of truth.
  // Previously, if Mongo failed to connect on a cold start, this middleware
  // still called next() unconditionally — so the request was silently
  // served (and saved!) from the fresh/empty local state instead of the
  // real persisted data. That is exactly what could make a balance look
  // like it "reset": nothing was actually deleted from MongoDB, this
  // instance just never talked to it and quietly acted on a blank slate.
  // Now: no Mongo connection in production = an honest 503, never a fake
  // empty account. /api/health is exempt so it can always report status.
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !db.isMongoConnected && req.path !== '/api/health') {
    return res.status(503).json({
      success: false,
      error: 'Database temporarily unavailable. Please try again in a moment — your data is safe and has not been reset.',
      dbUnavailable: true
    });
  }

  next();
});

// Ensure any pending write this request makes is actually persisted to
// MongoDB before the response goes out. Serverless functions can freeze
// immediately after the response is sent, so a "fire and forget" write
// scheduled for later (the old behavior) could simply never happen —
// which is why new users / referral counts / balance changes made on one
// instance were invisible on another (e.g. the admin panel).
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let flushing = null;
  const flushBefore = (sendFn) => async (body) => {
    if (!flushing) flushing = db.flush().catch(() => {});
    await flushing;
    return sendFn(body);
  };
  res.json = flushBefore(originalJson);
  res.send = flushBefore(originalSend);
  next();
});

// URL Prefix normalizer for serverless environments
app.use((req, res, next) => {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url;
  }
  next();
});

// Public health check — also reports whether MongoDB is actually the
// storage backend right now. Hit this after every deploy: if
// storage.mode is "local_json_fallback", balances WILL reset on the next
// cold serverless instance because MONGO_URI is missing/invalid.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    storage: {
      mode: db.isMongoConnected ? 'mongodb' : 'local_json_fallback',
      mongoConnected: db.isMongoConnected,
      warning: db.isMongoConnected
        ? null
        : 'MONGO_URI is not set (or invalid) — user data is only in a local/temp file and WILL be lost on serverless restarts.'
    }
  });
});

// Telegram Webhook Handler (for Serverless Vercel & Webhook setups)
app.post('/api/webhook', async (req, res) => {
  try {
    if (bot) {
      await bot.handleUpdate(req.body, res);
      if (!res.headersSent) {
        res.status(200).send('OK');
      }
    } else {
      res.status(200).send('Bot not initialized');
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
    if (!res.headersSent) {
      res.status(200).send('Error');
    }
  }
});

// Helper endpoint to connect Telegram Webhook in 1 click
app.get('/api/set-webhook', async (req, res) => {
  try {
    const token = process.env.BOT_TOKEN;
    if (!token) {
      return res.status(400).json({ success: false, error: 'BOT_TOKEN is not configured in environment variables.' });
    }
    const host = req.get('host');
    const protocol = (req.protocol === 'https' || host.includes('vercel.app')) ? 'https' : req.protocol;
    const webhookUrl = `${protocol}://${host}/api/webhook`;

    const tgResponse = await axios.get(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    res.json({
      success: true,
      webhookUrl,
      telegram: tgResponse.data
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, details: err.response?.data });
  }
});

// ==========================================
// USER & PROFILE ROUTES (Protected)
// ==========================================

app.get('/api/user/me', authMiddleware, (req, res) => {
  try {
    const referrerId = req.query.referrerId || null;
    const user = db.getOrCreateUser(req.user, referrerId);
    res.json({
      success: true,
      user,
      isAdmin: req.isAdmin,
      settings: {
        rate: db.data.settings.diamond_to_usd_rate,
        commission: db.data.settings.referral_commission_rate,
        minWithdrawal: db.data.settings.min_withdrawal_usdt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/sync', authMiddleware, (req, res) => {
  try {
    const { referrerId, deviceId } = req.body;
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || null;
    const user = db.getOrCreateUser(req.user, referrerId, { deviceId, ip });
    res.json({
      success: true,
      user,
      isDuplicate: !!user.device_conflict,
      linkedUser: user.device_conflict_linked || null,
      isIpDuplicate: !!user.ip_conflict,
      ipLinkedUsers: user.ip_conflict_linked || [],
      isAdmin: req.isAdmin,
      settings: {
        rate: db.data.settings.diamond_to_usd_rate,
        commission: db.data.settings.referral_commission_rate,
        minWithdrawal: db.data.settings.min_withdrawal_usdt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Open Treasure Chest
app.post('/api/chest/open', authMiddleware, blockIfDeviceConflict, (req, res) => {
  try {
    const { watchStartedAt } = req.body;
    if (isAdWatchTooShort(watchStartedAt)) {
      return res.status(400).json({ success: false, error: 'Please watch the full ad for at least 5 seconds before opening the chest.' });
    }
    const result = db.openChest(req.user.id);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// TASKS & COMPLETION ROUTES
// ==========================================

app.get('/api/tasks', authMiddleware, (req, res) => {
  try {
    const { category } = req.query;
    const tasks = db.getTasks(category);
    const userId = req.user.id;

    // Attach completion status for current user
    const formatted = tasks.map(t => ({
      ...t,
      is_completed: db.isTaskCompleted(userId, t.id)
    }));

    res.json({ success: true, tasks: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/tasks/complete', authMiddleware, blockIfDeviceConflict, async (req, res) => {
  try {
    const { taskId } = req.body;
    const userId = req.user.id;

    const task = db.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    if (db.isTaskCompleted(userId, taskId)) {
      return res.status(400).json({ success: false, error: 'Task already completed' });
    }

    // If verified channel/group task, verify actual membership with bot API
    if ((task.type === 'channel' || task.type === 'group') && (task.verification_type === 'verified' || (!task.verification_type && task.chat_id))) {
      if (task.chat_id) {
        const check = await verifyUserChannelMembership(task.chat_id, userId);
        if (!check.verified) {
          return res.status(400).json({
            success: false,
            error: check.error || 'You have not joined the channel/group yet! Please join the channel first and then click Verify.'
          });
        }
      }
    }

    const { user, task: updatedTask } = db.completeTask(userId, taskId);

    res.json({
      success: true,
      reward: task.reward_diamonds,
      user,
      task: updatedTask
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// User's own exclusive task campaigns
app.get('/api/tasks/my', authMiddleware, (req, res) => {
  try {
    const userTasks = db.getUserTasks(req.user.id);
    res.json({ success: true, tasks: userTasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Normalize a raw Telegram channel/group link, @username, or numeric chat id
// into the chat_id format Telegram's Bot API expects.
function normalizeTelegramChatId(usernameOrLink) {
  let clean = (usernameOrLink || '').trim();
  if (!clean) return '';
  let chatId = clean;
  if (clean.includes('t.me/')) {
    const match = clean.match(/t\.me\/([a-zA-Z0-9_]+)/);
    if (match && match[1]) {
      chatId = '@' + match[1];
    }
  } else if (!chatId.startsWith('@') && !chatId.startsWith('-100') && !/^\d+$/.test(chatId)) {
    chatId = '@' + chatId;
  }
  return chatId;
}

// Server-side enforcement for "Bot must be verified as Admin" tasks. The
// frontend already disables the Post button until the user clicks Verify,
// but that alone is only a UI convenience — anyone could call this API
// directly and skip the click entirely. This re-checks with Telegram
// itself, independent of whatever the client claims, so a "Verified"
// task can never go live without the bot genuinely being an admin in
// that exact channel/group.
async function assertBotVerifiedIfRequired(taskData) {
  if (taskData.verification_type !== 'verified') return { chatId: (taskData.chat_id || '').trim() };

  const chatId = normalizeTelegramChatId(taskData.chat_id || taskData.link);
  if (!chatId) {
    const err = new Error('A Telegram channel/group username or link is required for a Verified task.');
    err.statusCode = 400;
    throw err;
  }

  const check = await verifyBotIsAdminInChat(chatId);
  if (!check.isAdmin) {
    const err = new Error('Bot is not an administrator in this channel/group yet. Please click "Verify" after adding the bot as Admin before posting.');
    err.statusCode = 400;
    throw err;
  }

  return { chatId };
}

app.post('/api/tasks/exclusive/create', authMiddleware, async (req, res) => {
  try {
    const { chatId } = await assertBotVerifiedIfRequired(req.body);
    const newTask = db.createUserExclusiveTask(req.user.id, { ...req.body, chat_id: chatId || req.body.chat_id });
    res.json({ success: true, task: newTask });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// Cancel / Reject Unpaid Task Campaign Draft
app.post('/api/tasks/exclusive/cancel', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'taskId is required' });
    }

    const task = db.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task draft not found or already deleted' });
    }

    const adminId = String(process.env.ADMIN_ID || '7780774047');
    if (String(task.creator_id) !== String(req.user.id) && String(req.user.id) !== adminId) {
      return res.status(403).json({ success: false, error: 'Unauthorized to delete this task draft' });
    }

    if (task.status === 'approved' && task.tx_hash) {
      return res.status(400).json({ success: false, error: 'Cannot delete an active, paid task campaign' });
    }

    db.deleteTask(taskId);
    db.save();
    await db.flush();
    console.log(`🗑️ Task draft "${task.title}" (${taskId}) deleted by user ${req.user.id}`);
    res.json({ success: true, message: 'Task draft deleted successfully', taskId });
  } catch (err) {
    console.error('Cancel task error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Confirm & Pay for Exclusive Task Campaign (Strict TON Blockchain & Balance Verification)
app.post('/api/tasks/exclusive/pay', authMiddleware, blockIfDeviceConflict, async (req, res) => {
  try {
    const { taskId } = req.body;
    const existing = db.getTaskById(taskId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Task campaign not found' });
    }

    // 1. If already approved via TonConsole webhook or blockchain scan (with genuine tx_hash)
    if (existing.status === 'approved' && existing.tx_hash) {
      return res.json({ success: true, task: existing });
    }

    // 2. Trigger immediate real-time scan on TON blockchain for memo EXCL_<taskId>
    await verifyPendingTonPayments(true);

    const recheck = db.getTaskById(taskId);
    if (recheck && recheck.status === 'approved' && recheck.tx_hash) {
      return res.json({ success: true, task: recheck });
    }

    // 3. Alternatively allow payment from user's deposited TON balance
    const user = db.getUser(req.user.id);
    const tonCost = existing.ton_cost || Number(((existing.max_users / 100) * 0.20).toFixed(2));
    if (user && (user.ton_balance || 0) >= tonCost) {
      await assertBotVerifiedIfRequired({
        verification_type: existing.verification_type,
        chat_id: existing.chat_id,
        link: existing.link
      });
      user.ton_balance = Number(((user.ton_balance || 0) - tonCost).toFixed(4));
      const task = db.payUserExclusiveTask(req.user.id, taskId);
      task.paid_amount_ton = tonCost;
      task.paid_at = new Date().toISOString();
      task.tx_hash = `internal_balance_${Date.now()}`;
      db.save();
      await db.flush();
      return res.json({ success: true, task, paidFromBalance: true });
    }

    // 4. Reject unpaid attempts strictly
    return res.status(400).json({
      success: false,
      error: `TON payment not detected on blockchain yet! Please send ${tonCost.toFixed(2)} TON with comment/memo EXCL_${taskId} to approve your post.`
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// ====================================================
// TON Blockchain & TonConsole Endpoints
// ====================================================

// Public TON configuration for frontend deposits & task campaign payments
app.get('/api/ton/config', (req, res) => {
  try {
    const config = getTonConfig();
    res.json({ success: true, ...config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Webhook for TonConsole / TonAPI real-time transaction notifications
app.post('/api/ton/webhook', async (req, res) => {
  try {
    const expectedSecret = process.env.TON_WEBHOOK_SECRET;
    if (expectedSecret) {
      const incomingSecret =
        req.headers['x-tonconsole-secret'] ||
        req.headers['x-webhook-secret'] ||
        req.headers['authorization'] ||
        req.query.secret;

      if (
        !incomingSecret ||
        (incomingSecret !== expectedSecret && incomingSecret !== `Bearer ${expectedSecret}`)
      ) {
        console.warn('⚠️ Rejected TON Webhook: missing or invalid secret');
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid webhook secret' });
      }
    }

    console.log('📥 Incoming TON Webhook received:', JSON.stringify(req.body).slice(0, 180));
    const result = await handleWebhookPayload(req.body);
    res.json({ success: true, result });
  } catch (err) {
    console.error('TON Webhook Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1-minute Fallback Cron Endpoint (called by cron-job.org / Vercel Cron)
app.get('/api/ton/cron', async (req, res) => {
  try {
    const result = await verifyPendingTonPayments();
    // Also process queued broadcast messages in small batches (40 users per run)
    const broadcastResult = await processBroadcastQueue(40).catch(err => {
      console.error('Error processing broadcast queue in cron:', err);
      return null;
    });
    res.json({ success: true, timestamp: new Date().toISOString(), result, broadcast: broadcastResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated broadcast queue processor cron endpoint
app.get('/api/broadcast/cron', async (req, res) => {
  try {
    const result = await processBroadcastQueue(50);
    res.json({ success: true, timestamp: new Date().toISOString(), result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Real-time Payment & Deposit Verification for Frontend Polling
app.get('/api/ton/check-payment', async (req, res) => {
  try {
    const { memo, taskId, userId } = req.query;

    // Trigger instant blockchain scan so user doesn't wait for next interval
    await verifyPendingTonPayments();

    // 1. Check if Exclusive Task has genuine blockchain payment confirmation
    if (taskId) {
      const task = db.getTaskById(taskId);
      // STRICT: Must have real blockchain tx_hash to confirm payment
      if (task && task.status === 'approved' && task.tx_hash) {
        return res.json({ success: true, paid: true, type: 'task', task });
      }
      // If checking for a task and it's not confirmed yet, DO NOT fall through to loose memo matching
      return res.json({ success: true, paid: false, message: 'Task payment pending confirmation' });
    }

    // 2. Check if user deposit processed
    if (userId) {
      const user = db.getUser(userId);
      const isPaid = db.data.ton_transactions?.some(t => t.userId === String(userId) && t.tx_hash);
      return res.json({
        success: true,
        paid: Boolean(isPaid),
        type: 'deposit',
        user: user ? { id: user.id, diamonds: user.diamonds, ton_balance: user.ton_balance } : null
      });
    }

    // 3. Check if specific memo is found in ton_transactions (exact match and valid tx_hash)
    if (memo && String(memo).trim().length > 3) {
      const cleanMemo = String(memo).trim();
      const found = db.data.ton_transactions?.find(t => t.memo && t.memo.trim() === cleanMemo && t.tx_hash);
      if (found) {
        return res.json({ success: true, paid: true, transaction: found });
      }
    }

    res.json({ success: true, paid: false, message: 'Payment pending confirmation' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TON Service Health & Status
app.get('/api/ton/status', async (req, res) => {
  try {
    const config = getTonConfig();
    const recent = await fetchRecentTransactions(5);
    res.json({
      success: true,
      configured: config.isConfigured,
      walletAddress: config.walletAddress,
      recentTxCount: recent.length,
      processedTxsCount: db.data.ton_processed_txs?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify if Bot is Admin in given Telegram Channel/Group
app.post('/api/tasks/verify-bot-admin', authMiddleware, async (req, res) => {
  try {
    const { usernameOrLink } = req.body;
    if (!(usernameOrLink || '').trim()) {
      return res.status(400).json({ success: false, error: 'Telegram channel or group username/link is required' });
    }
    const chatId = normalizeTelegramChatId(usernameOrLink);

    const check = await verifyBotIsAdminInChat(chatId);
    if (check.isAdmin) {
      res.json({
        success: true,
        isAdmin: true,
        chatId,
        isSimulation: check.isSimulation || false,
        message: 'Bot is confirmed as Admin in this channel/group!'
      });
    } else {
      res.status(400).json({
        success: false,
        isAdmin: false,
        chatId,
        error: 'Bot is not an administrator in this channel/group! Please add the bot as Admin with invite/post rights and try again.'
      });
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Edit Unpaid Task Campaign Draft
app.put('/api/tasks/exclusive/:taskId', authMiddleware, async (req, res) => {
  try {
    const { chatId } = await assertBotVerifiedIfRequired(req.body);
    const updated = db.editUserExclusiveTask(req.user.id, req.params.taskId, { ...req.body, chat_id: chatId || req.body.chat_id });
    res.json({ success: true, task: updated });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// Boost Task Campaign (Add more user capacity)
app.post('/api/tasks/exclusive/boost', authMiddleware, (req, res) => {
  try {
    const { taskId, boostQuantity } = req.body;
    const result = db.boostUserExclusiveTask(req.user.id, taskId, boostQuantity);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// ADS & DAILY REWARD ROUTES
// ==========================================

app.get('/api/ads', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const ads = db.getAdsConfig();

    const formatted = ads.map(a => ({
      ...a,
      watched_today: db.getDailyAdCount(userId, a.id),
      is_completed_today: db.getDailyAdCount(userId, a.id) >= a.max_daily
    }));

    res.json({ success: true, ads: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// No reward is granted for an ad "watched" in under this long — closes the
// same direct-API-call bypass we closed for duplicate accounts. The client
// (src/services/ads.js) already waits this long before calling these
// routes; this is the check that can't be skipped by calling the API
// directly instead of going through the app's UI.
const MIN_AD_WATCH_MS = 4500; // small buffer under the client's 5000ms for normal network/processing latency

function isAdWatchTooShort(watchStartedAt) {
  if (!watchStartedAt || typeof watchStartedAt !== 'number') return true;
  return Date.now() - watchStartedAt < MIN_AD_WATCH_MS;
}

app.post('/api/ads/watch', authMiddleware, blockIfDeviceConflict, (req, res) => {
  try {
    const { adId, watchStartedAt } = req.body;
    const userId = req.user.id;

    if (isAdWatchTooShort(watchStartedAt)) {
      return res.status(400).json({ success: false, error: 'Please watch the full ad for at least 5 seconds before claiming this reward.' });
    }

    const count = db.getDailyAdCount(userId, adId);
    const ad = db.data.ads_config.find(a => a.id === adId);

    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad slot not found' });
    }

    if (count >= ad.max_daily) {
      return res.status(400).json({ success: false, error: 'Daily limit reached for this ad' });
    }

    const result = db.recordAdWatch(userId, adId);
    res.json({
      success: true,
      watchedToday: result.count,
      maxDaily: ad.max_daily,
      rewardDiamonds: result.reward,
      user: result.user
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// WALLET: CONVERT & WITHDRAW ROUTES
// ==========================================

app.post('/api/wallet/convert', authMiddleware, blockIfDeviceConflict, (req, res) => {
  try {
    const { amountDiamonds } = req.body;
    const { user, conversion } = db.convertDiamonds(req.user.id, amountDiamonds);
    res.json({ success: true, user, conversion });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/wallet/withdraw', authMiddleware, blockIfDeviceConflict, (req, res) => {
  try {
    const { amountUsdt, network, walletAddress } = req.body;
    const { user, withdrawal } = db.createWithdrawal(
      req.user.id,
      amountUsdt,
      network,
      walletAddress
    );
    res.json({ success: true, user, withdrawal });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/wallet/requirements', authMiddleware, (req, res) => {
  try {
    const reqs = db.getWithdrawalRequirements(req.user.id);
    res.json({ success: true, requirements: reqs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/store/buy-crystal', authMiddleware, blockIfDeviceConflict, (req, res) => {
  try {
    const { quantity } = req.body;
    const result = db.buyCrystalCoin(req.user.id, quantity || 1);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/daily-rewards/status', authMiddleware, (req, res) => {
  try {
    const status = db.getDailyRewardStatus(req.user.id);
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/daily-rewards/claim', authMiddleware, blockIfDeviceConflict, (req, res) => {
  try {
    const { watchStartedAt } = req.body;
    if (isAdWatchTooShort(watchStartedAt)) {
      return res.status(400).json({ success: false, error: 'Please watch the full ad for at least 5 seconds before claiming your daily reward.' });
    }
    const result = db.claimDailyReward(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/wallet/history', authMiddleware, (req, res) => {
  try {
    const userId = String(req.user.id);
    const withdrawals = db.getWithdrawals(userId);
    const conversions = db.data.conversions.filter(c => c.user_id === userId);
    res.json({ success: true, withdrawals, conversions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Real Daily Approved Withdrawal Proofs for Wallet Modal (Only approved payments)
app.get('/api/wallet/proofs', (req, res) => {
  try {
    const approved = (db.data.withdrawals || [])
      .filter(w => w.status === 'approved')
      .sort((a, b) => new Date(b.approved_at || b.updated_at || b.created_at) - new Date(a.approved_at || a.updated_at || a.created_at))
      .slice(0, 100);

    const maskAddress = (addr) => {
      if (!addr || typeof addr !== 'string') return '***';
      const clean = addr.trim();
      if (clean.length <= 6) return clean;
      return `${clean.slice(0, 3)}*****${clean.slice(-3)}`;
    };

    const proofs = approved.map(w => {
      const user = db.getUser(w.user_id);
      const uidStr = String(w.user_id || '');
      const maskedUid = uidStr.length > 5 ? `${uidStr.slice(0, 3)}***${uidStr.slice(-2)}` : `${uidStr}***`;
      const maskedAddr = maskAddress(w.wallet_address || '');

      let currencyLabel = 'USDT';
      const net = (w.network || '').toUpperCase();
      if (net.includes('TON')) currencyLabel = 'TON (Tonkeeper)';
      else if (net.includes('BINANCE')) currencyLabel = 'USDT (Binance Pay)';
      else currencyLabel = w.network || 'USDT';

      const dateObj = new Date(w.approved_at || w.updated_at || w.created_at);

      return {
        id: w.id,
        user_id: maskedUid,
        raw_uid: uidStr,
        username: user?.username ? `@${user.username}` : (user?.first_name || 'Hunter'),
        amount: Number(w.amount_usdt || 0).toFixed(2),
        currency: currencyLabel,
        address: maskedAddr,
        timestamp: dateObj.getTime(),
        date_iso: dateObj.toISOString(),
        date_str: dateObj.toISOString().split('T')[0], // YYYY-MM-DD
        time_str: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });

    res.json({ success: true, proofs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// PROMO CODE REDEMPTION ROUTE (User)
// ==========================================

app.post('/api/promo/redeem', authMiddleware, blockIfDeviceConflict, (req, res) => {
  try {
    const { code } = req.body;
    const result = db.redeemPromoCode(req.user.id, code);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// TIC-TAC-TOE GAME API ROUTES
// ==========================================

app.get('/api/game/tictactoe/session', authMiddleware, (req, res) => {
  try {
    const session = db.getTicTacToeSession(req.user.id);
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/game/tictactoe/start', authMiddleware, (req, res) => {
  try {
    const result = db.startTicTacToe(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/game/tictactoe/save', authMiddleware, (req, res) => {
  try {
    const { board, isPlayerTurn } = req.body;
    const session = db.updateTicTacToeSession(req.user.id, board, isPlayerTurn);
    res.json({ success: true, session });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/game/tictactoe/finish', authMiddleware, blockIfDeviceConflict, (req, res) => {
  try {
    const { result, board } = req.body;
    const outcome = db.finishTicTacToe(req.user.id, result, board);
    res.json({ success: true, ...outcome });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// LUCKY DRAW & GAME STATS API ROUTES
// ==========================================

app.get('/api/game/stats', authMiddleware, (req, res) => {
  try {
    const stats = db.getDailyGameStats(req.user.id);
    res.json({ success: true, ...stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/game/luckydraw/play', authMiddleware, blockIfDeviceConflict, (req, res) => {
  try {
    const outcome = db.playLuckyDraw(req.user.id);
    res.json({ success: true, ...outcome });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// REFERRAL ROUTES
// ==========================================

app.get('/api/referrals', authMiddleware, (req, res) => {
  try {
    const user = db.getUser(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const botUsername = 'treasure_hunt12_bot';
    const refLink = `https://t.me/${botUsername}/Play?startapp=ref_${user.id}`;
    const rate = db.data.settings.diamond_to_usd_rate || 0.00004;

    // Get list of friends referred by this user with milestone progress
    const referredFriends = Object.values(db.data.users || {})
      .filter(u => String(u.referrer_id) === String(user.id))
      .map(u => ({
        id: u.id,
        first_name: u.first_name || 'Hunter',
        username: u.username || '',
        photo_url: u.photo_url || '',
        step1_verified: !!u.referral_step1_claimed,
        step2_tasks: !!u.referral_step2_claimed,
        step3_ads: !!u.referral_step3_claimed,
        grand_prize: !!u.referral_grand_prize_claimed,
        joined_at: u.created_at
      }));

    res.json({
      success: true,
      totalReferrals: user.total_referrals || 0,
      referralEarningsDiamonds: user.referral_earnings_diamonds || 0,
      referralEarningsUsd: Number(((user.referral_earnings_diamonds || 0) * rate).toFixed(4)),
      commissionPercent: 10,
      referralLink: refLink,
      referredFriends,
      bonusRules: [
        {
          step: 1,
          title: 'Friend joins channel + community and verifies',
          rewardDiamonds: 30,
          rewardUsd: Number((30 * rate).toFixed(4))
        },
        {
          step: 2,
          title: 'Friend completes 5 tasks',
          rewardDiamonds: 100,
          rewardUsd: Number((100 * rate).toFixed(4))
        },
        {
          step: 3,
          title: 'Friend watches 20 ads',
          rewardDiamonds: 180,
          rewardUsd: Number((180 * rate).toFixed(4))
        }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ADMIN DASHBOARD ROUTES (Restricted to 5697990319)
// ==========================================

// Verify Bot admin status in a channel before adding task
app.post('/api/admin/verify-channel', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) return res.status(400).json({ success: false, error: 'Chat ID / Username is required' });

    const check = await verifyBotIsAdminInChat(chatId);
    if (!check.isAdmin) {
      return res.json({
        success: false,
        error: 'The Bot is NOT an administrator in this channel/group. Please make the bot an Admin with invite permissions first.'
      });
    }

    res.json({ success: true, message: 'Bot admin status verified successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add Task
app.post('/api/admin/tasks', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { category, type, title, description, link, chat_id, reward_diamonds, max_users } = req.body;

    if (!title || !link) {
      return res.status(400).json({ success: false, error: 'Title and Link are required' });
    }

    // Same server-side enforcement as the user Exclusive Task flow: a
    // Channel/Group task can only go live if the bot is genuinely an admin
    // there — regardless of whether "Verify Admin" was actually clicked in
    // the UI first. This is what stops a channel/group task from going
    // live broken (every user's Verify would fail) if it's ever posted
    // without the bot really having access.
    let resolvedChatId = (chat_id || '').trim();
    if (type === 'channel' || type === 'group') {
      if (!resolvedChatId) resolvedChatId = normalizeTelegramChatId(link);
      const check = await verifyBotIsAdminInChat(resolvedChatId);
      if (!check.isAdmin) {
        return res.status(400).json({
          success: false,
          error: 'Bot is not an administrator in this channel/group yet. Click "Verify Admin" after adding the bot as Admin before posting this task.'
        });
      }
    }

    const newTask = db.addTask({
      category,
      type,
      title,
      description,
      link,
      chat_id: resolvedChatId,
      // Social / Exclusive / Partner tasks always reward a fixed 10 GEMS,
      // regardless of whatever value the client sends — only the "Ads"
      // system (managed separately, powers the Daily tab) has a
      // per-ad configurable reward.
      reward_diamonds: 10,
      max_users
    });

    res.json({ success: true, task: newTask });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Task
app.delete('/api/admin/tasks/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    db.deleteTask(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get/Manage All Ads
app.get('/api/admin/ads', authMiddleware, adminMiddleware, (req, res) => {
  res.json({ success: true, ads: db.getAllAdsConfig() });
});

// Catalog of ad networks (name + logo) the admin can assign to any slot
app.get('/api/admin/ad-networks', authMiddleware, adminMiddleware, (req, res) => {
  res.json({ success: true, networks: db.getAdNetworks() });
});

app.patch('/api/admin/ads/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const updated = db.updateAdConfig(req.params.id, req.body);
    res.json({ success: true, ad: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Swap which ad network is shown in a given Daily slot. Only the
// name/logo/block_id change — the slot's reward/hidden/max_daily stay put.
app.post('/api/admin/ads/:id/network', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { networkId } = req.body;
    const updated = db.assignAdNetworkToSlot(req.params.id, networkId);
    res.json({ success: true, ad: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Save all ad configurations at once
app.post('/api/admin/ads/save-all', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { ads } = req.body;
    const updated = db.updateAllAdsConfig(ads);
    res.json({ success: true, ads: updated, message: 'All ad configurations saved successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// User Management
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { query } = req.query;
    let list = Object.values(db.data.users);

    if (query) {
      const q = query.toLowerCase().trim();
      list = list.filter(u =>
        String(u.id || '').toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.first_name && u.first_name.toLowerCase().includes(q)) ||
        (u.last_name && u.last_name.toLowerCase().includes(q))
      );
    }

    res.json({ success: true, users: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/users/balance', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { userId, type, amount, action } = req.body;
    const user = db.getUser(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const val = Number(amount);
    if (isNaN(val) || val <= 0) return res.status(400).json({ success: false, error: 'Invalid amount' });

    if (type === 'diamonds') {
      if (action === 'add') user.diamonds += Math.floor(val);
      if (action === 'deduct') user.diamonds = Math.max(0, user.diamonds - Math.floor(val));
    } else if (type === 'usdt') {
      if (action === 'add') user.usdt = Number((user.usdt + val).toFixed(4));
      if (action === 'deduct') user.usdt = Math.max(0, Number((user.usdt - val).toFixed(4)));
    }

    db.save();
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/users/wallet', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { userId, network, walletAddress } = req.body;
    const user = db.adminUpdateUserWallet(userId, network, walletAddress);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Manage Withdrawals (Enriched with user info, UID, timestamps & equivalent diamonds)
app.get('/api/admin/withdrawals', authMiddleware, adminMiddleware, (req, res) => {
  const rate = db.data.settings?.diamond_to_usd_rate || 0.00004;
  const withdrawals = db.getWithdrawals().map(w => {
    const user = db.getUser(w.user_id);
    const amountUsdt = Number(w.amount_usdt) || 0;
    const amountDiamonds = w.amount_diamonds || Math.round(amountUsdt / rate);
    return {
      ...w,
      username: user?.username ? `@${user.username}` : (w.username ? `@${w.username}` : 'Hunter'),
      name: user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : 'Hunter',
      uid: w.user_id,
      amount_diamonds: amountDiamonds,
      timestamp: w.created_at || w.timestamp || new Date().toISOString()
    };
  });
  res.json({ success: true, withdrawals });
});

app.patch('/api/admin/withdrawals/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    const updated = db.updateWithdrawalStatus(req.params.id, status);

    // If approved, immediately post to official payment proof channel & notify user
    if (status === 'approved') {
      const user = db.getUser(updated.user_id);
      postWithdrawalProofToChannel(updated, user).catch(err => {
        console.error('Error posting withdrawal proof to channel:', err.message);
      });

      if (bot && bot.telegram && updated.user_id) {
        const amount = Number(updated.amount_usdt || 0).toFixed(2);
        bot.telegram.sendMessage(
          updated.user_id,
          `🎉 <b>Withdrawal Approved & Sent!</b>\n\nYour withdrawal request for <b>$${amount} USDT</b> has been verified and processed.\n\nReceipt posted on @treasure_pay! Thank you for playing Treasure Hunt!`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }

    res.json({ success: true, withdrawal: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin User Balance Adjustment (+ / - Diamonds, USDT, Keys)
app.post('/api/admin/user/balance-adjust', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { userId, type, amount, action } = req.body;
    const user = db.adminAdjustBalance(userId, { type, amount, action });
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin Send Gift with Custom Note
app.post('/api/admin/user/gift', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { userId, type, amount, note } = req.body;
    const result = db.adminSendGift(userId, { type, amount, note });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// User claims a pending gift from the popup — this is the only moment the
// reward is actually credited to their balance.
app.post('/api/gift/claim', authMiddleware, blockIfDeviceConflict, (req, res) => {
  try {
    const { giftId } = req.body;
    if (!giftId) return res.status(400).json({ success: false, error: 'giftId is required' });
    const result = db.claimGift(req.user.id, giftId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin Weekly Contest Reset
app.post('/api/admin/contest/reset', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const contest = db.resetWeeklyContest();
    res.json({ success: true, contest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// REFERRAL LEADERBOARD & CONTEST ROUTES
// ==========================================
app.get('/api/referral/leaderboard', authMiddleware, (req, res) => {
  try {
    const leaderboards = db.getReferralLeaderboards();
    res.json({ success: true, ...leaderboards });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/referral/weekly-contest', authMiddleware, (req, res) => {
  try {
    const contest = db.getWeeklyContest();
    res.json({ success: true, contest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ANTI-CHEAT DEVICE LOCK ROUTES
// ==========================================
app.post('/api/user/device-check', authMiddleware, (req, res) => {
  try {
    const { deviceId } = req.body;
    const check = db.checkDeviceLock(req.user.id, deviceId);
    res.json({ success: true, ...check });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/device-switch', authMiddleware, (req, res) => {
  try {
    const { deviceId } = req.body;
    const user = db.switchAccountResetBalance(req.user.id, deviceId);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/user/ip-switch', authMiddleware, (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || null;
    const user = db.switchIpAccountResetBalance(req.user.id, ip);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin Promo Codes Management
app.get('/api/admin/promo', authMiddleware, adminMiddleware, (req, res) => {
  res.json({ success: true, promoCodes: db.getPromoCodes() });
});

app.post('/api/admin/promo', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { code, reward_type, reward_amount, max_uses } = req.body;
    if (!code || !reward_amount) {
      return res.status(400).json({ success: false, error: 'Code and reward amount are required' });
    }
    const promo = db.createPromoCode({
      code,
      reward_type,
      reward_amount,
      max_uses
    });

    // 1. Enqueue broadcast for all bot users (processed smoothly via cron / batches)
    try {
      db.enqueuePromoBroadcast(promo);
    } catch (e) {
      console.error('Failed to enqueue promo broadcast:', e);
    }

    // 2. Post promo code announcement with branded photo banner to official channel
    postPromoCodeToChannel(promo).catch(e => {
      console.error('Channel promo broadcast error:', e);
    });

    // 3. Kick off immediate batch for prompt delivery
    processBroadcastQueue(35).catch(e => {
      console.error('Immediate broadcast batch error:', e);
    });

    res.json({ success: true, promo });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/promo/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    db.deletePromoCode(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Broadcast Message
app.post('/api/admin/broadcast', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty' });
    }

    const result = await broadcastToUsers(message.trim());
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// MANDATORY COMMUNITY GATE ROUTES
// ==========================================

app.get('/api/mandatory-channels/status', authMiddleware, (req, res) => {
  try {
    const status = db.getMandatoryChannelsStatus(req.user.id);
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/mandatory-channels/verify', authMiddleware, blockIfDeviceConflict, async (req, res) => {
  try {
    const { visited = {} } = req.body;
    const userId = req.user.id;
    const currentStatus = db.getMandatoryChannelsStatus(userId);
    const verifiedMap = {};

    for (const ch of currentStatus.channels) {
      if (ch.isJoined) {
        verifiedMap[ch.id] = true;
        continue;
      }

      // Check membership via Telegram Bot if active
      const check = await verifyUserChannelMembership(ch.chat_id, userId);
      if (check.verified) {
        verifiedMap[ch.id] = true;
      } else if (check.isSimulation && visited[ch.id]) {
        // In local dev simulation mode, mark verified if user visited and confirmed
        verifiedMap[ch.id] = true;
      }
    }

    const updated = db.verifyMandatoryChannels(userId, verifiedMap);
    res.json({
      success: true,
      ...updated,
      user: db.getUser(userId)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Continuous 1-minute Fallback TON Scanner (runs in background)
setInterval(() => {
  verifyPendingTonPayments().catch(err => {
    console.warn('Background TON check error:', err.message);
  });
}, 60000);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`⚔️ Treasure Hunt Backend Server running on port ${PORT}`);
  });
}

export default app;
