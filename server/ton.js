import axios from 'axios';
import dotenv from 'dotenv';
import { db } from './db.js';
import { bot } from './bot.js';

dotenv.config();

const TON_WALLET_ADDRESS = process.env.TON_WALLET_ADDRESS || '';
const TONCONSOLE_API_KEY = process.env.TONCONSOLE_API_KEY || '';
const TON_API_BASE = 'https://tonapi.io/v2';

export function getTonConfig() {
  return {
    walletAddress: TON_WALLET_ADDRESS,
    isConfigured: Boolean(TON_WALLET_ADDRESS && TONCONSOLE_API_KEY)
  };
}

/**
 * Fetch recent incoming transactions from TonAPI / TonConsole
 */
export async function fetchRecentTransactions(limit = 25) {
  if (!TON_WALLET_ADDRESS || !TONCONSOLE_API_KEY) {
    return [];
  }

  try {
    const res = await axios.get(`${TON_API_BASE}/blockchain/accounts/${TON_WALLET_ADDRESS}/transactions?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${TONCONSOLE_API_KEY}`,
        'User-Agent': 'TreasureHuntTMA/1.0'
      },
      timeout: 8000
    });

    return res.data?.transactions || [];
  } catch (err) {
    console.error('Error fetching TON transactions from TonAPI:', err.response?.data?.error || err.message);
    return [];
  }
}

/**
 * Extract comment/memo from incoming TON message
 */
function extractMemo(inMsg) {
  if (!inMsg) return '';

  // 1. Text from decoded_body
  if (inMsg.decoded_body && typeof inMsg.decoded_body.text === 'string') {
    return inMsg.decoded_body.text.trim();
  }

  // 2. Text comment field
  if (typeof inMsg.comment === 'string') {
    return inMsg.comment.trim();
  }

  // 3. Fallback: decode raw_body hex if text_comment opcode (0x00000000)
  if (inMsg.raw_body && inMsg.op_code === '0x00000000') {
    try {
      const buf = Buffer.from(inMsg.raw_body, 'hex');
      // Strip BOC header bytes to read text payload
      const text = buf.toString('utf8').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
      if (text) return text;
    } catch (e) {}
  }

  return '';
}

/**
 * Process a single TON transaction (idempotent, thread-safe, high-concurrency)
 */
export async function processTonTransaction(tx, source = 'webhook') {
  if (!tx || !tx.hash) return { ignored: true, reason: 'invalid_tx' };

  const txHash = tx.hash;

  // Idempotent guard: never process the same transaction twice
  if (db.isTonTxProcessed(txHash)) {
    return { ignored: true, reason: 'already_processed', txHash };
  }

  const inMsg = tx.in_msg;
  if (!inMsg) return { ignored: true, reason: 'no_incoming_msg', txHash };

  const rawValue = Number(inMsg.value) || 0;
  const amountTon = Number((rawValue / 1e9).toFixed(4));
  const memo = extractMemo(inMsg);
  const senderAddress = inMsg.source?.address || '';

  console.log(`💎 Processing TON Tx: ${txHash.slice(0, 10)}... | Amount: ${amountTon} TON | Memo: "${memo}" | Source: ${source}`);

  // ----------------------------------------------------
  // CASE 1: Exclusive Task Campaign Payment (EXCL_...)
  // ----------------------------------------------------
  if (memo.includes('EXCL_') || memo.includes('task_user_')) {
    let taskId = memo.replace('EXCL_', '').trim();
    let task = db.getTaskById(taskId);

    if (!task) {
      // Search by partial match if memo has additional text
      task = db.data.tasks.find(t => t.id === taskId || memo.includes(t.id));
    }

    if (task && task.status === 'pending_payment') {
      // Approve and activate campaign
      task.status = 'approved';
      task.is_active = true;
      task.paid_at = new Date().toISOString();
      task.tx_hash = txHash;
      task.paid_amount_ton = amountTon;

      // Record transaction
      db.recordTonTx({
        hash: txHash,
        type: 'exclusive_task',
        taskId: task.id,
        creatorId: task.creator_id,
        amountTon,
        memo,
        sender: senderAddress,
        source,
        confirmedAt: new Date().toISOString()
      });

      // Notify task creator on Telegram Bot
      if (bot && task.creator_id) {
        const notifyText =
          `🎉 *Exclusive Task Campaign Approved & Live!*\n\n` +
          `📋 *Campaign:* ${task.title}\n` +
          `👥 *Target Hunters:* ${task.max_users} users\n` +
          `💎 *TON Paid:* ${amountTon} TON\n` +
          `🔗 *Tx Hash:* \`${txHash.slice(0, 16)}...\`\n\n` +
          `✅ Your campaign has been verified on the TON Blockchain and is now live for all hunters to complete!`;

        bot.telegram.sendMessage(task.creator_id, notifyText, { parse_mode: 'Markdown' })
          .catch(err => console.warn('Bot telegram notification error:', err.message));
      }

      db.save();
      await db.flush();
      console.log(`✅ Campaign "${task.title}" successfully approved & activated for user ${task.creator_id}`);
      return { success: true, type: 'exclusive_task', taskId: task.id, task };
    }
  }

  // ----------------------------------------------------
  // CASE 2: User Deposit (DEP_...)
  // ----------------------------------------------------
  if (memo.startsWith('DEP_')) {
    const parts = memo.split('_');
    const userId = parts[1];
    const user = db.getUser(userId);

    if (user) {
      user.ton_balance = Number(((user.ton_balance || 0) + amountTon).toFixed(4));
      // Conversion to diamonds: 1 TON ≈ 125,000 GEMS
      const diamondsCredit = Math.round(amountTon * 125000);
      user.diamonds += diamondsCredit;

      db.recordTonTx({
        hash: txHash,
        type: 'deposit',
        userId: user.id,
        amountTon,
        diamondsCredited: diamondsCredit,
        memo,
        sender: senderAddress,
        source,
        confirmedAt: new Date().toISOString()
      });

      if (bot && user.id) {
        const depositNotify =
          `💎 *TON Deposit Confirmed!*\n\n` +
          `💰 *Amount:* +${amountTon} TON\n` +
          `🎁 *Gems Credited:* +${diamondsCredit.toLocaleString()} GEMS\n` +
          `🔗 *Tx Hash:* \`${txHash.slice(0, 16)}...\`\n\n` +
          `Your balance has been updated in Treasure Hunt!`;

        bot.telegram.sendMessage(user.id, depositNotify, { parse_mode: 'Markdown' })
          .catch(err => console.warn('Deposit bot notification error:', err.message));
      }

      db.save();
      await db.flush();
      console.log(`✅ User ${user.id} credited with ${amountTon} TON / ${diamondsCredit} GEMS`);
      return { success: true, type: 'deposit', userId: user.id, amountTon };
    }
  }

  // Record unassigned/general transaction so it's marked processed
  db.recordTonTx({
    hash: txHash,
    type: 'unmatched',
    amountTon,
    memo,
    sender: senderAddress,
    source,
    confirmedAt: new Date().toISOString()
  });
  await db.flush();

  return { success: true, type: 'unmatched', txHash };
}

/**
 * Fetch a specific transaction by its hash
 */
export async function fetchTransactionByHash(txHash) {
  if (!txHash || !TONCONSOLE_API_KEY) return null;
  try {
    const res = await axios.get(`${TON_API_BASE}/blockchain/transactions/${txHash}`, {
      headers: {
        Authorization: `Bearer ${TONCONSOLE_API_KEY}`,
        'User-Agent': 'TreasureHuntTMA/1.0'
      },
      timeout: 8000
    });
    return res.data;
  } catch (err) {
    console.error('Error fetching tx by hash:', err.response?.data?.error || err.message);
    return null;
  }
}

/**
 * Process any webhook payload (handles single tx, tx array, or { tx_hash } event)
 */
export async function handleWebhookPayload(payload) {
  if (!payload) return { received: false };

  // 1. Direct transaction object
  if (payload.hash && payload.in_msg) {
    return await processTonTransaction(payload, 'webhook');
  }

  // 2. TonConsole / TonAPI event with tx_hash
  const txHash = payload.tx_hash || payload.hash;
  if (txHash && typeof txHash === 'string') {
    const fullTx = await fetchTransactionByHash(txHash);
    if (fullTx) {
      return await processTonTransaction(fullTx, 'webhook_event');
    }
  }

  // 3. Array of transactions
  const txList = Array.isArray(payload) ? payload : (payload.transactions || payload.events || []);
  if (Array.isArray(txList) && txList.length > 0) {
    let processed = 0;
    for (const item of txList) {
      if (item.hash) {
        await processTonTransaction(item, 'webhook_batch');
        processed++;
      } else if (item.tx_hash) {
        const full = await fetchTransactionByHash(item.tx_hash);
        if (full) {
          await processTonTransaction(full, 'webhook_batch');
          processed++;
        }
      }
    }
    return { received: true, processed };
  }

  // Fallback: run scan to ensure we didn't miss it
  return await verifyPendingTonPayments();
}

/**
 * 1-Minute Fallback Cron & On-Demand Payment Verifier
 * Scans recent blockchain transactions and auto-confirms any matching pending orders
 */
export async function verifyPendingTonPayments() {
  const pendingTasks = db.data.tasks.filter(t => t.category === 'exclusive' && t.status === 'pending_payment');
  
  // Fetch latest 30 transactions from TonAPI
  const txs = await fetchRecentTransactions(30);
  if (!txs || txs.length === 0) {
    return { verifiedCount: 0, pendingTasksCount: pendingTasks.length };
  }

  let verifiedCount = 0;
  for (const tx of txs) {
    try {
      const result = await processTonTransaction(tx, 'cron');
      if (result.success && result.type !== 'unmatched') {
        verifiedCount++;
      }
    } catch (err) {
      console.error('Error processing transaction in cron:', err.message);
    }
  }

  return { verifiedCount, pendingTasksCount: pendingTasks.length };
}
