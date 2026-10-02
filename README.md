# Spelt

A Chrome extension for recording and practicing misspelled words using spaced repetition.

Spelt helps you track words you type incorrectly and review them until you master their spelling. Instead of just highlighting typos, it queues corrected words into a SuperMemo-2 (SM-2) flashcard system.

## Features

- **Word discovery**: Check word spelling against dictionary data, inspect definitions, audio pronunciations, and IPA transcriptions.
- **Spaced Repetition Review**: Practice misspelled words with flashcards. Cards show definitions and censored example sentences.
- **Word Vault**: Filter, sort, edit, and bulk-manage your vocabulary list.
- **Study Statistics**: Track review accuracy, card maturity distribution, daily activity, and frequent spelling errors.
- **AI Assist (Optional)**: Connect an optional Gemini API key to generate spelling mnemonics, sentence feedback, and dictionary data enrichment on demand.

## Keyboard Shortcuts

- **Global Extension Shortcut**: `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Windows)
- **Discover**: `Enter` to verify, `Space` to play audio, `Esc` to close card
- **Practice**: `Enter` to check answer, `1`–`5` to rate review recall (Again to Mastered)

## Local Development & Installation

Run `npm run build` before loading the unpacked extension in Chrome (`chrome://extensions`).

```bash
# Compile popup HTML
npm run build

# Run unit tests
npm test

# Run linter
npm run lint

# Compile popup HTML and run full check
npm run check
```

## License

MIT

## Spelt 1.2 — the daily study space

Spelt now opens on **Today**: a daily review goal, the words ready to revisit, a seven-day activity strip, and three optional five-word collections. Collections contain original examples and memory cues and can be added without a connection or an AI key. They never replace existing words. The review goal counts saved review attempts; collecting a word does not count as a review.

**Discover** gives word lookup a visible action and starting suggestions. **Practice** supports spelling and meaning recall, shows editable memory notes after revealing the answer, and keeps the two review schedules separate. Incorrect answers can be retried with Again. The actual answer result is recorded separately from the rating used to schedule the next review. Older history without an answer result retains its original rating-based accuracy estimate.

Choose **Paper**, **Forest**, or your device appearance in Settings. Daily goals of 5, 10, or 20 reviews and appearance preferences are saved locally. The interface works in the 420 × 600 Chrome popup, the standalone window, and a full extension page. Fonts and illustrations are bundled; the visual design needs no remote assets.

### Browser verification

```bash
npx playwright install chromium
npm run test:ui
```

The UI regression script loads the actual unpacked extension and its service worker in a disposable browser profile. It checks collection deduplication, correct and incorrect reviews, independent recall scheduling, settings persistence, keyboard navigation, search, and both appearances at 320, 420, 580, and 1200 pixels. It uses controlled dictionary responses and writes screenshots and a report to `artifacts/learning-qa/`. It never opens your normal browser profile.

Set `SPELT_CHROMIUM_PATH` to use an existing Chromium executable. Set `SPELT_AXE_PATH` to an existing `axe.min.js` to include optional WCAG checks. Regenerate PNG extension icons from the vector source with `npm run icons`.

The app's learning views work without AI. Live dictionary lookup, pronunciation, translation, and optional AI features still use their respective services. Saved words can be reviewed offline. Export and import preserve memory notes, tags, and recorded answer results.
