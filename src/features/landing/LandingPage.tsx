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
  const { mode, setMode, slots, merge, openFile, runCompare, planMerge, setMergeLabel, phase, error } =
    useSession();
  const [busy, setBusy] = useState(false);

  const setError = (m: string): void => useSession.setState({ error: m });

  /* compare */
  const canCompare = Boolean(slots.old?.meta) && Boolean(slots.new?.meta) && phase !== 'comparing';
  const onFile = (slot: 'old' | 'new' | 'base' | 'a' | 'b') => async (file: File): Promise<void> => {
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

  /* merge */
  const canMerge =
    Boolean(slots.base?.meta) && Boolean(slots.a?.meta) && Boolean(slots.b?.meta) && merge.phase !== 'planning';
  const doPlan = async (): Promise<void> => {
    await planMerge();
    navigate('/merge');
  };
  const tryMergeSamples = async (): Promise<void> => {
    setBusy(true);
    try {
      markFilesAdded();
      const [orig, ravi, priya] = await Promise.all([
        sampleFile('Sales_Register_Sep2026_ORIGINAL.xlsx'),
        sampleFile('Sales_Register_Sep2026_RAVI.xlsx'),
        sampleFile('Sales_Register_Sep2026_PRIYA.xlsx'),
      ]);
      setMergeLabel(0, 'Ravi');
      setMergeLabel(1, 'Priya');
      await openFile('base', orig);
      await openFile('a', ravi);
      await openFile('b', priya);
      await planMerge();
      navigate('/merge');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <h1>See every hidden change in your spreadsheets.</h1>
        <p>
          {mode === 'compare'
            ? 'Compare two Excel files in seconds. Your files never leave this device.'
            : 'Safely combine two people’s edits into one file. Your files never leave this device.'}
        </p>
      </section>

      <div className="mode-tabs" role="tablist" aria-label="Mode">
        <button role="tab" aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>
          Compare two files
        </button>
        <button role="tab" aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>
          Merge two edited copies
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {mode === 'compare' ? (
        <>
          <div className="dropzones">
            <DropZone
              label="Old file"
              hint="Drag the earlier version here, or choose a file."
              fileName={slots.old?.fileName}
              onFile={onFile('old')}
              onError={setError}
            />
            <DropZone
              label="New file"
              hint="Drag the revised version here, or choose a file."
              fileName={slots.new?.fileName}
              onFile={onFile('new')}
              onError={setError}
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
        </>
      ) : (
        <>
          <div className="dropzones three">
            <div className="merge-input">
              <DropZone
                label="Original"
                hint="The file both people started from."
                fileName={slots.base?.fileName}
                onFile={onFile('base')}
                onError={setError}
              />
            </div>
            <div className="merge-input">
              <label className="copy-name">
                Copy 1 name
                <input
                  type="text"
                  value={merge.labels[0]}
                  onChange={(e) => setMergeLabel(0, e.target.value)}
                  aria-label="Name for copy 1"
                />
              </label>
              <DropZone
                label={merge.labels[0] || 'Copy 1'}
                hint="The first person’s edited copy."
                fileName={slots.a?.fileName}
                onFile={onFile('a')}
                onError={setError}
              />
            </div>
            <div className="merge-input">
              <label className="copy-name">
                Copy 2 name
                <input
                  type="text"
                  value={merge.labels[1]}
                  onChange={(e) => setMergeLabel(1, e.target.value)}
                  aria-label="Name for copy 2"
                />
              </label>
              <DropZone
                label={merge.labels[1] || 'Copy 2'}
                hint="The second person’s edited copy."
                fileName={slots.b?.fileName}
                onFile={onFile('b')}
                onError={setError}
              />
            </div>
          </div>
          <div className="actions">
            <button className="btn" onClick={doPlan} disabled={!canMerge}>
              {merge.phase === 'planning' ? 'Planning…' : 'Plan the merge'}
            </button>
            <button className="btn secondary" onClick={tryMergeSamples} disabled={busy}>
              Try with sample files
            </button>
          </div>
        </>
      )}
    </main>
  );
}
