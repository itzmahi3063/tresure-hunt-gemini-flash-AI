import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../services/telegram';
import { Sparkles } from 'lucide-react';

export default function SplashScreen({ onFinish, loading }) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Entering Treasure Hunt...');

  useEffect(() => {
    const startTime = Date.now();
    const phase1Duration = 2000; // 0% to 50% in 2 seconds
    const phase2Duration = 2000; // 50% to 100% in 2 seconds
    const totalDuration = phase1Duration + phase2Duration; // 4 seconds total

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;

      if (elapsed < phase1Duration) {
        // Phase 1: 0% to 50% in 2 seconds
        const p1 = Math.min(50, Math.floor((elapsed / phase1Duration) * 50));
        setProgress(p1);
        setStatusText('Entering Treasure Hunt...');
      } else if (elapsed < totalDuration) {
        // Phase 2: 50% to 100% in 2 seconds
        const p2 = Math.min(99, Math.floor(50 + ((elapsed - phase1Duration) / phase2Duration) * 50));
        setProgress(p2);
        setStatusText('Loading Treasure Vault...');
      } else {
        // Completed 4 seconds total
        if (loading && elapsed < 5500) {
          // If server sync is still in flight, hold smoothly at 99%
          setProgress(99);
          setStatusText('Finalizing...');
        } else {
          // 4s finished and ready: hit 100% and transition into app
          setProgress(100);
          setStatusText('Ready!');
          clearInterval(interval);
          triggerHaptic('impact', 'light');
          setTimeout(() => {
            if (onFinish) onFinish();
          }, 160);
        }
      }
    }, 40);

    return () => clearInterval(interval);
  }, [loading, onFinish]);

  const displayText = statusText;
  const displayProgress = progress;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#050508] flex items-center justify-center p-0 sm:p-4 select-none overflow-hidden animate-fadeIn">
      {/* Phone Screen Mockup Container with Exact 9:16 Aspect Ratio */}
      <div className="relative w-full max-w-[410px] h-full sm:h-auto sm:aspect-[9/16] max-h-[96vh] sm:rounded-[36px] sm:border-2 sm:border-[#382b1c] sm:shadow-[0_0_60px_rgba(0,0,0,0.95),0_0_30px_rgba(247,191,70,0.15)] overflow-hidden flex flex-col justify-between bg-[#07060b]">
        {/* 3D Background Image */}
        <div className="absolute inset-0 w-full h-full">
          <picture>
            <source srcSet="/splash_bg.webp" type="image/webp" />
            <img
              src="/splash_bg.webp"
              alt="Treasure Hunt"
              className="w-full h-full object-cover object-top"
            />
          </picture>

          {/* Ambient Dark Bottom Gradient for clear loading bar visibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[#07060b]/90 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#07060b] via-[#07060b]/80 to-transparent pointer-events-none" />
        </div>

        {/* Top Spacer */}
        <div className="pt-4 relative z-10" />

        {/* Bottom Loading Bar Container - Seamless Direct Overlay without Box */}
        <div className="relative z-10 w-full px-6 pb-8 sm:pb-10 flex flex-col items-center space-y-3">
          {/* Status Text & Progress Percentage */}
          <div className="w-full flex justify-between items-center text-xs px-1">
            <div className="flex items-center space-x-1.5 text-yellow-300 font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              <Sparkles size={14} className="text-yellow-400 animate-spin drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" style={{ animationDuration: '3s' }} />
              <span className="tracking-wide text-[12px] font-sans drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">{displayText}</span>
            </div>
            <span className="text-cyan-300 font-mono font-black text-sm drop-shadow-[0_0_10px_rgba(0,229,255,0.9)]">
              {displayProgress}%
            </span>
          </div>

          {/* 3D Glowing Progress Bar Floating Directly on Art */}
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              border: '1.5px solid rgba(245, 158, 11, 0.4)',
              borderTop: '1.5px solid rgba(255, 230, 150, 0.6)',
              borderBottom: '2px solid rgba(0, 0, 0, 0.9)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.9), inset 0 2px 6px rgba(0, 0, 0, 0.9)'
            }}
            className="w-full h-[14px] rounded-full p-[2px] relative overflow-hidden flex items-center backdrop-blur-sm"
          >
            {/* Progress Fill */}
            <div
              style={{
                width: `${displayProgress}%`,
                background: 'linear-gradient(90deg, #d97706 0%, #f59e0b 35%, #00e5ff 80%, #a855f7 100%)',
                boxShadow: '0 0 16px rgba(0, 229, 255, 0.9), inset 0 1px 1px rgba(255, 255, 255, 0.9)'
              }}
              className="h-full rounded-full transition-all duration-150 relative overflow-hidden"
            >
              {/* Shimmer Light Beam */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent animate-continuous-shine pointer-events-none" />
            </div>
          </div>

          {/* Small version tag */}
          <p className="text-[10px] text-gray-300/80 font-mono font-bold tracking-widest text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            TREASURE HUNT · TELEGRAM MINI APP
          </p>
        </div>
      </div>
    </div>
  );
}
