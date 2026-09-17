import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { initTelegram, getTelegramUser, triggerHaptic } from '../services/telegram';
import { getTranslation, LANGUAGES } from '../utils/translations';
import confetti from 'canvas-confetti';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'tasks' | 'play' | 'refer' | 'profile' | 'admin'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTab, setTransitionTab] = useState(null);
  const [isGatePassed, setIsGatePassed] = useState(false);
  const [duplicateLinkedUser, setDuplicateLinkedUser] = useState(null);

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

  const navigateTab = (newTab) => {
    if (newTab === activeTab) return;
    setTransitionTab(newTab);
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTab(newTab);
      setIsTransitioning(false);
      setTransitionTab(null);
    }, 380);
  };

  // Initialize Telegram & Fetch User Profile
  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/user/me');
      if (res.data.success) {
        setUser(res.data.user);
        setIsAdmin(res.data.isAdmin);
        if (res.data.user?.is_mandatory_verified) {
          setIsGatePassed(true);
        }
        if (res.data.settings) {
          setSettings(res.data.settings);
        }
      }
      // Anti-Cheat: Check duplicate device binding
      try {
        let deviceId = localStorage.getItem('treasure_device_id');
        if (!deviceId) {
          deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
          localStorage.setItem('treasure_device_id', deviceId);
        }
        const devRes = await api.post('/user/device-check', { deviceId });
        if (devRes.data.isDuplicate) {
          setDuplicateLinkedUser(devRes.data.linkedUser);
        } else {
          setDuplicateLinkedUser(null);
        }
      } catch (devErr) {
        console.warn('Device check warning:', devErr);
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      // Fallback local state if server is connecting
      const tgUser = getTelegramUser();
      setUser({
        id: tgUser.id,
        first_name: tgUser.first_name || 'Hunter',
        username: tgUser.username || '',
        photo_url: tgUser.photo_url || '',
        diamonds: 0,
        usdt: 0.0,
        keys: 15,
        spins: 15,
        total_referrals: 0,
        referral_earnings_diamonds: 0
      });
      setIsAdmin(String(tgUser.id) === '5697990319');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initTelegram();
    fetchUserProfile();

    // Check if URL has ?admin=true
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      setActiveTab('admin');
    }
  }, []);

  // Action: Open Treasure Chest
  const openChest = async () => {
    if (!user || user.keys <= 0) {
      triggerHaptic('notification', 'error');
      alert('You have 0 keys left! Keys reset daily or can be earned through tasks.');
      return;
    }

    try {
      triggerHaptic('impact', 'heavy');
      const res = await api.post('/chest/open');
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
        setChestModalData
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
