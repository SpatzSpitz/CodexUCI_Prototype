import { useEffect, useMemo, useState } from 'react';
import { Channel } from '../types/Channel';

type Props = {
  open: boolean;
  channels: Channel[];
  onClose: () => void;
  onSaved: (updated: Channel[]) => void;
};

// Simple editor overlay for channels.json (id, label, order, controls)
export default function ChannelEditor({ open, channels, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Channel[]>([]);
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(() => [...draft].sort((a, b) => a.order - b.order), [draft]);

  useEffect(() => {
    if (open) setDraft(channels.map(c => ({ ...c, controls: { ...c.controls } })));
  }, [open, channels]);

  if (!open) return null;

  const setField = (idx: number, field: keyof Channel, value: any) => {
    setDraft(prev => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };
  const setControl = (idx: number, key: keyof Channel['controls'], value: string) => {
    setDraft(prev => prev.map((c, i) => (i === idx ? { ...c, controls: { ...c.controls, [key]: value } } : c)));
  };
  const addRow = () => {
    const nextOrder = (draft.at(-1)?.order ?? draft.length) + 1;
    setDraft(prev => [...prev, { id: `ch_${Date.now()}`, label: 'New', order: nextOrder, controls: { gain: '', mute: '', level: '' } }]);
  };
  const delRow = (idx: number) => setDraft(prev => prev.filter((_, i) => i !== idx));

  const save = async () => {
    setBusy(true);
    try {
      const payload = { channels: draft };
      const res = await fetch('http://localhost:8080/channels.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved(draft);
    } catch (e) {
      alert('Speichern fehlgeschlagen: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>Kanäle bearbeiten</h2>
          <div className="spacer" />
          <button className="btn" onClick={onClose} disabled={busy}>Schließen</button>
          <button className="btn primary" onClick={save} disabled={busy}>Speichern</button>
        </div>
        <div className="editor">
          <div className="table head">
            <div>ID</div>
            <div>Label</div>
            <div>Order</div>
            <div>Gain</div>
            <div>Mute</div>
            <div>Level</div>
            <div></div>
          </div>
          {sorted.map((c, visualIdx) => {
            const idx = draft.findIndex(d => d.id === c.id);
            return (
              <div className="table row" key={c.id}>
                <input value={draft[idx].id} onChange={e => setField(idx, 'id', e.target.value)} />
                <input value={draft[idx].label} onChange={e => setField(idx, 'label', e.target.value)} />
                <input type="number" value={draft[idx].order} onChange={e => setField(idx, 'order', Number(e.target.value))} />
                <input value={draft[idx].controls.gain} onChange={e => setControl(idx, 'gain', e.target.value)} />
                <input value={draft[idx].controls.mute} onChange={e => setControl(idx, 'mute', e.target.value)} />
                <input value={draft[idx].controls.level} onChange={e => setControl(idx, 'level', e.target.value)} />
                <button className="btn danger" onClick={() => delRow(idx)} disabled={busy}>Löschen</button>
              </div>
            );
          })}
          <div className="editor-actions">
            <button className="btn" onClick={addRow} disabled={busy}>+ Kanal hinzufügen</button>
          </div>
        </div>
      </div>
    </div>
  );
}

