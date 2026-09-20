import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  RefreshCw,
  ArrowRightLeft,
  Send,
  History,
  Gem,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ShoppingBag,
  Sparkles,
  Download,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { formatGems, formatUsdt } from '../utils/format';
import api from '../services/api';
import StoreModal from './StoreModal';

export default function WalletModal() {
  const {
    user,
    setUser,
    walletModalOpen,
    setWalletModalOpen,
    walletInitialTab,
    convertDiamonds,
    requestWithdrawal,
    settings
  } = useApp();

  const [activeTab, setActiveTab] = useState('convert');
  const [convertAmount, setConvertAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState('BINANCE'); // 'BINANCE' | 'TON'
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [history, setHistory] = useState(() => {
    try {
      const cached = sessionStorage.getItem('treasure_wallet_history_cache');
      return cached ? JSON.parse(cached) : { withdrawals: [], conversions: [] };
    } catch {
      return { withdrawals: [], conversions: [] };
    }
  });
  const [loadingHistory, setLoadingHistory] = useState(() => !sessionStorage.getItem('treasure_wallet_history_cache'));
  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [tonConfig, setTonConfig] = useState({ walletAddress: '', isConfigured: false });
  const [copiedTonAddress, setCopiedTonAddress] = useState(false);
  const [copiedTonMemo, setCopiedTonMemo] = useState(false);
  const [checkingDeposit, setCheckingDeposit] = useState(false);
  const [proofs, setProofs] = useState(() => {
    try {
      const cached = sessionStorage.getItem('treasure_wallet_proofs_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loadingProofs, setLoadingProofs] = useState(() => !sessionStorage.getItem('treasure_wallet_proofs_cache'));
  const [requirements, setRequirements] = useState({
    tasksCompleted: 0,
    tasksRequired: 20,
    isTasksDone: false,
    gamesPlayed: 0,
    gamesRequired: 5,
    isGamesDone: false,
    isFirstWithdrawal: true,
    crystalCoins: 0,
    crystalRequired: 0,
    isCrystalDone: true,
    canWithdraw: true
  });

  useEffect(() => {
    if (walletModalOpen) {
      setActiveTab(walletInitialTab || 'convert');
      setMessage({ text: '', type: '' });
      loadHistory();
      loadRequirements();
      loadTonConfig();
      loadProofs();
      if (user?.wallets && user.wallets[withdrawNetwork]) {
        setWalletAddress(user.wallets[withdrawNetwork]);
      }
    }
  }, [walletModalOpen, walletInitialTab, withdrawNetwork, user]);

  const loadProofs = async () => {
    setLoadingProofs(true);
    try {
      const res = await api.get('/wallet/proofs');
      if (res.data?.success) {
        setProofs(res.data.proofs || []);
        sessionStorage.setItem('treasure_wallet_proofs_cache', JSON.stringify(res.data.proofs || []));
      }
    } catch (e) {
      console.warn('Failed to load proofs:', e.message);
    } finally {
      setLoadingProofs(false);
    }
  };

  // Group real approved proofs by day
  const groupedProofs = React.useMemo(() => {
    const groups = {};
    const todayStr = new Date().toISOString().split('T')[0];
    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    const yesterdayStr = yDate.toISOString().split('T')[0];

    (proofs || []).forEach((p) => {
      let dayLabel = p.date_str || todayStr;
      if (p.date_str === todayStr) {
        dayLabel = 'Today';
      } else if (p.date_str === yesterdayStr) {
        dayLabel = 'Yesterday';
      } else if (p.date_str) {
        try {
          const d = new Date(p.date_str);
          dayLabel = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) {
          dayLabel = p.date_str;
        }
      }

      if (!groups[dayLabel]) {
        groups[dayLabel] = {
          label: dayLabel,
          totalUsdt: 0,
          items: []
        };
      }
      groups[dayLabel].items.push(p);
      groups[dayLabel].totalUsdt += Number(p.amount) || 0;
    });

    return Object.values(groups);
  }, [proofs]);

  const loadTonConfig = async () => {
    try {
      const res = await api.get('/ton/config');
      if (res.data?.walletAddress) {
        setTonConfig({
          walletAddress: res.data.walletAddress,
          isConfigured: res.data.isConfigured
        });
      }
    } catch (e) {}
  };

  const handleCheckDeposit = async () => {
    if (!user) return;
    setCheckingDeposit(true);
    triggerHaptic('impact', 'medium');
    try {
      const res = await api.get('/ton/check-payment', {
        params: { userId: user.id, memo: `DEP_${user.id}` }
      });
      if (res.data?.paid && res.data.user) {
        setUser(prev => ({
          ...prev,
          diamonds: res.data.user.diamonds,
          ton_balance: res.data.user.ton_balance
        }));
        triggerHaptic('notification', 'success');
        setMessage({ text: 'TON Deposit verified! Gems credited to your balance.', type: 'success' });
      } else {
        triggerHaptic('notification', 'warning');
        setMessage({ text: 'No new deposit found yet. Webhook or cron will auto-credit once confirmed on blockchain.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Failed to check deposit. Try again in a minute.', type: 'error' });
    } finally {
      setCheckingDeposit(false);
    }
  };

  const loadRequirements = async () => {
    try {
      const res = await api.get('/wallet/requirements');
      if (res.data.success) {
        setRequirements(res.data.requirements);
      }
    } catch (e) {
      console.warn('Failed to load withdrawal requirements:', e);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/wallet/history');
      if (res.data.success) {
        const histData = {
          withdrawals: res.data.withdrawals || [],
          conversions: res.data.conversions || []
        };
        setHistory(histData);
        sessionStorage.setItem('treasure_wallet_history_cache', JSON.stringify(histData));
      }
    } catch (e) {
      console.warn('Failed to load wallet history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!walletModalOpen || !user) return null;

  const rate = settings?.rate || 0.00004;
  const numConvert = Number(convertAmount) || 0;
  const grossUsdt = Number((numConvert * rate).toFixed(4));
  const feeUsdt = Number((grossUsdt * 0.25).toFixed(4));
  const netUsdt = Math.max(0, Number((grossUsdt - feeUsdt).toFixed(4)));

  const handleConvert = async (e) => {
    e.preventDefault();
    const amount = Number(convertAmount);
    if (isNaN(amount) || amount < 1000) {
      triggerHaptic('notification', 'error');
      setMessage({ text: 'Minimum conversion amount is 1,000 GEMS', type: 'error' });
      return;
    }
    if (amount > (user.diamonds || 0)) {
      triggerHaptic('notification', 'error');
      setMessage({ text: 'Insufficient GEMS balance', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });
    const res = await convertDiamonds(amount);
    setLoading(false);

    if (res.success) {
      triggerHaptic('notification', 'success');
      setMessage({
        text: `Converted ${amount.toLocaleString()} GEMS to $${res.conversion.usdt_amount.toFixed(4)} USDT!`,
        type: 'success'
      });
      setConvertAmount('');
      loadHistory();
    } else {
      triggerHaptic('notification', 'error');
      setMessage({ text: res.error, type: 'error' });
    }
  };

  const isCurrentWalletLocked = !!(user?.wallets && user.wallets[withdrawNetwork]);

  // Validate and prompt confirmation before withdrawal / locking
  const handleInitiateWithdraw = (e) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    const minWd = 0.05;

    if (isNaN(amount) || amount < minWd) {
      triggerHaptic('notification', 'error');
      setMessage({ text: `Minimum withdrawal amount is $${minWd.toFixed(2)} USDT`, type: 'error' });
      return;
    }
    if (amount > (user.usdt || 0)) {
      triggerHaptic('notification', 'error');
      setMessage({ text: 'Insufficient USDT balance', type: 'error' });
      return;
    }

    const cleanAddr = walletAddress.trim();
    if (!cleanAddr) {
      triggerHaptic('notification', 'error');
      setMessage({ text: `Please enter your ${withdrawNetwork === 'BINANCE' ? 'Binance Pay ID / UID' : 'TON Wallet Address'}`, type: 'error' });
      return;
    }

    if (withdrawNetwork === 'BINANCE') {
      if (!/^\d+$/.test(cleanAddr)) {
        triggerHaptic('notification', 'error');
        setMessage({ text: 'Binance UID must contain digits (numbers) only, e.g. 12345678', type: 'error' });
        return;
      }
      if (cleanAddr.length < 5 || cleanAddr.length > 15) {
        triggerHaptic('notification', 'error');
        setMessage({ text: 'Please enter a valid Binance UID (5-15 digits)', type: 'error' });
        return;
      }
    } else if (withdrawNetwork === 'TON') {
      if (!cleanAddr.startsWith('EQ') && !cleanAddr.startsWith('UQ')) {
        triggerHaptic('notification', 'error');
        setMessage({ text: 'TON Wallet address must start with "EQ" or "UQ"', type: 'error' });
        return;
      }
      if (cleanAddr.length !== 48) {
        triggerHaptic('notification', 'error');
        setMessage({ text: 'TON address must be exactly 48 characters long', type: 'error' });
        return;
      }
    }

    // Check withdrawal requirements
    if (!requirements.isTasksDone) {
      triggerHaptic('notification', 'error');
      setMessage({
        text: `Requirement Unmet: Must complete at least 20 tasks/ads today (${requirements.tasksCompleted}/20 done)`,
        type: 'error'
      });
      return;
    }

    if (!requirements.isGamesDone) {
      triggerHaptic('notification', 'error');
      setMessage({
        text: `Requirement Unmet: Must play at least 5 games today (${requirements.gamesPlayed}/5 played)`,
        type: 'error'
      });
      return;
    }

    if (!requirements.isCrystalDone) {
      triggerHaptic('notification', 'error');
      setMessage({
        text: 'Requirement Unmet: 1 Crystal Coin required for this withdrawal. Please buy it from Store (250 GEMS).',
        type: 'error'
      });
      return;
    }

    // If already locked, proceed directly without lock modal
    if (isCurrentWalletLocked) {
      executeWithdrawal();
    } else {
      // First time setting this wallet -> Show irreversible lock confirmation modal
      triggerHaptic('impact', 'medium');
      setShowLockConfirmModal(true);
    }
  };

  const executeWithdrawal = async () => {
    const amount = Number(withdrawAmount);
    setShowLockConfirmModal(false);
    setLoading(true);
    setMessage({ text: '', type: '' });

    const res = await requestWithdrawal(amount, withdrawNetwork, walletAddress.trim());
    setLoading(false);

    if (res.success) {
      triggerHaptic('notification', 'success');
      setMessage({ text: 'Withdrawal request submitted! 0% fee deducted.', type: 'success' });
      setWithdrawAmount('');
      loadHistory();
    } else {
      triggerHaptic('notification', 'error');
      setMessage({ text: res.error, type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md animate-fadeIn p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#121624] border border-[#22283C] max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl rounded-t-3xl sm:rounded-3xl border-t-2 border-yellow-400 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1E2336] bg-[#0E111C]">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl btn-3d-gold flex items-center justify-center text-black font-black">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="text-base font-heading font-black text-white tracking-wide">Treasury Wallet</h3>
              <p className="text-[11px] text-yellow-400 font-numbers font-bold">1,000 GEMS = $0.04 USD</p>
            </div>
          </div>
          <button
            onClick={() => setWalletModalOpen(false)}
            className="p-1.5 rounded-full btn-3d-dark text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3D Tab Selector */}
        <div className="grid grid-cols-4 gap-1 bg-[#090C14] p-1.5 mx-3 mt-3 rounded-2xl border border-[#1E2336]">
          <button
            onClick={() => { setActiveTab('convert'); setMessage({ text: '', type: '' }); }}
            className={`py-2 text-[10px] font-black rounded-xl flex items-center justify-center space-x-1 uppercase transition-all ${
              activeTab === 'convert' ? 'btn-3d-gold' : 'btn-3d-dark text-gray-400'
            }`}
          >
            <ArrowRightLeft size={12} />
            <span>Convert</span>
          </button>
          <button
            onClick={() => { setActiveTab('withdraw'); setMessage({ text: '', type: '' }); }}
            className={`py-2 text-[10px] font-black rounded-xl flex items-center justify-center space-x-1 uppercase transition-all ${
              activeTab === 'withdraw' ? 'btn-3d-gold' : 'btn-3d-dark text-gray-400'
            }`}
          >
            <Send size={12} />
            <span>Withdraw</span>
          </button>
          <button
            onClick={() => { setActiveTab('history'); setMessage({ text: '', type: '' }); }}
            className={`py-2 text-[10px] font-black rounded-xl flex items-center justify-center space-x-1 uppercase transition-all ${
              activeTab === 'history' ? 'btn-3d-gold' : 'btn-3d-dark text-gray-400'
            }`}
          >
            <History size={12} />
            <span>History</span>
          </button>
          <button
            onClick={() => { setActiveTab('proofs'); setMessage({ text: '', type: '' }); }}
            className={`py-2 text-[10px] font-black rounded-xl flex items-center justify-center space-x-1 uppercase transition-all ${
              activeTab === 'proofs' ? 'btn-3d-gold' : 'btn-3d-dark text-gray-400'
            }`}
          >
            <ShieldCheck size={12} />
            <span>Proofs</span>
          </button>
        </div>

        {/* Feedback Message */}
        {message.text && (
          <div className={`mx-4 mt-3 p-3 rounded-xl text-xs flex items-center space-x-2 ${
            message.type === 'success' ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300' : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: CONVERT (With 25% Fee Breakdown matching screenshot) */}
          {activeTab === 'convert' && (
            <form onSubmit={handleConvert} className="space-y-4">
              {/* Balance Box */}
              <div className="bg-[#151928] border border-[#22283C] p-3.5 rounded-2xl flex items-center justify-between shadow-inner">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Available GEMS</span>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <Gem size={16} className="text-cyan-400" />
                    <span className="text-lg font-black text-cyan-400 font-mono">
                      {(user.diamonds || 0).toLocaleString()} GEMS
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConvertAmount(String(user.diamonds || 0))}
                  className="btn-3d-cyan text-xs px-3 py-1 rounded-xl uppercase font-black tracking-wider"
                >
                  MAX
                </button>
              </div>

              {/* Conversion Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-black text-gray-300 uppercase">
                    Amount to Convert
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">Min: 1,000 GEMS</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="Min 1000 GEMS"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    className="w-full bg-[#0D101A] border border-[#22283C] rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-yellow-500 outline-none"
                  />
                  <span className="absolute right-3.5 top-3 text-xs text-gray-400 font-bold">💎 GEMS</span>
                </div>
              </div>

              {/* Exact Screenshot 3-Line Fee Breakdown Box */}
              <div className="bg-[#0B0D16] border border-[#1E2336] rounded-2xl p-4 space-y-2.5 shadow-md font-sans">
                {/* 1. Gross value */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#8E95A5] font-medium">Gross value</span>
                  <span className="text-white font-bold font-mono">${grossUsdt.toFixed(4)}</span>
                </div>

                {/* 2. Fee (25%) in Red/Coral */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#8E95A5] font-medium">Fee (25%)</span>
                  <span className="text-[#F87171] font-bold font-mono">-${feeUsdt.toFixed(4)}</span>
                </div>

                <div className="border-t border-[#1C2234] pt-2">
                  {/* 3. You'll receive in Bright Green */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white font-black tracking-tight">You'll receive</span>
                    <span className="text-[#22C55E] font-black font-mono text-base">${netUsdt.toFixed(4)}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !convertAmount || Number(convertAmount) < 1000 || Number(convertAmount) > (user.diamonds || 0)}
                className="w-full btn-3d-gold py-3.5 rounded-xl text-sm flex items-center justify-center space-x-2 uppercase tracking-wider font-black disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                <span>{loading ? 'Converting...' : 'Convert to USDT'}</span>
              </button>
            </form>
          )}

          {/* TAB 2: WITHDRAW (0% Fee, $0.05 Min, Binance / TON Networks & Locked Wallet) */}
          {activeTab === 'withdraw' && (
            <form onSubmit={handleInitiateWithdraw} className="space-y-3.5">
              {/* USDT Balance */}
              <div className="bg-[#151928] border border-[#22283C] p-3.5 rounded-2xl flex items-center justify-between shadow-inner">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Available USDT Balance</span>
                  <div className="flex items-center space-x-1 mt-0.5">
                    <DollarSign size={18} className="text-emerald-400" />
                    <span className="text-lg font-black text-emerald-400 font-mono">
                      ${(user.usdt || 0).toFixed(4)} USDT
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-[#0A121A] border border-cyan-500/40 text-[10px] text-cyan-300 px-2.5 py-0.5 rounded-full font-mono font-black">
                    Min: $0.05
                  </span>
                  <p className="text-[9px] text-emerald-400 font-bold mt-1">0% Withdrawal Fee</p>
                </div>
              </div>

              {/* WITHDRAWAL REQUIREMENTS CHECKLIST CARD */}
              <div className="bg-[#0b0e1a] border border-[#262c45] p-3.5 rounded-2xl space-y-2.5 shadow-md font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Clock size={13} className="text-amber-400" />
                    <span>Daily Withdrawal Requirements</span>
                  </span>
                  <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                    Resets in 24h
                  </span>
                </div>

                <div className="space-y-1.5 pt-0.5">
                  {/* 1. Complete 20 Tasks / Ads */}
                  <div className="bg-[#141829] p-2.5 rounded-xl border border-[#222942] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {requirements.isTasksDone ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="text-amber-400 shrink-0" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">1. Complete 20 Tasks / Ads</p>
                        <p className="text-[10px] text-gray-400 font-medium">Daily quests, ads & partner tasks</p>
                      </div>
                    </div>
                    <span className={`text-xs font-mono font-black ${requirements.isTasksDone ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {requirements.tasksCompleted} / 20
                    </span>
                  </div>

                  {/* 2. Play 5 Games */}
                  <div className="bg-[#141829] p-2.5 rounded-xl border border-[#222942] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {requirements.isGamesDone ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="text-amber-400 shrink-0" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">2. Play 5 Games</p>
                        <p className="text-[10px] text-gray-400 font-medium">Lucky Draw or Tic-Tac-Toe matches</p>
                      </div>
                    </div>
                    <span className={`text-xs font-mono font-black ${requirements.isGamesDone ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {requirements.gamesPlayed} / 5
                    </span>
                  </div>

                  {/* 3. First Withdrawal Free OR 1 Crystal Coin */}
                  <div className="bg-[#141829] p-2.5 rounded-xl border border-[#222942] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {requirements.isCrystalDone ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="text-amber-400 shrink-0" />
                      )}
                      <div>
                        {requirements.isFirstWithdrawal ? (
                          <>
                            <p className="text-xs font-bold text-emerald-300 leading-tight">3. First Withdrawal: 100% FREE</p>
                            <p className="text-[10px] text-gray-400 font-medium">No Crystal Coin needed for your 1st cashout!</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-white leading-tight">3. Must have 1 Crystal Coin</p>
                            <p className="text-[10px] text-gray-400 font-medium">Required per withdrawal (250 GEMS in Store)</p>
                          </>
                        )}
                      </div>
                    </div>
                    {requirements.isFirstWithdrawal ? (
                      <span className="text-[10px] font-mono font-black text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                        FREE
                      </span>
                    ) : (
                      <div className="text-right">
                        <span className={`text-xs font-mono font-black ${requirements.isCrystalDone ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {requirements.crystalCoins} / 1
                        </span>
                        {!requirements.isCrystalDone && (
                          <button
                            type="button"
                            onClick={() => setStoreModalOpen(true)}
                            className="block text-[9px] font-black text-amber-400 hover:underline uppercase mt-0.5"
                          >
                            + Buy Store
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2-Option Network Selector: Binance & TON */}
              <div>
                <label className="block text-xs font-black text-gray-300 uppercase mb-1.5">Choose Withdrawal Network</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawNetwork('BINANCE');
                      setMessage({ text: '', type: '' });
                    }}
                    className={`py-2.5 text-xs font-black rounded-xl uppercase transition-all flex items-center justify-center space-x-2 ${
                      withdrawNetwork === 'BINANCE'
                        ? 'btn-3d-gold'
                        : 'btn-3d-dark text-gray-400'
                    }`}
                  >
                    <span>🟡</span>
                    <span>Binance UID</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawNetwork('TON');
                      setMessage({ text: '', type: '' });
                    }}
                    className={`py-2.5 text-xs font-black rounded-xl uppercase transition-all flex items-center justify-center space-x-2 ${
                      withdrawNetwork === 'TON'
                        ? 'btn-3d-gold'
                        : 'btn-3d-dark text-gray-400'
                    }`}
                  >
                    <span>💎</span>
                    <span>TON Wallet</span>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-black text-gray-300 uppercase mb-1.5">Withdraw Amount (USDT)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Min 0.05"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-[#0D101A] border border-[#22283C] rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-yellow-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(String(user.usdt || 0))}
                    className="absolute right-3 top-2.5 text-[10px] btn-3d-cyan px-2.5 py-1 rounded-lg font-bold"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Wallet Address / UID Input with Locked Protection */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-black text-gray-300 uppercase flex items-center space-x-1.5">
                    <span>{withdrawNetwork === 'BINANCE' ? 'Binance Pay ID / UID' : 'TON Wallet Address'}</span>
                    {isCurrentWalletLocked && (
                      <span className="flex items-center space-x-1 text-[9px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/30">
                        <Lock size={10} />
                        <span>LOCKED</span>
                      </span>
                    )}
                  </label>
                  {!isCurrentWalletLocked && (
                    <span className="text-[10px] text-rose-400 font-bold">Locks Permanently on 1st Use</span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    disabled={isCurrentWalletLocked}
                    placeholder={
                      withdrawNetwork === 'BINANCE'
                        ? '12345678 (Numbers only)'
                        : 'EQ... or UQ... (48 characters)'
                    }
                    value={walletAddress}
                    onChange={(e) => {
                      if (isCurrentWalletLocked) return;
                      const val = e.target.value;
                      if (withdrawNetwork === 'BINANCE') {
                        // Strict Numeric filtering for Binance UID
                        if (/^\d*$/.test(val)) {
                          setWalletAddress(val);
                        }
                      } else {
                        setWalletAddress(val.trim());
                      }
                    }}
                    className={`w-full bg-[#0D101A] border ${
                      isCurrentWalletLocked ? 'border-amber-500/40 text-amber-200' : 'border-[#22283C] text-white'
                    } rounded-xl px-4 py-3 text-xs font-mono focus:border-yellow-500 outline-none ${
                      isCurrentWalletLocked ? 'cursor-not-allowed opacity-90' : ''
                    }`}
                  />
                  {isCurrentWalletLocked && (
                    <Lock size={14} className="absolute right-3.5 top-3.5 text-amber-400" />
                  )}
                </div>

                {/* Helper notice */}
                <p className="text-[10px] text-[#8E95A5] mt-1 leading-relaxed">
                  {withdrawNetwork === 'BINANCE'
                    ? '💡 Enter your 5-15 digit Binance Numeric UID. No letters allowed.'
                    : '💡 TON address must start with EQ or UQ and be exactly 48 chars.'}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !withdrawAmount || Number(withdrawAmount) < 0.05 || !walletAddress || Number(withdrawAmount) > (user.usdt || 0) || !requirements.canWithdraw}
                className="w-full btn-3d-green py-3.5 rounded-xl text-sm flex items-center justify-center space-x-2 uppercase tracking-wider font-black disabled:opacity-50"
              >
                <Send size={16} className={loading ? 'animate-spin' : ''} />
                <span>{loading ? 'Submitting...' : requirements.canWithdraw ? 'Request Withdrawal (0% Fee)' : 'Requirements Incomplete'}</span>
              </button>
            </form>
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-black text-yellow-400 uppercase tracking-wider mb-2">Withdrawals</h4>
                {loadingHistory ? (
                  <div className="p-5 text-center text-xs text-gray-400 bg-[#0E0E16] rounded-xl border border-yellow-500/20 flex flex-col items-center justify-center space-y-2">
                    <RefreshCw size={18} className="animate-spin text-yellow-400" />
                    <span className="font-bold text-yellow-300">Loading Withdrawal History... Please Wait</span>
                    <div className="w-24 h-1 bg-yellow-950/60 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-300 animate-pulse rounded-full w-2/3"></div>
                    </div>
                  </div>
                ) : history.withdrawals.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-3">No withdrawal history yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.withdrawals.map((w) => (
                      <div key={w.id} className="bg-[#151928] border border-[#22283C] p-3 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-white font-mono">${w.amount_usdt} USDT ({w.network})</div>
                          <div className="text-[10px] text-gray-400 truncate max-w-[180px] font-mono">{w.wallet_address}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black font-mono ${
                          w.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          w.status === 'rejected' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {w.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-black text-yellow-400 uppercase tracking-wider mb-2">Conversions</h4>
                {loadingHistory ? (
                  <div className="p-5 text-center text-xs text-gray-400 bg-[#0E0E16] rounded-xl border border-yellow-500/20 flex flex-col items-center justify-center space-y-2">
                    <RefreshCw size={18} className="animate-spin text-yellow-400" />
                    <span className="font-bold text-yellow-300">Loading Conversion History... Please Wait</span>
                    <div className="w-24 h-1 bg-yellow-950/60 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-300 animate-pulse rounded-full w-2/3"></div>
                    </div>
                  </div>
                ) : history.conversions.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-3">No conversion history yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.conversions.map((c) => (
                      <div key={c.id} className="bg-[#151928] border border-[#22283C] p-3 rounded-xl flex justify-between items-center text-xs font-mono">
                        <div>
                          <span className="text-cyan-400 font-bold">-{c.diamonds_amount.toLocaleString()} GEMS</span>
                          {c.created_at && (
                            <span className="text-[10px] text-gray-500 block">
                              {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <span className="text-emerald-400 font-bold">+${c.usdt_amount} USDT</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PROOFS & AD COMPLIANCE TRANSPARENCY */}
          {activeTab === 'proofs' && (
            <div className="space-y-3.5">
              {/* Official Proofs Channel Box */}
              <div className="p-3.5 bg-gradient-to-br from-emerald-950/60 to-[#101920] border border-emerald-500/40 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-xs font-black text-emerald-400 uppercase font-heading">
                  <ShieldCheck size={16} />
                  <span>Verified Public Payout Channel</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-tight">
                  All user withdrawals are published publicly with transaction receipts on our official payment channel.
                </p>
                <a
                  href="https://t.me/treasure_pay"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-3d-cyan w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 mt-1 text-black inline-flex"
                >
                  <span>📢 View Proofs: @treasure_pay</span>
                </a>
              </div>

              {/* Live Confirmed Payout Feed Grouped by Day */}
              <div>
                <h4 className="text-xs font-black text-yellow-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Confirmed Payouts by Date</span>
                  <button
                    type="button"
                    onClick={loadProofs}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center space-x-1 active:scale-95"
                  >
                    <RefreshCw size={11} className={loadingProofs ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </h4>

                {loadingProofs && proofs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400 bg-[#0E0E16] rounded-2xl border border-yellow-500/20 flex flex-col items-center justify-center space-y-2">
                    <RefreshCw size={22} className="animate-spin text-yellow-400" />
                    <span className="font-bold text-yellow-300">Loading Verified Proofs... Please Wait</span>
                    <div className="w-28 h-1 bg-yellow-950/60 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-300 animate-pulse rounded-full w-2/3"></div>
                    </div>
                  </div>
                ) : groupedProofs.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-[#0D101C] border border-[#22283C] text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
                      <Clock size={18} />
                    </div>
                    <h5 className="text-xs font-black text-white uppercase tracking-wider">No Approved Payouts Yet Today</h5>
                    <p className="text-[11px] text-gray-400 leading-tight">
                      Withdrawals are verified and approved manually by admin. Once approved, live payment receipts appear here and post to our official channel @treasure_pay!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupedProofs.map((group, gIdx) => (
                      <div key={gIdx} className="space-y-1.5">
                        <div className="flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-wider text-amber-400 font-mono">
                          <span>📅 {group.label}</span>
                          <span className="text-emerald-400 font-bold">
                            {group.items.length} Payout{group.items.length > 1 ? 's' : ''} (${group.totalUsdt.toFixed(2)} USDT)
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {group.items.map((p) => (
                            <div
                              key={p.id}
                              className="p-2.5 rounded-xl bg-[#0D101C] border border-[#22283C] flex items-center justify-between text-xs hover:border-[#333d5c] transition-all"
                            >
                              <div className="space-y-0.5">
                                <div className="font-bold text-white font-mono flex items-center space-x-1.5">
                                  <span className="text-cyan-300">{p.username}</span>
                                  <span className="text-[10px] text-gray-400">({p.user_id})</span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono flex items-center space-x-1.5">
                                  <span>{p.currency}</span>
                                  <span>•</span>
                                  <span className="text-amber-300 font-bold">{p.address}</span>
                                  {p.time_str && (
                                    <>
                                      <span>•</span>
                                      <span className="text-gray-500">{p.time_str}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <div className="font-black text-emerald-400 font-numbers">${p.amount} USDT</div>
                                <div className="text-[9px] text-emerald-500 font-bold tracking-wide">COMPLETED ✅</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Monetization Compliance Note */}
              <div className="p-3 bg-[#0A0D18] border border-[#22283C] rounded-xl text-[10px] text-gray-400 leading-relaxed font-sans">
                <span className="text-yellow-400 font-bold block mb-0.5">Ad Network Compliance &amp; Payout Terms:</span>
                Treasure Hunt rewards users transparently for engagement with sponsor campaigns. Conversions strictly adhere to $0.00004 per Gem, providing legitimate micro-monetization without spam or artificial inflation.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMATION POPUP MODAL (Irreversible Wallet Lock Notice) */}
      {showLockConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#141828] border border-amber-500/50 rounded-[26px] p-6 max-w-sm w-full text-center space-y-4 shadow-2xl animate-scaleUp relative">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-white uppercase tracking-wide">
                Confirm Wallet Lock
              </h3>
              <p className="text-xs text-[#9E9EB2] leading-relaxed">
                Once set, this {withdrawNetwork === 'BINANCE' ? 'Binance UID' : 'TON Address'} will be <strong className="text-amber-400">permanently locked</strong> to your account and cannot be modified by you.
              </p>
            </div>

            <div className="bg-[#0A0D18] border border-[#22283C] p-3 rounded-xl text-xs font-mono text-cyan-300 break-all">
              <div className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">{withdrawNetwork} Destination:</div>
              {walletAddress}
            </div>

            <div className="flex space-x-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowLockConfirmModal(false)}
                className="flex-1 btn-3d-dark py-3 rounded-xl text-xs uppercase font-bold text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeWithdrawal}
                className="flex-1 btn-3d-gold py-3 rounded-xl text-xs uppercase font-black"
              >
                Accept & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded StoreModal */}
      <StoreModal
        isOpen={storeModalOpen}
        onClose={() => {
          setStoreModalOpen(false);
          loadRequirements();
        }}
      />
    </div>
  );
}
