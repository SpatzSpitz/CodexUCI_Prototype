import { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { IconByKey } from './icons';
import type { Asset } from '../types/Asset';
import { loadAssetsDoc, saveAssets, fetchGiraUiConfig } from '../config/assets.loader';

type ControlsRow = { key: string; typed: boolean; value: string; id?: string; type?: string; min?: number; max?: number; step?: number; unit?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function AssetEditor({ open, onClose, onSaved }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(false);
  const [pickerIdx, setPickerIdx] = useState<{ asset: number; controlKey: string } | null>(null);
  const [uiconfig, setUiconfig] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  // Flatten hierarchical locations and build function->location path map
  const flatLocs = useMemo(() => {
    const roots = (uiconfig?.data?.locations || []) as any[];
    type FlatLoc = { path: string; node: any };
    const acc: FlatLoc[] = [];
    const walk = (node: any, pathParts: string[]) => {
      const name = node?.displayName || node?.name || node?.id || '';
      const nextPath = name ? [...pathParts, name] : pathParts;
      const pathStr = nextPath.join(' / ');
      const hasChildren = Array.isArray(node?.locations) && node.locations.length > 0;
      const hasFuncs = Array.isArray(node?.functions) && node.functions.length > 0;
      if (hasChildren || hasFuncs) acc.push({ path: pathStr, node });
      if (hasChildren) node.locations.forEach((child: any) => walk(child, nextPath));
    };
    roots.forEach(r => walk(r, []));
    return acc;
  }, [uiconfig]);

  const fToLocPath = useMemo(() => {
    const roots = (uiconfig?.data?.locations || []) as any[];
    const map = new Map<string, string>();
    const walk = (node: any, pathParts: string[]) => {
      const name = node?.displayName || node?.name || node?.id || '';
      const nextPath = name ? [...pathParts, name] : pathParts;
      const pathStr = nextPath.join(' / ');
      const funcs = Array.isArray(node?.functions) ? node.functions : [];
      funcs.forEach((uid: string) => { if (!map.has(uid)) map.set(uid, pathStr); });
      const children = Array.isArray(node?.locations) ? node.locations : [];
      children.forEach((child: any) => walk(child, nextPath));
    };
    roots.forEach(r => walk(r, []));
    return map;
  }, [uiconfig]);

  const collectFuncSet = (node: any): Set<string> => {
    const set = new Set<string>();
    const walk = (n: any) => {
      if (Array.isArray(n?.functions)) n.functions.forEach((id: string) => set.add(String(id)));
      if (Array.isArray(n?.locations)) n.locations.forEach((c: any) => walk(c));
    };
    if (node) walk(node);
    return set;
  };

  useEffect(() => {
    if (open) {
      loadAssetsDoc().then(d => { setDoc(d); setAssets(d.assets || []); });
    }
  }, [open]);

  const addAsset = () => {
    setAssets(prev => [...prev, {
      id: `asset_${Date.now()}`,
      name: 'Neues Asset',
      category: 'audio',
      adapter: 'QSYS',
      location: { building: '', floor: '', room: '' },
      controls: {},
      icon: 'mic',
    } as any]);
  };
  const delAsset = (idx: number) => setAssets(prev => prev.filter((_, i) => i !== idx));

  const setField = (idx: number, field: keyof Asset, value: any) => {
    setAssets(prev => prev.map((a, i) => (i === idx ? { ...a, [field]: value } as Asset : a)));
  };
  const setLocation = (idx: number, k: 'building'|'floor'|'room', v: string) => {
    setAssets(prev => prev.map((a, i) => (i === idx ? { ...a, location: { ...a.location, [k]: v } } as Asset : a)));
  };

  const controlRows = (a: Asset): ControlsRow[] => {
    const rows: ControlsRow[] = [];
    Object.entries(a.controls || {}).forEach(([key, def]) => {
      if (typeof def === 'string') rows.push({ key, typed: false, value: def });
      else rows.push({ key, typed: true, value: '', id: (def as any).id, type: (def as any).type, min: (def as any).min, max: (def as any).max, step: (def as any).step, unit: (def as any).unit });
    });
    return rows;
  };
  const setControlRows = (idx: number, rows: ControlsRow[]) => {
    const map: any = {};
    rows.forEach(r => {
      if (!r.key) return;
      if (r.typed) {
        map[r.key] = { id: r.id || '', ...(r.type ? { type: r.type } : {}), ...(r.min != null ? { min: r.min } : {}), ...(r.max != null ? { max: r.max } : {}), ...(r.step != null ? { step: r.step } : {}), ...(r.unit ? { unit: r.unit } : {}) };
      } else {
        map[r.key] = r.value || '';
      }
    });
    setAssets(prev => prev.map((a, i) => (i === idx ? { ...a, controls: map } as Asset : a)));
  };

  const addControlRow = (idx: number) => {
    const rows = controlRows(assets[idx]);
    rows.push({ key: '', typed: false, value: '' });
    setControlRows(idx, rows);
  };
  const delControlRow = (idx: number, rIndex: number) => {
    const rows = controlRows(assets[idx]).filter((_, i) => i !== rIndex);
    setControlRows(idx, rows);
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...(doc || {}), assets } as any;
      const res = await saveAssets(payload);
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch (e: any) {
      alert('Speichern fehlgeschlagen: ' + e.message + '\nBitte Gateway-Log auf Warnungen prüfen.');
    } finally {
      setBusy(false);
    }
  };

  // Preserve full document on save; no separate adapter extraction needed

  const openGiraPicker = async (assetIdx: number, controlKey: string) => {
    setPickerIdx({ asset: assetIdx, controlKey });
    try {
      const data = await fetchGiraUiConfig();
      setUiconfig((prev: any) => ({ ...(prev || {}), data }));
    } catch (e: any) {
      alert('Gira uiconfig Laden fehlgeschlagen: ' + (e.message || e));
    }
  };

  const applyGiraUid = (uid: string) => {
    if (!pickerIdx) return;
    const a = assets[pickerIdx.asset];
    const rows = controlRows(a).map(r => {
      if (r.key === pickerIdx.controlKey) {
        if (a.adapter === 'GiraX1') {
          if (r.typed) return { ...r, id: uid };
          else return { ...r, value: uid };
        }
      }
      return r;
    });
    setControlRows(pickerIdx.asset, rows);
    setPickerIdx(null);
  };

  const categoryOptions = ['audio','light','sensor','climate','video','custom'];
  const adapterOptions = ['QSYS','GiraX1'];

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogTitle>Assets verwalten</DialogTitle>
      <DialogContent dividers sx={{ p: 2 }}>
        <Stack spacing={2}>
          {assets.map((a, idx) => {
            const rows = controlRows(a);
            return (
              <Stack key={a.id || idx} spacing={1} sx={{ p: 1.5, borderRadius: 1, border: theme => `1px solid ${theme.palette.divider}` }}>
                <Grid container spacing={1} alignItems="center">
                  <Grid item xs={12} sm={4} md={3}><TextField label="ID" size="small" value={a.id} onChange={e => setField(idx,'id',e.target.value)} fullWidth /></Grid>
                  <Grid item xs={12} sm={4} md={3}><TextField label="Name" size="small" value={a.name} onChange={e => setField(idx,'name',e.target.value)} fullWidth /></Grid>
                  <Grid item xs={6} sm={2} md={2}>
                    <Select size="small" fullWidth value={a.category} onChange={e => setField(idx,'category',e.target.value)}>
                      {categoryOptions.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                  </Grid>
                  <Grid item xs={6} sm={2} md={2}>
                    <Select size="small" fullWidth value={a.adapter} onChange={e => setField(idx,'adapter',e.target.value)}>
                      {adapterOptions.map(ad => <MenuItem key={ad} value={ad}>{ad}</MenuItem>)}
                    </Select>
                  </Grid>
                  <Grid item xs={12} sm={12} md={2} sx={{ textAlign: { xs:'left', md:'right' } }}>
                    <Tooltip title="Asset löschen">
                      <span><IconButton color="error" onClick={() => delAsset(idx)} aria-label="löschen"><DeleteIcon /></IconButton></span>
                    </Tooltip>
                  </Grid>
                </Grid>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={4}><TextField label="Gebäude" size="small" value={a.location?.building||''} onChange={e => setLocation(idx,'building',e.target.value)} fullWidth /></Grid>
                  <Grid item xs={12} sm={4}><TextField label="Etage" size="small" value={a.location?.floor||''} onChange={e => setLocation(idx,'floor',e.target.value)} fullWidth /></Grid>
                  <Grid item xs={12} sm={4}><TextField label="Raum" size="small" value={a.location?.room||''} onChange={e => setLocation(idx,'room',e.target.value)} fullWidth /></Grid>
                  <Grid item xs={12}><TextField label="Icon" size="small" value={a.icon||''} onChange={e => setField(idx,'icon',e.target.value)} fullWidth /></Grid>
                </Grid>
                <Divider textAlign="left">Controls</Divider>
                <Stack spacing={1}>
                  {rows.map((r, rIdx) => (
                    <Grid key={rIdx} container spacing={1} alignItems="center">
                      <Grid item xs={12} sm={3}><TextField label="Key" size="small" value={r.key} onChange={e => { const copy=[...rows]; copy[rIdx]={...copy[rIdx], key:e.target.value}; setControlRows(idx,copy); }} fullWidth /></Grid>
                      {!r.typed ? (
                        <>
                          <Grid item xs={12} sm={6}><TextField label="Value" size="small" value={r.value} onChange={e => { const copy=[...rows]; copy[rIdx]={...copy[rIdx], value:e.target.value}; setControlRows(idx,copy); }} fullWidth /></Grid>
                          <Grid item xs={6} sm={2}><Button size="small" onClick={() => { const copy=[...rows]; copy[rIdx]={...copy[rIdx], typed:true, id: r.value, value:''}; setControlRows(idx,copy); }}>typed</Button></Grid>
                        </>
                      ) : (
                        <>
                          <Grid item xs={12} sm={3}><TextField label="id" size="small" value={r.id||''} onChange={e => { const copy=[...rows]; copy[rIdx]={...copy[rIdx], id:e.target.value}; setControlRows(idx,copy); }} fullWidth /></Grid>
                          <Grid item xs={6} sm={2}><TextField label="type" size="small" value={r.type||''} onChange={e => { const copy=[...rows]; copy[rIdx]={...copy[rIdx], type:e.target.value}; setControlRows(idx,copy); }} fullWidth /></Grid>
                          <Grid item xs={3} sm={1}><TextField label="min" type="number" size="small" value={r.min??''} onChange={e => { const copy=[...rows]; copy[rIdx]={...copy[rIdx], min:e.target.value===''?undefined:Number(e.target.value)}; setControlRows(idx,copy); }} fullWidth /></Grid>
                          <Grid item xs={3} sm={1}><TextField label="max" type="number" size="small" value={r.max??''} onChange={e => { const copy=[...rows]; copy[rIdx]={...copy[rIdx], max:e.target.value===''?undefined:Number(e.target.value)}; setControlRows(idx,copy); }} fullWidth /></Grid>
                          <Grid item xs={3} sm={1}><TextField label="step" type="number" size="small" value={r.step??''} onChange={e => { const copy=[...rows]; copy[rIdx]={...copy[rIdx], step:e.target.value===''?undefined:Number(e.target.value)}; setControlRows(idx,copy); }} fullWidth /></Grid>
                          <Grid item xs={3} sm={1}><TextField label="unit" size="small" value={r.unit||''} onChange={e => { const copy=[...rows]; copy[rIdx]={...copy[rIdx], unit:e.target.value}; setControlRows(idx,copy); }} fullWidth /></Grid>
                          <Grid item xs={6} sm={2}><Button size="small" onClick={() => { const copy=[...rows]; copy[rIdx]={ key: r.key, typed:false, value: r.id||'' }; setControlRows(idx,copy); }}>plain</Button></Grid>
                        </>
                      )}
                      <Grid item xs={6} sm={1} sx={{ textAlign:'right' }}>
                        <Tooltip title="Control löschen"><span><IconButton color="error" onClick={() => delControlRow(idx, rIdx)}><DeleteIcon /></IconButton></span></Tooltip>
                      </Grid>
                      {assets[idx].adapter === 'GiraX1' && (
                        <Grid item xs={12}>
                          <Button size="small" variant="outlined" onClick={() => openGiraPicker(idx, r.key || '')}>Aus Gira wählen…</Button>
                        </Grid>
                      )}
                    </Grid>
                  ))}
                  <Button startIcon={<AddIcon />} onClick={() => addControlRow(idx)}>Control hinzufügen</Button>
                </Stack>
              </Stack>
            );
          })}
          <Stack direction="row" spacing={1}>
            <Button startIcon={<AddIcon />} onClick={addAsset}>Asset hinzufügen</Button>
            <Typography variant="caption" color="text.secondary">Pflichtfelder: id, name, category, adapter, location, controls</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Schließen</Button>
        <Button onClick={save} variant="contained" disabled={busy}>Speichern</Button>
      </DialogActions>

      {/* Minimal Gira Picker */}
      {pickerIdx && (
        <Dialog open onClose={() => setPickerIdx(null)} fullWidth maxWidth="lg">
          <DialogTitle>Gira Datenpunkt wählen</DialogTitle>
          <DialogContent dividers>
            {!uiconfig?.data ? (
              <Typography variant="body2">Lade…</Typography>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2">Räume</Typography>
                  <Stack spacing={0.5} sx={{ maxHeight: 380, overflow: 'auto' }}>
                    {flatLocs.map(({ path, node }) => (
                      <Button
                        key={path}
                        size="small"
                        onClick={() => setUiconfig((p: any) => ({ ...p, selLoc: node, selLocPath: path, selSet: collectFuncSet(node) }))}
                      >
                        {path || 'Unbekannt'}
                      </Button>
                    ))}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2">Funktionen</Typography>
                  <Stack spacing={0.5} sx={{ maxHeight: 380, overflow: 'auto' }}>
                    {((uiconfig.data.functions || []) as any[])
                      .filter((f: any) => {
                        const set: Set<string> | undefined = uiconfig?.selSet;
                        if (!set || set.size === 0) return true;
                        const id = String(f.uid || f.id);
                        return set.has(id);
                      })
                      .map((f: any) => {
                        const name = f.displayName || f.name || f.uid;
                        const locName = fToLocPath.get(String(f.uid || f.id)) || '';
                        const label = locName ? `${name} — ${locName}` : name;
                        return (
                          <Button key={f.uid || f.id} size="small" onClick={() => setUiconfig((p: any) => ({ ...p, selFn: f }))}>
                            {label}
                          </Button>
                        );
                      })}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2">Datenpunkte</Typography>
                  <Stack spacing={0.5} sx={{ maxHeight: 380, overflow: 'auto' }}>
                    {(uiconfig.selFn?.dataPoints || []).map((dp: any) => {
                      const base = dp.name || dp.uid;
                      const locName = fToLocPath.get(String(uiconfig?.selFn?.uid || uiconfig?.selFn?.id)) || '';
                      const label = locName ? `${base} — ${locName}` : base;
                      return (
                        <Button key={dp.uid} size="small" onClick={() => applyGiraUid(dp.uid)}>
                          {label}
                        </Button>
                      );
                    })}
                  </Stack>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPickerIdx(null)}>Schließen</Button>
          </DialogActions>
        </Dialog>
      )}
    </Dialog>
  );
}
