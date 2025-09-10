// QRC TCP observer that logs live changes using ChangeGroup.AutoPoll
// Usage:
//   cd gateway
//   $env:QSYS_HOST='192.168.10.5'; $env:QSYS_PORT='1710'
//   # optional: $env:QSYS_USER='admin'; $env:QSYS_PASSWORD=''
//   # optional: $env:QSYS_RATE='0.2'  # seconds
//   node log_core_updates.js

import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsPath = path.join(__dirname, '..', 'config', 'assets.json');
const host = process.env.QSYS_HOST || '192.168.10.5';
const port = Number(process.env.QSYS_PORT || 1710);
const user = process.env.QSYS_USER || 'admin';
const password = process.env.QSYS_PASSWORD || '';
const rateSec = Number(process.env.QSYS_RATE || 0.2); // AutoPoll rate in seconds
const changeGroupId = process.env.QSYS_CG_ID || 'codex-cli';

// Load controls from assets.json (audio+QSYS only)
const raw = JSON.parse(fs.readFileSync(assetsPath, 'utf-8'));
const audio = (raw.assets || []).filter(a => a && a.category === 'audio' && a.adapter === 'QSYS');
const controls = audio.flatMap(a => [a.controls?.gain, a.controls?.mute, a.controls?.level]).filter(Boolean);
const muteSet = new Set(audio.map(a => a.controls?.mute).filter(Boolean));

let socket;
let buffer = Buffer.alloc(0);
let rpcId = 1;
const pendings = new Map(); // id -> callback(err, result)
const lastValues = new Map(); // control name -> last logged value
let connected = false;
let pollTimer = null;

function connect() {
  socket = new net.Socket();
  socket.setNoDelay(true);
  console.log(`[Observer] Connecting to ${host}:${port} …`);
  socket.connect(port, host);

  socket.on('connect', () => {
    connected = true;
    console.log('[Observer] Connected. Sending Logon…');
    sendRpc('Logon', { User: user, Password: password }, (err) => {
      if (err) {
        console.error('[Observer] Logon failed:', err);
        socket.end();
        return;
      }
      console.log('[Observer] Logon OK. Setting up Change Group…');
      // Clean slate
      sendRpc('ChangeGroup.Destroy', { Id: changeGroupId }, () => {
        // Ignore errors here (group may not exist yet)
        // Add controls
        sendRpc('ChangeGroup.AddControl', { Id: changeGroupId, Controls: controls }, (err2, res2) => {
          if (err2) {
            console.error('[Observer] ChangeGroup.AddControl error:', JSON.stringify(err2));
            return;
          }
          console.log(`[Observer] Added ${controls.length} controls to group '${changeGroupId}'. Starting Poll @ 0.25s …`);
          // Force all values to be sent on next poll
          sendRpc('ChangeGroup.Invalidate', { Id: changeGroupId }, () => {
            startPolling();
          });
        });
      });
    });
    // Seed values once for visibility
    sendRpc('Control.Get', controls, (err, result) => {
      if (err) {
        console.warn('[Observer] Control.Get error:', JSON.stringify(err));
      } else if (Array.isArray(result)) {
        for (const item of result) emitChange(item);
      }
    });
  });

  socket.on('data', onData);
  socket.on('error', (err) => {
    console.error('[Observer] Socket error:', err && (err.code || err.message) || err);
  });
  socket.on('close', () => {
    if (connected) console.warn('[Observer] Disconnected. Reconnecting in 1s…');
    connected = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    setTimeout(connect, 1000);
  });
}

function onData(chunk) {
  buffer = Buffer.concat([buffer, chunk]);
  let idx;
  while ((idx = buffer.indexOf(0)) !== -1) {
    const frame = buffer.slice(0, idx).toString('utf8');
    buffer = buffer.slice(idx + 1);
    if (!frame.trim()) continue;
    let msg;
    try { msg = JSON.parse(frame); }
    catch (e) { console.warn('[Observer] Non-JSON frame:', frame); continue; }

    // Notifications like EngineStatus
    if (msg.method) {
      if (msg.method === 'EngineStatus') {
        const p = msg.params || {};
        console.log('[Observer] EngineStatus:', p.State, p.DesignName);
      }
      continue;
    }
    // Responses
    if (Object.prototype.hasOwnProperty.call(msg, 'result') || msg.error) {
      // Callback if pending exists
      const cb = pendings.get(msg.id);
      if (cb) {
        pendings.delete(msg.id);
        cb(msg.error || null, msg.result);
      }
    }
  }
}

function handleChangeGroupResult(res) {
  if (!res) return;
  if (res.Changes && Array.isArray(res.Changes)) {
    for (const change of res.Changes) emitChange(change);
  } else if (res.Controls && Array.isArray(res.Controls)) {
    // Component.Get style
    for (const c of res.Controls) emitChange(c);
  }
}

function emitChange(item) {
  // Normalize various shapes to {Name, Value|String}
  const name = item.Name || item.name;
  if (!name) return;
  let value = (Object.prototype.hasOwnProperty.call(item, 'Value')) ? item.Value : item.value;
  if (value == null && typeof item.String !== 'undefined') value = item.String;
  let outVal = value;
  if (muteSet.has(name)) {
    if (typeof value === 'number') outVal = value >= 0.5;
    else if (typeof value === 'string') outVal = value === '1' || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'muted';
  }
  // Only log on change to avoid duplicates/noise
  const prev = lastValues.get(name);
  if (prev === outVal) return;
  lastValues.set(name, outVal);
  const ts = new Date().toISOString();
  console.log(`[CoreUpdate ${ts}] ${name} => ${outVal}`);
}

function nextId() { return rpcId++; }

function sendRpc(method, params, cb) {
  const id = nextId();
  if (typeof cb === 'function') pendings.set(id, cb);
  const payload = { jsonrpc: '2.0', id, method, params };
  const str = JSON.stringify(payload) + '\0';
  try { socket.write(str, 'utf8'); }
  catch (e) { console.error('[Observer] Send failed:', e); }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const intervalMs = 250;
  pollTimer = setInterval(() => {
    sendRpc('ChangeGroup.Poll', { Id: changeGroupId }, (err, res) => {
      if (err) {
        // Log error only once in a while
        console.warn('[Observer] ChangeGroup.Poll error:', JSON.stringify(err));
        return;
      }
      handleChangeGroupResult(res);
    });
  }, intervalMs);
}

connect();
