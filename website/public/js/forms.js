/* forms.js — contact form: honeypot, cooldown, terminal-style status */
(() => {
  'use strict';
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = document.getElementById('c-status');
  const submitBtn = form.querySelector('[type=submit]');
  let cooldownUntil = 0;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now < cooldownUntil) {
      if (status) status.textContent = `▲ too fast — try again in ${Math.ceil((cooldownUntil - now) / 1000)}s`;
      return;
    }
    const fd = new FormData(form);
    if (status) status.textContent = '$ sending…';
    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), message: fd.get('message'), website: fd.get('website') }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'request failed (' + res.status + ')');
      if (status) status.textContent = '$ message received — talk soon.';
      form.reset();
      cooldownUntil = now + 30 * 1000;
    } catch (err) {
      if (status) status.textContent = '▲ ' + err.message;
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
