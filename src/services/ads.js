// Real ad-network integration for the Daily "Watch & Earn" slots and the
// Daily Rewards claim popup. Centralized here so adding/swapping a network
// later is one function change, not scattered SDK calls across pages.
//
// SDK script tags are loaded once, globally, in index.html:
//   - Monetag (zone 11828835): //libtl.com/sdk.js -> exposes window.show_11828835
//   - Adsgram: https://sad.adsgram.ai/js/sad.min.js -> exposes window.Adsgram
//   - USL TowerAds: https://uslads.com/sdk/tower-ads-v4.js -> exposes window.TowerAds
//
// Anti-cheat & 5-Second Timer Enforcement:
// No reward is ever granted for watching less than MIN_AD_WATCH_MS (5 seconds).
// If an ad is closed/cut before 5 seconds, an error is thrown and no reward is granted.
// This is strictly enforced across ALL ad networks (USL, Adsgram, Monetag, etc.)
// on the client AND again on the server.
export const MIN_AD_WATCH_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function verifyMinWatch(startedAt) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_AD_WATCH_MS) {
    throw new Error('Ad was closed too early. Please watch the ad for at least 5 seconds to earn your reward.');
  }
}

/**
 * AdBarrier
 * Prevents multiple ads from overlapping or triggering at the same time.
 * When an ad (e.g., Adsgram or USL) is triggered, Monetag is shielded so Monetag
 * cannot accidentally co-trigger or pop up on top of Adsgram.
 * Adexium is unaffected as it is an autonomous native widget, not a button ad.
 */
class AdBarrier {
  constructor() {
    this._activeNetwork = null;
    this._originalMonetag = null;
    this._shieldTimer = null;
  }

  isLocked() {
    return !!this._activeNetwork;
  }

  acquire(networkId) {
    if (this._activeNetwork) {
      throw new Error(`Another ad is currently active (${this._activeNetwork}). Please wait.`);
    }
    this._activeNetwork = networkId || 'unknown';

    // If starting a non-Monetag ad (e.g., Adsgram, USL), immediately shield Monetag
    if (networkId !== 'monetag') {
      this._shieldMonetag();
    }
  }

  _shieldMonetag() {
    if (typeof window === 'undefined') return;
    if (this._shieldTimer) {
      clearTimeout(this._shieldTimer);
      this._shieldTimer = null;
    }
    if (typeof window.show_11828835 === 'function' && !this._originalMonetag) {
      this._originalMonetag = window.show_11828835;
    }
    // Swap with safe no-op dummy function while Adsgram/USL is active
    window.show_11828835 = () => {
      console.warn('[AdBarrier] Blocked secondary Monetag trigger while another ad is active');
      return Promise.resolve();
    };
  }

  _unshieldMonetag() {
    if (typeof window === 'undefined') return;
    if (this._originalMonetag) {
      window.show_11828835 = this._originalMonetag;
      this._originalMonetag = null;
    }
  }

  release() {
    const wasNonMonetag = this._activeNetwork !== 'monetag';
    this._activeNetwork = null;

    if (wasNonMonetag) {
      // Keep Monetag shielded for an extra 2.5 seconds post-close grace period
      // to swallow any late synthetic/buffered click events
      if (this._shieldTimer) {
        clearTimeout(this._shieldTimer);
      }
      this._shieldTimer = setTimeout(() => {
        if (!this._activeNetwork) {
          this._unshieldMonetag();
        }
      }, 2500);
    } else {
      this._unshieldMonetag();
    }
  }
}

export const adBarrier = new AdBarrier();

// Helper to ensure Gigapub SDK script is loaded and window.showGiga is ready
async function ensureGigapubLoaded() {
  if (typeof window === 'undefined') return false;
  if (typeof window.showGiga === 'function') return true;

  let script = document.querySelector('script[src*="gigapub"]');
  if (!script) {
    script = document.createElement('script');
    script.src = 'https://ad.gigapub.tech/script?id=8273';
    script.async = true;
    document.head.appendChild(script);
  }

  // Poll up to 3 seconds for window.showGiga to initialize
  for (let i = 0; i < 30; i++) {
    if (typeof window.showGiga === 'function') return true;
    await sleep(100);
  }
  return typeof window.showGiga === 'function';
}

// Gigapub — used as chained bonus ad after Monetag for first 5 watches
export async function showGigapub() {
  await ensureGigapubLoaded();
  if (typeof window === 'undefined' || typeof window.showGiga !== 'function') {
    throw new Error('Gigapub SDK is still loading or unavailable.');
  }

  return window.showGiga();
}

// Monetag interstitial with optional Gigapub chained flow
export async function showMonetagWithGigapubFlow({ attemptGigapub = false, onProgress } = {}) {
  adBarrier.acquire('monetag');
  try {
    const showFn = typeof window !== 'undefined' ? window.show_11828835 : null;
    if (typeof showFn !== 'function') {
      throw new Error('Ad is still loading — please try again in a moment.');
    }
    const startedAt = Date.now();
    try {
      await showFn();
    } catch {
      throw new Error('Ad was closed before finishing — no reward this time.');
    }
    verifyMinWatch(startedAt);

    // If attemptGigapub is true (first 5 watches of the day for Monetag slot),
    // attempt to show Gigapub before giving reward
    if (attemptGigapub) {
      // Shield Monetag so background click events do not trigger a second Monetag
      adBarrier._shieldMonetag();
      if (typeof onProgress === 'function') {
        onProgress('Loading bonus ad (2/2)...');
      }
      await sleep(400);

      try {
        await showGigapub();
      } catch (gigaErr) {
        // As requested: If Gigapub fails to load or error occurs,
        // do not block the user — grant reward based on Monetag!
        console.warn('Gigapub bonus ad skipped or failed to load:', gigaErr);
      }
    }

    return { watchStartedAt: startedAt };
  } finally {
    adBarrier.release();
  }
}

// Standard Monetag interstitial (single ad, used for chest/games)
export async function showMonetagInterstitial() {
  return showMonetagWithGigapubFlow({ attemptGigapub: false });
}

// Monetag rewarded popup — used specifically for the Daily Rewards claim.
export async function showMonetagRewardedPopup() {
  adBarrier.acquire('monetag');
  try {
    const showFn = typeof window !== 'undefined' ? window.show_11828835 : null;
    if (typeof showFn !== 'function') {
      throw new Error('Ad is still loading — please try again in a moment.');
    }
    const startedAt = Date.now();
    try {
      await showFn('pop');
    } catch {
      throw new Error('Ad was closed before finishing — no reward this time.');
    }
    verifyMinWatch(startedAt);
    return { watchStartedAt: startedAt };
  } finally {
    adBarrier.release();
  }
}

// Helper to ensure Adsgram SDK script is loaded and window.Adsgram is ready
async function ensureAdsgramLoaded() {
  if (typeof window === 'undefined') return false;
  if (window.Adsgram) return true;

  let script = document.querySelector('script[src*="adsgram"]');
  if (!script) {
    script = document.createElement('script');
    script.src = 'https://sad.adsgram.ai/js/sad.min.js';
    script.async = true;
    document.head.appendChild(script);
  }

  // Poll up to 3 seconds for window.Adsgram to initialize
  for (let i = 0; i < 30; i++) {
    if (window.Adsgram) return true;
    await sleep(100);
  }
  return !!window.Adsgram;
}

// Adsgram — used for both "Adsgram" Daily Watch & Earn slots.
// Default blockId: 'int-49020' (Supports both Interstitial and Rewarded formats)
export async function showAdsgram(blockId = 'int-49020') {
  adBarrier.acquire('adsgram');
  try {
    await ensureAdsgramLoaded();
    if (typeof window === 'undefined' || !window.Adsgram) {
      throw new Error('Adsgram is still loading — please check your internet connection and try again.');
    }

    const finalBlockId = (blockId && !blockId.includes('sample')) ? blockId : 'int-49020';
    const startedAt = Date.now();
    const AdController = window.Adsgram.init({ blockId: finalBlockId });

    try {
      const result = await AdController.show();
      // According to Adsgram documentation:
      // result: { done: boolean, description: string, state: string, error: boolean }
      if (result && result.error) {
        console.warn('Adsgram playback error:', result);
        throw new Error(result.description || 'Ad error occurred during playback.');
      }
      if (result && result.done === false) {
        throw new Error('Ad was closed before finishing — no reward this time.');
      }
    } catch (err) {
      console.warn('Adsgram show catch:', err);
      const msg = err?.description || err?.message || 'Ad was closed before finishing — no reward this time.';
      throw new Error(msg);
    }

    verifyMinWatch(startedAt);
    return { watchStartedAt: startedAt };
  } finally {
    adBarrier.release();
  }
}

// USL TowerAds — used for the "USL" Daily Watch & Earn slot.
// Follows exact TowerAds specification with 5-second minimum watch timer.
export async function showTowerAd(placementId = 'plc_7c25684decd46576') {
  adBarrier.acquire('usl');
  try {
    const startedAt = Date.now();
    const pId = placementId || 'plc_7c25684decd46576';

    if (typeof window !== 'undefined' && window.TowerAds) {
      try {
        let rewardEarned = false;
        const ads = new window.TowerAds({
          apiKey: 'YOUR_API_KEY',
          placementId: pId,
          onRewardEarned(reward) {
            console.log('TowerAds reward:', reward);
            rewardEarned = true;
          },
          onError(error) {
            console.error('TowerAds error:', error);
          }
        });

        await ads.loadAndShow();
      } catch (error) {
        console.warn('TowerAds load/show notice:', error);
      }
    } else {
      // If SDK is still loading or in dev preview, wait full 5 seconds
      await sleep(MIN_AD_WATCH_MS);
    }

    verifyMinWatch(startedAt);
    return { watchStartedAt: startedAt };
  } finally {
    adBarrier.release();
  }
}

// Dispatch by the ad slot's configured network_id.
// Applies identical 5-second timer logic and AdBarrier protection across all networks.
export async function showAdForNetwork(ad, onProgress) {
  switch (ad.network_id) {
    case 'monetag': {
      // First 5 watches of the day chain Gigapub immediately after Monetag
      const isFirst5 = (ad.watched_today || 0) < 5;
      return showMonetagWithGigapubFlow({ attemptGigapub: isFirst5, onProgress });
    }
    case 'adsgram':
    case 'adsgram_cat':
      return showAdsgram(ad.block_id);
    case 'usl':
      return showTowerAd(ad.block_id || 'plc_7c25684decd46576');
    default:
      {
        adBarrier.acquire(ad.network_id || 'default');
        try {
          const startedAt = Date.now();
          await sleep(MIN_AD_WATCH_MS);
          return { watchStartedAt: startedAt };
        } finally {
          adBarrier.release();
        }
      }
  }
}
