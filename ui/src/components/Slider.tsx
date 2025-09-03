import { useRef } from 'react';

interface Props {
  value: number; // expected in dB for our use case
  onChange: (v: number) => void; // emits dB value
  min?: number;
  max?: number;
  step?: number;
}

export default function Slider({ value, onChange, min = -100, max = 20, step = 0.5 }: Props) {
  const timeout = useRef<number>();

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (timeout.current) window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => onChange(v), 75);
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={handle}
      className="slider"
    />
  );
}
