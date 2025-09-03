import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';

interface Props {
  level: number; // dBFS
}

export default function LevelMeter({ level }: Props) {
  const pct = dbToPercent(level);
  return (
    <Box sx={{ width: 16, height: 'var(--strip-height, 260px)', display: 'flex', alignItems: 'center' }}>
      {/* Fallback horizontal bar (simple, no custom CSS) */}
      <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, minWidth: 80, transform: 'rotate(-90deg)' }} />
    </Box>
  );
}

function dbToPercent(db: number): number {
  if (typeof db !== 'number' || !isFinite(db)) return 0;
  const minDb = -60;
  const maxDb = 0;
  if (db <= minDb) return 0;
  if (db >= maxDb) return 100;
  return ((db - minDb) / (maxDb - minDb)) * 100;
}
