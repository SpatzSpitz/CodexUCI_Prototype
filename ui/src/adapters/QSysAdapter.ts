import { AudioAdapter } from './AudioAdapter';
import { WebSocketClient } from '../services/websocket';
import { loadAssets } from '../config/assets.loader';

export class QSysAdapter implements AudioAdapter {
  private ws = new WebSocketClient();
  private statusHandlers: ((s: string) => void)[] = [];
  private stateHandlers: ((asset: string, control: string, v: number | boolean) => void)[] = [];

  connect() {
    this.ws.onStatus(s => this.statusHandlers.forEach(h => h(s)));
    this.ws.onState((asset, control, v) => this.stateHandlers.forEach(h => h(asset, control, v)));
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
  onState(cb: (asset: string, control: string, v: number | boolean) => void) { this.stateHandlers.push(cb); }
  setControl(assetId: string, controlKey: string, value: number | boolean) { this.ws.send({ type: 'set', asset: assetId, control: controlKey, value }); }
}
