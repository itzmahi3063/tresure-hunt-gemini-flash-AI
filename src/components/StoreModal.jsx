import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Coins,
  ChevronRight,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  RefreshCw,
  Wallet,
  Clock,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import confetti from 'canvas-confetti';
import api from '../services/api';

export default function StoreModal({ isOpen, onClose }) {
  const { user, setUser } = useApp();
  const [selectedQty, setSelectedQty] = useState(1);
  const [view, setView] = useState('select'); // 'select' | 'payment'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15-min countdown
  const pollIntervalRef = useRef(null);

  // Packs configuration (0.015 TON per coin; 10 coins has 10% OFF = 0.135 TON)
  const packs = [
    { qty: 1, costTon: 0.015, bonus: '', originalCost: null },
    { qty: 3, costTon: 0.045, bonus: '', originalCost: null },
    { qty: 5, costTon: 0.075, bonus: 'Popular', originalCost: null },
    { qty: 10, costTon: 0.135, bonus: '10% OFF', originalCost: 0.15 }
  ];

  const currentPack = packs.find(p => p.qty === selectedQty) || packs[0];
  const tonCost = currentPack.costTon;
  const memoText = user ? `CRYSTAL_${user.id}_${selectedQty}` : '';
  const nanoTonAmount = Math.round(tonCost * 1e9);
  const hasEnoughTonBalance = (user?.ton_balance || 0) >= tonCost;

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setView('select');
      setTimeLeft(15 * 60);
      setMessage(null);
      // Fetch admin TON wallet address
      api.get('/ton/config')
        .then(res => {
          if (res.data?.walletAddress) {
            setWalletAddress(res.data.walletAddress);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // 15-Minute Countdown Timer for Payment view
  useEffect(() => {
    if (!isOpen || view !== 'payment') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, view]);

  // Auto-polling for blockchain payment detection
  useEffect(() => {
    if (!isOpen || view !== 'payment' || !user) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await api.get('/ton/check-payment', {
          params: { memo: memoText }
        });
        if (res.data?.paid && res.data.transaction?.tx_hash) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.6 }
          });
          triggerHaptic('notification', 'success');
          if (res.data.user) {
            setUser(res.data.user);
          } else {
            setUser(prev => ({
              ...prev,
              crystal_coins: (prev.crystal_coins || 0) + selectedQty
            }));
          }
          setMessage({
            type: 'success',
            text: `🎉 Payment confirmed! You received +${selectedQty} Crystal Coin${selectedQty > 1 ? 's' : ''}.`
          });
          setView('select');
        }
      } catch (e) {
        // Polling silently
      }
    };

    const initialTimer = setTimeout(checkStatus, 2500);
    pollIntervalRef.current = setInterval(checkStatus, 3500);

    return () => {
      clearTimeout(initialTimer);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, view, user, memoText, selectedQty, setUser]);

  if (!isOpen || !user) return null;

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopy = (text, type) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(String(text));
    }
    triggerHaptic('selection');
    if (type === 'address') {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } else if (type === 'amount') {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    } else {
      setCopiedMemo(true);
      setTimeout(() => setCopiedMemo(false), 2000);
    }
  };

  // Instant pay with in-app TON balance
  const handlePayFromBalance = async () => {
    if (!hasEnoughTonBalance) return;
    setLoading(true);
    setMessage(null);
    triggerHaptic('impact', 'medium');

    try {
      const res = await api.post('/store/buy-crystal-ton', { quantity: selectedQty });
      if (res.data.success) {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 }
        });
        setUser(res.data.user);
        triggerHaptic('notification', 'success');
        setMessage({
          type: 'success',
          text: `🎉 Successfully purchased ${selectedQty} Crystal Coin${selectedQty > 1 ? 's' : ''} for ${tonCost} TON!`
        });
        setView('select');
      }
    } catch (err) {
      triggerHaptic('notification', 'error');
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Purchase failed. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Manual check button
  const handleManualCheck = async () => {
    setIsVerifying(true);
    setMessage(null);
    triggerHaptic('impact', 'medium');

    try {
      const res = await api.get('/ton/check-payment', {
        params: { memo: memoText }
      });
      if (res.data?.paid && res.data.transaction?.tx_hash) {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 }
        });
        triggerHaptic('notification', 'success');
        if (res.data.user) {
          setUser(res.data.user);
        } else {
          setUser(prev => ({
            ...prev,
            crystal_coins: (prev.crystal_coins || 0) + selectedQty
          }));
        }
        setMessage({
          type: 'success',
          text: `🎉 Payment confirmed on TON Blockchain! Received +${selectedQty} Crystal Coin${selectedQty > 1 ? 's' : ''}.`
        });
        setView('select');
      } else {
        setMessage({
          type: 'error',
          text: 'Payment not found on the blockchain yet. Please wait 1-2 minutes or complete the transfer with the exact MEMO.'
        });
        triggerHaptic('notification', 'warning');
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Verification check failed'
      });
      triggerHaptic('notification', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const tonDeepLink = walletAddress
    ? `ton://transfer/${walletAddress}?amount=${nanoTonAmount}&text=${encodeURIComponent(memoText)}`
    : '';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div
        style={{
          background: 'linear-gradient(180deg, #241a12 0%, #150f0a 100%)',
          borderTop: '2.5px solid #a8793b',
          borderLeft: '1.5px solid #573a1e',
          borderRight: '1.5px solid #573a1e',
          borderBottom: '5px solid #0d0804',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95), 0 0 35px rgba(255, 184, 0, 0.18)'
        }}
        className="w-full max-w-md rounded-[32px] p-4 sm:p-5 pb-8 relative my-auto max-h-[88vh] overflow-y-auto custom-scrollbar"
      >
        {/* Top Header Row with Crystal Coin Balance prominently displayed */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#3d2714]">
          {/* Back button if in payment view, or Store Icon */}
          <div className="flex items-center space-x-2.5">
            {view === 'payment' ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setView('select');
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#a89782] hover:text-white bg-[#140c06] border border-[#4a341f] active:scale-90 transition-all"
              >
                <ArrowLeft size={17} />
              </button>
            ) : (
              <div
                style={{
                  background: 'linear-gradient(180deg, #ffd76b 0%, #f59e0b 50%, #b45309 100%)',
                  borderTop: '1.5px solid #fff2b8',
                  borderBottom: '3px solid #78350f',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#1a0f02] shrink-0"
              >
                <ShoppingBag size={19} />
              </div>
            )}
            <div>
              <h3 className="text-base font-black text-white tracking-wide leading-tight">
                {view === 'payment' ? 'Deposit TON' : 'Crystal Store'}
              </h3>
              <p className="text-[10px] text-[#a89782] font-semibold">
                {view === 'payment' ? 'Complete TON payment' : 'Buy Crystal Coins'}
              </p>
            </div>
          </div>

          {/* Top Corner: Prominent Crystal Coin Balance & Close button */}
          <div className="flex items-center space-x-2">
            {/* Crystal Coin Balance Header Pill */}
            <div
              style={{
                background: 'linear-gradient(180deg, #2b1c10 0%, #170e06 100%)',
                border: '1.5px solid #f59e0b'
              }}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.25)]"
            >
              <span className="text-sm">🔮</span>
              <span className="text-xs font-black text-[#f7bf46] font-mono leading-none">
                {user.crystal_coins || 0}
              </span>
              <span className="text-[9px] font-black text-amber-200/90 uppercase tracking-tight">
                Coins
              </span>
            </div>

            {/* Close Modal Button */}
            <button
              onClick={() => {
                triggerHaptic('selection');
                onClose();
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89782] hover:text-white bg-[#140c06] border border-[#4a341f] active:scale-90 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-2xl text-xs flex items-center space-x-2 ${
              message.type === 'success'
                ? 'bg-[#18291b] border border-[#2b5432] text-emerald-300'
                : 'bg-[#2b1616] border border-[#542828] text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : (
              <AlertCircle size={16} className="shrink-0" />
            )}
            <span className="font-semibold">{message.text}</span>
          </div>
        )}

        {/* VIEW 1: Pack Selection Screen */}
        {view === 'select' && (
          <>
            {/* Hero Crystal Coin Visual Box */}
            <div
              style={{
                background: 'linear-gradient(180deg, #301f11 0%, #1f140a 100%)',
                borderTop: '2px solid #734d28',
                borderLeft: '1.5px solid #4a3219',
                borderRight: '1.5px solid #4a3219',
                borderBottom: '4px solid #0d0804',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.7)'
              }}
              className="rounded-[24px] p-3.5 mb-4 text-center space-y-1.5 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/5 to-transparent pointer-events-none" />
              
              <div className="text-4xl animate-bounce" style={{ animationDuration: '3s' }}>
                🔮
              </div>

              <div>
                <h4 className="text-sm font-black text-white tracking-wide uppercase">Crystal Coin Pass</h4>
                <p className="text-xs text-[#f7bf46] font-mono font-bold">1 Crystal Coin = 0.015 TON</p>
              </div>

              <p className="text-[11px] text-[#a89782] leading-relaxed font-medium px-2">
                Required for USDT withdrawals after your 1st free withdrawal. (1 Coin per withdrawal)
              </p>
            </div>

            {/* Quantity Select Packs */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase text-[#a89782] tracking-wider block">
                  Select Crystal Pack
                </label>
                <span className="text-[10px] text-amber-400 font-mono font-bold">
                  0.015 TON / coin
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {packs.map((p) => {
                  const isSelected = selectedQty === p.qty;
                  return (
                    <button
                      type="button"
                      key={p.qty}
                      onClick={() => {
                        setSelectedQty(p.qty);
                        triggerHaptic('selection');
                      }}
                      style={
                        isSelected
                          ? {
                              background: 'linear-gradient(180deg, #57371a 0%, #3a2512 100%)',
                              borderTop: '1.5px solid #ffdc7a',
                              borderBottom: '3px solid #1c1007',
                              color: '#f7bf46',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
                            }
                          : {
                              backgroundColor: '#160e07',
                              border: '1px solid #382413',
                              color: '#a89782'
                            }
                      }
                      className="p-3 rounded-2xl text-left relative transition-all active:scale-95"
                    >
                      {p.bonus && (
                        <span className="absolute top-2 right-2 text-[9px] font-black bg-gradient-to-r from-amber-500 to-yellow-400 text-[#1a0f02] px-1.5 py-0.5 rounded-full uppercase font-mono shadow-sm">
                          {p.bonus}
                        </span>
                      )}
                      <div className="text-sm font-black text-white flex items-center space-x-1">
                        <span>🔮</span>
                        <span>{p.qty} Crystal{p.qty > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 mt-1.5">
                        <span className="text-xs font-mono font-black text-[#f7bf46]">
                          {p.costTon} TON
                        </span>
                        {p.originalCost && (
                          <span className="text-[10px] font-mono text-gray-400 line-through">
                            {p.originalCost} TON
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cost & Summary Card */}
            <div
              style={{
                background: 'linear-gradient(180deg, #20140a 0%, #160d05 100%)',
                borderTop: '1.5px solid #57381c',
                borderBottom: '3.5px solid #0c0703',
                boxShadow: '0 8px 20px rgba(0,0,0,0.6)'
              }}
              className="rounded-[22px] p-3.5 space-y-2 border-x border-[#382413] mb-4"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#a89782] font-medium">Quantity to Receive</span>
                <span className="text-white font-black font-mono">+{selectedQty} Crystal Coin{selectedQty > 1 ? 's' : ''}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-[#a89782] font-medium">Price in TON</span>
                <div className="flex items-center space-x-1 font-mono font-black text-[#f7bf46]">
                  <span>{tonCost} TON</span>
                  {selectedQty === 10 && (
                    <span className="text-[10px] text-emerald-400 ml-1 font-bold">(10% OFF Applied)</span>
                  )}
                </div>
              </div>

              <div className="h-[1px] bg-[#382413]" />

              <div className="flex justify-between items-center text-xs pt-0.5">
                <span className="text-[#a89782] font-medium">In-App TON Balance</span>
                <span className="font-mono font-bold text-gray-300 text-[11px]">
                  {user.ton_balance || 0} TON
                </span>
              </div>
            </div>

            {/* Instant Pay with TON Balance (if user has enough TON) */}
            {hasEnoughTonBalance && (
              <button
                type="button"
                onClick={handlePayFromBalance}
                disabled={loading}
                style={{
                  background: 'linear-gradient(180deg, #059669 0%, #047857 100%)',
                  borderTop: '1.5px solid #6ee7b7',
                  borderBottom: '3px solid #064e3b',
                  boxShadow: '0 6px 16px rgba(5, 150, 105, 0.35)'
                }}
                className="w-full py-3 mb-2 rounded-[20px] text-xs font-black tracking-wide uppercase flex items-center justify-center space-x-1.5 text-white active:scale-98 transition-all disabled:opacity-50"
              >
                <Zap size={14} className="text-yellow-300 fill-yellow-300" />
                <span>{loading ? 'Processing...' : `⚡ Instant Pay with TON Balance (${tonCost} TON)`}</span>
              </button>
            )}

            {/* Main Proceed to TON Deposit Payment Button */}
            <button
              onClick={() => {
                triggerHaptic('selection');
                setTimeLeft(15 * 60);
                setMessage(null);
                setView('payment');
              }}
              style={{
                background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 45%, #e8a522 100%)',
                borderTop: '1.5px solid #fff2b8',
                borderLeft: '1px solid #e8a522',
                borderRight: '1px solid #e8a522',
                borderBottom: '4px solid #7d4800',
                color: '#1a0f02',
                boxShadow: '0 8px 18px rgba(232, 165, 34, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
              }}
              className="w-full py-3.5 rounded-[22px] text-xs font-black tracking-wide uppercase flex items-center justify-center space-x-2 active:translate-y-1 active:border-b-[1px] transition-all"
            >
              <Coins size={16} />
              <span>Deposit & Pay {tonCost} TON</span>
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* VIEW 2: TON Payment Instructions Screen (Same as Task Payment) */}
        {view === 'payment' && (
          <div className="space-y-3.5">
            {/* Countdown Banner */}
            <div className="bg-[#191008] border border-amber-500/30 rounded-2xl p-2.5 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-300 text-xs font-bold">
                <Clock size={15} className="animate-spin text-amber-400" style={{ animationDuration: '6s' }} />
                <span>Payment Session</span>
              </div>
              <span className="text-xs font-mono font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                {formatTimer(timeLeft)}
              </span>
            </div>

            {/* Package Summary */}
            <div className="bg-[#140c06] border border-[#3d2714] rounded-2xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#a89782] font-semibold uppercase">Package</p>
                <p className="text-xs font-black text-white flex items-center space-x-1">
                  <span>🔮</span>
                  <span>{selectedQty} Crystal Coin{selectedQty > 1 ? 's' : ''}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#a89782] font-semibold uppercase">Total Due</p>
                <p className="text-sm font-mono font-black text-[#f7bf46]">{tonCost} TON</p>
              </div>
            </div>

            {/* Payment Fields: Address, Amount, Memo */}
            <div className="space-y-2.5">
              {/* 1. Admin Wallet Address */}
              <div className="bg-[#140c06] border border-[#3d2714] rounded-2xl p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase text-[#a89782]">Send to TON Address</span>
                  <span className="text-[9px] text-amber-400 font-bold">Official Treasury</span>
                </div>
                <div className="flex items-center justify-between bg-[#0a0603] p-2 rounded-xl border border-[#2a1a0d]">
                  <span className="text-xs font-mono text-gray-200 truncate mr-2">
                    {walletAddress || 'UQBVb37B4NffJ_Vn-Uv6w4RkMv3n4K8m...'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(walletAddress, 'address')}
                    className="shrink-0 p-1.5 bg-[#20140a] hover:bg-[#301f11] text-[#f7bf46] rounded-lg border border-[#4a3219] transition-all"
                  >
                    {copiedAddress ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* 2. Amount */}
              <div className="bg-[#140c06] border border-[#3d2714] rounded-2xl p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase text-[#a89782]">Exact Amount</span>
                </div>
                <div className="flex items-center justify-between bg-[#0a0603] p-2 rounded-xl border border-[#2a1a0d]">
                  <span className="text-xs font-mono font-black text-[#f7bf46]">
                    {tonCost} TON
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(tonCost, 'amount')}
                    className="shrink-0 p-1.5 bg-[#20140a] hover:bg-[#301f11] text-[#f7bf46] rounded-lg border border-[#4a3219] transition-all"
                  >
                    {copiedAmount ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* 3. Mandatory MEMO */}
              <div className="bg-[#140c06] border border-amber-500/40 rounded-2xl p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase text-amber-300 flex items-center space-x-1">
                    <span>⚠️</span>
                    <span>Required Comment / MEMO</span>
                  </span>
                  <span className="text-[9px] text-rose-400 font-bold uppercase animate-pulse">Required</span>
                </div>
                <div className="flex items-center justify-between bg-[#0a0603] p-2 rounded-xl border border-amber-500/30">
                  <span className="text-xs font-mono font-black text-amber-300">
                    {memoText}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(memoText, 'memo')}
                    className="shrink-0 p-1.5 bg-[#20140a] hover:bg-[#301f11] text-[#f7bf46] rounded-lg border border-[#4a3219] transition-all"
                  >
                    {copiedMemo ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-amber-200/80 mt-1.5 leading-snug">
                  You <strong>MUST</strong> paste this MEMO into the transfer comment so the blockchain can auto-credit your Crystal Coins!
                </p>
              </div>
            </div>

            {/* Deep-link Button to Open TON Wallet */}
            {tonDeepLink && (
              <a
                href={tonDeepLink}
                target="_blank"
                rel="noreferrer"
                onClick={() => triggerHaptic('selection')}
                style={{
                  background: 'linear-gradient(180deg, #0098ea 0%, #0077b5 100%)',
                  borderTop: '1.5px solid #66c7ff',
                  borderBottom: '3px solid #004d73',
                  boxShadow: '0 6px 16px rgba(0, 152, 234, 0.35)'
                }}
                className="w-full py-3 rounded-[20px] text-xs font-black tracking-wide uppercase flex items-center justify-center space-x-2 text-white active:scale-98 transition-all"
              >
                <Wallet size={15} />
                <span>Open TON Wallet to Pay</span>
                <ExternalLink size={14} />
              </a>
            )}

            {/* Check Payment Manual Button */}
            <button
              type="button"
              onClick={handleManualCheck}
              disabled={isVerifying}
              style={{
                background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 45%, #e8a522 100%)',
                borderTop: '1.5px solid #fff2b8',
                borderBottom: '3.5px solid #7d4800',
                color: '#1a0f02',
                boxShadow: '0 6px 16px rgba(232, 165, 34, 0.35)'
              }}
              className="w-full py-3 rounded-[20px] text-xs font-black tracking-wide uppercase flex items-center justify-center space-x-2 active:scale-98 transition-all disabled:opacity-60"
            >
              <RefreshCw size={15} className={isVerifying ? 'animate-spin' : ''} />
              <span>{isVerifying ? 'Verifying on TON...' : 'Check Payment Now'}</span>
            </button>

            {/* Security Guarantee */}
            <div className="flex items-center justify-center space-x-1.5 text-[10px] text-[#8a7660]">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Instant auto-approval via TonAPI on transaction confirmation</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
