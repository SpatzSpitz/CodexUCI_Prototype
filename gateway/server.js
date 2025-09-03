import { WebSocketServer } from 'ws';
import QSysClient from './qsysClient.js';
import QSysTcpClient from './qsysTcpClient.js';
import path from 'path';
import fs from 'fs';
import http from 'http';

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

// Create a small HTTP server to serve channels.json and host the WebSocket
const server = http.createServer((req, res) => {
  const url = req.url || '/';
  // CORS for UI dev server
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET' && url.startsWith('/channels.json')) {
    try {
      res.setHeader('Content-Type', 'application/json');
      fs.createReadStream(channelsPath).pipe(res);
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'failed to read channels.json' }));
    }
    return;
  }

  if (req.method === 'PUT' && url.startsWith('/channels.json')) {
    // Receive full body
    let body = '';
    req.setEncoding('utf-8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed || !Array.isArray(parsed.channels)) throw new Error('invalid structure');
        // Basic normalization: sort by order ascending
        parsed.channels.sort((a, b) => (Number(a.order||0) - Number(b.order||0)));
        fs.writeFileSync(channelsPath, JSON.stringify(parsed, null, 2));
        // Re-subscribe controls in the backend
        try {
          if (typeof qsys.subscribeAll === 'function') qsys.subscribeAll();
          if (typeof qsys.setupChangeGroup === 'function') qsys.setupChangeGroup();
        } catch (e) {
          console.warn('re-subscribe after channels update failed:', e && e.message || e);
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'invalid JSON', message: String(e && e.message || e) }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
});

const wss = new WebSocketServer({ server, path: '/ws' });
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

server.listen(PORT, () => {
  console.log(`Gateway running on ws://localhost:${PORT}/ws`);
  console.log(`Serving channels.json at http://localhost:${PORT}/channels.json`);
});
