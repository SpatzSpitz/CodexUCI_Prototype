import { useRef } from 'react';

interface Props {
  value: number;
  onChange: (v: number) => void;
}

export default function Slider({ value, onChange }: Props) {
  const timeout = useRef<number>();

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (timeout.current) window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => onChange(v), 75);
  };

  return (
    <input
      type="range"
      min={0}
      max={100}
      defaultValue={value}
      onChange={handle}
      className="slider"
    />
  );
}
