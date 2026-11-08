// QAAF Tube Dedicated Users Data, Live Cloud Registry Sync, 10-Language Selector & 1.5s Volume Auto-Hide (qaaf-users-auth.js)
(function initQaafUsersDatabaseAndLanguageMaster() {
  var FIREBASE_DEFAULT_URL = "https://qaaftube-6f251-default-rtdb.firebaseio.com";

  function getFirebaseBaseUrl() {
    var saved = localStorage.getItem("qaaf_firebase_db_url") || FIREBASE_DEFAULT_URL;
    return saved.replace(/\/+$/, "");
  }

  function toSafeFirebaseKey(rawKey) {
    return String(rawKey || "unknown").trim().toLowerCase().replace(/[.#$\[\]\/\s]+/g, "_");
  }

  // =========================================================================
  // A. LIVE CLOUD USERS REGISTRY SYNC (NON-DESTRUCTIVE MERGE ACROSS ALL DEVICES)
  // =========================================================================
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
    var globalUrl = baseUrl + "/qaaf_global_state/registeredUsersMap.json?t=" + Date.now();

    Promise.all([
      fetch(vaultUrl, { cache: "no-store" }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
      fetch(globalUrl, { cache: "no-store" }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; })
    ]).then(function(results) {
      var vaultData = results[0] || {};
      var globalMapData = results[1] || {};
      var localMap = getLocalUsersMap();
      var mergedMap = {};

      // 1. Pull from legacy global state map if any
      if (globalMapData && typeof globalMapData === "object") {
        Object.keys(globalMapData).forEach(function(k) {
          var u = globalMapData[k];
          if (u && typeof u === "object") {
            var realKey = String(u.email || u.username || k).trim().toLowerCase();
            if (realKey) mergedMap[realKey] = u;
          }
        });
      }

      // 2. Pull from safe Firebase users vault
      if (vaultData && typeof vaultData === "object") {
        Object.keys(vaultData).forEach(function(safeK) {
          var item = vaultData[safeK];
          if (!item) return;
          var u = item.userData || item;
          var realKey = String(item.originalKey || (u && (u.email || u.username)) || safeK).trim().toLowerCase();
          if (u && typeof u === "object" && realKey) {
            var existing = mergedMap[realKey];
            if (!existing || ((u.updatedAt || 0) >= (existing.updatedAt || 0))) {
              mergedMap[realKey] = u;
            }
          }
        });
      }

      // 3. Merge local users on top if newer or missing in cloud
      Object.keys(localMap).forEach(function(k) {
        var u = localMap[k];
        if (u && typeof u === "object") {
          var realKey = String(u.email || u.username || k).trim().toLowerCase();
          if (!realKey) return;
          var cloudUser = mergedMap[realKey];
          if (!cloudUser) {
            mergedMap[realKey] = u;
          } else {
            mergedMap[realKey] = Object.assign({}, cloudUser, u);
          }
        }
      });

      // Handle explicit deletion if requested by Admin
      if (deletedEmailKey) {
        var delKey = String(deletedEmailKey).trim().toLowerCase();
        delete mergedMap[delKey];
        delete mergedMap[deletedEmailKey];
        var safeDel = toSafeFirebaseKey(delKey);
        fetch(baseUrl + "/qaaf_users_vault/" + safeDel + ".json", { method: "DELETE" }).catch(function() {});
      }

      // 4. Save merged map locally
      window.registeredUsersMap = mergedMap;
      lastSerializedUsers = JSON.stringify(mergedMap);
      try {
        localStorage.setItem("qaaf_registered_users", lastSerializedUsers);
      } catch (e) {}

      // 5. Push each user with safe key via PATCH so Firebase never rejects '.' in emails and never overwrites other users
      var patchPayload = {};
      var safeGlobalMap = {};
      Object.keys(mergedMap).forEach(function(realKey) {
        var u = mergedMap[realKey];
        if (!u || typeof u !== "object") return;
        var safeK = toSafeFirebaseKey(realKey);
        patchPayload[safeK] = {
          originalKey: realKey,
          updatedAt: Date.now(),
          userData: u
        };
        safeGlobalMap[safeK] = Object.assign({}, u, { email: u.email || realKey });
      });

      if (Object.keys(patchPayload).length > 0) {
        fetch(baseUrl + "/qaaf_users_vault.json", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload)
        }).catch(function() {});

        fetch(baseUrl + "/qaaf_global_state/registeredUsersMap.json", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(safeGlobalMap)
        }).catch(function() {});
      }

      // 6. Refresh Admin UI table & badges immediately
      if (typeof window.renderAdminUsersTable === "function") {
        window.renderAdminUsersTable();
      }
      var countBadge = document.getElementById("admUsersTotalCountBadge");
      if (countBadge) countBadge.innerText = String(Object.keys(mergedMap).length);

      if (showFeedback && typeof showSyncToast === "function") {
        showSyncToast("✅ Cloud Users Synced: " + Object.keys(mergedMap).length + " accounts loaded!");
      }
      isSyncingUsers = false;
    }).catch(function() {
      isSyncingUsers = false;
    });
  };

  // Intercept localStorage.setItem so any signup / password reset / PIN update immediately syncs to Firebase Cloud
  var origSetItem = localStorage.setItem;
  localStorage.setItem = function(key, val) {
    origSetItem.apply(this, arguments);
    if (key === "qaaf_registered_users" && val !== lastSerializedUsers) {
      lastSerializedUsers = val;
      setTimeout(function() {
        window.syncQaafUsersWithCloudNow(false);
      }, 200);
    }
  };

  // Also watch window.registeredUsersMap changes every 3 seconds
  setInterval(function() {
    if (window.registeredUsersMap && typeof window.registeredUsersMap === "object") {
      var cur = JSON.stringify(window.registeredUsersMap);
      if (cur !== lastSerializedUsers && cur !== "{}") {
        lastSerializedUsers = cur;
        window.syncQaafUsersWithCloudNow(false);
      }
    }
  }, 3000);

  // =========================================================================
  // B. DEDICATED USERS DATABASE EXPORT / IMPORT (.JSON) IN ADMIN "USERS & PRO" TAB
  // =========================================================================
  window.adminExportUsersDatabaseJson = function() {
    var map = getLocalUsersMap();
    var backupObj = {
      qaafUsersDatabaseVersion: "13.2",
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
    if (typeof showSyncToast === "function") showSyncToast("📥 Users & Passwords Database exported (qaaf-users-database.json)!");
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
    if (!usersPane) return;
    var existing = document.getElementById("admUsersJsonBackupBar");
    if (existing) return;
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

  var prevSwitchAdmTab = window.switchAdminConsoleTab;
  if (typeof prevSwitchAdmTab === "function") {
    window.switchAdminConsoleTab = function(tabName) {
      prevSwitchAdmTab(tabName);
      if (tabName === "users") {
        injectUsersDatabaseBackupBar();
        window.syncQaafUsersWithCloudNow(true);
      }
    };
  }

  // =========================================================================
  // C. PREVENT CHROME PASSWORD MANAGER POPUP ON SEARCH BAR & PIN INPUTS
  // =========================================================================
  function sanitizeSearchAndSecretInputs() {
    var sInp = document.getElementById("qaafSearchInput");
    if (sInp) {
      sInp.setAttribute("type", "search");
      sInp.setAttribute("name", "q_search");
      sInp.setAttribute("autocomplete", "off");
      sInp.setAttribute("data-lpignore", "true");
      sInp.removeAttribute("readonly");
      if (sInp.value && sInp.value.indexOf("@") !== -1) {
        sInp.value = "";
        window.qaafActiveSearchQuery = "";
      }
    }
    document.querySelectorAll('input[type="password"]').forEach(function(inp) {
      inp.setAttribute("type", "text");
      inp.setAttribute("autocomplete", "off");
      inp.style.webkitTextSecurity = "disc";
    });
  }
  sanitizeSearchAndSecretInputs();
  setInterval(sanitizeSearchAndSecretInputs, 1000);

  // =========================================================================
  // D. WORKING 10-LANGUAGE SYSTEM (1. PREFERRED VIDEO LANGUAGE vs 2. DISPLAY LANGUAGE)
  // =========================================================================
  var TEN_ISLAMIC_LANGS = [
    { code: "en", short: "EN", label: "🇬🇧 English", regionKey: "US_UK" },
    { code: "ar", short: "AR", label: "🇸🇦 Arabic (العربية)", regionKey: "AR" },
    { code: "ur", short: "UR", label: "🇵🇰 Urdu (اردو)", regionKey: "PK" },
    { code: "hi", short: "HI", label: "🇮🇳 Hindi (हिन्दी)", regionKey: "GLOBAL" },
    { code: "bn", short: "BN", label: "🇧🇩 Bengali (বাংলা)", regionKey: "BD" },
    { code: "tr", short: "TR", label: "🇹🇷 Turkish (Türkçe)", regionKey: "GLOBAL" },
    { code: "ms", short: "MS", label: "🇲🇾 Malay (Melayu)", regionKey: "GLOBAL" },
    { code: "id", short: "ID", label: "🇮🇩 Indonesian (Bahasa)", regionKey: "GLOBAL" },
    { code: "fr", short: "FR", label: "🇫🇷 French (Français)", regionKey: "US_UK" },
    { code: "ru", short: "RU", label: "🇷🇺 Russian (Русский)", regionKey: "GLOBAL" }
  ];

  var UI_TRANSLATIONS = {
    en: {
      videos: "Videos", games: "Games", settings: "Settings", kids: "Kids", login: "Login", admin: "Admin",
      catAll: "All Channels", catQuran: "Tilawat-e-Quran", catNaat: "Naat", catTarbiyah: "Islamic Tarbiyah", catBayan: "Islamic Bayanat", catStories: "Kids Tarbiyah", catCartoon: "Kids Cartoons",
      smart: "Smart Feed", fav: "Favorites", recent: "Most Recent", viewed: "Most Viewed",
      searchPh: "Search any Video, Scholar, Surah, Cartoon or Channel...", searchBtn: "Search",
      videoReq: "Video Request", shortsTitle: "QAAF Islamic Shorts & Quick Bayans", swipe: "Swipe / Scroll ➔",
      drawerHome: "All Videos Feed", drawerPl: "My Playlists", drawerHist: "Watch History", drawerFav: "Favorite Videos", drawerTimer: "Kids Lock & Schedule",
      promoteBtn: "Promote / Contact", backBtn: "◀ Back", homeBtn: "● Home", recentBtn: "■ Recent"
    },
    ur: {
      videos: "ویڈیوز", games: "گیمز", settings: "سیٹنگز", kids: "کڈز", login: "لاگ ان", admin: "ایڈمن",
      catAll: "تمام چینلز", catQuran: "تلاوتِ قرآن پاک", catNaat: "نعت شریف", catTarbiyah: "اسلامی تربیت", catBayan: "اسلامی بیانات", catStories: "بچوں کی تربیت", catCartoon: "کڈز کارٹون",
      smart: "اسمارٹ فیڈ", fav: "پسندیدہ", recent: "تازہ ترین", viewed: "سب سے زیادہ دیکھی گئی",
      searchPh: "کوئی بھی ویڈیو، قاری، نعت، کارٹون یا چینل تلاش کریں...", searchBtn: "تلاش کریں",
      videoReq: "ویڈیو کی درخواست", shortsTitle: "قاف اسلامک شارٹس اور مختصر بیانات", swipe: "آگے دیکھیں ➔",
      drawerHome: "تمام ویڈیوز", drawerPl: "میری پلے لسٹس", drawerHist: "دیکھی گئی ویڈیوز", drawerFav: "پسندیدہ ویڈیوز", drawerTimer: "کڈز لاک اور وقت",
      promoteBtn: "رابطہ اور تشہیر", backBtn: "◀ واپس", homeBtn: "● ہوم", recentBtn: "■ حالیہ"
    },
    ar: {
      videos: "الفيديوهات", games: "الألعاب", settings: "الإعدادات", kids: "أطفال", login: "دخول", admin: "الإدارة",
      catAll: "جميع القنوات", catQuran: "تلاوة القرآن", catNaat: "أناشيد إسلامية", catTarbiyah: "التربية الإسلامية", catBayan: "محاضرات إسلامية", catStories: "تربية الأطفال", catCartoon: "كرتون إسلامي",
      smart: "المختار", fav: "المفضلة", recent: "الأحدث", viewed: "الأكثر مشاهدة",
      searchPh: "ابحث عن أي فيديو أو قارئ أو سورة أو قناة...", searchBtn: "بحث",
      videoReq: "طلب فيديو", shortsTitle: "مقاطع قاف القصيرة والمحاضرات", swipe: "اسحب للمزيد ➔",
      drawerHome: "جميع الفيديوهات", drawerPl: "قوائم التشغيل", drawerHist: "سجل المشاهدة", drawerFav: "المفضلة", drawerTimer: "قفل ومؤقت الأطفال",
      promoteBtn: "للإعلان والتواصل", backBtn: "◀ رجوع", homeBtn: "● الرئيسية", recentBtn: "■ التطبيقات"
    },
    hi: {
      videos: "वीडियो", games: "गेम्स", settings: "सेटिंग्स", kids: "किड्स", login: "लॉग इन", admin: "एडमिन",
      catAll: "सभी चैनल", catQuran: "तिलावत-ए-कुरआन", catNaat: "नात शरीफ़", catTarbiyah: "इस्लामी तरबियत", catBayan: "इस्लामी बयानात", catStories: "बच्चों की तरबियत", catCartoon: "किड्स कार्टून",
      smart: "स्मार्ट फ़ीड", fav: "पसंदीदा", recent: "नवीनतम", viewed: "सबसे ज़्यादा देखे गए",
      searchPh: "कोई भी वीडियो, कारी, सूरह या चैनल खोजें...", searchBtn: "खोजें",
      videoReq: "वीडियो अनुरोध", shortsTitle: "क़ाफ़ इस्लामिक शॉर्ट्स और बयानात", swipe: "आगे देखें ➔",
      drawerHome: "सभी वीडियो", drawerPl: "मेरी प्लेलिस्ट", drawerHist: "देखे गए वीडियो", drawerFav: "पसंदीदा वीडियो", drawerTimer: "किड्स लॉक और समय",
      promoteBtn: "प्रमोशन / संपर्क", backBtn: "◀ पीछे", homeBtn: "● होम", recentBtn: "■ हाल ही में"
    },
    bn: {
      videos: "ভিডিও", games: "গেমস", settings: "সেটিংস", kids: "কিডস", login: "লগইন", admin: "অ্যাডমিন",
      catAll: "সব চ্যানেল", catQuran: "তিলাওয়াতে কুরআন", catNaat: "নাত শরীফ", catTarbiyah: "ইসলামিক তারবিয়াহ", catBayan: "ইসলামিক বয়ান", catStories: "শিশুদের তারবিয়াহ", catCartoon: "কিডস কার্টুন",
      smart: "স্মার্ট ফিড", fav: "প্রিয়", recent: "সাম্প্রতিক", viewed: "সর্বাধিক দেখা",
      searchPh: "যেকোনো ভিডিও, কারী, সূরা বা চ্যানেল খুঁজুন...", searchBtn: "খুঁজুন",
      videoReq: "ভিডিও অনুরোধ", shortsTitle: "কাফ ইসলামিক শর্টস ও বয়ান", swipe: "সোয়াইপ করুন ➔",
      drawerHome: "সব ভিডিও", drawerPl: "আমার প্লেলিস্ট", drawerHist: "দেখার ইতিহাস", drawerFav: "প্রিয় ভিডিও", drawerTimer: "কিডস লক ও টাইমার",
      promoteBtn: "প্রচার ও যোগাযোগ", backBtn: "◀ পিছনে", homeBtn: "● হোম", recentBtn: "■ সাম্প্রতিক"
    },
    tr: {
      videos: "Videolar", games: "Oyunlar", settings: "Ayarlar", kids: "Çocuk", login: "Giriş", admin: "Yönetici",
      catAll: "Tüm Kanallar", catQuran: "Kur'an Tilaveti", catNaat: "İlahi & Naat", catTarbiyah: "İslami Eğitim", catBayan: "İslami Sohbetler", catStories: "Çocuk Eğitimi", catCartoon: "Çocuk Çizgi Film",
      smart: "Akıllı Akış", fav: "Favoriler", recent: "En Yeni", viewed: "En Çok İzlenen",
      searchPh: "Video, Qari, Sure veya Kanal ara...", searchBtn: "Ara",
      videoReq: "Video İsteği", shortsTitle: "QAAF İslami Kısa Videolar", swipe: "Kaydır ➔",
      drawerHome: "Tüm Videolar", drawerPl: "Oynatma Listelerim", drawerHist: "İzleme Geçmişi", drawerFav: "Favori Videolar", drawerTimer: "Çocuk Kilidi & Süre",
      promoteBtn: "Tanıtım / İletişim", backBtn: "◀ Geri", homeBtn: "● Ana Sayfa", recentBtn: "■ Son"
    },
    ms: {
      videos: "Video", games: "Permainan", settings: "Tetapan", kids: "Kanak2", login: "Log Masuk", admin: "Admin",
      catAll: "Semua Saluran", catQuran: "Tilawah Al-Quran", catNaat: "Nasyid", catTarbiyah: "Tarbiyah Islam", catBayan: "Ceramah Islam", catStories: "Didik Anak", catCartoon: "Kartun Kanak-kanak",
      smart: "Suapan Pintar", fav: "Kegemaran", recent: "Terkini", viewed: "Paling Ditonton",
      searchPh: "Cari Video, Qari, Surah atau Saluran...", searchBtn: "Cari",
      videoReq: "Mohon Video", shortsTitle: "Video Pendek & Bayan QAAF", swipe: "Leret ➔",
      drawerHome: "Semua Video", drawerPl: "Senarai Main", drawerHist: "Sejarah Tontonan", drawerFav: "Video Kegemaran", drawerTimer: "Kunci & Masa Kanak-kanak",
      promoteBtn: "Promosi / Hubungi", backBtn: "◀ Kembali", homeBtn: "● Utama", recentBtn: "■ Terkini"
    },
    id: {
      videos: "Video", games: "Permainan", settings: "Pengaturan", kids: "Anak", login: "Masuk", admin: "Admin",
      catAll: "Semua Saluran", catQuran: "Tilawah Al-Quran", catNaat: "Nasyid", catTarbiyah: "Tarbiyah Islam", catBayan: "Kajian Islam", catStories: "Edukasi Anak", catCartoon: "Kartun Anak",
      smart: "Beranda Pintar", fav: "Favorit", recent: "Terbaru", viewed: "Terpopuler",
      searchPh: "Cari Video, Qari, Surah atau Saluran...", searchBtn: "Cari",
      videoReq: "Request Video", shortsTitle: "Video Pendek & Kajian QAAF", swipe: "Geser ➔",
      drawerHome: "Semua Video", drawerPl: "Playlist Saya", drawerHist: "Riwayat Tontonan", drawerFav: "Video Favorit", drawerTimer: "Kunci & Waktu Anak",
      promoteBtn: "Promosi / Kontak", backBtn: "◀ Kembali", homeBtn: "● Beranda", recentBtn: "■ Terkini"
    },
    fr: {
      videos: "Vidéos", games: "Jeux", settings: "Paramètres", kids: "Enfants", login: "Connexion", admin: "Admin",
      catAll: "Toutes les chaînes", catQuran: "Récitation du Coran", catNaat: "Anachid", catTarbiyah: "Éducation Islamique", catBayan: "Conférences", catStories: "Éducation Enfants", catCartoon: "Dessins Animés",
      smart: "Flux Intelligent", fav: "Favoris", recent: "Plus récents", viewed: "Plus vus",
      searchPh: "Rechercher une vidéo, sourate ou chaîne...", searchBtn: "Chercher",
      videoReq: "Demander Vidéo", shortsTitle: "Shorts Islamiques & Rappels QAAF", swipe: "Glisser ➔",
      drawerHome: "Toutes les vidéos", drawerPl: "Mes Playlists", drawerHist: "Historique", drawerFav: "Vidéos Favorites", drawerTimer: "Contrôle Parental",
      promoteBtn: "Promouvoir / Contact", backBtn: "◀ Retour", homeBtn: "● Accueil", recentBtn: "■ Récents"
    },
    ru: {
      videos: "Видео", games: "Игры", settings: "Настройки", kids: "Детям", login: "Войти", admin: "Админ",
      catAll: "Все каналы", catQuran: "Чтение Корана", catNaat: "Нашиды", catTarbiyah: "Исламское воспитание", catBayan: "Лекции", catStories: "Детям", catCartoon: "Мультфильмы",
      smart: "Умная лента", fav: "Избранное", recent: "Новые", viewed: "Популярные",
      searchPh: "Поиск видео, суры или канала...", searchBtn: "Поиск",
      videoReq: "Запрос видео", shortsTitle: "Короткие исламские видео QAAF", swipe: "Листайте ➔",
      drawerHome: "Все видео", drawerPl: "Мои плейлисты", drawerHist: "История просмотра", drawerFav: "Избранное", drawerTimer: "Детский таймер",
      promoteBtn: "Реклама / Контакт", backBtn: "◀ Назад", homeBtn: "● Главная", recentBtn: "■ Недавние"
    }
  };

  if (typeof globalLanguagesList !== "undefined" && Array.isArray(globalLanguagesList)) {
    globalLanguagesList.length = 0;
    TEN_ISLAMIC_LANGS.forEach(function(l) { globalLanguagesList.push(l); });
  }

  currentAppUILang = localStorage.getItem("qaaf_ui_display_lang") || "en";
  preferredContentLang = localStorage.getItem("qaaf_preferred_content_lang") || localStorage.getItem("qaaf_content_lang") || "en";
  window.currentAppUILang = currentAppUILang;
  window.preferredContentLang = preferredContentLang;

  function updateBtnLabelSmart(btnEl, newText, hasDropdownArrow) {
    if (!btnEl) return;
    // Check if there is a dedicated label span inside
    var spans = btnEl.querySelectorAll("span");
    if (spans.length >= 2) {
      // Usually spans[0] is icon/emoji, spans[1] is label
      spans[1].innerText = newText + (hasDropdownArrow && spans.length === 2 ? " ▾" : "");
      return;
    }
    // Otherwise preserve first svg or emoji span and update text node
    var firstSvgOrSpan = btnEl.querySelector("svg, span");
    if (firstSvgOrSpan) {
      var iconHtml = firstSvgOrSpan.outerHTML;
      btnEl.innerHTML = iconHtml + ' <span>' + newText + (hasDropdownArrow ? ' ▾' : '') + '</span>';
    } else {
      btnEl.innerText = newText + (hasDropdownArrow ? " ▾" : "");
    }
  }

  function applyQaafUIButtonsTranslation(langCode) {
    var t = UI_TRANSLATIONS[langCode] || UI_TRANSLATIONS.en;

    // 1. Direct ID spans if present
    var directMap = {
      "ui_videosTab": t.videos,
      "ui_gamesTab": t.games,
      "ui_settingsBtn": t.settings,
      "ui_catAllLabel": t.catAll,
      "ui_catQuranLabel": t.catQuran,
      "ui_catNaatLabel": t.catNaat,
      "ui_catTarbiyahLabel": t.catTarbiyah,
      "ui_catBayanLabel": t.catBayan,
      "ui_catStoriesLabel": t.catStories,
      "ui_catCartoonLabel": t.catCartoon,
      "ui_favFilter": t.fav,
      "ui_recentFilter": t.recent,
      "ui_viewedFilter": t.viewed
    };
    Object.keys(directMap).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.innerText = directMap[id];
    });

    // 2. Category Bar Buttons (even if dynamically rebuilt by qaaf-player-ui.js)
    updateBtnLabelSmart(document.getElementById("ui_catAll") || document.getElementById("allChannelsDropdownBtn"), t.catAll, true);
    updateBtnLabelSmart(document.getElementById("ui_catQuran"), t.catQuran, false);
    updateBtnLabelSmart(document.getElementById("ui_catNaat"), t.catNaat, false);
    updateBtnLabelSmart(document.getElementById("ui_catTarbiyah"), t.catTarbiyah, false);
    updateBtnLabelSmart(document.getElementById("ui_catBayan"), t.catBayan, false);
    updateBtnLabelSmart(document.getElementById("ui_catStories"), t.catStories, false);
    updateBtnLabelSmart(document.getElementById("ui_catCartoon"), t.catCartoon, false);

    // 3. Sort Filter Buttons
    var sortDef = document.getElementById("sort_default");
    if (sortDef) updateBtnLabelSmart(sortDef, t.smart, false);
    var sortRec = document.getElementById("sort_recent");
    if (sortRec && !document.getElementById("ui_recentFilter")) updateBtnLabelSmart(sortRec, t.recent, false);
    var sortView = document.getElementById("sort_viewed");
    if (sortView && !document.getElementById("ui_viewedFilter")) updateBtnLabelSmart(sortView, t.viewed, false);

    // 4. Header Buttons (Settings, Kids, Admin)
    var pBtn = document.getElementById("parentPanelBtn");
    if (pBtn && !document.getElementById("ui_settingsBtn")) updateBtnLabelSmart(pBtn, t.settings, false);
    var kLetters = document.querySelector("#kidsLockBtn .kids-letters");
    if (kLetters) {
      if (langCode === "en") {
        kLetters.innerHTML = "<span>K</span><span>i</span><span>d</span><span>s</span>";
      } else {
        kLetters.innerHTML = '<span class="text-amber-300">' + t.kids + '</span>';
      }
    }

    // 5. Search Bar & Video Request Button
    var sInp = document.getElementById("qaafSearchInput");
    if (sInp) sInp.placeholder = t.searchPh;
    var sBtn = document.getElementById("qaafSearchSubmitBtn");
    if (sBtn) updateBtnLabelSmart(sBtn, t.searchBtn, false);
    document.querySelectorAll("button").forEach(function(b) {
      var txt = (b.innerText || "").trim();
      if (b.id !== "qaafSearchSubmitBtn" && (txt === "Search" || txt === "🔍 Search" || txt === "تلاش کریں" || txt === "🔍 تلاش کریں" || txt === "بحث" || txt === "खोजें")) {
        updateBtnLabelSmart(b, t.searchBtn, false);
      }
      if (b.querySelector("#userReqCountBadge") || txt.indexOf("Video Request") !== -1 || txt.indexOf("ویڈیو کی درخواست") !== -1 || txt.indexOf("طلب فيديو") !== -1) {
        var badge = b.querySelector("#userReqCountBadge") || b.querySelector("span:last-child");
        var firstIcon = b.querySelector("svg, span:first-child");
        var spans = b.querySelectorAll("span");
        if (spans.length >= 2) {
          for (var i = 0; i < spans.length; i++) {
            if (spans[i].id !== "userReqCountBadge" && isNaN(parseInt(spans[i].innerText, 10)) && spans[i] !== firstIcon) {
              spans[i].innerText = t.videoReq;
              break;
            }
          }
        }
      }
    });

    // 6. Shorts Shelf Heading & Swipe text
    document.querySelectorAll("h2, h3, span, div").forEach(function(el) {
      if (el.children.length === 0) {
        var tx = (el.innerText || "").trim();
        if (tx === "QAAF Islamic Shorts & Quick Bayans" || tx === "قاف اسلامک شارٹس اور مختصر بیانات" || tx === "مقاطع قاف القصيرة والمحاضرات" || tx === "क़ाफ़ इस्लामिक शॉर्ट्स और बयानात") {
          el.innerText = t.shortsTitle;
        } else if (tx.indexOf("Swipe / Scroll") !== -1 || tx === "آگے دیکھیں ➔" || tx === "اسحب للمزيد ➔") {
          el.innerText = t.swipe;
        }
      }
    });

    // 7. Left Drawer & Promote Button
    var dMap = [
      ["drawerHomeBtn", t.drawerHome],
      ["drawerPlToggleBtn", t.drawerPl],
      ["drawerHistToggleBtn", t.drawerHist],
      ["drawerFavBtn", t.drawerFav],
      ["drawerKidsTimerBtn", t.drawerTimer]
    ];
    dMap.forEach(function(pair) {
      var b = document.getElementById(pair[0]);
      if (b) {
        var sp = b.querySelectorAll("span span");
        if (sp.length >= 2) sp[1].innerText = pair[1];
      }
    });

    var duaBadge = document.getElementById("duaLangBadge");
    if (duaBadge) duaBadge.innerText = String(preferredContentLang || "en").toUpperCase();
  }
  window.applyQaafUIButtonsTranslation = applyQaafUIButtonsTranslation;

    function sortVideosByPreferredLanguage() {
    if (typeof videosData === "undefined" || !Array.isArray(videosData) || videosData.length === 0) return;
    var pref = String(preferredContentLang || "en").toLowerCase();
    videosData.forEach(function(v, idx) {
      if (typeof v._origIdx === "undefined") v._origIdx = idx;
    });
    videosData.sort(function(a, b) {
      var la = String((a && a.lang) || "global").toLowerCase();
      var lb = String((b && b.lang) || "global").toLowerCase();
      var scoreA = (la === pref) ? 0 : (la === "global" ? 1 : 2);
      var scoreB = (lb === pref) ? 0 : (lb === "global" ? 1 : 2);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return (a._origIdx || 0) - (b._origIdx || 0);
    });
  }

  function refreshHeaderLangButtonAndMenu() {
    var shortEl = document.getElementById("shortLangCode");
    var prefObj = TEN_ISLAMIC_LANGS.find(function(l) { return l.code === preferredContentLang; }) || TEN_ISLAMIC_LANGS[0];
    if (shortEl) {
      shortEl.innerText = prefObj.short;
    }

    var menu = document.getElementById("langDropdownMenu");
    if (!menu) return;

    var uiOptHtml = "";
    TEN_ISLAMIC_LANGS.forEach(function(l) {
      uiOptHtml += '<option value="' + l.code + '" ' + (l.code === currentAppUILang ? 'selected' : '') + '>' + l.label + (l.code === 'en' ? ' (Keep App Buttons in English)' : '') + '</option>';
    });

    var prefBtnsHtml = "";
    TEN_ISLAMIC_LANGS.forEach(function(l) {
      var isAct = (l.code === preferredContentLang);
      prefBtnsHtml +=
        '<button type="button" onclick="window.selectQaafPreferredVideoLang('' + l.code + '', event)" class="px-2.5 py-2 rounded-xl text-xs font-extrabold border transition flex items-center justify-between gap-1 cursor-pointer ' +
        (isAct ? 'bg-emerald-500 text-black border-emerald-300 shadow-lg scale-[1.02]' : 'bg-black/80 hover:bg-slate-800 text-slate-200 border-slate-700') + '">' +
          '<span class="truncate">' + l.label + '</span>' +
          '<span class="text-[10px] px-1.5 py-0.5 rounded bg-black/25">' + (isAct ? '✓ ' : '') + l.short + '</span>' +
        '</button>';
    });

    var isStrict = (typeof strictLanguageOnly !== "undefined") ? !!strictLanguageOnly : (localStorage.getItem("qaaf_strict_lang") === "1");

    menu.innerHTML =
      '<div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">' +
        '<div>' +
          '<span class="font-extrabold text-white block text-xs">🌍 Language Setup (10 Core Languages)</span>' +
          '<span class="text-[10px] text-emerald-400 font-bold">Preferred Video Language: ' + prefObj.label + ' (' + prefObj.short + ')</span>' +
        '</div>' +
        '<button type="button" onclick="toggleLangDropdown(event)" class="text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 font-bold">✕</button>' +
      '</div>' +

      '<div class="mb-3.5">' +
        '<label class="block text-[11px] font-extrabold text-emerald-400 mb-1">🎬 1. Preferred Video &amp; Channel Language:</label>' +
        '<p class="text-[10px] text-slate-400 mb-2">Tap your language so its videos, channels &amp; Duas appear first (App buttons stay in English):</p>' +
        '<div class="grid grid-cols-2 gap-1.5">' + prefBtnsHtml + '</div>' +
      '</div>' +

      '<div class="pt-2.5 border-t border-slate-800 mb-2.5">' +
        '<label class="block text-[11px] font-bold text-amber-300 mb-1">📱 2. Display Language (App Buttons: Back, Close, Settings):</label>' +
        '<select id="uiLangSelectDropdown" onchange="window.selectQaafDisplayLang(this.value)" class="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold cursor-pointer">' +
          uiOptHtml +
        '</select>' +
      '</div>' +

      '<div class="pt-2.5 border-t border-slate-800">' +
        '<label class="flex items-center justify-between cursor-pointer text-slate-200 font-bold select-none text-xs">' +
          '<span>Strict Language Only (Show only ' + prefObj.short + ' videos)</span>' +
          '<input type="checkbox" id="strictLangToggle" ' + (isStrict ? 'checked' : '') + ' onchange="toggleStrictLanguage()" class="accent-emerald-500 rounded scale-110 cursor-pointer" />' +
        '</label>' +
      '</div>';

    var selHtml = '<option value="global">🌍 Global (All Languages)</option>';
    TEN_ISLAMIC_LANGS.forEach(function(l) { selHtml += '<option value="' + l.code + '">' + l.label + ' (' + l.short + ')</option>'; });
    ["adminVideoLang", "parentVideoLang", "quickReqVideoLang"].forEach(function(id) {
      var s = document.getElementById(id);
      if (s) s.innerHTML = selHtml;
    });
  }

  window.selectQaafPreferredVideoLang = function(code, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    preferredContentLang = code || "en";
    window.preferredContentLang = preferredContentLang;
    localStorage.setItem("qaaf_preferred_content_lang", preferredContentLang);
    localStorage.setItem("qaaf_content_lang", preferredContentLang);
    sortVideosByPreferredLanguage();
    refreshHeaderLangButtonAndMenu();
    applyQaafUIButtonsTranslation(currentAppUILang);
    var menu = document.getElementById("langDropdownMenu");
    if (menu) menu.classList.add("hidden");
    if (typeof syncRegionalPromoBar === "function") syncRegionalPromoBar();
    if (typeof window.renderVideosNow === "function") {
      window.renderVideosNow();
    } else if (typeof renderVideos === "function") {
      renderVideos();
    }
    var found = TEN_ISLAMIC_LANGS.find(function(l) { return l.code === preferredContentLang; });
    if (typeof showSyncToast === "function" && found) {
      showSyncToast("✅ Preferred Video Language: " + found.label + " (" + found.short + ")");
    }
  };
  window.setPreferredVideoLangNow = window.selectQaafPreferredVideoLang;

  window.selectQaafDisplayLang = function(code) {
    currentAppUILang = code || "en";
    window.currentAppUILang = currentAppUILang;
    localStorage.setItem("qaaf_ui_display_lang", currentAppUILang);
    localStorage.setItem("qaaf_ui_lang", currentAppUILang);
    applyQaafUIButtonsTranslation(currentAppUILang);
    refreshHeaderLangButtonAndMenu();
    if (typeof showSyncToast === "function") {
      showSyncToast("📱 App Display Buttons set to " + currentAppUILang.toUpperCase());
    }
  };
  window.setAppDisplayLangNow = window.selectQaafDisplayLang;

  window.toggleLangDropdown = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var menu = document.getElementById("langDropdownMenu");
    if (!menu) return;
    var isHidden = menu.classList.contains("hidden");
    if (isHidden) {
      refreshHeaderLangButtonAndMenu();
      menu.classList.remove("hidden");
    } else {
      menu.classList.add("hidden");
    }
  };

  // =========================================================================
  // E. STRICT 1.5s AUTO-HIDE FOR BOTTOM RED VOLUME BAR & TOP-LEFT RED CROSS
  // =========================================================================
  var hideOverlayTimer = null;

  function forceHideOverlays() {
    var topLeftX = document.getElementById("qaafMinimalTopLeftClose");
    var volBar = document.getElementById("qaafBottomSeekVolBar");
    if (topLeftX) {
      topLeftX.style.setProperty("opacity", "0", "important");
      topLeftX.style.setProperty("pointer-events", "none", "important");
    }
    if (volBar) {
      volBar.className = "";
      volBar.style.setProperty("opacity", "0", "important");
      volBar.style.setProperty("pointer-events", "none", "important");
      volBar.style.setProperty("display", "none", "important");
    }
  }

  window.wakeRedOverlay1500 = function() {
    var topLeftX = document.getElementById("qaafMinimalTopLeftClose");
    var volBar = document.getElementById("qaafBottomSeekVolBar");
    var scrollWrap = document.getElementById("ytWatchScrollContainer");
    var isMini = scrollWrap && scrollWrap.classList.contains("hidden");
    if (isMini) {
      forceHideOverlays();
      return;
    }
    if (topLeftX) {
      topLeftX.style.setProperty("display", "block", "important");
      topLeftX.style.setProperty("opacity", "1", "important");
      topLeftX.style.setProperty("pointer-events", "auto", "important");
    }
    if (volBar) {
      volBar.className = "";
      volBar.style.setProperty("display", "flex", "important");
      volBar.style.setProperty("opacity", "1", "important");
      volBar.style.setProperty("pointer-events", "auto", "important");
    }
    if (hideOverlayTimer) clearTimeout(hideOverlayTimer);
    hideOverlayTimer = setTimeout(forceHideOverlays, 1500);
  };

  window.wakeBottomSeekVolume = window.wakeRedOverlay1500;
  window.wakeAllVideoControls1800 = window.wakeRedOverlay1500;
  window.wakeMinimalRedControls1500 = window.wakeRedOverlay1500;

  // Startup initialization
  sortVideosByPreferredLanguage();
  refreshHeaderLangButtonAndMenu();
  applyQaafUIButtonsTranslation(currentAppUILang);
  injectUsersDatabaseBackupBar();
  window.syncQaafUsersWithCloudNow(false);
  if (typeof window.renderVideosNow === "function") {
    var origRenderVids = window.renderVideosNow;
    window.renderVideosNow = function() {
      origRenderVids.apply(this, arguments);
      applyQaafUIButtonsTranslation(window.currentAppUILang || "en");
    };
    window.renderVideosNow();
  }
  setTimeout(function() { applyQaafUIButtonsTranslation(window.currentAppUILang || "en"); }, 400);
  setTimeout(function() { applyQaafUIButtonsTranslation(window.currentAppUILang || "en"); }, 1200);
})();
