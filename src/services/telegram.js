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

export function isInsideTelegram() {
  if (typeof window === 'undefined') return false;
  const webapp = window.Telegram?.WebApp;
  if (!webapp) return false;

  const hasInitData = Boolean(webapp.initData && webapp.initData.length > 0);
  const hasUser = Boolean(webapp.initDataUnsafe?.user?.id);
  const isTgPlatform = Boolean(webapp.platform && webapp.platform !== 'unknown');

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalhost) return true;

  return hasInitData || hasUser || isTgPlatform;
}

export function getTelegramInitData() {
  const webapp = typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp 
    ? window.Telegram.WebApp 
    : tg;
  return webapp ? (webapp.initData || '') : '';
}

export function getTelegramUser() {
  const webapp = typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp 
    ? window.Telegram.WebApp 
    : tg;

  if (webapp?.initDataUnsafe?.user?.id) {
    return webapp.initDataUnsafe.user;
  }

  if (webapp?.initData) {
    try {
      const urlParams = new URLSearchParams(webapp.initData);
      const userParam = urlParams.get('user');
      if (userParam) {
        const parsed = JSON.parse(userParam);
        if (parsed?.id) return parsed;
      }
    } catch (e) {}
  }

  // Fallback if opened outside Telegram or testing
  return {
    id: 100000000,
    first_name: 'Hunter',
    last_name: '',
    username: 'player',
    photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Hunter'
  };
}

/**
 * Extract the referral code that was passed when the Mini App was opened via
 * a referral link, e.g. https://t.me/bot/Play?startapp=ref_12345
 *
 * Telegram exposes this as `start_param` on `initDataUnsafe` (and also inside
 * the raw `initData` query string). We also fall back to a normal `?ref=` /
 * `?startapp=` URL query param so the link still works when the Mini App is
 * opened directly in a browser for testing/simulation.
 *
 * Returns the referrer's numeric Telegram user id as a string, or null.
 */
export function getReferrerIdFromStartParam() {
  let startParam = null;

  const webapp = typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : tg;

  // 1) Preferred: Telegram's parsed initDataUnsafe.start_param
  if (webapp?.initDataUnsafe?.start_param) {
    startParam = webapp.initDataUnsafe.start_param;
  }

  // 2) Fallback: parse it out of the raw initData string ourselves
  if (!startParam && webapp?.initData) {
    try {
      const urlParams = new URLSearchParams(webapp.initData);
      startParam = urlParams.get('start_param');
    } catch (e) {}
  }

  // 3) Fallback for browser/dev testing: ?startapp=ref_123 or ?ref=123 in the URL
  if (!startParam && typeof window !== 'undefined') {
    const search = new URLSearchParams(window.location.search);
    startParam = search.get('startapp') || search.get('tgWebAppStartParam') || search.get('ref');
  }

  if (!startParam) return null;

  const match = String(startParam).match(/^ref_(.+)$/);
  const referrerId = match ? match[1] : String(startParam);

  // Never treat garbage/non-numeric-looking ids as a referrer
  if (!/^\d+$/.test(referrerId)) return null;

  return referrerId;
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
