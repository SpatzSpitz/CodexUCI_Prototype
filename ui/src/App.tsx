import { useEffect, useState } from 'react';
import FaderStrip from './components/FaderStrip';
import StatusBar from './components/StatusBar';
import { QSysAdapter } from './adapters/QSysAdapter';
import { Channel } from './types/Channel';
import { loadChannels } from './config/channels.loader';
import './styles/app.css';

const adapter = new QSysAdapter();

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    loadChannels().then(setChannels);
    adapter.onStatus(setStatus);
    adapter.connect();
  }, []);

  return (
    <div className="app">
      <StatusBar status={status} />
      <div className="strips">
        {channels.map((c: Channel) => (
          <FaderStrip key={c.id} channel={c} adapter={adapter} />
        ))}
      </div>
    </div>
  );
}
