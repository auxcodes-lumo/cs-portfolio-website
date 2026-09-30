/* app.js — shared chrome: site data, boot typing, resume gate modal, footer */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FALLBACK = {
    name: 'YOUR.NAME',
    title: 'Cyber Security',
    tagline: 'cyber security · placeholder tagline (fill me in)',
    email: 'hello@pabanks.io',
    website: 'https://pabanks.io',
    github: 'github.com/your-handle',
    linkedin: 'linkedin.com/in/your-handle',
  };

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---- site data (single source of truth: /site.json) ---- */
  const applySite = (s) => {
    const site = { ...FALLBACK, ...s };
    window.SITE = site;
    // Hook for later-injected content (e.g. the server-fetched resume body).
    window.__applySite = applySite;
    $$('[data-name]').forEach((el) => { el.textContent = site.name; });
    $$('[data-title]').forEach((el) => { el.textContent = site.title; });
    $$('[data-github]').forEach((el) => { el.textContent = site.github; el.setAttribute('href', 'https://' + site.github); });
    const about = $('#about-body');
    if (about && Array.isArray(site.about)) {
      about.innerHTML = site.about.map((p) => `<p>${esc(p)}</p>`).join('');
    }
    if (location.pathname === '/' || location.pathname.endsWith('/index.html')) {
      document.title = `${site.name} — ${site.title} | pabanks.io`;
    }
  };

  const loadSite = async () => {
    try {
      const res = await fetch('/site.json', { cache: 'no-cache' });
      if (res.ok) applySite(await res.json());
    } catch {
      /* offline / file:// — keep fallback values in the markup */
    }
  };

  /* ---- boot sequence (skips typing under reduced motion) ---- */
  const lineSpan = (pair) => `<span class="${pair[1] || ''}">${esc(pair[0])}</span>\n`;
  const typeBoot = () => {
    const el = $('#boot');
    if (!el) return;
    const name = (window.SITE && window.SITE.name) || FALLBACK.name;
    const title = (window.SITE && window.SITE.title) || FALLBACK.title;
    const tagline = (window.SITE && window.SITE.tagline) || FALLBACK.tagline;
    const lines = [
      ['visitor@website:~$ ./boot.sh', ''],
      ['[ ok ] loading identity', 'dim'],
      ['[ ok ] loading skills', 'dim'],
      ['[ ok ] threat models: active', 'dim'],
      ['$ whoami', ''],
      [`${name} — ${title}`, ''],
      [tagline, 'dim'],
      ['$', ''],
    ];
    const finish = () => {
      el.innerHTML = lines.map(lineSpan).join('') + '<span class="cursor" aria-hidden="true"></span>';
    };
    if (REDUCED) { finish(); return; }
    let li = 0;
    let ci = 0;
    const tick = () => {
      if (li >= lines.length) { finish(); return; }
      ci += 1;
      let html = lines.slice(0, li).map(lineSpan).join('');
      html += `<span class="${lines[li][1] || ''}">${esc(lines[li][0].slice(0, ci))}</span>`;
      el.innerHTML = html + '<span class="cursor" aria-hidden="true"></span>';
      if (ci >= lines[li][0].length) { li += 1; ci = 0; }
      window.setTimeout(tick, 10 + Math.random() * 35);
    };
    tick();
  };

  /* ---- resume gate modal ---- */
  const wireResume = () => {
    const modal = $('#resume-modal');
    const form = $('#resume-form');
    if (!modal || !form) return;
    const status = $('#rm-status');
    const close = () => { if (modal.open) modal.close(); };
    $$('[data-resume-open]').forEach((b) =>
      b.addEventListener('click', () => {
        if (status) status.textContent = '';
        form.reset();
        modal.showModal();
        const em = $('#rm-email');
        if (em) em.focus();
      })
    );
    const cancel = $('#rm-close');
    if (cancel) cancel.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (status) status.textContent = '$ requesting token…';
      const fd = new FormData(form);
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: fd.get('email'), website: fd.get('website') }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok || !data.token) throw new Error(data.error || 'request failed (' + res.status + ')');
        if (status) status.textContent = '$ access granted — redirecting…';
        close();
        window.setTimeout(() => {
          window.location.href = '/resume.html?t=' + encodeURIComponent(data.token);
        }, REDUCED ? 0 : 350);
      } catch (err) {
        if (status) status.textContent = '▲ ' + err.message;
      }
    });
  };

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  const ready = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };
  ready(() => {
    wireResume();
    loadSite().then(typeBoot);
  });
})();
