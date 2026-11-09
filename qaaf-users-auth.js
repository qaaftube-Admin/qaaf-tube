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

// === QAAF V16 SMART YOUTUBE FEED & CHANNEL TABS START ===
(function initQaafSmartYouTubeFeedAndChannelTabs() {
  var FIREBASE_DEFAULT_URL = "https://qaaftube-6f251-default-rtdb.firebaseio.com";
  function getFbBase() {
    return (localStorage.getItem("qaaf_firebase_db_url") || FIREBASE_DEFAULT_URL).replace(/\/+$/, "");
  }

  window.qaafChannelActiveSubTab = "videos"; // 'videos' | 'shorts' | 'playlists'
  window.qaafChannelSelectedPlaylistObj = null;
  window.qaafRealChannelPlaylistsMap = JSON.parse(localStorage.getItem("qaaf_real_channel_playlists_v1") || "{}");
  window.qaafBlockedPlaylistIds = JSON.parse(localStorage.getItem("qaaf_blocked_playlist_ids") || "[]");
  window.qaafPlaylistVideosCache = JSON.parse(localStorage.getItem("qaaf_playlist_videos_cache_v1") || "{}");
  var isFetchingChannelPls = {};
  var isFetchingSinglePlVids = false;

  // 1. PERMANENT DATABASE SYNC FOR CHANNEL PLAYLISTS & PLAYLIST VIDEO LISTS
  function savePlaylistsToLocalAndCloudDb() {
    try {
      localStorage.setItem("qaaf_real_channel_playlists_v1", JSON.stringify(window.qaafRealChannelPlaylistsMap));
      localStorage.setItem("qaaf_blocked_playlist_ids", JSON.stringify(window.qaafBlockedPlaylistIds));
      localStorage.setItem("qaaf_playlist_videos_cache_v1", JSON.stringify(window.qaafPlaylistVideosCache));
    } catch (e) {}

    var base = getFbBase();
    var plJsonStr = JSON.stringify(window.qaafRealChannelPlaylistsMap || {});
    var cacheJsonStr = JSON.stringify(window.qaafPlaylistVideosCache || {});

    // Save inside qaaf_global_state AND dedicated node so every user gets it instantly on page load!
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
  }

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
      } else if (Object.keys(window.qaafRealChannelPlaylistsMap).length > 0) {
        // Push local already-fetched playlists up to cloud so all other devices get them immediately!
        savePlaylistsToLocalAndCloudDb();
      }
    });
  }

  pullSavedPlaylistsFromCloudDb();

  var CHANNEL_UI_LABELS = {
    en: { backAll: "⬅️ All Channels", tabVideos: "🎬 Videos", tabShorts: "⚡ Shorts", tabPlaylists: "📂 Playlists", verifiedCh: "Verified Islamic Channel", singleVidCh: "Selected Videos Channel", videosCount: "videos", openPl: "View full playlist", backPl: "⬅️ Back to Playlists", noShorts: "No Shorts in this channel yet.", noPlaylists: "No official YouTube playlists found for this channel.", loadingPls: "⏳ Preparing channel playlists...", loadingPlVids: "⏳ Opening playlist videos...", refreshPls: "🔄 Update Playlists" },
    ur: { backAll: "⬅️ تمام چینلز", tabVideos: "🎬 ویڈیوز", tabShorts: "⚡ شارٹس", tabPlaylists: "📂 پلے لسٹس", verifiedCh: "تصدیق شدہ اسلامی چینل", singleVidCh: "منتخب ویڈیوز والا چینل", videosCount: "ویڈیوز", openPl: "پوری پلے لسٹ دیکھیں", backPl: "⬅️ تمام پلے لسٹس پر واپس", noShorts: "اس چینل میں ابھی کوئی شارٹس نہیں ہیں۔", noPlaylists: "اس چینل پر کوئی یوٹیوب پلے لسٹ نہیں ملی۔", loadingPls: "⏳ پلے لسٹس کھل رہی ہیں...", loadingPlVids: "⏳ پلے لسٹ کی ویڈیوز کھل رہی ہیں...", refreshPls: "🔄 پلے لسٹس اپ ڈیٹ کریں" },
    ar: { backAll: "⬅️ جميع القنوات", tabVideos: "🎬 الفيديوهات", tabShorts: "⚡ المقاطع القصيرة", tabPlaylists: "📂 قوائم التشغيل", verifiedCh: "قناة إسلامية موثقة", singleVidCh: "قناة فيديوهات مختارة", videosCount: "فيديو", openPl: "عرض قائمة التشغيل الكاملة", backPl: "⬅️ العودة لقوائم التشغيل", noShorts: "لا توجد مقاطع قصيرة في هذه القناة.", noPlaylists: "لا توجد قوائم تشغيل على يوتيوب لهذه القناة.", loadingPls: "⏳ جاري فتح قوائم التشغيل...", loadingPlVids: "⏳ جاري فتح فيديوهات القائمة...", refreshPls: "🔄 تحديث القوائم" },
    hi: { backAll: "⬅️ सभी चैनल", tabVideos: "🎬 वीडियो", tabShorts: "⚡ शॉर्ट्स", tabPlaylists: "📂 प्लेलिस्ट", verifiedCh: "सत्यापित इस्लामी चैनल", singleVidCh: "चयनित वीडियो चैनल", videosCount: "वीडियो", openPl: "पूरी प्लेलिस्ट देखें", backPl: "⬅️ सभी प्लेलिस्ट पर वापस", noShorts: "इस चैनल में अभी कोई शॉर्ट्स नहीं हैं।", noPlaylists: "इस चैनल पर कोई यूट्यूब प्लेलिस्ट नहीं मिली।", loadingPls: "⏳ प्लेलिस्ट खुल रही हैं...", loadingPlVids: "⏳ प्लेलिस्ट के वीडियो खुल रहे हैं...", refreshPls: "🔄 प्लेलिस्ट अपडेट करें" },
    bn: { backAll: "⬅️ সব চ্যানেল", tabVideos: "🎬 ভিডিও", tabShorts: "⚡ শর্টস", tabPlaylists: "📂 প্লেলিস্ট", verifiedCh: "যাচাইকৃত ইসলামিক চ্যানেল", singleVidCh: "নির্বাচিত ভিডিও চ্যানেল", videosCount: "ভিডিও", openPl: "সম্পূর্ণ প্লেলিস্ট দেখুন", backPl: "⬅️ সব প্লেলিস্টে ফিরে যান", noShorts: "এই চ্যানেলে কোনো শর্টস নেই।", noPlaylists: "এই চ্যানেলে কোনো ইউটিউব প্লেলিস্ট পাওয়া যায়নি।", loadingPls: "⏳ প্লেলিস্ট খুলছে...", loadingPlVids: "⏳ প্লেলিস্টের ভিডিও খুলছে...", refreshPls: "🔄 প্লেলিস্ট রিফ্রেশ করুন" }
  };

  function getChLabels() {
    var code = window.currentAppUILang || localStorage.getItem("qaaf_ui_display_lang") || "en";
    return CHANNEL_UI_LABELS[code] || CHANNEL_UI_LABELS.en;
  }

  // 2. SMART YOUTUBE-STYLE DIVERSE FEED ALGORITHM
  window.buildSmartYouTubeDiverseFeed = function(videoList) {
    if (!Array.isArray(videoList) || videoList.length <= 1) return videoList || [];

    var prefLang = String(window.preferredContentLang || preferredContentLang || "en").toLowerCase();
    var favSet = new Set(typeof favoriteVideoIds !== "undefined" ? favoriteVideoIds : []);
    var histList = (typeof getActiveHistory === "function") ? (getActiveHistory() || []) : [];
    var histSet = new Set(histList);

    var likedChannels = new Set();
    var likedCategories = new Set();
    videoList.forEach(function(v) {
      if (!v) return;
      if (favSet.has(v.id) || histSet.has(v.id)) {
        if (v.channel) likedChannels.add(v.channel);
        if (v.category) likedCategories.add(v.category);
      }
    });

    var scored = videoList.map(function(v, idx) {
      var s = 0;
      var vLang = String(v.lang || "global").toLowerCase();
      if (vLang === prefLang) s += 120;
      else if (vLang === "global" || v.universalQuran) s += 60;

      if (v.channel && likedChannels.has(v.channel)) s += 35;
      if (v.category && likedCategories.has(v.category)) s += 20;
      if (favSet.has(v.id)) s += 25;
      if (histSet.has(v.id)) s -= 18;

      if (isKidsLocked) {
        if (v.category === "kids_cartoon" || v.category === "kids_tarbiyah") s += 30;
      } else {
        if (v.category === "bayan" || v.category === "quran" || v.category === "tarbiyah") s += 25;
      }

      var createdBonus = Math.min(30, Math.max(0, ((v.createdAt || 0) - 1700000000) / 10000000));
      s += createdBonus;
      return { video: v, score: s, origIdx: idx };
    });

    var channelBuckets = new Map();
    scored.forEach(function(item) {
      var ch = (item.video && item.video.channel) ? item.video.channel : "General";
      if (!channelBuckets.has(ch)) channelBuckets.set(ch, []);
      channelBuckets.get(ch).push(item);
    });

    var bucketList = [];
    channelBuckets.forEach(function(items, chName) {
      items.sort(function(a, b) {
        if (Math.abs(b.score - a.score) > 5) return b.score - a.score;
        return ((b.video.createdAt || 0) - (a.video.createdAt || 0)) || (a.origIdx - b.origIdx);
      });
      bucketList.push({
        channel: chName,
        items: items,
        topScore: items[0] ? items[0].score : 0,
        newestTs: items[0] ? (items[0].video.createdAt || 0) : 0
      });
    });

    bucketList.sort(function(a, b) {
      if (Math.abs(b.topScore - a.topScore) > 15) return b.topScore - a.topScore;
      return b.newestTs - a.newestTs;
    });

    var mixedResult = [];
    var maxLen = 0;
    bucketList.forEach(function(b) {
      if (b.items.length > maxLen) maxLen = b.items.length;
    });

    for (var round = 0; round < maxLen; round++) {
      for (var bIdx = 0; bIdx < bucketList.length; bIdx++) {
        var bucket = bucketList[bIdx];
        if (round < bucket.items.length) {
          mixedResult.push(bucket.items[round].video);
        }
      }
    }
    return mixedResult;
  };

  // 3. FETCH & PERMANENTLY SAVE CHANNEL PLAYLISTS INTO DATABASE
  window.fetchOfficialYouTubePlaylistsForChannel = async function(channelName, forceRefresh) {
    if (!channelName) return [];
    if (!forceRefresh && Array.isArray(window.qaafRealChannelPlaylistsMap[channelName]) && window.qaafRealChannelPlaylistsMap[channelName].length > 0) {
      return window.qaafRealChannelPlaylistsMap[channelName];
    }
    if (isFetchingChannelPls[channelName]) return [];
    isFetchingChannelPls[channelName] = true;

    try {
      var chVids = (videosData || []).filter(function(v) { return v && v.channel === channelName && v.ytId; });
      var sampleYtId = chVids[0] ? chVids[0].ytId : "";
      var authorUrl = "";

      if (sampleYtId) {
        try {
          var oeRes = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + sampleYtId);
          var oeData = await oeRes.json();
          if (oeData && oeData.author_url) {
            authorUrl = oeData.author_url.replace(/\/+$/, "");
          }
        } catch (e) {}
      }

      if (!authorUrl) {
        authorUrl = "https://www.youtube.com/@" + channelName.replace(/\s+/g, "");
      }

      var playlistsPageUrl = authorUrl + "/playlists";
      var plMetaMap = new Map();

      function recordPlCandidate(listId, title, thumb, countText) {
        if (!listId || !/^PL[a-zA-Z0-9_-]{10,}$/.test(listId)) return;
        var existing = plMetaMap.get(listId) || { listId: listId, title: "", thumb: "", countText: "" };
        if (title && title.length > 2 && !/^(view full playlist|play all|playlist|\d+\s*videos?)$/i.test(title.trim())) {
          if (!existing.title || title.length > existing.title.length) existing.title = title.trim();
        }
        if (thumb && !existing.thumb) existing.thumb = thumb;
        if (countText && !existing.countText) existing.countText = countText;
        plMetaMap.set(listId, existing);
      }

      try {
        var jinaHtmlRes = await fetch("https://r.jina.ai/" + playlistsPageUrl, {
          headers: { "Accept": "application/json", "X-Return-Format": "html" }
        });
        if (jinaHtmlRes.ok) {
          var jData = await jinaHtmlRes.json();
          var htmlStr = (jData && jData.data && jData.data.html) || "";
          if (htmlStr) {
            var doc = new DOMParser().parseFromString(htmlStr, "text/html");
            doc.querySelectorAll('a[href*="list=PL"]').forEach(function(aTag) {
              var href = aTag.getAttribute("href") || "";
              var mPl = href.match(/list=(PL[a-zA-Z0-9_-]+)/);
              if (!mPl) return;
              var plId = mPl[1];
              var mVid = href.match(/v=([a-zA-Z0-9_-]{11})/);
              var thumbUrl = mVid ? ("https://i.ytimg.com/vi/" + mVid[1] + "/hqdefault.jpg") : "";

              var cardRoot = aTag.closest("ytd-grid-playlist-renderer, yt-lockup-view-model, ytd-playlist-renderer, ytd-rich-item-renderer") || aTag.parentElement;
              var cardTitle = "";
              var cardCount = "";

              if (cardRoot) {
                var titleNode = cardRoot.querySelector("#video-title, h3, .yt-lockup-metadata-view-model__title, a[title]");
                if (titleNode) {
                  cardTitle = titleNode.getAttribute("title") || titleNode.textContent || "";
                }
                var imgNode = cardRoot.querySelector('img[src*="ytimg.com/vi/"]');
                if (imgNode && !thumbUrl) {
                  var mImg = (imgNode.getAttribute("src") || "").match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
                  if (mImg) thumbUrl = "https://i.ytimg.com/vi/" + mImg[1] + "/hqdefault.jpg";
                }
                var rawCardText = cardRoot.textContent || "";
                var mCnt = rawCardText.match(/(\d+)\s+videos?/i);
                if (mCnt) cardCount = mCnt[1];
              }

              var linkTxt = (aTag.getAttribute("title") || aTag.textContent || "").trim();
              recordPlCandidate(plId, cardTitle || linkTxt, thumbUrl, cardCount);
            });

            var watchPlMatches = htmlStr.matchAll(/watch\?v=([a-zA-Z0-9_-]{11})(?:&|&amp;)list=(PL[a-zA-Z0-9_-]+)/g);
            for (var wm of watchPlMatches) {
              recordPlCandidate(wm[2], "", "https://i.ytimg.com/vi/" + wm[1] + "/hqdefault.jpg", "");
            }
            var allPlMatches = htmlStr.matchAll(/list=(PL[a-zA-Z0-9_-]+)/g);
            for (var pm of allPlMatches) {
              recordPlCandidate(pm[1], "", "", "");
            }
          }
        }
      } catch (e) {}

      var candidates = Array.from(plMetaMap.values()).slice(0, 30);

      await Promise.all(candidates.map(async function(item) {
        if (!item.title || !item.thumb) {
          try {
            var r = await fetch("https://noembed.com/embed?url=https://www.youtube.com/playlist?list=" + item.listId);
            var d = await r.json();
            if (d && d.title) item.title = d.title;
            if (d && d.thumbnail_url && !item.thumb) {
              var mV = d.thumbnail_url.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
              item.thumb = mV ? ("https://i.ytimg.com/vi/" + mV[1] + "/hqdefault.jpg") : d.thumbnail_url;
            }
          } catch (e) {}
        }
      }));

      var finalPlaylists = candidates.filter(function(item) {
        return item.listId && item.title;
      });

      if (finalPlaylists.length > 0) {
        window.qaafRealChannelPlaylistsMap[channelName] = finalPlaylists;
        savePlaylistsToLocalAndCloudDb();
      }

      isFetchingChannelPls[channelName] = false;
      if (window.qaafSelectedChannel === channelName) {
        if (typeof window.renderVideosNow === "function") window.renderVideosNow();
      }
      return finalPlaylists;
    } catch (err) {
      isFetchingChannelPls[channelName] = false;
      return [];
    }
  };

  // 4. AUTOMATIC BACKGROUND PRE-WARMER (PRE-SAVES ALL CHANNELS' PLAYLISTS SO USERS NEVER WAIT!)
  function runSilentBackgroundPlaylistsPreWarmer() {
    var allChs = [];
    (videosData || []).forEach(function(v) {
      if (v && v.channel && allChs.indexOf(v.channel) === -1) {
        allChs.push(v.channel);
      }
    });

    var missingChs = allChs.filter(function(ch) {
      return !Array.isArray(window.qaafRealChannelPlaylistsMap[ch]) || window.qaafRealChannelPlaylistsMap[ch].length === 0;
    });

    if (missingChs.length === 0) return;

    // Fetch missing channels sequentially in the background so they are 100% cached in DB before user clicks!
    var idx = 0;
    function nextCh() {
      if (idx >= missingChs.length) return;
      var chName = missingChs[idx++];
      window.fetchOfficialYouTubePlaylistsForChannel(chName, false).then(function() {
        setTimeout(nextCh, 1200);
      }).catch(function() {
        setTimeout(nextCh, 1200);
      });
    }
    setTimeout(nextCh, 1500);
  }

  setTimeout(runSilentBackgroundPlaylistsPreWarmer, 2000);

  // 5. INSTANT PLAYLIST VIDEOS OPENER (MATCHES AGAINST LOCAL VIDEOS FIRST IN 0.00s + CACHES PERMANENTLY IN DB)
  function getInstantMatchedVideosForPlaylist(plTitle, channelName, listId) {
    var cached = window.qaafPlaylistVideosCache[listId];
    if (Array.isArray(cached) && cached.length > 0) {
      // Map cached video IDs or objects to full video objects
      var byYtId = new Map();
      (videosData || []).forEach(function(v) { if (v && v.ytId) byYtId.set(v.ytId, v); });
      return cached.map(function(item) {
        if (typeof item === "string") return byYtId.get(item) || null;
        if (item && item.ytId && byYtId.has(item.ytId)) return byYtId.get(item.ytId);
        return item;
      }).filter(Boolean);
    }

    // Instant smart match from already-loaded channel videos (0.00s fallback while full list syncs once!)
    var chVids = (videosData || []).filter(function(v) { return v && v.channel === channelName; });
    var titleWords = (plTitle || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ").split(/\s+/).filter(function(w) {
      return w.length >= 3 && ["by", "for", "and", "the", "with", "videos", "video", "urdu", "kids", "moral", "vision", "abdul", "bari", "cartoon", "cartoons", "islamic"].indexOf(w) === -1;
    });

    var isShortsPl = /short/i.test(plTitle);
    var matched = chVids.filter(function(v) {
      if (v.playlistId === listId || v.playlistName === plTitle) return true;
      if (isShortsPl && isVideoShort(v)) return true;
      var vt = (v.title || "").toLowerCase();
      if (titleWords.length > 0) {
        for (var i = 0; i < titleWords.length; i++) {
          if (vt.indexOf(titleWords[i]) !== -1) return true;
        }
      }
      return false;
    });

    return matched;
  }

  window.openQaafOfficialYouTubePlaylist = async function(listId, plTitle, channelName) {
    window.qaafChannelActiveSubTab = "playlists";
    window.qaafChannelSelectedPlaylistObj = { listId: listId, title: plTitle, channel: channelName };

    // Render immediately using cached or instant-matched local videos (0.00 seconds!)
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();

    if (Array.isArray(window.qaafPlaylistVideosCache[listId]) && window.qaafPlaylistVideosCache[listId].length > 0) {
      return;
    }

    if (isFetchingSinglePlVids) return;
    isFetchingSinglePlVids = true;

    try {
      var foundIds = [];
      var plUrl = "https://r.jina.ai/https://www.youtube.com/playlist?list=" + listId;
      var res = await fetch(plUrl, { headers: { "Accept": "application/json", "X-Return-Format": "html" } });
      if (res.ok) {
        var d = await res.json();
        var html = (d && d.data && d.data.html) || "";
        var matches = html.matchAll(/(?:watch\?v=|\/shorts\/|"videoId":")([a-zA-Z0-9_-]{11})/g);
        for (var m of matches) {
          if (foundIds.indexOf(m[1]) === -1) foundIds.push(m[1]);
        }
      }

      var targetIds = foundIds.slice(0, 80);
      var existingByYtId = new Map();
      var sampleCat = "kids_cartoon";
      var sampleLang = "ur";
      (videosData || []).forEach(function(v) {
        if (v && v.ytId) existingByYtId.set(v.ytId, v);
        if (v && v.channel === channelName) {
          if (v.category) sampleCat = v.category;
          if (v.lang) sampleLang = v.lang;
        }
      });

      // First: immediately resolve all videos that are ALREADY in videosData (zero network wait!)
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

      // Second: fetch titles only for any extra videos in the playlist that weren't in the initial 150
      if (missingYtIds.length > 0) {
        var extraSlice = missingYtIds.slice(0, 35);
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
        savePlaylistsToLocalAndCloudDb();
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
    savePlaylistsToLocalAndCloudDb();
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

  // Override renderVideosNow
  var baseFastRender = window.renderVideosNow;
  window.renderVideosNow = function() {
    var selCh = window.qaafSelectedChannel || "ALL";
    var rawSearch = (window.qaafActiveSearchQuery || "").trim();
    var isSpecialSort = (currentSortFilter === "playlist" || currentSortFilter === "history" || currentSortFilter === "favorites" || currentSortFilter === "recent" || currentSortFilter === "viewed");

    var originalVideosOrder = null;
    if (selCh === "ALL" && !rawSearch && !isSpecialSort && Array.isArray(videosData) && videosData.length > 1) {
      originalVideosOrder = videosData.slice();
      var mixed = window.buildSmartYouTubeDiverseFeed(videosData);
      for (var i = 0; i < mixed.length; i++) videosData[i] = mixed[i];
    }

    if (baseFastRender) baseFastRender();

    if (originalVideosOrder) {
      for (var j = 0; j < originalVideosOrder.length; j++) videosData[j] = originalVideosOrder[j];
    }

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
      if (chShortVids.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400 text-xs font-bold">' + lbl.noShorts + '</div>';
      }
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

  if (typeof window.renderVideosNow === "function") {
    window.renderVideosNow();
  }
})();
// === QAAF V16 SMART YOUTUBE FEED & CHANNEL TABS END ===

// === QAAF V18 ADMIN PLAYLIST PICKER & DAILY CHANNEL SCANNER START ===
(function initQaafAdminPlaylistPickerAndDailyScanner() {
  var FIREBASE_DEFAULT_URL = "https://qaaftube-6f251-default-rtdb.firebaseio.com";
  function getFbBase() {
    return (localStorage.getItem("qaaf_firebase_db_url") || FIREBASE_DEFAULT_URL).replace(/\/+$/, "");
  }

  window.qaafAdminFetchedPlaylists = [];
  window.qaafAdminDetectedChannelTitle = "";
  window.qaafAdminImportMode = "all_channel"; // 'all_channel' | 'by_playlists'
  window.qaafChannelUpdatesQueue = JSON.parse(localStorage.getItem("qaaf_channel_updates_queue_v1") || "[]");
  window.qaafRejectedUpdateYtIds = JSON.parse(localStorage.getItem("qaaf_rejected_update_ytids_v1") || "[]");
  var isScanningUpdatesNow = false;

  // Sync Updates Queue & Rejected IDs with Firebase Cloud
  function saveUpdatesQueueToCloud() {
    try {
      localStorage.setItem("qaaf_channel_updates_queue_v1", JSON.stringify(window.qaafChannelUpdatesQueue));
      localStorage.setItem("qaaf_rejected_update_ytids_v1", JSON.stringify(window.qaafRejectedUpdateYtIds));
    } catch (e) {}

    fetch(getFbBase() + "/qaaf_channel_updates_db.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updatesQueue: window.qaafChannelUpdatesQueue || [],
        rejectedYtIds: window.qaafRejectedUpdateYtIds || [],
        updatedAt: Date.now()
      })
    }).catch(function() {});
  }

  function pullUpdatesQueueFromCloud() {
    fetch(getFbBase() + "/qaaf_channel_updates_db.json?t=" + Date.now(), { cache: "no-store" })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) {
        if (!d || typeof d !== "object") return;
        if (Array.isArray(d.updatesQueue)) {
          window.qaafChannelUpdatesQueue = d.updatesQueue;
          localStorage.setItem("qaaf_channel_updates_queue_v1", JSON.stringify(window.qaafChannelUpdatesQueue));
        }
        if (Array.isArray(d.rejectedYtIds)) {
          window.qaafRejectedUpdateYtIds = d.rejectedYtIds;
          localStorage.setItem("qaaf_rejected_update_ytids_v1", JSON.stringify(window.qaafRejectedUpdateYtIds));
        }
        renderAdminChannelUpdatesScannerBox();
        updateAdminHeaderUpdateBadges();
      }).catch(function() {});
  }

  pullUpdatesQueueFromCloud();

  function updateAdminHeaderUpdateBadges() {
    var uCount = (window.qaafChannelUpdatesQueue && window.qaafChannelUpdatesQueue.length) || 0;
    var rCount = (window.parentRequestsQueue && window.parentRequestsQueue.length) || 0;
    var fCount = (typeof flaggedVideosQueue !== "undefined" && flaggedVideosQueue.length) || 0;
    var total = uCount + rCount + fCount;

    var hdrBadge = document.getElementById("adminFlagCountBadge");
    if (hdrBadge) hdrBadge.innerText = String(total);

    var pubBadge = document.getElementById("admNewUpdatesCountPill");
    if (pubBadge) {
      pubBadge.innerText = uCount + " New";
      pubBadge.className = uCount > 0
        ? "bg-amber-500 text-black px-2 py-0.5 rounded-full text-[10px] font-extrabold animate-pulse"
        : "bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-bold";
    }
  }

  // =========================================================================
  // PART 1: ADMIN CHANNEL PLAYLIST SELECTOR (IMPORT ENTIRE CHANNEL vs BY SELECTED PLAYLISTS)
  // =========================================================================
  function ensureAdminPlaylistSelectorUI() {
    var previewCont = document.getElementById("adminYtPreviewContainer");
    if (!previewCont || document.getElementById("adminPlaylistSelectorBox")) return;

    // Add a "📂 Fetch Playlists" button right next to "✨ Auto-Fetch"
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

    var pickerBox = document.createElement("div");
    pickerBox.id = "adminPlaylistSelectorBox";
    pickerBox.className = "hidden bg-[#0e131d] border-2 border-emerald-500/50 rounded-2xl p-3.5 space-y-3 text-xs";
    previewCont.parentNode.insertBefore(pickerBox, previewCont.nextSibling);
  }

  window.setAdminChannelImportMode = function(mode) {
    window.qaafAdminImportMode = mode || "all_channel";
    renderAdminPlaylistPickerBox();
  };

  window.toggleAllAdminPlaylistChecks = function(checkVal) {
    document.querySelectorAll(".adm-pl-picker-chk").forEach(function(cb) {
      cb.checked = !!checkVal;
    });
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
      var cntLabel = pl.countText ? (pl.countText + " videos") : "Playlist";
      rowsHtml +=
        '<label class="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-black/70 hover:bg-slate-900 border border-slate-800 cursor-pointer transition">' +
          '<div class="flex items-center gap-2.5 min-w-0">' +
            '<input type="checkbox" checked data-pl-idx="' + idx + '" value="' + pl.listId + '" class="adm-pl-picker-chk accent-emerald-500 w-4 h-4 rounded cursor-pointer shrink-0" />' +
            (pl.thumb ? ('<img src="' + pl.thumb + '" alt="" class="w-12 h-7 object-cover rounded border border-white/10 shrink-0" />') : '') +
            '<span class="font-bold text-white truncate text-xs">' + pl.title + '</span>' +
          '</div>' +
          '<span class="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-extrabold shrink-0">' + cntLabel + '</span>' +
        '</label>';
    });

    box.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">' +
        '<div>' +
          '<h5 class="text-xs sm:text-sm font-extrabold text-emerald-400">📂 Channel Playlists Found (' + pls.length + ' Playlists)</h5>' +
          '<p class="text-[11px] text-slate-400">Choose whether to import the entire channel or only specific playlists:</p>' +
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
        '<span class="text-[11px] text-amber-300 font-bold">💡 Unchecked playlists will be hidden and excluded automatically.</span>' +
        '<button type="button" onclick="window.adminImportSelectedPlaylistsNow()" class="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-lg cursor-pointer">' +
          '➕ Import Selected Playlists Live' +
        '</button>' +
      '</div>';

    box.classList.remove("hidden");
  }

  window.adminFetchChannelPlaylistsForPicker = async function() {
    ensureAdminPlaylistSelectorUI();
    var urlInp = document.getElementById("adminYtUrlInput");
    var raw = (urlInp ? urlInp.value : "").trim();
    if (!raw) {
      alert("Please paste a YouTube Channel URL (e.g. https://www.youtube.com/@MoralVisionKidsUrdu) first.");
      return;
    }

    if (typeof showSyncToast === "function") {
      showSyncToast("⏳ Scanning channel playlists from YouTube...");
    }

    var cleanUrl = raw.startsWith("http") ? raw : ("https://www.youtube.com/" + (raw.startsWith("@") ? raw : ("@" + raw)));
    var baseChannel = cleanUrl.replace(/\/(videos|shorts|featured|streams|playlists)?\/?$/, "");
    var playlistsPageUrl = baseChannel + "/playlists";

    var plMetaMap = new Map();
    function addCandidate(listId, title, thumb, countText) {
      if (!listId || !/^PL[a-zA-Z0-9_-]{10,}$/.test(listId)) return;
      var ex = plMetaMap.get(listId) || { listId: listId, title: "", thumb: "", countText: "" };
      if (title && title.length > 2 && !/^(view full playlist|play all|playlist|\d+\s*videos?)$/i.test(title.trim())) {
        if (!ex.title || title.length > ex.title.length) ex.title = title.trim();
      }
      if (thumb && !ex.thumb) ex.thumb = thumb;
      if (countText && !ex.countText) ex.countText = countText;
      plMetaMap.set(listId, ex);
    }

    var detectedChannelName = (document.getElementById("adminChannelName") ? document.getElementById("adminChannelName").value : "").trim();

    try {
      var res = await fetch("https://r.jina.ai/" + playlistsPageUrl, {
        headers: { "Accept": "application/json", "X-Return-Format": "html" }
      });
      if (res.ok) {
        var d = await res.json();
        var htmlStr = (d && d.data && d.data.html) || "";
        if (htmlStr) {
          var tMatch = htmlStr.match(/<title>([^<]+)<\/title>/);
          if (tMatch && tMatch[1] && !detectedChannelName) {
            detectedChannelName = tMatch[1].replace(/ - YouTube$/i, "").trim();
          }
          var doc = new DOMParser().parseFromString(htmlStr, "text/html");
          doc.querySelectorAll('a[href*="list=PL"]').forEach(function(aTag) {
            var href = aTag.getAttribute("href") || "";
            var mPl = href.match(/list=(PL[a-zA-Z0-9_-]+)/);
            if (!mPl) return;
            var plId = mPl[1];
            var mVid = href.match(/v=([a-zA-Z0-9_-]{11})/);
            var thumbUrl = mVid ? ("https://i.ytimg.com/vi/" + mVid[1] + "/hqdefault.jpg") : "";
            var cardRoot = aTag.closest("ytd-grid-playlist-renderer, yt-lockup-view-model, ytd-playlist-renderer, ytd-rich-item-renderer") || aTag.parentElement;
            var cardTitle = "";
            var cardCount = "";
            if (cardRoot) {
              var titleNode = cardRoot.querySelector("#video-title, h3, .yt-lockup-metadata-view-model__title, a[title]");
              if (titleNode) cardTitle = titleNode.getAttribute("title") || titleNode.textContent || "";
              var rawTxt = cardRoot.textContent || "";
              var mCnt = rawTxt.match(/(\d+)\s+videos?/i);
              if (mCnt) cardCount = mCnt[1];
            }
            var linkTxt = (aTag.getAttribute("title") || aTag.textContent || "").trim();
            addCandidate(plId, cardTitle || linkTxt, thumbUrl, cardCount);
          });

          var watchPlMatches = htmlStr.matchAll(/watch\?v=([a-zA-Z0-9_-]{11})(?:&|&amp;)list=(PL[a-zA-Z0-9_-]+)/g);
          for (var wm of watchPlMatches) {
            addCandidate(wm[2], "", "https://i.ytimg.com/vi/" + wm[1] + "/hqdefault.jpg", "");
          }
          var allPlMatches = htmlStr.matchAll(/list=(PL[a-zA-Z0-9_-]+)/g);
          for (var pm of allPlMatches) {
            addCandidate(pm[1], "", "", "");
          }
        }
      }
    } catch (e) {}

    var listArr = Array.from(plMetaMap.values()).slice(0, 30);
    await Promise.all(listArr.map(async function(item) {
      if (!item.title || !item.thumb || !detectedChannelName) {
        try {
          var r = await fetch("https://noembed.com/embed?url=https://www.youtube.com/playlist?list=" + item.listId);
          var info = await r.json();
          if (info && info.title) item.title = info.title;
          if (info && info.author_name && !detectedChannelName) detectedChannelName = info.author_name;
          if (info && info.thumbnail_url && !item.thumb) {
            var mV = info.thumbnail_url.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
            item.thumb = mV ? ("https://i.ytimg.com/vi/" + mV[1] + "/hqdefault.jpg") : info.thumbnail_url;
          }
        } catch (e) {}
      }
    }));

    window.qaafAdminFetchedPlaylists = listArr.filter(function(x) { return x.listId && x.title; });
    if (detectedChannelName) {
      window.qaafAdminDetectedChannelTitle = detectedChannelName;
      var chInp = document.getElementById("adminChannelName");
      if (chInp && !chInp.value.trim()) chInp.value = detectedChannelName;
    }

    renderAdminPlaylistPickerBox();
    if (typeof showSyncToast === "function") {
      showSyncToast("📂 Found " + window.qaafAdminFetchedPlaylists.length + " playlists! Select which ones to import below.");
    }
  };

  // Playlist fetching is triggered cleanly via the dedicated "Fetch Playlists" button so it never collides with Auto-Fetch.

  // Import ONLY Checked Playlists (or Save Checked Playlists when importing channel)
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
      alert("⚠️ Please select at least one playlist to import.");
      return;
    }

    var selectedPls = allPls.filter(function(p) { return checkedIds.indexOf(p.listId) !== -1; });
    var chName = (document.getElementById("adminChannelName") ? document.getElementById("adminChannelName").value : "").trim() || window.qaafAdminDetectedChannelTitle || "Islamic Channel";
    var lang = document.getElementById("adminVideoLang") ? document.getElementById("adminVideoLang").value : "ur";
    var cat = document.getElementById("adminVideoCat") ? document.getElementById("adminVideoCat").value : "kids_cartoon";
    var audEl = document.getElementById("adminVideoAudience");
    var audVal = audEl ? audEl.value : (cat === "bayan" ? "family_only" : "both_family_kids");

    // Record unchecked playlists in blocked list so they never show up
    uncheckedIds.forEach(function(id) {
      if (window.qaafBlockedPlaylistIds.indexOf(id) === -1) window.qaafBlockedPlaylistIds.push(id);
    });

    // Save selected playlists for this channel
    window.qaafRealChannelPlaylistsMap[chName] = selectedPls;
    localStorage.setItem("qaaf_real_channel_playlists_v1", JSON.stringify(window.qaafRealChannelPlaylistsMap));
    localStorage.setItem("qaaf_blocked_playlist_ids", JSON.stringify(window.qaafBlockedPlaylistIds));

    if (window.qaafAdminImportMode === "all_channel") {
      // Trigger normal channel push + save selected playlists
      if (typeof window.adminAddGlobalVideo === "function") {
        window.adminAddGlobalVideo();
      }
      var box = document.getElementById("adminPlaylistSelectorBox");
      if (box) box.classList.add("hidden");
      return;
    }

    // Mode 2: Import By Selected Playlists Only! Fetch videos from each checked playlist
    if (typeof showSyncToast === "function") {
      showSyncToast("⏳ Importing videos from " + selectedPls.length + " selected playlist(s)...");
    }

    var totalImportedCount = 0;
    for (var pIdx = 0; pIdx < selectedPls.length; pIdx++) {
      var plObj = selectedPls[pIdx];
      var foundVidIds = [];
      try {
        var rPl = await fetch("https://r.jina.ai/https://www.youtube.com/playlist?list=" + plObj.listId, {
          headers: { "Accept": "application/json", "X-Return-Format": "html" }
        });
        if (rPl.ok) {
          var dPl = await rPl.json();
          var hPl = (dPl && dPl.data && dPl.data.html) || "";
          var mVids = hPl.matchAll(/(?:watch\?v=|\/shorts\/|"videoId":")([a-zA-Z0-9_-]{11})/g);
          for (var mv of mVids) {
            if (foundVidIds.indexOf(mv[1]) === -1) foundVidIds.push(mv[1]);
          }
        }
      } catch (e) {}

      var capIds = foundVidIds.slice(0, 50);
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
    localStorage.setItem("qaaf_playlist_videos_cache_v1", JSON.stringify(window.qaafPlaylistVideosCache));

    var boxEl = document.getElementById("adminPlaylistSelectorBox");
    if (boxEl) boxEl.classList.add("hidden");
    window.qaafAdminFetchedPlaylists = [];

    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    if (typeof window.renderAdminActiveVideosCatalog === "function") window.renderAdminActiveVideosCatalog();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Imported " + selectedPls.length + " Playlists from " + chName);
    if (typeof showSyncToast === "function") {
      showSyncToast("🎉 Imported " + totalImportedCount + " videos from " + selectedPls.length + " selected playlist(s)!");
    }
  };

  // =========================================================================
  // PART 2: DAILY VERIFIED CHANNELS NEW UPLOAD SCANNER (GREEN / YELLOW / RED + ACCEPT / REJECT)
  // =========================================================================
  window.scanAllVerifiedChannelsForNewUploads = async function(isManualTrigger) {
    if (isScanningUpdatesNow) return;
    isScanningUpdatesNow = true;

    var statusEl = document.getElementById("admScannerStatusText");
    if (statusEl) statusEl.innerText = "⏳ Scanning verified channels for new YouTube uploads...";
    if (isManualTrigger && typeof showSyncToast === "function") {
      showSyncToast("🔍 Checking all verified channels for new uploaded videos...");
    }

    try {
      var verChs = Array.from(new Set((window.verifiedChannelsList || []).concat(
        (videosData || []).filter(function(v) { return v && v.channelVerified; }).map(function(v) { return v.channel; })
      ))).filter(Boolean);

      if (verChs.length === 0) {
        // Fallback to all active channels in videosData
        verChs = Array.from(new Set((videosData || []).map(function(v) { return v && v.channel; }))).filter(Boolean);
      }

      var knownYtIds = new Set((videosData || []).map(function(v) { return v && v.ytId; }));
      var blockedSet = new Set(blockedVideoIds || []);
      var rejectedSet = new Set(window.qaafRejectedUpdateYtIds || []);
      var queuedSet = new Set((window.qaafChannelUpdatesQueue || []).map(function(q) { return q && q.ytId; }));

      var newlyDetectedCount = 0;

      for (var cIdx = 0; cIdx < verChs.length; cIdx++) {
        var chName = verChs[cIdx];
        var chVids = (videosData || []).filter(function(v) { return v && v.channel === chName && v.ytId; });
        if (chVids.length === 0) continue;

        var sampleVid = chVids[0];
        var authorUrl = "";
        try {
          var oe = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + sampleVid.ytId);
          var oeJson = await oe.json();
          if (oeJson && oeJson.author_url) authorUrl = oeJson.author_url.replace(/\/+$/, "");
        } catch (e) {}

        if (!authorUrl) continue;

        // Fetch the channel's /videos page to inspect its newest uploads at the top
        var latestPageIds = [];
        try {
          var resV = await fetch("https://r.jina.ai/" + authorUrl + "/videos", {
            headers: { "Accept": "application/json", "X-Return-Format": "html" }
          });
          if (resV.ok) {
            var dV = await resV.json();
            var hV = (dV && dV.data && dV.data.html) || "";
            var mAll = hV.matchAll(/(?:watch\?v=|\/shorts\/|"videoId":")([a-zA-Z0-9_-]{11})/g);
            for (var m of mAll) {
              if (latestPageIds.indexOf(m[1]) === -1) latestPageIds.push(m[1]);
              if (latestPageIds.length >= 12) break;
            }
          }
        } catch (e) {}

        // Only consider videos that appear BEFORE our first known video of this channel (so old videos are never mistaken for new uploads!)
        var newCandidateIds = [];
        for (var k = 0; k < latestPageIds.length; k++) {
          var candidateId = latestPageIds[k];
          if (knownYtIds.has(candidateId)) {
            // Reached a video we already have -> anything after this is older!
            break;
          }
          if (!blockedSet.has(candidateId) && !blockedSet.has("v_" + candidateId) && !rejectedSet.has(candidateId) && !queuedSet.has(candidateId)) {
            newCandidateIds.push(candidateId);
          }
          if (newCandidateIds.length >= 5) break;
        }

        for (var n = 0; n < newCandidateIds.length; n++) {
          var newYtId = newCandidateIds[n];
          try {
            var rInfo = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + newYtId);
            var info = await rInfo.json();
            if (info && info.title) {
              var newUpdateItem = {
                updateId: "upd_" + newYtId,
                ytId: newYtId,
                title: info.title,
                channel: chName,
                lang: sampleVid.lang || "ur",
                category: sampleVid.category || "kids_cartoon",
                audienceMode: sampleVid.audienceMode || "both_family_kids",
                detectedAt: new Date().toLocaleString()
              };
              window.qaafChannelUpdatesQueue.unshift(newUpdateItem);
              queuedSet.add(newYtId);
              newlyDetectedCount++;
            }
          } catch (e) {}
        }
      }

      localStorage.setItem("qaaf_last_daily_channel_scan_ts", String(Date.now()));
      saveUpdatesQueueToCloud();
      renderAdminChannelUpdatesScannerBox();
      updateAdminHeaderUpdateBadges();

      if (statusEl) {
        statusEl.innerText = "✅ Last Scanned: " + new Date().toLocaleTimeString() + " (" + window.qaafChannelUpdatesQueue.length + " pending new upload(s))";
      }
      if (isManualTrigger && typeof showSyncToast === "function") {
        if (newlyDetectedCount > 0) {
          showSyncToast("🔔 Found " + newlyDetectedCount + " new video upload(s) from verified channels!");
        } else {
          showSyncToast("✅ All verified channels are up to date! No new unreviewed uploads.");
        }
      }
    } catch (err) {
      if (statusEl) statusEl.innerText = "⚠️ Scan completed.";
    }
    isScanningUpdatesNow = false;
  };

  window.adminApproveChannelUpdateVideo = function(idx) {
    var item = window.qaafChannelUpdatesQueue[idx];
    if (!item) return;
    if (!videosData.some(function(v) { return v.ytId === item.ytId; })) {
      videosData.unshift({
        id: "v_" + item.ytId,
        ytId: item.ytId,
        title: item.title,
        channel: item.channel,
        lang: item.lang || "ur",
        region: (item.lang || "ur").toUpperCase(),
        category: item.category || "kids_cartoon",
        audienceMode: item.audienceMode || "both_family_kids",
        kidsSafe: (item.audienceMode !== "family_only" && item.category !== "bayan"),
        channelVerified: true,
        isShort: /#short/i.test(item.title),
        isCustomAdded: true,
        duration: "11:20",
        views: 2500,
        createdAt: Math.floor(Date.now() / 1000)
      });
      localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    }
    window.qaafChannelUpdatesQueue.splice(idx, 1);
    saveUpdatesQueueToCloud();
    renderAdminChannelUpdatesScannerBox();
    updateAdminHeaderUpdateBadges();
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Approved New Channel Upload: " + item.title);
    if (typeof showSyncToast === "function") showSyncToast("✅ Approved & Published: " + item.title);
  };

  window.adminRejectChannelUpdateVideo = function(idx) {
    var item = window.qaafChannelUpdatesQueue[idx];
    if (!item) return;
    if (window.qaafRejectedUpdateYtIds.indexOf(item.ytId) === -1) {
      window.qaafRejectedUpdateYtIds.push(item.ytId);
    }
    if (blockedVideoIds.indexOf(item.ytId) === -1) {
      blockedVideoIds.push(item.ytId);
      localStorage.setItem("qaaf_blocked_videos", JSON.stringify(blockedVideoIds));
    }
    window.qaafChannelUpdatesQueue.splice(idx, 1);
    saveUpdatesQueueToCloud();
    renderAdminChannelUpdatesScannerBox();
    updateAdminHeaderUpdateBadges();
    if (typeof showSyncToast === "function") showSyncToast("🚫 Rejected & Permanently Ignored: " + item.title);
  };

  window.adminApproveAllGreenChannelUpdates = function() {
    var remaining = [];
    var approvedCount = 0;
    (window.qaafChannelUpdatesQueue || []).forEach(function(item) {
      var ev = (typeof window.evaluateRequestColorCategory === "function")
        ? window.evaluateRequestColorCategory(item)
        : { color: "GREEN" };
      if (ev.color === "GREEN") {
        if (!videosData.some(function(v) { return v.ytId === item.ytId; })) {
          videosData.unshift({
            id: "v_" + item.ytId,
            ytId: item.ytId,
            title: item.title,
            channel: item.channel,
            lang: item.lang || "ur",
            region: (item.lang || "ur").toUpperCase(),
            category: item.category || "kids_cartoon",
            audienceMode: item.audienceMode || "both_family_kids",
            kidsSafe: (item.audienceMode !== "family_only" && item.category !== "bayan"),
            channelVerified: true,
            isShort: /#short/i.test(item.title),
            isCustomAdded: true,
            duration: "11:20",
            views: 2500,
            createdAt: Math.floor(Date.now() / 1000)
          });
        }
        approvedCount++;
      } else {
        remaining.push(item);
      }
    });
    if (approvedCount === 0) {
      alert("No Green updates to approve.");
      return;
    }
    localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    window.qaafChannelUpdatesQueue = remaining;
    saveUpdatesQueueToCloud();
    renderAdminChannelUpdatesScannerBox();
    updateAdminHeaderUpdateBadges();
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Approved " + approvedCount + " New Channel Uploads");
    if (typeof showSyncToast === "function") showSyncToast("🎉 Approved " + approvedCount + " Green channel uploads!");
  };

  function renderAdminChannelUpdatesScannerBox() {
    var pubPane = document.getElementById("admPane_publish");
    if (!pubPane) return;

    var scannerBox = document.getElementById("adminDailyChannelScannerCard");
    if (!scannerBox) {
      scannerBox = document.createElement("div");
      scannerBox.id = "adminDailyChannelScannerCard";
      scannerBox.className = "bg-[#131822] border-2 border-blue-500/40 rounded-2xl p-4 space-y-3 text-xs";
      var catalogCard = document.getElementById("adminActiveVideosCatalogList");
      if (catalogCard && catalogCard.parentElement) {
        pubPane.insertBefore(scannerBox, catalogCard.parentElement);
      } else {
        pubPane.appendChild(scannerBox);
      }
    }

    var qList = window.qaafChannelUpdatesQueue || [];
    var lastScanTs = parseInt(localStorage.getItem("qaaf_last_daily_channel_scan_ts") || "0", 10);
    var lastScanLabel = lastScanTs > 0 ? new Date(lastScanTs).toLocaleString() : "Not scanned today";

    var itemsHtml = "";
    if (qList.length === 0) {
      itemsHtml = '<div class="bg-black/50 border border-slate-800 rounded-xl p-4 text-center text-slate-400">✅ No unreviewed new channel uploads right now. Click <strong>"🔄 Scan Channels Now"</strong> above to check YouTube for new uploads.</div>';
    } else {
      qList.forEach(function(item, idx) {
        var ev = (typeof window.evaluateRequestColorCategory === "function")
          ? window.evaluateRequestColorCategory(item)
          : { color: "GREEN", badgeClass: "bg-emerald-500/20 border-emerald-400 text-emerald-300", cardBorder: "border-emerald-500/70 bg-emerald-950/15", label: "🟢 GREEN — Verified Channel Upload" };
        var safeTitle = (item.title || "").replace(/'/g, "\\'");
        var thumb = "https://i.ytimg.com/vi/" + item.ytId + "/hqdefault.jpg";

        itemsHtml +=
          '<div class="border-2 ' + ev.cardBorder + ' p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition">' +
            '<div class="flex items-center gap-3 min-w-0 flex-1">' +
              '<div onclick="playVideoInsideAdminModal(\'' + item.ytId + '\', \'' + safeTitle + '\')" class="relative w-24 h-14 rounded-lg overflow-hidden border border-white/15 shrink-0 cursor-pointer group bg-slate-900">' +
                '<img src="' + thumb + '" alt="" class="w-full h-full object-cover group-hover:scale-105 transition" />' +
                '<div class="absolute inset-0 bg-black/35 flex items-center justify-center"><span class="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-xs shadow">▶</span></div>' +
              '</div>' +
              '<div class="min-w-0 flex-1 space-y-1">' +
                '<span class="inline-block border ' + ev.badgeClass + ' px-2 py-0.5 rounded-full text-[10px] font-extrabold">' + ev.label + '</span>' +
                '<p class="font-extrabold text-white text-xs sm:text-sm truncate">' + item.title + '</p>' +
                '<p class="text-[11px] text-slate-300">Channel: <strong class="text-emerald-400">' + item.channel + '</strong> • Detected: ' + (item.detectedAt || "New") + '</p>' +
              '</div>' +
            '</div>' +
            '<div class="flex flex-wrap items-center gap-1.5 shrink-0">' +
              '<button type="button" onclick="playVideoInsideAdminModal(\'' + item.ytId + '\', \'' + safeTitle + '\')" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-extrabold shadow cursor-pointer">▶ Play / Check</button>' +
              '<button type="button" onclick="window.adminApproveChannelUpdateVideo(' + idx + ')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-extrabold shadow cursor-pointer">✅ Approve</button>' +
              '<button type="button" onclick="window.adminRejectChannelUpdateVideo(' + idx + ')" class="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-extrabold shadow cursor-pointer">🚫 Reject</button>' +
            '</div>' +
          '</div>';
      });
    }

    scannerBox.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">' +
        '<div class="flex items-center gap-2">' +
          '<span class="text-lg">🔔</span>' +
          '<div>' +
            '<div class="flex items-center gap-2">' +
              '<h5 class="text-xs sm:text-sm font-extrabold text-white">Daily Verified Channels New Video Scanner</h5>' +
              '<span id="admNewUpdatesCountPill" class="' + (qList.length > 0 ? 'bg-amber-500 text-black animate-pulse' : 'bg-slate-800 text-slate-400') + ' px-2 py-0.5 rounded-full text-[10px] font-extrabold">' + qList.length + ' New</span>' +
            '</div>' +
            '<p id="admScannerStatusText" class="text-[10px] text-slate-400 mt-0.5">Auto-checks verified channels daily • Last Scanned: ' + lastScanLabel + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="flex flex-wrap items-center gap-1.5">' +
          (qList.length > 0 ? '<button type="button" onclick="window.adminApproveAllGreenChannelUpdates()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-extrabold shadow cursor-pointer">✅ Approve All Green</button>' : '') +
          '<button type="button" onclick="window.scanAllVerifiedChannelsForNewUploads(true)" class="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl text-[11px] font-extrabold shadow flex items-center gap-1 cursor-pointer">' +
            '<span>🔄</span> <span>Scan Channels Now</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="space-y-2 max-h-80 overflow-y-auto pr-1">' + itemsHtml + '</div>';
  }

  // Automatically trigger daily scan once every 24 hours when Admin or Monitor is logged in
  var prevOpenAdm = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevOpenAdm) prevOpenAdm();
    ensureAdminPlaylistSelectorUI();
    renderAdminChannelUpdatesScannerBox();
    updateAdminHeaderUpdateBadges();

    var lastScan = parseInt(localStorage.getItem("qaaf_last_daily_channel_scan_ts") || "0", 10);
    if (Date.now() - lastScan > 12 * 60 * 60 * 1000) {
      setTimeout(function() { window.scanAllVerifiedChannelsForNewUploads(false); }, 800);
    }
  };

  setTimeout(function() {
    ensureAdminPlaylistSelectorUI();
    renderAdminChannelUpdatesScannerBox();
    updateAdminHeaderUpdateBadges();
    if (typeof isSuperAdmin === "function" && isSuperAdmin()) {
      var lastScan = parseInt(localStorage.getItem("qaaf_last_daily_channel_scan_ts") || "0", 10);
      if (Date.now() - lastScan > 12 * 60 * 60 * 1000) {
        window.scanAllVerifiedChannelsForNewUploads(false);
      }
    }
  }, 2200);
})();
// === QAAF V18 ADMIN PLAYLIST PICKER & DAILY CHANNEL SCANNER END ===

// === QAAF V19 SUPER ADMIN UNBAN & RE-ADD CHANNEL OVERRIDE START ===
(function initQaafSuperAdminUnbanAndReAddOverride() {
  var FIREBASE_DEFAULT_URL = "https://qaaftube-6f251-default-rtdb.firebaseio.com";
  function getFbBase() {
    return (localStorage.getItem("qaaf_firebase_db_url") || FIREBASE_DEFAULT_URL).replace(/\/+$/, "");
  }

  // Strictly check if current user is the Main Super Admin (NOT Monitor, NOT Parent, NOT Guest)
  window.isStrictlyMainSuperAdmin = function() {
    return (typeof isSuperAdminLoggedIn !== "undefined" && isSuperAdminLoggedIn === true && !window.isMonitorRoleActive);
  };

  function syncUnbanStateToCloudNow() {
    try {
      localStorage.setItem("qaaf_banned_channels", JSON.stringify(bannedChannels || []));
      localStorage.setItem("qaaf_blocked_videos", JSON.stringify(blockedVideoIds || []));
    } catch (e) {}

    var base = getFbBase();
    fetch(base + "/qaaf_global_state/bannedChannels.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bannedChannels || [])
    }).catch(function() {});

    fetch(base + "/qaaf_global_state/blockedVideoIds.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blockedVideoIds || [])
    }).catch(function() {});

    if (window.qaafCloudSync && typeof window.qaafCloudSync.pushState === "function") {
      window.qaafCloudSync.pushState("Super Admin Updated Banned Channels List");
    }
  }

  // Helper: Completely clean a channel from bannedChannels AND clean its videos from blockedVideoIds
  window.superAdminCleanChannelBanRecord = function(chName, batchVidIds) {
    if (!chName && (!batchVidIds || batchVidIds.length === 0)) return;
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

    // Also clear any video IDs belonging to this channel or import batch from blockedVideoIds
    if (Array.isArray(blockedVideoIds)) {
      var idsToUnblock = new Set();
      if (Array.isArray(batchVidIds)) {
        batchVidIds.forEach(function(id) {
          if (id) {
            idsToUnblock.add(String(id));
            idsToUnblock.add("v_" + String(id));
          }
        });
      }
      (videosData || []).forEach(function(v) {
        if (v && v.channel && String(v.channel).trim().toLowerCase() === normTarget) {
          if (v.id) idsToUnblock.add(String(v.id));
          if (v.ytId) {
            idsToUnblock.add(String(v.ytId));
            idsToUnblock.add("v_" + String(v.ytId));
          }
        }
      });

      if (idsToUnblock.size > 0) {
        for (var j = blockedVideoIds.length - 1; j >= 0; j--) {
          if (idsToUnblock.has(String(blockedVideoIds[j]))) {
            blockedVideoIds.splice(j, 1);
          }
        }
        window.blockedVideoIds = blockedVideoIds;
      }
    }

    syncUnbanStateToCloudNow();
  };

  // 1. OVERRIDE adminUnbanChannel: Restricted to Main Super Admin Only + Auto-Prepares Channel for Re-Import!
  window.adminUnbanChannel = function(chName) {
    if (!window.isStrictlyMainSuperAdmin()) {
      alert("🔒 Access Denied: Only the Main Super Admin can unban or restore a banned channel.");
      return;
    }
    if (!chName) return;

    window.superAdminCleanChannelBanRecord(chName, []);

    if (typeof window.renderAdminActiveVideosCatalog === "function") {
      window.renderAdminActiveVideosCatalog();
    }
    if (typeof window.renderVideosNow === "function") {
      window.renderVideosNow();
    }

    if (typeof showSyncToast === "function") {
      showSyncToast("✅ Channel '" + chName + "' is now Unbanned!");
    }

    // Offer to auto-fill and fetch the channel right away so Admin can re-add it in 1 click!
    var urlInp = document.getElementById("adminYtUrlInput");
    var chInp = document.getElementById("adminChannelName");
    if (urlInp) {
      var handleGuess = "@" + String(chName).replace(/\s+/g, "");
      urlInp.value = "https://www.youtube.com/" + handleGuess;
      if (chInp) chInp.value = chName;
      urlInp.scrollIntoView({ behavior: "smooth", block: "center" });
      if (confirm("✅ '" + chName + "' has been unbanned!\n\nWould you like to Auto-Fetch its videos now so you can push it live?")) {
        if (typeof window.adminAutoFetchYouTubeInfo === "function") {
          window.adminAutoFetchYouTubeInfo();
        }
      }
    }
  };

  // 2. OVERRIDE adminBanEntireChannel: Restrict banning/unbanning controls & allow Main Super Admin to manage cleanly
  var origBanChannel = window.adminBanEntireChannel;
  window.adminBanEntireChannel = function(chName) {
    if (!window.isStrictlyMainSuperAdmin()) {
      alert("🔒 Only the Main Super Admin can ban an entire channel.");
      return;
    }
    if (origBanChannel) origBanChannel(chName);
  };

  // 3. OVERRIDE adminAddGlobalVideo (+ Push Live):
  //    If Main Super Admin is pushing a channel/video that was previously banned or had blocked video IDs,
  //    automatically unban the channel & unblock all its video IDs so the import succeeds 100%!
  var origAdminAddGlobalVideo = window.adminAddGlobalVideo;
  window.adminAddGlobalVideo = function() {
    var chInp = document.getElementById("adminChannelName");
    var chName = (chInp ? chInp.value : "").trim() || (window.adminPendingBatchChannel ? window.adminPendingBatchChannel.channelTitle : "") || "";
    var normCh = chName.toLowerCase();

    var isCurrentlyBanned = Array.isArray(bannedChannels) && bannedChannels.some(function(b) {
      var nb = String(b || "").trim().toLowerCase();
      return nb && normCh && (nb === normCh || nb.indexOf(normCh) !== -1 || normCh.indexOf(nb) !== -1);
    });

    if (isCurrentlyBanned) {
      if (!window.isStrictlyMainSuperAdmin()) {
        alert("🚫 This channel is banned by the Main Super Admin. Monitors or other users cannot re-add it.");
        return;
      }
      // Main Super Admin is adding it -> automatically unban and unblock its videos!
      var pendingIds = (window.adminPendingBatchChannel && Array.isArray(window.adminPendingBatchChannel.videoIds))
        ? window.adminPendingBatchChannel.videoIds
        : [];
      window.superAdminCleanChannelBanRecord(chName, pendingIds);
      if (typeof showSyncToast === "function") {
        showSyncToast("🔓 Main Super Admin Override: Unbanned '" + chName + "' and importing now...");
      }
    } else if (window.isStrictlyMainSuperAdmin()) {
      // Even if channel name wasn't in bannedChannels, make sure none of the incoming video IDs are stuck in blockedVideoIds!
      var batchIds = (window.adminPendingBatchChannel && Array.isArray(window.adminPendingBatchChannel.videoIds))
        ? window.adminPendingBatchChannel.videoIds
        : [];
      var urlInp = document.getElementById("adminYtUrlInput");
      var singleId = (typeof extractYouTubeId === "function" && urlInp) ? extractYouTubeId(urlInp.value) : null;
      if (singleId) batchIds = batchIds.concat([singleId]);
      if (batchIds.length > 0) {
        window.superAdminCleanChannelBanRecord(chName, batchIds);
      }
    }

    if (origAdminAddGlobalVideo) {
      origAdminAddGlobalVideo();
    }

    // After origAdminAddGlobalVideo finishes, ensure none of the newly added videos of this channel are in blockedVideoIds
    if (window.isStrictlyMainSuperAdmin() && chName) {
      setTimeout(function() {
        window.superAdminCleanChannelBanRecord(chName, []);
        if (typeof window.renderVideosNow === "function") window.renderVideosNow();
        if (typeof window.renderAdminActiveVideosCatalog === "function") window.renderAdminActiveVideosCatalog();
      }, 300);
    }
  };

  // 4. Hide the "Banned Channels (Click to Unban)" box from Monitors so only Main Super Admin can unban
  var origRenderCatalog = window.renderAdminActiveVideosCatalog;
  if (typeof origRenderCatalog === "function") {
    window.renderAdminActiveVideosCatalog = function() {
      origRenderCatalog();
      var bannedBox = document.getElementById("adminBannedChannelsBox");
      if (bannedBox && !window.isStrictlyMainSuperAdmin()) {
        bannedBox.classList.add("hidden");
      }
    };
  }
})();
// === QAAF V19 SUPER ADMIN UNBAN & RE-ADD CHANNEL OVERRIDE END ===

// === QAAF V21 SLEEK GAMES ZONE & REAL QURANIC GAMES START ===
(function initQaafSleekGamesZoneAndRealQuranicGames() {
  window.activeGamesSubTab = "qaaf_games"; // 'qaaf_games' | 'quranic' | '3d_games'

  // Define the REAL Games Catalog (4 QAAF 2D Games + 4 REAL Quranic Games from "Qaaf quran Games" folder + Empty 3D Games)
  var REAL_GAMES_CATALOG = [
    // 1. QAAF Games (Simple 2D Games)
    {
      id: "g1",
      categoryGroup: "qaaf_games",
      title: "Islamic Quiz Adventure",
      icon: "🕋",
      launchUrl: "./qaaf-games.html?game=g1"
    },
    {
      id: "g2",
      categoryGroup: "qaaf_games",
      title: "Arabic Alphabet Puzzle",
      icon: "🔤",
      launchUrl: "./qaaf-games.html?game=g2"
    },
    {
      id: "g3",
      categoryGroup: "qaaf_games",
      title: "Halal Word Builder",
      icon: "🧩",
      launchUrl: "./qaaf-games.html?game=g3"
    },
    {
      id: "g4",
      categoryGroup: "qaaf_games",
      title: "Prophets Timeline Match",
      icon: "🌟",
      launchUrl: "./qaaf-games.html?game=g4"
    },

    // 2. QAAF Quranic Games (Connected directly to K:\Qaaf Tube\Qaaf quran Games\)
    {
      id: "qg_hub",
      categoryGroup: "quranic",
      title: "QAAF Quranic Games Hub (قرآنی گیمز ہب)",
      icon: "📖",
      launchUrl: "./Qaaf%20quran%20Games/qaaf-Quran-games.html"
    },
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
    // 3. QAAF 3D Games: kept empty while under development
  ];

  if (typeof gamesCatalog !== "undefined" && Array.isArray(gamesCatalog)) {
    gamesCatalog.length = 0;
    REAL_GAMES_CATALOG.forEach(function(g) { gamesCatalog.push(g); });
  }
  window.gamesCatalog = REAL_GAMES_CATALOG;

  // Ensure installedGameIds is loaded
  if (typeof installedGameIds === "undefined" || !Array.isArray(installedGameIds)) {
    window.installedGameIds = JSON.parse(localStorage.getItem("qaaf_installed_games") || '["g1","qg_hub","qg_01","qg_02","qg_03"]');
  }

  // 1. FIX HEADER VIDEOS vs GAMES RED BUTTON + HIDE SEARCH & CATEGORY BAR WHEN IN GAMES
  function updateHeaderTabsAndTopBarsForMode(tab) {
    var tV = document.getElementById("tabVideosBtn");
    var tG = document.getElementById("tabGamesBtn");
    var vSec = document.getElementById("videosSection");
    var gSec = document.getElementById("gamesSection");
    var catBar = document.getElementById("categoryBar");
    var catBarStickyWrap = catBar ? catBar.parentElement : null;
    var searchBarWrap = document.getElementById("qaafTopSearchAndBellBar");
    var searchInp = document.getElementById("qaafSearchInput");
    var reqBellBtn = document.getElementById("qaafNotifBellBtn");

    if (tab === "games") {
      if (vSec) vSec.classList.add("hidden");
      if (gSec) gSec.classList.remove("hidden");

      // Make Games button RED and Videos button transparent
      if (tG) {
        tG.className = "px-2.5 sm:px-3.5 py-1 rounded-full text-xs font-extrabold text-white shadow flex items-center gap-1 transition cursor-pointer";
        tG.style.setProperty("background", "#e11d48", "important");
        tG.style.setProperty("color", "#ffffff", "important");
      }
      if (tV) {
        tV.className = "px-2.5 sm:px-3.5 py-1 rounded-full text-xs font-extrabold text-slate-300 hover:text-white flex items-center gap-1 transition cursor-pointer";
        tV.style.setProperty("background", "transparent", "important");
        tV.style.setProperty("color", "#cbd5e1", "important");
        tV.style.setProperty("box-shadow", "none", "important");
      }

      // Hide Category Bar, Search Bar & Video Request button so Games Zone is right at the top!
      if (catBarStickyWrap) catBarStickyWrap.classList.add("hidden");
      if (searchBarWrap) searchBarWrap.classList.add("hidden");
      if (searchInp && searchInp.closest("div.mb-4, div.space-y-2")) {
        searchInp.closest("div.mb-4, div.space-y-2").classList.add("hidden");
      }
      if (reqBellBtn && reqBellBtn.parentElement && reqBellBtn.parentElement.id !== "headerRightControls") {
        reqBellBtn.parentElement.classList.add("hidden");
      }
    } else {
      if (gSec) gSec.classList.add("hidden");
      if (vSec) vSec.classList.remove("hidden");

      // Make Videos button RED and Games button transparent
      if (tV) {
        tV.className = "px-2.5 sm:px-3.5 py-1 rounded-full text-xs font-extrabold text-white shadow flex items-center gap-1 transition cursor-pointer";
        tV.style.setProperty("background", "#e11d48", "important");
        tV.style.setProperty("color", "#ffffff", "important");
      }
      if (tG) {
        tG.className = "px-2.5 sm:px-3.5 py-1 rounded-full text-xs font-extrabold text-slate-300 hover:text-white flex items-center gap-1 transition cursor-pointer";
        tG.style.setProperty("background", "transparent", "important");
        tG.style.setProperty("color", "#cbd5e1", "important");
        tG.style.setProperty("box-shadow", "none", "important");
      }

      // Show Category Bar, Search Bar & Video Request button again in Videos mode
      if (catBarStickyWrap) catBarStickyWrap.classList.remove("hidden");
      if (searchBarWrap) searchBarWrap.classList.remove("hidden");
      if (searchInp && searchInp.closest("div.mb-4, div.space-y-2")) {
        searchInp.closest("div.mb-4, div.space-y-2").classList.remove("hidden");
      }
      if (reqBellBtn && reqBellBtn.parentElement && reqBellBtn.parentElement.id !== "headerRightControls") {
        reqBellBtn.parentElement.classList.remove("hidden");
      }
    }
  }

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

  // 2. SLEEK MINIMAL 1-LINE GAMES RENDERER
  window.renderGames = function() {
    var grid = document.getElementById("gamesGrid");
    if (!grid) return;

    var curTab = window.activeGamesSubTab || "qaaf_games";
    var countQaaf = REAL_GAMES_CATALOG.filter(function(g) { return g.categoryGroup === "qaaf_games"; }).length;
    var countQuran = REAL_GAMES_CATALOG.filter(function(g) { return g.categoryGroup === "quranic"; }).length;
    var count3D = REAL_GAMES_CATALOG.filter(function(g) { return g.categoryGroup === "3d_games"; }).length;

    var navHtml =
      '<div class="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-2 mb-1">' +
        '<button type="button" onclick="selectGamesSubTab(\'qaaf_games\')" class="p-3 rounded-2xl border-2 text-left transition flex items-center justify-between cursor-pointer ' +
          (curTab === "qaaf_games" ? "bg-emerald-600/25 border-emerald-400 text-white shadow-lg" : "bg-[#12161f] border-slate-800 text-slate-300 hover:border-slate-700") + '">' +
          '<div class="flex items-center gap-2.5 min-w-0"><span class="text-2xl shrink-0">🎮</span><div class="truncate"><div class="text-xs sm:text-sm font-extrabold truncate">1. QAAF Games</div><div class="text-[10px] text-slate-400 truncate">Simple Puzzles, Quiz &amp; Builder</div></div></div>' +
          '<span class="bg-black/50 px-2.5 py-1 rounded-full text-[10px] font-extrabold text-emerald-300 shrink-0">' + countQaaf + ' Games</span>' +
        '</button>' +

        '<button type="button" onclick="selectGamesSubTab(\'quranic\')" class="p-3 rounded-2xl border-2 text-left transition flex items-center justify-between cursor-pointer ' +
          (curTab === "quranic" ? "bg-amber-500/25 border-amber-400 text-white shadow-lg" : "bg-[#12161f] border-slate-800 text-slate-300 hover:border-slate-700") + '">' +
          '<div class="flex items-center gap-2.5 min-w-0"><span class="text-2xl shrink-0">📖</span><div class="truncate"><div class="text-xs sm:text-sm font-extrabold truncate">2. QAAF Quranic Games</div><div class="text-[10px] text-slate-400 truncate">Ayah-by-Ayah Interactive Games</div></div></div>' +
          '<span class="bg-black/50 px-2.5 py-1 rounded-full text-[10px] font-extrabold text-amber-300 shrink-0">' + countQuran + ' Games</span>' +
        '</button>' +

        '<button type="button" onclick="selectGamesSubTab(\'3d_games\')" class="p-3 rounded-2xl border-2 text-left transition flex items-center justify-between cursor-pointer ' +
          (curTab === "3d_games" ? "bg-blue-600/25 border-blue-400 text-white shadow-lg" : "bg-[#12161f] border-slate-800 text-slate-300 hover:border-slate-700") + '">' +
          '<div class="flex items-center gap-2.5 min-w-0"><span class="text-2xl shrink-0">🏎️</span><div class="truncate"><div class="text-xs sm:text-sm font-extrabold truncate">3. QAAF 3D Games</div><div class="text-[10px] text-slate-400 truncate">3D Adventures for Older Kids</div></div></div>' +
          (count3D > 0 ? ('<span class="bg-black/50 px-2.5 py-1 rounded-full text-[10px] font-extrabold text-blue-300 shrink-0">' + count3D + ' Games</span>') : '<span class="bg-black/40 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500 shrink-0">Soon</span>') +
        '</button>' +
      '</div>';

    var filteredGames = REAL_GAMES_CATALOG.filter(function(g) { return g.categoryGroup === curTab; });

    var cardsHtml = "";
    filteredGames.forEach(function(g) {
      var isInstalled = Array.isArray(installedGameIds) && installedGameIds.indexOf(g.id) !== -1;

      // Sleek minimal 1-line bar: Big clear Logo + Single-line Title.
      // If NOT installed: Install button below. Once installed: Install button disappears completely & tapping row plays the game!
      cardsHtml +=
        '<div onclick="' + (isInstalled ? ("openInstalledGameModal('" + g.id + "')") : ("installQaafGameInstant('" + g.id + "', event)")) + '" class="bg-[#121822] hover:bg-[#182232] border ' + (isInstalled ? 'border-emerald-500/45 shadow-md' : 'border-slate-800') + ' rounded-2xl px-3.5 py-2.5 transition cursor-pointer group flex flex-col justify-center">' +
          '<div class="flex items-center justify-between gap-3">' +
            '<div class="flex items-center gap-3 min-w-0 flex-1">' +
              '<div class="w-11 h-11 rounded-xl bg-slate-800/90 border border-white/10 flex items-center justify-center text-2xl shrink-0 shadow group-hover:scale-105 transition">' +
                g.icon +
              '</div>' +
              '<h3 class="text-sm sm:text-base font-extrabold text-white truncate group-hover:text-emerald-300 transition">' +
                g.title +
              '</h3>' +
            '</div>' +
            (isInstalled ? (
              '<div class="flex items-center gap-1.5 shrink-0">' +
                '<span class="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-black flex items-center justify-center text-xs font-extrabold transition">▶</span>' +
              '</div>'
            ) : '') +
          '</div>' +
          (!isInstalled ? (
            '<button type="button" onclick="installQaafGameInstant(\'' + g.id + '\', event)" class="mt-2.5 w-full bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded-xl text-xs font-extrabold shadow transition cursor-pointer">' +
              '⬇️ Install Game' +
            '</button>'
          ) : '') +
        '</div>';
    });

    grid.innerHTML = navHtml + cardsHtml;
  };

  // 3. LAUNCH EXACT REAL GAME FILE WHEN CLICKED
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
        '<div class="h-12 bg-[#11151e] border-b border-emerald-500/30 px-3 sm:px-5 flex items-center justify-between shrink-0">' +
          '<div class="flex items-center gap-2 min-w-0">' +
            '<span id="activeGameModalIcon" class="text-lg">🎮</span>' +
            '<h3 id="activeGameModalTitle" class="text-xs sm:text-sm font-extrabold text-white truncate">QAAF Islamic Game</h3>' +
          '</div>' +
          '<button type="button" onclick="closeInstalledGameModal()" class="bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1 rounded-full text-xs font-extrabold shadow cursor-pointer">' +
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

  if (typeof currentActiveKidsTab !== "undefined" && currentActiveKidsTab === "games") {
    updateHeaderTabsAndTopBarsForMode("games");
    window.renderGames();
  }
})();
// === QAAF V21 SLEEK GAMES ZONE & REAL QURANIC GAMES END ===

// === QAAF V22 SMART CHANNEL & SEARCH AUTO-FETCHER START ===
(function initQaafSmartChannelAndSearchFetcher() {
  // Helper: Fetch text/HTML from a YouTube URL using multiple fallback methods (Jina HTML -> Jina Text -> AllOrigins -> CodeTabs)
  async function fetchYouTubePageResilient(targetUrl) {
    var combinedText = "";
    try {
      var r1 = await fetch("https://r.jina.ai/" + targetUrl, {
        headers: { "Accept": "application/json", "X-Return-Format": "html" }
      });
      if (r1.ok) {
        var j1 = await r1.json();
        if (j1 && j1.data && j1.data.html) combinedText += "\n" + j1.data.html;
      }
    } catch (e) {}

    if (combinedText.length < 200) {
      try {
        var r2 = await fetch("https://r.jina.ai/" + targetUrl);
        if (r2.ok) {
          combinedText += "\n" + (await r2.text());
        }
      } catch (e) {}
    }

    if (combinedText.length < 200) {
      var proxies = [
        "https://api.allorigins.win/raw?url=" + encodeURIComponent(targetUrl),
        "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(targetUrl)
      ];
      for (var i = 0; i < proxies.length; i++) {
        try {
          var rp = await fetch(proxies[i]);
          if (rp.ok) {
            combinedText += "\n" + (await rp.text());
            if (combinedText.length > 500) break;
          }
        } catch (e) {}
      }
    }
    return combinedText;
  }

  function extractUniqueVideoIdsFromText(rawText) {
    var ids = [];
    if (!rawText) return ids;
    var regexes = [
      /watch\?v=([a-zA-Z0-9_-]{11})/g,
      /\/shorts\/([a-zA-Z0-9_-]{11})/g,
      /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g,
      /ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})\//g
    ];
    regexes.forEach(function(rgx) {
      var matches = rawText.matchAll(rgx);
      for (var m of matches) {
        var id = m[1];
        if (id && ids.indexOf(id) === -1) ids.push(id);
      }
    });
    return ids;
  }

  // Upgrade window.adminAutoFetchYouTubeInfo so if a channel handle fails or a Channel Name like "Nahd Digital" is entered,
  // it automatically searches YouTube to find the real channel handle and its videos!
  window.adminAutoFetchYouTubeInfo = async function() {
    var urlInp = document.getElementById("adminYtUrlInput");
    var chNameInp = document.getElementById("adminChannelName");
    var raw = (urlInp ? urlInp.value : "").trim();
    var chHint = (chNameInp ? chNameInp.value : "").trim();

    if (!raw && chHint) {
      raw = chHint;
      if (urlInp) urlInp.value = chHint;
    }

    if (!raw) {
      alert("Please paste a YouTube Link or Channel Name first.");
      return;
    }

    // Check if it's a single 11-char video link (and not a channel/playlist)
    var isPlaylist = raw.indexOf("list=") !== -1;
    var singleVidId = (!isPlaylist && raw.indexOf("/@") === -1 && raw.indexOf("/channel/") === -1 && raw.indexOf("/c/") === -1)
      ? (typeof extractYouTubeId === "function" ? extractYouTubeId(raw) : null)
      : null;

    if (singleVidId) {
      if (typeof showSyncToast === "function") showSyncToast("⏳ Fetching video details...");
      try {
        var r = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + singleVidId);
        var d = await r.json();
        if (d && d.title) {
          document.getElementById("adminVideoTitle").value = d.title;
          document.getElementById("adminChannelName").value = d.author_name || "Islamic Channel";
          document.getElementById("adminPreviewThumb").src = "https://i.ytimg.com/vi/" + singleVidId + "/hqdefault.jpg";
          document.getElementById("adminPreviewTitleText").innerText = d.title;
          document.getElementById("adminPreviewChannelText").innerText = d.author_name || "YouTube";
          document.getElementById("adminYtPreviewContainer").classList.remove("hidden");
          window.adminPendingBatchChannel = null;
          if (typeof autoDetectAndSelectLanguage === "function") autoDetectAndSelectLanguage(d.title + " " + (d.author_name || ""), "adminVideoLang");
          if (typeof autoDetectCategoryAndMode === "function") autoDetectCategoryAndMode(d.title, d.author_name || "");
          if (typeof showSyncToast === "function") showSyncToast("✅ Video fetched & ready!");
          return;
        }
      } catch (e) {}
    }

    // Channel or Playlist or Channel Name Search!
    if (typeof showSyncToast === "function") {
      showSyncToast("⏳ Finding channel & public videos on YouTube...");
    }

    var foundIds = [];
    var shortIdSet = new Set();
    var detectedChannelTitle = chHint || "";
    var realChannelUrl = "";

    // Stage 1: If it looks like a URL or @Handle, try direct channel /videos first
    if (raw.indexOf("http") === 0 || raw.indexOf("@") === 0 || raw.indexOf("youtube.com") !== -1) {
      var cleanUrl = raw.indexOf("http") === 0 ? raw : ("https://www.youtube.com/" + (raw.indexOf("@") === 0 ? raw : ("@" + raw)));
      if (isPlaylist) {
        var plText = await fetchYouTubePageResilient(cleanUrl);
        foundIds = extractUniqueVideoIdsFromText(plText);
      } else {
        var baseCh = cleanUrl.replace(/\/(videos|shorts|featured|streams|playlists)?\/?$/, "");
        var vidsText = await fetchYouTubePageResilient(baseCh + "/videos");
        foundIds = extractUniqueVideoIdsFromText(vidsText);
        if (foundIds.length > 0) {
          realChannelUrl = baseCh;
          // Also check shorts lightly
          var shText = await fetchYouTubePageResilient(baseCh + "/shorts");
          var shIds = extractUniqueVideoIdsFromText(shText);
          shIds.forEach(function(sid) {
            shortIdSet.add(sid);
            if (foundIds.indexOf(sid) === -1) foundIds.push(sid);
          });
        }
      }
    }

    // Stage 2: SMART YOUTUBE SEARCH FALLBACK!
    // If direct handle failed (e.g., "@NahdDigital" wasn't the exact handle for "Nahd Digital"),
    // search YouTube by the channel name to discover the real @Handle / channel URL and its videos!
    if (foundIds.length === 0) {
      var searchQuery = chHint || raw.replace(/^https?:\/\/(www\.)?youtube\.com\/@?/i, "").replace(/\/.*$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
      if (typeof showSyncToast === "function") {
        showSyncToast("🔍 Searching YouTube for '" + searchQuery + "' channel...");
      }

      var searchUrl = "https://www.youtube.com/results?search_query=" + encodeURIComponent(searchQuery + " channel");
      var searchHtml = await fetchYouTubePageResilient(searchUrl);

      // Look for channel handles (@...) or /channel/UC... in the search results
      var handleMatches = Array.from(searchHtml.matchAll(/youtube\.com\/(@[a-zA-Z0-9_.-]+)/g)).map(function(m) { return m[1]; });
      var ucMatches = Array.from(searchHtml.matchAll(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/g)).map(function(m) { return m[1]; });
      var searchVidIds = extractUniqueVideoIdsFromText(searchHtml);

      // Use the first search video ID with noembed.com to get the exact official author_url of the channel!
      for (var sIdx = 0; sIdx < Math.min(searchVidIds.length, 6); sIdx++) {
        try {
          var rOe = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + searchVidIds[sIdx]);
          var dOe = await rOe.json();
          if (dOe && dOe.author_url) {
            var aName = (dOe.author_name || "").toLowerCase();
            var qLower = searchQuery.toLowerCase();
            if (aName.indexOf(qLower) !== -1 || qLower.indexOf(aName) !== -1 || sIdx === 0) {
              realChannelUrl = dOe.author_url.replace(/\/+$/, "");
              detectedChannelTitle = dOe.author_name || detectedChannelTitle;
              break;
            }
          }
        } catch (e) {}
      }

      if (!realChannelUrl && handleMatches.length > 0) {
        realChannelUrl = "https://www.youtube.com/" + handleMatches[0];
      } else if (!realChannelUrl && ucMatches.length > 0) {
        realChannelUrl = "https://www.youtube.com/channel/" + ucMatches[0];
      }

      if (realChannelUrl) {
        if (urlInp) urlInp.value = realChannelUrl;
        var chVidsHtml = await fetchYouTubePageResilient(realChannelUrl + "/videos");
        foundIds = extractUniqueVideoIdsFromText(chVidsHtml);
      }

      // If channel page still didn't return IDs, use the verified search video IDs!
      if (foundIds.length === 0 && searchVidIds.length > 0) {
        foundIds = searchVidIds;
      }
    }

    if (foundIds.length === 0) {
      alert("⚠️ Could not find public videos for that channel. Please paste any single video link from that channel and click Auto-Fetch!");
      return;
    }

    var cappedIds = foundIds.slice(0, 150);
    var firstId = cappedIds[0];

    try {
      var rFirst = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + firstId);
      var dFirst = await rFirst.json();
      var finalChannelName = (dFirst && dFirst.author_name) ? dFirst.author_name : (detectedChannelTitle || "Islamic Channel");
      var firstTitle = (dFirst && dFirst.title) ? dFirst.title : (finalChannelName + " Videos");

      if (dFirst && dFirst.author_url && urlInp) {
        urlInp.value = dFirst.author_url;
      }

      document.getElementById("adminVideoTitle").value = firstTitle;
      document.getElementById("adminChannelName").value = finalChannelName;
      document.getElementById("adminPreviewThumb").src = "https://i.ytimg.com/vi/" + firstId + "/hqdefault.jpg";
      document.getElementById("adminPreviewTitleText").innerText = finalChannelName + " — " + cappedIds.length + " Videos Ready to Import";
      document.getElementById("adminPreviewChannelText").innerText = finalChannelName;
      document.getElementById("adminYtPreviewContainer").classList.remove("hidden");

      window.adminPendingBatchChannel = {
        channelTitle: finalChannelName,
        videoIds: cappedIds,
        shortIds: Array.from(shortIdSet),
        firstTitle: firstTitle
      };

      if (typeof autoDetectAndSelectLanguage === "function") autoDetectAndSelectLanguage(firstTitle + " " + finalChannelName, "adminVideoLang");
      if (typeof autoDetectCategoryAndMode === "function") autoDetectCategoryAndMode(firstTitle, finalChannelName);

      if (typeof showSyncToast === "function") {
        showSyncToast("✅ Found " + cappedIds.length + " videos from '" + finalChannelName + "'! Click '+ Push Live' or '📂 Fetch Playlists'.");
      }
    } catch (e) {}
  };
})();
// === QAAF V22 SMART CHANNEL & SEARCH AUTO-FETCHER END ===
