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

const { TonClient, WalletContractV4, internal, toNano, fromNano, beginCell, external, storeMessage, SendMode, Address } = require("@ton/ton");
const { mnemonicToPrivateKey } = require("@ton/crypto");

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

  // 1. Prioritize Vercel ENV (Admin sets fresh seed phrase in Vercel environment variables)
  if (envCount === 24 || envCount === 12) {
    mnemonicStr = envMnemonic;
    source = "env";
  } else if (dbCount === 24 || dbCount === 12) {
    mnemonicStr = dbMnemonic;
    source = "db";
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
    // Exclusively use WalletContractV4 (V4R2 - Tonkeeper Standard)
    const activeWallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const walletType = "V4R2";
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

async function dispatchTonPayout(toAddress, tonAmount, memo = "TREASURE Mine Payout", db = null) {
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

  let parsedToAddress = null;
  try {
    parsedToAddress = Address.parse(cleanToAddr);
  } catch (addrErr) {
    try {
      parsedToAddress = Address.parseFriendly(cleanToAddr).address;
    } catch (_) {}
  }

  if (!parsedToAddress) {
    return {
      success: false,
      isConfigured: true,
      isAddressInvalid: true,
      error: "INVALID_DESTINATION_ADDRESS",
      message: `Invalid TON wallet address ("${cleanToAddr}"). Checksum or format is invalid. Payout halted for invalid address.`
    };
  }

  try {
    const rawKey = (process.env.TONCENTER_API_KEY || process.env.TON_API_KEY || process.env.TON_CONSOLE_API_KEY || "").trim();
    const validToncenterKey = /^[0-9a-fA-F]{64}$/.test(rawKey) ? rawKey : undefined;
    const customEndpoint = (process.env.TON_RPC_ENDPOINT || "").trim();

    // High-performance endpoints array with automatic failover (Orbs first for zero-ratelimit reads, Toncenter for validator bridge)
    const rpcConfigs = [];
    if (customEndpoint) {
      rpcConfigs.push({ endpoint: customEndpoint, apiKey: validToncenterKey });
    }
    // High-performance decentralized Orbs gateway (no rate limits, fast RPC state queries)
    rpcConfigs.push({
      endpoint: "https://ton.access.orbs.network/44A1c0ff5Bd3F8B62C092Ab4D238bEE463E644A1/1/mainnet/toncenter-api-v2/jsonRPC",
      apiKey: undefined
    });
    // Official Toncenter endpoint
    rpcConfigs.push({
      endpoint: "https://toncenter.com/api/v2/jsonRPC",
      apiKey: validToncenterKey
    });

    const clients = rpcConfigs.map(c => new TonClient({ endpoint: c.endpoint, apiKey: c.apiKey }));

    // Helper: try calls with endpoint failover and LiteServer timeout retries
    async function callWithFailover(fn, retries = 2) {
      let lastErr = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        for (const client of clients) {
          try {
            return await fn(client);
          } catch (err) {
            lastErr = err;
          }
        }
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      throw lastErr;
    }

    // Derive key pair securely in memory: Strictly WalletContractV4 (V4R2) ONLY
    const keyPair = await mnemonicToPrivateKey(words);
    const workchain = 0;
    const activeWallet = WalletContractV4.create({ workchain, publicKey: keyPair.publicKey });
    const walletType = "V4R2";
    const senderAddress = activeWallet.address.toString({ bounceable: false });

    // Check whether the wallet contract is deployed on-chain
    let isDeployed = false;
    try {
      isDeployed = await callWithFailover(c => c.isContractDeployed(activeWallet.address));
    } catch (_) {
      try {
        const state = await callWithFailover(c => c.getContractState(activeWallet.address));
        isDeployed = state && state.state === "active";
      } catch (_) {}
    }

    // Safe gas buffer: uninitialized contracts need ~0.025 TON for deployment + action phase
    const gasBuffer = isDeployed ? 0.01 : 0.025;
    const requiredTotal = amtNum + gasBuffer;

    // Check balance strictly (block if balance check fails or is insufficient)
    let balanceTon = -1;
    try {
      const nano = await callWithFailover(c => c.getBalance(activeWallet.address));
      balanceTon = parseFloat(fromNano(nano));
    } catch (balErr) {
      console.warn("[TON Auto-Pay] Warning: Initial balance check failed, retrying once:", balErr.message);
      try {
        await new Promise(r => setTimeout(r, 1000));
        const nanoRetry = await callWithFailover(c => c.getBalance(activeWallet.address));
        balanceTon = parseFloat(fromNano(nanoRetry));
      } catch (retryErr) {
        console.error("[TON Auto-Pay] Balance check retry failed:", retryErr.message);
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

    // Fetch seqno reliably from smart contract across endpoints with LiteServer retry
    async function fetchSeqno() {
      for (let attempt = 0; attempt < 2; attempt++) {
        for (const client of clients) {
          try {
            const contract = client.open(activeWallet);
            const s = await contract.getSeqno();
            if (typeof s === "number" && !isNaN(s) && s >= 0) return s;
          } catch (_) {}
          try {
            const seqRes = await client.runMethod(activeWallet.address, 'seqno');
            if (seqRes && seqRes.stack) {
              const s = seqRes.stack.readNumber();
              if (typeof s === "number" && !isNaN(s) && s >= 0) return s;
            }
          } catch (_) {}
        }
        if (attempt < 1) await new Promise(r => setTimeout(r, 800));
      }
      return -1;
    }

    let currentSeqno = 0;
    if (!isDeployed) {
      // Contract is uninitialized on-chain; initial seqno on TON is always 0
      currentSeqno = 0;
    } else {
      let fetched = await fetchSeqno();
      if (fetched < 0) {
        await new Promise(r => setTimeout(r, 1200));
        fetched = await fetchSeqno();
      }
      if (fetched < 0) {
        return {
          success: false,
          isConfigured: true,
          error: "CANNOT_FETCH_SEQNO",
          message: "Failed to read on-chain wallet sequence number (seqno). Broadcast halted to prevent invalid sequence."
        };
      }
      currentSeqno = fetched;
    }

    let lastBroadcastDoc = null;
    if (db) {
      try {
        lastBroadcastDoc = await db.collection("settings").findOne({ key: "ton_autopay" });
      } catch (_) {}
    }
    const lastBroadcastSeqno = (lastBroadcastDoc && typeof lastBroadcastDoc.lastSeqno === "number") ? lastBroadcastDoc.lastSeqno : -1;
    const lastBroadcastAt = (lastBroadcastDoc && lastBroadcastDoc.lastBroadcastAt) ? Number(lastBroadcastDoc.lastBroadcastAt) : 0;
    const lastSenderAddress = (lastBroadcastDoc && lastBroadcastDoc.lastSenderAddress) ? String(lastBroadcastDoc.lastSenderAddress) : "";

    // ONLY apply wait logic if it is the EXACT same sender wallet and broadcast was within the last 45 seconds:
    const isSameWallet = lastSenderAddress && (lastSenderAddress === senderAddress);
    if (isSameWallet && lastBroadcastSeqno >= 0 && (Date.now() - lastBroadcastAt < 45000)) {
      if (currentSeqno <= lastBroadcastSeqno) {
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise(r => setTimeout(r, 2000));
          const recheck = await fetchSeqno();
          if (recheck > lastBroadcastSeqno) {
            currentSeqno = recheck;
            break;
          }
        }
      }
    }

    // In TON, stateInit MUST be attached whenever contract is not deployed or seqno is 0:
    const neededInit = (!isDeployed || currentSeqno === 0) ? activeWallet.init : null;

    // Construct transfer message cleanly with parsed address and comment
    const transfer = activeWallet.createTransfer({
      seqno: currentSeqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      timeout: Math.floor(Date.now() / 1000) + 600,
      messages: [
        internal({
          to: parsedToAddress,
          value: toNano(amtNum.toFixed(6)),
          bounce: false,
          body: memo || "TREASURE Mine Payout"
        })
      ]
    });

    // Build external envelope with stateInit attached when needed
    const extMessage = external({
      to: activeWallet.address,
      init: neededInit,
      body: transfer
    });

    const extCell = beginCell().store(storeMessage(extMessage)).endCell();
    const boc = extCell.toBoc();

    const broadcastStartTime = Math.floor(Date.now() / 1000) - 10;

    // Broadcast on-chain transfer with multi-attempt failover and LiteServer timeout recovery
    let broadcastOk = false;
    let lastBroadcastErr = "";

    for (let bAttempt = 1; bAttempt <= 3; bAttempt++) {
      const sendResults = await Promise.allSettled(clients.map(async (client, idx) => {
        try {
          await client.sendFile(boc);
          return { ok: true, idx };
        } catch (err) {
          const msg = (err && err.response && err.response.data && (err.response.data.error || err.response.data.message))
            || (err && err.message)
            || String(err);
          return { ok: false, idx, error: msg };
        }
      }));

      for (const res of sendResults) {
        if (res.status === "fulfilled" && res.value.ok) {
          broadcastOk = true;
          break;
        } else {
          const errDetail = res.status === "fulfilled" ? res.value.error : (res.reason && res.reason.message);
          if (errDetail) lastBroadcastErr = errDetail;
        }
      }

      if (broadcastOk) {
        break;
      }

      // If LiteServer returned an HTTP timeout, check if the external message was ingested anyway
      try {
        const quickSeqno = await fetchSeqno();
        if (quickSeqno >= expectedSeqno) {
          broadcastOk = true;
          break;
        }
      } catch (_) {}

      if (bAttempt < 3) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // In case LiteServer gateway timed out waiting for ACK but actually accepted the message
    if (!broadcastOk) {
      const isTimeoutErr = lastBroadcastErr.toLowerCase().includes("timeout") || lastBroadcastErr.toLowerCase().includes("liteserver");
      if (isTimeoutErr) {
        await new Promise(r => setTimeout(r, 2500));
        const checkSeqno = await fetchSeqno();
        if (checkSeqno >= expectedSeqno) {
          broadcastOk = true;
        } else {
          try {
            const checkTxs = await callWithFailover(c => c.getTransactions(activeWallet.address, { limit: 3 }), 1);
            if (checkTxs && checkTxs.some(t => t.now >= broadcastStartTime && t.outMessages && t.outMessages.size > 0)) {
              broadcastOk = true;
            }
          } catch (_) {}
        }
      }
    }

    if (!broadcastOk) {
      return {
        success: false,
        isConfigured: true,
        error: "BROADCAST_FAILED",
        message: `On-chain transfer failed to broadcast: ${lastBroadcastErr}. Please retry in a few moments.`
      };
    }

    // STRICT ON-CHAIN CONFIRMATION CHECK:
    // Verify that validators actually executed the transaction by checking seqno AND transactions ledger!
    const expectedSeqno = currentSeqno + 1;
    let confirmedOnChain = false;
    let confirmedTxHash = null;

    // Poll every 2 seconds up to 14 attempts (~28-30 seconds)
    for (let pollIdx = 0; pollIdx < 14; pollIdx++) {
      await new Promise(r => setTimeout(r, 2000));
      
      // 1. Check if seqno advanced
      const latestSeqno = await fetchSeqno();
      if (latestSeqno >= expectedSeqno) {
        confirmedOnChain = true;
        break;
      }

      // 2. Also check if recent outgoing transaction appears in ledger
      try {
        const txs = await callWithFailover(c => c.getTransactions(activeWallet.address, { limit: 4 }));
        if (txs && txs.length > 0) {
          const recentTx = txs.find(t => t.now >= broadcastStartTime && t.outMessages && t.outMessages.size > 0);
          if (recentTx) {
            confirmedOnChain = true;
            confirmedTxHash = recentTx.hash().toString("hex");
            break;
          }
        }
      } catch (_) {}
    }

    // If still not confirmed, check if balance decreased
    if (!confirmedOnChain && balanceTon > 0) {
      try {
        const checkNano = await callWithFailover(c => c.getBalance(activeWallet.address));
        const checkBal = parseFloat(fromNano(checkNano));
        if (checkBal < (balanceTon - (amtNum * 0.9))) {
          confirmedOnChain = true;
        }
      } catch (_) {}
    }

    if (!confirmedOnChain) {
      // Transaction was NOT confirmed on-chain!
      return {
        success: false,
        isConfigured: true,
        error: "TRANSACTION_NOT_CONFIRMED",
        message: `TON transfer was broadcast but not yet confirmed on-chain within 30s. TON was NOT deducted. Withdrawal remains strictly PENDING.`
      };
    }

    // Now that transaction IS confirmed, fetch the REAL on-chain transaction hash!
    if (!confirmedTxHash) {
      for (let txAttempt = 0; txAttempt < 3; txAttempt++) {
        try {
          const txs = await callWithFailover(c => c.getTransactions(activeWallet.address, { limit: 4 }));
          if (txs && txs.length > 0) {
            confirmedTxHash = txs[0].hash().toString("hex");
            break;
          }
        } catch (_) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    const finalTxHash = confirmedTxHash || extCell.hash().toString("hex");

    if (db) {
      try {
        await db.collection("settings").updateOne(
          { key: "ton_autopay" },
          {
            $set: {
              lastSeqno: expectedSeqno,
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
      message: `Successfully transferred ${amtNum} TON on-chain from ${senderAddress}! TxHash: ${finalTxHash}`
    };
  } catch (err) {
    const errorDetails = err.response?.data?.error || err.response?.data?.message || err.message;
    console.error("TON Auto-Pay error:", errorDetails);
    return {
      success: false,
      isConfigured: true,
      error: errorDetails,
      message: `On-chain transfer failed: ${errorDetails}`
    };
  }
}

module.exports = {
  dispatchTonPayout,
  getTonAutoPayStatus,
  getTonAutoPayConfig
};
