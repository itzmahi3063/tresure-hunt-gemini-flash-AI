import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users,
  Check,
  ExternalLink,
  RefreshCw,
  Sparkles,
  AlertCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { triggerHaptic, openTelegramLink } from '../services/telegram';
import confetti from 'canvas-confetti';
import api from '../services/api';

const MANDATORY_ITEMS = [
  {
    id: 'mandatory_official',
    title: 'TREASURE HUNT OFFICIAL',
    username: '@treasure_hunt_12',
    link: 'https://t.me/treasure_hunt_12',
    type: 'channel'
  },
  {
    id: 'mandatory_community',
    title: 'TREASURE HUNT COMMUNITY',
    username: '@treasure_hunt12',
    link: 'https://t.me/treasure_hunt12',
    type: 'group'
  },
  {
    id: 'mandatory_payment',
    title: 'TREASURE HUNT PAYMENT',
    username: '@treasure_pay',
    link: 'https://t.me/treasure_pay',
    type: 'channel'
  }
];

export default function MandatoryGateScreen({ onVerified }) {
  const { setUser } = useApp();
  const [visitedMap, setVisitedMap] = useState({});
  const [joinedMap, setJoinedMap] = useState({});
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    loadGateStatus();
  }, []);

  const loadGateStatus = async () => {
    try {
      setInitialLoading(true);
      const res = await api.get('/mandatory-channels/status');
      if (res.data.success) {
        const jMap = {};
        res.data.channels?.forEach((ch) => {
          if (ch.isJoined) jMap[ch.id] = true;
        });
        setJoinedMap(jMap);

        if (res.data.allJoined || res.data.isVerified) {
          if (onVerified) onVerified();
        }
      }
    } catch (err) {
      console.error('Error checking gate status:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleJoinClick = (item) => {
    triggerHaptic('impact', 'medium');
    setVisitedMap((prev) => ({ ...prev, [item.id]: true }));
    setErrorMsg(null);
    openTelegramLink(item.link);
  };

  const handleCheckAgain = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    triggerHaptic('impact', 'medium');

    try {
      const res = await api.post('/mandatory-channels/verify', {
        visited: visitedMap
      });

      if (res.data.success) {
        const newJoined = {};
        res.data.channels?.forEach((ch) => {
          if (ch.isJoined) newJoined[ch.id] = true;
        });
        setJoinedMap(newJoined);

        if (res.data.user) {
          setUser(res.data.user);
        }

        if (res.data.allJoined || res.data.isVerified) {
          confetti({
            particleCount: 90,
            spread: 80,
            origin: { y: 0.5 }
          });
          triggerHaptic('notification', 'success');
          setSuccessMsg('🎉 All 3 channels verified! Unlocking Treasure Hunt...');
          setTimeout(() => {
            if (onVerified) onVerified();
          }, 1200);
        } else {
          setHasCheckedOnce(true);
          triggerHaptic('notification', 'error');
          const unjoinedCount = MANDATORY_ITEMS.filter((i) => !newJoined[i.id]).length;
          setErrorMsg(
            `You still have ${unjoinedCount} unjoined ${
              unjoinedCount === 1 ? 'channel' : 'channels'
            }. Please tap "Join" for all 3, then tap Check again.`
          );
        }
      }
    } catch (err) {
      setHasCheckedOnce(true);
      setErrorMsg(err.response?.data?.error || 'Verification check failed. Please try again.');
      triggerHaptic('notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const allAreJoined = MANDATORY_ITEMS.every((item) => joinedMap[item.id]);

  if (initialLoading) {
    return (
      <div className="fixed inset-0 z-[999] bg-[#0A0A0E] flex flex-col items-center justify-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-pulse">
          <Users size={28} className="text-amber-400" />
        </div>
        <p className="text-xs text-gray-400 font-mono tracking-widest uppercase">Checking membership...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[999] bg-[#0A0A0E] overflow-y-auto flex items-center justify-center p-4 sm:p-6 select-none animate-fadeIn">
      {/* Centered Gate Card */}
      <div
        style={{
          background: 'linear-gradient(180deg, #1b1510 0%, #100b07 100%)',
          borderTop: '2px solid #5a3b1d',
          borderLeft: '1.5px solid #332010',
          borderRight: '1.5px solid #332010',
          borderBottom: '5px solid #080503',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 40px rgba(247, 191, 70, 0.1)'
        }}
        className="w-full max-w-md rounded-[32px] p-6 text-center relative my-auto space-y-5"
      >
        {/* Top Community Icon */}
        <div className="flex justify-center">
          <div
            style={{
              background: 'linear-gradient(180deg, #ffd76b 0%, #f59e0b 55%, #b45309 100%)',
              borderTop: '1.5px solid #fff2b8',
              borderBottom: '3.5px solid #78350f',
              boxShadow: '0 8px 24px rgba(245, 158, 11, 0.35)'
            }}
            className="w-16 h-16 rounded-[22px] flex items-center justify-center text-[#180e03] shadow-xl"
          >
            <Users size={32} strokeWidth={2.4} />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1.5">
          <h2 className="text-2xl font-black text-white tracking-wide">
            Join to continue
          </h2>
          <p className="text-xs text-[#a89782] font-medium leading-relaxed max-w-xs mx-auto">
            Treasure Hunt is a community app. Join all 3 to unlock the vault.
          </p>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-[#2e1313] border border-[#632929] text-rose-300 text-xs flex items-center space-x-2 text-left animate-fadeIn">
            <AlertCircle size={17} className="shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-2xl bg-[#132e18] border border-[#236330] text-emerald-300 text-xs flex items-center space-x-2 text-left animate-fadeIn">
            <Sparkles size={17} className="shrink-0 text-emerald-400" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* 3 Channels / Groups List */}
        <div className="space-y-3 text-left">
          {MANDATORY_ITEMS.map((item) => {
            const isJoined = !!joinedMap[item.id];
            const isVisited = !!visitedMap[item.id];

            return (
              <div
                key={item.id}
                style={
                  isJoined
                    ? {
                        background: 'linear-gradient(180deg, #0e2417 0%, #08170e 100%)',
                        borderTop: '1.5px solid #1f6b3e',
                        borderLeft: '1px solid #144729',
                        borderRight: '1px solid #144729',
                        borderBottom: '3.5px solid #040e08',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.15)'
                      }
                    : {
                        background: 'linear-gradient(180deg, #24180e 0%, #181008 100%)',
                        borderTop: '1.5px solid #4a331c',
                        borderLeft: '1px solid #332313',
                        borderRight: '1px solid #332313',
                        borderBottom: '3.5px solid #0a0703',
                        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)'
                      }
                }
                className="rounded-2xl p-3.5 flex items-center justify-between transition-all"
              >
                {/* Left Icon + Text */}
                <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                  {/* Status Squircle Icon */}
                  <div
                    style={
                      isJoined
                        ? {
                            background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                            borderTop: '1px solid #6ee7b7',
                            borderBottom: '2.5px solid #064e3b'
                          }
                        : {
                            background: '#150e08',
                            border: '1px solid #382413'
                          }
                    }
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  >
                    {isJoined ? (
                      <Check size={20} className="text-white font-black" strokeWidth={3} />
                    ) : (
                      <Users size={18} className="text-[#a89782]" />
                    )}
                  </div>

                  {/* Channel Title & Username */}
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-white truncate tracking-wide">
                      {item.title}
                    </h4>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span className="text-[11px] font-mono text-[#a89782]">
                        {item.username}
                      </span>
                      <span className="text-[10px] text-[#634e38]">·</span>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          isJoined ? 'text-emerald-400' : 'text-[#8a7966]'
                        }`}
                      >
                        {isJoined ? 'Joined' : isVisited ? 'Clicked / Verify' : 'Not joined yet'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action: Join Button or Green Checkmark */}
                {isJoined ? (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-400 shrink-0">
                    <Check size={20} strokeWidth={3} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleJoinClick(item)}
                    style={{
                      background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 50%, #d48b11 100%)',
                      borderTop: '1px solid #fff2b8',
                      borderLeft: '1px solid #f7bf46',
                      borderRight: '1px solid #f7bf46',
                      borderBottom: '3px solid #7a4b00',
                      color: '#1a0f02',
                      boxShadow: '0 4px 10px rgba(247, 191, 70, 0.3)'
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1 shrink-0 active:translate-y-0.5 active:border-b-[1px] transition-all hover:scale-105"
                  >
                    <span>Join</span>
                    <ExternalLink size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Button */}
        <div className="pt-2">
          {allAreJoined ? (
            <button
              type="button"
              onClick={handleCheckAgain}
              disabled={loading}
              style={{
                background: 'linear-gradient(180deg, #10b981 0%, #059669 50%, #047857 100%)',
                borderTop: '1.5px solid #a7f3d0',
                borderLeft: '1px solid #059669',
                borderRight: '1px solid #059669',
                borderBottom: '4px solid #064e3b',
                color: '#ffffff',
                boxShadow: '0 8px 20px rgba(16, 185, 129, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
              }}
              className="w-full py-4 rounded-[22px] text-sm font-black uppercase tracking-wider flex items-center justify-center space-x-2 active:translate-y-1 active:border-b-[1px] transition-all"
            >
              <span>Continue to Treasure Hunt</span>
              <ArrowRight size={17} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCheckAgain}
              disabled={loading}
              style={{
                background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)',
                borderTop: '1.5px solid #bbf7d0',
                borderLeft: '1px solid #22c55e',
                borderRight: '1px solid #22c55e',
                borderBottom: '4px solid #14532d',
                color: '#052e16',
                boxShadow: '0 8px 20px rgba(34, 197, 94, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
              }}
              className="w-full py-4 rounded-[22px] text-sm font-black uppercase tracking-wider flex items-center justify-center space-x-2 active:translate-y-1 active:border-b-[1px] transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Checking...' : hasCheckedOnce ? 'Check again' : 'Verify'}</span>
            </button>
          )}
        </div>

        {/* Footer Subtext */}
        <p className="text-[11px] text-[#7a6a57] font-medium leading-relaxed">
          Membership is verified securely through Telegram. Join, then tap Check again.
        </p>
      </div>
    </div>
  );
}
