import { useSyncExternalStore } from 'react';

// The listings a student picked to compare, kept in memory (up to three).
export const MAX_COMPARE = 3;

let ids: readonly string[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export type AddResult = 'added' | 'already' | 'full';

export function addToCompare(id: string): AddResult {
  if (ids.includes(id)) return 'already';
  if (ids.length >= MAX_COMPARE) return 'full';
  ids = [...ids, id];
  emit();
  return 'added';
}

export function removeFromCompare(id: string): void {
  if (!ids.includes(id)) return;
  ids = ids.filter((x) => x !== id);
  emit();
}

export function clearCompare(): void {
  if (!ids.length) return;
  ids = [];
  emit();
}

export const getCompareIds = () => ids;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export function useCompareIds(): readonly string[] {
  return useSyncExternalStore(subscribe, getCompareIds, getCompareIds);
}
