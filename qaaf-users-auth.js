// QAAF Tube Dedicated Users Data, Live Cloud Registry Sync & UI Translation Hook (qaaf-users-auth.js v15.0)
(function initQaafUsersDatabaseAndLanguageMaster() {
  var FIREBASE_DEFAULT_URL = "https://qaaftube-6f251-default-rtdb.firebaseio.com";

  function getFirebaseBaseUrl() {
    var saved = localStorage.getItem("qaaf_firebase_db_url") || FIREBASE_DEFAULT_URL;
    return saved.replace(/\/+$/, "");
  }

  function toSafeFirebaseKey(rawKey) {
    return String(rawKey || "unknown").trim().toLowerCase().replace(/[.#$\[\]\/\s]+/g, "_");
  }

  // A. LIVE CLOUD USERS REGISTRY SYNC (SUPPORTS DOTS IN USERNAMES & EMAILS)
  var isSyncingUsers = false;
  var lastSerializedUsers = "";

  function getLocalUsersMap() {
    var mem = (window.registeredUsersMap && typeof window.registeredUsersMap === "object") ? window.registeredUsersMap : {};
    var stored = {};
    try {
      var raw = localStorage.getItem("qaaf_registered_users");
      if (raw) stored = JSON.parse(raw) || {};
    } catch (e) {}
    var combined = Object.assign({}, stored, mem);
    window.registeredUsersMap = combined;
    return combined;
  }

  window.syncQaafUsersWithCloudNow = function(showFeedback, deletedEmailKey) {
    if (isSyncingUsers) return;
    isSyncingUsers = true;
    var baseUrl = getFirebaseBaseUrl();
    var vaultUrl = baseUrl + "/qaaf_users_vault.json?t=" + Date.now();
    var globalUrl = baseUrl + "/qaaf_global_state/registeredUsersJson.json?t=" + Date.now();

    Promise.all([
      fetch(vaultUrl, { cache: "no-store" }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
      fetch(globalUrl, { cache: "no-store" }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; })
    ]).then(function(results) {
      var vaultData = results[0] || {};
      var globalMapData = results[1] || {};
      var localMap = getLocalUsersMap();
      var mergedMap = {};

      if (typeof globalMapData === "string" && globalMapData.trim().indexOf("{") === 0) {
        try { globalMapData = JSON.parse(globalMapData); } catch (e) {}
      }
      if (globalMapData && typeof globalMapData === "object") {
        Object.keys(globalMapData).forEach(function(k) {
          var u = globalMapData[k];
          if (u && typeof u === "object") {
            var realKey = String(u.userKey || u.email || u.username || k).trim().toLowerCase();
            if (realKey) mergedMap[realKey] = u;
          }
        });
      }

      if (vaultData && typeof vaultData === "object") {
        Object.keys(vaultData).forEach(function(safeK) {
          var item = vaultData[safeK];
          if (!item) return;
          var u = item.userData || item;
          var realKey = String(item.originalKey || (u && (u.userKey || u.email || u.username)) || safeK).trim().toLowerCase();
          if (u && typeof u === "object" && realKey) {
            mergedMap[realKey] = u;
          }
        });
      }

      Object.keys(localMap).forEach(function(k) {
        var u = localMap[k];
        if (u && typeof u === "object") {
          var realKey = String(u.userKey || u.email || u.username || k).trim().toLowerCase();
          if (realKey) {
            mergedMap[realKey] = Object.assign({}, mergedMap[realKey] || {}, u);
          }
        }
      });

      if (deletedEmailKey) {
        var delKey = String(deletedEmailKey).trim().toLowerCase();
        delete mergedMap[delKey];
        var safeDel = toSafeFirebaseKey(delKey);
        fetch(baseUrl + "/qaaf_users_vault/" + safeDel + ".json", { method: "DELETE" }).catch(function() {});
      }

      window.registeredUsersMap = mergedMap;
      lastSerializedUsers = JSON.stringify(mergedMap);
      try { localStorage.setItem("qaaf_registered_users", lastSerializedUsers); } catch (e) {}

      var patchPayload = {};
      Object.keys(mergedMap).forEach(function(realKey) {
        var u = mergedMap[realKey];
        if (!u || typeof u !== "object") return;
        var safeK = toSafeFirebaseKey(realKey);
        patchPayload[safeK] = { originalKey: realKey, updatedAt: Date.now(), userData: u };
      });

      if (Object.keys(patchPayload).length > 0) {
        fetch(baseUrl + "/qaaf_users_vault.json", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload)
        }).catch(function() {});

        fetch(baseUrl + "/qaaf_global_state/registeredUsersJson.json", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(JSON.stringify(mergedMap))
        }).catch(function() {});
      }

      if (typeof window.renderAdminUsersTable === "function") window.renderAdminUsersTable();
      if (showFeedback && typeof showSyncToast === "function") {
        showSyncToast("✅ Cloud Users Synced: " + Object.keys(mergedMap).length + " accounts!");
      }
      isSyncingUsers = false;
    }).catch(function() {
      isSyncingUsers = false;
    });
  };

  // B. EXPORT / IMPORT USERS JSON IN ADMIN PANEL
  window.adminExportUsersDatabaseJson = function() {
    var map = getLocalUsersMap();
    var backupObj = {
      qaafUsersDatabaseVersion: "15.0",
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
          window.registeredUsersMap = Object.assign({}, getLocalUsersMap(), incoming);
          localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
          window.syncQaafUsersWithCloudNow(true);
          if (window.renderAdminUsersTable) window.renderAdminUsersTable();
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
    bar.className = "bg-gradient-to-r from-emerald-950/60 via-slate-900 to-blue-950/60 border border-emerald-500/40 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs mb-3";
    bar.innerHTML =
      '<div>' +
        '<h5 class="font-extrabold text-emerald-300">💾 Live Cloud Users &amp; Passwords Database</h5>' +
        '<p class="text-[10px] text-slate-400">All accounts, passwords, PINs &amp; secret words sync live across all devices</p>' +
      '</div>' +
      '<div class="flex flex-wrap items-center gap-2">' +
        '<button type="button" onclick="window.syncQaafUsersWithCloudNow(true)" class="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 rounded-xl font-extrabold shadow flex items-center gap-1 cursor-pointer"><span>🔄</span><span>Sync Live Users Now</span></button>' +
        '<button type="button" onclick="adminExportUsersDatabaseJson()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-extrabold shadow flex items-center gap-1 cursor-pointer"><span>📥</span><span>Download Users (.json)</span></button>' +
        '<label class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl font-extrabold shadow flex items-center gap-1 cursor-pointer"><span>📤</span><span>Restore Users (.json)</span><input type="file" accept=".json" onchange="adminImportUsersDatabaseJson(event)" class="hidden" /></label>' +
      '</div>';
    usersPane.insertBefore(bar, usersPane.children[1] || usersPane.firstChild);
  }

  var prevOpenAdm = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevOpenAdm) prevOpenAdm();
    injectUsersDatabaseBackupBar();
    window.syncQaafUsersWithCloudNow(false);
  };

  // C. ENSURE LANGUAGE MENU IS PORTALED TO BODY & TRANSLATIONS PERSIST AFTER EVERY VIDEO RENDER
  var savedUI = localStorage.getItem("qaaf_ui_display_lang") || "en";
  var savedPref = localStorage.getItem("qaaf_preferred_content_lang") || "en";
  currentAppUILang = savedUI;
  preferredContentLang = savedPref;
  window.currentAppUILang = savedUI;
  window.preferredContentLang = savedPref;

  var menuEl = document.getElementById("langDropdownMenu");
  if (menuEl && menuEl.parentElement !== document.body) {
    document.body.appendChild(menuEl);
  }

  if (typeof populateLanguageDropdowns === "function") populateLanguageDropdowns();
  if (typeof handleUILangSelectChange === "function") handleUILangSelectChange(currentAppUILang);
  if (typeof handleContentLangSelectChange === "function") handleContentLangSelectChange(preferredContentLang);

  if (typeof window.renderVideosNow === "function") {
    var origRenderNow = window.renderVideosNow;
    window.renderVideosNow = function() {
      origRenderNow.apply(this, arguments);
      if (typeof window.translateAllQaafWebsiteText === "function") {
        window.translateAllQaafWebsiteText(window.currentAppUILang || "en");
      }
    };
    window.renderVideosNow();
  }

  setInterval(function() {
    if (typeof window.translateAllQaafWebsiteText === "function") {
      window.translateAllQaafWebsiteText(window.currentAppUILang || "en");
    }
  }, 700);

  injectUsersDatabaseBackupBar();
  window.syncQaafUsersWithCloudNow(false);
})();
