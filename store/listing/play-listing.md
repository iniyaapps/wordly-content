# Google Play listing — Wordly

Copy and paste into Play Console. Character limits are Google's, and every
field below is already inside them.

---

## App details

| Field | Value |
|---|---|
| App name (30 max) | `Wordly: Word Puzzle Game` |
| Short description (80 max) | `A new word challenge in your language, every time you play. 50+ languages.` |
| Category | Games → Word |
| Tags | Word game, Puzzle, Educational |
| Contact email | p.kolla@dfarminc.com |
| Website | https://iniyaapps.github.io/wordly-content/ |
| Privacy policy | https://iniyaapps.github.io/wordly-content/legal/privacy.html |

---

## Full description (4000 max)

```
Wordly is a word puzzle game that speaks your language.

Play in English, Tamil, Hindi, Spanish, Portuguese, French, German, Indonesian,
Japanese or Korean — with more languages added over time. Every puzzle is built
from real, curated words with real meanings, not machine translations.

🧩 FIFTEEN KINDS OF PUZZLE
Unscramble the letters. Fill the missing one. Guess the word from a clue. Match
a word to its meaning. Find the synonym, the antonym, the odd letter out. Beat
the clock. The game picks what fits the word and your level, so no two sessions
feel the same.

🌎 BUILT FOR EVERY SCRIPT
Most word games are English games with translated menus. Wordly handles each
writing system properly: Tamil and Hindi puzzles work on whole letter clusters,
never broken mid-syllable. Japanese tiles use kana readings, never split kanji.
Korean uses full syllable blocks. Puzzle types that do not suit a script are
switched off automatically instead of producing nonsense.

🔥 A STREAK WORTH KEEPING
One puzzle a day keeps your streak alive. Daily challenges are the same for
everyone playing that language, so you can compare. Seventeen achievements, from
your first level to a full year.

📊 SEE YOUR PROGRESS
Levels completed, accuracy, play time, your best and average score, your
strongest categories, and a seven-day activity chart.

📴 PLAYS OFFLINE
Download a language once and play it on a plane, on the metro, anywhere. New
content arrives automatically when you are back online — and if the download
fails, your existing puzzles keep working.

🔒 NO ACCOUNT, NO TRACKING
No sign-up. No email. No phone number. Your progress, statistics and streak are
stored on your phone and are never uploaded — they are even excluded from cloud
backup. There is no analytics SDK in this app.

FREE TO PLAY
Wordly is free and supported by ads. Ads never cover the answer controls and
never interrupt a puzzle. Rewarded ads are always your choice: watch one for a
hint or an extra heart, or do not — the game is fully playable either way.

Choose your language and play your first puzzle in under thirty seconds.
```

---

## Data safety form

Answer exactly this. Getting it wrong is the most common cause of a rejected
release.

**Does your app collect or share any of the required user data types?** → **Yes**
(because the AdMob SDK does, even though the app itself does not).

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Device or other IDs | Yes | Yes | Advertising or marketing | Required |
| App interactions | No | No | — | — |
| Personal info | **No** | No | — | — |
| Location | **No** | No | — | — |
| Financial info | **No** | No | — | — |
| Messages, photos, files | **No** | No | — | — |
| App activity / search history | **No** | No | — | — |

- **Is all user data encrypted in transit?** → Yes (HTTPS only).
- **Can users request data deletion?** → Yes — Settings → Reset all progress,
  and uninstalling removes everything.
- **Committed to Play Families Policy?** → No (not targeting children).

The nickname and avatar are **not** "personal info" for this form: they are
user-chosen, optional, stored only on-device and never transmitted.

---

## Content rating questionnaire

| Question | Answer |
|---|---|
| Violence | None |
| Sexuality | None |
| Language | None |
| Controlled substances | None |
| Gambling / simulated gambling | None |
| User-generated content | No |
| Users can interact / share location | No |
| Digital purchases | No |
| Displays ads | **Yes** |

Expected rating: **Everyone / PEGI 3**.

---

## Ads declaration

> **Does your app contain ads?** → **Yes**

Ad formats used: banner, interstitial, rewarded (Google AdMob).

---

## Store graphics

| Asset | Size | File |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | `store/play-icon-512.png` |
| Feature graphic | 1024×500 PNG | `store/feature-graphic-1024x500.png` |
| Phone screenshots | 2–8 required, 1080×1920 or similar | `store/screenshots/` |

Both generated assets are produced by `wordly/tool/generate_icons.mjs`. Run it
again if the brand changes.

### Screenshots — capture these six

Take them on a device or emulator at 1080×1920+ with a language whose script
shows off the app (Tamil or Japanese makes the multilingual point instantly):

1. **Home** — with a visible streak and a level in progress
2. **Unscramble puzzle** — mid-solve, some tiles placed
3. **Multiple choice puzzle** — showing a meaning and four options
4. **Success screen** — confetti, XP, streak
5. **Language picker** — scrolled to show native names in several scripts
6. **Statistics** — with the seven-day chart populated

```bash
flutter run --release
```

```bash
adb exec-out screencap -p > store/screenshots/01-home.png
```

---

## Release checklist

Before the first upload:

- [ ] Replace the AdMob **App ID** in `android/app/src/main/AndroidManifest.xml`
- [ ] Fill in the four production unit IDs in `lib/core/config/ad_ids.dart`
- [ ] Set `contentBaseUrl` in `lib/core/config/app_config.dart` to your Pages URL
- [ ] Create `android/key.properties` from `key.properties.example` and back up
      the keystore somewhere permanent — losing it means you can never update
      this listing again
- [ ] `flutter build appbundle --release`
- [ ] Verify `AdIds.productionIdsConfigured` is true in the release build
- [ ] Publish the privacy policy URL and check it loads
- [ ] Complete the Data safety form exactly as above
- [ ] Upload to **internal testing** first and play a full session on a real
      device before promoting to production
