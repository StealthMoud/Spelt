import { getWords, getStored, setStored } from '../../src/data/storage.js';
import { learningSummary, normalizeGoal } from '../../src/core/learning.js';
import { COLLECTIONS } from '../../src/core/collections.js';
import { addCollection } from '../../src/data/collections.js';
import { escapeHtml } from '../../shared/dom.js';

let summary = null;
let renderVersion = 0;
let adding = false;
const setText = (id, text) => { const element = document.getElementById(id); if (element) element.textContent = text; };

export async function renderToday() {
  const version = ++renderVersion;
  const [words, goal, streak] = await Promise.all([getWords(), getStored('spelt_daily_goal'), getStored('spelt_streak')]);
  if (version !== renderVersion) return;
  summary = learningSummary(words, { goal, streak: streak || {} });
  setText('today-greeting', words.length ? 'Good to see you, word by word.' : 'Make room for a new word.');
  setText('today-date', new Date().toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' }));
  setText('today-reviewed', summary.reviewed);
  setText('today-goal', summary.goal);
  setText('today-word-count', summary.total);
  setText('today-due-count', summary.due);
  setText('today-mastered-count', summary.mastered);
  setText('today-streak', summary.streak);
  setText('today-encouragement', summary.reviewed >= summary.goal ? 'Your daily goal is complete. A good place to pause.' : summary.reviewed ? `${summary.goal - summary.reviewed} more reviews toward your daily goal.` : 'A small habit starts with one word.');
  const progress = document.getElementById('today-progress');
  progress.value = summary.progress;
  progress.textContent = `${summary.progress}%`;
  document.getElementById('today-week').innerHTML = summary.week.map((day, index) => `<div class="rhythm-day${day.count ? ' completed' : ''}${index === 6 ? ' current' : ''}" title="${day.date}: ${day.count} reviews"><span>${escapeHtml(day.label.slice(0, 1))}</span><i aria-label="${day.date}: ${day.count} reviews">${day.count ? '✓' : '·'}</i></div>`).join('');
  const start = document.getElementById('today-start');
  if (summary.due) {
    setText('today-plan', `${summary.due} ${summary.due === 1 ? 'word is' : 'words are'} ready for another look. A short review can help them stay.`);
    start.innerHTML = 'Start a review <span aria-hidden="true">→</span>';
    setText('today-plan-detail', `${summary.spelling} spelling · ${summary.recall} meaning reviews ready`);
  } else if (words.length) {
    setText('today-plan', 'You’re up to date. Give those words a little space, or discover something new.');
    start.innerHTML = 'Explore a new word <span aria-hidden="true">→</span>';
    setText('today-plan-detail', summary.nextReview ? `Next review: ${new Date(summary.nextReview).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Your next word is waiting to be discovered.');
  } else {
    setText('today-plan', 'Start with five useful words. Make them yours, one review at a time.');
    start.innerHTML = 'Find your first words <span aria-hidden="true">→</span>';
    setText('today-plan-detail', 'No setup. Start at your own pace.');
  }
  const existing = new Set(words.map(word => word.word.trim().toLowerCase()));
  document.getElementById('starter-collections').innerHTML = COLLECTIONS.map((collection, index) => {
    const remaining = collection.words.filter(entry => !existing.has(entry[0])).length;
    return `<article class="collection-card"><div class="collection-art art-${index}"><span class="collection-number">0${index + 1}</span><span class="collection-symbol" aria-hidden="true">${escapeHtml(collection.symbol)}</span><span class="collection-art-label">${index === 0 ? 'BETTER TOGETHER' : index === 1 ? 'SEEN, NOT HEARD' : 'FAMILIAR, AT LAST'}</span></div><div class="collection-copy"><h3>${escapeHtml(collection.title)}</h3><p>${escapeHtml(collection.description)}</p><div class="collection-words">${collection.words.map(entry => `<span>${escapeHtml(entry[0])}</span>`).join('')}</div><button type="button" class="quiet-link collection-add" data-collection="${collection.id}" ${!remaining || adding ? 'disabled' : ''}>${remaining ? `Add ${remaining} ${remaining === 1 ? 'word' : 'words'}` : 'All words in your vault'}<span aria-hidden="true">${remaining ? '+' : '✓'}</span></button></div></article>`;
  }).join('');
}

export function initToday(onWordsChanged) {
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-go-tab]');
    if (link) document.querySelector(`[data-tab="${link.dataset.goTab}"]`)?.click();
  });
  document.getElementById('today-start').addEventListener('click', () => {
    if (summary?.due) {
      document.getElementById('practice-tab-button').click();
      document.getElementById(summary.spelling ? 'practice-mode-spelling' : 'practice-mode-recall').click();
    } else if (summary?.total) document.getElementById('sandbox-tab-button').click();
    else {
      document.getElementById('collections-heading').scrollIntoView({ block: 'start' });
      document.querySelector('.collection-add:not(:disabled)')?.focus({ preventScroll: true });
    }
  });
  document.getElementById('starter-collections').addEventListener('click', async event => {
    const button = event.target.closest('[data-collection]');
    if (!button || adding) return;
    adding = true;
    button.disabled = true;
    const status = document.getElementById('collection-status');
    status.classList.remove('hidden');
    status.textContent = 'Adding your words…';
    try {
      const count = await addCollection(button.dataset.collection);
      await onWordsChanged();
      status.textContent = count ? `${count} words added. Your first review is ready above.` : 'These words are already in your vault.';
    } catch (error) {
      status.textContent = `Could not add the collection: ${error.message}`;
    } finally {
      adding = false;
      await renderToday();
    }
  });
  document.querySelectorAll('[data-try-word]').forEach(button => button.addEventListener('click', () => {
    if (document.getElementById('word-input').readOnly) return;
    document.getElementById('word-input').value = button.dataset.tryWord;
    document.getElementById('quick-add-form').requestSubmit();
  }));
}

export async function initStudyPreferences() {
  const [savedGoal, savedTheme] = await Promise.all([getStored('spelt_daily_goal'), getStored('spelt_theme')]);
  const goal = document.getElementById('setting-daily-goal');
  goal.value = normalizeGoal(savedGoal);
  goal.addEventListener('change', async () => {
    await setStored('spelt_daily_goal', normalizeGoal(goal.value));
    await renderToday();
  });
  const theme = document.getElementById('setting-theme');
  theme.value = ['light', 'dark', 'system'].includes(savedTheme) ? savedTheme : 'light';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme.value === 'system' ? system.matches ? 'dark' : 'light' : theme.value;
    try { localStorage.setItem('spelt_theme_cache', theme.value); } catch { /* Chrome storage remains authoritative. */ }
  };
  applyTheme();
  system.addEventListener('change', applyTheme);
  theme.addEventListener('change', async () => { applyTheme(); await setStored('spelt_theme', theme.value); });
}
