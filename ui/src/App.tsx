import { useEffect, useState } from 'react';
import FaderStrip from './components/FaderStrip';
import StatusBar from './components/StatusBar';
import { QSysAdapter } from './adapters/QSysAdapter';
import { Channel } from './types/Channel';
import { Asset } from './types/Asset';
import { loadAssets } from './config/assets.loader';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';

const adapter = new QSysAdapter();

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [status, setStatus] = useState('connecting');
  // Editor hidden/disabled in phase 1

  useEffect(() => {
    loadAssets().then(setAssets);
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
        </Stack>
        <Grid container spacing={2} alignItems="stretch">
          {assets
            .filter(a => a.category === 'audio' && a.adapter === 'QSYS')
            .map((a, idx) => ({
              id: a.id,
              label: a.name,
              order: idx,
              controls: {
                gain: typeof (a.controls as any).gain === 'string' ? (a.controls as any).gain : (a.controls as any).gain?.id,
                mute: typeof (a.controls as any).mute === 'string' ? (a.controls as any).mute : (a.controls as any).mute?.id,
                level: typeof (a.controls as any).level === 'string' ? (a.controls as any).level : (a.controls as any).level?.id,
              },
              icon: a.icon,
            }) as Channel)
            .map((c: Channel) => (
            <Grid item key={c.id} xs={12} sm={6} md={4} lg={3} xl={2}>
              <FaderStrip channel={c} adapter={adapter} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </ThemeProvider>
  );
}

