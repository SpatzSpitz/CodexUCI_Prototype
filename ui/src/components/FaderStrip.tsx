import { useEffect, useState } from 'react';
import { Channel } from '../types/Channel';
import MuteButton from './MuteButton';
import Slider from './Slider';
import LevelMeter from './LevelMeter';
import { AudioAdapter } from '../adapters/AudioAdapter';

interface Props {
  channel: Channel;
  adapter: AudioAdapter;
}

export default function FaderStrip({ channel, adapter }: Props) {
  const [gain, setGain] = useState(0);
  const [mute, setMute] = useState(false);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    adapter.onState((control, value) => {
      if (control === channel.controls.gain) setGain(Number(value));
      if (control === channel.controls.mute) setMute(Boolean(value));
      if (control === channel.controls.level) setLevel(Number(value));
    });
  }, [channel, adapter]);

  const onGain = (v: number) => {
    setGain(v);
    adapter.setControl(channel.controls.gain, v);
  };

  const toggleMute = () => {
    adapter.setControl(channel.controls.mute, !mute);
  };

  return (
    <div className="fader-strip">
      <h3>{channel.label}</h3>
      <MuteButton active={mute} onToggle={toggleMute} />
      <Slider value={gain} onChange={onGain} />
      <LevelMeter level={level} />
    </div>
  );
}
