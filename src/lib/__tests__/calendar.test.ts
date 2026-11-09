import type { DaySummary, DayStatus } from '@/data/types';
import { inPeriod, periodLabel, periodRange, shiftAnchor, weekProgress } from '../calendar';
import { parseNumber } from '../numbers';

describe('shiftAnchor', () => {
  it('moves by a day, week or month', () => {
    expect(shiftAnchor('2026-11-04', 'day', 1)).toBe('2026-11-05');
    expect(shiftAnchor('2026-11-04', 'week', -1)).toBe('2026-10-28');
    expect(shiftAnchor('2026-11-04', 'month', 1)).toBe('2026-12-04');
  });
  it('clamps the day when the target month is shorter', () => {
    expect(shiftAnchor('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(shiftAnchor('2026-03-31', 'month', -1)).toBe('2026-02-28');
  });
  it('crosses year boundaries', () => {
    expect(shiftAnchor('2026-12-15', 'month', 1)).toBe('2027-01-15');
    expect(shiftAnchor('2026-01-15', 'month', -1)).toBe('2025-12-15');
  });
});

describe('periodRange', () => {
  it('returns the visible dates for each mode', () => {
    expect(periodRange('2026-11-04', 'day')).toEqual({ from: '2026-11-04', to: '2026-11-04' });
    expect(periodRange('2026-11-04', 'week')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(periodRange('2026-11-04', 'month')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });
});

describe('periodLabel', () => {
  it('labels each mode', () => {
    expect(periodLabel('2026-11-04', 'month')).toBe('November 2026');
    expect(periodLabel('2026-11-04', 'week')).toBe('Nov 2 – Nov 8');
    expect(periodLabel('2026-11-04', 'day')).toBe('Wednesday, Nov 4');
  });
});

describe('parseNumber', () => {
  it('parses integers and decimals', () => {
    expect(parseNumber('135')).toBe(135);
    expect(parseNumber(' 52.5 ')).toBe(52.5);
  });
  it('accepts a comma decimal separator', () => {
    expect(parseNumber('52,5')).toBe(52.5);
  });
  it('returns null for blank or invalid input', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('-3')).toBeNull();
  });
});

describe('weekProgress', () => {
  const day = (status: DayStatus): DaySummary => ({ date: '2026-11-02', status, exerciseCount: 1, kinds: [] });
  it('counts training days and finished ones, ignoring rest and empty days', () => {
    const p = weekProgress(['completed', 'partial', 'missed', 'planned', 'rest', 'none', 'completed'].map((s) => day(s as DayStatus)));
    expect(p).toEqual({ done: 2, total: 5 });
  });
  it('is zero for a week with nothing to train', () => {
    expect(weekProgress([day('rest'), day('none')])).toEqual({ done: 0, total: 0 });
  });
});

describe('inPeriod', () => {
  it('tells whether a date is in the shown day, week or month', () => {
    expect(inPeriod('2026-11-04', '2026-11-04', 'day')).toBe(true);
    expect(inPeriod('2026-11-05', '2026-11-04', 'day')).toBe(false);
    expect(inPeriod('2026-11-08', '2026-11-04', 'week')).toBe(true);
    expect(inPeriod('2026-11-09', '2026-11-04', 'week')).toBe(false);
    expect(inPeriod('2026-11-30', '2026-11-04', 'month')).toBe(true);
    expect(inPeriod('2026-12-01', '2026-11-04', 'month')).toBe(false);
  });
});
