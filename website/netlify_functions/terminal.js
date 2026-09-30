// terminal.js — plain-text version of the site for curl users.
//   GET /api/terminal?cmd=help|about|contact|resume|site
// (UA sniffing is best-effort per spec; this endpoint is the reliable path for curl.)
const SITE = {
  // Keep in sync with public/site.json
  name: 'YOUR.NAME',
  url: 'https://pabanks.io',
  email: 'hello@pabanks.io',
  github: 'github.com/your-handle',
  linkedin: 'linkedin.com/in/your-handle',
};

const RULE = '='.repeat(56);

const pages = {
  help: [
    'pabanks.io — cyber security portfolio · text mode',
    RULE,
    '  $ help      show this list',
    '  $ about     whoami',
    '  $ contact   how to reach me',
    '  $ resume    how to read the resume',
    '  $ site      open the full website',
    '',
    'examples:',
    `  curl ${SITE.url}/api/terminal?cmd=about`,
    `  curl ${SITE.url}/api/terminal?cmd=contact`,
  ].join('\n'),

  about: [
    `$ whoami`,
    `${SITE.name} — cyber security`,
    'placeholder bio: the real about section lives on the website.',
    `  ${SITE.url}`,
  ].join('\n'),

  contact: [
    `$ contact`,
    `mail    : ${SITE.email}`,
    `github  : ${SITE.github}`,
    `linkedin: ${SITE.linkedin}`,
  ].join('\n'),

  resume: [
    `$ resume`,
    'resume access is one-time: enter your email on the site to get a',
    'session link (24h expiry, 5 views). your email is logged so the',
    'owner knows who is reading — no newsletter, not shared.',
    `  open ${SITE.url} in a browser and press [ RESUME ]`,
  ].join('\n'),

  site: [
    `$ site`,
    `the full website (best in a browser): ${SITE.url}`,
  ].join('\n'),
};

export const handler = (event) => {
  const cmd = String((event.queryStringParameters && event.queryStringParameters.cmd) || 'help').toLowerCase();
  const body = pages[cmd]
    ? pages[cmd] + '\n'
    : `command not found: ${cmd}\ntry: curl ${SITE.url}/api/terminal?cmd=help\n`;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body,
  };
};