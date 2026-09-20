// Real ad-network integration for the Daily "Watch & Earn" slots and the
// Daily Rewards claim popup. Centralized here so adding/swapping a network
// later is one function change, not scattered SDK calls across pages.
//
// SDK script tags are loaded once, globally, in index.html:
//   - Monetag (zone 11828835): //libtl.com/sdk.js -> exposes window.show_11828835
//   - Adsgram: https://sad.adsgram.ai/js/sad.min.js -> exposes window.Adsgram
//
// Anti-cheat: no reward is ever granted for watching less than
// MIN_AD_WATCH_MS (5 seconds), even if the ad SDK's promise resolves
// instantly (dev/test mode, ad-blocked environment, etc). This is enforced
// here (client) AND again on the server (see server/index.js) — the client
// check keeps the UI honest, the server check is what actually can't be
// bypassed by calling the API directly.
export const MIN_AD_WATCH_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enforceMinWatch(startedAt) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_AD_WATCH_MS) {
    await sleep(MIN_AD_WATCH_MS - elapsed);
  }
}

// Monetag interstitial — used for the "Monetag" Daily Watch & Earn slot.
export async function showMonetagInterstitial() {
  const showFn = typeof window !== 'undefined' ? window.show_11828835 : null;
  if (typeof showFn !== 'function') {
    throw new Error('Ad is still loading — please try again in a moment.');
  }
  const startedAt = Date.now();
  await showFn();
  await enforceMinWatch(startedAt);
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
    // Monetag's rewarded-popup format rejects its promise if the user closes
    // the ad early or it errors out — either way, no reward.
    throw new Error('Ad was closed before finishing — no reward this time.');
  }
  await enforceMinWatch(startedAt);
  return { watchStartedAt: startedAt };
}

// Adsgram — used for both "Adsgram" Daily Watch & Earn slots. Each slot has
// its own blockId, set in the admin panel (server/db.js ads_config).
export async function showAdsgram(blockId) {
  if (typeof window === 'undefined' || !window.Adsgram || !blockId) {
    throw new Error('Ad is still loading — please try again in a moment.');
  }
  const startedAt = Date.now();
  const controller = window.Adsgram.init({ blockId });
  await controller.show();
  await enforceMinWatch(startedAt);
  return { watchStartedAt: startedAt };
}

// USL TowerAds — used for the "USL" Daily Watch & Earn slot.
export async function showTowerAd(placementId = 'plc_7c25684decd46576') {
  const startedAt = Date.now();
  const pId = placementId || 'plc_7c25684decd46576';

  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ watchStartedAt: startedAt });
      return;
    }

    if (window.TowerAds) {
      try {
        let earnedReward = false;
        const tower = new window.TowerAds({
          apiKey: 'YOUR_API_KEY',
          placementId: pId,
          onRewardEarned(reward) {
            console.log('TowerAds reward:', reward);
            earnedReward = true;
          },
          onError(error) {
            console.error('TowerAds error:', error);
          }
        });

        tower.loadAndShow()
          .then(async () => {
            await enforceMinWatch(startedAt);
            resolve({ watchStartedAt: startedAt, earned: earnedReward });
          })
          .catch(async (error) => {
            console.error('TowerAds show error:', error);
            await enforceMinWatch(startedAt);
            resolve({ watchStartedAt: startedAt });
          });
        return;
      } catch (err) {
        console.error('TowerAds initialization error:', err);
      }
    }

    // Fallback if TowerAds script is still loading or blocked
    enforceMinWatch(startedAt).then(() => {
      resolve({ watchStartedAt: startedAt });
    });
  });
}

// Dispatch by the ad slot's configured network_id.
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
      // Unconfigured network (e.g. a slot added later with no SDK wired
      // yet) — don't hard-crash the button, just enforce the same timed
      // wait so the slot still "works" until it's wired up properly.
      { const startedAt = Date.now(); await sleep(MIN_AD_WATCH_MS); return { watchStartedAt: startedAt }; }
  }
}
