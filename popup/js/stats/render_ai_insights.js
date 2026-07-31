import { isGeminiConfigured, askGemini } from '../../../shared/storage.js';
import { buildStatsInsightsPrompt } from '../../../shared/ai/prompts.js';
import { buildStatsHash } from '../../../src/core/stats_hash.js';

const CACHE_KEY = 'spelt_stats_ai_insights';
const CACHE_TIME_KEY = 'spelt_stats_ai_insights_timestamp';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Keep track of whether we've initialized the button event listeners in this session
let listenersBound = false;

/**
 * The most recent render's numbers.
 *
 * The click handler below is bound once and would otherwise close over the
 * arguments of the *first* render, so pressing refresh after a practice session
 * regenerated the insights from whatever the stats looked like when the tab
 * first opened — and stored that stale reading as the cache fingerprint.
 */
let latestContext = null;

/**
 * Every figure the insights are built from.
 *
 * Computed in one place because two consumers need to agree exactly: the cache
 * fingerprint, and the prompt describing the numbers to the model. Derived
 * separately they can drift, and then a cache entry claims to describe stats it
 * does not.
 */
function computeInsightMetrics(words, streak, summary, cardStates, sessions) {
  const retentionRate = summary.totalReviews > 0
    ? Math.round((summary.correctReviews / summary.totalReviews) * 100)
    : 0;

  const errorsFor = (w) => w.totalErrors || (w.misspellings || []).length;
  const uniqueLeechesMap = new Map();
  words
    .filter(w => !w.mastered && ((w.totalErrors || 0) > 0 || (Array.isArray(w.misspellings) && w.misspellings.length > 0)))
    .forEach(w => {
      const key = w.word.toLowerCase();
      const existing = uniqueLeechesMap.get(key);
      if (!existing || errorsFor(existing) < errorsFor(w)) uniqueLeechesMap.set(key, w);
    });
  const leeches = Array.from(uniqueLeechesMap.values())
    .sort((a, b) => errorsFor(b) - errorsFor(a))
    .slice(0, 5)
    .map(w => `${w.word} (${errorsFor(w)} errors)`);

  const cefrCounts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, unknown: 0 };
  words.forEach(w => {
    const level = w.level ? w.level.toUpperCase() : 'unknown';
    if (cefrCounts[level] !== undefined) cefrCounts[level]++;
    else cefrCounts.unknown++;
  });

  const avgResponseTime = summary.globalRtCount > 0 ? Math.round(summary.globalRtSum / summary.globalRtCount) : 0;
  const totalSessions = sessions ? sessions.length : 0;
  const totalStudyMs = sessions && sessions.length > 0
    ? sessions.reduce((sum, s) => sum + (s.endTime - s.startTime), 0)
    : summary.globalRtSum;
  const studyTimeMin = Math.round(totalStudyMs / 1000 / 60);

  const metrics = {
    retentionRate, leeches, cefrCounts, avgResponseTime, totalSessions, studyTimeMin
  };

  metrics.statsHash = buildStatsHash({
    wordsCount: words.length,
    newCount: cardStates.newCount,
    learningCount: cardStates.learningCount,
    matureCount: cardStates.matureCount,
    masteredCount: cardStates.masteredCount,
    totalReviews: summary.totalReviews,
    retentionRate,
    currentStreak: streak.current || 0,
    maxStreak: streak.max || 0,
    leechesStr: leeches.join(','),
    sandboxChecks: summary.globalSandboxChecks,
    avgResponseTime,
    totalSessions,
    studyTimeMin
  });

  return metrics;
}

export async function renderAIInsights(words, streak, summary, cardStates, sessions) {
  const panel = document.getElementById('stats-ai-insights-panel');
  const contentEl = document.getElementById('stats-ai-insights-content');
  if (!panel || !contentEl) return;

  // Active tab check: do not run anything unless the student is actively viewing the stats tab
  const statsTab = document.getElementById('stats-tab');
  if (!statsTab || !statsTab.classList.contains('active')) {
    return;
  }

  const isConfigured = await isGeminiConfigured();
  if (!isConfigured || words.length === 0) {
    panel.classList.add('hidden');
    hideSubtabPanels();
    return;
  }

  const metrics = computeInsightMetrics(words, streak, summary, cardStates, sessions);

  // Binding listeners for generate and refresh buttons
  bindActionListeners({ words, streak, summary, cardStates, sessions, metrics });

  // Check cache first
  try {
    const cachedData = await chrome.storage.local.get([CACHE_KEY, CACHE_TIME_KEY, 'spelt_stats_ai_insights_hash']);
    const cachedTime = cachedData[CACHE_TIME_KEY] || 0;
    const cachedHash = cachedData['spelt_stats_ai_insights_hash'] || '';
    const cacheExpired = Date.now() - cachedTime > CACHE_TTL_MS;

    // The cached text is shown even when the numbers have moved on, so the panel
    // is never empty — but it is an answer the model wrote about older figures,
    // and that has to be said out loud rather than hinted at with a glow. It is
    // not regenerated automatically: that is a paid API call, and the stats
    // change on every single review.
    if (cachedData[CACHE_KEY]) {
      const parsed = typeof cachedData[CACHE_KEY] === 'string' ? JSON.parse(cachedData[CACHE_KEY]) : cachedData[CACHE_KEY];
      distributeInsights(parsed);
      markStale(cachedHash !== metrics.statsHash || cacheExpired, cacheExpired);
      return;
    }
  } catch (_) {}

  // If no cache at all, show the Generate placeholder
  panel.classList.remove('hidden');
  showGeneratePlaceholder();
}

function showGeneratePlaceholder() {
  const contentEl = document.getElementById('stats-ai-insights-content');
  if (contentEl) {
    contentEl.innerHTML = `
      <div class="ai-insights-placeholder">
        <p class="ai-insights-desc">Get personalized coaching tips and subtab analysis powered by Gemini AI.</p>
        <button type="button" id="stats-ai-generate-btn" class="submit-btn ai-insights-btn">
          Generate AI Insights
        </button>
      </div>
    `;
  }
  const refreshBtn = document.getElementById('stats-ai-refresh-btn');
  if (refreshBtn) refreshBtn.classList.add('hidden');
  
  hideSubtabPanels();
}

/**
 * Show or clear the "these insights describe older numbers" notice, and put the
 * refresh control in reach.
 */
function markStale(isStale, cacheExpired) {
  const refreshBtn = document.getElementById('stats-ai-refresh-btn');
  if (refreshBtn) {
    refreshBtn.classList.remove('hidden');
    refreshBtn.classList.toggle('is-stale', isStale);
    refreshBtn.title = isStale
      ? (cacheExpired
        ? 'These insights are over 6 hours old. Click to regenerate.'
        : 'Your stats have changed since these insights were written. Click to regenerate.')
      : 'Regenerate AI Coach Insights';
  }

  const content = document.getElementById('stats-ai-insights-content');
  content?.querySelector('.ai-insights-stale-note')?.remove();
  if (!isStale || !content) return;

  const note = document.createElement('p');
  note.className = 'ai-insights-stale-note';
  note.textContent = cacheExpired
    ? 'Written over 6 hours ago — click the refresh icon above to rewrite them.'
    : 'Written from earlier stats — click the refresh icon above to rewrite them.';
  content.appendChild(note);
}

function bindActionListeners(context) {
  const panel = document.getElementById('stats-ai-insights-panel');
  if (!panel) return;

  // Refreshed on every render so the handler below always regenerates from the
  // numbers on screen, not the ones present when it was first bound.
  latestContext = context;

  // We bind once using event delegation
  if (!listenersBound) {
    panel.addEventListener('click', async (e) => {
      const genBtn = e.target.closest('#stats-ai-generate-btn');
      const refBtn = e.target.closest('#stats-ai-refresh-btn');
      if ((genBtn || refBtn) && latestContext) {
        e.preventDefault();
        e.stopPropagation();
        await triggerInsightsGeneration(latestContext);
      }
    });
    listenersBound = true;
  }
}

async function triggerInsightsGeneration({ words, streak, summary, cardStates, metrics }) {
  const panel = document.getElementById('stats-ai-insights-panel');
  const contentEl = document.getElementById('stats-ai-insights-content');
  const refreshBtn = document.getElementById('stats-ai-refresh-btn');
  if (!panel || !contentEl) return;

  // Set loading states
  contentEl.textContent = 'Generating custom learning insights...';
  if (refreshBtn) {
    refreshBtn.classList.remove('hidden');
    refreshBtn.disabled = true;
    refreshBtn.classList.add('is-loading');
  }
  showSubtabLoading();

  try {
    const { retentionRate, leeches, cefrCounts, avgResponseTime, totalSessions, studyTimeMin } = metrics;

    const statsSummary = `
- Total words in library: ${words.length}
- Card Distribution: New: ${cardStates.newCount}, Learning: ${cardStates.learningCount}, Mature: ${cardStates.matureCount}, Mastered: ${cardStates.masteredCount}
- All-time Reviews: ${summary.totalReviews}
- SRS Retention Rate: ${retentionRate}%
- Current Streak: ${streak.current || 0} days (best: ${streak.max || 0} days)
- Top 5 Leech Words: ${leeches.join(', ') || 'None'}
- CEFR Distribution: A1/A2 (Beginner): ${cefrCounts.A1 + cefrCounts.A2}, B1/B2 (Intermediate): ${cefrCounts.B1 + cefrCounts.B2}, C1/C2 (Advanced): ${cefrCounts.C1 + cefrCounts.C2}
- Sandbox activity check success rate: ${summary.globalSandboxChecks > 0 ? Math.round((summary.globalSandboxCorrect / summary.globalSandboxChecks) * 100) : 0}%
- Avg Response Time: ${avgResponseTime}ms
- Total Sessions: ${totalSessions}
- Total Study Time: ${studyTimeMin} minutes
    `;

    const dataObj = await askGemini(buildStatsInsightsPrompt(statsSummary));

    // Distribute results to subtab panels
    distributeInsights(dataObj);
    markStale(false, false);

    // Cache the result
    try {
      await chrome.storage.local.set({
        [CACHE_KEY]: dataObj,
        [CACHE_TIME_KEY]: Date.now(),
        'spelt_stats_ai_insights_hash': metrics.statsHash
      });
    } catch (_) {}
  } catch (err) {
    console.error('[Spelt AI] Failed to load insights:', err);
    contentEl.innerHTML = `
      <div class="ai-insights-placeholder">
        <span class="ai-insights-error">${err.message}</span>
        <button type="button" id="stats-ai-generate-btn" class="submit-btn ai-insights-btn">
          🔄 Try Again
        </button>
      </div>
    `;
    hideSubtabPanels();
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('is-loading');
    }
  }
}

/** Render styled insights safely, parsing allowable inline HTML markup (ul, li, strong, em). */
function renderInsight(el, value) {
  el.replaceChildren();

  const items = Array.isArray(value)
    ? value.filter(v => typeof v === 'string' && v.trim())
    : null;

  if (items && items.length > 0) {
    const ul = document.createElement('ul');
    ul.className = 'ai-insight-list';
    for (const item of items) {
      const li = document.createElement('li');
      renderSafeHtml(li, item.trim());
      ul.appendChild(li);
    }
    el.appendChild(ul);
    return;
  }

  const str = typeof value === 'string' ? value.trim() : String(value ?? '');
  if (!str) return;

  renderSafeHtml(el, str);
}

function renderSafeHtml(targetEl, htmlStr) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlStr, 'text/html');
  const allowedTags = new Set(['UL', 'OL', 'LI', 'P', 'SPAN', 'STRONG', 'EM', 'B', 'I', 'BR', 'DIV']);

  function sanitize(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent);
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toUpperCase();
      if (!allowedTags.has(tag)) {
        return document.createTextNode(node.textContent);
      }
      const newEl = document.createElement(tag.toLowerCase());
      if (tag === 'UL') newEl.className = 'ai-insight-list';
      for (const child of node.childNodes) {
        const cleanChild = sanitize(child);
        if (cleanChild) newEl.appendChild(cleanChild);
      }
      return newEl;
    }
    return null;
  }

  for (const child of doc.body.childNodes) {
    const clean = sanitize(child);
    if (clean) targetEl.appendChild(clean);
  }
}

// The model's reply is untrusted text, so it is written with textContent and
// the surrounding markup is built here. Never innerHTML a model response.
function distributeInsights(dataObj) {
  if (!dataObj) return;

  const sections = [
    { value: dataObj.overview, contentId: 'stats-ai-insights-content', panelId: 'stats-ai-insights-panel' },
    { value: dataObj.vocabulary, contentId: 'stats-ai-vocab-content', panelId: 'stats-ai-vocab-panel' },
    { value: dataObj.activity, contentId: 'stats-ai-activity-content', panelId: 'stats-ai-activity-panel' },
    { value: dataObj.performance, contentId: 'stats-ai-perf-content', panelId: 'stats-ai-perf-panel' }
  ];

  for (const { value, contentId, panelId } of sections) {
    const content = document.getElementById(contentId);
    const panel = document.getElementById(panelId);
    const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(value);

    if (content && hasValue) {
      renderInsight(content, value);
      panel?.classList.remove('hidden');
    } else {
      panel?.classList.add('hidden');
    }
  }
}

function showSubtabLoading() {
  const vocabPanel = document.getElementById('stats-ai-vocab-panel');
  const vocabContent = document.getElementById('stats-ai-vocab-content');
  if (vocabPanel && vocabContent) {
    vocabContent.textContent = 'Analyzing vocabulary distribution...';
    vocabPanel.classList.remove('hidden');
  }
  
  const actPanel = document.getElementById('stats-ai-activity-panel');
  const actContent = document.getElementById('stats-ai-activity-content');
  if (actPanel && actContent) {
    actContent.textContent = 'Analyzing consistency patterns...';
    actPanel.classList.remove('hidden');
  }

  const perfPanel = document.getElementById('stats-ai-perf-panel');
  const perfContent = document.getElementById('stats-ai-perf-content');
  if (perfPanel && perfContent) {
    perfContent.textContent = 'Analyzing response speed...';
    perfPanel.classList.remove('hidden');
  }
}

function hideSubtabPanels() {
  const vocabPanel = document.getElementById('stats-ai-vocab-panel');
  if (vocabPanel) vocabPanel.classList.add('hidden');
  
  const actPanel = document.getElementById('stats-ai-activity-panel');
  if (actPanel) actPanel.classList.add('hidden');

  const perfPanel = document.getElementById('stats-ai-perf-panel');
  if (perfPanel) perfPanel.classList.add('hidden');
}
