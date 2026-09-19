import React, { useState } from 'react';
import { Wifi, RotateCcw, MoreHorizontal } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import api from '../services/api';

export default function IpBlockedScreen({ linkedUsers, onRetry, onSwitched }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSwitchAccount = async () => {
    triggerHaptic('impact', 'heavy');
    const confirmed = window.confirm(
      '⚠️ WARNING: Switching account will reset your GEMS and USDT balance to 0 on this account to prevent duplicate account abuse. Are you sure you want to proceed?'
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      setError('');
      const res = await api.post('/user/ip-switch', {});
      if (res.data.success) {
        triggerHaptic('notification', 'success');
        if (onSwitched) onSwitched(res.data.user);
      }
    } catch (err) {
      triggerHaptic('notification', 'error');
      setError(err.response?.data?.error || 'Failed to switch account');
    } finally {
      setLoading(false);
    }
  };

  const users = Array.isArray(linkedUsers) && linkedUsers.length > 0 ? linkedUsers : [];

  return (
    <div className="fixed inset-0 z-[9999] bg-[#07090E] text-white flex flex-col justify-between p-6 max-w-md mx-auto font-sans select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => {
            if (window.Telegram?.WebApp?.close) {
              window.Telegram.WebApp.close();
            }
          }}
          className="text-gray-400 hover:text-white text-sm font-bold active:scale-95 transition-all"
        >
          Close
        </button>

        <div className="text-center">
          <h2 className="text-xs font-black text-white tracking-widest uppercase font-heading">
            TREASURE HUNT
          </h2>
          <p className="text-[10px] text-gray-400">mini app</p>
        </div>

        <button className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white">
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Center Content */}
      <div className="flex flex-col items-center text-center my-auto px-2 space-y-5 overflow-y-auto max-h-[70vh]">
        {/* Cyan Glowing WiFi / Connection Icon */}
        <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00E5FF] shadow-[0_0_30px_rgba(0,229,255,0.35)] animate-pulse shrink-0">
          <Wifi size={32} strokeWidth={2.5} />
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-black text-[#00E5FF] tracking-tight font-heading drop-shadow-[0_0_15px_rgba(0,229,255,0.4)]">
            Device Already In Use — Same IP
          </h1>
          <p className="text-xs font-bold text-amber-400 max-w-xs mx-auto leading-relaxed">
            If you want to run this account, you need to connect using a VPN.
          </p>
          <p className="text-xs text-[#8E95A5] max-w-xs mx-auto leading-relaxed">
            This device is already linked to another account. Log in with that account, or claim this device for this one below.
          </p>
        </div>

        {/* Linked Accounts (up to 3 accounts already allowed on this IP) */}
        <div className="w-full space-y-2.5">
          {users.map((u) => {
            const name = u?.name || 'Linked Hunter';
            const username = u?.username ? `@${u.username}` : '';
            const uid = u?.id || 'Unknown ID';
            return (
              <div
                key={uid}
                className="w-full bg-[#0E121E] border border-[#1E2538] rounded-2xl p-4 flex items-center space-x-3.5 text-left shadow-lg"
              >
                <div className="w-11 h-11 rounded-full bg-[#122B2F] border border-[#1B4D53] flex items-center justify-center text-[#00E5FF] font-black font-numbers text-lg shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-black text-white truncate font-heading tracking-wide">
                    {name}
                  </h4>
                  <p className="text-[11px] text-[#7A8398] font-mono truncate font-medium">
                    {username ? `${username} · ` : ''}ID {uid}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-950/60 p-2.5 rounded-xl border border-rose-500/40 w-full">
            {error}
          </p>
        )}
      </div>

      {/* Bottom Action Buttons */}
      <div className="space-y-3 pb-4">
        {/* 1. Try Again Button (Vibrant Blue/Cyan) */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            if (onRetry) onRetry();
          }}
          style={{
            background: 'linear-gradient(180deg, #38BDF8 0%, #0284C7 100%)',
            borderTop: '1.5px solid #BAE6FD',
            borderBottom: '3.5px solid #0369A1',
            boxShadow: '0 8px 25px rgba(2, 132, 199, 0.45)'
          }}
          className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center space-x-2 active:scale-[0.98] transition-all tracking-wide"
        >
          <RotateCcw size={17} />
          <span>Try again</span>
        </button>

        {/* 2. Switch Account (Resets Balance) Button */}
        <button
          onClick={handleSwitchAccount}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl font-bold text-sm bg-[#0E121E] border border-[#222A40] text-gray-200 hover:text-white hover:border-rose-500/40 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? 'Switching...' : 'Switch account (resets my balance)'}
        </button>

        {/* Disclaimer Footer */}
        <p className="text-[11px] text-[#64748B] text-center px-4 leading-relaxed font-medium">
          Switching claims this connection for your account but resets your GEMS and USDT balance to zero.
        </p>
      </div>
    </div>
  );
}
