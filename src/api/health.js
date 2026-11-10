const { withVpsFallback } = require("../lib/vpsBridge");

async function handler(req, res) {
  res.status(200).json({
    ok: true,
    role: "vercel-fallback",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
}

module.exports = withVpsFallback(handler);
