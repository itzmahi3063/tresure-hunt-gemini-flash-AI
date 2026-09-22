// Adexium Integration for Quiz and Game Rewards
// Auto-mode is permanently disabled per user request so random popup ads
// do not appear when opening the bot or navigating screens.
// Instead, Adexium is now triggered deliberately when the user claims Quiz rewards.

const ADEXIUM_SCRIPT_URL = 'https://cdn.tgads.space/assets/js/adexium-widget.min.js';
const ADEXIUM_WIDGET_ID = '3244f7f7-db89-4f7a-8342-092d462aa3f8';

let scriptLoadPromise = null;
let widgetInstance = null;

function loadAdexiumScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.AdexiumWidget) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = ADEXIUM_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Adexium script'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

// Deliberate Adexium interstitial ad trigger for Quiz Reward Claim
export async function showAdexiumAd(timeoutMs = 12000) {
  await loadAdexiumScript();
  if (typeof window === 'undefined' || !window.AdexiumWidget) {
    console.warn('Adexium SDK not available');
    return { success: false, reason: 'sdk_missing' };
  }

  if (!widgetInstance) {
    widgetInstance = new window.AdexiumWidget({
      wid: ADEXIUM_WIDGET_ID,
      adFormat: 'interstitial'
    });
  }

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
      if (widgetInstance.ee) {
        widgetInstance.ee.on('adClosed', onComplete);
        widgetInstance.ee.on('adPlaybackCompleted', onComplete);
        widgetInstance.ee.on('noAdFound', onComplete);
        widgetInstance.ee.on('requestAdError', onComplete);
      }

      const ad = await widgetInstance.requestAd('interstitial');
      if (ad && (Array.isArray(ad) ? ad.length > 0 : true)) {
        widgetInstance.displayAd(ad, 'interstitial');
      } else {
        onComplete();
      }
    } catch (err) {
      console.warn('Adexium display notice:', err);
      onComplete();
    }
  });
}

// Auto-mode permanently silenced as requested by user
export function armAdexiumAutoMode() {
  // Deliberately no-op: user requested to stop auto Adexium popups on bot/screen open
}

export function setAdexiumGameInProgress() {
  // No-op
}
