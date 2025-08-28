// Standalone QRC TCP probe (no WebSocket)
// QRC is JSON-RPC 2.0 over TCP with null-terminated frames on port 1710.
// Usage (PowerShell examples):
//   cd gateway
//   $env:QSYS_HOST = '192.168.10.5'
//   $env:QSYS_PORT = '1710'
//   # If Access Control is enabled on the Core:
//   # $env:QSYS_USER = 'admin'; $env:QSYS_PASSWORD = ''
//   node qrc_tcp_probe.js

import net from 'net';

const arg = process.argv[2];
let host = process.env.QSYS_HOST || '192.168.10.5';
let port = Number(process.env.QSYS_PORT || 1710);

// Allow an argument like 192.168.10.5:1710
if (arg) {
  const m = arg.match(/^(.*?):(\d+)$/);
  if (m) { host = m[1]; port = Number(m[2]); }
  else { host = arg; }
}

const user = process.env.QSYS_USER || 'admin';
const password = process.env.QSYS_PASSWORD || '';

let rpcId = 1;
const socket = new net.Socket();
socket.setNoDelay(true);

console.log(`[QRC-TCP-Probe] Connecting to ${host}:${port}`);
socket.connect(port, host, () => {
  console.log('[QRC-TCP-Probe] Connected, sending Logon');
  sendRpc({ method: 'Logon', params: { User: user, Password: password } });
  // Also request StatusGet to verify round-trip
  sendRpc({ method: 'StatusGet', params: 0 });
});

socket.on('error', (err) => {
  console.error('[QRC-TCP-Probe] Error:', err && (err.code || err.message) || err);
});

socket.on('close', (hadErr) => {
  console.warn('[QRC-TCP-Probe] Closed', hadErr ? '(error)' : '');
});

// Buffer incoming data and split by null terminator (\0)
let buffer = Buffer.alloc(0);
socket.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  let idx;
  while ((idx = buffer.indexOf(0)) !== -1) {
    const frame = buffer.slice(0, idx).toString('utf8');
    buffer = buffer.slice(idx + 1);
    if (!frame.trim()) continue;
    handleFrame(frame);
  }
});

function handleFrame(text) {
  let msg;
  try { msg = JSON.parse(text); }
  catch (e) {
    console.log('[QRC-TCP-Probe] Non-JSON or parse error:', text);
    return;
  }
  if (msg.method) {
    console.log('[QRC-TCP-Probe] Notification:', msg.method, msg.params);
  } else if (Object.prototype.hasOwnProperty.call(msg, 'result') || msg.error) {
    console.log('[QRC-TCP-Probe] Response:', JSON.stringify(msg));
  } else {
    console.log('[QRC-TCP-Probe] Message:', JSON.stringify(msg));
  }
}

function sendRpc({ method, params }) {
  const id = rpcId++;
  const payload = { jsonrpc: '2.0', id, method, params };
  const str = JSON.stringify(payload) + '\0';
  try {
    socket.write(str, 'utf8');
  } catch (e) {
    console.error('[QRC-TCP-Probe] Send failed:', e);
  }
}

