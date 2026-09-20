import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import LuxuryTreasureChest from '../components/LuxuryTreasureChest';
import PromoModal from '../components/PromoModal';
import StoreModal from '../components/StoreModal';
import DailyModal from '../components/DailyModal';
import {
  Tv,
  ClipboardList,
  Gift,
  Sparkles,
  Wallet,
  User,
  ChevronRight,
  ShoppingBag,
  Calendar
} from 'lucide-react';
import { triggerHaptic, getPromoCodeFromStartParam } from '../services/telegram';

export default function HomePage() {
  const { setActiveTab, openWallet, t } = useApp();
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [promoCodeParam, setPromoCodeParam] = useState('');
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [dailyModalOpen, setDailyModalOpen] = useState(false);

  useEffect(() => {
    const promoCode = getPromoCodeFromStartParam();
    if (promoCode) {
      setPromoCodeParam(promoCode);
      setPromoModalOpen(true);
    }
  }, []);

  const handleAction = (action) => {
    triggerHaptic('selection');
    if (action === 'wallet') {
      openWallet('convert');
    } else if (action === 'store') {
      setStoreModalOpen(true);
    } else if (action === 'daily') {
      setDailyModalOpen(true);
    } else {
      setActiveTab(action);
    }
  };

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto flex flex-col justify-between">
      <div>
        {/* User Profile Header */}
        <Header />

        {/* Center Section: 3D Chest with 3D Action Buttons */}
        <div className="relative px-2.5 mt-1">
          <div className="grid grid-cols-6 gap-1.5 items-center">
            {/* Left 4 3D Action Buttons: Daily, Ads, Tasks, Refer */}
            <div className="col-span-1 flex flex-col space-y-2 z-10">
              <button
                onClick={() => handleAction('daily')}
                className="btn-3d-dark flex flex-col items-center justify-center p-1.5 rounded-2xl relative group"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-0.5 animate-periodic-shake">
                  <Calendar size={15} />
                </div>
                <span className="text-[9px] font-heading font-black text-amber-300 text-center leading-tight uppercase tracking-tight">{t('daily_btn')}</span>
              </button>

              <button
                onClick={() => handleAction('tasks')}
                className="btn-3d-dark flex flex-col items-center justify-center p-1.5 rounded-2xl"
              >
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-0.5">
                  <Tv size={15} />
                </div>
                <span className="text-[9px] font-heading font-black text-gray-200 text-center leading-tight uppercase tracking-tight">{t('ads_btn')}</span>
              </button>

              <button
                onClick={() => handleAction('tasks')}
                className="btn-3d-dark flex flex-col items-center justify-center p-1.5 rounded-2xl"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-0.5">
                  <ClipboardList size={15} />
                </div>
                <span className="text-[9px] font-heading font-black text-gray-200 text-center leading-tight uppercase tracking-tight">{t('tasks_btn')}</span>
              </button>

              <button
                onClick={() => handleAction('refer')}
                className="btn-3d-dark flex flex-col items-center justify-center p-1.5 rounded-2xl"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-0.5">
                  <Gift size={15} />
                </div>
                <span className="text-[9px] font-heading font-black text-gray-200 text-center leading-tight uppercase tracking-tight">{t('refer_btn')}</span>
              </button>
            </div>

            {/* Center: Luxury 3D Treasure Chest */}
            <div className="col-span-4 flex justify-center">
              <LuxuryTreasureChest />
            </div>

            {/* Right 4 3D Action Buttons: Store, Games, Wallet, Profile */}
            <div className="col-span-1 flex flex-col space-y-2 z-10">
              <button
                onClick={() => handleAction('store')}
                className="btn-3d-gold flex flex-col items-center justify-center p-1.5 rounded-2xl relative group shadow-gold-glow"
              >
                <div className="w-8 h-8 rounded-xl bg-black/20 border border-yellow-200/40 flex items-center justify-center text-black mb-0.5">
                  <ShoppingBag size={15} />
                </div>
                <span className="text-[9px] font-heading font-black text-black text-center leading-tight uppercase tracking-tight">{t('store_btn')}</span>
              </button>

              <button
                onClick={() => handleAction('play')}
                className="btn-3d-dark flex flex-col items-center justify-center p-1.5 rounded-2xl"
              >
                <div className="w-8 h-8 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 mb-0.5">
                  <Sparkles size={15} />
                </div>
                <span className="text-[9px] font-heading font-black text-gray-200 text-center leading-tight uppercase tracking-tight">{t('games_btn')}</span>
              </button>

              <button
                onClick={() => handleAction('wallet')}
                className="btn-3d-dark flex flex-col items-center justify-center p-1.5 rounded-2xl"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-0.5">
                  <Wallet size={15} />
                </div>
                <span className="text-[9px] font-heading font-black text-gray-200 text-center leading-tight uppercase tracking-tight">{t('wallet_btn')}</span>
              </button>

              <button
                onClick={() => handleAction('profile')}
                className="btn-3d-dark flex flex-col items-center justify-center p-1.5 rounded-2xl"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-0.5">
                  <User size={15} />
                </div>
                <span className="text-[9px] font-heading font-black text-gray-200 text-center leading-tight uppercase tracking-tight">{t('profile_btn')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Promo Code Box + Invite Friends Banner */}
      <div className="px-4 space-y-2.5 mt-2 font-sans">
        {/* 1. Have a Promo Code Card */}
        <div
          onClick={() => {
            triggerHaptic('selection');
            setPromoModalOpen(true);
          }}
          className="cursor-pointer bg-[#171424] border border-[#2f274a] rounded-2xl p-3.5 flex items-center justify-between shadow-md hover:border-purple-500/50 transition-all active:scale-[0.99]"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#241d33] border border-[#3c3157] flex items-center justify-center text-xl shadow-inner">
              🎁
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#a78bfa] tracking-wide">
                {t('have_promo')}
              </h4>
              <p className="text-[11px] text-[#8e85a6] font-medium">
                {t('redeem_promo_sub')}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 bg-[#0f292c] border border-[#14535a] hover:bg-[#133d42] text-[#00e5ff] px-3.5 py-1.5 rounded-full text-xs font-black transition-all font-heading">
            <span>{t('redeem_btn')}</span>
            <ChevronRight size={14} />
          </div>
        </div>

        {/* 2. Bottom Lifetime Commission Promo Banner */}
        <div
          onClick={() => handleAction('refer')}
          className="cursor-pointer box-3d-gold p-4 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl btn-3d-gold flex items-center justify-center">
              <Gift size={22} className="text-black" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-heading font-black text-yellow-400 uppercase tracking-wide">{t('invite_friends')}</span>
                <span className="text-[9px] bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 px-2 py-0.5 rounded-full font-numbers font-black">{t('lifetime_badge')}</span>
              </div>
              <p className="text-[11px] text-gray-300 mt-0.5 font-medium">{t('invite_friends_sub')}</p>
            </div>
          </div>
          <ChevronRight className="text-yellow-400" size={20} />
        </div>
      </div>

      {/* Modals */}
      <PromoModal
        isOpen={promoModalOpen}
        onClose={() => setPromoModalOpen(false)}
        initialCode={promoCodeParam}
      />
      <StoreModal isOpen={storeModalOpen} onClose={() => setStoreModalOpen(false)} />
      <DailyModal isOpen={dailyModalOpen} onClose={() => setDailyModalOpen(false)} />
    </div>
  );
}
