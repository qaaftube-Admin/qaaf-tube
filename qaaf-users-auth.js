// QAAF Tube Dedicated Users Data, Auth, 10-Language Selector & 1.5s Volume Auto-Hide (qaaf-users-auth.js)
(function initQaafUsersDatabaseAndLanguageMaster() {
  // =========================================================================
  // A. DEDICATED USERS DATABASE EXPORT / IMPORT (.JSON) IN ADMIN "USERS & PRO" TAB
  // =========================================================================
  window.adminExportUsersDatabaseJson = function() {
    var map = window.registeredUsersMap || {};
    var backupObj = {
      qaafUsersDatabaseVersion: "13.1",
      exportedAt: new Date().toISOString(),
      totalRegisteredUsers: Object.keys(map).length,
      registeredUsersMap: map
    };
    var blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "qaaf-users-database.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof showSyncToast === "function") showSyncToast("📥 Users & Passwords Database exported (qaaf-users-database.json)!");
  };

  window.adminImportUsersDatabaseJson = function(ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var parsed = JSON.parse(e.target.result);
        var incoming = parsed.registeredUsersMap || parsed;
        if (incoming && typeof incoming === "object") {
          window.registeredUsersMap = Object.assign({}, window.registeredUsersMap || {}, incoming);
          localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
          if (window.renderAdminUsersTable) window.renderAdminUsersTable();
          if (window.qaafCloudSync) window.qaafCloudSync.pushState("Restored Users Database Backup");
          alert("✅ Users & Passwords Database restored and synced to Firebase Cloud!");
        }
      } catch (err) {
        alert("⚠️ Invalid Users JSON file.");
      }
      ev.target.value = "";
    };
    reader.readAsText(file);
  };

  function injectUsersDatabaseBackupBar() {
    var usersPane = document.getElementById("admPane_users");
    if (!usersPane || document.getElementById("admUsersJsonBackupBar")) return;
    var bar = document.createElement("div");
    bar.id = "admUsersJsonBackupBar";
    bar.className = "bg-gradient-to-r from-emerald-950/60 via-slate-900 to-blue-950/60 border border-emerald-500/40 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs";
    bar.innerHTML =
      '<div>' +
        '<h5 class="font-extrabold text-emerald-300">💾 Users &amp; Passwords Separate Database Backup</h5>' +
        '<p class="text-[10px] text-slate-400">Download or restore all registered accounts, passwords, PINs &amp; secret words (.json)</p>' +
      '</div>' +
      '<div class="flex items-center gap-2">' +
        '<button type="button" onclick="adminExportUsersDatabaseJson()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-extrabold shadow flex items-center gap-1"><span>📥</span><span>Download Users (.json)</span></button>' +
        '<label class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl font-extrabold shadow flex items-center gap-1 cursor-pointer"><span>📤</span><span>Restore Users (.json)</span><input type="file" accept=".json" onchange="adminImportUsersDatabaseJson(event)" class="hidden" /></label>' +
      '</div>';
    usersPane.insertBefore(bar, usersPane.children[1]);
  }

  var prevOpenAdm = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevOpenAdm) prevOpenAdm();
    injectUsersDatabaseBackupBar();
  };
  injectUsersDatabaseBackupBar();

  // =========================================================================
  // B. PREVENT CHROME PASSWORD MANAGER POPUP ON SEARCH BAR & BACK BUTTON
  // =========================================================================
  function sanitizeSearchAndSecretInputs() {
    var sInp = document.getElementById("qaafSearchInput");
    if (sInp) {
      sInp.setAttribute("type", "search");
      sInp.setAttribute("name", "q_search");
      sInp.setAttribute("autocomplete", "off");
      sInp.setAttribute("data-lpignore", "true");
      sInp.removeAttribute("readonly");
      if (sInp.value && sInp.value.indexOf("@") !== -1) {
        sInp.value = "";
        window.qaafActiveSearchQuery = "";
      }
    }
    document.querySelectorAll('input[type="password"]').forEach(function(inp) {
      inp.setAttribute("type", "text");
      inp.setAttribute("autocomplete", "off");
      inp.style.webkitTextSecurity = "disc";
    });
  }
  sanitizeSearchAndSecretInputs();
  setInterval(sanitizeSearchAndSecretInputs, 1000);

  // =========================================================================
  // C. WORKING 10-LANGUAGE SYSTEM (1. PREFERRED VIDEO LANGUAGE vs 2. DISPLAY LANGUAGE)
  // =========================================================================
  var TEN_ISLAMIC_LANGS = [
    { code: "en", short: "EN", label: "🇬🇧 English", regionKey: "US_UK" },
    { code: "ar", short: "AR", label: "🇸🇦 Arabic (العربية)", regionKey: "AR" },
    { code: "ur", short: "UR", label: "🇵🇰 Urdu (اردو)", regionKey: "PK" },
    { code: "hi", short: "HI", label: "🇮🇳 Hindi (हिन्दी)", regionKey: "GLOBAL" },
    { code: "bn", short: "BN", label: "🇧🇩 Bengali (বাংলা)", regionKey: "BD" },
    { code: "tr", short: "TR", label: "🇹🇷 Turkish (Türkçe)", regionKey: "GLOBAL" },
    { code: "ms", short: "MS", label: "🇲🇾 Malay (Melayu)", regionKey: "GLOBAL" },
    { code: "id", short: "ID", label: "🇮🇩 Indonesian (Bahasa)", regionKey: "GLOBAL" },
    { code: "fr", short: "FR", label: "🇫🇷 French (Français)", regionKey: "US_UK" },
    { code: "ru", short: "RU", label: "🇷🇺 Russian (Русский)", regionKey: "GLOBAL" }
  ];

  if (typeof globalLanguagesList !== "undefined" && Array.isArray(globalLanguagesList)) {
    globalLanguagesList.length = 0;
    TEN_ISLAMIC_LANGS.forEach(function(l) { globalLanguagesList.push(l); });
  }

  currentAppUILang = localStorage.getItem("qaaf_ui_display_lang") || "en";
  preferredContentLang = localStorage.getItem("qaaf_preferred_content_lang") || "en";

  function refreshHeaderLangButtonAndMenu() {
    var shortEl = document.getElementById("shortLangCode");
    var prefObj = TEN_ISLAMIC_LANGS.find(function(l) { return l.code === preferredContentLang; }) || TEN_ISLAMIC_LANGS[0];
    if (shortEl) {
      shortEl.innerText = prefObj.short;
    }

    var menu = document.getElementById("langDropdownMenu");
    if (!menu) return;

    var uiOptHtml = "";
    TEN_ISLAMIC_LANGS.forEach(function(l) {
      uiOptHtml += '<option value="' + l.code + '" ' + (l.code === currentAppUILang ? 'selected' : '') + '>' + l.label + (l.code === 'en' ? ' (Keep App Buttons in English)' : '') + '</option>';
    });

    var prefBtnsHtml = "";
    TEN_ISLAMIC_LANGS.forEach(function(l) {
      var isAct = (l.code === preferredContentLang);
      prefBtnsHtml +=
        '<button type="button" onclick="window.selectQaafPreferredVideoLang(\'' + l.code + '\', event)" class="px-2.5 py-2 rounded-xl text-xs font-extrabold border transition flex items-center justify-between gap-1 ' +
        (isAct ? 'bg-emerald-500 text-black border-emerald-300 shadow-lg scale-[1.02]' : 'bg-black/80 hover:bg-slate-800 text-slate-200 border-slate-700') + '">' +
          '<span class="truncate">' + l.label + '</span>' +
          '<span class="text-[10px] px-1.5 py-0.5 rounded bg-black/25">' + l.short + '</span>' +
        '</button>';
    });

    menu.innerHTML =
      '<div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">' +
        '<div>' +
          '<span class="font-extrabold text-white block text-xs">🌍 Language Setup (10 Core Languages)</span>' +
          '<span class="text-[10px] text-emerald-400 font-bold">Active Preferred Video Language: ' + prefObj.label + ' (' + prefObj.short + ')</span>' +
        '</div>' +
        '<button type="button" onclick="toggleLangDropdown()" class="text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 font-bold">✕</button>' +
      '</div>' +

      '<div class="mb-3.5">' +
        '<label class="block text-[11px] font-extrabold text-emerald-400 mb-1">🎬 1. Preferred Video &amp; Channel Language:</label>' +
        '<p class="text-[10px] text-slate-400 mb-2">Tap your language so its videos &amp; Duas appear first:</p>' +
        '<div class="grid grid-cols-2 gap-1.5">' + prefBtnsHtml + '</div>' +
      '</div>' +

      '<div class="pt-2.5 border-t border-slate-800 mb-2.5">' +
        '<label class="block text-[11px] font-bold text-amber-300 mb-1">📱 2. Display Language (App Buttons: Back, Close, Settings):</label>' +
        '<select id="uiLangSelectDropdown" onchange="window.selectQaafDisplayLang(this.value)" class="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold">' +
          uiOptHtml +
        '</select>' +
      '</div>' +

      '<div class="pt-2.5 border-t border-slate-800">' +
        '<label class="flex items-center justify-between cursor-pointer text-slate-200 font-bold select-none text-xs">' +
          '<span>Strict Language Only (Show only ' + prefObj.short + ' videos)</span>' +
          '<input type="checkbox" id="strictLangToggle" ' + (strictLanguageOnly ? 'checked' : '') + ' onchange="toggleStrictLanguage()" class="accent-emerald-500 rounded scale-110" />' +
        '</label>' +
      '</div>';

    var selHtml = '<option value="global">🌍 Global (All Languages)</option>';
    TEN_ISLAMIC_LANGS.forEach(function(l) { selHtml += '<option value="' + l.code + '">' + l.label + ' (' + l.short + ')</option>'; });
    ["adminVideoLang", "parentVideoLang", "quickReqVideoLang"].forEach(function(id) {
      var s = document.getElementById(id);
      if (s) s.innerHTML = selHtml;
    });
  }

  window.selectQaafPreferredVideoLang = function(code, ev) {
    if (ev) ev.stopPropagation();
    preferredContentLang = code || "en";
    localStorage.setItem("qaaf_preferred_content_lang", preferredContentLang);
    refreshHeaderLangButtonAndMenu();
    var menu = document.getElementById("langDropdownMenu");
    if (menu) menu.classList.add("hidden");
    if (typeof syncRegionalPromoBar === "function") syncRegionalPromoBar();
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    var found = TEN_ISLAMIC_LANGS.find(function(l) { return l.code === preferredContentLang; });
    if (typeof showSyncToast === "function" && found) {
      showSyncToast("✅ Preferred Video Language: " + found.label + " (" + found.short + ")");
    }
  };

  window.selectQaafDisplayLang = function(code) {
    currentAppUILang = code || "en";
    localStorage.setItem("qaaf_ui_display_lang", currentAppUILang);
    refreshHeaderLangButtonAndMenu();
    if (typeof showSyncToast === "function") {
      showSyncToast("📱 Display Language set to " + currentAppUILang.toUpperCase());
    }
  };

  var origToggleLang = window.toggleLangDropdown;
  window.toggleLangDropdown = function() {
    refreshHeaderLangButtonAndMenu();
    var menu = document.getElementById("langDropdownMenu");
    if (menu) menu.classList.toggle("hidden");
  };

  // =========================================================================
  // D. STRICT 1.5s AUTO-HIDE FOR BOTTOM RED VOLUME BAR & TOP-LEFT RED CROSS
  // =========================================================================
  var hideOverlayTimer = null;

  function forceHideOverlays() {
    var topLeftX = document.getElementById("qaafMinimalTopLeftClose");
    var volBar = document.getElementById("qaafBottomSeekVolBar");
    if (topLeftX) {
      topLeftX.style.setProperty("opacity", "0", "important");
      topLeftX.style.setProperty("pointer-events", "none", "important");
    }
    if (volBar) {
      volBar.className = "";
      volBar.style.setProperty("opacity", "0", "important");
      volBar.style.setProperty("pointer-events", "none", "important");
      volBar.style.setProperty("display", "none", "important");
    }
  }

  window.wakeRedOverlay1500 = function() {
    var topLeftX = document.getElementById("qaafMinimalTopLeftClose");
    var volBar = document.getElementById("qaafBottomSeekVolBar");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var isMini = scrollWrap && scrollWrap.classList.contains("hidden");
    if (isMini) {
      forceHideOverlays();
      return;
    }
    if (topLeftX) {
      topLeftX.style.setProperty("display", "block", "important");
      topLeftX.style.setProperty("opacity", "1", "important");
      topLeftX.style.setProperty("pointer-events", "auto", "important");
    }
    if (volBar) {
      volBar.className = "";
      volBar.style.setProperty("display", "flex", "important");
      volBar.style.setProperty("opacity", "1", "important");
      volBar.style.setProperty("pointer-events", "auto", "important");
    }
    if (hideOverlayTimer) clearTimeout(hideOverlayTimer);
    hideOverlayTimer = setTimeout(forceHideOverlays, 1500);
  };

  window.wakeBottomSeekVolume = window.wakeRedOverlay1500;
  window.wakeAllVideoControls1800 = window.wakeRedOverlay1500;
  window.wakeMinimalRedControls1500 = window.wakeRedOverlay1500;

  refreshHeaderLangButtonAndMenu();
  if (typeof window.renderVideosNow === "function") window.renderVideosNow();
})();
