// Picks the demo client or the real client on every property access. While
// `isDemo()` is true the real client is never touched: not for reads, writes,
// Realtime, Auth or Storage. This is the single point that keeps guest mode
// away from the database, and it is covered by tests with a real client that
// fails if it is used.
export function createSwitchingClient<T extends object>(real: T, demo: object, isDemo: () => boolean): T {
  return new Proxy(real, {
    get(_target, prop) {
      const source = (isDemo() ? demo : real) as Record<PropertyKey, unknown>;
      const value = source[prop];
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(source) : value;
    },
  });
}
