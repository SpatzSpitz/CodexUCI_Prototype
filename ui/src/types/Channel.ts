export interface ControlMap {
  gain: string;
  mute: string;
  level: string;
}

export interface Channel {
  id: string;
  label: string;
  order: number;
  controls: ControlMap;
  icon?: string;
}
