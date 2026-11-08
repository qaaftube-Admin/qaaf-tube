// QAAF Tube Core Data, Duas & Firebase Sync Engine (qaaf-data.js)

// HARDWARE FAILSAFE: Guaranteed splash dismiss in 650ms max!
    (function() {
      setTimeout(function() {
        var modal = document.getElementById("startupSplashModal");
        if (modal) {
          modal.style.opacity = "0";
          setTimeout(function() {
            modal.classList.add("hidden");
            modal.style.display = "none";
          }, 200);
        }
      }, 650);
    })();

const globalLanguagesList = [
      { code: 'en', short: 'EN', label: '🇬🇧 English', rtl: false, regionKey: 'US_UK' },
      { code: 'ar', short: 'AR', label: '🇸🇦 Arabic (العربية)', rtl: true, regionKey: 'AR' },
      { code: 'ur', short: 'UR', label: '🇵🇰 Urdu (اردو)', rtl: true, regionKey: 'PK' },
      { code: 'hi', short: 'HI', label: '🇮🇳 Hindi (हिन्दी)', rtl: false, regionKey: 'GLOBAL' },
      { code: 'bn', short: 'BN', label: '🇧🇩 Bengali (বাংলা)', rtl: false, regionKey: 'BD' },
      { code: 'tr', short: 'TR', label: '🇹🇷 Turkish (Türkçe)', rtl: false, regionKey: 'GLOBAL' },
      { code: 'ms', short: 'MS', label: '🇲🇾 Malay (Melayu)', rtl: false, regionKey: 'GLOBAL' },
      { code: 'id', short: 'ID', label: '🇮🇩 Indonesian (Bahasa)', rtl: false, regionKey: 'GLOBAL' },
      { code: 'fr', short: 'FR', label: '🇫🇷 French (Français)', rtl: false, regionKey: 'US_UK' },
      { code: 'ru', short: 'RU', label: '🇷🇺 Russian (Русский)', rtl: false, regionKey: 'GLOBAL' }
    ];

    // HISN AL-MUSLIM 15 ESSENTIAL MULTILINGUAL DUAS
    const hisnAlMuslimDuas = [
      { id: "d1", arabic: "بِسْمِ اللَّهِ وَعَلَى بَرَكَةِ اللَّهِ", title: { en: "1. Dua Before Eating Food", ur: "1. کھانا شروع کرنے کی دعا", bn: "১. খাবার শুরু করার দোয়া", hi: "1. खाना शुरू करने की दुआ", ar: "١. دعاء قبل الطعام" }, trans: { en: "In the name of Allah and with the blessings of Allah.", ur: "اللہ کے نام سے اور اللہ کی برکت پر ہم کھانا شروع کرتے ہیں۔", bn: "আল্লাহর নামে এবং আল্লাহর বরকতের ওপর ভরসা করে শুরু করছি।", hi: "अल्लाह के नाम से और अल्लाह की बरकत पर खाना शुरू करता हूँ।", ar: "البدء باسم الله والتوكل على بركته في الطعام." } },
      { id: "d2", arabic: "بِسْمِ اللَّهِ أَوَّلَهُ وَآخِرَهُ", title: { en: "2. If You Forget Bismillah at Start", ur: "2. شروع میں بسم اللہ بھول جانے کی دعا", bn: "২. শুরুতে বিসমিল্লাহ ভুলে গেলে দোয়া", hi: "2. शुरू में बिस्मिल्लाह भूल जाने की दुआ", ar: "٢. إذا نسي التسمية في أول الطعام" }, trans: { en: "In the name of Allah, in its beginning and its end.", ur: "اللہ کے نام سے اس کھانے کے اول اور آخر میں۔", bn: "এর শুরুতে এবং শেষে আল্লাহর নামে।", hi: "अल्लाह के नाम से इसके शुरू और आख़िर में।", ar: "ذكر اسم الله على أول الطعام وآخره." } },
      { id: "d3", arabic: "الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ", title: { en: "3. Dua After Finishing a Meal", ur: "3. کھانا کھانے کے بعد کی دعا", bn: "৩. খাবার শেষ করার পর দোয়া", hi: "3. खाना खाने کے بعد کی دعا", ar: "٣. الدعاء بعد الفراغ من الطعام" }, trans: { en: "Praise be to Allah Who fed me this and provided it without any power or strength from me.", ur: "شکر ہے اس اللہ کا جس نے میری طاقت کے بغیر مجھے یہ کھانا عطا فرمایا۔", bn: "সকল প্রশংসা আল্লাহর যিনি আমার শক্তি ছাড়াই আমাকে এই আহার দিয়েছেন।", hi: "शुक्र है अल्लाह का जिसने मेरी ताक़त के बिना मुझे यह रिज़्क़ दिया।", ar: "شكر الله على إطعامه ورزقه." } },
      { id: "d4", arabic: "اللَّهُمَّ بَارِكْ لَنَا فِيهِ وَزِدْنَا مِنْهُ", title: { en: "4. Dua When Drinking Milk", ur: "4. دودھ پینے کی دعا", bn: "৪. দুধ পান করার দোয়া", hi: "4. दूध पीने की दुआ", ar: "٤. الدعاء عند شرب اللبن" }, trans: { en: "O Allah, bless it for us and grant us even more of it.", ur: "اے اللہ! ہمارے لیے اس میں برکت دے اور ہمیں اس سے مزید عطا فرما۔", bn: "হে আল্লাহ! এতে আমাদের বরকত দিন এবং তা আরও বাড়িয়ে দিন।", hi: "ऐ अल्लाह! इसमें बरकत दे और हमें इससे ज़्यादा अता फ़रमा।", ar: "طلب البركة والزيادة من الله في اللبن." } },
      { id: "d5", arabic: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا", title: { en: "5. Dua Before Going to Sleep", ur: "5. سونے سے پہلے کی دعا", bn: "৫. ঘুমানোর আগের দোয়া", hi: "5. सोने से पहले की दुआ", ar: "٥. دعاء النوم" }, trans: { en: "In Your name, O Allah, I die and I live.", ur: "اے اللہ! میں تیرے ہی نام کے ساتھ سوتا ہوں اور جاگتا ہوں۔", bn: "হে আল্লাহ! আপনার নামেই আমি ঘুমাই এবং জাগ্রত হই।", hi: "ऐ अल्लाह! मैं तेरे ही नाम के साथ सोता और जागता हूँ।", ar: "باسم الله ننام وعلى اسمه نستيقظ." } },
      { id: "d6", arabic: "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ", title: { en: "6. Dua Upon Waking Up", ur: "6. نیند سے جاگنے کی دعا", bn: "৬. ঘুম থেকে ওঠার দোয়া", hi: "6. नींद से जागने की दुआ", ar: "٦. دعاء الاستيقاظ من النوم" }, trans: { en: "All praise belongs to Allah Who gave us life after having caused us to die, and unto Him is the resurrection.", ur: "شکر ہے اللہ کا جس نے ہمیں نیند کے بعد زندگی بخشی اور اسی کی طرف لوٹنا ہے۔", bn: "সকল প্রশংসা আল্লাহর যিনি ঘুমের পর আমাদের জীবন দান করলেন এবং তাঁর দিকেই পুনরুত্থান।", hi: "शुक्र है अल्लाह का जिसने नींद के बाद हमें ज़िंदगी दी और उसी की तरफ़ उठना है।", ar: "حمد الله على نعمة الحياة بعد النوم وإليه النشور." } },
      { id: "d7", arabic: "بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", title: { en: "7. Dua When Leaving Home", ur: "7. گھر سے نکلنے کی دعا", bn: "৭. ঘর থেকে বের হওয়ার দোয়া", hi: "7. घर से निकलने की दुआ", ar: "٧. دعاء الخروج من المنزل" }, trans: { en: "In the name of Allah, I place my trust in Allah, and there is no power nor strength except with Allah.", ur: "اللہ کے نام سے، میں نے اللہ پر بھروسہ کیا، اور طاقت و قوت صرف اللہ ہی کی طرف سے ہے۔", bn: "আল্লাহর নামে, আল্লাহর ওপর ভরসা করলাম, আর আল্লাহর সাহায্য ছাড়া কোনো শক্তি নেই।", hi: "अल्लाह के नाम से, मैंने अल्लाह पर भरोसा किया, और अल्लाह के सिवा कोई ताक़त नहीं।", ar: "التوكل الكامل على الله تعالى عند الخروج من المنزل." } },
      { id: "d8", arabic: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ", title: { en: "8. Dua Before Entering Restroom", ur: "8. بیت الخلاء میں داخل ہونے کی دعا", bn: "৮. টয়লেটে প্রবেশের দোয়া", hi: "8. बैतुल ख़ला में जाने की दुआ", ar: "٨. دعاء دخول الخلاء" }, trans: { en: "O Allah, I seek refuge in You from all male and female impure devils.", ur: "اے اللہ! میں ناپاک جنوں اور جنیوں سے تیری پناہ مانگتا ہوں۔", bn: "হে আল্লাহ! আমি অপবিত্র শয়তানের অনিষ্ট থেকে আপনার কাছে আশ্রয় চাই।", hi: "ऐ अल्लाह! मैं नापाक जिन्नात और शैतानों से तेरी पनाह मांगता हूँ।", ar: "الاستعاذة بالله من الخبث والخبائث والشياطين." } },
      { id: "d9", arabic: "رَّبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا", title: { en: "9. Dua for Parents' Mercy", ur: "9. والدین کے لیے رحمت کی دعا", bn: "৯. পিতা-মাতার জন্য দোয়া", hi: "9. माता-पिता के लिए दुआ", ar: "٩. الدعاء للوالدين بالرحمة" }, trans: { en: "My Lord, have mercy upon them as they brought me up when I was small.", ur: "اے میرے رب! میرے والدین پر رحم فرما جیسا انہوں نے بچپن میں میری پرورش کی۔", bn: "হে আমার রব! তাঁদের প্রতি দয়া করুন, যেভাবে তাঁরা শৈশবে আমাকে লালন-পালন করেছেন।", hi: "ऐ मेरे रब! उन दोनों पर रहम फ़रमा जैसा कि उन्होंने बचपन में मुझे पाला।", ar: "طلب الرحمة والمغفرة للوالدين جزاء تربيتهما في الصغر." } },
      { id: "d10", arabic: "رَبِّ زِدْنِي عِلْمًا", title: { en: "10. Dua for Increase in Knowledge", ur: "10. علم میں اضافے کی دعا", bn: "১০. জ্ঞান বৃদ্ধির দোয়া", hi: "10. इल्म में इज़ाफ़े की दुआ", ar: "١٠. دعاء طلب زيادة العلم" }, trans: { en: "My Lord, increase me in knowledge.", ur: "اے میرے رب! میرے علم میں اضافہ فرما۔", bn: "হে আমার প্রতিপালক! আমার জ্ঞান বৃদ্ধি করে দিন।", hi: "ऐ मेरे रब! मेरे इल्म में इज़ाफ़ा फ़रما।", ar: "سؤال الله تبارك وتعالى الزيادة في العلم النافع." } },
      { id: "d11", arabic: "اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ", title: { en: "11. Dua When Entering the Masjid", ur: "11. مسجد میں داخل ہونے کی دعا", bn: "১১. মসজিদে প্রবেশের দোয়া", hi: "11. मस्जिद में दाख़िल होने की दुआ", ar: "١١. دعاء دخول المسجد" }, trans: { en: "O Allah, open the doors of Your mercy for me.", ur: "اے اللہ! میرے لیے اپنی رحمت کے دروازے کھول دے۔", bn: "হে আল্লাহ! আমার জন্য আপনার রহমতের দরজাসমূহ খুলে দিন।", hi: "ऐ अल्लाह! मेरे लिए अपनी रहमत के दरवाज़े खोल दे।", ar: "اللهم افتح لي أبواب رحمتك وفضلك عند دخول المسجد." } },
      { id: "d12", arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ", title: { en: "12. Dua When Leaving the Masjid", ur: "12. مسجد سے نکلنے کی دعا", bn: "১২. মসজিদ থেকে বের হওয়ার দোয়া", hi: "12. मस्जिद से निकलने की दुआ", ar: "١٢. دعاء الخروج من المسجد" }, trans: { en: "O Allah, verily I ask You of Your bounty.", ur: "اے اللہ! میں تجھ سے تیرے فضل کا طلب گار ہوں۔", bn: "হে আল্লাহ! আমি আপনার অনুগ্রহ ও বরকত প্রার্থনা করছি।", hi: "ऐ अल्लाह! मैं तुझसे तेरे फ़ज़्ल का सवाल करता हूँ।", ar: "اللهم إني أسألك من فضلك ورزقك عند الخروج من المسجد." } },
      { id: "d13", arabic: "سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ", title: { en: "13. Dua for Riding a Vehicle & Travel", ur: "13. سواری اور سفر کی دعا", bn: "১৩. যানবাহনে চড়ার ও সফরের দোয়া", hi: "13. सवारी और सफ़र की दुआ", ar: "١٣. دعاء ركوب الدابة والسفر" }, trans: { en: "Glory be to Him Who has subjected this to us, and to our Lord we shall return.", ur: "پاک ہے وہ ذات جس نے اس سواری کو ہمارے تابع کر دیا اور ہم اپنے رب ہی کی طرف لوٹنے والے ہیں۔", bn: "পবিত্র সেই সত্তা যিনি এটিকে আমাদের বশীভূত করে দিয়েছেন এবং আমরা আমাদের রবের দিকেই ফিরে যাব।", hi: "पाक है वो ज़ात जिसने इसको हमारे ताबे कर दिया और हम अपने रब की तरफ़ पलटने वाले हैं।", ar: "تسبيح الله تعالى على تسخير وسائل النقل والتذكير بالمصير إليه." } },
      { id: "d14", arabic: "اللَّهُمَّ كَمَا حَسَّنْتَ خَلْقِي فَحَسِّنْ خُلُقِي", title: { en: "14. Dua When Looking in the Mirror", ur: "14. آئینہ دیکھنے کی دعا", bn: "১৪. আয়না দেখার দোয়া", hi: "14. आईना देखने की दुआ", ar: "١٤. دعاء النظر في المرآة" }, trans: { en: "O Allah, just as You made my appearance beautiful, make my character beautiful too.", ur: "اے اللہ! جس طرح تو نے میری صورت خوبصورت بنائی ہے، میرے اخلاق بھی اچھے بنا دے۔", bn: "হে আল্লাহ! যেভাবে আমার বাহ্যিক রূপ সুন্দর করেছেন, সেভাবে আমার চরিত্রও সুন্দর করে দিন।", hi: "ऐ अल्लाह! जैसे तूने मेरी सूरत अच्छी बनाई है, वैसे ही मेरे अख़लाक़ भी अच्छे कर दे।", ar: "سؤال الله تعالى كمال الأدب ومكارم الأخلاق كما جمّل الخَلْق." } },
      { id: "d15", arabic: "الْحَمْدُ لِلَّهِ — يَرْحَمُكَ اللَّهُ — يَهْدِيكُمُ اللَّهُ وَيُصْلِحُ بَالَكُمْ", title: { en: "15. Dua for Sneezing & Reply", ur: "15. چھینک آنے اور اس کے جواب کی دعا", bn: "১৫. হাঁচি দেওয়া ও তার উত্তরের দোয়া", hi: "15. छींक आने और उसके जवाब की दुआ", ar: "١٥. دعاء العطاس وتشميت العاطس" }, trans: { en: "Sneezer: 'Alhamdulillah'. Companion: 'Yarhamukallah'. Sneezer: 'Yahdikumullah wa yuslihu balakum'.", ur: "چھینکنے والا: الحمد لله۔ سننے والا: یرحمک الله۔ جواب: یہدیکم الله ویصلح بالکم۔", bn: "হাঁচিদাতা: আলহামদুলিল্লাহ। উত্তরদাতা: ইয়ারহামুকাল্লাহ। জবাব: ইয়াহদিকুমুল্লাহু ওয়া ইউসলিহু বালাকুম।", hi: "छींकने वाला: अल्हम्दुलिल्लाह। सुनने वाला: यरहमुकल्लाह। जवाब: यहदीकुमुल्लाह व युस्लिहु बालकुम।", ar: "يقول العاطس: الحمد لله، ويقول السامع: يرحمك الله، فيرد: يهديكم الله ويصلح بالكم." } }
    ];

    const defaultPromos = {
      GLOBAL: { text: "", imgUrl: "", linkUrl: "https://qaaftube.com", dir: "rtl" },
      PK: { text: "", imgUrl: "", linkUrl: "https://qaaftube.com", dir: "ltr" },
      US_UK: { text: "", imgUrl: "", linkUrl: "https://qaaftube.com", dir: "rtl" },
      BD: { text: "", imgUrl: "", linkUrl: "https://qaaftube.com", dir: "rtl" },
      AR: { text: "", imgUrl: "", linkUrl: "https://qaaftube.com", dir: "ltr" }
    };
    let regionalPromos = JSON.parse(localStorage.getItem('qaaf_regional_promos_v7')) || defaultPromos;
    let isPromoBarEnabled = localStorage.getItem("qaaf_promo_bar_enabled") === "true";

    let parentPin = localStorage.getItem('qaaf_parent_pin_6') || '123456';
    let currentUserEmail = localStorage.getItem('qaaf_user_email') || '';
    let favoriteVideoIds = JSON.parse(localStorage.getItem('qaaf_favorites') || '["v1"]');
    let parentWatchedIds = JSON.parse(localStorage.getItem('qaaf_parent_watched') || '["v10", "v8"]');
    let kidsWatchedIds = JSON.parse(localStorage.getItem('qaaf_kids_watched') || '["v1", "v3"]');
    let blockedVideoIds = JSON.parse(localStorage.getItem('qaaf_blocked_videos') || '[]');
    let bannedChannels = JSON.parse(localStorage.getItem('qaaf_banned_channels') || '[]');
    let flaggedVideosQueue = JSON.parse(localStorage.getItem('qaaf_flagged_queue') || '[{"videoId":"v2","title":"Stories of the Prophets — Prophet Ibrahim (AS)","channel":"One4Kids English","reason":"Old Video in Channel Not Suitable for Kids"}]');

    let isKidsLocked = false;
    let currentAppUILang = 'en';
    let preferredContentLang = 'en';
    let strictLanguageOnly = false;
    let currentCategory = 'all';
    let currentSortFilter = 'default';
    let currentPlayingVideoId = 'v1';
    let pendingFlagVideoId = null;
    let pendingParentPurpose = null;
    let pendingGameIdToAuthorize = null;
    let adCountdownTimer = null;
    let duaIndexCounter = 0;

    let isSupporterPro = localStorage.getItem('qaaf_supporter_pro') === 'true';
    let gameStars = parseInt(localStorage.getItem('qaaf_game_stars') || '0', 10);
    let activeMiniGameId = 'g1';
    let activeGameStage = 1;
    let currentActiveDua = null;
    let arabicPuzzleSelectedLetter = null;
    let arabicPuzzleMatchedLetters = [];
    let masjidWuduCurrentStepIndex = 0;

    // COMPACT VECTOR SVG CATEGORY ARTWORKS
    function buildSvgUri(svgStr) {
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr.trim());
    }
    const islamicCategoryArtworks = {
      quran: buildSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#021f15"/><stop offset="60%" stop-color="#063d27"/><stop offset="100%" stop-color="#0a1d13"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><g transform="translate(80,95)"><polygon points="40,85 115,55 155,75 80,105" fill="#18181b" stroke="#d4af37"/><polygon points="40,85 80,105 80,195 40,175" fill="#09090b"/><polygon points="80,105 155,75 155,165 80,195" fill="#18181b"/><polygon points="40,110 80,130 80,140 40,120" fill="#fbbf24"/><polygon points="80,130 155,100 155,110 80,140" fill="#fbbf24"/></g><g transform="translate(340,95)"><path d="M120,115 C95,100 45,105 35,120 L35,145 C45,130 95,125 120,140 Z" fill="#fef9c3"/><path d="M120,115 C145,100 195,105 205,120 L205,145 C195,130 145,125 120,140 Z" fill="#fef08a"/><polygon points="75,145 165,145 140,185 100,185" fill="#78350f"/></g><rect y="300" width="640" height="60" fill="#000" fill-opacity="0.65"/><text x="32" y="338" fill="#fff" font-family="sans-serif" font-weight="800" font-size="19">🕋 HOLY QURAN &amp; TAJWEED</text><text x="608" y="337" fill="#34d399" font-family="sans-serif" font-weight="700" font-size="12" text-anchor="end">QAAF AUTHENTIC RECITATION</text></svg>`),
      bayan: buildSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#041426"/><stop offset="50%" stop-color="#062e26"/><stop offset="100%" stop-color="#02131a"/></linearGradient></defs><rect width="640" height="360" fill="url(#b)"/><g transform="translate(240,65)"><circle cx="80" cy="100" r="65" stroke="#10b981" stroke-width="2" fill="none" opacity="0.35" stroke-dasharray="8,6"/><rect x="68" y="70" width="24" height="42" rx="12" fill="#10b981"/><path d="M60,95 C60,122 100,122 100,95" fill="none" stroke="#d4af37" stroke-width="3"/><line x1="80" y1="122" x2="80" y2="155" stroke="#d4af37" stroke-width="4"/><rect x="58" y="155" width="44" height="8" rx="4" fill="#d4af37"/></g><rect y="300" width="640" height="60" fill="#000" fill-opacity="0.65"/><text x="32" y="338" fill="#fff" font-family="sans-serif" font-weight="800" font-size="19">🎙️ ISLAMIC KNOWLEDGE &amp; BAYAN</text><text x="608" y="337" fill="#60a5fa" font-family="sans-serif" font-weight="700" font-size="12" text-anchor="end">SCHOLARS &amp; TARBIYAH</text></svg>`),
      stories: buildSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0b132b"/><stop offset="50%" stop-color="#2c1654"/><stop offset="100%" stop-color="#703210"/></linearGradient></defs><rect width="640" height="360" fill="url(#s)"/><path d="M190,60 A32,32 0 1 0 230,105 A25,25 0 1 1 190,60 Z" fill="#fde047"/><path d="M0,285 Q220,240 440,275 T640,260 L640,360 L0,360 Z" fill="#1e0b02"/><rect y="300" width="640" height="60" fill="#000" fill-opacity="0.65"/><text x="32" y="338" fill="#fff" font-family="sans-serif" font-weight="800" font-size="19">📖 STORIES OF THE PROPHETS</text><text x="608" y="337" fill="#fbbf24" font-family="sans-serif" font-weight="700" font-size="12" text-anchor="end">HISTORICAL &amp; INSPIRING</text></svg>`),
      kids_cartoon: buildSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="k" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#064e3b"/><stop offset="50%" stop-color="#0369a1"/><stop offset="100%" stop-color="#4338ca"/></linearGradient></defs><rect width="640" height="360" fill="url(#k)"/><g transform="translate(185,75)"><path d="M120,40 A45,45 0 1 0 175,100 A36,36 0 1 1 120,40 Z" fill="#fde047"/><path d="M70,140 C70,120 90,110 110,120 C125,100 155,100 170,120 C190,115 210,130 205,150 L80,180 C60,180 55,160 70,140 Z" fill="#fff" opacity="0.9"/></g><rect y="300" width="640" height="60" fill="#000" fill-opacity="0.65"/><text x="32" y="338" fill="#fff" font-family="sans-serif" font-weight="800" font-size="19">🌟 HALAL KIDS CARTOON</text><text x="608" y="337" fill="#fde047" font-family="sans-serif" font-weight="700" font-size="12" text-anchor="end">100% WHOLESOME &amp; SAFE</text></svg>`)
    };

    function getCategoryIslamicArtwork(category) {
      return islamicCategoryArtworks[category] || islamicCategoryArtworks.kids_cartoon;
    }

    // VERIFIED WORKING ISLAMIC YOUTUBE VIDEO IDS
    
    const defaultInitialVideos = [];

    const legacyPlaceholderMap = {
      'aqz-KE-bpKQ': 'tgYsKjUSf7s',
      'tPq2-K3N2pI': 'tgYsKjUSf7s',
      'M7lc1UVf-VE': '0r6BcBXZyUg',
      'c1Q7U5v7rBE': '0r6BcBXZyUg',
      'ysz5S6PUM-U': 'x2S2ghEPvjI',
      '5eocNXS3Gic': 'x2S2ghEPvjI',
      '9bZkp7q19f0': 'vZ96sXj5ngY',
      'YkQ5bUvO0Yg': 'vZ96sXj5ngY',
      'p8QfJ_g4s-A': '-5HQ9iH0zQY',
      'K8X2F7rG9mQ': 'iZapX4O3Q-U'
    };

    function sanitizeVideoItem(v) {
      let changed = false;
      let newYtId = v.ytId;
      if (legacyPlaceholderMap[v.ytId]) {
        newYtId = legacyPlaceholderMap[v.ytId];
        changed = true;
      }
      const isBuiltin = ['v1','v2','v3','v4','v5','v6','v7','v8','v9','v10'].includes(v.id);
      let customFlag = v.isCustomAdded;
      if (isBuiltin && customFlag !== false) {
        customFlag = false;
        changed = true;
      } else if (!isBuiltin && customFlag === undefined) {
        customFlag = true;
      }
      return { item: { ...v, ytId: newYtId, isCustomAdded: customFlag }, changed };
    }

    let videosData = defaultInitialVideos;
    let needsInitialScrubPush = false;
    try {
      const cached = localStorage.getItem('qaaf_videos_data');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let anyUpdated = false;
          videosData = parsed.map(v => {
            const res = sanitizeVideoItem(v);
            if (res.changed) anyUpdated = true;
            return res.item;
          });
          if (anyUpdated) {
            localStorage.setItem('qaaf_videos_data', JSON.stringify(videosData));
            needsInitialScrubPush = true;
          }
        }
      }
    } catch(e) {
      videosData = defaultInitialVideos;
    }

    const gamesData = [
      { id: "g1", title: "Quran Quiz Adventure", desc: "Interactive Islamic questions and rewards for kids.", installed: true, blockedByParent: false },
      { id: "g2", title: "Arabic Alphabet Puzzle", desc: "Match Alif to Yaa with authentic voice pronunciation.", installed: true, blockedByParent: false },
      { id: "g3", title: "🕌 Masjid & Wudu Builder", desc: "Learn Wudu steps and build peaceful Masjids.", installed: true, blockedByParent: false }
    ];

    function getModePriorityScore(video) {
      let score = 0;
      if (video.lang === preferredContentLang) score += 50;
      else if (video.universalQuran) score += 30;
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
    }


// BUILT-IN ISLAMIC SHORTS (BAYAN SHORTS FOR PARENTS & REMINDERS FOR KIDS)
    const defaultIslamicShorts = [];

    defaultIslamicShorts.forEach(sh => {
      if (!videosData.some(v => v.id === sh.id)) videosData.push(sh);
    });

    function isVideoShort(v) {
      return v.isShort === true || (v.title && v.title.toLowerCase().includes('#short'));
    }

    function playAdjacentShort(dir) {
      const shortsList = videosData.filter(v => isVideoShort(v) && (!isKidsLocked || v.kidsSafe) && !blockedVideoIds.includes(v.id));
      if (shortsList.length === 0) return;
      const curIdx = shortsList.findIndex(v => v.id === currentPlayingVideoId);
      const nextIdx = (curIdx + dir + shortsList.length) % shortsList.length;
      openVideoPlayer(shortsList[nextIdx].id);
    }

    window.handleQaafVideoLinkClick = function(e, videoId) {
      if (e) {
        if (!isKidsLocked && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) {
          return true;
        }
        e.preventDefault();
        e.stopPropagation();
      }
      try {
        openVideoPlayer(videoId);
      } catch (err) {
        console.error('Player open error:', err);
      }
      return false;
    };
    window.qaafGoHome = function() {
      if (window.isKidsTimeExpiredLock) return;
      window.qaafSelectedChannel = 'ALL';
      window.qaafActiveSearchQuery = '';
      currentCategory = 'all';
      currentSortFilter = 'default';
      window.qaafGridPageLimit = 24;
      var sInp = document.getElementById('qaafSearchInput');
      if (sInp) sInp.value = '';
      if (typeof closeVideoPlayer === 'function') closeVideoPlayer();
      if (typeof window.renderVideosNow === 'function') window.renderVideosNow();
    };

    function renderVideos() {
      const grid = document.getElementById('videoGrid');
      grid.innerHTML = '';
      document.getElementById('favCountBadge').innerText = favoriteVideoIds.length;

      const foundLang = globalLanguagesList.find(l => l.code === preferredContentLang);
      const langLabel = foundLang ? foundLang.label : preferredContentLang.toUpperCase();
      const langBadge = document.getElementById('feedActiveLangBadge');
      if (langBadge) {
        langBadge.innerText = langLabel;
        langBadge.className = isKidsLocked
          ? "bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-lg text-[11px] font-bold truncate max-w-[200px]"
          : "bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-lg text-[11px] font-bold truncate max-w-[200px]";
      }

      let allFiltered = videosData.filter(v => {
        if (blockedVideoIds.includes(v.id)) return false;
        if (bannedChannels.includes(v.channel)) return false;
        if (isKidsLocked && !v.kidsSafe) return false;
        if (currentCategory !== 'all' && v.category !== currentCategory) return false;
        if (strictLanguageOnly && v.lang !== preferredContentLang && !v.universalQuran) return false;
        if (currentSortFilter === 'favorites' && !favoriteVideoIds.includes(v.id)) return false;
        return true;
      });

      allFiltered.sort((a, b) => {
        if (currentSortFilter === 'recent') return b.createdAt - a.createdAt;
        if (currentSortFilter === 'viewed') return b.views - a.views;
        return getModePriorityScore(b) - getModePriorityScore(a);
      });

      const regularVideos = allFiltered.filter(v => !isVideoShort(v));
      const shortVideos = allFiltered.filter(v => isVideoShort(v));

      // 1. RENDER YOUTUBE-STYLE VERTICAL SHORTS SHELF AT TOP OF VIDEOS SECTION
      let shortsShelf = document.getElementById('qaafShortsShelf');
      if (!shortsShelf) {
        shortsShelf = document.createElement('div');
        shortsShelf.id = 'qaafShortsShelf';
        shortsShelf.className = 'mb-6';
        grid.parentNode.insertBefore(shortsShelf, grid);
      }

      if (shortVideos.length > 0) {
        let shortsCardsHtml = '';
        shortVideos.slice(0, 12).forEach(sh => {
          const categoryArtwork = getCategoryIslamicArtwork(sh.category);
          const thumbUrl = sh.customThumb || `https://i.ytimg.com/vi/${sh.ytId}/hqdefault.jpg`;
          shortsCardsHtml += `
            <a ${isKidsLocked ? '' : `href="?watch=${encodeURIComponent(sh.id)}"`} onclick="return handleQaafVideoLinkClick(event, '${sh.id}')" class="w-40 sm:w-48 shrink-0 bg-[#12151c] rounded-2xl overflow-hidden border border-white/10 hover:border-red-500/60 transition cursor-pointer group relative aspect-[9/16] flex flex-col justify-end shadow-lg no-underline text-inherit">
              <img src="${thumbUrl}" alt="" class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${categoryArtwork}';" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent"></div>
              <span class="absolute top-2.5 left-2.5 bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">⚡ Short</span>
              <div class="relative z-10 p-3 text-left">
                <h4 class="text-xs font-extrabold text-white line-clamp-2 leading-snug mb-1">${sh.title}</h4>
                <p class="text-[10px] text-slate-300 font-semibold truncate">${sh.channel}</p>
                <p class="text-[10px] text-emerald-400 font-bold mt-0.5">👁️ ${(sh.views / 1000).toFixed(1)}K views</p>
              </div>
            </a>`;
        });

        shortsShelf.innerHTML = `
          <div class="flex items-center justify-between mb-2.5 px-1">
            <div class="flex items-center gap-2">
              <span class="bg-red-600 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold shadow">⚡</span>
              <h3 class="text-sm sm:text-base font-extrabold text-white tracking-tight">QAAF Islamic Shorts &amp; Quick Bayans</h3>
            </div>
            <span class="text-[11px] text-slate-400 font-semibold">Swipe / Scroll ➔</span>
          </div>
          <div class="flex items-center gap-3 overflow-x-auto pb-2">${shortsCardsHtml}</div>
        `;
        shortsShelf.classList.remove('hidden');
      } else {
        shortsShelf.classList.add('hidden');
      }

      // 2. RENDER REGULAR 16:9 VIDEOS GRID (BATCHED LAZY RENDERING)
      window.qaafActiveRegularVideos = regularVideos;
      const initialLimit = window.qaafGridPageLimit || 24;
      const displayedVideos = regularVideos.slice(0, initialLimit);

      if (regularVideos.length === 0 && shortVideos.length === 0) {
        grid.innerHTML = `
          <div class="col-span-full py-16 text-center">
            <div class="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-3xl">📭</div>
            <p class="text-white font-bold text-sm">No videos found</p>
            <p class="text-slate-400 text-xs mt-1">Try selecting another category or clearing search filters.</p>
          </div>
        `;
      } else {
        displayedVideos.forEach(video => {
          const card = createQaafVideoCardElement(video);
          grid.appendChild(card);
        });
      }

      renderQaafLoadMoreControls(regularVideos.length, displayedVideos.length);
    }

    function createQaafVideoCardElement(video) {
      const isPreferred = (video.lang === preferredContentLang);
      const isFav = favoriteVideoIds.includes(video.id);
      const categoryArtwork = getCategoryIslamicArtwork(video.category);
      const thumbHq = `https://i.ytimg.com/vi/${video.ytId}/hqdefault.jpg`;
      const thumbMq = `https://i.ytimg.com/vi/${video.ytId}/mqdefault.jpg`;
      const cardThumb = video.customThumb || thumbHq;
      const card = document.createElement('div');
      card.className = `bg-[#131720]/95 hover:bg-[#1b212d] rounded-xl overflow-hidden border ${isPreferred ? 'border-emerald-500/60 shadow-lg shadow-emerald-950/30' : 'border-white/10'} transition group relative`;
      card.dataset.videoId = video.id;
      card.innerHTML = `
        <a ${isKidsLocked ? '' : `href="?watch=${encodeURIComponent(video.id)}"`} onclick="return handleQaafVideoLinkClick(event, '${video.id}')" class="block relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden cursor-pointer no-underline text-inherit">
          <img src="${cardThumb}" alt="" class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none transition-opacity duration-300" loading="lazy" decoding="async" onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='${thumbMq}';}else{this.onerror=null;this.src='${categoryArtwork}';}" />

          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="w-12 h-12 rounded-full bg-red-600/95 group-hover:scale-110 transition flex items-center justify-center shadow-lg">
              <span class="text-white text-lg ml-0.5">▶</span>
            </div>
          </div>

          <div class="absolute top-2 left-2 flex flex-wrap gap-1 z-10 pointer-events-none">
            ${isPreferred ? '<span class="bg-emerald-500 text-black text-[10px] font-extrabold px-2 py-0.5 rounded shadow">⭐ Preferred</span>' : ''}
          </div>

          <span class="absolute bottom-2 right-2 bg-black/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10 pointer-events-none">${video.duration || '12:00'}</span>
          <span class="absolute bottom-2 left-2 bg-black/75 text-slate-300 text-[10px] px-1.5 py-0.5 rounded z-10 pointer-events-none">👁️ ${((video.views || 2500) / 1000).toFixed(1)}K</span>
        </a>

        <div class="absolute top-2 right-2 z-10 flex items-center gap-1">
          <button onclick="toggleFavoriteVideo('${video.id}', event)" class="w-7 h-7 rounded-full bg-black/75 hover:bg-black flex items-center justify-center text-xs shadow border border-white/10" title="Favorite">
            ${isFav ? '❤️' : '🤍'}
          </button>
          <button onclick="openFlagModal('${video.id}', event)" class="w-7 h-7 rounded-full bg-black/75 hover:bg-rose-950 flex items-center justify-center text-xs shadow border border-white/10" title="Report">
            🚩
          </button>
        </div>

        <a ${isKidsLocked ? '' : `href="?watch=${encodeURIComponent(video.id)}"`} onclick="return handleQaafVideoLinkClick(event, '${video.id}')" class="block p-3 cursor-pointer no-underline text-inherit">
          <h3 class="text-sm font-bold text-white line-clamp-2 leading-snug">${video.title}</h3>
          <div class="flex items-center justify-between mt-2 text-[11px] text-slate-400">
            <span class="truncate max-w-[150px]">✅ ${video.channel}</span>
            <span class="text-emerald-400 font-semibold shrink-0">${video.category === 'bayan' ? '🎙️ Family/Adult' : '🧒 Kids Safe'}</span>
          </div>
        </a>
      `;
      return card;
    }

    function renderQaafLoadMoreControls(totalCount, displayedCount) {
      const videosSection = document.getElementById('videosSection');
      if (!videosSection) return;
      let loadBox = document.getElementById('qaafLoadMoreBox');
      if (!loadBox) {
        loadBox = document.createElement('div');
        loadBox.id = 'qaafLoadMoreBox';
        loadBox.className = 'mt-6 mb-8 flex flex-col items-center justify-center';
        videosSection.appendChild(loadBox);
      }

      if (displayedCount >= totalCount) {
        loadBox.innerHTML = '';
        loadBox.classList.add('hidden');
        return;
      }

      loadBox.classList.remove('hidden');
      const remaining = totalCount - displayedCount;
      loadBox.innerHTML = `
        <button id="qaafLoadMoreBtn" type="button" onclick="qaafLoadMoreVideos()" class="group px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-emerald-950/40 border border-emerald-400/40 hover:scale-[1.02] active:scale-[0.98] transition flex items-center gap-2 cursor-pointer">
          <span class="text-base group-hover:translate-y-0.5 transition-transform">📥</span>
          <span>مزید ویڈیوز دیکھیں / Load More Videos</span>
          <span class="bg-black/40 text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-full ml-1">(${remaining} remaining)</span>
        </button>
        <div id="qaafInfiniteSentinel" class="h-8 w-full"></div>
      `;

      if (window.IntersectionObserver) {
        if (window.qaafSentinelObserver) window.qaafSentinelObserver.disconnect();
        const sentinel = document.getElementById('qaafInfiniteSentinel');
        if (sentinel) {
          window.qaafSentinelObserver = new IntersectionObserver((entries) => {
            if (entries[0] && entries[0].isIntersecting) {
              qaafLoadMoreVideos();
            }
          }, { rootMargin: '300px' });
          window.qaafSentinelObserver.observe(sentinel);
        }
      }
    }

    window.qaafLoadMoreVideos = function() {
      if (window.qaafIsLoadingMoreBatch) return;
      window.qaafIsLoadingMoreBatch = true;
      const grid = document.getElementById('videoGrid');
      if (!grid || !window.qaafActiveRegularVideos) {
        window.qaafIsLoadingMoreBatch = false;
        return;
      }
      const currentCardsCount = grid.querySelectorAll('[data-video-id]').length;
      const nextBatch = window.qaafActiveRegularVideos.slice(currentCardsCount, currentCardsCount + 24);
      if (nextBatch.length > 0) {
        nextBatch.forEach(video => {
          const card = createQaafVideoCardElement(video);
          grid.appendChild(card);
        });
        window.qaafGridPageLimit = currentCardsCount + nextBatch.length;
        renderQaafLoadMoreControls(window.qaafActiveRegularVideos.length, currentCardsCount + nextBatch.length);
      } else {
        renderQaafLoadMoreControls(window.qaafActiveRegularVideos.length, window.qaafActiveRegularVideos.length);
      }
      setTimeout(() => { window.qaafIsLoadingMoreBatch = false; }, 200);
    };

    function showRandomHisnDua() {
      if (!hisnAlMuslimDuas || hisnAlMuslimDuas.length === 0) return;
      const dua = hisnAlMuslimDuas[duaIndexCounter % hisnAlMuslimDuas.length];
      duaIndexCounter++;
      currentActiveDua = dua;
      const lang = preferredContentLang;
      const badge = document.getElementById('duaLangBadge');
      if (badge) badge.innerText = lang.toUpperCase();
      const heading = document.getElementById('duaHeadingText');
      if (heading) heading.innerText = (dua.title && dua.title[lang]) || (dua.title && dua.title.en) || "Dua from Hisn al-Muslim";
      const arabicEl = document.getElementById('duaArabicText');
      if (arabicEl) arabicEl.innerText = dua.arabic;
      const transEl = document.getElementById('duaTranslationText');
      if (transEl) transEl.innerText = (dua.trans && dua.trans[lang]) || (dua.trans && dua.trans.en) || "";
      resetDuaAudioBtn();
    }

    function playCurrentDuaAudio() {
      if (!currentActiveDua || !currentActiveDua.arabic || !('speechSynthesis' in window)) return;
      const btn = document.getElementById('duaAudioPlayBtn');
      const icon = document.getElementById('duaAudioIcon');
      const text = document.getElementById('duaAudioBtnText');

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentActiveDua.arabic);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.82;
      const voices = window.speechSynthesis.getVoices();
      const arVoice = voices.find(v => (v.lang && (v.lang.startsWith('ar') || v.lang.includes('ar-SA'))));
      if (arVoice) utterance.voice = arVoice;

      if (icon) icon.innerText = '🔉';
      if (text) text.innerText = 'Reciting...';
      if (btn) btn.classList.add('ring-2', 'ring-emerald-400', 'bg-blue-700');

      utterance.onend = () => { resetDuaAudioBtn(); };
      utterance.onerror = () => { resetDuaAudioBtn(); };
      window.speechSynthesis.speak(utterance);
    }

    function resetDuaAudioBtn() {
      const btn = document.getElementById('duaAudioPlayBtn');
      const icon = document.getElementById('duaAudioIcon');
      const text = document.getElementById('duaAudioBtnText');
      if (icon) icon.innerText = '🔊';
      if (text) text.innerText = 'Listen Dua Audio';
      if (btn) btn.classList.remove('ring-2', 'ring-emerald-400', 'bg-blue-700');
    }

    async function fetchHisnAlMuslimFromGitHub() {
      const GITHUB_HISN_URL = 'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/ara-hisn.json';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(GITHUB_HISN_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && Array.isArray(data.hadiths) && data.hadiths.length > 0) {
          const fetchedDuas = data.hadiths.slice(0, 35).map((h, i) => ({
            id: `gh_${h.hadithnumber || i + 1}`,
            arabic: h.text,
            title: {
              en: `Hisn al-Muslim Authentic Dua #${h.hadithnumber || i + 1}`,
              ur: `حصن المسلم مستند دعا #${h.hadithnumber || i + 1}`,
              bn: `হিসনুল মুসলিম সহীহ দোয়া #${h.hadithnumber || i + 1}`,
              hi: `हिस्नुल मुस्लिम मसनून दुआ #${h.hadithnumber || i + 1}`,
              ar: `دعاء من أذكار حصن المسلم #${h.hadithnumber || i + 1}`
            },
            trans: {
              en: "Authentic supplication recorded in Hisn al-Muslim (Fortress of the Muslim).",
              ur: "حصن المسلم سے ماخوذ مبارک مسنون دعا۔",
              bn: "হিসনুল মুসলিম থেকে সংগৃহীত সহীহ দোয়া।",
              hi: "हिस्नुल मुस्लिम से ली गई मसनून दुआ।",
              ar: "دعاء مأثور ومبارك من كتاب حصن المسلم."
            }
          }));
          fetchedDuas.forEach(fd => {
            if (!hisnAlMuslimDuas.some(d => d.arabic === fd.arabic)) hisnAlMuslimDuas.push(fd);
          });
        }
      } catch (err) {
        console.log('Hisn al-Muslim local 15 Duas active.');
      }
    }

    // =========================================================================
    // SMART FIREBASE CLOUD SYNC ENGINE WITH 30-MIN QUOTA CACHE (FOR MILLIONS OF USERS)
    // =========================================================================
    function showSyncToast(msg, isError = false) {
      let toast = document.getElementById('cloudSyncToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'cloudSyncToast';
        document.body.appendChild(toast);
      }
      toast.className = isError
        ? 'fixed top-16 right-4 z-50 bg-slate-900/95 border border-rose-500/60 text-rose-200 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 transition-all duration-300'
        : 'fixed top-16 right-4 z-50 bg-slate-900/95 border border-emerald-500/60 text-emerald-200 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 transition-all duration-300';
      toast.innerHTML = `<span>${isError ? '⚠️' : '⚡'}</span> <span>${msg}</span>`;
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => { toast.className += ' opacity-0 pointer-events-none'; }, 3000);
    }

    const DEFAULT_FIREBASE_RTDB_URL = 'https://qaaftube-6f251-default-rtdb.firebaseio.com';
    const SMART_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes smart cache to save 90% Firebase quota

    const qaafCloudSync = {
      firebaseUrl: DEFAULT_FIREBASE_RTDB_URL,
      broadcastChannel: ('BroadcastChannel' in window) ? new BroadcastChannel('qaaf_live_sync_channel') : null,
      isSyncing: false,

      init() {
        const OFFICIAL_FIREBASE_URL = "https://qaaftube-6f251-default-rtdb.firebaseio.com";
        let savedDb = localStorage.getItem('qaaf_firebase_db_url');
        if (!savedDb || savedDb !== OFFICIAL_FIREBASE_URL) {
          savedDb = OFFICIAL_FIREBASE_URL;
          localStorage.setItem('qaaf_firebase_db_url', OFFICIAL_FIREBASE_URL);
        }
        this.firebaseUrl = OFFICIAL_FIREBASE_URL;

        if (this.broadcastChannel) {
          this.broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'STATE_UPDATE') {
              this.applyIncomingState(event.data.payload, 'tab');
            }
          };
        }

        window.addEventListener('storage', (e) => {
          if (['qaaf_videos_data', 'qaaf_flagged_queue', 'qaaf_blocked_videos', 'qaaf_banned_channels', 'qaaf_regional_promos_v7', 'qaaf_promo_bar_enabled'].includes(e.key)) {
            this.loadFromLocal();
          }
        });

        if (needsInitialScrubPush) {
          this.pushState('Scrubbed Local Legacy Placeholders');
          return;
        }

        // Smart Quota Cache Check: Only pull from Firebase if cache is older than 30 mins
        const lastSyncTs = parseInt(localStorage.getItem('qaaf_cloud_last_sync_ts') || '0', 10);
        const hasCachedVideos = !!localStorage.getItem('qaaf_videos_data');
        if (hasCachedVideos && (Date.now() - lastSyncTs < SMART_CACHE_TTL_MS)) {
          this.updateStatusBadge('connected');
        } else {
          this.pullFromCloud(true);
        }
      },

      cleanFirebaseUrl(url) {
        if (!url) return '';
        return url.trim().replace(/\/+$/, '').replace(/\.json$/, '');
      },

      getEndpointUrl() {
        const clean = this.cleanFirebaseUrl(this.firebaseUrl) || DEFAULT_FIREBASE_RTDB_URL;
        return `${clean}/qaaf_global_state.json`;
      },

      getStatePayload() {
        return { videosData, flaggedVideosQueue, parentRequestsQueue, blockedVideoIds, bannedChannels, regionalPromos, isPromoBarEnabled, qaafSecurityToken: 'QAAF_PROTECTED_TOKEN_786_99_MAKKAH', updatedAt: Date.now() };
      },

      applyIncomingState(payload, source = 'local') {
        if (!payload) return;
        if (Array.isArray(payload.parentRequestsQueue)) {
          parentRequestsQueue = payload.parentRequestsQueue;
          localStorage.setItem('qaaf_parent_requests', JSON.stringify(parentRequestsQueue));
          renderAdminParentRequests();
        }
        if (Array.isArray(payload.videosData)) {
          // If cloud returns empty array but local has custom channels/videos, DO NOT WIPE LOCAL!
          if (source === 'cloud' && payload.videosData.length === 0 && videosData && videosData.length > 0) {
            console.warn('[QaafSync] Cloud returned empty catalog but local has ' + videosData.length + ' videos. Preserving local and uploading to Firebase!');
            this.pushState('Syncing local catalog to Firebase Cloud');
            return;
          }

          let scrubbed = false;
          videosData = payload.videosData.map(v => {
            const res = sanitizeVideoItem(v);
            if (res.changed) scrubbed = true;
            return res.item;
          });
          localStorage.setItem('qaaf_videos_data', JSON.stringify(videosData));
          if (scrubbed && source === 'cloud') this.pushState('Scrubbed Legacy Video Placeholders');
        }
        if (Array.isArray(payload.flaggedVideosQueue)) {
          flaggedVideosQueue = payload.flaggedVideosQueue;
          localStorage.setItem('qaaf_flagged_queue', JSON.stringify(flaggedVideosQueue));
        }
        if (Array.isArray(payload.blockedVideoIds)) {
          blockedVideoIds = payload.blockedVideoIds;
          localStorage.setItem('qaaf_blocked_videos', JSON.stringify(blockedVideoIds));
        }
        if (Array.isArray(payload.bannedChannels)) {
          bannedChannels = payload.bannedChannels;
          localStorage.setItem('qaaf_banned_channels', JSON.stringify(bannedChannels));
        }
        if (payload.regionalPromos && typeof payload.regionalPromos === 'object') {
          regionalPromos = payload.regionalPromos;
          localStorage.setItem('qaaf_regional_promos_v7', JSON.stringify(regionalPromos));
        }
        if (payload.isPromoBarEnabled !== undefined) {
          isPromoBarEnabled = !!payload.isPromoBarEnabled;
          localStorage.setItem('qaaf_promo_bar_enabled', isPromoBarEnabled.toString());
        }
        renderVideos();
        renderAdminFlaggedQueue();
        syncRegionalPromoBar();
        syncAccountUI();
        if (source === 'tab') showSyncToast('⚡ Live update received from another tab!');
        else if (source === 'cloud') showSyncToast('☁️ Live state synced from Firebase Cloud!');
      },
      loadFromLocal() {
        try {
          const v = localStorage.getItem('qaaf_videos_data'); if (v) videosData = JSON.parse(v);
          const f = localStorage.getItem('qaaf_flagged_queue'); if (f) flaggedVideosQueue = JSON.parse(f);
          const b = localStorage.getItem('qaaf_blocked_videos'); if (b) blockedVideoIds = JSON.parse(b);
          const c = localStorage.getItem('qaaf_banned_channels'); if (c) bannedChannels = JSON.parse(c);
          const p = localStorage.getItem('qaaf_regional_promos_v7'); if (p) regionalPromos = JSON.parse(p);
          const pe = localStorage.getItem('qaaf_promo_bar_enabled'); if (pe !== null) isPromoBarEnabled = (pe !== 'false');
          renderVideos(); renderAdminFlaggedQueue(); syncRegionalPromoBar(); syncAccountUI();
        } catch (e) {}
      },

      async pushState(actionLabel = 'Changes Saved') {
        const payload = this.getStatePayload();
        localStorage.setItem('qaaf_videos_data', JSON.stringify(payload.videosData));
        localStorage.setItem('qaaf_flagged_queue', JSON.stringify(payload.flaggedVideosQueue));
        localStorage.setItem('qaaf_blocked_videos', JSON.stringify(payload.blockedVideoIds));
        localStorage.setItem('qaaf_banned_channels', JSON.stringify(payload.bannedChannels));
        localStorage.setItem('qaaf_regional_promos_v7', JSON.stringify(payload.regionalPromos));
        localStorage.setItem('qaaf_promo_bar_enabled', payload.isPromoBarEnabled.toString());

        if (this.broadcastChannel) {
          try { this.broadcastChannel.postMessage({ type: 'STATE_UPDATE', payload }); } catch (e) {}
        }

        const endpoint = this.getEndpointUrl();
        if (endpoint) {
          try {
            this.isSyncing = true;
            this.updateStatusBadge('syncing');
            const res = await fetch(endpoint, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const nowTime = new Date().toLocaleTimeString();
            localStorage.setItem('qaaf_cloud_last_synced', nowTime);
            localStorage.setItem('qaaf_cloud_last_sync_ts', Date.now().toString());
            this.updateStatusBadge('connected');
            showSyncToast(`☁️ ${actionLabel} & synced live to Firebase Cloud!`);
          } catch (err) {
            this.updateStatusBadge('offline');
            showSyncToast(`⚡ ${actionLabel} (Local + Tabs active)`);
          } finally {
            this.isSyncing = false;
          }
        }
      },

      async pullFromCloud(silent = false) {
        const endpoint = this.getEndpointUrl();
        if (!endpoint) return;
        try {
          this.isSyncing = true;
          this.updateStatusBadge('syncing');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4500);
          const res = await fetch(endpoint, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const cloudData = await res.json();
          if (cloudData && typeof cloudData === 'object') {
            if (!Array.isArray(cloudData.videosData)) cloudData.videosData = [];
            this.applyIncomingState(cloudData, silent ? 'none' : 'cloud');
            const nowTime = new Date().toLocaleTimeString();
            localStorage.setItem('qaaf_cloud_last_synced', nowTime);
            localStorage.setItem('qaaf_cloud_last_sync_ts', Date.now().toString());
            this.updateStatusBadge('connected');
            if (!silent) showSyncToast('✅ Pulled latest state from Firebase Cloud!');
          }
        } catch (err) {
          this.updateStatusBadge('offline');
          if (!silent) showSyncToast('⚠️ Cloud unreachable. Using local cache.', true);
        } finally {
          this.isSyncing = false;
        }
      },

      updateStatusBadge(statusOverride) {
        const badge = document.getElementById('cloudSyncStatusBadge');
        const timeEl = document.getElementById('cloudSyncLastTime');
        const lastTime = localStorage.getItem('qaaf_cloud_last_synced') || 'Smart Cache Active';
        if (timeEl) timeEl.innerText = `Last Synced: ${lastTime}`;
        if (!badge) return;
        if (statusOverride === 'syncing') {
          badge.innerHTML = '<span>🔄</span> <span>Syncing Cloud...</span>';
        } else if (statusOverride === 'offline') {
          badge.innerHTML = '<span>⚠️</span> <span>Local Cache Active</span>';
        } else {
          badge.innerHTML = '<span>🟢</span> <span>Connected to Live Firebase Cloud (Smart Cache)</span>';
        }
      }
    };

    function adminSaveFirebaseUrl() {
      const input = document.getElementById('firebaseDbUrlInput');
      const cleanUrl = qaafCloudSync.cleanFirebaseUrl(input ? input.value.trim() : '');
      qaafCloudSync.firebaseUrl = cleanUrl;
      localStorage.setItem('qaaf_firebase_db_url', cleanUrl);
      if (input) input.value = cleanUrl;
      if (cleanUrl) qaafCloudSync.pullFromCloud(false);
    }
    
  // DIRECT 1-CLICK FORCE PUSH FROM ADMIN CONSOLE TO FIREBASE CLOUD
  window.adminForcePushCloud = async function() {
    try {
      const endpoint = "https://qaaftube-6f251-default-rtdb.firebaseio.com/qaaf_global_state.json";
      const payload = {
        videosData: videosData || [],
        verifiedChannelsList: window.verifiedChannelsList || [],
        bannedChannels: bannedChannels || [],
        blockedVideoIds: blockedVideoIds || [],
        regionalPromos: regionalPromos || {},
        isPromoBarEnabled: isPromoBarEnabled !== false,
        parentRequestsQueue: window.parentRequestsQueue || [],
        registeredUsersJson: JSON.stringify(window.registeredUsersMap || {}),
        qaafSecurityToken: "QAAF_PROTECTED_TOKEN_786_99_MAKKAH",
        updatedAt: Date.now()
      };
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      localStorage.setItem("qaaf_cloud_updated_at", payload.updatedAt.toString());
      localStorage.setItem("qaaf_cloud_last_synced", new Date().toLocaleTimeString());
      localStorage.setItem("qaaf_cloud_last_sync_ts", Date.now().toString());
      if (window.qaafCloudSync) window.qaafCloudSync.updateStatusBadge("connected");
      alert("☁️ کامیابی سے فائر بیس کلاؤڈ پر سنک ہو گیا!\n\nویڈیوز: " + payload.videosData.length + "\nتصدیق شدہ چینلز: " + payload.verifiedChannelsList.length + "\n\nاب موبائل اور کمپیوٹر دونوں پر تمام چینلز لائیو نظر آئیں گے۔");
    } catch(err) {
      alert("⚠️ کلاؤڈ سنک میں خرابی: " + err.message);
    }
  };

  function adminForcePullCloud() { qaafCloudSync.pullFromCloud(false); }
    function adminTestCloudConnection() { qaafCloudSync.pullFromCloud(false); }

    // =========================================================================
    // HIGH-SPEED YOUTUBE HD API + HALAL SAFE STREAM DUAL PLAYER ENGINE
    // =========================================================================
    const isHostedHttp = window.location.protocol.startsWith('http');
    let activePlayerEngine = isHostedHttp ? 'youtube' : 'safe';
    let safeCanvasAnimationId = null;
    let safeCanvasStartTime = Date.now();
    let safeParticles = [];
    let isHalalVoiceSpeaking = false;
    let halalVoiceSurahIndex = 0;
    let wasSafePlayingBeforeAd = false;
    let wasYoutubePlayingBeforeAd = false;

    const HALAL_OFFLINE_SURAHS = [
      { name: "سورة الفاتحة", text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ. الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ. الرَّحْمَٰنِ الرَّحِيمِ. مَالِكِ يَوْمِ الدِّينِ. إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ. اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ. صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ." },
      { name: "سورة الإخلاص", text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ. قُلْ هُوَ اللَّهُ أَحَدٌ. اللَّهُ الصَّمَدُ. لَمْ يَلِدْ وَلَمْ يُولَدْ. وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ." }
    ];

    function sendYouTubeCommand(funcName, args = []) {
      const ytIframe = document.getElementById('ytIframe');
      if (ytIframe && ytIframe.contentWindow) {
        ytIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: funcName, args: args }), '*');
      }
    }

    function triggerAdSimulation() {
      if (document.getElementById('playerModal').classList.contains('hidden')) openVideoPlayer('v1');
      
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
      skipBtn.disabled = true;
      skipBtn.className = "bg-slate-700 text-slate-300 px-4 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm";
      skipBtn.innerText = `⏳ Skip in ${secs}s...`;

      if (adCountdownTimer) clearInterval(adCountdownTimer);
      adCountdownTimer = setInterval(() => {
        secs--;
        if (secs > 0) {
          skipBtn.innerText = `⏳ Skip in ${secs}s...`;
        } else {
          clearInterval(adCountdownTimer);
          skipBtn.disabled = false;
          skipBtn.className = "bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-1.5 sm:py-2 rounded-xl font-extrabold text-xs sm:text-sm shadow-lg";
          skipBtn.innerText = "⏭️ Skip Ad & Resume";
        }
      }, 1000);
    }

    function skipAdAndResume() {
      document.getElementById('duaAdOverlay').classList.add('hidden');
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      resetDuaAudioBtn();

      const safeAudio = document.getElementById('safePlayerAudio');
      if (activePlayerEngine === 'safe' && wasSafePlayingBeforeAd) {
        if (safeAudio && safeAudio.src) {
          safeAudio.play().catch(() => startHalalVoiceRecitation());
        } else {
          startHalalVoiceRecitation();
        }
        wasSafePlayingBeforeAd = false;
        const btn = document.getElementById('safePlayPauseBtn');
        if (btn) btn.innerText = '❚❚';
      } else if (activePlayerEngine === 'youtube' && wasYoutubePlayingBeforeAd) {
        sendYouTubeCommand('playVideo');
        wasYoutubePlayingBeforeAd = false;
      }
    }

    function openFlagModal(videoId, event) {
      if (event) event.stopPropagation();
      pendingFlagVideoId = videoId;
      const v = videosData.find(x => x.id === videoId);
      if (!v) return;
      document.getElementById('flaggingVideoTitle').innerText = `${v.title} (${v.channel})`;
      document.getElementById('flagVideoModal').classList.remove('hidden');
    }
    function closeFlagModal() { document.getElementById('flagVideoModal').classList.add('hidden'); }

    function submitVideoFlag() {
      const v = videosData.find(x => x.id === pendingFlagVideoId);
      const reason = document.getElementById('flagReasonSelect').value;
      if (v) {
        flaggedVideosQueue.unshift({ videoId: v.id, title: v.title, channel: v.channel, reason });
        localStorage.setItem('qaaf_flagged_queue', JSON.stringify(flaggedVideosQueue));
        qaafCloudSync.pushState('User Video Flag Submitted');
      }
      closeFlagModal();
      syncAccountUI();
      alert('🚩 Flag notification sent to QAAF Super Admin.');
    }

    function renderAdminFlaggedQueue() {
      const container = document.getElementById('adminFlaggedList');
      document.getElementById('adminFlagCountBadge').innerText = flaggedVideosQueue.length;
      if (!container) return;
      container.innerHTML = flaggedVideosQueue.length === 0 ? `<p class="text-slate-400 py-2">✅ No flagged videos pending.</p>` : '';
      flaggedVideosQueue.forEach((item, idx) => {
        container.innerHTML += `
          <div class="bg-black/70 border border-slate-800 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p class="font-bold text-white">${item.title}</p>
              <p class="text-[11px] text-slate-400">Channel: <strong>${item.channel}</strong> • <span class="text-rose-400">${item.reason}</span></p>
            </div>
            <div class="flex flex-wrap gap-1.5 shrink-0">
              <button onclick="adminModerateFlag(${idx}, 'block_video')" class="bg-amber-600 text-white px-2.5 py-1 rounded text-[11px] font-bold">🚫 Block Video Only</button>
              <button onclick="adminModerateFlag(${idx}, 'ban_channel')" class="bg-red-600 text-white px-2.5 py-1 rounded text-[11px] font-bold">⛔ Ban Channel</button>
              <button onclick="adminModerateFlag(${idx}, 'dismiss')" class="bg-slate-700 text-slate-200 px-2 py-1 rounded text-[11px] font-bold">✅ Keep</button>
            </div>
          </div>`;
      });
    }

    function adminModerateFlag(index, action) {
      const item = flaggedVideosQueue[index];
      if (!item) return;
      if (action === 'block_video') { blockedVideoIds.push(item.videoId); localStorage.setItem('qaaf_blocked_videos', JSON.stringify(blockedVideoIds)); }
      else if (action === 'ban_channel') { bannedChannels.push(item.channel); localStorage.setItem('qaaf_banned_channels', JSON.stringify(bannedChannels)); }
      flaggedVideosQueue.splice(index, 1);
      localStorage.setItem('qaaf_flagged_queue', JSON.stringify(flaggedVideosQueue));
      renderAdminFlaggedQueue();
      renderVideos();
      qaafCloudSync.pushState(action === 'block_video' ? 'Video Blocked' : (action === 'ban_channel' ? 'Channel Banned' : 'Flag Kept'));
    }

    let pendingAdminYtId = '';
    function extractYouTubeId(input) {
      if (!input) return null;
      const str = input.trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
      const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
      const match = str.match(regExp);
      return (match && match[1]) ? match[1] : null;
    }

    function updateYtPreview(ytId, title = '', channel = '') {
      const container = document.getElementById('adminYtPreviewContainer');
      const img = document.getElementById('adminYtPreviewImg');
      const titleEl = document.getElementById('adminYtPreviewTitle');
      const channelEl = document.getElementById('adminYtPreviewChannel');
      if (!container) return;
      if (ytId) {
        pendingAdminYtId = ytId;
        container.classList.remove('hidden');
        const cat = document.getElementById('adminVideoCat')?.value || 'quran';
        if (img) {
          img.src = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
          img.onerror = function() { this.onerror = null; this.src = getCategoryIslamicArtwork(cat); };
        }
        if (titleEl) titleEl.innerText = title || document.getElementById('adminVideoTitle')?.value.trim() || `YouTube Video (${ytId})`;
        if (channelEl) channelEl.innerText = channel || document.getElementById('adminChannelName')?.value.trim() || 'Channel Ready';
      } else {
        pendingAdminYtId = '';
        container.classList.add('hidden');
      }
    }

    function handleAdminYtInput(val) {
      const ytId = extractYouTubeId(val);
      if (ytId) updateYtPreview(ytId);
    }

    async function adminAutoFetchYouTubeInfo() {
      const urlInput = document.getElementById('adminYtUrlInput');
      const ytId = extractYouTubeId(urlInput ? urlInput.value.trim() : '');
      if (!ytId) { alert('Please enter a valid YouTube Video URL or 11-character video ID.'); return; }
      updateYtPreview(ytId);
      showSyncToast('✨ Fetching video title & channel...');
      try {
        const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);
        const data = await res.json();
        if (data.title) {
          document.getElementById('adminVideoTitle').value = data.title;
          document.getElementById('adminChannelName').value = data.author_name || 'YouTube Creator';
          updateYtPreview(ytId, data.title, data.author_name);
          showSyncToast(`✅ Auto-Fetched: "${data.title.substring(0, 26)}..."`);
        }
      } catch (err) {
        showSyncToast('⚠️ Video ID ready to push.');
      }
    }

    function adminAddGlobalVideo() {
      const urlInput = document.getElementById('adminYtUrlInput');
      const rawUrl = urlInput ? urlInput.value.trim() : '';
      const ytId = pendingAdminYtId || extractYouTubeId(rawUrl) || '0r6BcBXZyUg';
      const titleInput = document.getElementById('adminVideoTitle');
      const channelInput = document.getElementById('adminChannelName');
      const title = titleInput ? titleInput.value.trim() : '';
      const channel = channelInput ? channelInput.value.trim() : '';
      const lang = document.getElementById('adminVideoLang').value;
      const cat = document.getElementById('adminVideoCat').value;

      if (!title && !rawUrl) { alert('Please enter a YouTube URL/ID or Video Title.'); return; }
      const finalTitle = title || `New Video (${ytId})`;
      videosData.unshift({
        id: 'v_global_' + Date.now(),
        title: finalTitle,
        channel: channel || 'Official Hub',
        lang,
        region: lang.toUpperCase(),
        category: cat,
        kidsSafe: (cat !== 'bayan'),
        ytId: ytId,
        isCustomAdded: true,
        duration: '12:30',
        views: 180,
        createdAt: Math.floor(Date.now() / 1000)
      });

      if (titleInput) titleInput.value = '';
      if (channelInput) channelInput.value = '';
      if (urlInput) urlInput.value = '';
      updateYtPreview(null);
      renderVideos();
      qaafCloudSync.pushState('New Global Video Published');
    }

    function syncRegionalPromoBar() {
      const bar = document.getElementById('regionalPromoBar');
      if (!isPromoBarEnabled || isKidsLocked) { bar.classList.add('hidden'); return; }
      bar.classList.remove('hidden');

      const found = globalLanguagesList.find(l => l.code === preferredContentLang);
      const regionKey = (found && regionalPromos[found.regionKey]) ? found.regionKey : 'GLOBAL';
      const promoObj = regionalPromos[regionKey] || regionalPromos.GLOBAL;
      document.getElementById('promoRegionTag').innerText = `📢 ${regionKey}`;

      const imgLinkEl = document.getElementById('promoImageBannerLink');
      const imgEl = document.getElementById('promoImageBannerEl');
      const tickerWrap = document.getElementById('promoTickerWrapper');
      const tickerLink = document.getElementById('promoTickerLink');

      if (promoObj.imgUrl && promoObj.imgUrl.trim() !== '') {
        imgEl.src = promoObj.imgUrl.trim();
        imgLinkEl.href = promoObj.linkUrl || '#';
        imgLinkEl.classList.remove('hidden');
        tickerWrap.classList.add('hidden');
      } else {
        imgLinkEl.classList.add('hidden');
        tickerWrap.classList.remove('hidden');
        tickerLink.innerText = promoObj.text;
        tickerLink.href = promoObj.linkUrl || '#';
        tickerLink.className = (promoObj.dir === 'ltr' ? 'promo-ticker-ltr' : 'promo-ticker-rtl') + ' text-slate-100 hover:text-amber-300 font-semibold tracking-wide';
      }
    }

    function openSponsorContactModal() { document.getElementById('sponsorContactModal').classList.remove('hidden'); }
    function closeSponsorContactModal() { document.getElementById('sponsorContactModal').classList.add('hidden'); }
    function submitSponsorInquiry() { document.getElementById('sponsorInquirySavedMsg').classList.remove('hidden'); }
    function adminTogglePromoBar() {
      isPromoBarEnabled = document.getElementById('adminPromoVisibleToggle').checked;
      localStorage.setItem('qaaf_promo_bar_enabled', isPromoBarEnabled.toString());
      syncRegionalPromoBar();
      qaafCloudSync.pushState(isPromoBarEnabled ? 'Sponsor Bar Visible' : 'Sponsor Bar Hidden');
    }

    function adminLoadRegionPromo(rKey) {
      const p = regionalPromos[rKey] || defaultPromos.GLOBAL;
      document.getElementById('adminPromoTextInput').value = p.text || '';
      document.getElementById('adminPromoImgInput').value = p.imgUrl || '';
      document.getElementById('adminPromoLinkInput').value = p.linkUrl || '';
      document.getElementById('adminTickerDirSelect').value = p.dir || 'rtl';
    }

    function adminExportChannelsBackup() {
      const backupData = { qaafTubeVersion: '8.6', exportedAt: new Date().toISOString(), videosData, blockedVideoIds, bannedChannels, regionalPromos, isPromoBarEnabled };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'qaaf-tube-backup.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSyncToast('📥 Backup exported as qaaf-tube-backup.json!');
    }

    function adminImportChannelsBackup(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          if (Array.isArray(data.videosData)) videosData = data.videosData;
          if (Array.isArray(data.blockedVideoIds)) blockedVideoIds = data.blockedVideoIds;
          if (Array.isArray(data.bannedChannels)) bannedChannels = data.bannedChannels;
          if (data.regionalPromos) regionalPromos = data.regionalPromos;
          qaafCloudSync.pushState('Channels Backup Restored');
          renderVideos(); renderAdminFlaggedQueue(); syncRegionalPromoBar();
          alert('✅ Backup restored and synced live!');
        } catch (err) { alert('Invalid backup JSON file.'); }
        event.target.value = '';
      };
      reader.readAsText(file);
    }

    function adminSaveRegionalPromo() {
      const rKey = document.getElementById('adminPromoRegionSelect').value;
      regionalPromos[rKey] = {
        text: document.getElementById('adminPromoTextInput').value.trim(),
        imgUrl: document.getElementById('adminPromoImgInput').value.trim(),
        linkUrl: document.getElementById('adminPromoLinkInput').value.trim() || '#',
        dir: document.getElementById('adminTickerDirSelect').value
      };
      localStorage.setItem('qaaf_regional_promos_v7', JSON.stringify(regionalPromos));
      syncRegionalPromoBar();
      qaafCloudSync.pushState(`Regional Sponsor Ad Live (${rKey})`);
      alert(`✅ Sponsor Bar updated for ${rKey}!`);
    }

    function isSuperAdmin() { const em = currentUserEmail.toLowerCase(); return em === 'qaaftube@gmail.com' || em === 'admin@qaafai.com' || em === 'admin@designto3d.com'; }

    function syncAccountUI() {
      const label = document.getElementById('accountBtnLabel');
      const adminBtn = document.getElementById('superAdminHeaderBtn');
      const switchBtn = document.getElementById('switchAdminBtn');
      const roleBadge = document.getElementById('activeAccountRoleBadge');
      document.getElementById('adminFlagCountBadge').innerText = flaggedVideosQueue.length;
      if (currentUserEmail) {
        label.innerText = isSuperAdmin() ? 'Admin' : currentUserEmail.split('@')[0];
        document.getElementById('loggedOutView').classList.add('hidden');
        document.getElementById('loggedInView').classList.remove('hidden');
        document.getElementById('activeUserEmailDisplay').innerText = currentUserEmail;
        if (roleBadge) roleBadge.innerText = isSuperAdmin() ? '👑 Super Admin Role Active' : '👨‍👩‍👧 Parent Account Active';
        if (switchBtn) switchBtn.classList.toggle('hidden', isSuperAdmin());
        if ((isSuperAdmin() || (window.isMonitorUser && window.isMonitorUser())) && !isKidsLocked) {
          adminBtn.classList.remove('hidden');
          adminBtn.style.removeProperty('display');
        } else {
          adminBtn.classList.add('hidden');
          adminBtn.style.setProperty('display', 'none', 'important');
        }
      } else {
        label.innerText = 'Login';
        document.getElementById('loggedOutView').classList.remove('hidden');
        document.getElementById('loggedInView').classList.add('hidden');
        if (switchBtn) switchBtn.classList.add('hidden');
        adminBtn.classList.add('hidden');
        adminBtn.style.setProperty('display', 'none', 'important');
      }
    }

    function openAccountModal() { syncAccountUI(); document.getElementById('accountModal').classList.remove('hidden'); }
    function closeAccountModal() { document.getElementById('accountModal').classList.add('hidden'); }
    function loginWithEmail() { const e = document.getElementById('userEmailInput').value.trim(); if (e) { currentUserEmail = e; localStorage.setItem('qaaf_user_email', e); syncAccountUI(); } }
    function quickAdminLogin() { currentUserEmail = 'qaaftube@gmail.com'; localStorage.setItem('qaaf_user_email', currentUserEmail); syncAccountUI(); closeAccountModal(); openAdminModal(); }
    function logoutAccount() { currentUserEmail = ''; localStorage.removeItem('qaaf_user_email'); syncAccountUI(); }
    function openAdminModal() {
      renderAdminFlaggedQueue(); renderAdminParentRequests();
      adminLoadRegionPromo('GLOBAL');
      const input = document.getElementById('firebaseDbUrlInput');
      if (input) input.value = qaafCloudSync.firebaseUrl || '';
      qaafCloudSync.updateStatusBadge();
      document.getElementById('adminDashboardModal').classList.remove('hidden');
      if (window.renderAdminActiveVideosCatalog) window.renderAdminActiveVideosCatalog();
      
    }
    function closeAdminModal() { document.getElementById('adminDashboardModal').classList.add('hidden'); }

    function populateLanguageDropdowns() {
      const uiSelect = document.getElementById('uiLangSelectDropdown');
      const contentSelect = document.getElementById('contentLangSelectDropdown');
      uiSelect.innerHTML = ''; contentSelect.innerHTML = '';
      globalLanguagesList.forEach(lang => {
        uiSelect.innerHTML += `<option value="${lang.code}" ${lang.code === currentAppUILang ? 'selected' : ''}>${lang.label}</option>`;
        contentSelect.innerHTML += `<option value="${lang.code}" ${lang.code === preferredContentLang ? 'selected' : ''}>${lang.label} — Channels & Dua</option>`;
      });
      uiSelect.innerHTML += `<option value="__custom__">➕ Other / Write Your Language...</option>`;
      contentSelect.innerHTML += `<option value="__custom__">➕ Other / Write Channel Language...</option>`;
    }

    function handleUILangSelectChange(val) {
      if (val === '__custom__') { document.getElementById('customUILangBox').classList.remove('hidden'); return; }
      document.getElementById('customUILangBox').classList.add('hidden');
      const found = globalLanguagesList.find(l => l.code === val);
      currentAppUILang = val;
      document.getElementById('shortLangCode').innerText = found ? found.short : val.toUpperCase().slice(0, 2);
      document.getElementById('htmlRoot').dir = (found && found.rtl) ? 'rtl' : 'ltr';
    }

    function handleContentLangSelectChange(val) {
      if (val === '__custom__') { document.getElementById('customContentLangBox').classList.remove('hidden'); return; }
      document.getElementById('customContentLangBox').classList.add('hidden');
      preferredContentLang = val;
      syncRegionalPromoBar();
      renderVideos();
    }

    // FIXED & CLEANED CUSTOM LANGUAGE FUNCTION (NO DUPLICATE PWA CODE)
    function applyCustomLanguage(type) {
      const raw = document.getElementById(type === 'ui' ? 'customUILangInput' : 'customContentLangInput').value.trim();
      if (!raw) return;
      const code = raw.toLowerCase().slice(0, 3);
      if (!globalLanguagesList.some(l => l.code === code)) {
        globalLanguagesList.push({ code, short: raw.toUpperCase().slice(0, 3), label: `🌐 ${raw}`, rtl: false, regionKey: 'GLOBAL' });
      }
      populateLanguageDropdowns();
      if (type === 'ui') handleUILangSelectChange(code); else handleContentLangSelectChange(code);
    }

    function toggleLangDropdown() { document.getElementById('langDropdownMenu').classList.toggle('hidden'); }
    function closeLangDropdownOutside(e) { const c = document.getElementById('langDropdownContainer'); if (c && !c.contains(e.target)) document.getElementById('langDropdownMenu').classList.add('hidden'); }

    function toggleKidsMode() {
      if (!isKidsLocked) {
        isKidsLocked = true;
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        document.getElementById('appBody').className = "bg-islamic-kids min-h-screen flex flex-col justify-between pb-28 transition-colors duration-500";
        var bPref = document.getElementById('brandMainPrefix'); if(bPref) bPref.classList.add('hidden');
        var bDiv = document.getElementById('brandDivider'); if(bDiv) bDiv.classList.add('hidden');
        document.getElementById('brandSuffix').innerHTML = `<span class="kids-letters font-extrabold text-sm sm:text-base"><span>K</span><span>i</span><span>d</span><span>s</span> <span class="text-xs">🔒</span></span>`;
        document.getElementById('lockIcon').innerText = '🔓';
        document.getElementById('kioskStatusBadge').innerText = '🔒 KIDS LOCK';
        document.getElementById('kioskStatusBadge').className = 'bg-red-600 text-white px-2 py-0.5 rounded font-bold';
        document.getElementById('parentPanelBtn').classList.add('hidden');
        document.getElementById('accountBtn').classList.add('hidden');
        document.getElementById('superAdminHeaderBtn').classList.add('hidden');
        document.getElementById('langDropdownContainer').classList.add('hidden');
        document.getElementById('kidsContentSwitcher').classList.remove('hidden');
        document.getElementById('kidsContentSwitcher').classList.add('flex');
        document.querySelectorAll('.family-only-chip').forEach(el => el.classList.add('hidden'));
        if (currentCategory === 'bayan') currentCategory = 'all';
        syncRegionalPromoBar();
        renderVideos();
      } else {
        openParentalGate('unlock');
      }
    }

    function startHalalVoiceRecitation() {
      stopHalalVoiceRecitation();
      if (!('speechSynthesis' in window)) return;
      const surah = HALAL_OFFLINE_SURAHS[halalVoiceSurahIndex % HALAL_OFFLINE_SURAHS.length];
      halalVoiceSurahIndex++;
      const utterance = new SpeechSynthesisUtterance(surah.text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.85;
      utterance.onstart = () => { isHalalVoiceSpeaking = true; };
      utterance.onend = () => { isHalalVoiceSpeaking = false; };
      utterance.onerror = () => { isHalalVoiceSpeaking = false; };
      window.speechSynthesis.speak(utterance);
    }

    function stopHalalVoiceRecitation() {
      isHalalVoiceSpeaking = false;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    const authenticAudioMap = {
      quran: 'https://everyayah.com/data/Alafasy_128kbps/001001.mp3',
      bayan: 'https://everyayah.com/data/Alafasy_128kbps/001002.mp3',
      stories: 'https://everyayah.com/data/Alafasy_128kbps/001003.mp3',
      kids_cartoon: 'https://everyayah.com/data/Alafasy_128kbps/001004.mp3'
    };

    function updatePlayerEngineUI() {
      const toggleBtn = document.getElementById('playerEngineToggleBtn');
      const label = document.getElementById('playerEngineLabel');
      const ytCont = document.getElementById('ytPlayerContainer');
      const safeCont = document.getElementById('safeCanvasPlayerContainer');

      if (activePlayerEngine === 'safe') {
        if (label) label.innerText = 'Safe Stream (Active)';
        if (toggleBtn) toggleBtn.className = 'bg-emerald-600/40 hover:bg-emerald-600/60 border border-emerald-400/60 text-emerald-300 px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 shadow';
        if (ytCont) ytCont.classList.add('hidden');
        if (safeCont) safeCont.classList.remove('hidden');
      } else {
        if (label) label.innerText = 'YouTube HD (Active)';
        if (toggleBtn) toggleBtn.className = 'bg-blue-600/40 hover:bg-blue-600/60 border border-blue-400/60 text-blue-300 px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 shadow';
        if (ytCont) ytCont.classList.remove('hidden');
        if (safeCont) safeCont.classList.add('hidden');
      }
    }

    function togglePlayerEngine() {
      activePlayerEngine = (activePlayerEngine === 'safe') ? 'youtube' : 'safe';
      updatePlayerEngineUI();
      if (currentPlayingVideoId) loadVideoInActiveEngine(currentPlayingVideoId);
    }

    function formatSafeTime(seconds) {
      if (isNaN(seconds) || seconds < 0) return '0:00';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function initSafeCanvas() {
      const canvas = document.getElementById('safePlayerCanvas');
      if (!canvas) return;
      safeParticles = [];
      const w = canvas.clientWidth || 640;
      const h = canvas.clientHeight || 360;
      for (let i = 0; i < 40; i++) {
        safeParticles.push({ x: Math.random() * w, y: Math.random() * h, radius: Math.random() * 2 + 1, speedY: Math.random() * 0.4 + 0.15, opacity: Math.random() * 0.6 + 0.3 });
      }
    }

    function animateSafeCanvas() {
      const canvas = document.getElementById('safePlayerCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth || 640;
        canvas.height = canvas.clientHeight || 360;
      }
      const w = canvas.width, h = canvas.height;
      const time = (Date.now() - safeCanvasStartTime) * 0.001;

      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#041620'); bgGrad.addColorStop(0.5, '#06261c'); bgGrad.addColorStop(1, '#020b10');
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w / 2, h / 2); ctx.rotate(time * 0.05);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.09)'; ctx.lineWidth = 1.5;
      const sz = Math.min(w, h) * 0.48;
      ctx.strokeRect(-sz / 2, -sz / 2, sz, sz); ctx.rotate(Math.PI / 4); ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
      ctx.restore();

      ctx.fillStyle = '#fde047';
      safeParticles.forEach(p => {
        p.y -= p.speedY;
        if (p.y < 0) { p.y = h; p.x = Math.random() * w; }
        ctx.globalAlpha = p.opacity * (0.6 + 0.4 * Math.sin(time * 2 + p.x));
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      const barCount = 36, barWidth = w / barCount;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
      for (let i = 0; i < barCount; i++) {
        const wave = Math.sin(time * 3 + i * 0.35) * Math.cos(time * 1.5 + i * 0.2);
        const barHeight = Math.max(6, (wave + 1.2) * 15);
        ctx.fillRect(i * barWidth, h - barHeight, barWidth - 2, barHeight);
      }
      safeCanvasAnimationId = requestAnimationFrame(animateSafeCanvas);
    }

    function startSafeCanvasPlayer(video) {
      stopSafeCanvasPlayer();
      const posterImg = document.getElementById('safePlayerPosterImg');
      const titleEl = document.getElementById('safePlayerTitle');
      const channelEl = document.getElementById('safePlayerChannel');
      const safeAudio = document.getElementById('safePlayerAudio');
      const playBtn = document.getElementById('safePlayPauseBtn');

      if (posterImg) posterImg.src = video.customThumb || getCategoryIslamicArtwork(video.category);
      if (titleEl) titleEl.innerText = video.title;
      if (channelEl) channelEl.innerText = `🎙️ ${video.channel}`;

      initSafeCanvas();
      safeCanvasStartTime = Date.now();
      animateSafeCanvas();

      if (safeAudio) {
        safeAudio.src = authenticAudioMap[video.category] || authenticAudioMap.quran;
        safeAudio.ontimeupdate = function() {
          document.getElementById('safePlayerCurrentTime').innerText = formatSafeTime(safeAudio.currentTime);
          document.getElementById('safePlayerTotalDuration').innerText = formatSafeTime(safeAudio.duration || 180);
          if (safeAudio.duration) {
            document.getElementById('safePlayerProgressBar').style.width = `${(safeAudio.currentTime / safeAudio.duration) * 100}%`;
          }
        };
        safeAudio.onended = () => { safeAudio.currentTime = 0; safeAudio.play().catch(() => {}); };
        safeAudio.onerror = () => { startHalalVoiceRecitation(); };
        safeAudio.play().then(() => { if (playBtn) playBtn.innerText = '❚❚'; }).catch(() => { startHalalVoiceRecitation(); if (playBtn) playBtn.innerText = '❚❚'; });
      }
    }

    function stopSafeCanvasPlayer() {
      if (safeCanvasAnimationId) {
        cancelAnimationFrame(safeCanvasAnimationId);
        safeCanvasAnimationId = null;
      }
      const safeAudio = document.getElementById('safePlayerAudio');
      if (safeAudio) {
        safeAudio.onerror = null;
        safeAudio.onended = null;
        safeAudio.ontimeupdate = null;
        safeAudio.pause();
        safeAudio.removeAttribute('src');
        safeAudio.load();
      }
      stopHalalVoiceRecitation();
      const playBtn = document.getElementById('safePlayPauseBtn');
      if (playBtn) playBtn.innerText = '▶';
    }

    function toggleSafePlayerPlay() {
      const safeAudio = document.getElementById('safePlayerAudio');
      const playBtn = document.getElementById('safePlayPauseBtn');
      if (!safeAudio) return;
      if (safeAudio.paused && !isHalalVoiceSpeaking) {
        safeAudio.play().then(() => { if (playBtn) playBtn.innerText = '❚❚'; }).catch(() => { startHalalVoiceRecitation(); if (playBtn) playBtn.innerText = '❚❚'; });
      } else {
        safeAudio.pause();
        stopHalalVoiceRecitation();
        if (playBtn) playBtn.innerText = '▶';
      }
    }

    function restartSafePlayer() {
      stopHalalVoiceRecitation();
      const safeAudio = document.getElementById('safePlayerAudio');
      if (safeAudio) {
        safeAudio.currentTime = 0;
        safeAudio.play().catch(() => startHalalVoiceRecitation());
      }
    }

    function toggleSafeAudioMute() {
      const safeAudio = document.getElementById('safePlayerAudio');
      const muteBtn = document.getElementById('safeMuteBtn');
      if (!safeAudio) return;
      safeAudio.muted = !safeAudio.muted;
      if (muteBtn) muteBtn.innerText = safeAudio.muted ? '🔇' : '🔊';
      if (safeAudio.muted) stopHalalVoiceRecitation();
    }

    function seekSafePlayer(e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const safeAudio = document.getElementById('safePlayerAudio');
      if (safeAudio && safeAudio.duration) safeAudio.currentTime = clickRatio * safeAudio.duration;
    }

    function loadVideoInActiveEngine(videoId) {
      const video = videosData.find(v => v.id === videoId) || videosData[0];
      const ytIframe = document.getElementById('ytIframe');
      if (activePlayerEngine === 'youtube') {
        stopSafeCanvasPlayer();
        if (ytIframe) {
          const originParam = window.location.protocol.startsWith('http') ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
          ytIframe.src = `https://www.youtube-nocookie.com/embed/${video.ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&vq=hd1080${originParam}`;
        }
      } else {
        if (ytIframe) ytIframe.src = '';
        startSafeCanvasPlayer(video);
      }
    }

    function openVideoPlayer(videoId) {
      activePlayerEngine = 'youtube';
      currentPlayingVideoId = videoId;
      const video = videosData.find(v => v.id === videoId) || videosData[0];
      video.views += 1;

      document.getElementById('playingTitle').innerText = video.title;
      const chEl = document.getElementById('playingChannelName');
      if (chEl) chEl.innerHTML = `${video.channel} <span class="text-emerald-400 text-[10px]">✔</span>`;
      const vwEl = document.getElementById('playingViewsText');
      if (vwEl) vwEl.innerText = `${(video.views / 1000).toFixed(1)}K views • ${video.lang.toUpperCase()} • Halal Verified`;

      const modalBox = document.getElementById('playerModalBox');
      const aspectBox = document.getElementById('playerAspectBox');
      const shortsNav = document.getElementById('shortsSideNav');

      if (isVideoShort(video)) {
        if (modalBox) modalBox.className = "w-full max-w-sm bg-[#0f0f0f] rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col transition-all duration-300";
        if (aspectBox) aspectBox.className = "relative aspect-[9/16] max-h-[72vh] bg-black overflow-hidden flex items-center justify-center";
        if (shortsNav) { shortsNav.classList.remove('hidden'); shortsNav.classList.add('flex'); }
      } else {
        if (modalBox) modalBox.className = "w-full max-w-4xl bg-[#0f0f0f] rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col transition-all duration-300";
        if (aspectBox) aspectBox.className = "relative aspect-video min-h-[260px] sm:min-h-[380px] bg-black overflow-hidden flex items-center justify-center";
        if (shortsNav) { shortsNav.classList.add('hidden'); shortsNav.classList.remove('flex'); }
      }

      document.getElementById('playerModal').classList.remove('hidden');
      updatePlayerEngineUI();
      loadVideoInActiveEngine(videoId);
      renderVideos();
    }

    function closeVideoPlayer() {
      const ytIframe = document.getElementById('ytIframe');
      if (ytIframe) ytIframe.src = 'about:blank';
      stopSafeCanvasPlayer();
      stopHalalVoiceRecitation();
      document.getElementById('duaAdOverlay').classList.add('hidden');
      document.getElementById('playerModal').classList.add('hidden');
      if (adCountdownTimer) clearInterval(adCountdownTimer);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      resetDuaAudioBtn();
      wasSafePlayingBeforeAd = false;
      wasYoutubePlayingBeforeAd = false;
    }


    function toggleFavoriteVideo(videoId, event) {
      event.stopPropagation();
      if (favoriteVideoIds.includes(videoId)) favoriteVideoIds = favoriteVideoIds.filter(id => id !== videoId);
      else favoriteVideoIds.push(videoId);
      localStorage.setItem('qaaf_favorites', JSON.stringify(favoriteVideoIds));
      renderVideos();
    }

    function setSortFilter(sortType) { currentSortFilter = sortType; renderVideos(); }
    function toggleStrictLanguage() { strictLanguageOnly = document.getElementById('strictLangToggle').checked; renderVideos(); }
    function filterCategory(cat) { currentCategory = cat; renderVideos(); }
    function switchKidsTab(tab) {
      document.getElementById('videosSection').classList.toggle('hidden', tab !== 'videos');
      document.getElementById('gamesSection').classList.toggle('hidden', tab !== 'games');
      if (tab === 'games') renderGames();
    }

    // =========================================================================
    // FULL PLAYABLE ISLAMIC MINI-GAMES ENGINE (3 GAMES × 5 STAGES)
    // =========================================================================
    function speakArabicAudio(text) {
      if (!('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const ut = new SpeechSynthesisUtterance(text);
        ut.lang = 'ar-SA'; ut.rate = 0.85;
        window.speechSynthesis.speak(ut);
      } catch (e) {}
    }

    function awardGameStar() {
      gameStars++;
      localStorage.setItem('qaaf_game_stars', gameStars.toString());
      updateGameStarsDisplay();
    }

    function updateGameStarsDisplay() {
      const modalEl = document.getElementById('gameStarsCounterDisplay');
      if (modalEl) modalEl.innerText = gameStars;
      const hubEl = document.getElementById('hubStarsCount');
      if (hubEl) hubEl.innerText = gameStars;
    }

    function toggleSupporterPro() {
      isSupporterPro = !isSupporterPro;
      localStorage.setItem('qaaf_supporter_pro', isSupporterPro ? 'true' : 'false');
      updateSupporterBadges();
      renderGames();
      if (!document.getElementById('gamePlayModal').classList.contains('hidden')) renderMiniGameStage();
    }

    function updateSupporterBadges() {
      const btn = document.getElementById('supporterUnlockBtnText');
      if (btn) btn.innerText = isSupporterPro ? "Supporter Pro Active (All Stages Unlocked)" : "Support QAAF & Unlock All Stages";
      const parentToggle = document.getElementById('parentSupporterToggleBtn');
      if (parentToggle) {
        parentToggle.innerText = isSupporterPro ? "Active (Click to Lock)" : "Inactive (Click to Activate)";
        parentToggle.className = isSupporterPro ? "bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow" : "bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold shadow";
      }
      updateGameStarsDisplay();
    }

    function isStagePro(gameId, stageNum) {
      if (gameId === 'g1') return stageNum > 2;
      if (gameId === 'g2') return stageNum > 3;
      if (gameId === 'g3') return stageNum > 2;
      return false;
    }
    function isStageLocked(gameId, stageNum) { return isStagePro(gameId, stageNum) && !isSupporterPro; }

    const quranQuizStages = [
      { stage: 1, title: "Stage 1: Holy Quran Basics", question: "How many Surahs are there in the Holy Quran?", options: ["114 Surahs", "110 Surahs", "120 Surahs", "99 Surahs"], correctIndex: 0, explanation: "🎉 MashaAllah! The Holy Quran has 114 Surahs." },
      { stage: 2, title: "Stage 2: The Opening Book", question: "What is the first and opening Surah of the Quran?", options: ["Surah Al-Fatihah", "Surah Al-Baqarah", "Surah Al-Ikhlas", "Surah An-Nas"], correctIndex: 0, explanation: "🌟 SubhanAllah! Surah Al-Fatihah is the opening Surah." },
      { stage: 3, title: "Stage 3: Heart of the Quran", question: "Which blessed Surah is celebrated as the 'Heart of the Quran'?", options: ["Surah Yasin", "Surah Ar-Rahman", "Surah Al-Mulk", "Surah Al-Kahf"], correctIndex: 0, explanation: "✨ MashaAllah! Surah Yasin is the Heart of the Quran." },
      { stage: 4, title: "Stage 4: The Prophet & Revelation", question: "To which final Prophet was the Holy Quran revealed?", options: ["Prophet Muhammad (ﷺ)", "Prophet Musa (AS)", "Prophet Isa (AS)", "Prophet Ibrahim (AS)"], correctIndex: 0, explanation: "🌙 Alhamdulillah! Revealed to Prophet Muhammad (ﷺ)." },
      { stage: 5, title: "Stage 5: The Longest Surah", question: "Which is the longest Surah in the Holy Quran?", options: ["Surah Al-Baqarah", "Surah Ali 'Imran", "Surah An-Nisa", "Surah Al-Ma'idah"], correctIndex: 0, explanation: "🏆 BarakAllah! Surah Al-Baqarah has 286 verses." }
    ];

    const arabicAlphabetStages = [
      { stage: 1, title: "Stage 1: Alif, Baa, Taa", letters: [{ char: "ا", name: "Alif", sound: "أَلِف" }, { char: "ب", name: "Baa", sound: "بَاء" }, { char: "ت", name: "Taa", sound: "تَاء" }] },
      { stage: 2, title: "Stage 2: Thaa, Jeem, Haa", letters: [{ char: "ث", name: "Thaa", sound: "ثَاء" }, { char: "ج", name: "Jeem", sound: "جِيم" }, { char: "ح", name: "Haa", sound: "حَاء" }] },
      { stage: 3, title: "Stage 3: Khaa, Daal, Dhaal", letters: [{ char: "خ", name: "Khaa", sound: "خَاء" }, { char: "د", name: "Daal", sound: "دَال" }, { char: "ذ", name: "Dhaal", sound: "ذَال" }] },
      { stage: 4, title: "Stage 4: Raa, Zaay, Seen", letters: [{ char: "ر", name: "Raa", sound: "رَاء" }, { char: "ز", name: "Zaay", sound: "زَاي" }, { char: "س", name: "Seen", sound: "سِين" }] },
      { stage: 5, title: "Stage 5: Sheen, Saad, Daad", letters: [{ char: "ش", name: "Sheen", sound: "شِين" }, { char: "ص", name: "Saad", sound: "صَاد" }, { char: "ض", name: "Daad", sound: "ضَاد" }] }
    ];

    const wuduAllSteps = [
      { id: "s1", name: "Niyyah (Intention & Bismillah)", icon: "🤲", desc: "Make intention & say Bismillah" },
      { id: "s2", name: "Wash Hands", icon: "🧼", desc: "Wash both hands up to wrists 3 times" },
      { id: "s3", name: "Rinse Mouth", icon: "💧", desc: "Rinse mouth with water 3 times" },
      { id: "s4", name: "Clean Nose", icon: "👃", desc: "Sniff water into nose 3 times" },
      { id: "s5", name: "Wash Face", icon: "😊", desc: "Wash entire face 3 times" },
      { id: "s6", name: "Wash Arms", icon: "💪", desc: "Wash arms up to elbows 3 times" },
      { id: "s7", name: "Wipe Head (Masah)", icon: "✨", desc: "Wipe wet hands over head & ears" },
      { id: "s8", name: "Wash Feet", icon: "🦶", desc: "Wash both feet up to ankles 3 times" }
    ];

    const masjidBuilderStages = [
      { stage: 1, title: "Stage 1: Foundation & Courtyard", subtitle: "Order the first 4 steps of Wudu", stepsCount: 4 },
      { stage: 2, title: "Stage 2: Full Wudu & Golden Dome", subtitle: "Order all 8 Wudu steps", stepsCount: 8 },
      { stage: 3, title: "Stage 3: Blue Mosque of Istanbul", subtitle: "Master the full Wudu sequence", stepsCount: 8 },
      { stage: 4, title: "Stage 4: Prophet's Green Dome Masjid", subtitle: "Build the Green Dome of Madinah", stepsCount: 8 },
      { stage: 5, title: "Stage 5: Grand Haram & Golden Crescent", subtitle: "Master Architect Challenge", stepsCount: 8 }
    ];

    function launchMiniGame(gameId = 'g1') {
      activeMiniGameId = gameId; activeGameStage = 1;
      arabicPuzzleSelectedLetter = null; arabicPuzzleMatchedLetters = []; masjidWuduCurrentStepIndex = 0;
      const titles = { g1: "Quran Quiz Adventure", g2: "Arabic Alphabet Puzzle", g3: "🕌 Masjid & Wudu Builder" };
      const icons = { g1: "📖", g2: "🔤", g3: "🕌" };
      document.getElementById('activeGameTitle').innerText = titles[gameId] || "Islamic Mini-Game";
      document.getElementById('activeGameIcon').innerText = icons[gameId] || "🎮";
      document.getElementById('gamePlayModal').classList.remove('hidden');
      updateGameStarsDisplay();
      renderMiniGameStage();
    }

    function closeMiniGame() {
      document.getElementById('gamePlayModal').classList.add('hidden');
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    function gameChangeStage(dir) {
      const nextStage = activeGameStage + dir;
      if (nextStage < 1 || nextStage > 5) return;
      activeGameStage = nextStage;
      arabicPuzzleSelectedLetter = null; arabicPuzzleMatchedLetters = []; masjidWuduCurrentStepIndex = 0;
      renderMiniGameStage();
    }

    function jumpToGameStage(stageNum) {
      if (stageNum < 1 || stageNum > 5) return;
      activeGameStage = stageNum;
      arabicPuzzleSelectedLetter = null; arabicPuzzleMatchedLetters = []; masjidWuduCurrentStepIndex = 0;
      renderMiniGameStage();
    }

    function renderMiniGameStage() {
      const container = document.getElementById('miniGameContainer');
      document.getElementById('gameStageProgressBar').style.width = `${(activeGameStage / 5) * 100}%`;
      document.getElementById('activeGameSubtitle').innerText = `Stage ${activeGameStage} of 5`;

      const isPro = isStagePro(activeMiniGameId, activeGameStage);
      const isLocked = isStageLocked(activeMiniGameId, activeGameStage);
      const proTagEl = document.getElementById('gameStageProTag');
      proTagEl.innerText = isPro ? "👑 Supporter Pro" : "⭐ Free Stage";
      proTagEl.className = isPro ? "text-amber-400 font-bold" : "text-emerald-400 font-bold";

      let dotsHtml = '';
      for (let s = 1; s <= 5; s++) {
        const isCur = s === activeGameStage;
        const curPro = isStagePro(activeMiniGameId, s);
        dotsHtml += `<button onclick="jumpToGameStage(${s})" class="w-6 h-6 rounded-full text-[10px] font-extrabold transition flex items-center justify-center ${isCur ? 'bg-emerald-500 text-black scale-110 shadow' : (curPro ? 'bg-amber-950/80 border border-amber-500/50 text-amber-300' : 'bg-slate-800 text-slate-300')}">${s}</button>`;
      }
      document.getElementById('gameStageSelectorDots').innerHTML = dotsHtml;
      document.getElementById('prevStageBtn').disabled = (activeGameStage <= 1);
      document.getElementById('nextStageBtn').innerHTML = (activeGameStage >= 5) ? `<span>Finish 🏁</span>` : `<span>Next Stage</span> <span>▶</span>`;

      if (isLocked) {
        document.getElementById('gameStageLabel').innerText = `Stage ${activeGameStage}: Locked (Supporter Pro)`;
        container.innerHTML = `
          <div class="bg-gradient-to-b from-slate-900 to-black border border-amber-500/40 rounded-2xl p-6 text-center my-2 shadow-2xl max-w-md mx-auto">
            <div class="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-3xl mx-auto mb-3 animate-bounce">👑</div>
            <h4 class="text-base font-extrabold text-amber-300">Stage ${activeGameStage} is Supporter Pro Only</h4>
            <p class="text-xs text-slate-300 my-3">Ask your parents to unlock all stages using their 6-digit PIN.</p>
            <button onclick="openParentalGate('support')" class="bg-emerald-500 text-black font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-lg">💚 Unlock via Parent PIN</button>
          </div>`;
        return;
      }

      if (activeMiniGameId === 'g1') renderQuranQuiz();
      else if (activeMiniGameId === 'g2') renderArabicAlphabetPuzzle();
      else if (activeMiniGameId === 'g3') renderMasjidBuilder();
    }

    function renderQuranQuiz() {
      const container = document.getElementById('miniGameContainer');
      const stageData = quranQuizStages[activeGameStage - 1] || quranQuizStages[0];
      document.getElementById('gameStageLabel').innerText = stageData.title;
      let optionsHtml = '';
      stageData.options.forEach((opt, idx) => {
        optionsHtml += `<button id="quizOpt_${idx}" onclick="answerQuizQuestion(${idx})" class="w-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm text-left transition flex items-center justify-between"><span>${opt}</span><span>●</span></button>`;
      });
      container.innerHTML = `<div class="bg-slate-950/80 rounded-2xl p-4 border border-slate-800"><h4 class="text-sm sm:text-base font-extrabold text-white mb-4">${stageData.question}</h4><div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">${optionsHtml}</div><p id="quizFeedbackMsg" class="text-xs font-bold min-h-[22px]"></p></div>`;
    }

    function answerQuizQuestion(optIdx) {
      const stageData = quranQuizStages[activeGameStage - 1];
      const feedback = document.getElementById('quizFeedbackMsg');
      if (optIdx === stageData.correctIndex) {
        feedback.className = "text-xs font-extrabold text-emerald-400";
        feedback.innerText = `${stageData.explanation} (+1 Star!)`;
        awardGameStar(); speakArabicAudio("مَا شَاءَ اللَّه");
      } else {
        feedback.className = "text-xs font-bold text-rose-400";
        feedback.innerText = "❌ Try again! Read carefully.";
      }
    }

   function renderArabicAlphabetPuzzle() {
      const container = document.getElementById('miniGameContainer');
      const stageData = arabicAlphabetStages[activeGameStage - 1] || arabicAlphabetStages[0];
      document.getElementById('gameStageLabel').innerText = stageData.title;

      let letterCardsHtml = '';
      stageData.letters.forEach(letter => {
        const isMatched = arabicPuzzleMatchedLetters.includes(letter.char);
        const isSelected = (arabicPuzzleSelectedLetter && arabicPuzzleSelectedLetter.char === letter.char);
        letterCardsHtml += `
          <button onclick="selectArabicLetter('${letter.char}')" class="p-3 sm:p-4 rounded-2xl flex flex-col items-center justify-center gap-1 transition transform active:scale-95 ${isMatched ? 'bg-emerald-600/40 border-2 border-emerald-400 text-white cursor-default' : (isSelected ? 'bg-amber-500/30 border-2 border-amber-400 text-white ring-2 ring-amber-400 shadow-lg' : 'bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-100 hover:border-blue-400')}">
            <span class="text-3xl sm:text-4xl font-extrabold font-serif mb-1" dir="rtl">${letter.char}</span>
            <span class="text-[10px] bg-black/60 px-2 py-0.5 rounded-full flex items-center gap-1 text-slate-300">
              <span>🔊</span> <span>Listen</span>
            </span>
            ${isMatched ? '<span class="text-xs text-emerald-300 font-bold mt-1">✅ Matched</span>' : ''}
          </button>`;
      });

      const namesList = [...stageData.letters].sort(() => 0.5 - Math.random());
      let nameCardsHtml = '';
      namesList.forEach(letter => {
        const isMatched = arabicPuzzleMatchedLetters.includes(letter.char);
        nameCardsHtml += `
          <button onclick="matchArabicName('${letter.name}')" class="p-2.5 sm:p-3 rounded-xl font-extrabold text-xs sm:text-sm transition ${isMatched ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300 cursor-default' : 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white hover:border-emerald-400 active:scale-95'}">
            ${isMatched ? `✅ ${letter.name}` : `Match: ${letter.name}`}
          </button>`;
      });

      container.innerHTML = `
        <div class="bg-slate-950/80 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner">
          <div class="bg-blue-950/50 border border-blue-500/30 rounded-xl p-2.5 mb-3 text-xs text-slate-300 flex items-center justify-between">
            <span>🔊 <strong>Step 1:</strong> Tap Arabic Letter to pronounce.</span>
            <span>👉 <strong>Step 2:</strong> Tap matching English Name!</span>
          </div>
          <div class="mb-3">
            <p class="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-2 text-left">1. Arabic Letters (Tap to Speak):</p>
            <div class="grid grid-cols-3 gap-2.5">${letterCardsHtml}</div>
          </div>
          <div>
            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 text-left">2. Tap The Matching Letter Name:</p>
            <div class="grid grid-cols-3 gap-2.5">${nameCardsHtml}</div>
          </div>
          <p id="alphabetFeedbackMsg" class="text-xs font-bold mt-3 min-h-[22px] flex items-center justify-center gap-1"></p>
        </div>`;
    }

    function selectArabicLetter(char) {
      const stageData = arabicAlphabetStages[activeGameStage - 1];
      const found = stageData.letters.find(l => l.char === char);
      if (!found) return;
      speakArabicAudio(found.sound);
      if (arabicPuzzleMatchedLetters.includes(char)) return;
      arabicPuzzleSelectedLetter = found;
      renderArabicAlphabetPuzzle();
      const fb = document.getElementById('alphabetFeedbackMsg');
      if (fb) {
        fb.className = "text-xs font-bold text-amber-300 min-h-[22px] flex items-center justify-center gap-1";
        fb.innerHTML = `<span>🔊 Pronounced <strong>${found.sound}</strong>. Now tap its English name below!</span>`;
      }
    }

    function matchArabicName(name) {
      const stageData = arabicAlphabetStages[activeGameStage - 1];
      const fb = document.getElementById('alphabetFeedbackMsg');
      if (!arabicPuzzleSelectedLetter) {
        if (fb) {
          fb.className = "text-xs font-bold text-amber-400 min-h-[22px] flex items-center justify-center gap-1";
          fb.innerHTML = `<span>👆 Tap an Arabic letter first to hear its pronunciation!</span>`;
        }
        return;
      }
      if (arabicPuzzleSelectedLetter.name === name) {
        if (!arabicPuzzleMatchedLetters.includes(arabicPuzzleSelectedLetter.char)) {
          arabicPuzzleMatchedLetters.push(arabicPuzzleSelectedLetter.char);
          awardGameStar();
        }
        speakArabicAudio("أَحْسَنْتَ");
        arabicPuzzleSelectedLetter = null;
        renderArabicAlphabetPuzzle();
        const fbAfter = document.getElementById('alphabetFeedbackMsg');
        if (arabicPuzzleMatchedLetters.length === stageData.letters.length) {
          if (fbAfter) {
            fbAfter.className = "text-xs font-extrabold text-emerald-400 min-h-[22px] flex items-center justify-center gap-1";
            fbAfter.innerHTML = `<span>🎉 SubhanAllah! All letters matched! Tap 'Next Stage' to continue.</span>`;
          }
          document.getElementById('nextStageBtn').classList.add('ring-2', 'ring-emerald-400', 'animate-pulse');
        } else if (fbAfter) {
          fbAfter.className = "text-xs font-bold text-emerald-400 min-h-[22px] flex items-center justify-center gap-1";
          fbAfter.innerHTML = `<span>⭐ MashaAllah! Correct match! (+1 Star)</span>`;
        }
      } else if (fb) {
        fb.className = "text-xs font-bold text-rose-400 min-h-[22px] flex items-center justify-center gap-1";
        fb.innerHTML = `<span>❌ Not quite! Listen again and match carefully.</span>`;
      }
    }

    function renderMasjidBuilder() {
      const container = document.getElementById('miniGameContainer');
      const stageData = masjidBuilderStages[activeGameStage - 1] || masjidBuilderStages[0];
      document.getElementById('gameStageLabel').innerText = stageData.title;

      const activeSteps = wuduAllSteps.slice(0, stageData.stepsCount);
      const isComplete = (masjidWuduCurrentStepIndex >= activeSteps.length);
      const baseOpacity = masjidWuduCurrentStepIndex >= 1 ? "1" : "0.2";
      const pillarsOpacity = masjidWuduCurrentStepIndex >= 2 ? "1" : "0.2";
      const archOpacity = masjidWuduCurrentStepIndex >= 3 ? "1" : "0.2";
      const domeOpacity = (masjidWuduCurrentStepIndex >= 5 || (activeSteps.length === 4 && masjidWuduCurrentStepIndex >= 4)) ? "1" : "0.2";
      const minaretOpacity = (masjidWuduCurrentStepIndex >= 6 || (activeSteps.length === 4 && masjidWuduCurrentStepIndex >= 4)) ? "1" : "0.2";
      const crescentOpacity = (masjidWuduCurrentStepIndex >= 7 || isComplete) ? "1" : "0.2";
      const starsOpacity = isComplete ? "1" : "0.3";

      let stepsButtonsHtml = '';
      activeSteps.forEach((step, idx) => {
        const isDone = (idx < masjidWuduCurrentStepIndex);
        stepsButtonsHtml += `
          <button onclick="tapWuduStep('${step.id}')" ${isDone ? 'disabled' : ''} class="p-2 sm:p-2.5 rounded-xl border text-left text-xs transition flex items-center gap-2 ${isDone ? 'bg-emerald-600/30 border-emerald-500/60 text-emerald-300 cursor-default' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100 hover:border-amber-400 active:scale-95'}">
            <span class="text-lg">${step.icon}</span>
            <div class="min-w-0 flex-1">
              <p class="font-bold truncate">${step.name}</p>
              <p class="text-[10px] text-slate-400 truncate">${step.desc}</p>
            </div>
            ${isDone ? '<span class="text-xs text-emerald-400 font-bold shrink-0">✅</span>' : ''}
          </button>`;
      });

      container.innerHTML = `
        <div class="bg-slate-950/80 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner flex flex-col justify-between">
          <div class="relative w-full h-28 sm:h-36 bg-gradient-to-b from-[#060a14] via-[#091326] to-[#04070e] rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center p-1.5 mb-2.5 shadow-inner shrink-0">
            <svg class="w-full h-full max-h-32 sm:max-h-36" viewBox="0 0 500 240" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g style="opacity:${starsOpacity}"><circle cx="60" cy="35" r="2" fill="#FFF"/><circle cx="120" cy="50" r="1.5" fill="#FFD700"/><circle cx="380" cy="40" r="2" fill="#FFF"/><circle cx="430" cy="60" r="1.5" fill="#FFD700"/></g>
              <g style="opacity:${baseOpacity}"><rect x="50" y="200" width="400" height="25" rx="4" fill="#047857"/><rect x="70" y="190" width="360" height="15" rx="3" fill="#10B981"/></g>
              <g style="opacity:${pillarsOpacity}"><rect x="150" y="130" width="200" height="65" rx="2" fill="#1E293B" stroke="#38BDF8" stroke-width="1.5"/></g>
              <g style="opacity:${archOpacity}"><path d="M 225,195 L 225,160 Q 250,140 275,160 L 275,195 Z" fill="#022C22" stroke="#F59E0B" stroke-width="2"/></g>
              <g style="opacity:${minaretOpacity}"><rect x="100" y="70" width="28" height="125" rx="2" fill="#1E293B" stroke="#10B981"/><polygon points="114,40 100,70 128,70" fill="#F59E0B"/><rect x="372" y="70" width="28" height="125" rx="2" fill="#1E293B" stroke="#10B981"/><polygon points="386,40 372,70 400,70" fill="#F59E0B"/></g>
              <g style="opacity:${domeOpacity}"><path d="M 180,130 C 180,65 320,65 320,130 Z" fill="#F59E0B" stroke="#FFD700" stroke-width="2"/></g>
              <g style="opacity:${crescentOpacity}"><line x1="250" y1="65" x2="250" y2="40" stroke="#FFD700" stroke-width="3"/><circle cx="250" cy="32" r="8" fill="#FFD700"/></g>
            </svg>
            <div class="absolute bottom-2 inset-x-2 flex items-center justify-between text-[11px] px-2 py-0.5 rounded-lg bg-black/70 border border-white/10">
              <span class="text-amber-300 font-bold">Progress: Step ${masjidWuduCurrentStepIndex} of ${activeSteps.length}</span>
              <span class="${isComplete ? 'text-emerald-400 font-extrabold' : 'text-slate-300'}">${isComplete ? '✨ Masjid Fully Built!' : 'Tap Next Wudu Step Below'}</span>
            </div>
          </div>
          <p class="text-[11px] text-slate-300 font-semibold mb-2.5 text-left">${stageData.subtitle}:</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">${stepsButtonsHtml}</div>
          <p id="masjidFeedbackMsg" class="text-xs font-bold min-h-[20px] flex items-center justify-center gap-1"></p>
        </div>`;
    }

    function tapWuduStep(stepId) {
      const stageData = masjidBuilderStages[activeGameStage - 1];
      const activeSteps = wuduAllSteps.slice(0, stageData.stepsCount);
      const expectedStep = activeSteps[masjidWuduCurrentStepIndex];
      const fb = document.getElementById('masjidFeedbackMsg');
      if (!expectedStep) return;

      if (stepId === expectedStep.id) {
        masjidWuduCurrentStepIndex++;
        awardGameStar();
        speakArabicAudio("مَا شَاءَ اللَّه");
        renderMasjidBuilder();
        const fbAfter = document.getElementById('masjidFeedbackMsg');
        if (masjidWuduCurrentStepIndex >= activeSteps.length) {
          if (fbAfter) {
            fbAfter.className = "text-xs font-extrabold text-emerald-400";
            fbAfter.innerText = "🕌 MashaAllah! The Masjid is fully illuminated! Tap 'Next Stage'.";
          }
          document.getElementById('nextStageBtn').classList.add('ring-2', 'ring-emerald-400', 'animate-pulse');
        } else if (fbAfter) {
          fbAfter.className = "text-xs font-bold text-emerald-400";
          fbAfter.innerText = `⭐ Correct: ${expectedStep.name}! (+1 Star)`;
        }
      } else if (fb) {
        fb.className = "text-xs font-bold text-rose-400";
        fb.innerText = `❌ Remember: Wudu step #${masjidWuduCurrentStepIndex + 1} is ${expectedStep.name}.`;
      }
    }

    function renderGames() {
      const grid = document.getElementById('gamesGrid');
      grid.innerHTML = '';
      gamesData.forEach(game => {
        let btn = game.installed
          ? `<button onclick="launchMiniGame('${game.id}')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold shadow transition">▶ Play Now (5 Stages)</button>`
          : (game.blockedByParent
              ? `<button onclick="requestParentGameInstall('${game.id}')" class="w-full bg-amber-600/30 border border-amber-500 text-amber-300 py-2 rounded-xl text-xs font-bold">🔒 6-Digit Parent PIN Required</button>`
              : `<button onclick="installGameByChild('${game.id}')" class="w-full bg-blue-600 text-white py-2 rounded-xl text-xs font-bold">⬇️ One-Time Free Install</button>`);
        grid.innerHTML += `
          <div class="bg-[#15181e]/95 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <h3 class="text-sm font-bold text-white">${game.title}</h3>
                <span class="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded font-extrabold">5 Stages</span>
              </div>
              <p class="text-xs text-slate-400 mb-4">${game.desc}</p>
            </div>
            ${btn}
          </div>`;
      });
      renderParentGameControls();
    }

    let parentRequestsQueue = JSON.parse(localStorage.getItem('qaaf_parent_requests') || '[]');

    async function parentAutoFetchVideo() {
      const urlInput = document.getElementById('parentYtUrlInput');
      const fb = document.getElementById('parentRequestFeedback');
      const ytId = extractYouTubeId(urlInput ? urlInput.value.trim() : '');
      if (!ytId) { alert('Please enter a valid YouTube Video URL or 11-character ID.'); return; }
      try {
        const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);
        const data = await res.json();
        if (data.title) {
          document.getElementById('parentVideoTitle').value = data.title;
          document.getElementById('parentChannelName').value = data.author_name || 'YouTube Channel';
          if (fb) {
            fb.classList.remove('hidden');
            fb.className = "text-[11px] font-bold text-blue-300";
            fb.innerText = "✨ Video info fetched! Click 'Send Request' to submit for Admin music verification.";
          }
        }
      } catch (e) {
        alert('Video ID detected! Please type the title and channel name.');
      }
    }

    function parentSubmitChannelRequest() {
      const urlInput = document.getElementById('parentYtUrlInput');
      const titleInput = document.getElementById('parentVideoTitle');
      const channelInput = document.getElementById('parentChannelName');
      const fb = document.getElementById('parentRequestFeedback');

      const ytId = extractYouTubeId(urlInput ? urlInput.value.trim() : '');
      const title = titleInput ? titleInput.value.trim() : '';
      const channel = channelInput ? channelInput.value.trim() : 'Requested Channel';
      const lang = document.getElementById('parentVideoLang').value;
      const cat = document.getElementById('parentVideoCat').value;

      if (!ytId || !title) { alert('Please paste a valid YouTube link and fetch/enter a title.'); return; }

      parentRequestsQueue.unshift({
        reqId: 'req_' + Date.now(),
        ytId,
        title,
        channel,
        lang,
        category: cat,
        requestedAt: new Date().toLocaleString()
      });

      localStorage.setItem('qaaf_parent_requests', JSON.stringify(parentRequestsQueue));
      urlInput.value = ''; titleInput.value = ''; channelInput.value = '';
      if (fb) {
        fb.classList.remove('hidden');
        fb.className = "text-[11px] font-bold text-emerald-400";
        fb.innerText = "✅ Request sent to QAAF Admin! It will appear once verified as 100% music-free.";
      }
      renderAdminParentRequests();
      qaafCloudSync.pushState('New Parent Channel Request Submitted');
    }

    function renderAdminParentRequests() {
      const container = document.getElementById('adminParentRequestsList');
      const badge = document.getElementById('adminReqCountBadge');
      if (badge) badge.innerText = parentRequestsQueue.length;
      const headerBadge = document.getElementById('adminFlagCountBadge');
      if (headerBadge) headerBadge.innerText = flaggedVideosQueue.length + parentRequestsQueue.length;
      if (!container) return;

      if (parentRequestsQueue.length === 0) {
        container.innerHTML = `<p class="text-slate-400 py-2">✅ No pending parent requests.</p>`;
        return;
      }

      container.innerHTML = '';
      parentRequestsQueue.forEach((req, idx) => {
        container.innerHTML += `
          <div class="bg-black/70 border border-blue-500/30 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="min-w-0 flex-1">
              <p class="font-bold text-white truncate">${req.title}</p>
              <p class="text-[11px] text-slate-400">Channel: <strong class="text-blue-300">${req.channel}</strong> • Lang: ${req.lang.toUpperCase()} • Cat: ${req.category}</p>
            </div>
            <div class="flex flex-wrap gap-1.5 shrink-0">
              <button onclick="adminPreviewRequestedVideo('${req.ytId}', '${req.title.replace(/'/g, "\\'")}')" class="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-[11px] font-bold">▶ Listen / Preview</button>
              <button onclick="adminHandleParentRequest(${idx}, 'approve')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-[11px] font-bold">✅ Approve Live</button>
              <button onclick="adminHandleParentRequest(${idx}, 'reject')" class="bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 rounded text-[11px] font-bold">🚫 Reject (Music)</button>
            </div>
          </div>`;
      });
    }

    function adminPreviewRequestedVideo(ytId, title) {
      closeAdminModal();
      activePlayerEngine = 'youtube';
      document.getElementById('playingTitle').innerText = `[ADMIN PREVIEW] ${title}`;
      document.getElementById('playerModal').classList.remove('hidden');
      updatePlayerEngineUI();
      stopSafeCanvasPlayer();
      const ytIframe = document.getElementById('ytIframe');
      if (ytIframe) {
        const originParam = window.location.protocol.startsWith('http') ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
        ytIframe.src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&vq=hd1080${originParam}`;
      }
    }

    function adminHandleParentRequest(index, decision) {
      const req = parentRequestsQueue[index];
      if (!req) return;
      if (decision === 'approve') {
        videosData.unshift({
          id: 'v_approved_' + Date.now(),
          title: req.title,
          channel: req.channel,
          lang: req.lang,
          region: req.lang.toUpperCase(),
          category: req.category,
          kidsSafe: (req.category !== 'bayan'),
          ytId: req.ytId,
          isCustomAdded: true,
          duration: '12:00',
          views: 150,
          createdAt: Math.floor(Date.now() / 1000)
        });
      }
      parentRequestsQueue.splice(index, 1);
      localStorage.setItem('qaaf_parent_requests', JSON.stringify(parentRequestsQueue));
      renderAdminParentRequests();
      renderVideos();
      qaafCloudSync.pushState(decision === 'approve' ? 'Approved Parent Video Request' : 'Rejected Parent Video Request');
    }

    function parentToggleAllowVideo(videoId) {
      if (blockedVideoIds.includes(videoId)) blockedVideoIds = blockedVideoIds.filter(id => id !== videoId);
      else blockedVideoIds.push(videoId);
      localStorage.setItem('qaaf_blocked_videos', JSON.stringify(blockedVideoIds));
      renderVideos();
      renderParentGameControls();
    }

    function parentToggleChannelBan(channelName) {
      if (bannedChannels.includes(channelName)) bannedChannels = bannedChannels.filter(c => c !== channelName);
      else bannedChannels.push(channelName);
      localStorage.setItem('qaaf_banned_channels', JSON.stringify(bannedChannels));
      renderVideos();
      renderParentGameControls();
    }

    function parentToggleKidsSafe(videoId) {
      const v = videosData.find(x => x.id === videoId);
      if (v) { v.kidsSafe = !v.kidsSafe; renderVideos(); renderParentGameControls(); }
    }

    function parentResetAllChannels() {
      blockedVideoIds = [];
      bannedChannels = [];
      videosData = [...defaultInitialVideos];
      
      qaafCloudSync.pushState('Reset to Clean Default Channels');
      renderVideos();
      renderParentGameControls();
    }

    function renderParentGameControls() {
      const pm = document.getElementById('parentModal');
      if (!pm || pm.classList.contains('hidden')) return;
      renderAdminParentRequests();
      const c = document.getElementById('parentGamesControlList');
      if (c) {
        c.innerHTML = '';
        gamesData.forEach(g => {
          c.innerHTML += `<div class="flex items-center justify-between bg-black/50 p-2 rounded-lg"><span>${g.title}</span><button onclick="parentToggleUninstallGame('${g.id}')" class="px-2.5 py-1 rounded text-[11px] font-bold ${g.blockedByParent ? 'bg-emerald-600' : 'bg-red-600'} text-white">${g.blockedByParent ? 'Unlock' : '🗑️ Uninstall & Lock'}</button></div>`;
        });
      }

      const chList = document.getElementById('parentChannelsFilterList');
      if (chList) {
        chList.innerHTML = '';
        videosData.slice(0, 25).forEach(v => { const isVideoBlocked = blockedVideoIds.includes(v.id);
          const isChanBanned = bannedChannels.includes(v.channel);
          const isAllowed = !isVideoBlocked && !isChanBanned;
          const safeChannel = v.channel.replace(/'/g, "\\'");
          chList.innerHTML += `
            <div class="bg-black/60 border ${isAllowed ? 'border-slate-800' : 'border-rose-500/50'} p-2 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="font-bold text-white truncate">${v.title}</p>
                <p class="text-[10px] text-slate-400">Channel: <strong class="text-slate-200">${v.channel}</strong> (${v.lang.toUpperCase()})</p>
              </div>
              <div class="flex flex-wrap items-center gap-1 shrink-0">
                <button onclick="parentToggleKidsSafe('${v.id}')" class="px-2 py-1 rounded text-[10px] font-bold ${v.kidsSafe ? 'bg-sky-600/30 border border-sky-400 text-sky-300' : 'bg-slate-800 text-slate-400'}">
                  ${v.kidsSafe ? '🧒 Kids Allowed' : '👨‍👩‍👧 Family Only'}
                </button>
                <button onclick="parentToggleAllowVideo('${v.id}')" class="px-2 py-1 rounded text-[10px] font-bold ${!isVideoBlocked ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}">
                  ${!isVideoBlocked ? '✅ Allowed' : '🚫 Not Allowed'}
                </button>
                <button onclick="parentToggleChannelBan('${safeChannel}')" class="px-2 py-1 rounded text-[10px] font-bold ${!isChanBanned ? 'bg-slate-700 hover:bg-rose-700 text-slate-200' : 'bg-rose-700 text-white'}">
                  ${!isChanBanned ? '⛔ Ban Channel' : '✅ Unban'}
                </button>
              </div>
            </div>`;
        });
      }
    }

    function installGameByChild(id) { const g = gamesData.find(x => x.id === id); if (g) { g.installed = true; renderGames(); } }
    function parentToggleUninstallGame(id) { const g = gamesData.find(x => x.id === id); if (g) { g.installed = false; g.blockedByParent = !g.blockedByParent; renderGames(); } }
    function requestParentGameInstall(id) { pendingGameIdToAuthorize = id; openParentalGate('reinstall_game'); }

    function syncPinDisplays() {
      const hintEl = document.getElementById('currentPinHint');
      if (hintEl) {
        hintEl.innerHTML = `•••••• (Protected) • <button type="button" onclick="if(window.toggleForgotPinBox) window.toggleForgotPinBox();" class="text-amber-300 underline font-bold ml-1">❓ Forgot PIN?</button>`;
      }
      const settingsPinEl = document.getElementById('settingsPinDisplay');
      if (settingsPinEl) settingsPinEl.innerText = '••••••';
    }

    function openParentalGate(purpose) {
      pendingParentPurpose = purpose;
      syncPinDisplays();
      document.getElementById('pinInput').value = '';
      document.getElementById('pinError').classList.add('hidden');
      document.getElementById('pinStepView').classList.remove('hidden');
      document.getElementById('settingsStepView').classList.add('hidden');
      document.getElementById('parentModal').classList.remove('hidden');
    }

    function verifyPinCode() {
      if (document.getElementById('pinInput').value.trim() !== parentPin) {
        document.getElementById('pinError').classList.remove('hidden');
        return;
      }
      if (pendingParentPurpose === 'unlock') {
        isKidsLocked = false;
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        document.getElementById('appBody').className = "bg-islamic-family min-h-screen flex flex-col justify-between pb-28 transition-colors duration-500";
        var bPref = document.getElementById('brandMainPrefix'); if(bPref) bPref.classList.remove('hidden');
        var bDiv = document.getElementById('brandDivider'); if(bDiv) bDiv.classList.remove('hidden');
        document.getElementById('brandSuffix').innerText = 'Tube';
        document.getElementById('lockIcon').innerText = '🔒';
        document.getElementById('kioskStatusBadge').innerText = 'Family Mode';
        document.getElementById('kioskStatusBadge').className = 'bg-slate-800 text-slate-300 px-2 py-0.5 rounded';
        document.getElementById('parentPanelBtn').classList.remove('hidden');
        document.getElementById('accountBtn').classList.remove('hidden');
        document.getElementById('langDropdownContainer').classList.remove('hidden');
        document.getElementById('kidsContentSwitcher').classList.add('hidden');
        document.querySelectorAll('.family-only-chip').forEach(el => el.classList.remove('hidden'));
        switchKidsTab('videos');
        syncAccountUI();
        syncRegionalPromoBar();
        renderVideos();
        closeParentModal();
      } else if (pendingParentPurpose === 'reinstall_game') {
        const g = gamesData.find(x => x.id === pendingGameIdToAuthorize);
        if (g) { g.blockedByParent = false; g.installed = true; }
        renderGames();
        closeParentModal();
      } else if (pendingParentPurpose === 'support') {
        isSupporterPro = true;
        localStorage.setItem('qaaf_supporter_pro', 'true');
        closeParentModal();
        updateSupporterBadges();
        renderGames();
        if (!document.getElementById('gamePlayModal').classList.contains('hidden')) renderMiniGameStage();
        alert("🎉 MashaAllah! Supporter Pro Unlocked! All stages are now accessible.");
      } else {
        document.getElementById('pinStepView').classList.add('hidden');
        document.getElementById('settingsStepView').classList.remove('hidden');
        renderParentGameControls();
      }
    }

    function updateParentPin() {
      const n = document.getElementById('newPinInput').value.trim();
      const c = document.getElementById('confirmPinInput').value.trim();
      const fb = document.getElementById('pinChangeFeedback');
      fb.classList.remove('hidden');
      if (!/^\d{6}$/.test(n) || n !== c) { fb.className = "text-xs mt-2 font-semibold text-red-400"; fb.innerText = "⚠️ Enter matching 6-digit PINs."; return; }
      parentPin = n;
      localStorage.setItem('qaaf_parent_pin_6', parentPin);
      syncPinDisplays();
      fb.className = "text-xs mt-2 font-semibold text-emerald-400";
      fb.innerText = `✅ PIN updated to ${parentPin}!`;
    }

    function closeParentModal() { document.getElementById('parentModal').classList.add('hidden'); }

    function runStartupSplash() {}

    function replayStartupSplash() {
      const svgNode = document.getElementById('splashSvgNode');
      const clone = svgNode.cloneNode(true);
      svgNode.parentNode.replaceChild(clone, svgNode);
      runStartupSplash();
    }

    function testHardwareNav() {
      if (isKidsLocked) {
        const toast = document.getElementById('navInterceptToast');
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2500);
      }
    }

    function simulateIncomingCall() { document.getElementById('callModal').classList.remove('hidden'); }
    function endSimulatedCall() { document.getElementById('callModal').classList.add('hidden'); }

    // =========================================================================
    // PROGRESSIVE WEB APP (PWA) MANIFEST & SERVICE WORKER (SINGLE CLEAN INSTANCE)
    // =========================================================================
    let deferredPwaPrompt = null;

    function initPwaManifest() {
      const iconUri = "https://qaaftube.com/favicon.svg?v=14.0";
      const manifestObj = {
        name: "QAAF Tube — Muslim Family & Kids Hub",
        short_name: "QAAF Tube",
        description: "Muslim Family & Kids Hub — 100% Halal & Music-Free Islamic Videos, Quran, Naats, Cartoons & Games",
        start_url: "./index.html",
        display: "standalone",
        orientation: "any",
        theme_color: "#080a0f",
        background_color: "#080a0f",
        icons: [{ src: iconUri, sizes: "512x512 192x192", type: "image/svg+xml", purpose: "any maskable" }]
      };
      try {
        const blob = new Blob([JSON.stringify(manifestObj)], { type: 'application/json' });
        const manifestURL = URL.createObjectURL(blob);
        let link = document.querySelector('link[rel="manifest"]');
        if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
        link.href = manifestURL;
      } catch (err) {}
    }

    function registerPwaServiceWorker() {
      if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        try {
          navigator.serviceWorker.getRegistrations().then(function(regs) {
            regs.forEach(function(r) { r.unregister(); });
          }).catch(function() {});
          if ('caches' in window) {
            caches.keys().then(function(keys) {
              keys.forEach(function(k) {
                if (k.indexOf('qaaf-tube-pwa') !== -1) caches.delete(k);
              });
            }).catch(function() {});
          }
        } catch (e) {}
      }
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPwaPrompt = e;
      const installBtn = document.getElementById('pwaInstallBtn');
      if (installBtn) installBtn.innerHTML = '<span>📲</span> <span>Install App on Device</span>';
    });

    function triggerPwaInstall() {
      if (deferredPwaPrompt) {
        deferredPwaPrompt.prompt();
        deferredPwaPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') showSyncToast('🎉 QAAF Tube installed to home screen!');
          deferredPwaPrompt = null;
        });
      } else {
        alert('📲 To install on your device:\nOpen your browser menu (⋮ or Share) and select "Add to Home Screen" or "Install App".');
      }
    }

    initPwaManifest();
    registerPwaServiceWorker();
    populateLanguageDropdowns();
    syncPinDisplays();
    syncAccountUI();
    syncRegionalPromoBar();
    renderGames();
    updateSupporterBadges();
    window.addEventListener('load', function() { setTimeout(fetchHisnAlMuslimFromGitHub, 500); });
    qaafCloudSync.init();
    runStartupSplash();
