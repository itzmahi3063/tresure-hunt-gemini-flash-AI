export default async function handler(req, res) {
  try {
    const rawToken = process.env.BOT_TOKEN || '';
    const token = rawToken.trim();
    
    // Check webhook info
    const infoRes = await fetch('https://api.telegram.org/bot' + token + '/getWebhookInfo');
    const infoData = await infoRes.json();

    res.status(200).json({
      status: 'ok',
      adminId: process.env.ADMIN_ID,
      webhookInfo: infoData
    });
  } catch (err) {
    res.status(200).json({
      status: 'error',
      message: err.message
    });
  }
}
