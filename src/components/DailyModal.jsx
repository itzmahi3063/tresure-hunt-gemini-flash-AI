import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Calendar,
  Gift,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Key,
  Gem,
  AlertCircle,
  Flame,
  Lock,
  RefreshCw
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { showMonetagRewardedPopup } from '../services/ads';
import confetti from 'canvas-confetti';
import api from '../services/api';

export default function DailyModal({ isOpen, onClose }) {
  const { user, setUser } = useApp();
  const [status, setStatus] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('treasure_daily_rewards_status');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadDailyStatus();
      setMessage(null);
    }
  }, [isOpen]);

  const loadDailyStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get('/daily-rewards/status');
      if (res.data.success) {
        setStatus(res.data);
        try {
          localStorage.setItem('treasure_daily_rewards_status', JSON.stringify(res.data));
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Failed to load daily rewards status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!status?.canClaim || claiming) return;

    setClaiming(true);
    setMessage(null);
    triggerHaptic('impact', 'medium');

    try {
      // Rewarded popup ad plays before the daily reward is granted — also
      // enforces the 5-second minimum watch time before resolving.
      setMessage({ type: 'info', text: 'Loading ad... please watch until the end to claim your reward.' });
      const { watchStartedAt } = await showMonetagRewardedPopup();

      const res = await api.post('/daily-rewards/claim', { watchStartedAt });
      if (res.data.success) {
        setUser(res.data.user);
        setStatus(prev => prev ? { ...prev, canClaim: false, streak: res.data.dayClaimed } : { canClaim: false, streak: res.data.dayClaimed });
        try {
          const cached = JSON.parse(localStorage.getItem('treasure_daily_rewards_status') || '{}');
          localStorage.setItem('treasure_daily_rewards_status', JSON.stringify({ ...cached, canClaim: false, streak: res.data.dayClaimed }));
        } catch (e) {}
        triggerHaptic('notification', 'success');
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 }
        });
        setMessage({
          type: 'success',
          text: `🎉 Day ${res.data.dayClaimed} claimed! You received ${res.data.reward.label}!`
        });
        loadDailyStatus();
      }
    } catch (err) {
      triggerHaptic('notification', 'error');
      setMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to claim daily reward'
      });
    } finally {
      setClaiming(false);
    }
  };

  if (!isOpen) return null;

  const schedule = status?.schedule || [
    { day: 1, type: 'keys', amount: 1, label: '+1 Chest Key' },
    { day: 2, type: 'diamonds', amount: 5, label: '+5 GEMS' },
    { day: 3, type: 'keys', amount: 1, label: '+1 Chest Key' },
    { day: 4, type: 'diamonds', amount: 10, label: '+10 GEMS' },
    { day: 5, type: 'keys', amount: 1, label: '+1 Chest Key' },
    { day: 6, type: 'diamonds', amount: 20, label: '+20 GEMS' },
    { day: 7, type: 'crystal_coins', amount: 1, label: '+1 Crystal Coin', isSpecial: true }
  ];

  const todayStr = new Date().toISOString().split('T')[0];
  const userFallbackCanClaim = user ? (!user.last_daily_claim || user.last_daily_claim !== todayStr) : false;
  const canClaim = status !== null ? Boolean(status.canClaim) : userFallbackCanClaim;
  const currentStreak = status?.streak ?? (user?.daily_streak || 0);
  const currentDayIndex = currentStreak % 7; // 0 to 6

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div
        style={{
          background: 'linear-gradient(180deg, #241a12 0%, #150f0a 100%)',
          borderTop: '2.5px solid #a8793b',
          borderLeft: '1.5px solid #573a1e',
          borderRight: '1.5px solid #573a1e',
          borderBottom: '5px solid #0d0804',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95), 0 0 35px rgba(255, 184, 0, 0.18)'
        }}
        className="w-full max-w-md rounded-[32px] p-4 sm:p-5 pb-8 relative my-auto max-h-[88vh] overflow-y-auto custom-scrollbar"
      >
        {/* Close Button */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            onClose();
          }}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#a89782] hover:text-white bg-[#140c06] border border-[#4a341f] active:scale-90 transition-all"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div
            style={{
              background: 'linear-gradient(180deg, #ffd76b 0%, #f59e0b 50%, #b45309 100%)',
              borderTop: '1.5px solid #fff2b8',
              borderBottom: '3px solid #78350f',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
            }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#1a0f02] shrink-0"
          >
            <Calendar size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-wide flex items-center space-x-2">
              <span>Daily Vault Rewards</span>
              {currentStreak > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 uppercase font-mono font-black flex items-center space-x-1">
                  <Flame size={10} className="text-orange-400 fill-orange-400" />
                  <span>{currentStreak} Day Streak</span>
                </span>
              )}
            </h3>
            <p className="text-xs text-[#a89782] font-medium">Claim free Chest Keys & GEMS every 24 hours</p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-2xl text-xs flex items-center space-x-2 ${
              message.type === 'success'
                ? 'bg-[#18291b] border border-[#2b5432] text-emerald-300'
                : 'bg-[#2b1616] border border-[#542828] text-rose-300'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
            <span className="font-semibold">{message.text}</span>
          </div>
        )}

        {/* Hero Daily Banner */}
        <div
          style={{
            background: 'linear-gradient(180deg, #301f11 0%, #1f140a 100%)',
            borderTop: '2px solid #734d28',
            borderLeft: '1.5px solid #4a3219',
            borderRight: '1.5px solid #4a3219',
            borderBottom: '4px solid #0d0804',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.7)'
          }}
          className="rounded-[26px] p-4 mb-4 text-center space-y-1.5 relative overflow-hidden"
        >
          <div className="text-4xl animate-bounce" style={{ animationDuration: '2.5s' }}>
            🎁
          </div>
          <div>
            <h4 className="text-base font-black text-white tracking-wide">
              {canClaim ? `Claim Day ${(currentDayIndex % 7) + 1} Reward!` : 'Daily Reward Claimed!'}
            </h4>
            <p className="text-xs text-[#f7bf46] font-medium">
              {canClaim ? 'Tap the button below to collect your reward' : 'Come back tomorrow for your next reward'}
            </p>
          </div>
          <p className="text-[10px] text-[#a89782] leading-relaxed font-medium px-2">
            ⚠️ Streak Rule: Claim daily without missing a day. Day 7 of Week 1 unlocks <strong>1 Crystal Coin</strong>!
          </p>
        </div>

        {/* 7-Day Rewards Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {schedule.map((item, idx) => {
            const dayNum = idx + 1;
            const isClaimed = idx < currentDayIndex;
            const isToday = canClaim ? idx === currentDayIndex : false;
            const isUpcoming = idx > currentDayIndex || (!canClaim && idx === currentDayIndex);

            return (
              <div
                key={item.day}
                style={
                  isToday
                    ? {
                        background: 'linear-gradient(180deg, #57371a 0%, #3a2512 100%)',
                        borderTop: '2px solid #ffdc7a',
                        borderBottom: '3.5px solid #1c1007',
                        color: '#f7bf46',
                        boxShadow: '0 4px 14px rgba(247, 191, 70, 0.4)'
                      }
                    : isClaimed
                    ? {
                        backgroundColor: '#122415',
                        border: '1px solid #234d28',
                        color: '#6ee7b7'
                      }
                    : {
                        backgroundColor: '#140c06',
                        border: '1px solid #382413',
                        color: '#8a7660'
                      }
                }
                className={`p-2.5 rounded-2xl text-center relative transition-all ${
                  item.day === 7 ? 'col-span-2' : ''
                } ${isToday ? 'scale-[1.02]' : ''}`}
              >
                {isClaimed && (
                  <div className="absolute top-1.5 right-1.5 text-emerald-400">
                    <CheckCircle2 size={13} />
                  </div>
                )}
                {isToday && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[8px] font-black uppercase px-2 py-0.2 rounded-full font-mono shadow-sm">
                    Today
                  </span>
                )}

                <span className="text-[10px] font-black uppercase tracking-wider block">
                  Day {item.day}
                </span>

                <div className="my-1 flex items-center justify-center">
                  {item.type === 'keys' ? (
                    <Key size={18} className={isToday ? 'text-amber-300' : isClaimed ? 'text-emerald-400' : 'text-gray-400'} />
                  ) : item.type === 'crystal_coins' ? (
                    <span className="text-xl">🔮</span>
                  ) : (
                    <Gem size={17} className={isToday ? 'text-cyan-400' : isClaimed ? 'text-emerald-400' : 'text-gray-400'} />
                  )}
                </div>

                <span
                  className={`text-[11px] font-black block leading-tight font-mono ${
                    isToday ? 'text-white' : isClaimed ? 'text-emerald-300' : 'text-[#a89782]'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Action Claim Button */}
        <button
          onClick={handleClaim}
          disabled={!canClaim || claiming}
          style={
            canClaim
              ? {
                  background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 45%, #e8a522 100%)',
                  borderTop: '1.5px solid #fff2b8',
                  borderLeft: '1px solid #e8a522',
                  borderRight: '1px solid #e8a522',
                  borderBottom: '4px solid #7d4800',
                  color: '#1a0f02',
                  boxShadow: '0 8px 18px rgba(232, 165, 34, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
                }
              : {
                  backgroundColor: '#26180c',
                  color: '#7a6752',
                  borderTop: '1px solid #3d2714',
                  borderBottom: '3px solid #140d06'
                }
          }
          className="w-full py-3.5 rounded-[22px] text-sm font-black tracking-wide uppercase flex items-center justify-center space-x-2 active:translate-y-1 active:border-b-[1px] transition-all disabled:opacity-75"
        >
          {canClaim ? (
            <>
              <Gift size={17} />
              <span>{claiming ? 'Claiming Reward...' : `Claim Day ${(currentDayIndex % 7) + 1} Reward`}</span>
              <ChevronRight size={16} />
            </>
          ) : (
            <>
              <CheckCircle2 size={17} className="text-emerald-400" />
              <span className="text-emerald-300">Claimed for Today · Come back Tomorrow</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
