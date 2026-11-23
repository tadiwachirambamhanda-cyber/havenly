import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Every screen name that code navigates to must be a registered screen. This keeps a removed
// screen (the social features were archived at git tag archive/social-v1) from leaving a
// dead link behind: a tap on a missing route does nothing on the web and warns on a phone.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

const root = readFileSync('src/navigation/RootNavigator.tsx', 'utf8');
const registered = new Set([...root.matchAll(/(?:Stack|Tab)\.Screen\s+name="(\w+)"/g)].map((m) => m[1]));

describe('navigation targets', () => {
  it('registers the screens we expect', () => {
    for (const name of ['MainTabs', 'Housing', 'Saved', 'Compare', 'Inbox', 'Profile', 'ResidenceDetail', 'Notifications', 'Map', 'ChangePassword', 'HousemateBoard', 'MyHousemateCard', 'HousemateReview', 'Guide']) {
      expect(registered.has(name), name).toBe(true);
    }
    for (const gone of ['CompareTab', 'Feed', 'Discover', 'PostDetail', 'CreatePost', 'Communities', 'EventDetail', 'FollowList', 'UserProfile', 'NewGroup', 'SharePost']) {
      expect(registered.has(gone), gone).toBe(false);
    }
  });

  it('never navigates to a screen that is not registered', () => {
    const bad: string[] = [];
    for (const f of files('src')) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/\b(?:navigate|push|replace)\(\s*'(\w+)'/g)) {
        if (!registered.has(m[1])) bad.push(`${f}: ${m[1]}`);
      }
      for (const m of text.matchAll(/screen:\s*'(\w+)'/g)) {
        if (!registered.has(m[1])) bad.push(`${f}: tab ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
