/*!
 * Ad Mission Guard (client UX layer)
 * ---------------------------------------------------------------
 * The 25-missions / 24-hours limit is enforced on the SERVER (api/ads.js -> claim_ad_mission).
 * This file only makes it visible: when the server says the user has completed 25 ad missions, the
 * Adsgram task widget is hidden and a live countdown timer is shown instead. When the timer ends,
 * the widget comes back automatically.
 *
 * It does not touch any existing function of the app. It only:
 *   - reads GET /api/ads (adMission block) once on start / when the app becomes visible again
 *   - reads the adMission block from /api/ads responses the app already makes (claim_ad_mission)
 *   - shows / hides the widget + countdown box
 */
(function () {
  "use strict";

  var STATE = { locked: false, endsAtLocal: 0, completed: 0, max: 25 };
  var BOX_ID = "adMissionLockBox";
  var LOCK_CLASS = "am-locked";
  var tickTimer = null;
  var lastFetchAt = 0;
  var observerBusy = false;

  var TEXT = {
    en: { title: "Ad missions completed", sub: "You completed all {max} ad missions. New missions unlock in:", done: "Unlocking..." },
    ru: { title: "Рекламные миссии выполнены", sub: "Вы выполнили все {max} рекламных миссий. Новые откроются через:", done: "Открываем..." },
    ar: { title: "اكتملت مهام الإعلانات", sub: "لقد أكملت جميع مهام الإعلانات ({max}). ستتوفر مهام جديدة بعد:", done: "جارٍ الفتح..." }
  };

  function lang() {
    try {
      var tg = window.Telegram && window.Telegram.WebApp;
      var code = tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code;
      code = String(code || document.documentElement.lang || "en").slice(0, 2).toLowerCase();
      return TEXT[code] ? code : "en";
    } catch (e) { return "en"; }
  }
  function tr(key) { return (TEXT[lang()] || TEXT.en)[key].replace("{max}", String(STATE.max)); }

  function injectStyle() {
    if (document.getElementById("adMissionGuardStyle")) return;
    var st = document.createElement("style");
    st.id = "adMissionGuardStyle";
    // Hidden but NOT display:none, so the app's own "is the widget rendered?" check keeps working.
    st.textContent =
      "#adMissionsBody." + LOCK_CLASS + " > *{position:absolute !important;left:-9999px !important;top:0 !important;" +
      "visibility:hidden !important;pointer-events:none !important;}" +
      "#" + BOX_ID + "{padding:16px 14px;text-align:center;border-radius:14px;margin:6px 0;" +
      "background:rgba(0,0,0,.03);border:1px dashed rgba(14,32,41,.18);}" +
      "[data-theme='dark'] #" + BOX_ID + "{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.18);}" +
      "#" + BOX_ID + " .am-t{font-size:14px;font-weight:700;margin-bottom:4px;}" +
      "#" + BOX_ID + " .am-s{font-size:12px;opacity:.75;margin-bottom:8px;}" +
      "#" + BOX_ID + " .am-c{font-size:26px;font-weight:800;letter-spacing:1px;font-variant-numeric:tabular-nums;}";
    (document.head || document.documentElement).appendChild(st);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  function getBody() { return document.getElementById("adMissionsBody"); }

  function ensureBox() {
    var body = getBody();
    if (!body || !body.parentNode) return null;
    var box = document.getElementById(BOX_ID);
    if (!box) {
      box = document.createElement("div");
      box.id = BOX_ID;
      box.innerHTML = '<div class="am-t"></div><div class="am-s"></div><div class="am-c"></div>';
      // Placed OUTSIDE #adMissionsBody, because the app re-renders that element's innerHTML.
      body.parentNode.insertBefore(box, body);
    }
    return box;
  }

  function render() {
    var body = getBody();
    if (!body) return;
    injectStyle();
    var remaining = STATE.endsAtLocal - Date.now();
    if (STATE.locked && remaining > 0) {
      body.classList.add(LOCK_CLASS);
      var box = ensureBox();
      if (!box) return;
      box.style.display = "block";
      box.querySelector(".am-t").textContent = "🎬 " + tr("title") + " (" + STATE.max + "/" + STATE.max + ")";
      box.querySelector(".am-s").textContent = tr("sub");
      box.querySelector(".am-c").textContent = "⏳ " + fmt(remaining);
      startTick();
    } else {
      body.classList.remove(LOCK_CLASS);
      var b = document.getElementById(BOX_ID);
      if (b) b.style.display = "none";
      stopTick();
    }
  }

  function startTick() {
    if (tickTimer) return;
    tickTimer = setInterval(function () {
      var remaining = STATE.endsAtLocal - Date.now();
      if (remaining <= 0) {
        STATE.locked = false;
        render();
        fetchStatus(true); // confirm with the server that the lock really ended
        return;
      }
      var box = document.getElementById(BOX_ID);
      var c = box && box.querySelector(".am-c");
      if (c) c.textContent = "⏳ " + fmt(remaining);
      else render(); // box was removed -> recreate
    }, 1000);
  }
  function stopTick() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }

  function applyServerState(am) {
    if (!am || typeof am !== "object") return;
    STATE.max = Number(am.max) || 25;
    STATE.completed = Number(am.completed) || 0;
    var remainingMs = Number(am.remainingMs) || 0;
    STATE.locked = Boolean(am.locked) && remainingMs > 0;
    // Use "remaining time" (not the absolute server timestamp) so a wrong phone clock cannot break the timer.
    STATE.endsAtLocal = STATE.locked ? Date.now() + remainingMs : 0;
    render();
  }

  function getInitData() {
    try { return (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || ""; }
    catch (e) { return ""; }
  }

  var realFetch = null;
  function rawFetch(url, opts) { return (realFetch || window.fetch).call(window, url, opts); }

  function fetchStatus(force) {
    var now = Date.now();
    if (!force && now - lastFetchAt < 30000) return; // never spam the API (it has a daily request quota)
    var initData = getInitData();
    if (!initData) return;
    lastFetchAt = now;
    var opts = { headers: { "X-Telegram-Init-Data": initData } };
    rawFetch("/api/ads", opts)
      .then(function (r) { return r.status === 404 ? rawFetch("/api/ads.js", opts) : r; })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.adMission) applyServerState(d.adMission); })
      .catch(function () { /* silent: the server still enforces the limit */ });
  }

  // Listen to the app's own /api/ads calls (claim_ad_mission response carries the new state).
  function hookFetch() {
    if (!window.fetch || window.__adMissionGuardHooked) return;
    window.__adMissionGuardHooked = true;
    realFetch = window.fetch;
    window.fetch = function (input, init) {
      var p = realFetch.apply(this, arguments);
      try {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        if (url.indexOf("/api/ads") !== -1) {
          p.then(function (resp) {
            try {
              resp.clone().json().then(function (d) { if (d && d.adMission) applyServerState(d.adMission); }).catch(function () {});
            } catch (e) {}
          }).catch(function () {});
        }
      } catch (e) {}
      return p;
    };
  }

  function watchContainer() {
    var body = getBody();
    if (!body || !window.MutationObserver) return;
    // The app rebuilds #adMissionsBody whenever the Earn tab opens / language changes: re-apply our state.
    new MutationObserver(function () {
      if (observerBusy) return;
      observerBusy = true;
      try { if (STATE.locked) render(); } finally { observerBusy = false; }
    }).observe(body, { childList: true });
  }

  function init() {
    hookFetch();
    injectStyle();
    watchContainer();
    setTimeout(function () { fetchStatus(true); }, 1500);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") fetchStatus(false);
    });
    // Earn tab opened -> make sure the box is in place (no network call)
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest && e.target.closest("[data-tab='tab-earn'],[data-target='tab-earn']");
      if (t) setTimeout(render, 50);
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
