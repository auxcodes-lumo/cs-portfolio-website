/* smoke-test.js — dev-only, exercises the Netlify function handlers in-process. NOT deployed. */
process.env.MAILER_DISABLED = '1';
process.env.NETLIFY_BLOB_RANGE = 'local-smoke';

let pass = 0; let fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')); } };

const evt = (httpMethod, { path, body, headers = {}, query = {} }) => ({
  httpMethod,
  path,
  body: body === undefined ? undefined : JSON.stringify(body),
  requestHeaders: { ...(body !== null && typeof body === 'object' ? { 'content-type': 'application/json' } : {}), ...headers },
  queryStringParameters: query,
});
const call = async (handler, event) => {
  const r = await handler(event);
  let data = null; try { data = JSON.parse(r.body); } catch { data = r.body; }
  return { status: r.statusCode, data };
};

const { handler: resumeHandler } = await import('./resume.js');
const { handler: contactHandler } = await import('./contact.js');
const { handler: terminalHandler } = await import('./terminal.js');

/* ---- resume: issue + 5-view lifecycle ---- */
const ip = { 'x-forwarded-for': '203.0.113.9' };
const r1 = await call(resumeHandler, evt('POST', { path: '/api/resume', body: { email: 'smoke@example.com' }, headers: ip }));
ok('POST /api/resume 200 + token', r1.status === 200 && r1.data.ok === true && /^[a-f0-9]{48}$/.test(r1.data.token), JSON.stringify(r1.data));
const token = r1.data.token;

for (let view = 1; view <= 5; view++) {
  const v = await call(resumeHandler, evt('GET', { path: '/api/resume/validate', query: { token } }));
  ok(`validate view ${view}/5 -> ${5 - view} left`, v.status === 200 && v.data.viewsLeft === 5 - view, JSON.stringify(v.data));
}
const v6 = await call(resumeHandler, evt('GET', { path: '/api/resume/validate', query: { token } }));
ok('validate view 6 denied (410 exhausted)', v6.status === 410 && /exhausted/i.test(v6.data.error), v6.status + ' ' + JSON.stringify(v6.data));

const badTok = await call(resumeHandler, evt('GET', { path: '/api/resume/validate', query: { token: 'garbage' } }));
ok('validate bad token 400', badTok.status === 400, badTok.status + ' ' + JSON.stringify(badTok.data));
const noTok = await call(resumeHandler, evt('GET', { path: '/api/resume/validate', query: {} }));
ok('validate no token 400', noTok.status === 400, noTok.status + ' ' + JSON.stringify(noTok.data));
const r405 = await call(resumeHandler, evt('DELETE', { path: '/api/resume' }));
ok('resume wrong method 405', r405.status === 405, r405.status + ' ' + JSON.stringify(r405.data));

/* honeypot: bot gets a happy fake token, nothing stored */
const hp = await call(resumeHandler, evt('POST', { path: '/api/resume', body: { email: 'bot@spam.example', website: 'http://evil.example' }, headers: ip }));
ok('resume honeypot: fake success 200', hp.status === 200 && hp.data.ok === true && hp.data.token === '0'.repeat(48), JSON.stringify(hp.data));
const hpv = await call(resumeHandler, evt('GET', { path: '/api/resume/validate', query: { token: hp.data.token } }));
ok('resume honeypot token validates to nothing (404)', hpv.status === 404, hpv.status + ' ' + JSON.stringify(hpv.data));

const badEmail = await call(resumeHandler, evt('POST', { path: '/api/resume', body: { email: 'not-an-email' }, headers: { 'x-forwarded-for': '203.0.113.10' } }));
ok('resume bad email 400', badEmail.status === 400, badEmail.status + ' ' + JSON.stringify(badEmail.data));

/* rate limit: burst of 8 from one IP -> expect 429s */
const rlIp = { 'x-forwarded-for': '203.0.113.77' };
const rl = [];
for (let i = 0; i < 8; i++) {
  const rr = await call(resumeHandler, evt('POST', { path: '/api/resume', body: { email: `rate${i}@example.com` }, headers: rlIp }));
  rl.push(rr.status);
}
const limited = rl.filter((s) => s === 429).length;
ok(`resume rate limit kicks in (429s: ${limited}/8)`, limited >= 3, rl.join(','));

/* ---- contact ---- */
const c1 = await call(contactHandler, evt('POST', { path: '/api/contact', body: { email: 'smoke@example.com', message: 'hello from smoke test' } }));
ok('contact 200 (mailer disabled)', c1.status === 200 && c1.data.ok === true, c1.status + ' ' + JSON.stringify(c1.data));
const c2 = await call(contactHandler, evt('POST', { path: '/api/contact', body: { email: 'smoke@example.com', message: 'bot', website: 'http://evil.example' } }));
ok('contact honeypot: fake success 200', c2.status === 200 && c2.data.ok === true, c2.status + ' ' + JSON.stringify(c2.data));
const c3 = await call(contactHandler, evt('POST', { path: '/api/contact', body: { email: 'nope', message: 'hello' } }));
ok('contact bad email 400', c3.status === 400, c3.status + ' ' + JSON.stringify(c3.data));
const c4 = await call(contactHandler, evt('POST', { path: '/api/contact', body: { email: 'a@b.co', message: 'hi' } }));
ok('contact short message 400', c4.status === 400, c4.status + ' ' + JSON.stringify(c4.data));
const c5 = await call(contactHandler, evt('GET', { path: '/api/contact' }));
ok('contact wrong method 405', c5.status === 405, c5.status + ' ' + JSON.stringify(c5.data));

/* ---- terminal (text/plain) ---- */
const tRaw = (query) => terminalHandler(evt('GET', { path: '/api/terminal', query }));
const t1 = tRaw({ cmd: 'about' });
ok('terminal about 200 text', t1.statusCode === 200 && /whoami/i.test(t1.body) && t1.headers['Content-Type'].startsWith('text/plain'), t1.body.slice(0, 60));
const t2 = tRaw({});
ok('terminal default = help', t2.statusCode === 200 && !t2.body.includes('command not found') && /help/i.test(t2.body), t2.body.slice(0, 40));
const t3 = tRaw({ cmd: 'sudo rm -rf /' });
ok('terminal unknown cmd -> not found text', t3.statusCode === 200 && t3.body.includes('command not found'), t3.body.slice(0, 60));
const t4 = tRaw({ cmd: '../../etc/passwd' });
ok('terminal path traversal is inert (whitelist)', t4.statusCode === 200 && t4.body.includes('command not found'), t4.body.slice(0, 60));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

