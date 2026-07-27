# Spelt

A Chrome extension for recording and practicing misspelled words using spaced repetition.

Spelt helps you track words you type incorrectly and review them until you master their spelling. Instead of just highlighting typos, it queues corrected words into a SuperMemo-2 (SM-2) flashcard system.

## Features

- **Spellcheck Sandbox**: Check word spelling against dictionary data, inspect definitions, audio pronunciations, and IPA transcriptions.
- **Spaced Repetition Review**: Practice misspelled words with flashcards. Cards show definitions and censored example sentences.
- **Word Vault**: Filter, sort, edit, and bulk-manage your vocabulary list.
- **Study Statistics**: Track review accuracy, card maturity distribution, daily activity, and frequent spelling errors.
- **AI Assist (Optional)**: Connect an optional Gemini API key to generate spelling mnemonics, sentence feedback, and dictionary data enrichment on demand.

## Keyboard Shortcuts

- **Global Extension Shortcut**: `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Windows)
- **Sandbox**: `Enter` to verify, `Space` to play audio, `Esc` to close card
- **Practice**: `Enter` to check answer, `1`–`5` to rate review recall (Again to Mastered)

## Local Development & Testing

```bash
# Run unit tests
npm test

# Run linter
npm run lint

# Compile popup HTML and run full check
npm run check
```

## License

MIT
