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
    for (const name of ['MainTabs', 'Housing', 'Community', 'Profile', 'Saved', 'Inbox', 'ResidenceDetail', 'Notifications', 'ChangePassword', 'HousemateBoard', 'MyHousemateCard', 'HousemateReview', 'Guide', 'StartGroup', 'EnquiryGroup', 'JoinGroup', 'CommunityDetail', 'CreatePost', 'PostDetail', 'EventDetail', 'Perks', 'PerkDetail', 'ReviewQueue', 'ManageEvents', 'ManagePerks']) {
      expect(registered.has(name), name).toBe(true);
    }
    // Archived social screens, and Map, Compare and the old perk screens removed in v2.
    for (const gone of ['CompareTab', 'Compare', 'Map', 'SplitRent', 'Offers', 'OfferDetail', 'ManageBrands', 'CreateOffer', 'Feed', 'Discover', 'Communities', 'FollowList', 'UserProfile', 'NewGroup', 'SharePost']) {
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

describe('signed-out Housing', () => {
  // HousingScreen is also the signed-out PublicHousing stack screen, where MainTabs does not exist:
  // a jump to a tab there does nothing, so every one must sit behind requireAccount.
  it('only opens a tab after asking for an account', () => {
    const housing = readFileSync('src/screens/HousingScreen.tsx', 'utf8');
    const jumps = housing.split('\n').filter((l) => /navigate\(\s*'MainTabs'/.test(l));
    expect(jumps.length).toBeGreaterThan(0);
    for (const line of jumps) expect(line, line.trim()).toMatch(/if \(requireAccount\('\w+'/);
    expect(housing).toMatch(/requireAccount\('community'\)/);
  });

  it('has sign-in texts for the community reason', () => {
    const signIn = readFileSync('src/screens/SignInToContinueScreen.tsx', 'utf8');
    expect(signIn).toContain("community: 'Make a free account to join the conversation'");
    expect(signIn).toContain("community: 'So you can read and post in university communities, and ask students about an area.'");
  });
});

describe('three tabs', () => {
  it('has only Housing, Community and Profile as tabs; Saved and Inbox are screens', () => {
    const tabs = [...root.matchAll(/Tab\.Screen\s+name="(\w+)"/g)].map((m) => m[1]);
    expect(tabs).toEqual(['Housing', 'Community', 'Profile']);
    expect(root).toMatch(/Stack\.Screen name="Saved"/);
    expect(root).toMatch(/Stack\.Screen name="Inbox"/);
  });
});
