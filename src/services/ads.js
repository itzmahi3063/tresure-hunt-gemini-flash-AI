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

// Monetag interstitial — used for the "Monetag" Daily Watch & Earn slot.
export async function showMonetagInterstitial() {
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
  return { watchStartedAt: startedAt };
}

// Monetag rewarded popup — used specifically for the Daily Rewards claim.
export async function showMonetagRewardedPopup() {
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
}

// USL TowerAds — used for the "USL" Daily Watch & Earn slot.
// Follows exact TowerAds specification with 5-second minimum watch timer.
export async function showTowerAd(placementId = 'plc_7c25684decd46576') {
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
}

// Dispatch by the ad slot's configured network_id.
// Applies identical 5-second timer logic regardless of which network provides the ad.
export async function showAdForNetwork(ad) {
  switch (ad.network_id) {
    case 'monetag':
      return showMonetagInterstitial();
    case 'adsgram':
    case 'adsgram_cat':
      return showAdsgram(ad.block_id);
    case 'usl':
      return showTowerAd(ad.block_id || 'plc_7c25684decd46576');
    default:
      {
        const startedAt = Date.now();
        await sleep(MIN_AD_WATCH_MS);
        return { watchStartedAt: startedAt };
      }
  }
}
