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
import ThreeCanvas from './components/ThreeCanvas';
import SectionLoader from './components/SectionLoader';
import LanguageModal from './components/LanguageModal';
import MandatoryGateScreen from './components/MandatoryGateScreen';
import SplashScreen from './components/SplashScreen';
import DeviceBlockedScreen from './components/DeviceBlockedScreen';
import TelegramOnlyScreen from './components/TelegramOnlyScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { isInsideTelegram } from './services/telegram';

export default function App() {
  const {
    user,
    setUser,
    activeTab,
    loading,
    isTransitioning,
    transitionTab,
    isGatePassed,
    setIsGatePassed,
    duplicateLinkedUser,
    setDuplicateLinkedUser,
    fetchUserProfile,
    language,
    setLanguage,
    languageModalOpen,
    setLanguageModalOpen
  } = useApp();

  // 1. Guard: Restrict to official Telegram app only (blocks external web browsers)
  if (!isInsideTelegram()) {
    return <TelegramOnlyScreen botUsername="treasure_hunt12_bot" />;
  }

  // 2. Initial 3D Cover Splash Screen with 0%-100% dynamic loading progress
  if (!splashFinished || loading) {
    return <SplashScreen onFinish={() => setSplashFinished(true)} />;
  }

  // 3. Anti-Cheat: Device Already In Use Detection Screen (matching UI)
  if (duplicateLinkedUser) {
    return (
      <DeviceBlockedScreen
        linkedUser={duplicateLinkedUser}
        onRetry={fetchUserProfile}
        onSwitched={(switchedUser) => {
          setUser(switchedUser);
          setDuplicateLinkedUser(null);
        }}
      />
    );
  }

  // 4. Mandatory 3 Community Channels Gate Screen (if not verified yet)
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
        <LanguageModal
          isOpen={languageModalOpen}
          onClose={() => setLanguageModalOpen(false)}
          currentLang={language}
          onSelectLang={setLanguage}
        />
      </div>
    </ErrorBoundary>
  );
}

