import { useEffect, useRef, useState } from 'react';
import { useSession } from '../../store/session.ts';
import { passwordPrompt, UNPROTECTED_STEPS } from './password.ts';

/**
 * The password dialog (FR-IN-04/05). The password is held only in this field
 * for the length of the attempt and is sent straight to the worker — it is
 * never stored, logged or echoed anywhere else.
 */
export function PasswordDialog() {
  const { pendingPassword, submitPassword, cancelPassword } = useSession();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue('');
    inputRef.current?.focus();
  }, [pendingPassword?.attempts, pendingPassword?.file]);

  if (!pendingPassword) return null;
  const prompt = passwordPrompt(pendingPassword.code, pendingPassword.attempts);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    try {
      await submitPassword(value);
    } finally {
      setBusy(false);
      setValue('');
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={cancelPassword}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pw-title">Password-protected file</h2>
        <p className="contrast">{pendingPassword.file.name}</p>
        <p>{prompt.message}</p>

        {prompt.showUnprotectedSteps ? (
          <>
            <ol className="steps">
              {UNPROTECTED_STEPS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={cancelPassword}>
                Close
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <input
              ref={inputRef}
              type="password"
              className="pw-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="File password"
              aria-label="File password"
              autoComplete="off"
            />
            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" onClick={cancelPassword}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={!value || busy}>
                {busy ? 'Opening…' : 'Open file'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
