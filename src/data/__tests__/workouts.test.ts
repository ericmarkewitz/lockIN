import { setPlanDay } from '../plan';
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
  setRestDay,
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
