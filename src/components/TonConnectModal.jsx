import React, { useState } from 'react';
import { X, Wallet, HelpCircle, Check, Copy, ExternalLink, ArrowRight, ShieldCheck } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { useApp } from '../context/AppContext';

export default function TonConnectModal({ isOpen, onClose }) {
  const { connectedTonWallet, connectTonWallet, disconnectTonWallet, user } = useApp();
  const [manualAddress, setManualAddress] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleConnectTelegramWallet = () => {
    triggerHaptic('impact', 'medium');
    // Deep-link to Telegram Wallet
    const tgWalletUrl = 'https://t.me/wallet?startattach=tonconnect';
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(tgWalletUrl);
    } else {
      window.open(tgWalletUrl, '_blank');
    }

    // Auto-associate a simulated/default address if user doesn't already have one
    const addressToSet = user?.ton_wallet || `UQ${user?.id || '7780'}...${Math.random().toString(36).substring(2, 6)}`;
    connectTonWallet(addressToSet);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleConnectApp = (appName, deepLink) => {
    triggerHaptic('selection');
    if (deepLink) {
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(deepLink);
      } else {
        window.open(deepLink, '_blank');
      }
    }
    const addressToSet = user?.ton_wallet || `UQ_${appName.toLowerCase()}_${(user?.id || 'hunter').toString().slice(0, 4)}...ton`;
    connectTonWallet(addressToSet);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleManualSave = (e) => {
    e.preventDefault();
    const clean = manualAddress.trim();
    if (!clean || clean.length < 10) {
      setError('Please enter a valid TON wallet address (e.g. UQC...)');
      return;
    }
    connectTonWallet(clean);
    triggerHaptic('notification', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Modal Card - Styled exactly to match Screenshot 2 */}
      <div
        style={{
          background: '#15171e',
          borderTop: '1px solid #282b36'
        }}
        className="w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-5 pb-8 relative text-white border-x sm:border-b border-[#282b36] shadow-2xl animate-slideUp"
      >
        {/* Top Header bar with icons */}
        <div className="flex items-center justify-between mb-4">
          <div className="w-9 h-9 rounded-2xl bg-[#20232b] flex items-center justify-center text-cyan-400">
            {/* TON Gem Logo */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L3 8V16L12 22L21 16V8L12 2Z"
                fill="#0098ea"
                stroke="#00c6ff"
                strokeWidth="1.5"
              />
              <path d="M12 2V22M3 8L21 8M3 16L21 16" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
            </svg>
          </div>

          <button
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-[#20232b] hover:bg-[#2c313d] flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Title & Subtitle */}
        <div className="text-center mb-6 px-4">
          <h2 className="text-xl font-bold tracking-tight text-white mb-1.5">
            Connect your TON wallet
          </h2>
          <p className="text-xs text-gray-400 font-medium">
            Use Wallet in Telegram or choose other application
          </p>
        </div>

        {connectedTonWallet && (
          <div className="mb-4 p-3 rounded-2xl bg-[#1c212c] border border-[#2a3447] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400">Connected Wallet</p>
                <p className="text-xs font-mono font-bold text-cyan-300 truncate max-w-[200px]">
                  {connectedTonWallet}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                disconnectTonWallet();
                triggerHaptic('notification', 'warning');
              }}
              className="text-[10px] font-bold text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Big Telegram Wallet Button (Screenshot 2 Match) */}
        <button
          onClick={handleConnectTelegramWallet}
          style={{
            background: 'linear-gradient(180deg, #0098ea 0%, #0087d1 100%)',
            boxShadow: '0 4px 15px rgba(0, 152, 234, 0.35)'
          }}
          className="w-full py-3.5 px-4 rounded-2xl text-sm font-bold text-white flex items-center justify-between active:scale-98 transition-all mb-6"
        >
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <Wallet size={16} className="text-white" />
            </div>
            <span className="text-base font-bold">Connect Wallet in Telegram</span>
          </div>

          {/* Telegram circular icon */}
          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-[#0098ea]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z" />
            </svg>
          </div>
        </button>

        {/* Other Applications Title */}
        <div className="text-center mb-4">
          <span className="text-xs text-gray-400 font-semibold tracking-wide">
            Choose other application
          </span>
        </div>

        {/* 4 App Icons Grid (Screenshot 2 Match) */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {/* 1. Tonkeeper */}
          <button
            onClick={() => handleConnectApp('Tonkeeper', 'https://app.tonkeeper.com/ton-connect')}
            className="flex flex-col items-center space-y-2 group active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#182a4d] to-[#0d172e] border border-[#2b4478] flex items-center justify-center p-2.5 shadow-md group-hover:border-[#0098ea]">
              {/* Tonkeeper Shield Logo */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 6V12C4 17.52 7.42 22.5 12 24C16.58 22.5 20 17.52 20 12V6L12 2Z" fill="#0098ea" />
                <path d="M12 6L7 11H17L12 6Z" fill="#ffffff" />
                <path d="M7 13L12 18L17 13H7Z" fill="#ffffff" opacity="0.8" />
              </svg>
            </div>
            <span className="text-xs font-bold text-gray-300 group-hover:text-white">Keeper</span>
          </button>

          {/* 2. Gram Wallet */}
          <button
            onClick={() => handleConnectApp('Gram Wallet', 'https://t.me/gram_wallet_bot')}
            className="flex flex-col items-center space-y-2 group active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#1c3855] to-[#0e2133] border border-[#27537d] flex items-center justify-center p-2.5 shadow-md group-hover:border-[#38bdf8]">
              {/* Gram Diamond Logo */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 9L12 22L21 9L12 2Z" fill="#38bdf8" />
                <path d="M12 2L7 9L12 22L17 9L12 2Z" fill="#7dd3fc" />
              </svg>
            </div>
            <span className="text-xs font-bold text-gray-300 group-hover:text-white">Gram Wallet</span>
          </button>

          {/* 3. My Wallet (MyTonWallet) */}
          <button
            onClick={() => handleConnectApp('MyTonWallet', 'https://mytonwallet.io')}
            className="flex flex-col items-center space-y-2 group active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#193252] to-[#0d1e33] border border-[#2b4d75] flex items-center justify-center p-2.5 shadow-md group-hover:border-[#0284c7]">
              {/* MyTonWallet Wave Logo */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#0098ea" />
                <path d="M6 16V8L10 13L14 8V16L18 8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xs font-bold text-gray-300 group-hover:text-white">My Wallet</span>
          </button>

          {/* 4. View all wallets */}
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="flex flex-col items-center space-y-2 group active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#1e222d] border border-[#2d3345] flex items-center justify-center p-2 shadow-md group-hover:border-gray-400">
              <div className="grid grid-cols-2 gap-1">
                <div className="w-3.5 h-3.5 rounded-md bg-purple-500/80" />
                <div className="w-3.5 h-3.5 rounded-md bg-cyan-400/80" />
                <div className="w-3.5 h-3.5 rounded-md bg-amber-400/80" />
                <div className="w-3.5 h-3.5 rounded-md bg-emerald-400/80" />
              </div>
            </div>
            <span className="text-[11px] font-bold text-gray-300 group-hover:text-white text-center leading-tight">
              View all wallets
            </span>
          </button>
        </div>

        {/* Manual Address Input / Fallback */}
        {showManualInput && (
          <form onSubmit={handleManualSave} className="mb-4 p-3 rounded-2xl bg-[#191d26] border border-[#2e3647] space-y-2">
            <p className="text-[11px] font-bold text-gray-300">Enter your TON Wallet Address:</p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="UQC... or EQ..."
                className="flex-1 bg-[#101217] border border-[#282f3d] rounded-xl px-3 py-2 text-xs font-mono text-cyan-200 outline-none focus:border-[#0098ea]"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-[#0098ea] text-xs font-bold text-white hover:bg-[#0087d1] shrink-0"
              >
                Save
              </button>
            </div>
            {error && <p className="text-[10px] text-rose-400 font-bold">{error}</p>}
          </form>
        )}

        {/* Footer Brand Match */}
        <div className="pt-2 flex items-center justify-between border-t border-[#232733] text-gray-400 text-xs font-bold">
          <div className="flex items-center space-x-1.5 text-gray-300">
            {/* TON Connect Logo */}
            <div className="w-5 h-5 rounded-full bg-[#0098ea] flex items-center justify-center text-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L3 8V16L12 22L21 16V8L12 2Z" />
              </svg>
            </div>
            <span className="tracking-wide">TON Connect</span>
          </div>

          <button
            onClick={() => {
              if (window.Telegram?.WebApp?.openLink) {
                window.Telegram.WebApp.openLink('https://ton.org/connect');
              } else {
                window.open('https://ton.org/connect', '_blank');
              }
            }}
            className="w-5 h-5 rounded-full bg-[#20232b] flex items-center justify-center text-gray-400 hover:text-white"
          >
            <HelpCircle size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
