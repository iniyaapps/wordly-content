# wordly-content

Game content for the **Wordly** Android app: word lists, categories, puzzle
prompts and version metadata, published as static JSON over HTTPS.

The app reads these files and nothing else. There is no server, no database and
no API — just files in this repository served by GitHub Pages.

```
                Flutter app
                     |  HTTPS GET
                     v
          <username>.github.io/wordly-content/
                     |
              version.json        <- polled at startup
              languages.json      <- the language catalogue
              languages/<code>/*  <- one folder per language
```

**No user data ever comes here.** Progress, statistics and settings stay on the
player's device. This repository is public, one-way, read-only content.

---

## Repository layout

```
wordly-content/
├── README.md                      this file
├── CONTENT_SPEC.md                the schema every file must satisfy
├── VALIDATION.md                  how to check content before you push
├── version.json                   content + per-language versions
├── languages.json                 the catalogue shown in the app
├── categories.json                shared category keys and emoji
├── tools/
│   └── validate.mjs               zero-dependency validator (Node 18+)
├── .github/workflows/validate.yml CI: rejects a bad push
├── legal/
│   ├── privacy.html               privacy policy (required by Google Play)
│   └── terms.html                 terms of use
└── languages/
    ├── en/  metadata.json  words.json  categories.json  puzzles.json
    ├── ta/  …    hi/  …    es/  …    pt/  …
    ├── fr/  …    de/  …    id/  …    ja/  …    ko/  …
```

### The four files per language

| File | Required | What it holds |
|---|---|---|
| `metadata.json` | **yes** | Script profile, direction, which puzzle types are legal, tuning parameters |
| `words.json` | **yes** | The word list: word, category, difficulty, meaning, hint, synonyms, antonyms, emoji |
| `categories.json` | no | Category labels translated into this language |
| `puzzles.json` | no | Puzzle prompts in this language plus per-difficulty type weights |

Without `categories.json` the app falls back to raw category keys; without
`puzzles.json` it uses English prompts and default weights. Both are strongly
recommended — a Tamil player should see Tamil instructions.

---

## Publishing: first-time setup

1. **Create the repository** on GitHub, named `wordly-content`, **public**.
   (It must be public: GitHub Pages on a private repo needs a paid plan, and
   the app fetches these files anonymously.)

2. **Push this folder's contents** to the `main` branch:

   ```bash
   git init && git branch -M main
   git add .
   git commit -m "Initial content"
   git remote add origin https://github.com/<username>/wordly-content.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**: repository → **Settings** → **Pages** →
   *Build and deployment* → Source: **Deploy from a branch** → Branch:
   **main**, folder: **/ (root)** → **Save**.

4. **Wait about a minute**, then confirm the URL works. The green banner at the
   top of the Pages settings shows it:

   ```
   https://<username>.github.io/wordly-content/
   ```

   Open `https://<username>.github.io/wordly-content/version.json` in a browser.
   You should see the JSON. If you get a 404, Pages has not finished building.

5. **Paste the URL into the app**, in exactly one place:

   `wordly/lib/core/config/app_config.dart`

   ```dart
   static const String contentBaseUrl =
       'https://<username>.github.io/wordly-content/';
   ```

   The trailing slash is required. Every other URL in the app is derived from
   this constant by `ContentEndpoints`, so this is the only edit.

---

## Updating content later

1. Edit or add files.
2. Run the validator (see `VALIDATION.md`):
   ```bash
   node tools/validate.mjs
   ```
3. **Bump the version numbers** — this is what triggers the download:
   - `version.json` → increment `contentVersion`
   - `version.json` → increment the entry in `languageVersions` for each
     language you changed
   - `languages/<code>/metadata.json` → set `contentVersion` to the same number
   - if you added or removed a language: increment `languagesVersion` in both
     `version.json` and `languages.json`
4. `git push`. GitHub Pages redeploys in under a minute.

### How the app detects the update

On launch (throttled to once every six hours) the app fetches `version.json`
with a 3-second timeout:

```
remote.contentVersion > local ?
  no  -> done, nothing downloaded
  yes -> for each INSTALLED language whose languageVersions entry moved:
           download metadata + words + categories + puzzles
           parse and validate them in memory
           valid?  -> swap into SQLite in ONE transaction
           invalid -> discard, keep the existing content, try again next launch
```

Consequences worth knowing:

- A player who does not have Japanese installed downloads nothing when you
  update Japanese.
- **If you bump a version but the new file is broken, players keep the old
  content.** The app never deletes working content before the replacement has
  validated.
- If you forget to bump the version, nobody gets the change.

---

## Adding a new language

No Flutter code changes. None.

1. `mkdir languages/<code>` and add the four files. Copy `languages/en/` as a
   starting point and read `CONTENT_SPEC.md` for the fields.
2. Pick the right `scriptProfile` — this is the single most important field,
   because it decides which puzzle types are linguistically safe:

   | scriptProfile | Use for | Letter-tile puzzles |
   |---|---|---|
   | `alphabetic` | Latin, Cyrillic, Greek | Yes |
   | `abugida` | Tamil, Devanagari, Bengali, Kannada, Malayalam, Telugu, Thai | Yes, at grapheme-cluster level |
   | `abjad` | Arabic, Hebrew, Persian, Urdu | **No** — letters change shape by position |
   | `syllabary` | Korean | Yes, whole syllable blocks |
   | `logographic` | Chinese | **No** |
   | `mixedJapanese` | Japanese | Yes, on the kana `reading` field only |

3. Add the language to `languages.json` with `"enabled": true` and
   `"contentStatus": "ready"`.
4. Bump `contentVersion`, `languagesVersion` and add a `languageVersions` entry.
5. Validate, then push.

The language appears in the app's picker on the next catalogue refresh, and
players can download it on demand.

### Languages that are not ready yet

List them in `languages.json` with `"contentStatus": "not_ready"` and
`"enabled": false`. The app shows them greyed out as "Coming soon" instead of
shipping invented words. **Do not publish machine-translated or guessed
vocabulary as `ready`** — a wrong meaning in a learning app is worse than a
missing language.

---

## Scaling to 10,000 or 100,000 words

Nothing about the format changes; `words.json` is just a longer array.

- **The app already handles it.** Words go into an indexed SQLite table, and
  only the most frequent ~4,000 (plus a reserve of harder words) are held in
  memory. Generation reads from indexes, not a linear scan.
- **Keep one file per language.** GitHub Pages serves it gzipped; 100,000
  entries is roughly 12–18 MB raw, 2–4 MB over the wire. A player downloads it
  once.
- **Set `frequency` sensibly.** It is the rank that drives difficulty tuning:
  roughly 1–2,000 for everyday words, up to 10,000+ for rare ones. If a bulk
  import has no frequency data, derive it from a frequency list rather than
  leaving everything at the default.
- **Keep `difficulty` honest** (1 easy → 4 expert). The engine blends it with
  `frequency`, so a mis-tagged word mostly lands in the wrong level band rather
  than breaking anything.
- If a single file ever becomes unwieldy to edit, split your *source* data
  however you like and generate `words.json` as a build step. The published
  file must stay a single JSON document.

---

## Content quality rules

These are not style preferences. Google Play removes apps for shipping
offensive or infringing content, and a language-learning app that teaches wrong
words loses its users.

- **Real words only.** No invented vocabulary, no placeholders, no test data.
- **Correct spelling** in the language's standard orthography.
- **Accurate meanings**, written in the same language as the word.
- **No offensive terms**, slurs, or vulgar vocabulary.
- **No culturally inappropriate clues.** A clue that is neutral in one country
  can be loaded in another.
- **No copied dictionaries.** Do not paste definitions from a copyrighted
  dictionary. Write short original definitions, or use a source whose licence
  explicitly permits redistribution (and record it in the language's
  `metadata.json` `notes` field).
- **No duplicates.** The validator catches exact duplicates; watch for
  near-duplicates that differ only in encoding.
- **Have a native speaker review** anything you did not write yourself.
