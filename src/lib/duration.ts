/** Durations are stored as fractional minutes, so go through whole seconds to hide float noise. */
export const durationSeconds = (minutes: number | null) => (minutes === null ? 0 : Math.round(minutes * 60));

export function partsFromMinutes(minutes: number | null): [hours: number, minutes: number, seconds: number] {
  const total = durationSeconds(minutes);
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60];
}

/** All zeros means no duration, since the wheels have no blank row. */
export function minutesFromParts(hours: number, minutes: number, seconds: number): number | null {
  const total = hours * 3600 + minutes * 60 + seconds;
  return total === 0 ? null : total / 60;
}

/** "30 min" for whole minutes under an hour, otherwise the non-zero parts: "1h 5m 30s". */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return '';
  const [h, m, s] = partsFromMinutes(minutes);
  if (h === 0 && s === 0) return `${m} min`;
  return [h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ');
}

/** Two decimals of a minute is within 0.3s, so it still resolves to the exact second. */
export const roundMinutes = (minutes: number) => Math.round(minutes * 100) / 100;
