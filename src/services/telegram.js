/**
 * Telegram WebApp SDK Helper
 */

export const tg = typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp 
  ? window.Telegram.WebApp 
  : null;

export function initTelegram() {
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();
      if (tg.setHeaderColor) {
        tg.setHeaderColor('#0A0A0E');
      }
      if (tg.setBackgroundColor) {
        tg.setBackgroundColor('#0A0A0E');
      }
    } catch (e) {
      console.warn('Telegram WebApp setup error:', e);
    }
  }
}

export function getTelegramInitData() {
  return tg ? tg.initData : '';
}

export function getTelegramUser() {
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    return tg.initDataUnsafe.user;
  }
  // Fallback test user for local browser preview
  return {
    id: 100000001,
    first_name: 'Treasure',
    last_name: 'Hunter',
    username: 'GuestHunter',
    photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=TreasureMaster'
  };
}

export function triggerHaptic(type = 'impact', style = 'medium') {
  if (tg && tg.HapticFeedback) {
    try {
      if (type === 'impact') {
        tg.HapticFeedback.impactOccurred(style);
      } else if (type === 'notification') {
        tg.HapticFeedback.notificationOccurred(style); // 'error', 'success', 'warning'
      } else if (type === 'selection') {
        tg.HapticFeedback.selectionChanged();
      }
    } catch (e) {
      // Haptics optional
    }
  }
}

export function openTelegramLink(url) {
  if (tg && tg.openTelegramLink) {
    tg.openTelegramLink(url);
  } else {
    window.open(url, '_blank');
  }
}

export function openExternalLink(url) {
  if (tg && tg.openLink) {
    tg.openLink(url);
  } else {
    window.open(url, '_blank');
  }
}
