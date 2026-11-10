/**
 * ====================================================================
 * TREASURE MINE - Dedicated Production VPS Server
 * ====================================================================
 * Features:
 * - High-speed persistent Node.js execution (no serverless cold starts)
 * - Anti-DDoS In-Memory IP Rate Limiter
 * - Hardened HTTP Security Headers (anti-sniffing, anti-XSS, frame guard)
 * - Direct IP Access Lockdown (Bridge Secret Verification)
 * - 24/7 Background Mining Reminders & Broadcast Worker
 * - Slowloris & Hanging Connection Protection
 * - Uncaught Exception / Rejection Shield (Zero-Crash Resilience)
 * ====================================================================
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");

// Set environment flag so handlers know they are running natively on VPS
process.env.IS_VPS = "true";

// 1. Built-in zero-dependency .env loader for VPS
const envFile = path.resolve(__dirname, ".env");
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, "utf8");
  content.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

// 2. High-Security HTTP Headers Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Server-Engine", "TREASURE-VPS-Core");
  next();
});

// 3. Body Parsing with Payload Bomb Protection (Max 2MB)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// 4. In-Memory Anti-DDoS & IP Rate Limiting (180 requests/minute per IP)
const ipRateMap = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || "180", 10);

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipRateMap.entries()) {
    if (now - data.startTime > RATE_WINDOW_MS) {
      ipRateMap.delete(ip);
    }
  }
}, 30 * 1000);

app.use((req, res, next) => {
  if (req.path === "/api/health" || req.path.startsWith("/assets/")) {
    return next();
  }

  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  let record = ipRateMap.get(clientIp);

  if (!record || (now - record.startTime > RATE_WINDOW_MS)) {
    record = { count: 1, startTime: now };
    ipRateMap.set(clientIp, record);
  } else {
    record.count++;
  }

  if (record.count > RATE_MAX_REQUESTS) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please wait a moment before trying again."
    });
  }

  next();
});

// 5. Direct IP Lockdown (Optional Bridge Secret Verification)
// If VPS_BRIDGE_SECRET is configured, requests to /api/ must come through Vercel or have this key
app.use((req, res, next) => {
  const secret = (process.env.VPS_BRIDGE_SECRET || "").trim();
  if (!secret) return next();

  // Allow static frontend, assets and health check
  if (!req.path.startsWith("/api/") || req.path === "/api/health") {
    return next();
  }

  const incomingSecret = req.headers["x-vps-bridge-secret"];
  const isDirectTelegram = req.headers["x-telegram-init-data"] || req.headers["x-telegram-bot-api-secret-token"];

  if (incomingSecret === secret || isDirectTelegram) {
    return next();
  }

  return res.status(403).json({
    error: "Forbidden",
    message: "Direct untrusted access to VPS backend is restricted."
  });
});

// 6. Real-Time Health & Diagnostic Endpoint
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    role: "vps-primary",
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    activeRateTrackedIps: ipRateMap.size,
    timestamp: new Date().toISOString()
  });
});

// 7. Mount Application API Handlers
const apiHandlers = {
  admin: require("./api/admin"),
  ads: require("./api/ads"),
  captcha: require("./api/captcha"),
  checkin: require("./api/checkin"),
  collect: require("./api/collect"),
  referral: require("./api/referral"),
  tasks: require("./api/tasks"),
  upgrade: require("./api/upgrade"),
  user: require("./api/user"),
  wallet: require("./api/wallet"),
  webhook: require("./api/webhook")
};

// Route Aliases
app.all("/api/adsgram-reward", apiHandlers.ads);
app.all("/api/adsgram-task-reward", apiHandlers.ads);
app.all("/api/s2s-reward", apiHandlers.ads);
app.all("/api/adsgram", apiHandlers.ads);
app.all("/api/reward", apiHandlers.ads);
app.all("/api/verify-channel", apiHandlers.tasks);
app.all("/api/setup-indexes", apiHandlers.admin);

// Dynamic API Route Dispatcher
app.all("/api/:endpoint", async (req, res) => {
  const endpoint = req.params.endpoint;
  const handler = apiHandlers[endpoint];
  if (!handler) {
    return res.status(404).json({ error: `API route /api/${endpoint} not found` });
  }

  try {
    await handler(req, res);
  } catch (err) {
    console.error(`[VPS API Error] /api/${endpoint}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error", message: err.message });
    }
  }
});

// 8. Serve Static Game Frontend & Assets
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { maxAge: "7d" }));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

// Fallback route for SPA (Express v4 & v5 compatible)
app.use((req, res) => {
  if (req.method === "GET") {
    res.sendFile(path.join(publicDir, "index.html"));
  } else {
    res.status(404).json({ error: "Not Found" });
  }
});

// 9. Uncaught Exception / Rejection Shield (Zero Server Crashes)
process.on("uncaughtException", err => {
  console.error("[VPS Shield] Uncaught Exception caught:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[VPS Shield] Unhandled Rejection at:", promise, "reason:", reason);
});

// 10. Start HTTP Server with Slowloris Connection Timeouts
const PORT = parseInt(process.env.PORT || "3000", 10);
const server = http.createServer(app);

// Slowloris defense: terminate idle/stalled connections
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`=======================================================`);
  console.log(` 🚀 TREASURE Mine VPS High-Performance Core Started!`);
  console.log(` 📡 Listening on: http://0.0.0.0:${PORT}`);
  console.log(` 🛡️  Anti-DDoS Rate Limiter: Active (${RATE_MAX_REQUESTS} req/min)`);
  console.log(` 🔒 Security Headers & Shield: Active`);
  console.log(` ⏱️  Started at: ${new Date().toISOString()}`);
  console.log(`=======================================================`);
});

// 11. VPS 24/7 Automated Background Worker & Startup Cache Pre-warming
try {
  const { getDb } = require("./lib/mongodb");
  const { processMiningReminders } = require("./lib/miningReminder");
  const { processBroadcastQueue } = require("./lib/broadcastQueue");
  const { purgeExpiredCompletedTasks, purgeAllExcessWithdrawals } = require("./lib/userHelper");
  const { checkTonDeposit, notifyUserTaskActivated } = require("./lib/tonDeposit");

  // Pre-warm DB connection and welcome banner file_id into RAM for sub-100ms instant /start bot replies
  (async () => {
    try {
      const db = await getDb();
      if (db) {
        const bDoc = await db.collection("settings").findOne({ key: "welcome_banner_file_id" });
        if (bDoc && bDoc.fileId && typeof apiHandlers.webhook?.setCachedWelcomeBannerFileId === "function") {
          apiHandlers.webhook.setCachedWelcomeBannerFileId(bDoc.fileId);
          console.log("[VPS Startup] Pre-warmed welcome banner file_id:", bDoc.fileId);
        }
      }
    } catch (_) {}
  })();

  const runVpsBackgroundTasks = async () => {
    try {
      const db = await getDb();
      if (!db) return;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      // 1. Process 2-hour completed mining reminders
      await processMiningReminders(db, botToken).catch(() => {});

      // 2. Process large broadcast batches
      const bRes = await processBroadcastQueue(db, botToken, 8000).catch(() => null);
      if (bRes && bRes.active && !bRes.completed && bRes.remainingUsers > 0) {
        // Fast drain loop: if broadcast is actively running, trigger next batch in 2s
        setTimeout(runVpsBackgroundTasks, 2000);
      }

      // 3. Maintenance purges
      await purgeExpiredCompletedTasks(db.collection("tasks")).catch(() => {});
      await purgeAllExcessWithdrawals(db.collection("withdrawals")).catch(() => {});

      // 4. Check pending on-chain TON deposits for user-promoted tasks
      const tasksCol = db.collection("tasks");
      const pendingTasks = await tasksCol.find({ status: "pending_payment" }).limit(20).toArray().catch(() => []);
      const now = Date.now();
      for (const t of pendingTasks) {
        if (!t.depositAddress || !t.memo) continue;
        const taskExpiry = t.expiresAt || (t.createdAt ? t.createdAt + 30 * 60 * 1000 : 0);
        try {
          const resCheck = await checkTonDeposit(t.depositAddress, t.tonCost, t.memo);
          if (resCheck.verified) {
            await tasksCol.updateOne(
              { _id: t._id },
              { $set: { status: "active", paid: true, paidAt: now, txHash: resCheck.txHash } }
            );
            if (t.creatorId && botToken) {
              await notifyUserTaskActivated(botToken, t.creatorId, t, resCheck.txHash).catch(() => {});
            }
            continue;
          }
          if (taskExpiry && now > taskExpiry) {
            await tasksCol.updateOne(
              { _id: t._id },
              { $set: { status: "declined", declinedReason: "Unpaid within 30 minutes" } }
            );
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn("[VPS Worker] Error during background cycle:", err.message);
    }
  };

  // Run initial worker after 10s, then repeat every 5 minutes 24/7
  setTimeout(runVpsBackgroundTasks, 10000);
  setInterval(runVpsBackgroundTasks, 5 * 60 * 1000);
  console.log(" ⏰ VPS Native 24/7 Background Cron Worker: Active (Interval: 5m)");
} catch (workerErr) {
  console.warn("[VPS Worker] Notice:", workerErr.message);
}
