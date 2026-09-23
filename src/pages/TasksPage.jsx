import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ExternalLink,
  CheckCircle2,
  Check,
  ChevronRight,
  Info,
  Gem,
  PlusCircle,
  Clock,
  Trash2,
  CreditCard,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Edit3,
  Rocket,
  Wallet,
  RefreshCw,
  Loader2
} from 'lucide-react';
import api from '../services/api';
import { openExternalLink, openTelegramLink, triggerHaptic } from '../services/telegram';
import { showAdForNetwork } from '../services/ads';
import CreateExclusiveTaskModal from '../components/CreateExclusiveTaskModal';
import TaskPaymentModal from '../components/TaskPaymentModal';
import BoostTaskModal from '../components/BoostTaskModal';

export default function TasksPage() {
  const {
    user,
    setUser,
    setContactAdminModalOpen,
    openWallet,
    connectedTonWallet,
    disconnectTonWallet,
    setIsTonConnectModalOpen
  } = useApp();
  const [activeCategory, setActiveCategory] = useState('daily');
  const [exclusiveSubTab, setExclusiveSubTab] = useState('all'); // 'all' | 'my'
  const [tasks, setTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [visitedTasks, setVisitedTasks] = useState({});
  const [ads, setAds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(sessionStorage.getItem('treasure_tasks_daily_cache') || '[]');
    } catch (e) {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [loadingCategory, setLoadingCategory] = useState({
    daily: false,
    social: false,
    partner: false,
    exclusive: false
  });
  const [verifyingTaskId, setVerifyingTaskId] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  // 20-second cooldown timer between consecutive ad watches
  const [adCooldownSeconds, setAdCooldownSeconds] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem('treasure_ad_cooldown_until');
    if (!stored) return 0;
    const remaining = Math.ceil((Number(stored) - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  });

  useEffect(() => {
    if (adCooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      const stored = localStorage.getItem('treasure_ad_cooldown_until');
      if (stored) {
        const remaining = Math.ceil((Number(stored) - Date.now()) / 1000);
        if (remaining > 0) {
          setAdCooldownSeconds(remaining);
        } else {
          setAdCooldownSeconds(0);
          localStorage.removeItem('treasure_ad_cooldown_until');
        }
      } else {
        setAdCooldownSeconds((prev) => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [adCooldownSeconds]);

  // Modals for Exclusive Task Creation, Editing, Payment & Boosting
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalTask, setEditModalTask] = useState(null);
  const [paymentModalTask, setPaymentModalTask] = useState(null);
  const [boostModalTask, setBoostModalTask] = useState(null);

  const handlePayNowClick = (taskItem) => {
    triggerHaptic('impact', 'light');
    setPaymentModalTask(taskItem);
  };

  const [tasksCache, setTasksCache] = useState(() => {
    let saved = { daily: [], social: [], exclusive: [], partner: [] };
    if (typeof window !== 'undefined') {
      try {
        const d = JSON.parse(sessionStorage.getItem('treasure_tasks_daily_cache') || '[]');
        const s = JSON.parse(sessionStorage.getItem('treasure_tasks_social_cache') || '[]');
        const e = JSON.parse(sessionStorage.getItem('treasure_tasks_exclusive_cache') || '[]');
        const p = JSON.parse(sessionStorage.getItem('treasure_tasks_partner_cache') || '[]');
        saved = { daily: d, social: s, exclusive: e, partner: p };
      } catch (err) {}
    }
    return saved;
  });

  // Preload all categories in 1 parallel bundle for instant zero-lag tab switching
  useEffect(() => {
    preloadAllCategories();
  }, []);

  const preloadAllCategories = async () => {
    try {
      const [tasksRes, adsRes, myRes] = await Promise.all([
        api.get('/tasks').catch(() => ({ data: { success: false } })),
        api.get('/ads').catch(() => ({ data: { success: false } })),
        api.get('/tasks/my').catch(() => ({ data: { success: false } }))
      ]);

      const allTasks = tasksRes.data?.tasks || [];
      const adsList = adsRes.data?.ads || [];

      const newCache = {
        daily: adsList,
        social: allTasks.filter(t => t.category === 'social'),
        exclusive: allTasks.filter(t => t.category === 'exclusive'),
        partner: allTasks.filter(t => t.category === 'partner')
      };
      setTasksCache(newCache);

      try {
        sessionStorage.setItem('treasure_tasks_daily_cache', JSON.stringify(newCache.daily));
        sessionStorage.setItem('treasure_tasks_social_cache', JSON.stringify(newCache.social));
        sessionStorage.setItem('treasure_tasks_exclusive_cache', JSON.stringify(newCache.exclusive));
        sessionStorage.setItem('treasure_tasks_partner_cache', JSON.stringify(newCache.partner));
      } catch (err) {}

      if (myRes.data?.tasks) setMyTasks(myRes.data.tasks);

      // Display currently active tab from fresh fetch
      if (activeCategory === 'daily' && adsList.length) {
        setAds(adsList);
      } else if (newCache[activeCategory]?.length) {
        setTasks(newCache[activeCategory]);
      }
    } catch (e) {
      console.warn('Preload tasks notice:', e);
    }
  };

  useEffect(() => {
    loadTasksAndAds();
  }, [activeCategory, exclusiveSubTab]);

  const loadTasksAndAds = async () => {
    // Instant switch from cache (0ms delay)
    if (activeCategory === 'daily') {
      if (tasksCache.daily?.length > 0) setAds(tasksCache.daily);
    } else if (tasksCache[activeCategory]?.length > 0) {
      setTasks(tasksCache[activeCategory]);
    }

    try {
      if (activeCategory === 'daily') {
        const res = await api.get('/ads');
        if (res.data.success) {
          const fetchedAds = res.data.ads || [];
          setAds(fetchedAds);
          setTasksCache(prev => ({ ...prev, daily: fetchedAds }));
          try {
            sessionStorage.setItem('treasure_tasks_daily_cache', JSON.stringify(fetchedAds));
          } catch (err) {}
        }
      } else if (activeCategory === 'exclusive') {
        const [tasksRes, myRes] = await Promise.all([
          api.get('/tasks?category=exclusive'),
          api.get('/tasks/my')
        ]);
        if (tasksRes.data.success) {
          const fetchedTasks = tasksRes.data.tasks || [];
          setTasks(fetchedTasks);
          setTasksCache(prev => ({ ...prev, exclusive: fetchedTasks }));
          try {
            sessionStorage.setItem('treasure_tasks_exclusive_cache', JSON.stringify(fetchedTasks));
          } catch (err) {}
        }
        if (myRes.data.success) setMyTasks(myRes.data.tasks || []);
      } else {
        const res = await api.get(`/tasks?category=${activeCategory}`);
        if (res.data.success) {
          const fetchedTasks = res.data.tasks || [];
          setTasks(fetchedTasks);
          setTasksCache(prev => ({ ...prev, [activeCategory]: fetchedTasks }));
          try {
            sessionStorage.setItem(`treasure_tasks_${activeCategory}_cache`, JSON.stringify(fetchedTasks));
          } catch (err) {}
        }
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  const handleWatchAd = async (ad, e) => {
    if (e) {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.nativeEvent?.stopImmediatePropagation?.();
    }
    if (user?.device_conflict) {
      setStatusMessage({ type: 'error', text: 'Your account has been suspended' });
      triggerHaptic('notification', 'error');
      if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert('Your account has been suspended');
      } else {
        alert('Your account has been suspended');
      }
      return;
    }

    if (adCooldownSeconds > 0) {
      setStatusMessage({ type: 'info', text: `Please wait ${adCooldownSeconds}s before watching the next ad.` });
      triggerHaptic('notification', 'warning');
      return;
    }

    const watched = ad.watched_today || 0;
    const max = ad.max_daily || 10;
    if (watched >= max || ad.is_completed_today) return;

    setLoading(true);
    triggerHaptic('impact', 'medium');
    setStatusMessage({ type: 'info', text: `Loading ${ad.name} ad... please watch until the end.` });

    try {
      // Real ad SDK call (Adsgram or Monetag, by ad.network_id) — this also
      // enforces the 5-second minimum watch time before resolving.
      const { watchStartedAt } = await showAdForNetwork(ad, (statusText) => {
        if (statusText) {
          setStatusMessage({ type: 'info', text: statusText });
        }
      });

      const res = await api.post('/ads/watch', { adId: ad.id, watchStartedAt });
      if (res.data.success) {
        setUser(res.data.user);
        setStatusMessage({
          type: 'success',
          text: `🎉 You earned +${res.data.rewardDiamonds} GEMS for watching ${ad.name}!`
        });
        loadTasksAndAds();
        triggerHaptic('notification', 'success');

        // Start 20-second cooldown across all ad buttons
        const cooldownUntil = Date.now() + 20 * 1000;
        localStorage.setItem('treasure_ad_cooldown_until', String(cooldownUntil));
        setAdCooldownSeconds(20);
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.error || err.message || 'Ad verification failed' });
      triggerHaptic('notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskAction = async (task) => {
    if (user?.device_conflict) {
      setStatusMessage({ type: 'error', text: 'Your account has been suspended' });
      triggerHaptic('notification', 'error');
      if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert('Your account has been suspended');
      } else {
        alert('Your account has been suspended');
      }
      return;
    }

    if (task.is_completed) return;

    // Step 1: If not visited yet, open link and switch button to Verify
    if (!visitedTasks[task.id]) {
      if (task.link.includes('t.me/')) {
        openTelegramLink(task.link);
      } else {
        openExternalLink(task.link);
      }
      setVisitedTasks(prev => ({ ...prev, [task.id]: true }));
      triggerHaptic('impact', 'medium');
      setStatusMessage({
        type: 'info',
        text: `Link opened! Return here and tap "Verify" to claim +${task.reward_diamonds} GEMS.`
      });
      return;
    }

    // Step 2: User tapped Verify
    setVerifyingTaskId(task.id);
    setStatusMessage({ type: 'info', text: 'Verifying completion with secure vault...' });
    triggerHaptic('impact', 'light');

    setTimeout(async () => {
      try {
        const res = await api.post('/tasks/complete', { taskId: task.id });
        if (res.data.success) {
          setUser(res.data.user);
          setStatusMessage({
            type: 'success',
            text: `🎉 Bounty claimed! +${res.data.reward} GEMS added to your balance!`
          });
          loadTasksAndAds();
          triggerHaptic('notification', 'success');
        }
      } catch (err) {
        setStatusMessage({
          type: 'error',
          text: err.response?.data?.error || 'Verification failed. Please ensure you joined or completed the action!'
        });
        triggerHaptic('notification', 'error');
      } finally {
        setVerifyingTaskId(null);
      }
    }, 1500);
  };

  const handleQuickCancelTask = (taskId) => {
    const doDelete = async () => {
      triggerHaptic('impact', 'medium');
      try {
        const res = await api.post('/tasks/exclusive/cancel', { taskId });
        if (res.data.success) {
          setStatusMessage({ type: 'info', text: 'Campaign post draft deleted successfully.' });
          loadTasksAndAds();
          triggerHaptic('notification', 'success');
        }
      } catch (err) {
        setStatusMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete post draft' });
        triggerHaptic('notification', 'error');
      }
    };

    if (window.Telegram?.WebApp?.showConfirm) {
      window.Telegram.WebApp.showConfirm('Are you sure you want to delete this unpaid post draft?', (confirmed) => {
        if (confirmed) {
          doDelete();
        }
      });
    } else if (window.confirm('Are you sure you want to delete this unpaid post draft?')) {
      doDelete();
    }
  };

  return (
    <div className="min-h-screen pb-32 pt-2 px-4 max-w-md mx-auto space-y-3.5 font-sans select-none">
      {/* Top Title & Total Badge with Crisp Diamond SVG Icon */}
      <div className="flex justify-between items-center pt-1">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide">Tasks & Quests</h2>
          <p className="text-xs text-[#a89782] mt-0.5">Complete quests & claim your treasure bounties</p>
        </div>

        {/* 3D Top Diamonds Pill */}
        <div
          style={{
            backgroundColor: '#2b1c10',
            borderTop: '1.5px solid #664b2d',
            borderLeft: '1px solid #4a341f',
            borderRight: '1px solid #4a341f',
            borderBottom: '3px solid #140d06',
            boxShadow: '0 4px 10px rgba(0,0,0,0.6)'
          }}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-2xl"
        >
          <Gem size={17} className="text-cyan-400 drop-shadow-[0_0_6px_rgba(0,229,255,0.6)]" />
          <span className="text-sm font-black text-[#f7bf46] font-mono">
            {user?.diamonds?.toLocaleString() || '14,063'}
          </span>
        </div>
      </div>

      {/* 4 Category Tabs Container with Glowing Dots */}
      <div
        style={{
          backgroundColor: '#1d130a',
          borderTop: '1px solid #422915',
          borderBottom: '3px solid #0f0a05',
          boxShadow: '0 6px 14px rgba(0,0,0,0.7)'
        }}
        className="flex p-1.5 rounded-2xl justify-between border-x border-[#382413]"
      >
        {[
          { id: 'daily', label: 'Daily' },
          { id: 'social', label: 'Social' },
          { id: 'exclusive', label: 'Exclusive' },
          { id: 'partner', label: 'Partner' }
        ].map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                triggerHaptic('selection');
                setActiveCategory(cat.id);
                setStatusMessage(null);
                if (cat.id === 'daily') {
                  if (tasksCache.daily?.length > 0) setAds(tasksCache.daily);
                } else if (tasksCache[cat.id]?.length > 0) {
                  setTasks(tasksCache[cat.id]);
                }
              }}
              style={
                isActive
                  ? {
                      background: 'linear-gradient(180deg, #57371a 0%, #3a2512 100%)',
                      borderTop: '1px solid #825429',
                      borderBottom: '2.5px solid #1c1007',
                      color: '#f7bf46',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                    }
                  : {
                      color: '#a89782'
                    }
              }
              className="flex-1 py-2 px-2 text-xs font-black rounded-xl transition-all flex items-center justify-center space-x-1.5 active:scale-95"
            >
              <span>{cat.label}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#f7bf46] shadow-[0_0_6px_#f7bf46]' : 'bg-[#5c4026]'}`} />
            </button>
          );
        })}
      </div>

      {/* Suspended Account Banner */}
      {user?.device_conflict && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border-2 border-rose-500/60 text-center space-y-1 shadow-lg shadow-rose-950/50 animate-pulse">
          <p className="text-sm font-black text-rose-400 font-heading tracking-wide">
            ⛔ YOUR ACCOUNT HAS BEEN SUSPENDED
          </p>
          <p className="text-xs text-gray-300">
            Multiple accounts detected on this device. Tasks, ads, and rewards are disabled for this account.
          </p>
        </div>
      )}

      {/* Status Message */}
      {statusMessage && (
        <div className={`p-3 rounded-2xl text-xs flex items-center space-x-2 animate-fadeIn ${
          statusMessage.type === 'success'
            ? 'bg-[#18291b] border border-[#2b5432] text-emerald-300'
            : statusMessage.type === 'error'
            ? 'bg-[#2b1616] border border-[#542828] text-rose-300'
            : 'bg-[#16232b] border border-[#244254] text-cyan-300'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <Info size={16} />}
          <span className="font-semibold">{statusMessage.text}</span>
        </div>
      )}

      {/* 1. DAILY ADS SECTION */}
      {activeCategory === 'daily' && (
        <div className="space-y-3.5 pt-1">
          <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-wider text-[#8a7966]">
            <span>WATCH & EARN</span>
            <div className="h-[1px] bg-[#3d2918] flex-1" />
          </div>

          {loadingCategory.daily ? (
            <div className="space-y-3 pt-2">
              <div
                style={{
                  background: 'linear-gradient(180deg, #322113 0%, #26170c 100%)',
                  borderTop: '2px solid #664b2d',
                  borderLeft: '1.5px solid #4a341f',
                  borderRight: '1.5px solid #4a341f',
                  borderBottom: '5px solid #140d06',
                  boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.8)'
                }}
                className="rounded-[28px] p-6 text-center space-y-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#1a1108] border border-[#4a341f] flex items-center justify-center mx-auto shadow-inner text-[#f7bf46]">
                  <RefreshCw className="spin-smooth" size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider font-heading">
                    Loading Daily Ad Slots... Please Wait
                  </h4>
                  <p className="text-xs text-[#a89782]">
                    Syncing your daily watch limits and reward slots...
                  </p>
                </div>
                <div className="w-36 h-1.5 bg-[#140d06] rounded-full mx-auto overflow-hidden border border-[#3d2918]">
                  <div className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 rounded-full animate-pulse w-full" />
                </div>
              </div>

              {/* 3 Animated Skeleton Slots while loading */}
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    background: 'linear-gradient(180deg, #26180d 0%, #1c1108 100%)',
                    border: '1px solid #3d2918'
                  }}
                  className="rounded-[24px] p-4 flex items-center justify-between opacity-50 animate-pulse"
                >
                  <div className="flex items-center space-x-3.5 flex-1">
                    <div className="w-[52px] h-[52px] rounded-[18px] bg-[#140d06] border border-[#2e1d0f]" />
                    <div className="space-y-2 flex-1 pr-4">
                      <div className="h-4 bg-[#3d2918] rounded-md w-3/4" />
                      <div className="h-2.5 bg-[#2a1b0e] rounded-md w-1/2" />
                    </div>
                  </div>
                  <div className="w-20 h-9 rounded-[18px] bg-[#3d2918]" />
                </div>
              ))}
            </div>
          ) : ads.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-[28px] bg-[#20140a] border border-[#3d2918] space-y-2">
              <Sparkles size={28} className="mx-auto text-[#f7bf46]" />
              <p className="text-xs text-white font-bold">No daily ad slots available right now.</p>
              <p className="text-[11px] text-[#a89782]">Please check back in a little while!</p>
            </div>
          ) : (
            ads.map((ad) => {
            const watched = ad.watched_today || 0;
            const max = ad.max_daily || 10;
            const percentage = Math.min(100, Math.round((watched / max) * 100));
            const isFinished = watched >= max;

            return (
              <div
                key={ad.id}
                style={{
                  background: 'linear-gradient(180deg, #322113 0%, #26170c 100%)',
                  borderTop: '2px solid #664b2d',
                  borderLeft: '1.5px solid #4a341f',
                  borderRight: '1.5px solid #4a341f',
                  borderBottom: '5px solid #140d06',
                  boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 230, 180, 0.15)'
                }}
                className="rounded-[28px] p-4 flex items-center justify-between relative transition-transform"
              >
                <div className="flex items-center space-x-3.5 flex-1 pr-3">
                  {ad.logo_url ? (
                    <div
                      style={{
                        borderTop: '1.5px solid rgba(255,255,255,0.25)',
                        borderBottom: '3.5px solid rgba(0,0,0,0.5)',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.4)'
                      }}
                      className="w-[58px] h-[58px] rounded-[18px] shrink-0 relative overflow-hidden bg-[#1a1108]"
                    >
                      <img
                        src={ad.logo_url}
                        alt={ad.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    </div>
                  ) : (
                    <div
                      style={{
                        background: 'linear-gradient(180deg, #ffb74d 0%, #ffa726 60%, #e65100 100%)',
                        borderTop: '1.5px solid #ffe082',
                        borderBottom: '3.5px solid #8c2d00'
                      }}
                      className="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center shadow-md shrink-0"
                    >
                      <Gem className="text-white" size={26} />
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <h4 className="text-[15px] font-black text-white tracking-wide leading-tight drop-shadow-sm">
                      {ad.name}
                    </h4>

                    <p className="text-[12px] text-[#a89782] leading-tight font-medium">
                      Watch {ad.name} ad
                    </p>

                    <div className="py-1">
                      <div
                        style={{
                          backgroundColor: '#0f0803',
                          border: '1px solid #4a321d',
                          borderTop: '1.5px solid #000000',
                          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.95), 0 1px 2px rgba(255,255,255,0.08)'
                        }}
                        className="w-full h-[8px] rounded-full overflow-hidden p-[1px] relative flex items-center"
                      >
                        <div
                          style={{
                            width: `${percentage}%`,
                            background: 'linear-gradient(90deg, #f59e0b 0%, #ffd700 60%, #fff2a8 100%)',
                            boxShadow: '0 0 14px rgba(255, 215, 0, 0.9), inset 0 1px 1px rgba(255, 255, 255, 0.8)'
                          }}
                          className="h-full rounded-full transition-all duration-400 relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
                        </div>
                      </div>
                    </div>

                    <p className="text-[12px] text-[#a89782] leading-tight font-sans font-medium">
                      {watched} of {max} done
                    </p>

                    <div className="flex items-center space-x-1.5 pt-0.5">
                      <Gem size={14} className="text-cyan-400 drop-shadow-[0_0_6px_rgba(0,229,255,0.7)] shrink-0" />
                      <span className="text-[#f7bf46] font-black text-[13px] font-mono">
                        +{ad.reward_diamonds}
                      </span>
                      <span className="text-[#a89782] text-[12px] font-medium">· watch a clip</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => handleWatchAd(ad, e)}
                  disabled={loading || isFinished || adCooldownSeconds > 0}
                  style={
                    isFinished
                      ? {
                          backgroundColor: '#352415',
                          color: '#7a6752',
                          borderTop: '1px solid #4a3420',
                          borderBottom: '2.5px solid #1a1108'
                        }
                      : adCooldownSeconds > 0
                      ? {
                          backgroundColor: '#261b11',
                          color: '#facc15',
                          borderTop: '1.5px solid #5a3d1c',
                          borderLeft: '1px solid #3d2914',
                          borderRight: '1px solid #3d2914',
                          borderBottom: '3.5px solid #140d06',
                          boxShadow: 'inset 0 1px 1px rgba(255, 230, 180, 0.1)'
                        }
                      : {
                          background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 45%, #e8a522 100%)',
                          borderTop: '1.5px solid #fff2b8',
                          borderLeft: '1px solid #e8a522',
                          borderRight: '1px solid #e8a522',
                          borderBottom: '4px solid #7d4800',
                          color: '#1a0f02',
                          boxShadow: '0 6px 14px rgba(232, 165, 34, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
                        }
                  }
                  className="px-6 py-2.5 rounded-[20px] text-[14px] font-black tracking-wide shrink-0 transition-all active:translate-y-1 active:border-b-[1px] active:shadow-none min-w-[92px] text-center"
                >
                  {isFinished ? 'Done' : adCooldownSeconds > 0 ? `${adCooldownSeconds}s` : 'Watch'}
                </button>
              </div>
            );
          }))}
        </div>
      )}

      {/* 2. EXCLUSIVE SECTION WITH USER TASK CREATION, MY POSTS, AND AUTO-EXPIRATION */}
      {activeCategory === 'exclusive' && (
        <div className="space-y-3 pt-1">
          {/* Add Your Own Task 3D Banner */}
          <div
            onClick={() => {
              triggerHaptic('impact', 'light');
              setCreateModalOpen(true);
            }}
            style={{
              background: 'linear-gradient(180deg, #322113 0%, #26170c 100%)',
              borderTop: '2px solid #825429',
              borderLeft: '1.5px solid #4a341f',
              borderRight: '1.5px solid #4a341f',
              borderBottom: '5px solid #140d06',
              boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.8), 0 0 20px rgba(247, 191, 70, 0.1)'
            }}
            className="cursor-pointer rounded-[28px] p-4 flex items-center justify-between active:scale-98 transition-all group"
          >
            <div className="flex items-center space-x-3.5">
              <div
                style={{
                  background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 50%, #d48b11 100%)',
                  borderTop: '1px solid #fff2b8',
                  borderBottom: '2.5px solid #7a4b00',
                  boxShadow: '0 4px 10px rgba(247, 191, 70, 0.3)'
                }}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#1a0f02] font-black"
              >
                <PlusCircle size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-white group-hover:text-[#f7bf46] transition-colors">
                  Add your own task
                </h4>
                <p className="text-[11px] text-[#a89782] mt-0.5 font-medium">
                  100 Users = 0.20 TON · Max 2,000 Users
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-black text-[#f7bf46] uppercase">Create</span>
              <ChevronRight className="text-[#f7bf46]" size={18} />
            </div>
          </div>

          {/* Sub Filters: All Tasks vs My Tasks */}
          <div className="flex space-x-2 pt-1">
            <button
              onClick={() => {
                triggerHaptic('selection');
                setExclusiveSubTab('all');
              }}
              style={
                exclusiveSubTab === 'all'
                  ? {
                      background: 'linear-gradient(180deg, #57371a 0%, #3a2512 100%)',
                      borderTop: '1px solid #825429',
                      borderBottom: '2.5px solid #1c1007',
                      color: '#f7bf46'
                    }
                  : {
                      background: '#1d130a',
                      borderTop: '1px solid #382413',
                      borderBottom: '2.5px solid #0f0a05',
                      color: '#a89782'
                    }
              }
              className="px-5 py-2 rounded-2xl font-black text-xs uppercase transition-all flex items-center space-x-1.5"
            >
              <span>All tasks</span>
              <span className="text-[10px] opacity-75 font-mono">({tasks.length})</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('selection');
                setExclusiveSubTab('my');
              }}
              style={
                exclusiveSubTab === 'my'
                  ? {
                      background: 'linear-gradient(180deg, #57371a 0%, #3a2512 100%)',
                      borderTop: '1px solid #825429',
                      borderBottom: '2.5px solid #1c1007',
                      color: '#f7bf46'
                    }
                  : {
                      background: '#1d130a',
                      borderTop: '1px solid #382413',
                      borderBottom: '2.5px solid #0f0a05',
                      color: '#a89782'
                    }
              }
              className="px-5 py-2 rounded-2xl font-black text-xs uppercase transition-all flex items-center space-x-1.5"
            >
              <span>My tasks / Posts</span>
              {myTasks.length > 0 && (
                <span className="px-1.5 py-0.2 bg-[#f7bf46] text-black rounded-full text-[10px] font-mono font-black">
                  {myTasks.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-wider text-[#8a7966] pt-1">
            <span>{exclusiveSubTab === 'all' ? 'EXCLUSIVE COMMUNITY TASKS' : 'MY CAMPAIGN POSTS'}</span>
            <div className="h-[1px] bg-[#3d2918] flex-1" />
          </div>

          {/* VIEW 1: ALL TASKS (Approved & Running) */}
          {exclusiveSubTab === 'all' && (
            <>
              {tasks.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-[28px] bg-[#20140a] border border-[#3d2918] space-y-2">
                  <Sparkles size={28} className="mx-auto text-[#a89782]" />
                  <p className="text-xs text-white font-bold">No exclusive tasks available right now.</p>
                  <p className="text-[11px] text-[#a89782]">Click "+ Add your own task" above to launch your campaign!</p>
                </div>
              ) : (
                tasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      background: 'linear-gradient(180deg, #322113 0%, #26170c 100%)',
                      borderTop: '2px solid #664b2d',
                      borderLeft: '1.5px solid #4a341f',
                      borderRight: '1.5px solid #4a341f',
                      borderBottom: '5px solid #140d06',
                      boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.8)'
                    }}
                    className="rounded-[28px] p-4 flex items-center justify-between"
                  >
                    <div className="space-y-1 flex-1 pr-3">
                      <div className="flex items-center space-x-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-600/30">
                          {t.type || 'Exclusive'}
                        </span>
                        {t.max_users && (
                          <span className="text-[10px] text-[#a89782] font-mono">
                            {t.current_completed || 0}/{t.max_users} done
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-white leading-tight">{t.title}</h4>
                      <p className="text-[11px] text-[#a89782] font-medium line-clamp-1">{t.description}</p>

                      <div className="flex items-center space-x-1.5 text-xs pt-0.5">
                        <Gem size={14} className="text-cyan-400 drop-shadow-[0_0_6px_rgba(0,229,255,0.7)]" />
                        <span className="text-[#f7bf46] font-black text-[13px] font-mono">+{t.reward_diamonds}</span>
                        <span className="text-[#a89782] text-[11px]">Gems</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTaskAction(t)}
                      disabled={t.is_completed || verifyingTaskId === t.id}
                      style={
                        t.is_completed
                          ? {
                              backgroundColor: '#352415',
                              color: '#7a6752',
                              borderBottom: '2px solid #1a1108'
                            }
                          : visitedTasks[t.id]
                          ? {
                              background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 50%, #d48b11 100%)',
                              borderTop: '1.5px solid #fff2b8',
                              borderBottom: '3.5px solid #7a4b00',
                              color: '#1a0f02',
                              boxShadow: '0 4px 12px rgba(247, 191, 70, 0.4)'
                            }
                          : {
                              background: 'linear-gradient(180deg, #4d331d 0%, #301f11 100%)',
                              borderTop: '1px solid #734d2b',
                              borderBottom: '3px solid #140d06',
                              color: '#ffffff'
                            }
                      }
                      className="px-6 py-2.5 rounded-[20px] text-xs font-black flex items-center space-x-1 uppercase transition-all active:translate-y-1 active:border-b-[1px] shrink-0"
                    >
                      <span>
                        {t.is_completed
                          ? 'Completed'
                          : verifyingTaskId === t.id
                          ? 'Checking...'
                          : visitedTasks[t.id]
                          ? 'Verify'
                          : 'Go'}
                      </span>
                      {!t.is_completed && !visitedTasks[t.id] && <ExternalLink size={12} className="text-[#a89782]" />}
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {/* VIEW 2: MY TASKS (User Campaigns with Pay Now, Reject, Approved, Completed) */}
          {exclusiveSubTab === 'my' && (
            <div className="space-y-3">

              {myTasks.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-[28px] bg-[#20140a] border border-[#3d2918] space-y-3">
                  <Clock size={32} className="mx-auto text-[#a89782]" />
                  <div>
                    <h4 className="text-sm font-black text-white">No campaigns created yet</h4>
                    <p className="text-[11px] text-[#a89782] mt-1 max-w-xs mx-auto">
                      Create your first campaign post to reach hundreds of hunters.
                    </p>
                  </div>
                  <button
                    onClick={() => setCreateModalOpen(true)}
                    style={{
                      background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 50%, #d48b11 100%)',
                      borderTop: '1px solid #fff2b8',
                      borderBottom: '3px solid #7a4b00',
                      color: '#1a0f02'
                    }}
                    className="px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-all inline-flex items-center space-x-1.5"
                  >
                    <PlusCircle size={15} />
                    <span>Create Exclusive Task</span>
                  </button>
                </div>
              ) : (
                myTasks.map((t) => {
                  const isPending = t.status === 'pending_payment';
                  const isApproved = t.status === 'approved';
                  const isCompleted = t.status === 'completed' || ((t.current_completed || 0) >= t.max_users);
                  const progressPct = Math.min(100, Math.round(((t.current_completed || 0) / (t.max_users || 100)) * 100));

                  return (
                    <div
                      key={t.id}
                      style={{
                        background: 'linear-gradient(180deg, #2b1c10 0%, #1c1108 100%)',
                        borderTop: isPending ? '2px solid #c97a2b' : isApproved ? '2px solid #2e7d32' : '2px solid #4a341f',
                        borderLeft: '1.5px solid #4a341f',
                        borderRight: '1.5px solid #4a341f',
                        borderBottom: '5px solid #0f0904',
                        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.7)'
                      }}
                      className="rounded-[28px] p-4 space-y-3"
                    >
                      {/* Top status header */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-[#a89782] font-mono">
                            {new Date(t.created_at).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] text-[#634e38]">·</span>
                          <span className="text-[10px] text-[#f7bf46] font-mono font-bold">
                            {t.max_users} Users
                          </span>
                        </div>

                        {/* Status Badge */}
                        {isPending ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            Pending Payment
                          </span>
                        ) : isCompleted ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            Approved · Done
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>Approved & Active</span>
                          </span>
                        )}
                      </div>

                      {/* Post details */}
                      <div>
                        <h4 className="text-sm font-black text-white">{t.title}</h4>
                        <p className="text-[11px] text-[#a89782] mt-0.5 truncate font-mono">{t.link}</p>
                      </div>

                      {/* Progress Bar (If Approved or Completed) */}
                      {!isPending && (
                        <div className="space-y-1 bg-[#140c06] p-2.5 rounded-2xl border border-[#382413]">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-[#a89782]">Completed by hunters</span>
                            <span className="text-white font-mono">{t.current_completed || 0} / {t.max_users} ({progressPct}%)</span>
                          </div>
                          <div className="w-full h-2 bg-[#20140a] rounded-full overflow-hidden p-[1px]">
                            <div
                              style={{ width: `${progressPct}%` }}
                              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                            />
                          </div>
                          {isCompleted && (
                            <p className="text-[10px] text-emerald-400 font-bold text-center pt-0.5">
                              ✓ Target reached! Campaign successfully concluded.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Price & Action Buttons */}
                      <div className="pt-1 flex items-center justify-between border-t border-[#382413]">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black text-[#00f5ff] font-mono">
                            {(t.ton_cost || (t.max_users / 100) * 0.20).toFixed(2)} TON
                          </span>
                          <span className="text-[10px] text-[#8a7966]">total cost</span>
                        </div>

                        {isPending ? (
                          <div className="flex items-center space-x-1.5">
                            {/* Edit Post */}
                            <button
                              onClick={() => {
                                triggerHaptic('selection');
                                setEditModalTask(t);
                              }}
                              style={{
                                background: '#26190e',
                                borderTop: '1px solid #573a1e',
                                borderBottom: '2px solid #140c06',
                                color: '#f7bf46'
                              }}
                              className="px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center space-x-1 transition-all active:scale-95"
                            >
                              <Edit3 size={11} />
                              <span>Edit</span>
                            </button>

                            {/* Reject / Cancel */}
                            <button
                              onClick={() => handleQuickCancelTask(t.id)}
                              style={{
                                background: '#1d120a',
                                borderTop: '1px solid #3d2414',
                                borderBottom: '2px solid #0d0703',
                                color: '#f87171'
                              }}
                              className="px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all active:scale-95"
                            >
                              Reject
                            </button>

                            {/* Pay Now */}
                            <button
                              onClick={() => handlePayNowClick(t)}
                              style={{
                                background: 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #0077b6 100%)',
                                borderTop: '1px solid #a6f4ff',
                                borderBottom: '2.5px solid #004777',
                                color: '#031726',
                                boxShadow: '0 4px 10px rgba(0, 180, 216, 0.4)'
                              }}
                              className="px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center space-x-1 transition-all active:scale-95"
                            >
                              <CreditCard size={12} />
                              <span>Pay now</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-black text-[#f7bf46] uppercase font-mono">
                              {isCompleted ? '✓ FULFILLED' : '● LIVE'}
                            </span>

                            {/* Boost Campaign Button */}
                            <button
                              onClick={() => {
                                triggerHaptic('impact', 'medium');
                                setBoostModalTask(t);
                              }}
                              style={{
                                background: 'linear-gradient(180deg, #ff8a00 0%, #e52e71 100%)',
                                borderTop: '1px solid #ffb380',
                                borderBottom: '2.5px solid #7a1538',
                                color: '#ffffff',
                                boxShadow: '0 4px 10px rgba(229, 46, 113, 0.4)'
                              }}
                              className="px-3 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center space-x-1 transition-all active:scale-95"
                            >
                              <Rocket size={12} />
                              <span>Boost</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. SOCIAL & PARTNER TABS */}
      {(activeCategory === 'social' || activeCategory === 'partner') && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-wider text-[#8a7966]">
            <span>{activeCategory === 'social' ? 'SOCIAL TASKS' : 'PARTNER OFFERS'}</span>
            <div className="h-[1px] bg-[#3d2918] flex-1" />
          </div>

          {activeCategory !== 'partner' && loadingCategory[activeCategory] ? (
            <div className="space-y-3 pt-2">
              <div
                style={{
                  background: 'linear-gradient(180deg, #322113 0%, #26170c 100%)',
                  borderTop: '2px solid #664b2d',
                  borderLeft: '1.5px solid #4a341f',
                  borderRight: '1.5px solid #4a341f',
                  borderBottom: '5px solid #140d06',
                  boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.8)'
                }}
                className="rounded-[28px] p-6 text-center space-y-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#1a1108] border border-[#4a341f] flex items-center justify-center mx-auto shadow-inner text-[#f7bf46]">
                  <RefreshCw className="animate-spin" size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider font-heading">
                    Loading {activeCategory === 'social' ? 'Social Tasks' : 'Partner Offers'}... Please Wait
                  </h4>
                  <p className="text-xs text-[#a89782]">
                    Connecting to reward vault and loading bounties...
                  </p>
                </div>
                <div className="w-36 h-1.5 bg-[#140d06] rounded-full mx-auto overflow-hidden border border-[#3d2918]">
                  <div className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 rounded-full animate-pulse w-full" />
                </div>
              </div>

              {/* 3 Animated Skeleton Cards */}
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    background: 'linear-gradient(180deg, #26180d 0%, #1c1108 100%)',
                    border: '1px solid #3d2918'
                  }}
                  className="rounded-[24px] p-4 flex items-center justify-between opacity-50 animate-pulse"
                >
                  <div className="space-y-2 flex-1 pr-4">
                    <div className="h-4 bg-[#3d2918] rounded-md w-3/5" />
                    <div className="h-2.5 bg-[#2a1b0e] rounded-md w-2/5" />
                  </div>
                  <div className="w-16 h-8 rounded-[16px] bg-[#3d2918]" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-[28px] bg-[#20140a] border border-[#3d2918] space-y-2">
              <Sparkles size={28} className="mx-auto text-[#f7bf46]" />
              <p className="text-xs text-white font-bold">No {activeCategory === 'social' ? 'social' : 'partner'} tasks available right now.</p>
              <p className="text-[11px] text-[#a89782]">Check back soon for new bounty offers!</p>
            </div>
          ) : (
            tasks.map((t) => (
            <div
              key={t.id}
              style={{
                background: 'linear-gradient(180deg, #322113 0%, #26170c 100%)',
                borderTop: '2px solid #664b2d',
                borderLeft: '1.5px solid #4a341f',
                borderRight: '1.5px solid #4a341f',
                borderBottom: '5px solid #140d06',
                boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.8)'
              }}
              className="rounded-[28px] p-4 flex items-center justify-between"
            >
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white">{t.title}</h4>
                <p className="text-[11px] text-[#a89782]">{t.description}</p>
                <div className="flex items-center space-x-1.5 text-xs pt-0.5">
                  <Gem size={14} className="text-cyan-400 drop-shadow-[0_0_6px_rgba(0,229,255,0.7)]" />
                  <span className="text-[#f7bf46] font-black text-[13px] font-mono">+{t.reward_diamonds}</span>
                </div>
              </div>

              <button
                onClick={() => handleTaskAction(t)}
                disabled={t.is_completed || verifyingTaskId === t.id}
                style={
                  t.is_completed
                    ? {
                        backgroundColor: '#352415',
                        color: '#7a6752',
                        borderBottom: '2px solid #1a1108'
                      }
                    : visitedTasks[t.id]
                    ? {
                        background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 50%, #d48b11 100%)',
                        borderTop: '1.5px solid #fff2b8',
                        borderBottom: '3.5px solid #7a4b00',
                        color: '#1a0f02',
                        boxShadow: '0 4px 12px rgba(247, 191, 70, 0.4)'
                      }
                    : {
                        background: 'linear-gradient(180deg, #4d331d 0%, #301f11 100%)',
                        borderTop: '1px solid #734d2b',
                        borderBottom: '3px solid #140d06',
                        color: '#ffffff'
                      }
                }
                className="px-6 py-2.5 rounded-[20px] text-xs font-black flex items-center space-x-1 uppercase transition-all active:translate-y-1 active:border-b-[1px] shrink-0"
              >
                <span>
                  {t.is_completed
                    ? 'Completed'
                    : verifyingTaskId === t.id
                    ? 'Checking...'
                    : visitedTasks[t.id]
                    ? 'Verify'
                    : 'Go'}
                </span>
                {!t.is_completed && !visitedTasks[t.id] && <ExternalLink size={12} className="text-[#a89782]" />}
              </button>
            </div>
          )))}

          {/* 3D How Treasure Vault Rewards Work info box */}
          <div
            style={{
              background: 'linear-gradient(180deg, #2b1c10 0%, #201509 100%)',
              borderTop: '1.5px solid #5c3f24',
              borderBottom: '3.5px solid #120b04',
              boxShadow: '0 6px 16px rgba(0,0,0,0.7)'
            }}
            className="rounded-[28px] p-4 mt-6 space-y-2 border-x border-[#3d2918]"
          >
            <h4 className="text-xs font-black text-white">How Treasure Vault Rewards Work</h4>
            <p className="text-[11px] text-[#a89782] leading-relaxed font-medium">
              Task and quest bounties are verified through our secure vault system. Telegram channels verify bot membership, while link visits confirm instantly. Once verified, pure GEMS are instantly added to your chest balance.
            </p>
          </div>
        </div>
      )}

      {/* MODALS */}
      <CreateExclusiveTaskModal
        isOpen={createModalOpen || !!editModalTask}
        editTask={editModalTask}
        onClose={() => {
          setCreateModalOpen(false);
          setEditModalTask(null);
        }}
        onTaskCreated={(newTask) => {
          setCreateModalOpen(false);
          setEditModalTask(null);
          setExclusiveSubTab('my');
          setStatusMessage({
            type: 'success',
            text: '🎉 Campaign post created! Click "Pay now" on your post below to complete payment and activate it.'
          });
          loadTasksAndAds();
        }}
        onTaskUpdated={(updatedTask) => {
          setStatusMessage({
            type: 'success',
            text: '🎉 Campaign post draft updated successfully!'
          });
          loadTasksAndAds();
        }}
      />

      <TaskPaymentModal
        task={paymentModalTask}
        isOpen={!!paymentModalTask}
        onClose={() => setPaymentModalTask(null)}
        onPaymentSuccess={(approvedTask) => {
          setStatusMessage({
            type: 'success',
            text: '🎉 Payment confirmed! Your task is now APPROVED and live in Exclusive Tasks!'
          });
          loadTasksAndAds();
        }}
        onTaskCancelled={(cancelledId) => {
          setStatusMessage({
            type: 'info',
            text: 'Campaign post draft was rejected and cancelled.'
          });
          loadTasksAndAds();
        }}
      />

      <BoostTaskModal
        task={boostModalTask}
        isOpen={!!boostModalTask}
        onClose={() => setBoostModalTask(null)}
        onTaskBoosted={(boostedTask) => {
          setStatusMessage({
            type: 'success',
            text: `🚀 Campaign boosted! Added audience capacity is now active for new hunters.`
          });
          loadTasksAndAds();
        }}
      />
    </div>
  );
}
