import fs from 'fs';

export function loadAssetsFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  // Minimal validation: version present and assets is array
  if (!data || typeof data !== 'object') throw new Error('assets: not an object');
  if (!data.version || typeof data.version !== 'string') throw new Error('assets: missing version');
  if (!Array.isArray(data.assets)) throw new Error('assets: assets must be an array');
  return data;
}

export function writeAssetsToFile(filePath, data) {
  // trust caller to provide validated data; persist pretty-printed
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function listQsysAudioControls(assetsJson) {
  // Filter audio assets for adapter QSYS and collect gain/mute/level strings if present
  const audio = (assetsJson.assets || []).filter(a => a && a.category === 'audio' && a.adapter === 'QSYS');
  const controls = [];
  const muteSet = new Set();
  for (const a of audio) {
    const c = a.controls || {};
    if (c.gain) controls.push(c.gain);
    if (c.mute) { controls.push(c.mute); muteSet.add(c.mute); }
    if (c.level) controls.push(c.level);
  }
  return { controls, muteSet };
}

