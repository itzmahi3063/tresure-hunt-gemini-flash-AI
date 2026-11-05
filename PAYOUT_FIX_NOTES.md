# Auto-pay fix notes

Files changed: lib/tonAutoPay.js, api/admin.js, api/webhook.js, lib/userHelper.js, public/admin.html
No function was deleted. Existing exports/signatures are unchanged (dispatchTonPayout only got an optional 5th argument).
New exports: checkTonPayoutStatus, resolveProcessingWithdrawal. New admin action: release_processing_withdrawal.

## What was wrong
1. Not confirmed in 15s => treated as FAILED and released to PENDING, but the transaction could still land later => retry = DOUBLE PAY.
2. Server timeout after broadcast => withdrawal stuck in PROCESSING forever, never shown/picked by the queue ("ignored").
3. Tx link = latest transaction of the hot wallet (could be a deposit / another payout) => wrong / fake proof.
4. IGNORE_ERRORS send mode: seqno can advance even if the transfer was not delivered => "approved but not paid".
5. No RPC timeouts, fixed 8s + 6s pauses => slow.
6. purgeExcessUserWithdrawals could delete PENDING/PROCESSING withdrawals (user's coins already deducted).

## What it does now
- Payout intent (seqno, signed-message hash, expiry) is saved BEFORE broadcasting.
- Our exact transaction is found by the hash of the message we signed; verified (compute + action phase + out message to the user's address). Tx link is always the real one.
- Slow confirmation => withdrawal stays PROCESSING (never released, never re-sent). Re-approve / Finalize only checks the chain.
- Messages expire after 90s; only after expiry + 90s grace + no matching tx on the nodes is it released to PENDING.
- Anything that looks like the payout but cannot be matched => REVIEW (manual), never auto-released.
- One payout at a time per hot wallet (DB lock) across admin panel + Telegram bot.
- Hedged RPC failover + timeouts, parallel broadcast, parallel balance/seqno reads.
- Wrong / testnet / empty addresses are skipped instantly and stay PENDING (flagged in the list).
- Admin queue: 8s pause -> 1s, retry wait 6s -> 3s, pending-polling, PROCESSING rows show Finalize / Release.

## Env
TON_CONFIRM_BUDGET_MS (default 14000): how long one request waits for confirmation before returning "pending".
Set it below your Vercel function timeout.

## Before going live
Do ONE real test payout with a tiny amount (e.g. 0.01 TON) and confirm the Tx link opens the right transaction on tonviewer.com.

## Secrets cleanup
- Removed hardcoded admin / S2S / action-signing secret literals from api/admin.js, api/ads.js, api/webhook.js, lib/actionSigner.js (and the old src/ copies).
  Before, those literal strings were accepted as valid admin / postback keys even if Vercel env had different values.
- Missing env now fails closed (empty secret never matches anything).
- .env.example and the admin.html help text now contain placeholders only.
- Requirements in Vercel env: ADMIN_SECRET_KEY, ADSGRAM_S2S_SECRET (must equal the secret in the Adsgram postback URL), TELEGRAM_BOT_TOKEN, CRON_SECRET.
