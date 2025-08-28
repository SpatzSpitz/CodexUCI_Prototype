// Standalone QRC connection probe
// Usage:
//   # PowerShell
//   # Set your core URL (include /qrc). Prefer wss on 1711 if HTTPS is enabled
//   # $env:QSYS_URL = 'wss://<core-ip>:1711/qrc'
//   # Optional for self-signed certs
//   # $env:QSYS_INSECURE = '1'
//   # Optional credentials (if Access Control enabled)
//   # $env:QSYS_USER = 'admin'
//   # $env:QSYS_PASSWORD = ''
//   # Run
//   // node qrc_probe.js [optional-url]

import { WebSocket } from 'ws';

const argUrl = process.argv[2];
const defaultUrl = 'wss://192.168.10.5:1711/qrc';
const rawUrl = argUrl || process.env.QSYS_URL || defaultUrl;
const url = ensureQrcPath(rawUrl);

const user = process.env.QSYS_USER || 'admin';
const password = process.env.QSYS_PASSWORD || '';
const insecure = process.env.QSYS_INSECURE === '1';

let ws;
let rpcId = 1;
const pendings = new Map();

const tlsAttempts = [
  { label: 'TLSv1.3', opts: { minVersion: 'TLSv1.3' } },
  { label: 'TLSv1.2', opts: { minVersion: 'TLSv1.2' } },
  { label: 'TLSv1.1', opts: { minVersion: 'TLSv1.1' } },
  { label: 'TLSv1.0', opts: { minVersion: 'TLSv1' } },
];

const customMin = process.env.QSYS_TLS_MIN;
if (customMin) {
  tlsAttempts.unshift({ label: customMin, opts: { minVersion: customMin } });
}

let attemptIndex = 0;
connectAttempt();

function connectAttempt() {
  const attempt = tlsAttempts[attemptIndex] || { label: 'default', opts: {} };
  const wsOptions = { ...attempt.opts };
  if (insecure) wsOptions.rejectUnauthorized = false;
  // Try with and without SNI if needed
  if (process.env.QSYS_NO_SNI === '1') wsOptions.servername = '';

  console.log(`[QRC-Probe] Connecting to ${url} (jsonrpc, insecure=${insecure}, TLS=${attempt.label}, noSNI=${process.env.QSYS_NO_SNI==='1'})`);
  ws = new WebSocket(url, 'jsonrpc', wsOptions);

  ws.on('open', () => {
    console.log('[QRC-Probe] WebSocket open, sending Logon');
    sendRpc('Logon', { User: user, Password: password }, (err, res) => {
      if (err) {
        console.error('[QRC-Probe] Logon error:', err);
        return;
      }
      console.log('[QRC-Probe] Logon OK:', res);
      sendRpc('EngineStatus.Get', {}, (err2, res2) => {
        if (err2) console.warn('[QRC-Probe] EngineStatus.Get error:', err2);
        else console.log('[QRC-Probe] EngineStatus.Get:', res2);
      });
    });
  });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); }
    catch (e) { console.warn('[QRC-Probe] Non-JSON frame:', data.toString()); return; }
    if (msg.id != null) {
      const pending = pendings.get(msg.id);
      if (pending) {
        pendings.delete(msg.id);
        pending(msg.error || null, msg.result);
      } else {
        console.log('[QRC-Probe] Unhandled response:', msg);
      }
    } else if (msg.method) {
      console.log('[QRC-Probe] Notification:', msg.method, msg.params);
    } else {
      console.log('[QRC-Probe] Message:', msg);
    }
  });

  ws.on('unexpectedResponse', (req, res) => {
    console.error('[QRC-Probe] Unexpected HTTP response:', res.statusCode, res.statusMessage);
  });

  ws.on('close', (code, reason) => {
    console.warn('[QRC-Probe] Closed:', code, reason?.toString());
  });

  ws.on('error', (err) => {
    console.error('[QRC-Probe] Error:', err && (err.code || err.message) || err);
    // If TLS error, try next attempt
    if (['EPROTO','ERR_SSL_WRONG_VERSION_NUMBER','UNSUPPORTED_PROTOCOL'].includes(err.code)) {
      attemptIndex++;
      if (attemptIndex < tlsAttempts.length) {
        console.log('[QRC-Probe] Retrying with different TLS minVersion...');
        setTimeout(connectAttempt, 500);
      }
    }
  });
}

function sendRpc(method, params, cb) {
  const id = rpcId++;
  if (typeof cb === 'function') pendings.set(id, cb);
  const payload = { jsonrpc: '2.0', id, method, params };
  try { ws.send(JSON.stringify(payload)); }
  catch (e) { console.error('[QRC-Probe] Send failed:', e); }
}

function ensureQrcPath(inputUrl) {
  try {
    const u = new URL(inputUrl);
    if (!u.pathname || u.pathname === '/') u.pathname = '/qrc';
    return u.toString();
  } catch {
    return inputUrl.endsWith('/qrc') ? inputUrl : `${inputUrl}/qrc`;
  }
}
