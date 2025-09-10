export type SubscribeMessage = {
  type: 'subscribe';
  controls: string[]; // legacy subscribe by control id (used for seeding)
};

export type SetMessage = {
  type: 'set';
  asset: string;     // asset id
  control: string;   // control key
  value: number | boolean;
};

export type StateMessage = {
  type: 'state';
  asset: string;     // asset id
  control: string;   // control key
  value: number | boolean;
};

export type Message = SubscribeMessage | SetMessage | StateMessage;
