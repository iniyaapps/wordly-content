# Content specification

Every file the app downloads must match this schema. `tools/validate.mjs`
enforces it; the app's `ContentParser` applies the same rules at runtime and
rejects content that fails, keeping whatever was already installed.

Encoding: **UTF-8, no BOM**. Strings should be **NFC-normalised** (the
validator warns when they are not — two words that look identical but differ in
codepoint order are a duplicate the app will reject).

---

## `version.json`

The only file polled on every launch. Keep it small.

```json
{
  "contentVersion": 1,
  "minimumAppVersion": "1.0.0",
  "languagesVersion": 1,
  "updatedAt": "2026-09-19",
  "languageVersions": { "en": 1, "ta": 1, "hi": 1 }
}
```

| Field | Type | Meaning |
|---|---|---|
| `contentVersion` | int ≥ 1 | Bump on **any** content change. The app compares this first. |
| `minimumAppVersion` | semver string | Apps older than this stop applying updates and tell the user to update from Play. Raise it only when you publish content using a feature old builds cannot parse. |
| `languagesVersion` | int ≥ 1 | Bump when `languages.json` changes (a language added, renamed, enabled or disabled). |
| `updatedAt` | `YYYY-MM-DD` | Informational. |
| `languageVersions` | map code → int | Per-language version. **This is what decides which languages actually download.** Bump only the languages you changed. |

---

## `languages.json`

The catalogue behind the language picker. Include every language you intend to
support, including ones with no content yet.

```json
{
  "languagesVersion": 1,
  "updatedAt": "2026-09-19",
  "languages": [
    {
      "code": "ta",
      "name": "Tamil",
      "nativeName": "தமிழ்",
      "direction": "ltr",
      "scriptProfile": "abugida",
      "enabled": true,
      "contentStatus": "ready",
      "contentVersion": 1,
      "wordCount": 62
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `code` | string | ISO 639-1 where one exists (`ta`, `hi`, `fil`). Must match the folder name. Unique. |
| `name` | string | English name, for search. |
| `nativeName` | string | Shown first in the picker. In the language's own script. |
| `direction` | `ltr` \| `rtl` | `rtl` for Arabic, Hebrew, Persian, Urdu. |
| `scriptProfile` | enum | See the table below. Decides which puzzles are legal. |
| `enabled` | bool | `false` hides it from download. |
| `contentStatus` | `ready` \| `not_ready` | `not_ready` shows "Coming soon". |
| `contentVersion` | int | Mirrors `languageVersions` in `version.json`. |
| `wordCount` | int | Displayed in the picker. Keep roughly accurate. |

### `scriptProfile` values

| Value | Languages | Tile puzzles | Why |
|---|---|---|---|
| `alphabetic` | en es pt fr de it nl ru uk pl tr sv no da fi el cs ro hu bg sk hr sr sw zu af vi id ms fil | Enabled | Discrete letters; safe to shuffle and substitute |
| `abugida` | ta hi bn te mr gu kn ml pa or as ne si th | Enabled, cluster level | Consonant + vowel sign is one visual unit; the app never splits it |
| `abjad` | ar he fa ur | **Disabled** | Letters change shape by position; an isolated-form tile teaches wrong spelling |
| `syllabary` | ko | Enabled, syllable blocks | 한 is one tile, never ㅎ+ㅏ+ㄴ |
| `logographic` | zh | **Disabled** | Characters carry meaning; there is nothing to "spell" |
| `mixedJapanese` | ja | Enabled on `reading` | Kana are tiled, kanji are never split |

---

## `languages/<code>/metadata.json`

```json
{
  "code": "ta",
  "name": "Tamil",
  "nativeName": "தமிழ்",
  "direction": "ltr",
  "scriptProfile": "abugida",
  "contentStatus": "ready",
  "contentVersion": 1,
  "wordCount": 62,
  "display": { "uppercase": false, "fontScale": 1.12 },
  "letterSet": "",
  "distractorSource": "corpus",
  "tileField": "word",
  "enabledTypes": ["unscramble", "missingLetter", "..."],
  "disabledTypes": ["findWrongLetter"],
  "disabledReason": { "findWrongLetter": "why, in one sentence" },
  "params": { }
}
```

| Field | Default | Meaning |
|---|---|---|
| `display.uppercase` | `false` | Store and show words uppercased. `true` for Latin-script languages, `false` for scripts without case. |
| `display.fontScale` | `1.0` | Multiplier for tile glyph size. Indic and CJK scripts usually need 1.1–1.15 to match Latin optical size. |
| `letterSet` | `""` | Alphabet used to source wrong letters in missing-letter puzzles. Only meaningful for `alphabetic`. Include accented forms you want offered (`ÄÖÜ`, `ÁÉÍÓÚÑ`). |
| `distractorSource` | `"letterSet"` | `"corpus"` derives wrong letters from graphemes that actually occur in your word list — **use this for every non-alphabetic script**, so a Tamil distractor is always a real Tamil akshara. |
| `tileField` | `"word"` | `"reading"` makes letter puzzles operate on the `reading` field (Japanese kana) instead of the written form. |
| `enabledTypes` | all | The 15 type ids you allow. |
| `disabledTypes` | `[]` | Explicitly forbidden types; wins over `enabledTypes`. |
| `disabledReason` | `{}` | Free text, for the next maintainer. Not read by the app. |

The app computes the final set as
`scriptProfile.allowedTypes ∩ enabledTypes − disabledTypes`, then narrows it
further per word (a word with no synonyms can never produce a synonym puzzle).

### `params`

All optional; each has a safe default.

| Field | Default | Meaning |
|---|---|---|
| `minGraphemes` / `maxGraphemes` | 3 / 12 | Acceptable word length in tiles. |
| `maxUnscrambleGraphemes` | 10 | Longest word that may be scrambled. Keep at 6 or less for abugidas and CJK — a 9-tile Tamil scramble is genuinely unpleasant. |
| `choiceCounts` | 3/4/4/5 | Options per difficulty. |
| `hintsPerLevel` | 2/2/1/1 | Free hints per difficulty. |
| `timeLimitSeconds` | 0/0/0/45 | 0 means untimed. Only applies to choice puzzles. |
| `speedChallengeSeconds` | 30 | Countdown for the speed type. |
| `distractorSimilarity` | .2/.45/.7/.85 | How strongly wrong answers should resemble the right one. |

### The 15 puzzle type ids

`unscramble`, `missingLetter`, `guessTheWord`, `multipleChoice`,
`wordMeaning`, `synonym`, `antonym`, `categoryId`, `wordOrdering`,
`emojiClue`, `completeTheWord`, `findWrongLetter`, `wordMatching`,
`definitionChallenge`, `speedChallenge`

---

## `languages/<code>/words.json`

```json
{
  "language": "en",
  "contentVersion": 1,
  "updatedAt": "2026-09-19",
  "words": [
    {
      "word": "ELEPHANT",
      "category": "animals",
      "difficulty": 3,
      "frequency": 4200,
      "meaning": "A very large grey animal with a trunk and tusks.",
      "hint": "The largest land animal.",
      "synonyms": [],
      "antonyms": [],
      "emoji": "🐘"
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `word` | **yes** | The word itself. No leading/trailing spaces, no digits, no punctuation. Hyphens and spaces are rejected for tile-puzzle scripts. |
| `reading` | Japanese | Hiragana reading. Required for `ja`; ignored elsewhere. |
| `category` | **yes** | A key from `categories.json`. |
| `difficulty` | **yes** | 1 easy, 2 medium, 3 hard, 4 expert. |
| `frequency` | **yes** | Rank; lower is more common. ~400 = extremely common, 10000 = rare. |
| `meaning` | **yes** | One sentence, **in the same language as the word**. This is shown as a puzzle answer, so make it precise and self-contained. |
| `hint` | no | A shorter, more oblique clue. Shown on easy levels instead of the meaning. |
| `synonyms` | no | Enables synonym puzzles. Words, not phrases. |
| `antonyms` | no | Enables antonym puzzles. |
| `emoji` | no | Enables emoji-clue puzzles. One emoji that unambiguously depicts the word. |

**Rules the validator enforces**

- `words` must be a non-empty array; a `ready` language needs at least 10 usable
  entries.
- `word` must be unique within the language after normalisation.
- Every `category` must exist in the language's `categories.json` (or the
  shared `categories.json`).
- `difficulty` must be 1–4; `frequency` must be a positive number.
- For tile-puzzle scripts, every grapheme cluster in the word must be a letter.
- A word listed as its own synonym or antonym is an error.

**Rules the validator can only warn about — you have to get these right**

- The meaning must actually be the meaning.
- The emoji must actually depict the word (🐅 for TIGER, not 🐈).
- Synonyms must be genuine synonyms in that language, not translations.

---

## `languages/<code>/categories.json`

```json
{
  "language": "ta",
  "contentVersion": 1,
  "categories": [
    { "key": "animals", "label": "விலங்குகள்", "emoji": "🐘" }
  ]
}
```

`key` must match the shared `categories.json`; `label` is the translation.

---

## `languages/<code>/puzzles.json`

```json
{
  "language": "ta",
  "contentVersion": 1,
  "prompts": { "unscramble": "எழுத்துகளைச் சரியாக அடுக்குங்கள்" },
  "labels": {
    "lettersCount": "{n} எழுத்துகள்",
    "startsWith": "{x} இல் தொடங்கும்",
    "endsWith": "{x} இல் முடியும்",
    "categoryIs": "வகை: {x}"
  },
  "weights": {
    "easy":   { "unscramble": 20, "multipleChoice": 20, "wordMeaning": 0 },
    "medium": { },
    "hard":   { },
    "expert": { }
  }
}
```

- `prompts` — the instruction line per puzzle type, in this language.
- `labels` — hint templates. `{n}` and `{x}` are substituted by the app.
- `weights` — relative selection weight per type per difficulty. **0 disables
  the type at that difficulty**, which is how you keep meaning-based puzzles
  out of easy levels. Values are relative, not percentages.

A type with a positive weight that the script profile forbids is simply never
selected — the weight is ignored rather than causing an error.
