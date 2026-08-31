/**
 * Fast tooltip engine.
 * Replaces delayed browser tooltips with an immediate, consistently styled hint.
 */

let tooltipEl = null;
let hoverTimer = null;
let currentTarget = null;
const HOVER_DELAY_MS = 100; // Instant response (100ms hover delay)

export function initTooltips() {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'custom-glass-tooltip';
    document.body.appendChild(tooltipEl);
  }

  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('click', hideTooltip, true);
  window.addEventListener('scroll', hideTooltip, true);
}

function handleMouseOver(e) {
  const target = e.target.closest('[data-tooltip], [title]');
  if (!target) return;

  // Move title to data-tooltip to suppress ugly slow OS browser tooltips
  if (target.hasAttribute('title')) {
    const text = target.getAttribute('title');
    if (text) {
      target.setAttribute('data-tooltip', text);
    }
    target.removeAttribute('title');
  }

  const tooltipText = target.getAttribute('data-tooltip');
  if (!tooltipText) return;

  if (currentTarget === target) return;
  currentTarget = target;

  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    if (currentTarget === target) {
      showTooltip(target, tooltipText);
    }
  }, HOVER_DELAY_MS);
}

function handleMouseOut(e) {
  if (!currentTarget) return;
  const related = e.relatedTarget;
  if (related && currentTarget.contains(related)) return;

  clearTimeout(hoverTimer);
  hideTooltip();
  currentTarget = null;
}

function showTooltip(target, text) {
  if (!tooltipEl) return;

  tooltipEl.textContent = text;
  tooltipEl.classList.add('visible');

  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();

  // Position above by default; fallback to below
  let top = rect.top - tooltipRect.height - 8;
  if (top < 6) {
    top = rect.bottom + 8;
  }

  // Center horizontally relative to element
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

  const padding = 8;
  if (left < padding) left = padding;
  if (left + tooltipRect.width > window.innerWidth - padding) {
    left = window.innerWidth - tooltipRect.width - padding;
  }

  tooltipEl.style.top = `${Math.round(top)}px`;
  tooltipEl.style.left = `${Math.round(left)}px`;
}

function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.classList.remove('visible');
  }
}
