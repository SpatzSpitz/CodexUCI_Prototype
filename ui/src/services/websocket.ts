import { GATEWAY_URL } from '../config/app.config';
import { Message } from '../types/Message';

type Status = 'connecting' | 'connected' | 'reconnecting' | 'error';

export class WebSocketClient {
  private ws?: WebSocket;
  private statusCb: (s: Status) => void = () => {};
  private stateCb: (c: string, v: number | boolean) => void = () => {};

  connect() {
    this.statusCb('connecting');
    this.ws = new WebSocket(GATEWAY_URL);
    this.ws.onopen = () => this.statusCb('connected');
    this.ws.onclose = () => {
      this.statusCb('reconnecting');
      setTimeout(() => this.connect(), 1000);
    };
    this.ws.onerror = () => this.statusCb('error');
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as Message;
      if (msg.type === 'state') {
        this.stateCb(msg.control, msg.value);
      }
    };
  }

  onStatus(cb: (s: Status) => void) { this.statusCb = cb; }
  onState(cb: (c: string, v: number | boolean) => void) { this.stateCb = cb; }
  send(msg: Message) { this.ws?.send(JSON.stringify(msg)); }
}
