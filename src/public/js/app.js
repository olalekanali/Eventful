// Global app utilities - kept tiny, no framework

(function () {
  // Copy-to-clipboard for share buttons
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy');
      try {
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => (btn.textContent = original), 1500);
      } catch {
        // Fallback - select a temporary element
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          btn.textContent = '✓ Copied';
        } catch {}
        ta.remove();
      }
    });
  });

  // Auto-dismiss flash messages after 5s
  document.querySelectorAll('.flash').forEach((flash) => {
    setTimeout(() => {
      flash.style.transition = 'opacity 0.3s ease';
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 300);
    }, 5000);
  });

  // Confirm-before-submit on .danger-form
  document.querySelectorAll('.danger-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (!confirm('Are you sure? This cannot be undone.')) {
        e.preventDefault();
      }
    });
  });
})();
