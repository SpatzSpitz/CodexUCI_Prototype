import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { loadAssetsFromFile, writeAssetsToFile, initValidator, validateAssets } from './assetsLoader.js';
import { AdapterManager } from './adapterManager.js';
import { QSysAdapter } from './adapters/qsysAdapter.js';
import { GiraAdapter } from './adapters/giraAdapter.js';

const PORT = Number(process.env.PORT || 8080);
// QRC endpoint typically requires the /qrc path and the jsonrpc subprotocol
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

// Adapter Manager + Q-SYS adapter
const adapters = new AdapterManager(assetsPath);
const qsysAdapter = new QSysAdapter(assetsPath);
const giraAdapter = new GiraAdapter(assetsPath);
adapters.registerAdapter('QSYS', qsysAdapter);
adapters.registerAdapter('GiraX1', giraAdapter);
adapters.connectAll();

// Initial validation (warn-only) and load assets into manager
try {
  const initialDoc = loadAssetsFromFile(assetsPath);
  logValidationWarnings(validateAssets(initialDoc));
  adapters.setAssets(initialDoc);
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
        // Update manager and re-subscribe adapters
        adapters.setAssets(parsed);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'invalid JSON', message: String(e && e.message || e) }));
      }
    });
    return;
  }

  // Proxy: GET /adapters/gira/uiconfig -> use adapter token to call /api/v2/uiconfig
  if (req.method === 'GET' && url.startsWith('/adapters/gira/uiconfig')) {
    (async () => {
      try {
        // Ensure we have a token registered
        if (!giraAdapter.token) {
          await giraAdapter.register();
        }
        // Request extended uiconfig so locations/parameters/flags are available to the UI
        const data = await giraAdapter.getJson('/api/v2/uiconfig?expand=locations,parameters,dataPointFlags');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'gira proxy error', message: String(e && e.message || e) }));
      }
    })();
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
      if (msg.type === 'set' && msg.asset && msg.control) {
        try {
          adapters.setValue(msg.asset, msg.control, msg.value);
          // optimistic echo; real state comes via adapter update
          broadcast({ type: 'state', asset: msg.asset, control: msg.control, value: msg.value });
        } catch (e) {
          console.warn('[WS] set failed:', e && e.message || e);
        }
      } else if (msg.type === 'subscribe' && Array.isArray(msg.controls)) {
        // Send current cached values for requested controls
        // No unified cache yet; ignore for new protocol. Keep legacy no-op.
      }
    } catch (e) {
      console.error('bad UI message', e);
    }
  });
  ws.on('close', () => clients.delete(ws));
});

function broadcast(msg) {
  const str = JSON.stringify(msg);
  for (const ws of clients) {
    try { ws.send(str); } catch (e) {}
  }
}

adapters.on('state', (msg) => {
  broadcast(msg);
});

server.listen(PORT, () => {
  console.log(`Gateway running on ws://localhost:${PORT}/ws`);
  console.log(`Serving assets.json at http://localhost:${PORT}/assets.json`);
});
