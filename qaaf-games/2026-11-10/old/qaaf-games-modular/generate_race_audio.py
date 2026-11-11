# -*- coding: utf-8 -*-
"""
بائیک ریسنگ کے نئے اسلامی کلمات کی مردانہ آواز والی ایم پی تھری فائلیں بنانے کا اسکرپٹ
چلانے کا طریقہ:
pip install edge-tts
python generate_race_audio.py
"""
import asyncio
import os
import edge_tts

OUTPUT_DIR = "audio/games"
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

PHRASES = [
    {"ur": "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ", "ar": "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ", "en": "Bismillahir Rahmanir Raheem"},
    {"ur": "سُبْحَانَ اللّٰهِ", "ar": "سُبْحَانَ اللّٰهِ", "en": "SubhanAllah"},
    {"ur": "مَا شَاءَ اللّٰهُ", "ar": "مَا شَاءَ اللّٰهُ", "en": "MashaAllah"},
    {"ur": "اَلْحَمْدُ لِلّٰهِ", "ar": "الْحَمْدُ لِلّٰهِ", "en": "Alhamdulillah"},
    {"ur": "اللّٰهُ أَكْبَرُ", "ar": "اللّٰهُ أَكْبَرُ", "en": "Allahu Akbar"},
    {"ur": "فِي أَمَانِ اللّٰهِ", "ar": "فِي أَمَانِ اللّٰهِ", "en": "Fi Amanillah"},
    {"ur": "جَزَاكَ اللّٰهُ خَيْرًا", "ar": "جَزَاكَ اللّٰهُ خَيْرًا", "en": "JazakAllahu Khayran"},
    {"ur": "بَارَكَ اللّٰهُ فِيكَ", "ar": "بَارَكَ اللّٰهُ فِيكَ", "en": "BarakAllahu Feek"},
    {"ur": "تَوَكَّلْتُ عَلَى اللّٰهِ", "ar": "تَوَكَّلْتُ عَلَى اللّٰهِ", "en": "Tawakkaltu Alallah"},
    {"ur": "سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ", "ar": "سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ", "en": "SubhanAllahi Wa Bihamdihi"},
    {"ur": "بسم اللّٰہ! ٹربو پاور!", "ar": "بسم اللّٰه! قوة التيربو!", "en": "Bismillah! Turbo Power!"},
    {"ur": "مَا شَاءَ اللّٰهُ! بہت خوب", "ar": "مَا شَاءَ اللّٰهُ! أَحْسَنْتَ", "en": "MashaAllah! Wonderful!"},
    {"ur": "اَلْحَمْدُ لِلّٰهِ! مَا شَاءَ اللّٰهُ! بہت شاندار کامیابی!", "ar": "الْحَمْدُ لِلّٰهِ! مَا شَاءَ اللّٰهُ! فَوْزٌ رَائِع!", "en": "Alhamdulillah! MashaAllah! Great Victory!"}
]

async def main():
    for item in PHRASES:
        for lang, text in item.items():
            fname = get_audio_file_key(text, lang)
            fpath = os.path.join(OUTPUT_DIR, fname)
            if not os.path.exists(fpath):
                print(f"Generating {fpath} -> {text}")
                communicate = edge_tts.Communicate(text, VOICES[lang])
                await communicate.save(fpath)
            else:
                print(f"Already exists: {fpath}")

if __name__ == "__main__":
    asyncio.run(main())
