# 💎 Treasure Hunt - Telegram Mini App (TMA) & Secure Admin System

A complete full-stack Telegram Mini App (TMA) featuring a dark luxury **Treasure Hunt** aesthetic (Gold & Cyan Diamond vibe), server-authoritative balance protection against DevTools/Termux/hacker tampering, dynamic multi-category task manager, in-app wallet conversion & withdrawal, referral system, and a Telegram Bot & Web Admin Panel locked to Admin ID `5697990319`.

---

## 🌟 Key Features

1. **Treasure Hunt Aesthetic & UI**:
   - **Header**: Real Telegram user photo, name, username, Telegram ID, real Diamond balance, USDT balance, Keys count, and Refers.
   - **Home**: Interactive animated Glowing Treasure Chest with "Tap to Open Chest" button, key consumption, and drop rewards.
   - **Quick Action Grid**: Watch Ads, Tasks, Refer, Spin, Wallet, Profile.
   - **Bottom Navigation**: `Home` | `Tasks` | `Play` | `Refer` | `Profile`.

2. **Tasks & Monetization (4 Categories)**:
   - **Daily**: Watch Ads (Adsgram, Monetag, rewarded video clips) with daily limit counters and instant diamond payouts.
   - **Social**: Official Telegram Channels & Groups with cryptographic server verification (`getChatMember`).
   - **Exclusive**: Top "Add your own task" banner (opens Contact Admin popup) + exclusive crypto tasks.
   - **Partner**: YouTube, Twitter/X, Instagram, and partner channel tasks.

3. **In-App Treasury Wallet**:
   - **Convert**: Real-time conversion of Diamonds to USDT at rate **`1 Diamond = $0.00004 USD`**.
   - **Withdraw**: Request USDT payout via `TRC20`, `TON`, or `BEP20` with address validation and minimum threshold.
   - **History**: Real-time log of conversions and withdrawals.

4. **Referral Program**:
   - Total referrals counter & referral earnings in Diamonds and USD.
   - **10% Lifetime Withdrawal Commission** on all downstream referral cashouts.
   - 3-Step bonus guide (Channel Join -> 5 Tasks -> 20 Ads).
   - Instant Telegram direct share & copy referral link card.

5. **🛡️ Anti-Cheat & Security System**:
   - **Telegram `initData` Cryptographic HMAC-SHA256 Verification**: Impossible to spoof balance or user credentials via browser DevTools, Postman, or Termux scripts.
   - **Server-Authoritative Balances**: Balances are stored and credited strictly on the server.
   - **Server Membership Checking**: Verifies active Telegram channel subscription before distributing rewards.

6. **Admin Panel (Bot `/admin` & Web Dashboard)**:
   - Strictly restricted to Telegram User ID: **`5697990319`**.
   - **Broadcast**: Send markdown announcements to all users directly via Telegram DM.
   - **Add Task**: Channel/Group (with instant Bot Admin verification check) or Bot/Website tasks with custom rewards and user limits.
   - **Manage Daily Ads**: Toggle visibility (Hide/Show) and edit reward coins.
   - **User Manager**: Search any user, view balance stats, and manually add/deduct Diamonds/USDT.
   - **Withdrawal Approvals**: Approve or reject pending payout requests.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Edit `.env` (or copy from `.env.example`):
```env
BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER
ADMIN_ID=5697990319
WEBAPP_URL=http://localhost:5173
PORT=5000
NODE_ENV=development
```

### 3. Run Development Server
```bash
# Start both backend server (port 5000) and frontend (port 5173)
npm run dev
```

Frontend will be available at: `http://localhost:5173`  
Backend API will be available at: `http://localhost:5000`

---

## 🌐 Deployment Guide (Free Hosting & Custom Domain)

### Option A: Frontend on Vercel / Cloudflare + Backend on Render / Railway

1. **Deploy Backend (Render / Railway / VPS)**:
   - Create a new Web Service on [Render](https://render.com) or [Railway](https://railway.app).
   - Set build command: `npm install`
   - Set start command: `node server/index.js`
   - Add environment variables: `BOT_TOKEN`, `ADMIN_ID=5697990319`, `WEBAPP_URL=https://your-frontend-url.vercel.app`.

2. **Deploy Frontend (Vercel / Netlify)**:
   - Connect your GitHub repository to [Vercel](https://vercel.com).
   - Set build command: `npm run build`
   - Set output directory: `dist`
   - Add rewrite rule in `vercel.json` to route `/api/*` to your backend URL.

### Option B: All-in-One VPS / Single Server (Nginx + SSL)
```bash
npm run build
NODE_ENV=production node server/index.js
```

---

## 🤖 Telegram Bot & Mini App Setup via @BotFather

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot` and follow the steps to get your `BOT_TOKEN`.
3. Send `/newapp` to connect your Mini App:
   - Choose your bot.
   - Enter App Title: `Treasure Hunt`
   - Enter Short Description & Upload Icon.
   - Provide your HTTPS WebApp URL (e.g. `https://your-app.vercel.app`).
   - Set Short Name: `app` (Your app link will be `https://t.me/your_bot?startapp=...`).
4. To test Admin Panel: Send `/admin` in Telegram chat with your bot using account `5697990319`.
