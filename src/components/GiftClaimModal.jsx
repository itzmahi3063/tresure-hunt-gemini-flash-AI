import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Gift, PartyPopper, Loader2 } from 'lucide-react';
import api from '../services/api';
import { triggerHaptic } from '../services/telegram';
import { formatGems, formatUsdt } from '../utils/format';
import confetti from 'canvas-confetti';

// Shows a "🎁 You received a gift from admin" popup whenever the logged-in
// user has a pending (unclaimed) gift. The balance is only credited once
// they tap "Claim Gift" — see server/db.js claimGift().
export default function GiftClaimModal() {
  const { user, setUser } = useApp();
  const [claiming, setClaiming] = useState(false);

  const pendingGift = useMemo(() => {
    if (!user?.gifts?.length) return null;
    // Show the oldest unclaimed gift first, one at a time
    const unclaimed = user.gifts.filter(g => !g.claimed);
    return unclaimed.length ? unclaimed[unclaimed.length - 1] : null;
  }, [user?.gifts]);

  if (!pendingGift) return null;

  const rewardLabel =
    pendingGift.type === 'diamonds' ? `${formatGems(pendingGift.amount)} GEMS` :
    pendingGift.type === 'usdt' ? `${formatUsdt(pendingGift.amount)} USDT` :
    `${pendingGift.amount} KEYS`;

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await api.post('/gift/claim', { giftId: pendingGift.id });
      if (res.data.success) {
        setUser(res.data.user);
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 } });
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      triggerHaptic('notification', 'error');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="box-3d max-w-sm w-full p-6 text-center relative border-t-2 border-yellow-400 my-auto">
        {/* Top 3D Gift Box Icon */}
        <div className="w-20 h-20 mx-auto btn-3d-gold rounded-2xl flex items-center justify-center text-black mb-3 shadow-gold-glow animate-bounce">
          <Gift size={40} />
        </div>

        <h3 className="text-xl font-black text-white uppercase tracking-wider mb-1 flex items-center justify-center gap-2">
          <PartyPopper size={20} className="text-yellow-400" />
          Congratulations!
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          You have received a gift from admin
        </p>

        <div className="mb-3 p-3 rounded-xl bg-[#0D0D14] border-2 border-[#2B2B3D] text-left">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Reason</p>
          <p className="text-sm text-white font-bold">{pendingGift.note}</p>
        </div>

        <div className="mb-5 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-2xl font-black text-yellow-400 tracking-wide">+{rewardLabel}</p>
        </div>

        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full btn-3d-gold py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2 font-black disabled:opacity-70"
        >
          {claiming ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
          <span>{claiming ? 'Claiming...' : 'Claim Gift'}</span>
        </button>
      </div>
    </div>
  );
}
