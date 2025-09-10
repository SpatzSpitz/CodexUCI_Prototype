import { useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import { IconByKey } from './icons';
import type { Asset } from '../types/Asset';
import type { AudioAdapter } from '../adapters/AudioAdapter';

interface Props {
  asset: Asset;
  adapter: AudioAdapter;
}

export default function LightCard({ asset, adapter }: Props) {
  const [power, setPower] = useState(false);
  const [brightness, setBrightness] = useState<number | null>(null);

  useEffect(() => {
    adapter.onState((assetId, control, value) => {
      if (assetId !== asset.id) return;
      if (control === 'power') setPower(Boolean(value));
      if (control === 'brightness') setBrightness(Number(value));
    });
  }, [asset, adapter]);

  const hasBrightness = !!asset.controls?.brightness;
  const onToggle = (v: boolean) => {
    setPower(v);
    adapter.setControl(asset.id, 'power', v);
  };
  const onBrightness = (_: any, v: number | number[]) => {
    const num = Array.isArray(v) ? v[0] : v;
    setBrightness(num);
    adapter.setControl(asset.id, 'brightness', num);
  };

  return (
    <Card elevation={4} sx={{ borderRadius: 2, width: 260 }}>
      <CardContent>
        <Stack spacing={1} alignItems="center">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <IconByKey name={asset.icon || 'power'} size={32} />
            <Typography variant="subtitle2" sx={{ textAlign: 'center' }}>{asset.name}</Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2">Off</Typography>
            <Switch checked={power} onChange={(_, v) => onToggle(v)} />
            <Typography variant="body2">On</Typography>
          </Stack>
          {hasBrightness && (
            <Slider min={0} max={100} step={1} value={brightness ?? 0} onChange={onBrightness} sx={{ width: '90%' }} />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

