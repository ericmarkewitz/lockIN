import { fromDisplayWeight, toDisplayWeight } from '../units';

describe('weight units', () => {
  it('leaves pounds untouched', () => {
    expect(toDisplayWeight(135.25, 'lb')).toBe(135.25);
    expect(fromDisplayWeight(135.25, 'lb')).toBe(135.25);
  });

  it('converts stored pounds to kilograms, rounded to 2 decimals', () => {
    expect(toDisplayWeight(135, 'kg')).toBe(61.23);
    expect(toDisplayWeight(220.462262185, 'kg')).toBe(100);
  });

  it('converts entered kilograms to pounds at full precision', () => {
    expect(fromDisplayWeight(100, 'kg')).toBeCloseTo(220.462262185, 6);
  });

  it('round-trips a kg entry back to the same displayed value', () => {
    for (const kg of [20, 42.5, 60, 62.5, 102.25, 1.25]) {
      expect(toDisplayWeight(fromDisplayWeight(kg, 'kg'), 'kg')).toBe(kg);
    }
  });

  it('passes null through', () => {
    expect(toDisplayWeight(null, 'kg')).toBeNull();
    expect(fromDisplayWeight(null, 'kg')).toBeNull();
  });
});
