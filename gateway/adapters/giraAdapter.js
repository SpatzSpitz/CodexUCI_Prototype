import EventEmitter from 'events';

export class GiraAdapter extends EventEmitter {
  constructor() { super(); }
  connect() { /* no-op stub */ }
  subscribeAll(/* assets */) { /* no-op */ }
  setValue(/* asset, controlKey, value, controlId */) { /* no-op */ }
  onUpdate(cb) { this.on('update', cb); }
}

