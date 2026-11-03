import { wheelIndexAt, wheelOptions, wheelRange } from '../wheel';

describe('wheelOptions', () => {
  it('starts with a blank option followed by the range', () => {
    expect(wheelOptions(1, 3, null)).toEqual([null, 1, 2, 3]);
  });

  it('keeps a saved value that is outside the range, in order', () => {
    expect(wheelOptions(1, 3, 150)).toEqual([null, 1, 2, 3, 150]);
    expect(wheelOptions(1, 3, 0)).toEqual([null, 0, 1, 2, 3]);
  });

  it('keeps a saved fractional value, in order', () => {
    expect(wheelOptions(1, 3, 2.5)).toEqual([null, 1, 2, 2.5, 3]);
  });

  it('does not duplicate a value already in the range', () => {
    expect(wheelOptions(1, 3, 2)).toEqual([null, 1, 2, 3]);
  });
});

describe('wheelRange', () => {
  it('has no blank row', () => {
    expect(wheelRange(0, 2, 1)).toEqual([0, 1, 2]);
  });

  it('keeps a saved value that is outside the range', () => {
    expect(wheelRange(0, 2, 25)).toEqual([0, 1, 2, 25]);
  });
});

describe('wheelIndexAt', () => {
  it('rounds a scroll offset to the nearest row', () => {
    expect(wheelIndexAt(0, 44, 10)).toBe(0);
    expect(wheelIndexAt(65, 44, 10)).toBe(1);
    expect(wheelIndexAt(67, 44, 10)).toBe(2);
  });

  it('clamps overscroll to the ends of the wheel', () => {
    expect(wheelIndexAt(-30, 44, 10)).toBe(0);
    expect(wheelIndexAt(9000, 44, 10)).toBe(9);
  });
});
