import { durationSeconds, formatDuration, minutesFromParts, partsFromMinutes } from '../duration';

describe('partsFromMinutes', () => {
  it('splits minutes into hours, minutes and seconds', () => {
    expect(partsFromMinutes(65.5)).toEqual([1, 5, 30]);
    expect(partsFromMinutes(30)).toEqual([0, 30, 0]);
  });

  it('treats no duration as zero', () => {
    expect(partsFromMinutes(null)).toEqual([0, 0, 0]);
  });

  it('carries when a value rounds up to the next minute', () => {
    expect(partsFromMinutes(1.9999)).toEqual([0, 2, 0]);
  });

  it('does not wrap hours past a day', () => {
    expect(partsFromMinutes(1500)).toEqual([25, 0, 0]);
  });
});

describe('minutesFromParts', () => {
  it('combines hours, minutes and seconds into minutes', () => {
    expect(minutesFromParts(1, 5, 30)).toBe(65.5);
  });

  it('makes all zeros mean no duration', () => {
    expect(minutesFromParts(0, 0, 0)).toBeNull();
  });

  it('round-trips every second, despite values like 1/3 of a minute', () => {
    for (const total of [1, 20, 80, 3599, 3601, 86399]) {
      const parts = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60] as const;
      expect(partsFromMinutes(minutesFromParts(...parts))).toEqual(parts);
    }
  });
});

describe('durationSeconds', () => {
  it('rounds to a whole second, with no duration as zero', () => {
    expect(durationSeconds(1 + 20 / 60)).toBe(80);
    expect(durationSeconds(null)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('shows whole minutes under an hour as minutes', () => {
    expect(formatDuration(30)).toBe('30 min');
  });

  it('shows only the parts that are not zero', () => {
    expect(formatDuration(65.5)).toBe('1h 5m 30s');
    expect(formatDuration(1 + 20 / 60)).toBe('1m 20s');
    expect(formatDuration(0.5)).toBe('30s');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('shows zero as zero minutes, and no duration as blank', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(null)).toBe('');
  });

  it('hides floating point noise from summed durations', () => {
    expect(formatDuration(0.1 + 0.2)).toBe('18s');
  });
});
