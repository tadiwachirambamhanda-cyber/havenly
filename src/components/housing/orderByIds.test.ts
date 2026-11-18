import { describe, it, expect } from 'vitest';
import { orderByIds } from './listingModel';

describe('orderByIds', () => {
  it('keeps the order of the ids, newest save first', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(orderByIds(list, ['c', 'a']).map((r) => r.id)).toEqual(['c', 'a']);
  });
  it('drops a saved place that is no longer listed', () => {
    expect(orderByIds([{ id: 'a' }], ['gone', 'a']).map((r) => r.id)).toEqual(['a']);
  });
  it('is empty when nothing is saved', () => {
    expect(orderByIds([{ id: 'a' }], [])).toEqual([]);
  });
});
