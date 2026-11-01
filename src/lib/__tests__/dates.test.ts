import {
  addDays,
  datesInRange,
  monthGrid,
  parseDateKey,
  startOfWeek,
  toDateKey,
  weekdayOf,
  weekDates,
} from '../dates';

describe('dates', () => {
  it('formats local dates as YYYY-MM-DD with zero padding', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('parses a date key into a local-midnight date', () => {
    const d = parseDateKey('2026-11-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 1, 0]);
  });

  it('returns the JS weekday (0 = Sunday)', () => {
    expect(weekdayOf('2026-11-01')).toBe(0); // Sunday
    expect(weekdayOf('2026-11-02')).toBe(1);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('is stable across DST changes', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('finds the Monday that starts a week', () => {
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26'); // Sunday -> previous Monday
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02');
    expect(startOfWeek('2026-11-04')).toBe('2026-11-02');
  });

  it('lists the 7 dates of a week, Monday first', () => {
    expect(weekDates('2026-11-04')).toEqual([
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
      '2026-11-06', '2026-11-07', '2026-11-08',
    ]);
  });

  it('lists an inclusive date range', () => {
    expect(datesInRange('2026-02-27', '2026-03-02')).toEqual([
      '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02',
    ]);
    expect(datesInRange('2026-03-02', '2026-02-27')).toEqual([]);
  });

  it('builds a Monday-first month grid padded with nulls', () => {
    const grid = monthGrid(2026, 10); // November 2026 starts on Sunday
    expect(grid.length % 7).toBe(0);
    expect(grid[0]).toBeNull();
    expect(grid[5]).toBeNull();
    expect(grid[6]).toBe('2026-11-01');
    expect(grid.filter(Boolean)).toHaveLength(30);
  });
});
