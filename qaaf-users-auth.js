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

    if (!document.getElementById("qaafSmartCompactGridCss")) {
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

    // 2. QAAF Quranic Games (Auto-Discovered from Qaaf quran Games folder)
    {"id": "qg_01", "categoryGroup": "quranic", "title": "1. Ayat Al-Birr — آیت البر (البقرۃ 2:177)", "icon": "🕋", "launchUrl": "./Qaaf%20quran%20Games/game-01-ayat-al-birr.html"},
    {"id": "qg_02", "categoryGroup": "quranic", "title": "2. Sifat Al-Mu'minun — صفات المؤمنین (23:1-11)", "icon": "🌟", "launchUrl": "./Qaaf%20quran%20Games/game-02-sifat-al-muminun.html"},
    {"id": "qg_03", "categoryGroup": "quranic", "title": "3. Surah Al-Asr — سورۃ العصر (103:1-3)", "icon": "⏳", "launchUrl": "./Qaaf%20quran%20Games/game-03-surah-al-asr.html"},
    {"id": "qg_04", "categoryGroup": "quranic", "title": "4. QAAF Tube - قرآنی کھیل", "icon": "📖", "launchUrl": "./Qaaf%20quran%20Games/qaaf-Quran-games.html"}
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
    var sponsorPane = document.getElementById("admPane_sponsor");
    if (!sponsorPane || document.getElementById("admSpecialAnnouncementBox")) return;

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

