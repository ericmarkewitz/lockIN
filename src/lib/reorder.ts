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

/**
 * Like `dropIndex`, for rows of different heights: the dragged row passes a neighbour once it has
 * covered half of it. Stops at a row whose height isn't known yet.
 */
export function dropIndexByHeights(from: number, dy: number, heights: readonly (number | undefined)[], gap: number): number {
  const dir = Math.sign(dy);
  let to = from;
  let covered = 0;
  for (let i = from + dir; dir !== 0 && i >= 0 && i < heights.length; i += dir) {
    const h = heights[i];
    if (h === undefined) break;
    if (Math.abs(dy) <= covered + (h + gap) / 2) break;
    covered += h + gap;
    to = i;
  }
  return to;
}
