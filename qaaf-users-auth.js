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
    en: { backAll: "⬅️ All Channels", tabVideos: "🎬 Videos", tabShorts: "⚡ Shorts", tabPlaylists: "📂 Playlists", verifiedCh: "Verified Islamic Channel", singleVidCh: "Selected Videos Channel", videosCount: "videos", openPl: "View full playlist", backPl: "⬅️ Back to Playlists", noShorts: "No Shorts in this channel yet.", noPlaylists: "No official YouTube playlists found for this channel.", loadingPls: "⏳ Preparing channel playlists...", loadingPlVids: "⏳ Opening playlist videos...", refreshPls: "🔄 Update Playlists" },
    ur: { backAll: "⬅️ تمام چینلز", tabVideos: "🎬 ویڈیوز", tabShorts: "⚡ شارٹس", tabPlaylists: "📂 پلے لسٹس", verifiedCh: "تصدیق شدہ اسلامی چینل", singleVidCh: "منتخب ویڈیوز والا چینل", videosCount: "ویڈیوز", openPl: "پوری پلے لسٹ دیکھیں", backPl: "⬅️ تمام پلے لسٹس پر واپس", noShorts: "اس چینل میں ابھی کوئی شارٹس نہیں ہیں۔", noPlaylists: "اس چینل پر کوئی یوٹیوب پلے لسٹ نہیں ملی۔", loadingPls: "⏳ پلے لسٹس کھل رہی ہیں...", loadingPlVids: "⏳ پلے لسٹ کی ویڈیوز کھل رہی ہیں...", refreshPls: "🔄 پلے لسٹس اپ ڈیٹ کریں" },
    ar: { backAll: "⬅️ جميع القنوات", tabVideos: "🎬 الفيديوهات", tabShorts: "⚡ المقاطع القصيرة", tabPlaylists: "📂 قوائم التشغيل", verifiedCh: "قناة إسلامية موثقة", singleVidCh: "قناة فيديوهات مختارة", videosCount: "فيديو", openPl: "عرض قائمة التشغيل الكاملة", backPl: "⬅️ العودة لقوائم التشغيل", noShorts: "لا توجد مقاطع قصيرة في هذه القناة.", noPlaylists: "لا توجد قوائم تشغيل على يوتيوب لهذه القناة.", loadingPls: "⏳ جاري فتح قوائم التشغيل...", loadingPlVids: "⏳ جاري فتح فيديوهات القائمة...", refreshPls: "🔄 تحديث القوائم" }
  };

  function getChLabels() {
    var code = window.currentAppUILang || localStorage.getItem("qaaf_ui_display_lang") || "en";
    return CHANNEL_UI_LABELS[code] || CHANNEL_UI_LABELS.en;
  }

  // Multi-method Playlist Finder (Works via /playlists + Home Tab + YouTube Playlist Search!)
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
      baseChannel = "https://www.youtube.com/@" + channelName.replace(/\s+/g, "");
    }
    baseChannel = baseChannel.replace(/\/(videos|shorts|featured|streams|playlists)?\/?$/, "");

    var plMetaMap = new Map();
    function addPl(listId, title, thumb, countText) {
      if (!listId || !/^PL[a-zA-Z0-9_-]{10,}$/.test(listId)) return;
      var ex = plMetaMap.get(listId) || { listId: listId, title: "", thumb: "", countText: "" };
      if (title && title.length > 2 && !/^(view full playlist|play all|playlist|\d+\s*videos?)$/i.test(title.trim())) {
        if (!ex.title || title.length > ex.title.length) ex.title = title.trim();
      }
      if (thumb && !ex.thumb) ex.thumb = thumb;
      if (countText && !ex.countText) ex.countText = countText;
      plMetaMap.set(listId, ex);
    }

    function scanRawTextForPlaylists(rawText) {
      if (!rawText) return;
      var patterns = [
        /list=(PL[a-zA-Z0-9_-]{10,})/g,
        /"playlistId"\s*:\s*"(PL[a-zA-Z0-9_-]{10,})"/g,
        /"contentId"\s*:\s*"(PL[a-zA-Z0-9_-]{10,})"/g
      ];
      patterns.forEach(function(rgx) {
        var matches = rawText.matchAll(rgx);
        for (var m of matches) {
          addPl(m[1], "", "", "");
        }
      });
      var watchMatches = rawText.matchAll(/watch\?v=([a-zA-Z0-9_-]{11})(?:&|&amp;)list=(PL[a-zA-Z0-9_-]{10,})/g);
      for (var wm of watchMatches) {
        addPl(wm[2], "", "https://i.ytimg.com/vi/" + wm[1] + "/hqdefault.jpg", "");
      }
    }

    var urlsToTry = [];
    if (baseChannel) {
      urlsToTry.push(baseChannel + "/playlists");
      urlsToTry.push(baseChannel);
    }
    if (channelName) {
      urlsToTry.push("https://www.youtube.com/results?search_query=" + encodeURIComponent(channelName + " playlist") + "&sp=EgIQAw%253D%253D");
    }

    for (var uIdx = 0; uIdx < urlsToTry.length; uIdx++) {
      var uUrl = urlsToTry[uIdx];
      // 1. Plain Jina
      try {
        var r1 = await fetch("https://r.jina.ai/" + uUrl);
        if (r1.ok) scanRawTextForPlaylists(await r1.text());
      } catch (e) {}

      // 2. CodeTabs raw HTML
      if (plMetaMap.size < 3) {
        try {
          var sep = uUrl.indexOf("?") === -1 ? "?" : "&";
          var r2 = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(uUrl + sep + "ucbcb=1&hl=en"));
          if (r2.ok) scanRawTextForPlaylists(await r2.text());
        } catch (e) {}
      }

      // 3. AllOrigins raw HTML
      if (plMetaMap.size < 3) {
        try {
          var sep2 = uUrl.indexOf("?") === -1 ? "?" : "&";
          var r3 = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(uUrl + sep2 + "ucbcb=1&hl=en"));
          if (r3.ok) scanRawTextForPlaylists(await r3.text());
        } catch (e) {}
      }

      if (plMetaMap.size >= 5) break;
    }

    var candidates = Array.from(plMetaMap.values()).slice(0, 28);
    var resolved = [];
    var normTargetCh = String(channelName || "").trim().toLowerCase();

    await Promise.all(candidates.map(async function(item) {
      try {
        var r = await fetch("https://noembed.com/embed?url=https://www.youtube.com/playlist?list=" + item.listId);
        var d = await r.json();
        if (d && d.title) {
          item.title = d.title;
          item.authorName = (d.author_name || "").trim();
          if (d.thumbnail_url && !item.thumb) {
            var mV = d.thumbnail_url.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
            item.thumb = mV ? ("https://i.ytimg.com/vi/" + mV[1] + "/hqdefault.jpg") : d.thumbnail_url;
          }
          // If discovered via search, verify author matches channel if channelName is known
          if (!normTargetCh || !item.authorName || item.authorName.toLowerCase().indexOf(normTargetCh.split("|")[0].trim()) !== -1 || normTargetCh.indexOf(item.authorName.toLowerCase()) !== -1) {
            resolved.push(item);
          }
        }
      } catch (e) {}
    }));

    return resolved;
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

  function getInstantMatchedVideosForPlaylist(plTitle, channelName, listId) {
    var cached = window.qaafPlaylistVideosCache[listId];
    if (Array.isArray(cached) && cached.length > 0) {
      var byYtId = new Map();
      (videosData || []).forEach(function(v) { if (v && v.ytId) byYtId.set(v.ytId, v); });
      return cached.map(function(item) {
        if (typeof item === "string") return byYtId.get(item) || null;
        if (item && item.ytId && byYtId.has(item.ytId)) return byYtId.get(item.ytId);
        return item;
      }).filter(Boolean);
    }

    var chVids = (videosData || []).filter(function(v) { return v && v.channel === channelName; });
    var matched = chVids.filter(function(v) {
      return v.playlistId === listId || v.playlistName === plTitle;
    });
    return matched;
  }

  window.openQaafOfficialYouTubePlaylist = async function(listId, plTitle, channelName) {
    window.qaafChannelActiveSubTab = "playlists";
    window.qaafChannelSelectedPlaylistObj = { listId: listId, title: plTitle, channel: channelName };

    if (typeof window.renderVideosNow === "function") window.renderVideosNow();

    if (Array.isArray(window.qaafPlaylistVideosCache[listId]) && window.qaafPlaylistVideosCache[listId].length > 0) {
      return;
    }

    if (isFetchingSinglePlVids) return;
    isFetchingSinglePlVids = true;

    try {
      var foundIds = [];
      var plPageUrl = "https://www.youtube.com/playlist?list=" + listId;
      try {
        var r1 = await fetch("https://r.jina.ai/" + plPageUrl);
        if (r1.ok) {
          var t1 = await r1.text();
          var m1 = t1.matchAll(/(?:watch\?v=|\/shorts\/|"videoId":")([a-zA-Z0-9_-]{11})/g);
          for (var x of m1) { if (foundIds.indexOf(x[1]) === -1) foundIds.push(x[1]); }
        }
      } catch (e) {}

      if (foundIds.length < 3) {
        try {
          var r2 = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(plPageUrl + "&ucbcb=1&hl=en"));
          if (r2.ok) {
            var t2 = await r2.text();
            var m2 = t2.matchAll(/(?:watch\?v=|\/shorts\/|"videoId"\s*:\s*")([a-zA-Z0-9_-]{11})/g);
            for (var y of m2) { if (foundIds.indexOf(y[1]) === -1) foundIds.push(y[1]); }
          }
        } catch (e) {}
      }

      var targetIds = foundIds.slice(0, 120);
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

      if (resolvedVids.length > 0) {
        window.qaafPlaylistVideosCache[listId] = resolvedVids;
        if (typeof window.renderVideosNow === "function") window.renderVideosNow();
      }

      if (missingYtIds.length > 0) {
        var extraSlice = missingYtIds.slice(0, 40);
        var extraBatch = await Promise.all(extraSlice.map(async function(ytId) {
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

      if (resolvedVids.length > 0) {
        window.qaafPlaylistVideosCache[listId] = resolvedVids;
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
    var officialPlaylists = (window.qaafRealChannelPlaylistsMap[selCh] || []).filter(function(p) {
      return p && p.listId && !blockedPlSet.has(p.listId);
    });

    var isVer = (typeof window.isChannelFullyVerified === "function") && window.isChannelFullyVerified(selCh, chAllVids[0]);
    var activeTab = window.qaafChannelActiveSubTab || "videos";
    var isAdminMode = (typeof isSuperAdmin === "function" && isSuperAdmin()) && !isKidsLocked;

    chBanner.className = "mb-5 bg-gradient-to-r from-[#111622] via-[#151c2c] to-[#0f1722] border border-emerald-500/40 rounded-2xl p-4 shadow-xl";
    chBanner.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5 mb-3">' +
        '<div class="flex items-center gap-3 min-w-0">' +
          '<div class="w-12 h-12 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400/60 flex items-center justify-center text-xl font-extrabold text-emerald-300 shadow shrink-0">' +
            selCh.charAt(0).toUpperCase() +
          '</div>' +
          '<div class="min-w-0">' +
            '<h2 class="text-base sm:text-lg font-extrabold text-white flex items-center gap-1.5 truncate">' +
              '<span class="truncate">' + selCh + '</span>' +
              (isVer ? '<span class="bg-emerald-500 text-black text-[10px] px-1.5 py-0.5 rounded-full font-extrabold shrink-0">✓</span>' : '') +
            '</h2>' +
            '<p class="text-[11px] text-emerald-400 font-semibold">' +
              (isVer ? ('🟢 ' + lbl.verifiedCh) : ('🟡 ' + lbl.singleVidCh)) +
              ' • ' + chAllVids.length + ' ' + lbl.videosCount +
            '</p>' +
          '</div>' +
        '</div>' +
        '<button type="button" onclick="window.exitQaafChannelView()" class="bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white px-3.5 py-2 rounded-xl text-xs font-extrabold border border-slate-700 transition cursor-pointer shrink-0">' +
          lbl.backAll +
        '</button>' +
      '</div>' +
      '<div class="flex items-center justify-between gap-2 flex-wrap">' +
        '<div class="flex items-center gap-2 overflow-x-auto">' +
          '<button type="button" onclick="window.switchQaafChannelSubTab(\'videos\')" class="px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shrink-0 ' +
            (activeTab === "videos" ? "bg-emerald-500 text-black shadow-lg" : "bg-black/60 hover:bg-slate-800 text-slate-300 border border-slate-800") + '">' +
            '<span>' + lbl.tabVideos + '</span>' +
            '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-black/25">' + chRegVids.length + '</span>' +
          '</button>' +
          (chShortVids.length > 0 ? (
            '<button type="button" onclick="window.switchQaafChannelSubTab(\'shorts\')" class="px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shrink-0 ' +
              (activeTab === "shorts" ? "bg-emerald-500 text-black shadow-lg" : "bg-black/60 hover:bg-slate-800 text-slate-300 border border-slate-800") + '">' +
              '<span>' + lbl.tabShorts + '</span>' +
              '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-black/25">' + chShortVids.length + '</span>' +
            '</button>'
          ) : '') +
          '<button type="button" onclick="window.switchQaafChannelSubTab(\'playlists\')" class="px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shrink-0 ' +
            (activeTab === "playlists" ? "bg-emerald-500 text-black shadow-lg" : "bg-black/60 hover:bg-slate-800 text-slate-300 border border-slate-800") + '">' +
            '<span>' + lbl.tabPlaylists + '</span>' +
            (officialPlaylists.length > 0 ? ('<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-black/25">' + officialPlaylists.length + '</span>') : '') +
          '</button>' +
        '</div>' +
        ((activeTab === "playlists" && isAdminMode) ? (
          '<button type="button" id="refreshOfficialPlsBtn" class="bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-700 cursor-pointer shrink-0">' +
            lbl.refreshPls +
          '</button>'
        ) : '') +
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
        topPlBar.className = "col-span-full bg-[#131824] border border-emerald-500/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 mb-2";
        topPlBar.innerHTML =
          '<div class="flex items-center gap-2 min-w-0">' +
            '<span class="text-lg">📂</span>' +
            '<h4 class="text-xs sm:text-sm font-extrabold text-emerald-300 truncate">' + activePl.title + (instantPlVids.length > 0 ? (' (' + instantPlVids.length + ' ' + lbl.videosCount + ')') : '') + '</h4>' +
          '</div>' +
          '<button type="button" onclick="window.switchQaafChannelSubTab(\'playlists\')" class="bg-slate-800 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-extrabold shrink-0 cursor-pointer">' +
            lbl.backPl +
          '</button>';
        grid.appendChild(topPlBar);

        if (instantPlVids.length > 0) {
          instantPlVids.forEach(function(vid) {
            grid.appendChild(createQaafVideoCardElement(vid));
          });
        } else if (isFetchingSinglePlVids) {
          var loadDiv = document.createElement("div");
          loadDiv.className = "col-span-full py-12 text-center text-emerald-400 text-xs font-extrabold animate-pulse";
          loadDiv.innerText = lbl.loadingPlVids;
          grid.appendChild(loadDiv);
        }
        return;
      }

      if (officialPlaylists.length === 0 && !isFetchingChannelPls[selCh]) {
        window.fetchOfficialYouTubePlaylistsForChannel(selCh, false);
      }

      if (isFetchingChannelPls[selCh] && officialPlaylists.length === 0) {
        grid.innerHTML = '<div class="col-span-full bg-[#131824] border border-slate-800 rounded-2xl py-12 px-4 text-center text-emerald-400 text-xs sm:text-sm font-extrabold animate-pulse">' + lbl.loadingPls + '</div>';
        return;
      }

      if (officialPlaylists.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400 text-xs font-bold">' + lbl.noPlaylists + '</div>';
        return;
      }

      officialPlaylists.forEach(function(pl) {
        var card = document.createElement("div");
        card.className = "bg-[#121620] hover:bg-[#19202e] border border-white/10 hover:border-emerald-500/60 rounded-2xl overflow-hidden shadow-lg transition cursor-pointer group flex flex-col justify-between relative";
        card.onclick = function() {
          window.openQaafOfficialYouTubePlaylist(pl.listId, pl.title, selCh);
        };

        var thumbImg = pl.thumb || ((chAllVids[0] && ("https://i.ytimg.com/vi/" + chAllVids[0].ytId + "/hqdefault.jpg")) || "");
        var countBadgeText = pl.countText ? (pl.countText + " " + lbl.videosCount) : "Playlist";

        card.innerHTML =
          '<div class="relative aspect-video bg-slate-900 overflow-hidden">' +
            '<img src="' + thumbImg + '" alt="" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />' +
            '<span class="absolute bottom-2 right-2 bg-black/90 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow border border-white/15">' +
              '<span>☰</span> <span>' + countBadgeText + '</span>' +
            '</span>' +
          '</div>' +
          '<div class="p-3.5 flex flex-col justify-between flex-1">' +
            '<div>' +
              '<h4 class="text-xs sm:text-sm font-extrabold text-white line-clamp-2 leading-snug group-hover:text-emerald-400 transition">' + pl.title + '</h4>' +
              '<p class="text-[11px] text-slate-400 mt-1">Playlist • ' + selCh + '</p>' +
            '</div>' +
            '<div class="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">' +
              '<span class="text-[11px] font-extrabold text-emerald-400 group-hover:underline">' + lbl.openPl + ' ➔</span>' +
            '</div>' +
          '</div>';

        if (isAdminMode) {
          var delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center text-xs shadow border border-white/20";
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
    if (pls.length > 0 && pls[0].authorName && !chName) {
      chName = pls[0].authorName;
      if (chInp) chInp.value = chName;
    }
    if (chName && pls.length > 0) {
      window.qaafRealChannelPlaylistsMap[chName] = pls;
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
    var uncheckedIds = [];
    document.querySelectorAll(".adm-pl-picker-chk").forEach(function(cb) {
      if (cb.checked) checkedIds.push(cb.value);
      else uncheckedIds.push(cb.value);
    });

    if (checkedIds.length === 0) {
      alert("⚠️ Please select at least one playlist.");
      return;
    }

    var selectedPls = allPls.filter(function(p) { return checkedIds.indexOf(p.listId) !== -1; });
    var chName = (document.getElementById("adminChannelName") ? document.getElementById("adminChannelName").value : "").trim() || window.qaafAdminDetectedChannelTitle || "Islamic Channel";

    uncheckedIds.forEach(function(id) {
      if (window.qaafBlockedPlaylistIds.indexOf(id) === -1) window.qaafBlockedPlaylistIds.push(id);
    });

    window.qaafRealChannelPlaylistsMap[chName] = selectedPls;
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
      showSyncToast("⏳ Importing videos from " + selectedPls.length + " selected playlist(s)...");
    }

    var totalImportedCount = 0;
    for (var pIdx = 0; pIdx < selectedPls.length; pIdx++) {
      var plObj = selectedPls[pIdx];
      var foundVidIds = [];
      try {
        var rPl = await fetch("https://r.jina.ai/https://www.youtube.com/playlist?list=" + plObj.listId);
        if (rPl.ok) {
          var tPl = await rPl.text();
          var mVids = tPl.matchAll(/(?:watch\?v=|\/shorts\/|"videoId":")([a-zA-Z0-9_-]{11})/g);
          for (var mv of mVids) {
            if (foundVidIds.indexOf(mv[1]) === -1) foundVidIds.push(mv[1]);
          }
        }
      } catch (e) {}

      var capIds = foundVidIds.slice(0, 80);
      var plResolvedVids = [];
      var CHUNK = 15;
      for (var c = 0; c < capIds.length; c += CHUNK) {
        var slice = capIds.slice(c, c + CHUNK);
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
            if (!videosData.some(function(x) { return x.ytId === vItem.ytId; })) {
              videosData.unshift(vItem);
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

    var boxEl = document.getElementById("adminPlaylistSelectorBox");
    if (boxEl) boxEl.classList.add("hidden");

    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    if (typeof window.renderAdminActiveVideosCatalog === "function") window.renderAdminActiveVideosCatalog();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Imported Selected Playlists: " + chName);
    if (typeof showSyncToast === "function") {
      showSyncToast("🎉 Imported " + totalImportedCount + " videos from " + selectedPls.length + " playlist(s)!");
    }
  };

  // Hook into Auto-Fetch so after Auto-Fetch completes on a channel, it also automatically discovers the channel's playlists!
  var baseAutoFetch = window.adminAutoFetchYouTubeInfo;
  window.adminAutoFetchYouTubeInfo = async function() {
    ensureAdminPlaylistSelectorUI();
    if (baseAutoFetch) {
      await baseAutoFetch();
    }
    var urlInp = document.getElementById("adminYtUrlInput");
    var raw = (urlInp ? urlInp.value : "").trim();
    if (raw && (raw.indexOf("/@") !== -1 || raw.indexOf("@") === 0 || raw.indexOf("/channel/") !== -1)) {
      setTimeout(function() {
        window.adminFetchChannelPlaylistsForPicker();
      }, 400);
    }
  };

  // Override adminAddGlobalVideo so Main Super Admin is never blocked by bannedChannels and playlists are saved
  var origAdminAddGlobalVideo = window.adminAddGlobalVideo;
  window.adminAddGlobalVideo = function() {
    var chInp = document.getElementById("adminChannelName");
    var chName = (chInp ? chInp.value : "").trim() || (window.adminPendingBatchChannel ? window.adminPendingBatchChannel.channelTitle : "") || "";

    var tempSavedBans = null;
    if (window.isStrictlyMainSuperAdmin() && Array.isArray(bannedChannels)) {
      window.superAdminCleanChannelBanRecord(chName, []);
      tempSavedBans = bannedChannels.filter(Boolean);
      bannedChannels.length = 0;
    }

    if (origAdminAddGlobalVideo) {
      origAdminAddGlobalVideo();
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
    // 1. QAAF Games (4 Direct Games inside qaaf-games.html)
    {
      id: "g1",
      categoryGroup: "qaaf_games",
      title: "Word Search Puzzle",
      icon: "🔍",
      launchUrl: "./qaaf-games.html?game=wordsearch"
    },
    {
      id: "g2",
      categoryGroup: "qaaf_games",
      title: "Quran & Sunnah Quiz",
      icon: "📖",
      launchUrl: "./qaaf-games.html?game=quiz"
    },
    {
      id: "g3",
      categoryGroup: "qaaf_games",
      title: "Arabic Alphabet Puzzle",
      icon: "🔤",
      launchUrl: "./qaaf-games.html?game=alphabet"
    },
    {
      id: "g4",
      categoryGroup: "qaaf_games",
      title: "Masjid & Wudu Builder",
      icon: "🕌",
      launchUrl: "./qaaf-games.html?game=masjid"
    },

    // 2. QAAF Quranic Games (3 Direct Ayah Games)
    {
      id: "qg_01",
      categoryGroup: "quranic",
      title: "1. Ayat Al-Birr — آیت البر (البقرۃ 2:177)",
      icon: "🕋",
      launchUrl: "./Qaaf%20quran%20Games/game-01-ayat-al-birr.html"
    },
    {
      id: "qg_02",
      categoryGroup: "quranic",
      title: "2. Sifat Al-Mu'minun — صفات المؤمنین (23:1-11)",
      icon: "🌟",
      launchUrl: "./Qaaf%20quran%20Games/game-02-sifat-al-muminun.html"
    },
    {
      id: "qg_03",
      categoryGroup: "quranic",
      title: "3. Surah Al-Asr — سورۃ العصر (103:1-3)",
      icon: "⏳",
      launchUrl: "./Qaaf%20quran%20Games/game-03-surah-al-asr.html"
    }
  ];

  if (typeof gamesCatalog !== "undefined" && Array.isArray(gamesCatalog)) {
    gamesCatalog.length = 0;
    REAL_GAMES_CATALOG.forEach(function(g) { gamesCatalog.push(g); });
  }
  window.gamesCatalog = REAL_GAMES_CATALOG;

  if (typeof installedGameIds === "undefined" || !Array.isArray(installedGameIds)) {
    window.installedGameIds = JSON.parse(localStorage.getItem("qaaf_installed_games") || '["g1","g2","g4","qg_01","qg_02","qg_03"]');
  }

  function updateHeaderTabsAndTopBarsForMode(tab) {
    var vSec = document.getElementById("videosSection");
    var gSec = document.getElementById("gamesSection");
    var catBar = document.getElementById("categoryBar");

    if (tab === "games") {
      document.body.classList.add("qaaf-games-mode-active");
      if (vSec) vSec.classList.add("hidden");
      if (gSec) gSec.classList.remove("hidden");
      if (catBar) catBar.style.setProperty("display", "none", "important");
    } else {
      document.body.classList.remove("qaaf-games-mode-active");
      if (gSec) gSec.classList.add("hidden");
      if (vSec) vSec.classList.remove("hidden");
      if (catBar) catBar.style.removeProperty("display");
    }
  }

  setInterval(function() {
    var gSec = document.getElementById("gamesSection");
    var isGamesOpen = gSec && !gSec.classList.contains("hidden");
    var catBar = document.getElementById("categoryBar");
    if (isGamesOpen) {
      if (!document.body.classList.contains("qaaf-games-mode-active")) {
        document.body.classList.add("qaaf-games-mode-active");
      }
      if (catBar) catBar.style.setProperty("display", "none", "important");
    } else {
      if (document.body.classList.contains("qaaf-games-mode-active")) {
        document.body.classList.remove("qaaf-games-mode-active");
        if (catBar) catBar.style.removeProperty("display");
      }
    }
  }, 200);

  window.switchKidsTab = function(tab) {
    currentActiveKidsTab = tab || "videos";
    window.currentActiveKidsTab = currentActiveKidsTab;
    updateHeaderTabsAndTopBarsForMode(currentActiveKidsTab);
    if (currentActiveKidsTab === "games") {
      window.renderGames();
    } else if (typeof window.renderVideosNow === "function") {
      window.renderVideosNow();
    }
  };

  window.selectGamesSubTab = function(gTab) {
    window.activeGamesSubTab = gTab || "qaaf_games";
    window.renderGames();
  };

  window.installQaafGameInstant = function(gameId, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (!Array.isArray(installedGameIds)) window.installedGameIds = [];
    if (installedGameIds.indexOf(gameId) === -1) {
      installedGameIds.push(gameId);
      localStorage.setItem("qaaf_installed_games", JSON.stringify(installedGameIds));
    }
    window.renderGames();
  };

  window.renderGames = function() {
    var gSec = document.getElementById("gamesSection");
    if (gSec && !gSec.classList.contains("hidden")) {
      updateHeaderTabsAndTopBarsForMode("games");
    }

    if (gSec) {
      Array.prototype.slice.call(gSec.children).forEach(function(child) {
        if (child.id !== "gamesGrid" && child.id !== "qaafSimpleGamesHeading" && child.id !== "kidsTotalStarsBadge") {
          child.remove();
        }
      });
      var h2 = document.getElementById("qaafSimpleGamesHeading");
      if (!h2) {
        h2 = document.createElement("h2");
        h2.id = "qaafSimpleGamesHeading";
        gSec.insertBefore(h2, gSec.firstChild);
      }
      h2.className = "text-lg sm:text-xl font-extrabold text-white px-1 pb-1 flex items-center gap-2 tracking-wide";
      h2.innerHTML = "<span>🎮</span> <span>QAAF Kids Islamic Games Zone</span>";
    }

    var grid = document.getElementById("gamesGrid");
    if (!grid) return;
    grid.className = "grid grid-cols-1 sm:grid-cols-2 gap-1.5";

    var curTab = window.activeGamesSubTab || "qaaf_games";
    var countQaaf = REAL_GAMES_CATALOG.filter(function(g) { return g.categoryGroup === "qaaf_games"; }).length;
    var countQuran = REAL_GAMES_CATALOG.filter(function(g) { return g.categoryGroup === "quranic"; }).length;
    var count3D = REAL_GAMES_CATALOG.filter(function(g) { return g.categoryGroup === "3d_games"; }).length;

    var navHtml =
      '<div class="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-1.5 mb-1.5">' +
        '<button type="button" onclick="selectGamesSubTab(\'qaaf_games\')" class="py-2 px-3 rounded-xl border-2 text-left transition flex items-center justify-between cursor-pointer ' +
          (curTab === "qaaf_games" ? "bg-emerald-600/25 border-emerald-400 text-white shadow-md" : "bg-[#111620] border-slate-800/90 text-slate-300 hover:border-emerald-500/40") + '">' +
          '<div class="flex items-center gap-2.5 min-w-0">' +
            '<span class="text-xl shrink-0">🎮</span>' +
            '<div class="truncate">' +
              '<div class="text-base sm:text-lg font-extrabold leading-tight truncate text-white">1. QAAF Games</div>' +
              '<div class="text-[10px] text-slate-400 truncate">Simple Puzzles, Quiz &amp; Builder</div>' +
            '</div>' +
          '</div>' +
          '<span class="bg-emerald-950/90 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-emerald-300 shrink-0">' + countQaaf + ' Games</span>' +
        '</button>' +

        '<button type="button" onclick="selectGamesSubTab(\'quranic\')" class="py-2 px-3 rounded-xl border-2 text-left transition flex items-center justify-between cursor-pointer ' +
          (curTab === "quranic" ? "bg-teal-600/25 border-teal-400 text-white shadow-md" : "bg-[#111620] border-slate-800/90 text-slate-300 hover:border-teal-500/40") + '">' +
          '<div class="flex items-center gap-2.5 min-w-0">' +
            '<span class="text-xl shrink-0">📖</span>' +
            '<div class="truncate">' +
              '<div class="text-base sm:text-lg font-extrabold leading-tight truncate text-white">2. QAAF Quranic Games</div>' +
              '<div class="text-[10px] text-slate-400 truncate">Ayah-by-Ayah Interactive Games</div>' +
            '</div>' +
          '</div>' +
          '<span class="bg-teal-950/90 border border-teal-500/40 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-teal-300 shrink-0">' + countQuran + ' Games</span>' +
        '</button>' +

        '<button type="button" onclick="selectGamesSubTab(\'3d_games\')" class="py-2 px-3 rounded-xl border-2 text-left transition flex items-center justify-between cursor-pointer ' +
          (curTab === "3d_games" ? "bg-cyan-600/25 border-cyan-400 text-white shadow-md" : "bg-[#111620] border-slate-800/90 text-slate-300 hover:border-cyan-500/40") + '">' +
          '<div class="flex items-center gap-2.5 min-w-0">' +
            '<span class="text-xl shrink-0">🏎️</span>' +
            '<div class="truncate">' +
              '<div class="text-base sm:text-lg font-extrabold leading-tight truncate text-white">3. QAAF 3D Games</div>' +
              '<div class="text-[10px] text-slate-400 truncate">3D Adventures for Older Kids</div>' +
            '</div>' +
          '</div>' +
          (count3D > 0 ? ('<span class="bg-cyan-950/90 border border-cyan-500/40 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-cyan-300 shrink-0">' + count3D + ' Games</span>') : '<span class="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-400 shrink-0">Soon</span>') +
        '</button>' +
      '</div>';

    var filteredGames = REAL_GAMES_CATALOG.filter(function(g) { return g.categoryGroup === curTab; });

    var cardsHtml = "";
    filteredGames.forEach(function(g) {
      var isInstalled = Array.isArray(installedGameIds) && installedGameIds.indexOf(g.id) !== -1;
      var activeBorder = (curTab === "quranic") ? "border-teal-500/40 hover:border-teal-400" : "border-emerald-500/40 hover:border-emerald-400";

      cardsHtml +=
        '<div onclick="' + (isInstalled ? ("openInstalledGameModal('" + g.id + "')") : ("installQaafGameInstant('" + g.id + "', event)")) + '" class="bg-[#111722] hover:bg-[#162030] border ' + (isInstalled ? activeBorder : 'border-slate-800') + ' rounded-xl px-3 py-1.5 transition cursor-pointer group flex flex-col justify-center">' +
          '<div class="flex items-center justify-between gap-2.5">' +
            '<div class="flex items-center gap-2.5 min-w-0 flex-1">' +
              '<div class="w-8 h-8 rounded-lg bg-slate-800/90 border border-white/10 flex items-center justify-center text-base shrink-0 shadow group-hover:scale-105 transition">' +
                g.icon +
              '</div>' +
              '<h3 class="text-xs sm:text-sm font-bold text-slate-100 truncate group-hover:text-emerald-300 transition">' +
                g.title +
              '</h3>' +
            '</div>' +
            (isInstalled ? (
              '<span class="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-black flex items-center justify-center text-[10px] font-extrabold shrink-0 transition">▶</span>'
            ) : (
              '<button type="button" onclick="installQaafGameInstant(\'' + g.id + '\', event)" class="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-extrabold shadow shrink-0 transition cursor-pointer">' +
                '⬇️ Install' +
              '</button>'
            )) +
          '</div>' +
        '</div>';
    });

    grid.innerHTML = navHtml + cardsHtml;
  };

  window.openInstalledGameModal = function(gameId) {
    var game = REAL_GAMES_CATALOG.find(function(g) { return g.id === gameId; });
    if (!game) return;

    var activeLang = window.preferredContentLang || localStorage.getItem("qaaf_preferred_content_lang") || "ur";
    var gLang = (activeLang === "ar" || activeLang === "en") ? activeLang : "ur";
    var sep = game.launchUrl.indexOf("?") === -1 ? "?" : "&";
    var targetSrc = game.launchUrl + sep + "lang=" + encodeURIComponent(gLang) + "&v=" + Date.now();

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
