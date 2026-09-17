export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    hasBotToken: Boolean(process.env.BOT_TOKEN),
    adminId: process.env.ADMIN_ID || 'not_set',
    hasMongo: Boolean(process.env.MONGO_URI),
    nodeVersion: process.version
  });
}
