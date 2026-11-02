/** Epley estimated one-rep max, rounded to one decimal. Null unless weight and reps are both positive. */
export function estimateOneRepMax(weight: number | null, reps: number | null): number | null {
  if (!weight || !reps || weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}
