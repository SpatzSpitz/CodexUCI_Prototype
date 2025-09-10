import { Asset } from '../types/Asset';

export type AssetTree = Record<string, Record<string, Record<string, Asset[]>>>;

export function buildTree(assets: Asset[]): AssetTree {
  const tree: AssetTree = {};
  for (const a of assets) {
    const b = a.location?.building || 'Unknown';
    const f = a.location?.floor || 'Unknown';
    const r = a.location?.room || 'Unknown';
    tree[b] = tree[b] || {};
    tree[b][f] = tree[b][f] || {};
    tree[b][f][r] = tree[b][f][r] || [];
    tree[b][f][r].push(a);
  }
  return tree;
}

export function useAssetsByLocation(assets: Asset[]) {
  return buildTree(assets);
}

