import { useTranslation } from 'react-i18next';
import ToggleButton from '@mui/material/ToggleButton';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

interface Props {
  active: boolean;
  onToggle: () => void;
}

export default function MuteButton({ active, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <ToggleButton
      value="mute"
      selected={active}
      onChange={onToggle}
      aria-label={active ? t('mute') : t('unmute')}
      sx={{ borderRadius: 2, width: 56, height: 48 }}
    >
      <PowerSettingsNewIcon color={active ? 'error' : 'success'} />
    </ToggleButton>
  );
}
