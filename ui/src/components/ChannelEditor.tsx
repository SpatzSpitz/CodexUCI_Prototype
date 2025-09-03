import { useEffect, useMemo, useState } from "react";
import { Channel } from "../types/Channel";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Tooltip from "@mui/material/Tooltip";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import Typography from "@mui/material/Typography";
import { IconByKey } from "./icons";
import IconPickerDialog from "./IconPickerDialog";

 type Props = {
  open: boolean;
  channels: Channel[];
  onClose: () => void;
  onSaved: (updated: Channel[]) => void;
};

export default function ChannelEditor({ open, channels, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Channel[]>([]);
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(() => [...draft].sort((a, b) => a.order - b.order), [draft]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) setDraft(channels.map(c => ({ ...c, controls: { ...c.controls } })));
  }, [open, channels]);

  const setField = (idx: number, field: keyof Channel, value: any) => {
    setDraft(prev => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };
  const setControl = (idx: number, key: keyof Channel["controls"], value: string) => {
    setDraft(prev => prev.map((c, i) => (i === idx ? { ...c, controls: { ...c.controls, [key]: value } } : c)));
  };
  const addRow = () => {
    const nextOrder = (draft.at(-1)?.order ?? draft.length) + 1;
    setDraft(prev => [...prev, { id: `ch_${Date.now()}`, label: "New", order: nextOrder, icon: "mic", controls: { gain: "", mute: "", level: "" } }]);
  };
  const delRow = (idx: number) => setDraft(prev => prev.filter((_, i) => i !== idx));

  const save = async () => {
    setBusy(true);
    try {
      const payload = { channels: draft };
      const res = await fetch("http://localhost:8080/channels.json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved(draft);
    } catch (e: any) {
      alert("Speichern fehlgeschlagen: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Kanäle bearbeiten</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {sorted.map((c, visualIdx) => {
            const idx = draft.findIndex(d => d.id === c.id);
            const icon = draft[idx].icon;
            return (
              <Stack key={c.id || visualIdx} spacing={1} sx={{ p: 1, borderRadius: 1, border: theme => `1px solid ${theme.palette.divider}` }}>
                {/* Zeile 1: ID, Label, Order, Icon */}
                <Grid container spacing={1} alignItems="center">
                  <Grid item xs={12} sm={4} md={3}><TextField label="ID" size="small" value={draft[idx].id} onChange={e => setField(idx, 'id', e.target.value)} fullWidth /></Grid>
                  <Grid item xs={12} sm={4} md={3}><TextField label="Label" size="small" value={draft[idx].label} onChange={e => setField(idx, 'label', e.target.value)} fullWidth /></Grid>
                  <Grid item xs={6} sm={2} md={2}><TextField label="Order" size="small" type="number" value={draft[idx].order} onChange={e => setField(idx, 'order', Number(e.target.value))} fullWidth /></Grid>
                  <Grid item xs={6} sm={2} md={2}>
                    <Button variant="outlined" size="small" onClick={() => { setPickerIndex(idx); setPickerOpen(true); }} startIcon={<IconByKey name={icon} />} fullWidth>
                      {icon || 'mic'}
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={12} md={2} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                    <Tooltip title="Zeile löschen">
                      <span>
                        <IconButton color="error" onClick={() => delRow(idx)} disabled={busy} aria-label="Zeile löschen"><DeleteIcon /></IconButton>
                      </span>
                    </Tooltip>
                  </Grid>
                </Grid>
                {/* Zeile 2: Controls */}
                <Grid container spacing={1} alignItems="center">
                  <Grid item xs={12} sm={4} md={4}><TextField label="Gain" size="small" value={draft[idx].controls.gain} onChange={e => setControl(idx, 'gain', e.target.value)} fullWidth /></Grid>
                  <Grid item xs={12} sm={4} md={4}><TextField label="Mute" size="small" value={draft[idx].controls.mute} onChange={e => setControl(idx, 'mute', e.target.value)} fullWidth /></Grid>
                  <Grid item xs={12} sm={4} md={4}><TextField label="Level" size="small" value={draft[idx].controls.level} onChange={e => setControl(idx, 'level', e.target.value)} fullWidth /></Grid>
                </Grid>
              </Stack>
            );
          })}
          <Stack direction="row" spacing={1}>
            <Button startIcon={<AddIcon />} onClick={addRow} disabled={busy}>Kanal hinzufügen</Button>
            <Typography variant="caption" color="text.secondary">IDs müssen eindeutig sein.</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Schließen</Button>
        <Button onClick={save} variant="contained" disabled={busy}>Speichern</Button>
      </DialogActions>
      <IconPickerDialog
        open={pickerOpen}
        value={pickerIndex != null ? draft[pickerIndex]?.icon : undefined}
        onClose={() => setPickerOpen(false)}
        onSelect={(key) => { if (pickerIndex != null) setField(pickerIndex, 'icon', key); setPickerOpen(false); }}
      />
    </Dialog>
  );
}

