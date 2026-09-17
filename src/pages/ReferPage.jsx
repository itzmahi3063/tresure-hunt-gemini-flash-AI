import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Gift,
  Copy,
  Share2,
  CheckCircle2,
  Trophy,
  Flame,
  Calendar,
  Sparkles,
  TrendingUp,
  Award,
  Crown,
  Medal,
  Clock
} from 'lucide-react';
import api from '../services/api';
import { triggerHaptic, openTelegramLink } from '../services/telegram';

export default function ReferPage() {
  const { user } = useApp();
  const [refData, setRefData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Leaderboard states
  const [activeBoardTab, setActiveBoardTab] = useState('top_referrals'); // 'top_referrals' | 'today' | 'top_earners'
  const [leaderboards, setLeaderboards] = useState({
    topReferrers: [],
    todayReferrers: [],
    topEarners: []
  });
  const [weeklyContest, setWeeklyContest] = useState(null);
  const [contestTimer, setContestTimer] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    loadReferralData();
    loadLeaderboards();
    loadWeeklyContest();

    // Check if URL has #weekly-contest
    if (window.location.hash === '#weekly-contest') {
      setTimeout(() => {
        const el = document.getElementById('weekly-contest');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }, []);

  const loadReferralData = async () => {
    try {
      const res = await api.get('/referrals');
      if (res.data.success) {
        setRefData(res.data);
      }
    } catch (err) {
      console.error('Error fetching referral data:', err);
    }
  };

  const loadLeaderboards = async () => {
    try {
      const res = await api.get('/referral/leaderboard');
      if (res.data.success) {
        setLeaderboards({
          topReferrers: res.data.topReferrers || [],
          todayReferrers: res.data.todayReferrers || [],
          topEarners: res.data.topEarners || []
        });
      }
    } catch (err) {
      console.warn('Failed to load leaderboards:', err);
    }
  };

  const loadWeeklyContest = async () => {
    try {
      const res = await api.get('/referral/weekly-contest');
      if (res.data.success && res.data.contest) {
        setWeeklyContest(res.data.contest);
      }
    } catch (err) {
      console.warn('Failed to load weekly contest:', err);
    }
  };

  // Live countdown timer for weekly contest (7-day cycle)
  useEffect(() => {
    if (!weeklyContest?.end_time) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const endTime = new Date(weeklyContest.end_time).getTime();
      const diff = Math.max(0, endTime - now);

      if (diff <= 0) {
        setContestTimer({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setContestTimer({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, [weeklyContest]);

  const referralLink = refData?.referralLink || `https://t.me/TreasureHunt_bot?start=ref_${user?.id || '5697990319'}`;
  const totalRefers = refData?.totalReferrals || user?.total_referrals || 0;
  const earningsDiamonds = refData?.referralEarningsDiamonds || user?.referral_earnings_diamonds || 0;
  const earningsUsd = refData?.referralEarningsUsd || (earningsDiamonds * 0.00004).toFixed(4);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    triggerHaptic('notification', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareNow = () => {
    triggerHaptic('impact', 'medium');
    const shareText = encodeURIComponent(
      `💎 Join Treasure Hunt on Telegram! Open daily chests, earn Diamonds & withdraw real USDT!\n\nJoin here: ${referralLink}`
    );
    openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${shareText}`);
  };

  const currentList =
    activeBoardTab === 'top_referrals'
      ? leaderboards.topReferrers
      : activeBoardTab === 'today'
      ? leaderboards.todayReferrers
      : leaderboards.topEarners;

  return (
    <div className="min-h-screen pb-36 pt-3 px-4 max-w-md mx-auto space-y-4 font-sans">
      {/* Title */}
      <div>
        <h2 className="text-xl font-black text-white tracking-wide font-heading">
          Referral Program
        </h2>
        <p className="text-xs text-[#9E9EB2]">Invite your friends and earn lifetime income</p>
      </div>

      {/* 1. Top Two 3D Stats Boxes */}
      <div className="grid grid-cols-2 gap-3">
        <div className="box-3d p-4">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total referrals</span>
          <div className="text-2xl font-black text-cyan-400 font-numbers mt-1">
            {totalRefers}
          </div>
        </div>

        <div className="box-3d p-4">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Referral earnings</span>
          <div className="text-2xl font-black text-emerald-400 font-numbers mt-1 flex items-baseline space-x-1">
            <span>{earningsDiamonds.toLocaleString()}</span>
            <span className="text-xs text-cyan-400 font-bold">💎</span>
          </div>
          <div className="text-[11px] text-gray-400 font-numbers mt-0.5">
            ≈ ${earningsUsd} USD
          </div>
        </div>
      </div>

      {/* 2. 3D Withdrawal Commission Box (10%) */}
      <div className="box-3d-cyan p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1 max-w-[65%]">
            <div className="flex items-center space-x-1.5 text-xs font-black text-cyan-300 uppercase tracking-wide font-heading">
              <span>💰</span>
              <span>Withdrawal commission</span>
            </div>
            <p className="text-[11px] text-gray-300 leading-tight font-medium">
              10% of every withdrawal your referrals make — for as long as they keep withdrawing.
            </p>
          </div>

          <div className="text-right">
            <div className="text-lg font-black text-cyan-400 font-numbers">
              {(earningsDiamonds * 0.25).toFixed(0)} 💎
            </div>
            <div className="text-[10px] text-gray-400 font-numbers">
              ≈ ${((earningsDiamonds * 0.25) * 0.00004).toFixed(4)} USD
            </div>
          </div>
        </div>
      </div>

      {/* 3. 3D How the bonus works Box */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-xs font-black text-cyan-400 uppercase tracking-wider font-heading">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>How the bonus works</span>
        </div>

        <div className="box-3d p-4 space-y-3.5">
          {/* Step 1 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl btn-3d-dark flex items-center justify-center text-xs font-black text-purple-300 font-numbers">
                1
              </div>
              <span className="text-xs font-semibold text-gray-200">
                Friend joins channel + community and verifies
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="badge-3d text-xs font-black text-cyan-400 font-numbers px-2 py-1 inline-block">
                +30 💎
              </span>
              <div className="text-[9px] text-gray-500 font-numbers mt-0.5">= $0.0012</div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl btn-3d-dark flex items-center justify-center text-xs font-black text-purple-300 font-numbers">
                2
              </div>
              <span className="text-xs font-semibold text-gray-200">
                Friend completes 5 tasks
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="badge-3d text-xs font-black text-cyan-400 font-numbers px-2 py-1 inline-block">
                +100 💎
              </span>
              <div className="text-[9px] text-gray-500 font-numbers mt-0.5">= $0.0040</div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl btn-3d-dark flex items-center justify-center text-xs font-black text-purple-300 font-numbers">
                3
              </div>
              <span className="text-xs font-semibold text-gray-200">
                Friend watches 20 ads
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="badge-3d text-xs font-black text-cyan-400 font-numbers px-2 py-1 inline-block">
                +180 💎
              </span>
              <div className="text-[9px] text-gray-500 font-numbers mt-0.5">= $0.0072</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. 3D Referral Bonus & Share Box */}
      <div className="box-3d p-5 space-y-4">
        <div className="text-center space-y-1">
          <span className="text-[10px] uppercase font-black text-cyan-400 tracking-widest font-heading">
            TOTAL BONUS PER FRIEND
          </span>
          <div className="text-3xl font-black text-emerald-400 font-numbers">
            400 <span className="text-cyan-300 text-lg">💎</span>
          </div>
          <div className="text-xs text-gray-400 font-numbers">
            ≈ $0.0160 USD
          </div>
          <div className="badge-3d inline-flex items-center space-x-1 text-[11px] text-yellow-400 font-bold px-3 py-1 mt-1 font-numbers">
            <span>💰 + 10% of everything they withdraw, forever</span>
          </div>
        </div>

        {/* Link input */}
        <div className="bg-[#0A0A12] border border-[#2B2B3D] rounded-2xl p-3 flex items-center justify-between">
          <span className="text-xs text-gray-300 font-mono truncate max-w-[240px]">
            {referralLink}
          </span>
          <button
            onClick={handleCopyLink}
            className="p-1.5 text-gray-400 hover:text-white bg-[#191928] rounded-lg active:scale-90 transition-all"
          >
            {copied ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
          </button>
        </div>

        {/* 3D Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleShareNow}
            className="btn-3d-cyan py-3.5 rounded-2xl flex items-center justify-center space-x-2 text-xs uppercase tracking-wider font-heading"
          >
            <Share2 size={15} />
            <span>Share Now</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="btn-3d-dark py-3.5 rounded-2xl flex items-center justify-center space-x-2 text-xs uppercase tracking-wider font-heading"
          >
            <Copy size={15} />
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          5. WEEKLY REFER CONTEST SECTION (7-Day Timer & Top 5 Trophies)
          ======================================================== */}
      <div id="weekly-contest" className="space-y-3 pt-2">
        <div className="box-3d-gold p-4 relative overflow-hidden border-2 border-yellow-500/50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-yellow-500/20 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl btn-3d-gold flex items-center justify-center text-xl shadow-gold-glow">
                🏆
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-black text-yellow-400 uppercase tracking-wide font-heading">
                    Weekly Refer Contest
                  </h3>
                  <span className="text-[9px] bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 px-2 py-0.5 rounded-full font-numbers font-black">
                    ROUND {weeklyContest?.round || 1}
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 font-medium">Top 5 Referrers Win Big Rewards!</p>
              </div>
            </div>
          </div>

          {/* 7-Day Live Countdown Timer Box */}
          <div className="my-3 bg-[#0A0A10] border border-yellow-500/30 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-black text-gray-300">
              <Clock size={16} className="text-yellow-400 animate-pulse" />
              <span>Contest Ends In:</span>
            </div>

            <div className="flex items-center space-x-1.5 font-numbers text-center">
              <div className="bg-[#181824] px-2 py-1 rounded-lg border border-yellow-500/40">
                <span className="text-xs font-black text-yellow-400 block">{contestTimer.days}d</span>
              </div>
              <span className="text-yellow-500 font-bold">:</span>
              <div className="bg-[#181824] px-2 py-1 rounded-lg border border-yellow-500/40">
                <span className="text-xs font-black text-yellow-400 block">{String(contestTimer.hours).padStart(2, '0')}h</span>
              </div>
              <span className="text-yellow-500 font-bold">:</span>
              <div className="bg-[#181824] px-2 py-1 rounded-lg border border-yellow-500/40">
                <span className="text-xs font-black text-yellow-400 block">{String(contestTimer.minutes).padStart(2, '0')}m</span>
              </div>
              <span className="text-yellow-500 font-bold">:</span>
              <div className="bg-[#181824] px-2 py-1 rounded-lg border border-yellow-500/40">
                <span className="text-xs font-black text-yellow-400 block">{String(contestTimer.seconds).padStart(2, '0')}s</span>
              </div>
            </div>
          </div>

          {/* Min 10 Referrals Qualification Requirement Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 flex items-center space-x-2 text-[11px] text-amber-300 font-medium mb-3">
            <span>⭐</span>
            <span>Only hunters with <strong>minimum 10 referrals</strong> qualify for the Top 5 Contest leaderboard!</span>
          </div>

          {/* Top 5 Contest Standings Showcase */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-heading">
              Current Top Contestants (Min 10 Referrals)
            </h4>

            {(!weeklyContest?.standings || weeklyContest.standings.length === 0) ? (
              <div className="text-center py-6 bg-[#0E0E16] rounded-2xl border border-[#252538]">
                <p className="text-xs text-gray-400 font-medium">
                  No one has reached 10 referrals yet this week!
                </p>
                <p className="text-[11px] text-yellow-400 font-bold mt-1">
                  Be the first to invite 10 friends and take the 🥇 1st Place Trophy!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {weeklyContest.standings.map((c, idx) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                      idx === 0
                        ? 'bg-gradient-to-r from-[#2B2308] to-[#171306] border-yellow-400/60 shadow-gold-glow'
                        : idx === 1
                        ? 'bg-[#181C26] border-slate-400/50'
                        : idx === 2
                        ? 'bg-[#221714] border-amber-600/50'
                        : 'bg-[#12121A] border-[#2B2B3D]'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Rank & Trophy Badge */}
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center font-numbers font-black text-sm shrink-0">
                        {c.trophy ? (
                          <span className="text-lg drop-shadow">{c.trophy}</span>
                        ) : (
                          <span className="text-gray-400">#{c.rank}</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-[#1F1F2E] border border-yellow-500/40 flex items-center justify-center text-xs font-black text-yellow-300 font-numbers shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>

                      {/* User details */}
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h5 className="text-xs font-black text-white truncate font-heading">
                            {c.name}
                          </h5>
                          {idx < 5 && (
                            <span className="text-[10px] text-yellow-400 font-black">★</span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 font-mono truncate">
                          @{c.username} · ID {c.id}
                        </p>
                      </div>
                    </div>

                    {/* Referrals Count Badge */}
                    <div className="text-right shrink-0">
                      <span className="badge-3d text-xs font-black text-yellow-400 font-numbers px-2.5 py-1">
                        {c.referrals} REF
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          6. REFERRAL BOARD (LEADERBOARD) - 3 Filter Tabs (Top 10)
          ======================================================== */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-black text-cyan-400 uppercase tracking-wider font-heading">
            <TrendingUp size={16} />
            <span>Referral Board</span>
          </div>
          <span className="text-[10px] text-gray-400 font-numbers font-bold">TOP 10 HUNTERS</span>
        </div>

        {/* 3 Filter Buttons */}
        <div className="grid grid-cols-3 gap-1.5 bg-[#0A0A10] p-1.5 rounded-2xl border border-[#232334]">
          <button
            onClick={() => {
              triggerHaptic('selection');
              setActiveBoardTab('top_referrals');
            }}
            className={`py-2 text-[11px] font-black rounded-xl uppercase transition-all tracking-tight font-heading ${
              activeBoardTab === 'top_referrals'
                ? 'btn-3d-gold text-black'
                : 'text-gray-400 hover:text-white bg-[#14141E]'
            }`}
          >
            Top Referrals
          </button>

          <button
            onClick={() => {
              triggerHaptic('selection');
              setActiveBoardTab('today');
            }}
            className={`py-2 text-[11px] font-black rounded-xl uppercase transition-all tracking-tight font-heading ${
              activeBoardTab === 'today'
                ? 'btn-3d-gold text-black'
                : 'text-gray-400 hover:text-white bg-[#14141E]'
            }`}
          >
            Today
          </button>

          <button
            onClick={() => {
              triggerHaptic('selection');
              setActiveBoardTab('top_earners');
            }}
            className={`py-2 text-[11px] font-black rounded-xl uppercase transition-all tracking-tight font-heading ${
              activeBoardTab === 'top_earners'
                ? 'btn-3d-gold text-black'
                : 'text-gray-400 hover:text-white bg-[#14141E]'
            }`}
          >
            Top Earners
          </button>
        </div>

        {/* Leaderboard Entries List (Top 10) */}
        <div className="box-3d p-3 space-y-2">
          {currentList.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">No data in leaderboard yet</p>
          ) : (
            currentList.map((item) => (
              <div
                key={item.id}
                className="bg-[#12121A] border border-[#252538] p-2.5 rounded-xl flex items-center justify-between hover:border-yellow-500/30 transition-all"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  {/* Rank Badge */}
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black font-numbers shrink-0 ${
                    item.rank === 1 ? 'bg-yellow-400 text-black shadow-gold-glow' :
                    item.rank === 2 ? 'bg-slate-300 text-black' :
                    item.rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-[#1F1F2E] text-gray-400'
                  }`}>
                    {item.rank}
                  </div>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-[#1C1C28] border border-gray-700 flex items-center justify-center text-xs font-black text-cyan-300 font-numbers shrink-0">
                    {item.name.charAt(0).toUpperCase()}
                  </div>

                  {/* User info */}
                  <div className="min-w-0">
                    <h5 className="text-xs font-black text-white truncate font-heading">
                      {item.name}
                    </h5>
                    <p className="text-[10px] text-gray-400 font-mono truncate">
                      @{item.username} · ID {item.id}
                    </p>
                  </div>
                </div>

                {/* Score badge */}
                <div className="text-right shrink-0">
                  {activeBoardTab === 'top_earners' ? (
                    <div>
                      <span className="text-xs font-black text-emerald-400 font-numbers">
                        {(item.earnings || 0).toLocaleString()} 💎
                      </span>
                      <div className="text-[9px] text-gray-500 font-numbers">
                        {item.count || 0} Refers
                      </div>
                    </div>
                  ) : (
                    <span className="badge-3d text-xs font-black text-cyan-400 font-numbers px-2.5 py-1">
                      {item.count || 0} REF
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

