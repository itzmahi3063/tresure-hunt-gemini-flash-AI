/**
 * TON On-Chain Auto-Payout Dispatcher
 * Dispatches automated on-chain payments to user TON wallet addresses upon admin approval.
 *
 * SECURE:
 * - Never stores or logs mnemonic phrases or private keys.
 * - Credentials read from Vercel environment variables OR secure admin settings.
 *
 * Supported Environment Variables:
 * - TON_AUTO_PAY: Set to 'true', '1', or 'yes' (auto-enabled if mnemonic is provided).
 * - TON_WALLET_MNEMONIC: 24 (or 12) secret words of the hot wallet.
 * - TON_WALLET_ADDRESS: Optional hot wallet address (matches V5/V4).
 * - TON_RPC_ENDPOINT: Optional custom endpoint.
 * - TON_API_KEY / TONCENTER_API_KEY / TON_CONSOLE_API_KEY: Optional RPC key.
 */

const { TonClient, WalletContractV4, WalletContractV5R1, internal, toNano, fromNano, beginCell, external, storeMessage, SendMode, Address } = require("@ton/ton");
const { mnemonicToPrivateKey } = require("@ton/crypto");

// ===========================================================================
// PAYOUT RELIABILITY LAYER (added)
// - every RPC call has a hard timeout + failover (no more hanging requests)
// - the payout is matched on-chain by the hash of the exact message we signed,
//   so the Tx link is ALWAYS the real transaction (never "latest tx of wallet")
// - the transaction is verified (compute + action phase + out message to the
//   user) so "seqno moved but TON was not delivered" is detected
// - if confirmation is slow, the payout is NOT treated as failed: it is kept as
//   PENDING-CONFIRMATION and finalized later (no double pay, no lost payout)
// ===========================================================================
const PAYOUT_VALID_SECONDS = 90;          // signed message expires after this => a payout that never landed can be released safely
const PAYOUT_RELEASE_GRACE_SECONDS = 90;  // extra margin (node clock / indexing lag) before declaring "not sent"
const RPC_TIMEOUT_MS = 6000;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label || "RPC"} timeout after ${ms}ms`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

function buildTonClients() {
  const rawKey = (process.env.TONCENTER_API_KEY || process.env.TON_API_KEY || process.env.TON_CONSOLE_API_KEY || "").trim();
  const validToncenterKey = /^[0-9a-fA-F]{64}$/.test(rawKey) ? rawKey : undefined;
  const customEndpoint = (process.env.TON_RPC_ENDPOINT || "").trim();

  const rpcConfigs = [];
  if (customEndpoint) {
    rpcConfigs.push({ endpoint: customEndpoint, apiKey: validToncenterKey });
  }
  rpcConfigs.push({
    endpoint: "https://ton.access.orbs.network/44A1c0ff5Bd3F8B62C092Ab4D238bEE463E644A1/1/mainnet/toncenter-api-v2/jsonRPC",
    apiKey: undefined
  });
  rpcConfigs.push({
    endpoint: "https://toncenter.com/api/v2/jsonRPC",
    apiKey: validToncenterKey
  });
  return rpcConfigs.map(c => new TonClient({ endpoint: c.endpoint, apiKey: c.apiKey }));
}

// Hedged failover for READ calls: if the first node has not answered within 1.5s the next node is asked too;
// the first good answer wins. A hanging node can no longer stall a payout.
function rpcFailover(clients, fn, ms) {
  const limit = ms || RPC_TIMEOUT_MS;
  const HEDGE_MS = 1500;
  return new Promise((resolve, reject) => {
    let settled = false, finished = 0, launched = 0, lastErr = null, hedgeTimer = null;
    const launchNext = () => {
      if (settled || launched >= clients.length) return;
      const client = clients[launched++];
      let p;
      try { p = withTimeout(fn(client), limit, "TON RPC"); } catch (e) { p = Promise.reject(e); }
      p.then((v) => {
        if (!settled) { settled = true; clearTimeout(hedgeTimer); resolve(v); }
      }).catch((e) => {
        lastErr = e;
        finished++;
        if (settled) return;
        if (launched < clients.length) {
          launchNext();
        } else if (finished >= clients.length) {
          settled = true;
          clearTimeout(hedgeTimer);
          reject(lastErr || new Error("All TON RPC endpoints failed"));
        }
      });
      if (launched < clients.length) {
        clearTimeout(hedgeTimer);
        hedgeTimer = setTimeout(launchNext, HEDGE_MS);
      }
    };
    if (!clients.length) return reject(new Error("No TON RPC endpoints configured"));
    launchNext();
  });
}

function txBodyHashHex(tx) {
  try {
    return tx && tx.inMessage && tx.inMessage.body ? tx.inMessage.body.hash().toString("hex") : "";
  } catch (_) {
    return "";
  }
}

function sentToDestination(tx, destAddress) {
  try {
    const msgs = tx && tx.outMessages ? tx.outMessages.values() : [];
    for (const m of msgs) {
      if (m && m.info && m.info.type === "internal" && m.info.dest && m.info.dest.equals(destAddress)) {
        return m;
      }
    }
  } catch (_) {}
  return null;
}

// Did this on-chain transaction REALLY deliver the transfer to the user?
function classifyPayoutTx(tx, destAddress) {
  const d = tx && tx.description;
  if (!d || d.type !== "generic") return { ok: false, reason: "UNEXPECTED_TRANSACTION_TYPE" };
  if (d.aborted) return { ok: false, reason: "TRANSACTION_ABORTED" };
  if (d.computePhase && d.computePhase.type === "vm" && !d.computePhase.success) return { ok: false, reason: "WALLET_EXECUTION_FAILED" };
  if (!d.actionPhase || !d.actionPhase.success) return { ok: false, reason: "TRANSFER_ACTION_FAILED" };
  if (!sentToDestination(tx, destAddress)) return { ok: false, reason: "TRANSFER_NOT_SENT" };
  return { ok: true };
}

// Look for OUR transaction (matched by the signed message body hash) on all nodes in parallel.
// Resolves immediately when any node returns it.
function findPayoutTxOnChain(clients, walletAddress, bodyHashHex, limit, perCallMs) {
  return new Promise((resolve) => {
    let remaining = clients.length;
    let done = false;
    let reachable = false;
    if (remaining === 0) return resolve({ tx: null, reachable: false });
    clients.forEach((c) => {
      let p;
      try { p = withTimeout(c.getTransactions(walletAddress, { limit }), perCallMs || 4000, "getTransactions"); }
      catch (e) { p = Promise.reject(e); }
      p.then((list) => {
        reachable = true;
        if (done) return;
        const hit = (list || []).find(tx => txBodyHashHex(tx) === bodyHashHex);
        if (hit) { done = true; resolve({ tx: hit, reachable: true }); }
      }).catch(() => {}).finally(() => {
        remaining--;
        if (remaining === 0 && !done) { done = true; resolve({ tx: null, reachable }); }
      });
    });
  });
}

// Read recent transactions from ALL nodes (union) - used before declaring a payout "not sent".
async function fetchTxUnion(clients, walletAddress, limit, perCallMs) {
  const settled = await Promise.allSettled(
    clients.map(c => withTimeout(c.getTransactions(walletAddress, { limit }), perCallMs || 6000, "getTransactions"))
  );
  const all = [];
  let okCount = 0;
  for (const s of settled) {
    if (s.status === "fulfilled") { okCount++; for (const tx of (s.value || [])) all.push(tx); }
  }
  return { txs: all, okCount, total: clients.length };
}

// Wallet-level lock: only ONE payout may use the hot wallet seqno at a time (across admin panel + Telegram bot).
async function acquireWalletLock(db, ttlMs, waitMs) {
  if (!db) return { release: async () => {} };
  const col = db.collection("settings");
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    await col.updateOne({ key: "ton_payout_lock" }, { $setOnInsert: { key: "ton_payout_lock", lockedUntil: 0 } }, { upsert: true });
  } catch (_) {}
  const deadline = Date.now() + waitMs;
  while (true) {
    const now = Date.now();
    try {
      const r = await col.updateOne(
        { key: "ton_payout_lock", lockedUntil: { $lt: now } },
        { $set: { lockedUntil: now + ttlMs, owner: token } }
      );
      if (r && r.modifiedCount === 1) {
        return {
          release: async () => {
            try { await col.updateOne({ key: "ton_payout_lock", owner: token }, { $set: { lockedUntil: 0 } }); } catch (_) {}
          }
        };
      }
    } catch (_) {
      return { release: async () => {} }; // DB hiccup: do not block payouts on the lock itself
    }
    if (Date.now() >= deadline) return null;
    await sleep(300);
  }
}

async function getTonAutoPayConfig(db = null) {
  let envMnemonic = (
    process.env.TON_WALLET_MNEMONIC ||
    process.env.WALLET_MNEMONIC ||
    process.env.MNEMONIC ||
    process.env.TON_MNEMONIC ||
    process.env.HOT_WALLET_MNEMONIC ||
    process.env.MNEMONIC_PHRASE ||
    process.env.TON_SEED_PHRASE ||
    process.env.SEED_PHRASE ||
    ""
  ).trim();

  let autoPayRaw = String(process.env.TON_AUTO_PAY || "").toLowerCase().trim();
  let configuredAddress = (process.env.TON_WALLET_ADDRESS || "").trim();

  let dbMnemonic = "";
  if (db) {
    try {
      const doc = await db.collection("settings").findOne({ key: "ton_autopay" });
      if (doc && doc.mnemonic) {
        dbMnemonic = String(doc.mnemonic).trim();
        if (doc.autoPay !== undefined) {
          autoPayRaw = String(doc.autoPay).toLowerCase().trim();
        }
        if (doc.walletAddress && !configuredAddress) {
          configuredAddress = String(doc.walletAddress).trim();
        }
      }
    } catch (_) {}
  }

  const countWords = (str) => {
    if (!str) return 0;
    return String(str).trim().replace(/^["']|["']$/g, "").split(/[\s,]+/).filter(Boolean).length;
  };

  const envCount = countWords(envMnemonic);
  const dbCount = countWords(dbMnemonic);

  let mnemonicStr = "";
  let source = "";

  // 1. If DB has valid 24 (or 12) words, give priority to DB (since admin explicitly saved it via admin panel)!
  if (dbCount === 24 || dbCount === 12) {
    mnemonicStr = dbMnemonic;
    source = "db";
  } else if (envCount === 24 || envCount === 12) {
    mnemonicStr = envMnemonic;
    source = "env";
  } else if (dbMnemonic) {
    mnemonicStr = dbMnemonic;
    source = "db";
  } else if (envMnemonic) {
    mnemonicStr = envMnemonic;
    source = "env";
  }

  const isExplicitlyDisabled = autoPayRaw === "false" || autoPayRaw === "0" || autoPayRaw === "no";
  const isEnabled = !isExplicitlyDisabled && (autoPayRaw === "true" || autoPayRaw === "1" || autoPayRaw === "yes" || !!mnemonicStr);

  return {
    mnemonicStr,
    isEnabled,
    isExplicitlyDisabled,
    configuredAddress,
    source
  };
}

async function getTonAutoPayStatus(db = null) {
  try {
    const config = await getTonAutoPayConfig(db);
    if (!config.mnemonicStr) {
      return {
        configured: false,
        enabled: false,
        source: null,
        configuredAddress: config.configuredAddress || null,
        message: "TON_WALLET_MNEMONIC (24 secret words) is not configured in Vercel or database."
      };
    }

    if (config.isExplicitlyDisabled) {
      return {
        configured: true,
        enabled: false,
        source: config.source,
        message: "TON_AUTO_PAY is set to 'false'. Auto-payout is disabled."
      };
    }

    const cleanMnemonic = String(config.mnemonicStr).trim().replace(/^["']|["']$/g, "").trim();
    const words = cleanMnemonic.split(/[\s,]+/).map(w => w.replace(/["',]/g, "").trim().toLowerCase()).filter(Boolean);

    if (words.length !== 24 && words.length !== 12) {
      return {
        configured: false,
        enabled: config.isEnabled,
        wordCount: words.length,
        message: `Invalid mnemonic length (${words.length} words found, expected 24 or 12).`
      };
    }

    const keyPair = await mnemonicToPrivateKey(words);
    const walletV5 = WalletContractV5R1 ? WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey }) : null;
    const walletV4 = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const addrV5 = walletV5 ? walletV5.address.toString({ bounceable: false }) : "";
    const addrV4 = walletV4.address.toString({ bounceable: false });

    let activeWallet = walletV5 || walletV4;
    let walletType = walletV5 ? "V5R1" : "V4";
    if (config.configuredAddress) {
      if (addrV4.toLowerCase() === config.configuredAddress.toLowerCase()) {
        activeWallet = walletV4;
        walletType = "V4";
      } else if (addrV5.toLowerCase() === config.configuredAddress.toLowerCase()) {
        activeWallet = walletV5;
        walletType = "V5R1";
      }
    }

    const walletAddress = activeWallet.address.toString({ bounceable: false });
    const client = new TonClient({
      endpoint: "https://ton.access.orbs.network/44A1c0ff5Bd3F8B62C092Ab4D238bEE463E644A1/1/mainnet/toncenter-api-v2/jsonRPC"
    });

    let balanceTon = 0;
    try {
      const nano = await client.getBalance(activeWallet.address);
      balanceTon = parseFloat(fromNano(nano));
    } catch (_) {}

    let seqno = 0;
    try {
      const seqRes = await client.runMethod(activeWallet.address, 'seqno');
      if (seqRes && seqRes.stack) {
        seqno = seqRes.stack.readNumber();
      }
    } catch (_) {}

    return {
      configured: true,
      enabled: config.isEnabled,
      source: config.source,
      walletType,
      walletAddress,
      balanceTon,
      seqno,
      wordCount: words.length
    };
  } catch (err) {
    return {
      configured: false,
      error: err.message
    };
  }
}

async function dispatchTonPayout(toAddress, tonAmount, memo = "TREASURE Mine Payout", db = null, opts = {}) {
  const config = await getTonAutoPayConfig(db);

  if (!config.mnemonicStr) {
    return {
      success: false,
      isConfigured: false,
      txHash: null,
      message: "TON_WALLET_MNEMONIC (24 secret words) is not configured in Vercel or database."
    };
  }

  if (config.isExplicitlyDisabled) {
    return {
      success: false,
      isConfigured: false,
      txHash: null,
      message: "TON_AUTO_PAY is set to 'false'. To enable automatic payouts, remove TON_AUTO_PAY or set TON_AUTO_PAY=true."
    };
  }

  if (!config.isEnabled) {
    return {
      success: false,
      isConfigured: false,
      txHash: null,
      message: "TON auto-pay is disabled."
    };
  }

  // Clean quotes, double quotes, brackets, newlines, commas
  const cleanMnemonic = String(config.mnemonicStr).trim().replace(/^["']|["']$/g, "").trim();
  const words = cleanMnemonic.split(/[\s,]+/).map(w => w.replace(/["',]/g, "").trim().toLowerCase()).filter(Boolean);
  if (words.length !== 24 && words.length !== 12) {
    return {
      success: false,
      isConfigured: true,
      error: "INVALID_MNEMONIC_LENGTH",
      message: `Invalid mnemonic length (${words.length} words found, expected 24 or 12).`
    };
  }

  const amtNum = parseFloat(tonAmount);
  if (isNaN(amtNum) || amtNum <= 0) {
    return {
      success: false,
      isConfigured: true,
      error: "INVALID_AMOUNT",
      message: `Invalid payout amount: ${tonAmount} TON`
    };
  }

  // Clean and parse destination address strictly
  const cleanToAddr = String(toAddress || "").trim();
  if (!cleanToAddr) {
    return {
      success: false,
      isConfigured: true,
      isAddressInvalid: true,
      error: "INVALID_DESTINATION_ADDRESS",
      message: "User destination wallet address is empty."
    };
  }

  let parsedToAddress;
  try {
    parsedToAddress = Address.parse(cleanToAddr);
    // A testnet-flagged address would send real TON into the void on mainnet -> treat as invalid
    if (Address.isFriendly(cleanToAddr) && Address.parseFriendly(cleanToAddr).isTestOnly) {
      throw new Error("testnet-only address");
    }
  } catch (addrErr) {
    return {
      success: false,
      isConfigured: true,
      isAddressInvalid: true,
      error: "INVALID_DESTINATION_ADDRESS",
      message: `Invalid TON wallet address format ("${cleanToAddr}"). Address checksum or format is invalid.`
    };
  }


  let walletLock = null;
  let preparedInfo = null; // set once the signed payout intent is saved (from here on, it may already be on-chain)
  try {
    const clients = buildTonClients();
    const callWithFailover = (fn, ms) => rpcFailover(clients, fn, ms);

    // Derive key pair securely in memory
    const keyPair = await mnemonicToPrivateKey(words);
    const workchain = 0;
    const walletV5 = WalletContractV5R1 ? WalletContractV5R1.create({ workchain, publicKey: keyPair.publicKey }) : null;
    const walletV4 = WalletContractV4.create({ workchain, publicKey: keyPair.publicKey });

    const addrV5 = walletV5 ? walletV5.address.toString({ bounceable: false }) : "";
    const addrV4 = walletV4.address.toString({ bounceable: false });
    const configuredAddr = (config.configuredAddress || "").trim().toLowerCase();

    // Select wallet contract version
    let activeWallet = walletV5 || walletV4;
    if (configuredAddr) {
      if (addrV4.toLowerCase() === configuredAddr) {
        activeWallet = walletV4;
      } else if (addrV5.toLowerCase() === configuredAddr) {
        activeWallet = walletV5;
      }
    } else {
      // If not explicitly configured, check balances in parallel to find which wallet has funds
      try {
        const [resV5, resV4] = await Promise.allSettled([
          walletV5 ? callWithFailover(c => c.getBalance(walletV5.address)) : Promise.reject(),
          callWithFailover(c => c.getBalance(walletV4.address))
        ]);
        const balV5 = resV5.status === "fulfilled" ? parseFloat(fromNano(resV5.value)) : 0;
        const balV4 = resV4.status === "fulfilled" ? parseFloat(fromNano(resV4.value)) : 0;
        if (balV4 > balV5) {
          activeWallet = walletV4;
        }
      } catch (_) {}
    }

    const senderAddress = activeWallet.address.toString({ bounceable: false });
    const requiredTotal = amtNum + 0.008; // Amount + gas buffer

    // Serialize payouts: one payout at a time may use the hot wallet seqno (panel + Telegram bot safe).
    walletLock = await acquireWalletLock(db, 40000, Number(opts.lockWaitMs) || 8000);
    if (!walletLock) {
      return {
        success: false,
        isConfigured: true,
        error: "WALLET_BUSY",
        message: "Another payout is being sent right now. Please retry in a few seconds."
      };
    }

    // Fetch seqno reliably from smart contract
    async function fetchSeqno() {
      try {
        const seqRes = await callWithFailover(c => c.runMethod(activeWallet.address, 'seqno'));
        if (seqRes && seqRes.stack) {
          return seqRes.stack.readNumber();
        }
      } catch (_) {}
      try {
        const contract = clients[0].open(activeWallet);
        return await withTimeout(contract.getSeqno(), RPC_TIMEOUT_MS, "getSeqno");
      } catch (_) {}
      return -1;
    }

    // Balance + seqno in parallel (saves a full round-trip per payout)
    const [balSettled, seqSettled] = await Promise.allSettled([
      callWithFailover(c => c.getBalance(activeWallet.address)),
      fetchSeqno()
    ]);
    let balanceTon = balSettled.status === "fulfilled" ? parseFloat(fromNano(balSettled.value)) : -1;
    let currentSeqno = seqSettled.status === "fulfilled" ? seqSettled.value : -1;

    if (balanceTon < 0) {
      try {
        await sleep(500);
        const nanoRetry = await callWithFailover(c => c.getBalance(activeWallet.address));
        balanceTon = parseFloat(fromNano(nanoRetry));
      } catch (retryErr) {
        console.error("[TON Auto-Pay] Balance check failed:", retryErr.message);
      }
    }

    if (balanceTon >= 0 && balanceTon < requiredTotal) {
      return {
        success: false,
        isConfigured: true,
        error: "INSUFFICIENT_HOT_WALLET_BALANCE",
        message: `Hot wallet balance too low! Available: ${balanceTon.toFixed(4)} TON, Needed: ${requiredTotal.toFixed(4)} TON (including network gas fee). Please deposit TON to: ${senderAddress}`
      };
    }

    if (currentSeqno < 0) {
      await sleep(600);
      currentSeqno = await fetchSeqno();
    }

    if (currentSeqno < 0) {
      // Check if wallet contract is not yet initialized on-chain
      try {
        const state = await callWithFailover(c => c.getContractState(activeWallet.address));
        if (state && state.state === "uninitialized") {
          currentSeqno = 0;
        }
      } catch (_) {}
    }

    if (currentSeqno < 0) {
      return {
        success: false,
        isConfigured: true,
        error: "CANNOT_FETCH_SEQNO",
        message: "Failed to read on-chain wallet sequence number (seqno). Broadcast halted to prevent invalid sequence."
      };
    }

    // If a previous payout (same seqno) is still waiting to land, never sign a competing message for that seqno.
    if (db) {
      try {
        const nowSecCheck = Math.floor(Date.now() / 1000);
        const conflict = await db.collection("withdrawals").findOne({
          status: "PROCESSING",
          "pendingTx.sender": senderAddress,
          "pendingTx.seqno": currentSeqno,
          "pendingTx.validUntil": { $gt: nowSecCheck }
        });
        if (conflict && String(conflict._id) !== String(opts.withdrawalId || "")) {
          return {
            success: false,
            isConfigured: true,
            error: "PREVIOUS_TX_PENDING",
            message: "A previous payout is still waiting for blockchain confirmation. Finalize it first (or wait ~1 minute), then continue."
          };
        }
      } catch (_) {}
    }

    let lastBroadcastDoc = null;
    if (db) {
      try {
        lastBroadcastDoc = await db.collection("settings").findOne({ key: "ton_autopay" });
      } catch (_) {}
    }
    const lastBroadcastSeqno = (lastBroadcastDoc && typeof lastBroadcastDoc.lastSeqno === "number") ? lastBroadcastDoc.lastSeqno : -1;
    const lastBroadcastAt = (lastBroadcastDoc && lastBroadcastDoc.lastBroadcastAt) ? Number(lastBroadcastDoc.lastBroadcastAt) : 0;

    // Replay protection: if RPC still returns a seqno <= the one we already broadcasted in the last 45s,
    // wait briefly for the previous transaction to finalize on-chain:
    if (currentSeqno <= lastBroadcastSeqno && (Date.now() - lastBroadcastAt < 45000)) {
      for (let attempt = 0; attempt < 5; attempt++) {
        await sleep(1000);
        const recheck = await fetchSeqno();
        if (recheck > lastBroadcastSeqno) {
          currentSeqno = recheck;
          break;
        }
      }
      if (currentSeqno <= lastBroadcastSeqno) {
        return {
          success: false,
          isConfigured: true,
          error: "PREVIOUS_TX_PENDING",
          message: "A previous payout is still finalizing on the TON blockchain. Please wait a few seconds before sending the next one."
        };
      }
    }

    // Construct transfer message cleanly with parsed address.
    // The message EXPIRES after PAYOUT_VALID_SECONDS: if it has not landed by then it can never land,
    // which is what makes releasing the withdrawal back to PENDING provably safe later.
    const signedAtMs = Date.now();
    const validUntil = Math.floor(signedAtMs / 1000) + PAYOUT_VALID_SECONDS;
    const amountNano = toNano(amtNum.toFixed(6));
    const transfer = activeWallet.createTransfer({
      seqno: currentSeqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      timeout: PAYOUT_VALID_SECONDS,
      messages: [
        internal({
          to: parsedToAddress,
          value: amountNano,
          bounce: false,
          body: memo || "TREASURE Mine Payout"
        })
      ]
    });
    const bodyHashHex = transfer.hash().toString("hex");

    // Build external envelope
    const extMessage = external({
      to: activeWallet.address,
      init: currentSeqno === 0 ? activeWallet.init : null,
      body: transfer
    });

    const extCell = beginCell().store(storeMessage(extMessage)).endCell();
    const boc = extCell.toBoc();

    // Record the payout INTENT before anything is broadcast. If the server dies / times out at any later
    // point, the withdrawal still carries everything needed to find the transaction and finalize it.
    const prepared = {
      sender: senderAddress,
      to: parsedToAddress.toRawString(),
      amountNano: amountNano.toString(),
      bodyHash: bodyHashHex,
      seqno: currentSeqno,
      signedAt: signedAtMs,
      validUntil
    };
    if (typeof opts.onPrepared === "function") {
      try {
        await opts.onPrepared(prepared);
      } catch (persistErr) {
        return {
          success: false,
          isConfigured: true,
          error: "PAYOUT_INTENT_NOT_SAVED",
          message: `Could not record payout intent, nothing was sent: ${persistErr && persistErr.message ? persistErr.message : persistErr}`
        };
      }
    }

    preparedInfo = prepared;

    // Broadcast to ALL endpoints in parallel (fast + resilient). Same message / same seqno => it can only be executed once.
    // We continue as soon as ONE node accepted it (a hanging node must not delay the payout); the others keep going in background.
    const sendResults = await new Promise((resolve) => {
      const results = new Array(clients.length);
      let settledCount = 0;
      let early = false;
      clients.forEach((c, i) => {
        let p;
        try { p = withTimeout(c.sendFile(boc), RPC_TIMEOUT_MS, "sendBoc"); } catch (e) { p = Promise.reject(e); }
        p.then(
          (v) => ({ status: "fulfilled", value: v }),
          (e) => ({ status: "rejected", reason: e })
        ).then((r) => {
          results[i] = r;
          settledCount++;
          if (r.status === "fulfilled" && !early) {
            early = true;
            resolve(results);
          } else if (settledCount === clients.length && !early) {
            early = true;
            resolve(results);
          }
        });
      });
    });
    let broadcastAccepted = false;
    let ambiguousBroadcast = false;
    let lastBroadcastErr = "";
    sendResults.forEach((r, idx) => {
      if (!r) return; // node still in flight (another node already accepted)
      if (r.status === "fulfilled") {
        broadcastAccepted = true;
        return;
      }
      const err = r.reason;
      const detailedErr = (err && err.response && err.response.data && (err.response.data.error || err.response.data.message))
        || (err && err.message)
        || String(err);
      lastBroadcastErr = detailedErr;
      console.warn(`[TON Auto-Pay] Broadcast endpoint ${idx + 1} error:`, detailedErr);
      const definitiveRejection = !!(err && err.response) || /received error|exit code|seqno|insufficient|invalid|rejected/i.test(String(detailedErr));
      const looksLikeNetwork = /timeout|econn|etimedout|enotfound|eai_again|socket|network|aborted/i.test(String(detailedErr));
      if (!definitiveRejection || looksLikeNetwork) {
        ambiguousBroadcast = true; // the node may have received it even though we did not get a clean answer
      }
    });

    if (!broadcastAccepted && !ambiguousBroadcast) {
      return {
        success: false,
        isConfigured: true,
        error: "BROADCAST_FAILED",
        message: `On-chain transfer failed to broadcast: ${lastBroadcastErr}`
      };
    }

    if (db) {
      try {
        await db.collection("settings").updateOne(
          { key: "ton_autopay" },
          { $set: { lastSeqno: currentSeqno + 1, lastBroadcastAt: Date.now(), lastSenderAddress: senderAddress } },
          { upsert: true }
        );
      } catch (_) {}
    }

    // CONFIRMATION: find OUR exact transaction on-chain and verify it really delivered the TON.
    const budgetMs = Math.max(4000, Number(opts.confirmBudgetMs) || Number(process.env.TON_CONFIRM_BUDGET_MS) || 14000);
    const confirmStart = Date.now();
    let found = null;
    await sleep(2000);
    while (true) {
      const look = await findPayoutTxOnChain(clients, activeWallet.address, bodyHashHex, 20, 3500);
      if (look.tx) { found = look.tx; break; }
      if ((Date.now() - confirmStart) + 1800 > budgetMs) break;
      await sleep(1500);
    }

    if (!found) {
      // NOT a failure: the message may still land. Keep the withdrawal in PROCESSING and finalize later.
      return {
        success: false,
        isConfigured: true,
        pendingConfirmation: true,
        error: "TRANSACTION_PENDING_CONFIRMATION",
        pendingTx: prepared,
        message: `Payout was broadcast but is not confirmed yet (waited ${Math.round((Date.now() - confirmStart) / 1000)}s). It is NOT lost and must NOT be sent again - it will be finalized automatically; press Finalize / re-approve in ~20 seconds.`
      };
    }

    const verdict = classifyPayoutTx(found, parsedToAddress);
    const finalTxHash = found.hash().toString("hex");

    if (!verdict.ok) {
      return {
        success: false,
        isConfigured: true,
        error: "PAYOUT_NOT_DELIVERED",
        safeToRetry: true,
        message: `The wallet transaction was executed but the transfer to the user was NOT delivered (${verdict.reason}). TON was NOT sent. Withdrawal remains pending.`
      };
    }

    if (db) {
      try {
        await db.collection("settings").updateOne(
          { key: "ton_autopay" },
          {
            $set: {
              lastSeqno: currentSeqno + 1,
              lastBroadcastAt: Date.now(),
              lastTxHash: finalTxHash,
              lastSenderAddress: senderAddress
            }
          },
          { upsert: true }
        );
      } catch (_) {}
    }

    return {
      success: true,
      isConfigured: true,
      txHash: finalTxHash,
      sender: senderAddress,
      amount: amtNum,
      confirmed: true,
      message: `Successfully sent ${amtNum} TON on-chain from ${senderAddress} (verified on-chain, seqno: ${currentSeqno + 1})!`
    };
  } catch (err) {
    const errorDetails = err.response?.data?.error || err.response?.data?.message || err.message;
    console.error("TON Auto-Pay error:", errorDetails);
    if (preparedInfo) {
      // Something broke AFTER the payout may have been broadcast: never report a plain failure (=> never double pay).
      return {
        success: false,
        isConfigured: true,
        pendingConfirmation: true,
        error: "TRANSACTION_PENDING_CONFIRMATION",
        pendingTx: preparedInfo,
        message: `Payout may already be on-chain (${errorDetails}). It must NOT be sent again - it will be checked and finalized automatically; press Finalize / re-approve in ~20 seconds.`
      };
    }
    return {
      success: false,
      isConfigured: true,
      error: errorDetails,
      message: `On-chain transfer failed: ${errorDetails}`
    };
  } finally {
    if (walletLock) {
      try { await walletLock.release(); } catch (_) {}
    }
  }
}

/**
 * Re-check a payout that was broadcast but not confirmed in time.
 * pendingTx = the `prepared` object stored on the withdrawal before broadcast.
 * Returns one of:
 *  { state: "CONFIRMED", txHash }          -> delivered, real on-chain hash
 *  { state: "FAILED_SAFE", reason }        -> executed on-chain but transfer NOT delivered (safe to retry)
 *  { state: "EXPIRED_NOT_SENT" }           -> message expired and nothing was sent to the user (safe to retry)
 *  { state: "REVIEW", candidateTxHash }    -> something that looks like this payout exists; human must verify
 *  { state: "PENDING" | "UNKNOWN" }        -> not decided yet (keep waiting)
 */
async function checkTonPayoutStatus(pendingTx) {
  try {
    if (!pendingTx || !pendingTx.sender || !pendingTx.to || !pendingTx.bodyHash) {
      return { state: "UNKNOWN", message: "No payout intent data stored." };
    }
    const clients = buildTonClients();
    const senderAddr = Address.parse(pendingTx.sender);
    const destAddr = Address.parse(pendingTx.to);

    const { txs, okCount } = await fetchTxUnion(clients, senderAddr, 100, 6000);
    if (okCount === 0) return { state: "UNKNOWN", message: "TON network is not reachable right now." };

    const match = txs.find(tx => txBodyHashHex(tx) === pendingTx.bodyHash);
    if (match) {
      const verdict = classifyPayoutTx(match, destAddr);
      if (verdict.ok) return { state: "CONFIRMED", txHash: match.hash().toString("hex") };
      return { state: "FAILED_SAFE", reason: verdict.reason };
    }

    // Safety net: never release if ANY transaction from this wallet sent TON to this destination after signing.
    const signedSec = Math.floor(Number(pendingTx.signedAt || 0) / 1000) - 30;
    const lookalike = txs.find(tx => Number(tx.now || 0) >= signedSec && sentToDestination(tx, destAddr));
    if (lookalike) {
      return { state: "REVIEW", candidateTxHash: lookalike.hash().toString("hex") };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expired = nowSec > Number(pendingTx.validUntil || 0) + PAYOUT_RELEASE_GRACE_SECONDS;
    if (!expired) return { state: "PENDING" };

    // Only declare "not sent" when most nodes answered (a single lagging node must never decide this).
    if (okCount < Math.min(2, clients.length)) return { state: "UNKNOWN", message: "Not enough TON nodes answered to be sure." };
    return { state: "EXPIRED_NOT_SENT" };
  } catch (err) {
    return { state: "UNKNOWN", message: err && err.message ? err.message : String(err) };
  }
}

/**
 * Decide what to do with a withdrawal that is stuck in PROCESSING.
 * Performs the safe DB release itself; finalization (APPROVED + notifications) stays in the caller.
 * Returns { action: "CONFIRMED", txHash } | { action: "RELEASED", message } | { action: "PENDING"|"REVIEW"|"BUSY", message }
 */
async function resolveProcessingWithdrawal(db, w) {
  const col = db.collection("withdrawals");
  const lock = { _id: w._id, status: "PROCESSING" };
  const pt = w.pendingTx;

  if (!pt) {
    const age = Date.now() - Number(w.processingAt || 0);
    if (w.payoutV === 2 && age > 180000) {
      // New engine records the intent BEFORE broadcasting, so no intent => nothing was ever sent.
      await col.updateOne(lock, { $set: { status: "PENDING", lastAutoPayError: "Payout was interrupted before sending. TON was NOT sent." }, $unset: { processingAt: "" } });
      return { action: "RELEASED", message: "Interrupted before sending - nothing was sent. Back to PENDING, safe to approve again." };
    }
    if (w.payoutV === 2) return { action: "BUSY", message: "This withdrawal is being processed right now." };
    return {
      action: "REVIEW",
      message: "Old stuck payout (no on-chain record). Check the hot wallet history: if it was paid, approve with the TxHash; if not, use Release to Pending."
    };
  }

  const st = await checkTonPayoutStatus(pt);
  if (st.state === "CONFIRMED") return { action: "CONFIRMED", txHash: st.txHash };

  if (st.state === "FAILED_SAFE" || st.state === "EXPIRED_NOT_SENT") {
    const why = st.state === "FAILED_SAFE" ? `executed but not delivered (${st.reason})` : "never landed on-chain and expired";
    await col.updateOne(lock, {
      $set: { status: "PENDING", lastAutoPayError: `Payout ${why}. TON was NOT sent.`, lastReleasedPendingTx: pt },
      $unset: { processingAt: "", pendingTx: "" }
    });
    return { action: "RELEASED", message: `Payout ${why}. TON was NOT sent - back to PENDING, safe to approve again.` };
  }

  if (st.state === "REVIEW") {
    try { await col.updateOne(lock, { $set: { needsReview: true, reviewTxHash: st.candidateTxHash } }); } catch (_) {}
    return {
      action: "REVIEW",
      message: `A transaction to this address exists (${st.candidateTxHash}) but could not be matched automatically. Verify it on tonviewer.com, then approve with that TxHash.`
    };
  }

  return { action: "PENDING", message: st.message || "Still waiting for blockchain confirmation. Do NOT send again - re-check in ~20 seconds." };
}

module.exports = {
  dispatchTonPayout,
  getTonAutoPayStatus,
  getTonAutoPayConfig,
  checkTonPayoutStatus,
  resolveProcessingWithdrawal
};
