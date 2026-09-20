import React, { useState, useEffect } from 'react';
import { Wrench, ShieldCheck, MessageCircle, Radio, RefreshCw, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import api from '../services/api';

export default function MaintenanceScreen({ message, onRefresh }) {
  const [checking, setChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState(null); // { isMaintenance: boolean, text: string }

  // Check Maintenance Status manually or periodically
  const handleCheckStatus = async (isManual = true) => {
    if (checking) return;
    if (isManual) {
      setChecking(true);
      triggerHaptic('impact', 'medium');
    }
    try {
      const res = await api.get('/maintenance');
      const isUnderMaintenance = Boolean(res.data?.maintenance);
      if (!isUnderMaintenance) {
        // Maintenance is OVER! Notify and refresh
        setCheckStatus({
          isMaintenance: false,
          text: '🎉 Maintenance completed! Reopening app...'
        });
        triggerHaptic('notification', 'success');
        setTimeout(() => {
          if (onRefresh) onRefresh();
          else window.location.reload();
        }, 1200);
      } else {
        if (isManual) {
          setCheckStatus({
            isMaintenance: true,
            text: '⏳ System is still updating. Thank you for your patience!'
          });
          triggerHaptic('notification', 'warning');
        }
      }
    } catch (err) {
      if (isManual) {
        setCheckStatus({
          isMaintenance: true,
          text: 'Unable to check status. Please check your connection.'
        });
      }
    } finally {
      if (isManual) {
        setTimeout(() => setChecking(false), 500);
      }
    }
  };

  // Background Auto-Poll every 15 seconds to automatically unlock the app when maintenance ends
  useEffect(() => {
    const interval = setInterval(() => {
      handleCheckStatus(false);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const openTelegramLink = (url) => {
    triggerHaptic('selection');
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#07090E] text-white flex flex-col justify-between p-5 max-w-md mx-auto font-sans select-none overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => {
            if (window.Telegram?.WebApp?.close) {
              window.Telegram.WebApp.close();
            }
          }}
          className="text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider active:scale-95 transition-all bg-[#121624] px-3 py-1.5 rounded-xl border border-[#1E2538]"
        >
          Close
        </button>

        <div className="text-center">
          <h2 className="text-xs font-black text-yellow-400 tracking-widest uppercase font-heading">
            TREASURE HUNT
          </h2>
          <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Official Mini App</p>
        </div>

        <div className="w-14" /> {/* Spacer for symmetry */}
      </div>

      {/* Main 3D Center Area */}
      <div className="flex flex-col items-center text-center my-auto py-6 space-y-5">
        {/* Glowing 3D Animated Maintenance Badge */}
        <div className="relative">
          <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 rounded-full blur-xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-[#1E1B10] to-[#0D0E15] border-2 border-yellow-500/40 shadow-[0_0_35px_rgba(234,179,8,0.25)] flex items-center justify-center text-yellow-400">
            <Wrench size={38} className="animate-spin-slow drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-amber-500 border-2 border-[#07090E] flex items-center justify-center text-black font-black shadow-lg">
            <Sparkles size={14} />
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="inline-flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.2 rounded-full">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 font-heading">
            Maintenance In Progress
          </span>
        </div>

        {/* Headings */}
        <div className="space-y-2 px-2">
          <h1 className="text-2xl font-black text-white tracking-tight font-heading drop-shadow-md">
            System Under Maintenance
          </h1>
          <p className="text-xs text-gray-300 leading-relaxed max-w-xs mx-auto">
            We are currently upgrading the application servers and deploying new features to give you a smoother and more rewarding gaming experience.
          </p>
        </div>

        {/* Custom Admin Announcement Message (if set) */}
        {message && (
          <div className="w-full bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3.5 text-left text-xs text-amber-200 leading-relaxed shadow-lg">
            <div className="flex items-center space-x-1.5 text-[10px] font-black uppercase text-amber-400 mb-1">
              <AlertTriangle size={13} />
              <span>Admin Notice</span>
            </div>
            <p className="font-medium text-[11px]">{message}</p>
          </div>
        )}

        {/* Informative Highlights */}
        <div className="w-full space-y-2 text-left">
          <div className="bg-[#0E121E] border border-[#1E2538] rounded-2xl p-3 flex items-start space-x-3 shadow-md">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
              <Radio size={16} />
            </div>
            <div>
              <h4 className="text-xs font-black text-white font-heading">Community Announcement</h4>
              <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
                An official announcement will be posted in our Telegram community as soon as the update is finalized.
              </p>
            </div>
          </div>

          <div className="bg-[#0E121E] border border-[#1E2538] rounded-2xl p-3 flex items-start space-x-3 shadow-md">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <RefreshCw size={16} />
            </div>
            <div>
              <h4 className="text-xs font-black text-white font-heading">Automatic App Reopening</h4>
              <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
                The app will automatically reopen and unlock for all players the moment maintenance finishes.
              </p>
            </div>
          </div>

          <div className="bg-[#0E121E] border border-[#1E2538] rounded-2xl p-3 flex items-start space-x-3 shadow-md">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-yellow-400 shrink-0 mt-0.5">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h4 className="text-xs font-black text-white font-heading">100% Safe & Preserved</h4>
              <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
                Your diamonds, USDT, keys, spins, and account progress are completely safe and untouched.
              </p>
            </div>
          </div>
        </div>

        {/* Check Status Feedback */}
        {checkStatus && (
          <div
            className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
              checkStatus.isMaintenance
                ? 'bg-[#181B26] border border-[#2A3146] text-amber-300'
                : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
            }`}
          >
            {checkStatus.isMaintenance ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            <span>{checkStatus.text}</span>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="space-y-2.5 pt-2 pb-3">
        {/* 1. Official Community Link Button */}
        <button
          onClick={() => openTelegramLink('https://t.me/treasure_hunt12')}
          style={{
            background: 'linear-gradient(180deg, #F59E0B 0%, #D97706 100%)',
            borderTop: '1.5px solid #FDE68A',
            borderBottom: '3.5px solid #92400E',
            boxShadow: '0 8px 25px rgba(245, 158, 11, 0.35)'
          }}
          className="w-full py-3.5 rounded-2xl font-black text-sm text-black flex items-center justify-center space-x-2 active:scale-[0.98] transition-all uppercase tracking-wider font-heading"
        >
          <MessageCircle size={18} strokeWidth={2.5} />
          <span>Join Official Community</span>
        </button>

        {/* 2. Official Channel Link Button */}
        <button
          onClick={() => openTelegramLink('https://t.me/treasure_hunt_12')}
          className="w-full py-3 rounded-2xl font-bold text-xs text-white bg-[#121624] hover:bg-[#1A2033] border border-[#222C42] flex items-center justify-center space-x-2 active:scale-[0.98] transition-all uppercase tracking-wide"
        >
          <Radio size={15} className="text-cyan-400" />
          <span>Official Announcement Channel</span>
        </button>

        {/* 3. Check Status Button */}
        <button
          onClick={() => handleCheckStatus(true)}
          disabled={checking}
          className="w-full py-2.5 rounded-xl font-bold text-xs text-gray-400 hover:text-white flex items-center justify-center space-x-1.5 active:scale-95 transition-all"
        >
          <RefreshCw size={13} className={checking ? 'animate-spin text-yellow-400' : ''} />
          <span>{checking ? 'Checking Status...' : 'Check Status Now'}</span>
        </button>
      </div>
    </div>
  );
}
