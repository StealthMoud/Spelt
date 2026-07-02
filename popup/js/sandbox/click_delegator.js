import { playWordAudio, getWords, saveWords } from '../../../shared/storage.js';
import { handleManualCorrection } from './manual_correct.js';
import { showManualCorrectionForm } from './manual_form.js';
import { acceptSuggestion } from './accept.js';
import { saveManualAnyway, handleAddToVault } from './save_actions.js';
import { renderMisspellingCard } from './misspell_card.js';
import { handleExampleActions } from './example_actions.js';
import { openModal } from '../vault.js';
import { handleAiEnhance } from './correct_card.js';

export async function handleFeedbackClick(e, reloadVaultList, loadPracticeDeck) {
  const feedbackMsg = document.getElementById('feedback-msg');
  if (!feedbackMsg) return;

  const editBtn = e.target.closest('.sandbox-edit-btn');
  if (editBtn) {
    const wordText = editBtn.getAttribute('data-word');
    const words = await getWords();
    const existing = words.find(w => w.word.toLowerCase() === wordText.toLowerCase());
    if (existing) {
      openModal(existing);
    } else {
      const tempWordObj = {
        word: wordText,
        definition: editBtn.getAttribute('data-definition') || '',
        transcription: editBtn.getAttribute('data-transcription') || '',
        partOfSpeech: editBtn.getAttribute('data-part-of-speech') || '',
        example: editBtn.getAttribute('data-example') || '',
        translation: editBtn.getAttribute('data-translation') || '',
        level: editBtn.getAttribute('data-level') || '',
        practiceType: 'spelling',
        mastered: false,
        misspellings: []
      };
      openModal(tempWordObj);
    }
    return;
  }

  const closeBtn = e.target.closest('.feedback-close-btn');
  if (closeBtn) { feedbackMsg.style.display = 'none'; return; }

  const playBtn = e.target.closest('.audio-play-btn');
  if (playBtn) {
    const word = playBtn.getAttribute('data-word');
    const accent = playBtn.getAttribute('data-accent');
    if (word && accent) playWordAudio(word, accent).catch(() => {});
    return;
  }

  const acceptBtn = e.target.closest('.accept-suggestion-btn');
  if (acceptBtn) {
    await acceptSuggestion(acceptBtn.getAttribute('data-suggestion'), acceptBtn.getAttribute('data-original'), reloadVaultList, loadPracticeDeck);
    return;
  }

  const rejectBtn = e.target.closest('.reject-suggestion-btn');
  if (rejectBtn) {
    await showManualCorrectionForm(rejectBtn.getAttribute('data-original')); return;
  }

  const chip = e.target.closest('.alt-suggestion-chip');
  if (chip) {
    await renderMisspellingCard(feedbackMsg.getAttribute('data-original-query'), JSON.parse(feedbackMsg.getAttribute('data-suggestions-list')), parseInt(chip.getAttribute('data-index'), 10));
    return;
  }

  const manualChip = e.target.closest('.manual-suggest-chip');
  if (manualChip) {
    const input = document.getElementById('manual-correction-input');
    if (input) { input.value = manualChip.getAttribute('data-word'); input.focus(); }
    return;
  }

  const saveBtn = e.target.closest('#manual-correction-btn');
  if (saveBtn) {
    const correctVal = document.getElementById('manual-correction-input')?.value.trim();
    const originalVal = saveBtn.getAttribute('data-original-word');
    const wrongVal = saveBtn.getAttribute('data-wrong-attempt') || '';
    if (correctVal && originalVal) await handleManualCorrection(correctVal, originalVal, wrongVal, reloadVaultList, loadPracticeDeck);
    return;
  }

  const acceptAnywayBtn = e.target.closest('.accept-anyway-btn');
  if (acceptAnywayBtn) {
    const correct = feedbackMsg.getAttribute('data-correct-word');
    const original = feedbackMsg.getAttribute('data-original-word');
    const wrong = feedbackMsg.getAttribute('data-wrong-attempt');
    if (correct && original) await saveManualAnyway(correct, original, wrong, reloadVaultList, loadPracticeDeck);
    return;
  }

  const editCorrectionBtn = e.target.closest('.edit-correction-btn');
  if (editCorrectionBtn) {
    const original = feedbackMsg.getAttribute('data-original-word');
    const suggestions = JSON.parse(feedbackMsg.getAttribute('data-suggestions-list') || '[]');
    const wrong = feedbackMsg.getAttribute('data-wrong-attempt');
    if (original) await showManualCorrectionForm(original, suggestions, wrong);
    return;
  }

  const aiEnhanceBtn = e.target.closest('.sandbox-ai-enhance-btn');
  if (aiEnhanceBtn) {
    await handleAiEnhance(aiEnhanceBtn, reloadVaultList);
    return;
  }

  const addToVaultBtn = e.target.closest('.add-to-vault-btn');
  if (addToVaultBtn) {
    await handleAddToVault(addToVaultBtn, reloadVaultList, loadPracticeDeck); return;
  }

  const playExBtn = e.target.closest('.play-example-btn');
  const translateBtn = e.target.closest('.translate-example-btn');
  if (playExBtn || translateBtn) {
    await handleExampleActions(e);
    return;
  }
}
