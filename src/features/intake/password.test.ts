import { describe, it, expect } from 'vitest';
import { passwordPrompt } from './password.ts';

describe('passwordPrompt', () => {
  it('asks for the password on the first prompt', () => {
    const p = passwordPrompt('PASSWORD_REQUIRED', 0);
    expect(p.showUnprotectedSteps).toBe(false);
    expect(p.message).toMatch(/password-protected/i);
  });

  it('says "try again" after a wrong password', () => {
    const p = passwordPrompt('PASSWORD_WRONG', 1);
    expect(p.showUnprotectedSteps).toBe(false);
    expect(p.message).toMatch(/didn.t open/i);
  });

  it('shows the unprotected-copy steps after three failures (FR-IN-04)', () => {
    expect(passwordPrompt('PASSWORD_WRONG', 3).showUnprotectedSteps).toBe(true);
  });

  it('shows the unprotected-copy steps when encryption is unsupported (FR-IN-05)', () => {
    expect(passwordPrompt('ENCRYPTION_UNSUPPORTED', 0).showUnprotectedSteps).toBe(true);
  });
});
