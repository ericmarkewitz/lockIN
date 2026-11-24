import type { CategoryKind, WorkoutExercise, WorkoutSet } from '@/data/types';
import { DEFAULT_FIELDS } from '@/data/fields';
import { firstOpenStep, formatSets, groupThousands, nextOpenStep, suggestEntry, workoutSteps, workoutVolume } from '../workoutMode';

const set = (n: number, over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: n, setNumber: n, targetReps: 10, reps: null, weight: null, durationMin: null, distance: null,
  count: null, elevation: null, score: null, difficulty: null,
  weightUnit: null, distanceUnit: null, completed: false, isLogged: false, ...over,
});

let nextId = 100;
const ex = (name: string, sets: WorkoutSet[], kind: CategoryKind = 'strength', over: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id: nextId++, exerciseId: nextId, exerciseName: name, categoryName: 'Lifts', categoryKind: kind, subcategory: null,
  position: 0, targetSets: sets.length, targetReps: 10, targetDurationMin: null, targetDistance: null, targetCount: null,
  fields: [...DEFAULT_FIELDS[kind]], hasLoggedSets: false, isCustom: false, sets, ...over,
});

const units = { weight: 'lb', distance: 'mi' } as const;

describe('workoutSteps', () => {
  it('lists every set of every exercise in order, skipping exercises with no sets', () => {
    const steps = workoutSteps([
      ex('Bench', [set(1), set(2)]),
      ex('Empty', []),
      ex('Squat', [set(3)]),
    ]);
    expect(steps.map((s) => [s.exercise.exerciseName, s.set.id, s.setIndex, s.exerciseIndex])).toEqual([
      ['Bench', 1, 0, 0], ['Bench', 2, 1, 0], ['Squat', 3, 0, 1],
    ]);
  });
});

describe('firstOpenStep / nextOpenStep', () => {
  const steps = workoutSteps([
    ex('Bench', [set(1, { completed: true }), set(2), set(3, { completed: true })]),
    ex('Squat', [set(4)]),
  ]);

  it('starts on the first set that is not done', () => {
    expect(firstOpenStep(steps)).toBe(1);
  });

  it('moves to the next set that is not done, passing over finished ones', () => {
    expect(nextOpenStep(steps, 1)).toBe(3);
  });

  it('never wraps back to a skipped set; the end of the workout is -1', () => {
    expect(nextOpenStep(steps, 3)).toBe(-1);
  });

  it('is -1 when everything is done', () => {
    expect(firstOpenStep(workoutSteps([ex('Bench', [set(1, { completed: true })])]))).toBe(-1);
  });
});

describe('suggestEntry', () => {
  it('keeps what is already logged on the set', () => {
    const e = ex('Bench', [set(1, { weight: 135, reps: 8, weightUnit: 'kg' })]);
    expect(suggestEntry(e, 0, null, units)).toMatchObject({ weight: 135, reps: 8, weightUnit: 'kg' });
  });

  it('carries the weight and unit from the previous set today', () => {
    const e = ex('Bench', [set(1, { weight: 135, reps: 10, weightUnit: 'kg', completed: true }), set(2)]);
    expect(suggestEntry(e, 1, null, units)).toMatchObject({ weight: 135, reps: 10, weightUnit: 'kg' });
  });

  it('falls back to the same set from last time, then the last set from last time', () => {
    const last = { date: '2026-10-26', sets: [set(1, { weight: 100, reps: 9 }), set(2, { weight: 110, reps: 7 })] };
    const e = ex('Bench', [set(11), set(12), set(13)]);
    expect(suggestEntry(e, 1, last, units)).toMatchObject({ weight: 110, reps: 10 });
    expect(suggestEntry(e, 2, last, units)).toMatchObject({ weight: 110 });
  });

  it('uses last time\'s reps when the set has no target', () => {
    const last = { date: '2026-10-26', sets: [set(1, { weight: 100, reps: 9 })] };
    const e = ex('Bench', [set(1, { targetReps: null })]);
    expect(suggestEntry(e, 0, last, units)).toMatchObject({ reps: 9 });
  });

  it('leaves weight blank and uses the user\'s unit with nothing to go on', () => {
    expect(suggestEntry(ex('Bench', [set(1)]), 0, null, { weight: 'kg', distance: 'km' }))
      .toMatchObject({ weight: null, reps: 10, weightUnit: 'kg' });
  });

  it('uses the planned count, and leaves elevation, score and difficulty to be entered', () => {
    const e = ex('Walking', [set(1, { targetReps: null })], 'cardio', { targetCount: 8000, fields: ['duration', 'distance', 'steps'] });
    expect(suggestEntry(e, 0, null, units)).toMatchObject({ count: 8000, elevation: null, score: null, difficulty: null });
    const logged = ex('Climbing', [set(1, { count: 9, difficulty: 6 })], 'cardio', { fields: ['duration', 'routes', 'difficulty'] });
    expect(suggestEntry(logged, 0, null, units)).toMatchObject({ count: 9, difficulty: 6 });
  });

  it('carries a hold time from the set before, then last time, like weight', () => {
    const fields = ['weight', 'duration'] as const;
    const today = ex('Plank', [set(1, { weight: 25, durationMin: 1, completed: true }), set(2)], 'strength', { fields: [...fields] });
    expect(suggestEntry(today, 1, null, units)).toMatchObject({ weight: 25, durationMin: 1 });
    const last = { date: '2026-10-26', sets: [set(1, { weight: 25, durationMin: 1.5 })] };
    expect(suggestEntry(ex('Plank', [set(5)], 'strength', { fields: [...fields] }), 0, last, units)).toMatchObject({ durationMin: 1.5 });
    const planned = ex('Plank', [set(6)], 'strength', { fields: [...fields], targetDurationMin: 2 });
    expect(suggestEntry(planned, 0, last, units)).toMatchObject({ durationMin: 2 });
  });

  it('uses the planned duration and distance for cardio', () => {
    const e = ex('Running', [set(1, { targetReps: null })], 'cardio', { targetDurationMin: 30, targetDistance: 3 });
    expect(suggestEntry(e, 0, null, units)).toMatchObject({ durationMin: 30, distance: 3, distanceUnit: 'mi' });
  });
});

describe('formatSets', () => {
  it('shows strength sets as weight×reps in the user\'s unit', () => {
    expect(formatSets([set(1, { weight: 135, reps: 10 }), set(2, { weight: null, reps: 8 })], ['weight', 'reps'], units)).toBe('135×10, –×8');
    expect(formatSets([set(1, { weight: 135, reps: 10, weightUnit: 'lb' })], ['weight', 'reps'], { weight: 'kg', distance: 'km' })).toBe('61.23×10');
  });

  it('shows cardio as time and distance', () => {
    expect(formatSets([set(1, { durationMin: 30, distance: 3 })], ['duration', 'distance'], { weight: 'lb', distance: 'km' })).toBe('30 min 4.83 km');
  });

  it('shows whatever else an exercise records', () => {
    expect(formatSets([set(1, { durationMin: 40, count: 6500 })], ['duration', 'distance', 'steps'], units)).toBe('40 min 6,500 steps');
    expect(formatSets([set(1, { durationMin: 90, count: 9, difficulty: 6 })], ['duration', 'routes', 'difficulty'], units))
      .toBe('1h 30m 9 routes Difficulty 6/10');
  });

  it('shows a weighted hold or carry as weight × time or distance', () => {
    expect(formatSets([set(1, { weight: 45, durationMin: 1 }), set(2, { durationMin: 0.75 })], ['weight', 'duration'], units))
      .toBe('45 lb × 1 min, 45s');
    expect(formatSets([set(1, { weight: 70, distance: 40 / 1760 })], ['weight', 'shortDistance'], units)).toBe('70 lb × 40 yd');
  });

  it('shows a bodyweight set as reps, plus any weight added', () => {
    expect(formatSets([set(1, { reps: 12 }), set(2, { reps: 8, weight: 25 })], ['reps', 'addedWeight'], units)).toBe('12 reps, 8 reps +25 lb');
  });

  it('marks a set with nothing in it', () => {
    expect(formatSets([set(1)], ['duration', 'routes'], units)).toBe('–');
  });
});

describe('workoutVolume', () => {
  it('adds weight × reps over the finished strength sets, in the user\'s unit', () => {
    const steps = workoutSteps([
      ex('Bench', [set(1, { weight: 135, reps: 10, completed: true }), set(2, { weight: 135, reps: 8, completed: true }), set(3, { weight: 135, reps: 8 })]),
      ex('Running', [set(4, { durationMin: 30, completed: true })], 'cardio'),
    ]);
    expect(workoutVolume(steps, 'lb')).toBe(2430);
    expect(workoutVolume(steps, 'kg')).toBeCloseTo(1102.2, 0);
  });

  it('is 0 with nothing lifted', () => {
    expect(workoutVolume(workoutSteps([ex('Bench', [set(1)])]), 'lb')).toBe(0);
  });
});

describe('groupThousands', () => {
  it('rounds and puts commas in big numbers', () => {
    expect(groupThousands(12450.4)).toBe('12,450');
    expect(groupThousands(1234567)).toBe('1,234,567');
    expect(groupThousands(950)).toBe('950');
  });
});
