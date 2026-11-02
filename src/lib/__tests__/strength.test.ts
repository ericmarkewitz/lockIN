import { estimateOneRepMax } from '../strength';

describe('estimateOneRepMax', () => {
  it('returns the weight for a single rep', () => {
    expect(estimateOneRepMax(200, 1)).toBe(200);
  });
  it('uses the Epley formula, rounded to one decimal', () => {
    expect(estimateOneRepMax(100, 10)).toBe(133.3);
    expect(estimateOneRepMax(135, 8)).toBe(171);
  });
  it('is null without a positive weight and reps', () => {
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
    expect(estimateOneRepMax(null, 5)).toBeNull();
    expect(estimateOneRepMax(100, null)).toBeNull();
  });
});
