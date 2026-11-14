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
  // Hide #shortsSideNav arrows permanently via CSS
  var shStyle = document.createElement("style");
  shStyle.textContent = "#shortsSideNav { display: none !important; }";
  document.head.appendChild(shStyle);
  window.saveUserPersonalDataToCloud = function() {
    if (!currentUserEmail) return;
    var k = currentUserEmail.toLowerCase().trim();
    window.registeredUsersMap = window.registeredUsersMap || {};
    var uObj = window.registeredUsersMap[k]; if (!uObj) return;
    uObj.favorites = favoriteVideoIds || [];
    uObj.parentHistory = window.parentHistoryIds || [];
    uObj.kidsHistory = window.kidsHistoryIds || [];
    uObj.parentPlaylists = window.parentPlaylists || [];
    uObj.kidsPlaylists = window.kidsPlaylists || [];
    uObj.pin = parentPin || "123456";
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    if (typeof window.syncQaafUsersWithCloudNow === "function") window.syncQaafUsersWithCloudNow(false);
  };
  window.restoreUserPersonalDataFromCloud = function(emailStr) {
    if (!emailStr || !window.registeredUsersMap) return;
    var uObj = window.registeredUsersMap[emailStr.toLowerCase().trim()]; if (!uObj) return;
    if (Array.isArray(uObj.favorites) && uObj.favorites.length) { favoriteVideoIds = uObj.favorites; localStorage.setItem("qaaf_favorites", JSON.stringify(favoriteVideoIds)); }
    if (Array.isArray(uObj.parentHistory) && uObj.parentHistory.length) { window.parentHistoryIds = uObj.parentHistory; localStorage.setItem("qaaf_parent_history", JSON.stringify(window.parentHistoryIds)); }
    if (Array.isArray(uObj.kidsHistory) && uObj.kidsHistory.length) { window.kidsHistoryIds = uObj.kidsHistory; localStorage.setItem("qaaf_kids_history", JSON.stringify(window.kidsHistoryIds)); }
    if (Array.isArray(uObj.parentPlaylists) && uObj.parentPlaylists.length) { window.parentPlaylists = uObj.parentPlaylists; localStorage.setItem("qaaf_parent_multi_playlists", JSON.stringify(window.parentPlaylists)); }
    if (Array.isArray(uObj.kidsPlaylists) && uObj.kidsPlaylists.length) { window.kidsPlaylists = uObj.kidsPlaylists; localStorage.setItem("qaaf_kids_multi_playlists", JSON.stringify(window.kidsPlaylists)); }
    if (uObj.pin && String(uObj.pin).length === 6) { parentPin = String(uObj.pin); localStorage.setItem("qaaf_parent_pin_6", parentPin); }
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
  };
  var origOpenKids = window.openKidsLockOrTimer;
  window.openKidsLockOrTimer = function() {
    if (!isKidsLocked && !currentUserEmail) { openAccountModal("Please Sign In or Continue with Gmail to use Kids Mode & PIN!"); return; }
    if (origOpenKids) return origOpenKids.apply(this, arguments);
  };
  window.toggleKidsMode = function() { window.openKidsLockOrTimer(); };
  // Google Account Chooser (No PIN field, 1-Tap Login)
  window.completeGoogleQuickSignIn = function(directEmail) {
    var inp = document.getElementById("googleQuickEmailInput");
    var mainInp = document.getElementById("userEmailInput");
    var em = String(directEmail || (inp && inp.value) || (mainInp && mainInp.value) || "").trim().toLowerCase();
    if (!em || em.indexOf("@") === -1) { alert("Please enter your Gmail address."); return; }
    if (em === "qaaftube@gmail.com" || em === "adminqaaftube") { alert("Super Admin must sign in using Admin Password below."); return; }
    localStorage.setItem("qaaf_last_gmail_email", em);
    window.registeredUsersMap = window.registeredUsersMap || {};
    if (!window.registeredUsersMap[em]) {
      window.registeredUsersMap[em] = { name: em.split("@")[0], userKey: em, email: em, pass: "GoogleAuth_" + em.split("@")[0], recWord: "makkah", pin: parentPin || "123456", authProvider: "Google", isPro: false, createdAt: new Date().toLocaleDateString() };
    }
    parentPin = window.registeredUsersMap[em].pin || parentPin || "123456";
    localStorage.setItem("qaaf_parent_pin_6", parentPin);
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    localStorage.removeItem("qaaf_admin_verified_v3");
    currentUserEmail = em; localStorage.setItem("qaaf_user_email", currentUserEmail);
    window.restoreUserPersonalDataFromCloud(em); window.saveUserPersonalDataToCloud();
    syncAccountUI(); closeAccountModal();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Google Sign-In: " + em);
    if (typeof showSyncToast === "function") showSyncToast("🎉 Signed in with Google as " + em);
  };
  window.signInWithGoogleAccount = function() {
    var oldPin = document.getElementById("googleQuickPinInput"); if (oldPin) oldPin.remove();
    var gBox = document.getElementById("googleQuickAuthBox");
    if (!gBox) {
      gBox = document.createElement("div"); gBox.id = "googleQuickAuthBox";
      var btn = document.getElementById("googleSignInBtn"); if (btn && btn.parentNode) btn.parentNode.insertBefore(gBox, btn.nextSibling);
    }
    gBox.className = "bg-[#141822] border-2 border-blue-500/60 rounded-2xl p-3.5 mb-3 space-y-2.5 text-left shadow-2xl";
    var knownEmails = []; var lastGm = localStorage.getItem("qaaf_last_gmail_email"); if (lastGm) knownEmails.push(lastGm);
    Object.keys(window.registeredUsersMap || {}).forEach(function(k){ if (k.indexOf("@gmail.com") !== -1 && knownEmails.indexOf(k) === -1) knownEmails.push(k); });
    var accButtons = knownEmails.slice(0, 4).map(function(em) {
      var u = (window.registeredUsersMap && window.registeredUsersMap[em]) || {}; var nm = u.name || em.split("@")[0];
      return "<button type=button onclick=window.completeGoogleQuickSignIn('" + em + "') class='w-full bg-black/80 hover:bg-blue-950/70 border border-slate-700 hover:border-blue-400 rounded-xl p-2.5 flex items-center justify-between transition cursor-pointer'><div class='flex items-center gap-2.5 min-w-0'><div class='w-8 h-8 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0'>" + nm.charAt(0).toUpperCase() + "</div><div class='min-w-0 text-left'><div class='text-xs font-extrabold text-white truncate'>" + nm + "</div><div class='text-[10px] text-slate-400 truncate'>" + em + "</div></div></div><span class='text-[10px] bg-blue-600 text-white px-2.5 py-1 rounded-lg font-extrabold shrink-0'>Connect ➔</span></button>";
    }).join("");
    gBox.innerHTML = "<div class='text-xs font-extrabold text-white pb-1 border-b border-slate-800'>🔵 Select Google Account</div>" + (accButtons ? ("<div class='space-y-1.5'>" + accButtons + "</div>") : "") + "<div class='pt-1 flex gap-1.5'><input id='googleQuickEmailInput' type='email' placeholder='yourname@gmail.com' class='flex-1 bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white' /><button type=button onclick=window.completeGoogleQuickSignIn() class='bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer'>Continue</button></div>";
    gBox.classList.remove("hidden");
  };
  // SMART RELATED ALGORITHM FOR UP NEXT & SHORTS
  window.getSmartRelatedVideos = function(currentVidId, wantShortsOnly) {
    var cur = (videosData || []).find(function(v){ return v && v.id === currentVidId; });
    var histIds = (typeof getActiveHistory === "function") ? (getActiveHistory() || []) : [];
    var favSet = new Set(favoriteVideoIds || []);
    var blockedSet = new Set(blockedVideoIds || []);
    var bannedSet = new Set(bannedChannels || []);
    var chFreq = {}, catFreq = {};
    histIds.concat(favoriteVideoIds || []).forEach(function(id, idx) {
      var hv = (videosData || []).find(function(x){ return x && x.id === id; }); if (!hv) return;
      var w = idx < 10 ? 3 : 1;
      if (hv.channel) chFreq[hv.channel] = (chFreq[hv.channel] || 0) + w;
      if (hv.category) catFreq[hv.category] = (catFreq[hv.category] || 0) + w;
    });
    var curWords = cur && cur.title ? String(cur.title).toLowerCase().split(" ").filter(function(w){ return w.length >= 4 && w.indexOf("short") === -1; }) : [];
    var candidates = (videosData || []).filter(function(v) {
      if (!v || v.id === currentVidId) return false;
      if (blockedSet.has(v.id) || blockedSet.has(v.ytId) || bannedSet.has(v.channel)) return false;
      if (isKidsLocked && !v.kidsSafe) return false;
      var isSh = isVideoShort(v);
      return wantShortsOnly ? isSh : !isSh;
    });
    var scored = candidates.map(function(v) {
      var s = 0;
      if (cur) {
        if (v.channel === cur.channel) s += 130;
        if (v.category === cur.category) s += 110;
        else if ((cur.category === "kids_cartoon" || cur.category === "kids_tarbiyah" || cur.category === "stories") && (v.category === "kids_cartoon" || v.category === "kids_tarbiyah" || v.category === "stories")) s += 75;
        else s -= 50;
        if (v.lang === cur.lang) s += 65;
        var tLow = String(v.title || "").toLowerCase();
        curWords.forEach(function(cw){ if (tLow.indexOf(cw) !== -1) s += 35; });
      }
      if (chFreq[v.channel]) s += Math.min(60, chFreq[v.channel] * 12);
      if (catFreq[v.category]) s += Math.min(45, catFreq[v.category] * 8);
      if (favSet.has(v.id)) s += 25;
      return { video: v, score: s };
    });
    scored.sort(function(a, b){ return b.score - a.score; });
    var out = [], chCount = {};
    scored.forEach(function(item) { var ch = item.video.channel || "G"; chCount[ch] = (chCount[ch] || 0) + 1; if (chCount[ch] <= 4) out.push(item.video); });
    return out.length > 0 ? out : scored.map(function(x){ return x.video; });
  };
  var origExtras = window.renderWatchPageExtras;
  window.renderWatchPageExtras = function(videoId) {
    if (origExtras) origExtras(videoId);
    var upNextGrid = document.getElementById("watchUpNextGrid"); if (!upNextGrid) return;
    var smartList = window.getSmartRelatedVideos(videoId, false).slice(0, 14);
    upNextGrid.innerHTML = "";
    smartList.forEach(function(v) {
      var thumb = v.customThumb || ("https://i.ytimg.com/vi/" + v.ytId + "/hqdefault.jpg");
      var vStr = (typeof window.formatQaafRealViews === "function") ? window.formatQaafRealViews(v) : ((v.realViews || 0) + " views");
      var a = document.createElement("a");
      if (!isKidsLocked) a.href = "?watch=" + encodeURIComponent(v.id);
      a.onclick = function(e){ return handleQaafVideoLinkClick(e, v.id); };
      a.className = "bg-[#181818] hover:bg-[#222] rounded-xl overflow-hidden border border-white/10 flex sm:flex-col gap-2.5 p-2 sm:p-0 cursor-pointer transition group no-underline text-inherit";
      a.innerHTML = "<div class='relative w-36 sm:w-full aspect-video bg-slate-900 rounded-lg sm:rounded-none overflow-hidden shrink-0 pointer-events-none'><img src='" + thumb + "' alt='' class='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition' loading='lazy' /><span class='absolute bottom-1 right-1 bg-black/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded'>" + (v.duration || "12:00") + "</span></div><div class='p-1 sm:p-2.5 min-w-0 flex-1'><h5 class='text-xs font-bold text-white line-clamp-2 leading-snug'>" + v.title + "</h5><p class='text-[10px] text-slate-400 mt-1 truncate'>✅ " + v.channel + " • " + vStr + "</p></div>";
      upNextGrid.appendChild(a);
    });
  };
  // Full-Screen Shorts Mode (Hides #ytWatchScrollContainer when Short is open, shows full 94vh vertical video)
  function enforceFullScreenShortIfActive() {
    var modal = document.getElementById("playerModal"); if (!modal || modal.classList.contains("hidden")) return;
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var box = document.getElementById("playerModalBox");
    var aspect = document.getElementById("playerAspectBox");
    var miniBar = document.getElementById("qaafCleanMiniBar");
    if (miniBar && miniBar.style.display === "flex") return;
    var vid = (videosData || []).find(function(v){ return v && v.id === currentPlayingVideoId; });
    if (vid && isVideoShort(vid)) {
      if (box) box.style.cssText = "width:100%; max-width:420px; height:96dvh; max-height:96dvh; background:#000; display:flex; flex-direction:column; overflow:hidden; margin:auto; border-radius:16px; border:1px solid rgba(255,255,255,0.15);";
      if (aspect) aspect.style.cssText = "position:relative; width:100%; height:100%; max-height:96dvh; flex:1 1 auto; background:#000; overflow:hidden; display:block;";
      if (scrollWrap) scrollWrap.classList.add("hidden");
    }
  }
  setInterval(enforceFullScreenShortIfActive, 250);
  window.playAdjacentShort = function(dir) {
    var smartShorts = window.getSmartRelatedVideos(currentPlayingVideoId, true);
    if (smartShorts.length === 0) return;
    openVideoPlayer(smartShorts[0].id);
  };
  var shY0 = 0, shTouching = false, lastWh = 0;
  document.addEventListener("touchstart", function(e){ var m=document.getElementById("playerModal"); var v=(videosData||[]).find(function(x){return x&&x.id===currentPlayingVideoId;}); if(!m||m.classList.contains("hidden")||!v||!isVideoShort(v)||!e.touches||!e.touches.length)return; shY0=e.touches[0].clientY; shTouching=true; }, {passive:true});
  document.addEventListener("touchend", function(e){ if(!shTouching||!e.changedTouches||!e.changedTouches.length)return; shTouching=false; var dy=e.changedTouches[0].clientY-shY0; if(Math.abs(dy)>45) window.playAdjacentShort(dy<0?1:-1); }, {passive:true});
  window.addEventListener("wheel", function(e){ var m=document.getElementById("playerModal"); var v=(videosData||[]).find(function(x){return x&&x.id===currentPlayingVideoId;}); if(!m||m.classList.contains("hidden")||!v||!isVideoShort(v))return; if(Date.now()-lastWh<750)return; if(Math.abs(e.deltaY)>30){ lastWh=Date.now(); window.playAdjacentShort(e.deltaY>0?1:-1); } }, {passive:true});
  // 4. ANALYTICS WITH REAL WATCHED VIEWS SYNC
  function getTodayKey() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
  function sumAllRecordedRealViews() {
    var mapSum = 0; var rMap = window.qaafRealViewsMap || {};
    Object.keys(rMap).forEach(function(k){ mapSum += (parseInt(rMap[k], 10) || 0); });
    var histCount = ((window.parentHistoryIds && window.parentHistoryIds.length) || 0) + ((window.kidsHistoryIds && window.kidsHistoryIds.length) || 0);
    return Math.max(mapSum, histCount);
  }
  var defStats = { totalViews: 0, totalEngagementSecs: 0, sponsorImpressions: 1, sponsorClicks: 0, daily: {}, userStats: {} };
  window.qaafAnalytics = Object.assign({}, defStats, JSON.parse(localStorage.getItem("qaaf_analytics_v1") || "{}"));
  window.qaafStatsPeriodDays = 0;
  function ensureDay(k) { if (!window.qaafAnalytics.daily[k]) window.qaafAnalytics.daily[k] = { views: 0, secs: 0, visitors: 1, sponsorClicks: 0 }; return window.qaafAnalytics.daily[k]; }
  function syncExistingViewsIntoAnalytics() {
    var realTotal = sumAllRecordedRealViews();
    var tk = getTodayKey(); var dObj = ensureDay(tk);
    if (realTotal > (window.qaafAnalytics.totalViews || 0)) window.qaafAnalytics.totalViews = realTotal;
    if ((dObj.views || 0) === 0 && realTotal > 0) dObj.views = realTotal;
    var uKey = (currentUserEmail || "adminqaaftube").toLowerCase().trim();
    window.qaafAnalytics.userStats = window.qaafAnalytics.userStats || {};
    var us = window.qaafAnalytics.userStats[uKey] || { views: 0, secs: 0, lastActive: tk };
    if ((us.views || 0) === 0 && realTotal > 0) us.views = realTotal;
    window.qaafAnalytics.userStats[uKey] = us;
    try { localStorage.setItem("qaaf_analytics_v1", JSON.stringify(window.qaafAnalytics)); } catch(e){}
  }
  syncExistingViewsIntoAnalytics();
  window.pushAnalyticsToCloud = function() { syncExistingViewsIntoAnalytics(); fetch(FB_BASE + "/qaaf_analytics_db.json", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(window.qaafAnalytics) }).catch(function(){}); };
  window.pullAnalyticsFromCloud = function(cb) {
    syncExistingViewsIntoAnalytics();
    fetch(FB_BASE + "/qaaf_analytics_db.json?t=" + Date.now()).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
      if (d && typeof d === "object") {
        var loc = window.qaafAnalytics;
        loc.totalViews = Math.max(loc.totalViews||0, d.totalViews||0, sumAllRecordedRealViews());
        loc.totalEngagementSecs = Math.max(loc.totalEngagementSecs||0, d.totalEngagementSecs||0);
        loc.sponsorImpressions = Math.max(loc.sponsorImpressions||0, d.sponsorImpressions||0);
        loc.sponsorClicks = Math.max(loc.sponsorClicks||0, d.sponsorClicks||0);
        loc.userStats = Object.assign({}, d.userStats||{}, loc.userStats||{});
        loc.daily = Object.assign({}, d.daily||{}, loc.daily||{});
        syncExistingViewsIntoAnalytics();
      }
      if (cb) cb();
    }).catch(function(){ if (cb) cb(); });
  };
  var origIncView = window.incrementQaafRealView;
  window.incrementQaafRealView = function(videoObj) {
    if (origIncView) origIncView.apply(this, arguments);
    var k = getTodayKey(); var day = ensureDay(k); day.views = (day.views||0) + 1;
    window.qaafAnalytics.totalViews = Math.max((window.qaafAnalytics.totalViews||0) + 1, sumAllRecordedRealViews());
    var uKey = (currentUserEmail || "guest").toLowerCase().trim();
    var us = window.qaafAnalytics.userStats[uKey] || { views: 0, secs: 0, lastActive: k };
    us.views = (us.views||0) + 1; us.lastActive = k; window.qaafAnalytics.userStats[uKey] = us; window.pushAnalyticsToCloud();
  };
  setInterval(function() {
    if (document.hidden) return;
    var k = getTodayKey(); var day = ensureDay(k); day.secs = (day.secs||0) + 30;
    window.qaafAnalytics.totalEngagementSecs = (window.qaafAnalytics.totalEngagementSecs||0) + 30;
    var uKey = (currentUserEmail || "guest").toLowerCase().trim();
    var us = window.qaafAnalytics.userStats[uKey] || { views: 0, secs: 0, lastActive: k };
    us.secs = (us.secs||0) + 30; us.lastActive = k; window.qaafAnalytics.userStats[uKey] = us;
    try { localStorage.setItem("qaaf_analytics_v1", JSON.stringify(window.qaafAnalytics)); } catch(e){}
  }, 30000);
  function fmtHrsMins(secs) { var s = Math.max(0, parseInt(secs||0, 10)); var h = Math.floor(s / 3600); var m = Math.floor((s % 3600) / 60); return h > 0 ? (h + "h " + m + "m") : (m + " mins"); }
  function injectAnalyticsAdminTab() {
    var sb = document.getElementById("edgeAdminSidebar");
    var ra = document.querySelector("#adminDashboardModal .flex-1.overflow-y-auto");
    if (!sb || !ra || document.getElementById("admTabBtn_analytics")) return;
    var btn = document.createElement("button"); btn.type = "button"; btn.id = "admTabBtn_analytics";
    btn.onclick = function() { switchAdminTab("analytics"); };
    btn.className = "adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1.5 transition text-slate-300 hover:bg-white/5";
    btn.innerHTML = "<span>📊 Analytics &amp; Stats</span><span class='bg-emerald-500 text-black px-1.5 py-0.5 rounded-full text-[9px] font-extrabold'>LIVE</span>";
    sb.appendChild(btn);
    var pane = document.createElement("div"); pane.id = "admPane_analytics"; pane.className = "adm-tab-pane hidden space-y-4 text-xs";
    ra.appendChild(pane);
  }
  window.setQaafAnalyticsPeriod = function(days) { window.qaafStatsPeriodDays = days; window.renderQaafAnalyticsDashboard(); };
  window.computeFilteredAnalytics = function(days) {
    syncExistingViewsIntoAnalytics();
    var daily = window.qaafAnalytics.daily || {}; var keys = Object.keys(daily).sort().reverse();
    var cutDate = new Date(); if (days > 0) cutDate.setDate(cutDate.getDate() - (days - 1));
    var cutStr = days > 0 ? (cutDate.getFullYear() + "-" + String(cutDate.getMonth()+1).padStart(2,"0") + "-" + String(cutDate.getDate()).padStart(2,"0")) : "0000-00-00";
    var sumViews = 0, sumSecs = 0, sumVis = 0, rows = [];
    keys.forEach(function(k){ if (k >= cutStr) { var d = daily[k]; sumViews += (d.views||0); sumSecs += (d.secs||0); sumVis += (d.visitors||0); rows.push({ date: k, views: d.views||0, secs: d.secs||0, visitors: d.visitors||0 }); } });
    if (days === 0) { sumViews = Math.max(sumViews, window.qaafAnalytics.totalViews||0, sumAllRecordedRealViews()); sumSecs = Math.max(sumSecs, window.qaafAnalytics.totalEngagementSecs||0); }
    var lblMap = { 1: "Today (Daily)", 7: "7 Days (Weekly)", 10: "10 Days", 30: "30 Days (Monthly)", 365: "1 Year (Yearly)", 0: "All-Time Overall" };
    return { views: sumViews, secs: sumSecs, visitors: sumVis, rows: rows, label: lblMap[days] || "All-Time" };
  };
  window.renderQaafAnalyticsDashboard = function() {
    injectAnalyticsAdminTab();
    var pane = document.getElementById("admPane_analytics"); if (!pane) return;
    var p = window.qaafStatsPeriodDays || 0; var st = window.computeFilteredAnalytics(p);
    var totalUsers = Object.keys(window.registeredUsersMap || {}).length;
    var periods = [{d:1,t:"Today"},{d:7,t:"7 Days"},{d:10,t:"10 Days"},{d:30,t:"30 Days"},{d:365,t:"1 Year"},{d:0,t:"All-Time"}];
    var btnsHtml = periods.map(function(x){ return "<button type=button onclick=setQaafAnalyticsPeriod(" + x.d + ") class='px-3 py-1.5 rounded-xl text-[11px] font-extrabold cursor-pointer " + (p===x.d ? "bg-emerald-500 text-black" : "bg-slate-800 text-slate-300") + "'>" + x.t + "</button>"; }).join(" ");
    var dayRows = st.rows.slice(0, 15).map(function(r){ return "<tr class='border-b border-slate-800'><td class='py-1.5 font-mono text-emerald-300'>" + r.date + "</td><td class='py-1.5 font-bold text-white'>" + r.views + " views</td><td class='py-1.5 text-amber-300 font-bold'>" + fmtHrsMins(r.secs) + "</td><td class='py-1.5 text-blue-300'>" + r.visitors + "</td></tr>"; }).join("") || "<tr><td colspan=4 class='py-3 text-center text-slate-500'>Activity recorded starting today.</td></tr>";
    var uStats = window.qaafAnalytics.userStats || {};
    var uRows = Object.keys(uStats).map(function(uk){ var us = uStats[uk]; return "<div class='bg-black/60 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between'><div><span class='font-bold text-white'>" + uk + "</span><span class='text-[10px] text-slate-400 ml-2'>Last: " + (us.lastActive||"-") + "</span></div><div class='flex items-center gap-3'><span class='text-emerald-400 font-bold'>👁️ " + (us.views||0) + " views</span><span class='text-amber-300 font-extrabold'>⏱️ " + fmtHrsMins(us.secs||0) + "</span></div></div>"; }).join("") || "<p class='text-slate-500'>No individual user sessions yet.</p>";
    pane.innerHTML = "<div class='border-b border-slate-800 pb-3'><h4 class='text-sm sm:text-base font-extrabold text-white'>📊 Audience, Views &amp; Engagement Hours (" + st.label + ")</h4></div>" +
      "<div class='flex flex-wrap items-center gap-1.5'>" + btnsHtml + "</div>" +
      "<div class='grid grid-cols-2 sm:grid-cols-4 gap-3'>" +
        "<div class='bg-[#141821] border border-emerald-500/40 rounded-2xl p-3.5'><div class='text-[10px] text-slate-400'>Video Views</div><div class='text-xl font-extrabold text-emerald-400 mt-1'>👁️ " + st.views + "</div></div>" +
        "<div class='bg-[#141821] border border-amber-500/40 rounded-2xl p-3.5'><div class='text-[10px] text-slate-400'>Watch &amp; Engagement</div><div class='text-xl font-extrabold text-amber-300 mt-1'>⏱️ " + fmtHrsMins(st.secs) + "</div></div>" +
        "<div class='bg-[#141821] border border-blue-500/40 rounded-2xl p-3.5'><div class='text-[10px] text-slate-400'>Registered Users</div><div class='text-xl font-extrabold text-blue-300 mt-1'>👥 " + totalUsers + "</div></div>" +
        "<div class='bg-[#141821] border border-purple-500/40 rounded-2xl p-3.5'><div class='text-[10px] text-slate-400'>Sponsor Views / Clicks</div><div class='text-xl font-extrabold text-purple-300 mt-1'>📢 " + (window.qaafAnalytics.sponsorImpressions||0) + " / " + (window.qaafAnalytics.sponsorClicks||0) + "</div></div>" +
      "</div>" +
      "<div class='bg-[#141821] border border-slate-800 rounded-2xl p-4 space-y-2'><h5 class='font-extrabold text-emerald-300'>📅 Daily Breakdown (Views, Engagement Hours &amp; Visitors)</h5><table class='w-full text-left text-[11px]'><thead><tr class='border-b border-slate-700 text-slate-400'><th class='pb-1.5'>Date</th><th class='pb-1.5'>Views</th><th class='pb-1.5'>Engagement Time</th><th class='pb-1.5'>Visitors</th></tr></thead><tbody>" + dayRows + "</tbody></table></div>" +
      "<div class='bg-[#141821] border border-slate-800 rounded-2xl p-4 space-y-2'><h5 class='font-extrabold text-amber-300'>👤 Individual User Engagement &amp; Watch Time</h5><div class='space-y-1.5 max-h-60 overflow-y-auto'>" + uRows + "</div></div>";
  };
  var origSwitch = window.switchAdminTab;
  window.switchAdminTab = function(tabKey) { injectAnalyticsAdminTab(); if (origSwitch) origSwitch.apply(this, arguments); if (tabKey === "analytics") { window.pullAnalyticsFromCloud(function(){ window.renderQaafAnalyticsDashboard(); }); } };
  var origOpenA = window.openAdminModal;
  window.openAdminModal = function() { if (origOpenA) origOpenA.apply(this, arguments); injectAnalyticsAdminTab(); window.pullAnalyticsFromCloud(function(){ window.renderQaafAnalyticsDashboard(); }); };
  setTimeout(function(){ injectAnalyticsAdminTab(); window.pullAnalyticsFromCloud(); }, 800);
})();
