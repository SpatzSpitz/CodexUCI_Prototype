import { ASSETS_URL } from './app.config';
import type { Asset } from '../types/Asset';

export async function loadAssets(): Promise<Asset[]> {
  const res = await fetch(ASSETS_URL);
  const data = await res.json();
  if (!data || !Array.isArray(data.assets)) return [];
  return data.assets as Asset[];
}

export async function loadAssetsDoc(): Promise<any> {
  const res = await fetch(ASSETS_URL);
  return res.json();
}

export async function saveAssets(fullDoc: any) {
  return fetch(ASSETS_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullDoc),
  });
}

export async function fetchGiraUiConfig(): Promise<any> {
  const res = await fetch('http://localhost:8080/adapters/gira/uiconfig');
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
