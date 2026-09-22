// Adexium Integration for Quiz and Game Rewards
// Script is loaded in <head> via index.html with wid: '3244f7f7-db89-4f7a-8342-092d462aa3f8'
// Adexium is triggered deliberately when user clicks "Claim 10 GEMS" in Math Quiz

const ADEXIUM_WIDGET_ID = '3244f7f7-db89-4f7a-8342-092d462aa3f8';

function getOrInitAdexiumWidget() {
  if (typeof window === 'undefined') return null;
  if (window.adexiumWidget) return window.adexiumWidget;
  if (typeof window.AdexiumWidget === 'undefined') return null;

  try {
    // Shim WebView if needed for Telegram platforms
    if (window.Telegram?.WebApp && !window.Telegram.WebView) {
      window.Telegram.WebView = {
        initParams: {
          tgWebAppPlatform: window.Telegram.WebApp.platform || 'android'
        }
      };
    }

    // Seed userData in localStorage
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
      console.error('[Adexium] Fatal init error:', e);
      return null;
    }
  }
}

// Deliberate Adexium interstitial ad trigger for Quiz Reward Claim
export async function showAdexiumAd(timeoutMs = 15000) {
  const widget = getOrInitAdexiumWidget();
  if (!widget) {
    console.warn('[Adexium] SDK not available on window');
    return { success: false, reason: 'sdk_missing' };
  }

  return new Promise(async (resolve) => {
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        console.warn('[Adexium] Ad display timed out after', timeoutMs, 'ms');
        resolve({ timeout: true });
      }
    }, timeoutMs);

    const onComplete = (reason = 'done') => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        console.log('[Adexium] Ad flow completed with reason:', reason);
        resolve({ success: true, reason });
      }
    };

    try {
      // Event listener registration
      const attachListener = (event, fn) => {
        if (typeof widget.on === 'function') {
          widget.on(event, fn);
        } else if (widget.ee && typeof widget.ee.on === 'function') {
          widget.ee.on(event, fn);
        }
      };

      attachListener('adClosed', () => onComplete('adClosed'));
      attachListener('adPlaybackCompleted', () => onComplete('adPlaybackCompleted'));
      attachListener('noAdFound', () => onComplete('noAdFound'));
      attachListener('requestAdError', () => onComplete('requestAdError'));

      console.log('[Adexium] Requesting ad with wid:', ADEXIUM_WIDGET_ID);
      const ad = await widget.requestAd('interstitial');
      console.log('[Adexium] Bid response:', ad);

      if (ad && (Array.isArray(ad) ? ad.length > 0 : true)) {
        console.log('[Adexium] Displaying interstitial ad banner...');
        widget.displayAd(ad, 'interstitial');
      } else {
        console.log('[Adexium] No ad available right now from network');
        onComplete('no_fill');
      }
    } catch (err) {
      console.warn('[Adexium] Request exception:', err);
      onComplete('error');
    }
  });
}

// Auto-mode permanently silenced as requested by user
export function armAdexiumAutoMode() {
  // No-op
}

export function setAdexiumGameInProgress() {
  // No-op
}
