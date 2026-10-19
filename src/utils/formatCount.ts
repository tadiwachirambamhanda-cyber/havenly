// 3210 -> "3.2k", 12000 -> "12k", 1250000 -> "1.3M". Under 1000 stays exact.
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  const divide = (value: number, suffix: string) => {
    const num = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${num}${suffix}`;
  };
  if (n < 1_000_000) return divide(n / 1000, 'k');
  return divide(n / 1_000_000, 'M');
}

// "1 member", "0 members", "3.2k members".
export function formatMembers(n: number): string {
  return `${formatCount(n)} ${n === 1 ? 'member' : 'members'}`;
}
