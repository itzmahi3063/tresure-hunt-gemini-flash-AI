import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Gift, CheckCircle2, AlertCircle, Sparkles, Gem, DollarSign, Key } from 'lucide-react';
import api from '../services/api';
import { triggerHaptic } from '../services/telegram';
import confetti from 'canvas-confetti';
import { showPromoCodeAdFlow } from '../services/ads';

export default function PromoModal({ isOpen, onClose, initialCode = '' }) {
  const { setUser } = useApp();
  const [promoCode, setPromoCode] = useState(initialCode || '');
  const [loading, setLoading] = useState(false);
  const [adProgress, setAdProgress] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [rewardClaimed, setRewardClaimed] = useState(null);

  React.useEffect(() => {
    if (initialCode) {
      setPromoCode(initialCode);
    }
  }, [initialCode]);

  if (!isOpen) return null;

  const handleRedeem = async (e) => {
    e.preventDefault();
    const cleanCode = promoCode.trim();
    if (!cleanCode) {
      setMessage({ text: 'Please enter a promo code', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });
    setRewardClaimed(null);
    setAdProgress('Loading ad...');

    try {
      // 1. MUST play cascading ad FIRST before server validation / response
      const { watchStartedAt } = await showPromoCodeAdFlow({
        onProgress: (status) => setAdProgress(status)
      });

      setAdProgress('Verifying code...');

      // 2. Submit to server AFTER ad finishes
      const res = await api.post('/promo/redeem', {
        code: cleanCode,
        watchStartedAt
      });

      if (res.data.success) {
        setUser(res.data.user);
        setRewardClaimed({
          type: res.data.rewardType,
          amount: res.data.rewardAmount,
          code: res.data.code
        });
        setMessage({
          text: `🎉 Code redeemed! You got +${res.data.rewardAmount} ${res.data.rewardType.toUpperCase()}!`,
          type: 'success'
        });
        setPromoCode('');
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Invalid or expired promo code';
      setMessage({
        text: errorMsg,
        type: 'error'
      });
      triggerHaptic('notification', 'error');
    } finally {
      setLoading(false);
      setAdProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="box-3d max-w-sm w-full p-6 text-center relative border-t-2 border-yellow-400 my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full btn-3d-dark text-gray-400 hover:text-white"
        >
          <X size={18} />
        </button>

        {/* Top 3D Gift Icon */}
        <div className="w-16 h-16 mx-auto btn-3d-gold rounded-2xl flex items-center justify-center text-black mb-3 shadow-gold-glow">
          <Gift size={32} />
        </div>

        <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1">
          Redeem Promo Code
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Enter secret code from official Telegram channel to get free Diamonds & USDT!
        </p>

        {/* Feedback Alert */}
        {message.text && (
          <div className={`mb-4 p-3 rounded-xl text-xs flex items-center space-x-2 ${
            message.type === 'success' ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300' : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span className="font-bold">{message.text}</span>
          </div>
        )}

        <form onSubmit={handleRedeem} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="ENTER PROMO CODE..."
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className="w-full bg-[#0D0D14] border-2 border-[#2B2B3D] rounded-xl px-4 py-3.5 text-center text-sm text-yellow-400 font-mono font-black tracking-widest focus:border-yellow-400 outline-none uppercase"
            />
          </div>

          {adProgress && (
            <div className="bg-[#0e1220] border border-yellow-500/30 rounded-xl py-1.5 px-2 text-[11px] text-yellow-300 font-mono animate-pulse">
              {adProgress}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !promoCode.trim()}
            className="w-full btn-3d-gold py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2 font-black"
          >
            <Sparkles size={16} />
            <span>{loading ? (adProgress || 'Verifying...') : 'Claim Reward Now'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
