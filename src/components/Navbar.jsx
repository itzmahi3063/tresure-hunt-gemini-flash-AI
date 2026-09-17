import React from 'react';
import { useApp } from '../context/AppContext';
import { Home, ClipboardList, Gamepad2, Gift, User, ShieldCheck, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';

export default function Navbar() {
  const { activeTab, setActiveTab, isAdmin, t } = useApp();

  const navItems = [
    { id: 'home', label: t('nav_home'), icon: Home },
    { id: 'tasks', label: t('nav_tasks'), icon: ClipboardList },
    { id: 'play', label: t('nav_play'), icon: Gamepad2, isCenter: true },
    { id: 'refer', label: t('nav_refer'), icon: Gift },
    { id: 'profile', label: t('nav_profile'), icon: User },
  ];

  const handleTabClick = (tabId) => {
    triggerHaptic('selection');
    setActiveTab(tabId);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-[#101016]/95 backdrop-blur-md border-t-2 border-[#2F2F42] border-b-4 border-black px-2 py-1.5 shadow-2xl">
      <div className="flex justify-around items-end">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          // SPECIAL CENTRAL SHINING PLAY BUTTON
          if (item.isCenter) {
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className="flex flex-col items-center justify-center -mt-6 relative z-10 px-2 group active:scale-95 transition-transform"
              >
                {/* Elevated 3D Shiny Glowing Orb Container */}
                <div
                  style={{
                    background: isActive
                      ? 'linear-gradient(180deg, #FFF099 0%, #FFC400 35%, #FF8C00 75%, #B33600 100%)'
                      : 'linear-gradient(180deg, #FFE57F 0%, #F5A623 40%, #D97706 75%, #8A3800 100%)',
                    borderTop: '2.5px solid #FFFFFF',
                    borderLeft: '1.5px solid #FFC837',
                    borderRight: '1.5px solid #FFC837',
                    borderBottom: '4.5px solid #4D1A00',
                  }}
                  className="w-[58px] h-[58px] rounded-[24px] flex items-center justify-center relative overflow-hidden animate-play-glow shadow-2xl transition-all"
                >
                  {/* Continuous Shimmer Light Beam */}
                  <div className="absolute inset-0 w-[60%] h-full bg-gradient-to-r from-transparent via-white/85 to-transparent animate-continuous-shine pointer-events-none" />

                  {/* Top Glossy Curve Highlight */}
                  <div className="absolute top-0 left-1 right-1 h-3 bg-gradient-to-b from-white/50 to-transparent rounded-t-[20px] pointer-events-none" />

                  {/* Central Gamepad Icon */}
                  <div className="relative z-10 flex items-center justify-center">
                    <Icon
                      size={28}
                      className="text-[#1a0f00] drop-shadow-[0_1px_2px_rgba(255,255,255,0.6)]"
                      strokeWidth={2.4}
                    />
                  </div>

                  {/* Mini floating sparkle badge */}
                  <div className="absolute -top-1 -right-1 pointer-events-none">
                    <Sparkles size={13} className="text-yellow-200 animate-spin" style={{ animationDuration: '4s' }} />
                  </div>
                </div>

                {/* Play Label */}
                <span
                  className={`text-[11px] mt-1 font-black tracking-wider uppercase transition-colors ${
                    isActive
                      ? 'text-[#f7bf46] drop-shadow-[0_0_8px_rgba(247,191,70,0.8)]'
                      : 'text-amber-400/90 drop-shadow-[0_0_4px_rgba(245,166,35,0.4)]'
                  }`}
                >
                  PLAY
                </span>
              </button>
            );
          }

          // REGULAR NAVBAR BUTTONS
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-150 relative ${
                isActive ? 'scale-105' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className={`p-1.5 rounded-2xl transition-all ${
                isActive 
                  ? 'btn-3d-gold shadow-gold-glow' 
                  : 'bg-[#181824] border border-[#2B2B3D] border-b-2 border-black'
              }`}>
                <Icon size={19} className={isActive ? 'text-black' : 'text-gray-300'} />
              </div>

              <span className={`text-[10px] mt-1 font-bold tracking-wide uppercase ${
                isActive ? 'text-yellow-400 font-black' : 'text-gray-400'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Admin Shortcut (Exclusive to 5697990319) */}
        {isAdmin && (
          <button
            onClick={() => handleTabClick('admin')}
            className={`flex flex-col items-center justify-center py-1 px-1 transition-all ${
              activeTab === 'admin' ? 'scale-105' : 'text-cyan-500'
            }`}
          >
            <div className={`p-1.5 rounded-2xl ${
              activeTab === 'admin' ? 'btn-3d-cyan' : 'bg-cyan-950/60 border border-cyan-500/40 border-b-2 border-cyan-950'
            }`}>
              <ShieldCheck size={19} className={activeTab === 'admin' ? 'text-black' : 'text-cyan-400'} />
            </div>
            <span className="text-[10px] mt-1 font-black uppercase text-cyan-400">Admin</span>
          </button>
        )}
      </div>
    </div>
  );
}
