// resume.js — gated resume access (spec: one-time token, 24h expiry, 5 views)
//   POST /api/resume                  { email }            -> { ok, token }
//   GET  /api/resume/validate?token=  ?token=…             -> { ok, viewsLeft }
// Tokens are stored in Netlify Blobs: store "resume-tokens", key "<token>.json"
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { sendResumeViewNotification } from './mailer.js';

const store = getStore('resume-tokens');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_RE = /^[a-f0-9]{48}$/;
const TTL_MS = 24 * 60 * 60 * 1000; // 24h expiry
const MAX_VIEWS = 5; // invalidated after 5 views

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const json = (statusCode, obj) => ({ statusCode, headers: cors, body: JSON.stringify(obj) });

// Best-effort rate limit (serverless: in-memory, per warm container).
const attempts = new Map();
function rateLimited(ip, max = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const hits = (attempts.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  attempts.set(ip, hits);
  return hits.length > max;
}

function parseBody(event) {
  if (!event.body) return {};
  const ct = (event.requestHeaders && event.requestHeaders['content-type']) || '';
  if (ct.includes('application/json')) return JSON.parse(event.body);
  return Object.fromEntries(new URLSearchParams(event.body).entries());
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  const ip = String(
    (event.requestHeaders && (event.requestHeaders['x-forwarded-for'] || event.requestHeaders['x-real-ip'])) || 'unknown'
  ).split(',')[0].trim();
  const isValidate = event.path.includes('/validate');

  // ---- issue a token ----
  if (event.httpMethod === 'POST' && !isValidate) {
    let body;
    try {
      body = parseBody(event);
    } catch {
      return json(400, { ok: false, error: 'invalid body' });
    }

    // Honeypot triggered: fake token, nothing stored, spammer stays happy.
    if (body.website || body.company) {
      console.warn('resume: honeypot triggered — dropped');
      return json(200, { ok: true, token: '0'.repeat(48) });
    }

    const email = String(body.email || '').trim();
    if (!EMAIL_RE.test(email)) return json(400, { ok: false, error: 'a valid email is required' });
    if (rateLimited(ip)) return json(429, { ok: false, error: 'too many requests — try again in a few minutes' });

    const token = crypto.randomBytes(24).toString('hex');
    const created = new Date().toISOString();
    await store.putBlob(`${token}.json`, JSON.stringify({ email, created, views: 0 }));
    console.log(`resume: token issued for ${email} at ${created} (ip=${ip})`);

    // Notify the owner — best-effort, must not block the redirect.
    try {
      await sendResumeViewNotification({ viewerEmail: email, viewCount: 0, at: created });
    } catch (e) {
      console.error('resume: notification failed:', e.message);
    }

    return json(200, { ok: true, token });
  }

  // ---- validate + consume one view ----
  if (event.httpMethod === 'GET' && isValidate) {
    const token = (event.queryStringParameters && event.queryStringParameters.token) || '';
    if (!TOKEN_RE.test(token)) return json(400, { ok: false, error: 'invalid token' });

    const key = `${token}.json`;
    let record;
    try {
      record = JSON.parse(await store.getBlob(key));
    } catch {
      return json(404, { ok: false, error: 'unknown token' });
    }

    const now = Date.now();
    if (now - Date.parse(record.created) > TTL_MS) {
      try { await store.deleteBlob(key); } catch { /* already gone */ }
      return json(410, { ok: false, error: 'token expired (24h)' });
    }
    if (record.views >= MAX_VIEWS) {
      try { await store.deleteBlob(key); } catch { /* already gone */ }
      return json(410, { ok: false, error: `token exhausted (${MAX_VIEWS} views)` });
    }

    record.views += 1;
    await store.putBlob(key, JSON.stringify(record));
    console.log(`resume: view #${record.views}/${MAX_VIEWS} at ${new Date(now).toISOString()}`);
    return json(200, { ok: true, viewsLeft: MAX_VIEWS - record.views });
  }

  return json(405, { ok: false, error: 'method not allowed' });
};