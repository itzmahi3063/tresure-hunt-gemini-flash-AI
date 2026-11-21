/**
 * lib/shield.js — DDoS Protection + Bot Fighting Mode
 * ====================================================================
 * One central, fail-open security layer for every /api/* handler.
 * It is wired in ONE place (lib/vpsBridge.js -> withVpsFallback), so all
 * existing endpoints are protected without editing any handler.
 *
 * DDoS protection
 *   - Per-IP burst (10s) + sustained (60s) limits, separate buckets for
 *     anonymous / Telegram-authenticated / partner-callback traffic
 *   - Progressive temporary IP blocks (10m -> 40m -> 4h -> 24h)
 *   - Auto "Under Attack" mode when the instance sees a request flood
 *   - Oversized URL / body / unsupported-method rejection
 *   - Blocks are shared across Vercel instances + VPS through MongoDB
 *     (collection: shield_blocks, auto-expiring TTL)
 *
 * Bot Fighting Mode
 *   - Blocks scripted clients (python-requests, curl, headless browsers...)
 *   - Verified-account behaviour checks: request flood, IP hopping,
 *     metronome (machine-regular) timing on action endpoints
 *   - Mass-account farms from one IP
 *   - Telegram bot side: ignores other bots, throttles command spam
 *
 * Safety rules
 *   - FAIL-OPEN: any internal error lets the request through
 *   - Blocks are TEMPORARY and automatic. Nothing here bans an account in
 *     the database, changes balances or touches any user data
 *   - Kill switch: SHIELD_DISABLED=1  |  Admin bot command: /shield
 * ====================================================================
 */

"use strict";

const { validateInitData } = require("./telegramAuth");

const ENV = process.env;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const settingsDefaults = () => ({
  ddos: ENV.SHIELD_DDOS !== "0",
  botFight: ENV.SHIELD_BOT_FIGHT !== "0",
  underAttack: ENV.SHIELD_UNDER_ATTACK === "1"
});

const state = {
  settings: settingsDefaults(),
  blocks: new Map(),        // "ip:1.2.3.4" | "uid:123" -> { key, reason, level, at, until, local }
  history: new Map(),       // key -> { level, at }  (escalation memory)
  ipWin: new Map(),         // "ip|bucket" -> window counters
  uidWin: new Map(),        // uid -> window counters
  botMsgWin: new Map(),     // telegram bot sender -> window counters
  strikes: new Map(),       // "kind:key" -> { n, first }
  uidIps: new Map(),        // uid -> Map(ip -> ts)
  ipUids: new Map(),        // ip -> Map(uid -> ts)
  uidScore: new Map(),      // uid -> { v, at }
  actionTimes: new Map(),   // "uid|endpoint" -> [timestamps]
  verifyCache: new Map(),   // initData -> { uid, exp }
  eventThrottle: new Map(),
  eventCount: { start: 0, n: 0 },
  global: { start: 0, count: 0, attackUntil: 0 },
  lastSync: 0,
  syncing: null,
  indexesDone: false,
  cleanupAt: 0
};

// ------------------------------------------------------------------
// Tunables (all overridable via env)
// ------------------------------------------------------------------
const num = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);
const CFG = {
  anonBurst: num(ENV.SHIELD_ANON_BURST, 25),            // per 10s, requests with no Telegram/admin credentials
  anonPerMin: num(ENV.SHIELD_ANON_PER_MIN, 60),
  authBurst: num(ENV.SHIELD_AUTH_BURST, 150),           // per 10s, requests carrying initData / admin credentials
  authPerMin: num(ENV.SHIELD_AUTH_PER_MIN, 600),
  partnerBurst: num(ENV.SHIELD_PARTNER_BURST, 100),     // ad-network server callbacks
  partnerPerMin: num(ENV.SHIELD_PARTNER_PER_MIN, 600),
  uidSoftPerMin: num(ENV.SHIELD_UID_SOFT_PER_MIN, 90),  // one verified account, all endpoints
  uidHardPerMin: num(ENV.SHIELD_UID_HARD_PER_MIN, 200),
  ipMaxUids10m: num(ENV.SHIELD_IP_MAX_ACCOUNTS, 60),    // distinct verified accounts per IP / 10 min
  uidMaxIps5m: num(ENV.SHIELD_UID_MAX_IPS, 8),          // distinct IPs per account / 5 min
  autoAttackPer10s: num(ENV.SHIELD_AUTO_ATTACK_PER_10S, 500),
  maxBodyBytes: num(ENV.SHIELD_MAX_BODY_BYTES, 1000000),
  maxUrlLength: 2048
};

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);
const ACTION_ENDPOINTS = new Set(["collect", "checkin", "upgrade"]); // metronome detection (POST only)

// Scripted / automated HTTP clients. Real Telegram WebViews never send these.
const BOT_UA = /(python-requests|python-urllib|python\/|aiohttp|httpx|curl\/|wget\/|go-http-client|libwww-perl|java\/|apache-httpclient|node-fetch|undici|axios\/|got \(|scrapy|postmanruntime|insomnia|headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|reqwest|termux|okhttp\/|sqlmap|nikto|masscan|nmap|zgrab|hydra)/i;

// ------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------
function getClientIp(req) {
  const h = req.headers || {};
  const raw = h["x-forwarded-for"] || h["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "";
  return String(raw).split(",")[0].trim() || "unknown";
}

function hit(map, key, t, burstMs = 10000, sustMs = 60000) {
  let r = map.get(key);
  if (!r) { r = { b0: t, bc: 0, s0: t, sc: 0, seen: t }; map.set(key, r); }
  if (t - r.b0 >= burstMs) { r.b0 = t; r.bc = 0; }
  if (t - r.s0 >= sustMs) { r.s0 = t; r.sc = 0; r.flagged = false; }
  r.bc++; r.sc++; r.seen = t;
  return r;
}

function strike(key, windowMs, limit) {
  const t = Date.now();
  let r = state.strikes.get(key);
  if (!r || t - r.first > windowMs) r = { n: 0, first: t };
  r.n++;
  state.strikes.set(key, r);
  if (r.n >= limit) { state.strikes.delete(key); return true; }
  return false;
}

function isAttackMode() {
  return state.settings.underAttack || state.global.attackUntil > Date.now();
}

function classify(req) {
  const h = req.headers || {};
  const url = String(req.url || req.originalUrl || "");
  const pathOnly = url.split("?")[0].toLowerCase();
  const m = pathOnly.match(/\/api\/([^/]+?)(?:\.js)?\/?$/);
  const endpoint = m ? m[1] : (pathOnly.replace(/^\/+|\/+$/g, "") || "root");
  const q = req.query || {};
  const action = String(q.action || q.type || "").toLowerCase();

  const initData = h["x-telegram-init-data"] ? String(h["x-telegram-init-data"]) : "";
  const adminCreds = Boolean(h["x-admin-password"] || h["authorization"]);
  const partnerPath = /^(adsgram-reward|adsgram-task-reward|adsgram-task|s2s-reward|adsgram|reward)$/.test(endpoint) || /adsgram|s2s/.test(action);

  return {
    url,
    endpoint,
    initData,
    isAdmin: endpoint === "admin" || endpoint === "setup-indexes",
    isHealth: endpoint === "health",
    // ad-network server-to-server callbacks carry no Telegram initData
    partner: partnerPath || (endpoint === "ads" && !initData),
    authLooking: Boolean(initData || adminCreds)
  };
}

function deny(res, status, message, retryAfterSec, extra) {
  try {
    if (retryAfterSec) res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterSec))));
    res.setHeader("X-Shield", "blocked");
    res.status(status).json({
      error: message,
      shield: true,
      ...(retryAfterSec ? { retryAfter: Math.max(1, Math.ceil(retryAfterSec)) } : {}),
      ...(extra || {})
    });
  } catch (e) { /* response already sent */ }
  return false;
}

// ------------------------------------------------------------------
// Block list (memory + MongoDB so every instance shares it)
// ------------------------------------------------------------------
function getBlock(key) {
  const b = state.blocks.get(key);
  if (!b) return null;
  if (b.until <= Date.now()) { state.blocks.delete(key); return null; }
  return b;
}

function addBlock(key, reason, baseMs) {
  const t = Date.now();
  const hist = state.history.get(key);
  const level = hist && t - hist.at < 24 * HOUR ? Math.min(hist.level + 1, 4) : 1;
  const mult = [1, 4, 24, 96][level - 1];
  const dur = Math.min(baseMs * mult, 24 * HOUR);
  const b = { key, reason, level, at: t, until: t + dur, local: true };
  state.blocks.set(key, b);
  state.history.set(key, { level, at: t });
  persistBlock(b);
  logEvent("block", key, `${reason} (level ${level}, ${Math.round(dur / MIN)} min)`);
  return b;
}

async function getDbSafe() {
  try { return await require("./mongodb").getDb(); } catch (e) { return null; }
}

function ensureIndexes(db) {
  if (state.indexesDone) return;
  state.indexesDone = true;
  Promise.resolve()
    .then(() => db.collection("shield_blocks").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }))
    .then(() => db.collection("shield_blocks").createIndex({ key: 1 }, { unique: true }))
    .then(() => db.collection("shield_events").createIndex({ at: 1 }, { expireAfterSeconds: 7 * 24 * 3600 }))
    .catch(() => {});
}

function persistBlock(b) {
  (async () => {
    const db = await getDbSafe();
    if (!db) return;
    ensureIndexes(db);
    await db.collection("shield_blocks").updateOne(
      { key: b.key },
      { $set: { key: b.key, reason: b.reason, level: b.level, createdAt: new Date(b.at), expiresAt: new Date(b.until) } },
      { upsert: true }
    );
  })().catch(() => {});
}

function logEvent(type, key, detail) {
  try {
    const t = Date.now();
    const tk = type + "|" + key;
    const last = state.eventThrottle.get(tk) || 0;
    if (t - last < MIN) return;
    state.eventThrottle.set(tk, t);
    if (t - state.eventCount.start > MIN) state.eventCount = { start: t, n: 0 };
    if (++state.eventCount.n > 40) return; // never let logging itself become a DB flood
    console.warn(`[Shield] ${type} ${key} ${detail || ""}`);
    (async () => {
      const db = await getDbSafe();
      if (!db) return;
      ensureIndexes(db);
      await db.collection("shield_events").insertOne({ at: new Date(), type, key, detail: String(detail || "").slice(0, 200) });
    })().catch(() => {});
  } catch (e) {}
}

async function syncFromDb() {
  const db = await getDbSafe();
  if (!db) return;
  ensureIndexes(db);
  const t = Date.now();

  const cfg = await db.collection("settings").findOne({ key: "shield_settings" });
  const next = settingsDefaults();
  if (cfg) {
    for (const k of ["ddos", "botFight", "underAttack"]) {
      if (typeof cfg[k] === "boolean") next[k] = cfg[k];
    }
  }
  state.settings = next;

  const docs = await db.collection("shield_blocks").find({ expiresAt: { $gt: new Date() } }).limit(2000).toArray();
  const fresh = new Map();
  for (const d of docs) {
    fresh.set(d.key, {
      key: d.key,
      reason: d.reason || "",
      level: d.level || 1,
      at: d.createdAt ? new Date(d.createdAt).getTime() : t,
      until: new Date(d.expiresAt).getTime(),
      local: false
    });
  }
  // keep very recent local blocks that the DB write may not have landed yet
  for (const [k, b] of state.blocks.entries()) {
    if (!fresh.has(k) && b.local && t - b.at < 30000 && b.until > t) fresh.set(k, b);
  }
  state.blocks = fresh;
  state.lastSync = t;
}

function maybeSync() {
  const t = Date.now();
  if (state.syncing || t - state.lastSync < 20000) return state.syncing;
  state.lastSync = t; // avoid stampede if the DB is down
  state.syncing = syncFromDb().catch(() => {}).finally(() => { state.syncing = null; });
  return state.syncing;
}

function cleanup() {
  const t = Date.now();
  if (t - state.cleanupAt < MIN) return;
  state.cleanupAt = t;
  for (const [k, r] of state.ipWin) if (t - r.seen > 2 * MIN) state.ipWin.delete(k);
  for (const [k, r] of state.uidWin) if (t - r.seen > 2 * MIN) state.uidWin.delete(k);
  for (const [k, r] of state.botMsgWin) if (t - r.seen > 2 * MIN) state.botMsgWin.delete(k);
  for (const [k, r] of state.strikes) if (t - r.first > 15 * MIN) state.strikes.delete(k);
  for (const [k, r] of state.uidScore) if (t - r.at > 10 * MIN) state.uidScore.delete(k);
  for (const [k, v] of state.uidIps) { for (const [ip, ts] of v) if (t - ts > 5 * MIN) v.delete(ip); if (!v.size) state.uidIps.delete(k); }
  for (const [k, v] of state.ipUids) { for (const [u, ts] of v) if (t - ts > 10 * MIN) v.delete(u); if (!v.size) state.ipUids.delete(k); }
  for (const [k, arr] of state.actionTimes) if (!arr.length || t - arr[arr.length - 1] > 30 * MIN) state.actionTimes.delete(k);
  for (const [k, v] of state.verifyCache) if (v.exp < t) state.verifyCache.delete(k);
  for (const [k, v] of state.eventThrottle) if (t - v > 5 * MIN) state.eventThrottle.delete(k);
  for (const [k, v] of state.history) if (t - v.at > 24 * HOUR) state.history.delete(k);
  for (const [k, b] of state.blocks) if (b.until <= t) state.blocks.delete(k);
  // hard memory caps (protects the instance itself during a spoofed-IP flood)
  if (state.ipWin.size > 30000) state.ipWin.clear();
  if (state.uidWin.size > 30000) state.uidWin.clear();
  if (state.verifyCache.size > 3000) state.verifyCache.clear();
}

// ------------------------------------------------------------------
// Account (verified Telegram user) behaviour scoring
// ------------------------------------------------------------------
function addScore(uid, points, reason) {
  const t = Date.now();
  let s = state.uidScore.get(uid);
  if (!s || t - s.at > 10 * MIN) s = { v: 0, at: t };
  s.v += points; s.at = t;
  state.uidScore.set(uid, s);
  if (s.v >= 10) {
    state.uidScore.delete(uid);
    addBlock("uid:" + uid, reason, 15 * MIN);
    return true;
  }
  return false;
}

function verifyUser(initData) {
  const t = Date.now();
  const cached = state.verifyCache.get(initData);
  if (cached && cached.exp > t) return cached.uid;
  const token = ENV.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const user = validateInitData(initData, token);
  const uid = user && user.id ? String(user.id) : null;
  if (uid) state.verifyCache.set(initData, { uid, exp: t + MIN });
  return uid;
}

function blockedMessage(b) {
  const mins = Math.max(1, Math.ceil((b.until - Date.now()) / MIN));
  return `Suspicious automated activity detected. Please try again in ${mins} minute${mins > 1 ? "s" : ""}.`;
}

// ------------------------------------------------------------------
// Main entry: called for every /api request
// Returns true -> continue to handler. false -> shield already answered.
// ------------------------------------------------------------------
async function shieldCore(req, res) {
  if (ENV.SHIELD_DISABLED === "1") return true;

  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS" || method === "HEAD") return true;
  if (!ALLOWED_METHODS.has(method)) return deny(res, 405, "Method not allowed");

  const c = classify(req);
  if (c.isHealth) return true;

  // The Telegram webhook (and cron-job.org pings to it) must NEVER be touched here: Telegram's servers
  // send no browser User-Agent. It is protected separately by the webhook secret token + per-sender throttle.
  if (c.endpoint === "webhook" || /\/api\/webhook(?:\.js)?(?:[/?]|$)/i.test(c.url) || (req.headers || {})["x-telegram-bot-api-secret-token"]) return true;

  // On a cold instance wait (briefly) for the shared block-list; afterwards refresh in the background
  if (!state.lastSync) {
    await Promise.race([maybeSync(), new Promise((r) => setTimeout(r, 400))]);
  } else {
    maybeSync();
  }
  cleanup();

  const { ddos, botFight } = state.settings;
  if (!ddos && !botFight) return true;

  const t = Date.now();
  const ip = getClientIp(req);

  // ---- 1. Blocked IP ---------------------------------------------------
  const ipBlock = getBlock("ip:" + ip);
  if (ipBlock) return deny(res, 429, "Too many requests. Your connection is temporarily blocked by the security shield.", (ipBlock.until - t) / 1000);

  // ---- 2. DDoS protection ---------------------------------------------
  if (ddos) {
    if (c.url.length > CFG.maxUrlLength) return deny(res, 414, "Request URI too long");
    const cl = parseInt((req.headers || {})["content-length"] || "0", 10);
    if (cl > CFG.maxBodyBytes && !c.isAdmin) return deny(res, 413, "Payload too large");

    // instance-wide flood detector -> automatic Under Attack mode
    const g = state.global;
    if (t - g.start >= 10000) { g.start = t; g.count = 0; }
    if (++g.count > CFG.autoAttackPer10s && g.attackUntil < t) {
      g.attackUntil = t + 5 * MIN;
      logEvent("auto-attack", "global", `>${CFG.autoAttackPer10s} requests / 10s on this instance`);
    }

    const attack = isAttackMode();

    // Under Attack: anonymous calls (no Telegram/admin credentials) are dropped before any DB work
    if (attack && !c.authLooking && !c.partner && !c.isAdmin) {
      return deny(res, 401, "Security mode active. Please reopen the app from Telegram.");
    }

    let burst, perMin, bucket;
    if (c.partner) { burst = CFG.partnerBurst; perMin = CFG.partnerPerMin; bucket = "p"; }
    else if (c.authLooking) { burst = CFG.authBurst; perMin = CFG.authPerMin; bucket = "a"; }
    else { burst = CFG.anonBurst; perMin = CFG.anonPerMin; bucket = "n"; }
    if (attack) { const f = bucket === "n" ? 0.4 : 0.5; burst = Math.ceil(burst * f); perMin = Math.ceil(perMin * f); }

    const w = hit(state.ipWin, ip + "|" + bucket, t);
    if (w.bc > burst || w.sc > perMin) {
      // anonymous floods are blocked fast; shared-IP (carrier NAT) authenticated traffic is only blocked on heavy abuse
      const strikeLimit = bucket === "n" ? 3 : 8;
      if (strike("ddos:" + ip + "|" + bucket, 5 * MIN, strikeLimit)) {
        const b = addBlock("ip:" + ip, "ddos-rate-limit", bucket === "n" ? 10 * MIN : 5 * MIN);
        return deny(res, 429, "Too many requests. Your connection is temporarily blocked by the security shield.", (b.until - t) / 1000);
      }
      const retry = Math.max(1, Math.ceil((10000 - (t - w.b0)) / 1000));
      return deny(res, 429, "Too many requests. Please slow down.", retry);
    }
  }

  // ---- 3. Bot Fighting Mode -------------------------------------------
  if (botFight && !c.isAdmin && !c.partner) {
    const ua = String((req.headers || {})["user-agent"] || "").trim();

    if (!ua || BOT_UA.test(ua)) {
      if (strike("botua:" + ip, 10 * MIN, 3)) addBlock("ip:" + ip, "automated-client", 30 * MIN);
      logEvent("bot-ua", "ip:" + ip, (ua || "(empty)").slice(0, 80));
      return deny(res, 403, "Automated clients are not allowed.");
    }

    if (c.initData) {
      const uid = verifyUser(c.initData);

      if (!uid) {
        // forged / replayed / guessed initData
        if (strike("badinit:" + ip, MIN, 10)) {
          const b = addBlock("ip:" + ip, "invalid-session-spam", 10 * MIN);
          return deny(res, 429, "Too many invalid sessions. Temporarily blocked.", (b.until - t) / 1000);
        }
      } else {
        const ukey = "uid:" + uid;
        const ub = getBlock(ukey);
        if (ub) return deny(res, 429, blockedMessage(ub), (ub.until - t) / 1000);

        // (a) one account hammering every endpoint
        const uw = hit(state.uidWin, uid, t);
        if (uw.sc > CFG.uidHardPerMin) {
          const b = addBlock(ukey, "account-flood", 15 * MIN);
          return deny(res, 429, blockedMessage(b), (b.until - t) / 1000);
        }
        if (uw.sc > CFG.uidSoftPerMin && !uw.flagged) {
          uw.flagged = true;
          if (addScore(uid, 4, "account-flood")) return deny(res, 429, blockedMessage(getBlock(ukey)), 60);
        }

        // (b) one account rotating through many IPs
        let ips = state.uidIps.get(uid);
        if (!ips) { ips = new Map(); state.uidIps.set(uid, ips); }
        ips.set(ip, t);
        for (const [k, ts] of ips) if (t - ts > 5 * MIN) ips.delete(k);
        if (ips.size > CFG.uidMaxIps5m && !ips.flagged) {
          ips.flagged = true;
          if (addScore(uid, 5, "ip-hopping")) return deny(res, 429, blockedMessage(getBlock(ukey)), 60);
        }

        // (c) one IP farming many accounts
        let uids = state.ipUids.get(ip);
        if (!uids) { uids = new Map(); state.ipUids.set(ip, uids); }
        uids.set(uid, t);
        for (const [k, ts] of uids) if (t - ts > 10 * MIN) uids.delete(k);
        if (uids.size > CFG.ipMaxUids10m) {
          const b = addBlock("ip:" + ip, "account-farm", 10 * MIN);
          return deny(res, 429, "Too many accounts from one connection. Temporarily blocked.", (b.until - t) / 1000);
        }

        // (d) machine-regular timing on action endpoints (auto-clickers / scripts)
        if (method === "POST" && ACTION_ENDPOINTS.has(c.endpoint)) {
          const k = uid + "|" + c.endpoint;
          let arr = state.actionTimes.get(k);
          if (!arr) { arr = []; state.actionTimes.set(k, arr); }
          arr.push(t);
          if (arr.length > 8) arr.shift();
          if (arr.length === 8) {
            const gaps = [];
            for (let i = 1; i < arr.length; i++) gaps.push(arr[i] - arr[i - 1]);
            const spread = Math.max(...gaps) - Math.min(...gaps);
            if (Math.min(...gaps) >= 800 && Math.max(...gaps) <= 10 * MIN && spread <= 120) {
              state.actionTimes.delete(k);
              if (addScore(uid, 10, "metronome-bot")) return deny(res, 429, blockedMessage(getBlock(ukey)), 60);
            }
          }
        }
      }
    }
  }

  return true;
}

async function shieldRequest(req, res) {
  try {
    return await shieldCore(req, res);
  } catch (e) {
    return true; // fail-open: the shield must never take the app down
  }
}

// ------------------------------------------------------------------
// Telegram bot side (used by api/webhook.js)
// ------------------------------------------------------------------
function checkBotUpdate(senderId) {
  try {
    if (ENV.SHIELD_DISABLED === "1" || !state.settings.botFight) return true;
    const id = String(senderId || "");
    if (!id) return true;
    const admins = String(ENV.ADMIN_TELEGRAM_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (admins.includes(id)) return true;
    const r = hit(state.botMsgWin, id, Date.now());
    return !(r.bc > 10 || r.sc > 40); // >10 messages / 10s or >40 / min -> ignore silently
  } catch (e) {
    return true;
  }
}

// ------------------------------------------------------------------
// Admin control (/shield command in the Telegram bot)
// ------------------------------------------------------------------
const onoff = (v) => (v ? "🟢 ON" : "🔴 OFF");

async function setSetting(db, key, value) {
  state.settings[key] = value;
  if (db) {
    await db.collection("settings").updateOne(
      { key: "shield_settings" },
      { $set: { [key]: value, updatedAt: new Date() } },
      { upsert: true }
    );
  }
}

async function handleShieldCommand(db, args) {
  const a = (args || []).map((s) => String(s).trim()).filter(Boolean);
  const sub = (a[0] || "status").toLowerCase();
  const val = (a[1] || "").toLowerCase();
  const toBool = (v) => (v === "on" || v === "1" || v === "true" ? true : v === "off" || v === "0" || v === "false" ? false : null);

  if (db) await syncFromDb().catch(() => {});

  const map = { botfight: "botFight", bot: "botFight", ddos: "ddos", attack: "underAttack", underattack: "underAttack" };
  if (map[sub]) {
    const b = toBool(val);
    if (b === null) return `Usage: <code>/shield ${sub} on</code> or <code>/shield ${sub} off</code>`;
    await setSetting(db, map[sub], b);
    return `✅ <b>${map[sub]}</b> is now ${onoff(b)}`;
  }

  if (sub === "unblock") {
    const target = a[1];
    if (!target) return "Usage: <code>/shield unblock &lt;ip | telegramId | all&gt;</code>";
    if (target.toLowerCase() === "all") {
      state.blocks.clear(); state.history.clear(); state.strikes.clear(); state.uidScore.clear();
      if (db) await db.collection("shield_blocks").deleteMany({});
      return "✅ All shield blocks cleared.";
    }
    const keys = /^\d+$/.test(target) ? ["uid:" + target] : ["ip:" + target];
    for (const k of keys) { state.blocks.delete(k); state.history.delete(k); }
    if (db) await db.collection("shield_blocks").deleteMany({ key: { $in: keys } });
    return `✅ Unblocked <code>${keys[0]}</code>`;
  }

  // status (default) / blocks
  const t = Date.now();
  const active = [...state.blocks.values()].filter((b) => b.until > t).sort((x, y) => y.at - x.at);
  let events = "n/a";
  if (db) {
    try { events = String(await db.collection("shield_events").countDocuments({ at: { $gt: new Date(t - HOUR) } })); } catch (e) {}
  }
  const lines = active.slice(0, 10).map((b) => `• <code>${b.key}</code> — ${b.reason} (${Math.max(1, Math.ceil((b.until - t) / MIN))}m left)`);
  return (
    `🛡️ <b>Shield Status</b>\n\n` +
    `DDoS Protection: ${onoff(state.settings.ddos)}\n` +
    `Bot Fighting Mode: ${onoff(state.settings.botFight)}\n` +
    `Under Attack Mode: ${onoff(isAttackMode())}${state.global.attackUntil > t ? " (auto)" : ""}\n\n` +
    `Active blocks: <b>${active.length}</b>\n` +
    `Events (last 1h): <b>${events}</b>\n` +
    (lines.length ? `\n${lines.join("\n")}\n` : "") +
    `\n<b>Commands</b>\n` +
    `<code>/shield botfight on|off</code>\n` +
    `<code>/shield ddos on|off</code>\n` +
    `<code>/shield attack on|off</code>\n` +
    `<code>/shield unblock &lt;ip|telegramId|all&gt;</code>`
  );
}

module.exports = {
  shieldRequest,
  checkBotUpdate,
  handleShieldCommand,
  // exported for tests
  _state: state,
  _CFG: CFG
};
