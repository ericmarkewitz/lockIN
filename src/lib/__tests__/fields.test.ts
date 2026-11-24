import { defaultTargets, fieldUnit, formatField, formatTargets, fromDisplayField, toDisplayField } from '../fields';

const imperial = { weight: 'lb', distance: 'mi' } as const;
const metric = { weight: 'kg', distance: 'km' } as const;

describe('fieldUnit', () => {
  it('names the unit each field is shown in', () => {
    expect(fieldUnit('weight', metric)).toBe('kg');
    expect(fieldUnit('distance', metric)).toBe('km');
    expect(fieldUnit('shortDistance', imperial)).toBe('yd');
    expect(fieldUnit('shortDistance', metric)).toBe('m');
    expect(fieldUnit('elevation', imperial)).toBe('ft');
    expect(fieldUnit('steps', imperial)).toBe('steps');
    expect(fieldUnit('routes', imperial)).toBe('routes');
    expect(fieldUnit('difficulty', imperial)).toBe('/10');
    expect(fieldUnit('duration', imperial)).toBe('');
    expect(fieldUnit('score', imperial)).toBe('');
  });
});

describe('toDisplayField / fromDisplayField', () => {
  it('converts stored values into the units shown and back', () => {
    expect(toDisplayField('weight', 135, metric)).toBe(61.23);
    expect(toDisplayField('shortDistance', 1, imperial)).toBe(1760);
    expect(toDisplayField('elevation', 1000, metric)).toBe(304.8);
    expect(toDisplayField('steps', 9000, metric)).toBe(9000);
    expect(toDisplayField('distance', 3, metric)).toBe(4.83);
    expect(fromDisplayField('shortDistance', 1760, imperial)).toBe(1);
    expect(fromDisplayField('elevation', 304.8, metric)).toBeCloseTo(1000, 6);
    expect(fromDisplayField('weight', null, metric)).toBeNull();
  });
});

describe('formatField', () => {
  it('writes a value with its unit', () => {
    expect(formatField('weight', 135, imperial)).toBe('135 lb');
    expect(formatField('reps', 10, imperial)).toBe('10 reps');
    expect(formatField('duration', 1.5, imperial)).toBe('1m 30s');
    expect(formatField('distance', 3, metric)).toBe('4.83 km');
    expect(formatField('shortDistance', 1000 / 1609.344, metric)).toBe('1,000 m');
    expect(formatField('elevation', 1200, imperial)).toBe('1,200 ft');
    expect(formatField('steps', 12000, imperial)).toBe('12,000 steps');
    expect(formatField('routes', 1, imperial)).toBe('1 route');
    expect(formatField('holes', 18, imperial)).toBe('18 holes');
    expect(formatField('score', 84, imperial)).toBe('Score 84');
    expect(formatField('difficulty', 7, imperial)).toBe('Difficulty 7/10');
  });

  it('is blank for no value', () => {
    expect(formatField('steps', null, imperial)).toBe('');
  });
});

describe('formatTargets', () => {
  const none = { targetSets: null, targetReps: null, targetDurationMin: null, targetDistance: null, targetCount: null };

  it('writes a lift as sets × reps, or sets alone when it has no reps', () => {
    expect(formatTargets({ ...none, categoryKind: 'strength', fields: ['weight', 'reps'], targetSets: 3, targetReps: 10 }, imperial)).toEqual(['3×10']);
    expect(formatTargets({ ...none, categoryKind: 'strength', fields: ['weight', 'reps'], targetSets: 3 }, imperial)).toEqual(['3×?']);
    expect(formatTargets({ ...none, categoryKind: 'strength', fields: ['weight', 'duration'], targetSets: 3, targetDurationMin: 1 }, imperial))
      .toEqual(['3 sets', '1 min']);
    expect(formatTargets({ ...none, categoryKind: 'strength', fields: ['weight', 'shortDistance'], targetSets: 1, targetDistance: 40 / 1760 }, imperial))
      .toEqual(['1 set', '40 yd']);
  });

  it('writes the time, distance and count planned for cardio', () => {
    expect(formatTargets({ ...none, categoryKind: 'cardio', fields: ['duration', 'distance', 'steps'], targetDurationMin: 45, targetDistance: 2, targetCount: 8000 }, metric))
      .toEqual(['45 min', '3.22 km', '8,000 steps']);
    expect(formatTargets({ ...none, categoryKind: 'cardio', fields: ['duration', 'distance'] }, metric)).toEqual([]);
  });
});

describe('defaultTargets', () => {
  it('plans 3 sets of 10 for a lift with reps, 3 sets for one without, and nothing for cardio', () => {
    expect(defaultTargets({ categoryKind: 'strength', fields: ['weight', 'reps'] })).toEqual({ targetSets: 3, targetReps: 10 });
    expect(defaultTargets({ categoryKind: 'strength', fields: ['weight', 'duration'] })).toEqual({ targetSets: 3 });
    expect(defaultTargets({ categoryKind: 'cardio', fields: ['duration', 'steps'] })).toEqual({});
  });
});
