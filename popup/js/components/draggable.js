/**
 * Make an absolute positioned element draggable within the card face limits
 * Caches parent/element rects on drag start.
 */
export function makeElementDraggable(el) {
  let startX = 0, startY = 0;
  let currentLeft = 0, currentTop = 0;
  
  // Cached dimensions to avoid layout thrashing in mousemove loop
  let parentWidth = 0, parentHeight = 0;
  let rectWidth = 0, rectHeight = 0;

  el.addEventListener('mousedown', dragMouseDown);
  el.addEventListener('touchstart', dragTouchStart, { passive: false });

  function dragMouseDown(e) {
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    // Prevent dragging when targeting selectable AI text
    if (e.target.closest('#ai-feedback-text') || 
        e.target.closest('#ai-hint-text') || 
        e.target.closest('#back-ai-hint-text') || 
        e.target.closest('#ai-practice-writing-feedback-content')) {
      return;
    }
    e.preventDefault();
    
    startX = e.clientX;
    startY = e.clientY;
    currentLeft = el.offsetLeft;
    currentTop = el.offsetTop;
    
    // Cache dimensions once on start of drag
    const parentRect = el.parentElement.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    parentWidth = parentRect.width;
    parentHeight = parentRect.height;
    rectWidth = rect.width;
    rectHeight = rect.height;
    
    document.addEventListener('mouseup', closeDragElement);
    document.addEventListener('mousemove', elementDrag);
  }

  function elementDrag(e) {
    e.preventDefault();
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    updatePosition(currentLeft + deltaX, currentTop + deltaY);
  }

  function dragTouchStart(e) {
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    // Prevent dragging when targeting selectable AI text
    if (e.target.closest('#ai-feedback-text') || 
        e.target.closest('#ai-hint-text') || 
        e.target.closest('#back-ai-hint-text') || 
        e.target.closest('#ai-practice-writing-feedback-content')) {
      return;
    }
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    currentLeft = el.offsetLeft;
    currentTop = el.offsetTop;
    
    // Cache dimensions once on start of touch drag
    const parentRect = el.parentElement.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    parentWidth = parentRect.width;
    parentHeight = parentRect.height;
    rectWidth = rect.width;
    rectHeight = rect.height;
    
    document.addEventListener('touchend', closeDragElement);
    document.addEventListener('touchmove', elementTouchMove, { passive: false });
  }

  function elementTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    updatePosition(currentLeft + deltaX, currentTop + deltaY);
  }

  function updatePosition(newLeft, newTop) {
    const margin = 8;
    
    if (newLeft < margin) newLeft = margin;
    if (newLeft + rectWidth > parentWidth - margin) {
      newLeft = parentWidth - rectWidth - margin;
    }
    if (newTop < margin) newTop = margin;
    if (newTop + rectHeight > parentHeight - margin) {
      newTop = parentHeight - rectHeight - margin;
    }

    el.style.bottom = 'auto';
    el.style.right = 'auto';
    el.style.left = `${newLeft}px`;
    el.style.top = `${newTop}px`;
  }

  function closeDragElement() {
    document.removeEventListener('mouseup', closeDragElement);
    document.removeEventListener('mousemove', elementDrag);
    document.removeEventListener('touchend', closeDragElement);
    document.removeEventListener('touchmove', elementTouchMove);
  }
}
