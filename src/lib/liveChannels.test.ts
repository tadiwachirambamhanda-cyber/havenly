import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// The unread dots are used in several places at once (tab bar, Profile). Each use must open its own live channel:
// a fixed channel name is shared between uses, and the second subscribe throws, crashing the screen (Profile render
// error, twice: #34 and the three-tab change).
describe('live channels used in more than one place', () => {
  for (const file of ['src/lib/useUnreadMessages.ts', 'src/lib/useUnreadNotifications.ts']) {
    it(`${file} names its channel per use`, () => {
      const text = readFileSync(file, 'utf8');
      expect(text).toMatch(/useId\(\)/);
      expect(text).toMatch(/supabase\.channel\(`[^`]*\$\{instanceId\}`\)/);
    });
  }
});
