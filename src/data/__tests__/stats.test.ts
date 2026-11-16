import { findByName } from '@/test/helpers';
import { createTestDb } from '@/test/testDb';
import type { Db } from '@/db/types';
import { setPlanDay } from '../plan';
import { getLiftTrend, getLifetimeStats, getVolumeSeries, listTrackedLifts } from '../stats';
import { addSet, ensureWorkout, setRestDay, updateSet } from '../workouts';

type Entry = { weight?: number; reps?: number; durationMin?: number; distance?: number; completed?: boolean };

async function log(db: Db, date: string, sets: Entry[], idx = 0) {
  const w = await ensureWorkout(db, date);
  const we = w.exercises[idx];
  for (let i = we.sets.length; i < sets.length; i++) await addSet(db, we.id);
  const fresh = (await ensureWorkout(db, date)).exercises[idx];
  for (const [i, s] of sets.entries()) await updateSet(db, fresh.sets[i].id, { completed: true, ...s });
}

/** Mondays: bench then squat. Wednesdays: running then pull-ups. */
async function seeded() {
  const db = await createTestDb();
  const bench = await findByName(db, 'Bench Press');
  const squat = await findByName(db, 'Squat');
  const run = await findByName(db, 'Running');
  const pullup = await findByName(db, 'Pull-up');
  await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: bench, targetSets: 1 }, { exerciseId: squat, targetSets: 1 }] });
  await setPlanDay(db, 3, { isRest: false, items: [{ exerciseId: run, targetDurationMin: 30 }, { exerciseId: pullup, targetSets: 1 }] });
  return { db, bench, squat, run, pullup };
}

const MON1 = '2026-10-26';
const MON2 = '2026-11-02';
const WED2 = '2026-11-04';

describe('getLifetimeStats', () => {
  it('is all zeros with nothing logged', async () => {
    const { db } = await seeded();
    await ensureWorkout(db, MON1);
    expect(await getLifetimeStats(db)).toEqual({ workouts: 0, sets: 0, volume: 0, exercises: 0 });
  });

  it('totals workouts, strength sets, volume and distinct exercises', async () => {
    const { db } = await seeded();
    await log(db, MON1, [{ weight: 100, reps: 10 }, { weight: 110, reps: 8 }]); // bench: 1000 + 880
    await log(db, MON1, [{ weight: 200, reps: 5 }], 1); // squat: 1000
    await log(db, MON2, [{ weight: 120, reps: 5 }]); // bench again: 600
    await log(db, WED2, [{ durationMin: 30, distance: 3 }]); // running
    expect(await getLifetimeStats(db)).toEqual({ workouts: 3, sets: 4, volume: 3480, exercises: 3 });
  });

  it('counts a bodyweight set but adds no volume for it', async () => {
    const { db } = await seeded();
    await log(db, WED2, [{ reps: 10 }], 1);
    expect(await getLifetimeStats(db)).toEqual({ workouts: 1, sets: 1, volume: 0, exercises: 1 });
  });

  it('ignores sets that were never logged', async () => {
    const { db } = await seeded();
    await log(db, MON1, [{ weight: 100, reps: 5 }, { completed: false }]);
    expect(await getLifetimeStats(db)).toMatchObject({ sets: 1, volume: 500 });
  });

  it('keeps a logged day that was later marked as rest', async () => {
    const { db } = await seeded();
    await log(db, MON1, [{ weight: 100, reps: 5 }]);
    await setRestDay(db, MON1, true);
    expect(await getLifetimeStats(db)).toMatchObject({ workouts: 1, sets: 1, volume: 500 });
  });
});

const TODAY = '2026-11-15'; // a Sunday

describe('getVolumeSeries', () => {
  it('covers the last 5 weeks for one month, oldest first, with empty weeks as zero', async () => {
    const { db } = await seeded();
    await log(db, '2026-10-05', [{ weight: 100, reps: 10 }]); // before the window
    await log(db, MON1, [{ weight: 100, reps: 10 }]);
    await log(db, MON2, [{ weight: 100, reps: 5 }]);
    await log(db, WED2, [{ weight: 0, reps: 10 }], 1); // same week, no volume
    expect(await getVolumeSeries(db, { range: '1m', today: TODAY })).toEqual({
      bucket: 'week',
      bars: [
        { start: '2026-10-12', volume: 0 },
        { start: '2026-10-19', volume: 0 },
        { start: '2026-10-26', volume: 1000 },
        { start: '2026-11-02', volume: 500 },
        { start: '2026-11-09', volume: 0 },
      ],
    });
  });

  it('covers 13 weeks for three months', async () => {
    const { db } = await seeded();
    const { bucket, bars } = await getVolumeSeries(db, { range: '3m', today: TODAY });
    expect(bucket).toBe('week');
    expect(bars).toHaveLength(13);
    expect(bars[0].start).toBe('2026-08-17');
    expect(bars[12].start).toBe('2026-11-09');
  });

  it('switches to months for six months and a year', async () => {
    const { db } = await seeded();
    await log(db, MON1, [{ weight: 100, reps: 10 }]);
    await log(db, MON2, [{ weight: 100, reps: 5 }]);
    const six = await getVolumeSeries(db, { range: '6m', today: TODAY });
    expect(six.bucket).toBe('month');
    expect(six.bars.map((b) => b.start)).toEqual(['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01']);
    expect(six.bars.slice(-2)).toEqual([{ start: '2026-10-01', volume: 1000 }, { start: '2026-11-01', volume: 500 }]);
    const year = await getVolumeSeries(db, { range: '1y', today: TODAY });
    expect(year.bars).toHaveLength(12);
    expect(year.bars[0].start).toBe('2025-12-01');
  });

  it('runs all time from the month of the first logged workout', async () => {
    const { db } = await seeded();
    await log(db, '2026-09-07', [{ weight: 100, reps: 1 }]);
    await log(db, MON2, [{ weight: 100, reps: 2 }]);
    expect(await getVolumeSeries(db, { range: 'all', today: TODAY })).toEqual({
      bucket: 'month',
      bars: [{ start: '2026-09-01', volume: 100 }, { start: '2026-10-01', volume: 0 }, { start: '2026-11-01', volume: 200 }],
    });
  });

  it('shows just this month for all time when nothing is logged', async () => {
    const { db } = await seeded();
    expect(await getVolumeSeries(db, { range: 'all', today: TODAY })).toEqual({ bucket: 'month', bars: [{ start: '2026-11-01', volume: 0 }] });
  });
});

describe('getLiftTrend', () => {
  /** Bench on Mondays and Wednesdays, so some weeks have two sessions. */
  async function twiceAWeek() {
    const { db, bench } = await seeded();
    await setPlanDay(db, 3, { isRest: false, items: [{ exerciseId: bench, targetSets: 1 }] });
    const sessions: [string, number][] = [
      ['2026-09-07', 100], ['2026-09-09', 110], // week of Sep 7
      ['2026-10-26', 120], ['2026-10-28', 115], // week of Oct 26
      ['2026-11-02', 125], ['2026-11-04', 130], // week of Nov 2
    ];
    for (const [date, weight] of sessions) await log(db, date, [{ weight, reps: 1 }]);
    return { db, bench };
  }

  it('has a point per session for one and three months, oldest first', async () => {
    const { db, bench } = await twiceAWeek();
    expect(await getLiftTrend(db, bench, { range: '1m', today: TODAY })).toEqual([
      { date: '2026-10-26', oneRepMax: 120 }, { date: '2026-10-28', oneRepMax: 115 },
      { date: '2026-11-02', oneRepMax: 125 }, { date: '2026-11-04', oneRepMax: 130 },
    ]);
    expect(await getLiftTrend(db, bench, { range: '3m', today: TODAY })).toHaveLength(6);
  });

  it('uses the best estimate of each set in a session', async () => {
    const { db, bench } = await seeded();
    await log(db, MON2, [{ weight: 130, reps: 10 }, { weight: 140, reps: 5 }]);
    expect(await getLiftTrend(db, bench, { range: '1m', today: TODAY })).toEqual([{ date: MON2, oneRepMax: 173.3 }]);
  });

  it('keeps the best session of each week for six months and a year', async () => {
    const { db, bench } = await twiceAWeek();
    const expected = [
      { date: '2026-09-09', oneRepMax: 110 }, { date: '2026-10-26', oneRepMax: 120 }, { date: '2026-11-04', oneRepMax: 130 },
    ];
    expect(await getLiftTrend(db, bench, { range: '6m', today: TODAY })).toEqual(expected);
    expect(await getLiftTrend(db, bench, { range: '1y', today: TODAY })).toEqual(expected);
  });

  it('shows every session for all time when the lift goes back three months or less', async () => {
    const { db, bench } = await twiceAWeek();
    expect(await getLiftTrend(db, bench, { range: 'all', today: TODAY })).toHaveLength(6);
  });

  it('keeps the best session of each week for all time when the lift goes back up to a year', async () => {
    const { db, bench } = await twiceAWeek();
    await log(db, '2026-01-05', [{ weight: 90, reps: 1 }]);
    await log(db, '2026-11-09', [{ weight: 128, reps: 1 }]); // same month as the 130, a different week
    expect(await getLiftTrend(db, bench, { range: 'all', today: TODAY })).toEqual([
      { date: '2026-01-05', oneRepMax: 90 },
      { date: '2026-09-09', oneRepMax: 110 }, { date: '2026-10-26', oneRepMax: 120 }, { date: '2026-11-04', oneRepMax: 130 },
      { date: '2026-11-09', oneRepMax: 128 },
    ]);
  });

  it('keeps the best session of each month for all time when the lift goes back more than a year', async () => {
    const { db, bench } = await twiceAWeek();
    await log(db, '2025-06-02', [{ weight: 90, reps: 1 }]);
    await log(db, '2026-11-09', [{ weight: 128, reps: 1 }]); // same month as the 130
    expect(await getLiftTrend(db, bench, { range: 'all', today: TODAY })).toEqual([
      { date: '2025-06-02', oneRepMax: 90 },
      { date: '2026-09-09', oneRepMax: 110 }, { date: '2026-10-26', oneRepMax: 120 }, { date: '2026-11-04', oneRepMax: 130 },
    ]);
  });

  it('leaves out sessions before the range', async () => {
    const { db, bench } = await twiceAWeek();
    expect((await getLiftTrend(db, bench, { range: '1m', today: TODAY }))[0].date).toBe('2026-10-26');
  });

  it('leaves out sets without weight', async () => {
    const { db, pullup } = await seeded();
    await log(db, WED2, [{ reps: 10 }], 1);
    expect(await getLiftTrend(db, pullup, { range: '1m', today: TODAY })).toEqual([]);
  });
});

describe('listTrackedLifts', () => {
  it('lists lifts with at least two weighted sessions, most sessions first', async () => {
    const { db, bench, squat } = await seeded();
    for (const d of [MON1, MON2, '2026-11-09']) await log(db, d, [{ weight: 100, reps: 5 }]);
    for (const d of [MON1, MON2]) await log(db, d, [{ weight: 200, reps: 5 }], 1);
    expect(await listTrackedLifts(db)).toEqual([
      { id: bench, name: 'Bench Press', sessions: 3 },
      { id: squat, name: 'Squat', sessions: 2 },
    ]);
  });

  it('leaves out one-off lifts, bodyweight-only lifts and cardio', async () => {
    const { db } = await seeded();
    await log(db, MON1, [{ weight: 100, reps: 5 }]); // bench once
    for (const d of [WED2, '2026-11-11']) {
      await log(db, d, [{ durationMin: 30 }]);
      await log(db, d, [{ reps: 8 }], 1);
    }
    expect(await listTrackedLifts(db)).toEqual([]);
  });
});
