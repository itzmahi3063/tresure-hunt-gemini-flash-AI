import React from 'react';
import { ShieldAlert, ExternalLink, Send } from 'lucide-react';

export default function TelegramOnlyScreen({ botUsername = 'treasure_hunt12_bot' }) {
  const botLink = `https://t.me/${botUsername}`;

  return (
    <div className="fixed inset-0 z-[99999] bg-[#0A0A0E] text-white flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div
        style={{
          background: 'linear-gradient(180deg, #181512 0%, #0d0a07 100%)',
          borderTop: '2px solid #5a3b1d',
          borderLeft: '1.5px solid #332010',
          borderRight: '1.5px solid #332010',
          borderBottom: '4px solid #080503',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9), 0 0 35px rgba(36, 161, 222, 0.15)'
        }}
        className="w-full max-w-sm rounded-[32px] p-7 relative space-y-5 border border-white/5"
      >
        {/* Telegram App Icon Badge */}
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2AABEE] to-[#229ED9] flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Send size={36} className="text-white -rotate-12 translate-x-0.5 -translate-y-0.5" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-xl font-heading font-black text-white tracking-wide uppercase">
            Telegram App Required
          </h2>
          <p className="text-xs text-gray-300 leading-relaxed">
            <span className="font-bold text-amber-400">Treasure Hunt</span> is an exclusive Telegram Mini App. It cannot be run inside an external web browser.
          </p>
          <p className="text-[11px] text-gray-400">
            Please launch this app from inside your official Telegram Mobile or Desktop app.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <a
            href={botLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'linear-gradient(180deg, #2AABEE 0%, #1e8ec5 100%)',
              boxShadow: '0 4px 15px rgba(42, 171, 238, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)'
            }}
            className="w-full py-3.5 px-6 rounded-2xl flex items-center justify-center space-x-2 text-white font-heading font-bold text-sm hover:brightness-110 active:scale-95 transition-all"
          >
            <span>Launch in Telegram</span>
            <ExternalLink size={16} />
          </a>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center space-x-1.5 text-[10px] text-gray-500 font-mono pt-1">
          <ShieldAlert size={12} className="text-emerald-400" />
          <span>Protected by Telegram HMAC Verification</span>
        </div>
      </div>
    </div>
  );
}
