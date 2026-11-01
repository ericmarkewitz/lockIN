/** Returns a copy of `items` with the element at `from` moved to `to`. Out-of-range moves are ignored. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < items.length;
  if (!inRange(from) || !inRange(to) || from === to) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Index a row dragged `dy` points from slot `from` should land in, given the row pitch (height + gap). */
export function dropIndex(from: number, dy: number, rowPitch: number, count: number): number {
  if (rowPitch <= 0 || count <= 0) return from;
  const target = from + Math.round(dy / rowPitch);
  return Math.min(count - 1, Math.max(0, target));
}
