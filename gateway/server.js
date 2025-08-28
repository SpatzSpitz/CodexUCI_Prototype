import { WebSocketServer } from 'ws';
import QSysClient from './qsysClient.js';
import path from 'path';
import fs from 'fs';

const PORT = 8080;
const QSYS_URL = 'ws://192.168.10.5:1710';
const channelsPath = path.join(process.cwd(), '..', 'channels.json');

const qsys = new QSysClient(QSYS_URL, channelsPath);
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
