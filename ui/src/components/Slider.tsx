import React from 'react';
import SliderBase from '@mui/material/Slider';
import Box from '@mui/material/Box';

interface Props {
  value: number; // expected in dB for our use case
  onChange: (v: number) => void; // emits dB value
  min?: number;
  max?: number;
  step?: number;
}

export default function Slider({ value, onChange, min = -100, max = 20, step = 0.5 }: Props) {
  return (
    <Box sx={{ height: 'var(--strip-height, 260px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SliderBase
        aria-label="Gain"
        orientation="vertical"
        value={value}
        min={min}
        max={max}
        step={step}
        marks={[{value:-60,label:'-60'},{value:-20,label:'-20'},{value:0,label:'0'},{value:10,label:'+10'}]}
        onChange={(_, v) => onChange(Array.isArray(v) ? (v[0] as number) : (v as number))}
        sx={{ height: '100%' }}
      />
    </Box>
  );
}
