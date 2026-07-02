import { isGeminiConfigured, askGemini } from '../../../shared/storage.js';

const CACHE_KEY = 'spelt_stats_ai_insights';
const CACHE_TIME_KEY = 'spelt_stats_ai_insights_timestamp';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Keep track of whether we've initialized the button event listeners in this session
let listenersBound = false;

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
    panel.style.display = 'none';
    hideSubtabPanels();
    return;
  }

  // Pre-calculate stats metrics
  const retentionRate = summary.totalReviews > 0 ? Math.round((summary.correctReviews / summary.totalReviews) * 100) : 0;
  
  // Get leeches
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
  const leeches = Array.from(uniqueLeechesMap.values())
    .sort((a, b) => (b.totalErrors || (b.misspellings || []).length) - (a.totalErrors || (a.misspellings || []).length))
    .slice(0, 5)
    .map(w => `${w.word} (${w.totalErrors || (w.misspellings || []).length} errors)`);

  // CEFR levels count
  const cefrCounts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, unknown: 0 };
  words.forEach(w => {
    const level = w.level ? w.level.toUpperCase() : 'unknown';
    if (cefrCounts[level] !== undefined) cefrCounts[level]++;
    else cefrCounts.unknown++;
  });

  const avgResponseTime = summary.globalRtCount > 0 ? Math.round(summary.globalRtSum / summary.globalRtCount) : 0;
  const totalSessions = sessions ? sessions.length : 0;
  const totalStudyMs = sessions && sessions.length > 0 ? sessions.reduce((sum, s) => sum + (s.endTime - s.startTime), 0) : summary.globalRtSum;
  const studyTimeMin = Math.round(totalStudyMs / 1000 / 60);

  // Generate data fingerprint hash. If this changes, cache is invalidated.
  const statsHash = `${words.length}-${cardStates.newCount}-${cardStates.learningCount}-${cardStates.matureCount}-${cardStates.masteredCount}-${summary.totalReviews}-${retentionRate}-${streak.current || 0}-${streak.max || 0}-${leeches.join(',')}-${summary.globalSandboxChecks}-${avgResponseTime}-${totalSessions}-${studyTimeMin}`;

  // Binding listeners for generate and refresh buttons
  bindActionListeners(words, streak, summary, cardStates, sessions, statsHash);

  // Check cache first
  try {
    const cachedData = await chrome.storage.local.get([CACHE_KEY, CACHE_TIME_KEY, 'spelt_stats_ai_insights_hash']);
    const cachedTime = cachedData[CACHE_TIME_KEY] || 0;
    const cachedHash = cachedData['spelt_stats_ai_insights_hash'] || '';
    
    // We only use the cache if it exists.
    // If the cache exists and the hash matches, display it immediately and show refresh button.
    // If the cache exists but the hash does NOT match, we STILL display it immediately (so the UI is not empty),
    // but we can animate the refresh button or show an active refresh state.
    if (cachedData[CACHE_KEY]) {
      const parsed = typeof cachedData[CACHE_KEY] === 'string' ? JSON.parse(cachedData[CACHE_KEY]) : cachedData[CACHE_KEY];
      distributeInsights(parsed);
      
      const refreshBtn = document.getElementById('stats-ai-refresh-btn');
      if (refreshBtn) {
        refreshBtn.style.display = 'inline-flex';
        if (cachedHash !== statsHash) {
          // Visual indicator of stale data (glow or title tip)
          refreshBtn.style.boxShadow = '0 0 10px var(--primary-glow)';
          refreshBtn.title = 'Stats changed since last analysis. Click to update AI Insights!';
        } else {
          refreshBtn.style.boxShadow = 'none';
          refreshBtn.title = 'Refresh AI Coach Insights';
        }
      }
      return;
    }
  } catch (_) {}

  // If no cache at all, show the Generate placeholder
  panel.style.display = 'block';
  showGeneratePlaceholder();
}

function showGeneratePlaceholder() {
  const contentEl = document.getElementById('stats-ai-insights-content');
  if (contentEl) {
    contentEl.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 10px 0;">
        <p style="margin: 0; font-size: 0.68rem; color: var(--text-muted);">Get personalized coaching tips and subtab analysis powered by Gemini AI.</p>
        <button type="button" id="stats-ai-generate-btn" class="submit-btn" style="width: auto; font-size: 0.68rem; padding: 5px 12px; border-radius: var(--radius-md); background: hsla(260, 60%, 50%, 0.2); border: 1px solid hsla(260, 60%, 65%, 0.4); color: #c4b5fd; cursor: pointer;">
          ✨ Generate AI Insights
        </button>
      </div>
    `;
  }
  const refreshBtn = document.getElementById('stats-ai-refresh-btn');
  if (refreshBtn) refreshBtn.style.display = 'none';
  
  hideSubtabPanels();
}

function bindActionListeners(words, streak, summary, cardStates, sessions, statsHash) {
  const panel = document.getElementById('stats-ai-insights-panel');
  if (!panel) return;

  // We bind once using event delegation
  if (!listenersBound) {
    panel.addEventListener('click', async (e) => {
      const genBtn = e.target.closest('#stats-ai-generate-btn');
      const refBtn = e.target.closest('#stats-ai-refresh-btn');
      if (genBtn || refBtn) {
        e.preventDefault();
        e.stopPropagation();
        await triggerInsightsGeneration(words, streak, summary, cardStates, sessions, statsHash);
      }
    });
    listenersBound = true;
  }
}

async function triggerInsightsGeneration(words, streak, summary, cardStates, sessions, statsHash) {
  const panel = document.getElementById('stats-ai-insights-panel');
  const contentEl = document.getElementById('stats-ai-insights-content');
  const refreshBtn = document.getElementById('stats-ai-refresh-btn');
  if (!panel || !contentEl) return;

  // Set loading states
  contentEl.textContent = 'Generating custom learning insights...';
  if (refreshBtn) {
    refreshBtn.style.display = 'inline-flex';
    refreshBtn.disabled = true;
    const svg = refreshBtn.querySelector('svg');
    if (svg) {
      svg.style.animation = 'spin 1.5s linear infinite';
    }
  }
  showSubtabLoading();

  try {
    const retentionRate = summary.totalReviews > 0 ? Math.round((summary.correctReviews / summary.totalReviews) * 100) : 0;
    
    // Get leeches
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
    const leeches = Array.from(uniqueLeechesMap.values())
      .sort((a, b) => (b.totalErrors || (b.misspellings || []).length) - (a.totalErrors || (a.misspellings || []).length))
      .slice(0, 5)
      .map(w => `${w.word} (${w.totalErrors || (w.misspellings || []).length} errors)`);

    // CEFR levels count
    const cefrCounts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, unknown: 0 };
    words.forEach(w => {
      const level = w.level ? w.level.toUpperCase() : 'unknown';
      if (cefrCounts[level] !== undefined) cefrCounts[level]++;
      else cefrCounts.unknown++;
    });

    const avgResponseTime = summary.globalRtCount > 0 ? Math.round(summary.globalRtSum / summary.globalRtCount) : 0;
    const totalSessions = sessions ? sessions.length : 0;
    const totalStudyMs = sessions && sessions.length > 0 ? sessions.reduce((sum, s) => sum + (s.endTime - s.startTime), 0) : summary.globalRtSum;
    const studyTimeMin = Math.round(totalStudyMs / 1000 / 60);

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

    const prompt = `You are an expert language learning coach analyzing a student's spelling and vocabulary practice stats.
Here are their performance statistics:
${statsSummary}

Generate a JSON object containing personalized, highly actionable coaching tips.
The JSON object must have exactly these keys:
{
  "overview": "An HTML unordered list (<ul>) with 3-4 <li> elements containing high-impact bullet points of coaching insights. Focus on major themes. Keep the bullet points clean and use inline tags like <strong> and <em> for emphasis.",
  "vocabulary": "A 1-2 sentence recommendation/insight for the student's vocabulary growth (analyzing CEFR distribution, learning velocity, and leeches). You can use <strong> and <em> for styling.",
  "activity": "A 1-2 sentence recommendation/insight for building review consistency and routine (analyzing their streak, activity, and sessions). You can use <strong> and <em> for styling.",
  "performance": "A 1-2 sentence recommendation/insight for improving speed and accuracy (analyzing response times and study metrics). You can use <strong> and <em> for styling."
}

Return ONLY the raw JSON object. Do not wrap it in markdown formatting or code blocks.`;

    const dataObj = await askGemini(prompt);
    
    // Distribute results to subtab panels
    distributeInsights(dataObj);

    if (refreshBtn) {
      refreshBtn.style.display = 'inline-flex';
      refreshBtn.style.boxShadow = 'none';
      refreshBtn.title = 'Refresh AI Coach Insights';
    }

    // Cache the result
    try {
      await chrome.storage.local.set({
        [CACHE_KEY]: dataObj,
        [CACHE_TIME_KEY]: Date.now(),
        'spelt_stats_ai_insights_hash': statsHash
      });
    } catch (_) {}
  } catch (err) {
    console.error('[Spelt AI] Failed to load insights:', err);
    contentEl.innerHTML = `<span style="color: var(--danger);">Could not load AI Insights: ${err.message}</span>`;
    
    // If generation failed, fallback to show Generate button again after brief delay
    setTimeout(() => {
      showGeneratePlaceholder();
    }, 4000);
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      const svg = refreshBtn.querySelector('svg');
      if (svg) {
        svg.style.animation = 'none';
      }
    }
  }
}

function distributeInsights(dataObj) {
  if (!dataObj) return;

  // Overview
  if (dataObj.overview) {
    const el = document.getElementById('stats-ai-insights-content');
    if (el) el.innerHTML = dataObj.overview;
    const panel = document.getElementById('stats-ai-insights-panel');
    if (panel) panel.style.display = 'block';
  }

  // Vocabulary
  const vocabPanel = document.getElementById('stats-ai-vocab-panel');
  const vocabContent = document.getElementById('stats-ai-vocab-content');
  if (vocabPanel && vocabContent && dataObj.vocabulary) {
    vocabContent.innerHTML = dataObj.vocabulary;
    vocabPanel.style.display = 'block';
  } else if (vocabPanel) {
    vocabPanel.style.display = 'none';
  }

  // Activity
  const actPanel = document.getElementById('stats-ai-activity-panel');
  const actContent = document.getElementById('stats-ai-activity-content');
  if (actPanel && actContent && dataObj.activity) {
    actContent.innerHTML = dataObj.activity;
    actPanel.style.display = 'block';
  } else if (actPanel) {
    actPanel.style.display = 'none';
  }

  // Performance
  const perfPanel = document.getElementById('stats-ai-perf-panel');
  const perfContent = document.getElementById('stats-ai-perf-content');
  if (perfPanel && perfContent && dataObj.performance) {
    perfContent.innerHTML = dataObj.performance;
    perfPanel.style.display = 'block';
  } else if (perfPanel) {
    perfPanel.style.display = 'none';
  }
}

function showSubtabLoading() {
  const vocabPanel = document.getElementById('stats-ai-vocab-panel');
  const vocabContent = document.getElementById('stats-ai-vocab-content');
  if (vocabPanel && vocabContent) {
    vocabContent.textContent = 'Analyzing vocabulary distribution...';
    vocabPanel.style.display = 'block';
  }
  
  const actPanel = document.getElementById('stats-ai-activity-panel');
  const actContent = document.getElementById('stats-ai-activity-content');
  if (actPanel && actContent) {
    actContent.textContent = 'Analyzing consistency patterns...';
    actPanel.style.display = 'block';
  }

  const perfPanel = document.getElementById('stats-ai-perf-panel');
  const perfContent = document.getElementById('stats-ai-perf-content');
  if (perfPanel && perfContent) {
    perfContent.textContent = 'Analyzing response speed...';
    perfPanel.style.display = 'block';
  }
}

function hideSubtabPanels() {
  const vocabPanel = document.getElementById('stats-ai-vocab-panel');
  if (vocabPanel) vocabPanel.style.display = 'none';
  
  const actPanel = document.getElementById('stats-ai-activity-panel');
  if (actPanel) actPanel.style.display = 'none';

  const perfPanel = document.getElementById('stats-ai-perf-panel');
  if (perfPanel) perfPanel.style.display = 'none';
}
