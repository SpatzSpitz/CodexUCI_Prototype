import { useEffect, useState } from 'react';
import FaderStrip from './components/FaderStrip';
import LightCard from './components/LightCard';
import StatusBar from './components/StatusBar';
import AssetEditor from './components/AssetEditor';
import { QSysAdapter } from './adapters/QSysAdapter';
import { Channel } from './types/Channel';
import { Asset } from './types/Asset';
import { loadAssets } from './config/assets.loader';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import { useAssetsByLocation } from './hooks/useAssetsByLocation';
import { useAssetsByCategory } from './hooks/useAssetsByCategory';

const adapter = new QSysAdapter();

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [status, setStatus] = useState('connecting');
  const [editingAssets, setEditingAssets] = useState(false);
  const [mode, setMode] = useState<'byLocation' | 'byCategory'>('byLocation');
  const [activeCategory, setActiveCategory] = useState<string>('audio');
  const [selection, setSelection] = useState<{ building?: string; floor?: string; room?: string }>({});

  useEffect(() => {
    loadAssets().then(setAssets);
    adapter.onStatus(setStatus);
    adapter.connect();
  }, []);

  const theme = createTheme({ palette: { mode: 'dark' } });
  const tree = useAssetsByLocation(assets) as any;
  const byCat = useAssetsByCategory(assets) as any;
  const categories = Array.from(new Set(assets.map(a => a.category))).sort();

  const roomsForSelection = () => {
    const { building, floor } = selection;
    if (!building || !floor) return [] as string[];
    return Object.keys(tree[building]?.[floor] || {});
  };

  const assetsInSelectedRoom = () => {
    const { building, floor, room } = selection;
    if (!building || !floor || !room) return [] as Asset[];
    return tree[building]?.[floor]?.[room] || [];
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth={false} sx={{ py: 1 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
          <StatusBar status={status} />
          <Tabs value={mode === 'byLocation' ? 0 : 1} onChange={(_, v) => setMode(v === 0 ? 'byLocation' : 'byCategory')} sx={{ ml: 'auto' }}>
            <Tab label="Orte" />
            <Tab label="Kategorien" />
          </Tabs>
          <Button variant="outlined" size="small" onClick={() => setEditingAssets(true)}>Assets verwalten</Button>
        </Stack>
        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} md={3} lg={2}>
            {mode === 'byLocation' ? (
              <Stack spacing={1}>
                <List dense>
                  {Object.keys(tree).map((b: string) => (
                    <ListItem key={b} selected={selection.building === b} onClick={() => setSelection({ building: b, floor: undefined, room: undefined })}>
                      <ListItemText primary={b} />
                    </ListItem>
                  ))}
                </List>
                <Divider />
                {selection.building && (
                  <List dense>
                    {Object.keys(tree[selection.building] || {}).map((f: string) => (
                      <ListItem key={f} selected={selection.floor === f} onClick={() => setSelection(s => ({ ...s, floor: f, room: undefined }))}>
                        <ListItemText primary={f} />
                      </ListItem>
                    ))}
                  </List>
                )}
                <Divider />
                {selection.building && selection.floor && (
                  <List dense>
                    {roomsForSelection().map((r: string) => (
                      <ListItem key={r} selected={selection.room === r} onClick={() => setSelection(s => ({ ...s, room: r }))}>
                        <ListItemText primary={r} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Stack>
            ) : (
              <List dense>
                {categories.map((c: string) => (
                  <ListItem key={c} selected={activeCategory === c} onClick={() => setActiveCategory(c)}>
                    <ListItemText primary={c} />
                  </ListItem>
                ))}
              </List>
            )}
          </Grid>

          <Grid item xs={12} md={9} lg={10}>
            <Grid container spacing={2} alignItems="stretch">
              {mode === 'byLocation' && assetsInSelectedRoom().length > 0 && assetsInSelectedRoom().map((a: Asset) => (
                a.category === 'audio' && a.adapter === 'QSYS' ? (
                  <Grid item key={a.id} xs="auto">
                    {(() => {
                      const c = {
                        id: a.id,
                        label: a.name,
                        order: 0,
                        controls: {
                          gain: typeof (a.controls as any).gain === 'string' ? (a.controls as any).gain : (a.controls as any).gain?.id,
                          mute: typeof (a.controls as any).mute === 'string' ? (a.controls as any).mute : (a.controls as any).mute?.id,
                          level: typeof (a.controls as any).level === 'string' ? (a.controls as any).level : (a.controls as any).level?.id,
                        },
                        icon: a.icon,
                      } as Channel;
                      return <FaderStrip channel={c} adapter={adapter} />;
                    })()}
                  </Grid>
                ) : a.category === 'light' ? (
                  <Grid item key={a.id} xs="auto">
                    <LightCard asset={a} adapter={adapter} />
                  </Grid>
                ) : null
              ))}

              {mode === 'byCategory' && Object.entries(byCat[activeCategory] || {}).map(([loc, list]: [string, Asset[]]) => (
                <Grid item key={loc} xs={12}>
                  <Divider textAlign="left">{loc}</Divider>
                  <Grid container spacing={2} alignItems="stretch" sx={{ mt: 1 }}>
                    {list.map((a: Asset) => (
                      a.category === 'audio' && a.adapter === 'QSYS' ? (
                        <Grid item key={a.id} xs="auto">
                          {(() => {
                            const c = {
                              id: a.id,
                              label: a.name,
                              order: 0,
                              controls: {
                                gain: typeof (a.controls as any).gain === 'string' ? (a.controls as any).gain : (a.controls as any).gain?.id,
                                mute: typeof (a.controls as any).mute === 'string' ? (a.controls as any).mute : (a.controls as any).mute?.id,
                                level: typeof (a.controls as any).level === 'string' ? (a.controls as any).level : (a.controls as any).level?.id,
                              },
                              icon: a.icon,
                            } as Channel;
                            return <FaderStrip channel={c} adapter={adapter} />;
                          })()}
                        </Grid>
                      ) : a.category === 'light' ? (
                        <Grid item key={a.id} xs="auto">
                          <LightCard asset={a} adapter={adapter} />
                        </Grid>
                      ) : null
                    ))}
                  </Grid>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Container>
      <AssetEditor
        open={editingAssets}
        onClose={() => setEditingAssets(false)}
        onSaved={() => { setEditingAssets(false); loadAssets().then(setAssets); }}
      />
    </ThemeProvider>
  );
}

