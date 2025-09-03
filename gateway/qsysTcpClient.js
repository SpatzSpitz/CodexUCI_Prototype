import net from 'net';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';

export default class QSysTcpClient extends EventEmitter {
  constructor(host, port, channelsPath) {
    super();
    this.host = host || process.env.QSYS_HOST || '192.168.10.5';
    this.port = Number(port || process.env.QSYS_PORT || 1710);
    this.channelsPath = channelsPath;
    this.cache = {};
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.rpcId = 1;
    this.pending = new Map();
    this.backoff = 1000; // 1s start
    this.pollTimer = null;
    this.keepAliveTimer = null;
    this.controls = [];
    this.muteSet = new Set();
    this.user = process.env.QSYS_USER || 'admin';
    this.password = process.env.QSYS_PASSWORD || '';
    this.debug = process.env.QSYS_DEBUG === '1';
    this.changeGroupId = process.env.QSYS_CG_ID || 'codex-gateway';
    this.pollMs = Number(process.env.QSYS_POLL_MS || 250);
  }

  connect() {
    this.socket = new net.Socket();
    this.socket.setNoDelay(true);
    console.log(`[Q-SYS TCP] connecting to ${this.host}:${this.port}`);
    this.socket.connect(this.port, this.host);

    this.socket.on('connect', () => {
      console.log('[Q-SYS TCP] connected, sending Logon');
      this.backoff = 1000;
      this.sendRpc('Logon', { User: this.user, Password: this.password }, (err, res) => {
        if (err) {
          console.error('[Q-SYS TCP] Logon failed', err);
          this.socket.end();
          return;
        }
        console.log('[Q-SYS TCP] Logon OK');
        this.subscribeAll();
        this.startKeepAlive();
        this.setupChangeGroup();
      });
    });

    this.socket.on('data', (chunk) => this.onData(chunk));

    this.socket.on('error', (err) => {
      console.error('[Q-SYS TCP] error', err && (err.code || err.message) || err);
    });

    this.socket.on('close', () => {
      console.warn('[Q-SYS TCP] disconnected, retrying');
      this.stopPolling();
      this.stopKeepAlive();
      setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, 30000);
    });
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    let idx;
    while ((idx = this.buffer.indexOf(0)) !== -1) {
      const frame = this.buffer.slice(0, idx).toString('utf8');
      this.buffer = this.buffer.slice(idx + 1);
      if (!frame.trim()) continue;
      let msg;
      try { msg = JSON.parse(frame); }
      catch (e) { console.error('[Q-SYS TCP] invalid JSON', e); continue; }
      // Notifications (e.g., EngineStatus, NamedControl updates)
      if (msg.method) {
        const method = String(msg.method || '');
        const p = msg.params || {};
        if (method === 'EngineStatus') {
          // informational
          console.log('[Q-SYS TCP] EngineStatus:', p.State, p.DesignName);
        } else {
          // Try to normalize any control-like update payloads
          const maybeItems = Array.isArray(p) ? p : [p];
          for (const item of maybeItems) {
            if (!item || (typeof item !== 'object')) continue;
            const name = item.Name || item.name || item.Control || item.control || item.Identifier;
            let value = (Object.prototype.hasOwnProperty.call(item, 'Value')) ? item.Value : item.value;
            if (value == null && typeof item.String !== 'undefined') value = item.String;
            if (name != null && typeof value !== 'undefined') {
              let outVal = value;
              if (this.muteSet.has(name)) {
                if (typeof value === 'number') outVal = value >= 0.5;
                else if (typeof value === 'string') outVal = value === '1' || String(value).toLowerCase() === 'true';
              }
              const prev = this.cache[name];
              this.cache[name] = outVal;
              if (prev !== outVal) {
                this.emit('update', { control: name, value: outVal });
              }
            }
          }
          if (this.debug) {
            console.log('[Q-SYS TCP] Notification raw:', method, JSON.stringify(p));
          }
        }
        continue;
      }
      // Responses
      if (Object.prototype.hasOwnProperty.call(msg, 'result') || msg.error) {
        const cb = this.pending.get(msg.id);
        if (cb) {
          this.pending.delete(msg.id);
          cb(msg.error || null, msg.result);
        }
      }
    }
  }

  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      this.sendRpc('NoOp', {});
    }, 30000);
  }

  stopKeepAlive() {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = null;
  }

  subscribeAll() {
    const raw = fs.readFileSync(this.channelsPath, 'utf-8');
    const cfg = JSON.parse(raw);
    this.controls = cfg.channels.flatMap(c => [c.controls.gain, c.controls.mute, c.controls.level]);
    this.muteSet = new Set(cfg.channels.map(c => c.controls.mute));
    // We seed via ChangeGroup polling; explicit subscribe is not required
  }

  startPolling() {
    this.stopPolling();
    const poll = () => {
      if (!this.socket || !this.socket.writable || this.controls.length === 0) return;
      this.sendRpc('ChangeGroup.Poll', { Id: this.changeGroupId }, (err, res) => {
        if (err) {
          if (this.debug) console.warn('[Q-SYS TCP] ChangeGroup.Poll error', JSON.stringify(err));
          return;
        }
        this.handleChangeGroupResult(res);
      });
    };
    poll();
    this.pollTimer = setInterval(poll, this.pollMs);
  }

  stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  setControl(control, value) {
    const params = { Name: control, Value: value };
    this.sendRpc('Control.Set', params, (err) => {
      if (err) console.error('[Q-SYS TCP] Set failed for', control, err);
    });
  }

  // ---- JSON-RPC over TCP helpers ----
  nextId() { return this.rpcId++; }

  sendRpc(method, params, cb) {
    const id = this.nextId();
    if (typeof cb === 'function') this.pending.set(id, cb);
    const payload = { jsonrpc: '2.0', id, method, params };
    const frame = JSON.stringify(payload) + '\0';
    try { this.socket.write(frame, 'utf8'); }
    catch (e) { console.error('[Q-SYS TCP] send failed', e); }
  }

  setupChangeGroup() {
    // Destroy (ignore errors), add controls, invalidate, then start polling
    this.sendRpc('ChangeGroup.Destroy', { Id: this.changeGroupId }, () => {
      this.sendRpc('ChangeGroup.AddControl', { Id: this.changeGroupId, Controls: this.controls }, (err) => {
        if (err) {
          console.error('[Q-SYS TCP] ChangeGroup.AddControl error', JSON.stringify(err));
          return;
        }
        this.sendRpc('ChangeGroup.Invalidate', { Id: this.changeGroupId }, () => {
          this.startPolling();
        });
      });
    });
  }

  handleChangeGroupResult(res) {
    if (!res) return;
    const changes = Array.isArray(res?.Changes) ? res.Changes : (Array.isArray(res) ? res : []);
    for (const item of changes) {
      if (!item || typeof item !== 'object') continue;
      const name = item.Name || item.name;
      if (!name) continue;
      let value = (Object.prototype.hasOwnProperty.call(item, 'Value')) ? item.Value : item.value;
      if (value == null && typeof item.String !== 'undefined') value = item.String;
      if (typeof value === 'undefined') continue;
      let outVal = value;
      if (this.muteSet.has(name)) {
        if (typeof value === 'number') outVal = value >= 0.5;
        else if (typeof value === 'string') outVal = value === '1' || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'muted';
      }
      const prev = this.cache[name];
      this.cache[name] = outVal;
      if (prev !== outVal) this.emit('update', { control: name, value: outVal });
    }
  }
}
