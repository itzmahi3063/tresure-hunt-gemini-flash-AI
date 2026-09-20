import React from 'react';
import { Gamepad2, ListChecks, Gift, User, Sparkles, ShieldCheck } from 'lucide-react';

export default function SectionLoader({ tab = 'play', isInitial = false }) {
  const getTabDetails = () => {
    switch (tab) {
      case 'play':
        return {
          title: 'Loading Games',
          subtitle: 'Preparing fun...',
          icon: <Gamepad2 size={36} className="text-purple-400" />
        };
      case 'tasks':
        return {
          title: 'Loading Tasks',
          subtitle: 'Fetching daily rewards...',
          icon: <ListChecks size={36} className="text-purple-400" />
        };
      case 'refer':
        return {
          title: 'Loading Referrals',
          subtitle: 'Preparing your network...',
          icon: <Gift size={36} className="text-purple-400" />
        };
      case 'profile':
        return {
          title: 'Loading Account',
          subtitle: 'Syncing treasury wallet...',
          icon: <User size={36} className="text-purple-400" />
        };
      case 'admin':
        return {
          title: 'Loading Admin Panel',
          subtitle: 'Verifying security permissions...',
          icon: <ShieldCheck size={36} className="text-purple-400" />
        };
      default:
        return {
          title: isInitial ? 'Loading Treasure Hunt' : 'Loading...',
          subtitle: isInitial ? 'Rendering 3D World & Telegram Vault...' : 'Please wait...',
          icon: <Sparkles size={36} className="text-purple-400" />
        };
    }
  };

  const { title, subtitle, icon } = getTabDetails();

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0E] flex flex-col items-center justify-center text-center p-6 select-none animate-fadeIn">
      {/* Circular Progress Ring with Centered Icon */}
      <div className="relative w-36 h-36 flex items-center justify-center mb-6">
        {/* Static Background Ring */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="#1A1D2B"
            strokeWidth="5"
            fill="none"
          />
        </svg>

        {/* Spinning Glowing Foreground Arc */}
        <div className="absolute inset-0 w-full h-full spin-smooth">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke="#A855F7"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="264"
              strokeDashoffset="170"
              fill="none"
              className="drop-shadow-[0_0_12px_rgba(168,85,247,0.9)]"
            />
          </svg>
        </div>

        {/* Center Glow + Icon */}
        <div className="relative z-10 flex items-center justify-center pointer-events-none">
          <div className="absolute w-16 h-16 bg-purple-600/25 rounded-full blur-xl animate-pulse" />
          <div className="relative z-10 drop-shadow-[0_0_14px_rgba(168,85,247,0.6)]">
            {icon}
          </div>
        </div>
      </div>

      {/* Title & Subtitle matched to Screenshot */}
      <h3 className="text-xl font-bold text-white tracking-wide mb-1.5">
        {title}
      </h3>
      <p className="text-xs text-[#8E95A5] font-medium">
        {subtitle}
      </p>
    </div>
  );
}

