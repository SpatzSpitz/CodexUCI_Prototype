import { WebSocketServer } from 'ws';
import QSysClient from './qsysClient.js';
import QSysTcpClient from './qsysTcpClient.js';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { loadAssetsFromFile, writeAssetsToFile, initValidator, validateAssets } from './assetsLoader.js';

const PORT = Number(process.env.PORT || 8080);
// QRC endpoint typically requires the /qrc path and the jsonrpc subprotocol
const QSYS_URL = process.env.QSYS_URL; // only used for WS mode
const assetsPath = path.join(process.cwd(), '..', 'config', 'assets.json');
const schemaPath = path.join(process.cwd(), '..', 'config', 'assets.schema.json');
initValidator(schemaPath);

function logValidationWarnings(result) {
  if (!result || result.valid) return;
  console.warn('[ASSETS][VALIDATION] WARN: assets.json ist nicht valide:');
  for (const err of result.errors) {
    const loc = err.instancePath || '/';
    console.warn(` - ${loc} ${err.message}`);
  }
}

let qsys;
if (QSYS_URL && /^wss?:\/\//i.test(QSYS_URL)) {
  // WebSocket mode (rare for QRC)
  qsys = new QSysClient(QSYS_URL, assetsPath);
  console.log(`[Gateway] Starting on port ${PORT} and connecting to Q-SYS WS: ${QSYS_URL}`);
} else {
  // TCP QRC mode (default)
  const host = process.env.QSYS_HOST || '192.168.10.5';
  const port = Number(process.env.QSYS_PORT || 1710);
  qsys = new QSysTcpClient(host, port, assetsPath);
  console.log(`[Gateway] Starting on port ${PORT} and connecting to Q-SYS TCP: ${host}:${port}`);
}
qsys.connect();

// Initial validation (warn-only)
try {
  const initialDoc = loadAssetsFromFile(assetsPath);
  logValidationWarnings(validateAssets(initialDoc));
} catch (e) {
  console.warn('[ASSETS] Konnte assets.json für initiale Validierung nicht laden:', e && e.message || e);
}

// Create a small HTTP server to serve assets.json and host the WebSocket
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

  if (req.method === 'GET' && url.startsWith('/assets.json')) {
    try {
      res.setHeader('Content-Type', 'application/json');
      fs.createReadStream(assetsPath).pipe(res);
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'failed to read assets.json' }));
    }
    return;
  }

  if (req.method === 'PUT' && url.startsWith('/assets.json')) {
    // Receive full body
    let body = '';
    req.setEncoding('utf-8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        // Warn-only schema validation
        try { logValidationWarnings(validateAssets(parsed)); } catch {}
        // Persist regardless of warnings
        writeAssetsToFile(assetsPath, parsed);
        // Re-subscribe controls in the backend
        try {
          if (typeof qsys.subscribeAll === 'function') qsys.subscribeAll();
          if (typeof qsys.setupChangeGroup === 'function') qsys.setupChangeGroup();
        } catch (e) {
          console.warn('re-subscribe after assets update failed:', e && e.message || e);
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
  console.log(`Serving assets.json at http://localhost:${PORT}/assets.json`);
});
