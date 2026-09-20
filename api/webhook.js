export default async function handler(req, res) {
  try {
    const rawToken = process.env.BOT_TOKEN || '';
    const token = rawToken.trim();
    const adminId = String(process.env.ADMIN_ID || '7780774047').trim();
    const webappUrl = (process.env.WEBAPP_URL || 'https://tresure-hunt-gemini-flash-ai.vercel.app').trim();
    const webhookSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '').trim();

    if (req.method === 'GET') {
      if (!token) {
        return res.status(200).json({
          status: 'warning',
          message: 'BOT_TOKEN is not configured.'
        });
      }

      const host = req.headers['x-forwarded-host'] || req.headers.host || 'tresure-hunt-gemini-flash-ai.vercel.app';
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const webhookUrl = `${proto}://${host}/api/webhook`;

      // Set Webhook and drop any stuck/backlogged updates (include secret_token if configured)
      let tgUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`;
      if (webhookSecret) {
        tgUrl += `&secret_token=${encodeURIComponent(webhookSecret)}`;
      }
      const tgRes = await fetch(tgUrl);
      const tgData = await tgRes.json();

      return res.status(200).json({
        status: 'ok',
        webhookUrl,
        secretConfigured: Boolean(webhookSecret),
        telegram: tgData
      });
    }

    if (req.method === 'POST') {
      // Validate Telegram secret_token header if secret is configured
      if (webhookSecret) {
        const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
        if (incomingSecret !== webhookSecret) {
          console.warn('⚠️ Rejected Telegram Webhook: missing or invalid secret token');
          return res.status(401).json({ ok: false, error: 'Unauthorized: invalid secret token' });
        }
      }

      const update = req.body || {};

      // Handle Callback Queries
      if (update.callback_query) {
        try {
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: update.callback_query.id })
          });
        } catch (e) {}
        return res.status(200).json({ ok: true });
      }

      const message = update.message;
      if (!message || !message.text) {
        return res.status(200).json({ ok: true });
      }

      const chatId = message.chat.id;
      const fromId = String(message.from?.id || '').trim();
      const text = message.text.trim();

      // 1. /admin command - STRICTLY RESTRICTED TO ADMIN_ID
      if (text === '/admin' || text.startsWith('/admin')) {
        // If not the authorized admin UID, stay completely silent
        if (fromId !== adminId && fromId !== '7780774047') {
          return res.status(200).json({ ok: true, silent: true });
        }

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `?? *Treasure Hunt Admin Control Panel*\n\nVerified Admin UID: \`${adminId}\`\n\nTap below to open your Web Admin Panel:`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '?? Open Web Admin Dashboard', web_app: { url: `${webappUrl}?admin=true` } }]
              ]
            }
          })
        });

        return res.status(200).json({ ok: true, admin: true });
      }

      // 2. /start command
      if (text === '/start' || text.startsWith('/start')) {
        let appUrl = webappUrl;
        const parts = text.split(' ');
        if (parts.length > 1 && parts[1].startsWith('ref_')) {
          appUrl = `${webappUrl}?startapp=${parts[1]}`;
        }

        const bannerUrl = `${webappUrl}/welcome_banner.jpg`;
        const captionText =
          `*Welcome to TREASURE HUNT!*\n\n` +
          `Earn free crypto (GEMS → TON/USDT) by watching videos — no investment required! 💰\n\n` +
          `⚠️ Joining our official channel and community is required before you can start.`;

        const reply_markup = {
          inline_keyboard: [
            [
              { text: '📢 Official Channel', url: 'https://t.me/treasure_hunt_12' },
              { text: '💬 Community', url: 'https://t.me/treasure_hunt12' }
            ],
            [
              { text: '🏴‍☠️ Hunt', web_app: { url: appUrl } }
            ]
          ]
        };

        try {
          const photoRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              photo: bannerUrl,
              caption: captionText,
              parse_mode: 'Markdown',
              reply_markup
            })
          });
          const photoData = await photoRes.json();
          if (!photoData.ok) {
            console.warn('sendPhoto failed, falling back to sendMessage:', photoData.description);
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: captionText,
                parse_mode: 'Markdown',
                reply_markup
              })
            });
          }
        } catch (e) {
          console.error('Error sending start message:', e);
        }

        return res.status(200).json({ ok: true, start: true });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({
      status: 'error',
      message: err.message
    });
  }
}
