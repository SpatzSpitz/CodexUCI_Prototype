import { useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { allIconOptions, IconByKey } from './icons';

type Props = {
  open: boolean;
  value?: string;
  onClose: () => void;
  onSelect: (key: string) => void;
};

export default function IconPickerDialog({ open, value, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allIconOptions.filter(i => !q || i.key.includes(q));
  }, [query]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Icon wählen</DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          size="small"
          margin="normal"
          placeholder="Suche…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <Grid container spacing={1}>
          {items.map(i => (
            <Grid item key={i.key} xs={2} sm={1.5} md={1} lg={1}>
              <Tooltip title={i.label}>
                <IconButton color={value === i.key ? 'primary' : 'default'} onClick={() => onSelect(i.key)}>
                  <IconByKey name={i.key} />
                </IconButton>
              </Tooltip>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
    </Dialog>
  );
}
