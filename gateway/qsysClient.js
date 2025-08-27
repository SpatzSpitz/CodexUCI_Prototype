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
  }

  async connect() {
    this.ws = new WebSocket(this.url);
    this.ws.on('open', () => {
      this.backoff = 1000;
      console.log('[Q-SYS] connected');
      this.subscribeAll();
    });
    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.control) {
          this.cache[msg.control] = msg.value;
          this.emit('update', msg);
        }
      } catch (e) {
        console.error('invalid message from core', e);
      }
    });
    this.ws.on('close', () => this.retry());
    this.ws.on('error', () => this.retry());
  }

  retry() {
    console.log('[Q-SYS] disconnected, retrying');
    setTimeout(() => this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 30000);
  }

  subscribeAll() {
    const raw = fs.readFileSync(this.channelsPath, 'utf-8');
    const cfg = JSON.parse(raw);
    const controls = cfg.channels.flatMap(c => [c.controls.gain, c.controls.mute, c.controls.level]);
    const subMsg = { type: 'subscribe', controls };
    this.ws.send(JSON.stringify(subMsg));
  }

  setControl(control, value) {
    const msg = { type: 'set', control, value };
    this.ws.send(JSON.stringify(msg));
  }
}
