import { useEffect, useState } from 'react';
import FaderStrip from './components/FaderStrip';
import ChannelEditor from './components/ChannelEditor';
import StatusBar from './components/StatusBar';
import { QSysAdapter } from './adapters/QSysAdapter';
import { Channel } from './types/Channel';
import { loadChannels } from './config/channels.loader';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';

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

  const theme = createTheme({ palette: { mode: 'dark' } });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth={false} sx={{ py: 1 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
          <StatusBar status={status} />
          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            <Button variant="outlined" size="small" onClick={() => setEditing(true)}>Kanäle bearbeiten</Button>
          </Stack>
        </Stack>
        <Grid container spacing={2} alignItems="stretch">
          {channels.map((c: Channel) => (
            <Grid item key={c.id} xs={12} sm={6} md={4} lg={3} xl={2}>
              <FaderStrip channel={c} adapter={adapter} />
            </Grid>
          ))}
        </Grid>
        <ChannelEditor
          open={editing}
          channels={channels}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            loadChannels().then(setChannels);
          }}
        />
      </Container>
    </ThemeProvider>
  );
}

