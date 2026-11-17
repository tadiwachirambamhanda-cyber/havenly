import { describe, expect, it } from 'vitest';
import { passwordProblem } from './passwordRules';

describe('passwordProblem', () => {
  it('accepts a password with 8+ characters, both cases and a digit', () => {
    expect(passwordProblem('Sunrise2026')).toBeNull();
    expect(passwordProblem('aB3defgh')).toBeNull();
  });

  it('rejects short passwords', () => {
    expect(passwordProblem('aB3')).toMatch(/at least 8/);
    expect(passwordProblem('aB3defg')).toMatch(/at least 8/);
  });

  it('rejects passwords missing a lower case letter, upper case letter or digit', () => {
    expect(passwordProblem('abcdefgh')).toMatch(/upper case/);
    expect(passwordProblem('ABCDEFG1')).toMatch(/upper case/);
    expect(passwordProblem('Abcdefgh')).toMatch(/number/);
    expect(passwordProblem('abcdefg1')).toMatch(/upper case/);
  });
});
