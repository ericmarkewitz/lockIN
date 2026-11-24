import { addExercise, listCategoriesWithExercises, setDefaultFields } from '../exercises';
import { getPlan, markPlanComplete, setPlanDay } from '../plan';
import type { Workout } from '../types';
import {
  addExerciseToWorkout,
  addSet,
  ensureWorkout,
  getLastPerformance,
  getWorkout,
  getRangeSummary,
  refreshUntouchedWorkouts,
  removeExerciseFromWorkout,
  removeSet,
  reorderWorkoutExercises,
  replaceWorkoutExercise,
  setRestDay,
  setWorkoutExerciseFields,
  updateSet,
} from '../workouts';
import { findByName } from '@/test/helpers';
import { createTestDb } from '@/test/testDb';
import type { Db } from '@/db/types';

// 2026-11-02 is a Monday (weekday 1)
const MON = '2026-11-02';

async function planned(): Promise<Db> {
  const db = await createTestDb();
  const bench = await findByName(db, 'Bench Press');
  const run = await findByName(db, 'Running');
  await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: bench, targetSets: 3, targetReps: 10 }] });
  await setPlanDay(db, 3, { isRest: false, items: [{ exerciseId: run, targetDurationMin: 30, targetDistance: 3 }] });
  await setPlanDay(db, 2, { isRest: true, items: [] });
  await markPlanComplete(db, '2026-10-01');
  return db;
}

describe('ensureWorkout / getWorkout', () => {
  it('getWorkout returns null until a workout exists', async () => {
    const db = await planned();
    expect(await getWorkout(db, MON)).toBeNull();
  });

  it('creates a workout from the plan with one row per target set', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    expect(w.isRest).toBe(false);
    expect(w.exercises).toHaveLength(1);
    const ex = w.exercises[0];
    expect(ex.exerciseName).toBe('Bench Press');
    expect(ex.sets.map((s) => [s.setNumber, s.targetReps, s.completed])).toEqual([
      [1, 10, false], [2, 10, false], [3, 10, false],
    ]);
  });

  it('creates a single set row for cardio targets', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, '2026-11-04'); // Wednesday
    expect(w.exercises[0].categoryKind).toBe('cardio');
    expect(w.exercises[0].sets).toHaveLength(1);
    expect(w.exercises[0]).toMatchObject({ targetDurationMin: 30, targetDistance: 3 });
  });

  it('includes the subcategory of each exercise', async () => {
    const db = await planned();
    expect((await ensureWorkout(db, '2026-11-02')).exercises[0].subcategory).toBe('Chest'); // Monday: Bench Press
    expect((await ensureWorkout(db, '2026-11-04')).exercises[0].subcategory).toBeNull(); // Wednesday: cardio
  });

  it('says whether each exercise is a custom one', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, '2026-11-02');
    expect(w.exercises[0].isCustom).toBe(false);
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    const sled = await addExercise(db, lifts.id, 'Sled Push');
    await addExerciseToWorkout(db, w.id, sled.id);
    expect((await getWorkout(db, '2026-11-02'))!.exercises.at(-1)).toMatchObject({ exerciseName: 'Sled Push', isCustom: true });
  });

  it('copies rest days from the plan', async () => {
    const db = await planned();
    expect((await ensureWorkout(db, '2026-11-03')).isRest).toBe(true);
  });

  it('is idempotent and never duplicates', async () => {
    const db = await planned();
    const a = await ensureWorkout(db, MON);
    const b = await ensureWorkout(db, MON);
    expect(b.id).toBe(a.id);
    expect(b.exercises).toHaveLength(1);
  });

  it('later plan edits do not change an existing workout', async () => {
    const db = await planned();
    await ensureWorkout(db, MON);
    const squat = await findByName(db, 'Squat');
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: squat, targetSets: 5, targetReps: 5 }] });
    expect((await getWorkout(db, MON))!.exercises[0].exerciseName).toBe('Bench Press');
  });
});

describe('logging', () => {
  it('records weight and reps for a set', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    const set = w.exercises[0].sets[0];
    await updateSet(db, set.id, { weight: 135, reps: 10, completed: true });
    const s = (await getWorkout(db, MON))!.exercises[0].sets[0];
    expect(s).toMatchObject({ weight: 135, reps: 10, completed: true });
  });

  it('records duration and distance for cardio', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, '2026-11-04');
    await updateSet(db, w.exercises[0].sets[0].id, { durationMin: 28.5, distance: 3.1, completed: true });
    expect((await getWorkout(db, '2026-11-04'))!.exercises[0].sets[0]).toMatchObject({ durationMin: 28.5, distance: 3.1 });
  });

  it('partial updates leave other fields alone', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    const id = w.exercises[0].sets[0].id;
    await updateSet(db, id, { weight: 100 });
    await updateSet(db, id, { reps: 8 });
    expect((await getWorkout(db, MON))!.exercises[0].sets[0]).toMatchObject({ weight: 100, reps: 8 });
  });

  it('can clear a value by passing null', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    const id = w.exercises[0].sets[0].id;
    await updateSet(db, id, { weight: 100 });
    await updateSet(db, id, { weight: null });
    expect((await getWorkout(db, MON))!.exercises[0].sets[0].weight).toBeNull();
  });

  it('rejects negative numbers', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    await expect(updateSet(db, w.exercises[0].sets[0].id, { weight: -5 })).rejects.toThrow(/negative/i);
  });

  it('records the unit a set was entered in, which starts unset', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    const id = w.exercises[0].sets[0].id;
    expect(w.exercises[0].sets[0]).toMatchObject({ weightUnit: null, distanceUnit: null });
    await updateSet(db, id, { weight: 44.0925, weightUnit: 'kg', distanceUnit: 'km' });
    expect((await getWorkout(db, MON))!.exercises[0].sets[0]).toMatchObject({ weight: 44.0925, weightUnit: 'kg', distanceUnit: 'km' });
    await updateSet(db, id, { weightUnit: null });
    expect((await getWorkout(db, MON))!.exercises[0].sets[0].weightUnit).toBeNull();
  });

  it('rejects an unknown entered unit', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    await expect(updateSet(db, w.exercises[0].sets[0].id, { weightUnit: 'st' as never })).rejects.toThrow(/unit/i);
    await expect(updateSet(db, w.exercises[0].sets[0].id, { distanceUnit: 'yd' as never })).rejects.toThrow(/unit/i);
  });

  it('gives an added set the units of the last set, so a kg gym stays in kg', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    const we = w.exercises[0];
    await updateSet(db, we.sets[2].id, { weightUnit: 'kg', distanceUnit: 'km' });
    await addSet(db, we.id);
    const sets = (await getWorkout(db, MON))!.exercises[0].sets;
    expect(sets[3]).toMatchObject({ setNumber: 4, weight: null, weightUnit: 'kg', distanceUnit: 'km' });
  });

  it('only adds sets to strength exercises; cardio, yoga and mobility log one entry', async () => {
    const db = await planned();
    const wed = await ensureWorkout(db, '2026-11-04');
    await expect(addSet(db, wed.exercises[0].id)).rejects.toThrow(/strength/i);
    expect((await getWorkout(db, '2026-11-04'))!.exercises[0].sets).toHaveLength(1);
  });

  it('adds and removes sets, keeping set numbers contiguous', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    const we = w.exercises[0];
    await addSet(db, we.id);
    expect((await getWorkout(db, MON))!.exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 2, 3, 4]);
    await removeSet(db, we.sets[0].id);
    expect((await getWorkout(db, MON))!.exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 2, 3]);
  });

  it('adds and removes ad-hoc exercises on a day', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    const squat = await findByName(db, 'Squat');
    const we = await addExerciseToWorkout(db, w.id, squat, { targetSets: 2, targetReps: 5 });
    let cur = (await getWorkout(db, MON))!;
    expect(cur.exercises.map((e) => e.exerciseName)).toEqual(['Bench Press', 'Squat']);
    expect(cur.exercises[1].sets).toHaveLength(2);
    await removeExerciseFromWorkout(db, we.id);
    cur = (await getWorkout(db, MON))!;
    expect(cur.exercises.map((e) => e.exerciseName)).toEqual(['Bench Press']);
    expect(await db.getAllAsync('SELECT id FROM sets WHERE workout_exercise_id = ?', [we.id])).toEqual([]);
  });

  it('can turn a day into a rest day and back', async () => {
    const db = await planned();
    await ensureWorkout(db, MON);
    await setRestDay(db, MON, true);
    expect((await getWorkout(db, MON))!.isRest).toBe(true);
    await setRestDay(db, MON, false);
    expect((await getWorkout(db, MON))!.isRest).toBe(false);
  });

  it('flags which exercises have logged sets', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    await addExerciseToWorkout(db, w.id, await findByName(db, 'Squat'));
    await updateSet(db, w.exercises[0].sets[0].id, { reps: 5 });
    const { exercises } = (await getWorkout(db, MON))!;
    expect(exercises.map((e) => [e.exerciseName, e.hasLoggedSets])).toEqual([['Bench Press', true], ['Squat', false]]);
  });
});

describe('history helpers', () => {
  it('returns the most recent completed performance before a date', async () => {
    const db = await planned();
    const bench = await findByName(db, 'Bench Press');
    const w1 = await ensureWorkout(db, '2026-10-26');
    await updateSet(db, w1.exercises[0].sets[0].id, { weight: 130, reps: 10, completed: true });
    const w2 = await ensureWorkout(db, '2026-10-19');
    await updateSet(db, w2.exercises[0].sets[0].id, { weight: 120, reps: 10, completed: true });
    const last = await getLastPerformance(db, bench, MON);
    expect(last).toMatchObject({ date: '2026-10-26' });
    expect(last!.sets[0]).toMatchObject({ weight: 130, reps: 10 });
    expect(await getLastPerformance(db, bench, '2026-10-19')).toBeNull();
  });
});

describe('sets with values but no tick', () => {
  const LATER = '2026-11-09';

  /** Monday's Bench Press has 3 sets; the first `n` get values and are left unticked. */
  async function typedSets(n: number) {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    for (const s of w.exercises[0].sets.slice(0, n)) await updateSet(db, s.id, { weight: 100, reps: 5 });
    return { db, exerciseId: w.exercises[0].exerciseId };
  }

  it('makes the calendar show partial when only some sets have values', async () => {
    const { db } = await typedSets(1);
    const [day] = await getRangeSummary(db, MON, MON, LATER);
    expect(day.status).toBe('partial');
  });

  it('makes the calendar show completed when every set has values', async () => {
    const { db } = await typedSets(3);
    const [day] = await getRangeSummary(db, MON, MON, LATER);
    expect(day.status).toBe('completed');
  });

  it('still shows missed when a past day has no values or ticks', async () => {
    const { db } = await typedSets(0);
    const [day] = await getRangeSummary(db, MON, MON, LATER);
    expect(day.status).toBe('missed');
  });

  it('feeds the last performance hint, leaving out blank sets', async () => {
    const { db, exerciseId } = await typedSets(2);
    const last = await getLastPerformance(db, exerciseId, LATER);
    expect(last?.date).toBe(MON);
    expect(last?.sets.map((s) => [s.setNumber, s.weight, s.reps, s.completed])).toEqual([
      [1, 100, 5, false], [2, 100, 5, false],
    ]);
  });

  it('counts a duration-only cardio set as logged', async () => {
    const db = await planned();
    const wed = '2026-11-04';
    const w = await ensureWorkout(db, wed);
    await updateSet(db, w.exercises[0].sets[0].id, { durationMin: 30 });
    const [day] = await getRangeSummary(db, wed, wed, LATER);
    expect(day.status).toBe('completed');
    expect((await getLastPerformance(db, w.exercises[0].exerciseId, LATER))?.date).toBe(wed);
  });
});

describe('isLogged on sets', () => {
  const firstSet = async (db: Db) => (await getWorkout(db, MON))!.exercises[0].sets[0];

  it('is false for a set with nothing entered', async () => {
    const db = await planned();
    await ensureWorkout(db, MON);
    expect((await firstSet(db)).isLogged).toBe(false);
  });

  it.each([
    ['reps', { reps: 0 }],
    ['weight', { weight: 135 }],
    ['duration', { durationMin: 30 }],
    ['distance', { distance: 3 }],
    ['completed', { completed: true }],
  ])('is true once a set has %s', async (_name, patch) => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    await updateSet(db, w.exercises[0].sets[0].id, patch);
    expect((await firstSet(db)).isLogged).toBe(true);
  });

  it('is false again once the value is cleared', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    const id = w.exercises[0].sets[0].id;
    await updateSet(db, id, { weight: 135 });
    await updateSet(db, id, { weight: null });
    expect((await firstSet(db)).isLogged).toBe(false);
  });

  it('is true on the sets of a last performance', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    await updateSet(db, w.exercises[0].sets[0].id, { weight: 135 });
    const last = await getLastPerformance(db, w.exercises[0].exerciseId, '2026-11-09');
    expect(last!.sets.map((s) => s.isLogged)).toEqual([true]);
  });
});

describe('getRangeSummary', () => {
  const TODAY = '2026-11-04'; // Wednesday

  it('derives planned/rest/none from the plan when no workout exists', async () => {
    const db = await planned();
    const s = await getRangeSummary(db, '2026-11-02', '2026-11-08', TODAY);
    const by = Object.fromEntries(s.map((d) => [d.date, d.status]));
    expect(by['2026-11-04']).toBe('planned'); // today, Wed running
    expect(by['2026-11-03']).toBe('rest');
    expect(by['2026-11-05']).toBe('none'); // Thursday has nothing
    expect(by['2026-11-02']).toBe('missed'); // Monday in the past, never done
  });

  it('marks completed and partial workouts', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    await updateSet(db, w.exercises[0].sets[0].id, { reps: 10, weight: 100, completed: true });
    let s = await getRangeSummary(db, MON, MON, TODAY);
    expect(s[0].status).toBe('partial');
    for (const set of w.exercises[0].sets) await updateSet(db, set.id, { completed: true });
    s = await getRangeSummary(db, MON, MON, TODAY);
    expect(s[0]).toMatchObject({ status: 'completed', exerciseCount: 1 });
  });

  it('includes exercise counts and category kinds for planned days', async () => {
    const db = await planned();
    const s = await getRangeSummary(db, '2026-11-04', '2026-11-04', TODAY);
    expect(s[0]).toMatchObject({ exerciseCount: 1, kinds: ['cardio'] });
  });

  describe('on a day marked as rest', () => {
    it('shows rest when nothing is logged', async () => {
      const db = await planned();
      await ensureWorkout(db, MON);
      await setRestDay(db, MON, true);
      const [day] = await getRangeSummary(db, MON, MON, TODAY);
      expect(day).toMatchObject({ status: 'rest', exerciseCount: 0, kinds: [] });
    });

    it('reports logged sets, counting only the exercises that have them', async () => {
      const db = await planned();
      const w = await ensureWorkout(db, MON);
      await addExerciseToWorkout(db, w.id, await findByName(db, 'Running'));
      for (const s of w.exercises[0].sets) await updateSet(db, s.id, { weight: 100, reps: 5 });
      await setRestDay(db, MON, true);
      const [day] = await getRangeSummary(db, MON, MON, TODAY);
      expect(day).toMatchObject({ status: 'completed', exerciseCount: 1, kinds: ['strength'] });
    });
  });

  describe('before tracking started', () => {
    async function freshPlan(): Promise<Db> {
      const db = await createTestDb();
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Bench Press'), targetSets: 3 }] });
      await setPlanDay(db, 2, { isRest: true, items: [] });
      return db;
    }
    const LATER = '2026-11-11';

    it('shows nothing for past days before the plan was first saved', async () => {
      const db = await freshPlan();
      await markPlanComplete(db, '2026-11-04');
      const by = Object.fromEntries((await getRangeSummary(db, '2026-11-02', '2026-11-10', LATER)).map((d) => [d.date, d]));
      expect(by['2026-11-02']).toMatchObject({ status: 'none', beforePlan: true }); // Monday before the plan existed
      expect(by['2026-11-03']).toMatchObject({ status: 'none', beforePlan: true }); // nor is an old Tuesday a rest day
      expect(by['2026-11-09'].status).toBe('missed'); // Monday after it
      expect(by['2026-11-09'].beforePlan).toBeUndefined();
      expect(by['2026-11-10'].status).toBe('rest');
    });

    it('keeps the date of the first save when the plan is saved again', async () => {
      const db = await freshPlan();
      await markPlanComplete(db, '2026-11-01');
      await markPlanComplete(db, '2026-11-10');
      const [day] = await getRangeSummary(db, MON, MON, LATER);
      expect(day.status).toBe('missed');
    });

    it('marks no past day missed when tracking has not started', async () => {
      const db = await freshPlan();
      const [day] = await getRangeSummary(db, MON, MON, LATER);
      expect(day).toMatchObject({ status: 'none', beforePlan: true });
    });

    it('opens a day before the plan was first saved empty, so it is not shown as missed', async () => {
      const db = await freshPlan();
      await markPlanComplete(db, '2026-11-04'); // Wednesday; Monday's plan has Bench Press
      const w = await ensureWorkout(db, MON);
      expect(w.exercises).toEqual([]);
      expect(w.isRest).toBe(false);
      const [day] = await getRangeSummary(db, MON, MON, '2026-11-04');
      expect(day).toMatchObject({ status: 'none', exerciseCount: 0, beforePlan: true });
    });

    it('still fills in days from the plan once it was saved', async () => {
      const db = await freshPlan();
      await markPlanComplete(db, '2026-11-04');
      expect((await ensureWorkout(db, '2026-11-09')).exercises).toHaveLength(1);
    });
  });

  describe('after the plan changes', () => {
    const LATER = '2026-11-10'; // Tuesday
    /** The plan from `planned()` (since Oct 1), then on Nov 6: Monday becomes rest and Thursday gets Squat. */
    async function changed(): Promise<Db> {
      const db = await planned();
      await setPlanDay(db, 1, { isRest: true, items: [] });
      await setPlanDay(db, 4, { isRest: false, items: [{ exerciseId: await findByName(db, 'Squat'), targetSets: 3 }] });
      await markPlanComplete(db, '2026-11-06');
      return db;
    }

    it('keeps past days on the plan they had at the time', async () => {
      const db = await changed();
      const by = Object.fromEntries((await getRangeSummary(db, '2026-11-02', '2026-11-12', LATER)).map((d) => [d.date, d]));
      expect(by['2026-11-02']).toMatchObject({ status: 'missed', exerciseCount: 1, kinds: ['strength'] }); // old Monday
      expect(by['2026-11-05'].status).toBe('none'); // Thursday had nothing yet
      expect(by['2026-11-05'].beforePlan).toBeUndefined();
      expect(by['2026-11-09'].status).toBe('rest'); // new Monday
      expect(by['2026-11-12']).toMatchObject({ status: 'planned', kinds: ['strength'] }); // new Thursday ahead
    });

    it('uses the last save of a day when the plan is saved twice that day', async () => {
      const db = await changed();
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Bench Press'), targetSets: 3 }] });
      await markPlanComplete(db, '2026-11-06');
      const [day] = await getRangeSummary(db, '2026-11-09', '2026-11-09', LATER);
      expect(day.status).toBe('missed');
    });

    it('opens a past day that had nothing planned then empty, not with the new plan', async () => {
      const db = await changed();
      const w = await ensureWorkout(db, '2026-11-05'); // Thursday: nothing then, Squat now
      expect(w).toMatchObject({ isRest: false, exercises: [] });
      const [day] = await getRangeSummary(db, '2026-11-05', '2026-11-05', LATER);
      expect(day.status).toBe('none');
    });

    it('opens a past rest day as rest, even if the day has exercises now', async () => {
      const db = await changed();
      await setPlanDay(db, 2, { isRest: false, items: [{ exerciseId: await findByName(db, 'Squat'), targetSets: 3 }] });
      await markPlanComplete(db, '2026-11-06');
      const w = await ensureWorkout(db, '2026-11-03'); // Tuesday: rest then, Squat now
      expect(w).toMatchObject({ isRest: true, exercises: [] });
      const [day] = await getRangeSummary(db, '2026-11-03', '2026-11-03', LATER);
      expect(day.status).toBe('rest');
    });

    it('opens days from the latest save on with the current plan', async () => {
      const db = await changed();
      expect((await ensureWorkout(db, '2026-11-12')).exercises.map((e) => e.exerciseName)).toEqual(['Squat']);
    });
  });

  it('returns one entry per date in order', async () => {
    const db = await planned();
    const s = await getRangeSummary(db, '2026-11-01', '2026-11-30', TODAY);
    expect(s).toHaveLength(30);
    expect(s[0].date).toBe('2026-11-01');
  });
});

describe('refreshUntouchedWorkouts', () => {
  it('regenerates future workouts with nothing logged, keeps logged ones', async () => {
    const db = await planned();
    await ensureWorkout(db, '2026-11-09'); // untouched Monday
    const logged = await ensureWorkout(db, '2026-11-16');
    await updateSet(db, logged.exercises[0].sets[0].id, { weight: 100, completed: true });
    const squat = await findByName(db, 'Squat');
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: squat, targetSets: 5, targetReps: 5 }] });

    await refreshUntouchedWorkouts(db, '2026-11-05');

    expect(await getWorkout(db, '2026-11-09')).toBeNull(); // will regenerate on open
    expect((await ensureWorkout(db, '2026-11-09')).exercises[0].exerciseName).toBe('Squat');
    expect((await getWorkout(db, '2026-11-16'))!.exercises[0].exerciseName).toBe('Bench Press');
  });

  describe('keeps days the user changed by hand', () => {
    const DAY = '2026-11-09'; // future Monday: Bench Press 3×10 in the plan

    /** Edits the day, changes Monday's plan to Squat, then refreshes as a plan save does. */
    async function editThenSavePlan(edit: (db: Db, w: Workout) => Promise<unknown>) {
      const db = await planned();
      await edit(db, await ensureWorkout(db, DAY));
      const squat = await findByName(db, 'Squat');
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: squat, targetSets: 5, targetReps: 5 }] });
      await refreshUntouchedWorkouts(db, '2026-11-05');
      return getWorkout(db, DAY);
    }

    it('switched to a rest day', async () => {
      const w = await editThenSavePlan((db) => setRestDay(db, DAY, true));
      expect(w?.isRest).toBe(true);
    });

    it('switched from a planned rest day to a workout day', async () => {
      const db = await planned();
      const TUE = '2026-11-10'; // Tuesday is a rest day in the plan
      await setRestDay(db, TUE, false);
      await refreshUntouchedWorkouts(db, '2026-11-05');
      expect((await getWorkout(db, TUE))?.isRest).toBe(false);
    });

    it('with an added exercise', async () => {
      const w = await editThenSavePlan(async (db, wk) =>
        addExerciseToWorkout(db, wk.id, await findByName(db, 'Deadlift')),
      );
      expect(w?.exercises.map((e) => e.exerciseName)).toEqual(['Bench Press', 'Deadlift']);
    });

    it('with a removed exercise', async () => {
      const w = await editThenSavePlan((db, wk) => removeExerciseFromWorkout(db, wk.exercises[0].id));
      expect(w?.exercises).toEqual([]);
    });

    it('with an added set', async () => {
      const w = await editThenSavePlan((db, wk) => addSet(db, wk.exercises[0].id));
      expect(w?.exercises[0].sets).toHaveLength(4);
    });

    it('with a removed set', async () => {
      const w = await editThenSavePlan((db, wk) => removeSet(db, wk.exercises[0].sets[0].id));
      expect(w?.exercises[0].sets).toHaveLength(2);
    });
  });

  it('still regenerates a day that was only opened', async () => {
    const db = await planned();
    await ensureWorkout(db, '2026-11-09');
    await refreshUntouchedWorkouts(db, '2026-11-05');
    expect(await getWorkout(db, '2026-11-09')).toBeNull();
  });

  it('never touches dates before the cutoff', async () => {
    const db = await planned();
    await ensureWorkout(db, MON);
    await refreshUntouchedWorkouts(db, '2026-11-05');
    expect(await getWorkout(db, MON)).not.toBeNull();
  });
});

describe('reorderWorkoutExercises', () => {
  async function threeExercises() {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    await addExerciseToWorkout(db, w.id, await findByName(db, 'Squat'));
    await addExerciseToWorkout(db, w.id, await findByName(db, 'Deadlift'));
    const ids = (await getWorkout(db, MON))!.exercises.map((e) => e.id);
    await db.runAsync('UPDATE workouts SET is_customized = 0 WHERE id = ?', [w.id]);
    return { db, w, ids };
  }
  const names = async (db: Db, date = MON) => (await getWorkout(db, date))!.exercises.map((e) => e.exerciseName);

  it('puts the day in the given order, keeping logged sets with their exercise', async () => {
    const { db, ids } = await threeExercises();
    const before = (await getWorkout(db, MON))!;
    await updateSet(db, before.exercises[0].sets[0].id, { weight: 135, reps: 10, completed: true });
    await reorderWorkoutExercises(db, before.id, [ids[2], ids[0], ids[1]]);
    const after = (await getWorkout(db, MON))!;
    expect(after.exercises.map((e) => e.exerciseName)).toEqual(['Deadlift', 'Bench Press', 'Squat']);
    expect(after.exercises[1].sets[0]).toMatchObject({ weight: 135, reps: 10, completed: true });
  });

  it('keeps exercises left out of the list in their order after the listed ones', async () => {
    const { db, w, ids } = await threeExercises();
    await reorderWorkoutExercises(db, w.id, [ids[2]]);
    expect(await names(db)).toEqual(['Deadlift', 'Bench Press', 'Squat']);
  });

  it('ignores ids from another day and repeats', async () => {
    const { db, w, ids } = await threeExercises();
    const other = await ensureWorkout(db, '2026-11-09');
    await reorderWorkoutExercises(db, w.id, [other.exercises[0].id, ids[1], ids[1], ids[0]]);
    expect(await names(db)).toEqual(['Squat', 'Bench Press', 'Deadlift']);
    expect(await names(db, '2026-11-09')).toEqual(['Bench Press']);
  });

  it('survives a plan edit, and leaves the plan alone', async () => {
    const { db, w, ids } = await threeExercises();
    await reorderWorkoutExercises(db, w.id, [ids[1], ids[0], ids[2]]);
    await refreshUntouchedWorkouts(db, '2026-11-01');
    expect(await names(db)).toEqual(['Squat', 'Bench Press', 'Deadlift']);
    const monday = (await getPlan(db)).find((d) => d.weekday === 1)!;
    expect(monday.items.map((i) => i.exerciseName)).toEqual(['Bench Press']);
  });

  it('does not mark the day changed when the order stays the same', async () => {
    const { db, w, ids } = await threeExercises();
    await reorderWorkoutExercises(db, w.id, ids);
    expect(await db.getFirstAsync('SELECT is_customized FROM workouts WHERE id = ?', [w.id])).toEqual({ is_customized: 0 });
  });
});

describe('replaceWorkoutExercise', () => {
  async function benchThenSquat() {
    const db = await planned();
    const w = await ensureWorkout(db, MON);
    await addExerciseToWorkout(db, w.id, await findByName(db, 'Squat'), { targetSets: 2, targetReps: 5 });
    await db.runAsync('UPDATE workouts SET is_customized = 0 WHERE id = ?', [w.id]);
    return { db, w: (await getWorkout(db, MON))!, incline: await findByName(db, 'Incline Bench Press') };
  }

  it('swaps in another exercise in the same place with the same targets, when nothing is logged', async () => {
    const { db, w, incline } = await benchThenSquat();
    const { id } = await replaceWorkoutExercise(db, w.exercises[0].id, incline);
    const after = (await getWorkout(db, MON))!;
    expect(after.exercises.map((e) => e.exerciseName)).toEqual(['Incline Bench Press', 'Squat']);
    expect(after.exercises[0]).toMatchObject({ id, targetSets: 3, targetReps: 10 });
    expect(after.exercises[0].sets.map((s) => [s.setNumber, s.targetReps, s.completed])).toEqual([
      [1, 10, false], [2, 10, false], [3, 10, false],
    ]);
  });

  it('keeps the sets already logged on the old exercise and gives the new one the sets left', async () => {
    const { db, w, incline } = await benchThenSquat();
    await updateSet(db, w.exercises[0].sets[0].id, { weight: 135, reps: 10, completed: true });
    await replaceWorkoutExercise(db, w.exercises[0].id, incline);
    const after = (await getWorkout(db, MON))!;
    expect(after.exercises.map((e) => e.exerciseName)).toEqual(['Bench Press', 'Incline Bench Press', 'Squat']);
    expect(after.exercises[0].sets).toEqual([expect.objectContaining({ weight: 135, reps: 10, completed: true })]);
    expect(after.exercises[1].sets.map((s) => [s.setNumber, s.targetReps, s.completed])).toEqual([[1, 10, false], [2, 10, false]]);
  });

  it('carries cardio targets over', async () => {
    const db = await planned();
    const w = await ensureWorkout(db, '2026-11-04');
    await replaceWorkoutExercise(db, w.exercises[0].id, await findByName(db, 'Biking'));
    const ex = (await getWorkout(db, '2026-11-04'))!.exercises[0];
    expect(ex).toMatchObject({ exerciseName: 'Biking', targetDurationMin: 30, targetDistance: 3 });
    expect(ex.sets).toHaveLength(1);
  });

  it('changes only that day: it survives a plan edit and leaves the plan alone', async () => {
    const { db, w, incline } = await benchThenSquat();
    await replaceWorkoutExercise(db, w.exercises[0].id, incline);
    await refreshUntouchedWorkouts(db, '2026-11-01');
    expect((await getWorkout(db, MON))!.exercises[0].exerciseName).toBe('Incline Bench Press');
    expect((await getPlan(db)).find((d) => d.weekday === 1)!.items.map((i) => i.exerciseName)).toEqual(['Bench Press']);
    expect((await ensureWorkout(db, '2026-11-09')).exercises[0].exerciseName).toBe('Bench Press');
  });

  it('does nothing when every set is already logged', async () => {
    const { db, w, incline } = await benchThenSquat();
    for (const s of w.exercises[0].sets) await updateSet(db, s.id, { reps: 10, completed: true });
    await expect(replaceWorkoutExercise(db, w.exercises[0].id, incline)).rejects.toThrow(/done/i);
    expect((await getWorkout(db, MON))!.exercises.map((e) => e.exerciseName)).toEqual(['Bench Press', 'Squat']);
  });

  it('refuses an exercise from another category', async () => {
    const { db, w } = await benchThenSquat();
    await expect(replaceWorkoutExercise(db, w.exercises[0].id, await findByName(db, 'Running'))).rejects.toThrow(/category/i);
  });
});

describe('exercises that record more than weight, reps, time and distance', () => {
  async function walkOn(db: Db, date: string, targets: { targetDurationMin?: number; targetCount?: number } = {}) {
    const walk = await findByName(db, 'Walking');
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: walk, ...targets }] });
    return (await ensureWorkout(db, date)).exercises[0];
  }

  it('tells each workout exercise what it records', async () => {
    const db = await createTestDb();
    const walk = await walkOn(db, MON);
    expect(walk.fields).toEqual(['duration', 'distance', 'steps']);
    await addExerciseToWorkout(db, (await getWorkout(db, MON))!.id, await findByName(db, 'Bench Press'), { targetSets: 1 });
    expect((await getWorkout(db, MON))!.exercises[1].fields).toEqual(['weight', 'reps']);
  });

  it('carries a count target from the plan to the day', async () => {
    const db = await createTestDb();
    const walk = await walkOn(db, MON, { targetDurationMin: 45, targetCount: 8000 });
    expect(walk).toMatchObject({ targetDurationMin: 45, targetCount: 8000 });
  });

  it('logs steps, elevation, a score and a difficulty, each counting as logged on its own', async () => {
    const db = await createTestDb();
    const walk = await walkOn(db, MON);
    for (const patch of [{ count: 9500 }, { elevation: 300 }, { score: 84 }, { difficulty: 7 }]) {
      await updateSet(db, walk.sets[0].id, { count: null, elevation: null, score: null, difficulty: null, ...patch });
      const set = (await getWorkout(db, MON))!.exercises[0].sets[0];
      expect(set).toMatchObject({ count: null, elevation: null, score: null, difficulty: null, ...patch, isLogged: true });
    }
  });

  it('only takes a whole-number difficulty from 1 to 10, and whole counts and scores', async () => {
    const db = await createTestDb();
    const { sets: [set] } = await walkOn(db, MON);
    await expect(updateSet(db, set.id, { difficulty: 0 })).rejects.toThrow('Difficulty is from 1 to 10');
    await expect(updateSet(db, set.id, { difficulty: 11 })).rejects.toThrow('Difficulty is from 1 to 10');
    await expect(updateSet(db, set.id, { difficulty: 6.5 })).rejects.toThrow('Difficulty is from 1 to 10');
    await expect(updateSet(db, set.id, { count: 2.5 })).rejects.toThrow('count must be a whole number');
    await expect(updateSet(db, set.id, { score: 3.2 })).rejects.toThrow('score must be a whole number');
    await expect(updateSet(db, set.id, { elevation: -10 })).rejects.toThrow('elevation cannot be negative');
  });

  it('keeps the count target when swapping in another exercise', async () => {
    const db = await createTestDb();
    const climb = await findByName(db, 'Climbing');
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: climb, targetDurationMin: 60, targetCount: 12 }] });
    const w = await ensureWorkout(db, MON);
    await replaceWorkoutExercise(db, w.exercises[0].id, await findByName(db, 'HIIT'));
    expect((await getWorkout(db, MON))!.exercises[0]).toMatchObject({ exerciseName: 'HIIT', targetDurationMin: 60, targetCount: 12 });
  });

  it('gives a timed lift numbered sets but no rep target', async () => {
    const db = await createTestDb();
    const plank = await findByName(db, 'Weighted Plank');
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: plank, targetSets: 3, targetDurationMin: 1 }] });
    const ex = (await ensureWorkout(db, MON)).exercises[0];
    expect(ex).toMatchObject({ fields: ['weight', 'duration'], targetDurationMin: 1 });
    expect(ex.sets.map((s) => s.targetReps)).toEqual([null, null, null]);
  });
});

describe('what a day records for an exercise', () => {
  async function walkPlanned(fields?: ('duration' | 'distance' | 'steps')[]) {
    const db = await createTestDb();
    const walk = await findByName(db, 'Walking');
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: walk, fields }] });
    return { db, walk };
  }

  it('starts from what the plan item records', async () => {
    const { db } = await walkPlanned(['duration', 'steps']);
    expect((await ensureWorkout(db, MON)).exercises[0]).toMatchObject({
      fields: ['duration', 'steps'], defaultFields: ['duration', 'distance', 'steps'],
    });
  });

  it("follows the exercise's default when neither the plan nor the day picked", async () => {
    const { db, walk } = await walkPlanned();
    await ensureWorkout(db, MON);
    await setDefaultFields(db, walk, ['duration', 'steps']);
    expect((await getWorkout(db, MON))!.exercises[0]).toMatchObject({ fields: ['duration', 'steps'], defaultFields: ['duration', 'steps'] });
  });

  it('changes it for that day only, keeping the day when the plan changes', async () => {
    const { db, walk } = await walkPlanned();
    const we = (await ensureWorkout(db, MON)).exercises[0];
    await setWorkoutExerciseFields(db, we.id, ['steps', 'duration']);
    expect((await getWorkout(db, MON))!.exercises[0]).toMatchObject({ fields: ['duration', 'steps'], defaultFields: ['duration', 'distance', 'steps'] });
    expect((await ensureWorkout(db, '2026-11-09')).exercises[0].fields).toEqual(['duration', 'distance', 'steps']);
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: walk, fields: ['duration'] }] });
    await refreshUntouchedWorkouts(db, MON);
    expect((await getWorkout(db, MON))!.exercises[0].fields).toEqual(['duration', 'steps']);
  });

  it("refuses fields the exercise's category doesn't offer", async () => {
    const { db } = await walkPlanned();
    const we = (await ensureWorkout(db, MON)).exercises[0];
    await expect(setWorkoutExerciseFields(db, we.id, ['reps'])).rejects.toThrow('Reps is not available');
  });
});
