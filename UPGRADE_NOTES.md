# Daily study space · 1.2

The previous opening screen offered a spelling field with little direction. Spelt now opens with an actionable review plan and an optional way to begin with five useful words.

- New letter-tile icon and vector artwork; bundled DM Sans with its font license.
- Today page with a real daily review goal, due counts, saved vocabulary, mastered words, recent activity, and three original starter collections.
- Paper and Forest appearances; responsive navigation and consistent styling across every view.
- Discover with a visible lookup button, suggested words, and clear loading and connection feedback.
- Word editor with personal memory cues and a native, keyboard-accessible practice selector. Editing details does not repeat dictionary validation.
- Practice with after-answer memory cues, separate spelling and meaning schedules, and keyboard-safe front/back cards.
- Real answer correctness is recorded separately from recall ratings. A service-worker bug that converted a correct answer into a blank incorrect answer is fixed.
- Own review writes no longer race the deck advance; saved recall mode loads before the initial deck; stale dictionary responses cannot update another card.
- Storage errors reach callers instead of reporting a false save. Collection additions are atomic and preserve existing words. Backups preserve notes, tags, spelling variants, and actual answer results.

## Verification

`npm run check` covers lint, unit tests, and the generated extension HTML. `npm run test:ui` exercises an isolated real Manifest V3 extension, including the service worker. Screenshot and optional accessibility reports are generated under `artifacts/learning-qa/`.

Verified on September 14, 2026: lint and build passed, all 56 unit tests passed, and all 82 browser checks passed. The accessibility scan found no violations in 25 audited states. Responsive checks covered 320, 420, 580, and 1200 pixel widths, plus 150% text at 320 and 420 pixels. No uncaught page errors or horizontal layout failures were recorded.

Dictionary responses are controlled in UI tests; this does not claim a live provider availability or audio-quality check. Existing Gemini tests cover its request and fallback behavior. No permission changes or new remote assets were added.
