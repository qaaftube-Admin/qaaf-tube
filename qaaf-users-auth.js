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
  window.qaafChannelActiveSubTab = "videos"; // 'videos' | 'shorts' | 'playlists'
  window.qaafChannelSelectedPlaylistTitle = null;

  var CHANNEL_UI_LABELS = {
    en: { backAll: "⬅️ All Channels", tabVideos: "🎬 Videos", tabShorts: "⚡ Shorts", tabPlaylists: "📂 Playlists", verifiedCh: "Verified Islamic Channel", singleVidCh: "Selected Videos Channel", videosCount: "Videos", openPl: "▶ Open Playlist", backPl: "⬅️ Back to All Playlists", noShorts: "No Shorts in this channel yet.", noPlaylists: "No Playlists found in this channel." },
    ur: { backAll: "⬅️ تمام چینلز", tabVideos: "🎬 ویڈیوز", tabShorts: "⚡ شارٹس", tabPlaylists: "📂 پلے لسٹس", verifiedCh: "تصدیق شدہ اسلامی چینل", singleVidCh: "منتخب ویڈیوز والا چینل", videosCount: "ویڈیوز", openPl: "▶ پلے لسٹ کھولیں", backPl: "⬅️ تمام پلے لسٹس پر واپس", noShorts: "اس چینل میں ابھی کوئی شارٹس نہیں ہیں۔", noPlaylists: "اس چینل میں ابھی کوئی پلے لسٹ نہیں ہے۔" },
    ar: { backAll: "⬅️ جميع القنوات", tabVideos: "🎬 الفيديوهات", tabShorts: "⚡ المقاطع القصيرة", tabPlaylists: "📂 قوائم التشغيل", verifiedCh: "قناة إسلامية موثقة", singleVidCh: "قناة فيديوهات مختارة", videosCount: "فيديو", openPl: "▶ فتح القائمة", backPl: "⬅️ العودة لقوائم التشغيل", noShorts: "لا توجد مقاطع قصيرة في هذه القناة.", noPlaylists: "لا توجد قوائم تشغيل في هذه القناة." },
    hi: { backAll: "⬅️ सभी चैनल", tabVideos: "🎬 वीडियो", tabShorts: "⚡ शॉर्ट्स", tabPlaylists: "📂 प्लेलिस्ट", verifiedCh: "सत्यापित इस्लामी चैनल", singleVidCh: "चयनित वीडियो चैनल", videosCount: "वीडियो", openPl: "▶ प्लेलिस्ट खोलें", backPl: "⬅️ सभी प्लेलिस्ट पर वापस", noShorts: "इस चैनल में अभी कोई शॉर्ट्स नहीं हैं।", noPlaylists: "इस चैनल में कोई प्लेलिस्ट नहीं है।" },
    bn: { backAll: "⬅️ সব চ্যানেল", tabVideos: "🎬 ভিডিও", tabShorts: "⚡ শর্টস", tabPlaylists: "📂 প্লেলিস্ট", verifiedCh: "যাচাইকৃত ইসলামিক চ্যানেল", singleVidCh: "নির্বাচিত ভিডিও চ্যানেল", videosCount: "ভিডিও", openPl: "▶ প্লেলিস্ট খুলুন", backPl: "⬅️ সব প্লেলিস্টে ফিরে যান", noShorts: "এই চ্যানেলে কোনো শর্টস নেই।", noPlaylists: "এই চ্যানেলে কোনো প্লেলিস্ট নেই।" }
  };

  function getChLabels() {
    var code = window.currentAppUILang || localStorage.getItem("qaaf_ui_display_lang") || "en";
    return CHANNEL_UI_LABELS[code] || CHANNEL_UI_LABELS.en;
  }

  // 1. SMART YOUTUBE-STYLE DIVERSE FEED ALGORITHM (INTERLEAVES CHANNELS + PERSONALIZES BY FAVORITES & HISTORY)
  window.buildSmartYouTubeDiverseFeed = function(videoList) {
    if (!Array.isArray(videoList) || videoList.length <= 1) return videoList || [];

    var prefLang = String(window.preferredContentLang || preferredContentLang || "en").toLowerCase();
    var favSet = new Set(typeof favoriteVideoIds !== "undefined" ? favoriteVideoIds : []);
    var histList = (typeof getActiveHistory === "function") ? (getActiveHistory() || []) : [];
    var histSet = new Set(histList);

    // Discover user's favorite channels and categories from their Favorites and Watch History
    var likedChannels = new Set();
    var likedCategories = new Set();
    videoList.forEach(function(v) {
      if (!v) return;
      if (favSet.has(v.id) || histSet.has(v.id)) {
        if (v.channel) likedChannels.add(v.channel);
        if (v.category) likedCategories.add(v.category);
      }
    });

    // Score each video individually
    var scored = videoList.map(function(v, idx) {
      var s = 0;
      var vLang = String(v.lang || "global").toLowerCase();
      if (vLang === prefLang) s += 120;
      else if (vLang === "global" || v.universalQuran) s += 60;

      if (v.channel && likedChannels.has(v.channel)) s += 35;
      if (v.category && likedCategories.has(v.category)) s += 20;
      if (favSet.has(v.id)) s += 25;
      // Slightly lower score for already-watched videos so fresh unwatched videos from favorite channels appear first
      if (histSet.has(v.id)) s -= 18;

      if (isKidsLocked) {
        if (v.category === "kids_cartoon" || v.category === "kids_tarbiyah") s += 30;
      } else {
        if (v.category === "bayan" || v.category === "quran" || v.category === "tarbiyah") s += 25;
      }

      // Freshness bonus for newly uploaded videos
      var createdBonus = Math.min(30, Math.max(0, ((v.createdAt || 0) - 1700000000) / 10000000));
      s += createdBonus;

      return { video: v, score: s, origIdx: idx };
    });

    // Group by Channel so no single channel floods the screen
    var channelBuckets = new Map();
    scored.forEach(function(item) {
      var ch = (item.video && item.video.channel) ? item.video.channel : "General";
      if (!channelBuckets.has(ch)) channelBuckets.set(ch, []);
      channelBuckets.get(ch).push(item);
    });

    // Sort videos inside each channel bucket: newest / highest scored first
    var bucketList = [];
    channelBuckets.forEach(function(items, chName) {
      items.sort(function(a, b) {
        if (Math.abs(b.score - a.score) > 5) return b.score - a.score;
        return ((b.video.createdAt || 0) - (a.video.createdAt || 0)) || (a.origIdx - b.origIdx);
      });
      var topScore = items[0] ? items[0].score : 0;
      var newestTs = items[0] ? (items[0].video.createdAt || 0) : 0;
      bucketList.push({
        channel: chName,
        items: items,
        topScore: topScore,
        newestTs: newestTs
      });
    });

    // Order channels so the newly added / preferred language channels lead the first round
    bucketList.sort(function(a, b) {
      if (Math.abs(b.topScore - a.topScore) > 15) return b.topScore - a.topScore;
      return b.newestTs - a.newestTs;
    });

    // Round-Robin Interleaving: Pick 1 video from each channel per round!
    // This guarantees that when a new channel is uploaded, its #1 video appears at the top,
    // followed immediately by videos from all other channels (never repeating the same channel back-to-back!)
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

  // 2. AUTO-DETECT & GROUP CHANNEL PLAYLISTS (FROM EXPLICIT PLAYLIST TAGS OR SERIES PATTERNS IN TITLES)
  function buildChannelPlaylistsGroups(channelVideos) {
    var groupsMap = new Map();

    channelVideos.forEach(function(v) {
      if (!v) return;
      var plName = (v.playlistName || v.playlistTitle || "").trim();

      if (!plName) {
        var t = (v.title || "").trim();
        // Extract clean series / playlist name from common YouTube title separators (|, —, -, :)
        var parts = t.split(/\s*(?:\||—|–|-|:)\s*/);
        if (parts.length >= 2 && parts[0].length >= 4 && parts[0].length <= 42 && !/^(ep|episode|part|clip|short)/i.test(parts[0])) {
          plName = parts[0].trim();
        } else if (parts.length >= 2 && parts[parts.length - 1].length >= 4 && parts[parts.length - 1].length <= 40 && !/^(ep|episode|part|hd|full)/i.test(parts[parts.length - 1])) {
          plName = parts[parts.length - 1].replace(/#\w+/g, "").trim();
        }
      }

      if (!plName) {
        // Fallback by category/type
        if (v.category === "quran") plName = "Tilawat & Quran Series";
        else if (v.category === "naat") plName = "Vocal Naat Collection";
        else if (v.category === "kids_cartoon") plName = "Kids Cartoon Series";
        else if (v.category === "kids_tarbiyah" || v.category === "stories") plName = "Stories & Kids Tarbiyah";
        else if (v.category === "bayan") plName = "Islamic Bayanat Series";
        else plName = "General Uploads";
      }

      if (!groupsMap.has(plName)) {
        groupsMap.set(plName, []);
      }
      groupsMap.get(plName).push(v);
    });

    var playlistsArr = [];
    groupsMap.forEach(function(vids, title) {
      playlistsArr.push({
        title: title,
        videos: vids,
        thumb: (vids[0] && (vids[0].customThumb || ("https://i.ytimg.com/vi/" + vids[0].ytId + "/hqdefault.jpg"))) || ""
      });
    });

    // Sort playlists with multiple videos first
    playlistsArr.sort(function(a, b) { return b.videos.length - a.videos.length; });
    return playlistsArr;
  }

  // 3. YOUTUBE-STYLE CHANNEL HEADER & TABS (VIDEOS / SHORTS / PLAYLISTS)
  window.switchQaafChannelSubTab = function(subTab) {
    window.qaafChannelActiveSubTab = subTab || "videos";
    window.qaafChannelSelectedPlaylistTitle = null;
    window.qaafGridPageLimit = 24;
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
  };

  window.openQaafChannelPlaylist = function(plTitle) {
    window.qaafChannelActiveSubTab = "playlists";
    window.qaafChannelSelectedPlaylistTitle = plTitle;
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
  };

  window.exitQaafChannelView = function() {
    window.qaafSelectedChannel = "ALL";
    window.qaafChannelActiveSubTab = "videos";
    window.qaafChannelSelectedPlaylistTitle = null;
    window.qaafGridPageLimit = 24;
    if (typeof window.renderVideosNow === "function") window.renderVideosNow();
  };

  // Make clicking a channel name on any card open that channel's page
  var origPickCh = window.pickChannelFromTopBar;
  window.pickChannelFromTopBar = function(chName, ev) {
    window.qaafChannelActiveSubTab = "videos";
    window.qaafChannelSelectedPlaylistTitle = null;
    if (origPickCh) origPickCh(chName, ev);
  };

  // Override executeFastUnifiedRender / renderVideosNow to integrate Smart Feed Mixing + Channel Tabs UI
  var baseFastRender = window.renderVideosNow;
  window.renderVideosNow = function() {
    var selCh = window.qaafSelectedChannel || "ALL";
    var rawSearch = (window.qaafActiveSearchQuery || "").trim();
    var isSpecialSort = (currentSortFilter === "playlist" || currentSortFilter === "history" || currentSortFilter === "favorites" || currentSortFilter === "recent" || currentSortFilter === "viewed");

    // A. If on Home / Category Feed (ALL Channels, Default Smart Feed), apply Smart YouTube Diverse Mixer!
    var originalVideosOrder = null;
    if (selCh === "ALL" && !rawSearch && !isSpecialSort && Array.isArray(videosData) && videosData.length > 1) {
      originalVideosOrder = videosData.slice();
      var mixed = window.buildSmartYouTubeDiverseFeed(videosData);
      for (var i = 0; i < mixed.length; i++) videosData[i] = mixed[i];
    }

    if (baseFastRender) baseFastRender();

    // Restore raw array reference if needed
    if (originalVideosOrder) {
      for (var j = 0; j < originalVideosOrder.length; j++) videosData[j] = originalVideosOrder[j];
    }

    // Make channel names on video cards clickable so user can open the channel directly
    document.querySelectorAll("#videoGrid > div").forEach(function(card) {
      var chSpan = card.querySelector(".p-3 .flex.items-center.justify-between > span:first-child");
      if (chSpan && !chSpan.dataset.chClickable) {
        chSpan.dataset.chClickable = "1";
        var vidId = card.dataset.videoId;
        var vObj = (videosData || []).find(function(x) { return x.id === vidId; });
        if (vObj && vObj.channel) {
          chSpan.classList.add("hover:text-emerald-400", "hover:underline", "cursor-pointer");
          chSpan.title = "Open Channel: " + vObj.channel;
          chSpan.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.pickChannelFromTopBar(vObj.channel, e);
            window.scrollTo({ top: 0, behavior: "smooth" });
          };
        }
      }
    });

    // B. Manage YouTube-Style Channel Header & Tabs when a specific Channel is selected
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
    var chAllVids = (videosData || []).filter(function(v) {
      return v && v.channel === selCh && !blockedSet.has(v.id) && (!isKidsLocked || v.kidsSafe);
    });
    var chRegVids = chAllVids.filter(function(v) { return !isVideoShort(v); });
    var chShortVids = chAllVids.filter(function(v) { return isVideoShort(v); });
    var chPlaylists = buildChannelPlaylistsGroups(chAllVids);
    var isVer = (typeof window.isChannelFullyVerified === "function") && window.isChannelFullyVerified(selCh, chAllVids[0]);
    var activeTab = window.qaafChannelActiveSubTab || "videos";

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

      '<!-- YOUTUBE-STYLE CHANNEL TABS: VIDEOS | SHORTS | PLAYLISTS -->' +
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
          '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-black/25">' + chPlaylists.length + '</span>' +
        '</button>' +
      '</div>';

    chBanner.classList.remove("hidden");

    // Handle the 3 Channel Sub-Tabs:
    if (activeTab === "videos") {
      // Show only regular videos in main grid, hide shorts shelf so it's clean like YouTube's Videos tab
      if (shortsShelf) shortsShelf.classList.add("hidden");
    } else if (activeTab === "shorts") {
      // Show Shorts in the main area
      if (shortsShelf) shortsShelf.classList.remove("hidden");
      grid.innerHTML = "";
      if (loadMoreBox) loadMoreBox.classList.add("hidden");
      if (chShortVids.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400 text-xs font-bold">' + lbl.noShorts + '</div>';
      }
    } else if (activeTab === "playlists") {
      if (shortsShelf) shortsShelf.classList.add("hidden");
      if (loadMoreBox) loadMoreBox.classList.add("hidden");

      // Check if user clicked inside a specific Playlist of this channel
      var selPlTitle = window.qaafChannelSelectedPlaylistTitle;
      var activePlObj = selPlTitle ? chPlaylists.find(function(p) { return p.title === selPlTitle; }) : null;

      if (activePlObj) {
        grid.innerHTML = "";
        var topPlBar = document.createElement("div");
        topPlBar.className = "col-span-full bg-[#131824] border border-amber-500/40 rounded-xl p-3 flex items-center justify-between gap-2 mb-1";
        topPlBar.innerHTML =
          '<div class="flex items-center gap-2 min-w-0">' +
            '<span class="text-lg">📂</span>' +
            '<h4 class="text-xs sm:text-sm font-extrabold text-amber-300 truncate">' + activePlObj.title + ' (' + activePlObj.videos.length + ' ' + lbl.videosCount + ')</h4>' +
          '</div>' +
          '<button type="button" onclick="window.switchQaafChannelSubTab(\'playlists\')" class="bg-slate-800 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-extrabold shrink-0 cursor-pointer">' +
            lbl.backPl +
          '</button>';
        grid.appendChild(topPlBar);

        activePlObj.videos.forEach(function(vid) {
          var card = createQaafVideoCardElement(vid);
          grid.appendChild(card);
        });
      } else {
        // Render YouTube-Style Playlist Cards Grid!
        grid.innerHTML = "";
        if (chPlaylists.length === 0) {
          grid.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400 text-xs font-bold">' + lbl.noPlaylists + '</div>';
        } else {
          chPlaylists.forEach(function(pl) {
            var plCard = document.createElement("div");
            plCard.className = "bg-[#141923] hover:bg-[#1c2331] border border-slate-700/80 hover:border-emerald-500/60 rounded-2xl overflow-hidden shadow-lg transition cursor-pointer group flex flex-col justify-between";
            plCard.onclick = function() { window.openQaafChannelPlaylist(pl.title); };

            var catArt = getCategoryIslamicArtwork((pl.videos[0] && pl.videos[0].category) || "quran");
            plCard.innerHTML =
              '<div class="relative aspect-video bg-slate-900 overflow-hidden">' +
                '<img src="' + pl.thumb + '" alt="" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" onerror="this.onerror=null;this.src=\'' + catArt + '\';" />' +
                '<div class="absolute inset-y-0 right-0 w-2/5 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white border-l border-white/10">' +
                  '<span class="text-xl mb-0.5">📂</span>' +
                  '<span class="text-sm font-extrabold text-emerald-400">' + pl.videos.length + '</span>' +
                  '<span class="text-[10px] text-slate-300 font-semibold">' + lbl.videosCount + '</span>' +
                '</div>' +
              '</div>' +
              '<div class="p-3.5 flex items-center justify-between gap-2">' +
                '<div class="min-w-0">' +
                  '<h4 class="text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-emerald-400 transition">' + pl.title + '</h4>' +
                  '<p class="text-[11px] text-slate-400 truncate mt-0.5">' + selCh + '</p>' +
                '</div>' +
                '<span class="bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-black px-2.5 py-1 rounded-lg text-[10px] font-extrabold shrink-0 transition">' +
                  lbl.openPl +
                '</span>' +
              '</div>';
            grid.appendChild(plCard);
          });
        }
      }
    }
  };

  if (typeof window.renderVideosNow === "function") {
    window.renderVideosNow();
  }
})();
// === QAAF V16 SMART YOUTUBE FEED & CHANNEL TABS END ===
