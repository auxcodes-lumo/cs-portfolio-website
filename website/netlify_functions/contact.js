// contact.js — contact form endpoint: POST /api/contact  { email, message }
// Honeypot: bots fill the hidden "website" field; humans never see it.
import { sendContactEmail } from './mailer.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const json = (statusCode, obj) => ({ statusCode, headers: cors, body: JSON.stringify(obj) });

function parseBody(event) {
  if (!event.body) return {};
  const ct = (event.requestHeaders && event.requestHeaders['content-type']) || '';
  if (ct.includes('application/json')) return JSON.parse(event.body);
  const params = new URLSearchParams(event.body);
  return Object.fromEntries(params.entries());
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'use POST' });

  let body;
  try {
    body = parseBody(event);
  } catch {
    return json(400, { ok: false, error: 'invalid body' });
  }

  // Honeypot triggered: pretend success, keep the spammer happy.
  if (body.website || body.company) {
    console.warn('contact: honeypot triggered — dropped');
    return json(200, { ok: true, msg: 'message received' });
  }

  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();

  if (!EMAIL_RE.test(email)) return json(400, { ok: false, error: 'a valid email is required' });
  if (message.length < 5) return json(400, { ok: false, error: 'message is too short' });
  if (message.length > 5000) return json(400, { ok: false, error: 'message is too long (max 5000 chars)' });

  try {
    await sendContactEmail({ email, message });
    console.log('contact: message from', email);
    return json(200, { ok: true, msg: 'message received' });
  } catch (error) {
    console.error('contact: send failed:', error.message);
    return json(500, { ok: false, error: 'email service unavailable — try again later' });
  }
};
