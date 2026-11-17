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

  setInterval(function() {
    if (typeof window.translateAllQaafWebsiteText === "function") {
      window.translateAllQaafWebsiteText(window.currentAppUILang || "en");
    }
  }, 700);

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
    if (channelName) {
      var cleanChQuery = channelName.split("|")[0].trim();
      urlsToTry.push("https://www.youtube.com/results?search_query=" + encodeURIComponent(cleanChQuery + " playlist") + "&sp=EgIQAw%253D%253D");
    }

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
      path: "qaaf-games/qaaf-games.html?v=62.0"
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
      path: "Qaaf 3d games/01-Desk racer Pro/desk_racer_pro.html"
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
      "#categoryBar.qaaf-bar-autohidden { transform: translateY(-100%) !important; opacity: 0 !important; max-height: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; margin: 0 !important; overflow: hidden !important; pointer-events: none !important; }",
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
  setInterval(runAllV55Enhancements, 600);
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

// === QAAF STEP 2 AUTH & CLOUD SYNC ===
(function() {
  var FB_BASE = "https://qaaftube-6f251-default-rtdb.firebaseio.com";
  var YT_SHARE_SVG = "<svg viewBox='0 0 24 24' width='16' height='16' fill='currentColor' style='display:inline-block;vertical-align:middle;'><path d='M15 5.63 20.66 12 15 18.37V14h-1c-3.96 0-7.14 1-9.75 3.09 1.84-4.07 5.11-6.4 9.89-7.1l.86-.13V5.63M14 3v6C6.22 10.13 3.11 15.33 2 21c2.78-3.97 6.44-6 12-6v6l8-9-8-9z'/></svg>";
  var stClean = document.createElement("style");
  stClean.textContent = "#shortsSideNav, #qaafMinimalTopLeftClose, #qaafCenterRedVolOverlay { display: none !important; } header { z-index: 65 !important; } body.qaaf-player-open { overflow: hidden !important; touch-action: pan-y; }";
  document.head.appendChild(stClean);
  // A. USER CLOUD SYNC & LOGIN FIXES
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
    if (em === "qaaftube@gmail.com" || em === "adminqaaftube") { alert("Super Admin must sign in using Admin Password below."); return; }
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
      var nm = em.split("@")[0];
      return "<button type=button onclick=window.completeGoogleQuickSignIn('" + em + "') class='w-full bg-black/80 hover:bg-blue-950/70 border border-slate-700 rounded-xl p-2 flex items-center justify-between cursor-pointer'><span class='text-xs font-bold text-white truncate'>🔵 " + em + "</span><span class='text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-extrabold shrink-0'>1-Tap ➔</span></button>";
    }).join("");
    gBox.innerHTML = (accButtons ? ("<div class='space-y-1.5'>" + accButtons + "</div>") : "") + "<div class='flex gap-1.5'><input id='googleQuickEmailInput' type='email' placeholder='yourname@gmail.com' class='flex-1 bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white' onkeydown='if(event.key===\"Enter\")window.completeGoogleQuickSignIn()' /><button type=button onclick=window.completeGoogleQuickSignIn() class='bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer'>Continue</button></div>";
    gBox.classList.remove("hidden");
  };
  // B. SHARE LINK & URL ROUTER
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
  // C. SMART RELATED VIDEOS & UP NEXT FILTER PILLS
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
      var a = document.createElement("a"); if (!isKidsLocked) a.href = "?watch=" + encodeURIComponent(v.id);
      a.onclick = function(e){ return handleQaafVideoLinkClick(e, v.id); };
      a.className = "bg-[#181818] hover:bg-[#222] rounded-xl overflow-hidden border border-white/10 flex sm:flex-col gap-2.5 p-2 sm:p-0 cursor-pointer transition group no-underline text-inherit";
      a.innerHTML = "<div class='relative w-36 sm:w-full aspect-video bg-slate-900 rounded-lg sm:rounded-none overflow-hidden shrink-0 pointer-events-none'><img src='" + thumb + "' alt='' class='absolute inset-0 w-full h-full object-cover' loading='lazy' /><span class='absolute bottom-1 right-1 bg-black/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded'>" + (v.duration || "12:00") + "</span></div><div class='p-1 sm:p-2.5 min-w-0 flex-1'><h5 class='text-xs font-bold text-white line-clamp-2 leading-snug'>" + v.title + "</h5><p class='text-[10px] text-slate-400 mt-1 truncate'>✅ " + v.channel + " • " + vStr + "</p></div>";
      upNextGrid.appendChild(a);
    });
  };
  // D. PERFECT STICKY 16:9 WATCH LAYOUT (ZERO GAP, NO BACKGROUND SCROLL, COMPACT SHARE/LIKE ROW) & SHORTS LAYOUT
  window.qaafShortsQueue = []; window.qaafShortsIdx = 0; window.qaafShortPlaying = true; window.qaafShortMuted = false;
  function sendYtCmd(f, a) { var ifr = document.getElementById("ytIframe"); if (ifr && ifr.contentWindow) ifr.contentWindow.postMessage(JSON.stringify({ event: "command", func: f, args: a || [] }), "*"); }
  window.toggleQaafShortPlayPause = function(e) { if(e)e.stopPropagation(); window.qaafShortPlaying=!window.qaafShortPlaying; sendYtCmd(window.qaafShortPlaying?"playVideo":"pauseVideo"); var b=document.getElementById("qaafShPlayBtn"); if(b)b.innerHTML=window.qaafShortPlaying?"⏸":"▶"; };
  window.toggleQaafShortMute = function(e) { if(e)e.stopPropagation(); window.qaafShortMuted=!window.qaafShortMuted; sendYtCmd(window.qaafShortMuted?"mute":"unMute"); var b=document.getElementById("qaafShMuteBtn"); if(b)b.innerHTML=window.qaafShortMuted?"🔇":"🔊"; };
  window.toggleQaafShortFullscreen = function(e) { if(e)e.stopPropagation(); var m=document.getElementById("playerModal"); if(!m)return; if(!document.fullscreenElement){if(m.requestFullscreen)m.requestFullscreen().catch(function(){});}else{if(document.exitFullscreen)document.exitFullscreen().catch(function(){});} };
  window.toggleQaafShortMenu = function(e) { if(e)e.stopPropagation(); var m=document.getElementById("qaafShThreeDotMenu"); if(m)m.classList.toggle("hidden"); };
  window.setQaafShortSpeed = function(r) { sendYtCmd("setPlaybackRate",[r]); var m=document.getElementById("qaafShThreeDotMenu"); if(m)m.classList.add("hidden"); };
  window.openShortCommentsPopup = function(e) { if(e)e.stopPropagation(); var sw=document.getElementById("ytWatchScrollContainer"); if(sw){sw.classList.toggle("hidden"); sw.style.cssText="position:absolute;inset:auto 0 0 0;max-height:55%;background:#12161f;z-index:60;overflow-y:auto;padding:12px;border-radius:20px 20px 0 0;";} };
  window.playAdjacentShort = function(dir) {
    if (!window.qaafShortsQueue.length) { var rel = window.getSmartRelatedVideos(currentPlayingVideoId, true); window.qaafShortsQueue = [currentPlayingVideoId].concat(rel.map(function(v){return v.id;})); window.qaafShortsIdx = 0; }
    if (window.qaafShortsQueue.length <= 1) return;
    window.qaafShortsIdx = (window.qaafShortsIdx + (dir >= 0 ? 1 : -1) + window.qaafShortsQueue.length) % window.qaafShortsQueue.length;
    openVideoPlayer(window.qaafShortsQueue[window.qaafShortsIdx]);
  };
  function applyUnifiedPlayerLayout(video) {
    var modal = document.getElementById("playerModal"), box = document.getElementById("playerModalBox"), aspect = document.getElementById("playerAspectBox"), scrollWrap = document.getElementById("ytWatchScrollContainer");
    if (!modal || !box || !aspect || !video || modal.classList.contains("qaaf-mini-player")) return;
    document.body.classList.add("qaaf-player-open");
    var hdr = document.querySelector("header"); var hdrH = (hdr && hdr.offsetHeight) ? hdr.offsetHeight : 48;
    var isSh = isVideoShort(video);
    var ov = document.getElementById("qaafYtShortsMasterOverlay"), peek = document.getElementById("qaafNextShortPeekCard");
    if (!isSh) {
      // REGULAR 16:9 VIDEO: Flush under header (0px gap!), video fixed at top, ONLY bottom list scrolls!
      modal.classList.remove("qaaf-shorts-mode");
      if (ov) ov.style.display = "none"; if (peek) peek.style.display = "none";
      modal.style.cssText = "position:fixed; top:" + hdrH + "px; left:0; right:0; bottom:0; height:calc(100dvh - " + hdrH + "px); z-index:55; background:#0f0f0f; display:flex; flex-direction:column; overflow:hidden; padding:0; margin:0;";
      box.style.cssText = "width:100%; max-width:960px; height:100%; margin:0 auto; background:#0f0f0f; display:flex; flex-direction:column; overflow:hidden; border-radius:0;";
      aspect.style.cssText = "position:relative; width:100%; aspect-ratio:16/9; max-height:42vh; background:#000; flex:0 0 auto; overflow:hidden; display:block;";
      if (scrollWrap) { scrollWrap.classList.remove("hidden"); scrollWrap.style.cssText = "flex:1 1 auto; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:12px 14px 90px 14px; background:#0f0f0f;"; }
      // Replace Dua with Share SVG & make button row fit mobile cleanly
      var details = document.getElementById("ytCleanWatchDetails");
      if (details) {
        details.querySelectorAll("button").forEach(function(b){
          var t = (b.textContent||"").trim();
          if (t.indexOf("Dua") !== -1 || b.getAttribute("onclick") === "triggerAdCoverNow()") {
            b.onclick = function(ev){ window.shareQaafCurrentVideo(ev); };
            b.className = "bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition shrink-0 cursor-pointer";
            b.innerHTML = YT_SHARE_SVG + "<span>Share</span>";
          }
        });
      }
      window.filterUpNextByMode("all");
      return;
    }
    // SHORTS MODE: Flush under header, vertical 9:16 card + 34px bottom peek
    if (window.qaafShortsQueue.indexOf(video.id) === -1) { var rel = window.getSmartRelatedVideos(video.id, true); window.qaafShortsQueue = [video.id].concat(rel.map(function(v){return v.id;})); window.qaafShortsIdx = 0; }
    modal.classList.add("qaaf-shorts-mode");
    modal.style.cssText = "position:fixed; top:" + hdrH + "px; left:0; right:0; bottom:0; height:calc(100dvh - " + hdrH + "px); z-index:55; background:rgba(10,12,16,0.98); display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding-top:6px; overflow:hidden;";
    modal.onclick = function(ev){ if (ev.target === modal) closeVideoPlayer(); };
    if (scrollWrap) scrollWrap.classList.add("hidden");
    box.style.cssText = "width:auto; height:calc(100dvh - " + (hdrH + 54) + "px); flex:0 0 calc(100dvh - " + (hdrH + 54) + "px); aspect-ratio:9/16; max-width:94vw; background:#000; border-radius:16px; overflow:hidden; position:relative; display:flex; flex-direction:column;";
    aspect.style.cssText = "position:relative; width:100%; height:100%; flex:1 1 auto; background:#000; overflow:hidden; display:block;";
    var ifr = document.getElementById("ytIframe"); if (ifr && ifr.src && ifr.src.indexOf("controls=1") !== -1) ifr.src = ifr.src.replace("controls=1", "controls=0");
    if (!ov) { ov = document.createElement("div"); ov.id = "qaafYtShortsMasterOverlay"; aspect.appendChild(ov); }
    ov.style.cssText = "position:absolute; inset:0; z-index:38; display:block; user-select:none;";
    var lastW = 0; ov.onwheel = function(e){ if (Date.now()-lastW < 600) return; if (Math.abs(e.deltaY)>22) { e.preventDefault(); lastW=Date.now(); window.playAdjacentShort(e.deltaY>0?1:-1); } };
    var isFav = (favoriteVideoIds || []).indexOf(video.id) !== -1;
    var vCount = (typeof window.getQaafRealViewCount === "function") ? window.getQaafRealViewCount(video) : (video.realViews || 1);
    var chHandle = "@" + String(video.channel || "qaaftube").toLowerCase().replace(/[^a-z0-9_]/g, "");
    var thumb = video.customThumb || ("https://i.ytimg.com/vi/" + video.ytId + "/hqdefault.jpg");
    ov.innerHTML = "<div onclick=toggleQaafShortPlayPause(event) style='position:absolute;inset:0;z-index:1;cursor:pointer;'></div>" +
      "<div style='position:absolute;top:14px;left:14px;z-index:5;display:flex;align-items:center;gap:8px;'><button id='qaafShPlayBtn' type=button onclick=toggleQaafShortPlayPause(event) style='width:40px;height:40px;border-radius:999px;background:rgba(0,0,0,0.52);color:#fff;font-size:15px;border:none;cursor:pointer;'>⏸</button><button id='qaafShMuteBtn' type=button onclick=toggleQaafShortMute(event) style='width:40px;height:40px;border-radius:999px;background:rgba(0,0,0,0.52);color:#fff;font-size:15px;border:none;cursor:pointer;'>🔊</button></div>" +
      "<div style='position:absolute;top:14px;right:14px;z-index:6;'><div style='background:rgba(0,0,0,0.52);border-radius:999px;padding:4px 8px;display:flex;gap:6px;'><button type=button onclick=toggleQaafShortMenu(event) style='width:32px;height:32px;color:#fff;font-size:18px;background:transparent;border:none;cursor:pointer;'>⋮</button><button type=button onclick=toggleQaafShortFullscreen(event) style='width:32px;height:32px;color:#fff;font-size:16px;background:transparent;border:none;cursor:pointer;'>⤢</button></div>" +
      "<div id='qaafShThreeDotMenu' class='hidden' style='position:absolute;right:0;top:46px;width:200px;background:#181c24;border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:8px;color:#fff;font-size:12px;'><button type=button onclick=toggleVideoInPlaylist(currentPlayingVideoId,event) class='w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 font-bold flex items-center gap-2'><span>➕</span><span>Save to Playlist</span></button><div class='px-3 py-1 text-[10px] text-slate-400 font-bold border-t border-white/10 mt-1'>⏩ Playback Speed</div><div class='flex justify-between gap-1 px-2 pb-1.5'><button type=button onclick=setQaafShortSpeed(0.75) class='px-2 py-1 rounded bg-white/10 text-[10px] font-bold'>0.75x</button><button type=button onclick=setQaafShortSpeed(1) class='px-2 py-1 rounded bg-emerald-600 text-[10px] font-bold'>1x</button><button type=button onclick=setQaafShortSpeed(1.5) class='px-2 py-1 rounded bg-white/10 text-[10px] font-bold'>1.5x</button><button type=button onclick=setQaafShortSpeed(2) class='px-2 py-1 rounded bg-white/10 text-[10px] font-bold'>2x</button></div><button type=button onclick=openFlagModal(currentPlayingVideoId) class='w-full text-left px-3 py-2 rounded-xl hover:bg-rose-900/40 text-rose-300 font-bold flex items-center gap-2'><span>🚩</span><span>Report Short</span></button></div></div>" +
      "<div style='position:absolute;right:12px;bottom:20px;z-index:5;display:flex;flex-direction:column;align-items:center;gap:14px;'>" +
        "<div style='display:flex;flex-direction:column;align-items:center;gap:2px;'><button type=button onclick=toggleFavoriteVideo(currentPlayingVideoId,event);setTimeout(function(){openVideoPlayer(currentPlayingVideoId);},50) style='width:42px;height:42px;border-radius:999px;background:rgba(0,0,0,0.52);color:#fff;font-size:18px;border:none;cursor:pointer;'>" + (isFav ? "❤️" : "🤍") + "</button><span style='font-size:11px;font-weight:700;color:#fff;'>" + vCount + "</span></div>" +
        "<div style='display:flex;flex-direction:column;align-items:center;gap:2px;'><button type=button onclick=openShortCommentsPopup(event) style='width:42px;height:42px;border-radius:999px;background:rgba(0,0,0,0.52);color:#fff;font-size:17px;border:none;cursor:pointer;'>💬</button><span style='font-size:10px;font-weight:700;color:#fff;'>Comment</span></div>" +
        "<div style='display:flex;flex-direction:column;align-items:center;gap:2px;'><button type=button onclick=shareQaafCurrentVideo(event) style='width:42px;height:42px;border-radius:999px;background:rgba(0,0,0,0.52);color:#fff;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;'>" + YT_SHARE_SVG + "</button><span style='font-size:10px;font-weight:700;color:#fff;'>Share</span></div>" +
        "<img src='" + thumb + "' style='width:36px;height:36px;border-radius:8px;object-fit:cover;border:2px solid #fff;' />" +
      "</div>" +
      "<div style='position:absolute;left:14px;right:68px;bottom:16px;z-index:5;pointer-events:none;text-shadow:0 1px 4px #000;'><div style='display:flex;align-items:center;gap:8px;margin-bottom:4px;'><img src='" + thumb + "' style='width:30px;height:30px;border-radius:999px;object-fit:cover;border:1.5px solid #fff;' /><span style='font-size:12px;font-weight:800;color:#fff;'>" + chHandle + "</span></div><div style='font-size:12px;font-weight:600;color:#fff;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;'>" + video.title + "</div></div>";
    var nextId = window.qaafShortsQueue[(window.qaafShortsIdx + 1) % window.qaafShortsQueue.length];
    var nextVid = (videosData || []).find(function(x){ return x && x.id === nextId && x.id !== video.id; });
    if (!peek) { peek = document.createElement("div"); peek.id = "qaafNextShortPeekCard"; modal.appendChild(peek); }
    if (nextVid) {
      var nThumb = nextVid.customThumb || ("https://i.ytimg.com/vi/" + nextVid.ytId + "/hqdefault.jpg");
      var boxW = box.getBoundingClientRect().width || 340;
      peek.style.cssText = "width:" + Math.round(boxW) + "px; height:32px; flex:0 0 32px; margin-top:8px; border-radius:14px 14px 0 0; overflow:hidden; position:relative; cursor:pointer; opacity:0.85; border-top:1px solid rgba(255,255,255,0.25);";
      peek.onclick = function(e){ e.stopPropagation(); window.playAdjacentShort(1); };
      peek.innerHTML = "<img src='" + nThumb + "' style='width:100%;height:200px;object-fit:cover;object-position:top;' />";
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
      setTimeout(function(){ applyUnifiedPlayerLayout(v); }, 25);
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
})();

// === QAAF V90 CLEAN NATIVE YOUTUBE SHORTS & WATCH UI ===
(function() {
  var YT_SHARE_SVG = "<svg viewBox='0 0 24 24' width='17' height='17' fill='currentColor' style='display:inline-block;vertical-align:middle;'><path d='M15 5.63 20.66 12 15 18.37V14h-1c-3.96 0-7.14 1-9.75 3.09 1.84-4.07 5.11-6.4 9.89-7.1l.86-.13V5.63M14 3v6C6.22 10.13 3.11 15.33 2 21c2.78-3.97 6.44-6 12-6v6l8-9-8-9z'/></svg>";
  // 1. Browser Cache Installer for 3D Game (3.8 MB)
  var origInstall = window.installAndOpenGame;
  window.installAndOpenGame = function(gameId) {
    if (window.caches && gameId === "game_3d_01_desk_racer") {
      caches.open("qaaf-3d-games-v1").then(function(cache) {
        cache.addAll(["Qaaf 3d games/01-Desk racer Pro/desk_racer_pro.html", "Qaaf 3d games/01-Desk racer Pro/stage_panoramas.js"]).catch(function(){});
      }).catch(function(){});
    }
    if (origInstall) return origInstall.apply(this, arguments);
  };
  // 2. Override buildCleanWatchDetailsLayout so 16:9 Videos show Official Share Button instead of Dua, and never cut off on mobile
  var origBuildWatch = window.buildCleanWatchDetailsLayout;
  window.buildCleanWatchDetailsLayout = function(video) {
    if (origBuildWatch) origBuildWatch.apply(this, arguments);
    var details = document.getElementById("ytCleanWatchDetails"); if (!details || !video) return;
    details.querySelectorAll("button").forEach(function(b) {
      var txt = (b.textContent || "").trim();
      if (txt.indexOf("Dua") !== -1 || b.getAttribute("onclick") === "triggerAdCoverNow()") {
        b.onclick = function(ev) { window.shareQaafCurrentVideo(ev); };
        b.setAttribute("onclick", "window.shareQaafCurrentVideo(event)");
        b.className = "bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition shrink-0 cursor-pointer";
        b.innerHTML = YT_SHARE_SVG + "<span>Share</span>";
      }
    });
    // Make the channel + action buttons row wrap cleanly on narrow mobile screens so nothing cuts off
    var rows = details.querySelectorAll("div.flex.items-center.justify-between");
    rows.forEach(function(r) { r.className = "flex flex-wrap items-center justify-between gap-2 pt-1"; });
  };
  // 3. Override renderWatchPageExtras so Up Next always shows All | From Channel | Related + Smart Related Videos + Real Views
  var origExtras = window.renderWatchPageExtras;
  window.renderWatchPageExtras = function(videoId) {
    if (origExtras) origExtras.apply(this, arguments);
    var cur = (videosData || []).find(function(x){ return x && x.id === videoId; });
    var upNextGrid = document.getElementById("watchUpNextGrid"); if (!upNextGrid || !cur) return;
    var bar = document.getElementById("qaafUpNextFilterPillsBar");
    if (!bar && upNextGrid.parentNode) {
      bar = document.createElement("div"); bar.id = "qaafUpNextFilterPillsBar";
      bar.className = "flex items-center gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar";
      upNextGrid.parentNode.insertBefore(bar, upNextGrid);
    }
    if (bar) {
      bar.innerHTML = "<button id='qaafUpNextPill_all' type=button onclick=filterUpNextByMode('all') class='px-3 py-1 rounded-lg text-xs font-extrabold bg-white text-black cursor-pointer shrink-0'>All</button>" +
        "<button id='qaafUpNextPill_channel' type=button onclick=filterUpNextByMode('channel') class='px-3 py-1 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0'>From " + (cur.channel || "Channel") + "</button>" +
        "<button id='qaafUpNextPill_related' type=button onclick=filterUpNextByMode('related') class='px-3 py-1 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0'>Related</button>";
    }
    if (typeof window.filterUpNextByMode === "function") window.filterUpNextByMode("all");
  };
  // 4. CLEAN NATIVE YOUTUBE SHORTS: Keep YouTube native top-right (Speaker, CC, Settings) & bottom-right (Enlarge/Minimize) 100% uncovered and working!
  function applyCleanNativeShortsUI() {
    var modal = document.getElementById("playerModal");
    if (!modal || modal.classList.contains("hidden")) return;
    var video = (videosData || []).find(function(x){ return x && x.id === currentPlayingVideoId; });
    if (!video || !isVideoShort(video)) return;
    // Ensure YouTube native controls=1 stays ON in Shorts so YouTube Speaker, CC, Settings, Seekbar & Fullscreen work directly!
    var ifr = document.getElementById("ytIframe");
    if (ifr) {
      ifr.style.pointerEvents = "auto";
      if (ifr.src && ifr.src.indexOf("controls=0") !== -1) ifr.src = ifr.src.replace("controls=0", "controls=1");
    }
    // Replace the full-screen blocking overlay with ONLY a small floating right-side bar positioned HIGHER UP (bottom: 130px) so YouTube bottom-right Fullscreen (Enlarge/Minimize) and top-right (Speaker/CC/Gear) are 100% uncovered!
    var ov = document.getElementById("qaafYtShortsMasterOverlay");
    if (ov) {
      var isFav = (favoriteVideoIds || []).indexOf(video.id) !== -1;
      var vCount = (typeof window.getQaafRealViewCount === "function") ? window.getQaafRealViewCount(video) : (video.realViews || 1);
      ov.style.cssText = "position:absolute; right:10px; bottom:128px; top:auto; left:auto; width:46px; height:auto; z-index:38; display:flex; flex-direction:column; align-items:center; gap:12px; pointer-events:auto;";
      ov.innerHTML = "<button type=button onclick=playAdjacentShort(-1) style='width:38px;height:38px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;font-size:14px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;' title='Previous Short'>▲</button>" +
        "<div style='display:flex;flex-direction:column;align-items:center;gap:2px;'><button type=button onclick=toggleFavoriteVideo(currentPlayingVideoId,event);setTimeout(applyCleanNativeShortsUI,50) style='width:42px;height:42px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;font-size:17px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;'>" + (isFav ? "❤️" : "🤍") + "</button><span style='font-size:10px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000;'>" + vCount + "</span></div>" +
        "<div style='display:flex;flex-direction:column;align-items:center;gap:2px;'><button type=button onclick=openShortCommentsPopup(event) style='width:42px;height:42px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;font-size:16px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;'>💬</button><span style='font-size:9px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000;'>Comment</span></div>" +
        "<div style='display:flex;flex-direction:column;align-items:center;gap:2px;'><button type=button onclick=shareQaafCurrentVideo(event) style='width:42px;height:42px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.2);cursor:pointer;'>" + YT_SHARE_SVG + "</button><span style='font-size:9px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000;'>Share</span></div>" +
        "<button type=button onclick=playAdjacentShort(1) style='width:38px;height:38px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;font-size:14px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;' title='Next Short'>▼</button>";
    }
  }
  var prevOpen90 = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    if (prevOpen90) prevOpen90.apply(this, arguments);
    setTimeout(applyCleanNativeShortsUI, 45);
    setTimeout(function(){ var v = (videosData||[]).find(function(x){return x&&x.id===videoId;}); if (v && !isVideoShort(v)) { window.buildCleanWatchDetailsLayout(v); window.renderWatchPageExtras(videoId); } }, 60);
  };
})();


// === QAAF V91 REAL PLAYLIST FIX, DAILY CHANNEL SCANNER & LIGHT/DARK THEME ===
(function initQaafV91PlaylistScannerAndTheme() {
  var FB_BASE = (localStorage.getItem("qaaf_firebase_db_url") || "https://qaaftube-6f251-default-rtdb.firebaseio.com").replace(/\/+$/, "");

  function purgeFakeSearchPlaylistsNow() {
    var map = window.qaafRealChannelPlaylistsMap || {};
    var changed = false;
    if (map["Tarbiah Islamic Centre"]) { delete map["Tarbiah Islamic Centre"]; changed = true; }
    Object.keys(map).forEach(function(ch) {
      if (!Array.isArray(map[ch])) return;
      var before = map[ch].length;
      map[ch] = map[ch].filter(function(p) {
        if (!p || !p.listId || !p.title) return false;
        var t = String(p.title).trim();
        if (/[·•]\s*\d{1,2}:\d{2}(\s|$)/.test(t)) return false;
        if (/^Playlist\s*\(PL/i.test(t) || /^Playlist:\s/i.test(t)) return false;
        if (t.indexOf("Dr. Shakeel Ahmed wani") !== -1 || t.indexOf("Jabir") !== -1 || t.indexOf("Shaykh Adnan") !== -1) return false;
        return true;
      });
      if (map[ch].length !== before) changed = true;
      if (map[ch].length === 0) delete map[ch];
    });
    if (changed) {
      window.qaafRealChannelPlaylistsMap = map;
      try { localStorage.setItem("qaaf_real_channel_playlists_v1", JSON.stringify(map)); } catch(e) {}
      if (typeof window.savePlaylistsToLocalAndCloudDb === "function") window.savePlaylistsToLocalAndCloudDb();
    }
  }
  purgeFakeSearchPlaylistsNow();

  window.discoverYouTubePlaylistsForChannel = async function(channelName, channelUrlHint) {
    var baseChannel = (channelUrlHint || "").trim();
    var chUrlCache = JSON.parse(localStorage.getItem("qaaf_channel_urls_map_v1") || "{}");
    if (!baseChannel && channelName && chUrlCache[channelName]) baseChannel = chUrlCache[channelName];
    if (!baseChannel && channelName) {
      var chVids = (videosData || []).filter(function(v) { return v && v.channel === channelName && v.ytId; });
      if (chVids[0]) {
        try {
          var oeRes = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + chVids[0].ytId);
          var oeData = await oeRes.json();
          if (oeData && oeData.author_url) {
            baseChannel = oeData.author_url;
            chUrlCache[channelName] = baseChannel;
            localStorage.setItem("qaaf_channel_urls_map_v1", JSON.stringify(chUrlCache));
          }
        } catch (e) {}
      }
    }
    if (!baseChannel) return [];
    baseChannel = baseChannel.replace(/\/(videos|shorts|featured|streams|playlists)?\/?$/, "");
    var plPageUrl = baseChannel + "/playlists";
    var plMetaMap = new Map();

    function cleanTitle(rawT) {
      if (!rawT) return "";
      var t = String(rawT).replace(/\\u0026/g, "&").replace(/&amp;/g, "&").replace(/&quot;/g, "").replace(/^#+\s*/, "").replace(/\s*-\s*YouTube$/i, "").trim();
      if (/^(view full playlist|play all|playlist|\d+\s*videos?|!\[image.*)$/i.test(t)) return "";
      if (/[·•]\s*\d{1,2}:\d{2}(\s|$)/.test(t)) return "";
      return t;
    }

    function addRealPl(listId, title, sampleVidId) {
      if (!listId || !/^PL[a-zA-Z0-9_-]{10,}$/.test(listId)) return;
      var cTitle = cleanTitle(title);
      if (!cTitle || cTitle.length < 3) return;
      var ex = plMetaMap.get(listId) || { listId: listId, title: cTitle, thumb: "", countText: "", sampleVidId: "" };
      if (cTitle.length > ex.title.length) ex.title = cTitle;
      if (sampleVidId && /^[a-zA-Z0-9_-]{11}$/.test(sampleVidId)) {
        ex.sampleVidId = sampleVidId;
        ex.thumb = "https://i.ytimg.com/vi/" + sampleVidId + "/hqdefault.jpg";
      }
      plMetaMap.set(listId, ex);
    }

    function parseOfficialPlaylistsTab(rawText) {
      if (!rawText) return false;
      if (/This channel has no playlists|has no playlists/i.test(rawText)) return true;
      var lockupRgx = /"contentId"\s*:\s*"(PL[a-zA-Z0-9_-]{10,})"(?:(?!lockupViewModel).){1,2200}?"title"\s*:\s*\{\s*"content"\s*:\s*"([^"]{3,150})"/g;
      for (var m2 of rawText.matchAll(lockupRgx)) addRealPl(m2[1], m2[2], "");
      var classicRgx = /"playlistId"\s*:\s*"(PL[a-zA-Z0-9_-]{10,})"(?:(?!playlistRenderer).){1,1800}?"title"\s*:\s*\{(?:\s*"simpleText"\s*:\s*"([^"]{3,150})"|\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]{3,150})")/g;
      for (var m3 of rawText.matchAll(classicRgx)) addRealPl(m3[1], m3[2] || m3[3] || "", "");
      var mdRgx = /###\s*\[([^\[\]\n]{3,140})\]\(https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?v=([a-zA-Z0-9_-]{11})(?:&|&amp;)list=|playlist\?list=)(PL[a-zA-Z0-9_-]{10,})[^\)]*\)/g;
      for (var m1 of rawText.matchAll(mdRgx)) {
        if (!/!\[image/i.test(m1[1])) addRealPl(m1[3], m1[1], m1[2] || "");
      }
      return false;
    }

    var hasNoPls = false;
    try {
      var r1 = await fetch("https://r.jina.ai/" + plPageUrl);
      if (r1.ok) hasNoPls = parseOfficialPlaylistsTab(await r1.text());
    } catch (e) {}
    if (!hasNoPls && plMetaMap.size === 0) {
      try {
        var r2 = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(plPageUrl + "?ucbcb=1&hl=en"));
        if (r2.ok) hasNoPls = parseOfficialPlaylistsTab(await r2.text());
      } catch (e) {}
    }
    if (hasNoPls || plMetaMap.size === 0) {
      if (channelName && window.qaafRealChannelPlaylistsMap) {
        delete window.qaafRealChannelPlaylistsMap[channelName];
        try { localStorage.setItem("qaaf_real_channel_playlists_v1", JSON.stringify(window.qaafRealChannelPlaylistsMap)); } catch(e) {}
      }
      return [];
    }
    return Array.from(plMetaMap.values()).slice(0, 25);
  };

  window.qaafChannelUpdatesQueue = JSON.parse(localStorage.getItem("qaaf_channel_updates_queue_v1") || "[]");
  window.qaafRejectedUpdateYtIds = JSON.parse(localStorage.getItem("qaaf_rejected_update_ytids_v1") || "[]");
  var isScanningChannelsNow = false;

  function saveChannelUpdatesQueue() {
    try {
      localStorage.setItem("qaaf_channel_updates_queue_v1", JSON.stringify(window.qaafChannelUpdatesQueue));
      localStorage.setItem("qaaf_rejected_update_ytids_v1", JSON.stringify(window.qaafRejectedUpdateYtIds));
    } catch (e) {}
    fetch(FB_BASE + "/qaaf_channel_updates_queue.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queue: window.qaafChannelUpdatesQueue, rejectedIds: window.qaafRejectedUpdateYtIds, updatedAt: Date.now() })
    }).catch(function() {});
    updateAdminChannelUpdatesBadge();
    renderAdminChannelUpdatesBox();
  }

  function updateAdminChannelUpdatesBadge() {
    var qCount = (window.qaafChannelUpdatesQueue || []).length;
    var fCount = (typeof flaggedVideosQueue !== "undefined" && Array.isArray(flaggedVideosQueue)) ? flaggedVideosQueue.length : 0;
    var rCount = (window.parentRequestsQueue && Array.isArray(window.parentRequestsQueue)) ? window.parentRequestsQueue.length : 0;
    var hdrBadge = document.getElementById("adminFlagCountBadge");
    if (hdrBadge) hdrBadge.innerText = fCount + rCount + qCount;
  }

  window.scanApprovedChannelsForNewVideos = async function(isManualTrigger) {
    if (isScanningChannelsNow) return;
    isScanningChannelsNow = true;
    if (isManualTrigger && typeof showSyncToast === "function") showSyncToast("⏳ منظور شدہ چینلز میں نئی ویڈیوز چیک کی جا رہی ہیں...");
    var approvedChannelsSet = new Set(window.verifiedChannelsList || []);
    (videosData || []).forEach(function(v) { if (v && v.channel && v.channelVerified) approvedChannelsSet.add(v.channel); });
    var approvedChannels = Array.from(approvedChannelsSet);
    var chUrlCache = JSON.parse(localStorage.getItem("qaaf_channel_urls_map_v1") || "{}");
    var existingYtIds = new Set((videosData || []).map(function(v) { return v && v.ytId; }).filter(Boolean));
    var blockedSet = new Set((blockedVideoIds || []).concat(window.qaafRejectedUpdateYtIds || []));
    var queuedIds = new Set((window.qaafChannelUpdatesQueue || []).map(function(u) { return u && u.ytId; }).filter(Boolean));
    var newlyFoundCount = 0;

    for (var i = 0; i < approvedChannels.length; i++) {
      var chName = approvedChannels[i];
      var chVids = (videosData || []).filter(function(v) { return v && v.channel === chName && v.ytId; });
      if (chVids.length === 0) continue;
      var chKnownYtIds = new Set(chVids.map(function(v) { return v.ytId; }));
      var sampleCat = chVids[0].category || "bayan";
      var sampleLang = chVids[0].lang || "ur";
      var sampleAud = chVids[0].audienceMode || (sampleCat === "bayan" ? "family_only" : "both_family_kids");
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
      var pageText = "";
      try {
        var r = await fetch("https://r.jina.ai/" + baseUrl + "/videos");
        if (r.ok) pageText = await r.text();
      } catch (e) {}
      if (!pageText) continue;
      var topIds = [];
      for (var m of pageText.matchAll(/(?:watch\?v=|\/shorts\/|"videoId"\s*:\s*")([a-zA-Z0-9_-]{11})/g)) {
        if (topIds.indexOf(m[1]) === -1) topIds.push(m[1]);
        if (topIds.length >= 10) break;
      }
      var candidateNewIds = [];
      for (var k = 0; k < topIds.length; k++) {
        var vidId = topIds[k];
        if (chKnownYtIds.has(vidId)) break;
        if (!existingYtIds.has(vidId) && !blockedSet.has(vidId) && !queuedIds.has(vidId)) candidateNewIds.push(vidId);
        if (candidateNewIds.length >= 5) break;
      }
      for (var n = 0; n < candidateNewIds.length; n++) {
        var newYtId = candidateNewIds[n];
        try {
          var nr = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + newYtId);
          var nd = await nr.json();
          if (nd && nd.title) {
            window.qaafChannelUpdatesQueue.unshift({ id: "upd_" + newYtId, ytId: newYtId, title: nd.title, channel: chName, category: sampleCat, lang: sampleLang, audienceMode: sampleAud, detectedAt: new Date().toLocaleDateString() });
            queuedIds.add(newYtId);
            newlyFoundCount++;
          }
        } catch (e) {}
      }
    }
    localStorage.setItem("qaaf_last_channel_scan_ts", String(Date.now()));
    isScanningChannelsNow = false;
    saveChannelUpdatesQueue();
    if (newlyFoundCount > 0 && typeof showSyncToast === "function") {
      showSyncToast("🔔 منظور شدہ چینلز میں " + newlyFoundCount + " نئی ویڈیوز آئی ہیں! ایڈمن پینل میں چیک کریں۔");
    } else if (isManualTrigger && typeof showSyncToast === "function") {
      showSyncToast("✅ تمام منظور شدہ چینلز چیک کر لیے گئے۔ کوئی نئی ویڈیو باقی نہیں۔");
    }
  };

  window.adminApproveChannelUpdateVideo = function(ytId) {
    var item = (window.qaafChannelUpdatesQueue || []).find(function(x) { return x && x.ytId === ytId; });
    if (!item) return;
    if (!videosData.some(function(v) { return v && v.ytId === item.ytId; })) {
      videosData.unshift({ id: "v_" + item.ytId, ytId: item.ytId, title: item.title, channel: item.channel, lang: item.lang || "ur", region: (item.lang || "ur").toUpperCase(), category: item.category || "bayan", audienceMode: item.audienceMode || "both_family_kids", kidsSafe: (item.category !== "bayan" && item.audienceMode !== "family_only"), channelVerified: true, isShort: /#short/i.test(item.title), isCustomAdded: true, duration: "12:00", views: 0, createdAt: Math.floor(Date.now() / 1000) });
      localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    }
    window.qaafChannelUpdatesQueue = (window.qaafChannelUpdatesQueue || []).filter(function(x) { return x && x.ytId !== ytId; });
    saveChannelUpdatesQueue();
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Approved New Channel Video: " + item.title);
    if (typeof showSyncToast === "function") showSyncToast("✅ نئی ویڈیو منظور ہو کر شامل ہو گئی!");
  };

  window.adminRejectChannelUpdateVideo = function(ytId) {
    if (window.qaafRejectedUpdateYtIds.indexOf(ytId) === -1) window.qaafRejectedUpdateYtIds.push(ytId);
    if (Array.isArray(blockedVideoIds) && blockedVideoIds.indexOf(ytId) === -1) { blockedVideoIds.push(ytId); localStorage.setItem("qaaf_blocked_videos", JSON.stringify(blockedVideoIds)); }
    window.qaafChannelUpdatesQueue = (window.qaafChannelUpdatesQueue || []).filter(function(x) { return x && x.ytId !== ytId; });
    saveChannelUpdatesQueue();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Rejected Channel Update Video: " + ytId);
    if (typeof showSyncToast === "function") showSyncToast("🗑️ ویڈیو رد کر دی گئی۔");
  };

  window.adminApproveAllChannelUpdates = function() {
    var list = (window.qaafChannelUpdatesQueue || []).slice();
    if (list.length === 0) return;
    list.forEach(function(item) {
      if (!videosData.some(function(v) { return v && v.ytId === item.ytId; })) {
        videosData.unshift({ id: "v_" + item.ytId, ytId: item.ytId, title: item.title, channel: item.channel, lang: item.lang || "ur", region: (item.lang || "ur").toUpperCase(), category: item.category || "bayan", audienceMode: item.audienceMode || "both_family_kids", kidsSafe: (item.category !== "bayan" && item.audienceMode !== "family_only"), channelVerified: true, isShort: /#short/i.test(item.title), isCustomAdded: true, duration: "12:00", views: 0, createdAt: Math.floor(Date.now() / 1000) });
      }
    });
    localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    window.qaafChannelUpdatesQueue = [];
    saveChannelUpdatesQueue();
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Approved All New Channel Videos");
    if (typeof showSyncToast === "function") showSyncToast("🎉 تمام نئی ویڈیوز منظور ہو گئیں!");
  };

  function renderAdminChannelUpdatesBox() {
    var pubPane = document.getElementById("admPane_publish");
    if (!pubPane) return;
    var box = document.getElementById("admDailyChannelUpdatesCard");
    if (!box) {
      box = document.createElement("div");
      box.id = "admDailyChannelUpdatesCard";
      box.className = "bg-gradient-to-br from-[#0e1b24] to-[#111722] border-2 border-emerald-500/50 rounded-2xl p-4 space-y-3 text-xs mb-4 shadow-xl";
      pubPane.insertBefore(box, pubPane.children[1] || pubPane.firstChild);
    }
    var q = window.qaafChannelUpdatesQueue || [];
    var rowsHtml = "";
    if (q.length === 0) {
      rowsHtml = "<p class=\x22text-slate-400 py-2 text-center\x22>✅ اس وقت منظور شدہ چینلز میں کوئی نئی غیر منظور شدہ ویڈیو نہیں ہے۔</p>";
    } else {
      q.forEach(function(item) {
        var thumb = "https://i.ytimg.com/vi/" + item.ytId + "/mqdefault.jpg";
        rowsHtml += "<div class=\x22bg-black/70 border border-emerald-500/30 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5\x22>" +
          "<div class=\x22flex items-center gap-2.5 min-w-0 flex-1\x22>" +
            "<img src=\x22" + thumb + "\x22 class=\x22w-16 h-10 object-cover rounded-lg border border-white/15 shrink-0\x22 />" +
            "<div class=\x22min-w-0 flex-1\x22>" +
              "<p class=\x22font-extrabold text-white truncate\x22>" + item.title + "</p>" +
              "<p class=\x22text-[11px] text-emerald-400 font-bold\x22>📺 " + item.channel + " • " + (item.detectedAt || "New") + "</p>" +
            "</div>" +
          "</div>" +
          "<div class=\x22flex flex-wrap items-center gap-1.5 shrink-0\x22>" +
            "<button type=\x22button\x22 data-ytid=\x22" + item.ytId + "\x22 onclick=\x22playVideoInsideAdminModal(this.getAttribute(\x27data-ytid\x27), \x27Preview\x27)\x22 class=\x22bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer\x22>▶ دیکھیں</button>" +
            "<button type=\x22button\x22 data-ytid=\x22" + item.ytId + "\x22 onclick=\x22adminApproveChannelUpdateVideo(this.getAttribute(\x27data-ytid\x27))\x22 class=\x22bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer\x22>✅ منظور کریں</button>" +
            "<button type=\x22button\x22 data-ytid=\x22" + item.ytId + "\x22 onclick=\x22adminRejectChannelUpdateVideo(this.getAttribute(\x27data-ytid\x27))\x22 class=\x22bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer\x22>🗑️ ڈیلیٹ</button>" +
          "</div>" +
        "</div>";
      });
    }
    box.innerHTML =
      "<div class=\x22flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5\x22>" +
        "<div>" +
          "<h4 class=\x22text-xs sm:text-sm font-extrabold text-emerald-300 flex items-center gap-2\x22><span>🔔</span> <span>منظور شدہ چینلز کی نئی ویڈیوز (Daily Channel Updates)</span> <span class=\x22bg-emerald-500 text-black px-2 py-0.5 rounded-full text-[10px] font-extrabold\x22>" + q.length + "</span></h4>" +
          "<p class=\x22text-[11px] text-slate-400 mt-0.5\x22>منظور شدہ چینلز میں آنے والی نئی ویڈیوز یہاں خودکار جمع ہوتی ہیں تاکہ آپ چیک کر کے منظور یا ڈیلیٹ کر سکیں۔</p>" +
        "</div>" +
        "<div class=\x22flex items-center gap-1.5\x22>" +
          (q.length > 0 ? "<button type=\x22button\x22 onclick=\x22adminApproveAllChannelUpdates()\x22 class=\x22bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-extrabold shadow cursor-pointer\x22>✅ تمام منظور کریں</button>" : "") +
          "<button type=\x22button\x22 onclick=\x22scanApprovedChannelsForNewVideos(true)\x22 class=\x22bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 rounded-xl text-[11px] font-extrabold shadow cursor-pointer\x22>🔄 ابھی چینلز چیک کریں</button>" +
        "</div>" +
      "</div>" +
      "<div class=\x22space-y-2 max-h-64 overflow-y-auto pr-1\x22>" + rowsHtml + "</div>";
  }

  fetch(FB_BASE + "/qaaf_channel_updates_queue.json?t=" + Date.now()).then(function(r) { return r.ok ? r.json() : null; }).then(function(d) {
    if (d && typeof d === "object") {
      if (Array.isArray(d.queue)) window.qaafChannelUpdatesQueue = d.queue;
      if (Array.isArray(d.rejectedIds)) window.qaafRejectedUpdateYtIds = d.rejectedIds;
      localStorage.setItem("qaaf_channel_updates_queue_v1", JSON.stringify(window.qaafChannelUpdatesQueue));
      localStorage.setItem("qaaf_rejected_update_ytids_v1", JSON.stringify(window.qaafRejectedUpdateYtIds));
      updateAdminChannelUpdatesBadge();
      renderAdminChannelUpdatesBox();
    }
  }).catch(function() {});

  setTimeout(function() {
    renderAdminChannelUpdatesBox();
    updateAdminChannelUpdatesBadge();
    var lastScan = parseInt(localStorage.getItem("qaaf_last_channel_scan_ts") || "0", 10);
    if (Date.now() - lastScan > 12 * 3600 * 1000) window.scanApprovedChannelsForNewVideos(false);
  }, 5000);

  if (!document.getElementById("qaafLightModeMasterCss")) {
    var thStyle = document.createElement("style");
    thStyle.id = "qaafLightModeMasterCss";
    thStyle.textContent = [
      "body.qaaf-light-mode, body.qaaf-light-mode.bg-islamic-family, body.qaaf-light-mode.bg-islamic-kids { background-color: #f8fafc !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #mainHeader { background-color: rgba(255,255,255,0.96) !important; border-bottom: 1px solid #e2e8f0 !important; }",
      "body.qaaf-light-mode #brandMainPrefix { color: #0f172a !important; }",
      "body.qaaf-light-mode #headerDrawerMenuBtn { background-color: #f1f5f9 !important; color: #0f172a !important; border-color: #cbd5e1 !important; }",
      "body.qaaf-light-mode #qaafHeaderSearchToggleBtn svg circle, body.qaaf-light-mode #qaafHeaderSearchToggleBtn svg line { stroke: #0f172a !important; }",
      "body.qaaf-light-mode #qaafHeaderSearchToggleBtn svg text { fill: #0f172a !important; }",
      "body.qaaf-light-mode #qaafHeaderCenterSearch > div { background-color: #f1f5f9 !important; border-color: #cbd5e1 !important; }",
      "body.qaaf-light-mode #qaafHeaderSearchInput { color: #0f172a !important; }",
      "body.qaaf-light-mode #categoryBar { background-color: rgba(255,255,255,0.95) !important; border-bottom: 1px solid #e2e8f0 !important; }",
      "body.qaaf-light-mode #categoryBar .cat-chip:not(.bg-emerald-500) { background-color: #e2e8f0 !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #videoGrid h3 { color: #0f172a !important; }",
      "body.qaaf-light-mode #videoGrid .text-slate-400 { color: #475569 !important; }",
      "body.qaaf-light-mode #qaafShortsShelf h3 { color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafChannelViewHeaderBox { background: #ffffff !important; border-color: #cbd5e1 !important; }",
      "body.qaaf-light-mode #qaafChannelViewHeaderBox h2 { color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafMobileBottomNav { background: #ffffff !important; background-color: #ffffff !important; border-top: 1px solid #e2e8f0 !important; }",
      "body.qaaf-light-mode #qaafMobileBottomNav button { color: #475569 !important; }",
      "body.qaaf-light-mode #qaafMobileBottomNav button.text-white { color: #164e3a !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer { background-color: #ffffff !important; border-right: 1px solid #e2e8f0 !important; color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer h3, body.qaaf-light-mode #qaafLeftSidebarDrawer button { color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer .bg-\\[\\#131822\\] { background-color: #f1f5f9 !important; border-color: #cbd5e1 !important; }"
    ].join("\n");
    document.head.appendChild(thStyle);
  }

  window.applyQaafThemeMode = function(mode) {
    var isLight = (mode === "light");
    document.body.classList.toggle("qaaf-light-mode", isLight);
    localStorage.setItem("qaaf_theme_mode", isLight ? "light" : "dark");
    var btn = document.getElementById("qaafThemeToggleBtn");
    if (btn) {
      btn.innerHTML = isLight
        ? "<span class=\x22flex items-center gap-2.5\x22><span class=\x22text-base\x22>🌙</span> <span>ڈارک موڈ (سیاہ تھیم)</span></span><span class=\x22px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-800 text-white\x22>DARK</span>"
        : "<span class=\x22flex items-center gap-2.5\x22><span class=\x22text-base\x22>☀️</span> <span>لائٹ موڈ (سفید تھیم)</span></span><span class=\x22px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-black\x22>LIGHT</span>";
    }
  };

  window.toggleQaafThemeMode = function() {
    var cur = localStorage.getItem("qaaf_theme_mode") || "dark";
    window.applyQaafThemeMode(cur === "light" ? "dark" : "light");
  };

  function injectThemeToggleButtonInDrawer() {
    var extraBox = document.getElementById("qaafDrawerExtraMenuItems");
    if (!extraBox || document.getElementById("qaafThemeToggleBtn")) return;
    var btn = document.createElement("button");
    btn.id = "qaafThemeToggleBtn";
    btn.type = "button";
    btn.onclick = function() { window.toggleQaafThemeMode(); };
    btn.className = "w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-extrabold text-white transition cursor-pointer";
    extraBox.insertBefore(btn, extraBox.firstChild);
    window.applyQaafThemeMode(localStorage.getItem("qaaf_theme_mode") || "dark");
  }

  window.applyQaafThemeMode(localStorage.getItem("qaaf_theme_mode") || "dark");
  setInterval(function() {
    injectThemeToggleButtonInDrawer();
    renderAdminChannelUpdatesBox();
  }, 800);
})();


// === QAAF V92 SHORTS TOUCH SWIPE & PORTRAIT BOTTOM SETTINGS SHEET ===
(function initQaafV92ShortsSwipeAndBottomSettings() {
  var currentPlaybackRate = 1.0;
  var currentQualityLabel = "Auto (720p)";
  var captionsEnabled = false;
  var isScreenTouchLocked = false;

  function sendYtCmd(func, args) {
    var ifr = document.getElementById("ytIframe");
    if (ifr && ifr.contentWindow) {
      ifr.contentWindow.postMessage(JSON.stringify({ event: "command", func: func, args: args || [] }), "*");
    }
  }

  // =========================================================================
  // 1. YOUTUBE-STYLE BOTTOM SHEET FOR SETTINGS & PLAYBACK SPEED (PORTRAIT MODE)
  // =========================================================================
  function ensureYtBottomSettingsModal() {
    if (document.getElementById("qaafYtBottomSheetModal")) return;
    var modal = document.createElement("div");
    modal.id = "qaafYtBottomSheetModal";
    modal.dir = "ltr";
    modal.className = "fixed inset-0 z-[260] bg-black/60 hidden flex-col justify-end";
    modal.onclick = function(e) {
      if (e.target === modal) window.closeQaafYtBottomSheet();
    };
    modal.innerHTML =
      "<div id=\x22qaafYtBottomSheetContent\x22 class=\x22w-full max-w-lg mx-auto bg-[#212121] text-white rounded-t-3xl p-4 pb-7 shadow-2xl border-t border-white/10 transition-transform duration-200\x22></div>";
    document.body.appendChild(modal);
  }

  window.closeQaafYtBottomSheet = function() {
    var m = document.getElementById("qaafYtBottomSheetModal");
    if (m) {
      m.classList.add("hidden");
      m.classList.remove("flex");
    }
  };

  window.openQaafYtMainSettingsSheet = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    ensureYtBottomSettingsModal();
    var modal = document.getElementById("qaafYtBottomSheetModal");
    var box = document.getElementById("qaafYtBottomSheetContent");
    if (!modal || !box) return;
    var speedStr = (currentPlaybackRate === 1) ? "1x" : (currentPlaybackRate + "x");
    var ccStr = captionsEnabled ? "On" : "Off";

    box.innerHTML =
      "<div class=\x22w-10 h-1 bg-white/30 rounded-full mx-auto mb-4\x22></div>" +
      "<div class=\x22space-y-1 text-sm font-medium\x22>" +
        "<button type=\x22button\x22 onclick=\x22openQaafYtQualitySheet()\x22 class=\x22w-full flex items-center justify-between px-3 py-3.5 rounded-2xl hover:bg-white/10 transition cursor-pointer\x22>" +
          "<div class=\x22flex items-center gap-4\x22>" +
            "<svg viewBox=\x220 0 24 24\x22 class=\x22w-6 h-6 text-white\x22 fill=\x22none\x22 stroke=\x22currentColor\x22 stroke-width=\x221.8\x22><line x1=\x224\x22 y1=\x227\x22 x2=\x2220\x22 y2=\x227\x22/><circle cx=\x229\x22 cy=\x227\x22 r=\x222.5\x22 fill=\x22#212121\x22/><line x1=\x224\x22 y1=\x2217\x22 x2=\x2220\x22 y2=\x2217\x22/><circle cx=\x2215\x22 cy=\x2217\x22 r=\x222.5\x22 fill=\x22#212121\x22/></svg>" +
            "<span class=\x22text-[15px] font-semibold\x22>Quality</span>" +
          "</div>" +
          "<span class=\x22text-neutral-400 text-sm flex items-center gap-1\x22><span>" + currentQualityLabel + "</span><span>›</span></span>" +
        "</button>" +
        "<button type=\x22button\x22 onclick=\x22openQaafYtSpeedSheet()\x22 class=\x22w-full flex items-center justify-between px-3 py-3.5 rounded-2xl hover:bg-white/10 transition cursor-pointer\x22>" +
          "<div class=\x22flex items-center gap-4\x22>" +
            "<svg viewBox=\x220 0 24 24\x22 class=\x22w-6 h-6 text-white\x22 fill=\x22none\x22 stroke=\x22currentColor\x22 stroke-width=\x221.8\x22><circle cx=\x2212\x22 cy=\x2212\x22 r=\x229\x22 stroke-dasharray=\x224 2\x22/><polygon points=\x2210,8.5 16,12 10,15.5\x22 fill=\x22currentColor\x22/></svg>" +
            "<span class=\x22text-[15px] font-semibold\x22>Playback speed</span>" +
          "</div>" +
          "<span class=\x22text-neutral-400 text-sm flex items-center gap-1\x22><span>" + speedStr + "</span><span>›</span></span>" +
        "</button>" +
        "<button type=\x22button\x22 onclick=\x22toggleQaafYtCaptions()\x22 class=\x22w-full flex items-center justify-between px-3 py-3.5 rounded-2xl hover:bg-white/10 transition cursor-pointer\x22>" +
          "<div class=\x22flex items-center gap-4\x22>" +
            "<svg viewBox=\x220 0 24 24\x22 class=\x22w-6 h-6 text-white\x22 fill=\x22none\x22 stroke=\x22currentColor\x22 stroke-width=\x221.8\x22><rect x=\x223\x22 y=\x225\x22 width=\x2218\x22 height=\x2214\x22 rx=\x222.5\x22/><path d=\x22M10 10.5a2 2 0 1 0 0 3M16 10.5a2 2 0 1 0 0 3\x22 stroke-width=\x222\x22 stroke-linecap=\x22round\x22/></svg>" +
            "<span class=\x22text-[15px] font-semibold\x22>Captions</span>" +
          "</div>" +
          "<span class=\x22text-neutral-400 text-sm flex items-center gap-1\x22><span>" + ccStr + "</span><span>›</span></span>" +
        "</button>" +
        "<button type=\x22button\x22 onclick=\x22activateQaafScreenTouchLock()\x22 class=\x22w-full flex items-center justify-between px-3 py-3.5 rounded-2xl hover:bg-white/10 transition cursor-pointer\x22>" +
          "<div class=\x22flex items-center gap-4\x22>" +
            "<svg viewBox=\x220 0 24 24\x22 class=\x22w-6 h-6 text-white\x22 fill=\x22none\x22 stroke=\x22currentColor\x22 stroke-width=\x221.8\x22><rect x=\x225\x22 y=\x2211\x22 width=\x2214\x22 height=\x2210\x22 rx=\x222\x22/><path d=\x22M8 11V7a4 4 0 0 1 8 0v4\x22/></svg>" +
            "<span class=\x22text-[15px] font-semibold\x22>Lock screen</span>" +
          "</div>" +
        "</button>" +
      "</div>";

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  };

  window.openQaafYtSpeedSheet = function() {
    var box = document.getElementById("qaafYtBottomSheetContent");
    if (!box) return;
    var r = currentPlaybackRate;
    var speeds = [0.5, 1.0, 1.25, 1.5, 1.75, 2.0];
    var pillsHtml = speeds.map(function(sp) {
      var isAct = Math.abs(r - sp) < 0.03;
      var lbl = (sp === 1.0) ? "1x" : (sp + "x");
      return "<div class=\x22flex flex-col items-center gap-1\x22>" +
        "<button type=\x22button\x22 onclick=\x22applyQaafPlaybackSpeed(" + sp + ")\x22 class=\x22px-3.5 py-2 rounded-full text-xs font-bold transition cursor-pointer " + (isAct ? "bg-white text-black shadow" : "bg-[#333333] hover:bg-[#444444] text-white") + "\x22>" + lbl + "</button>" +
        (sp === 1.0 ? "<span class=\x22text-[10px] text-neutral-400\x22>Normal</span>" : "") +
      "</div>";
    }).join("");

    box.innerHTML =
      "<div class=\x22w-10 h-1 bg-white/30 rounded-full mx-auto mb-3\x22></div>" +
      "<div class=\x22text-center text-base font-extrabold text-white mb-4\x22 id=\x22qaafSpeedSheetValueLabel\x22>" + r.toFixed(2).replace(/\\.00$/, "x").replace(/(\\.\\d)0$/, "$1x") + (String(r).indexOf(".") !== -1 && !/0$/.test(r.toFixed(2)) ? "x" : "") + "</div>" +
      "<div class=\x22flex items-center gap-3 px-2 mb-6\x22>" +
        "<button type=\x22button\x22 onclick=\x22stepQaafPlaybackSpeed(-0.05)\x22 class=\x22w-10 h-10 rounded-full bg-[#333333] hover:bg-[#444444] text-white text-xl font-bold flex items-center justify-center shrink-0 cursor-pointer\x22>−</button>" +
        "<input id=\x22qaafSpeedRangeInput\x22 type=\x22range\x22 min=\x220.25\x22 max=\x222.0\x22 step=\x220.05\x22 value=\x22" + r + "\x22 oninput=\x22applyQaafPlaybackSpeed(this.value, true)\x22 class=\x22w-full accent-white h-1 bg-neutral-600 rounded-lg cursor-pointer\x22 />" +
        "<button type=\x22button\x22 onclick=\x22stepQaafPlaybackSpeed(0.05)\x22 class=\x22w-10 h-10 rounded-full bg-[#333333] hover:bg-[#444444] text-white text-xl font-bold flex items-center justify-center shrink-0 cursor-pointer\x22>+</button>" +
      "</div>" +
      "<div class=\x22grid grid-cols-6 gap-1.5 items-start px-1\x22>" + pillsHtml + "</div>";
  };

  window.applyQaafPlaybackSpeed = function(val, keepSheetOpen) {
    var num = Math.max(0.25, Math.min(2.0, parseFloat(val) || 1.0));
    currentPlaybackRate = Math.round(num * 100) / 100;
    sendYtCmd("setPlaybackRate", [currentPlaybackRate]);
    var lblEl = document.getElementById("qaafSpeedSheetValueLabel");
    if (lblEl) lblEl.innerText = currentPlaybackRate + "x";
    var rngEl = document.getElementById("qaafSpeedRangeInput");
    if (rngEl && parseFloat(rngEl.value) !== currentPlaybackRate) rngEl.value = currentPlaybackRate;
    if (!keepSheetOpen) {
      window.openQaafYtSpeedSheet();
    }
  };

  window.stepQaafPlaybackSpeed = function(delta) {
    window.applyQaafPlaybackSpeed(currentPlaybackRate + delta, false);
  };

  window.openQaafYtQualitySheet = function() {
    var box = document.getElementById("qaafYtBottomSheetContent");
    if (!box) return;
    var qualities = [
      { label: "1080p HD", code: "hd1080" },
      { label: "720p HD", code: "hd720" },
      { label: "480p", code: "large" },
      { label: "360p", code: "medium" },
      { label: "Auto (Recommended)", code: "default" }
    ];
    box.innerHTML =
      "<div class=\x22w-10 h-1 bg-white/30 rounded-full mx-auto mb-3\x22></div>" +
      "<h4 class=\x22text-sm font-bold text-neutral-300 px-3 mb-2\x22>Quality for current video</h4>" +
      "<div class=\x22space-y-1\x22>" +
        qualities.map(function(q) {
          var act = (currentQualityLabel === q.label);
          return "<button type=\x22button\x22 onclick=\x22selectQaafYtQuality(\x27" + q.code + "\x27, \x27" + q.label + "\x27)\x22 class=\x22w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 flex items-center justify-between text-sm font-semibold cursor-pointer\x22><span>" + q.label + "</span>" + (act ? "<span class=\x22text-emerald-400 font-extrabold\x22>✓</span>" : "") + "</button>";
        }).join("") +
      "</div>";
  };

  window.selectQaafYtQuality = function(code, label) {
    currentQualityLabel = label;
    sendYtCmd("setPlaybackQualityRange", [code, code]);
    sendYtCmd("setPlaybackQuality", [code]);
    window.closeQaafYtBottomSheet();
    if (typeof showSyncToast === "function") showSyncToast("🎬 Quality: " + label);
  };

  window.toggleQaafYtCaptions = function() {
    captionsEnabled = !captionsEnabled;
    if (captionsEnabled) {
      sendYtCmd("loadModule", ["captions"]);
      sendYtCmd("setOption", ["captions", "track", { languageCode: preferredContentLang || "en" }]);
    } else {
      sendYtCmd("unloadModule", ["captions"]);
    }
    window.closeQaafYtBottomSheet();
    if (typeof showSyncToast === "function") showSyncToast(captionsEnabled ? "CLOSED CAPTIONS [CC] Subtitles Turned ON" : "CLOSED CAPTIONS [CC] Subtitles Turned OFF");
  };

  window.activateQaafScreenTouchLock = function() {
    window.closeQaafYtBottomSheet();
    var aspect = document.getElementById("playerAspectBox");
    if (!aspect) return;
    var lockOv = document.getElementById("qaafScreenTouchLockOverlay");
    if (!lockOv) {
      lockOv = document.createElement("div");
      lockOv.id = "qaafScreenTouchLockOverlay";
      lockOv.style.cssText = "position:absolute; inset:0; z-index:55; background:rgba(0,0,0,0.18); display:flex; align-items:flex-end; justify-content:center; padding-bottom:18px;";
      lockOv.innerHTML = "<button type=\x22button\x22 onclick=\x22document.getElementById(\x27qaafScreenTouchLockOverlay\x27).remove()\x22 class=\x22bg-black/85 border border-white/30 text-white px-4 py-2 rounded-full text-xs font-extrabold shadow-xl flex items-center gap-2 cursor-pointer\x22><span>🔒</span><span>Screen locked • Tap to unlock</span></button>";
      aspect.appendChild(lockOv);
    }
  };

  function injectPortraitSettingsTriggerOnVideo() {
    var aspect = document.getElementById("playerAspectBox");
    if (!aspect) return;
    var modal = document.getElementById("playerModal");
    var isShorts = modal && modal.classList.contains("qaaf-shorts-mode");
    var existingGear = document.getElementById("qaafPortraitTopRightGearBtn");
    if (isShorts) {
      if (existingGear) existingGear.style.display = "none";
      return;
    }
    if (!existingGear) {
      existingGear = document.createElement("button");
      existingGear.id = "qaafPortraitTopRightGearBtn";
      existingGear.type = "button";
      existingGear.title = "Video Settings & Speed";
      existingGear.style.cssText = "position:absolute; top:6px; right:6px; width:42px; height:42px; z-index:42; background:transparent; border:none; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0.88;";
      existingGear.innerHTML = "<div class=\x22w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 flex items-center justify-center shadow\x22><svg viewBox=\x220 0 24 24\x22 class=\x22w-5 h-5 text-white\x22 fill=\x22none\x22 stroke=\x22currentColor\x22 stroke-width=\x222\x22><circle cx=\x2212\x22 cy=\x2212\x22 r=\x223\x22/><path d=\x22M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\x22/></svg></div>";
      existingGear.onclick = function(ev) {
        window.openQaafYtMainSettingsSheet(ev);
      };
      aspect.appendChild(existingGear);
    }
    existingGear.style.display = document.fullscreenElement ? "none" : "flex";
  }

  // =========================================================================
  // 2. SHORTS PLAYER: REMOVE ARROWS (▲/▼) & ENABLE TOUCH SWIPE + MOUSE WHEEL
  // =========================================================================
  var YT_SHARE_SVG = "<svg viewBox=\x270 0 24 24\x27 width=\x2718\x27 height=\x2718\x27 fill=\x27currentColor\x27 style=\x27display:inline-block;vertical-align:middle;\x27><path d=\x27M15 5.63 20.66 12 15 18.37V14h-1c-3.96 0-7.14 1-9.75 3.09 1.84-4.07 5.11-6.4 9.89-7.1l.86-.13V5.63M14 3v6C6.22 10.13 3.11 15.33 2 21c2.78-3.97 6.44-6 12-6v6l8-9-8-9z\x27/></svg>";

  function setupShortsSwipeAndCleanButtons() {
    var modal = document.getElementById("playerModal");
    var box = document.getElementById("playerModalBox");
    var aspect = document.getElementById("playerAspectBox");
    if (!modal || modal.classList.contains("hidden") || !aspect) return;
    var video = (videosData || []).find(function(x) { return x && x.id === currentPlayingVideoId; });
    if (!video || !isVideoShort(video)) {
      var swZone = document.getElementById("qaafShortsSwipeGestureZone");
      if (swZone) swZone.style.display = "none";
      injectPortraitSettingsTriggerOnVideo();
      return;
    }

    injectPortraitSettingsTriggerOnVideo();

    // A. Right-side action bar WITHOUT ▲ and ▼ arrows!
    var ov = document.getElementById("qaafYtShortsMasterOverlay");
    if (ov) {
      var isFav = (favoriteVideoIds || []).indexOf(video.id) !== -1;
      var vCount = (typeof window.getQaafRealViewCount === "function") ? window.getQaafRealViewCount(video) : (video.realViews || 1);
      ov.style.cssText = "position:absolute; right:10px; bottom:110px; top:auto; left:auto; width:48px; height:auto; z-index:42; display:flex; flex-direction:column; align-items:center; gap:16px; pointer-events:auto;";
      ov.innerHTML =
        "<div style=\x27display:flex;flex-direction:column;align-items:center;gap:3px;\x27>" +
          "<button type=\x27button\x27 onclick=\x27toggleFavoriteVideo(currentPlayingVideoId,event);setTimeout(window.refreshQaafShortsOverlayNow,40)\x27 style=\x27width:44px;height:44px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;font-size:18px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;\x27>" + (isFav ? "❤️" : "🤍") + "</button>" +
          "<span style=\x27font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000;\x27>" + vCount + "</span>" +
        "</div>" +
        "<div style=\x27display:flex;flex-direction:column;align-items:center;gap:3px;\x27>" +
          "<button type=\x27button\x27 onclick=\x27openShortCommentsPopup(event)\x27 style=\x27width:44px;height:44px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;font-size:17px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;\x27>💬</button>" +
          "<span style=\x27font-size:10px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000;\x27>Comment</span>" +
        "</div>" +
        "<div style=\x27display:flex;flex-direction:column;align-items:center;gap:3px;\x27>" +
          "<button type=\x27button\x27 onclick=\x27shareQaafCurrentVideo(event)\x27 style=\x27width:44px;height:44px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.2);cursor:pointer;\x27>" + YT_SHARE_SVG + "</button>" +
          "<span style=\x27font-size:10px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000;\x27>Share</span>" +
        "</div>";
    }

    // B. Invisible Touch-Swipe & Mouse-Wheel Zone in the middle (leaves Top 64px & Bottom 58px uncovered for YouTube Speaker/CC/Gear/Fullscreen!)
    var gestureZone = document.getElementById("qaafShortsSwipeGestureZone");
    if (!gestureZone) {
      gestureZone = document.createElement("div");
      gestureZone.id = "qaafShortsSwipeGestureZone";
      aspect.appendChild(gestureZone);

      var tStartY = 0, tCurY = 0, tStartX = 0, isSwipingShort = false;
      gestureZone.addEventListener("touchstart", function(e) {
        if (!e.touches || e.touches.length !== 1) return;
        tStartY = e.touches[0].clientY;
        tCurY = tStartY;
        tStartX = e.touches[0].clientX;
        isSwipingShort = true;
      }, { passive: true });

      gestureZone.addEventListener("touchmove", function(e) {
        if (!isSwipingShort || !e.touches || !e.touches.length) return;
        tCurY = e.touches[0].clientY;
        var dy = tCurY - tStartY;
        var b = document.getElementById("playerModalBox");
        if (b && Math.abs(dy) > 8) {
          b.style.transition = "none";
          b.style.transform = "translateY(" + Math.max(-120, Math.min(120, dy * 0.45)) + "px)";
        }
      }, { passive: true });

      gestureZone.addEventListener("touchend", function(e) {
        if (!isSwipingShort) return;
        isSwipingShort = false;
        var dy = tCurY - tStartY;
        var b = document.getElementById("playerModalBox");
        if (b) {
          b.style.transition = "transform 0.2s ease-out";
          b.style.transform = "none";
        }
        if (dy < -42) {
          window.playAdjacentShort(1);
        } else if (dy > 42) {
          window.playAdjacentShort(-1);
        } else if (Math.abs(dy) < 10) {
          if (typeof window.toggleQaafShortPlayPause === "function") window.toggleQaafShortPlayPause(e);
        }
        tStartY = 0; tCurY = 0;
      }, { passive: true });

      var lastWheelTs = 0;
      gestureZone.addEventListener("wheel", function(e) {
        var now = Date.now();
        if (now - lastWheelTs < 550) return;
        if (Math.abs(e.deltaY) > 18) {
          e.preventDefault();
          lastWheelTs = now;
          window.playAdjacentShort(e.deltaY > 0 ? 1 : -1);
        }
      }, { passive: false });
    }
    gestureZone.style.cssText = "position:absolute; top:64px; bottom:58px; left:0; right:62px; z-index:39; display:block; background:transparent; touch-action:none; cursor:pointer;";
  }

  window.refreshQaafShortsOverlayNow = setupShortsSwipeAndCleanButtons;

  // Also allow mouse wheel anywhere on #playerModal and Up/Down arrow keys when in Shorts mode
  var lastModalWheelTs = 0;
  document.addEventListener("wheel", function(e) {
    var modal = document.getElementById("playerModal");
    if (!modal || modal.classList.contains("hidden") || !modal.classList.contains("qaaf-shorts-mode")) return;
    var now = Date.now();
    if (now - lastModalWheelTs < 550) return;
    if (Math.abs(e.deltaY) > 20) {
      lastModalWheelTs = now;
      window.playAdjacentShort(e.deltaY > 0 ? 1 : -1);
    }
  }, { passive: true });

  document.addEventListener("keydown", function(e) {
    var modal = document.getElementById("playerModal");
    if (!modal || modal.classList.contains("hidden") || !modal.classList.contains("qaaf-shorts-mode")) return;
    if (e.key === "ArrowDown") { e.preventDefault(); window.playAdjacentShort(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); window.playAdjacentShort(-1); }
  });

  var prevOpenV92 = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    currentPlaybackRate = 1.0;
    if (prevOpenV92) prevOpenV92.apply(this, arguments);
    setTimeout(setupShortsSwipeAndCleanButtons, 80);
    setTimeout(setupShortsSwipeAndCleanButtons, 260);
  };

  setInterval(setupShortsSwipeAndCleanButtons, 500);
})();


// === QAAF V93 DRAWER FIX, ENGLISH UI & LIVE ANALYTICS DASHBOARD ===
(function initQaafV93MasterAllInOne() {
  var FB_BASE = (localStorage.getItem("qaaf_firebase_db_url") || "https://qaaftube-6f251-default-rtdb.firebaseio.com").replace(/\/+$/, "");
  var ANALYTICS_FB_URL = FB_BASE + "/qaaf_analytics_db.json";
  var ANALYTICS_CACHE_KEY = "qaaf_analytics_cache_v1";

  // =========================================================================
  // A. FIX LEFT SIDEBAR DRAWER Z-INDEX (NO HEADER/FOOTER OVERLAP) & STOP FLICKER
  // =========================================================================
  if (!document.getElementById("qaafV93DrawerAndLightCss")) {
    var st = document.createElement("style");
    st.id = "qaafV93DrawerAndLightCss";
    st.textContent = [
      "#qaafLeftSidebarBackdrop { z-index: 205 !important; }",
      "#qaafLeftSidebarDrawer { z-index: 210 !important; top: 0 !important; bottom: 0 !important; height: 100dvh !important; max-height: 100dvh !important; }",
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
      "body.qaaf-light-mode #qaafLeftSidebarDrawer h3, body.qaaf-light-mode #qaafLeftSidebarDrawer button { color: #0f172a !important; }",
      "body.qaaf-light-mode #qaafLeftSidebarDrawer .bg-\\[\\#131822\\], body.qaaf-light-mode #qaafLeftSidebarDrawer .bg-\\[\\#0a0d13\\] { background-color: #f8fafc !important; border-color: #cbd5e1 !important; }"
    ].join("\n");
    document.head.appendChild(st);
  }

  var subPl = document.getElementById("drawerSub_playlists");
  var subHi = document.getElementById("drawerSub_history");
  if (subPl && !subPl.getAttribute("data-init-collapsed")) {
    subPl.setAttribute("data-init-collapsed", "1");
    subPl.classList.add("hidden");
  }
  if (subHi && !subHi.getAttribute("data-init-collapsed")) {
    subHi.setAttribute("data-init-collapsed", "1");
    subHi.classList.add("hidden");
  }

  window.applyQaafThemeMode = function(mode) {
    var isLight = (mode === "light");
    document.body.classList.toggle("qaaf-light-mode", isLight);
    localStorage.setItem("qaaf_theme_mode", isLight ? "light" : "dark");
    renderStableDrawerExtraItems(true);
  };

  window.toggleQaafThemeMode = function(ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    var cur = localStorage.getItem("qaaf_theme_mode") || "dark";
    window.applyQaafThemeMode(cur === "light" ? "dark" : "light");
  };

  var lastDrawerStateSignature = "";
  function renderStableDrawerExtraItems(forceRebuild) {
    var drawer = document.getElementById("qaafLeftSidebarDrawer");
    if (!drawer) return;
    var reqCount = 0;
    try {
      var myReqs = JSON.parse(localStorage.getItem("qaaf_my_submitted_req_ids") || "[]");
      if (Array.isArray(myReqs)) reqCount = myReqs.length;
    } catch (e) {}
    var isPro = localStorage.getItem("qaaf_pro_unlocked") === "true" || !!window.isProUnlocked || (typeof isSupporterPro !== "undefined" && isSupporterPro);
    var curTheme = localStorage.getItem("qaaf_theme_mode") || "dark";
    var isLight = (curTheme === "light");
    var sig = reqCount + "_" + (isPro ? "1" : "0") + "_" + curTheme;

    var extraBox = document.getElementById("qaafDrawerExtraMenuItems");
    if (!extraBox) {
      var navArea = drawer.querySelector(".overflow-y-auto") || drawer;
      extraBox = document.createElement("div");
      extraBox.id = "qaafDrawerExtraMenuItems";
      extraBox.className = "pt-2 pb-2 space-y-2 border-t border-slate-800/80";
      navArea.appendChild(extraBox);
    }

    if (!extraBox._lockedInnerHtmlSetter) {
      extraBox._lockedInnerHtmlSetter = true;
      var origDesc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
      if (origDesc && origDesc.set) {
        Object.defineProperty(extraBox, "innerHTML", {
          get: function() { return origDesc.get.call(this); },
          set: function(val) {
            if (this._allowQaafV93Write) origDesc.set.call(this, val);
          }
        });
      }
    }

    if (!forceRebuild && lastDrawerStateSignature === sig && document.getElementById("qaafThemeToggleBtn")) return;
    lastDrawerStateSignature = sig;

    extraBox._allowQaafV93Write = true;
    extraBox.innerHTML =
      "<button type=\x22button\x22 id=\x22qaafThemeToggleBtn\x22 onclick=\x22window.toggleQaafThemeMode(event)\x22 class=\x22w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-extrabold text-white transition cursor-pointer\x22>" +
        "<span class=\x22flex items-center gap-2.5\x22><span class=\x22text-base\x22>" + (isLight ? "🌙" : "☀️") + "</span> <span>" + (isLight ? "Dark Mode" : "Light Mode") + "</span></span>" +
        "<span class=\x22px-2.5 py-0.5 rounded-full text-[10px] font-extrabold " + (isLight ? "bg-slate-800 text-white" : "bg-amber-400 text-black") + "\x22>" + (isLight ? "DARK" : "LIGHT") + "</span>" +
      "</button>" +
      "<button type=\x22button\x22 onclick=\x22window.openVideoRequestFromDrawer()\x22 class=\x22w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#11221c] hover:bg-[#16382b] border border-emerald-500/35 text-xs font-extrabold text-white transition cursor-pointer\x22>" +
        "<span class=\x22flex items-center gap-2.5\x22><span class=\x22text-base\x22>📩</span> <span>Video Request &amp; Status</span></span>" +
        "<span id=\x22drawerVideoRequestBadge\x22 class=\x22px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-black\x22>" + reqCount + "</span>" +
      "</button>" +
      "<button type=\x22button\x22 onclick=\x22window.openQaafProMembershipModal()\x22 class=\x22w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#164e3a] to-[#0f3d2e] hover:from-[#1d634a] hover:to-[#164e3a] border border-emerald-400/50 text-xs font-extrabold text-white shadow transition cursor-pointer\x22>" +
        "<span class=\x22flex items-center gap-2.5\x22><span class=\x22text-base\x22>👑</span> <span>" + (isPro ? "QAAF Pro Member (Active)" : "Get Pro Membership / Code") + "</span></span>" +
        "<span class=\x22px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-white text-[#0f3d2e]\x22>" + (isPro ? "ACTIVE" : "PRO") + "</span>" +
      "</button>" +
      "<a href=\x22./apk/qaaf-tube.apk\x22 download=\x22qaaf-tube.apk\x22 class=\x22w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-300 transition cursor-pointer no-underline\x22>" +
        "<span class=\x22flex items-center gap-2.5\x22><span class=\x22text-base\x22>🤖</span> <span>Download Android App (APK)</span></span>" +
        "<span class=\x22text-[10px] font-extrabold text-white\x22>⬇ APK</span>" +
      "</a>" +
      "<div class=\x22bg-black/40 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-300 space-y-1\x22>" +
        "<div class=\x22font-extrabold text-emerald-300 flex items-center gap-1.5\x22><span>📢</span> <span>Sponsor &amp; Promotion</span></div>" +
        "<p class=\x22text-[10px] text-slate-400 leading-relaxed\x22>For halal sponsorship, promotion, or support on QAAF Tube:</p>" +
        "<a href=\x22mailto:contactqaaftube@gmail.com\x22 onclick=\x22if(window.recordAnalyticsEvent)window.recordAnalyticsEvent(\x27sponsor\x27,0,null)\x22 class=\x22inline-block text-emerald-400 hover:underline font-bold text-[11px]\x22>contactqaaftube@gmail.com</a>" +
      "</div>";
    extraBox._allowQaafV93Write = false;
  }

  window.applyQaafThemeMode(localStorage.getItem("qaaf_theme_mode") || "dark");

  // =========================================================================
  // B. CLEAN ENGLISH UI FOR DAILY CHANNEL UPDATES SCANNER
  // =========================================================================
  var SKIP_CHANNEL_NAMES = new Set(["Official Hub", "Islamic Channel", "YouTube Creator", "YouTube Channel", "Requested Channel", "General"]);
  window.qaafChannelUpdatesQueue = (window.qaafChannelUpdatesQueue || []).filter(function(item) {
    return item && item.channel && !SKIP_CHANNEL_NAMES.has(item.channel);
  });
  try { localStorage.setItem("qaaf_channel_updates_queue_v1", JSON.stringify(window.qaafChannelUpdatesQueue)); } catch(e) {}

  window.renderAdminChannelUpdatesBoxEng = function() {
    var pubPane = document.getElementById("admPane_publish");
    if (!pubPane) return;
    var box = document.getElementById("admDailyChannelUpdatesCard");
    if (!box) {
      box = document.createElement("div");
      box.id = "admDailyChannelUpdatesCard";
      box.className = "bg-gradient-to-br from-[#0e1b24] to-[#111722] border-2 border-emerald-500/50 rounded-2xl p-4 space-y-3 text-xs mb-4 shadow-xl";
      pubPane.insertBefore(box, pubPane.children[1] || pubPane.firstChild);
    }
    if (!box._lockedEngSetter) {
      box._lockedEngSetter = true;
      var origDesc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
      if (origDesc && origDesc.set) {
        Object.defineProperty(box, "innerHTML", {
          get: function() { return origDesc.get.call(this); },
          set: function(val) {
            if (this._allowEngWrite) origDesc.set.call(this, val);
          }
        });
      }
    }
    var q = (window.qaafChannelUpdatesQueue || []).filter(function(item) {
      return item && item.channel && !SKIP_CHANNEL_NAMES.has(item.channel);
    });
    var rowsHtml = "";
    if (q.length === 0) {
      rowsHtml = "<p class=\x22text-slate-400 py-2 text-center\x22>✅ All approved channels are up to date. No new videos pending review.</p>";
    } else {
      q.forEach(function(item) {
        var thumb = "https://i.ytimg.com/vi/" + item.ytId + "/mqdefault.jpg";
        rowsHtml += "<div class=\x22bg-black/70 border border-emerald-500/30 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5\x22>" +
          "<div class=\x22flex items-center gap-2.5 min-w-0 flex-1\x22>" +
            "<img src=\x22" + thumb + "\x22 class=\x22w-16 h-10 object-cover rounded-lg border border-white/15 shrink-0\x22 />" +
            "<div class=\x22min-w-0 flex-1\x22>" +
              "<p class=\x22font-extrabold text-white truncate\x22>" + item.title + "</p>" +
              "<p class=\x22text-[11px] text-emerald-400 font-bold\x22>📺 " + item.channel + " • " + (item.detectedAt || "New") + "</p>" +
            "</div>" +
          "</div>" +
          "<div class=\x22flex flex-wrap items-center gap-1.5 shrink-0\x22>" +
            "<button type=\x22button\x22 data-ytid=\x22" + item.ytId + "\x22 onclick=\x22playVideoInsideAdminModal(this.getAttribute(\x27data-ytid\x27), \x27Preview\x27)\x22 class=\x22bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer\x22>▶ Preview</button>" +
            "<button type=\x22button\x22 data-ytid=\x22" + item.ytId + "\x22 onclick=\x22adminApproveChannelUpdateVideo(this.getAttribute(\x27data-ytid\x27)); window.renderAdminChannelUpdatesBoxEng();\x22 class=\x22bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer\x22>✅ Approve</button>" +
            "<button type=\x22button\x22 data-ytid=\x22" + item.ytId + "\x22 onclick=\x22adminRejectChannelUpdateVideo(this.getAttribute(\x27data-ytid\x27)); window.renderAdminChannelUpdatesBoxEng();\x22 class=\x22bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer\x22>🗑️ Delete</button>" +
          "</div>" +
        "</div>";
      });
    }
    box._allowEngWrite = true;
    box.innerHTML =
      "<div class=\x22flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5\x22>" +
        "<div>" +
          "<h4 class=\x22text-xs sm:text-sm font-extrabold text-emerald-300 flex items-center gap-2\x22><span>🔔</span> <span>Daily Channel Updates (New Videos)</span> <span class=\x22bg-emerald-500 text-black px-2 py-0.5 rounded-full text-[10px] font-extrabold\x22>" + q.length + "</span></h4>" +
          "<p class=\x22text-[11px] text-slate-400 mt-0.5\x22>Newly uploaded videos from your approved channels appear here for quick review &amp; approval.</p>" +
        "</div>" +
        "<div class=\x22flex items-center gap-1.5\x22>" +
          (q.length > 0 ? "<button type=\x22button\x22 onclick=\x22adminApproveAllChannelUpdates(); window.renderAdminChannelUpdatesBoxEng();\x22 class=\x22bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-extrabold shadow cursor-pointer\x22>✅ Approve All</button>" : "") +
          "<button type=\x22button\x22 onclick=\x22scanApprovedChannelsForNewVideos(true)\x22 class=\x22bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 rounded-xl text-[11px] font-extrabold shadow cursor-pointer\x22>🔄 Scan Channels Now</button>" +
        "</div>" +
      "</div>" +
      "<div class=\x22space-y-2 max-h-64 overflow-y-auto pr-1\x22>" + rowsHtml + "</div>";
    box._allowEngWrite = false;
  };

  // =========================================================================
  // C. AUTO-HIDE VIDEO SETTINGS GEAR (1.5s) & ADD SETTINGS PILL BELOW VIDEO
  // =========================================================================
  var gearHideTimer = null;
  function wakeGearIconTemporarily() {
    var g = document.getElementById("qaafPortraitTopRightGearBtn");
    if (!g) return;
    var modal = document.getElementById("playerModal");
    if (!modal || modal.classList.contains("hidden") || modal.classList.contains("qaaf-shorts-mode") || document.fullscreenElement) {
      g.style.display = "none";
      return;
    }
    g.style.display = "flex";
    g.style.opacity = "0.9";
    g.style.pointerEvents = "auto";
    if (gearHideTimer) clearTimeout(gearHideTimer);
    gearHideTimer = setTimeout(function() {
      if (g) { g.style.opacity = "0"; g.style.pointerEvents = "none"; }
    }, 1600);
  }
  var pAspect = document.getElementById("playerAspectBox");
  if (pAspect) {
    pAspect.addEventListener("touchstart", wakeGearIconTemporarily, { passive: true, capture: true });
    pAspect.addEventListener("click", wakeGearIconTemporarily, { capture: true });
  }
  setTimeout(wakeGearIconTemporarily, 400);

  function ensureActionRowSettingsPill() {
    var hdr = document.getElementById("ytCleanWatchHeader");
    if (!hdr || document.getElementById("qaafWatchActionSettingsPill")) return;
    var flagBtn = hdr.querySelector("button[onclick*=\x27openFlagModal\x27]");
    if (flagBtn && flagBtn.parentNode) {
      var sPill = document.createElement("button");
      sPill.id = "qaafWatchActionSettingsPill";
      sPill.type = "button";
      sPill.onclick = function(ev) { if (window.openQaafYtMainSettingsSheet) window.openQaafYtMainSettingsSheet(ev); };
      sPill.className = "bg-[#272727] hover:bg-[#383838] text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition shrink-0 cursor-pointer";
      sPill.innerHTML = "<span>⚙️</span> <span class=\x22text-[11px] text-neutral-200\x22>Speed / Quality</span>";
      flagBtn.parentNode.insertBefore(sPill, flagBtn);
    }
  }

  // =========================================================================
  // D. OFFICIAL 5-SENSOR ANALYTICS ARCHITECTURE (qaaf_analytics_db.json)
  // =========================================================================
  function getDefaultAnalyticsState() {
    return {
      daily: {},
      videoViews: {},
      userStats: {},
      regionStats: {},
      langStats: {},
      totalViews: 0,
      totalWatchSeconds: 0,
      totalGamePlays: 0,
      sponsorClicks: 0,
      updatedAt: Date.now()
    };
  }

  window.qaafAnalyticsData = getDefaultAnalyticsState();
  try {
    var cachedAn = localStorage.getItem(ANALYTICS_CACHE_KEY);
    if (cachedAn) {
      window.qaafAnalyticsData = Object.assign(getDefaultAnalyticsState(), JSON.parse(cachedAn));
    }
  } catch (e) {}

  function getTodayKey() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  window.detectQaafUserRegion = function() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      var tzl = tz.toLowerCase();
      if (tzl.indexOf("karachi") !== -1 || tzl.indexOf("pakistan") !== -1) return "Pakistan / South Asia";
      if (tzl.indexOf("riyadh") !== -1 || tzl.indexOf("dubai") !== -1 || tzl.indexOf("qatar") !== -1 || tzl.indexOf("kuwait") !== -1 || tzl.indexOf("bahrain") !== -1 || tzl.indexOf("muscat") !== -1 || tzl.indexOf("aden") !== -1) return "Saudi Arabia / Gulf GCC";
      if (tzl.indexOf("london") !== -1 || tzl.indexOf("europe") !== -1 || tzl.indexOf("paris") !== -1 || tzl.indexOf("berlin") !== -1) return "UK / Europe";
      if (tzl.indexOf("america") !== -1 || tzl.indexOf("us/") !== -1 || tzl.indexOf("canada") !== -1 || tzl.indexOf("new_york") !== -1 || tzl.indexOf("chicago") !== -1 || tzl.indexOf("los_angeles") !== -1 || tzl.indexOf("toronto") !== -1) return "USA / North America";
      if (tzl.indexOf("istanbul") !== -1 || tzl.indexOf("cairo") !== -1 || tzl.indexOf("amman") !== -1 || tzl.indexOf("baghdad") !== -1) return "Turkey / MENA";
      if (tzl.indexOf("jakarta") !== -1 || tzl.indexOf("kuala_lumpur") !== -1 || tzl.indexOf("singapore") !== -1 || tzl.indexOf("makassar") !== -1) return "Malaysia / Indonesia SEA";
      if (tzl.indexOf("dhaka") !== -1) return "Bangladesh";
      if (tzl.indexOf("kolkata") !== -1 || tzl.indexOf("calcutta") !== -1) return "India";
      return "Global / International";
    } catch (e) {
      return "Pakistan / South Asia";
    }
  };

  window.syncAnalyticsWithFirebase = function() {
    try {
      window.qaafAnalyticsData.updatedAt = Date.now();
      localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(window.qaafAnalyticsData));
    } catch (e) {}
    fetch(ANALYTICS_FB_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(window.qaafAnalyticsData)
    }).catch(function() {});
  };

  function pullAndMergeCloudAnalytics() {
    fetch(ANALYTICS_FB_URL + "?t=" + Date.now())
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(remote) {
        if (!remote || typeof remote !== "object") return;
        var loc = window.qaafAnalyticsData || getDefaultAnalyticsState();
        loc.daily = loc.daily || {};
        Object.keys(remote.daily || {}).forEach(function(dt) {
          var rd = remote.daily[dt] || {};
          var ld = loc.daily[dt] || { views: 0, watchSeconds: 0, gamePlays: 0, sponsorClicks: 0 };
          loc.daily[dt] = {
            views: Math.max(ld.views || 0, rd.views || 0),
            watchSeconds: Math.max(ld.watchSeconds || 0, rd.watchSeconds || 0),
            gamePlays: Math.max(ld.gamePlays || 0, rd.gamePlays || 0),
            sponsorClicks: Math.max(ld.sponsorClicks || 0, rd.sponsorClicks || 0)
          };
        });
        loc.videoViews = loc.videoViews || {};
        Object.keys(remote.videoViews || {}).forEach(function(vid) {
          loc.videoViews[vid] = Math.max(loc.videoViews[vid] || 0, remote.videoViews[vid] || 0);
        });
        loc.userStats = loc.userStats || {};
        Object.keys(remote.userStats || {}).forEach(function(uk) {
          var ru = remote.userStats[uk] || {};
          var lu = loc.userStats[uk] || { views: 0, watchSeconds: 0, region: "", lastActive: "" };
          loc.userStats[uk] = {
            email: lu.email || ru.email || uk,
            views: Math.max(lu.views || 0, ru.views || 0),
            watchSeconds: Math.max(lu.watchSeconds || 0, ru.watchSeconds || 0),
            region: lu.region || ru.region || window.detectQaafUserRegion(),
            lastActive: lu.lastActive || ru.lastActive || ""
          };
        });
        loc.regionStats = loc.regionStats || {};
        Object.keys(remote.regionStats || {}).forEach(function(rk) {
          var rr = remote.regionStats[rk] || {};
          var lr = loc.regionStats[rk] || { views: 0, watchSeconds: 0 };
          loc.regionStats[rk] = {
            views: Math.max(lr.views || 0, rr.views || 0),
            watchSeconds: Math.max(lr.watchSeconds || 0, rr.watchSeconds || 0)
          };
        });
        loc.langStats = loc.langStats || {};
        Object.keys(remote.langStats || {}).forEach(function(lk) {
          var rl = remote.langStats[lk] || {};
          var ll = loc.langStats[lk] || { views: 0, watchSeconds: 0 };
          loc.langStats[lk] = {
            views: Math.max(ll.views || 0, rl.views || 0),
            watchSeconds: Math.max(ll.watchSeconds || 0, rl.watchSeconds || 0)
          };
        });
        loc.totalViews = Math.max(loc.totalViews || 0, remote.totalViews || 0);
        loc.totalWatchSeconds = Math.max(loc.totalWatchSeconds || 0, remote.totalWatchSeconds || 0);
        loc.totalGamePlays = Math.max(loc.totalGamePlays || 0, remote.totalGamePlays || 0);
        loc.sponsorClicks = Math.max(loc.sponsorClicks || 0, remote.sponsorClicks || 0);
        window.qaafAnalyticsData = loc;
        try { localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(loc)); } catch (e) {}
        if (typeof window.renderAdminAnalyticsDashboard === "function") window.renderAdminAnalyticsDashboard();
      }).catch(function() {});
  }
  pullAndMergeCloudAnalytics();

  window.recordAnalyticsEvent = function(eventType, secondsAdded, videoObj) {
    var db = window.qaafAnalyticsData || getDefaultAnalyticsState();
    var dt = getTodayKey();
    if (!db.daily) db.daily = {};
    if (!db.daily[dt]) db.daily[dt] = { views: 0, watchSeconds: 0, gamePlays: 0, sponsorClicks: 0 };

    var uKey = (typeof currentUserEmail !== "undefined" && currentUserEmail) ? currentUserEmail.toLowerCase().trim() : "guest_device";
    var safeUKey = uKey.replace(/[^a-zA-Z0-9_-]+/g, "_");
    var regName = window.detectQaafUserRegion();
    var langCode = String((videoObj && videoObj.lang) || window.preferredContentLang || preferredContentLang || "en").toLowerCase();
    if (langCode === "global") langCode = String(window.preferredContentLang || preferredContentLang || "ur").toLowerCase();

    if (!db.userStats) db.userStats = {};
    if (!db.userStats[safeUKey]) db.userStats[safeUKey] = { email: uKey, views: 0, watchSeconds: 0, region: regName, lastActive: "" };
    db.userStats[safeUKey].email = uKey;
    db.userStats[safeUKey].region = regName;
    db.userStats[safeUKey].lastActive = new Date().toLocaleString();

    if (!db.regionStats) db.regionStats = {};
    if (!db.regionStats[regName]) db.regionStats[regName] = { views: 0, watchSeconds: 0 };

    if (!db.langStats) db.langStats = {};
    if (!db.langStats[langCode]) db.langStats[langCode] = { views: 0, watchSeconds: 0 };

    if (eventType === "view") {
      db.daily[dt].views = (db.daily[dt].views || 0) + 1;
      db.totalViews = (db.totalViews || 0) + 1;
      db.userStats[safeUKey].views = (db.userStats[safeUKey].views || 0) + 1;
      db.regionStats[regName].views = (db.regionStats[regName].views || 0) + 1;
      db.langStats[langCode].views = (db.langStats[langCode].views || 0) + 1;
      if (videoObj && (videoObj.id || videoObj.ytId)) {
        var vKey = videoObj.ytId || videoObj.id;
        if (!db.videoViews) db.videoViews = {};
        db.videoViews[vKey] = (db.videoViews[vKey] || 0) + 1;
      }
      window.syncAnalyticsWithFirebase();
    } else if (eventType === "watch_heartbeat") {
      var sec = secondsAdded || 15;
      db.daily[dt].watchSeconds = (db.daily[dt].watchSeconds || 0) + sec;
      db.totalWatchSeconds = (db.totalWatchSeconds || 0) + sec;
      db.userStats[safeUKey].watchSeconds = (db.userStats[safeUKey].watchSeconds || 0) + sec;
      db.regionStats[regName].watchSeconds = (db.regionStats[regName].watchSeconds || 0) + sec;
      db.langStats[langCode].watchSeconds = (db.langStats[langCode].watchSeconds || 0) + sec;
      try { localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(db)); } catch (e) {}
    } else if (eventType === "game") {
      db.daily[dt].gamePlays = (db.daily[dt].gamePlays || 0) + 1;
      db.totalGamePlays = (db.totalGamePlays || 0) + 1;
      window.syncAnalyticsWithFirebase();
    } else if (eventType === "sponsor") {
      db.daily[dt].sponsorClicks = (db.daily[dt].sponsorClicks || 0) + 1;
      db.sponsorClicks = (db.sponsorClicks || 0) + 1;
      window.syncAnalyticsWithFirebase();
    }
  };

  var prevOpenAn = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    if (prevOpenAn) prevOpenAn.apply(this, arguments);
    var v = (videosData || []).find(function(x) { return x && x.id === videoId; });
    if (v) window.recordAnalyticsEvent("view", 0, v);
  };

  var heartbeatTicks = 0;
  setInterval(function() {
    var pModal = document.getElementById("playerModal");
    var gModal1 = document.getElementById("qaafActiveGamePlayModal");
    var gModal2 = document.getElementById("gamePlayModal");
    var gModal3 = document.getElementById("qaafStandaloneGamesModal");
    var isVideoActive = pModal && !pModal.classList.contains("hidden");
    var isGameActive = (gModal1 && !gModal1.classList.contains("hidden")) || (gModal2 && !gModal2.classList.contains("hidden")) || (gModal3 && !gModal3.classList.contains("hidden"));
    if (isVideoActive || isGameActive) {
      var curV = isVideoActive ? (videosData || []).find(function(x) { return x && x.id === currentPlayingVideoId; }) : null;
      window.recordAnalyticsEvent("watch_heartbeat", 15, curV);
      heartbeatTicks++;
      if (heartbeatTicks % 4 === 0) {
        window.syncAnalyticsWithFirebase();
      }
    }
  }, 15000);

  var prevOpenGameModal = window.openInstalledGameModal;
  if (typeof prevOpenGameModal === "function") {
    window.openInstalledGameModal = function(gameId) {
      window.recordAnalyticsEvent("game", 0, null);
      return prevOpenGameModal.apply(this, arguments);
    };
  }
  var prevInstallGame = window.installAndOpenGame;
  if (typeof prevInstallGame === "function") {
    window.installAndOpenGame = function(gameId) {
      window.recordAnalyticsEvent("game", 0, null);
      return prevInstallGame.apply(this, arguments);
    };
  }

  var prevOpenSponsor = window.openSponsorContactModal;
  if (typeof prevOpenSponsor === "function") {
    window.openSponsorContactModal = function() {
      window.recordAnalyticsEvent("sponsor", 0, null);
      return prevOpenSponsor.apply(this, arguments);
    };
  }
  ["promoTickerLink", "promoImageBannerLink"].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && !el.getAttribute("data-spons-bound")) {
      el.setAttribute("data-spons-bound", "1");
      el.addEventListener("click", function() { window.recordAnalyticsEvent("sponsor", 0, null); });
    }
  });

  window.activeAnalyticsDays = 0;
  window.getFilteredAnalytics = function(days) {
    var db = window.qaafAnalyticsData || getDefaultAnalyticsState();
    var daily = db.daily || {};
    var catalogViews = 0;
    (videosData || []).forEach(function(v) {
      if (!v) return;
      catalogViews += (typeof window.getQaafRealViewCount === "function") ? window.getQaafRealViewCount(v) : (v.realViews || 0);
    });

    var views = 0, watchSeconds = 0, gamePlays = 0, sponsorClicks = 0;
    var now = new Date();
    Object.keys(daily).forEach(function(dtStr) {
      var dObj = daily[dtStr] || {};
      var include = true;
      if (days && days > 0) {
        var parts = dtStr.split("-");
        if (parts.length === 3) {
          var dtTime = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
          var diffDays = (now.getTime() - dtTime) / (1000 * 3600 * 24);
          if (diffDays > days) include = false;
        }
      }
      if (include) {
        views += (dObj.views || 0);
        watchSeconds += (dObj.watchSeconds || 0);
        gamePlays += (dObj.gamePlays || 0);
        sponsorClicks += (dObj.sponsorClicks || 0);
      }
    });

    if (!days || days === 0) {
      views = Math.max(views, db.totalViews || 0, catalogViews);
      watchSeconds = Math.max(watchSeconds, db.totalWatchSeconds || 0, views * 150);
      gamePlays = Math.max(gamePlays, db.totalGamePlays || 0);
      sponsorClicks = Math.max(sponsorClicks, db.sponsorClicks || 0);
    } else if (views > 0 && watchSeconds === 0) {
      watchSeconds = views * 120;
    }

    return {
      views: views,
      watchSeconds: watchSeconds,
      gamePlays: gamePlays,
      sponsorClicks: sponsorClicks
    };
  };

  function formatHoursAndMins(totalSecs) {
    var s = Math.max(0, Math.round(totalSecs || 0));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (h === 0 && m === 0 && s > 0) m = 1;
    return h + " hrs " + m + " mins";
  }

  function injectAdminAnalyticsTab() {
    var sidebar = document.getElementById("edgeAdminSidebar");
    var rightArea = document.querySelector("#adminDashboardModal .flex-1.overflow-y-auto");
    if (!sidebar || !rightArea || document.getElementById("admTabBtn_analytics")) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "admTabBtn_analytics";
    btn.onclick = function() { switchAdminTab("analytics"); window.renderAdminAnalyticsDashboard(); };
    btn.className = "adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1.5 transition text-slate-300 hover:bg-white/5";
    btn.innerHTML =
      "<span class=\x22flex items-center gap-1.5 truncate\x22><span>📊</span> <span class=\x22truncate\x22>Analytics &amp; Stats</span></span>" +
      "<span id=\x22admSidebarAnalyticsBadge\x22 class=\x22bg-emerald-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0\x22>Live</span>";
    sidebar.appendChild(btn);

    var pane = document.createElement("div");
    pane.id = "admPane_analytics";
    pane.className = "adm-tab-pane hidden space-y-5";
    rightArea.appendChild(pane);
  }

  window.selectAnalyticsDaysFilter = function(days) {
    window.activeAnalyticsDays = days;
    window.renderAdminAnalyticsDashboard();
  };

  var TEN_LANG_LABELS = {
    en: "🇬🇧 English (EN)",
    ar: "🇸🇦 Arabic (AR)",
    ur: "🇵🇰 Urdu (UR)",
    hi: "🇮🇳 Hindi (HI)",
    bn: "🇧🇩 Bengali (BN)",
    tr: "🇹🇷 Turkish (TR)",
    ms: "🇲🇾 Malay (MS)",
    id: "🇮🇩 Indonesian (ID)",
    fr: "🇫🇷 French (FR)",
    ru: "🇷🇺 Russian (RU)"
  };

  var EIGHT_REGIONS_LIST = [
    "Pakistan / South Asia",
    "Saudi Arabia / Gulf GCC",
    "UK / Europe",
    "USA / North America",
    "Turkey / MENA",
    "Malaysia / Indonesia SEA",
    "Bangladesh",
    "India"
  ];

  window.renderAdminAnalyticsDashboard = function() {
    injectAdminAnalyticsTab();
    var pane = document.getElementById("admPane_analytics");
    if (!pane) return;
    var days = window.activeAnalyticsDays || 0;
    var stats = window.getFilteredAnalytics(days);
    var db = window.qaafAnalyticsData || getDefaultAnalyticsState();
    var totalFamilies = Object.keys(window.registeredUsersMap || {}).length;

    var sideBadge = document.getElementById("admSidebarAnalyticsBadge");
    if (sideBadge) sideBadge.innerText = stats.views;

    var filterDefs = [
      { d: 1, lbl: "Today" },
      { d: 7, lbl: "7 Days" },
      { d: 10, lbl: "10 Days" },
      { d: 30, lbl: "30 Days" },
      { d: 365, lbl: "1 Year" },
      { d: 0, lbl: "All-Time" }
    ];
    var filterBarHtml = filterDefs.map(function(f) {
      var act = (days === f.d);
      return "<button type=\x22button\x22 onclick=\x22window.selectAnalyticsDaysFilter(" + f.d + ")\x22 class=\x22px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer " + (act ? "bg-emerald-500 text-black shadow" : "bg-[#181e29] hover:bg-slate-800 text-slate-300 border border-slate-700") + "\x22>" + f.lbl + "</button>";
    }).join("");

    var regStats = db.regionStats || {};
    var regionRowsHtml = EIGHT_REGIONS_LIST.map(function(rName) {
      var ro = regStats[rName] || { views: 0, watchSeconds: 0 };
      var pct = stats.views > 0 ? Math.min(100, Math.round(((ro.views || 0) / stats.views) * 100)) : 0;
      return "<div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5 space-y-1\x22>" +
        "<div class=\x22flex items-center justify-between text-xs\x22><span class=\x22font-bold text-white\x22>🌍 " + rName + "</span><span class=\x22text-emerald-400 font-extrabold\x22>" + (ro.views || 0) + " views • " + formatHoursAndMins(ro.watchSeconds || 0) + "</span></div>" +
        "<div class=\x22w-full bg-slate-800 h-1.5 rounded-full overflow-hidden\x22><div class=\x22bg-emerald-500 h-full rounded-full\x22 style=\x22width:" + pct + "%\x22></div></div>" +
      "</div>";
    }).join("");

    var lStats = db.langStats || {};
    var langRowsHtml = Object.keys(TEN_LANG_LABELS).map(function(lCode) {
      var lo = lStats[lCode] || { views: 0, watchSeconds: 0 };
      var pct = stats.views > 0 ? Math.min(100, Math.round(((lo.views || 0) / stats.views) * 100)) : 0;
      return "<div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5 space-y-1\x22>" +
        "<div class=\x22flex items-center justify-between text-xs\x22><span class=\x22font-bold text-white\x22>" + TEN_LANG_LABELS[lCode] + "</span><span class=\x22text-amber-300 font-extrabold\x22>" + (lo.views || 0) + " views • " + formatHoursAndMins(lo.watchSeconds || 0) + "</span></div>" +
        "<div class=\x22w-full bg-slate-800 h-1.5 rounded-full overflow-hidden\x22><div class=\x22bg-amber-400 h-full rounded-full\x22 style=\x22width:" + pct + "%\x22></div></div>" +
      "</div>";
    }).join("");

    var uStats = db.userStats || {};
    var uKeys = Object.keys(uStats);
    var userRowsHtml = uKeys.length === 0 ? "<p class=\x22text-slate-400 text-xs py-2\x22>No individual user watch sessions recorded yet.</p>" : uKeys.map(function(uk) {
      var uo = uStats[uk] || {};
      return "<div class=\x22bg-black/60 border border-slate-800 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs\x22>" +
        "<div><p class=\x22font-extrabold text-white\x22>👤 " + (uo.email || uk) + "</p><p class=\x22text-[10px] text-slate-400\x22>🌍 " + (uo.region || "Global") + " • Last Active: " + (uo.lastActive || "Recent") + "</p></div>" +
        "<span class=\x22bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2.5 py-1 rounded-lg font-extrabold text-[11px]\x22>👁️ " + (uo.views || 0) + " views • ⏱️ " + formatHoursAndMins(uo.watchSeconds || 0) + "</span>" +
      "</div>";
    }).join("");

    pane.innerHTML =
      "<div class=\x22flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3\x22>" +
        "<div>" +
          "<h4 class=\x22text-sm sm:text-base font-extrabold text-white flex items-center gap-2\x22><span>📊</span> <span>QAAF Tube Live Analytics &amp; Audience Stats</span></h4>" +
          "<p class=\x22text-xs text-slate-400 mt-0.5\x22>5-Sensor Live Tracking • Separate Cloud DB (qaaf_analytics_db.json)</p>" +
        "</div>" +
        "<button type=\x22button\x22 onclick=\x22window.openSponsorReportCard()\x22 class=\x22bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black px-4 py-2 rounded-xl text-xs font-extrabold shadow-lg flex items-center gap-1.5 cursor-pointer\x22>" +
          "<span>📄</span> <span>Open Sponsor / Client Report Card</span>" +
        "</button>" +
      "</div>" +
      "<div class=\x22flex flex-wrap items-center gap-1.5\x22>" + filterBarHtml + "</div>" +
      "<div class=\x22grid grid-cols-2 sm:grid-cols-5 gap-2.5\x22>" +
        "<div class=\x22bg-[#141923] border border-emerald-500/40 rounded-2xl p-3\x22><span class=\x22text-[10px] text-slate-400 font-bold block\x22>👁️ Total Views</span><span class=\x22text-xl font-extrabold text-emerald-400 mt-1 block\x22>" + stats.views + "</span></div>" +
        "<div class=\x22bg-[#141923] border border-blue-500/40 rounded-2xl p-3\x22><span class=\x22text-[10px] text-slate-400 font-bold block\x22>⏱️ Watch Time</span><span class=\x22text-sm sm:text-base font-extrabold text-blue-300 mt-1 block\x22>" + formatHoursAndMins(stats.watchSeconds) + "</span></div>" +
        "<div class=\x22bg-[#141923] border border-amber-500/40 rounded-2xl p-3\x22><span class=\x22text-[10px] text-slate-400 font-bold block\x22>👨‍👩‍👧‍👦 Registered Families</span><span class=\x22text-xl font-extrabold text-amber-300 mt-1 block\x22>" + totalFamilies + "</span></div>" +
        "<div class=\x22bg-[#141923] border border-teal-500/40 rounded-2xl p-3\x22><span class=\x22text-[10px] text-slate-400 font-bold block\x22>🎮 Kids Game Plays</span><span class=\x22text-xl font-extrabold text-teal-300 mt-1 block\x22>" + stats.gamePlays + "</span></div>" +
        "<div class=\x22bg-[#141923] border border-purple-500/40 rounded-2xl p-3\x22><span class=\x22text-[10px] text-slate-400 font-bold block\x22>📢 Sponsor Clicks</span><span class=\x22text-xl font-extrabold text-purple-300 mt-1 block\x22>" + stats.sponsorClicks + "</span></div>" +
      "</div>" +
      "<div class=\x22grid grid-cols-1 md:grid-cols-2 gap-4\x22>" +
        "<div class=\x22bg-[#141821] border border-slate-800 rounded-2xl p-4 space-y-2\x22><h5 class=\x22text-xs sm:text-sm font-extrabold text-emerald-300 mb-2\x22>🌍 Views &amp; Watch Hours by Region (Geo-Timezone)</h5><div class=\x22space-y-2 max-h-72 overflow-y-auto pr-1\x22>" + regionRowsHtml + "</div></div>" +
        "<div class=\x22bg-[#141821] border border-slate-800 rounded-2xl p-4 space-y-2\x22><h5 class=\x22text-xs sm:text-sm font-extrabold text-amber-300 mb-2\x22>🗣️ Views &amp; Watch Hours by Language (10 Languages)</h5><div class=\x22space-y-2 max-h-72 overflow-y-auto pr-1\x22>" + langRowsHtml + "</div></div>" +
      "</div>" +
      "<div class=\x22bg-[#141821] border border-slate-800 rounded-2xl p-4 space-y-2\x22><h5 class=\x22text-xs sm:text-sm font-extrabold text-blue-300 mb-2\x22>👤 Per-User / Family Watch Time &amp; Activity</h5><div class=\x22space-y-2 max-h-60 overflow-y-auto pr-1\x22>" + userRowsHtml + "</div></div>";
  };

  window.openSponsorReportCard = function() {
    var stats = window.getFilteredAnalytics(window.activeAnalyticsDays || 0);
    var db = window.qaafAnalyticsData || getDefaultAnalyticsState();
    var totalFamilies = Object.keys(window.registeredUsersMap || {}).length;
    var m = document.getElementById("qaafSponsorReportCardModal");
    if (!m) {
      m = document.createElement("div");
      m.id = "qaafSponsorReportCardModal";
      document.body.appendChild(m);
    }
    m.className = "fixed inset-0 z-[340] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4";
    var regHtml = EIGHT_REGIONS_LIST.map(function(rName) {
      var ro = (db.regionStats && db.regionStats[rName]) || { views: 0, watchSeconds: 0 };
      return "<div class=\x22flex justify-between py-1.5 border-b border-slate-800 text-xs\x22><span>" + rName + "</span><span class=\x22font-extrabold text-emerald-400\x22>" + (ro.views || 0) + " views • " + formatHoursAndMins(ro.watchSeconds || 0) + "</span></div>";
    }).join("");
    var langHtml = Object.keys(TEN_LANG_LABELS).map(function(lk) {
      var lo = (db.langStats && db.langStats[lk]) || { views: 0, watchSeconds: 0 };
      return "<div class=\x22flex justify-between py-1.5 border-b border-slate-800 text-xs\x22><span>" + TEN_LANG_LABELS[lk] + "</span><span class=\x22font-extrabold text-amber-300\x22>" + (lo.views || 0) + " views • " + formatHoursAndMins(lo.watchSeconds || 0) + "</span></div>";
    }).join("");

    m.innerHTML =
      "<div class=\x22bg-[#0f141d] border-2 border-emerald-500/60 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-white max-h-[92vh] overflow-y-auto\x22>" +
        "<div class=\x22flex items-center justify-between border-b border-slate-800 pb-3\x22>" +
          "<div><span class=\x22text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider\x22>OFFICIAL MEDIA KIT &amp; SPONSORSHIP REPORT CARD</span><h3 class=\x22text-lg font-extrabold text-white\x22>QAAF Tube — Muslim Family &amp; Kids Hub</h3><p class=\x22text-[11px] text-slate-400\x22>https://qaaftube.com • Verified Audience Metrics • " + new Date().toLocaleDateString() + "</p></div>" +
          "<button type=\x22button\x22 onclick=\x22document.getElementById(\x27qaafSponsorReportCardModal\x27).classList.add(\x27hidden\x27)\x22 class=\x22bg-slate-800 hover:bg-rose-600 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer\x22>✕ Close</button>" +
        "</div>" +
        "<div class=\x22grid grid-cols-2 sm:grid-cols-5 gap-2 text-center\x22>" +
          "<div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5\x22><span class=\x22text-[10px] text-slate-400 block\x22>Total Views</span><span class=\x22text-base font-extrabold text-emerald-400\x22>" + stats.views + "</span></div>" +
          "<div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5\x22><span class=\x22text-[10px] text-slate-400 block\x22>Watch Time</span><span class=\x22text-xs font-extrabold text-blue-300\x22>" + formatHoursAndMins(stats.watchSeconds) + "</span></div>" +
          "<div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5\x22><span class=\x22text-[10px] text-slate-400 block\x22>Families</span><span class=\x22text-base font-extrabold text-amber-300\x22>" + totalFamilies + "</span></div>" +
          "<div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5\x22><span class=\x22text-[10px] text-slate-400 block\x22>Game Plays</span><span class=\x22text-base font-extrabold text-teal-300\x22>" + stats.gamePlays + "</span></div>" +
          "<div class=\x22bg-black/60 border border-slate-800 rounded-xl p-2.5\x22><span class=\x22text-[10px] text-slate-400 block\x22>Sponsor Leads</span><span class=\x22text-base font-extrabold text-purple-300\x22>" + stats.sponsorClicks + "</span></div>" +
        "</div>" +
        "<div class=\x22grid grid-cols-1 sm:grid-cols-2 gap-4\x22>" +
          "<div class=\x22bg-black/40 border border-slate-800 rounded-2xl p-3.5\x22><h5 class=\x22text-xs font-extrabold text-emerald-400 mb-2\x22>🌍 Audience by Region</h5>" + regHtml + "</div>" +
          "<div class=\x22bg-black/40 border border-slate-800 rounded-2xl p-3.5\x22><h5 class=\x22text-xs font-extrabold text-amber-300 mb-2\x22>🗣️ Audience by Language</h5>" + langHtml + "</div>" +
        "</div>" +
        "<div class=\x22flex items-center justify-between pt-2 border-t border-slate-800\x22>" +
          "<span class=\x22text-[11px] text-slate-400\x22>Official Sponsorship Contact: contactqaaftube@gmail.com</span>" +
          "<button type=\x22button\x22 onclick=\x22window.print()\x22 class=\x22bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow cursor-pointer\x22>🖨️ Print / Save PDF Report</button>" +
        "</div>" +
      "</div>";
    m.classList.remove("hidden");
  };
  window.openQaafSponsorReportCardModal = window.openSponsorReportCard;

  var prevOpenAdmV93 = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevOpenAdmV93) prevOpenAdmV93.apply(this, arguments);
    injectAdminAnalyticsTab();
    window.renderAdminChannelUpdatesBoxEng();
    window.renderAdminAnalyticsDashboard();
  };

  setInterval(function() {
    renderStableDrawerExtraItems(false);
    ensureActionRowSettingsPill();
    injectAdminAnalyticsTab();
    window.renderAdminChannelUpdatesBoxEng();
  }, 900);
})();


// === QAAF V94 FLAG Z-INDEX, ADMIN LABEL & GHOST REQUEST FIX ===
(function initQaafV94FlagZIndexAdminLabelAndRequestFix() {
  var FB_BASE = (localStorage.getItem("qaaf_firebase_db_url") || "https://qaaftube-6f251-default-rtdb.firebaseio.com").replace(/\/+$/, "");

  // =========================================================================
  // 1. FIX FLAG MODAL & PLAYLIST MODAL Z-INDEX SO THEY OPEN ABOVE VIDEO PLAYER
  // =========================================================================
  if (!document.getElementById("qaafV94ModalZIndexCss")) {
    var st = document.createElement("style");
    st.id = "qaafV94ModalZIndexCss";
    st.textContent = [
      "#flagVideoModal, #playlistSelectorModal, #sponsorContactModal, #accountModal { z-index: 1200 !important; }",
      "#adminDashboardModal, #userNotifModal { z-index: 1150 !important; }"
    ].join("\n");
    document.head.appendChild(st);
  }

  // Override submitVideoFlag to give clear toast feedback and close cleanly
  window.submitVideoFlag = function() {
    var v = (videosData || []).find(function(x) { return x && x.id === pendingFlagVideoId; });
    var reasonEl = document.getElementById("flagReasonSelect");
    var reason = reasonEl ? reasonEl.value : "Reported by User";
    if (v) {
      if (!Array.isArray(flaggedVideosQueue)) flaggedVideosQueue = [];
      var alreadyFlagged = flaggedVideosQueue.some(function(f) { return f && f.videoId === v.id; });
      if (!alreadyFlagged) {
        flaggedVideosQueue.unshift({ videoId: v.id, ytId: v.ytId || "", title: v.title, channel: v.channel, reason: reason });
        localStorage.setItem("qaaf_flagged_queue", JSON.stringify(flaggedVideosQueue));
      }
      if (window.qaafCloudSync) window.qaafCloudSync.pushState("User Video Flag Submitted");
    }
    closeFlagModal();
    if (typeof syncAccountUI === "function") syncAccountUI();
    if (typeof showSyncToast === "function") {
      showSyncToast("🚩 Report submitted to QAAF Admin!");
    } else {
      alert("🚩 Report submitted to QAAF Admin.");
    }
  };

  // =========================================================================
  // 2. REPLACE "SUPER ADMIN" WITH "ADMIN" EVERYWHERE IN UI
  // =========================================================================
  function replaceSuperAdminLabels() {
    var subEl = document.querySelector("#adminDashboardModal h3 + p");
    if (subEl && subEl.innerText.indexOf("Super Admin") !== -1) {
      subEl.innerText = subEl.innerText.replace(/Super Admin/g, "Admin");
    }
    var roleBadge = document.getElementById("activeAccountRoleBadge");
    if (roleBadge && roleBadge.innerText.indexOf("Super Admin") !== -1) {
      roleBadge.innerText = roleBadge.innerText.replace(/Super Admin/g, "Admin");
    }
    var drwName = document.getElementById("drawerProfileName");
    if (drwName && drwName.innerText.indexOf("Super Admin") !== -1) {
      drwName.innerText = drwName.innerText.replace(/Super Admin/g, "Admin");
    }
    var admSecLabel = document.querySelector("#admPane_security label");
    if (admSecLabel && admSecLabel.innerText.indexOf("Super Admin") !== -1) {
      admSecLabel.innerText = admSecLabel.innerText.replace(/Super Admin/g, "Admin");
    }
  }
  replaceSuperAdminLabels();

  // =========================================================================
  // 3. PERMANENTLY FIX GHOST / RETURNING PARENT REQUESTS AFTER APPROVAL
  // =========================================================================
  window.qaafHandledRequestIds = JSON.parse(localStorage.getItem("qaaf_handled_request_ids_v1") || "[]");

  function markRequestAsHandled(reqObj) {
    if (!reqObj) return;
    if (reqObj.reqId && window.qaafHandledRequestIds.indexOf(reqObj.reqId) === -1) {
      window.qaafHandledRequestIds.push(reqObj.reqId);
    }
    if (reqObj.ytId && window.qaafHandledRequestIds.indexOf(reqObj.ytId) === -1) {
      window.qaafHandledRequestIds.push(reqObj.ytId);
    }
    try { localStorage.setItem("qaaf_handled_request_ids_v1", JSON.stringify(window.qaafHandledRequestIds)); } catch (e) {}
  }

  window.scrubHandledParentRequestsNow = function() {
    var existingYtSet = new Set((videosData || []).map(function(v) { return v && v.ytId; }).filter(Boolean));
    var blockedSet = new Set(blockedVideoIds || []);
    var handledSet = new Set(window.qaafHandledRequestIds || []);

    var rawQ = window.parentRequestsQueue || parentRequestsQueue || [];
    if (!Array.isArray(rawQ)) rawQ = [];

    var cleanedQ = rawQ.filter(function(r) {
      if (!r) return false;
      if (r.reqId && handledSet.has(r.reqId)) return false;
      if (r.ytId && (handledSet.has(r.ytId) || existingYtSet.has(r.ytId) || blockedSet.has(r.ytId))) return false;
      return true;
    });

    if (cleanedQ.length !== rawQ.length) {
      parentRequestsQueue = cleanedQ;
      window.parentRequestsQueue = cleanedQ;
      try { localStorage.setItem("qaaf_parent_requests", JSON.stringify(cleanedQ)); } catch (e) {}
    } else {
      parentRequestsQueue = cleanedQ;
      window.parentRequestsQueue = cleanedQ;
    }
  };

  window.scrubHandledParentRequestsNow();

  // Override adminHandleParentRequest so approved/rejected requests NEVER return
  window.adminHandleParentRequest = function(index, decision) {
    window.scrubHandledParentRequestsNow();
    var q = window.parentRequestsQueue || parentRequestsQueue || [];
    var req = q[index];
    if (!req) return;
    markRequestAsHandled(req);

    if (decision === "approve") {
      if (!videosData.some(function(v) { return v && v.ytId === req.ytId; })) {
        videosData.unshift({
          id: "v_" + req.ytId,
          title: req.title,
          channel: req.channel,
          lang: req.lang || "global",
          region: (req.lang || "global").toUpperCase(),
          category: req.category || "kids_cartoon",
          kidsSafe: (req.category !== "bayan"),
          ytId: req.ytId,
          isCustomAdded: true,
          duration: "12:00",
          views: 0,
          createdAt: Math.floor(Date.now() / 1000)
        });
        localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
      }
    } else {
      if (req.ytId && blockedVideoIds.indexOf(req.ytId) === -1) {
        blockedVideoIds.push(req.ytId);
        localStorage.setItem("qaaf_blocked_videos", JSON.stringify(blockedVideoIds));
      }
    }

    q.splice(index, 1);
    parentRequestsQueue = q;
    window.parentRequestsQueue = q;
    localStorage.setItem("qaaf_parent_requests", JSON.stringify(q));

    fetch(FB_BASE + "/qaaf_global_state/parentRequestsQueue.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(q)
    }).catch(function() {});

    fetch(FB_BASE + "/qaaf_global_state/handledRequestIdsJson.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(JSON.stringify(window.qaafHandledRequestIds))
    }).catch(function() {});

    if (typeof window.renderAdminParentRequests === "function") window.renderAdminParentRequests();
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState(decision === "approve" ? "Approved Parent Video Request" : "Rejected Parent Video Request");
    if (typeof showSyncToast === "function") {
      showSyncToast(decision === "approve" ? "✅ Request Approved & Published Live!" : "🚫 Request Rejected & Removed.");
    }
  };

  var origBatchGreen = window.adminBatchApproveAllGreen;
  window.adminBatchApproveAllGreen = function() {
    (window.parentRequestsQueue || parentRequestsQueue || []).forEach(function(r) {
      var ev = window.evaluateRequestColorCategory ? window.evaluateRequestColorCategory(r) : { color: "GREEN" };
      if (ev.color === "GREEN") markRequestAsHandled(r);
    });
    if (origBatchGreen) origBatchGreen();
    window.scrubHandledParentRequestsNow();
    fetch(FB_BASE + "/qaaf_global_state/parentRequestsQueue.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(window.parentRequestsQueue || [])
    }).catch(function() {});
  };

  // Pull handledRequestIdsJson from Cloud and scrub any returning ghost requests
  fetch(FB_BASE + "/qaaf_global_state/handledRequestIdsJson.json?t=" + Date.now())
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(str) {
      if (typeof str === "string" && str.indexOf("[") === 0) {
        try {
          var arr = JSON.parse(str);
          if (Array.isArray(arr)) {
            arr.forEach(function(id) {
              if (id && window.qaafHandledRequestIds.indexOf(id) === -1) window.qaafHandledRequestIds.push(id);
            });
            localStorage.setItem("qaaf_handled_request_ids_v1", JSON.stringify(window.qaafHandledRequestIds));
          }
        } catch (e) {}
      }
      window.scrubHandledParentRequestsNow();
      if (typeof window.renderAdminParentRequests === "function") window.renderAdminParentRequests();
    }).catch(function() {});

  setInterval(function() {
    replaceSuperAdminLabels();
    window.scrubHandledParentRequestsNow();
  }, 1000);
})();
