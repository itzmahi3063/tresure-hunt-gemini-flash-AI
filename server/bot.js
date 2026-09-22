import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_ID = String(process.env.ADMIN_ID || '7780774047');
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://tresure-hunt-gemini-flash-ai.vercel.app';

export let bot = null;

if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
  try {
    bot = new Telegraf(BOT_TOKEN);

    // /start command with referral support
    bot.start(async (ctx) => {
      const from = ctx.from;
      const payload = ctx.startPayload; // e.g. ref_12345
      let referrerId = null;

      if (payload && payload.startsWith('ref_')) {
        referrerId = payload.replace('ref_', '');
      }

      // Initialize user in database
      const user = db.getOrCreateUser(from, referrerId);

      let appUrl = WEBAPP_URL;
      if (payload && payload.startsWith('ref_')) {
        appUrl = `${WEBAPP_URL}?startapp=${payload}`;
      }

      const captionText =
        `*Welcome to TREASURE HUNT!*\n\n` +
        `Earn free crypto (GEMS → TON/USDT) by watching videos — no investment required! 💰\n\n` +
        `⚠️ Joining our official channel and community is required before you can start.`;

      const bannerPath = path.join(__dirname, '../public/welcome_banner.webp');
      const bannerUrl = `${WEBAPP_URL}/welcome_banner.webp`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.url('📢 Official Channel', 'https://t.me/treasure_hunt_12'),
          Markup.button.url('💬 Community', 'https://t.me/treasure_hunt12')
        ],
        [
          Markup.button.webApp('🏴‍☠️ Hunt', appUrl)
        ]
      ]);

      try {
        if (fs.existsSync(bannerPath)) {
          await ctx.replyWithPhoto(
            { source: bannerPath },
            { caption: captionText, parse_mode: 'Markdown', ...keyboard }
          );
        } else {
          await ctx.replyWithPhoto(
            bannerUrl,
            { caption: captionText, parse_mode: 'Markdown', ...keyboard }
          );
        }
      } catch (err) {
        console.warn('Could not send banner photo, falling back to text:', err.message);
        await ctx.replyWithMarkdown(captionText, keyboard);
      }
    });

    // /admin command - STRICTLY RESTRICTED TO ADMIN_ID
    bot.command('admin', async (ctx) => {
      const fromId = String(ctx.from.id);

      // If user is not the designated admin, DO NOTHING
      if (fromId !== ADMIN_ID) {
        return;
      }

      const totalUsers = Object.keys(db.data.users).length;
      const totalTasks = db.data.tasks.length;
      const pendingWd = db.data.withdrawals.filter(w => w.status === 'pending').length;

      const adminText = `👑 *Treasure Hunt Admin Control Panel*\n\n` +
        `👥 *Total Users:* ${totalUsers}\n` +
        `📋 *Total Tasks:* ${totalTasks}\n` +
        `⏳ *Pending Withdrawals:* ${pendingWd}\n\n` +
        `Tap below to open the full Web Admin Dashboard:`;

      await ctx.replyWithMarkdown(
        adminText,
        Markup.inlineKeyboard([
          [Markup.button.webApp('⚙️ Open Web Admin Dashboard', `${WEBAPP_URL}?admin=true`)],
          [
            Markup.button.callback('📊 Quick Stats', 'admin_stats'),
            Markup.button.callback('⏳ Withdrawals', 'admin_withdrawals')
          ]
        ])
      );
    });

    // Admin Quick Callbacks
    bot.action('admin_stats', async (ctx) => {
      if (String(ctx.from.id) !== ADMIN_ID) return;
      const users = Object.values(db.data.users);
      const totalDiamonds = users.reduce((acc, u) => acc + (u.diamonds || 0), 0);
      const totalUsdt = users.reduce((acc, u) => acc + (u.usdt || 0), 0);

      await ctx.answerCbQuery();
      await ctx.replyWithMarkdown(
        `📊 *System Statistics:*\n\n` +
        `• Total Registered Users: *${users.length}*\n` +
        `• Circulating Diamonds: *${totalDiamonds.toLocaleString()}*\n` +
        `• Total USDT Balance: *$${totalUsdt.toFixed(4)}*`
      );
    });

    bot.action('admin_withdrawals', async (ctx) => {
      if (String(ctx.from.id) !== ADMIN_ID) return;
      const pending = db.data.withdrawals.filter(w => w.status === 'pending');
      await ctx.answerCbQuery();

      if (pending.length === 0) {
        return ctx.reply('✅ No pending withdrawals at this moment.');
      }

      let msg = `⏳ *Pending Withdrawals (${pending.length}):*\n\n`;
      pending.slice(0, 5).forEach((w, i) => {
        msg += `${i + 1}. User: \`${w.user_id}\` | Amount: *$${w.amount_usdt} USDT* (${w.network})\nAddress: \`${w.wallet_address}\`\n\n`;
      });
      ctx.replyWithMarkdown(msg);
    });

    // Launch Bot in long polling mode if not in serverless environment
    if (!process.env.VERCEL) {
      bot.launch().then(() => {
        console.log('🤖 Telegram Bot started successfully (Long Polling)!');
      }).catch(err => {
        console.error('Error starting Telegram Bot:', err.message);
      });
    } else {
      console.log('⚡ Running in Vercel Serverless Webhook mode.');
    }
  } catch (err) {
    console.error('Bot initialization failed:', err);
  }
} else {
  console.log('⚠️ BOT_TOKEN not provided in .env yet. Running in API server mode.');
}

/**
 * Normalize a raw Telegram channel/group link, @username, or numeric chat id
 * into the format Telegram's Bot API expects (@username or numeric ID).
 */
export function normalizeTelegramChatId(usernameOrLink) {
  let clean = (usernameOrLink || '').trim();
  if (!clean) return '';
  let chatId = clean;
  if (/(?:t\.me|telegram\.me)\//i.test(clean)) {
    const match = clean.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/i);
    if (match && match[1]) {
      chatId = '@' + match[1];
    }
  } else if (!chatId.startsWith('@') && !chatId.startsWith('-100') && !/^\d+$/.test(chatId)) {
    chatId = '@' + chatId;
  }
  return chatId;
}

/**
 * Verify if a user is a member of a Telegram channel/group
 */
export async function verifyUserChannelMembership(chatId, userId) {
  if (!bot || !bot.telegram) {
    console.warn('Bot instance not available for verifyUserChannelMembership');
    return { verified: false, error: 'Telegram Bot service is not available to verify membership' };
  }

  const cleanChatId = normalizeTelegramChatId(chatId);
  if (!cleanChatId) {
    return { verified: false, error: 'Invalid channel or group link/username' };
  }

  try {
    const member = await bot.telegram.getChatMember(cleanChatId, userId);
    const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
    const isMember = validStatuses.includes(member.status);
    if (!isMember) {
      return {
        verified: false,
        error: 'You have not joined the channel/group yet! Please join first, then tap Verify.'
      };
    }
    return { verified: true, status: member.status };
  } catch (err) {
    console.error(`Error checking membership for user ${userId} in ${cleanChatId}:`, err.message);
    const msg = err.message || '';
    if (msg.includes('user not found') || msg.includes('not a member') || msg.includes('PARTICIPANT_ID_INVALID')) {
      return {
        verified: false,
        error: 'You have not joined the channel/group yet! Please join first, then tap Verify.'
      };
    }
    return {
      verified: false,
      error: 'You have not joined the channel/group yet! Please join first, then tap Verify. (Ensure the Bot is an Admin in the channel)'
    };
  }
}

/**
 * Verify if Bot is an Admin in a given channel/group
 */
export async function verifyBotIsAdminInChat(chatId) {
  if (!bot || !bot.telegram) return { isAdmin: false, error: 'Telegram Bot is not initialized' };

  const cleanChatId = normalizeTelegramChatId(chatId);
  if (!cleanChatId) return { isAdmin: false, error: 'Invalid channel or group identifier' };

  try {
    const me = await bot.telegram.getMe();
    const chatMember = await bot.telegram.getChatMember(cleanChatId, me.id);
    const isAdmin = chatMember.status === 'administrator' || chatMember.status === 'creator';
    return { isAdmin };
  } catch (err) {
    return { isAdmin: false, error: err.message };
  }
}

/**
 * Broadcast message to all bot users
 */
export async function broadcastToUsers(messageText) {
  if (!bot || !bot.telegram) return { total: 0, sent: 0, isSimulation: true };

  const userIds = Object.keys(db.data.users);
  let sentCount = 0;

  for (const uid of userIds) {
    try {
      await bot.telegram.sendMessage(uid, messageText, { parse_mode: 'Markdown' });
      sentCount++;
      // Sleep slightly to avoid Telegram rate limits
      await new Promise(r => setTimeout(r, 40));
    } catch (err) {
      console.warn(`Failed to send broadcast to ${uid}:`, err.message);
    }
  }

  return { total: userIds.length, sent: sentCount };
}

/**
 * Post withdrawal proof to the official channel (@treasure_pay)
 * with a high-definition branded banner and safe HTML text formatting
 */
export async function postWithdrawalProofToChannel(withdrawal, user) {
  if (!bot || !bot.telegram) {
    console.warn('Bot instance not ready for channel posting');
    return false;
  }

  const channelId = process.env.PAYMENT_CHANNEL || '@treasure_pay';
  const webappUrl = (process.env.WEBAPP_URL || 'https://tresure-hunt-gemini-flash-ai.vercel.app').replace(/\/$/, '');
  const bannerUrl = `${webappUrl}/payment_proof_banner.webp`;

  // Safe HTML Escaping (prevents < > & from breaking HTML)
  const escapeHtml = (str) => {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  // Mask address: First 3 and last 3 letters, asterisks in middle: UXA*****YAD
  const maskAddress = (addr) => {
    if (!addr || typeof addr !== 'string') return '***';
    const clean = addr.trim();
    if (clean.length <= 6) return clean;
    const first3 = clean.slice(0, 3);
    const last3 = clean.slice(-3);
    return `${first3}*****${last3}`;
  };

  const rawUsername = user?.username ? `@${user.username}` : (user?.first_name || 'Hunter');
  const safeUsername = escapeHtml(rawUsername);
  const safeUid = escapeHtml(String(user?.id || withdrawal?.user_id || ''));
  const amount = Number(withdrawal.amount_usdt || 0).toFixed(2);

  let currencyLabel = 'USDT';
  const network = (withdrawal.network || '').toUpperCase();
  if (network.includes('TON')) {
    currencyLabel = 'TON (Tonkeeper)';
  } else if (network.includes('BINANCE')) {
    currencyLabel = 'USDT (Binance Pay)';
  } else {
    currencyLabel = `${escapeHtml(withdrawal.network || 'USDT')}`;
  }

  const maskedAddress = maskAddress(String(withdrawal.wallet_address || ''));
  const safeMaskedAddress = escapeHtml(maskedAddress);

  // Exact structure requested by user:
  // withdraw successful
  // username: @user (UID: 12345)
  // withdraw amount: $X.XX (tonkeeper)
  // address: UXA*****YAD
  const caption =
    `🎉 <b>Withdrawal Successful</b>\n\n` +
    `👤 <b>Username:</b> ${safeUsername} (${safeUid})\n` +
    `💰 <b>Withdraw Amount:</b> $${amount} (${currencyLabel})\n` +
    `📍 <b>Address:</b> <code>${safeMaskedAddress}</code>\n\n` +
    `💎 <i>Treasure Hunt Official Verified Payout</i>`;

  // Direct attempt: send photo banner with caption using HTML parse mode (immune to _ and / parsing errors!)
  try {
    await bot.telegram.sendPhoto(channelId, bannerUrl, {
      caption,
      parse_mode: 'HTML'
    });
    console.log(`✅ Payout proof photo posted to ${channelId} for UID ${safeUid}`);
    return true;
  } catch (photoErr) {
    console.warn('sendPhoto via URL failed, attempting direct text fallback:', photoErr.message);
    try {
      await bot.telegram.sendMessage(channelId, caption, {
        parse_mode: 'HTML'
      });
      console.log(`✅ Payout proof text fallback posted to ${channelId} for UID ${safeUid}`);
      return true;
    } catch (msgErr) {
      console.error('Failed to post payment proof to channel:', msgErr.message);
      return false;
    }
  }
}

/**
 * Post official promo code announcement to Telegram channel with branded banner
 */
export async function postPromoCodeToChannel(promo) {
  if (!bot || !bot.telegram) {
    console.warn('Bot instance not available for posting promo to channel');
    return false;
  }

  const channelId = process.env.PROMO_CHANNEL || process.env.PAYMENT_CHANNEL || '@treasure_hunt_12';
  const webappUrl = (process.env.WEBAPP_URL || 'https://tresure-hunt-gemini-flash-ai.vercel.app').replace(/\/$/, '');
  const bannerUrl = `${webappUrl}/promo_code_banner.webp`;

  const code = String(promo.code || '').trim().toUpperCase();
  const amount = promo.reward_amount || 20;

  // Exact requested format:
  // Get received ✅
  // Promo : 99821 I GEMS = 20
  //
  // CLAIM NOW
  //
  // Bot 👉👉👉 https://t.me/treasure_hunt12_bot/Play?startapp=ref_7780774047
  //
  // GO TO THE BOT & CLAIM YOUR REWARDS✅
  const caption =
    `Get received ✅\n` +
    `Promo : <code>${code}</code> I GEMS = ${amount}\n\n` +
    `CLAIM NOW\n\n` +
    `Bot 👉👉👉 https://t.me/treasure_hunt12_bot/Play?startapp=ref_7780774047\n\n` +
    `GO TO THE BOT & CLAIM YOUR REWARDS✅`;

  try {
    await bot.telegram.sendPhoto(channelId, bannerUrl, {
      caption,
      parse_mode: 'HTML'
    });
    console.log(`📢 Promo code ${code} posted to channel ${channelId}`);
    return true;
  } catch (err) {
    console.warn('sendPhoto failed for promo, trying sendMessage:', err.message);
    try {
      await bot.telegram.sendMessage(channelId, caption, { parse_mode: 'HTML' });
      return true;
    } catch (e) {
      console.error('Failed to post promo to channel:', e.message);
      return false;
    }
  }
}

/**
 * Process a batch of broadcast messages from persistent queue in db
 * Handles 20k-30k users safely across multiple cron runs without timing out
 */
export async function processBroadcastQueue(batchSize = 75, maxDurationMs = 7000) {
  if (!bot || !bot.telegram) return { processed: 0, reason: 'bot_not_ready' };

  const job = db.getNextBroadcastJob();
  if (!job || !job.remaining_user_ids || job.remaining_user_ids.length === 0) {
    return { processed: 0, reason: 'no_pending_jobs' };
  }

  if (!job.sent_user_ids) job.sent_user_ids = [];
  job.remaining_user_ids = job.remaining_user_ids.filter(uid => !job.sent_user_ids.includes(String(uid)));
  const batch = job.remaining_user_ids.splice(0, batchSize);
  const isDailyReset = job.type === 'daily_reset';
  const webappUrl = (process.env.WEBAPP_URL || 'https://tresure-hunt-gemini-flash-ai.vercel.app').replace(/\/$/, '');
  const dailyBannerUrl = `${webappUrl}/daily_reset_banner.webp`;

  let messageText = '';
  let keyboard = null;

  if (isDailyReset) {
    messageText =
      `⚡ <b>DAILY QUESTS RELOADED!</b> 🏴‍☠️\n\n` +
      `💎 <b>New Day, New Rewards — Everything is Fresh!</b>\n\n` +
      `🔥 <b>Ready for You Today:</b>\n` +
      `🎁 <b>Daily Check-in:</b> Claim your streak reward & Keys!\n` +
      `📺 <b>Video Ads:</b> 40+ high-reward ads are ready to watch!\n` +
      `🎲 <b>Lucky Draw:</b> 10 fresh spins waiting for Jackpots!\n` +
      `🎮 <b>Tic-Tac-Toe:</b> 10 games reloaded — test your skills!\n` +
      `🗝️ <b>Treasure Chest:</b> Use your keys to win USDT!\n\n` +
      `🚀 <i>Tap the button below and start hunting right now!</i>`;

    keyboard = {
      inline_keyboard: [
        [
          {
            text: '🏴‍☠️ HUNT',
            url: 'https://t.me/treasure_hunt12_bot/Play'
          }
        ]
      ]
    };
  } else {
    const code = String(job.promo_code || '').trim().toUpperCase();
    const amount = job.amount || 20;
    const unit = (job.reward_type || 'diamonds') === 'usdt' ? 'USDT' : 'GEMS';

    messageText =
      `🎉 <b>Congratulations!</b> 🎉\n\n` +
      `You have received <b>${amount} ${unit}</b> ✅🎁\n\n` +
      `🔴 Redeem Code: <code>${code}</code>\n` +
      `📌 <i>Tap the code to copy it instantly.</i>\n\n` +
      `Don't miss it! 🚀`;

    keyboard = {
      inline_keyboard: [
        [
          {
            text: '🎁 Claim Promo Code',
            url: `https://t.me/treasure_hunt12_bot/Play?startapp=promo_${encodeURIComponent(code)}`
          }
        ]
      ]
    };
  }

  let sentThisBatch = 0;
  let failedThisBatch = 0;
  const startTime = Date.now();
  const unhandled = [];

  const sendToUser = async (uid) => {
    if (isDailyReset) {
      try {
        return await bot.telegram.sendPhoto(uid, dailyBannerUrl, {
          caption: messageText,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
      } catch (photoErr) {
        return await bot.telegram.sendMessage(uid, messageText, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
      }
    } else {
      return await bot.telegram.sendMessage(uid, messageText, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    }
  };

  const CHUNK_SIZE = 3;
  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    // Safety guard: stop before serverless function timeout
    if (Date.now() - startTime > maxDurationMs) {
      unhandled.push(...batch.slice(i));
      break;
    }

    const chunk = batch.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(chunk.map(uid => sendToUser(uid)));

    let rateLimited = false;
    for (let j = 0; j < results.length; j++) {
      const res = results[j];
      const uid = chunk[j];

      if (res.status === 'fulfilled') {
        job.sent_count = (job.sent_count || 0) + 1;
        sentThisBatch++;
        if (!job.sent_user_ids.includes(String(uid))) {
          job.sent_user_ids.push(String(uid));
        }
      } else {
        const err = res.reason;
        console.error(`Telegram send failed to ${uid}:`, err?.message, err?.response?.description || '');

        if (err?.response?.error_code === 429) {
          console.warn('Telegram rate limit 429 hit, preserving remaining queue for next cron');
          rateLimited = true;
          unhandled.push(...chunk.slice(j), ...batch.slice(i + CHUNK_SIZE));
          break;
        }

        // Fallback without keyboard
        if (err?.message && (err.message.includes('BUTTON') || err.message.includes('reply_markup') || err.message.includes('entities') || err.message.includes('wrong URL'))) {
          try {
            await bot.telegram.sendMessage(uid, messageText, { parse_mode: 'HTML' });
            job.sent_count = (job.sent_count || 0) + 1;
            sentThisBatch++;
            continue;
          } catch (fallbackErr) {
            console.error(`Fallback send also failed to ${uid}:`, fallbackErr.message);
          }
        }

        job.failed_count = (job.failed_count || 0) + 1;
        failedThisBatch++;
      }
    }

    if (rateLimited) break;

    // Small delay between chunks to strictly respect Telegram 30 msg/sec rate limit
    await new Promise(r => setTimeout(r, 110));
  }

  // Put any unhandled users back at the front of the queue
  if (unhandled.length > 0) {
    job.remaining_user_ids.unshift(...unhandled);
  }

  // Release lock so subsequent batches can proceed
  job.locked_until = null;

  if (job.remaining_user_ids.length === 0) {
    job.status = 'completed';
    job.completed_at = new Date().toISOString();
    console.log(`🎉 Broadcast job ${job.id} (${job.type || 'promo'}) fully completed! Total sent: ${job.sent_count}, failed: ${job.failed_count}`);
  }

  db.save();
  await db.flush();

  return {
    jobId: job.id,
    remainingUsers: job.remaining_user_ids.length,
    sentThisBatch,
    failedThisBatch,
    totalSent: job.sent_count,
    remaining: job.remaining_user_ids.length,
    status: job.status
  };
}

