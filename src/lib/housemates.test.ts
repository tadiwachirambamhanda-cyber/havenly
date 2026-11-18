import { describe, it, expect } from 'vitest';
import { budgetLine, cardProblem, genderLabel, visibilityExplainer, type CardInput } from './housemates';

const ok: CardInput = { area: 'Dubai Marina', lifestyle: ['quiet', 'non_smoker'], note: 'Final year, studies at the library.', residenceId: null, spots: null };

describe('cardProblem', () => {
  it('accepts a normal card', () => expect(cardProblem(ok)).toBeNull());
  it('needs an area', () => {
    expect(cardProblem({ ...ok, area: '  ' })).not.toBeNull();
    expect(cardProblem({ ...ok, area: 'x'.repeat(81) })).not.toBeNull();
  });
  it('allows up to 5 tags and refuses 6', () => {
    expect(cardProblem({ ...ok, lifestyle: ['quiet', 'non_smoker', 'early_riser', 'studies_out', 'few_guests'] })).toBeNull();
    expect(cardProblem({ ...ok, lifestyle: ['quiet', 'non_smoker', 'early_riser', 'studies_out', 'few_guests', 'guests_ok'] })).not.toBeNull();
  });
  it('refuses tags that say the opposite thing', () => {
    expect(cardProblem({ ...ok, lifestyle: ['early_riser', 'night_owl'] })).toMatch(/opposite/);
    expect(cardProblem({ ...ok, lifestyle: ['non_smoker', 'smoker_ok'] })).toMatch(/opposite/);
    expect(cardProblem({ ...ok, lifestyle: ['guests_ok', 'few_guests'] })).toMatch(/opposite/);
    expect(cardProblem({ ...ok, lifestyle: ['quiet', 'social'] })).toMatch(/opposite/);
  });
  it('refuses a duplicate tag', () => expect(cardProblem({ ...ok, lifestyle: ['quiet', 'quiet'] })).not.toBeNull());
  it('limits the note to 280 characters', () => {
    expect(cardProblem({ ...ok, note: 'x'.repeat(280) })).toBeNull();
    expect(cardProblem({ ...ok, note: 'x'.repeat(281) })).not.toBeNull();
  });
  it('needs 1 to 5 spots when tied to a home', () => {
    expect(cardProblem({ ...ok, residenceId: 'r1', spots: null })).not.toBeNull();
    expect(cardProblem({ ...ok, residenceId: 'r1', spots: 0 })).not.toBeNull();
    expect(cardProblem({ ...ok, residenceId: 'r1', spots: 6 })).not.toBeNull();
    expect(cardProblem({ ...ok, residenceId: 'r1', spots: 2 })).toBeNull();
  });
});

describe('visibilityExplainer', () => {
  it('explains a women-only choice', () => {
    expect(visibilityExplainer('female', 'female_only')).toMatch(/only to women who are happy to live with women/);
  });
  it('warns when a gendered choice has no gender given', () => {
    expect(visibilityExplainer(null, 'male_only')).toMatch(/nobody will see your card/);
  });
  it('explains the open case', () => {
    expect(visibilityExplainer('male', 'any')).toMatch(/whatever their gender/);
    expect(visibilityExplainer(null, 'any')).toMatch(/happy to live with anyone/);
  });
});

describe('card text', () => {
  it('formats budget and month', () => expect(budgetLine({ budget_aed: 3000, move_in_month: '2026-12-01' })).toBe('AED 3,000 a month · moving in December 2026'));
  it('labels genders', () => {
    expect(genderLabel('female')).toBe('Woman');
    expect(genderLabel('male')).toBe('Man');
    expect(genderLabel(null)).toBeNull();
  });
});
