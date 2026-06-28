export function initCustomSelects() {
  const wrappers = document.querySelectorAll('.custom-select-wrapper');
  wrappers.forEach(wrapper => {
    const trigger = wrapper.querySelector('.custom-select-trigger');
    const label = trigger.querySelector('span');
    const options = wrapper.querySelectorAll('.custom-option');
    const hiddenSelect = wrapper.querySelector('select');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-select-wrapper').forEach(other => {
        if (other !== wrapper) other.classList.remove('open');
      });
      wrapper.classList.toggle('open');
    });

    options.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.getAttribute('data-value');
        label.textContent = opt.textContent;
        hiddenSelect.value = val;
        options.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        wrapper.classList.remove('open');
        hiddenSelect.dispatchEvent(new Event('change'));
      });
    });
  });

  document.addEventListener('click', () => {
    wrappers.forEach(w => w.classList.remove('open'));
  });
}
