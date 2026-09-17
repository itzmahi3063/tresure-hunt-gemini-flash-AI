export default async function handler(req, res) {
  try {
    const rawToken = process.env.BOT_TOKEN || '';
    const token = rawToken.trim();
    const adminId = String(process.env.ADMIN_ID || '7780774047').trim();
    const webappUrl = (process.env.WEBAPP_URL || 'https://tresure-hunt-gemini-flash-ai.vercel.app').trim();

    if (req.method === 'GET') {
      if (!token) {
        return res.status(200).json({
          status: 'warning',
          message: 'BOT_TOKEN is not configured in Vercel Environment Variables.'
        });
      }

      const host = req.headers['x-forwarded-host'] || req.headers.host || 'tresure-hunt-gemini-flash-ai.vercel.app';
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const webhookUrl = `${proto}://${host}/api/webhook`;

      const tgUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
      const tgRes = await fetch(tgUrl);
      const tgData = await tgRes.json();

      return res.status(200).json({
        status: 'ok',
        webhookUrl,
        telegram: tgData
      });
    }

    if (req.method === 'POST') {
      const update = req.body || {};
      const message = update.message;

      if (!message || !message.text) {
        return res.status(200).json({ ok: true });
      }

      const chatId = message.chat.id;
      const fromId = String(message.from?.id || '');
      const text = message.text.trim();

      // 1. /admin command - STRICTLY CONFIDENTIAL TO ADMIN_ID
      if (text === '/admin') {
        if (fromId !== adminId) {
          // Stay 100% silent for any other user
          return res.status(200).json({ ok: true, silent: true });
        }

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `👑 *Treasure Hunt Admin Control Panel*\n\nVerified Admin UID: \`${adminId}\`\n\nTap below to open your Web Admin Panel:`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⚙️ Open Web Admin Dashboard', web_app: { url: `${webappUrl}?admin=true` } }]
              ]
            }
          })
        });

        return res.status(200).json({ ok: true, admin: true });
      }

      // 2. /start command
      if (text.startsWith('/start')) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🏴‍☠️ *Welcome to Treasure Hunt, ${message.from?.first_name || 'Hunter'}!* 💎\n\nOpen daily chests, complete tasks, invite friends and earn real *Diamonds* & *USDT*!\n\n💰 *1 Diamond = $0.00004 USD*\n👥 *Earn 10% Lifetime Commission!*\n\nTap the button below to start your adventure:`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💎 Open Treasure Hunt', web_app: { url: webappUrl } }]
              ]
            }
          })
        });

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
