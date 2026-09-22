// Adexium Integration with 1-Minute Session Warmup & Ad Collision Barrier
// Widget ID: 3244f7f7-db89-4f7a-8342-092d462aa3f8
// Auto-mode rules per user request:
//   1. Must NOT trigger until user spends at least 1 MINUTE (60s) in the bot.
//   2. Must NEVER trigger or overlap while user is watching any manual ad (Daily, Chest, Games, Quiz).
//   3. After any manual ad ends, pauses for a cooldown before resuming auto-ads.

import { isManualAdActive, getLastManualAdEndedAt } from './ads';

const ADEXIUM_WIDGET_ID = '3244f7f7-db89-4f7a-8342-092d462aa3f8';
const ONE_MINUTE_SPENT_MS = 60 * 1000; // 1 minute spent requirement
const AUTO_AD_INTERVAL_MS = 45 * 1000; // Normal interval between auto-ads (~45s)
const MANUAL_AD_COOLDOWN_MS = 30 * 1000; // Cooldown after manual ad closes

let sessionStartedAt = Date.now();
let lastAutoAdShownAt = 0;
let isAdexiumShowing = false;
let autoModeIntervalId = null;
let gameInProgress = false;

export function setAdexiumGameInProgress(inProgress) {
  gameInProgress = Boolean(inProgress);
}

export function isAdexiumGameInProgress() {
  return gameInProgress;
}

export function getOrInitAdexiumWidget() {
  if (typeof window === 'undefined') return null;
  if (window.adexiumWidget) return window.adexiumWidget;
  if (typeof window.AdexiumWidget === 'undefined') return null;

  try {
    if (window.Telegram?.WebApp && !window.Telegram.WebView) {
      window.Telegram.WebView = {
        initParams: {
          tgWebAppPlatform: window.Telegram.WebApp.platform || 'android'
        }
      };
    }

    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser && tgUser.id) {
      try {
        localStorage.setItem(
          'tg-ads-co-userData',
          JSON.stringify({
            id: tgUser.id,
            firstName: tgUser.first_name || '',
            lastName: tgUser.last_name || '',
            username: tgUser.username || '',
            language: tgUser.language_code || 'en',
            platform: window.Telegram?.WebApp?.platform || 'android',
            initData: window.Telegram?.WebApp?.initData || ''
          })
        );
      } catch {}
    }

    const widget = new window.AdexiumWidget({
      wid: ADEXIUM_WIDGET_ID,
      adFormat: 'interstitial',
      debug: !(tgUser && tgUser.id)
    });
    window.adexiumWidget = widget;
    return widget;
  } catch (err) {
    console.warn('[Adexium] Init fallback to debug:', err);
    try {
      const widget = new window.AdexiumWidget({
        wid: ADEXIUM_WIDGET_ID,
        adFormat: 'interstitial',
        debug: true
      });
      window.adexiumWidget = widget;
      return widget;
    } catch (e) {
      console.error('[Adexium] Init failed:', e);
      return null;
    }
  }
}

/**
 * Checks all conditions and triggers an auto-ad if safe:
 * - User spent >= 1 minute
 * - No manual ad active (Daily, Chest, Games, Quiz)
 * - No manual ad recently closed (<30s cooldown)
 * - No game in progress
 * - App is visible
 */
async function checkAndTriggerAutoAd() {
  // 1. User must spend at least 1 minute in the bot
  const timeSpent = Date.now() - sessionStartedAt;
  if (timeSpent < ONE_MINUTE_SPENT_MS) {
    return;
  }

  // 2. Prevent concurrent Adexium display
  if (isAdexiumShowing) {
    return;
  }

  // 3. Prevent during active mini-games (Tic-Tac-Toe / Lucky Draw / Quiz solving)
  if (gameInProgress) {
    return;
  }

  // 4. Do not trigger when app/tab is in background
  if (typeof document !== 'undefined' && document.hidden) {
    return;
  }

  // 5. Ad Barrier: check if ANY manual ad is currently active
  if (isManualAdActive()) {
    console.log('[Adexium Auto] Skipped — manual ad is currently playing');
    return;
  }

  // 6. Cooldown: do not trigger right after a manual ad finishes
  const timeSinceManualAd = Date.now() - getLastManualAdEndedAt();
  if (timeSinceManualAd < MANUAL_AD_COOLDOWN_MS) {
    return;
  }

  // 7. Interval check between auto-ads
  const timeSinceLastAuto = Date.now() - lastAutoAdShownAt;
  if (lastAutoAdShownAt > 0 && timeSinceLastAuto < AUTO_AD_INTERVAL_MS) {
    return;
  }

  const widget = getOrInitAdexiumWidget();
  if (!widget) return;

  try {
    console.log('[Adexium Auto] Requesting auto interstitial (1-min spend completed)...');
    const ad = await widget.requestAd('interstitial');

    if (ad && (Array.isArray(ad) ? ad.length > 0 : true)) {
      // Re-check conditions before displaying (in case user clicked a chest or task while requesting)
      if (isManualAdActive() || gameInProgress) {
        console.log('[Adexium Auto] Display cancelled — manual ad started during request');
        return;
      }

      isAdexiumShowing = true;
      lastAutoAdShownAt = Date.now();

      const onClosed = () => {
        isAdexiumShowing = false;
        console.log('[Adexium Auto] Ad closed by user');
      };

      if (typeof widget.on === 'function') {
        widget.on('adClosed', onClosed);
        widget.on('adPlaybackCompleted', onClosed);
      } else if (widget.ee && typeof widget.ee.on === 'function') {
        widget.ee.on('adClosed', onClosed);
        widget.ee.on('adPlaybackCompleted', onClosed);
      }

      console.log('[Adexium Auto] Showing auto interstitial ad');
      widget.displayAd(ad, 'interstitial');
    }
  } catch (err) {
    console.warn('[Adexium Auto] Notice:', err);
    isAdexiumShowing = false;
  }
}

/**
 * Arms Adexium auto-mode:
 * Begins monitoring session time and safely displays auto ads after 1 minute spend.
 */
export function armAdexiumAutoMode() {
  if (autoModeIntervalId) return;

  console.log('[Adexium] Auto-mode armed: will activate after 1 minute of session time');
  // Check every 8 seconds
  autoModeIntervalId = setInterval(() => {
    checkAndTriggerAutoAd().catch(() => {});
  }, 8000);
}

// Manual trigger helper (kept for testing/compatibility)
export async function showAdexiumAd(timeoutMs = 12000) {
  const widget = getOrInitAdexiumWidget();
  if (!widget) return { success: false };

  return new Promise(async (resolve) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve({ timeout: true });
      }
    }, timeoutMs);

    const onComplete = () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ success: true });
      }
    };

    try {
      if (widget.ee) {
        widget.ee.on('adClosed', onComplete);
        widget.ee.on('adPlaybackCompleted', onComplete);
        widget.ee.on('noAdFound', onComplete);
        widget.ee.on('requestAdError', onComplete);
      }
      const ad = await widget.requestAd('interstitial');
      if (ad && (Array.isArray(ad) ? ad.length > 0 : true)) {
        widget.displayAd(ad, 'interstitial');
      } else {
        onComplete();
      }
    } catch {
      onComplete();
    }
  });
}
