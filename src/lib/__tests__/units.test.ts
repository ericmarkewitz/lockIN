import {
  formatDistance, fromDisplayDistance, fromDisplayWeight, otherDistanceUnit, otherWeightUnit, toDisplayDistance, toDisplayWeight,
} from '../units';

describe('weight units', () => {
  it('leaves pounds untouched', () => {
    expect(toDisplayWeight(135.25, 'lb')).toBe(135.25);
    expect(fromDisplayWeight(135.25, 'lb')).toBe(135.25);
  });

  it('rounds pounds to 2 decimals for a weight entered in kg', () => {
    expect(toDisplayWeight(fromDisplayWeight(60, 'kg'), 'lb')).toBe(132.28);
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

describe('distance units', () => {
  it('leaves miles untouched', () => {
    expect(toDisplayDistance(3.1, 'mi')).toBe(3.1);
    expect(fromDisplayDistance(3.1, 'mi')).toBe(3.1);
  });

  it('converts stored miles to kilometres, rounded to 2 decimals', () => {
    expect(toDisplayDistance(1, 'km')).toBe(1.61);
    expect(toDisplayDistance(26.2188, 'km')).toBe(42.2);
    expect(toDisplayDistance(3.2, 'km')).toBe(5.15);
  });

  it('converts entered kilometres to miles at full precision', () => {
    expect(fromDisplayDistance(1.609344, 'km')).toBeCloseTo(1, 9);
  });

  it('round-trips a km entry back to the same displayed value', () => {
    for (const km of [5, 10, 21.1, 42.2, 0.4, 3.75]) {
      expect(toDisplayDistance(fromDisplayDistance(km, 'km'), 'km')).toBe(km);
    }
  });

  it('passes null through', () => {
    expect(toDisplayDistance(null, 'km')).toBeNull();
    expect(fromDisplayDistance(null, 'km')).toBeNull();
  });

  it('formats a distance with its unit label', () => {
    expect(formatDistance(3.1, 'mi')).toBe('3.1 mi');
    expect(formatDistance(3.10686, 'km')).toBe('5 km');
    expect(formatDistance(null, 'mi')).toBe('');
  });
});

describe('otherUnit', () => {
  it('flips between the two units of a kind', () => {
    expect(otherWeightUnit('lb')).toBe('kg');
    expect(otherWeightUnit('kg')).toBe('lb');
    expect(otherDistanceUnit('mi')).toBe('km');
    expect(otherDistanceUnit('km')).toBe('mi');
  });
});
