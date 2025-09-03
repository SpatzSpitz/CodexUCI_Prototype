import { useEffect, useState } from 'react';
import { Channel } from '../types/Channel';
import MuteButton from './MuteButton';
import Slider from './Slider';
import LevelMeter from './LevelMeter';
import { AudioAdapter } from '../adapters/AudioAdapter';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { IconByKey } from './icons';

interface Props {
  channel: Channel;
  adapter: AudioAdapter;
}

export default function FaderStrip({ channel, adapter }: Props) {
  const [gain, setGain] = useState(0);
  const [mute, setMute] = useState(false);
  const [level, setLevel] = useState(-120);

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
    <Card elevation={6} sx={{ borderRadius: 2, width: 220, height: '100%' }}>
      <CardContent>
        <Stack spacing={2} alignItems="center">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <IconByKey name={channel.icon} size={36} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, textAlign: 'center' }}>{channel.label}</Typography>
          </Box>
          <Grid container spacing={2} alignItems="center" justifyContent="center">
            <Grid item>
              <Slider value={gain} onChange={onGain} />
            </Grid>
            <Grid item>
              <LevelMeter level={level} />
            </Grid>
          </Grid>
          <MuteButton active={mute} onToggle={toggleMute} />
        </Stack>
      </CardContent>
    </Card>
  );
}

