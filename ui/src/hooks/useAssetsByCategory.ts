import { Asset } from '../types/Asset';

export type CategoryMap = Record<string, Record<string, Asset[]>>; // category -> locationKey -> assets

export function useAssetsByCategory(assets: Asset[]) {
  const map: CategoryMap = {};
  for (const a of assets) {
    const cat = a.category || 'unknown';
    const locKey = `${a.location?.building || 'Unknown'} / ${a.location?.floor || 'Unknown'} / ${a.location?.room || 'Unknown'}`;
    if (!map[cat]) map[cat] = {};
    if (!map[cat][locKey]) map[cat][locKey] = [];
    map[cat][locKey].push(a);
  }
  return map;
}

