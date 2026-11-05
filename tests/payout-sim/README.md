# Payout simulation (no real TON is ever sent)

Runs the real `lib/tonAutoPay.js` against a FAKE blockchain (slow blocks, hanging RPC nodes, failed transfers,
unrelated deposits, double-submit, expired messages ...).

    cd tests/payout-sim
    NODE_PATH=./fake_modules node sim.js

Expected last line: `RESULT: 22 passed, 0 failed`
This folder is not deployed (vercel.json only builds `api/` and `public/`).
