import React from 'react'; 
import { useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import TasksPage from './pages/TasksPage';
import PlayPage from './pages/PlayPage';
import ReferPage from './pages/ReferPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './components/AdminDashboard';
import WalletModal from './components/WalletModal';
import ContactAdminModal from './components/ContactAdminModal';
import GiftClaimModal from './components/GiftClaimModal';
import ThreeCanvas from './components/ThreeCanvas';
import SectionLoader from './components/SectionLoader';
import LanguageModal from './components/LanguageModal';
import TonConnectModal from './components/TonConnectModal';
import MandatoryGateScreen from './components/MandatoryGateScreen';
import SplashScreen from './components/SplashScreen';
import DeviceBlockedScreen from './components/DeviceBlockedScreen';
import IpBlockedScreen from './components/IpBlockedScreen';
import SyncErrorScreen from './components/SyncErrorScreen';
import TelegramOnlyScreen from './components/TelegramOnlyScreen';
import MaintenanceScreen from './components/MaintenanceScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { isInsideTelegram } from './services/telegram';

export default function App() {
  const {
    user,
    setUser,
    isAdmin,
    activeTab,
    loading,
    isTransitioning,
    transitionTab,
    isGatePassed,
    setIsGatePassed,
    duplicateLinkedUser,
    setDuplicateLinkedUser,
    ipConflictUsers,
    setIpConflictUsers,
    syncError,
    fetchUserProfile,
    language,
    setLanguage,
    languageModalOpen,
    setLanguageModalOpen,
    isTonConnectModalOpen,
    setIsTonConnectModalOpen,
    maintenanceActive,
    maintenanceMessage
  } = useApp();

  const [splashFinished, setSplashFinished] = React.useState(false);

  // 1. If opening Admin Panel directly, render Admin without blocking
  if (activeTab === 'admin' || window.location.search.includes('admin=true')) {
    return (
      <div className="min-h-screen bg-[#0A0A0E] text-white selection:bg-yellow-500 selection:text-black relative overflow-x-hidden">
        <main className="flex-1 relative">
          <AdminDashboard />
        </main>
      </div>
    );
  }

  // 2. Guard: Restrict to official Telegram app only (blocks external web browsers)
  if (!isInsideTelegram()) {
    return <TelegramOnlyScreen botUsername="treasure_hunt12_bot" />;
  }

  // 3. Initial 3D Cover Splash Screen with 0%-100% dynamic loading progress
  if (!splashFinished || loading) {
    return <SplashScreen loading={loading} onFinish={() => setSplashFinished(true)} />;
  }

  // 3b. Maintenance Mode Check (Admin UID is strictly exempt)
  if (maintenanceActive && !isAdmin) {
    return (
      <MaintenanceScreen
        message={maintenanceMessage}
        onRefresh={fetchUserProfile}
      />
    );
  }

  // 3c. Sync genuinely failed (auth/network) — show a real error instead of
  // silently rendering the app with `user` missing/incomplete, which
  // several screens would otherwise display as a fake "0 balance".
  if (syncError && !user) {
    return <SyncErrorScreen error={syncError} onRetry={fetchUserProfile} />;
  }

  // 4. Anti-Cheat: Device Already In Use Detection Screen (Strict Suspension)
  if (duplicateLinkedUser || user?.device_conflict) {
    return (
      <DeviceBlockedScreen
        linkedUser={duplicateLinkedUser || user?.device_conflict_linked}
        onRetry={fetchUserProfile}
      />
    );
  }

  // 4b. Anti-Cheat: Same-IP Detection Screen (more than 3 accounts on one IP)
  if (ipConflictUsers) {
    return (
      <IpBlockedScreen
        linkedUsers={ipConflictUsers}
        onRetry={fetchUserProfile}
        onSwitched={(switchedUser) => {
          setUser(switchedUser);
          setIpConflictUsers(null);
        }}
      />
    );
  }

  // 5. Mandatory 3 Community Channels Gate Screen (if not verified yet)
  if (!isGatePassed && !user?.is_mandatory_verified) {
    return <MandatoryGateScreen onVerified={() => setIsGatePassed(true)} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0A0A0E] text-white flex flex-col justify-between selection:bg-yellow-500 selection:text-black relative overflow-x-hidden">
        {/* 3D Global Three.js Floating Diamonds & Stardust Background */}
        <ThreeCanvas />

        {/* Dynamic Tab Transition Loading Overlay */}
        {isTransitioning && <SectionLoader tab={transitionTab || activeTab} />}

        <main className="flex-1 relative">
          {activeTab === 'home' && <HomePage />}
          {activeTab === 'tasks' && <TasksPage />}
          {activeTab === 'play' && <PlayPage />}
          {activeTab === 'refer' && <ReferPage />}
          {activeTab === 'profile' && <ProfilePage />}
          {activeTab === 'admin' && <AdminDashboard />}
        </main>

        {/* Global Bottom Navigation */}
        <Navbar />

        {/* Modals */}
        <WalletModal />
        <ContactAdminModal />
        <GiftClaimModal />
        <LanguageModal
          isOpen={languageModalOpen}
          onClose={() => setLanguageModalOpen(false)}
          currentLang={language}
          onSelectLang={setLanguage}
        />
        <TonConnectModal
          isOpen={isTonConnectModalOpen}
          onClose={() => setIsTonConnectModalOpen(false)}
        />
      </div>
    </ErrorBoundary>
  );
}
