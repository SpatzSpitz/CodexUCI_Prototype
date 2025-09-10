import fs from 'fs';
import Ajv2020 from 'ajv/dist/2020.js';

// Use 2020-12 dialect to match schema's $schema
const ajv = new Ajv2020({ allErrors: true, strict: false });
let validateFn = null;

export function loadSchema(schemaPath) {
  const raw = fs.readFileSync(schemaPath, 'utf-8');
  return JSON.parse(raw);
}

export function initValidator(schemaPath) {
  try {
    const schema = loadSchema(schemaPath);
    validateFn = ajv.compile(schema);
  } catch (e) {
    console.warn('[ASSETS] Schema konnte nicht geladen/kompiliert werden:', e && e.message || e);
    validateFn = null;
  }
}

export function validateAssets(doc) {
  if (!validateFn) return { valid: true, errors: [] };
  const valid = validateFn(doc);
  return { valid, errors: valid ? [] : (validateFn.errors || []) };
}

export function loadAssetsFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
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
    const gain = c.gain;
    const mute = c.mute;
    const level = c.level;
    const norm = v => (typeof v === 'string' ? v : (v && v.id));
    const gId = norm(gain);
    const mId = norm(mute);
    const lId = norm(level);
    if (gId) controls.push(gId);
    if (mId) { controls.push(mId); muteSet.add(mId); }
    if (lId) controls.push(lId);
  }
  return { controls, muteSet };
}
