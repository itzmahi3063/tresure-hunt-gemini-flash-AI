import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { db } from './db.js';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_ID = String(process.env.ADMIN_ID || '7780774047');
const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:5173';

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

      const welcomeText = `🏴‍☠️ *Welcome to Treasure Hunt, ${from.first_name || 'Hunter'}!* 💎\n\n` +
        `Open daily chests, complete tasks, invite friends and earn real *Diamonds* & *USDT*!\n\n` +
        `💰 *1 Diamond = $0.00004 USD*\n` +
        `👥 *Earn 10% Lifetime Commission on all referral withdrawals!*\n\n` +
        `Tap the button below to start your adventure:`;

      await ctx.replyWithMarkdown(
        welcomeText,
        Markup.inlineKeyboard([
          [Markup.button.webApp('💎 Open Treasure Hunt', WEBAPP_URL)],
          [Markup.button.url('📢 Join Official Channel', 'https://t.me/TreasureHuntCommunity')]
        ])
      );
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

    // Launch Bot in long polling mode
    bot.launch().then(() => {
      console.log('🤖 Telegram Bot started successfully!');
    }).catch(err => {
      console.error('Error starting Telegram Bot:', err.message);
    });
  } catch (err) {
    console.error('Bot initialization failed:', err);
  }
} else {
  console.log('⚠️ BOT_TOKEN not provided in .env yet. Running in API server mode.');
}

/**
 * Verify if a user is a member of a Telegram channel/group
 */
export async function verifyUserChannelMembership(chatId, userId) {
  if (!bot || !bot.telegram) {
    // If bot token not active in local dev, allow simulation
    return { verified: true, isSimulation: true };
  }

  try {
    const member = await bot.telegram.getChatMember(chatId, userId);
    const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
    const isMember = validStatuses.includes(member.status);
    return { verified: isMember, status: member.status };
  } catch (err) {
    console.error(`Error checking membership for user ${userId} in ${chatId}:`, err.message);
    return {
      verified: false,
      error: 'Bot must be an administrator in the channel/group to verify members'
    };
  }
}

/**
 * Verify if Bot is an Admin in a given channel/group
 */
export async function verifyBotIsAdminInChat(chatId) {
  if (!bot || !bot.telegram) return { isAdmin: true, isSimulation: true };

  try {
    const me = await bot.telegram.getMe();
    const chatMember = await bot.telegram.getChatMember(chatId, me.id);
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
