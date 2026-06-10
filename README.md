<p align="center">
  <img src="docs/banner.png" alt="Spelt Banner" width="720" />
</p>

<h1 align="center">Spelt</h1>

<p align="center">
  A Chrome extension that helps you actually <em>learn</em> the words you keep misspelling.<br>
  Built around spaced repetition, not just red underlines.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-green?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/zero-dependencies-brightgreen?style=flat-square" alt="Zero Dependencies" />
</p>

---

## What is this?

Most spell checkers tell you something is wrong and move on. Spelt does the opposite — it remembers what you got wrong and makes sure you practice it until you actually know the spelling. No more googling "accommodate" for the fifth time this week.

The idea is simple: type a word, check the spelling, and if it's wrong, Spelt saves the correction and queues it for spaced repetition review. Over time, your problem words surface less and less as you nail them.

<p align="center">
  <img src="docs/screenshot-popup.png" alt="Spelt Popup Interface" width="360" />
</p>

## Features

### 🔍 Spellcheck Sandbox
Type any word and hit Enter. Spelt checks it against a dictionary API. If the spelling is correct, it saves the word with its definition and pronunciation. If it's incorrect, it suggests corrections and lets you accept or reject them.

<p align="center">
  <img src="docs/screenshot-sandbox-correct.png" alt="Sandbox Correct Spelling" width="340" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="docs/screenshot-sandbox-incorrect.png" alt="Sandbox Misspelling Suggestions" width="340" />
</p>

### 🗂️ SRS Practice Deck
Words that need attention show up as flashcards. You see the definition, phonetic transcription, and pronunciation play buttons. Type the spelling, check your answer, and rate yourself using the SM-2 buttons or keyboard shortcuts `1`-`4`.

<p align="center">
  <img src="docs/screenshot-practice-prompt.png" alt="Practice Card Front" width="340" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="docs/screenshot-practice-result.png" alt="Practice Card Back" width="340" />
</p>

### 🔑 Word Vault
A searchable, sortable list of everything you've saved. Filter by status (due, new, learning) and sort alphabetically, by date added, or next review date in ascending or descending order. Edit or delete entries inline.

<p align="center">
  <img src="docs/screenshot-vault.png" alt="Word Vault List and Sorting" width="340" />
</p>

### 🔊 Pronunciation Audio
Spelt automatically fetches US and UK audio pronunciations from the dictionary API so you can hear the words correctly.

### 🔥 XP & Streaks
Earn XP for correct spellings in Sandbox or daily reviews. Keep a daily review streak going with a visual combo streak indicator to stay motivated.

### 📊 Full Dashboard
Open the full-page dashboard (`dashboard.html`) for a wider workspace, including analytics calendars, retention heatmaps, and progress tracking.

### 💾 Export / Import
Back up your entire database as a clean JSON file and restore it on any device. Works seamlessly across both the popup and dashboard views.

## How to Install

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer Mode** (toggle in the top right)
4. Click **Load unpacked** and select the project folder
5. Pin the extension from the toolbar — that's it

## Project Structure

```
Spelt/
├── manifest.json          # Chrome extension config (Manifest V3)
├── shared/
│   └── storage.js         # Database layer + SM-2 algorithm
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styles
│   ├── popup.js           # Entry point
│   └── js/
│       ├── sandbox.js     # Spellcheck sandbox controller
│       ├── practice.js    # SRS flashcard practice
│       ├── vault.js       # Word list management
│       ├── navigation.js  # Tab switching
│       └── settings.js    # Export, import, wipe, SRS tuning
├── dashboard/
│   ├── dashboard.html     # Full-page dashboard
│   ├── dashboard.css
│   ├── dashboard.js
│   └── js/
│       ├── sandbox.js
│       ├── practice.js
│       ├── vault.js
│       ├── analytics.js   # Streak, retention, heatmap stats
│       ├── navigation.js
│       └── settings.js
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── docs/
    ├── banner.png
    └── screenshot-popup.png
```

## How the SRS Works

Spelt uses the **SM-2 (SuperMemo 2)** algorithm for scheduling reviews. Each word has an ease factor, repetition count, and interval that get updated every time you rate a card.

- **Again** — Reset the card. It stays due immediately so you practice it again right away.
- **Hard** — Short interval (1 day). The ease factor drops slightly.
- **Good** — Standard progression. Interval grows based on the ease factor.
- **Easy** — Aggressive interval jump. The card won't come back for a while.

There's also a spacing multiplier in Settings. Set it to 0.5x for faster repetition or 1.5x if you want a more relaxed schedule.

## APIs Used

- [Free Dictionary API](https://dictionaryapi.dev/) — Word definitions, phonetics, and audio
- [Datamuse API](https://www.datamuse.com/api/) — Spelling suggestions and fuzzy matching

Both are free with no API key required. All data stays in `chrome.storage.local`.

## License

MIT — do whatever you want with it.
