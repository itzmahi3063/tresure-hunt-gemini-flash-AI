import React from 'react';
import { useApp } from '../context/AppContext';
import { Gem, DollarSign, Key, Users, Wallet, ChevronDown, PlusCircle } from 'lucide-react';
import { formatGems, formatUsdt } from '../utils/format';
import { triggerHaptic } from '../services/telegram';

export default function Header() {
  const { user, openWallet, t, currentLangObj, setLanguageModalOpen } = useApp();

  if (!user) return null;

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') 
    || (user?.username ? `@${user.username}` : 'Treasure Hunter');
  const userUID = user?.id ? `ID: ${user.id}` : '';
  const avatarUrl = user?.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.id || 'hunter'}`;

  return (
    <div className="w-full pt-2.5 px-4 pb-2">
      {/* Top Bar with Language Selector (Matched to Screenshot) */}
      <div className="flex items-center justify-between pb-2 px-0.5">
        <div className="flex items-center space-x-1.5 text-xs font-black text-amber-400 font-heading">
          <span className="text-sm">⚔️</span>
          <span className="tracking-wider uppercase">TREASURE HUNT</span>
        </div>

        {/* Language Selector Dropdown Button */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            setLanguageModalOpen(true);
          }}
          style={{
            background: 'linear-gradient(180deg, #241d13 0%, #15100a 100%)',
            borderTop: '1.5px solid #6b4d24',
            borderLeft: '1px solid #4a3418',
            borderRight: '1px solid #4a3418',
            borderBottom: '2.5px solid #0a0704',
            boxShadow: '0 2px 8px rgba(0,0,0,0.6)'
          }}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-yellow-300 hover:text-white transition-all active:scale-95 group font-sans"
        >
          <span className="text-sm leading-none">{currentLangObj?.flag || '🇬🇧'}</span>
          <span className="text-[11px] font-bold tracking-wide">{currentLangObj?.name || 'English'}</span>
          <ChevronDown size={13} className="text-yellow-400 group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>

      {/* Top 3D User Profile Bar */}
      <div className="flex items-center justify-between box-3d p-3.5">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-12 h-12 rounded-full border-2 border-yellow-400 object-cover shadow-gold-glow"
              onError={(e) => {
                e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`;
              }}
            />
            <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-400 to-amber-600 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black text-black border-2 border-[#12121A] shadow-md font-numbers">
              ★
            </div>
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-wide truncate max-w-[140px] drop-shadow-sm font-heading">
              {displayName}
            </h2>
            <div className="flex items-center space-x-1.5 text-xs text-yellow-400 font-numbers font-bold">
              <span>{userUID}</span>
            </div>
          </div>
        </div>

        {/* Wallet Button */}
        <button
          onClick={() => openWallet('convert')}
          className="btn-3d-gold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 font-heading"
        >
          <Wallet size={14} />
          <span>{t('nav_wallet').toUpperCase()}</span>
        </button>
      </div>

      {/* 4 3D Stat Badges Bar */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {/* Diamonds / Gems */}
        <div className="badge-3d p-2.5 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="flex items-center text-cyan-400 mb-1">
            <Gem size={15} className="mr-1 drop-shadow" />
            <span className="text-[10px] uppercase font-black tracking-wider text-cyan-300 font-sans">
              {t('stat_gems')}
            </span>
          </div>
          <span className="text-sm font-black text-cyan-400 font-numbers">
            {formatGems(user.diamonds)}
          </span>
        </div>

        {/* USDT (up to 3 decimal places) */}
        <div className="badge-3d p-2.5 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="flex items-center text-emerald-400 mb-1">
            <DollarSign size={15} className="mr-0.5 drop-shadow" />
            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-300 font-sans">
              {t('stat_usdt')}
            </span>
          </div>
          <span className="text-xs font-black text-emerald-400 font-numbers">
            ${formatUsdt(user.usdt)}
          </span>
        </div>

        {/* Keys */}
        <div className="badge-3d p-2.5 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="flex items-center text-amber-400 mb-1">
            <Key size={14} className="mr-1 drop-shadow" />
            <span className="text-[10px] uppercase font-black tracking-wider text-amber-300 font-sans">
              {t('stat_keys')}
            </span>
          </div>
          <span className="text-sm font-black text-yellow-400 font-numbers">
            {user.keys}
          </span>
        </div>

        {/* Refers */}
        <div className="badge-3d p-2.5 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="flex items-center text-purple-400 mb-1">
            <Users size={14} className="mr-1 drop-shadow" />
            <span className="text-[10px] uppercase font-black tracking-wider text-purple-300 font-sans">
              {t('stat_refers')}
            </span>
          </div>
          <span className="text-sm font-black text-purple-300 font-numbers">
            {user.total_referrals || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
