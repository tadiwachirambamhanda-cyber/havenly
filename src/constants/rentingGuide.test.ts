import { describe, it, expect } from 'vitest';
import { GUIDE_DISCLAIMER, GUIDE_LAST_CHECKED, GUIDE_SECTIONS, GUIDE_SOURCES, NOT_VERIFIED_LINE, VERIFIED_EXPLAINER } from './rentingGuide';

// The guide is advice students act on, so it must not ship half-written.
describe('renting guide', () => {
  it('has a dated disclaimer', () => {
    expect(GUIDE_LAST_CHECKED).toMatch(/^\d{1,2} [A-Z][a-z]+ 20\d\d$/);
    expect(GUIDE_DISCLAIMER).toContain(GUIDE_LAST_CHECKED);
    expect(GUIDE_DISCLAIMER).toMatch(/not legal advice/i);
  });
  it('has the six sections, each with a title and points', () => {
    expect(GUIDE_SECTIONS.map((s) => s.id)).toEqual(['before-you-pay', 'costs', 'papers', 'sharing', 'deposit-back', 'questions']);
    for (const s of GUIDE_SECTIONS) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.points.length).toBeGreaterThanOrEqual(3);
      for (const p of s.points) expect(p.trim().length).toBeGreaterThan(20);
    }
  });
  it('has unique section ids', () => {
    const ids = GUIDE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('lists its sources as secure links', () => {
    expect(GUIDE_SOURCES.length).toBeGreaterThanOrEqual(5);
    for (const s of GUIDE_SOURCES) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.label.length).toBeGreaterThan(8);
    }
  });
  it('never promises more than a check can (no guarantee wording)', () => {
    expect(VERIFIED_EXPLAINER).toMatch(/not a guarantee/i);
    expect(NOT_VERIFIED_LINE).toMatch(/permit number/);
  });
});
