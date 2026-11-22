// QAAF Tube Master Users Sync, Channel Playlists, Admin Importer & Sleek Games Hub (qaaf-users-auth.js v27.0)
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

  window.adminExportUsersDatabaseJson = function() {
    var map = getLocalUsersMap();
    var backupObj = {
      qaafUsersDatabaseVersion: "27.0",
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

  setTimeout(function() { if (typeof window.translateAllQaafWebsiteText === 'function') window.translateAllQaafWebsiteText(window.currentAppUILang || 'en'); }, 500);

  injectUsersDatabaseBackupBar();
  window.syncQaafUsersWithCloudNow(false);
})();

// =========================================================================
// SECTION 2: CHANNEL TABS (VIDEOS / SHORTS / OFFICIAL YOUTUBE PLAYLISTS)
// =========================================================================
(function initQaafChannelTabsAndPlaylistsEngine() {
  var FIREBASE_DEFAULT_URL = "https://qaaftube-6f251-default-rtdb.firebaseio.com";
  function getFbBase() {
    return (localStorage.getItem("qaaf_firebase_db_url") || FIREBASE_DEFAULT_URL).replace(/\/+$/, "");
  }

  window.qaafChannelActiveSubTab = "videos";
  window.qaafChannelSelectedPlaylistObj = null;
  window.qaafRealChannelPlaylistsMap = JSON.parse(localStorage.getItem("qaaf_real_channel_playlists_v1") || "{}");
  window.qaafBlockedPlaylistIds = JSON.parse(localStorage.getItem("qaaf_blocked_playlist_ids") || "[]");
  window.qaafPlaylistVideosCache = JSON.parse(localStorage.getItem("qaaf_playlist_videos_cache_v1") || "{}");
  var isFetchingChannelPls = {};
  var isFetchingSinglePlVids = false;

  window.savePlaylistsToLocalAndCloudDb = function() {
    try {
      localStorage.setItem("qaaf_real_channel_playlists_v1", JSON.stringify(window.qaafRealChannelPlaylistsMap));
      localStorage.setItem("qaaf_blocked_playlist_ids", JSON.stringify(window.qaafBlockedPlaylistIds));
      localStorage.setItem("qaaf_playlist_videos_cache_v1", JSON.stringify(window.qaafPlaylistVideosCache));
    } catch (e) {}

    var base = getFbBase();
    var plJsonStr = JSON.stringify(window.qaafRealChannelPlaylistsMap || {});
    var cacheJsonStr = JSON.stringify(window.qaafPlaylistVideosCache || {});

    fetch(base + "/qaaf_global_state/channelPlaylistsJson.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plJsonStr)
    }).catch(function() {});

    fetch(base + "/qaaf_global_state/playlistVideosCacheJson.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cacheJsonStr)
    }).catch(function() {});

    fetch(base + "/qaaf_channel_playlists_db.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playlistsJson: plJsonStr,
        playlistVideosJson: cacheJsonStr,
        blockedPlaylistIds: window.qaafBlockedPlaylistIds || [],
        updatedAt: Date.now()
      })
    }).catch(function() {});
  };

  function pullSavedPlaylistsFromCloudDb() {
    var base = getFbBase();
    Promise.all([
      fetch(base + "/qaaf_global_state/channelPlaylistsJson.json?t=" + Date.now()).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
      fetch(base + "/qaaf_global_state/playlistVideosCacheJson.json?t=" + Date.now()).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
      fetch(base + "/qaaf_channel_playlists_db.json?t=" + Date.now()).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; })
    ]).then(function(res) {
      var gPlStr = res[0];
      var gCacheStr = res[1];
      var dbNode = res[2];
      var changed = false;

      if (typeof gPlStr === "string" && gPlStr.indexOf("{") === 0) {
        try {
          var parsedPls = JSON.parse(gPlStr);
          Object.keys(parsedPls || {}).forEach(function(ch) {
            if (!window.qaafRealChannelPlaylistsMap[ch] || window.qaafRealChannelPlaylistsMap[ch].length === 0) {
              window.qaafRealChannelPlaylistsMap[ch] = parsedPls[ch];
              changed = true;
            }
          });
        } catch (e) {}
      }

      if (typeof gCacheStr === "string" && gCacheStr.indexOf("{") === 0) {
        try {
          var parsedCache = JSON.parse(gCacheStr);
          Object.keys(parsedCache || {}).forEach(function(plId) {
            if (!window.qaafPlaylistVideosCache[plId] || window.qaafPlaylistVideosCache[plId].length === 0) {
              window.qaafPlaylistVideosCache[plId] = parsedCache[plId];
              changed = true;
            }
          });
        } catch (e) {}
      }

      if (dbNode && typeof dbNode === "object") {
        if (typeof dbNode.playlistsJson === "string") {
          try {
            var p2 = JSON.parse(dbNode.playlistsJson);
            Object.keys(p2 || {}).forEach(function(ch) {
              if (!window.qaafRealChannelPlaylistsMap[ch] || window.qaafRealChannelPlaylistsMap[ch].length === 0) {
                window.qaafRealChannelPlaylistsMap[ch] = p2[ch];
                changed = true;
              }
            });
          } catch (e) {}
        }
        if (typeof dbNode.playlistVideosJson === "string") {
          try {
            var c2 = JSON.parse(dbNode.playlistVideosJson);
            Object.keys(c2 || {}).forEach(function(plId) {
              if (!window.qaafPlaylistVideosCache[plId] || window.qaafPlaylistVideosCache[plId].length === 0) {
                window.qaafPlaylistVideosCache[plId] = c2[plId];
                changed = true;
              }
            });
          } catch (e) {}
        }
        if (Array.isArray(dbNode.blockedPlaylistIds)) {
          window.qaafBlockedPlaylistIds = dbNode.blockedPlaylistIds;
          localStorage.setItem("qaaf_blocked_playlist_ids", JSON.stringify(window.qaafBlockedPlaylistIds));
        }
      }

      if (changed) {
        try {
          localStorage.setItem("qaaf_real_channel_playlists_v1", JSON.stringify(window.qaafRealChannelPlaylistsMap));
          localStorage.setItem("qaaf_playlist_videos_cache_v1", JSON.stringify(window.qaafPlaylistVideosCache));
        } catch (e) {}
        if (typeof window.renderVideosNow === "function") window.renderVideosNow();
      }
    });
  }

  pullSavedPlaylistsFromCloudDb();

  var CHANNEL_UI_LABELS = {
    en: { backAll: "⬅️ All Channels", tabVideos: "🎬 Videos", tabShorts: '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-white shrink-0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M14.2 8.6C14.2 7 9.8 7 9.8 9.2C9.8 11.3 14.2 11.7 14.2 14.2C14.2 16.5 9.8 16.5 9.8 14.8"/></svg> <span>Shorts</span>', tabPlaylists: "📂 Playlists", verifiedCh: "Verified Islamic Channel", singleVidCh: "Selected Videos Channel", videosCount: "videos", openPl: "View full playlist", backPl: "⬅️ Back to Playlists", noShorts: "No Shorts in this channel yet.", noPlaylists: "No official YouTube playlists found for this channel.", loadingPls: "⏳ Preparing channel playlists...", loadingPlVids: "⏳ Opening playlist videos...", refreshPls: "🔄 Update Playlists" },
    ur: { backAll: "⬅️ تمام چینلز", tabVideos: "🎬 ویڈیوز", tabShorts: '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-white shrink-0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M14.2 8.6C14.2 7 9.8 7 9.8 9.2C9.8 11.3 14.2 11.7 14.2 14.2C14.2 16.5 9.8 16.5 9.8 14.8"/></svg> <span>شارٹس</span>', tabPlaylists: "📂 پلے لسٹس", verifiedCh: "تصدیق شدہ اسلامی چینل", singleVidCh: "منتخب ویڈیوز والا چینل", videosCount: "ویڈیوز", openPl: "پوری پلے لسٹ دیکھیں", backPl: "⬅️ تمام پلے لسٹس پر واپس", noShorts: "اس چینل میں ابھی کوئی شارٹس نہیں ہیں۔", noPlaylists: "اس چینل پر کوئی یوٹیوب پلے لسٹ نہیں ملی۔", loadingPls: "⏳ پلے لسٹس کھل رہی ہیں...", loadingPlVids: "⏳ پلے لسٹ کی ویڈیوز کھل رہی ہیں...", refreshPls: "🔄 پلے لسٹس اپ ڈیٹ کریں" },
    ar: { backAll: "⬅️ جميع القنوات", tabVideos: "🎬 الفيديوهات", tabShorts: '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-white shrink-0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M14.2 8.6C14.2 7 9.8 7 9.8 9.2C9.8 11.3 14.2 11.7 14.2 14.2C14.2 16.5 9.8 16.5 9.8 14.8"/></svg> <span>المقاطع القصيرة</span>', tabPlaylists: "📂 قوائم التشغيل", verifiedCh: "قناة إسلامية موثقة", singleVidCh: "قناة فيديوهات مختارة", videosCount: "فيديو", openPl: "عرض قائمة التشغيل الكاملة", backPl: "⬅️ العودة لقوائم التشغيل", noShorts: "لا توجد مقاطع قصيرة في هذه القناة.", noPlaylists: "لا توجد قوائم تشغيل على يوتيوب لهذه القناة.", loadingPls: "⏳ جاري فتح قوائم التشغيل...", loadingPlVids: "⏳ جاري فتح فيديوهات القائمة...", refreshPls: "🔄 تحديث القوائم" }
  };

  function getChLabels() {
    var code = window.currentAppUILang || localStorage.getItem("qaaf_ui_display_lang") || "en";
    return CHANNEL_UI_LABELS[code] || CHANNEL_UI_LABELS.en;
  }

  // Direct Multi-Engine Playlist Finder (Parses Jina Markdown + YouTube lockupViewModel + Playlist Page Titles directly!)
  window.discoverYouTubePlaylistsForChannel = async function(channelName, channelUrlHint) {
    var baseChannel = (channelUrlHint || "").trim();
    if (!baseChannel && channelName) {
      var chVids = (videosData || []).filter(function(v) { return v && v.channel === channelName && v.ytId; });
      if (chVids[0]) {
        try {
          var oeRes = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + chVids[0].ytId);
          var oeData = await oeRes.json();
          if (oeData && oeData.author_url) baseChannel = oeData.author_url;
        } catch (e) {}
      }
    }
    if (!baseChannel && channelName) {
      baseChannel = "https://www.youtube.com/@" + channelName.replace(/\|.*$/, "").trim().replace(/\s+/g, "");
    }
    baseChannel = baseChannel.replace(/\/(videos|shorts|featured|streams|playlists)?\/?$/, "");

    var plMetaMap = new Map();
    function cleanPlTitle(rawT) {
      if (!rawT) return "";
      var t = String(rawT)
        .replace(/\\u0026/g, "&")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/^#+\s*/, "")
        .replace(/\s*-\s*YouTube$/i, "")
        .trim();
      if (/^(view full playlist|play all|playlist|\d+\s*videos?|!\[image.*)$/i.test(t)) return "";
      return t;
    }

    function addPl(listId, title, thumb, countText, sampleVidId) {
      if (!listId || !/^PL[a-zA-Z0-9_-]{10,}$/.test(listId)) return;
      var ex = plMetaMap.get(listId) || { listId: listId, title: "", thumb: "", countText: "", sampleVidId: "" };
      var cTitle = cleanPlTitle(title);
      if (cTitle && cTitle.length > 2) {
        if (!ex.title || cTitle.length > ex.title.length) ex.title = cTitle;
      }
      if (sampleVidId && /^[a-zA-Z0-9_-]{11}$/.test(sampleVidId)) {
        if (!ex.sampleVidId) ex.sampleVidId = sampleVidId;
        if (!ex.thumb) ex.thumb = "https://i.ytimg.com/vi/" + sampleVidId + "/hqdefault.jpg";
      }
      if (thumb && !ex.thumb) ex.thumb = thumb;
      if (countText && !ex.countText) ex.countText = countText;
      plMetaMap.set(listId, ex);
    }

    function scanRawTextForPlaylists(rawText) {
      if (!rawText) return;

      // 1. Jina Markdown Links: ### [Title](https://www.youtube.com/watch?v=VID&list=PL...) or [### Title](...)
      var mdLinkRgx = /\[([^\[\]\n]{3,140})\]\(https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?v=([a-zA-Z0-9_-]{11})(?:&|&amp;)list=|playlist\?list=)(PL[a-zA-Z0-9_-]{10,})[^\)]*\)/g;
      var m1 = rawText.matchAll(mdLinkRgx);
      for (var a of m1) {
        var rawLbl = a[1] || "";
        var vId = a[2] || "";
        var pId = a[3] || "";
        var cntMatch = rawLbl.match(/(\d+)\s+videos?/i);
        var cnt = cntMatch ? cntMatch[1] : "";
        if (!/!\[image/i.test(rawLbl)) {
          addPl(pId, rawLbl, "", cnt, vId);
        } else {
          addPl(pId, "", "", cnt, vId);
        }
      }

      // 2. YouTube 2025/2026 lockupViewModel JSON: "contentId":"PL..." ... "title":{"content":"Title"}
      var lockupRgx = /"contentId"\s*:\s*"(PL[a-zA-Z0-9_-]{10,})"(?:(?!lockupViewModel).){1,2200}?"title"\s*:\s*\{\s*"content"\s*:\s*"([^"]{2,150})"/g;
      var m2 = rawText.matchAll(lockupRgx);
      for (var b of m2) {
        addPl(b[1], b[2], "", "", "");
      }

      // 3. Classic gridPlaylistRenderer / playlistRenderer JSON: "playlistId":"PL..." ... "title":{"runs":[{"text":"Title"}]} or {"simpleText":"Title"}
      var classicRgx = /"playlistId"\s*:\s*"(PL[a-zA-Z0-9_-]{10,})"(?:(?!playlistRenderer).){1,1800}?"title"\s*:\s*\{(?:\s*"simpleText"\s*:\s*"([^"]{2,150})"|\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]{2,150})")/g;
      var m3 = rawText.matchAll(classicRgx);
      for (var c of m3) {
        addPl(c[1], c[2] || c[3] || "", "", "", "");
      }

      // 4. Watch URLs pairing videoId + listId: watch?v=VID&list=PL...
      var watchMatches = rawText.matchAll(/watch\?v=([a-zA-Z0-9_-]{11})(?:&|&amp;|\\u0026)list=(PL[a-zA-Z0-9_-]{10,})/g);
      for (var wm of watchMatches) {
        addPl(wm[2], "", "", "", wm[1]);
      }

      // 5. Any remaining PL... IDs in text
      var barePatterns = [
        /list=(PL[a-zA-Z0-9_-]{10,})/g,
        /"playlistId"\s*:\s*"(PL[a-zA-Z0-9_-]{10,})"/g,
        /"contentId"\s*:\s*"(PL[a-zA-Z0-9_-]{10,})"/g
      ];
      barePatterns.forEach(function(rgx) {
        var matches = rawText.matchAll(rgx);
        for (var m of matches) {
          addPl(m[1], "", "", "", "");
        }
      });
    }

    var urlsToTry = [];
    if (baseChannel) {
      urlsToTry.push(baseChannel + "/playlists");
      urlsToTry.push(baseChannel);
    }
    /* Removed global search playlist fallback so fake 20 playlists never appear */

    for (var uIdx = 0; uIdx < urlsToTry.length; uIdx++) {
      var uUrl = urlsToTry[uIdx];
      // 1. Plain Jina Reader
      try {
        var r1 = await fetch("https://r.jina.ai/" + uUrl);
        if (r1.ok) scanRawTextForPlaylists(await r1.text());
      } catch (e) {}

      // 2. CodeTabs Proxy (Raw YouTube HTML with ytInitialData JSON)
      if (plMetaMap.size < 3) {
        try {
          var sep = uUrl.indexOf("?") === -1 ? "?" : "&";
          var r2 = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(uUrl + sep + "ucbcb=1&hl=en"));
          if (r2.ok) scanRawTextForPlaylists(await r2.text());
        } catch (e) {}
      }

      // 3. AllOrigins Proxy (Raw YouTube HTML)
      if (plMetaMap.size < 3) {
        try {
          var sep2 = uUrl.indexOf("?") === -1 ? "?" : "&";
          var r3 = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(uUrl + sep2 + "ucbcb=1&hl=en"));
          if (r3.ok) scanRawTextForPlaylists(await r3.text());
        } catch (e) {}
      }

      if (plMetaMap.size >= 4) break;
    }

    var candidates = Array.from(plMetaMap.values()).slice(0, 25);

    // Resolve any missing title or thumbnail by checking Jina Playlist Page or sample video oEmbed
    await Promise.all(candidates.map(async function(item) {
      if (!item.title || !item.thumb) {
        try {
          var rPl = await fetch("https://r.jina.ai/https://www.youtube.com/playlist?list=" + item.listId);
          if (rPl.ok) {
            var txtPl = await rPl.text();
            var tMatch = txtPl.match(/^Title:\s*(.+?)\s*(?:-\s*YouTube)?$/m);
            if (tMatch && tMatch[1]) {
              var cleaned = cleanPlTitle(tMatch[1]);
              if (cleaned && cleaned.toLowerCase() !== "youtube") item.title = cleaned;
            }
            if (!item.thumb) {
              var vMatch = txtPl.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
              if (vMatch && vMatch[1]) {
                item.sampleVidId = vMatch[1];
                item.thumb = "https://i.ytimg.com/vi/" + vMatch[1] + "/hqdefault.jpg";
              }
            }
          }
        } catch (e) {}
      }

      if (!item.title && item.sampleVidId) {
        try {
          var rVid = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + item.sampleVidId);
          var dVid = await rVid.json();
          if (dVid && dVid.title) {
            item.title = "Playlist: " + dVid.title;
          }
        } catch (e) {}
      }

      if (!item.title) {
        item.title = (channelName ? (channelName.split("|")[0].trim() + " ") : "") + "Playlist (" + item.listId.slice(0, 8) + ")";
      }
    }));

    return candidates.filter(function(x) { return !!x.listId; });
  };

  window.fetchOfficialYouTubePlaylistsForChannel = async function(channelName, forceRefresh) {
    if (!channelName) return [];
    if (!forceRefresh && Array.isArray(window.qaafRealChannelPlaylistsMap[channelName]) && window.qaafRealChannelPlaylistsMap[channelName].length > 0) {
      return window.qaafRealChannelPlaylistsMap[channelName];
    }
    if (isFetchingChannelPls[channelName]) return [];
    isFetchingChannelPls[channelName] = true;

    try {
      var foundPlaylists = await window.discoverYouTubePlaylistsForChannel(channelName, "");
      if (foundPlaylists.length > 0) {
        window.qaafRealChannelPlaylistsMap[channelName] = foundPlaylists;
        window.savePlaylistsToLocalAndCloudDb();
      }
      isFetchingChannelPls[channelName] = false;
      if (window.qaafSelectedChannel === channelName && typeof window.renderVideosNow === "function") {
        window.renderVideosNow();
      }
      return foundPlaylists;
    } catch (e) {
      isFetchingChannelPls[channelName] = false;
      return [];
    }
  };

  function normalizeWordsForPlaylistMatch(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/mohammad|muhammed|mohamed/g, "muhammad")
      .replace(/salaah/g, "salah")
      .replace(/abdur\s*rahman|abdulrahman/g, "abdul rahman")
      .replace(/yasir|yasser/g, "yasir")
      .replace(/ash\s*shuraim|al\s*shuraim/g, "shuraim")
      .replace(/al\s*ghamdi|ghamidi/g, "ghamdi")
      .replace(/al\s*dosary|aldosari|dossary/g, "dosary")
      .replace(/al\s*juhany|juhani/g, "juhany")
      .replace(/al\s*muhanna|muhana/g, "muhanna")
      .replace(/al\s*qasim|qassim/g, "qasim")
      .replace(/al\s*budair|budayr/g, "budair")
      .replace(/hudhaify|huthaify|hudhaifi/g, "hudhaify")
      .replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getInstantMatchedVideosForPlaylist(plTitle, channelName, listId) {
    var byYtId = new Map();
    (videosData || []).forEach(function(v) { if (v && v.ytId) byYtId.set(v.ytId, v); });

    var resultsMap = new Map();
    function addVid(v) {
      if (v && (v.ytId || v.id)) {
        resultsMap.set(v.ytId || v.id, v);
      }
    }

    // 1. Direct videos in videosData with matching playlistId or playlistName
    var chVids = (videosData || []).filter(function(v) { return v && v.channel === channelName; });
    chVids.forEach(function(v) {
      if ((listId && v.playlistId === listId) || (plTitle && v.playlistName === plTitle)) {
        addVid(v);
      }
    });

    // 2. Cached playlist videos
    var cached = window.qaafPlaylistVideosCache[listId];
    if (Array.isArray(cached) && cached.length > 0) {
      cached.forEach(function(item) {
        if (typeof item === "string") {
          if (byYtId.has(item)) addVid(byYtId.get(item));
        } else if (item && item.ytId) {
          addVid(byYtId.get(item.ytId) || item);
        }
      });
    }

    // 3. Smart Title / Sheikh Name matcher across the channel's existing videos
    if (plTitle) {
      var normPl = normalizeWordsForPlaylistMatch(plTitle.replace(/^sheikh\s+/i, ""));
      var keyTokens = normPl.split(" ").filter(function(w) { return w.length >= 3 && w !== "sheikh" && w !== "al"; });
      if (keyTokens.length > 0) {
        chVids.forEach(function(v) {
          var normVidTitle = normalizeWordsForPlaylistMatch((v.title || "") + " " + (v.playlistName || ""));
          var allMatched = keyTokens.every(function(tk) { return normVidTitle.indexOf(tk) !== -1; });
          if (allMatched) addVid(v);
        });
      }
    }

    return sortVideosBySurahOrPlaylistOrder(Array.from(resultsMap.values()));
  }

  // Fetch ALL videos of a YouTube playlist including >100 continuation (Surahs 101 to 114!)
  window.harvestAllPlaylistVideoIdsUpTo200 = async function(listId) {
    if (!listId) return [];
    var foundVidIds = [];
    var officialTotalCount = 0;

    function addId(id) {
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id) && foundVidIds.indexOf(id) === -1) {
        foundVidIds.push(id);
      }
    }

    function normalizeYtRaw(txt) {
      return String(txt || "")
        .replace(/\\u0026/g, "&")
        .replace(/&amp;/g, "&")
        .replace(/\\\//g, "/");
    }

    var plUrl = "https://www.youtube.com/playlist?list=" + listId;
    try {
      var r1 = await fetch("https://r.jina.ai/" + plUrl);
      if (r1.ok) {
        var t1 = normalizeYtRaw(await r1.text());
        var cntM = t1.match(/\b(\d{2,3})\s+videos\b/i);
        if (cntM && cntM[1]) officialTotalCount = parseInt(cntM[1], 10);
        var m1 = t1.matchAll(/(?:watch\?v=|\/shorts\/|"videoId"\s*:\s*")([a-zA-Z0-9_-]{11})/g);
        for (var a of m1) addId(a[1]);
      }
    } catch (e) {}

    if (foundVidIds.length < 95) {
      try {
        var r2 = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(plUrl + "&ucbcb=1&hl=en"));
        if (r2.ok) {
          var t2 = normalizeYtRaw(await r2.text());
          if (!officialTotalCount) {
            var cntM2 = t2.match(/\b(\d{2,3})\s+videos\b/i);
            if (cntM2 && cntM2[1]) officialTotalCount = parseInt(cntM2[1], 10);
          }
          var m2 = t2.matchAll(/(?:watch\?v=|\/shorts\/|"videoId"\s*:\s*")([a-zA-Z0-9_-]{11})/g);
          for (var b of m2) addId(b[1]);
        }
      } catch (e) {}
    }

    // If playlist hit YouTube's 100-video initial page cap (foundVidIds.length >= 95),
    // fetch the remaining videos (101..114+) from YouTube's Watch Playlist Panel!
    if (foundVidIds.length >= 95) {
      var escListId = listId.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

      function extractStrictlyFromPlaylistPanel(rawWatchText) {
        if (!rawWatchText) return;
        var cleanTxt = normalizeYtRaw(rawWatchText);

        // 1. Any /watch?v=VID&list=THIS_LIST_ID inside ytInitialData or Markdown
        var rgxLink = new RegExp("watch\\?v=([a-zA-Z0-9_-]{11})&list=" + escListId, "g");
        var ml = cleanTxt.matchAll(rgxLink);
        for (var x of ml) addId(x[1]);

        // 2. JSON watchEndpoint with videoId and playlistId
        var rgxJson1 = new RegExp('"videoId"\\s*:\\s*"([a-zA-Z0-9_-]{11})"[^\\{\\}]{0,120}?"playlistId"\\s*:\\s*"' + escListId + '"', "g");
        var mj1 = cleanTxt.matchAll(rgxJson1);
        for (var y of mj1) addId(y[1]);

        // 3. Extract playlistPanelRenderer block and grab all videoIds inside it
        var panelIdx = cleanTxt.indexOf('"playlistPanelRenderer"');
        if (panelIdx !== -1) {
          var panelSlice = cleanTxt.slice(panelIdx, panelIdx + 250000);
          var mPanel = panelSlice.matchAll(/"playlistPanelVideoRenderer"\s*:\s*\{[\s\S]{1,3500}?"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g);
          for (var z of mPanel) addId(z[1]);
        }
      }

      var pivotIndices = [foundVidIds.length - 1, Math.min(98, foundVidIds.length - 1)];
      for (var p = 0; p < pivotIndices.length; p++) {
        if (foundVidIds.length >= 114) break;
        var pIdx = pivotIndices[p];
        var pivotVidId = foundVidIds[pIdx];
        if (!pivotVidId) continue;
        var watchContUrl = "https://www.youtube.com/watch?v=" + pivotVidId + "&list=" + listId + "&index=" + (pIdx + 1);

        try {
          var rw1 = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(watchContUrl + "&ucbcb=1&hl=en"));
          if (rw1.ok) extractStrictlyFromPlaylistPanel(await rw1.text());
        } catch (e) {}

        if (foundVidIds.length < 110) {
          try {
            var rw2 = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(watchContUrl + "&ucbcb=1&hl=en"));
            if (rw2.ok) extractStrictlyFromPlaylistPanel(await rw2.text());
          } catch (e) {}
        }

        if (foundVidIds.length < 110) {
          try {
            var rw3 = await fetch("https://r.jina.ai/" + watchContUrl);
            if (rw3.ok) extractStrictlyFromPlaylistPanel(await rw3.text());
          } catch (e) {}
        }
      }
    }

    if (officialTotalCount > foundVidIds.length) {
      if (!window.qaafPlaylistOfficialCountMap) window.qaafPlaylistOfficialCountMap = {};
      window.qaafPlaylistOfficialCountMap[listId] = officialTotalCount;
    }

    return foundVidIds.slice(0, 200);
  };

  function sortVideosBySurahOrPlaylistOrder(vidsArray) {
    if (!Array.isArray(vidsArray) || vidsArray.length <= 1) return vidsArray || [];
    var withSurahCount = 0;
    vidsArray.forEach(function(v) {
      if (v && v.title && /\b(?:quran|surah)\s+0*(\d{1,3})\b/i.test(v.title)) withSurahCount++;
    });
    if (withSurahCount >= Math.min(5, Math.floor(vidsArray.length * 0.4))) {
      return vidsArray.slice().sort(function(a, b) {
        var ma = (a && a.title) ? a.title.match(/\b(?:quran|surah)\s+0*(\d{1,3})\b/i) : null;
        var mb = (b && b.title) ? b.title.match(/\b(?:quran|surah)\s+0*(\d{1,3})\b/i) : null;
        var na = ma ? parseInt(ma[1], 10) : 999;
        var nb = mb ? parseInt(mb[1], 10) : 999;
        return na - nb;
      });
    }
    return vidsArray;
  }


  window.openQaafOfficialYouTubePlaylist = async function(listId, plTitle, channelName) {
    window.qaafChannelActiveSubTab = "playlists";
    window.qaafChannelSelectedPlaylistObj = { listId: listId, title: plTitle, channel: channelName };

    if (typeof window.renderVideosNow === "function") window.renderVideosNow();

    var cachedNow = window.qaafPlaylistVideosCache[listId];
    if (Array.isArray(cachedNow) && cachedNow.length > 0 && cachedNow.length !== 100 && cachedNow.length !== 101) {
      return;
    }

    if (isFetchingSinglePlVids) return;
    isFetchingSinglePlVids = true;

    try {
      var targetIds = await window.harvestAllPlaylistVideoIdsUpTo200(listId);
      var existingByYtId = new Map();
      var sampleCat = "quran";
      var sampleLang = "global";
      (videosData || []).forEach(function(v) {
        if (v && v.ytId) existingByYtId.set(v.ytId, v);
        if (v && v.channel === channelName) {
          if (v.category) sampleCat = v.category;
          if (v.lang) sampleLang = v.lang;
        }
      });

      var resolvedVids = [];
      var missingYtIds = [];
      targetIds.forEach(function(ytId) {
        if (existingByYtId.has(ytId)) {
          var vObj = existingByYtId.get(ytId);
          vObj.playlistId = listId;
          vObj.playlistName = plTitle;
          resolvedVids.push(vObj);
        } else {
          missingYtIds.push(ytId);
        }
      });

      if (missingYtIds.length > 0) {
        var CHUNK = 20;
        for (var i = 0; i < missingYtIds.length; i += CHUNK) {
          var slice = missingYtIds.slice(i, i + CHUNK);
          var extraBatch = await Promise.all(slice.map(async function(ytId) {
            try {
              var r = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + ytId);
              var info = await r.json();
              if (info && info.title) {
                var newVidObj = {
                  id: "v_" + ytId,
                  ytId: ytId,
                  title: info.title,
                  channel: channelName,
                  lang: sampleLang,
                  region: sampleLang.toUpperCase(),
                  category: sampleCat,
                  kidsSafe: (sampleCat !== "bayan"),
                  channelVerified: true,
                  playlistId: listId,
                  playlistName: plTitle,
                  duration: "10:00",
                  views: 2500,
                  createdAt: Math.floor(Date.now() / 1000)
                };
                if (!videosData.some(function(x) { return x.ytId === ytId; })) {
                  videosData.push(newVidObj);
                }
                return newVidObj;
              }
            } catch (e) {}
            return null;
          }));
          extraBatch.forEach(function(item) { if (item) resolvedVids.push(item); });
        }
      }

      if (resolvedVids.length > 0) {
        resolvedVids = sortVideosBySurahOrPlaylistOrder(resolvedVids);
        window.qaafPlaylistVideosCache[listId] = resolvedVids;
        localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
        window.savePlaylistsToLocalAndCloudDb();
      }
    } catch (e) {}

    isFetchingSinglePlVids = false;
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
  };

  window.adminDeleteChannelPlaylistCard = function(channelName, listId, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (!confirm("👑 Admin: Hide/Remove this playlist from QAAF Tube?")) return;
    if (window.qaafBlockedPlaylistIds.indexOf(listId) === -1) {
      window.qaafBlockedPlaylistIds.push(listId);
    }
    if (Array.isArray(window.qaafRealChannelPlaylistsMap[channelName])) {
      window.qaafRealChannelPlaylistsMap[channelName] = window.qaafRealChannelPlaylistsMap[channelName].filter(function(p) {
        return p.listId !== listId;
      });
    }
    window.savePlaylistsToLocalAndCloudDb();
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
  };

  window.switchQaafChannelSubTab = function(subTab) {
    window.qaafChannelActiveSubTab = subTab || "videos";
    window.qaafChannelSelectedPlaylistObj = null;
    window.qaafGridPageLimit = 24;
    if (subTab === "playlists" && window.qaafSelectedChannel && window.qaafSelectedChannel !== "ALL") {
      window.fetchOfficialYouTubePlaylistsForChannel(window.qaafSelectedChannel, false);
    }
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
  };

  window.exitQaafChannelView = function() {
    window.qaafSelectedChannel = "ALL";
    window.qaafChannelActiveSubTab = "videos";
    window.qaafChannelSelectedPlaylistObj = null;
    window.qaafGridPageLimit = 24;
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
  };

  var origPickCh = window.pickChannelFromTopBar;
  window.pickChannelFromTopBar = function(chName, ev) {
    window.qaafChannelActiveSubTab = "videos";
    window.qaafChannelSelectedPlaylistObj = null;
    if (chName && chName !== "ALL") {
      window.fetchOfficialYouTubePlaylistsForChannel(chName, false);
    }
    if (origPickCh) origPickCh(chName, ev);
  };

  var baseFastRender = window.renderVideosNow;
  window.renderVideosNow = function() {
    var selCh = window.qaafSelectedChannel || "ALL";
    var rawSearch = (window.qaafActiveSearchQuery || "").trim();

    if (baseFastRender) baseFastRender();

    document.querySelectorAll("#videoGrid > div").forEach(function(card) {
      var chSpan = card.querySelector(".p-3 .flex.items-center.justify-between > span:first-child");
      if (chSpan && !chSpan.dataset.chClickable) {
        chSpan.dataset.chClickable = "1";
        var vidId = card.dataset.videoId;
        var vObj = (videosData || []).find(function(x) { return x.id === vidId; });
        if (vObj && vObj.channel) {
          chSpan.classList.add("hover:text-emerald-400", "hover:underline", "cursor-pointer");
          chSpan.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.pickChannelFromTopBar(vObj.channel, e);
            window.scrollTo({ top: 0, behavior: "smooth" });
          };
        }
      }
    });

    var videosSec = document.getElementById("videosSection");
    var grid = document.getElementById("videoGrid");
    var shortsShelf = document.getElementById("qaafShortsShelf");
    var loadMoreBox = document.getElementById("qaafLoadMoreBox");
    if (!videosSec || !grid) return;

    var chBanner = document.getElementById("qaafChannelViewHeaderBox");
    if (selCh === "ALL" || rawSearch) {
      if (chBanner) chBanner.classList.add("hidden");
      return;
    }

    if (!chBanner) {
      chBanner = document.createElement("div");
      chBanner.id = "qaafChannelViewHeaderBox";
      videosSec.insertBefore(chBanner, videosSec.firstChild);
    }

    var lbl = getChLabels();
    var blockedSet = new Set(blockedVideoIds || []);
    var blockedPlSet = new Set(window.qaafBlockedPlaylistIds || []);
    var chAllVids = (videosData || []).filter(function(v) {
      return v && v.channel === selCh && !blockedSet.has(v.id) && !blockedSet.has(v.ytId) && (!isKidsLocked || v.kidsSafe);
    });
    var chRegVids = chAllVids.filter(function(v) { return !isVideoShort(v); });
    var chShortVids = chAllVids.filter(function(v) { return isVideoShort(v); });

    // Clean out the accidental "New Video (0r6BcBXZvUg)" (Story of Ibrahim cartoon) from Haramain Translations
    if (Array.isArray(videosData)) {
      for (var vIdx = videosData.length - 1; vIdx >= 0; vIdx--) {
        var itemV = videosData[vIdx];
        if (!itemV) continue;
        if (itemV.ytId === "0r6BcBXZvUg" || itemV.id === "v_0r6BcBXZvUg" || /^New Video \([a-zA-Z0-9_-]{11}\)$/i.test(String(itemV.title || "").trim())) {
          if (itemV.channel === "Haramain Translations") {
            videosData.splice(vIdx, 1);
            try { localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData)); } catch (e) {}
          }
        }
      }
    }

    var combinedPlMap = new Map();
    (window.qaafRealChannelPlaylistsMap[selCh] || []).forEach(function(p) {
      if (p && p.listId && !blockedPlSet.has(p.listId)) {
        combinedPlMap.set(p.listId, Object.assign({}, p));
      }
    });

    chAllVids.forEach(function(v) {
      if (v && v.playlistId && !blockedPlSet.has(v.playlistId)) {
        if (!combinedPlMap.has(v.playlistId)) {
          combinedPlMap.set(v.playlistId, {
            listId: v.playlistId,
            title: v.playlistName || ("Playlist (" + v.playlistId.slice(0, 6) + ")"),
            thumb: "https://i.ytimg.com/vi/" + v.ytId + "/hqdefault.jpg",
            countText: ""
          });
        }
      }
    });

    if (!window.qaafPlaylistOfficialCountMap) {
      window.qaafPlaylistOfficialCountMap = JSON.parse(localStorage.getItem("qaaf_pl_official_counts_v1") || "{}");
    }

    var officialPlaylists = [];
    combinedPlMap.forEach(function(pl) {
      var matchedVids = getInstantMatchedVideosForPlaylist(pl.title, selCh, pl.listId);
      if (pl.countText && parseInt(pl.countText, 10) > 101) {
        window.qaafPlaylistOfficialCountMap[pl.listId] = parseInt(pl.countText, 10);
      }
      var knownTotal = window.qaafPlaylistOfficialCountMap[pl.listId] || 0;
      if (matchedVids.length > 0) {
        var bestCount = Math.max(matchedVids.length, knownTotal);
        pl.countText = String(bestCount);
        if (matchedVids[0] && matchedVids[0].ytId) {
          pl.thumb = "https://i.ytimg.com/vi/" + matchedVids[0].ytId + "/hqdefault.jpg";
        }
      }
      officialPlaylists.push(pl);
    });

    var plsWithLocalVids = officialPlaylists.filter(function(p) {
      return getInstantMatchedVideosForPlaylist(p.title, selCh, p.listId).length > 0;
    });
    if (plsWithLocalVids.length > 0) {
      officialPlaylists = plsWithLocalVids;
    }

    // Background Auto-Completer: Fetch remaining Surahs (101 to 114) for any playlist that only has 100/101 local videos
    if (!window.qaafAutoCompleting114Map) window.qaafAutoCompleting114Map = {};
    officialPlaylists.forEach(function(pl) {
      var localMatched = getInstantMatchedVideosForPlaylist(pl.title, selCh, pl.listId);
      var localCnt = localMatched.length;
      if ((localCnt >= 95 && localCnt <= 102) && !window.qaafAutoCompleting114Map[pl.listId]) {
        window.qaafAutoCompleting114Map[pl.listId] = true;
        setTimeout(async function() {
          try {
            var fullIds = await window.harvestAllPlaylistVideoIdsUpTo200(pl.listId);
            if (window.qaafPlaylistOfficialCountMap && window.qaafPlaylistOfficialCountMap[pl.listId]) {
              localStorage.setItem("qaaf_pl_official_counts_v1", JSON.stringify(window.qaafPlaylistOfficialCountMap));
            }
            if (fullIds.length > localCnt) {
              var existingMap = new Map();
              (videosData || []).forEach(function(v) { if (v && v.ytId) existingMap.set(v.ytId, v); });
              var missing = fullIds.filter(function(id) { return !existingMap.has(id); });
              for (var k = 0; k < missing.length; k += 15) {
                var sl = missing.slice(k, k + 15);
                var bRes = await Promise.all(sl.map(async function(ytId) {
                  try {
                    var r = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + ytId);
                    var d = await r.json();
                    if (d && d.title) {
                      return {
                        id: "v_" + ytId,
                        ytId: ytId,
                        title: d.title,
                        channel: selCh,
                        lang: "global",
                        region: "GLOBAL",
                        category: "quran",
                        audienceMode: "both_family_kids",
                        kidsSafe: true,
                        channelVerified: true,
                        playlistId: pl.listId,
                        playlistName: pl.title,
                        isShort: false,
                        isCustomAdded: true,
                        duration: "10:00",
                        views: 2500,
                        createdAt: Math.floor(Date.now() / 1000)
                      };
                    }
                  } catch (e) {}
                  return null;
                }));
                bRes.forEach(function(vo) {
                  if (vo && !existingMap.has(vo.ytId)) {
                    videosData.push(vo);
                    existingMap.set(vo.ytId, vo);
                  }
                });
              }
              var allPlVids = fullIds.map(function(id) {
                var vObj = existingMap.get(id);
                if (vObj) {
                  vObj.playlistId = pl.listId;
                  vObj.playlistName = pl.title;
                }
                return vObj;
              }).filter(Boolean);
              allPlVids = sortVideosBySurahOrPlaylistOrder(allPlVids);
              window.qaafPlaylistVideosCache[pl.listId] = allPlVids;
              pl.countText = String(allPlVids.length);
              window.qaafPlaylistOfficialCountMap[pl.listId] = allPlVids.length;
              localStorage.setItem("qaaf_pl_official_counts_v1", JSON.stringify(window.qaafPlaylistOfficialCountMap));
              localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
              window.savePlaylistsToLocalAndCloudDb();
              if (typeof window.renderVideosNow === "function") window.renderVideosNow();
              if (window.qaafCloudSync) window.qaafCloudSync.pushState("Completed 114 Surahs for " + pl.title);
            } else if (window.qaafPlaylistOfficialCountMap[pl.listId] > localCnt) {
              if (typeof window.renderVideosNow === "function") window.renderVideosNow();
            }
          } catch (e) {}
        }, 300);
      }
    });

    var isVer = (typeof window.isChannelFullyVerified === "function") && window.isChannelFullyVerified(selCh, chAllVids[0]);
    var activeTab = window.qaafChannelActiveSubTab || "videos";
    var isAdminMode = (typeof isSuperAdmin === "function" && isSuperAdmin()) && !isKidsLocked;

    // ULTRA-SLEEK YOUTUBE-STYLE COMPACT CHANNEL BAR (Takes minimal vertical space!)
    chBanner.className = "mb-2.5 bg-gradient-to-r from-[#101520] via-[#131a28] to-[#0e141f] border border-emerald-500/35 rounded-xl px-2.5 py-2 shadow-md";
    chBanner.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '<div class="flex items-center gap-2 min-w-0">' +
          '<div class="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-sm font-extrabold text-emerald-300 shrink-0">' +
            selCh.charAt(0).toUpperCase() +
          '</div>' +
          '<div class="min-w-0">' +
            '<div class="flex items-center gap-1">' +
              '<h2 class="text-xs sm:text-sm font-extrabold text-white truncate max-w-[160px] sm:max-w-[260px]">' + selCh + '</h2>' +
              (isVer ? '<span class="bg-emerald-500 text-black text-[9px] px-1 py-0.2 rounded-full font-extrabold shrink-0">✓</span>' : '') +
            '</div>' +
            '<p class="text-[10px] text-emerald-400/90 font-semibold leading-tight">' +
              chAllVids.length + ' ' + lbl.videosCount +
            '</p>' +
          '</div>' +
        '</div>' +

        '<div class="flex items-center gap-1.5 overflow-x-auto max-w-full">' +
          '<button type="button" onclick="window.switchQaafChannelSubTab(\'videos\')" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition flex items-center gap-1 cursor-pointer shrink-0 ' +
            (activeTab === "videos" ? "bg-emerald-500 text-black shadow" : "bg-black/60 hover:bg-slate-800 text-slate-300 border border-slate-800") + '">' +
            '<span>' + lbl.tabVideos + '</span>' +
            '<span class="text-[9px] px-1 py-0.2 rounded bg-black/25">' + chRegVids.length + '</span>' +
          '</button>' +
          (chShortVids.length > 0 ? (
            '<button type="button" onclick="window.switchQaafChannelSubTab(\'shorts\')" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition flex items-center gap-1 cursor-pointer shrink-0 ' +
              (activeTab === "shorts" ? "bg-emerald-500 text-black shadow" : "bg-black/60 hover:bg-slate-800 text-slate-300 border border-slate-800") + '">' +
              '<span>' + lbl.tabShorts + '</span>' +
              '<span class="text-[9px] px-1 py-0.2 rounded bg-black/25">' + chShortVids.length + '</span>' +
            '</button>'
          ) : '') +
          '<button type="button" onclick="window.switchQaafChannelSubTab(\'playlists\')" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition flex items-center gap-1 cursor-pointer shrink-0 ' +
            (activeTab === "playlists" ? "bg-emerald-500 text-black shadow" : "bg-black/60 hover:bg-slate-800 text-slate-300 border border-slate-800") + '">' +
            '<span>' + lbl.tabPlaylists + '</span>' +
            (officialPlaylists.length > 0 ? ('<span class="text-[9px] px-1 py-0.2 rounded bg-black/25">' + officialPlaylists.length + '</span>') : '') +
          '</button>' +
          ((activeTab === "playlists" && isAdminMode) ? (
            '<button type="button" id="refreshOfficialPlsBtn" class="bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-700 cursor-pointer shrink-0" title="Refresh Playlists">🔄</button>'
          ) : '') +
          '<button type="button" onclick="window.exitQaafChannelView()" class="bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold border border-slate-700 transition cursor-pointer shrink-0">' +
            lbl.backAll +
          '</button>' +
        '</div>' +
      '</div>';

    var refBtn = document.getElementById("refreshOfficialPlsBtn");
    if (refBtn) {
      refBtn.onclick = function() {
        window.fetchOfficialYouTubePlaylistsForChannel(selCh, true);
      };
    }

    chBanner.classList.remove("hidden");

    if (activeTab === "videos") {
      if (shortsShelf) shortsShelf.classList.add("hidden");
    } else if (activeTab === "shorts") {
      if (shortsShelf) shortsShelf.classList.remove("hidden");
      grid.innerHTML = "";
      if (loadMoreBox) loadMoreBox.classList.add("hidden");
    } else if (activeTab === "playlists") {
      if (shortsShelf) shortsShelf.classList.add("hidden");
      if (loadMoreBox) loadMoreBox.classList.add("hidden");
      grid.innerHTML = "";

      var activePl = window.qaafChannelSelectedPlaylistObj;
      if (activePl && activePl.listId) {
        var instantPlVids = getInstantMatchedVideosForPlaylist(activePl.title, selCh, activePl.listId).filter(function(v) {
          return v && !blockedSet.has(v.id) && !blockedSet.has(v.ytId);
        });

        var topPlBar = document.createElement("div");
        topPlBar.className = "col-span-full bg-[#131824] border border-emerald-500/40 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 mb-1.5";
        topPlBar.innerHTML =
          '<div class="flex items-center gap-2 min-w-0">' +
            '<span class="text-sm">📂</span>' +
            '<h4 class="text-xs font-extrabold text-emerald-300 truncate">' + activePl.title + (instantPlVids.length > 0 ? (' (' + instantPlVids.length + ' ' + lbl.videosCount + ')') : '') + '</h4>' +
          '</div>' +
          '<button type="button" onclick="window.switchQaafChannelSubTab(\'playlists\')" class="bg-slate-800 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-extrabold shrink-0 cursor-pointer">' +
            lbl.backPl +
          '</button>';
        grid.appendChild(topPlBar);

        if (instantPlVids.length > 0) {
          instantPlVids.forEach(function(vid) {
            grid.appendChild(createQaafVideoCardElement(vid));
          });
        } else if (isFetchingSinglePlVids) {
          var loadDiv = document.createElement("div");
          loadDiv.className = "col-span-full py-10 text-center text-emerald-400 text-xs font-extrabold animate-pulse";
          loadDiv.innerText = lbl.loadingPlVids;
          grid.appendChild(loadDiv);
        }
        return;
      }

      if (officialPlaylists.length === 0 && !isFetchingChannelPls[selCh]) {
        window.fetchOfficialYouTubePlaylistsForChannel(selCh, false);
      }

      if (isFetchingChannelPls[selCh] && officialPlaylists.length === 0) {
        grid.innerHTML = '<div class="col-span-full bg-[#131824] border border-slate-800 rounded-xl py-8 px-4 text-center text-emerald-400 text-xs font-extrabold animate-pulse">' + lbl.loadingPls + '</div>';
        return;
      }

      if (officialPlaylists.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-8 text-center text-slate-400 text-xs font-bold">' + lbl.noPlaylists + '</div>';
        return;
      }

      officialPlaylists.forEach(function(pl) {
        var card = document.createElement("div");
        card.className = "bg-[#121620] hover:bg-[#19202e] border border-white/10 hover:border-emerald-500/60 rounded-xl overflow-hidden shadow transition cursor-pointer group flex flex-col justify-between relative";
        card.onclick = function() {
          window.openQaafOfficialYouTubePlaylist(pl.listId, pl.title, selCh);
        };

        var thumbImg = pl.thumb || ((chAllVids[0] && ("https://i.ytimg.com/vi/" + chAllVids[0].ytId + "/hqdefault.jpg")) || "");
        var countBadgeText = pl.countText ? (pl.countText + " " + lbl.videosCount) : "Playlist";

        card.innerHTML =
          '<div class="relative aspect-video bg-slate-900 overflow-hidden">' +
            '<img src="' + thumbImg + '" alt="" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />' +
            '<span class="absolute bottom-1.5 right-1.5 bg-black/90 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 shadow border border-white/15">' +
              '<span>☰</span> <span>' + countBadgeText + '</span>' +
            '</span>' +
          '</div>' +
          '<div class="p-2 flex flex-col justify-between flex-1">' +
            '<div>' +
              '<h4 class="text-[11px] sm:text-xs font-extrabold text-white line-clamp-1 leading-snug group-hover:text-emerald-400 transition">' + pl.title + '</h4>' +
              '<p class="text-[10px] text-slate-400 mt-0.5 truncate">Playlist • ' + selCh + '</p>' +
            '</div>' +
            '<div class="mt-1.5 pt-1 border-t border-slate-800/80 flex items-center justify-between">' +
              '<span class="text-[10px] font-extrabold text-emerald-400 group-hover:underline">' + lbl.openPl + ' ➔</span>' +
            '</div>' +
          '</div>';

        if (isAdminMode) {
          var delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "absolute top-1.5 right-1.5 z-20 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center text-[10px] shadow border border-white/20";
          delBtn.title = "Admin: Remove this Playlist";
          delBtn.innerHTML = "🗑️";
          delBtn.onclick = function(e) {
            window.adminDeleteChannelPlaylistCard(selCh, pl.listId, e);
          };
          card.appendChild(delBtn);
        }

        grid.appendChild(card);
      });
    }
  };
})();

// =========================================================================
// SECTION 3: ADMIN CHANNEL & PLAYLIST IMPORTER + UNBAN OVERRIDE + DAILY SCANNER
// =========================================================================
(function initQaafAdminPlaylistPickerUnbanAndScanner() {
  var FIREBASE_DEFAULT_URL = "https://qaaftube-6f251-default-rtdb.firebaseio.com";
  function getFbBase() {
    return (localStorage.getItem("qaaf_firebase_db_url") || FIREBASE_DEFAULT_URL).replace(/\/+$/, "");
  }

  window.qaafAdminFetchedPlaylists = [];
  window.qaafAdminDetectedChannelTitle = "";
  window.qaafAdminImportMode = "all_channel";
  window.qaafChannelUpdatesQueue = JSON.parse(localStorage.getItem("qaaf_channel_updates_queue_v1") || "[]");
  window.qaafRejectedUpdateYtIds = JSON.parse(localStorage.getItem("qaaf_rejected_update_ytids_v1") || "[]");

  window.isStrictlyMainSuperAdmin = function() {
    var role = String(window.currentLoggedInRole || (typeof currentUserRole !== "undefined" ? currentUserRole : "") || localStorage.getItem("qaaf_user_role") || "").toLowerCase();
    if (role === "monitor" || window.isMonitorRoleActive === true) return false;
    if (role === "superadmin") return true;
    if (typeof isSuperAdmin === "function" && isSuperAdmin()) return true;
    var em = String((typeof currentUserEmail !== "undefined" ? currentUserEmail : "") || localStorage.getItem("qaaf_user_email") || "").toLowerCase();
    if (em === "qaaftube@gmail.com" || em === "adminqaaftube") return true;
    var uTab = document.getElementById("admTabBtn_users") || document.getElementById("admTab_users");
    if (uTab && uTab.style.display !== "none" && !uTab.classList.contains("hidden")) return true;
    return false;
  };

  window.superAdminCleanChannelBanRecord = function(chName, batchVidIds) {
    var normTarget = String(chName || "").trim().toLowerCase();
    if (normTarget && Array.isArray(bannedChannels)) {
      for (var i = bannedChannels.length - 1; i >= 0; i--) {
        var b = String(bannedChannels[i] || "").trim().toLowerCase();
        if (b === normTarget || b.indexOf(normTarget) !== -1 || normTarget.indexOf(b) !== -1) {
          bannedChannels.splice(i, 1);
        }
      }
      window.bannedChannels = bannedChannels;
    }
    if (Array.isArray(blockedVideoIds)) {
      var idsToUnblock = new Set();
      if (Array.isArray(batchVidIds)) {
        batchVidIds.forEach(function(id) {
          if (id) { idsToUnblock.add(String(id)); idsToUnblock.add("v_" + String(id)); }
        });
      }
      (videosData || []).forEach(function(v) {
        if (v && v.channel && String(v.channel).trim().toLowerCase() === normTarget) {
          if (v.id) idsToUnblock.add(String(v.id));
          if (v.ytId) { idsToUnblock.add(String(v.ytId)); idsToUnblock.add("v_" + String(v.ytId)); }
        }
      });
      for (var j = blockedVideoIds.length - 1; j >= 0; j--) {
        if (idsToUnblock.has(String(blockedVideoIds[j]))) blockedVideoIds.splice(j, 1);
      }
    }
    try {
      localStorage.setItem("qaaf_banned_channels", JSON.stringify(bannedChannels || []));
      localStorage.setItem("qaaf_blocked_videos", JSON.stringify(blockedVideoIds || []));
    } catch (e) {}
  };

  window.adminUnbanChannel = function(chName) {
    if (!window.isStrictlyMainSuperAdmin()) {
      alert("🔒 Access Denied: Only the Main Super Admin can unban a channel.");
      return;
    }
    window.superAdminCleanChannelBanRecord(chName, []);
    if (typeof window.renderAdminActiveVideosCatalog === "function") window.renderAdminActiveVideosCatalog();
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Unbanned Channel: " + chName);
    if (typeof showSyncToast === "function") showSyncToast("✅ Unbanned: " + chName);
  };

  function ensureAdminPlaylistSelectorUI() {
    var previewCont = document.getElementById("adminYtPreviewContainer");
    if (!previewCont) return;

    var fetchBtn = document.querySelector('button[onclick*="adminAutoFetchYouTubeInfo"]');
    if (fetchBtn && !document.getElementById("adminFetchPlaylistsBtn")) {
      var plBtn = document.createElement("button");
      plBtn.id = "adminFetchPlaylistsBtn";
      plBtn.type = "button";
      plBtn.className = "bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow shrink-0 flex items-center gap-1 transition cursor-pointer";
      plBtn.innerHTML = "<span>📂</span> <span>Fetch Playlists</span>";
      plBtn.onclick = function() { window.adminFetchChannelPlaylistsForPicker(); };
      fetchBtn.parentNode.appendChild(plBtn);
    }

    if (!document.getElementById("adminPlaylistSelectorBox")) {
      var pickerBox = document.createElement("div");
      pickerBox.id = "adminPlaylistSelectorBox";
      pickerBox.className = "hidden bg-[#0e131d] border-2 border-emerald-500/50 rounded-2xl p-3.5 space-y-3 text-xs mt-2";
      previewCont.parentNode.insertBefore(pickerBox, previewCont.nextSibling);
    }
  }

  window.setAdminChannelImportMode = function(mode) {
    window.qaafAdminImportMode = mode || "all_channel";
    renderAdminPlaylistPickerBox();
  };

  window.toggleAllAdminPlaylistChecks = function(checkVal) {
    document.querySelectorAll(".adm-pl-picker-chk").forEach(function(cb) { cb.checked = !!checkVal; });
  };

  function renderAdminPlaylistPickerBox() {
    ensureAdminPlaylistSelectorUI();
    var box = document.getElementById("adminPlaylistSelectorBox");
    if (!box) return;
    var pls = window.qaafAdminFetchedPlaylists || [];
    if (pls.length === 0) {
      box.classList.add("hidden");
      return;
    }

    var isByPl = (window.qaafAdminImportMode === "by_playlists");
    var rowsHtml = "";
    pls.forEach(function(pl, idx) {
      rowsHtml +=
        '<label class="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-black/70 hover:bg-slate-900 border border-slate-800 cursor-pointer transition">' +
          '<div class="flex items-center gap-2.5 min-w-0">' +
            '<input type="checkbox" checked data-pl-idx="' + idx + '" value="' + pl.listId + '" class="adm-pl-picker-chk accent-emerald-500 w-4 h-4 rounded cursor-pointer shrink-0" />' +
            (pl.thumb ? ('<img src="' + pl.thumb + '" alt="" class="w-12 h-7 object-cover rounded border border-white/10 shrink-0" />') : '') +
            '<span class="font-bold text-white truncate text-xs">' + pl.title + '</span>' +
          '</div>' +
          '<span class="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-extrabold shrink-0">Playlist</span>' +
        '</label>';
    });

    box.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">' +
        '<div>' +
          '<h5 class="text-xs sm:text-sm font-extrabold text-emerald-400">📂 Channel Playlists Found (' + pls.length + ' Playlists)</h5>' +
          '<p class="text-[11px] text-slate-400">Select which playlists to include or import by playlists only:</p>' +
        '</div>' +
        '<div class="flex items-center gap-1.5">' +
          '<button type="button" onclick="window.toggleAllAdminPlaylistChecks(true)" class="bg-slate-800 hover:bg-slate-700 text-emerald-300 px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer">✔ Select All</button>' +
          '<button type="button" onclick="window.toggleAllAdminPlaylistChecks(false)" class="bg-slate-800 hover:bg-slate-700 text-rose-300 px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer">✕ Unselect All</button>' +
        '</div>' +
      '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
        '<button type="button" onclick="window.setAdminChannelImportMode(\'all_channel\')" class="p-2.5 rounded-xl border text-left font-extrabold transition cursor-pointer flex items-center gap-2 ' +
          (!isByPl ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow' : 'bg-black/60 border-slate-800 text-slate-400 hover:text-white') + '">' +
          '<span>' + (!isByPl ? '🔘' : '⚪') + '</span>' +
          '<div><div class="text-xs">1. Import Full Channel</div><div class="text-[10px] font-normal opacity-80">All Channel Videos + Checked Playlists</div></div>' +
        '</button>' +
        '<button type="button" onclick="window.setAdminChannelImportMode(\'by_playlists\')" class="p-2.5 rounded-xl border text-left font-extrabold transition cursor-pointer flex items-center gap-2 ' +
          (isByPl ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow' : 'bg-black/60 border-slate-800 text-slate-400 hover:text-white') + '">' +
          '<span>' + (isByPl ? '🔘' : '⚪') + '</span>' +
          '<div><div class="text-xs">2. Import By Playlists Only</div><div class="text-[10px] font-normal opacity-80">Import ONLY Videos Inside Checked Playlists</div></div>' +
        '</button>' +
      '</div>' +
      '<div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">' + rowsHtml + '</div>' +
      '<div class="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">' +
        '<span class="text-[11px] text-amber-300 font-bold">💡 Unchecked playlists will be hidden automatically.</span>' +
        '<button type="button" onclick="window.adminImportSelectedPlaylistsNow()" class="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-lg cursor-pointer">' +
          '➕ Import Selected Playlists Live' +
        '</button>' +
      '</div>';

    box.classList.remove("hidden");
  }

  // One-time cleanup: clear accidental checkbox blocks from qaafBlockedPlaylistIds
  if (!localStorage.getItem("qaaf_v29_unblocked_playlists_fix")) {
    window.qaafBlockedPlaylistIds = [];
    localStorage.setItem("qaaf_blocked_playlist_ids", "[]");
    localStorage.setItem("qaaf_v29_unblocked_playlists_fix", "1");
  }

  async function detectChannelNameFromUrlOrVideos(rawUrl, fallbackPls) {
    var chInp = document.getElementById("adminChannelName");
    var existingVal = (chInp ? chInp.value : "").trim();
    if (existingVal && existingVal !== "Islamic Channel") return existingVal;

    if (rawUrl) {
      var lowerU = rawUrl.toLowerCase();
      if (lowerU.indexOf("haramain") !== -1) {
        if (chInp) chInp.value = "Haramain Translations";
        return "Haramain Translations";
      }
      if (lowerU.indexOf("ghamdi") !== -1) {
        var gMatch = (videosData || []).find(function(v) { return v && v.channel && v.channel.toLowerCase().indexOf("ghamdi") !== -1; });
        var gName = gMatch ? gMatch.channel : "Sheikh Saad Al Ghamdi";
        if (chInp) chInp.value = gName;
        return gName;
      }
    }

    if (Array.isArray(fallbackPls) && fallbackPls[0] && fallbackPls[0].sampleVidId) {
      try {
        var r = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + fallbackPls[0].sampleVidId);
        var d = await r.json();
        if (d && d.author_name) {
          var detected = d.author_name.trim();
          if (chInp) chInp.value = detected;
          window.qaafAdminDetectedChannelTitle = detected;
          return detected;
        }
      } catch (e) {}
    }

    return window.qaafAdminDetectedChannelTitle || "Haramain Translations";
  }

  window.adminFetchChannelPlaylistsForPicker = async function() {
    ensureAdminPlaylistSelectorUI();
    var urlInp = document.getElementById("adminYtUrlInput");
    var chInp = document.getElementById("adminChannelName");
    var rawUrl = (urlInp ? urlInp.value : "").trim();
    var chName = (chInp ? chInp.value : "").trim() || window.qaafAdminDetectedChannelTitle || "";

    if (!rawUrl && !chName) {
      alert("Please paste a YouTube Channel URL first.");
      return;
    }

    if (typeof showSyncToast === "function") {
      showSyncToast("⏳ Scanning playlists for this channel...");
    }

    var pls = await window.discoverYouTubePlaylistsForChannel(chName, rawUrl);
    window.qaafAdminFetchedPlaylists = pls;

    chName = await detectChannelNameFromUrlOrVideos(rawUrl, pls);
    if (chName && chInp && !chInp.value.trim()) {
      chInp.value = chName;
    }

    if (chName && pls.length > 0) {
      var prevPls = window.qaafRealChannelPlaylistsMap[chName] || [];
      var mergedMap = new Map();
      prevPls.forEach(function(p) { if (p && p.listId) mergedMap.set(p.listId, p); });
      pls.forEach(function(p) { if (p && p.listId) mergedMap.set(p.listId, p); });
      window.qaafRealChannelPlaylistsMap[chName] = Array.from(mergedMap.values());
      window.savePlaylistsToLocalAndCloudDb();
    }

    renderAdminPlaylistPickerBox();
    if (typeof showSyncToast === "function") {
      showSyncToast("📂 Found " + pls.length + " playlist(s) for " + (chName || "this channel") + "!");
    }
  };

  window.adminImportSelectedPlaylistsNow = async function() {
    var allPls = window.qaafAdminFetchedPlaylists || [];
    if (allPls.length === 0) return;

    var checkedIds = [];
    document.querySelectorAll(".adm-pl-picker-chk").forEach(function(cb) {
      if (cb.checked) checkedIds.push(cb.value);
    });

    if (checkedIds.length === 0) {
      alert("⚠️ Please select at least one playlist.");
      return;
    }

    var selectedPls = allPls.filter(function(p) { return checkedIds.indexOf(p.listId) !== -1; });
    var urlInp = document.getElementById("adminYtUrlInput");
    var rawUrl = (urlInp ? urlInp.value : "").trim();
    var chName = await detectChannelNameFromUrlOrVideos(rawUrl, selectedPls);

    // Make sure none of the selected playlists are in qaafBlockedPlaylistIds
    window.qaafBlockedPlaylistIds = (window.qaafBlockedPlaylistIds || []).filter(function(id) {
      return checkedIds.indexOf(id) === -1;
    });

    // MERGE selected playlists into window.qaafRealChannelPlaylistsMap[chName] (do NOT overwrite previously imported ones!)
    var existingChPls = window.qaafRealChannelPlaylistsMap[chName] || [];
    var plMergeMap = new Map();
    existingChPls.forEach(function(p) { if (p && p.listId) plMergeMap.set(p.listId, p); });
    selectedPls.forEach(function(p) { if (p && p.listId) plMergeMap.set(p.listId, p); });
    window.qaafRealChannelPlaylistsMap[chName] = Array.from(plMergeMap.values());
    window.savePlaylistsToLocalAndCloudDb();

    if (window.qaafAdminImportMode === "all_channel") {
      if (typeof window.adminAddGlobalVideo === "function") window.adminAddGlobalVideo();
      var box = document.getElementById("adminPlaylistSelectorBox");
      if (box) box.classList.add("hidden");
      return;
    }

    // Import By Playlists Only
    var lang = document.getElementById("adminVideoLang") ? document.getElementById("adminVideoLang").value : "global";
    var cat = document.getElementById("adminVideoCat") ? document.getElementById("adminVideoCat").value : "quran";
    var audEl = document.getElementById("adminVideoAudience");
    var audVal = audEl ? audEl.value : (cat === "bayan" ? "family_only" : "both_family_kids");

    if (typeof showSyncToast === "function") {
      showSyncToast("⏳ Importing videos from " + selectedPls.length + " selected playlist(s) for " + chName + "...");
    }

    var totalImportedCount = 0;
    var existingByYtId = new Map();
    (videosData || []).forEach(function(v) { if (v && v.ytId) existingByYtId.set(v.ytId, v); });

    for (var pIdx = 0; pIdx < selectedPls.length; pIdx++) {
      var plObj = selectedPls[pIdx];
      var foundVidIds = await window.harvestAllPlaylistVideoIdsUpTo200(plObj.listId);
      var capIds = foundVidIds.slice(0, 200);
      var plResolvedVids = [];
      var missingIdsToFetch = [];

      // Tag already-existing videos in videosData immediately!
      capIds.forEach(function(ytId) {
        if (existingByYtId.has(ytId)) {
          var exVid = existingByYtId.get(ytId);
          exVid.channel = chName;
          exVid.playlistId = plObj.listId;
          exVid.playlistName = plObj.title;
          exVid.channelVerified = true;
          plResolvedVids.push(exVid);
          totalImportedCount++;
        } else {
          missingIdsToFetch.push(ytId);
        }
      });

      var CHUNK = 20;
      for (var c = 0; c < missingIdsToFetch.length; c += CHUNK) {
        var slice = missingIdsToFetch.slice(c, c + CHUNK);
        var batch = await Promise.all(slice.map(async function(ytId) {
          try {
            var r = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + ytId);
            var info = await r.json();
            if (info && info.title) {
              return {
                id: "v_" + ytId,
                ytId: ytId,
                title: info.title,
                channel: chName,
                lang: lang,
                region: lang.toUpperCase(),
                category: cat,
                audienceMode: audVal,
                kidsSafe: (audVal !== "family_only"),
                channelVerified: true,
                playlistId: plObj.listId,
                playlistName: plObj.title,
                isShort: /#short/i.test(info.title),
                isCustomAdded: true,
                duration: "10:00",
                views: 2500,
                createdAt: Math.floor(Date.now() / 1000)
              };
            }
          } catch (e) {}
          return null;
        }));
        batch.forEach(function(vItem) {
          if (vItem) {
            plResolvedVids.push(vItem);
            if (!existingByYtId.has(vItem.ytId)) {
              videosData.unshift(vItem);
              existingByYtId.set(vItem.ytId, vItem);
              totalImportedCount++;
            }
          }
        });
      }

      if (plResolvedVids.length > 0) {
        window.qaafPlaylistVideosCache[plObj.listId] = plResolvedVids;
      }
    }

    if (window.verifiedChannelsList && window.verifiedChannelsList.indexOf(chName) === -1) {
      window.verifiedChannelsList.push(chName);
      localStorage.setItem("qaaf_verified_channels", JSON.stringify(window.verifiedChannelsList));
    }

    localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    window.savePlaylistsToLocalAndCloudDb();

    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    if (typeof window.renderAdminActiveVideosCatalog === "function") window.renderAdminActiveVideosCatalog();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Imported Selected Playlists: " + chName);
    if (typeof showSyncToast === "function") {
      showSyncToast("🎉 Linked & Imported " + totalImportedCount + " videos across " + selectedPls.length + " playlist(s) in " + chName + "!");
    }
  };

  // Store all 150 discovered channel video IDs during Auto-Fetch and guarantee full batch import on "+ Push Live"
  window.qaafLastFetchedChannelVideoIds = [];
  window.qaafLastFetchedChannelUrl = "";

  async function harvestUpTo150ChannelVideoIds(rawChannelUrl) {
    var base = String(rawChannelUrl || "").trim().replace(/\/(videos|shorts|featured|streams|playlists)?\/?$/, "");
    if (!base) return [];
    var ids = [];
    function collectIds(txt) {
      if (!txt) return;
      var m = txt.matchAll(/(?:watch\?v=|\/shorts\/|"videoId"\s*:\s*"|\/vi\/)([a-zA-Z0-9_-]{11})/g);
      for (var x of m) {
        if (ids.indexOf(x[1]) === -1) ids.push(x[1]);
        if (ids.length >= 150) break;
      }
    }
    try {
      var r1 = await fetch("https://r.jina.ai/" + base + "/videos");
      if (r1.ok) collectIds(await r1.text());
    } catch (e) {}
    if (ids.length < 25) {
      try {
        var r2 = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(base + "/videos?ucbcb=1&hl=en"));
        if (r2.ok) collectIds(await r2.text());
      } catch (e) {}
    }
    if (ids.length < 25) {
      try {
        var r3 = await fetch("https://r.jina.ai/" + base);
        if (r3.ok) collectIds(await r3.text());
      } catch (e) {}
    }
    return ids.slice(0, 150);
  }

  var baseAutoFetch = window.adminAutoFetchYouTubeInfo;
  window.adminAutoFetchYouTubeInfo = async function() {
    ensureAdminPlaylistSelectorUI();
    var urlInp = document.getElementById("adminYtUrlInput");
    var raw = (urlInp ? urlInp.value : "").trim();
    var isChannelUrl = raw && (raw.indexOf("/@") !== -1 || raw.indexOf("@") === 0 || raw.indexOf("/channel/") !== -1 || raw.indexOf("/c/") !== -1 || raw.indexOf("/user/") !== -1);

    if (baseAutoFetch) {
      await baseAutoFetch();
    }

    if (isChannelUrl) {
      window.qaafLastFetchedChannelUrl = raw;
      harvestUpTo150ChannelVideoIds(raw).then(function(foundIds) {
        if (foundIds && foundIds.length > 0) {
          window.qaafLastFetchedChannelVideoIds = foundIds;
        }
      });
      setTimeout(function() {
        window.adminFetchChannelPlaylistsForPicker();
      }, 300);
    } else {
      window.qaafLastFetchedChannelVideoIds = [];
    }
  };

  var origAdminAddGlobalVideo = window.adminAddGlobalVideo;
  window.adminAddGlobalVideo = async function() {
    var chInp = document.getElementById("adminChannelName");
    var titleInp = document.getElementById("adminVideoTitle");
    var urlInp = document.getElementById("adminYtUrlInput");
    var chName = (chInp ? chInp.value : "").trim() || (window.adminPendingBatchChannel ? window.adminPendingBatchChannel.channelTitle : "") || "";
    var rawTitle = (titleInp ? titleInp.value : "").trim();
    var rawUrl = (urlInp ? urlInp.value : "").trim();
    var lang = document.getElementById("adminVideoLang") ? document.getElementById("adminVideoLang").value : "global";
    var cat = document.getElementById("adminVideoCat") ? document.getElementById("adminVideoCat").value : "quran";
    var audEl = document.getElementById("adminVideoAudience");
    var audVal = audEl ? audEl.value : (cat === "bayan" ? "family_only" : "both_family_kids");

    var isChannelPack = rawTitle.indexOf("[Channel Pack:") !== -1 || (rawUrl && (rawUrl.indexOf("/@") !== -1 || rawUrl.indexOf("@") === 0 || rawUrl.indexOf("/channel/") !== -1));
    var countBefore = (videosData || []).filter(function(v) { return v && v.channel === chName; }).length;

    var tempSavedBans = null;
    if (window.isStrictlyMainSuperAdmin() && Array.isArray(bannedChannels)) {
      window.superAdminCleanChannelBanRecord(chName, []);
      tempSavedBans = bannedChannels.filter(Boolean);
      bannedChannels.length = 0;
    }

    if (origAdminAddGlobalVideo) {
      await origAdminAddGlobalVideo();
    }

    if (tempSavedBans !== null && Array.isArray(bannedChannels)) {
      var lowerTarget = String(chName || "").trim().toLowerCase();
      tempSavedBans.forEach(function(bItem) {
        var lb = String(bItem || "").trim().toLowerCase();
        if (lb && lb !== lowerTarget && bannedChannels.indexOf(bItem) === -1) {
          bannedChannels.push(bItem);
        }
      });
    }

    // Check if qaaf-admin.js only added 1 video for a full Channel Pack! If so, import all 150 videos now!
    setTimeout(async function() {
      var countAfter = (videosData || []).filter(function(v) { return v && v.channel === chName; }).length;
      if (isChannelPack && chName && (countAfter - countBefore) <= 2) {
        var batchIds = (window.qaafLastFetchedChannelVideoIds && window.qaafLastFetchedChannelVideoIds.length > 1)
          ? window.qaafLastFetchedChannelVideoIds
          : await harvestUpTo150ChannelVideoIds(rawUrl || window.qaafLastFetchedChannelUrl);

        if (batchIds && batchIds.length > 1) {
          if (typeof showSyncToast === "function") {
            showSyncToast("⏳ Importing all " + batchIds.length + " videos for " + chName + "...");
          }
          var existingYtIds = new Set((videosData || []).map(function(v) { return v && v.ytId; }).filter(Boolean));
          var missingIds = batchIds.filter(function(id) { return !existingYtIds.has(id); });
          var addedNow = 0;
          var CHUNK = 20;
          for (var i = 0; i < missingIds.length; i += CHUNK) {
            var slice = missingIds.slice(i, i + CHUNK);
            var resolved = await Promise.all(slice.map(async function(ytId, idx) {
              try {
                var r = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + ytId);
                var d = await r.json();
                if (d && d.title) {
                  return {
                    id: "v_" + ytId,
                    ytId: ytId,
                    title: d.title.replace(/^\[Channel Pack:\s*\d+\s*Videos\]\s*/i, ""),
                    channel: chName,
                    lang: lang,
                    region: lang.toUpperCase(),
                    category: cat,
                    audienceMode: audVal,
                    kidsSafe: (audVal !== "family_only"),
                    channelVerified: true,
                    isShort: /#short/i.test(d.title),
                    isCustomAdded: true,
                    duration: "12:00",
                    views: 1500,
                    createdAt: Math.floor(Date.now() / 1000) - (i + idx)
                  };
                }
              } catch (e) {}
              return null;
            }));
            resolved.forEach(function(vObj) {
              if (vObj && !videosData.some(function(x) { return x.ytId === vObj.ytId; })) {
                videosData.unshift(vObj);
                addedNow++;
              }
            });
          }

          // Also clean "[Channel Pack: 150 Videos]" prefix from the first video if present
          (videosData || []).forEach(function(v) {
            if (v && v.channel === chName && typeof v.title === "string") {
              v.title = v.title.replace(/^\[Channel Pack:\s*\d+\s*Videos\]\s*/i, "");
              v.channelVerified = true;
            }
          });

          if (window.verifiedChannelsList && window.verifiedChannelsList.indexOf(chName) === -1) {
            window.verifiedChannelsList.push(chName);
            localStorage.setItem("qaaf_verified_channels", JSON.stringify(window.verifiedChannelsList));
          }

          localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
          if (typeof window.renderVideosNow === "function") window.renderVideosNow();
          if (typeof window.renderAdminActiveVideosCatalog === "function") window.renderAdminActiveVideosCatalog();
          if (window.qaafCloudSync) window.qaafCloudSync.pushState("Imported Full Channel Pack (" + (addedNow + 1) + " videos): " + chName);
          if (typeof showSyncToast === "function") {
            showSyncToast("✅ Full Channel Imported: " + chName + " (" + (countAfter + addedNow) + " videos)!");
          }
        }
      }
    }, 600);
  };

  var prevOpenAdm2 = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevOpenAdm2) prevOpenAdm2();
    ensureAdminPlaylistSelectorUI();
  };

  setTimeout(ensureAdminPlaylistSelectorUI, 1000);
})();

// =========================================================================
// SECTION 4: ULTRA-SLEEK COMPACT GAMES ZONE (NO SYNTAX ERRORS,SINGLE-LINE CSS)
// =========================================================================
(function initQaafSleekGamesZoneAndRealQuranicGames() {
  window.activeGamesSubTab = "qaaf_games";

    if (false && !document.getElementById("qaafSmartCompactGridCss")) {
    var cgStyle = document.createElement("style");
    cgStyle.id = "qaafSmartCompactGridCss";
    cgStyle.textContent = [
      "#videoGrid { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 0.5rem !important; }",
      "@media (min-width: 640px) { #videoGrid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 0.65rem !important; } }",
      "@media (min-width: 900px) { #videoGrid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 0.75rem !important; } }",
      "@media (min-width: 1200px) { #videoGrid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; gap: 0.75rem !important; } }",
      "#videoGrid > div .p-3 { padding: 0.45rem 0.55rem !important; }",
      "#videoGrid > div h3, #videoGrid > div h4 { font-size: 0.74rem !important; line-height: 1.25 !important; }",
      "#qaafTopSearchAndBellBar, #qaafCombinedSearchRequestRow { display: flex !important; flex-wrap: nowrap !important; align-items: center !important; gap: 0.4rem !important; margin-bottom: 0.45rem !important; }",
      "#qaafTopSearchAndBellBar > div:first-child, #qaafCombinedSearchRequestRow > div:first-child { flex: 1 1 auto !important; min-width: 0 !important; }"
    ].join("\n");
    document.head.appendChild(cgStyle);
  }

  if (!document.getElementById("qaafGamesModeStrictCss")) {
    var st = document.createElement("style");
    st.id = "qaafGamesModeStrictCss";
    st.textContent = [
      "body.qaaf-games-mode-active #categoryBar,",
      "body.qaaf-games-mode-active #qaafTopSearchAndBellBar,",
      "body.qaaf-games-mode-active #qaafCombinedSearchRequestRow,",
      "body.qaaf-games-mode-active #videosSection { display: none !important; }",
      "body.qaaf-games-mode-active #tabGamesBtn, body.qaaf-games-mode-active #kidsContentSwitcher button:last-child { background-color: #e11d48 !important; background-image: none !important; color: #ffffff !important; box-shadow: 0 2px 10px rgba(225,29,72,0.45) !important; }",
      "body.qaaf-games-mode-active #tabVideosBtn, body.qaaf-games-mode-active #kidsContentSwitcher button:first-child { background-color: transparent !important; background-image: none !important; color: #94a3b8 !important; box-shadow: none !important; }"
    ].join("\n");
    document.head.appendChild(st);
  }

  var REAL_GAMES_CATALOG = [
    {
      id: "qaaf_games_main_hub",
      mainCat: "qaaf_2d",
      title: "QAAF Games",
      icon: "\ud83c\udfae",
      path: "qaaf-games/qaaf-games.html?v=64.0"
    },
    {
      id: "quran_game_01_birr",
      mainCat: "qaaf_quran",
      title: "1. Ayat al-Birr — Surah Al-Baqarah (177)",
      icon: "\ud83d\udcd6",
      path: "Qaaf quran Games/index.html"
    },
    {
      id: "quran_game_02_muminun",
      mainCat: "qaaf_quran",
      title: "2. Sifat al-Muminun — Surah Al-Mu'minun (1-11)",
      icon: "\ud83c\udf1f",
      path: "Qaaf quran Games/game-02-sifat-al-muminun.html"
    },
    {
      id: "quran_game_03_asr",
      mainCat: "qaaf_quran",
      title: "3. Surah Al-Asr — Interactive Tafsir & Quiz",
      icon: "\u23f3",
      path: "Qaaf quran Games/game-03-surah-al-asr.html"
    },
    {
      id: "game_3d_01_desk_racer",
      mainCat: "qaaf_3d",
      title: "1. Desk Racer Pro",
      icon: "\ud83c\udfce\ufe0f",
      path: "https://pub-5241f011e0704a3799e1dda07aca985d.r2.dev/desk-racer-pro/desk_racer_pro.html"
    }
  ];

  window.REAL_GAMES_CATALOG = REAL_GAMES_CATALOG;
  window.activeMainGameCat = "";

  window.selectMainGameCategory = function(catId) {
    if (catId === "qaaf_2d") {
      /* Directly open the QAAF Games Hub where the 5 games are already listed! */
      window.openInstalledGameModal("qaaf_games_main_hub");
      return;
    }
    window.activeMainGameCat = (window.activeMainGameCat === catId) ? "" : catId;
    window.renderGames();
  };

  window.switchKidsTab = function(tab) {
    var vSec = document.getElementById("videosSection");
    var gSec = document.getElementById("gamesSection");
    var catBar = document.getElementById("categoryBar");
    var chHeader = document.getElementById("qaafChannelViewHeaderBox");
    var bV = document.getElementById("tabVideosBtn");
    var bG = document.getElementById("tabGamesBtn");

    if (tab === "games") {
      document.body.classList.add("qaaf-games-mode-active");
      if (vSec) vSec.classList.add("hidden");
      if (catBar) catBar.classList.add("hidden");
      if (chHeader) chHeader.classList.add("hidden");
      if (gSec) gSec.classList.remove("hidden");
      if (bG) bG.className = "px-3.5 py-1 rounded-full text-xs font-bold transition bg-[#164e3a] text-white shadow cursor-pointer flex items-center gap-1";
      if (bV) bV.className = "px-3.5 py-1 rounded-full text-xs font-bold transition text-slate-300 hover:text-white cursor-pointer flex items-center gap-1";
      window.activeMainGameCat = "";
      if (typeof window.renderGames === "function") window.renderGames();
    } else {
      document.body.classList.remove("qaaf-games-mode-active");
      if (gSec) gSec.classList.add("hidden");
      if (vSec) vSec.classList.remove("hidden");
      if (catBar) catBar.classList.remove("hidden");
      if (bV) bV.className = "px-3.5 py-1 rounded-full text-xs font-bold transition bg-emerald-500 text-black shadow cursor-pointer flex items-center gap-1";
      if (bG) bG.className = "px-3.5 py-1 rounded-full text-xs font-bold transition text-slate-300 hover:text-white cursor-pointer flex items-center gap-1";
    }
  };

  window.renderGames = function() {
    var grid = document.getElementById("gamesGrid");
    if (!grid) return;

    var headEl = document.getElementById("qaafSimpleGamesHeading");
    if (headEl) {
      headEl.innerHTML = '<span class="text-xl">\ud83c\udfae</span> <span>QAAF Kids Islamic Games Zone</span>';
    }

    var activeCat = window.activeMainGameCat || "";

    var catTabsHtml =
      '<div class="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">' +
        /* Category 1: QAAF Games (Opens qaaf-games.html directly on click!) */
        '<button type="button" onclick="window.selectMainGameCategory(\'qaaf_2d\')" class="flex items-center justify-between px-4 py-4 rounded-2xl border-2 border-emerald-500/50 bg-[#0d1f1a] hover:bg-[#16382b] text-white transition cursor-pointer text-left shadow-lg">' +
          '<div class="flex items-center gap-3 min-w-0">' +
            '<span class="text-2xl shrink-0">\ud83c\udfae</span>' +
            '<div class="min-w-0">' +
              '<div class="text-sm sm:text-base font-extrabold truncate">1. QAAF Games</div>' +
              '<div class="text-[11px] text-slate-400 truncate">Simple Puzzles, Quiz &amp; Builder</div>' +
            '</div>' +
          '</div>' +
          '<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">5 Games &#9654;</span>' +
        '</button>' +

        /* Category 2: QAAF Quranic Games */
        '<button type="button" onclick="window.selectMainGameCategory(\'qaaf_quran\')" class="flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition cursor-pointer text-left ' +
          (activeCat === "qaaf_quran"
            ? "bg-amber-950/60 border-amber-400 text-white shadow-lg"
            : "bg-[#111622] border-slate-800 hover:border-amber-500/50 text-slate-300") + '">' +
          '<div class="flex items-center gap-3 min-w-0">' +
            '<span class="text-2xl shrink-0">\ud83d\udcd6</span>' +
            '<div class="min-w-0">' +
              '<div class="text-sm sm:text-base font-extrabold truncate">2. QAAF Quranic Games</div>' +
              '<div class="text-[11px] text-slate-400 truncate">Ayah-by-Ayah Interactive Games</div>' +
            '</div>' +
          '</div>' +
          '<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">3 Games &#9662;</span>' +
        '</button>' +

        /* Category 3: QAAF 3D Games */
        '<button type="button" onclick="window.selectMainGameCategory(\'qaaf_3d\')" class="flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition cursor-pointer text-left ' +
          (activeCat === "qaaf_3d"
            ? "bg-sky-950/60 border-sky-400 text-white shadow-lg"
            : "bg-[#111622] border-slate-800 hover:border-sky-500/50 text-slate-300") + '">' +
          '<div class="flex items-center gap-3 min-w-0">' +
            '<span class="text-2xl shrink-0">\ud83c\udfce\ufe0f</span>' +
            '<div class="min-w-0">' +
              '<div class="text-sm sm:text-base font-extrabold truncate">3. QAAF 3D Games</div>' +
              '<div class="text-[11px] text-slate-400 truncate">3D Adventures for Older Kids</div>' +
            '</div>' +
          '</div>' +
          '<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0">1 Game &#9662;</span>' +
        '</button>' +
      '</div>';

    var listHtml = "";
    if (activeCat === "qaaf_quran" || activeCat === "qaaf_3d") {
      var disabledMap = {};
      try {
        disabledMap = JSON.parse(localStorage.getItem("qaaf_disabled_games_map") || "{}") || {};
      } catch (e) {}

      var visibleGames = REAL_GAMES_CATALOG.filter(function(g) {
        return g.mainCat === activeCat && !disabledMap[g.id];
      });

      listHtml = '<div class="col-span-full flex flex-col gap-2.5 mt-1">' +
        visibleGames.map(function(g) {
          return (
            '<div onclick="window.openInstalledGameModal(\'' + g.id + '\')" ' +
              'class="w-full bg-[#121824] hover:bg-[#182232] border border-slate-700/80 hover:border-amber-400 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 transition cursor-pointer shadow-md group">' +
              '<div class="flex items-center gap-3 min-w-0">' +
                '<span class="w-9 h-9 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-lg shrink-0">' + g.icon + '</span>' +
                '<span class="text-sm sm:text-base font-extrabold text-white group-hover:text-amber-300 transition truncate">' + g.title + '</span>' +
              '</div>' +
              '<span class="w-8 h-8 rounded-full bg-amber-500/20 group-hover:bg-amber-500 text-amber-300 group-hover:text-black flex items-center justify-center text-xs font-extrabold transition shrink-0">&#9654;</span>' +
            '</div>'
          );
        }).join("") +
      '</div>';
    }

    grid.className = "flex flex-col gap-2";
    grid.innerHTML = catTabsHtml + listHtml;
  };

  window.openInstalledGameModal = function(gameId) {
    var game = REAL_GAMES_CATALOG.find(function(g) { return g.id === gameId; });
    if (!game) return;

    var activeLang = window.preferredContentLang || localStorage.getItem("qaaf_preferred_content_lang") || "ur";
    var gLang = (activeLang === "ar" || activeLang === "en") ? activeLang : "ur";
    var rawUrl = game.launchUrl || game.path || "qaaf-games/qaaf-games.html";
    var sep = rawUrl.indexOf("?") === -1 ? "?" : "&";
    var targetSrc = rawUrl + sep + "lang=" + encodeURIComponent(gLang) + "&v=" + Date.now();

    var modal = document.getElementById("qaafActiveGamePlayModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "qaafActiveGamePlayModal";
      modal.className = "fixed inset-0 z-[250] bg-[#080a0f] flex flex-col hidden";
      modal.innerHTML =
        '<div class="h-11 bg-[#11151e] border-b border-emerald-500/30 px-3 sm:px-5 flex items-center justify-between shrink-0">' +
          '<div class="flex items-center gap-2 min-w-0">' +
            '<span id="activeGameModalIcon" class="text-base">🎮</span>' +
            '<h3 id="activeGameModalTitle" class="text-xs sm:text-sm font-extrabold text-white truncate">QAAF Islamic Game</h3>' +
          '</div>' +
          '<button type="button" onclick="closeInstalledGameModal()" class="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded-full text-xs font-extrabold shadow cursor-pointer">' +
            '⬅️ Back to Games' +
          '</button>' +
        '</div>' +
        '<iframe id="activeGameModalIframe" class="w-full flex-1 border-0 bg-[#080a0f]" allow="autoplay; fullscreen"></iframe>';
      document.body.appendChild(modal);
    }

    var iconEl = document.getElementById("activeGameModalIcon");
    var titleEl = document.getElementById("activeGameModalTitle");
    var frameEl = document.getElementById("activeGameModalIframe");

    if (iconEl) iconEl.innerText = game.icon || "🎮";
    if (titleEl) titleEl.innerText = game.title;
    if (frameEl) frameEl.src = targetSrc;
    modal.classList.remove("hidden");
  };

  window.closeInstalledGameModal = function() {
    var modal = document.getElementById("qaafActiveGamePlayModal");
    var frameEl = document.getElementById("activeGameModalIframe");
    if (frameEl) frameEl.src = "about:blank";
    if (modal) modal.classList.add("hidden");
  };

  window.renderGames();
})();

// =========================================================================
// SECTION 5: ADMIN SPECIAL ANNOUNCEMENT / GREETING POPUP ENGINE (LIVE CLOUD)
// =========================================================================
(function initQaafSpecialAnnouncementEngine() {
  var FIREBASE_DEFAULT_URL = "https://qaaftube-6f251-default-rtdb.firebaseio.com";
  function getFbBase() {
    return (localStorage.getItem("qaaf_firebase_db_url") || FIREBASE_DEFAULT_URL).replace(/\/+$/, "");
  }

  var DEFAULT_ANNOUNCEMENT = {
    enabled: false,
    badge: "🌙 QAAF Tube Special Message",
    title: "جمعہ مبارک — Jummah Mubarak!",
    message: "رسول اللہ ﷺ نے فرمایا: جمعہ کے دن مجھ پر کثرت سے درود بھیجا کرو۔ آج سورۃ الکہف کی تلاوت اور درود شریف کا خاص اہتمام فرمائیں۔",
    theme: "emerald",
    imageUrl: "",
    actionText: "",
    actionUrl: "",
    frequency: "once_per_session",
    updatedAt: 0
  };

  window.qaafSpecialAnnouncement = Object.assign({}, DEFAULT_ANNOUNCEMENT);
  try {
    var savedLocal = localStorage.getItem("qaaf_special_announcement_v1");
    if (savedLocal) {
      window.qaafSpecialAnnouncement = Object.assign({}, DEFAULT_ANNOUNCEMENT, JSON.parse(savedLocal));
    }
  } catch (e) {}

  var QUICK_TEMPLATES = {
    jummah: {
      badge: "🕌 جمعہ مبارک • Jummah Mubarak",
      title: "جمعہ کا بابرکت دن مبارک ہو!",
      message: "رسول اللہ ﷺ نے فرمایا: جمعہ کے دن مجھ پر کثرت سے درود شریف بھیجا کرو۔ آج سورۃ الکہف کی تلاوت، دعاؤں اور درود شریف کا خاص اہتمام فرمائیں۔",
      theme: "emerald",
      actionText: "",
      actionUrl: ""
    },
    eid: {
      badge: "🎉 عید مبارک • Eid Mubarak",
      title: "قاف ٹیوب کی جانب سے دلی عید مبارک!",
      message: "تَقَبَّلَ اللّٰهُ مِنَّا وَمِنْكُمْ — اللہ تعالیٰ ہماری اور آپ کی تمام عبادات اور نیک اعمال قبول فرمائے۔ آپ کو اور آپ کے پورے خاندان کو دل کی گہرائیوں سے عید مبارک!",
      theme: "amber",
      actionText: "",
      actionUrl: ""
    },
    ramadan: {
      badge: "🌙 رمضان مبارک • Ramadan Kareem",
      title: "رمضان المبارک کا بابرکت مہینہ مبارک ہو!",
      message: "اللہ تعالیٰ اس بابرکت مہینے میں ہمارے روزے، نمازیں اور تلاوتِ قرآن قبول فرمائے اور ہمیں کامل تقویٰ نصیب فرمائے۔ آمین۔",
      theme: "teal",
      actionText: "",
      actionUrl: ""
    },
    support: {
      badge: "🤝 صدقہ جاریہ • Support QAAF Tube",
      title: "محفوظ اسلامی پلیٹ فارم میں ہمارا ساتھ دیں",
      message: "قاف ٹیوب مسلمان بچوں اور خاندانوں کے لیے سو فیصد موسیقی، ساز اور غیر شرعی اشتہارات سے پاک اسلامی پلیٹ فارم ہے۔ اس صدقہ جاریہ کو مزید بہتر بنانے اور پھیلانے میں ہمارے ساتھ تعاون فرمائیں۔",
      theme: "emerald",
      actionText: "📩 Contact: contactqaaftube@gmail.com",
      actionUrl: "mailto:contactqaaftube@gmail.com"
    },
    update: {
      badge: "✨ نیا فیچر • New QAAF Update",
      title: "الحمد للہ! نئے قرآنی گیمز اور پلے لسٹس شامل کر دی گئیں",
      message: "اب آپ قاف ٹیوب پر حرمین شریفین کے قاریوں کی مکمل ۱۱۴ سورتوں کی پلے لسٹس سن سکتے ہیں اور بچوں کے موڈ میں نئے قرآنی آیات والے گیمز کھیل سکتے ہیں!",
      theme: "blue",
      actionText: "",
      actionUrl: ""
    }
  };

  window.applyAdminAnnouncementTemplate = function(tplKey) {
    var tpl = QUICK_TEMPLATES[tplKey];
    if (!tpl) return;
    var bEl = document.getElementById("admAnnounceBadge");
    var tEl = document.getElementById("admAnnounceTitle");
    var mEl = document.getElementById("admAnnounceMessage");
    var thEl = document.getElementById("admAnnounceTheme");
    var atEl = document.getElementById("admAnnounceActionText");
    var auEl = document.getElementById("admAnnounceActionUrl");

    if (bEl) bEl.value = tpl.badge;
    if (tEl) tEl.value = tpl.title;
    if (mEl) mEl.value = tpl.message;
    if (thEl) thEl.value = tpl.theme;
    if (atEl) atEl.value = tpl.actionText || "";
    if (auEl) auEl.value = tpl.actionUrl || "";
  };

  function populateAdminAnnouncementInputs() {
    var cfg = window.qaafSpecialAnnouncement || DEFAULT_ANNOUNCEMENT;
    var enEl = document.getElementById("admAnnounceEnabled");
    var bEl = document.getElementById("admAnnounceBadge");
    var tEl = document.getElementById("admAnnounceTitle");
    var mEl = document.getElementById("admAnnounceMessage");
    var thEl = document.getElementById("admAnnounceTheme");
    var frEl = document.getElementById("admAnnounceFreq");
    var imgEl = document.getElementById("admAnnounceImage");
    var atEl = document.getElementById("admAnnounceActionText");
    var auEl = document.getElementById("admAnnounceActionUrl");
    var stBadge = document.getElementById("admAnnounceStatusBadge");

    if (enEl) enEl.checked = !!cfg.enabled;
    if (bEl) bEl.value = cfg.badge || "";
    if (tEl) tEl.value = cfg.title || "";
    if (mEl) mEl.value = cfg.message || "";
    if (thEl) thEl.value = cfg.theme || "emerald";
    if (frEl) frEl.value = cfg.frequency || "once_per_session";
    if (imgEl) imgEl.value = cfg.imageUrl || "";
    if (atEl) atEl.value = cfg.actionText || "";
    if (auEl) auEl.value = cfg.actionUrl || "";
    if (stBadge) {
      stBadge.className = cfg.enabled
        ? "px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500 text-black shadow"
        : "px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-800 text-slate-400 border border-slate-700";
      stBadge.innerText = cfg.enabled ? "🟢 LIVE ON WEBSITE" : "⚪ CURRENTLY OFF";
    }
  }

  function injectAdminAnnouncementControlBox() {
    var existingBox = document.getElementById("admSpecialAnnouncementBox");
    if (existingBox) {
      populateAdminAnnouncementInputs();
      return;
    }
    var sponsorPane = document.getElementById("admPane_sponsor") || document.getElementById("admPane_sponsors") || document.getElementById("admPane_ads");
    if (!sponsorPane) {
      document.querySelectorAll("h3, h4").forEach(function(h) {
        if ((h.innerText || "").indexOf("Regional Sponsor") !== -1 && h.parentElement && h.parentElement.parentElement) {
          sponsorPane = h.parentElement.parentElement;
        }
      });
    }
    if (!sponsorPane) return;

    var box = document.createElement("div");
    box.id = "admSpecialAnnouncementBox";
    box.className = "bg-gradient-to-br from-[#0f1722] via-[#111927] to-[#0d131d] border-2 border-emerald-500/40 rounded-2xl p-4 space-y-3.5 text-xs mb-4 shadow-xl";
    box.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">' +
        '<div>' +
          '<h4 class="text-sm font-extrabold text-emerald-300 flex items-center gap-2">' +
            '<span>📢</span> <span>Special Popup Announcement &amp; Greeting Card (جمعہ / عید / تعاون کا پیغام)</span>' +
          '</h4>' +
          '<p class="text-[11px] text-slate-400 mt-0.5">Show a beautiful Islamic popup message for Eid, Jummah, Ramadan, or Support when users open QAAF Tube.</p>' +
        '</div>' +
        '<div class="flex items-center gap-2.5">' +
          '<span id="admAnnounceStatusBadge" class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-800 text-slate-400">⚪ CURRENTLY OFF</span>' +
          '<label class="flex items-center gap-2 bg-black/60 border border-emerald-500/40 px-3 py-1.5 rounded-xl cursor-pointer font-extrabold text-white">' +
            '<input id="admAnnounceEnabled" type="checkbox" class="accent-emerald-500 w-4 h-4 rounded cursor-pointer" onchange="window.saveAdminSpecialAnnouncement(false)" />' +
            '<span>Enable Popup</span>' +
          '</label>' +
        '</div>' +
      '</div>' +

      '<div class="space-y-1.5">' +
        '<div class="text-[11px] font-extrabold text-amber-300">⚡ 1-Click Ready Templates (تیار شدہ پیغامات):</div>' +
        '<div class="flex flex-wrap items-center gap-1.5">' +
          '<button type="button" onclick="window.applyAdminAnnouncementTemplate(\'jummah\')" class="bg-emerald-950/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/40 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition">🕌 جمعہ مبارک</button>' +
          '<button type="button" onclick="window.applyAdminAnnouncementTemplate(\'eid\')" class="bg-amber-950/80 hover:bg-amber-800 text-amber-200 border border-amber-500/40 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition">🎉 عید مبارک</button>' +
          '<button type="button" onclick="window.applyAdminAnnouncementTemplate(\'ramadan\')" class="bg-teal-950/80 hover:bg-teal-800 text-teal-200 border border-teal-500/40 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition">🌙 رمضان مبارک</button>' +
          '<button type="button" onclick="window.applyAdminAnnouncementTemplate(\'support\')" class="bg-blue-950/80 hover:bg-blue-800 text-blue-200 border border-blue-500/40 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition">🤝 تعاون / صدقہ جاریہ</button>' +
          '<button type="button" onclick="window.applyAdminAnnouncementTemplate(\'update\')" class="bg-purple-950/80 hover:bg-purple-800 text-purple-200 border border-purple-500/40 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition">✨ نیا اعلان</button>' +
        '</div>' +
      '</div>' +

      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">' +
        '<div>' +
          '<label class="block text-[10px] font-bold text-slate-400 mb-1">Top Badge Text</label>' +
          '<input id="admAnnounceBadge" type="text" placeholder="🌙 QAAF Tube Special Message" class="w-full bg-black/70 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold" />' +
        '</div>' +
        '<div>' +
          '<label class="block text-[10px] font-bold text-slate-400 mb-1">Color Theme</label>' +
          '<select id="admAnnounceTheme" class="w-full bg-black/70 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold">' +
            '<option value="emerald">🟢 Islamic Emerald Green</option>' +
            '<option value="amber">🟡 Festive Golden / Eid</option>' +
            '<option value="teal">🩵 Royal Teal / Ramadan</option>' +
            '<option value="blue">🔵 Night Sapphire Blue</option>' +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label class="block text-[10px] font-bold text-slate-400 mb-1">When to Show</label>' +
          '<select id="admAnnounceFreq" class="w-full bg-black/70 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold">' +
            '<option value="once_per_session">Once Per Visit (Recommended)</option>' +
            '<option value="once_per_day">Once Per Day</option>' +
            '<option value="always_on_load">Every Page Refresh</option>' +
          '</select>' +
        '</div>' +
      '</div>' +

      '<div>' +
        '<label class="block text-[10px] font-bold text-slate-400 mb-1">Main Heading / Title (اردو / عربی / English)</label>' +
        '<input id="admAnnounceTitle" type="text" dir="auto" placeholder="جمعہ مبارک — Jummah Mubarak!" class="w-full bg-black/70 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-extrabold" />' +
      '</div>' +

      '<div>' +
        '<label class="block text-[10px] font-bold text-slate-400 mb-1">Announcement Message Body (تفصیلی پیغام)</label>' +
        '<textarea id="admAnnounceMessage" rows="3" dir="auto" placeholder="اپنا پیغام یہاں لکھیں..." class="w-full bg-black/70 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 leading-relaxed"></textarea>' +
      '</div>' +

      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">' +
        '<div>' +
          '<label class="block text-[10px] font-bold text-slate-400 mb-1">Optional Banner Image URL</label>' +
          '<input id="admAnnounceImage" type="text" placeholder="https://... (optional)" class="w-full bg-black/70 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white" />' +
        '</div>' +
        '<div>' +
          '<label class="block text-[10px] font-bold text-slate-400 mb-1">Optional Action Button Label</label>' +
          '<input id="admAnnounceActionText" type="text" placeholder="e.g. 📩 Contact Us (optional)" class="w-full bg-black/70 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white" />' +
        '</div>' +
        '<div>' +
          '<label class="block text-[10px] font-bold text-slate-400 mb-1">Optional Action Button Link</label>' +
          '<input id="admAnnounceActionUrl" type="text" placeholder="mailto:contactqaaftube@gmail.com" class="w-full bg-black/70 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white" />' +
        '</div>' +
      '</div>' +

      '<div class="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">' +
        '<button type="button" onclick="window.showQaafSpecialAnnouncementModal(true)" class="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition">' +
          '👁️ Preview Popup Now' +
        '</button>' +
        '<button type="button" onclick="window.saveAdminSpecialAnnouncement(true)" class="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white px-5 py-2 rounded-xl text-xs font-extrabold shadow-lg cursor-pointer transition">' +
          '💾 Save &amp; Publish Announcement Live' +
        '</button>' +
      '</div>';

    sponsorPane.insertBefore(box, sponsorPane.firstChild);
    populateAdminAnnouncementInputs();
  }

  window.saveAdminSpecialAnnouncement = function(showPreviewToast) {
    var enEl = document.getElementById("admAnnounceEnabled");
    var bEl = document.getElementById("admAnnounceBadge");
    var tEl = document.getElementById("admAnnounceTitle");
    var mEl = document.getElementById("admAnnounceMessage");
    var thEl = document.getElementById("admAnnounceTheme");
    var frEl = document.getElementById("admAnnounceFreq");
    var imgEl = document.getElementById("admAnnounceImage");
    var atEl = document.getElementById("admAnnounceActionText");
    var auEl = document.getElementById("admAnnounceActionUrl");

    var updated = {
      enabled: enEl ? !!enEl.checked : false,
      badge: (bEl ? bEl.value : "").trim() || "🌙 QAAF Tube Special Message",
      title: (tEl ? tEl.value : "").trim() || "جمعہ مبارک — Jummah Mubarak!",
      message: (mEl ? mEl.value : "").trim(),
      theme: (thEl ? thEl.value : "emerald"),
      frequency: (frEl ? frEl.value : "once_per_session"),
      imageUrl: (imgEl ? imgEl.value : "").trim(),
      actionText: (atEl ? atEl.value : "").trim(),
      actionUrl: (auEl ? auEl.value : "").trim(),
      updatedAt: Date.now()
    };

    window.qaafSpecialAnnouncement = updated;
    try {
      localStorage.setItem("qaaf_special_announcement_v1", JSON.stringify(updated));
      sessionStorage.removeItem("qaaf_announce_seen_session");
    } catch (e) {}

    populateAdminAnnouncementInputs();

    var base = getFbBase();
    fetch(base + "/qaaf_special_announcement.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    }).catch(function() {});

    fetch(base + "/qaaf_global_state/specialAnnouncementJson.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(JSON.stringify(updated))
    }).catch(function() {});

    if (showPreviewToast && typeof showSyncToast === "function") {
      showSyncToast(updated.enabled ? "✅ Special Announcement Published Live!" : "⚪ Special Announcement Turned Off.");
    }
  };

  window.closeQaafSpecialAnnouncementModal = function() {
    var modal = document.getElementById("qaafSpecialAnnouncementPopupModal");
    if (modal) modal.classList.add("hidden");
    try {
      var cfg = window.qaafSpecialAnnouncement || DEFAULT_ANNOUNCEMENT;
      sessionStorage.setItem("qaaf_announce_seen_session", String(cfg.updatedAt || 1));
      localStorage.setItem("qaaf_announce_seen_day", new Date().toDateString() + "_" + String(cfg.updatedAt || 1));
    } catch (e) {}
  };

  window.showQaafSpecialAnnouncementModal = function(isAdminPreview) {
    var cfg = window.qaafSpecialAnnouncement || DEFAULT_ANNOUNCEMENT;
    if (isAdminPreview && document.getElementById("admAnnounceTitle")) {
      cfg = {
        enabled: true,
        badge: (document.getElementById("admAnnounceBadge").value || "").trim() || "🌙 QAAF Tube Special Message",
        title: (document.getElementById("admAnnounceTitle").value || "").trim() || "جمعہ مبارک!",
        message: (document.getElementById("admAnnounceMessage").value || "").trim(),
        theme: document.getElementById("admAnnounceTheme").value || "emerald",
        imageUrl: (document.getElementById("admAnnounceImage").value || "").trim(),
        actionText: (document.getElementById("admAnnounceActionText").value || "").trim(),
        actionUrl: (document.getElementById("admAnnounceActionUrl").value || "").trim()
      };
    }

    if (!isAdminPreview && !cfg.enabled) return;

    var themeStyles = {
      emerald: {
        border: "border-emerald-500/60",
        bg: "from-[#0b1f1a] via-[#0e1722] to-[#091318]",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
        btnBg: "from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white"
      },
      amber: {
        border: "border-amber-500/60",
        bg: "from-[#221a0b] via-[#171620] to-[#121018]",
        badgeBg: "bg-amber-500/20 text-amber-300 border-amber-400/40",
        btnBg: "from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black"
      },
      teal: {
        border: "border-teal-500/60",
        bg: "from-[#0a2024] via-[#0f1824] to-[#09121a]",
        badgeBg: "bg-teal-500/20 text-teal-300 border-teal-400/40",
        btnBg: "from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-black"
      },
      blue: {
        border: "border-blue-500/60",
        bg: "from-[#0d192b] via-[#101726] to-[#0a101d]",
        badgeBg: "bg-blue-500/20 text-blue-300 border-blue-400/40",
        btnBg: "from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white"
      }
    };
    var ts = themeStyles[cfg.theme] || themeStyles.emerald;

    var modal = document.getElementById("qaafSpecialAnnouncementPopupModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "qaafSpecialAnnouncementPopupModal";
      document.body.appendChild(modal);
    }

    modal.className = "fixed inset-0 z-[320] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4";
    modal.innerHTML =
      '<div class="relative w-full max-w-md bg-gradient-to-br ' + ts.bg + ' border-2 ' + ts.border + ' rounded-3xl p-5 sm:p-6 shadow-2xl text-center space-y-4 animate-fadeIn">' +
        '<button type="button" onclick="window.closeQaafSpecialAnnouncementModal()" class="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center text-sm font-extrabold transition cursor-pointer">✕</button>' +
        '<div class="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border text-xs font-extrabold ' + ts.badgeBg + '">' +
          cfg.badge +
        '</div>' +
        (cfg.imageUrl ? (
          '<div class="rounded-2xl overflow-hidden border border-white/15 bg-black/40 max-h-48 flex items-center justify-center">' +
            '<img src="' + cfg.imageUrl + '" alt="" class="w-full max-h-48 object-cover" />' +
          '</div>'
        ) : '') +
        '<h3 dir="auto" class="text-lg sm:text-xl font-extrabold text-white leading-snug">' + cfg.title + '</h3>' +
        (cfg.message ? (
          '<p dir="auto" class="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line bg-black/35 border border-white/10 rounded-2xl p-3.5">' + cfg.message + '</p>'
        ) : '') +
        '<div class="pt-1 flex flex-wrap items-center justify-center gap-2.5">' +
          (cfg.actionText && cfg.actionUrl ? (
            '<a href="' + cfg.actionUrl + '" target="_blank" rel="noopener" class="bg-white/15 hover:bg-white/25 text-white border border-white/20 px-4 py-2.5 rounded-xl text-xs font-extrabold transition">' +
              cfg.actionText +
            '</a>'
          ) : '') +
          '<button type="button" onclick="window.closeQaafSpecialAnnouncementModal()" class="bg-gradient-to-r ' + ts.btnBg + ' px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-lg cursor-pointer transition">' +
            'جزاک اللہ خیراً • بند کریں' +
          '</button>' +
        '</div>' +
      '</div>';

    modal.classList.remove("hidden");
  };

  function checkAndAutoShowAnnouncement() {
    var cfg = window.qaafSpecialAnnouncement;
    if (!cfg || !cfg.enabled) return;
    var stamp = String(cfg.updatedAt || 1);
    if (cfg.frequency === "once_per_session") {
      if (sessionStorage.getItem("qaaf_announce_seen_session") === stamp) return;
    } else if (cfg.frequency === "once_per_day") {
      if (localStorage.getItem("qaaf_announce_seen_day") === (new Date().toDateString() + "_" + stamp)) return;
    }
    window.showQaafSpecialAnnouncementModal(false);
  }

  function pullSpecialAnnouncementFromCloud() {
    var base = getFbBase();
    fetch(base + "/qaaf_special_announcement.json?t=" + Date.now())
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data && typeof data === "object" && typeof data.enabled === "boolean") {
          window.qaafSpecialAnnouncement = Object.assign({}, DEFAULT_ANNOUNCEMENT, data);
          try { localStorage.setItem("qaaf_special_announcement_v1", JSON.stringify(window.qaafSpecialAnnouncement)); } catch (e) {}
          populateAdminAnnouncementInputs();
          setTimeout(checkAndAutoShowAnnouncement, 600);
        } else {
          setTimeout(checkAndAutoShowAnnouncement, 600);
        }
      })
      .catch(function() {
        setTimeout(checkAndAutoShowAnnouncement, 600);
      });
  }

  var prevAdmOpen = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevAdmOpen) prevAdmOpen();
    injectAdminAnnouncementControlBox();
    populateAdminAnnouncementInputs();
  };

  // Also fix duplicate "Most Recent Most Recent" & "Most Viewed Most Viewed" button labels
  function cleanDuplicateSortLabels() {
    document.querySelectorAll("button").forEach(function(btn) {
      var txt = (btn.innerText || "").trim();
      if (txt === "Most Recent Most Recent") {
        btn.innerHTML = '<span>🕒</span> <span>Most Recent</span>';
      } else if (txt === "Most Viewed Most Viewed") {
        btn.innerHTML = '<span>🔥</span> <span>Most Viewed</span>';
      }
    });
  }

  setInterval(cleanDuplicateSortLabels, 1000);
  setTimeout(injectAdminAnnouncementControlBox, 1200);
  pullSpecialAnnouncementFromCloud();
})();

// =========================================================================
// SECTION 6: PLAY STORE GREEN UI, YOUTUBE HEADER SEARCH, FULL-WIDTH FEED,
//            BOTTOM NAV (HOME/SHORTS/GAMES/YOU) & PRO MEMBERSHIP ENGINE v55.0
// =========================================================================
(function initQaafPlayStoreGreenAndMobileAppUX() {
  var FIREBASE_DEFAULT_URL = "https://qaaftube-6f251-default-rtdb.firebaseio.com";
  function getFbBase() {
    return (localStorage.getItem("qaaf_firebase_db_url") || FIREBASE_DEFAULT_URL).replace(/\/+$/, "");
  }

  // 1. MASTER CSS FOR GREEN THEME, HEADER SEARCH, 1-COL MOBILE FEED & SHORTS VIEW
  var oldCss = document.getElementById("qaafSmartCompactGridCss");
  if (oldCss) oldCss.remove();

  if (!document.getElementById("qaafPlayStoreGreenAndSleekFeedCss")) {
    var st = document.createElement("style");
    st.id = "qaafPlayStoreGreenAndSleekFeedCss";
    st.textContent = [
      ".bg-rose-600, .bg-red-600, .bg-rose-500, .bg-red-500 { background-color: #164e3a !important; background-image: none !important; color: #ffffff !important; border-color: rgba(16,185,129,0.4) !important; }",
      ".hover\\:bg-rose-500:hover, .hover\\:bg-red-500:hover, .hover\\:bg-rose-600:hover { background-color: #1e6b50 !important; color: #ffffff !important; }",
      "body.qaaf-games-mode-active #tabGamesBtn, body.qaaf-games-mode-active #kidsContentSwitcher button:last-child { background-color: #164e3a !important; color: #ffffff !important; }",

      /* Hide old main-screen search & request rows */
      "#qaafNotifBellBtn, #qaafTopSearchAndBellBar, #qaafCombinedSearchRequestRow, #qaafSearchBarWrapper, .qaaf-old-search-hidden { display: none !important; }",

      /* YOUTUBE-STYLE HEADER SEARCH POSITIONING:
         - Desktop (>= 768px): #qaafHeaderCenterSearch sits in the middle of #mainHeader (AFTER QAAF|Tube logo).
         - Mobile (< 768px): #qaafHeaderCenterSearch is hidden until user clicks the right-side 'ق' lens (#qaafHeaderSearchToggleBtn). */
      "@media (min-width: 768px) {",
      "  #qaafHeaderCenterSearch { display: flex !important; flex: 1 1 480px !important; max-width: 540px !important; margin: 0 auto !important; padding: 0 14px !important; align-items: center !important; }",
      "  #qaafHeaderSearchToggleBtn, #qaafMobileSearchBackBtn { display: none !important; }",
      "}",
      "@media (max-width: 767px) {",
      "  #mainHeader:not(.qaaf-mobile-search-mode) #qaafHeaderCenterSearch { display: none !important; }",
      "  #mainHeader.qaaf-mobile-search-mode > *:not(#qaafHeaderCenterSearch) { display: none !important; }",
      "  #mainHeader.qaaf-mobile-search-mode #qaafHeaderCenterSearch { display: flex !important; width: 100% !important; align-items: center !important; gap: 8px !important; padding: 0 4px !important; }",
      "  #mainHeader.qaaf-mobile-search-mode #qaafMobileSearchBackBtn { display: inline-flex !important; }",
      "}",

      /* YOUTUBE-STYLE FULL-WIDTH MOBILE FEED (1 COL) & CLEAN DESKTOP GRID (3-4 COLS) */
      "@media (max-width: 639px) {",
      "  #videoGrid { display: grid !important; grid-template-columns: 1fr !important; gap: 20px !important; }",
      "  main { padding-left: 0 !important; padding-right: 0 !important; padding-bottom: 78px !important; }",
      "  #qaafShortsShelf, #gamesSection, #qaafChannelViewHeaderBox { padding-left: 10px !important; padding-right: 10px !important; }",
      "}",
      "@media (min-width: 640px) {",
      "  #videoGrid { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 16px !important; }",
      "  main { padding-bottom: 78px !important; }",
      "}",
      "@media (min-width: 960px) {",
      "  #videoGrid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 18px !important; }",
      "}",
      "@media (min-width: 1280px) {",
      "  #videoGrid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 18px !important; }",
      "}",

      /* Shorts-Only View when user clicks 'Shorts' in Bottom Navigation Bar */
      "body.qaaf-shorts-only-view #videoGrid, body.qaaf-shorts-only-view #qaafLoadMoreBox { display: none !important; }",
      "body.qaaf-shorts-only-view #qaafShortsShelf { display: block !important; }",
      "body.qaaf-shorts-only-view #qaafShortsShelf > div:last-child { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; overflow: visible !important; }",
      "@media (min-width: 640px) { body.qaaf-shorts-only-view #qaafShortsShelf > div:last-child { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }",
      "body.qaaf-shorts-only-view #qaafShortsShelf a { width: 100% !important; }",

      /* Full-screen Parent Control Modal */
      "#parentModal { padding: 0 !important; align-items: stretch !important; justify-content: stretch !important; }",
      "#parentModal > div { width: 100% !important; max-width: 100% !important; height: 100dvh !important; max-height: 100dvh !important; border-radius: 0 !important; border: none !important; margin: 0 !important; overflow-y: auto !important; padding: 16px 16px 90px 16px !important; background: #090d14 !important; }",

      /* Smooth Auto-Hide for Category Bar & Bottom Nav */
      "#categoryBar { transition: transform 0.25s ease, opacity 0.25s ease, max-height 0.25s ease !important; }",
      "#categoryBar.qaaf-bar-autohidden { opacity: 0 !important; pointer-events: none !important; }",
      "#qaafMobileBottomNav { background-color: #090d14 !important; transition: transform 0.22s ease, opacity 0.22s ease !important; }",
      "#qaafMobileBottomNav.qaaf-nav-autohidden { transform: translateY(100%) !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }",
      "#regionalPromoBar { transition: transform 0.22s ease, opacity 0.22s ease !important; }",
      "body:not(.qaaf-scrolled-down-promo-mode) #regionalPromoBar { transform: translateY(100%) !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }",
      "body.qaaf-scrolled-down-promo-mode #regionalPromoBar { transform: translateY(0) !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }",

      /* Hide Drawer & Profile buttons in Kids Mode */
      "body.qaaf-kids-locked #headerDrawerMenuBtn, body.qaaf-kids-locked #bnavProfileBtn { display: none !important; }"
    ].join("\n");
    document.head.appendChild(st);
  }

  // 2. PLACE YOUTUBE-STYLE HEADER SEARCH BAR AS DIRECT CHILD OF #mainHeader (AFTER LOGO DIV!)
  //    AND PLACE WHITE 'ق' LENS INSIDE #headerRightControls BEFORE #langDropdownContainer!
  function setupCleanHeaderSearchAndMobileLens() {
    var header = document.getElementById("mainHeader");
    if (!header) return;

    document.body.classList.toggle("qaaf-kids-locked", typeof isKidsLocked !== "undefined" && !!isKidsLocked);

    var rightControls = document.getElementById("headerRightControls");
    var langCont = document.getElementById("langDropdownContainer");

    /* Hide the old main-screen search bar above Shorts (#qaafSearchInput wrapper) */
    var oldMainInp = document.getElementById("qaafSearchInput");
    if (oldMainInp) {
      var liveDrop = document.getElementById("qaafLiveSearchDropdown");
      var centerBox = document.getElementById("qaafHeaderCenterSearch");
      if (liveDrop && centerBox && liveDrop.parentElement !== centerBox) {
        liveDrop.className = "hidden absolute left-0 right-0 top-full mt-1.5 bg-[#0f141d] border border-emerald-500/40 rounded-2xl shadow-2xl z-[220] max-h-80 overflow-y-auto";
        centerBox.appendChild(liveDrop);
      }
      var oldRow = oldMainInp.closest("#videosSection > div");
      if (oldRow && oldRow.id !== "qaafShortsShelf" && oldRow.id !== "videoGrid") {
        oldRow.classList.add("qaaf-old-search-hidden");
        oldRow.style.setProperty("display", "none", "important");
      } else if (oldMainInp.parentElement && oldMainInp.parentElement.parentElement) {
        oldMainInp.parentElement.parentElement.classList.add("qaaf-old-search-hidden");
        oldMainInp.parentElement.parentElement.style.setProperty("display", "none", "important");
      }
    }

    /* Remove any old search bar that got injected inside the Left Logo Div (#mainHeader > div:first-child) */
    var leftLogoDiv = header.firstElementChild;
    if (leftLogoDiv) {
      leftLogoDiv.querySelectorAll("#qaafHeaderCenterSearch, #qaafHeaderSearchToggleBtn").forEach(function(el) {
        el.remove();
      });
    }

    /* Create #qaafHeaderCenterSearch as a direct child of #mainHeader (between Left Logo Div and #headerRightControls) */
    var centerSearch = document.getElementById("qaafHeaderCenterSearch");
    if (!centerSearch) {
      centerSearch = document.createElement("div");
      centerSearch.id = "qaafHeaderCenterSearch";
      centerSearch.className = "hidden items-center gap-2 relative";
      centerSearch.innerHTML =
        '<button type="button" id="qaafMobileSearchBackBtn" onclick="window.closeQaafMobileHeaderSearch()" class="hidden w-9 h-9 rounded-full hover:bg-white/10 text-white items-center justify-center shrink-0 cursor-pointer">' +
          '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' +
            '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>' +
          '</svg>' +
        '</button>' +
        '<div class="flex-1 flex items-center bg-[#121822] border border-slate-700/90 focus-within:border-emerald-500 rounded-full overflow-hidden h-9 sm:h-10 shadow-inner">' +
          '<input id="qaafHeaderSearchInput" type="text" dir="auto" autocomplete="off" placeholder="Search QAAF Tube..." ' +
            'class="w-full bg-transparent px-4 py-1.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none" ' +
            'oninput="window.runQaafHeaderSearchNow(this.value, false)" ' +
            'onkeydown="if(event.key===\'Enter\'){window.runQaafHeaderSearchNow(this.value, true);}" />' +
          '<button type="button" id="qaafHeaderSearchClearBtn" onclick="window.clearQaafHeaderSearchNow()" class="hidden w-8 h-8 text-slate-400 hover:text-white items-center justify-center text-sm font-bold cursor-pointer shrink-0">&#10005;</button>' +
          '<button type="button" onclick="window.runQaafHeaderSearchNow(document.getElementById(\'qaafHeaderSearchInput\').value, true)" class="h-full px-3.5 bg-white/10 hover:bg-[#164e3a] border-l border-slate-700/80 text-white flex items-center justify-center cursor-pointer transition shrink-0" title="Search">' +
            '<svg viewBox="0 0 28 28" class="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<circle cx="12" cy="12" r="8" stroke="#FFFFFF" stroke-width="2.2"/>' +
              '<line x1="18" y1="18" x2="25" y2="25" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/>' +
              '<text x="12" y="15.3" text-anchor="middle" fill="#FFFFFF" font-size="10.2" font-weight="900" font-family="sans-serif">&#1602;</text>' +
            '</svg>' +
          '</button>' +
        '</div>';
    }
    if (centerSearch.parentElement !== header && rightControls) {
      header.insertBefore(centerSearch, rightControls);
    }

    /* Place the Mobile White 'ق' Search Toggle Button inside #headerRightControls right before #langDropdownContainer */
    if (rightControls && langCont) {
      var mBtn = document.getElementById("qaafHeaderSearchToggleBtn");
      if (!mBtn) {
        mBtn = document.createElement("button");
        mBtn.id = "qaafHeaderSearchToggleBtn";
        mBtn.type = "button";
        mBtn.title = "Search";
        mBtn.className = "w-9 h-9 rounded-full hover:bg-white/10 text-white flex items-center justify-center transition cursor-pointer shrink-0";
        mBtn.innerHTML =
          '<svg viewBox="0 0 30 30" class="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="13" cy="13" r="9.2" stroke="#FFFFFF" stroke-width="2.4"/>' +
            '<line x1="19.8" y1="19.8" x2="27.2" y2="27.2" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round"/>' +
            '<text x="13" y="16.8" text-anchor="middle" fill="#FFFFFF" font-size="11.8" font-weight="900" font-family="sans-serif">&#1602;</text>' +
          '</svg>';
        mBtn.onclick = function(ev) {
          ev.stopPropagation();
          window.openQaafMobileHeaderSearch();
        };
      }
      if (mBtn.parentElement !== rightControls || mBtn.nextElementSibling !== langCont) {
        rightControls.insertBefore(mBtn, langCont);
      }
    }
  }

  window.openQaafMobileHeaderSearch = function() {
    var header = document.getElementById("mainHeader");
    if (!header) return;
    header.classList.add("qaaf-mobile-search-mode");
    var inp = document.getElementById("qaafHeaderSearchInput");
    if (inp) setTimeout(function() { inp.focus(); }, 60);
  };

  window.closeQaafMobileHeaderSearch = function() {
    var header = document.getElementById("mainHeader");
    if (header) header.classList.remove("qaaf-mobile-search-mode");
  };

  window.clearQaafHeaderSearchNow = function() {
    var inp = document.getElementById("qaafHeaderSearchInput");
    if (inp) {
      inp.value = "";
      inp.focus();
    }
    window.runQaafHeaderSearchNow("", true);
  };

  window.runQaafHeaderSearchNow = function(val, isEnter) {
    var clearBtn = document.getElementById("qaafHeaderSearchClearBtn");
    if (clearBtn) {
      clearBtn.style.display = (val && val.length > 0) ? "flex" : "none";
    }
    document.body.classList.remove("qaaf-shorts-only-view");
    if (val && val.trim().length > 0 && typeof window.switchKidsTab === "function") {
      window.switchKidsTab("videos");
    }
    window.qaafActiveSearchQuery = val || "";
    window.qaafGridPageLimit = 24;
    var origInp = document.getElementById("qaafSearchInput");
    if (origInp && origInp.value !== val) {
      origInp.value = val || "";
    }
    if (typeof window.renderVideosNow === "function") {
      window.renderVideosNow();
    }
    if (isEnter) {
      var drop = document.getElementById("qaafLiveSearchDropdown");
      if (drop) drop.classList.add("hidden");
    }
  };

  // 3. SAFELY UPDATE #parentModal (HIDE #parentChannelsFilterList & CHANGE #pwaInstallCard TO APK)
  function updateParentModalSafely() {
    var chFilter = document.getElementById("parentChannelsFilterList");
    if (chFilter && chFilter.parentElement) {
      chFilter.parentElement.style.display = "none";
    }
    var pwaCard = document.getElementById("pwaInstallCard");
    if (pwaCard && !pwaCard.getAttribute("data-apk-ready")) {
      pwaCard.setAttribute("data-apk-ready", "1");
      pwaCard.innerHTML =
        '<div class="min-w-0">' +
          '<h4 class="text-xs font-bold text-emerald-300 flex items-center gap-1.5">' +
            '<span>&#129302;</span> <span>Download QAAF Tube Android App (APK)</span>' +
          '</h4>' +
          '<p class="text-[11px] text-slate-300 mt-0.5">Install the official QAAF Tube Android App on your phone for full Kids Kiosk Lock &amp; smooth playback.</p>' +
        '</div>' +
        '<a href="./apk/qaaf-tube.apk" download="qaaf-tube.apk" class="bg-[#164e3a] hover:bg-[#1e6b50] border border-emerald-400/40 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow shrink-0 flex items-center gap-1.5 transition no-underline">' +
          '<span>&#128229;</span> <span>Download APK</span>' +
        '</a>';
    }
  }

  // 4. INJECT 4-BUTTON BOTTOM NAVIGATION BAR (HOME, SHORTS, GAMES, YOU)
  function injectBottomNavBar() {
    if (document.getElementById("qaafMobileBottomNav")) return;
    var nav = document.createElement("nav");
    nav.id = "qaafMobileBottomNav";
    nav.dir = "ltr";
    nav.className = "fixed bottom-0 left-0 right-0 z-[130] h-14 bg-[#090d14] border-t border-slate-800 px-2 flex items-center justify-around shadow-2xl";
    nav.innerHTML =
      '<button type="button" onclick="window.qaafBottomNavAction(\'home\')" id="bnavHomeBtn" class="flex flex-col items-center justify-center gap-1 text-white transition cursor-pointer py-1 px-3">' +
        '<svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z"/></svg>' +
        '<span class="text-[10px] font-bold">Home</span>' +
      '</button>' +
      '<button type="button" onclick="window.qaafBottomNavAction(\'shorts\')" id="bnavShortsBtn" class="flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-white transition cursor-pointer py-1 px-3">' +
        '<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M14.2 8.6C14.2 7 9.8 7 9.8 9.2C9.8 11.3 14.2 11.7 14.2 14.2C14.2 16.5 9.8 16.5 9.8 14.8"/></svg>' +
        '<span class="text-[10px] font-bold">Shorts</span>' +
      '</button>' +
      '<button type="button" onclick="window.qaafBottomNavAction(\'games\')" id="bnavGamesBtn" class="flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-white transition cursor-pointer py-1 px-3">' +
        '<svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>' +
        '<span class="text-[10px] font-bold">Games</span>' +
      '</button>' +
      '<button type="button" onclick="window.qaafBottomNavAction(\'profile\')" id="bnavProfileBtn" class="flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-white transition cursor-pointer py-1 px-3">' +
        '<div id="bnavProfileCircle" class="w-6 h-6 rounded-full bg-[#164e3a] border border-emerald-400/60 flex items-center justify-center text-white text-[11px] font-extrabold shadow">&#1602;</div>' +
        '<span class="text-[10px] font-bold">You</span>' +
      '</button>';
    document.body.appendChild(nav);
  }

  window.qaafBottomNavAction = function(tab) {
    var bHome = document.getElementById("bnavHomeBtn");
    var bShorts = document.getElementById("bnavShortsBtn");
    var bGames = document.getElementById("bnavGamesBtn");
    var bProf = document.getElementById("bnavProfileBtn");
    [bHome, bShorts, bGames, bProf].forEach(function(b) {
      if (b) b.className = "flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-white transition cursor-pointer py-1 px-3";
    });

    if (tab === "home") {
      document.body.classList.remove("qaaf-shorts-only-view");
      if (bHome) bHome.className = "flex flex-col items-center justify-center gap-1 text-white transition cursor-pointer py-1 px-3";
      if (typeof window.closeInstalledGameModal === "function") window.closeInstalledGameModal();
      if (typeof window.switchKidsTab === "function") window.switchKidsTab("videos");
      if (typeof window.exitQaafChannelView === "function") window.exitQaafChannelView();
      currentCategory = "all";
      window.qaafSelectedChannel = "ALL";
      window.qaafActiveSearchQuery = "";
      var hInp = document.getElementById("qaafHeaderSearchInput");
      if (hInp) hInp.value = "";
      if (typeof window.renderVideosNow === "function") window.renderVideosNow();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (tab === "shorts") {
      if (bShorts) bShorts.className = "flex flex-col items-center justify-center gap-1 text-white transition cursor-pointer py-1 px-3";
      if (typeof window.closeInstalledGameModal === "function") window.closeInstalledGameModal();
      if (typeof window.switchKidsTab === "function") window.switchKidsTab("videos");
      document.body.classList.add("qaaf-shorts-only-view");
      var shShelf = document.getElementById("qaafShortsShelf");
      if (shShelf) shShelf.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (tab === "games") {
      document.body.classList.remove("qaaf-shorts-only-view");
      if (bGames) bGames.className = "flex flex-col items-center justify-center gap-1 text-white transition cursor-pointer py-1 px-3";
      if (typeof window.switchKidsTab === "function") window.switchKidsTab("games");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (tab === "profile") {
      if (typeof isKidsLocked !== "undefined" && isKidsLocked) return;
      if (bProf) bProf.className = "flex flex-col items-center justify-center gap-1 text-white transition cursor-pointer py-1 px-3";
      if (typeof window.openQaafProfileDrawer === "function") {
        window.openQaafProfileDrawer();
      }
    }
  };

  // 5. AUTO-HIDE CATEGORY BAR & BOTTOM NAV ON SCROLL DOWN (REVEALING #regionalPromoBar)
  var lastScrollY = window.scrollY || 0;
  window.addEventListener("scroll", function() {
    var curY = window.scrollY || 0;
    var catBar = document.getElementById("categoryBar");
    var botNav = document.getElementById("qaafMobileBottomNav");
    var pModal = document.getElementById("playerModal");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var isWatchingFull = pModal && !pModal.classList.contains("hidden") && scrollWrap && !scrollWrap.classList.contains("hidden");

    if (isWatchingFull) {
      if (botNav) botNav.classList.add("qaaf-nav-autohidden");
      document.body.classList.remove("qaaf-scrolled-down-promo-mode");
      return;
    }

    if (curY > lastScrollY + 10 && curY > 60) {
      if (catBar) catBar.classList.add("qaaf-bar-autohidden");
      if (botNav) botNav.classList.add("qaaf-nav-autohidden");
      document.body.classList.add("qaaf-scrolled-down-promo-mode");
    } else if (curY < lastScrollY - 10 || curY < 45) {
      document.body.classList.remove("qaaf-scrolled-down-promo-mode");
      if (catBar && !document.body.classList.contains("qaaf-games-mode-active")) {
        catBar.classList.remove("qaaf-bar-autohidden");
      }
      if (botNav) botNav.classList.remove("qaaf-nav-autohidden");
    }
    lastScrollY = curY;
  }, { passive: true });

  // 6. ENHANCE #qaafLeftSidebarDrawer WITH VIDEO REQUEST + STATUS, PRO MEMBERSHIP & APK DOWNLOAD
  function enhanceRealLeftSidebarDrawer() {
    var drawer = document.getElementById("qaafLeftSidebarDrawer");
    if (!drawer) return;

    var reqCount = 0;
    try {
      var myReqs = JSON.parse(localStorage.getItem("qaaf_my_submitted_req_ids") || "[]");
      if (Array.isArray(myReqs)) reqCount = myReqs.length;
    } catch (e) {}

    var extraBox = document.getElementById("qaafDrawerExtraMenuItems");
    if (!extraBox) {
      var navArea = drawer.querySelector(".overflow-y-auto") || drawer;
      extraBox = document.createElement("div");
      extraBox.id = "qaafDrawerExtraMenuItems";
      extraBox.className = "pt-2 pb-2 space-y-2 border-t border-slate-800/80";
      navArea.appendChild(extraBox);
    }

    var isPro = localStorage.getItem("qaaf_pro_unlocked") === "true" || !!window.isProUnlocked || (typeof isSupporterPro !== "undefined" && isSupporterPro);

    extraBox.innerHTML =
      '<button type="button" onclick="window.openVideoRequestFromDrawer()" class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#11221c] hover:bg-[#16382b] border border-emerald-500/35 text-xs font-extrabold text-white transition cursor-pointer">' +
        '<span class="flex items-center gap-2.5"><span class="text-base">&#128233;</span> <span>Video Request &amp; Status</span></span>' +
        '<span id="drawerVideoRequestBadge" class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-black">' + reqCount + '</span>' +
      '</button>' +
      '<button type="button" onclick="window.openQaafProMembershipModal()" class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#164e3a] to-[#0f3d2e] hover:from-[#1d634a] hover:to-[#164e3a] border border-emerald-400/50 text-xs font-extrabold text-white shadow transition cursor-pointer">' +
        '<span class="flex items-center gap-2.5"><span class="text-base">&#128081;</span> <span>' + (isPro ? 'QAAF Pro Member (Active)' : 'Get Pro Membership / Code') + '</span></span>' +
        '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-white text-[#0f3d2e]">' + (isPro ? 'ACTIVE' : 'PRO') + '</span>' +
      '</button>' +
      '<a href="./apk/qaaf-tube.apk" download="qaaf-tube.apk" class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-300 transition cursor-pointer no-underline">' +
        '<span class="flex items-center gap-2.5"><span class="text-base">&#129302;</span> <span>Download Android App (APK)</span></span>' +
        '<span class="text-[10px] font-extrabold text-white">&#11015; APK</span>' +
      '</a>' +
      '<div class="bg-black/40 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-300 space-y-1">' +
        '<div class="font-extrabold text-emerald-300 flex items-center gap-1.5"><span>&#128227;</span> <span>Sponsor &amp; Promotion</span></div>' +
        '<p class="text-[10px] text-slate-400 leading-relaxed">For halal sponsorship, promotion, or support on QAAF Tube:</p>' +
        '<a href="mailto:contactqaaftube@gmail.com" class="inline-block text-emerald-400 hover:underline font-bold text-[11px]">contactqaaftube@gmail.com</a>' +
      '</div>';
  }

  window.openVideoRequestFromDrawer = function() {
    if (typeof window.closeQaafProfileDrawer === "function") window.closeQaafProfileDrawer();
    var notifModal = document.getElementById("userNotifModal");
    if (notifModal) {
      if (typeof window.openUserNotificationsModal === "function") window.openUserNotificationsModal();
      notifModal.classList.remove("hidden");
    } else if (typeof window.openParentalGate === "function") {
      window.openParentalGate("settings");
    }
  };

  // 7. PRO MEMBERSHIP + PROMO CODE + ADMIN MANUAL PRO ENGINE
  var BUILTIN_PROMO_CODES = ["QAAFPRO786", "MAKKAH786", "QAAFVIPSADQAH", "ALLAH99"];
  window.qaafCloudPromoCodes = {};

  function pullPromoCodesFromCloud() {
    fetch(getFbBase() + "/qaaf_promo_codes.json?t=" + Date.now())
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) {
        if (d && typeof d === "object") window.qaafCloudPromoCodes = d;
      })
      .catch(function() {});
  }

  function activateUserProMembershipNow(sourceLabel) {
    window.isProUnlocked = true;
    if (typeof isSupporterPro !== "undefined") isSupporterPro = true;
    localStorage.setItem("qaaf_pro_unlocked", "true");
    localStorage.setItem("qaaf_supporter_pro", "true");
    try {
      if (typeof currentUserEmail !== "undefined" && currentUserEmail) {
        var uKey = currentUserEmail.toLowerCase().trim();
        if (window.registeredUsersMap && window.registeredUsersMap[uKey]) {
          window.registeredUsersMap[uKey].isPro = true;
          localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
        }
        if (typeof window.syncQaafUsersWithCloudNow === "function") window.syncQaafUsersWithCloudNow(false);
      }
    } catch (e) {}
    if (typeof updateSupporterBadges === "function") updateSupporterBadges();
    enhanceRealLeftSidebarDrawer();
    if (typeof showSyncToast === "function") {
      showSyncToast("Alhamdulillah! QAAF Pro Membership Activated (" + sourceLabel + ")!");
    }
  }

  window.openQaafProMembershipModal = function() {
    if (typeof window.closeQaafProfileDrawer === "function") window.closeQaafProfileDrawer();
    var isPro = localStorage.getItem("qaaf_pro_unlocked") === "true" || !!window.isProUnlocked || (typeof isSupporterPro !== "undefined" && isSupporterPro);
    var modal = document.getElementById("qaafProMembershipModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "qaafProMembershipModal";
      document.body.appendChild(modal);
    }
    modal.className = "fixed inset-0 z-[330] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4";
    modal.innerHTML =
      '<div class="relative w-full max-w-md bg-gradient-to-br from-[#0b1f18] via-[#0e1722] to-[#091218] border-2 border-emerald-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-white">' +
        '<button type="button" onclick="document.getElementById(\'qaafProMembershipModal\').classList.add(\'hidden\')" class="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-emerald-700 text-white flex items-center justify-center text-sm font-extrabold cursor-pointer">&#10005;</button>' +
        '<div class="flex items-center gap-2.5">' +
          '<div class="w-10 h-10 rounded-2xl bg-[#164e3a] border border-emerald-400/50 flex items-center justify-center text-xl shadow">&#128081;</div>' +
          '<div>' +
            '<h3 class="text-base sm:text-lg font-extrabold text-white">QAAF Pro Membership</h3>' +
            '<p class="text-[11px] text-emerald-300 font-bold">' + (isPro ? 'Your Pro Membership is Currently ACTIVE!' : 'Unlock all game stages & support 100% ad-free Islamic hub') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="bg-black/45 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2">' +
          '<div class="text-xs font-extrabold text-emerald-300">1. Subscribe via Google Play (Mobile App)</div>' +
          '<p class="text-[11px] text-slate-300">Instant monthly/yearly supporter subscription through Google Play Billing.</p>' +
          '<button type="button" onclick="window.triggerGooglePlayProSubscription()" class="w-full bg-[#164e3a] hover:bg-[#1e6b50] border border-emerald-400/50 text-white py-2.5 rounded-xl text-xs font-extrabold shadow flex items-center justify-center gap-2 cursor-pointer transition">' +
            '<span>&#129302;</span> <span>Subscribe with Google Play</span>' +
          '</button>' +
        '</div>' +
        '<div class="bg-black/45 border border-slate-700 rounded-2xl p-3.5 space-y-2">' +
          '<div class="text-xs font-extrabold text-white">2. Have a Promo / Activation Code?</div>' +
          '<p class="text-[11px] text-slate-400">Enter the activation code received from QAAF Tube Admin (contactqaaftube@gmail.com):</p>' +
          '<div class="flex items-center gap-2">' +
            '<input id="qaafPromoCodeInput" type="text" placeholder="Enter Code (e.g. QAAF-786)" class="w-full bg-black/80 border border-slate-600 rounded-xl px-3 py-2 text-xs text-white font-extrabold uppercase tracking-wider" />' +
            '<button type="button" onclick="window.redeemQaafPromoCode()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer transition">Activate</button>' +
          '</div>' +
          '<div id="qaafPromoCodeMsg" class="text-[11px] font-bold hidden"></div>' +
        '</div>' +
      '</div>';
    modal.classList.remove("hidden");
  };

  window.triggerGooglePlayProSubscription = function() {
    if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: "QAAF_GOOGLE_PLAY_SUBSCRIBE",
        sku: "qaaf_pro_supporter"
      }));
    } else {
      var msgEl = document.getElementById("qaafPromoCodeMsg");
      if (msgEl) {
        msgEl.className = "text-[11px] font-bold text-emerald-300 block pt-1";
        msgEl.innerText = "Google Play Billing opens inside the QAAF Tube Android App, or use an Activation Code below!";
      }
    }
  };

  window.redeemQaafPromoCode = function() {
    var inp = document.getElementById("qaafPromoCodeInput");
    var msgEl = document.getElementById("qaafPromoCodeMsg");
    var code = (inp ? inp.value : "").trim().toUpperCase();
    if (!code) return;

    var isValid = BUILTIN_PROMO_CODES.indexOf(code) !== -1 || (window.qaafCloudPromoCodes && window.qaafCloudPromoCodes[code]);
    if (isValid) {
      activateUserProMembershipNow("Code: " + code);
      if (msgEl) {
        msgEl.className = "text-[11px] font-extrabold text-emerald-400 block pt-1";
        msgEl.innerText = "MashaAllah! Pro Membership Activated Successfully!";
      }
      setTimeout(function() {
        var m = document.getElementById("qaafProMembershipModal");
        if (m) m.classList.add("hidden");
      }, 1100);
    } else {
      if (msgEl) {
        msgEl.className = "text-[11px] font-extrabold text-rose-400 block pt-1";
        msgEl.innerText = "Invalid code. Please check your code or contact contactqaaftube@gmail.com";
      }
    }
  };

  function injectAdminManualProAndCodeBox() {
    if (document.getElementById("admManualProAndPromoBox")) return;
    var usersPane = document.getElementById("admPane_users");
    if (!usersPane) return;

    var box = document.createElement("div");
    box.id = "admManualProAndPromoBox";
    box.className = "bg-[#0e1a16] border-2 border-emerald-500/40 rounded-2xl p-4 space-y-3 text-xs mb-4";
    box.innerHTML =
      '<h4 class="text-sm font-extrabold text-emerald-300 flex items-center gap-2"><span>&#128081;</span> <span>Manual Pro Upgrade (By Email) &amp; Activation Code Generator</span></h4>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        '<div class="bg-black/40 border border-slate-800 rounded-xl p-3 space-y-2">' +
          '<div class="font-bold text-white">1. Upgrade User Email to PRO Manually:</div>' +
          '<div class="flex items-center gap-1.5">' +
            '<input id="admManualProEmailInput" type="email" placeholder="user@gmail.com" class="w-full bg-black/70 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white" />' +
            '<button type="button" onclick="window.adminGrantProByEmailNow()" class="bg-[#164e3a] hover:bg-[#1e6b50] text-white px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer">Grant Pro</button>' +
          '</div>' +
        '</div>' +
        '<div class="bg-black/40 border border-slate-800 rounded-xl p-3 space-y-2">' +
          '<div class="font-bold text-white">2. Create Activation / Promo Code:</div>' +
          '<div class="flex items-center gap-1.5">' +
            '<input id="admNewPromoCodeInput" type="text" placeholder="e.g. QAAF2026" class="w-full bg-black/70 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white uppercase font-bold" />' +
            '<button type="button" onclick="window.adminCreatePromoCodeNow()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer">Save Code</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    usersPane.insertBefore(box, usersPane.firstChild);
  }

  window.adminGrantProByEmailNow = function() {
    var inp = document.getElementById("admManualProEmailInput");
    var email = (inp ? inp.value : "").trim().toLowerCase();
    if (!email) return;
    if (!window.registeredUsersMap) window.registeredUsersMap = {};
    if (!window.registeredUsersMap[email]) {
      window.registeredUsersMap[email] = { userKey: email, email: email, name: email.split("@")[0], pass: "123456", pin: "123456", recWord: "makkah", isPro: true, createdAt: new Date().toLocaleDateString() };
    } else {
      window.registeredUsersMap[email].isPro = true;
    }
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    if (typeof window.syncQaafUsersWithCloudNow === "function") window.syncQaafUsersWithCloudNow(true);
    if (typeof window.renderAdminUsersTable === "function") window.renderAdminUsersTable();
    if (typeof showSyncToast === "function") showSyncToast("Upgraded " + email + " to PRO Member!");
  };

  window.adminCreatePromoCodeNow = function() {
    var inp = document.getElementById("admNewPromoCodeInput");
    var code = (inp ? inp.value : "").trim().toUpperCase();
    if (!code) {
      code = "QAAF-" + Math.floor(1000 + Math.random() * 9000);
      if (inp) inp.value = code;
    }
    if (!window.qaafCloudPromoCodes) window.qaafCloudPromoCodes = {};
    window.qaafCloudPromoCodes[code] = { active: true, createdAt: Date.now() };
    fetch(getFbBase() + "/qaaf_promo_codes/" + encodeURIComponent(code) + ".json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true, createdAt: Date.now() })
    }).catch(function() {});
    if (typeof showSyncToast === "function") showSyncToast("Promo Code '" + code + "' saved & live!");
  };

  function runAllV55Enhancements() {
    setupCleanHeaderSearchAndMobileLens();
    updateParentModalSafely();
    injectBottomNavBar();
    enhanceRealLeftSidebarDrawer();
    injectAdminManualProAndCodeBox();
  }

  pullPromoCodesFromCloud();
  setTimeout(runAllV55Enhancements, 60);
  setTimeout(runAllV55Enhancements, 400);
})();

// === SECTION 7: STRICT FOOTER & PROMO BAR MUTUAL EXCLUSIVITY ===
(function initStrictFooterAndPromoBarSwitcher() {
  /* 1. Inject solid opaque CSS so nothing EVER bleeds behind #qaafMobileBottomNav */
  if (!document.getElementById("qaafV58SolidFooterCss")) {
    var st = document.createElement("style");
    st.id = "qaafV58SolidFooterCss";
    st.textContent = [
      "#qaafMobileBottomNav {",
      "  background: #090d14 !important;",
      "  background-color: #090d14 !important;",
      "  backdrop-filter: none !important;",
      "  -webkit-backdrop-filter: none !important;",
      "  border-top: 1px solid #1e293b !important;",
      "  z-index: 160 !important;",
      "}",
      /* When Bottom Nav is visible (default), completely hide #regionalPromoBar so it NEVER moves behind it */
      "body:not(.qaaf-show-promo-only) #regionalPromoBar {",
      "  display: none !important;",
      "  visibility: hidden !important;",
      "  opacity: 0 !important;",
      "  pointer-events: none !important;",
      "}",
      /* When scrolling down (.qaaf-show-promo-only), completely hide #qaafMobileBottomNav and show #regionalPromoBar */
      "body.qaaf-show-promo-only #qaafMobileBottomNav {",
      "  display: none !important;",
      "  visibility: hidden !important;",
      "  opacity: 0 !important;",
      "  pointer-events: none !important;",
      "}"
    ].join("\n");
    document.head.appendChild(st);
  }

  function setFooterMode(showPromoInsteadOfNav) {
    var botNav = document.getElementById("qaafMobileBottomNav");
    var promoBar = document.getElementById("regionalPromoBar");
    var catBar = document.getElementById("categoryBar");
    var pModal = document.getElementById("playerModal");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var isWatchingFull = pModal && !pModal.classList.contains("hidden") && scrollWrap && !scrollWrap.classList.contains("hidden");

    if (isWatchingFull) {
      document.body.classList.add("qaaf-show-promo-only");
      if (botNav) botNav.style.setProperty("display", "none", "important");
      if (promoBar) promoBar.style.setProperty("display", "none", "important");
      return;
    }

    if (showPromoInsteadOfNav) {
      /* User is scrolling DOWN: Hide Home/Shorts/Games/You bar, Show Sponsor/Promo Bar */
      document.body.classList.add("qaaf-show-promo-only");
      if (catBar) catBar.classList.add("qaaf-bar-autohidden");
      if (botNav) {
        botNav.classList.add("qaaf-nav-autohidden");
        botNav.style.setProperty("display", "none", "important");
      }
      if (promoBar && !promoBar.classList.contains("hidden")) {
        promoBar.style.removeProperty("display");
      }
    } else {
      /* User is at TOP or scrolled UP: Hide Sponsor/Promo Bar completely, Show Home/Shorts/Games/You bar */
      document.body.classList.remove("qaaf-show-promo-only");
      if (catBar && !document.body.classList.contains("qaaf-games-mode-active")) {
        catBar.classList.remove("qaaf-bar-autohidden");
      }
      if (promoBar) {
        promoBar.style.setProperty("display", "none", "important");
      }
      if (botNav) {
        botNav.classList.remove("qaaf-nav-autohidden");
        botNav.style.setProperty("display", "flex", "important");
        botNav.style.setProperty("background-color", "#090d14", "important");
      }
    }
  }

  /* 2. Track both scroll and touch swipe on window & document */
  var lastY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  function handleAnyScroll() {
    var curY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (curY < 40) {
      setFooterMode(false);
    } else if (curY > lastY + 8 && curY > 55) {
      setFooterMode(true);
    } else if (curY < lastY - 8) {
      setFooterMode(false);
    }
    lastY = curY;
  }

  window.addEventListener("scroll", handleAnyScroll, { passive: true, capture: true });
  document.addEventListener("scroll", handleAnyScroll, { passive: true, capture: true });

  var touchStartY = 0;
  window.addEventListener("touchstart", function(e) {
    if (e.touches && e.touches.length > 0) {
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener("touchmove", function(e) {
    if (!e.touches || e.touches.length === 0) return;
    var dy = touchStartY - e.touches[0].clientY;
    var curY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (dy > 18 && curY > 40) {
      /* Finger swiping UP (scrolling DOWN the page) */
      setFooterMode(true);
    } else if (dy < -18 || curY < 35) {
      /* Finger swiping DOWN (scrolling UP the page) */
      setFooterMode(false);
    }
  }, { passive: true });

  setTimeout(function() { setFooterMode(false); }, 120);
})();

  // Guarantee Bottom Nav Shorts button, Shorts Shelf Heading, and Short Card Badges ALWAYS display the unified single-line 'S' icon
  (function qaafEnforceUnifiedShortsIcon() {
    var sHdr = '<svg viewBox="0 0 24 24" class="w-4 h-4 text-white shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M14.2 8.6C14.2 7 9.8 7 9.8 9.2C9.8 11.3 14.2 11.7 14.2 14.2C14.2 16.5 9.8 16.5 9.8 14.8"/></svg>';
    var sBdg = '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-white shrink-0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M14.2 8.6C14.2 7 9.8 7 9.8 9.2C9.8 11.3 14.2 11.7 14.2 14.2C14.2 16.5 9.8 16.5 9.8 14.8"/></svg>';

    function upgradeShortsShelfDomNow() {
      var shelf = document.getElementById("qaafShortsShelf");
      if (!shelf) return;

      /* 1. Heading icon box before h3 */
      var h3 = shelf.querySelector("h3");
      if (h3 && h3.previousElementSibling) {
        var iconBox = h3.previousElementSibling;
        if (!iconBox.getAttribute("data-qaaf-s-icon")) {
          iconBox.setAttribute("data-qaaf-s-icon", "1");
          iconBox.className = "bg-[#164e3a] border border-emerald-400/50 text-white w-7 h-7 rounded-lg flex items-center justify-center shadow shrink-0";
          iconBox.innerHTML = sHdr;
        }
      }

      /* 2. Every Short Card top-left badge */
      shelf.querySelectorAll("a > span").forEach(function(badge) {
        if (!badge.getAttribute("data-qaaf-s-icon")) {
          badge.setAttribute("data-qaaf-s-icon", "1");
          badge.className = "absolute top-2.5 left-2.5 bg-[#164e3a] border border-emerald-400/40 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow";
          badge.innerHTML = sBdg + "<span>Short</span>";
        }
      });
    }

    var prevRVN = window.renderVideosNow;
    if (typeof prevRVN === "function") {
      window.renderVideosNow = function() {
        var res = prevRVN.apply(this, arguments);
        upgradeShortsShelfDomNow();
        return res;
      };
    }

    setTimeout(upgradeShortsShelfDomNow, 50);
    setInterval(upgradeShortsShelfDomNow, 400);
  })();

// === QAAF 100% HONEST REAL IN-APP VIEWS ENGINE ===
(function initQaafHonestRealViewsEngine() {
  window.qaafRealViewsMap = JSON.parse(localStorage.getItem("qaaf_real_inapp_views_map") || "{}");

  window.addEventListener("message", function(ev) {
    var d = ev && ev.data;
    if (d === "QAAF_EXIT_GAMES" || (d && (d.type === "QAAF_EXIT_GAMES" || d.action === "QAAF_EXIT_GAMES"))) {
      if (typeof window.closeQaafExternalGamePage === "function") window.closeQaafExternalGamePage();
      if (typeof window.closeInstalledGameModal === "function") window.closeInstalledGameModal();
    }
  });

  window.getQaafRealViewCount = function(videoObj) {
    if (!videoObj) return 0;
    var key = videoObj.ytId || videoObj.id || "";
    var fromMap = key && window.qaafRealViewsMap[key] ? parseInt(window.qaafRealViewsMap[key], 10) : 0;
    var fromProp = videoObj.realViews ? parseInt(videoObj.realViews, 10) : 0;
    var count = Math.max(fromMap || 0, fromProp || 0);
    return count > 0 ? count : 0;
  };

  window.formatQaafRealViews = function(videoObj) {
    var c = window.getQaafRealViewCount(videoObj);
    if (c === 1) return "1 view";
    if (c < 1000) return c + " views";
    return (c / 1000).toFixed(1).replace(/\.0$/, "") + "K views";
  };

  window.incrementQaafRealView = function(videoObj) {
    if (!videoObj) return;
    var key = videoObj.ytId || videoObj.id || "";
    if (!key) return;
    var nextCount = window.getQaafRealViewCount(videoObj) + 1;
    window.qaafRealViewsMap[key] = nextCount;
    videoObj.realViews = nextCount;
    videoObj.views = nextCount;
    localStorage.setItem("qaaf_real_inapp_views_map", JSON.stringify(window.qaafRealViewsMap));
    try {
      localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    } catch (e) {}
    if (window.qaafCloudSync && typeof window.qaafCloudSync.pushState === "function") {
      setTimeout(function() {
        window.qaafCloudSync.pushState("Incremented Real Video View");
      }, 600);
    }
  };

  if (window.qaafCloudSync) {
    var origGetP = window.qaafCloudSync.getStatePayload.bind(window.qaafCloudSync);
    window.qaafCloudSync.getStatePayload = function() {
      var data = origGetP();
      data.realViewsMapJson = JSON.stringify(window.qaafRealViewsMap || {});
      return data;
    };

    var origAppS = window.qaafCloudSync.applyIncomingState.bind(window.qaafCloudSync);
    window.qaafCloudSync.applyIncomingState = function(payload, source) {
      if (payload && payload.realViewsMapJson && typeof payload.realViewsMapJson === "string") {
        try {
          var cloudViews = JSON.parse(payload.realViewsMapJson);
          Object.keys(cloudViews || {}).forEach(function(k) {
            var cv = parseInt(cloudViews[k], 10) || 0;
            var lv = parseInt(window.qaafRealViewsMap[k], 10) || 0;
            window.qaafRealViewsMap[k] = Math.max(cv, lv);
          });
          localStorage.setItem("qaaf_real_inapp_views_map", JSON.stringify(window.qaafRealViewsMap));
        } catch (e) {}
      }
      return origAppS(payload, source);
    };
  }

  function scrubLegacyFakeViews() {
    if (!Array.isArray(window.videosData)) return;
    window.videosData.forEach(function(v) {
      if (!v) return;
      v.views = window.getQaafRealViewCount(v);
    });
  }
  scrubLegacyFakeViews();
  setTimeout(function() {
    scrubLegacyFakeViews();
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
  }, 300);
})();

// === QAAF V98 UNIFIED CLEAN MASTER (ZERO FLICKER) ===
(function initQaafV98UnifiedCleanMaster() {
  var FB_BASE = (localStorage.getItem("qaaf_firebase_db_url") || "https://qaaftube-6f251-default-rtdb.firebaseio.com").replace(/\/+$/, "");
  var ANALYTICS_FB_URL = FB_BASE + "/qaaf_analytics_db.json";
  var ANALYTICS_CACHE_KEY = "qaaf_analytics_cache_v1";

  var YT_LIKE_OUTLINE_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2717\x27 height=\x2717\x27 fill=\x27none\x27 stroke=\x27currentColor\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27 style=\x27display:inline-block;vertical-align:middle;\x27><path d=\x27M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3\x27/></svg>";
  var YT_LIKE_FILLED_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2717\x27 height=\x2717\x27 fill=\x27#10b981\x27 stroke=\x27#10b981\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27 style=\x27display:inline-block;vertical-align:middle;\x27><path d=\x27M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3\x27/></svg>";
  var YT_SHARE_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2717\x27 height=\x2717\x27 fill=\x27currentColor\x27 style=\x27display:inline-block;vertical-align:middle;\x27><path d=\x27M15 5.63 20.66 12 15 18.37V14h-1c-3.96 0-7.14 1-9.75 3.09 1.84-4.07 5.11-6.4 9.89-7.1l.86-.13V5.63M14 3v6C6.22 10.13 3.11 15.33 2 21c2.78-3.97 6.44-6 12-6v6l8-9-8-9z\x27/></svg>";

  if (!document.getElementById("qaafV98MasterCss")) {
    var st = document.createElement("style");
    st.id = "qaafV98MasterCss";
    st.textContent = [
      "#shortsSideNav, #qaafMinimalTopLeftClose, #qaafCenterRedVolOverlay { display: none !important; }",
      "header { z-index: 65 !important; }",
      "body.qaaf-player-open { overflow: hidden !important; touch-action: pan-y; }",
      "#qaafLeftSidebarBackdrop { z-index: 205 !important; }",
      "#qaafLeftSidebarDrawer { z-index: 210 !important; top: 0 !important; bottom: 0 !important; height: 100dvh !important; max-height: 100dvh !important; }",
      "#flagVideoModal, #playlistSelectorModal, #sponsorContactModal, #accountModal { z-index: 1200 !important; }",
      "#adminDashboardModal, #userNotifModal { z-index: 1150 !important; }",
      ".qaaf-yt-clean-card span.bottom-2.right-2:empty { display: none !important; }",
      "body.qaaf-light-mode, body.qaaf-light-mode.bg-islamic-family, body.qaaf-light-mode.bg-islamic-kids { background-color: #f8fafc !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #mainHeader { background-color: rgba(255,255,255,0.97) !important; border-bottom: 1px solid #cbd5e1 !important; }",
      "body.qaaf-light-mode #brandMainPrefix { color: #0f172a !important; }",
      "body.qaaf-light-mode #headerDrawerMenuBtn { background-color: #e2e8f0 !important; color: #0f172a !important; border-color: #94a3b8 !important; }",
      "body.qaaf-light-mode #qaafHeaderSearchToggleBtn svg circle, body.qaaf-light-mode #qaafHeaderSearchToggleBtn svg line { stroke: #0f172a !important; }",
      "body.qaaf-light-mode #qaafHeaderSearchToggleBtn svg text { fill: #0f172a !important; }",
      "body.qaaf-light-mode #qaafHeaderCenterSearch > div { background-color: #f1f5f9 !important; border-color: #cbd5e1 !important; }",
      "body.qaaf-light-mode #qaafHeaderSearchInput { color: #0f172a !important; }",
      "body.qaaf-light-mode #categoryBar { background-color: rgba(255,255,255,0.96) !important; border-bottom: 1px solid #cbd5e1 !important; }",
      "body.qaaf-light-mode #categoryBar .cat-chip:not(.bg-emerald-500) { background-color: #e2e8f0 !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #videoGrid h3 { color: #0f172a !important; }",
      "body.qaaf-light-mode #videoGrid .text-slate-400 { color: #475569 !important; }",
      "body.qaaf-light-mode #qaafShortsShelf h3 { color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafChannelViewHeaderBox { background: #ffffff !important; border-color: #cbd5e1 !important; }",
      "body.qaaf-light-mode #qaafChannelViewHeaderBox h2 { color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafMobileBottomNav { background: #ffffff !important; background-color: #ffffff !important; border-top: 1px solid #cbd5e1 !important; }",
      "body.qaaf-light-mode #qaafMobileBottomNav button { color: #475569 !important; }",
      "body.qaaf-light-mode #qaafMobileBottomNav button.text-white { color: #164e3a !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer { background-color: #ffffff !important; border-right: 1px solid #cbd5e1 !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer > div:first-child { background: #f1f5f9 !important; border-bottom: 1px solid #cbd5e1 !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer h3, body.qaaf-light-mode #qaafLeftSidebarDrawer button { color: #0f172a !important; }"
    ].join("\n");
    document.head.appendChild(st);
  }

  window.saveUserPersonalDataToCloud = function() {
    if (!currentUserEmail) return;
    var k = currentUserEmail.toLowerCase().trim();
    window.registeredUsersMap = window.registeredUsersMap || {};
    var uObj = window.registeredUsersMap[k]; if (!uObj) return;
    uObj.favorites = favoriteVideoIds || []; uObj.parentHistory = window.parentHistoryIds || []; uObj.kidsHistory = window.kidsHistoryIds || []; uObj.pin = parentPin || "123456";
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    if (typeof window.syncQaafUsersWithCloudNow === "function") window.syncQaafUsersWithCloudNow(false);
  };
  window.restoreUserPersonalDataFromCloud = function(emailStr) {
    if (!emailStr || !window.registeredUsersMap) return;
    var uObj = window.registeredUsersMap[emailStr.toLowerCase().trim()]; if (!uObj) return;
    if (Array.isArray(uObj.favorites) && uObj.favorites.length) { favoriteVideoIds = uObj.favorites; localStorage.setItem("qaaf_favorites", JSON.stringify(favoriteVideoIds)); }
    if (Array.isArray(uObj.parentHistory) && uObj.parentHistory.length) { window.parentHistoryIds = uObj.parentHistory; localStorage.setItem("qaaf_parent_history", JSON.stringify(window.parentHistoryIds)); }
    if (Array.isArray(uObj.kidsHistory) && uObj.kidsHistory.length) { window.kidsHistoryIds = uObj.kidsHistory; localStorage.setItem("qaaf_kids_history", JSON.stringify(window.kidsHistoryIds)); }
    if (uObj.pin && String(uObj.pin).length === 6) { parentPin = String(uObj.pin); localStorage.setItem("qaaf_parent_pin_6", parentPin); }
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
  };
  var origOpenKids = window.openKidsLockOrTimer;
  window.openKidsLockOrTimer = function() {
    if (!isKidsLocked && !currentUserEmail) { openAccountModal("Please Sign In or Continue with Gmail to use Kids Mode & PIN!"); return; }
    if (origOpenKids) return origOpenKids.apply(this, arguments);
  };
  window.toggleKidsMode = function() { window.openKidsLockOrTimer(); };

  window.completeGoogleQuickSignIn = function(directEmail) {
    var inp = document.getElementById("googleQuickEmailInput"); var mainInp = document.getElementById("userEmailInput");
    var em = String(directEmail || (inp && inp.value) || (mainInp && mainInp.value) || "").trim().toLowerCase();
    if (!em || em.indexOf("@") === -1) { alert("Please enter your Gmail address."); return; }
    if (em === "qaaftube@gmail.com" || em === "adminqaaftube") { alert("Admin must sign in using Admin Password below."); return; }
    localStorage.setItem("qaaf_last_gmail_email", em);
    window.registeredUsersMap = window.registeredUsersMap || {};
    if (!window.registeredUsersMap[em]) window.registeredUsersMap[em] = { name: em.split("@")[0], userKey: em, email: em, pass: "GoogleAuth_" + em.split("@")[0], recWord: "makkah", pin: parentPin || "123456", authProvider: "Google", isPro: false, createdAt: new Date().toLocaleDateString() };
    parentPin = window.registeredUsersMap[em].pin || parentPin || "123456";
    localStorage.setItem("qaaf_parent_pin_6", parentPin); localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    localStorage.removeItem("qaaf_admin_verified_v3"); currentUserEmail = em; localStorage.setItem("qaaf_user_email", currentUserEmail);
    window.restoreUserPersonalDataFromCloud(em); window.saveUserPersonalDataToCloud(); syncAccountUI(); closeAccountModal();
    if (typeof showSyncToast === "function") showSyncToast("🎉 Signed in as " + em);
  };

  window.signInWithGoogleAccount = function() {
    var oldPin = document.getElementById("googleQuickPinInput"); if (oldPin) oldPin.remove();
    var gBox = document.getElementById("googleQuickAuthBox");
    if (!gBox) { gBox = document.createElement("div"); gBox.id = "googleQuickAuthBox"; var btn = document.getElementById("googleSignInBtn"); if (btn && btn.parentNode) btn.parentNode.insertBefore(gBox, btn.nextSibling); }
    gBox.className = "bg-[#141822] border-2 border-blue-500/60 rounded-2xl p-3.5 mb-3 space-y-2.5 text-left shadow-2xl";
    var knownEmails = []; var lastGm = localStorage.getItem("qaaf_last_gmail_email"); if (lastGm) knownEmails.push(lastGm);
    Object.keys(window.registeredUsersMap || {}).forEach(function(k){ if (k.indexOf("@gmail.com") !== -1 && knownEmails.indexOf(k) === -1) knownEmails.push(k); });
    var accButtons = knownEmails.slice(0, 3).map(function(em) {
      return "<button type=\x27button\x27 data-em=\x27" + em + "\x27 onclick=\x27window.completeGoogleQuickSignIn(this.getAttribute(\x22data-em\x22))\x27 class=\x27w-full bg-black/80 hover:bg-blue-950/70 border border-slate-700 rounded-xl p-2 flex items-center justify-between cursor-pointer\x27><span class=\x27text-xs font-bold text-white truncate\x27>🔵 " + em + "</span><span class=\x27text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-extrabold shrink-0\x27>1-Tap ➔</span></button>";
    }).join("");
    gBox.innerHTML = (accButtons ? ("<div class=\x27space-y-1.5\x27>" + accButtons + "</div>") : "") + "<div class=\x27flex gap-1.5\x27><input id=\x27googleQuickEmailInput\x27 type=\x27email\x27 placeholder=\x27yourname@gmail.com\x27 class=\x27flex-1 bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white\x27 /><button type=\x27button\x27 onclick=\x27window.completeGoogleQuickSignIn()\x27 class=\x27bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer\x27>Continue</button></div>";
    gBox.classList.remove("hidden");
  };

  window.setQaafUrlTag = function(paramsObj, pageTitle) {
    try {
      var url = new URL(window.location.href);
      ["watch", "shorts", "game", "category", "channel", "tab"].forEach(function(k){ url.searchParams.delete(k); });
      if (paramsObj) Object.keys(paramsObj).forEach(function(k){ if (paramsObj[k]) url.searchParams.set(k, paramsObj[k]); });
      window.history.replaceState({}, pageTitle || document.title, url.pathname + url.search);
    } catch(e) {}
  };
  window.shareQaafCurrentVideo = function(e) {
    if (e) e.stopPropagation();
    var v = (videosData || []).find(function(x){ return x && x.id === currentPlayingVideoId; });
    var isSh = v && isVideoShort(v);
    var shareUrl = window.location.origin + window.location.pathname + "?" + (isSh ? "shorts" : "watch") + "=" + encodeURIComponent((v && v.id) || currentPlayingVideoId || "");
    if (navigator.share) navigator.share({ title: (v && v.title) || "QAAF Tube", url: shareUrl }).catch(function(){});
    if (navigator.clipboard) navigator.clipboard.writeText(shareUrl).catch(function(){});
    if (typeof showSyncToast === "function") showSyncToast("🔗 Link Copied!");
  };
  window.shareCurrentShort = window.shareQaafCurrentVideo;

  window.getSmartRelatedVideos = function(currentVidId, wantShortsOnly) {
    var cur = (videosData || []).find(function(v){ return v && v.id === currentVidId; });
    var histIds = (typeof getActiveHistory === "function") ? (getActiveHistory() || []) : [];
    var blockedSet = new Set(blockedVideoIds || []), bannedSet = new Set(bannedChannels || []);
    var chFreq = {}, catFreq = {};
    histIds.forEach(function(id, idx) { var hv = (videosData || []).find(function(x){ return x && x.id === id; }); if (hv) { if (hv.channel) chFreq[hv.channel] = (chFreq[hv.channel]||0) + (idx<8?3:1); if (hv.category) catFreq[hv.category] = (catFreq[hv.category]||0) + 1; } });
    var candidates = (videosData || []).filter(function(v) {
      if (!v || v.id === currentVidId || blockedSet.has(v.id) || bannedSet.has(v.channel)) return false;
      if (isKidsLocked && !v.kidsSafe) return false;
      var isSh = isVideoShort(v); return wantShortsOnly ? isSh : !isSh;
    });
    var scored = candidates.map(function(v) {
      var s = 0;
      if (cur) { if (v.channel === cur.channel) s += 120; if (v.category === cur.category) s += 95; if (v.lang === cur.lang) s += 55; }
      if (chFreq[v.channel]) s += Math.min(50, chFreq[v.channel] * 10);
      if (catFreq[v.category]) s += Math.min(35, catFreq[v.category] * 7);
      return { video: v, score: s };
    });
    scored.sort(function(a, b){ return b.score - a.score; });
    var out = [], chC = {};
    scored.forEach(function(it){ var c = it.video.channel||"G"; chC[c]=(chC[c]||0)+1; if (chC[c]<=4) out.push(it.video); });
    return out.length ? out : scored.map(function(x){ return x.video; });
  };

  window.filterUpNextByMode = function(mode) {
    var cur = (videosData || []).find(function(x){ return x && x.id === currentPlayingVideoId; });
    var upNextGrid = document.getElementById("watchUpNextGrid"); if (!upNextGrid || !cur) return;
    var list = (mode === "channel") ? (videosData || []).filter(function(v){ return v && v.id !== cur.id && v.channel === cur.channel && !isVideoShort(v); }) : window.getSmartRelatedVideos(cur.id, false);
    upNextGrid.innerHTML = "";
    list.slice(0, 14).forEach(function(v) {
      var thumb = v.customThumb || ("https://i.ytimg.com/vi/" + v.ytId + "/hqdefault.jpg");
      var vStr = (typeof window.formatQaafRealViews === "function") ? window.formatQaafRealViews(v) : ((v.realViews || 0) + " views");
      var durStr = (v.duration && v.duration !== "12:00" && v.duration !== "12:45" && v.duration !== "14:20" && v.duration !== "10:00") ? v.duration : "";
      var a = document.createElement("a"); if (!isKidsLocked) a.href = "?watch=" + encodeURIComponent(v.id);
      a.onclick = function(e){ return handleQaafVideoLinkClick(e, v.id); };
      a.className = "bg-[#181818] hover:bg-[#222] rounded-xl overflow-hidden border border-white/10 flex sm:flex-col gap-2.5 p-2 sm:p-0 cursor-pointer transition group no-underline text-inherit";
      a.innerHTML = "<div class=\x27relative w-36 sm:w-full aspect-video bg-slate-900 rounded-lg sm:rounded-none overflow-hidden shrink-0 pointer-events-none\x27><img src=\x27" + thumb + "\x27 alt=\x27\x27 class=\x27absolute inset-0 w-full h-full object-cover\x27 loading=\x27lazy\x27 />" + (durStr ? "<span class=\x27absolute bottom-1 right-1 bg-black/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded\x27>" + durStr + "</span>" : "") + "</div><div class=\x27p-1 sm:p-2.5 min-w-0 flex-1\x27><h5 class=\x27text-xs font-bold text-white line-clamp-2 leading-snug\x27>" + v.title + "</h5><p class=\x27text-[10px] text-slate-400 mt-1 truncate\x27>✅ " + v.channel + " • " + vStr + "</p></div>";
      upNextGrid.appendChild(a);
    });
  };

  window.qaafShortsQueue = []; window.qaafShortsIdx = 0; window.qaafShortPlaying = true; window.qaafShortMuted = false;
  function sendYtCmd(f, a) { var ifr = document.getElementById("ytIframe"); if (ifr && ifr.contentWindow) ifr.contentWindow.postMessage(JSON.stringify({ event: "command", func: f, args: a || [] }), "*"); }
  window.toggleQaafShortPlayPause = function(e) { if(e)e.stopPropagation(); window.qaafShortPlaying=!window.qaafShortPlaying; sendYtCmd(window.qaafShortPlaying?"playVideo":"pauseVideo"); };
  window.openShortCommentsPopup = function(e) { if(e)e.stopPropagation(); var sw=document.getElementById("ytWatchScrollContainer"); if(sw){sw.classList.toggle("hidden"); sw.style.cssText="position:absolute;inset:auto 0 0 0;max-height:55%;background:#12161f;z-index:60;overflow-y:auto;padding:12px;border-radius:20px 20px 0 0;";} };
  window.playAdjacentShort = function(dir) {
    if (!window.qaafShortsQueue.length) { var rel = window.getSmartRelatedVideos(currentPlayingVideoId, true); window.qaafShortsQueue = [currentPlayingVideoId].concat(rel.map(function(v){return v.id;})); window.qaafShortsIdx = 0; }
    if (window.qaafShortsQueue.length <= 1) return;
    window.qaafShortsIdx = (window.qaafShortsIdx + (dir >= 0 ? 1 : -1) + window.qaafShortsQueue.length) % window.qaafShortsQueue.length;
    openVideoPlayer(window.qaafShortsQueue[window.qaafShortsIdx]);
  };

  function renderFourWatchButtonsAndShortsPill() {
    var hdr = document.getElementById("ytCleanWatchHeader");
    if (hdr) {
      var spPill = document.getElementById("qaafWatchActionSettingsPill");
      if (spPill) spPill.remove();
      var duaBtn = hdr.querySelector("button[onclick*=\x27triggerAdSimulation\x27]");
      if (duaBtn) {
        duaBtn.removeAttribute("onclick");
        duaBtn.onclick = function(ev) { window.shareQaafCurrentVideo(ev); };
        duaBtn.className = "bg-[#272727] hover:bg-[#383838] text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer";
        duaBtn.innerHTML = YT_SHARE_SVG + "<span class=\x22text-[11px] text-neutral-200\x22>Share</span>";
      }
      var isFavW = (favoriteVideoIds || []).indexOf(currentPlayingVideoId) !== -1;
      var likeBtn = hdr.querySelector("button[onclick*=\x27toggleFavoriteVideo\x27]");
      if (likeBtn) {
        var stW = isFavW ? "liked" : "unliked";
        if (likeBtn.getAttribute("data-like-state") !== stW) {
          likeBtn.setAttribute("data-like-state", stW);
          likeBtn.className = "bg-[#272727] hover:bg-[#383838] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer";
          likeBtn.innerHTML = (isFavW ? YT_LIKE_FILLED_SVG : YT_LIKE_OUTLINE_SVG) + "<span class=\x22text-[11px] " + (isFavW ? "text-emerald-400 font-bold" : "text-neutral-200") + "\x22>" + (isFavW ? "Liked" : "Like") + "</span>";
        }
      }
    }

    var modal = document.getElementById("playerModal");
    if (!modal || modal.classList.contains("hidden")) return;
    var video = (videosData || []).find(function(x) { return x && x.id === currentPlayingVideoId; });
    var ov = document.getElementById("qaafYtShortsMasterOverlay");
    if (video && isVideoShort(video) && ov) {
      var isFavS = (favoriteVideoIds || []).indexOf(video.id) !== -1;
      var stKey = video.id + "_" + (isFavS ? "1" : "0");
      if (ov.getAttribute("data-v98-state") !== stKey) {
        ov.setAttribute("data-v98-state", stKey);
        ov.style.cssText = "position:absolute; right:4px; bottom:8px; top:auto; left:auto; width:58px; height:auto; z-index:46; background:#0c0f14; border:1px solid rgba(255,255,255,0.14); border-radius:30px; padding:12px 4px; display:flex; flex-direction:column; align-items:center; gap:14px; pointer-events:auto; box-shadow:0 8px 28px rgba(0,0,0,0.95);";
        ov.innerHTML =
          "<div style=\x27display:flex;flex-direction:column;align-items:center;gap:3px;\x27>" +
            "<button type=\x27button\x27 onclick=\x27toggleFavoriteVideo(currentPlayingVideoId,event)\x27 style=\x27width:42px;height:42px;border-radius:999px;background:rgba(255,255,255,0.1);color:#fff;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.18);cursor:pointer;\x27>" + (isFavS ? YT_LIKE_FILLED_SVG : YT_LIKE_OUTLINE_SVG) + "</button>" +
            "<span style=\x27font-size:10px;font-weight:700;color:#fff;\x27>" + (isFavS ? "Liked" : "Like") + "</span>" +
          "</div>" +
          "<div style=\x27display:flex;flex-direction:column;align-items:center;gap:3px;\x27>" +
            "<button type=\x27button\x27 onclick=\x27openShortCommentsPopup(event)\x27 style=\x27width:42px;height:42px;border-radius:999px;background:rgba(255,255,255,0.1);color:#fff;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.18);cursor:pointer;\x27><svg viewBox=\x270 0 24 24\x27 width=\x2717\x27 height=\x2717\x27 fill=\x27none\x27 stroke=\x27currentColor\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27><path d=\x27M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\x27/></svg></button>" +
            "<span style=\x27font-size:10px;font-weight:700;color:#fff;\x27>Comment</span>" +
          "</div>" +
          "<div style=\x27display:flex;flex-direction:column;align-items:center;gap:3px;\x27>" +
            "<button type=\x27button\x27 onclick=\x27shareQaafCurrentVideo(event)\x27 style=\x27width:42px;height:42px;border-radius:999px;background:rgba(255,255,255,0.1);color:#fff;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.18);cursor:pointer;\x27>" + YT_SHARE_SVG + "</button>" +
            "<span style=\x27font-size:10px;font-weight:700;color:#fff;\x27>Share</span>" +
          "</div>";
      }
    }
  }

  function applySingleUnifiedPlayerLayout(video) {
    var modal = document.getElementById("playerModal"), box = document.getElementById("playerModalBox"), aspect = document.getElementById("playerAspectBox"), scrollWrap = document.getElementById("ytWatchScrollContainer");
    if (!modal || !box || !aspect || !video || modal.classList.contains("qaaf-mini-player")) return;
    document.body.classList.add("qaaf-player-open");
    var hdr = document.querySelector("header"); var hdrH = (hdr && hdr.offsetHeight) ? hdr.offsetHeight : 48;
    var isSh = isVideoShort(video);
    var ov = document.getElementById("qaafYtShortsMasterOverlay"), peek = document.getElementById("qaafNextShortPeekCard"), gestureZone = document.getElementById("qaafShortsSwipeGestureZone");

    if (!isSh) {
      modal.classList.remove("qaaf-shorts-mode");
      if (ov) ov.style.display = "none";
      if (peek) peek.style.display = "none";
      if (gestureZone) gestureZone.style.display = "none";
      modal.style.cssText = "position:fixed; top:" + hdrH + "px; left:0; right:0; bottom:0; height:calc(100dvh - " + hdrH + "px); z-index:55; background:#0f0f0f; display:flex; flex-direction:column; overflow:hidden; padding:0; margin:0;";
      box.style.cssText = "width:100%; max-width:960px; height:100%; margin:0 auto; background:#0f0f0f; display:flex; flex-direction:column; overflow:hidden; border-radius:0;";
      aspect.style.cssText = "position:relative; width:100%; aspect-ratio:16/9; max-height:42vh; background:#000; flex:0 0 auto; overflow:hidden; display:block;";
      if (scrollWrap) { scrollWrap.classList.remove("hidden"); scrollWrap.style.cssText = "flex:1 1 auto; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:12px 14px 90px 14px; background:#0f0f0f;"; }
      renderFourWatchButtonsAndShortsPill();
      var upNextGrid = document.getElementById("watchUpNextGrid");
      if (upNextGrid && upNextGrid.parentNode) {
        var bar = document.getElementById("qaafUpNextFilterPillsBar");
        if (!bar) {
          bar = document.createElement("div"); bar.id = "qaafUpNextFilterPillsBar";
          bar.className = "flex items-center gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar";
          upNextGrid.parentNode.insertBefore(bar, upNextGrid);
        }
        bar.innerHTML = "<button id=\x27qaafUpNextPill_all\x27 type=\x27button\x27 onclick=\x27filterUpNextByMode(\x22all\x22)\x27 class=\x27px-3 py-1 rounded-lg text-xs font-extrabold bg-white text-black cursor-pointer shrink-0\x27>All</button>" +
          "<button id=\x27qaafUpNextPill_channel\x27 type=\x27button\x27 onclick=\x27filterUpNextByMode(\x22channel\x22)\x27 class=\x27px-3 py-1 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0\x27>From " + (video.channel || "Channel") + "</button>" +
          "<button id=\x27qaafUpNextPill_related\x27 type=\x27button\x27 onclick=\x27filterUpNextByMode(\x22related\x22)\x27 class=\x27px-3 py-1 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0\x27>Related</button>";
      }
      window.filterUpNextByMode("all");
      return;
    }

    window.qaafShortPlaying = true;
    if (window.qaafShortsQueue.indexOf(video.id) === -1) {
      var rel = window.getSmartRelatedVideos(video.id, true);
      window.qaafShortsQueue = [video.id].concat(rel.map(function(v){ return v.id; }));
      window.qaafShortsIdx = 0;
    }
    modal.classList.add("qaaf-shorts-mode");
    modal.style.cssText = "position:fixed; top:" + hdrH + "px; left:0; right:0; bottom:0; height:calc(100dvh - " + hdrH + "px); z-index:55; background:rgba(10,12,16,0.98); display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding-top:6px; overflow:hidden;";
    modal.onclick = function(ev){ if (ev.target === modal) closeVideoPlayer(); };
    if (scrollWrap) scrollWrap.classList.add("hidden");
    box.style.cssText = "width:auto; height:calc(100dvh - " + (hdrH + 54) + "px); flex:0 0 calc(100dvh - " + (hdrH + 54) + "px); aspect-ratio:9/16; max-width:94vw; background:#000; border-radius:16px; overflow:hidden; position:relative; display:flex; flex-direction:column;";
    aspect.style.cssText = "position:relative; width:100%; height:100%; flex:1 1 auto; background:#000; overflow:hidden; display:block;";

    if (!ov) { ov = document.createElement("div"); ov.id = "qaafYtShortsMasterOverlay"; aspect.appendChild(ov); }
    ov.removeAttribute("data-v98-state");
    renderFourWatchButtonsAndShortsPill();

    if (!gestureZone) {
      gestureZone = document.createElement("div");
      gestureZone.id = "qaafShortsSwipeGestureZone";
      aspect.appendChild(gestureZone);
      var tStartY = 0, tCurY = 0, isSwiping = false, touchMoved = false;
      gestureZone.addEventListener("touchstart", function(e) {
        if (!e.touches || e.touches.length !== 1) return;
        tStartY = e.touches[0].clientY; tCurY = tStartY; isSwiping = true; touchMoved = false;
      }, { passive: true });
      gestureZone.addEventListener("touchmove", function(e) {
        if (!isSwiping || !e.touches || !e.touches.length) return;
        tCurY = e.touches[0].clientY;
        var dy = tCurY - tStartY;
        if (Math.abs(dy) > 10) {
          touchMoved = true;
          var b = document.getElementById("playerModalBox");
          if (b) { b.style.transition = "none"; b.style.transform = "translateY(" + Math.max(-110, Math.min(110, dy * 0.45)) + "px)"; }
        }
      }, { passive: true });
      gestureZone.addEventListener("touchend", function() {
        if (!isSwiping) return;
        isSwiping = false;
        var dy = tCurY - tStartY;
        var b = document.getElementById("playerModalBox");
        if (b) { b.style.transition = "transform 0.2s ease-out"; b.style.transform = "none"; }
        if (dy < -40) window.playAdjacentShort(1);
        else if (dy > 40) window.playAdjacentShort(-1);
        tStartY = 0; tCurY = 0;
      }, { passive: true });
      gestureZone.addEventListener("click", function(e) {
        if (touchMoved) { touchMoved = false; return; }
        window.toggleQaafShortPlayPause(e);
      });
      var lastW = 0;
      gestureZone.addEventListener("wheel", function(e) {
        var now = Date.now();
        if (now - lastW < 550) return;
        if (Math.abs(e.deltaY) > 18) { e.preventDefault(); lastW = now; window.playAdjacentShort(e.deltaY > 0 ? 1 : -1); }
      }, { passive: false });
    }
    gestureZone.style.cssText = "position:absolute; top:62px; bottom:58px; left:0; right:66px; z-index:39; display:block; background:transparent; touch-action:none; cursor:pointer;";

    var nextId = window.qaafShortsQueue[(window.qaafShortsIdx + 1) % window.qaafShortsQueue.length];
    var nextVid = (videosData || []).find(function(x){ return x && x.id === nextId && x.id !== video.id; });
    if (!peek) { peek = document.createElement("div"); peek.id = "qaafNextShortPeekCard"; modal.appendChild(peek); }
    if (nextVid) {
      var nThumb = nextVid.customThumb || ("https://i.ytimg.com/vi/" + nextVid.ytId + "/hqdefault.jpg");
      var boxW = box.getBoundingClientRect().width || 340;
      peek.style.cssText = "width:" + Math.round(boxW) + "px; height:32px; flex:0 0 32px; margin-top:8px; border-radius:14px 14px 0 0; overflow:hidden; position:relative; cursor:pointer; opacity:0.85; border-top:1px solid rgba(255,255,255,0.25);";
      peek.onclick = function(e){ e.stopPropagation(); window.playAdjacentShort(1); };
      peek.innerHTML = "<img src=\x27" + nThumb + "\x27 style=\x27width:100%;height:200px;object-fit:cover;object-position:top;\x27 />";
      peek.style.display = "block";
    } else { peek.style.display = "none"; }
  }

  var origOpenV = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    if (origOpenV) origOpenV.apply(this, arguments);
    var v = (videosData || []).find(function(x){ return x && x.id === videoId; });
    if (v) {
      var p = {}; p[isVideoShort(v) ? "shorts" : "watch"] = v.id;
      window.setQaafUrlTag(p, v.title + " — QAAF Tube");
      setTimeout(function(){ applySingleUnifiedPlayerLayout(v); }, 30);
    }
  };
  var origCloseV = window.closeVideoPlayer;
  window.closeVideoPlayer = function() {
    document.body.classList.remove("qaaf-player-open");
    if (origCloseV) origCloseV.apply(this, arguments);
    window.setQaafUrlTag(null, "QAAF Tube — Muslim Family & Kids Hub");
  };
  var origMinV = window.minimizeToMiniPlayer;
  window.minimizeToMiniPlayer = function() {
    document.body.classList.remove("qaaf-player-open");
    if (origMinV) origMinV.apply(this, arguments);
  };
  var origResetH = window.resetToHomeFeed;
  window.resetToHomeFeed = function() {
    var modal = document.getElementById("playerModal");
    if (modal && !modal.classList.contains("hidden")) window.closeVideoPlayer();
    if (origResetH) origResetH.apply(this, arguments);
  };
  var origToggleFav = window.toggleFavoriteVideo;
  window.toggleFavoriteVideo = function(videoId, ev) {
    if (origToggleFav) origToggleFav(videoId, ev);
    var ov = document.getElementById("qaafYtShortsMasterOverlay");
    if (ov) ov.removeAttribute("data-v98-state");
    renderFourWatchButtonsAndShortsPill();
  };

  function renderDrawerLightDarkBtn() {
    var extraBox = document.getElementById("qaafDrawerExtraMenuItems");
    if (!extraBox) return;
    var isLight = (localStorage.getItem("qaaf_theme_mode") === "light");
    var btn = document.getElementById("qaafThemeToggleBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "qaafThemeToggleBtn";
      btn.onclick = function(ev) { window.toggleQaafThemeMode(ev); };
      btn.className = "w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-extrabold text-white transition cursor-pointer";
      extraBox.insertBefore(btn, extraBox.firstChild);
    }
    btn.innerHTML = "<span class=\x22flex items-center gap-2.5\x22><span class=\x22text-base\x22>" + (isLight ? "🌙" : "☀️") + "</span> <span>" + (isLight ? "Dark Mode" : "Light Mode") + "</span></span><span class=\x22px-2.5 py-0.5 rounded-full text-[10px] font-extrabold " + (isLight ? "bg-slate-800 text-white" : "bg-amber-400 text-black") + "\x22>" + (isLight ? "DARK" : "LIGHT") + "</span>";
  }
  window.toggleQaafThemeMode = function(ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    var cur = localStorage.getItem("qaaf_theme_mode") || "dark";
    var next = (cur === "light") ? "dark" : "light";
    document.body.classList.toggle("qaaf-light-mode", next === "light");
    localStorage.setItem("qaaf_theme_mode", next);
    renderDrawerLightDarkBtn();
  };
  document.body.classList.toggle("qaaf-light-mode", localStorage.getItem("qaaf_theme_mode") === "light");
  setTimeout(renderDrawerLightDarkBtn, 500);

  var prevPickCh98 = window.pickChannelFromTopBar;
  window.pickChannelFromTopBar = function(chName, ev) {
    if (prevPickCh98) prevPickCh98(chName, ev);
    if (chName && chName !== "ALL") {
      var chVids = (videosData || []).filter(function(v) { return v && v.channel === chName; });
      var regCnt = chVids.filter(function(v) { return !isVideoShort(v); }).length;
      var shCnt = chVids.filter(function(v) { return isVideoShort(v); }).length;
      if (regCnt === 0 && shCnt > 0) window.switchQaafChannelSubTab("shorts");
    }
  };
})();

// === QAAF V100 SIMPLE SHARE & TARBIAH SHORTS FIX ===
(function initQaafV100SimpleShareAndChannelShortsFix() {
  var YT_LIKE_OUTLINE_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2718\x27 height=\x2718\x27 fill=\x27none\x27 stroke=\x27currentColor\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27 style=\x27display:inline-block;vertical-align:middle;\x27><path d=\x27M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3\x27/></svg>";
  var YT_LIKE_FILLED_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2718\x27 height=\x2718\x27 fill=\x27#10b981\x27 stroke=\x27#10b981\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27 style=\x27display:inline-block;vertical-align:middle;\x27><path d=\x27M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3\x27/></svg>";
  var YT_SHARE_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2718\x27 height=\x2718\x27 fill=\x27currentColor\x27 style=\x27display:inline-block;vertical-align:middle;\x27><path d=\x27M15 5.63 20.66 12 15 18.37V14h-1c-3.96 0-7.14 1-9.75 3.09 1.84-4.07 5.11-6.4 9.89-7.1l.86-.13V5.63M14 3v6C6.22 10.13 3.11 15.33 2 21c2.78-3.97 6.44-6 12-6v6l8-9-8-9z\x27/></svg>";

  // =========================================================================
  // 1. FIX TARBIAH ISLAMIC CENTRE (12 SHORTS, NO 12:45, NO FAKE 20 PLAYLISTS)
  // =========================================================================
  function cleanTarbiahPlaylistsAndConvertShorts() {
    var plChanged = false;
    if (window.qaafRealChannelPlaylistsMap && window.qaafRealChannelPlaylistsMap["Tarbiah Islamic Centre"]) {
      delete window.qaafRealChannelPlaylistsMap["Tarbiah Islamic Centre"];
      plChanged = true;
    }
    if (plChanged) {
      try { localStorage.setItem("qaaf_real_channel_playlists_v1", JSON.stringify(window.qaafRealChannelPlaylistsMap)); } catch (e) {}
      if (typeof window.savePlaylistsToLocalAndCloudDb === "function") window.savePlaylistsToLocalAndCloudDb();
    }

    if (Array.isArray(videosData)) {
      var vidChanged = false;
      videosData.forEach(function(v) {
        if (!v) return;
        if (v.duration === "12:45" || v.duration === "12:00" || v.duration === "14:20" || v.duration === "10:00") {
          v.duration = "";
          vidChanged = true;
        }
        if (v.channel === "Tarbiah Islamic Centre" && !v.isShort) {
          v.isShort = true;
          v.duration = "";
          vidChanged = true;
        }
        if (v.title && /^New Video \([a-zA-Z0-9_-]{11}\)$/i.test(v.title.trim()) && v.ytId) {
          fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + v.ytId)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(d) {
              if (d && d.title) {
                v.title = d.title;
                try { localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData)); } catch (e) {}
              }
            }).catch(function() {});
        }
      });
      if (vidChanged) {
        try { localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData)); } catch (e) {}
        if (window.qaafCloudSync) window.qaafCloudSync.pushState("Converted Tarbiah Islamic Centre 12 videos to Shorts");
      }
    }
  }
  cleanTarbiahPlaylistsAndConvertShorts();

  // Auto-detect Shorts when importing any channel in Admin Panel
  window.qaafDetectedChannelShortsSet = new Set();
  var prevAutoFetch100 = window.adminAutoFetchYouTubeInfo;
  window.adminAutoFetchYouTubeInfo = async function() {
    var urlInp = document.getElementById("adminYtUrlInput");
    var raw = (urlInp ? urlInp.value : "").trim();
    var base = raw.replace(/\/(videos|shorts|featured|streams|playlists)?\/?$/, "");
    if (base && (base.indexOf("/@") !== -1 || base.indexOf("/channel/") !== -1)) {
      try {
        var rs = await fetch("https://r.jina.ai/" + base + "/shorts");
        if (rs.ok) {
          var stxt = await rs.text();
          for (var m of stxt.matchAll(/(?:watch\?v=|\/shorts\/|"videoId"\s*:\s*")([a-zA-Z0-9_-]{11})/g)) {
            window.qaafDetectedChannelShortsSet.add(m[1]);
          }
        }
      } catch (e) {}
    }
    if (prevAutoFetch100) await prevAutoFetch100.apply(this, arguments);
    if (window.adminPendingBatchChannel && Array.isArray(window.adminPendingBatchChannel.videos)) {
      window.adminPendingBatchChannel.videos.forEach(function(item) {
        if (item && item.ytId && window.qaafDetectedChannelShortsSet.has(item.ytId)) {
          item.isShort = true;
          item.duration = "";
        }
      });
    }
  };

  var prevAddGlobal100 = window.adminAddGlobalVideo;
  window.adminAddGlobalVideo = async function() {
    if (prevAddGlobal100) await prevAddGlobal100.apply(this, arguments);
    setTimeout(function() {
      var chg = false;
      (videosData || []).forEach(function(v) {
        if (!v) return;
        if (v.ytId && window.qaafDetectedChannelShortsSet.has(v.ytId) && !v.isShort) {
          v.isShort = true; v.duration = ""; chg = true;
        }
        if (v.channel === "Tarbiah Islamic Centre" && !v.isShort) {
          v.isShort = true; v.duration = ""; chg = true;
        }
        if (v.duration === "12:45" || v.duration === "12:00") {
          v.duration = ""; chg = true;
        }
      });
      if (chg) {
        try { localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData)); } catch (e) {}
        if (typeof window.renderVideosNow === "function") window.renderVideosNow();
        if (window.qaafCloudSync) window.qaafCloudSync.pushState("Auto-marked Channel Shorts");
      }
    }, 900);
  };

  // When viewing a channel that only has Shorts (0 regular videos), always show its Shorts tab automatically!
  var prevRender100 = window.renderVideosNow;
  window.renderVideosNow = function() {
    var selCh = window.qaafSelectedChannel || "ALL";
    if (selCh !== "ALL" && window.qaafChannelActiveSubTab === "videos") {
      var chVids = (videosData || []).filter(function(v) { return v && v.channel === selCh; });
      var regCnt = chVids.filter(function(v) { return !isVideoShort(v); }).length;
      var shCnt = chVids.filter(function(v) { return isVideoShort(v); }).length;
      if (regCnt === 0 && shCnt > 0) {
        window.qaafChannelActiveSubTab = "shorts";
      }
    }
    if (prevRender100) prevRender100.apply(this, arguments);
    document.querySelectorAll(".qaaf-yt-clean-card span.bottom-2.right-2, #watchUpNextGrid span.bottom-1.right-1").forEach(function(sp) {
      var t = (sp.textContent || "").trim();
      if (t === "12:00" || t === "12:45" || t === "14:20" || t === "10:00" || t === "") {
        sp.textContent = ""; sp.style.display = "none";
      }
    });
  };
  setTimeout(function() { if (typeof window.renderVideosNow === "function") window.renderVideosNow(); }, 150);

  // =========================================================================
  // 2. SIMPLE, FLAT, CLEAR SHARE MODAL (CLEAN SQUARE BRAND LOGOS, ZERO GLOW)
  // =========================================================================
  var WA_ICON_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2722\x27 height=\x2722\x27 fill=\x27#ffffff\x27><path d=\x27M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.01c-.24.68-1.41 1.3-1.97 1.38-.51.08-1.15.11-1.86-.12-.43-.14-.98-.32-1.69-.63-2.97-1.28-4.91-4.27-5.06-4.47-.15-.2-1.21-1.61-1.21-3.07 0-1.46.76-2.18 1.03-2.48.27-.3.59-.37.79-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.59.83 2.03.9 2.18.07.15.12.32.02.52-.1.2-.15.32-.3.49-.15.17-.31.38-.44.51-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.36 1.46.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.49.22.57.35.07.12.07.72-.17 1.4z\x27/></svg>";
  var TG_ICON_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2720\x27 height=\x2720\x27 fill=\x27#ffffff\x27><path d=\x27M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z\x27/></svg>";
  var FB_ICON_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2720\x27 height=\x2720\x27 fill=\x27#ffffff\x27><path d=\x27M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z\x27/></svg>";
  var EM_ICON_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2720\x27 height=\x2720\x27 fill=\x27none\x27 stroke=\x27#ffffff\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27><rect x=\x272\x27 y=\x274\x27 width=\x2720\x27 height=\x2716\x27 rx=\x272\x27/><path d=\x27m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\x27/></svg>";

  window.shareQaafCurrentVideo = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var v = (videosData || []).find(function(x) { return x && x.id === currentPlayingVideoId; });
    var isSh = v && isVideoShort(v);
    var shareUrl = window.location.origin + window.location.pathname + "?" + (isSh ? "shorts" : "watch") + "=" + encodeURIComponent((v && v.id) || currentPlayingVideoId || "");
    var rawTitle = (v && v.title) ? v.title : "QAAF Tube Video";
    var titleTxt = /^New Video \([a-zA-Z0-9_-]{11}\)$/i.test(rawTitle.trim()) ? ((v && v.channel) ? (v.channel + " — QAAF Tube") : "QAAF Tube Islamic Video") : rawTitle;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).catch(function() {});
    }

    var m = document.getElementById("qaafFastInAppShareModal");
    if (!m) {
      m = document.createElement("div");
      m.id = "qaafFastInAppShareModal";
      document.body.appendChild(m);
    }
    var encUrl = encodeURIComponent(shareUrl);
    var encText = encodeURIComponent(titleTxt + " — " + shareUrl);

    m.className = "fixed inset-0 z-[1300] bg-black/70 flex items-center justify-center p-4";
    m.onclick = function(ev) { if (ev.target === m) m.classList.add("hidden"); };
    m.innerHTML =
      "<div class=\x22bg-[#161920] border border-slate-700 rounded-2xl max-w-xs w-full p-4 shadow-xl space-y-3.5 text-white\x22>" +
        "<div class=\x22flex items-center justify-between border-b border-slate-800 pb-2\x22>" +
          "<span class=\x22text-xs font-extrabold text-white flex items-center gap-1.5\x22>" + YT_SHARE_SVG + " <span>Share Video</span></span>" +
          "<button type=\x22button\x22 onclick=\x22document.getElementById(\x27qaafFastInAppShareModal\x27).classList.add(\x27hidden\x27)\x22 class=\x22w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer\x22>✕</button>" +
        "</div>" +
        "<div class=\x22flex items-center justify-around pt-1\x22>" +
          "<a href=\x22https://api.whatsapp.com/send?text=" + encText + "\x22 target=\x22_blank\x22 rel=\x22noopener\x22 class=\x22flex flex-col items-center gap-1.5 text-slate-200 hover:text-white no-underline group\x22>" +
            "<div class=\x22w-11 h-11 rounded-xl bg-[#25D366] flex items-center justify-center transition group-hover:opacity-90\x22>" + WA_ICON_SVG + "</div>" +
            "<span class=\x22text-[10px] font-semibold\x22>WhatsApp</span>" +
          "</a>" +
          "<a href=\x22https://t.me/share/url?url=" + encUrl + "&text=" + encodeURIComponent(titleTxt) + "\x22 target=\x22_blank\x22 rel=\x22noopener\x22 class=\x22flex flex-col items-center gap-1.5 text-slate-200 hover:text-white no-underline group\x22>" +
            "<div class=\x22w-11 h-11 rounded-xl bg-[#229ED9] flex items-center justify-center transition group-hover:opacity-90\x22>" + TG_ICON_SVG + "</div>" +
            "<span class=\x22text-[10px] font-semibold\x22>Telegram</span>" +
          "</a>" +
          "<a href=\x22https://www.facebook.com/sharer/sharer.php?u=" + encUrl + "\x22 target=\x22_blank\x22 rel=\x22noopener\x22 class=\x22flex flex-col items-center gap-1.5 text-slate-200 hover:text-white no-underline group\x22>" +
            "<div class=\x22w-11 h-11 rounded-xl bg-[#1877F2] flex items-center justify-center transition group-hover:opacity-90\x22>" + FB_ICON_SVG + "</div>" +
            "<span class=\x22text-[10px] font-semibold\x22>Facebook</span>" +
          "</a>" +
          "<a href=\x22mailto:?subject=" + encodeURIComponent(titleTxt) + "&body=" + encText + "\x22 class=\x22flex flex-col items-center gap-1.5 text-slate-200 hover:text-white no-underline group\x22>" +
            "<div class=\x22w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center transition group-hover:opacity-90\x22>" + EM_ICON_SVG + "</div>" +
            "<span class=\x22text-[10px] font-semibold\x22>Email</span>" +
          "</a>" +
        "</div>" +
        "<div class=\x22flex items-center gap-1.5 bg-[#0d1015] border border-slate-700 rounded-xl p-1.5\x22>" +
          "<input id=\x22qaafShareUrlBoxInput\x22 type=\x22text\x22 readonly value=\x22" + shareUrl + "\x22 class=\x22w-full bg-transparent text-[11px] text-slate-300 px-2 focus:outline-none\x22 />" +
          "<button type=\x22button\x22 onclick=\x22navigator.clipboard.writeText(document.getElementById(\x27qaafShareUrlBoxInput\x27).value);this.innerText=\x27Copied!\x27;\x22 class=\x22bg-[#164e3a] hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer\x22>Copy</button>" +
        "</div>" +
      "</div>";
    m.classList.remove("hidden");
  };
  window.shareCurrentShort = window.shareQaafCurrentVideo;

  // =========================================================================
  // 3. TRANSPARENT SHORTS BUTTONS + AUTO-HIDE IN SYNC WITH VIDEO CONTROLS
  // =========================================================================
  var shortsOverlayHideTimer = null;
  window.wakeQaafShortsButtonsNow = function() {
    var ov = document.getElementById("qaafYtShortsMasterOverlay");
    var modal = document.getElementById("playerModal");
    if (!ov || !modal || modal.classList.contains("hidden") || !modal.classList.contains("qaaf-shorts-mode")) return;
    ov.style.opacity = "1";
    ov.style.pointerEvents = "auto";
    if (shortsOverlayHideTimer) clearTimeout(shortsOverlayHideTimer);
    shortsOverlayHideTimer = setTimeout(function() {
      var curOv = document.getElementById("qaafYtShortsMasterOverlay");
      if (curOv) {
        curOv.style.opacity = "0";
        curOv.style.pointerEvents = "none";
      }
    }, 2400);
  };

  function styleTransparentShortsButtons(forceRebuild) {
    var modal = document.getElementById("playerModal");
    var aspect = document.getElementById("playerAspectBox");
    var ov = document.getElementById("qaafYtShortsMasterOverlay");
    if (!modal || modal.classList.contains("hidden") || !modal.classList.contains("qaaf-shorts-mode") || !ov) return;
    var video = (videosData || []).find(function(x) { return x && x.id === currentPlayingVideoId; });
    if (!video || !isVideoShort(video)) return;

    var isFav = (favoriteVideoIds || []).indexOf(video.id) !== -1;
    var stKey = "v100_" + video.id + "_" + (isFav ? "1" : "0");
    ov.style.background = "transparent";
    ov.style.border = "none";
    ov.style.boxShadow = "none";
    ov.style.right = "8px";
    ov.style.bottom = "14px";
    ov.style.width = "50px";
    ov.style.padding = "0";
    ov.style.gap = "14px";
    ov.style.transition = "opacity 0.2s ease";

    if (forceRebuild || ov.getAttribute("data-v100-state") !== stKey) {
      ov.setAttribute("data-v100-state", stKey);
      ov.setAttribute("data-v98-state", stKey);
      var btnCircleStyle = "width:44px;height:44px;border-radius:999px;background:rgba(15,18,24,0.78);color:#fff;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.18);cursor:pointer;";
      var lblStyle = "font-size:10px;font-weight:800;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.9);";
      ov.innerHTML =
        "<div style=\x27display:flex;flex-direction:column;align-items:center;gap:3px;\x27>" +
          "<button type=\x27button\x27 onclick=\x27toggleFavoriteVideo(currentPlayingVideoId,event);window.wakeQaafShortsButtonsNow();\x27 style=\x27" + btnCircleStyle + "\x27>" + (isFav ? YT_LIKE_FILLED_SVG : YT_LIKE_OUTLINE_SVG) + "</button>" +
          "<span style=\x27" + lblStyle + "\x27>" + (isFav ? "Liked" : "Like") + "</span>" +
        "</div>" +
        "<div style=\x27display:flex;flex-direction:column;align-items:center;gap:3px;\x27>" +
          "<button type=\x27button\x27 onclick=\x27openShortCommentsPopup(event);window.wakeQaafShortsButtonsNow();\x27 style=\x27" + btnCircleStyle + "\x27><svg viewBox=\x270 0 24 24\x27 width=\x2718\x27 height=\x2718\x27 fill=\x27none\x27 stroke=\x27currentColor\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27><path d=\x27M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\x27/></svg></button>" +
          "<span style=\x27" + lblStyle + "\x27>Comment</span>" +
        "</div>" +
        "<div style=\x27display:flex;flex-direction:column;align-items:center;gap:3px;\x27>" +
          "<button type=\x27button\x27 onclick=\x27shareQaafCurrentVideo(event);window.wakeQaafShortsButtonsNow();\x27 style=\x27" + btnCircleStyle + "\x27>" + YT_SHARE_SVG + "</button>" +
          "<span style=\x27" + lblStyle + "\x27>Share</span>" +
        "</div>";
      window.wakeQaafShortsButtonsNow();
    }

    if (aspect && !aspect.getAttribute("data-v100-wake-bound")) {
      aspect.setAttribute("data-v100-wake-bound", "1");
      ["touchstart", "mousemove", "mousedown", "click"].forEach(function(evName) {
        aspect.addEventListener(evName, function() { window.wakeQaafShortsButtonsNow(); }, { passive: true, capture: true });
      });
    }
  }

  var prevOpenV100 = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    if (prevOpenV100) prevOpenV100.apply(this, arguments);
    setTimeout(function() { styleTransparentShortsButtons(true); }, 45);
  };
  var prevFav100 = window.toggleFavoriteVideo;
  window.toggleFavoriteVideo = function(videoId, ev) {
    if (prevFav100) prevFav100(videoId, ev);
    setTimeout(function() { styleTransparentShortsButtons(true); }, 25);
  };
})();


// === QAAF V101 LIVE ANALYTICS & SPONSOR REPORT CARD ===
(function initQaafV101LiveAnalyticsAndReportCard() {
  var FB_BASE = (localStorage.getItem("qaaf_firebase_db_url") || "https://qaaftube-6f251-default-rtdb.firebaseio.com").replace(/\/+$/, "");
  var ANALYTICS_FB_URL = FB_BASE + "/qaaf_analytics_db.json";
  var ANALYTICS_CACHE_KEY = "qaaf_analytics_cache_v1";

  function getDefaultAnState() {
    return { daily: {}, videoViews: {}, userStats: {}, regionStats: {}, langStats: {}, totalViews: 0, totalWatchSeconds: 0, totalGamePlays: 0, sponsorClicks: 0, updatedAt: Date.now() };
  }
  window.qaafAnalyticsData = getDefaultAnState();
  try {
    var c = localStorage.getItem(ANALYTICS_CACHE_KEY);
    if (c) window.qaafAnalyticsData = Object.assign(getDefaultAnState(), JSON.parse(c));
  } catch (e) {}

  function getTodayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  window.detectQaafUserRegion = function() {
    try {
      var tzl = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
      if (tzl.indexOf("karachi") !== -1 || tzl.indexOf("pakistan") !== -1) return "Pakistan / South Asia";
      if (tzl.indexOf("riyadh") !== -1 || tzl.indexOf("dubai") !== -1 || tzl.indexOf("qatar") !== -1 || tzl.indexOf("kuwait") !== -1 || tzl.indexOf("bahrain") !== -1 || tzl.indexOf("muscat") !== -1) return "Saudi Arabia / Gulf GCC";
      if (tzl.indexOf("london") !== -1 || tzl.indexOf("europe") !== -1 || tzl.indexOf("paris") !== -1 || tzl.indexOf("berlin") !== -1) return "UK / Europe";
      if (tzl.indexOf("america") !== -1 || tzl.indexOf("us/") !== -1 || tzl.indexOf("canada") !== -1 || tzl.indexOf("new_york") !== -1 || tzl.indexOf("chicago") !== -1 || tzl.indexOf("toronto") !== -1) return "USA / North America";
      if (tzl.indexOf("istanbul") !== -1 || tzl.indexOf("cairo") !== -1 || tzl.indexOf("amman") !== -1) return "Turkey / MENA";
      if (tzl.indexOf("jakarta") !== -1 || tzl.indexOf("kuala_lumpur") !== -1 || tzl.indexOf("singapore") !== -1) return "Malaysia / Indonesia SEA";
      if (tzl.indexOf("dhaka") !== -1) return "Bangladesh";
      if (tzl.indexOf("kolkata") !== -1 || tzl.indexOf("calcutta") !== -1) return "India";
      return "Pakistan / South Asia";
    } catch (e) { return "Pakistan / South Asia"; }
  };

  window.syncAnalyticsWithFirebase = function() {
    try { window.qaafAnalyticsData.updatedAt = Date.now(); localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(window.qaafAnalyticsData)); } catch (e) {}
    fetch(ANALYTICS_FB_URL, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(window.qaafAnalyticsData) }).catch(function() {});
  };

  fetch(ANALYTICS_FB_URL + "?t=" + Date.now()).then(function(r) { return r.ok ? r.json() : null; }).then(function(remote) {
    if (!remote || typeof remote !== "object") return;
    var loc = window.qaafAnalyticsData || getDefaultAnState();
    Object.keys(remote.daily || {}).forEach(function(dt) {
      var rd = remote.daily[dt] || {}, ld = loc.daily[dt] || {};
      loc.daily[dt] = { views: Math.max(ld.views||0, rd.views||0), watchSeconds: Math.max(ld.watchSeconds||0, rd.watchSeconds||0), gamePlays: Math.max(ld.gamePlays||0, rd.gamePlays||0), sponsorClicks: Math.max(ld.sponsorClicks||0, rd.sponsorClicks||0) };
    });
    Object.keys(remote.userStats || {}).forEach(function(uk) {
      var ru = remote.userStats[uk] || {}, lu = loc.userStats[uk] || {};
      loc.userStats[uk] = { email: lu.email||ru.email||uk, views: Math.max(lu.views||0, ru.views||0), watchSeconds: Math.max(lu.watchSeconds||0, ru.watchSeconds||0), region: lu.region||ru.region||window.detectQaafUserRegion(), lastActive: lu.lastActive||ru.lastActive||"" };
    });
    Object.keys(remote.regionStats || {}).forEach(function(rk) {
      var rr = remote.regionStats[rk] || {}, lr = loc.regionStats[rk] || {};
      loc.regionStats[rk] = { views: Math.max(lr.views||0, rr.views||0), watchSeconds: Math.max(lr.watchSeconds||0, rr.watchSeconds||0) };
    });
    Object.keys(remote.langStats || {}).forEach(function(lk) {
      var rl = remote.langStats[lk] || {}, ll = loc.langStats[lk] || {};
      loc.langStats[lk] = { views: Math.max(ll.views||0, rl.views||0), watchSeconds: Math.max(ll.watchSeconds||0, rl.watchSeconds||0) };
    });
    loc.totalViews = Math.max(loc.totalViews||0, remote.totalViews||0);
    loc.totalWatchSeconds = Math.max(loc.totalWatchSeconds||0, remote.totalWatchSeconds||0);
    loc.totalGamePlays = Math.max(loc.totalGamePlays||0, remote.totalGamePlays||0);
    loc.sponsorClicks = Math.max(loc.sponsorClicks||0, remote.sponsorClicks||0);
    window.qaafAnalyticsData = loc;
    try { localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(loc)); } catch (e) {}
  }).catch(function() {});

  window.recordAnalyticsEvent = function(eventType, secondsAdded, videoObj) {
    var db = window.qaafAnalyticsData || getDefaultAnState();
    var dt = getTodayKey();
    if (!db.daily[dt]) db.daily[dt] = { views: 0, watchSeconds: 0, gamePlays: 0, sponsorClicks: 0 };
    var uKey = (typeof currentUserEmail !== "undefined" && currentUserEmail) ? currentUserEmail.toLowerCase().trim() : "guest_device";
    var safeUKey = uKey.replace(/[^a-zA-Z0-9_-]+/g, "_");
    var regName = window.detectQaafUserRegion();
    var langCode = String((videoObj && videoObj.lang) || window.preferredContentLang || preferredContentLang || "en").toLowerCase();
    if (langCode === "global") langCode = String(window.preferredContentLang || preferredContentLang || "ur").toLowerCase();
    if (!db.userStats[safeUKey]) db.userStats[safeUKey] = { email: uKey, views: 0, watchSeconds: 0, region: regName, lastActive: "" };
    db.userStats[safeUKey].email = uKey; db.userStats[safeUKey].region = regName; db.userStats[safeUKey].lastActive = new Date().toLocaleString();
    if (!db.regionStats[regName]) db.regionStats[regName] = { views: 0, watchSeconds: 0 };
    if (!db.langStats[langCode]) db.langStats[langCode] = { views: 0, watchSeconds: 0 };
    if (eventType === "view") {
      db.daily[dt].views += 1; db.totalViews = (db.totalViews || 0) + 1;
      db.userStats[safeUKey].views += 1; db.regionStats[regName].views += 1; db.langStats[langCode].views += 1;
      window.syncAnalyticsWithFirebase();
    } else if (eventType === "watch_heartbeat") {
      var sec = secondsAdded || 15;
      db.daily[dt].watchSeconds += sec; db.totalWatchSeconds = (db.totalWatchSeconds || 0) + sec;
      db.userStats[safeUKey].watchSeconds += sec; db.regionStats[regName].watchSeconds += sec; db.langStats[langCode].watchSeconds += sec;
      try { localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(db)); } catch (e) {}
    } else if (eventType === "game") {
      db.daily[dt].gamePlays += 1; db.totalGamePlays = (db.totalGamePlays || 0) + 1; window.syncAnalyticsWithFirebase();
    } else if (eventType === "sponsor") {
      db.daily[dt].sponsorClicks += 1; db.sponsorClicks = (db.sponsorClicks || 0) + 1; window.syncAnalyticsWithFirebase();
    }
  };

  // Hook Sensors 1, 2, 3, 4
  var prevOpen101 = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    if (prevOpen101) prevOpen101.apply(this, arguments);
    var v = (videosData || []).find(function(x) { return x && x.id === videoId; });
    if (v) window.recordAnalyticsEvent("view", 0, v);
  };

  var hbTicks = 0;
  setInterval(function() {
    var pModal = document.getElementById("playerModal");
    var gModal = document.getElementById("qaafActiveGamePlayModal");
    var isVid = pModal && !pModal.classList.contains("hidden");
    var isGm = gModal && !gModal.classList.contains("hidden");
    if (isVid || isGm) {
      var curV = isVid ? (videosData || []).find(function(x) { return x && x.id === currentPlayingVideoId; }) : null;
      window.recordAnalyticsEvent("watch_heartbeat", 15, curV);
      hbTicks++; if (hbTicks % 4 === 0) window.syncAnalyticsWithFirebase();
    }
  }, 15000);

  var prevGm101 = window.openInstalledGameModal;
  if (typeof prevGm101 === "function") {
    window.openInstalledGameModal = function() {
      window.recordAnalyticsEvent("game", 0, null);
      return prevGm101.apply(this, arguments);
    };
  }
  ["promoTickerLink", "promoImageBannerLink"].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && !el.getAttribute("data-an-spons")) {
      el.setAttribute("data-an-spons", "1");
      el.addEventListener("click", function() { window.recordAnalyticsEvent("sponsor", 0, null); });
    }
  });

  window.activeAnalyticsDays = 0;
  window.getFilteredAnalytics = function(days) {
    var db = window.qaafAnalyticsData || getDefaultAnState();
    var daily = db.daily || {};
    var catalogViews = 0;
    (videosData || []).forEach(function(v) {
      if (v) catalogViews += (typeof window.getQaafRealViewCount === "function") ? window.getQaafRealViewCount(v) : (v.realViews || 0);
    });
    var views = 0, watchSeconds = 0, gamePlays = 0, sponsorClicks = 0, now = new Date();
    Object.keys(daily).forEach(function(dtStr) {
      var dObj = daily[dtStr] || {}, inc = true;
      if (days && days > 0) {
        var parts = dtStr.split("-");
        if (parts.length === 3) {
          var dtTime = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
          if ((now.getTime() - dtTime) / (1000 * 3600 * 24) > days) inc = false;
        }
      }
      if (inc) { views += (dObj.views||0); watchSeconds += (dObj.watchSeconds||0); gamePlays += (dObj.gamePlays||0); sponsorClicks += (dObj.sponsorClicks||0); }
    });
    if (!days || days === 0) {
      views = Math.max(views, db.totalViews || 0, catalogViews);
      watchSeconds = Math.max(watchSeconds, db.totalWatchSeconds || 0, views * 150);
      gamePlays = Math.max(gamePlays, db.totalGamePlays || 0);
      sponsorClicks = Math.max(sponsorClicks, db.sponsorClicks || 0);
    }
    return { views: views, watchSeconds: watchSeconds, gamePlays: gamePlays, sponsorClicks: sponsorClicks };
  };

  function fmtHrsMins(secs) {
    var s = Math.max(0, Math.round(secs || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h === 0 && m === 0 && s > 0) m = 1;
    return h + " hrs " + m + " mins";
  }

  var TEN_LANGS = { en: "🇬🇧 English (EN)", ar: "🇸🇦 Arabic (AR)", ur: "🇵🇰 Urdu (UR)", hi: "🇮🇳 Hindi (HI)", bn: "🇧🇩 Bengali (BN)", tr: "🇹🇷 Turkish (TR)", ms: "🇲🇾 Malay (MS)", id: "🇮🇩 Indonesian (ID)", fr: "🇫🇷 French (FR)", ru: "🇷🇺 Russian (RU)" };
  var EIGHT_REGS = ["Pakistan / South Asia", "Saudi Arabia / Gulf GCC", "UK / Europe", "USA / North America", "Turkey / MENA", "Malaysia / Indonesia SEA", "Bangladesh", "India"];

  function injectAnalyticsTabUI() {
    var sidebar = document.getElementById("edgeAdminSidebar");
    var rightArea = document.querySelector("#adminDashboardModal .flex-1.overflow-y-auto");
    if (!sidebar || !rightArea || document.getElementById("admTabBtn_analytics")) return;
    var btn = document.createElement("button");
    btn.type = "button"; btn.id = "admTabBtn_analytics";
    btn.onclick = function() { switchAdminTab("analytics"); window.renderAdminAnalyticsDashboard(); };
    btn.className = "adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1.5 transition text-slate-300 hover:bg-white/5";
    btn.innerHTML = "<span class=\x22flex items-center gap-1.5 truncate\x22><span>📊</span> <span class=\x22truncate\x22>Analytics &amp; Stats</span></span><span id=\x22admSidebarAnalyticsBadge\x22 class=\x22bg-emerald-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0\x22>Live</span>";
    sidebar.appendChild(btn);
    var pane = document.createElement("div");
    pane.id = "admPane_analytics"; pane.className = "adm-tab-pane hidden space-y-5";
    rightArea.appendChild(pane);
  }

  window.selectAnalyticsDaysFilter = function(days) { window.activeAnalyticsDays = days; window.renderAdminAnalyticsDashboard(); };

  window.renderAdminAnalyticsDashboard = function() {
    injectAnalyticsTabUI();
    var pane = document.getElementById("admPane_analytics");
    if (!pane) return;
    var days = window.activeAnalyticsDays || 0;
    var stats = window.getFilteredAnalytics(days);
    var db = window.qaafAnalyticsData || getDefaultAnState();
    var totalFamilies = Object.keys(window.registeredUsersMap || {}).length;
    var sideBadge = document.getElementById("admSidebarAnalyticsBadge");
    if (sideBadge) sideBadge.innerText = stats.views;

    var filterBar = [{ d: 1, l: "Today" }, { d: 7, l: "7 Days" }, { d: 10, l: "10 Days" }, { d: 30, l: "30 Days" }, { d: 365, l: "1 Year" }, { d: 0, l: "All-Time" }].map(function(f) {
      return "<button type=\x22button\x22 onclick=\x22window.selectAnalyticsDaysFilter(" + f.d + ")\x22 class=\x22px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer " + (days === f.d ? "bg-emerald-500 text-black shadow" : "bg-[#181e29] hover:bg-slate-800 text-slate-300 border border-slate-700") + "\x22>" + f.l + "</button>";
    }).join("");

    var regHtml = EIGHT_REGS.map(function(rName) {
      var ro = (db.regionStats && db.regionStats[rName]) || { views: 0, watchSeconds: 0 };
      var pct = stats.views > 0 ? Math.min(100, Math.round(((ro.views||0) / stats.views) * 100)) : 0;
      return "<div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5 space-y-1\x22><div class=\x22flex justify-between text-xs\x22><span class=\x22font-bold text-white\x22>🌍 " + rName + "</span><span class=\x22text-emerald-400 font-extrabold\x22>" + (ro.views||0) + " views • " + fmtHrsMins(ro.watchSeconds||0) + "</span></div><div class=\x22w-full bg-slate-800 h-1.5 rounded-full overflow-hidden\x22><div class=\x22bg-emerald-500 h-full\x22 style=\x22width:" + pct + "%\x22></div></div></div>";
    }).join("");

    var langHtml = Object.keys(TEN_LANGS).map(function(lk) {
      var lo = (db.langStats && db.langStats[lk]) || { views: 0, watchSeconds: 0 };
      var pct = stats.views > 0 ? Math.min(100, Math.round(((lo.views||0) / stats.views) * 100)) : 0;
      return "<div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5 space-y-1\x22><div class=\x22flex justify-between text-xs\x22><span class=\x22font-bold text-white\x22>" + TEN_LANGS[lk] + "</span><span class=\x22text-amber-300 font-extrabold\x22>" + (lo.views||0) + " views • " + fmtHrsMins(lo.watchSeconds||0) + "</span></div><div class=\x22w-full bg-slate-800 h-1.5 rounded-full overflow-hidden\x22><div class=\x22bg-amber-400 h-full\x22 style=\x22width:" + pct + "%\x22></div></div></div>";
    }).join("");

    var uStats = db.userStats || {};
    var uKeys = Object.keys(uStats);
    var userRows = uKeys.length === 0 ? "<p class=\x22text-slate-400 text-xs py-2\x22>No individual user sessions recorded yet.</p>" : uKeys.map(function(uk) {
      var uo = uStats[uk] || {};
      return "<div class=\x22bg-black/60 border border-slate-800 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs\x22><div><p class=\x22font-extrabold text-white\x22>👤 " + (uo.email || uk) + "</p><p class=\x22text-[10px] text-slate-400\x22>🌍 " + (uo.region || "Global") + " • Last Active: " + (uo.lastActive || "Recent") + "</p></div><span class=\x22bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2.5 py-1 rounded-lg font-extrabold text-[11px]\x22>👁️ " + (uo.views||0) + " views • ⏱️ " + fmtHrsMins(uo.watchSeconds||0) + "</span></div>";
    }).join("");

    pane.innerHTML =
      "<div class=\x22flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3\x22><div><h4 class=\x22text-sm sm:text-base font-extrabold text-white\x22>📊 QAAF Tube Live Analytics &amp; Audience Stats</h4><p class=\x22text-xs text-slate-400 mt-0.5\x22>5-Sensor Live Tracking • Separate Cloud DB (qaaf_analytics_db.json)</p></div><button type=\x22button\x22 onclick=\x22window.openSponsorReportCard()\x22 class=\x22bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl text-xs font-extrabold shadow cursor-pointer\x22>📄 Open Sponsor / Client Report Card</button></div>" +
      "<div class=\x22flex flex-wrap items-center gap-1.5\x22>" + filterBar + "</div>" +
      "<div class=\x22grid grid-cols-2 sm:grid-cols-5 gap-2.5\x22>" +
        "<div class=\x22bg-[#141923] border border-emerald-500/40 rounded-2xl p-3\x22><span class=\x22text-[10px] text-slate-400 font-bold block\x22>👁️ Total Views</span><span class=\x22text-xl font-extrabold text-emerald-400 mt-1 block\x22>" + stats.views + "</span></div>" +
        "<div class=\x22bg-[#141923] border border-blue-500/40 rounded-2xl p-3\x22><span class=\x22text-[10px] text-slate-400 font-bold block\x22>⏱️ Watch Time</span><span class=\x22text-sm font-extrabold text-blue-300 mt-1 block\x22>" + fmtHrsMins(stats.watchSeconds) + "</span></div>" +
        "<div class=\x22bg-[#141923] border border-amber-500/40 rounded-2xl p-3\x22><span class=\x22text-[10px] text-slate-400 font-bold block\x22>👨‍👩‍👧‍👦 Families</span><span class=\x22text-xl font-extrabold text-amber-300 mt-1 block\x22>" + totalFamilies + "</span></div>" +
        "<div class=\x22bg-[#141923] border border-teal-500/40 rounded-2xl p-3\x22><span class=\x22text-[10px] text-slate-400 font-bold block\x22>🎮 Game Plays</span><span class=\x22text-xl font-extrabold text-teal-300 mt-1 block\x22>" + stats.gamePlays + "</span></div>" +
        "<div class=\x22bg-[#141923] border border-purple-500/40 rounded-2xl p-3\x22><span class=\x22text-[10px] text-slate-400 font-bold block\x22>📢 Sponsor Clicks</span><span class=\x22text-xl font-extrabold text-purple-300 mt-1 block\x22>" + stats.sponsorClicks + "</span></div>" +
      "</div>" +
      "<div class=\x22grid grid-cols-1 md:grid-cols-2 gap-4\x22><div class=\x22bg-[#141821] border border-slate-800 rounded-2xl p-4 space-y-2\x22><h5 class=\x22text-xs font-extrabold text-emerald-300\x22>🌍 Views by Region</h5><div class=\x22space-y-2 max-h-64 overflow-y-auto pr-1\x22>" + regHtml + "</div></div><div class=\x22bg-[#141821] border border-slate-800 rounded-2xl p-4 space-y-2\x22><h5 class=\x22text-xs font-extrabold text-amber-300\x22>🗣️ Views by Language</h5><div class=\x22space-y-2 max-h-64 overflow-y-auto pr-1\x22>" + langHtml + "</div></div></div>" +
      "<div class=\x22bg-[#141821] border border-slate-800 rounded-2xl p-4 space-y-2\x22><h5 class=\x22text-xs font-extrabold text-blue-300\x22>👤 Per-User Watch Time &amp; Activity</h5><div class=\x22space-y-2 max-h-56 overflow-y-auto pr-1\x22>" + userRows + "</div></div>";
  };

  window.openSponsorReportCard = function() {
    var stats = window.getFilteredAnalytics(window.activeAnalyticsDays || 0);
    var db = window.qaafAnalyticsData || getDefaultAnState();
    var totalFamilies = Object.keys(window.registeredUsersMap || {}).length;
    var m = document.getElementById("qaafSponsorReportCardModal");
    if (!m) { m = document.createElement("div"); m.id = "qaafSponsorReportCardModal"; document.body.appendChild(m); }
    m.className = "fixed inset-0 z-[1300] bg-black/85 flex items-center justify-center p-4";
    var regHtml = EIGHT_REGS.map(function(rName) {
      var ro = (db.regionStats && db.regionStats[rName]) || { views: 0, watchSeconds: 0 };
      return "<div class=\x22flex justify-between py-1 border-b border-slate-800 text-xs\x22><span>" + rName + "</span><span class=\x22font-bold text-emerald-400\x22>" + (ro.views||0) + " views • " + fmtHrsMins(ro.watchSeconds||0) + "</span></div>";
    }).join("");
    var langHtml = Object.keys(TEN_LANGS).map(function(lk) {
      var lo = (db.langStats && db.langStats[lk]) || { views: 0, watchSeconds: 0 };
      return "<div class=\x22flex justify-between py-1 border-b border-slate-800 text-xs\x22><span>" + TEN_LANGS[lk] + "</span><span class=\x22font-bold text-amber-300\x22>" + (lo.views||0) + " views • " + fmtHrsMins(lo.watchSeconds||0) + "</span></div>";
    }).join("");
    m.innerHTML = "<div class=\x22bg-[#0f141d] border-2 border-emerald-500/60 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-white max-h-[92vh] overflow-y-auto\x22><div class=\x22flex items-center justify-between border-b border-slate-800 pb-3\x22><div><span class=\x22text-[10px] font-extrabold text-emerald-400 uppercase\x22>OFFICIAL SPONSORSHIP REPORT CARD</span><h3 class=\x22text-lg font-extrabold text-white\x22>QAAF Tube — Muslim Family &amp; Kids Hub</h3><p class=\x22text-[11px] text-slate-400\x22>https://qaaftube.com • " + new Date().toLocaleDateString() + "</p></div><button type=\x22button\x22 onclick=\x22document.getElementById(\x27qaafSponsorReportCardModal\x27).classList.add(\x27hidden\x27)\x22 class=\x22bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer\x22>✕ Close</button></div><div class=\x22grid grid-cols-2 sm:grid-cols-5 gap-2 text-center\x22><div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5\x22><span class=\x22text-[10px] text-slate-400 block\x22>Views</span><span class=\x22text-base font-extrabold text-emerald-400\x22>" + stats.views + "</span></div><div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5\x22><span class=\x22text-[10px] text-slate-400 block\x22>Watch Time</span><span class=\x22text-xs font-extrabold text-blue-300\x22>" + fmtHrsMins(stats.watchSeconds) + "</span></div><div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5\x22><span class=\x22text-[10px] text-slate-400 block\x22>Families</span><span class=\x22text-base font-extrabold text-amber-300\x22>" + totalFamilies + "</span></div><div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5\x22><span class=\x22text-[10px] text-slate-400 block\x22>Games</span><span class=\x22text-base font-extrabold text-teal-300\x22>" + stats.gamePlays + "</span></div><div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5\x22><span class=\x22text-[10px] text-slate-400 block\x22>Ad Clicks</span><span class=\x22text-base font-extrabold text-purple-300\x22>" + stats.sponsorClicks + "</span></div></div><div class=\x22grid grid-cols-1 sm:grid-cols-2 gap-4\x22><div class=\x22bg-black/40 border border-slate-800 rounded-2xl p-3\x22><h5 class=\x22text-xs font-extrabold text-emerald-400 mb-2\x22>🌍 Views by Region</h5>" + regHtml + "</div><div class=\x22bg-black/40 border border-slate-800 rounded-2xl p-3\x22><h5 class=\x22text-xs font-extrabold text-amber-300 mb-2\x22>🗣️ Views by Language</h5>" + langHtml + "</div></div><div class=\x22flex items-center justify-between pt-2 border-t border-slate-800\x22><span class=\x22text-[11px] text-slate-400\x22>contactqaaftube@gmail.com</span><button type=\x22button\x22 onclick=\x22window.print()\x22 class=\x22bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer\x22>🖨️ Print / Save PDF</button></div></div>";
    m.classList.remove("hidden");
  };

  var prevAdm101 = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevAdm101) prevAdm101.apply(this, arguments);
    injectAnalyticsTabUI();
    window.renderAdminAnalyticsDashboard();
  };
  setTimeout(injectAnalyticsTabUI, 900);
})();


// === QAAF V102 DAILY CHANNEL SCANNER, SHORTS FLAG & ADMIN LABEL FIX ===
(function initQaafV102DailyScannerShortsFlagAndAdminFix() {
  var FB_BASE = (localStorage.getItem("qaaf_firebase_db_url") || "https://qaaftube-6f251-default-rtdb.firebaseio.com").replace(/\/+$/, "");
  var SKIP_CH = new Set(["Official Hub", "Islamic Channel", "YouTube Creator", "YouTube Channel", "Requested Channel", "General"]);

  // =========================================================================
  // 1. CHANGE "Super Admin" -> "Admin" EVERYWHERE
  // =========================================================================
  function replaceSuperAdminLabels() {
    var admSub = document.querySelector("#adminDashboardModal p.text-xs.text-slate-400");
    if (admSub && admSub.textContent.indexOf("Super Admin") !== -1) {
      admSub.textContent = admSub.textContent.replace(/Super Admin/g, "Admin");
    }
    var roleSel = document.getElementById("headerRoleBadge") || document.getElementById("userRoleBadge");
    if (roleSel && roleSel.textContent.indexOf("Super Admin") !== -1) {
      roleSel.textContent = roleSel.textContent.replace(/Super Admin/g, "Admin");
    }
    document.querySelectorAll("button, span, p, div, h1, h2, h3, h4").forEach(function(el) {
      if (el.children.length === 0 && el.textContent && el.textContent.indexOf("Super Admin") !== -1) {
        el.textContent = el.textContent.replace(/Super Admin/g, "Admin");
      }
    });
  }
  setTimeout(replaceSuperAdminLabels, 600);

  // =========================================================================
  // 2. ADD 🚩 FLAG BUTTON IN SHORTS & FIX OVERLAP WITH YOUTUBE FULLSCREEN ICON
  // =========================================================================
  function addFlagButtonToShortsOverlay() {
    var ov = document.getElementById("qaafYtShortsMasterOverlay");
    if (!ov) return;
    ov.style.bottom = "56px";
    ov.style.right = "6px";
    ov.style.gap = "10px";
    if (!document.getElementById("qaafShortFlagBtnWrap")) {
      var wrap = document.createElement("div");
      wrap.id = "qaafShortFlagBtnWrap";
      wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:2px;";
      wrap.innerHTML =
        "<button type=\x27button\x27 onclick=\x27openFlagModal(currentPlayingVideoId);if(window.wakeQaafShortsButtonsNow)window.wakeQaafShortsButtonsNow();\x27 style=\x27width:42px;height:42px;border-radius:999px;background:rgba(15,18,24,0.8);color:#fca5a5;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.2);cursor:pointer;\x27>" +
          "<svg viewBox=\x270 0 24 24\x27 width=\x2717\x27 height=\x2717\x27 fill=\x27none\x27 stroke=\x27currentColor\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27><path d=\x27M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z\x27/><line x1=\x274\x27 y1=\x2722\x27 x2=\x274\x27 y2=\x2715\x27/></svg>" +
        "</button>" +
        "<span style=\x27font-size:10px;font-weight:800;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.9);\x27>Flag</span>";
      ov.appendChild(wrap);
    }
  }

  var prevOpenV102 = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    if (prevOpenV102) prevOpenV102.apply(this, arguments);
    setTimeout(addFlagButtonToShortsOverlay, 80);
  };
  var prevFav102 = window.toggleFavoriteVideo;
  window.toggleFavoriteVideo = function(videoId, ev) {
    if (prevFav102) prevFav102(videoId, ev);
    setTimeout(addFlagButtonToShortsOverlay, 60);
  };

  // =========================================================================
  // 3. DAILY APPROVED CHANNEL NEW VIDEO SCANNER & NOTIFICATION BOX IN ADMIN
  // =========================================================================
  window.qaafChannelUpdatesQueue = (JSON.parse(localStorage.getItem("qaaf_channel_updates_queue_v1") || "[]") || []).filter(function(u) {
    return u && u.channel && !SKIP_CH.has(u.channel);
  });
  window.qaafRejectedUpdateYtIds = JSON.parse(localStorage.getItem("qaaf_rejected_update_ytids_v1") || "[]");
  var isScanningChNow = false;

  function saveUpdatesQueueAndRefreshUI() {
    try {
      localStorage.setItem("qaaf_channel_updates_queue_v1", JSON.stringify(window.qaafChannelUpdatesQueue));
      localStorage.setItem("qaaf_rejected_update_ytids_v1", JSON.stringify(window.qaafRejectedUpdateYtIds));
    } catch (e) {}
    fetch(FB_BASE + "/qaaf_channel_updates_queue.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queue: window.qaafChannelUpdatesQueue, rejectedIds: window.qaafRejectedUpdateYtIds, updatedAt: Date.now() })
    }).catch(function() {});
    var qCount = (window.qaafChannelUpdatesQueue || []).length;
    var fCount = (typeof flaggedVideosQueue !== "undefined" && Array.isArray(flaggedVideosQueue)) ? flaggedVideosQueue.length : 0;
    var rCount = (window.parentRequestsQueue && Array.isArray(window.parentRequestsQueue)) ? window.parentRequestsQueue.length : 0;
    var hdrBadge = document.getElementById("adminFlagCountBadge");
    if (hdrBadge) hdrBadge.innerText = fCount + rCount + qCount;
    window.renderAdminDailyChannelUpdatesBox();
  }

  window.scanApprovedChannelsForNewVideos = async function(isManual) {
    if (isScanningChNow) return;
    isScanningChNow = true;
    var scanBtn = document.getElementById("qaafScanChannelsNowBtn");
    if (scanBtn) scanBtn.innerText = "⏳ Scanning...";
    if (isManual && typeof showSyncToast === "function") showSyncToast("⏳ Checking approved channels for newly uploaded videos...");

    var chCounts = {};
    var approvedSet = new Set(window.verifiedChannelsList || []);
    (videosData || []).forEach(function(v) {
      if (!v || !v.channel || SKIP_CH.has(v.channel)) return;
      chCounts[v.channel] = (chCounts[v.channel] || 0) + 1;
      if (v.channelVerified) approvedSet.add(v.channel);
    });
    Object.keys(chCounts).forEach(function(ch) {
      if (chCounts[ch] >= 3) approvedSet.add(ch);
    });

    var approvedList = Array.from(approvedSet).filter(function(c) { return c && !SKIP_CH.has(c); });
    var chUrlCache = JSON.parse(localStorage.getItem("qaaf_channel_urls_map_v1") || "{}");
    var existingYtIds = new Set((videosData || []).map(function(v) { return v && v.ytId; }).filter(Boolean));
    var blockedSet = new Set((typeof blockedVideoIds !== "undefined" ? blockedVideoIds : []).concat(window.qaafRejectedUpdateYtIds || []));
    var queuedSet = new Set((window.qaafChannelUpdatesQueue || []).map(function(u) { return u && u.ytId; }).filter(Boolean));
    var newlyFound = 0;

    for (var i = 0; i < approvedList.length; i++) {
      var chName = approvedList[i];
      var chVids = (videosData || []).filter(function(v) { return v && v.channel === chName && v.ytId; });
      if (!chVids.length) continue;
      var chKnownSet = new Set(chVids.map(function(v) { return v.ytId; }));
      var baseUrl = chUrlCache[chName] || "";
      if (!baseUrl) {
        try {
          var oe = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + chVids[0].ytId);
          var oeD = await oe.json();
          if (oeD && oeD.author_url) {
            baseUrl = oeD.author_url.replace(/\/+$/, "");
            chUrlCache[chName] = baseUrl;
            localStorage.setItem("qaaf_channel_urls_map_v1", JSON.stringify(chUrlCache));
          }
        } catch (e) {}
      }
      if (!baseUrl) continue;

      var tabPath = (chVids.every(function(v) { return isVideoShort(v); })) ? "/shorts" : "/videos";
      var pageText = "";
      try {
        var r = await fetch("https://r.jina.ai/" + baseUrl + tabPath);
        if (r.ok) pageText = await r.text();
      } catch (e) {}
      if (!pageText) continue;

      var topIds = [];
      for (var m of pageText.matchAll(/(?:watch\?v=|\/shorts\/|"videoId"\s*:\s*")([a-zA-Z0-9_-]{11})/g)) {
        if (topIds.indexOf(m[1]) === -1) topIds.push(m[1]);
        if (topIds.length >= 10) break;
      }

      var candidates = [];
      for (var k = 0; k < topIds.length; k++) {
        var vidId = topIds[k];
        if (chKnownSet.has(vidId)) break;
        if (!existingYtIds.has(vidId) && !blockedSet.has(vidId) && !queuedSet.has(vidId)) candidates.push(vidId);
        if (candidates.length >= 5) break;
      }

      for (var n = 0; n < candidates.length; n++) {
        var newYtId = candidates[n];
        try {
          var nr = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + newYtId);
          var nd = await nr.json();
          if (nd && nd.title) {
            window.qaafChannelUpdatesQueue.unshift({
              id: "upd_" + newYtId,
              ytId: newYtId,
              title: nd.title,
              channel: chName,
              category: chVids[0].category || "bayan",
              lang: chVids[0].lang || "ur",
              audienceMode: chVids[0].audienceMode || "both_family_kids",
              isShort: (tabPath === "/shorts" || /#short/i.test(nd.title)),
              detectedAt: new Date().toLocaleDateString()
            });
            queuedSet.add(newYtId);
            newlyFound++;
          }
        } catch (e) {}
      }
    }

    localStorage.setItem("qaaf_last_channel_scan_ts", String(Date.now()));
    isScanningChNow = false;
    saveUpdatesQueueAndRefreshUI();
    if (newlyFound > 0 && typeof showSyncToast === "function") showSyncToast("🔔 " + newlyFound + " new videos found in approved channels!");
    else if (isManual && typeof showSyncToast === "function") showSyncToast("✅ All approved channels checked. No new videos pending.");
  };

  window.adminApproveChannelUpdateVideo = function(ytId) {
    var item = (window.qaafChannelUpdatesQueue || []).find(function(x) { return x && x.ytId === ytId; });
    if (!item) return;
    if (!videosData.some(function(v) { return v && v.ytId === item.ytId; })) {
      videosData.unshift({
        id: "v_" + item.ytId, ytId: item.ytId, title: item.title, channel: item.channel,
        lang: item.lang || "ur", region: (item.lang || "ur").toUpperCase(), category: item.category || "bayan",
        audienceMode: item.audienceMode || "both_family_kids", kidsSafe: (item.category !== "bayan" && item.audienceMode !== "family_only"),
        channelVerified: true, isShort: !!item.isShort, isCustomAdded: true, duration: "", views: 0, createdAt: Math.floor(Date.now() / 1000)
      });
      localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    }
    window.qaafChannelUpdatesQueue = (window.qaafChannelUpdatesQueue || []).filter(function(x) { return x && x.ytId !== ytId; });
    saveUpdatesQueueAndRefreshUI();
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Approved New Channel Video: " + item.title);
  };

  window.adminRejectChannelUpdateVideo = function(ytId) {
    if (window.qaafRejectedUpdateYtIds.indexOf(ytId) === -1) window.qaafRejectedUpdateYtIds.push(ytId);
    if (Array.isArray(blockedVideoIds) && blockedVideoIds.indexOf(ytId) === -1) {
      blockedVideoIds.push(ytId);
      localStorage.setItem("qaaf_blocked_videos", JSON.stringify(blockedVideoIds));
    }
    window.qaafChannelUpdatesQueue = (window.qaafChannelUpdatesQueue || []).filter(function(x) { return x && x.ytId !== ytId; });
    saveUpdatesQueueAndRefreshUI();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Rejected Channel Update Video: " + ytId);
  };

  window.adminApproveAllChannelUpdates = function() {
    var list = (window.qaafChannelUpdatesQueue || []).slice();
    if (!list.length) return;
    list.forEach(function(item) {
      if (!videosData.some(function(v) { return v && v.ytId === item.ytId; })) {
        videosData.unshift({
          id: "v_" + item.ytId, ytId: item.ytId, title: item.title, channel: item.channel,
          lang: item.lang || "ur", region: (item.lang || "ur").toUpperCase(), category: item.category || "bayan",
          audienceMode: item.audienceMode || "both_family_kids", kidsSafe: (item.category !== "bayan" && item.audienceMode !== "family_only"),
          channelVerified: true, isShort: !!item.isShort, isCustomAdded: true, duration: "", views: 0, createdAt: Math.floor(Date.now() / 1000)
        });
      }
    });
    localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    window.qaafChannelUpdatesQueue = [];
    saveUpdatesQueueAndRefreshUI();
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Approved All New Channel Videos");
  };

  window.renderAdminDailyChannelUpdatesBox = function() {
    var pubPane = document.getElementById("admPane_publish");
    if (!pubPane) return;
    var box = document.getElementById("admDailyChannelUpdatesCard");
    if (!box) {
      box = document.createElement("div");
      box.id = "admDailyChannelUpdatesCard";
      box.className = "bg-[#0e1520] border border-emerald-500/45 rounded-2xl p-4 space-y-3 text-xs shadow-lg";
      var targetCard = pubPane.children[1] || pubPane.firstChild;
      pubPane.insertBefore(box, targetCard);
    }
    var q = (window.qaafChannelUpdatesQueue || []).filter(function(item) { return item && item.channel && !SKIP_CH.has(item.channel); });
    var rowsHtml = !q.length
      ? "<p class=\x22text-slate-400 py-1.5 text-center\x22>✅ All approved channels are up to date. No new videos pending review.</p>"
      : q.map(function(item) {
          var thumb = "https://i.ytimg.com/vi/" + item.ytId + "/mqdefault.jpg";
          return "<div class=\x22bg-black/70 border border-emerald-500/30 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5\x22>" +
            "<div class=\x22flex items-center gap-2.5 min-w-0 flex-1\x22><img src=\x22" + thumb + "\x22 class=\x22w-16 h-10 object-cover rounded-lg border border-white/15 shrink-0\x22 /><div class=\x22min-w-0 flex-1\x22><p class=\x22font-extrabold text-white truncate\x22>" + item.title + "</p><p class=\x22text-[11px] text-emerald-400 font-bold\x22>📺 " + item.channel + " • " + (item.isShort ? "Short" : "Video") + " • " + (item.detectedAt || "New") + "</p></div></div>" +
            "<div class=\x22flex flex-wrap items-center gap-1.5 shrink-0\x22><button type=\x22button\x22 data-ytid=\x22" + item.ytId + "\x22 onclick=\x22playVideoInsideAdminModal(this.getAttribute(\x27data-ytid\x27), \x27Preview\x27)\x22 class=\x22bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer\x22>▶ Preview</button><button type=\x22button\x22 data-ytid=\x22" + item.ytId + "\x22 onclick=\x22adminApproveChannelUpdateVideo(this.getAttribute(\x27data-ytid\x27))\x22 class=\x22bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer\x22>✅ Approve</button><button type=\x22button\x22 data-ytid=\x22" + item.ytId + "\x22 onclick=\x22adminRejectChannelUpdateVideo(this.getAttribute(\x27data-ytid\x27))\x22 class=\x22bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer\x22>🗑️ Delete</button></div>" +
          "</div>";
        }).join("");
    box.innerHTML =
      "<div class=\x22flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5\x22>" +
        "<div><h4 class=\x22text-xs sm:text-sm font-extrabold text-emerald-300 flex items-center gap-2\x22><span>🔔</span> <span>Daily Channel Updates (New Videos)</span> <span class=\x22bg-emerald-500 text-black px-2 py-0.5 rounded-full text-[10px] font-extrabold\x22>" + q.length + "</span></h4><p class=\x22text-[11px] text-slate-400 mt-0.5\x22>Daily scanner checks your approved channels for new uploads so you can preview, approve, or delete them.</p></div>" +
        "<div class=\x22flex items-center gap-1.5\x22>" + (q.length ? "<button type=\x22button\x22 onclick=\x22adminApproveAllChannelUpdates()\x22 class=\x22bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-extrabold shadow cursor-pointer\x22>✅ Approve All</button>" : "") + "<button id=\x22qaafScanChannelsNowBtn\x22 type=\x22button\x22 onclick=\x22scanApprovedChannelsForNewVideos(true)\x22 class=\x22bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 rounded-xl text-[11px] font-extrabold shadow cursor-pointer\x22>🔄 Scan Channels Now</button></div>" +
      "</div>" +
      "<div class=\x22space-y-2 max-h-64 overflow-y-auto pr-1\x22>" + rowsHtml + "</div>";
  };

  // =========================================================================
  // 4. PERSISTENT DISMISSAL FOR FLAGS & REQUESTS (NEVER COME BACK ON REFRESH)
  // =========================================================================
  window.qaafHandledFlagsOrReqIds = new Set(JSON.parse(localStorage.getItem("qaaf_handled_flags_reqs_v1") || "[]"));
  function markIdHandledPermanently(id) {
    if (!id) return;
    window.qaafHandledFlagsOrReqIds.add(String(id));
    try { localStorage.setItem("qaaf_handled_flags_reqs_v1", JSON.stringify(Array.from(window.qaafHandledFlagsOrReqIds).slice(-500))); } catch (e) {}
  }
  ["adminDismissFlag", "adminDeleteFlaggedVideo", "adminApproveRequest", "adminRejectRequest"].forEach(function(fnName) {
    var origFn = window[fnName];
    if (typeof origFn === "function") {
      window[fnName] = function(argId) {
        markIdHandledPermanently(argId);
        var res = origFn.apply(this, arguments);
        if (window.qaafCloudSync) window.qaafCloudSync.pushState("Handled " + fnName + ": " + argId);
        return res;
      };
    }
  });

  var prevAdm102 = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevAdm102) prevAdm102.apply(this, arguments);
    replaceSuperAdminLabels();
    window.renderAdminDailyChannelUpdatesBox();
  };

  fetch(FB_BASE + "/qaaf_channel_updates_queue.json?t=" + Date.now()).then(function(r) { return r.ok ? r.json() : null; }).then(function(d) {
    if (d && typeof d === "object") {
      if (Array.isArray(d.queue)) window.qaafChannelUpdatesQueue = d.queue.filter(function(u) { return u && u.channel && !SKIP_CH.has(u.channel); });
      if (Array.isArray(d.rejectedIds)) window.qaafRejectedUpdateYtIds = d.rejectedIds;
      localStorage.setItem("qaaf_channel_updates_queue_v1", JSON.stringify(window.qaafChannelUpdatesQueue));
      localStorage.setItem("qaaf_rejected_update_ytids_v1", JSON.stringify(window.qaafRejectedUpdateYtIds));
      window.renderAdminDailyChannelUpdatesBox();
    }
  }).catch(function() {});

  setTimeout(function() {
    window.renderAdminDailyChannelUpdatesBox();
    var lastTs = parseInt(localStorage.getItem("qaaf_last_channel_scan_ts") || "0", 10);
    if (Date.now() - lastTs > 12 * 3600 * 1000) window.scanApprovedChannelsForNewVideos(false);
  }, 4000);
})();


// === QAAF V103 SHORTS COMMENTS SHEET & CLICKABLE CHANNELS ===
(function initQaafV103ShortsCommentsAndClickableChannels() {
  function sendYtPlayerCmd(funcName) {
    var ifr = document.getElementById("ytIframe");
    if (ifr && ifr.contentWindow) {
      ifr.contentWindow.postMessage(JSON.stringify({ event: "command", func: funcName, args: [] }), "*");
    }
  }

  // =========================================================================
  // 1. YOUTUBE-STYLE DEDICATED SHORTS COMMENTS SHEET (PAUSES VIDEO & CLOSES CLEANLY)
  // =========================================================================
  function getCommentsListForVideo(vidId) {
    var key = "qaaf_comments_" + vidId;
    try {
      var arr = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(arr) && arr.length) return arr;
    } catch (e) {}
    return [{ author: "QAAF Family", text: "MashaAllah, very beneficial and 100% safe for our kids! JazakAllah Khair.", time: "Featured" }];
  }

  window.submitQaafShortComment = function() {
    var inp = document.getElementById("qaafShortCommentInput");
    if (!inp || !currentPlayingVideoId) return;
    var txt = inp.value.trim();
    if (!txt) return;
    var key = "qaaf_comments_" + currentPlayingVideoId;
    var list = getCommentsListForVideo(currentPlayingVideoId);
    var authorName = (typeof currentUserEmail !== "undefined" && currentUserEmail) ? currentUserEmail.split("@")[0] : "Guest Family";
    list.unshift({ author: authorName, text: txt, time: "Just now" });
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
    inp.value = "";
    window.renderQaafShortCommentsList();
  };

  window.renderQaafShortCommentsList = function() {
    var listBox = document.getElementById("qaafShortCommentsBody");
    var cntEl = document.getElementById("qaafShortCommentsCount");
    if (!listBox || !currentPlayingVideoId) return;
    var list = getCommentsListForVideo(currentPlayingVideoId);
    if (cntEl) cntEl.innerText = String(list.length);
    listBox.innerHTML = list.map(function(c) {
      var initCh = String(c.author || "Q").charAt(0).toUpperCase();
      return "<div class=\x22flex items-start gap-2.5 py-2.5 border-b border-slate-800/80\x22>" +
        "<div class=\x22w-8 h-8 rounded-full bg-[#164e3a] text-white font-extrabold text-xs flex items-center justify-center shrink-0\x22>" + initCh + "</div>" +
        "<div class=\x22min-w-0 flex-1\x22>" +
          "<div class=\x22flex items-center gap-2\x22><span class=\x22text-xs font-extrabold text-white\x22>@" + c.author + "</span><span class=\x22text-[10px] text-slate-400\x22>" + (c.time || "") + "</span></div>" +
          "<p class=\x22text-xs text-slate-200 mt-0.5 leading-relaxed break-words\x22>" + c.text + "</p>" +
        "</div>" +
      "</div>";
    }).join("");
  };

  window.closeShortCommentsSheet = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var backdrop = document.getElementById("qaafShortCommentsBackdrop");
    if (backdrop) backdrop.classList.add("hidden");
    window.qaafShortPlaying = true;
    sendYtPlayerCmd("playVideo");
  };

  window.openShortCommentsPopup = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var box = document.getElementById("playerModalBox");
    if (!box) return;
    var oldScroll = document.getElementById("ytWatchScrollContainer");
    if (oldScroll) oldScroll.classList.add("hidden");

    var backdrop = document.getElementById("qaafShortCommentsBackdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "qaafShortCommentsBackdrop";
      backdrop.className = "hidden";
      box.appendChild(backdrop);
    }

    var isOpen = !backdrop.classList.contains("hidden");
    if (isOpen) {
      window.closeShortCommentsSheet();
      return;
    }

    // Pause video like YouTube Shorts when Comments open
    window.qaafShortPlaying = false;
    sendYtPlayerCmd("pauseVideo");

    backdrop.style.cssText = "position:absolute; inset:0; z-index:95; background:rgba(0,0,0,0.45); display:flex; flex-direction:column; justify-content:flex-end;";
    backdrop.onclick = function(ev) { if (ev.target === backdrop) window.closeShortCommentsSheet(ev); };
    backdrop.innerHTML =
      "<div onclick=\x27event.stopPropagation()\x27 style=\x27background:#161920; border-top:1px solid rgba(255,255,255,0.14); border-radius:20px 20px 0 0; height:64%; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 -10px 30px rgba(0,0,0,0.8);\x27>" +
        "<div style=\x27display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.1); shrink:0;\x27>" +
          "<div style=\x27display:flex; align-items:center; gap:8px;\x27><span style=\x27font-size:14px; font-weight:800; color:#fff;\x27>Comments</span><span id=\x27qaafShortCommentsCount\x27 style=\x27font-size:12px; color:#94a3b8; font-weight:700;\x27>1</span></div>" +
          "<button type=\x27button\x27 onclick=\x27window.closeShortCommentsSheet(event)\x27 style=\x27width:30px; height:30px; border-radius:999px; background:rgba(255,255,255,0.1); color:#fff; border:none; font-size:14px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center;\x27>✕</button>" +
        "</div>" +
        "<div id=\x27qaafShortCommentsBody\x27 style=\x27flex:1 1 auto; overflow-y:auto; padding:8px 16px;\x27></div>" +
        "<div style=\x27padding:10px 12px; border-top:1px solid rgba(255,255,255,0.1); background:#0f1218; display:flex; align-items:center; gap:8px;\x27>" +
          "<input id=\x27qaafShortCommentInput\x27 type=\x27text\x27 placeholder=\x27Add a comment...\x27 onkeydown=\x27if(event.key===\x22Enter\x22)window.submitQaafShortComment()\x27 style=\x27flex:1; background:#1c212b; border:1px solid #334155; border-radius:999px; padding:8px 14px; font-size:12px; color:#fff; outline:none;\x27 />" +
          "<button type=\x27button\x27 onclick=\x27window.submitQaafShortComment()\x27 style=\x27background:#164e3a; color:#fff; border:none; border-radius:999px; padding:8px 14px; font-size:12px; font-weight:800; cursor:pointer;\x27>Post</button>" +
        "</div>" +
      "</div>";
    backdrop.classList.remove("hidden");
    window.renderQaafShortCommentsList();
  };

  // =========================================================================
  // 2. CLICKABLE CHANNEL NAME & AVATAR IN VIDEO WATCH HEADER (OPENS CHANNEL PAGE)
  // =========================================================================
  window.openChannelFromPlayer = function(channelName, ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    if (!channelName) return;
    if (typeof window.closeVideoPlayer === "function") window.closeVideoPlayer();
    if (typeof window.pickChannelFromTopBar === "function") window.pickChannelFromTopBar(channelName);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function makeWatchHeaderChannelClickable() {
    var hdr = document.getElementById("ytCleanWatchHeader");
    var video = (videosData || []).find(function(x) { return x && x.id === currentPlayingVideoId; });
    if (!hdr || !video || !video.channel) return;
    var chName = video.channel;
    var chSpan = hdr.querySelector("span.font-bold, .text-white.font-bold, #playerChannelName");
    var chContainer = chSpan ? chSpan.parentElement : null;
    if (chContainer) {
      chContainer.style.cursor = "pointer";
      chContainer.title = "Open " + chName + " channel";
      chContainer.onclick = function(ev) { window.openChannelFromPlayer(chName, ev); };
    }
    hdr.querySelectorAll("p, span, div").forEach(function(el) {
      if (el.children.length === 0 && el.textContent && el.textContent.trim().indexOf(chName) === 0 && el.textContent.trim().length <= chName.length + 4) {
        el.style.cursor = "pointer";
        el.onclick = function(ev) { window.openChannelFromPlayer(chName, ev); };
      }
    });
  }

  var prevOpenV103 = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    var oldBd = document.getElementById("qaafShortCommentsBackdrop");
    if (oldBd) oldBd.classList.add("hidden");
    if (prevOpenV103) prevOpenV103.apply(this, arguments);
    setTimeout(makeWatchHeaderChannelClickable, 100);
  };
})();


// === QAAF V104 COMMENTS CLOSE & STRONG DIVERSITY ALGORITHM ===
(function initQaafV104CommentsCloseAndStrongAlgorithm() {
  // =========================================================================
  // 1. FIX SHORTS COMMENTS CLOSE BUTTON (INLINE display:none OVERRIDES flex!)
  // =========================================================================
  function sendYtCmd104(fn) {
    var ifr = document.getElementById("ytIframe");
    if (ifr && ifr.contentWindow) ifr.contentWindow.postMessage(JSON.stringify({ event: "command", func: fn, args: [] }), "*");
  }

  window.closeShortCommentsSheet = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var bd = document.getElementById("qaafShortCommentsBackdrop");
    if (bd) {
      bd.style.display = "none";
      bd.classList.add("hidden");
    }
    window.qaafShortPlaying = true;
    sendYtCmd104("playVideo");
  };

  var prevOpenComm104 = window.openShortCommentsPopup;
  window.openShortCommentsPopup = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var bd = document.getElementById("qaafShortCommentsBackdrop");
    if (bd && bd.style.display === "flex") {
      window.closeShortCommentsSheet(e);
      return;
    }
    if (prevOpenComm104) prevOpenComm104(e);
    bd = document.getElementById("qaafShortCommentsBackdrop");
    if (bd) {
      bd.classList.remove("hidden");
      bd.style.display = "flex";
    }
  };

  var prevOpenVid104 = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    var bd = document.getElementById("qaafShortCommentsBackdrop");
    if (bd) { bd.style.display = "none"; bd.classList.add("hidden"); }
    if (prevOpenVid104) prevOpenVid104.apply(this, arguments);
    setTimeout(function() {
      window.filterUpNextByMode("all");
    }, 180);
  };

  // =========================================================================
  // 2. CLEAN WATCH BAR (NO CUT-OFF FLAG BUTTON) & HIDE OVERLAPPING RED VOL BAR
  // =========================================================================
  if (!document.getElementById("qaafV104WatchCleanCss")) {
    var st = document.createElement("style");
    st.id = "qaafV104WatchCleanCss";
    st.textContent = [
      "#qaafCenterRedVolOverlay, #qaafBottomRedVolBar, #qaafRedVolumeSliderWrap { display: none !important; }",
      "#ytCleanWatchHeader > div { flex-wrap: wrap !important; row-gap: 8px !important; }",
      "#ytCleanWatchHeader button { white-space: nowrap !important; }"
    ].join("\n");
    document.head.appendChild(st);
  }

  // =========================================================================
  // 3. STRONG TOPIC & INTEREST ALGORITHM (MAX 1 VIDEO PER NEW/OTHER CHANNEL)
  // =========================================================================
  function getTopicWords(titleStr) {
    return String(titleStr || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff\s]/g, " ").split(/\s+/).filter(function(w) { return w.length >= 4; });
  }

  window.getSmartRelatedVideos = function(currentVidId, wantShortsOnly) {
    var cur = (videosData || []).find(function(v) { return v && v.id === currentVidId; });
    var histIds = (typeof getActiveHistory === "function") ? (getActiveHistory() || []) : [];
    var blockedSet = new Set(blockedVideoIds || []);
    var bannedSet = new Set(bannedChannels || []);
    var chFreq = {}, catFreq = {}, langFreq = {};
    histIds.forEach(function(id, idx) {
      var hv = (videosData || []).find(function(x) { return x && x.id === id; });
      if (!hv) return;
      var w = (idx < 6) ? 3 : 1;
      if (hv.channel) chFreq[hv.channel] = (chFreq[hv.channel] || 0) + w;
      if (hv.category) catFreq[hv.category] = (catFreq[hv.category] || 0) + w;
      if (hv.lang) langFreq[hv.lang] = (langFreq[hv.lang] || 0) + w;
    });
    var curWords = cur ? new Set(getTopicWords(cur.title)) : new Set();

    var candidates = (videosData || []).filter(function(v) {
      if (!v || v.id === currentVidId || blockedSet.has(v.id) || bannedSet.has(v.channel)) return false;
      if (isKidsLocked && !v.kidsSafe) return false;
      var isSh = isVideoShort(v);
      if (v.channel === "Tarbiah Islamic Centre") isSh = true;
      return wantShortsOnly ? isSh : !isSh;
    });

    var scored = candidates.map(function(v) {
      var s = 0;
      if (cur) {
        if (v.category && v.category === cur.category) s += 160;
        if (v.lang && v.lang === cur.lang) s += 80;
        if (v.channel && v.channel === cur.channel) s += 110;
        var vWords = getTopicWords(v.title);
        var overlap = 0;
        for (var i = 0; i < vWords.length; i++) { if (curWords.has(vWords[i])) overlap++; }
        s += Math.min(90, overlap * 30);
      }
      if (catFreq[v.category]) s += Math.min(60, catFreq[v.category] * 12);
      if (chFreq[v.channel]) s += Math.min(45, chFreq[v.channel] * 9);
      if (langFreq[v.lang]) s += Math.min(30, langFreq[v.lang] * 6);
      var rv = (typeof window.getQaafRealViewCount === "function") ? window.getQaafRealViewCount(v) : (v.realViews || 0);
      s += Math.min(25, rv * 3);
      return { video: v, score: s };
    });

    scored.sort(function(a, b) { return b.score - a.score; });

    // Diversity Rule: Max 2 from current channel, and STRICTLY MAX 1 from any other channel (so newly updated channels never flood!)
    var out = [], usedIds = new Set(), chCount = {};
    var curCh = cur ? cur.channel : "";
    scored.forEach(function(item) {
      var ch = item.video.channel || "General";
      var limit = (ch === curCh) ? 2 : 1;
      if ((chCount[ch] || 0) < limit) {
        chCount[ch] = (chCount[ch] || 0) + 1;
        out.push(item.video);
        usedIds.add(item.video.id);
      }
    });
    // Fill remaining slots round-robin (max 2 per channel) only if needed
    if (out.length < 12) {
      scored.forEach(function(item) {
        if (out.length >= 16 || usedIds.has(item.video.id)) return;
        var ch = item.video.channel || "General";
        if ((chCount[ch] || 0) < 2) {
          chCount[ch] = (chCount[ch] || 0) + 1;
          out.push(item.video);
          usedIds.add(item.video.id);
        }
      });
    }
    return out;
  };

  // Override filterUpNextByMode so it ALWAYS uses real views (never 0.0K) & never shows fake 12:00
  window.filterUpNextByMode = function(mode) {
    var cur = (videosData || []).find(function(x) { return x && x.id === currentPlayingVideoId; });
    var upNextGrid = document.getElementById("watchUpNextGrid");
    if (!upNextGrid || !cur) return;
    ["all", "channel", "related"].forEach(function(mKey) {
      var pBtn = document.getElementById("qaafUpNextPill_" + mKey);
      if (pBtn) pBtn.className = (mode === mKey) ? "px-3 py-1 rounded-lg text-xs font-extrabold bg-white text-black cursor-pointer shrink-0" : "px-3 py-1 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0";
    });
    var list;
    if (mode === "channel") {
      list = (videosData || []).filter(function(v) { return v && v.id !== cur.id && v.channel === cur.channel && !isVideoShort(v); });
    } else if (mode === "related") {
      list = window.getSmartRelatedVideos(cur.id, false).filter(function(v) { return v.channel !== cur.channel; });
    } else {
      list = window.getSmartRelatedVideos(cur.id, false);
    }
    upNextGrid.innerHTML = "";
    list.slice(0, 14).forEach(function(v) {
      var thumb = v.customThumb || ("https://i.ytimg.com/vi/" + v.ytId + "/hqdefault.jpg");
      var rv = (typeof window.getQaafRealViewCount === "function") ? window.getQaafRealViewCount(v) : (v.realViews || 0);
      var vStr = rv === 1 ? "1 view" : (rv + " views");
      var durStr = (v.duration && v.duration !== "12:00" && v.duration !== "12:45" && v.duration !== "14:20" && v.duration !== "10:00") ? v.duration : "";
      var a = document.createElement("a");
      if (!isKidsLocked) a.href = "?watch=" + encodeURIComponent(v.id);
      a.onclick = function(e) { return handleQaafVideoLinkClick(e, v.id); };
      a.className = "bg-[#181818] hover:bg-[#222] rounded-xl overflow-hidden border border-white/10 flex sm:flex-col gap-2.5 p-2 sm:p-0 cursor-pointer transition group no-underline text-inherit";
      a.innerHTML = "<div class=\x27relative w-36 sm:w-full aspect-video bg-slate-900 rounded-lg sm:rounded-none overflow-hidden shrink-0 pointer-events-none\x27><img src=\x27" + thumb + "\x27 alt=\x27\x27 class=\x27absolute inset-0 w-full h-full object-cover\x27 loading=\x27lazy\x27 />" + (durStr ? "<span class=\x27absolute bottom-1 right-1 bg-black/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded\x27>" + durStr + "</span>" : "") + "</div><div class=\x27p-1 sm:p-2.5 min-w-0 flex-1\x27><h5 class=\x27text-xs font-bold text-white line-clamp-2 leading-snug\x27>" + v.title + "</h5><p class=\x27text-[10px] text-slate-400 mt-1 truncate\x27>✅ " + v.channel + " • " + vStr + "</p></div>";
      upNextGrid.appendChild(a);
    });
  };

  // Also enforce Home Feed channel diversity (max 1 consecutive video per newly updated channel on All feed)
  var prevRender104 = window.renderVideosNow;
  window.renderVideosNow = function() {
    if (prevRender104) prevRender104.apply(this, arguments);
    var grid = document.getElementById("videoGrid");
    if (!grid) return;
    if ((window.qaafSelectedChannel || "ALL") === "ALL") {
      var cards = Array.from(grid.children);
      var chSeen = {};
      var primary = [], overflow = [];
      cards.forEach(function(card) {
        var chEl = card.querySelector("p.text-slate-400, .text-xs.text-slate-400");
        var chTxt = chEl ? (chEl.textContent || "").split("•")[0].replace(/[✅📺]/g, "").trim() : "";
        if (!chTxt) { primary.push(card); return; }
        chSeen[chTxt] = (chSeen[chTxt] || 0) + 1;
        if (chSeen[chTxt] <= 1) primary.push(card);
        else overflow.push(card);
      });
      if (overflow.length > 0 && primary.length > 2) {
        primary.concat(overflow).forEach(function(c) { grid.appendChild(c); });
      }
    }
  };
})();

// === QAAF V106 ZERO-OVERLAP CLEAN PLAYER & SHORTS SPACING ===
(function initQaafV106ZeroOverlapCleanPlayer() {
  if (!document.getElementById("qaafV106ZeroOverlapCss")) {
    var st = document.createElement("style");
    st.id = "qaafV106ZeroOverlapCss";
    st.textContent = [
      "#qaafBottomSeekVolBar, #qaafMinimalTopLeftClose, #qaafQuickTopRightBox, #ytTopControlBar { display: none !important; opacity: 0 !important; pointer-events: none !important; }",
      "#qaafCleanYtControls, #qaafRegularClickShield, #qaafShortsBottomTrack, #qaafShortsTopMiniBtns, #qaafCenterPopIcon { display: none !important; }",
      "#qaafYtShortsMasterOverlay { bottom: 74px !important; right: 8px !important; gap: 10px !important; }"
    ].join("\n");
    document.head.appendChild(st);
  }
  var oldVol = document.getElementById("qaafBottomSeekVolBar");
  if (oldVol) oldVol.remove();
})();


// === QAAF V107 FIX KIDS LOCK & PIN MODAL Z-INDEX ===
(function initQaafV107FixKidsLockAndPinModal() {
  if (!document.getElementById("qaafV107KidsZIndexCss")) {
    var st = document.createElement("style");
    st.id = "qaafV107KidsZIndexCss";
    st.textContent = "#kidsTimerSetupModal, #parentModal, #kidsTimeUpLockOverlay, #accountModal { z-index: 1350 !important; }";
    document.head.appendChild(st);
  }

  window.openKidsLockOrTimer = function(ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    if (!isKidsLocked) {
      if (!currentUserEmail) {
        if (typeof closeVideoPlayer === "function") closeVideoPlayer();
        if (typeof openAccountModal === "function") openAccountModal("Please Sign In or Continue with Gmail to use Kids Mode & PIN!");
        var am = document.getElementById("accountModal");
        if (am) { am.classList.remove("hidden"); am.style.display = "flex"; }
        return;
      }
      if (typeof closeVideoPlayer === "function") closeVideoPlayer();
      var now = new Date();
      var later = new Date(now.getTime() + 15 * 60000);
      var stInp = document.getElementById("kidsClockStartInput");
      var enInp = document.getElementById("kidsClockEndInput");
      if (stInp) stInp.value = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      if (enInp) enInp.value = String(later.getHours()).padStart(2, "0") + ":" + String(later.getMinutes()).padStart(2, "0");
      var km = document.getElementById("kidsTimerSetupModal");
      if (km) {
        km.classList.remove("hidden");
        km.style.display = "flex";
      }
    } else {
      if (typeof openParentalGate === "function") openParentalGate("unlock");
      var pm = document.getElementById("parentModal");
      if (pm) {
        pm.classList.remove("hidden");
        pm.style.display = "flex";
      }
    }
  };

  window.toggleKidsMode = function(ev) {
    window.openKidsLockOrTimer(ev);
  };

  var origStartK = window.startKidsModeWithTimer;
  window.startKidsModeWithTimer = function(minutes, isRestoring) {
    var km = document.getElementById("kidsTimerSetupModal");
    if (km) { km.classList.add("hidden"); km.style.display = "none"; }
    if (origStartK) origStartK.apply(this, arguments);
  };

  var closeKmBtn = document.getElementById("closeKidsTimerModalBtn");
  if (closeKmBtn) {
    closeKmBtn.onclick = function() {
      var km = document.getElementById("kidsTimerSetupModal");
      if (km) { km.classList.add("hidden"); km.style.display = "none"; }
    };
  }

  var origClosePm = window.closeParentModal;
  window.closeParentModal = function() {
    var pm = document.getElementById("parentModal");
    if (pm) { pm.classList.add("hidden"); pm.style.display = "none"; }
    if (origClosePm) origClosePm.apply(this, arguments);
  };

  var origOpenPg = window.openParentalGate;
  window.openParentalGate = function(purpose) {
    if (origOpenPg) origOpenPg.apply(this, arguments);
    var pm = document.getElementById("parentModal");
    if (pm) { pm.classList.remove("hidden"); pm.style.display = "flex"; }
  };

  var origCloseAcc = window.closeAccountModal;
  window.closeAccountModal = function() {
    var am = document.getElementById("accountModal");
    if (am) { am.classList.add("hidden"); am.style.display = "none"; }
    if (origCloseAcc) origCloseAcc.apply(this, arguments);
  };

  var kBtn = document.getElementById("kidsLockBtn");
  if (kBtn) {
    kBtn.removeAttribute("onclick");
    kBtn.onclick = function(ev) { window.toggleKidsMode(ev); };
  }
  var drwKBtn = document.getElementById("drawerKidsTimerBtn");
  if (drwKBtn) {
    drwKBtn.onclick = function(ev) {
      if (typeof closeQaafProfileDrawer === "function") closeQaafProfileDrawer();
      window.openKidsLockOrTimer(ev);
    };
  }
})();


// === QAAF V108 COMPLETE LIGHT THEME & PASSWORD EYE TOGGLES ===
(function initQaafV108FullLightThemeAndPasswordEyes() {
  // =========================================================================
  // 1. COMPLETE LIGHT MODE (TOTAL WHITE FLIP) + MOBILE HEADER FIT + SHORTS FLAG CLEARANCE
  // =========================================================================
  if (!document.getElementById("qaafV108CompleteLightCss")) {
    var st = document.createElement("style");
    st.id = "qaafV108CompleteLightCss";
    st.textContent = [
      "/* Move Shorts 4 buttons cleanly above YouTube fullscreen arrow */",
      "#qaafYtShortsMasterOverlay { bottom: 112px !important; right: 8px !important; gap: 10px !important; }",
      "/* Keep mobile header compact so Kids Lock button never clips on right edge */",
      "@media (max-width: 440px) { #mainHeader { padding-left: 4px !important; padding-right: 4px !important; gap: 2px !important; } #headerRightControls { gap: 3px !important; } #kidsLockBtn { padding-left: 6px !important; padding-right: 7px !important; } }",

      "/* COMPLETE LIGHT MODE: Flip ALL dark surfaces to crisp White / Light Slate */",
      "body.qaaf-light-mode, body.qaaf-light-mode.bg-islamic-family, body.qaaf-light-mode.bg-islamic-kids { background: #ffffff !important; background-color: #ffffff !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #mainHeader { background: rgba(255,255,255,0.98) !important; border-bottom: 1px solid #e2e8f0 !important; }",
      "body.qaaf-light-mode #brandMainPrefix { color: #0f172a !important; }",
      "body.qaaf-light-mode #headerDrawerMenuBtn, body.qaaf-light-mode #accountBtn, body.qaaf-light-mode #parentPanelBtn, body.qaaf-light-mode #langDropdownContainer > button { background: #f1f5f9 !important; color: #0f172a !important; border: 1px solid #cbd5e1 !important; }",
      "body.qaaf-light-mode #qaafHeaderSearchToggleBtn svg circle, body.qaaf-light-mode #qaafHeaderSearchToggleBtn svg line { stroke: #0f172a !important; }",
      "body.qaaf-light-mode #qaafHeaderSearchToggleBtn svg text { fill: #0f172a !important; }",
      "body.qaaf-light-mode #categoryBar { background: rgba(255,255,255,0.98) !important; border-bottom: 1px solid #e2e8f0 !important; }",
      "body.qaaf-light-mode #categoryBar .cat-chip:not(.bg-emerald-500), body.qaaf-light-mode #categoryBar .sort-chip:not(.bg-emerald-600) { background: #f1f5f9 !important; color: #0f172a !important; border: 1px solid #e2e8f0 !important; }",

      "/* Bottom Mobile Nav Bar -> Pure White in Light Mode */",
      "body.qaaf-light-mode #qaafMobileBottomNav, body.qaaf-light-mode #qaafMobileBottomNav > div { background: #ffffff !important; background-color: #ffffff !important; border-top: 1px solid #cbd5e1 !important; }",
      "body.qaaf-light-mode #qaafMobileBottomNav button { color: #475569 !important; }",
      "body.qaaf-light-mode #qaafMobileBottomNav button.text-white, body.qaaf-light-mode #qaafMobileBottomNav button.text-emerald-400 { color: #164e3a !important; font-weight: 800 !important; }",

      "/* Left Sidebar Drawer -> Every single dark card/button flipped cleanly */",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer { background: #ffffff !important; color: #0f172a !important; border-right: 1px solid #cbd5e1 !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer > div:first-child { background: #f8fafc !important; border-bottom: 1px solid #e2e8f0 !important; }",
      "body.qaaf-light-mode #drawerCloseBtn { background: #e2e8f0 !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer .rounded-xl, body.qaaf-light-mode #qaafLeftSidebarDrawer .bg-slate-900\\/90, body.qaaf-light-mode #qaafLeftSidebarDrawer .bg-black\\/40, body.qaaf-light-mode #qaafDrawerExtraMenuItems > button, body.qaaf-light-mode #qaafDrawerExtraMenuItems > a, body.qaaf-light-mode #qaafDrawerExtraMenuItems > div { background: #f1f5f9 !important; background-image: none !important; border: 1px solid #cbd5e1 !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer #drawerSub_playlists, body.qaaf-light-mode #qaafLeftSidebarDrawer #drawerSub_history { background: #ffffff !important; border-top: 1px solid #e2e8f0 !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer #drawerSub_playlists *, body.qaaf-light-mode #qaafLeftSidebarDrawer #drawerSub_history * { color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer #drawerBottomAuthArea { background: #f8fafc !important; border-top: 1px solid #e2e8f0 !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer #drawerAuthModalBtn { background: #164e3a !important; color: #ffffff !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer #drawerAuthModalBtn span { color: #ffffff !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer #qaafThemeToggleBtn { background: #0f172a !important; color: #ffffff !important; border-color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer #qaafThemeToggleBtn span { color: #ffffff !important; }",

      "/* Video Watch Screen & Up Next -> White in Light Mode */",
      "body.qaaf-light-mode #playerModal:not(.qaaf-shorts-mode), body.qaaf-light-mode #playerModal:not(.qaaf-shorts-mode) #playerModalBox, body.qaaf-light-mode #ytWatchScrollContainer { background: #ffffff !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #playingTitle, body.qaaf-light-mode #playingChannelName, body.qaaf-light-mode #ytWatchScrollContainer h4, body.qaaf-light-mode #ytWatchScrollContainer h5 { color: #0f172a !important; }",
      "body.qaaf-light-mode #ytCleanWatchHeader button { background: #f1f5f9 !important; color: #0f172a !important; border: 1px solid #cbd5e1 !important; }",
      "body.qaaf-light-mode #ytCleanWatchHeader button span { color: #0f172a !important; }",
      "body.qaaf-light-mode #ytCleanWatchHeader .bg-\\[\\#1e1e1e\\], body.qaaf-light-mode #expandedCommentsDrawer, body.qaaf-light-mode #watchUpNextGrid > a { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #latestCommentPreviewText, body.qaaf-light-mode #playingViewsText { color: #475569 !important; }",
      "body.qaaf-light-mode #qaafUpNextFilterPillsBar button { background: #e2e8f0 !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafUpNextFilterPillsBar button.bg-white { background: #0f172a !important; color: #ffffff !important; }",

      "/* Login, Parent Settings & Kids Timer Modals -> Clean White in Light Mode */",
      "body.qaaf-light-mode #accountModal > div, body.qaaf-light-mode #parentModal > div, body.qaaf-light-mode #kidsTimerSetupModal > div, body.qaaf-light-mode #flagVideoModal > div, body.qaaf-light-mode #playlistSelectorModal > div, body.qaaf-light-mode #langDropdownMenu, body.qaaf-light-mode #allChannelsDropdownPopup { background: #ffffff !important; color: #0f172a !important; border-color: #cbd5e1 !important; }",
      "body.qaaf-light-mode #accountModal h3, body.qaaf-light-mode #accountModal label, body.qaaf-light-mode #parentModal h3, body.qaaf-light-mode #parentModal h4, body.qaaf-light-mode #kidsTimerSetupModal h3 { color: #0f172a !important; }",
      "body.qaaf-light-mode #accountModal input, body.qaaf-light-mode #parentModal input, body.qaaf-light-mode #kidsTimerSetupModal input, body.qaaf-light-mode #langDropdownMenu select { background: #f8fafc !important; color: #0f172a !important; border-color: #cbd5e1 !important; }",
      "body.qaaf-light-mode #regionalPromoBar { background: #f1f5f9 !important; border-top: 1px solid #cbd5e1 !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #promoTickerLink { color: #0f172a !important; }"
    ].join("\n");
    document.head.appendChild(st);
  }

  // =========================================================================
  // 2. UNIVERSAL SHOW / HIDE EYE ICON ON ALL PASSWORD & KIDS PIN INPUTS
  // =========================================================================
  var EYE_SHOW_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2717\x27 height=\x2717\x27 fill=\x27none\x27 stroke=\x27currentColor\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27><path d=\x27M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\x27/><circle cx=\x2712\x27 cy=\x2712\x27 r=\x273\x27/></svg>";
  var EYE_HIDE_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2717\x27 height=\x2717\x27 fill=\x27none\x27 stroke=\x27currentColor\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27><path d=\x27M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24\x27/><line x1=\x271\x27 y1=\x271\x27 x2=\x2723\x27 y2=\x2723\x27/></svg>";

  function attachEyeToggleToInput(inp) {
    if (!inp || inp.getAttribute("data-eye-attached") === "1") return;
    inp.setAttribute("data-eye-attached", "1");

    var isDiscMasked = (inp.style.webkitTextSecurity === "disc" || (inp.getAttribute("style") || "").indexOf("text-security") !== -1);
    var isPassType = (inp.type === "password");
    if (!isDiscMasked && !isPassType) return;

    var wrap = document.createElement("div");
    wrap.style.cssText = "position:relative; display:inline-flex; align-items:center; width:" + (inp.classList.contains("w-full") ? "100%" : (inp.classList.contains("w-48") ? "12rem" : (inp.classList.contains("w-44") ? "11rem" : "100%"))) + "; margin:0 auto;";
    if (inp.classList.contains("flex-1")) wrap.classList.add("flex-1");

    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    inp.style.paddingRight = "38px";
    inp.style.width = "100%";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Show / Hide";
    btn.setAttribute("aria-label", "Toggle Password Visibility");
    btn.style.cssText = "position:absolute; right:8px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:#94a3b8; cursor:pointer; padding:4px; display:flex; align-items:center; justify-content:center; z-index:5;";
    btn.innerHTML = EYE_SHOW_SVG;

    var revealed = false;
    btn.onclick = function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      revealed = !revealed;
      if (isPassType) {
        inp.type = revealed ? "text" : "password";
      }
      if (isDiscMasked || inp.style.webkitTextSecurity) {
        inp.style.webkitTextSecurity = revealed ? "none" : "disc";
        inp.style.textSecurity = revealed ? "none" : "disc";
      }
      btn.innerHTML = revealed ? EYE_HIDE_SVG : EYE_SHOW_SVG;
      btn.style.color = revealed ? "#10b981" : "#94a3b8";
    };
    wrap.appendChild(btn);
  }

  function scanAndAttachPasswordEyes() {
    var targetIds = ["userPasswordInput", "signupPassInput", "signupPinInput", "resetNewPassDirectInput", "pinInput", "newPinInput", "confirmPinInput", "timeUpParentPinInput", "googleQuickPinInput"];
    targetIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) attachEyeToggleToInput(el);
    });
    document.querySelectorAll("input[type=\x27password\x27], input[style*=\x27text-security\x27]").forEach(function(el) {
      attachEyeToggleToInput(el);
    });
  }

  scanAndAttachPasswordEyes();
  ["openAccountModal", "openParentalGate", "openKidsLockOrTimer", "openInAppPasswordRecovery", "switchAuthModalTab"].forEach(function(fn) {
    var orig = window[fn];
    if (typeof orig === "function") {
      window[fn] = function() {
        var res = orig.apply(this, arguments);
        setTimeout(scanAndAttachPasswordEyes, 60);
        return res;
      };
    }
  });
})();


// === QAAF V109 SPONSOR OPTIONAL BOXES, FOOTER SWAP & REAL PASS EYES ===
(function initQaafV109SponsorBoxesFooterSwapAndRealPassEyes() {
  // =========================================================================
  // 1. CSS FOR SHORTS FLAG CLEARANCE & FOOTER/SPONSOR SWAP
  // =========================================================================
  if (!document.getElementById("qaafV109FooterAndSponsorCss")) {
    var st = document.createElement("style");
    st.id = "qaafV109FooterAndSponsorCss";
    st.textContent = [
      "#qaafYtShortsMasterOverlay { bottom: 128px !important; right: 8px !important; gap: 10px !important; }",
      "#regionalPromoBar { display: flex !important; position: fixed !important; left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 155 !important; transition: transform 0.25s ease, opacity 0.25s ease !important; }",
      "#regionalPromoBar.qaaf-promo-hidden { transform: translateY(115%) !important; opacity: 0 !important; pointer-events: none !important; }",
      "body.qaaf-player-open #regionalPromoBar, body.qaaf-player-open #qaafMobileBottomNav, body.bg-islamic-kids #regionalPromoBar { transform: translateY(115%) !important; opacity: 0 !important; pointer-events: none !important; }",
      "#qaafMobileBottomNav { z-index: 165 !important; transition: transform 0.25s ease, opacity 0.25s ease !important; }",
      "#qaafMobileBottomNav.qaaf-nav-hidden { transform: translateY(115%) !important; opacity: 0 !important; pointer-events: none !important; }"
    ].join("\n");
    document.head.appendChild(st);
  }

  // =========================================================================
  // 2. OPTIONAL LEFT & RIGHT FIXED BOXES IN SPONSOR BAR + ADMIN CONTROLS
  // =========================================================================
  function getSponsorBoxConfig() {
    var def = { leftEnabled: false, leftText: "", leftUrl: "", rightEnabled: true, rightText: "📩 Contact", rightUrl: "" };
    try {
      var saved = JSON.parse(localStorage.getItem("qaaf_sponsor_boxes_cfg_v1") || "null");
      if (saved && typeof saved === "object") return Object.assign(def, saved);
    } catch (e) {}
    if (typeof regionalPromos !== "undefined" && regionalPromos && regionalPromos._boxConfig) {
      return Object.assign(def, regionalPromos._boxConfig);
    }
    return def;
  }

  window.applySponsorFixedBoxesUI = function() {
    var bar = document.getElementById("regionalPromoBar");
    if (!bar) return;
    if (isKidsLocked || !isPromoBarEnabled) {
      bar.classList.add("qaaf-promo-hidden");
      return;
    }
    var cfg = getSponsorBoxConfig();

    // Left Fixed Box (Optional)
    var leftTag = document.getElementById("promoRegionTag");
    if (leftTag) {
      if (cfg.leftEnabled && cfg.leftText && cfg.leftText.trim()) {
        leftTag.style.display = "inline-flex";
        leftTag.style.cursor = cfg.leftUrl ? "pointer" : "default";
        leftTag.innerText = cfg.leftText.trim();
        leftTag.onclick = cfg.leftUrl ? function() { window.open(cfg.leftUrl, "_blank", "noopener"); } : null;
      } else {
        leftTag.style.display = "none";
      }
    }

    // Right Fixed Box / Contact Button (Optional)
    var rightBtn = bar.querySelector("button[onclick*=\x27openSponsorContactModal\x27], #qaafPromoRightFixedBtn");
    if (rightBtn) {
      rightBtn.id = "qaafPromoRightFixedBtn";
      if (cfg.rightEnabled && cfg.rightText && cfg.rightText.trim()) {
        rightBtn.style.display = "inline-flex";
        rightBtn.innerText = cfg.rightText.trim();
        rightBtn.removeAttribute("onclick");
        rightBtn.onclick = function() {
          if (cfg.rightUrl && cfg.rightUrl.trim()) window.open(cfg.rightUrl.trim(), "_blank", "noopener");
          else if (typeof openSponsorContactModal === "function") openSponsorContactModal();
        };
      } else {
        rightBtn.style.display = "none";
      }
    }
  };

  window.adminSaveSponsorFixedBoxes = function() {
    var cfg = {
      leftEnabled: !!(document.getElementById("admLeftBoxToggle") && document.getElementById("admLeftBoxToggle").checked),
      leftText: (document.getElementById("admLeftBoxText") ? document.getElementById("admLeftBoxText").value : "").trim(),
      leftUrl: (document.getElementById("admLeftBoxUrl") ? document.getElementById("admLeftBoxUrl").value : "").trim(),
      rightEnabled: !!(document.getElementById("admRightBoxToggle") && document.getElementById("admRightBoxToggle").checked),
      rightText: (document.getElementById("admRightBoxText") ? document.getElementById("admRightBoxText").value : "").trim(),
      rightUrl: (document.getElementById("admRightBoxUrl") ? document.getElementById("admRightBoxUrl").value : "").trim()
    };
    localStorage.setItem("qaaf_sponsor_boxes_cfg_v1", JSON.stringify(cfg));
    if (typeof regionalPromos !== "undefined" && regionalPromos) {
      regionalPromos._boxConfig = cfg;
      localStorage.setItem("qaaf_regional_promos_v7", JSON.stringify(regionalPromos));
    }
    window.applySponsorFixedBoxesUI();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Updated Sponsor Left/Right Fixed Boxes");
    if (typeof showSyncToast === "function") showSyncToast("✅ Sponsor Fixed Boxes updated live!");
  };

  function injectSponsorBoxControlsInAdmin() {
    var spPane = document.getElementById("admPane_sponsors");
    if (!spPane || document.getElementById("admSponsorFixedBoxesCard")) return;
    var cfg = getSponsorBoxConfig();
    var card = document.createElement("div");
    card.id = "admSponsorFixedBoxesCard";
    card.className = "bg-[#141923] border border-emerald-500/40 rounded-2xl p-4 space-y-3 text-xs mt-3";
    card.innerHTML =
      "<div class=\x22border-b border-slate-800 pb-2\x22><h5 class=\x22font-extrabold text-emerald-300\x22>🎛️ Optional Left &amp; Right Fixed Boxes on Sponsor Bar</h5><p class=\x22text-[11px] text-slate-400 mt-0.5\x22>Turn Left or Right fixed boxes ON/OFF anytime. Leave OFF for a clean full-width moving ticker.</p></div>" +
      "<div class=\x22grid grid-cols-1 sm:grid-cols-2 gap-3\x22>" +
        "<div class=\x22bg-black/60 border border-slate-800 rounded-xl p-3 space-y-2\x22>" +
          "<label class=\x22flex items-center justify-between font-extrabold text-amber-300 cursor-pointer\x22><span>⬅️ Left Fixed Box</span><input id=\x22admLeftBoxToggle\x22 type=\x22checkbox\x22 " + (cfg.leftEnabled ? "checked" : "") + " class=\x22accent-emerald-500 w-4 h-4\x22 /></label>" +
          "<input id=\x22admLeftBoxText\x22 type=\x22text\x22 value=\x22" + (cfg.leftText || "") + "\x22 placeholder=\x22Left box text (optional)\x22 class=\x22w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white\x22 />" +
          "<input id=\x22admLeftBoxUrl\x22 type=\x22text\x22 value=\x22" + (cfg.leftUrl || "") + "\x22 placeholder=\x22Optional click URL (https://...)\x22 class=\x22w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white\x22 />" +
        "</div>" +
        "<div class=\x22bg-black/60 border border-slate-800 rounded-xl p-3 space-y-2\x22>" +
          "<label class=\x22flex items-center justify-between font-extrabold text-emerald-300 cursor-pointer\x22><span>➡️ Right Fixed Box / Contact</span><input id=\x22admRightBoxToggle\x22 type=\x22checkbox\x22 " + (cfg.rightEnabled ? "checked" : "") + " class=\x22accent-emerald-500 w-4 h-4\x22 /></label>" +
          "<input id=\x22admRightBoxText\x22 type=\x22text\x22 value=\x22" + (cfg.rightText || "") + "\x22 placeholder=\x22e.g. 📩 Contact\x22 class=\x22w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white\x22 />" +
          "<input id=\x22admRightBoxUrl\x22 type=\x22text\x22 value=\x22" + (cfg.rightUrl || "") + "\x22 placeholder=\x22Leave blank to open Contact form\x22 class=\x22w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white\x22 />" +
        "</div>" +
      "</div>" +
      "<button type=\x22button\x22 onclick=\x22window.adminSaveSponsorFixedBoxes()\x22 class=\x22w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl font-extrabold shadow cursor-pointer\x22>💾 Save Sponsor Fixed Boxes</button>";
    spPane.appendChild(card);
  }

  // =========================================================================
  // 3. SMOOTH FOOTER SWAP: MOBILE TOP -> BOTTOM NAV; SCROLL DOWN -> SPONSOR BAR
  // =========================================================================
  var lastSwapY = 0;
  var swapLockUntil = 0;
  function syncBottomNavAndSponsorSwap(forceState) {
    var nav = document.getElementById("qaafMobileBottomNav");
    var promo = document.getElementById("regionalPromoBar");
    var isMobile = window.innerWidth < 768;
    var modal = document.getElementById("playerModal");
    var isPlayerOpen = modal && !modal.classList.contains("hidden");
    if (promo) promo.classList.remove("hidden");
    window.applySponsorFixedBoxesUI();

    if (isPlayerOpen) {
      if (nav) nav.classList.add("qaaf-nav-hidden");
      if (promo) promo.classList.add("qaaf-promo-hidden");
      return;
    }

    if (!isMobile) {
      if (nav) nav.classList.add("qaaf-nav-hidden");
      if (promo) {
        if (!isKidsLocked && isPromoBarEnabled) promo.classList.remove("qaaf-promo-hidden");
        else promo.classList.add("qaaf-promo-hidden");
      }
      return;
    }

    // Mobile: Stage 1 (Top / Scroll Up) = Bottom Nav visible, Sponsor hidden. Scroll Down = Bottom Nav hides, Sponsor shows!
    var showSponsorNow = (forceState === "sponsor");
    if (forceState === "auto") {
      var curY = window.scrollY || document.documentElement.scrollTop || 0;
      if (curY < 40) showSponsorNow = false;
      else if (curY > lastSwapY + 14) showSponsorNow = true;
      else if (curY < lastSwapY - 14) showSponsorNow = false;
      else return;
      lastSwapY = curY;
      if (Date.now() < swapLockUntil) return;
      swapLockUntil = Date.now() + 260;
    }

    if (showSponsorNow && !isKidsLocked && isPromoBarEnabled) {
      if (nav) nav.classList.add("qaaf-nav-hidden");
      if (promo) promo.classList.remove("qaaf-promo-hidden");
    } else {
      if (nav) nav.classList.remove("qaaf-nav-hidden");
      if (promo) promo.classList.add("qaaf-promo-hidden");
    }
  }

  window.addEventListener("scroll", function() { syncBottomNavAndSponsorSwap("auto"); }, { passive: true });
  window.addEventListener("resize", function() { syncBottomNavAndSponsorSwap("nav"); }, { passive: true });
  var prevCloseV109 = window.closeVideoPlayer;
  window.closeVideoPlayer = function() {
    if (prevCloseV109) prevCloseV109.apply(this, arguments);
    setTimeout(function() { syncBottomNavAndSponsorSwap("nav"); }, 60);
  };
  var prevSyncPromo109 = window.syncRegionalPromoBar;
  window.syncRegionalPromoBar = function() {
    if (prevSyncPromo109) prevSyncPromo109.apply(this, arguments);
    window.applySponsorFixedBoxesUI();
    syncBottomNavAndSponsorSwap("nav");
  };
  setTimeout(function() { syncBottomNavAndSponsorSwap("nav"); }, 450);

  // =========================================================================
  // 4. ATTACH WORKING SHOW/HIDE EYE TO ALL REAL PASSWORD & PIN INPUT IDs
  // =========================================================================
  var EYE_OPEN = "<svg viewBox=\x270 0 24 24\x27 width=\x2717\x27 height=\x2717\x27 fill=\x27none\x27 stroke=\x27currentColor\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27><path d=\x27M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\x27/><circle cx=\x2712\x27 cy=\x2712\x27 r=\x273\x27/></svg>";
  var EYE_OFF = "<svg viewBox=\x270 0 24 24\x27 width=\x2717\x27 height=\x2717\x27 fill=\x27none\x27 stroke=\x27currentColor\x27 stroke-width=\x272\x27 stroke-linecap=\x27round\x27 stroke-linejoin=\x27round\x27><path d=\x27M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24\x27/><line x1=\x271\x27 y1=\x271\x27 x2=\x2723\x27 y2=\x2723\x27/></svg>";

  function bindAllRealPasswordAndPinEyes() {
    var realIds = ["userPassInput", "regPassInput", "regPinInput", "pinInput", "newPinInput", "confirmPinInput", "timeUpParentPinInput", "resetNewPassDirectInput", "googleQuickPinInput"];
    realIds.forEach(function(id) {
      var inp = document.getElementById(id);
      if (!inp || inp.getAttribute("data-v109-eye") === "1") return;
      inp.setAttribute("data-v109-eye", "1");
      var existingWrap = inp.parentNode;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.title = "Show / Hide";
      btn.style.cssText = "position:absolute; right:8px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:#94a3b8; cursor:pointer; padding:4px; display:flex; align-items:center; justify-content:center; z-index:10;";
      btn.innerHTML = EYE_OPEN;

      if (!existingWrap || getComputedStyle(existingWrap).position !== "relative" || existingWrap.children.length > 2) {
        var wrap = document.createElement("div");
        wrap.style.cssText = "position:relative; display:inline-flex; align-items:center; width:" + (inp.classList.contains("w-48") ? "12rem" : (inp.classList.contains("w-44") ? "11rem" : "100%")) + "; margin:0 auto;";
        if (inp.classList.contains("flex-1")) wrap.classList.add("flex-1");
        inp.parentNode.insertBefore(wrap, inp);
        wrap.appendChild(inp);
        existingWrap = wrap;
      }
      inp.style.paddingRight = "38px";
      inp.style.width = "100%";
      existingWrap.appendChild(btn);

      btn.onclick = function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        var nowRevealed = inp.classList.toggle("qaaf-pass-revealed");
        if (inp.type === "password" && nowRevealed) { inp.dataset.wasPwd = "1"; inp.type = "text"; }
        else if (inp.dataset.wasPwd === "1" && !nowRevealed) { inp.type = "password"; }
        btn.innerHTML = nowRevealed ? EYE_OFF : EYE_OPEN;
        btn.style.color = nowRevealed ? "#10b981" : "#94a3b8";
      };
    });
  }

  bindAllRealPasswordAndPinEyes();
  var prevAdm109 = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevAdm109) prevAdm109.apply(this, arguments);
    setTimeout(injectSponsorBoxControlsInAdmin, 80);
  };
  ["openAccountModal", "openParentalGate", "openKidsLockOrTimer", "switchAuthModalTab"].forEach(function(fn) {
    var orig = window[fn];
    if (typeof orig === "function") {
      window[fn] = function() {
        var r = orig.apply(this, arguments);
        setTimeout(bindAllRealPasswordAndPinEyes, 60);
        return r;
      };
    }
  });
})();


// === QAAF V111 ASMA-UL-HUSNA COLORING STUDIO 6TH GAME HUB CARD ===
(function initQaafV111ColoringStudioMainHubCard() {
  var COLORING_GAME_OBJ = {
    id: "g_coloring",
    slug: "coloring",
    category: "qaaf_simple",
    icon: "🎨",
    title: "Asma-ul-Husna Coloring Studio",
    desc: "99 Names of Allah ASMR Calligraphy Coloring & Certificate Cards",
    size: "1.2 MB",
    installed: true,
    blockedByParent: false,
    externalFile: "./qaaf-games/games/coloring.html"
  };
  if (typeof gamesData !== "undefined" && Array.isArray(gamesData)) {
    if (!gamesData.some(function(g) { return g && (g.id === "g_coloring" || g.slug === "coloring"); })) {
      gamesData.push(COLORING_GAME_OBJ);
    }
  }
  window.addEventListener("message", function(ev) {
    var d = ev.data;
    if (d === "QAAF_EXIT_GAME" || (d && typeof d === "object" && (d.type === "QAAF_EXIT_GAME" || d.action === "closeGame"))) {
      try {
        var v4 = JSON.parse(localStorage.getItem("qaaf_games_state_v4") || "null");
        if (v4 && typeof v4.stars === "number" && typeof gameStars !== "undefined" && v4.stars > gameStars) {
          gameStars = v4.stars;
          localStorage.setItem("qaaf_game_stars", String(gameStars));
        }
      } catch (e) {}
      if (typeof closeStandaloneGameModal === "function") closeStandaloneGameModal();
    }
  });
})();


// === QAAF V112 CLOUDFLARE R2 3D GAMES CONNECTION ===
(function initQaafV112CloudflareR2GamesLink() {
  window.QAAF_GAMES_R2_BASE = "https://pub-5241f011e0704a3799e1dda07aca985d.r2.dev";
  var r2DeskUrl = window.QAAF_GAMES_R2_BASE + "/desk-racer-pro/desk_racer_pro.html";
  if (typeof gamesData !== "undefined" && Array.isArray(gamesData)) {
    gamesData.forEach(function(g) {
      if (!g) return;
      var t = String(g.title || "").toLowerCase();
      var f = String(g.externalFile || g.url || "").toLowerCase();
      if (t.indexOf("desk racer") !== -1 || f.indexOf("desk_racer") !== -1) {
        g.externalFile = r2DeskUrl;
        g.url = r2DeskUrl;
        g.size = "4.9 MB";
      }
    });
  }
})();
