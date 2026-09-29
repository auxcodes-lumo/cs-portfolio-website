/* resume.js — gate validation + print/light flow (resume.html only) */
(() => {
  'use strict';
  const gate = document.getElementById('gate');
  const body = document.getElementById('resume-body');

  const showGate = (text) => {
    if (body) body.hidden = true;
    if (gate) {
      gate.hidden = false;
      const msg = document.getElementById('gate-msg');
      if (msg && text) msg.textContent = text;
    }
  };

  const init = async () => {
    const token = new URLSearchParams(location.search).get('t');
    if (!token) {
      showGate('no token found. enter your email on the home page to get a one-time link.');
      return;
    }
    try {
      const res = await fetch('/api/resume/validate?token=' + encodeURIComponent(token));
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'access failed (' + res.status + ')');
      if (gate) gate.hidden = true;
      if (body) body.hidden = false;
      const vl = document.getElementById('views-left');
      if (vl && data.viewsLeft != null) vl.textContent = `$ quota --check → ${data.viewsLeft} view(s) remaining`;
    } catch (err) {
      showGate('access denied: ' + err.message);
    }
  };

  /* ---- print flow: choose dark (brand) or light (b&w) ---- */
  const modal = document.getElementById('print-modal');
  const doPrint = (light) => {
    document.body.classList.toggle('print-light', !!light);
    if (modal && modal.open) modal.close();
    window.print();
  };
  const pb = document.getElementById('print-btn');
  if (pb) pb.addEventListener('click', () => { if (modal) modal.showModal(); });
  const wire = (id, light) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => doPrint(light));
  };
  wire('print-dark', false);
  wire('print-light', true);
  const cancel = document.getElementById('print-cancel');
  if (cancel) cancel.addEventListener('click', () => { if (modal) modal.close(); });
  window.addEventListener('afterprint', () => document.body.classList.remove('print-light'));

  init();
})();
