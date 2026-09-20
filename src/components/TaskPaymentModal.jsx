import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  Wallet,
  PlusCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import confetti from 'canvas-confetti';
import api from '../services/api';
import { useApp } from '../context/AppContext';

export default function TaskPaymentModal({ task, isOpen, onClose, onPaymentSuccess, onTaskCancelled }) {
  const { user, setUser, openWallet } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes countdown (900 seconds)
  const pollIntervalRef = useRef(null);

  const tonCost = task?.ton_cost || Number((((task?.max_users || 100) / 100) * 0.20).toFixed(2));
  const memoText = task ? `EXCL_${task.id}` : '';
  const nanoTonAmount = Math.round(tonCost * 1e9);

  // Reset timer whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setTimeLeft(15 * 60);
      setError(null);
    }
  }, [isOpen, task?.id]);

  // 15-minute Countdown Timer Interval & Auto-Close on Expiry
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  // Handle 15-minute expiration: automatically close modal and notify user
  useEffect(() => {
    if (isOpen && timeLeft === 0) {
      triggerHaptic('notification', 'warning');
      alert('⏳ Payment session (15 minutes) expired! Please click "Pay now" again to start a new session.');
      onClose();
    }
  }, [timeLeft, isOpen, onClose]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fetch TON configuration on mount / open
  useEffect(() => {
    if (isOpen && task) {
      api.get('/ton/config')
        .then(res => {
          if (res.data?.walletAddress) {
            setWalletAddress(res.data.walletAddress);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, task]);

  // Real-time payment detection polling every 3 seconds
  useEffect(() => {
    if (!isOpen || !task) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await api.get('/ton/check-payment', {
          params: { taskId: task.id, memo: memoText }
        });
        // STRICT: Only auto-approve if genuine blockchain transaction hash or verified record exists
        if (res.data?.paid && res.data.task?.tx_hash) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.6 }
          });
          triggerHaptic('notification', 'success');
          if (onPaymentSuccess) {
            onPaymentSuccess(res.data.task);
          }
          onClose();
        }
      } catch (err) {
        // Continue polling silently
      }
    };

    // Delay initial check by 2 seconds to avoid race condition on immediate mount
    const initialTimer = setTimeout(checkStatus, 2000);
    // 3-second polling
    pollIntervalRef.current = setInterval(checkStatus, 3000);

    return () => {
      clearTimeout(initialTimer);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, task, memoText, onPaymentSuccess, onClose]);

  if (!isOpen || !task) return null;

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

  const handleManualCheck = async () => {
    setIsVerifying(true);
    setError(null);
    triggerHaptic('impact', 'medium');

    try {
      const res = await api.get('/ton/check-payment', {
        params: { taskId: task.id, memo: memoText }
      });
      if (res.data?.paid && res.data.task?.tx_hash) {
        confetti({
          particleCount: 70,
          spread: 75,
          origin: { y: 0.6 }
        });
        triggerHaptic('notification', 'success');
        if (onPaymentSuccess) {
          onPaymentSuccess(res.data.task);
        }
        onClose();
      } else {
        setError('Payment not confirmed on the blockchain yet. If you have already sent TON, please wait 2–3 minutes or complete the transfer.');
        triggerHaptic('notification', 'warning');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Verification check failed');
      triggerHaptic('notification', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePayNow = async () => {
    setLoading(true);
    setError(null);
    triggerHaptic('impact', 'medium');

    try {
      const res = await api.post('/tasks/exclusive/pay', { taskId: task.id });
      if (res.data.success) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
        triggerHaptic('notification', 'success');
        if (onPaymentSuccess) {
          onPaymentSuccess(res.data.task);
        }
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Payment failed');
      triggerHaptic('notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTask = async () => {
    if (!window.confirm('Are you sure you want to cancel and delete this unpaid post draft?')) {
      return;
    }

    setLoading(true);
    setError(null);
    triggerHaptic('impact', 'light');

    try {
      const res = await api.post('/tasks/exclusive/cancel', { taskId: task.id });
      if (res.data.success) {
        triggerHaptic('notification', 'success');
        if (onTaskCancelled) {
          onTaskCancelled(task.id);
        }
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel task');
      triggerHaptic('notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const tonDeepLink = walletAddress
    ? `ton://transfer/${walletAddress}?amount=${nanoTonAmount}&text=${encodeURIComponent(memoText)}`
    : '';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div
        style={{
          background: 'linear-gradient(180deg, #2b1c10 0%, #1a1008 100%)',
          borderTop: '2px solid #825429',
          borderLeft: '1.5px solid #4a341f',
          borderRight: '1.5px solid #4a341f',
          borderBottom: '5px solid #0f0904',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 245, 255, 0.15)'
        }}
        className="w-full max-w-md rounded-[32px] p-4 sm:p-5 pb-6 relative my-auto max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        {/* Close Button */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            onClose();
          }}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#a89782] hover:text-white bg-[#140c06] border border-[#4a341f] active:scale-90 transition-all z-10"
        >
          <X size={18} />
        </button>

        {/* Top Header */}
        <div className="flex items-center space-x-3 mb-3">
          <div
            style={{
              background: 'linear-gradient(180deg, #00e5ff 0%, #0099ff 100%)',
              borderTop: '1.5px solid #80f0ff',
              borderBottom: '3px solid #005599',
              boxShadow: '0 4px 12px rgba(0, 229, 255, 0.3)'
            }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#081b26] shrink-0"
          >
            <CreditCard size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-wide">Campaign Payment</h3>
            <p className="text-xs text-[#a89782] font-medium">Complete payment to activate campaign post</p>
          </div>
        </div>

        {/* PROMINENT PAYMENT NOTICE BANNER */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.22) 0%, rgba(180, 83, 9, 0.3) 100%)',
            border: '2px solid #f59e0b',
            boxShadow: '0 8px 25px rgba(245, 158, 11, 0.28)'
          }}
          className="p-3.5 rounded-[22px] mb-3 text-center space-y-1.5"
        >
          <div className="flex items-center justify-center space-x-1.5 text-amber-300">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">IMPORTANT PAYMENT NOTICE</span>
          </div>
          <p className="text-sm font-black text-amber-100 leading-snug px-1 drop-shadow-sm">
            "If you have already made the payment, please wait 2–3 minutes for automatic verification. If you have not paid yet, please complete the payment below."
          </p>
          <p className="text-[11px] text-amber-200/90 font-bold pt-0.5">
            When sending TON, you MUST include the <span className="underline text-amber-300">Comment / Memo</span> shown below.
          </p>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-2xl bg-[#2e1313] border border-[#632929] text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Campaign Details Summary */}
        <div
          style={{
            background: 'linear-gradient(180deg, #20140a 0%, #160d05 100%)',
            borderTop: '1.5px solid #57381c',
            borderBottom: '3.5px solid #0c0703',
            boxShadow: '0 8px 20px rgba(0,0,0,0.6)'
          }}
          className="rounded-[24px] p-3.5 space-y-2.5 border-x border-[#382413] mb-3"
        >
          <div>
            <p className="text-[10px] text-[#a89782] uppercase font-black tracking-wider">Campaign Title</p>
            <h4 className="text-sm font-black text-white mt-0.5">{task.title}</h4>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#382413]">
            <div>
              <p className="text-[10px] text-[#a89782] uppercase font-black tracking-wider">Target Reach</p>
              <p className="text-xs font-black text-[#f7bf46] font-mono mt-0.5">{task.max_users} Users</p>
            </div>
            <div>
              <p className="text-[10px] text-[#a89782] uppercase font-black tracking-wider">Status</p>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-600/40">
                Pending Payment
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#382413] flex justify-between items-center">
            <div>
              <p className="text-[10px] text-[#a89782] uppercase font-black">Total Payable</p>
              <p className="text-[10px] text-emerald-400 font-medium">100 Users = 0.20 TON</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-[#00f5ff] font-mono drop-shadow-[0_0_10px_rgba(0,245,255,0.4)]">
                {tonCost.toFixed(2)} TON
              </span>
            </div>
          </div>
        </div>

        {/* TON Blockchain Payment Details Box */}
        {walletAddress && (
          <div className="p-3.5 rounded-[22px] bg-[#0c141c] border border-[#1b3247] space-y-2.5 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-[#00f5ff] flex items-center space-x-1.5">
                <Wallet size={14} />
                <span>TON Payment Details</span>
              </span>
              <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Auto-Scanning</span>
              </span>
            </div>

            {/* Exact Deposit Amount */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400">Payable TON Amount:</span>
              <div className="flex items-center justify-between bg-[#060a0f] p-2 rounded-xl border border-[#192b3a]">
                <span className="text-xs font-mono font-black text-[#00f5ff]">
                  {tonCost.toFixed(2)} TON
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(tonCost.toFixed(2), 'amount')}
                  className="px-2.5 py-1 rounded-lg bg-[#142331] text-[10px] font-bold text-cyan-300 hover:bg-[#1f374e] active:scale-95 flex items-center space-x-1 shrink-0"
                >
                  {copiedAmount ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedAmount ? 'Copied' : 'Copy Amount'}</span>
                </button>
              </div>
            </div>

            {/* Recipient Wallet Address */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400">Recipient TON Address:</span>
              <div className="flex items-center justify-between bg-[#060a0f] p-2 rounded-xl border border-[#192b3a]">
                <span className="text-[11px] font-mono text-cyan-200 truncate mr-2">
                  {walletAddress}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(walletAddress, 'address')}
                  className="px-2.5 py-1 rounded-lg bg-[#142331] text-[10px] font-bold text-cyan-300 hover:bg-[#1f374e] active:scale-95 flex items-center space-x-1 shrink-0"
                >
                  {copiedAddress ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedAddress ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Transfer Memo / Comment (CRITICAL) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black text-amber-400 flex items-center space-x-1">
                  <span>⚠️ Required Transfer Comment / Memo:</span>
                </span>
                <span className="text-[9px] text-rose-400 font-bold uppercase">Mandatory</span>
              </div>
              <div className="flex items-center justify-between bg-[#1f1505] p-2 rounded-xl border border-[#593907]">
                <span className="text-xs font-mono font-black text-amber-300 select-all">
                  {memoText}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(memoText, 'memo')}
                  className="px-2.5 py-1 rounded-lg bg-[#3d2703] text-[10px] font-black text-amber-300 hover:bg-[#523506] active:scale-95 flex items-center space-x-1 shrink-0"
                >
                  {copiedMemo ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedMemo ? 'Copied' : 'Copy Memo'}</span>
                </button>
              </div>
              <p className="text-[10px] text-amber-200/80 leading-tight pt-0.5">
                Paste <code className="text-amber-300 font-mono font-bold">{memoText}</code> into the comment/memo box in Tonkeeper / Telegram Wallet when sending.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Option 1: If user has enough TON in deposited balance */}
          {(user?.ton_balance || 0) >= tonCost && (
            <button
              type="button"
              onClick={handlePayNow}
              disabled={loading}
              style={{
                background: 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #0077b6 100%)',
                borderTop: '1.5px solid #a6f4ff',
                borderLeft: '1px solid #00b4d8',
                borderRight: '1px solid #00b4d8',
                borderBottom: '4px solid #004777',
                color: '#031726',
                boxShadow: '0 8px 18px rgba(0, 180, 216, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.7)'
              }}
              className="w-full py-3 rounded-[20px] text-xs font-black tracking-wide uppercase flex items-center justify-center space-x-2 active:translate-y-1 active:border-b-[1px] transition-all"
            >
              <span>{loading ? 'Processing...' : `Pay from Balance (${(user?.ton_balance || 0).toFixed(2)} TON Available)`}</span>
              <ArrowRight size={15} />
            </button>
          )}

          {/* PRIMARY PAY NOW BUTTON (Prefills Amount & Memo into Wallet) */}
          {walletAddress && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('impact', 'heavy');
                const transferUrl = `ton://transfer/${walletAddress}?amount=${nanoTonAmount}&text=${encodeURIComponent(memoText)}`;
                const tonkeeperUrl = `https://app.tonkeeper.com/transfer/${walletAddress}?amount=${nanoTonAmount}&text=${encodeURIComponent(memoText)}`;

                if (window.Telegram?.WebApp?.openLink) {
                  window.Telegram.WebApp.openLink(tonkeeperUrl);
                } else {
                  window.location.href = transferUrl;
                  setTimeout(() => {
                    window.open(tonkeeperUrl, '_blank');
                  }, 600);
                }
              }}
              style={{
                background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 45%, #d48b11 100%)',
                borderTop: '1.5px solid #fff2b8',
                borderLeft: '1px solid #f7bf46',
                borderRight: '1px solid #f7bf46',
                borderBottom: '4px solid #7a4b00',
                color: '#1a0f02',
                boxShadow: '0 8px 22px rgba(247, 191, 70, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
              }}
              className="w-full py-4 rounded-[22px] text-base font-black tracking-wider uppercase flex items-center justify-center space-x-2 active:translate-y-1 active:border-b-[1px] transition-all shadow-lg"
            >
              <Wallet size={18} />
              <span>PAY NOW ({tonCost.toFixed(2)} TON)</span>
              <ArrowRight size={18} />
            </button>
          )}

          {/* Check Payment Now button */}
          <button
            type="button"
            onClick={handleManualCheck}
            disabled={isVerifying}
            style={{
              background: '#14202d',
              borderTop: '1px solid #233e59',
              borderBottom: '2.5px solid #080f16',
              color: '#38bdf8'
            }}
            className="w-full py-2.5 rounded-[18px] text-xs font-black uppercase flex items-center justify-center space-x-2 active:scale-98 transition-all hover:text-sky-300"
          >
            <RefreshCw size={14} className={isVerifying ? 'animate-spin' : ''} />
            <span>{isVerifying ? 'Checking Blockchain...' : 'I Have Transferred · Verify Now'}</span>
          </button>

          {/* Reject / Cancel Button */}
          <button
            type="button"
            onClick={handleCancelTask}
            disabled={loading}
            style={{
              background: '#1d120a',
              borderTop: '1px solid #3d2414',
              borderBottom: '2.5px solid #0d0703',
              color: '#f87171'
            }}
            className="w-full py-2 rounded-[16px] text-[11px] font-black uppercase flex items-center justify-center space-x-1.5 active:scale-98 transition-all hover:text-rose-300"
          >
            <Trash2 size={12} />
            <span>Reject / Cancel Post Draft</span>
          </button>
        </div>

        {/* 15-MINUTE COUNTDOWN TIMER AT THE BOTTOM (REQUIRED BY USER) */}
        <div
          style={{
            background: 'linear-gradient(180deg, #111a24 0%, #0a1017 100%)',
            border: '1.5px solid #1c364d',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)'
          }}
          className="mt-3.5 p-3 rounded-[20px] flex items-center justify-between"
        >
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                timeLeft > 60 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500 animate-ping'
              }`}
            />
            <div>
              <div className="flex items-center space-x-1 text-gray-300">
                <Clock size={12} className="text-cyan-400" />
                <span className="text-[10px] uppercase font-bold text-gray-400">Payment Session Timer</span>
              </div>
              <p className="text-[11px] font-bold text-gray-200">
                {timeLeft > 0 ? 'Time remaining to complete payment' : 'Payment session expired!'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div
              className={`font-mono text-lg font-black tracking-wider ${
                timeLeft > 120 ? 'text-[#00f5ff]' : 'text-rose-400 animate-pulse'
              }`}
            >
              ⏱️ {formatTimer(timeLeft)}
            </div>
            <span className="text-[9px] text-cyan-300/70 font-mono">15 Minutes Window</span>
          </div>
        </div>
      </div>
    </div>
  );
}
