import {
  DEFAULT_FIELDS, FIELD_CHOICES, FIELDS, fieldFor, normalizeFields, parseFields, serializeFields, targetKeys, toggleField,
} from '../fields';

describe('parseFields', () => {
  it("falls back to the category's default when nothing is stored", () => {
    expect(parseFields(null, 'strength')).toEqual(['weight', 'reps']);
    expect(parseFields(null, 'cardio')).toEqual(['duration', 'distance']);
    expect(parseFields('', 'mindbody')).toEqual(['duration']);
  });

  it('reads a stored list in order', () => {
    expect(parseFields('duration,distance,steps', 'cardio')).toEqual(['duration', 'distance', 'steps']);
  });

  it('drops ids it does not know, and falls back if none are left', () => {
    expect(parseFields('duration,laps', 'cardio')).toEqual(['duration']);
    expect(parseFields('laps', 'cardio')).toEqual(DEFAULT_FIELDS.cardio);
  });
});

describe('normalizeFields', () => {
  it('puts fields in their standard order', () => {
    expect(normalizeFields(['steps', 'distance', 'duration'], 'cardio')).toEqual(['duration', 'distance', 'steps']);
    expect(normalizeFields(['addedWeight', 'reps'], 'strength')).toEqual(['reps', 'addedWeight']);
  });

  it('keeps only the first of two fields stored in the same place', () => {
    expect(normalizeFields(['steps', 'routes'], 'cardio')).toEqual(['steps']);
    expect(normalizeFields(['weight', 'addedWeight', 'reps'], 'strength')).toEqual(['weight', 'reps']);
  });

  it('rejects a field the category does not offer', () => {
    expect(() => normalizeFields(['steps'], 'strength')).toThrow('Steps is not available for strength exercises');
  });

  it('needs at least one field', () => {
    expect(() => normalizeFields([], 'cardio')).toThrow('Pick at least one thing to record');
  });
});

describe('toggleField', () => {
  it('adds a field in its standard place', () => {
    expect(toggleField(['duration'], 'elevation', 'cardio')).toEqual(['duration', 'elevation']);
  });

  it('removes a field that is on', () => {
    expect(toggleField(['duration', 'distance'], 'distance', 'cardio')).toEqual(['duration']);
  });

  it('never removes the last field', () => {
    expect(toggleField(['duration'], 'duration', 'cardio')).toEqual(['duration']);
  });

  it('swaps out a field stored in the same place', () => {
    expect(toggleField(['duration', 'steps'], 'routes', 'cardio')).toEqual(['duration', 'routes']);
    expect(toggleField(['weight', 'reps'], 'addedWeight', 'strength')).toEqual(['reps', 'addedWeight']);
  });
});

describe('serializeFields', () => {
  it('round-trips through parseFields', () => {
    const fields = normalizeFields(['duration', 'routes', 'difficulty'], 'cardio');
    expect(parseFields(serializeFields(fields), 'cardio')).toEqual(fields);
  });
});

describe('FIELD_CHOICES', () => {
  it("offers each category's defaults", () => {
    for (const kind of ['strength', 'cardio', 'mindbody'] as const) {
      for (const f of DEFAULT_FIELDS[kind]) expect(FIELD_CHOICES[kind]).toContain(f);
    }
  });

  it('lets climbing-like cardio count routes and rate difficulty', () => {
    expect(FIELD_CHOICES.cardio).toEqual(expect.arrayContaining(['routes', 'difficulty', 'steps', 'elevation']));
  });
});

describe('fieldFor and targetKeys', () => {
  it('finds the field stored in a place', () => {
    expect(fieldFor(['duration', 'distance', 'steps'], 'count')).toBe('steps');
    expect(fieldFor(['duration'], 'count')).toBeNull();
  });

  it('lists the targets a plan can set, in field order', () => {
    expect(targetKeys(['weight', 'reps'])).toEqual(['targetReps']);
    expect(targetKeys(['weight', 'duration'])).toEqual(['targetDurationMin']);
    expect(targetKeys(['duration', 'distance', 'steps'])).toEqual(['targetDurationMin', 'targetDistance', 'targetCount']);
    expect(targetKeys(['duration', 'routes', 'difficulty'])).toEqual(['targetDurationMin', 'targetCount']);
  });

  it('names counted things with a plural noun', () => {
    expect(FIELDS.steps.noun).toBe('steps');
    expect(FIELDS.routes.label).toBe('Routes');
  });
});
