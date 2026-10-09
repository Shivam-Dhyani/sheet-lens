import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '../../store/session.ts';
import { downloadBlob } from '../../reports/download.ts';
import { formatValue } from '../../lib/format.ts';
import type {
  Conflict,
  Proposal,
  ConflictResolution,
  MergeSource,
  Scalar,
} from '@shivam-dhyani/sheet-diff';

export function MergePage() {
  const navigate = useNavigate();
  const {
    merge,
    resolveConflict,
    toggleProposal,
    acknowledgeRelated,
    setExtendTotals,
    setKeepPassword,
    buildMerge,
  } = useSession();

  const labelOf = useMemo(() => {
    return (s: MergeSource | undefined): string =>
      s === 'A' ? merge.labels[0] : s === 'B' ? merge.labels[1] : s === 'both' ? 'both copies' : s ?? '';
  }, [merge.labels]);

  if (merge.phase === 'idle') return <Navigate to="/" replace />;

  if (merge.planError) {
    return (
      <main className="page">
        <div className="headline">
          <h2>SheetLens can’t merge these files yet</h2>
          <p className="contrast">
            {merge.planError.code === 'MERGE_NO_KEY'
              ? 'To merge safely, SheetLens needs a column that identifies each row (like Invoice No). Add one to all three files and try again.'
              : merge.planError.message}
          </p>
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn secondary" onClick={() => navigate('/')}>
              Back to files
            </button>
          </div>
        </div>
      </main>
    );
  }

  const plan = merge.plan;
  if (!plan) return <Navigate to="/" replace />;

  const conflicts = plan.conflicts;
  const resolvedCount = conflicts.filter((c) => merge.resolutions.conflicts[c.id] !== undefined).length;
  const needsAck = conflicts.some(
    (c) => merge.resolutions.conflicts[c.id] === 'both' && !merge.resolutions.acknowledgeRelated?.[c.id],
  );
  const allResolved = resolvedCount === conflicts.length && !needsAck;
  const unticked = new Set(merge.resolutions.untickedProposals ?? []);

  // Proposals grouped by row key (FR-MRG-02).
  const groups = new Map<string, Proposal[]>();
  for (const p of plan.proposals) {
    const g = groups.get(p.key) ?? [];
    g.push(p);
    groups.set(p.key, g);
  }

  const download = async (): Promise<void> => {
    await buildMerge();
    const result = useSession.getState().merge.result;
    if (result) {
      const blob = new Blob([result.bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      downloadBlob(blob, result.fileName);
    }
  };

  const result = merge.result;

  return (
    <main className="page">
      <div className="headline">
        <h2 data-testid="merge-headline">
          {plan.proposals.length} auto-change{plan.proposals.length === 1 ? '' : 's'} ready ·{' '}
          <span className={conflicts.length && !allResolved ? 'sev high' : 'sev info'}>
            {conflicts.length === 0
              ? 'no conflicts'
              : allResolved
                ? 'all conflicts resolved'
                : `${conflicts.length - resolvedCount} of ${conflicts.length} conflicts to resolve`}
          </span>
        </h2>
        <div className="contrast">
          Matched by {plan.keyColumns.join(' / ') || '(none)'} · merging {merge.labels[0]} + {merge.labels[1]}
          {!merge.canPatch && ' · CSV output (rewritten)'}
        </div>
      </div>

      {conflicts.length > 0 && (
        <section className="merge-section">
          <h3>Conflicts — decide these first</h3>
          {conflicts.map((c) => (
            <ConflictCard
              key={c.id}
              c={c}
              labels={merge.labels}
              resolution={merge.resolutions.conflicts[c.id]}
              acknowledged={Boolean(merge.resolutions.acknowledgeRelated?.[c.id])}
              onResolve={(r) => resolveConflict(c.id, r)}
              onAck={(a) => acknowledgeRelated(c.id, a)}
            />
          ))}
        </section>
      )}

      <section className="merge-section">
        <h3>Automatic changes ({plan.proposals.length})</h3>
        {plan.proposals.length === 0 && <p className="contrast">No safe automatic changes.</p>}
        {[...groups.entries()].map(([key, items]) => (
          <div key={key} className="proposal-group">
            <div className="proposal-key">{key}</div>
            {items.map((p) => (
              <label key={p.id} className="proposal">
                <input
                  type="checkbox"
                  checked={!unticked.has(p.id)}
                  onChange={(e) => toggleProposal(p.id, e.target.checked)}
                />
                <span>{describeProposal(p, labelOf)}</span>
                <span className="source-tag">{labelOf(p.source)}</span>
              </label>
            ))}
          </div>
        ))}
      </section>

      <section className="merge-section">
        <h3>Impact on totals</h3>
        <label className="toggle">
          <input type="checkbox" checked={merge.extendTotals} onChange={(e) => setExtendTotals(e.target.checked)} />
          Extend these totals to include the new rows ({merge.preview?.extendRanges.length ?? 0} formula
          {merge.preview && merge.preview.extendRanges.length === 1 ? '' : 's'})
        </label>
        {merge.preview?.extendRanges.length ? (
          <div className="contrast ranges">
            {merge.preview.extendRanges.map((r, i) => (
              <span key={i} className="range-chip">
                {r.sheet}!{r.cell}: {r.from} → {r.to}
              </span>
            ))}
          </div>
        ) : null}

        {merge.preview?.resolved ? (
          merge.preview.impact.length ? (
            <table className="impact">
              <thead>
                <tr>
                  <th>Total</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {merge.preview.impact.map((row, i) => (
                  <tr key={i}>
                    <td>{row.label}</td>
                    <td>{row.before === null ? '—' : num(row.before)}</td>
                    <td className={row.after === 'excel' ? 'excel' : ''}>
                      {row.after === 'excel' ? 'updates when opened in Excel' : num(row.after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="contrast">No known totals are affected.</p>
          )
        ) : (
          <p className="contrast">Resolve the remaining conflict(s) to see the impact and download.</p>
        )}
      </section>

      <section className="merge-section">
        {merge.encrypted && (
          <label className="toggle">
            <input type="checkbox" checked={merge.keepPassword} onChange={(e) => setKeepPassword(e.target.checked)} />
            Keep the original password on the merged file
          </label>
        )}
        <div className="actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn" onClick={download} disabled={!allResolved || merge.phase === 'building'} data-testid="download-merge">
            {merge.phase === 'building' ? 'Preparing…' : 'Download merged file'}
          </button>
          <button className="btn secondary" onClick={() => navigate('/')}>
            Start over
          </button>
        </div>
        {merge.error && (
          <div className="error-banner" role="alert">
            {merge.error}
          </div>
        )}
      </section>

      {result && (
        <section className="merge-section result" data-testid="merge-result">
          <h3>Merged file ready — {result.fileName}</h3>
          <p>{result.applied.length} change(s) applied.</p>
          {result.blocked.length > 0 && (
            <div className="blocked">
              <strong>{result.blocked.length} operation(s) need manual action:</strong>
              <ul>
                {result.blocked.map((b, i) => (
                  <li key={i}>
                    {b.op} {b.key} on {b.sheet} — {b.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="fidelity">
            {Object.entries(fidelityLabels).map(([k, label]) => (
              <li key={k}>
                {label}: {result.fidelity[k as keyof typeof result.fidelity] ? 'kept' : 'n/a'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

const fidelityLabels: Record<string, string> = {
  charts: 'Charts',
  pivotTables: 'Pivot tables',
  macros: 'Macros',
  comments: 'Comments',
  conditionalFormats: 'Conditional formats',
  dataValidation: 'Data validation',
};

function num(v: number): string {
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function show(v: Scalar, column?: string): string {
  return formatValue(v, column);
}

function describeProposal(p: Proposal, labelOf: (s: MergeSource | undefined) => string): string {
  if (p.kind === 'cell') return `${p.column}: ${show(p.base ?? null, p.column)} → ${show(p.value ?? null, p.column)}`;
  if (p.kind === 'row_add') return `Add this row (from ${labelOf(p.source)})`;
  return 'Remove this row';
}

function ConflictCard({
  c,
  labels,
  resolution,
  acknowledged,
  onResolve,
  onAck,
}: {
  c: Conflict;
  labels: [string, string];
  resolution: ConflictResolution | undefined;
  acknowledged: boolean;
  onResolve(r: ConflictResolution): void;
  onAck(a: boolean): void;
}) {
  const name = `conf-${c.id}`;
  const typedValue = typeof resolution === 'object' && resolution && 'typed' in resolution ? resolution.typed : '';
  const is = (v: string): boolean => resolution === v;

  return (
    <div className="conflict">
      <div className="conflict-head">
        <span className="sev high">{c.type.replace('_', ' ')}</span>
        <strong>{c.key}</strong>
        {c.column && <span className="col">· {c.column}</span>}
      </div>

      {c.type === 'CELL' && (
        <>
          <div className="conflict-values">
            <span>Original: {show(c.base ?? null, c.column)}</span>
            <span>
              {labels[0]}: {show(c.aValue ?? null, c.column)}
            </span>
            <span>
              {labels[1]}: {show(c.bValue ?? null, c.column)}
            </span>
          </div>
          <div className="choices">
            <Radio name={name} checked={is('A')} onChange={() => onResolve('A')} label={labels[0]} />
            <Radio name={name} checked={is('B')} onChange={() => onResolve('B')} label={labels[1]} />
            <Radio name={name} checked={is('base')} onChange={() => onResolve('base')} label="Keep Original" />
            <label className="radio">
              <input
                type="radio"
                name={name}
                checked={typeof resolution === 'object'}
                onChange={() => onResolve({ typed: typedValue as Scalar })}
              />
              Type a value
              {typeof resolution === 'object' && (
                <input
                  className="typed"
                  type="text"
                  value={String(typedValue ?? '')}
                  onChange={(e) => onResolve({ typed: coerce(e.target.value) })}
                  aria-label={`Typed value for ${c.key}`}
                />
              )}
            </label>
          </div>
        </>
      )}

      {c.type === 'RELATED_EDITS' && (
        <>
          <p className="why">{c.why}</p>
          <div className="conflict-values">
            <span>
              {labels[0]}: {(c.aEdits ?? []).map((e) => `${e.column} ${show(e.base)}→${show(e.value)}`).join(', ')}
            </span>
            <span>
              {labels[1]}: {(c.bEdits ?? []).map((e) => `${e.column} ${show(e.base)}→${show(e.value)}`).join(', ')}
            </span>
          </div>
          <div className="choices">
            <Radio name={name} checked={is('A')} onChange={() => onResolve('A')} label={`${labels[0]}’s edits`} />
            <Radio name={name} checked={is('B')} onChange={() => onResolve('B')} label={`${labels[1]}’s edits`} />
            <Radio name={name} checked={is('base')} onChange={() => onResolve('base')} label="Keep Original" />
            <Radio name={name} checked={is('both')} onChange={() => onResolve('both')} label="Both" />
          </div>
          {resolution === 'both' && (
            <label className="radio ack">
              <input type="checkbox" checked={acknowledged} onChange={(e) => onAck(e.target.checked)} />
              I understand both edits will be applied to this row.
            </label>
          )}
        </>
      )}

      {c.type === 'DELETE_EDIT' && (
        <>
          <p className="why">
            {labelOfSource(c.deletedBy, labels)} deleted this row; {labelOfSource(c.editedBy, labels)} edited it
            {(c.edits ?? []).length ? `: ${(c.edits ?? []).map((e) => `${e.column} ${show(e.base)}→${show(e.value)}`).join(', ')}` : ''}.
          </p>
          <div className="choices">
            <Radio name={name} checked={is('delete')} onChange={() => onResolve('delete')} label="Delete the row" />
            <Radio name={name} checked={is('keepEdits')} onChange={() => onResolve('keepEdits')} label="Keep it with the edits" />
            <Radio name={name} checked={is('base')} onChange={() => onResolve('base')} label="Keep Original" />
          </div>
        </>
      )}

      {c.type === 'ADD_ADD' && (
        <>
          <p className="why">Both copies added a row with key {c.key}.</p>
          <div className="choices">
            <Radio name={name} checked={is('A')} onChange={() => onResolve('A')} label={`${labels[0]}’s row`} />
            <Radio name={name} checked={is('B')} onChange={() => onResolve('B')} label={`${labels[1]}’s row`} />
            <Radio name={name} checked={is('both')} onChange={() => onResolve('both')} label="Keep both" />
          </div>
        </>
      )}
    </div>
  );
}

function labelOfSource(s: MergeSource | undefined, labels: [string, string]): string {
  return s === 'A' ? labels[0] : s === 'B' ? labels[1] : s ?? '';
}

function Radio({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange(): void;
  label: string;
}) {
  return (
    <label className="radio">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

/** A typed value: number when it parses cleanly, else the raw string. */
function coerce(s: string): Scalar {
  if (s.trim() === '') return '';
  const n = Number(s);
  return Number.isFinite(n) && String(n) === s.trim() ? n : s;
}
