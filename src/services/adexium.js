// Adexium auto-mode ads: not tied to any button, shows automatically at its
// own pace while the person is using the app. Loaded dynamically (rather
// than a static <script> tag) so we control exactly when it's armed —
// specifically, NOT while a game is actively being played in the Play
// section, and re-armed the moment a game finishes.
//
// Honesty note: the integration snippet provided only documents one method,
// `autoMode()`. There is no documented pause/stop/destroy method for it, so
// "never show mid-game" is implemented on a best-effort basis: autoMode()
// is only (re-)armed when a game is NOT in progress, and is explicitly
// re-armed the moment a game ends (Tic-Tac-Toe finish or Lucky Draw result).
// If autoMode() was already armed from earlier browsing and it happens to
// pop up mid-game in practice, there's no documented way to cancel that
// specific queued ad from here — check Adexium's own dashboard/docs for a
// pause()/hide() method if that happens, and it can be wired in immediately.

const ADEXIUM_SCRIPT_URL = 'https://cdn.tgads.space/assets/js/adexium-widget.min.js';
const ADEXIUM_WIDGET_ID = '3244f7f7-db89-4f7a-8342-092d462aa3f8';

let scriptLoadPromise = null;
let widgetInstance = null;
let gameInProgress = false;

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

// Call once when the app loads, and again right after a game ends. A no-op
// while a game is in progress.
export async function armAdexiumAutoMode() {
  if (gameInProgress) return;
  try {
    await loadAdexiumScript();
    if (typeof window === 'undefined' || !window.AdexiumWidget) return;
    if (!widgetInstance) {
      widgetInstance = new window.AdexiumWidget({
        wid: ADEXIUM_WIDGET_ID,
        adFormat: 'interstitial'
      });
    }
    widgetInstance.autoMode();
  } catch (err) {
    console.warn('Adexium auto-mode unavailable:', err.message);
  }
}

// Call when entering/leaving Tic-Tac-Toe or Lucky Draw gameplay.
export function setAdexiumGameInProgress(inProgress) {
  gameInProgress = inProgress;
}
