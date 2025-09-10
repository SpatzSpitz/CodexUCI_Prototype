export interface AssetControlsMap {
  [key: string]: string | { id: string; [k: string]: any };
}

export interface AssetLocation {
  building: string;
  floor: string;
  room: string;
}

export interface Asset {
  id: string;
  name: string;
  category: 'audio' | 'light' | 'sensor' | 'climate' | 'video' | 'custom' | string;
  adapter: string;
  location: AssetLocation;
  controls: AssetControlsMap;
  icon?: string;
  tags?: string[];
  notes?: string;
}

