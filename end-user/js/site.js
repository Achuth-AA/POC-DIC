// Page-level helpers: text size, high contrast, and buttons that open the assistant.
(function () {
  const root = document.documentElement;
  let scale = 1;

  document.querySelectorAll('[data-font]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = Number(btn.dataset.font);
      scale = step === 0 ? 1 : Math.min(1.3, Math.max(0.85, scale + step * 0.1));
      root.style.setProperty('--font-scale', scale.toFixed(2));
    });
  });

  const contrast = document.getElementById('contrastToggle');
  contrast.addEventListener('click', () => {
    const on = document.body.classList.toggle('high-contrast');
    contrast.setAttribute('aria-pressed', String(on));
  });

  // The page itself is English-only in the demo; the Hindi toggle opens the assistant in Hindi.
  document.getElementById('langToggle').addEventListener('click', () => {
    window.TNAssistant && window.TNAssistant.open({ language: 'hi' });
  });

  document.querySelectorAll('[data-assistant]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (!window.TNAssistant) return;
      const text = el.dataset.assistant;
      window.TNAssistant.open(text ? { ask: text } : {});
    });
  });
})();
