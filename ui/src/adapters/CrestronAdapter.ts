import { AudioAdapter } from './AudioAdapter';

export class CrestronAdapter implements AudioAdapter {
  connect() { console.warn('CrestronAdapter not implemented'); }
  onStatus() {}
  onState() {}
  setControl() {}
}
