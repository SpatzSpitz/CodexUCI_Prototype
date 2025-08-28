import { AudioAdapter } from './AudioAdapter';
import { WebSocketClient } from '../services/websocket';
import { loadChannels } from '../config/channels.loader';

export class QSysAdapter implements AudioAdapter {
  private ws = new WebSocketClient();
  private statusHandlers: ((s: string) => void)[] = [];
  private stateHandlers: ((c: string, v: number | boolean) => void)[] = [];

  connect() {
    this.ws.onStatus(s => this.statusHandlers.forEach(h => h(s)));
    this.ws.onState((c, v) => this.stateHandlers.forEach(h => h(c, v)));
    this.ws.connect();
    loadChannels().then(channels => {
      const controls = channels.flatMap(ch => Object.values(ch.controls));
      this.ws.send({ type: 'subscribe', controls });
    });
  }

  onStatus(cb: (s: string) => void) { this.statusHandlers.push(cb); }
  onState(cb: (c: string, v: number | boolean) => void) { this.stateHandlers.push(cb); }
  setControl(control: string, value: number | boolean) { this.ws.send({ type: 'set', control, value }); }
}
