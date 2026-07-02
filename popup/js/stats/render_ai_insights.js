import { isGeminiConfigured, askGeminiText } from '../../../shared/storage.js';

const CACHE_KEY = 'spelt_stats_ai_insights';
const CACHE_TIME_KEY = 'spelt_stats_ai_insights_timestamp';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function renderAIInsights(words, streak, summary, cardStates) {
  const panel = document.getElementById('stats-ai-insights-panel');
  const contentEl = document.getElementById('stats-ai-insights-content');
  if (!panel || !contentEl) return;

  const isConfigured = await isGeminiConfigured();
  if (!isConfigured || words.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  // Check cache first
  try {
    const cachedData = await chrome.storage.local.get([CACHE_KEY, CACHE_TIME_KEY]);
    const cachedTime = cachedData[CACHE_TIME_KEY] || 0;
    if (cachedData[CACHE_KEY] && (Date.now() - cachedTime < CACHE_TTL_MS)) {
      contentEl.innerHTML = cachedData[CACHE_KEY];
      return;
    }
  } catch (_) {}

  contentEl.textContent = 'Generating custom learning insights...';

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

    const statsSummary = `
- Total words in library: ${words.length}
- Card Distribution: New: ${cardStates.newCount}, Learning: ${cardStates.learningCount}, Mature: ${cardStates.matureCount}, Mastered: ${cardStates.masteredCount}
- All-time Reviews: ${summary.totalReviews}
- SRS Retention Rate: ${retentionRate}%
- Current Streak: ${streak.current || 0} days (best: ${streak.max || 0} days)
- Top 5 Leech Words: ${leeches.join(', ') || 'None'}
- CEFR Distribution: A1/A2 (Beginner): ${cefrCounts.A1 + cefrCounts.A2}, B1/B2 (Intermediate): ${cefrCounts.B1 + cefrCounts.B2}, C1/C2 (Advanced): ${cefrCounts.C1 + cefrCounts.C2}
- Sandbox activity check success rate: ${summary.globalSandboxChecks > 0 ? Math.round((summary.globalSandboxCorrect / summary.globalSandboxChecks) * 100) : 0}%
    `;

    const prompt = `You are an expert language coach analyzing a student's spelling and vocabulary practice stats.
Here are their performance statistics:
${statsSummary}

Generate 3-4 bullet points of high-impact, personalized, actionable insights or coaching tips for the student.
Rules:
1. Target specific weaknesses (e.g. low retention, high count of leeches, low mature/mastered count, slow learning speed, streak momentum).
2. Suggest study methods (e.g. "Focus on practice mode with your top leeches", "A high percentage of your vocabulary is at A1 level, try adding B2/C1 IELTS target words").
3. Use a warm, professional, encouraging coach persona.
4. Return ONLY a valid HTML unordered list (<ul>) containing the <li> points. Do NOT wrap in markdown code block characters (\`\`\`). Keep HTML clean, short, and use inline style colored badges for emphasis where appropriate.`;

    const insights = await askGeminiText(prompt);

    // Parse and sanitize wrapping blocks if any
    let cleanInsights = insights.trim();
    if (cleanInsights.startsWith('```')) {
      cleanInsights = cleanInsights.replace(/^```[a-zA-Z]*\n?/, '');
      cleanInsights = cleanInsights.replace(/\n?```$/, '');
      cleanInsights = cleanInsights.trim();
    }

    contentEl.innerHTML = cleanInsights;

    // Cache the result
    try {
      await chrome.storage.local.set({
        [CACHE_KEY]: cleanInsights,
        [CACHE_TIME_KEY]: Date.now()
      });
    } catch (_) {}
  } catch (err) {
    contentEl.textContent = `Could not load AI Insights: ${err.message}`;
  }
}
