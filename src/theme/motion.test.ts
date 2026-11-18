import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Springs overshoot and wobble badly with React Native 0.88 and Reanimated 4.7 (the tab highlight left the bar
// and bounced for over a second). All motion uses the timed settings in src/theme/motion.ts. This keeps a spring
// from being added back by accident.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

describe('motion', () => {
  it('uses no spring animations anywhere in the app', () => {
    const offenders: string[] = [];
    for (const f of files('src')) {
      const text = readFileSync(f, 'utf8');
      for (const bad of [/\bwithSpring\b/, /Animated\.spring\(/, /\.springify\(/]) {
        if (bad.test(text)) offenders.push(`${f}: ${bad}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
