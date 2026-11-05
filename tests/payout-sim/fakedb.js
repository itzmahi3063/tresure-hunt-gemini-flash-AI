function get(o, path){ return path.split(".").reduce((a,k)=> (a==null?undefined:a[k]), o); }
function match(doc, q){
  return Object.entries(q).every(([k,v]) => {
    const dv = get(doc,k);
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && Object.keys(v).some(x=>x.startsWith("$"))){
      return Object.entries(v).every(([op,x]) => op==="$lt"? dv<x : op==="$gt"? dv>x : op==="$ne"? dv!==x : op==="$in"? x.includes(dv) : true);
    }
    return String(dv) === String(v);
  });
}
function setPath(o, path, val){ const ks=path.split("."); let c=o; ks.slice(0,-1).forEach(k=>{ c[k]=c[k]||{}; c=c[k]; }); c[ks.at(-1)]=val; }
module.exports = function makeDb(){
  const cols = {};
  const col = (name) => { cols[name] = cols[name] || []; const arr = cols[name]; return {
    arr,
    async findOne(q){ return arr.find(d=>match(d,q)) || null; },
    async insertOne(d){ arr.push(d); return {}; },
    async updateOne(q, u, opts={}){
      let d = arr.find(x=>match(x,q));
      if(!d){ if(!opts.upsert) return {matchedCount:0,modifiedCount:0}; d = {}; Object.entries(q).forEach(([k,v])=>{ if(typeof v!=="object") d[k]=v; }); Object.assign(d,u.$setOnInsert||{}); arr.push(d); }
      else if (u.$setOnInsert && !opts.upsert) {}
      Object.entries(u.$set||{}).forEach(([k,v])=>setPath(d,k,v));
      Object.keys(u.$unset||{}).forEach(k=>delete d[k]);
      return {matchedCount:1,modifiedCount:1};
    }
  };};
  return { collection: col, cols };
};
