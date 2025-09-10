import EventEmitter from 'events';
import http from 'http';
import https from 'https';
import { loadAssetsFromFile } from '../assetsLoader.js';

export class GiraAdapter extends EventEmitter {
  constructor(assetsPath) {
    super();
    this.assetsPath = assetsPath;
    this.host = '';
    this.auth = { user: '', password: '' };
    this.token = null;
    this.pollTimer = null;
    this.pollMs = Number(process.env.GIRA_POLL_MS || 1500);
    this.backoff = this.pollMs;
    this.maxBackoff = 10000;
    this.uidIndex = new Map(); // uid -> { assetId, controlKey }
    this.cache = new Map(); // uid -> lastValue
  }

  connect() {
    // Load adapter config from assets file
    try {
      const cfg = loadAssetsFromFile(this.assetsPath);
      const g = cfg?.adapters?.GiraX1 || {};
      this.host = (g.host || '').replace(/\/$/, '');
      this.auth = g.auth || { user: '', password: '' };
    } catch (e) {
      console.warn('[Gira] failed to load adapter config:', e?.message || e);
    }
    if (!/^https?:\/\//i.test(this.host)) {
      console.warn('[Gira] invalid host configured');
      return;
    }
    // Optional availability check
    this.getJson('/api/v2/').catch(() => {});
    // Register client to obtain token
    this.register().catch(err => console.warn('[Gira] register error:', err?.message || err));
  }

  async register() {
    const body = JSON.stringify({ client: 'de.codex.uci' });
    const headers = this.basicAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await this.request('POST', '/api/v2/clients', { headers, body, noToken: true });
    if (!res || !res.token) throw new Error('no token received');
    this.token = res.token;
    this.backoff = this.pollMs;
    return this.token;
  }

  async subscribeAll(assets) {
    // Build UID index from all Gira assets
    this.uidIndex.clear();
    const giraAssets = (assets || []).filter(a => a && a.adapter === 'GiraX1');
    for (const a of giraAssets) {
      const controls = a.controls || {};
      for (const key of Object.keys(controls)) {
        const def = controls[key];
        const uid = typeof def === 'string' ? def : def?.id;
        if (uid) this.uidIndex.set(uid, { assetId: a.id, controlKey: key });
      }
    }
    // (Re)start polling
    this.stopPolling();
    if (this.uidIndex.size > 0) this.startPolling();
  }

  startPolling() {
    const loop = async () => {
      try {
        await this.pollOnce();
        this.backoff = this.pollMs;
      } catch (e) {
        // transient errors: increase backoff
        this.backoff = Math.min(Math.max(this.backoff * 2, this.pollMs * 2), this.maxBackoff);
        if (String(e?.statusCode).startsWith('401') || String(e?.statusCode).startsWith('422')) {
          try { await this.register(); } catch {}
        }
      } finally {
        this.pollTimer = setTimeout(loop, this.backoff);
      }
    };
    loop();
  }

  stopPolling() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  async pollOnce() {
    if (!this.token || this.uidIndex.size === 0) return;
    // Gira API lacks documented bulk GET; fetch sequentially to be safe
    for (const uid of this.uidIndex.keys()) {
      try {
        const data = await this.getJson(`/api/v2/values/${encodeURIComponent(uid)}`);
        const item = Array.isArray(data?.values) ? data.values.find(v => v.uid === uid) : null;
        if (!item) continue;
        const value = this.normalizeValue(uid, item.value);
        const prev = this.cache.get(uid);
        if (prev !== value) {
          this.cache.set(uid, value);
          // Emit update with raw control id; AdapterManager maps to asset/control
          this.emit('update', { control: uid, value });
        }
      } catch (e) {
        // Log occasionally, but don't spam
        // console.warn('[Gira] poll error for', uid, e?.message || e);
        throw e; // trigger backoff for the loop
      }
    }
  }

  async setValue(asset, controlKey, value, controlId) {
    // Map booleans to 1/0, numbers pass-through, strings pass-through
    let out = value;
    if (typeof value === 'boolean') out = value ? 1 : 0;
    try {
      await this.request('PUT', `/api/v2/values/${encodeURIComponent(controlId)}`, {
        body: JSON.stringify({ value: out }),
        headers: { 'Content-Type': 'application/json' },
      });
      // Optionally update cache and emit optimistic update
      this.cache.set(controlId, out);
      // Don't emit here; state will be picked up by poll shortly
    } catch (e) {
      // handle invalid token
      if (String(e?.statusCode).startsWith('401') || String(e?.statusCode).startsWith('422')) {
        try {
          await this.register();
          await this.request('PUT', `/api/v2/values/${encodeURIComponent(controlId)}`, {
            body: JSON.stringify({ value: out }),
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e2) {
          console.warn('[Gira] setValue failed after re-register:', e2?.message || e2);
        }
      } else {
        console.warn('[Gira] setValue failed:', e?.message || e);
      }
    }
  }

  normalizeValue(uid, raw) {
    const meta = this.uidIndex.get(uid) || {};
    const key = meta.controlKey || '';
    // Booleans: power/enabled or 0/1 strings
    if (key === 'power' || key === 'enabled') {
      if (typeof raw === 'string') return raw === '1' || raw.toLowerCase() === 'true';
      if (typeof raw === 'number') return raw >= 1;
      if (typeof raw === 'boolean') return raw;
    }
    if (typeof raw === 'string' && /^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    return raw;
  }

  basicAuthHeaders(extra = {}) {
    const headers = { ...extra };
    if (this.auth?.user) {
      const token = Buffer.from(`${this.auth.user}:${this.auth.password || ''}`).toString('base64');
      headers['Authorization'] = `Basic ${token}`;
    }
    return headers;
  }

  async getJson(pathname) {
    return this.request('GET', pathname);
  }

  async request(method, pathname, opts = {}) {
    const u = new URL(this.host + pathname);
    if (!opts.noToken && this.token) u.searchParams.set('token', this.token);
    const client = u.protocol === 'https:' ? https : http;
    const headers = opts.headers || {};
    const body = opts.body;
    const options = { method, headers };
    const statusError = (statusCode, msg) => {
      const e = new Error(msg || `HTTP ${statusCode}`);
      e.statusCode = statusCode;
      return e;
    };
    return await new Promise((resolve, reject) => {
      const req = client.request(u, options, (res) => {
        let buf = '';
        res.setEncoding('utf-8');
        res.on('data', (d) => { buf += d; });
        res.on('end', () => {
          const status = res.statusCode || 0;
          if (status >= 200 && status < 300) {
            try { resolve(buf ? JSON.parse(buf) : {}); }
            catch { resolve({}); }
          } else if (status === 401 || status === 422) {
            reject(statusError(status, `auth/token error ${status}`));
          } else if (status === 423 || status >= 500) {
            reject(statusError(status, `device error ${status}`));
          } else {
            reject(statusError(status, `http error ${status}`));
          }
        });
      });
      req.on('error', (e) => reject(e));
      if (body) req.write(body);
      req.end();
    });
  }

}
