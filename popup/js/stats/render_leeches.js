export function renderLeeches(words, currentLeechesLimit, currentLeechesCustomVal) {
  const leechesList = document.getElementById('stats-leeches-list');
  const leechesEmpty = document.getElementById('stats-leeches-empty');
  if (!leechesList) return;

  leechesList.innerHTML = '';
  
  let limit = 10;
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
    if (leechesEmpty) leechesEmpty.style.display = 'block';
    leechesList.style.display = 'none';
  } else {
    if (leechesEmpty) leechesEmpty.style.display = 'none';
    leechesList.style.display = 'flex';

    leeches.forEach(w => {
      const uniqueTypos = [...new Set((w.misspellings || []))].filter(Boolean);
      const lifetimeErrors = w.totalErrors || (w.misspellings || []).length;
      const streak = w.correctStreak || 0;
      const item = document.createElement('li');
      item.className = 'leech-item';
      item.innerHTML = `
        <div class="leech-word-info">
          <span class="leech-word-text">${w.word}</span>
          <span class="leech-count-badge">${lifetimeErrors} lifetime error${lifetimeErrors > 1 ? 's' : ''}${streak > 0 ? ` · ${streak}✓ streak` : ''}</span>
        </div>
        <div class="leech-typos">
          Common typos: <span class="leech-typos-list">${uniqueTypos.slice(0, 3).join(', ') || 'none'}</span>
        </div>
      `;
      leechesList.appendChild(item);
    });
  }
}
