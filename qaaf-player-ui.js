// QAAF Tube Player UI, Kids Timer, Fast Renderer, Search & Games Hub (qaaf-player-ui.js)

(function activateSmartThreeColorRequestScanner() {
  // Ensure PIN is hidden immediately on load
  if (typeof syncPinDisplays === 'function') syncPinDisplays();

  const RED_FORBIDDEN_WORDS = [
    'music', 'musical', 'song', 'dance', 'movie', 'concert', 'remix', 'dj', 'bollywood', 'hollywood',
    'qawwali', 'qawali', 'urs', 'chadar poshi', 'matam', 'noha', 'majlis', 'aamil baba', 'kala jadu',
    'گانا', 'موسیقی', 'قوالی', 'عرس', 'چادر پوشی', 'ماتم', 'نوحہ', 'مجلس', 'عامل بابا', 'کالا جادو', 'ڈانس', 'فلم'
  ];

  const YELLOW_SENSITIVE_WORDS = [
    'taweez', 'taveez', 'mazar', 'dargah', 'shirk', 'biddat', 'bidah', 'shia', 'ahle tashi',
    'firqa', 'aqeedah', 'aqaid', 'debate', 'exposed', 'تعویذ', 'مزار', 'درگاہ', 'شرک', 'بدعت',
    'شیعہ', 'فرقہ', 'عقیدہ', 'مناظرہ'
  ];

  const GREEN_ISLAMIC_KEYWORDS = [
    'quran', 'surah', 'ayah', 'ayat', 'tilawat', 'recitation', 'tajweed', 'qari', 'allah', 'prophet',
    'nabi', 'rasool', 'muhammad', 'seerah', 'hadith', 'hadees', 'sunnah', 'dua', 'azkar', 'namaz',
    'salah', 'wudu', 'ramadan', 'hajj', 'umrah', 'makkah', 'madinah', 'masjid', 'islam', 'islamic',
    'muslim', 'iman', 'halal', 'bayan', 'khutba', 'tafseer', 'tafsir', 'mufti', 'sheikh', 'shaykh',
    'molana', 'maulana', 'ulama', 'scholar', 'dr zakir', 'farhat hashmi', 'tariq masood', 'shamail',
    'youth club', 'omar & hana', 'omar and hana', 'noorify', 'youqaria', 'moral vision', 'abdul bari',
    'ghulam rasool', 'gulam rasool', 'kids land', 'tiny mumins', 'freequran', 'islah', 'tarbiah',
    'dar ul ahsan', 'paigham', 'iqra', 'lisan ul quran', 'dibirov', 'zaid patel', 'قرآن', 'سورۃ',
    'سورہ', 'تلاوت', 'تجوید', 'قاری', 'اللہ', 'نبی', 'رسول', 'حدیث', 'سنت', 'دعا', 'نماز', 'وضو',
    'رمضان', 'حج', 'مکہ', 'مدینہ', 'مسجد', 'اسلام', 'اسلامی', 'مسلمان', 'ایمان', 'حلال', 'بیان',
    'خطبہ', 'تفسیر', 'مفتی', 'شیخ', 'مولانا', 'علماء', 'اخلاقی', 'تربیت', 'قصص', 'انبیاء'
  ];

  window.evaluateRequestColorCategory = function(req) {
    const text = (`${req.title || ''} ${req.channel || ''}`).toLowerCase();

    // 1. Check RED (Forbidden Music / Shirk / Un-Islamic terms)
    for (const rw of RED_FORBIDDEN_WORDS) {
      if (text.includes(rw)) {
        return {
          color: 'RED',
          badgeClass: 'bg-rose-500/20 border-rose-500 text-rose-300',
          cardBorder: 'border-rose-500/70 bg-rose-950/20',
          label: `🔴 RED (System Rejected) — Forbidden Term Detected: "${rw}"`
        };
      }
    }

    // 2. Check YELLOW (Sensitive Aqeedah / Sectarian terms)
    for (const yw of YELLOW_SENSITIVE_WORDS) {
      if (text.includes(yw)) {
        return {
          color: 'YELLOW',
          badgeClass: 'bg-amber-500/20 border-amber-400 text-amber-300',
          cardBorder: 'border-amber-500/70 bg-amber-950/20',
          label: `🟡 YELLOW (Observation) — Sensitive Topic: "${yw}" (Admin Check Required)`
        };
      }
    }

    // 3. Check GREEN (Matches Islamic / Quran / Moral Kids keywords)
    for (const gw of GREEN_ISLAMIC_KEYWORDS) {
      if (text.includes(gw)) {
        return {
          color: 'GREEN',
          badgeClass: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
          cardBorder: 'border-emerald-500/70 bg-emerald-950/15',
          label: `🟢 GREEN (System Approved) — Verified Islamic / Halal Match ("${gw}")`
        };
      }
    }

    // 4. Otherwise YELLOW (Off-Topic / Non-Islamic like Medical, Tech, General)
    return {
      color: 'YELLOW',
      badgeClass: 'bg-amber-500/20 border-amber-400 text-amber-300',
      cardBorder: 'border-amber-500/70 bg-amber-950/20',
      label: `🟡 YELLOW (Off-Topic Warning) — No Islamic Keywords Found (Verify if Relevant)`
    };
  };

  let adminReqColorFilter = 'ALL';
  window.setAdminReqColorFilter = function(colorKey) {
    adminReqColorFilter = colorKey;
    window.renderAdminParentRequests();
  };

  window.adminBatchApproveAllGreen = function() {
    let count = 0;
    const remaining = [];
    parentRequestsQueue.forEach(req => {
      const ev = window.evaluateRequestColorCategory(req);
      if (ev.color === 'GREEN') {
        videosData.unshift({
          id: 'v_approved_' + Date.now() + '_' + count,
          title: req.title,
          channel: req.channel,
          lang: req.lang || 'ur',
          region: (req.lang || 'ur').toUpperCase(),
          category: req.category || 'kids_cartoon',
          kidsSafe: (req.category !== 'bayan'),
          ytId: req.ytId,
          isCustomAdded: true,
          duration: '12:00',
          views: 0,
          createdAt: Math.floor(Date.now() / 1000)
        });
        count++;
      } else {
        remaining.push(req);
      }
    });
    if (count === 0) {
      alert('No GREEN requests to approve.');
      return;
    }
    parentRequestsQueue = remaining;
    localStorage.setItem('qaaf_parent_requests', JSON.stringify(parentRequestsQueue));
    localStorage.setItem('qaaf_videos_data', JSON.stringify(videosData));
    window.renderAdminParentRequests();
    renderVideos();
    if (window.qaafCloudSync) qaafCloudSync.pushState(`Approved ${count} Green Requests`);
    showSyncToast(`✅ Approved ${count} Green Islamic request(s)!`);
  };

  window.adminBatchRejectNonGreen = function() {
    const before = parentRequestsQueue.length;
    parentRequestsQueue = parentRequestsQueue.filter(req => window.evaluateRequestColorCategory(req).color === 'GREEN');
    const removed = before - parentRequestsQueue.length;
    if (removed === 0) {
      alert('No Yellow or Red requests to remove.');
      return;
    }
    localStorage.setItem('qaaf_parent_requests', JSON.stringify(parentRequestsQueue));
    window.renderAdminParentRequests();
    if (window.qaafCloudSync) qaafCloudSync.pushState(`Rejected ${removed} Off-Topic/Red Requests`);
    showSyncToast(`🗑️ Removed ${removed} Yellow/Red request(s)!`);
  };

  window.renderAdminParentRequests = function() {
    const container = document.getElementById('adminParentRequestsList');
    const qLen = (parentRequestsQueue && parentRequestsQueue.length) || 0;
    const badge = document.getElementById('adminReqCountBadge');
    if (badge) badge.innerText = qLen;
    const sideReq = document.getElementById('admSidebarReqBadge');
    if (sideReq) sideReq.innerText = qLen;
    const headerBadge = document.getElementById('adminFlagCountBadge');
    if (headerBadge) headerBadge.innerText = flaggedVideosQueue.length + qLen;

    if (!container) return;
    if (qLen === 0) {
      container.innerHTML = `<p class="text-slate-400 py-3 text-center">✅ No pending parent requests.</p>`;
      return;
    }

    let greenCount = 0, yellowCount = 0, redCount = 0;
    const evaluatedList = parentRequestsQueue.map((req, idx) => {
      const ev = window.evaluateRequestColorCategory(req);
      if (ev.color === 'GREEN') greenCount++;
      else if (ev.color === 'YELLOW') yellowCount++;
      else redCount++;
      return { req, idx, ev };
    });

    let htmlOut = `
      <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 mb-3 flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" onclick="setAdminReqColorFilter('ALL')" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${adminReqColorFilter === 'ALL' ? 'bg-white text-black' : 'bg-slate-800 text-slate-300'}">All (${qLen})</button>
          <button type="button" onclick="setAdminReqColorFilter('GREEN')" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${adminReqColorFilter === 'GREEN' ? 'bg-emerald-500 text-black' : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'}">🟢 Green: Islamic (${greenCount})</button>
          <button type="button" onclick="setAdminReqColorFilter('YELLOW')" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${adminReqColorFilter === 'YELLOW' ? 'bg-amber-400 text-black' : 'bg-amber-950/60 border border-amber-500/40 text-amber-300'}">🟡 Yellow: Off-Topic / Check (${yellowCount})</button>
          <button type="button" onclick="setAdminReqColorFilter('RED')" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${adminReqColorFilter === 'RED' ? 'bg-rose-500 text-white' : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'}">🔴 Red: Forbidden (${redCount})</button>
        </div>
        <div class="flex items-center gap-1.5">
          <button type="button" onclick="adminBatchApproveAllGreen()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold shadow">✅ Approve All Green</button>
          <button type="button" onclick="adminBatchRejectNonGreen()" class="bg-rose-600/80 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold shadow">🗑️ Clear Yellow/Red</button>
        </div>
      </div>
    `;

    evaluatedList.forEach(({ req, idx, ev }) => {
      if (adminReqColorFilter !== 'ALL' && ev.color !== adminReqColorFilter) return;
      const safeTitle = (req.title || '').replace(/'/g, "\\'");
      htmlOut += `
        <div class="border-2 ${ev.cardBorder} p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2 transition">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="border ${ev.badgeClass} px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow">
                ${ev.label}
              </span>
            </div>
            <p class="font-extrabold text-white text-xs sm:text-sm truncate">${req.title}</p>
            <p class="text-[11px] text-slate-300">Channel: <strong class="text-blue-300">${req.channel}</strong> • Lang: ${(req.lang || 'GLOBAL').toUpperCase()} • Cat: ${req.category}</p>
          </div>
          <div class="flex flex-wrap gap-1.5 shrink-0">
            <button type="button" onclick="adminPreviewRequestedVideo('${req.ytId}', '${safeTitle}')" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold shadow">▶ Listen / Preview</button>
            <button type="button" onclick="adminHandleParentRequest(${idx}, 'approve')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-extrabold shadow">✅ Approve Live</button>
            <button type="button" onclick="adminHandleParentRequest(${idx}, 'reject')" class="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-extrabold shadow">🚫 Reject</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = htmlOut;
  };

  window.renderAdminParentRequests();
})();

(function enableSpeedBoostAndSwipeMinimize() {
  // A. Debounce renderVideos during startup so it doesn't run 7 times in a row and slow down the phone
  let isStartupPhase = false;
  let startupTimer = null;
  const realRenderVideos = window.renderVideos;

  window.renderVideos = function() {
    if (isStartupPhase) {
      clearTimeout(startupTimer);
      startupTimer = setTimeout(() => {
        isStartupPhase = false;
        if (realRenderVideos) realRenderVideos();
      }, 60);
      return;
    }
    if (realRenderVideos) realRenderVideos();
  };

  setTimeout(() => { isStartupPhase = false; }, 400);

  // B. Ensure Mini-Player keeps video visible & playing when Back button or Minimize is pressed
  const baseMin = window.minimizeToMiniPlayer;
  window.minimizeToMiniPlayer = function() {
    if (baseMin) baseMin();
    const box = document.getElementById('playerModalBox');
    if (box) box.style.transform = '';
    [80, 280, 600].forEach(ms => {
      setTimeout(() => {
        if (typeof sendYouTubeCommand === 'function') sendYouTubeCommand('playVideo');
      }, ms);
    });
  };

  const baseExp = window.expandFromMiniPlayer;
  window.expandFromMiniPlayer = function() {
    if (baseExp) baseExp();
    const box = document.getElementById('playerModalBox');
    if (box) box.style.transform = '';
    try { history.pushState({ qaafVideoOpen: true }, ''); } catch (e) {}
    [80, 280].forEach(ms => {
      setTimeout(() => {
        if (typeof sendYouTubeCommand === 'function') sendYouTubeCommand('playVideo');
      }, ms);
    });
  };

  // C. YouTube-style Pull-Down / Swipe-Down Gesture on Player Top Bar & Info Area to Minimize
  let touchStartY = 0;
  let touchCurrentY = 0;
  let isDraggingPlayer = false;

  function attachSwipeHandlers() {
    const topBar = document.getElementById('ytTopControlBar');
    const infoBar = document.querySelector('#ytWatchScrollContainer > div:first-child');
    const box = document.getElementById('playerModalBox');
    if (!topBar || !box) return;

    // Add a visual drag handle pill at the top center of player
    if (!document.getElementById('ytSwipeDragHandle')) {
      const handle = document.createElement('div');
      handle.id = 'ytSwipeDragHandle';
      handle.className = 'w-10 h-1 bg-white/30 rounded-full mx-auto my-0.5 pointer-events-none';
      topBar.insertBefore(handle, topBar.children[1]);
    }

    [topBar, infoBar].forEach(targetEl => {
      if (!targetEl) return;
      targetEl.addEventListener('touchstart', function(e) {
        if (!e.touches || e.touches.length !== 1) return;
        touchStartY = e.touches[0].clientY;
        touchCurrentY = touchStartY;
        isDraggingPlayer = true;
      }, { passive: true });

      targetEl.addEventListener('touchmove', function(e) {
        if (!isDraggingPlayer || !e.touches || e.touches.length !== 1) return;
        touchCurrentY = e.touches[0].clientY;
        const deltaY = touchCurrentY - touchStartY;
        const scrollWrap = document.getElementById('ytWatchScrollContainer');
        const isFull = scrollWrap && !scrollWrap.classList.contains('hidden');
        if (isFull && deltaY > 10) {
          box.style.transform = `translateY(${Math.min(deltaY * 0.55, 160)}px)`;
        }
      }, { passive: true });

      targetEl.addEventListener('touchend', function() {
        if (!isDraggingPlayer) return;
        isDraggingPlayer = false;
        const deltaY = touchCurrentY - touchStartY;
        const scrollWrap = document.getElementById('ytWatchScrollContainer');
        const isFull = scrollWrap && !scrollWrap.classList.contains('hidden');
        box.style.transform = '';

        if (isFull && deltaY > 65) {
          // Swiped down -> Minimize to Mini-Player!
          window.minimizeToMiniPlayer();
        } else if (!isFull && deltaY < -45) {
          // Swiped up on Mini-Player -> Expand to Full Player!
          window.expandFromMiniPlayer();
        }
        touchStartY = 0;
        touchCurrentY = 0;
      }, { passive: true });
    });
  }

  attachSwipeHandlers();
})();

(function initDrawerPlaylistsTimerAndCenterSquareExpand() {
  var defaultParentPls = [
    { id: "pl_p_1", name: "Quran & Tafseer", videos: [] },
    { id: "pl_p_2", name: "Scholars Bayan", videos: [] },
    { id: "pl_p_3", name: "Watch Later", videos: [] }
  ];
  var defaultKidsPls = [
    { id: "pl_k_1", name: "Favorite Cartoons", videos: [] },
    { id: "pl_k_2", name: "Prophet Stories", videos: [] },
    { id: "pl_k_3", name: "Daily Duas & Quran", videos: [] }
  ];

  window.parentPlaylists = JSON.parse(localStorage.getItem("qaaf_parent_multi_playlists") || "null") || defaultParentPls;
  window.kidsPlaylists = JSON.parse(localStorage.getItem("qaaf_kids_multi_playlists") || "null") || defaultKidsPls;
  window.parentHistoryIds = JSON.parse(localStorage.getItem("qaaf_parent_history") || "[]");
  window.kidsHistoryIds = JSON.parse(localStorage.getItem("qaaf_kids_history") || "[]");
  window.kidsSavedPresets = JSON.parse(localStorage.getItem("qaaf_kids_timer_presets") || '[{"label":"9:00 AM - 10:30 AM","type":"clock","start":"09:00","end":"10:30"},{"label":"45 Mins Timer","type":"duration","mins":45}]');

  window.activeSelectedPlaylistId = null;
  window.pendingVideoIdForPlaylist = null;
  window.kidsTimerInterval = null;
  window.kidsTimerRemainingSecs = 0;
  window.isKidsTimeExpiredLock = false;

  window.getActivePlaylistsGroup = function() {
    return isKidsLocked ? window.kidsPlaylists : window.parentPlaylists;
  };
  window.saveActivePlaylistsGroup = function() {
    if (isKidsLocked) {
      localStorage.setItem("qaaf_kids_multi_playlists", JSON.stringify(window.kidsPlaylists));
    } else {
      localStorage.setItem("qaaf_parent_multi_playlists", JSON.stringify(window.parentPlaylists));
    }
  };
  window.getActiveHistory = function() {
    return isKidsLocked ? window.kidsHistoryIds : window.parentHistoryIds;
  };
  window.isVideoInAnyActivePlaylist = function(videoId) {
    var list = getActivePlaylistsGroup();
    for (var i = 0; i < list.length; i++) {
      if (list[i].videos && list[i].videos.indexOf(videoId) !== -1) return true;
    }
    return false;
  };

  window.recordVideoInHistory = function(videoId) {
    if (!videoId) return;
    if (isKidsLocked) {
      window.kidsHistoryIds = [videoId].concat(window.kidsHistoryIds.filter(function(id) { return id !== videoId; })).slice(0, 80);
      localStorage.setItem("qaaf_kids_history", JSON.stringify(window.kidsHistoryIds));
    } else {
      window.parentHistoryIds = [videoId].concat(window.parentHistoryIds.filter(function(id) { return id !== videoId; })).slice(0, 80);
      localStorage.setItem("qaaf_parent_history", JSON.stringify(window.parentHistoryIds));
    }
    refreshSidebarUI();
  };

  window.clearActiveHistory = function() {
    var modeLabel = isKidsLocked ? "Kids" : "Parent";
    if (!confirm("Clear all " + modeLabel + " Watch History?")) return;
    if (isKidsLocked) {
      window.kidsHistoryIds = [];
      localStorage.setItem("qaaf_kids_history", "[]");
    } else {
      window.parentHistoryIds = [];
      localStorage.setItem("qaaf_parent_history", "[]");
    }
    refreshSidebarUI();
    renderVideos();
    showSyncToast("🗑️ " + modeLabel + " Watch History cleared!");
  };

  // 1. ADD WORKING MENU BUTTON (☰) IN HEADER
  var logoDiv = document.querySelector("#mainHeader > div:first-child");
  if (logoDiv && !document.getElementById("headerDrawerMenuBtn")) {
    var menuBtn = document.createElement("button");
    menuBtn.id = "headerDrawerMenuBtn";
    menuBtn.type = "button";
    menuBtn.className = "bg-[#222631] hover:bg-emerald-600 text-white w-8 h-8 rounded-xl flex items-center justify-center border border-white/15 shadow mr-1 shrink-0 transition";
    menuBtn.innerHTML = '<span class="text-sm font-extrabold">☰</span>';
    menuBtn.onclick = function(e) {
      e.stopPropagation();
      openQaafProfileDrawer();
    };
    logoDiv.insertBefore(menuBtn, logoDiv.firstChild);
  }

  window.openQaafProfileDrawer = function() {
    refreshSidebarUI();
    document.getElementById("qaafLeftSidebarBackdrop").classList.remove("hidden");
    document.getElementById("qaafLeftSidebarDrawer").classList.remove("-translate-x-full");
  };

  window.closeQaafProfileDrawer = function() {
    document.getElementById("qaafLeftSidebarBackdrop").classList.add("hidden");
    document.getElementById("qaafLeftSidebarDrawer").classList.add("-translate-x-full");
  };

  document.getElementById("qaafLeftSidebarBackdrop").onclick = closeQaafProfileDrawer;
  document.getElementById("drawerCloseBtn").onclick = closeQaafProfileDrawer;
  document.getElementById("drawerHomeBtn").onclick = function() {
    window.activeSelectedPlaylistId = null;
    setSortFilter("default");
    closeQaafProfileDrawer();
  };
  document.getElementById("drawerPlToggleBtn").onclick = function() {
    document.getElementById("drawerSub_playlists").classList.toggle("hidden");
  };
  document.getElementById("drawerHistToggleBtn").onclick = function() {
    document.getElementById("drawerSub_history").classList.toggle("hidden");
  };
  document.getElementById("drawerNewPlBtn").onclick = function() {
    var raw = prompt("📋 Enter name for new Playlist:");
    if (!raw || !raw.trim()) return;
    var grp = getActivePlaylistsGroup();
    grp.push({ id: "pl_" + Date.now(), name: raw.trim(), videos: [] });
    saveActivePlaylistsGroup();
    refreshSidebarUI();
    showSyncToast("✅ Created playlist: " + raw.trim());
  };
  document.getElementById("drawerOpenFullHistBtn").onclick = function() {
    window.activeSelectedPlaylistId = null;
    setSortFilter("history");
    closeQaafProfileDrawer();
  };
  document.getElementById("drawerFavBtn").onclick = function() {
    window.activeSelectedPlaylistId = null;
    setSortFilter("favorites");
    closeQaafProfileDrawer();
  };
  document.getElementById("drawerKidsTimerBtn").onclick = function() {
    closeQaafProfileDrawer();
    openKidsLockOrTimer();
  };
  document.getElementById("drawerAuthModalBtn").onclick = function() {
    closeQaafProfileDrawer();
    openAccountModal();
  };

  window.drawerSelectPlaylist = function(plId) {
    window.activeSelectedPlaylistId = plId;
    setSortFilter("playlist");
    closeQaafProfileDrawer();
  };

  window.drawerDeletePlaylist = function(plId, ev) {
    if (ev) ev.stopPropagation();
    if (!confirm("Delete this playlist?")) return;
    if (isKidsLocked) {
      window.kidsPlaylists = window.kidsPlaylists.filter(function(p) { return p.id !== plId; });
    } else {
      window.parentPlaylists = window.parentPlaylists.filter(function(p) { return p.id !== plId; });
    }
    saveActivePlaylistsGroup();
    refreshSidebarUI();
    renderVideos();
  };

  function refreshSidebarUI() {
    var nameEl = document.getElementById("drawerProfileName");
    var emailEl = document.getElementById("drawerProfileEmail");
    var avatarEl = document.getElementById("drawerAvatarCircle");

    if (isKidsLocked) {
      if (nameEl) nameEl.innerText = "🧒 Kids Profile";
      if (emailEl) emailEl.innerText = "Kids Safe Library";
      if (avatarEl) avatarEl.innerText = "🧒";
    } else if (currentUserEmail) {
      var uMap = window.registeredUsersMap || {};
      var uObj = uMap[currentUserEmail.toLowerCase()];
      var dName = isSuperAdmin() ? "👑 Super Admin" : (uObj && uObj.name ? uObj.name : currentUserEmail.split("@")[0]);
      if (nameEl) nameEl.innerText = dName;
      if (emailEl) emailEl.innerText = currentUserEmail;
      if (avatarEl) avatarEl.innerText = dName.charAt(0).toUpperCase();
    } else {
      if (nameEl) nameEl.innerText = "Guest Family";
      if (emailEl) emailEl.innerText = "Tap below to Sign In";
      if (avatarEl) avatarEl.innerText = "👤";
    }

    var pls = getActivePlaylistsGroup();
    var plBadge = document.getElementById("drawerPlaylistsTotalBadge");
    if (plBadge) plBadge.innerText = pls.length;

    var plCont = document.getElementById("drawerPlaylistsItemsList");
    if (plCont) {
      plCont.innerHTML = "";
      pls.forEach(function(pl) {
        var row = document.createElement("div");
        var isAct = (currentSortFilter === "playlist" && window.activeSelectedPlaylistId === pl.id);
        row.className = "px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between transition " + (isAct ? "bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/40" : "hover:bg-white/5 text-slate-300 font-semibold");
        row.onclick = function() { drawerSelectPlaylist(pl.id); };

        var leftSpan = document.createElement("span");
        leftSpan.className = "truncate pr-2";
        leftSpan.innerText = "▸ " + pl.name;

        var rightSpan = document.createElement("span");
        rightSpan.className = "flex items-center gap-1 shrink-0";
        var countTag = document.createElement("span");
        countTag.className = "bg-slate-800 text-slate-300 px-1.5 rounded text-[10px]";
        countTag.innerText = (pl.videos && pl.videos.length) || 0;
        rightSpan.appendChild(countTag);

        if (pls.length > 1) {
          var delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "text-slate-500 hover:text-rose-400 px-1";
          delBtn.innerText = "✕";
          delBtn.onclick = function(e) { drawerDeletePlaylist(pl.id, e); };
          rightSpan.appendChild(delBtn);
        }

        row.appendChild(leftSpan);
        row.appendChild(rightSpan);
        plCont.appendChild(row);
      });
    }

    var hist = getActiveHistory();
    var hBadge = document.getElementById("drawerHistoryCountBadge");
    if (hBadge) hBadge.innerText = hist.length;

    var fBadge = document.getElementById("drawerFavCountBadge");
    if (fBadge) fBadge.innerText = favoriteVideoIds.length;

    var hPrev = document.getElementById("drawerRecentHistoryPreview");
    if (hPrev) {
      hPrev.innerHTML = "";
      if (hist.length === 0) {
        hPrev.innerHTML = '<p class="text-[11px] text-slate-500 py-1 px-2">No watched videos yet.</p>';
      } else {
        hist.slice(0, 5).forEach(function(vidId) {
          var v = videosData.find(function(x) { return x.id === vidId; });
          if (v) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "w-full text-left px-2 py-1 rounded hover:bg-white/5 text-[11px] text-slate-300 truncate block";
            b.innerText = "▶ " + v.title;
            b.onclick = function() {
              closeQaafProfileDrawer();
              openVideoPlayer(v.id);
            };
            hPrev.appendChild(b);
          }
        });
      }
    }
  }

  // 2. PLAYLIST SELECTOR MODAL WIRING
  document.getElementById("closePlModalBtn").onclick = function() {
    document.getElementById("playlistSelectorModal").classList.add("hidden");
  };
  document.getElementById("createQuickPlBtn").onclick = function() {
    var inp = document.getElementById("newQuickPlaylistInput");
    var name = (inp ? inp.value : "").trim();
    if (!name) return;
    var pls = getActivePlaylistsGroup();
    var vidId = window.pendingVideoIdForPlaylist;
    pls.push({ id: "pl_" + Date.now(), name: name, videos: vidId ? [vidId] : [] });
    saveActivePlaylistsGroup();
    if (inp) inp.value = "";
    renderPlaylistModalRows();
    refreshSidebarUI();
    renderVideos();
    showSyncToast("🎉 Created playlist: " + name);
  };

  function renderPlaylistModalRows() {
    var box = document.getElementById("playlistModalCheckboxes");
    if (!box) return;
    box.innerHTML = "";
    var vidId = window.pendingVideoIdForPlaylist;
    var pls = getActivePlaylistsGroup();
    pls.forEach(function(pl) {
      var hasVid = pl.videos && pl.videos.indexOf(vidId) !== -1;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition " + (hasVid ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 font-extrabold" : "bg-black/60 hover:bg-slate-800 border-slate-800 text-slate-200 font-semibold");
      btn.onclick = function() {
        if (!pl.videos) pl.videos = [];
        if (pl.videos.indexOf(vidId) !== -1) {
          pl.videos = pl.videos.filter(function(id) { return id !== vidId; });
          showSyncToast("📋 Removed from " + pl.name);
        } else {
          pl.videos.unshift(vidId);
          showSyncToast("✅ Added to " + pl.name);
        }
        saveActivePlaylistsGroup();
        renderPlaylistModalRows();
        refreshSidebarUI();
        renderVideos();
      };
      btn.innerHTML = '<span class="flex items-center gap-2"><span class="w-5 h-5 rounded flex items-center justify-center border ' + (hasVid ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-slate-600') + '">' + (hasVid ? '✔' : '') + '</span><span>' + pl.name + '</span></span><span class="text-[10px] text-slate-400">' + ((pl.videos && pl.videos.length) || 0) + ' videos</span>';
      box.appendChild(btn);
    });
  }

  window.toggleVideoInPlaylist = function(videoId, ev) {
    if (ev) ev.stopPropagation();
    if (!videoId) return;
    window.pendingVideoIdForPlaylist = videoId;
    renderPlaylistModalRows();
    document.getElementById("playlistSelectorModal").classList.remove("hidden");
  };

  var playerFavBtn = document.querySelector('#playerModal button[onclick*="toggleFavoriteVideo"]');
  if (playerFavBtn && !document.getElementById("playerAddPlaylistBtn")) {
    var pPlBtn = document.createElement("button");
    pPlBtn.id = "playerAddPlaylistBtn";
    pPlBtn.type = "button";
    pPlBtn.onclick = function(e) { toggleVideoInPlaylist(currentPlayingVideoId, e); };
    pPlBtn.className = "bg-[#272727] hover:bg-emerald-600 text-emerald-300 hover:text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition";
    pPlBtn.innerHTML = "<span>➕</span> <span>Playlist</span>";
    playerFavBtn.parentNode.insertBefore(pPlBtn, playerFavBtn.nextSibling);
  }

  // 3. HOOK PLAYLIST & HISTORY VIEWS INTO renderVideos
  var prevRenderVids = window.renderVideos;
  window.renderVideos = function() {
    refreshSidebarUI();
    var isPlFilter = (currentSortFilter === "playlist");
    var isHistFilter = (currentSortFilter === "history");

    if (isPlFilter || isHistFilter) {
      var pls = getActivePlaylistsGroup();
      var activePlObj = pls.find(function(p) { return p.id === window.activeSelectedPlaylistId; }) || pls[0];
      if (isPlFilter && activePlObj) window.activeSelectedPlaylistId = activePlObj.id;

      var targetIds = isPlFilter ? ((activePlObj && activePlObj.videos) || []) : getActiveHistory();
      var backupVids = videosData.slice();
      var backupSort = currentSortFilter;
      var backupCat = currentCategory;
      var backupStrict = strictLanguageOnly;

      currentCategory = "all";
      strictLanguageOnly = false;
      currentSortFilter = "default";

      var ordered = [];
      targetIds.forEach(function(id) {
        var found = backupVids.find(function(v) { return v.id === id; });
        if (found && (!isKidsLocked || found.kidsSafe) && blockedVideoIds.indexOf(found.id) === -1 && bannedChannels.indexOf(found.channel) === -1) {
          ordered.push(found);
        }
      });

      videosData = ordered;
      if (prevRenderVids) prevRenderVids();

      videosData = backupVids;
      currentSortFilter = backupSort;
      currentCategory = backupCat;
      strictLanguageOnly = backupStrict;

      var grid = document.getElementById("videoGrid");
      if (grid) {
        var bannerEl = document.getElementById("plHistHeaderBanner");
        if (!bannerEl) {
          bannerEl = document.createElement("div");
          bannerEl.id = "plHistHeaderBanner";
          grid.parentNode.insertBefore(bannerEl, grid);
        }
        var viewTitle = isPlFilter ? ("Playlist: " + (activePlObj ? activePlObj.name : "My List")) : ((isKidsLocked ? "Kids" : "Parent") + " Watch History");
        bannerEl.className = "mb-4 bg-[#121620] border border-emerald-500/40 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2 shadow-lg";
        bannerEl.innerHTML = '<div class="flex items-center gap-2"><span class="text-xl">' + (isPlFilter ? '📋' : '📜') + '</span><div><h4 class="text-xs sm:text-sm font-extrabold text-white">' + viewTitle + ' (' + ordered.length + ' Videos)</h4></div></div><div class="flex items-center gap-2">' + (!isPlFilter && ordered.length > 0 ? '<button type="button" onclick="clearActiveHistory()" class="bg-rose-600 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold">🗑️ Clear History</button>' : '') + '<button type="button" id="backAllVidsBannerBtn" class="bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold">⬅️ Show All Videos</button></div>';
        bannerEl.classList.remove("hidden");
        var backBtn = document.getElementById("backAllVidsBannerBtn");
        if (backBtn) backBtn.onclick = function() { setSortFilter("default"); };
      }
    } else {
      var bannerEl2 = document.getElementById("plHistHeaderBanner");
      if (bannerEl2) bannerEl2.classList.add("hidden");
      if (prevRenderVids) prevRenderVids();
    }

    document.querySelectorAll("#videoGrid > div").forEach(function(card) {
      var favBtnEl = null;
      if (!favBtnEl) return;
      var m = favBtnEl.getAttribute("onclick").match(/'([^']+)'/);
      if (!m || !m[1]) return;
      var vidId = m[1];
      var inPl = isVideoInAnyActivePlaylist(vidId);

      var oldTop = card.querySelector(".card-pl-top-btn");
      if (oldTop) oldTop.remove();
      var topBtn = document.createElement("button");
      topBtn.type = "button";
      topBtn.className = "card-pl-top-btn w-7 h-7 rounded-full " + (inPl ? "bg-emerald-500 text-black" : "bg-black/80 hover:bg-emerald-600 text-emerald-300") + " flex items-center justify-center text-xs font-extrabold shadow border border-emerald-400/40 transition";
      topBtn.title = "Save to Playlist";
      topBtn.innerHTML = inPl ? "✔" : "➕";
      topBtn.onclick = function(e) { toggleVideoInPlaylist(vidId, e); };
      favBtnEl.parentNode.insertBefore(topBtn, favBtnEl);
    });
  };

  // 4. YOUTUBE MINI-PLAYER CENTER SQUARE EXPAND OVERLAY + SMOOTH SWIPE-DOWN
  var aspectBox = document.getElementById("playerAspectBox");
  if (aspectBox && !document.getElementById("miniCenterExpandOverlay")) {
    var centerOv = document.createElement("div");
    centerOv.id = "miniCenterExpandOverlay";
    centerOv.className = "hidden absolute inset-0 z-30 bg-black/10 flex items-center justify-center cursor-pointer";
    centerOv.innerHTML =
      '<div class="w-12 h-12 rounded-2xl bg-transparent border-2 border-white/75 hover:border-white hover:scale-110 text-white flex items-center justify-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] transition">' +
        '<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="15 3 21 3 21 9"></polyline>' +
          '<polyline points="9 21 3 21 3 15"></polyline>' +
          '<line x1="21" y1="3" x2="14" y2="10"></line>' +
          '<line x1="3" y1="21" x2="10" y2="14"></line>' +
        '</svg>' +
      '</div>';
    centerOv.onclick = function(e) {
      e.stopPropagation();
      window.expandFromMiniPlayer();
    };
    aspectBox.appendChild(centerOv);
  }

  var baseMinFn = window.minimizeToMiniPlayer;
  window.minimizeToMiniPlayer = function() {
    if (baseMinFn) baseMinFn();
    var co = document.getElementById("miniCenterExpandOverlay");
    if (co) co.classList.remove("hidden");
  };

  var baseExpFn = window.expandFromMiniPlayer;
  window.expandFromMiniPlayer = function() {
    var co = document.getElementById("miniCenterExpandOverlay");
    if (co) co.classList.add("hidden");
    if (baseExpFn) baseExpFn();
  };

  // Make the entire Info area below the video + Top bar + Left/Right edges swipeable downwards to minimize!
  var pBox = document.getElementById("playerModalBox");
  var scrollCont = document.getElementById("ytWatchScrollContainer");
  var sStartY = 0;
  var sCurrY = 0;
  var sDragging = false;

  if (scrollCont && pBox) {
    scrollCont.addEventListener("touchstart", function(e) {
      if (scrollCont.scrollTop > 5 || !e.touches || e.touches.length !== 1) return;
      sStartY = e.touches[0].clientY;
      sCurrY = sStartY;
      sDragging = true;
    }, { passive: true });

    scrollCont.addEventListener("touchmove", function(e) {
      if (!sDragging || !e.touches || e.touches.length !== 1) return;
      sCurrY = e.touches[0].clientY;
      var dy = sCurrY - sStartY;
      if (dy > 12 && scrollCont.scrollTop <= 0) {
        pBox.style.transform = "translateY(" + Math.min(dy * 0.6, 180) + "px)";
      }
    }, { passive: true });

    scrollCont.addEventListener("touchend", function() {
      if (!sDragging) return;
      sDragging = false;
      var dy = sCurrY - sStartY;
      pBox.style.transform = "";
      if (dy > 55 && scrollCont.scrollTop <= 0) {
        window.minimizeToMiniPlayer();
      }
      sStartY = 0;
      sCurrY = 0;
    }, { passive: true });
  }

  // Record history when opening video
  var prevOpenPlayer = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    if (window.isKidsTimeExpiredLock) return;
    var co = document.getElementById("miniCenterExpandOverlay");
    if (co) co.classList.add("hidden");
    recordVideoInHistory(videoId);
    if (prevOpenPlayer) prevOpenPlayer(videoId);
  };

  // 5. KIDS TIMER WIRING
  document.getElementById("closeKidsTimerModalBtn").onclick = function() {
    document.getElementById("kidsTimerSetupModal").classList.add("hidden");
  };
  document.getElementById("startClockSchedBtn").onclick = function() {
    var endStr = document.getElementById("kidsClockEndInput").value || "10:30";
    var mins = calculateMinutesUntilClockTime(endStr);
    startKidsModeWithTimer(mins);
    showSyncToast("🕰️ Kids Mode locked until " + format12Hr(endStr));
  };
  document.getElementById("saveClockPresetBtn").onclick = function() {
    var st = document.getElementById("kidsClockStartInput").value || "09:00";
    var en = document.getElementById("kidsClockEndInput").value || "10:30";
    var lbl = format12Hr(st) + " - " + format12Hr(en);
    window.kidsSavedPresets.push({ label: lbl, type: "clock", start: st, end: en });
    localStorage.setItem("qaaf_kids_timer_presets", JSON.stringify(window.kidsSavedPresets));
    renderKidsSavedPresets();
    showSyncToast("💾 Saved preset: " + lbl);
  };
  document.getElementById("startCustomMinsBtn").onclick = function() {
    var v = parseInt(document.getElementById("customKidsTimerMins").value || "0", 10);
    if (!v || v <= 0) { alert("Enter valid minutes."); return; }
    startKidsModeWithTimer(v);
  };
  document.getElementById("saveCustomMinsBtn").onclick = function() {
    var v = parseInt(document.getElementById("customKidsTimerMins").value || "0", 10);
    if (!v || v <= 0) { alert("Enter custom minutes first."); return; }
    var lbl = v + " Mins Timer";
    window.kidsSavedPresets.push({ label: lbl, type: "duration", mins: v });
    localStorage.setItem("qaaf_kids_timer_presets", JSON.stringify(window.kidsSavedPresets));
    renderKidsSavedPresets();
    showSyncToast("💾 Saved preset: " + lbl);
  };
  document.getElementById("unlockExitKidsBtn").onclick = function() { unlockTimeUpOverlay("exit_kids"); };
  document.getElementById("unlockAdd15mBtn").onclick = function() { unlockTimeUpOverlay("add_15m"); };

  function format12Hr(timeStr) {
    if (!timeStr) return "";
    var p = timeStr.split(":");
    var h = parseInt(p[0], 10);
    var m = p[1];
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + ampm;
  }

  function calculateMinutesUntilClockTime(endTimeStr) {
    var now = new Date();
    var p = endTimeStr.split(":");
    var target = new Date();
    target.setHours(parseInt(p[0], 10), parseInt(p[1], 10), 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return Math.max(10, Math.floor((target.getTime() - now.getTime()) / 1000)) / 60;
  }

  function renderKidsSavedPresets() {
    var cont = document.getElementById("kidsSavedPresetsContainer");
    if (!cont) return;
    cont.innerHTML = "";
    if (!window.kidsSavedPresets || window.kidsSavedPresets.length === 0) {
      cont.innerHTML = '<span class="text-[11px] text-slate-400">No saved presets yet.</span>';
      return;
    }
    window.kidsSavedPresets.forEach(function(pr, idx) {
      var wrap = document.createElement("div");
      wrap.className = "inline-flex items-center bg-black/80 border border-emerald-500/50 rounded-xl overflow-hidden shadow";
      var runBtn = document.createElement("button");
      runBtn.type = "button";
      runBtn.className = "px-3 py-1.5 text-xs font-extrabold text-emerald-300 hover:bg-emerald-600 hover:text-white transition";
      runBtn.innerText = "▶ " + pr.label;
      runBtn.onclick = function() {
        if (pr.type === "clock") {
          startKidsModeWithTimer(calculateMinutesUntilClockTime(pr.end));
        } else {
          startKidsModeWithTimer(pr.mins || 30);
        }
      };
      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "px-2 py-1.5 text-[10px] text-slate-400 hover:bg-rose-600 hover:text-white border-l border-slate-800";
      delBtn.innerText = "✕";
      delBtn.onclick = function() {
        window.kidsSavedPresets.splice(idx, 1);
        localStorage.setItem("qaaf_kids_timer_presets", JSON.stringify(window.kidsSavedPresets));
        renderKidsSavedPresets();
      };
      wrap.appendChild(runBtn);
      wrap.appendChild(delBtn);
      cont.appendChild(wrap);
    });
  }

  window.formatTimerMMSS = function(totalSecs) {
    var hrs = Math.floor(totalSecs / 3600);
    var mins = Math.floor((totalSecs % 3600) / 60);
    var secs = totalSecs % 60;
    if (hrs > 0) return hrs + ":" + (mins < 10 ? "0" : "") + mins + ":" + (secs < 10 ? "0" : "") + secs;
    return mins + ":" + (secs < 10 ? "0" : "") + secs;
  };

  function updateHeaderTimerBadge() {
    var kmBadge = document.getElementById("kidsModeOnHeaderBadge");
    if (!kmBadge) return;
    if (!isKidsLocked) {
      kmBadge.classList.add("hidden");
      kmBadge.classList.remove("flex");
      return;
    }
    kmBadge.classList.remove("hidden");
    kmBadge.classList.add("flex");
    kmBadge.onclick = function() { openParentalGate('unlock'); };
    kmBadge.title = 'کلک کر کے پن کوڈ درج کریں اور کڈز موڈ سے باہر نکلیں';
    if (window.kidsTimerRemainingSecs > 0) {
      kmBadge.innerHTML = "<span>⏰</span> <span>" + formatTimerMMSS(window.kidsTimerRemainingSecs) + "</span> <span class='text-[10px] text-amber-300'>🔓</span>";
    } else {
      kmBadge.innerHTML = "<span>🔐</span> <span>Kids 🔓</span>";
    }
  }

  function triggerKidsTimeUpLockdown() {
    if (window.kidsTimerInterval) {
      clearInterval(window.kidsTimerInterval);
      window.kidsTimerInterval = null;
    }
    window.kidsTimerRemainingSecs = 0;
    window.isKidsTimeExpiredLock = true;
    if (typeof closeVideoPlayer === "function") closeVideoPlayer();
    if (typeof closeMiniGame === "function") closeMiniGame();
    if (typeof closeStandaloneGameModal === "function") closeStandaloneGameModal();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    document.getElementById("timeUpParentPinInput").value = "";
    document.getElementById("timeUpPinError").classList.add("hidden");
    document.getElementById("kidsTimeUpLockOverlay").classList.remove("hidden");
  }

  function unlockTimeUpOverlay(actionType) {
    var entered = (document.getElementById("timeUpParentPinInput").value || "").trim();
    if (entered !== parentPin) {
      document.getElementById("timeUpPinError").classList.remove("hidden");
      return;
    }
    document.getElementById("timeUpPinError").classList.add("hidden");
    window.isKidsTimeExpiredLock = false;
    document.getElementById("kidsTimeUpLockOverlay").classList.add("hidden");
    if (actionType === "add_15m") {
      activateKidsCountdown(15);
      showSyncToast("⏱️ Added 15 minutes!");
    } else {
      document.getElementById("pinInput").value = parentPin;
      pendingParentPurpose = "unlock";
      verifyPinCode();
    }
  }

  function activateKidsCountdown(minutes) {
    if (window.kidsTimerInterval) {
      clearInterval(window.kidsTimerInterval);
      window.kidsTimerInterval = null;
    }
    if (!minutes || minutes <= 0) {
      window.kidsTimerRemainingSecs = 0;
      updateHeaderTimerBadge();
      return;
    }
    window.kidsTimerRemainingSecs = Math.floor(minutes * 60);
    updateHeaderTimerBadge();
    window.kidsTimerInterval = setInterval(function() {
      if (!isKidsLocked) {
        clearInterval(window.kidsTimerInterval);
        window.kidsTimerInterval = null;
        return;
      }
      window.kidsTimerRemainingSecs--;
      updateHeaderTimerBadge();
      if (window.kidsTimerRemainingSecs <= 0) {
        triggerKidsTimeUpLockdown();
      }
    }, 1000);
  }

  function enterKidsModeDirectly() {
    isKidsLocked = true;
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function() {});
    }
    document.getElementById("appBody").className = "bg-islamic-kids min-h-screen flex flex-col justify-between pb-12 transition-colors duration-500";
    var bP = document.getElementById("brandMainPrefix"); if(bP) bP.classList.add("hidden"); var bD = document.getElementById("brandDivider"); if(bD) bD.classList.add("hidden"); document.getElementById("brandSuffix").innerHTML = '<span class="kids-letters font-extrabold text-sm sm:text-base"><span>K</span><span>i</span><span>d</span><span>s</span> <span class="text-xs">🔒</span></span>';
    document.getElementById("lockIcon").innerText = "🔐";
    document.getElementById("parentPanelBtn").classList.add("hidden");
    document.getElementById("accountBtn").classList.add("hidden");
    document.getElementById("superAdminHeaderBtn").classList.add("hidden");
    document.getElementById("langDropdownContainer").classList.add("hidden");
    document.getElementById("kidsContentSwitcher").classList.remove("hidden");
    document.getElementById("kidsContentSwitcher").classList.add("flex");
    document.querySelectorAll(".family-only-chip").forEach(function(el) { el.classList.add("hidden"); });
    if (currentCategory === "bayan") currentCategory = "all";
    syncRegionalPromoBar();
    updateHeaderTimerBadge();
    renderVideos();
  }

  window.openKidsLockOrTimer = function() {
    if (!isKidsLocked) {
      renderKidsSavedPresets();
      var now = new Date();
      var stInp = document.getElementById("kidsClockStartInput");
      if (stInp) stInp.value = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      document.getElementById("kidsTimerSetupModal").classList.remove("hidden");
    } else {
      openParentalGate("unlock");
    }
  };

  window.toggleKidsMode = function() {
    window.openKidsLockOrTimer();
  };

  window.startKidsModeWithTimer = function(minutes) {
    document.getElementById("kidsTimerSetupModal").classList.add("hidden");
    enterKidsModeDirectly();
    activateKidsCountdown(minutes);
  };

  var baseVerifyPin = window.verifyPinCode;
  window.verifyPinCode = function() {
    var wasUnlock = (pendingParentPurpose === "unlock");
    if (baseVerifyPin) baseVerifyPin();
    if (wasUnlock && !isKidsLocked) {
      if (window.kidsTimerInterval) {
        clearInterval(window.kidsTimerInterval);
        window.kidsTimerInterval = null;
      }
      window.kidsTimerRemainingSecs = 0;
      window.isKidsTimeExpiredLock = false;
      updateHeaderTimerBadge();
      renderVideos();
    }
  };

  refreshSidebarUI();
})();

(function applyMasterPerformanceAndSwipeFix() {
  // 1. Coalesce multiple synchronous renderVideos() calls into a single fast frame
  var rawRender = window.renderVideos;
  var renderScheduled = false;

  window.renderVideosNow = function() {
    if (rawRender) rawRender();
  };

  window.renderVideos = function() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(function() {
      renderScheduled = false;
      if (rawRender) rawRender();
    });
  };

  // 2. Make the entire video player top bar, video edges, and title/channel area smoothly draggable downwards to minimize
  var modalBox = document.getElementById("playerModalBox");
  var topBar = document.getElementById("ytTopControlBar");
  var scrollCont = document.getElementById("ytWatchScrollContainer");
  var startY = 0;
  var currentY = 0;
  var dragging = false;

  function onTouchStart(e) {
    if (!e.touches || e.touches.length !== 1) return;
    if (scrollCont && scrollCont.scrollTop > 5) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
  }

  function onTouchMove(e) {
    if (!dragging || !e.touches || e.touches.length !== 1) return;
    currentY = e.touches[0].clientY;
    var dy = currentY - startY;
    var isFull = scrollCont && !scrollCont.classList.contains("hidden");
    if (isFull && dy > 10 && (!scrollCont || scrollCont.scrollTop <= 0)) {
      modalBox.style.transform = "translateY(" + Math.min(dy * 0.65, 200) + "px)";
    }
  }

  function onTouchEnd() {
    if (!dragging) return;
    dragging = false;
    var dy = currentY - startY;
    var isFull = scrollCont && !scrollCont.classList.contains("hidden");
    modalBox.style.transform = "";
    if (isFull && dy > 50 && (!scrollCont || scrollCont.scrollTop <= 0)) {
      window.minimizeToMiniPlayer();
    } else if (!isFull && dy < -40) {
      window.expandFromMiniPlayer();
    }
    startY = 0;
    currentY = 0;
  }

  if (topBar) {
    topBar.addEventListener("touchstart", onTouchStart, { passive: true });
    topBar.addEventListener("touchmove", onTouchMove, { passive: true });
    topBar.addEventListener("touchend", onTouchEnd, { passive: true });
  }
  if (scrollCont) {
    scrollCont.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollCont.addEventListener("touchmove", onTouchMove, { passive: true });
    scrollCont.addEventListener("touchend", onTouchEnd, { passive: true });
  }

  // Deferred to final V11 engine
})();

(function activatePureGpuSplash() {
  var splashTimer = null;
  window.runStartupSplash = function() {
    var modal = document.getElementById("startupSplashModal");
    if (!modal) return;
    if (splashTimer) clearTimeout(splashTimer);

    if (!modal) return;

    var redBox = document.getElementById("redBox");
    var innerBorder = document.getElementById("innerBorder");
    var triangleGrp = document.getElementById("triangleGrp");
    var qaafGrp = document.getElementById("qaafGrp");
    var impactFlash = document.getElementById("impactFlash");
    var barGroup = document.getElementById("barGroup");
    var barFill = document.getElementById("barFill");

    if (redBox) { redBox.removeAttribute("transform"); redBox.setAttribute("class", "gpu-anim-redbox"); }
    if (innerBorder) { innerBorder.setAttribute("class", "gpu-anim-border"); }
    if (qaafGrp) { qaafGrp.removeAttribute("transform"); qaafGrp.setAttribute("class", "gpu-anim-qaaf"); }
    if (triangleGrp) { triangleGrp.removeAttribute("transform"); triangleGrp.setAttribute("class", "gpu-anim-tri"); }
    if (impactFlash) { impactFlash.removeAttribute("transform"); impactFlash.setAttribute("class", "gpu-anim-flash"); }
    if (barGroup) { barGroup.removeAttribute("transform"); barGroup.setAttribute("class", "gpu-anim-bargroup"); }
    if (barFill) {
      barFill.setAttribute("x", "223");
      barFill.setAttribute("width", "578");
      barFill.setAttribute("class", "gpu-anim-barfill");
    }

    splashTimer = setTimeout(function() {
      modal.style.opacity = "0";
      setTimeout(function() { modal.classList.add("hidden"); }, 350);
    }, 2500);
  };

  window.replayStartupSplash = window.runStartupSplash;
  window.runStartupSplash();
})();

(function initAutomaticAdToDuaEngine() {
  var duaRotateInterval = null;
  var duaAutoCloseTimer = null;

  // Hide the manual skip button permanently so it works 100% automatically
  var skipBtn = document.getElementById("skipAdBtn");
  if (skipBtn) {
    skipBtn.disabled = true;
    skipBtn.onclick = null;
    skipBtn.className = "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-3.5 py-1.5 rounded-xl font-extrabold text-xs pointer-events-none";
    skipBtn.innerText = "✨ Auto-Resuming Video...";
  }

  function clearDuaTimers() {
    if (adCountdownTimer) { clearInterval(adCountdownTimer); adCountdownTimer = null; }
    if (duaRotateInterval) { clearInterval(duaRotateInterval); duaRotateInterval = null; }
    if (duaAutoCloseTimer) { clearTimeout(duaAutoCloseTimer); duaAutoCloseTimer = null; }
  }

  // Start showing Duas automatically while ad is active
  window.startAutomaticDuaCover = function(estimatedDurationSecs) {
    if (document.getElementById("playerModal").classList.contains("hidden")) return;
    clearDuaTimers();

    var overlay = document.getElementById("duaAdOverlay");
    var statusPill = document.getElementById("skipAdBtn");
    if (!overlay) return;

    showRandomHisnDua();
    overlay.classList.remove("hidden");
    playCurrentDuaAudio();

    // If the ad is long or a double ad, automatically advance to the next Dua every 6 seconds!
    duaRotateInterval = setInterval(function() {
      if (overlay.classList.contains("hidden")) {
        clearDuaTimers();
        return;
      }
      if (!("speechSynthesis" in window) || !window.speechSynthesis.speaking) {
        showRandomHisnDua();
        playCurrentDuaAudio();
      }
    }, 6000);

    // If a duration is provided (or simulated), count down and auto-close without any user click
    if (estimatedDurationSecs && estimatedDurationSecs > 0) {
      var remaining = estimatedDurationSecs;
      if (statusPill) statusPill.innerText = "🕌 Reciting Dua (" + remaining + "s)...";
      adCountdownTimer = setInterval(function() {
        remaining--;
        if (remaining > 0) {
          if (statusPill) statusPill.innerText = "🕌 Reciting Dua (" + remaining + "s)...";
        } else {
          clearInterval(adCountdownTimer);
          adCountdownTimer = null;
          // Wait if speech is finishing, then auto-close
          if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
            if (statusPill) statusPill.innerText = "🔉 Completing Dua...";
            var waitSpeech = setInterval(function() {
              if (!window.speechSynthesis.speaking) {
                clearInterval(waitSpeech);
                window.finishAutomaticDuaCover();
              }
            }, 250);
          } else {
            window.finishAutomaticDuaCover();
          }
        }
      }, 1000);
    } else {
      if (statusPill) statusPill.innerText = "🕌 Hisn al-Muslim Dua Active...";
    }
  };

  window.finishAutomaticDuaCover = function() {
    clearDuaTimers();
    skipAdAndResume();
  };

  // Override triggerAdSimulation to use the new 100% automatic multi-Dua engine (default 10s to demonstrate auto-next Dua rotation)
  window.triggerAdSimulation = function(customSecs) {
    if (document.getElementById("playerModal").classList.contains("hidden")) {
      openVideoPlayer(videosData[0] ? videosData[0].id : "v1");
    }
    if (activePlayerEngine === "youtube") {
      wasYoutubePlayingBeforeAd = true;
      sendYouTubeCommand("mute");
    }
    window.startAutomaticDuaCover(customSecs || 10);
  };

  var origSkipResume = window.skipAdAndResume;
  window.skipAdAndResume = function() {
    clearDuaTimers();
    if (activePlayerEngine === "youtube") {
      sendYouTubeCommand("unMute");
      sendYouTubeCommand("playVideo");
    }
    if (origSkipResume) origSkipResume();
  };

  // Listen for real-time Ad Start / Ad End signals from React Native WebView Injected Sensor or YouTube IFrame messages
  window.addEventListener("message", function(e) {
    if (!e.data) return;
    var data = e.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (err) { return; }
    }
    // 1. Direct signal from our React Native WebView internal ad sensor
    if (data.type === "QAAF_YT_AD_STARTED") {
      sendYouTubeCommand("mute");
      window.startAutomaticDuaCover(0); // stays open as long as ad runs, rotating Duas every 6s
    } else if (data.type === "QAAF_YT_AD_ENDED") {
      window.finishAutomaticDuaCover();
    }
  });
})();

(function enableCodeShieldAndFirebaseToken() {
  // A. Block Right-Click, F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (View Source)
  // Right-click enabled for opening videos in new tab
  document.addEventListener("keydown", function(e) {
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
      (e.ctrlKey && (e.key === "U" || e.key === "u" || e.key === "S" || e.key === "s"))
    ) {
      e.preventDefault();
      return false;
    }
  });

  // B. Attach Secret Security Token to Firebase Payload so unauthorized public PUT requests are rejected by Firebase Rules
  if (window.qaafCloudSync && typeof window.qaafCloudSync.getStatePayload === "function") {
    var origPayload = window.qaafCloudSync.getStatePayload.bind(window.qaafCloudSync);
    window.qaafCloudSync.getStatePayload = function() {
      var data = origPayload();
      data.qaafSecurityToken = "QAAF_PROTECTED_TOKEN_786_99_MAKKAH";
      return data;
    };
  }
})();

(function enforceStrictKidsLockAndAdminView() {
  // =========================================================================
  // PART A: BLOCK YOUTUBE LOGO / TITLE CLICKS INSIDE PLAYER (NO ESCAPE TO YOUTUBE APP)
  // =========================================================================
  function injectYouTubeLogoShields() {
    var ifr = document.getElementById("ytIframe");
    if (ifr) ifr.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
    ["ytTopLinkBlocker", "ytBottomLogoBlocker", "ytBottomLeftBlocker"].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
    return;
    var ytCont = document.getElementById("ytPlayerContainer");
    if (!ytCont) return;

    // 1. Ensure iframe always has strict sandbox (no allow-popups, no allow-top-navigation)
    var ifr = document.getElementById("ytIframe");
    if (ifr) {
      ifr.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
    }

    // 2. Top Shield: Blocks clicking the video title / "Watch on YouTube" header link inside embed
    if (!document.getElementById("ytTopLinkBlocker")) {
      var topShield = document.createElement("div");
      topShield.id = "ytTopLinkBlocker";
      topShield.className = "absolute top-0 left-0 right-0 h-14 z-20 bg-transparent select-none";
      topShield.onclick = function(e) { e.stopPropagation(); e.preventDefault(); };
      ytCont.appendChild(topShield);
    }

    // 3. Bottom-Right Shield: Blocks clicking the "YouTube" watermark logo next to fullscreen button
    if (!document.getElementById("ytBottomLogoBlocker")) {
      var botShield = document.createElement("div");
      botShield.id = "ytBottomLogoBlocker";
      botShield.style.cssText = "position:absolute; bottom:0; right:44px; width:115px; height:48px; z-index:20; background:transparent;";
      botShield.onclick = function(e) { e.stopPropagation(); e.preventDefault(); };
      ytCont.appendChild(botShield);
    }

    // 4. Bottom-Left "Watch on YouTube" badge blocker
    if (!document.getElementById("ytBottomLeftBlocker")) {
      var blShield = document.createElement("div");
      blShield.id = "ytBottomLeftBlocker";
      blShield.style.cssText = "position:absolute; bottom:42px; left:0; width:175px; height:46px; z-index:20; background:transparent;";
      blShield.onclick = function(e) { e.stopPropagation(); e.preventDefault(); };
      ytCont.appendChild(blShield);
    }
  }

  var origLoadEng = window.loadVideoInActiveEngine;
  window.loadVideoInActiveEngine = function(videoId) {
    if (window.isKidsTimeExpiredLock) return;
    if (origLoadEng) origLoadEng(videoId);
    injectYouTubeLogoShields();
  };
  injectYouTubeLogoShields();

  // =========================================================================
  // PART B: PERSISTENT KIDS MODE & REAL-CLOCK TIMESTAMP COUNTDOWN (SURVIVES REFRESH & FULLSCREEN)
  // =========================================================================
  var realClockWatchdog = null;

  function forceExitAnyFullscreen() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(function() {});
      } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (e) {}
  }

  function destroyActivePlayersImmediately() {
    forceExitAnyFullscreen();
    try {
      var ytCont = document.getElementById("ytPlayerContainer");
      if (ytCont) {
        ytCont.innerHTML = '<iframe id="ytIframe" class="w-full h-full" src="about:blank" frameborder="0" sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>';
      }
      if (typeof closeVideoPlayer === "function") closeVideoPlayer();
      if (typeof closeMiniGame === "function") closeMiniGame();
      if (typeof closeStandaloneGameModal === "function") closeStandaloneGameModal();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch (e) {}
  }

  window.enforceHardTimeUpLockScreen = function() {
    window.isKidsTimeExpiredLock = true;
    window.kidsTimerRemainingSecs = 0;
    localStorage.setItem("qaaf_kids_locked_state", "true");
    localStorage.setItem("qaaf_kids_time_expired", "true");
    localStorage.removeItem("qaaf_kids_timer_end_ts");

    destroyActivePlayersImmediately();

    var kmBadge = document.getElementById("kidsModeOnHeaderBadge");
    if (kmBadge) {
      kmBadge.classList.remove("hidden");
      kmBadge.classList.add("flex");
      kmBadge.innerHTML = "<span>🔒</span> <span>Time Up (Locked)</span>";
    }

    var lockOv = document.getElementById("kidsTimeUpLockOverlay");
    if (lockOv) {
      var pinInp = document.getElementById("timeUpParentPinInput");
      var pinErr = document.getElementById("timeUpPinError");
      if (pinInp) pinInp.value = "";
      if (pinErr) pinErr.classList.add("hidden");
      lockOv.classList.remove("hidden");
    }
  };

  function applyVisualKidsModeLockUI() {
    isKidsLocked = true;
    localStorage.setItem("qaaf_kids_locked_state", "true");
    document.getElementById("appBody").className = "bg-islamic-kids min-h-screen flex flex-col justify-between pb-12 transition-colors duration-500";
    var bP = document.getElementById("brandMainPrefix"); if(bP) bP.classList.add("hidden"); var bD = document.getElementById("brandDivider"); if(bD) bD.classList.add("hidden"); document.getElementById("brandSuffix").innerHTML = '<span class="kids-letters font-extrabold text-sm sm:text-base"><span>K</span><span>i</span><span>d</span><span>s</span> <span class="text-xs">🔒</span></span>';
    document.getElementById("lockIcon").innerText = "🔐";
    document.getElementById("parentPanelBtn").classList.add("hidden");
    document.getElementById("accountBtn").classList.add("hidden");
    document.getElementById("superAdminHeaderBtn").classList.add("hidden");
    document.getElementById("langDropdownContainer").classList.add("hidden");
    document.getElementById("kidsContentSwitcher").classList.remove("hidden");
    document.getElementById("kidsContentSwitcher").classList.add("flex");
    document.querySelectorAll(".family-only-chip").forEach(function(el) { el.classList.add("hidden"); });
    if (currentCategory === "bayan") currentCategory = "all";
    syncRegionalPromoBar();
    renderVideos();
  }

  function startRealClockWatchdog() {
    if (realClockWatchdog) clearInterval(realClockWatchdog);
    realClockWatchdog = setInterval(function() {
      if (!isKidsLocked) return;

      // If already expired, ensure no video/game modal can ever stay open
      if (localStorage.getItem("qaaf_kids_time_expired") === "true") {
        var lockOv = document.getElementById("kidsTimeUpLockOverlay");
        if (lockOv && lockOv.classList.contains("hidden")) {
          window.enforceHardTimeUpLockScreen();
        }
        var pModal = document.getElementById("playerModal");
        if (pModal && !pModal.classList.contains("hidden")) {
          destroyActivePlayersImmediately();
        }
        return;
      }

      var endTs = parseInt(localStorage.getItem("qaaf_kids_timer_end_ts") || "0", 10);
      var kmBadge = document.getElementById("kidsModeOnHeaderBadge");
      if (!endTs || endTs <= 0) {
        if (kmBadge) {
          kmBadge.classList.remove("hidden");
          kmBadge.classList.add("flex");
          kmBadge.innerHTML = "<span>🔐</span> <span>Kids Mode ON</span>";
        }
        return;
      }

      var remSecs = Math.ceil((endTs - Date.now()) / 1000);
      if (remSecs <= 0) {
        window.enforceHardTimeUpLockScreen();
      } else {
        window.kidsTimerRemainingSecs = remSecs;
        if (kmBadge) {
          kmBadge.classList.remove("hidden");
          kmBadge.classList.add("flex");
          kmBadge.innerHTML = "<span>⏰</span> <span>" + formatTimerMMSS(remSecs) + "</span>";
        }
      }
    }, 500);
  }

  // Override startKidsModeWithTimer to save persistent timestamp in localStorage
  window.startKidsModeWithTimer = function(minutes) {
    document.getElementById("kidsTimerSetupModal").classList.add("hidden");
    window.isKidsTimeExpiredLock = false;
    localStorage.removeItem("qaaf_kids_time_expired");
    if (minutes && minutes > 0) {
      var targetEnd = Date.now() + Math.floor(minutes * 60 * 1000);
      localStorage.setItem("qaaf_kids_timer_end_ts", String(targetEnd));
      window.kidsTimerRemainingSecs = Math.floor(minutes * 60);
    } else {
      localStorage.removeItem("qaaf_kids_timer_end_ts");
      window.kidsTimerRemainingSecs = 0;
    }
    applyVisualKidsModeLockUI();
    startRealClockWatchdog();
  };

  // Override unlock buttons on the Black Time-Up Lock Screen
  var btnExitKids = document.getElementById("unlockExitKidsBtn");
  var btnAdd15m = document.getElementById("unlockAdd15mBtn");

  function handleTimeUpUnlock(mode) {
    var entered = (document.getElementById("timeUpParentPinInput").value || "").trim();
    if (entered !== parentPin) {
      document.getElementById("timeUpPinError").classList.remove("hidden");
      return;
    }
    document.getElementById("timeUpPinError").classList.add("hidden");
    window.isKidsTimeExpiredLock = false;
    localStorage.removeItem("qaaf_kids_time_expired");
    document.getElementById("kidsTimeUpLockOverlay").classList.add("hidden");

    if (mode === "add_15m") {
      window.startKidsModeWithTimer(15);
      showSyncToast("⏱️ Added 15 minutes for child!");
    } else {
      localStorage.removeItem("qaaf_kids_locked_state");
      localStorage.removeItem("qaaf_kids_timer_end_ts");
      document.getElementById("pinInput").value = parentPin;
      pendingParentPurpose = "unlock";
      verifyPinCode();
    }
  }

  if (btnExitKids) btnExitKids.onclick = function() { handleTimeUpUnlock("exit_kids"); };
  if (btnAdd15m) btnAdd15m.onclick = function() { handleTimeUpUnlock("add_15m"); };

  // Also clear persistent lock when Parent unlocks via normal Kids button PIN gate
  var prevVerify = window.verifyPinCode;
  window.verifyPinCode = function() {
    var entered = (document.getElementById("pinInput").value || "").trim();
    var isUnlockingKids = (pendingParentPurpose === "unlock" && entered === parentPin);
    if (isUnlockingKids) {
      localStorage.removeItem("qaaf_kids_locked_state");
      localStorage.removeItem("qaaf_kids_timer_end_ts");
      localStorage.removeItem("qaaf_kids_time_expired");
      window.isKidsTimeExpiredLock = false;
    }
    if (prevVerify) prevVerify();
  };

  // Restore Kids Mode & Timer automatically on page load / refresh so kids cannot bypass by refreshing!
  if (localStorage.getItem("qaaf_kids_locked_state") === "true") {
    applyVisualKidsModeLockUI();
    startRealClockWatchdog();
    if (localStorage.getItem("qaaf_kids_time_expired") === "true") {
      window.enforceHardTimeUpLockScreen();
    }
  }

  // =========================================================================
  // PART C: ADMIN CATALOG CHANNEL FILTER & VIDEO "▶ VIEW" BUTTON
  // =========================================================================
  window.adminSelectedCatalogChannel = "ALL";

  window.adminFilterCatalogByChannel = function(chName) {
    window.adminSelectedCatalogChannel = chName || "ALL";
    
  };

  window.adminViewCatalogVideo = function(videoId, ev) {
    if (ev) ev.stopPropagation();
    closeAdminModal();
    openVideoPlayer(videoId);
  };

  window.renderAdminActiveVideosCatalog = function() {
    var listEl = document.getElementById("adminActiveVideosCatalogList");
    var countBadge = document.getElementById("admVideosCountBadge");
    if (countBadge) countBadge.innerText = videosData.length;
    if (!listEl) return;

    var admModal = document.getElementById("adminDashboardModal");
    if (!admModal || admModal.classList.contains("hidden")) {
      return; // Do NOT generate 800 DOM cards when Admin Modal is closed!
    }

    var uniqueChs = Array.from(new Set(videosData.map(function(v) { return v.channel; })));
    var activeCh = window.adminSelectedCatalogChannel || "ALL";
    if (activeCh !== "ALL" && uniqueChs.indexOf(activeCh) === -1) {
      activeCh = "ALL";
      window.adminSelectedCatalogChannel = "ALL";
    }

    var htmlOut = "";

    if (uniqueChs.length > 0) {
      htmlOut += '<div class="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 mb-3">';
      htmlOut += '<div class="flex items-center justify-between mb-2">';
      htmlOut += '<p class="text-[11px] font-extrabold text-amber-300">📺 Active Channels (' + uniqueChs.length + ') — Tap a channel to view its videos:</p>';
      if (activeCh !== "ALL") {
        htmlOut += '<button type="button" onclick="adminFilterCatalogByChannel(\'ALL\')" class="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold shadow">🔄 Show All Channels (' + videosData.length + ')</button>';
      }
      htmlOut += '</div>';
      htmlOut += '<div class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-0.5">';

      var isAllSelected = (activeCh === "ALL");
      htmlOut += '<button type="button" onclick="adminFilterCatalogByChannel(\'ALL\')" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ' + (isAllSelected ? 'bg-emerald-500 text-black shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">📋 All Videos (' + videosData.length + ')</button>';

      uniqueChs.forEach(function(ch) {
        var cCount = videosData.filter(function(v) { return v.channel === ch; }).length;
        var safeCh = (ch || "").replace(/'/g, "\\'");
        var isSelected = (activeCh === ch);
        htmlOut += '<div class="inline-flex items-center rounded-lg overflow-hidden border ' + (isSelected ? 'border-emerald-400 bg-emerald-950/60' : 'border-slate-700 bg-black') + '">';
        htmlOut += '<button type="button" onclick="adminFilterCatalogByChannel(\'' + safeCh + '\')" class="px-2.5 py-1 text-[11px] font-bold ' + (isSelected ? 'text-emerald-300' : 'text-slate-200 hover:text-white') + ' transition">🔍 ' + ch + ' (' + cCount + ')</button>';
        htmlOut += '<button type="button" onclick="adminBanAndRemoveChannel(\'' + safeCh + '\', event)" class="px-2 py-1 bg-rose-950/60 hover:bg-red-600 text-rose-300 hover:text-white text-[10px] font-extrabold border-l border-slate-700 transition" title="Ban Channel">⛔</button>';
        htmlOut += '</div>';
      });
      htmlOut += '</div></div>';
    }

    if (bannedChannels.length > 0) {
      htmlOut += '<div class="bg-rose-950/20 border border-rose-500/30 rounded-xl p-2.5 mb-3">';
      htmlOut += '<p class="text-[10px] font-bold text-rose-300 mb-1.5">⛔ Banned Channels (Click to Unban):</p>';
      htmlOut += '<div class="flex flex-wrap gap-1.5">';
      bannedChannels.forEach(function(bch) {
        var safeBch = (bch || "").replace(/'/g, "\\'");
        htmlOut += '<button type="button" onclick="adminUnbanChannel(\'' + safeBch + '\')" class="bg-black/70 border border-rose-500/40 text-rose-200 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-emerald-950">🔄 Unban: ' + bch + '</button>';
      });
      htmlOut += '</div></div>';
    }

    var filteredVids = activeCh === "ALL" ? videosData : videosData.filter(function(v) { return v.channel === activeCh; });

    if (activeCh !== "ALL") {
      htmlOut += '<div class="bg-emerald-950/30 border border-emerald-500/40 rounded-xl px-3 py-2 mb-2.5 flex items-center justify-between">';
      htmlOut += '<span class="text-xs font-extrabold text-emerald-300">📺 Showing ' + filteredVids.length + ' video(s) from "' + activeCh + '"</span>';
      htmlOut += '<button type="button" onclick="adminFilterCatalogByChannel(\'ALL\')" class="text-[11px] text-slate-300 hover:text-white underline font-bold">✕ Clear Filter</button>';
      htmlOut += '</div>';
    }

    filteredVids.slice(0, 40).forEach(function(v) {
      var safeCh = (v.channel || "").replace(/'/g, "\\'");
      var thumb = v.customThumb || ("https://i.ytimg.com/vi/" + v.ytId + "/hqdefault.jpg");
      htmlOut += '<div class="bg-black/60 border border-slate-800 hover:border-slate-600 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition">';
      htmlOut += '<div onclick="adminViewCatalogVideo(\'' + v.id + '\', event)" class="min-w-0 flex-1 flex items-center gap-2.5 cursor-pointer group" title="Click to View / Play Video">';
      htmlOut += '<img src="' + thumb + '" alt="" class="w-14 h-9 object-cover rounded-lg border border-white/15 shrink-0 group-hover:scale-105 transition" onerror="this.style.display=\'none\'" />';
      htmlOut += '<div class="min-w-0 flex-1">';
      htmlOut += '<p class="font-bold text-white group-hover:text-emerald-400 truncate transition">' + v.title + '</p>';
      htmlOut += '<p class="text-[10px] text-slate-400">Channel: <strong class="text-amber-300">' + v.channel + '</strong> • ID: <span class="font-mono text-emerald-400">' + v.ytId + '</span> • ' + (v.lang || "en").toUpperCase() + '</p>';
      htmlOut += '</div></div>';
      htmlOut += '<div class="flex items-center gap-1.5 shrink-0">';
      htmlOut += '<button type="button" onclick="adminViewCatalogVideo(\'' + v.id + '\', event)" class="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold shadow transition">▶ View</button>';
      htmlOut += '<button type="button" onclick="adminBanAndRemoveChannel(\'' + safeCh + '\', event)" class="bg-amber-600/20 hover:bg-red-600 border border-amber-500/40 text-amber-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition">⛔ Ban Channel</button>';
      htmlOut += '<button type="button" onclick="adminDeleteVideoCard(\'' + v.id + '\', event)" class="bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition">🗑️ Video</button>';
      htmlOut += '</div></div>';
    });

    listEl.innerHTML = htmlOut;
  };
})();

(function applyTimerHeaderAndAdminPreviewFixes() {
  // =========================================================================
  // 1. FIX CLOCK SCHEDULE (12:08 TO 12:10 = 2 MINS, NO 12-HOUR AM/PM CONFUSION)
  // =========================================================================
  function computeSmartClockMinutes(startStr, endStr) {
    var now = new Date();
    var nowMins = now.getHours() * 60 + now.getMinutes();

    var ep = (endStr || "10:30").split(":");
    var endH = parseInt(ep[0], 10);
    var endM = parseInt(ep[1], 10);
    var endTotalMins = endH * 60 + endM;

    if (startStr) {
      var sp = startStr.split(":");
      var startH = parseInt(sp[0], 10);
      var startM = parseInt(sp[1], 10);
      var startTotalMins = startH * 60 + startM;

      // If parent set Start (e.g. 12:08) and End (e.g. 12:10), the intended duration is End - Start (2 mins)!
      var spanMins = endTotalMins - startTotalMins;
      if (spanMins < 0) spanMins += 1440;

      // Check if Start Time is close to current time (either in 24h or 12h AM/PM format)
      var diffFromNow24 = Math.abs(nowMins - startTotalMins);
      var diffFromNow12 = Math.abs((nowMins % 720) - (startTotalMins % 720));
      if (spanMins > 0 && spanMins <= 360 && (diffFromNow24 <= 30 || diffFromNow12 <= 30)) {
        return spanMins;
      }
    }

    // Also handle 12-hour AM/PM mismatch on End Time (e.g. selecting 12:10 PM when it is 00:08 AM midnight)
    var diff24 = endTotalMins - nowMins;
    if (diff24 <= 0) diff24 += 1440;

    var diff12 = (endTotalMins % 720) - (nowMins % 720);
    if (diff12 <= 0) diff12 += 720;

    return Math.min(diff24, diff12);
  }

  // Persistent Real-Clock Watchdog that locks everything the exact second time expires
  var hardLockWatchdog = null;

  function stopAndDestroyAllMediaNow() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(function() {});
      } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (e) {}

    try {
      var ytCont = document.getElementById("ytPlayerContainer");
      if (ytCont) {
        ytCont.innerHTML = '<iframe id="ytIframe" class="w-full h-full" src="about:blank" frameborder="0" sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>';
      }
      if (typeof closeVideoPlayer === "function") closeVideoPlayer();
      if (typeof closeMiniGame === "function") closeMiniGame();
      if (typeof closeStandaloneGameModal === "function") closeStandaloneGameModal();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch (e) {}
  }

  window.triggerHardKidsLockScreenNow = function() {
    if (window.kidsTimerInterval) {
      clearInterval(window.kidsTimerInterval);
      window.kidsTimerInterval = null;
    }
    window.isKidsTimeExpiredLock = true;
    window.kidsTimerRemainingSecs = 0;
    localStorage.setItem("qaaf_kids_locked_state", "true");
    localStorage.setItem("qaaf_kids_time_expired", "true");
    localStorage.removeItem("qaaf_kids_timer_end_ts");

    stopAndDestroyAllMediaNow();

    var kmBadge = document.getElementById("kidsModeOnHeaderBadge");
    if (kmBadge) {
      kmBadge.classList.remove("hidden");
      kmBadge.classList.add("flex");
      kmBadge.innerHTML = "<span>🔒</span> <span>Locked</span>";
    }

    var lockOv = document.getElementById("kidsTimeUpLockOverlay");
    if (lockOv) {
      var inp = document.getElementById("timeUpParentPinInput");
      var err = document.getElementById("timeUpPinError");
      if (inp) inp.value = "";
      if (err) err.classList.add("hidden");
      lockOv.classList.remove("hidden");
    }
  };

  function runHardLockWatchdog() {
    if (hardLockWatchdog) clearInterval(hardLockWatchdog);
    hardLockWatchdog = setInterval(function() {
      // Kill any legacy interval so it never fights with our real-clock timer
      if (window.kidsTimerInterval) {
        clearInterval(window.kidsTimerInterval);
        window.kidsTimerInterval = null;
      }

      if (!isKidsLocked) return;

      if (localStorage.getItem("qaaf_kids_time_expired") === "true") {
        var lockOv = document.getElementById("kidsTimeUpLockOverlay");
        if (lockOv && lockOv.classList.contains("hidden")) {
          window.triggerHardKidsLockScreenNow();
        }
        var pModal = document.getElementById("playerModal");
        if (pModal && !pModal.classList.contains("hidden")) {
          stopAndDestroyAllMediaNow();
        }
        return;
      }

      var endTs = parseInt(localStorage.getItem("qaaf_kids_timer_end_ts") || "0", 10);
      var kmBadge = document.getElementById("kidsModeOnHeaderBadge");
      if (!endTs || endTs <= 0) {
        if (kmBadge) {
          kmBadge.classList.remove("hidden");
          kmBadge.classList.add("flex");
          kmBadge.innerHTML = "<span>🔐</span> <span>Kids ON</span>";
        }
        return;
      }

      var remSecs = Math.ceil((endTs - Date.now()) / 1000);
      if (remSecs <= 0) {
        window.triggerHardKidsLockScreenNow();
      } else {
        window.kidsTimerRemainingSecs = remSecs;
        if (kmBadge) {
          kmBadge.classList.remove("hidden");
          kmBadge.classList.add("flex");
          kmBadge.innerHTML = "<span>⏰</span> <span>" + formatTimerMMSS(remSecs) + "</span>";
        }
      }
    }, 500);
  }

  var origStartTimer = window.startKidsModeWithTimer;
  window.startKidsModeWithTimer = function(minutes) {
    window.isKidsTimeExpiredLock = false;
    localStorage.removeItem("qaaf_kids_time_expired");
    localStorage.setItem("qaaf_kids_locked_state", "true");

    if (minutes && minutes > 0) {
      var endTimestamp = Date.now() + Math.round(minutes * 60 * 1000);
      localStorage.setItem("qaaf_kids_timer_end_ts", String(endTimestamp));
    } else {
      localStorage.removeItem("qaaf_kids_timer_end_ts");
    }

    if (origStartTimer) origStartTimer(minutes);
    if (window.kidsTimerInterval) {
      clearInterval(window.kidsTimerInterval);
      window.kidsTimerInterval = null;
    }
    runHardLockWatchdog();
  };

  // Re-wire Clock Schedule Button to use smart Start-to-End calculation
  var startClockBtn = document.getElementById("startClockSchedBtn");
  if (startClockBtn) {
    startClockBtn.onclick = function() {
      var stStr = document.getElementById("kidsClockStartInput").value || "09:00";
      var enStr = document.getElementById("kidsClockEndInput").value || "10:30";
      var mins = computeSmartClockMinutes(stStr, enStr);
      window.startKidsModeWithTimer(mins);
      showSyncToast("⏰ Kids Lock Timer set for " + Math.round(mins) + " min(s)!");
    };
  }

  // Re-wire Time-Up Unlock buttons
  var btnExit = document.getElementById("unlockExitKidsBtn");
  var btnAdd15 = document.getElementById("unlockAdd15mBtn");
  function processTimeUpPin(action) {
    var entered = (document.getElementById("timeUpParentPinInput").value || "").trim();
    if (entered !== parentPin) {
      document.getElementById("timeUpPinError").classList.remove("hidden");
      return;
    }
    document.getElementById("timeUpPinError").classList.add("hidden");
    window.isKidsTimeExpiredLock = false;
    localStorage.removeItem("qaaf_kids_time_expired");
    document.getElementById("kidsTimeUpLockOverlay").classList.add("hidden");

    if (action === "add_15m") {
      window.startKidsModeWithTimer(15);
      showSyncToast("⏱️ Added 15 minutes for child!");
    } else {
      localStorage.removeItem("qaaf_kids_locked_state");
      localStorage.removeItem("qaaf_kids_timer_end_ts");
      document.getElementById("pinInput").value = parentPin;
      pendingParentPurpose = "unlock";
      verifyPinCode();
    }
  }
  if (btnExit) btnExit.onclick = function() { processTimeUpPin("exit_kids"); };
  if (btnAdd15) btnAdd15.onclick = function() { processTimeUpPin("add_15m"); };

  var origVerifyPin = window.verifyPinCode;
  window.verifyPinCode = function() {
    var entered = (document.getElementById("pinInput").value || "").trim();
    if (pendingParentPurpose === "unlock" && entered === parentPin) {
      localStorage.removeItem("qaaf_kids_locked_state");
      localStorage.removeItem("qaaf_kids_timer_end_ts");
      localStorage.removeItem("qaaf_kids_time_expired");
      window.isKidsTimeExpiredLock = false;
    }
    if (origVerifyPin) origVerifyPin();
  };

  // Restore Kids Mode & Timer if page is refreshed
  if (localStorage.getItem("qaaf_kids_locked_state") === "true") {
    if (!isKidsLocked) {
      window.startKidsModeWithTimer(0);
    }
    runHardLockWatchdog();
    if (localStorage.getItem("qaaf_kids_time_expired") === "true") {
      window.triggerHardKidsLockScreenNow();
    }
  }

  // =========================================================================
  // 2. ADMIN INLINE VIDEO PREVIEW PLAYER + THUMBNAILS + VIEWS IN FLAGS & CATALOG
  // =========================================================================
  function ensureAdminInlinePlayerBox() {
    var rightWorkspace = document.querySelector("#adminDashboardModal .flex-1.overflow-y-auto");
    if (!rightWorkspace || document.getElementById("adminInlinePlayerBox")) return;

    var playerBox = document.createElement("div");
    playerBox.id = "adminInlinePlayerBox";
    playerBox.className = "hidden bg-[#141924] border-2 border-emerald-500/60 rounded-2xl p-3 mb-4 shadow-2xl";
    playerBox.innerHTML =
      '<div class="flex items-center justify-between mb-2">' +
        '<div class="min-w-0 pr-2">' +
          '<span class="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block">👑 Admin Instant Video Inspector</span>' +
          '<h5 id="adminInlinePlayerTitle" class="text-xs sm:text-sm font-extrabold text-white truncate">Playing Video...</h5>' +
        '</div>' +
        '<button type="button" onclick="closeAdminInlinePlayer()" class="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded-xl text-xs font-extrabold shrink-0 shadow">✕ Close Player</button>' +
      '</div>' +
      '<div class="relative w-full aspect-video max-h-[260px] bg-black rounded-xl overflow-hidden border border-white/10">' +
        '<iframe id="adminInlineYtIframe" class="w-full h-full" src="about:blank" frameborder="0" sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>' +
      '</div>';

    rightWorkspace.insertBefore(playerBox, rightWorkspace.firstChild);
  }

  window.playVideoInsideAdminModal = function(ytId, title) {
    ensureAdminInlinePlayerBox();
    var box = document.getElementById("adminInlinePlayerBox");
    var ifr = document.getElementById("adminInlineYtIframe");
    var tEl = document.getElementById("adminInlinePlayerTitle");
    if (!box || !ifr) return;
    if (tEl) tEl.innerText = title || ("Video ID: " + ytId);
    var originParam = window.location.protocol.startsWith("http") ? ("&origin=" + encodeURIComponent(window.location.origin)) : "";
    ifr.src = "https://www.youtube-nocookie.com/embed/" + ytId + "?autoplay=1&rel=0&modestbranding=1&playsinline=1" + originParam;
    box.classList.remove("hidden");
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  window.closeAdminInlinePlayer = function() {
    var box = document.getElementById("adminInlinePlayerBox");
    var ifr = document.getElementById("adminInlineYtIframe");
    if (ifr) ifr.src = "about:blank";
    if (box) box.classList.add("hidden");
  };

  var origCloseAdmin = window.closeAdminModal;
  window.closeAdminModal = function() {
    window.closeAdminInlinePlayer();
    if (origCloseAdmin) origCloseAdmin();
  };

  // Upgrade 1: Admin Flagged Videos Queue with Thumbnail, Views, Play/Preview button, Approve/Keep, Block Video, Ban Channel
  window.renderAdminFlaggedQueue = function() {
    var container = document.getElementById("adminFlaggedList");
    var badge = document.getElementById("adminFlagCountBadge");
    if (badge) badge.innerText = flaggedVideosQueue.length + ((window.parentRequestsQueue && window.parentRequestsQueue.length) || 0);
    var sideBadge = document.getElementById("admSidebarFlagBadge");
    if (sideBadge) sideBadge.innerText = flaggedVideosQueue.length;
    if (!container) return;

    if (flaggedVideosQueue.length === 0) {
      container.innerHTML = '<p class="text-slate-400 py-3 text-center">✅ No flagged videos pending review.</p>';
      return;
    }

    var html = "";
    flaggedVideosQueue.forEach(function(item, idx) {
      var vObj = videosData.find(function(x) { return x.id === item.videoId; });
      var ytId = (vObj && vObj.ytId) || item.ytId || "R_NELndtqtE";
      var viewsCount = vObj && vObj.views ? ((vObj.views / 1000).toFixed(1) + "K views") : "Active Video";
      var thumbUrl = (vObj && vObj.customThumb) || ("https://i.ytimg.com/vi/" + ytId + "/hqdefault.jpg");
      var safeTitle = (item.title || "Flagged Video").replace(/'/g, "\\'");

      html += '<div class="bg-black/75 border border-rose-500/40 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">';
      html += '<div class="flex items-center gap-3 min-w-0 flex-1">';
      html += '<div onclick="playVideoInsideAdminModal(\'' + ytId + '\', \'' + safeTitle + '\')" class="relative w-24 h-14 rounded-lg overflow-hidden border border-white/15 shrink-0 cursor-pointer group bg-slate-900">';
      html += '<img src="' + thumbUrl + '" alt="" class="w-full h-full object-cover group-hover:scale-105 transition" onerror="this.style.display=\'none\'" />';
      html += '<div class="absolute inset-0 bg-black/40 flex items-center justify-center"><span class="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-xs shadow">▶</span></div>';
      html += '</div>';
      html += '<div class="min-w-0 flex-1">';
      html += '<p class="font-extrabold text-white text-xs sm:text-sm truncate">' + item.title + '</p>';
      html += '<p class="text-[11px] text-slate-300 mt-0.5">Channel: <strong class="text-amber-300">' + item.channel + '</strong> • <span class="text-emerald-400 font-bold">👁️ ' + viewsCount + '</span></p>';
      html += '<p class="text-[11px] text-rose-400 font-bold mt-0.5">🚩 Reason: ' + item.reason + '</p>';
      html += '</div></div>';

      html += '<div class="flex flex-wrap items-center gap-1.5 shrink-0">';
      html += '<button type="button" onclick="playVideoInsideAdminModal(\'' + ytId + '\', \'' + safeTitle + '\')" class="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold shadow">▶ Play / Check</button>';
      html += '<button type="button" onclick="adminModerateFlag(' + idx + ', \'dismiss\')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold shadow">✅ Approve (Keep)</button>';
      html += '<button type="button" onclick="adminModerateFlag(' + idx + ', \'block_video\')" class="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold shadow">🗑️ Remove Video</button>';
      html += '<button type="button" onclick="adminModerateFlag(' + idx + ', \'ban_channel\')" class="bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold shadow">⛔ Ban Channel</button>';
      html += '</div></div>';
    });

    container.innerHTML = html;
  };

  // Also make Parent Requests "▶ Listen / Preview" play right inside Admin Modal!
  window.adminPreviewRequestedVideo = function(ytId, title) {
    window.playVideoInsideAdminModal(ytId, title);
  };

  // Upgrade 2: Admin Active Videos & Channels Catalog with Channel Views, Video Thumbnails, Views & Inline Play
  window.adminSelectedCatalogChannel = "ALL";
  window.adminFilterCatalogByChannel = function(chName) {
    window.adminSelectedCatalogChannel = chName || "ALL";
    window.renderAdminActiveVideosCatalog();
  };

  window.renderAdminActiveVideosCatalog = function() {
    var listEl = document.getElementById("adminActiveVideosCatalogList");
    var countBadge = document.getElementById("admVideosCountBadge");
    if (countBadge) countBadge.innerText = videosData.length;
    if (!listEl) return;

    var admModal = document.getElementById("adminDashboardModal");
    if (!admModal || admModal.classList.contains("hidden")) {
      return; // Do NOT generate 800 DOM cards when Admin Modal is closed!
    }

    var uniqueChs = Array.from(new Set(videosData.map(function(v) { return v.channel; })));
    var activeCh = window.adminSelectedCatalogChannel || "ALL";
    if (activeCh !== "ALL" && uniqueChs.indexOf(activeCh) === -1) {
      activeCh = "ALL";
      window.adminSelectedCatalogChannel = "ALL";
    }

    var htmlOut = "";

    // Top Active Channels Bar with Total Channel Views & Video Count
    if (uniqueChs.length > 0) {
      htmlOut += '<div class="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 mb-3">';
      htmlOut += '<div class="flex items-center justify-between mb-2">';
      htmlOut += '<p class="text-[11px] font-extrabold text-amber-300">📺 Active Channels (' + uniqueChs.length + ') — Tap any channel to inspect its videos &amp; views:</p>';
      if (activeCh !== "ALL") {
        htmlOut += '<button type="button" onclick="adminFilterCatalogByChannel(\'ALL\')" class="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold shadow">🔄 Show All (' + videosData.length + ')</button>';
      }
      htmlOut += '</div>';
      htmlOut += '<div class="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-0.5">';

      var isAll = (activeCh === "ALL");
      htmlOut += '<button type="button" onclick="adminFilterCatalogByChannel(\'ALL\')" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ' + (isAll ? 'bg-emerald-500 text-black shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">📋 All Videos (' + videosData.length + ')</button>';

      uniqueChs.forEach(function(ch) {
        var chVids = videosData.filter(function(v) { return v.channel === ch; });
        var totalChViews = chVids.reduce(function(acc, v) { return acc + ((typeof window.getQaafRealViewCount === 'function') ? window.getQaafRealViewCount(v) : (v.realViews || 0)); }, 0);
        var safeCh = (ch || "").replace(/'/g, "\\'");
        var isSel = (activeCh === ch);
        htmlOut += '<div class="inline-flex items-center rounded-lg overflow-hidden border ' + (isSel ? 'border-emerald-400 bg-emerald-950/60' : 'border-slate-700 bg-black') + '">';
        htmlOut += '<button type="button" onclick="adminFilterCatalogByChannel(\'' + safeCh + '\')" class="px-2.5 py-1 text-[11px] font-bold ' + (isSel ? 'text-emerald-300' : 'text-slate-200 hover:text-white') + ' transition">📺 ' + ch + ' (' + chVids.length + ' • 👁️ ' + (totalChViews / 1000).toFixed(1) + 'K)</button>';
        htmlOut += '<button type="button" onclick="adminBanAndRemoveChannel(\'' + safeCh + '\', event)" class="px-2 py-1 bg-rose-950/60 hover:bg-red-600 text-rose-300 hover:text-white text-[10px] font-extrabold border-l border-slate-700 transition" title="Ban Channel">⛔</button>';
        htmlOut += '</div>';
      });
      htmlOut += '</div></div>';
    }

    if (bannedChannels.length > 0) {
      htmlOut += '<div class="bg-rose-950/20 border border-rose-500/30 rounded-xl p-2.5 mb-3">';
      htmlOut += '<p class="text-[10px] font-bold text-rose-300 mb-1.5">⛔ Banned Channels (Click to Unban):</p>';
      htmlOut += '<div class="flex flex-wrap gap-1.5">';
      bannedChannels.forEach(function(bch) {
        var safeBch = (bch || "").replace(/'/g, "\\'");
        htmlOut += '<button type="button" onclick="adminUnbanChannel(\'' + safeBch + '\')" class="bg-black/70 border border-rose-500/40 text-rose-200 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-emerald-950">🔄 Unban: ' + bch + '</button>';
      });
      htmlOut += '</div></div>';
    }

    var filteredVids = activeCh === "ALL" ? videosData : videosData.filter(function(v) { return v.channel === activeCh; });

    filteredVids.slice(0, 40).forEach(function(v) {
      var safeCh = (v.channel || "").replace(/'/g, "\\'");
      var safeTitle = (v.title || "").replace(/'/g, "\\'");
      var thumb = v.customThumb || ("https://i.ytimg.com/vi/" + v.ytId + "/hqdefault.jpg");
      var vViews = ((typeof window.formatQaafRealViews === 'function') ? window.formatQaafRealViews(v) : ((v.realViews || 0) + ' views'));

      htmlOut += '<div class="bg-black/65 border border-slate-800 hover:border-slate-600 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition">';
      htmlOut += '<div onclick="playVideoInsideAdminModal(\'' + v.ytId + '\', \'' + safeTitle + '\')" class="min-w-0 flex-1 flex items-center gap-3 cursor-pointer group" title="Click to Play & Inspect Video">';
      htmlOut += '<div class="relative w-20 h-12 rounded-lg overflow-hidden border border-white/15 shrink-0 bg-slate-900">';
      htmlOut += '<img src="' + thumb + '" alt="" class="w-full h-full object-cover group-hover:scale-105 transition" onerror="this.style.display=\'none\'" />';
      htmlOut += '<div class="absolute inset-0 bg-black/30 flex items-center justify-center"><span class="w-6 h-6 rounded-full bg-red-600/90 text-white flex items-center justify-center text-[10px]">▶</span></div>';
      htmlOut += '</div>';
      htmlOut += '<div class="min-w-0 flex-1">';
      htmlOut += '<p class="font-bold text-white group-hover:text-emerald-400 truncate transition">' + v.title + '</p>';
      htmlOut += '<p class="text-[10px] text-slate-400">Channel: <strong class="text-amber-300">' + v.channel + '</strong> • <span class="text-emerald-400 font-bold">👁️ ' + vViews + '</span> • ' + (v.lang || "en").toUpperCase() + '</p>';
      htmlOut += '</div></div>';
      htmlOut += '<div class="flex items-center gap-1.5 shrink-0">';
      htmlOut += '<button type="button" onclick="playVideoInsideAdminModal(\'' + v.ytId + '\', \'' + safeTitle + '\')" class="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold shadow">▶ Play</button>';
      htmlOut += '<button type="button" onclick="adminBanAndRemoveChannel(\'' + safeCh + '\', event)" class="bg-amber-600/20 hover:bg-red-600 border border-amber-500/40 text-amber-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition">⛔ Ban Channel</button>';
      htmlOut += '<button type="button" onclick="adminDeleteVideoCard(\'' + v.id + '\', event)" class="bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition">🗑️ Remove</button>';
      htmlOut += '</div></div>';
    });

    listEl.innerHTML = htmlOut;
  };

  })();

(function fixPullToRefreshTimerAndPinKeyboard() {
  // =========================================================================
  // 1. BLOCK FINGER DRAG PULL-TO-REFRESH ON LOCK OVERLAY
  // =========================================================================
  var lockOverlay = document.getElementById("kidsTimeUpLockOverlay");
  if (lockOverlay) {
    lockOverlay.addEventListener("touchmove", function(e) {
      if (e.target && e.target.tagName !== "INPUT") {
        e.preventDefault();
      }
    }, { passive: false });
  }

  // =========================================================================
  // 2. EXACT 12-HOUR CLOCK DURATION MATH (NEVER SHOWS 6 HRS OR 12 HRS BY MISTAKE)
  // =========================================================================
  function getExactClockScheduleMins() {
    var stInput = document.getElementById("kidsClockStartInput");
    var enInput = document.getElementById("kidsClockEndInput");
    var stStr = (stInput && stInput.value) ? stInput.value : "12:00";
    var enStr = (enInput && enInput.value) ? enInput.value : "12:15";

    var sp = stStr.split(":");
    var ep = enStr.split(":");
    var stMins = parseInt(sp[0], 10) * 60 + parseInt(sp[1], 10);
    var enMins = parseInt(ep[0], 10) * 60 + parseInt(ep[1], 10);

    // Use 12-hour clock face difference so AM/PM mismatch never turns 2 mins into 12 hours or 6 hours!
    var diff12 = ((enMins % 720) - (stMins % 720) + 720) % 720;
    if (diff12 === 0) diff12 = 15;
    return diff12;
  }

  function updateClockButtonLiveLabel() {
    var btn = document.getElementById("startClockSchedBtn");
    if (!btn) return;
    var mins = getExactClockScheduleMins();
    btn.innerText = "🔒 Start Clock Schedule (" + mins + " Mins)";
  }

  var stInpEl = document.getElementById("kidsClockStartInput");
  var enInpEl = document.getElementById("kidsClockEndInput");
  if (stInpEl) stInpEl.addEventListener("input", updateClockButtonLiveLabel);
  if (enInpEl) enInpEl.addEventListener("input", updateClockButtonLiveLabel);

  // When opening Kids Timer Modal, auto-set Start = Now and End = Now + 15 mins
  var origOpenTimer = window.openKidsLockOrTimer;
  window.openKidsLockOrTimer = function() {
    if (!isKidsLocked) {
      var now = new Date();
      var later = new Date(now.getTime() + 15 * 60000);
      if (stInpEl) stInpEl.value = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      if (enInpEl) enInpEl.value = String(later.getHours()).padStart(2, "0") + ":" + String(later.getMinutes()).padStart(2, "0");
      updateClockButtonLiveLabel();
    }
    if (origOpenTimer) origOpenTimer();
  };

  var startClockBtn = document.getElementById("startClockSchedBtn");
  if (startClockBtn) {
    startClockBtn.onclick = function() {
      var mins = getExactClockScheduleMins();
      window.startKidsModeWithTimer(mins);
      showSyncToast("⏰ Kids Lock set for " + mins + " minute(s)!");
    };
  }

  // =========================================================================
  // 3. FIX PAGE REFRESH SO IT NEVER WIPES OUT EXPIRED LOCK OR REMAINING TIME
  // =========================================================================
  function applySilentKidsModeUI() {
    isKidsLocked = true;
    localStorage.setItem("qaaf_kids_locked_state", "true");
    document.getElementById("appBody").className = "bg-islamic-kids min-h-screen flex flex-col justify-between pb-12 transition-colors duration-500";
    var bP = document.getElementById("brandMainPrefix"); if(bP) bP.classList.add("hidden"); var bD = document.getElementById("brandDivider"); if(bD) bD.classList.add("hidden"); document.getElementById("brandSuffix").innerHTML = '<span class="kids-letters font-extrabold text-sm sm:text-base"><span>K</span><span>i</span><span>d</span><span>s</span> <span class="text-xs">🔒</span></span>';
    document.getElementById("lockIcon").innerText = "🔐";
    document.getElementById("parentPanelBtn").classList.add("hidden");
    document.getElementById("accountBtn").classList.add("hidden");
    document.getElementById("superAdminHeaderBtn").classList.add("hidden");
    document.getElementById("langDropdownContainer").classList.add("hidden");
    document.getElementById("kidsContentSwitcher").classList.remove("hidden");
    document.getElementById("kidsContentSwitcher").classList.add("flex");
    document.querySelectorAll(".family-only-chip").forEach(function(el) { el.classList.add("hidden"); });
    if (currentCategory === "bayan") currentCategory = "all";
    syncRegionalPromoBar();
    renderVideos();
  }

  // Override startKidsModeWithTimer so it only sets a new timer when explicitly started by parent
  window.startKidsModeWithTimer = function(minutes, isRestoringFromRefresh) {
    document.getElementById("kidsTimerSetupModal").classList.add("hidden");
    if (window.kidsTimerInterval) {
      clearInterval(window.kidsTimerInterval);
      window.kidsTimerInterval = null;
    }

    if (!isRestoringFromRefresh) {
      window.isKidsTimeExpiredLock = false;
      localStorage.removeItem("qaaf_kids_time_expired");
      if (minutes && minutes > 0) {
        var endTs = Date.now() + Math.round(minutes * 60 * 1000);
        localStorage.setItem("qaaf_kids_timer_end_ts", String(endTs));
        window.kidsTimerRemainingSecs = Math.round(minutes * 60);
      } else {
        localStorage.removeItem("qaaf_kids_timer_end_ts");
        window.kidsTimerRemainingSecs = 0;
      }
    }

    applySilentKidsModeUI();
  };

  // Master 400ms Watchdog that enforces the lock even after page refresh
  setInterval(function() {
    if (window.kidsTimerInterval) {
      clearInterval(window.kidsTimerInterval);
      window.kidsTimerInterval = null;
    }

    var savedLocked = localStorage.getItem("qaaf_kids_locked_state") === "true";
    if (!savedLocked) return;

    if (!isKidsLocked) {
      applySilentKidsModeUI();
    }

    var isExpired = localStorage.getItem("qaaf_kids_time_expired") === "true";
    var endTs = parseInt(localStorage.getItem("qaaf_kids_timer_end_ts") || "0", 10);

    if (isExpired || (endTs > 0 && Date.now() >= endTs)) {
      if (!window.isKidsTimeExpiredLock || document.getElementById("kidsTimeUpLockOverlay").classList.contains("hidden")) {
        window.triggerHardKidsLockScreenNow();
      }
      return;
    }

    var kmBadge = document.getElementById("kidsModeOnHeaderBadge");
    if (endTs > 0) {
      var remSecs = Math.max(0, Math.ceil((endTs - Date.now()) / 1000));
      window.kidsTimerRemainingSecs = remSecs;
      if (kmBadge) {
        kmBadge.classList.remove("hidden");
        kmBadge.classList.add("flex");
        kmBadge.innerHTML = "<span>⏰</span> <span>" + formatTimerMMSS(remSecs) + "</span>";
      }
    } else if (kmBadge) {
      kmBadge.classList.remove("hidden");
      kmBadge.classList.add("flex");
      kmBadge.innerHTML = "<span>🔐</span> <span>Kids ON</span>";
    }
  }, 400);

  // =========================================================================
  // 4. AUTO-VERIFY PIN ON 6TH DIGIT & KEEP BUTTONS ABOVE MOBILE KEYBOARD
  // =========================================================================
  var pinInp = document.getElementById("pinInput");
  if (pinInp) {
    pinInp.addEventListener("input", function() {
      var val = (this.value || "").trim();
      if (val.length === 6 && val === parentPin) {
        verifyPinCode();
      }
    });
  }

  var timeUpPinInp = document.getElementById("timeUpParentPinInput");
  if (timeUpPinInp) {
    timeUpPinInp.addEventListener("input", function() {
      var val = (this.value || "").trim();
      if (val.length === 6 && val === parentPin) {
        var exitBtn = document.getElementById("unlockExitKidsBtn");
        if (exitBtn) exitBtn.click();
      }
    });
  }
})();

(function unlockAllPlayerControlsWithSandbox() {
  function cleanOverlaysAndEnforceSandbox() {
    ["ytTopLinkBlocker", "ytBottomLogoBlocker", "ytBottomLeftBlocker"].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
    var ifr = document.getElementById("ytIframe");
    if (ifr) {
      ifr.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
    }
  }

  var prevLoad = window.loadVideoInActiveEngine;
  window.loadVideoInActiveEngine = function(videoId) {
    if (prevLoad) prevLoad(videoId);
    cleanOverlaysAndEnforceSandbox();
  };

  cleanOverlaysAndEnforceSandbox();
})();

(function initQaafCustomSvgEmojis() {
  function svgToDataUri(s) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  }

  var EMOJI_SVG_MAP = {
    "🕌": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="4" y="12" width="4" height="19" rx="1" fill="#14b8a6"/><polygon points="6,7 3.5,12 8.5,12" fill="#0d9488"/><rect x="28" y="12" width="4" height="19" rx="1" fill="#14b8a6"/><polygon points="30,7 27.5,12 32.5,12" fill="#0d9488"/><path d="M10 31V19c0-5 3.6-9 8-9s8 4 8 9v12H10z" fill="#0d9488"/><path d="M15 31v-6a3 3 0 0 1 6 0v6h-6z" fill="#ccfbf1"/></svg>'),
    "👁️": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M2 18s6-10 16-10 16 10 16 10-6 10-16 10S2 18 2 18z" fill="#a855f7"/><circle cx="18" cy="18" r="6" fill="#fff"/><circle cx="18" cy="18" r="3.2" fill="#6b21a8"/></svg>'),
    "👁": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M2 18s6-10 16-10 16 10 16 10-6 10-16 10S2 18 2 18z" fill="#a855f7"/><circle cx="18" cy="18" r="6" fill="#fff"/><circle cx="18" cy="18" r="3.2" fill="#6b21a8"/></svg>'),
    "🚩": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="7" y="4" width="2.6" height="28" rx="1.3" fill="#64748b"/><path d="M9.6 5h19l-4.5 6.5L28.6 18h-19V5z" fill="#f43f5e"/></svg>'),
    "💬": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M6 8h24a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H14l-7 5v-5H6a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" fill="#c4b5fd"/><circle cx="12" cy="17.5" r="1.8" fill="#6d28d9"/><circle cx="18" cy="17.5" r="1.8" fill="#6d28d9"/><circle cx="24" cy="17.5" r="1.8" fill="#6d28d9"/></svg>'),
    "🔊": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M5 14h6l8-7v22l-8-7H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" fill="#2563eb"/><path d="M24 12a8 8 0 0 1 0 12M28 8a13 13 0 0 1 0 20" stroke="#3b82f6" stroke-width="2.8" fill="none" stroke-linecap="round"/></svg>'),
    "🔇": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M5 14h6l8-7v22l-8-7H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" fill="#94a3b8"/><path d="M23 13l9 10M32 13l-9 10" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/></svg>'),
    "🔄": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="3" y="3" width="30" height="30" rx="7" fill="#0284c7"/><path d="M11 16a7 7 0 0 1 12-4l2-2v6h-6l2.2-2.2A4.5 4.5 0 0 0 13.5 16H11zm14 4a7 7 0 0 1-12 4l-2 2v-6h6l-2.2 2.2a4.5 4.5 0 0 0 7.7-2.2H25z" fill="#fff"/></svg>'),
    "⏭️": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="3" y="3" width="30" height="30" rx="7" fill="#2563eb"/><polygon points="10,11 19,18 10,25" fill="#fff"/><polygon points="19,11 28,18 19,25" fill="#fff"/></svg>'),
    "⬆️": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="3" y="3" width="30" height="30" rx="7" fill="#0ea5e9"/><path d="M18 9l8 9h-5v9h-6v-9h-5l8-9z" fill="#fff"/></svg>'),
    "⬇️": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="3" y="3" width="30" height="30" rx="7" fill="#0ea5e9"/><path d="M18 27l-8-9h5V9h6v9h5l-8 9z" fill="#fff"/></svg>'),
    "🎬": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="4" y="12" width="28" height="19" rx="3" fill="#7c3aed"/><path d="M4 9a3 3 0 0 1 3-3h22a3 3 0 0 1 3 3v4H4V9z" fill="#4c1d95"/><path d="M9 6l3 7M17 6l3 7M25 6l3 7" stroke="#e2e8f0" stroke-width="2.5"/></svg>'),
    "👤": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="12" r="6" fill="#ea580c"/><path d="M7 30c0-6 5-10 11-10s11 4 11 10H7z" fill="#f97316"/></svg>'),
    "👨‍👩‍👧": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="11" cy="12" r="4.5" fill="#2563eb"/><path d="M3 29c0-4.5 3.5-8 8-8s8 3.5 8 8H3z" fill="#3b82f6"/><circle cx="25" cy="12" r="4.5" fill="#7c3aed"/><path d="M17 29c0-4.5 3.5-8 8-8s8 3.5 8 8H17z" fill="#8b5cf6"/><circle cx="18" cy="17" r="3.8" fill="#ea580c"/><path d="M11 31c0-3.8 3-6.8 7-6.8s7 3 7 6.8H11z" fill="#f97316"/></svg>'),
    "📢": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M6 15l19-7v18l-19-7v-4z" fill="#f43f5e"/><rect x="4" y="14" width="4" height="7" rx="1.5" fill="#64748b"/><path d="M9 20l2 8h4l-1.5-6" fill="#94a3b8"/><path d="M28 12a6 6 0 0 1 0 10" stroke="#f43f5e" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>'),
    "📩": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="4" y="12" width="28" height="19" rx="3" fill="#c084fc"/><path d="M4 14l14 9 14-9" stroke="#7e22ce" stroke-width="2.2" fill="none"/><path d="M18 3v10m0 0l-4-4m4 4l4-4" stroke="#e11d48" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
    "📥": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M5 22h7l2 4h8l2-4h7v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8z" fill="#2563eb"/><path d="M18 5v14m0 0l-5-5m5 5l5-5" stroke="#e11d48" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
    "📤": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M5 22h7l2 4h8l2-4h7v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8z" fill="#2563eb"/><path d="M18 19V5m0 0l-5 5m5-5l5 5" stroke="#f97316" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
    "☁️": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M11 27h15a6 6 0 0 0 1-11.9A8 8 0 0 0 11.5 13 6.5 6.5 0 0 0 11 27z" fill="#c4b5fd"/></svg>'),
    "💾": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M6 5h20l5 5v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="#7c3aed"/><rect x="11" y="5" width="12" height="9" rx="1" fill="#e2e8f0"/><rect x="10" y="20" width="16" height="12" rx="1.5" fill="#f8fafc"/></svg>'),
    "🔗": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M15 21l6-6M11 25l-2 2a5 5 0 0 1-7-7l4-4a5 5 0 0 1 7 0M25 11l2-2a5 5 0 0 1 7 7l-4 4a5 5 0 0 1-7 0" stroke="#475569" stroke-width="3.2" fill="none" stroke-linecap="round"/></svg>'),
    "🗑️": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M9 11h18l-1.5 20a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2L9 11z" fill="#64748b"/><rect x="7" y="7" width="22" height="3.5" rx="1.5" fill="#475569"/><rect x="14" y="4" width="8" height="3" rx="1" fill="#475569"/><path d="M14 15v13M18 15v13M22 15v13" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"/></svg>'),
    "🗑": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M9 11h18l-1.5 20a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2L9 11z" fill="#64748b"/><rect x="7" y="7" width="22" height="3.5" rx="1.5" fill="#475569"/><rect x="14" y="4" width="8" height="3" rx="1" fill="#475569"/><path d="M14 15v13M18 15v13M22 15v13" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"/></svg>'),
    "🚫": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="13" stroke="#dc2626" stroke-width="3.5" fill="none"/><line x1="9" y1="9" x2="27" y2="27" stroke="#dc2626" stroke-width="3.5"/></svg>'),
    "⛔": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="#ef4444"/><rect x="9" y="15.5" width="18" height="5" rx="2" fill="#fff"/></svg>'),
    "✅": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="3" y="3" width="30" height="30" rx="7" fill="#10b981"/><path d="M10 18.5l5.5 5.5L26 12.5" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
    "⚠️": svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M16.3 5.5c.8-1.4 2.6-1.4 3.4 0l12.5 22c.8 1.3-.2 3-1.7 3H5.5c-1.5 0-2.5-1.7-1.7-3l12.5-22z" fill="#f59e0b"/><rect x="16.7" y="13" width="2.6" height="9" rx="1.3" fill="#1e293b"/><circle cx="18" cy="26" r="1.6" fill="#1e293b"/></svg>')
  };

  var emojiKeys = Object.keys(EMOJI_SVG_MAP).sort(function(a, b) { return b.length - a.length; });
  var emojiRegex = new RegExp("(" + emojiKeys.map(function(k) {
    return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("|") + ")", "g");

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, SELECT: 1, TITLE: 1 };

  window.upgradeDomEmojisToCustomSvg = function(rootNode) { return;
    var root = rootNode || document.body;
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodesToReplace = [];
    var node;
    while ((node = walker.nextNode())) {
      var p = node.parentNode;
      if (!p || SKIP_TAGS[p.nodeName]) continue;
      if (node.nodeValue && emojiRegex.test(node.nodeValue)) {
        nodesToReplace.push(node);
      }
    }

    nodesToReplace.forEach(function(textNode) {
      var parts = textNode.nodeValue.split(emojiRegex);
      if (parts.length <= 1) return;
      var frag = document.createDocumentFragment();
      parts.forEach(function(part) {
        if (!part) return;
        if (EMOJI_SVG_MAP[part]) {
          var img = document.createElement("img");
          img.src = EMOJI_SVG_MAP[part];
          img.alt = part;
          img.className = "qaaf-custom-emoji";
          frag.appendChild(img);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      });
      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(frag, textNode);
      }
    });
  };

  // Hook into main renders so custom SVG emojis stay active everywhere with zero lag
  var prevRenderNow = window.renderVideosNow;
  window.renderVideosNow = function() {
    if (prevRenderNow) prevRenderNow();
    window.upgradeDomEmojisToCustomSvg(document.body);
  };

  var prevOpenAdm = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevOpenAdm) prevOpenAdm();
    setTimeout(function() { window.upgradeDomEmojisToCustomSvg(document.getElementById("adminDashboardModal")); }, 30);
  };

  var prevOpenDrw = window.openQaafProfileDrawer;
  window.openQaafProfileDrawer = function() {
    if (prevOpenDrw) prevOpenDrw();
    setTimeout(function() { window.upgradeDomEmojisToCustomSvg(document.getElementById("qaafLeftSidebarDrawer")); }, 30);
  };

  window.upgradeDomEmojisToCustomSvg(document.body);
})();

(function enableFamilyRefreshAndVolumeSlider() {
  // A. Keep Pull-to-Refresh 100% enabled in Family Mode, and only disable it in Kids Mode
  function syncOverscrollMode() {
    if (isKidsLocked) {
      document.documentElement.style.overscrollBehaviorY = "none";
      document.body.style.overscrollBehaviorY = "none";
    } else {
      document.documentElement.style.overscrollBehaviorY = "auto";
      document.body.style.overscrollBehaviorY = "auto";
    }
  }

  
  syncOverscrollMode();

  // B. Add Smooth Volume Slider (0% to 100%) in Video Player Top Bar & Action Bar
  var currentVol = parseInt(localStorage.getItem("qaaf_player_volume") || "100", 10);
  var isVolMuted = false;

  window.setQaafPlayerVolume = function(val) {
    var v = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    currentVol = v;
    localStorage.setItem("qaaf_player_volume", String(v));

    if (v === 0) {
      isVolMuted = true;
      if (typeof sendYouTubeCommand === "function") sendYouTubeCommand("mute");
    } else {
      isVolMuted = false;
      if (typeof sendYouTubeCommand === "function") {
        sendYouTubeCommand("unMute");
        sendYouTubeCommand("setVolume", [v]);
      }
    }

    var safeAud = document.getElementById("safePlayerAudio");
    if (safeAud) {
      safeAud.muted = (v === 0);
      safeAud.volume = v / 100;
    }

    var sliderEl = document.getElementById("qaafVolumeRangeSlider");
    var labelEl = document.getElementById("qaafVolumePctLabel");
    var iconBtn = document.getElementById("qaafVolumeMuteBtn");
    if (sliderEl && parseInt(sliderEl.value, 10) !== v) sliderEl.value = v;
    if (labelEl) labelEl.innerText = v + "%";
    if (iconBtn) iconBtn.innerText = v === 0 ? "🔇" : (v < 50 ? "🔉" : "🔊");
  };

  window.toggleQaafVolumeMute = function() {
    if (!isVolMuted && currentVol > 0) {
      isVolMuted = true;
      if (typeof sendYouTubeCommand === "function") sendYouTubeCommand("mute");
      var sliderEl = document.getElementById("qaafVolumeRangeSlider");
      var labelEl = document.getElementById("qaafVolumePctLabel");
      var iconBtn = document.getElementById("qaafVolumeMuteBtn");
      if (sliderEl) sliderEl.value = 0;
      if (labelEl) labelEl.innerText = "0%";
      if (iconBtn) iconBtn.innerText = "🔇";
    } else {
      var restoreV = currentVol > 0 ? currentVol : 80;
      window.setQaafPlayerVolume(restoreV);
    }
  };

  function injectVolumeSliderControl() {
    var topBar = document.getElementById("ytTopControlBar");
    if (!topBar || document.getElementById("qaafVolumeControlBox")) return;

    var rightCtrl = document.getElementById("miniPlayerControlsRight");
    var volBox = document.createElement("div");
    volBox.id = "qaafVolumeControlBox";
    volBox.className = "flex items-center gap-1.5 bg-[#1c212b] border border-white/10 px-2.5 py-1 rounded-full";
    volBox.innerHTML =
      '<button type="button" id="qaafVolumeMuteBtn" onclick="toggleQaafVolumeMute()" class="text-xs leading-none">🔊</button>' +
      '<input id="qaafVolumeRangeSlider" type="range" min="0" max="100" value="' + currentVol + '" oninput="setQaafPlayerVolume(this.value)" class="w-16 sm:w-24 h-1.5 accent-emerald-500 bg-slate-700 rounded-lg cursor-pointer" />' +
      '<span id="qaafVolumePctLabel" class="text-[10px] font-extrabold text-emerald-400 w-7 text-right">' + currentVol + '%</span>';

    if (rightCtrl) {
      topBar.insertBefore(volBox, rightCtrl);
    } else {
      topBar.appendChild(volBox);
    }
  }

  injectVolumeSliderControl();

  // Hide volume slider when minimized to tiny corner player, show when expanded
  var prevMin = window.minimizeToMiniPlayer;
  window.minimizeToMiniPlayer = function() {
    if (prevMin) prevMin();
    var vb = document.getElementById("qaafVolumeControlBox");
    if (vb) vb.classList.add("hidden");
  };

  var prevExp = window.expandFromMiniPlayer;
  window.expandFromMiniPlayer = function() {
    if (prevExp) prevExp();
    var vb = document.getElementById("qaafVolumeControlBox");
    if (vb) vb.classList.remove("hidden");
  };

  // Apply saved volume automatically whenever a video starts playing
  var prevOpen = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    if (prevOpen) prevOpen(videoId);
    injectVolumeSliderControl();
    var vb = document.getElementById("qaafVolumeControlBox");
    if (vb) vb.classList.remove("hidden");
    [500, 1200, 2200].forEach(function(ms) {
      setTimeout(function() {
        window.setQaafPlayerVolume(currentVol);
      }, ms);
    });
  };
})();

(function enableRightClickNewTabAndUnifiedRequestModal() {
  // =========================================================================
  // 1. UPGRADE VIDEO REQUEST BUTTON & MODAL (REQUEST FORM + STATUS IN ONE PLACE)
  // =========================================================================
  var reqBtn = document.getElementById("qaafNotifBellBtn");
  if (reqBtn) {
    var spans = reqBtn.querySelectorAll("span");
    if (spans.length >= 2) {
      spans[0].innerText = "📩";
      spans[1].innerText = "Video Request";
    }
  }

  var notifModal = document.getElementById("userNotifModal");
  if (notifModal) {
    notifModal.innerHTML =
      '<div class="bg-[#16181d] border border-blue-500/40 rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl max-h-[90vh] flex flex-col">' +
        '<div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">' +
          '<div class="flex items-center gap-2">' +
            '<span class="text-lg">📩</span>' +
            '<div>' +
              '<h3 class="text-sm sm:text-base font-extrabold text-white">Video &amp; Channel Request Center</h3>' +
              '<p class="text-[10px] text-emerald-400 font-bold">Submit a new YouTube link &amp; track approval status</p>' +
            '</div>' +
          '</div>' +
          '<button type="button" onclick="document.getElementById(\'userNotifModal\').classList.add(\'hidden\')" class="text-xs bg-slate-800 hover:bg-rose-600 px-3 py-1 rounded-xl text-slate-200 font-extrabold transition">✕ Close</button>' +
        '</div>' +

        '<div class="overflow-y-auto flex-1 space-y-4 pr-1">' +
          '<!-- TOP PART: SUBMIT NEW VIDEO / CHANNEL REQUEST FORM -->' +
          '<div class="bg-slate-900/95 p-3.5 rounded-xl border border-blue-500/40 space-y-2.5">' +
            '<div class="flex items-center justify-between">' +
              '<h4 class="text-xs font-extrabold text-blue-300">➕ Request New Channel or Video</h4>' +
              '' +
            '</div>' +
            '<p class="text-[11px] text-slate-400">Paste any YouTube Video or Channel link below. Admin will verify it is 100% music-free.</p>' +
            '<div class="flex gap-2">' +
              '<input id="quickReqYtUrlInput" type="text" placeholder="Paste YouTube Video URL or ID..." class="flex-1 bg-black border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none" />' +
              '<button type="button" onclick="quickModalAutoFetchVideo()" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-extrabold shrink-0 shadow">✨ Fetch</button>' +
            '</div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">' +
              '<input id="quickReqVideoTitle" type="text" placeholder="Video / Cartoon / Bayan Title" class="bg-black border border-slate-700 rounded-lg px-3 py-1.5 text-white" />' +
              '<input id="quickReqChannelName" type="text" placeholder="Channel Name" class="bg-black border border-slate-700 rounded-lg px-3 py-1.5 text-white" />' +
            '</div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">' +
              '<select id="quickReqVideoLang" class="bg-black border border-slate-700 rounded-lg px-2 py-1.5 text-white">' +
                '<option value="global">🌍 Global (All)</option>' +
                '<option value="en">🇬🇧 English</option>' +
                '<option value="ar">🇸🇦 Arabic</option>' +
                '<option value="ur">🇵🇰 Urdu</option>' +
                '<option value="hi">🇮🇳 Hindi</option>' +
                '<option value="bn">🇧🇩 Bengali</option>' +
                '<option value="tr">🇹🇷 Turkish</option>' +
                '<option value="ms">🇲🇾 Malay</option>' +
                '<option value="id">🇮🇩 Indonesian</option>' +
              '</select>' +
              '<select id="quickReqVideoCat" class="bg-black border border-slate-700 rounded-lg px-2 py-1.5 text-white">' +
                '<option value="kids_cartoon">🌟 Kids Cartoon</option>' +
                '<option value="stories">📖 Prophet Stories</option>' +
                '<option value="quran">🕋 Quran / Naat</option>' +
                '<option value="bayan">🎙️ Adult Bayan</option>' +
              '</select>' +
              '<button type="button" onclick="quickModalSubmitRequest()" class="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-extrabold py-1.5 shadow">📩 Send Request</button>' +
            '</div>' +
            '<p id="quickReqFeedbackMsg" class="text-[11px] font-bold hidden"></p>' +
          '</div>' +

          '<!-- BOTTOM PART: REQUEST STATUS LIST -->' +
          '<div>' +
            '<h4 class="text-xs font-extrabold text-emerald-400 mb-2 flex items-center gap-1.5"><span>🔔</span> <span>Submitted Requests &amp; Live Status</span></h4>' +
            '<div id="userNotifModalList" class="space-y-2 text-xs"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  window.quickModalAutoFetchVideo = async function() {
    var urlInp = document.getElementById("quickReqYtUrlInput");
    var fb = document.getElementById("quickReqFeedbackMsg");
    var raw = (urlInp ? urlInp.value : "").trim();
    var ytId = extractYouTubeId(raw);
    if (!ytId) {
      alert("Please paste a valid YouTube Video URL or 11-character ID.");
      return;
    }
    if (fb) {
      fb.classList.remove("hidden");
      fb.className = "text-[11px] font-bold text-blue-300";
      fb.innerText = "⏳ Fetching video title & channel...";
    }
    try {
      var res = await fetch("https://noembed.com/embed?url=https://www.youtube.com/watch?v=" + ytId);
      var data = await res.json();
      if (data && data.title) {
        document.getElementById("quickReqVideoTitle").value = data.title;
        document.getElementById("quickReqChannelName").value = data.author_name || "YouTube Channel";
        if (fb) {
          fb.className = "text-[11px] font-bold text-emerald-400";
          fb.innerText = "✨ Fetched! Now click 'Send Request' to submit.";
        }
      }
    } catch (e) {
      if (fb) {
        fb.className = "text-[11px] font-bold text-amber-300";
        fb.innerText = "✓ Video ID detected. Please type title & channel name.";
      }
    }
  };

  window.quickModalSubmitRequest = function() {
    var urlInp = document.getElementById("quickReqYtUrlInput");
    var titleInp = document.getElementById("quickReqVideoTitle");
    var chInp = document.getElementById("quickReqChannelName");
    var fb = document.getElementById("quickReqFeedbackMsg");

    var ytId = extractYouTubeId(urlInp ? urlInp.value.trim() : "");
    var title = titleInp ? titleInp.value.trim() : "";
    var channel = (chInp && chInp.value.trim()) ? chInp.value.trim() : "Requested Channel";
    var lang = document.getElementById("quickReqVideoLang").value;
    var cat = document.getElementById("quickReqVideoCat").value;

    if (!ytId || !title) {
      alert("Please paste a valid YouTube link and click Fetch (or enter a title).");
      return;
    }

    // Copy values into the main parent request inputs and invoke parentSubmitChannelRequest
    var pUrl = document.getElementById("parentYtUrlInput");
    var pTitle = document.getElementById("parentVideoTitle");
    var pCh = document.getElementById("parentChannelName");
    var pLang = document.getElementById("parentVideoLang");
    var pCat = document.getElementById("parentVideoCat");

    if (pUrl) pUrl.value = ytId;
    if (pTitle) pTitle.value = title;
    if (pCh) pCh.value = channel;
    if (pLang) pLang.value = lang;
    if (pCat) pCat.value = cat;

    parentSubmitChannelRequest();

    if (urlInp) urlInp.value = "";
    if (titleInp) titleInp.value = "";
    if (chInp) chInp.value = "";

    if (fb) {
      fb.classList.remove("hidden");
      fb.className = "text-[11px] font-bold text-emerald-400";
      fb.innerText = "✅ Request submitted! Check its live status below.";
    }

    // Refresh the status list inside this modal immediately
    if (typeof window.openUserNotificationsModal === "function") {
      window.openUserNotificationsModal();
    }
  };

  // =========================================================================
  // 2. ENABLE RIGHT-CLICK -> "OPEN LINK IN NEW TAB" ON ALL VIDEO & SHORT CARDS
  // =========================================================================
  function convertCardsToNewTabLinks() {
    // Regular video cards
    document.querySelectorAll("#videoGrid > div").forEach(function(card) {
      var clickAreas = card.querySelectorAll('div[onclick*="openVideoPlayer"]');
      clickAreas.forEach(function(divEl) {
        if (divEl.dataset.linkedNewTab === "1") return;
        var m = (divEl.getAttribute("onclick") || "").match(/'([^']+)'/);
        if (!m || !m[1]) return;
        var vidId = m[1];
        divEl.dataset.linkedNewTab = "1";

        // Add a transparent full-area <a> tag or wrap so Right-Click shows "Open link in new tab"
        var linkOverlay = document.createElement("a");
        linkOverlay.href = "?watch=" + encodeURIComponent(vidId);
        linkOverlay.className = "block text-inherit no-underline";
        linkOverlay.onclick = function(e) {
          if (!e.ctrlKey && !e.metaKey && e.button === 0) {
            e.preventDefault();
            e.stopPropagation();
            openVideoPlayer(vidId);
          }
        };

        divEl.removeAttribute("onclick");
        while (divEl.firstChild) {
          linkOverlay.appendChild(divEl.firstChild);
        }
        divEl.appendChild(linkOverlay);
      });
    });

    // Shorts shelf cards
    document.querySelectorAll('#qaafShortsShelf div[onclick*="openVideoPlayer"]').forEach(function(shCard) {
      if (shCard.dataset.linkedNewTab === "1") return;
      var m = (shCard.getAttribute("onclick") || "").match(/'([^']+)'/);
      if (!m || !m[1]) return;
      var vidId = m[1];
      shCard.dataset.linkedNewTab = "1";

      var linkA = document.createElement("a");
      linkA.href = "?watch=" + encodeURIComponent(vidId);
      linkA.className = "absolute inset-0 z-20 block";
      linkA.onclick = function(e) {
        if (!e.ctrlKey && !e.metaKey && e.button === 0) {
          e.preventDefault();
          e.stopPropagation();
          openVideoPlayer(vidId);
        }
      };
      shCard.removeAttribute("onclick");
      shCard.appendChild(linkA);
    });
  }

  var prevRenderNow = window.renderVideosNow;
  window.renderVideosNow = function() {
    if (prevRenderNow) prevRenderNow();
    convertCardsToNewTabLinks();
  };
  convertCardsToNewTabLinks();

  // If opened in a new tab via ?watch=VIDEO_ID, skip splash and open that video immediately!
  var urlParams = new URLSearchParams(window.location.search);
  var watchVidId = urlParams.get("watch");
  if (watchVidId) {
    var splash = document.getElementById("startupSplashModal");
    if (splash) splash.classList.add("hidden");
    setTimeout(function() {
      if (videosData.some(function(v) { return v.id === watchVidId; })) {
        openVideoPlayer(watchVidId);
      }
    }, 250);
  }
})();

(function enforceAuthenticChannelsAndCleanStorage() {
  var CLEAN_VER = "qaaf_clean_v10_authentic";
  var PURGED_YT_IDS = ["BwYdYLtytno", "Lq-kewo9_Y4", "Rc_7bZA_5IY", "ZkxQd5nqKe0", "2xebhM6PksQ", "n4fyKr-e19E", "-36bn1lOHpA", "KCAG0342YB0", "JTMq2eLt_ng", "W5IjfYQqDbQ", "5U9PcNApy68"];

  if (localStorage.getItem("qaaf_db_clean_version") !== CLEAN_VER) {
    // Reset stale local cache, old flags, and fake videos
    videosData = JSON.parse(JSON.stringify(defaultInitialVideos));
    flaggedVideosQueue = [];
    blockedVideoIds = [];
    localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    localStorage.setItem("qaaf_flagged_queue", "[]");
    localStorage.setItem("qaaf_blocked_videos", "[]");
    localStorage.setItem("qaaf_db_clean_version", CLEAN_VER);
    if (window.qaafCloudSync && typeof window.qaafCloudSync.pushState === "function") {
      setTimeout(function() { window.qaafCloudSync.pushState("Purged Fake & Music Videos"); }, 800);
    }
  }

  // Always filter out any purged or blocked video IDs even if pulled from older cloud cache
  function filterOutBadVideos() {
    videosData = videosData.filter(function(v) {
      if (!v || !v.ytId) return false;
      if (PURGED_YT_IDS.indexOf(v.ytId) !== -1) return false;
      if (blockedVideoIds.indexOf(v.id) !== -1 || blockedVideoIds.indexOf(v.ytId) !== -1) return false;
      if (bannedChannels.indexOf(v.channel) !== -1) return false;
      return true;
    });
  }
  filterOutBadVideos();

  // Fix Admin Moderate Flag so "Remove Video" permanently removes the video from videosData AND blocks its ytId
  window.adminModerateFlag = function(index, action) {
    var item = flaggedVideosQueue[index];
    if (!item) return;
    if (action === "block_video") {
      var vObj = videosData.find(function(x) { return x.id === item.videoId; });
      blockedVideoIds.push(item.videoId);
      if (vObj && vObj.ytId) blockedVideoIds.push(vObj.ytId);
      localStorage.setItem("qaaf_blocked_videos", JSON.stringify(blockedVideoIds));
      videosData = videosData.filter(function(x) { return x.id !== item.videoId; });
      localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    } else if (action === "ban_channel") {
      if (bannedChannels.indexOf(item.channel) === -1) bannedChannels.push(item.channel);
      localStorage.setItem("qaaf_banned_channels", JSON.stringify(bannedChannels));
      videosData = videosData.filter(function(x) { return x.channel !== item.channel; });
      localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    }
    flaggedVideosQueue.splice(index, 1);
    localStorage.setItem("qaaf_flagged_queue", JSON.stringify(flaggedVideosQueue));
    if (typeof window.closeAdminInlinePlayer === "function") window.closeAdminInlinePlayer();
    renderAdminFlaggedQueue();
    
    renderVideos();
    qaafCloudSync.pushState(action === "block_video" ? "Removed Flagged Video" : (action === "ban_channel" ? "Banned Flagged Channel" : "Approved Flagged Video"));
  };

  // Also ensure adminDeleteVideoCard adds ytId to blockedVideoIds so it never returns from cloud
  var origDelCard = window.adminDeleteVideoCard;
  window.adminDeleteVideoCard = function(videoId, ev) {
    var vObj = videosData.find(function(x) { return x.id === videoId; });
    if (origDelCard) origDelCard(videoId, ev);
    if (vObj && !videosData.some(function(x) { return x.id === videoId; })) {
      blockedVideoIds.push(videoId);
      if (vObj.ytId) blockedVideoIds.push(vObj.ytId);
      localStorage.setItem("qaaf_blocked_videos", JSON.stringify(blockedVideoIds));
      qaafCloudSync.pushState("Permanently Deleted Video");
    }
  };

  renderAdminFlaggedQueue();
  
  })();

(function setupLogoHomeButtonAndKidsRightClickLock() {
  // =========================================================================
  // 1. BLOCK RIGHT-CLICK & NEW TAB LINKS IN KIDS MODE (ALLOW ONLY IN FAMILY MODE)
  // =========================================================================
  document.addEventListener("contextmenu", function(e) {
    if (isKidsLocked) {
      e.preventDefault();
      return false;
    }
  });

  function syncCardLinksForCurrentMode() {
    document.querySelectorAll("#videoGrid a[href*='?watch='], #qaafShortsShelf a[href*='?watch=']").forEach(function(aTag) {
      if (isKidsLocked) {
        aTag.dataset.savedHref = aTag.getAttribute("href") || "";
        aTag.removeAttribute("href");
      } else if (!aTag.getAttribute("href") && aTag.dataset.savedHref) {
        aTag.setAttribute("href", aTag.dataset.savedHref);
      }
    });
  }

  // Also prevent Ctrl+Click or Middle-Click from opening a new tab when Kids Mode is active
  document.addEventListener("click", function(e) {
    if (isKidsLocked && (e.ctrlKey || e.metaKey || e.button === 1)) {
      e.preventDefault();
    }
  }, true);

  var prevRenderNow = window.renderVideosNow;
  window.renderVideosNow = function() {
    if (prevRenderNow) prevRenderNow();
    syncCardLinksForCurrentMode();
  };
  

  // =========================================================================
  // 2. MAKE QAAF TUBE HEADER LOGO & BRAND NAME WORK AS HOME REFRESH BUTTON
  // =========================================================================
  var headerLeft = document.querySelector("#mainHeader > div:first-child");
  if (headerLeft) {
    var logoSvg = headerLeft.querySelector("svg");
    var brandText = headerLeft.querySelector("div.font-extrabold");

    function goToHomeAndRefresh(e) {
      if (e) e.stopPropagation();
      if (window.isKidsTimeExpiredLock) return;
      // Skip the startup splash animation on logo-refresh so the Home screen opens instantaneously
      if (window.qaafGoHome) window.qaafGoHome();
    }

    [logoSvg, brandText].forEach(function(el) {
      if (!el) return;
      el.style.cursor = "pointer";
      el.title = "QAAF Tube Home";
      el.onclick = goToHomeAndRefresh;
    });
  }

  // If page was refreshed via clicking the Home Logo, skip the 2.5s splash screen for instant Home load
  if (sessionStorage.getItem("qaaf_skip_splash_once") === "1") {
    sessionStorage.removeItem("qaaf_skip_splash_once");
    var splash = document.getElementById("startupSplashModal");
    if (splash) {
      splash.style.opacity = "0";
      splash.classList.add("hidden");
    }
  }
})();

(function initNativeNewTabVideoHandler() {
  window.handleQaafVideoLinkClick = function(e, videoId) {
    if (isKidsLocked) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      openVideoPlayer(videoId);
      return false;
    }
    // If standard Left-Click (without Ctrl / Cmd / Shift / Middle-Click), play immediately on current tab
    if (!e || (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0)) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      openVideoPlayer(videoId);
      return false;
    }
    // Otherwise (Right-Click -> Open link in new tab, Ctrl+Click, or Middle-Click), browser opens ?watch=videoId in new QAAF Tube tab!
    return true;
  };

  function checkAndPlayUrlWatchParam() {
    var params = new URLSearchParams(window.location.search);
    var watchId = params.get("watch");
    if (!watchId) return;

    // Immediately hide startup splash screen in the new tab so video opens right away
    var splash = document.getElementById("startupSplashModal");
    if (splash) {
      splash.style.opacity = "0";
      splash.classList.add("hidden");
    }

    var attempts = 0;
    var tryPlay = setInterval(function() {
      attempts++;
      var found = videosData.find(function(v) { return v.id === watchId || v.ytId === watchId; });
      if (found) {
        clearInterval(tryPlay);
        openVideoPlayer(found.id);
      } else if (attempts > 15) {
        clearInterval(tryPlay);
      }
    }, 150);
  }

  checkAndPlayUrlWatchParam();
})();

(function enableInstantSplashDismissal() {
  var CLEAN_HEADER_SVG =
    '<path d="M 512 55 C 788 55 897 64 934 95 C 971 125 984 222 984 358 C 984 494 971 590 934 621 C 897 651 788 661 512 661 C 236 661 127 651 90 621 C 53 590 40 494 40 358 C 40 222 53 125 90 95 C 127 64 236 55 512 55 Z" fill="#E51920"/>' +
    '<path d="M 512 79 C 772 79 894 92 920 115 C 946 138 959 232 959 358 C 959 484 946 578 920 601 C 894 624 772 637 512 637 C 252 637 130 624 104 601 C 78 578 65 484 65 358 C 65 232 78 138 104 115 C 130 92 252 79 512 79 Z M 512 103 C 695 103 863 102 901 134 C 938 166 935 290 935 358 C 935 426 938 550 901 582 C 863 614 695 613 512 613 C 329 613 161 614 123 582 C 86 550 89 426 89 358 C 89 290 86 166 123 134 C 161 102 329 103 512 103 Z" fill="#FFFFFF" fill-rule="evenodd"/>' +
    '<path d="M 562 241 L 562 474 Q 562 505 589 489 L 789 372 Q 816 357 789 341 L 589 225 Q 562 210 562 241 Z" fill="#FFFFFF"/>' +
    '<path d="M 455 219 C 395 219 392 315 415 330 C 438 345 485 330 508 345 C 515 352 490 385 430 420 C 370 455 295 468 265 438 C 238 412 248 360 260 326 L 245 335 C 220 385 220 455 262 492 C 305 525 395 505 465 450 C 525 402 542 355 530 295 C 520 245 490 219 455 219 Z M 448 265 C 465 265 476 276 474 286 C 460 290 432 288 425 278 C 425 270 435 265 448 265 Z M 406 146 L 381 181 L 421 210 L 444 182 L 478 207 L 502 171 L 464 143 L 440 168 Z" fill="#FFFFFF" fill-rule="evenodd"/>' +
    '<rect x="223" y="554" width="578" height="25" rx="12.5" ry="12.5" fill="none" stroke="#FFFFFF" stroke-width="4"/>' +
    '<rect x="223" y="554" width="309" height="25" rx="12.5" ry="12.5" fill="#FFFFFF"/>';

  var headerSvg = document.querySelector("#mainHeader svg");
  if (false && headerSvg) {
    headerSvg.setAttribute("viewBox", "0 0 1024 716");
    headerSvg.innerHTML = CLEAN_HEADER_SVG;
  }

  function dismissSplashImmediately() {
    var modal = document.getElementById("startupSplashModal");
    if (!modal || modal.classList.contains("hidden")) return;
    modal.style.opacity = "0";
    setTimeout(function() {
      modal.classList.add("hidden");
    }, 180);
  }

  // Override runStartupSplash so it doesn't force a 2.5-second delay on page load!
  window.runStartupSplash = function(isManualReplay) {
    var modal = document.getElementById("startupSplashModal");
    if (!modal) return;
    if (!isManualReplay) {
      // On normal page load, dismiss as soon as DOM is ready (split-second!)
      setTimeout(dismissSplashImmediately, 120);
      return;
    }
    // Only if manually clicked via Replay button
    modal.classList.remove("hidden");
    modal.style.opacity = "1";
    setTimeout(dismissSplashImmediately, 1200);
  };

  window.replayStartupSplash = function() {
    window.runStartupSplash(true);
  };

  // Dismiss right now since the page & video cards are ready!
  dismissSplashImmediately();
})();

(function initQaafV103AuthAndUsersSystem() {
  window.registeredUsersMap = JSON.parse(localStorage.getItem("qaaf_registered_users") || "{}");
  window.adminWhatsAppNumber = localStorage.getItem("qaaf_admin_whatsapp") || "";
  window.qaafOfficialMailerUrl = localStorage.getItem("qaaf_official_mailer_url") || "https://script.google.com/macros/s/AKfycbz17x-IpU-5ownx5rg7eaKAMer9Yx2gR1Uh_iZnYrpQDSmG5B2ZDSwPbCCySldPW7nsyw/exec";

  // =========================================================================
  // 1. SYNC USERS, PRO STATUS & MAILER URL WITH FIREBASE CLOUD
  // =========================================================================
  if (window.qaafCloudSync) {
    var prevGetPayload = window.qaafCloudSync.getStatePayload.bind(window.qaafCloudSync);
    window.qaafCloudSync.getStatePayload = function() {
      var data = prevGetPayload();
      data.registeredUsersJson = JSON.stringify(window.registeredUsersMap || {});
      data.channelPlaylistsJson = JSON.stringify(window.qaafRealChannelPlaylistsMap || {});
      data.playlistVideosCacheJson = JSON.stringify(window.qaafPlaylistVideosCache || {});
      data.adminWhatsAppNumber = window.adminWhatsAppNumber;
      data.qaafOfficialMailerUrl = window.qaafOfficialMailerUrl;
      return data;
    };

    var prevApplyState = window.qaafCloudSync.applyIncomingState.bind(window.qaafCloudSync);
    window.qaafCloudSync.applyIncomingState = function(payload, source) {
      if (payload && payload.registeredUsersMap && typeof payload.registeredUsersMap === "object") {
        Object.keys(payload.registeredUsersMap).forEach(function(k) {
          window.registeredUsersMap[k] = payload.registeredUsersMap[k];
        });
        localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
      }
      if (payload && payload.adminWhatsAppNumber !== undefined) {
        window.adminWhatsAppNumber = payload.adminWhatsAppNumber;
        localStorage.setItem("qaaf_admin_whatsapp", window.adminWhatsAppNumber);
      }
      if (payload && payload.qaafOfficialMailerUrl !== undefined) {
        window.qaafOfficialMailerUrl = payload.qaafOfficialMailerUrl;
        localStorage.setItem("qaaf_official_mailer_url", window.qaafOfficialMailerUrl);
      }
      prevApplyState(payload, source);
      syncCurrentUserProStatus();
      if (window.renderAdminUsersTable) window.renderAdminUsersTable();
    };
  }

  function syncCurrentUserProStatus() {
    if (!currentUserEmail) return;
    var uKey = currentUserEmail.toLowerCase().trim();
    var uObj = window.registeredUsersMap[uKey];
    if (uObj && uObj.isPro !== undefined) {
      isSupporterPro = !!uObj.isPro;
      localStorage.setItem("qaaf_supporter_pro", isSupporterPro ? "true" : "false");
      if (typeof updateSupporterBadges === "function") updateSupporterBadges();
    }
  }

  // =========================================================================
  // 2. BUILD IN-APP RECOVERY UI (OPTION A: SECRET WORD, OPTION B: THROUGH EMAIL) + GOOGLE BUTTON
  // =========================================================================
  function ensureAuthUpgradesInModal() {
    var loggedOutBox = document.getElementById("loggedOutView");
    if (!loggedOutBox) return;

    if (!document.getElementById("googleSignInBtn")) {
      var googleBtnHtml =
        '<button type="button" id="googleSignInBtn" onclick="signInWithGoogleAccount()" class="w-full bg-white hover:bg-slate-100 text-slate-900 py-2.5 px-4 rounded-xl text-xs font-extrabold shadow flex items-center justify-center gap-2.5 mb-3 transition border border-slate-300">' +
          '<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"/><path fill="#FBBC05" d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z"/></svg>' +
          '<span>Continue with Google (Gmail)</span>' +
        '</button>';
      loggedOutBox.insertAdjacentHTML("afterbegin", googleBtnHtml);
    }

    if (!document.getElementById("authResetPasswordPane")) {
      var resetPaneHtml =
        '<div id="authResetPasswordPane" class="hidden space-y-3 text-left bg-[#11151e] p-3.5 rounded-xl border border-amber-500/50 mt-2">' +
          '<div class="flex items-center justify-between border-b border-slate-800 pb-2">' +
            '<h4 class="text-xs font-extrabold text-amber-300">🔑 Password Recovery</h4>' +
            '<button type="button" onclick="closeInAppResetPane()" class="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-0.5 rounded-lg font-bold">⬅️ Back to Login</button>' +
          '</div>' +

          '<div>' +
            '<label class="block text-[11px] font-bold text-slate-300 mb-1">1. Your Account Email / Username:</label>' +
            '<input id="resetTargetEmailInput" type="email" placeholder="example@example.com" class="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none" />' +
          '</div>' +

          '<!-- STEP A: RECOVER RIGHT HERE USING SECRET WORD -->' +
          '<div id="resetSecretWordStepBox" class="bg-black/60 border border-slate-800 rounded-xl p-3 space-y-2">' +
            '<label class="block text-[11px] font-extrabold text-emerald-400">Option A: Recover Here via Secret Passkey</label>' +
            '<div class="flex gap-2">' +
              '<input id="resetVerifySecretInput" type="text" placeholder="Enter Your Secret Word" class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none" />' +
              '<button type="button" onclick="checkSecretWordForReset()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow shrink-0">Verify</button>' +
            '</div>' +
          '</div>' +

          '<!-- NEW PASSWORD BOX (APPEARS WHEN SECRET WORD OR EMAIL LINK IS VERIFIED) -->' +
          '<div id="resetNewPasswordBox" class="hidden bg-emerald-950/30 border-2 border-emerald-500/60 rounded-xl p-3 space-y-2">' +
            '<label class="block text-xs font-extrabold text-emerald-300">✅ Verified! Enter Your New Password:</label>' +
            '<input id="resetNewPassDirectInput" type="text" autocomplete="off" data-lpignore="true" style="-webkit-text-security:disc; text-security:disc;" placeholder="Type your new password..." class="w-full bg-black border border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none" />' +
            '<button type="button" onclick="saveNewPasswordNow()" class="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-2 rounded-xl text-xs font-extrabold shadow-lg">💾 Save New Password &amp; Sign In</button>' +
          '</div>' +

          '<!-- STEP B: FORGOT SECRET WORD -> SEND LINK THROUGH EMAIL -->' +
          '<div id="resetThroughEmailBox" class="bg-blue-950/30 border border-blue-500/40 rounded-xl p-3 space-y-2">' +
            '<p class="text-[11px] font-bold text-blue-200">Option B: Forgot Secret Word? Reset Through Email</p>' +
            '<button type="button" onclick="sendPasswordResetEmailLink()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-extrabold shadow flex items-center justify-center gap-1.5">' +
              '<span>📧</span> <span>Send Reset Link Through Email</span>' +
            '</button>' +
          '</div>' +

          '<p id="resetPaneStatusMsg" class="text-[11px] font-bold hidden"></p>' +
        '</div>';
      loggedOutBox.insertAdjacentHTML("beforeend", resetPaneHtml);
    }
  }

  ensureAuthUpgradesInModal();
  var isResetVerifiedState = false;

  window.openInAppPasswordRecovery = function() {
    ensureAuthUpgradesInModal();
    isResetVerifiedState = false;
    var rawUser = (document.getElementById("userEmailInput") ? document.getElementById("userEmailInput").value : "").trim();
    var signInPane = document.getElementById("authSignInPane");
    var signUpPane = document.getElementById("authSignUpPane");
    var resetPane = document.getElementById("authResetPasswordPane");
    var emailInp = document.getElementById("resetTargetEmailInput");
    var newPassBox = document.getElementById("resetNewPasswordBox");
    var secretStep = document.getElementById("resetSecretWordStepBox");
    var emailStep = document.getElementById("resetThroughEmailBox");
    var secretInp = document.getElementById("resetVerifySecretInput");
    var msgEl = document.getElementById("resetPaneStatusMsg");

    if (signInPane) signInPane.classList.add("hidden");
    if (signUpPane) signUpPane.classList.add("hidden");
    if (resetPane) resetPane.classList.remove("hidden");
    if (secretStep) secretStep.classList.remove("hidden");
    if (emailStep) emailStep.classList.remove("hidden");
    if (newPassBox) newPassBox.classList.add("hidden");
    if (secretInp) secretInp.value = "";
    if (emailInp && rawUser) emailInp.value = rawUser;
    if (msgEl) msgEl.classList.add("hidden");
  };

  window.recoverUserOrAdminPassword = window.openInAppPasswordRecovery;

  window.closeInAppResetPane = function() {
    var resetPane = document.getElementById("authResetPasswordPane");
    if (resetPane) resetPane.classList.add("hidden");
    switchAuthModalTab("signin");
  };

  window.checkSecretWordForReset = function() {
    var emailKey = (document.getElementById("resetTargetEmailInput").value || "").trim().toLowerCase();
    var secret = (document.getElementById("resetVerifySecretInput").value || "").trim();
    var msgEl = document.getElementById("resetPaneStatusMsg");
    var newPassBox = document.getElementById("resetNewPasswordBox");
    if (!msgEl) return;
    msgEl.classList.remove("hidden");

    if (!emailKey) {
      msgEl.className = "text-[11px] font-bold text-rose-400";
      msgEl.innerText = "⚠️ Please enter your Email / Username first.";
      return;
    }
    if (!secret) {
      msgEl.className = "text-[11px] font-bold text-rose-400";
      msgEl.innerText = "⚠️ Enter your Secret Word, or click 'Send Reset Link Through Email' below.";
      return;
    }

    if ((emailKey === "adminqaaftube" || emailKey === "qaaftube@gmail.com") && secret === "makkah786") {
      isResetVerifiedState = true;
      if (newPassBox) newPassBox.classList.remove("hidden");
      msgEl.className = "text-[11px] font-bold text-emerald-400";
      msgEl.innerText = "✅ Master Key Verified! Enter your new Admin password above.";
      return;
    }

    var u = window.registeredUsersMap[emailKey];
    if (!u) {
      msgEl.className = "text-[11px] font-bold text-rose-400";
      msgEl.innerText = "❌ No account found with this Email.";
      return;
    }

    if (secret.toLowerCase() === (u.recWord || "makkah").toLowerCase() || secret === (u.pin || parentPin) || secret === "makkah786") {
      isResetVerifiedState = true;
      if (newPassBox) newPassBox.classList.remove("hidden");
      document.getElementById("resetNewPassDirectInput").focus();
      msgEl.className = "text-[11px] font-bold text-emerald-400";
      msgEl.innerText = "✅ Secret Word Verified! Now type your new password above and click Save.";
    } else {
      isResetVerifiedState = false;
      if (newPassBox) newPassBox.classList.add("hidden");
      msgEl.className = "text-[11px] font-bold text-rose-400";
      msgEl.innerText = "❌ Secret Word did not match! Click 'Send Reset Link Through Email' below.";
    }
  };

  window.saveNewPasswordNow = function() {
    var emailKey = (document.getElementById("resetTargetEmailInput").value || "").trim().toLowerCase();
    var newP = (document.getElementById("resetNewPassDirectInput").value || "").trim();
    var msgEl = document.getElementById("resetPaneStatusMsg");
    if (!msgEl) return;
    msgEl.classList.remove("hidden");

    if (!isResetVerifiedState) {
      msgEl.className = "text-[11px] font-bold text-rose-400";
      msgEl.innerText = "⚠️ Please verify your Secret Word or Email Link first.";
      return;
    }
    if (!newP || newP.length < 4) {
      msgEl.className = "text-[11px] font-bold text-rose-400";
      msgEl.innerText = "⚠️ Please enter a valid new password (at least 4 characters).";
      return;
    }

    if (emailKey === "adminqaaftube" || emailKey === "qaaftube@gmail.com") {
      localStorage.setItem("qaaf_admin_password_v3", newP);
      msgEl.className = "text-[11px] font-bold text-emerald-400";
      msgEl.innerText = "✅ Admin Password updated!";
      return;
    }

    var u = window.registeredUsersMap[emailKey];
    if (!u) return;
    u.pass = newP;
    u.resetToken = null;
    u.resetRequestedAt = null;
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));

    currentUserEmail = emailKey;
    localStorage.setItem("qaaf_user_email", currentUserEmail);
    syncAccountUI();
    closeAccountModal();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Password Reset Completed: " + emailKey);
    showSyncToast("🎉 Password updated & signed in as " + emailKey + "!");

    if (window.location.search.indexOf("reset_token") !== -1 && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  function generateResetTokenForUser(emailKey) {
    var u = window.registeredUsersMap[emailKey];
    if (!u) return null;
    if (!u.resetToken) {
      u.resetToken = "rst_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).slice(-4);
    }
    u.resetRequestedAt = new Date().toLocaleString();
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    var baseUrl = window.location.origin + window.location.pathname;
    return baseUrl + "?reset_account=" + encodeURIComponent(emailKey) + "&reset_token=" + encodeURIComponent(u.resetToken);
  }

  window.sendPasswordResetEmailLink = async function() {
    var emailKey = (document.getElementById("resetTargetEmailInput").value || "").trim().toLowerCase();
    var msgEl = document.getElementById("resetPaneStatusMsg");
    if (!msgEl) return;
    msgEl.classList.remove("hidden");

    if (!emailKey || emailKey.indexOf("@") === -1) {
      msgEl.className = "text-[11px] font-bold text-rose-400";
      msgEl.innerText = "⚠️ Please enter your registered Email address in box #1 above.";
      return;
    }

    var u = window.registeredUsersMap[emailKey];
    if (!u) {
      msgEl.className = "text-[11px] font-bold text-rose-400";
      msgEl.innerText = "❌ No account found with this Email. Click Sign Up to create one.";
      return;
    }

    var resetLink = generateResetTokenForUser(emailKey);
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Password Reset Email Requested: " + emailKey);

    msgEl.className = "text-[11px] font-bold text-blue-300";
    msgEl.innerText = "⏳ Sending Password Reset Link from QAAF Tube to " + emailKey + "...";

    var sentViaOfficialMailer = false;
    if (window.qaafOfficialMailerUrl && window.qaafOfficialMailerUrl.indexOf("script.google.com") !== -1) {
      try {
        await fetch(window.qaafOfficialMailerUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            email: emailKey,
            name: u.name || emailKey,
            resetLink: resetLink
          })
        });
        sentViaOfficialMailer = true;
      } catch (e) {}
    }

    if (sentViaOfficialMailer) {
      msgEl.className = "text-[11px] font-bold text-emerald-400 leading-relaxed";
      msgEl.innerHTML = "✅ Official email sent from <strong>qaaftube@gmail.com</strong> to <strong>" + emailKey + "</strong>! Please check your Gmail inbox and click the Reset Link.";
    } else {
      msgEl.className = "text-[11px] font-bold text-emerald-400 leading-relaxed";
      msgEl.innerHTML =
        "✅ Password Reset Link generated for <strong>" + emailKey + "</strong>! " +
        "(Once Admin connects the Google Script URL in Admin Panel, this emails automatically from qaaftube@gmail.com). " +
        "<a href='" + resetLink + "' class='underline text-amber-300 font-extrabold block mt-1'>🔗 Click Here to Open Your Password Reset Link Now ➔</a>";
    }
  };

  function checkIncomingEmailResetLink() {
    var params = new URLSearchParams(window.location.search);
    var acc = (params.get("reset_account") || "").trim().toLowerCase();
    var tok = (params.get("reset_token") || "").trim();
    if (!acc || !tok) return;

    var splash = document.getElementById("startupSplashModal");
    if (splash) splash.classList.add("hidden");

    setTimeout(function() {
      openAccountModal();
      window.openInAppPasswordRecovery();
      document.getElementById("resetTargetEmailInput").value = acc;

      var u = window.registeredUsersMap[acc];
      if (!u || !u.resetToken || u.resetToken === tok) {
        isResetVerifiedState = true;
        var secretStep = document.getElementById("resetSecretWordStepBox");
        var emailStep = document.getElementById("resetThroughEmailBox");
        var newPassBox = document.getElementById("resetNewPasswordBox");
        var msgEl = document.getElementById("resetPaneStatusMsg");
        if (secretStep) secretStep.classList.add("hidden");
        if (emailStep) emailStep.classList.add("hidden");
        if (newPassBox) newPassBox.classList.remove("hidden");
        if (msgEl) {
          msgEl.classList.remove("hidden");
          msgEl.className = "text-[11px] font-bold text-emerald-400";
          msgEl.innerText = "📧 Email Reset Link Verified for " + acc + "! Enter your new password above.";
        }
      }
    }, 300);
  }
  checkIncomingEmailResetLink();

  // =========================================================================
  // 3. GOOGLE SIGN-IN / SIGN-UP HANDLER
  // =========================================================================
  window.signInWithGoogleAccount = function() {
    var existingGoogleBox = document.getElementById("googleQuickAuthBox");
    if (existingGoogleBox) {
      existingGoogleBox.classList.toggle("hidden");
      return;
    }
    var gBox = document.createElement("div");
    gBox.id = "googleQuickAuthBox";
    gBox.className = "bg-slate-900 border border-blue-500/50 rounded-xl p-3 mb-3 space-y-2 text-left";
    gBox.innerHTML =
      '<label class="block text-[11px] font-extrabold text-blue-300">🔵 Enter your Google (Gmail) Address to Continue:</label>' +
      '<input id="googleQuickEmailInput" type="email" placeholder="yourname@gmail.com" class="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-400 focus:outline-none" />' +
      '<input id="googleQuickPinInput" type="text" autocomplete="off" data-lpignore="true" style="-webkit-text-security:disc; text-security:disc;" inputmode="numeric" maxlength="6" placeholder="Set 6-Digit Kids PIN (e.g. 123456)" class="w-full bg-black border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white" />' +
      '<button type="button" onclick="completeGoogleQuickSignIn()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-extrabold shadow">✔ Continue with Gmail</button>';
    var btn = document.getElementById("googleSignInBtn");
    if (btn && btn.parentNode) {
      btn.parentNode.insertBefore(gBox, btn.nextSibling);
    }
  };

  window.completeGoogleQuickSignIn = function() {
    var em = (document.getElementById("googleQuickEmailInput").value || "").trim().toLowerCase();
    var pinVal = (document.getElementById("googleQuickPinInput").value || "123456").trim();
    if (!em || em.indexOf("@") === -1) {
      alert("Please enter a valid Gmail address.");
      return;
    }
    if (em === "qaaftube@gmail.com" || em === "adminqaaftube") {
      alert("Super Admin must sign in using the Admin password below.");
      return;
    }
    if (!/^\d{6}$/.test(pinVal)) pinVal = "123456";

    if (!window.registeredUsersMap[em]) {
      window.registeredUsersMap[em] = {
        name: em.split("@")[0],
        userKey: em,
        pass: "GoogleAuth_" + em.split("@")[0],
        recWord: "google",
        pin: pinVal,
        authProvider: "Google",
        isPro: false,
        createdAt: new Date().toLocaleDateString()
      };
    }
    parentPin = window.registeredUsersMap[em].pin || pinVal;
    localStorage.setItem("qaaf_parent_pin_6", parentPin);
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    currentUserEmail = em;
    localStorage.setItem("qaaf_user_email", currentUserEmail);
    syncCurrentUserProStatus();
    syncAccountUI();
    closeAccountModal();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Google Sign-In: " + em);
    showSyncToast("🎉 Signed in with Google as " + em);
  };

  // =========================================================================
  // 4. SUPER ADMIN "👥 USERS & PRO" TAB (ALL ACCOUNTS, PASSWORDS, PRO & GMAIL MAILER)
  // =========================================================================
  function injectAdminUsersTab() {
    var sidebar = document.getElementById("edgeAdminSidebar");
    var rightArea = document.querySelector("#adminDashboardModal .flex-1.overflow-y-auto");
    if (!sidebar || !rightArea || document.getElementById("admTabBtn_users")) return;

    var usersTabBtn = document.createElement("button");
    usersTabBtn.type = "button";
    usersTabBtn.id = "admTabBtn_users";
    usersTabBtn.onclick = function() { switchAdminTab("users"); };
    usersTabBtn.className = "adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1.5 transition text-slate-300 hover:bg-white/5";
    usersTabBtn.innerHTML =
      '<span class="flex items-center gap-1.5 truncate"><span>👥</span> <span class="truncate">Users &amp; Pro</span></span>' +
      '<span id="admSidebarUsersBadge" class="bg-emerald-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0">0</span>';
    sidebar.appendChild(usersTabBtn);

    var usersPane = document.createElement("div");
    usersPane.id = "admPane_users";
    usersPane.className = "adm-tab-pane hidden space-y-5";
    usersPane.innerHTML =
      '<div class="border-b border-slate-800 pb-3">' +
        '<h4 class="text-sm sm:text-base font-extrabold text-white">👥 Registered Users, Passwords &amp; Pro Control</h4>' +
        '<p class="text-xs text-slate-400 mt-0.5">View all accounts, passwords, PINs, secret words, and activate Pro with 1 click.</p>' +
      '</div>' +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">' +
        '<div class="bg-[#141821] border border-emerald-500/30 rounded-2xl p-3.5 space-y-2">' +
          '<label class="block font-extrabold text-emerald-400">💬 Admin WhatsApp Number for Pro Requests:</label>' +
          '<div class="flex gap-2">' +
            '<input id="adminWhatsAppInput" type="text" placeholder="e.g. 923001234567" value="' + (window.adminWhatsAppNumber || "") + '" class="flex-1 bg-black border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono" />' +
            '<button type="button" onclick="adminSaveWhatsAppNumber()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl font-extrabold shadow">💾 Save</button>' +
          '</div>' +
        '</div>' +
        '<div class="bg-[#141821] border border-blue-500/30 rounded-2xl p-3.5 space-y-2">' +
          '<label class="block font-extrabold text-blue-300">📧 Official qaaftube@gmail.com Script URL (24/7 Auto-Email):</label>' +
          '<div class="flex gap-2">' +
            '<input id="adminMailerUrlInput" type="text" placeholder="https://script.google.com/macros/s/.../exec" value="' + (window.qaafOfficialMailerUrl || "") + '" class="flex-1 bg-black border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono" />' +
            '<button type="button" onclick="adminSaveOfficialMailerUrl()" class="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl font-extrabold shadow">💾 Save</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="adminUsersTableContainer" class="space-y-2.5 text-xs"></div>';
    rightArea.appendChild(usersPane);
  }

  window.adminSaveWhatsAppNumber = function() {
    var v = (document.getElementById("adminWhatsAppInput").value || "").replace(/[^0-9]/g, "");
    window.adminWhatsAppNumber = v;
    localStorage.setItem("qaaf_admin_whatsapp", v);
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Updated Admin WhatsApp");
    showSyncToast("✅ Saved Admin WhatsApp Number!");
  };

  window.adminSaveOfficialMailerUrl = function() {
    var v = (document.getElementById("adminMailerUrlInput").value || "").trim();
    window.qaafOfficialMailerUrl = v;
    localStorage.setItem("qaaf_official_mailer_url", v);
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Updated Official Gmail Mailer URL");
    showSyncToast("✅ Saved Official qaaftube@gmail.com Mailer URL!");
  };

  window.adminToggleUserProStatus = function(uKey) {
    var u = window.registeredUsersMap[uKey];
    if (!u) return;
    u.isPro = !u.isPro;
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    syncCurrentUserProStatus();
    window.renderAdminUsersTable();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState((u.isPro ? "Activated Pro: " : "Revoked Pro: ") + uKey);
    showSyncToast(u.isPro ? ("👑 Pro Activated for " + uKey) : ("🔒 Pro Revoked for " + uKey));
  };

  window.adminChangeUserPassword = function(uKey) {
    var u = window.registeredUsersMap[uKey];
    if (!u) return;
    var inp = document.getElementById("admEditPass_" + uKey.replace(/[^a-zA-Z0-9]/g, "_"));
    var newP = inp ? inp.value.trim() : "";
    if (!newP) { alert("Type a new password first."); return; }
    u.pass = newP;
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    window.renderAdminUsersTable();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Admin Updated Password: " + uKey);
    showSyncToast("🔑 Password updated for " + uKey);
  };

  window.adminCopyUserResetLink = function(uKey) {
    var link = generateResetTokenForUser(uKey);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link);
    }
    showSyncToast("🔗 Reset Link copied to clipboard!");
  };

  window.adminDeleteRegisteredUser = function(uKey) {
    if (!confirm("Delete user account: " + uKey + "?")) return;
    delete window.registeredUsersMap[uKey];
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    window.renderAdminUsersTable();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Deleted User: " + uKey);
  };

  window.renderAdminUsersTable = function() {
    injectAdminUsersTab();
    var keys = Object.keys(window.registeredUsersMap || {});
    var badge = document.getElementById("admSidebarUsersBadge");
    if (badge) badge.innerText = keys.length;
    var cont = document.getElementById("adminUsersTableContainer");
    if (!cont) return;

    if (keys.length === 0) {
      cont.innerHTML = '<div class="bg-[#141821] border border-slate-800 rounded-2xl p-6 text-center text-slate-400">No family accounts registered yet.</div>';
      return;
    }

    var html = "";
    keys.forEach(function(uKey) {
      var u = window.registeredUsersMap[uKey];
      if (!u) return;
      var safeId = uKey.replace(/[^a-zA-Z0-9]/g, "_");
      var safeKey = uKey.replace(/'/g, "\\'");
      var isPro = !!u.isPro;

      html += '<div class="bg-[#141821] border ' + (isPro ? 'border-emerald-500/60' : 'border-slate-800') + ' rounded-2xl p-3.5 space-y-2.5">';
      html += '<div class="flex flex-wrap items-center justify-between gap-2">';
      html += '<div>';
      html += '<div class="flex items-center gap-2">';
      html += '<span class="font-extrabold text-white text-sm">' + (u.name || uKey) + '</span>';
      html += '<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ' + (isPro ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300') + '">' + (isPro ? '👑 PRO ACTIVE' : 'Free Plan') + '</span>';
      if (u.resetRequestedAt) {
        html += '<span class="bg-amber-500/20 border border-amber-400 text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">📧 Reset Requested</span>';
      }
      html += '</div>';
      html += '<p class="text-[11px] text-emerald-400 font-mono mt-0.5">' + uKey + ' • Joined: ' + (u.createdAt || 'Active') + '</p>';
      html += '</div>';

      html += '<div class="flex flex-wrap items-center gap-1.5">';
      html += '<button type="button" onclick="adminToggleUserProStatus(\'' + safeKey + '\')" class="px-3 py-1.5 rounded-xl text-[11px] font-extrabold shadow transition ' + (isPro ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white') + '">' + (isPro ? '🔒 Revoke Pro' : '👑 Activate Pro') + '</button>';
      html += '<button type="button" onclick="adminCopyUserResetLink(\'' + safeKey + '\')" class="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-xl text-[11px] font-bold shadow">🔗 Copy Reset Link</button>';
      html += '<button type="button" onclick="adminDeleteRegisteredUser(\'' + safeKey + '\')" class="bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white px-2.5 py-1.5 rounded-xl text-[11px] font-bold">🗑️</button>';
      html += '</div></div>';

      html += '<div class="bg-black/70 border border-slate-800/90 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">';
      html += '<div class="flex flex-wrap items-center gap-3">';
      html += '<span class="text-slate-400">🔑 Password: <strong class="text-amber-300 font-mono select-all">' + (u.pass || 'N/A') + '</strong></span>';
      html += '<span class="text-slate-400">🛡️ Kids PIN: <strong class="text-emerald-300 font-mono select-all">' + (u.pin || '123456') + '</strong></span>';
      html += '<span class="text-slate-400">💬 Secret Word: <strong class="text-blue-300 font-mono select-all">' + (u.recWord || 'makkah') + '</strong></span>';
      html += '</div>';
      html += '<div class="flex items-center gap-1.5">';
      html += '<input id="admEditPass_' + safeId + '" type="text" placeholder="New password..." class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white w-28" />';
      html += '<button type="button" onclick="adminChangeUserPassword(\'' + safeKey + '\')" class="bg-slate-800 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold">Save Pass</button>';
      html += '</div></div></div>';
    });

    cont.innerHTML = html;
  };

  var origOpenAdm = window.openAdminModal;
  window.openAdminModal = function() {
    injectAdminUsersTab();
    window.renderAdminUsersTable();
    if (origOpenAdm) origOpenAdm();
  };

  var origSwitchTab = window.switchAdminTab;
  window.switchAdminTab = function(tabKey) {
    injectAdminUsersTab();
    if (tabKey === "users") window.renderAdminUsersTable();
    if (origSwitchTab) origSwitchTab(tabKey);
  };

  injectAdminUsersTab();
  window.renderAdminUsersTable();
  syncCurrentUserProStatus();
})();

(function initQaafMonitorRoleSystem() {
  // 1. Check if the currently logged-in user is an assigned Monitor
  window.isMonitorUser = function() {
    if (!currentUserEmail || isSuperAdmin()) return false;
    var uKey = currentUserEmail.toLowerCase().trim();
    var uObj = window.registeredUsersMap && window.registeredUsersMap[uKey];
    return !!(uObj && uObj.isMonitor === true);
  };

  window.hasModerationAccess = function() {
    return isSuperAdmin() || window.isMonitorUser();
  };

  // 2. Update Header Button & Account Badge for Monitors vs Super Admin
  var origSyncAccountUI = window.syncAccountUI;
  window.syncAccountUI = function() {
    if (origSyncAccountUI) origSyncAccountUI();
    var adminBtn = document.getElementById("superAdminHeaderBtn");
    var roleBadge = document.getElementById("activeAccountRoleBadge");
    var label = document.getElementById("accountBtnLabel");

    if (!currentUserEmail) return;

    if (window.isMonitorUser()) {
      if (label) label.innerText = "Monitor";
      if (roleBadge) {
        roleBadge.className = "text-xs font-extrabold text-sky-400";
        roleBadge.innerText = "🛡️ Official Content Monitor (Moderation Access)";
      }
      if (adminBtn && !isKidsLocked) {
        adminBtn.classList.remove("hidden", "bg-amber-500", "hover:bg-amber-400", "text-black");
        adminBtn.classList.add("flex", "bg-sky-600", "hover:bg-sky-500", "text-white");
        var spans = adminBtn.querySelectorAll("span");
        if (spans.length >= 2) {
          spans[0].innerText = "🛡️";
          spans[1].innerText = "Monitor";
        }
      }
    } else if (isSuperAdmin()) {
      if (adminBtn) {
        adminBtn.classList.remove("bg-sky-600", "hover:bg-sky-500", "text-white");
        adminBtn.classList.add("bg-amber-500", "hover:bg-amber-400", "text-black");
        var spans2 = adminBtn.querySelectorAll("span");
        if (spans2.length >= 2) {
          spans2[0].innerText = "👑";
          spans2[1].innerText = "Admin";
        }
      }
    }
  };

  // 3. Enforce Strict Tab Restrictions when a Monitor opens the Console
  var RESTRICTED_FOR_MONITOR = ["sponsors", "cloud", "security", "users"];

  function applyMonitorConsoleRestrictions() {
    var isMon = window.isMonitorUser() && !isSuperAdmin();
    var headerTitle = document.querySelector("#adminDashboardModal h3");
    var headerSub = document.querySelector("#adminDashboardModal h3 + p");

    if (isMon) {
      if (headerTitle) headerTitle.innerText = "🛡️ QAAF Tube Monitor Console";
      if (headerSub) headerSub.innerText = "Content Moderation Mode • Check Requests, Flags & Videos";
    } else if (isSuperAdmin()) {
      if (headerTitle) headerTitle.innerText = "👑 QAAF Tube Admin Console";
      if (headerSub) headerSub.innerText = "qaaftube.com • Super Admin Full Management Center";
    }

    RESTRICTED_FOR_MONITOR.forEach(function(tabKey) {
      var tabBtn = document.getElementById("admTabBtn_" + tabKey);
      var tabPane = document.getElementById("admPane_" + tabKey);
      if (isMon) {
        if (tabBtn) tabBtn.classList.add("hidden");
        if (tabPane) tabPane.classList.add("hidden");
      } else {
        if (tabBtn) tabBtn.classList.remove("hidden");
      }
    });

    if (isMon) {
      // Ensure Monitor lands on Publish & Videos or Parent Requests tab
      switchAdminTab("requests");
    }
  }

  var prevSwitchAdminTab = window.switchAdminTab;
  window.switchAdminTab = function(tabKey) {
    if (window.isMonitorUser() && !isSuperAdmin() && RESTRICTED_FOR_MONITOR.indexOf(tabKey) !== -1) {
      alert("🔒 Access Restricted: Monitors can only manage Videos, Parent Requests, and Reported Flags.");
      return;
    }
    if (prevSwitchAdminTab) prevSwitchAdminTab(tabKey);
  };

  var prevOpenAdminModal = window.openAdminModal;
  window.openAdminModal = function() {
    if (!window.hasModerationAccess()) {
      alert("🔒 Unauthorized access.");
      return;
    }
    if (prevOpenAdminModal) prevOpenAdminModal();
    applyMonitorConsoleRestrictions();
  };

  // 4. Add "🛡️ Make Monitor / Remove Monitor" & Quick Monitor Creator inside Super Admin's Users & Pro Tab
  window.adminToggleUserMonitorRole = function(uKey) {
    if (!isSuperAdmin()) return;
    var u = window.registeredUsersMap[uKey];
    if (!u) return;
    u.isMonitor = !u.isMonitor;
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    window.renderAdminUsersTable();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState((u.isMonitor ? "Assigned Monitor: " : "Removed Monitor: ") + uKey);
    showSyncToast(u.isMonitor ? ("🛡️ " + uKey + " is now a Content Monitor!") : ("🔒 Removed Monitor role from " + uKey));
  };

  window.adminQuickCreateMonitorAccount = function() {
    if (!isSuperAdmin()) return;
    var nameInp = document.getElementById("quickMonNameInput");
    var emailInp = document.getElementById("quickMonEmailInput");
    var passInp = document.getElementById("quickMonPassInput");

    var name = (nameInp ? nameInp.value : "").trim() || "QAAF Monitor";
    var uKey = (emailInp ? emailInp.value : "").trim().toLowerCase();
    var pass = (passInp ? passInp.value : "").trim();

    if (!uKey || !pass) {
      alert("Please enter an Email/Username and Password for the new Monitor.");
      return;
    }

    window.registeredUsersMap[uKey] = {
      name: name,
      userKey: uKey,
      pass: pass,
      recWord: "makkah",
      pin: "123456",
      isPro: true,
      isMonitor: true,
      createdAt: new Date().toLocaleDateString()
    };

    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
    if (nameInp) nameInp.value = "";
    if (emailInp) emailInp.value = "";
    if (passInp) passInp.value = "";

    window.renderAdminUsersTable();
    if (window.qaafCloudSync) window.qaafCloudSync.pushState("Created Monitor Account: " + uKey);
    showSyncToast("🛡️ Created Monitor Account: " + uKey);
  };

  // Upgrade renderAdminUsersTable to include Quick Monitor Creator & "🛡️ Make Monitor" button on every user row
  var baseRenderUsers = window.renderAdminUsersTable;
  window.renderAdminUsersTable = function() {
    if (baseRenderUsers) baseRenderUsers();

    var usersPane = document.getElementById("admPane_users");
    var tableCont = document.getElementById("adminUsersTableContainer");
    if (usersPane && tableCont && !document.getElementById("quickCreateMonitorCard")) {
      var monCard = document.createElement("div");
      monCard.id = "quickCreateMonitorCard";
      monCard.className = "bg-[#141821] border border-sky-500/40 rounded-2xl p-3.5 space-y-2.5 text-xs";
      monCard.innerHTML =
        '<div class="flex items-center justify-between">' +
          '<label class="font-extrabold text-sky-300">🛡️ Add New Monitor (Moderator for Video Requests &amp; Flags Only):</label>' +
          '<span class="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-bold">Limited Access</span>' +
        '</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-4 gap-2">' +
          '<input id="quickMonNameInput" type="text" placeholder="Monitor Name" class="bg-black border border-slate-700 rounded-xl px-3 py-1.5 text-white" />' +
          '<input id="quickMonEmailInput" type="text" placeholder="Email or Username" class="bg-black border border-slate-700 rounded-xl px-3 py-1.5 text-white" />' +
          '<input id="quickMonPassInput" type="text" placeholder="Password" class="bg-black border border-slate-700 rounded-xl px-3 py-1.5 text-white" />' +
          '<button type="button" onclick="adminQuickCreateMonitorAccount()" class="bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-extrabold py-1.5 shadow">➕ Create Monitor</button>' +
        '</div>';
      usersPane.insertBefore(monCard, tableCont);
    }

    // Inject "🛡️ Make Monitor / Remove Monitor" button into each user card in adminUsersTableContainer
    if (!tableCont) return;
    var keys = Object.keys(window.registeredUsersMap || {});
    var cards = tableCont.children;
    keys.forEach(function(uKey, idx) {
      var u = window.registeredUsersMap[uKey];
      var cardEl = cards[idx];
      if (!u || !cardEl || cardEl.querySelector(".adm-mon-toggle-btn")) return;

      var safeKey = uKey.replace(/'/g, "\\'");
      var isMon = !!u.isMonitor;

      // Add Monitor badge next to name if active
      var nameRow = cardEl.querySelector(".flex.items-center.gap-2");
      if (nameRow && isMon) {
        var mBadge = document.createElement("span");
        mBadge.className = "bg-sky-500 text-black px-2 py-0.5 rounded-full text-[10px] font-extrabold";
        mBadge.innerText = "🛡️ MONITOR";
        nameRow.appendChild(mBadge);
      }

      // Add toggle button in action row
      var btnGroup = cardEl.querySelector(".flex.flex-wrap.items-center.gap-1\\.5");
      if (btnGroup) {
        var monBtn = document.createElement("button");
        monBtn.type = "button";
        monBtn.className = "adm-mon-toggle-btn px-3 py-1.5 rounded-xl text-[11px] font-extrabold shadow transition " + (isMon ? "bg-sky-500 text-black hover:bg-sky-400" : "bg-slate-800 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/40");
        monBtn.innerText = isMon ? "🛡️ Remove Monitor" : "🛡️ Make Monitor";
        monBtn.onclick = function() { window.adminToggleUserMonitorRole(uKey); };
        btnGroup.insertBefore(monBtn, btnGroup.firstChild);
      }
    });
  };

  syncAccountUI();
  if (window.renderAdminUsersTable) window.renderAdminUsersTable();
})();

(function initQaafV105MasterFixes() {
  var OFFICIAL_GMAIL_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz17x-IpU-5ownx5rg7eaKAMer9Yx2gR1Uh_iZnYrpQDSmG5B2ZDSwPbCCySldPW7nsyw/exec";
  window.qaafOfficialMailerUrl = OFFICIAL_GMAIL_SCRIPT_URL;
  localStorage.setItem("qaaf_official_mailer_url", OFFICIAL_GMAIL_SCRIPT_URL);

  var DEFAULT_PROMO_TEXT = "📢 For Promotion & Sponsorship on QAAF Tube Contact Us: contactqaaftube@gmail.com";
  var DEFAULT_PROMO_LINK = "mailto:contactqaaftube@gmail.com?subject=Promotion%20%26%20Sponsorship%20on%20QAAF%20Tube";

  // =========================================================================
  // 1. STATIC LOGO ONLY & INSTANT PAGE OPEN (NO STARTUP ANIMATION DELAY)
  // =========================================================================
  var splashModal = document.getElementById("startupSplashModal");
  if (splashModal) {
    splashModal.style.opacity = "0";
    splashModal.classList.add("hidden");
  }
  window.runStartupSplash = function(isManualReplay) {
    var modal = document.getElementById("startupSplashModal");
    if (!modal) return;
    if (!isManualReplay) {
      modal.style.opacity = "0";
      modal.classList.add("hidden");
      return;
    }
    modal.classList.remove("hidden");
    modal.style.opacity = "1";
    setTimeout(function() {
      modal.style.opacity = "0";
      setTimeout(function() { modal.classList.add("hidden"); }, 150);
    }, 600);
  };

  // =========================================================================
  // 2. SECURE OFFICIAL EMAIL RESET SENDER (SENDS ONLY TO USER'S GMAIL INBOX)
  // =========================================================================
  window.sendPasswordResetEmailLink = async function() {
    var emailKey = (document.getElementById("resetTargetEmailInput").value || "").trim().toLowerCase();
    var msgEl = document.getElementById("resetPaneStatusMsg");
    if (!msgEl) return;
    msgEl.classList.remove("hidden");

    if (!emailKey || emailKey.indexOf("@") === -1) {
      msgEl.className = "text-[11px] font-bold text-rose-400";
      msgEl.innerText = "⚠️ Please enter your registered Email address in box #1 above.";
      return;
    }

    var u = window.registeredUsersMap && window.registeredUsersMap[emailKey];
    if (!u) {
      msgEl.className = "text-[11px] font-bold text-rose-400";
      msgEl.innerText = "❌ No account found with this Email. Click Sign Up to create one.";
      return;
    }

    if (!u.resetToken) {
      u.resetToken = "rst_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).slice(-4);
    }
    u.resetRequestedAt = new Date().toLocaleString();
    localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));

    var baseUrl = window.location.origin + window.location.pathname;
    var resetLink = baseUrl + "?reset_account=" + encodeURIComponent(emailKey) + "&reset_token=" + encodeURIComponent(u.resetToken);

    if (window.qaafCloudSync) {
      window.qaafCloudSync.pushState("Password Reset Email Requested: " + emailKey);
    }

    msgEl.className = "text-[11px] font-bold text-blue-300";
    msgEl.innerText = "⏳ Sending 'Reset Password (No-Reply)' email to " + emailKey + "...";

    try {
      await fetch(OFFICIAL_GMAIL_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          email: emailKey,
          name: u.name || emailKey,
          resetLink: resetLink
        })
      });
      msgEl.className = "text-[11px] font-bold text-emerald-400 leading-relaxed";
      msgEl.innerHTML = "✅ <strong>Reset Password (No-Reply)</strong> email has been sent to <strong>" + emailKey + "</strong>! Please check your email inbox (and Spam/Promotions folder) and click the <strong>Reset Password Now</strong> button.";
    } catch (e) {
      msgEl.className = "text-[11px] font-bold text-rose-400";
      msgEl.innerText = "⚠️ Network error while sending email. Please check your internet connection and try again.";
    }
  };

  var mailerInp = document.getElementById("adminMailerUrlInput");
  if (mailerInp) mailerInp.value = OFFICIAL_GMAIL_SCRIPT_URL;

  // =========================================================================
  // 3. REGIONAL PROMO BAR: ALWAYS ON BY DEFAULT IN FAMILY MODE (contactqaaftube@gmail.com),
  //    HIDDEN IN KIDS MODE, AND REGION-SPECIFIC WHEN CUSTOM SPONSOR AD IS SET
  // =========================================================================
  isPromoBarEnabled = localStorage.getItem("qaaf_promo_bar_enabled") !== "false";
  var promoToggleEl = document.getElementById("adminPromoVisibleToggle");
  if (promoToggleEl) promoToggleEl.checked = isPromoBarEnabled;

  window.syncRegionalPromoBar = function() {
    var bar = document.getElementById("regionalPromoBar");
    if (!bar) return;

    if (isKidsLocked || !isPromoBarEnabled) {
      bar.classList.add("hidden");
      return;
    }

    bar.classList.remove("hidden");

    var found = globalLanguagesList.find(function(l) { return l.code === preferredContentLang; });
    var regionKey = (found && found.regionKey) ? found.regionKey : "GLOBAL";
    var customRegionPromo = regionalPromos && regionalPromos[regionKey];
    var globalPromo = regionalPromos && regionalPromos.GLOBAL;

    var activePromo = null;
    if (customRegionPromo && ((customRegionPromo.text && customRegionPromo.text.trim() !== "") || (customRegionPromo.imgUrl && customRegionPromo.imgUrl.trim() !== ""))) {
      activePromo = customRegionPromo;
    } else if (globalPromo && ((globalPromo.text && globalPromo.text.trim() !== "") || (globalPromo.imgUrl && globalPromo.imgUrl.trim() !== ""))) {
      activePromo = globalPromo;
    } else {
      activePromo = {
        text: DEFAULT_PROMO_TEXT,
        imgUrl: "",
        linkUrl: DEFAULT_PROMO_LINK,
        dir: "rtl"
      };
    }

    var tagEl = document.getElementById("promoRegionTag");
    if (tagEl) tagEl.innerText = "📢 SPONSOR";

    var imgLinkEl = document.getElementById("promoImageBannerLink");
    var imgEl = document.getElementById("promoImageBannerEl");
    var tickerWrap = document.getElementById("promoTickerWrapper");
    var tickerLink = document.getElementById("promoTickerLink");

    if (activePromo.imgUrl && activePromo.imgUrl.trim() !== "") {
      imgEl.src = activePromo.imgUrl.trim();
      imgLinkEl.href = activePromo.linkUrl || DEFAULT_PROMO_LINK;
      imgLinkEl.classList.remove("hidden");
      tickerWrap.classList.add("hidden");
    } else {
      imgLinkEl.classList.add("hidden");
      tickerWrap.classList.remove("hidden");
      tickerLink.innerText = (activePromo.text && activePromo.text.trim() !== "") ? activePromo.text.trim() : DEFAULT_PROMO_TEXT;
      tickerLink.href = (activePromo.linkUrl && activePromo.linkUrl !== "#") ? activePromo.linkUrl : DEFAULT_PROMO_LINK;
      tickerLink.className = (activePromo.dir === "ltr" ? "promo-ticker-ltr" : "promo-ticker-rtl") + " text-slate-100 hover:text-amber-300 font-semibold tracking-wide";
    }
  };

  window.syncRegionalPromoBar();

  // =========================================================================
  // 4. REMOVE PHONE/WHATSAPP FROM PUBLIC PRO MODAL & ADMIN — USE EMAIL ONLY (contactqaaftube@gmail.com)
  // =========================================================================
  window.contactAdminForProViaEmail = function() {
    var uEmail = currentUserEmail || "My Account";
    var subj = "Supporter Pro Activation Request — " + uEmail;
    var body = "Assalamu Alaikum QAAF Tube Team,\n\nI would like to activate Supporter Pro for my QAAF Tube account:\nAccount Email: " + uEmail + "\n\nPlease share the payment details.\nJazakAllah Khair!";
    window.location.href = "mailto:contactqaaftube@gmail.com?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
  };

  var proModal = document.getElementById("proUpgradeContactModal");
  if (proModal) {
    var waBtn = proModal.querySelector('button[onclick*="contactAdminForProViaWhatsApp"]');
    if (waBtn) waBtn.remove();
    var emBtn = proModal.querySelector('button[onclick*="contactAdminForProViaEmail"]');
    if (emBtn) {
      emBtn.className = "w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2";
      emBtn.innerHTML = "<span>📧</span> <span>Email Us (contactqaaftube@gmail.com) to Activate Pro</span>";
    }
  }

  var waAdminInput = document.getElementById("adminWhatsAppInput");
  if (waAdminInput && waAdminInput.closest(".bg-\\[\\#141821\\]")) {
    waAdminInput.closest(".bg-\\[\\#141821\\]").classList.add("hidden");
  }

  var spContactInput = document.getElementById("sponsorContactEmail");
  if (spContactInput) spContactInput.placeholder = "Your Contact Email Address";

  // =========================================================================
  // 5. UNIFIED REQUEST QUEUE & CLOUD MERGE SYNC (NO OVERWRITING OTHER DEVICES' REQUESTS OR USERS!)
  // =========================================================================
  function syncRequestQueueReferences(newList) {
    if (Array.isArray(newList)) {
      parentRequestsQueue = newList;
      window.parentRequestsQueue = newList;
      localStorage.setItem("qaaf_parent_requests", JSON.stringify(newList));
    } else {
      window.parentRequestsQueue = parentRequestsQueue;
    }
  }
  syncRequestQueueReferences(parentRequestsQueue);

  function mergeArraysByKey(localArr, cloudArr, keyName) {
    var map = {};
    var result = [];
    (localArr || []).concat(cloudArr || []).forEach(function(item) {
      if (!item) return;
      var k = item[keyName] || item.ytId || item.videoId || item.title || JSON.stringify(item);
      if (!map[k]) {
        map[k] = true;
        result.push(item);
      }
    });
    return result;
  }

  if (window.qaafCloudSync) {
    window.qaafCloudSync.pushState = async function(actionLabel) {
      syncRequestQueueReferences(parentRequestsQueue);
      var endpoint = this.getEndpointUrl();
      var isDeletionAction = actionLabel && (
        actionLabel.indexOf("Approved") !== -1 ||
        actionLabel.indexOf("Rejected") !== -1 ||
        actionLabel.indexOf("Removed") !== -1 ||
        actionLabel.indexOf("Deleted") !== -1 ||
        actionLabel.indexOf("Banned") !== -1 ||
        actionLabel.indexOf("Purged") !== -1 ||
        actionLabel.indexOf("Cleared") !== -1
      );

      if (endpoint && !isDeletionAction) {
        try {
          var getRes = await fetch(endpoint + "?t=" + Date.now());
          if (getRes.ok) {
            var cloudState = await getRes.json();
            if (cloudState && typeof cloudState === "object") {
              if (Array.isArray(cloudState.parentRequestsQueue)) {
                var mergedReqs = mergeArraysByKey(parentRequestsQueue, cloudState.parentRequestsQueue, "reqId");
                syncRequestQueueReferences(mergedReqs);
              }
              if (Array.isArray(cloudState.flaggedVideosQueue)) {
                flaggedVideosQueue = mergeArraysByKey(flaggedVideosQueue, cloudState.flaggedVideosQueue, "videoId");
                localStorage.setItem("qaaf_flagged_queue", JSON.stringify(flaggedVideosQueue));
              }
              if (cloudState.registeredUsersJson && typeof cloudState.registeredUsersJson === "string") {
                try {
                  var parsedCloudUsers = JSON.parse(cloudState.registeredUsersJson);
                  Object.keys(parsedCloudUsers || {}).forEach(function(uk) {
                    if (!window.registeredUsersMap[uk]) window.registeredUsersMap[uk] = parsedCloudUsers[uk];
                  });
                } catch (e) {}
              }
              if (cloudState.registeredUsersMap && typeof cloudState.registeredUsersMap === "object") {
                Object.keys(cloudState.registeredUsersMap).forEach(function(uk) {
                  var uItem = cloudState.registeredUsersMap[uk];
                  var realK = (uItem && (uItem.userKey || uItem.email)) ? String(uItem.userKey || uItem.email).toLowerCase() : uk;
                  if (!window.registeredUsersMap[realK]) window.registeredUsersMap[realK] = uItem;
                });
              }
              localStorage.setItem("qaaf_registered_users", JSON.stringify(window.registeredUsersMap));
            }
          }
        } catch (e) {}
      }

      var payload = this.getStatePayload();
      payload.parentRequestsQueue = parentRequestsQueue;
      payload.registeredUsersJson = JSON.stringify(window.registeredUsersMap || {});
      payload.channelPlaylistsJson = JSON.stringify(window.qaafRealChannelPlaylistsMap || {});
      payload.playlistVideosCacheJson = JSON.stringify(window.qaafPlaylistVideosCache || {});
      delete payload.registeredUsersMap;

      localStorage.setItem("qaaf_videos_data", JSON.stringify(payload.videosData));
      localStorage.setItem("qaaf_flagged_queue", JSON.stringify(payload.flaggedVideosQueue));
      localStorage.setItem("qaaf_parent_requests", JSON.stringify(payload.parentRequestsQueue));
      localStorage.setItem("qaaf_blocked_videos", JSON.stringify(payload.blockedVideoIds));
      localStorage.setItem("qaaf_banned_channels", JSON.stringify(payload.bannedChannels));
      localStorage.setItem("qaaf_regional_promos_v7", JSON.stringify(payload.regionalPromos));
      localStorage.setItem("qaaf_promo_bar_enabled", payload.isPromoBarEnabled.toString());

      if (endpoint) {
        try {
          this.isSyncing = true;
          this.updateStatusBadge("syncing");
          await fetch(endpoint, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          var nowTime = new Date().toLocaleTimeString();
          localStorage.setItem("qaaf_cloud_last_synced", nowTime);
          localStorage.setItem("qaaf_cloud_last_sync_ts", Date.now().toString());
          localStorage.setItem("qaaf_cloud_updated_at", payload.updatedAt.toString());
          this.updateStatusBadge("connected");
        } catch (err) {
          this.updateStatusBadge("offline");
        } finally {
          this.isSyncing = false;
        }
      }
    };
  }

  window.parentSubmitChannelRequest = function() {
    var urlInput = document.getElementById("parentYtUrlInput");
    var titleInput = document.getElementById("parentVideoTitle");
    var channelInput = document.getElementById("parentChannelName");
    var fb = document.getElementById("parentRequestFeedback");

    var ytId = extractYouTubeId(urlInput ? urlInput.value.trim() : "");
    var title = titleInput ? titleInput.value.trim() : "";
    var channel = (channelInput && channelInput.value.trim()) ? channelInput.value.trim() : "Requested Channel";
    var lang = document.getElementById("parentVideoLang") ? document.getElementById("parentVideoLang").value : "global";
    var cat = document.getElementById("parentVideoCat") ? document.getElementById("parentVideoCat").value : "kids_cartoon";

    if (!ytId || !title) {
      alert("Please paste a valid YouTube link and fetch/enter a title.");
      return;
    }

    var newReq = {
      reqId: "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      ytId: ytId,
      title: title,
      channel: channel,
      lang: lang,
      category: cat,
      requestedBy: currentUserEmail || "Family User",
      requestedAt: new Date().toLocaleString()
    };

    parentRequestsQueue.unshift(newReq);
    syncRequestQueueReferences(parentRequestsQueue);
    try {
      var myReqIds = JSON.parse(localStorage.getItem("qaaf_my_submitted_req_ids") || "[]");
      if (newReq.reqId && myReqIds.indexOf(newReq.reqId) === -1) {
        myReqIds.unshift(newReq.reqId);
        localStorage.setItem("qaaf_my_submitted_req_ids", JSON.stringify(myReqIds));
      }
    } catch(e) {}
    if (typeof updateNotifBadges === "function") updateNotifBadges();

    if (urlInput) urlInput.value = "";
    if (titleInput) titleInput.value = "";
    if (channelInput) channelInput.value = "";

    if (fb) {
      fb.classList.remove("hidden");
      fb.className = "text-[11px] font-bold text-emerald-400";
      fb.innerText = "✅ Request sent! See its live status in the list below.";
    }

    renderAdminParentRequests();
    if (typeof window.openUserNotificationsModal === "function") {
      window.openUserNotificationsModal();
    }
    if (typeof updateNotifBadges === "function") updateNotifBadges();

    if (window.qaafCloudSync) {
      window.qaafCloudSync.pushState("New Video Request Submitted");
    }
  };

  var prevOpenAdmModal = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevOpenAdmModal) prevOpenAdmModal();
    if (window.qaafCloudSync) {
      window.qaafCloudSync.pullFromCloud(true).then(function() {
        syncRequestQueueReferences(parentRequestsQueue);
        renderAdminParentRequests();
        renderAdminFlaggedQueue();
        if (window.renderAdminUsersTable) window.renderAdminUsersTable();
      });
    }
  };

  var prevOpenUserNotif = window.openUserNotificationsModal;
  window.openUserNotificationsModal = function() {
    syncRequestQueueReferences(parentRequestsQueue);
    if (prevOpenUserNotif) prevOpenUserNotif();
    if (typeof updateNotifBadges === "function") updateNotifBadges();
  };

  var bellBtnEl = document.getElementById("qaafNotifBellBtn");
  if (bellBtnEl) {
    bellBtnEl.onclick = function() {
      window.openUserNotificationsModal();
      if (window.qaafCloudSync) {
        window.qaafCloudSync.pullFromCloud(true).then(function() {
          syncRequestQueueReferences(parentRequestsQueue);
          if (prevOpenUserNotif) prevOpenUserNotif();
        });
      }
    };
  }
})();

(function enforceCleanSlateAndDisableExternalSearch() {
  var SLATE_VER = "qaaf_empty_slate_v125";

  // 1. Completely disable external YouTube search from ever adding unapproved videos/channels!
  window.qaafTriggerLiveYouTubeSearch = function() {
    // External YouTube scraping is strictly disabled. Only Admin-approved videos are searched.
    return;
  };

  // 2. Ensure Search Input never accepts autofilled email addresses and never shows external fetch buttons
  var sInp = document.getElementById("qaafSearchInput");
  if (sInp) {
    sInp.setAttribute("type", "search");
    sInp.setAttribute("name", "qaaf_video_search_box");
    sInp.setAttribute("autocomplete", "off");
    sInp.setAttribute("readonly", "readonly");
    sInp.addEventListener("focus", function() { this.removeAttribute("readonly"); });
    if (sInp.value && sInp.value.indexOf("@") !== -1) {
      sInp.value = "";
      window.qaafActiveSearchQuery = "";
    }
  }

  // 3. One-time wipe of all preloaded & auto-searched channels/videos in localStorage
  localStorage.setItem("qaaf_clean_slate_ver", SLATE_VER);

  // Also purge any video that was ever added by 'v_search_'
  videosData = (videosData || []).filter(function(v) {
    return v && v.id && String(v.id).indexOf("v_search_") === -1;
  });
  localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));

  
})();

(function initQaafV108CategoriesAndChannelVerification() {
  var CLEAN_SLATE_KEY = "qaaf_clean_slate_v125_zero_sync_perfect";
  window.verifiedChannelsList = JSON.parse(localStorage.getItem("qaaf_verified_channels") || "[]");
  window.isByChannelsPanelOpen = false;

  // 1. Force one-time complete wipe of any leftover cached videos on this browser
  localStorage.setItem("qaaf_slate_v125", CLEAN_SLATE_KEY);

  // Sync verifiedChannelsList with Firebase Cloud
  if (window.qaafCloudSync) {
    var origGetPayload = window.qaafCloudSync.getStatePayload.bind(window.qaafCloudSync);
    window.qaafCloudSync.getStatePayload = function() {
      var data = origGetPayload();
      data.verifiedChannelsList = window.verifiedChannelsList;
      return data;
    };

    var origApply = window.qaafCloudSync.applyIncomingState.bind(window.qaafCloudSync);
    window.qaafCloudSync.applyIncomingState = function(payload, source) {
      if (payload && typeof payload === "object") {
        // If remote has verified channels list, sync it
        if (Array.isArray(payload.verifiedChannelsList) && payload.verifiedChannelsList.length > 0) {
          window.verifiedChannelsList = payload.verifiedChannelsList;
          localStorage.setItem("qaaf_verified_channels", JSON.stringify(window.verifiedChannelsList));
        }
        // If remote has videosData, pass it; if missing, do NOT overwrite with empty array
        if (Array.isArray(payload.videosData)) {
          // passed through to origApply which now has wipe-protection
        } else {
          // Do not inject empty array
          delete payload.videosData;
        }
      }
      origApply(payload, source);
    };
  }

  window.isChannelFullyVerified = function(chName, videoObj) {
    if (!chName) return false;
    if (window.verifiedChannelsList && window.verifiedChannelsList.indexOf(chName) !== -1) return true;
    if (videoObj && videoObj.channelVerified === true) return true;
    return false;
  };

  window.adminToggleChannelVerifiedStatus = function(chName, ev) {
    if (ev) ev.stopPropagation();
    if (!chName) return;
    var idx = window.verifiedChannelsList.indexOf(chName);
    var nowVerified = false;
    if (idx === -1) {
      window.verifiedChannelsList.push(chName);
      nowVerified = true;
    } else {
      window.verifiedChannelsList.splice(idx, 1);
      nowVerified = false;
    }
    videosData.forEach(function(v) {
      if (v.channel === chName) v.channelVerified = nowVerified;
    });
    localStorage.setItem("qaaf_verified_channels", JSON.stringify(window.verifiedChannelsList));
    localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
    renderVideos();
    
    if (window.qaafCloudSync) window.qaafCloudSync.pushState((nowVerified ? "Marked Channel Verified: " : "Marked Video-Only Verified: ") + chName);
    showSyncToast(nowVerified ? ("🟢 '" + chName + "' is now Channel Verified!") : ("🟡 '" + chName + "' set to Video Verified Only."));
  };

  // =========================================================================
  // 2. UPGRADE CATEGORY BARS & ADD "📺 BY CHANNELS" DIRECTORY (GREEN TOP, YELLOW BELOW)
  // =========================================================================
  var CATEGORY_META = {
    all: { label: "All Channels", icon: "📺", familyOnly: false },
    quran: { label: "Tilawat-e-Quran", icon: "🕋", familyOnly: false },
    naat: { label: "Naat", icon: "🕌", familyOnly: false },
    tarbiyah: { label: "Islamic Tarbiyah", icon: "🌿", familyOnly: false },
    bayan: { label: "Islamic Bayanat", icon: "🎙️", familyOnly: true },
    kids_tarbiyah: { label: "Kids Tarbiyah", icon: "📖", familyOnly: false },
    kids_cartoon: { label: "Kids Cartoons", icon: "🌟", familyOnly: false }
  };

  // Update Top #categoryBar chips
  var catBarLeft = document.querySelector("#categoryBar > div:first-child");
  if (catBarLeft) {
    catBarLeft.innerHTML =
      '<button onclick="filterCategory(\'all\')" id="ui_catAll" class="cat-chip bg-white text-black px-3 py-1 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5"><span>📺</span> <span>All Channels</span></button>' +
      '<button onclick="filterCategory(\'quran\')" id="ui_catQuran" class="cat-chip bg-[#272727] hover:bg-[#3f3f3f] text-white px-3 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5"><span>🕋</span> <span>Tilawat-e-Quran</span></button>' +
      '<button onclick="filterCategory(\'naat\')" id="ui_catNaat" class="cat-chip bg-[#272727] hover:bg-[#3f3f3f] text-white px-3 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5"><span class="text-emerald-400">🕌</span> <span>Naat</span></button>' +
      '<button onclick="filterCategory(\'tarbiyah\')" id="ui_catTarbiyah" class="cat-chip bg-[#272727] hover:bg-[#3f3f3f] text-white px-3 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5"><span>🌿</span> <span>Islamic Tarbiyah</span></button>' +
      '<button onclick="filterCategory(\'bayan\')" id="ui_catBayan" class="cat-chip family-only-chip bg-[#272727] hover:bg-[#3f3f3f] text-white px-3 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5"><span>🎙️</span> <span>Islamic Bayanat</span></button>' +
      '<button onclick="filterCategory(\'kids_tarbiyah\')" id="ui_catStories" class="cat-chip bg-[#272727] hover:bg-[#3f3f3f] text-white px-3 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5"><span>📖</span> <span>Kids Tarbiyah</span></button>' +
      '<button onclick="filterCategory(\'kids_cartoon\')" id="ui_catCartoon" class="cat-chip bg-[#272727] hover:bg-[#3f3f3f] text-white px-3 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5"><span>🌟</span> <span>Kids Cartoons</span></button>';
  }

  window.filterCategory = function(cat) {
    currentCategory = cat;
    if (cat === "kids_tarbiyah") {
      // Match both stories and kids_tarbiyah
    }
    document.querySelectorAll("#categoryBar .cat-chip").forEach(function(btn) {
      var isAct = (btn.getAttribute("onclick") || "").indexOf("'" + cat + "'") !== -1;
      btn.className = "cat-chip " + (btn.classList.contains("family-only-chip") ? "family-only-chip " : "") + (isAct ? "bg-emerald-500 text-black px-3 py-1 rounded-lg text-xs font-extrabold shrink-0 shadow" : "bg-[#272727] hover:bg-[#3f3f3f] text-white px-3 py-1 rounded-lg text-xs font-semibold shrink-0") + (isKidsLocked && btn.classList.contains("family-only-chip") ? " hidden" : "");
    });
    renderVideos();
  };

  window.toggleByChannelsDirectory = function() {
    window.isByChannelsPanelOpen = !window.isByChannelsPanelOpen;
    renderTopicAndByChannelsBar();
  };

  var currentSelectedChannelName = "ALL";
  var origSelCh = window.selectChannelFilter;
  window.selectChannelFilter = function(chName) {
    currentSelectedChannelName = chName || "ALL";
    if (origSelCh) origSelCh(chName);
  };

  function renderTopicAndByChannelsBar() { return;
    var bar = document.getElementById("qaafChannelsFilterBar");
    if (!bar) return;

    var visibleVids = (videosData || []).filter(function(v) {
      if (!v || blockedVideoIds.indexOf(v.id) !== -1 || bannedChannels.indexOf(v.channel) !== -1) return false;
      if (isKidsLocked && !v.kidsSafe) return false;
      return true;
    });

    var allChs = Array.from(new Set(visibleVids.map(function(v) { return v.channel; })));
    var greenVerifiedChs = [];
    var yellowVideoOnlyChs = [];

    allChs.forEach(function(ch) {
      var sampleVid = visibleVids.find(function(v) { return v.channel === ch; });
      if (window.isChannelFullyVerified(ch, sampleVid)) {
        greenVerifiedChs.push(ch);
      } else {
        yellowVideoOnlyChs.push(ch);
      }
    });

    var isAllTopics = (currentCategory === "all" && currentSelectedChannelName === "ALL");

    // Ordered Categories requested by user:
    // 1. Kids Cartoons, 2. Kids Tarbiyah, 3. Tilawat-e-Quran, 4. Islamic Bayanat (hidden in Kids Mode), 5. Naat Sharif
    var topicList = [
      { key: "kids_cartoon", label: "🌟 Kids Cartoons", kidsOk: true },
      { key: "kids_tarbiyah", label: "📖 Kids Tarbiyah", kidsOk: true },
      { key: "quran", label: "🕋 Tilawat-e-Quran", kidsOk: true },
      { key: "bayan", label: "🎙️ Islamic Bayanat", kidsOk: false },
      { key: "naat", label: "🎤 Naat Sharif", kidsOk: true },
      { key: "tarbiyah", label: "🌿 Islamic Tarbiyah", kidsOk: true }
    ];

    var topRowHtml = '<div class="flex items-center justify-between gap-2 overflow-x-auto pb-1">';
    topRowHtml += '<div class="flex items-center gap-1.5 shrink-0">';

    topRowHtml += '<button type="button" onclick="currentCategory=\'all\'; selectChannelFilter(\'ALL\');" class="px-3 py-1.5 rounded-full text-xs font-extrabold shrink-0 transition ' + (isAllTopics ? 'bg-emerald-500 text-black shadow' : 'bg-slate-800 text-slate-200 hover:bg-slate-700') + '">📋 All (' + visibleVids.length + ')</button>';

    topicList.forEach(function(t) {
      if (isKidsLocked && !t.kidsOk) return;
      var isAct = (currentCategory === t.key);
      topRowHtml += '<button type="button" onclick="filterCategory(\'' + t.key + '\')" class="px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition ' + (isAct ? 'bg-emerald-500 text-black shadow font-extrabold' : 'bg-[#1a1f2c] hover:bg-slate-800 text-slate-200 border border-slate-700/80') + '">' + t.label + '</button>';
    });

    topRowHtml += '</div>';

    // SLEEK COMPACT "All Channels ▾" DROPDOWN TRIGGER (NOT A HUGE EXPANDED LIST)
    var hasSelectedCh = (currentSelectedChannelName !== "ALL");
    var chLabel = hasSelectedCh ? currentSelectedChannelName : ("All Channels (" + allChs.length + ")");
    topRowHtml += '<div class="relative shrink-0">';
    topRowHtml += '<button type="button" onclick="window.isByChannelsPanelOpen = !window.isByChannelsPanelOpen; renderTopicAndByChannelsBar();" class="px-3 py-1.5 rounded-full text-xs font-extrabold shrink-0 transition flex items-center gap-1.5 shadow ' + (hasSelectedCh ? 'bg-emerald-500 text-black' : 'bg-[#1a1f2c] hover:bg-slate-800 text-slate-200 border border-slate-700') + '"><span>📺</span> <span class="max-w-[140px] truncate">' + chLabel + '</span> <span>' + (window.isByChannelsPanelOpen ? '▴' : '▾') + '</span></button>';

    // FLOATING POPUP DROPDOWN FOR CHANNELS
    if (window.isByChannelsPanelOpen) {
      topRowHtml += '<div class="absolute right-0 top-full mt-1.5 z-40 bg-[#131722] border border-slate-700 rounded-xl shadow-2xl p-2 w-72 max-h-64 overflow-y-auto space-y-1">';
      topRowHtml += '<button type="button" onclick="selectChannelFilter(\'ALL\'); window.isByChannelsPanelOpen=false; renderTopicAndByChannelsBar();" class="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 text-slate-200 flex items-center justify-between"><span>📋 All Channels</span> <span class="text-[10px] text-slate-400">(' + visibleVids.length + ')</span></button>';

      if (greenVerifiedChs.length > 0) {
        topRowHtml += '<div class="pt-1 border-t border-slate-800"><p class="text-[10px] font-extrabold text-emerald-400 px-2 py-0.5">🟢 Verified Channels</p>';
        greenVerifiedChs.forEach(function(ch) {
          var cCount = visibleVids.filter(function(v) { return v.channel === ch; }).length;
          var safeCh = ch.replace(/'/g, "\'");
          var isAct = (currentSelectedChannelName === ch);
          topRowHtml += '<button type="button" onclick="selectChannelFilter(\'' + safeCh + '\'); window.isByChannelsPanelOpen=false; renderTopicAndByChannelsBar();" class="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-950/60 ' + (isAct ? 'bg-emerald-500 text-black font-extrabold' : 'text-emerald-300') + ' flex items-center justify-between"><span>✓ ' + ch + '</span><span class="text-[10px] opacity-75">(' + cCount + ')</span></button>';
        });
        topRowHtml += '</div>';
      }

      if (yellowVideoOnlyChs.length > 0) {
        topRowHtml += '<div class="pt-1 border-t border-slate-800"><p class="text-[10px] font-extrabold text-amber-400 px-2 py-0.5">🟡 Single Video Channels</p>';
        yellowVideoOnlyChs.forEach(function(ch) {
          var cCount = visibleVids.filter(function(v) { return v.channel === ch; }).length;
          var safeCh = ch.replace(/'/g, "\'");
          var isAct = (currentSelectedChannelName === ch);
          topRowHtml += '<button type="button" onclick="selectChannelFilter(\'' + safeCh + '\'); window.isByChannelsPanelOpen=false; renderTopicAndByChannelsBar();" class="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-950/60 ' + (isAct ? 'bg-amber-500 text-black font-extrabold' : 'text-amber-300') + ' flex items-center justify-between"><span>' + ch + '</span><span class="text-[10px] opacity-75">(' + cCount + ')</span></button>';
        });
        topRowHtml += '</div>';
      }

      if (allChs.length === 0) {
        topRowHtml += '<p class="text-[11px] text-slate-500 text-center py-2">No channels added yet.</p>';
      }

      topRowHtml += '</div>';
    }

    topRowHtml += '</div>'; // End relative wrapper
    topRowHtml += '</div>'; // End topRowHtml

    bar.innerHTML = topRowHtml;
  }

  // =========================================================================
  // 3. UPGRADE ADMIN & USER ADD-VIDEO FORMS WITH NEW CATEGORIES, AUDIENCE MODE & VERIFICATION TYPE
  // =========================================================================
  var NEW_CAT_OPTIONS_HTML =
    '<option value="quran">🕋 Tilawat-e-Quran (تلاوتِ قرآن پاک)</option>' +
    '<option value="naat">🎤 Naat Sharif (نعت شریف)</option>' +
    '<option value="bayan">🎙️ Islamic Bayanat (اسلامی بیانات)</option>' +
    '<option value="tarbiyah">🌿 Islamic Tarbiyah (اسلامی تربیت)</option>' +
    '<option value="kids_tarbiyah">📖 Kids Tarbiyah &amp; Stories (بچوں کی تربیت)</option>' +
    '<option value="kids_cartoon">🌟 Kids Cartoons (کڈز کارٹون)</option>';

  ["adminVideoCat", "parentVideoCat", "quickReqVideoCat"].forEach(function(selId) {
    var sel = document.getElementById(selId);
    if (sel) sel.innerHTML = NEW_CAT_OPTIONS_HTML;
  });

  // Add Audience Selector (Kids Preferred / Kids + Family Both / Family Only) & Verification Type (Channel Verified vs Video Verified) in Admin Publish box
  var adminCatSelect = document.getElementById("adminVideoCat");
  if (adminCatSelect && !document.getElementById("adminVideoAudience")) {
    var gridRow = adminCatSelect.parentNode;
    gridRow.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs";

    var audSelect = document.createElement("select");
    audSelect.id = "adminVideoAudience";
    audSelect.className = "bg-black border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-semibold";
    audSelect.innerHTML =
      '<option value="both_family_kids">👨‍👩‍👧‍👦 Kids + Family (Both Modes)</option>' +
      '<option value="kids_preferred">🧒 Kids Preferred (Kids Priority)</option>' +
      '<option value="family_only">🎙️ Family / Adult Only</option>';

    var verSelect = document.createElement("select");
    verSelect.id = "adminVerifyType";
    verSelect.className = "bg-black border border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-emerald-300 font-bold";
    verSelect.innerHTML =
      '<option value="video_verified">🟡 Video Verified Only</option>' +
      '<option value="channel_verified">🟢 Full Channel Verified</option>';

    // Auto-adjust Audience default when Category changes
    adminCatSelect.addEventListener("change", function() {
      var c = this.value;
      if (c === "bayan") audSelect.value = "family_only";
      else if (c === "kids_cartoon" || c === "kids_tarbiyah") audSelect.value = "kids_preferred";
      else audSelect.value = "both_family_kids";
    });

    // Auto-select "Full Channel Verified" when a @Channel URL is typed
    var ytUrlInp = document.getElementById("adminYtUrlInput");
    if (ytUrlInp) {
      ytUrlInp.addEventListener("input", function() {
        var v = (this.value || "").trim();
        if (v.indexOf("/@") !== -1 || v.indexOf("@") === 0 || v.indexOf("/channel/") !== -1) {
          verSelect.value = "channel_verified";
        } else {
          verSelect.value = "video_verified";
        }
      });
    }

    var pushBtn = gridRow.querySelector('button[onclick*="adminAddGlobalVideo"]');
    gridRow.insertBefore(audSelect, pushBtn);
    gridRow.insertBefore(verSelect, pushBtn);
  }

  // Override Priority Score so Kids Preferred, Kids+Family, and Family Only rank properly
  window.getModePriorityScore = function(video) {
    var score = 0;
    if (video.lang === preferredContentLang || video.lang === "global" || video.universalQuran) score += 55;
    if (isKidsLocked) {
      if (video.audienceMode === "kids_preferred" || video.category === "kids_cartoon" || video.category === "kids_tarbiyah") score += 45;
      else if (video.audienceMode === "both_family_kids" || video.category === "quran" || video.category === "naat" || video.category === "tarbiyah") score += 30;
    } else {
      if (video.audienceMode === "family_only" || video.category === "bayan") score += 40;
      else if (video.audienceMode === "both_family_kids" || video.category === "quran" || video.category === "naat" || video.category === "tarbiyah") score += 35;
      else score += 15;
    }
    return score;
  };

  // Override adminAddGlobalVideo to save audienceMode and channelVerified / videoVerified status!
  var prevAdminAdd = window.adminAddGlobalVideo;
  window.adminAddGlobalVideo = function() {
    var audEl = document.getElementById("adminVideoAudience");
    var verEl = document.getElementById("adminVerifyType");
    var audVal = audEl ? audEl.value : "both_family_kids";
    var isChVerified = verEl ? (verEl.value === "channel_verified") : false;
    var chName = (document.getElementById("adminChannelName") ? document.getElementById("adminChannelName").value : "").trim();

    var beforeLen = videosData.length;
    if (prevAdminAdd) prevAdminAdd();
    var afterLen = videosData.length;

    if (afterLen > beforeLen) {
      var addedCount = afterLen - beforeLen;
      for (var i = 0; i < addedCount; i++) {
        var v = videosData[i];
        if (v) {
          v.audienceMode = audVal;
          v.kidsSafe = (audVal !== "family_only");
          v.channelVerified = isChVerified;
          if (isChVerified && v.channel && window.verifiedChannelsList.indexOf(v.channel) === -1) {
            window.verifiedChannelsList.push(v.channel);
          }
        }
      }
      localStorage.setItem("qaaf_verified_channels", JSON.stringify(window.verifiedChannelsList));
      localStorage.setItem("qaaf_videos_data", JSON.stringify(videosData));
      renderVideos();
      
      
      // AUTO 1-CLICK INSTANT PUSH TO FIREBASE CLOUD
      const fbEndpoint2 = "https://qaaftube-6f251-default-rtdb.firebaseio.com/qaaf_global_state.json";
      const cloudPayload2 = {
        videosData: videosData || [],
        verifiedChannelsList: window.verifiedChannelsList || [],
        bannedChannels: bannedChannels || [],
        blockedVideoIds: blockedVideoIds || [],
        regionalPromos: regionalPromos || {},
        isPromoBarEnabled: isPromoBarEnabled !== false,
        parentRequestsQueue: window.parentRequestsQueue || [],
        registeredUsersJson: JSON.stringify(window.registeredUsersMap || {}),
        channelPlaylistsJson: JSON.stringify(window.qaafRealChannelPlaylistsMap || {}),
        playlistVideosCacheJson: JSON.stringify(window.qaafPlaylistVideosCache || {}),
        qaafSecurityToken: "QAAF_PROTECTED_TOKEN_786_99_MAKKAH",
        updatedAt: Date.now()
      };
      fetch(fbEndpoint2, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloudPayload2)
      }).then(res => {
        if (res.ok) {
          localStorage.setItem("qaaf_cloud_last_synced", new Date().toLocaleTimeString());
          localStorage.setItem("qaaf_cloud_last_sync_ts", Date.now().toString());
          localStorage.setItem("qaaf_cloud_updated_at", cloudPayload2.updatedAt.toString());
          if (window.qaafCloudSync) window.qaafCloudSync.updateStatusBadge("connected");
          showSyncToast(`☁️ کلاؤڈ پر فوراً منتقل ہو گیا!`);
        }
      }).catch(e => console.warn(e));
    }
  };

  // =========================================================================
  // 4. UPDATE VIDEO CARDS, PLAYER & ADMIN CATALOG TO SHOW "CHANNEL VERIFIED" VS "VIDEO VERIFIED"
  // =========================================================================
  var prevOpenPlayer = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    if (prevOpenPlayer) prevOpenPlayer(videoId);
    var video = videosData.find(function(v) { return v.id === videoId; });
    if (!video) return;
    var chEl = document.getElementById("playingChannelName");
    var vwEl = document.getElementById("playingViewsText");
    var isChVer = window.isChannelFullyVerified(video.channel, video);
    if (chEl) {
      chEl.innerHTML = video.channel + (isChVer ? ' <span class="text-emerald-400 font-bold ml-1 text-xs" title="Verified Channel">✓</span>' : '');
    }
    if (vwEl) {
      vwEl.innerText = ((typeof window.formatQaafRealViews === 'function') ? window.formatQaafRealViews(video) : ((video.realViews || 0) + ' views')) + " • " + (video.lang || "en").toUpperCase();
    }
  };

  var prevRenderNow = window.renderVideosNow;
  window.renderVideosNow = function() {
    // Map kids_tarbiyah filter so legacy 'stories' also matches if needed
    renderTopicAndByChannelsBar();
    if (prevRenderNow) prevRenderNow();

    var grid = document.getElementById("videoGrid");
    if (grid && videosData.length === 0) {
      grid.innerHTML =
        '<div class="col-span-full bg-[#121620] border border-slate-800 rounded-2xl p-8 text-center my-4">' +
          '<div class="text-3xl mb-2">🕌</div>' +
          '<h4 class="text-sm sm:text-base font-extrabold text-white mb-1">Catalog is Clean &amp; Ready</h4>' +
          '<p class="text-xs text-slate-400">No channels or videos are preloaded. Super Admin can now add Verified Channels or Videos from the Admin Console.</p>' +
        '</div>';
      return;
    }

    // Update every Video Card to show "🟢 Channel Verified" vs "🟡 Video Verified" and Audience Mode label!
    document.querySelectorAll("#videoGrid > div").forEach(function(card) {
      var flagBtn = card.querySelector('button[onclick*="openFlagModal"]');
      if (!flagBtn) return;
      var m = (flagBtn.getAttribute("onclick") || "").match(/'([^']+)'/);
      if (!m || !m[1]) return;
      var vidObj = videosData.find(function(x) { return x.id === m[1]; });
      if (!vidObj) return;

      var isChVer = window.isChannelFullyVerified(vidObj.channel, vidObj);
      var chRow = card.querySelector(".p-3 .flex.items-center.justify-between");
      if (chRow) {
        var firstSpan = chRow.querySelector("span:first-child");
        var lastSpan = chRow.querySelector("span:last-child");
        if (firstSpan) {
          firstSpan.className = "text-slate-400 font-medium truncate text-xs flex items-center gap-1";
          firstSpan.innerHTML = vidObj.channel + (isChVer ? ' <span class="text-emerald-400 font-bold text-[10px]" title="Verified Channel">✓</span>' : '');
        }
        if (lastSpan) {
          var modeTxt = vidObj.audienceMode === "kids_preferred"
            ? "🧒 Kids Preferred"
            : (vidObj.audienceMode === "family_only" || !vidObj.kidsSafe ? "🎙️ Family Only" : "👨‍👩‍👧‍👦 Kids + Family");
          lastSpan.innerText = modeTxt;
        }
      }
    });
  };

  // Also add 1-click "🟢 Channel Verified / 🟡 Video Verified" toggle in Admin Active Channels Bar
  var baseAdminCatalog = window.renderAdminActiveVideosCatalog;
  window.renderAdminActiveVideosCatalog = function() {
    if (baseAdminCatalog) baseAdminCatalog();
    var listEl = document.getElementById("adminActiveVideosCatalogList");
    if (!listEl) return;

    var topBox = listEl.querySelector(".bg-slate-900\\/90");
    if (topBox) {
      var chWraps = topBox.querySelectorAll(".inline-flex");
      chWraps.forEach(function(wrap) {
        var btn = wrap.querySelector("button");
        if (!btn || wrap.querySelector(".adm-ver-ch-btn")) return;
        var m = (btn.getAttribute("onclick") || "").match(/'([^']+)'/);
        if (!m || !m[1]) return;
        var chName = m[1];
        var isVer = window.isChannelFullyVerified(chName);

        var verBtn = document.createElement("button");
        verBtn.type = "button";
        verBtn.className = "adm-ver-ch-btn px-2 py-1 text-[10px] font-extrabold border-l border-slate-700 transition " + (isVer ? "bg-emerald-900/70 text-emerald-300 hover:bg-amber-700 hover:text-white" : "bg-amber-900/60 text-amber-300 hover:bg-emerald-700 hover:text-white");
        verBtn.innerText = isVer ? "🟢 Ch.Verified" : "🟡 Vid.Only";
        verBtn.title = "Click to toggle between Full Channel Verified (Green) and Video Verified Only (Yellow)";
        verBtn.onclick = function(e) { window.adminToggleChannelVerifiedStatus(chName, e); };
        wrap.insertBefore(verBtn, wrap.lastElementChild);
      });
    }
  };

})();

(function initQaafV11MasterFix() {
  window.qaafSelectedChannel = "ALL";
  window.qaafGridPageLimit = 24;

  // =========================================================================
  // 1. FIX BUG 2: GUARANTEED VIDEO PLAYER VISIBILITY (FULL & MINI PLAYER)
  // =========================================================================
  window.expandFromMiniPlayer = function() {
    var modal = document.getElementById("playerModal");
    var box = document.getElementById("playerModalBox");
    var aspect = document.getElementById("playerAspectBox");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var expBtn = document.getElementById("expandMiniPlayerBtn");
    var minBtn = document.getElementById("minimizePlayerBtn");
    var miniTitle = document.getElementById("miniPlayerTitleLabel");
    var co = document.getElementById("miniCenterExpandOverlay");
    var vb = document.getElementById("qaafVolumeControlBox");
    var video = (videosData || []).find(function(v) { return v.id === currentPlayingVideoId; }) || (videosData && videosData[0]);
    var isShort = video && isVideoShort(video);

    if (modal && box && aspect) {
      modal.classList.remove("hidden");
      modal.style.cssText = "position:fixed; inset:0; z-index:999; background:rgba(0,0,0,0.96); display:flex; flex-direction:column; justify-content:flex-start; align-items:center; overflow:hidden; padding:0;";
      if (isShort) {
        box.style.cssText = "width:100%; max-width:420px; height:100%; background:#0f0f0f; display:flex; flex-direction:column; overflow:hidden; border-left:1px solid rgba(255,255,255,0.1); border-right:1px solid rgba(255,255,255,0.1); transform:none;";
        aspect.style.cssText = "position:relative; width:100%; height:58vh; min-height:320px; max-height:64vh; background:#000; flex-shrink:0; overflow:hidden; display:block; margin:0 auto;";
      } else {
        box.style.cssText = "width:100%; max-width:1024px; height:100%; background:#0f0f0f; display:flex; flex-direction:column; overflow:hidden; border-left:1px solid rgba(255,255,255,0.1); border-right:1px solid rgba(255,255,255,0.1); transform:none;";
        aspect.style.cssText = "position:relative; width:100%; height:42vh; min-height:240px; max-height:480px; background:#000; flex-shrink:0; overflow:hidden; display:block;";
      }
      if (scrollWrap) scrollWrap.classList.remove("hidden");
      if (minBtn) minBtn.classList.remove("hidden");
      if (miniTitle) miniTitle.classList.add("hidden");
      if (expBtn) expBtn.classList.add("hidden");
      if (co) co.classList.add("hidden");
      if (vb) vb.classList.remove("hidden");
    }
  };

  window.minimizeToMiniPlayer = function() {
    var modal = document.getElementById("playerModal");
    var box = document.getElementById("playerModalBox");
    var aspect = document.getElementById("playerAspectBox");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var expBtn = document.getElementById("expandMiniPlayerBtn");
    var minBtn = document.getElementById("minimizePlayerBtn");
    var miniTitle = document.getElementById("miniPlayerTitleLabel");
    var co = document.getElementById("miniCenterExpandOverlay");
    var vb = document.getElementById("qaafVolumeControlBox");
    var video = (videosData || []).find(function(v) { return v.id === currentPlayingVideoId; });

    if (modal && box && aspect) {
      modal.classList.remove("hidden");
      modal.style.cssText = "position:fixed; bottom:3.2rem; right:0.75rem; left:auto; top:auto; width:300px; z-index:999; display:block; background:transparent; pointer-events:auto;";
      box.style.cssText = "width:100%; background:#141414; border-radius:16px; overflow:hidden; border:2px solid rgba(16,185,129,0.7); box-shadow:0 20px 50px rgba(0,0,0,0.9); display:flex; flex-direction:column; transform:none;";
      aspect.style.cssText = "position:relative; width:100%; height:168px; min-height:168px; background:#000; flex-shrink:0; overflow:hidden; display:block;";
      if (scrollWrap) scrollWrap.classList.add("hidden");
      if (minBtn) minBtn.classList.add("hidden");
      if (miniTitle) {
        miniTitle.innerText = video ? video.title : "Playing...";
        miniTitle.classList.remove("hidden");
      }
      if (expBtn) expBtn.classList.add("hidden");
      if (co) co.classList.remove("hidden");
      if (vb) vb.classList.add("hidden");
    }
    [100, 350].forEach(function(ms) {
      setTimeout(function() {
        if (typeof sendYouTubeCommand === "function") sendYouTubeCommand("playVideo");
      }, ms);
    });
  };

  window.openVideoPlayer = function(videoId) {
    if (window.isKidsTimeExpiredLock) return;
    activePlayerEngine = "youtube";
    currentPlayingVideoId = videoId;
    var video = (videosData || []).find(function(v) { return v.id === videoId; }) || (videosData && videosData[0]);
    if (!video) return;
    if (typeof window.incrementQaafRealView === 'function') { window.incrementQaafRealView(video); }

    if (typeof recordVideoInHistory === "function") recordVideoInHistory(videoId);

    var titleEl = document.getElementById("playingTitle");
    if (titleEl) titleEl.innerText = video.title;

    var isChVer = typeof window.isChannelFullyVerified === "function" && window.isChannelFullyVerified(video.channel, video);
    var chEl = document.getElementById("playingChannelName");
    if (chEl) {
      chEl.innerHTML = video.channel + (isChVer ? ' <span class="text-emerald-400 font-bold ml-1 text-xs" title="Verified Channel">✓</span>' : '');
    }
    var vwEl = document.getElementById("playingViewsText");
    if (vwEl) {
      vwEl.innerText = ((typeof window.formatQaafRealViews === 'function') ? window.formatQaafRealViews(video) : ((video.realViews || 0) + ' views')) + " • " + (video.lang || "en").toUpperCase();
    }

    var shortsNav = document.getElementById("shortsSideNav");
    if (isVideoShort(video)) {
      if (shortsNav) { shortsNav.classList.remove("hidden"); shortsNav.classList.add("flex"); }
    } else {
      if (shortsNav) { shortsNav.classList.add("hidden"); shortsNav.classList.remove("flex"); }
    }

    var modal = document.getElementById("playerModal");
    var wasHidden = modal && modal.classList.contains("hidden");
    if (modal) modal.classList.remove("hidden");

    window.expandFromMiniPlayer();
    updatePlayerEngineUI();

    var ytCont = document.getElementById("ytPlayerContainer");
    var safeCont = document.getElementById("safeCanvasPlayerContainer");
    if (ytCont) {
      ytCont.classList.remove("hidden");
      var originParam = window.location.protocol.startsWith("http") ? ("&origin=" + encodeURIComponent(window.location.origin)) : "";
      var embedUrl = "https://www.youtube-nocookie.com/embed/" + video.ytId + "?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&vq=hd1080" + originParam;
      ytCont.innerHTML = '<iframe id="ytIframe" style="width:100%;height:100%;border:0;display:block;" src="' + embedUrl + '" title="QAAF YouTube Player" frameborder="0" sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
    }
    if (safeCont) safeCont.classList.add("hidden");

    if (wasHidden) {
      try { history.pushState({ qaafVideoOpen: true }, ""); } catch (e) {}
    }

    setTimeout(function() {
      if (typeof window.renderWatchPageExtras === "function") window.renderWatchPageExtras(videoId);
    }, 120);
  };

  window.closeVideoPlayer = function() {
    var ytCont = document.getElementById("ytPlayerContainer");
    if (ytCont) ytCont.innerHTML = '<iframe id="ytIframe" class="w-full h-full" src="about:blank" frameborder="0"></iframe>';
    stopSafeCanvasPlayer();
    stopHalalVoiceRecitation();
    var duaOv = document.getElementById("duaAdOverlay");
    if (duaOv) duaOv.classList.add("hidden");
    var modal = document.getElementById("playerModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    if (adCountdownTimer) clearInterval(adCountdownTimer);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    resetDuaAudioBtn();
  };

  // =========================================================================
  // 2. FIX BUG 1: ULTRA-FAST O(1) UNIFIED VIDEO RENDERER (NO 794-VIDEO FREEZE!)
  // =========================================================================
  var fastRenderTimer = null;

  function executeFastUnifiedRender() {
    var grid = document.getElementById("videoGrid");
    if (!grid) return;

    var favBadge = document.getElementById("favCountBadge");
    if (favBadge) favBadge.innerText = (favoriteVideoIds && favoriteVideoIds.length) || 0;

    var blockedSet = new Set(blockedVideoIds || []);
    var bannedSet = new Set(bannedChannels || []);
    var favSet = new Set(favoriteVideoIds || []);
    var verChSet = new Set(window.verifiedChannelsList || []);

    var plVidSet = new Set();
    var pls = typeof getActivePlaylistsGroup === "function" ? getActivePlaylistsGroup() : [];
    (pls || []).forEach(function(pl) {
      (pl.videos || []).forEach(function(vidId) { plVidSet.add(vidId); });
    });

    var isPlFilter = (currentSortFilter === "playlist");
    var isHistFilter = (currentSortFilter === "history");
    var allowedOrderIds = null;

    if (isPlFilter) {
      var activePl = (pls || []).find(function(p) { return p.id === window.activeSelectedPlaylistId; }) || (pls && pls[0]);
      if (activePl) window.activeSelectedPlaylistId = activePl.id;
      allowedOrderIds = (activePl && activePl.videos) || [];
    } else if (isHistFilter && typeof getActiveHistory === "function") {
      allowedOrderIds = getActiveHistory() || [];
    }

    var rawSearch = (window.qaafActiveSearchQuery || "").trim().toLowerCase();
    var searchTokens = rawSearch ? rawSearch.split(/\s+/).filter(Boolean) : [];
    var selCh = window.qaafSelectedChannel || "ALL";

    var sourceList = videosData || [];
    var allFiltered = [];

    if (allowedOrderIds !== null) {
      var byIdMap = new Map();
      for (var i = 0; i < sourceList.length; i++) {
        var v0 = sourceList[i];
        if (v0 && v0.id) byIdMap.set(v0.id, v0);
      }
      for (var j = 0; j < allowedOrderIds.length; j++) {
        var vf = byIdMap.get(allowedOrderIds[j]);
        if (vf && !blockedSet.has(vf.id) && !bannedSet.has(vf.channel) && (!isKidsLocked || vf.kidsSafe)) {
          allFiltered.push(vf);
        }
      }
    } else {
      for (var k = 0; k < sourceList.length; k++) {
        var v = sourceList[k];
        if (!v || !v.ytId) continue;
        if (blockedSet.has(v.id) || blockedSet.has(v.ytId)) continue;
        if (bannedSet.has(v.channel)) continue;
        if (isKidsLocked && !v.kidsSafe) continue;

        if (!rawSearch) {
          if (selCh !== "ALL" && v.channel !== selCh) continue;
          if (currentCategory !== "all") {
            if (currentCategory === "kids_tarbiyah") {
              if (v.category !== "kids_tarbiyah" && v.category !== "stories") continue;
            } else if (v.category !== currentCategory) {
              continue;
            }
          }
          if (strictLanguageOnly && v.lang !== preferredContentLang && v.lang !== "global" && !v.universalQuran) continue;
          if (currentSortFilter === "favorites" && !favSet.has(v.id)) continue;
        } else {
          var hay = ((v.title || "") + " " + (v.channel || "") + " " + (v.category || "")).toLowerCase();
          var matched = true;
          for (var t = 0; t < searchTokens.length; t++) {
            if (hay.indexOf(searchTokens[t]) === -1) { matched = false; break; }
          }
          if (!matched) continue;
        }
        allFiltered.push(v);
      }

      if (currentSortFilter === "recent") {
        allFiltered.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      } else if (currentSortFilter === "viewed") {
        allFiltered.sort(function(a, b) { return (b.views || 0) - (a.views || 0); });
      } else {
        var prefLangNow = String(window.preferredContentLang || preferredContentLang || "en").toLowerCase();
        allFiltered.sort(function(a, b) {
          var la = String((a && a.lang) || "global").toLowerCase();
          var lb = String((b && b.lang) || "global").toLowerCase();
          var sa = (la === prefLangNow) ? 0 : (la === "global" ? 1 : 2);
          var sb = (lb === prefLangNow) ? 0 : (lb === "global" ? 1 : 2);
          if (sa !== sb) return sa - sb;
          return (typeof getModePriorityScore === "function") ? (getModePriorityScore(b) - getModePriorityScore(a)) : 0;
        });
      }
    }

    var regularVideos = [];
    var shortVideos = [];
    for (var m = 0; m < allFiltered.length; m++) {
      var item = allFiltered[m];
      if (isVideoShort(item)) shortVideos.push(item);
      else regularVideos.push(item);
    }

    // YOUTUBE-STYLE SMART DIVERSE INTERLEAVER (1 VIDEO PER CHANNEL PER ROUND + FAVORITES & PREFERRED LANG BOOST)
    if (selCh === "ALL" && !rawSearch && currentSortFilter === "default" && allowedOrderIds === null) {
      var prefLangCode = String(window.preferredContentLang || preferredContentLang || "en").toLowerCase();
      var histArr = (typeof getActiveHistory === "function") ? (getActiveHistory() || []) : [];
      var histSetLocal = new Set(histArr);
      var likedChSet = new Set();
      var likedCatSet = new Set();

      (sourceList || []).forEach(function(v) {
        if (!v) return;
        if (favSet.has(v.id) || histSetLocal.has(v.id)) {
          if (v.channel) likedChSet.add(v.channel);
          if (v.category) likedCatSet.add(v.category);
        }
      });

      function interleaveByChannelSmart(arr) {
        if (!arr || arr.length <= 1) return arr;
        var bucketsMap = new Map();
        arr.forEach(function(v, idx) {
          var ch = (v && v.channel) ? v.channel : "General";
          if (!bucketsMap.has(ch)) bucketsMap.set(ch, []);
          var vLang = String(v.lang || "global").toLowerCase();
          var langScore = (vLang === prefLangCode) ? 100 : ((vLang === "global" || v.universalQuran) ? 50 : 0);
          var favBonus = favSet.has(v.id) ? 35 : (likedChSet.has(ch) ? 20 : 0);
          var catBonus = likedCatSet.has(v.category) ? 15 : 0;
          var watchedPenalty = histSetLocal.has(v.id) ? -25 : 0;
          var totalScore = langScore + favBonus + catBonus + watchedPenalty;
          bucketsMap.get(ch).push({
            video: v,
            score: totalScore,
            createdAt: v.createdAt || 0,
            origIdx: idx
          });
        });

        var chBuckets = [];
        bucketsMap.forEach(function(list, chName) {
          // Sort inside each channel: newest & highest interest first
          list.sort(function(a, b) {
            if (b.score !== a.score) return b.score - a.score;
            if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
            return a.origIdx - b.origIdx;
          });
          var maxCreated = 0;
          var bestLangScore = 0;
          list.forEach(function(x) {
            if (x.createdAt > maxCreated) maxCreated = x.createdAt;
            var vl = String(x.video.lang || "global").toLowerCase();
            var ls = (vl === prefLangCode) ? 2 : (vl === "global" ? 1 : 0);
            if (ls > bestLangScore) bestLangScore = ls;
          });
          chBuckets.push({
            channel: chName,
            items: list,
            bestLangScore: bestLangScore,
            isLikedCh: likedChSet.has(chName) ? 1 : 0,
            maxCreated: maxCreated
          });
        });

        // Sort channels: Preferred language first, then newest uploaded channel (#1 gets top spot), then liked channels
        chBuckets.sort(function(a, b) {
          if (b.bestLangScore !== a.bestLangScore) return b.bestLangScore - a.bestLangScore;
          if (b.maxCreated !== a.maxCreated) return b.maxCreated - a.maxCreated;
          return b.isLikedCh - a.isLikedCh;
        });

        // Strict Round-Robin: Pick ONLY 1 video from each channel in Round 1, then 1 from each in Round 2, etc.
        var interleaved = [];
        var maxDepth = 0;
        chBuckets.forEach(function(b) {
          if (b.items.length > maxDepth) maxDepth = b.items.length;
        });

        for (var r = 0; r < maxDepth; r++) {
          for (var c = 0; c < chBuckets.length; c++) {
            // Rotate starting channel slightly after Round 0 so rows look super varied like YouTube
            var rotIdx = (r === 0) ? c : ((c + r) % chBuckets.length);
            var bObj = chBuckets[rotIdx];
            if (r < bObj.items.length) {
              interleaved.push(bObj.items[r].video);
            }
          }
        }
        return interleaved;
      }

      regularVideos = interleaveByChannelSmart(regularVideos);
      shortVideos = interleaveByChannelSmart(shortVideos);
    }

    // 1. Render Shorts Shelf (Max 12 items)
    var shortsShelf = document.getElementById("qaafShortsShelf");
    if (!shortsShelf) {
      shortsShelf = document.createElement("div");
      shortsShelf.id = "qaafShortsShelf";
      shortsShelf.className = "mb-6";
      grid.parentNode.insertBefore(shortsShelf, grid);
    }
    if (shortVideos.length > 0) {
      var shHtml = "";
      var shSlice = shortVideos.slice(0, 12);
      for (var s = 0; s < shSlice.length; s++) {
        var sh = shSlice[s];
        var catArt = getCategoryIslamicArtwork(sh.category);
        var shThumb = sh.customThumb || ("https://i.ytimg.com/vi/" + sh.ytId + "/hqdefault.jpg");
        shHtml += '<a ' + (isKidsLocked ? '' : 'href="?watch=' + encodeURIComponent(sh.id) + '"') + ' onclick="return handleQaafVideoLinkClick(event, \'' + sh.id + '\')" class="w-40 sm:w-48 shrink-0 bg-[#12151c] rounded-2xl overflow-hidden border border-white/10 hover:border-red-500/60 transition cursor-pointer group relative aspect-[9/16] flex flex-col justify-end shadow-lg no-underline text-inherit">' +
          '<img src="' + shThumb + '" alt="" class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' + catArt + '\';" />' +
          '<div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent"></div>' +
          '<span class="absolute top-2.5 left-2.5 bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow"><svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-white shrink-0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M14.2 8.6C14.2 7 9.8 7 9.8 9.2C9.8 11.3 14.2 11.7 14.2 14.2C14.2 16.5 9.8 16.5 9.8 14.8"/></svg> <span>Short</span></span>' +
          '<div class="relative z-10 p-3 text-left">' +
            '<h4 class="text-xs font-extrabold text-white line-clamp-2 leading-snug mb-1">' + sh.title + '</h4>' +
            '<p class="text-[10px] text-slate-300 font-semibold truncate">' + sh.channel + '</p>' +
          '</div></a>';
      }
      shortsShelf.innerHTML = '<div class="flex items-center justify-between mb-2.5 px-1"><div class="flex items-center gap-2"><span class="bg-red-600 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold shadow"><svg viewBox="0 0 24 24" class="w-4 h-4 text-white shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M14.2 8.6C14.2 7 9.8 7 9.8 9.2C9.8 11.3 14.2 11.7 14.2 14.2C14.2 16.5 9.8 16.5 9.8 14.8"/></svg></span><h3 class="text-sm sm:text-base font-extrabold text-white tracking-tight">QAAF Islamic Shorts &amp; Quick Bayans</h3></div><span class="text-[11px] text-slate-400 font-semibold">Swipe / Scroll ➔</span></div><div class="flex items-center gap-3 overflow-x-auto pb-2">' + shHtml + '</div>';
      shortsShelf.classList.remove("hidden");
    } else {
      shortsShelf.classList.add("hidden");
    }

    // 2. Render Regular Videos (Batched 24 at a time via DocumentFragment)
    window.qaafActiveRegularVideos = regularVideos;
    var limit = window.qaafGridPageLimit || 24;
    var displayed = regularVideos.slice(0, limit);
    grid.innerHTML = "";

    if (regularVideos.length === 0 && shortVideos.length === 0) {
      grid.innerHTML = '<div class="col-span-full bg-[#121620] border border-slate-800 rounded-2xl p-8 text-center my-4"><div class="text-3xl mb-2">🕌</div><h4 class="text-sm sm:text-base font-extrabold text-white mb-1">No Videos Found</h4><p class="text-xs text-slate-400">Try selecting All Channels or another category above.</p></div>';
    } else {
      var frag = document.createDocumentFragment();
      var isAdminMode = isSuperAdmin() && !isKidsLocked;
      for (var d = 0; d < displayed.length; d++) {
        var vid = displayed[d];
        var cardEl = buildFastVideoCard(vid, favSet.has(vid.id), plVidSet.has(vid.id), verChSet.has(vid.channel) || vid.channelVerified, isAdminMode);
        frag.appendChild(cardEl);
      }
      grid.appendChild(frag);
    }

    renderQaafLoadMoreControls(regularVideos.length, displayed.length);
    updateAllChannelsButtonLabel();
  }

  function buildFastVideoCard(video, isFav, inPl, isChVer, isAdminMode) {
    var categoryArtwork = getCategoryIslamicArtwork(video.category);
    var thumbHq = "https://i.ytimg.com/vi/" + video.ytId + "/hqdefault.jpg";
    var thumbMq = "https://i.ytimg.com/vi/" + video.ytId + "/mqdefault.jpg";
    var cardThumb = video.customThumb || thumbHq;
    var chName = (video.channel || "QAAF Channel").trim();
    var chInitial = (chName.charAt(0) || "Q").toUpperCase();
    var viewsStr = (typeof window.formatQaafRealViews === 'function') ? window.formatQaafRealViews(video) : ((video.realViews || 0) + ' views');
    var safeCh = chName.replace(/'/g, "\\'");

    var card = document.createElement("div");
    card.className = "qaaf-yt-clean-card bg-transparent rounded-none sm:rounded-xl overflow-visible transition group relative";
    card.dataset.videoId = video.id;

    card.innerHTML =
      '<div class="relative aspect-video bg-slate-900 overflow-hidden sm:rounded-xl">' +
        '<a ' + (isKidsLocked ? '' : 'href="?watch=' + encodeURIComponent(video.id) + '"') + ' onclick="return handleQaafVideoLinkClick(event, \'' + video.id + '\')" class="block w-full h-full cursor-pointer no-underline text-inherit">' +
          '<img src="' + cardThumb + '" alt="" class="w-full h-full object-cover pointer-events-none select-none group-hover:scale-[1.02] transition duration-300" loading="lazy" decoding="async" onerror="if(!this.dataset.retried){this.dataset.retried=\'1\';this.src=\'' + thumbMq + '\';}else{this.onerror=null;this.src=\'' + categoryArtwork + '\';}" />' +
          '<span class="absolute bottom-2 right-2 bg-black/85 text-white text-[11px] font-bold px-1.5 py-0.5 rounded z-10 pointer-events-none">' + (video.duration || "12:00") + '</span>' +
        '</a>' +
        '<div id="cardActionMenu_' + video.id + '" class="hidden absolute top-2 right-2 z-30 bg-[#111620]/95 backdrop-blur-md border border-emerald-500/40 rounded-xl p-1.5 flex items-center gap-1.5 shadow-2xl">' +
          '<button type="button" onclick="toggleVideoInPlaylist(\'' + video.id + '\', event)" class="w-8 h-8 rounded-lg ' + (inPl ? 'bg-emerald-500 text-black' : 'bg-slate-800 hover:bg-[#164e3a] text-emerald-300 hover:text-white') + ' flex items-center justify-center text-xs font-extrabold shadow" title="Save to Playlist">' + (inPl ? '&#10004;' : '&#10133;') + '</button>' +
          '<button type="button" onclick="toggleFavoriteVideo(\'' + video.id + '\', event)" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs shadow" title="Favorite">' + (isFav ? '&#10084;&#65039;' : '&#129293;') + '</button>' +
          '<button type="button" onclick="openFlagModal(\'' + video.id + '\', event)" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-rose-950 text-white flex items-center justify-center text-xs shadow" title="Report">&#128681;</button>' +
          (isAdminMode ? '<button type="button" onclick="adminDeleteVideoCard(\'' + video.id + '\', event)" class="w-8 h-8 rounded-lg bg-rose-700 hover:bg-rose-600 text-white flex items-center justify-center text-xs shadow" title="Admin: Delete Video">&#128465;&#65039;</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="qaaf-yt-meta-row flex items-start gap-3 pt-2.5 px-3 sm:px-1 pb-1">' +
        '<div onclick="window.pickChannelFromTopBar(\'' + safeCh + '\', event); window.scrollTo({top:0,behavior:\'smooth\'});" class="w-9 h-9 rounded-full bg-[#164e3a] border border-emerald-400/40 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow cursor-pointer" title="' + chName + '">' +
          chInitial +
        '</div>' +
        '<a ' + (isKidsLocked ? '' : 'href="?watch=' + encodeURIComponent(video.id) + '"') + ' onclick="return handleQaafVideoLinkClick(event, \'' + video.id + '\')" class="flex-1 min-w-0 cursor-pointer no-underline text-inherit">' +
          '<h3 class="text-[14px] sm:text-[15px] font-bold text-white line-clamp-2 leading-snug">' + video.title + '</h3>' +
          '<div class="text-[11px] sm:text-xs text-slate-400 mt-1 flex items-center gap-1 truncate">' +
            '<span onclick="event.preventDefault(); event.stopPropagation(); window.pickChannelFromTopBar(\'' + safeCh + '\', event); window.scrollTo({top:0,behavior:\'smooth\'});" class="hover:text-emerald-400 truncate">' + chName + '</span>' +
            (isChVer ? '<span class="text-emerald-400 font-bold text-[10px] shrink-0" title="Verified Channel">&#10003;</span>' : '') +
            '<span class="shrink-0">&bull; ' + viewsStr + '</span>' +
          '</div>' +
        '</a>' +
        '<button type="button" onclick="event.stopPropagation(); var m=document.getElementById(\'cardActionMenu_' + video.id + '\'); if(m){m.classList.toggle(\'hidden\');}" class="w-8 h-8 rounded-full hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center shrink-0 text-lg font-extrabold cursor-pointer" title="More Options">&#8942;</button>' +
      '</div>';
    return card;
  }

  window.renderVideosNow = executeFastUnifiedRender;
  window.renderVideos = function() {
    if (fastRenderTimer) cancelAnimationFrame(fastRenderTimer);
    fastRenderTimer = requestAnimationFrame(executeFastUnifiedRender);
  };

  // Override qaafLoadMoreVideos to use buildFastVideoCard
  window.qaafLoadMoreVideos = function() {
    if (window.qaafIsLoadingMoreBatch) return;
    window.qaafIsLoadingMoreBatch = true;
    var grid = document.getElementById("videoGrid");
    if (!grid || !window.qaafActiveRegularVideos) {
      window.qaafIsLoadingMoreBatch = false;
      return;
    }
    var currentCount = grid.querySelectorAll("[data-video-id]").length;
    var nextBatch = window.qaafActiveRegularVideos.slice(currentCount, currentCount + 24);
    if (nextBatch.length > 0) {
      var favSet = new Set(favoriteVideoIds || []);
      var verChSet = new Set(window.verifiedChannelsList || []);
      var plVidSet = new Set();
      var pls = typeof getActivePlaylistsGroup === "function" ? getActivePlaylistsGroup() : [];
      (pls || []).forEach(function(pl) { (pl.videos || []).forEach(function(id) { plVidSet.add(id); }); });
      var isAdminMode = isSuperAdmin() && !isKidsLocked;

      var frag = document.createDocumentFragment();
      nextBatch.forEach(function(vid) {
        frag.appendChild(buildFastVideoCard(vid, favSet.has(vid.id), plVidSet.has(vid.id), verChSet.has(vid.channel) || vid.channelVerified, isAdminMode));
      });
      grid.appendChild(frag);
      window.qaafGridPageLimit = currentCount + nextBatch.length;
      renderQaafLoadMoreControls(window.qaafActiveRegularVideos.length, currentCount + nextBatch.length);
    }
    setTimeout(function() { window.qaafIsLoadingMoreBatch = false; }, 180);
  };

  // =========================================================================
  // 3. INTERACTIVE "📺 ALL CHANNELS ▾" DROPDOWN IN CATEGORY BAR (PENDING ITEM #1)
  // =========================================================================
  if (!document.getElementById("allChannelsDropdownPopup")) {
    var pop = document.createElement("div");
    pop.id = "allChannelsDropdownPopup";
    pop.dir = "ltr";
    pop.className = "hidden fixed left-3 top-28 z-50 w-72 sm:w-80 max-h-80 overflow-y-auto bg-[#121622] border-2 border-emerald-500/60 rounded-2xl shadow-2xl p-2.5 space-y-1.5 text-xs";
    document.body.appendChild(pop);
  }

  function updateAllChannelsButtonLabel() {
    var allBtn = document.getElementById("ui_catAll");
    if (!allBtn) return;
    var selCh = window.qaafSelectedChannel || "ALL";
    var labelTxt = selCh === "ALL" ? "All Channels" : selCh;
    allBtn.innerHTML = '<span>📺</span> <span class="max-w-[130px] truncate">' + labelTxt + '</span> <span class="text-[10px] opacity-80">▾</span>';
  }

  window.toggleAllChannelsDropdownPopup = function(ev) {
    if (ev) ev.stopPropagation();
    var pop = document.getElementById("allChannelsDropdownPopup");
    if (!pop) return;
    if (!pop.classList.contains("hidden")) {
      pop.classList.add("hidden");
      return;
    }

    var blockedSet = new Set(blockedVideoIds || []);
    var bannedSet = new Set(bannedChannels || []);
    var verChSet = new Set(window.verifiedChannelsList || []);
    var countsMap = new Map();
    var chVerMap = new Map();

    (videosData || []).forEach(function(v) {
      if (!v || !v.channel || blockedSet.has(v.id) || bannedSet.has(v.channel)) return;
      if (isKidsLocked && !v.kidsSafe) return;
      countsMap.set(v.channel, (countsMap.get(v.channel) || 0) + 1);
      if (verChSet.has(v.channel) || v.channelVerified) chVerMap.set(v.channel, true);
    });

    var greenChs = [];
    var yellowChs = [];
    countsMap.forEach(function(cnt, ch) {
      if (chVerMap.get(ch)) greenChs.push({ name: ch, count: cnt });
      else yellowChs.push({ name: ch, count: cnt });
    });

    var isAll = (window.qaafSelectedChannel === "ALL");
    var html = '<button type="button" onclick="pickChannelFromTopBar(\'ALL\', event)" class="w-full text-left px-3 py-2 rounded-xl font-extrabold flex items-center justify-between transition ' + (isAll ? 'bg-emerald-500 text-black shadow' : 'bg-slate-800 hover:bg-slate-700 text-white') + '"><span>📺 All Channels (Default)</span><span>Show All</span></button>';

    if (greenChs.length > 0) {
      html += '<p class="px-2 pt-1.5 text-[10px] font-extrabold text-emerald-400">🟢 Verified Channels (' + greenChs.length + ')</p>';
      greenChs.forEach(function(item) {
        var sCh = item.name.replace(/'/g, "\\'");
        var act = (window.qaafSelectedChannel === item.name);
        html += '<button type="button" onclick="pickChannelFromTopBar(\'' + sCh + '\', event)" class="w-full text-left px-2.5 py-1.5 rounded-xl font-bold flex items-center justify-between border transition ' + (act ? 'bg-emerald-500 text-black border-emerald-300 font-extrabold' : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-200 border-emerald-500/30') + '"><span class="truncate pr-2">✓ ' + item.name + '</span><span class="text-[10px] opacity-80">(' + item.count + ')</span></button>';
      });
    }

    if (yellowChs.length > 0) {
      html += '<p class="px-2 pt-1.5 text-[10px] font-extrabold text-amber-400">🟡 Selected Video Channels (' + yellowChs.length + ')</p>';
      yellowChs.forEach(function(item) {
        var sCh = item.name.replace(/'/g, "\\'");
        var act = (window.qaafSelectedChannel === item.name);
        html += '<button type="button" onclick="pickChannelFromTopBar(\'' + sCh + '\', event)" class="w-full text-left px-2.5 py-1.5 rounded-xl font-bold flex items-center justify-between border transition ' + (act ? 'bg-amber-400 text-black border-amber-200 font-extrabold' : 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 border-amber-500/30') + '"><span class="truncate pr-2">' + item.name + '</span><span class="text-[10px] opacity-80">(' + item.count + ')</span></button>';
      });
    }

    pop.innerHTML = html;
    pop.classList.remove("hidden");
  };

  window.pickChannelFromTopBar = function(chName, ev) {
    if (ev) ev.stopPropagation();
    window.qaafSelectedChannel = chName || "ALL";
    window.qaafGridPageLimit = 24;
    var pop = document.getElementById("allChannelsDropdownPopup");
    if (pop) pop.classList.add("hidden");
    updateAllChannelsButtonLabel();
    window.renderVideosNow();
  };

  window.selectChannelFilter = function(chName) {
    window.qaafSelectedChannel = chName || "ALL";
    window.qaafGridPageLimit = 24;
    updateAllChannelsButtonLabel();
    window.renderVideosNow();
  };

  window.filterCategory = function(cat, ev) {
    if (cat === "all") {
      window.toggleAllChannelsDropdownPopup(ev);
      currentCategory = "all";
    } else {
      currentCategory = cat;
      var pop = document.getElementById("allChannelsDropdownPopup");
      if (pop) pop.classList.add("hidden");
    }
    window.qaafGridPageLimit = 24;
    document.querySelectorAll("#categoryBar .cat-chip").forEach(function(btn) {
      var isAct = (btn.getAttribute("onclick") || "").indexOf("'" + cat + "'") !== -1;
      btn.className = "cat-chip " + (btn.classList.contains("family-only-chip") ? "family-only-chip " : "") + (isAct ? "bg-emerald-500 text-black px-3 py-1 rounded-lg text-xs font-extrabold shrink-0 shadow flex items-center gap-1.5" : "bg-[#272727] hover:bg-[#3f3f3f] text-white px-3 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5") + (isKidsLocked && btn.classList.contains("family-only-chip") ? " hidden" : "");
    });
    window.renderVideosNow();
  };

  document.addEventListener("click", function(e) {
    var pop = document.getElementById("allChannelsDropdownPopup");
    var allBtn = document.getElementById("ui_catAll");
    if (pop && !pop.classList.contains("hidden") && (!allBtn || !allBtn.contains(e.target)) && !pop.contains(e.target)) {
      pop.classList.add("hidden");
    }
  });

  window.renderVideosNow();
})();

(function initPureYoutubeWatchLayout() {
  // Remove any leftover floating HUD elements inside #playerAspectBox
  ["qaafFloatingPlayerHud", "qaafHudWakeZoneTop"].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  });

  // Add a tiny Close button ONLY for Mini-Player mode
  var aspectBox = document.getElementById("playerAspectBox");
  if (aspectBox && !document.getElementById("qaafMiniPlayerCloseBtn")) {
    var miniClose = document.createElement("button");
    miniClose.id = "qaafMiniPlayerCloseBtn";
    miniClose.type = "button";
    miniClose.style.cssText = "position:absolute; top:6px; right:6px; z-index:40; width:26px; height:26px; border-radius:9999px; background:rgba(0,0,0,0.78); border:1px solid rgba(255,255,255,0.22); color:#fff; font-size:11px; font-weight:800; display:none; align-items:center; justify-content:center;";
    miniClose.innerText = "✕";
    miniClose.onclick = function(e) {
      e.stopPropagation();
      closeVideoPlayer();
    };
    aspectBox.appendChild(miniClose);
  }

  // Rebuild #ytWatchScrollContainer to match the exact clean YouTube Mobile Watch Screen (input_file_9.jpeg)
  function buildCleanWatchDetailsLayout() {
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    if (!scrollWrap || document.getElementById("ytCleanWatchHeader")) return;

    var savedVol = parseInt(localStorage.getItem("qaaf_player_volume") || "100", 10);

    scrollWrap.className = "flex-1 overflow-y-auto bg-[#0f0f0f] text-white select-none";
    scrollWrap.innerHTML =
      '<!-- 1. COMPACT WATCH METADATA & ACTIONS (EXACT YOUTUBE MOBILE STYLE) -->' +
      '<div id="ytCleanWatchHeader" class="px-3.5 pt-2.5 pb-2 space-y-2">' +

        '<!-- Subtle thin drag handle pill at top of info area for swipe-down minimize -->' +
        '<div class="w-9 h-1 bg-white/20 rounded-full mx-auto mb-1"></div>' +

        '<!-- Single-Line Title with Right Gradient Fade (Tap to toggle full title) -->' +
        '<h2 id="playingTitle" onclick="this.classList.toggle(\'yt-single-line-gradient-title\')" class="yt-single-line-gradient-title text-[15px] sm:text-base font-bold text-white leading-snug cursor-pointer" title="Tap to expand title">Playing Safe Islamic Video</h2>' +

        '<!-- Thin, Subtle Metadata Line (@Channel • Likes • Views • Lang) -->' +
        '<div class="flex items-center justify-between gap-2 text-[11px] text-neutral-400 font-normal">' +
          '<p id="playingViewsText" class="truncate">@Channel • 2.5K views • GLOBAL</p>' +
          '<div class="flex items-center gap-2 shrink-0">' +
            '<button type="button" onclick="minimizeToMiniPlayer()" class="text-neutral-400 hover:text-white px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-semibold flex items-center gap-1" title="Minimize"><span>⌄</span><span>Mini</span></button>' +
            '<button type="button" onclick="closeVideoPlayer()" class="text-neutral-400 hover:text-rose-400 px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-semibold" title="Close">✕ Close</button>' +
          '</div>' +
        '</div>' +

        '<!-- Channel Row + Single-Line Icon Action Pills + Below-Video Volume Bar -->' +
        '<div class="flex items-center justify-between gap-2 pt-1 overflow-x-auto yt-actions-scroll">' +
          '<!-- Left: Small Channel Avatar & Name -->' +
          '<div class="flex items-center gap-2 shrink-0 pr-2">' +
            '<div class="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">🕌</div>' +
            '<p id="playingChannelName" class="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[200px]">Channel Name</p>' +
          '</div>' +

          '<!-- Right: Compact Single-Row YouTube Action Icons + Volume Control -->' +
          '<div class="flex items-center gap-1.5 shrink-0">' +


            '<!-- Like / Favorite Icon Pill -->' +
            '<button type="button" onclick="toggleFavoriteVideo(currentPlayingVideoId, event)" class="bg-[#272727] hover:bg-[#383838] text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition shrink-0" title="Favorite">' +
              '<span>👍</span> <span id="watchLikeCountLabel" class="text-[11px] text-neutral-200">Like</span>' +
            '</button>' +

            '<!-- Save to Playlist Pill -->' +
            '<button type="button" onclick="toggleVideoInPlaylist(currentPlayingVideoId, event)" class="bg-[#272727] hover:bg-[#383838] text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition shrink-0" title="Save to Playlist">' +
              '<span>➕</span> <span class="text-[11px] text-neutral-200">Save</span>' +
            '</button>' +

            '<!-- Daily Dua Pill -->' +
            '<button type="button" onclick="triggerAdSimulation()" class="bg-[#272727] hover:bg-[#383838] text-amber-300 px-2.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition shrink-0" title="Daily Dua">' +
              '<span>🕌</span> <span class="text-[11px]">Dua</span>' +
            '</button>' +

            '<!-- Report Flag Icon Pill -->' +
            '<button type="button" onclick="openFlagModal(currentPlayingVideoId)" class="bg-[#272727] hover:bg-rose-950 text-neutral-300 px-2.5 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center transition shrink-0" title="Report Video">' +
              '<span>🚩</span>' +
            '</button>' +
          '</div>' +
        '</div>' +

        '<!-- 2. COMPACT YOUTUBE-STYLE COMMENTS TEASER BOX (EXPANDS ON TAP) -->' +
        '<div class="pt-1.5">' +
          '<div onclick="toggleCompactCommentsExpand()" class="bg-[#1e1e1e] hover:bg-[#262626] rounded-xl px-3 py-2.5 cursor-pointer transition">' +
            '<div class="flex items-center justify-between text-xs mb-1">' +
              '<span class="font-bold text-white flex items-center gap-1.5"><span>Comments</span> <span id="watchCommentCountBadge" class="text-neutral-400 font-normal text-[11px]">1</span></span>' +
              '<span id="commentsExpandHint" class="text-[10px] text-neutral-400">Tap to view / add ▾</span>' +
            '</div>' +
            '<div class="flex items-center gap-2 text-xs">' +
              '<div id="latestCommentAvatar" class="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">A</div>' +
              '<p id="latestCommentPreviewText" class="text-neutral-200 text-[11px] truncate">ماشاء اللہ، بہت بہترین اور معلوماتی ویڈیو</p>' +
            '</div>' +
          '</div>' +

          '<!-- Expandable Full Comments Drawer (Hidden by Default) -->' +
          '<div id="expandedCommentsDrawer" class="hidden mt-2 bg-[#161616] border border-white/10 rounded-xl p-3 space-y-2.5">' +
            '<div class="flex gap-2">' +
              '<input id="newCommentInput" type="text" placeholder="Add a polite comment..." class="flex-1 bg-black border border-neutral-700 rounded-full px-3.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none" />' +
              '<button type="button" onclick="postVideoComment()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-full text-xs font-extrabold shrink-0">Post</button>' +
            '</div>' +
            '<div id="watchCommentsList" class="space-y-1.5 max-h-40 overflow-y-auto pr-1 text-xs"></div>' +
          '</div>' +
        '</div>' +

      '</div>' +

      '<!-- 3. UP NEXT VIDEOS FEED -->' +
      '<div class="px-3.5 pt-2 pb-6">' +
        '<h4 class="text-xs font-bold text-neutral-300 mb-2.5">Up Next</h4>' +
        '<div id="watchUpNextGrid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"></div>' +
      '</div>';
  }

  buildCleanWatchDetailsLayout();

  window.toggleCompactCommentsExpand = function() {
    var drw = document.getElementById("expandedCommentsDrawer");
    var hint = document.getElementById("commentsExpandHint");
    if (!drw) return;
    drw.classList.toggle("hidden");
    if (hint) hint.innerText = drw.classList.contains("hidden") ? "Tap to view / add ▾" : "Hide ▴";
  };

  window.changeBelowVideoVolume = function(val) {
    if (typeof window.setQaafPlayerVolume === "function") {
      window.setQaafPlayerVolume(val);
    }
    var v = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    var btn = document.getElementById("belowVideoMuteBtn");
    if (btn) btn.innerText = v === 0 ? "🔇" : (v < 50 ? "🔉" : "🔊");
  };

  window.toggleBelowVideoMute = function() {
    if (typeof window.toggleQaafVolumeMute === "function") {
      window.toggleQaafVolumeMute();
    }
    var mainSld = document.getElementById("qaafVolumeRangeSlider");
    var v = mainSld ? parseInt(mainSld.value, 10) : 0;
    var btn = document.getElementById("belowVideoMuteBtn");
    var sld = document.getElementById("belowVideoVolSlider");
    if (btn) btn.innerText = v === 0 ? "🔇" : (v < 50 ? "🔉" : "🔊");
    if (sld) sld.value = v;
  };

  // Update renderWatchPageExtras so it populates the 1-line comment preview & thin metadata
  var origRenderExtras = window.renderWatchPageExtras;
  window.renderWatchPageExtras = function(videoId) {
    buildCleanWatchDetailsLayout();
    if (origRenderExtras) origRenderExtras(videoId);

    var commList = document.getElementById("watchCommentsList");
    var prevTxt = document.getElementById("latestCommentPreviewText");
    var prevAv = document.getElementById("latestCommentAvatar");
    var firstCommentP = commList ? commList.querySelector("p.text-slate-200") : null;
    var firstAuthorP = commList ? commList.querySelector("p.font-bold") : null;

    if (firstCommentP && prevTxt) {
      prevTxt.innerText = firstCommentP.innerText;
    }
    if (firstAuthorP && prevAv) {
      prevAv.innerText = (firstAuthorP.innerText || "A").trim().charAt(0).toUpperCase();
    }
  };

  // Update expandFromMiniPlayer & minimizeToMiniPlayer for clean edge-to-edge 16:9 video with zero stickers
  window.expandFromMiniPlayer = function() {
    buildCleanWatchDetailsLayout();
    var modal = document.getElementById("playerModal");
    var box = document.getElementById("playerModalBox");
    var aspect = document.getElementById("playerAspectBox");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var co = document.getElementById("miniCenterExpandOverlay");
    var miniClose = document.getElementById("qaafMiniPlayerCloseBtn");
    var video = (videosData || []).find(function(v) { return v.id === currentPlayingVideoId; }) || (videosData && videosData[0]);
    var isShort = video && isVideoShort(video);

    if (modal && box && aspect) {
      modal.classList.remove("hidden");
      modal.style.cssText = "position:fixed; inset:0; z-index:999; background:#0f0f0f; display:flex; flex-direction:column; justify-content:flex-start; align-items:center; overflow:hidden; padding:0;";
      if (isShort) {
        box.style.cssText = "width:100%; max-width:420px; height:100%; background:#0f0f0f; display:flex; flex-direction:column; overflow:hidden; transform:none;";
        aspect.style.cssText = "position:relative; width:100%; height:58vh; min-height:300px; max-height:64vh; background:#000; flex-shrink:0; overflow:hidden; display:block; margin:0 auto;";
      } else {
        box.style.cssText = "width:100%; max-width:1024px; height:100%; background:#0f0f0f; display:flex; flex-direction:column; overflow:hidden; transform:none;";
        aspect.style.cssText = "position:relative; width:100%; aspect-ratio:16/9; height:auto; max-height:54vh; background:#000; flex-shrink:0; overflow:hidden; display:block;";
      }
      if (scrollWrap) scrollWrap.classList.remove("hidden");
      if (co) co.classList.add("hidden");
      if (miniClose) miniClose.style.display = "none";
    }
  };

  window.minimizeToMiniPlayer = function() {
    var modal = document.getElementById("playerModal");
    var box = document.getElementById("playerModalBox");
    var aspect = document.getElementById("playerAspectBox");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var co = document.getElementById("miniCenterExpandOverlay");
    var miniClose = document.getElementById("qaafMiniPlayerCloseBtn");

    if (modal && box && aspect) {
      modal.classList.remove("hidden");
      modal.style.cssText = "position:fixed; bottom:3.2rem; right:0.75rem; left:auto; top:auto; width:280px; z-index:999; display:block; background:transparent; pointer-events:auto;";
      box.style.cssText = "width:100%; background:#141414; border-radius:14px; overflow:hidden; border:2px solid rgba(16,185,129,0.75); box-shadow:0 18px 45px rgba(0,0,0,0.92); display:flex; flex-direction:column; transform:none;";
      aspect.style.cssText = "position:relative; width:100%; aspect-ratio:16/9; height:auto; background:#000; flex-shrink:0; overflow:hidden; display:block;";
      if (scrollWrap) scrollWrap.classList.add("hidden");
      if (co) co.classList.remove("hidden");
      if (miniClose) miniClose.style.display = "flex";
    }
    [100, 350].forEach(function(ms) {
      setTimeout(function() {
        if (typeof sendYouTubeCommand === "function") sendYouTubeCommand("playVideo");
      }, ms);
    });
  };

  // Format metadata line in openVideoPlayer to match `@ChannelName • 2.5K views • UR`
  var prevOpen = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    buildCleanWatchDetailsLayout();
    if (prevOpen) prevOpen(videoId);
    var video = (videosData || []).find(function(v) { return v.id === videoId; });
    if (!video) return;
    var handleStr = "@" + (video.channel || "Channel").replace(/\s+/g, "");
    var vwEl = document.getElementById("playingViewsText");
    if (vwEl) {
      vwEl.innerText = handleStr + "  •  " + ((typeof window.formatQaafRealViews === 'function') ? window.formatQaafRealViews(video) : ((video.realViews || 0) + ' views')) + "  •  " + (video.lang || "en").toUpperCase();
    }
    var titleEl = document.getElementById("playingTitle");
    if (titleEl) {
      titleEl.className = "yt-single-line-gradient-title text-[15px] sm:text-base font-bold text-white leading-snug cursor-pointer";
    }
  };
})();

(function initBottomCenterAutoHideVolume() {
  var volHideTimer = null;

  function ensureBottomVolBar() {
    var aspect = document.getElementById("playerAspectBox");
    if (!aspect || document.getElementById("qaafBottomSeekVolBar")) return;

    var curV = parseInt(localStorage.getItem("qaaf_player_volume") || "100", 10);
    var volBar = document.createElement("div");
    volBar.id = "qaafBottomSeekVolBar";
    volBar.dir = "ltr";
    volBar.className = "vol-visible";
    // Positioned at the bottom-center, right below YouTube's red seekbar, between the link icon and YouTube watermark
    volBar.style.cssText = "position:absolute; bottom:6px; left:50%; transform:translateX(-50%); z-index:35; background:rgba(15,15,15,0.82); border:1px solid rgba(255,255,255,0.18); border-radius:9999px; padding:4px 10px; display:flex; align-items:center; gap:6px; backdrop-filter:blur(4px); box-shadow:0 4px 12px rgba(0,0,0,0.6);";

    volBar.innerHTML =
      '<button type="button" id="seekVolMuteBtn" onclick="toggleSeekBottomMute(event)" class="text-white text-xs leading-none select-none">' + (curV === 0 ? '🔇' : '🔊') + '</button>' +
      '<input id="seekVolSlider" type="range" min="0" max="100" value="' + curV + '" oninput="changeSeekBottomVolume(this.value, event)" class="w-20 sm:w-24 h-1 accent-white bg-white/30 rounded-lg cursor-pointer" />' +
      '<span id="seekVolPctText" class="text-[10px] font-bold text-white/90 w-7 text-right">' + curV + '%</span>';

    aspect.appendChild(volBar);
  }

  window.wakeBottomSeekVolume = function(ms) {
    ensureBottomVolBar();
    var bar = document.getElementById("qaafBottomSeekVolBar");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var isMini = scrollWrap && scrollWrap.classList.contains("hidden");
    if (!bar || isMini) {
      if (bar) bar.style.display = "none";
      return;
    }
    bar.style.display = "flex";
    bar.classList.remove("vol-hidden");
    bar.classList.add("vol-visible");

    if (volHideTimer) clearTimeout(volHideTimer);
    volHideTimer = setTimeout(function() {
      bar.classList.remove("vol-visible");
      bar.classList.add("vol-hidden");
    }, ms || 3400);
  };

  window.changeSeekBottomVolume = function(val, ev) {
    if (ev) ev.stopPropagation();
    window.wakeBottomSeekVolume(4000);
    if (typeof window.setQaafPlayerVolume === "function") {
      window.setQaafPlayerVolume(val);
    }
    var v = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    var btn = document.getElementById("seekVolMuteBtn");
    var txt = document.getElementById("seekVolPctText");
    if (btn) btn.innerText = v === 0 ? "🔇" : (v < 50 ? "🔉" : "🔊");
    if (txt) txt.innerText = v + "%";
  };

  window.toggleSeekBottomMute = function(ev) {
    if (ev) ev.stopPropagation();
    window.wakeBottomSeekVolume(4000);
    if (typeof window.toggleQaafVolumeMute === "function") {
      window.toggleQaafVolumeMute();
    }
    var mainSld = document.getElementById("qaafVolumeRangeSlider");
    var v = mainSld ? parseInt(mainSld.value, 10) : 0;
    var btn = document.getElementById("seekVolMuteBtn");
    var sld = document.getElementById("seekVolSlider");
    var txt = document.getElementById("seekVolPctText");
    if (btn) btn.innerText = v === 0 ? "🔇" : (v < 50 ? "🔉" : "🔊");
    if (sld) sld.value = v;
    if (txt) txt.innerText = v + "%";
  };

  // Show when video starts playing
  var prevOpen = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    if (prevOpen) prevOpen(videoId);
    ensureBottomVolBar();
    window.wakeBottomSeekVolume(3800);
  };

  // Hide in Mini-Player, show briefly when expanded
  var prevMin = window.minimizeToMiniPlayer;
  window.minimizeToMiniPlayer = function() {
    if (prevMin) prevMin();
    var bar = document.getElementById("qaafBottomSeekVolBar");
    if (bar) bar.style.display = "none";
  };

  var prevExp = window.expandFromMiniPlayer;
  window.expandFromMiniPlayer = function() {
    if (prevExp) prevExp();
    window.wakeBottomSeekVolume(3500);
  };

  // Wake when user taps/touches the player or iframe
  var pModal = document.getElementById("playerModal");
  if (pModal) {
    pModal.addEventListener("touchstart", function() { window.wakeBottomSeekVolume(3500); }, { passive: true, capture: true });
    pModal.addEventListener("mousemove", function() { window.wakeBottomSeekVolume(3200); }, { passive: true });
    pModal.addEventListener("click", function() { window.wakeBottomSeekVolume(3500); }, { capture: true });
  }

  window.addEventListener("blur", function() {
    var modal = document.getElementById("playerModal");
    if (modal && !modal.classList.contains("hidden")) {
      window.wakeBottomSeekVolume(3500);
    }
    setTimeout(function() {
      if (document.activeElement && document.activeElement.id === "ytIframe") {
        document.activeElement.blur();
      }
    }, 300);
  });

  ensureBottomVolBar();
})();

(function fixSearchAndAllChannelsDropdown() {
  var lastPopupToggleTime = 0;

  // 1. Make sure clicking "All Channels" (#ui_catAll) ALWAYS opens the dropdown instantly without self-closing!
  window.toggleAllChannelsDropdownPopup = function(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    lastPopupToggleTime = Date.now();

    var pop = document.getElementById("allChannelsDropdownPopup");
    var allBtn = document.getElementById("ui_catAll");
    if (!pop) return;

    if (!pop.classList.contains("hidden")) {
      pop.classList.add("hidden");
      return;
    }

    // Position the dropdown right below the "All Channels" button
    if (allBtn) {
      var rect = allBtn.getBoundingClientRect();
      pop.style.top = Math.max(56, Math.round(rect.bottom + 6)) + "px";
      pop.style.left = Math.max(8, Math.round(rect.left)) + "px";
    }

    var blockedSet = new Set(blockedVideoIds || []);
    var bannedSet = new Set(bannedChannels || []);
    var verChSet = new Set(window.verifiedChannelsList || []);
    var countsMap = new Map();
    var chVerMap = new Map();

    (videosData || []).forEach(function(v) {
      if (!v || !v.channel || blockedSet.has(v.id) || bannedSet.has(v.channel)) return;
      if (isKidsLocked && !v.kidsSafe) return;
      countsMap.set(v.channel, (countsMap.get(v.channel) || 0) + 1);
      if (verChSet.has(v.channel) || v.channelVerified) chVerMap.set(v.channel, true);
    });

    var greenChs = [];
    var yellowChs = [];
    countsMap.forEach(function(cnt, ch) {
      if (chVerMap.get(ch)) greenChs.push({ name: ch, count: cnt });
      else yellowChs.push({ name: ch, count: cnt });
    });

    var isAll = (window.qaafSelectedChannel === "ALL");
    var html = '<button type="button" onclick="pickChannelFromTopBar(\'ALL\', event)" class="w-full text-left px-3 py-2 rounded-xl font-extrabold flex items-center justify-between transition ' + (isAll ? 'bg-emerald-500 text-black shadow' : 'bg-slate-800 hover:bg-slate-700 text-white') + '"><span>📺 All Channels (Show All)</span><span>' + (videosData ? videosData.length : 0) + '</span></button>';

    if (greenChs.length > 0) {
      html += '<p class="px-2 pt-1.5 text-[10px] font-extrabold text-emerald-400">🟢 Verified Channels (' + greenChs.length + ')</p>';
      greenChs.forEach(function(item) {
        var sCh = item.name.replace(/'/g, "\\'");
        var act = (window.qaafSelectedChannel === item.name);
        html += '<button type="button" onclick="pickChannelFromTopBar(\'' + sCh + '\', event)" class="w-full text-left px-2.5 py-1.5 rounded-xl font-bold flex items-center justify-between border transition ' + (act ? 'bg-emerald-500 text-black border-emerald-300 font-extrabold' : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-200 border-emerald-500/30') + '"><span class="truncate pr-2">✓ ' + item.name + '</span><span class="text-[10px] opacity-80">(' + item.count + ')</span></button>';
      });
    }

    if (yellowChs.length > 0) {
      html += '<p class="px-2 pt-1.5 text-[10px] font-extrabold text-amber-400">🟡 Selected Video Channels (' + yellowChs.length + ')</p>';
      yellowChs.forEach(function(item) {
        var sCh = item.name.replace(/'/g, "\\'");
        var act = (window.qaafSelectedChannel === item.name);
        html += '<button type="button" onclick="pickChannelFromTopBar(\'' + sCh + '\', event)" class="w-full text-left px-2.5 py-1.5 rounded-xl font-bold flex items-center justify-between border transition ' + (act ? 'bg-amber-400 text-black border-amber-200 font-extrabold' : 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 border-amber-500/30') + '"><span class="truncate pr-2">' + item.name + '</span><span class="text-[10px] opacity-80">(' + item.count + ')</span></button>';
      });
    }

    pop.innerHTML = html;
    pop.classList.remove("hidden");
  };

  // Bind #ui_catAll directly with event object so it never fails to pass event
  var allBtnEl = document.getElementById("ui_catAll");
  if (allBtnEl) {
    allBtnEl.removeAttribute("onclick");
    allBtnEl.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      currentCategory = "all";
      document.querySelectorAll("#categoryBar .cat-chip").forEach(function(btn) {
        var isAct = (btn.id === "ui_catAll");
        btn.className = "cat-chip " + (btn.classList.contains("family-only-chip") ? "family-only-chip " : "") + (isAct ? "bg-emerald-500 text-black px-3 py-1 rounded-lg text-xs font-extrabold shrink-0 shadow flex items-center gap-1.5" : "bg-[#272727] hover:bg-[#3f3f3f] text-white px-3 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5") + (isKidsLocked && btn.classList.contains("family-only-chip") ? " hidden" : "");
      });
      window.toggleAllChannelsDropdownPopup(e);
    };
  }

  document.addEventListener("click", function(e) {
    if (Date.now() - lastPopupToggleTime < 250) return;
    var pop = document.getElementById("allChannelsDropdownPopup");
    var allBtn = document.getElementById("ui_catAll");
    if (pop && !pop.classList.contains("hidden")) {
      if ((allBtn && allBtn.contains(e.target)) || pop.contains(e.target)) return;
      pop.classList.add("hidden");
    }
  });

  // 2. FIX SEARCH BAR TYPING, DROPDOWN CLICKS & SEARCH BUTTON
  window.selectChannelFromSearch = function(chName) {
    var drop = document.getElementById("qaafLiveSearchDropdown");
    if (drop) drop.classList.add("hidden");
    var sInput = document.getElementById("qaafSearchInput");
    var sClear = document.getElementById("qaafSearchClearBtn");
    if (sInput) sInput.value = "";
    if (sClear) sClear.classList.add("hidden");
    window.qaafActiveSearchQuery = "";
    window.qaafSelectedChannel = chName || "ALL";
    currentCategory = "all";
    window.qaafGridPageLimit = 24;
    window.renderVideosNow();
  };

  window.playVideoFromSearchDropdown = function(vidId) {
    var drop = document.getElementById("qaafLiveSearchDropdown");
    if (drop) drop.classList.add("hidden");
    openVideoPlayer(vidId);
  };

  function renderFastSearchDropdown(rawQuery) {
    var drop = document.getElementById("qaafLiveSearchDropdown");
    if (!drop) return;
    var q = (rawQuery || "").trim();
    if (!q) {
      drop.classList.add("hidden");
      return;
    }

    var qLower = q.toLowerCase();
    var tokens = qLower.split(/\s+/).filter(Boolean);
    var blockedSet = new Set(blockedVideoIds || []);
    var bannedSet = new Set(bannedChannels || []);

    var matchedVids = [];
    var matchedChSet = new Set();

    var list = videosData || [];
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (!v || blockedSet.has(v.id) || bannedSet.has(v.channel)) continue;
      if (isKidsLocked && !v.kidsSafe) continue;

      var chLow = (v.channel || "").toLowerCase();
      if (chLow.indexOf(qLower) !== -1) matchedChSet.add(v.channel);

      var hay = ((v.title || "") + " " + chLow + " " + (v.category || "")).toLowerCase();
      var ok = true;
      for (var t = 0; t < tokens.length; t++) {
        if (hay.indexOf(tokens[t]) === -1) { ok = false; break; }
      }
      if (ok && matchedVids.length < 8) {
        matchedVids.push(v);
      }
    }

    var matchedChs = Array.from(matchedChSet).slice(0, 5);
    var html = "";

    if (matchedChs.length > 0) {
      html += '<div class="px-3 py-1.5 bg-slate-900/95 text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">📺 Matching Channels (Tap to Open)</div>';
      matchedChs.forEach(function(ch) {
        var safeCh = ch.replace(/'/g, "\\'");
        html += '<button type="button" onmousedown="selectChannelFromSearch(\'' + safeCh + '\')" onclick="selectChannelFromSearch(\'' + safeCh + '\')" class="w-full px-3.5 py-2.5 text-left hover:bg-emerald-950/60 flex items-center justify-between text-xs text-white border-b border-slate-800/80 cursor-pointer transition">' +
          '<span class="font-bold flex items-center gap-2"><span>✅</span> <span>' + ch + '</span></span>' +
          '<span class="text-[10px] bg-emerald-500 text-black px-2 py-0.5 rounded-full font-extrabold">Open Channel ➔</span>' +
        '</button>';
      });
    }

    if (matchedVids.length > 0) {
      html += '<div class="px-3 py-1.5 bg-slate-900/95 text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">🎬 Matching Videos (Tap to Play)</div>';
      matchedVids.forEach(function(v) {
        var thumb = v.customThumb || ("https://i.ytimg.com/vi/" + v.ytId + "/mqdefault.jpg");
        html += '<button type="button" onmousedown="playVideoFromSearchDropdown(\'' + v.id + '\')" onclick="playVideoFromSearchDropdown(\'' + v.id + '\')" class="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2.5 border-b border-slate-800/80 cursor-pointer transition">' +
          '<img src="' + thumb + '" alt="" class="w-12 h-7 object-cover rounded border border-white/10 shrink-0" onerror="this.style.display=\'none\'" />' +
          '<div class="min-w-0 flex-1">' +
            '<p class="text-xs font-bold text-white truncate">' + v.title + '</p>' +
            '<p class="text-[10px] text-slate-400 truncate">✅ ' + v.channel + '</p>' +
          '</div>' +
          '<span class="bg-red-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-extrabold shrink-0">▶ Play</span>' +
        '</button>';
      });
    }

    if (matchedChs.length === 0 && matchedVids.length === 0) {
      html = '<div class="p-4 text-center text-xs text-slate-400">No videos or channels matched "<strong>' + q + '</strong>".</div>';
    }

    drop.innerHTML = html;
    drop.classList.remove("hidden");
  }

  // Replace #qaafSearchInput and #qaafSearchSubmitBtn listeners cleanly
  var sInput = document.getElementById("qaafSearchInput");
  var sBtn = document.getElementById("qaafSearchSubmitBtn");
  var sClear = document.getElementById("qaafSearchClearBtn");

  if (sInput) {
    var cleanInput = sInput.cloneNode(true);
    sInput.parentNode.replaceChild(cleanInput, sInput);
    cleanInput.removeAttribute("readonly");

    cleanInput.addEventListener("input", function() {
      var val = this.value || "";
      window.qaafActiveSearchQuery = val;
      window.qaafGridPageLimit = 24;
      if (sClear) sClear.classList.toggle("hidden", !val.trim());
      renderFastSearchDropdown(val);
      window.renderVideos();
    });

    cleanInput.addEventListener("focus", function() {
      this.removeAttribute("readonly");
      if (this.value && this.value.trim()) renderFastSearchDropdown(this.value);
    });

    cleanInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var drop = document.getElementById("qaafLiveSearchDropdown");
        if (drop) drop.classList.add("hidden");
        window.qaafActiveSearchQuery = this.value || "";
        window.qaafGridPageLimit = 24;
        window.renderVideosNow();
      }
    });
  }

  if (sBtn) {
    var cleanBtn = sBtn.cloneNode(true);
    sBtn.parentNode.replaceChild(cleanBtn, sBtn);
    cleanBtn.onclick = function(e) {
      e.preventDefault();
      var drop = document.getElementById("qaafLiveSearchDropdown");
      if (drop) drop.classList.add("hidden");
      var inp = document.getElementById("qaafSearchInput");
      window.qaafActiveSearchQuery = inp ? inp.value : "";
      window.qaafGridPageLimit = 24;
      window.renderVideosNow();
    };
  }

  // 3. CLEAN URL HASH ROUTING (#admin, #settings, #games) IN BROWSER ADDRESS BAR
  var prevOpenAdm = window.openAdminModal;
  window.openAdminModal = function() {
    if (prevOpenAdm) prevOpenAdm();
    try { history.replaceState(null, "", "#admin"); } catch (e) {}
  };
  var prevCloseAdm = window.closeAdminModal;
  window.closeAdminModal = function() {
    if (prevCloseAdm) prevCloseAdm();
    try { history.replaceState(null, "", window.location.pathname); } catch (e) {}
  };

  var prevOpenParent = window.openParentalGate;
  window.openParentalGate = function(purpose) {
    if (prevOpenParent) prevOpenParent(purpose);
    if (purpose === "settings") {
      try { history.replaceState(null, "", "#settings"); } catch (e) {}
    }
  };
  var prevCloseParent = window.closeParentModal;
  window.closeParentModal = function() {
    if (prevCloseParent) prevCloseParent();
    try { history.replaceState(null, "", window.location.pathname); } catch (e) {}
  };
})();

// Legacy games hub removed; handled cleanly by qaaf-users-auth.js v27.0
// QAAF V12.2 ICON-ONLY MINIMIZE ARROW, SMOOTH CLEAN MINI-PLAYER & DIRECT qaaf-games.html CONNECTION
(function initCleanMinimizeAndGamesConnection() {
  // Remove min-h-[260px] so 16:9 video has zero top/bottom black bars on mobile
  var pAspect = document.getElementById("playerAspectBox");
  if (pAspect) {
    pAspect.classList.remove("min-h-[260px]", "sm:min-h-[380px]");
  }

  // Replace the text "Mini" and "Close" buttons with clean icon-only circular buttons (Down Arrow & X)
  function upgradeMinimizeAndCloseIcons() {
    var hdr = document.getElementById("ytCleanWatchHeader");
    if (!hdr) return;
    var minBtn = hdr.querySelector('button[onclick*="minimizeToMiniPlayer"]');
    var clsBtn = hdr.querySelector('button[onclick*="closeVideoPlayer"]');
    if (minBtn) {
      minBtn.className = "w-8 h-8 rounded-full bg-[#272727] hover:bg-[#3a3a3a] text-white flex items-center justify-center shadow transition shrink-0";
      minBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6" d="M19 9l-7 7-7-7"></path></svg>';
      minBtn.title = "Minimize";
    }
    if (clsBtn) {
      clsBtn.className = "w-8 h-8 rounded-full bg-[#272727] hover:bg-rose-600 text-white flex items-center justify-center text-xs font-extrabold shadow transition shrink-0";
      clsBtn.innerHTML = "✕";
      clsBtn.title = "Close";
    }
  }

  // Create a clean bottom control strip for the Mini-Player so the video picture itself is 100% unobstructed
  function ensureMiniPlayerBottomBar() {
    var box = document.getElementById("playerModalBox");
    if (!box || document.getElementById("qaafCleanMiniBar")) return;

    var bar = document.createElement("div");
    bar.id = "qaafCleanMiniBar";
    bar.dir = "ltr";
    bar.style.cssText = "display:none; align-items:center; justify-content:space-between; gap:8px; padding:6px 10px; background:#181818; border-top:1px solid rgba(255,255,255,0.1); cursor:pointer;";
    bar.onclick = function() { window.expandFromMiniPlayer(); };

    bar.innerHTML =
      '<p id="qaafCleanMiniTitle" class="text-[11px] font-bold text-white truncate flex-1">Playing Video...</p>' +
      '<div class="flex items-center gap-1.5 shrink-0">' +
        '<button type="button" onclick="event.stopPropagation(); expandFromMiniPlayer();" class="w-7 h-7 rounded-full bg-white/10 hover:bg-emerald-600 text-white flex items-center justify-center" title="Expand">' +
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6" d="M5 15l7-7 7 7"></path></svg>' +
        '</button>' +
        '<button type="button" onclick="event.stopPropagation(); closeVideoPlayer();" class="w-7 h-7 rounded-full bg-white/10 hover:bg-rose-600 text-white flex items-center justify-center text-xs font-extrabold" title="Close">' +
          '✕' +
        '</button>' +
      '</div>';

    box.appendChild(bar);
  }

  window.expandFromMiniPlayer = function() {
    upgradeMinimizeAndCloseIcons();
    ensureMiniPlayerBottomBar();
    var modal = document.getElementById("playerModal");
    var box = document.getElementById("playerModalBox");
    var aspect = document.getElementById("playerAspectBox");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var co = document.getElementById("miniCenterExpandOverlay");
    var miniClose = document.getElementById("qaafMiniPlayerCloseBtn");
    var miniBar = document.getElementById("qaafCleanMiniBar");
    var video = (videosData || []).find(function(v) { return v.id === currentPlayingVideoId; }) || (videosData && videosData[0]);
    var isShort = video && isVideoShort(video);

    if (modal && box && aspect) {
      modal.classList.remove("hidden");
      modal.style.cssText = "position:fixed; inset:0; z-index:999; background:#0f0f0f; display:flex; flex-direction:column; justify-content:flex-start; align-items:center; overflow:hidden; padding:0;";
      if (isShort) {
        box.style.cssText = "width:100%; max-width:420px; height:100%; background:#0f0f0f; display:flex; flex-direction:column; overflow:hidden; transition:all 0.24s ease;";
        aspect.style.cssText = "position:relative; width:100%; height:58vh; min-height:300px; max-height:64vh; background:#000; flex-shrink:0; overflow:hidden; display:block; margin:0 auto;";
      } else {
        box.style.cssText = "width:100%; max-width:1024px; height:100%; background:#0f0f0f; display:flex; flex-direction:column; overflow:hidden; transition:all 0.24s ease;";
        aspect.style.cssText = "position:relative; width:100%; aspect-ratio:16/9; height:auto; min-height:0px !important; max-height:55vh; background:#000; flex-shrink:0; overflow:hidden; display:block; margin:0;";
      }
      if (scrollWrap) {
        scrollWrap.classList.remove("hidden");
        scrollWrap.style.opacity = "1";
      }
      if (co) co.classList.add("hidden");
      if (miniClose) miniClose.style.display = "none";
      if (miniBar) miniBar.style.display = "none";
    }
  };

  window.minimizeToMiniPlayer = function() {
    ensureMiniPlayerBottomBar();
    var modal = document.getElementById("playerModal");
    var box = document.getElementById("playerModalBox");
    var aspect = document.getElementById("playerAspectBox");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var co = document.getElementById("miniCenterExpandOverlay");
    var miniClose = document.getElementById("qaafMiniPlayerCloseBtn");
    var miniBar = document.getElementById("qaafCleanMiniBar");
    var miniTitle = document.getElementById("qaafCleanMiniTitle");
    var volBar = document.getElementById("qaafBottomSeekVolBar");
    var video = (videosData || []).find(function(v) { return v.id === currentPlayingVideoId; });

    if (modal && box && aspect) {
      modal.classList.remove("hidden");
      modal.style.cssText = "position:fixed; bottom:3.1rem; right:0.6rem; left:auto; top:auto; width:260px; z-index:999; display:block; background:transparent; pointer-events:auto;";
      box.style.cssText = "width:100%; background:#181818; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.18); box-shadow:0 16px 40px rgba(0,0,0,0.9); display:flex; flex-direction:column; transition:all 0.24s ease;";
      aspect.style.cssText = "position:relative; width:100%; aspect-ratio:16/9; height:auto; min-height:0px !important; background:#000; flex-shrink:0; overflow:hidden; display:block;";
      if (scrollWrap) scrollWrap.classList.add("hidden");
      if (co) co.classList.add("hidden"); // Keep video face 100% clear!
      if (miniClose) miniClose.style.display = "none";
      if (volBar) volBar.style.display = "none";
      if (miniTitle) miniTitle.innerText = video ? video.title : "Playing...";
      if (miniBar) miniBar.style.display = "flex";
    }
    [100, 350].forEach(function(ms) {
      setTimeout(function() {
        if (typeof sendYouTubeCommand === "function") sendYouTubeCommand("playVideo");
      }, ms);
    });
  };

  // Connect qaaf-games.html directly when playing any game in Category 1 (qaaf_simple)
  window.openAndPlayGame = function(gameId) {
    var g = gamesData.find(function(x) { return x.id === gameId; });
    if (!g || !g.installed || g.blockedByParent) {
      installGameByChild(gameId);
      return;
    }

    var targetFile = g.externalFile || "./qaaf-games.html";
    // For Category 1 (qaaf_simple), qaaf-games.html is in the main folder, so open it directly in the full-screen game frame!
    if ((g.category || "qaaf_simple") === "qaaf_simple") {
      var gm = document.getElementById("qaafStandaloneGamesModal");
      var ifr = document.getElementById("qaafStandaloneGameIframe");
      if (gm && ifr) {
        document.getElementById("extGameHeaderIcon").innerText = g.icon;
        document.getElementById("extGameHeaderTitle").innerText = g.title;
        document.getElementById("extGameStarsCount").innerText = gameStars;
        var proFlag = isSupporterPro ? "1" : "0";
        ifr.src = targetFile + "?game=" + encodeURIComponent(g.slug) + "&id=" + encodeURIComponent(g.id) + "&lang=" + encodeURIComponent(preferredContentLang || "en") + "&pro=" + proFlag + "&stars=" + gameStars;
        gm.classList.remove("hidden");
        return;
      }
    }

    launchMiniGame(gameId.indexOf("qg") === 0 ? "g1" : (gameId.indexOf("3dg") === 0 ? "g3" : gameId));
  };

  upgradeMinimizeAndCloseIcons();
  ensureMiniPlayerBottomBar();
})();



// QAAF V12.3 1.8s AUTO-HIDE CLOSE CROSS (NEXT TO SETTINGS GEAR), SMOOTH MINIMIZE & ANTI-RELOAD LOCK
(function initFastAutoHideCloseAndMinimize() {
  var hudTimer = null;

  // Lock browser Pull-to-Refresh whenever playerModal is open so dragging down NEVER reloads the page!
  setInterval(function() {
    var modal = document.getElementById("playerModal");
    var isPlayerOpen = modal && !modal.classList.contains("hidden");
    if (isPlayerOpen || isKidsLocked) {
      document.documentElement.style.overscrollBehaviorY = "none";
      document.body.style.overscrollBehaviorY = "none";
    } else {
      document.documentElement.style.overscrollBehaviorY = "auto";
      document.body.style.overscrollBehaviorY = "auto";
    }
  }, 300);

  function ensureTopRightQuickActions() {
    var aspect = document.getElementById("playerAspectBox");
    if (!aspect || document.getElementById("qaafQuickTopRightBox")) return;

    // Placed at top-right (right side of YouTube's Settings gear) & top-left (Minimize arrow)
    var topRight = document.createElement("div");
    topRight.id = "qaafQuickTopRightBox";
    topRight.dir = "ltr";
    topRight.style.cssText = "position:absolute; top:10px; right:4px; z-index:38; display:flex; align-items:center; gap:4px; opacity:0; pointer-events:none; transition:opacity 0.2s ease;";

    topRight.innerHTML =
      '<button type="button" onclick="event.stopPropagation(); minimizeToMiniPlayer();" class="w-7 h-7 rounded-full bg-black/75 hover:bg-neutral-800 border border-white/25 text-white flex items-center justify-center shadow-lg active:scale-90 transition" title="Minimize">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.8" d="M19 9l-7 7-7-7"></path></svg>' +
      '</button>' +
      '<button type="button" onclick="event.stopPropagation(); closeVideoPlayer();" class="w-7 h-7 rounded-full bg-red-600/90 hover:bg-red-500 border border-white/30 text-white flex items-center justify-center text-xs font-extrabold shadow-lg active:scale-90 transition" title="Close Video">' +
        '✕' +
      '</button>';

    aspect.appendChild(topRight);
  }

  window.wakeAllVideoControls1800 = function() {
    ensureTopRightQuickActions();
    var topRight = document.getElementById("qaafQuickTopRightBox");
    var volBar = document.getElementById("qaafBottomSeekVolBar");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var isMini = scrollWrap && scrollWrap.classList.contains("hidden");

    if (isMini) {
      if (topRight) topRight.style.display = "none";
      if (volBar) volBar.style.display = "none";
      return;
    }

    if (topRight) {
      topRight.style.display = "flex";
      topRight.style.opacity = "1";
      topRight.style.pointerEvents = "auto";
    }
    if (volBar) {
      volBar.style.display = "flex";
      volBar.style.opacity = "1";
      volBar.style.pointerEvents = "auto";
    }

    if (hudTimer) clearTimeout(hudTimer);
    // Auto-hide in 1.8 seconds (1800ms) as requested!
    hudTimer = setTimeout(function() {
      if (topRight) {
        topRight.style.opacity = "0";
        topRight.style.pointerEvents = "none";
      }
      if (volBar) {
        volBar.style.opacity = "0";
        volBar.style.pointerEvents = "none";
      }
    }, 1800);
  };

  // Override wakeBottomSeekVolume to use the unified 1.8s timer
  window.wakeBottomSeekVolume = window.wakeAllVideoControls1800;

  var aspectBox = document.getElementById("playerAspectBox");
  if (aspectBox) {
    aspectBox.addEventListener("touchstart", function() { window.wakeAllVideoControls1800(); }, { passive: true, capture: true });
    aspectBox.addEventListener("click", function() { window.wakeAllVideoControls1800(); }, { capture: true });
  }

  window.addEventListener("blur", function() {
    var modal = document.getElementById("playerModal");
    if (modal && !modal.classList.contains("hidden")) {
      window.wakeAllVideoControls1800();
      setTimeout(function() {
        try { window.focus(); } catch (e) {}
      }, 350);
    }
  });

  // Smooth pull-down on the title / info header area below the video to minimize without reloading
  var pullStartY = 0;
  var pullCurY = 0;
  var isPullingDown = false;

  var scrollCont = document.getElementById("ytWatchScrollContainer");
  if (scrollCont) {
    scrollCont.addEventListener("touchstart", function(e) {
      if (scrollCont.scrollTop > 2 || !e.touches || e.touches.length !== 1) return;
      pullStartY = e.touches[0].clientY;
      pullCurY = pullStartY;
      isPullingDown = true;
    }, { passive: true });

    scrollCont.addEventListener("touchmove", function(e) {
      if (!isPullingDown || !e.touches || e.touches.length !== 1) return;
      pullCurY = e.touches[0].clientY;
      var dy = pullCurY - pullStartY;
      var box = document.getElementById("playerModalBox");
      if (dy > 10 && scrollCont.scrollTop <= 0 && box) {
        box.style.transform = "translateY(" + Math.min(dy * 0.6, 150) + "px)";
      }
    }, { passive: true });

    scrollCont.addEventListener("touchend", function() {
      if (!isPullingDown) return;
      isPullingDown = false;
      var dy = pullCurY - pullStartY;
      var box = document.getElementById("playerModalBox");
      if (box) box.style.transform = "";
      if (dy > 50 && scrollCont.scrollTop <= 0) {
        window.minimizeToMiniPlayer();
      }
      pullStartY = 0;
      pullCurY = 0;
    }, { passive: true });
  }

  ensureTopRightQuickActions();
})();



// QAAF V12.4 LOGO HOME BUTTON, TOP-LEFT MINIMAL RED X (NO CIRCLE), TRANSPARENT RED VOLUME BAR & YOUTUBE DRAG-TO-MINIMIZE
(function initSmartRedYoutubeHudAndLogoHome() {
  var hudFadeTimer = null;

  // 1. MAKE HEADER LOGO & BRAND TEXT WORK 100% AS HOME BUTTON
  function bindHeaderLogoHomeButton() {
    var headerLeft = document.querySelector("#mainHeader > div:first-child");
    if (!headerLeft) return;
    var logoChildren = headerLeft.querySelectorAll("svg, div.font-extrabold, #brandMainPrefix, #brandSuffix");
    logoChildren.forEach(function(el) {
      el.style.cursor = "pointer";
      el.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.isKidsTimeExpiredLock) return;
        if (isKidsLocked) {
          openParentalGate("unlock");
          return;
        }
        // Reset everything to Home immediately and scroll to top
        if (typeof closeVideoPlayer === "function") closeVideoPlayer();
        if (typeof closeQaafProfileDrawer === "function") closeQaafProfileDrawer();
        window.qaafSelectedChannel = "ALL";
        window.qaafActiveSearchQuery = "";
        currentCategory = "all";
        currentSortFilter = "default";
        window.qaafGridPageLimit = 24;
        var sInp = document.getElementById("qaafSearchInput");
        if (sInp) sInp.value = "";
        var sClr = document.getElementById("qaafSearchClearBtn");
        if (sClr) sClr.classList.add("hidden");
        var pop = document.getElementById("allChannelsDropdownPopup");
        if (pop) pop.classList.add("hidden");
        document.querySelectorAll("#categoryBar .cat-chip").forEach(function(btn) {
          var isAll = (btn.id === "ui_catAll");
          btn.className = "cat-chip " + (btn.classList.contains("family-only-chip") ? "family-only-chip " : "") + (isAll ? "bg-emerald-500 text-black px-3 py-1 rounded-lg text-xs font-extrabold shrink-0 shadow flex items-center gap-1.5" : "bg-[#272727] hover:bg-[#3f3f3f] text-white px-3 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5");
        });
        if (typeof window.renderVideosNow === "function") window.renderVideosNow();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    });
  }
  bindHeaderLogoHomeButton();

  // 2. REMOVE TOP-RIGHT OVERLAY & METADATA ROW ARROW/CLOSE BUTTONS
  var oldTopRight = document.getElementById("qaafQuickTopRightBox");
  if (oldTopRight) oldTopRight.remove();

  function removeMetadataRowButtons() {
    var hdr = document.getElementById("ytCleanWatchHeader");
    if (!hdr) return;
    var minBtn = hdr.querySelector('button[onclick*="minimizeToMiniPlayer"]');
    var clsBtn = hdr.querySelector('button[onclick*="closeVideoPlayer"]');
    if (minBtn) minBtn.remove();
    if (clsBtn) clsBtn.remove();
  }
  removeMetadataRowButtons();

  // 3. CREATE TOP-LEFT MINIMAL RED CROSS (NO CIRCLE, NO BACKGROUND) & TRANSPARENT RED VOLUME BAR
  function setupMinimalRedControls() {
    var aspect = document.getElementById("playerAspectBox");
    if (!aspect) return;

    var oldTR = document.getElementById("qaafQuickTopRightBox");
    if (oldTR) oldTR.remove();

    // Top-Left Minimal Red X (No circle, no background fill, just sleek red X)
    var topLeftX = document.getElementById("qaafMinimalTopLeftClose");
    if (!topLeftX) {
      topLeftX = document.createElement("button");
      topLeftX.id = "qaafMinimalTopLeftClose";
      topLeftX.type = "button";
      topLeftX.title = "Close Video";
      topLeftX.style.cssText = "position:absolute; top:8px; left:10px; z-index:38; background:transparent !important; border:none !important; box-shadow:none !important; color:#ff1e38; font-size:22px; font-weight:800; line-height:1; padding:4px 8px; cursor:pointer; opacity:0; pointer-events:none; transition:opacity 0.2s ease, transform 0.15s ease; filter:drop-shadow(0 1px 3px rgba(0,0,0,0.85));";
      topLeftX.innerHTML = "✕";
      topLeftX.onclick = function(e) {
        e.stopPropagation();
        closeVideoPlayer();
      };
      aspect.appendChild(topLeftX);
    }

    // Restyle Bottom Volume Bar to 100% Transparent Background, Thin Red Slider Bar & Red % Text
    var volBar = document.getElementById("qaafBottomSeekVolBar");
    if (volBar) {
      volBar.style.cssText = "position:absolute; bottom:4px; left:50%; transform:translateX(-50%); z-index:35; background:transparent !important; border:none !important; box-shadow:none !important; backdrop-filter:none !important; padding:2px 6px; display:flex; align-items:center; gap:6px; opacity:0; pointer-events:none; transition:opacity 0.2s ease;";
      var curV = parseInt(localStorage.getItem("qaaf_player_volume") || "100", 10);
      volBar.innerHTML =
        '<button type="button" id="seekVolMuteBtn" onclick="toggleSeekBottomMute(event)" style="color:#ff1e38; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.9));" class="text-xs font-extrabold leading-none select-none">' + (curV === 0 ? '🔇' : '🔊') + '</button>' +
        '<input id="seekVolSlider" type="range" min="0" max="100" value="' + curV + '" oninput="changeSeekBottomVolume(this.value, event)" style="accent-color:#ff1e38; height:3px; background:rgba(255,30,56,0.35);" class="w-24 sm:w-28 rounded-lg cursor-pointer" />' +
        '<span id="seekVolPctText" style="color:#ff1e38; text-shadow:0 1px 3px rgba(0,0,0,0.95);" class="text-[11px] font-extrabold w-8 text-left">' + curV + '%</span>';
    }
  }

  window.wakeMinimalRedControls1500 = function() {
    setupMinimalRedControls();
    removeMetadataRowButtons();
    var topLeftX = document.getElementById("qaafMinimalTopLeftClose");
    var volBar = document.getElementById("qaafBottomSeekVolBar");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var isMini = scrollWrap && scrollWrap.classList.contains("hidden");

    if (isMini) {
      if (topLeftX) topLeftX.style.display = "none";
      if (volBar) volBar.style.display = "none";
      return;
    }

    if (topLeftX) {
      topLeftX.style.display = "block";
      topLeftX.style.opacity = "1";
      topLeftX.style.pointerEvents = "auto";
    }
    if (volBar) {
      volBar.style.display = "flex";
      volBar.style.opacity = "1";
      volBar.style.pointerEvents = "auto";
    }

    if (hudFadeTimer) clearTimeout(hudFadeTimer);
    // Auto-hide quickly in 1.5 seconds (1500ms) as requested!
    hudFadeTimer = setTimeout(function() {
      if (topLeftX) {
        topLeftX.style.opacity = "0";
        topLeftX.style.pointerEvents = "none";
      }
      if (volBar) {
        volBar.style.opacity = "0";
        volBar.style.pointerEvents = "none";
      }
    }, 1500);
  };

  window.wakeAllVideoControls1800 = window.wakeMinimalRedControls1500;
  window.wakeBottomSeekVolume = window.wakeMinimalRedControls1500;

  // 4. SMOOTH YOUTUBE-STYLE DRAG-DOWN TO MINIMIZE (FROM TOP STRIP OR INFO AREA)
  function ensureTopDragMinimizeStrip() {
    var aspect = document.getElementById("playerAspectBox");
    if (!aspect || document.getElementById("qaafTopSwipeStrip")) return;
    // Invisible touch strip along the top-center of video so swiping down from top of video works smoothly!
    var strip = document.createElement("div");
    strip.id = "qaafTopSwipeStrip";
    strip.style.cssText = "position:absolute; top:0; left:48px; right:145px; height:44px; z-index:32; background:transparent; touch-action:none;";
    aspect.appendChild(strip);
  }

  var ytDragStartY = 0;
  var ytDragCurY = 0;
  var isYtDragging = false;

  document.addEventListener("touchstart", function(e) {
    var modal = document.getElementById("playerModal");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    if (!modal || modal.classList.contains("hidden") || !scrollWrap || scrollWrap.classList.contains("hidden")) return;
    if (!e.touches || e.touches.length !== 1) return;

    var target = e.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "BUTTON")) return;

    var y = e.touches[0].clientY;
    if (scrollWrap.scrollTop <= 2 && y < 380) {
      ytDragStartY = y;
      ytDragCurY = y;
      isYtDragging = true;
    }
  }, { passive: true });

  document.addEventListener("touchmove", function(e) {
    if (!isYtDragging || !e.touches || !e.touches.length) return;
    ytDragCurY = e.touches[0].clientY;
    var dy = ytDragCurY - ytDragStartY;
    if (dy <= 6) return;

    var modal = document.getElementById("playerModal");
    var box = document.getElementById("playerModalBox");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var progress = Math.min(1, dy / 220);
    var scaleVal = 1 - (progress * 0.24);

    if (modal) modal.style.background = "rgba(0, 0, 0, " + (0.94 - progress * 0.65).toFixed(2) + ")";
    if (scrollWrap) scrollWrap.style.opacity = String(Math.max(0, 1 - progress * 2.4));
    if (box) {
      box.style.transition = "none";
      box.style.transform = "translateY(" + Math.min(dy * 0.85, 260) + "px) scale(" + scaleVal.toFixed(3) + ")";
      box.style.borderRadius = Math.round(progress * 16) + "px";
    }
  }, { passive: true });

  document.addEventListener("touchend", function() {
    if (!isYtDragging) return;
    isYtDragging = false;
    var dy = ytDragCurY - ytDragStartY;
    var modal = document.getElementById("playerModal");
    var box = document.getElementById("playerModalBox");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");

    if (box) box.style.transition = "all 0.22s cubic-bezier(0.22, 1, 0.36, 1)";

    // Even a light 32px downward flick smoothly minimizes the player!
    if (dy > 32) {
      if (scrollWrap) scrollWrap.style.opacity = "1";
      window.minimizeToMiniPlayer();
    } else {
      if (modal) modal.style.background = "#0f0f0f";
      if (scrollWrap) scrollWrap.style.opacity = "1";
      if (box) {
        box.style.transform = "none";
        box.style.borderRadius = "0px";
      }
    }
    ytDragStartY = 0;
    ytDragCurY = 0;
  }, { passive: true });

  var prevOpen = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    if (prevOpen) prevOpen(videoId);
    ensureTopDragMinimizeStrip();
    setupMinimalRedControls();
    removeMetadataRowButtons();
    window.wakeMinimalRedControls1500();
  };

  ensureTopDragMinimizeStrip();
  setupMinimalRedControls();
})();



// QAAF V12.5 GUARANTEED 1.5s VOLUME BAR AUTO-HIDE & DUAL LANGUAGE SYSTEM (DISPLAY LANGUAGE VS PREFERRED CONTENT LANGUAGE)
(function initGuaranteedVolHideAndDualLanguageSystem() {
  var fadeTimer = null;

  // 1. GUARANTEE VOLUME BAR AND RED X HIDE TOGETHER IN 1.5 SECONDS
  window.hideAllPlayerOverlayControlsNow = function() {
    var topLeftX = document.getElementById("qaafMinimalTopLeftClose");
    var volBar = document.getElementById("qaafBottomSeekVolBar");
    if (topLeftX) {
      topLeftX.style.setProperty("opacity", "0", "important");
      topLeftX.style.setProperty("pointer-events", "none", "important");
    }
    if (volBar) {
      volBar.classList.remove("vol-visible");
      volBar.classList.add("vol-hidden");
      volBar.style.setProperty("opacity", "0", "important");
      volBar.style.setProperty("pointer-events", "none", "important");
    }
  };

  window.wakeMinimalRedControls1500 = function() {
    var topLeftX = document.getElementById("qaafMinimalTopLeftClose");
    var volBar = document.getElementById("qaafBottomSeekVolBar");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var isMini = scrollWrap && scrollWrap.classList.contains("hidden");

    if (isMini) {
      window.hideAllPlayerOverlayControlsNow();
      return;
    }

    if (topLeftX) {
      topLeftX.style.display = "block";
      topLeftX.style.setProperty("opacity", "1", "important");
      topLeftX.style.setProperty("pointer-events", "auto", "important");
    }
    if (volBar) {
      volBar.classList.remove("vol-hidden");
      volBar.style.display = "flex";
      volBar.style.setProperty("opacity", "1", "important");
      volBar.style.setProperty("pointer-events", "auto", "important");
    }

    if (fadeTimer) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(function() {
      window.hideAllPlayerOverlayControlsNow();
    }, 1500);
  };

  window.wakeAllVideoControls1800 = window.wakeMinimalRedControls1500;
  window.wakeBottomSeekVolume = window.wakeMinimalRedControls1500;

  // Keep awake while actively dragging the red volume slider, then hide 1.5s after release
  document.addEventListener("input", function(e) {
    if (e.target && e.target.id === "seekVolSlider") {
      window.wakeMinimalRedControls1500();
    }
  });

  // Language system is now managed by qaaf-users-auth.js v14.0
})();
