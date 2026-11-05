process.env.TON_WALLET_MNEMONIC = Array.from({length:24},(_,i)=>"word"+i).join(" ");
process.env.TON_AUTO_PAY = "true";
process.env.TON_CONFIRM_BUDGET_MS = "5000";
const makeDb = require("./fakedb");
const crypto = require("crypto");
const H = (x) => crypto.createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x)).digest();
const pay = require("../../lib/tonAutoPay.js");
const chain = global.__CHAIN__;
const GOOD = "UQAbcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ"; // 48 chars UQ..
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
let pass=0, fail=0;
const ok=(c,msg)=>{ if(c){pass++;console.log("  PASS",msg);} else {fail++;console.log("  FAIL",msg);} };
function reset(){ Object.assign(chain,{ seqno:5,balance:100,txs:[],latency:0,hangEndpoints:new Set(),landDelayMs:0,actionFails:false,broadcastError:null,landDespiteError:false,sendCount:0 }); }
const payoutTxOf = () => chain.txs.find(t=>t.inMessage.info.type==="external-in");
async function withWithdrawal(db){ const w={_id:"w1",status:"PROCESSING",processingAt:Date.now(),payoutV:2}; db.collection("withdrawals").arr.push(w); return w; }

(async()=>{
 console.log("\n[1] Happy path + unrelated deposit lands right after (old code would show the DEPOSIT hash)");
 reset(); let db=makeDb(); let w=await withWithdrawal(db); chain.landDelayMs=2500;
 setTimeout(()=>chain.deposit(5), 2700);
 let t0=Date.now();
 let r=await pay.dispatchTonPayout(GOOD,1.5,"memo",db,{withdrawalId:"w1",onPrepared:async p=>{w.pendingTx=p;}});
 console.log("   took",Date.now()-t0,"ms");
 ok(r.success===true,"success=true");
 ok(r.txHash===payoutTxOf().hash().toString("hex"),"txHash is the REAL payout tx");
 ok(r.txHash!==chain.txs[0].hash().toString("hex"),"txHash is NOT the latest wallet tx (deposit) - old bug");
 ok(chain.seqno===6,"exactly one transfer executed");

 console.log("\n[2] Slow confirmation (lands after budget) -> pending, NOT failure; later finalized");
 reset(); db=makeDb(); w=await withWithdrawal(db); chain.landDelayMs=9000;
 r=await pay.dispatchTonPayout(GOOD,2,"m",db,{withdrawalId:"w1",onPrepared:async p=>{w.pendingTx=p;}});
 ok(r.success===false && r.pendingConfirmation===true,"returns pendingConfirmation (claim must stay PROCESSING)");
 let rr=await pay.resolveProcessingWithdrawal(db,w);
 ok(rr.action==="PENDING","resolve before landing => PENDING (no release, no double pay)");
 await sleep(7500);
 rr=await pay.resolveProcessingWithdrawal(db,w);
 ok(rr.action==="CONFIRMED" && rr.txHash===payoutTxOf().hash().toString("hex"),"after landing => CONFIRMED with real tx hash");

 console.log("\n[3] Seqno advances but transfer NOT delivered (action failed) -> must NOT report success");
 reset(); db=makeDb(); w=await withWithdrawal(db); chain.actionFails=true; chain.landDelayMs=500;
 r=await pay.dispatchTonPayout(GOOD,1,"m",db,{withdrawalId:"w1",onPrepared:async p=>{w.pendingTx=p;}});
 ok(r.success===false && r.error==="PAYOUT_NOT_DELIVERED","detected: PAYOUT_NOT_DELIVERED (old code = fake approve)");

 console.log("\n[4] Broadcast accepted but never lands -> after expiry safe release; lookalike => REVIEW (never auto release)");
 reset(); db=makeDb(); w=await withWithdrawal(db); chain.landDelayMs=1e9;
 r=await pay.dispatchTonPayout(GOOD,1,"m",db,{withdrawalId:"w1",onPrepared:async p=>{w.pendingTx=p;}});
 ok(r.pendingConfirmation===true,"pending");
 rr=await pay.resolveProcessingWithdrawal(db,w);
 ok(rr.action==="PENDING","not expired yet => keep waiting");
 w.pendingTx.validUntil=Math.floor(Date.now()/1000)-1000; // time travel
 rr=await pay.resolveProcessingWithdrawal(db,w);
 ok(rr.action==="RELEASED" && w.status==="PENDING" && !w.pendingTx,"expired + nothing sent => released to PENDING");
 // lookalike
 reset(); db=makeDb(); w=await withWithdrawal(db); chain.landDelayMs=1e9;
 await pay.dispatchTonPayout(GOOD,1,"m",db,{withdrawalId:"w1",onPrepared:async p=>{w.pendingTx=p;}});
 const dest=require("@ton/ton").Address.parse(GOOD);
 chain.txs.unshift({now:Math.floor(Date.now()/1000),lt:1n,inMessage:{info:{type:"external-in"},body:{hash:()=>H("other")}},outMessages:{values:()=>[{info:{type:"internal",dest,value:{coins:1n}}}]},description:{type:"generic",aborted:false,computePhase:{type:"vm",success:true},actionPhase:{success:true}},hash:()=>H("lookalike")});
 w.pendingTx.validUntil=Math.floor(Date.now()/1000)-1000;
 rr=await pay.resolveProcessingWithdrawal(db,w);
 ok(rr.action==="REVIEW" && w.status==="PROCESSING","unmatched look-alike payout => REVIEW, NOT released (prevents double pay)");

 console.log("\n[5] Wrong / testnet / empty address -> instantly ignored, nothing signed");
 reset(); db=makeDb();
 for (const [label,a] of [["garbage","hello"],["testnet","0QAbcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ"],["empty",""]]) {
   t0=Date.now(); r=await pay.dispatchTonPayout(a,1,"m",db,{});
   ok(r.isAddressInvalid===true && Date.now()-t0<200 && chain.sendCount===0,label+" => isAddressInvalid, <200ms, 0 broadcasts");
 }

 console.log("\n[6] Network timeout on broadcast but message actually reached chain -> still success (no false fail)");
 reset(); db=makeDb(); w=await withWithdrawal(db); chain.broadcastError={msg:"timeout of 6000ms exceeded"}; chain.landDespiteError=true; chain.landDelayMs=600;
 r=await pay.dispatchTonPayout(GOOD,1,"m",db,{withdrawalId:"w1",onPrepared:async p=>{w.pendingTx=p;}});
 ok(r.success===true,"ambiguous broadcast error handled, payout confirmed");

 console.log("\n[7] Definitive node rejection -> clean failure (safe retry), no pending limbo");
 reset(); db=makeDb(); w=await withWithdrawal(db); chain.broadcastError={msg:"Received error: seqno mismatch",http:true};
 r=await pay.dispatchTonPayout(GOOD,1,"m",db,{withdrawalId:"w1",onPrepared:async p=>{w.pendingTx=p;}});
 ok(r.success===false && r.error==="BROADCAST_FAILED" && !r.pendingConfirmation,"BROADCAST_FAILED (not pending)");

 console.log("\n[8] First RPC endpoint hangs forever -> hedged failover keeps payout fast");
 reset(); db=makeDb(); w=await withWithdrawal(db); chain.hangEndpoints.add("https://ton.access.orbs.network/44A1c0ff5Bd3F8B62C092Ab4D238bEE463E644A1/1/mainnet/toncenter-api-v2/jsonRPC"); chain.landDelayMs=800;
 t0=Date.now(); r=await pay.dispatchTonPayout(GOOD,1,"m",db,{withdrawalId:"w1",onPrepared:async p=>{w.pendingTx=p;}});
 console.log("   took",Date.now()-t0,"ms");
 ok(r.success===true,"succeeds with a hanging node");

 console.log("\n[9] Two payouts fired at the same time (two admins / panel + bot) -> serialized, both paid once");
 reset(); db=makeDb(); const wa={_id:"a",status:"PROCESSING",processingAt:Date.now(),payoutV:2}, wb={_id:"b",status:"PROCESSING",processingAt:Date.now(),payoutV:2}; db.collection("withdrawals").arr.push(wa,wb); chain.landDelayMs=800;
 const [ra,rb]=await Promise.all([
   pay.dispatchTonPayout(GOOD,1,"a",db,{withdrawalId:"a",onPrepared:async p=>{wa.pendingTx=p;}}),
   pay.dispatchTonPayout(GOOD,2,"b",db,{withdrawalId:"b",onPrepared:async p=>{wb.pendingTx=p;}}),
 ]);
 console.log("   results:",ra.success,ra.error||"",rb.success,rb.error||"","seqno",chain.seqno);
 ok([ra,rb].filter(x=>x.success).length>=1 && chain.seqno<=7,"never more than 1 message per seqno; no collision");
 ok(chain.txs.filter(t=>t.inMessage.info.type==="external-in").length===chain.seqno-5,"every seqno used exactly once");

 console.log("\n[10] Insufficient hot wallet balance -> clean stop");
 reset(); db=makeDb(); chain.balance=0.5;
 r=await pay.dispatchTonPayout(GOOD,1,"m",db,{});
 ok(r.error==="INSUFFICIENT_HOT_WALLET_BALANCE" && chain.sendCount===0,"halts, nothing broadcast");

 console.log("\n[11] onPrepared persist failure -> nothing broadcast");
 reset(); db=makeDb();
 r=await pay.dispatchTonPayout(GOOD,1,"m",db,{onPrepared:async()=>{throw new Error("db down");}});
 ok(r.error==="PAYOUT_INTENT_NOT_SAVED" && chain.sendCount===0,"aborted before broadcast");

 console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
 process.exit(fail?1:0);
})();
