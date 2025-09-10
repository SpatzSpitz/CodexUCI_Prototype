import EventEmitter from 'events';
import QSysClient from '../qsysClient.js';
import QSysTcpClient from '../qsysTcpClient.js';

export class QSysAdapter extends EventEmitter {
  constructor(assetsPath) {
    super();
    this.assetsPath = assetsPath;
    // Choose TCP by default unless QSYS_URL is set
    const QSYS_URL = process.env.QSYS_URL;
    if (QSYS_URL && /^wss?:\/\//i.test(QSYS_URL)) {
      this.client = new QSysClient(QSYS_URL, assetsPath);
    } else {
      const host = process.env.QSYS_HOST || '192.168.10.5';
      const port = Number(process.env.QSYS_PORT || 1710);
      this.client = new QSysTcpClient(host, port, assetsPath);
    }
    this.client.on('update', (msg) => this.emit('update', msg));
  }

  connect() { this.client.connect(); }

  subscribeAll(/* assets */) {
    // Underlying client reads config/assets.json and subscribes based on it
    if (typeof this.client.subscribeAll === 'function') this.client.subscribeAll();
    if (typeof this.client.setupChangeGroup === 'function') this.client.setupChangeGroup();
  }

  setValue(asset, controlKey, value, controlId) {
    // Forward by control id
    if (typeof this.client.setControl === 'function') this.client.setControl(controlId, value);
  }

  onUpdate(cb) { this.on('update', cb); }
}

