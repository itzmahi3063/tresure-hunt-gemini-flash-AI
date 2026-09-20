import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? '/tmp' : path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem fallback
}

// Initial Database Structure
const initialData = {
  users: {},
  tasks: [
    {
      id: 'task_social_1',
      category: 'social',
      type: 'channel',
      title: 'Treasure Hunt Channel',
      description: 'Join our official telegram channel',
      link: 'https://t.me/TreasureHuntCommunity',
      chat_id: '@TreasureHuntCommunity',
      reward_diamonds: 500,
      max_users: null,
      current_completed: 0,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'task_social_2',
      category: 'social',
      type: 'group',
      title: 'Treasure Hunt Chat',
      description: 'Join our official telegram community chat',
      link: 'https://t.me/TreasureHuntChat',
      chat_id: '@TreasureHuntChat',
      reward_diamonds: 500,
      max_users: null,
      current_completed: 0,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'task_partner_1',
      category: 'partner',
      type: 'website',
      title: 'RG Crypto Lab',
      description: 'Join our partner channel for crypto signals',
      link: 'https://t.me/RGCryptoLab',
      chat_id: '',
      reward_diamonds: 500,
      max_users: 10000,
      current_completed: 0,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'task_partner_2',
      category: 'partner',
      type: 'website',
      title: 'YouTube Official',
      description: 'Like and Subscribe our YouTube channel',
      link: 'https://youtube.com',
      chat_id: '',
      reward_diamonds: 300,
      max_users: null,
      current_completed: 0,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'task_partner_3',
      category: 'partner',
      type: 'website',
      title: 'Twitter / X',
      description: 'Follow our partner Twitter account',
      link: 'https://x.com',
      chat_id: '',
      reward_diamonds: 300,
      max_users: null,
      current_completed: 0,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'task_partner_4',
      category: 'partner',
      type: 'website',
      title: 'Instagram',
      description: 'Follow our partner Instagram page',
      link: 'https://instagram.com',
      chat_id: '',
      reward_diamonds: 300,
      max_users: null,
      current_completed: 0,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'task_exclusive_1',
      category: 'exclusive',
      type: 'website',
      title: 'CRYPTO INVESTMENT',
      description: 'Join partner crypto platforms channel',
      link: 'https://t.me/CryptoInvest',
      chat_id: '',
      reward_diamonds: 200,
      max_users: null,
      current_completed: 0,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'task_exclusive_2',
      category: 'exclusive',
      type: 'website',
      title: 'USDT EARN',
      description: 'Check out the high earning USDT program',
      link: 'https://t.me/UsdtEarnProgram',
      chat_id: '',
      reward_diamonds: 200,
      max_users: null,
      current_completed: 0,
      is_active: true,
      created_at: new Date().toISOString()
    }
  ],
  // Catalog of ad networks admin can assign to any of the 4 Daily slots
  // below. Adding a new network here makes it selectable from the admin
  // panel's "swap ad" dropdown for any slot.
  ad_networks: [
    {
      id: 'adsgram',
      name: 'Adsgram',
      logo_url: 'https://i.postimg.cc/qqGHSY1c/Hn-G0DZAC-400x400.jpg',
      block_id: 'sample-adsgram-block'
    },
    {
      id: 'adsgram_cat',
      name: 'Adsgram 🐱🏍',
      logo_url: 'https://i.postimg.cc/qqGHSY1c/Hn-G0DZAC-400x400.jpg',
      block_id: 'sample-adsgram-cat-block'
    },
    {
      id: 'monetag',
      name: 'Monetag',
      logo_url: 'https://i.postimg.cc/28mzGd0w/monetag-logo.jpg',
      block_id: 'sample-monetag-zone'
    },
    {
      id: 'usl',
      name: 'USL 👾',
      logo_url: 'https://i.postimg.cc/0jnhcSQ1/9a0735f3-cf89-487c-bbce-53833c3edc66.jpg',
      block_id: 'plc_7c25684decd46576'
    }
  ],
  // 4 fixed Daily-tab ad SLOTS in exact requested order:
  // 1. Adsgram | 2. Adsgram 🐱🏍 | 3. Monetag | 4. USL 👾
  ads_config: [
    {
      id: 'slot_1',
      network_id: 'adsgram',
      name: 'Adsgram',
      logo_url: 'https://i.postimg.cc/qqGHSY1c/Hn-G0DZAC-400x400.jpg',
      block_id: 'sample-adsgram-block',
      reward_diamonds: 50,
      max_daily: 10,
      is_hidden: false
    },
    {
      id: 'slot_2',
      network_id: 'adsgram_cat',
      name: 'Adsgram 🐱🏍',
      logo_url: 'https://i.postimg.cc/qqGHSY1c/Hn-G0DZAC-400x400.jpg',
      block_id: 'sample-adsgram-cat-block',
      reward_diamonds: 50,
      max_daily: 10,
      is_hidden: false
    },
    {
      id: 'slot_3',
      network_id: 'monetag',
      name: 'Monetag',
      logo_url: 'https://i.postimg.cc/28mzGd0w/monetag-logo.jpg',
      block_id: 'sample-monetag-zone',
      reward_diamonds: 50,
      max_daily: 10,
      is_hidden: false
    },
    {
      id: 'slot_4',
      network_id: 'usl',
      name: 'USL 👾',
      logo_url: 'https://i.postimg.cc/0jnhcSQ1/9a0735f3-cf89-487c-bbce-53833c3edc66.jpg',
      block_id: 'plc_7c25684decd46576',
      reward_diamonds: 50,
      max_daily: 10,
      is_hidden: false
    }
  ],
  daily_ads_completed: {}, // key: `${userId}_${adId}_${dateString}` -> count
  task_completions: {}, // key: `${userId}_${taskId}` -> completion object
  withdrawals: [],
  conversions: [],
  settings: {
    diamond_to_usd_rate: 0.00004,
    referral_commission_rate: 0.10, // 10%
    min_withdrawal_usdt: 1.0,
    admin_telegram_id: process.env.ADMIN_ID || '7780774047',
    bot_username: 'TreasureHunt_bot'
  },
  promo_codes: [
    {
      id: 'promo_welcome',
      code: 'TREASURE',
      reward_type: 'diamonds',
      reward_amount: 500,
      max_uses: null,
      uses_count: 0,
      is_active: true,
      created_at: new Date().toISOString()
    }
  ],
  promo_redemptions: {}, // key: `${userId}_${codeUpper}` -> { redeemed_at, reward }
  ton_processed_txs: [], // Array of processed TON tx hashes for idempotency
  ton_transactions: [], // Audit history of TON payments and deposits
  broadcast_queue: [], // Persistent queue for batch broadcast messages to 20k-30k users
  last_daily_reset_broadcast: null // Tracks last date (YYYY-MM-DD) daily reset broadcast was triggered
};

class Database {
  constructor() {
    this.data = initialData;
    this.mongoClient = null;
    this.mongoCollection = null;
    this.isMongoConnected = false;
    this.dirty = false;
    this._preSnapshot = null; // baseline for targeted (non-clobbering) Mongo writes — see buildTargetedUpdate()
    this.load();
    // Kept as a promise (never rejects — initMongo catches its own errors)
    // so route handlers can `await db.mongoReady` before touching this.data.
    // This closes the race where a request on a fresh serverless instance
    // gets served BEFORE the latest state has been pulled from MongoDB.
    this.mongoReady = this.initMongo();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = { ...initialData, ...JSON.parse(raw) };
        this.ensureFourAdSlots();
      } else {
        this.saveLocal();
      }
    } catch (err) {
      console.error('Error loading DB file, fallback to default:', err);
      this.data = initialData;
    }
  }

  saveLocal() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving local DB file:', err);
    }
  }

  async initMongo() {
    const uri = process.env.MONGO_URI;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!uri || uri.includes('<db_password>')) {
      console.log(
        isProduction
          ? '❌ MONGO_URI is missing/invalid in production. MongoDB is required — requests will get a 503 until this is set (see /api/health).'
          : 'ℹ️ MongoDB URI not configured or contains placeholder <db_password>. Operating in local JSON storage mode (dev only).'
      );
      return;
    }

    // A handful of quick retries on cold start: a transient DNS/TLS hiccup
    // connecting to Atlas used to permanently mark this instance as
    // "local storage mode" for its entire lifetime — which is exactly what
    // could make a balance look like it "reset" (this instance would then
    // silently serve/save the fresh empty local state instead of the real
    // one). Kept short so a genuinely cold Vercel function doesn't time out.
    const MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        this.mongoClient = new MongoClient(uri, {
          serverSelectionTimeoutMS: 3500,
          connectTimeoutMS: 3500
        });
        await this.mongoClient.connect();
        const db = this.mongoClient.db('treasure_hunt');
        this.mongoCollection = db.collection('app_state');
        this.isMongoConnected = true;
        console.log('💎 Connected to MongoDB Atlas Cloud Database successfully!');

        // Sync cloud state into memory if present
        const pulled = await this.pullRemoteState();
        if (!pulled) {
          // First time initialization in MongoDB
          await this.mongoCollection.updateOne(
            { _id: 'main_state' },
            { $set: { data: this.data, updated_at: new Date().toISOString() } },
            { upsert: true }
          );
          console.log('☁️ Cloud database initialized with current application state.');
        }
        return; // connected — done
      } catch (err) {
        this.isMongoConnected = false;
        console.warn(`⚠️ MongoDB connection attempt ${attempt}/${MAX_ATTEMPTS} failed:`, err.message);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }
    console.error('❌ MongoDB connection failed after retries — requests will get a 503 (dbUnavailable) instead of silently using local storage. Check MONGO_URI / Atlas network access.');
  }

  // Pull the latest state from MongoDB into memory. Returns true if a
  // remote document existed and was loaded, false otherwise.
  async pullRemoteState() {
    if (!this.isMongoConnected || !this.mongoCollection) return false;
    const remoteState = await this.mongoCollection.findOne({ _id: 'main_state' });
    if (remoteState && remoteState.data) {
      this.data = { ...initialData, ...remoteState.data };
      // Baseline snapshot for this request. Anything that differs from this
      // by the time we flush() is exactly what THIS request changed — see
      // buildTargetedUpdate(). Taken before ensureFourAdSlots() on purpose,
      // so any repair it makes is itself captured as a real change to save.
      this._preSnapshot = JSON.parse(JSON.stringify(this.data));
      this.ensureFourAdSlots();
      this.saveLocal();
      return true;
    }
    return false;
  }

  ensureFourAdSlots() {
    if (!this.data) return;
    const defaultSlots = initialData.ads_config;
    if (!Array.isArray(this.data.ads_config) || this.data.ads_config.length === 0) {
      this.data.ads_config = JSON.parse(JSON.stringify(defaultSlots));
      this.data.ad_networks = JSON.parse(JSON.stringify(initialData.ad_networks));
      this.save();
      return;
    }

    let changed = false;
    const currentSlots = this.data.ads_config;

    // Ensure all default slots exist without resetting user's is_hidden or custom configuration
    const updatedSlots = defaultSlots.map((ds) => {
      let existing = currentSlots.find(a => a.id === ds.id);
      if (!existing) {
        changed = true;
        return { ...ds };
      }
      // Upgrade any placeholder sample-usl-zone to the real USL placementId
      if (existing.network_id === 'usl' && (!existing.block_id || existing.block_id === 'sample-usl-zone')) {
        existing.block_id = 'plc_7c25684decd46576';
        changed = true;
      }
      return existing;
    });

    // Keep any other custom slots if they exist
    for (const slot of currentSlots) {
      if (!updatedSlots.some(s => s.id === slot.id)) {
        updatedSlots.push(slot);
        changed = true;
      }
    }

    if (changed) {
      this.data.ads_config = updatedSlots;
      this.save();
    }
  }

  // Called at the start of every single request (see server/index.js
  // middleware). This is what actually keeps multiple concurrent
  // serverless instances consistent with each other: a "warm" instance
  // that has been alive for a while only ever pulled MongoDB's state once,
  // at its own cold start — without re-pulling on every request, any write
  // made on a *different* instance in the meantime would be invisible here
  // (this is exactly what caused balances/gifts/game state to look like
  // they "reset" or got silently overwritten with an older value). Since
  // we always flush() before a response goes out (see below), the document
  // in MongoDB is always the source of truth, so it's safe/cheap to just
  // re-pull it fresh at the top of every request.
  async ensureFresh() {
    if (this.dirty) {
      // We have local changes not yet flushed (shouldn't normally happen —
      // flush() runs before every response — but never discard pending
      // writes by overwriting them with an older remote read).
      await this.flush();
    }
    try {
      await this.pullRemoteState();
    } catch (err) {
      console.error('MongoDB Atlas refresh error (continuing with last known state):', err.message);
    }
  }

  save() {
    this.saveLocal();
    // Just mark state as dirty here — do NOT schedule a delayed/debounced
    // background sync. On serverless (Vercel), the function's execution
    // context can be frozen the instant the HTTP response is sent, so a
    // setTimeout() scheduled here is not guaranteed to ever run, and any
    // write that only landed in `this.data` + the local /tmp file (which is
    // unique to that one serverless instance) is invisible to every other
    // instance — including whichever instance serves the admin panel. That
    // is what caused new users/referrals to "disappear" from the admin view.
    // `flush()` (awaited by middleware before every response is sent, see
    // server/index.js) performs the actual Mongo write synchronously with
    // the request instead.
    this.dirty = true;
  }

  // Persist any pending in-memory changes to MongoDB right now, and wait
  // for it to finish. Safe to call often — it's a no-op when there is
  // nothing new to persist or Mongo isn't connected.
  async flush() {
    if (!this.dirty || !this.isMongoConnected || !this.mongoCollection) return;
    this.dirty = false;
    try {
      await this.syncToMongo();
    } catch (err) {
      console.error('MongoDB Atlas flush error (will retry on next write):', err.message);
      this.dirty = true;
    }
  }

  // Build a MongoDB $set document containing ONLY the paths this request
  // actually changed (diffed against the snapshot taken right after the
  // last pullRemoteState()). This is the fix for the "balance resets to 0"
  // bug: the old code did `$set: { data: this.data }` — a full-document
  // overwrite — so two concurrent requests (two different users, two
  // different serverless instances) would race, and whichever one flushed
  // last would silently erase the other's write, because it was still
  // holding a stale full copy of `data` that didn't include the other
  // user's change. Setting only `data.users.<id>` (and only the specific
  // top-level sections that changed) means concurrent writes to different
  // users/sections can never clobber each other, because MongoDB applies
  // each dotted $set path independently.
  buildTargetedUpdate() {
    if (!this._preSnapshot) return null; // no baseline yet — caller falls back to a full write
    const set = {};
    const before = this._preSnapshot;
    const after = this.data;

    const beforeUsers = before.users || {};
    const afterUsers = after.users || {};
    for (const id of Object.keys(afterUsers)) {
      if (JSON.stringify(afterUsers[id]) !== JSON.stringify(beforeUsers[id])) {
        set[`data.users.${id}`] = afterUsers[id];
      }
    }

    for (const key of Object.keys(after)) {
      if (key === 'users') continue;
      if (JSON.stringify(after[key]) !== JSON.stringify(before[key])) {
        set[`data.${key}`] = after[key];
      }
    }

    return set;
  }

  async syncToMongo() {
    if (!this.isMongoConnected || !this.mongoCollection) return;
    try {
      const targeted = this.buildTargetedUpdate();
      const setDoc = { updated_at: new Date().toISOString() };
      if (targeted) {
        Object.assign(setDoc, targeted);
      } else {
        // No baseline snapshot available yet (e.g. very first write before
        // any successful pull) — safe fallback to the old full-document
        // write so nothing is ever silently skipped.
        setDoc.data = this.data;
      }
      await this.mongoCollection.updateOne(
        { _id: 'main_state' },
        { $set: setDoc },
        { upsert: true }
      );
    } catch (err) {
      console.error('MongoDB Atlas sync error:', err.message);
    }
  }

  // Get current daily cycle date (resets at 9:00 AM Bangladesh Time = 03:00 UTC globally)
  getDailyDate(dateInput = new Date()) {
    const d = new Date(dateInput);
    // 9:00 AM BST = 03:00 UTC. Subtracting 3 hours aligns the rollover with 9:00 AM Bangladesh Time.
    const offsetTime = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    return offsetTime.toISOString().split('T')[0];
  }

  // User Management
  getUser(userId) {
    const id = String(userId);
    return this.data.users[id] || null;
  }

  getOrCreateUser(telegramUser, referrerId = null, meta = {}) {
    const { deviceId = null, ip = null } = meta;
    const id = String(telegramUser.id);
    const today = this.getDailyDate();
    let isNewUser = false;

    if (!this.data.users[id]) {
      let refId = null;
      if (referrerId && String(referrerId) !== id && this.data.users[String(referrerId)]) {
        refId = String(referrerId);
        // Do NOT increment referrer count or give diamonds yet!
        // Referrals only become valid when the friend completes mandatory channel/group verification.
      }

      this.data.users[id] = {
        id,
        first_name: telegramUser.first_name || 'Hunter',
        last_name: telegramUser.last_name || '',
        username: telegramUser.username || '',
        photo_url: telegramUser.photo_url || '',
        diamonds: 0,
        usdt: 0.0,
        keys: 5, // 5 Welcome Chest Keys for 1st time users!
        spins: 15,
        crystal_coins: 0,
        total_chest_opens: 0,
        daily_streak: 0,
        last_daily_claim: null,
        claimed_first_week_crystal: false,
        missed_first_week_crystal: false,
        total_daily_cycles: 0,
        referrer_id: refId,
        referral_step1_claimed: false,
        referral_step2_claimed: false,
        referral_step3_claimed: false,
        referral_grand_prize_claimed: false,
        total_referrals: 0,
        referral_earnings_diamonds: 0,
        total_ads_watched: 0,
        is_banned: false,
        last_daily_reset: today,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        device_conflict: false,
        device_conflict_linked: null,
        ip_conflict: false,
        ip_conflict_linked: null,
        signup_ip: ip || null
      };
      isNewUser = true;
      this.save();
    } else {
      // Update profile info
      const u = this.data.users[id];
      u.first_name = telegramUser.first_name || u.first_name;
      u.last_name = telegramUser.last_name || u.last_name;
      u.username = telegramUser.username || u.username;
      if (telegramUser.photo_url) u.photo_url = telegramUser.photo_url;
      
      // Link referrer if user was created without one and hasn't verified gate yet
      if (referrerId && String(referrerId) !== id && this.data.users[String(referrerId)] && !u.referrer_id && !u.is_mandatory_verified) {
        u.referrer_id = String(referrerId);
      }

      // Daily reset for daily ad limits and daily activity
      if (u.last_daily_reset !== today) {
        u.last_daily_reset = today;
      }
      u.updated_at = new Date().toISOString();
      this.save();
    }

    // --- Anti-duplicate-account enforcement (server-side, mandatory) ---
    // This used to be an endpoint the frontend could simply never call
    // (and never did) — anyone hitting the API directly (curl, devtools,
    // automation tools) skipped it entirely. Now it runs on every single
    // sync, for every client, with no way to opt out of it.
    const user = this.data.users[id];
    if (deviceId) {
      const lockCheck = this.checkDeviceLock(id, deviceId);
      const wasConflicted = !!user.device_conflict;
      user.device_conflict = lockCheck.isDuplicate;
      user.device_conflict_linked = lockCheck.isDuplicate ? lockCheck.linkedUser : null;
      if (wasConflicted !== user.device_conflict) this.save();
    }

    // Same-IP lock: up to MAX_ACCOUNTS_PER_IP distinct accounts are allowed
    // per IP (shared home/office WiFi, mobile-network NAT) before the next
    // one is blocked — see checkIpLock().
    if (ip) {
      const ipCheck = this.checkIpLock(id, ip);
      const wasIpConflicted = !!user.ip_conflict;
      user.ip_conflict = ipCheck.isDuplicate;
      user.ip_conflict_linked = ipCheck.isDuplicate ? ipCheck.linkedUsers : null;
      if (wasIpConflicted !== user.ip_conflict) this.save();
    }

    // Lightweight IP-burst signal: flag (never auto-block) an account whose
    // signup IP created an unusual number of other accounts recently. This
    // is informational for the admin panel — device_conflict/ip_conflict
    // above are what actually stop reward abuse.
    if (isNewUser && ip) {
      if (!this.data.signup_ips) this.data.signup_ips = {};
      const nowTs = Date.now();
      const windowMs = 60 * 60 * 1000; // 1 hour
      const recent = (this.data.signup_ips[ip] || []).filter(ts => nowTs - ts < windowMs);
      recent.push(nowTs);
      this.data.signup_ips[ip] = recent;
      if (recent.length > 4) {
        user.flagged_multi_account_ip = true;
      }
      this.save();
    }

    return this.data.users[id];
  }

  updateUser(userId, fields) {
    const id = String(userId);
    if (!this.data.users[id]) return null;
    this.data.users[id] = {
      ...this.data.users[id],
      ...fields,
      updated_at: new Date().toISOString()
    };
    this.save();
    return this.data.users[id];
  }

  // Tasks Management
  getTasks(category = null) {
    let list = this.data.tasks.filter(t => {
      if (!t.is_active) return false;
      // If user-created task with status, must be 'approved'
      if (t.status && t.status !== 'approved') return false;
      // If task has max_users limit, ensure not already exceeded
      if (t.max_users && (t.current_completed || 0) >= t.max_users) return false;
      return true;
    });

    if (category) {
      list = list.filter(t => t.category === category);
    }
    return list;
  }

  getUserTasks(userId) {
    const uid = String(userId);
    return this.data.tasks.filter(t => String(t.creator_id) === uid);
  }

  getTaskById(taskId) {
    return this.data.tasks.find(t => t.id === taskId) || null;
  }

  addTask(taskData) {
    const id = `task_${Date.now()}`;
    const newTask = {
      id,
      category: taskData.category || 'social',
      type: taskData.type || 'website',
      title: taskData.title,
      description: taskData.description || '',
      link: taskData.link,
      chat_id: taskData.chat_id || '',
      reward_diamonds: Number(taskData.reward_diamonds) || 100,
      max_users: taskData.max_users ? Number(taskData.max_users) : null,
      current_completed: 0,
      is_active: true,
      created_at: new Date().toISOString()
    };
    this.data.tasks.unshift(newTask);
    this.save();
    return newTask;
  }

  createUserExclusiveTask(userId, taskData) {
    const id = `task_user_${Date.now()}`;
    let qty = Number(taskData.max_users || taskData.quantity || 100);
    if (isNaN(qty) || qty < 100) qty = 100;
    if (qty > 2000) qty = 2000;
    qty = Math.round(qty / 100) * 100; // Multiples of 100

    const isVerified = taskData.verification_type === 'verified';
    // Rate: Unverified = 0.10 TON / 100 users; Verified (Bot admin checked) = 0.20 TON / 100 users
    const ratePer100 = isVerified ? 0.20 : 0.10;
    const tonCost = Number(((qty / 100) * ratePer100).toFixed(2));
    const title = (taskData.title || '').trim();
    const link = (taskData.link || '').trim();

    if (!title) throw new Error('Task title is required');
    if (!link) throw new Error('Task target link / URL is required');

    // Extract potential chat_id from t.me link if verified
    let chatId = (taskData.chat_id || '').trim();
    if (isVerified && !chatId && link.includes('t.me/')) {
      const match = link.match(/t\.me\/([a-zA-Z0-9_]+)/);
      if (match && match[1]) {
        chatId = '@' + match[1];
      }
    }

    const newTask = {
      id,
      creator_id: String(userId),
      category: 'exclusive',
      type: taskData.type || 'website',
      verification_type: isVerified ? 'verified' : 'unverified',
      title,
      description: taskData.description?.trim() || `Complete visit to earn 10 GEMS (${qty} hunters campaign)`,
      link,
      chat_id: chatId,
      reward_diamonds: 10, // Exclusive community tasks reward 10 GEMS
      max_users: qty,
      current_completed: 0,
      ton_cost: tonCost,
      status: 'pending_payment', // 'pending_payment' | 'approved' | 'completed' | 'rejected'
      is_active: false,
      created_at: new Date().toISOString()
    };

    this.data.tasks.unshift(newTask);
    this.save();
    return newTask;
  }

  payUserExclusiveTask(userId, taskId) {
    const adminId = String(process.env.ADMIN_ID || '7780774047');
    const task = this.getTaskById(taskId);
    if (!task) throw new Error('Task campaign not found');
    if (String(task.creator_id) !== String(userId) && String(userId) !== adminId) {
      throw new Error('Unauthorized to modify this task');
    }

    task.status = 'approved';
    task.is_active = true;
    task.paid_at = new Date().toISOString();
    this.save();
    return task;
  }

  cancelUserExclusiveTask(userId, taskId) {
    const adminId = String(process.env.ADMIN_ID || '7780774047');
    const taskIndex = this.data.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) throw new Error('Task campaign not found');
    
    const task = this.data.tasks[taskIndex];
    if (String(task.creator_id) !== String(userId) && String(userId) !== adminId) {
      throw new Error('Unauthorized to modify this task');
    }

    if (task.status === 'pending_payment') {
      this.data.tasks.splice(taskIndex, 1);
    } else {
      task.status = 'rejected';
      task.is_active = false;
    }
    this.save();
    return { success: true };
  }

  editUserExclusiveTask(userId, taskId, updates) {
    const adminId = String(process.env.ADMIN_ID || '7780774047');
    const task = this.getTaskById(taskId);
    if (!task) throw new Error('Task campaign not found');
    if (String(task.creator_id) !== String(userId) && String(userId) !== adminId) {
      throw new Error('Unauthorized to modify this task');
    }

    if (task.status !== 'pending_payment') {
      throw new Error('Only unpaid draft campaigns can be edited. Active posts cannot be edited directly.');
    }

    const title = (updates.title || task.title).trim();
    const link = (updates.link || task.link).trim();
    let qty = Number(updates.max_users || updates.quantity || task.max_users || 100);
    if (isNaN(qty) || qty < 100) qty = 100;
    if (qty > 2000) qty = 2000;
    qty = Math.round(qty / 100) * 100;

    const isVerified = updates.verification_type ? updates.verification_type === 'verified' : task.verification_type === 'verified';
    const ratePer100 = isVerified ? 0.20 : 0.10;
    const tonCost = Number(((qty / 100) * ratePer100).toFixed(2));

    let chatId = (updates.chat_id || task.chat_id || '').trim();
    if (isVerified && !chatId && link.includes('t.me/')) {
      const match = link.match(/t\.me\/([a-zA-Z0-9_]+)/);
      if (match && match[1]) {
        chatId = '@' + match[1];
      }
    }

    task.title = title;
    task.link = link;
    task.type = updates.type || task.type;
    task.verification_type = isVerified ? 'verified' : 'unverified';
    task.chat_id = chatId;
    task.description = updates.description?.trim() || `Complete visit to earn 10 GEMS (${qty} hunters campaign)`;
    task.max_users = qty;
    task.ton_cost = tonCost;
    task.updated_at = new Date().toISOString();

    this.save();
    return task;
  }

  boostUserExclusiveTask(userId, taskId, boostQty) {
    const adminId = String(process.env.ADMIN_ID || '7780774047');
    const task = this.getTaskById(taskId);
    if (!task) throw new Error('Task campaign not found');
    if (String(task.creator_id) !== String(userId) && String(userId) !== adminId) {
      throw new Error('Unauthorized to modify this task');
    }

    let addQty = Number(boostQty || 100);
    if (isNaN(addQty) || addQty < 100) addQty = 100;
    if (addQty > 2000) addQty = 2000;
    addQty = Math.round(addQty / 100) * 100;

    const ratePer100 = task.verification_type === 'verified' ? 0.20 : 0.10;
    const additionalCost = Number(((addQty / 100) * ratePer100).toFixed(2));

    task.max_users += addQty;
    task.ton_cost = Number(((task.ton_cost || 0) + additionalCost).toFixed(2));
    task.status = 'approved';
    task.is_active = true;
    task.boosted_at = new Date().toISOString();
    task.updated_at = new Date().toISOString();

    this.save();
    return { task, additionalCost, addQty };
  }

  deleteTask(taskId) {
    this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
    this.save();
  }

  // Task Completion
  isTaskCompleted(userId, taskId) {
    const key = `${userId}_${taskId}`;
    return !!this.data.task_completions[key];
  }

  completeTask(userId, taskId) {
    const key = `${userId}_${taskId}`;
    const task = this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');
    if (this.isTaskCompleted(userId, taskId)) throw new Error('Task already completed');

    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    // Mark completed
    this.data.task_completions[key] = {
      user_id: String(userId),
      task_id: taskId,
      reward_diamonds: task.reward_diamonds,
      completed_at: new Date().toISOString()
    };

    // Increment completed count
    task.current_completed = (task.current_completed || 0) + 1;
    if (task.max_users && task.current_completed >= task.max_users) {
      task.is_active = false;
      task.status = 'completed';
    }

    // Add diamonds to user
    user.diamonds += task.reward_diamonds;

    // Milestone 2: Friend completes 5 tasks -> Referrer gets +100 Diamonds
    const userTaskCount = Object.values(this.data.task_completions || {}).filter(
      tc => String(tc.user_id) === String(userId)
    ).length;

    if (user.referrer_id && this.data.users[user.referrer_id] && !user.referral_step2_claimed && userTaskCount >= 5) {
      user.referral_step2_claimed = true;
      const referrer = this.data.users[user.referrer_id];
      referrer.diamonds = (referrer.diamonds || 0) + 100;
      referrer.referral_earnings_diamonds = (referrer.referral_earnings_diamonds || 0) + 100;

      // Check Grand Prize: 1 Free Crystal Coin (🔮) if all 3 conditions met
      if (user.referral_step1_claimed && user.referral_step2_claimed && user.referral_step3_claimed && !user.referral_grand_prize_claimed) {
        user.referral_grand_prize_claimed = true;
        referrer.crystal_coins = (referrer.crystal_coins || 0) + 1;
      }
    }

    this.save();
    return { user, task };
  }

  // Ads Config & Tracking
  getAdsConfig() {
    this.ensureFourAdSlots();
    return this.data.ads_config.filter(a => !a.is_hidden);
  }

  getAllAdsConfig() {
    this.ensureFourAdSlots();
    return this.data.ads_config;
  }

  updateAdConfig(adId, updates) {
    const ad = this.data.ads_config.find(a => a.id === adId);
    if (ad) {
      const { reward_diamonds, is_hidden, max_daily, block_id, name, network_id, logo_url } = updates;
      if (reward_diamonds !== undefined) ad.reward_diamonds = Math.max(0, Number(reward_diamonds) || 0);
      if (is_hidden !== undefined) ad.is_hidden = Boolean(is_hidden);
      if (max_daily !== undefined) ad.max_daily = Math.max(1, Number(max_daily) || 10);
      if (block_id !== undefined) ad.block_id = String(block_id).trim();
      if (name !== undefined) ad.name = String(name).trim();
      if (network_id !== undefined) ad.network_id = String(network_id).trim();
      if (logo_url !== undefined) ad.logo_url = String(logo_url).trim();
      this.save();
    }
    return ad;
  }

  updateAllAdsConfig(newAdsList) {
    if (!Array.isArray(newAdsList)) return this.data.ads_config;
    for (const incoming of newAdsList) {
      const existing = this.data.ads_config.find(a => a.id === incoming.id);
      if (existing) {
        if (incoming.reward_diamonds !== undefined) existing.reward_diamonds = Math.max(0, Number(incoming.reward_diamonds) || 0);
        if (incoming.is_hidden !== undefined) existing.is_hidden = Boolean(incoming.is_hidden);
        if (incoming.max_daily !== undefined) existing.max_daily = Math.max(1, Number(incoming.max_daily) || 10);
        if (incoming.block_id !== undefined) existing.block_id = String(incoming.block_id).trim();
        if (incoming.name !== undefined) existing.name = String(incoming.name).trim();
        if (incoming.network_id !== undefined) existing.network_id = String(incoming.network_id).trim();
        if (incoming.logo_url !== undefined) existing.logo_url = String(incoming.logo_url).trim();
      }
    }
    this.save();
    return this.data.ads_config;
  }

  getAdNetworks() {
    return this.data.ad_networks || [];
  }

  // Assign a different ad network to a slot. Only name/logo_url/block_id/
  // network_id change — the slot's own reward_diamonds, is_hidden and
  // max_daily are left exactly as they were, since the reward belongs to
  // the SLOT (position), not to whichever network is currently showing
  // there.
  assignAdNetworkToSlot(slotId, networkId) {
    const slot = this.data.ads_config.find(a => a.id === slotId);
    if (!slot) throw new Error('Ad slot not found');
    const network = (this.data.ad_networks || []).find(n => n.id === networkId);
    if (!network) throw new Error('Ad network not found');

    slot.network_id = network.id;
    slot.name = network.name;
    slot.logo_url = network.logo_url;
    slot.block_id = network.block_id;

    this.save();
    return slot;
  }

  getDailyAdCount(userId, adId) {
    const today = this.getDailyDate();
    const key = `${userId}_${adId}_${today}`;
    return this.data.daily_ads_completed[key] || 0;
  }

  recordAdWatch(userId, adId) {
    const today = this.getDailyDate();
    const key = `${userId}_${adId}_${today}`;
    const count = (this.data.daily_ads_completed[key] || 0) + 1;
    this.data.daily_ads_completed[key] = count;

    const ad = this.data.ads_config.find(a => a.id === adId);
    const reward = ad ? ad.reward_diamonds : 50;
    
    const user = this.getUser(userId);
    if (user) {
      user.diamonds += reward;
      user.total_ads_watched = (user.total_ads_watched || 0) + 1;

      // Milestone 3: Friend watches 20 ads -> Referrer gets +180 Diamonds
      if (user.referrer_id && this.data.users[user.referrer_id] && !user.referral_step3_claimed && user.total_ads_watched >= 20) {
        user.referral_step3_claimed = true;
        const referrer = this.data.users[user.referrer_id];
        referrer.diamonds = (referrer.diamonds || 0) + 180;
        referrer.referral_earnings_diamonds = (referrer.referral_earnings_diamonds || 0) + 180;

        // Check Grand Prize: 1 Free Crystal Coin (🔮) if all 3 conditions met
        if (user.referral_step1_claimed && user.referral_step2_claimed && user.referral_step3_claimed && !user.referral_grand_prize_claimed) {
          user.referral_grand_prize_claimed = true;
          referrer.crystal_coins = (referrer.crystal_coins || 0) + 1;
        }
      }
    }
    this.save();
    return { count, reward, user };
  }

  // Conversion (Diamonds to USDT)
  convertDiamonds(userId, amount) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');
    const diamonds = Math.floor(Number(amount));
    
    // Minimum 1000 Gems requirement
    if (isNaN(diamonds) || diamonds < 1000) {
      throw new Error('Minimum conversion amount is 1,000 GEMS');
    }
    if (user.diamonds < diamonds) {
      throw new Error('Insufficient GEMS balance');
    }

    const rate = this.data.settings.diamond_to_usd_rate || 0.00004;
    const grossUsdt = Number((diamonds * rate).toFixed(4));
    const feeRate = 0.25; // 25% fee
    const feeUsdt = Number((grossUsdt * feeRate).toFixed(4));
    const netUsdt = Number((grossUsdt - feeUsdt).toFixed(4));

    user.diamonds -= diamonds;
    user.usdt = Number(((user.usdt || 0) + netUsdt).toFixed(4));

    const conversion = {
      id: `conv_${Date.now()}`,
      user_id: String(userId),
      diamonds_amount: diamonds,
      gross_usdt: grossUsdt,
      fee_usdt: feeUsdt,
      fee_rate: '25%',
      usdt_amount: netUsdt,
      rate,
      created_at: new Date().toISOString()
    };
    this.data.conversions.unshift(conversion);
    this.save();

    return { user, conversion };
  }

  // Daily Activity Tracking for Withdrawal Requirements (Resets at 9:00 AM Bangladesh Time)
  getDailyTasksCompleted(userId) {
    const today = this.getDailyDate();
    let adsCount = 0;
    for (const ad of this.data.ads_config || []) {
      const key = `${userId}_${ad.id}_${today}`;
      adsCount += (this.data.daily_ads_completed && this.data.daily_ads_completed[key]) || 0;
    }
    let tasksCount = 0;
    for (const comp of Object.values(this.data.task_completions || {})) {
      if (String(comp.user_id) === String(userId) && comp.completed_at) {
        if (this.getDailyDate(comp.completed_at) === today) {
          tasksCount += 1;
        }
      }
    }
    return adsCount + tasksCount;
  }

  getDailyGamesPlayed(userId) {
    const today = this.getDailyDate();
    const drawCount = (this.data.game_daily_counts && this.data.game_daily_counts[`${userId}_draw_${today}`]) || 0;
    const tttCount = (this.data.game_daily_counts && this.data.game_daily_counts[`${userId}_ttt_${today}`]) || 0;
    return drawCount + tttCount;
  }

  getWithdrawalRequirements(userId) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    const tasksCompleted = this.getDailyTasksCompleted(userId);
    const tasksRequired = 20;
    const isTasksDone = tasksCompleted >= tasksRequired;

    const gamesPlayed = this.getDailyGamesPlayed(userId);
    const gamesRequired = 5;
    const isGamesDone = gamesPlayed >= gamesRequired;

    // Count past withdrawals
    const userWithdrawals = this.getWithdrawals(userId);
    const totalWithdrawals = userWithdrawals.length;
    const isFirstWithdrawal = totalWithdrawals === 0;

    const crystalCoins = user.crystal_coins || 0;
    const crystalRequired = isFirstWithdrawal ? 0 : 1;
    const isCrystalDone = isFirstWithdrawal || crystalCoins >= 1;

    const canWithdraw = isTasksDone && isGamesDone && isCrystalDone;

    return {
      tasksCompleted,
      tasksRequired,
      isTasksDone,
      gamesPlayed,
      gamesRequired,
      isGamesDone,
      totalWithdrawals,
      isFirstWithdrawal,
      crystalCoins,
      crystalRequired,
      isCrystalDone,
      canWithdraw
    };
  }

  // Store: Buy Crystal Coin (250 GEMS per Crystal Coin)
  buyCrystalCoin(userId, quantity = 1) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Please enter a valid quantity of Crystal Coins');
    }

    const COST_PER_CRYSTAL = 250; // 250 GEMS
    const totalCost = qty * COST_PER_CRYSTAL;

    if ((user.diamonds || 0) < totalCost) {
      throw new Error(`Insufficient GEMS! You need ${totalCost.toLocaleString()} GEMS to buy ${qty} Crystal Coin(s).`);
    }

    user.diamonds -= totalCost;
    user.crystal_coins = (user.crystal_coins || 0) + qty;
    this.save();

    return {
      user,
      quantity: qty,
      costGems: totalCost,
      crystalCoins: user.crystal_coins
    };
  }

  // Check if wallet address is already used by another user
  isWalletAddressUnique(network, address, currentUserId) {
    const cleanAddr = address.trim();
    for (const u of Object.values(this.data.users)) {
      if (String(u.id) === String(currentUserId)) continue;
      if (u.wallets && u.wallets[network] && u.wallets[network].trim().toLowerCase() === cleanAddr.toLowerCase()) {
        return false;
      }
    }
    return true;
  }

  // Withdrawal with daily requirements, crystal coin and locked wallet
  createWithdrawal(userId, amountUsdt, network, walletAddress) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    // 1. Enforce Withdrawal Requirements
    const reqs = this.getWithdrawalRequirements(userId);
    if (!reqs.isTasksDone) {
      throw new Error(`Withdrawal Locked: You must complete at least 20 tasks/ads today (${reqs.tasksCompleted}/20 completed)`);
    }
    if (!reqs.isGamesDone) {
      throw new Error(`Withdrawal Locked: You must play at least 5 games today (${reqs.gamesPlayed}/5 played)`);
    }
    if (!reqs.isCrystalDone) {
      throw new Error('Withdrawal Locked: 1 Crystal Coin required for this withdrawal. Buy it from the Store for 250 GEMS!');
    }

    const amount = Number(amountUsdt);
    
    // Minimum withdrawal 0.05$ USDT
    const minWd = 0.05;
    if (isNaN(amount) || amount < minWd) {
      throw new Error(`Minimum withdrawal is $${minWd.toFixed(2)} USDT`);
    }
    if ((user.usdt || 0) < amount) {
      throw new Error('Insufficient USDT balance');
    }

    const net = (network || 'BINANCE').toUpperCase();
    const cleanAddr = (walletAddress || '').trim();

    if (!cleanAddr) {
      throw new Error('Wallet address/UID is required');
    }

    if (!user.wallets) user.wallets = {};

    let finalAddress = cleanAddr;

    // If user already has a permanently locked wallet for this network, enforce it
    if (user.wallets[net]) {
      finalAddress = user.wallets[net];
    } else {
      // Validate formats
      if (net === 'BINANCE') {
        if (!/^\d+$/.test(cleanAddr)) {
          throw new Error('Binance Pay ID / UID must contain only digits (numbers).');
        }
        if (cleanAddr.length < 5 || cleanAddr.length > 15) {
          throw new Error('Please enter a valid Binance UID (5-15 digits).');
        }
      } else if (net === 'TON') {
        if (!cleanAddr.startsWith('EQ') && !cleanAddr.startsWith('UQ')) {
          throw new Error('TON Wallet address must start with "EQ" or "UQ" and be 48 characters long.');
        }
        if (cleanAddr.length !== 48) {
          throw new Error('Invalid TON Wallet address! TON addresses are exactly 48 characters long.');
        }
      }

      // Check global uniqueness across all users
      if (!this.isWalletAddressUnique(net, cleanAddr, userId)) {
        throw new Error('This wallet address / UID is already bound to another account. Duplicate wallets are not allowed.');
      }

      // Permanently lock the wallet to this user
      user.wallets[net] = cleanAddr;
    }

    // Deduct Crystal Coin if not first withdrawal
    if (!reqs.isFirstWithdrawal) {
      user.crystal_coins = Math.max(0, (user.crystal_coins || 0) - 1);
    }

    // Deduct exact amount (0% withdrawal fee)
    user.usdt = Number((user.usdt - amount).toFixed(4));

    // Handle 10% lifetime referral commission
    if (user.referrer_id && this.data.users[user.referrer_id]) {
      const refUser = this.data.users[user.referrer_id];
      const commissionUsdt = Number((amount * 0.10).toFixed(4));
      const rate = this.data.settings.diamond_to_usd_rate || 0.00004;
      const commissionDiamonds = Math.round(commissionUsdt / rate);
      
      refUser.diamonds += commissionDiamonds;
      refUser.referral_earnings_diamonds = (refUser.referral_earnings_diamonds || 0) + commissionDiamonds;
    }

    const rate = this.data.settings.diamond_to_usd_rate || 0.00004;
    const amountDiamonds = Math.round(amount / rate);

    const withdrawal = {
      id: `wd_${Date.now()}`,
      user_id: String(userId),
      username: user.username,
      amount_usdt: amount,
      amount_diamonds: amountDiamonds,
      network: net,
      wallet_address: finalAddress,
      crystal_used: reqs.isFirstWithdrawal ? 0 : 1,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.withdrawals.unshift(withdrawal);
    this.save();

    return { user, withdrawal };
  }

  // Admin: Update User Wallet Address (Exact override)
  adminUpdateUserWallet(userId, network, newAddress) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');
    const net = (network || 'BINANCE').toUpperCase();
    const cleanAddr = (newAddress || '').trim();

    if (!user.wallets) user.wallets = {};

    if (!cleanAddr) {
      delete user.wallets[net];
      this.save();
      return user;
    }

    // Check uniqueness if updating
    if (!this.isWalletAddressUnique(net, cleanAddr, userId)) {
      throw new Error(`Wallet address already in use by another user`);
    }

    user.wallets[net] = cleanAddr;
    this.save();
    return user;
  }

  getWithdrawals(userId = null) {
    if (userId) {
      return this.data.withdrawals.filter(w => w.user_id === String(userId));
    }
    return this.data.withdrawals;
  }

  updateWithdrawalStatus(withdrawalId, status) {
    const wd = this.data.withdrawals.find(w => w.id === withdrawalId);
    if (!wd) throw new Error('Withdrawal request not found');
    wd.status = status;
    wd.updated_at = new Date().toISOString();

    // If rejected, refund user
    if (status === 'rejected') {
      const user = this.getUser(wd.user_id);
      if (user) {
        user.usdt = Number((user.usdt + wd.amount_usdt).toFixed(4));
        if (wd.crystal_used) {
          user.crystal_coins = (user.crystal_coins || 0) + wd.crystal_used;
        }
      }
    }
    this.save();
    return wd;
  }

  // Chest Open with Exact 100-Step Chain Rule
  // Step 1: 20 GEMS
  // Step 2-50: 10 GEMS
  // Step 51-60: 20 GEMS
  // Step 61-80: 10 GEMS
  // Step 81-99: 15 GEMS
  // Step 100: 0.005$ USDT Jackpot
  // Loop repeats indefinitely!
  openChest(userId) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');
    if (user.keys <= 0) throw new Error('No keys left! Come back tomorrow or complete tasks.');

    user.keys -= 1;

    const currentOpens = user.total_chest_opens || 0;
    const step = (currentOpens % 100) + 1; // 1 to 100

    let rewardType = 'diamonds';
    let rewardAmount = 10;
    let rewardLabel = '10 GEMS';

    if (step === 1) {
      // 1st open: 20 GEMS
      rewardType = 'diamonds';
      rewardAmount = 20;
      rewardLabel = '20 GEMS';
      user.diamonds += 20;
    } else if (step >= 2 && step <= 50) {
      // 2nd to 50th open: 10 GEMS
      rewardType = 'diamonds';
      rewardAmount = 10;
      rewardLabel = '10 GEMS';
      user.diamonds += 10;
    } else if (step >= 51 && step <= 60) {
      // 51st to 60th open: 20 GEMS
      rewardType = 'diamonds';
      rewardAmount = 20;
      rewardLabel = '20 GEMS';
      user.diamonds += 20;
    } else if (step >= 61 && step <= 80) {
      // 61st to 80th open: 10 GEMS
      rewardType = 'diamonds';
      rewardAmount = 10;
      rewardLabel = '10 GEMS';
      user.diamonds += 10;
    } else if (step >= 81 && step <= 99) {
      // 81st to 99th open: 15 GEMS
      rewardType = 'diamonds';
      rewardAmount = 15;
      rewardLabel = '15 GEMS';
      user.diamonds += 15;
    } else {
      // 100th open: $0.005 USDT Jackpot!
      rewardType = 'usdt';
      rewardAmount = 0.005;
      rewardLabel = '$0.005 USDT';
      user.usdt = Number(((user.usdt || 0) + 0.005).toFixed(4));
    }

    user.total_chest_opens = currentOpens + 1;
    this.save();

    return {
      user,
      rewardType,
      rewardAmount,
      rewardLabel,
      step,
      totalOpens: user.total_chest_opens,
      remainingKeys: user.keys
    };
  }

  // Promo Codes Management
  getPromoCodes() {
    return this.data.promo_codes || [];
  }

  createPromoCode(codeData) {
    const id = `promo_${Date.now()}`;
    const cleanCode = String(codeData.code).trim().toUpperCase();
    
    // Check if code already exists
    const exists = this.data.promo_codes?.find(p => p.code === cleanCode);
    if (exists) throw new Error('Promo code already exists');

    const newPromo = {
      id,
      code: cleanCode,
      reward_type: codeData.reward_type || 'diamonds',
      reward_amount: Number(codeData.reward_amount) || 100,
      max_uses: codeData.max_uses ? Number(codeData.max_uses) : null,
      uses_count: 0,
      is_active: true,
      created_at: new Date().toISOString()
    };

    if (!this.data.promo_codes) this.data.promo_codes = [];
    this.data.promo_codes.unshift(newPromo);
    this.save();
    return newPromo;
  }

  deletePromoCode(promoId) {
    if (!this.data.promo_codes) return;
    this.data.promo_codes = this.data.promo_codes.filter(p => p.id !== promoId && p.code !== promoId);
    this.save();
  }

  // Enqueue a promo broadcast for all 20k-30k bot users
  enqueuePromoBroadcast(promo) {
    if (!this.data.broadcast_queue) this.data.broadcast_queue = [];
    const allUserIds = Object.keys(this.data.users || {}).filter(uid => /^\d+$/.test(uid));
    const queueItem = {
      id: `bc_${Date.now()}`,
      promo_code: promo.code,
      amount: promo.reward_amount,
      reward_type: promo.reward_type || 'diamonds',
      remaining_user_ids: [...allUserIds],
      total_users: allUserIds.length,
      sent_count: 0,
      failed_count: 0,
      status: allUserIds.length > 0 ? 'pending' : 'completed',
      created_at: new Date().toISOString()
    };
    this.data.broadcast_queue.push(queueItem);
    this.save();
    return queueItem;
  }

  // Enqueue a daily reset broadcast to notify all users at 9:00 AM Bangladesh Time
  enqueueDailyResetBroadcast(force = false) {
    if (!this.data.broadcast_queue) this.data.broadcast_queue = [];
    const today = this.getDailyDate();

    if (!force) {
      const alreadyQueued = this.data.broadcast_queue.some(
        q => q.type === 'daily_reset' && q.cycle_date === today
      );
      if (alreadyQueued) return null;
    }

    const allUserIds = Object.keys(this.data.users || {}).filter(uid => /^\d+$/.test(uid));
    const queueItem = {
      id: `bc_daily_${today}_${Date.now()}`,
      type: 'daily_reset',
      cycle_date: today,
      remaining_user_ids: [...allUserIds],
      total_users: allUserIds.length,
      sent_count: 0,
      failed_count: 0,
      status: allUserIds.length > 0 ? 'pending' : 'completed',
      created_at: new Date().toISOString()
    };
    this.data.broadcast_queue.push(queueItem);
    this.save();
    return queueItem;
  }

  // Automatic check invoked every minute by cron
  checkAndTriggerDailyResetBroadcast() {
    const today = this.getDailyDate();
    if (this.data.last_daily_reset_broadcast === today) return null;

    // Check Bangladesh Time (UTC + 6)
    const now = new Date();
    const bstHour = (now.getUTCHours() + 6) % 24;

    // Trigger in the morning starting from 9:00 AM BST
    // (Prevents firing at random night hours on initial deployment)
    if (bstHour < 9) return null;

    this.data.last_daily_reset_broadcast = today;
    this.save();
    return this.enqueueDailyResetBroadcast();
  }

  getNextBroadcastJob() {
    if (!this.data.broadcast_queue) return null;
    return this.data.broadcast_queue.find(q => q.status === 'pending' && q.remaining_user_ids?.length > 0);
  }

  redeemPromoCode(userId, codeStr) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    const cleanCode = String(codeStr).trim().toUpperCase();
    if (!cleanCode) throw new Error('Please enter a valid promo code');

    const promo = this.data.promo_codes?.find(p => p.code === cleanCode && p.is_active);
    if (!promo) throw new Error('Invalid or expired promo code');

    if (promo.max_uses && promo.uses_count >= promo.max_uses) {
      throw new Error('This promo code has reached its maximum claim limit');
    }

    const redemptionKey = `${userId}_${cleanCode}`;
    if (!this.data.promo_redemptions) this.data.promo_redemptions = {};
    if (this.data.promo_redemptions[redemptionKey]) {
      throw new Error('You have already redeemed this promo code');
    }

    // Award rewards
    if (promo.reward_type === 'diamonds') {
      user.diamonds += promo.reward_amount;
    } else if (promo.reward_type === 'usdt') {
      user.usdt = Number((user.usdt + promo.reward_amount).toFixed(4));
    } else if (promo.reward_type === 'keys') {
      user.keys += promo.reward_amount;
    }

    // Record redemption
    this.data.promo_redemptions[redemptionKey] = {
      user_id: String(userId),
      code: cleanCode,
      reward_type: promo.reward_type,
      reward_amount: promo.reward_amount,
      redeemed_at: new Date().toISOString()
    };

    promo.uses_count = (promo.uses_count || 0) + 1;
    this.save();

    return {
      user,
      rewardType: promo.reward_type,
      rewardAmount: promo.reward_amount,
      code: cleanCode
    };
  }

  // ==========================================
  // TIC-TAC-TOE GAME ENGINE
  // ==========================================

  getTicTacToeSession(userId) {
    if (!this.data.active_games) this.data.active_games = {};
    return this.data.active_games[String(userId)] || null;
  }

  startTicTacToe(userId) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    if (!this.data.active_games) this.data.active_games = {};
    const existing = this.data.active_games[String(userId)];
    if (existing && existing.status === 'in_progress') {
      return { session: existing, user, resumed: true };
    }

    const ENTRY_COST = 1000;
    if ((user.diamonds || 0) < ENTRY_COST) {
      throw new Error(`Insufficient GEMS! You need ${ENTRY_COST} GEMS to start Tic-Tac-Toe.`);
    }

    const todayStr = this.getDailyDate();
    const dailyKey = `${userId}_ttt_${todayStr}`;
    if (!this.data.game_daily_counts) this.data.game_daily_counts = {};
    const tttCount = this.data.game_daily_counts[dailyKey] || 0;

    if (tttCount >= 10) {
      throw new Error('You have reached the daily limit of 10 Tic-Tac-Toe games today! Please come back tomorrow.');
    }

    // Deduct entry fee
    user.diamonds -= ENTRY_COST;

    // Difficulty Logic:
    // Alternating Days:
    // Day A: 100% Unbeatable (Zero chance to win, pure hard minimax)
    // Day B: 1 Beatable match opportunity (gives smart user a chance to win 1 game in the 10 games)
    
    // Calculate day index from epoch (UTC date)
    const dayIndex = Math.floor(new Date().getTime() / (1000 * 60 * 60 * 24));
    const isBeatableDay = dayIndex % 2 === 1; // Alternates every single day

    const winKey = `${userId}_ttt_wins_${todayStr}`;
    const winsToday = this.data.game_daily_counts[winKey] || 0;
    
    let allowMistake = false;
    // Only on beatable days AND if user hasn't already won their 1 game today:
    if (isBeatableDay && winsToday === 0) {
      // 15% chance per match on beatable day to trigger the opportunity, ensuring ~1 beatable game in 10 games
      allowMistake = Math.random() < 0.20;
    }

    const session = {
      id: `ttt_${Date.now()}`,
      userId: String(userId),
      board: Array(9).fill(null),
      isPlayerTurn: true,
      status: 'in_progress',
      entryCost: ENTRY_COST,
      difficultyMode: allowMistake ? 'beatable' : 'hard',
      started_at: new Date().toISOString()
    };

    this.data.active_games[String(userId)] = session;
    this.save();

    return { session, user, resumed: false, gamesToday: tttCount };
  }

  updateTicTacToeSession(userId, board, isPlayerTurn) {
    if (!this.data.active_games) this.data.active_games = {};
    const session = this.data.active_games[String(userId)];
    if (!session) return null;

    session.board = board;
    session.isPlayerTurn = isPlayerTurn;
    this.save();
    return session;
  }

  finishTicTacToe(userId, result, finalBoard) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    if (!this.data.active_games) this.data.active_games = {};
    const session = this.data.active_games[String(userId)];

    // If session doesn't exist, avoid double-awarding
    if (!session) {
      return { user, result, returnAmount: 0 };
    }

    const todayStr = this.getDailyDate();
    let returnAmount = 0;
    let profitText = '';

    if (result === 'win') {
      // User won: receives 1200 GEMS (+200 profit)
      returnAmount = 1200;
      profitText = '+200 GEMS Profit';
      // Record win today
      const winKey = `${userId}_ttt_wins_${todayStr}`;
      this.data.game_daily_counts[winKey] = (this.data.game_daily_counts[winKey] || 0) + 1;
    } else if (result === 'draw') {
      // Match draw: receives 1000 GEMS back (break even)
      returnAmount = 1000;
      profitText = 'Break Even (1000 GEMS Returned)';
    } else {
      // User lost: receives 500 GEMS back (-500 loss)
      returnAmount = 500;
      profitText = '500 GEMS Returned (-500 Loss)';
    }

    user.diamonds += returnAmount;

    // Increment daily count
    const dailyKey = `${userId}_ttt_${todayStr}`;
    if (!this.data.game_daily_counts) this.data.game_daily_counts = {};
    this.data.game_daily_counts[dailyKey] = (this.data.game_daily_counts[dailyKey] || 0) + 1;

    // Remove active game session
    delete this.data.active_games[String(userId)];
    this.save();

    return {
      user,
      result,
      returnAmount,
      profitText,
      gamesToday: this.data.game_daily_counts[dailyKey]
    };
  }

  // ==========================================
  // LUCKY DRAW GAME ENGINE (PROBABILITY CHAIN)
  // ==========================================

  getDailyGameStats(userId) {
    const todayStr = this.getDailyDate();
    if (!this.data.game_daily_counts) this.data.game_daily_counts = {};
    const drawCount = this.data.game_daily_counts[`${userId}_draw_${todayStr}`] || 0;
    const tttCount = this.data.game_daily_counts[`${userId}_ttt_${todayStr}`] || 0;
    return {
      luckyDrawsToday: drawCount,
      maxLuckyDraws: 10,
      tictactoeToday: tttCount,
      maxTictactoe: 10
    };
  }

  playLuckyDraw(userId) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    const todayStr = this.getDailyDate();
    const dailyKey = `${userId}_draw_${todayStr}`;
    if (!this.data.game_daily_counts) this.data.game_daily_counts = {};
    const drawsToday = this.data.game_daily_counts[dailyKey] || 0;

    if (drawsToday >= 10) {
      throw new Error('Daily limit reached! You have completed 10/10 Lucky Draws today. Come back tomorrow!');
    }

    if (!user.total_lucky_draws) user.total_lucky_draws = 0;

    let reward = null;

    // 1. FIRST TIME DRAW EVER -> GUARANTEED 50 GEMS
    if (user.total_lucky_draws === 0) {
      reward = {
        type: 'diamonds',
        amount: 50,
        label: '50 GEMS',
        isFirstTime: true
      };
      user.diamonds += 50;
    } else {
      // 2. CHAIN PROBABILITY RULE:
      // 10% Empty, 65% 10 GEMS, 20% 20 GEMS, 5% 0.005$ USDT
      const rand = Math.random();

      if (rand < 0.10) {
        // 10% Chance: Empty
        reward = {
          type: 'empty',
          amount: 0,
          label: 'Empty Card',
          isFirstTime: false
        };
      } else if (rand < 0.75) {
        // 65% Chance: 10 GEMS (0.10 to 0.75)
        reward = {
          type: 'diamonds',
          amount: 10,
          label: '10 GEMS',
          isFirstTime: false
        };
        user.diamonds += 10;
      } else if (rand < 0.95) {
        // 20% Chance: 20 GEMS (0.75 to 0.95)
        reward = {
          type: 'diamonds',
          amount: 20,
          label: '20 GEMS',
          isFirstTime: false
        };
        user.diamonds += 20;
      } else {
        // 5% Chance: 0.005$ USDT (0.95 to 1.00)
        reward = {
          type: 'usdt',
          amount: 0.005,
          label: '$0.005 USDT',
          isFirstTime: false
        };
        user.usdt = Number(((user.usdt || 0) + 0.005).toFixed(4));
      }
    }

    // Generate random decoys for the other 2 cards
    const pool = ['10 GEMS', '20 GEMS', '50 GEMS', '$0.005 USDT', 'Empty Card'];
    const otherDecoys = pool.filter(p => p !== reward.label).sort(() => 0.5 - Math.random()).slice(0, 2);

    user.total_lucky_draws += 1;
    this.data.game_daily_counts[dailyKey] = drawsToday + 1;
    this.save();

    return {
      user,
      reward,
      otherCards: otherDecoys,
      drawsToday: this.data.game_daily_counts[dailyKey],
      maxDraws: 10
    };
  }

  // ==========================================
  // 7-DAY DAILY REWARDS SYSTEM
  // ==========================================

  getDailyRewardStatus(userId) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    const today = this.getDailyDate();
    const lastClaim = user.last_daily_claim;

    let canClaim = false;
    let currentStreak = user.daily_streak || 0;

    if (!lastClaim) {
      canClaim = true;
    } else if (lastClaim !== today) {
      const lastDate = new Date(lastClaim + 'T00:00:00Z');
      const todayDate = new Date(today + 'T00:00:00Z');
      const diffTime = Math.abs(todayDate - lastDate);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        canClaim = true;
      } else if (diffDays > 1) {
        // Streak broken!
        canClaim = true;
        currentStreak = 0; // Will start day 1 upon claim
      }
    }

    const isFirstWeek = !user.claimed_first_week_crystal && !user.missed_first_week_crystal && (user.total_daily_cycles || 0) === 0;

    // Build 7-Day Schedule
    const schedule = [
      { day: 1, type: 'keys', amount: 1, label: '+1 Chest Key' },
      { day: 2, type: 'diamonds', amount: 5, label: '+5 GEMS' },
      { day: 3, type: 'keys', amount: 1, label: '+1 Chest Key' },
      { day: 4, type: 'diamonds', amount: 10, label: '+10 GEMS' },
      { day: 5, type: 'keys', amount: 1, label: '+1 Chest Key' },
      { day: 6, type: 'diamonds', amount: 20, label: '+20 GEMS' },
      {
        day: 7,
        type: isFirstWeek ? 'crystal_coins' : 'diamonds',
        amount: isFirstWeek ? 1 : 20,
        label: isFirstWeek ? '+1 Crystal Coin' : '+20 GEMS',
        isSpecial: isFirstWeek
      }
    ];

    const currentDayIndex = (currentStreak % 7);
    const nextDayNumber = canClaim ? (currentDayIndex + 1) : (currentDayIndex === 0 ? 7 : currentDayIndex);

    return {
      user,
      canClaim,
      streak: currentStreak,
      nextDayNumber: canClaim ? (currentDayIndex + 1) : nextDayNumber,
      isFirstWeek,
      lastClaimDate: lastClaim,
      schedule
    };
  }

  claimDailyReward(userId) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    const today = this.getDailyDate();
    const lastClaim = user.last_daily_claim;

    if (lastClaim === today) {
      throw new Error('You have already claimed today\'s Daily Reward! Please return tomorrow.');
    }

    let streak = user.daily_streak || 0;

    if (lastClaim) {
      const lastDate = new Date(lastClaim + 'T00:00:00Z');
      const todayDate = new Date(today + 'T00:00:00Z');
      const diffTime = Math.abs(todayDate - lastDate);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        // Missed at least 1 day -> Reset streak
        streak = 0;
        if (!user.claimed_first_week_crystal) {
          user.missed_first_week_crystal = true;
        }
      }
    }

    const nextDay = (streak % 7) + 1; // 1 to 7
    const isFirstWeek = !user.claimed_first_week_crystal && !user.missed_first_week_crystal && (user.total_daily_cycles || 0) === 0;

    let reward = { day: nextDay, type: 'diamonds', amount: 5, label: '+5 GEMS' };

    if (nextDay === 1) {
      reward = { day: 1, type: 'keys', amount: 1, label: '+1 Chest Key' };
      user.keys = (user.keys || 0) + 1;
    } else if (nextDay === 2) {
      reward = { day: 2, type: 'diamonds', amount: 5, label: '+5 GEMS' };
      user.diamonds = (user.diamonds || 0) + 5;
    } else if (nextDay === 3) {
      reward = { day: 3, type: 'keys', amount: 1, label: '+1 Chest Key' };
      user.keys = (user.keys || 0) + 1;
    } else if (nextDay === 4) {
      reward = { day: 4, type: 'diamonds', amount: 10, label: '+10 GEMS' };
      user.diamonds = (user.diamonds || 0) + 10;
    } else if (nextDay === 5) {
      reward = { day: 5, type: 'keys', amount: 1, label: '+1 Chest Key' };
      user.keys = (user.keys || 0) + 1;
    } else if (nextDay === 6) {
      reward = { day: 6, type: 'diamonds', amount: 20, label: '+20 GEMS' };
      user.diamonds = (user.diamonds || 0) + 20;
    } else if (nextDay === 7) {
      if (isFirstWeek) {
        reward = { day: 7, type: 'crystal_coins', amount: 1, label: '+1 Crystal Coin', isSpecial: true };
        user.crystal_coins = (user.crystal_coins || 0) + 1;
        user.claimed_first_week_crystal = true;
      } else {
        reward = { day: 7, type: 'diamonds', amount: 20, label: '+20 GEMS' };
        user.diamonds = (user.diamonds || 0) + 20;
      }
      user.total_daily_cycles = (user.total_daily_cycles || 0) + 1;
    }

    user.daily_streak = streak + 1;
    user.last_daily_claim = today;
    this.save();

    return {
      user,
      reward,
      streak: user.daily_streak,
      dayClaimed: nextDay
    };
  }

  // =========================================================================
  // MANDATORY COMMUNITY GATE CHANNELS (3 Required Telegram Channels / Groups)
  // =========================================================================
  getMandatoryChannelsStatus(userId) {
    const user = this.getUser(userId);
    if (!user) return null;

    if (!user.mandatory_channels) {
      user.mandatory_channels = {
        mandatory_official: false,
        mandatory_community: false,
        mandatory_payment: false
      };
      user.is_mandatory_verified = false;
      this.save();
    }

    const channels = [
      {
        id: 'mandatory_official',
        name: 'TREASURE HUNT OFFICIAL',
        username: '@treasure_hunt_12',
        chat_id: '@treasure_hunt_12',
        link: 'https://t.me/treasure_hunt_12',
        type: 'channel',
        isJoined: !!user.mandatory_channels.mandatory_official
      },
      {
        id: 'mandatory_community',
        name: 'TREASURE HUNT COMMUNITY',
        username: '@treasure_hunt12',
        chat_id: '@treasure_hunt12',
        link: 'https://t.me/treasure_hunt12',
        type: 'group',
        isJoined: !!user.mandatory_channels.mandatory_community
      },
      {
        id: 'mandatory_payment',
        name: 'TREASURE HUNT PAYMENT',
        username: '@treasure_pay',
        chat_id: '@treasure_pay',
        link: 'https://t.me/treasure_pay',
        type: 'channel',
        isJoined: !!user.mandatory_channels.mandatory_payment
      }
    ];

    const allJoined = channels.every(ch => ch.isJoined);
    const isVerified = !!user.is_mandatory_verified || allJoined;

    return {
      isVerified,
      allJoined,
      channels
    };
  }

  verifyMandatoryChannels(userId, verifiedMap = {}) {
    const user = this.getUser(userId);
    if (!user) return null;

    if (!user.mandatory_channels) {
      user.mandatory_channels = {
        mandatory_official: false,
        mandatory_community: false,
        mandatory_payment: false
      };
    }

    const channelKeys = ['mandatory_official', 'mandatory_community', 'mandatory_payment'];
    channelKeys.forEach(key => {
      if (verifiedMap[key] === true) {
        user.mandatory_channels[key] = true;
      }
    });

    const allJoined = channelKeys.every(key => user.mandatory_channels[key] === true);
    if (allJoined) {
      user.is_mandatory_verified = true;

      // Milestone 1: Channel + community join & verify (+30 💎 to referrer & +1 referral count)
      if (user.referrer_id && this.data.users[user.referrer_id] && !user.referral_step1_claimed) {
        user.referral_step1_claimed = true;
        const referrer = this.data.users[user.referrer_id];
        referrer.total_referrals = (referrer.total_referrals || 0) + 1;
        referrer.diamonds = (referrer.diamonds || 0) + 30;
        referrer.referral_earnings_diamonds = (referrer.referral_earnings_diamonds || 0) + 30;
        referrer.weekly_referrals = (referrer.weekly_referrals || 0) + 1;
        referrer.daily_referrals = (referrer.daily_referrals || 0) + 1;

        // Check Grand Prize: 1 Free Crystal Coin (🔮) if all 3 conditions met
        if (user.referral_step1_claimed && user.referral_step2_claimed && user.referral_step3_claimed && !user.referral_grand_prize_claimed) {
          user.referral_grand_prize_claimed = true;
          referrer.crystal_coins = (referrer.crystal_coins || 0) + 1;
        }
      }
    }

    this.save();

    return this.getMandatoryChannelsStatus(userId);
  }

  // ==========================================
  // REFERRAL LEADERBOARDS & WEEKLY CONTEST
  // ==========================================
  getReferralLeaderboards() {
    const allUsers = Object.values(this.data.users || {});
    const todayStr = this.getDailyDate();

    // 1. Top Referrers (All time)
    const topReferrers = [...allUsers]
      .filter(u => (u.total_referrals || 0) > 0)
      .sort((a, b) => (b.total_referrals || 0) - (a.total_referrals || 0))
      .slice(0, 10)
      .map((u, idx) => ({
        rank: idx + 1,
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Hunter',
        username: u.username || `user_${u.id.slice(-4)}`,
        photo_url: u.photo_url || '',
        count: u.total_referrals || 0,
        diamonds: u.diamonds || 0
      }));

    // 2. Today's Top Referrers
    const todayReferrers = [...allUsers]
      .map(u => ({
        ...u,
        today_count: u.last_daily_reset === todayStr ? (u.daily_referrals || Math.min(u.total_referrals || 0, 5)) : 0
      }))
      .filter(u => u.today_count > 0 || (u.total_referrals || 0) > 0)
      .sort((a, b) => (b.today_count || 0) - (a.today_count || 0))
      .slice(0, 10)
      .map((u, idx) => ({
        rank: idx + 1,
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Hunter',
        username: u.username || `user_${u.id.slice(-4)}`,
        photo_url: u.photo_url || '',
        count: u.today_count || u.total_referrals || 0,
        diamonds: u.diamonds || 0
      }));

    // 3. Top Earners (Diamonds earned from referrals + tasks)
    const topEarners = [...allUsers]
      .sort((a, b) => ((b.referral_earnings_diamonds || 0) + (b.diamonds || 0)) - ((a.referral_earnings_diamonds || 0) + (a.diamonds || 0)))
      .slice(0, 10)
      .map((u, idx) => ({
        rank: idx + 1,
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Hunter',
        username: u.username || `user_${u.id.slice(-4)}`,
        photo_url: u.photo_url || '',
        earnings: (u.referral_earnings_diamonds || 0) + (u.diamonds || 0),
        usdt: u.usdt || 0,
        count: u.total_referrals || 0
      }));

    return {
      topReferrers,
      todayReferrers,
      topEarners
    };
  }

  getWeeklyContest() {
    if (!this.data.weekly_contest) {
      this.data.weekly_contest = {
        round: 1,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_locked: false,
        min_referrals: 10
      };
      this.save();
    }

    const now = Date.now();
    const endTime = new Date(this.data.weekly_contest.end_time).getTime();
    const remainingMs = Math.max(0, endTime - now);
    const isLocked = remainingMs <= 0 || !!this.data.weekly_contest.is_locked;

    const allUsers = Object.values(this.data.users || {});
    // Filter users with minimum 10 referrals for the contest
    const contestants = allUsers
      .filter(u => (u.weekly_referrals || u.total_referrals || 0) >= 10)
      .sort((a, b) => (b.weekly_referrals || b.total_referrals || 0) - (a.weekly_referrals || a.total_referrals || 0))
      .slice(0, 10)
      .map((u, idx) => ({
        rank: idx + 1,
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Hunter',
        username: u.username || `user_${u.id.slice(-4)}`,
        photo_url: u.photo_url || '',
        referrals: u.weekly_referrals || u.total_referrals || 0,
        isTop5: idx < 5,
        trophy: idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx < 5 ? '🎖️' : null
      }));

    return {
      round: this.data.weekly_contest.round || 1,
      end_time: this.data.weekly_contest.end_time,
      is_locked: isLocked,
      remaining_seconds: Math.floor(remainingMs / 1000),
      min_referrals: this.data.weekly_contest.min_referrals || 10,
      standings: contestants,
      top5: contestants.slice(0, 5)
    };
  }

  resetWeeklyContest() {
    if (!this.data.weekly_contest) {
      this.data.weekly_contest = { round: 1 };
    }
    this.data.weekly_contest.round = (this.data.weekly_contest.round || 1) + 1;
    this.data.weekly_contest.start_time = new Date().toISOString();
    this.data.weekly_contest.end_time = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    this.data.weekly_contest.is_locked = false;

    // Reset weekly_referrals for users for the new round
    Object.values(this.data.users || {}).forEach(u => {
      u.weekly_referrals = 0;
    });

    this.save();
    return this.getWeeklyContest();
  }

  // ==========================================
  // ADMIN BALANCE ADJUSTMENT & GIFTS
  // ==========================================
  adminAdjustBalance(userId, { type, amount, action }) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    const numAmount = Math.abs(Number(amount));
    if (isNaN(numAmount) || numAmount <= 0) throw new Error('Invalid amount');

    if (type === 'diamonds') {
      if (action === 'add') user.diamonds += numAmount;
      else user.diamonds = Math.max(0, user.diamonds - numAmount);
    } else if (type === 'usdt') {
      if (action === 'add') user.usdt = Number((user.usdt + numAmount).toFixed(4));
      else user.usdt = Math.max(0, Number((user.usdt - numAmount).toFixed(4)));
    } else if (type === 'keys') {
      if (action === 'add') user.keys += Math.floor(numAmount);
      else user.keys = Math.max(0, user.keys - Math.floor(numAmount));
    } else {
      throw new Error('Invalid currency type');
    }

    user.updated_at = new Date().toISOString();
    this.save();
    return user;
  }

  // Admin sends a gift: this only CREATES a pending, unclaimed gift entry.
  // The balance is intentionally NOT touched here — it's only added once the
  // user opens the popup in the app and taps "Claim Gift" (claimGift below).
  adminSendGift(userId, { type, amount, note }) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    const numAmount = Math.abs(Number(amount));
    if (isNaN(numAmount) || numAmount <= 0) throw new Error('Invalid gift amount');
    if (!['diamonds', 'usdt', 'keys'].includes(type)) throw new Error('Invalid gift type');

    if (!user.gifts) user.gifts = [];
    const giftEntry = {
      id: `gift_${Date.now()}`,
      type,
      amount: numAmount,
      note: note || 'Special gift from Admin! 🎁',
      claimed: false,
      created_at: new Date().toISOString()
    };
    user.gifts.unshift(giftEntry);

    this.save();
    return { user, gift: giftEntry };
  }

  // Called when the user taps "Claim Gift" in the popup. This is the only
  // place a gift's reward actually lands in the user's balance.
  claimGift(userId, giftId) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');

    const gift = (user.gifts || []).find(g => g.id === giftId);
    if (!gift) throw new Error('Gift not found');
    if (gift.claimed) throw new Error('This gift has already been claimed');

    if (gift.type === 'diamonds') {
      user.diamonds += gift.amount;
    } else if (gift.type === 'usdt') {
      user.usdt = Number(((user.usdt || 0) + gift.amount).toFixed(4));
    } else if (gift.type === 'keys') {
      user.keys += Math.floor(gift.amount);
    }

    gift.claimed = true;
    gift.claimed_at = new Date().toISOString();
    user.updated_at = new Date().toISOString();

    this.save();
    return { user, gift };
  }

  // ==========================================
  // ANTI-CHEAT DEVICE LOCK & MULTI-ACCOUNT
  // ==========================================
  checkDeviceLock(userId, deviceId) {
    if (!this.data.device_fingerprints) {
      this.data.device_fingerprints = {};
    }

    const id = String(userId);
    if (!deviceId) return { isDuplicate: false };

    const boundUserId = this.data.device_fingerprints[deviceId];
    if (boundUserId && boundUserId !== id) {
      const primaryUser = this.getUser(boundUserId);
      return {
        isDuplicate: true,
        linkedUser: {
          id: boundUserId,
          name: primaryUser ? [primaryUser.first_name, primaryUser.last_name].filter(Boolean).join(' ') : 'Original Hunter',
          username: primaryUser?.username || `user_${boundUserId.slice(-4)}`
        }
      };
    }

    // Bind device if not bound
    if (!boundUserId) {
      this.data.device_fingerprints[deviceId] = id;
      this.save();
    }

    return { isDuplicate: false };
  }

  switchAccountResetBalance(userId, deviceId) {
    if (!this.data.device_fingerprints) {
      this.data.device_fingerprints = {};
    }

    const id = String(userId);
    const user = this.getUser(id);
    if (!user) throw new Error('User not found');

    // Claim connection for this account
    if (deviceId) {
      this.data.device_fingerprints[deviceId] = id;
    }

    // Reset balance to zero as penalty for multi-account attempt
    user.diamonds = 0;
    user.usdt = 0.0;
    user.is_switched_reset = true;
    user.device_conflict = false;
    user.device_conflict_linked = null;
    user.updated_at = new Date().toISOString();

    this.save();
    return user;
  }

  // --- Same-IP duplicate-account lock ---
  // Only 1 account allowed per IP without VPN. If a 2nd account uses the same IP,
  // it is flagged with a warning that a different Network or VPN must be used.
  static MAX_ACCOUNTS_PER_IP = 1;

  checkIpLock(userId, ip) {
    if (!ip) return { isDuplicate: false };
    if (!this.data.ip_bindings) this.data.ip_bindings = {};

    const id = String(userId);
    const list = this.data.ip_bindings[ip] || [];

    if (list.includes(id)) {
      return { isDuplicate: false };
    }

    if (list.length < Database.MAX_ACCOUNTS_PER_IP) {
      list.push(id);
      this.data.ip_bindings[ip] = list;
      this.save();
      return { isDuplicate: false };
    }

    const linkedUsers = list.map((uid) => {
      const u = this.getUser(uid);
      return {
        id: uid,
        name: u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : 'Linked Hunter',
        username: u?.username || `user_${uid.slice(-4)}`
      };
    });

    return { isDuplicate: true, linkedUsers };
  }

  switchIpAccountResetBalance(userId, ip) {
    if (!ip) throw new Error('Could not detect your connection — please try again.');
    if (!this.data.ip_bindings) this.data.ip_bindings = {};

    const id = String(userId);
    const user = this.getUser(id);
    if (!user) throw new Error('User not found');

    const list = this.data.ip_bindings[ip] || [];
    if (!list.includes(id)) list.push(id);
    this.data.ip_bindings[ip] = list;

    // Reset balance to zero as penalty for multi-account abuse of one IP
    user.diamonds = 0;
    user.usdt = 0.0;
    user.is_switched_reset = true;
    user.ip_conflict = false;
    user.ip_conflict_linked = null;
    user.updated_at = new Date().toISOString();

    this.save();
    return user;
  }

  // --- TON Blockchain Payment & Deposit Helpers ---
  isTonTxProcessed(hash) {
    if (!hash) return false;
    if (!this.data.ton_processed_txs) this.data.ton_processed_txs = [];
    return this.data.ton_processed_txs.some(t => (typeof t === 'string' ? t === hash : t.hash === hash));
  }

  recordTonTx(txData) {
    if (!this.data.ton_processed_txs) this.data.ton_processed_txs = [];
    if (!this.data.ton_transactions) this.data.ton_transactions = [];

    const hash = txData.hash;
    if (hash && !this.data.ton_processed_txs.some(t => (typeof t === 'string' ? t === hash : t.hash === hash))) {
      this.data.ton_processed_txs.push(hash);
    }

    this.data.ton_transactions.unshift({
      id: `ton_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...txData,
      created_at: new Date().toISOString()
    });

    if (this.data.ton_transactions.length > 10000) {
      this.data.ton_transactions.pop();
    }

    this.save();
    return true;
  }

  // Atomic deposit execution with MongoDB native $inc & $addToSet for 20k concurrent users
  async creditTonDepositAtomic(userId, amountTon, diamondsCredit, txData) {
    const id = String(userId);
    const user = this.getUser(id);
    if (user) {
      user.ton_balance = Number(((user.ton_balance || 0) + amountTon).toFixed(4));
      user.diamonds = (user.diamonds || 0) + diamondsCredit;
      user.updated_at = new Date().toISOString();
    }
    this.recordTonTx(txData);

    // Native MongoDB atomic transaction operator for extreme concurrency
    if (this.isMongoConnected && this.mongoCollection) {
      try {
        await this.mongoCollection.updateOne(
          { _id: 'main_state' },
          {
            $addToSet: { 'data.ton_processed_txs': txData.hash },
            $inc: {
              [`data.users.${id}.diamonds`]: diamondsCredit,
              [`data.users.${id}.ton_balance`]: amountTon
            },
            $set: { updated_at: new Date().toISOString() }
          }
        );
      } catch (err) {
        console.warn('Atomic deposit mongo update error (fallback to flush):', err.message);
      }
    }

    this.save();
    await this.flush();
    return user;
  }
}

export const db = new Database();
