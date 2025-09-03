import { useEffect, useState } from 'react';
import FaderStrip from './components/FaderStrip';
import ChannelEditor from './components/ChannelEditor';
import StatusBar from './components/StatusBar';
import { QSysAdapter } from './adapters/QSysAdapter';
import { Channel } from './types/Channel';
import { loadChannels } from './config/channels.loader';
import './styles/app.css';

const adapter = new QSysAdapter();

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [status, setStatus] = useState('connecting');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadChannels().then(setChannels);
    adapter.onStatus(setStatus);
    adapter.connect();
  }, []);

  return (
    <div className="app">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px' }}>
        <StatusBar status={status} />
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => setEditing(true)}>Kanäle bearbeiten</button>
      </div>
      <div className="strips">
        {channels.map((c: Channel) => (
          <FaderStrip key={c.id} channel={c} adapter={adapter} />
        ))}
      </div>
      <ChannelEditor
        open={editing}
        channels={channels}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          setEditing(false);
          // Neuladen aus Gateway, um Quelle der Wahrheit zu bleiben
          loadChannels().then(setChannels);
        }}
      />
    </div>
  );
}
