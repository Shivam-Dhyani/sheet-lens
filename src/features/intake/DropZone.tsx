import { useRef, useState, type DragEvent } from 'react';

const ACCEPT = '.xlsx,.xlsm,.xls,.csv';
const EXT_RE = /\.(xlsx|xlsm|xls|csv)$/i;

interface Props {
  label: string;
  hint: string;
  fileName?: string;
  onFile(file: File): void;
  onError(msg: string): void;
}

export function DropZone({ label, hint, fileName, onFile, onError }: Props) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (file: File | undefined): void => {
    if (!file) return;
    if (!EXT_RE.test(file.name)) {
      onError('SheetLens reads .xlsx, .xlsm, .xls and .csv files.');
      return;
    }
    onFile(file);
  };

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    setDrag(false);
    accept(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`dropzone${drag ? ' drag' : ''}${fileName ? ' filled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <h3>{label}</h3>
      {fileName ? (
        <p className="file" data-testid="file-name">
          {fileName}
        </p>
      ) : (
        <p>{hint}</p>
      )}
      <button
        type="button"
        className="btn secondary"
        onClick={() => inputRef.current?.click()}
        aria-label={`Choose ${label}`}
      >
        {fileName ? 'Replace file' : 'Choose file'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => accept(e.target.files?.[0])}
      />
    </div>
  );
}
