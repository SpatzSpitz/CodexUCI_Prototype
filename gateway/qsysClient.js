import { WebSocket } from 'ws';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';

export default class QSysClient extends EventEmitter {
  constructor(url, channelsPath) {
    super();
    this.url = url;
    this.channelsPath = channelsPath;
    this.cache = {};
    this.ws = null;
    this.backoff = 1000; // start 1s
    this.wsOptions = {};
    if (process.env.QSYS_INSECURE === '1') {
      // Allow self-signed certs when using wss
      this.wsOptions.rejectUnauthorized = false;
    }
    if (process.env.QSYS_TLS_MIN) {
      this.wsOptions.minVersion = process.env.QSYS_TLS_MIN;
    }
    if (process.env.QSYS_NO_SNI === '1') {
      this.wsOptions.servername = '';
    }
    this.user = process.env.QSYS_USER || 'admin';
    this.password = process.env.QSYS_PASSWORD || '';
    this.rpcId = 1;
    this.pending = new Map(); // id -> callback
    this.controls = [];
    this.muteSet = new Set();
  }

  async connect() {
    console.log(`[Q-SYS] connecting to ${this.url}`);
    const url = this.ensureQrcPath(this.url);
    // Many Cores require the 'jsonrpc' subprotocol for QRC
    this.ws = new WebSocket(url, 'jsonrpc', this.wsOptions);
    this.ws.on('open', () => {
      this.backoff = 1000;
      console.log('[Q-SYS] connected, logging on');
      this.logon();
    });
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('close', (code, reason) => {
      console.warn(`[Q-SYS] connection closed code=${code} reason=${reason}`);
      this.retry();
    });
    this.ws.on('error', (err) => {
      try {
        console.error('[Q-SYS] connection error', err && (err.code || err.message) || err);
      } catch {}
      this.retry();
    });
  }

  retry() {
    console.log('[Q-SYS] disconnected, retrying');
    setTimeout(() => this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 30000);
  }

  logon() {
    // Send QRC Logon, then subscribe to NamedControls
    const id = this.nextId();
    const msg = {
      jsonrpc: '2.0',
      id,
      method: 'Logon',
      params: { User: this.user, Password: this.password }
    };
    this.sendRpc(msg, (err, result) => {
      if (err) {
        console.error('[Q-SYS] Logon failed', err);
        this.ws.close();
        return;
      }
      console.log('[Q-SYS] Logon OK, subscribing to named controls');
      this.subscribeAll();
    });
  }

  subscribeAll() {
    const raw = fs.readFileSync(this.channelsPath, 'utf-8');
    const cfg = JSON.parse(raw);
    // Collect control names and identify mute controls for boolean mapping
    const controls = cfg.channels.flatMap(c => [c.controls.gain, c.controls.mute, c.controls.level]);
    this.controls = controls;
    this.muteSet = new Set(cfg.channels.map(c => c.controls.mute));

    // Subscribe to updates for each control and seed current values
    controls.forEach((name) => {
      this.namedControlSubscribe(name, true);
      this.namedControlGet(name);
    });
  }

  setControl(control, value) {
    // Map boolean mute to 0/1 numeric for QRC
    let out = value;
    if (this.muteSet.has(control) && typeof value === 'boolean') {
      out = value ? 1 : 0;
    }
    this.namedControlSet(control, out);
  }

  // ---------- QRC helpers ----------
  nextId() { return this.rpcId++; }

  ensureQrcPath(inputUrl) {
    try {
      const u = new URL(inputUrl);
      if (!u.pathname || u.pathname === '/') {
        u.pathname = '/qrc';
      }
      return u.toString();
    } catch {
      return inputUrl.endsWith('/qrc') ? inputUrl : `${inputUrl}/qrc`;
    }
  }

  sendRpc(msg, cb) {
    if (msg.id != null && typeof cb === 'function') {
      this.pending.set(msg.id, cb);
    }
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (e) {
      console.error('[Q-SYS] send failed', e);
    }
  }

  onMessage(data) {
    let msg;
    try { msg = JSON.parse(data); } catch (e) {
      console.error('[Q-SYS] invalid JSON from core', e);
      return;
    }
    // Handle responses
    if (msg.id != null && (msg.result != null || msg.error != null)) {
      const cb = this.pending.get(msg.id);
      if (cb) {
        this.pending.delete(msg.id);
        cb(msg.error || null, msg.result);
      }
      return;
    }
    // Handle notifications/updates
    if (msg.method) {
      const m = msg.method;
      const p = msg.params || {};
      // Most QRC firmwares use NamedControl(s) update notifications
      // Try to normalize into {control, value}
      if (m.toLowerCase().includes('namedcontrol')) {
        const name = p.Name || p.name || p.Control || p.control || p.Identifier;
        let value = p.Value;
        if (value == null && typeof p.String !== 'undefined') {
          // Some controls report string; ignore numeric mapping in that case
          value = p.String;
        }
        if (name != null && typeof value !== 'undefined') {
          let outVal = value;
          // Map mutes to boolean for UI
          if (this.muteSet.has(name)) {
            if (typeof value === 'number') outVal = value >= 0.5;
            else if (typeof value === 'string') outVal = value === '1' || value.toLowerCase() === 'true';
          }
          this.cache[name] = outVal;
          this.emit('update', { control: name, value: outVal });
        }
      }
    }
  }

  namedControlSubscribe(name, enable) {
    const id = this.nextId();
    const msg = { jsonrpc: '2.0', id, method: 'NamedControl.Subscribe', params: { Name: name, Enable: !!enable } };
    this.sendRpc(msg, () => {});
  }

  namedControlGet(name) {
    const id = this.nextId();
    const msg = { jsonrpc: '2.0', id, method: 'NamedControl.Get', params: { Name: name } };
    this.sendRpc(msg, (err, res) => {
      if (err) return;
      // Expect res to have Value or String
      const value = (res && (res.Value != null ? res.Value : res.String));
      if (typeof value !== 'undefined') {
        let outVal = value;
        if (this.muteSet.has(name)) {
          if (typeof value === 'number') outVal = value >= 0.5;
          else if (typeof value === 'string') outVal = value === '1' || value.toLowerCase() === 'true';
        }
        this.cache[name] = outVal;
        this.emit('update', { control: name, value: outVal });
      }
    });
  }

  namedControlSet(name, value) {
    const id = this.nextId();
    const msg = { jsonrpc: '2.0', id, method: 'NamedControl.Set', params: { Name: name, Value: value } };
    this.sendRpc(msg, (err) => {
      if (err) console.error('[Q-SYS] Set failed for', name, err);
    });
  }
}
