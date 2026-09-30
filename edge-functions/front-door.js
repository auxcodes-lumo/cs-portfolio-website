// front-door.js — easter-egg payoff: plain-text banner for curl/wget/httpie
// on the front page. UA sniffing is best-effort (same caveat as /api/terminal);
// browsers fall straight through to the static site (returning undefined
// continues the Netlify request chain).
const BANNER = [
  'pabanks.io — cyber security portfolio · text mode',
  '='.repeat(56),
  'you are probably curl (or a browser pretending to be curl).',
  '',
  '  $ help      show this list',
  '  $ about     whoami',
  '  $ contact   how to reach me',
  '  $ resume    how to read the resume',
  '  $ site      open the full website',
  '',
  'examples:',
  '  curl https://pabanks.io/api/terminal?cmd=about',
  '  curl https://pabanks.io/api/terminal?cmd=contact',
].join('\n');

export default async (request) => {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const isCurlish = /(^|\b)(curl|wget|httpie)(\b|$)/.test(ua);
  const isFrontPage = new URL(request.url).pathname === '/';
  if (isCurlish && isFrontPage) {
    return new Response(BANNER + '\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  // Anything else: continue to the next step (static index.html).
  return undefined;
};
