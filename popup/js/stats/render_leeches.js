import { isGeminiConfigured, askGeminiText } from '../../../shared/storage.js';

export function renderLeeches(words, currentLeechesLimit, currentLeechesCustomVal) {
  const leechesList = document.getElementById('stats-leeches-list');
  const leechesEmpty = document.getElementById('stats-leeches-empty');
  if (!leechesList) return;

  leechesList.innerHTML = '';
  
  let limit;
  if (currentLeechesLimit === 'custom') {
    limit = currentLeechesCustomVal;
  } else if (currentLeechesLimit === 'all') {
    limit = words.length;
  } else {
    limit = parseInt(currentLeechesLimit, 10) || 10;
  }
  
  const uniqueLeechesMap = new Map();
  words
    .filter(w => !w.mastered && ((w.totalErrors || 0) > 0 || (Array.isArray(w.misspellings) && w.misspellings.length > 0)))
    .forEach(w => {
      const key = w.word.toLowerCase();
      const errCount = w.totalErrors || (w.misspellings || []).length;
      const existing = uniqueLeechesMap.get(key);
      if (!existing || (existing.totalErrors || (existing.misspellings || []).length) < errCount) {
        uniqueLeechesMap.set(key, w);
      }
    });

  const allLeeches = Array.from(uniqueLeechesMap.values())
    .sort((a, b) => (b.totalErrors || (b.misspellings || []).length) - (a.totalErrors || (a.misspellings || []).length));

  const leeches = allLeeches.slice(0, limit);

  if (leeches.length === 0) {
    if (leechesEmpty) leechesEmpty.classList.remove('hidden');
    leechesList.classList.add('hidden');
  } else {
    if (leechesEmpty) leechesEmpty.classList.add('hidden');
    leechesList.classList.remove('hidden');

    leeches.forEach(w => {
      const uniqueTypos = [...new Set((w.misspellings || []))].filter(Boolean);
      const lifetimeErrors = w.totalErrors || (w.misspellings || []).length;
      const streak = w.correctStreak || 0;
      const item = document.createElement('li');
      item.className = 'leech-item';
      item.style.flexDirection = 'column';
      item.style.alignItems = 'stretch';
      item.innerHTML = `
        <div class="leech-header-row">
          <div class="leech-word-info">
            <span class="leech-word-text">${w.word}</span>
            <span class="leech-count-badge">${lifetimeErrors} lifetime error${lifetimeErrors > 1 ? 's' : ''}${streak > 0 ? ` · ${streak}✓ streak` : ''}</span>
          </div>
          <button type="button" class="icon-btn leech-coach-btn hidden leech-coach-btn-style" title="AI Coach Mnemonic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span class="leech-coach-label">Coach</span>
          </button>
        </div>
        <div class="leech-typos leech-typos-mt">
          Common typos: <span class="leech-typos-list">${uniqueTypos.slice(0, 3).join(', ') || 'none'}</span>
        </div>
        <div class="leech-coach-bubble hidden">
          Loading coaching tips...
        </div>
      `;

      // Wire AI button if Gemini is configured
      const coachBtn = item.querySelector('.leech-coach-btn');
      const coachBubble = item.querySelector('.leech-coach-bubble');
      
      if (coachBtn && coachBubble) {
        isGeminiConfigured().then(configured => {
          if (configured) {
            coachBtn.classList.remove('hidden');
            coachBtn.addEventListener('click', async () => {
              if (!coachBubble.classList.contains('hidden')) {
                coachBubble.classList.add('hidden');
              } else {
                coachBubble.classList.remove('hidden');
                if (coachBubble.textContent.trim() === 'Loading coaching tips...') {
                  try {
                    const prompt = `Word: "${w.word}". Common typos: "${uniqueTypos.join(', ') || 'none'}". Give a memorable spelling mnemonic or trick. 1-2 sentences. Plain text only.`;
                    const tips = await askGeminiText(prompt, { maxOutputTokens: 150, temperature: 0.3 });
                    coachBubble.textContent = tips;
                  } catch (err) {
                    coachBubble.textContent = `Could not load coaching tips: ${err.message}`;
                  }
                }
              }
            });
          }
        });
      }

      leechesList.appendChild(item);
    });
  }
}

