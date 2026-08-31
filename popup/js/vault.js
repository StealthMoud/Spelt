import { getWords, getStored, isGeminiConfigured, atomicUpdate } from '../../shared/storage.js';
import { AI_JOB_ACTIVE_STATES, AI_JOB_KINDS } from '../../src/core/ai_jobs.js';
import {
  cancelAiJob,
  getAiJobStatus,
  startAiJob,
  subscribeToAiJob
} from './components/ai_job_client.js';
import { showConfirm, showImportOptionsModal } from './vault/confirm.js';
import { openModal, closeModal, currentFormMisspellings, renderPastErrorsList, setCurrentFormMisspellings } from './vault/modal.js';
import { saveWord } from './vault/save.js';
import { renderList, updateBulkUIState } from './vault/list.js';
import { getFilteredWords } from './vault/filter.js';
import { registerAutofillListeners } from './vault/autofill.js';
import { registerAudioListeners } from './vault/audio_listeners.js';
let wordsList = [];
let onVaultUpdatedCallback = null;
let selectedWordIds = new Set();
let currentAiJob = null;
export { showConfirm, openModal, showImportOptionsModal };

function renderAiJob(job) {
  const panel = document.getElementById('vault-ai-job');
  const title = document.getElementById('vault-ai-job-title');
  const status = document.getElementById('vault-ai-job-status');
  const progressEl = document.getElementById('vault-ai-job-progress');
  const cancelBtn = document.getElementById('vault-ai-job-cancel');
  if (!panel || !title || !status || !progressEl || !cancelBtn) return;

  currentAiJob = job || null;
  if (!job) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  progressEl.value = job.percent || 0;
  progressEl.textContent = `${job.percent || 0}%`;
  const isActive = AI_JOB_ACTIVE_STATES.has(job.status);
  cancelBtn.classList.toggle('hidden', !isActive);
  cancelBtn.disabled = job.status === 'cancelling';

  if (job.status === 'completed') {
    title.textContent = 'Enrichment complete';
    status.textContent = `${job.succeeded} updated${job.failed ? ` · ${job.failed} failed` : ''}`;
  } else if (job.status === 'cancelled') {
    title.textContent = 'Enrichment cancelled';
    status.textContent = `${job.completed} of ${job.total} processed`;
  } else if (job.status === 'failed') {
    title.textContent = 'Enrichment stopped';
    status.textContent = job.failures?.at(-1)?.message || 'The background task failed.';
  } else if (job.status === 'cancelling') {
    title.textContent = 'Stopping enrichment';
    status.textContent = `Finishing the current request · ${job.completed} of ${job.total}`;
  } else {
    title.textContent = job.status === 'queued' ? 'Preparing enrichment' : 'Enriching vocabulary';
    const lastWord = job.currentWord ? ` · Last: ${job.currentWord}` : '';
    status.textContent = `${job.completed} of ${job.total} processed${lastWord}`;
  }
}

async function refreshAiJob() {
  try {
    renderAiJob(await getAiJobStatus());
  } catch {
    renderAiJob(null);
  }
}

async function startEnrichmentJob(kind, wordIds = []) {
  const targetLang = await getStored('spelt_target_lang');
  renderAiJob(await startAiJob({ kind, wordIds, targetLang }));
}

export async function initVault(onVaultUpdated) {
  onVaultUpdatedCallback = onVaultUpdated;

  document.getElementById('add-word-btn').addEventListener('click', () => openModal());
  document.getElementById('form-cancel-btn').addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation(); closeModal();
  });
  document.getElementById('word-entry-form').addEventListener('submit', (e) => 
    saveWord(e, currentFormMisspellings, reloadVaultList, onVaultUpdatedCallback)
  );

  document.getElementById('form-past-errors-list')?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-error-x');
    if (deleteBtn) {
      const chip = deleteBtn.closest('.error-trash-chip');
      if (chip) {
        setCurrentFormMisspellings(currentFormMisspellings.filter(x => x !== chip.getAttribute('data-error')));
        renderPastErrorsList();
      }
    }
  });

  registerAutofillListeners();
  registerAudioListeners();

  let searchDebounceTimeout = null;
  const onSearchChange = () => {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      selectedWordIds.clear();
      renderList(wordsList, selectedWordIds, openModal, deleteWord);
    }, 150);
  };
  document.getElementById('vault-search').addEventListener('input', onSearchChange);
  document.getElementById('vault-filter-status')?.addEventListener('change', onSearchChange);
  document.getElementById('vault-sort-field')?.addEventListener('change', onSearchChange);

  document.getElementById('vault-sort-dir-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('vault-sort-dir-btn');
    const next = btn.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc';
    btn.setAttribute('data-dir', next);
    document.getElementById('sort-dir-label').textContent = next.toUpperCase();
    onSearchChange();
  });

  document.getElementById('vault-select-all')?.addEventListener('change', (e) => {
    const filtered = getFilteredWords(wordsList);
    if (e.target.checked) filtered.forEach(w => selectedWordIds.add(w.id));
    else filtered.forEach(w => selectedWordIds.delete(w.id));
    updateBulkUIState(filtered, selectedWordIds);
  });

  document.getElementById('vault-ai-job-cancel')?.addEventListener('click', async () => {
    if (!currentAiJob || !AI_JOB_ACTIVE_STATES.has(currentAiJob.status)) return;
    try {
      renderAiJob(await cancelAiJob(currentAiJob.id));
    } catch (err) {
      showConfirm('Could not cancel enrichment', err.message, null, false);
    }
  });

  document.getElementById('vault-ai-job-dismiss')?.addEventListener('click', () => {
    document.getElementById('vault-ai-job')?.classList.add('hidden');
  });

  subscribeToAiJob(job => {
    renderAiJob(job);
    if (job?.status === 'completed' || job?.status === 'cancelled') {
      reloadVaultList().then(() => onVaultUpdatedCallback?.()).catch(console.error);
    }
  });

  document.getElementById('vault-delete-selected')?.addEventListener('click', () => {
    if (selectedWordIds.size === 0) return;
    showConfirm('Delete Selected', `Delete all ${selectedWordIds.size} selected words?`, async () => {
      await atomicUpdate(async (freshList) => {
        // Remove selected words in-place by splicing from end to start
        for (let i = freshList.length - 1; i >= 0; i--) {
          if (selectedWordIds.has(freshList[i].id)) freshList.splice(i, 1);
        }
      });
      selectedWordIds.clear();
      await reloadVaultList();
      if (onVaultUpdatedCallback) onVaultUpdatedCallback();
    });
  });

  document.getElementById('vault-demaster-selected')?.addEventListener('click', () => {
    if (selectedWordIds.size === 0) return;
    showConfirm('Re-study Selected', `Move all ${selectedWordIds.size} selected words back into practice?`, async () => {
      await atomicUpdate(async (freshList) => {
        freshList.forEach(w => {
          if (selectedWordIds.has(w.id)) {
            w.mastered = false; w.rep = 0; w.interval = 1; w.nextDate = Date.now();
          }
        });
      });
      selectedWordIds.clear();
      await reloadVaultList();
      if (onVaultUpdatedCallback) onVaultUpdatedCallback();
    });
  });

  document.getElementById('vault-enrich-selected')?.addEventListener('click', async () => {
    if (selectedWordIds.size === 0) return;
    
    const isConfigured = await isGeminiConfigured();
    if (!isConfigured) {
      showConfirm('API Key Required', 'Please configure your Gemini API Key in the Settings tab.', null, false);
      return;
    }

    showConfirm('Enrich selected words', `Update definitions, translations, parts of speech, and examples for ${selectedWordIds.size} selected words? The task will continue if you close this window.`, async () => {
      const idsToEnrich = Array.from(selectedWordIds);
      try {
        await startEnrichmentJob(AI_JOB_KINDS.ENRICH_SELECTED, idsToEnrich);
        selectedWordIds.clear();
        await reloadVaultList();
      } catch (err) {
        showConfirm('Could not start enrichment', err.message, null, false);
      }
    });
  });

  await refreshAiJob();
  await reloadVaultList();
}

export async function reloadVaultList() {
  wordsList = await getWords();
  const existingIds = new Set(wordsList.map(w => w.id));
  for (const id of selectedWordIds) {
    if (!existingIds.has(id)) {
      selectedWordIds.delete(id);
    }
  }
  renderList(wordsList, selectedWordIds, openModal, deleteWord);
}

function deleteWord(wordObj) {
  showConfirm('Delete Word', `Delete "${wordObj.word}" from your vault?`, async () => {
    await atomicUpdate(async (freshList) => {
      const idx = freshList.findIndex(w => w.id === wordObj.id);
      if (idx !== -1) freshList.splice(idx, 1);
    });
    await reloadVaultList();
    if (onVaultUpdatedCallback) onVaultUpdatedCallback();
  });
}
