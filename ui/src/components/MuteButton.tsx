import { useTranslation } from 'react-i18next';

interface Props {
  active: boolean;
  onToggle: () => void;
}

export default function MuteButton({ active, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <button className={`mute ${active ? 'on' : 'off'}`} onClick={onToggle}>
      {active ? t('mute') : t('unmute')}
    </button>
  );
}
