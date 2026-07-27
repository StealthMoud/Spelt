# Spelt — Implementation Plan

Audit date: 2026-07-27 · Baseline commit: `9fbd4ce` · Branch: `main`

This document is written for an implementer (human or agent) working through the codebase
task by task. Every task names the exact files it touches and states what "done" means.
Do not batch unrelated tasks into one commit. Follow the commit rules in
[.agents/rules/git-commits.md](.agents/rules/git-commits.md) (3–5 words, lowercase, no emoji).

---

# ⚠️ STATUS — verified 2026-07-27 against commit `2b23bb9`

Fifteen commits have landed (`25a9401`..`2b23bb9`). Execution steps 1–10 and 14 are **done**.
Everything below was verified by inspecting the code and re-running the measurements, not by
reading commit messages.

**`npm run check` currently passes** (lint 0 errors / 34 warnings, 15/15 tests, build OK).
That is the floor, not the finish line — six tasks remain, listed under "Remaining work".

### Done and verified ✅

| Task | Evidence |
|---|---|
| 1.1 dev reloader + `logDebug` removed | `background/reloader.js` gone; `grep localhost` → 0 |
| 1.2 host permissions corrected | `generativelanguage`, `datamuse`, `gstatic` added; localhost removed |
| 1.3 naming purge | marketing-word hits **64 → 4**; emoji in UI strings → 0 |
| 1.4 README / CHROMEWEBSTORE rewritten | no `🤖 Premium AI Coaching`, no "state-of-the-art" |
| 1.5 housekeeping | `samples/` and `debug_extension.log` deleted; lockfile tracked; scripts moved to [scripts/](scripts/) |
| 2.1 US/UK variant bug | [popup/js/practice/answer.js](popup/js/practice/answer.js); `rate.js` reads `getLastSpellingResult()` |
| 2.2 dead ternary | `let tr = null;` |
| 2.3 dictionary session cache | [shared/storage/dictionary-source.js](shared/storage/dictionary-source.js) |
| 2.4 `User-Agent` headers | 0 remaining |
| 2.5 object-URL leak | `revokeObjectURL` on `ended`/`error` |
| 2.6 `crypto.randomUUID()` | all 3 sites |
| 2.7 schema versioning | `getWordsRaw()` + `spelt_schema_version` |
| 2.8 opaque deck | `peekCard`/`advanceDeck`/`requeueCard`/`replaceDeck` |
| 2.9 shared due selectors | [src/core/selectors.js](src/core/selectors.js) |
| 2.11 `alert()` removed | **6 → 0** |
| 2.12 unused imports | lint clean of errors |
| 3.2 model-authored HTML | prompt no longer requests raw HTML |
| 3.3 API keys → `x-goog-api-key` header | all 4 sites |
| 3.4 CSP declared | but see ⚠️ note under 5.1 below |
| 4.1 `src/core` + `src/data` | real migration; `shared/*` are re-export shims |
| 5.2 CSS consolidation | **45 → 12 stylesheets**, domain-named, no numeric suffixes |
| 8 (partial) vault search debounce | landed |
| 9.1 lint + format | **0 errors**; `check` script added |
| 9.2 tests | 15/15 pass |

### Round 2 (`0c09bc2`..`79e8d64`) — R1–R5 done, R6 mostly not

| # | Task | Result |
| --- | --- | --- |
| **R1** | Font | ✅ Resolved by **dropping Outfit for a system font stack** rather than self-hosting. Remote `@import` gone, `style-src 'self'` now in the CSP, 3.4 fully closed. Note this is a deliberate visual change: the extension no longer ships a custom typeface. |
| **R2** | Tokens + reduced motion | ✅ 22 scale tokens; `prefers-reduced-motion` block in [animations.css](popup/styles/animations.css) |
| **R3** | Escaping | ✅ **10 → 0** unescaped interpolations. The Gemini-output path at `correct_card.js` is closed. |
| **R4** | Inline styles | ✅ **292 → 0** in [src/html/](src/html/); `.style.display =` **167 → 2** |
| **R5** | Accessibility | ⚠️ **Partial.** 70 `aria-*`/`role` attributes added ✅ — but the modal work (6.7) was not done. |
| **R6** | Structural + CI | ⚠️ **Mostly not done.** Only the CI workflow landed. |

Also cleared: all 34 lint warnings (**now 0 errors, 0 warnings**). `npm run check` exits 0.

### Remaining work — 2 tasks

| # | Task | Current measurement | Plan § |
| --- | --- | --- | --- |
| **R5b** | **Modals.** The 70 aria attributes went on buttons and tabs; the dialogs were skipped. `#word-form-modal` and `#popup-confirm-modal` are still `div`s toggled with `.style.display`, with **no `role`, no `aria-modal`, no focus trap, no focus restore, and no `Escape` handler** (the only Escape binding lives in [practice/keydowns.js](popup/js/practice/keydowns.js) and fires solely while the Practice tab is active). Convert both to `<dialog>` + `showModal()`, which supplies focus trapping, Escape and a backdrop for free. Also split `showConfirm(title, msg, onConfirm, cancelable)` into `confirm()` / `progress()` / `notify()` — it is currently used for all three. | 0 `<dialog>`; 0 `aria-modal` | 6.7 |
| **R6** | **Structural leftovers.** `mountHintPanel` was extracted ✅ (the duplicated hint-panel pair is gone), but everything else in 4.2/4.3/9.3 remains: **8 `cloneNode(true)`** listener-shedding sites and `makeElementDraggable` (4 refs) are all still inside [practice/card.js](popup/js/practice/card.js), which is **672 lines**. [popup/popup.html](popup/popup.html) is still tracked as a 1186-line generated artefact. | 8 cloneNode; 4 draggable; card.js 672; popup.html tracked | 4.2, 4.3, 9.3 |

**R6 breakdown** — do these four in order:

1. Move `makeElementDraggable` out to `popup/js/components/draggable.js`.
2. Replace all 8 `cloneNode(true)` listener-shedding sites with **one** `AbortController` per card:
   bind controls once at init, `cardScope.abort()` on card change, pass `{ signal }` to each
   `addEventListener`. This is the pattern already described in §4.3.
3. Split the remainder of `card.js` into `deck.js` / `front_face.js` / `ai_panels.js` per the table
   in §4.2. Target: no file over ~250 lines.
4. Emit the build to `dist/`, add `dist/` to [.gitignore](.gitignore), and
   `git rm --cached popup/popup.html` so the generated file stops being tracked. Update the
   `default_popup` path in [manifest.json](manifest.json) to match wherever the build now writes.

Phase 6 (the wider UI/UX rework, §6.1–6.6) remains out of scope for this pass.

---

## §A — Rules for the remaining work

1. **`npm run check` must pass after every task.** It passes right now; do not regress it. The
   34 remaining warnings are `no-unused-vars` — clear them as you touch each file rather than in
   one sweep.
2. **Re-measure, don't assume.** Each task in the table above has a number attached. After
   finishing a task, re-run its measurement command (see §B) and confirm the number moved. Three
   earlier commits claimed work that the measurements showed had not landed — that is what this
   status section exists to catch.
3. **One task per commit**, 3–5 word lowercase messages per
   [.agents/rules/git-commits.md](.agents/rules/git-commits.md).
4. **Do not start Phase 6** before R4. Phase 6 rewrites the same markup R4 restyles.

## §B — Verification commands

Run from the repo root.

### Open tasks

```sh
npm run check                                                    # must exit 0

# R5b  expect 2 dialogs, 2 aria-modal, and an Escape/close handler
grep -c "<dialog" src/html/modal-confirm.html src/html/modal-word-form.html
grep -rn "aria-modal" src/html/ | wc -l
grep -rn "showModal\|close()" popup/js/vault/confirm.js popup/js/vault/modal.js | wc -l

# R6  expect 0, 0, no output, and no file over ~250 lines
grep -rn "cloneNode(true)" --include="*.js" popup | wc -l
grep -rn "makeElementDraggable" --include="*.js" popup/js/practice | wc -l
git ls-files popup/popup.html
wc -l popup/js/practice/*.js | sort -rn | head -5
```

### Regression guard — these are green, keep them green

```sh
grep -rn "fonts.googleapis" popup/styles/ | wc -l                # 0
grep -o "style-src[^;\"]*" manifest.json                         # style-src 'self'
grep -cE "^\s+--(space|text|shadow|z)-" popup/styles/tokens.css  # 22
grep -rc "prefers-reduced-motion" popup/styles/ | grep -v ":0"   # 1 hit
grep -rn 'innerHTML.*\${' --include="*.js" popup shared src | grep -v escapeHtml | wc -l   # 0
grep -o 'style="' -r src/html | wc -l                            # 0
grep -rn "\.style\.display *=" --include="*.js" popup | wc -l    # 2
grep -rn "aria-\|role=" src/html | wc -l                         # 70
grep -rn "\balert(" --include="*.js" popup src | wc -l           # 0
ls popup/styles/ | wc -l                                         # 12
```

---

---

## 0. Current state

Chrome MV3 extension, ~16.8k lines, zero runtime dependencies, no build step other than an
HTML include-concatenator ([build.js](build.js)).

| Area | Files | Lines | Notes |
|---|---|---|---|
| `popup/js/**` | 46 | ~5,600 | Feature controllers, split by tab |
| `popup/styles/**` | 45 | ~3,300 | One `@import` chain from [popup/popup.css](popup/popup.css) |
| `shared/storage/**` | 16 | ~2,700 | Data layer + network + Gemini client |
| `src/html/**` | 22 | ~1,200 | Compiled into [popup/popup.html](popup/popup.html) |
| `background/**` | 5 | ~400 | Service worker modules |

**Largest files:** [popup/popup.html](popup/popup.html) (1186, generated),
[shared/storage/gemini.js](shared/storage/gemini.js) (931),
[popup/js/settings.js](popup/js/settings.js) (839),
[popup/js/practice/card.js](popup/js/practice/card.js) (708).

**Headline problems**

1. A dev hot-reloader that polls `http://localhost:8080` ships in the production build, and the
   manifest requests localhost host permissions to support it.
2. One word lookup fetches the same Cambridge HTML page 3–6 times.
3. 75 `innerHTML` assignments interpolate unescaped user- and model-supplied strings.
4. The CSS is split into 45 files by *size*, not by concern (`stats-dist-1.css`,
   `stats-dist-2.css`, `stats-buttons-1.css`, …) — the clearest structural fingerprint of
   machine-generated authorship in the repo.
5. Markup carries ~350 inline `style="…"` attributes, so the design tokens in
   [popup/styles/variables.css](popup/styles/variables.css) are bypassed everywhere.
6. No linter, no formatter, no tests, no CI.

---

## Phase 1 — Repository hygiene and de-AI-ification

Goal: nothing in the repo should read as machine-generated boilerplate, and nothing
development-only should ship to users.

### 1.1 Remove the dev reloader from the shipped extension

**Files:** [background/reloader.js](background/reloader.js),
[background.js](background.js#L8), [manifest.json](manifest.json#L15-L16),
[shared/storage/core.js](shared/storage/core.js#L295-L303)

[background/reloader.js](background/reloader.js) polls ten `http://localhost:8080/*` URLs on a
1.5-second timer and calls `chrome.runtime.reload()`. `logDebug()` in
[core.js:295](shared/storage/core.js#L295) POSTs to `http://localhost:8081`. Both require the
localhost entries in `host_permissions`, which is a Chrome Web Store review liability and a
privacy smell in a published extension.

- Delete [background/reloader.js](background/reloader.js) and its import/call in
  [background.js](background.js#L8).
- Delete `logDebug` from [core.js](shared/storage/core.js#L295) and its re-export in
  [shared/storage.js](shared/storage.js#L8). Verify no callers remain (`grep -rn logDebug`).
- Remove `http://localhost:8080/*` and `http://localhost:8081/*` from
  [manifest.json](manifest.json#L15-L16).
- If hot reload is wanted for local work, put it in a `dev/` directory that is git-ignored and
  loaded via a separate unpacked manifest — not in the shipped tree.

**Done when:** `grep -rn localhost` returns nothing outside `dev/` and docs.

### 1.2 Fix host permissions to match actual network calls

**File:** [manifest.json](manifest.json#L14-L22)

Declared but with mismatched reality:

| Host | Declared | Actually fetched from |
|---|---|---|
| `generativelanguage.googleapis.com` | ❌ no | [gemini.js:477](shared/storage/gemini.js#L477), [gemini.js:793](shared/storage/gemini.js#L793), [settings.js:101](popup/js/settings.js#L101), [settings.js:378](popup/js/settings.js#L378) |
| `api.datamuse.com` | ❌ no | [sandbox/spelling.js](popup/js/sandbox/spelling.js) `findSuggestions` |
| `ssl.gstatic.com` | ❌ no | [audio.js:36](shared/storage/audio.js#L36) |
| `localhost:8080/8081` | ✅ yes | nothing, after 1.1 |

Add the three missing hosts, remove the two localhost entries. Currently the Gemini and Datamuse
calls work only because those servers happen to send permissive CORS headers — that is an
undeclared dependency on a third party's config.

### 1.3 Purge the AI/marketing register from code and copy

The vocabulary below is the strongest textual tell. Replace it with plain descriptive language.
This is a *rename and rewrite* pass, not a behaviour change — do it in one commit per area so
diffs stay reviewable.

**Class-name renames** (mechanical, repo-wide):

| Current | Replace with |
|---|---|
| `.premium-input` (23 uses across [src/html/*](src/html/), [popup/styles/*](popup/styles/)) | `.field` |
| `.primary-save-btn` | `.btn-primary` |
| `.erase-btn` | `.btn-danger` |
| `.table-icon-btn` | `.icon-btn` |
| `.submit-btn` (used on non-submitting buttons) | `.btn` |

**Comment rewrites** — 66 hits for `premium` / `state-of-the-art` / `seamless` /
`Glassmorphic` / `high-performance`. Examples:

- [background/toast.js:1](background/toast.js#L1) — "Reusable helper to display a premium,
  non-intrusive Glassmorphic toast…" → "Injects a toast into the active tab; falls back to
  chrome.notifications when scripting is blocked."
- [popup/js/practice/card.js:562](popup/js/practice/card.js) — "Uses high-performance cached
  variables to avoid layout thrashing stutters" → "Caches parent/element rects on drag start."
- [popup/js/navigation.js:19](popup/js/navigation.js#L19) — "for seamless keyboard entry" → "so
  the tab is immediately typeable."
- [popup/js/sandbox/save_actions.js:42](popup/js/sandbox/save_actions.js#L42) — "premium
  slide-up and fade-out animation" → "auto-dismiss after 4s."

**Emoji in UI strings** — remove all, replace with the existing inline SVG icon set:

- `✅` — [sandbox/manual_correct.js:43](popup/js/sandbox/manual_correct.js#L43),
  [sandbox/correct_card.js:143](popup/js/sandbox/correct_card.js#L143),
  [sandbox/accept.js:61](popup/js/sandbox/accept.js#L61),
  [sandbox/save_actions.js:33](popup/js/sandbox/save_actions.js#L33),
  [sandbox/save_actions.js:102](popup/js/sandbox/save_actions.js#L102)
- `✨` — [practice/actions.js:168](popup/js/practice/actions.js#L168),
  [practice/card.js:422](popup/js/practice/card.js#L422),
  [stats/render_ai_insights.js:113](popup/js/stats/render_ai_insights.js#L113),
  [src/html/stats-overview.html:18](src/html/stats-overview.html)

**Em-dashes in user-visible copy** — the `A — Z` sort label and `1 — 4` / `Again — Easy` shortcut
rows in [src/html/vault.html:17](src/html/vault.html) and
[src/html/settings.html:104](src/html/settings.html) should read `A–Z`, `1–4`,
`Again / Easy`. Em-dashes inside source *comments* are fine to leave; em-dashes in
*product copy* are the tell.

**AI prompt strings** — [vault.js:143-152](popup/js/vault.js#L143-L152) and
[sandbox/correct_card.js:230-240](popup/js/sandbox/correct_card.js#L230-L240) contain
near-identical 20-line prompts opening with "You are a professional lexicographer" and asking for
a "premium, natural academic/IELTS-style context sentence". Extract to a single
`shared/ai/prompts.js` exporting `buildEnrichmentPrompt(word, draft, targetLangName)`, and drop
the persona preamble — it is duplicated payload on every call.

### 1.4 Rewrite README.md and CHROMEWEBSTORE.md

**Files:** [README.md](README.md), [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md)

Current README opens features with `## 🤖 Premium AI Coaching (Gemini-Powered)`, describes a
"state-of-the-art Gemini AI Coaching Integration", and uses bold-lead bullet lists
(`* 💡 **Interactive Spelling Mnemonics (Front & Back Face)**: …`) throughout — the canonical
generated-README shape.

Rewrite to:

- One-paragraph description of what the extension does.
- A short "Install" section (load unpacked, `npm run build`).
- Feature list as plain prose or unadorned bullets, no emoji headers, no bold-lead pattern, no
  superlatives ("state-of-the-art", "premium", "highly visual").
- Keep the screenshots; drop the `<p align="center">` shield row or reduce it to the license badge.

### 1.5 Housekeeping

- [samples/](samples/) is an empty tracked directory — delete it.
- `debug_extension.log` (8.4 KB, untracked but present) — delete from the working tree.
- [.gitignore](.gitignore) ignores `take_screenshots.js` while
  [take_screenshots.js](take_screenshots.js) (341 lines, Playwright) sits in the repo root. Either
  move it to `scripts/screenshots.js` and track it, or delete it. Do not leave a tracked-adjacent
  ignored script at the root.
- [generate_icons.py](generate_icons.py) is a one-shot Python script in a JS project — move to
  `scripts/` or delete now that `icons/*.png` exist.
- [.gitignore](.gitignore) ignores `package-lock.json`. For a repo with a real devDependency
  (`playwright`), the lockfile should be committed. Remove that line and commit the lockfile.

---

## Phase 2 — Correctness and bug fixes

Each item is an independent defect. Fix in this order; 2.1 and 2.2 are user-visible data bugs.

### 2.1 US/UK variant spellings are recorded as errors

**Files:** [popup/js/practice/rate.js:43](popup/js/practice/rate.js#L43),
[popup/js/practice/rate.js:80](popup/js/practice/rate.js#L80)

`checkSpelling()` in [practice/actions.js:113-115](popup/js/practice/actions.js#L113-L115) accepts
a variant spelling and shows `Correct (UK spelling)`. But `submitRating()` recomputes correctness
with a bare equality check:

```js
const isOk = typed.toLowerCase() === card.word.toLowerCase();
```

so `reviewWord` is called with `typedWrongWord = typed`, which pushes the valid variant into
`card.misspellings`, increments `totalErrors`, resets `correctStreak`, and caps the SRS interval
via the lapse branch in [srs.js:47-50](shared/storage/srs.js#L47-L50). The user is told they were
right and is then punished for it.

**Fix:** compute correctness once. Add `isAnswerCorrect(typed, word)` to
`popup/js/practice/answer.js` (new), using `areSpellingVariants`; store the result on the module
state in [practice/state.js](popup/js/practice/state.js) when `checkSpelling` runs, and have both
`submitRating` and `submitMasteredRating` read it instead of recomputing.

### 2.2 Dead assignment silently disables translation backfill

**File:** [shared/storage/misspellings.js:16](shared/storage/misspellings.js#L16)

```js
let tr = wordObj.translation?.trim() ? null : null;
```

Both branches yield `null`. The following block does reassign `tr` when a target language is set,
so the line is merely dead rather than actively harmful — but it reads as a botched edit. Replace
with `let tr = null;`.

### 2.3 Same dictionary page fetched 3–6 times per lookup

**Files:** [shared/storage/definitions.js](shared/storage/definitions.js),
[shared/storage/examples.js](shared/storage/examples.js),
[shared/storage/cambridge.js](shared/storage/cambridge.js),
[shared/storage/word-actions.js:14-70](shared/storage/word-actions.js#L14-L70),
[popup/js/sandbox/correct_card.js:5-20](popup/js/sandbox/correct_card.js#L5-L20)

`fetchDynamicDefinition`, `fetchDynamicExample`, and `fetchCambridgePronunciation` each perform
their own `fetch()` of
`https://dictionary.cambridge.org/dictionary/english/<word>` and each falls back to its own Oxford
fetch. `handleCorrectSpelling` calls all three; `addWord` then calls them again for any field the
first pass left empty. A single Sandbox check can hit Cambridge 4–6 times.

**Fix:** introduce `shared/storage/dictionary-source.js`:

```js
// Fetches a dictionary page at most once per word per session.
export async function getCambridgeDocument(word)   // → { html, parsed }
export async function getOxfordDocument(word)      // → { html, parsed }
export function clearDictionaryCache()
```

Back it with a `Map` keyed by lowercased word, storing the in-flight promise (so concurrent
callers share one request), with a session-lifetime TTL. Rewrite `fetchDynamicDefinition`,
`fetchDynamicExample`, and `fetchCambridgePronunciation` to consume the cached parse rather than
fetch. Then collapse `handleCorrectSpelling` into a single `enrichWord(word)` call that returns
`{ definition, example, ipa, level, allLevels }` from one page load.

### 2.4 `User-Agent` request header is silently dropped

**Files:** [cambridge.js:13,30](shared/storage/cambridge.js#L13),
[definitions.js:14,40](shared/storage/definitions.js#L14),
[examples.js:27,53](shared/storage/examples.js#L27),
[sandbox/spelling.js:48](popup/js/sandbox/spelling.js#L48),
[vault/autofill.js:142,146,202](popup/js/vault/autofill.js#L142)

`User-Agent` is a forbidden header name; `fetch()` ignores it. Ten call sites pass it, implying an
anti-blocking measure that does not exist. Remove all of them (the
`declarativeNetRequest` rules in [background/rules.js](background/rules.js) are what actually
shape these requests). If UA spoofing is genuinely needed, add it as a `modifyHeaders` rule there
instead.

### 2.5 Object-URL leak on every audio playback

**File:** [shared/storage/audio.js:25](shared/storage/audio.js#L25),
[shared/storage/audio.js:91](shared/storage/audio.js#L91)

`URL.createObjectURL(blob)` is never paired with `revokeObjectURL`. Every pronunciation and
sentence playback leaks a blob for the popup's lifetime. Add:

```js
audio.addEventListener('ended', () => URL.revokeObjectURL(blobUrl), { once: true });
audio.addEventListener('error', () => URL.revokeObjectURL(blobUrl), { once: true });
```

Same treatment for the export blob in
[settings/actions.js:33](popup/js/settings/actions.js#L33).

### 2.6 Collision-prone ID generation using a deprecated API

**Files:** [shared/storage/word-actions.js:64](shared/storage/word-actions.js#L64),
[popup/js/stats/sparkline.js:48](popup/js/stats/sparkline.js#L48)

`'w_' + Math.random().toString(36).substr(2, 9)` — `String.prototype.substr` is deprecated, and
the ID space is small enough that imports of large vaults can collide (the integrity audit at
[settings.js:475](popup/js/settings.js) already has a "Duplicate card id" bucket, which is
evidence this has happened). Use `crypto.randomUUID()`:

```js
id: `w_${crypto.randomUUID()}`
```

Provide a fallback only if you support non-secure contexts — extension pages are secure contexts,
so no fallback is needed.

### 2.7 `atomicUpdate` runs the full migration pass on every write

**File:** [shared/storage/core.js:255-290](shared/storage/core.js#L255-L290)

`atomicUpdate` calls `getWords()`, which runs the entire sanitize/migrate/normalize loop over
every card *and* may itself call `saveWords()` mid-transaction. During a practice session that is
a full-vault rewrite per rating.

**Fix:** split into `getWordsRaw()` (plain read) and `migrateWords()` (run once at popup start and
once at service-worker start). `atomicUpdate` should use `getWordsRaw()`. Guard migration behind a
single `spelt_schema_version` integer instead of the three separate boolean flags
(`spelt_migrated_to_spelling_v3`, `spelt_migrated_meaning_to_recall`,
`spelt_migrated_practice_types_v5`) currently read on every single call.

### 2.8 `dueCards` is a shared mutable array

**File:** [popup/js/practice/state.js:1-20](popup/js/practice/state.js#L1-L20)

`getDueCards()` returns the live array; callers in
[rate.js:60](popup/js/practice/rate.js#L60) and
[rate.js:105](popup/js/practice/rate.js#L105) call `.shift()` / `.push()` on it directly from
inside `setTimeout` callbacks. Combined with the `chrome.storage.onChanged` listener in
[popup.js:118](popup/popup.js#L118) that can call `syncPracticeDeck()` concurrently, the deck can
be mutated mid-transition and skip or repeat a card.

**Fix:** make the deck opaque — expose `peekCard()`, `advanceDeck()`, `requeueCard(card)`,
`replaceDeck(cards)`. `getDueCards()` should return a frozen copy for read-only consumers. Move
the `.shift()` calls out of `setTimeout` and into `advanceDeck()`.

### 2.9 Duplicated due-card filter, three divergent copies

**Files:** [popup/popup.js:20-32](popup/popup.js#L20-L32),
[practice/card.js:26-31](popup/js/practice/card.js#L26-L31),
[practice/card.js:230-250](popup/js/practice/card.js#L230-L250)

The "is this card due in this mode" predicate is written three times with subtly different
conditions — `syncPracticeDeck` even computes `isDue` and `matchesMode` twice with `matchesMode`
redundantly re-checking `meaningNextDate <= now` in one branch and not the other. Extract to
`shared/srs/selectors.js`:

```js
export function isDueInMode(word, mode, now = Date.now())
export function selectDueCards(words, mode, { excludeIds } = {})
```

and use it from all three sites plus [vault/filter.js](popup/js/vault/filter.js).

### 2.10 Streak counter can never exceed its first recorded value in one edge case

**File:** [shared/storage/sessions.js:24-42](shared/storage/sessions.js#L24-L42)

`if (!streak.max) streak.max = streak.current;` fires only when `max` is falsy, and the
subsequent `if (streak.current > streak.max)` covers growth — so the logic is correct today, but
`updateStreak` is called from `logActivity` on *every* review, meaning `activity[today]` counts
reviews, not days, while the heatmap in
[stats/render_heatmap.js](popup/js/stats/render_heatmap.js) reads it as a review count and the
streak reads it as a day marker. Document which it is in a comment and add a unit test
(Phase 9) pinning the semantics.

### 2.11 `alert()` / `confirm()` in a popup context

**Files:** [sandbox/correct_card.js:316](popup/js/sandbox/correct_card.js#L316),
[practice/listeners.js:68](popup/js/practice/listeners.js#L68),
[practice/listeners.js:125](popup/js/practice/listeners.js#L125),
[vault.js:97](popup/js/vault.js#L97),
[sandbox/example_actions.js:25](popup/js/sandbox/example_actions.js#L25),
[vault/autofill.js:283,299](popup/js/vault/autofill.js#L283)

Native dialogs in an extension popup are visually foreign and, on some platforms, dismiss the
popup entirely. The project already has `showConfirm()` in
[vault/confirm.js](popup/js/vault/confirm.js) and a toast system. Replace all seven call sites.

### 2.12 Unused imports

Remove — each is a dead edge in the module graph:

- [practice/listeners.js:1](popup/js/practice/listeners.js#L1) — `getWords`, `saveWords`
- [practice/ai_helpers.js:1](popup/js/practice/ai_helpers.js#L1) — `getWords`, `saveWords`,
  `getStored`, `isGeminiConfigured` (re-exported at the bottom instead of used)
- [shared/storage/misspellings.js:6](shared/storage/misspellings.js#L6) — `logActivity`
- [shared/storage/word-actions.js:1](shared/storage/word-actions.js#L1) — `saveWords`

Phase 9's linter will catch the rest.

---

## Phase 3 — Security and privacy hardening

### 3.1 Unescaped interpolation into `innerHTML` (75 sites)

**Highest-risk sites:**

| File | What is interpolated | Source of the value |
|---|---|---|
| [background/toast.js:57](background/toast.js#L57) | `${msg}` into a toast injected into **any web page** | selection text / `err.message` |
| [practice/helpers.js:2](popup/js/practice/helpers.js#L2), [sandbox/helpers.js:5](popup/js/sandbox/helpers.js#L5) | `data-word="${word}"` | vault word, user-typed |
| [vault/list.js:75-85](popup/js/vault/list.js#L75-L85) | `${w.word}`, `${w.definition}`, misspellings list | user-typed and imported JSON |
| [practice/actions.js:52](popup/js/practice/actions.js#L52) | US/UK variant row | lookup table (safe) but same pattern |
| [sandbox/save_actions.js:33](popup/js/sandbox/save_actions.js#L33) | `"${word}"` | user-typed |
| [sandbox/verify.js:57](popup/js/sandbox/verify.js#L57) | `${err.message}` | network/library error text |

The `.replace(/"/g, '&quot;')` calls scattered through
[sandbox/correct_card.js](popup/js/sandbox/correct_card.js) escape quotes only — not `<`, `>`, or
`&` — so they protect attribute boundaries and nothing else.

**Fix, in this order:**

1. Add `shared/dom.js` with `el(tag, props, children)` and `escapeHtml(str)`.
2. Convert [background/toast.js](background/toast.js) first — it injects into third-party pages,
   so it is the only site with cross-origin impact. Build the toast with `createElement` +
   `textContent`; keep the SVG as a static string.
3. Convert [vault/list.js](popup/js/vault/list.js) `renderList` to `createElement` — it is the
   hottest render path and the biggest single template.
4. Convert the sandbox card builders
   ([correct_card.js](popup/js/sandbox/correct_card.js),
   [misspell_card.js](popup/js/sandbox/misspell_card.js),
   [manual_correct.js](popup/js/sandbox/manual_correct.js),
   [accept.js](popup/js/sandbox/accept.js)) — these carry the most inline styles too, so do 3.1
   and 5.3 together for these four files.
5. Everything else: replace `innerHTML = x` with `textContent = x` wherever the value is not
   markup (roughly 40 of the 75 sites qualify).

### 3.2 Model-authored HTML is injected into the popup

**Files:** [practice/ai_helpers.js:150-157](popup/js/practice/ai_helpers.js#L150-L157),
[practice/card.js:520-530](popup/js/practice/card.js#L520-L530)

`verifyPracticeWriting` explicitly instructs Gemini to return raw HTML
(`<span style='color: #10b981; …'>`), and `showFeedback` assigns that response straight to
`feedbackContentEl.innerHTML`. Model output is untrusted input.

**Fix:** change the prompt to return JSON — `{ verdict: "correct"|"incorrect", correction: string,
feedback: string }` — via the existing `askGemini` JSON path, and render the three fields with
`textContent` into a locally-styled template. The hint path at
[card.js:330](popup/js/practice/card.js#L330) already does manual `<`/`>` escaping; route it
through `escapeHtml` from `shared/dom.js` for consistency.

### 3.3 API keys in URL query strings

**Files:** [gemini.js:477](shared/storage/gemini.js#L477),
[gemini.js:793](shared/storage/gemini.js#L793),
[settings.js:101](popup/js/settings.js#L101),
[settings.js:378](popup/js/settings.js#L378)

`?key=${key}` puts the secret in the request line, where it lands in devtools network logs,
`chrome://net-export` captures, and any error string that echoes the URL. Google's API accepts the
key as a header. Change all four to:

```js
fetch(url, { headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' } })
```

Also audit that no code path prints a URL containing a key into
`console.error`/`statusEl.textContent`.

### 3.4 Content Security Policy

**File:** [manifest.json](manifest.json)

No `content_security_policy` is declared, so the extension inherits the MV3 default. Declare it
explicitly so the intent is recorded and any future inline-script regression fails loudly:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; style-src 'self'"
}
```

Note that `style-src 'self'` will break the remote Google Fonts import — which is exactly the
point; see 5.1.

### 3.5 Settle the key-storage story

`chrome.storage.local` is unencrypted; any code in the extension can read the Gemini keys. That is
an acceptable design for a local-only tool, but it is currently undocumented. Add a short
"Data and privacy" section to the README stating: all vocabulary data is local; API keys are
stored unencrypted in extension storage; dictionary lookups go to Cambridge/Oxford/Datamuse/
Tatoeba/Google Translate; AI features send card text to Google's Gemini API only on explicit
click.

---

## Phase 4 — Code structure

### 4.1 Target layout

```
src/
  background/          service worker only
  core/                pure logic, no DOM, no chrome.* (unit-testable)
    srs.js             calcSM2, computeErrorWeight, date math
    selectors.js       isDueInMode, selectDueCards, filter/sort predicates
    spelling.js        levenshtein, variant matching, suggestion ranking
  data/                storage + persistence
    storage.js         getStored/setStored/atomicUpdate
    words.js           addWord/deleteWord/reviewWord/registerMisspelling
    migrations.js      versioned migration chain
    sessions.js        activity/streak/session logs
  services/            network I/O
    dictionary.js      cached Cambridge/Oxford page access
    translation.js
    audio.js
    ai/
      client.js        transport, queue, fallback, cooldowns
      prompts.js       every prompt string, one place
      features.js      generateHint, verifyWriting, sessionSummary, insights
  ui/
    dom.js             el(), escapeHtml(), on()
    components/        toast, confirm, dropdown, badge, card
    tabs/
      sandbox/ practice/ vault/ stats/ settings/
  styles/              see Phase 5
```

Move in dependency order — `core/` first (nothing imports upward from it), then `data/`, then
`services/`, then `ui/`. Keep [shared/storage.js](shared/storage.js) as a re-export shim during
the move so nothing breaks mid-refactor; delete it in the final commit of this phase.

### 4.2 Break up `practice/card.js` (708 lines)

**File:** [popup/js/practice/card.js](popup/js/practice/card.js)

It currently holds deck loading, front-face rendering, back-face coordination, four separate
AI-panel wiring functions, and a 120-line generic drag utility. Split:

| New file | Moves from `card.js` |
|---|---|
| `ui/tabs/practice/deck.js` | `loadPracticeDeck`, `syncPracticeDeck` (lines 22–36, 228–262) |
| `ui/tabs/practice/front_face.js` | `populateFrontFace` (lines 80–226) |
| `ui/tabs/practice/ai_panels.js` | `setupAIHintButton`, `setupBackAIHintButton`, `setupAIWritingPractice`, `setupAISpellingFeedback`, `triggerSessionSummary` |
| `ui/components/draggable.js` | `makeElementDraggable` (lines 560–708) |

`setupAIHintButton` (lines 264–330) and `setupBackAIHintButton` (lines 332–400) are
**near-identical, 66 lines each**, differing only in element IDs and the default `bottom` offset.
Collapse into one `mountHintPanel({ btnId, bubbleId, textId, regenId, closeId, defaultBottom })`.

### 4.3 Stop the clone-and-replace listener pattern

**Files:** [practice/card.js](popup/js/practice/card.js) (11 occurrences),
[practice/card.js:135-139](popup/js/practice/card.js#L135-L139) (translation element)

```js
const newBtn = btn.cloneNode(true);
btn.parentNode.replaceChild(newBtn, btn);
newBtn.addEventListener('click', …);
```

runs on *every card shown*. It discards and rebuilds DOM nodes to shed listeners, invalidating any
cached references elsewhere and thrashing layout.

**Fix:** bind each control **once** at init and have the handler read the current card from state
(`peekCard()`), the way [practice/keydowns.js](popup/js/practice/keydowns.js) already does. Where
per-card teardown is genuinely needed, use an `AbortController` per card:

```js
let cardScope;
function mountCard(card) {
  cardScope?.abort();
  cardScope = new AbortController();
  btn.addEventListener('click', handler, { signal: cardScope.signal });
}
```

### 4.4 Break up `settings.js` (839 lines)

**File:** [popup/js/settings.js](popup/js/settings.js)

`initSettings` is a 340-line function with eight nested function declarations, followed by a
200-line `runIntegrityAudit`. Split:

| New file | Contents |
|---|---|
| `ui/tabs/settings/index.js` | wiring only; ≤80 lines |
| `ui/tabs/settings/gemini_keys.js` | `loadGeminiSettings`, `renderKeysList`, `removeKey`, `fetchModelsForKey`, `normalizeStoredKeys`, `pruneKeyModelsMap`, `collectModelsFromKeyMap` |
| `ui/tabs/settings/model_select.js` | `renderModelSelect`, `renderAiStatusMonitor`, `createAiBadge` |
| `data/integrity.js` | `runIntegrityAudit`, `parseTimestamp`, `inferPracticeType`, `makeCardId`, `summarizeIssueBuckets` — pure, unit-testable |

Also: [settings.js:356](popup/js/settings.js#L356) starts `setInterval(renderAiStatusMonitor, 2000)`
and never clears it except on re-init. It re-reads storage and rebuilds the whole monitor DOM every
two seconds regardless of which tab is visible. Gate it on the Settings tab being active and clear
it on tab change.

### 4.5 Deduplicate helpers

- `renderAudioButtons` exists twice, identical but for a margin value —
  [sandbox/helpers.js:5](popup/js/sandbox/helpers.js#L5) and
  [practice/helpers.js:1](popup/js/practice/helpers.js#L1). One implementation in
  `ui/components/audio_buttons.js`, margin as a parameter or a CSS class.
- Levenshtein exists twice — [sandbox/spelling.js:10](popup/js/sandbox/spelling.js#L10) and
  inline inside `renderPastErrorsList` in
  [vault/modal.js](popup/js/vault/modal.js). One copy in `core/spelling.js`.
- The confirm-modal wiring is hand-rolled in
  [practice/listeners.js:110-128](popup/js/practice/listeners.js#L110-L128) even though
  [vault/confirm.js](popup/js/vault/confirm.js) exports `showConfirm`. Use the shared one.
- The fallback-example template list is written twice — as *detector* strings in
  [sentence.js:39-52](shared/storage/sentence.js#L39-L52) and as *generator* strings in
  [sentence.js:57-70](shared/storage/sentence.js#L57-L70). Derive the detector from the generator
  so they cannot drift. The 28-entry `oldHardcoded` array above it is legacy-data cleanup —
  move it into a dated migration in `data/migrations.js` and delete it from the runtime path.

### 4.6 Language-name lookup as a chain of 12 `else if`s

**File:** [popup/js/vault.js:110-124](popup/js/vault.js#L110-L124)

Replace with a `LANGUAGES` map in `core/languages.js`, and use the same map to populate the
`<select id="setting-target-lang">` options in
[src/html/settings.html](src/html/settings.html) — they are currently maintained independently
and can disagree.

---

## Phase 5 — CSS architecture and design system

### 5.1 Self-host the font

**File:** [popup/styles/variables.css:1](popup/styles/variables.css#L1)

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:…');
```

A remote stylesheet import in an extension: blocked by a strict CSP (Phase 3.4), a privacy leak to
Google on every popup open, and a blank-font flash offline. Download the Outfit woff2 subset to
`assets/fonts/`, declare `@font-face` locally, and add `"web_accessible_resources"` only if
content scripts need it (they do not).

### 5.2 Reorganise the 45 stylesheets by concern

**Files:** [popup/popup.css](popup/popup.css) and all of
[popup/styles/](popup/styles/)

The split is by file size, not responsibility — `stats-dist-1.css` / `stats-dist-2.css`,
`stats-tabs-1.css` / `stats-tabs-2.css`, `stats-buttons-1.css` / `stats-buttons-2.css`,
`stats-dashboard-1/2/3.css`, `stats-datepickers-1/2.css`, `stats-forecast-1/2.css`. There is no way
for a reader to guess which half a rule lives in. This is the single most visible structural
artefact in the repo.

**Target — 12 files:**

```
styles/
  tokens.css        :root custom properties only
  reset.css         box-sizing, scrollbars, focus-visible
  typography.css
  components.css    .btn, .field, .badge, .pill, .card, .chip
  layout.css        popup shell, panes, resizers
  header.css
  tabs.css
  sandbox.css
  practice.css      merges practice*.css (6 files today)
  vault.css         merges vault*.css (3 files today)
  stats.css         merges stats-*.css (17 files today)
  settings.css
  modals.css
  responsive.css    merges responsive-*.css (4 files today)
```

Merge mechanically first (concatenate in current `@import` order — cascade is preserved), then
deduplicate. Expect to find duplicate `.srs-btn` and `.stat-card` rules across the merged files.

### 5.3 Move inline styles into classes

~350 `style="…"` attributes. Worst offenders:

| File | Count |
|---|---|
| [src/html/practice-card-front.html](src/html/practice-card-front.html) | 48 |
| [src/html/practice-card-back.html](src/html/practice-card-back.html) | 44 |
| [src/html/modal-word-form.html](src/html/modal-word-form.html) | 36 |
| [src/html/modal-confirm.html](src/html/modal-confirm.html) | 34 |
| [popup/js/sandbox/correct_card.js](popup/js/sandbox/correct_card.js) | 33 |
| [src/html/vault.html](src/html/vault.html) | 30 |
| [src/html/settings.html](src/html/settings.html) | 26 |

Work file by file; for each, extract to a named class in the matching stylesheet from 5.2. Two
rules while doing this:

- **No literal colours.** [src/html/vault.html:88](src/html/vault.html) uses `#a78bfa` / `#c4b5fd`
  while `--purple: hsl(265, 80%, 65%)` already exists in
  [variables.css:27](popup/styles/variables.css#L27). Likewise `#10b981`/`#ef4444` in
  [background/toast.js](background/toast.js) and
  [practice/ai_helpers.js](popup/js/practice/ai_helpers.js) duplicate `--success`/`--danger`.
  Every colour must come from a token.
- **Style toggling via classes, not `.style.display`.** There are 200+ direct
  `el.style.display = 'none'|'block'|'flex'` assignments (e.g.
  [practice/card.js](popup/js/practice/card.js) alone has 40). Replace with `.hidden` / `.is-open`
  class toggles so CSS owns presentation and transitions become possible.

### 5.4 Extend the token set

**File:** `styles/tokens.css`

Add the values that are currently repeated as literals throughout:

```css
--space-1: 4px;  --space-2: 6px;  --space-3: 8px;
--space-4: 12px; --space-5: 16px; --space-6: 24px;

--text-xs: 0.62rem; --text-sm: 0.68rem; --text-base: 0.72rem;
--text-md: 0.78rem; --text-lg: 0.88rem; --text-xl: 1.25rem;

--shadow-sm: 0 2px 8px rgba(0,0,0,.25);
--shadow-md: 0 8px 24px rgba(0,0,0,.35);
--shadow-lg: 0 10px 25px rgba(0,0,0,.5);

--z-dropdown: 100; --z-modal: 1000; --z-toast: 2000; --z-resizer: 100000;
```

The font-size scale above is *derived from what the code already uses* — `0.62`, `0.65`, `0.68`,
`0.7`, `0.72`, `0.74`, `0.78`, `0.88` rem all appear. Collapse to six steps and accept minor
visual drift; an eight-value ad-hoc scale is itself a symptom.

Note `--radius-lg` is missing between `--radius-md: 8px` and `--radius-xl: 14px` — add it (`11px`)
or renumber.

### 5.5 Honour reduced motion

**File:** `styles/reset.css`

[.agents/rules/ui-micro-animations.md](.agents/rules/ui-micro-animations.md) mandates spring
transitions everywhere and the codebase follows it, but nothing respects the OS setting:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

This also kills the infinite `badgePulse` on the due badge
([tabs.css:88](popup/styles/tabs.css)), which is a genuine accessibility problem for
vestibular-sensitive users.

---

## Phase 6 — UI/UX maturity, tab by tab

### 6.1 Global shell

**Files:** [src/html/base.html](src/html/base.html),
[src/html/header.html](src/html/header.html),
[popup/js/popup/moveable.js](popup/js/popup/moveable.js),
[popup/js/popup/resizer.js](popup/js/popup/resizer.js)

- **Window size.** [variables.css:37-46](popup/styles/variables.css#L37-L46) sets
  `height: 530px; max-height: 600px`. Chrome caps action popups at 600px; the Stats tab has ~1,100px
  of content, so it scrolls inside a 530px frame with a 5px scrollbar. Either raise the default to
  the 600px cap, or (better) make Stats open in a full extension page (`chrome-extension://…/
  stats.html`) via the existing pop-out mechanism.
- **Eight resizer handles** ([base.html:20-27](src/html/base.html)) are dead weight in a browser
  action popup — Chrome sizes it from content and ignores drag-resize. They only function in the
  popped-out window. Hide them unless `chrome.windows.getCurrent().type === 'popup'`, the way
  [moveable.js:6-12](popup/js/popup/moveable.js#L6-L12) already gates the drag cursor.
- **Header drag** ([moveable.js:29-60](popup/js/popup/moveable.js#L29-L60)) calls
  `chrome.windows.update` on every `mousemove` — one IPC round-trip per pixel. Throttle with
  `requestAnimationFrame`.
- **"Local Profile" label** — the status dot doubles as a network indicator
  ([network_status.js](popup/js/popup/network_status.js)) and an identity label. Split: keep the
  dot as connectivity only, drop the "Local Profile" text (there are no other profiles), and move
  the offline explanation entirely into the existing banner.
- **Font resizer** ([header.html:12-16](src/html/header.html)) occupies prime header real estate
  with 5 inline-styled elements for a setting most users touch once. Move it to Settings and
  reclaim the space.

### 6.2 Sandbox tab

**Files:** [src/html/sandbox.html](src/html/sandbox.html),
[popup/js/sandbox/](popup/js/sandbox/)

The whole tab is one centred input plus a `#feedback-msg` div that gets replaced wholesale with
one of five different HTML blobs (verify/correct/misspell/manual/saved). Problems and fixes:

- **No loading state beyond a text swap.** `handleVerify`
  ([verify.js:13](popup/js/sandbox/verify.js#L13)) writes "Verifying spelling…" then blocks for
  potentially 4+ sequential network round-trips (dictionaryapi → Cambridge → Oxford → Datamuse →
  per-suggestion validation). Add a skeleton card with a determinate step indicator
  ("Checking dictionary… / Finding suggestions…"), and once 2.3 lands this drops to one round-trip.
- **No history.** Every check destroys the previous result. Add a session list of the last 10
  checks above the input, clickable to restore the card.
- **Result card structure.** Five separate builders emit five slightly different layouts. Define
  one `<template id="sandbox-result">` in [src/html/sandbox.html](src/html/sandbox.html) with
  slots (word, IPA, badges, definition, example, actions) and have all five paths fill it. This
  removes ~200 lines of string templating and fixes 3.1 for this area simultaneously.
- **Action row overflow.** The not-in-vault path renders five buttons
  (`+ Spelling`, `+ Recall`, `+ Both`, `AI Enhance`, `Customize…`) in a 332px-wide flex-wrap row
  ([correct_card.js:64-140](popup/js/sandbox/correct_card.js#L64-L140)) — they wrap to three
  lines. Reduce to one primary `Add to vault` split-button with a target-type menu, plus a
  secondary `Customize…`.
- **Empty state.** The tab shows nothing but an input on first open. Add a one-line explanation
  and the `Alt+S` selection shortcut hint.

### 6.3 Practice tab

**Files:** [src/html/practice.html](src/html/practice.html),
[src/html/practice-card-front.html](src/html/practice-card-front.html),
[src/html/practice-card-back.html](src/html/practice-card-back.html)

- **Four overlapping draggable overlays.** `ai-hint-bubble`, `back-ai-hint-bubble`,
  `ai-feedback-row`, and `ai-practice-writing-feedback` are all absolutely positioned at
  `bottom: 62–74px; left/right: 14px` over a ~300px-tall card, each independently draggable
  ([card.js:560](popup/js/practice/card.js#L560)). They can and do stack on top of each other, and
  their positions reset on every card. Replace with **one** bottom sheet inside the card that
  hosts whichever panel is active, with a segmented control if more than one has content. Delete
  `makeElementDraggable` entirely — dragging is not a substitute for a layout that fits.
- **Rating hints.** [actions.js:210-216](popup/js/practice/actions.js#L210-L216) computes and
  displays `2d`/`4d`/`7d` on the buttons, which is good. Also surface the current card's ease
  factor and lapse count on the back face — the data exists (`card.ef`, `card.totalErrors`) and is
  never shown.
- **Progress.** The deck shows "Due Reviews / Total Words" counters but no session progress.
  Add a thin progress bar (reviewed / initial-due) at the top of the card.
- **Recall mode discoverability.** The mode pills
  ([practice.html:4-7](src/html/practice.html)) are inline-styled uppercase text with no
  explanation of the difference. Add a one-line description under the active pill.
- **Empty state** ([practice.html:24-34](src/html/practice.html)) says "Deck Fully Reviewed!" even
  when the vault is empty and nothing was ever scheduled. Distinguish three states: vault empty →
  "Add words in Sandbox"; all reviewed today → "Next review in Xh"; mode has no eligible cards →
  "No recall cards yet".
- **Keyboard map is undiscoverable.** [keydowns.js](popup/js/practice/keydowns.js) binds
  `1-5`, `Space`, `Enter`, `t`, `r`, `p` — documented only in the Settings tab. Add a `?` overlay
  and a persistent hint strip under the rating row.

### 6.4 Vault tab

**Files:** [src/html/vault.html](src/html/vault.html),
[popup/js/vault/list.js](popup/js/vault/list.js)

- **The two custom dropdowns are inaccessible.** Sort and Filter are `<div class="custom-option">`
  lists shadowing hidden `<select>` elements
  ([vault.html:14-60](src/html/vault.html)) — no `role`, no `aria-expanded`, no keyboard
  navigation, no type-ahead, and the change events only fire on the hidden select via
  [dropdowns.js](popup/js/vault/dropdowns.js). Either style the native `<select>` (simplest,
  fully accessible) or implement the full listbox pattern. Do not keep both DOM trees.
- **No virtualisation.** `renderList` builds every `<li>` with `innerHTML` on every keystroke in
  the search box ([vault.js:38](popup/js/vault.js#L38) binds `input` with no debounce). At
  500+ words this is visibly janky. Debounce search to 150ms, and render incrementally
  (`DocumentFragment` + windowing) above ~200 rows.
- **List rows carry no state signal.** Mastered / due / leech status is only implied by the
  review pill colour. Add an explicit state chip and make the error tag show a count rather than
  the full comma-joined misspelling list, which overflows the row.
- **No bulk select affordance until selection exists** —
  [list.js:20-24](popup/js/vault/list.js#L20-L24) hides the bulk row when the filter is empty but
  shows it (with disabled buttons at 50% opacity) otherwise. Show the row only when ≥1 item is
  selected; put "Select all" in the sort row.
- **`AI Enrich` blocks for 3.5s × N words** behind a non-cancelable confirm dialog
  ([vault.js:100-190](popup/js/vault.js#L100-L190)) — 30 words is a 105-second hostage situation.
  Make it cancelable, move it to the background service worker (there is already a
  `retranslateAll` message path in [background.js:22](background.js#L22)), and report progress via
  a toast rather than a modal.

### 6.5 Stats tab

**Files:** [src/html/stats*.html](src/html/), [popup/js/stats/](popup/js/stats/)

- **Density.** ~1,100px of content in a 530px viewport across four sub-tabs. Once 6.1 moves Stats
  to a full page, lay it out in a 2-column grid at ≥560px.
- **17 stylesheets** for this tab alone — merged in 5.2.
- **Charts are hand-rolled `div` bars** ([render_charts.js](popup/js/stats/render_charts.js),
  [sparkline.js](popup/js/stats/sparkline.js)). They lack axis labels, empty states, and any
  accessible text alternative. For each chart add: a `<title>`/`aria-label` describing the trend,
  a visible "no data yet" state, and a value axis. Do not add a charting dependency — the current
  approach is fine, it just needs completing.
- **`renderStats()` runs on every popup action.** [popup.js:44](popup/popup.js#L44) calls
  `renderStats()` from `refreshStats()`, which is invoked on tab change, storage change, refresh
  click, and midnight rollover — even when Stats is not visible. It recomputes 14 renders over the
  whole history each time. Guard on `#stats-tab.active` and mark dirty otherwise.
- **AI Insights caching** ([render_ai_insights.js](popup/js/stats/render_ai_insights.js)) uses a
  hand-built hash string of 14 concatenated values and a 6h TTL. It works; just move the hash
  builder into `core/` and unit-test it, since a silent hash bug means permanently stale insights.

### 6.6 Settings tab

**Files:** [src/html/settings.html](src/html/settings.html),
[popup/js/settings.js](popup/js/settings.js)

- **No grouping.** Language, selection lookup, background AI, Gemini keys, model select, AI status
  monitor, export, import, wipe, integrity check, retranslate, and the shortcut reference are one
  flat column. Group into: *Study*, *Language & audio*, *AI*, *Data*, *Shortcuts*, each with a
  heading and a one-line description.
- **Destructive actions are undifferentiated.** `Wipe database` sits in the same visual weight as
  `Export`. Give it the danger token, move it into a collapsed "Danger zone" block, and require
  typed confirmation (the confirm modal already supports an input —
  [modal-confirm.html:1118](src/html/modal-confirm.html)).
- **API key input is a bare password field** with a status line that turns red/green
  ([settings.js:60-160](popup/js/settings.js#L60-L160)). Add: a link to where to obtain a key,
  inline validation of the `AIza…` prefix before spending a network call, and a per-key "test"
  button rather than only testing at add-time.
- **The AI status monitor** rebuilds ~40 DOM nodes every 2s (see 4.4). Beyond gating it, render
  cooldowns with a CSS animation driven by one `--cooldown-remaining` variable instead of
  re-rendering text.

### 6.7 Modals and toasts

**Files:** [src/html/modals.html](src/html/modals.html),
[src/html/modal-confirm.html](src/html/modal-confirm.html),
[src/html/modal-word-form.html](src/html/modal-word-form.html),
[popup/js/vault/confirm.js](popup/js/vault/confirm.js)

- No focus trap, no focus restore on close, no `Escape` handler on the word-form modal (the
  confirm modal has one, but only while the Practice tab is active —
  [keydowns.js:92-96](popup/js/practice/keydowns.js#L92-L96)).
- Use `<dialog>` with `showModal()`: focus trapping, `Escape`, and backdrop come free.
- `showConfirm(title, msg, onConfirm, cancelable)` is also used as a *progress* dialog and a
  *completion* dialog ([vault.js:106,190](popup/js/vault.js#L106)). Split into `confirm()`,
  `progress()`, and `notify()` — three call shapes, three functions.

---

## Phase 7 — Accessibility

Currently: zero `aria-*` attributes outside of nothing, no roles, no focus-visible styling, no
labels on icon-only controls.

| Task | Files |
|---|---|
| Tabs → `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`; panes → `role="tabpanel"` / `aria-labelledby`. Arrow-key handling already exists in [navigation.js:36](popup/js/navigation.js#L36) — align it with the ARIA tab pattern (Home/End too). | [src/html/header.html](src/html/header.html), [popup/js/navigation.js](popup/js/navigation.js) |
| `aria-label` on every icon-only button: refresh, pop-out, font ±, sort direction, edit, delete, audio, close. ~20 buttons. | [src/html/header.html](src/html/header.html), [vault/list.js](popup/js/vault/list.js), helpers |
| `aria-live="polite"` on `#feedback-msg`, `#spelling-result-badge`, and the toast container so results are announced. | [src/html/sandbox.html](src/html/sandbox.html), [src/html/practice-card-back.html](src/html/practice-card-back.html) |
| `:focus-visible` ring using `--primary-glow` on every interactive element; several rules currently set `outline: none` with no replacement ([tabs.css:31](popup/styles/tabs.css#L31)). | `styles/reset.css` |
| Custom dropdowns → native `<select>` or full listbox roles (6.4). | [src/html/vault.html](src/html/vault.html), [vault/dropdowns.js](popup/js/vault/dropdowns.js) |
| Contrast audit — `--text-muted-dark: hsl(155,6%,46%)` on `--bg-dark: hsl(155,20%,6%)` is ≈4.0:1, below AA for the 0.62rem text it is used with. | [popup/styles/variables.css](popup/styles/variables.css) |
| `prefers-reduced-motion` (5.5). | `styles/reset.css` |

---

## Phase 8 — Performance

| Issue | Location | Fix |
|---|---|---|
| 45 chained `@import`s serialise stylesheet loading | [popup/popup.css](popup/popup.css) | Phase 5.2 merge → 12 files; or concatenate at build time into one `popup.css` |
| Remote font blocks first paint | [variables.css:1](popup/styles/variables.css#L1) | Self-host (5.1) |
| Cambridge page fetched 3–6× per lookup | Phase 2.3 | Session cache |
| Full migration scan per `atomicUpdate` | Phase 2.7 | Versioned migration, run once |
| `renderStats()` on every refresh | [popup.js:44](popup/popup.js#L44) | Gate on active tab |
| Vault re-renders every keystroke | [vault.js:38](popup/js/vault.js#L38) | Debounce 150ms + fragment render |
| AI status monitor rebuild every 2s | [settings.js:356](popup/js/settings.js#L356) | Gate on active tab |
| `chrome.windows.update` per mousemove | [moveable.js:47](popup/js/popup/moveable.js#L47) | rAF throttle |
| Blob URLs never revoked | [audio.js:25,91](shared/storage/audio.js#L25) | Phase 2.5 |
| `findSuggestions` validates each candidate with its own network call, serially | [sandbox/spelling.js:88-96](popup/js/sandbox/spelling.js#L88-L96) | `Promise.all` over candidates, cap at 4, reuse the dictionary cache from 2.3 |

---

## Phase 9 — Tooling, build, and tests

There is currently no linter, formatter, test runner, or CI.

### 9.1 Linting and formatting

Add ESLint (flat config) + Prettier as devDependencies:

```
eslint.config.js     env: webextensions + browser, sourceType: module
.prettierrc          2-space, single quotes, no trailing comma, 100 cols
```

Rules that would have caught real bugs in this audit: `no-unused-vars` (2.12),
`no-self-assign` / `no-constant-binary-expression` (2.2 — flags the `? null : null`),
`no-restricted-globals` for `alert`/`confirm` (2.11), `no-restricted-syntax` for `innerHTML`
assignment (3.1).

### 9.2 Tests

Add Vitest. Target `core/` and `data/` only — they are pure by construction after Phase 4.

Minimum suite:

- `core/srs.test.js` — `calcSM2` across all four grades × new/lapsed/mature × correct/incorrect;
  pin the graduation steps (2/4/7 days) and the lapse caps (1/2/3).
- `core/srs.test.js` — `computeErrorWeight` boundary at `totalErrors=0` and the 0.2 floor.
- `core/selectors.test.js` — `isDueInMode` for `spelling`/`recall`/`both`, mastered, and
  already-reviewed-today.
- `core/spelling.test.js` — levenshtein, `areSpellingVariants`, `censorWordInExample` (note the
  `word.length >= 4` branch at [sentence.js:79](shared/storage/sentence.js#L79) will over-censor
  "cat" in "category"-adjacent text — write the test, then decide).
- `data/integrity.test.js` — feed the audit a corrupt vault and assert every bucket fires.
- `data/migrations.test.js` — v0 → current on a fixture vault.

### 9.3 Build

[build.js](build.js) is a recursive include-replacer with an unbounded `while (content.match(regex))`
loop — a circular include hangs the build. Add a depth/visited guard. Then extend it to:

- concatenate the stylesheets into one `popup.css`,
- emit to a `dist/` directory so `popup/popup.html` stops being a committed generated artefact
  (it is currently tracked, 1186 lines, and will conflict on every parallel edit),
- add `npm run lint`, `npm run test`, `npm run build`, `npm run check` (all three).

Add `dist/` to [.gitignore](.gitignore) and remove `popup/popup.html` from git tracking.

### 9.4 CI

One GitHub Actions workflow running `npm ci && npm run check` on push and PR.

---

## Execution order

Phases are ordered so that later work does not have to be redone.

| # | Phase | Depends on | Rough size |
|---|---|---|---|
| 1 | 1.1–1.2 manifest + reloader removal | — | S |
| 2 | 9.1 lint/format config | — | S |
| 3 | 2.1–2.6 discrete bug fixes | 2 | M |
| 4 | 2.3 dictionary cache | 3 | M |
| 5 | 3.1–3.3 escaping, model HTML, key headers | 3 | L |
| 6 | 4.1 directory move (shim in place) | 3, 5 | L |
| 7 | 2.7–2.9 storage + deck state | 6 | M |
| 8 | 4.2–4.6 module splits + dedup | 6 | L |
| 9 | 9.2 tests over `core/` and `data/` | 6, 7 | M |
| 10 | 5.1–5.5 CSS consolidation + tokens | 8 | L |
| 11 | 6.1–6.7 UI/UX rework, tab by tab | 10 | XL |
| 12 | 7 accessibility | 11 | M |
| 13 | 8 performance pass + measurement | 11 | M |
| 14 | 1.3–1.5 copy/naming purge, README | 11 | M |
| 15 | 9.3–9.4 build + CI | 10, 14 | S |

Phase 1.3 (the naming purge) is deliberately last among the de-AI tasks: doing it before the
structural work means renaming the same classes twice.

## Definition of done

- `npm run check` passes: lint clean, tests green, build succeeds.
- `grep -rn "localhost"` → no hits outside `dev/` and docs.
- `grep -rni "premium\|state-of-the-art\|seamless\|glassmorphic\|high-performance"` → no hits.
- No emoji in any user-facing string.
- `grep -rn "\.innerHTML *="` → only inside `ui/dom.js` and template mounts with escaped input.
- `grep -c 'style="' src/html/*.html` → under 20 total.
- `ls styles/` → 12 files or fewer, none suffixed with a number.
- Chrome DevTools Lighthouse accessibility pass on the popped-out page ≥ 90.
- One Cambridge network request per word lookup, verified in the Network panel.
