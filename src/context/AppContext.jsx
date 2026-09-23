import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { initTelegram, getTelegramUser, triggerHaptic, getReferrerIdFromStartParam, getOrCreateDeviceId } from '../services/telegram';
import { armAdexiumAutoMode } from '../services/adexium';
import { showGameOrChestAd } from '../services/ads';
import { getTranslation, LANGUAGES } from '../utils/translations';
import confetti from 'canvas-confetti';
 
const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('treasure_hunt_user_cache');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem('treasure_hunt_user_cache');
  });
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'tasks' | 'play' | 'refer' | 'profile' | 'admin'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTab, setTransitionTab] = useState(null);
  const [isGatePassed, setIsGatePassedState] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('treasure_gate_passed') === 'true';
  });

  const setIsGatePassed = (val) => {
    const passed = Boolean(val);
    setIsGatePassedState(passed);
    if (typeof window !== 'undefined') {
      if (passed) {
        localStorage.setItem('treasure_gate_passed', 'true');
      } else {
        localStorage.removeItem('treasure_gate_passed');
      }
    }
  };

  const [duplicateLinkedUser, setDuplicateLinkedUser] = useState(null);
  const [ipConflictUsers, setIpConflictUsers] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  // Multi-Language State (Default: saved language or 'en')
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('treasure_hunt_lang') || 'en';
  });
  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  const setLanguage = (newLang) => {
    setLanguageState(newLang);
    localStorage.setItem('treasure_hunt_lang', newLang);
  };

  const t = (key) => getTranslation(language, key);
  const currentLangObj = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  const [settings, setSettings] = useState({
    rate: 0.00004,
    commission: 0.10,
    minWithdrawal: 1.0
  });

  // Modal states
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletInitialTab, setWalletInitialTab] = useState('convert'); // 'convert' | 'withdraw'
  const [contactAdminModalOpen, setContactAdminModalOpen] = useState(false);
  const [chestModalData, setChestModalData] = useState(null);

  // TON Connect Global State
  const [connectedTonWallet, setConnectedTonWallet] = useState(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('treasure_ton_connected_wallet')) || null;
  });
  const [isTonConnectModalOpen, setIsTonConnectModalOpen] = useState(false);

  const connectTonWallet = (address) => {
    setConnectedTonWallet(address);
    if (typeof window !== 'undefined') {
      localStorage.setItem('treasure_ton_connected_wallet', address);
    }
  };

  const disconnectTonWallet = () => {
    setConnectedTonWallet(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('treasure_ton_connected_wallet');
    }
  };

  const navigateTab = (newTab) => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    setIsTransitioning(false);
    setTransitionTab(null);
  };

  // Initialize Telegram & Fetch User Profile
  const fetchUserProfile = async () => {
    const tgUser = getTelegramUser();
    // Pre-populate with real Telegram User so UI never shows "undefined"
    setUser(prev => ({
      id: tgUser.id,
      first_name: tgUser.first_name || 'Hunter',
      last_name: tgUser.last_name || '',
      username: tgUser.username || '',
      photo_url: tgUser.photo_url || '',
      diamonds: prev?.diamonds ?? 0,
      usdt: prev?.usdt ?? 0.0,
      keys: prev?.keys ?? 15,
      spins: prev?.spins ?? 15,
      total_referrals: prev?.total_referrals ?? 0,
      referral_earnings_diamonds: prev?.referral_earnings_diamonds ?? 0,
      ...prev
    }));

    try {
      setLoading(true);
      // Always go through /user/sync (not /user/me) on load: this is what
      // actually records a referral. If this Mini App was opened via a
      // referral link (?startapp=ref_12345), start_param carries the
      // referrer's id — the referral only gets credited on this call, and
      // only the very first time this user is created, so it's always safe
      // to send it.
      const referrerId = getReferrerIdFromStartParam();
      const deviceId = getOrCreateDeviceId();
      const res = await api.post('/user/sync', { ...(referrerId ? { referrerId } : {}), deviceId });
      if (res.data.success && res.data.user) {
        const syncedUser = {
          ...res.data.user,
          id: res.data.user.id || tgUser.id,
          first_name: res.data.user.first_name || tgUser.first_name || 'Hunter',
          last_name: res.data.user.last_name || tgUser.last_name || '',
          username: res.data.user.username || tgUser.username || '',
          photo_url: res.data.user.photo_url || tgUser.photo_url || ''
        };
        setUser(prev => ({ ...prev, ...syncedUser }));
        try {
          localStorage.setItem('treasure_hunt_user_cache', JSON.stringify(syncedUser));
        } catch (e) {}
        setIsAdmin(res.data.isAdmin);
        // Anti-duplicate-account check: this device is already linked to a
        // different existing account. Block access until the person either
        // switches back to that account or claims this device (resetting
        // this account's balance) — see DeviceBlockedScreen.
        setDuplicateLinkedUser(res.data.isDuplicate ? res.data.linkedUser : null);
        // Same-IP conflict is checked independently of device conflict —
        // only shown if the device isn't already flagged, so the person
        // sees one blocking screen at a time.
        if (!res.data.isDuplicate) {
          setIpConflictUsers(res.data.isIpDuplicate ? res.data.ipLinkedUsers : null);
        }
        if (res.data.user?.is_mandatory_verified) {
          setIsGatePassed(true);
        } else {
          setIsGatePassed(false);
        }
        if (res.data.settings) {
          setSettings(res.data.settings);
        }
        if (res.data.isMaintenance) {
          setMaintenanceActive(true);
        } else {
          setMaintenanceActive(false);
        }
        if (res.data.maintenanceMessage) {
          setMaintenanceMessage(res.data.maintenanceMessage);
        }
        setSyncError(null);
      }
    } catch (err) {
      // Previously this silently did nothing, leaving `user` as null/stale —
      // several screens then rendered `user.diamonds || 0` (or a hardcoded
      // placeholder), which LOOKS exactly like "balance reset to 0" even
      // though nothing in MongoDB was touched. Now we surface the real
      // failure instead of masking it with a fake zero.
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error;
      if (err?.response?.data?.maintenance) {
        setMaintenanceActive(true);
        if (err.response.data.error || err.response.data.message) {
          setMaintenanceMessage(err.response.data.error || err.response.data.message);
        }
      }
      setSyncError({
        status: status || null,
        message: serverMsg || err.message || 'Could not load your profile. Please check your connection and try again.'
      });
      const isParamAdmin = typeof window !== 'undefined' && window.location.search.includes('admin=true');
      setIsAdmin(isParamAdmin);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Catches a device-conflict 403 or maintenance 503 from ANY action (chest open, tasks,
    // wallet, games...), not just the initial sync — see services/api.js.
    const handleDeviceConflict = (e) => setDuplicateLinkedUser(e.detail || {});
    const handleIpConflict = (e) => setIpConflictUsers(e.detail || []);
    const handleMaintenance = (e) => {
      setMaintenanceActive(true);
      if (e.detail?.message || e.detail?.error) {
        setMaintenanceMessage(e.detail.message || e.detail.error);
      }
    };
    window.addEventListener('device-conflict', handleDeviceConflict);
    window.addEventListener('ip-conflict', handleIpConflict);
    window.addEventListener('app-maintenance', handleMaintenance);

    initTelegram();
    fetchUserProfile();
    armAdexiumAutoMode();

    // Check if URL has ?admin=true
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      setActiveTab('admin');
      setIsAdmin(true);
      setIsGatePassed(true);
    }

    return () => {
      window.removeEventListener('device-conflict', handleDeviceConflict);
      window.removeEventListener('ip-conflict', handleIpConflict);
      window.removeEventListener('app-maintenance', handleMaintenance);
    };
  }, []);

  // Action: Open Treasure Chest
  const openChest = async () => {
    if (user?.device_conflict) {
      triggerHaptic('notification', 'error');
      if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert('Your account has been suspended');
      } else {
        alert('Your account has been suspended');
      }
      return;
    }

    if (!user || user.keys <= 0) {
      triggerHaptic('notification', 'error');
      alert('You have 0 keys left! Keys reset daily or can be earned through tasks.');
      return;
    }

    try {
      triggerHaptic('impact', 'heavy');
      const { watchStartedAt } = await showGameOrChestAd({ flowKey: 'chest' });
      const res = await api.post('/chest/open', { watchStartedAt });
      if (res.data.success) {
        setUser(res.data.user);
        setChestModalData({
          rewardType: res.data.rewardType,
          rewardAmount: res.data.rewardAmount,
          remainingKeys: res.data.remainingKeys
        });

        // Trigger confetti celebration
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      triggerHaptic('notification', 'error');
      alert(err.response?.data?.error || 'Failed to open chest');
    }
  };

  // Action: Convert Diamonds to USDT
  const convertDiamonds = async (amount) => {
    try {
      const res = await api.post('/wallet/convert', { amountDiamonds: amount });
      if (res.data.success) {
        setUser(res.data.user);
        triggerHaptic('notification', 'success');
        return { success: true, conversion: res.data.conversion };
      }
    } catch (err) {
      triggerHaptic('notification', 'error');
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to convert diamonds'
      };
    }
  };

  // Action: Request Withdrawal
  const requestWithdrawal = async (amountUsdt, network, walletAddress) => {
    try {
      const res = await api.post('/wallet/withdraw', {
        amountUsdt,
        network,
        walletAddress
      });
      if (res.data.success) {
        setUser(res.data.user);
        triggerHaptic('notification', 'success');
        return { success: true, withdrawal: res.data.withdrawal };
      }
    } catch (err) {
      triggerHaptic('notification', 'error');
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to submit withdrawal'
      };
    }
  };

  const openWallet = (tab = 'convert') => {
    setWalletInitialTab(tab);
    setWalletModalOpen(true);
    triggerHaptic('selection');
  };

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        isAdmin,
        loading,
        activeTab,
        setActiveTab: navigateTab,
        setActiveTabDirect: setActiveTab,
        isTransitioning,
        transitionTab,
        isGatePassed,
        setIsGatePassed,
        duplicateLinkedUser,
        setDuplicateLinkedUser,
        ipConflictUsers,
        setIpConflictUsers,
        syncError,
        language,
        setLanguage,
        t,
        currentLangObj,
        languageModalOpen,
        setLanguageModalOpen,
        settings,
        fetchUserProfile,
        openChest,
        convertDiamonds,
        requestWithdrawal,
        walletModalOpen,
        setWalletModalOpen,
        walletInitialTab,
        openWallet,
        contactAdminModalOpen,
        setContactAdminModalOpen,
        chestModalData,
        setChestModalData,
        connectedTonWallet,
        connectTonWallet,
        disconnectTonWallet,
        isTonConnectModalOpen,
        setIsTonConnectModalOpen,
        maintenanceActive,
        setMaintenanceActive,
        maintenanceMessage,
        setMaintenanceMessage
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
