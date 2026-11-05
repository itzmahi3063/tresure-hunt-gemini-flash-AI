// ---- Minimal fake of @ton/ton + a controllable fake blockchain for simulation ----
const crypto = require("crypto");
const H = (x) => crypto.createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x)).digest();

class Address {
  constructor(raw, testOnly=false){ this.raw = raw; this.testOnly = testOnly; }
  static parse(s){
    s = String(s);
    if (/^0:[0-9a-f]{64}$/.test(s)) return new Address(s);
    if (/^(UQ|EQ|kQ|0Q)[A-Za-z0-9_-]{46}$/.test(s)) return new Address("0:" + H(s.slice(2)).toString("hex"), /^(kQ|0Q)/.test(s));
    throw new Error("Invalid address");
  }
  static isFriendly(s){ return /^(UQ|EQ|kQ|0Q)/.test(String(s)); }
  static parseFriendly(s){ const a = Address.parse(s); return { isTestOnly: a.testOnly, address: a }; }
  equals(o){ return o && o.raw === this.raw; }
  toString(){ return "UQ" + Buffer.from(this.raw).toString("base64url").slice(0,46); }
  toRawString(){ return this.raw; }
}
const toNano = (s) => BigInt(Math.round(parseFloat(s) * 1e9));
const fromNano = (n) => String(Number(n) / 1e9);
const SendMode = { PAY_GAS_SEPARATELY: 1, IGNORE_ERRORS: 2 };
const internal = (o) => ({ kind: "internal", ...o });
const external = (o) => ({ kind: "external", ...o });
const beginCell = () => ({ _o: null, store(o){ this._o = o; return this; }, endCell(){ const o = this._o; return { toBoc: () => Buffer.from(JSON.stringify({ body: o.body.json })), hash: () => H(o) }; } });
const storeMessage = (m) => m;

// ---- fake chain ----
const chain = global.__CHAIN__ = {
  seqno: 5, balance: 100, txs: [], pool: [], latency: 0, hangEndpoints: new Set(), landDelayMs: 0,
  actionFails: false, broadcastError: null, sendCount: 0, lt: 1000,
};
function makeWallet(){
  const addr = new Address("0:" + H("hot").toString("hex"));
  return {
    address: addr, init: null,
    createTransfer({ seqno, messages, timeout }){
      const json = { seqno, msgs: messages.map(m => ({ to: m.to.raw, value: String(m.value) })), memo: messages[0].body, timeout };
      const cell = { json, hash: () => H(json) };
      return cell;
    }
  };
}
class W4 { static create(){ return makeWallet(); } }
class W5 { static create(){ return makeWallet(); } }

function landIfValid(json){
  // emulate validators executing the external message
  if (json.seqno !== chain.seqno) return false;   // wrong seqno => rejected, never lands
  chain.seqno++;
  const out = new Map();
  let failed = chain.actionFails;
  const outMsgs = failed ? [] : json.msgs.map(m => ({ info: { type: "internal", dest: new Address(m.to), value: { coins: BigInt(m.value) } } }));
  const tx = {
    now: Math.floor(Date.now()/1000), lt: BigInt(chain.lt++),
    inMessage: { info: { type: "external-in" }, body: { hash: () => H(json) } },
    outMessages: { values: () => outMsgs },
    description: { type: "generic", aborted: false, computePhase: { type: "vm", success: true }, actionPhase: { success: !failed ? true : true, skippedActions: failed ? 1 : 0 } },
    hash: () => H("tx" + chain.lt),
  };
  chain.txs.unshift(tx);
  return true;
}
chain.deposit = (amtTon) => { // unrelated incoming deposit => becomes txs[0]
  chain.txs.unshift({ now: Math.floor(Date.now()/1000), lt: BigInt(chain.lt++), inMessage: { info: { type: "internal" }, body: { hash: () => H("dep"+chain.lt) } }, outMessages: { values: () => [] }, description: { type: "generic", aborted: false, computePhase: { type: "vm", success: true }, actionPhase: null }, hash: () => H("deposit"+chain.lt) });
};

let clientIdx = 0;
class TonClient {
  constructor({ endpoint }){ this.endpoint = endpoint; this.id = clientIdx++; }
  async _lat(){ if (chain.hangEndpoints.has(this.endpoint)) return new Promise(()=>{}); if (chain.latency) await new Promise(r=>setTimeout(r, chain.latency)); }
  async getBalance(){ await this._lat(); return BigInt(Math.round(chain.balance*1e9)); }
  async runMethod(){ await this._lat(); return { stack: { readNumber: () => chain.seqno } }; }
  async getContractState(){ await this._lat(); return { state: "active" }; }
  open(w){ return { getSeqno: async () => chain.seqno }; }
  async getTransactions(addr, { limit }){ await this._lat(); return chain.txs.slice(0, limit); }
  async sendFile(boc){
    await this._lat();
    chain.sendCount++;
    if (chain.broadcastError) { if (chain.landDespiteError) { const j = JSON.parse(boc.toString()).body; setTimeout(() => landIfValid(j), chain.landDelayMs); } const e = new Error(chain.broadcastError.msg); if (chain.broadcastError.http) e.response = { data: { error: chain.broadcastError.msg } }; throw e; }
    const json = JSON.parse(boc.toString()).body;
    setTimeout(() => landIfValid(json), chain.landDelayMs);
    return {};
  }
}
module.exports = { TonClient, WalletContractV4: W4, WalletContractV5R1: W5, internal, toNano, fromNano, beginCell, external, storeMessage, SendMode, Address };
