import React from 'react';

interface Props {
  value: number; // expected in dB for our use case
  onChange: (v: number) => void; // emits dB value
  min?: number;
  max?: number;
  step?: number;
}

export default function Slider({ value, onChange, min = -100, max = 20, step = 0.5 }: Props) {
    const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.valueAsNumber);
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={handle} onInput={handle}
      className="slider"
    />
  );
}


