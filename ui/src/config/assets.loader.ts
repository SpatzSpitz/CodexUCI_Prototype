import { ASSETS_URL } from './app.config';
import type { Asset } from '../types/Asset';

export async function loadAssets(): Promise<Asset[]> {
  const res = await fetch(ASSETS_URL);
  const data = await res.json();
  if (!data || !Array.isArray(data.assets)) return [];
  return data.assets as Asset[];
}

