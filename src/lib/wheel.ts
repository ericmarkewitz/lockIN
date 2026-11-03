export const MAX_SETS = 20;
export const MAX_REPS = 100;
export const DURATION_STEP_MIN = 5;
export const MAX_DURATION_MIN = 240;

/** Duration rows: 5 minute steps, keeping any saved value that falls between them. */
export const durationOptions = (current: number | null) =>
  wheelOptions(DURATION_STEP_MIN, MAX_DURATION_MIN, current, DURATION_STEP_MIN);

/**
 * The rows of a number wheel: a blank row (null) then min..max by step. A saved
 * value not on those rows gets its own, so opening a wheel never changes it.
 */
export function wheelOptions(min: number, max: number, current: number | null, step = 1): (number | null)[] {
  const numbers = Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step);
  if (current !== null && !numbers.includes(current)) {
    numbers.push(current);
    numbers.sort((a, b) => a - b);
  }
  return [null, ...numbers];
}

/** The row at a scroll offset, clamped because iOS reports overscroll past both ends. */
export function wheelIndexAt(offsetY: number, rowHeight: number, count: number): number {
  return Math.max(0, Math.min(count - 1, Math.round(offsetY / rowHeight)));
}
