// Mirrors the rule set in the Supabase Auth settings (Email provider): at least 8
// characters with a lowercase letter, an uppercase letter and a digit. Checking it
// here shows the rule before the request is sent. The server still enforces it.
export const PASSWORD_HINT = '8+ characters: upper, lower and a number';

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password needs an upper case letter, a lower case letter and a number.';
  }
  return null;
}
