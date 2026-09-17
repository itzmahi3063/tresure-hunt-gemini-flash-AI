import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Sparkles,
  Gem,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Coins,
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import api from '../services/api';

export default function StoreModal({ isOpen, onClose }) {
  const { user, setUser } = useApp();
  const [selectedQty, setSelectedQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  if (!isOpen || !user) return null;

  const packs = [
    { qty: 1, cost: 250, popular: false, bonus: '' },
    { qty: 2, cost: 500, popular: false, bonus: '' },
    { qty: 5, cost: 1250, popular: true, bonus: 'Best Value' },
    { qty: 10, cost: 2500, popular: false, bonus: 'Mega Stash' }
  ];

  const totalCost = selectedQty * 250;
  const canAfford = (user.diamonds || 0) >= totalCost;

  const handleBuy = async () => {
    if (!canAfford) {
      triggerHaptic('notification', 'error');
      setMessage({ type: 'error', text: 'Insufficient GEMS balance! Complete tasks or open chests to earn more.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    triggerHaptic('impact', 'medium');

    try {
      const res = await api.post('/store/buy-crystal', { quantity: selectedQty });
      if (res.data.success) {
        setUser(res.data.user);
        triggerHaptic('notification', 'success');
        setMessage({
          type: 'success',
          text: `🎉 Successfully purchased ${selectedQty} Crystal Coin${selectedQty > 1 ? 's' : ''} for ${totalCost.toLocaleString()} GEMS!`
        });
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
        {/* Close Button */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            onClose();
          }}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#a89782] hover:text-white bg-[#140c06] border border-[#4a341f] active:scale-90 transition-all"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div
            style={{
              background: 'linear-gradient(180deg, #ffd76b 0%, #f59e0b 50%, #b45309 100%)',
              borderTop: '1.5px solid #fff2b8',
              borderBottom: '3px solid #78350f',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
            }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#1a0f02] shrink-0"
          >
            <ShoppingBag size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-wide flex items-center space-x-2">
              <span>Crystal Coin Store</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 uppercase font-mono font-black">
                Vault
              </span>
            </h3>
            <p className="text-xs text-[#a89782] font-medium">Buy Crystal Coins using GEMS</p>
          </div>
        </div>

        {/* User Balance Header Pill */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-[#140c06] border border-[#3d2714] p-2.5 rounded-2xl flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Gem size={16} />
            </div>
            <div>
              <span className="text-[10px] text-[#8a7660] font-black uppercase">Your GEMS</span>
              <p className="text-xs font-black text-white font-mono">{(user.diamonds || 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-[#140c06] border border-[#3d2714] p-2.5 rounded-2xl flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 text-base">
              🔮
            </div>
            <div>
              <span className="text-[10px] text-[#8a7660] font-black uppercase">Crystal Coins</span>
              <p className="text-xs font-black text-[#f7bf46] font-mono">{user.crystal_coins || 0} COINS</p>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-2xl text-xs flex items-center space-x-2 ${
              message.type === 'success'
                ? 'bg-[#18291b] border border-[#2b5432] text-emerald-300'
                : 'bg-[#2b1616] border border-[#542828] text-rose-300'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
            <span className="font-semibold">{message.text}</span>
          </div>
        )}

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
          className="rounded-[26px] p-4 mb-4 text-center space-y-2 relative overflow-hidden"
        >
          {/* Ambient light beam */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/5 to-transparent pointer-events-none" />
          
          <div className="text-4xl animate-bounce" style={{ animationDuration: '3s' }}>
            🔮
          </div>

          <div>
            <h4 className="text-base font-black text-white tracking-wide">Crystal Coin Token</h4>
            <p className="text-xs text-[#f7bf46] font-mono font-bold">1 Crystal Coin = 250 GEMS</p>
          </div>

          <p className="text-[11px] text-[#a89782] leading-relaxed font-medium px-2">
            Crystal Coins are required for USDT withdrawals after your first free withdrawal.
          </p>
        </div>

        {/* Quantity Select Packs */}
        <div className="space-y-2 mb-4">
          <label className="text-[11px] font-black uppercase text-[#a89782] tracking-wider block">
            Select Crystal Pack
          </label>
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
                    <span className="absolute top-2 right-2 text-[9px] font-black bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30 uppercase font-mono">
                      {p.bonus}
                    </span>
                  )}
                  <div className="text-sm font-black text-white flex items-center space-x-1">
                    <span>🔮</span>
                    <span>{p.qty} Crystal{p.qty > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center space-x-1 mt-1">
                    <Gem size={12} className="text-cyan-400" />
                    <span className="text-xs font-mono font-black text-[#f7bf46]">{p.cost.toLocaleString()} GEMS</span>
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
          className="rounded-[24px] p-4 space-y-2 border-x border-[#382413] mb-4"
        >
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#a89782] font-medium">Quantity to Receive</span>
            <span className="text-white font-black font-mono">+{selectedQty} Crystal Coin{selectedQty > 1 ? 's' : ''}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-[#a89782] font-medium">Total Cost</span>
            <div className="flex items-center space-x-1 font-mono font-black text-[#f7bf46]">
              <Gem size={13} className="text-cyan-400" />
              <span>{totalCost.toLocaleString()} GEMS</span>
            </div>
          </div>

          <div className="h-[1px] bg-[#382413]" />

          <div className="flex justify-between items-center text-xs pt-0.5">
            <span className="text-[#a89782] font-medium">Status</span>
            <span className={`font-black uppercase text-[11px] ${canAfford ? 'text-emerald-400' : 'text-rose-400'}`}>
              {canAfford ? '✓ Ready to Buy' : '✕ Insufficient GEMS'}
            </span>
          </div>
        </div>

        {/* Buy Button */}
        <button
          onClick={handleBuy}
          disabled={loading || !canAfford}
          style={{
            background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 45%, #e8a522 100%)',
            borderTop: '1.5px solid #fff2b8',
            borderLeft: '1px solid #e8a522',
            borderRight: '1px solid #e8a522',
            borderBottom: '4px solid #7d4800',
            color: '#1a0f02',
            boxShadow: '0 8px 18px rgba(232, 165, 34, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
          }}
          className="w-full py-3.5 rounded-[22px] text-sm font-black tracking-wide uppercase flex items-center justify-center space-x-2 active:translate-y-1 active:border-b-[1px] transition-all disabled:opacity-50"
        >
          <Coins size={17} />
          <span>{loading ? 'Purchasing...' : `Buy ${selectedQty} Crystal Coin${selectedQty > 1 ? 's' : ''} (${totalCost.toLocaleString()} GEMS)`}</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
