const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

// 1. Load .env
const envFile = path.resolve(__dirname, "../.env");
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, "utf8");
  content.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const uri = process.env.MONGODB_URI;
const currentDbName = process.env.MONGODB_DB || "hoocooh_mine";

if (!uri) {
  console.error("❌ MONGODB_URI is not set in .env file!");
  process.exit(1);
}

const args = process.argv.slice(2);
const restoreIndex = args.indexOf("--restore");
const restoreSourceDb = restoreIndex !== -1 ? args[restoreIndex + 1] : null;

async function run() {
  console.log("==================================================");
  console.log("🔍 Scanning MongoDB Cluster Databases & Collections");
  console.log("==================================================");
  console.log(`📡 Current configured MONGODB_DB: "${currentDbName}"\n`);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  console.log("✅ Successfully connected to MongoDB Atlas!");

  const adminDb = client.db().admin();
  const dbsList = await adminDb.listDatabases();

  console.log(`\nFound ${dbsList.databases.length} database(s) in your cluster:\n`);

  let bestCandidate = null;
  let maxUsers = -1;

  for (const dbInfo of dbsList.databases) {
    const name = dbInfo.name;
    // Skip system databases
    if (["admin", "local", "config"].includes(name)) continue;

    const db = client.db(name);
    const collections = await db.listCollections().toArray();
    const colNames = collections.map(c => c.name);

    let userCount = 0;
    let totalCoins = 0;
    let withdrawalCount = 0;

    if (colNames.includes("users")) {
      userCount = await db.collection("users").countDocuments();
      const balanceAgg = await db.collection("users").aggregate([
        { $group: { _id: null, total: { $sum: "$balance" } } }
      ]).toArray();
      totalCoins = balanceAgg.length > 0 ? (balanceAgg[0].total || 0) : 0;
    }

    if (colNames.includes("withdrawals")) {
      withdrawalCount = await db.collection("withdrawals").countDocuments();
    }

    const isCurrent = name === currentDbName ? " 👈 (CURRENT ACTIVE DB)" : "";
    console.log(`📂 Database: [${name}]${isCurrent}`);
    console.log(`   - Collections: ${colNames.join(", ") || "(empty)"}`);
    console.log(`   - Total Users: ${userCount.toLocaleString()}`);
    console.log(`   - Total Balance: ${totalCoins.toLocaleString()} coins`);
    console.log(`   - Total Withdrawals: ${withdrawalCount.toLocaleString()}`);
    console.log("--------------------------------------------------");

    if (userCount > maxUsers && name !== currentDbName) {
      maxUsers = userCount;
      bestCandidate = { name, userCount, totalCoins, withdrawalCount };
    }
  }

  // If user requested --restore <sourceDb>
  if (restoreSourceDb) {
    console.log(`\n🚀 Starting safe restore from "${restoreSourceDb}" to "${currentDbName}"...`);
    const srcDb = client.db(restoreSourceDb);
    const targetDb = client.db(currentDbName);

    const colsToCopy = ["users", "withdrawals", "tasks", "promos", "settings", "admins"];
    for (const colName of colsToCopy) {
      const srcCol = srcDb.collection(colName);
      const docs = await srcCol.find({}).toArray();
      if (docs.length === 0) continue;

      const targetCol = targetDb.collection(colName);
      console.log(`   Copying ${docs.length} document(s) for "${colName}"...`);
      for (const doc of docs) {
        await targetCol.replaceOne({ _id: doc._id }, doc, { upsert: true });
      }
      console.log(`   ✅ Finished copying "${colName}".`);
    }

    console.log(`\n🎉 Data restored successfully from "${restoreSourceDb}" into "${currentDbName}"!`);
  } else if (bestCandidate && bestCandidate.userCount > 0) {
    console.log(`\n💡 NOTICE: We found your old data in database: "${bestCandidate.name}"!`);
    console.log(`   It has ${bestCandidate.userCount} users, ${bestCandidate.totalCoins} coins, and ${bestCandidate.withdrawalCount} withdrawals.`);
    console.log(`\n👉 Option 1 (Easiest): Edit .env on your VPS and change:`);
    console.log(`   MONGODB_DB=${bestCandidate.name}`);
    console.log(`   Then run: pm2 restart treasure-mine`);
    console.log(`\n👉 Option 2: Copy that data into "${currentDbName}" by running:`);
    console.log(`   node scripts/check-db.js --restore ${bestCandidate.name}`);
  }

  await client.close();
}

run().catch(err => {
  console.error("❌ Error running diagnostic:", err);
  process.exit(1);
});
