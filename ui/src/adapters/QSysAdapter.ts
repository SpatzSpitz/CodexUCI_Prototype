import { AudioAdapter } from './AudioAdapter';
import { WebSocketClient } from '../services/websocket';
import { loadAssets } from '../config/assets.loader';

export class QSysAdapter implements AudioAdapter {
  private ws = new WebSocketClient();
  private statusHandlers: ((s: string) => void)[] = [];
  private stateHandlers: ((c: string, v: number | boolean) => void)[] = [];

  connect() {
    this.ws.onStatus(s => this.statusHandlers.forEach(h => h(s)));
    this.ws.onState((c, v) => this.stateHandlers.forEach(h => h(c, v)));
    this.ws.connect();
    loadAssets().then(assets => {
      const audioQsys = assets.filter(a => a.category === 'audio' && a.adapter === 'QSYS');
      const controlIds = audioQsys.flatMap(a => {
        const c = a.controls || {} as any;
        const ids = [c.gain, c.mute, c.level].filter(Boolean).map((v: any) => typeof v === 'string' ? v : v.id);
        return ids;
      });
      this.ws.send({ type: 'subscribe', controls: controlIds });
    });
  }

  onStatus(cb: (s: string) => void) { this.statusHandlers.push(cb); }
  onState(cb: (c: string, v: number | boolean) => void) { this.stateHandlers.push(cb); }
  setControl(control: string, value: number | boolean) { this.ws.send({ type: 'set', control, value }); }
}
