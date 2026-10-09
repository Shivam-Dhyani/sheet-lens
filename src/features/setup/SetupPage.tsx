import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '../../store/session.ts';
import { comparablePairs, keyCandidates, keyReason } from './key.ts';

export function SetupPage() {
  const navigate = useNavigate();
  const { summary, phase, recompare } = useSession();

  const pairs = useMemo(() => (summary ? comparablePairs(summary) : []), [summary]);
  const [choice, setChoice] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of pairs) init[p.id] = p.key.columns[0] ?? keyCandidates(p)[0] ?? '';
    return init;
  });

  if (!summary) return <Navigate to="/" replace />;

  const apply = async (): Promise<void> => {
    const keys: Record<string, string[]> = {};
    for (const p of pairs) {
      const col = choice[p.id];
      if (col) keys[p.id] = [col];
    }
    await recompare(keys);
    navigate('/compare');
  };

  return (
    <main className="page">
      <div className="headline">
        <h2>Check how rows are matched</h2>
        <div className="contrast">
          SheetLens matches rows by a key column. Pick the column that identifies each row so changes line up
          correctly.
        </div>
      </div>

      {pairs.map((p) => {
        const name = p.newName ?? p.oldName ?? p.id;
        const candidates = keyCandidates(p);
        const lowConfidence = p.key.mode === 'order' || p.key.confidence === 'low';
        return (
          <section key={p.id} className="merge-section">
            <h3>
              {name}{' '}
              <span className={`sev ${lowConfidence ? 'medium' : 'info'}`}>
                {p.key.mode === 'order' ? 'matched by row order' : `key: ${p.key.columns.join(' + ') || '—'}`}
              </span>
            </h3>
            <p className="why">{keyReason(p)}</p>
            <label className="copy-name" style={{ maxWidth: 360 }}>
              Key column
              <select
                value={choice[p.id] ?? ''}
                onChange={(e) => setChoice((c) => ({ ...c, [p.id]: e.target.value }))}
                aria-label={`Key column for ${name}`}
              >
                {candidates.length === 0 && <option value="">(no shared columns — match by row order)</option>}
                {candidates.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </label>
          </section>
        );
      })}

      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn" onClick={apply} disabled={phase === 'comparing'} data-testid="apply-setup">
          {phase === 'comparing' ? 'Comparing…' : 'Apply and compare'}
        </button>
        <button className="btn secondary" onClick={() => navigate('/compare')}>
          Keep automatic matching
        </button>
      </div>
    </main>
  );
}
