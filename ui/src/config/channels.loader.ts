import { CHANNELS_URL } from './app.config';
import { Channel } from '../types/Channel';

export async function loadChannels(): Promise<Channel[]> {
  const res = await fetch(CHANNELS_URL);
  const data = await res.json();
  return data.channels.sort((a: Channel, b: Channel) => a.order - b.order);
}
