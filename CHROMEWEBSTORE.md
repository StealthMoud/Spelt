# Chrome Web Store Listing — Spelt

## Store Listing

**Extension Name**  
Spelt

**Short Description**  
Organized spelling and vocabulary trainer featuring Spaced Repetition (SRS) scheduling and dictionary lookups.

**Detailed Description**  
Spelt is a personal vocabulary trainer and spelling tool.

Key Features:
- Sandbox Mode: Instantly check and validate English word spelling, phonetic pronunciation, and definition details.
- Practice Mode: Master vocabulary using the SuperMemo-2 Spaced Repetition Algorithm (SRS), with custom review response timing and session tracking.
- Personal Vault: Add, group, and edit custom words or view vocabulary analytics, including study velocity and CEFR levels.
- Context Menu Integration: Right-click any highlighted word on the web and save it directly to your Vault.
- Activity Analytics: Calendar heatmaps, accuracy graphs, and response speed trackers let you view your learning habits in real-time.

How to use it:
1. Type a word in Sandbox to inspect its CEFR level, meaning, and translation.
2. Select any word on any website, right-click, and choose "Add to Spelt Vault".
3. Open the extension popup, go to the Practice tab, and review cards matching SRS intervals.
4. Go to the Stats tab to view detailed behavioral graphs, streak records, and CEFR level progress.

**Category**  
Productivity

**Single Purpose**  
Organized spelling and vocabulary trainer featuring Spaced Repetition scheduling and on-demand dictionary lookups.

**Primary Language**  
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | Ready | `icons/icon-128.png` |
| Screenshot 1 | 1280×800 or 640×400 | Not created | |
| Small Promo Tile | 440×280 | Not created | |

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Required to locally store and retrieve vocabulary words, flashcard scheduling intervals, streaks, and session analytics. |
| `declarativeNetRequest` | permissions | Required to bypass CORS blocks on Cambridge Dictionary, allowing direct background retrieval of phonetic transcriptions and CEFR levels. |
| `contextMenus` | permissions | Required to add the "Add to Spelt Vault" item on selected webpage text, allowing users to save words directly while browsing. |
| `notifications` | permissions | Required to show desktop confirmation alerts when a word is successfully saved via the context menu. |
| `activeTab` | permissions | Grants temporary, user-consented access to the active webpage when the context menu is clicked or the keyboard shortcut is pressed, allowing safe script injection to fetch selection text. |
| `scripting` | permissions | Allows the background script to run a function in the active tab context to retrieve selected text and inject UI toast confirmation messages. |
| `https://generativelanguage.googleapis.com/*` | host_permissions | Allows optional AI dictionary enrichment and coaching queries. |
| `https://api.datamuse.com/*` | host_permissions | Allows spelling suggestion queries. |
| `https://ssl.gstatic.com/*` | host_permissions | Allows TTS audio fallback fetching. |
| `https://tatoeba.org/*` | host_permissions | Allows on-demand fetching of example sentences to populate newly added cards. |
| `https://translate.googleapis.com/*` | host_permissions | Allows auto-translation of target vocabulary words based on language preferences. |
| `https://api.dictionaryapi.dev/*` | host_permissions | Allows fetching vocabulary definitions and phonetic transcriptions. |
| `https://dictionary.cambridge.org/*` | host_permissions | Required to access Cambridge Dictionary pages to extract CEFR levels and IPA pronunciations. |
| `https://www.oxfordlearnersdictionaries.com/*` | host_permissions | Required to query Oxford Learner's Dictionary as a fallback source for CEFR levels and IPA pronunciations. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No. All data (vocabulary decks, progress, settings) is stored purely locally in the browser's `chrome.storage.local` store. No user data is transmitted to external servers.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## License

MIT
