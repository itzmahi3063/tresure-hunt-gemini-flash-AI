import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  Send,
  PlusCircle,
  Tv,
  Users,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Search,
  ArrowLeft,
  Gift,
  Sparkles,
  Trophy,
  RefreshCw,
  Save,
  Wrench,
  Power,
  ShieldAlert,
  Database,
  HardDrive
} from 'lucide-react';
import api from '../services/api';
import { triggerHaptic } from '../services/telegram';

export default function AdminDashboard() {
  const { setActiveTab, isAdmin } = useApp();
  const [activeAdminTab, setActiveAdminTab] = useState('tasks');

  // Maintenance Mode State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceNotice, setMaintenanceNotice] = useState('');
  const [updatingMaintenance, setUpdatingMaintenance] = useState(false);

  // Storage & TTL Engine State
  const [storageStats, setStorageStats] = useState(null);
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [storageFeedback, setStorageFeedback] = useState(null);

  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState(null);
  const [dailyBroadcasting, setDailyBroadcasting] = useState(false);

  const [taskCategory, setTaskCategory] = useState('social');
  const [taskType, setTaskType] = useState('channel');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskLink, setTaskLink] = useState('');
  const [taskChatId, setTaskChatId] = useState('');
  const [taskReward, setTaskReward] = useState('500');
  const [taskMaxUsers, setTaskMaxUsers] = useState('');
  const [channelVerifyStatus, setChannelVerifyStatus] = useState(null);
  const [tasksList, setTasksList] = useState(() => {
    try {
      const c = localStorage.getItem('treasure_admin_tasks');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });

  // Promo Codes State
  const [promoList, setPromoList] = useState(() => {
    try {
      const c = localStorage.getItem('treasure_admin_promo');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoRewardType, setNewPromoRewardType] = useState('diamonds');
  const [newPromoAmount, setNewPromoAmount] = useState('500');
  const [newPromoMaxUses, setNewPromoMaxUses] = useState('');

  const [adsList, setAdsList] = useState(() => {
    try {
      const c = localStorage.getItem('treasure_admin_ads');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [adNetworks, setAdNetworks] = useState(() => {
    try {
      const c = localStorage.getItem('treasure_admin_ad_networks');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [savingAds, setSavingAds] = useState(false);

  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState(() => {
    try {
      const c = localStorage.getItem('treasure_admin_users');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [balanceAdjust, setBalanceAdjust] = useState({ type: 'diamonds', amount: '', action: 'add' });
  const [adminWalletEdit, setAdminWalletEdit] = useState({ network: 'BINANCE', address: '' });

  const [withdrawalsList, setWithdrawalsList] = useState(() => {
    try {
      const c = localStorage.getItem('treasure_admin_withdrawals');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [updatingWdId, setUpdatingWdId] = useState(null);
  const [copiedKeys, setCopiedKeys] = useState({});

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleCopyPersistent = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedKeys((prev) => ({ ...prev, [key]: true }));
    triggerHaptic('notification', 'success');
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const loadAllAdminData = async () => {
    try {
      const [tasksRes, adsRes, networksRes, wdRes, promoRes, usersRes, maintRes, storageRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/admin/ads'),
        api.get('/admin/ad-networks'),
        api.get('/admin/withdrawals'),
        api.get('/admin/promo'),
        api.get('/admin/users'),
        api.get('/admin/maintenance').catch(() => ({ data: { success: false } })),
        api.get('/admin/storage/stats').catch(() => ({ data: { success: false } }))
      ]);

      if (tasksRes.data?.success) {
        const tasks = tasksRes.data.tasks || [];
        setTasksList(tasks);
        try { localStorage.setItem('treasure_admin_tasks', JSON.stringify(tasks)); } catch (e) {}
      }
      if (adsRes.data?.success) {
        const ads = adsRes.data.ads || [];
        setAdsList(ads);
        try { localStorage.setItem('treasure_admin_ads', JSON.stringify(ads)); } catch (e) {}
      }
      if (networksRes.data?.success) {
        const networks = networksRes.data.networks || [];
        setAdNetworks(networks);
        try { localStorage.setItem('treasure_admin_ad_networks', JSON.stringify(networks)); } catch (e) {}
      }
      if (wdRes.data?.success) {
        const wds = wdRes.data.withdrawals || [];
        setWithdrawalsList(wds);
        try { localStorage.setItem('treasure_admin_withdrawals', JSON.stringify(wds)); } catch (e) {}
      }
      if (promoRes.data?.success) {
        const promos = promoRes.data.promoCodes || [];
        setPromoList(promos);
        try { localStorage.setItem('treasure_admin_promo', JSON.stringify(promos)); } catch (e) {}
      }
      if (usersRes.data?.success) {
        const users = usersRes.data.users || [];
        setUserResults(users);
        try { localStorage.setItem('treasure_admin_users', JSON.stringify(users)); } catch (e) {}
      }
      if (maintRes?.data?.success) {
        setMaintenanceMode(Boolean(maintRes.data.maintenance));
        setMaintenanceNotice(maintRes.data.message || '');
      }
      if (storageRes?.data?.success) {
        setStorageStats(storageRes.data.stats);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
  };

  const handleTriggerStorageCleanup = async () => {
    if (cleaningStorage) return;
    setCleaningStorage(true);
    setStorageFeedback(null);
    try {
      const res = await api.post('/admin/storage/cleanup');
      if (res.data.success) {
        setStorageStats(res.data.stats);
        const { purged_inactive_users, purged_ad_logs, purged_broadcasts } = res.data.result;
        setStorageFeedback({
          type: 'success',
          text: `Storage cleanup complete! Purged ${purged_inactive_users} inactive users (60d+), ${purged_ad_logs} old ad logs, and ${purged_broadcasts} old broadcasts.`
        });
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      setStorageFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Storage cleanup failed'
      });
      triggerHaptic('notification', 'error');
    } finally {
      setCleaningStorage(false);
    }
  };

  const handleToggleMaintenance = async (targetEnabled = !maintenanceMode) => {
    setUpdatingMaintenance(true);
    try {
      const res = await api.post('/admin/maintenance', {
        enabled: targetEnabled,
        message: maintenanceNotice.trim()
      });
      if (res.data.success) {
        setMaintenanceMode(res.data.maintenance);
        setFeedback({
          type: 'success',
          text: res.data.maintenance
            ? '🔴 Maintenance Mode ACTIVATED! All normal users are now redirected to the Maintenance Screen. Your Admin account (UID 7780774047) remains completely unrestricted.'
            : '🟢 Maintenance Mode DEACTIVATED! All users can now access and play the app normally.'
        });
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Failed to update maintenance mode'
      });
      triggerHaptic('notification', 'error');
    } finally {
      setUpdatingMaintenance(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <ShieldCheck size={48} className="text-rose-500 mb-3" />
        <h2 className="text-xl font-black text-white">Access Denied</h2>
        <p className="text-xs text-gray-400 mt-1">This panel is restricted exclusively to Authorized Administrators.</p>
        <button
          onClick={() => setActiveTab('home')}
          className="mt-4 btn-3d-gold px-4 py-2 rounded-xl text-xs uppercase"
        >
          Return Home
        </button>
      </div>
    );
  }

  // Handle Promo Code Creation
  const handleCreatePromo = async (e) => {
    e.preventDefault();
    if (loading) return; // Prevent double-clicks / touch duplicate requests
    const cleanCode = newPromoCode.trim().toUpperCase();
    if (!cleanCode || !newPromoAmount) {
      setFeedback({ type: 'error', text: 'Promo code and reward amount are required' });
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.post('/admin/promo', {
        code: cleanCode,
        reward_type: newPromoRewardType,
        reward_amount: Number(newPromoAmount),
        max_uses: newPromoMaxUses ? Number(newPromoMaxUses) : null
      });

      if (res.data.success) {
        setFeedback({ type: 'success', text: `Promo code "${res.data.promo?.code || cleanCode}" created successfully!` });
        setNewPromoCode('');
        setNewPromoAmount('500');
        setNewPromoMaxUses('');
        await loadAllAdminData();
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to create promo code' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePromo = async (promoId) => {
    if (!confirm('Delete this promo code?')) return;
    try {
      await api.delete(`/admin/promo/${promoId}`);
      loadAllAdminData();
      triggerHaptic('notification', 'warning');
    } catch (err) {
      alert('Failed to delete promo code');
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;

    setLoading(true);
    setBroadcastStatus(null);
    try {
      const res = await api.post('/admin/broadcast', { message: broadcastMsg });
      if (res.data.success) {
        setBroadcastStatus({
          type: 'success',
          text: `Broadcast sent successfully! Total users: ${res.data.result.total}, Delivered: ${res.data.result.sent}`
        });
        setBroadcastMsg('');
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      setBroadcastStatus({ type: 'error', text: err.response?.data?.error || 'Broadcast failed' });
      triggerHaptic('notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDailyBroadcast = async () => {
    if (dailyBroadcasting) return;
    setDailyBroadcasting(true);
    setBroadcastStatus(null);
    try {
      const res = await api.post('/admin/broadcast/daily-reset');
      if (res.data.success) {
        setBroadcastStatus({
          type: 'success',
          text: `Daily Reload Broadcast queued & sent! Delivered ${res.data.broadcast?.sentThisBatch || 0} users in initial batch. Remaining users will be processed safely via cron.`
        });
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      setBroadcastStatus({ type: 'error', text: err.response?.data?.error || 'Failed to trigger daily broadcast' });
      triggerHaptic('notification', 'error');
    } finally {
      setDailyBroadcasting(false);
    }
  };

  const handleVerifyChannel = async () => {
    if (!taskChatId.trim()) {
      setChannelVerifyStatus({ success: false, message: 'Please enter channel username or ID first' });
      return;
    }

    setLoading(true);
    setChannelVerifyStatus(null);
    try {
      const res = await api.post('/admin/verify-channel', { chatId: taskChatId.trim() });
      if (res.data.success) {
        setChannelVerifyStatus({ success: true, message: '✅ Bot is verified as Administrator in this channel!' });
        triggerHaptic('notification', 'success');
      } else {
        setChannelVerifyStatus({
          success: false,
          message: '❌ ' + (res.data.error || 'Bot is NOT an admin. Please grant admin permissions to your bot in this channel first.')
        });
        triggerHaptic('notification', 'error');
      }
    } catch (err) {
      setChannelVerifyStatus({ success: false, message: 'Verification error: ' + (err.response?.data?.error || err.message) });
    } finally {
      setLoading(false);
    }
  };

  const handlePublishTask = async (e) => {
    e.preventDefault();
    if (!taskTitle || !taskLink) {
      setFeedback({ type: 'error', text: 'Task title and link are required' });
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.post('/admin/tasks', {
        category: taskCategory,
        type: taskType,
        title: taskTitle,
        description: taskDescription,
        link: taskLink,
        chat_id: taskType === 'channel' ? taskChatId : '',
        reward_diamonds: 10,
        max_users: taskMaxUsers ? Number(taskMaxUsers) : null
      });

      if (res.data.success) {
        setFeedback({ type: 'success', text: `Task "${taskTitle}" published successfully!` });
        setTaskTitle('');
        setTaskDescription('');
        setTaskLink('');
        setTaskChatId('');
        setChannelVerifyStatus(null);
        loadAllAdminData();
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to publish task' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/admin/tasks/${taskId}`);
      loadAllAdminData();
    } catch (err) {
      alert('Failed to delete task');
    }
  };

  const handleUpdateAdField = (adId, field, value) => {
    setAdsList((prev) =>
      prev.map((ad) => (ad.id === adId ? { ...ad, [field]: value } : ad))
    );
  };

  const handleToggleAd = (adId) => {
    setAdsList((prev) =>
      prev.map((ad) => (ad.id === adId ? { ...ad, is_hidden: !ad.is_hidden } : ad))
    );
    triggerHaptic('selection');
  };

  const handleSwapAdNetwork = (adId, networkId) => {
    const net = adNetworks.find((n) => n.id === networkId);
    setAdsList((prev) =>
      prev.map((ad) => {
        if (ad.id === adId) {
          return {
            ...ad,
            network_id: networkId,
            name: net ? net.name : ad.name,
            logo_url: net ? net.logo_url : ad.logo_url,
            block_id: net && net.block_id ? net.block_id : ad.block_id
          };
        }
        return ad;
      })
    );
    triggerHaptic('selection');
  };

  const handleSaveAllAds = async () => {
    setSavingAds(true);
    setFeedback(null);
    try {
      const res = await api.post('/admin/ads/save-all', { ads: adsList });
      if (res.data.success) {
        if (res.data.ads) setAdsList(res.data.ads);
        setFeedback({
          type: 'success',
          text: '✅ All Ads settings and visibility saved to database successfully!'
        });
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Failed to save ads settings'
      });
      triggerHaptic('notification', 'error');
    } finally {
      setSavingAds(false);
    }
  };

  const handleSearchUser = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await api.get(`/admin/users?query=${encodeURIComponent(userQuery)}`);
      if (res.data.success) {
        setUserResults(res.data.users || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminAdjustBalance = async (e) => {
    e.preventDefault();
    if (!selectedUser || !balanceAdjust.amount) return;

    try {
      const res = await api.post('/admin/user/balance-adjust', {
        userId: selectedUser.id,
        type: balanceAdjust.type,
        amount: Number(balanceAdjust.amount),
        action: balanceAdjust.action
      });

      if (res.data.success) {
        setSelectedUser(res.data.user);
        handleSearchUser();
        setFeedback({
          type: 'success',
          text: `Balance updated for ${selectedUser.username ? '@' + selectedUser.username : selectedUser.id}!`
        });
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to adjust balance');
    }
  };

  const handleAdminUpdateWallet = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await api.post('/admin/users/wallet', {
        userId: selectedUser.id,
        network: adminWalletEdit.network,
        walletAddress: adminWalletEdit.address
      });

      if (res.data.success) {
        setSelectedUser(res.data.user);
        setFeedback({
          type: 'success',
          text: `Wallet for ${selectedUser.username || selectedUser.id} (${adminWalletEdit.network}) updated successfully!`
        });
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user wallet');
    }
  };

  const handleUpdateWithdrawal = async (wdId, status) => {
    if (updatingWdId) return; // Prevent double-clicks / duplicate requests
    setUpdatingWdId(wdId);
    try {
      await api.patch(`/admin/withdrawals/${wdId}`, { status });
      await loadAllAdminData();
      triggerHaptic('notification', status === 'approved' ? 'success' : 'warning');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update withdrawal status');
    } finally {
      setUpdatingWdId(null);
    }
  };

  return (
    <div className="min-h-screen pb-24 pt-3 px-4 max-w-md mx-auto space-y-4">
      {/* Top Admin Header */}
      <div className="flex items-center justify-between box-3d-gold p-3.5">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('home')}
            className="p-1.5 btn-3d-dark rounded-lg text-gray-300 hover:text-white"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-8 h-8 rounded-xl btn-3d-gold flex items-center justify-center text-black">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black text-yellow-400 tracking-wide uppercase">ADMIN CONTROL PANEL</h2>
            <p className="text-[10px] text-emerald-400 font-mono font-bold">● Verified Admin Session</p>
          </div>
        </div>
      </div>

      {/* Pinned Maintenance Mode Quick Control Card */}
      <div className={`p-3 rounded-2xl border-2 flex items-center justify-between transition-all ${
        maintenanceMode
          ? 'bg-gradient-to-r from-rose-950/80 via-red-900/60 to-rose-950/80 border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.25)]'
          : 'bg-[#101420] border-[#222A3E]'
      }`}>
        <div className="flex items-center space-x-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
            maintenanceMode ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          }`}>
            <Wrench size={16} />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className={`text-[11px] font-black uppercase font-heading ${
                maintenanceMode ? 'text-rose-300' : 'text-emerald-400'
              }`}>
                {maintenanceMode ? '● Maintenance Mode Active' : '● System Online (Live)'}
              </span>
            </div>
            <p className="text-[9px] text-gray-400">
              {maintenanceMode ? 'Regular users are blocked • Admin exempt' : 'All players can access normally'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleToggleMaintenance()}
          disabled={updatingMaintenance}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all tracking-wider font-heading flex items-center space-x-1 ${
            maintenanceMode
              ? 'btn-3d-green text-white'
              : 'btn-3d-dark text-rose-400 border border-rose-500/40 hover:bg-rose-950/40'
          }`}
        >
          <Power size={11} />
          <span>{updatingMaintenance ? 'Saving...' : maintenanceMode ? 'Turn OFF' : 'Turn ON'}</span>
        </button>
      </div>

      {/* 3D Admin Subtabs with System Maintenance tab (2 rows of 4 for mobile comfort) */}
      <div className="grid grid-cols-4 gap-1.5 bg-[#12121A] p-1.5 rounded-2xl border-b-2 border-[#252535]">
        {[
          { id: 'tasks', label: 'Task', icon: PlusCircle },
          { id: 'promo', label: 'Promo', icon: Gift },
          { id: 'contest', label: 'Contest', icon: Trophy },
          { id: 'broadcast', label: 'Cast', icon: Send },
          { id: 'ads', label: 'Ads', icon: Tv },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'withdrawals', label: 'Pay', icon: CreditCard },
          { id: 'maintenance', label: 'System', icon: ShieldAlert }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeAdminTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveAdminTab(tab.id); setFeedback(null); }}
              className={`py-2 px-0.5 text-[9px] font-black rounded-xl flex flex-col items-center justify-center space-y-0.5 transition-all uppercase ${
                isActive ? 'btn-3d-gold' : 'btn-3d-dark text-gray-400'
              }`}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-3.5 rounded-2xl text-xs flex items-center space-x-2 ${
          feedback.type === 'success' ? 'box-3d border-emerald-500/40 text-emerald-300' : 'box-3d border-rose-500/40 text-rose-300'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span className="font-bold">{feedback.text}</span>
        </div>
      )}

      {/* TAB 1: TASKS PUBLISHER & LIST */}
      {activeAdminTab === 'tasks' && (
        <div className="space-y-4">
          <form onSubmit={handlePublishTask} className="box-3d p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#252535] pb-2">
              <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-heading flex items-center space-x-1.5">
                <PlusCircle size={15} />
                <span>Publish New Task</span>
              </h3>
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-[11px] text-gray-400 font-bold uppercase mb-1">Target Section</label>
              <div className="grid grid-cols-3 gap-1.5">
                {['social', 'exclusive', 'partner'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTaskCategory(cat)}
                    className={`py-1.5 text-[11px] font-black rounded-lg uppercase ${
                      taskCategory === cat ? 'btn-3d-gold text-black' : 'btn-3d-dark text-gray-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Type Toggle */}
            <div>
              <label className="block text-[11px] text-gray-400 font-bold uppercase mb-1">Task Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTaskType('channel')}
                  className={`py-2 text-xs font-black rounded-xl uppercase ${
                    taskType === 'channel' ? 'btn-3d-cyan text-black' : 'btn-3d-dark text-gray-400'
                  }`}
                >
                  📢 Channel / Group
                </button>
                <button
                  type="button"
                  onClick={() => setTaskType('website')}
                  className={`py-2 text-xs font-black rounded-xl uppercase ${
                    taskType === 'website' ? 'btn-3d-gold text-black' : 'btn-3d-dark text-gray-400'
                  }`}
                >
                  🌐 Bot / Website Link
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-[11px] text-gray-400 font-bold uppercase mb-1">Task Title</label>
              <input
                type="text"
                placeholder="e.g. Join Official VIP Signals"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full bg-[#0D0D14] border border-[#2B2B3D] rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-yellow-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] text-gray-400 font-bold uppercase mb-1">Description</label>
              <input
                type="text"
                placeholder="e.g. Subscribe to earn 500 Diamonds instantly"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="w-full bg-[#0D0D14] border border-[#2B2B3D] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            {/* Link */}
            <div>
              <label className="block text-[11px] text-gray-400 font-bold uppercase mb-1">Action Link (URL)</label>
              <input
                type="url"
                placeholder="https://t.me/yourchannel or https://website.com"
                value={taskLink}
                onChange={(e) => setTaskLink(e.target.value)}
                className="w-full bg-[#0D0D14] border border-[#2B2B3D] rounded-xl px-3 py-2 text-xs text-cyan-400 outline-none font-mono"
              />
            </div>

            {/* Channel Admin Verification if Channel */}
            {taskType === 'channel' && (
              <div className="bg-[#14141E] p-3 rounded-xl border border-cyan-500/20 space-y-2">
                <label className="block text-[11px] text-cyan-300 font-bold uppercase">
                  Telegram Channel Username / ID
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="@YourChannelUsername"
                    value={taskChatId}
                    onChange={(e) => setTaskChatId(e.target.value)}
                    className="flex-1 bg-[#0A0A0F] border border-[#2B2B3D] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyChannel}
                    disabled={loading}
                    className="btn-3d-cyan px-3 py-2 rounded-xl text-xs uppercase font-bold text-black"
                  >
                    Verify Admin
                  </button>
                </div>

                {channelVerifyStatus && (
                  <p className={`text-[11px] font-bold ${channelVerifyStatus.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {channelVerifyStatus.message}
                  </p>
                )}
              </div>
            )}

            {/* Rewards & Max Users */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-gray-400 font-bold uppercase mb-1">Reward (💎)</label>
                <input
                  type="text"
                  value="10 GEMS (Fixed)"
                  disabled
                  readOnly
                  className="w-full bg-[#0D0D14] border border-[#2B2B3D] rounded-xl px-3 py-2 text-xs text-yellow-400 font-mono font-bold outline-none opacity-80 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 font-bold uppercase mb-1">Max Users (Optional)</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={taskMaxUsers}
                  onChange={(e) => setTaskMaxUsers(e.target.value)}
                  className="w-full bg-[#0D0D14] border border-[#2B2B3D] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-3d-gold py-3 rounded-xl text-xs uppercase font-black text-black tracking-wider"
            >
              {loading ? 'Publishing...' : 'Publish Task'}
            </button>
          </form>

          {/* Active Tasks List */}
          <div className="box-3d p-4 space-y-3">
            <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-heading">
              Active Tasks List ({tasksList.length})
            </h3>
            {tasksList.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No active tasks published</p>
            ) : (
              <div className="space-y-2">
                {tasksList.map((t) => (
                  <div key={t.id} className="badge-3d p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-white">{t.title}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        +{t.reward_diamonds} 💎 • Category: {t.category} ({t.type})
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-950/40 rounded-lg border border-rose-500/30"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. WEEKLY CONTEST ADMIN SECTION */}
      {activeAdminTab === 'contest' && (
        <div className="box-3d-gold p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-yellow-500/20 pb-2.5">
            <div className="flex items-center space-x-2">
              <Trophy className="text-yellow-400" size={20} />
              <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-heading">
                Weekly Refer Contest Manager
              </h3>
            </div>
          </div>

          <div className="bg-[#0A0A10] border border-yellow-500/30 p-3.5 rounded-2xl space-y-2 text-xs">
            <p className="text-gray-300">
              The Weekly Refer Contest runs on a <strong>7-Day countdown</strong> and ranks contestants who have at least <strong>10 referrals</strong>.
            </p>
            <p className="text-[#8E95A5] text-[11px]">
              When you reset the contest, the timer restarts at 7 days, previous round is archived, and users start a fresh round.
            </p>
          </div>

          <button
            onClick={async () => {
              if (!confirm('Are you sure you want to reset the 7-day Weekly Refer Contest? This will start a new round!')) return;
              try {
                const res = await api.post('/admin/contest/reset');
                if (res.data.success) {
                  triggerHaptic('notification', 'success');
                  setFeedback({ type: 'success', text: `Weekly Contest Round ${res.data.contest.round} started successfully (7 Days countdown reset)!` });
                }
              } catch (e) {
                alert('Failed to reset weekly contest');
              }
            }}
            className="w-full btn-3d-gold py-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2"
          >
            <RefreshCw size={15} />
            <span>Reset 7-Day Weekly Contest Now</span>
          </button>
        </div>
      )}

      {/* 2. PROMO CODES MANAGEMENT SECTION */}
      {activeAdminTab === 'promo' && (
        <div className="space-y-4">
          <form onSubmit={handleCreatePromo} className="box-3d p-4 space-y-3">
            <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider">
              Create New Secret Promo Code
            </h3>

            <div>
              <label className="block text-[11px] text-gray-400 font-bold uppercase mb-1">
                Promo Code Name
              </label>
              <input
                type="text"
                placeholder="e.g. TREASURE500 or GIFT2026"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                className="w-full bg-[#0D0D14] border border-[#2B2B3D] rounded-xl px-3 py-2.5 text-xs text-yellow-400 font-mono font-bold tracking-widest outline-none focus:border-yellow-400 uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-gray-400 font-bold uppercase mb-1">
                  Reward Type
                </label>
                <select
                  value={newPromoRewardType}
                  onChange={(e) => setNewPromoRewardType(e.target.value)}
                  className="w-full bg-[#0D0D14] border border-[#2B2B3D] rounded-xl px-3 py-2 text-xs text-white font-bold"
                >
                  <option value="diamonds">Diamonds (💎)</option>
                  <option value="usdt">USDT ($)</option>
                  <option value="keys">Keys (🗝️)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-gray-400 font-bold uppercase mb-1">
                  Reward Amount
                </label>
                <input
                  type="number"
                  placeholder="500"
                  value={newPromoAmount}
                  onChange={(e) => setNewPromoAmount(e.target.value)}
                  className="w-full bg-[#0D0D14] border border-[#2B2B3D] rounded-xl px-3 py-2 text-xs text-cyan-400 font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 font-bold uppercase mb-1">
                Max Users Limit (Optional)
              </label>
              <input
                type="number"
                placeholder="e.g. 100 (Leave empty for unlimited)"
                value={newPromoMaxUses}
                onChange={(e) => setNewPromoMaxUses(e.target.value)}
                className="w-full bg-[#0D0D14] border border-[#2B2B3D] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full btn-3d-gold py-3 rounded-xl text-xs uppercase font-black transition-all ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Creating...' : 'Create Promo Code'}
            </button>
          </form>

          {/* Promo Codes List */}
          <div className="box-3d p-4 space-y-3">
            <h3 className="text-xs font-black text-cyan-400 uppercase tracking-wider">
              Active Promo Codes ({promoList.length})
            </h3>

            {promoList.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-3">No promo codes created yet</p>
            ) : (
              <div className="space-y-2">
                {promoList.map((p) => (
                  <div key={p.id} className="bg-[#14141E] border border-[#2B2B3D] p-3 rounded-xl flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-yellow-400 text-sm tracking-wider">{p.code}</span>
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-bold">
                          +{p.reward_amount} {p.reward_type === 'diamonds' ? '💎' : p.reward_type === 'usdt' ? '$' : '🗝️'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Used: {p.uses_count} / {p.max_uses ? p.max_uses : '∞ Unlimited'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeletePromo(p.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-950/40 rounded-lg border border-rose-500/30"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BROADCAST */}
      {activeAdminTab === 'broadcast' && (
        <div className="box-3d p-4 space-y-3">
          <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-heading flex items-center space-x-1.5">
            <Send size={15} />
            <span>Send Global Broadcast</span>
          </h3>
          <p className="text-[11px] text-gray-400">
            Send an instant direct announcement to every registered user through Telegram bot messages.
          </p>

          <form onSubmit={handleSendBroadcast} className="space-y-3">
            <textarea
              rows={4}
              placeholder="Write your announcement or promo message here..."
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              className="w-full bg-[#0D0D14] border border-[#2B2B3D] rounded-xl p-3 text-xs text-white outline-none focus:border-yellow-500"
            />

            {broadcastStatus && (
              <p className={`text-xs font-bold ${broadcastStatus.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {broadcastStatus.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-3d-gold py-3 rounded-xl text-xs uppercase font-black text-black flex items-center justify-center space-x-2"
            >
              <Send size={15} />
              <span>{loading ? 'Sending...' : 'Send Broadcast to All Users'}</span>
            </button>
          </form>

          {/* 9:00 AM Daily Reload Broadcast Card */}
          <div className="mt-4 pt-4 border-t border-[#252535] space-y-3">
            <div className="flex items-center space-x-2">
              <Sparkles size={16} className="text-yellow-400" />
              <h4 className="text-xs font-black text-white uppercase font-heading">
                9:00 AM Daily Reload Broadcast
              </h4>
            </div>
            <p className="text-[11px] text-gray-400">
              Sends the branded &quot;DAILY RELOADED&quot; poster with <b>🏴‍☠️ HUNT</b> button to notify all users that streaks, ads, and games have refreshed. Automatically runs every day at 9:00 AM BST, or trigger manually below:
            </p>

            <div className="rounded-xl overflow-hidden border border-[#2B2B3D] max-w-xs mx-auto">
              <img src="/daily_reset_banner.webp" alt="Daily Reset Banner" className="w-full object-cover" />
            </div>

            <button
              type="button"
              onClick={handleTriggerDailyBroadcast}
              disabled={dailyBroadcasting}
              className="w-full btn-3d-cyan py-3 rounded-xl text-xs uppercase font-black text-black flex items-center justify-center space-x-2 shadow-lg"
            >
              <Sparkles size={14} />
              <span>{dailyBroadcasting ? 'Queueing & Delivering...' : 'Trigger Daily Reload Broadcast Now'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: ADS */}
      {activeAdminTab === 'ads' && (
        <div className="box-3d p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#252535] pb-2">
            <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-heading flex items-center space-x-1.5">
              <Tv size={15} />
              <span>Monetization &amp; Ads Control</span>
            </h3>
            <span className="text-[10px] text-gray-400 font-mono">{adsList.length} Slots Configured</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Edit ad network placements, reward amounts, daily limits, or hide/show ads. Click &quot;Save All Ads Settings&quot; below to apply.
          </p>

          <div className="space-y-3">
            {adsList.map((ad) => (
              <div key={ad.id} className="badge-3d p-3.5 space-y-3 text-xs border border-[#2B2B3D] rounded-2xl bg-[#0D0D14]/80">
                {/* Slot Header: Logo, Slot ID, and Visibility Status Toggle Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={ad.logo_url}
                      alt={ad.name}
                      className="w-10 h-10 rounded-xl object-cover border border-[#2B2B3D] bg-black/40 shadow-sm"
                      onError={(e) => { e.target.style.visibility = 'hidden'; }}
                    />
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-black text-white text-xs">{ad.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-mono font-bold">{ad.id}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        Network: <span className="text-cyan-400">{ad.network_id || 'custom'}</span>
                      </div>
                    </div>
                  </div>

                  {/* High-visibility Hide / Show Toggle Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleAd(ad.id)}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      ad.is_hidden
                        ? 'bg-rose-950/70 border border-rose-500/50 text-rose-300 shadow-sm'
                        : 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 shadow-sm'
                    }`}
                  >
                    {ad.is_hidden ? (
                      <>
                        <EyeOff size={14} />
                        <span>Hidden</span>
                      </>
                    ) : (
                      <>
                        <Eye size={14} />
                        <span>Visible</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Network & Name Selection */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#222230]">
                  <div>
                    <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Ad Network</label>
                    <select
                      value={ad.network_id || ''}
                      onChange={(e) => handleSwapAdNetwork(ad.id, e.target.value)}
                      className="w-full bg-[#12121D] border border-[#2B2B3D] rounded-xl px-2.5 py-1.5 text-xs text-white font-bold outline-none focus:border-yellow-400"
                    >
                      {adNetworks.map((net) => (
                        <option key={net.id} value={net.id}>{net.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Display Title</label>
                    <input
                      type="text"
                      value={ad.name || ''}
                      onChange={(e) => handleUpdateAdField(ad.id, 'name', e.target.value)}
                      className="w-full bg-[#12121D] border border-[#2B2B3D] rounded-xl px-2.5 py-1.5 text-xs text-white font-bold outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>

                {/* Placement ID / Zone ID (Supports USL TowerAds, Adsgram, Monetag) */}
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">
                    Placement ID / Block ID <span className="text-gray-500 text-[9px]">(Adsgram: int-49020 / USL: plc_... / Monetag: zone)</span>
                  </label>
                  <input
                    type="text"
                    value={ad.block_id || ''}
                    placeholder="e.g. int-49020 or plc_732542dada05f70b"
                    onChange={(e) => handleUpdateAdField(ad.id, 'block_id', e.target.value)}
                    className="w-full bg-[#12121D] border border-[#2B2B3D] rounded-xl px-2.5 py-1.5 text-xs text-cyan-300 font-mono outline-none focus:border-yellow-400"
                  />
                </div>

                {/* Reward & Daily Limits */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Reward (💎 GEMS)</label>
                    <input
                      type="number"
                      value={ad.reward_diamonds ?? 50}
                      onChange={(e) => handleUpdateAdField(ad.id, 'reward_diamonds', Number(e.target.value))}
                      className="w-full bg-[#12121D] border border-[#2B2B3D] rounded-xl px-2.5 py-1.5 text-xs text-yellow-400 font-mono font-bold outline-none focus:border-yellow-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Max Daily Limit</label>
                    <input
                      type="number"
                      value={ad.max_daily ?? 10}
                      onChange={(e) => handleUpdateAdField(ad.id, 'max_daily', Number(e.target.value))}
                      className="w-full bg-[#12121D] border border-[#2B2B3D] rounded-xl px-2.5 py-1.5 text-xs text-gray-200 font-mono font-bold outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Prominent Save All Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSaveAllAds}
              disabled={savingAds}
              className="w-full py-3.5 btn-3d-gold text-black font-black uppercase text-xs rounded-2xl flex items-center justify-center space-x-2 shadow-gold-glow active:scale-[0.98] transition-all"
            >
              <Save size={16} />
              <span>{savingAds ? 'Saving Changes to Database...' : '💾 Save All Ads Settings'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 6: USERS MANAGEMENT, COIN ADJUSTMENTS & GIFTS */}
      {activeAdminTab === 'users' && (
        <div className="box-3d p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-[#252535] pb-2">
            <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-heading flex items-center space-x-1.5">
              <Users size={15} />
              <span>User Manager &amp; Balance Adjuster</span>
            </h3>
            <span className="text-[10px] text-gray-400 font-mono">Total: {userResults.length}</span>
          </div>

          <form onSubmit={handleSearchUser} className="flex space-x-2">
            <input
              type="text"
              placeholder="Search by User ID, Username, or Name..."
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                // Real-time local search or fetch
                api.get(`/admin/users?query=${encodeURIComponent(e.target.value)}`).then(res => {
                  if (res.data.success) setUserResults(res.data.users || []);
                }).catch(() => {});
              }}
              className="flex-1 bg-[#0D0D14] border border-[#2B2B3D] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono focus:border-yellow-400"
            />
            <button type="submit" className="btn-3d-cyan px-4 py-2 rounded-xl text-xs font-black text-black">
              <Search size={14} />
            </button>
          </form>

          {/* User Results / Full List */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {userResults.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No users found</p>
            ) : (
              userResults.map((u) => (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    selectedUser?.id === u.id
                      ? 'bg-[#1D1D2C] border-yellow-400/80 shadow-[0_0_15px_rgba(250,204,21,0.25)]'
                      : 'bg-[#14141E] border-[#252535] hover:border-gray-600'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-black text-white truncate">{u.first_name} {u.last_name || ''}</div>
                    <div className="text-[10px] text-yellow-400 font-mono truncate">@{u.username || 'no_user'} (UID: {u.id})</div>
                    <div className="text-[9px] text-gray-400 font-mono flex items-center space-x-2 mt-0.5">
                      <span>👥 Ref: <b className="text-cyan-400">{u.total_referrals || 0}</b></span>
                      <span>•</span>
                      <span>Gate: <b className={u.is_mandatory_verified ? "text-emerald-400" : "text-amber-400"}>{u.is_mandatory_verified ? 'Verified ✅' : 'Pending ⏳'}</b></span>
                      {u.referrer_id && <span>• RefBy: <b className="text-purple-400">{u.referrer_id}</b></span>}
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold shrink-0">
                    <span className="text-cyan-400 block font-numbers">{u.diamonds?.toLocaleString() || 0} 💎</span>
                    <span className="text-emerald-400 block font-numbers">${u.usdt || '0.000'} USDT</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* User Modifier (+ / - Coins) & Gift System */}
          {selectedUser && (
            <div className="space-y-4 pt-2">
              {/* User Overview Card */}
              <div className="p-3 bg-[#10101A] border border-[#252535] rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-sm">{selectedUser.first_name} {selectedUser.last_name || ''}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${selectedUser.is_mandatory_verified ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                    {selectedUser.is_mandatory_verified ? '✅ Mandatory Gate Passed' : '⏳ Gate Not Verified'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 font-mono pt-1">
                  <div>UID: <span className="text-white font-bold">{selectedUser.id}</span></div>
                  <div>Username: <span className="text-white font-bold">@{selectedUser.username || 'none'}</span></div>
                  <div>Total Referrals: <span className="text-cyan-400 font-bold">{selectedUser.total_referrals || 0}</span></div>
                  <div>Referral Earnings: <span className="text-emerald-400 font-bold">{selectedUser.referral_earnings_diamonds || 0} 💎</span></div>
                  <div>Referred By: <span className="text-purple-400 font-bold">{selectedUser.referrer_id || 'None (Direct)'}</span></div>
                  <div>Ads Watched: <span className="text-yellow-400 font-bold">{selectedUser.total_ads_watched || 0}</span></div>
                </div>
              </div>

              {/* 1. Add / Deduct Coins Form with Live User Balance */}
              <form onSubmit={handleAdminAdjustBalance} className="badge-3d p-3.5 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-yellow-400 uppercase">
                    Adjust Balance (+ / -) for {selectedUser.first_name}
                  </h4>
                  <span className="text-[10px] text-gray-400 font-mono">ID: {selectedUser.id}</span>
                </div>

                {/* Selected User's Current Balance Badges inside the Adjustment Box */}
                <div className="bg-[#0D0D14] border border-[#232333] rounded-2xl p-2.5 grid grid-cols-3 gap-2 text-center">
                  <div className={`p-2 rounded-xl border transition-all ${balanceAdjust.type === 'diamonds' ? 'border-yellow-500/60 bg-yellow-500/15' : 'border-[#1C1C2A] bg-[#12121C]'}`}>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">💎 GEMS</div>
                    <div className="text-sm font-black text-yellow-400 font-mono mt-0.5">{selectedUser.diamonds ?? 0}</div>
                  </div>
                  <div className={`p-2 rounded-xl border transition-all ${balanceAdjust.type === 'usdt' ? 'border-emerald-500/60 bg-emerald-500/15' : 'border-[#1C1C2A] bg-[#12121C]'}`}>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">💵 USDT</div>
                    <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">${Number(selectedUser.usdt || 0).toFixed(4)}</div>
                  </div>
                  <div className={`p-2 rounded-xl border transition-all ${balanceAdjust.type === 'keys' ? 'border-amber-500/60 bg-amber-500/15' : 'border-[#1C1C2A] bg-[#12121C]'}`}>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">🗝️ Keys</div>
                    <div className="text-sm font-black text-amber-400 font-mono mt-0.5">{selectedUser.keys ?? 0}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={balanceAdjust.type}
                    onChange={(e) => setBalanceAdjust({ ...balanceAdjust, type: e.target.value })}
                    className="bg-[#14141E] border border-[#2B2B3D] rounded-xl p-2 text-xs text-white font-bold"
                  >
                    <option value="diamonds">Diamonds (💎)</option>
                    <option value="usdt">USDT ($)</option>
                    <option value="keys">Keys (🗝️)</option>
                  </select>

                  <select
                    value={balanceAdjust.action}
                    onChange={(e) => setBalanceAdjust({ ...balanceAdjust, action: e.target.value })}
                    className="bg-[#14141E] border border-[#2B2B3D] rounded-xl p-2 text-xs text-white font-bold"
                  >
                    <option value="add">Add (+)</option>
                    <option value="deduct">Deduct (-)</option>
                  </select>
                </div>

                <div className="flex justify-between items-center text-[10px] text-gray-400 px-1 font-mono">
                  <span>Target: <strong className="text-white capitalize">{balanceAdjust.type}</strong> ({balanceAdjust.action === 'add' ? '+ Add' : '- Deduct'})</span>
                  <span>Current Balance: <strong className="text-yellow-400 font-bold">
                    {balanceAdjust.type === 'diamonds' ? `${selectedUser.diamonds ?? 0} 💎` : balanceAdjust.type === 'usdt' ? `$${Number(selectedUser.usdt || 0).toFixed(4)}` : `${selectedUser.keys ?? 0} 🗝️`}
                  </strong></span>
                </div>

                <input
                  type="number"
                  step="0.01"
                  placeholder="Enter Amount to Add/Deduct..."
                  value={balanceAdjust.amount}
                  onChange={(e) => setBalanceAdjust({ ...balanceAdjust, amount: e.target.value })}
                  className="w-full bg-[#14141E] border border-[#2B2B3D] rounded-xl px-3 py-2 text-xs text-white font-mono"
                />

                <button
                  type="submit"
                  className="w-full btn-3d-gold py-2.5 rounded-xl text-xs font-black uppercase"
                >
                  Apply Balance Adjustment
                </button>
              </form>

              {/* 2. Send Gift with Custom Note Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const giftAmt = prompt(`Enter Gift Amount for ${selectedUser.first_name}:`, '1000');
                  if (!giftAmt) return;
                  const giftNote = prompt('Enter Custom Message / Note for user:', 'Special Hunter Reward! 🎁');
                  try {
                    const res = await api.post('/admin/user/gift', {
                      userId: selectedUser.id,
                      type: 'diamonds',
                      amount: Number(giftAmt),
                      note: giftNote
                    });
                    if (res.data.success) {
                      setSelectedUser(res.data.user);
                      triggerHaptic('notification', 'success');
                      setFeedback({ type: 'success', text: `Gift of ${giftAmt} 💎 sent to ${selectedUser.first_name} — they'll see a claim popup, and the balance is added once they tap "Claim Gift".` });
                    }
                  } catch (err) {
                    alert(err.response?.data?.error || 'Failed to send gift');
                  }
                }}
                className="box-3d-cyan p-3.5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-cyan-300 uppercase flex items-center space-x-1.5">
                    <Gift size={15} />
                    <span>Send Reward Gift With Custom Note</span>
                  </span>
                </div>
                <p className="text-[11px] text-gray-300">
                  Send bonus Diamonds, USDT, or Keys directly to this user with a custom admin note message.
                </p>
                <button
                  type="submit"
                  className="w-full btn-3d-cyan py-2.5 rounded-xl text-xs font-black uppercase"
                >
                  🎁 Send Gift With Note
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 4. WITHDRAWALS MANAGEMENT (7-Field Table with Persistent 1-Click Copy) */}
      {activeAdminTab === 'withdrawals' && (
        <div className="box-3d p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-heading">
              Withdrawal Requests ({withdrawalsList.length})
            </h3>
            <button
              onClick={loadAllAdminData}
              className="text-[10px] text-cyan-400 font-bold hover:underline flex items-center space-x-1"
            >
              <RefreshCw size={11} />
              <span>Refresh</span>
            </button>
          </div>

          {withdrawalsList.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">No payout requests in the queue</p>
          ) : (
            <div className="space-y-3">
              {withdrawalsList.map((w) => {
                const userKey = `user_${w.id}`;
                const addrKey = `addr_${w.id}`;
                const isUserCopied = !!copiedKeys[userKey];
                const isAddrCopied = !!copiedKeys[addrKey];

                return (
                  <div key={w.id} className="badge-3d p-3.5 space-y-2.5 text-xs font-sans">
                    {/* Header: Amount, Diamonds & Status */}
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-black text-emerald-400 font-numbers text-base">
                          ${w.amount_usdt} USDT
                        </span>
                        <span className="text-[11px] font-black text-cyan-300 bg-cyan-950/70 border border-cyan-500/40 px-2 py-0.5 rounded-lg flex items-center space-x-1 font-numbers">
                          <span>💎</span>
                          <span>{(w.amount_diamonds || Math.round(Number(w.amount_usdt) / 0.00004)).toLocaleString()} Diamonds</span>
                        </span>
                        <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/40 font-bold">
                          {w.network}
                        </span>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black font-numbers ${
                        w.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        w.status === 'rejected' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                      }`}>
                        {w.status}
                      </span>
                    </div>

                    {/* Diamond Cost Breakdown Card */}
                    <div className="bg-[#12121A] border border-[#252535] p-2.5 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-gray-400 block font-bold uppercase">Converted Diamond Cost</span>
                        <span className="text-xs font-black text-cyan-300 font-numbers flex items-center space-x-1">
                          <span>💎 {(w.amount_diamonds || Math.round(Number(w.amount_usdt) / 0.00004)).toLocaleString()} Diamonds</span>
                          <span className="text-gray-400 text-[10px] font-normal font-mono">(= ${w.amount_usdt} USDT)</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Rate: 25,000 💎 = $1.00
                      </span>
                    </div>

                    {/* 1. Username & UID with Persistent 1-Click Copy */}
                    <div className="bg-[#12121A] border border-[#252535] p-2.5 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-gray-400 block font-bold uppercase">1. User &amp; UID</span>
                        <span className="text-xs font-black text-white font-mono">
                          {w.username || 'Hunter'} (UID: {w.uid || w.user_id})
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyPersistent(w.username ? w.username.replace('@', '') : w.user_id, userKey)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                          isUserCopied ? 'bg-emerald-500 text-black font-mono shadow-sm' : 'btn-3d-dark text-gray-300'
                        }`}
                      >
                        {isUserCopied ? 'Copied ✓' : 'Copy User'}
                      </button>
                    </div>

                    {/* 2. Wallet Address with Persistent 1-Click Copy */}
                    <div className="bg-[#12121A] border border-[#252535] p-2.5 rounded-xl flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-[10px] text-gray-400 block font-bold uppercase">2. {w.network} Destination</span>
                        <span className="text-xs font-bold text-yellow-300 font-mono break-all block">
                          {w.wallet_address}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyPersistent(w.wallet_address, addrKey)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase shrink-0 transition-all ${
                          isAddrCopied ? 'bg-emerald-500 text-black font-mono shadow-sm' : 'btn-3d-gold text-black'
                        }`}
                      >
                        {isAddrCopied ? 'Copied ✓' : 'Copy Address'}
                      </button>
                    </div>

                    {/* 3. Timestamp */}
                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono px-1">
                      <span>Submitted Time:</span>
                      <span className="text-gray-300 font-bold">{new Date(w.timestamp || w.created_at).toLocaleString()}</span>
                    </div>

                    {/* 4. Action Buttons (Approve / Reject) */}
                    {w.status === 'pending' && (
                      <div className="flex space-x-2 pt-1">
                        <button
                          onClick={() => handleUpdateWithdrawal(w.id, 'approved')}
                          disabled={updatingWdId === w.id}
                          className={`flex-1 btn-3d-green py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
                            updatingWdId === w.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {updatingWdId === w.id ? 'Approving...' : '✓ Approve Payout'}
                        </button>
                        <button
                          onClick={() => handleUpdateWithdrawal(w.id, 'rejected')}
                          disabled={updatingWdId === w.id}
                          className={`flex-1 btn-3d-dark text-rose-400 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
                            updatingWdId === w.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {updatingWdId === w.id ? 'Rejecting...' : '✕ Reject Payout'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: SYSTEM MAINTENANCE CONTROL */}
      {activeAdminTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="box-3d p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#252535] pb-2.5">
              <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wider font-heading flex items-center space-x-2">
                <Wrench size={16} />
                <span>System Maintenance Control</span>
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-heading ${
                maintenanceMode
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                {maintenanceMode ? 'ACTIVE (LOCKED)' : 'LIVE (OPEN)'}
              </span>
            </div>

            {/* Big Status Banner */}
            <div className={`p-4 rounded-2xl border-2 transition-all ${
              maintenanceMode
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  maintenanceMode
                    ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                    : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                }`}>
                  {maintenanceMode ? <ShieldAlert size={26} /> : <CheckCircle2 size={26} />}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-black uppercase font-heading">
                    {maintenanceMode ? 'Maintenance Mode is Active' : 'Application is Online & Live'}
                  </h4>
                  <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
                    {maintenanceMode
                      ? 'All standard users are blocked by the 3D Maintenance Screen. Only your Admin session (UID: 7780774047) can bypass and test.'
                      : 'All players can freely log in, complete tasks, open chests, play games, and manage wallets.'}
                  </p>
                </div>
              </div>

              {/* Instant Switch Button */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Toggle Maintenance State:</span>
                <button
                  type="button"
                  onClick={() => handleToggleMaintenance()}
                  disabled={updatingMaintenance}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider font-heading flex items-center space-x-1.5 active:scale-95 transition-all ${
                    maintenanceMode
                      ? 'btn-3d-green text-white shadow-lg'
                      : 'btn-3d-dark text-rose-400 border border-rose-500/50 hover:bg-rose-950/50'
                  }`}
                >
                  <Power size={14} />
                  <span>
                    {updatingMaintenance
                      ? 'Updating...'
                      : maintenanceMode
                      ? 'Deactivate (Open App)'
                      : 'Activate (Lock App)'}
                  </span>
                </button>
              </div>
            </div>

            {/* Custom Notice Message Configuration */}
            <div className="space-y-2 pt-1">
              <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                Maintenance Notice Message (English)
              </label>
              <textarea
                rows={3}
                value={maintenanceNotice}
                onChange={(e) => setMaintenanceNotice(e.target.value)}
                placeholder="e.g. We are upgrading server infrastructure to add new game modes and features! Please stay tuned in our community."
                className="w-full bg-[#0D0D14] border border-[#2B2B3D] rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none focus:border-yellow-500 resize-none font-medium"
              />
              <p className="text-[10px] text-gray-400 leading-normal">
                This message is displayed directly on the 3D Maintenance Screen to all blocked users in English.
              </p>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => handleToggleMaintenance(maintenanceMode)}
                  disabled={updatingMaintenance}
                  className="flex-1 btn-3d-gold py-2.5 rounded-xl text-xs font-black uppercase flex items-center justify-center space-x-1.5"
                >
                  <Save size={14} />
                  <span>{updatingMaintenance ? 'Saving...' : 'Save Notice Message'}</span>
                </button>
              </div>
            </div>

            {/* Admin Guidance / Explainer Box */}
            <div className="bg-[#121624] border border-[#222C42] rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center space-x-1.5 text-yellow-400 font-black uppercase text-[10px]">
                <Sparkles size={13} />
                <span>How Maintenance Mode Works</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-gray-300 list-disc list-inside">
                <li>
                  <strong className="text-white">Admin Exemption:</strong> Your admin ID (<span className="font-mono text-yellow-300">7780774047</span>) will NEVER be blocked. You can test new updates inside the Mini App.
                </li>
                <li>
                  <strong className="text-white">3D Lock Screen:</strong> Regular users see an eye-catching English maintenance screen with official Telegram community buttons.
                </li>
                <li>
                  <strong className="text-white">Auto-Unlock:</strong> As soon as you click <span className="text-emerald-400 font-bold">Deactivate</span>, users' screens will auto-refresh and open without requiring manual reinstall.
                </li>
                <li>
                  <strong className="text-white">Safety:</strong> All user balances, diamonds, keys, and tasks remain 100% safe in the database.
                </li>
              </ul>
            </div>

            {/* MongoDB Storage & TTL Auto-Cleanup Control Card */}
            <div className="bg-[#121624] border border-[#222C42] rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-cyan-400 font-black uppercase text-xs">
                  <Database size={16} />
                  <span>Database Storage & Auto-Cleanup (TTL)</span>
                </div>
                {storageStats && (
                  <span className="text-[10px] font-mono text-gray-400 font-bold bg-[#0A0D18] px-2 py-0.5 rounded border border-[#1E2638]">
                    {storageStats.sizeInKb} KB
                  </span>
                )}
              </div>

              <p className="text-[11px] text-gray-300 leading-relaxed">
                Automated TTL keeps MongoDB storage lean and fast. Active users' balances and coins are 100% safe. Users offline for <strong>2 months (60 days)</strong> are automatically purged; if they return, their profile starts fresh as a new user.
              </p>

              {/* Stats Grid */}
              {storageStats ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#0A0D18] p-2.5 rounded-xl border border-[#1E2638]">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Active Users (60d)</span>
                    <span className="text-sm font-black text-emerald-400 font-numbers">{storageStats.activeUsers}</span>
                  </div>

                  <div className="bg-[#0A0D18] p-2.5 rounded-xl border border-[#1E2638]">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Inactive Users (&gt;60d)</span>
                    <span className="text-sm font-black text-amber-400 font-numbers">{storageStats.inactiveUsers}</span>
                  </div>

                  <div className="bg-[#0A0D18] p-2.5 rounded-xl border border-[#1E2638]">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Ad Logs (&gt;7d Purged)</span>
                    <span className="text-sm font-black text-cyan-300 font-numbers">{storageStats.adLogsCount}</span>
                  </div>

                  <div className="bg-[#0A0D18] p-2.5 rounded-xl border border-[#1E2638]">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Broadcast Queue</span>
                    <span className="text-sm font-black text-purple-300 font-numbers">{storageStats.broadcastQueueCount}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 text-xs text-gray-400">Loading storage statistics...</div>
              )}

              {storageFeedback && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 ${
                  storageFeedback.type === 'success' ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300' : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                }`}>
                  <Sparkles size={14} />
                  <span>{storageFeedback.text}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleTriggerStorageCleanup}
                disabled={cleaningStorage}
                className="w-full btn-3d-cyan py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 text-black"
              >
                <Trash2 size={14} className={cleaningStorage ? 'animate-spin' : ''} />
                <span>{cleaningStorage ? 'Cleaning Storage...' : 'Clean Inactive Users & Junk Storage Now'}</span>
              </button>

              <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 font-mono">
                <span>Last auto-cleanup:</span>
                <span className="text-gray-300">{storageStats?.lastCleanup ? (storageStats.lastCleanup === 'Never' ? 'Daily at 9:00 AM BST' : new Date(storageStats.lastCleanup).toLocaleTimeString()) : 'Daily at 9:00 AM BST'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
