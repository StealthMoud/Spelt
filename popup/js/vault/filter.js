export function formatTimeUntil(w) {
  if (w.mastered) {
    return { text: 'Mastered', color: 'var(--success)' };
  }
  const nextDate = w.nextDate;
  const now = Date.now();
  if (nextDate <= now) return { text: 'Due now', color: 'var(--primary-light)' };
  const diff = nextDate - now;
  const mins = Math.round(diff / 60000);
  const hrs = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);
  if (mins < 60) return { text: `in ${mins}m`, color: 'var(--warning, hsl(40,90%,55%))' };
  if (hrs < 24) return { text: `in ${hrs}h`, color: 'var(--text-muted)' };
  if (days < 30) return { text: `in ${days}d`, color: 'var(--text-muted)' };
  const months = Math.round(days / 30);
  return { text: `in ${months}mo`, color: 'var(--text-muted)' };
}

export function getFilteredWords(wordsList) {
  const query = document.getElementById('vault-search').value.trim().toLowerCase();
  const statusFilter = document.getElementById('vault-filter-status')?.value || 'all';

  let filtered = wordsList.filter(w => 
    w.word.toLowerCase().includes(query) || 
    w.definition.toLowerCase().includes(query)
  );

  if (statusFilter === 'learning') {
    filtered = filtered.filter(w => !w.mastered);
  } else if (statusFilter === 'mastered') {
    filtered = filtered.filter(w => w.mastered);
  } else if (statusFilter === 'due') {
    filtered = filtered.filter(w => w.nextDate <= Date.now() && !w.mastered);
  }

  return filtered;
}
