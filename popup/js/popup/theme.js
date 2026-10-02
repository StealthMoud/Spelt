try {
  const saved = localStorage.getItem('spelt_theme_cache') || 'light';
  document.documentElement.dataset.theme = saved === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' : saved;
} catch {
  document.documentElement.dataset.theme = 'light';
}
