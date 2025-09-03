import { WebSocketServer } from 'ws';
import QSysClient from './qsysClient.js';
import QSysTcpClient from './qsysTcpClient.js';
import path from 'path';
import fs from 'fs';

const PORT = Number(process.env.PORT || 8080);
// QRC endpoint typically requires the /qrc path and the jsonrpc subprotocol
const QSYS_URL = process.env.QSYS_URL; // only used for WS mode
const channelsPath = path.join(process.cwd(), '..', 'channels.json');

let qsys;
if (QSYS_URL && /^wss?:\/\//i.test(QSYS_URL)) {
  // WebSocket mode (rare for QRC)
  qsys = new QSysClient(QSYS_URL, channelsPath);
  console.log(`[Gateway] Starting on port ${PORT} and connecting to Q-SYS WS: ${QSYS_URL}`);
} else {
  // TCP QRC mode (default)
  const host = process.env.QSYS_HOST || '192.168.10.5';
  const port = Number(process.env.QSYS_PORT || 1710);
  qsys = new QSysTcpClient(host, port, channelsPath);
  console.log(`[Gateway] Starting on port ${PORT} and connecting to Q-SYS TCP: ${host}:${port}`);
}
qsys.connect();

const wss = new WebSocketServer({ port: PORT, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('UI client connected');
  clients.add(ws);
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'set') {
        qsys.setControl(msg.control, msg.value);
        qsys.cache[msg.control] = msg.value;
        broadcast({ type: 'state', control: msg.control, value: msg.value });
      } else if (msg.type === 'subscribe' && Array.isArray(msg.controls)) {
        // Send current cached values for requested controls
        for (const control of msg.controls) {
          const value = qsys.cache[control];
          if (typeof value !== 'undefined') {
            try { ws.send(JSON.stringify({ type: 'state', control, value })); } catch {}
          }
        }
      }
    } catch (e) {
      console.error('bad UI message', e);
    }
  });
  ws.on('close', () => clients.delete(ws));

  // Send initial state
  Object.entries(qsys.cache).forEach(([control, value]) => {
    ws.send(JSON.stringify({ type: 'state', control, value }));
  });
});

function broadcast(msg) {
  const str = JSON.stringify(msg);
  for (const ws of clients) {
    try { ws.send(str); } catch (e) {}
  }
}

qsys.on('update', (msg) => {
  broadcast({ type: 'state', control: msg.control, value: msg.value });
});

console.log(`Gateway running on ws://localhost:${PORT}/ws`);
