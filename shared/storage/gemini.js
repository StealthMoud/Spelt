import { getStored } from './core.js';

/**
 * Sends a prompt to Google Gemini API (gemini-1.5-flash) and returns the parsed JSON response.
 * Requires spelt_gemini_key to be set in chrome.storage.local.
 */
export async function askGemini(prompt) {
  const key = await getStored('spelt_gemini_key');
  if (!key) {
    throw new Error('Gemini API key is not configured. Please add your key in the Settings tab.');
  }

  const model = await getStored('spelt_gemini_model') || 'models/gemini-1.5-flash';
  const cleanModel = model.startsWith('models/') ? model : 'models/' + model;
  const url = `https://generativelanguage.googleapis.com/v1/${cleanModel}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gemini API returned status ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Invalid empty response from Gemini API.');
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse Gemini response as JSON:', text);
    throw new Error('Gemini response was not valid JSON.');
  }
}
