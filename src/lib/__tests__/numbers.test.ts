import { formatCompact, parseNumber } from '../numbers';

describe('parseNumber', () => {
  it('reads decimals with a dot or comma and rejects junk', () => {
    expect(parseNumber('12.5')).toBe(12.5);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('abc')).toBeNull();
  });
});

describe('formatCompact', () => {
  it('shows small numbers whole, with thousands separators', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(940.4)).toBe('940');
    expect(formatCompact(3480)).toBe('3,480');
  });

  it('abbreviates ten thousand and up', () => {
    expect(formatCompact(12_340)).toBe('12.3k');
    expect(formatCompact(125_600)).toBe('126k');
    expect(formatCompact(1_254_000)).toBe('1.25M');
    expect(formatCompact(12_500_000)).toBe('12.5M');
  });

  it('carries a rounding over into the next unit', () => {
    expect(formatCompact(999_600)).toBe('1M');
  });
});
