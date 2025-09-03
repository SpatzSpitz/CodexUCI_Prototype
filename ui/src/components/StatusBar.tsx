import Chip from '@mui/material/Chip';

interface Props { status: string; }

export default function StatusBar({ status }: Props) {
  const color = status === 'connected' ? 'success' : status === 'reconnecting' ? 'warning' : status === 'error' ? 'error' : 'default';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Chip size="small" color={color as any} label={label} variant={color === 'default' ? 'outlined' : 'filled'} />;
}
