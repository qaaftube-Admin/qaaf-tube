# -*- coding: utf-8 -*-
"""
QAAF Games Complete Male Voice MP3 Downloader (K:\Qaaf Tube\audio\games)
Generates 100% pure male voice MP3s for:
1) All 30 Arabic Alphabet Letters & Example Words (ar-SA-HamedNeural)
2) Bike Racing Phrases ("نماز میری قوت ہے", "Prayer is My Power", "الصلاة قوتي", "فِي أَمَانِ اللّٰهِ", "سُبْحَانَ اللّٰهِ", "مَا شَاءَ اللّٰهُ", "اَلْحَمْدُ لِلّٰهِ", "اللّٰهُ أَكْبَرُ")
3) All 100 Word Search Words (Urdu, Arabic, English)
4) All 40 Quran & Sunnah Quiz Questions (Urdu, Arabic, English)
"""
import asyncio
import os
import re
import edge_tts

BASE_DIR = r"K:\Qaaf Tube" if os.path.exists(r"K:\Qaaf Tube") else os.getcwd()
OUTPUT_DIR = os.path.join(BASE_DIR, "audio", "games")
os.makedirs(OUTPUT_DIR, exist_ok=True)

VOICES = {
    "ur": "ur-PK-AsadNeural",
    "ar": "ar-SA-HamedNeural",
    "en": "en-US-GuyNeural"
}

def get_audio_file_key(text: str, lang_prefix: str) -> str:
    clean = str(text or "").strip()
    h = 2166136261
    for ch in clean:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return f"{lang_prefix}_{h:08x}.mp3"

# Core Phrases & Bike Racing Phrases (Note: pure Arabic dhikr uses ar-SA-HamedNeural even in ur mode for authentic Tajweed!)
CORE_ITEMS = [
    # Prayer Mat Power Phrase ("نماز میری قوت ہے / Prayer is My Power / الصلاة قوتي")
    ("ur", "نماز میری قوت ہے", "ur-PK-AsadNeural"),
    ("ar", "الصَّلَاةُ قُوَّتِي", "ar-SA-HamedNeural"),
    ("en", "Prayer is My Power", "en-US-GuyNeural"),

    # Pure Islamic Dhikr & Praises (Recorded with Saudi Male Reciter Voice ar-SA-HamedNeural for authentic Arabic pronunciation!)
    ("ur", "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ", "ar-SA-HamedNeural"),
    ("ar", "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ", "ar-SA-HamedNeural"),
    ("en", "Bismillahir Rahmanir Raheem", "en-US-GuyNeural"),

    ("ur", "سُبْحَانَ اللّٰهِ", "ar-SA-HamedNeural"),
    ("ar", "سُبْحَانَ اللّٰهِ", "ar-SA-HamedNeural"),
    ("en", "SubhanAllah", "en-US-GuyNeural"),

    ("ur", "مَا شَاءَ اللّٰهُ", "ar-SA-HamedNeural"),
    ("ar", "مَا شَاءَ اللّٰهُ", "ar-SA-HamedNeural"),
    ("en", "MashaAllah", "en-US-GuyNeural"),

    ("ur", "اَلْحَمْدُ لِلّٰهِ", "ar-SA-HamedNeural"),
    ("ar", "الْحَمْدُ لِلّٰهِ", "ar-SA-HamedNeural"),
    ("en", "Alhamdulillah", "en-US-GuyNeural"),

    ("ur", "اللّٰهُ أَكْبَرُ", "ar-SA-HamedNeural"),
    ("ar", "اللّٰهُ أَكْبَرُ", "ar-SA-HamedNeural"),
    ("en", "Allahu Akbar", "en-US-GuyNeural"),

    ("ur", "فِي أَمَانِ اللّٰهِ", "ar-SA-HamedNeural"),
    ("ar", "فِي أَمَانِ اللّٰهِ", "ar-SA-HamedNeural"),
    ("en", "Fi Amanillah", "en-US-GuyNeural"),

    ("ur", "تَوَكَّلْتُ عَلَى اللّٰهِ", "ar-SA-HamedNeural"),
    ("ar", "تَوَكَّلْتُ عَلَى اللّٰهِ", "ar-SA-HamedNeural"),
    ("en", "Tawakkaltu Alallah", "en-US-GuyNeural"),

    ("ur", "سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ", "ar-SA-HamedNeural"),
    ("ar", "سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ", "ar-SA-HamedNeural"),
    ("en", "SubhanAllahi Wa Bihamdihi", "en-US-GuyNeural"),

    ("ur", "مَا شَاءَ اللّٰهُ! بہت خوب", "ur-PK-AsadNeural"),
    ("ar", "مَا شَاءَ اللّٰهُ! أَحْسَنْتَ", "ar-SA-HamedNeural"),
    ("en", "MashaAllah! Wonderful!", "en-US-GuyNeural"),

    ("ur", "بسم اللّٰہ! ٹربو پاور!", "ur-PK-AsadNeural"),
    ("ar", "بسم اللّٰه! قوة التيربو!", "ar-SA-HamedNeural"),
    ("en", "Bismillah! Turbo Power!", "en-US-GuyNeural"),

    ("ur", "اَلْحَمْدُ لِلّٰهِ! مَا شَاءَ اللّٰهُ! بہت شاندار کامیابی!", "ur-PK-AsadNeural"),
    ("ar", "الْحَمْدُ لِلّٰهِ! مَا شَاءَ اللّٰهُ! فَوْزٌ رَائِع!", "ar-SA-HamedNeural"),
    ("en", "Alhamdulillah! MashaAllah! Great Victory!", "en-US-GuyNeural"),
]

# All 30 Arabic Alphabet Items (Stage 1 to 10)
ARABIC_ALPHABET = [
    ("أ", "أَلِفْ", "أَسَدٌ"), ("ب", "بَاءْ", "بَيْتٌ"), ("ت", "تَاءْ", "تَمْرٌ"),
    ("ث", "ثَاءْ", "ثَوْبٌ"), ("ج", "جِيمْ", "جَمَلٌ"), ("ح", "حَاءْ", "حَمَامَةٌ"),
    ("خ", "خَاءْ", "خُبْزٌ"), ("د", "دَالْ", "دَرَّاجَةٌ"), ("ذ", "ذَالْ", "ذُرَةٌ"),
    ("ر", "رَاءْ", "رُمَّانٌ"), ("ز", "زَايْ", "زَهْرَةٌ"), ("س", "سِينْ", "سَمَكَةٌ"),
    ("ش", "شِينْ", "شَمْسٌ"), ("ص", "صَادْ", "صَقْرٌ"), ("ض", "ضَادْ", "ضِفْدَعٌ"),
    ("ط", "طَاءْ", "طَائِرَةٌ"), ("ظ", "ظَاءْ", "ظَرْفٌ"), ("ع", "عَيْنْ", "عِنَبٌ"),
    ("غ", "غَيْنْ", "غَيْمٌ"), ("ف", "فَاءْ", "فِيلٌ"), ("ق", "قَافْ", "قَمَرٌ"),
    ("ك", "كَافْ", "كِتَابٌ"), ("ل", "لَامْ", "لَيْمُونٌ"), ("م", "مِيمْ", "مَسْجِدٌ"),
    ("ن", "نُونْ", "نَحْلَةٌ"), ("هـ", "هَاءْ", "هِلَالٌ"), ("و", "وَاوْ", "وَرْدَةٌ"),
    ("ي", "يَاءْ", "يَدٌ"), ("ء", "هَمْزَةْ", "مَاءٌ"), ("ة", "تَاءْ مَرْبُوطَة", "كَعْبَةٌ")
]

async def save_tts(lang_prefix: str, text: str, voice: str, overwrite: bool = False):
    fname = get_audio_file_key(text, lang_prefix)
    fpath = os.path.join(OUTPUT_DIR, fname)
    if overwrite or not os.path.exists(fpath) or os.path.getsize(fpath) < 500:
        print(f"Downloading [{lang_prefix}] {fname} -> {text}")
        comm = edge_tts.Communicate(text, voice)
        await comm.save(fpath)

async def main():
    print(f"Target Audio Folder: {OUTPUT_DIR}")
    # 1. Generate Core & Bike Racing Phrases (Overwrite to ensure clean Arabic/Urdu pronunciation!)
    for lang_prefix, text, voice in CORE_ITEMS:
        await save_tts(lang_prefix, text, voice, overwrite=True)

    # 2. Generate all 30 Arabic Alphabet Letters & Words
    for char, name_ar, word_ar in ARABIC_ALPHABET:
        await save_tts("ar", f"{name_ar} ، {word_ar}", VOICES["ar"])
        await save_tts("ar", name_ar, VOICES["ar"])
        await save_tts("ar", word_ar, VOICES["ar"])

    # 3. Automatically scan games/wordsearch.html & games/quiz.html if present to generate any missing Word Search or Quiz MP3s
    sample_game = os.path.join(BASE_DIR, "qaaf-games", "games", "wordsearch.html")
    if not os.path.exists(sample_game):
        sample_game = os.path.join(BASE_DIR, "qaaf-games.html")
    if os.path.exists(sample_game):
        with open(sample_game, "r", encoding="utf-8") as f:
            html = f.read()
        # Extract Word Search items
        for m in re.finditer(r"\{\s*emoji:\s*'[^']+',\s*ur:\s*'([^']+)'(?:,\s*speakUr:\s*'([^']+)')?.*?ar:\s*'([^']+)'(?:,\s*speakAr:\s*'([^']+)')?.*?en:\s*'([^']+)'(?:,\s*speakEn:\s*'([^']+)')?", html):
            ur_txt = m.group(2) or m.group(1)
            ar_txt = m.group(4) or m.group(3)
            en_txt = m.group(6) or m.group(5)
            await save_tts("ur", ur_txt, VOICES["ur"])
            await save_tts("ar", ar_txt, VOICES["ar"])
            await save_tts("en", en_txt, VOICES["en"])
        # Extract Quiz questions
        for m in re.finditer(r"q:\s*\{\s*ur:\s*'([^']+)',\s*ar:\s*'([^']+)',\s*en:\s*'([^']+)'\s*\}", html):
            await save_tts("ur", m.group(1), VOICES["ur"])
            await save_tts("ar", m.group(2), VOICES["ar"])
            await save_tts("en", m.group(3), VOICES["en"])

    print("\n✅ Alhamdulillah! All Male Voice Audio Files are downloaded in:", OUTPUT_DIR)

if __name__ == "__main__":
    asyncio.run(main())
