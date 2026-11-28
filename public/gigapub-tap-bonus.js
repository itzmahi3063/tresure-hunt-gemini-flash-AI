/*!
 * GigaPub Tap Bonus (client layer)
 * ---------------------------------------------------------------
 * ONLY for the GigaPub ads of Watch & Earn (ads #11-#15). Adsgram is never touched.
 *
 *  - Every GigaPub ad still pays its normal +10 base reward.
 *  - If the user ALSO taps the ad, the server adds an extra +10 (api/ads.js decides + credits, atomically).
 *  - If the user does not tap, the base +10 is still paid; the reward sheet shows "MISSED OUT ON +10".
 *
 * The GigaPub SDK only exposes showGiga().then/.catch - it has NO click callback, so a tap is detected
 * with client-side signals while the ad is on screen:
 *    open  : the ad called window.open / Telegram.WebApp.openLink / openTelegramLink
 *    link  : the user clicked an <a href="http..."> element
 *    message: the ad frame posted a web_app_open_link / web_app_open_tg_link event
 *    away  : the mini app went to the background (hidden / deactivated) for >= 700ms while the ad was running
 *
 * This file changes no existing function. It wraps window.showGiga + window.fetch, adds one hint box to the
 * Watch & Earn sheet and one result block to the "Reward Claimed!" sheet.
 * Debug: open the app with  #gpdebug  (or run window.__gigaTapDebug() in the console).
 */
(function () {
  "use strict";
  if (window.__gigaTapBonusLoaded) return;
  window.__gigaTapBonusLoaded = true;

  var CFG = { bonus: 10, startIndex: 10, maxAds: 15, minAwayMs: 1000 };
  var DEBUG = /gpdebug/.test(location.hash || "");

  var TEXT = {
    en: {
      hint: "👆 <b>Tap the ad</b> to earn <b>+{b} extra coins</b> on top of your base reward!",
      got: "YOU GOT", base: "Base: +{base}", bonus: "Tap Bonus: +{bonus}",
      missed: "MISSED OUT ON", untapped: "Untapped Bonus",
      watched: "Ads Watched:", tapped: "Tapped On:",
      tipYes: "🔥 Nice tapping! You unlocked +{b} bonus coins!",
      tipNo: "💡 Tap on the ad next time to grab the extra +{b} coins!"
    },
    ru: {
      hint: "👆 <b>Нажмите на рекламу</b>, чтобы получить <b>+{b} дополнительных монет</b>!",
      got: "ВЫ ПОЛУЧИЛИ", base: "Базовая: +{base}", bonus: "Бонус за клик: +{bonus}",
      missed: "УПУЩЕНО", untapped: "Бонус не получен",
      watched: "Просмотрено:", tapped: "Нажато:",
      tipYes: "🔥 Отлично! Вы получили +{b} бонусных монет!",
      tipNo: "💡 В следующий раз нажмите на рекламу и получите +{b} монет!"
    },
    ar: {
      hint: "👆 <b>اضغط على الإعلان</b> لتحصل على <b>+{b} عملة إضافية</b>!",
      got: "حصلت على", base: "الأساسي: +{base}", bonus: "مكافأة الضغط: +{bonus}",
      missed: "فاتك", untapped: "مكافأة لم تُستلم",
      watched: "الإعلانات:", tapped: "تم الضغط:",
      tipYes: "🔥 رائع! حصلت على +{b} عملة إضافية!",
      tipNo: "💡 اضغط على الإعلان في المرة القادمة لتحصل على +{b} عملة!"
    }
  };
  function lang() {
    try {
      var tg = window.Telegram && window.Telegram.WebApp;
      var c = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || document.documentElement.lang || "en";
      c = String(c).slice(0, 2).toLowerCase();
      return TEXT[c] ? c : "en";
    } catch (e) { return "en"; }
  }
  function tr(k, vars) {
    var s = (TEXT[lang()] || TEXT.en)[k] || TEXT.en[k] || "";
    vars = vars || {};
    return s.replace(/\{(\w+)\}/g, function (m, n) { return vars[n] !== undefined ? vars[n] : m; });
  }
  function log() { if (DEBUG && window.console) { try { console.log.apply(console, ["[GigaTap]"].concat([].slice.call(arguments))); } catch (e) {} } }

  /* ------------------------------------------------------------------ tap tracking */
  var S = null;        // current ad session
  var LAST = null;     // result of the last finished session (sent with the claim)
  var lastHumanTouch = { at: 0, isTrusted: false };

  function recordHumanTouch(e) {
    if (!e || e.isTrusted !== true) return;
    lastHumanTouch.at = Date.now();
    lastHumanTouch.isTrusted = true;
    log("Human physical touch verified at:", lastHumanTouch.at);
  }

  try {
    window.addEventListener("touchstart", recordHumanTouch, { capture: true, passive: true });
    window.addEventListener("pointerdown", recordHumanTouch, { capture: true, passive: true });
    window.addEventListener("mousedown", recordHumanTouch, { capture: true, passive: true });
    window.addEventListener("click", recordHumanTouch, { capture: true, passive: true });
  } catch (e) {}

  function isHumanAction() {
    var now = Date.now();
    // A physical human touch (with isTrusted === true) must have occurred in the last 2500ms
    return lastHumanTouch.isTrusted && (lastHumanTouch.at > 0) && (now - lastHumanTouch.at <= 2500);
  }

  function newSession() { return { startedAt: Date.now(), signal: "", awayStart: 0, awayMs: 0, humanClicked: false }; }

  function mark(signal) {
    if (!S) return;
    var isHuman = isHumanAction();
    if (!isHuman) {
      log("Non-human action / auto-redirect ignored. Signal:", signal);
      return;
    }
    if (!S.signal) {
      S.signal = signal;
      S.humanClicked = true;
      log("Human verified tap signal:", signal);
    }
  }

  function goAway() {
    if (S && !S.awayStart) {
      if (isHumanAction()) {
        S.humanClicked = true;
        if (!S.signal) S.signal = "human_click";
      }
      S.awayStart = Date.now();
    }
  }

  function comeBack() {
    if (S && S.awayStart) {
      S.awayMs += Date.now() - S.awayStart;
      S.awayStart = 0;
    }
  }

  function finishSession() {
    if (!S) return;
    comeBack();
    var awayTime = Math.round(S.awayMs || 0);
    // User requested: Must be a real human click AND stay at least 1 second (1000ms) on ad page
    var isHuman = Boolean(S.humanClicked);
    var hasStay = awayTime >= CFG.minAwayMs; // >= 1000ms

    var isTapped = isHuman && hasStay;
    var sig = isTapped ? (S.signal || "human_click") : "";

    LAST = {
      tapped: isTapped,
      signal: sig,
      awayMs: awayTime,
      humanVerified: isTapped,
      at: Date.now()
    };
    try { window.__lastGigapubTap = LAST; } catch(e) {}
    log("Session finished. Human:", isHuman, "StayMs:", awayTime, "Final Tapped:", isTapped, "LAST:", LAST);
    S = null;
  }

  function wrapShowGiga(fn) {
    if (typeof fn !== "function" || fn.__gigaTapWrapped) return fn;
    var w = function () {
      // Only the Watch & Earn GigaPub ad (AdBarrier name "gigapub_watch"). Spin-ticket GigaPub ads and miner ads are untouched.
      var _act = window.AdBarrier && window.AdBarrier.activeAd; var isWatch = _act === "gigapub_watch";
      if (!isWatch) return fn.apply(this, arguments);
      S = newSession();
      LAST = null;
      var p;
      try { p = fn.apply(this, arguments); } catch (e) { S = null; throw e; }
      return Promise.resolve(p).then(
        function (v) { finishSession(); return v; },
        function (e) { S = null; throw e; }
      );
    };
    w.__gigaTapWrapped = true;
    return w;
  }

  function hookShowGiga() {
    var current = window.showGiga;
    var wrapped = wrapShowGiga(current);
    try {
      Object.defineProperty(window, "showGiga", {
        configurable: true,
        get: function () { return wrapped; },
        set: function (v) { wrapped = wrapShowGiga(v); }
      });
    } catch (e) {
      if (current) window.showGiga = wrapped;
    }
  }

  function hookOpeners() {
    try {
      var realOpen = window.open;
      window.open = function () { mark("open"); return realOpen.apply(this, arguments); };
    } catch (e) {}
    try {
      var tg = window.Telegram && window.Telegram.WebApp;
      if (tg) {
        ["openLink", "openTelegramLink"].forEach(function (name) {
          if (typeof tg[name] !== "function") return;
          var real = tg[name];
          tg[name] = function () { mark("open"); return real.apply(this, arguments); };
        });
        if (typeof tg.onEvent === "function") {
          tg.onEvent("deactivated", goAway);
          tg.onEvent("activated", comeBack);
        }
      }
    } catch (e) {}
    window.addEventListener("message", function (ev) {
      if (!S) return;
      try {
        var d = ev && ev.data;
        if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { return; } }
        var t = d && d.eventType;
        if (t === "web_app_open_link" || t === "web_app_open_tg_link") mark("message");
      } catch (e) {}
    }, true);
    document.addEventListener("click", function (e) {
      if (!S) return;
      var a = e.target && e.target.closest && e.target.closest("a[href]");
      if (a && /^(https?:|tg:)/i.test(a.getAttribute("href") || "")) mark("link");
    }, true);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) goAway(); else comeBack();
    });
  }

  /* ------------------------------------------------------------------ fetch hook */
  var PENDING = null;      // last GigaPub claim response waiting to be shown
  var SHOWN_TOTAL = { v: 0, at: 0 };

  function hookFetch() {
    if (!window.fetch || window.__gigaTapFetchHooked) return;
    window.__gigaTapFetchHooked = true;
    var realFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = "", method = "GET", isGigaClaim = false;
      try {
        url = typeof input === "string" ? input : (input && input.url) || "";
        method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
        if (method === "POST" && /\/api\/ads(\.js)?(\?|$)/.test(url) && init && typeof init.body === "string") {
          var b = JSON.parse(init.body);
          if (b && b.action === "watch_ad" && b.provider === "gigapub") {
            isGigaClaim = true;
            b.gigapubTap = LAST
              ? { tapped: LAST.tapped, signal: LAST.signal, awayMs: LAST.awayMs }
              : { tapped: false };
            var ni = {};
            for (var k in init) if (Object.prototype.hasOwnProperty.call(init, k)) ni[k] = init[k];
            ni.body = JSON.stringify(b);
            init = ni;
          }
        }
      } catch (e) {}
      var p = realFetch.call(this, input, init);
      try {
        if (/\/api\/ads(\.js)?(\?|$)/.test(url)) {
          p.then(function (resp) {
            try {
              resp.clone().json().then(function (d) { onAdsResponse(method, isGigaClaim, d, resp.ok); }).catch(function () {});
            } catch (e) {}
          }).catch(function () {});
        }
      } catch (e) {}
      return p;
    };
  }

  function onAdsResponse(method, isGigaClaim, d, ok) {
    if (!d) return;
    if (method === "GET" && d.ads && typeof d.ads.gigapubTapBonus === "number") {
      CFG.bonus = d.ads.gigapubTapBonus;
      refreshHint();
      return;
    }
    if (method === "POST" && ok && d.ok && d.isGigapub === true && !d.duplicate) {
      LAST = null; // claim done
      if (typeof d.tapBonusAvailable === "number" && d.tapBonusAvailable > 0) CFG.bonus = d.tapBonusAvailable;
      PENDING = d;
      maybeRender();
    }
  }

  /* ------------------------------------------------------------------ UI */
  function $(id) { return document.getElementById(id); }

  function injectStyle() {
    if ($("gigaTapStyle")) return;
    var st = document.createElement("style");
    st.id = "gigaTapStyle";
    st.textContent =
      "#gpTapHint{margin:10px 0 0;padding:10px 12px;border-radius:12px;font-size:12.5px;line-height:1.35;text-align:center;" +
      "background:rgba(255,170,0,.12);border:1px dashed rgba(255,150,0,.55);color:inherit;}" +
      "#gpTapResult{width:100%;margin-top:4px;}" +
      "#gpTapResult .gp-row{display:flex;gap:10px;}" +
      "#gpTapResult .gp-card{flex:1;border-radius:14px;padding:12px 8px;text-align:center;border:1.5px solid;}" +
      "#gpTapResult .gp-got{background:rgba(34,197,94,.10);border-color:rgba(34,197,94,.55);}" +
      "#gpTapResult .gp-miss{background:rgba(239,68,68,.09);border-color:rgba(239,68,68,.5);}" +
      "#gpTapResult .gp-lbl{font-size:10.5px;font-weight:800;letter-spacing:.6px;}" +
      "#gpTapResult .gp-got .gp-lbl{color:#16a34a;}#gpTapResult .gp-miss .gp-lbl{color:#dc2626;}" +
      "#gpTapResult .gp-val{font-size:30px;font-weight:800;line-height:1.15;margin:2px 0;}" +
      "#gpTapResult .gp-sub{font-size:10.5px;opacity:.75;}" +
      "#gpTapResult .gp-miss .gp-sub{color:#dc2626;opacity:1;}" +
      "#gpTapResult .gp-stats{display:flex;justify-content:space-around;margin-top:10px;padding:10px;border-radius:12px;" +
      "background:rgba(127,127,127,.12);font-size:13px;}" +
      "#gpTapResult .gp-tip{margin-top:10px;padding:10px 12px;border-radius:12px;font-size:12.5px;line-height:1.35;" +
      "background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.35);}";
    (document.head || document.documentElement).appendChild(st);
  }

  function isOpen(el) { return !!(el && el.classList.contains("active")); }

  function refreshHint() {
    var pre = $("watchFlowPreView");
    var watchedEl = $("sheetWatchedToday");
    if (!pre || !watchedEl) return;
    injectStyle();
    var watched = Number(String(watchedEl.textContent).trim()) || 0;
    var show = watched >= CFG.startIndex && watched < CFG.maxAds && CFG.bonus > 0;
    var box = $("gpTapHint");
    if (!show) { if (box) box.style.display = "none"; return; }
    if (!box) {
      box = document.createElement("div");
      box.id = "gpTapHint";
      var warn = pre.querySelector(".watch-flow-warning");
      if (warn && warn.parentNode) warn.parentNode.insertBefore(box, warn);
      else pre.appendChild(box);
    }
    box.innerHTML = tr("hint", { b: CFG.bonus });
    box.style.display = "block";
  }

  function cleanupResult() {
    var r = $("gpTapResult");
    if (r && r.parentNode) r.parentNode.removeChild(r);
    var succ = $("watchFlowSuccessView");
    if (!succ) return;
    var hidden = succ.querySelectorAll("[data-gp-hidden]");
    for (var i = 0; i < hidden.length; i++) {
      hidden[i].style.display = hidden[i].getAttribute("data-gp-hidden") || "";
      hidden[i].removeAttribute("data-gp-hidden");
    }
  }

  function hideOriginal(el) {
    if (!el || el.hasAttribute("data-gp-hidden")) return;
    el.setAttribute("data-gp-hidden", el.style.display || "");
    el.style.display = "none";
  }

  function maybeRender() {
    var succ = $("watchFlowSuccessView");
    if (!PENDING || !succ || !isOpen(succ)) return;
    var d = PENDING;
    injectStyle();
    cleanupResult();

    var base = Number(d.baseReward !== undefined ? d.baseReward : d.reward) || 0;
    var bonus = Number(d.tapBonus) || 0;
    var avail = Number(d.tapBonusAvailable) || CFG.bonus;
    var tapped = bonus > 0;
    var adsToday = Number(d.gigapubAdsToday) || 0;
    var tapsToday = Number(d.gigapubTapsToday) || 0;
    var total = base + bonus;
    SHOWN_TOTAL = { v: total, at: Date.now() };

    var card = succ.querySelector(".watch-flow-reward-card");
    var badge = succ.querySelector(".watch-flow-progress-badge");
    hideOriginal(card);
    hideOriginal(badge);

    var watchedAll = Number((document.getElementById("sheetSuccessWatched") || {}).textContent) || (CFG.startIndex + adsToday);
    var html = '<div class="gp-row">' +
      '<div class="gp-card gp-got"><div class="gp-lbl">' + tr("got") + '</div><div class="gp-val">+' + total + '</div>' +
      '<div class="gp-sub">' + tr("base", { base: base }) + (tapped ? ' | ' + tr("bonus", { bonus: bonus }) : '') + '</div></div>' +
      (tapped ? '' :
        '<div class="gp-card gp-miss"><div class="gp-lbl">' + tr("missed") + '</div><div class="gp-val">+' + avail + '</div>' +
        '<div class="gp-sub">' + tr("untapped") + '</div></div>') +
      '</div>' +
      '<div class="gp-stats"><span>' + tr("watched") + ' <b>' + watchedAll + '/' + CFG.maxAds + '</b> ✅</span>' +
      '<span>' + tr("tapped") + ' <b>' + tapsToday + '/' + adsToday + '</b> 🎯</span></div>' +
      '<div class="gp-tip">' + tr(tapped ? "tipYes" : "tipNo", { b: avail }) + '</div>';

    var box = document.createElement("div");
    box.id = "gpTapResult";
    box.innerHTML = html;
    var anchor = badge || card;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor);
    else succ.appendChild(box);
    PENDING = null;
  }

  function observeUi() {
    if (!window.MutationObserver) return;
    var succ = $("watchFlowSuccessView");
    if (succ) {
      new MutationObserver(function () {
        if (isOpen(succ)) maybeRender();
        else { cleanupResult(); PENDING = null; }
      }).observe(succ, { attributes: true, attributeFilter: ["class"] });
    }
    var pre = $("watchFlowPreView");
    if (pre) new MutationObserver(refreshHint).observe(pre, { attributes: true, attributeFilter: ["class"] });
    var w = $("sheetWatchedToday");
    if (w) new MutationObserver(refreshHint).observe(w, { childList: true, characterData: true, subtree: true });
    var modal = $("watchEarnFlowModal");
    if (modal) new MutationObserver(refreshHint).observe(modal, { attributes: true, attributeFilter: ["class"] });

    // "COLLECT & CONTINUE" toast says "+10 added": show the real total (base + tap bonus) instead.
    var toast = $("toast");
    if (toast) {
      new MutationObserver(function () {
        if (!SHOWN_TOTAL.v || Date.now() - SHOWN_TOTAL.at > 15000) return;
        var m = /^(🎉 \+)(\d+)( TREASURE Coins added to balance!)$/.exec(toast.textContent || "");
        if (m && Number(m[2]) !== SHOWN_TOTAL.v) toast.textContent = m[1] + SHOWN_TOTAL.v + m[3];
      }).observe(toast, { childList: true, characterData: true, subtree: true });
    }
  }

  function init() {
    hookShowGiga();
    hookOpeners();
    hookFetch();
    injectStyle();
    observeUi();
    refreshHint();
    window.__gigaTapDebug = function () { return { session: S, last: LAST, pending: PENDING, cfg: CFG }; };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
