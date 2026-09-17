export default async function handler(req, res) {
  const token = process.env.BOT_TOKEN;
  const adminId = String(process.env.ADMIN_ID || '7780774047');
  const webappUrl = process.env.WEBAPP_URL || 'https://tresure-hunt-gemini-flash-ai.vercel.app';

  if (req.method === 'GET') {
    if (!token) {
      return res.status(200).json({
        status: 'warning',
        message: 'BOT_TOKEN is not configured in Vercel Environment Variables yet. Please add BOT_TOKEN in Vercel Project Settings.'
      });
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const currentWebhook = ${proto}://System.Management.Automation.Internal.Host.InternalHost/api/webhook;

    try {
      const resp = await fetch(https://api.telegram.org/bot/setWebhook?url=);
      const data = await resp.json();
      return res.status(200).json({
        status: 'success',
        webhookUrl: currentWebhook,
        telegramResponse: data
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const update = req.body;
    if (!update || !token) {
      return res.status(200).send('OK');
    }

    const message = update.message;
    if (!message || !message.text) {
      return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    const fromId = String(message.from?.id || '');
    const text = message.text.trim();

    // 1. /admin command - STRICTLY RESTRICTED TO ADMIN_ID
    if (text === '/admin') {
      // If not the authorized admin, stay completely silent
      if (fromId !== adminId) {
        return res.status(200).send('OK');
      }

      await fetch(https://api.telegram.org/bot/sendMessage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: ?? *Treasure Hunt Admin Control Panel*\n\nVerified Admin UID: \${adminId}\\n\nTap below to open your Web Admin Panel:,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '?? Open Web Admin Dashboard', web_app: { url: ${webappUrl}?admin=true } }]
            ]
          }
        })
      });

      return res.status(200).send('OK');
    }

    // 2. /start command
    if (text.startsWith('/start')) {
      await fetch(https://api.telegram.org/bot/sendMessage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: ????? *Welcome to Treasure Hunt, !* ??\n\nOpen daily chests, complete tasks, invite friends and earn real *Diamonds* & *USDT*!\n\n?? *1 Diamond = .00004 USD*\n?? *Earn 10% Lifetime Commission!*\n\nTap the button below to start your adventure:,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '?? Open Treasure Hunt', web_app: { url: webappUrl } }]
            ]
          }
        })
      });

      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  }

  res.status(200).send('OK');
}
