import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function SyncErrorScreen({ error, onRetry }) {
  const status = error?.status;
  const isAuthError = status === 401 || status === 403;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#07090E] text-white flex flex-col items-center justify-center p-6 max-w-md mx-auto font-sans text-center space-y-5">
      <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.25)]">
        <AlertTriangle size={30} strokeWidth={2.5} />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-black text-rose-400 tracking-tight font-heading">
          Couldn't Load Your Profile
        </h1>
        <p className="text-xs text-[#8E95A5] max-w-xs mx-auto leading-relaxed">
          {isAuthError
            ? "Your session couldn't be verified. Please close and reopen this app from Telegram."
            : (error?.message || 'A connection problem stopped us from loading your GEMS balance.')}
        </p>
        <p className="text-[10px] text-[#5A6072] max-w-xs mx-auto leading-relaxed">
          Your balance is safe — this is a connection issue, not a data loss. Nothing has been reset.
        </p>
      </div>

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
        className="px-6 py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center space-x-2 active:scale-[0.98] transition-all tracking-wide"
      >
        <RotateCcw size={17} />
        <span>Try again</span>
      </button>
    </div>
  );
}
