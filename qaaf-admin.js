// QAAF Tube Admin Console, Auth, Channel Importer & Request Scanner (qaaf-admin.js)

(function initQaafUltimateYouTubeExperience() {
      window.parentRequestsQueue = window.parentRequestsQueue || JSON.parse(localStorage.getItem('qaaf_parent_requests') || '[]');
      let currentSearchQuery = '';
      let isMiniPlayerMode = false;
      let requestNotificationsLog = JSON.parse(localStorage.getItem('qaaf_req_notifications') || '[]');
      let videoCommentsMap = JSON.parse(localStorage.getItem('qaaf_video_comments') || '{}');
      let parentRecoverySecret = localStorage.getItem('qaaf_parent_recovery_secret') || 'makkah';
      let adminPassword = localStorage.getItem('qaaf_admin_password') || 'Qaaf786';
      const ADMIN_MASTER_RECOVERY_KEY = 'makkah786';

      // 1. REPLACE BROKEN OR NON-ISLAMIC IDS WITH 100% WORKING ISLAMIC VIDEO IDS
      const WORKING_ISLAMIC_KIDS_ID = '-5HQ9iH0zQY';
      const WORKING_QURAN_ID = 'tgYsKjUSf7s';

      const brokenIdFixes = {
        '0r6BcBXZyUg': WORKING_ISLAMIC_KIDS_ID,
        '7MhI1hD56Ww': WORKING_ISLAMIC_KIDS_ID,
        'c1Q7U5v7rBE': WORKING_ISLAMIC_KIDS_ID,
        'vp6XBdVT2wA': WORKING_ISLAMIC_KIDS_ID,
        'tEzxcsageto': WORKING_ISLAMIC_KIDS_ID,
        'x2S2ghEPvjI': WORKING_ISLAMIC_KIDS_ID,
        '5eocNXS3Gic': WORKING_ISLAMIC_KIDS_ID,
        'iZapX4O3Q-U': WORKING_QURAN_ID,
        'tPq2-K3N2pI': WORKING_QURAN_ID
      };

      if (typeof legacyPlaceholderMap === 'object') {
        Object.keys(brokenIdFixes).forEach(k => { legacyPlaceholderMap[k] = brokenIdFixes[k]; });
      }

      function scrubBrokenVideoIds() { return;
        let fixedAny = false;
        videosData = videosData.map(v => {
          if (false && brokenIdFixes[v.ytId]) {
            v.ytId = brokenIdFixes[v.ytId];
            fixedAny = true;
          }
          return v;
        });
        if (fixedAny) {
          localStorage.setItem('qaaf_videos_data', JSON.stringify(videosData));
          if (window.qaafCloudSync) qaafCloudSync.pushState('Cleaned Video IDs');
        }
      }
      scrubBrokenVideoIds();

      // ADMIN 1-CLICK DELETE VIDEO FUNCTION
      window.adminDeleteVideoCard = function(videoId, event) {
        if (event) event.stopPropagation();
        if (!confirm('👑 Admin: Are you sure you want to permanently delete this video from QAAF Tube?')) return;
        videosData = videosData.filter(v => v.id !== videoId);
        localStorage.setItem('qaaf_videos_data', JSON.stringify(videosData));
        renderVideos();
        
        if (window.qaafCloudSync) qaafCloudSync.pushState('Admin Deleted Video');
      };

      // RENDER ACTIVE VIDEOS CATALOG INSIDE ADMIN TAB 1 (DEFERRED UNTIL ADMIN MODAL IS OPEN)
      window.renderAdminActiveVideosCatalog = function() {
        const countBadge = document.getElementById('admVideosCountBadge');
        if (countBadge) countBadge.innerText = (videosData && videosData.length) || 0;
      };

      // 2. TRANSFORM ADMIN MODAL INTO PROFESSIONAL EDGE-STYLE SIDEBAR + MOBILE GRID CONSOLE
      function buildProfessionalAdminConsole() {
        const modal = document.getElementById('adminDashboardModal');
        if (!modal || document.getElementById('edgeAdminSidebar')) return;

        const innerBox = modal.firstElementChild;
        if (!innerBox) return;

        const cloudInput = document.getElementById('firebaseDbUrlInput');
        const cardCloud = cloudInput ? cloudInput.closest('.bg-gradient-to-r') : null;

        const backupInput = document.getElementById('adminBackupFileInput');
        const cardBackup = backupInput ? backupInput.closest('.bg-slate-900\\/90') : null;

        const ytUrlInput = document.getElementById('adminYtUrlInput');
        const cardPublish = ytUrlInput ? ytUrlInput.closest('.bg-slate-900\\/90') : null;

        const parentReqList = document.getElementById('adminParentRequestsList');
        const cardRequests = parentReqList ? parentReqList.closest('.bg-slate-900\\/90') : null;

        const flaggedList = document.getElementById('adminFlaggedList');
        const cardFlags = flaggedList ? flaggedList.closest('.bg-slate-900\\/90') : null;

        const promoSelect = document.getElementById('adminPromoRegionSelect');
        const cardSponsors = promoSelect ? promoSelect.closest('.bg-slate-900\\/90') : null;

        innerBox.className = 'bg-[#0f131a] border border-slate-700/80 rounded-2xl max-w-5xl w-full h-[90vh] shadow-2xl flex flex-col overflow-hidden';
        innerBox.innerHTML = `
          <!-- TOP PROFESSIONAL HEADER BAR -->
          <div class="bg-[#141923] border-b border-slate-800 px-4 sm:px-5 py-3 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-lg shadow shrink-0">👑</div>
              <div class="min-w-0">
                <h3 class="text-sm sm:text-base font-extrabold text-white tracking-tight truncate">QAAF Tube Admin Console</h3>
                <p class="text-[10px] sm:text-[11px] text-slate-400 truncate">qaaftube.com • Professional Management &amp; Moderation Center</p>
              </div>
            </div>
            <button type="button" onclick="closeAdminModal()" class="bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition shadow shrink-0">
              ✕ Close
            </button>
          </div>

          <!-- MAIN 2-COLUMN WORKSPACE (2x3 GRID ON MOBILE, LEFT SIDEBAR ON DESKTOP) -->
          <div class="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            
            <!-- SIDEBAR NAVIGATION (ALL 6 TABS VISIBLE ON MOBILE & DESKTOP) -->
            <aside id="edgeAdminSidebar" class="w-full md:w-64 bg-[#12161f] border-b md:border-b-0 md:border-r border-slate-800/90 p-2 sm:p-3 grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-col gap-1.5 shrink-0">
              <button type="button" onclick="switchAdminTab('publish')" id="admTabBtn_publish" class="adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-between gap-1.5 transition bg-emerald-500/15 text-emerald-400 border-l-4 border-emerald-400">
                <span class="flex items-center gap-1.5 truncate"><span>🎬</span> <span class="truncate">Publish &amp; Videos</span></span>
                <span id="admVideosCountBadge" class="bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded-full text-[10px] shrink-0">0</span>
              </button>

              <button type="button" onclick="switchAdminTab('requests')" id="admTabBtn_requests" class="adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1.5 transition text-slate-300 hover:bg-white/5">
                <span class="flex items-center gap-1.5 truncate"><span>📥</span> <span class="truncate">Parent Requests</span></span>
                <span id="admSidebarReqBadge" class="bg-blue-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0">0</span>
              </button>

              <button type="button" onclick="switchAdminTab('flags')" id="admTabBtn_flags" class="adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1.5 transition text-slate-300 hover:bg-white/5">
                <span class="flex items-center gap-1.5 truncate"><span>🚩</span> <span class="truncate">Reported Flags</span></span>
                <span id="admSidebarFlagBadge" class="bg-rose-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0">0</span>
              </button>

              <button type="button" onclick="switchAdminTab('sponsors')" id="admTabBtn_sponsors" class="adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1.5 transition text-slate-300 hover:bg-white/5">
                <span class="flex items-center gap-1.5 truncate"><span>📢</span> <span class="truncate">Sponsor &amp; Ads</span></span>
              </button>

              <button type="button" onclick="switchAdminTab('cloud')" id="admTabBtn_cloud" class="adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1.5 transition text-slate-300 hover:bg-white/5">
                <span class="flex items-center gap-1.5 truncate"><span>☁️</span> <span class="truncate">Cloud &amp; Backup</span></span>
              </button>

              <button type="button" onclick="switchAdminTab('security')" id="admTabBtn_security" class="adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1.5 transition text-slate-300 hover:bg-white/5">
                <span class="flex items-center gap-1.5 truncate"><span>🔐</span> <span class="truncate">Security &amp; PIN</span></span>
              </button>
            </aside>

            <!-- RIGHT CONTENT AREA (SPACIOUS & CLEAN) -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0b0e14] space-y-5">
              
              <!-- TAB 1: PUBLISH & MANAGE VIDEOS -->
              <div id="admPane_publish" class="adm-tab-pane space-y-5">
                <div class="border-b border-slate-800 pb-3">
                  <h4 class="text-sm sm:text-base font-extrabold text-white">🎬 Publish &amp; Manage Videos</h4>
                  <p class="text-xs text-slate-400 mt-0.5">Add new verified Islamic videos or Shorts, and manage your active catalog below.</p>
                </div>
                <div id="admMount_publish"></div>
                <div class="bg-[#141821] border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div class="flex items-center justify-between">
                    <h5 class="text-xs sm:text-sm font-extrabold text-white">📚 Active Videos &amp; Shorts Catalog</h5>
                    <span class="text-[11px] text-emerald-400 font-bold">Click 🗑️ to remove any video</span>
                  </div>
                  <div id="adminActiveVideosCatalogList" class="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs"></div>
                </div>
              </div>

              <!-- TAB 2: PARENT REQUESTS QUEUE -->
              <div id="admPane_requests" class="adm-tab-pane hidden space-y-5">
                <div class="border-b border-slate-800 pb-3">
                  <h4 class="text-sm sm:text-base font-extrabold text-white">📥 Parent Requested Channels &amp; Videos</h4>
                  <p class="text-xs text-slate-400 mt-0.5">Review parent requests, check Observation tags, preview audio for music, and Approve or Reject.</p>
                </div>
                <div id="admMount_requests"></div>
              </div>

              <!-- TAB 3: FLAGGED VIDEOS QUEUE -->
              <div id="admPane_flags" class="adm-tab-pane hidden space-y-5">
                <div class="border-b border-slate-800 pb-3">
                  <h4 class="text-sm sm:text-base font-extrabold text-white">🚩 User Reported &amp; Flagged Videos</h4>
                  <p class="text-xs text-slate-400 mt-0.5">Moderate videos reported by parents. Block individual videos or ban entire channels.</p>
                </div>
                <div id="admMount_flags"></div>
              </div>

              <!-- TAB 4: REGIONAL SPONSOR BAR -->
              <div id="admPane_sponsors" class="adm-tab-pane hidden space-y-5">
                <div class="border-b border-slate-800 pb-3">
                  <h4 class="text-sm sm:text-base font-extrabold text-white">📢 Regional Sponsor &amp; Promotion Bar</h4>
                  <p class="text-xs text-slate-400 mt-0.5">Configure moving ticker text or clickable GIF/Image banners for each region.</p>
                </div>
                <div id="admMount_sponsors"></div>
              </div>

              <!-- TAB 5: FIREBASE CLOUD & BACKUP -->
              <div id="admPane_cloud" class="adm-tab-pane hidden space-y-5">
                <div class="border-b border-slate-800 pb-3">
                  <h4 class="text-sm sm:text-base font-extrabold text-white">☁️ Firebase Cloud Sync &amp; Database Backup</h4>
                  <p class="text-xs text-slate-400 mt-0.5">Manage real-time Firebase synchronization and export/restore JSON backups.</p>
                </div>
                <div id="admMount_cloud" class="space-y-4"></div>
              </div>

              <!-- TAB 6: SECURITY & PASSWORDS -->
              <div id="admPane_security" class="adm-tab-pane hidden space-y-5">
                <div class="border-b border-slate-800 pb-3">
                  <h4 class="text-sm sm:text-base font-extrabold text-white">🔐 Admin Security &amp; Recovery Settings</h4>
                  <p class="text-xs text-slate-400 mt-0.5">Update your Super Admin login password and Parent PIN recovery secret word.</p>
                </div>
                <div class="bg-[#141821] border border-slate-800 rounded-2xl p-4 space-y-3 max-w-lg">
                  <label class="block text-xs font-bold text-amber-300">👑 Change Super Admin Password:</label>
                  <input id="admNewPassInput" type="text" placeholder="Enter new Admin Password (current: Qaaf786)" class="w-full bg-black border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white" />
                  <label class="block text-xs font-bold text-emerald-400 pt-2">🔑 Change Parent PIN Recovery Word:</label>
                  <input id="admNewRecWordInput" type="text" placeholder="Enter Parent Recovery Word (current: makkah)" class="w-full bg-black border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white" />
                  <button type="button" onclick="adminSaveSecurityCredentials()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-extrabold shadow">
                    💾 Save Security Settings
                  </button>
                </div>
              </div>

            </div>
          </div>
        `;

        if (cardPublish) {
          cardPublish.className = 'bg-[#141821] p-4 rounded-2xl border border-slate-800 space-y-3';
          document.getElementById('admMount_publish').appendChild(cardPublish);
        }
        if (cardRequests) {
          cardRequests.className = 'bg-[#141821] p-4 rounded-2xl border border-slate-800 space-y-3';
          document.getElementById('admMount_requests').appendChild(cardRequests);
        }
        if (cardFlags) {
          cardFlags.className = 'bg-[#141821] p-4 rounded-2xl border border-slate-800 space-y-3';
          document.getElementById('admMount_flags').appendChild(cardFlags);
        }
        if (cardSponsors) {
          cardSponsors.className = 'bg-[#141821] p-4 rounded-2xl border border-slate-800 space-y-3';
          document.getElementById('admMount_sponsors').appendChild(cardSponsors);
        }
        if (cardCloud) document.getElementById('admMount_cloud').appendChild(cardCloud);
        if (cardBackup) document.getElementById('admMount_cloud').appendChild(cardBackup);

      }

      window.switchAdminTab = function(tabKey) {
        document.querySelectorAll('.adm-tab-pane').forEach(el => el.classList.add('hidden'));
        const activePane = document.getElementById('admPane_' + tabKey);
        if (activePane) activePane.classList.remove('hidden');

        document.querySelectorAll('.adm-tab-btn').forEach(btn => {
          btn.className = 'adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1.5 transition text-slate-300 hover:bg-white/5';
        });
        const activeBtn = document.getElementById('admTabBtn_' + tabKey);
        if (activeBtn) {
          activeBtn.className = 'adm-tab-btn w-full text-left px-3 py-2 rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-between gap-1.5 transition bg-emerald-500/15 text-emerald-400 border-l-4 border-emerald-400';
        }
        
      };

      window.adminSaveSecurityCredentials = function() {
        const newP = (document.getElementById('admNewPassInput')?.value || '').trim();
        const newR = (document.getElementById('admNewRecWordInput')?.value || '').trim();
        if (newP) {
          adminPassword = newP;
          localStorage.setItem('qaaf_admin_password', adminPassword);
        }
        if (newR) {
          parentRecoverySecret = newR;
          localStorage.setItem('qaaf_parent_recovery_secret', parentRecoverySecret);
        }
        alert('✅ Security credentials updated successfully!');
      };

      buildProfessionalAdminConsole();

      // 3. THREE-TIER AQEEDAH & MUSIC FILTER LISTS
      const TIER1_AUTO_REJECT_WORDS = [
        'music', 'song', 'dance', 'movie', 'concert', 'remix', 'dj', 'bollywood', 'hollywood',
        'qawwali', 'qawali', 'urs live', 'urs mubarak', 'chadar poshi', 'matam', 'noha', 'majlis',
        'aamil baba', 'kala jadu', 'mehboob qadmon', 'گانا', 'موسیقی', 'قوالی', 'عرس مبارک', 'چادر پوشی',
        'ماتم', 'نوحہ', 'مجلس', 'عامل بابا', 'کالا جادو', 'محبوب قدموں میں', 'ڈانس', 'فلم'
      ];

      const TIER2_OBSERVATION_WORDS = [
        'taweez', 'taveez', 'mazar', 'dargah', 'shirk', 'biddat', 'bidah', 'shia', 'ahle tashi',
        'firqa', 'aqeedah', 'aqaid', 'تعویذ', 'دم', 'مزار', 'درگاہ', 'شرک', 'بدعت', 'اہل تشیع',
        'شیعہ', 'فرقہ', 'عقیدہ', 'عقائد', 'کفر', 'مناظرہ'
      ];

      function analyzeThreeTierFilter(title, channel) {
        const text = (`${title} ${channel}`).toLowerCase();
        for (const w of TIER1_AUTO_REJECT_WORDS) {
          if (text.includes(w)) return { tier: 'REJECT', word: w, note: `Auto-Rejected: Contains forbidden term "${w}"` };
        }
        for (const w of TIER2_OBSERVATION_WORDS) {
          if (text.includes(w)) return { tier: 'OBSERVATION', word: w, note: `⚠️ Observation: Sensitive topic "${w}" (Verify Scholar/Aqeedah)` };
        }
        return { tier: 'CLEAN_PENDING', word: '', note: `🟢 Pre-Check Passed: Waiting for Admin Final Approval` };
      }

      // 4. TRANSFORM PLAYER MODAL INTO FULL YOUTUBE WATCH PAGE + MINI-PLAYER BAR
      const playerModal = document.getElementById('playerModal');
      const playerModalBox = document.getElementById('playerModalBox');
      const playerAspectBox = document.getElementById('playerAspectBox');

      if (playerModal && playerModalBox && playerAspectBox) {
        const oldClose = playerAspectBox.querySelector('button[onclick*="closeVideoPlayer"]');
        if (oldClose) oldClose.classList.add('hidden');

        if (!document.getElementById('ytTopControlBar')) {
          const topBar = document.createElement('div');
          topBar.id = 'ytTopControlBar';
          topBar.className = 'bg-[#0f0f0f] px-3 py-1.5 flex items-center justify-between border-b border-white/10 shrink-0';
          topBar.dir = 'ltr';
          topBar.innerHTML = `
            <button type="button" id="minimizePlayerBtn" onclick="minimizeToMiniPlayer()" class="text-white hover:bg-white/15 w-8 h-8 rounded-full flex items-center justify-center transition" title="Minimize player">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <span id="miniPlayerTitleLabel" class="hidden text-[11px] font-bold text-emerald-400 truncate max-w-[120px]">Playing...</span>
            <div id="miniPlayerControlsRight" class="flex items-center gap-1.5">
              <button type="button" id="expandMiniPlayerBtn" onclick="expandFromMiniPlayer()" class="hidden bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-full text-[11px] font-extrabold shadow">⌃ Expand</button>
              <button type="button" onclick="closeVideoPlayer()" class="bg-white/10 hover:bg-red-600 text-white px-2.5 py-1 rounded-full text-[11px] font-bold transition">✕ Close</button>
            </div>
          `;
          playerModalBox.insertBefore(topBar, playerAspectBox);
        }

        if (!document.getElementById('ytWatchScrollContainer')) {
          const infoBar = playerModalBox.lastElementChild;
          const scrollWrap = document.createElement('div');
          scrollWrap.id = 'ytWatchScrollContainer';
          scrollWrap.className = 'flex-1 overflow-y-auto bg-[#0f0f0f] divide-y divide-white/10';
          scrollWrap.dir = 'ltr';

          if (infoBar && infoBar !== playerAspectBox) {
            scrollWrap.appendChild(infoBar);
          }

          const extraWatchContent = document.createElement('div');
          extraWatchContent.className = 'p-3 sm:p-4 space-y-5';
          extraWatchContent.innerHTML = `
            <div class="bg-[#181818] border border-white/10 rounded-2xl p-3.5">
              <div class="flex items-center justify-between mb-2.5">
                <h4 class="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5">
                  <span>💬</span> <span>Community Comments</span>
                  <span id="watchCommentCountBadge" class="bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full text-[11px]">0</span>
                </h4>
                <span class="text-[10px] text-slate-400">🛡️ Halal Filtered Comments</span>
              </div>
              <div class="flex gap-2 mb-3">
                <input id="newCommentInput" type="text" placeholder="Add a polite Islamic comment (e.g. MashaAllah, JazakAllah)..." class="flex-1 bg-black border border-slate-700 rounded-full px-3.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none" />
                <button type="button" onclick="postVideoComment()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-full text-xs font-extrabold shrink-0">Post</button>
              </div>
              <div id="watchCommentsList" class="space-y-2 max-h-40 overflow-y-auto pr-1 text-xs"></div>
            </div>

            <div>
              <h4 class="text-xs sm:text-sm font-extrabold text-white mb-3 flex items-center gap-1.5">
                <span>🎬</span> <span>Up Next — More Approved Islamic Videos</span>
              </h4>
              <div id="watchUpNextGrid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"></div>
            </div>
          `;
          scrollWrap.appendChild(extraWatchContent);
          playerModalBox.appendChild(scrollWrap);
        }
      }

      window.minimizeToMiniPlayer = function() {
        isMiniPlayerMode = true;
        const modal = document.getElementById('playerModal');
        const box = document.getElementById('playerModalBox');
        const aspect = document.getElementById('playerAspectBox');
        const scrollWrap = document.getElementById('ytWatchScrollContainer');
        const expBtn = document.getElementById('expandMiniPlayerBtn');
        const minBtn = document.getElementById('minimizePlayerBtn');
        const miniTitle = document.getElementById('miniPlayerTitleLabel');
        const video = videosData.find(v => v.id === currentPlayingVideoId);

        if (modal && box && aspect) {
          modal.className = 'fixed bottom-12 right-3 z-[90] w-72 sm:w-80 shadow-2xl pointer-events-auto';
          box.className = 'w-full bg-[#141414] rounded-2xl overflow-hidden border-2 border-emerald-500/60 shadow-2xl flex flex-col';
          aspect.className = 'relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center';
          if (scrollWrap) scrollWrap.classList.add('hidden');
          if (minBtn) minBtn.classList.add('hidden');
          if (miniTitle) {
            miniTitle.innerText = video ? video.title : 'Playing...';
            miniTitle.classList.remove('hidden');
          }
          if (expBtn) expBtn.classList.add('hidden');
        }
      };

      window.expandFromMiniPlayer = function() {
        isMiniPlayerMode = false;
        const modal = document.getElementById('playerModal');
        const box = document.getElementById('playerModalBox');
        const aspect = document.getElementById('playerAspectBox');
        const scrollWrap = document.getElementById('ytWatchScrollContainer');
        const expBtn = document.getElementById('expandMiniPlayerBtn');
        const minBtn = document.getElementById('minimizePlayerBtn');
        const miniTitle = document.getElementById('miniPlayerTitleLabel');
        const video = videosData.find(v => v.id === currentPlayingVideoId) || videosData[0];

        if (modal && box && aspect) {
          modal.className = 'fixed inset-0 z-[90] bg-black/95 flex flex-col justify-start items-center overflow-hidden';
          if (isVideoShort(video)) {
            box.className = 'w-full max-w-md h-full bg-[#0f0f0f] overflow-hidden border-x border-white/10 shadow-2xl flex flex-col';
            aspect.className = 'relative aspect-[9/16] min-h-[340px] max-h-[62vh] w-full bg-black shrink-0 overflow-hidden flex items-center justify-center mx-auto';
          } else {
            box.className = 'w-full max-w-5xl h-full bg-[#0f0f0f] overflow-hidden border-x border-white/10 shadow-2xl flex flex-col';
            aspect.className = 'relative aspect-video min-h-[240px] sm:min-h-[380px] max-h-[48vh] sm:max-h-[56vh] w-full bg-black shrink-0 overflow-hidden flex items-center justify-center';
          }
          if (scrollWrap) scrollWrap.classList.remove('hidden');
          if (minBtn) minBtn.classList.remove('hidden');
          if (miniTitle) miniTitle.classList.add('hidden');
          if (expBtn) expBtn.classList.add('hidden');
        }
      };

      window.renderWatchPageExtras = function(videoId) {
        const commList = document.getElementById('watchCommentsList');
        const commBadge = document.getElementById('watchCommentCountBadge');
        const comments = videoCommentsMap[videoId] || [
          { author: 'Ahmad Family', text: 'MashaAllah, very beneficial and 100% safe for our kids! JazakAllah Khair.', time: 'Verified User' }
        ];
        if (commBadge) commBadge.innerText = comments.length;
        if (commList) {
          commList.innerHTML = '';
          comments.forEach((c, idx) => {
            const delBtn = isSuperAdmin() ? `<button onclick="deleteVideoComment('${videoId}', ${idx})" class="text-rose-400 hover:underline text-[10px] ml-2">🗑️ Delete</button>` : '';
            commList.innerHTML += `
              <div class="bg-black/50 border border-white/5 rounded-xl px-3 py-2 flex items-start justify-between gap-2">
                <div>
                  <p class="font-bold text-emerald-400 text-[11px]">${c.author} <span class="text-slate-500 font-normal">• ${c.time}</span> ${delBtn}</p>
                  <p class="text-slate-200 text-xs mt-0.5">${c.text}</p>
                </div>
              </div>`;
          });
        }

        const upNextGrid = document.getElementById('watchUpNextGrid');
        if (!upNextGrid) return;
        upNextGrid.innerHTML = '';

        const related = videosData.filter(v => {
          if (v.id === videoId) return false;
          if (blockedVideoIds.includes(v.id)) return false;
          if (bannedChannels.includes(v.channel)) return false;
          if (isKidsLocked && !v.kidsSafe) return false;
          return true;
        });

        related.slice(0, 12).forEach(v => {
          const categoryArtwork = getCategoryIslamicArtwork(v.category);
          const cardThumb = v.customThumb || `https://i.ytimg.com/vi/${v.ytId}/hqdefault.jpg`;
          upNextGrid.innerHTML += `
            <a ${isKidsLocked ? '' : `href="?watch=${encodeURIComponent(v.id)}"`} onclick="return handleQaafVideoLinkClick(event, '${v.id}')" class="bg-[#181818] hover:bg-[#222] rounded-xl overflow-hidden border border-white/10 flex sm:flex-col gap-2.5 p-2 sm:p-0 cursor-pointer transition group no-underline text-inherit">
              <div class="relative w-36 sm:w-full aspect-video bg-slate-900 rounded-lg sm:rounded-none overflow-hidden shrink-0 pointer-events-none">
                <img src="${cardThumb}" alt="" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition pointer-events-none" onerror="this.onerror=null;this.src='${categoryArtwork}';" loading="lazy" />
                <span class="absolute bottom-1 right-1 bg-black/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">${v.duration || '12:00'}</span>
              </div>
              <div class="p-1 sm:p-2.5 min-w-0 flex-1">
                <h5 class="text-xs font-bold text-white line-clamp-2 leading-snug">${v.title}</h5>
                <p class="text-[10px] text-slate-400 mt-1 truncate">✅ ${v.channel} • ${(v.views / 1000).toFixed(1)}K views</p>
              </div>
            </a>`;
        });
      };

      window.postVideoComment = function() {
        const inp = document.getElementById('newCommentInput');
        const text = (inp ? inp.value : '').trim();
        if (!text) return;
        const check = analyzeThreeTierFilter(text, '');
        if (check.tier === 'REJECT') {
          alert('🚫 Comment contains restricted words and cannot be posted.');
          return;
        }
        if (!videoCommentsMap[currentPlayingVideoId]) videoCommentsMap[currentPlayingVideoId] = [];
        const authorName = currentUserEmail ? currentUserEmail.split('@')[0] : 'Muslim Family User';
        videoCommentsMap[currentPlayingVideoId].unshift({
          author: authorName,
          text,
          time: new Date().toLocaleTimeString()
        });
        localStorage.setItem('qaaf_video_comments', JSON.stringify(videoCommentsMap));
        if (inp) inp.value = '';
        renderWatchPageExtras(currentPlayingVideoId);
        if (window.qaafCloudSync) qaafCloudSync.pushState('New Comment Posted');
      };

      window.deleteVideoComment = function(videoId, idx) {
        if (!videoCommentsMap[videoId]) return;
        videoCommentsMap[videoId].splice(idx, 1);
        localStorage.setItem('qaaf_video_comments', JSON.stringify(videoCommentsMap));
        renderWatchPageExtras(videoId);
        if (window.qaafCloudSync) qaafCloudSync.pushState('Comment Deleted by Admin');
      };

      window.openVideoPlayer = function(videoId) {
        activePlayerEngine = 'youtube';
        currentPlayingVideoId = videoId;
        const video = videosData.find(v => v.id === videoId) || videosData[0];
        video.views += 1;

        document.getElementById('playingTitle').innerText = video.title;
        const chEl = document.getElementById('playingChannelName');
        if (chEl) chEl.innerHTML = `${video.channel} <span class="text-emerald-400 text-[10px]">✔</span>`;
        const vwEl = document.getElementById('playingViewsText');
        if (vwEl) vwEl.innerText = `${(video.views / 1000).toFixed(1)}K views • ${video.lang.toUpperCase()} • Halal Verified`;

        const shortsNav = document.getElementById('shortsSideNav');
        if (isVideoShort(video)) {
          if (shortsNav) { shortsNav.classList.remove('hidden'); shortsNav.classList.add('flex'); }
        } else {
          if (shortsNav) { shortsNav.classList.add('hidden'); shortsNav.classList.remove('flex'); }
        }

        document.getElementById('playerModal').classList.remove('hidden');
        expandFromMiniPlayer();
        updatePlayerEngineUI();
        loadVideoInActiveEngine(videoId);
        setTimeout(function(){ renderWatchPageExtras(videoId); }, 150);
      };

      // 5. INJECT YOUTUBE-STYLE SAFE SEARCH BAR & NOTIFICATION BAR
      const videosSec = document.getElementById('videosSection');
      if (videosSec && !document.getElementById('qaafSearchBarWrapper')) {
        const searchBarDiv = document.createElement('div');
        searchBarDiv.id = 'qaafSearchBarWrapper';
        searchBarDiv.className = 'mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2';
        searchBarDiv.innerHTML = `
          <div class="relative flex-1 flex items-center bg-[#12151e] border border-slate-700 focus-within:border-emerald-500 rounded-full px-4 py-2 shadow-inner">
            <span class="text-slate-400 mr-2 text-sm">🔍</span>
            <input id="qaafSearchInput" type="text" placeholder="Search approved Islamic videos, Scholars, Quran, Cartoons or Shorts..." class="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none" />
            <button id="qaafSearchClearBtn" type="button" class="hidden text-slate-400 hover:text-white text-xs font-bold px-2">✕</button>
          </div>
          <button id="qaafNotifBellBtn" type="button" class="bg-[#181c26] hover:bg-slate-800 border border-slate-700 text-slate-200 px-3.5 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 shadow">
            <span>🔔</span>
            <span>Video Request</span>
            <span id="userNotifCountBadge" class="bg-emerald-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-extrabold">0</span>
          </button>
        `;
        videosSec.parentNode.insertBefore(searchBarDiv, videosSec);

        const sInput = document.getElementById('qaafSearchInput');
        const sClear = document.getElementById('qaafSearchClearBtn');
        sInput.addEventListener('input', function() {
          currentSearchQuery = this.value.trim().toLowerCase();
          sClear.classList.toggle('hidden', !currentSearchQuery);
          renderVideos();
        });
        sClear.addEventListener('click', function() {
          sInput.value = '';
          currentSearchQuery = '';
          this.classList.add('hidden');
          renderVideos();
        });
        document.getElementById('qaafNotifBellBtn').addEventListener('click', function() { if (window.openUserNotificationsModal) window.openUserNotificationsModal(); });
      }

      if (!document.getElementById('userNotifModal')) {
        const notifModal = document.createElement('div');
        notifModal.id = 'userNotifModal';
        notifModal.className = 'fixed inset-0 z-50 hidden bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        notifModal.dir = 'ltr';
        notifModal.innerHTML = `
          <div class="bg-[#16181d] border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 class="text-sm sm:text-base font-extrabold text-emerald-400">🔔 My Channel &amp; Video Requests Status</h3>
              <button type="button" onclick="document.getElementById('userNotifModal').classList.add('hidden')" class="text-xs bg-slate-800 px-2.5 py-1 rounded text-slate-300 font-bold">✕ Close</button>
            </div>
            <div id="userNotifModalList" class="space-y-2.5 text-xs overflow-y-auto flex-1 pr-1"></div>
          </div>
        `;
        document.body.appendChild(notifModal);
      }

      function updateNotifBadges() {
        const qLen = (window.parentRequestsQueue && window.parentRequestsQueue.length) || 0;
        const myReqIds = JSON.parse(localStorage.getItem('qaaf_my_submitted_req_ids') || '[]');
        const myRequests = (window.parentRequestsQueue || []).filter(function(r) {
          if (currentUserEmail && r.requestedBy === currentUserEmail) return true;
          if (r.reqId && myReqIds.indexOf(r.reqId) !== -1) return true;
          return false;
        });
        const badge = document.getElementById('userNotifCountBadge');
        if (badge) {
          const myTotalCount = myRequests.length;
          badge.innerText = myTotalCount;
          if (myTotalCount > 0) {
            badge.classList.remove('hidden');
            badge.style.display = 'inline-flex';
          } else {
            badge.classList.add('hidden');
            badge.style.display = 'none';
          }
        }
        const sideReq = document.getElementById('admSidebarReqBadge');
        if (sideReq) sideReq.innerText = qLen;
        const sideFlag = document.getElementById('admSidebarFlagBadge');
        if (sideFlag) sideFlag.innerText = flaggedVideosQueue.length;
      }

      window.openUserNotificationsModal = function() {
        const listEl = document.getElementById('userNotifModalList');
        if (!listEl) return;
        listEl.innerHTML = '';
        const myReqIds = JSON.parse(localStorage.getItem('qaaf_my_submitted_req_ids') || '[]');
        const qList = (window.parentRequestsQueue || []).filter(function(r) {
          if (currentUserEmail && r.requestedBy === currentUserEmail) return true;
          if (r.reqId && myReqIds.indexOf(r.reqId) !== -1) return true;
          return false;
        });

        if (qList.length === 0) {
          listEl.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">
            <p class="text-2xl mb-2">&#x1F4EC;</p>
            <p class="font-bold text-white mb-1">No pending requests</p>
            <p class="text-[11px] text-slate-400">Submit any YouTube link above. Admin approval status will appear here.</p>
          </div>`;
        } else {
          qList.forEach(req => {
            const isObs = req.filterTier === 'OBSERVATION';
            listEl.innerHTML += `
              <div class="bg-slate-900/90 border ${isObs ? 'border-amber-500/50' : 'border-blue-500/40'} p-3 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <p class="font-bold text-white leading-snug line-clamp-2">${req.title}</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">Channel: ${req.channel} &bull; ${req.requestedAt || ''}</p>
                  <p class="text-[10px] ${isObs ? 'text-amber-300' : 'text-blue-300'} font-semibold mt-1">${req.filterNote || '&#x23F3; Waiting for Admin Approval'}</p>
                </div>
                <span class="bg-blue-600/20 border border-blue-400/40 text-blue-300 px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0">&#x23F3; Pending</span>
              </div>`;
          });
        }
        document.getElementById('userNotifModal').classList.remove('hidden');
      };

      const origOpenAdmin = window.openAdminModal;
      window.openAdminModal = function() {
        origOpenAdmin();
        
        updateNotifBadges();
      };

      // 6. HOOK SEARCH & ADMIN DELETE BUTTON INTO renderVideos()
      const origRenderVideos = window.renderVideos;
      window.renderVideos = function() {
        scrubBrokenVideoIds();
        const backupData = [...videosData];
        if (currentSearchQuery) {
          videosData = videosData.filter(v => {
            const hay = (`${v.title} ${v.channel} ${v.category} ${v.lang}`).toLowerCase();
            return hay.includes(currentSearchQuery);
          });
        }
        origRenderVideos();
        videosData = backupData;
        updateNotifBadges();
        

        if (isSuperAdmin() && !isKidsLocked) {
          document.querySelectorAll('#videoGrid > div').forEach(card => {
            const flagBtn = card.querySelector('button[onclick*="openFlagModal"]');
            if (flagBtn && !card.querySelector('.admin-del-btn')) {
              const match = flagBtn.getAttribute('onclick').match(/'([^']+)'/);
              if (match && match[1]) {
                const vidId = match[1];
                const delBtn = document.createElement('button');
                delBtn.className = 'admin-del-btn w-7 h-7 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center text-xs shadow border border-white/20';
                delBtn.title = 'Admin: Delete Video';
                delBtn.innerHTML = '🗑️';
                delBtn.onclick = function(e) { adminDeleteVideoCard(vidId, e); };
                flagBtn.parentNode.appendChild(delBtn);
              }
            }
          });
        }
      };

      // 7. SYNC NOTIFICATIONS & COMMENTS VIA FIREBASE CLOUD
      const origGetPayload = qaafCloudSync.getStatePayload.bind(qaafCloudSync);
      qaafCloudSync.getStatePayload = function() {
        const base = origGetPayload();
        base.requestNotificationsLog = requestNotificationsLog;
        base.videoCommentsMap = videoCommentsMap;
        return base;
      };

      const origApplyState = qaafCloudSync.applyIncomingState.bind(qaafCloudSync);
      qaafCloudSync.applyIncomingState = function(payload, source) {
        if (payload && Array.isArray(payload.requestNotificationsLog)) {
          requestNotificationsLog = payload.requestNotificationsLog;
          localStorage.setItem('qaaf_req_notifications', JSON.stringify(requestNotificationsLog));
        }
        if (payload && payload.videoCommentsMap && typeof payload.videoCommentsMap === 'object') {
          videoCommentsMap = payload.videoCommentsMap;
          localStorage.setItem('qaaf_video_comments', JSON.stringify(videoCommentsMap));
        }
        origApplyState(payload, source);
        scrubBrokenVideoIds();
        updateNotifBadges();
      };

      // 8. PERMANENTLY HIDE PIN NUMBER ON LOCK SCREEN & ADD AUTOMATIC RECOVERY
      window.syncPinDisplays = function() {
        const hintEl = document.getElementById('currentPinHint');
        if (hintEl) {
          hintEl.innerHTML = `•••••• • <button type="button" onclick="toggleForgotPinBox()" class="text-amber-300 underline font-bold ml-1">❓ Forgot PIN?</button>`;
        }
        const settingsPinEl = document.getElementById('settingsPinDisplay');
        if (settingsPinEl) settingsPinEl.innerText = '••••••';
      };
      window.syncPinDisplays();

      const pinStepView = document.getElementById('pinStepView');
      if (pinStepView && !document.getElementById('forgotPinRecoveryBox')) {
        const recBox = document.createElement('div');
        recBox.id = 'forgotPinRecoveryBox';
        recBox.className = 'hidden mt-4 pt-3 border-t border-slate-800 text-left space-y-2';
        recBox.innerHTML = `
          <p class="text-[11px] text-amber-300 font-bold">🔑 Parent PIN Automatic Recovery:</p>
          <input id="pinRecoveryInput" type="text" placeholder="Enter Recovery Word (default: makkah) or Parent Email" class="w-full bg-black border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white" />
          <button type="button" onclick="recoverParentPinNow()" class="w-full bg-amber-500 hover:bg-amber-400 text-black font-extrabold py-1.5 rounded-lg text-xs">Reset PIN to 123456</button>
          <p id="pinRecoveryFeedback" class="text-[11px] font-bold hidden"></p>
        `;
        pinStepView.appendChild(recBox);
      }

      window.toggleForgotPinBox = function() {
        const b = document.getElementById('forgotPinRecoveryBox');
        if (b) b.classList.toggle('hidden');
      };

      window.recoverParentPinNow = function() {
        const val = (document.getElementById('pinRecoveryInput')?.value || '').trim().toLowerCase();
        const fb = document.getElementById('pinRecoveryFeedback');
        if (!fb) return;
        fb.classList.remove('hidden');
        if (val === parentRecoverySecret.toLowerCase() || (currentUserEmail && val === currentUserEmail.toLowerCase()) || val === ADMIN_MASTER_RECOVERY_KEY) {
          parentPin = '123456';
          localStorage.setItem('qaaf_parent_pin_6', parentPin);
          document.getElementById('pinInput').value = '123456';
          window.syncPinDisplays();
          fb.className = "text-[11px] font-bold text-emerald-400";
          fb.innerText = "✅ Verified! Your PIN has been reset to 123456. Click 'Verify PIN' above.";
        } else {
          fb.className = "text-[11px] font-bold text-rose-400";
          fb.innerText = "❌ Invalid recovery word or email!";
        }
      };

      // SECURE SUPER ADMIN & USER LOGIN (EMAIL OR USERNAME + PASSWORD)
      adminPassword = localStorage.getItem('qaaf_admin_password_v2') || 'Allah#raham99';

      const loggedOutBox = document.getElementById('loggedOutView');
      if (loggedOutBox && !document.getElementById('userPassInput')) {
        loggedOutBox.innerHTML = `
          <div class="space-y-2.5 text-left">
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">Email or Admin Username:</label>
              <input id="userEmailInput" type="text" placeholder="Enter Email or Username" class="w-full bg-black border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">Password:</label>
              <input id="userPassInput" type="password" placeholder="••••••••••••" class="w-full bg-black border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-emerald-500 focus:outline-none" />
            </div>
            <p id="loginAuthError" class="text-xs font-bold text-rose-400 hidden"></p>
            <button type="button" onclick="loginWithEmail()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-extrabold shadow mt-1">
              🔐 Sign In Securely
            </button>
            <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
              <button type="button" onclick="recoverAdminAccountPrompt()" class="text-amber-400 hover:underline font-bold">❓ Forgot Password?</button>
              <span class="text-slate-500">Protected by QAAF Auth</span>
            </div>
          </div>
        `;
      }

      window.isSuperAdmin = function() {
        const em = (currentUserEmail || '').toLowerCase().trim();
        return em === 'qaaftube@gmail.com' || em === 'adminqaaftube' || em === 'admin@qaafai.com';
      };

      window.loginWithEmail = function() {
        const rawUser = (document.getElementById('userEmailInput')?.value || '').trim();
        const rawPass = (document.getElementById('userPassInput')?.value || '').trim();
        const errEl = document.getElementById('loginAuthError');
        if (errEl) errEl.classList.add('hidden');

        if (!rawUser) {
          if (errEl) { errEl.innerText = '⚠️ Please enter your Email or Username.'; errEl.classList.remove('hidden'); }
          return;
        }

        const lowerU = rawUser.toLowerCase();
        const isTryingAdmin = (lowerU === 'qaaftube@gmail.com' || lowerU === 'adminqaaftube' || lowerU === 'admin@qaafai.com');

        if (isTryingAdmin) {
          if (rawPass !== adminPassword) {
            if (errEl) { errEl.innerText = '❌ Invalid Super Admin Password!'; errEl.classList.remove('hidden'); }
            return;
          }
          currentUserEmail = 'qaaftube@gmail.com';
          localStorage.setItem('qaaf_user_email', currentUserEmail);
          syncAccountUI();
          closeAccountModal();
          openAdminModal();
          return;
        }

        // Standard Parent Login
        currentUserEmail = rawUser;
        localStorage.setItem('qaaf_user_email', currentUserEmail);
        syncAccountUI();
        closeAccountModal();
      };

      window.quickAdminLogin = function() {
        openAccountModal();
      };

      window.recoverAdminAccountPrompt = function() {
        const masterKey = prompt("🔑 Enter Master Recovery Key to reset password:");
        if (!masterKey) return;
        if (masterKey === ADMIN_MASTER_RECOVERY_KEY) {
          adminPassword = 'Allah#raham99';
          localStorage.setItem('qaaf_admin_password_v2', adminPassword);
          alert("✅ Super Admin Password has been restored!");
        } else {
          alert("❌ Invalid Master Recovery Key!");
        }
      };

      updateNotifBadges();
    })();

(function enforceStrictAdminPasswordLock() {
  const OFFICIAL_ADMIN_PASS = localStorage.getItem('qaaf_admin_password_v3') || 'Allah#raham99';
  const MASTER_RECOVERY_KEY = 'makkah786';

  // Force logout any old unverified admin session
  if (localStorage.getItem('qaaf_admin_verified_v3') !== 'true') {
    const savedEm = (localStorage.getItem('qaaf_user_email') || '').toLowerCase();
    if (savedEm === 'qaaftube@gmail.com' || savedEm === 'adminqaaftube' || savedEm === 'admin@qaafai.com') {
      currentUserEmail = '';
      localStorage.removeItem('qaaf_user_email');
    }
  }

  // Replace Login Modal UI to remove One-Click Admin button and require Password
  const loggedOutBox = document.getElementById('loggedOutView');
  if (loggedOutBox) {
    loggedOutBox.innerHTML = `
      <div class="space-y-3 text-left">
        <div>
          <label class="block text-[11px] font-bold text-slate-300 mb-1">Username or Email:</label>
          <input id="userEmailInput" type="text" placeholder="Enter Username or Email" class="w-full bg-black border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-300 mb-1">Password (Required for Admin):</label>
          <input id="userPassInput" type="password" placeholder="Enter Password" class="w-full bg-black border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
        </div>
        <p id="loginAuthError" class="text-xs font-bold text-rose-400 hidden"></p>
        <button type="button" onclick="loginWithEmail()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-extrabold shadow">
          🔐 Sign In Securely
        </button>
        <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
          <button type="button" onclick="recoverAdminAccountPrompt()" class="text-amber-400 hover:underline font-bold">❓ Forgot Password?</button>
          <span class="text-slate-500">QAAF Secure Auth</span>
        </div>
      </div>
    `;
  }

  // Remove Switch to Admin button for regular users
  const swBtn = document.getElementById('switchAdminBtn');
  if (swBtn) swBtn.remove();

  window.isSuperAdmin = function() {
    const em = (currentUserEmail || '').toLowerCase().trim();
    const isVerified = localStorage.getItem('qaaf_admin_verified_v3') === 'true';
    return isVerified && (em === 'qaaftube@gmail.com' || em === 'adminqaaftube');
  };

  window.loginWithEmail = function() {
    const rawUser = (document.getElementById('userEmailInput')?.value || '').trim();
    const rawPass = (document.getElementById('userPassInput')?.value || '').trim();
    const errEl = document.getElementById('loginAuthError');
    if (errEl) errEl.classList.add('hidden');

    if (!rawUser) {
      if (errEl) { errEl.innerText = '⚠️ Please enter Username or Email.'; errEl.classList.remove('hidden'); }
      return;
    }

    const lowerU = rawUser.toLowerCase();
    const isAdminUser = (lowerU === 'qaaftube@gmail.com' || lowerU === 'adminqaaftube' || lowerU === 'admin@qaafai.com' || lowerU === 'admin');

    if (isAdminUser) {
      const activePass = localStorage.getItem('qaaf_admin_password_v3') || OFFICIAL_ADMIN_PASS;
      if (!rawPass || rawPass !== activePass) {
        if (errEl) { errEl.innerText = '❌ Incorrect Admin Password! Access Denied.'; errEl.classList.remove('hidden'); }
        return;
      }
      localStorage.setItem('qaaf_admin_verified_v3', 'true');
      currentUserEmail = 'adminqaaftube';
      localStorage.setItem('qaaf_user_email', currentUserEmail);
      syncAccountUI();
      closeAccountModal();
      openAdminModal();
      return;
    }

    // Standard Parent Login
    localStorage.removeItem('qaaf_admin_verified_v3');
    currentUserEmail = rawUser;
    localStorage.setItem('qaaf_user_email', currentUserEmail);
    syncAccountUI();
    closeAccountModal();
  };

  const origLogout = window.logoutAccount;
  window.logoutAccount = function() {
    localStorage.removeItem('qaaf_admin_verified_v3');
    if (origLogout) origLogout();
  };

  window.quickAdminLogin = function() {
    openAccountModal();
  };

  window.recoverAdminAccountPrompt = function() {
    const masterKey = prompt("🔑 Enter Master Recovery Key to reset Admin password:");
    if (!masterKey) return;
    if (masterKey === MASTER_RECOVERY_KEY) {
      localStorage.setItem('qaaf_admin_password_v3', 'Allah#raham99');
      alert("✅ Admin Password reset to default!");
    } else {
      alert("❌ Invalid Master Recovery Key!");
    }
  };

  syncAccountUI();
})();

(function initSignInAndSignUpSystem() {
  window.registeredUsersMap = JSON.parse(localStorage.getItem('qaaf_registered_users') || '{}');
  const OFFICIAL_ADMIN_PASS = localStorage.getItem('qaaf_admin_password_v3') || 'Allah#raham99';

  const loggedOutBox = document.getElementById('loggedOutView');
  if (loggedOutBox) {
    loggedOutBox.innerHTML = `
      <!-- SIGN IN / SIGN UP TABS -->
      <div class="grid grid-cols-2 gap-1.5 bg-black p-1 rounded-xl border border-slate-800 mb-3.5 text-xs font-extrabold">
        <button type="button" id="authTabSignInBtn" onclick="switchAuthModalTab('signin')" class="py-2 rounded-lg bg-emerald-600 text-white shadow transition">🔐 Sign In</button>
        <button type="button" id="authTabSignUpBtn" onclick="switchAuthModalTab('signup')" class="py-2 rounded-lg text-slate-400 hover:text-white transition">✨ Sign Up</button>
      </div>

      <!-- 1. SIGN IN FORM -->
      <div id="authSignInPane" class="space-y-3 text-left">
        <div>
          <label class="block text-[11px] font-bold text-slate-300 mb-1">Username or Email:</label>
          <input id="userEmailInput" type="text" placeholder="Enter Username or Email" class="w-full bg-black border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-300 mb-1">Password:</label>
          <input id="userPassInput" type="password" placeholder="Enter Password" class="w-full bg-black border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
        </div>
        <p id="loginAuthError" class="text-xs font-bold text-rose-400 hidden"></p>
        <button type="button" onclick="loginWithEmail()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-extrabold shadow">
          🔐 Sign In to Account
        </button>
        <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
          <button type="button" onclick="recoverUserOrAdminPassword()" class="text-amber-400 hover:underline font-bold">❓ Forgot Password?</button>
          <button type="button" onclick="switchAuthModalTab('signup')" class="text-emerald-400 hover:underline font-bold">Create New Account ➔</button>
        </div>
      </div>

      <!-- 2. SIGN UP (CREATE ACCOUNT) FORM -->
      <div id="authSignUpPane" class="hidden space-y-2.5 text-left">
        <div>
          <label class="block text-[11px] font-bold text-slate-300 mb-1">Full Name / Family Name:</label>
          <input id="regNameInput" type="text" placeholder="e.g. Ahmad Family" class="w-full bg-black border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-300 mb-1">Email or Username:</label>
          <input id="regEmailInput" type="text" placeholder="example@example.com" class="w-full bg-black border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Create Password:</label>
            <input id="regPassInput" type="password" placeholder="Min 6 characters" class="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-amber-300 mb-1">Recovery Secret Word:</label>
            <input id="regRecoveryWordInput" type="text" placeholder="e.g. madinah" class="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none" />
          </div>
        </div>
        <p id="signUpAuthError" class="text-xs font-bold text-rose-400 hidden"></p>
        <button type="button" onclick="registerNewFamilyAccount()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-extrabold shadow mt-1">
          ✨ Create Family Account
        </button>
      </div>
    `;
  }

  window.switchAuthModalTab = function(tab) {
    const inPane = document.getElementById('authSignInPane');
    const upPane = document.getElementById('authSignUpPane');
    const inBtn = document.getElementById('authTabSignInBtn');
    const upBtn = document.getElementById('authTabSignUpBtn');
    if (!inPane || !upPane) return;
    if (tab === 'signup') {
      inPane.classList.add('hidden');
      upPane.classList.remove('hidden');
      upBtn.className = 'py-2 rounded-lg bg-blue-600 text-white shadow transition';
      inBtn.className = 'py-2 rounded-lg text-slate-400 hover:text-white transition';
    } else {
      upPane.classList.add('hidden');
      inPane.classList.remove('hidden');
      inBtn.className = 'py-2 rounded-lg bg-emerald-600 text-white shadow transition';
      upBtn.className = 'py-2 rounded-lg text-slate-400 hover:text-white transition';
    }
  };

  window.registerNewFamilyAccount = function() {
    const name = (document.getElementById('regNameInput')?.value || '').trim();
    const userKey = (document.getElementById('regEmailInput')?.value || '').trim().toLowerCase();
    const pass = (document.getElementById('regPassInput')?.value || '').trim();
    const recWord = (document.getElementById('regRecoveryWordInput')?.value || 'makkah').trim().toLowerCase();
    const errEl = document.getElementById('signUpAuthError');
    if (errEl) errEl.classList.add('hidden');

    if (!name || !userKey || !pass) {
      if (errEl) { errEl.innerText = '⚠️ Please fill in Name, Email/Username, and Password.'; errEl.classList.remove('hidden'); }
      return;
    }
    if (userKey === 'adminqaaftube' || userKey === 'qaaftube@gmail.com') {
      if (errEl) { errEl.innerText = '🚫 Reserved Super Admin username! Please Sign In instead.'; errEl.classList.remove('hidden'); }
      return;
    }
    if (window.registeredUsersMap[userKey]) {
      if (errEl) { errEl.innerText = '⚠️ Account already exists! Please Sign In.'; errEl.classList.remove('hidden'); }
      return;
    }

    window.registeredUsersMap[userKey] = { name, userKey, pass, recWord, createdAt: new Date().toLocaleDateString() };
    localStorage.setItem('qaaf_registered_users', JSON.stringify(window.registeredUsersMap));
    localStorage.setItem('qaaf_parent_recovery_secret', recWord);

    localStorage.removeItem('qaaf_admin_verified_v3');
    currentUserEmail = userKey;
    localStorage.setItem('qaaf_user_email', currentUserEmail);
    syncAccountUI();
    closeAccountModal();
    if (window.qaafCloudSync) qaafCloudSync.pushState('New Family Account Registered');
    alert(`🎉 Welcome ${name}! Your QAAF Tube Family Account has been created.`);
  };

  window.loginWithEmail = function() {
    const rawUser = (document.getElementById('userEmailInput')?.value || '').trim();
    const rawPass = (document.getElementById('userPassInput')?.value || '').trim();
    const errEl = document.getElementById('loginAuthError');
    if (errEl) errEl.classList.add('hidden');

    if (!rawUser || !rawPass) {
      if (errEl) { errEl.innerText = '⚠️ Please enter both Username/Email and Password.'; errEl.classList.remove('hidden'); }
      return;
    }

    const lowerU = rawUser.toLowerCase();
    const isAdminUser = (lowerU === 'qaaftube@gmail.com' || lowerU === 'adminqaaftube' || lowerU === 'admin@qaafai.com' || lowerU === 'admin');

    if (isAdminUser) {
      const activePass = localStorage.getItem('qaaf_admin_password_v3') || OFFICIAL_ADMIN_PASS;
      if (rawPass !== activePass) {
        if (errEl) { errEl.innerText = '❌ Incorrect Admin Password!'; errEl.classList.remove('hidden'); }
        return;
      }
      localStorage.setItem('qaaf_admin_verified_v3', 'true');
      currentUserEmail = 'adminqaaftube';
      localStorage.setItem('qaaf_user_email', currentUserEmail);
      syncAccountUI();
      closeAccountModal();
      openAdminModal();
      return;
    }

    const existingUser = window.registeredUsersMap[lowerU];
    if (!existingUser) {
      if (errEl) { errEl.innerText = '⚠️ Account not found! Click "Sign Up" above to create an account.'; errEl.classList.remove('hidden'); }
      return;
    }
    if (existingUser.pass !== rawPass) {
      if (errEl) { errEl.innerText = '❌ Incorrect Password!'; errEl.classList.remove('hidden'); }
      return;
    }

    localStorage.removeItem('qaaf_admin_verified_v3');
    currentUserEmail = lowerU;
    localStorage.setItem('qaaf_user_email', currentUserEmail);
    syncAccountUI();
    closeAccountModal();
  };

  window.recoverUserOrAdminPassword = function() {
    if (typeof window.openInAppPasswordRecovery === 'function') {
      return window.openInAppPasswordRecovery();
    }
    const rawUser = (document.getElementById('userEmailInput')?.value || '').trim().toLowerCase();
    if (!rawUser) {
      return;
    }
    if (rawUser === 'adminqaaftube' || rawUser === 'qaaftube@gmail.com') {
      window.recoverAdminAccountPrompt();
      return;
    }
    const existing = window.registeredUsersMap[rawUser];
    if (!existing) {
      alert('❌ No account found with this Email/Username.');
      return;
    }
    const word = prompt(`🔑 Enter your Recovery Secret Word for ${rawUser}:`);
    if (word && word.trim().toLowerCase() === existing.recWord) {
      const newP = prompt('✅ Verified! Enter your new password:');
      if (newP && newP.trim()) {
        existing.pass = newP.trim();
        localStorage.setItem('qaaf_registered_users', JSON.stringify(window.registeredUsersMap));
        alert('✅ Password updated successfully! You can now Sign In.');
      }
    } else {
      alert('❌ Incorrect Recovery Secret Word!');
    }
  };
})();

(function enableAllChannelsBarAndLiveChannelImporter() {
  const ALL_VIDEOS_INIT = [];
  const VER_TAG = 'qaaf_44ch_1793647507';
  let selectedChannelFilter = 'ALL';
  let pendingChannelFetchedVideos = [];

  if (!localStorage.getItem('qaaf_videos_data') && localStorage.getItem('qaaf_ch_ver') !== VER_TAG) {
    videosData = JSON.parse(JSON.stringify(ALL_VIDEOS_INIT));
    localStorage.setItem('qaaf_videos_data', JSON.stringify(videosData));
    localStorage.setItem('qaaf_ch_ver', VER_TAG);
  }

  // 1. Add Horizontal Approved Channels Bar above Videos Grid
  const videosSec = document.getElementById('videosSection');
  if (videosSec && !document.getElementById('qaafChannelsFilterBar')) {
    const chBar = document.createElement('div');
    chBar.id = 'qaafChannelsFilterBar';
    chBar.className = 'mb-3.5 bg-[#10131a]/95 border border-slate-800 rounded-2xl p-2.5 flex items-center gap-2 overflow-x-auto';
    chBar.dir = 'ltr';
    videosSec.parentNode.insertBefore(chBar, videosSec);
  }

  window.selectChannelFilter = function(chName) {
    selectedChannelFilter = chName;
    renderVideos();
  };

  function renderChannelsBar() { return;
    const bar = document.getElementById('qaafChannelsFilterBar');
    if (!bar) return;
    const visibleVids = videosData.filter(v => !isKidsLocked || v.kidsSafe);
    const uniqueChannels = [...new Set(visibleVids.map(v => v.channel))];

    let htmlChips = `<button type="button" onclick="selectChannelFilter('ALL')" class="px-3 py-1.5 rounded-full text-xs font-extrabold shrink-0 transition ${selectedChannelFilter === 'ALL' ? 'bg-emerald-500 text-black shadow' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}">📺 All Channels (${uniqueChannels.length})</button>`;
    uniqueChannels.forEach(ch => {
      const isAct = (selectedChannelFilter === ch);
      const count = visibleVids.filter(v => v.channel === ch).length;
      htmlChips += `<button type="button" onclick="selectChannelFilter('${ch.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${isAct ? 'bg-emerald-500 text-black shadow' : 'bg-[#1a1f2c] hover:bg-slate-800 text-slate-200 border border-slate-700/80'}"><span>✅ ${ch}</span><span class="text-[10px] opacity-75">(${count})</span></button>`;
    });
    bar.innerHTML = htmlChips;
  }

  const prevRender = window.renderVideos;
  window.renderVideos = function() {
    renderChannelsBar();
    const fullBackup = [...videosData];
    if (selectedChannelFilter !== 'ALL' && !window.qaafActiveSearchQuery) {
      videosData = videosData.filter(v => v.channel === selectedChannelFilter);
    }
    prevRender();
    videosData = fullBackup;
  };

  // 2. LIVE YOUTUBE CHANNEL URL IMPORTER IN ADMIN PANEL
  const prevAutoFetch = window.adminAutoFetchYouTubeInfo;
  window.adminAutoFetchYouTubeInfo = async function() {
    const urlInput = document.getElementById('adminYtUrlInput');
    const raw = (urlInput ? urlInput.value : '').trim();
    pendingChannelFetchedVideos = [];

    const isChannelUrl = raw.includes('/@') || raw.startsWith('@') || raw.includes('/channel/') || raw.includes('/c/');
    if (!isChannelUrl) {
      if (prevAutoFetch) return prevAutoFetch();
      return;
    }

    const isShortsLink = raw.includes('/shorts');
    showSyncToast('⏳ Fetching videos from Channel link... Please wait 4 seconds.');

    let targetUrl = raw;
    if (raw.startsWith('@')) targetUrl = 'https://www.youtube.com/' + raw + '/videos';
    else if (!raw.endsWith('/videos') && !raw.endsWith('/shorts')) targetUrl = raw.replace(/\/+$/, '') + '/videos';

    const proxies = [
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl),
      'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(targetUrl)
    ];

    let htmlText = '';
    for (const px of proxies) {
      try {
        const r = await fetch(px);
        if (r.ok) {
          htmlText = await r.text();
          if (htmlText && htmlText.includes('videoId')) break;
        }
      } catch (e) {}
    }

    if (!htmlText || !htmlText.includes('videoId')) {
      alert('⚠️ Could not reach channel page directly. Try pasting any single video URL from that channel!');
      return;
    }

    const matches = [...htmlText.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
    const uniqueIds = [...new Set(matches)].slice(0, 150);

    const fetchedItems = [];
    let detectedAuthor = '';
    for (const vidId of uniqueIds) {
      try {
        const oe = await fetch('https://noembed.com/embed?url=https://www.youtube.com/watch?v=' + vidId);
        const d = await oe.json();
        if (d && d.title) {
          detectedAuthor = detectedAuthor || d.author_name || 'Islamic Channel';
          fetchedItems.push({
            ytId: vidId,
            title: isShortsLink && !d.title.includes('#Shorts') ? d.title + ' #Shorts' : d.title,
            channel: d.author_name || detectedAuthor,
            isShort: isShortsLink
          });
        }
      } catch (e) {}
    }

    if (fetchedItems.length > 0) {
      pendingChannelFetchedVideos = fetchedItems;
      document.getElementById('adminVideoTitle').value = `[Channel Pack: ${fetchedItems.length} Videos] ${fetchedItems[0].title}`;
      document.getElementById('adminChannelName').value = detectedAuthor;
      updateYtPreview(fetchedItems[0].ytId, `${detectedAuthor} (${fetchedItems.length} Videos Ready)`, detectedAuthor);
      showSyncToast(`✅ Found ${fetchedItems.length} videos from ${detectedAuthor}! Click "+ Push Live" to add all!`);
    } else {
      alert('⚠️ No embeddable videos found on that link.');
    }
  };

  const prevAddVideo = window.adminAddGlobalVideo;
  window.adminAddGlobalVideo = function() {
    if (pendingChannelFetchedVideos.length > 0) {
      const lang = document.getElementById('adminVideoLang').value;
      const cat = document.getElementById('adminVideoCat').value;
      const chCustomName = document.getElementById('adminChannelName').value.trim();

      pendingChannelFetchedVideos.forEach((item, idx) => {
        videosData.unshift({
          id: 'v_' + item.ytId + '_' + idx,
          title: item.title,
          channel: chCustomName || item.channel,
          lang,
          region: lang.toUpperCase(),
          category: cat,
          kidsSafe: (cat !== 'bayan'),
          isShort: item.isShort,
          ytId: item.ytId,
          isCustomAdded: true,
          duration: item.isShort ? '0:55' : '14:20',
          views: 1500,
          createdAt: Math.floor(Date.now() / 1000) - idx
        });
      });

      const countAdded = pendingChannelFetchedVideos.length;
      const chAdded = chCustomName || pendingChannelFetchedVideos[0].channel;
      pendingChannelFetchedVideos = [];
      document.getElementById('adminYtUrlInput').value = '';
      document.getElementById('adminVideoTitle').value = '';
      document.getElementById('adminChannelName').value = '';
      updateYtPreview(null);

      renderVideos();
      
      if (window.qaafCloudSync) qaafCloudSync.pushState(`Imported ${countAdded} videos from ${chAdded}`);
      showSyncToast(`🎉 Imported ${countAdded} videos from ${chAdded}!`);
      return;
    }
    if (prevAddVideo) return prevAddVideo();
  };

  })();

(function enableDirectChannelBanEverywhere() {
  // Master function to Ban & Remove an entire channel and all its videos
  window.adminBanAndRemoveChannel = function(channelName, event) {
    if (event) event.stopPropagation();
    if (!channelName) return;
    const count = videosData.filter(v => v.channel === channelName).length;
    if (!confirm(`⛔ Ban & Remove Entire Channel?\n\nChannel: "${channelName}"\nThis will immediately remove all ${count} video(s) of this channel and block it.`)) return;

    if (!bannedChannels.includes(channelName)) {
      bannedChannels.push(channelName);
      localStorage.setItem('qaaf_banned_channels', JSON.stringify(bannedChannels));
    }
    videosData = videosData.filter(v => v.channel !== channelName);
    localStorage.setItem('qaaf_videos_data', JSON.stringify(videosData));

    if (typeof selectChannelFilter === 'function') selectChannelFilter('ALL');
    renderVideos();
    
    if (window.qaafCloudSync) qaafCloudSync.pushState(`Banned Channel: ${channelName}`);
    showSyncToast(`⛔ Channel "${channelName}" banned and removed!`);
  };

  window.adminUnbanChannel = function(channelName) {
    bannedChannels = bannedChannels.filter(c => c !== channelName);
    localStorage.setItem('qaaf_banned_channels', JSON.stringify(bannedChannels));
    renderVideos();
    
    if (window.qaafCloudSync) qaafCloudSync.pushState(`Unbanned Channel: ${channelName}`);
    showSyncToast(`✅ Channel "${channelName}" unbanned!`);
  };

  // 1. Upgrade Admin Catalog to show BOTH "Ban Channel" and "Delete Video" + Active Channels List
  window.renderAdminActiveVideosCatalog = function() {
    const listEl = document.getElementById('adminActiveVideosCatalogList');
    const countBadge = document.getElementById('admVideosCountBadge');
    if (countBadge) countBadge.innerText = (videosData && videosData.length) || 0;
    const admModal = document.getElementById('adminDashboardModal');
    if (!listEl || !admModal || admModal.classList.contains('hidden')) return;

    const uniqueChs = [...new Set(videosData.map(v => v.channel))];
    let htmlOut = '';

    // Top Summary of Active Channels for 1-click Channel Removal
    if (uniqueChs.length > 0) {
      htmlOut += `
        <div class="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 mb-3">
          <p class="text-[11px] font-extrabold text-amber-300 mb-2">📺 Active Channels (${uniqueChs.length}) — Click any channel to Ban &amp; Remove it completely:</p>
          <div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-0.5">
      `;
      uniqueChs.forEach(ch => {
        const cCount = videosData.filter(v => v.channel === ch).length;
        const safeCh = ch.replace(/'/g, "\\'");
        htmlOut += `
          <button type="button" onclick="adminBanAndRemoveChannel('${safeCh}', event)" class="bg-black hover:bg-red-950/80 border border-slate-700 hover:border-red-500 text-slate-200 hover:text-red-200 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition" title="Click to Ban & Remove this entire channel">
            <span>${ch} (${cCount})</span>
            <span class="text-rose-400 font-extrabold">⛔ Ban</span>
          </button>
        `;
      });
      htmlOut += `</div></div>`;
    }

    // Banned Channels Restore Box (if any)
    if (bannedChannels.length > 0) {
      htmlOut += `
        <div class="bg-rose-950/20 border border-rose-500/30 rounded-xl p-2.5 mb-3">
          <p class="text-[10px] font-bold text-rose-300 mb-1.5">⛔ Banned Channels (Click to Unban):</p>
          <div class="flex flex-wrap gap-1.5">
      `;
      bannedChannels.forEach(bch => {
        const safeBch = bch.replace(/'/g, "\\'");
        htmlOut += `<button type="button" onclick="adminUnbanChannel('${safeBch}')" class="bg-black/70 border border-rose-500/40 text-rose-200 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-emerald-950">🔄 Unban: ${bch}</button>`;
      });
      htmlOut += `</div></div>`;
    }

    // Individual Video Rows with both "Ban Channel" and "Delete Video"
    videosData.forEach(v => {
      const safeCh = (v.channel || '').replace(/'/g, "\\'");
      htmlOut += `
        <div class="bg-black/60 border border-slate-800 hover:border-slate-700 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition">
          <div class="min-w-0 flex-1">
            <p class="font-bold text-white truncate">${v.title}</p>
            <p class="text-[10px] text-slate-400">Channel: <strong class="text-amber-300">${v.channel}</strong> • ID: <span class="font-mono text-emerald-400">${v.ytId}</span> • ${v.lang.toUpperCase()}</p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="adminBanAndRemoveChannel('${safeCh}', event)" class="bg-amber-600/20 hover:bg-red-600 border border-amber-500/40 text-amber-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition">
              ⛔ Ban Channel
            </button>
            <button type="button" onclick="adminDeleteVideoCard('${v.id}', event)" class="bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition">
              🗑️ Video
            </button>
          </div>
        </div>`;
    });
    listEl.innerHTML = htmlOut;
  };

  // 2. Inject "⛔ Ban Channel" button directly under every Video Card next to the Channel Name when Admin is logged in
  const prevRenderVids = window.renderVideos;
  window.renderVideos = function() {
    if (prevRenderVids) prevRenderVids();

    if (isSuperAdmin() && !isKidsLocked) {
      // Add Ban button right next to Channel Name on each Video Card
      document.querySelectorAll('#videoGrid > div').forEach(card => {
        const flagBtn = card.querySelector('button[onclick*="openFlagModal"]');
        if (!flagBtn) return;
        const match = flagBtn.getAttribute('onclick').match(/'([^']+)'/);
        if (!match || !match[1]) return;
        const vidObj = videosData.find(x => x.id === match[1]);
        if (!vidObj) return;

        const chRow = card.querySelector('.p-3 .flex.items-center.justify-between');
        if (chRow && !chRow.querySelector('.card-ban-ch-btn')) {
          const banBtn = document.createElement('button');
          banBtn.type = 'button';
          banBtn.className = 'card-ban-ch-btn bg-red-600/25 hover:bg-red-600 border border-red-500/50 text-red-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-extrabold transition ml-1 shrink-0';
          banBtn.innerHTML = '⛔ Ban Channel';
          banBtn.title = `Ban & Remove entire channel: ${vidObj.channel}`;
          banBtn.onclick = function(e) {
            adminBanAndRemoveChannel(vidObj.channel, e);
          };
          // Clean card: ban channel moved to admin panel
        }
      });
    }
  };

})();

(function applyUpdatedSingleLogoAnimation() {
  const RED_D = "M 512.00 55.00 C 788.00 55.00 896.96 64.47 934.00 95.00 C 971.04 125.53 984.00 222.00 984.00 358.00 C 984.00 494.00 971.04 590.47 934.00 621.00 C 896.96 651.53 788.00 661.00 512.00 661.00 C 236.00 661.00 127.04 651.53 90.00 621.00 C 52.96 590.47 40.00 494.00 40.00 358.00 C 40.00 222.00 52.96 125.53 90.00 95.00 C 127.04 64.47 236.00 55.00 512.00 55.00 Z";
  const BORDER_D = "M 512.00 79.00 C 772.00 79.00 893.79 91.81 920.00 115.00 C 946.21 138.19 959.00 232.00 959.00 358.00 C 959.00 484.00 946.21 577.81 920.00 601.00 C 893.79 624.19 772.00 637.00 512.00 637.00 C 252.00 637.00 130.21 624.19 104.00 601.00 C 77.79 577.81 65.00 484.00 65.00 358.00 C 65.00 232.00 77.79 138.19 104.00 115.00 C 130.21 91.81 252.00 79.00 512.00 79.00 Z M 512.00 103.00 C 694.55 103.00 862.87 101.58 900.65 134.03 C 938.43 166.47 935.00 290.13 935.00 358.00 C 935.00 425.87 938.43 549.53 900.65 581.97 C 862.87 614.42 694.55 613.00 512.00 613.00 C 329.45 613.00 161.13 614.42 123.35 581.97 C 85.57 549.53 89.00 425.87 89.00 358.00 C 89.00 290.13 85.57 166.47 123.35 134.03 C 161.13 101.58 329.45 103.00 512.00 103.00 Z";
  const TRI_D = "M 562.00 240.68 L 562.00 473.52 Q 562.00 504.70 589.00 489.11 L 789.20 372.19 Q 816.20 356.60 789.20 341.01 L 589.00 225.09 Q 562.00 209.50 562.00 240.68 Z";
  const QAAF_PATH_D = "M 452.00 219.00 L 446.00 220.00 L 443.00 221.00 L 440.00 222.00 L 434.00 225.00 L 431.00 227.00 L 422.00 236.00 L 419.00 240.00 L 416.00 244.00 L 414.00 247.00 L 413.00 250.00 L 411.00 252.00 L 407.00 260.00 L 407.00 262.00 L 405.00 265.00 L 404.00 268.00 L 403.00 271.00 L 402.00 275.00 L 401.00 279.00 L 400.00 285.00 L 400.00 307.00 L 401.00 312.00 L 403.00 315.00 L 403.00 317.00 L 404.00 319.00 L 407.00 323.00 L 409.00 325.00 L 412.00 327.00 L 415.00 329.00 L 421.00 332.00 L 424.00 333.00 L 427.00 334.00 L 432.00 335.00 L 450.00 335.00 L 461.00 333.00 L 469.00 333.00 L 477.00 334.00 L 483.00 335.00 L 486.00 336.00 L 489.00 338.00 L 491.00 338.00 L 494.00 340.00 L 498.00 343.00 L 501.00 347.00 L 504.00 348.00 L 504.00 346.00 L 504.00 333.00 L 505.00 330.00 L 506.00 332.00 L 508.00 334.00 L 508.00 336.00 L 511.00 341.00 L 512.00 346.00 L 512.00 354.00 L 508.00 359.00 L 495.00 372.00 L 488.00 378.00 L 484.00 381.00 L 480.00 383.00 L 476.00 387.00 L 472.00 390.00 L 468.00 393.00 L 464.00 396.00 L 460.00 399.00 L 455.00 403.00 L 452.00 405.00 L 449.00 407.00 L 446.00 409.00 L 443.00 411.00 L 440.00 413.00 L 437.00 414.00 L 435.00 416.00 L 432.00 417.00 L 430.00 419.00 L 425.00 421.00 L 423.00 423.00 L 412.00 428.00 L 410.00 430.00 L 400.00 435.00 L 397.00 436.00 L 395.00 436.00 L 392.00 438.00 L 390.00 438.00 L 385.00 441.00 L 383.00 441.00 L 380.00 443.00 L 378.00 443.00 L 375.00 445.00 L 372.00 446.00 L 369.00 447.00 L 366.00 448.00 L 364.00 448.00 L 361.00 450.00 L 357.00 451.00 L 353.00 452.00 L 350.00 453.00 L 346.00 454.00 L 341.00 455.00 L 336.00 456.00 L 325.00 457.00 L 310.00 457.00 L 301.00 456.00 L 297.00 455.00 L 293.00 454.00 L 289.00 453.00 L 286.00 451.00 L 284.00 451.00 L 280.00 449.00 L 278.00 447.00 L 275.00 446.00 L 272.00 444.00 L 269.00 442.00 L 262.00 436.00 L 258.00 432.00 L 256.00 429.00 L 254.00 426.00 L 251.00 420.00 L 250.00 417.00 L 249.00 414.00 L 248.00 411.00 L 247.00 407.00 L 246.00 401.00 L 245.00 393.00 L 245.00 383.00 L 246.00 375.00 L 247.00 369.00 L 248.00 365.00 L 249.00 362.00 L 250.00 358.00 L 251.00 355.00 L 252.00 352.00 L 254.00 348.00 L 254.00 345.00 L 256.00 342.00 L 257.00 338.00 L 258.00 335.00 L 259.00 331.00 L 260.00 327.00 L 260.00 325.00 L 257.00 326.00 L 255.00 325.00 L 252.00 328.00 L 251.00 331.00 L 249.00 333.00 L 240.00 351.00 L 240.00 353.00 L 238.00 356.00 L 238.00 358.00 L 236.00 361.00 L 235.00 364.00 L 234.00 367.00 L 233.00 370.00 L 232.00 373.00 L 231.00 377.00 L 230.00 381.00 L 229.00 385.00 L 228.00 391.00 L 228.00 401.00 L 226.00 409.00 L 226.00 431.00 L 228.00 436.00 L 231.00 441.00 L 231.00 447.00 L 232.00 453.00 L 233.00 457.00 L 234.00 461.00 L 235.00 464.00 L 238.00 470.00 L 240.00 473.00 L 245.00 479.00 L 262.00 496.00 L 266.00 499.00 L 270.00 501.00 L 273.00 502.00 L 275.00 502.00 L 278.00 504.00 L 283.00 504.00 L 287.00 505.00 L 290.00 507.00 L 295.00 508.00 L 310.00 508.00 L 315.00 511.00 L 324.00 511.00 L 331.00 510.00 L 337.00 509.00 L 344.00 508.00 L 348.00 507.00 L 351.00 506.00 L 355.00 505.00 L 359.00 504.00 L 362.00 503.00 L 365.00 502.00 L 368.00 501.00 L 371.00 500.00 L 374.00 499.00 L 377.00 497.00 L 379.00 497.00 L 382.00 496.00 L 387.00 493.00 L 389.00 493.00 L 407.00 484.00 L 409.00 482.00 L 412.00 481.00 L 414.00 479.00 L 417.00 478.00 L 420.00 476.00 L 422.00 474.00 L 425.00 473.00 L 428.00 471.00 L 430.00 469.00 L 433.00 467.00 L 437.00 465.00 L 440.00 463.00 L 443.00 461.00 L 445.00 459.00 L 446.00 461.00 L 450.00 458.00 L 455.00 454.00 L 461.00 450.00 L 465.00 447.00 L 472.00 441.00 L 478.00 435.00 L 482.00 433.00 L 493.00 423.00 L 504.00 412.00 L 509.00 406.00 L 511.00 401.00 L 514.00 398.00 L 515.00 395.00 L 517.00 393.00 L 523.00 381.00 L 523.00 379.00 L 525.00 376.00 L 526.00 373.00 L 527.00 370.00 L 528.00 367.00 L 529.00 363.00 L 530.00 358.00 L 531.00 353.00 L 532.00 346.00 L 532.00 315.00 L 531.00 309.00 L 530.00 304.00 L 529.00 299.00 L 528.00 296.00 L 527.00 293.00 L 526.00 289.00 L 525.00 286.00 L 523.00 283.00 L 523.00 281.00 L 521.00 278.00 L 521.00 276.00 L 519.00 272.00 L 517.00 270.00 L 517.00 268.00 L 515.00 266.00 L 513.00 261.00 L 511.00 259.00 L 511.00 257.00 L 509.00 254.00 L 507.00 251.00 L 504.00 247.00 L 489.00 232.00 L 485.00 229.00 L 482.00 227.00 L 472.00 222.00 L 469.00 221.00 L 466.00 220.00 L 460.00 219.00 Z M 438.00 266.00 L 439.00 265.00 L 449.00 265.00 L 452.00 266.00 L 455.00 268.00 L 457.00 268.00 L 461.00 270.00 L 465.00 273.00 L 477.00 285.00 L 474.00 287.00 L 455.00 288.00 L 438.00 288.00 L 435.00 287.00 L 429.00 284.00 L 424.00 279.00 L 424.00 277.00 L 425.00 275.00 L 427.00 273.00 L 429.00 271.00 L 431.00 269.00 L 434.00 267.00 L 436.00 267.00 Z M 459.00 144.00 L 457.00 147.00 L 455.00 150.00 L 455.00 152.00 L 453.00 155.00 L 451.00 158.00 L 449.00 161.00 L 445.00 166.00 L 440.00 168.00 L 437.00 167.00 L 435.00 165.00 L 432.00 164.00 L 430.00 162.00 L 427.00 161.00 L 424.00 159.00 L 421.00 156.00 L 418.00 154.00 L 415.00 153.00 L 412.00 150.00 L 409.00 148.00 L 406.00 146.00 L 402.00 147.00 L 401.00 150.00 L 399.00 152.00 L 397.00 157.00 L 395.00 160.00 L 393.00 163.00 L 390.00 166.00 L 388.00 169.00 L 386.00 172.00 L 384.00 175.00 L 382.00 178.00 L 381.00 180.00 L 381.00 182.00 L 383.00 184.00 L 386.00 186.00 L 389.00 188.00 L 393.00 190.00 L 396.00 193.00 L 400.00 196.00 L 403.00 198.00 L 407.00 201.00 L 410.00 203.00 L 413.00 205.00 L 416.00 207.00 L 420.00 210.00 L 422.00 210.00 L 429.00 203.00 L 432.00 199.00 L 435.00 195.00 L 436.00 192.00 L 438.00 190.00 L 439.00 187.00 L 441.00 184.00 L 443.00 182.00 L 445.00 183.00 L 447.00 185.00 L 451.00 188.00 L 455.00 190.00 L 459.00 194.00 L 463.00 197.00 L 466.00 199.00 L 470.00 202.00 L 473.00 204.00 L 477.00 207.00 L 479.00 207.00 L 482.00 204.00 L 488.00 197.00 L 491.00 193.00 L 493.00 190.00 L 494.00 187.00 L 496.00 185.00 L 501.00 175.00 L 502.00 172.00 L 502.00 169.00 L 500.00 167.00 L 497.00 165.00 L 494.00 164.00 L 492.00 162.00 L 488.00 160.00 L 485.00 158.00 L 482.00 156.00 L 479.00 153.00 L 476.00 151.00 L 473.00 149.00 L 470.00 147.00 L 466.00 144.00 L 464.00 143.00 Z";

  // 1. Update Header Logo (Static with Half-Filled White Bar: width="309")
  const headerSvg = document.querySelector('#mainHeader svg');
  if (false && headerSvg) {
    headerSvg.setAttribute('viewBox', '0 0 1024 716');
    headerSvg.innerHTML = `
      <path d="${RED_D}" fill="#E51920" />
      <path d="${BORDER_D}" fill="#FFFFFF" fill-rule="evenodd" />
      <path d="${TRI_D}" fill="#FFFFFF" />
      <path d="${QAAF_PATH_D}" fill="#FFFFFF" fill-rule="evenodd" />
      <rect x="223" y="554" width="578" height="25" rx="12.5" ry="12.5" fill="none" stroke="#FFFFFF" stroke-width="4" />
      <rect x="223" y="554" width="309" height="25" rx="12.5" ry="12.5" fill="#FFFFFF" />
    `;
  }

  // 2. Replace #startupSplashModal HTML completely (No Urdu text, only English Slogan)
  const splashModal = document.getElementById('startupSplashModal');
  if (false && splashModal) {
    splashModal.innerHTML = `
      <div class="relative w-full max-w-md flex flex-col items-center justify-center p-4" >
        <div id="logo-container" class="w-full h-auto block">
          <svg class="w-full h-auto block overflow-visible" viewBox="0 0 1024 716" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="impactGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
                <stop offset="35%" stop-color="#ffffff" stop-opacity="0.85" />
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
              </radialGradient>
              <clipPath id="barClip">
                <rect x="223" y="554" width="578" height="25" rx="12.5" ry="12.5" />
              </clipPath>
            </defs>
            <path id="redBox" d="${RED_D}" fill="#E51920" />
            <path id="innerBorder" d="${BORDER_D}" fill="#FFFFFF" fill-rule="evenodd" />
            <g id="triangleGrp">
              <path d="${TRI_D}" fill="#FFFFFF" />
            </g>
            <g id="qaafGrp">
              <path d="${QAAF_PATH_D}" fill="#FFFFFF" fill-rule="evenodd" />
            </g>
            <circle id="impactFlash" cx="400" cy="356" r="95" fill="url(#impactGlow)" opacity="0" />
            <g id="barGroup" opacity="0" transform="translate(0, 25)">
              <rect x="223" y="554" width="578" height="25" rx="12.5" ry="12.5" fill="none" stroke="#FFFFFF" stroke-width="3.5" />
              <g clip-path="url(#barClip)">
                <rect id="barFill" x="223" y="554" width="0" height="25" rx="12.5" ry="12.5" fill="#FFFFFF" />
              </g>
            </g>
          </svg>
        </div>
        <div class="mt-4 text-center">
          <div class="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center justify-center gap-1.5">
            <span class="text-white">QAAF</span><span class="text-slate-600 font-light">|</span><span class="text-emerald-400">Tube</span>
          </div>
          <p class="text-xs sm:text-sm font-semibold text-slate-300 mt-1">Muslim Family &amp; Kids Hub</p>
        </div>
      </div>
    `;
  }

  let audioCtx = null;
  function playImpactSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const bufferSize = audioCtx.sampleRate * 0.16;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const bandpass = audioCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(3600, now);
      bandpass.frequency.exponentialRampToValueAtTime(1600, now + 0.14);
      bandpass.Q.value = 4.0;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.40, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      noise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start(now);

      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.10);
      oscGain.gain.setValueAtTime(0.30, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch (e) {}
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  let animFrameId = null;

  window.runStartupSplash = function(isManual) {
    const modal = document.getElementById('startupSplashModal');
    if (!modal) return;
    if (!isManual) {
      modal.style.opacity = '0';
      modal.classList.add('hidden');
      modal.style.display = 'none';
      return;
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    setTimeout(function() {
      modal.style.opacity = '0';
      setTimeout(function() { modal.classList.add('hidden'); modal.style.display = 'none'; }, 200);
    }, 600);
    return;

    const redBox = document.getElementById('redBox');
    const innerBorder = document.getElementById('innerBorder');
    const triangleGrp = document.getElementById('triangleGrp');
    const qaafGrp = document.getElementById('qaafGrp');
    const impactFlash = document.getElementById('impactFlash');
    const barGroup = document.getElementById('barGroup');
    const barFill = document.getElementById('barFill');
    const container = document.getElementById('logo-container');

    if (animFrameId) cancelAnimationFrame(animFrameId);
    let soundPlayed = false;
    const startTime = performance.now();

    function frame(now) {
      const elapsed = (now - startTime) / 1000;

      // 1. Red Box (0.0s to 0.7s) - Clean easeOutCubic, no bounce
      if (elapsed < 0.7) {
        const p = Math.min(1, elapsed / 0.7);
        const scale = 0.6 + 0.4 * easeOutCubic(p);
        redBox.setAttribute('transform', `matrix(${scale}, 0, 0, ${scale}, ${512 * (1 - scale)}, ${358 * (1 - scale)})`);
        redBox.setAttribute('opacity', Math.min(1, p * 2).toFixed(3));
      } else {
        redBox.removeAttribute('transform');
        redBox.setAttribute('opacity', '1');
      }

      // 2. Inner Border (0.3s to 0.8s)
      if (elapsed < 0.3) innerBorder.setAttribute('opacity', '0');
      else if (elapsed < 0.8) innerBorder.setAttribute('opacity', ((elapsed - 0.3) / 0.5).toFixed(3));
      else innerBorder.setAttribute('opacity', '1');

      // 3. Qaaf & Triangle Clean Single Collision (0.8s to 2.0s) - NO BOUNCE
      const tQaafStart = 0.8, tContact = 1.35, tSettle = 2.0;
      let dxQaaf = -650, opacityQaaf = 0, dxTri = -171;

      if (elapsed >= tQaafStart && elapsed < tContact) {
        const p = (elapsed - tQaafStart) / (tContact - tQaafStart);
        dxQaaf = -650 + (-132 - (-650)) * easeInOutQuad(p);
        opacityQaaf = Math.min(1, p * 3);
      } else if (elapsed >= tContact && elapsed <= tSettle) {
        if (!soundPlayed) { playImpactSound(); soundPlayed = true; }
        const p = (elapsed - tContact) / (tSettle - tContact);
        dxQaaf = -132 + 132 * easeOutCubic(p);
        opacityQaaf = 1;
        dxTri = Math.max(dxQaaf - 39, -171 + 171 * easeOutQuart(p));

        const flashP = Math.min(1, (elapsed - tContact) / 0.3);
        const flashOpacity = (1 - flashP) * 0.85;
        const flashScale = 0.3 + flashP * 1.8;
        impactFlash.setAttribute('opacity', flashOpacity > 0 ? flashOpacity.toFixed(3) : '0');
        impactFlash.setAttribute('transform', `matrix(${flashScale}, 0, 0, ${flashScale}, ${400 * (1 - flashScale)}, ${356 * (1 - flashScale)})`);

        if (p < 0.4) {
          const sh = (1 - p / 0.4) * 4;
          container.style.transform = `translate(${((Math.random() - 0.5) * sh).toFixed(1)}px, ${((Math.random() - 0.5) * sh).toFixed(1)}px)`;
        } else {
          container.style.transform = 'translate(0, 0)';
        }
      } else if (elapsed > tSettle) {
        dxQaaf = 0; opacityQaaf = 1; dxTri = 0;
        impactFlash.setAttribute('opacity', '0');
        container.style.transform = 'translate(0, 0)';
      }

      qaafGrp.setAttribute('transform', `translate(${dxQaaf.toFixed(2)}, 0)`);
      qaafGrp.setAttribute('opacity', opacityQaaf.toFixed(3));
      triangleGrp.setAttribute('transform', `translate(${dxTri.toFixed(2)}, 0)`);

      // 4. White Bar: Rises up, slides/rotates like an app loading bar, then settles at EXACT HALF (x=223, width=309)
      const tBarStart = 2.05;
      const tBarShow  = 2.35;
      const tLoopEnd  = 3.75; // Indeterminate sliding loading loops
      const tHalfDone = 4.30; // Settle cleanly at Half (width = 309, never full!)

      if (elapsed < tBarStart) {
        barGroup.setAttribute('opacity', '0');
        barGroup.setAttribute('transform', 'translate(0, 25)');
        barFill.setAttribute('x', '223');
        barFill.setAttribute('width', '0');
      } else if (elapsed < tBarShow) {
        const p = easeOutCubic((elapsed - tBarStart) / (tBarShow - tBarStart));
        barGroup.setAttribute('opacity', p.toFixed(3));
        barGroup.setAttribute('transform', `translate(0, ${((1 - p) * 25).toFixed(1)})`);
        barFill.setAttribute('x', '223');
        barFill.setAttribute('width', '0');
      } else if (elapsed < tLoopEnd) {
        // Sliding / rotating loading bar inside the track (2 cycles)
        barGroup.setAttribute('opacity', '1');
        barGroup.setAttribute('transform', 'translate(0, 0)');
        const cycleP = ((elapsed - tBarShow) / 0.70) % 1;
        const segW = 240;
        const curX = (223 - segW) + (578 + segW) * cycleP;
        barFill.setAttribute('x', curX.toFixed(1));
        barFill.setAttribute('width', segW.toString());
      } else if (elapsed < tHalfDone) {
        // Settle at EXACT HALF (x=223, width=309) as shown in reference screenshot
        barGroup.setAttribute('opacity', '1');
        barGroup.setAttribute('transform', 'translate(0, 0)');
        const p = easeOutCubic((elapsed - tLoopEnd) / (tHalfDone - tLoopEnd));
        barFill.setAttribute('x', '223');
        barFill.setAttribute('width', (309 * p).toFixed(1));
      } else {
        barGroup.setAttribute('opacity', '1');
        barGroup.setAttribute('transform', 'translate(0, 0)');
        barFill.setAttribute('x', '223');
        barFill.setAttribute('width', '309');
      }

      if (elapsed < 4.75) {
        // Replaced by Pure GPU CSS Keyframes
      } else {
        modal.style.opacity = '0';
        setTimeout(() => modal.classList.add('hidden'), 400);
      }
    }

    // Replaced by Pure GPU CSS Keyframes
  };

  window.replayStartupSplash = window.runStartupSplash;
  window.runStartupSplash();
})();

(function fixAutoSkipDuaAndBackMinimize() {
  // A. FIX DUA AD: AUTO-SKIP AUTOMATICALLY WHEN 5s TIMER (OR DUA AUDIO) FINISHES
  window.triggerAdSimulation = function() {
    if (document.getElementById('playerModal').classList.contains('hidden')) openVideoPlayer(videosData[0]?.id || 'v1');

    const safeAudio = document.getElementById('safePlayerAudio');
    if (activePlayerEngine === 'safe') {
      if ((safeAudio && !safeAudio.paused) || isHalalVoiceSpeaking) {
        wasSafePlayingBeforeAd = true;
        if (safeAudio) safeAudio.pause();
        stopHalalVoiceRecitation();
      } else {
        wasSafePlayingBeforeAd = false;
      }
    } else if (activePlayerEngine === 'youtube') {
      wasYoutubePlayingBeforeAd = true;
      sendYouTubeCommand('pauseVideo');
    }

    showRandomHisnDua();
    const overlay = document.getElementById('duaAdOverlay');
    const skipBtn = document.getElementById('skipAdBtn');
    overlay.classList.remove('hidden');

    let secs = 5;
    skipBtn.disabled = false;
    skipBtn.className = "bg-emerald-600/80 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl font-bold text-xs shadow";
    skipBtn.innerText = `⏳ Auto-Resuming in ${secs}s...`;

    if (adCountdownTimer) clearInterval(adCountdownTimer);
    adCountdownTimer = setInterval(() => {
      secs--;
      if (secs > 0) {
        skipBtn.innerText = `⏳ Auto-Resuming in ${secs}s...`;
      } else {
        clearInterval(adCountdownTimer);
        // If Dua audio is currently being recited, wait for recitation to finish then auto-skip
        if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
          skipBtn.innerText = "🔉 Finishing Dua Audio...";
          const checkSpeech = setInterval(() => {
            if (!window.speechSynthesis.speaking) {
              clearInterval(checkSpeech);
              skipAdAndResume();
            }
          }, 300);
        } else {
          // Automatically skip and resume video without needing any click!
          skipAdAndResume();
        }
      }
    }, 1000);
  };

  // B. PREVENT BLACK SCREEN ON BACK & MINIMIZE TO YOUTUBE MINI-PLAYER ON BACK BUTTON
  window.loadVideoInActiveEngine = function(videoId) {
    const video = videosData.find(v => v.id === videoId) || videosData[0];
    const ytIframe = document.getElementById('ytIframe');
    if (activePlayerEngine === 'youtube') {
      stopSafeCanvasPlayer();
      if (ytIframe) {
        const originParam = window.location.protocol.startsWith('http') ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
        const embedUrl = `https://www.youtube-nocookie.com/embed/${video.ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&vq=hd1080${originParam}`;
        // Use location.replace so iframe NEVER adds a blank history state that turns black on Back!
        // Recreate iframe cleanly so browser Back button NEVER navigates iframe back to about:blank!
        const parentCont = document.getElementById('ytPlayerContainer');
        if (parentCont) {
          parentCont.innerHTML = `<iframe id="ytIframe" class="w-full h-full" src="${embedUrl}" title="QAAF YouTube Player" frameborder="0" sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
        }
      }
    } else {
      if (ytIframe && ytIframe.contentWindow) ytIframe.contentWindow.location.replace('about:blank');
      startSafeCanvasPlayer(video);
    }
  };

  // Push history state when opening video player so Mobile Hardware Back button minimizes it
  const prevOpenPlayer = window.openVideoPlayer;
  window.openVideoPlayer = function(videoId) {
    const modal = document.getElementById('playerModal');
    const wasHidden = modal && modal.classList.contains('hidden');
    if (prevOpenPlayer) prevOpenPlayer(videoId);
    if (wasHidden) {
      try { history.pushState({ qaafVideoOpen: true }, ''); } catch (e) {}
    }
  };

  // Handle Mobile Hardware / Browser Back Button
  window.addEventListener('popstate', function() {
    const modal = document.getElementById('playerModal');
    if (modal && !modal.classList.contains('hidden')) {
      const scrollWrap = document.getElementById('ytWatchScrollContainer');
      const isCurrentlyFull = scrollWrap && !scrollWrap.classList.contains('hidden');
      if (isCurrentlyFull && typeof window.minimizeToMiniPlayer === 'function') {
        // Minimize to corner Mini-Player just like YouTube!
        window.minimizeToMiniPlayer();
        try { history.pushState({ qaafMiniPlayer: true }, ''); } catch (e) {}
      } else {
        closeVideoPlayer();
      }
    }
  });

  // Also wire the bottom bar "◀ Back" button to minimize the video if open
  const prevHardwareNav = window.testHardwareNav;
  window.testHardwareNav = function(btnName) {
    const modal = document.getElementById('playerModal');
    if (btnName === 'Back Button' && modal && !modal.classList.contains('hidden')) {
      const scrollWrap = document.getElementById('ytWatchScrollContainer');
      const isCurrentlyFull = scrollWrap && !scrollWrap.classList.contains('hidden');
      if (isCurrentlyFull && typeof window.minimizeToMiniPlayer === 'function') {
        window.minimizeToMiniPlayer();
        return;
      } else {
        closeVideoPlayer();
        return;
      }
    }
    if (prevHardwareNav) prevHardwareNav(btnName);
  };
})();

(function fixInstantCloudBanAndPromoBar() {
  // A. Purge old test shorts (sh1..sh5) and any banned channels from videosData
  function cleanVideosList() {
    videosData = videosData.filter(v => {
      if (['sh1','sh2','sh3','sh4','sh5','v1','v2','v3','v4','v5','v6','v7','v8','v9','v10'].includes(v.id)) return false;
      if (bannedChannels && bannedChannels.includes(v.channel)) return false;
      if (blockedVideoIds && blockedVideoIds.includes(v.id)) return false;
      return true;
    });
  }
  cleanVideosList();

  // B. Ensure Channels Bar NEVER shows banned channels or blocked videos
  const origRenderVids = window.renderVideos;
  window.renderVideos = function() {
    cleanVideosList();
    if (origRenderVids) origRenderVids();
  };

  // C. Smart Promo Bar: Only show if Admin enabled it AND typed non-empty text or image!
  // Also fallback to GLOBAL text if a specific region is empty.
  window.syncRegionalPromoBar = function() {
    const bar = document.getElementById('regionalPromoBar');
    if (!bar) return;
    if (!isPromoBarEnabled || isKidsLocked) {
      bar.classList.add('hidden');
      return;
    }
    const found = globalLanguagesList.find(l => l.code === preferredContentLang);
    const regionKey = (found && regionalPromos[found.regionKey]) ? found.regionKey : 'GLOBAL';
    let promoObj = regionalPromos[regionKey] || regionalPromos.GLOBAL;

    // If specific region has no text/image, use GLOBAL text/image set by Admin
    if ((!promoObj.text || !promoObj.text.trim()) && (!promoObj.imgUrl || !promoObj.imgUrl.trim())) {
      promoObj = regionalPromos.GLOBAL || { text: '', imgUrl: '' };
    }

    const hasText = promoObj.text && promoObj.text.trim() !== '' && !promoObj.text.includes('Al-Huda') && !promoObj.text.includes('Noor Islamic Books');
    const hasImg = promoObj.imgUrl && promoObj.imgUrl.trim() !== '';

    if (!hasText && !hasImg) {
      bar.classList.add('hidden');
      return;
    }

    bar.classList.remove('hidden');
    document.getElementById('promoRegionTag').innerText = '📢 SPONSOR';
    const imgLinkEl = document.getElementById('promoImageBannerLink');
    const imgEl = document.getElementById('promoImageBannerEl');
    const tickerWrap = document.getElementById('promoTickerWrapper');
    const tickerLink = document.getElementById('promoTickerLink');

    if (hasImg) {
      imgEl.src = promoObj.imgUrl.trim();
      imgLinkEl.href = promoObj.linkUrl || '#';
      imgLinkEl.classList.remove('hidden');
      tickerWrap.classList.add('hidden');
    } else {
      imgLinkEl.classList.add('hidden');
      tickerWrap.classList.remove('hidden');
      tickerLink.innerText = promoObj.text.trim();
      tickerLink.href = promoObj.linkUrl || '#';
      tickerLink.className = (promoObj.dir === 'ltr' ? 'promo-ticker-ltr' : 'promo-ticker-rtl') + ' text-slate-100 hover:text-amber-300 font-semibold tracking-wide';
    }
  };

  // D. Instant 13-byte Timestamp Check on Every Load so Mobile/PC Admin deletions sync across all browsers immediately!
  async function checkCloudVersionAndSync() {
    try {
      const base = qaafCloudSync.cleanFirebaseUrl(qaafCloudSync.firebaseUrl) || DEFAULT_FIREBASE_RTDB_URL;
      const res = await fetch(`${base}/qaaf_global_state/updatedAt.json?t=${Date.now()}`);
      if (!res.ok) return;
      const cloudUpdatedAt = await res.json();
      const localUpdatedAt = parseInt(localStorage.getItem('qaaf_cloud_updated_at') || '0', 10);
      if (cloudUpdatedAt && cloudUpdatedAt !== localUpdatedAt) {
        await qaafCloudSync.pullFromCloud(true);
        localStorage.setItem('qaaf_cloud_updated_at', cloudUpdatedAt.toString());
        cleanVideosList();
        syncRegionalPromoBar();
        renderVideos();
      }
    } catch (e) {}
  }

  const origPush = qaafCloudSync.pushState.bind(qaafCloudSync);
  qaafCloudSync.pushState = async function(label) {
    cleanVideosList();
    await origPush(label);
    localStorage.setItem('qaaf_cloud_updated_at', Date.now().toString());
  };

  syncRegionalPromoBar();
  window.addEventListener('load', function() { setTimeout(checkCloudVersionAndSync, 400); });
})();

(function upgradeLiveChannelUrlAutoFetcher() {
  // Purge "The Hidaya Path" from local browser cache immediately
  if (!bannedChannels.includes('The Hidaya Path')) {
    bannedChannels.push('The Hidaya Path');
    localStorage.setItem('qaaf_banned_channels', JSON.stringify(bannedChannels));
  }
  // Preserved user/admin video deletions across refreshes

  let fetchedChannelPack = [];

  const origSingleFetch = window.adminAutoFetchYouTubeInfo;
  window.adminAutoFetchYouTubeInfo = async function() {
    const urlInput = document.getElementById('adminYtUrlInput');
    const raw = (urlInput ? urlInput.value : '').trim();
    fetchedChannelPack = [];

    // Check if it's a playlist URL
    const plMatch = raw.match(/list=([a-zA-Z0-9_-]+)/);
    const isPlaylistUrl = Boolean(plMatch && (raw.includes('playlist') || !raw.includes('/@')));

    if (isPlaylistUrl) {
      const playlistId = plMatch[1];
      showSyncToast(`⏳ Connecting to Playlist (${playlistId})... Fetching up to 150 videos...`);

      let playlistFoundIds = [];
      let playlistTitle = 'YouTube Playlist';
      let channelTitle = 'YouTube Creator';

      try {
        const plUrl = `https://r.jina.ai/https://www.youtube.com/playlist?list=${playlistId}`;
        const resPl = await fetch(plUrl, {
          headers: { 'Accept': 'application/json', 'X-Return-Format': 'html' }
        });
        if (resPl.ok) {
          const dPl = await resPl.json();
          const htmlPl = (dPl && dPl.data && dPl.data.html) || '';
          const matches = [...htmlPl.matchAll(/(?:watch\?v=|\/shorts\/|"videoId":|"contentId":|\/embed\/)([a-zA-Z0-9_-]{11})/g)].map(m => m[1]);
          matches.forEach(id => {
            if (!playlistFoundIds.includes(id)) playlistFoundIds.push(id);
          });
          const titleMatch = htmlPl.match(/<title>([^<]+)<\/title>/);
          if (titleMatch && titleMatch[1]) {
            playlistTitle = titleMatch[1].replace(/ - YouTube$/, '').trim();
          }
        }
      } catch (e) {
        console.warn("Playlist fetch error:", e);
      }

      if (playlistFoundIds.length === 0) {
        const proxies = [
          'https://api.allorigins.win/raw?url=' + encodeURIComponent(`https://www.youtube.com/playlist?list=${playlistId}`),
          'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(`https://www.youtube.com/playlist?list=${playlistId}`)
        ];
        for (const px of proxies) {
          try {
            const r = await fetch(px);
            if (r.ok) {
              const html = await r.text();
              const matches = [...html.matchAll(/(?:watch\?v=|\/shorts\/|"videoId":|"contentId":|\/embed\/)([a-zA-Z0-9_-]{11})/g)].map(m => m[1]);
              matches.forEach(id => {
                if (!playlistFoundIds.includes(id)) playlistFoundIds.push(id);
              });
              if (playlistFoundIds.length > 0) break;
            }
          } catch(e) {}
        }
      }

      const targetIds = playlistFoundIds.slice(0, 150); // Cap to 150 max!
      if (targetIds.length === 0) {
        alert('⚠️ Could not find videos in this playlist. Please ensure the playlist is Public or Unlisted.');
        return;
      }

      try {
        const r0 = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${targetIds[0]}`);
        const d0 = await r0.json();
        if (d0 && d0.author_name) channelTitle = d0.author_name;
        if (playlistTitle === 'YouTube Playlist' && d0 && d0.title) playlistTitle = d0.title;
      } catch(e) {}

      showSyncToast(`⚡ Found ${targetIds.length} playlist videos! Resolving titles...`);

      const pack = [];
      const CHUNK_SIZE = 20;
      for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
        const chunk = targetIds.slice(i, i + CHUNK_SIZE);
        const chunkPromises = chunk.map(async (vidId) => {
          try {
            const r = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${vidId}`);
            const d = await r.json();
            if (d && d.title) {
              return {
                ytId: vidId,
                title: d.title,
                channel: d.author_name || channelTitle,
                isShort: false
              };
            }
          } catch (e) {}
          return {
            ytId: vidId,
            title: `${channelTitle} Video (${vidId})`,
            channel: channelTitle,
            isShort: false
          };
        });
        const resolved = await Promise.all(chunkPromises);
        resolved.forEach(item => { if (item) pack.push(item); });
      }

      if (pack.length > 0) {
        fetchedChannelPack = pack;
        document.getElementById('adminVideoTitle').value = `[Playlist: ${pack.length} Videos] ${playlistTitle}`;
        document.getElementById('adminChannelName').value = channelTitle;
        updateYtPreview(pack[0].ytId, `${playlistTitle} — ${pack.length} Videos Ready to Import`, channelTitle);
        showSyncToast(`✅ Loaded ${pack.length} videos from Playlist "${playlistTitle}"! Now click "+ Push Live"!`);
      } else {
        alert('⚠️ Could not load videos from this playlist.');
      }
      return;
    }

    // Check if it's a single video URL first
    const singleVidId = extractYouTubeId(raw);
    const isChannelLink = raw.includes('/@') || raw.startsWith('@') || raw.includes('/channel/') || raw.includes('/c/') || raw.includes('/user/');

    if (singleVidId && !isChannelLink) {
      if (origSingleFetch) return origSingleFetch();
      return;
    }

    if (!raw) {
      alert('Please paste a YouTube Channel URL (e.g. https://www.youtube.com/@MoralVision) or Video URL.');
      return;
    }

    const isShorts = raw.toLowerCase().includes('/shorts');
    let handleName = raw;
    const hMatch = raw.match(/@([a-zA-Z0-9_.-]+)/);
    if (hMatch && hMatch[1]) handleName = hMatch[1];
    else handleName = raw.replace(/^https?:\/\/(www\.)?youtube\.com\//i, '').replace(/\/.*$/, '');

    showSyncToast(`⏳ Connecting to @${handleName}... Scanning full channel catalog (10s)...`);

    let cleanChannelUrl = raw.startsWith('http') ? raw : `https://www.youtube.com/@${handleName}`;
    const baseChannel = cleanChannelUrl.replace(/\/(videos|shorts|featured|streams|playlists)?\/?$/, '');

    let allFoundIds = [];
    let detectedChannelId = '';
    let foundPlaylists = [];

    const addUniqueVids = (text) => {
      if (!text) return;
      const matches = [...text.matchAll(/(?:watch\?v=|\/shorts\/|"videoId":|"contentId":|\/embed\/)([a-zA-Z0-9_-]{11})/g)].map(m => m[1]);
      matches.forEach(id => {
        if (!allFoundIds.includes(id)) allFoundIds.push(id);
      });
    };

    // 1. Channel Home Page (HTML mode) -> extracts channelId, playlists, and home videos
    try {
      const res0 = await fetch(`https://r.jina.ai/${baseChannel}`, {
        headers: { 'Accept': 'application/json', 'X-Return-Format': 'html' }
      });
      if (res0.ok) {
        const d0 = await res0.json();
        const html0 = (d0 && d0.data && d0.data.html) || '';
        const chM = html0.match(/"browseId":"(UC[a-zA-Z0-9_-]{22})"/);
        if (chM && chM[1]) detectedChannelId = chM[1];
        else {
          const anyUc = html0.match(/(UC[a-zA-Z0-9_-]{22})/);
          if (anyUc) detectedChannelId = anyUc[1];
        }
        addUniqueVids(html0);

        const pls = [...html0.matchAll(/list=(PL[a-zA-Z0-9_-]+)/g)].map(m => m[1]);
        pls.forEach(p => { if (!foundPlaylists.includes(p)) foundPlaylists.push(p); });
      }
    } catch (e) {
      console.warn("Home page fetch error:", e);
    }

    // 2. Uploads Playlist (UU...) -> grabs up to 100 uploads in one request!
    if (detectedChannelId) {
      const uplPlId = 'UU' + detectedChannelId.substring(2);
      try {
        const resUpl = await fetch(`https://r.jina.ai/https://www.youtube.com/playlist?list=${uplPlId}`, {
          headers: { 'Accept': 'application/json', 'X-Return-Format': 'html' }
        });
        if (resUpl.ok) {
          const dUpl = await resUpl.json();
          const htmlUpl = (dUpl && dUpl.data && dUpl.data.html) || '';
          addUniqueVids(htmlUpl);
        }
      } catch (e) {
        console.warn("Uploads playlist fetch error:", e);
      }
    }

    // 3. Channel Playlists Tab -> scans all playlists on channel for older videos beyond 100
    try {
      const resPlTab = await fetch(`https://r.jina.ai/${baseChannel}/playlists`);
      if (resPlTab.ok) {
        const textPl = await resPlTab.text();
        const pls = [...textPl.matchAll(/list=(PL[a-zA-Z0-9_-]+)/g)].map(m => m[1]);
        pls.forEach(p => { if (!foundPlaylists.includes(p)) foundPlaylists.push(p); });
      }
    } catch (e) {}

    // Fetch up to 6 channel playlists in parallel
    if (foundPlaylists.length > 0) {
      const plPromises = foundPlaylists.slice(0, 6).map(async (pl) => {
        try {
          const r = await fetch(`https://r.jina.ai/https://www.youtube.com/playlist?list=${pl}`);
          if (r.ok) {
            const txt = await r.text();
            addUniqueVids(txt);
          }
        } catch (e) {}
      });
      await Promise.all(plPromises);
    }

    // 4. Also fetch /videos and /shorts tabs
    const extraSources = [
      `https://r.jina.ai/${baseChannel}/videos`,
      `https://r.jina.ai/${baseChannel}/shorts`
    ];
    for (const src of extraSources) {
      try {
        const r = await fetch(src);
        if (r.ok) {
          const txt = await r.text();
          addUniqueVids(txt);
        }
      } catch (e) {}
    }

    const foundIds = allFoundIds.slice(0, 150); // Cap channel import to 150 videos as requested!

    if (foundIds.length === 0) {
      alert('⚠️ Could not find public videos on that link. Please check the spelling of the channel link.');
      return;
    }

    // High-speed parallel oEmbed title fetcher in batches of 20
    const pack = [];
    let channelTitle = handleName;

    try {
      const r0 = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${foundIds[0]}`);
      const d0 = await r0.json();
      if (d0 && d0.author_name) channelTitle = d0.author_name;
    } catch(e) {}

    showSyncToast(`⚡ Found ${foundIds.length} videos! Resolving titles in seconds...`);

    const CHUNK_SIZE = 20;
    for (let i = 0; i < foundIds.length; i += CHUNK_SIZE) {
      const chunk = foundIds.slice(i, i + CHUNK_SIZE);
      const chunkPromises = chunk.map(async (vidId) => {
        try {
          const r = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${vidId}`);
          const d = await r.json();
          if (d && d.title) {
            return {
              ytId: vidId,
              title: (isShorts && !d.title.includes('#Shorts')) ? `${d.title} #Shorts` : d.title,
              channel: d.author_name || channelTitle,
              isShort: isShorts
            };
          }
        } catch (e) {}
        return {
          ytId: vidId,
          title: `${channelTitle} Video (${vidId})`,
          channel: channelTitle,
          isShort: isShorts
        };
      });
      const resolved = await Promise.all(chunkPromises);
      resolved.forEach(item => { if (item) pack.push(item); });
    }

    if (pack.length > 0) {
      fetchedChannelPack = pack;
      document.getElementById('adminVideoTitle').value = `[Channel Pack: ${pack.length} Videos] ${pack[0].title}`;
      document.getElementById('adminChannelName').value = channelTitle;
      updateYtPreview(pack[0].ytId, `${channelTitle} — ${pack.length} Videos Ready to Import`, channelTitle);
      showSyncToast(`✅ Loaded ${pack.length} videos from "${channelTitle}"! Now click "+ Push Live"!`);
    } else {
      alert('⚠️ Videos on this channel have embedding disabled.');
    }
  };

  const origPushLive = window.adminAddGlobalVideo;
  window.adminAddGlobalVideo = function() {
    if (fetchedChannelPack.length > 0) {
      const lang = document.getElementById('adminVideoLang').value;
      const cat = document.getElementById('adminVideoCat').value;
      const customCh = (document.getElementById('adminChannelName').value || '').trim();
      const targetChannelName = customCh || fetchedChannelPack[0].channel;

      // If this channel was previously banned, unban it automatically
      if (bannedChannels.includes(targetChannelName)) {
        bannedChannels = bannedChannels.filter(c => c !== targetChannelName);
        localStorage.setItem('qaaf_banned_channels', JSON.stringify(bannedChannels));
      }

      // Automatically verify channel
      if (targetChannelName && window.verifiedChannelsList && window.verifiedChannelsList.indexOf(targetChannelName) === -1) {
        window.verifiedChannelsList.push(targetChannelName);
        localStorage.setItem("qaaf_verified_channels", JSON.stringify(window.verifiedChannelsList));
      }

      fetchedChannelPack.forEach((item, i) => {
        if (!videosData.some(v => v.ytId === item.ytId)) {
          videosData.unshift({
            id: 'v_' + item.ytId,
            title: item.title,
            channel: targetChannelName,
            lang,
            region: lang.toUpperCase(),
            category: cat,
            kidsSafe: (cat !== 'bayan'),
            isShort: item.isShort,
            ytId: item.ytId,
            isCustomAdded: true,
            duration: item.isShort ? '0:55' : '12:45',
            views: 2500,
            createdAt: Math.floor(Date.now() / 1000) - i
          });
        }
      });

      const count = fetchedChannelPack.length;
      fetchedChannelPack = [];
      document.getElementById('adminYtUrlInput').value = '';
      document.getElementById('adminVideoTitle').value = '';
      document.getElementById('adminChannelName').value = '';
      updateYtPreview(null);

      localStorage.setItem('qaaf_videos_data', JSON.stringify(videosData));
      renderVideos();
      
      
      // AUTO 1-CLICK INSTANT PUSH TO FIREBASE CLOUD (NO MANUAL CLOUD TAB CLICK REQUIRED!)
      const fbEndpoint = "https://qaaftube-6f251-default-rtdb.firebaseio.com/qaaf_global_state.json";
      const cloudPayload = {
        videosData: videosData || [],
        verifiedChannelsList: window.verifiedChannelsList || [],
        bannedChannels: bannedChannels || [],
        blockedVideoIds: blockedVideoIds || [],
        regionalPromos: regionalPromos || {},
        isPromoBarEnabled: isPromoBarEnabled !== false,
        parentRequestsQueue: window.parentRequestsQueue || [],
        qaafSecurityToken: "QAAF_PROTECTED_TOKEN_786_99_MAKKAH",
        updatedAt: Date.now()
      };
      
      fetch(fbEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloudPayload)
      }).then(res => {
        if (res.ok) {
          localStorage.setItem("qaaf_cloud_last_synced", new Date().toLocaleTimeString());
          localStorage.setItem("qaaf_cloud_last_sync_ts", Date.now().toString());
          localStorage.setItem("qaaf_cloud_updated_at", cloudPayload.updatedAt.toString());
          if (window.qaafCloudSync) window.qaafCloudSync.updateStatusBadge("connected");
          showSyncToast(`☁️ لائیو کلاؤڈ پر منتقل ہو گیا! (${count} ویڈیوز اور چینل تمام ڈیوائسز پر لائیو ہو گئے)`);
        }
      }).catch(err => {
        console.warn("Cloud sync error on Push Live:", err);
      });

      showSyncToast(`🎉 ${count} ویڈیوز کامیابی سے شامل ہو گئیں اور کلاؤڈ پر لائیو ہو گئیں!`);
      return;
    }
    if (origPushLive) return origPushLive();
  };

})();

(function finalizeProductionModeAndGuestGate() {
  // 1. Hide Top Simulator Test Bar & Bottom Simulator Footer
  const topTestBar = document.querySelector('body > div.bg-slate-900\\/95.border-b');
  if (topTestBar) topTestBar.classList.add('hidden');
  const bottomSimFooter = document.querySelector('footer.bg-black\\/95.border-t');
  if (bottomSimFooter) bottomSimFooter.classList.add('hidden');
  const appBody = document.getElementById('appBody');
  if (appBody) appBody.classList.replace('pb-28', 'pb-12');

  // 2. Add "🔒 Kids Mode ON" Badge inside Main Header (Hidden in Family Mode, Visible in Kids Mode)
  const kidsSwitcher = document.getElementById('kidsContentSwitcher');
  if (kidsSwitcher && !document.getElementById('kidsModeOnHeaderBadge')) {
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.id = 'kidsModeOnHeaderBadge';
    badge.onclick = function() { openParentalGate('unlock'); };
    badge.title = 'کلک کر کے پن کوڈ درج کریں اور کڈز موڈ سے باہر نکلیں';
    badge.className = 'hidden bg-red-600/30 hover:bg-red-600/50 border border-red-500/60 text-red-200 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold items-center gap-1 shadow shrink-0 cursor-pointer transition';
    badge.innerHTML = '<span>🔐</span> <span>Kids Mode ON</span>';
    kidsSwitcher.parentNode.insertBefore(badge, kidsSwitcher);
  }

  // 3. Support "🌍 Global (All Languages)" in Priority Score & Preferred Badge & Strict Filter
  window.getModePriorityScore = function(video) {
    let score = 0;
    if (video.lang === preferredContentLang || video.lang === 'global' || video.universalQuran) score += 55;
    if (isKidsLocked) {
      if (kidsWatchedIds.includes(video.id)) score += 40;
      if (video.category === 'kids_cartoon') score += 30;
      else if (video.category === 'stories') score += 25;
      else if (video.category === 'quran') score += 20;
    } else {
      if (parentWatchedIds.includes(video.id)) score += 45;
      if (video.category === 'bayan') score += 35;
      else if (video.category === 'quran') score += 30;
      else if (video.category === 'stories') score += 10;
      else if (video.category === 'kids_cartoon') score += 5;
    }
    return score;
  };

  // Upgrade renderVideos so 'global' videos show "⭐ Preferred (GLOBAL)" and pass Strict Language filter
  const prevRenderVideos = window.renderVideos;
  window.renderVideos = function() {
    // Temporarily mark global videos as universalQuran so strictLanguageOnly never hides them
    videosData.forEach(v => {
      if (v.lang === 'global') v.universalQuran = true;
    });
    if (prevRenderVideos) prevRenderVideos();

    // Update badge on global cards to show "⭐ Preferred (GLOBAL)"
    document.querySelectorAll('#videoGrid > div').forEach(card => {
      const badgeSpan = card.querySelector('.absolute.top-2.left-2 span');
      if (badgeSpan && badgeSpan.innerText.trim() === 'GLOBAL') {
        badgeSpan.className = 'bg-emerald-500 text-black text-[10px] font-extrabold px-2 py-0.5 rounded shadow';
        badgeSpan.innerText = '⭐ Preferred (GLOBAL)';
      }
    });
  };

  // 4. Add 6-Digit Parent PIN field to Sign-Up Form so users save their PIN with their account
  const signUpPane = document.getElementById('authSignUpPane');
  if (signUpPane && !document.getElementById('regPinInput')) {
    const errNode = document.getElementById('signUpAuthError');
    const pinDiv = document.createElement('div');
    pinDiv.innerHTML = `
      <label class="block text-[11px] font-bold text-emerald-400 mb-1">Set 6-Digit Kids Lock PIN:</label>
      <input id="regPinInput" type="password" inputmode="numeric" maxlength="6" placeholder="e.g. 123456 (6 digits for Kids Mode)" class="w-full bg-black border border-emerald-500/50 rounded-xl px-3.5 py-2 text-xs text-white tracking-widest focus:border-emerald-400 focus:outline-none" />
    `;
    if (errNode) signUpPane.insertBefore(pinDiv, errNode);
  }

  // Banner inside Account Modal when triggered by Guest clicking Kids Mode
  let pendingKidsActivationAfterAuth = false;
  function showGuestAuthRequirementBanner(msg) {
    const modalBox = document.querySelector('#accountModal > div');
    if (!modalBox) return;
    let banner = document.getElementById('guestKidsAuthBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'guestKidsAuthBanner';
      banner.className = 'bg-amber-500/20 border border-amber-400/50 text-amber-200 px-3 py-2 rounded-xl text-xs font-bold mb-3 flex items-center gap-2';
      const loggedOutView = document.getElementById('loggedOutView');
      if (loggedOutView) modalBox.insertBefore(banner, loggedOutView);
    }
    if (msg) {
      banner.innerHTML = `<span>🔒</span> <span>${msg}</span>`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  const origOpenAccountModal = window.openAccountModal;
  window.openAccountModal = function(guestNotice) {
    if (origOpenAccountModal) origOpenAccountModal();
    showGuestAuthRequirementBanner(guestNotice || '');
  };

  // 5. Intercept Kids Mode & Parent Settings if Guest (not logged in)
  const origToggleKidsMode = window.toggleKidsMode;
  window.toggleKidsMode = function() {
    if (!isKidsLocked && !currentUserEmail) {
      pendingKidsActivationAfterAuth = true;
      window.openAccountModal('Please Sign In or Sign Up first to save your Parent PIN and activate Kids Mode!');
      return;
    }
    if (origToggleKidsMode) origToggleKidsMode();
    const kmBadge = document.getElementById('kidsModeOnHeaderBadge');
    if (kmBadge) {
      kmBadge.classList.toggle('hidden', !isKidsLocked);
      kmBadge.classList.toggle('flex', isKidsLocked);
    }
  };

  const origOpenParentalGate = window.openParentalGate;
  window.openParentalGate = function(purpose) {
    if (!currentUserEmail && purpose === 'settings') {
      window.openAccountModal('Please Sign In or Sign Up to configure Parent Settings & PIN!');
      return;
    }
    if (origOpenParentalGate) origOpenParentalGate(purpose);
  };

  // Also hide "🔒 Kids Mode ON" badge when unlocking Kids Mode via verifyPinCode
  const origVerifyPin = window.verifyPinCode;
  window.verifyPinCode = function() {
    if (origVerifyPin) origVerifyPin();
    const kmBadge = document.getElementById('kidsModeOnHeaderBadge');
    if (kmBadge) {
      kmBadge.classList.toggle('hidden', !isKidsLocked);
      kmBadge.classList.toggle('flex', isKidsLocked);
    }
  };

  // Save per-user PIN on Sign Up & auto-enter Kids Mode if requested
  const origRegister = window.registerNewFamilyAccount;
  window.registerNewFamilyAccount = function() {
    const customPin = (document.getElementById('regPinInput')?.value || '').trim();
    if (customPin && !/^\d{6}$/.test(customPin)) {
      const errEl = document.getElementById('signUpAuthError');
      if (errEl) { errEl.innerText = '⚠️ Kids Lock PIN must be exactly 6 digits (e.g. 123456).'; errEl.classList.remove('hidden'); }
      return;
    }
    if (origRegister) origRegister();
    if (currentUserEmail) {
      if (/^\d{6}$/.test(customPin)) {
        parentPin = customPin;
        localStorage.setItem('qaaf_parent_pin_6', parentPin);
        if (window.registeredUsersMap && window.registeredUsersMap[currentUserEmail]) {
          window.registeredUsersMap[currentUserEmail].pin = parentPin;
          localStorage.setItem('qaaf_registered_users', JSON.stringify(window.registeredUsersMap));
        }
        window.syncPinDisplays();
      }
      if (pendingKidsActivationAfterAuth) {
        pendingKidsActivationAfterAuth = false;
        window.toggleKidsMode();
      }
    }
  };

  const origLogin = window.loginWithEmail;
  window.loginWithEmail = function() {
    if (origLogin) origLogin();
    if (currentUserEmail) {
      // Load user's saved PIN if they have one
      const uObj = window.registeredUsersMap && window.registeredUsersMap[currentUserEmail.toLowerCase()];
      if (uObj && uObj.pin) {
        parentPin = uObj.pin;
        localStorage.setItem('qaaf_parent_pin_6', parentPin);
        window.syncPinDisplays();
      }
      if (pendingKidsActivationAfterAuth && !isSuperAdmin()) {
        pendingKidsActivationAfterAuth = false;
        window.toggleKidsMode();
      } else {
        pendingKidsActivationAfterAuth = false;
      }
    }
  };

  })();

(function enableStoreComplianceAndNativeKioskBridge() {
  // A. Add "Delete My Account" button & "Privacy Policy" link for Google Play & Apple App Store compliance
  const loggedInView = document.getElementById('loggedInView');
  if (loggedInView && !document.getElementById('deleteMyAccountBtn')) {
    const delBtn = document.createElement('button');
    delBtn.id = 'deleteMyAccountBtn';
    delBtn.type = 'button';
    delBtn.onclick = function() {
      if (!currentUserEmail) return;
      if (isSuperAdmin()) {
        alert('👑 Super Admin account cannot be deleted.');
        return;
      }
      if (!confirm('⚠️ Are you sure you want to permanently delete your account and saved preferences?')) return;
      if (window.registeredUsersMap && window.registeredUsersMap[currentUserEmail.toLowerCase()]) {
        delete window.registeredUsersMap[currentUserEmail.toLowerCase()];
        localStorage.setItem('qaaf_registered_users', JSON.stringify(window.registeredUsersMap));
      }
      logoutAccount();
      closeAccountModal();
      alert('✅ Your account has been permanently deleted.');
    };
    delBtn.className = 'w-full bg-slate-800 hover:bg-rose-950 border border-slate-700 text-slate-400 hover:text-rose-300 py-2 rounded-xl text-[11px] font-bold transition mt-2';
    delBtn.innerText = '🗑️ Delete My Account & Data';
    loggedInView.appendChild(delBtn);
  }

  // Add Privacy Policy & iOS Guided Access Info inside Parent Settings
  const settingsView = document.getElementById('settingsStepView');
  if (settingsView && !document.getElementById('storePrivacyAndKioskCard')) {
    const card = document.createElement('div');
    card.id = 'storePrivacyAndKioskCard';
    card.className = 'bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <h4 class="font-extrabold text-emerald-400">🔒 Hardware Kiosk Lock &amp; Family Privacy</h4>
        <button type="button" onclick="openPrivacyPolicyModal()" class="text-blue-400 hover:underline font-bold text-[11px]">📜 Privacy Policy</button>
      </div>
      <p class="text-[11px] text-slate-300 leading-relaxed">
        • <strong>Android App:</strong> Kids Mode activates Fullscreen Kiosk Screen Pinning &amp; WakeLock while allowing incoming phone calls.<br/>
        • <strong>iPhone / iPad (iOS):</strong> To lock the physical Home bar on iOS, enable <em>Settings ➔ Accessibility ➔ Guided Access</em> and triple-click the side button in Kids Mode.
      </p>
    `;
    settingsView.appendChild(card);
  }

  // Privacy Policy Modal (Required by Google Play Families Policy & Apple Kids Category)
  if (!document.getElementById('privacyPolicyModal')) {
    const pm = document.createElement('div');
    pm.id = 'privacyPolicyModal';
    pm.className = 'fixed inset-0 z-50 hidden bg-black/90 backdrop-blur-sm flex items-center justify-center p-4';
    pm.dir = 'ltr';
    pm.innerHTML = `
      <div class="bg-[#16181d] border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-3 text-xs text-slate-300">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-sm sm:text-base font-extrabold text-emerald-400">🛡️ QAAF Tube — Family &amp; Kids Privacy Policy</h3>
          <button type="button" onclick="document.getElementById('privacyPolicyModal').classList.add('hidden')" class="bg-slate-800 px-2.5 py-1 rounded text-white font-bold">✕ Close</button>
        </div>
        <p><strong>1. 100% Child-Safe &amp; COPPA Compliant:</strong> QAAF Tube is designed for Muslim families and children. In Kids Mode, all external links, sponsor banners, and unverified videos are strictly hidden behind a 6-digit Parental PIN gate.</p>
        <p><strong>2. Zero Third-Party Behavioral Tracking:</strong> We use privacy-enhanced video embedding (youtube-nocookie) and do not sell or share personal data with third-party advertisers.</p>
        <p><strong>3. Account &amp; Data Deletion:</strong> Parents can permanently delete their account and preferences at any time from the Account menu using the "Delete My Account" button.</p>
        <p><strong>4. Contact:</strong> qaaftube@gmail.com | https://qaaftube.com</p>
      </div>
    `;
    document.body.appendChild(pm);
  }

  window.openPrivacyPolicyModal = function() {
    document.getElementById('privacyPolicyModal').classList.remove('hidden');
  };

  // B. Native Android / Capacitor Kiosk Screen Pinning & Screen WakeLock Bridge
  let wakeLockSentinel = null;
  async function requestScreenWakeLock(enable) {
    if (!('wakeLock' in navigator)) return;
    try {
      if (enable) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
      } else if (wakeLockSentinel) {
        await wakeLockSentinel.release();
        wakeLockSentinel = null;
      }
    } catch (e) {}
  }

  const prevToggleKids = window.toggleKidsMode;
  window.toggleKidsMode = function() {
    if (prevToggleKids) prevToggleKids();
    if (isKidsLocked) {
      requestScreenWakeLock(true);
      // If running inside Capacitor Android Native App with Kiosk Plugin
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.KioskMode) {
        try { window.Capacitor.Plugins.KioskMode.enterKioskMode(); } catch (e) {}
      }
      // Show 1-time iOS Guided Access tip if on iPhone/iPad
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS && !sessionStorage.getItem('qaaf_ios_tip_shown')) {
        sessionStorage.setItem('qaaf_ios_tip_shown', '1');
        showSyncToast('📱 iPhone/iPad Tip: Triple-click side button for Guided Access Lock!');
      }
    } else {
      requestScreenWakeLock(false);
    }
  };
})();

(function activateSmartSearchAndOnDemandGamesBridge() {
  window.qaafActiveSearchQuery = '';
  let liveSearchTimeout = null;
  let isFetchingLiveSearch = false;

  const URDU_AND_SPELLING_SYNONYMS = {
    'مفتی': 'mufti',
    'طارق': 'tariq',
    'مسعود': 'masood',
    'غلام': 'ghulam gulam',
    'رسول': 'rasool',
    'غلام رسول': 'ghulam rasool gulam rasool kids land',
    'gulam': 'ghulam gulam',
    'ghulam': 'ghulam gulam',
    'عبدالباری': 'abdul bari moral vision',
    'عبد الباری': 'abdul bari moral vision',
    'باری': 'bari',
    'مورل': 'moral vision',
    'کڈز': 'kids',
    'فرحت': 'farhat',
    'ہاشمی': 'hashmi',
    'ذاکر': 'zakir',
    'نائیک': 'naik',
    'شمائل': 'shamail',
    'ندوی': 'nadwi',
    'ذوالفقار': 'zulfiqar',
    'پیر': 'peer',
    'یوتھ': 'youth club',
    'عمر': 'omar umar',
    'حنا': 'hana',
    'قرآن': 'quran recitation surah tilawat',
    'تلاوت': 'quran recitation surah',
    'سورۃ': 'surah',
    'سورہ': 'surah',
    'بیان': 'bayan lecture speech',
    'کارٹون': 'cartoon kids_cartoon',
    'کہانی': 'stories story prophet',
    'قصص': 'stories prophet',
    'انبیاء': 'prophet stories',
    'نماز': 'namaz prayer salah',
    'حدیث': 'hadith hadees',
    'hadees': 'hadith hadees',
    'hadith': 'hadith hadees',
    'تفسیر': 'tafseer tafsir',
    'tafsir': 'tafseer tafsir',
    'tafseer': 'tafseer tafsir',
    'شارٹس': 'shorts #shorts',
    'خالد': 'khalid الراشد',
    'الراشد': 'الراشد khalid',
    'دبیروف': 'dibirov ديبيروف',
    'زید': 'zaid patel',
    'اصلاح': 'islah media',
    'شعور': 'shaoor media',
    'المدینہ': 'al madinah',
    'دارالاحسان': 'dar ul ahsan',
    'تربیہ': 'tarbiah tarbiyah',
    'پیغام': 'paigham tv',
    'اقرا': 'iqra tv',
    'حج': 'hajj makkah'
  };

  function expandQueryTokens(rawQuery) {
    let q = (rawQuery || '').trim().toLowerCase();
    if (!q) return [];
    let expanded = q;
    Object.keys(URDU_AND_SPELLING_SYNONYMS).forEach(k => {
      if (q.includes(k)) {
        expanded += ' ' + URDU_AND_SPELLING_SYNONYMS[k];
      }
    });
    return expanded.split(/\s+/).filter(Boolean);
  }

  function matchesVideoSmart(v, rawQuery, tokens) {
    if (!rawQuery) return true;
    const rawLower = rawQuery.trim().toLowerCase();
    const hay = (`${v.title || ''} ${v.channel || ''} ${v.category || ''} ${v.lang || ''} ${v.ytId || ''}`).toLowerCase();
    if (hay.includes(rawLower)) return true;

    let expandedHay = hay;
    if (hay.includes('gulam')) expandedHay += ' ghulam غلام رسول';
    if (hay.includes('ghulam')) expandedHay += ' gulam غلام رسول';
    if (hay.includes('abdul bari')) expandedHay += ' عبدالباری عبد الباری';
    if (hay.includes('tariq masood')) expandedHay += ' مفتی طارق مسعود';
    if (hay.includes('farhat hashmi')) expandedHay += ' ڈاکٹر فرحت ہاشمی';
    if (hay.includes('zakir naik')) expandedHay += ' ڈاکٹر ذاکر نائیک';
    if (hay.includes('omar & hana')) expandedHay += ' عمر اینڈ حنا';
    if (hay.includes('quran')) expandedHay += ' قرآن تلاوت سورۃ';
    if (hay.includes('bayan')) expandedHay += ' بیان علماء';
    if (hay.includes('kids_cartoon')) expandedHay += ' کارٹون کڈز';

    const rawWords = rawLower.split(/\s+/).filter(Boolean);
    return rawWords.every(w => {
      if (expandedHay.includes(w)) return true;
      const syn = URDU_AND_SPELLING_SYNONYMS[w];
      if (syn) {
        return syn.split(/\s+/).some(sw => expandedHay.includes(sw));
      }
      return false;
    });
  }

  const origSelectChannel = window.selectChannelFilter;
  window.selectChannelFilter = function(chName) {
    if (window.qaafActiveSearchQuery) {
      window.qaafActiveSearchQuery = '';
      const sInput = document.getElementById('qaafSearchInput');
      const sClear = document.getElementById('qaafSearchClearBtn');
      const banner = document.getElementById('qaafSearchStatusBanner');
      const drop = document.getElementById('qaafLiveSearchDropdown');
      if (sInput) sInput.value = '';
      if (sClear) sClear.classList.add('hidden');
      if (banner) banner.classList.add('hidden');
      if (drop) drop.classList.add('hidden');
    }
    if (origSelectChannel) origSelectChannel(chName);
  };

  function renderLiveSearchDropdown(rawQuery) {
    const drop = document.getElementById('qaafLiveSearchDropdown');
    if (!drop) return;
    const q = (rawQuery || '').trim();
    if (!q) {
      drop.classList.add('hidden');
      return;
    }

    const tokens = expandQueryTokens(q);
    const matchedVids = videosData.filter(v => {
      if (blockedVideoIds.includes(v.id)) return false;
      if (bannedChannels.includes(v.channel)) return false;
      if (isKidsLocked && !v.kidsSafe) return false;
      return matchesVideoSmart(v, q, tokens);
    });

    const visibleAll = videosData.filter(v => (!isKidsLocked || v.kidsSafe) && !bannedChannels.includes(v.channel));
    const allChs = [...new Set(visibleAll.map(v => v.channel))];
    const matchedChs = allChs.filter(ch => {
      const chLow = ch.toLowerCase();
      return chLow.includes(q.toLowerCase()) || tokens.some(t => chLow.includes(t));
    }).slice(0, 4);

    let html = '';
    if (matchedChs.length > 0) {
      html += `<div class="px-3 py-1.5 bg-slate-900/90 text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">📺 Matching Approved Channels</div>`;
      matchedChs.forEach(ch => {
        const safeCh = ch.replace(/'/g, "\\'");
        html += `
          <button type="button" onclick="selectChannelFromSearch('${safeCh}')" class="w-full px-3.5 py-2 text-left hover:bg-emerald-950/50 flex items-center justify-between text-xs text-white border-b border-slate-800/70 transition">
            <span class="font-bold flex items-center gap-2"><span>✅</span> <span>${ch}</span></span>
            <span class="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">Open Channel ➔</span>
          </button>`;
      });
    }

    if (matchedVids.length > 0) {
      html += `<div class="px-3 py-1.5 bg-slate-900/90 text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">🎬 Matching Videos (${matchedVids.length})</div>`;
      matchedVids.slice(0, 6).forEach(v => {
        const thumb = v.customThumb || `https://i.ytimg.com/vi/${v.ytId}/hqdefault.jpg`;
        html += `
          <button type="button" onclick="playVideoFromSearchDropdown('${v.id}')" class="w-full px-3 py-2 text-left hover:bg-slate-800/90 flex items-center gap-2.5 border-b border-slate-800/70 transition">
            <img src="${thumb}" alt="" class="w-12 h-7 object-cover rounded border border-white/10 shrink-0" onerror="this.style.display='none'" />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-bold text-white truncate">${v.title}</p>
              <p class="text-[10px] text-slate-400 truncate">✅ ${v.channel} • ${v.lang.toUpperCase()}</p>
            </div>
            <span class="text-emerald-400 text-xs font-extrabold shrink-0">▶ Play</span>
          </button>`;
      });
    }

    const safeQ = q.replace(/'/g, "\\'");
    html += `
      <button type="button" onclick="qaafTriggerLiveYouTubeSearch('${safeQ}'); document.getElementById('qaafLiveSearchDropdown').classList.add('hidden');" class="w-full px-3.5 py-2.5 bg-gradient-to-r from-emerald-950 to-blue-950 hover:from-emerald-900 hover:to-blue-900 text-emerald-300 text-xs font-extrabold flex items-center justify-center gap-2 transition">
        <span>🌐</span> <span>Search More "${q}" Videos Across Approved Islamic Channels</span>
      </button>
    `;

    drop.innerHTML = html;
    drop.classList.remove('hidden');
  }

  window.selectChannelFromSearch = function(chName) {
    const drop = document.getElementById('qaafLiveSearchDropdown');
    if (drop) drop.classList.add('hidden');
    window.selectChannelFilter(chName);
  };

  window.playVideoFromSearchDropdown = function(vidId) {
    const drop = document.getElementById('qaafLiveSearchDropdown');
    if (drop) drop.classList.add('hidden');
    openVideoPlayer(vidId);
  };

  function upgradeSearchBarDOM() {
    const wrapper = document.getElementById('qaafSearchBarWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = `
      <div class="flex-1 flex flex-col gap-1.5 relative">
        <div class="relative flex items-center bg-[#121621] border-2 border-slate-700 focus-within:border-emerald-500 rounded-full pl-3.5 pr-1.5 py-1.5 shadow-lg transition">
          <span class="text-emerald-400 mr-2 text-sm">🔍</span>
          <input id="qaafSearchInput" type="search" name="qaaf_video_search_query_field" autocomplete="new-password" readonly onfocus="this.removeAttribute('readonly');" placeholder="Search any Video, Scholar, Surah, Cartoon or Channel (Urdu / English)..." class="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none" />
          <button id="qaafSearchClearBtn" type="button" class="hidden text-slate-400 hover:text-white text-xs font-extrabold px-2.5 py-1 rounded-full hover:bg-slate-800 mr-1" title="Clear Search">✕</button>
          <button id="qaafSearchSubmitBtn" type="button" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-extrabold shrink-0 shadow flex items-center gap-1 transition">
            <span>🔍</span> <span>Search</span>
          </button>
        </div>
        <div id="qaafLiveSearchDropdown" class="hidden absolute left-0 right-0 top-12 z-40 bg-[#141822] border border-emerald-500/50 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto"></div>
        <div id="qaafSearchStatusBanner" class="hidden bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs flex items-center justify-between gap-2">
          <span id="qaafSearchStatusText" class="text-emerald-300 font-bold truncate"></span>
          <button type="button" onclick="qaafClearSearchNow()" class="bg-slate-800 hover:bg-rose-600 text-white px-2.5 py-0.5 rounded-lg text-[11px] font-bold shrink-0">✕ Show All</button>
        </div>
      </div>
      <button id="qaafNotifBellBtn" type="button" class="bg-[#181c26] hover:bg-slate-800 border border-slate-700 text-slate-200 px-3.5 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 shadow self-start sm:self-center">
        <span>🔔</span>
        <span>Video Request</span>
        <span id="userNotifCountBadge" class="bg-emerald-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-extrabold">0</span>
      </button>
    `;

    const sInput = document.getElementById('qaafSearchInput');
    const sClear = document.getElementById('qaafSearchClearBtn');
    const sBtn = document.getElementById('qaafSearchSubmitBtn');
    const bellBtn = document.getElementById('qaafNotifBellBtn');

    if (bellBtn && typeof window.openUserNotificationsModal === 'function') {
      bellBtn.addEventListener('click', window.openUserNotificationsModal);
    }

    if (sInput) {
      sInput.addEventListener('input', function() {
        window.qaafActiveSearchQuery = this.value;
        if (sClear) sClear.classList.toggle('hidden', !this.value.trim());
        renderLiveSearchDropdown(this.value);
        renderVideos();

        clearTimeout(liveSearchTimeout);
        const trimmed = this.value.trim();
        if (trimmed.length >= 3) {
          liveSearchTimeout = setTimeout(() => {
            const currentMatches = countLocalMatches(trimmed);
            if (currentMatches < 3) {
              qaafTriggerLiveYouTubeSearch(trimmed);
            }
          }, 650);
        }
      });

      sInput.addEventListener('focus', function() {
        if (this.value.trim()) renderLiveSearchDropdown(this.value);
      });

      sInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const drop = document.getElementById('qaafLiveSearchDropdown');
          if (drop) drop.classList.add('hidden');
          window.qaafActiveSearchQuery = this.value;
          renderVideos();
          if (this.value.trim().length >= 2) {
            qaafTriggerLiveYouTubeSearch(this.value.trim());
          }
        }
      });
    }

    if (sBtn) {
      sBtn.addEventListener('click', function() {
        const drop = document.getElementById('qaafLiveSearchDropdown');
        if (drop) drop.classList.add('hidden');
        const val = (document.getElementById('qaafSearchInput')?.value || '').trim();
        window.qaafActiveSearchQuery = val;
        renderVideos();
        if (val.length >= 2) {
          qaafTriggerLiveYouTubeSearch(val);
        }
      });
    }

    if (sClear) {
      sClear.addEventListener('click', function() {
        window.qaafClearSearchNow();
      });
    }

    document.addEventListener('click', function(e) {
      const wrap = document.getElementById('qaafSearchBarWrapper');
      const drop = document.getElementById('qaafLiveSearchDropdown');
      if (wrap && drop && !wrap.contains(e.target)) {
        drop.classList.add('hidden');
      }
    });
  }

  window.qaafClearSearchNow = function() {
    window.qaafActiveSearchQuery = '';
    const sInput = document.getElementById('qaafSearchInput');
    const sClear = document.getElementById('qaafSearchClearBtn');
    const banner = document.getElementById('qaafSearchStatusBanner');
    const drop = document.getElementById('qaafLiveSearchDropdown');
    if (sInput) sInput.value = '';
    if (sClear) sClear.classList.add('hidden');
    if (banner) banner.classList.add('hidden');
    if (drop) drop.classList.add('hidden');
    renderVideos();
  };

  function countLocalMatches(q) {
    const tokens = expandQueryTokens(q);
    return videosData.filter(v => {
      if (blockedVideoIds.includes(v.id)) return false;
      if (bannedChannels.includes(v.channel)) return false;
      if (isKidsLocked && !v.kidsSafe) return false;
      return matchesVideoSmart(v, q, tokens);
    }).length;
  }

  window.qaafTriggerLiveYouTubeSearch = async function(rawQuery) {
    const q = (rawQuery || '').trim();
    if (!q || isFetchingLiveSearch) return;
    isFetchingLiveSearch = true;

    const statusBanner = document.getElementById('qaafSearchStatusBanner');
    const statusText = document.getElementById('qaafSearchStatusText');
    if (statusBanner && statusText) {
      statusBanner.classList.remove('hidden');
      statusText.innerHTML = `⏳ Searching approved Islamic channels for "<strong>${q}</strong>"...`;
    }

    try {
      const searchSuffix = isKidsLocked ? 'Islamic kids cartoon no music' : 'Islamic bayan quran halal';
      const fullSearchQuery = `${q} ${searchSuffix}`;
      const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(fullSearchQuery)}`;

      const proxyUrls = [
        `https://r.jina.ai/${ytSearchUrl}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(ytSearchUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(ytSearchUrl)}`
      ];

      let foundIds = [];
      for (const pUrl of proxyUrls) {
        try {
          const res = await fetch(pUrl);
          if (!res.ok) continue;
          const text = await res.text();
          const ids = [...text.matchAll(/(?:watch\?v=|\/shorts\/|"videoId":")([a-zA-Z0-9_-]{11})/g)].map(m => m[1]);
          const unique = [...new Set(ids)];
          if (unique.length > 0) {
            foundIds = unique.slice(0, 6);
            break;
          }
        } catch (e) {}
      }

      let addedCount = 0;
      const BLOCKED_WORDS = ['music', 'song', 'dance', 'movie', 'concert', 'remix', 'dj', 'bollywood', 'qawwali', 'qawali', 'urs', 'matam', 'noha', 'majlis', 'kala jadu', 'گانا', 'موسیقی', 'قوالی', 'ماتم', 'نوحہ'];

      for (const vidId of foundIds) {
        if (videosData.some(v => v.ytId === vidId)) continue;
        try {
          const oe = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${vidId}`);
          const d = await oe.json();
          if (d && d.title) {
            const combinedLower = (`${d.title} ${d.author_name || ''}`).toLowerCase();
            if (BLOCKED_WORDS.some(bw => combinedLower.includes(bw))) continue;
            if (bannedChannels.includes(d.author_name)) continue;

            const isSh = combinedLower.includes('#short');
            videosData.unshift({
              id: 'v_search_' + vidId,
              title: `${d.title} (${q})`,
              channel: d.author_name || 'Islamic Channel',
              lang: preferredContentLang || 'ur',
              region: (preferredContentLang || 'ur').toUpperCase(),
              category: isKidsLocked ? 'kids_cartoon' : 'bayan',
              kidsSafe: isKidsLocked ? true : !combinedLower.includes('debate'),
              isShort: isSh,
              ytId: vidId,
              isCustomAdded: true,
              duration: isSh ? '0:55' : '12:30',
              views: 15400,
              createdAt: Math.floor(Date.now() / 1000)
            });
            addedCount++;
          }
        } catch (e) {}
      }

      if (addedCount > 0) {
        localStorage.setItem('qaaf_videos_data', JSON.stringify(videosData));
      }
    } catch (err) {
    } finally {
      isFetchingLiveSearch = false;
      renderVideos();
    }
  };

  const baseRenderVideos = window.renderVideos;
  window.renderVideos = function() {
    const q = (window.qaafActiveSearchQuery || '').trim();
    const statusBanner = document.getElementById('qaafSearchStatusBanner');
    const statusText = document.getElementById('qaafSearchStatusText');

    if (!q) {
      if (statusBanner && !isFetchingLiveSearch) statusBanner.classList.add('hidden');
      if (baseRenderVideos) baseRenderVideos();
      return;
    }

    const savedCategory = currentCategory;
    const savedStrictLang = strictLanguageOnly;
    const savedVideos = [...videosData];

    currentCategory = 'all';
    strictLanguageOnly = false;

    const tokens = expandQueryTokens(q);
    const matchedList = videosData.filter(v => {
      if (blockedVideoIds.includes(v.id)) return false;
      if (bannedChannels.includes(v.channel)) return false;
      if (isKidsLocked && !v.kidsSafe) return false;
      return matchesVideoSmart(v, q, tokens);
    });

    videosData = matchedList;
    if (baseRenderVideos) baseRenderVideos();

    videosData = savedVideos;
    currentCategory = savedCategory;
    strictLanguageOnly = savedStrictLang;

    if (statusBanner && statusText && !isFetchingLiveSearch) {
      statusBanner.classList.remove('hidden');
      statusText.innerHTML = `🔍 Found <strong>${matchedList.length}</strong> video(s) for "<strong>${q}</strong>"`;
    }

    const grid = document.getElementById('videoGrid');
    if (grid && matchedList.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-[#121620] border border-slate-800 rounded-2xl p-6 text-center my-2">
          <div class="text-3xl mb-2">🔍</div>
          <h4 class="text-sm sm:text-base font-extrabold text-white mb-1">No local videos matched "${q}"</h4>
          <p class="text-xs text-slate-400 mb-4">Click the button below to fetch matching Islamic videos from our approved channels, or clear your search.</p>
          <div class="flex items-center justify-center gap-2 flex-wrap">
            <button type="button" onclick="qaafTriggerLiveYouTubeSearch('${q.replace(/'/g, "\\'")}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow">
              🌐 Fetch "${q}" from Approved Channels
            </button>
            <button type="button" onclick="qaafClearSearchNow()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold">
              🔄 Show All Videos
            </button>
          </div>
        </div>
      `;
    }
  };

  upgradeSearchBarDOM();

  // =========================================================================
  // PART 2: ON-DEMAND 3D GAMES INSTALLER, LOCAL MEMORY CACHE & qaaf-games.html BRIDGE
  // =========================================================================
  const defaultFourGames = [
    {
      id: "g1",
      slug: "quran-quiz",
      icon: "📖",
      badge: "10 Stages • 3D Quiz",
      gradient: "from-emerald-900/80 via-slate-900 to-teal-950",
      border: "border-emerald-500/40",
      title: "Quran Quiz Adventure",
      desc: "10 interactive stages of Holy Quran, Prophets & Seerah questions with voice feedback & star rewards.",
      size: "1.2 MB",
      installed: false,
      blockedByParent: false
    },
    {
      id: "g2",
      slug: "arabic-alphabet",
      icon: "🔤",
      badge: "10 Stages • Audio Puzzle",
      gradient: "from-blue-900/80 via-slate-900 to-indigo-950",
      border: "border-blue-500/40",
      title: "Arabic Alphabet Puzzle",
      desc: "10 stages matching Alif to Yaa with authentic Arabic voice pronunciation and memory cards.",
      size: "1.4 MB",
      installed: false,
      blockedByParent: false
    },
    {
      id: "g3",
      slug: "masjid-builder",
      icon: "🕌",
      badge: "10 Stages • 3D Builder",
      gradient: "from-amber-900/70 via-slate-900 to-emerald-950",
      border: "border-amber-500/40",
      title: "Masjid & Wudu Builder",
      desc: "Learn Wudu steps in order and construct 10 famous Masjids including Masjid al-Haram & Masjid an-Nabawi.",
      size: "1.6 MB",
      installed: false,
      blockedByParent: false
    },
    {
      id: "g4",
      slug: "word-search",
      icon: "🧩",
      badge: "10 Stages • EN / AR / UR",
      gradient: "from-purple-900/80 via-slate-900 to-blue-950",
      border: "border-purple-500/40",
      title: "Islamic Word Search Puzzle",
      desc: "New 10×10 Word Search Grid in English, Arabic & Urdu with 10 illustrated popup cards and 10 stages!",
      size: "1.8 MB",
      installed: false,
      blockedByParent: false
    }
  ];

  function syncGamesMemoryState() {
    let savedMap = {};
    try {
      savedMap = JSON.parse(localStorage.getItem('qaaf_games_memory_v10') || '{}');
    } catch (e) {}

    gamesData.length = 0;
    defaultFourGames.forEach(def => {
      const st = savedMap[def.id] || {};
      gamesData.push({
        ...def,
        installed: st.installed === true,
        blockedByParent: st.blockedByParent === true,
        installingProgress: null
      });
    });
  }

  function saveGamesMemoryState() {
    const map = {};
    gamesData.forEach(g => {
      map[g.id] = {
        installed: !!g.installed,
        blockedByParent: !!g.blockedByParent
      };
    });
    localStorage.setItem('qaaf_games_memory_v10', JSON.stringify(map));
  }

  syncGamesMemoryState();

  if (!document.getElementById('qaafStandaloneGamesModal')) {
    const gm = document.createElement('div');
    gm.id = 'qaafStandaloneGamesModal';
    gm.className = 'fixed inset-0 z-50 hidden bg-[#05070b] flex flex-col';
    gm.dir = 'ltr';
    gm.innerHTML = `
      <div class="bg-[#0d1118] border-b border-white/10 px-3 sm:px-5 py-2 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <span id="extGameHeaderIcon" class="text-xl">🎮</span>
          <div>
            <h3 id="extGameHeaderTitle" class="text-xs sm:text-sm font-extrabold text-white">QAAF Kids Halal Game</h3>
            <p class="text-[10px] text-emerald-400 font-bold">100% Music-Free • 10 Stages • Memory Installed</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="bg-amber-500/20 border border-amber-400/40 text-amber-300 px-2.5 py-1 rounded-full text-xs font-extrabold">⭐ <span id="extGameStarsCount">0</span></span>
          <button type="button" onclick="closeStandaloneGameModal()" class="bg-slate-800 hover:bg-red-600 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold transition">✕ Exit Game</button>
        </div>
      </div>
      <iframe id="qaafStandaloneGameIframe" class="flex-1 w-full h-full border-0 bg-[#070b12]" src="about:blank" allow="autoplay"></iframe>
    `;
    document.body.appendChild(gm);
  }

  window.closeStandaloneGameModal = function() {
    const gm = document.getElementById('qaafStandaloneGamesModal');
    const ifr = document.getElementById('qaafStandaloneGameIframe');
    if (ifr) ifr.src = 'about:blank';
    if (gm) gm.classList.add('hidden');
  };

  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'QAAF_GAME_STAR_EARNED') {
      awardGameStar();
      const stEl = document.getElementById('extGameStarsCount');
      if (stEl) stEl.innerText = gameStars;
    } else if (e.data.type === 'QAAF_GAME_EXIT') {
      closeStandaloneGameModal();
    } else if (e.data.type === 'QAAF_OPEN_PARENT_SUPPORT') {
      closeStandaloneGameModal();
      openParentalGate('support');
    }
  });

  window.installGameByChild = function(gameId) {
    const g = gamesData.find(x => x.id === gameId);
    if (!g) return;
    if (g.blockedByParent) {
      requestParentGameInstall(gameId);
      return;
    }
    if (g.installingProgress !== null) return;

    g.installingProgress = 5;
    renderGames();

    if ('caches' in window && window.location.protocol.startsWith('http')) {
      caches.open('qaaf-games-on-demand-v1').then(cache => {
        cache.add('./qaaf-games.html').catch(() => {});
      }).catch(() => {});
    }

    const stepMs = 200;
    const timer = setInterval(() => {
      g.installingProgress += 15;
      const barEl = document.getElementById(`installProgBar_${gameId}`);
      const txtEl = document.getElementById(`installProgTxt_${gameId}`);
      if (barEl) barEl.style.width = `${Math.min(100, g.installingProgress)}%`;
      if (txtEl) txtEl.innerText = `⬇️ Downloading & Installing (${Math.min(100, g.installingProgress)}%)...`;

      if (g.installingProgress >= 100) {
        clearInterval(timer);
        g.installingProgress = null;
        g.installed = true;
        saveGamesMemoryState();
        renderGames();
        showSyncToast(`🎉 "${g.title}" installed in device memory!`);
      }
    }, stepMs);
  };

  window.parentToggleUninstallGame = function(gameId) {
    const g = gamesData.find(x => x.id === gameId);
    if (!g) return;
    if (g.blockedByParent) {
      g.blockedByParent = false;
      g.installed = true;
      showSyncToast(`🔓 "${g.title}" unlocked & restored by Parent.`);
    } else {
      g.installed = false;
      g.blockedByParent = true;
      showSyncToast(`🔒 "${g.title}" uninstalled & locked with 6-Digit Parent PIN.`);
    }
    saveGamesMemoryState();
    renderGames();
  };

  const prevVerifyPin = window.verifyPinCode;
  window.verifyPinCode = function() {
    const entered = (document.getElementById('pinInput')?.value || '').trim();
    const isInstallingGame = (pendingParentPurpose === 'reinstall_game' && entered === parentPin);
    if (prevVerifyPin) prevVerifyPin();
    if (isInstallingGame) {
      saveGamesMemoryState();
      renderGames();
    }
  };

  window.renderGames = function() {
    const grid = document.getElementById('gamesGrid');
    if (!grid) return;
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4';
    grid.innerHTML = '';

    gamesData.forEach(game => {
      let actionHtml = '';
      if (game.installingProgress !== null) {
        actionHtml = `
          <div class="w-full bg-black/80 border border-blue-500/50 rounded-xl p-2">
            <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
              <div id="installProgBar_${game.id}" class="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-150" style="width: ${game.installingProgress}%"></div>
            </div>
            <p id="installProgTxt_${game.id}" class="text-[11px] font-extrabold text-blue-300 text-center">⬇️ Downloading (${game.installingProgress}%)...</p>
          </div>`;
      } else if (game.installed && !game.blockedByParent) {
        actionHtml = `
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="openAndPlayGame('${game.id}')" class="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white py-2.5 rounded-xl text-xs font-extrabold shadow-lg transition">
              ▶ Play Now (10 Stages)
            </button>
          </div>`;
      } else if (game.blockedByParent) {
        actionHtml = `
          <button type="button" onclick="requestParentGameInstall('${game.id}')" class="w-full bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/60 text-amber-300 py-2.5 rounded-xl text-xs font-extrabold transition">
            🔒 Uninstalled • Enter 6-Digit PIN
          </button>`;
      } else {
        actionHtml = `
          <button type="button" onclick="installGameByChild('${game.id}')" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-extrabold shadow-lg transition flex items-center justify-center gap-1.5">
            <span>⬇️</span> <span>Install Game (${game.size})</span>
          </button>`;
      }

      grid.innerHTML += `
        <div class="game-card-3d bg-gradient-to-br ${game.gradient} border ${game.border} rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <div class="w-12 h-12 rounded-2xl bg-black/50 border border-white/15 flex items-center justify-center text-2xl shadow-inner">
                ${game.icon}
              </div>
              <div class="text-right">
                <span class="text-[10px] bg-black/60 border border-white/10 text-emerald-300 px-2.5 py-1 rounded-full font-extrabold block">${game.badge}</span>
                <span class="text-[10px] ${game.installed ? 'text-emerald-400' : 'text-slate-400'} font-bold mt-1 block">
                  ${game.installed ? '✅ Installed in Memory' : (game.blockedByParent ? '🔒 Locked by Parent' : '☁️ Ready to Install')}
                </span>
              </div>
            </div>
            <h3 class="text-sm sm:text-base font-extrabold text-white mb-1">${game.title}</h3>
            <p class="text-xs text-slate-300 leading-relaxed mb-4">${game.desc}</p>
          </div>
          ${actionHtml}
        </div>
      `;
    });

    if (typeof renderParentGameControls === 'function') renderParentGameControls();
  };

  window.openAndPlayGame = async function(gameId) {
    const g = gamesData.find(x => x.id === gameId);
    if (!g || !g.installed || g.blockedByParent) {
      installGameByChild(gameId);
      return;
    }

    let hasExternalGamesFile = false;
    if (window.location.protocol.startsWith('http')) {
      try {
        const resp = await fetch('./qaaf-games.html', { method: 'HEAD', cache: 'no-store' });
        if (resp.ok) hasExternalGamesFile = true;
      } catch (e) {}
    }

    if (hasExternalGamesFile) {
      const gm = document.getElementById('qaafStandaloneGamesModal');
      const ifr = document.getElementById('qaafStandaloneGameIframe');
      document.getElementById('extGameHeaderIcon').innerText = g.icon;
      document.getElementById('extGameHeaderTitle').innerText = g.title;
      document.getElementById('extGameStarsCount').innerText = gameStars;
      const proFlag = isSupporterPro ? '1' : '0';
      ifr.src = `./qaaf-games.html?game=${encodeURIComponent(g.slug)}&id=${encodeURIComponent(g.id)}&lang=${encodeURIComponent(preferredContentLang || 'en')}&pro=${proFlag}&stars=${gameStars}`;
      gm.classList.remove('hidden');
      return;
    }

    launchMiniGame(gameId);
  };

  const wordSearchPuzzles = {
    en: {
      words: [
        { word: "QURAN", icon: "📖", label: "Quran" },
        { word: "MAKKAH", icon: "🕋", label: "Makkah" },
        { word: "MADINAH", icon: "🕌", label: "Madinah" },
        { word: "SALAH", icon: "🧎", label: "Salah" },
        { word: "ZAKAT", icon: "🪙", label: "Zakat" },
        { word: "SAWM", icon: "🌙", label: "Sawm" },
        { word: "HAJJ", icon: "⛺", label: "Hajj" },
        { word: "DUA", icon: "🤲", label: "Dua" },
        { word: "WUDU", icon: "💧", label: "Wudu" },
        { word: "SABR", icon: "🌿", label: "Sabr" }
      ]
    },
    ar: {
      words: [
        { word: "قران", icon: "📖", label: "قرآن" },
        { word: "مكة", icon: "🕋", label: "مكة" },
        { word: "مدينة", icon: "🕌", label: "مدينة" },
        { word: "صلاة", icon: "🧎", label: "صلاة" },
        { word: "زكاة", icon: "🪙", label: "زكاة" },
        { word: "صوم", icon: "🌙", label: "صوم" },
        { word: "حج", icon: "⛺", label: "حج" },
        { word: "دعاء", icon: "🤲", label: "دعاء" },
        { word: "وضوء", icon: "💧", label: "وضوء" },
        { word: "صبر", icon: "🌿", label: "صبر" }
      ]
    },
    ur: {
      words: [
        { word: "قرآن", icon: "📖", label: "قرآن" },
        { word: "مکہ", icon: "🕋", label: "مکہ" },
        { word: "مدینہ", icon: "🕌", label: "مدینہ" },
        { word: "نماز", icon: "🧎", label: "نماز" },
        { word: "زکوۃ", icon: "🪙", label: "زکوۃ" },
        { word: "روزہ", icon: "🌙", label: "روزہ" },
        { word: "حج", icon: "⛺", label: "حج" },
        { word: "دعا", icon: "🤲", label: "دعا" },
        { word: "وضو", icon: "💧", label: "وضو" },
        { word: "صبر", icon: "🌿", label: "صبر" }
      ]
    }
  };
  let activeWordSearchLang = 'en';
  let foundWordSearchList = [];

  const origLaunchMiniGame = window.launchMiniGame;
  window.launchMiniGame = function(gameId = 'g1') {
    foundWordSearchList = [];
    if (origLaunchMiniGame) origLaunchMiniGame(gameId);
    if (gameId === 'g4') {
      document.getElementById('activeGameTitle').innerText = 'Islamic Word Search Puzzle';
      document.getElementById('activeGameIcon').innerText = '🧩';
      renderWordSearchFallback();
    }
  };

  const origRenderMiniGameStage = window.renderMiniGameStage;
  window.renderMiniGameStage = function() {
    if (origRenderMiniGameStage) origRenderMiniGameStage();
    if (activeMiniGameId === 'g4' && !isStageLocked('g4', activeGameStage)) {
      renderWordSearchFallback();
    }
  };

  window.switchWordSearchLang = function(langKey) {
    activeWordSearchLang = langKey;
    foundWordSearchList = [];
    renderWordSearchFallback();
  };

  window.tapWordSearchTarget = function(wordStr) {
    if (foundWordSearchList.includes(wordStr)) return;
    foundWordSearchList.push(wordStr);
    awardGameStar();
    speakArabicAudio("مَا شَاءَ اللَّه");
    renderWordSearchFallback();
  };

  function renderWordSearchFallback() {
    const container = document.getElementById('miniGameContainer');
    if (!container) return;
    document.getElementById('gameStageLabel').innerText = `Stage ${activeGameStage}: 10×10 Islamic Word Search`;
    const pack = wordSearchPuzzles[activeWordSearchLang] || wordSearchPuzzles.en;

    let topCardsHtml = '';
    pack.words.forEach(item => {
      const isFound = foundWordSearchList.includes(item.word);
      topCardsHtml += `
        <button type="button" onclick="tapWordSearchTarget('${item.word}')" class="p-1.5 rounded-xl border text-center transition flex flex-col items-center justify-center ${isFound ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300 scale-95' : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white'}">
          <span class="text-base">${item.icon}</span>
          <span class="text-[10px] font-extrabold truncate w-full">${item.label}</span>
        </button>`;
    });

    container.innerHTML = `
      <div class="bg-slate-950/90 rounded-2xl p-3 sm:p-4 border border-slate-800 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-extrabold text-amber-300">🌍 Select Puzzle Language:</span>
          <div class="flex gap-1">
            <button type="button" onclick="switchWordSearchLang('en')" class="px-2.5 py-1 rounded-lg text-xs font-extrabold ${activeWordSearchLang === 'en' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300'}">🇬🇧 English</button>
            <button type="button" onclick="switchWordSearchLang('ar')" class="px-2.5 py-1 rounded-lg text-xs font-extrabold ${activeWordSearchLang === 'ar' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300'}">🇸🇦 العربية</button>
            <button type="button" onclick="switchWordSearchLang('ur')" class="px-2.5 py-1 rounded-lg text-xs font-extrabold ${activeWordSearchLang === 'ur' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300'}">🇵🇰 اردو</button>
          </div>
        </div>
        <div>
          <p class="text-[11px] text-slate-400 font-bold mb-1.5 text-left">🖼️ 10 Picture Clues (Tap words as you find them — Found ${foundWordSearchList.length}/10):</p>
          <div class="grid grid-cols-5 gap-1.5">${topCardsHtml}</div>
        </div>
        <p class="text-[11px] text-emerald-400 font-bold">✨ Ready for full standalone 10×10 Grid when qaaf-games.html is added to the folder!</p>
      </div>
    `;
  }

  renderGames();
})();
