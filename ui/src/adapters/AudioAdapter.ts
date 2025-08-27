export interface AudioAdapter {
  connect(): void;
  onStatus(cb: (status: string) => void): void;
  onState(cb: (control: string, value: number | boolean) => void): void;
  setControl(control: string, value: number | boolean): void;
}
