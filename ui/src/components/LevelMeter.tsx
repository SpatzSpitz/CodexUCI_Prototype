interface Props {
  // Accept dBFS (typisch -60..0, manchmal bis -120)
  level: number;
}

export default function LevelMeter({ level }: Props) {
  const pct = dbToPercent(level);
  return (
    <div className="level-meter">
      <div className="bar" style={{ height: `${pct}%` }} />
    </div>
  );
}

function dbToPercent(db: number): number {
  if (typeof db !== 'number' || !isFinite(db)) return 0;
  // Map -60..0 dB to 0..100%, below -60 clamp to 0, above 0 clamp to 100
  const minDb = -60;
  const maxDb = 0;
  if (db <= minDb) return 0;
  if (db >= maxDb) return 100;
  return ((db - minDb) / (maxDb - minDb)) * 100;
}

