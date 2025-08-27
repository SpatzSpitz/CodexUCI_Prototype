interface Props {
  level: number;
}

export default function LevelMeter({ level }: Props) {
  return (
    <div className="level-meter">
      <div className="bar" style={{ height: `${Math.round(level * 100)}%` }} />
    </div>
  );
}
