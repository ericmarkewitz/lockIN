export const MAX_SETS = 20;
export const MAX_REPS = 100;
export const MAX_DURATION_HOURS = 23;

/** min..max as wheel rows. A saved value outside that range gets its own row, so opening a wheel never changes it. */
export function wheelRange(min: number, max: number, current: number | null): number[] {
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  if (current !== null && !numbers.includes(current)) {
    numbers.push(current);
    numbers.sort((a, b) => a - b);
  }
  return numbers;
}

/** wheelRange with a blank row (null) first, for clearing the value. */
export const wheelOptions = (min: number, max: number, current: number | null): (number | null)[] =>
  [null, ...wheelRange(min, max, current)];

/** The row at a scroll offset, clamped because iOS reports overscroll past both ends. */
export function wheelIndexAt(offsetY: number, rowHeight: number, count: number): number {
  return Math.max(0, Math.min(count - 1, Math.round(offsetY / rowHeight)));
}
