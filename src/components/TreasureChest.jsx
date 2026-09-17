import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Key, Sparkles, Gem, DollarSign, Trophy } from 'lucide-react';

export default function TreasureChest() {
  const { user, openChest, chestModalData, setChestModalData } = useApp();
  const [isOpening, setIsOpening] = useState(false);

  const handleOpenChest = async () => {
    if (isOpening) return;
    setIsOpening(true);
    await openChest();
    setIsOpening(false);
  };

  const keysLeft = user?.keys || 0;

  return (
    <div className="flex flex-col items-center justify-center my-4 relative">
      {/* Golden Aura / Glow */}
      <div className="absolute w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />

      {/* 3D / SVG Treasure Chest */}
      <div
        onClick={handleOpenChest}
        className={`cursor-pointer transform transition-all duration-300 active:scale-95 ${
          isOpening ? 'scale-110 rotate-2 animate-bounce' : 'hover:scale-105'
        }`}
      >
        <div className="relative w-44 h-40 flex items-center justify-center">
          {/* Animated Treasure Chest Graphic */}
          <div className="w-full h-full relative flex flex-col items-center justify-center">
            {/* Lid */}
            <div className="w-36 h-14 bg-gradient-to-b from-[#FFE57F] via-[#F5A623] to-[#B37400] rounded-t-2xl border-2 border-yellow-300 shadow-gold-glow relative flex items-center justify-center">
              <div className="w-8 h-4 bg-gradient-to-b from-yellow-100 to-yellow-600 rounded-sm border border-yellow-200" />
              <div className="absolute -top-1 left-4 w-3 h-3 bg-yellow-200 rounded-full blur-[1px]" />
            </div>

            {/* Chest Body */}
            <div className="w-40 h-22 bg-gradient-to-b from-[#804D00] via-[#5C3500] to-[#3B1F00] rounded-b-2xl border-2 border-yellow-500/80 shadow-2xl relative flex flex-col items-center justify-center">
              {/* Golden Stripes */}
              <div className="absolute top-0 bottom-0 left-6 w-3 bg-gradient-to-b from-yellow-400 to-amber-600 border-x border-yellow-300/40" />
              <div className="absolute top-0 bottom-0 right-6 w-3 bg-gradient-to-b from-yellow-400 to-amber-600 border-x border-yellow-300/40" />

              {/* Glowing Keyhole */}
              <div className="w-7 h-8 bg-gradient-to-b from-yellow-200 to-yellow-600 rounded-lg border-2 border-yellow-100 flex flex-col items-center justify-center shadow-lg z-10">
                <div className="w-2.5 h-2.5 bg-black rounded-full" />
                <div className="w-1 h-2.5 bg-black rounded-b-sm" />
              </div>

              {/* Radiating Sparkles */}
              <Sparkles className="absolute top-2 right-8 text-yellow-300 animate-spin" size={16} />
              <Sparkles className="absolute bottom-3 left-8 text-amber-300" size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Keys Counter Pill */}
      <div className="mt-2 flex items-center space-x-1.5 bg-[#1C1C26]/90 border border-yellow-500/40 px-3.5 py-1 rounded-full text-xs font-semibold text-yellow-400 font-mono shadow-sm">
        <Key size={13} className="text-yellow-400" />
        <span>{keysLeft} Keys</span>
      </div>

      {/* Tap to Open Chest Button */}
      <button
        onClick={handleOpenChest}
        disabled={isOpening || keysLeft <= 0}
        className={`mt-3 w-64 py-3 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-gold-glow transition-all active:scale-95 ${
          keysLeft > 0
            ? 'bg-gradient-to-r from-[#FFE066] via-[#F5A623] to-[#E69500] text-black hover:brightness-110'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
        }`}
      >
        <Trophy size={18} className={keysLeft > 0 ? 'text-black' : 'text-gray-500'} />
        <span>{isOpening ? 'Opening Chest...' : 'Tap to Open Chest'}</span>
      </button>

      {/* Win Modal Popup */}
      {chestModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gradient-to-b from-[#1E1E2C] to-[#121218] border-2 border-yellow-500/60 rounded-3xl p-6 max-w-xs w-full text-center shadow-box-glow relative">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center shadow-gold-glow mb-4">
              {chestModalData.rewardType === 'usdt' ? (
                <DollarSign size={32} className="text-black font-extrabold" />
              ) : (
                <Gem size={32} className="text-black font-extrabold" />
              )}
            </div>

            <h3 className="text-xl font-black text-yellow-400 uppercase tracking-wide">
              {chestModalData.rewardType === 'jackpot' ? '🎉 JACKPOT WON! 🎉' : 'Chest Unlocked!'}
            </h3>

            <p className="text-xs text-gray-400 mt-1">You discovered treasure inside the chest!</p>

            <div className="my-5 bg-[#0C0C12] border border-yellow-500/30 rounded-2xl p-4">
              <span className="text-3xl font-black text-cyan-400 font-mono">
                {chestModalData.rewardType === 'usdt'
                  ? `+$${chestModalData.rewardAmount} USDT`
                  : `+${chestModalData.rewardAmount.toLocaleString()} 💎`}
              </span>
            </div>

            <p className="text-[11px] text-gray-400 mb-5 font-mono">
              Keys Remaining: <span className="text-yellow-400 font-bold">{chestModalData.remainingKeys}</span>
            </p>

            <button
              onClick={() => setChestModalData(null)}
              className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold py-3 rounded-xl shadow-gold-glow active:scale-95 transition-all text-sm"
            >
              Claim & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
