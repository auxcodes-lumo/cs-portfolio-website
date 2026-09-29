// dev/stub-blobs.mjs — local stand-in for @netlify/blobs v8 (which requires Netlify env vars).
// Dev-only, used by the smoke test:  node --import ./dev/stub-blobs.mjs smoke-test.js
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pabanks-blobs-'));
const safe = (key) => String(key).replace(/[^a-zA-Z0-9._-]/g, '_');
globalThis.__pbStore = {
  async putBlob(key, value) { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(path.join(DIR, safe(key)), value); },
  async getBlob(key) {
    const f = path.join(DIR, safe(key));
    if (!fs.existsSync(f)) throw new Error('blob not found: ' + key);
    return fs.readFileSync(f, 'utf8');
  },
  async deleteBlob(key) { try { fs.unlinkSync(path.join(DIR, safe(key))); } catch { /* already gone */ } },
  async listBlobs() { try { return fs.readdirSync(DIR).map((f) => ({ key: f })); } catch { return []; } },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@netlify/blobs') return { url: 'pbstub:blobs', shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'pbstub:blobs') {
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export const getStore = () => globalThis.__pbStore;\nexport const listStores = async () => ["resume-tokens"];\n',
      };
    }
    return nextLoad(url, context);
  },
});
