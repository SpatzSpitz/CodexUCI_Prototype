import { useTranslation } from 'react-i18next';

interface Props {
  status: string;
}

export default function StatusBar({ status }: Props) {
  const { t } = useTranslation();
  return <div className={`status ${status}`}>{t(status)}</div>;
}
