// mailer.js — shared SMTP sender (Zoho via nodemailer)
// Credentials come from Netlify env vars: ZOHO_EMAIL / ZOHO_PASSWORD
// TODO: replace the placeholder addresses below (or set SITE_FROM / OWNER_INBOX env vars) before launch.
import nodemailer from 'nodemailer';

const SITE_FROM = process.env.SITE_FROM || 'noreply@pabanks.io';
const OWNER_INBOX = process.env.OWNER_INBOX || 'hello@pabanks.io';
const MONO = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com.au',
  secure: true,
  port: 465,
  connectionTimeout: 10_000,
  socketTimeout: 15_000,
  auth: { user: process.env.ZOHO_EMAIL, pass: process.env.ZOHO_PASSWORD },
});

async function sendMail(mailOptions) {
  if (process.env.MAILER_DISABLED === '1') {
    console.warn('mailer: MAILER_DISABLED=1 — skipping send:', mailOptions.subject);
    return { skipped: true };
  }
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('> email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('!! error sending email:', error.message);
    throw error;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Contact page form. Spec: subject "Contact Form - CS Portfolio", body = email + message. */
export function sendContactEmail({ email, message }) {
  return sendMail({
    to: OWNER_INBOX,
    from: SITE_FROM,
    subject: 'Contact Form - CS Portfolio',
    text: `Email: ${email}\n\nMessage:\n${message}\n`,
    html: `
      <div style="border:1px solid #666;border-radius:1em;padding:1em;font-family:${MONO};">
        <p>Email: ${escapeHtml(email)}</p>
        <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
      </div>`,
  });
}

/** Resume gate: notify the owner when someone is reading the resume. */
export function sendResumeViewNotification({ viewerEmail, viewCount, at }) {
  return sendMail({
    to: OWNER_INBOX,
    from: SITE_FROM,
    subject: '[pabanks.io] resume viewed',
    text:
      'Someone is reading your resume.\n' +
      `Viewer email : ${viewerEmail}\n` +
      `View         : ${viewCount}\n` +
      `Time         : ${at}\n\n` +
      'Per your site disclaimer this email is private; the reader was told it is logged, not shared.',
    html: `
      <div style="font-family:${MONO};color:#ffb000;">
        <p>&gt; resume viewed</p>
        <p>&gt; email : ${escapeHtml(viewerEmail)}</p>
        <p>&gt; view  : ${escapeHtml(String(viewCount))}</p>
        <p>&gt; time  : ${escapeHtml(at)}</p>
      </div>`,
  });
}
