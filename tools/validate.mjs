#!/usr/bin/env node
/**
 * Wordly content validator.
 *
 * Zero dependencies, Node 18+. Mirrors the rules the app's ContentParser
 * applies at runtime, so anything this accepts the app can load, and anything
 * it rejects would have been silently discarded on a player's phone.
 *
 *   node tools/validate.mjs            validate everything
 *   node tools/validate.mjs ta hi      validate only these languages
 *   node tools/validate.mjs --strict   treat warnings as errors (used in CI)
 *
 * Exit code 0 = safe to publish.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PUZZLE_TYPES = new Set([
  'unscramble', 'missingLetter', 'guessTheWord', 'multipleChoice',
  'wordMeaning', 'synonym', 'antonym', 'categoryId', 'wordOrdering',
  'emojiClue', 'completeTheWord', 'findWrongLetter', 'wordMatching',
  'definitionChallenge', 'speedChallenge',
]);

const SCRIPT_PROFILES = new Set([
  'alphabetic', 'abugida', 'abjad', 'syllabary', 'logographic', 'mixedJapanese',
]);

/** Profiles where every grapheme of a word must be a letter tile. */
const TILE_PROFILES = new Set(['alphabetic', 'abugida', 'syllabary', 'mixedJapanese']);

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'];

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

// ── helpers ────────────────────────────────────────────────────────────────

function readJson(relPath) {
  const full = join(ROOT, relPath);
  if (!existsSync(full)) return null;
  const raw = readFileSync(full, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) {
    err(relPath, 'file starts with a UTF-8 BOM; save it without one');
  }
  try {
    return JSON.parse(raw.replace(/^﻿/, ''));
  } catch (e) {
    err(relPath, `invalid JSON: ${e.message}`);
    return null;
  }
}

/** Grapheme clusters, matching what the app's GraphemeService produces. */
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = (s) => [...segmenter.segment(s)].map((g) => g.segment);

/** Mirrors GraphemeService.isLetterTile. */
function isLetterTile(tile) {
  if (!tile || !tile.trim()) return false;
  const cp = tile.codePointAt(0);
  if (cp < 0x80) return /[A-Za-z]/.test(tile[0]);
  if (cp >= 0x2000 && cp <= 0x206f) return false;
  if (cp >= 0x3000 && cp <= 0x303f) return false;
  if (cp >= 0xff00 && cp <= 0xff0f) return false;
  if (cp >= 0x1f000) return false;
  // A well-formed cluster starts with a base character, not a combining mark.
  return !/^\p{M}/u.test(tile);
}

const normalize = (s) => s.normalize('NFC').trim().replace(/[​-‍﻿]/g, '');
const keyOf = (s, profile) =>
  profile === 'alphabetic' ? normalize(s).toUpperCase() : normalize(s);

// ── root files ─────────────────────────────────────────────────────────────

const version = readJson('version.json');
const catalog = readJson('languages.json');
const sharedCategories = readJson('categories.json');

if (!version) err('version.json', 'missing');
if (!catalog) err('languages.json', 'missing');

let declaredLanguages = [];
let sharedCategoryKeys = new Set();

if (sharedCategories?.categories) {
  sharedCategoryKeys = new Set(sharedCategories.categories.map((c) => c.key));
}

if (version) {
  const f = 'version.json';
  if (!Number.isInteger(version.contentVersion) || version.contentVersion < 1) {
    err(f, 'contentVersion must be an integer >= 1');
  }
  if (!Number.isInteger(version.languagesVersion) || version.languagesVersion < 1) {
    err(f, 'languagesVersion must be an integer >= 1');
  }
  if (!/^\d+\.\d+\.\d+$/.test(version.minimumAppVersion ?? '')) {
    err(f, 'minimumAppVersion must look like 1.0.0');
  }
  if (version.updatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(version.updatedAt)) {
    warn(f, 'updatedAt should be YYYY-MM-DD');
  }
  if (version.languageVersions && typeof version.languageVersions !== 'object') {
    err(f, 'languageVersions must be an object');
  }
}

if (catalog) {
  const f = 'languages.json';
  if (!Array.isArray(catalog.languages) || catalog.languages.length === 0) {
    err(f, 'languages must be a non-empty array');
  } else {
    const seen = new Set();
    for (const l of catalog.languages) {
      if (!l.code) { err(f, 'a language has no code'); continue; }
      if (seen.has(l.code)) err(f, `duplicate code "${l.code}"`);
      seen.add(l.code);
      if (!l.nativeName) err(f, `${l.code}: nativeName is required`);
      if (!l.name) err(f, `${l.code}: name is required`);
      if (!SCRIPT_PROFILES.has(l.scriptProfile)) {
        err(f, `${l.code}: unknown scriptProfile "${l.scriptProfile}"`);
      }
      if (!['ltr', 'rtl'].includes(l.direction)) {
        err(f, `${l.code}: direction must be ltr or rtl`);
      }
      if (!['ready', 'not_ready'].includes(l.contentStatus)) {
        err(f, `${l.code}: contentStatus must be ready or not_ready`);
      }
      if (l.contentStatus === 'ready' && !existsSync(join(ROOT, 'languages', l.code))) {
        err(f, `${l.code}: marked ready but languages/${l.code}/ does not exist`);
      }
      if (l.contentStatus === 'ready' && l.enabled !== true) {
        warn(f, `${l.code}: ready but not enabled, so players cannot download it`);
      }
      if (l.contentStatus === 'ready' && version?.languageVersions &&
          version.languageVersions[l.code] === undefined) {
        err(f, `${l.code}: ready but missing from version.json languageVersions`);
      }
      declaredLanguages.push(l);
    }
    if (version && catalog.languagesVersion !== version.languagesVersion) {
      err(f, `languagesVersion (${catalog.languagesVersion}) does not match version.json (${version.languagesVersion})`);
    }
  }
}

// Folders on disk that nobody declared.
const langDir = join(ROOT, 'languages');
if (existsSync(langDir)) {
  const onDisk = readdirSync(langDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const declared = new Set(declaredLanguages.map((l) => l.code));
  for (const code of onDisk) {
    if (!declared.has(code)) {
      warn('languages.json', `languages/${code}/ exists but is not listed; it will never be downloaded`);
    }
  }
}

// ── per language ───────────────────────────────────────────────────────────

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const strict = process.argv.includes('--strict');

let totalWords = 0;

for (const lang of declaredLanguages) {
  if (lang.contentStatus !== 'ready') continue;
  if (only.length && !only.includes(lang.code)) continue;

  const code = lang.code;
  const base = `languages/${code}`;
  const meta = readJson(`${base}/metadata.json`);
  const words = readJson(`${base}/words.json`);
  const cats = readJson(`${base}/categories.json`);
  const puzzles = readJson(`${base}/puzzles.json`);

  if (!meta) { err(`${base}/metadata.json`, 'missing'); continue; }
  if (!words) { err(`${base}/words.json`, 'missing'); continue; }

  // ── metadata ──
  const mf = `${base}/metadata.json`;
  if (meta.code !== code) err(mf, `code "${meta.code}" does not match folder "${code}"`);
  if (meta.scriptProfile !== lang.scriptProfile) {
    err(mf, `scriptProfile "${meta.scriptProfile}" disagrees with languages.json ("${lang.scriptProfile}")`);
  }
  if (meta.direction !== lang.direction) {
    err(mf, `direction "${meta.direction}" disagrees with languages.json`);
  }
  if (version?.languageVersions?.[code] !== undefined &&
      meta.contentVersion !== version.languageVersions[code]) {
    err(mf, `contentVersion ${meta.contentVersion} does not match version.json languageVersions.${code} (${version.languageVersions[code]})`);
  }

  const profile = meta.scriptProfile;
  const uppercase = meta.display?.uppercase === true;

  for (const t of meta.enabledTypes ?? []) {
    if (!PUZZLE_TYPES.has(t)) err(mf, `unknown puzzle type "${t}" in enabledTypes`);
  }
  for (const t of meta.disabledTypes ?? []) {
    if (!PUZZLE_TYPES.has(t)) err(mf, `unknown puzzle type "${t}" in disabledTypes`);
  }

  // Script-profile sanity: enabling a tile puzzle on an abjad is a content bug
  // the app will silently correct, so flag it here where it can be fixed.
  const TILE_TYPES = ['unscramble', 'missingLetter', 'guessTheWord', 'wordOrdering',
                      'completeTheWord', 'findWrongLetter'];
  if (!TILE_PROFILES.has(profile)) {
    for (const t of meta.enabledTypes ?? []) {
      if (TILE_TYPES.includes(t) && !(meta.disabledTypes ?? []).includes(t)) {
        warn(mf, `"${t}" is enabled but scriptProfile "${profile}" cannot support it; the app will ignore it`);
      }
    }
  }
  if (profile === 'mixedJapanese' && meta.tileField !== 'reading') {
    err(mf, 'Japanese must set "tileField": "reading" so kanji are never split into tiles');
  }
  if (profile !== 'alphabetic' && meta.distractorSource !== 'corpus') {
    warn(mf, `scriptProfile "${profile}" should set "distractorSource": "corpus" so wrong letters come from real ${code} graphemes`);
  }
  if (profile === 'alphabetic' && !meta.letterSet) {
    warn(mf, 'alphabetic language with an empty letterSet; missing-letter distractors will fall back to the corpus');
  }

  // ── categories ──
  const langCategoryKeys = new Set(
    (cats?.categories ?? []).map((c) => c.key),
  );
  if (!cats) warn(`${base}/categories.json`, 'missing; the app will show raw category keys');
  for (const c of cats?.categories ?? []) {
    if (!sharedCategoryKeys.has(c.key)) {
      warn(`${base}/categories.json`, `category "${c.key}" is not in the shared categories.json`);
    }
    if (!c.label) err(`${base}/categories.json`, `category "${c.key}" has no label`);
  }

  // ── puzzles ──
  if (!puzzles) {
    warn(`${base}/puzzles.json`, 'missing; the app will use English prompts');
  } else {
    const pf = `${base}/puzzles.json`;
    for (const t of Object.keys(puzzles.prompts ?? {})) {
      if (!PUZZLE_TYPES.has(t)) err(pf, `unknown puzzle type "${t}" in prompts`);
    }
    for (const d of DIFFICULTIES) {
      const w = puzzles.weights?.[d];
      if (!w) { warn(pf, `no weights for "${d}"; defaults will be used`); continue; }
      let positive = 0;
      for (const [t, v] of Object.entries(w)) {
        if (!PUZZLE_TYPES.has(t)) err(pf, `unknown puzzle type "${t}" in weights.${d}`);
        if (typeof v !== 'number' || v < 0) err(pf, `weights.${d}.${t} must be a number >= 0`);
        if (v > 0) positive++;
      }
      if (positive === 0) err(pf, `weights.${d} has no type with a positive weight; no puzzle can be generated`);
    }
    const missingPrompts = [...PUZZLE_TYPES].filter(
      (t) => (meta.enabledTypes ?? []).includes(t) &&
             !(meta.disabledTypes ?? []).includes(t) &&
             !puzzles.prompts?.[t],
    );
    if (missingPrompts.length) {
      warn(pf, `no prompt for: ${missingPrompts.join(', ')} (English will be shown)`);
    }
  }

  // ── words ──
  const wf = `${base}/words.json`;
  if (words.language !== code) err(wf, `language "${words.language}" does not match folder`);
  if (!Array.isArray(words.words)) { err(wf, 'words must be an array'); continue; }

  const seen = new Map();
  const maxGraphemes = meta.params?.maxGraphemes ?? 12;
  const minGraphemes = meta.params?.minGraphemes ?? 3;
  let usable = 0;
  let withEmoji = 0, withHint = 0, withSyn = 0, withAnt = 0;
  /// Single-tile words are legal — the app routes them to choice-style
  /// puzzles — but a pack that is mostly one-tile words loses tile puzzles
  /// entirely, so report them once as a share rather than line by line.
  const shortWords = [];
  const byDifficulty = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const categoryCounts = new Map();

  for (const [i, w] of words.words.entries()) {
    const at = `${wf}[${i}]`;
    if (typeof w !== 'object' || w === null) { err(at, 'not an object'); continue; }
    if (typeof w.word !== 'string' || !w.word.trim()) { err(at, 'word is required'); continue; }
    if (typeof w.meaning !== 'string' || !w.meaning.trim()) {
      err(at, `"${w.word}": meaning is required`);
      continue;
    }

    const display = uppercase ? normalize(w.word).toUpperCase() : normalize(w.word);
    if (w.word !== w.word.trim()) err(at, `"${w.word}" has leading or trailing whitespace`);
    if (normalize(w.word) !== w.word.normalize('NFC').trim()) {
      warn(at, `"${w.word}" contains zero-width characters`);
    }
    if (w.word.normalize('NFC') !== w.word) {
      warn(at, `"${w.word}" is not NFC-normalised`);
    }

    const key = keyOf(display, profile);
    if (seen.has(key)) {
      err(at, `duplicate word "${w.word}" (first seen at index ${seen.get(key)})`);
      continue;
    }
    seen.set(key, i);

    // Tiles
    const tileSource = meta.tileField === 'reading' ? w.reading : display;
    if (meta.tileField === 'reading' && !w.reading) {
      err(at, `"${w.word}": reading is required when tileField is "reading"`);
      continue;
    }
    if (tileSource) {
      const g = graphemes(tileSource);
      if (g.length > maxGraphemes) {
        err(at, `"${w.word}" is ${g.length} tiles, over maxGraphemes ${maxGraphemes}`);
      }
      if (g.length < 2) shortWords.push(w.word);
      if (TILE_PROFILES.has(profile)) {
        for (const tile of g) {
          if (!isLetterTile(tile)) {
            err(at, `"${w.word}" contains a non-letter tile "${tile}" (U+${tile.codePointAt(0).toString(16).toUpperCase()})`);
            break;
          }
        }
      }
    }

    if (/[\r\n\t]/.test(w.word) || /[\r\n\t]/.test(w.meaning)) {
      err(at, `"${w.word}" contains control characters`);
    }
    if (!Number.isInteger(w.difficulty) || w.difficulty < 1 || w.difficulty > 4) {
      err(at, `"${w.word}": difficulty must be 1-4`);
    } else {
      byDifficulty[w.difficulty]++;
    }
    if (typeof w.frequency !== 'number' || w.frequency <= 0) {
      err(at, `"${w.word}": frequency must be a positive number`);
    }
    if (!w.category) {
      err(at, `"${w.word}": category is required`);
    } else {
      categoryCounts.set(w.category, (categoryCounts.get(w.category) ?? 0) + 1);
      if (langCategoryKeys.size && !langCategoryKeys.has(w.category) &&
          !sharedCategoryKeys.has(w.category)) {
        err(at, `"${w.word}": category "${w.category}" has no label anywhere`);
      }
    }

    const upper = display.toUpperCase();
    for (const s of w.synonyms ?? []) {
      if (normalize(s).toUpperCase() === upper) {
        err(at, `"${w.word}" lists itself as a synonym`);
      }
    }
    for (const a of w.antonyms ?? []) {
      if (normalize(a).toUpperCase() === upper) {
        err(at, `"${w.word}" lists itself as an antonym`);
      }
      if ((w.synonyms ?? []).some((s) => normalize(s).toUpperCase() === normalize(a).toUpperCase())) {
        err(at, `"${w.word}": "${a}" is listed as both a synonym and an antonym`);
      }
    }
    if (w.emoji && graphemes(w.emoji).length !== 1) {
      warn(at, `"${w.word}": emoji should be a single emoji, got "${w.emoji}"`);
    }

    if (w.emoji) withEmoji++;
    if (w.hint) withHint++;
    if (w.synonyms?.length) withSyn++;
    if (w.antonyms?.length) withAnt++;
    usable++;
  }

  totalWords += usable;

  if (usable < 10) {
    err(wf, `only ${usable} usable words; a "ready" language needs at least 10`);
  }
  if (lang.wordCount !== undefined && Math.abs(lang.wordCount - usable) > Math.max(5, usable * 0.1)) {
    warn('languages.json', `${code}: wordCount says ${lang.wordCount} but words.json has ${usable}`);
  }

  // Playability: can each enabled type actually be produced?
  const enabled = new Set(
    (meta.enabledTypes ?? []).filter((t) => !(meta.disabledTypes ?? []).includes(t)),
  );
  if (shortWords.length) {
    const share = Math.round((shortWords.length / usable) * 100);
    const sample = shortWords.slice(0, 5).join(', ');
    const msg = `${shortWords.length} word(s) (${share}%) are a single tile and can only be used in ` +
                `choice-style puzzles: ${sample}${shortWords.length > 5 ? ', …' : ''}`;
    if (share > 40) err(wf, `${msg} — too many for tile puzzles to work; add longer words`);
    else warn(wf, msg);
  }
  if (enabled.has('emojiClue') && withEmoji < 4) {
    warn(wf, `emojiClue is enabled but only ${withEmoji} words have an emoji`);
  }
  if (enabled.has('synonym') && withSyn < 3) {
    warn(wf, `synonym is enabled but only ${withSyn} words have synonyms`);
  }
  if (enabled.has('antonym') && withAnt < 3) {
    warn(wf, `antonym is enabled but only ${withAnt} words have antonyms`);
  }
  if (enabled.has('categoryId') && categoryCounts.size < 3) {
    warn(wf, `categoryId is enabled but only ${categoryCounts.size} categories are used`);
  }
  for (const d of [1, 2, 3, 4]) {
    if (byDifficulty[d] === 0) {
      warn(wf, `no words at difficulty ${d}; levels in that band will use adjacent difficulties`);
    }
  }

  const dist = [1, 2, 3, 4].map((d) => `${d}:${byDifficulty[d]}`).join(' ');
  console.log(
    `  ${code.padEnd(4)} ${String(usable).padStart(5)} words  [${dist}]  ` +
    `emoji:${withEmoji} hint:${withHint} syn:${withSyn} ant:${withAnt}`,
  );
}

// ── report ─────────────────────────────────────────────────────────────────

console.log('');
if (warnings.length) {
  console.log(`${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
  console.log('');
}
if (errors.length) {
  console.log(`${errors.length} error(s):`);
  for (const e of errors) console.log(`  x ${e}`);
  console.log('');
  console.log('NOT safe to publish.');
  process.exit(1);
}

if (strict && warnings.length) {
  console.log('Strict mode: warnings are errors. NOT safe to publish.');
  process.exit(1);
}

console.log(`OK — ${totalWords} words across ${declaredLanguages.filter((l) => l.contentStatus === 'ready').length} ready languages. Safe to publish.`);
