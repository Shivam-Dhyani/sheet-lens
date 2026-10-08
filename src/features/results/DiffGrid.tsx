import { useEffect, useState } from 'react';
import { getEngine } from '../../worker/client.ts';
import { formatValue, serialToDisplayDate } from '../../lib/format.ts';
import { RowState, type MarkedSheet, type MarkedRow, type Scalar } from '@shivam-dhyani/sheet-diff';

interface Props {
  sheetName: string;
  filter: 'changed' | 'all';
}

function show(value: Scalar, header: string): string {
  if (typeof value === 'number' && /date/i.test(header)) return serialToDisplayDate(value);
  return formatValue(value, header);
}

function rowChanged(row: MarkedRow): boolean {
  return row.status !== RowState.Unchanged || row.cells.some((c) => c.changed || c.recalculated);
}

const STATUS_LABEL: Record<number, string> = {
  [RowState.Added]: 'added',
  [RowState.Removed]: 'removed',
  [RowState.Changed]: 'changed',
  [RowState.Moved]: 'moved',
};

export function DiffGrid({ sheetName, filter }: Props) {
  const [marked, setMarked] = useState<MarkedSheet | null>(null);
  useEffect(() => {
    let live = true;
    setMarked(null);
    void getEngine()
      .getMarkedSheet(sheetName)
      .then((m) => {
        if (live) setMarked(m);
      });
    return () => {
      live = false;
    };
  }, [sheetName]);

  if (!marked) return <p>Loading {sheetName}…</p>;

  const rows = filter === 'changed' ? marked.rows.filter(rowChanged) : marked.rows;

  return (
    <>
      <div className="grid-wrap" role="region" aria-label={`${sheetName} changes`}>
        <table className="diff" role="grid" aria-rowcount={rows.length + 1} aria-colcount={marked.columns.length + 1}>
          <thead>
            <tr>
              <th scope="col">Status</th>
              {marked.columns.map((c) => (
                <th scope="col" key={c}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const label = STATUS_LABEL[row.status] ?? '';
              return (
                <tr key={`${row.key}-${i}`} className={label ? `row-${label}` : ''}>
                  <td>
                    {label && <span className={`status-pill ${label}`}>{label}</span>}
                  </td>
                  {row.cells.map((cell, c) => {
                    const header = marked.columns[c] ?? '';
                    const cls = cell.high
                      ? 'cell high'
                      : cell.changed
                        ? 'cell changed'
                        : cell.recalculated
                          ? 'cell recalc'
                          : 'cell';
                    return (
                      <td key={c} className={cls}>
                        {show(cell.value, header)}
                        {cell.changed && cell.oldValue !== undefined && (
                          <span className="old">was {show(cell.oldValue, header)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile change cards (FR-RES-06) */}
      <div className="change-cards">
        {rows.map((row, i) => {
          const changed = row.cells
            .map((cell, c) => ({ cell, header: marked.columns[c] ?? '' }))
            .filter((x) => x.cell.changed);
          const label = STATUS_LABEL[row.status] ?? '';
          return (
            <div className="change-card" key={`${row.key}-card-${i}`}>
              <strong>{row.key}</strong> {label && <span className={`status-pill ${label}`}>{label}</span>}
              <ul>
                {changed.map((x, j) => (
                  <li key={j}>
                    {x.header}: {show(x.cell.oldValue ?? null, x.header)} → {show(x.cell.value, x.header)}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
