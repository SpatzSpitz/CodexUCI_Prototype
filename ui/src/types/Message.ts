export type SubscribeMessage = {
  type: 'subscribe';
  controls: string[];
};

export type SetMessage = {
  type: 'set';
  control: string;
  value: number | boolean;
};

export type StateMessage = {
  type: 'state';
  control: string;
  value: number | boolean;
};

export type Message = SubscribeMessage | SetMessage | StateMessage;
