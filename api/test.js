export default async function handler(req, res) {
  try {
    const rawToken = process.env.BOT_TOKEN || '';
    const token = rawToken.trim();
    
    // Check telegram getMe
    const meRes = await fetch('https://api.telegram.org/bot' + token + '/getMe');
    const meData = await meRes.json();

    res.status(200).json({
      status: 'ok',
      hasToken: Boolean(token),
      tokenLength: token.length,
      telegram: meData
    });
  } catch (err) {
    res.status(200).json({
      status: 'error',
      message: err.message
    });
  }
}
