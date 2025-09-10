import EventEmitter from 'events';
import { loadAssetsFromFile } from './assetsLoader.js';

export class AdapterManager extends EventEmitter {
  constructor(assetsPath) {
    super();
    this.assetsPath = assetsPath;
    this.assets = { version: '0.0.0', assets: [] };
    this.adapters = {}; // key -> adapter instance
    this.assetsById = new Map();
    this.controlIndex = new Map(); // controlId -> { assetId, controlKey }
  }

  registerAdapter(key, adapterInstance) {
    this.adapters[key] = adapterInstance;
    if (typeof adapterInstance.onUpdate === 'function') {
      adapterInstance.onUpdate((update) => this.onAdapterUpdate(key, update));
    }
  }

  connectAll() {
    for (const key of Object.keys(this.adapters)) {
      try { this.adapters[key].connect?.(); } catch (e) { console.warn(`[AdapterManager] connect failed for ${key}:`, e?.message || e); }
    }
  }

  loadAssets() {
    try {
      this.assets = loadAssetsFromFile(this.assetsPath);
      this.rebuildIndexes();
      this.subscribeAll();
    } catch (e) {
      console.warn('[AdapterManager] Failed to load assets:', e?.message || e);
    }
  }

  setAssets(doc) {
    this.assets = doc || { version: '0.0.0', assets: [] };
    this.rebuildIndexes();
    this.subscribeAll();
  }

  rebuildIndexes() {
    this.assetsById.clear();
    this.controlIndex.clear();
    for (const a of this.assets.assets || []) {
      if (!a || !a.id) continue;
      this.assetsById.set(a.id, a);
      const controls = a.controls || {};
      Object.keys(controls).forEach((key) => {
        const def = controls[key];
        const id = typeof def === 'string' ? def : def?.id;
        if (id) this.controlIndex.set(id, { assetId: a.id, controlKey: key });
      });
    }
  }

  subscribeAll() {
    const list = this.assets.assets || [];
    for (const key of Object.keys(this.adapters)) {
      try { this.adapters[key].subscribeAll?.(list); }
      catch (e) { console.warn(`[AdapterManager] subscribeAll failed for ${key}:`, e?.message || e); }
    }
  }

  onAdapterUpdate(adapterKey, msg) {
    // msg: { control, value } from adapter; convert to { asset, control, value }
    const idx = this.controlIndex.get(msg.control);
    if (!idx) return; // unknown control
    const out = { type: 'state', asset: idx.assetId, control: idx.controlKey, value: msg.value };
    this.emit('state', out);
  }

  setValue(assetId, controlKey, value) {
    const asset = this.assetsById.get(assetId);
    if (!asset) throw new Error(`asset not found: ${assetId}`);
    const adapter = this.adapters[asset.adapter];
    if (!adapter) throw new Error(`adapter not found: ${asset.adapter}`);
    if (!asset.controls || typeof asset.controls !== 'object') throw new Error('asset.controls missing');
    const target = asset.controls[controlKey];
    const controlId = typeof target === 'string' ? target : target?.id;
    if (!controlId) throw new Error(`control id missing for ${assetId}.${controlKey}`);
    adapter.setValue?.(asset, controlKey, value, controlId);
  }
}

