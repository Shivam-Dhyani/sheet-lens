import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../store/session.ts';
import { DropZone } from '../intake/DropZone.tsx';
import { markFilesAdded } from '../../lib/network-log.ts';

async function sampleFile(name: string): Promise<File> {
  const res = await fetch(`samples/${name}`);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type });
}

export function LandingPage() {
  const navigate = useNavigate();
  const { mode, setMode, slots, openFile, runCompare, phase, error } = useSession();
  const [busy, setBusy] = useState(false);

  const oldReady = Boolean(slots.old?.meta);
  const newReady = Boolean(slots.new?.meta);
  const canCompare = oldReady && newReady && phase !== 'comparing';

  const onFile = (slot: 'old' | 'new') => async (file: File): Promise<void> => {
    markFilesAdded();
    await openFile(slot, file);
  };

  const compare = async (): Promise<void> => {
    await runCompare();
    navigate('/compare');
  };

  const trySamples = async (): Promise<void> => {
    setBusy(true);
    try {
      markFilesAdded();
      const [oldF, newF] = await Promise.all([
        sampleFile('Sales_Register_Sep2026_v1.xlsx'),
        sampleFile('Sales_Register_Sep2026_FINAL.xlsx'),
      ]);
      await openFile('old', oldF);
      await openFile('new', newF);
      await runCompare();
      navigate('/compare');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <h1>See every hidden change in your spreadsheets.</h1>
        <p>Compare two Excel files in seconds. Your files never leave this device.</p>
      </section>

      <div className="mode-tabs" role="tablist" aria-label="Mode">
        <button role="tab" aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>
          Compare two files
        </button>
        <button role="tab" aria-pressed={mode === 'merge'} onClick={() => setMode('merge')} disabled>
          Merge two edited copies
        </button>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="dropzones">
        <DropZone
          label="Old file"
          hint="Drag the earlier version here, or choose a file."
          fileName={slots.old?.fileName}
          onFile={onFile('old')}
          onError={(m) => useSession.setState({ error: m })}
        />
        <DropZone
          label="New file"
          hint="Drag the revised version here, or choose a file."
          fileName={slots.new?.fileName}
          onFile={onFile('new')}
          onError={(m) => useSession.setState({ error: m })}
        />
      </div>

      <div className="actions">
        <button className="btn" onClick={compare} disabled={!canCompare}>
          {phase === 'comparing' ? 'Comparing…' : 'Compare'}
        </button>
        <button className="btn secondary" onClick={trySamples} disabled={busy}>
          Try with sample files
        </button>
      </div>
    </main>
  );
}
