import { getPlan, isPlanComplete, markPlanComplete, setPlanDay } from '../plan';
import { findByName } from '@/test/helpers';
import { createTestDb } from '@/test/testDb';

describe('weekly plan', () => {
  it('starts with 7 empty days and is not complete', async () => {
    const db = await createTestDb();
    const plan = await getPlan(db);
    expect(plan).toHaveLength(7);
    expect(plan.every((d) => d.items.length === 0 && !d.isRest)).toBe(true);
    expect(await isPlanComplete(db)).toBe(false);
  });

  it('saves a day with ordered items', async () => {
    const db = await createTestDb();
    const bench = await findByName(db, 'Bench Press');
    const squat = await findByName(db, 'Squat');
    await setPlanDay(db, 1, {
      isRest: false,
      items: [
        { exerciseId: bench, targetSets: 3, targetReps: 10 },
        { exerciseId: squat, targetSets: 5, targetReps: 5 },
      ],
    });
    const monday = (await getPlan(db)).find((d) => d.weekday === 1)!;
    expect(monday.items.map((i) => [i.exerciseName, i.targetSets, i.targetReps])).toEqual([
      ['Bench Press', 3, 10],
      ['Squat', 5, 5],
    ]);
    expect(monday.items[0].categoryKind).toBe('strength');
  });

  it('replaces previous items when a day is saved again', async () => {
    const db = await createTestDb();
    const bench = await findByName(db, 'Bench Press');
    const run = await findByName(db, 'Running');
    await setPlanDay(db, 2, { isRest: false, items: [{ exerciseId: bench, targetSets: 3, targetReps: 8 }] });
    await setPlanDay(db, 2, { isRest: false, items: [{ exerciseId: run, targetDurationMin: 30, targetDistance: 3 }] });
    const day = (await getPlan(db)).find((d) => d.weekday === 2)!;
    expect(day.items).toHaveLength(1);
    expect(day.items[0]).toMatchObject({ exerciseName: 'Running', targetDurationMin: 30, targetDistance: 3 });
  });

  it('a rest day drops its items', async () => {
    const db = await createTestDb();
    const bench = await findByName(db, 'Bench Press');
    await setPlanDay(db, 3, { isRest: false, items: [{ exerciseId: bench, targetSets: 3, targetReps: 8 }] });
    await setPlanDay(db, 3, { isRest: true, items: [] });
    const day = (await getPlan(db)).find((d) => d.weekday === 3)!;
    expect(day).toMatchObject({ isRest: true, items: [] });
  });

  it('rejects invalid weekdays and rest days with items', async () => {
    const db = await createTestDb();
    const bench = await findByName(db, 'Bench Press');
    await expect(setPlanDay(db, 7, { isRest: true, items: [] })).rejects.toThrow(/weekday/i);
    await expect(
      setPlanDay(db, 1, { isRest: true, items: [{ exerciseId: bench, targetSets: 1, targetReps: 1 }] }),
    ).rejects.toThrow(/rest/i);
  });

  it('remembers when setup is complete', async () => {
    const db = await createTestDb();
    await markPlanComplete(db);
    expect(await isPlanComplete(db)).toBe(true);
  });
});
