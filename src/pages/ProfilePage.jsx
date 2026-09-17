import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Zap, Banknote, Gift, Gamepad2, Copy, Check, ShieldCheck, ExternalLink } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { formatGems, formatUsdt } from '../utils/format';

export default function ProfilePage() {
  const { user, openWallet, isAdmin, setActiveTab } = useApp();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Treasure Hunter';
  const username = user.username ? `@${user.username}` : `@user_${user.id}`;
  const avatarUrl = user.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`;
  const usdtEquivalent = formatUsdt((user.diamonds || 0) * 0.00004);

  const handleCopyId = () => {
    navigator.clipboard.writeText(String(user.id));
    setCopied(true);
    triggerHaptic('notification', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen pb-32 pt-2 px-4 max-w-md mx-auto space-y-3.5 animate-fadeIn">
      {/* 1. TOP BALANCE / XP CARD */}
      <div className="relative overflow-hidden bg-[#151928] border border-[#22283C] rounded-[24px] p-5 shadow-xl flex items-center justify-between">
        {/* Subtle purple background glow */}
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-purple-600/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E95A5]">
            YOUR GEMS
          </span>
          <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-none mt-1">
            {formatGems(user.diamonds)}
          </div>
          <div className="text-xs font-semibold text-[#00DF82] mt-2 flex items-center space-x-1">
            <span>≈${usdtEquivalent} USDT</span>
          </div>
        </div>

        {/* Faceted Purple Diamond SVG Icon */}
        <div className="relative z-10 shrink-0 w-16 h-16 flex items-center justify-center">
          <svg
            viewBox="0 0 100 90"
            className="w-14 h-14 drop-shadow-[0_8px_16px_rgba(168,85,247,0.45)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 10 L80 10 L98 38 L50 85 L2 38 Z"
              fill="url(#diamond_purple_grad)"
            />
            <path
              d="M20 10 L38 38 L50 85 L62 38 L80 10"
              stroke="#E9D5FF"
              strokeWidth="2.5"
              strokeLinejoin="round"
              fill="none"
              opacity="0.85"
            />
            <path
              d="M2 38 L98 38"
              stroke="#E9D5FF"
              strokeWidth="2.5"
              opacity="0.85"
            />
            <path
              d="M38 38 L50 10 L62 38"
              stroke="#E9D5FF"
              strokeWidth="2"
              fill="#C084FC"
              fillOpacity="0.4"
            />
            <defs>
              <linearGradient id="diamond_purple_grad" x1="50" y1="10" x2="50" y2="85" gradientUnits="userSpaceOnUse">
                <stop stopColor="#C084FC" />
                <stop offset="0.45" stopColor="#9333EA" />
                <stop offset="1" stopColor="#6B21A8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* 2. USER PROFILE CARD */}
      <div className="bg-[#151928] border border-[#22283C] rounded-[24px] p-4 flex items-center space-x-4 shadow-xl">
        <img
          src={avatarUrl}
          alt="Avatar"
          className="w-16 h-16 rounded-2xl object-cover ring-1 ring-white/10 shadow-md shrink-0"
          onError={(e) => {
            e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`;
          }}
        />

        <div className="flex-1 min-w-0">
          {/* Name + Telegram Badge */}
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-white truncate max-w-[140px]">{displayName}</h3>
            <span className="bg-[#20263C] text-[#8E95A5] text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0">
              Telegram
            </span>
          </div>

          {/* Username */}
          <p className="text-xs text-[#8E95A5] font-medium mt-0.5 truncate">{username}</p>

          {/* ID Pill with Copy */}
          <div
            onClick={handleCopyId}
            className="mt-2 inline-flex items-center space-x-1.5 bg-[#0D101C] border border-[#1E2336] px-2.5 py-1 rounded-lg cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-[11px] font-mono font-semibold text-white/90">
              ID: {user.id}
            </span>
            {copied ? (
              <Check size={12} className="text-emerald-400" />
            ) : (
              <Copy size={12} className="text-[#8E95A5]" />
            )}
            {copied && <span className="text-[9px] text-emerald-400 font-bold ml-1">Copied</span>}
          </div>
        </div>
      </div>

      {/* 3. THREE ACTION BUTTONS ROW */}
      <div className="grid grid-cols-3 gap-3">
        {/* Button 1: Earn XP */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            setActiveTab('tasks');
          }}
          className="bg-gradient-to-b from-[#7C3AED] to-[#6D28D9] border border-[#8B5CF6]/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-[0_6px_20px_rgba(124,58,237,0.35)] active:scale-95 transition-all"
        >
          <div className="w-8 h-8 flex items-center justify-center mb-1.5">
            <Zap size={22} className="text-white fill-white" />
          </div>
          <span className="text-white font-bold text-xs leading-tight">
            Earn<br />GEMS
          </span>
        </button>

        {/* Button 2: Withdraw */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            openWallet('withdraw');
          }}
          className="bg-gradient-to-b from-[#059669] to-[#047857] border border-[#10B981]/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-[0_6px_20px_rgba(5,150,105,0.35)] active:scale-95 transition-all"
        >
          <div className="w-8 h-8 flex items-center justify-center mb-1.5">
            <Banknote size={22} className="text-white" />
          </div>
          <span className="text-white font-bold text-xs leading-tight">
            Withdraw
          </span>
        </button>

        {/* Button 3: Refer & Earn */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            setActiveTab('refer');
          }}
          className="bg-gradient-to-b from-[#4F46E5] to-[#4338CA] border border-[#6366F1]/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-[0_6px_20px_rgba(79,70,229,0.35)] active:scale-95 transition-all"
        >
          <div className="w-8 h-8 flex items-center justify-center mb-1.5">
            <Gift size={22} className="text-white" />
          </div>
          <span className="text-white font-bold text-xs leading-tight">
            Refer &amp;<br />Earn
          </span>
        </button>
      </div>

      {/* 4. PLAY GAMES BANNER */}
      <div
        onClick={() => {
          triggerHaptic('selection');
          setActiveTab('play');
        }}
        className="bg-gradient-to-r from-[#FF8C1A] via-[#F97316] to-[#EA580C] border border-[#FB923C]/40 rounded-[22px] p-4 flex items-center space-x-3.5 shadow-[0_8px_24px_rgba(249,115,22,0.35)] cursor-pointer active:scale-[0.98] transition-all"
      >
        {/* White Translucent Icon Box */}
        <div className="w-13 h-13 p-3 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
          <Gamepad2 size={26} className="text-white fill-white/80" />
        </div>

        <div className="flex-1">
          <h4 className="text-white font-black text-base tracking-wide">Play Games</h4>
          <p className="text-white/85 text-xs font-medium mt-0.5">Earn GEMS</p>
        </div>
      </div>

      {/* Admin shortcut if user is Admin */}
      {isAdmin && (
        <button
          onClick={() => {
            triggerHaptic('selection');
            setActiveTab('admin');
          }}
          className="w-full bg-[#151928] border border-amber-500/30 hover:border-amber-500/60 p-3.5 rounded-2xl flex items-center justify-between text-xs text-amber-400 font-bold transition-colors"
        >
          <div className="flex items-center space-x-2">
            <ShieldCheck size={16} />
            <span>Admin Control Panel</span>
          </div>
          <ExternalLink size={14} className="text-amber-400/80" />
        </button>
      )}
    </div>
  );
}

