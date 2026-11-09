import { findByName } from '@/test/helpers';
import { createTestDb } from '@/test/testDb';
import type { Db } from '@/db/types';
import { getExerciseHistory, listLoggedExercises, listLoggedWorkouts } from '../history';
import { setPlanDay } from '../plan';
import { addSet, ensureWorkout, setRestDay, updateSet } from '../workouts';

async function log(db: Db, date: string, sets: { weight?: number; reps?: number; durationMin?: number; distance?: number }[], idx = 0) {
  const w = await ensureWorkout(db, date);
  const we = w.exercises[idx];
  for (let i = we.sets.length; i < sets.length; i++) await addSet(db, we.id);
  const fresh = (await ensureWorkout(db, date)).exercises[idx];
  for (const [i, s] of sets.entries()) await updateSet(db, fresh.sets[i].id, { ...s, completed: true });
}

async function seeded() {
  const db = await createTestDb();
  const bench = await findByName(db, 'Bench Press');
  const run = await findByName(db, 'Running');
  // Mondays: bench; Wednesdays: bench + run
  await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: bench, targetSets: 2, targetReps: 10 }] });
  await setPlanDay(db, 3, { isRest: false, items: [{ exerciseId: bench, targetSets: 1, targetReps: 5 }, { exerciseId: run, targetDurationMin: 30 }] });
  return { db, bench, run };
}

describe('a logged day later marked as rest', () => {
  const MON = '2026-11-02';

  async function loggedThenRested() {
    const { db, bench } = await seeded();
    await log(db, MON, [{ weight: 135, reps: 10 }]);
    await setRestDay(db, MON, true);
    return { db, bench };
  }

  it('stays in the workout list, counting only its logged sets', async () => {
    const { db } = await loggedThenRested();
    expect(await listLoggedWorkouts(db)).toEqual([{ date: MON, exerciseNames: ['Bench Press'], setCount: 1 }]);
  });

  it('stays in the exercise list', async () => {
    const { db, bench } = await loggedThenRested();
    expect(await listLoggedExercises(db)).toMatchObject([{ id: bench, sessions: 1, lastDate: MON }]);
  });

  it('stays in the exercise history', async () => {
    const { db, bench } = await loggedThenRested();
    expect(await getExerciseHistory(db, bench)).toMatchObject([{ date: MON, setCount: 1 }]);
  });
});

describe('listLoggedWorkouts', () => {
  it('lists workouts with logged sets, newest first', async () => {
    const { db } = await seeded();
    await log(db, '2026-10-26', [{ weight: 130, reps: 10 }, { weight: 130, reps: 9 }]);
    await log(db, '2026-11-02', [{ weight: 135, reps: 10 }]);
    const list = await listLoggedWorkouts(db);
    expect(list.map((w) => w.date)).toEqual(['2026-11-02', '2026-10-26']);
    expect(list[1]).toMatchObject({ exerciseNames: ['Bench Press'], setCount: 2 });
  });

  it('skips workouts that were opened but never logged, and rest days', async () => {
    const { db } = await seeded();
    await ensureWorkout(db, '2026-11-02');
    await setRestDay(db, '2026-11-03', true);
    expect(await listLoggedWorkouts(db)).toEqual([]);
  });

  it('counts only logged sets and names only exercises that have them', async () => {
    const { db } = await seeded();
    await log(db, '2026-11-04', [{ weight: 100, reps: 5 }], 0); // bench logged, run untouched
    const [w] = await listLoggedWorkouts(db);
    expect(w).toMatchObject({ date: '2026-11-04', exerciseNames: ['Bench Press'], setCount: 1 });
  });

  it('honors a limit and a before-date cursor', async () => {
    const { db } = await seeded();
    for (const d of ['2026-10-19', '2026-10-26', '2026-11-02']) await log(db, d, [{ weight: 100, reps: 5 }]);
    expect((await listLoggedWorkouts(db, { limit: 2 })).map((w) => w.date)).toEqual(['2026-11-02', '2026-10-26']);
    expect((await listLoggedWorkouts(db, { before: '2026-11-02' })).map((w) => w.date)).toEqual(['2026-10-26', '2026-10-19']);
  });
});

describe('listLoggedExercises', () => {
  it('lists exercises with logged history, most recently performed first', async () => {
    const { db, bench, run } = await seeded();
    await log(db, '2026-11-02', [{ weight: 135, reps: 10 }]);
    await log(db, '2026-11-04', [{ durationMin: 30 }], 1);
    const list = await listLoggedExercises(db);
    expect(list.map((e) => e.id)).toEqual([run, bench]);
    expect(list[1]).toMatchObject({ name: 'Bench Press', kind: 'strength', sessions: 1, lastDate: '2026-11-02' });
  });

  it('omits exercises that were never logged', async () => {
    const { db } = await seeded();
    await ensureWorkout(db, '2026-11-02');
    expect(await listLoggedExercises(db)).toEqual([]);
  });
});

describe('getExerciseHistory', () => {
  it('returns one entry per session with the best set and estimated 1RM, newest first', async () => {
    const { db, bench } = await seeded();
    await log(db, '2026-10-26', [{ weight: 130, reps: 10 }, { weight: 135, reps: 6 }]);
    await log(db, '2026-11-02', [{ weight: 140, reps: 5 }, { weight: 100, reps: 15 }]);
    const h = await getExerciseHistory(db, bench);
    expect(h.map((s) => s.date)).toEqual(['2026-11-02', '2026-10-26']);
    expect(h[0].best).toEqual({ weight: 140, reps: 5 });
    expect(h[0].estimatedOneRepMax).toBe(163.3); // 140 * (1 + 5/30); beats 100 * 1.5 = 150
    expect(h[1].best).toEqual({ weight: 135, reps: 6 }); // heaviest set, not the highest e1RM (173.3 vs 162)
    expect(h[1].estimatedOneRepMax).toBe(173.3); // from the 130x10 set
  });

  it('breaks weight ties by reps', async () => {
    const { db, bench } = await seeded();
    await log(db, '2026-11-02', [{ weight: 135, reps: 5 }, { weight: 135, reps: 8 }]);
    expect((await getExerciseHistory(db, bench))[0].best).toEqual({ weight: 135, reps: 8 });
  });

  it('ignores unlogged sets', async () => {
    const { db, bench } = await seeded();
    await log(db, '2026-11-02', [{ weight: 135, reps: 5 }]); // set 2 stays blank
    const h = await getExerciseHistory(db, bench);
    expect(h).toHaveLength(1);
    expect(h[0].setCount).toBe(1);
  });

  it('sums duration and distance for cardio and has no strength numbers', async () => {
    const { db, run } = await seeded();
    await log(db, '2026-11-04', [{ durationMin: 30, distance: 3.1 }], 1);
    const [s] = await getExerciseHistory(db, run);
    expect(s).toMatchObject({ durationMin: 30, distance: 3.1, best: null, estimatedOneRepMax: null });
  });

  it('is empty for an exercise with no history', async () => {
    const { db, bench } = await seeded();
    expect(await getExerciseHistory(db, bench)).toEqual([]);
  });
});

describe('sets only count for strength', () => {
  it('counts strength sets for a day, not cardio entries', async () => {
    const { db } = await seeded();
    await log(db, '2026-11-04', [{ weight: 135, reps: 5 }], 0);
    await log(db, '2026-11-04', [{ durationMin: 30 }], 1);
    expect(await listLoggedWorkouts(db)).toEqual([{ date: '2026-11-04', exerciseNames: ['Bench Press', 'Running'], setCount: 1 }]);
  });

  it('counts no sets for a cardio-only day', async () => {
    const { db } = await seeded();
    await log(db, '2026-11-04', [{ durationMin: 30 }], 1);
    expect(await listLoggedWorkouts(db)).toEqual([{ date: '2026-11-04', exerciseNames: ['Running'], setCount: 0 }]);
  });
});
