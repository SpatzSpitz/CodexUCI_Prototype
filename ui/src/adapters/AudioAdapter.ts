export interface AudioAdapter {
  connect(): void;
  onStatus(cb: (status: string) => void): void;
  onState(cb: (asset: string, control: string, value: number | boolean) => void): void;
  setControl(assetId: string, controlKey: string, value: number | boolean): void;
}
