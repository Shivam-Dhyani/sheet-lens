import type { OpenErrorCode } from '../../worker/types.ts';

export interface PasswordPrompt {
  /** The dialog's explanatory line. */
  message: string;
  /** Show the "save an unprotected copy" steps instead of the input (FR-IN-05). */
  showUnprotectedSteps: boolean;
}

const INTRO = 'This file is password-protected. Enter the password you use to open it — it stays on this device.';
const WRONG = 'That password didn’t open the file. Try again.';
const UNSUPPORTED = 'SheetLens can’t open this type of protection.';

/**
 * The dialog copy for the current attempt (FR-IN-04/05). After three wrong
 * passwords, or when the encryption type isn't supported, SheetLens stops
 * asking and shows how to save an unprotected copy instead.
 */
export function passwordPrompt(code: OpenErrorCode, attempts: number): PasswordPrompt {
  if (code === 'ENCRYPTION_UNSUPPORTED') {
    return { message: UNSUPPORTED, showUnprotectedSteps: true };
  }
  if (attempts >= 3) {
    return { message: WRONG, showUnprotectedSteps: true };
  }
  if (code === 'PASSWORD_WRONG' || attempts > 0) {
    return { message: WRONG, showUnprotectedSteps: false };
  }
  return { message: INTRO, showUnprotectedSteps: false };
}

/** Steps shown when SheetLens can't open the protected file (FR-IN-05). */
export const UNPROTECTED_STEPS = [
  'Open the file in Excel with your password.',
  'Choose File → Save As and save a new copy.',
  'In the Save dialog, remove the password (Tools → General Options, clear the passwords).',
  'Bring that unprotected copy here.',
];
