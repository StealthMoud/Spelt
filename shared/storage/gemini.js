import { getStored } from './core.js';

/**
 * Returns true if the user has configured a Gemini API key.
 */
export async function isGeminiConfigured() {
  const key = await getStored('spelt_gemini_key');
  return !!key;
}

/**
 * Sends a prompt to Google Gemini API and returns the parsed JSON response.
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

  let response;
  let useMimeType = true;

  try {
    response = await fetch(url, {
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
      const errMsg = errData.error?.message || '';
      if (errMsg.includes('responseMimeType') || errMsg.includes('response_mime_type') || errMsg.includes('responseMime')) {
        useMimeType = false;
      } else {
        throw new Error(errMsg || `Gemini API returned status ${response.status}`);
      }
    }
  } catch (err) {
    if (err.message.includes('responseMimeType') || err.message.includes('response_mime_type')) {
      useMimeType = false;
    } else {
      throw err;
    }
  }

  if (!useMimeType) {
    // Retry without generationConfig responseMimeType
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt + "\n\nRespond ONLY with a valid JSON block starting with { and ending with }." }] }]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API retry returned status ${response.status}`);
    }
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Invalid empty response from Gemini API.');
  }

  // Clean text in case model returned markdown code blocks (e.g. ```json ... ```)
  text = text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\n?/, '');
    text = text.replace(/\n?```$/, '');
    text = text.trim();
  }

  // Extract first { and last } if there are prefix/suffix texts
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1) {
    text = text.substring(startIdx, endIdx + 1);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse Gemini response as JSON:', text);
    throw new Error('Gemini response was not valid JSON. Please try again.');
  }
}

/**
 * Sends a prompt to Gemini and returns raw text (not JSON).
 * Used for free-form responses like hints, mnemonics, and feedback.
 */
export async function askGeminiText(prompt) {
  const key = await getStored('spelt_gemini_key');
  if (!key) {
    throw new Error('Gemini API key is not configured. Please add your key in the Settings tab.');
  }

  const model = await getStored('spelt_gemini_model') || 'models/gemini-1.5-flash';
  const cleanModel = model.startsWith('models/') ? model : 'models/' + model;
  const url = `https://generativelanguage.googleapis.com/v1/${cleanModel}:generateContent?key=${key}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gemini API returned status ${response.status}`);
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Invalid empty response from Gemini API.');
  }

  return text.trim();
}
