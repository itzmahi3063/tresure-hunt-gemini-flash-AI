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
  const [isGatePassed, setIsGatePassedState] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('treasure_gate_passed') === 'true';
  });

  const setIsGatePassed = (val) => {
    setIsGatePassedState(Boolean(val));
    if (val && typeof window !== 'undefined') {
      localStorage.setItem('treasure_gate_passed', 'true');
    }
  };

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
      const res = await api.get('/user/me');
      if (res.data.success && res.data.user) {
        setUser(prev => ({
          ...prev,
          ...res.data.user,
          id: res.data.user.id || tgUser.id,
          first_name: res.data.user.first_name || tgUser.first_name || 'Hunter',
          last_name: res.data.user.last_name || tgUser.last_name || '',
          username: res.data.user.username || tgUser.username || '',
          photo_url: res.data.user.photo_url || tgUser.photo_url || ''
        }));
        setIsAdmin(res.data.isAdmin);
        if (res.data.user?.is_mandatory_verified) {
          setIsGatePassed(true);
        }
        if (res.data.settings) {
          setSettings(res.data.settings);
        }
      }
    } catch (err) {
      const isParamAdmin = typeof window !== 'undefined' && window.location.search.includes('admin=true');
      setIsAdmin(isParamAdmin);
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
      setIsAdmin(true);
      setIsGatePassed(true);
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
