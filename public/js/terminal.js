/* terminal.js — interactive terminal mode: keyboard-navigable, persisted, toggleable */
(() => {
  'use strict';

  const KEY = 'pb_terminal';
  const PROMPT = 'pa@pabanks:~$';
  let overlay = null;
  let out = null;
  let input = null;
  let active = false;
  let history = [];
  let histIndex = 0;
  const listeners = new Set();

  const SITE_FALLBACK = {
    name: 'YOUR.NAME',
    title: 'Cyber Security',
    email: 'hello@pabanks.io',
    website: 'https://pabanks.io',
    github: 'github.com/your-handle',
    linkedin: 'linkedin.com/in/your-handle',
  };
  let SITE = { ...SITE_FALLBACK };
  const loadSite = () =>
    fetch('/site.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s) SITE = { ...SITE, ...s }; })
      .catch(() => {});

  const write = (text) => {
    out.textContent += text + '\n';
    out.scrollTop = out.scrollHeight;
  };

  const HELP = [
    'commands:',
    '  help      show this list           (alias: --help, -h)',
    '  whoami    who i am',
    '  about     a little more detail',
    '  ls        what is on this site',
    '  contact   how to reach me',
    '  resume    resume access info',
    '  secret    …classified…',
    '  clear     clear the screen',
    '  exit      leave terminal mode      (alias: q, or press ESC)',
  ].join('\n');

  const commands = {
    help: () => write(HELP),
    '--help': () => write(HELP),
    '-h': () => write(HELP),
    whoami: () => write(SITE.name),
    about: () => write(`${SITE.name} — ${SITE.title}\nplaceholder bio: fill me in on the landing page at ${SITE.website}`),
    ls: () => write('index.html   contact.html   resume.html [locked: one-time token]   secret.html [???]'),
    contact: () => write(`mail    : ${SITE.email}\ngithub  : ${SITE.github}\nlinkedin: ${SITE.linkedin}`),
    resume: () => write(
      'resume access is one-time (24 h, 5 views). in a browser, press [ VIEW RESUME ]:\n  ' + SITE.website
    ),
    secret: () => {
      write('decryption complete — routing…');
      window.setTimeout(() => window.location.assign('/secret.html'), 400);
    },
    clear: () => { out.textContent = ''; },
    exit: () => deactivate(),
    q: () => deactivate(),
    date: () => write(new Date().toString()),
    sudo: () => write('permission denied: nice try.'),
  };

  const run = (line) => {
    write(PROMPT + ' ' + line);
    const raw = line.trim();
    if (!raw) return;
    if (history[history.length - 1] !== raw) history.push(raw);
    histIndex = history.length;
    const first = raw.split(/\s+/)[0].toLowerCase();
    const fn = commands[first];
    if (fn) fn();
    else write(`command not found: ${first}\ntry: help`);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length) {
        histIndex = Math.max(0, histIndex - 1);
        input.value = history[histIndex] || '';
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      histIndex = Math.min(history.length, histIndex + 1);
      input.value = histIndex >= history.length ? '' : history[histIndex];
    } else if (e.key === 'Enter') {
      const v = input.value;
      input.value = '';
      run(v);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      input.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      deactivate();
    }
  };

  const build = () => {
    overlay = document.createElement('div');
    overlay.className = 'terminal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'terminal mode');
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="term-head dim">' +
      '<span>pabanks.io — terminal</span>' +
      '<span>[ exit | esc ]</span>' +
      '</div>' +
      '<pre class="term-output" aria-live="polite"></pre>' +
      '<div class="term-input-row">' +
      '<span class="dim" aria-hidden="true">' + PROMPT + '</span>' +
      '<input class="term-input" type="text" aria-label="type a command and press enter" ' +
      "placeholder=\"type 'help' and press enter\" autocomplete=\"off\" autocapitalize=\"none\" spellcheck=\"false\">" +
      '</div>';
    out = overlay.querySelector('.term-output');
    input = overlay.querySelector('.term-input');
    input.addEventListener('keydown', onKey);
    overlay.addEventListener('click', () => input.focus());
    document.body.appendChild(overlay);
  };

  const emit = () => listeners.forEach((cb) => { try { cb(active); } catch { /* noop */ } });

  const activate = () => {
    if (active) return;
    if (!overlay) build();
    overlay.hidden = false;
    active = true;
    try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ }
    if (!overlay.dataset.greeted) {
      overlay.dataset.greeted = '1';
      write('pabanks.io — terminal mode');
      write('navigation: type a command + enter. \'help\' lists everything. \'exit\' leaves.');
    }
    input.focus();
    emit();
  };

  const deactivate = () => {
    if (!active || !overlay) return;
    overlay.hidden = true;
    active = false;
    try { localStorage.removeItem(KEY); } catch { /* private mode */ }
    emit();
  };

  window.Terminal = {
    toggle: () => (active ? deactivate() : activate()),
    restore: () => {
      try { if (localStorage.getItem(KEY) === '1') activate(); } catch { /* noop */ }
    },
    isActive: () => active,
    subscribe: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  };

  loadSite();
})();
