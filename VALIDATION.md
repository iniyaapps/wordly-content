# Validating content before you publish

Run this before every push. It takes about a second and it is the difference
between shipping a broken update and catching it on your laptop.

```bash
node tools/validate.mjs
```

Requires **Node 18 or newer**. No `npm install` — the script has no
dependencies.

```bash
node tools/validate.mjs ta hi
```

```bash
node tools/validate.mjs --strict
```

| Exit code | Meaning |
|---|---|
| `0` | Safe to publish |
| `1` | Errors found (or warnings, with `--strict`) |

---

## What it checks

The validator mirrors the rules the app applies at runtime, so anything it
accepts the app can load, and anything it rejects the app would have silently
discarded on a player's phone.

**Errors — these break the app or a puzzle type:**

- Invalid JSON, or a UTF-8 BOM
- `version.json` / `languages.json` / `metadata.json` disagreeing about a
  version number or a script profile
- A language marked `ready` with no folder, or missing from `languageVersions`
- Unknown puzzle type ids
- A difficulty band with no puzzle type at a positive weight — nothing could be
  generated
- Japanese without `"tileField": "reading"` (kanji would be split into tiles)
- Duplicate words after Unicode normalisation
- `difficulty` outside 1–4, missing `frequency`, missing `meaning`
- A word containing a digit, punctuation, or a stray combining mark for a
  tile-puzzle script
- A category with no label anywhere
- A word listed as its own synonym, or the same word as both a synonym and an
  antonym
- Fewer than 10 usable words in a `ready` language
- More than 40% single-tile words (tile puzzles become impossible)

**Warnings — the app copes, but the content is weaker than it looks:**

- `wordCount` in `languages.json` disagreeing with the actual count
- A puzzle type enabled with too little material (emoji clues with three
  emoji, synonym puzzles with two synonym pairs)
- A difficulty band with no words
- A tile puzzle enabled on a script that cannot support it — the app ignores it
- A missing `categories.json` or `puzzles.json`
- Text that is not NFC-normalised

---

## What it cannot check

The validator verifies **structure**. It cannot verify **truth**. These need a
human, ideally a native speaker:

- Is the meaning actually the meaning?
- Is the emoji the right animal? (🐅 for TIGER, not 🐈)
- Are the "synonyms" really synonyms in this language, rather than translations
  or loose associations?
- Is the difficulty rating plausible for a learner?
- Is anything offensive, or culturally loaded in a way you did not intend?

A structurally perfect file full of wrong definitions passes with a green tick.

---

## Continuous integration

`.github/workflows/validate.yml` runs the validator on every push and pull
request. A failing run blocks nothing by itself — **GitHub Pages will still
publish a broken file** — so either watch the check, or protect `main` with a
required status check:

Settings → Branches → Add branch protection rule → `main` →
*Require status checks to pass before merging* → select **validate**.

That is the only way to guarantee a broken file never reaches players.

---

## If you publish something broken anyway

Nothing catastrophic happens, by design:

1. The app downloads the new files.
2. It parses and validates them **in memory**.
3. Validation fails, so the transaction that would replace the old content
   never runs.
4. The player keeps the content they already had and carries on playing.
5. The app retries on the next launch.

Fix the file and push again. Players pick up the correction automatically. You
do not need to ship an app update, and you do not need to roll back — but do
bump `contentVersion` again so the retry is not skipped.
